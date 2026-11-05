// ============================================================
//  Docão Shooter — servidor online (Cloudflare Worker + Durable Object com SQLite).
//  Rotas:
//    POST /api/rooms            {map, max, fillBots}  → {code}   (cria sala com código de 4 letras)
//    GET  /api/rooms/ABCD       → {exists, players, max, state, map}
//    GET  /ws/ABCD?name=&skin=&primary=&token=   (upgrade WebSocket → Durable Object "Room" da sala)
//    GET  /health
//  Um Durable Object por sala (idFromName(código)). WebSocket Hibernation API: no lobby o objeto
//  pode hibernar; durante a partida um setInterval de 20 Hz roda a simulação (game.js).
//  "ping" → "pong" é respondido automaticamente (setWebSocketAutoResponse), sem acordar o objeto nem contar como requisição.
// ============================================================
import { DurableObject } from 'cloudflare:workers';
import { TrucoRoom } from './truco-room.js';
import { UnoRoom } from './uno-room.js';
export { TrucoRoom, UnoRoom };
import { Game } from './game.js';
import { SKINS } from '../../skins.js';
import { handleAccountRoute, accountFromToken, nickRegistered, saveSkin, recordStats } from './auth.js';
import { equipKnife, equipSniper, equipGun } from './shop.js';
import { knifeKind, sniperKind } from '../../shared/closet.js';
import { cleanName, NAME_MAX } from '../../shared/names.js';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I/O pra não confundir
const CODE_RE = /^[A-Z]{4}$/;
const EMPTY_TTL = 120 * 1000; // sala vazia some depois de 2 min
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors, ...extra } });
const guestName = (raw) => cleanName(Array.from(cleanName(raw)).slice(0, NAME_MAX - 7).join('').trim() + ' (conv)'); // convidado com apelido de conta vira "Nome (conv)"
const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, name: 'docao-shooter-server' });
    if (url.pathname === '/api/truco/rooms' && req.method === 'POST') {
      if (!env.TRUCO_ROOMS) return json({ error: 'Sala de truco indisponível' }, 503);
      let body = {}; try { body = await req.json(); } catch (e) { /* corpo vazio */ }
      const seats = body.seats === 2 ? 2 : 4;
      for (let i = 0; i < 12; i++) {
        const code = newCode(); const stub = env.TRUCO_ROOMS.get(env.TRUCO_ROOMS.idFromName('truco:' + code));
        const r = await stub.fetch('https://truco/init', { method: 'POST', body: JSON.stringify({ code, seats }) });
        if (r.status === 200) return json({ code });
      }
      return json({ error: 'Não deu pra gerar um código de sala' }, 503);
    }
    const trucoInfo = url.pathname.match(/^\/api\/truco\/rooms\/([A-Za-z]{4})\/?$/);
    if (trucoInfo) {
      if (!env.TRUCO_ROOMS) return json({ exists: false }, 503);
      const code = trucoInfo[1].toUpperCase(); const stub = env.TRUCO_ROOMS.get(env.TRUCO_ROOMS.idFromName('truco:' + code));
      const r = await stub.fetch('https://truco/info'); return json(await r.json(), r.status);
    }
    const trucoWs = url.pathname.match(/^\/ws\/truco\/([A-Za-z]{4})\/?$/);
    if (trucoWs) {
      if (!env.TRUCO_ROOMS) return json({ error: 'Sala de truco indisponível' }, 503);
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Esperado WebSocket' }, 426);
      const code = trucoWs[1].toUpperCase(); const stub = env.TRUCO_ROOMS.get(env.TRUCO_ROOMS.idFromName('truco:' + code));
      return stub.fetch(new Request('https://truco/ws' + url.search, { method: 'GET', headers: req.headers }));
    }
    if (url.pathname === '/api/uno/rooms' && req.method === 'POST') {
      if (!env.UNO_ROOMS) return json({ error: 'Sala de UNO indisponível' }, 503);
      let body = {}; try { body = await req.json(); } catch (e) { /* corpo vazio */ }
      const seats = body.seats === 4 || body.seats === 6 ? body.seats : 2;
      const target = Number(body.target) === 200 ? 200 : 500;
      const level = body.level === 'facil' || body.level === 'pro' ? body.level : 'medio';
      for (let i = 0; i < 12; i++) {
        const code = newCode(); const stub = env.UNO_ROOMS.get(env.UNO_ROOMS.idFromName('uno:' + code));
        const r = await stub.fetch('https://uno/init', { method: 'POST', body: JSON.stringify({ code, seats, target, level }) });
        if (r.status === 200) return json({ code });
      }
      return json({ error: 'Não deu pra gerar um código de sala' }, 503);
    }
    const unoInfo = url.pathname.match(/^\/api\/uno\/rooms\/([A-Za-z]{4})\/?$/);
    if (unoInfo) {
      if (!env.UNO_ROOMS) return json({ exists: false }, 503);
      const code = unoInfo[1].toUpperCase(); const stub = env.UNO_ROOMS.get(env.UNO_ROOMS.idFromName('uno:' + code));
      const r = await stub.fetch('https://uno/info'); return json(await r.json(), r.status);
    }
    const unoWs = url.pathname.match(/^\/ws\/uno\/([A-Za-z]{4})\/?$/);
    if (unoWs) {
      if (!env.UNO_ROOMS) return json({ error: 'Sala de UNO indisponível' }, 503);
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Esperado WebSocket' }, 426);
      const code = unoWs[1].toUpperCase(); const stub = env.UNO_ROOMS.get(env.UNO_ROOMS.idFromName('uno:' + code));
      return stub.fetch(new Request('https://uno/ws' + url.search, { method: 'GET', headers: req.headers }));
    }
    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      let body = {}; try { body = await req.json(); } catch (e) { /* corpo vazio */ }
      for (let i = 0; i < 12; i++) {
        const code = newCode(); const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ ...body, code }) });
        if (r.status === 200) return json({ code });
      }
      return json({ error: 'Não deu pra gerar um código de sala' }, 503);
    }
    const acctRes = await handleAccountRoute(req, env, url, json); if (acctRes) return acctRes;
    const m = url.pathname.match(/^\/(api\/rooms|ws)\/([A-Za-z]{4})\/?$/);
    if (m) {
      const code = m[2].toUpperCase(); const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      if (m[1] === 'ws') {
        if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Esperado WebSocket' }, 426);
        // Conta (opcional): o token vem no subprotocolo "tk.<token>" (fora da URL, pra não cair em log). Só o Worker confere o token;
        // a sala recebe o resultado por cabeçalhos internos (os de fora são descartados).
        const h = new Headers(req.headers); h.delete('x-docao-acct'); h.delete('x-docao-authfail'); h.delete('x-docao-proto'); h.delete('x-docao-guestname');
        const protos = (req.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((x) => x.trim()).filter(Boolean);
        const tk = protos.find((x) => x.startsWith('tk.')); if (protos.includes('docao')) h.set('x-docao-proto', 'docao');
        if (tk) {
          const acc = await accountFromToken(env, tk.slice(3));
          if (acc) h.set('x-docao-acct', JSON.stringify({ id: acc.id, nick: acc.nick, skin: acc.skin || '', knife: acc.knife || '', sniper: acc.sniper || '', guns: acc.guns || '' })); else h.set('x-docao-authfail', '1');
        } else if (await nickRegistered(env, url.searchParams.get('name'))) h.set('x-docao-guestname', guestName(url.searchParams.get('name')));
        return stub.fetch(new Request('https://room/ws' + url.search, { method: 'GET', headers: h }));
      }
      const r = await stub.fetch('https://room/info'); return json(await r.json(), r.status);
    }
    return json({ error: 'Não encontrado' }, 404);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.game = null; this.loop = null;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get('room');
      if (saved) this.restore(saved);
    });
  }
  // recria o jogo depois de hibernar (lobby/fim de partida): config + jogadores ainda conectados
  restore(saved) {
    this.game = this.makeGame({ ...saved.cfg, test: this.env.ALLOW_TEST === '1', chatLog: saved.chat }); this.game.nextId = saved.nextId || 1;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment(); if (!a) continue;
      const e = this.game.makeEnt({ name: a.name, skin: a.skin, primary: a.primary, secondary: a.secondary, melee: a.melee, bot: false });
      this.game.ents.delete(e.id); e.id = a.id; e.token = a.token; if (a.acct) { e.acct = a.acct; e.sk = e.sd = 0; } if (knifeKind(a.knife)) e.knife = a.knife; if (sniperKind(a.sniper)) e.sniper = a.sniper; this.game.ents.set(e.id, e);
      this.game.nextId = Math.max(this.game.nextId, a.id + 1);
    }
    this.game.hostId = this.game.ents.has(saved.hostId) ? saved.hostId : (this.game.humans()[0] || {}).id || 0;
    this.game.mapId = saved.mapId || null;
  }
  makeGame(cfg) {
    const self = this;
    return new Game(cfg, {
      send(id, o) { const ws = self.sockets().find((w) => (w.deserializeAttachment() || {}).id === id); if (ws) self.safeSend(ws, JSON.stringify(o)); },
      broadcast(o) { const s = JSON.stringify(o); for (const ws of self.sockets()) self.safeSend(ws, s); },
      startLoop() { self.lastMsg = Date.now(); if (!self.loop) self.loop = setInterval(() => self.maybeTick(true), 50); },
      stopLoop() { if (self.loop) { clearInterval(self.loop); self.loop = null; } self.persist(); },
      saveCfg() { self.persist(); },
      stats(items) { if (self.env.DB && items.length) self.ctx.waitUntil(recordStats(self.env, items).catch((e) => console.error('stats', e && e.message))); },
    });
  }
  // A simulação roda a 20 Hz "pegando carona" nas mensagens dos clientes (cada mensagem é uma invocação com o
  // próprio orçamento de CPU). O setInterval só completa os buracos e para de simular se nenhum cliente
  // mandou nada há 1 s (aba em segundo plano), pra nunca acumular CPU numa invocação só.
  maybeTick(fromTimer) {
    if (!this.loop || !this.game) return; const now = Date.now();
    if (now - (this.lastTick || 0) < 45 || (fromTimer && now - (this.lastMsg || 0) > 1000)) return;
    this.lastTick = now; try { this.game.tick(); } catch (e) { console.error('tick', e && e.stack); }
  }
  sockets() { return this.ctx.getWebSockets().filter((w) => w.readyState === 1 && w.deserializeAttachment()); }
  safeSend(ws, s) { try { ws.send(s); } catch (e) { /* socket fechando */ } }
  persist() { if (this.game) this.ctx.storage.put('room', { cfg: this.game.cfg, nextId: this.game.nextId, hostId: this.game.hostId, mapId: this.game.mapId, chat: this.game.chatLog || [] }); }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/init') {
      if (this.game) return new Response('exists', { status: 409 });
      const b = await req.json();
      const mode = b.mode === 'arms' || b.mode === 'dom' || b.mode === 'treino' || b.mode === 'inv' || b.mode === 'bomb' || b.mode === 'x1' || b.mode === 'survival' ? b.mode : 'dm';
      this.game = this.makeGame({ test: this.env.ALLOW_TEST === '1', code: b.code, map: mode === 'x1' ? 'random' : (typeof b.map === 'string' ? b.map : 'arena'), max: mode === 'x1' ? 2 : b.max, fillBots: b.fillBots !== false, mode, variant: b.variant === 'survival' ? 'survival' : '', survival: b.survival === true, surv: b.surv, time: b.time, weapons: b.weapons, powers: b.powers });
      this.persist(); await this.ctx.storage.setAlarm(Date.now() + EMPTY_TTL); // ninguém entrou? some
      return new Response('ok');
    }
    if (url.pathname === '/info') {
      if (!this.game) return Response.json({ exists: false }, { status: 404 });
      const g = this.game, players = g.humans().length;
      return Response.json({ exists: true, code: g.cfg.code, players, max: g.cfg.max, state: g.state, map: g.mapId || g.cfg.map, bots: [...g.ents.values()].filter((e) => e.bot && !e.zt).length, open: Math.max(0, g.cfg.max - players) });
    }
    if (url.pathname === '/ws') {
      const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const proto = req.headers.get('x-docao-proto') ? { 'Sec-WebSocket-Protocol': 'docao' } : {};
      const fail = (msg) => { server.send(JSON.stringify({ t: 'error', msg })); server.close(4000, msg.slice(0, 60)); return new Response(null, { status: 101, webSocket: client, headers: proto }); };
      if (req.headers.get('x-docao-authfail')) return fail('Sessão expirada. Entre de novo na sua conta (ou jogue como convidado).');
      let acct = null; try { const raw = req.headers.get('x-docao-acct'); if (raw) { const o = JSON.parse(raw); if (o && o.id > 0 && typeof o.nick === 'string') acct = { id: o.id | 0, nick: o.nick, skin: String(o.skin || ''), knife: String(o.knife || ''), sniper: String(o.sniper || ''), guns: typeof o.guns === 'string' ? o.guns : '' }; } } catch (e) { acct = null; }
      if (!this.game) return fail('Sala não encontrada');
      const q = url.searchParams;
      const r = this.game.join({ acct, name: !acct && req.headers.get('x-docao-guestname') ? req.headers.get('x-docao-guestname') : q.get('name'), skin: q.get('skin'), primary: parseInt(q.get('primary')), secondary: parseInt(q.get('secondary')), melee: parseInt(q.get('melee')), token: q.get('token') });
      if (r.error) return fail(r.error);
      const e = r.ent;
      for (const old of this.ctx.getWebSockets()) { const a = old.deserializeAttachment(); if (old !== server && a && a.id === e.id) { old.serializeAttachment(null); try { old.close(4001, 'Reconectado em outra aba'); } catch (x) { /* já fechado */ } } }
      server.serializeAttachment({ id: e.id, token: e.token, acct: e.acct ? { ...e.acct, skin: e.skin } : null, name: e.name, skin: e.skin, knife: e.knife || '', sniper: e.sniper || '', guns: e.guns && Object.keys(e.guns).length ? JSON.stringify(e.guns) : '', primary: e.primary, secondary: e.secondary, melee: e.melee });
      await this.ctx.storage.deleteAlarm();
      this.game.welcome(e); this.persist();
      return new Response(null, { status: 101, webSocket: client, headers: proto });
    }
    return new Response('not found', { status: 404 });
  }
  async webSocketMessage(ws, msg) {
    const a = ws.deserializeAttachment(); if (!a || !this.game || typeof msg !== 'string' || msg.length > 8192) return;
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    if (m && m.t === 'prof' && typeof m.knife === 'string' && a.acct) {
      const want = m.knife; const only = m.name == null && m.skin == null && m.primary == null && m.gun == null;
      delete m.knife;
      const ok = await equipKnife(this.env, a.acct.id, want).catch(() => false);
      if (ok) {
        const ent = this.game.ents.get(a.id); const id = knifeKind(want) ? want : '';
        if (ent) { ent.knife = id; this.game.events.push(['jkn', ent.id, id]); }
        a.knife = id; ws.serializeAttachment(a);
      }
      if (only) { this.lastMsg = Date.now(); this.maybeTick(false); return; }
    }
    if (m && m.t === 'prof' && typeof m.sniper === 'string' && a.acct) {
      const want = m.sniper; const only = m.name == null && m.skin == null && m.primary == null && m.knife == null && m.gun == null;
      delete m.sniper;
      const ok = await equipSniper(this.env, a.acct.id, want).catch(() => false);
      if (ok) {
        const ent = this.game.ents.get(a.id); const id = sniperKind(want) ? want : '';
        if (ent) { ent.sniper = id; this.game.events.push(['jsn', ent.id, id]); }
        a.sniper = id; ws.serializeAttachment(a);
      }
      if (only) { this.lastMsg = Date.now(); this.maybeTick(false); return; }
    }
    if (m && m.t === 'prof' && m.gun && typeof m.gun === 'object' && a.acct) {
      const key = typeof m.gun.k === 'string' ? m.gun.k : '';
      const want = typeof m.gun.id === 'string' ? m.gun.id : '';
      const only = m.name == null && m.skin == null && m.primary == null && m.knife == null && m.sniper == null;
      delete m.gun;
      const guns = await equipGun(this.env, a.acct.id, key, want).catch(() => false);
      if (guns) {
        const ent = this.game.ents.get(a.id);
        if (ent) { ent.guns = guns; this.game.events.push(['jgn', ent.id, key, guns[key] || '']); }
        a.guns = Object.keys(guns).length ? JSON.stringify(guns) : '';
        ws.serializeAttachment(a);
      }
      if (only) { this.lastMsg = Date.now(); this.maybeTick(false); return; }
    }
    if (m && m.t === 'prof') { // conta: skin vira a da conta (salva); convidado não pode tomar o apelido de uma conta
      if (a.acct) { // conta: a skin só muda se o D1 aceitar (da lista, ou visual personalizado com todas as partes na mochila); só grava se mudou
        if (typeof m.skin === 'string' && m.skin !== a.acct.skin && m.skin.length <= 48) {
          const ok = await saveSkin(this.env, a.acct.id, m.skin).catch(() => false);
          if (ok) { a.acct = { ...a.acct, skin: m.skin }; ws.serializeAttachment(a); if (!SKINS.some((x) => x.id === m.skin)) this.game.setVerifiedSkin(a.id, m.skin); }
        }
        delete m.skin; // quem aplica a skin da conta é o servidor (acima/setVerifiedSkin); o jogo ignora skin vinda do cliente de conta
        if (a.acct.skin && SKINS.some((x) => x.id === a.acct.skin)) m.skin = a.acct.skin;
      }
      else if (typeof m.name === 'string' && await nickRegistered(this.env, m.name)) m.name = guestName(m.name);
    }
    this.lastMsg = Date.now(); this.game.onMessage(a.id, m); this.maybeTick(false);
    if (m.t === 'prof') { const e = this.game.ents.get(a.id); if (e) ws.serializeAttachment({ ...a, acct: a.acct || null, name: e.name, skin: e.skin, knife: e.knife || '', sniper: e.sniper || '', guns: e.guns && Object.keys(e.guns).length ? JSON.stringify(e.guns) : '', primary: e.nextPrimary, secondary: e.nextSecondary, melee: e.nextMelee }); }
  }
  async webSocketClose(ws) { this.drop(ws); }
  async webSocketError(ws) { this.drop(ws); }
  drop(ws) {
    const a = ws.deserializeAttachment(); if (!a) return; ws.serializeAttachment(null);
    try { ws.close(1000, 'bye'); } catch (e) { /* já fechado */ }
    if (this.game) this.game.leave(a.id);
    if (!this.sockets().length) { this.ctx.storage.setAlarm(Date.now() + EMPTY_TTL); this.persist(); }
  }
  async alarm() {
    if (this.sockets().length) return;
    if (this.loop) { clearInterval(this.loop); this.loop = null; }
    this.game = null; await this.ctx.storage.deleteAll(); // sala vazia: limpa tudo
  }
}

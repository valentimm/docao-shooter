// Sala de UNO. Um Durable Object por código. A partida é por lance.
import { DurableObject } from 'cloudflare:workers';
import { createMatch, act, view, dueSeat, release, normLevel, normSeats, normTarget } from '../../shared/uno.js';
import { botAct, botCatch, botName, botSkin } from '../../shared/uno-bot.js';
import { EMOTES } from '../../shared/truco.js';
import { cleanName, uniqueName } from '../../shared/names.js';
import { SKINS } from '../../skins.js';

const EMPTY_TTL = 120 * 1000;
const TAKEOVER = 60 * 1000;
const TURN_MS = 25 * 1000;
const SKIN_IDS = SKINS.map((s) => s.id);

function randToken() {
  const a = crypto.getRandomValues(new Uint8Array(12));
  return [...a].map((n) => n.toString(16).padStart(2, '0')).join('');
}

export class UnoRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.code = '';
    this.hostId = 0;
    this.seatsN = 4;
    this.target = 500;
    this.level = 'medio';
    this.fill = true;
    this.phase = 'lobby';
    this.people = [null, null, null, null, null, null];
    this.match = null;
    this.chat = [];
    this.claims = [];
    this.nextId = 1;
    this.paused = false;
    this.answerDue = 0;
    this.rolledKey = '';
    this.timer = null;
    this.stepping = false;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get('uno');
      if (saved) this.restore(saved);
    });
  }

  restore(saved) {
    this.code = saved.code || '';
    this.hostId = saved.hostId || 0;
    this.seatsN = normSeats(saved.seatsN);
    this.target = normTarget(saved.target);
    this.level = normLevel(saved.level);
    this.fill = saved.fill !== false;
    this.phase = saved.phase || 'lobby';
    this.people = saved.people || [null, null, null, null, null, null];
    while (this.people.length < 6) this.people.push(null);
    this.chat = Array.isArray(saved.chat) ? saved.chat.slice(-30) : [];
    this.claims = saved.claims || [];
    this.nextId = saved.nextId || 1;
    this.match = saved.match || null;
    if (this.match) this.match.rand = Math.random;
    const live = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a) continue;
      live.add(a.id);
      const p = this.person(a.id);
      if (p) { p.connected = true; p.goneAt = 0; }
    }
    for (const p of this.people) if (p && !p.bot && !live.has(p.id)) { p.connected = false; p.goneAt = p.goneAt || Date.now(); }
    this.paused = this.people.some((p) => p && !p.bot && !p.auto && !p.connected);
  }

  persist() {
    const match = this.match ? (({ rand, events, ...rest }) => rest)(this.match) : null;
    this.ctx.storage.put('uno', {
      code: this.code, hostId: this.hostId, seatsN: this.seatsN, target: this.target, level: this.level, fill: this.fill, phase: this.phase,
      people: this.people, match, chat: this.chat, claims: this.claims, nextId: this.nextId,
    });
  }

  person(id) { return this.people.find((p) => p && p.id === id) || null; }
  seatOf(id) { return this.people.findIndex((p) => p && p.id === id); }
  connectedHumans() { return this.people.filter((p) => p && !p.bot && p.connected); }
  isBotSeat(s) { const p = this.people[s]; return !p || p.bot || p.auto; }

  makeBot(guest = false) {
    const seated = this.people.filter(Boolean);
    const name = botName(seated.map((p) => p.name), guest);
    const skin = botSkin(seated.map((p) => p.skin));
    return { id: this.nextId++, token: '', name, skin, bot: true, auto: false, connected: false, voice: 'off', goneAt: 0, sayAt: [] };
  }

  fillEmpty() {
    const open = [];
    for (let i = 0; i < this.seatsN; i++) if (!this.people[i]) open.push(i);
    const gift = open.length && Math.random() < 0.25 ? open[Math.floor(Math.random() * open.length)] : -1;
    for (const i of open) this.people[i] = this.makeBot(i === gift);
  }

  sockets() { return this.ctx.getWebSockets().filter((w) => w.readyState === 1 && w.deserializeAttachment()); }
  socketOf(id) { return this.sockets().find((w) => (w.deserializeAttachment() || {}).id === id) || null; }
  send(id, o) { const ws = this.socketOf(id); if (ws) try { ws.send(JSON.stringify(o)); } catch (e) { /* fechando */ } }
  broadcast(o) { const s = JSON.stringify(o); for (const ws of this.sockets()) try { ws.send(s); } catch (e) { /* fechando */ } }

  publicPeople() {
    return this.people.slice(0, this.seatsN).map((p, seat) => p ? {
      seat, id: p.id, name: p.name, skin: p.skin, bot: !!(p.bot || p.auto), connected: !!p.connected, host: p.id === this.hostId,
    } : { seat, id: 0, name: '', skin: '', bot: false, connected: false, host: false, empty: true });
  }

  sendStates() {
    const players = this.publicPeople();
    for (const p of this.people) {
      if (!p || p.bot || !p.connected) continue;
      const seat = this.seatOf(p.id);
      this.send(p.id, {
        t: 'state', phase: this.phase, you: seat, hostId: this.hostId, code: this.code, fill: this.fill,
        level: this.level, target: this.target, seats: this.seatsN,
        players, paused: this.paused, deadline: this.answerDue || 0,
        view: this.match && seat >= 0 ? view(this.match, seat) : null,
      });
    }
  }

  postChat(line) {
    const row = { id: line.id || 0, name: line.name || '', team: -1, scope: 'all', sys: line.sys ? 1 : 0, text: line.text, at: Date.now() };
    this.chat.push(row); while (this.chat.length > 30) this.chat.shift();
    for (const p of this.people) {
      if (!p || p.bot || !p.connected) continue;
      this.send(p.id, { t: 'chat', ...row });
    }
  }

  applyAct(seat, action, fromBot) {
    if (!this.match || this.phase !== 'play' || this.paused) return { ok: false, error: this.paused ? 'A mesa está pausada' : 'A mesa não está em jogo' };
    const result = act(this.match, seat, action);
    if (!result.ok) return result;
    if (fromBot) {
      const p = this.people[seat];
      if (fromBot.bark && p) this.postChat({ id: p.id, name: p.name, text: fromBot.bark });
      if (fromBot.emote && EMOTES.includes(fromBot.emote)) this.broadcast({ t: 'emote', seat, id: fromBot.emote });
    }
    if (result.events.some((e) => e.t === 'round' || e.t === 'match')) this.applyClaims();
    if (result.events.some((e) => e.t === 'match') || this.match.phase === 'over') this.phase = 'over';
    this.broadcast({ t: 'events', events: result.events });
    this.noteDeadline(true);
    this.sendStates();
    this.persist();
    this.plan();
    return result;
  }

  applyClaims() {
    const pending = this.claims.splice(0);
    for (const c of pending) {
      const person = this.person(c.id);
      const occ = this.people[c.seat];
      if (!person || person.bot || c.seat < 0 || c.seat >= this.seatsN) continue;
      if (occ && occ !== person && !(occ.bot && !occ.auto)) continue;
      this.place(person, c.seat);
    }
  }

  place(person, seat) {
    const cur = this.people.indexOf(person);
    const prev = this.people[seat];
    if (prev && prev !== person && !(prev.bot && !prev.auto)) return false;
    this.people[seat] = person;
    if (cur >= 0 && cur !== seat) this.people[cur] = this.phase === 'play' ? this.makeBot(Math.random() < 0.25) : null;
    return true;
  }

  noteDeadline(reset) {
    const m = this.match;
    const seat = m ? dueSeat(m) : -1;
    const waiting = m && this.phase === 'play' && !this.paused && seat >= 0 && !this.isBotSeat(seat);
    if (!waiting) { this.answerDue = 0; return; }
    if (reset || !this.answerDue) this.answerDue = Date.now() + TURN_MS;
  }

  plan() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.noteDeadline(false);
    const soon = this.nextWake();
    if (soon) this.ctx.storage.setAlarm(soon);
    if (this.phase !== 'play' || this.paused || !this.match || this.match.phase === 'over') return;
    if (this.match.forgot >= 0) {
      const key = this.match.seq + ':' + this.match.forgot;
      if (this.rolledKey !== key) {
        this.rolledKey = key;
        const hit = botCatch(this.match, this.level, Math.random, (s) => this.isBotSeat(s));
        if (hit) { this.timer = setTimeout(() => { this.timer = null; this.botCatchStep(hit); }, 450); return; }
      }
    }
    if (this.match.phase === 'gap') {
      this.timer = setTimeout(() => { this.timer = null; this.releaseGap(); }, 900);
    } else {
      const seat = dueSeat(this.match);
      if (seat >= 0 && this.isBotSeat(seat)) this.timer = setTimeout(() => { this.timer = null; this.botStep(seat); }, 700);
    }
  }

  botCatchStep(hit) {
    if (this.stepping || this.paused || !this.match || this.phase !== 'play' || this.match.forgot < 0) return;
    this.stepping = true;
    try { this.applyAct(hit.seat, hit.action, hit); }
    finally { this.stepping = false; }
  }

  releaseGap() {
    if (!this.match || this.match.phase !== 'gap' || this.paused) return;
    const r = release(this.match);
    if (r.events.some((e) => e.t === 'round' || e.t === 'match')) this.applyClaims();
    if (r.events.some((e) => e.t === 'match') || this.match.phase === 'over') this.phase = 'over';
    this.broadcast({ t: 'events', events: r.events });
    this.noteDeadline(true);
    this.sendStates();
    this.persist();
    this.plan();
  }

  nextWake() {
    const times = [];
    if (!this.connectedHumans().length) times.push(Date.now() + EMPTY_TTL);
    for (const p of this.people) if (p && !p.bot && !p.auto && !p.connected && p.goneAt) times.push(p.goneAt + TAKEOVER);
    if (this.answerDue) times.push(this.answerDue);
    if (this.phase === 'play' && !this.paused && this.match && this.match.phase !== 'over') {
      const seat = dueSeat(this.match);
      if (seat >= 0 && this.isBotSeat(seat)) times.push(Date.now() + 1000);
      if (this.match.phase === 'gap') times.push(Date.now() + 1200);
    }
    return times.length ? Math.min(...times) : 0;
  }

  botStep(seat) {
    if (this.stepping || this.paused || !this.match || this.phase !== 'play') return;
    if (dueSeat(this.match) !== seat || !this.isBotSeat(seat)) return;
    const picked = botAct(this.match, seat, this.level, Math.random);
    if (!picked) return;
    this.stepping = true;
    try { this.applyAct(seat, picked.action, picked); }
    finally { this.stepping = false; }
  }

  forceTurn() {
    if (!this.match || this.paused) return;
    const seat = dueSeat(this.match);
    if (seat < 0 || this.isBotSeat(seat)) return;
    const picked = botAct(this.match, seat, this.level, Math.random);
    if (picked) this.applyAct(seat, picked.action, null);
  }

  startMatch() {
    if (this.fill) this.fillEmpty();
    if (this.people.slice(0, this.seatsN).some((p) => !p)) return 'Falta gente na mesa';
    this.match = createMatch({ seats: this.seatsN, target: this.target, rand: Math.random });
    this.phase = this.match.phase === 'over' ? 'over' : 'play';
    this.answerDue = 0;
    this.rolledKey = '';
    this.broadcast({ t: 'events', events: this.match.events || [] });
    this.noteDeadline(true);
    this.sendStates();
    this.persist();
    this.plan();
    return '';
  }

  onSay(p, m) {
    const text = String(m.text || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!text || p.bot) return;
    const now = Date.now();
    p.sayAt = (p.sayAt || []).filter((t) => now - t < 5000);
    if (p.sayAt.length >= 4) return;
    p.sayAt.push(now);
    this.postChat({ id: p.id, name: p.name, text });
  }

  onSig(p, m) {
    const other = this.person(m.to | 0);
    if (!other || other.bot || !other.connected || other.id === p.id) return;
    const reaches = (a) => (a.voice || 'off') === 'all';
    if (!reaches(p) && !reaches(other)) return;
    if (m.kind !== 'offer' && m.kind !== 'answer' && m.kind !== 'ice') return;
    let data = m.data;
    if (m.kind === 'ice') {
      if (!data || typeof data !== 'object' || typeof data.candidate !== 'string' || !data.candidate) return;
      data = { candidate: data.candidate.slice(0, 2000), sdpMid: typeof data.sdpMid === 'string' ? data.sdpMid.slice(0, 32) : null, sdpMLineIndex: Number.isInteger(data.sdpMLineIndex) ? data.sdpMLineIndex : null };
    } else if (typeof data !== 'string' || data.length < 8 || data.length > 6000 || !data.startsWith('v=0')) return;
    this.send(other.id, { t: 'sig', from: p.id, kind: m.kind, data });
  }

  sendVoices() {
    this.broadcast({ t: 'voices', list: this.people.filter((p) => p && !p.bot && p.connected).map((p) => [p.id, p.voice || 'off', -1]) });
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/init') {
      if (this.code) return new Response('exists', { status: 409 });
      const b = await req.json();
      this.code = String(b.code || '').toUpperCase();
      this.seatsN = normSeats(b.seats);
      this.target = normTarget(b.target);
      this.level = normLevel(b.level);
      this.people = [null, null, null, null, null, null];
      this.phase = 'lobby';
      this.persist();
      await this.ctx.storage.setAlarm(Date.now() + EMPTY_TTL);
      return new Response('ok');
    }
    if (url.pathname === '/info') {
      if (!this.code) return Response.json({ exists: false }, { status: 404 });
      const players = this.people.slice(0, this.seatsN).filter((p) => p && !p.bot).length;
      return Response.json({ exists: true, code: this.code, players, seats: this.seatsN, target: this.target, level: this.level, phase: this.phase });
    }
    if (url.pathname === '/ws') {
      const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const fail = (msg) => { try { server.send(JSON.stringify({ t: 'error', msg })); server.close(4000, msg.slice(0, 60)); } catch (e) { /* já foi */ } return new Response(null, { status: 101, webSocket: client }); };
      if (!this.code) return fail('Sala não encontrada');
      const q = url.searchParams;
      const token = String(q.get('token') || '');
      const name = cleanName(q.get('name'));
      const skin = SKIN_IDS.includes(q.get('skin')) ? q.get('skin') : 'classico';
      let person = token ? this.people.find((p) => p && p.token && p.token === token) : null;
      if (person) {
        person.connected = true; person.goneAt = 0; person.auto = false; person.bot = false; person.name = name || person.name; person.skin = skin || person.skin;
      } else if (this.connectedHumans().length >= this.seatsN) {
        return fail('A mesa está cheia');
      } else {
        const taken = this.people.filter(Boolean).map((p) => p.name);
        person = { id: this.nextId++, token: randToken(), name: uniqueName(name, taken), skin, bot: false, auto: false, connected: true, voice: 'off', goneAt: 0, sayAt: [] };
        let seat = this.people.findIndex((p, i) => i < this.seatsN && !p);
        if (seat < 0) seat = this.people.findIndex((p, i) => i < this.seatsN && p && p.bot && !p.auto);
        if (seat < 0) return fail('A mesa está cheia');
        this.people[seat] = person;
        if (!this.hostId) this.hostId = person.id;
      }
      for (const old of this.ctx.getWebSockets()) {
        const a = old.deserializeAttachment();
        if (old !== server && a && a.id === person.id) { old.serializeAttachment(null); try { old.close(4001, 'Reconectado em outra aba'); } catch (e) { /* já fechado */ } }
      }
      server.serializeAttachment({ id: person.id, token: person.token, name: person.name, skin: person.skin });
      await this.ctx.storage.deleteAlarm();
      this.paused = this.people.some((p) => p && !p.bot && !p.auto && !p.connected);
      try { server.send(JSON.stringify({ t: 'welcome', id: person.id, token: person.token, hostId: this.hostId, code: this.code, chat: this.chat })); } catch (e) { /* fechando */ }
      this.sendStates();
      this.sendVoices();
      this.persist();
      this.plan();
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws, msg) {
    const a = ws.deserializeAttachment(); if (!a || typeof msg !== 'string' || msg.length > 8192) return;
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    const p = this.person(a.id); if (!p || p.bot) return;
    const seat = this.seatOf(p.id);
    if (m.t === 'sit') {
      const to = m.seat | 0;
      if (to < 0 || to >= this.seatsN || to === seat) return;
      if (this.phase === 'play') {
        this.claims = this.claims.filter((c) => c.id !== p.id);
        this.claims.push({ id: p.id, seat: to });
        this.postChat({ sys: 1, text: p.name + ' senta nessa cadeira na próxima mão' });
      } else if (!this.place(p, to)) this.send(p.id, { t: 'error', msg: 'Essa cadeira já tem gente' });
      this.sendStates(); this.persist(); return;
    }
    if (m.t === 'setup' && p.id === this.hostId && this.phase !== 'play') {
      const next = normSeats(m.seats);
      for (let i = next; i < 6; i++) if (this.people[i] && !this.people[i].bot) {
        this.send(p.id, { t: 'error', msg: 'Tem gente sentada nessa cadeira' }); return;
      }
      this.seatsN = next;
      for (let i = this.seatsN; i < 6; i++) if (this.people[i] && this.people[i].bot) this.people[i] = null;
      this.target = normTarget(m.target);
      this.level = normLevel(m.level);
      this.sendStates(); this.persist(); return;
    }
    if (m.t === 'fill' && p.id === this.hostId) { this.fill = m.on !== false; this.sendStates(); this.persist(); return; }
    if (m.t === 'start' && p.id === this.hostId && this.phase !== 'play') {
      const err = this.startMatch(); if (err) this.send(p.id, { t: 'error', msg: err }); return;
    }
    if (m.t === 'again' && p.id === this.hostId && this.phase === 'over') {
      const err = this.startMatch(); if (err) this.send(p.id, { t: 'error', msg: err }); return;
    }
    if (m.t === 'act') {
      const result = this.applyAct(seat, m.act || {}, null);
      if (!result.ok) this.send(p.id, { t: 'error', msg: result.error || 'Não deu' });
      return;
    }
    if (m.t === 'say') { this.onSay(p, m); return; }
    if (m.t === 'voice') {
      p.voice = m.scope === 'all' ? 'all' : 'off';
      this.sendVoices(); return;
    }
    if (m.t === 'sig') { this.onSig(p, m); return; }
    if (m.t === 'emote') {
      if (!EMOTES.includes(m.id)) return;
      this.broadcast({ t: 'emote', seat, id: m.id });
    }
  }

  async webSocketClose(ws) { this.drop(ws); }
  async webSocketError(ws) { this.drop(ws); }
  drop(ws) {
    const a = ws.deserializeAttachment(); if (!a) return;
    ws.serializeAttachment(null);
    try { ws.close(1000, 'bye'); } catch (e) { /* já fechado */ }
    const p = this.person(a.id); if (!p) return;
    p.connected = false; p.voice = 'off'; p.goneAt = Date.now();
    if (!this.connectedHumans().length) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.ctx.storage.setAlarm(Date.now() + EMPTY_TTL);
      this.persist();
      return;
    }
    if (p.id === this.hostId) { const n = this.connectedHumans()[0]; if (n) this.hostId = n.id; }
    this.paused = this.phase === 'play' && this.people.some((x) => x && !x.bot && !x.auto && !x.connected);
    this.sendStates(); this.sendVoices(); this.persist(); this.plan();
  }

  async alarm() {
    if (!this.connectedHumans().length && !this.sockets().length) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.match = null; this.people = [null, null, null, null, null, null]; this.code = '';
      await this.ctx.storage.deleteAll();
      return;
    }
    const now = Date.now();
    let changed = false;
    for (const p of this.people) {
      if (p && !p.bot && !p.auto && !p.connected && p.goneAt && now >= p.goneAt + TAKEOVER - 250) {
        p.auto = true; p.bot = true; changed = true;
      }
    }
    this.paused = this.phase === 'play' && this.people.some((p) => p && !p.bot && !p.auto && !p.connected);
    if (this.answerDue && now >= this.answerDue - 250) { this.answerDue = 0; this.forceTurn(); }
    if (changed) { this.sendStates(); this.persist(); }
    this.plan();
  }
}

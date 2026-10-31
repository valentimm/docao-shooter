// ============================================================
//  Contas do Docão Shooter (Cloudflare D1): cadastro, login, sessão, skin, ranking e estatísticas.
//  - Senha: PBKDF2-SHA256 (WebCrypto) com sal aleatório por conta. Nunca guarda texto puro.
//  - Sessão: token aleatório de 256 bits; no banco fica só o SHA-256 dele (vazou o banco, ninguém usa o token).
//  - Limite de tentativas no login/cadastro (tabela rate_limits). Erros genéricos, sem dizer o que falhou.
//  - Tudo é OPCIONAL: sem D1 configurado (env.DB) as rotas respondem 503 e o jogo segue como convidado.
// ============================================================
import { cleanNick, nickKey, nickError, passError } from '../../shared/nick.js';
import { START_COINS } from '../../shared/closet.js';
import { SKINS, skinOk } from '../../skins.js';
import { coinCreditStmt, chalUpdates, wallet, buyItem, equipSkin, equipKnife, equipSniper, equipGun, grantLoginBox, openBox, spinWheel } from './shop.js';

const ITERS = 100000; // teto do WebCrypto do Workers
const SESSION_TTL = 30 * 24 * 3600; // s
const MAX_SESSIONS = 8;
const LOGIN_WINDOW = 600, LOGIN_MAX_PAIR = 5, LOGIN_MAX_IP = 30; // 5 erros por (IP+apelido) e 30 por IP a cada 10 min
const REG_WINDOW = 3600;
export const RANK_MODES = ['all', 'dm', 'dom', 'bomb', 'inv'];
const STAT_MODES = ['dm', 'dom', 'bomb', 'inv'];
const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (u8) => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sha256hex = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

export async function pbkdf2(password, salt, iters = ITERS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iters }, key, 256));
}
export async function hashPassword(password, iters = ITERS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iters}$${b64(salt)}$${b64(await pbkdf2(password, salt, iters))}`;
}
const safeEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
export async function verifyPassword(password, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 4 || p[0] !== 'pbkdf2-sha256') return false;
  const iters = parseInt(p[1]); if (!(iters >= 1000 && iters <= ITERS)) return false;
  try { return safeEq(await pbkdf2(password, unb64(p[2]), iters), unb64(p[3])); } catch (e) { return false; }
}
let DUMMY = null; // hash falso: apelido inexistente gasta o mesmo tempo que um existente
const dummyHash = async () => DUMMY || (DUMMY = await hashPassword('docao-dummy-password'));

// ---------- limite de tentativas ----------
async function rlCount(env, key, windowSec) {
  const r = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?').bind(key).first();
  return r && now() - r.window_start < windowSec ? r.count : 0;
}
async function rlHit(env, key, windowSec) {
  const t = now();
  await env.DB.prepare('INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE count + 1 END, window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END')
    .bind(key, t, windowSec).run();
}
const rlClear = (env, key) => env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
async function housekeeping(env) { // de vez em quando limpa o que venceu
  if (Math.random() > 0.05) return; const t = now();
  await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t), env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(t - 7200)]);
}

// ---------- sessão ----------
export const tokenFrom = (req) => { const m = /^Bearer ([A-Za-z0-9_-]{20,64})$/.exec(req.headers.get('Authorization') || ''); return m ? m[1] : ''; };
async function newSession(env, accountId) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32))), t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256hex(token), accountId, t, t + SESSION_TTL),
    env.DB.prepare('DELETE FROM sessions WHERE account_id = ?1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE account_id = ?1 ORDER BY created_at DESC LIMIT ?2)').bind(accountId, MAX_SESSIONS),
    env.DB.prepare('UPDATE accounts SET last_login = ? WHERE id = ?').bind(t, accountId),
  ]);
  return token;
}
// token → { id, nick, skin } ou null (inexistente/vencido/inválido)
export async function accountFromToken(env, token) {
  if (!env.DB || typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return env.DB.prepare('SELECT a.id, a.nick, a.skin, a.knife, a.sniper, a.guns FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(await sha256hex(token), now()).first();
}
// apelido pertence a uma conta? (convidados não podem usar)
export async function nickRegistered(env, raw) {
  if (!env.DB) return false; const k = nickKey(cleanNick(raw)); if (!k) return false;
  try { return !!(await env.DB.prepare('SELECT 1 AS x FROM accounts WHERE nick_key = ?').bind(k).first()); } catch (e) { return false; }
}
export async function saveSkin(env, accountId, skin) { // skin da lista ou visual personalizado (partes têm que estar na mochila); só grava se mudou
  if (!env.DB) return false; return equipSkin(env, accountId, skin);
}
// items: [{ acct, mode, k, d, w, m }] — soma no ranking
export async function recordStats(env, items) {
  if (!env.DB || !items || !items.length) return;
  const c = (n) => Math.max(0, Math.min(5000, n | 0));
  const st = items.filter((i) => i && STAT_MODES.includes(i.mode) && i.acct > 0).map((i) => env.DB.prepare('INSERT INTO stats (account_id, mode, kills, deaths, wins, matches) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(account_id, mode) DO UPDATE SET kills = kills + ?3, deaths = deaths + ?4, wins = wins + ?5, matches = matches + ?6').bind(i.acct, i.mode, c(i.k), c(i.d), c(i.w), c(i.m)));
  const ok = items.filter((i) => i && i.acct > 0 && STAT_MODES.includes(i.mode));
  const ch = await chalUpdates(env, ok).catch((e) => { console.error('desafios', e && e.message); return new Map(); }); // só lê se a sala contou algo
  const coins = new Map(); for (const i of ok) if (i.c > 0) coins.set(i.acct, (coins.get(i.acct) || 0) + i.c);
  const cs = [...new Set([...coins.keys(), ...ch.keys()])].map((a) => coinCreditStmt(env, a, coins.get(a) || 0, ch.get(a) || null)).filter(Boolean);
  if (st.length || cs.length) await env.DB.batch([...st, ...cs]);
}

// ---------- HTTP ----------
const GENERIC = 'Apelido ou senha incorretos';
async function readJson(req) {
  const len = parseInt(req.headers.get('Content-Length') || '0'); if (len > 2048) return null;
  try { const t = await req.text(); if (t.length > 2048) return null; const o = JSON.parse(t); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; }
}
const publicAcc = (a) => ({ nick: a.nick, skin: a.skin && skinOk(a.skin) ? a.skin : null });
async function myStats(env, id) {
  const { results } = await env.DB.prepare('SELECT mode, kills, deaths, wins, matches FROM stats WHERE account_id = ?').bind(id).all();
  const out = { all: { kills: 0, deaths: 0, wins: 0, matches: 0 } };
  for (const r of results || []) { out[r.mode] = { kills: r.kills, deaths: r.deaths, wins: r.wins, matches: r.matches }; for (const k of ['kills', 'deaths', 'wins', 'matches']) out.all[k] += r[k]; }
  return out;
}

// devolve Response ou null (rota não é de conta). json(obj, status, extraHeaders)
export async function handleAccountRoute(req, env, url, json) {
  const p = url.pathname, m = req.method;
  if (!(p.startsWith('/api/auth/') || p === '/api/me' || p === '/api/me/skin' || p === '/api/me/knife' || p === '/api/me/sniper' || p === '/api/me/gun' || p === '/api/shop/buy' || p === '/api/lootbox/open' || p === '/api/lootbox/wheel' || p === '/api/rank')) return null;
  if (!env.DB) return json({ error: 'Contas indisponíveis no momento. Você pode jogar como convidado.' }, 503);
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  try {
    if (p === '/api/rank' && m === 'GET') {
      const mode = RANK_MODES.includes(url.searchParams.get('mode')) ? url.searchParams.get('mode') : 'all';
      const sort = url.searchParams.get('sort') === 'wins' ? 'wins' : 'kills';
      const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit')) || 20));
      const where = mode === 'all' ? '' : 'WHERE s.mode = ?1';
      const order = sort === 'wins' ? 'wins DESC, kills DESC' : 'kills DESC, wins DESC';
      const q = `SELECT a.nick AS nick, SUM(s.kills) AS kills, SUM(s.deaths) AS deaths, SUM(s.wins) AS wins, SUM(s.matches) AS matches FROM stats s JOIN accounts a ON a.id = s.account_id ${where} GROUP BY s.account_id HAVING SUM(s.kills) + SUM(s.deaths) + SUM(s.wins) > 0 ORDER BY ${order}, deaths ASC, a.nick LIMIT ${limit}`;
      // custo: o ranking soma a tabela inteira; guarda a resposta 60 s no cache da borda da Cloudflare (leitura do D1 no máx. 1x por minuto por filtro)
      const ck = new Request(`https://rank.cache/${mode}/${sort}/${limit}`); let hit = null;
      try { hit = await caches.default.match(ck); } catch (e) { /* sem cache (dev local) */ }
      if (hit) return hit;
      const { results } = await (mode === 'all' ? env.DB.prepare(q) : env.DB.prepare(q).bind(mode)).all();
      const resp = json({ mode, sort, rows: results || [] }, 200, { 'Cache-Control': 'public, max-age=60' });
      try { await caches.default.put(ck, resp.clone()); } catch (e) { /* ok */ }
      return resp;
    }
    if (p === '/api/auth/register' && m === 'POST') {
      const b = await readJson(req); if (!b) return json({ error: 'Pedido inválido' }, 400);
      const regMax = parseInt(env.RATE_REG_MAX) || 8;
      if (await rlCount(env, 'rg:' + ip, REG_WINDOW) >= regMax) return json({ error: 'Muitos cadastros por aqui. Tente de novo mais tarde.' }, 429);
      const nick = cleanNick(b.nick), e1 = nickError(nick) || passError(b.password);
      if (e1) return json({ error: e1 }, 400);
      const key = nickKey(nick);
      if (await env.DB.prepare('SELECT 1 AS x FROM accounts WHERE nick_key = ?').bind(key).first()) return json({ error: 'Esse apelido já tem dono' }, 409);
      await rlHit(env, 'rg:' + ip, REG_WINDOW);
      const hash = await hashPassword(b.password), t = now();
      let id;
      try { id = (await env.DB.prepare('INSERT INTO accounts (nick, nick_key, pass_hash, created_at, coins) VALUES (?, ?, ?, ?, ?)').bind(nick, key, hash, t, START_COINS).run()).meta.last_row_id; }
      catch (e) { return json({ error: 'Esse apelido já tem dono' }, 409); } // corrida: UNIQUE barrou
      const token = await newSession(env, id);
      await housekeeping(env);
      return json({ token, account: { nick, skin: null, coins: START_COINS } }, 201);
    }
    if (p === '/api/auth/login' && m === 'POST') {
      const b = await readJson(req); if (!b || typeof b.nick !== 'string' || typeof b.password !== 'string' || b.password.length > 128 || b.nick.length > 64) return json({ error: GENERIC }, 401);
      const key = nickKey(b.nick), kPair = `lf:${ip}:${key}`, kIp = 'lf:ip:' + ip;
      if (await rlCount(env, kPair, LOGIN_WINDOW) >= LOGIN_MAX_PAIR || await rlCount(env, kIp, LOGIN_WINDOW) >= LOGIN_MAX_IP) return json({ error: 'Muitas tentativas. Espere uns minutos e tente de novo.' }, 429);
      const acc = key ? await env.DB.prepare('SELECT id, nick, skin, pass_hash FROM accounts WHERE nick_key = ?').bind(key).first() : null;
      const ok = await verifyPassword(b.password, acc ? acc.pass_hash : await dummyHash());
      if (!acc || !ok) { await rlHit(env, kPair, LOGIN_WINDOW); await rlHit(env, kIp, LOGIN_WINDOW); return json({ error: GENERIC }, 401); }
      await rlClear(env, kPair);
      const token = await newSession(env, acc.id); await housekeeping(env);
      return json({ token, account: publicAcc(acc) });
    }
    const tok = tokenFrom(req);
    if (p === '/api/auth/logout' && m === 'POST') {
      if (tok) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256hex(tok)).run();
      return json({ ok: true });
    }
    if (p === '/api/me' && m === 'GET') {
      const a = await accountFromToken(env, tok); if (!a) return json({ error: 'Sessão inválida' }, 401);
      const boxGrant = await grantLoginBox(env, a.id);
      const w = await wallet(env, a.id);
      return json({ account: { ...publicAcc(a), custom: w.custom, coins: w.coins, knife: w.knife, sniper: w.sniper, guns: w.guns, boxes: w.boxes }, stats: await myStats(env, a.id), items: w.items, earn: { today: w.earnToday, cap: w.dayCap }, chal: w.chal, boxGrant });
    }
    if (p === '/api/me/skin' && m === 'PUT') {
      const a = await accountFromToken(env, tok); if (!a) return json({ error: 'Sessão inválida' }, 401);
      const b = await readJson(req); if (!b || typeof b.skin !== 'string' || !(await saveSkin(env, a.id, b.skin))) return json({ error: 'Skin inválida ou com partes que você ainda não comprou' }, 400);
      return json({ ok: true, skin: b.skin });
    }
    if (p === '/api/me/knife' && m === 'PUT') {
      const a = await accountFromToken(env, tok); if (!a) return json({ error: 'Sessão inválida' }, 401);
      const b = await readJson(req); if (!b || typeof b.knife !== 'string' || !(await equipKnife(env, a.id, b.knife))) return json({ error: 'Essa faca não está na sua mochila' }, 400);
      return json({ ok: true, knife: b.knife || null });
    }
    if (p === '/api/me/sniper' && m === 'PUT') {
      const a = await accountFromToken(env, tok); if (!a) return json({ error: 'Sessão inválida' }, 401);
      const b = await readJson(req); if (!b || typeof b.sniper !== 'string' || !(await equipSniper(env, a.id, b.sniper))) return json({ error: 'Essa skin não está na sua mochila' }, 400);
      return json({ ok: true, sniper: b.sniper || null });
    }
    if (p === '/api/me/gun' && m === 'PUT') {
      const a = await accountFromToken(env, tok); if (!a) return json({ error: 'Sessão inválida' }, 401);
      const b = await readJson(req); if (!b || typeof b.key !== 'string' || typeof b.item !== 'string') return json({ error: 'Pedido inválido' }, 400);
      const guns = await equipGun(env, a.id, b.key, b.item);
      if (!guns) return json({ error: 'Essa skin não está na sua mochila' }, 400);
      return json({ ok: true, guns });
    }
    if (p === '/api/lootbox/open' && m === 'POST') {
      const a = await accountFromToken(env, tok); if (!a) return json({ error: 'Sessão inválida' }, 401);
      const r = await openBox(env, a.id);
      return r.status === 200 ? json({ ok: true, dupe: r.dupe, item: r.item, coins: r.coins, gain: r.gain, boxes: r.boxes }) : json({ error: r.error }, r.status);
    }
    if (p === '/api/lootbox/wheel' && m === 'POST') {
      const a = await accountFromToken(env, tok); if (!a) return json({ error: 'Sessão inválida' }, 401);
      const b = await readJson(req); if (!b || !Array.isArray(b.items)) return json({ error: 'Pedido inválido' }, 400);
      const r = await spinWheel(env, a.id, b.items);
      return r.status === 200 ? json({ ok: true, dupe: r.dupe, item: r.item, coins: r.coins, gain: r.gain, spent: r.spent, knife: r.knife, sniper: r.sniper, guns: r.guns }) : json({ error: r.error }, r.status);
    }
    if (p === '/api/shop/buy' && m === 'POST') {
      const a = await accountFromToken(env, tok); if (!a) return json({ error: 'Sessão inválida' }, 401);
      const b = await readJson(req); if (!b) return json({ error: 'Pedido inválido' }, 400);
      const r = await buyItem(env, a.id, b.item); // saldo e preço são do servidor; o cliente só diz QUAL item
      return r.status === 200 ? json({ ok: true, item: r.item, coins: r.coins }) : json({ error: r.error }, r.status);
    }
    return json({ error: 'Não encontrado' }, 404);
  } catch (e) {
    console.error('conta', e && e.message);
    return json({ error: 'Algo deu errado. Tente de novo.' }, 500);
  }
}

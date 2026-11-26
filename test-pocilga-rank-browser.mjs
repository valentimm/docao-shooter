// Menu, Tab e aviso de deslogado da Pocilga, contra o mesmo handler do Worker.
// Uso: node test-pocilga-rank-browser.mjs
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { scriptRun, PIT } from './shared/pocilga.js';
import { BONUS, aimAt } from './shared/pocilga-bonus.js';
import { handleAccountRoute } from './server/src/auth.js';

const ROOT = new URL('.', import.meta.url).pathname;
const API_PORT = 8787;
const SITE_PORT = 8140;
const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
const SITE = `http://127.0.0.1:${SITE_PORT}/index.html?server=${encodeURIComponent(`ws://127.0.0.1:${API_PORT}`)}&devSkins=0`;
const fails = [], missing = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

function memory() {
  const db = new DatabaseSync(':memory:');
  const migs = readdirSync(new URL('./server/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of migs) db.exec(read('./server/migrations/' + f));
  const bound = (sql, args) => {
    if (!args.length) return [];
    if (/\?\d/.test(sql)) { const o = {}; args.forEach((v, i) => { o[i + 1] = v; }); return [o]; }
    return args;
  };
  const wrap = (sql, args = []) => ({ sql, args, bind(...a) { return wrap(sql, a); },
    async all() { return { results: db.prepare(sql).all(...bound(sql, args)) }; },
    async first() { return db.prepare(sql).get(...bound(sql, args)) || null; },
    async run() { const r = db.prepare(sql).run(...bound(sql, args)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
  const env = { DB: { prepare: (sql) => wrap(sql), async batch(list) {
    db.exec('BEGIN');
    try {
      const out = [];
      for (const s of list) {
        const st = db.prepare(s.sql);
        const args = bound(s.sql, s.args || []);
        if (/^\s*SELECT/i.test(s.sql)) out.push({ results: st.all(...args) });
        else { const r = st.run(...args); out.push({ meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }); }
      }
      db.exec('COMMIT');
      return out;
    } catch (e) { try { db.exec('ROLLBACK'); } catch { /* já fechada */ } throw e; }
  } } };
  return { db, env };
}

const { env } = memory();
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors, ...extra } });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

const api = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  const url = new URL(req.url, `http://127.0.0.1:${API_PORT}`);
  if (url.pathname === '/health') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true })); return; }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const request = new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
  let response;
  try { response = await handleAccountRoute(request, env, url, json); }
  catch (e) { response = json({ error: e.message }, 500); }
  if (!response) response = json({ error: 'não achei' }, 404);
  const buf = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, { ...cors, 'Content-Type': response.headers.get('Content-Type') || 'application/json' });
  res.end(buf);
});
const site = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${SITE_PORT}`);
  const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    const data = readFileSync(path.endsWith('/') ? path + 'index.html' : path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) { if (url.pathname !== '/favicon.ico') missing.push(url.pathname); res.writeHead(404); res.end(); }
});

await new Promise((r) => api.listen(API_PORT, '127.0.0.1', r));
await new Promise((r) => site.listen(SITE_PORT, '127.0.0.1', r));

async function account(nick) {
  const password = 'pocilga-teste';
  const post = (path, body, token) => fetch(`http://127.0.0.1:${API_PORT}` + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body),
  });
  let data = await (await post('/api/auth/register', { nick, password })).json();
  if (!data.token) data = await (await post('/api/auth/login', { nick, password })).json();
  return data.token || null;
}
const seeded = [];
for (const [nick, finish] of [['AnaPocilga', 48], ['BetoPocilga', 58], ['CaioPocilga', 80]]) {
  const token = await account(nick);
  const r = await fetch(`http://127.0.0.1:${API_PORT}/api/pocilga/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ events: scriptRun({ finish }) }),
  });
  const body = await r.json();
  seeded.push({ nick, status: r.status, ranked: !!(body.run && body.run.ranked), final: body.run && body.run.final });
}
ok(seeded.every((s) => s.status === 200 && s.ranked), 'três contas gravadas no ranking (' + seeded.map((s) => `${s.nick} ${s.status} ${s.final}`).join(', ') + ')');
{
  const token = await account('LiaPocilga');
  const events = scriptRun({ finish: 40 });
  const at = events.findIndex((e) => e.k === 'start');
  events.splice(at + 1, 0, { k: 'bonus', t: 0.05, w: PIT.pistol, ...aimAt(0, 4.2, 36, BONUS.x, BONUS.y) });
  const r = await fetch(`http://127.0.0.1:${API_PORT}/api/pocilga/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ events }),
  });
  const body = await r.json();
  ok(r.status === 200 && body.run && body.run.ranked && body.run.raw === 40 && body.run.final === 38 && body.run.bonus === -2, `Lia logada, miolo, ranking em 38 s (${body.run && body.run.final})`);
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(SITE, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#rankBtn', { timeout: 20000 });
await page.click('#acctBtn');
await page.fill('#acctNick', 'BetoPocilga');
await page.fill('#acctPass', 'pocilga-teste');
await page.click('#acctSubmit');
await page.waitForFunction(() => document.getElementById('acctBtn').textContent.includes('MINHA'), null, { timeout: 10000 });
await page.click('#rankBtn');
await page.waitForSelector('#rankModal:not(.hidden) #rankModes button[data-mode=pocilga]');
await page.click('#rankModes button[data-mode=pocilga]');
await page.waitForFunction(() => {
  const body = document.getElementById('rankBody');
  const me = body && body.querySelector('tr.me');
  return me && /BetoPocilga/.test(me.textContent) && /0:48,000/.test(body.textContent) && /0:58,000/.test(body.textContent) && /1:20,000/.test(body.textContent) && /★★★/.test(body.textContent);
}, null, { timeout: 10000 });
const menu = await page.evaluate(() => {
  const body = document.getElementById('rankBody');
  const sort = document.querySelector('#rankModal .rank-sort');
  const active = document.querySelector('#rankModes button.active');
  return {
    active: active && active.textContent,
    sortHidden: !!(sort && sort.classList.contains('hidden')),
    text: body.innerText,
    me: body.querySelector('tr.me') && body.querySelector('tr.me').innerText,
    rows: body.querySelectorAll('tbody tr').length,
  };
});
ok(menu.active === 'Pistoleiro da Pocilga' && menu.sortHidden && menu.rows === 4 && /BetoPocilga/.test(menu.me) && /0:38,000/.test(menu.text) && /LiaPocilga/.test(menu.text), `menu com a Lia em 0:38,000 e o Beto destacado (${menu.me && menu.me.replace(/\s+/g, ' ')})`);
await page.screenshot({ path: `${SHOTS}/pocilga_menu_circuito.png` });

await page.click('#rankClose');
await page.selectOption('#modeSel', 'pocilga');
await page.click('#playBtn');
await page.waitForFunction(() => window.__docao && window.__docao.state === 'playing' && window.__docao.pit && window.__docao.pit.on, null, { timeout: 20000 });
await page.evaluate(() => {
  const p = window.__docao.player;
  p.pos.set(14.2, 0, -9.4); p.vel.set(0, 0, 0);
});
await page.waitForFunction(() => window.__docao.pit.started, null, { timeout: 5000 });
await page.waitForFunction(() => !document.getElementById('centermsg').textContent, null, { timeout: 5000 });
const before = await page.evaluate(() => {
  const p = window.__docao.player;
  return { clock: window.__docao.pit.clock, x: p.pos.x, z: p.pos.z, state: window.__docao.state };
});
await page.keyboard.down('Tab');
await page.waitForFunction(() => {
  const el = document.getElementById('tabboard');
  return el && !el.classList.contains('hidden') && /Pistoleiro da Pocilga/.test(el.textContent) && /BetoPocilga/.test(el.textContent) && /0:58,000/.test(el.textContent) && /0:38,000/.test(el.textContent) && /LiaPocilga/.test(el.textContent);
}, null, { timeout: 8000 });
await page.waitForTimeout(700);
const held = await page.evaluate(() => {
  const p = window.__docao.player;
  const el = document.getElementById('tabboard');
  return {
    clock: window.__docao.pit.clock, x: p.pos.x, z: p.pos.z, state: window.__docao.state,
    pause: document.getElementById('pause').classList.contains('hidden'),
    open: el && !el.classList.contains('hidden'),
    me: !!(el && el.querySelector('tr.me')),
    warn: !!(el && /Entre na conta para entrar no ranking/.test(el.textContent)),
  };
});
ok(held.open && held.me && !held.warn && held.state === 'playing' && held.pause && held.clock >= before.clock + 0.3 && Math.hypot(held.x - before.x, held.z - before.z) < 0.08, `Tab aberto, relógio andou (${before.clock.toFixed(2)} → ${held.clock.toFixed(2)}) e o corpo ficou (${Math.hypot(held.x - before.x, held.z - before.z).toFixed(3)} m)`);
await page.screenshot({ path: `${SHOTS}/pocilga_tab_aberto.png` });
await page.screenshot({ path: `${SHOTS}/pocilga-tab-menos-2.png` });
await page.keyboard.up('Tab');
await page.waitForFunction(() => document.getElementById('tabboard').classList.contains('hidden'));
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({
  clock: window.__docao.pit.clock,
  hidden: document.getElementById('tabboard').classList.contains('hidden'),
  state: window.__docao.state,
}));
ok(after.hidden && after.state === 'playing' && after.clock > held.clock, `soltar o Tab fecha o painel e o relógio segue (${held.clock.toFixed(2)} → ${after.clock.toFixed(2)})`);

const guest = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const posts = [];
guest.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/pocilga/run')) posts.push(r.url()); });
await guest.goto(SITE, { waitUntil: 'load', timeout: 60000 });
await guest.waitForSelector('#modeSel');
await guest.selectOption('#modeSel', 'pocilga');
await guest.click('#playBtn');
await guest.waitForFunction(() => window.__docao && window.__docao.pit && window.__docao.pit.on, null, { timeout: 20000 });
await guest.waitForTimeout(1800);
const sent = await guest.evaluate(async () => {
  const m = await import('./account.js');
  const orig = window.fetch;
  let called = false;
  window.fetch = (...a) => { if (String(a[0]).includes('/api/pocilga/run')) called = true; return orig(...a); };
  const res = await m.submitPit([{ k: 'start', t: 0 }]);
  window.fetch = orig;
  return { called, guest: !!res.guest, ok: !!res.ok };
});
ok(sent.guest && !sent.ok && !sent.called && posts.length === 0, 'deslogado não manda a corrida');
await guest.keyboard.down('Tab');
await guest.waitForFunction(() => {
  const el = document.getElementById('tabboard');
  return el && !el.classList.contains('hidden') && el.textContent.includes('Entre na conta para entrar no ranking') && /AnaPocilga/.test(el.textContent);
}, null, { timeout: 8000 });
const guestTab = await guest.evaluate(() => {
  const el = document.getElementById('tabboard');
  return { warn: el.textContent.includes('Entre na conta para entrar no ranking'), me: !!el.querySelector('tr.me'), text: el.innerText };
});
ok(guestTab.warn && !guestTab.me, 'Tab de quem não entrou mostra o aviso e não se destaca');
await guest.screenshot({ path: `${SHOTS}/pocilga_aviso_conta.png` });
await guest.keyboard.up('Tab');

ok(!missing.length, 'o site não deixa arquivo de fora' + (missing.length ? ': ' + missing.slice(0, 4).join(', ') : ''));
const noisy = errors.filter((e) => !/WebGL|gpu|GPU|context lost/i.test(e));
ok(!noisy.length, 'sem erro de página' + (noisy.length ? ': ' + noisy.slice(0, 3).join(' | ') : ''));
await browser.close();
await new Promise((r) => api.close(r));
await new Promise((r) => site.close(r));
console.log(fails.length ? `FALHOU ${fails.length}` : 'TUDO OK');
process.exit(fails.length ? 1 : 0);

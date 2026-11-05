// Diagnóstico do freeze em place/down. Não é a bateria completa.
// Cada etapa tem relógio que fecha SÓ este browser e grava console, frames e RSS.
// node tools/test-down-diag.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

const SITE = process.argv[2] || 'http://127.0.0.1:8170/';
const SERVER = process.argv[3] || 'ws://127.0.0.1:8787';
const OUT = '/tmp/down-diag.json';
const UZI = 9;
const logs = [];
const steps = [];
let browser;
let ended = false;

const stamp = () => new Date().toISOString().slice(11, 23);
function note(line) { const row = stamp() + ' ' + line; logs.push(row); console.log(row); }
function walk(pid, acc) {
  let rss = 0;
  try { const s = readFileSync('/proc/' + pid + '/status', 'utf8'); const m = s.match(/VmRSS:\s+(\d+)/); rss = m ? +m[1] : 0; } catch { return; }
  acc.push({ pid, rss });
  let kids = '';
  try { kids = readFileSync('/proc/' + pid + '/task/' + pid + '/children', 'utf8'); } catch { kids = ''; }
  for (const k of kids.trim().split(/\s+/).filter(Boolean)) walk(+k, acc);
}
function mem() {
  if (!browser) return { rss: 0, top: [] };
  const root = browser.process && browser.process() && browser.process().pid;
  if (!root) return { rss: 0, top: [] };
  const acc = [];
  walk(root, acc);
  acc.sort((a, b) => b.rss - a.rss);
  return { rss: acc.reduce((s, x) => s + x.rss, 0), top: acc.slice(0, 4) };
}
function lastFrame() {
  const rows = logs.filter((l) => l.includes(' FRAME '));
  return rows.slice(-4);
}

async function finish(why, extra = {}) {
  if (ended) return;
  ended = true;
  const report = { why, steps, mem: mem(), lastFrame: lastFrame(), tail: logs.slice(-40), ...extra };
  try { writeFileSync(OUT, JSON.stringify(report, null, 2)); } catch { /* */ }
  note('relatório ' + OUT + ' ' + why);
  try { if (browser) await browser.close(); } catch { /* */ }
  process.exit(why === 'ok' ? 0 : 2);
}

async function step(name, ms, fn) {
  const t0 = Date.now();
  let timer;
  const cap = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('STEP_TIMEOUT')), ms); });
  try {
    const value = await Promise.race([Promise.resolve().then(fn), cap]);
    clearTimeout(timer);
    const row = { name, ok: true, ms: Date.now() - t0, mem: mem().rss };
    steps.push(row);
    note('OK ' + name + ' ' + row.ms + 'ms rss=' + row.mem);
    return value;
  } catch (e) {
    clearTimeout(timer);
    const row = { name, ok: false, ms: Date.now() - t0, err: e.message, mem: mem() };
    steps.push(row);
    note('FALHA ' + name + ' ' + row.ms + 'ms ' + e.message + ' rss=' + row.mem.rss);
    await finish('timeout:' + name, { err: e.message });
  }
}

const browserP = chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'] });
browser = await browserP;
browser.on('disconnected', () => { if (!ended) { ended = true; try { writeFileSync(OUT, JSON.stringify({ why: 'browser-disconnected', steps, tail: logs.slice(-40), mem: {} }, null, 2)); } catch { /* */ } note('browser morreu'); process.exit(3); } });
process.on('SIGTERM', () => finish('sigterm'));

async function client(name) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', (e) => note('PAGE ' + name + ' ' + String(e.message).slice(0, 300)));
  page.on('console', (m) => {
    const t = m.text();
    if (t.startsWith('FRAME ') || m.type() === 'error') note(name + ' ' + m.type() + ' ' + t.slice(0, 180));
  });
  page.on('crash', () => note('CRASH ' + name));
  await page.addInitScript(() => {
    window.__frames = 0;
    const loop = () => { window.__frames++; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => { console.log('FRAME ' + window.__frames); }, 500);
  });
  await page.goto(SITE + '?server=' + encodeURIComponent(SERVER), { waitUntil: 'domcontentloaded' });
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);

const A = await client('Ana');
const B = await client('Beto');
await step('menu-ana', 20000, async () => {
  await A.click('#onlineBtn');
  await A.selectOption('#roomMode', 'inv');
  await A.selectOption('#roomSurv', 'survival');
  if (await A.$('#roomBots')) await A.selectOption('#roomBots', '0');
  await A.click('#createBtn');
  await A.waitForFunction(() => window.__docao.online && window.__docao.online.myId > 0);
});
const code = await A.evaluate(() => window.__docao.online.code);
note('sala ' + code);
await step('boto-entra', 25000, async () => {
  await B.goto(SITE + '?server=' + encodeURIComponent(SERVER) + '&sala=' + code, { waitUntil: 'domcontentloaded' });
  await B.waitForFunction(() => window.__docao.online && window.__docao.online.myId > 0);
});
await step('comeca', 20000, async () => {
  await A.click('#startOnline');
  await A.waitForFunction(() => window.__docao.state === 'playing' && window.__docao.player);
  await B.waitForFunction(() => window.__docao.state === 'playing' && window.__docao.player);
});
await step('alivia-gpu', 8000, async () => {
  for (const p of [A, B]) await p.evaluate(() => { const r = window.__docao.renderer; if (r) { r.setPixelRatio(1); r.shadowMap.enabled = false; } });
});
await step('ping-antes', 8000, async () => {
  const t0 = Date.now();
  const n = await A.evaluate(() => window.__frames | 0);
  note('ping A frames=' + n + ' em ' + (Date.now() - t0) + 'ms');
});
await step('arma', 12000, async () => {
  await A.evaluate((w) => window.__docao.online.net.send({ t: 'testInv', hold: true, killAll: true, clearQueue: true, fog: { cx: 0, cz: 0, r: 400, tx: 0, tz: 0, tr: 400 }, gun: w, mag: 4, res: 9, tier: 2 }), UZI);
  await A.waitForFunction(() => window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4);
});
await step('coracao', 15000, async () => {
  await A.waitForFunction(() => window.__docao.time > window.__docao.player.invulnUntil);
  await A.evaluate(() => window.__docao.online.net.send({ t: 'testInv', hurt: 500 }));
  await A.waitForFunction(() => window.__docao.player && !window.__docao.player.alive && !window.__docao.player.down);
  await A.evaluate(() => window.__docao.online.net.send({ t: 'testInv', rs: true }));
  await A.waitForFunction(() => window.__docao.player.alive && window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4);
});
await step('ping-depois-respawn', 8000, async () => {
  const t0 = Date.now();
  const s = await A.evaluate(() => ({ f: window.__frames | 0, w: window.__docao.player.weapon, alive: window.__docao.player.alive, down: !!window.__docao.player.down }));
  note('estado pós-respawn ' + JSON.stringify(s) + ' em ' + (Date.now() - t0) + 'ms');
});
await step('place-send-A', 8000, async () => {
  const t0 = Date.now();
  await A.evaluate(() => window.__docao.online.net.send({ t: 'testInv', pos: [0, 0, 20] }));
  note('send pos A voltou em ' + (Date.now() - t0) + 'ms');
});
await step('place-ve-A', 8000, async () => {
  await A.waitForFunction(() => Math.hypot(window.__docao.player.pos.x, window.__docao.player.pos.z - 20) < 1.5);
  const p = await A.evaluate(() => [window.__docao.player.pos.x, window.__docao.player.pos.y, window.__docao.player.pos.z, window.__frames | 0]);
  note('pos A ' + JSON.stringify(p));
});
await step('place-send-B', 8000, async () => {
  await B.evaluate(() => window.__docao.online.net.send({ t: 'testInv', pos: [0.9, 0, 20] }));
});
await step('place-ve-B', 8000, async () => {
  await B.waitForFunction(() => Math.hypot(window.__docao.player.pos.x - 0.9, window.__docao.player.pos.z - 20) < 1.5);
});
await step('hurt-down', 12000, async () => {
  await A.evaluate(() => window.__docao.online.net.send({ t: 'testInv', hurt: 500 }));
  await A.waitForFunction(() => window.__docao.player.down === true && window.__docao.player.alive && window.__docao.player.weapon === 4 && window.__docao.player.mag[9] === 4);
});
await step('frames-no-down', 6000, async () => {
  const a = await A.evaluate(() => window.__frames | 0);
  await new Promise((r) => setTimeout(r, 1500));
  const b = await A.evaluate(() => window.__frames | 0);
  const dt = b - a;
  note('frames durante down +' + dt + ' em 1,5s');
  if (dt < 5) throw new Error('laço do jogo parado no down (frames +' + dt + ')');
});
await step('beto-ve-down', 10000, async () => {
  await B.waitForFunction(() => window.__docao.entities.some((e) => e !== window.__docao.player && !e.zt && e.down));
});
mkdirSync('/opt/cursor/artifacts', { recursive: true });
await step('print-ana', 15000, async () => {
  await A.screenshot({ path: '/opt/cursor/artifacts/down-diag-ana.png', animations: 'disabled', timeout: 12000 });
});
await step('print-beto', 15000, async () => {
  await B.evaluate(() => {
    const mate = window.__docao.entities.find((e) => e !== window.__docao.player && !e.zt && e.down);
    if (!mate) return;
    const p = mate.pos;
    window.__cam = { p: [p.x + 2.4, (p.y || 0) + 1.3, p.z + 1.6], t: [p.x, (p.y || 0) + 0.4, p.z], fov: 48 };
  });
  await B.screenshot({ path: '/opt/cursor/artifacts/down-diag-beto.png', animations: 'disabled', timeout: 12000 });
  await B.evaluate(() => { window.__cam = null; });
});
note('diagnóstico passou o place e o down');
await finish('ok');

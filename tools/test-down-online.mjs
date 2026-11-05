// Survival online: 2 clientes de verdade (host e convidado). Down, revive, loadout.
// node tools/test-down-online.mjs [site] [ws]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SITE = process.argv[2] || 'http://127.0.0.1:8170/';
const SERVER = process.argv[3] || 'ws://127.0.0.1:8787';
const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });
const fails = [];
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) fails.push(msg); };
const UZI = 9;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const G = (page, fn, arg) => page.evaluate(fn, arg);
async function until(page, fn, ms = 8000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await wait(80); }
  return false;
}
const T = (page, m) => G(page, (mm) => window.__docao.online.net.send({ t: 'testInv', ...mm }), m);
const NOFOG = { cx: 0, cz: 0, r: 400, tx: 0, tz: 0, tr: 400, fx: 0, fz: 0, fr: 400 };

async function client(name, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', (e) => { console.log('PAGE', name, e.message); fails.push(`[${name}] ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CON', name, m.text().slice(0, 240)); });
  await page.addInitScript((n) => { localStorage.setItem('docao.name', n); localStorage.setItem('docao.mode', 'dm'); }, name);
  await page.goto(`${SITE}?server=${encodeURIComponent(SERVER)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__docao, null, { timeout: 20000 });
  return page;
}
async function shot(page, name) {
  const path = `${SHOTS}/${name}.png`;
  await page.screenshot({ path, animations: 'disabled', timeout: 20000 });
  console.log('shot', path);
  return path;
}
function guns(page) {
  return G(page, () => {
    const p = window.__docao.player;
    return { w: p.weapon, mag: p.mag[9], res: p.reserve[9], pap: p.pap && p.pap[9], down: !!p.down, alive: p.alive, lives: (() => { const v = window.__docao.invView; const s = v && v.lives.get(window.__docao.online.myId); return s && s.lives; })(), title: document.getElementById('wtitle') && document.getElementById('wtitle').textContent, hud: document.getElementById('downHud') && !document.getElementById('downHud').classList.contains('hidden') ? document.getElementById('downTitle').textContent : '', fill: document.getElementById('downFill') ? document.getElementById('downFill').style.width : '' };
  });
}

const A = await client('Ana', 1280, 800);
const B = await client('Beto', 1280, 800);
await A.click('#onlineBtn');
await A.selectOption('#roomMode', 'inv');
await A.selectOption('#roomSurv', 'survival');
if (await A.$('#roomBots')) await A.selectOption('#roomBots', '0');
await A.click('#createBtn');
ok(await until(A, () => window.__docao.online && window.__docao.online.myId > 0), 'Ana (host) criou a sala');
const code = await G(A, () => window.__docao.online.code);
await B.goto(`${SITE}?server=${encodeURIComponent(SERVER)}&sala=${code}`, { waitUntil: 'domcontentloaded' });
await B.waitForFunction(() => window.__docao && window.__docao.online, null, { timeout: 20000 });
ok(await until(B, () => window.__docao.online && window.__docao.online.myId > 0), 'Beto (cliente) entrou na sala');
await A.click('#startOnline');
for (const [p, n] of [[A, 'Ana'], [B, 'Beto']]) ok(await until(p, () => window.__docao.state === 'playing' && window.__docao.player, 15000), `${n} em jogo`);
for (const p of [A, B]) await G(p, () => { const r = window.__docao.renderer; if (r) { r.setPixelRatio(1); r.shadowMap.enabled = false; } });
await T(A, { hold: true, fog: NOFOG, killAll: true, clearQueue: true });
ok(await until(A, () => { const v = window.__docao.invView; return v && [...v.lives.values()].length === 2 && [...v.lives.values()].every((s) => s.lives === 2); }), 'host e cliente começam com 2 corações');
ok(await G(B, () => { const v = window.__docao.invView; return v && [...v.lives.values()].every((s) => s.lives === 2); }), 'o cliente também vê os 2 corações de cada um');

async function placePair() {
  console.log('place');
  await T(A, { pos: [0, 0, 20] });
  await T(B, { pos: [0.9, 0, 20] });
  await until(A, () => Math.hypot(window.__docao.player.pos.x - 0, window.__docao.player.pos.z - 20) < 1.2, 4000);
  await until(B, () => Math.hypot(window.__docao.player.pos.x - 0.9, window.__docao.player.pos.z - 20) < 1.2, 4000);
  console.log('placed');
}
async function give(page) {
  await T(page, { gun: UZI, mag: 4, res: 9, tier: 2 });
  return until(page, () => window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4 && window.__docao.player.pap[9] === 2, 4000);
}
async function heartDeath(page, name) {
  await until(page, () => window.__docao.time > window.__docao.player.invulnUntil, 6000);
  await T(page, { hurt: 500 });
  ok(await until(page, () => !window.__docao.player.alive && !window.__docao.player.down, 4000), `${name}: primeiro coração gasta a vida e abre a morte, sem down`);
  const ui = await G(page, () => ({ lives: window.__docao.invView.lives.get(window.__docao.online.myId).lives, death: !document.getElementById('deathpick').classList.contains('hidden') || !!document.getElementById('respawnBtn') }));
  ok(ui.lives === 1, `${name}: ficou 1 coração (${ui.lives})`);
  await T(page, { rs: true });
  ok(await until(page, () => window.__docao.player.alive && window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4, 5000), `${name}: renasceu com a MP5K e 4 balas`);
}
async function goDown(page, name) {
  console.log('godown', name);
  await placePair();
  await until(page, () => window.__docao.time > window.__docao.player.invulnUntil, 6000);
  console.log('hurt', name);
  await T(page, { hurt: 500 });
  return until(page, () => window.__docao.player.down && window.__docao.player.alive && window.__docao.player.weapon === 4 && window.__docao.player.mag[9] === 4, 4000);
}

ok(await give(A), 'Ana equipa MP5K 4/9 tier 2');
await heartDeath(A, 'Ana');
ok(await goDown(A, 'Ana'), 'Ana: corações esgotados, down, pistolinha na mão, MP5K 4/9 guardada');
await shot(A, 'down-1280-caido');
let betoSees = false;
try { betoSees = await until(B, () => window.__docao.entities.some((e) => e !== window.__docao.player && !e.zt && e.down), 8000); }
catch (e) { console.log('Beto caiu no evaluate', e.message); }
ok(betoSees, 'Beto vê a Ana caída na rede');
const livesB = await G(B, () => window.__docao.invView.lives.get(window.__docao.online.myId).lives);
ok(livesB === 2, `Beto continua com 2 corações (${livesB})`);

await B.evaluate(() => {
  const g = window.__docao;
  const mate = g.entities.find((e) => e !== g.player && !e.zt && e.down);
  if (!mate) return;
  const p = mate.pos;
  window.__cam = { p: [p.x + 2.6, p.y + 1.35, p.z + 1.8], t: [p.x, p.y + 0.45, p.z], fov: 46 };
});
await shot(B, 'down-1280-pose');

await B.evaluate(() => { window.__cam = null; });
await B.click('canvas');
await B.keyboard.down('l');
await wait(1100);
const mid = await guns(B);
ok(mid.hud.includes('Levantar') && parseFloat(mid.fill) > 15, `Beto vê o prompt e a barra (${mid.hud} ${mid.fill})`);
await shot(B, 'down-1280-progresso');
await shot(A, 'down-1280-progresso-caido');
await B.keyboard.up('l');
await wait(400);
const dropped = await guns(B);
ok(parseFloat(dropped.fill) === 0 || !dropped.hud, `soltar L zera a barra (${dropped.fill})`);

await B.keyboard.down('l');
ok(await until(A, () => !window.__docao.player.down && window.__docao.player.alive && window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4, 6000), 'revive replicado: Ana de pé com a MP5K e 4 balas');
await B.keyboard.up('l');
const back = await guns(A);
ok(back.pap === 2 && back.res === 9 && back.title.includes('MP5K'), `armas restauradas na HUD (${back.title}, tier ${back.pap}, reserva ${back.res})`);
await shot(A, 'down-1280-armas');

// parede: sem linha de visão o progresso não sobe
const pair = await G(A, () => {
  const g = window.__docao;
  const solids = g.solids.filter((s) => (s.max.y - s.min.y) > 1.6 && Math.min(s.max.x - s.min.x, s.max.z - s.min.z) < 0.9);
  for (const s of solids) {
    const thinX = (s.max.x - s.min.x) < (s.max.z - s.min.z);
    const cx = (s.min.x + s.max.x) / 2, cz = (s.min.z + s.max.z) / 2;
    const y = 0;
    const a = thinX ? [s.min.x - 0.75, y, cz] : [cx, y, s.min.z - 0.75];
    const b = thinX ? [s.max.x + 0.75, y, cz] : [cx, y, s.max.z + 0.75];
    if (Math.hypot(a[0] - b[0], a[2] - b[2]) > 2.05) continue;
    const ya = g.groundAt(a[0], a[2], 3), yb = g.groundAt(b[0], b[2], 3);
    if (g.collides(a[0], ya + 0.3, a[2]) || g.collides(b[0], yb + 0.3, b[2])) continue;
    if (g.los([a[0], ya + 1.5, a[2]], [b[0], yb + 0.32, b[2]])) continue;
    return { a: [a[0], ya, a[2]], b: [b[0], yb, b[2]] };
  }
  return null;
});
ok(!!pair, pair ? `parede de teste em ${pair.a.map((n) => n.toFixed(1)).join(',')}` : 'não achei parede fina no mapa');
if (pair) {
  await until(A, () => window.__docao.time > window.__docao.player.invulnUntil, 5000);
  await T(A, { hurt: 500 });
  ok(await until(A, () => window.__docao.player.down, 4000), 'Ana cai de novo para o teste da parede');
  await T(A, { pos: pair.a });
  await T(B, { pos: pair.b });
  await until(B, () => Math.hypot(window.__docao.player.pos.x - pair.b[0], window.__docao.player.pos.z - pair.b[2]) < 1.2, 4000);
  await B.keyboard.down('l');
  await wait(1200);
  const wall = await G(A, () => window.__docao.player.revP || 0);
  ok(wall === 0, `segurar L através da parede não enche (${wall})`);
  await B.keyboard.up('l');
  await shot(B, 'down-1280-parede');
}

// cliente também cai e é revivido; prints em 1440x900
await A.setViewportSize({ width: 1440, height: 900 });
await B.setViewportSize({ width: 1440, height: 900 });
await T(A, { pos: [0, 0, 20] });
await T(B, { pos: [0.9, 0, 20] });
if (await G(B, () => window.__docao.player.down)) { /* Beto não deveria estar down */ }
ok(await give(B), 'Beto equipa MP5K 4/9 tier 2');
await heartDeath(B, 'Beto');
ok(await goDown(B, 'Beto'), 'Beto (cliente) também cai depois dos 2 corações');
ok(await until(A, () => window.__docao.entities.some((e) => e !== window.__docao.player && e.down), 4000), 'Ana vê o Beto caído');
await A.evaluate(() => {
  const g = window.__docao;
  const mate = g.entities.find((e) => e !== g.player && !e.zt && e.down);
  if (!mate) return;
  const p = mate.pos;
  window.__cam = { p: [p.x + 2.6, p.y + 1.35, p.z + 1.8], t: [p.x, p.y + 0.45, p.z], fov: 46 };
});
await shot(A, 'down-1440-pose');
await A.evaluate(() => { window.__cam = null; });
await A.click('canvas');
await A.keyboard.down('l');
await wait(1100);
await shot(A, 'down-1440-progresso');
await shot(B, 'down-1440-caido');
ok(await until(B, () => !window.__docao.player.down && window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4, 6000), 'Ana revive o Beto com a MP5K intacta');
await A.keyboard.up('l');
await shot(B, 'down-1440-armas');

// os dois caem: a partida acaba
await until(A, () => window.__docao.time > window.__docao.player.invulnUntil, 4000);
await until(B, () => window.__docao.time > window.__docao.player.invulnUntil, 4000);
await T(A, { lives: 0, hurt: 500 });
await T(B, { lives: 0, hurt: 500 });
ok(await until(A, () => window.__docao.invView && window.__docao.invView.phase === 'over', 8000), 'todos caídos: a partida termina');

await browser.close();
if (fails.length) { console.error('\n' + fails.length + ' falha(s)'); process.exit(1); }
console.log('\ntudo ok');

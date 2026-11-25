// A Pocilga no WebKit: corre o circuito, confere relógio, civil, troca, estrelas e ranking.
// SITE=http://127.0.0.1:8140/index.html?server=ws://127.0.0.1:8787&devSkins=0
// API=http://127.0.0.1:8787  SHOTS=/opt/cursor/artifacts
import { mkdirSync } from 'fs';
import { webkit } from 'playwright';
import { scriptRun, PIT } from './shared/pocilga.js';

const SITE = process.env.SITE || 'http://127.0.0.1:8140/index.html?server=ws://127.0.0.1:8787&devSkins=0';
const API = process.env.API || 'http://127.0.0.1:8787';
const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

async function account(nick) {
  const password = 'pocilga-teste';
  const post = (path, body) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let data = await (await post('/api/auth/register', { nick, password })).json();
  if (!data.token) data = await (await post('/api/auth/login', { nick, password })).json();
  return data.token || null;
}
async function seedRank() {
  try {
    const health = await fetch(API + '/health');
    if (!health.ok) return false;
  } catch (e) { return false; }
  const seeds = [
    ['AnaPocilga', scriptRun({ finish: 31 })],
    ['BetoPocilga', scriptRun({ finish: 48, civs: ['c1'] })],
    ['CaioPocilga', scriptRun({ finish: 74 })],
  ];
  for (const [nick, events] of seeds) {
    const token = await account(nick);
    if (!token) return false;
    const r = await fetch(API + '/api/pocilga/run', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ events }) });
    const body = await r.json();
    if (!(r.status === 200 && body.ok && body.run && body.run.ranked)) { console.log('seed', nick, r.status, JSON.stringify(body).slice(0, 240)); return false; }
  }
  const fast = await account('DudaPocilga');
  const bad = await fetch(API + '/api/pocilga/run', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + fast }, body: JSON.stringify({ events: scriptRun({ finish: 1 }) }) });
  const badBody = await bad.json();
  ok(bad.status === 422 && badBody.run && badBody.run.reason === 'rápido' && !badBody.saved, 'servidor recusa tempo abaixo do mínimo');
  const rank = await (await fetch(API + '/api/pocilga/rank?limit=10')).json();
  ok(Array.isArray(rank.rows) && rank.rows[0] && rank.rows[0].nick === 'AnaPocilga' && rank.rows[0].stars === 3, `ranking abre com a Ana (${rank.rows && rank.rows.map((r) => r.nick + ':' + r.stars).join(', ')})`);
  return true;
}

const seeded = await seedRank();
ok(seeded, 'ranking semeado no D1 local');

const errors = [];
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => { localStorage.setItem('docao.name', 'Joao'); localStorage.setItem('docao.primary', '0'); });
await page.goto(SITE, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#modeSel', { timeout: 20000 });
await page.selectOption('#modeSel', PIT.mode);
await page.waitForTimeout(400);
ok(await page.locator('#menuPit').isVisible(), 'o menu mostra A Pocilga');
ok((await page.locator('#mapName').textContent()).includes('Pocilga'), 'mapa do circuito fica fixo');
ok(await page.$eval('#modeSel', (el) => el.options[el.selectedIndex].textContent), 'modo selecionado');
await page.locator('#modeSel').evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.screenshot({ path: `${SHOTS}/pocilga-menu.png` });

await page.click('#playBtn');
await page.waitForFunction(() => window.__docao && window.__docao.state === 'playing' && window.__docao.mode === 'pocilga' && window.__docao.pit && window.__docao.pit.on, null, { timeout: 20000 });
const boot = await page.evaluate(() => ({ map: window.__docao.map.id, n: window.__docao.entities.length, w: window.__docao.player.weapon, targets: window.__docao.pit.targets.length }));
ok(boot.map === 'pocilga' && boot.n === 1 && boot.w === 0 && boot.targets === 13, `entrou sozinho de fuzil (${JSON.stringify(boot)})`);

const place = (z, pitch = -0.08) => page.evaluate(([z, pitch]) => {
  const p = window.__docao.player;
  p.pos.set(0, 0, z); p.vel.set(0, 0, 0); p.yaw = Math.PI; p.pitch = pitch;
}, [z, pitch]);
const snap = () => page.evaluate(() => window.__docao.pit);
const shoot = (id) => page.evaluate(async (id) => {
  const g = window.__docao, t = g.pit.targets.find((x) => x.id === id), p = g.player;
  p.pos.set(t.x, 0, t.z - 4); p.vel.set(0, 0, 0); p.yaw = Math.PI; p.pitch = 0;
  const eye = p.pos.y + 1.6, ty = 0.02 + 1.85 / 2;
  const dir = new g.V3(t.x - p.pos.x, ty - eye, t.z - p.pos.z).normalize();
  const origin = new g.V3(p.pos.x, eye, p.pos.z);
  g.fire(p, origin, dir, p.weapon, 0, origin.clone());
  return g.pit.targets.find((x) => x.id === id).phase;
}, id);

await place(-12, -0.12);
await page.waitForTimeout(400);
let s = await snap();
ok(!s.started && s.timer === 'LARGADA', `antes da faixa o relógio espera (${s.timer})`);
await page.screenshot({ path: `${SHOTS}/pocilga-largada.png` });

await place(1, -0.05);
await page.waitForTimeout(700);
s = await snap();
const bay1 = s.targets.filter((t) => ['e1', 'e2', 'e3'].includes(t.id)).map((t) => t.phase);
ok(s.started && bay1.every((p) => p === 'up'), `sala 1 levantou (${bay1.join(',')})`);
ok(/^0:[0-9]{2}\.[0-9]{2}$/.test(s.timer), `cronômetro correndo (${s.timer})`);
await page.screenshot({ path: `${SHOTS}/pocilga-meio.png` });
for (const id of ['e1', 'e2', 'e3']) ok((await shoot(id)) === 'fall', `${id} cai com o fuzil`);

await place(22, -0.04);
await page.waitForTimeout(700);
ok((await shoot('c1')) !== 'up', 'civil da feira é acertado');
await page.waitForTimeout(200);
s = await snap();
ok(s.civs === 1 && /3/.test(s.banner), `penalidade de civil no aviso (${s.banner}, civis ${s.civs})`);
await page.screenshot({ path: `${SHOTS}/pocilga-civil.png` });
for (const id of ['e4', 'e5', 'e6']) await shoot(id);

await place(40, 0);
await page.waitForTimeout(400);
s = await snap();
const gun = await page.evaluate(() => window.__docao.player.weapon);
ok(s.swapped && gun === 4, `a bancada troca para a Pistolinha (${gun})`);

await place(46, -0.06);
await page.waitForTimeout(700);
for (const id of ['e7', 'e8', 'e9', 'e10']) {
  const phase = await shoot(id);
  ok(phase === 'fall' || phase === 'dead', `${id} cai com a pistola (${phase})`);
}
await place(71, 0);
await page.waitForFunction(() => window.__docao.pit.card, null, { timeout: 8000 });
await page.waitForTimeout(800);
s = await snap();
ok(s.done && s.result && s.result.finished && s.result.stars === 2 && s.result.civs === 1, `fim com 2 estrelas por causa do civil (${JSON.stringify(s.result && { stars: s.result.stars, final: s.result.final, civs: s.result.civs })})`);
ok(await page.locator('#pitOver').isVisible() && (await page.locator('.pit-stars').textContent()).includes('★'), 'tela final com estrelas');
const rankText = await page.locator('#pitCard').innerText();
ok(/Mais rápidos/.test(rankText) && /AnaPocilga/.test(rankText), 'a tela final lista o ranking');
await page.screenshot({ path: `${SHOTS}/pocilga-final.png` });

await page.keyboard.press('KeyR');
await page.waitForTimeout(400);
s = await snap();
const back = await page.evaluate(() => window.__docao.player.pos.z);
ok(!s.started && !s.done && back < -10 && !(await page.locator('#pitOver').isVisible()), `R recomeça antes da faixa (z=${back.toFixed(1)})`);

const noisy = errors.filter((e) => !/WebGL|gpu|GPU|context lost/i.test(e));
ok(!noisy.length, 'sem erro de página' + (noisy.length ? ': ' + noisy.slice(0, 4).join(' | ') : ''));
console.log(fails.length ? `FALHOU ${fails.length}` : 'TUDO OK');
await browser.close();
process.exit(fails.length ? 1 : 0);

// A Pocilga no WebKit: oito etapas, torre, escada, civil × javali, trilho, estrelas e ranking.
// SITE=http://127.0.0.1:8140/index.html?server=ws://127.0.0.1:8787&devSkins=0
// API=http://127.0.0.1:8787  SHOTS=/opt/cursor/artifacts
import { mkdirSync } from 'fs';
import { webkit } from 'playwright';
import { scriptRun, PIT, starsOf } from './shared/pocilga.js';

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
  try { if (!(await fetch(API + '/health')).ok) return false; } catch (e) { return false; }
  for (const [nick, events] of [
    ['AnaPocilga', scriptRun({ finish: PIT.star3 - 3 })],
    ['BetoPocilga', scriptRun({ finish: PIT.star3 + 2, civs: ['c1'] })],
    ['CaioPocilga', scriptRun({ finish: PIT.star2 + 8 })],
  ]) {
    const token = await account(nick);
    if (!token) return false;
    const r = await fetch(API + '/api/pocilga/run', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ events }) });
    const body = await r.json();
    if (!(r.status === 200 && body.run && body.run.ranked && body.run.stars === (nick === 'AnaPocilga' ? 3 : nick === 'BetoPocilga' ? 2 : 1))) {
      console.log('seed', nick, r.status, JSON.stringify(body).slice(0, 240));
      return false;
    }
  }
  const fast = await account('DudaPocilga');
  const bad = await fetch(API + '/api/pocilga/run', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + fast }, body: JSON.stringify({ events: scriptRun({ finish: 1 }) }) });
  const badBody = await bad.json();
  ok(bad.status === 422 && badBody.run && badBody.run.reason === 'rápido', 'servidor recusa tempo abaixo do mínimo');
  return true;
}
ok(await seedRank(), 'ranking semeado no D1 local');

const errors = [];
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => { localStorage.setItem('docao.name', 'Joao'); localStorage.setItem('docao.primary', '0'); });
await page.goto(SITE, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#modeSel', { timeout: 20000 });
await page.selectOption('#modeSel', PIT.mode);
await page.waitForTimeout(300);
await page.click('#playBtn');
await page.waitForFunction(() => window.__docao && window.__docao.state === 'playing' && window.__docao.pit && window.__docao.pit.on, null, { timeout: 20000 });
const boot = await page.evaluate(() => ({
  map: window.__docao.map.id,
  w: window.__docao.player.weapon,
  n: window.__docao.pit.targets.length,
  coach: window.__docao.pit.coach,
  ramps: window.__docao.map.boxes.filter((b) => b.ramp).length,
}));
ok(boot.map === 'pocilga' && boot.w === 4 && boot.n === 30 && boot.coach && boot.ramps >= 1, `pistola, torre e escada (${JSON.stringify(boot)})`);
ok(await page.evaluate(() => !window.__docao.pit.started && !window.__docao.pit.done), 'no começo nem a largada nem a chegada disparam');
ok(await page.evaluate(() => !window.__docao.map.props.some((p) => p.t === 'sign' || p.t === 'decal')), 'sem faixa no chão e sem placa de direção');
const gpu = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
  const i = window.__docao.renderer.info.render;
  res({ calls: i.calls, triangles: i.triangles });
})));
console.log('GPU', JSON.stringify(gpu));

await page.evaluate(() => { window.__cam = { p: [16, 108, -2], t: [16, 0, -2], fov: 64 }; });
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/pocilga-planta.png` });

const talk = await page.evaluate(() => window.__docao.pit.talk);
const lead = await page.evaluate(() => document.getElementById('leader').textContent);
ok(/[Bb]arriguinha|porco|civil|Pistolinha/.test(talk) && !(await page.locator('#pitTalk').evaluate((el) => el.classList.contains('hidden'))), `o Docão fala antes da largada (${talk})`);
ok(!/faixa|placa de direção|FRENTE|ESQUERDA/i.test(`${talk} ${lead}`), `nenhuma fala cita faixa ou placa (${lead})`);
await page.evaluate(() => { window.__cam = { p: [14.6, 1.65, -17.2], t: [14.2, 1.15, -2], fov: 62 }; });
await page.waitForTimeout(250);
await page.screenshot({ path: `${SHOTS}/pocilga-alvos-em-pe.png` });
await page.evaluate(() => { window.__cam = null; });

const go = (x, y, z, yaw = Math.PI, pitch = -0.08) => page.evaluate(({ x, y, z, yaw, pitch }) => {
  const p = window.__docao.player;
  p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch;
}, { x, y, z, yaw, pitch });
const snap = () => page.evaluate(() => window.__docao.pit);
const shoot = (ids) => page.evaluate((ids) => {
  const g = window.__docao;
  const stair = (t) => {
    const y = (t.z - 11.7) / (17.3 - 11.7) * 3.15;
    return { x: -12.2, y, z: t.z, yaw: -Math.PI / 2 };
  };
  const out = {};
  for (const id of ids) {
    const t = g.pit.targets.find((x) => x.id === id);
    const p = g.player;
    const extra = t.zombie ? 4.2 : (t.face === 'x' || t.face === '-x') ? 0.7 : 2.25;
    let spot = { x: t.x, y: t.y || 0, z: t.z - extra, yaw: Math.PI };
    if (t.face === 1) spot = { x: t.x, y: t.y || 0, z: t.z + extra, yaw: 0 };
    else if (t.face === 'x') spot = { x: t.x + extra, y: t.y || 0, z: t.z, yaw: Math.PI / 2 };
    else if (t.face === '-x') spot = { x: t.x - extra, y: t.y || 0, z: t.z, yaw: -Math.PI / 2 };
    if (t.face === -1 && (t.y || 0) > 0.8) { spot.y = Math.max(0, t.y - 0.4); spot.z = t.z - 2.2; }
    if (t.face === 'x' && (t.y || 0) > 0.8) { spot.x = t.x + 2.4; spot.y = t.y; }
    p.pos.set(spot.x, spot.y, spot.z); p.vel.set(0, 0, 0); p.yaw = spot.yaw;
    const eyeY = spot.y + 1.6;
    const aimY = (t.y || 0) + 0.95;
    const dir = new g.V3(t.x - spot.x, aimY - eyeY, t.z - spot.z).normalize();
    const origin = new g.V3(spot.x, eyeY, spot.z);
    g.fire(p, origin, dir, p.weapon, 0, origin.clone());
    const now = g.pit.targets.find((x) => x.id === id);
    out[id] = { phase: now.phase, stop: g.__lastTrace ? null : null, trace: window.__lastTrace ? window.__lastTrace.stop : '' };
  }
  return out;
}, ids);

const gate = (id) => PIT.gates.find((g) => g.id === id);
const shotOf = async (name, x, y, z, yaw, pitch = -0.06) => {
  await page.evaluate(() => { window.__cam = null; });
  await go(x, y, z, yaw, pitch);
  await page.waitForTimeout(280);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

await page.evaluate(() => { window.__cam = { p: [11.2, 3.4, -21.4], t: [13.6, 1.7, -13.2], fov: 64 }; });
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/pocilga-1-largada.png` });
await page.evaluate(() => { window.__cam = null; });
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
const pauseUi = await page.evaluate(() => {
  const nav = [...document.querySelectorAll('#pauseNav [data-pause-act]')].filter((b) => !b.classList.contains('hidden')).map((b) => b.textContent.trim());
  return { open: !document.getElementById('pause').classList.contains('hidden'), nav, state: window.__docao.state };
});
ok(pauseUi.open && pauseUi.state === 'paused' && pauseUi.nav[0] === 'Continuar' && pauseUi.nav[1] === 'Reiniciar' && pauseUi.nav[2] === 'Opções', `pausa com Reiniciar (${pauseUi.nav.join(' · ')})`);
await page.screenshot({ path: `${SHOTS}/pocilga-pausa.png` });
const locks = await page.evaluate(() => window.__lockCalls || 0);
await page.click('#pauseRestartBtn');
await page.waitForTimeout(300);
const restarted = await page.evaluate(() => ({
  state: window.__docao.state,
  pause: document.getElementById('pause').classList.contains('hidden'),
  x: window.__docao.player.pos.x,
  z: window.__docao.player.pos.z,
  up: window.__docao.pit.targets.filter((t) => !t.zombie).every((t) => t.phase === 'up') && window.__docao.pit.targets.filter((t) => t.zombie).every((t) => t.phase === 'down'),
  started: window.__docao.pit.started,
  locks: window.__lockCalls || 0,
}));
ok(restarted.state === 'playing' && restarted.pause && restarted.up && !restarted.started && Math.hypot(restarted.x - PIT.spawn[0], restarted.z - PIT.spawn[1]) < 0.4 && restarted.locks > locks, `Reiniciar volta pra largada com os alvos de pé (${JSON.stringify(restarted)})`);

await go(gate('start').x, gate('start').y, gate('start').z);
await page.waitForTimeout(250);
let s = await snap();
const patio = s.targets.filter((t) => ['e1', 'e2'].includes(t.id));
const later = s.targets.filter((t) => ['e3', 'e4', 'e5', 'c1'].includes(t.id));
ok(s.started && s.pops.includes('patio') && patio.every((t) => t.phase === 'up') && later.every((t) => t.phase === 'up'), `os alvos já estão de pé, sem subida (${[...patio, ...later].map((t) => t.phase).join(',')})`);
await page.waitForTimeout(200);
s = await snap();
ok(/INIMIGOS 0\/25/.test(s.cod) && /CIVIS 0\/5/.test(s.cod), `pátio no relógio (${s.cod.replace(/\s+/g, ' ')})`);
await shotOf('pocilga-2-corredor', 14.2, 0, -8.6, Math.PI, -0.02);
await page.evaluate(() => { window.__cam = { p: [14.2, 22, 6], t: [14.2, 0, 6], fov: 42 }; });
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}/pocilga-corredor-cima.png` });
await page.evaluate(() => { window.__cam = null; });
let shot = await shoot(['e1', 'e2']);
for (const id of ['e1', 'e2']) ok(shot[id].phase === 'fall', `${id} cai com a Pistolinha${shot[id].phase !== 'fall' ? ' (' + shot[id].trace + ')' : ''}`);
await go(gate('meio').x, gate('meio').y, gate('meio').z);
await page.waitForTimeout(200);
ok((await snap()).pops.includes('patio2'), 'o meio do corredor acorda');
shot = await shoot(['e3']);
ok(shot.e3.phase === 'fall', `e3 cai com a Pistolinha${shot.e3.phase !== 'fall' ? ' (' + shot.e3.trace + ')' : ''}`);
await go(gate('fundo').x, gate('fundo').y, gate('fundo').z);
await page.waitForTimeout(200);
ok((await snap()).pops.includes('patio3'), 'o fundo do corredor acorda');
shot = await shoot(['e4', 'e5']);
for (const id of ['e4', 'e5']) ok(shot[id].phase === 'fall', `${id} cai com a Pistolinha${shot[id].phase !== 'fall' ? ' (' + shot[id].trace + ')' : ''}`);

await go(gate('sala').x, gate('sala').y, gate('sala').z);
await page.waitForTimeout(120);
s = await snap();
const sala = s.targets.filter((t) => ['e6', 'e7', 'e8', 'e9', 'e10', 'c2'].includes(t.id));
ok(s.pops.includes('sala') && sala.every((t) => t.phase !== 'down'), `a sala sobe junta (${sala.map((t) => t.phase).join(',')})`);
ok(/muro/.test(s.talk + s.banner), 'o Barriguinha fala do muro');
await shotOf('pocilga-3-sala', 14.2, 0, 21.2, Math.PI, -0.08);
shot = await shoot(['e6', 'e7', 'e8', 'e9', 'e10']);
for (const id of ['e6', 'e7', 'e8', 'e9', 'e10']) ok(shot[id].phase === 'fall', `${id} na sala${shot[id].phase !== 'fall' ? ' (' + shot[id].trace + ')' : ''}`);

await go(gate('escada').x, gate('escada').y, gate('escada').z, Math.PI, -0.35);
await page.waitForTimeout(200);
ok((await snap()).pops.includes('escada') && /Sobe a escada/.test((await snap()).banner + (await snap()).talk), 'sobe a escada');
await shotOf('pocilga-4-rampa', 0, 1.6, 36, Math.PI, -0.28);
await page.evaluate(() => {
  const ban = document.getElementById('pitBanner'); if (ban) ban.classList.add('hidden');
  window.__cam = { p: [-1.2, 1.35, 24.8], t: [0.4, 4.6, 46], fov: 52 };
});
await page.waitForTimeout(250);
await page.screenshot({ path: `${SHOTS}/pocilga-rampa-baixo.png` });
await page.evaluate((deck) => { window.__cam = { p: [2, deck + 1.7, 50.5], t: [24, deck + 0.6, 50.5], fov: 58 }; }, PIT.deck);
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}/pocilga-rampa-topo.png` });
await page.waitForTimeout(250);
await page.screenshot({ path: `${SHOTS}/pocilga-pouso.png` });
await page.evaluate(() => { window.__cam = null; });
shot = await shoot(['e12', 'e13', 'e14']);
for (const id of ['e12', 'e13', 'e14']) ok(shot[id].phase === 'fall', `${id} na rampa${shot[id].phase !== 'fall' ? ' (' + shot[id].trace + ')' : ''}`);

await go(gate('passa').x, gate('passa').y, gate('passa').z, -Math.PI / 2, -0.05);
await page.waitForTimeout(200);
ok((await snap()).pops.includes('passa'), 'passarela acorda');
await shotOf('pocilga-6-passarela', 4.2, PIT.deck, 50.5, -Math.PI / 2, -0.02);
await page.evaluate((deck) => { window.__cam = { p: [8, deck + 1.6, 48.6], t: [26, deck + 1.1, 50.6], fov: 48 }; }, PIT.deck);
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}/pocilga-zumbis.png` });
await go(gate('passa2').x, gate('passa2').y, gate('passa2').z, -Math.PI / 2, 0);
await page.waitForTimeout(350);
await page.evaluate((deck) => {
  const ban = document.getElementById('pitBanner'); if (ban) ban.classList.add('hidden');
  window.__cam = { p: [10, deck + 1.8, 49.2], t: [24, deck + 1.3, 51.2], fov: 55 };
}, PIT.deck);
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}/pocilga-corredor-inesperado.png` });
await page.evaluate(() => { window.__cam = { p: [18, 16, 50.5], t: [18, 3.15, 50.5], fov: 48 }; });
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}/pocilga-passarela-cima.png` });
await page.evaluate(() => { window.__cam = null; });
shot = await shoot(['e15', 'z1', 'z2']);
ok(shot.e15.phase === 'fall', `e15 na passarela${shot.e15.phase !== 'fall' ? ' (' + shot.e15.trace + ')' : ''}`);
for (const id of ['z1', 'z2']) ok(shot[id].phase === 'dead', `${id} cai com um tiro (${shot[id].phase})`);
await go(gate('passa2').x, gate('passa2').y, gate('passa2').z, -Math.PI / 2, 0);
await page.waitForTimeout(200);
ok((await snap()).pops.includes('passa2'), 'o fim da passarela acorda');
shot = await shoot(['e16', 'e17', 'c3']);
for (const id of ['e16', 'e17', 'c3']) ok(shot[id].phase === 'fall', `${id} na passarela${shot[id].phase !== 'fall' ? ' (' + shot[id].trace + ')' : ''}`);
s = await snap();
ok(s.civs === 1 && /3/.test(s.banner), `penalidade do civil (${s.banner})`);

await go(gate('pulo').x, gate('pulo').y, gate('pulo').z, -Math.PI / 2, 0.05);
await page.waitForTimeout(250);
ok(/Pula/.test((await snap()).banner + (await snap()).talk), 'grita pra pular');
await go(gate('baixo').x, gate('baixo').y, gate('baixo').z, 0, 0);
await page.waitForTimeout(200);
ok((await snap()).pops.includes('pulo'), 'a disparada acorda');
await go(gate('corre').x, gate('corre').y, gate('corre').z, 0, 0);
await page.waitForTimeout(250);
ok(/Corre/.test((await snap()).banner + (await snap()).talk), 'grita pra correr');
shot = await shoot(['e18', 'e19', 'e20', 'e21', 'e22', 'e23', 'e24']);
for (const id of ['e18', 'e19', 'e20', 'e21', 'e22', 'e23', 'e24']) ok(shot[id].phase === 'fall', `${id} na reta${shot[id].phase !== 'fall' ? ' (' + shot[id].trace + ')' : ''}`);
await page.evaluate(() => {
  document.getElementById('pitBanner')?.classList.add('hidden');
  document.getElementById('pitTalk')?.classList.add('hidden');
  window.__cam = { p: [33.2, 1.62, -16.2], t: [32.2, 0.55, -24], fov: 62 };
});
await page.waitForTimeout(250);
await page.screenshot({ path: `${SHOTS}/pocilga-linha.png` });
await page.screenshot({ path: `${SHOTS}/pocilga-7-final.png` });
await page.evaluate(() => { window.__cam = null; });

await go(32, 0, -21.5, Math.PI, 0);
await page.waitForTimeout(280);
await page.evaluate(() => {
  document.getElementById('pitOver').classList.add('hidden');
  const talk = document.getElementById('pitTalk');
  if (talk) { talk.classList.add('hidden'); talk.style.display = 'none'; }
  window.__cam = { p: [29.6, 1.7, -19.4], t: [32.2, 1.5, -21.6], fov: 58 };
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}/pocilga-confete.png` });
await page.evaluate(() => { window.__cam = null; document.getElementById('pitOver').classList.remove('hidden'); });
await page.waitForFunction(() => window.__docao.pit.card, null, { timeout: 8000 });
await page.waitForTimeout(800);
s = await snap();
const expectStars = s.result ? starsOf(s.result.final, s.result.civs, true) : -1;
ok(s.done && s.result && s.result.civs === 1 && s.result.stars === expectStars && s.result.stars < 3, `estrelas com um civil (${JSON.stringify(s.result && { stars: s.result.stars, final: s.result.final, civs: s.result.civs })})`);
const card = await page.locator('#pitCard').innerText();
ok(/MISSÃO CUMPRIDA/.test(card) && /AnaPocilga/.test(card) && /Inimigos/.test(card) && /FECHAR/.test(card), 'tela final com missão, inimigos e ranking');
ok(/Alvo: —/.test(card), 'o cartaz mostra a linha do alvo, sem acerto');
ok(card.includes('Entre na conta para entrar no ranking'), 'deslogado vê o aviso no cartaz');
const aberto = await page.evaluate(() => ({ state: window.__docao.state, pause: document.getElementById('pause').classList.contains('hidden'), card: window.__docao.pit.card }));
ok(aberto.state === 'playing' && aberto.pause && aberto.card, `cartaz com o jogo rodando, sem pausa (${JSON.stringify(aberto)})`);
await page.screenshot({ path: `${SHOTS}/pocilga-modal.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(350);
const fechado = await page.evaluate(() => ({ state: window.__docao.state, pause: document.getElementById('pause').classList.contains('hidden'), card: window.__docao.pit.card, done: window.__docao.pit.done }));
ok(fechado.state === 'playing' && fechado.pause && !fechado.card && fechado.done, `Esc fecha o cartaz e não abre a pausa (${JSON.stringify(fechado)})`);
await page.screenshot({ path: `${SHOTS}/pocilga-depois.png` });
await page.keyboard.press('KeyR');
await page.waitForTimeout(400);
s = await snap();
ok(!s.started && !s.card && (await page.evaluate(() => window.__docao.player.weapon)) === 4, 'R recomeça ainda de Pistolinha');

const noisy = errors.filter((e) => !/WebGL|gpu|GPU|context lost/i.test(e));
ok(!noisy.length, 'sem erro de página' + (noisy.length ? ': ' + noisy.slice(0, 4).join(' | ') : ''));
console.log(fails.length ? `FALHOU ${fails.length}` : 'TUDO OK');
await browser.close();
process.exit(fails.length ? 1 : 0);

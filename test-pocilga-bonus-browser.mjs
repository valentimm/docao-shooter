// Alvo de bônus no WebKit/Chromium: visto da rampa, -2s, segundo tiro, reinício e +2s.
// SITE=http://127.0.0.1:8140/index.html  SHOTS=/opt/cursor/artifacts
import { mkdirSync } from 'fs';
import { chromium } from 'playwright';
import { PIT, FINISH_LINE } from './shared/pocilga.js';

const SITE = process.env.SITE || 'http://127.0.0.1:8140/index.html?devSkins=0';
const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
await page.addInitScript(() => { localStorage.setItem('docao.name', 'Joao'); localStorage.setItem('docao.primary', '0'); });
await page.goto(SITE, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#modeSel', { timeout: 20000 });
await page.selectOption('#modeSel', PIT.mode);
await page.waitForTimeout(500);
const menuTxt = await page.evaluate(() => ({
  opt: document.querySelector('#modeSel option:checked')?.textContent || '',
  note: document.getElementById('menuPit')?.innerText || '',
  play: document.getElementById('playBtn')?.innerText || '',
}));
ok(/Pistoleiro da Pocilga/.test(menuTxt.opt) && /Pistoleiro da Pocilga/.test(menuTxt.note) && /Barriguinha de camisa vermelha/.test(menuTxt.note), `menu com o nome novo (${menuTxt.opt})`);
await page.screenshot({ path: `${SHOTS}/pocilga-menu-nome.png` });
await page.click('#playBtn');
await page.waitForFunction(() => window.__docao && window.__docao.state === 'playing' && window.__docao.pit && window.__docao.pit.on, null, { timeout: 20000 });

const boot = await page.evaluate(() => ({
  n: window.__docao.pit.targets.length,
  bonus: window.__docao.pit.bonus,
  audio: window.__audio ? window.__audio.count : -1,
}));
ok(boot.n === 30 && boot.bonus && !boot.bonus.locked && boot.bonus.inner === 0.14 && boot.bonus.outer === 0.65, `30 alvos e o bônus solto (${JSON.stringify(boot.bonus)})`);
ok(boot.audio <= 1, `um AudioContext no máximo antes do tiro (${boot.audio})`);
const zedsAtStart = await page.evaluate((deck) => {
  const ban = document.getElementById('pitBanner'); if (ban) ban.classList.add('hidden');
  const talk = document.getElementById('pitTalk'); if (talk) talk.classList.add('hidden');
  window.__cam = { p: [0.3, deck + 1.62, 46.6], t: [22, deck + 1.05, 50.4], fov: 58 };
  return window.__docao.pit.targets.filter((t) => t.zombie).map((t) => ({ id: t.id, phase: t.phase, shown: t.shown, x: t.x, z: t.z }));
}, PIT.deck);
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/pocilga-zumbis-patamar.png` });
await page.evaluate(() => { window.__cam = null; });
ok(zedsAtStart.length === 2 && zedsAtStart.every((z) => z.shown && z.phase === 'down' && z.x > 20), `zumbis visíveis e parados no fundo (${JSON.stringify(zedsAtStart)})`);

const rampCam = () => page.evaluate(() => {
  const b = window.__docao.pit.bonus;
  const z = 45.5;
  const ground = (z - 28) / 20 * 5.2;
  const ban = document.getElementById('pitBanner'); if (ban) ban.classList.add('hidden');
  const talk = document.getElementById('pitTalk'); if (talk) talk.classList.add('hidden');
  if (!document.getElementById('pitShotStyle')) {
    const style = document.createElement('style');
    style.id = 'pitShotStyle';
    style.textContent = '#crosshair,#reddot{display:none !important}';
    document.head.appendChild(style);
  }
  const msg = document.getElementById('centermsg'); if (msg) msg.style.visibility = 'hidden';
  window.__cam = { p: [0.15, ground + 1.6, z], t: [b.x, b.y + 0.15, b.z], fov: 46 };
});

await rampCam();
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/pocilga-alvo-rampa.png` });

const gate = PIT.gates.find((g) => g.id === 'start');
await page.evaluate(({ x, y, z }) => {
  window.__cam = null;
  const p = window.__docao.player;
  p.pos.set(x, y, z); p.vel.set(0, 0, 0);
}, gate);
await page.waitForTimeout(250);
ok((await page.evaluate(() => window.__docao.pit.started)), 'a corrida começou');

const fireAt = (x) => page.evaluate((x) => {
  const g = window.__docao;
  const b = g.pit.bonus;
  const origin = new g.V3(x, b.y, b.z - 2.2);
  const dir = new g.V3(0, 0, 1);
  g.fire(g.player, origin, dir, g.player.weapon, 0, origin.clone());
  return g.pit.bonus;
}, x);

const heardBefore = await page.evaluate(() => (window.__audio && window.__audio.log ? window.__audio.log.length : -1));
let bonus = await fireAt(0);
ok(bonus.locked && bonus.zone === 'center' && bonus.text === '-2s' && bonus.delta === -2, `miolo trava em -2s (${JSON.stringify(bonus)})`);
const heard = await page.evaluate((before) => {
  const log = window.__audio && window.__audio.log ? window.__audio.log : [];
  return { count: window.__audio ? window.__audio.count : -1, state: window.__audio ? window.__audio.state : '', added: log.length - before, osc: log.slice(before).filter((row) => row.node === 'osc').length };
}, heardBefore);
ok(heard.count === 1 && heard.state === 'running' && heard.osc >= 1, `miolo toca no AudioContext único (${JSON.stringify(heard)})`);
const cod = await page.evaluate(() => window.__docao.pit.cod.replace(/\s+/g, ' '));
ok(/INIMIGOS 0\/25/.test(cod), `o bônus não conta inimigo (${cod})`);
await rampCam();
await page.waitForTimeout(350);
await page.screenshot({ path: `${SHOTS}/pocilga-alvo-menos-2.png` });

const again = await fireAt(0);
ok(again.locked && again.zone === 'center' && again.text === '-2s' && again.delta === -2, 'o segundo tiro não muda o -2s');

await page.evaluate(() => window.__docao.pitRestart());
await page.waitForTimeout(300);
const restarted = await page.evaluate(() => window.__docao.pit.bonus);
ok(restarted && !restarted.locked && restarted.delta === 0 && restarted.text === '', `reinício destrava (${JSON.stringify(restarted)})`);

await page.evaluate(({ x, y, z }) => {
  const p = window.__docao.player;
  p.pos.set(x, y, z); p.vel.set(0, 0, 0);
}, gate);
await page.waitForTimeout(250);
bonus = await fireAt(0.42);
ok(bonus.locked && bonus.zone === 'ring' && bonus.text === '+2s' && bonus.delta === 2, `anel trava em +2s (${JSON.stringify(bonus)})`);
const still = await page.evaluate(() => window.__docao.pit.targets.length);
ok(still === 30, 'depois do anel continuam 30 alvos de circuito');
await page.evaluate(() => window.__docao.pitRestart());
await page.waitForTimeout(300);
await page.evaluate(({ x, y, z }) => {
  const p = window.__docao.player;
  p.pos.set(x, y, z); p.vel.set(0, 0, 0);
}, gate);
await page.waitForTimeout(250);
bonus = await fireAt(0);
ok(bonus.zone === 'center' && bonus.text === '-2s', 'a corrida do cartaz acerta o miolo');

const go = (x, y, z) => page.evaluate(({ x, y, z }) => {
  const p = window.__docao.player;
  p.pos.set(x, y, z); p.vel.set(0, 0, 0);
}, { x, y, z });
const shoot = (ids) => page.evaluate((ids) => {
  const g = window.__docao;
  const out = {};
  for (const id of ids) {
    const t = g.pit.targets.find((x) => x.id === id);
    if (!t) { out[id] = 'missing'; continue; }
    const extra = t.zombie ? 4.2 : (t.face === 'x' || t.face === '-x') ? 0.7 : 2.25;
    let spot = { x: t.x, y: t.y || 0, z: t.z - extra, yaw: Math.PI };
    if (t.face === 1) spot = { x: t.x, y: t.y || 0, z: t.z + extra, yaw: 0 };
    else if (t.face === 'x') spot = { x: t.x + extra, y: t.y || 0, z: t.z, yaw: Math.PI / 2 };
    else if (t.face === '-x') spot = { x: t.x - extra, y: t.y || 0, z: t.z, yaw: -Math.PI / 2 };
    if (t.face === -1 && (t.y || 0) > 0.8) { spot.y = Math.max(0, t.y - 0.4); spot.z = t.z - 2.2; }
    if (t.face === 'x' && (t.y || 0) > 0.8) { spot.x = t.x + 2.4; spot.y = t.y; }
    const p = g.player;
    p.pos.set(spot.x, spot.y, spot.z); p.vel.set(0, 0, 0); p.yaw = spot.yaw;
    const eyeY = spot.y + 1.6;
    const aimY = (t.y || 0) + (t.zombie ? 0.9 : 0.95);
    const dir = new g.V3(t.x - spot.x, aimY - eyeY, t.z - spot.z).normalize();
    g.fire(p, new g.V3(spot.x, eyeY, spot.z), dir, p.weapon, 0, new g.V3(spot.x, eyeY, spot.z));
    const now = g.pit.targets.find((x) => x.id === id);
    out[id] = now ? now.phase : 'missing';
  }
  return out;
}, ids);
for (const bay of PIT.bays) {
  const g = PIT.gates.find((gate) => gate.pop === bay.id);
  await go(g.x, g.y, g.z);
  await page.waitForTimeout(420);
  const ids = bay.targets.filter((t) => t.kind === 'enemy').map((t) => t.id);
  let shot = await shoot(ids);
  const pending = ids.filter((id) => shot[id] === 'rise' || shot[id] === 'down' || shot[id] === 'wait');
  if (pending.length) {
    await page.waitForTimeout(280);
    shot = { ...shot, ...(await shoot(pending)) };
  }
  for (const id of ids) {
    const phase = shot[id];
    ok(phase === 'fall' || phase === 'dead', `${id} cai antes da chegada (${phase})`);
  }
}
await go((FINISH_LINE.x0 + FINISH_LINE.x1) / 2, 0, FINISH_LINE.z);
await page.waitForFunction(() => window.__docao.pit.card, null, { timeout: 8000 });
const card = await page.locator('#pitCard').innerText();
const result = await page.evaluate(() => window.__docao.pit.result);
ok(/Alvo: -2s/.test(card) && /Entre na conta para entrar no ranking/.test(card) && /Pistoleiro da Pocilga/.test(card), `o modal mostra Alvo: -2s e o aviso de conta (${card.split('\n').filter((line) => /Alvo|conta|Pistoleiro/.test(line)).join(' | ')})`);
ok(result && result.bonus === -2 && result.bonusZone === 'center' && result.down && result.down.length === 25 && result.final === result.raw - 2, `o tempo final é o relógio menos 2 s (${JSON.stringify(result && { final: result.final, raw: result.raw, bonus: result.bonus, down: result.down && result.down.length })})`);
await page.screenshot({ path: `${SHOTS}/pocilga-modal-menos-2.png` });

const noisy = errors.filter((e) => !/WebGL|gpu|GPU|context lost|pocilga\/rank|Failed to load resource/i.test(e));
ok(!noisy.length, 'sem erro de página' + (noisy.length ? ': ' + noisy.slice(0, 4).join(' | ') : ''));
console.log(fails.length ? `FALHOU ${fails.length}` : 'TUDO OK');
await browser.close();
process.exit(fails.length ? 1 : 0);

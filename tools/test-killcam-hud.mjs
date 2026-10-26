// Kill cam: o menu de armas não cobre quem matou; depois do respawn a troca de arma volta.
// Uso: SITE=http://127.0.0.1:8170/ node tools/test-killcam-hud.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const SITE = process.env.SITE || 'http://127.0.0.1:8170/';
const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon\.ico/.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { localStorage.setItem('docao.name', 'Matheus'); localStorage.setItem('docao.map', 'arena'); });
await page.goto(SITE, { waitUntil: 'load' });
const G = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
await page.selectOption('#modeSel', 'dm');
await page.selectOption('#botCount', '4');
await page.click('#playBtn');
ok(await page.waitForFunction(() => window.__docao && window.__docao.state === 'playing' && window.__docao.player && window.__docao.player.alive, null, { timeout: 20000 }).then(() => true, () => false), 'a partida começa');

const killed = await G(() => {
  const g = window.__docao, p = g.player;
  const k = g.entities.find((e) => !e.isPlayer && e.alive);
  for (const e of g.entities) if (!e.isPlayer) { e.frozen = true; e.passive = true; e.vel.set(0, 0, 0); }
  k.pos.set(p.pos.x + 6, p.pos.y, p.pos.z + 1);
  p.invulnUntil = 0;
  g.damage(p, 500, k, 0, false);
  return { alive: p.alive, killer: k.name };
});
ok(killed && killed.alive === false, `morreu para ${killed && killed.killer}`);
ok(await page.waitForFunction(() => window.__docao.time - window.__docao.player.deathAt > 2.2 && window.__docao.deathCam.killer, null, { timeout: 20000 }).then(() => true, () => false), 'a kill cam segurou o assassino');
await wait(400);
const cam = await G(() => {
  const g = window.__docao;
  const tela = document.getElementById('deathpick');
  const st = getComputedStyle(tela);
  const r = tela.getBoundingClientRect();
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const tapa = r.width > 8 && r.height > 8 && r.left <= cx && r.right >= cx && r.top <= cy && r.bottom >= cy;
  const armas = ['deathList', 'classGun', 'deathArms'].map((id) => getComputedStyle(document.getElementById(id)).display);
  const k = g.deathCam.killer;
  const c = g.camera.position;
  const dist = k ? Math.hypot(c.x - k.pos.x, c.z - k.pos.z) : null;
  return {
    killcam: document.body.classList.contains('killcam'),
    dead: document.body.classList.contains('dead'),
    cls: document.body.classList.contains('cls-on'),
    hidden: tela.classList.contains('hidden'),
    bg: st.backgroundColor,
    tapa, armas,
    score: getComputedStyle(document.getElementById('score')).display,
    chat: getComputedStyle(document.getElementById('socialHud')).display,
    feed: getComputedStyle(document.getElementById('killfeed')).display,
    top: getComputedStyle(document.getElementById('topbar')).display,
    slots: getComputedStyle(document.getElementById('bottomright')).visibility,
    who: document.getElementById('deathWho').textContent,
    respawn: document.getElementById('respawnBtn').getBoundingClientRect().width,
    dist: dist == null ? null : +dist.toFixed(1),
    on: g.deathCam.on,
  };
});
console.log(JSON.stringify(cam));
ok(cam.killcam && cam.on && !cam.dead && !cam.cls && !cam.hidden, 'kill cam ligada, sem a ficha em tela cheia');
ok(!cam.tapa && cam.armas.every((d) => d === 'none'), `menu de armas não cobre o centro (tapa ${cam.tapa}, armas ${cam.armas.join(',')})`);
ok(cam.score !== 'none' && cam.chat !== 'none' && cam.feed !== 'none' && cam.top !== 'none', `placar, chat, killfeed e topo seguem na tela (${cam.score}/${cam.chat}/${cam.feed}/${cam.top})`);
ok(cam.slots === 'hidden', 'o HUD de arma do canto some enquanto morto');
ok(cam.who.startsWith('Você foi pururucado por') && cam.respawn > 40, `aviso e Renascer continuam (${cam.who}, ${cam.respawn}px)`);
ok(cam.dist != null && cam.dist < 12, `câmera perto de quem matou (${cam.dist} m)`);
await page.screenshot({ path: `${SHOTS}/killcam-sem-menu.png` });

await G(() => { window.__docao.player.respawnAt = 0; });
await page.keyboard.press('Space');
ok(await page.waitForFunction(() => window.__docao.player.alive && !document.body.classList.contains('killcam'), null, { timeout: 8000 }).then(() => true, () => false), 'Espaço renasce e tira a kill cam');
await wait(300);
const vivo = await G(() => {
  const g = window.__docao, p = g.player;
  const before = p.weapon;
  g.switchWeapon(p, p.slots[1]);
  return {
    alive: p.alive,
    killcam: document.body.classList.contains('killcam'),
    dead: document.body.classList.contains('dead'),
    pick: document.getElementById('deathpick').classList.contains('hidden'),
    slots: getComputedStyle(document.getElementById('bottomright')).visibility,
    list: getComputedStyle(document.getElementById('deathList')).display,
    before, after: p.weapon, slot: p.slots[1],
  };
});
console.log(JSON.stringify(vivo));
ok(vivo.alive && vivo.pick && !vivo.killcam && !vivo.dead, 'depois do respawn a ficha de morte sai');
ok(vivo.slots === 'visible' && vivo.after === vivo.slot && vivo.after !== vivo.before, `a troca de arma volta (slot ${vivo.before} → ${vivo.after})`);
await page.screenshot({ path: `${SHOTS}/respawn-armas.png` });

await G(() => { const p = window.__docao.player; p.lastAttacker = null; p.invulnUntil = 0; window.__docao.kill(p); });
ok(await page.waitForFunction(() => !window.__docao.player.alive && window.__docao.time - window.__docao.player.deathAt > 1.6 && !document.getElementById('deathpick').classList.contains('hidden'), null, { timeout: 15000 }).then(() => true, () => false), 'sem assassino, a ficha de armas volta depois da câmera do bacon');
const solo = await G(() => ({
  killcam: document.body.classList.contains('killcam'),
  dead: document.body.classList.contains('dead'),
  list: getComputedStyle(document.getElementById('deathList')).display,
}));
console.log(JSON.stringify(solo));
ok(!solo.killcam && solo.dead && solo.list !== 'none', 'morte sem kill cam continua com a ficha de classes');

ok(!errors.length, 'sem erro na página ' + errors.slice(0, 3).join(' | '));
await browser.close();
console.log(fails.length ? `${fails.length} FALHA(S)` : 'TUDO OK');
process.exit(fails.length ? 1 : 0);

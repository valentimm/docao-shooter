// Visual e fluxo no navegador: cilindro inteiro, pegando fogo, explosão, cadeia, bot morto, respawn.
// Uso: SITE=http://127.0.0.1:8123 node test-gas-browser.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SITE = process.env.SITE || 'http://127.0.0.1:8123/';
const OUT = process.env.OUT || '/opt/cursor/artifacts/gas';
mkdirSync(OUT, { recursive: true });
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', (r) => { if (r.status() === 404 && !/favicon|\/assets\//.test(r.url())) errors.push('404 ' + r.url()); });
await page.goto(SITE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__docao && window.__docao.state === 'menu', null, { timeout: 20000 });

const boot = await page.evaluate(() => {
  const g = window.__docao;
  g.startGame('morro-leitao');
  const hud = document.getElementById('hud'); if (hud) hud.style.opacity = '0';
  const p = g.player;
  for (const e of g.entities) if (!e.isPlayer) { e.frozen = true; e.pos.set(20, 0, 20); e.vel.set(0, 0, 0); }
  const c = g.gas.find((x) => x.id === 8);
  const x = c.x - 3.3, z = c.z - 0.15;
  p.pos.set(x, g.groundAt(x, z, c.y + 2), z);
  p.vel.set(0, 0, 0); p.onGround = true; p.alive = true; p.hp = 100;
  const eye = p.pos.y + 1.62, dx = c.x - p.pos.x, dy = (c.y + c.h * 0.62) - eye, dz = c.z - p.pos.z;
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return { gas: g.gas.length, phase: c.phase, hp: c.hp, feet: +p.pos.y.toFixed(2), tanks: 'kept' };
});
ok(boot.gas === 10 && boot.phase === 0 && boot.hp === 100, `partida no Morro com 10 botijões inteiros (pés em ${boot.feet})`);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-cilindro-inteiro.png` });

const lit = await page.evaluate(() => {
  const g = window.__docao, p = g.player, c = g.gas.find((x) => x.id === 8);
  const eye = new g.V3(p.pos.x, p.pos.y + 1.62, p.pos.z);
  const dir = new g.V3(c.x - eye.x, (c.y + c.h * 0.55) - eye.y, c.z - eye.z).normalize();
  const shots = [];
  for (let i = 0; i < 3; i++) { g.fire(p, eye, dir, 0, 0, eye); const n = g.gas.find((x) => x.id === 8); shots.push({ hp: n.hp, phase: n.phase }); }
  return { shots, trace: window.__lastTrace, shake: g.shake };
});
ok(lit.shots[0].phase === 0 && lit.shots[0].hp === 80, `1º tiro: ${lit.shots[0].hp} hp, ainda inteiro`);
ok(lit.shots[1].phase === 0 && lit.shots[1].hp === 60, `2º tiro: ${lit.shots[1].hp} hp`);
ok(lit.shots[2].phase === 1 && lit.shots[2].hp === 40, `3º tiro pega fogo (${lit.shots[2].hp} hp, fase ${lit.shots[2].phase}) parou em ${lit.trace && lit.trace.stop}`);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/02-cilindro-fogo.png` });

const boom = await page.evaluate(() => {
  const g = window.__docao, c = g.gas.find((x) => x.id === 8), mate = g.gas.find((x) => x.id === 9);
  const bot = g.entities.find((e) => !e.isPlayer);
  const x = mate.x + 1.25, z = mate.z;
  bot.frozen = true; bot.alive = true; bot.hp = 100; bot.invulnUntil = 0;
  bot.pos.set(x, g.groundAt(x, z, mate.y + 2), z); bot.vel.set(0, 0, 0);
  g.time = c.explodeAt + 0.02;
  return { explosions: g.explosions, bot: bot.name, fuse: c.explodeAt };
});
await page.waitForFunction((n) => {
  const g = window.__docao;
  if (g.explosions > n) window.__boomShake = Math.max(window.__boomShake || 0, g.shake || 0);
  return g.explosions > n;
}, boom.explosions, { timeout: 8000 });
await page.waitForTimeout(80);
await page.screenshot({ path: `${OUT}/03-cilindro-explosao.png` });
const after = await page.evaluate(() => {
  const g = window.__docao;
  const a = g.gas.find((x) => x.id === 8), b = g.gas.find((x) => x.id === 9);
  const bot = g.entities.find((e) => !e.isPlayer);
  return { a: a.phase, b: b.phase, botAlive: bot.alive, botHp: bot.hp, kills: g.player.kills, feed: window.__feedLog || [], shake: g.shake, boomShake: window.__boomShake || 0, knock: g.lastKnock, explosions: g.explosions, respawn: a.respawnAt, time: g.time };
});
ok(after.a === 2 && after.b === 2, `cadeia: os dois estouraram (fases ${after.a}, ${after.b})`);
ok(after.botAlive === false && after.botHp <= 0, `bot morreu na explosão (${after.botHp})`);
ok(after.kills >= 1 && (after.feed || []).some((l) => /Botijão/.test(l)), `kill feed do botijão (${(after.feed || []).join(' | ')})`);
ok((after.boomShake || after.shake) > 0.05, `câmera tremeu (${(after.boomShake || after.shake).toFixed(2)})`);
ok(after.explosions > boom.explosions, `efeito de explosão reusado (${after.explosions})`);

await page.evaluate((t) => { window.__docao.time = t; }, after.respawn + 0.05);
await page.waitForFunction(() => window.__docao.gas.find((x) => x.id === 8).phase === 0, null, { timeout: 8000 });
const back = await page.evaluate(() => { const c = window.__docao.gas.find((x) => x.id === 8); return { phase: c.phase, hp: c.hp }; });
ok(back.phase === 0 && back.hp === 100, `respawn inteiro (${back.hp} hp)`);
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/04-cilindro-respawn.png` });

if (errors.length) console.log('erros de página:', errors.slice(0, 8).join('\n'));
ok(errors.length === 0, `sem erro no console (${errors.length})`);
await browser.close();
if (fails.length) { console.log('FALHOU', fails.length); process.exit(1); }
console.log('visual ok');

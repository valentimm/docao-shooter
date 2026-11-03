// Borda do Morro: anda, pula e salta do telhado em cada lado. Não sai do platô.
// Uso: SITE=http://127.0.0.1:8123 CHROME=/usr/local/bin/google-chrome node test-borda-browser.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SITE = process.env.SITE || 'http://127.0.0.1:8123/';
const OUT = process.env.OUT || '/opt/cursor/artifacts/borda';
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
await page.goto(SITE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__docao && window.__docao.state === 'menu', null, { timeout: 20000 });

async function place(x, z, yHint, yaw, pitch) {
  return page.evaluate(({ x, z, yHint, yaw, pitch }) => {
    const g = window.__docao, p = g.player;
    const y = g.groundAt(x, z, yHint);
    p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.onGround = true; p.alive = true; p.hp = 100;
    p.yaw = yaw; p.pitch = pitch;
    return { x: p.pos.x, y: +p.pos.y.toFixed(2), z: p.pos.z };
  }, { x, z, yHint, yaw, pitch });
}
async function shove(vx, vy, vz, ms = 700) {
  await page.evaluate(({ vx, vy, vz }) => {
    const p = window.__docao.player;
    p.vel.set(vx, vy, vz); p.onGround = vy <= 0;
  }, { vx, vy, vz });
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const p = window.__docao.player;
    return { x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2) };
  });
}
const held = (p, y0) => p.x > -30.2 && p.x < 30.2 && p.z > -28.05 && p.z < 24.35 && p.y > y0 - 4;

await page.evaluate(() => {
  document.getElementById('modeSel').value = 'explore';
  window.__docao.startGame('morro-leitao');
  const hud = document.getElementById('hud'); if (hud) hud.style.opacity = '0.92';
});
await page.waitForTimeout(1800);

// Norte: mureta do topo. Anda e pula.
await place(4.2, 20.5, 14, Math.PI, -0.32);
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/01-norte-mureta.png` });
let p = await shove(0, 0, 7, 600);
ok(held(p, 10), `andar pro norte para na mureta (${p.x}, ${p.y}, ${p.z})`);
await place(5.5, 21.8, 14, Math.PI, -0.05);
p = await shove(0, 8.5, 7, 900);
ok(held(p, 8) && p.z < 24.3, `pulo no norte não sai (${p.x}, ${p.y}, ${p.z})`);
await page.screenshot({ path: `${OUT}/02-norte-depois-do-pulo.png` });

// Telhado do topo, salto por cima da mureta.
await place(-26, 21.1, 18, Math.PI, -0.18);
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/03-telhado-antes.png` });
p = await shove(0, 8.5, 9, 1100);
ok(held(p, 8) && p.z < 24.35, `salto do telhado pro norte fica no morro (${p.x}, ${p.y}, ${p.z})`);
await page.screenshot({ path: `${OUT}/04-telhado-norte.png` });

// Oeste: grade do campinho.
await place(-26.4, 12.2, 8, Math.PI / 2, -0.14);
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/05-oeste-grade.png` });
p = await shove(-8, 0, 0, 700);
ok(held(p, 4) && p.x > -30.2, `andar pro oeste para na grade (${p.x}, ${p.y}, ${p.z})`);
await place(-27.4, 10.5, 8, -Math.PI / 2, 0);
p = await shove(-8, 8.5, 0, 900);
ok(held(p, 3) && p.x > -30.25, `pulo no oeste não cai (${p.x}, ${p.y}, ${p.z})`);

// Telhado oeste.
await place(-26.2, 20.2, 16, -Math.PI / 2, -0.1);
p = await shove(-9, 8.5, 0, 1000);
ok(held(p, 8) && p.x > -30.25, `salto do telhado oeste fica no morro (${p.x}, ${p.y}, ${p.z})`);
await page.screenshot({ path: `${OUT}/06-telhado-oeste.png` });

// Leste.
await place(26.4, 12.2, 8, -Math.PI / 2, -0.14);
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/07-leste-grade.png` });
p = await shove(8, 8.5, 0, 900);
ok(held(p, 3) && p.x < 30.25, `pulo no leste não cai (${p.x}, ${p.y}, ${p.z})`);
await place(26.2, 20.4, 16, Math.PI / 2, -0.08);
p = await shove(9, 8.5, 0, 1000);
ok(held(p, 8) && p.x < 30.25, `salto do telhado leste fica no morro (${p.x}, ${p.y}, ${p.z})`);

// Sul: muro entre as escadas, e o vão da escada continua aberto.
await place(-22.2, -24.4, 3, 0, -0.32);
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/08-sul-muro.png` });
p = await shove(0, 8.5, -8, 900);
ok(held(p, -1) && p.z > -28.05, `pulo no sul não sai (${p.x}, ${p.y}, ${p.z})`);
await place(-27.15, -26.2, 3, Math.PI, -0.22);
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/09-sul-escada-aberta.png` });
const stair = await page.evaluate(() => {
  const g = window.__docao, p = g.player;
  p.pos.set(-27.2, g.groundAt(-27.2, -27.2, 2), -27.2);
  p.vel.set(0, 0, 4); p.onGround = true;
  return true;
});
await page.waitForTimeout(900);
const climbed = await page.evaluate(() => ({ y: +window.__docao.player.pos.y.toFixed(2), z: +window.__docao.player.pos.z.toFixed(2) }));
ok(climbed.z > -27.2 || climbed.y > 0.3, `a escada do sul ainda sobe (${climbed.y} m, z ${climbed.z})`);

// Rua, ponta oeste.
await place(-26.8, -13.5, 2, Math.PI / 2, -0.08);
p = await shove(-8, 6, 0, 800);
ok(held(p, -1) && p.x > -30.3, `ponta oeste da rua segura (${p.x}, ${p.y}, ${p.z})`);
await page.screenshot({ path: `${OUT}/10-rua-oeste.png` });

ok(errors.length === 0, `sem erro de página (${errors.slice(0, 3).join(' | ')})`);
await browser.close();
if (fails.length) { console.log('FALHOU', fails.length); process.exit(1); }
console.log('bordas ok');

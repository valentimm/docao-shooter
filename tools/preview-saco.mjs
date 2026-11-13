// Preview do Saco de Presentes: 1ª pessoa segurando o saco, presente no ar e explosão festiva.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SITE = process.env.SITE || 'http://127.0.0.1:8123/';
const OUT = process.env.OUT || '/workspace';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('cons', m.text()); });
await page.addInitScript(() => { localStorage.setItem('docao.primary', '28'); });
await page.goto(SITE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__docao && window.__docao.startGame, null, { timeout: 120000, polling: 250 });
const G = (fn, a) => page.evaluate(fn, a);
const waitGame = async (sec) => { const t0 = await G(() => window.__docao.time); await page.waitForFunction((t) => window.__docao.time >= t, t0 + sec, { timeout: 180000, polling: 50 }); };
const freezeAt = async (t) => {
  await G((t) => { window.__stopAt = t; }, t);
  await page.waitForFunction((t) => window.__docao.time >= t - 1e-3, t, { timeout: 60000, polling: 30 }).catch(() => {});
  await page.waitForTimeout(180);
};

await G(() => {
  const g = window.__docao;
  g.startGame('arena');
  for (const e of g.entities) if (!e.isPlayer) { e.frozen = true; e.pos.set(999, -50, 999); }
  g.player.invulnUntil = g.time + 9999;
  g.setWeaponOf(g.player, 28);
});
await waitGame(0.8);

// procura um corredor livre de ~12 m e posiciona o jogador olhando pra ele
const aim = await G(() => {
  const g = window.__docao, p = g.player;
  const eyeY = 1.6;
  let best = null;
  for (let k = 0; k < 32; k++) {
    const yaw = k / 32 * Math.PI * 2;
    const d = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    let reach = 0;
    for (let s = 1; s <= 16; s++) {
      const o = { x: p.pos.x, y: p.pos.y + eyeY, z: p.pos.z };
      const t = { x: p.pos.x + d.x * s, y: p.pos.y + eyeY, z: p.pos.z + d.z * s };
      if (g.los && !g.los([o.x, o.y, o.z], [t.x, t.y, t.z])) break;
      reach = s;
    }
    // prefere uma parede a 7–10 m, pra caixa voar grande na tela
    const score = reach >= 7 && reach <= 10 ? 100 - Math.abs(8 - reach) : reach;
    if (!best || score > best.score) best = { yaw, reach, score };
  }
  p.yaw = best.yaw;
  p.pitch = -0.04;
  return best;
});
console.log('aim', JSON.stringify(aim));
await waitGame(0.35);
const held = await G(() => ({ w: window.__docao.player.weapon, vis: window.__docao.fpGift && window.__docao.fpGift().vis, mag: window.__docao.player.mag[28] }));
console.log('held', JSON.stringify(held));
await page.screenshot({ path: `${OUT}/saco-de-presentes-fp.png` });
console.log(`${OUT}/saco-de-presentes-fp.png`);



// taca um presente um pouco pra cima, no corredor livre, e congela no meio do arco
await G(() => {
  const g = window.__docao, p = g.player;
  p.pitch = -0.12;
  const cy = Math.cos(p.pitch), d = [-Math.sin(p.yaw) * cy, Math.sin(-p.pitch) + 0.18, -Math.cos(p.yaw) * cy];
  const L = Math.hypot(...d) || 1;
  const o = [p.pos.x, p.pos.y + 1.55, p.pos.z];
  g.giftAt(o, [d[0] / L, d[1] / L, d[2] / L]);
});
await page.waitForFunction(() => window.__docao.gifts && window.__docao.gifts.length > 0, null, { timeout: 8000, polling: 20 });
const tShot = await G(() => window.__docao.time);
await freezeAt(tShot + 0.22);
const mid = await G(() => {
  const g = window.__docao.gifts[0];
  return g ? { n: window.__docao.gifts.length, t: +g.t.toFixed(3), y: +g.pos.y.toFixed(2), dead: !!g.dead } : { n: 0 };
});
console.log('mid-air', JSON.stringify(mid));
await page.screenshot({ path: `${OUT}/saco-de-presentes-ar.png` });
console.log(`${OUT}/saco-de-presentes-ar.png`);

await G(() => { window.__stopAt = null; });
await page.waitForFunction(() => !window.__docao.gifts.length, null, { timeout: 20000, polling: 30 });
const tBoom = await G(() => window.__docao.time);
await freezeAt(tBoom + 0.28);
await page.screenshot({ path: `${OUT}/saco-de-presentes-explosao.png` });
console.log(`${OUT}/saco-de-presentes-explosao.png`);

await browser.close();

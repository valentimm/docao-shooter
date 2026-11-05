// Prints desktop do Survival no Hotmilk à Noite: trajetos reais no cliente.
// Uso: SITE=http://127.0.0.1:8124/ node tools/shot-zombie-nav.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SITE = process.env.SITE || 'http://127.0.0.1:8124/';
const OUT = process.env.OUT || '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE', e.message));
await page.goto(SITE, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  document.getElementById('modeSel').value = 'inv';
  document.getElementById('survSel').value = 'survival';
  window.__docao.startGame('hotmilk-noite');
});
await page.waitForTimeout(800);
const booted = await page.evaluate(() => {
  const g = window.__docao;
  return { map: g.map && g.map.id, surv: g.survOn, inv: !!(g.inv && g.inv.A && g.inv.A.survival), state: g.state };
});
console.log('boot', booted);
if (!booted.surv || booted.map !== 'hotmilk-noite') { console.log('falha ao abrir o Survival'); await browser.close(); process.exit(1); }

async function runScene(name, setup, frame = {}) {
  const trail = await page.evaluate(async (setupSrc) => {
    const g = window.__docao;
    const fn = new Function('g', setupSrc);
    const spec = fn(g);
    const I = g.inv;
    I.phase = 'wave';
    I.zombies.forEach((z) => { z.alive = false; });
    I.queue = []; I.bossPending = false;
    for (const e of g.entities) if (e.zt) e.alive = false;
    const p = g.player;
    p.alive = true; p.hp = 100; p.ghostUntil = 0;
    p.pos.set(spec.px, g.groundAt(spec.px, spec.pz, (spec.py || 0) + 0.4), spec.pz);
    const z = I.spawn('walker') || g.entities.find((e) => e.zt);
    if (!z) return { error: 'sem zumbi' };
    z.alive = true;
    z.pos.set(spec.zx, g.groundAt(spec.zx, spec.zz, (spec.zy || 0) + 0.4), spec.zz);
    z.vel.set(0, 0, 0); z.node = null; z.route = null; z.routeGen = -1; z.repathAt = 0;
    const samples = [];
    const t0 = g.time;
    const frames = Math.round((spec.sec || 10) * 30);
    for (let i = 0; i < frames; i++) {
      g.time += 1 / 30;
      I.step(1 / 30);
      if (i % 3 === 0) samples.push([+z.pos.x.toFixed(2), +z.pos.y.toFixed(2), +z.pos.z.toFixed(2)]);
      if (spec.moveAt && g.time - t0 > spec.moveAt && !spec._moved) {
        p.pos.set(spec.mx, g.groundAt(spec.mx, spec.mz, 1), spec.mz);
        spec._moved = true;
      }
    }
    if (spec.vx != null) p.pos.set(spec.vx, g.groundAt(spec.vx, spec.vz, (spec.vy || 0) + 0.4), spec.vz);
    const face = Math.atan2(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
    p.yaw = face; p.pitch = 0.08;
    if (p.model) p.model.group.position.copy(p.pos);
    const endDist = Math.hypot(z.pos.x - (spec._moved ? spec.mx : spec.px), z.pos.z - (spec._moved ? spec.mz : spec.pz));
    return {
      samples, end: [z.pos.x, z.pos.y, z.pos.z], player: [spec.px, spec.py || p.pos.y, spec.pz],
      dist: endDist, state: z.aiState || '',
    };
  }, setup);
  console.log(name, JSON.stringify({ dist: trail.dist, end: trail.end, n: trail.samples && trail.samples.length, state: trail.state }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-vista.png` });
  Object.assign(trail, frame);
  await page.evaluate((pack) => {
    let c = document.getElementById('navshot');
    if (!c) { c = document.createElement('canvas'); c.id = 'navshot'; c.width = 1440; c.height = 900; c.style.cssText = 'position:fixed;inset:0;z-index:50;background:#10141c'; document.body.appendChild(c); }
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#10141c'; ctx.fillRect(0, 0, 1440, 900);
    const g = window.__docao;
    const box = pack.box;
    const pad = 36;
    const sx = (x) => pad + (x - box[0]) / (box[2] - box[0]) * (1440 - pad * 2);
    const sz = (z) => pad + (z - box[1]) / (box[3] - box[1]) * (900 - pad * 2);
    ctx.fillStyle = '#1c2433';
    const y0 = pack.y0 == null ? 0.35 : pack.y0, y1 = pack.y1 == null ? 2.4 : pack.y1;
    for (const s of g.solids) {
      if (s.max.y < y0 || s.min.y > y1) continue;
      if (s.max.x < box[0] || s.min.x > box[2] || s.max.z < box[1] || s.min.z > box[3]) continue;
      ctx.fillRect(sx(s.min.x), sz(s.min.z), sx(s.max.x) - sx(s.min.x), sz(s.max.z) - sz(s.min.z));
    }
    ctx.strokeStyle = '#ffb45a'; ctx.lineWidth = 4; ctx.beginPath();
    pack.samples.forEach((p, i) => { const x = sx(p[0]), y = sz(p[2]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    const a = pack.samples[0], b = pack.samples[pack.samples.length - 1];
    ctx.fillStyle = '#7dff9a'; ctx.beginPath(); ctx.arc(sx(pack.player[0]), sz(pack.player[2]), 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(sx(a[0]), sz(a[2]), 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(sx(b[0]), sz(b[2]), 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#f4efe4'; ctx.font = '28px sans-serif';
    ctx.fillText(pack.title, 48, 64);
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#c9d4e8';
    ctx.fillText(pack.note, 48, 96);
  }, { ...trail, title: name, note: trail.dist != null ? `distância final ${trail.dist.toFixed(2)} m · ${trail.samples.length} amostras · estado ${trail.state}` : 'sem trilha', box: trail.box || [-30, 8, 30, 48], y0: trail.y0, y1: trail.y1 });
  await page.screenshot({ path: `${OUT}/${name}-trajeto.png` });
  await page.evaluate(() => { const c = document.getElementById('navshot'); if (c) c.remove(); });
  return trail;
}

await runScene('01-parede-L-escada', `
  return { px: -10, pz: 37, zx: 10, zz: 37, sec: 12 };
`);
await runScene('02-porta-cozinha-fechada', `
  return { px: -22, pz: 24.9, zx: -8, zz: 24.9, sec: 8, vx: -10, vz: 24.9 };
`);
const opened = await page.evaluate(() => {
  const g = window.__docao;
  const door = g.map.survival.doors.find((d) => d.id === 'porta-escada');
  const before = g.player.points | 0;
  g.player.points = 20000; g.player.pts = 20000; g.player.alive = true;
  g.player.pos.set(door.at[0], door.at[1] || 0, door.at[2]);
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
  return { before, after: g.player.points | 0, at: [g.player.pos.x, g.player.pos.y, g.player.pos.z] };
});
console.log('porta escada', opened);
await runScene('03-corredor-u-andar', `
  return { px: 22, pz: 22, py: 3.4, zx: -22, zz: 22, zy: 3.4, sec: 16 };
`, { box: [-28, 12, 28, 42], y0: 3.2, y1: 6.6 });

await browser.close();
console.log('prints em', OUT);

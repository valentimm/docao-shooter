// Perfil do cliente na Invasão: draw calls / triângulos / luzes / tempo de CPU do render, com N zumbis.
// Uso: node perf/profile-invasao.mjs [map] [N,N,...]   (rodar da raiz do repo)
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
const PORT = Number(process.env.PORT || 8191), SITE = `http://127.0.0.1:${PORT}/`;
const MAP = process.argv[2] || 'hotmilk-noite';
const COUNTS = (process.argv[3] || '0,20,40,60').split(',').map(Number);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
await sleep(800);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.addInitScript((map) => { localStorage.setItem('docao.mode', 'inv'); localStorage.setItem('docao.name', 'Perf'); localStorage.setItem('docao.invMap', map); localStorage.setItem('docao.map', map); }, MAP);
await page.goto(SITE, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__docao && document.getElementById('playBtn'), null, { timeout: 30000 });
await page.click('#playBtn');
await page.waitForFunction(() => window.__docao.state === 'playing' && window.__docao.inv, null, { timeout: 40000 });
await sleep(1500);
const TYPES = ['walker', 'walker', 'runner', 'walker', 'tank', 'spitter', 'runner', 'walker', 'boss'];
const out = [];
for (const n of COUNTS) {
  const r = await page.evaluate(async ({ n, TYPES }) => {
    const D = window.__docao;
    for (const e of D.entities.slice()) if (e.__fake) { e.model.group.parent && e.model.group.parent.remove(e.model.group); D.entities.splice(D.entities.indexOf(e), 1); }
    const p = D.player; p.invulnUntil = 1e9; p.hp = 100;
    // câmera fixa olhando a horda (pior caso: todo mundo na frente): zumbis em leque de 5 a 45 m, determinístico
    const good = D.nav.good, c = good[Math.floor(good.length / 2)]; p.pos.set(c.x, c.y + 0.1, c.z); p.yaw = 0; p.pitch = 0; p.vel.set(0, 0, 0);
    await new Promise((r) => setTimeout(r, 300));
    const fwd = new D.camera.position.constructor(); D.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = { x: -fwd.z, z: fwd.x };
    for (let i = 0; i < n; i++) {
      const z = D.makeZombieEnt(TYPES[i % TYPES.length], null); z.__fake = true; z.id = 90000 + i;
      const dist = 5 + ((i * 37) % 41), lat = (((i * 53) % 21) - 10) * dist * 0.06;
      const x = c.x + fwd.x * dist + right.x * lat, zz = c.z + fwd.z * dist + right.z * lat;
      z.pos.set(x, D.groundAt(x, zz, c.y + 2), zz); z.yaw = Math.PI * (i % 2); D.entities.push(z);
    }
    const R = D.renderer, orig = R.render.bind(R); const scene = D.camera.parent;
    const per = []; let cnt = 0; const rbd = R.renderBufferDirect.bind(R); R.renderBufferDirect = function (...a) { cnt++; return rbd(...a); }; // renderer.info não conta a passada de sombra: conta cada draw direto
    R.render = (a, b) => { cnt = 0; const t0 = performance.now(); orig(a, b); const dt = performance.now() - t0; if (a === scene) per.push({ cpu: dt, draws: cnt, tris: R.info.render.triangles }); };
    await new Promise((r) => setTimeout(r, 1500)); per.length = 0;
    const frames = 60; const t0 = performance.now();
    await new Promise((res) => { let f = 0; const step = () => { f++; if (f < frames) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    const wall = (performance.now() - t0) / frames;
    let sun = null; scene.traverse((o) => { if (o.isDirectionalLight) sun = o; }); sun.castShadow = false; const noSh = []; R.render = (a, b) => { cnt = 0; orig(a, b); if (a === scene) noSh.push(cnt); }; await new Promise((r) => setTimeout(r, 1000)); sun.castShadow = true; R.render = orig; R.renderBufferDirect = rbd; noSh.sort((x, y) => x - y);
    const med = (k) => { const a = per.map((x) => x[k]).sort((u, v) => u - v); return a[Math.floor(a.length / 2)]; };
    let lights = 0, meshes = 0, casters = 0, vis = 0; const mats = new Set();
    scene.traverse((o) => { if (o.isLight) lights++; if (o.isMesh) { meshes++; if (o.castShadow) casters++; if (o.visible) vis++; mats.add(o.material); } });
    return { n, wallMs: +wall.toFixed(1), renderCpuMsMed: +med('cpu').toFixed(2), drawsMed: med('draws'), shadowDraws: med('draws') - noSh[Math.floor(noSh.length / 2)], trisMed: med('tris'), samples: per.length, geos: R.info.memory.geometries, programs: R.info.programs.length, lights, meshes, visibleMeshes: vis, casters, materials: mats.size };
  }, { n, TYPES });
  console.log(JSON.stringify(r)); out.push(r);
}
// custo pontual: spawn de zumbis (wave nova) e FX de morte (dragão/moedas)
const spot = await page.evaluate(async () => {
  const D = window.__docao; const T = (fn, n = 1) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(i); return +((performance.now() - t0) / n).toFixed(2); };
  const kinds = ['walker', 'runner', 'tank', 'spitter', 'boss'];
  const spawn = {}; for (const k of kinds) spawn[k] = T(() => { const e = D.makeZombieEnt(k, null); e.model.group.parent && e.model.group.parent.remove(e.model.group); }, 10);
  const { createDeathSkinFx } = await import('/death-skin-fx.js'); const scene = D.camera.parent; const fx = createDeathSkinFx(scene, () => 0);
  const p = { x: 0, y: 0, z: 0 };
  const dragon1 = T(() => fx.play(p, { dragon: true }), 1), dragon2 = T(() => fx.play(p, { dragon: true }), 3);
  const coins1 = T(() => fx.play(p, { coins: true }), 1), coins2 = T(() => fx.play(p, { coins: true }), 3);
  fx.clear();
  return { spawnMsPerZombie: spawn, dragonFirstMs: dragon1, dragonNextMs: dragon2, coinsFirstMs: coins1, coinsNextMs: coins2 };
});
console.log(JSON.stringify(spot));
await browser.close(); srv.kill();

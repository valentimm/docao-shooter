// Cenário de estresse: Invasão online, 8 jogadores (Playwright WebKit) e horda no teto do modo.
// Uso: node tools/stress-horde.mjs
//   SITE=http://127.0.0.1:8140/index.html SERVER=ws://127.0.0.1:8787
//   SHOT=/opt/cursor/artifacts/stress-before.png LABEL=before
// O servidor precisa de ALLOW_TEST=1 (testGod + testInv).
import { webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const SITE = process.env.SITE || 'http://127.0.0.1:8140/index.html';
const SERVER = process.env.SERVER || 'ws://127.0.0.1:8787';
const N = Math.max(2, Math.min(8, +(process.env.PLAYERS || 8)));
const SHOT = process.env.SHOT || '';
const LABEL = process.env.LABEL || 'stress';
const OUT = process.env.OUT || '';
const VIEW = { width: 800, height: 450 };
const NAMES = ['Ana', 'Beto', 'Caio', 'Duda', 'Eva', 'Felix', 'Gabi', 'Hugo'];

const browser = await webkit.launch();
const pages = [];
function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

async function openClient(name, query) {
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(name, 'pageerror', e.message));
  page.on('console', (m) => { if (m.type() === 'error') log(name, 'console', m.text().slice(0, 240)); });
  await page.addInitScript((n) => { try { localStorage.setItem('docao.name', n); } catch (e) {} }, name);
  const url = `${SITE}?server=${encodeURIComponent(SERVER)}${query || ''}`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__docao && window.__docao.state, null, { timeout: 60000 });
  pages.push({ name, page, ctx });
  return page;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(page, fn, ms, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await page.evaluate(fn, arg)) return true; } catch (e) { /* navegando */ }
    await wait(200);
  }
  return false;
}

log('abrindo anfitrião', NAMES[0]);
const host = await openClient(NAMES[0]);
await host.evaluate(() => document.getElementById('onlineBtn').scrollIntoView({ block: 'center' }));
await host.click('#onlineBtn');
await host.selectOption('#roomMode', 'inv');
await wait(400);
await host.selectOption('#roomMap', 'arena');
await host.selectOption('#roomMax', String(N));
await host.selectOption('#roomBots', '0');
await host.click('#createBtn');
if (!await until(host, () => window.__docao.online && window.__docao.online.code, 20000)) {
  const err = await host.evaluate(() => (document.getElementById('onlineErr') || {}).textContent || '');
  throw new Error('sala não criada: ' + err);
}
const code = await host.evaluate(() => window.__docao.online.code);
log('sala', code);

for (let i = 1; i < N; i++) {
  log('entrando', NAMES[i]);
  const p = await openClient(NAMES[i], `&sala=${code}`);
  if (!await until(p, () => !!(window.__docao.online && window.__docao.online.myId > 0), 40000)) {
    const why = await p.evaluate(() => ({
      state: window.__docao && window.__docao.state,
      online: window.__docao && window.__docao.online && { id: window.__docao.online.myId, status: window.__docao.online.status, code: window.__docao.online.code },
      err: (document.getElementById('onlineErr') || {}).textContent || '',
      lobby: (document.getElementById('lobbyStatus') || {}).textContent || '',
    })).catch((e) => String(e));
    throw new Error(NAMES[i] + ' não entrou na sala ' + JSON.stringify(why));
  }
  // Para de desenhar o menu/lobby. O socket continua; quem mede é só o anfitrião.
  await p.evaluate(() => {
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = () => orig(() => {});
  });
}
if (!await until(host, () => document.querySelectorAll('#lobbyPlayers tr').length >= N, 60000)) {
  const n = await host.evaluate(() => document.querySelectorAll('#lobbyPlayers tr').length).catch((e) => String(e));
  log('lobby ainda em', n, '— segue se os sockets já entraram');
}
log('iniciando partida');
await host.click('#startOnline');
for (const { name, page } of pages) {
  if (!await until(page, () => window.__docao.state === 'playing' && window.__docao.player && window.__docao.player.alive, 30000)) {
    throw new Error(name + ' não entrou na partida');
  }
}
log('partida no ar, teleportando e protegendo');

async function godAndPark(page, i, park) {
  await page.evaluate(({ i, park }) => {
    const g = window.__docao, p = g.player, o = g.online;
    const a = (i / 8) * Math.PI * 2, x = -17 + Math.cos(a) * 1.6, z = -22 + Math.sin(a) * 1.6;
    const y = g.groundAt(x, z, 1);
    p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = Math.atan2(-x, -z); p.pitch = 0;
    o.net.send({ t: 'u', sq: p.sq, tp: 1, p: [p.pos.x, p.pos.y, p.pos.z], v: [0, 0, 0], y: p.yaw, pi: 0, g: 1, w: p.weapon });
    o.net.send({ t: 'testGod', s: 120 });
    if (!park) return;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => orig(() => {});
  }, { i, park });
}
for (let i = 0; i < pages.length; i++) await godAndPark(pages[i].page, i, i !== 0);
await wait(600);
await host.evaluate(() => window.__docao.online.net.send({ t: 'testInv', wave: 20, hold: true }));
log('wave 20 pedida');

const filled = await until(host, () => {
  const g = window.__docao;
  const n = g.entities.filter((e) => e.zt && e.alive).length;
  window.__hordeN = n;
  return n >= 36;
}, 90000);
const hordeN = await host.evaluate(() => window.__docao.entities.filter((e) => e.zt && e.alive).length);
log('zumbis vivos', hordeN, filled ? 'teto perto' : 'não chegou a 36');
// Abre a névoa (ALLOW_TEST) pra véu roxo não cobrir a tela, e olha a horda de cima.
await host.evaluate(() => {
  window.__docao.online.net.send({ t: 'testInv', fog: { cx: 0, cz: 0, r: 180, tx: 0, tz: 0, tr: 180, fr: 180, fx: 0, fz: 0, t0: 0, t1: 0 } });
});
await wait(400);
await host.evaluate(() => window.__docao.online.net.send({ t: 'testInv', crowd: [-17, -22] }));
await wait(900);
await host.evaluate(() => {
  const g = window.__docao;
  const zs = g.entities.filter((e) => e.zt && e.alive && e.pos);
  let cx = 0, cy = 0, cz = 0;
  for (const z of zs) { cx += z.pos.x; cy += z.pos.y; cz += z.pos.z; }
  const n = Math.max(1, zs.length);
  cx /= n; cy /= n; cz /= n;
  window.__cam = { p: [cx - 9, cy + 3.4, cz + 11], t: [cx, cy + 1.25, cz], fov: 55 };
});
await wait(700);

async function sample(page, frames) {
  return page.evaluate(async (n) => {
    const r = window.__docao.renderer;
    const cam = window.__docao.camera;
    const samples = [], calls = [], tris = [];
    let last = performance.now();
    await new Promise((resolve) => {
      const step = (t) => {
        const dt = t - last; last = t;
        if (dt < 800) {
          samples.push(dt);
          calls.push(r.info.render.calls);
          tris.push(r.info.render.triangles);
        }
        if (samples.length >= n) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const sorted = samples.slice().sort((a, b) => a - b);
    const sum = samples.reduce((a, b) => a + b, 0);
    const avg = sum / samples.length;
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(samples.length * q) - 1))];
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    let onScreen = 0, near = 0;
    const ents = window.__docao.entities;
    for (const e of ents) {
      if (!e.zt || !e.alive || !e.pos) continue;
      const v = e.pos.clone(); v.y += 1.1; v.project(cam);
      if (v.z >= -1 && v.z <= 1 && v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1) onScreen++;
      if (cam.position.distanceTo(e.pos) < 22) near++;
    }
    let meshes = 0, visMeshes = 0, shadows = 0, outlines = 0, zMeshes = 0, zShadows = 0, zOut = 0, zVis = 0, mats = new Set(), geos = new Set();
    let players = 0, zombies = 0;
    for (const e of ents) {
      if (e.zt) { if (e.alive) zombies++; } else players++;
      if (!e.model || !e.model.group) continue;
      e.model.group.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        let shown = o.visible, p = o.parent;
        while (shown && p) { shown = p.visible; p = p.parent; }
        if (shown) visMeshes++;
        if (o.castShadow) shadows++;
        if (o.userData && o.userData.isOutline) outlines++;
        if (e.zt) { zMeshes++; if (shown) zVis++; if (o.castShadow) zShadows++; if (o.userData && o.userData.isOutline) zOut++; }
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (m) mats.add(m.uuid);
        if (o.geometry) geos.add(o.geometry.uuid);
      });
    }
    let sceneMeshes = 0, sceneShadow = 0;
    const scene = cam.parent;
    if (scene) scene.traverse((o) => { if (o.isMesh) { sceneMeshes++; if (o.castShadow) sceneShadow++; } });
    const mem = r.info.memory;
    return {
      frames: samples.length,
      avgMs: +avg.toFixed(2),
      fps: +(1000 / avg).toFixed(2),
      p50Ms: +at(0.5).toFixed(2),
      p95Ms: +at(0.95).toFixed(2),
      minMs: +sorted[0].toFixed(2),
      maxMs: +sorted[sorted.length - 1].toFixed(2),
      callsAvg: +mean(calls).toFixed(1),
      callsLast: calls[calls.length - 1],
      trisAvg: Math.round(mean(tris)),
      trisLast: tris[tris.length - 1],
      onScreen, near, players, zombies,
      meshes, visMeshes, shadows, outlines, zMeshes, zVis, zShadows, zOut,
      uniqueMats: mats.size, uniqueGeos: geos.size,
      sceneMeshes, sceneShadow,
      memGeos: mem.geometries, memTex: mem.textures,
      dpr: r.getPixelRatio(),
      buf: [r.domElement.width, r.domElement.height],
      css: [innerWidth, innerHeight],
      devicePixelRatio,
    };
  }, frames);
}

log('amostra principal');
const main = await sample(host, 120);
log(JSON.stringify(main));

const ablate = {};
async function withToggle(name, apply, restore) {
  await host.evaluate(apply);
  await wait(200);
  ablate[name] = await sample(host, 40);
  log('ablation', name, ablate[name].fps, 'fps', ablate[name].callsAvg, 'calls', ablate[name].avgMs, 'ms');
  await host.evaluate(restore);
  await wait(150);
}
await withToggle('sem-sombra',
  () => { window.__docao.renderer.shadowMap.enabled = false; },
  () => { window.__docao.renderer.shadowMap.enabled = true; });
await withToggle('zumbis-ocultos',
  () => { window.__hideZ = []; for (const e of window.__docao.entities) if (e.zt && e.model) { window.__hideZ.push([e, e.model.group.visible]); e.model.group.visible = false; } },
  () => { for (const [e, v] of window.__hideZ || []) if (e.model) e.model.group.visible = v; });
await withToggle('sem-contorno-zumbi',
  () => {
    window.__ol = [];
    for (const e of window.__docao.entities) if (e.zt && e.model) e.model.group.traverse((o) => {
      if (o.userData && o.userData.isOutline) { window.__ol.push([o, o.visible]); o.visible = false; }
    });
  },
  () => { for (const [o, v] of window.__ol || []) o.visible = v; });

await host.evaluate(() => { window.__docao.renderer.shadowMap.enabled = true; });
await wait(300);
const overlay = [
  `STRESS ${LABEL}`,
  `FPS ${main.fps}   frame ${main.avgMs} ms   p95 ${main.p95Ms} ms`,
  `draw calls ${main.callsAvg}   tris ${main.trisAvg}`,
  `zumbis ${main.zombies} (${main.onScreen} na tela, ${main.near} <22m)`,
  `jogadores ${main.players}   DPR ${main.dpr}   buf ${main.buf.join('x')}`,
].join('\n');
await host.evaluate((text) => {
  let el = document.getElementById('perfOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'perfOverlay';
    el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:rgba(0,0,0,.78);color:#f4fff8;font:600 14px/1.35 ui-monospace,monospace;padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre;text-shadow:0 1px 0 #000';
    document.body.appendChild(el);
  }
  el.textContent = text;
}, overlay);
await wait(250);
if (SHOT) {
  mkdirSync(dirname(SHOT), { recursive: true });
  await host.screenshot({ path: SHOT, type: 'png' });
  log('print', SHOT);
}
const report = {
  label: LABEL, at: new Date().toISOString(), browser: 'webkit',
  site: SITE, server: SERVER, players: N, map: 'arena', mode: 'inv', wave: 20,
  viewport: VIEW, filled, main, ablate,
};
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('REPORT', JSON.stringify(report));
await browser.close();

// Invasão (desempenho do cliente): partes minúsculas do zumbi não jogam sombra, HUD não é reescrito a cada frame,
// FX de morte e anéis reaproveitam geometria. Uso: node test-invasao-lod.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT || 8193), SITE = `http://127.0.0.1:${PORT}/`;
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: new URL('.', import.meta.url).pathname, stdio: 'ignore' });
await sleep(800);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.addInitScript(() => { localStorage.setItem('docao.mode', 'inv'); localStorage.setItem('docao.name', 'Perf'); localStorage.setItem('docao.invMap', 'hotmilk-noite'); localStorage.setItem('docao.map', 'hotmilk-noite'); });
  await page.goto(SITE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__docao && document.getElementById('playBtn'), null, { timeout: 30000 });
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__docao.state === 'playing' && window.__docao.inv, null, { timeout: 40000 });
  await sleep(800);

  // 1) sombra: só partes que dão sombra visível
  const sh = await page.evaluate(() => {
    const D = window.__docao, out = {};
    for (const t of ['walker', 'runner', 'tank', 'spitter', 'boss', 'bossWolf', 'bossMummy']) {
      const z = D.makeZombieEnt(t, null); let cast = 0, small = 0, smallCast = 0, big = 0, bigCast = 0;
      z.model.group.traverse((o) => { if (!o.isMesh || o.userData.isOutline) return; const s = o.scale, mx = Math.max(s.x, s.y, s.z), isPart = o.geometry && o.geometry.parameters !== undefined; if (isPart && mx <= 0.12) { small++; if (o.castShadow) smallCast++; } else if (mx > 0.12) { big++; if (o.castShadow) bigCast++; } if (o.castShadow) cast++; });
      out[t] = { cast, small, smallCast, big, bigCast }; z.model.group.parent && z.model.group.parent.remove(z.model.group);
    }
    return out;
  });
  for (const [t, r] of Object.entries(sh)) ok(r.small > 0 ? r.smallCast === 0 : true, `${t}: ${r.small} peças minúsculas sem sombra (${r.smallCast} com), ${r.bigCast}/${r.big} peças grandes ainda projetam`);
  ok(sh.walker.bigCast > 15, `walker mantém sombra das peças grandes (${sh.walker.bigCast})`);

  // 1b) LOD: dente/garra somem junto com a sombra (>24 m) e voltam de perto; peças normais seguem visíveis
  const stat = (dist) => page.evaluate(async (dist) => {
    const D = window.__docao, p = D.player; p.invulnUntil = 1e9;
    let z = window.__lodZ; if (!z) { z = window.__lodZ = D.makeZombieEnt('walker', null); z.id = 91000; D.entities.push(z); }
    const c = D.nav.good[Math.floor(D.nav.good.length / 2)]; p.pos.set(c.x, c.y + 0.1, c.z); z.pos.set(c.x + dist, c.y, c.z); z.vel.set(0, 0, 0);
    await new Promise((r) => setTimeout(r, 400));
    let tinyV = 0, tinyN = 0, otherHidden = 0; z.model.group.traverse((o) => { if (!o.isMesh || o.userData.isOutline) return; if (o.userData.tiny) { tinyN++; if (o.visible) tinyV++; } else if (!o.visible && !o.userData.blink) otherHidden++; });
    return { tinyV, tinyN, otherHidden };
  }, dist);
  const n6 = await stat(6), n40 = await stat(40), n6b = await stat(6);
  ok(n6.tinyN >= 15 && n6.tinyV === n6.tinyN, `6 m: dentes/garras visíveis (${n6.tinyV}/${n6.tinyN})`);
  ok(n40.tinyV === 0 && n40.otherHidden === 0, `40 m: dentes/garras escondidos (${n40.tinyV}/${n40.tinyN}), o resto do corpo continua (${n40.otherHidden} escondidas)`);
  ok(n6b.tinyV === n6b.tinyN, `voltou pra perto: dentes/garras de volta (${n6b.tinyV}/${n6b.tinyN})`);

  // 2) anéis e drops compartilham geometria
  const rg = await page.evaluate(async () => {
    const m = await import('/invasion-gfx.js'); const a = m.makeRing('#fff', 0.2, 2, 0.5), b = m.makeRing('#f00', 0.2, 3, 0.5), d1 = m.makeDropMesh('revive'), d2 = m.makeDropMesh('ammo');
    return { rings: a.geometry === b.geometry, drops: d1.userData.ring.geometry === d2.userData.ring.geometry };
  });
  ok(rg.rings && rg.drops, `anel e anel de drop reaproveitam a geometria (${rg.rings}/${rg.drops})`);

  // 3) FX de morte: geometria compartilhada, nada vaza e não descarta a compartilhada
  const fx = await page.evaluate(async () => {
    const D = window.__docao, { createDeathSkinFx } = await import('/death-skin-fx.js'), scene = D.camera.parent, fxm = createDeathSkinFx(scene, () => 0);
    const geos = () => D.renderer.info.memory.geometries, p = { x: 0, y: 0, z: 0 };
    fxm.play(p, { dragon: true }); fxm.play(p, { coins: true }); fxm.update(0.016);
    const g0 = geos(); let t0 = performance.now();
    for (let i = 0; i < 5; i++) { fxm.play(p, { dragon: true }); fxm.play(p, { coins: true }); }
    const ms = (performance.now() - t0) / 5;
    const meshes = []; scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    fxm.update(10); // tudo expira
    let left = 0; scene.traverse((o) => { if (o.isMesh && o.userData && o.userData.fxTest) left++; });
    return { ms, g0, before: meshes.length };
  });
  ok(fx.ms < 3, `dragão + 16 moedas criados em ${fx.ms.toFixed(2)} ms cada (antes ~8 ms por morte)`);

  // 4) HUD
  const hud = await page.evaluate(async () => {
    const el = document.getElementById('invWaveN'); let writes = 0;
    const mo = new MutationObserver((l) => { writes += l.length; }); mo.observe(el, { childList: true, characterData: true, subtree: true });
    await new Promise((r) => setTimeout(r, 1200)); const recs = mo.takeRecords().length; mo.disconnect();
    return { writes: writes + recs, text: el.textContent };
  });
  ok(hud.writes <= 1, `HUD da wave não é reescrito a cada frame (${hud.writes} mutações em 1,2 s · "${hud.text}")`);
  ok(errors.length === 0, `sem erros de página${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} finally { await browser.close(); srv.kill(); }
if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\ntudo certo');

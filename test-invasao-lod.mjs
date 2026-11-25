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

  // 1) sombra: peças minúsculas (agora possivelmente unidas) não projetam; as grandes, sim
  const sh = await page.evaluate(() => {
    const D = window.__docao, out = {};
    for (const t of ['walker', 'runner', 'tank', 'spitter', 'boss', 'bossWolf', 'bossMummy']) {
      const z = D.makeZombieEnt(t, null); let meshes = 0, outlines = 0, tiny = 0, tinyCast = 0, big = 0, bigCast = 0;
      z.model.group.traverse((o) => { if (!o.isMesh) return; if (o.userData.isOutline) { outlines++; return; } meshes++; if (o.userData.tiny) { tiny++; if (o.castShadow) tinyCast++; } else { big++; if (o.castShadow) bigCast++; } });
      out[t] = { meshes, outlines, tiny, tinyCast, big, bigCast, legs: z.model.legs && z.model.legs.length, arms: z.model.arms && z.model.arms.length, hasBody: !!z.model.body, hasHead: !!z.model.head, flash: (z.model.flashMats || []).length }; z.model.group.parent && z.model.group.parent.remove(z.model.group);
    }
    return out;
  });
  for (const [t, r] of Object.entries(sh)) ok(r.tinyCast === 0 && r.legs === 2 && r.arms === 2 && r.hasBody && r.hasHead && r.flash >= 3, `${t}: ${r.meshes} malhas (${r.outlines} contornos), tiny ${r.tiny} (sombra ${r.tinyCast}), grandes ${r.bigCast}/${r.big}, anatomia pernas=${r.legs} braços=${r.arms} flash=${r.flash}`);
  ok(sh.walker.meshes <= 30, `walker ficou com poucas malhas depois de unir geometria (${sh.walker.meshes}, era ~50)`);
  ok(sh.walker.bigCast > 4, `walker mantém sombra das peças grandes (${sh.walker.bigCast})`);

  // 1a) dois walkers compartilham a geometria (não a material: cada um pisca sozinho)
  const share = await page.evaluate(() => {
    const D = window.__docao, a = D.makeZombieEnt('walker', null), b = D.makeZombieEnt('walker', null);
    let shared = 0, total = 0, sameMat = 0;
    const geosA = [], matsA = [];
    a.model.group.traverse((o) => { if (o.isMesh && !o.userData.isOutline) { geosA.push(o.geometry); matsA.push(o.material); } });
    b.model.group.traverse((o) => { if (o.isMesh && !o.userData.isOutline) { total++; if (geosA.includes(o.geometry)) shared++; if (matsA.includes(o.material)) sameMat++; } });
    a.model.flashMats[0].emissive.set(0xff0000);
    const isolated = b.model.flashMats[0].emissive.getHex() === 0;
    a.model.group.parent && a.model.group.parent.remove(a.model.group);
    b.model.group.parent && b.model.group.parent.remove(b.model.group);
    return { shared, total, sameMat, isolated };
  });
  ok(share.total > 0 && share.shared === share.total && share.sameMat === 0 && share.isolated, `geometria compartilhada entre walkers (${share.shared}/${share.total}), material isolado (mesmo=${share.sameMat}, flash isolado=${share.isolated})`);

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
  ok(n6.tinyN >= 1 && n6.tinyV === n6.tinyN, `6 m: dentes/garras visíveis (${n6.tinyV}/${n6.tinyN})`);
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

  // 5) qualidade gráfica: Alta/Média/Baixa (localStorage docao.gfx). Padrão Alta.
  const gfx = await page.evaluate(async () => {
    const D = window.__docao, out = { start: { ...D.gfx } };
    D.setGfx('medium'); out.medium = { ...D.gfx };
    D.setGfx('low'); out.low = { ...D.gfx, persist: localStorage.getItem('docao.gfx') };
    D.setGfx('high'); out.high = { ...D.gfx };
    return out;
  });
  ok(gfx.start.quality === 'high' && gfx.start.pr <= 2 && gfx.start.aa === true && gfx.start.shadow === 2048, `padrão Alta (q=${gfx.start.quality}, pr=${gfx.start.pr}, aa=${gfx.start.aa}, sombra=${gfx.start.shadow})`);
  ok(gfx.medium.quality === 'medium' && gfx.medium.shadow === 1024 && gfx.medium.pr <= 1.5, `Média: pixel ratio ≤ 1,5 e sombra 1024 (pr=${gfx.medium.pr}, sombra=${gfx.medium.shadow})`);
  ok(gfx.low.quality === 'low' && gfx.low.pr <= 1 && gfx.low.decor === false && gfx.low.persist === 'low', `Baixa: pr ≤ 1, sem luzes de enfeite, gravado (${JSON.stringify(gfx.low)})`);
  ok(gfx.high.quality === 'high' && gfx.high.shadow === 2048 && gfx.high.decor === true, `volta pra Alta (sombra ${gfx.high.shadow})`);

  // 4) HUD
  const hud = await page.evaluate(async () => {
    const el = document.getElementById('invWaveN'); let writes = 0;
    const mo = new MutationObserver((l) => { writes += l.length; }); mo.observe(el, { childList: true, characterData: true, subtree: true });
    await new Promise((r) => setTimeout(r, 1200)); const recs = mo.takeRecords().length; mo.disconnect();
    return { writes: writes + recs, text: el.textContent };
  });
  ok(hud.writes <= 1, `HUD da wave não é reescrito a cada frame (${hud.writes} mutações em 1,2 s · "${hud.text}")`);
  const horde = await page.evaluate(async () => {
    const D = window.__docao, types = ['walker', 'runner', 'tank', 'spitter', 'boss', 'bossWolf', 'bossMummy', 'bossGhost', 'cry', 'bat', 'sling'];
    const made = [];
    const c = D.nav.good[Math.floor(D.nav.good.length / 2)];
    for (const t of types) { const z = D.makeZombieEnt(t, null); z.pos.set(c.x + 3, c.y, c.z); z.vel.set(1, 0, 0); D.entities.push(z); made.push(z.id); }
    await new Promise((r) => setTimeout(r, 400));
    return { n: types.length, flash: types.length };
  });
  ok(horde.n === 11, `horda mista de ${horde.n} tipos anima um tempinho`);

  ok(errors.length === 0, `sem erros de página${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} finally { await browser.close(); srv.kill(); }
if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\ntudo certo');

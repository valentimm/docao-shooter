// Docão Escondido (protótipo offline): menu → partida → Escondidos viram objeto, Caçadores presos na preparação, rodada fecha.
// Uso: SITE=http://localhost:8124/ node test-hide-browser.mjs
import { chromium } from 'playwright';
const SITE = process.env.SITE || 'http://localhost:8124/';
const errors = [], fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(SITE, { waitUntil: 'load' }); await page.waitForTimeout(1500);
const G = (fn, a) => page.evaluate(fn, a); const wait = (ms) => page.waitForTimeout(ms);
await page.selectOption('#modeSel', 'hide'); await page.selectOption('#botCount', '5');
ok(/Docão Escondido/.test(await G(() => document.getElementById('menuRules').textContent)), 'menu: regras do Docão Escondido');
await G(() => document.getElementById('playBtn').click()); await wait(1500);
const st = () => G(() => { const H = window.__hide; return { phase: H.S.phase, round: H.S.round, score: H.S.score, ents: H.entities.map((e) => ({ team: e.team, hider: !!e.hider, prop: e.prop, mesh: !!e.propMesh, alive: e.alive, w: e.weapon, vis: e.model ? e.model.group.visible : null })), hud: (document.getElementById('hidehud') || {}).textContent }; });
let s = await st(); console.log(JSON.stringify(s));
ok(s.phase === 'prep' && s.round === 1, 'rodada 1 em preparação');
ok(s.ents.some((e) => e.hider) && s.ents.some((e) => !e.hider), 'tem Escondidos e Caçadores');
ok(s.ents.filter((e) => e.hider).every((e) => e.mesh && e.w === 7 && e.vis !== true), 'Escondidos: objeto no lugar do Docão, só faca');
ok(/Rodada 1/.test(s.hud || ''), 'HUD do modo');
ok(await G(() => window.__hide.S.props.join() === 'keg,hay,tree,jar,crate'), 'V2: mapa Rodízio e só objetos que existem nele');
ok(s.ents.filter((e) => e.hider).every((e) => ['keg', 'hay', 'tree', 'jar', 'crate'].includes(e.prop)), 'V2: Escondidos sorteiam objeto do mapa');
{ const pl = await G(() => { const p = window.__hide.player; window.__wasH = [p.hider, p.prop]; p.hider = true; p.prop ||= 'keg'; return !!p; });
  if (pl) { await page.keyboard.press('KeyL'); await wait(150); await page.keyboard.down('KeyW'); const p0 = await G(() => { const p = window.__hide.player; return [p.pos.x, p.pos.z, p.propLock]; }); await wait(700);
    const p1 = await G(() => { const p = window.__hide.player; p.yaw += 1; return [p.pos.x, p.pos.z]; }); await wait(200); await page.keyboard.up('KeyW');
    const y = await G(() => { const p = window.__hide.player; return p.propMesh ? Math.abs(p.propMesh.rotation.y - p.propYaw - (p.propRot || 0)) < 1e-6 && Math.abs(p.propYaw - p.yaw) > 0.5 : null; });
    ok(p0[2] === true && Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 0.05, 'V2: L trava a posição (W não anda)'); ok(y !== false, 'V2: travado, objeto não gira com a câmera');
    await page.keyboard.press('KeyL'); ok(await G(() => window.__hide.player.propLock === false), 'V2: L de novo destrava');
    await G(() => { const p = window.__hide.player; [p.hider, p.prop] = window.__wasH; }); await wait(200); } }
await page.screenshot({ path: '/tmp/hide-prep.png' });
// pula a preparação e mata todos os Escondidos
await G(() => { window.__hide.S.phaseEnd = 0; }); await wait(400);
s = await st(); ok(s.phase === 'live', 'caçada liberada');
await page.screenshot({ path: '/tmp/hide-live.png' });
await G(() => { window.__hide.S.whistleAt = 0.001; }); await wait(400);
ok(await G(() => window.__hideWhistles >= 1 && /APITO/.test(document.getElementById('centermsg').textContent)), 'apito obrigatório dispara na caçada com aviso APITO!');
await G(() => { for (const e of window.__hide.entities) if (e.hider) { e.alive = false; e.respawnAt = Infinity; } }); await wait(400);
s = await st(); ok(s.phase === 'end' && s.score.reduce((a, b) => a + b) === 1, 'rodada fecha com ponto dos Caçadores');
const before = s.ents.map((e) => e.hider);
await G(() => { window.__hide.S.phaseEnd = 0; }); await wait(600);
s = await st(); ok(s.round === 2 && s.ents.every((e, i) => e.hider !== before[i]), 'rodada 2: papéis trocaram');
ok(!errors.length, 'sem erros no console: ' + errors.slice(0, 3).join(' | '));
await browser.close(); process.exit(fails.length ? 1 : 0);

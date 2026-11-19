// Botão direito depois do merge (PR #1 + faca): nas armas de fogo = mira/ADS (luneta nas 3 snipers), com a faca = estocada.
// Uso: SITE=http://localhost:8124/ node test-mira.mjs
import { chromium } from 'playwright';
const SITE = process.env.SITE || 'http://localhost:8124/';
const errors = [], fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('[error] ' + m.text()); });
await page.addInitScript(() => { localStorage.setItem('docao.primary', '0'); localStorage.setItem('docao.map', 'arena'); });
await page.goto(SITE, { waitUntil: 'load' }); await page.waitForTimeout(1500);
const G = (fn, a) => page.evaluate(fn, a);
const waitGame = async (sec) => { const t0 = await G(() => window.__docao.time); await page.waitForFunction((t) => window.__docao.time >= t, t0 + sec, { timeout: 30000, polling: 16 }); };
await page.selectOption('#modeSel', 'dm'); await page.selectOption('#botCount', '4'); await page.click('#playBtn'); await page.waitForTimeout(800);
await page.waitForFunction(() => window.__docao.state === 'playing' && window.__docao.player.alive, null, { timeout: 15000 });
await G(() => { const g = window.__docao; for (const e of g.entities) if (!e.isPlayer) { e.frozen = true; e.passive = true; e.pos.set(999, -50, 999); } g.player.invulnUntil = g.time + 999; });
await page.mouse.move(640, 360);
const equip = async (w) => { await G((w) => { const g = window.__docao, p = g.player; p.primary = w; p.slots = [w, g.WEAPONS.findIndex((x) => x.key === 'pistol'), g.KNIFE]; g.switchWeapon(p, w); p.reloadEnd = 0; p.mag = g.WEAPONS.map((x) => x.mag); }, w); await waitGame(0.6); };
for (const [w, name] of [[0, 'Fuzil'], [2, 'Sniper Torresmo'], [5, 'Canhão do Barril'], [6, 'Carabina da Granja'], [4, 'Pistolinha']]) {
  await equip(w);
  const fov0 = await G(() => window.__docao.fov), kn0 = await G(() => window.__docao.fpKnife.t);
  const vis0 = await G(() => window.__docao.fpVisible);
  await page.mouse.down({ button: 'right' }); await waitGame(0.5);
  const r = await G(() => ({ ads: window.__docao.ads, fov: window.__docao.fov, scoped: window.__docao.scoped, weapon: window.__docao.player.weapon, fpVisible: window.__docao.fpVisible }));
  await page.mouse.up({ button: 'right' }); await waitGame(0.5);
  const r2 = await G(() => ({ ads: window.__docao.ads, fov: window.__docao.fov, fpVisible: window.__docao.fpVisible }));
  const isScope = await G((w) => !!window.__docao.WEAPONS[w].scope, w);
  ok(r.weapon === w && r.ads > 0.8 && r.fov < fov0 - 5 && (!isScope || r.scoped), `${name}: botão direito mira (ads=${r.ads.toFixed(2)}, fov ${fov0.toFixed(0)}→${r.fov.toFixed(0)}${isScope ? ', luneta=' + r.scoped : ''})`);
  if (isScope) ok(r.scoped && r.fpVisible === false, `${name}: com a luneta a arma some (fpVisible=${r.fpVisible})`);
  ok(r2.ads < 0.2 && Math.abs(r2.fov - fov0) < 2, `${name}: soltou, volta ao normal (fov ${r2.fov.toFixed(0)})`);
  if (isScope) ok(vis0 === true && r2.fpVisible === true, `${name}: soltou, a arma volta na mão (fpVisible=${r2.fpVisible})`);
  ok(await G((k) => window.__docao.fpKnife.t >= k, kn0), `${name}: sem estocada de faca`);
}
// faca: botão direito = estocada, sem mira
await page.keyboard.press('Digit3'); await waitGame(0.5);
ok(await G(() => window.__docao.player.weapon === window.__docao.KNIFE), 'tecla 3 = faca');
await page.mouse.down({ button: 'right' }); await waitGame(0.1);
const k = await G(() => ({ kind: window.__docao.fpKnife.kind, t: window.__docao.fpKnife.t, ads: window.__docao.ads }));
await page.mouse.up({ button: 'right' }); await waitGame(1.2); // estocada: 1 s até o próximo golpe
ok(k.kind === 'stab' && k.t < 0.3 && k.ads < 0.05, `faca: botão direito = estocada, sem mira (${JSON.stringify(k)})`);
await page.mouse.down(); await waitGame(0.1); const k2 = await G(() => ({ kind: window.__docao.fpKnife.kind, t: window.__docao.fpKnife.t })); await page.mouse.up(); await waitGame(0.6);
ok(k2.kind === 'slash' && k2.t < 0.3, 'faca: clique esquerdo = golpe');
// mirando com o fuzil e troca pra faca segurando o botão direito: não estoca sozinho; clique novo estoca
await page.keyboard.press('Digit1'); await waitGame(0.6);
await page.mouse.down({ button: 'right' }); await waitGame(0.4); await page.keyboard.press('Digit3'); await waitGame(0.8);
const k3 = await G(() => window.__docao.fpKnife.t); await page.mouse.up({ button: 'right' }); await waitGame(0.2);
ok(k3 > 0.6, `segurando a mira e trocando pra faca: não estoca sozinho (t=${k3.toFixed(2)})`);
await page.mouse.down({ button: 'right' }); await waitGame(0.1); const k4 = await G(() => ({ kind: window.__docao.fpKnife.kind, t: window.__docao.fpKnife.t })); await page.mouse.up({ button: 'right' });
ok(k4.kind === 'stab' && k4.t < 0.3, 'clique direito novo depois disso estoca');
console.log('erros:', errors.length ? errors.slice(0, 5).join('\n') : 'nenhum'); ok(!errors.length, 'sem erros de console');
await browser.close();
console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK'); process.exit(fails.length ? 1 : 0);

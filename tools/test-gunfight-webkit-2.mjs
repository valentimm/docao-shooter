// Complemento: espectador com troca de alvo, overtime e prints com o banner abaixo do placar.
import { webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const SITE = 'http://127.0.0.1:8124/';
const SERVER = 'ws://127.0.0.1:8787';
const OUT = '/opt/cursor/artifacts/gunfight';
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (s) => { const row = new Date().toISOString().slice(11, 19) + ' ' + s; log.push(row); console.log(row); };
const results = [];
const ok = (c, m) => { results.push({ ok: !!c, m }); note((c ? 'OK   ' : 'FALHA') + ' ' + m); };
const browser = await webkit.launch();
async function boot(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => note('PAGE ' + String(e.message).slice(0, 180)));
  await page.addInitScript((n) => { try { localStorage.setItem('docao.name', n); } catch (e) {} }, name);
  await page.goto(SITE + '?server=' + encodeURIComponent(SERVER), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__docao && window.__docao.renderer, null, { timeout: 25000 });
  await page.evaluate(() => { const r = window.__docao.renderer; r.setPixelRatio(1); if (r.shadowMap) r.shadowMap.enabled = false; });
  return page;
}
async function until(page, fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(200); }
  return false;
}
async function shot(page, name) {
  await page.screenshot({ path: OUT + '/' + name + '.png', timeout: 8000 });
  note('shot ' + name);
}
const read = (page) => page.evaluate(() => {
  const g = window.__docao, S = g.gunfight.S;
  const banner = document.getElementById('bombBanner');
  const watch = document.getElementById('gfWatch');
  const br = banner ? banner.getBoundingClientRect() : null;
  const cross = document.getElementById('crosshair');
  const cr = cross ? cross.getBoundingClientRect() : null;
  return {
    phase: S && S.phase, round: S && S.round, timeLeft: S ? +S.timeLeft.toFixed(2) : null,
    score: S && S.score.slice(), format: S && S.format, map: g.map && g.map.id, state: g.state,
    alive: g.player && g.player.alive, slots: g.player && g.player.slots.slice(),
    banner: banner && !banner.classList.contains('hidden') ? banner.innerText : '',
    watch: watch && !watch.classList.contains('hidden') ? watch.textContent : '',
    bannerTop: br ? Math.round(br.top) : null,
    crossY: cr ? Math.round(cr.top + cr.height / 2) : null,
    respawn: document.getElementById('respawnBtn') ? getComputedStyle(document.getElementById('respawnBtn')).display : '',
    n: (g.entities || []).filter((e) => !e.zt).length,
    teams: (g.entities || []).filter((e) => !e.zt).map((e) => e.team),
  };
});

let page;
try {
  page = await boot('Ana');
  await page.click('#onlineBtn');
  await page.selectOption('#roomMode', 'gf');
  await page.selectOption('#roomGf', '2');
  await page.selectOption('#roomBots', '1');
  await page.selectOption('#roomMap', 'galpao-assalto');
  await page.click('#createBtn');
  ok(await until(page, () => window.__docao.online && window.__docao.online.myId, 15000), 'sala do galpão');
  await page.click('#startOnline');
  ok(await until(page, () => window.__docao.state === 'playing' && window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live', 15000), 'galpão ao vivo');
  const live = await read(page);
  note('galpao ' + JSON.stringify(live));
  ok(live.bannerTop == null || (live.crossY && live.bannerTop + 80 < live.crossY), 'banner não cobre a mira (' + live.bannerTop + ' / ' + live.crossY + ')');
  await shot(page, 'live-galpao-1280x800');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
  await shot(page, 'live-galpao-1440x900');
  await page.setViewportSize({ width: 1280, height: 800 });
  const ot = await until(page, () => { const S = window.__docao.gunfight.S; return S && S.phase === 'ot'; }, 52000);
  const otS = await read(page);
  note('depois do relógio ' + JSON.stringify({ phase: otS.phase, score: otS.score, reason: otS.reason, round: otS.round }));
  if (ot && otS.phase === 'ot') {
    ok(true, 'overtime no galpão');
    await shot(page, 'overtime-1280x800');
    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, 'overtime-1440x900');
    await page.setViewportSize({ width: 1280, height: 800 });
  } else ok(false, 'galpão não chegou no overtime (fase ' + otS.phase + ' placar ' + JSON.stringify(otS.score) + ')');

  await page.evaluate(() => window.__docao.toMenu());
  await until(page, () => window.__docao.state === 'menu', 8000);
  await page.selectOption('#modeSel', 'gf');
  await page.selectOption('#gfSide', '3');
  await page.click('#playBtn');
  ok(await until(page, () => window.__docao.state === 'playing' && window.__docao.mode === 'gf' && window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live', 20000), 'offline 3v3 no live');
  const off = await read(page);
  note('3v3 ' + JSON.stringify(off));
  ok(off.format === '3v3' && off.n === 6 && off.teams.filter((t) => t === 0).length === 3 && off.teams.filter((t) => t === 1).length === 3, '3v3 com dois times de 3');
  ok(off.slots && off.slots.length === 1, 'uma arma no 3v3');
  ok(off.timeLeft > 45 && off.timeLeft <= 50, 'timer 3v3 ~50 s (' + off.timeLeft + ')');
  await page.evaluate(() => window.__docao.kill(window.__docao.player));
  await page.waitForTimeout(1200);
  const spec = await read(page);
  note('watch ' + spec.watch + ' fase ' + spec.phase + ' respawn ' + spec.respawn);
  ok(spec.phase === 'live' && /Assistindo/.test(spec.watch), 'killcam curta e espectador no aliado (' + spec.watch + ')');
  ok(spec.respawn === 'none', 'botão Nascer não aparece no Gunfight');
  await shot(page, 'espectador-1280x800');
  const w0 = spec.watch;
  await page.mouse.click(640, 420);
  await page.waitForTimeout(350);
  const w1 = (await read(page)).watch;
  note('clique ' + w0 + ' -> ' + w1);
  ok(!!w1 && w1 !== w0, 'clique troca o aliado');
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot(page, 'espectador-1440x900');
} catch (e) {
  note('ERRO ' + (e && e.message));
  ok(false, 'exceção ' + (e && e.message));
  try { if (page) await shot(page, 'erro-2'); } catch { /* */ }
} finally {
  writeFileSync(OUT + '/resultado-2.json', JSON.stringify({ results, log }, null, 2));
  await browser.close();
}
const bad = results.filter((r) => !r.ok).length;
note(bad ? bad + ' FALHA(S)' : 'TUDO OK');
process.exit(bad ? 1 : 0);

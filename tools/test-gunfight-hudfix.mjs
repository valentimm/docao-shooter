// Prints do HUD corrigido: live no galpão, espectador e overtime. Um WebKit, dois contextos.
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
async function boot(name, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => note('PAGE ' + name + ' ' + String(e.message).slice(0, 180)));
  await page.addInitScript((n) => { try { localStorage.setItem('docao.name', n); } catch (e) {} }, name);
  await page.goto(SITE + '?server=' + encodeURIComponent(SERVER), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__docao && window.__docao.renderer, null, { timeout: 25000 });
  await page.evaluate(() => { const r = window.__docao.renderer; r.setPixelRatio(1); if (r.shadowMap) r.shadowMap.enabled = false; });
  return page;
}
async function until(page, fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(150); }
  return false;
}
async function shot(page, name) {
  await page.screenshot({ path: OUT + '/' + name + '.png', timeout: 8000 });
  note('shot ' + name);
}
const read = (page) => page.evaluate(() => {
  const g = window.__docao, S = g.gunfight.S;
  const banner = document.getElementById('gfBanner');
  const box = (el) => {
    if (!el) return null;
    const st = getComputedStyle(el);
    if (st.display === 'none' || el.classList.contains('hidden')) return null;
    const r = el.getBoundingClientRect();
    if (r.height < 2) return null;
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
  };
  const hud = document.getElementById('gfhud');
  const br = document.getElementById('bottomright');
  const stamp = document.getElementById('stamp');
  const dp = document.getElementById('deathpick');
  return {
    phase: S && S.phase, round: S && S.round, timeLeft: S ? +S.timeLeft.toFixed(2) : null,
    score: S && S.score.slice(), map: g.map && g.map.id, alive: g.player && g.player.alive,
    banner: banner && !banner.classList.contains('hidden') ? banner.innerText.replace(/\s+/g, ' ').trim() : '',
    timer: document.getElementById('timer').textContent,
    classCount: hud ? (hud.innerText.match(/Classe:/g) || []).length : 0,
    scoreB: box(document.getElementById('gfScore')),
    metaB: box(document.getElementById('gfMeta')),
    banB: box(banner),
    classB: box(document.getElementById('gfClass')),
    death: dp ? getComputedStyle(dp).display : '',
    ammo: br ? getComputedStyle(br).display : '',
    stampOn: !!(stamp && stamp.classList.contains('show') && getComputedStyle(stamp).display !== 'none'),
    watch: (document.getElementById('gfWatch') && !document.getElementById('gfWatch').classList.contains('hidden')) ? document.getElementById('gfWatch').textContent : '',
    center: document.getElementById('centermsg') ? document.getElementById('centermsg').textContent : '',
    gfspec: document.body.classList.contains('gfspec'),
  };
});
const hits = (a, b) => !!(a && b && a.top < b.bottom - 1 && b.top < a.bottom - 1);

let ana, beto;
try {
  ana = await boot('Ana', 1280, 800);
  await ana.click('#onlineBtn');
  await ana.selectOption('#roomMode', 'gf');
  await ana.selectOption('#roomGf', '2');
  await ana.selectOption('#roomBots', '1');
  await ana.selectOption('#roomMap', 'galpao-assalto');
  await ana.click('#createBtn');
  ok(await until(ana, () => window.__docao.online && window.__docao.online.myId, 15000), 'sala do galpão');
  const code = await ana.evaluate(() => window.__docao.online.code);
  await ana.click('#lobbyTeamBtns .teambtn.t0');
  beto = await boot('Beto', 1440, 900);
  await beto.goto(SITE + '?server=' + encodeURIComponent(SERVER) + '&sala=' + code, { waitUntil: 'domcontentloaded', timeout: 30000 });
  ok(await until(beto, () => window.__docao.online && window.__docao.online.code, 15000), 'Beto no galpão');
  await beto.click('#lobbyTeamBtns .teambtn.t0');
  await ana.click('#startOnline');
  ok(await until(ana, () => window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live' && window.__docao.map.id === 'galpao-assalto', 20000), 'galpão ao vivo');
  await Promise.all([shot(ana, 'live-galpao-1280x800'), shot(beto, 'live-galpao-1440x900')]);
  const gal = await read(ana);
  note('galpao ' + JSON.stringify(gal));
  ok(gal.classCount === 1 && !/classe/i.test(gal.banner), 'galpão: classe uma vez, banner ' + gal.banner);
  ok(!hits(gal.banB, gal.scoreB) && !hits(gal.banB, gal.metaB) && !hits(gal.banB, gal.classB), 'galpão: banner abaixo do placar');
  ok(gal.death === 'none' && gal.alive && !/pururucou|Aguarde|Nascer/i.test(gal.center || ''), 'galpão vivo sem nascer e sem recado de morte');

  async function postoRoom() {
    await ana.evaluate(() => window.__docao.toMenu());
    await until(ana, () => window.__docao.state === 'menu', 8000);
    await ana.click('#onlineBtn');
    await ana.selectOption('#roomMode', 'gf');
    await ana.selectOption('#roomGf', '4');
    await ana.selectOption('#roomBots', '1');
    await ana.waitForTimeout(200);
    const maps = await ana.evaluate(() => [...document.getElementById('roomMap').options].map((o) => o.value));
    if (maps.includes('posto-nevasca')) await ana.selectOption('#roomMap', 'posto-nevasca');
    await ana.click('#createBtn');
    ok(await until(ana, () => window.__docao.online && window.__docao.online.myId && window.__docao.state !== 'playing', 15000), 'sala 4v4 do posto');
    const code2 = await ana.evaluate(() => window.__docao.online.code);
    await ana.click('#lobbyTeamBtns .teambtn.t0');
    await beto.goto(SITE + '?server=' + encodeURIComponent(SERVER) + '&sala=' + code2, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let joined = false;
    const tJoin = Date.now();
    while (Date.now() - tJoin < 15000) {
      joined = await beto.evaluate((code) => !!(window.__docao && window.__docao.online && window.__docao.online.code === code), code2);
      if (joined) break;
      await beto.waitForTimeout(200);
    }
    ok(joined, 'Beto no posto');
    await beto.click('#lobbyTeamBtns .teambtn.t0');
    await ana.click('#startOnline');
  }
  let samples = [];
  for (let tryN = 0; tryN < 2 && !samples.some((s) => s.phase === 'ot'); tryN++) {
    await postoRoom();
    const saw = await until(ana, () => window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'ot', 72000);
    note('ot tentativa ' + (tryN + 1) + ' ' + saw + ' ' + JSON.stringify(await read(ana)));
    if (!saw) continue;
    await Promise.all([shot(ana, 'overtime-1280x800'), shot(beto, 'overtime-1440x900')]);
    const t0 = Date.now();
    while (Date.now() - t0 < 14000) {
      const row = await ana.evaluate(() => {
        const S = window.__docao.gunfight.S;
        return { phase: S && S.phase, t: S ? +S.timeLeft.toFixed(2) : null, timer: document.getElementById('timer').textContent };
      });
      samples.push(row);
      if (row.phase !== 'ot') break;
      await ana.waitForTimeout(70);
    }
  }
  const shown = samples.filter((s, i) => i === 0 || s.timer !== samples[i - 1].timer || s.phase !== samples[i - 1].phase);
  note('amostras ' + JSON.stringify(shown));
  const nums = samples.filter((s) => s.phase === 'ot' && /OVERTIME/.test(s.timer)).map((s) => parseInt(s.timer.replace(/\D/g, ''), 10)).filter((n) => Number.isFinite(n));
  const after = samples.find((s) => s.phase && s.phase !== 'ot');
  ok(nums.length >= 2 && nums[0] >= 8 && nums[0] > nums[nums.length - 1], 'overtime conta para baixo (' + nums.join(',') + ')');
  ok(!!after && !/OVERTIME/.test(after.timer || ''), 'OVERTIME some no fim (' + (after && after.phase) + ' ' + (after && after.timer) + ')');
  const otHud = samples.length ? await read(ana) : null;
  if (otHud && otHud.phase === 'ot') ok(otHud.classCount <= 1 && otHud.death === 'none' && !hits(otHud.banB, otHud.classB), 'banner de overtime fora da classe');

  await ana.evaluate(() => window.__docao.toMenu());
  await until(ana, () => window.__docao.state === 'menu', 8000);
  await ana.selectOption('#modeSel', 'gf');
  await ana.selectOption('#gfSide', '3');
  await ana.click('#playBtn');
  ok(await until(ana, () => window.__docao.state === 'playing' && !window.__docao.online && window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live', 20000), 'offline 3v3 no live');
  await ana.evaluate(() => window.__docao.kill(window.__docao.player));
  await ana.waitForTimeout(1200);
  const spec = await read(ana);
  note('spec ' + JSON.stringify(spec));
  ok(/Assistindo/.test(spec.watch) && spec.gfspec && !spec.stampOn, 'espectador sem o carimbo (' + spec.watch + ')');
  ok(spec.ammo === 'none' && spec.death === 'none', 'sem munição e sem nascer enquanto assiste');
  await shot(ana, 'espectador-1280x800');
  await ana.setViewportSize({ width: 1440, height: 900 });
  await ana.waitForTimeout(200);
  await shot(ana, 'espectador-1440x900');
  const w0 = spec.watch;
  await ana.mouse.click(720, 460);
  await ana.waitForTimeout(300);
  const w1 = (await read(ana)).watch;
  ok(!!w1 && w1 !== w0, 'clique troca o aliado (' + w0 + ' -> ' + w1 + ')');
} catch (e) {
  note('ERRO ' + (e && e.stack || e));
  ok(false, 'exceção ' + (e && e.message));
  try { if (ana) await shot(ana, 'erro-hudfix'); } catch { /* */ }
} finally {
  writeFileSync(OUT + '/resultado-hudfix.json', JSON.stringify({ results, log }, null, 2));
  await browser.close();
}
const bad = results.filter((r) => !r.ok).length;
note(bad ? bad + ' FALHA(S)' : 'TUDO OK');
process.exit(bad ? 1 : 0);

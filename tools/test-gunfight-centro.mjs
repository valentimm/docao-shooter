// Centro do timer e do placar do Gunfight = centro da viewport.
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
  page.on('pageerror', (e) => note('PAGE ' + name + ' ' + String(e.message).slice(0, 160)));
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
const measure = (page) => page.evaluate(() => {
  const mid = innerWidth / 2;
  const c = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const st = getComputedStyle(el);
    if (st.display === 'none' || el.classList.contains('hidden')) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const x = (r.left + r.right) / 2;
    return { x: +x.toFixed(1), d: +(x - mid).toFixed(2) };
  };
  return {
    w: innerWidth, h: innerHeight, mid,
    phase: window.__docao.gunfight.S && window.__docao.gunfight.S.phase,
    timer: c('timer'), score: c('gfScore'), hud: c('gfhud'),
    meta: c('gfMeta'), banner: c('gfBanner'), klass: c('gfClass'), cross: c('crosshair'),
  };
});
function near(m, label) {
  const td = m.timer && Math.abs(m.timer.d);
  const sd = m.score && Math.abs(m.score.d);
  ok(td != null && td <= 2 && sd != null && sd <= 2, label + ' timer ' + (m.timer && m.timer.d) + 'px placar ' + (m.score && m.score.d) + 'px (meio ' + m.mid + ')');
  note(label + ' ' + JSON.stringify(m));
}
const streakGone = (page) => page.evaluate(() => {
  const ids = ['streakBar', 'streakCount', 'nukeReady', 'strikeMap', 'invPowers', 'predatorHud'];
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) { out[id] = 'ausente'; continue; }
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out[id] = st.display === 'none' || st.visibility === 'hidden' || r.width < 1 || r.height < 1 ? 'oculto' : st.display;
  }
  return out;
});
async function checkStreak(page, label) {
  const s = await streakGone(page);
  ok(s.streakBar === 'ausente' || s.streakBar === 'oculto', label + ' sem coluna de killstreak (' + s.streakBar + ')');
  ok(['streakCount', 'nukeReady', 'strikeMap', 'invPowers', 'predatorHud'].every((id) => s[id] === 'ausente' || s[id] === 'oculto'), label + ' sem UI de poder ' + JSON.stringify(s));
}

let ana, beto;
try {
  ana = await boot('Ana', 1280, 800);
  await ana.click('#onlineBtn');
  await ana.selectOption('#roomMode', 'gf');
  await ana.selectOption('#roomGf', '2');
  await ana.selectOption('#roomBots', '1');
  await ana.selectOption('#roomMap', 'x1-curral');
  await ana.click('#createBtn');
  ok(await until(ana, () => window.__docao.online && window.__docao.online.myId, 15000), 'sala');
  const code = await ana.evaluate(() => window.__docao.online.code);
  await ana.click('#lobbyTeamBtns .teambtn.t0');
  beto = await boot('Beto', 1440, 900);
  await beto.goto(SITE + '?server=' + encodeURIComponent(SERVER) + '&sala=' + code, { waitUntil: 'domcontentloaded', timeout: 30000 });
  let joined = false;
  const tJoin = Date.now();
  while (Date.now() - tJoin < 15000) {
    joined = await beto.evaluate((c) => !!(window.__docao && window.__docao.online && window.__docao.online.code === c), code);
    if (joined) break;
    await beto.waitForTimeout(200);
  }
  ok(joined, 'Beto na sala');
  await beto.click('#lobbyTeamBtns .teambtn.t0');
  await ana.click('#startOnline');
  ok(await until(ana, () => window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live', 20000), 'live');
  const liveA = await measure(ana);
  const liveB = await measure(beto);
  near(liveA, 'live 1280');
  near(liveB, 'live 1440');
  await checkStreak(ana, 'live 1280');
  await checkStreak(beto, 'live 1440');
  await Promise.all([shot(ana, 'live-2v2-1280x800'), shot(beto, 'live-2v2-1440x900')]);

  const saw = await until(ana, () => {
    const b = document.getElementById('gfBanner');
    return b && !b.classList.contains('hidden') && /Troca de lado/.test(b.innerText);
  }, 90000);
  ok(saw, 'banner Troca de lado');
  if (saw) {
    const a = await measure(ana);
    const b = await measure(beto);
    near(a, 'troca 1280');
    near(b, 'troca 1440');
    await checkStreak(ana, 'troca');
    await Promise.all([shot(ana, 'troca-lado-1280x800'), shot(beto, 'troca-lado-1440x900')]);
  }

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
  ok(await until(ana, () => window.__docao.online && window.__docao.online.myId && window.__docao.state !== 'playing', 15000), 'sala do posto');
  const code2 = await ana.evaluate(() => window.__docao.online.code);
  await ana.click('#lobbyTeamBtns .teambtn.t0');
  await beto.goto(SITE + '?server=' + encodeURIComponent(SERVER) + '&sala=' + code2, { waitUntil: 'domcontentloaded', timeout: 30000 });
  let joined2 = false;
  const t2 = Date.now();
  while (Date.now() - t2 < 15000) {
    joined2 = await beto.evaluate((c) => !!(window.__docao && window.__docao.online && window.__docao.online.code === c), code2);
    if (joined2) break;
    await beto.waitForTimeout(200);
  }
  ok(joined2, 'Beto no posto');
  await beto.click('#lobbyTeamBtns .teambtn.t0');
  await ana.click('#startOnline');
  const ot = await until(ana, () => window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'ot', 75000);
  ok(ot, 'overtime');
  if (ot) {
    const a = await measure(ana);
    const b = await measure(beto);
    near(a, 'overtime 1280');
    near(b, 'overtime 1440');
    await checkStreak(ana, 'overtime');
    await Promise.all([shot(ana, 'overtime-1280x800'), shot(beto, 'overtime-1440x900')]);
  }

  await ana.evaluate(() => window.__docao.toMenu());
  await until(ana, () => window.__docao.state === 'menu', 8000);
  await ana.selectOption('#modeSel', 'gf');
  await ana.selectOption('#gfSide', '3');
  await ana.click('#playBtn');
  ok(await until(ana, () => window.__docao.state === 'playing' && !window.__docao.online && window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live', 20000), 'offline 3v3');
  await ana.evaluate(() => window.__docao.kill(window.__docao.player));
  const spec = await until(ana, () => {
    const w = document.getElementById('gfWatch');
    return w && !w.classList.contains('hidden') && /Assistindo/.test(w.textContent);
  }, 8000);
  ok(spec, 'espectador');
  if (spec) {
    near(await measure(ana), 'espectador 1280');
    await checkStreak(ana, 'espectador');
    await shot(ana, 'espectador-1280x800');
    await ana.setViewportSize({ width: 1440, height: 900 });
    await ana.waitForTimeout(200);
    near(await measure(ana), 'espectador 1440');
    await shot(ana, 'espectador-1440x900');
  }
} catch (e) {
  note('ERRO ' + (e && e.message));
  ok(false, 'exceção ' + (e && e.message));
} finally {
  writeFileSync(OUT + '/centro.json', JSON.stringify({ results, log }, null, 2));
  await browser.close();
}
const bad = results.filter((r) => !r.ok).length;
note(bad ? bad + ' FALHA(S)' : 'TUDO OK');
process.exit(bad ? 1 : 0);

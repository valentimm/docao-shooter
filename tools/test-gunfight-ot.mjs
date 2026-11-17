// Overtime (até 2 tentativas) e espectador em 1440, com o timer visível e sem killstreak.
import { webkit } from 'playwright';
const SITE = 'http://127.0.0.1:8124/';
const SERVER = 'ws://127.0.0.1:8787';
const OUT = '/opt/cursor/artifacts/gunfight';
const browser = await webkit.launch();
const log = [];
const note = (s) => { const row = new Date().toISOString().slice(11, 19) + ' ' + s; log.push(row); console.log(row); };
async function boot(name, w, h) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  page.setDefaultTimeout(8000);
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
const measure = (page) => page.evaluate(() => {
  const mid = innerWidth / 2;
  const c = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (st.display === 'none' || r.width < 2 || r.height < 2) return null;
    const x = (r.left + r.right) / 2;
    return { x: +x.toFixed(1), d: +(x - mid).toFixed(2), display: st.display };
  };
  const bar = document.getElementById('streakBar');
  const bst = bar ? getComputedStyle(bar) : null;
  return {
    w: innerWidth, mid, phase: window.__docao.gunfight.S && window.__docao.gunfight.S.phase,
    timer: c('timer'), score: c('gfScore'),
    streak: !bar || bst.display === 'none' ? 'oculto' : bst.display,
  };
});
let ok = true;
const ana = await boot('Ana', 1280, 800);
const beto = await boot('Beto', 1440, 900);
let got = false;
for (let n = 0; n < 2 && !got; n++) {
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
  if (!await until(ana, () => window.__docao.online && window.__docao.online.myId && window.__docao.state !== 'playing', 15000)) { note('sala falhou'); continue; }
  const code = await ana.evaluate(() => window.__docao.online.code);
  await ana.click('#lobbyTeamBtns .teambtn.t0');
  await beto.goto(SITE + '?server=' + encodeURIComponent(SERVER) + '&sala=' + code, { waitUntil: 'domcontentloaded', timeout: 30000 });
  let joined = false; const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    joined = await beto.evaluate((c) => !!(window.__docao && window.__docao.online && window.__docao.online.code === c), code);
    if (joined) break;
    await beto.waitForTimeout(200);
  }
  if (!joined) { note('beto falhou'); continue; }
  await beto.click('#lobbyTeamBtns .teambtn.t0');
  await ana.click('#startOnline');
  const ot = await until(ana, () => window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'ot', 75000);
  const ma = await measure(ana); const mb = await measure(beto);
  note('ot ' + (n + 1) + ' ' + ot + ' ' + JSON.stringify({ a: ma, b: mb }));
  if (!ot) continue;
  got = Math.abs(ma.timer.d) <= 2 && Math.abs(ma.score.d) <= 2 && Math.abs(mb.timer.d) <= 2 && Math.abs(mb.score.d) <= 2 && ma.streak === 'oculto' && mb.streak === 'oculto';
  await Promise.all([
    ana.screenshot({ path: OUT + '/overtime-1280x800.png' }),
    beto.screenshot({ path: OUT + '/overtime-1440x900.png' }),
  ]);
}
if (!got) ok = false;

await ana.evaluate(() => window.__docao.toMenu());
await until(ana, () => window.__docao.state === 'menu', 8000);
await ana.setViewportSize({ width: 1440, height: 900 });
await ana.selectOption('#modeSel', 'gf');
await ana.selectOption('#gfSide', '3');
await ana.click('#playBtn');
await until(ana, () => window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live' && !window.__docao.online, 20000);
await ana.evaluate(() => window.__docao.kill(window.__docao.player));
const spec = await until(ana, () => { const w = document.getElementById('gfWatch'); return w && !w.classList.contains('hidden') && /Assistindo/.test(w.textContent); }, 8000);
const ms = await measure(ana);
note('spec1440 ' + spec + ' ' + JSON.stringify(ms));
if (!spec || !ms.timer || Math.abs(ms.timer.d) > 2 || Math.abs(ms.score.d) > 2 || ms.streak !== 'oculto') ok = false;
await ana.screenshot({ path: OUT + '/espectador-1440x900.png' });
await browser.close();
console.log(log.join('\n'));
process.exit(ok ? 0 : 1);

// Só o espectador: espera a câmera do aliado e tira o print sem o carimbo.
import { webkit } from 'playwright';
const OUT = '/opt/cursor/artifacts/gunfight';
const browser = await webkit.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.setDefaultTimeout(8000);
await page.addInitScript(() => { try { localStorage.setItem('docao.name', 'Ana'); } catch (e) {} });
await page.goto('http://127.0.0.1:8124/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__docao && window.__docao.renderer, null, { timeout: 25000 });
await page.evaluate(() => { const r = window.__docao.renderer; r.setPixelRatio(1); if (r.shadowMap) r.shadowMap.enabled = false; });
await page.selectOption('#modeSel', 'gf');
await page.selectOption('#gfSide', '3');
await page.click('#playBtn');
await page.waitForFunction(() => window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live', null, { timeout: 20000 });
await page.evaluate(() => window.__docao.kill(window.__docao.player));
const okWatch = await page.waitForFunction(() => {
  const w = document.getElementById('gfWatch');
  return w && !w.classList.contains('hidden') && /Assistindo/.test(w.textContent);
}, null, { timeout: 8000 }).then(() => true).catch(() => false);
const info = await page.evaluate(() => {
  const stamp = document.getElementById('stamp');
  const br = document.getElementById('bottomright');
  const dp = document.getElementById('deathpick');
  const cm = document.getElementById('centermsg');
  return {
    watch: document.getElementById('gfWatch').textContent,
    gfspec: document.body.classList.contains('gfspec'),
    stampShow: stamp.classList.contains('show'),
    stampDisplay: getComputedStyle(stamp).display,
    ammo: getComputedStyle(br).display,
    death: getComputedStyle(dp).display,
    center: cm.textContent,
    age: window.__docao.player ? +(performance.now()) : 0,
  };
});
console.log(JSON.stringify({ okWatch, info }));
await page.screenshot({ path: OUT + '/espectador-1280x800.png' });
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(250);
await page.screenshot({ path: OUT + '/espectador-1440x900.png' });
const after = await page.evaluate(() => ({
  watch: document.getElementById('gfWatch').textContent,
  ammo: getComputedStyle(document.getElementById('bottomright')).display,
  stamp: getComputedStyle(document.getElementById('stamp')).display,
}));
console.log('depois ' + JSON.stringify(after));
await page.mouse.click(720, 460);
await page.waitForTimeout(400);
const w1 = await page.evaluate(() => document.getElementById('gfWatch').textContent);
console.log('clique ' + info.watch + ' -> ' + w1);
await browser.close();
process.exit(okWatch && info.gfspec && info.stampDisplay === 'none' && info.ammo === 'none' ? 0 : 1);

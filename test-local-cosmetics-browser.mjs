import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ITEMS } from './shared/closet.js';
import { KNIFE } from './shared/rules.js';
const SITE = process.env.SITE || 'http://localhost:8135/?server=ws://localhost:8795';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
 const errors = [], apiCalls = [];
 page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
 await page.route('**/api/**', route => { apiCalls.push(route.request().url()); return route.abort(); });
 await page.addInitScript(() => localStorage.setItem('docao.auth', 'sessao-expirada-de-teste'));
 async function open() {
  await page.goto(SITE);
  await page.waitForFunction(() => window.__gunThumbs > 0);
  assert.match(await page.locator('#acctTxt').textContent(), /DEV local/);
  assert.equal(await page.locator('#nameInput').evaluate(el => el.readOnly), false);
  await page.locator('.arsenal-crate').click();
  await page.waitForSelector('#menu[data-crate-state="inside"][data-view="arsenal"]');
 }
 async function choose(slot, i) {
  await page.locator(`#arsenalApp [data-slot="${slot}"]`).click();
  await page.locator(`#arsenalApp [data-weapon="${i}"]`).click();
  await page.locator('#arsenalApp [data-action="customize"]').click();
 }
 const equip = async () => { await page.locator('#arsenalApp [data-action="equip"]').click(); await page.waitForSelector('#arsenalApp[data-step="1"]'); };
 await open(); await choose('primary', 0);
 assert.equal(await page.locator('#arsenalApp [data-skin]').count(), ITEMS.filter(i => i.gun === 'rifle').length + 1);
 const rifle = ITEMS.find(i => i.gun === 'rifle' && i.paint === 'gold');
 await page.locator(`#arsenalApp [data-skin="${rifle.id}"]`).click(); await equip();
 await choose('melee', KNIFE);
 assert.equal(await page.locator('#arsenalApp [data-skin]').count(), ITEMS.filter(i => i.knife).length + 1);
 await page.locator('#arsenalApp [data-skin="k19"]').click();
 mkdirSync('/tmp/docao-dev-local', { recursive: true });
 await page.screenshot({ path: '/tmp/docao-dev-local/skins-sem-login.png' });
 await equip();
 const local = await page.evaluate(() => JSON.parse(localStorage.getItem('docao.dev.cosmetics')));
 assert.equal(local.knife, 'k19'); assert.equal(local.guns.rifle, rifle.id);
 assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('docao.classes'))[0].melee), KNIFE);
 await open(); await choose('melee', KNIFE);
 assert.equal(await page.locator('#arsenalApp [data-skin="k19"]').getAttribute('aria-pressed'), 'true');
 await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
 await page.locator('#arsenalApp [data-action="close"]').click();
 await page.waitForSelector('#menu:not([data-crate-state])');
 await page.locator('#closetBtn').click();
 assert(await page.locator('#closetMain').isVisible());
 assert.equal(await page.locator('#closetGuest').isVisible(), false);
 assert.match(await page.locator('#closetWallet').textContent(), /DEV local/);
 await page.setViewportSize({ width: 390, height: 844 });
 await page.screenshot({ path: '/tmp/docao-dev-local/brecho-sem-login-mobile.png' });
 assert.deepEqual(apiCalls, [], 'nenhuma chamada de API ou login é necessária');
 assert.deepEqual(errors, []);
 console.log('OK: localhost sem login, sessão expirada, API indisponível, todas as skins, equipar fuzil/Butterfly, persistência e Brechó no celular.');
} finally { await browser.close(); }

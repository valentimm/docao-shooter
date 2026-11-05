// Dois navegadores numa sala Survival de verdade (worker local + site estático).
// Não substitui o Game unitário de test-survival-integrado.mjs.
// Uso: node test-survival-sala.mjs [urlDoSite] [urlDoServidor]
//      cd server && npx wrangler dev --var ALLOW_TEST:1
//      python3 -m http.server 8124
// REVIVE: na próxima rodada, acrescentar down/rastejo/hold aqui, com os dois ainda vivos no print.
import { chromium, webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

const SITE = process.argv[2] || 'http://127.0.0.1:8124/';
const SERVER = process.argv[3] || 'ws://127.0.0.1:8787';
const OUT = process.env.SHOTS || '/opt/cursor/artifacts/survival-sala';
mkdirSync(OUT, { recursive: true });
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const chromeArgs = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function launchPair() {
  const gpu = { executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: chromeArgs };
  try {
    const wk = await webkit.launch();
    return { wk, ch: null, kind: 'webkit' };
  } catch (e) {
    console.log('WEBKIT indisponível:', e.message.split('\n')[0]);
    const ch = await chromium.launch(gpu);
    return { wk: null, ch, kind: 'chromium' };
  }
}

async function client(browser, name, viewport, query = '') {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((n) => { localStorage.setItem('docao.name', n); localStorage.setItem('docao.mode', 'inv'); localStorage.setItem('docao.surv', 'survival'); }, name);
  await page.goto(`${SITE}?server=${encodeURIComponent(SERVER)}${query}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__docao && document.getElementById('onlineBtn'), null, { timeout: 20000 });
  return { page, errors, name };
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
async function until(page, fn, ms = 12000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await wait(120); }
  return false;
}

const views = [{ width: 1280, height: 800 }, { width: 1440, height: 900 }];
const { wk, ch, kind } = await launchPair();
const engine = wk || ch;
console.log(`dois clientes no mesmo ${kind} (contextos isolados)`);
try {
  for (const viewport of views) {
    const tag = `${viewport.width}x${viewport.height}`;
    const kindA = kind;
    const A = await client(engine, 'Ana', viewport);
    const audioA = await G(A.page, () => window.__audio ? { state: window.__audio.state, count: window.__audio.count } : null);
    console.log(`AUDIO ${kindA} ${tag} no menu: ${JSON.stringify(audioA)} erros=${A.errors.filter((e) => /audio/i.test(e)).slice(0, 2).join(' | ') || 'nenhum'}`);
    await A.page.click('#onlineBtn');
    await A.page.waitForTimeout(300);
    await A.page.selectOption('#roomMode', 'inv');
    await A.page.selectOption('#roomSurv', 'survival');
    await A.page.selectOption('#roomBots', '0');
    await A.page.selectOption('#roomMax', '4');
    const mapLocked = await G(A.page, () => document.getElementById('roomMap').value);
    ok(mapLocked === 'hotmilk-noite', `${tag} a sala Survival trava o mapa (${mapLocked})`);
    await A.page.click('#createBtn');
    ok(await until(A.page, () => window.__docao.online && window.__docao.online.myId > 0), `${tag} Ana entrou na sala`);
    const code = await G(A.page, () => window.__docao.online.code);
    const B = await client(engine, 'Bia', viewport, `&sala=${code}`);
    ok(await until(B.page, () => window.__docao.online && window.__docao.online.myId > 0), `${tag} Bia entrou pelo link`);
    ok(await until(A.page, () => document.querySelectorAll('#lobbyPlayers tr').length >= 2), `${tag} lobby lista as duas`);
    await A.page.click('#startOnline');
    ok(await until(A.page, () => window.__docao.state === 'playing' && window.__docao.player && window.__docao.player.alive && window.__docao.survOn), `${tag} Ana viva no Survival`);
    ok(await until(B.page, () => window.__docao.state === 'playing' && window.__docao.player && window.__docao.player.alive && window.__docao.survOn), `${tag} Bia viva no Survival`);
    const map = await G(A.page, () => window.__docao.map && window.__docao.map.id);
    ok(map === 'hotmilk-noite', `${tag} os dois jogam a HOTMILK à Noite (${map})`);
    await A.page.evaluate(() => window.__docao.online.net.send({ t: 'testGod', s: 90 }));
    await B.page.evaluate(() => window.__docao.online.net.send({ t: 'testGod', s: 90 }));
    await A.page.evaluate(() => window.__docao.online.net.send({ t: 'testInv', wave: 1, hold: 1 }));
    await wait(800);
    const startPurse = await G(A.page, () => ({ a: window.__docao.player.pts | 0, hud: document.querySelector('#survPts span') && document.querySelector('#survPts span').textContent, score: document.getElementById('score').innerText }));
    const biaPurse0 = await G(B.page, () => window.__docao.player.pts | 0);
    ok(startPurse.a === 500 && biaPurse0 === 500 && startPurse.hud === '500' && !/Pontos:/.test(startPurse.score), `${tag} saldo 500 só no chip, placar sem Pontos (${startPurse.score})`);
    await A.page.screenshot({ path: `${OUT}/vivos-ana-${kindA}-${tag}.png` });
    await B.page.screenshot({ path: `${OUT}/vivos-bia-${kindA}-${tag}.png` });

    const bought = await A.page.evaluate(async () => {
      const g = window.__docao, p = g.player, o = g.online;
      const wall = g.survLayout && g.survLayout.walls && g.survLayout.walls.find((w) => w.w !== p.slots[0]);
      if (!wall) return { ok: false, why: 'sem parede' };
      p.pos.set(wall.x, (wall.y || 0) + 0.05, wall.z);
      p.vel.set(0, 0, 0);
      o.net.send({ t: 'u', sq: p.sq, tp: 1, p: [p.pos.x, p.pos.y, p.pos.z], v: [0, 0, 0], y: p.yaw, pi: 0, g: 1, w: p.weapon });
      const before = p.pts | 0;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      await sleep(400);
      const ev = new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true });
      document.dispatchEvent(ev);
      const t0 = performance.now();
      while (performance.now() - t0 < 2500 && (p.pts | 0) === before) await sleep(80);
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', bubbles: true }));
      return { ok: true, before, after: p.pts | 0, points: p.points | 0, price: wall.price, hud: document.querySelector('#survPts span').textContent };
    });
    await wait(700);
    const biaAfter = await G(B.page, () => ({ pts: window.__docao.player.pts | 0, points: window.__docao.player.points | 0, hud: document.querySelector('#survPts span').textContent }));
    const anaLater = await G(A.page, () => ({ pts: window.__docao.player.pts | 0, points: window.__docao.player.points | 0, hud: document.querySelector('#survPts span').textContent }));
    ok(bought.ok && bought.after === bought.before - bought.price && anaLater.pts === bought.after && anaLater.points === anaLater.pts && anaLater.hud.replace(/\./g, '') === String(bought.after), `${tag} compra da Ana fica ${anaLater.hud} e não volta (era ${bought.before})`);
    ok(biaAfter.pts === 500 && biaAfter.points === 500 && biaAfter.hud === '500', `${tag} saldo da Bia continua 500`);

    const snap = () => G(A.page, () => {
      const g = window.__docao;
      const players = g.entities.filter((e) => !e.zt && e.alive).map((e) => ({ x: e.pos.x, z: e.pos.z }));
      return g.entities.filter((e) => e.zt && e.alive).map((e) => {
        const d = Math.min(...players.map((p) => Math.hypot(e.pos.x - p.x, e.pos.z - p.z)));
        return { id: e.id, x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2), d: +d.toFixed(2) };
      });
    });
    const z0 = await snap();
    for (let i = 0; i < 8; i++) {
      await A.page.evaluate(() => { const p = window.__docao.player, o = window.__docao.online; if (o && p) o.net.send({ t: 'u', sq: p.sq, p: [p.pos.x, p.pos.y, p.pos.z], v: [0, 0, 0], y: p.yaw, pi: 0, g: 1, w: p.weapon }); });
      await wait(400);
    }
    const zA = await snap();
    const zB = await G(B.page, () => window.__docao.entities.filter((e) => e.zt && e.alive).map((e) => ({ id: e.id, x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2) })));
    const moved = z0.filter((p) => { const q = zA.find((e) => e.id === p.id); return q && Math.hypot(q.x - p.x, q.z - p.z) > 0.35; }).length;
    const closer = z0.filter((p) => { const q = zA.find((e) => e.id === p.id); return q && q.d < p.d - 0.25; }).length;
    const same = zA.filter((p) => zB.some((q) => q.id === p.id && Math.hypot(q.x - p.x, q.z - p.z) < 3));
    console.log(tag, 'zumbis', JSON.stringify({ n0: z0.length, nA: zA.length, moved, closer, same: same.length }));
    ok(zA.length > 0 && (moved > 0 || closer > 0), `${tag} zumbi persegue (${zA.length} vivos, ${moved} andaram, ${closer} chegaram mais perto)`);
    ok(same.length > 0, `${tag} a Bia vê o mesmo zumbi (${same.length}/${zA.length})`);
    const alive = await G(A.page, () => window.__docao.player.alive) && await G(B.page, () => window.__docao.player.alive);
    ok(alive, `${tag} os dois seguem vivos`);
    await A.page.screenshot({ path: `${OUT}/ia-ana-${kindA}-${tag}.png` });
    await B.page.screenshot({ path: `${OUT}/ia-bia-${kindA}-${tag}.png` });
    const pageErr = [...A.errors, ...B.errors].filter((e) => !/audio device/i.test(e));
    ok(!pageErr.length, `${tag} sem erro de página fora de áudio (${pageErr[0] || 'limpo'})`);
    await A.page.context().close();
    await B.page.context().close();
  }
} finally {
  if (ch) await ch.close();
  if (wk) await wk.close();
}
if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\ntudo ok');

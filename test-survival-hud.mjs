// HUD do Survival: um saldo só, compra na parede, sem sobreposição.
// WebKit (Safari) e, se pedido, Chromium. Chromium não é Safari.
// Uso: node test-survival-hud.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { webkit, chromium } from 'playwright';

const PORT = Number(process.env.PORT || 8177);
const SITE = `http://127.0.0.1:${PORT}/`;
const OUT = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

function serve() {
  return spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: new URL('.', import.meta.url).pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
const hit = (a, b) => !(a.right < b.left + 4 || a.left > b.right - 4 || a.bottom < b.top + 4 || a.top > b.bottom - 4);

async function layout(page) {
  return page.evaluate(() => {
    const ids = ['survPts', 'score', 'invWaveN', 'invWaveSub', 'invLives', 'bottomleft', 'ammo', 'wname', 'sPrompt', 'bPrompt', 'papCard', 'timer', 'leader', 'playBtn', 'modeSel', 'mapBtn', 'survSel'];
    const boxes = [];
    for (const id of ids) {
      const e = document.getElementById(id);
      if (!e) continue;
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || e.classList.contains('hidden')) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      boxes.push({ id, left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 90) });
    }
    return boxes;
  });
}
function clashes(boxes, watch) {
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (watch && !watch.includes(a.id) && !watch.includes(b.id)) continue;
    if (hit(a, b)) out.push(`${a.id}~${b.id}`);
  }
  return out;
}

async function boot(page) {
  await page.addInitScript(() => {
    localStorage.setItem('docao.mode', 'inv');
    localStorage.setItem('docao.surv', 'survival');
    localStorage.setItem('docao.name', 'Joao');
    localStorage.setItem('docao.map', 'hotmilk-noite');
  });
  await page.goto(SITE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__docao && document.getElementById('playBtn'), null, { timeout: 20000 });
}

async function round(kind, engine, viewport) {
  const args = kind === 'chromium' ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [];
  const browser = await engine.launch({ args });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const tag = `${kind}-${viewport.width}x${viewport.height}`;
  try {
    await boot(page);
    await page.screenshot({ path: `${OUT}/menu-${tag}.png` });
    const menu = await layout(page);
    const menuHit = clashes(menu, ['playBtn', 'modeSel', 'mapBtn', 'survSel']);
    ok(!menuHit.length, `${tag} menu sem sobreposição (${menuHit.join(', ') || 'limpo'})`);
    await page.click('#playBtn');
    await page.waitForFunction(() => window.__docao && window.__docao.state === 'playing' && window.__docao.survOn, null, { timeout: 25000 });
    await sleep(600);
    const audio = await page.evaluate(() => window.__audio ? { state: window.__audio.state, count: window.__audio.count } : null);
    if (kind === 'webkit') console.log(`AUDIO ${tag} estado=${audio && audio.state} erros=${errors.filter((e) => /audio/i.test(e)).join(' | ') || 'nenhum'}`);
    const hud0 = await page.evaluate(() => {
      const score = document.getElementById('score').innerText;
      const purse = document.getElementById('survPts');
      const n = purse.querySelector('span');
      const wallets = [...document.querySelectorAll('#score, #survPts, #bPrompt, #sPrompt')].map((e) => e.innerText.replace(/\s+/g, ' '));
      return { score, n: n ? n.textContent : purse.innerText, hidden: purse.classList.contains('hidden'), wallets };
    });
    ok(!/Pontos:/.test(hud0.score), `${tag} placar do canto não mostra saldo (${hud0.score})`);
    ok(!hud0.hidden && hud0.n === '500', `${tag} um saldo no HUD: ${hud0.n}`);
    ok(!hud0.wallets.some((t) => /você tem/.test(t)), `${tag} nenhum segundo “você tem”`);
    const beforeBoxes = await layout(page);
    const purseHits = clashes(beforeBoxes, ['survPts']);
    ok(!purseHits.length, `${tag} chip de pontos livre (${purseHits.join(', ') || 'limpo'}) · ${beforeBoxes.filter((b) => b.id === 'survPts').map((b) => `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.right - b.left)}x${Math.round(b.bottom - b.top)}`).join('')}`);
    await page.screenshot({ path: `${OUT}/hud-antes-${tag}.png` });
    const buy = await page.evaluate(() => {
      const g = window.__docao, p = g.player, lay = g.survLayout;
      const wall = lay.walls.find((w) => w.w !== p.slots[0]);
      p.pos.set(wall.x, (wall.y || 0) + 0.05, wall.z);
      p.vel.set(0, 0, 0); p.onGround = true;
      const have = wall.price + 800;
      p.pts = have; p.points = have; p._purse = have;
      return { price: wall.price, have, w: wall.w, x: wall.x, z: wall.z };
    });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/hud-na-parede-${tag}.png` });
    const prompt = await page.evaluate(() => {
      const el = document.getElementById('sPrompt');
      return { hidden: el.classList.contains('hidden'), text: el.innerText.replace(/\s+/g, ' '), purse: document.querySelector('#survPts span').textContent };
    });
    const shown = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    ok(!prompt.hidden && prompt.purse === shown(buy.have), `${tag} na parede o saldo do HUD é ${prompt.purse} e o aviso é “${prompt.text}”`);
    ok(!/você tem/.test(prompt.text), `${tag} o aviso da parede não repete o saldo`);
    await page.keyboard.down('f');
    const bought = await page.waitForFunction((info) => {
      const g = window.__docao, p = g.player, wall = g.survLayout.walls.find((w) => w.w === info.w);
      if (wall) { p.pos.set(wall.x, (wall.y || 0) + 0.05, wall.z); p.vel.set(0, 0, 0); }
      return (p.pts | 0) === info.have - info.price;
    }, buy, { timeout: 20000 }).then(() => true).catch(() => false);
    await page.keyboard.up('f');
    const after = await page.evaluate(() => ({
      pts: window.__docao.player.pts | 0,
      points: window.__docao.player.points | 0,
      hud: document.querySelector('#survPts span').textContent,
      score: document.getElementById('score').innerText,
    }));
    const left = shown(buy.have - buy.price);
    ok(bought && after.pts === buy.have - buy.price && after.points === after.pts && after.hud === left, `${tag} compra descontou uma vez: HUD ${after.hud}, pts ${after.pts}, points ${after.points}`);
    ok(!/Pontos:/.test(after.score), `${tag} depois da compra o canto continua sem saldo`);
    await page.screenshot({ path: `${OUT}/hud-depois-${tag}.png` });
    const otherErr = errors.filter((e) => !/audio device/i.test(e));
    ok(!otherErr.length, `${tag} sem erro de página fora do dispositivo de áudio (${otherErr[0] || 'limpo'})`);
  } finally {
    await browser.close();
  }
}

const child = serve();
await sleep(400);
const views = [{ width: 1280, height: 800 }, { width: 1440, height: 900 }];
try {
  for (const v of views) await round('webkit', webkit, v);
  for (const v of views) await round('chromium', chromium, v);
} finally {
  child.kill();
}
if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\ntudo ok');

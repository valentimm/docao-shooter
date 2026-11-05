// Validação WebKit do down/revive. Dois clientes no mesmo browser WebKit.
// Cada etapa estoura sozinha e fecha só este browser. Sem Chromium.
// node tools/test-down-webkit.mjs
import { webkit } from 'playwright';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';

const SITE = process.argv[2] || 'http://127.0.0.1:8170/';
const SERVER = process.argv[3] || 'ws://127.0.0.1:8787';
const OUT = process.env.SHOTS || '/opt/cursor/artifacts/survival-final';
mkdirSync(OUT, { recursive: true });
const UZI = 9;
const logs = [];
const steps = [];
let browser;
let ended = false;
const stamp = () => new Date().toISOString().slice(11, 23);
function note(line) { const row = stamp() + ' ' + line; logs.push(row); console.log(row); }
function walk(pid, acc) {
  let rss = 0;
  try { const s = readFileSync('/proc/' + pid + '/status', 'utf8'); const m = s.match(/VmRSS:\s+(\d+)/); rss = m ? +m[1] : 0; } catch { return; }
  acc.push(rss);
  let kids = '';
  try { kids = readFileSync('/proc/' + pid + '/task/' + pid + '/children', 'utf8'); } catch { kids = ''; }
  for (const k of kids.trim().split(/\s+/).filter(Boolean)) walk(+k, acc);
}
function mem() {
  const acc = [];
  let kids = '';
  try { kids = readFileSync('/proc/' + process.pid + '/task/' + process.pid + '/children', 'utf8'); } catch { kids = ''; }
  for (const k of kids.trim().split(/\s+/).filter(Boolean)) walk(+k, acc);
  return acc.reduce((s, n) => s + n, 0);
}
async function finish(why) {
  if (ended) return;
  ended = true;
  const report = { why, steps, mem: mem(), tail: logs.slice(-30) };
  writeFileSync('/tmp/down-webkit.json', JSON.stringify(report, null, 2));
  note('fim ' + why + ' rss=' + report.mem);
  try { if (browser) await browser.close(); } catch { /* */ }
  process.exit(why === 'ok' ? 0 : 2);
}
async function step(name, ms, fn) {
  const t0 = Date.now();
  let timer, memTimer;
  const cap = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('STEP_TIMEOUT')), ms); });
  const fat = new Promise((_, rej) => {
    memTimer = setInterval(() => { const r = mem(); if (r > 7000000) rej(new Error('RSS ' + Math.round(r / 1024) + ' MB')); }, 500);
  });
  try {
    const value = await Promise.race([Promise.resolve().then(fn), cap, fat]);
    clearTimeout(timer); clearInterval(memTimer);
    steps.push({ name, ok: true, ms: Date.now() - t0, mem: mem() });
    note('OK ' + name + ' ' + (Date.now() - t0) + 'ms rss=' + mem());
    return value;
  } catch (e) {
    clearTimeout(timer); clearInterval(memTimer);
    steps.push({ name, ok: false, ms: Date.now() - t0, err: String(e.message).slice(0, 400), mem: mem() });
    note('FALHA ' + name + ' ' + String(e.message).slice(0, 400));
    await finish('timeout:' + name);
  }
}

browser = await webkit.launch();
browser.on('disconnected', () => { if (!ended) { ended = true; note('webkit morreu'); process.exit(3); } });

async function client(name, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', (e) => note('PAGE ' + name + ' ' + String(e.message).slice(0, 240)));
  page.on('crash', () => note('CRASH ' + name));
  await page.addInitScript((n) => { localStorage.setItem('docao.name', n); localStorage.setItem('docao.mode', 'dm'); }, name);
  await page.goto(SITE + '?server=' + encodeURIComponent(SERVER), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__docao && window.__docao.renderer, null, { timeout: 20000 });
  await page.evaluate(() => { const r = window.__docao.renderer; r.setPixelRatio(1); r.shadowMap.enabled = false; });
  return page;
}
async function shot(page, name) {
  const path = OUT + '/' + name + '.png';
  try {
    await page.screenshot({ path, animations: 'disabled', timeout: 12000 });
  } catch (e) {
    const sz = existsSync(path) ? statSync(path).size : 0;
    if (sz < 20000) throw e;
    note('print ' + name + ' ficou no disco (' + sz + ') depois de ' + e.message);
  }
}
const send = (page, msg) => page.evaluate((m) => window.__docao.online.net.send({ t: 'testInv', ...m }), msg);
const state = (page) => page.evaluate(() => {
  const g = window.__docao, p = g.player, v = g.invView;
  const me = v && v.lives.get(g.online.myId);
  const hud = document.getElementById('downHud');
  return {
    alive: p.alive, down: !!p.down, hp: p.hp | 0, w: p.weapon, mag: p.mag && p.mag[9], res: p.reserve && p.reserve[9],
    pap: p.pap && p.pap[9], downMag: p.downMag, revP: p.revP || 0, lives: me && me.lives,
    pts: p.pts | 0, points: p.points | 0, purseN: p.purseN | 0,
    title: document.getElementById('wtitle') ? document.getElementById('wtitle').textContent : '',
    hptext: document.getElementById('hptext') ? document.getElementById('hptext').textContent : '',
    chip: (document.querySelector('#survPts span') || {}).textContent || '',
    score: (document.getElementById('score') || {}).innerText || '',
    downTitle: hud && !hud.classList.contains('hidden') ? document.getElementById('downTitle').textContent : '',
    fill: document.getElementById('downFill') ? document.getElementById('downFill').style.width : '',
    overlap: (() => {
      const msg = document.getElementById('centermsg');
      if (!hud || hud.classList.contains('hidden') || !msg || !msg.textContent.trim()) return false;
      const a = hud.getBoundingClientRect(), b = msg.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return false;
      return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    })(),
  };
});
function hold(page, on) {
  return page.evaluate((down) => {
    document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: 'KeyL', key: 'l', bubbles: true }));
  }, on);
}

const A = await client('Ana', 1280, 800);
const B = await client('Beto', 1280, 800);
await step('sala', 25000, async () => {
  await A.evaluate(() => {
    document.getElementById('onlineBtn').click();
    const mode = document.getElementById('roomMode'); mode.value = 'inv'; mode.dispatchEvent(new Event('change'));
    const surv = document.getElementById('roomSurv'); if (surv) { surv.value = 'survival'; surv.dispatchEvent(new Event('change')); }
    const bots = document.getElementById('roomBots'); if (bots) bots.value = '0';
    document.getElementById('createBtn').click();
  });
  await A.waitForFunction(() => window.__docao.online && window.__docao.online.myId > 0, null, { timeout: 15000 });
});
const code = await A.evaluate(() => window.__docao.online.code);
note('sala ' + code);
await step('beto', 30000, async () => {
  await B.goto(SITE + '?server=' + encodeURIComponent(SERVER) + '&sala=' + code, { waitUntil: 'domcontentloaded' });
  await B.waitForFunction(() => window.__docao.online && window.__docao.online.myId > 0, null, { timeout: 20000 });
});
await step('partida', 40000, async () => {
  await A.evaluate(() => document.getElementById('startOnline').click());
  await A.waitForFunction(() => window.__docao.state === 'playing' && window.__docao.player, null, { timeout: 30000 });
  await B.waitForFunction(() => window.__docao.state === 'playing' && window.__docao.player, null, { timeout: 30000 });
  const n = await A.evaluate(() => { const v = window.__docao.invView; return v && [...v.lives.values()].length; });
  if (n !== 2) throw new Error('vidas no host: ' + n);
  const nb = await B.evaluate(() => { const v = window.__docao.invView; return v && [...v.lives.values()].every((s) => s.lives === 2); });
  if (!nb) throw new Error('cliente não vê 2 corações');
  const hp = await A.evaluate(() => {
    const g = window.__docao;
    const mate = g.entities.find((e) => e !== g.player && !e.zt);
    return { a: g.player.hp | 0, b: mate ? mate.hp | 0 : -1, aa: g.player.alive, ba: !!(mate && mate.alive) };
  });
  if (!(hp.aa && hp.ba && hp.a >= 80 && hp.b >= 80)) throw new Error('saúde inválida no começo ' + JSON.stringify(hp));
});
const skipIa = process.env.SKIP_IA === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const purseOf = (page) => page.evaluate(() => ({ pts: window.__docao.player.pts | 0, points: window.__docao.player.points | 0, n: window.__docao.player.purseN | 0, hp: window.__docao.player.hp | 0, alive: window.__docao.player.alive, down: !!window.__docao.player.down }));
if (!skipIa) {
await step('compra-500', 20000, async () => {
  const s = await state(A);
  const sb = await state(B);
  if (s.pts !== 500 || s.points !== 500 || sb.pts !== 500 || s.chip !== '500' || /Pontos:/.test(s.score)) throw new Error('saldo inicial ' + JSON.stringify({ s, sb }));
  if (!s.alive || !sb.alive || s.hp < 80 || sb.hp < 80) throw new Error('jogadores sem saúde ' + JSON.stringify({ s, sb }));
  await shot(A, 'vivos-ana-1280');
  await shot(B, 'vivos-beto-1280');
  const bought = await A.evaluate(async () => {
    const g = window.__docao, p = g.player, o = g.online;
    const wall = g.survLayout && g.survLayout.walls && g.survLayout.walls.find((w) => w.price === 500);
    if (!wall) return { ok: false, why: 'sem parede de 500' };
    const before = p.pts | 0, n0 = p.purseN | 0;
    o.net.send({ t: 'testInv', pos: [wall.x, wall.y || 0, wall.z] });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(500);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }));
    const t0 = performance.now();
    while (performance.now() - t0 < 2500 && (p.pts | 0) === before) await sleep(80);
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', key: 'f', bubbles: true }));
    return { ok: true, before, after: p.pts | 0, points: p.points | 0, n: p.purseN | 0, n0 };
  });
  await sleep(400);
  const later = await purseOf(A);
  const bia = await purseOf(B);
  if (!bought.ok || later.pts !== 0 || later.points !== 0 || later.n <= bought.n0 || bia.pts !== 500) throw new Error('compra não zerou ' + JSON.stringify({ bought, later, bia }));
  note('parede 500→0 geração ' + later.n);
});
await step('zumbi-parede', 35000, async () => {
  await send(A, { fog: { cx: 0, cz: 0, r: 400, tx: 0, tz: 0, tr: 400 }, wave: 1 });
  await A.waitForFunction(() => window.__docao.entities.some((e) => e.zt && e.alive), null, { timeout: 12000 });
  await send(A, { clearQueue: true });
  await sleep(400);
  const split = await A.evaluate(() => {
    const g = window.__docao;
    const z = g.entities.find((e) => e.zt && e.alive);
    if (!z) return null;
    const solids = g.solids.filter((s) => (s.max.y - s.min.y) > 1.8 && Math.min(s.max.x - s.min.x, s.max.z - s.min.z) < 1.3);
    let best = null;
    for (const s of solids) {
      const thinX = (s.max.x - s.min.x) < (s.max.z - s.min.z);
      const cx = (s.min.x + s.max.x) / 2, cz = (s.min.z + s.max.z) / 2;
      const len = thinX ? s.max.z - s.min.z : s.max.x - s.min.x;
      if (len < 2.2) continue;
      const sides = thinX ? [[s.min.x - 1.15, cz], [s.max.x + 1.15, cz]] : [[cx, s.min.z - 1.15], [cx, s.max.z + 1.15]];
      const pts = sides.map(([x, zz]) => ({ x, z: zz, y: g.groundAt(x, zz, 4) }));
      if (pts.some((q) => g.collides(q.x, q.y + 0.4, q.z))) continue;
      if (g.los([pts[0].x, pts[0].y + 1.3, pts[0].z], [pts[1].x, pts[1].y + 1.3, pts[1].z])) continue;
      const da = Math.hypot(z.pos.x - pts[0].x, z.pos.z - pts[0].z);
      const db = Math.hypot(z.pos.x - pts[1].x, z.pos.z - pts[1].z);
      const near = da < db ? pts[0] : pts[1];
      const far = da < db ? pts[1] : pts[0];
      if (Math.min(da, db) > 22) continue;
      if (g.los([z.pos.x, z.pos.y + 1.2, z.pos.z], [far.x, far.y + 1.2, far.z])) continue;
      const score = Math.abs(da - db);
      const wall = { minx: s.min.x, maxx: s.max.x, minz: s.min.z, maxz: s.max.z, thinX };
      if (!best || score > best.score) best = { score, stand: [far.x, far.y, far.z], wall, zx: +z.pos.x.toFixed(2), zz: +z.pos.z.toFixed(2) };
    }
    return best && { stand: best.stand, wall: best.wall, zx: best.zx, zz: best.zz };
  });
  if (!split) throw new Error('sem parede entre o zumbi e um piso livre');
  await send(A, { pos: split.stand });
  await send(B, { pos: [split.stand[0] + 0.8, split.stand[1], split.stand[2]] });
  await sleep(600);
  const z0 = await A.evaluate(() => {
    const z = window.__docao.entities.find((e) => e.zt && e.alive);
    return z ? { x: z.pos.x, z: z.pos.z } : null;
  });
  if (!z0) throw new Error('zumbi sumiu');
  const samples = [z0];
  for (let i = 0; i < 8; i++) { await sleep(400); samples.push(await A.evaluate(() => { const z = window.__docao.entities.find((e) => e.zt && e.alive); return z ? { x: z.pos.x, z: z.pos.z } : null; })); }
  const path = samples.filter(Boolean);
  let walked = 0;
  for (let i = 1; i < path.length; i++) walked += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  const end = path[path.length - 1];
  const wall = split.wall;
  const sideOf = (q) => wall.thinX ? (q.x < wall.minx - 0.2 ? -1 : q.x > wall.maxx + 0.2 ? 1 : 0) : (q.z < wall.minz - 0.2 ? -1 : q.z > wall.maxz + 0.2 ? 1 : 0);
  const along = (q) => wall.thinX ? q.z : q.x;
  const crossed = path.some((q) => sideOf(q) !== 0 && sideOf(q) !== sideOf(z0) && along(q) > (wall.thinX ? wall.minz : wall.minx) && along(q) < (wall.thinX ? wall.maxz : wall.maxx));
  const lateral = Math.abs(along(end) - along(z0));
  const inside = await A.evaluate((pts) => pts.some((q) => window.__docao.collides(q.x, 0.4, q.z)), path);
  const health = await A.evaluate(() => {
    const g = window.__docao;
    const mate = g.entities.find((e) => e !== g.player && !e.zt);
    return { a: g.player.hp | 0, b: mate ? mate.hp | 0 : -1, aa: g.player.alive, ba: !!(mate && mate.alive), ad: !!g.player.down, bd: !!(mate && mate.down) };
  });
  const remote = await B.evaluate(() => { const z = window.__docao.entities.find((e) => e.zt && e.alive); return z ? { x: z.pos.x, z: z.pos.z } : null; });
  note('parede andou ' + walked.toFixed(2) + ' lateral ' + lateral.toFixed(2) + ' cruzou ' + crossed + ' hp ' + JSON.stringify(health));
  if (inside || crossed) throw new Error('zumbi atravessou a parede');
  if (!(walked > 0.7) || lateral < 0.35) throw new Error('zumbi não contornou');
  if (!(health.aa && health.ba && health.a > 0 && health.b > 0 && !health.ad && !health.bd)) throw new Error('saúde inválida na parede ' + JSON.stringify(health));
  if (!remote || Math.hypot(remote.x - end.x, remote.z - end.z) > 3) throw new Error('cliente não vê o mesmo zumbi');
  await A.evaluate((p) => { window.__cam = { p: [p.x + 7, p.y + 4, p.z + 7], t: [p.x, p.y + 1, p.z], fov: 42 }; }, { x: (z0.x + end.x) / 2, y: 0, z: (z0.z + end.z) / 2 });
  await sleep(200);
  await shot(A, 'ia-parede-1280');
  await A.evaluate(() => { window.__cam = null; });
});
await step('porta', 70000, async () => {
  await A.evaluate(() => window.__docao.online.net.send({ t: 'testGod', s: 40 }));
  await B.evaluate(() => window.__docao.online.net.send({ t: 'testGod', s: 40 }));
  await send(A, { killAll: true });
  let pts = (await purseOf(A)).pts;
  const tFarm = Date.now();
  while (pts < 750 && Date.now() - tFarm < 22000) {
    await send(A, { wave: 1 });
    await sleep(1600);
    await send(A, { killAll: true });
    pts = (await purseOf(A)).pts;
  }
  if (pts < 750) throw new Error('sem pontos pra porta ' + pts);
  await A.evaluate(() => window.__docao.online.net.send({ t: 'testGod', s: 0 }));
  await B.evaluate(() => window.__docao.online.net.send({ t: 'testGod', s: 0 }));
  await send(A, { killAll: true, wave: 1 });
  await A.waitForFunction(() => window.__docao.entities.some((e) => e.zt && e.alive), null, { timeout: 10000 });
  await send(A, { clearQueue: true });
  await send(A, { pos: [-16.9, 0, 24.9] });
  await send(B, { pos: [-18.6, 0, 26.4] });
  await sleep(400);
  const hp0 = (await purseOf(A)).hp;
  let near = null, held = 0;
  for (let i = 0; i < 36; i++) {
    await sleep(350);
    near = await A.evaluate(() => {
      const g = window.__docao, p = g.player;
      const zs = g.entities.filter((e) => e.zt && e.alive);
      if (!zs.length) return null;
      let best = zs[0], bd = Math.hypot(best.pos.x + 16, best.pos.z - 24.9);
      for (const z of zs) { const d = Math.hypot(z.pos.x + 16, z.pos.z - 24.9); if (d < bd) { bd = d; best = z; } }
      return { x: +best.pos.x.toFixed(2), d: +Math.hypot(best.pos.x - p.pos.x, best.pos.z - p.pos.z).toFixed(2), n: zs.length, hp: p.hp | 0 };
    });
    if (!near) throw new Error('zumbi sumiu na porta fechada');
    if (near.x < -16.2) throw new Error('zumbi cruzou a porta fechada x=' + near.x);
    if (near.hp !== hp0 || near.hp <= 0) throw new Error('mordida através da porta');
    // Alcance real da mordida do podre é 1,75 m. 2,56 m só mostra que o caminho parou.
    if (near.d < 1.75 && near.x > -16.2) held++;
    else held = 0;
    if (held >= 3) break;
  }
  const hb = (await purseOf(B)).hp;
  if (held < 3) throw new Error('mordida não medida: zumbi não entrou em 1,75 m com a porta fechada ' + JSON.stringify(near));
  if (hb <= 0) throw new Error('Beto morreu com a porta fechada');
  note('porta fechada encostado ' + JSON.stringify(near));
  await A.evaluate(() => {
    const g = window.__docao, p = g.player;
    const z = g.entities.filter((e) => e.zt && e.alive).sort((a, b) => a.pos.x - b.pos.x)[0];
    if (!z) return;
    window.__cam = { p: [-10, 3.4, 31], t: [(z.pos.x + p.pos.x) / 2, 1, 25], fov: 42 };
  });
  await shot(A, 'ia-porta-fechada-1280');
  await A.evaluate(() => { window.__cam = null; });
  const before = await purseOf(A);
  await A.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })));
  await sleep(200);
  await A.evaluate(() => document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true })));
  await A.waitForFunction((n) => (window.__docao.player.pts | 0) < n, before.pts, { timeout: 5000 });
  const paid = await purseOf(A);
  if (paid.pts !== before.pts - 750 || paid.points !== paid.pts || paid.n <= before.n) throw new Error('porta não debitou ' + JSON.stringify({ before, paid }));
  const bia = await purseOf(B);
  if (bia.pts !== 500) throw new Error('Beto perdeu saldo na porta da Ana ' + bia.pts);
  await send(A, { pos: [-20.5, 0, 24.9] });
  await send(B, { pos: [-20.5, 0, 26.2] });
  let crossed = null, health = null;
  for (let i = 0; i < 40 && !(crossed < -16.6); i++) {
    await sleep(200);
    const snap = await A.evaluate(() => {
      const g = window.__docao, mate = g.entities.find((e) => e !== g.player && !e.zt);
      const zs = g.entities.filter((e) => e.zt && e.alive);
      const x = zs.length ? Math.min(...zs.map((z) => z.pos.x)) : 99;
      return { x, a: g.player.hp | 0, b: mate ? mate.hp | 0 : -1, aa: g.player.alive, ba: !!(mate && mate.alive) };
    });
    crossed = snap.x; health = snap;
    if (crossed < -16.6) break;
  }
  const seen = await B.evaluate(() => {
    const zs = window.__docao.entities.filter((e) => e.zt && e.alive);
    return zs.length ? Math.min(...zs.map((z) => z.pos.x)) : null;
  });
  await send(A, { killAll: true });
  if (!(crossed < -16.6)) throw new Error('abrir a porta não liberou o zumbi x=' + crossed);
  if (seen == null || Math.abs(seen - crossed) > 4) throw new Error('cliente não viu a travessia ' + seen + ' vs ' + crossed);
  if (!(health.aa && health.ba && health.a > 0 && health.b > 0)) throw new Error('saúde inválida na porta ' + JSON.stringify(health));
  note('porta aberta zumbi x ' + crossed + ' cliente ' + seen);
  await send(A, { killAll: true, clearQueue: true, hold: true });
});
}
await step('prepara', 15000, async () => {
  await send(A, { hold: true, killAll: true, clearQueue: true, fog: { cx: 0, cz: 0, r: 400, tx: 0, tz: 0, tr: 400 }, gun: UZI, mag: 4, res: 9, tier: 2 });
  await A.waitForFunction(() => window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4, null, { timeout: 10000 });
});

async function place() {
  await send(A, { pos: [6, 0, 18] });
  await send(B, { pos: [6.9, 0, 18] });
  await A.waitForFunction(() => Math.hypot(window.__docao.player.pos.x - 6, window.__docao.player.pos.z - 18) < 1.6, null, { timeout: 8000 });
  await B.waitForFunction(() => Math.hypot(window.__docao.player.pos.x - 6.9, window.__docao.player.pos.z - 18) < 1.6, null, { timeout: 8000 });
}
async function heart(page, name) {
  await page.waitForFunction(() => window.__docao.time > window.__docao.player.invulnUntil, null, { timeout: 8000 });
  await send(page, { hurt: 500 });
  await page.waitForFunction(() => !window.__docao.player.alive && !window.__docao.player.down, null, { timeout: 8000 });
  const lives = await page.evaluate(() => window.__docao.invView.lives.get(window.__docao.online.myId).lives);
  if (lives !== 1) throw new Error(name + ' vidas ' + lives);
  await send(page, { rs: true });
  await page.waitForFunction(() => window.__docao.player.alive && window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4, null, { timeout: 8000 });
}
async function fall(page) {
  await page.waitForFunction(() => window.__docao.time > window.__docao.player.invulnUntil, null, { timeout: 8000 });
  await send(page, { hurt: 500 });
  await page.waitForFunction(() => window.__docao.player.down && window.__docao.player.alive && window.__docao.player.weapon === 4 && window.__docao.player.mag[9] === 4, null, { timeout: 8000 });
}
async function aim(page) {
  const info = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const g = window.__docao;
      const mate = g.entities.find((e) => e !== g.player && !e.zt && e.down);
      if (!mate || !mate.model) { resolve({ err: 'sem modelo' }); return; }
      if ((mate.downBlend || 0) < 0.9 && performance.now() - t0 < 1500) { requestAnimationFrame(tick); return; }
      const p = mate.pos;
      const yaw = mate.yaw || 0;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const target = [p.x + fx * 0.7, p.y + 0.32, p.z + fz * 0.7];
      let cam = null;
      for (const dist of [3.6, 4.8]) {
        for (const ang of [0.8, -0.8, 1.7, -1.7, 2.6]) {
          const c = [p.x + Math.sin(yaw + ang) * dist, p.y + 1.15, p.z + Math.cos(yaw + ang) * dist];
          if (!g.los(c, target)) continue;
          cam = c; break;
        }
        if (cam) break;
      }
      if (!cam) { resolve({ err: 'câmera sem linha até o corpo' }); return; }
      window.__cam = { p: cam, t: target, fov: 42 };
      const banner = document.getElementById('invBanner');
      if (banner) banner.classList.add('hidden');
      const rx = mate.model.group.rotation.x;
      const lift = mate.model.group.position.y - p.y;
      resolve({ blend: +(mate.downBlend || 0).toFixed(2), y: +p.y.toFixed(2), vis: mate.model.group.visible, rx: +rx.toFixed(2), lift: +lift.toFixed(2) });
    };
    tick();
  }));
  note('pose ' + JSON.stringify(info));
  if (!info || info.err) throw new Error('modelo caído fora da cena ' + JSON.stringify(info));
  if (!(info.rx > 1.2) || info.lift > 0.5) throw new Error('corpo não está deitado no chão ' + JSON.stringify(info));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

let purseMark = { pts: 0, points: 0, n: 0 };
await step('ciclo1-coracao', 20000, async () => { purseMark = await purseOf(A); await heart(A, 'Ana'); const back = await purseOf(A); if (back.pts !== purseMark.pts || back.points !== purseMark.points || back.n !== purseMark.n) throw new Error('respawn mexeu no saldo ' + JSON.stringify({ purseMark, back })); });
await step('ciclo1-cair', 20000, async () => {
  await place(); await fall(A);
  const before = await A.evaluate(() => ({ y: window.__docao.player.pos.y, w: window.__docao.player.weapon, x: window.__docao.player.pos.x, z: window.__docao.player.pos.z, mag: window.__docao.player.mag[9] }));
  await A.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
  });
  await sleep(700);
  await A.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
  });
  const after = await A.evaluate(() => ({ y: window.__docao.player.pos.y, w: window.__docao.player.weapon, x: window.__docao.player.pos.x, z: window.__docao.player.pos.z, mag: window.__docao.player.mag[9] }));
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  if (after.w !== 4 || after.mag !== 4) throw new Error('caído trocou ou gastou a arma guardada ' + JSON.stringify(after));
  if (after.y > before.y + 0.35) throw new Error('caído pulou');
  if (moved < 0.08 || moved > 2.4) throw new Error('rastejo fora do passo ' + moved.toFixed(2));
});
await step('ciclo1-prints-down', 20000, async () => {
  const s = await state(A);
  if (!s.downTitle.includes('caído')) throw new Error('prompt Ana: ' + s.downTitle);
  if (s.lives !== 0 || s.w !== 4 || s.mag !== 4) throw new Error('ana down ' + JSON.stringify(s));
  if (s.hptext !== 'CAÍDO' || s.overlap || s.pts !== purseMark.pts || s.points !== purseMark.points || s.purseN !== purseMark.n) throw new Error('HUD/saldo do caído ' + JSON.stringify(s));
  const livesB = await B.evaluate(() => window.__docao.invView.lives.get(window.__docao.online.myId).lives);
  if (livesB !== 2) throw new Error('Beto perdeu coração ' + livesB);
  await shot(A, 'down-1280-caido');
  await B.waitForFunction(() => window.__docao.entities.some((e) => e !== window.__docao.player && !e.zt && e.down), null, { timeout: 8000 });
  await aim(B);
  await shot(B, 'down-1280-pose');
});
await step('ciclo1-segura-e-solta', 20000, async () => {
  await hold(B, true);
  await A.waitForFunction(() => (window.__docao.player.revP || 0) > 0.15, null, { timeout: 8000 });
  await shot(B, 'down-1280-progresso');
  await shot(A, 'down-1280-progresso-caido');
  await hold(B, false);
  await B.evaluate(() => { window.__cam = null; });
  await A.waitForFunction(() => (window.__docao.player.revP || 0) === 0, null, { timeout: 5000 });
});
await step('ciclo1-revive', 20000, async () => {
  await hold(B, true);
  await A.waitForFunction(() => !window.__docao.player.down && window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4 && window.__docao.player.reserve[9] === 9 && window.__docao.player.pap[9] === 2, null, { timeout: 12000 });
  await hold(B, false);
  const s = await state(A);
  if (!s.title.includes('MP5K')) throw new Error('HUD ' + s.title);
  if (s.pts !== purseMark.pts || s.points !== purseMark.points || s.purseN !== purseMark.n) throw new Error('revive devolveu saldo ' + JSON.stringify(s));
  await shot(A, 'down-1280-armas');
});
await step('ciclo2-cair', 20000, async () => { await place(); await fall(A); });
await step('parede', 20000, async () => {
  const pair = await A.evaluate(() => {
    const g = window.__docao;
    const solids = g.solids.filter((s) => (s.max.y - s.min.y) > 1.6 && Math.min(s.max.x - s.min.x, s.max.z - s.min.z) < 0.9);
    for (const s of solids) {
      const thinX = (s.max.x - s.min.x) < (s.max.z - s.min.z);
      const cx = (s.min.x + s.max.x) / 2, cz = (s.min.z + s.max.z) / 2;
      const a = thinX ? [s.min.x - 0.75, 0, cz] : [cx, 0, s.min.z - 0.75];
      const b = thinX ? [s.max.x + 0.75, 0, cz] : [cx, 0, s.max.z + 0.75];
      if (Math.hypot(a[0] - b[0], a[2] - b[2]) > 2.05) continue;
      const ya = g.groundAt(a[0], a[2], 3), yb = g.groundAt(b[0], b[2], 3);
      if (g.collides(a[0], ya + 0.3, a[2]) || g.collides(b[0], yb + 0.3, b[2])) continue;
      if (g.los([a[0], ya + 1.5, a[2]], [b[0], yb + 0.32, b[2]])) continue;
      return { a: [a[0], ya, a[2]], b: [b[0], yb, b[2]] };
    }
    return null;
  });
  if (!pair) throw new Error('sem parede');
  await send(A, { pos: pair.a });
  await send(B, { pos: pair.b });
  await B.waitForFunction((p) => Math.hypot(window.__docao.player.pos.x - p[0], window.__docao.player.pos.z - p[2]) < 1.4, pair.b, { timeout: 8000 });
  await hold(B, true);
  await new Promise((r) => setTimeout(r, 1500));
  const rev = await A.evaluate(() => window.__docao.player.revP || 0);
  if (rev !== 0) throw new Error('parede encheu ' + rev);
  await hold(B, false);
  await shot(B, 'down-1280-parede');
  note('parede ' + pair.a.map((n) => n.toFixed(1)).join(','));
});
await step('ciclo2-revive', 20000, async () => {
  await place();
  await hold(B, true);
  await A.waitForFunction(() => !window.__docao.player.down && window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4, null, { timeout: 12000 });
  await hold(B, false);
});

await step('viewport-1440', 10000, async () => {
  await A.setViewportSize({ width: 1440, height: 900 });
  await B.setViewportSize({ width: 1440, height: 900 });
});
await step('cliente-arma', 15000, async () => {
  await send(B, { gun: UZI, mag: 4, res: 9, tier: 2 });
  await B.waitForFunction(() => window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4, null, { timeout: 8000 });
});
await step('cliente-coracao', 20000, () => heart(B, 'Beto'));
await step('cliente-cair', 20000, async () => { await place(); await fall(B); });
await step('cliente-prints', 25000, async () => {
  const s = await state(B);
  if (s.w !== 4 || s.mag !== 4 || !s.down) throw new Error('beto down ' + JSON.stringify(s));
  await shot(B, 'down-1440-caido');
  await A.waitForFunction(() => window.__docao.entities.some((e) => e !== window.__docao.player && !e.zt && e.down), null, { timeout: 8000 });
  await aim(A);
  await shot(A, 'down-1440-pose');
  await hold(A, true);
  await B.waitForFunction(() => (window.__docao.player.revP || 0) > 0.15, null, { timeout: 8000 });
  await shot(A, 'down-1440-progresso');
  await hold(A, false);
  await A.evaluate(() => { window.__cam = null; });
  await B.waitForFunction(() => (window.__docao.player.revP || 0) === 0, null, { timeout: 5000 });
  await hold(A, true);
  await B.waitForFunction(() => !window.__docao.player.down && window.__docao.player.weapon === 9 && window.__docao.player.mag[9] === 4 && window.__docao.player.reserve[9] === 9, null, { timeout: 12000 });
  await hold(A, false);
  const back = await state(B);
  if (!back.title.includes('MP5K')) throw new Error('HUD beto ' + back.title);
  await shot(B, 'down-1440-armas');
});

note('webkit fechou hold, cancelamento, parede, cliente e os dois ciclos');
await finish('ok');

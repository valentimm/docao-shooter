// CJ05 (tanque), LGPD (jetpack) e BIG (3×). Regras + servidor, e WebKit com dois clientes se o site e o worker estiverem no ar.
// Servidor: cd server && npx wrangler dev --port 8787 --ip 127.0.0.1 --var ALLOW_TEST:1
// Site: python3 -m http.server 8124
// Uso: node test-gta-cheats.mjs [http://127.0.0.1:8124/] [ws://127.0.0.1:8787]
// SKIP_CLIENT=1 pula o navegador.
import { mkdirSync } from 'fs';
import { Game } from './server/src/game.js';
import { getMap } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';
import { traceShot } from './shared/penetration.js';
import { WEAPONS, HEIGHT, RADIUS } from './shared/rules.js';
import { TANK, JET, BIG, SUBIDO, W_TANK, NARROW_DOOR, SHORT_DOOR, tankFitsDoors, applyCheatText, stepCheats, packCheats, unpackCheats, isTankCode, isJetCode, isBigCode, isSubidoCode, subidoTaken } from './shared/gta-cheats.js';

const SITE = process.argv[2] || process.env.SITE || 'http://127.0.0.1:8124/';
const SERVER = process.argv[3] || process.env.SERVER || 'ws://127.0.0.1:8787';
const OUT = '/opt/cursor/artifacts/gta-cheats';
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

// ---- regras ----
ok(tankFitsDoors(), `tanque cabe: altura ${TANK.height} < ${HEIGHT} e < vão ${SHORT_DOOR}, diâmetro ${(TANK.radius * 2).toFixed(2)} < porta ${NARROW_DOOR}`);
ok(TANK.hp === 1000 && TANK.radius > RADIUS && TANK.height < HEIGHT, `vida 1000, mais largo que o Docão e mais baixo`);
ok(JET.time === 18 && JET.safeFall === 4 && JET.up > 0 && JET.sink < 0, `jetpack ${JET.time}s, subida ${JET.up}, descida segura ${JET.safeFall}`);
ok(BIG.scale === 3 && BIG.time === 20 && BIG.hit[0][1] === 1.5 && BIG.capsule.r > 1, `BIG 3× por ${BIG.time}s, hitbox da cabeça raio ${BIG.hit[0][1]}`);
ok(isTankCode('CJ05') && isTankCode('cj05!') && !isTankCode('CJ050') && isJetCode('lgpd') && isBigCode('BIG') && !isBigCode('bigode') && isSubidoCode('SUBIDO') && isSubidoCode('subido!') && !isSubidoCode('subidos'), 'códigos são a palavra inteira');
ok(SUBIDO.dmgMul === 0.75 && Math.abs(subidoTaken({ subido: true }, 40) - 30) < 1e-9 && subidoTaken({ subido: false }, 40) === 40, 'SUBIDO toma 25% menos dano');
ok(W_TANK === -6 && !WEAPONS.some((w) => w && w.key === 'cj05'), 'canhão não entra no arsenal');
{
  const e = { alive: true, hp: 30, vel: { y: 0 }, crouch: 0.4 };
  ok(applyCheatText(e, 'CJ05', 0).includes('1000') && e.hp === 1000 && e.tank && e.crouch === 0 && e.bodyH === TANK.height && e.bodyR === TANK.radius, 'CJ05 liga o tanque com 1000 de vida');
  e.hp = 40; ok(applyCheatText(e, 'CJ05', 1) === 'Saiu do tanque' && !e.tank && e.hp === 40, 'CJ05 de novo sai e a vida volta no máximo a 100');
  ok(applyCheatText(e, 'LGPD', 5).includes('18') && e.jet && e.jetUntil === 23, 'LGPD liga 18 s');
  ok(applyCheatText(e, 'LGPD', 6) === '', 'LGPD de novo não renova');
  e.onGround = false; stepCheats(e, 23.01, false); ok(!e.jet && e.jetGlide, 'acabou no ar: descida');
  stepCheats(e, 30, true); ok(!e.jetGlide, 'encostou no chão: jetpack acaba');
  ok(applyCheatText(e, 'BIG', 0).includes('3') && e.big && e.bodyH === HEIGHT * 3, 'BIG triplica a altura de colisão');
  ok(applyCheatText({ alive: true, hp: 10, vel: { y: 0 }, tank: true, crouch: 0 }, 'BIG', 0).includes('tanque'), 'BIG no tanque não empilha');
  ok(applyCheatText({ alive: false, hp: 0 }, 'CJ05', 0) === null, 'morto não ganha cheat');
  const p = { alive: true, hp: 100, vel: { y: 0 }, crouch: 0, jet: true, big: true, subido: true };
  applyCheatText(p, 'CJ05', 1); ok(p.tank && !p.jet && !p.big && p.subido && p.hp === 1000, 'entrar no tanque desliga jetpack e BIG e mantém SUBIDO');
  const s = { alive: true, hp: 80, vel: { y: 0 }, crouch: 0, jet: true, big: true };
  ok(applyCheatText(s, 'SUBIDO', 3).includes('25%') && s.subido && s.jet && s.big, 'SUBIDO empilha com LGPD e BIG');
  ok(applyCheatText(s, 'SUBIDO', 4) === 'A brisa passou' && !s.subido && s.jet && s.big, 'SUBIDO de novo desliga sem mexer no jetpack nem no BIG');
  const [sf] = packCheats({ subido: true, tank: false, jet: false, big: false, jetGlide: false }, 0);
  ok((sf & 16) === 16, 'SUBIDO vai no bit 16');
}
{
  const map = getMap('vizinhanca-cheers');
  const P = createPhysics(mapSolids(map), map.size);
  const x = -20.2; let blocked = 0;
  for (let z = -19.2; z <= -16.4; z += 0.15) {
    const y = P.groundAt(x, z, 2);
    if (P.overlapping(x, y, z, 0, TANK.height, TANK.radius)) blocked++;
  }
  ok(blocked === 0, `tanque atravessa a porta de 1,6 m da garagem da Vizinhança (amostras bloqueadas ${blocked})`);
}
{
  const P = createPhysics([], [40, 40]);
  const W = { dmg: 10, headMul: 2, range: 50, pen: 0, pierce: 0, pierceMul: 1 };
  const o = { x: 0, y: 1.6, z: 0 }, d = { x: 0, y: 0, z: 1 };
  const feet = { x: 1.15, y: 0, z: 10 };
  const miss = traceShot(P, o, d, W, [{ e: 1, p: feet, crouch: 0, size: 1 }]);
  const hit = traceShot(P, o, d, W, [{ e: 1, p: feet, crouch: 0, spheres: BIG.hit }]);
  ok(miss.hits.length === 0 && hit.hits.length === 1, `BIG é acertado por um tiro que passa longe do corpo normal (${miss.hits.length} → ${hit.hits.length})`);
}

// ---- servidor (qualquer modo, inclusive Gunfight e Survival) ----
function boot(mode) {
  const personal = new Map();
  const snaps = [];
  const io = {
    send(id, m) { if (m && m.t === 'p' && m.ev) personal.set(id, (personal.get(id) || []).concat(m.ev)); },
    broadcast(m) { if (m && m.t === 's') snaps.push(m); },
    startLoop() {}, stopLoop() {},
  };
  const g = new Game({ code: 'GTA' + mode, map: 'arena', max: 4, fillBots: false, mode }, io);
  let fake = 5000; g.now = () => fake;
  const a = g.join({ name: 'Ana' }).ent; const b = g.join({ name: 'Beto' }).ent;
  g.welcome(a); g.welcome(b); a.connected = b.connected = true;
  g.onMessage(a.id, { t: 'start' });
  const tick = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { fake += dt; g.tick(); } };
  tick(6);
  return { g, a, b, personal, snaps, tick };
}
for (const mode of ['dm', 'gf', 'survival']) {
  const { g, a, personal, tick } = boot(mode);
  personal.clear();
  g.onMessage(a.id, { t: 'say', text: 'CJ05' });
  tick(1);
  const msg = (personal.get(a.id) || []).find((e) => e[0] === 'gtam');
  const row = g.io && null;
  ok(g.state === 'playing' && a.tank && a.hp === 1000 && msg && String(msg[1]).includes('1000'), `${mode}: CJ05 dá o tanque com 1000 (${a.hp}, gf ${g.gfMode}, surv ${!!g.survival})`);
  void row;
}
{
  const { g, a, b, snaps, tick } = boot('dm');
  tick(50); // sai do escudo de nascimento
  g.onMessage(a.id, { t: 'say', text: 'CJ05' });
  a.invulnUntil = 0; a.spawnLock = 0;
  let aim = null;
  for (let i = 0; i < 24 && !aim; i++) {
    const ang = i / 24 * Math.PI * 2, dir = { x: Math.cos(ang), y: 0, z: Math.sin(ang) };
    const o = { x: a.pos.x, y: a.pos.y + TANK.eye, z: a.pos.z };
    const wall = g.P.rayWorld(o, dir, 12);
    if (wall != null && wall < 8) continue;
    aim = dir;
    b.pos = { x: a.pos.x + dir.x * 5, y: a.pos.y, z: a.pos.z + dir.z * 5 };
    b.alive = true; b.hp = 200; b.invulnUntil = 0; b.spawnLock = 0;
  }
  ok(!!aim, 'servidor: achou linha livre pro canhão');
  if (!aim) aim = { x: 1, y: 0, z: 0 };
  const before = g.rockets.length;
  const eye = [a.pos.x, a.pos.y + TANK.eye, a.pos.z];
  g.onEvent(a, ['tc', eye, [aim.x, aim.y, aim.z]]);
  ok(g.rockets.length === before + 1 && g.rockets.at(-1).tank && g.rockets.at(-1).spd === TANK.cannon.speed, `servidor: canhão do tanque sai a ${TANK.cannon.speed} m/s`);
  g.onEvent(a, ['tc', eye, [aim.x, aim.y, aim.z]]);
  ok(g.rockets.length === before + 1, 'servidor: segundo canhão no mesmo instante é recusado');
  const hp0 = b.hp;
  tick(30);
  ok(b.hp < hp0, `servidor: o canhão machuca (${hp0} → ${b.hp})`);
  a.hp = 400;
  g.onMessage(a.id, { t: 'say', text: 'CJ05' });
  ok(!a.tank && a.hp === 100, `servidor: sair do tanque corta a vida para 100 (${a.hp})`);
  g.onMessage(a.id, { t: 'say', text: 'LGPD' });
  const until = a.jetUntil;
  ok(a.jet && Math.abs(until - g.T - JET.time) < 0.2, `servidor: jetpack dura ${JET.time}s`);
  a.onGround = false;
  while (g.T < until + 0.05) tick(1);
  ok(!a.jet && a.jetGlide, 'servidor: no ar, o fim do combustível vira descida');
  a.onGround = true; tick(1);
  ok(!a.jetGlide, 'servidor: no chão a descida acaba');
  g.onMessage(a.id, { t: 'say', text: 'BIG' });
  tick(1);
  const row = snaps.at(-1).e.find((r) => r[0] === a.id);
  ok(a.big && a.bodyH === 6 && row && (row[15] & 4) === 4 && row[17] > 0, `servidor: BIG vai no snapshot (flags ${row && row[15]}, resta ${row && row[17]})`);
  const other = { alive: true };
  unpackCheats(other, row[15], row[16], row[17]);
  ok(other.big && other.hitSpheres && other.hitSpheres[0][1] === 1.5, 'cliente: o snapshot do BIG aumenta a hitbox');
  g.onMessage(a.id, { t: 'say', text: 'SUBIDO' });
  a.invulnUntil = 0;
  const hpS = a.hp;
  g.damage(a, 40, b, 0, false);
  ok(a.subido && Math.abs(hpS - a.hp - 40 * SUBIDO.dmgMul) < 0.01, `servidor: SUBIDO toma ${hpS - a.hp} de 40 (${SUBIDO.dmgMul})`);
  tick(1);
  const srow = snaps.at(-1).e.find((r) => r[0] === a.id);
  ok(srow && (srow[15] & 16) === 16, `servidor: SUBIDO vai no snapshot (${srow && srow[15]})`);
  g.onMessage(a.id, { t: 'say', text: 'SUBIDO' });
  const hpOff = a.hp;
  g.damage(a, 40, b, 0, false);
  ok(!a.subido && Math.abs(hpOff - a.hp - 40) < 0.01, `servidor: sem SUBIDO o dano volta a 40 (${hpOff - a.hp})`);
  g.onMessage(a.id, { t: 'say', text: 'SUBIDO' });
  g.kill(a, b, 0, false);
  ok(!a.big && !a.tank && !a.jet && !a.subido && !a.alive, 'servidor: morrer limpa os cheats, inclusive SUBIDO');
  const [flags] = packCheats(a, g.T);
  ok(flags === 0, 'pacote zerado depois da morte');
}

if (process.env.SKIP_CLIENT) {
  if (fails.length) { console.log('FALHOU', fails.length); process.exit(1); }
  console.log('regras e servidor ok');
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const { webkit } = await import('playwright');
const browser = await webkit.launch();
const hard = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + ms)), ms))]);
async function bootPage(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => {
    const m = String(e.message || e);
    if (/Failed to start the audio device/i.test(m)) return; // WebKit sem dispositivo de áudio (esta VM): o resume rejeita
    errors.push(m.slice(0, 180));
  });
  await page.addInitScript((n) => { try { localStorage.setItem('docao.name', n); localStorage.setItem('docao.mode', 'dm'); } catch (e) {} }, name);
  await page.goto(SITE + (SITE.includes('?') ? '&' : '?') + 'server=' + encodeURIComponent(SERVER), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__docao && window.__docao.renderer, null, { timeout: 25000 });
  await page.evaluate(() => { const r = window.__docao.renderer; r.setPixelRatio(1); if (r.shadowMap) r.shadowMap.enabled = false; });
  return { ctx, page, errors };
}
async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, timeout: 8000 });
  console.log('shot ' + path);
  return path;
}
async function until(page, fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(150);
  }
  return false;
}
async function say(page, text) {
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(150);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
}
async function tp(page, x, y, z, yaw, pitch = 0) {
  await page.evaluate(({ x, y, z, yaw, pitch }) => {
    const g = window.__docao, p = g.player;
    p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.onGround = true;
    g.online.net.send({ t: 'u', sq: p.sq, tp: 1, p: [x, y, z], v: [0, 0, 0], y: yaw, pi: pitch, g: 1, w: p.weapon, c: 0 });
  }, { x, y, z, yaw, pitch });
}

let ana, beto;
try {
  ana = await bootPage('Ana');
  beto = await bootPage('Beto');
  await ana.page.click('#onlineBtn');
  await ana.page.selectOption('#roomMap', 'vizinhanca-cheers');
  await ana.page.selectOption('#roomBots', '0');
  await ana.page.selectOption('#roomMax', '2');
  await ana.page.click('#createBtn');
  ok(await until(ana.page, () => window.__docao.online && window.__docao.online.code, 15000), 'Ana criou a sala');
  const code = await ana.page.evaluate(() => window.__docao.online.code);
  await beto.page.click('#onlineBtn');
  await beto.page.click('#tabJoin');
  await beto.page.fill('#joinCode', code);
  await beto.page.click('#joinBtn');
  ok(await until(beto.page, () => window.__docao.online && window.__docao.online.myId > 0, 15000), 'Beto entrou na sala ' + code);
  await ana.page.click('#startOnline');
  ok(await until(ana.page, () => window.__docao.state === 'playing' && window.__docao.player && window.__docao.player.alive, 20000), 'partida começou');
  ok(await until(beto.page, () => window.__docao.state === 'playing' && window.__docao.player && window.__docao.player.alive, 20000), 'Beto está na partida');

  // BIG primeiro, no meio da rua (cabe os 6 m de altura)
  await say(ana.page, 'BIG');
  ok(await until(ana.page, () => window.__docao.gta && window.__docao.gta.big && window.__docao.gta.hpCap === 100, 8000), 'Ana ficou grande');
  await tp(ana.page, -2, 0, 12, Math.PI, 0);
  await tp(beto.page, -2, 0, 20, 0, 0.18);
  await ana.page.waitForTimeout(700);
  const bigRemote = await beto.page.evaluate(() => {
    const me = window.__docao.player;
    const o = window.__docao.entities.find((e) => e !== me && e.alive && !e.bot);
    return o ? { big: !!o.big, scale: +o.model.group.scale.x.toFixed(2), hit: o.hitSpheres ? o.hitSpheres[0][1] : 0 } : null;
  });
  ok(!!bigRemote && bigRemote.big && bigRemote.scale === 3 && bigRemote.hit === 1.5, `Beto vê o BIG (escala ${bigRemote && bigRemote.scale}, hit ${bigRemote && bigRemote.hit})`);
  const povBig = await ana.page.evaluate(() => window.__docao.gta.eye);
  ok(povBig > 4.5 && povBig < 5.2, `POV do BIG acompanha o tamanho (olho a ${povBig} m)`);
  await shot(beto.page, 'big-outro');
  await shot(ana.page, 'big-pov');

  // CJ05 no lugar do BIG (o tanque desliga o tamanho)
  await say(ana.page, 'CJ05');
  ok(await until(ana.page, () => window.__docao.gta && window.__docao.gta.tank && window.__docao.gta.hp >= 1000, 8000), 'Ana entrou no tanque');
  await tp(ana.page, -20.2, 0, -17.75, 0, -0.22);
  await tp(beto.page, -16.5, 0, -20.2, Math.atan2(-(-20.2 - -16.5), -(-17.75 - -20.2)), -0.12);
  await ana.page.waitForTimeout(800);
  const tankRemote = await beto.page.evaluate(() => {
    const me = window.__docao.player;
    const o = window.__docao.entities.find((e) => e !== me && e.alive && !e.bot);
    if (!o) return null;
    return { tank: !!o.tank, hp: o.hp, scale: +o.model.group.scale.y.toFixed(2), vis: !!(o.tankView && o.tankView.visible), x: +o.pos.x.toFixed(2), z: +o.pos.z.toFixed(2) };
  });
  ok(!!tankRemote && tankRemote.tank && tankRemote.hp >= 1000 && tankRemote.vis && Math.abs(tankRemote.x + 20.2) < 0.4, `Beto vê o tanque na porta (${JSON.stringify(tankRemote)})`);
  const povTank = await ana.page.evaluate(() => window.__docao.gta);
  ok(povTank.tank && Math.abs(povTank.eye - TANK.eye) < 0.25 && povTank.hud.includes('TANQUE'), `POV dentro do tanque (olho ${povTank.eye}, hud ${povTank.hud})`);
  await shot(beto.page, 'cj05-porta');
  await shot(ana.page, 'cj05-pov');

  await say(ana.page, 'CJ05');
  ok(await until(ana.page, () => window.__docao.gta && !window.__docao.gta.tank && window.__docao.gta.hp <= 100, 8000), 'Ana saiu do tanque');
  await say(ana.page, 'LGPD');
  ok(await until(ana.page, () => window.__docao.gta && window.__docao.gta.jet && window.__docao.gta.hud.includes('JETPACK'), 8000), 'Ana ligou o jetpack');
  await tp(ana.page, -2, 0, 12, 0.4, -0.4);
  await ana.page.keyboard.down('Space');
  await ana.page.waitForTimeout(1200);
  const fly = await ana.page.evaluate(() => { const g = window.__docao.gta; return { y: +window.__docao.player.pos.y.toFixed(2), hud: g.hud, jet: g.jet, left: g.jetLeft }; });
  await ana.page.keyboard.up('Space');
  ok(fly.jet && fly.y > 2 && fly.hud.includes('JETPACK') && fly.left < JET.time && fly.left > 1, `jetpack no ar com o tempo no HUD (${JSON.stringify(fly)})`);
  const jetRemote = await beto.page.evaluate(() => {
    const me = window.__docao.player;
    const o = window.__docao.entities.find((e) => e !== me && e.alive && !e.bot);
    return o ? { jet: !!o.jet, y: +o.pos.y.toFixed(2) } : null;
  });
  ok(!!jetRemote && jetRemote.jet && jetRemote.y > 1.5, `Beto vê a Ana de jetpack no ar (${JSON.stringify(jetRemote)})`);
  await shot(ana.page, 'lgpd-jetpack');

  await say(ana.page, 'SUBIDO');
  ok(await until(ana.page, () => window.__docao.gta && window.__docao.gta.subido && window.__docao.gta.green && window.__docao.gta.hud.includes('SUBIDO'), 8000), 'Ana ficou subida');
  await tp(ana.page, -2, 0, 12, Math.PI, -0.05);
  await ana.page.waitForTimeout(500);
  const ay = await ana.page.evaluate(() => window.__docao.player.pos.y);
  await tp(beto.page, -2, 0, 20, 0, Math.max(-0.2, Math.min(0.7, Math.atan2((ay || 0) - 1.2, 8))));
  await ana.page.waitForTimeout(400);
  const green = await ana.page.evaluate(() => {
    const mag = getComputedStyle(document.getElementById('mag')).color;
    const m = mag.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const g = window.__docao.gta;
    return { mag, ok: !!(m && +m[2] > +m[1] + 40 && +m[2] > 140), wave: g.wave, hud: g.hud, low: g.lowHz };
  });
  ok(green.ok && green.wave && green.hud.includes('SUBIDO'), `HUD verde e onda (${JSON.stringify(green)})`);
  await ana.page.evaluate(() => {
    const kf = document.getElementById('killfeed');
    const d = document.createElement('div'); d.className = 'kf';
    d.innerHTML = '<b class="me">Ana</b> pururucou <b>Beto</b>';
    kf.prepend(d);
  });
  await shot(ana.page, 'subido-pov');
  const aura = await beto.page.evaluate(() => {
    const me = window.__docao.player;
    const o = window.__docao.entities.find((e) => e !== me && e.alive && !e.bot);
    const mine = document.body.classList.contains('subido');
    return o ? { subido: !!o.subido, haze: !!(o.subidoView && o.subidoView.visible), mine } : { mine };
  });
  ok(!!aura && aura.subido && aura.haze && !aura.mine, `Beto vê a fumacinha e o HUD dele não fica verde (${JSON.stringify(aura)})`);
  await shot(beto.page, 'subido-outro');
  await say(ana.page, 'SUBIDO');
  ok(await until(ana.page, () => window.__docao.gta && !window.__docao.gta.subido && !window.__docao.gta.green, 8000), 'SUBIDO de novo desliga o HUD');
  await say(ana.page, 'SUBIDO');
  ok(await until(ana.page, () => window.__docao.gta && window.__docao.gta.subido, 8000), 'SUBIDO liga de novo antes da morte');
  await beto.page.evaluate(() => window.__docao.online.net.send({ t: 'testKill' }));
  ok(await until(ana.page, () => window.__docao.player && !window.__docao.player.alive && window.__docao.gta && !window.__docao.gta.subido && !document.body.classList.contains('subido'), 8000), 'morrer acaba o SUBIDO');
  ok(ana.errors.length === 0 && beto.errors.length === 0, 'sem erro de página' + (ana.errors[0] || beto.errors[0] ? ': ' + (ana.errors[0] || beto.errors[0]) : ''));
} catch (e) {
  ok(false, 'navegador: ' + (e && e.message ? e.message : e));
} finally {
  await browser.close();
}

if (fails.length) { console.log('FALHOU', fails.length); process.exit(1); }
console.log('tudo certo');

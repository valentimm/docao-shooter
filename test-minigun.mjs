// Minigun (20): "minigun" no chat troca a primária até morrer; embala 0,6 s (botão direito só embala), ~20 tiros/s, esquenta e trava,
// 600 tiros sem reserva, sem penalidade de movimento, sem zoom. Servidor confere embalo, cadência (balde de fichas) e calor.
// Uso: SITE=http://localhost:8123/ node test-minigun.mjs   (SKIP_CLIENT=1 roda só regras + servidor)
import { chromium } from 'playwright';
import { Game } from './server/src/game.js';
import { WEAPONS, PRIMARIES, BOT_PRIMARIES, CATEGORIES, BOT_RANGE, MINIGUN, isMiniCode, isPokeCode } from './shared/rules.js';
import { killIcon } from './killfeed-icons.js';
const SITE = process.env.SITE || 'http://localhost:8123/';
const fails = [], errors = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

// ---- regras ----
ok(MINIGUN === 20 && WEAPONS[20] && WEAPONS[20].key === 'minigun' && WEAPONS.length === 28 && WEAPONS[21] && WEAPONS[21].key === 'lmg' && WEAPONS[22] && WEAPONS[22].key === 'commando' && WEAPONS[23].key === 'capataz' && WEAPONS[25].key === 'tampa' && WEAPONS[26].key === 'faca-dourada' && WEAPONS[27].key === 'ray' && !PRIMARIES.includes(27) && WEAPONS.every(Boolean), `WEAPONS[20] = minigun, depois lmg, commando, capataz, tampa, faca dourada e ray fora do arsenal, sem buraco (${WEAPONS.length})`);
ok(!PRIMARIES.includes(20) && !BOT_PRIMARIES.includes(20) && !CATEGORIES.some((c) => (c.weapons || c.list || []).includes(20)), 'minigun fora do Arsenal e dos bots');
ok(BOT_RANGE.length === WEAPONS.length, `BOT_RANGE contínuo (${BOT_RANGE.length})`);
ok(isMiniCode('minigun') && isMiniCode('MINIGUN!') && isMiniCode('quero a mini gun') && isMiniCode('mini-gun') && !isMiniCode('mini') && !isMiniCode('gun') && !isMiniCode('pokebola') && !isPokeCode('minigun'), 'código: minigun, mini gun, mini-gun');
ok(killIcon('minigun') !== killIcon('rifle'), 'ícone próprio no killfeed');

// ---- servidor ----
{
  const g = new Game({ code: 'TEST', map: 'arena', max: 8, fillBots: true, mode: 'dm' }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' }); a.connected = true;
  const bot = [...g.ents.values()].find((e) => e.bot); let spot = null, dir = null;
  const pin = () => { if (spot && bot.alive) { bot.pos = { ...spot }; bot.vel = { x: 0, y: 0, z: 0 }; } a.vel = { x: 0, y: 0, z: 0 }; if (a.alive) { a.hp = 100; a.invulnUntil = 1e9; } }; // atirar tira a proteção: mantém A vivo
  const step = (n = 1, d = 0.05) => { for (let i = 0; i < n; i++) { fake += d; pin(); g.tick(); pin(); } };
  step(5);
  a.alive = true; a.hp = 100; a.invulnUntil = 1e9;
  const eye = () => [a.pos.x, a.pos.y + 1.6, a.pos.z];
  const evs = []; g.io.broadcast = (m) => { if (m && Array.isArray(m.ev)) evs.push(...m.ev); };
  const shoot = (ct) => { const n0 = a.mag[20], r0 = a.rejectedShots || 0; g.onEvent(a, ['f', eye(), [dir], 20, +ct.toFixed(3), g.T]); return { ok: a.mag[20] === n0 - 1, rej: (a.rejectedShots || 0) > r0 }; };
  // bot parado a ~7 m com linha livre
  for (let i = 0; i < 400 && !spot; i++) {
    const ang = Math.random() * Math.PI * 2, R = 6 + Math.random() * 3, p = { x: a.pos.x + Math.sin(ang) * R, z: a.pos.z + Math.cos(ang) * R }, y = g.P.groundAt(p.x, p.z, a.pos.y + 3);
    if (!Number.isFinite(y) || Math.abs(y - a.pos.y) > 0.6) continue;
    const o = { x: a.pos.x, y: a.pos.y + 1.6, z: a.pos.z }, dd = { x: p.x - o.x, y: y + 1.0 - o.y, z: p.z - o.z }, L = Math.hypot(dd.x, dd.y, dd.z), u = { x: dd.x / L, y: dd.y / L, z: dd.z / L };
    const w = g.P.rayWorld(o, u, 60); if (w == null || w > L + 1) { spot = { x: p.x, y, z: p.z }; dir = [u.x, u.y, u.z]; }
  }
  ok(!!spot, 'servidor: achou linha livre pro bot');
  bot.alive = true; bot.hp = 100; bot.invulnUntil = 1e9; step(2);
  // sem o código, a 20 não atira
  let r = shoot(fake); ok(!r.ok && r.rej && !a.slots.includes(20), 'servidor: sem o código a minigun não atira');
  g.onEvent(a, ['pr', 20, 4, 7]); ok(a.nextPrimary !== 20, `servidor: 'pr' não aceita a 20 (${a.nextPrimary})`);
  a.alive = false; g.onMessage(a.id, { t: 'say', text: 'minigun' }); ok(a.slots[0] !== 20, 'servidor: morto, o código não dá nada');
  a.alive = true; g.personal.clear(); g.onMessage(a.id, { t: 'say', text: 'minigun' });
  ok(a.slots[0] === 20 && a.weapon === 20 && a.mag[20] === 600 && a.reserve[20] === 0 && (g.personal.get(a.id) || []).some((e) => e[0] === 'mgn'), `servidor: "minigun" no chat dá a minigun (${a.slots}, ${a.weapon}, ${a.mag[20]}/${a.reserve[20]})`);
  // embalo obrigatório
  step(4); let ct = fake; g.events.length = 0;
  g.onEvent(a, ['mgs', 1, ct]); ok(g.events.some((e) => e[0] === 'mgs' && e[1] === a.id && e[2] === 1), "servidor: repassa ['mgs', id, 1]");
  step(6); r = shoot(ct + 0.3); ok(!r.ok && r.rej, 'servidor: tiro com 0,3 s de embalo é recusado');
  while (fake < ct + 0.62) step(1, 0.02);
  g.events.length = 0; r = shoot(ct + 0.62); const sh = g.events.find((e) => e[0] === 'sh' && e[1] === a.id);
  ok(r.ok && a.mag[20] === 599 && sh && sh[2] === 20, `servidor: embalado, atira (pente ${a.mag[20]}, sh ${!!sh})`);
  ct += 0.62;
  // cadência: 3 tiros no mesmo pacote passam (balde); um colado demais não
  step(6); ct = fake;
  const pk = [shoot(ct), shoot(ct + 0.045), shoot(ct + 0.09)]; ct += 0.09;
  ok(pk.every((x) => x.ok), `servidor: 3 tiros no mesmo pacote aceitos (${pk.map((x) => x.ok)})`);
  r = shoot(ct + 0.02); ok(!r.ok, 'servidor: tiro colado (0,02 s) recusado');
  // cliente 2x mais rápido que o servidor: recusa
  const rj0 = a.rejectedShots || 0;
  for (let i = 0; i < 60; i++) { ct += 0.045; fake += 0.0225; if (i % 2) { pin(); g.tick(); } a.mag[20] = 150; shoot(ct); }
  ok((a.rejectedShots || 0) > rj0, `servidor: relógio acelerado é recusado (${(a.rejectedShots || 0) - rj0} recusas)`);
  while (fake < ct + 0.2) step(1); ct = fake;
  // calor: sem parar, trava perto do tiro 250 (servidor soma heat×0,8; 0,005 esquenta bem mais devagar)
  a.mg.heat = 0; a.mag[20] = 600; a.reserve[20] = 0; let n = 0, refused = -1;
  for (; n < 280; n++) { ct += 0.045; fake += 0.045; if (n % 2) { pin(); g.tick(); } a.mag[20] = 600; const s = shoot(ct); if (!s.ok) { refused = n; break; } }
  ok(refused >= 240 && refused <= 260 && a.mg.hotUntil > ct, `servidor: superaquece entre 240 e 260 tiros (${refused})`);
  g.onEvent(a, ['mgs', 0, ct]);
  for (let i = 0; i < 10; i++) step(1); r = shoot(ct + 0.5); ok(!r.ok, 'servidor: travado, recusa'); ct += 0.5;
  const tOn = a.mg.hotUntil + 0.05; while (fake < tOn) step(1); g.onEvent(a, ['mgs', 1, tOn]);
  while (fake < tOn + 0.65) step(1); r = shoot(tOn + 0.65); ok(r.ok, 'servidor: depois de esfriar e embalar de novo, atira'); ct = tOn + 0.65;
  // trocar de arma zera o embalo
  g.onUpdate(a, { sq: a.sq, w: 4 }); g.onUpdate(a, { sq: a.sq, w: 20 }); step(2);
  r = shoot(ct = fake); ok(!r.ok && a.mg.on === false, 'servidor: trocou de arma, o embalo zerou');
  g.onEvent(a, ['mgs', 1, ct]); while (fake < ct + 0.62) step(1); r = shoot(ct + 0.62); ok(r.ok, 'servidor: embalou de novo, atira'); ct += 0.62;
  // abate
  bot.invulnUntil = 0; bot.hp = 100; a.mg.heat = 0; let kill = null; const k0 = a.kills;
  for (let i = 0; i < 60 && !kill; i++) { ct += 0.05; fake += 0.05; g.events.length = 0; a.mag[20] = 150; shoot(ct); kill = g.events.find((e) => e[0] === 'k' && e[2] === bot.id); pin(); g.tick(); }
  ok(kill && kill[3] === 20 && a.kills === k0 + 1, `servidor: minigun mata ('k' com arma ${kill && kill[3]})`);
  // morreu: volta a primária
  g.kill(a, null, 0, false); g.onMessage(a.id, { t: 'rs' }); for (let i = 0; i < 160 && !a.alive; i++) step(1);
  ok(a.alive && a.slots[0] === a.primary && a.primary !== 20 && a.mg == null, `servidor: renasceu com a primária (${a.slots}, mg ${a.mg})`);
}

// ---- cliente ----
if (!process.env.SKIP_CLIENT) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[error] ' + m.text()); });
  await page.goto(SITE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__docao && window.__docao.startGame, null, { timeout: 120000, polling: 250 });
  const G = (fn, a) => page.evaluate(fn, a);
  const waitGame = async (sec) => { const t0 = await G(() => window.__docao.time); await page.waitForFunction((t) => window.__docao.time >= t, t0 + sec, { timeout: 180000, polling: 50 }); };
  const mini = () => G(() => window.__docao.mini);
  await page.waitForFunction(() => window.__gunThumbs != null, null, { timeout: 180000, polling: 250 });
  const th = await G(() => ({ thumbs: window.__gunThumbs, n: window.__docao.WEAPONS.length, cards: document.querySelectorAll('.wthumb').length, c20: document.querySelectorAll('.wthumb[data-w="20"]').length }));
  ok(th.thumbs === th.n && th.cards > 0 && th.c20 === 0, `cliente: miniaturas contínuas (${th.thumbs}/${th.n}) e o Arsenal não mostra a 20 (${th.c20})`);
  await G(() => { const g = window.__docao; g.startGame('arena'); for (const e of g.entities) if (!e.isPlayer) { e.frozen = true; e.pos.set(999, -50, 999); } g.player.invulnUntil = g.time + 99999; });
  await waitGame(0.5);
  ok((await mini()).guns === th.n, 'cliente: fp.guns contínuo (um modelo por arma)');
  // código no chat
  await page.keyboard.press('KeyT'); await page.waitForTimeout(200); await page.keyboard.type('minigun'); await page.keyboard.press('Enter'); await waitGame(0.9);
  let s = await G(() => { const p = window.__docao.player; return { slot: p.slots[0], w: p.weapon, name: document.getElementById('wname').textContent, hud: window.__docao.mini.hud }; });
  ok(s.slot === 20 && s.w === 20 && s.name.includes('Minigun') && s.hud, `cliente: "minigun" no chat dá a minigun (${JSON.stringify(s)})`);
  await page.keyboard.press('KeyT'); await page.waitForTimeout(200); await page.keyboard.type('pokebola'); await page.keyboard.press('Enter'); await waitGame(0.2);
  ok(await G(() => window.__docao.player.pokeballs) === 1, 'cliente: "pokebola" continua funcionando');
  await page.mouse.move(480, 270);
  // embalo: congela o tempo, aperta, solta o tempo por 0,4 s exatos
  await G(() => { window.__stopAt = window.__docao.time; });
  const shots0 = (await mini()).shots, rot0 = (await mini()).rot;
  await page.mouse.down(); await page.waitForTimeout(600);
  await G(() => { window.__stopAt = window.__docao.time + 0.4; }); await page.waitForFunction(() => window.__docao.time >= window.__stopAt - 1e-6, null, { timeout: 180000, polling: 50 });
  let m = await mini();
  ok(m.shots === shots0 && m.spin > 0.5 && m.spin < 0.9, `cliente: 0,4 s embalando ainda não atira (spin ${m.spin.toFixed(2)}, tiros ${m.shots - shots0})`);
  await G(() => { window.__stopAt = null; }); await waitGame(0.5);
  m = await mini();
  ok(m.spin === 1 && m.shots > shots0 && m.rot > rot0, `cliente: embalado atira e os canos giram (spin ${m.spin}, tiros ${m.shots - shots0})`);
  // cadência
  const c0 = (await mini()).shots, t0 = await G(() => window.__docao.time); await waitGame(1.0);
  const c1 = (await mini()).shots, t1 = await G(() => window.__docao.time), rps = (c1 - c0) / (t1 - t0);
  const pose = await G(async () => { const a = window.__docao.fpPose(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const b = window.__docao.fpPose(); return [a.x, b.x, a.rz, b.rz]; });
  m = await mini();
  ok(rps >= 14 && rps <= 23, `cliente: ~20 tiros/s (${rps.toFixed(1)})`);
  ok(m.drops > 0 && (pose[0] !== pose[1] || pose[2] !== pose[3]), `cliente: cápsulas voando (${m.drops}) e arma tremendo`);
  // calor e trava
  await G(() => window.__docao.setMgHeat(0.95));
  await page.waitForFunction(() => window.__docao.mini.hot, null, { timeout: 180000, polling: 50 });
  m = await mini(); await G(() => { window.__stopAt = window.__docao.time; }); await page.waitForTimeout(500); await page.screenshot({ path: 'screenshots/minigun-quente.png' }); await G(() => { window.__stopAt = null; });
  ok(m.glowOn && m.glow > 0.5, `cliente: canos em brasa (${m.glow.toFixed(2)})`);
  const hs = m.shots, st = m.steam; await waitGame(0.8); m = await mini();
  ok(m.shots === hs && m.steam > st && m.hot, `cliente: travada não atira e solta vapor (tiros +${m.shots - hs}, vapor +${m.steam - st})`);
  await page.mouse.up(); await waitGame(2.2); m = await mini();
  ok(!m.hot && m.heat < 0.05 && m.spin === 0 && !m.firing, `cliente: esfriou e os canos pararam (calor ${m.heat.toFixed(2)}, spin ${m.spin})`);
  // botão direito só embala, sem zoom
  const s0 = m.shots; await page.mouse.down({ button: 'right' }); await waitGame(0.8); m = await mini();
  ok(m.spin === 1 && m.shots === s0 && Math.abs(m.fov - 75) < 0.5, `cliente: botão direito só embala, sem zoom (spin ${m.spin}, fov ${m.fov.toFixed(1)})`);
  await page.mouse.up({ button: 'right' }); await waitGame(1.0);
  // velocidade normal (move 1): igual à pistola
  const speed = async (w) => {
    await G(() => { const g = window.__docao, p = g.player, V = g.V3; for (let i = 0; i < 24; i++) { p.yaw = i / 24 * Math.PI * 2; const a = [p.pos.x, p.pos.y + 1, p.pos.z], b = [p.pos.x - Math.sin(p.yaw) * 8, p.pos.y + 1, p.pos.z - Math.cos(p.yaw) * 8]; if (g.los(a, b)) break; } p.pitch = 0; });
    await page.keyboard.down('KeyW'); await waitGame(1.0); const v = await G(() => Math.hypot(window.__docao.player.vel.x, window.__docao.player.vel.z)); await page.keyboard.up('KeyW'); await waitGame(0.4); return v;
  };
  const vMg = await speed(); await page.keyboard.press('Digit2'); await waitGame(0.5); const vPs = await speed(); await page.keyboard.press('Digit1'); await waitGame(0.9);
  ok(Math.abs(vMg - 6.8) < 0.4 && Math.abs(vPs - 6.8) < 0.5, `cliente: minigun anda na velocidade normal (${vMg.toFixed(2)} vs pistola ${vPs.toFixed(2)})`);
  // abate
  const name = await G(() => {
    const g = window.__docao, p = g.player, b = g.entities.find((e) => !e.isPlayer);
    p.mag[20] = 150; g.setMgHeat(0); b.alive = true; b.hp = 100; b.invulnUntil = 0;
    for (let i = 0; i < 48; i++) { p.yaw = i / 48 * Math.PI * 2; b.pos.set(p.pos.x - Math.sin(p.yaw) * 6, p.pos.y, p.pos.z - Math.cos(p.yaw) * 6); if (g.visible(b)) break; }
    p.pitch = Math.atan2(0.8 - 1.6, 6); return b.name;
  });
  await page.mouse.down();
  await page.waitForFunction((n) => !window.__docao.entities.find((e) => e.name === n).alive, name, { timeout: 180000, polling: 50 });
  await page.mouse.up();
  const kf = await G(() => ({ log: (window.__feedLog || []).at(-1) || '', html: document.getElementById('killfeed').innerHTML }));
  ok(kf.log.includes('[Minigun]') && kf.html.includes('M4 5h16v7H4z'), `cliente: abate no killfeed com ícone da minigun (${kf.log})`);
  // morrer devolve a primária
  await G(() => window.__docao.kill(window.__docao.player)); await waitGame(5.3);
  await page.keyboard.press('Space'); await waitGame(0.3);
  if (!(await G(() => window.__docao.player.alive))) await G(() => window.__docao.respawn(window.__docao.player));
  await waitGame(0.5);
  s = await G(() => { const p = window.__docao.player, mm = window.__docao.mini; return { alive: p.alive, slot: p.slots[0], prim: p.primary, hud: mm.hud, spin: mm.spin }; });
  ok(s.alive && s.slot === s.prim && s.prim !== 20 && !s.hud && s.spin === 0, `cliente: renasceu com a primária de volta (${JSON.stringify(s)})`);
  ok(errors.length === 0, `sem erro no console${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
}
if (fails.length) { console.log('FALHOU', fails.length); process.exit(1); }
console.log('tudo certo');

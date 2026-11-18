// Tampa do Tacho (25): bloqueio autoritativo, golpe, explosão, snapshot e bench.
// O índice 23 ficou com o Revólver do Capataz; a tampa anda logo depois do akimbo.
// Uso: node test-escudo.mjs
import { Game } from './server/src/game.js';
import { createPhysics } from './shared/physics.js';
import { WEAPONS, PRIMARIES, BOT_PRIMARIES, CATEGORIES, BOT_RANGE, TAMPA, PISTOL, KNIFE, SABER, SPEED, NADE } from './shared/rules.js';
import { SHIELD, classifyRay, classifyBlast, bulletOnShield, splashOnShield, meleeOnShield, shieldBashHit, resetShield, botWantsShield } from './shared/shield.js';
import { SABER_KIT } from './shared/saber.js';
import { killIcon } from './killfeed-icons.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const P = (x, y, z) => ({ x, y, z });
const empty = () => createPhysics([], [20, 20]);

const lid = () => ({
  pos: P(0, 0, 0), yaw: 0, crouch: 0, weapon: TAMPA, shieldHp: SHIELD.hp, shieldBroken: false,
  slots: [TAMPA, PISTOL, KNIFE], primary: TAMPA, alive: true,
});

// ---- regras (um lugar só: shared/shield.js) ----
{
  const W = WEAPONS[TAMPA];
  ok(TAMPA === 25 && W && W.key === 'tampa' && W.shield && W.name === 'Tampa do Tacho', `índice 25 = Tampa do Tacho (${W && W.name})`);
  ok(W.dmg === SHIELD.bash.dmg && W.rate === SHIELD.bash.rate && W.range === SHIELD.bash.reach && W.move === SHIELD.move, `arma espelha o golpe (${W.dmg}/${W.rate}/${W.range}, move ${W.move})`);
  ok(SHIELD.hp >= 600 && SHIELD.hp <= 900 && SHIELD.move >= 0.8 && SHIELD.move <= 0.85, `vida ${SHIELD.hp} e move ${SHIELD.move} na faixa`);
  ok(PRIMARIES.includes(TAMPA) && !BOT_PRIMARIES.includes(TAMPA) && CATEGORIES.some((c) => c.id === 'escudo' && c.weapons.includes(TAMPA)), 'primária na categoria Escudo, fora do sorteio normal dos bots');
  const lids = []; for (let id = 2; id <= 8; id++) if (botWantsShield(id)) lids.push(id);
  ok(!botWantsShield(2) && lids.length === 1 && lids[0] === 3, `tampa por id (sala de 7 bots: ${lids.join(',') || 'ninguém'}), o bot de teste (id 2) não leva`);
  ok(BOT_RANGE.length === WEAPONS.length && BOT_RANGE[TAMPA] > 0 && BOT_RANGE[TAMPA] <= 6, `BOT_RANGE[${TAMPA}] = ${BOT_RANGE[TAMPA]} (chega perto)`);
  ok(killIcon('tampa') && killIcon('tampa') !== killIcon('rifle'), 'ícone próprio no killfeed');
  ok(SHIELD.bash.dmg * 2 >= 100 && SHIELD.bash.dmg < 100, `porrada ${SHIELD.bash.dmg}: dois golpes matam, um não`);
  ok(SHIELD.charge.speed < SPEED * 1.35 + 0.6 / 0.05, `investida ${SHIELD.charge.speed} m/s cabe no anti-cheat (~21 m/s a 20 Hz)`);
  ok(Math.abs(0.82 * Math.tan(SHIELD.arc) - 1.21) < 0.05, `arco não cabe numa placa: offset lateral ${ (0.82 * Math.tan(SHIELD.arc)).toFixed(2) } m`);
}

// ---- regra direcional (sem hitbox): frente, pé, borda, fresta, flanco, de cima, costas ----
{
  const e = lid();
  const face = classifyRay(e, 0, P(0, 0.9, 2), P(0, 0, -1), 2);
  ok(face.block && face.why === 'face' && face.pose === 'raised', `frente bloqueia (${face.why})`);
  const feet = classifyRay(e, 0, P(0, 0.3, 2), P(0, 0, -1), 2);
  ok(!feet.block && feet.why === 'feet', `pé passa (${feet.why})`);
  const edge = classifyRay(e, 0, P(0.5, 0.9, 2), P(0, 0, -1), 2);
  ok(!edge.block && edge.why === 'edge', `borda passa (${edge.why})`);
  const slit = classifyRay(e, 0, P(0, 1.56, 2), P(0, 0, -1), 2);
  ok(!slit.block && slit.why === 'slit', `fresta passa (${slit.why})`);
  const flank = classifyRay(e, 0, P(2, 0.9, 0), P(-1, 0, 0), 2);
  ok(!flank.block && flank.why === 'flank', `flanco passa (${flank.why})`);
  const back = classifyRay(e, 0, P(0, 0.9, -2), P(0, 0, 1), 2);
  ok(!back.block, `costas com a tampa na mão passam (${back.why})`);
  const aboveDir = { x: 0, y: -5.1, z: -2 }; const aL = Math.hypot(aboveDir.y, aboveDir.z);
  const above = classifyRay(e, 0, P(0, 6, 2), { x: 0, y: aboveDir.y / aL, z: aboveDir.z / aL }, aL);
  ok(!above.block && above.why === 'above', `de cima passa (${above.why})`);
  const hung = lid(); hung.weapon = PISTOL;
  const hungHit = bulletOnShield(hung, 0, P(0, 0.9, -2), P(0, 0, 1), 2, 'rifle', 20);
  ok(hungHit.pose === 'back' && near(hungHit.dmg, 20 * SHIELD.backLeak) && hungHit.shield > 0 && !hungHit.stop, `pendurada nas costas vaza ${hungHit.dmg.toFixed(1)} de 20`);
  const rifle = bulletOnShield(e, 0, P(0, 0.9, 2), P(0, 0, -1), 2, 'rifle', 20);
  ok(rifle.stop && rifle.dmg === 0 && near(rifle.shield, 20 * SHIELD.bulletMul.rifle), `fuzil some na tampa (${rifle.shield.toFixed(1)})`);
  const sn = bulletOnShield(e, 0, P(0, 0.9, 2), P(0, 0, -1), 2, 'sniper', 100);
  ok(!sn.stop && near(sn.dmg, 100 * SHIELD.leak.sniper) && near(sn.shield, 100 * SHIELD.bulletMul.sniper), `torresmo fura: corpo ${sn.dmg}, tampa ${sn.shield}`);
  const can = bulletOnShield(e, 0, P(0, 0.9, 2), P(0, 0, -1), 2, 'canhao', 180);
  ok(!can.stop && near(can.dmg, 180 * SHIELD.leak.canhao) && near(can.shield, 180 * SHIELD.bulletMul.canhao), `canhão fura: corpo ${can.dmg.toFixed(0)}, tampa ${can.shield.toFixed(0)}`);
  const blastF = classifyBlast(e, 0, P(0, 1, 2));
  const blastB = classifyBlast(e, 0, P(0, 1, -3));
  const blastU = classifyBlast(e, 0, P(0, 6, 0.2));
  ok(blastF.block && !blastB.block && !blastU.block && blastU.why === 'above', `explosão: frente corta, atrás e em cima não (${blastB.why}/${blastU.why})`);
  const sp = splashOnShield(e, 0, P(0, 1, 2), 100, false, false);
  ok(near(sp.dmg, 100 * SHIELD.splashLeak) && near(sp.shield, 100 * SHIELD.splashMul) && sp.knockMul < 1, `sopro na frente: corpo ${sp.dmg}, tampa ${sp.shield}, empurrão ×${sp.knockMul}`);
  const self = splashOnShield(e, 0, P(0, 1, 2), 100, true, false);
  ok(self.dmg === 100 && self.shield === 0, 'o dono não se bloqueia (rocket jump)');
  const knifeF = meleeOnShield(e, 0, P(0, 1, 1.2), 40, 'slash');
  const knifeB = meleeOnShield(e, 0, P(0, 1, -1.2), 1000, 'slash');
  ok(knifeF.dmg === 0 && knifeF.shield === 40 * SHIELD.melee.slash.mul && knifeB.dmg === 1000 && knifeB.shield === 0, 'faca na frente amassa; pelas costas a tampa não existe');
  const bash = shieldBashHit(P(0, 1.4, 0), P(0, 0, 1), SHIELD.bash, [{ e: { pos: P(0, 0, 1.4), crouch: 0 }, p: P(0, 0, 1.4) }], () => true);
  ok(bash && bash.dmg === SHIELD.bash.dmg, `porrada acerta a ${bash && bash.dist.toFixed(2)} m`);
}

function game(n = 2) {
  const messages = [];
  const g = new Game({ code: 'TEST', max: 4, fillBots: false }, {
    send() {}, broadcast(m) { messages.push(m); }, startLoop() {}, stopLoop() {}, saveCfg() {},
  });
  const names = ['Ana', 'Beto', 'Caio', 'Duda'];
  const ents = [];
  for (let i = 0; i < n; i++) ents.push(g.join({ name: names[i], primary: i === 1 ? TAMPA : 0 }).ent);
  g.startMatch('arena');
  g.P = empty(); g.map = { size: [20, 20] }; g.pickups = [];
  for (const e of ents) { e.pos = P(0, 0, 0); e.vel = P(0, 0, 0); e.invulnUntil = 0; e.hist = []; e.hp = 100; e.alive = true; e.yaw = 0; }
  return { g, a: ents[0], b: ents[1], c: ents[2], messages };
}

function armShield(e, raised = true) {
  e.slots = [TAMPA, PISTOL, KNIFE]; e.primary = TAMPA; e.nextPrimary = TAMPA;
  e.weapon = raised ? TAMPA : PISTOL; e.alive = true; e.hp = 100; e.invulnUntil = 0; e.yaw = 0; e.shieldBlocked = 0; e.shieldMedal = false;
  resetShield(e);
}

// ---- servidor: hitscan, collateral, explosão, golpe, quebra, respawn, snapshot ----
{
  const { g, a, b, c, messages } = game(3);
  armShield(b, true);
  b.pos = P(0, 0, 0);
  const front = P(0, 0.9, 4), dirF = P(0, 0, -1);
  const hp0 = b.shieldHp;
  g.hitscan(a, front, [dirF], 0);
  ok(b.hp === 100 && b.shieldHp < hp0 && near(hp0 - b.shieldHp, 20 * SHIELD.bulletMul.rifle), `servidor: fuzil de frente amassa ${(hp0 - b.shieldHp).toFixed(1)} e o Docão fica com ${b.hp}`);
  ok(g.events.some((ev) => ev[0] === 'td' && ev[1] === b.id), 'servidor: evento td avisa a tampa');

  armShield(b, true); c.pos = P(0, 0, -3); c.hp = 100; c.alive = true; c.invulnUntil = 0; c.connected = true;
  const prevPierce = WEAPONS[0].pierce; WEAPONS[0].pierce = 2;
  g.hitscan(a, front, [dirF], 0);
  WEAPONS[0].pierce = prevPierce;
  ok(b.hp === 100 && c.hp === 100, `servidor: fuzil parado na tampa não vaza no Docão de trás (vidas ${b.hp}/${c.hp})`);
  c.alive = false; c.pos = P(40, 0, 40);

  armShield(b, true);
  g.hitscan(a, P(0, 0.3, 4), [dirF], 0);
  ok(b.hp === 80 && b.shieldHp === SHIELD.hp, `servidor: tiro no pé passa (vida ${b.hp}, tampa ${b.shieldHp})`);

  armShield(b, true);
  g.hitscan(a, P(4, 0.9, 0), [P(-1, 0, 0)], 0);
  ok(b.hp < 100 && b.shieldHp === SHIELD.hp, `servidor: flanco acerta o corpo (vida ${b.hp})`);

  armShield(b, true);
  g.hitscan(a, P(0, 0.9, -4), [P(0, 0, 1)], 0);
  ok(b.hp < 100 && b.shieldHp === SHIELD.hp, `servidor: costas com a tampa na mão acertam normal (vida ${b.hp})`);

  armShield(b, false);
  const hung0 = b.shieldHp;
  g.hitscan(a, P(0, 0.9, -4), [P(0, 0, 1)], 0);
  ok(b.hp === 100 - 20 * SHIELD.backLeak && b.shieldHp < hung0, `servidor: tampa nas costas segura um pouco (vida ${b.hp.toFixed(1)}, tampa ${(hung0 - b.shieldHp).toFixed(1)})`);

  armShield(b, true);
  g.hitscan(a, P(0, 0.9, 6), [dirF], 2);
  ok(b.hp === 100 - 100 * SHIELD.leak.sniper && near(SHIELD.hp - b.shieldHp, 100 * SHIELD.bulletMul.sniper), `servidor: Torresmo fura (vida ${b.hp}, tampa ${b.shieldHp})`);

  armShield(b, true);
  g.hitscan(a, P(0, 0.9, 6), [dirF], 5);
  ok(b.hp < 100 && b.shieldHp < SHIELD.hp && !b.shieldBroken, `servidor: Canhão fura sem quebrar de um tiro (vida ${b.hp.toFixed(1)}, tampa ${b.shieldHp.toFixed(0)})`);

  armShield(b, true);
  const spec = { radius: 6, maxDmg: 100, selfMul: 0.4, knock: 10, lift: 4, wIdx: -1, kind: 'n' };
  g.blast(P(0, 1, 2.2), a, spec);
  const frontHp = b.hp, frontLid = b.shieldHp;
  ok(frontHp < 100 && frontHp > 100 - 100 && frontLid < SHIELD.hp, `servidor: Copo na frente vaza (vida ${frontHp.toFixed(1)}, tampa ${frontLid.toFixed(0)})`);
  armShield(b, true);
  g.blast(P(0, 1, -2.2), a, spec);
  ok(b.hp < frontHp && b.shieldHp === SHIELD.hp, `servidor: Copo atrás ignora a tampa (vida ${b.hp.toFixed(1)} < ${frontHp.toFixed(1)})`);
  armShield(b, true);
  g.blast(P(0, 5.5, 0.3), a, { ...spec, radius: 8 });
  ok(b.shieldHp === SHIELD.hp && b.hp < 100, `servidor: explosão por cima ignora a tampa (vida ${b.hp.toFixed(1)})`);

  armShield(b, true); b.pos = P(0, 0, 1.45); a.pos = P(0, 0, 0); a.slots = [TAMPA, PISTOL, KNIFE]; a.weapon = TAMPA; resetShield(a); a.yaw = 0;
  g.T = 5; g.now = () => 1000;
  g.humanBash(a, 0, [0, 1.5, 0], [0, 0, 1]);
  ok(b.hp === 100 - SHIELD.bash.dmg, `servidor: porrada tira ${SHIELD.bash.dmg} (vida ${b.hp})`);
  g.humanBash(a, 0, [0, 1.5, 0], [0, 0, 1]);
  ok(!b.alive && b.hp <= 0, 'servidor: a segunda porrada mata');

  armShield(b, true); b.pos = P(0, 0, 1.45); b.alive = true; b.hp = 100;
  g.onEvent(a, ['tb', 1, [0, 1.5, 0], [0, 0, 1]]);
  ok(b.hp === 100 - SHIELD.charge.dmg && a.shieldDashUntil > g.T && a.shieldDashAt === g.T + SHIELD.charge.cd, `servidor: investida ${SHIELD.charge.dmg}, recarga ${SHIELD.charge.cd} s (vida ${b.hp})`);
  const hpCharge = b.hp;
  g.onEvent(a, ['tb', 1, [0, 1.5, 0], [0, 0, 1]]);
  ok(b.hp === hpCharge, 'servidor: segunda investida no cooldown não sai');

  armShield(b, true); b.pos = P(0, 0, 0);
  a.weapon = SABER; a.slots = [0, PISTOL, SABER]; a.pos = P(0, 0, 1.6);
  const cut = SABER_KIT.single.combo[0].dmg;
  let clock = 1000; g.now = () => clock; g.T = 5;
  const swing = (pos, dir) => g.saberSwing(a, ['sw', pos, dir, clock]);
  swing([0, 1.6, 1.6], [0, 0, -1]);
  ok(b.alive && near(b.hp, 100 - cut * SHIELD.melee.saber.leak) && b.shieldHp < SHIELD.hp, `servidor: sabre na frente lasca (vida ${b.hp.toFixed(1)}, tampa ${b.shieldHp.toFixed(0)}, golpe ${cut})`);
  armShield(b, true); a.pos = P(0, 0, -1.4);
  const lidBack = b.shieldHp;
  for (let i = 0; i < 4 && b.alive; i++) { swing([0, 1.6, -1.4], [0, 0, 1]); clock += 0.55; g.T += 0.55; }
  ok(!b.alive && b.shieldHp === lidBack, `servidor: sabre pelas costas mata e a tampa não segura (tampa ${b.shieldHp})`);

  armShield(b, true); b.pos = P(0, 0, 0); b.alive = true;
  const rifle = WEAPONS[0];
  let shots = 0, tBreak = 0, inMag = 0, reloads = 0;
  while (b.shieldHp > 0 && shots < 400) {
    if (inMag === rifle.mag) { tBreak += rifle.reload; reloads++; inMag = 0; }
    else if (shots > 0) tBreak += rifle.rate;
    g.hitscan(a, front, [dirF], 0);
    shots++; inMag++;
  }
  ok(b.shieldBroken && b.weapon === PISTOL && b.hp === 100, `servidor: fuzil quebra em ${shots} tiros / ${tBreak.toFixed(2)} s (${reloads} recarga) e cai na pistola, Docão intacto`);
  g.onUpdate(b, { sq: b.sq, p: [0, 0, 0], v: [0, 0, 0], y: -Math.PI, pi: 0, g: 1, w: TAMPA, c: 0 });
  ok(b.weapon === PISTOL, 'servidor: tampa quebrada não volta pra mão');

  const blocked = b.shieldBlocked;
  ok(blocked > SHIELD.hp * 0.5, `servidor: dano segurado na partida ${Math.round(blocked)}`);
  b.shieldMedal = b.shieldBlocked >= SHIELD.medalAt;
  g.spawn(b);
  ok(b.shieldHp === SHIELD.hp && !b.shieldBroken && b.weapon === TAMPA && b.shieldBlocked === blocked, `servidor: nasce com a tampa nova e o contador fica (${b.shieldBlocked})`);

  // flanco: tempo pra matar
  armShield(b, true); b.pos = P(0, 0, 0);
  let flankShots = 0, tFlank = 0;
  while (b.alive && flankShots < 20) {
    g.hitscan(a, P(4, 0.9, 0), [P(-1, 0, 0)], 0);
    flankShots++;
    if (b.alive) tFlank += rifle.rate;
  }
  ok(!b.alive && flankShots === 5 && near(tFlank, 0.4), `servidor: flanco mata em ${flankShots} tiros / ${tFlank.toFixed(2)} s`);

  // bench da porrada (cadência do relógio, dois acertos)
  const tBash = SHIELD.bash.rate;
  ok(tBash < tFlank * 4 && tBash > tFlank, `porrada mata em ${tBash.toFixed(2)} s, mais lenta que o flanco e mais rápida que a quebra`);

  // snapshot
  armShield(b, true); a.slots = [0, PISTOL, KNIFE]; a.weapon = 0; resetShield(a);
  messages.length = 0; g.events = [];
  const now = g.now(); g.lastTick = now; g.t0 = now - 1;
  g.tick();
  const snap = messages.findLast((m) => m.t === 's');
  const rowB = snap.e.find((row) => row[0] === b.id);
  const rowA = snap.e.find((row) => row[0] === a.id);
  ok(rowB[11] === SHIELD.hp && rowA[11] === -1 && rowB.length === 18, `snapshot: tampa ${rowB[11]}, sem tampa ${rowA[11]}, ${rowB.length} campos`);
  b.shieldHp = 0; b.shieldBroken = true;
  messages.length = 0;
  g.tick();
  const snap2 = messages.findLast((m) => m.t === 's');
  ok(snap2.e.find((row) => row[0] === b.id)[11] === 0, 'snapshot: 0 = tampa quebrada');

  // bot segura a tampa perto e saca a pistola longe
  const bot = b; bot.shieldBroken = false; bot.shieldHp = SHIELD.hp; bot.primary = TAMPA; bot.slots = [TAMPA, PISTOL, KNIFE]; bot.weapon = TAMPA;
  ok(g.botWeaponFor(bot, 4) === TAMPA && g.botWeaponFor(bot, 20) === PISTOL, 'bot: tampa perto, pistola longe');
  bot.shieldBroken = true;
  ok(g.botWeaponFor(bot, 2) === PISTOL, 'bot: tampa quebrada vai pra pistola');

  console.log('\n--- BENCH ---');
  console.log(`| cenário | resultado |`);
  console.log(`| fuzil de frente até quebrar | ${shots} tiros, ${tBreak.toFixed(2)} s com ${reloads} recarga (contínuo ${((shots - 1) * rifle.rate).toFixed(2)} s), Docão com 100 |`);
  console.log(`| fuzil no flanco até matar | ${flankShots} tiros, ${tFlank.toFixed(2)} s |`);
  console.log(`| porrada da tampa até matar | 2 golpes, ${tBash.toFixed(2)} s, ${SHIELD.bash.dmg}+${SHIELD.bash.dmg} |`);
  console.log(`| investida | ${SHIELD.charge.dmg} de dano, recarga ${SHIELD.charge.cd} s |`);
  console.log(`| Torresmo de frente (corpo) | vaza ${100 * SHIELD.leak.sniper}, tampa leva ${100 * SHIELD.bulletMul.sniper} |`);
  console.log(`| Canhão de frente (corpo) | vaza ${(180 * SHIELD.leak.canhao).toFixed(0)}, tampa leva ${(180 * SHIELD.bulletMul.canhao).toFixed(0)} |`);
  console.log(`| Copo Bomba na frente (100 cheio) | corpo leva ${Math.round(100 * SHIELD.splashLeak)}%, tampa ×${SHIELD.splashMul} |`);
  console.log(`| vida / move / arco | ${SHIELD.hp} / ${SHIELD.move} / ±${(SHIELD.arc * 180 / Math.PI).toFixed(0)}° |`);
  console.log('--- FIM ---\n');
  // referência do Copo de verdade (raio e dano do NADE), pra não deixar o número solto
  ok(NADE.radius === 6 && NADE.maxDmg === 130, `Copo Bomba continua ${NADE.maxDmg} / ${NADE.radius} m`);
}

console.log(fails.length ? 'FALHOU ' + fails.length + '\n' + fails.join('\n') : 'TUDO OK');
process.exit(fails.length ? 1 : 0);

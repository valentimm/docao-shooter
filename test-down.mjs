// Down/revive do Survival e o loadout que volta. Servidor autoritativo, sem browser.
// node test-down.mjs
import { Game } from './server/src/game.js';
import { WEAPONS, PISTOL, KNIFE, UZI } from './shared/rules.js';
import { INV } from './shared/invasion.js';
import { createPhysics } from './shared/physics.js';
import { traceShot } from './shared/penetration.js';
import { DOWN, goesDown, snapshotLoadout, restoreLoadout, sameGuns, beginDown, finishRevive, stepDowned, packKeep, applyKeep } from './shared/downed.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(DOWN.key === 'KeyL' && DOWN.hold === 3 && DOWN.range === 2.15 && DOWN.bleed === 28 && DOWN.allDown === 1.2 && DOWN.speed === 0.22, `L ${DOWN.hold}s, alcance ${DOWN.range}m, sangra ${DOWN.bleed}s, rastejo ${DOWN.speed}`);
ok(DOWN.mag === WEAPONS[PISTOL].mag && DOWN.pistol === PISTOL, 'pistola temporária é a Pistolinha, pente próprio');

function room(surv = 'survival', n = 2) {
  const g = new Game({ code: 'DOWN', map: 'hotmilk-noite', max: 4, fillBots: false, mode: 'inv', surv }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake;
  const ents = [];
  for (let i = 0; i < n; i++) { const e = g.join({ name: 'P' + i }).ent; g.welcome(e); ents.push(e); }
  g.onMessage(ents[0].id, { t: 'start' });
  for (const e of ents) e.connected = true;
  const tick = () => { fake += 0.05; g.tick(); };
  const step = (sec = 0.05) => { const n = Math.max(1, Math.round(sec / 0.05)); for (let i = 0; i < n; i++) tick(); };
  step(0.2);
  if (g.inv) g.inv.phaseEnd = 1e9;
  for (const e of ents) e.invulnUntil = 0;
  return { g, ents, step, tick };
}
function arm(e, w, mag, reserve, tier) {
  e.slots = [w, PISTOL, KNIFE]; e.slotOn = [1, 1, 1]; e.weapon = w;
  e.primary = e.nextPrimary = w; e.secondary = e.nextSecondary = PISTOL; e.melee = e.nextMelee = KNIFE;
  e.mag[w] = mag; e.reserve[w] = reserve; e.pap = { [w]: tier };
  e.kit = { [WEAPONS[w].key]: { sight: 1 } };
}

// sequência dos corações: 2 → morte normal (1) → down (0). Os dois jogadores nascem com 2.
{
  const { g, ents, tick } = room('survival', 2);
  const [a, b] = ents;
  ok(a.lives === INV.LIVES && b.lives === INV.LIVES && a.lives === 2 && !a.down && !b.down, 'host e cliente nascem com 2 corações');
  arm(a, UZI, 4, 9, 2);
  const before = snapshotLoadout(a);
  g.damage(a, 400, null, 0, false);
  ok(!a.alive && !a.down && a.lives === 1 && !a.out && sameGuns(a.loadSnap, before), 'primeiro coração: morre e renasce, snapshot da Uzi (4/9, tier 2)');
  a.respawnAt = g.T; a.rsReq = true; g.tick();
  ok(a.alive && !a.down && a.weapon === UZI && a.mag[UZI] === 4 && a.reserve[UZI] === 9 && a.pap[UZI] === 2 && a.slots[1] === PISTOL && a.kit[WEAPONS[UZI].key].sight === 1, 'renascer devolve a Uzi, a munição e o kit, sem encher');
  ok(b.weapon !== UZI || b.mag[UZI] !== 4, 'o loadout do A não vaza pro B');
  a.invulnUntil = 0;
  g.damage(a, 400, null, 0, false);
  ok(a.alive && a.down && a.lives === 0 && !a.out && a.weapon === UZI && a.mag[UZI] === 4 && a.downMag === DOWN.mag, 'segundo coração esgotado: down, ainda com a Uzi guardada, pistola temporária à parte');
  ok(!g.canShoot(a, UZI) && a.mag[UZI] === 4, 'caído não dispara a Uzi e não gasta a munição dela');
  ok(g.canShoot(a, PISTOL) && a.downMag === DOWN.mag - 1 && a.mag[PISTOL] !== undefined && a.mag[UZI] === 4, 'a pistolinha gasta downMag, não o pente guardado');
  const spent = a.downMag;
  for (let i = 0; i < 3; i++) {
    b.pos = { x: a.pos.x + 0.8, y: a.pos.y, z: a.pos.z }; b.yaw = a.yaw; b.revHold = true; b.alive = true; b.down = false; b.invulnUntil = 1e9;
    const guard = snapshotLoadout(a);
    let spins = 0; while (a.down && spins++ < 80) tick();
    ok(!a.down && a.alive && a.lives === 0 && a.weapon === UZI && a.mag[UZI] === 4 && a.reserve[UZI] === 9 && a.pap[UZI] === 2 && sameGuns(a, guard), `revive ${i + 1}: Uzi 4/9 tier 2, 0 corações, sem munição nova`);
    a.invulnUntil = 0; a.downMag = spent;
    g.damage(a, 400, null, 0, false);
    ok(a.down && a.mag[UZI] === 4, `queda ${i + 1} de novo não cria munição`);
  }
  b.revHold = false;
}

// soltar, distância e parede zeram. Dois revivers não duplicam. Caído não levanta.
{
  const mem = { allDownAt: 0 };
  const a = { id: 1, alive: true, down: true, pos: { x: 0, y: 0, z: 0 }, yaw: 0, revP: 0, revBy: 0, downUntil: 100 };
  const b = { id: 2, alive: true, down: false, pos: { x: 1, y: 0, z: 0 }, yaw: 0, revHold: true };
  const c = { id: 3, alive: true, down: false, pos: { x: 1.2, y: 0, z: 0 }, yaw: 0, revHold: true };
  let saw = true;
  stepDowned([a, b, c], 1, 10, () => saw, mem);
  ok(a.revP > 0 && a.revP < 1 && (a.revBy === 2 || a.revBy === 3), `um reviver só (${a.revBy}), progresso ${a.revP.toFixed(2)}`);
  const p1 = a.revP;
  stepDowned([a, b, c], 1, 11, () => saw, mem);
  ok(Math.abs(a.revP - (p1 + 1 / DOWN.hold)) < 0.02, 'o segundo jogador não soma progresso');
  b.revHold = false; c.revHold = false;
  stepDowned([a, b, c], 0.1, 12, () => saw, mem);
  ok(a.revP === 0 && a.revBy === 0, 'soltar a tecla zera o progresso');
  b.revHold = true; b.pos = { x: 8, y: 0, z: 0 };
  stepDowned([a, b], 1, 13, () => true, mem);
  ok(a.revP === 0, 'longe não reviva');
  b.pos = { x: 1, y: 0, z: 0 };
  stepDowned([a, b], 0.5, 14, () => false, mem);
  ok(a.revP === 0, 'parede (sem linha de visão) não reviva');
  a.down = true; b.down = true; b.revHold = true; a.revHold = true; a.pos = { x: 0, y: 0, z: 0 }; b.pos = { x: 1, y: 0, z: 0 };
  stepDowned([a, b], 1, 15, () => true, mem);
  ok(a.revP === 0 && b.revP === 0, 'caído não reviva o outro');
}

// solo sangra no timer; dois caídos acabam no prazo curto; clássico não entra em down
{
  const { g, ents, step } = room('survival', 1);
  const a = ents[0];
  a.lives = 1; a.invulnUntil = 0;
  g.damage(a, 400, null, 0, false);
  ok(a.down && a.alive, 'solo com o último coração cai');
  a.downUntil = g.T + 0.05;
  step(0.2);
  ok(!a.alive && a.out && !a.down, 'solo sem amigo: o timer vira o fora antigo');
  step(1.4);
  ok(g.inv.phase === 'over' && !g.inv.won, 'solo caído finaliza a partida, sem softlock');
}
{
  const { g, ents, step } = room('survival', 2);
  const [a, b] = ents;
  a.lives = 0; b.lives = 0; a.invulnUntil = b.invulnUntil = 0;
  g.damage(a, 400, null, 0, false); g.damage(b, 400, null, 0, false);
  ok(a.down && b.down, 'os dois caem juntos');
  step(1.4);
  ok(!a.alive && !b.alive && a.out && b.out, 'todos caídos: finaliza no prazo curto, sem esperar o sangramento inteiro');
}
{
  const { g, ents } = room('padrao', 1);
  const a = ents[0];
  ok(!g.survival && a.lives === 2, 'Invasão clássica continua com 2 corações');
  a.invulnUntil = 0; a.lives = 1;
  g.damage(a, 400, null, 0, false);
  ok(!a.down && !a.alive && a.out, 'clássico sem vidas continua espectador, sem down');
}
{
  const g = new Game({ code: 'DM', map: 'arena', max: 4, fillBots: false, mode: 'dm' }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake;
  const a = g.join({ name: 'Dm' }).ent; g.welcome(a); a.connected = true;
  g.onMessage(a.id, { t: 'start' });
  for (let i = 0; i < 4; i++) { fake += 0.05; g.tick(); }
  a.invulnUntil = 0; a.lives = 0;
  g.damage(a, 400, null, 0, false);
  ok(!a.down && !a.alive && Number.isFinite(a.respawnAt), 'mata-mata não entra em down');
}

// partida nova não herda snapshot; pacote ldk restaura
{
  const { g, ents } = room('survival', 1);
  const a = ents[0];
  arm(a, UZI, 2, 3, 1);
  a.loadSnap = snapshotLoadout(a);
  g.startMatch('hotmilk-noite');
  ok(!a.loadSnap && !a.down && a.slots[0] === PISTOL && a.weapon === PISTOL, 'partida nova zera o snapshot e volta a pistola inicial');
  const e = { mag: [], reserve: [], pap: {} };
  const src = { weapon: UZI, slots: [UZI, PISTOL, KNIFE], slotOn: [1, 1, 1], mag: [], reserve: [], pap: { [UZI]: 2 }, drum: [] };
  src.mag[UZI] = 6; src.reserve[UZI] = 11; src.mag[PISTOL] = 3; src.reserve[PISTOL] = 8; src.mag[KNIFE] = 1; src.reserve[KNIFE] = 0;
  applyKeep(e, packKeep(src));
  ok(e.weapon === UZI && e.mag[UZI] === 6 && e.reserve[UZI] === 11 && e.pap[UZI] === 2 && e.slots[2] === KNIFE && e.mag[PISTOL] === 3, 'pacote ldk devolve slots, munição e tier');
}

// hitbox deitada: bala na altura da cabeça em pé passa; na altura do chão acerta
{
  const P = createPhysics([], [40, 40]);
  const W = { dmg: 10, range: 40, pellets: 1, pen: 0, headMul: 2, pierce: 0 };
  const body = { e: { name: 'caido' }, p: { x: 0, y: 0, z: 0 }, prone: true, yaw: 0, crouch: 0 };
  const high = traceShot(P, { x: 0, y: 1.5, z: -6 }, { x: 0, y: 0, z: 1 }, W, [body]);
  const low = traceShot(P, { x: 0, y: 0.3, z: -6 }, { x: 0, y: 0, z: 1 }, W, [body]);
  const stand = traceShot(P, { x: 0, y: 1.5, z: -6 }, { x: 0, y: 0, z: 1 }, W, [{ e: { name: 'pe' }, p: { x: 0, y: 0, z: 0 }, crouch: 0 }]);
  ok(!high.hits.length && low.hits.length === 1 && stand.hits.length === 1, `hitbox caída: alta ${high.hits.length}, baixa ${low.hits.length}, em pé ${stand.hits.length}`);
}

ok(!goesDown({ lives: 2, alive: true }) && goesDown({ lives: 1, alive: true }) && goesDown({ lives: 0, alive: true }) && !goesDown({ lives: 0, downFinal: true }), 'down só quando o próximo gasto zeraria o coração');

// Carteira não entra no snapshot e não vira o maior dos dois campos.
{
  const e = { id: 1, alive: true, lives: 0, weapon: UZI, slots: [UZI, PISTOL, KNIFE], slotOn: [1, 1, 1], primary: UZI, secondary: PISTOL, melee: KNIFE, mag: [], reserve: [], pap: { [UZI]: 1 }, pts: 40, points: 900, _purse: 40, purseN: 4 };
  e.mag[UZI] = 3; e.reserve[UZI] = 8;
  beginDown(e, 0);
  ok(e.loadSnap.pts == null && e.loadSnap.points == null && e.loadSnap.purseN == null, 'snapshot de arma não guarda saldo');
  e.pts = 15; e.points = 15; e._purse = 15; e.purseN = 6;
  e.loadSnap.pts = 900; e.loadSnap.points = 40;
  finishRevive(e);
  ok(e.weapon === UZI && e.mag[UZI] === 3 && e.pts === 15 && e.points === 15 && e._purse === 15 && e.purseN === 6, 'revive devolve a arma e deixa o saldo novo, sem escolher o maior');
}

if (fails.length) { console.error('\n' + fails.length + ' falha(s)'); process.exit(1); }
console.log('\ntudo ok');

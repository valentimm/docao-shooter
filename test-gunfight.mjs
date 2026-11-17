// Regras do Gunfight (shared/gunfight.js). Sem navegador: node test-gunfight.mjs
import assert from 'node:assert/strict';
import { WEAPONS, GOLD_KNIFE } from './shared/rules.js';
import {
  GF, PHASES, isGunfight, createGunfight, startRound, stepGunfight, onKill,
  packGunfight, unpackGunfight, rollClass, equipGunfight, sideForRound, spawnSide,
  aliveByTeam, hpByTeam, nextClass, gunfightHud, gunfightFrozen, allowsRespawn,
  inGunfightZone, maxPlayers, roundTime, classInfo,
} from './shared/gunfight.js';

const ZONE = { x: 0, y: 0, z: 0, r: 4 };
const world = (S, ents, rnd) => ({ ents, rnd, zone: S.zone });

function begin(format, rnd = () => 0) {
  const n = GF.FORMATS[format].n;
  const S = createGunfight({ format, rnd, zone: ZONE });
  const ents = [];
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < n; i++) {
      ents.push({
        id: team * 10 + i + 1, team, alive: true, hp: 40,
        pos: { x: team === 0 ? -20 : 20, y: 0, z: i * 2 },
        nades: 2, smokeNades: 1, stunNades: 1, shocks: 1, pokeballs: 1, slots: [0, 4, 7],
        guns: { knife: 'conta', shotgun: 'asiimov' }, ownGuns: { knife: 'conta' },
        knife: 'karambit', sniper: 'lore', kit: { rifle: 'reddot' },
      });
    }
  }
  return { S, ents, rnd, n };
}

function enterLive(S, ents, rnd) {
  assert.equal(S.over, false);
  if (S.phase === 'live' || S.phase === 'ot') return;
  if (S.phase === 'wait' || S.round === 0) startRound(S, { rnd, ents });
  else if (S.phase === 'end') stepGunfight(S, Math.max(S.timeLeft, 0), world(S, ents, rnd));
  assert.equal(S.phase, 'prep', 'prep antes do live');
  assert.equal(gunfightFrozen(S), true);
  const ev = stepGunfight(S, Math.max(S.timeLeft, 0), world(S, ents, rnd));
  assert.deepEqual(ev, [['go']]);
  assert.equal(S.phase, 'live');
  assert.equal(gunfightFrozen(S), false);
}

function playElim(S, ents, rnd, winner) {
  enterLive(S, ents, rnd);
  let ev = [];
  for (const e of ents) if (e.team === 1 - winner) ev = onKill(S, e, ents);
  assert.equal(ev[0][0], 'win');
  assert.equal(ev[0][1], winner);
  assert.equal(ev[0][2], 'elim');
  assert.equal(S.phase, 'end');
  return ev;
}

function playDraw(S, ents, rnd) {
  const before = S.score.slice();
  enterLive(S, ents, rnd);
  for (const e of ents) { e.alive = true; e.hp = 40; e.pos = { x: e.team === 0 ? -20 : 20, y: 0, z: 0 }; }
  let ev = stepGunfight(S, S.timeLeft, world(S, ents, rnd));
  assert.deepEqual(ev, [['ot']]);
  ev = stepGunfight(S, S.timeLeft, world(S, ents, rnd));
  assert.deepEqual(ev, [['win', -1, 'draw']]);
  assert.deepEqual(S.score, before);
  assert.equal(S.phase, 'end');
}

function pub(S) {
  return {
    format: S.format, round: S.round, phase: S.phase, timeLeft: S.timeLeft,
    score: S.score.slice(), classId: S.classId, nextClassId: S.nextClassId, used: S.used.slice(),
    capTeam: S.capTeam, capProg: S.capProg, contested: S.contested, lastWin: S.lastWin,
    reason: S.reason, over: S.over, winner: S.winner, zone: S.zone,
  };
}

// --- pool, formato, timers, flags ---
assert.equal(GF.mode, 'gf');
assert.equal(isGunfight('gf'), true);
assert.equal(isGunfight('x1'), false);
assert.equal(isGunfight('bomb'), false);
assert.deepEqual(PHASES, ['wait', 'prep', 'live', 'ot', 'end', 'over']);
assert.deepEqual([...GF.CLASS_KEYS], ['knife', 'bazooka', 'minigun', 'sabre', 'tampa', 'shotgun', 'canhao', 'milho', 'disco', 'estilingue', 'capataz2', 'ray', 'saco']);
assert.equal(GF.CLASSES.length, 13);
for (let i = 0; i < GF.CLASS_KEYS.length; i++) {
  const id = WEAPONS.findIndex((w) => w.key === GF.CLASS_KEYS[i]);
  assert.equal(GF.CLASSES[i], id, GF.CLASS_KEYS[i]);
  assert.ok(id >= 0 && id !== GOLD_KNIFE);
}
assert.equal(GF.CLASSES.includes(GOLD_KNIFE), false);
assert.equal(WEAPONS[GOLD_KNIFE].key, 'faca-dourada');
assert.equal(WEAPONS[GF.CLASSES[GF.CLASS_KEYS.indexOf('ray')]].ray, true);
assert.equal(WEAPONS[GF.CLASSES[GF.CLASS_KEYS.indexOf('minigun')]].key, 'minigun');
assert.equal(GF.WIN, 6);
assert.equal(GF.MAX_ROUNDS, 11);
assert.equal(GF.PREP, 4);
assert.equal(GF.END, 3);
assert.equal(GF.OT, 10);
assert.equal(GF.CAP, 3);
assert.equal(GF.HP, 100);
assert.equal(GF.NADES, 0);
assert.equal(GF.REGEN, false);
assert.equal(GF.KILLSTREAKS, false);
assert.equal(GF.POWERS, false);
assert.equal(GF.PICKUPS, false);
assert.deepEqual(Object.keys(GF.FORMATS), ['1v1', '2v2', '3v3', '4v4']);
for (const [name, f] of Object.entries(GF.FORMATS)) {
  assert.equal(f.max, f.n * 2, name);
  assert.equal(maxPlayers(name), f.max, name);
}
assert.equal(maxPlayers('1v1'), 2);
assert.equal(maxPlayers('2v2'), 4);
assert.equal(maxPlayers('3v3'), 6);
assert.equal(maxPlayers('4v4'), 8);
assert.equal(maxPlayers('5v5'), 0);
assert.equal(roundTime('1v1'), 40);
assert.equal(roundTime('2v2'), 40);
assert.equal(roundTime('3v3'), 50);
assert.equal(roundTime('4v4'), 60);
for (const name of Object.keys(GF.FORMATS)) {
  const { S, ents, rnd } = begin(name);
  assert.equal(ents.length, maxPlayers(name));
  startRound(S, { rnd, ents });
  assert.equal(S.phase, 'prep');
  assert.equal(S.timeLeft, GF.PREP);
  assert.equal(gunfightFrozen(S), true);
  assert.deepEqual(stepGunfight(S, GF.PREP, world(S, ents, rnd)), [['go']]);
  assert.equal(S.phase, 'live');
  assert.equal(S.timeLeft, roundTime(name));
  assert.equal(allowsRespawn(S), false);
  for (const e of ents) {
    assert.deepEqual(e.slots, [S.classId]);
    assert.equal(e.slots.length, 1);
    assert.equal(e.nades, 0);
    assert.equal(e.smokeNades, 0);
    assert.equal(e.hp, GF.HP);
    assert.equal(e.alive, true);
    assert.equal(e.guns.shotgun, 'asiimov');
    assert.equal(e.knife, 'karambit');
    assert.equal(e.sniper, 'lore');
  }
}

// --- lados e classe, a cada 2, sem repetir ---
{
  const { S, ents, rnd } = begin('2v2');
  const classes = [], swaps = [];
  for (let r = 1; r <= 11; r++) {
    const ev = startRound(S, { rnd, ents });
    assert.equal(ev[0][1], r);
    classes.push(S.classId);
    if (ev.some((e) => e[0] === 'swap')) swaps.push(r);
    assert.equal(sideForRound(r), Math.floor((r - 1) / 2) % 2);
    assert.equal(spawnSide(r, 0), sideForRound(r) ? 1 : 0);
    assert.equal(spawnSide(r, 1), sideForRound(r) ? 0 : 1);
    if (r === 1) {
      assert.deepEqual(ev.map((e) => e[0]), ['round', 'class']);
      const h = gunfightHud(S, ents);
      assert.equal(h.round, 1);
      assert.deepEqual(h.score, [0, 0]);
      assert.equal(h.side, 0);
      assert.equal(h.nextClassId, null);
      assert.equal(nextClass(S), null);
      assert.equal(h.classKey, WEAPONS[S.classId].key);
      assert.deepEqual(h.alive, [2, 2]);
      assert.deepEqual(h.hp, [200, 200]);
      assert.deepEqual(aliveByTeam(ents), [2, 2]);
      assert.deepEqual(hpByTeam(ents), [200, 200]);
    }
    if (r === 2) {
      assert.equal(classes[1], classes[0]);
      assert.notEqual(S.nextClassId, S.classId);
      assert.equal(nextClass(S), S.nextClassId);
      const h = gunfightHud(S, ents);
      assert.equal(h.nextClassId, S.nextClassId);
      assert.equal(h.nextClassKey, WEAPONS[S.nextClassId].key);
      assert.equal(h.side, 0);
      ents[0].alive = false; ents[0].hp = 0;
      const h2 = gunfightHud(S, ents);
      assert.deepEqual(h2.alive, [1, 2]);
      assert.deepEqual(h2.hp, [100, 200]);
    }
    if (r === 3) {
      assert.deepEqual(ev.map((e) => e[0]), ['round', 'swap', 'class']);
      assert.equal(sideForRound(3), 1);
      assert.equal(nextClass(S), null);
    }
  }
  assert.deepEqual(swaps, [3, 5, 7, 9, 11]);
  for (let r = 1; r <= 11; r++) {
    if (r % 2 === 0) assert.equal(classes[r - 1], classes[r - 2], 'classe estável no par ' + r);
    else if (r > 1) assert.notEqual(classes[r - 1], classes[r - 2], 'classe troca na rodada ' + r);
  }
  const blocks = classes.filter((_, i) => i % 2 === 0);
  assert.equal(new Set(blocks).size, 6);
  assert.deepEqual(blocks, [...GF.CLASSES.slice(0, 6)]);
  assert.equal(spawnSide(4, 3), -1);
  const used = [], seen = [];
  let prev = -1;
  for (let i = 0; i < GF.CLASSES.length; i++) {
    const id = rollClass(prev, used, () => 0);
    assert.equal(used.includes(id), false);
    assert.notEqual(id, prev);
    used.push(id); seen.push(id); prev = id;
  }
  assert.equal(new Set(seen).size, GF.CLASSES.length);
  assert.notEqual(rollClass(prev, used, () => 0), prev);
}

// --- primeiro a 6; 5×5 decide na 11ª ---
{
  const { S, ents, rnd } = begin('1v1');
  for (let i = 0; i < 6; i++) playElim(S, ents, rnd, 0);
  assert.deepEqual(S.score, [6, 0]);
  assert.equal(S.round, 6);
  assert.equal(S.over, true);
  assert.equal(S.winner, 0);
  assert.equal(S.phase, 'end');
  const dead = ents.find((e) => e.team === 1);
  assert.equal(dead.alive, false);
  stepGunfight(S, 1, world(S, ents, rnd));
  assert.equal(dead.alive, false, 'faixa de fim não renasce');
  assert.equal(S.phase, 'end');
  assert.deepEqual(stepGunfight(S, GF.END, world(S, ents, rnd)), [['over', 0]]);
  assert.equal(S.phase, 'over');
  assert.equal(dead.alive, false);
  assert.deepEqual(stepGunfight(S, 30, world(S, ents, rnd)), []);
}
{
  const { S, ents, rnd } = begin('1v1');
  for (let i = 0; i < 10; i++) playElim(S, ents, rnd, i % 2);
  assert.deepEqual(S.score, [5, 5]);
  assert.equal(S.round, 10);
  assert.equal(S.over, false);
  assert.equal(S.phase, 'end');
  playElim(S, ents, rnd, 0);
  assert.deepEqual(S.score, [6, 5]);
  assert.equal(S.round, 11);
  assert.equal(S.over, true);
  assert.equal(S.winner, 0);
  assert.equal(S.reason, 'elim');
}

// --- teto de 11: empates não passam disso; placar maior leva, 0×0 fica sem campeão ---
{
  const { S, ents, rnd } = begin('1v1');
  for (let i = 0; i < 11; i++) playDraw(S, ents, rnd);
  assert.equal(S.round, 11);
  assert.deepEqual(S.score, [0, 0]);
  assert.equal(S.over, true);
  assert.equal(S.winner, -1);
  assert.deepEqual(stepGunfight(S, GF.END, world(S, ents, rnd)), [['over', -1]]);
  assert.equal(S.phase, 'over');
}
{
  const { S, ents, rnd } = begin('1v1');
  playElim(S, ents, rnd, 0);
  for (let i = 0; i < 10; i++) playDraw(S, ents, rnd);
  assert.equal(S.round, 11);
  assert.deepEqual(S.score, [1, 0]);
  assert.equal(S.over, true);
  assert.equal(S.winner, 0, 'no teto, quem tem mais rodadas leva mesmo sem chegar a 6');
}

// --- eliminação, sem respawn no live, overtime ---
{
  const { S, ents, rnd } = begin('1v1');
  enterLive(S, ents, rnd);
  const red = ents.find((e) => e.team === 0);
  const blue = ents.find((e) => e.team === 1);
  const ev = onKill(S, blue, ents);
  assert.deepEqual(ev, [['win', 0, 'elim']]);
  assert.deepEqual(S.score, [1, 0]);
  assert.equal(blue.alive, false);
  assert.equal(blue.hp, 0);
  assert.equal(red.alive, true);
  stepGunfight(S, 1, world(S, ents, rnd));
  assert.equal(blue.alive, false);
}
{
  const { S, ents, rnd } = begin('2v2');
  enterLive(S, ents, rnd);
  const reds = ents.filter((e) => e.team === 0);
  const ev = onKill(S, reds[0], ents);
  assert.deepEqual(ev, []);
  assert.equal(S.phase, 'live');
  assert.equal(allowsRespawn(S), false);
  assert.deepEqual(S.score, [0, 0]);
  stepGunfight(S, 9, world(S, ents, rnd));
  assert.equal(S.phase, 'live');
  assert.equal(reds[0].alive, false);
  assert.equal(reds[0].hp, 0);
  assert.equal(reds[1].alive, true);
  assert.equal(reds[1].hp, GF.HP);
}
{
  const { S, ents, rnd } = begin('1v1');
  enterLive(S, ents, rnd);
  for (const e of ents) e.alive = false;
  assert.deepEqual(stepGunfight(S, 0.2, world(S, ents, rnd)), [['win', -1, 'draw']]);
  assert.deepEqual(S.score, [0, 0]);
}
{
  const z = { x: 0, y: 0, z: 0, r: 4, h: 3 };
  assert.equal(inGunfightZone(z, { x: 0, y: 0, z: 0 }), true);
  assert.equal(inGunfightZone(z, { x: 4, y: 0, z: 0 }), true);
  assert.equal(inGunfightZone(z, { x: 4.2, y: 0, z: 0 }), false);
  assert.equal(inGunfightZone(z, { x: 0, y: 10, z: 0 }), false);
  assert.equal(classInfo(GF.CLASSES[0]).key, 'knife');
}
{
  const { S, ents, rnd } = begin('1v1');
  const red = ents.find((e) => e.team === 0);
  const blue = ents.find((e) => e.team === 1);
  enterLive(S, ents, rnd);
  red.pos = { x: 0, y: 0, z: 0 }; red.hp = 10;
  blue.pos = { x: 20, y: 0, z: 0 }; blue.hp = 100;
  assert.deepEqual(stepGunfight(S, S.timeLeft, world(S, ents, rnd)), [['ot']]);
  assert.equal(S.phase, 'ot');
  assert.equal(S.timeLeft, GF.OT);
  assert.equal(gunfightFrozen(S), false);
  stepGunfight(S, 2, world(S, ents, rnd));
  assert.equal(S.phase, 'ot');
  assert.equal(S.capProg, 2);
  assert.equal(S.capTeam, 0);
  assert.equal(S.contested, false);
  assert.equal(S.timeLeft, 8);
  const ev = stepGunfight(S, 1, world(S, ents, rnd));
  assert.deepEqual(ev, [['win', 0, 'cap']]);
  assert.deepEqual(S.score, [1, 0]);
  assert.equal(S.reason, 'cap');
}
{
  const { S, ents, rnd } = begin('2v2');
  enterLive(S, ents, rnd);
  assert.deepEqual(stepGunfight(S, S.timeLeft, world(S, ents, rnd)), [['ot']]);
  for (const e of ents) e.pos = { x: 0, y: 0, z: 0 };
  stepGunfight(S, 4, world(S, ents, rnd));
  assert.equal(S.phase, 'ot');
  assert.equal(S.contested, true);
  assert.equal(S.capProg, 0);
  assert.equal(S.timeLeft, GF.OT - 4);
  const h = gunfightHud(S, ents);
  assert.equal(h.contested, true);
  assert.deepEqual(h.alive, [2, 2]);
}
{
  const { S, ents, rnd } = begin('1v1');
  const red = ents.find((e) => e.team === 0);
  const blue = ents.find((e) => e.team === 1);
  enterLive(S, ents, rnd);
  stepGunfight(S, S.timeLeft, world(S, ents, rnd));
  red.pos = { x: 0, y: 0, z: 0 };
  blue.pos = { x: 30, y: 0, z: 0 };
  stepGunfight(S, 2, world(S, ents, rnd));
  assert.equal(S.capProg, 2);
  blue.pos = { x: 0, y: 0, z: 0 };
  stepGunfight(S, 2, world(S, ents, rnd));
  assert.equal(S.contested, true);
  assert.equal(S.capProg, 2, 'zona contestada pausa a captura');
  assert.equal(S.phase, 'ot');
  blue.pos = { x: 30, y: 0, z: 0 };
  assert.deepEqual(stepGunfight(S, 1, world(S, ents, rnd)), [['win', 0, 'cap']]);
}
{
  const { S, ents, rnd } = begin('2v2');
  enterLive(S, ents, rnd);
  for (const e of ents) e.pos = { x: e.team === 0 ? -20 : 20, y: 0, z: 0 };
  ents.filter((e) => e.team === 0).forEach((e, i) => { e.hp = i === 0 ? 60 : 25; });
  ents.filter((e) => e.team === 1).forEach((e, i) => { e.hp = i === 0 ? 20 : 15; });
  assert.deepEqual(hpByTeam(ents), [85, 35]);
  assert.deepEqual(stepGunfight(S, S.timeLeft, world(S, ents, rnd)), [['ot']]);
  assert.deepEqual(stepGunfight(S, S.timeLeft, world(S, ents, rnd)), [['win', 0, 'hp']]);
  assert.deepEqual(S.score, [1, 0]);
}
{
  const { S, ents, rnd } = begin('1v1');
  const red = ents.find((e) => e.team === 0);
  const blue = ents.find((e) => e.team === 1);
  enterLive(S, ents, rnd);
  stepGunfight(S, S.timeLeft, world(S, ents, rnd));
  red.pos = { x: 0, y: 0, z: 0 }; red.hp = 90;
  blue.pos = { x: 0, y: 0, z: 0 }; blue.hp = 10;
  assert.deepEqual(stepGunfight(S, GF.OT, world(S, ents, rnd)), [['win', 0, 'hp']]);
  assert.deepEqual(S.score, [1, 0]);
  assert.equal(S.lastWin, 0);
}
{
  const { S, ents, rnd } = begin('1v1');
  const blue = ents.find((e) => e.team === 1);
  enterLive(S, ents, rnd);
  stepGunfight(S, S.timeLeft, world(S, ents, rnd));
  ents[0].pos = { x: 0, y: 0, z: 0 };
  stepGunfight(S, 1, world(S, ents, rnd));
  assert.equal(S.capProg, 1);
  const ev = onKill(S, blue, ents);
  assert.deepEqual(ev, [['win', 0, 'elim']]);
  assert.equal(S.phase, 'end');
}

// --- equip: 1 slot, nades 0, skin da conta fica ---
{
  const shot = GF.CLASSES[GF.CLASS_KEYS.indexOf('shotgun')];
  const guns = { shotgun: 'asiimov' };
  const own = { shotgun: 'asiimov' };
  const e = {
    slots: [0, 4, 7], nades: 2, smokeNades: 1, stunNades: 1, flashNades: 1, shocks: 2, pokeballs: 1,
    guns, ownGuns: own, knife: 'karambit', sniper: 'lore', kit: { rifle: 'reddot' }, hp: 40,
  };
  equipGunfight(e, shot);
  assert.deepEqual(e.slots, [shot]);
  assert.equal(e.weapon, shot);
  assert.equal(e.primary, shot);
  assert.equal(e.secondary, shot);
  assert.equal(e.melee, shot);
  assert.equal(e.nades, 0);
  assert.equal(e.smokeNades, 0);
  assert.equal(e.stunNades, 0);
  assert.equal(e.flashNades, 0);
  assert.equal(e.shocks, 0);
  assert.equal(e.pokeballs, 0);
  assert.equal(e.guns, guns);
  assert.equal(e.ownGuns, own);
  assert.equal(e.knife, 'karambit');
  assert.equal(e.sniper, 'lore');
  assert.deepEqual(e.kit, {});
  assert.equal(e.mag[shot], WEAPONS[shot].mag);
  assert.equal(e.reserve[shot], WEAPONS[shot].reserve);
  assert.equal(e.hp, 40);
  const gold = { slots: [0, 4, 7], nades: 1, guns: { rifle: 'gold' }, knife: 'karambit' };
  equipGunfight(gold, GOLD_KNIFE);
  assert.deepEqual(gold.slots, [0, 4, 7]);
  assert.equal(gold.nades, 1);
  assert.equal(gold.guns.rifle, 'gold');
  const ray = GF.CLASSES[GF.CLASS_KEYS.indexOf('ray')];
  const mini = GF.CLASSES[GF.CLASS_KEYS.indexOf('minigun')];
  equipGunfight(e, ray);
  assert.deepEqual(e.slots, [ray]);
  assert.equal(e.nades, 0);
  assert.equal(e.guns, guns);
  equipGunfight(e, mini);
  assert.deepEqual(e.slots, [mini]);
  assert.equal(e.mg, null);
  assert.equal(e.mgHeat, 0);
  const tampa = GF.CLASSES[GF.CLASS_KEYS.indexOf('tampa')];
  equipGunfight(e, tampa);
  assert.deepEqual(e.slots, [tampa]);
  assert.ok(e.shieldHp > 0);
}

// --- pack / unpack ida e volta, e o estado desembrulhado continua a partida ---
{
  const { S, ents, rnd } = begin('3v3');
  const red = ents.filter((e) => e.team === 0);
  const blue = ents.filter((e) => e.team === 1);
  enterLive(S, ents, rnd);
  assert.deepEqual(stepGunfight(S, S.timeLeft, world(S, ents, rnd)), [['ot']]);
  for (const e of red) e.pos = { x: 0, y: 0, z: 0 };
  for (const e of blue) e.pos = { x: 25, y: 0, z: 0 };
  stepGunfight(S, 2, world(S, ents, rnd));
  assert.equal(S.phase, 'ot');
  assert.equal(S.capProg, 2);
  assert.equal(S.format, '3v3');
  const wire = JSON.parse(JSON.stringify(packGunfight(S)));
  const T = unpackGunfight(wire);
  assert.deepEqual(pub(T), pub(S));
  assert.notEqual(T.score, S.score);
  assert.notEqual(T.used, S.used);
  for (const e of blue) e.pos = { x: 0, y: 0, z: 0 };
  stepGunfight(T, 2, world(T, ents, rnd));
  assert.equal(T.phase, 'ot');
  assert.equal(T.contested, true);
  assert.equal(T.capProg, 2);
  for (const e of blue) e.pos = { x: 25, y: 0, z: 0 };
  assert.deepEqual(stepGunfight(T, 1, world(T, ents, rnd)), [['win', 0, 'cap']]);
  assert.equal(unpackGunfight(null, S), S);
  assert.equal(unpackGunfight([99], S), S);
}

console.log('test-gunfight ok');

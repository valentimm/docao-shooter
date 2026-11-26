import test from 'node:test';
import assert from 'node:assert/strict';
import { wantShape, storyWeakMul, storyWeakHp, invasionFriends, InvasionCore } from './invasion.js';
import { eggPrompt, createEgg, EGG_SPOTS, linkLocks, linkLine, LINK_ROOM } from './historia-egg.js';
import { packAdventure, applyAdventure, adventureExpired, ADVENTURE_MS } from './historia-save.js';

test('shapeshifter da história é 15% por wave e a clássica guarda o intervalo', () => {
  const spec = { n: 2, w: 6 };
  assert.equal(wantShape(spec, () => 0.14, 5, true), true);
  assert.equal(wantShape(spec, () => 0.16, 5, true), false);
  assert.equal(wantShape(spec, () => 0.2, 5, false), false);
  assert.equal(wantShape({ n: 2, w: 8 }, () => 0.2, 5, false), true);
  assert.equal(wantShape({ n: 1, w: 12 }, () => 0, 0, true), false);
});

test('vida dos zumbis fracos sobe nas waves tardias da história', () => {
  assert.equal(storyWeakMul(1), 1);
  assert.equal(storyWeakMul(10), 1);
  assert.ok(storyWeakMul(30) > storyWeakMul(20));
  assert.ok(storyWeakMul(20) > storyWeakMul(10));
  assert.equal(storyWeakHp(30, 'boss', null), 1);
  assert.equal(storyWeakHp(30, 'walker', ['x']), 1);
  assert.equal(storyWeakHp(30, 'walker', null), storyWeakMul(30));
  assert.ok(Math.abs(storyWeakMul(20) - 1.4) < 1e-9);
  assert.ok(Math.abs(storyWeakMul(30) - 2.2) < 1e-9);
});

test('alma sugada só toma friendly fire na história', () => {
  const a = { zt: '', soul: 9 }, b = { zt: '' };
  assert.equal(invasionFriends(a, b, true), false);
  assert.equal(invasionFriends(a, b, false), true);
  assert.equal(invasionFriends({ zt: 'walker' }, b, true), false);
});

test('aventura salva dura 10 dias e volta a wave', () => {
  const now = Date.now();
  const inv = { wave: 14, egg: createEgg(() => 0) };
  inv.egg.steps.cria = true;
  inv.egg.chaviDone = true;
  const players = [{ id: 1, name: 'Ana', acct: { id: 7 }, pts: 40, lives: 1, hp: 80, hUps: ['mola'], hPass: { porcao: 1 }, hUlt: '', primary: 3, secondary: 1, melee: 2, pap: { 3: 2 }, slotOn: [1, 1, 1] }];
  const snap = packAdventure(inv, players, now);
  assert.equal(snap.exp - snap.at, ADVENTURE_MS);
  assert.equal(adventureExpired(snap, snap.exp), true);
  assert.equal(adventureExpired(snap, snap.exp - 1), false);
  const back = { id: 9, name: 'Ana', acct: { id: 7 }, pts: 0, lives: 2, hp: 100, hUps: [], hPass: {}, primary: 0, secondary: 0, melee: 0 };
  const core = {
    egg: createEgg(() => 0),
    startWave(w) { this.wave = w; },
  };
  assert.equal(applyAdventure(core, [back], snap), true);
  assert.equal(core.wave, 14);
  assert.equal(core.egg.steps.cria, true);
  assert.equal(core.egg.chaviDone, true);
  assert.equal(back.pts, 40);
  assert.equal(back.hUps[0], 'mola');
  assert.equal(back.primary, 3);
  assert.equal(back.slots[2], 2);
});

test('sala da link tranca com plateia e solta quem está sozinho', () => {
  assert.equal(linkLocks(1), false);
  assert.equal(linkLocks(2), true);
  assert.equal(linkLine('Ana'), 'O player Ana ficou trancado na sala da link! Ajudem ele!');
  const book = createEgg(() => 0);
  book.wave = 21;
  const p = { id: 1, alive: true, pos: { ...LINK_ROOM.sofa }, eggSeat: false, eggTrap: false };
  assert.equal(eggPrompt(p, book).id, 'sofa');
  assert.equal(eggPrompt(p, book).text, '');
  book.wave = 20;
  assert.equal(eggPrompt(p, book), null);
  const wall = EGG_SPOTS.walls[0];
  const atWall = { id: 2, alive: true, pos: { x: wall.x, y: 0, z: wall.z } };
  book.wave = 4;
  assert.equal(eggPrompt(atWall, book).id, wall.id);
  assert.equal(eggPrompt(atWall, book).text, '');

  const duo = [
    { id: 1, name: 'Ana', alive: true, bot: false, pos: { ...LINK_ROOM.sofa }, vel: { x: 0, y: 0, z: 0 } },
    { id: 2, name: 'Bia', alive: true, bot: false, pos: { x: 6, y: 0, z: -18 }, vel: { x: 0, y: 0, z: 0 } },
  ];
  let T = 0;
  const evs = [];
  const core = new InvasionCore({
    T: () => T, size: [58, 74], players: () => duo, story: () => true, survival: true,
    P: { collides: () => false, groundAt: () => 0, losClear: () => false },
    storyBlocks: () => [], spawnPoints: () => [{ x: 1, y: 0, z: 1 }],
    spawnZombie: (_zt, pos) => ({ pos: { ...pos }, vel: { x: 0, y: 0, z: 0 } }),
    emit(ev) { evs.push(ev); }, over() {}, hurtPlayer() {},
  });
  core.start();
  core.wave = 21; core.egg.wave = 21;
  assert.equal(core.eggUse(duo[0], 'sofa'), true);
  T = duo[0].eggSitUntil;
  core.stepEggs(0.05, T);
  assert.equal(core.egg.chavi.locked, true);
  assert.equal(duo[0].eggTrap, true);
  const said = evs.find((e) => e[0] === 'qe' && e[1] === 'msg');
  assert.equal(said[2], linkLine('Ana'));
  core.stepEggs(0.05, T);
  assert.equal(core.zombies.some((z) => z.egg === 'chavi'), true);

  const soloP = [{ id: 3, name: 'Caio', alive: true, bot: false, pos: { ...LINK_ROOM.sofa }, vel: { x: 0, y: 0, z: 0 } }];
  const walker = { id: 9, alive: true, friendly: false, pos: { x: 4, y: 0, z: -20 }, lureId: 0, lureUntil: 0 };
  const solo = new InvasionCore({
    T: () => T, size: [58, 74], players: () => soloP, story: () => true, survival: true,
    P: { collides: () => false, groundAt: () => 0, losClear: () => false },
    storyBlocks: () => [], spawnPoints: () => [{ x: 1, y: 0, z: 1 }],
    spawnZombie: (_zt, pos) => ({ pos: { ...pos }, vel: { x: 0, y: 0, z: 0 } }),
    emit() {}, over() {}, hurtPlayer() {},
  });
  solo.start();
  solo.zombies.push(walker);
  solo.wave = 22; solo.egg.wave = 22;
  solo.eggUse(soloP[0], 'sofa');
  T = soloP[0].eggSitUntil;
  solo.stepEggs(0.05, T);
  assert.equal(solo.egg.chavi.locked, false);
  assert.equal(soloP[0].eggTrap, false);
  assert.equal(walker.lureId, 3);
});

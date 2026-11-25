import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, RAY } from './rules.js';
import { rollBox, rollStoryBox, storyBoxOk, openStoryCampus, closedDoorSolids } from './survival.js';
import { InvasionCore } from './invasion.js';

const campus = {
  survival: {
    areas: [
      { id: 'saguao', start: true },
      { id: 'rua' },
    ],
    doors: [
      { id: 'porta-rua', block: [0, 0, 0, 1, 2, 1] },
      { id: 'porta-cancela', block: [2, 0, 2, 3, 2, 3] },
    ],
  },
};

test('a história abre o prédio e tira a colisão dos portões', () => {
  const state = { open: new Set(), areas: new Set(['saguao']) };
  assert.equal(closedDoorSolids(campus, state.open).length, 2);
  openStoryCampus(campus, state);
  assert.equal(closedDoorSolids(campus, state.open).length, 0);
  assert.ok(state.areas.has('saguao') && state.areas.has('rua'));
  assert.ok(state.open.has('porta-rua') && state.open.has('porta-cancela'));
});

test('a barraca da história não entrega arma especial e a clássica ainda pode tirar a Ray Gun', () => {
  const banned = new Set(['ray', 'bazooka', 'sniper', 'canhao', 'minigun', 'disco', 'milho', 'saco', 'estilingue']);
  for (let i = 0; i < 400; i++) {
    const id = rollStoryBox(() => (i + 0.5) / 400, -1);
    const w = WEAPONS[id];
    assert.equal(storyBoxOk(w), true);
    assert.ok(!banned.has(w.key));
    assert.notEqual(id, RAY);
  }
  let ray = false;
  for (let i = 0; i < 20; i++) if (rollBox(() => i / 400, -1) === RAY) ray = true;
  assert.equal(ray, true);
});

test('a horda da história chega no bloco de quem está jogando e a leva seguinte fica nele', () => {
  const blocks = [
    { id: 'saguao', box: [-15, 12, 15, 33, 0, 3.2], points: [{ x: -12, y: 0, z: 14.5 }, { x: 12, y: 0, z: 30 }] },
    { id: 'rua', box: [-56, -64, 56, 66, 0, 3], points: [{ x: 40, y: 0, z: -28 }, { x: -50, y: 0, z: 40 }] },
  ];
  const players = [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 20 } }];
  const core = new InvasionCore({
    T: () => 30, size: [58, 74], players: () => players, story: () => true, survival: true,
    P: { collides: () => false, groundAt: () => 0, losClear: () => false },
    storyBlocks: () => blocks,
    spawnPoints: () => blocks.flatMap((b) => b.points),
    spawnZombie: (type, pos) => ({ pos: { ...pos }, zt: type, vel: { x: 0, y: 0, z: 0 } }),
    emit() {}, over() {}, hurtPlayer() {}, rnd: () => 0.37,
  });
  const inside = (p) => p.x >= -15 && p.x <= 15 && p.z >= 12 && p.z <= 33;
  core.startWave(1);
  const first = core.spawn('walker');
  players[0].pos = { x: 48, y: 0, z: -36 };
  const second = core.spawn('walker');
  assert.ok(inside(first.pos));
  assert.ok(inside(second.pos));
  core.startWave(2);
  const later = core.spawn('walker');
  assert.ok(later && Math.hypot(later.pos.x - 48, later.pos.z + 36) <= 16);
});

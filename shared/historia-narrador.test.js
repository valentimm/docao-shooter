import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_LINES, storyLine } from './historia-narrador.js';
import { InvasionCore } from './invasion.js';

test('cada wave da história tem uma fala e a clássica não narra', () => {
  assert.equal(STORY_LINES.length, 30);
  assert.equal(new Set(STORY_LINES).size, 30);
  for (let w = 1; w <= 30; w++) assert.ok(storyLine(w).length > 40, 'wave ' + w);
  assert.equal(storyLine(0), '');
  assert.equal(storyLine(31), '');
  assert.match(storyLine(21), /Barriguinha/);
  assert.match(storyLine(24), /sinuca/i);
  assert.match(storyLine(25), /Oclinhos/);
  assert.match(storyLine(29), /skins/);
  assert.match(storyLine(30), /Big/);

  const players = [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 } }];
  const host = (story) => {
    const evs = [];
    const core = new InvasionCore({
      T: () => 30, size: [58, 74], players: () => players, story: () => story, survival: true,
      P: { collides: () => false, groundAt: () => 0, losClear: () => false },
      storyBlocks: () => [], spawnPoints: () => [{ x: 1, y: 0, z: 1 }],
      spawnZombie: () => ({ pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } }),
      emit(ev) { evs.push(ev); }, over() {}, hurtPlayer() {}, rnd: () => 0.2,
    });
    core.start();
    core.startWave(1);
    return evs;
  };
  const told = host(true).find((e) => e[0] === 'qe' && e[1] === 'nar');
  assert.deepEqual(told, ['qe', 'nar', 1, '', '']);
  assert.equal(host(false).some((e) => e[0] === 'qe' && e[1] === 'nar'), false);
});

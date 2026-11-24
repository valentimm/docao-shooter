import test from 'node:test';
import assert from 'node:assert/strict';
import { storyPlan, CORRUPT_SKINS, breadBlocks, praisesTable } from './historia-finale.js';
import { claimMuro, eggPrompt, createEgg, EGG_SPOTS } from './historia-egg.js';
import { waveSpec, waveQueue, InvasionCore } from './invasion.js';
import { W_FALL, W_NADE } from './rules.js';

test('o muro só pode ser reivindicado uma vez', () => {
  const book = createEgg(() => 0);
  const wall = EGG_SPOTS.walls[0];
  const p = { id: 1, pos: { x: wall.x, y: wall.y, z: wall.z }, alive: true };
  assert.equal(eggPrompt(p, book).id, wall.id);
  assert.equal(claimMuro(book), true);
  assert.equal(claimMuro(book), false);
  assert.equal(eggPrompt(p, book), null);
  const other = { id: 2, pos: { x: wall.x, y: wall.y, z: wall.z }, alive: true };
  assert.equal(eggPrompt(other, book), null);
});

test('as waves secretas têm o elenco certo e a clássica não', () => {
  const w21 = storyPlan(21);
  assert.ok(w21.queue.every((t) => t === 'filho'));
  assert.equal(w21.boss, 'bossMini');
  assert.equal(storyPlan(24).queue[0], 'sinuca');
  assert.equal(storyPlan(25).boss, 'bossOclinhos');
  assert.equal(storyPlan(30).boss, 'bossBig');
  const drip = storyPlan(29).drip;
  assert.equal(drip.length, CORRUPT_SKINS.length);
  assert.ok(drip.every((t) => t.startsWith('c:') && !t.includes('c20')));
  assert.equal(storyPlan(22), null);
  const classic = waveQueue(waveSpec(21, 1), () => 0.1);
  assert.ok(classic.every((t) => t !== 'filho' && t !== 'sinuca' && t !== 'corrupt' && !String(t).startsWith('c:')));
});

test('só a história monta as waves secretas, e o muro é de um jogador', () => {
  const host = (story) => {
    const players = [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 } }, { id: 2, alive: true, pos: { x: 0, y: 0, z: 0 } }];
    const core = new InvasionCore({
      T: () => 10, size: [40, 40], players: () => players, story: () => story, emit() {}, over() {},
      spawnZombie: (type, pos) => ({ pos: { ...pos }, zt: type }),
    });
    core.start();
    return { core, players };
  };
  const story = host(true);
  story.core.startWave(21);
  assert.equal(story.core.spec.bossKind, 'bossMini');
  assert.ok(story.core.queue.every((t) => t === 'filho'));
  story.core.startWave(29);
  assert.equal(story.core.drip.length, CORRUPT_SKINS.length);
  story.core.startWave(30);
  assert.equal(story.core.spec.bossKind, 'bossBig');
  story.core.zombies.push({ alive: true, egg: 'capataz' }, { alive: true, zt: 'bonezinho' });
  assert.equal(story.core.waveZombies().length, 1);
  const wall = EGG_SPOTS.walls[0];
  story.players[0].pos = { x: wall.x, y: wall.y, z: wall.z };
  story.players[1].pos = { x: wall.x, y: wall.y, z: wall.z };
  assert.equal(story.core.eggUse(story.players[0], wall.id), true);
  assert.equal(story.core.eggUse(story.players[1], wall.id), false);
  const classic = host(false);
  classic.core.startWave(21);
  assert.ok(classic.core.queue.every((t) => t !== 'filho' && t !== 'sinuca'));
  assert.notEqual(classic.core.spec.bossKind, 'bossMini');
});

test('o pão do Oclinhos segura tiro e a sinuca ajoelha perto da mesa', () => {
  const z = { zt: 'bossOclinhos', breadUntil: 10 };
  assert.equal(breadBlocks(z, 0, 9), true);
  assert.equal(breadBlocks(z, 0, 10), false);
  assert.equal(breadBlocks(z, W_FALL, 9), false);
  assert.equal(breadBlocks(z, W_NADE, 9), false);
  const pool = EGG_SPOTS.pool;
  assert.equal(praisesTable({ zt: 'sinuca', pos: { x: pool.x + 2, y: pool.y, z: pool.z } }, pool), true);
  assert.equal(praisesTable({ zt: 'bonezinho', pos: { x: pool.x, y: pool.y, z: pool.z } }, pool), false);
  assert.equal(praisesTable({ zt: 'sinuca', pos: { x: pool.x + 20, y: pool.y, z: pool.z } }, pool), false);
});

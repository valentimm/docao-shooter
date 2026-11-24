import test from 'node:test';
import assert from 'node:assert/strict';
import { createEgg, stepRitual, facingAway, notePool, eggAfterWave, eggComplete, EGG_SPOTS, nearestUrinal } from './historia-egg.js';

test('o ritual pede três agachamentos, a dança e as costas', () => {
  const book = createEgg(() => 0);
  const spot = EGG_SPOTS.urinals[1];
  const p = { id: 1, pos: { x: spot.x, y: 0, z: spot.z - 1.2 }, yaw: 0, crouch: 0, alive: true, eggDanceUntil: 0 };
  assert.equal(nearestUrinal(p.pos).x, spot.x);
  assert.equal(facingAway(p, spot), true);
  p.yaw = Math.PI;
  assert.equal(facingAway(p, spot), false);
  for (let i = 0; i < 3; i++) {
    p.crouch = 0; stepRitual(book, p, 1);
    p.crouch = 1; assert.equal(stepRitual(book, p, 1), null);
  }
  assert.equal(book.ritual[1].n, 3);
  p.eggDanceUntil = 5;
  assert.equal(stepRitual(book, p, 2), null);
  p.yaw = 0;
  assert.equal(stepRitual(book, p, 2), 'summon');
});

test('a sinuca conta três vezes na mesma wave', () => {
  const book = createEgg(() => 0.1);
  const p = { id: 4 };
  assert.equal(notePool(book, p, 3), 1);
  assert.equal(notePool(book, p, 3), 2);
  assert.equal(notePool(book, p, 3), 'snack');
  assert.equal(notePool(book, p, 4), 1);
});

test('sem os quatro passos a história acaba na 20; com eles segue até a 30', () => {
  const egg = createEgg(() => 0.2);
  assert.equal(eggAfterWave(egg, 20, false).finish, true);
  egg.steps = { cria: true, lanche: true, refri: true, muro: false };
  const mid = eggAfterWave(egg, 20, true);
  assert.equal(mid.finish, false);
  assert.equal(mid.cap, 21);
  egg.steps.muro = true;
  const open = eggAfterWave(egg, 21, false);
  assert.equal(eggComplete(egg), true);
  assert.equal(open.finish, false);
  assert.equal(open.cap, 30);
  assert.equal(eggAfterWave(egg, 30, false).finish, true);
});

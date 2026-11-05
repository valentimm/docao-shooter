// node --test test-passos.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { FOOTSTEP, footstepVolume, makesFootsteps, takeFootstep } from './shared/footsteps.js';

const walker = (over = {}) => ({
  alive: true, onGround: true, crouch: 0, zt: 0, stepAcc: 0,
  vel: { x: 6.8, y: 0, z: 0 },
  ...over,
});

test('volume cai com a distância e some no limite', () => {
  assert.equal(footstepVolume(0), 1);
  assert.ok(footstepVolume(2) > footstepVolume(9));
  assert.ok(footstepVolume(9) > footstepVolume(16));
  assert.equal(footstepVolume(FOOTSTEP.range), 0);
  assert.equal(footstepVolume(FOOTSTEP.range + 4), 0);
  assert.equal(footstepVolume(FOOTSTEP.range / 2), 0.5);
});

test('andar no chão marca o passo; parado, no ar ou morto não', () => {
  const e = walker();
  assert.equal(takeFootstep(e, 0.1), false);
  assert.equal(takeFootstep(e, FOOTSTEP.stride / 6.8), true);
  assert.equal(takeFootstep(walker({ vel: { x: 0.2, y: 0, z: 0 } }), 1), false);
  assert.equal(takeFootstep(walker({ onGround: false }), 1), false);
  assert.equal(takeFootstep(walker({ alive: false }), 1), false);
  assert.equal(takeFootstep(walker({ zt: 'runner' }), 1), false);
});

test('agachado não faz barulho, mesmo andando', () => {
  const ducked = walker({ crouch: 1, stepAcc: 1.2 });
  assert.equal(makesFootsteps(ducked), false);
  assert.equal(takeFootstep(ducked, 1), false);
  assert.equal(ducked.stepAcc, 0);
  const mid = walker({ crouch: FOOTSTEP.mute });
  assert.equal(takeFootstep(mid, 1), false);
  const rising = walker({ crouch: FOOTSTEP.mute - 0.01 });
  assert.equal(makesFootsteps(rising), true);
  assert.equal(takeFootstep(rising, FOOTSTEP.stride / 6.8), true);
});

test('mais rápido, o passo chega antes; um quadro longo não dispara uma rajada', () => {
  const slow = walker({ vel: { x: 3, y: 0, z: 0 } });
  const fast = walker();
  const dt = 0.2;
  takeFootstep(slow, dt); takeFootstep(fast, dt);
  assert.ok(fast.stepAcc > slow.stepAcc);
  const burst = walker();
  assert.equal(takeFootstep(burst, 2), true);
  assert.ok(burst.stepAcc < FOOTSTEP.stride);
  assert.equal(takeFootstep(burst, 0), false);
});

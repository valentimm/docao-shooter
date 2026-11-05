// Passos dos jogadores. Quem anda no chão, em pé, marca um passo a cada `stride` metros.
// O volume que o ouvinte escuta é 1 colado no outro e cai até 0 em `range` metros.
// Agachado (crouch >= mute) não faz barulho.
import { crouchAmount } from './stance.js';

export const FOOTSTEP = {
  stride: 1.65,
  minSpeed: 1.05,
  range: 18,
  mute: 0.5,
};

export function footstepVolume(distance) {
  if (!Number.isFinite(distance) || distance < 0) return 0;
  return Math.max(0, Math.min(1, 1 - distance / FOOTSTEP.range));
}

export function makesFootsteps(e) {
  if (!e || !e.alive || e.zt) return false;
  if (!e.onGround) return false;
  return crouchAmount(e.crouch) < FOOTSTEP.mute;
}

// true quando este quadro fecha um passo. Longe ou perto, o ritmo é o mesmo; o volume é à parte.
export function takeFootstep(e, dt) {
  if (!makesFootsteps(e)) { if (e) e.stepAcc = 0; return false; }
  const speed = Math.hypot(e.vel?.x || 0, e.vel?.z || 0);
  if (!(speed >= FOOTSTEP.minSpeed)) { e.stepAcc = 0; return false; }
  e.stepAcc = (e.stepAcc || 0) + Math.max(0, dt) * speed;
  if (e.stepAcc < FOOTSTEP.stride) return false;
  e.stepAcc -= FOOTSTEP.stride;
  if (e.stepAcc >= FOOTSTEP.stride) e.stepAcc = 0;
  return true;
}

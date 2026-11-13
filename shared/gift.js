// ============================================================
//  Saco de Presentes: taca uma caixa embrulhada em arco.
//  Estoura no impacto (parede, chão, Docão) ou após GIFT.fuse.
//  Mesma conta no cliente (offline e visual online) e no servidor (dano).
// ============================================================
import { rayCapsule } from './combat.js';

export const GIFT = {
  speed: 18, grav: -16, r: 0.16, fuse: 1.2, pad: 0.1,
  radius: 4.5, maxDmg: 100, selfMul: 0.4, knock: 11, lift: 8,
};

export const giftOpts = (wIdx, maxDmg = GIFT.maxDmg) => ({
  radius: GIFT.radius, maxDmg, selfMul: GIFT.selfMul, knock: GIFT.knock, lift: GIFT.lift, wIdx, kind: 's', fx: 'gift',
});

const nrm = (x, y, z) => { const L = Math.hypot(x, y, z) || 1; return { x: x / L, y: y / L, z: z / L }; };

// mira de bot com queda: sobe 0,5·g·T² (T = distância horizontal / velocidade)
export function giftAim(o, at) {
  const dx = at.x - o.x, dz = at.z - o.z, T = Math.hypot(dx, dz) / GIFT.speed;
  return nrm(dx, at.y - o.y - 0.5 * GIFT.grav * T * T, dz);
}

// g = { pos, vel, t, dead }; ents = quem pode levar a caixa no corpo; skip(e) = ignora (dono no começo, amigos).
// Devolve null (segue voando) ou { pos, n (normal da parede ou null), e (Docão atingido ou null) }
export function stepGift(P, g, dt, ents = [], skip = () => false) {
  g.t += dt; g.vel.y += GIFT.grav * dt;
  const sp = Math.hypot(g.vel.x, g.vel.y, g.vel.z) || 1, d = { x: g.vel.x / sp, y: g.vel.y / sp, z: g.vel.z / sp }, step = sp * dt;
  const w = P.rayWorldN(g.pos, d, step + GIFT.r); let best = w && w.t - GIFT.r <= step ? { t: Math.max(0, w.t - GIFT.r), n: w.n, e: null } : null;
  for (const e of ents) {
    if (!e.alive || skip(e)) continue;
    const t = rayCapsule(g.pos, d, step, e.pos, GIFT.pad, e.crouch);
    if (t !== null && (!best || t < best.t)) best = { t, n: null, e };
  }
  const go = best ? best.t : step;
  g.pos.x += d.x * go; g.pos.y += d.y * go; g.pos.z += d.z * go;
  if (best || g.t >= GIFT.fuse) { g.dead = true; return { pos: { x: g.pos.x, y: g.pos.y, z: g.pos.z }, n: best ? best.n : null, e: best ? best.e : null }; }
  return null;
}

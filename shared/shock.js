// ============================================================
//  Pau de choque (tecla 5): estaca elétrica que voa em arco, finca no 1º contato (chão/parede/rampa) e dá choque por 3 s.
//  Mesma conta no cliente (offline e visual online) e no servidor (dano/atordoamento). Nunca mata: deixa no mínimo 1 de vida.
// ============================================================
export const SHOCK = { speed: 17, grav: -16, r: 0.06, flight: 2.5, life: 3, radius: 4.5, dy: 2.5, tick: 0.5, dmg: 7, minHp: 1, stun: 0.9, bossStun: 0.4, slow: 0.35, spawnWith: 1, max: 2, trainRefill: 10, sink: 0.08, top: 0.5 };
// estaca = { pos, vel, t }. Anda dt; devolve { pos, n } quando finca (e marca s.stuck), null no ar; s.dead se voou demais
export function stepShock(P, s, dt) {
  s.t += dt; s.vel.y += SHOCK.grav * dt;
  const sx = s.vel.x * dt, sy = s.vel.y * dt, sz = s.vel.z * dt, L = Math.hypot(sx, sy, sz);
  if (L > 1e-6) {
    const d = { x: sx / L, y: sy / L, z: sz / L }, hit = P.rayWorldN(s.pos, d, L + SHOCK.r);
    if (hit && hit.t - SHOCK.r <= L) { const go = Math.max(0, hit.t - SHOCK.r); s.pos.x += d.x * go; s.pos.y += d.y * go; s.pos.z += d.z * go; s.stuck = true; s.n = { x: hit.n.x, y: hit.n.y, z: hit.n.z }; return { pos: { x: s.pos.x, y: s.pos.y, z: s.pos.z }, n: s.n }; }
    s.pos.x += sx; s.pos.y += sy; s.pos.z += sz;
  }
  if (s.t >= SHOCK.flight || s.pos.y < -20) s.dead = true;
  return null;
}
// ponto de onde saem os arcos (topo da estaca, pela normal)
export const shockTop = (s) => ({ x: s.pos.x + s.n.x * SHOCK.top, y: s.pos.y + s.n.y * SHOCK.top, z: s.pos.z + s.n.z * SHOCK.top });
// quem leva o pulso: ents [{alive,pos,crouch,invulnUntil}], center(e,y) -> {x,y,z}; nunca o dono nem companheiro, só com linha livre
export function shockReach(s, ents, T, friends, losClear, center) {
  const c = shockTop(s), out = [];
  for (const t of ents) {
    if (!t.alive || t === s.owner || friends(t, s.owner) || T < (t.invulnUntil || 0)) continue;
    const b = center(t, 1), dx = b.x - c.x, dy = b.y - c.y, dz = b.z - c.z;
    if (Math.abs(dy) > SHOCK.dy || dx * dx + dy * dy + dz * dz > (SHOCK.radius + 0.4) ** 2 || !losClear(c, b)) continue;
    out.push(t);
  }
  return out;
}
export const shockDmg = (hp) => Math.max(0, Math.min(SHOCK.dmg, Math.ceil(hp) - SHOCK.minHp));
export const shockStun = (t) => SHOCK.stun * (t && typeof t.zt === 'string' && t.zt.startsWith('boss') ? SHOCK.bossStun : 1);

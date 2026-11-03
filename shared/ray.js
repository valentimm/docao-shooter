// ============================================================
//  Ray Gun (Survival): pulso de raio que voa reto, quica na normal da superfície
//  e estoura numa explosão pequena. A mesma conta roda no cliente (visual offline)
//  e no servidor (dano). Não atravessa parede: rebate.
//
//  ray = { pos, dir (unitário), bounces, t, traveled }.
//  stepRay devolve [{ pos, n, dead }]. dead = o pulso acaba ali (estouro).
//  Quica RAY.bounces vezes; o contato seguinte, ou a distância RAY.range, estoura.
// ============================================================
export const RAY = {
  speed: 36,
  r: 0.14,
  bounces: 3,
  range: 34,
  life: 1.35,
  radius: 1.7,
  selfMul: 0.085,
  knock: 2.2,
  lift: 0.8,
};

// O dano do estouro é o dmg da arma (já com o tier da Papada, se houver).
export function raySplash(w) {
  return {
    radius: RAY.radius,
    maxDmg: w && w.dmg > 0 ? w.dmg : 260,
    selfMul: RAY.selfMul,
    knock: RAY.knock,
    lift: RAY.lift,
  };
}

function reflect(dir, n) {
  const k = 2 * (dir.x * n.x + dir.y * n.y + dir.z * n.z);
  dir.x -= k * n.x; dir.y -= k * n.y; dir.z -= k * n.z;
  const L = Math.hypot(dir.x, dir.y, dir.z) || 1;
  dir.x /= L; dir.y /= L; dir.z /= L;
}

export function stepRay(P, r, dt) {
  const out = [];
  let left = RAY.speed * dt;
  r.t = (r.t || 0) + dt;
  r.traveled = r.traveled || 0;
  r.bounces = r.bounces || 0;
  const boom = (pos, n) => { r.dead = true; out.push({ pos, n, dead: true }); };
  for (let i = 0; i < 4 && left > 1e-5 && !r.dead; i++) {
    const room = RAY.range - r.traveled;
    if (room <= 1e-4) { boom({ x: r.pos.x, y: r.pos.y, z: r.pos.z }, { x: 0, y: 1, z: 0 }); return out; }
    const cast = Math.min(left, room);
    const hit = P.rayWorldN(r.pos, r.dir, cast + RAY.r);
    if (!hit || hit.t - RAY.r > cast) {
      r.pos.x += r.dir.x * cast; r.pos.y += r.dir.y * cast; r.pos.z += r.dir.z * cast;
      r.traveled += cast; left -= cast;
      if (r.traveled >= RAY.range - 1e-3) boom({ x: r.pos.x, y: r.pos.y, z: r.pos.z }, { x: 0, y: 1, z: 0 });
      break;
    }
    const go = Math.max(0, hit.t - RAY.r);
    r.pos.x += r.dir.x * go; r.pos.y += r.dir.y * go; r.pos.z += r.dir.z * go;
    r.traveled += go; left -= go;
    const pos = { x: r.pos.x, y: r.pos.y, z: r.pos.z };
    if (r.bounces >= RAY.bounces || r.traveled >= RAY.range - 1e-3) { boom(pos, hit.n); return out; }
    reflect(r.dir, hit.n);
    r.bounces++;
    out.push({ pos, n: hit.n, dead: false });
    if (left < 1e-4) left = 1e-4;
  }
  if (!r.dead && r.t >= RAY.life) boom({ x: r.pos.x, y: r.pos.y, z: r.pos.z }, { x: 0, y: 1, z: 0 });
  return out;
}

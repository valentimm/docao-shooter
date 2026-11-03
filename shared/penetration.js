// ============================================================
//  Collateral e penetração de parede (cliente offline + servidor). Sem DOM, sem Three.js.
//  A bala é um raio: atravessa corpos (W.pierce corpos extras, dano × W.pierceMul a cada um) e superfícies leves
//  (W.pen = orçamento em metros de parede fina; caixote de madeira conta PEN.wood da espessura).
//  'Leve' sai da geometria (as caixas não têm material): parede fina = menor lado horizontal ≤ 0,65 m e mais alta que grossa;
//  caixote = caixa solta ≤ 2,05 m. Chão, laje, rampa, muro de 1 m, contêiner, ônibus e o limite do mapa seguram a bala.
// ============================================================
import { HITBOXES } from './physics.js';
import { stanceScale } from './stance.js';
export const PEN = { thin: 0.65, crate: 2.05, wood: 0.45, loss: 0.15, slope: 0.45, minMul: 0.2, maxWalls: 3, eps: 1e-3, heliMin: 0.15 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const at = (o, d, t) => ({ x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t });
// 'thin' (parede fina, mureta, guarda-corpo, poste), 'wood' (caixote, barril, banco) ou null (segura qualquer bala)
export function solidKind(s) {
  if (s.ramp || s.cover) return null; const dx = s.max.x - s.min.x, dy = s.max.y - s.min.y, dz = s.max.z - s.min.z, m = Math.min(dx, dz);
  if (m <= PEN.thin && dy >= m) return 'thin';
  if (Math.max(dx, dz) <= PEN.crate && dy <= PEN.crate) return 'wood';
  return null;
}
// entrada/saída do raio na caixa (slabs) com a normal de cada face
export function boxSpan(o, d, s) {
  let t0 = -Infinity, t1 = Infinity, a0 = 'x', a1 = 'x', s0 = 1, s1 = 1;
  for (const ax of ['x', 'y', 'z']) {
    if (Math.abs(d[ax]) < 1e-9) { if (o[ax] < s.min[ax] || o[ax] > s.max[ax]) return null; continue; }
    const a = (s.min[ax] - o[ax]) / d[ax], b = (s.max[ax] - o[ax]) / d[ax], lo = Math.min(a, b), hi = Math.max(a, b), sg = d[ax] > 0 ? -1 : 1;
    if (lo > t0) { t0 = lo; a0 = ax; s0 = sg; } if (hi < t1) { t1 = hi; a1 = ax; s1 = -sg; }
  }
  if (t0 > t1 || t1 < 0) return null;
  const n = (ax, sg) => ({ x: ax === 'x' ? sg : 0, y: ax === 'y' ? sg : 0, z: ax === 'z' ? sg : 0 });
  return { t0: Math.max(0, t0), t1, n0: n(a0, s0), n1: n(a1, s1) };
}
// raio × esfera: [entrada, saída] ou null
export function sphereSpan(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, h = b * b - (ox * ox + oy * oy + oz * oz - r * r);
  if (h < 0) return null; const q = Math.sqrt(h); return [-b - q, -b + q];
}
export function falloffMul(W, t) { if (!W.falloff) return 1; const [n0, n1, mn] = W.falloff; return clamp(1 - (t - n0) / (n1 - n0) * (1 - mn), mn, 1); }
// agachado: o corpo achata na vertical (igual ao rayHitboxes de physics.js); devolve [entrada, saída] no raio original
function bodySpan(o, d, p, y, r, crouch) {
  const s = stanceScale(crouch); if (s >= 0.9999) return sphereSpan(o, d, { x: p.x, y: p.y + y, z: p.z }, r);
  const L = Math.hypot(d.x, d.y / s, d.z); if (L < 1e-9) return null;
  const sp = sphereSpan({ x: o.x, y: p.y + (o.y - p.y) / s, z: o.z }, { x: d.x / L, y: d.y / s / L, z: d.z / L }, { x: p.x, y: p.y + y, z: p.z }, r);
  return sp ? [sp[0] / L, sp[1] / L] : null;
}
// P = createPhysics(...); targets = [{ e, p, crouch }] (p = pés, já voltados no tempo no servidor; crouch 0..1); helis = [{ h, c, r }] (o mesmo h pode vir 2×)
// devolve { hits: [{ e, t, head, dmg, walls, bodies }], heli: { h, t, dmg } | null, end, stop: 'far'|'wall'|'body'|'heli', holes: [{ p, n, out }] }
export function traceShot(P, o, d, W, targets, helis = [], scale = 1) {
  const far = W.range, out = { hits: [], heli: null, end: far, stop: 'far', holes: [] }, done = new Set();
  let t0 = 0, mul = 1, left = W.pen || 0, walls = 0, bodies = 0;
  for (let it = 0; it < 8; it++) {
    const wh = P.rayWorldS(at(o, d, t0), d, far - t0), wallT = wh ? t0 + wh.t : far, seg = [];
    for (const { e, p, crouch, size } of targets) {
      if (done.has(e)) continue; let b = null; const sz = size || 1; // zumbis da Invasão: hitbox escalada a partir dos pés (igual ao scaleHit)
      for (const [y, r, head] of HITBOXES) {
        const sp = bodySpan(o, d, p, y * sz, r * sz, crouch || 0); if (!sp || sp[1] <= t0) continue;
        const t = sp[0] >= t0 ? sp[0] : t0 > 0 ? t0 : sp[1]; // encostado do outro lado da parede: entra no início do trecho; colado no cano: raiz de trás (igual ao raySphere)
        if (t > 0 && t < wallT && (!b || t < b.t)) b = { e, t, head };
      }
      if (b) seg.push(b);
    }
    for (const hl of helis) { const sp = sphereSpan(o, d, hl.c, hl.r); if (!sp) continue; const t = Math.max(sp[0], t0, PEN.heliMin); if (t < sp[1] && t < wallT) seg.push({ hl: hl.h, t }); }
    seg.sort((a, b) => a.t - b.t);
    for (const s of seg) {
      if (s.hl) { out.heli = { h: s.hl, t: s.t, dmg: W.dmg * scale * falloffMul(W, s.t) * mul }; out.end = s.t; out.stop = 'heli'; return out; }
      out.hits.push({ e: s.e, t: s.t, head: s.head, dmg: W.dmg * scale * (s.head ? W.headMul : 1) * falloffMul(W, s.t) * mul, walls, bodies }); done.add(s.e);
      if (++bodies > (W.pierce || 0)) { out.end = s.t; out.stop = 'body'; return out; }
      mul *= W.pierceMul ?? 1;
    }
    if (!wh) { out.end = far; out.stop = 'far'; return out; }
    out.end = wallT; out.stop = 'wall';
    const kind = wh.s && solidKind(wh.s); if (!kind || walls >= PEN.maxWalls || !(left > 0)) return out;
    const sp = boxSpan(o, d, wh.s); if (!sp) return out;
    const a0 = Math.max(sp.t0, t0), cost = (sp.t1 - a0) * (kind === 'wood' ? PEN.wood : 1); if (cost > left + 1e-9) return out; // caixas sobrepostas: conta só o trecho novo
    left -= cost; mul *= clamp(1 - PEN.loss - PEN.slope * cost / W.pen, PEN.minMul, 1); walls++;
    out.holes.push({ p: at(o, d, a0), n: sp.n0, out: false }, { p: at(o, d, sp.t1), n: sp.n1, out: true });
    t0 = sp.t1 + PEN.eps; if (t0 >= far) { out.end = far; out.stop = 'far'; return out; }
  }
  return out;
}

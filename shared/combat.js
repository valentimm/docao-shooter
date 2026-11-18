// ============================================================
//  Combate compartilhado (offline + servidor). Sem DOM, sem Three.js.
//  • Corpo do Docão como cápsula vertical (equivale às esferas de acerto: pés ~0,02 m, topo 2,08 m, raio 0,58).
//  • Explosões (Bazuca e Copo Bomba): distância do centro da explosão ao PONTO MAIS PRÓXIMO da cápsula (não ao centro);
//    linha de visão testada de 2 origens para 4 pontos do corpo (pés, peito, cabeça, ponto mais próximo) — basta um livre.
//    Dano = maxDmg × (0,2 + 0,8 × (1 − d/raio)); o raio é o mesmo do efeito visual (o anel de choque termina no raio).
//  • Foguete colide com a cápsula (com a folga do próprio foguete), então acerto direto sempre conta (d = 0 → dano máximo).
//  • Sniper: dispersão zero com luneta e parado/quase parado; pequena andando ou sem luneta.
// ============================================================
import { stanceScale } from './stance.js';

export const BODY = { y0: 0.6, y1: 1.5, r: 0.58 };
export const ROCKET_PAD = 0.15;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function bodyClosest(c, pos, crouch = 0, body = null) {
  const B = body || BODY, scale = body ? 1 : stanceScale(crouch), r = B.r, ry = r * scale;
  const ay = clamp(c.y, pos.y + B.y0 * scale, pos.y + B.y1 * scale);
  const dx = c.x - pos.x, dy = c.y - ay, dz = c.z - pos.z, h = Math.hypot(dx, dz);
  if ((h / r) ** 2 + (dy / ry) ** 2 <= 1) return { d: 0, point: { x: c.x, y: c.y, z: c.z } };
  // Ponto mais próximo na tampa elíptica (ou na lateral cilíndrica).
  let lo = 0, hi = Math.max(r, ry) * Math.hypot(h, dy);
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if ((r * h / (m + r * r)) ** 2 + (ry * dy / (m + ry * ry)) ** 2 > 1) lo = m; else hi = m;
  }
  const k = r * r / (hi + r * r), ky = ry * ry / (hi + ry * ry);
  const point = { x: pos.x + dx * k, y: ay + dy * ky, z: pos.z + dz * k };
  return { d: Math.hypot(c.x - point.x, c.y - point.y, c.z - point.z), point };
}
// alvos de uma explosão: [{ e, d, k, dmg, knock:{x,y,z} }]; losClear(a, b) = linha livre entre pontos
// direct = entidade em que o foguete bateu (contato com o casco): conta como distância 0, dano máximo
export function explosionHits(c, o, ents, losClear, owner, teamMode, direct = null) {
  const out = []; const srcs = [{ x: c.x, y: c.y + 0.15, z: c.z }, { x: c.x, y: c.y + 0.9, z: c.z }];
  for (const e of ents) {
    if (!e.alive) continue;
    if (teamMode && owner && e !== owner && e.team === owner.team) continue; // sem fogo amigo (dano em si mesmo continua)
    const scale = e.cheatBody ? 1 : stanceScale(e.crouch), bc = bodyClosest(c, e.pos, e.crouch, e.cheatBody || null), point = bc.point, d = e === direct ? 0 : bc.d; if (d > o.radius) continue;
    const ys = e.cheatBody ? [e.cheatBody.y0, (e.cheatBody.y0 + e.cheatBody.y1) / 2, e.cheatBody.y1] : [0.3 * scale, 1.0 * scale, 1.7 * scale];
    const pts = [point, ...ys.map((y) => ({ x: e.pos.x, y: e.pos.y + y, z: e.pos.z }))];
    let seen = d < 0.35; for (const s of srcs) { if (seen) break; for (const p of pts) if (losClear(s, p)) { seen = true; break; } }
    if (!seen) continue;
    const k = 1 - d / o.radius;
    let hx = e.pos.x - c.x, hz = e.pos.z - c.z; const L = Math.hypot(hx, hz); if (L < 1e-2) { hx = Math.random() - 0.5; hz = Math.random() - 0.5; }
    const n = Math.hypot(hx, hz) || 1;
    out.push({ e, d, k, dmg: o.maxDmg * (0.2 + 0.8 * k) * (e === owner ? o.selfMul : 1), knock: { x: hx / n * o.knock * k, y: o.lift * k, z: hz / n * o.knock * k } });
  }
  return out;
}
// empurrão de tiro (Calibre 12): W.knock = { push, lift }; k = parte do tiro cheio que acertou (cabeça conta mais, teto 1). Direção = atirador → alvo no plano.
// zt = tipo do zumbi (Invasão): Barrigão e chefe quase não se mexem, senão um jogador sozinho segura os dois longe
const ZT_KNOCK = { tank: 0.2, boss: 0.08 };
export function shotKnock(W, from, to, dmg, zt) {
  if (!W || !W.knock || !(dmg > 0)) return null;
  const k = Math.min(1, dmg / (W.dmg * Math.max(1, W.pellets))) * (ZT_KNOCK[zt] ?? 1); let dx = to.x - from.x, dz = to.z - from.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  return { x: dx * W.knock.push * k, y: W.knock.lift * k, z: dz * W.knock.push * k };
}
// raio × cápsula vertical em pos (com folga pad). Devolve t ≥ 0 do primeiro contato ou null.
export function rayCapsule(o, d, maxT, pos, pad = 0, crouch = 0, body = null) {
  const cap = body || BODY, scale = body ? 1 : stanceScale(crouch), R = cap.r + pad, ry = cap.r * scale + pad;
  const y0 = pos.y + cap.y0 * scale, y1 = pos.y + cap.y1 * scale; let best = null;
  const take = (t) => { if (t >= 0 && t <= maxT && (best === null || t < best)) best = t; };
  const ox = o.x - pos.x, oz = o.z - pos.z, A = d.x * d.x + d.z * d.z, B = 2 * (ox * d.x + oz * d.z), C = ox * ox + oz * oz - R * R;
  if (C <= 0 && o.y >= y0 && o.y <= y1) return 0; // começou dentro
  if (A > 1e-9) { const disc = B * B - 4 * A * C; if (disc >= 0) { const t = (-B - Math.sqrt(disc)) / (2 * A); const y = o.y + d.y * t; if (y >= y0 && y <= y1) take(t); } }
  for (const cy of [y0, y1]) { // tampas esféricas
    const k = R / ry, py = (o.y - cy) * k, vy = d.y * k;
    const a = d.x * d.x + vy * vy + d.z * d.z, b = ox * d.x + py * vy + oz * d.z, cc = ox * ox + py * py + oz * oz - R * R, h = b * b - a * cc;
    if (cc <= 0) return 0; if (a > 1e-9 && h >= 0) take((-b - Math.sqrt(h)) / a);
  }
  return best;
}
// dispersão do Sniper: scoped = luneta aberta (o overlay aparece), speed = velocidade horizontal, air = no ar.
// Sem luneta todas as snipers abrem bastante; Torresmo tem o cone mais largo.
// Com a luneta e parado continuam retas.
export function sniperSpread(scoped, speed, air, looseHip = false, hipMul = 1, swayMul = 1) {
  const hip = Number.isFinite(hipMul) ? hipMul : 1, sway = Number.isFinite(swayMul) ? swayMul : 1;
  if (scoped) return air ? 0.02 * sway : speed < 1.5 ? 0 : 0.012 * sway;
  if (looseHip) return (air ? 0.2 : speed < 1.5 ? 0.11 : 0.16) * hip;
  return (air ? 0.19 : speed < 1.5 ? 0.1 : 0.15) * hip;
}

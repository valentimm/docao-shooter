// ============================================================
//  Física/colisão compartilhada (sem DOM, sem Three.js) — usada pelo servidor online.
//  mapSolids(map) reproduz exatamente as caixas de colisão que world.js cria no cliente
//  (o teste test-online.mjs confere que são idênticas). createPhysics() traz colisão AABB com teto,
//  chão/rampas, movimento, raio contra o mundo (caixas + rampas) e o passo físico do Copo Bomba.
// ============================================================
import { GRAV, STEP, RADIUS, HEIGHT, NADE, POKE } from './rules.js';
import { stanceHeight, stanceScale } from './stance.js';

export const WALL_COLLIDE_H = 40;
export const FALL_FLOOR = -40; // chão fantasma do abismo; a morte acontece bem antes (map.fall.y)
// map.fall = { y, margin?, rects?: [[x0,z0,x1,z1]], basins?: [[x0,z0,x1,z1,piso]] }
export function baselineY(fall, x, z, hx, hz) {
  if (!fall) return 0;
  if (fall.basins) for (const r of fall.basins) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return r[4];
  const abyss = fall.abyss ?? FALL_FLOOR;
  if (fall.margin && (Math.abs(x) > hx - fall.margin || Math.abs(z) > hz - fall.margin)) return abyss;
  if (fall.rects) for (const r of fall.rects) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return abyss;
  return 0;
}
export function fellOff(fall, y) { return !!(fall && y < fall.y); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const box = (x0, y0, z0, x1, y1, z1, ramp = null) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, ramp });

export function mapSolids(map) {
  const out = [], [hx, hz] = map.size, wh = map.wallH || 4;
  const add = (x0, y0, z0, x1, y1, z1, ramp = null, top = null) => out.push(box(x0, y0, z0, x1, top ?? y1, z1, ramp));
  add(-hx - 1, 0, -hz - 1, hx + 1, wh, -hz, null, WALL_COLLIDE_H); add(-hx - 1, 0, hz, hx + 1, wh, hz + 1, null, WALL_COLLIDE_H);
  add(-hx - 1, 0, -hz, -hx, wh, hz, null, WALL_COLLIDE_H); add(hx, 0, -hz, hx + 1, wh, hz, null, WALL_COLLIDE_H);
  for (const o of map.boxes) { const [x0, y0, z0, x1, y1, z1] = o.b; if (x1 - x0 < 0.01 || y1 - y0 < 0.01 || z1 - z0 < 0.01) continue; add(x0, y0, z0, x1, y1, z1, o.ramp || null); }
  for (const p of map.props || []) {
    const y = p.y || 0;
    switch (p.t) {
      case 'keg': { const r = p.r || 0.48, h = p.h || 1.1; add(p.x - r * 0.85, y, p.z - r * 0.85, p.x + r * 0.85, y + h, p.z + r * 0.85); break; }
      case 'cup': if (!p.deco) { const s = p.s || 4; add(p.x - 0.11 * s, y, p.z - 0.11 * s, p.x + 0.11 * s, y + 0.31 * s, p.z + 0.11 * s); } break;
      case 'bus': add(p.x - 5, y, p.z - 1.4, p.x + 5, y + 3.1, p.z + 1.4); break;
      case 'truck': add(p.x - 4, y, p.z - 1.25, p.x + 2, y + 3.2, p.z + 1.25); add(p.x + 2, y, p.z - 1.2, p.x + 4.3, y + 2.6, p.z + 1.2); break;
      case 'log': { const r = p.r || 0.46, h = p.h || 6; add(p.x - r, y, p.z - r, p.x + r, y + h, p.z + r); break; }
      case 'bench': {
        const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0), hx = 0.85, z0 = -0.25, z1 = 0.32;
        let x0 = Infinity, x1 = -Infinity, a0 = Infinity, a1 = -Infinity;
        for (const lx of [-hx, hx]) for (const lz of [z0, z1]) {
          const wx = p.x + lx * c + lz * s, wz = p.z - lx * s + lz * c;
          x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); a0 = Math.min(a0, wz); a1 = Math.max(a1, wz);
        }
        add(x0, y, a0, x1, y + 0.95, a1); break;
      }
      case 'flowerbed': { const r = 0.95; add(p.x - r, y, p.z - r, p.x + r, y + 0.62, p.z + r); break; }
      case 'car': {
        const L = 4.05, W = 1.68, seg = 1.9;
        add(p.x - W / 2, y + 0.08, p.z - L / 2, p.x + W / 2, y + 1.12, p.z - L / 2 + seg);
        add(p.x - W / 2, y + 0.08, p.z + L / 2 - seg, p.x + W / 2, y + 1.12, p.z + L / 2);
        add(p.x - 0.72, y + 0.9, p.z - 0.85, p.x + 0.72, y + 1.28, p.z + 0.85); break;
      }
      case 'tree': add(p.x - 0.4, y, p.z - 0.4, p.x + 0.4, y + 3, p.z + 0.4); break;
      case 'silo': { const q = p.r * 0.9; add(p.x - q, y, p.z - q, p.x + q, y + p.h, p.z + q); break; }
      case 'hay': add(p.x - 1, y, p.z - 0.6, p.x + 1, y + 1.2, p.z + 0.6); break;
      case 'stall': add(p.x - 1.2, y, p.z - 0.6, p.x + 1.2, y + 1.0, p.z + 0.6); add(p.x - 1.6, y + 2.6, p.z - 1.1, p.x + 1.6, y + 2.72, p.z + 1.1); break;
      case 'awning': add(p.x0, p.y, p.z0, p.x1, p.y + 0.12, p.z1); break;
      case 'jar': add(p.x - 0.4, y, p.z - 0.4, p.x + 0.4, y + 1.1, p.z + 0.4); break;
      case 'pine': if (!(p.y < -2)) add(p.x - 0.4, y, p.z - 0.4, p.x + 0.4, y + 3.1, p.z + 0.4); break;
      case 'drift': { const r = p.r || 1.1, h = p.h || 0.8; add(p.x - r * 0.45, y, p.z - r * 0.45, p.x + r * 0.45, y + h * 0.5, p.z + r * 0.45); break; }
      case 'dome': { const r = p.r || 2.2, h = (p.h || 1.3) + r * 0.55; add(p.x - r, y, p.z - r, p.x + r, y + h, p.z + r); break; }
      case 'tank': { const r = p.r || 1.15, h = p.h || 2.5; add(p.x - r, y, p.z - r, p.x + r, y + h, p.z + r); break; }
      default: break; // placas, neon, rua, água, estandarte, vidro: sem colisão
    }
  }
  return out;
}

export function createPhysics(solids, size, fall = null) {
  const [hx, hz] = size;
  const GRID = 4, grid = new Map(), NONE = [];
  const key = (ix, iz) => ix * 100003 + iz;
  for (const s of solids) for (let ix = Math.floor((s.min.x - 1) / GRID); ix <= Math.floor((s.max.x + 1) / GRID); ix++)
    for (let iz = Math.floor((s.min.z - 1) / GRID); iz <= Math.floor((s.max.z + 1) / GRID); iz++) { const k = key(ix, iz); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
  // Sólidos móveis (bondinho e elevador). Poucos, testados direto, fora da grade.
  let movers = [];
  const setMovers = (list) => { movers = list || []; };
  const solidsAt = (x, z) => {
    const base = grid.get(key(Math.floor(x / GRID), Math.floor(z / GRID))) || NONE;
    if (!movers.length) return base;
    let extra = null;
    for (const s of movers) if (x + 1.4 > s.min.x && x - 1.4 < s.max.x && z + 1.4 > s.min.z && z - 1.4 < s.max.z) (extra || (extra = base.slice())).push(s);
    return extra || base;
  };
  function topAt(s, x, z) {
    if (!s.ramp) return s.max.y;
    let t = s.ramp.axis === 'x' ? (x - s.min.x) / (s.max.x - s.min.x) : (z - s.min.z) / (s.max.z - s.min.z);
    t = clamp(t, 0, 1); if (s.ramp.dir < 0) t = 1 - t;
    return s.min.y + t * (s.max.y - s.min.y);
  }
  // Corpo do Docão: cilindro-caixa de raio RADIUS (pés em y, cabeça em y + HEIGHT).
  // overlapping(): o corpo cruza alguma caixa que não dá pra subir (topo acima de pés + STEP)?
  const over = (s, x, z, r = RADIUS) => x + r > s.min.x && x - r < s.max.x && z + r > s.min.z && z - r < s.max.z;
  // tol: folga (m) no raio, nos pés e na cabeça — o servidor usa uma folguinha pra validar a posição que o cliente manda
  function overlapping(x, y, z, tol = 0, height = HEIGHT) {
    for (const s of solidsAt(x, z)) if (over(s, x, z, RADIUS - tol)) {
      const top = topAt(s, clamp(x, s.min.x, s.max.x), clamp(z, s.min.z, s.max.z)); if (y + tol < top - STEP && y + height - tol > s.min.y) return s;
    }
    return null;
  }
  // chão sob o corpo: mesma pegada (RADIUS) da colisão. Em mapa com abismo, o piso de referência pode ser o fundo do penhasco ou uma bacia.
  function groundAt(x, z, y, r = RADIUS * 0.6) {
    let g = baselineY(fall, x, z, hx, hz);
    for (const s of solidsAt(x, z)) if (over(s, x, z, r)) {
      const top = topAt(s, clamp(x, s.min.x, s.max.x), clamp(z, s.min.z, s.max.z)); if (top <= y + STEP && top > g) g = top;
    }
    return g;
  }
  // bloqueia se o corpo cruza uma caixa OU se o degrau/rampa levaria a cabeça pra dentro de uma viga, verga de porta ou laje
  function collides(x, y, z, height = HEIGHT) {
    if (overlapping(x, y, z, 0, height)) return true;
    const g = groundAt(x, z, y, RADIUS); return g > y + 1e-4 && !!overlapping(x, g, z, 0, height);
  }
  function ceilingAt(x, z, headY, r = RADIUS * 0.9) {
    let c = Infinity;
    for (const s of solidsAt(x, z)) if (over(s, x, z, r) && s.min.y >= headY - 0.25 && s.min.y < c) c = s.min.y;
    return c;
  }
  // tira o corpo de dentro de uma caixa (sobreposição por arredondamento, empurrão, queda na quina…): menor empurrão
  // horizontal (ou pra baixo, se a cabeça entrou numa viga e há espaço) que deixa o corpo livre. Até 3 caixas por vez.
  const EPS = 1e-3;
  function depenetrate(e) {
    const height = stanceHeight(e);
    for (let it = 0; it < 3; it++) {
      const s = overlapping(e.pos.x, e.pos.y, e.pos.z, 0, height); if (!s) return true;
      const { x, y, z } = e.pos, top = topAt(s, clamp(x, s.min.x, s.max.x), clamp(z, s.min.z, s.max.z)), c = [
        [s.min.x - RADIUS - EPS - x, 0, 0], [s.max.x + RADIUS + EPS - x, 0, 0],
        [0, 0, s.min.z - RADIUS - EPS - z], [0, 0, s.max.z + RADIUS + EPS - z],
      ].filter((d) => Math.abs(d[0]) + Math.abs(d[2]) <= RADIUS + 0.06); // só empurrão curto: nunca atravessa parede
      if (top - y <= 1) c.push([0, top - y + EPS, 0]); // afundou pouco num degrau/rampa/caixa: sobe nela
      if (s.min.y > y + STEP && y - (s.min.y - height - EPS) <= 0.5) c.push([0, s.min.y - height - EPS - y, 0]); // cabeça na viga: desce
      c.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) + Math.abs(a[2]) - Math.abs(b[0]) - Math.abs(b[1]) - Math.abs(b[2]));
      let ok = false;
      for (const [dx, dy, dz] of c) {
        const nx = x + dx, nz = z + dz; let ny = y + dy;
        if (Math.abs(nx) > hx - RADIUS || Math.abs(nz) > hz - RADIUS) continue;
        const g = groundAt(nx, nz, ny, RADIUS); if (g > ny) ny = g; // degrau/rampa no lugar novo: sobe nele (groundAt só acha até STEP acima)
        if (ny < groundAt(nx, nz, ny, RADIUS) - 1e-4) continue;
        const o = overlapping(nx, ny, nz, 0, height); if (o === s) continue;
        e.pos.x = nx; e.pos.y = ny; e.pos.z = nz; ok = true; if (!o) return true; break; // saiu desta caixa; se caiu em outra, tenta de novo
      }
      if (!ok) return false;
    }
    return !overlapping(e.pos.x, e.pos.y, e.pos.z, 0, height);
  }
  // Movimento (mesmo código no cliente e no servidor): eixo a eixo (x, depois z) = desliza em paredes e quinas;
  // sub-passos ≤ 0,25 m (empurrões fortes não atravessam parede fina); se já estiver dentro de algo, sai primeiro.
  function moveEntity(e, dt) {
    const height = stanceHeight(e);
    let blocked = false;
    const free = depenetrate(e);
    const dx = e.vel.x * dt, dz = e.vel.z * dt, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.25));
    for (let i = 0; i < n; i++) {
      const nx = e.pos.x + dx / n; if (!free || !collides(nx, e.pos.y, e.pos.z, height)) e.pos.x = nx; else { blocked = true; e.vel.x = 0; }
      const nz = e.pos.z + dz / n; if (!free || !collides(e.pos.x, e.pos.y, nz, height)) e.pos.z = nz; else { blocked = true; e.vel.z = 0; }
      if (blocked) break;
    }
    e.vel.y += GRAV * dt; let ny = e.pos.y + e.vel.y * dt;
    if (e.vel.y > 0) { const c = ceilingAt(e.pos.x, e.pos.z, e.pos.y + height, RADIUS); if (ny + height > c) { ny = Math.max(e.pos.y, c - height); e.vel.y = 0; e.bonk = true; } }
    const g = groundAt(e.pos.x, e.pos.z, e.pos.y, RADIUS);
    if (ny <= g) { e.pos.y = g; e.vel.y = 0; e.onGround = true; }
    else if (e.onGround && e.vel.y <= 0 && ny - g < STEP) { e.pos.y = g; e.vel.y = 0; }
    else { e.pos.y = ny; e.onGround = false; }
    e.pos.x = clamp(e.pos.x, -hx + RADIUS, hx - RADIUS); e.pos.z = clamp(e.pos.z, -hz + RADIUS, hz - RADIUS);
    return blocked;
  }
  // raio contra o mundo: chão (y=0) + caixas; rampas são cunhas (resolve a interseção com o plano inclinado)
  function rayWorld(o, d, far) {
    let best = far, hit = false;
    if (d.y < -1e-6) for (const fy of [0, FALL_FLOOR]) {
      const t = (fy - o.y) / d.y; if (t <= 0 || t >= best) continue;
      if (baselineY(fall, o.x + d.x * t, o.z + d.z * t, hx, hz) === fy) { best = t; hit = true; }
    }
    // percorre as células da grade ao longo do raio (passos de meia célula) coletando caixas candidatas
    const seen = new Set(); const n = Math.ceil(far / (GRID * 0.5)) + 1;
    for (let i = 0; i <= n; i++) {
      const t = Math.min(far, i * GRID * 0.5); if (t > best + GRID) break;
      for (const s of solidsAt(o.x + d.x * t, o.z + d.z * t)) {
        if (seen.has(s)) continue; seen.add(s);
        const r = rayBox(o, d, s); if (r !== null && r < best) { best = r; hit = true; }
      }
    }
    for (const s of movers) { const r = rayBox(o, d, s); if (r !== null && r < best) { best = r; hit = true; } }
    return hit ? best : null;
  }
  function rayBox(o, d, s) {
    let t0 = 0, t1 = Infinity;
    for (const ax of ['x', 'y', 'z']) {
      if (Math.abs(d[ax]) < 1e-9) { if (o[ax] < s.min[ax] || o[ax] > s.max[ax]) return null; continue; }
      let a = (s.min[ax] - o[ax]) / d[ax], b = (s.max[ax] - o[ax]) / d[ax]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null;
    }
    if (!s.ramp) return t0;
    const f = (t) => (o.y + d.y * t) - topAt(s, o.x + d.x * t, o.z + d.z * t); // >0 acima da cunha
    const f0 = f(t0), f1 = f(t1);
    if (f0 <= 1e-4) return t0; if (f1 > 0) return null;
    return t0 + (f0 / (f0 - f1)) * (t1 - t0);
  }
  // igual ao rayWorld, mas devolve a caixa atingida (penetração de parede). { t, s } ou null; s = null é o chão
  function rayWorldS(o, d, far) {
    let best = far, hs = null, hit = false;
    if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) { best = t; hit = true; hs = null; } }
    const seen = new Set(); const steps = Math.ceil(far / (GRID * 0.5)) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(far, i * GRID * 0.5); if (t > best + GRID) break;
      for (const s of solidsAt(o.x + d.x * t, o.z + d.z * t)) { if (seen.has(s)) continue; seen.add(s); const r = rayBox(o, d, s); if (r !== null && r < best) { best = r; hit = true; hs = s; } }
    }
    for (const s of movers) { const r = rayBox(o, d, s); if (r !== null && r < best) { best = r; hit = true; hs = s; } }
    return hit ? { t: best, s: hs } : null;
  }
  // igual ao rayWorld, mas devolve também a normal da superfície atingida (disco quica nela). { t, n } ou null
  function rayWorldN(o, d, far) {
    let best = far, n = null;
    if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) { best = t; n = { x: 0, y: 1, z: 0 }; } }
    const seen = new Set(); const steps = Math.ceil(far / (GRID * 0.5)) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(far, i * GRID * 0.5); if (t > best + GRID) break;
      for (const s of solidsAt(o.x + d.x * t, o.z + d.z * t)) {
        if (seen.has(s)) continue; seen.add(s);
        const r = rayBox(o, d, s); if (r === null || r >= best) continue;
        best = r; n = boxNormal(o, d, s, r);
      }
    }
    for (const s of movers) { const r = rayBox(o, d, s); if (r === null || r >= best) continue; best = r; n = boxNormal(o, d, s, r); }
    return n ? { t: best, n } : null;
  }
  function boxNormal(o, d, s, t) {
    const p = { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
    if (s.ramp) { // cunha: normal do plano de cima (diferença finita no topAt)
      const top = topAt(s, p.x, p.z);
      if (Math.abs(p.y - top) < 0.08) { const e = 0.05, gx = (topAt(s, p.x + e, p.z) - topAt(s, p.x - e, p.z)) / (2 * e), gz = (topAt(s, p.x, p.z + e) - topAt(s, p.x, p.z - e)) / (2 * e), L = Math.hypot(gx, 1, gz); return { x: -gx / L, y: 1 / L, z: -gz / L }; }
    }
    // face de entrada: o eixo cujo plano está mais perto do ponto
    let ax = 'x', bestD = Infinity, sign = 1;
    for (const k of ['x', 'y', 'z']) for (const [v, sg] of [[s.min[k], -1], [s.max[k], 1]]) { const dd = Math.abs(p[k] - v); if (dd < bestD && d[k] * sg < 0) { bestD = dd; ax = k; sign = sg; } }
    return { x: ax === 'x' ? sign : 0, y: ax === 'y' ? sign : 0, z: ax === 'z' ? sign : 0 };
  }
  const losClear = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz); if (L < 1e-6) return true; return rayWorld(a, { x: dx / L, y: dy / L, z: dz / L }, L - 0.3) === null; };
  function nadeBlocked(x, y, z) {
    for (const sd of solidsAt(x, z)) if (x > sd.min.x - NADE.r && x < sd.max.x + NADE.r && z > sd.min.z - NADE.r && z < sd.max.z + NADE.r && y > sd.min.y - NADE.r) {
      const top = topAt(sd, clamp(x, sd.min.x, sd.max.x), clamp(z, sd.min.z, sd.max.z)); if (y < top - 0.05) return true;
    }
    return false;
  }
  function stepNade(pos, vel, dt, onBounce) {
    vel.y += NADE.grav * dt;
    const nx = pos.x + vel.x * dt; if (nadeBlocked(nx, pos.y, pos.z)) { vel.x *= -0.45; onBounce?.(); } else pos.x = nx;
    const nz = pos.z + vel.z * dt; if (nadeBlocked(pos.x, pos.y, nz)) { vel.z *= -0.45; onBounce?.(); } else pos.z = nz;
    if (vel.y > 0 && nadeBlocked(pos.x, pos.y + vel.y * dt + NADE.r, pos.z)) { vel.y = -vel.y * 0.35; onBounce?.(); }
    const ny = pos.y + vel.y * dt; const g = groundAt(pos.x, pos.z, pos.y - NADE.r + 0.3) + NADE.r;
    if (ny <= g) { pos.y = g; if (Math.abs(vel.y) > 1.5) onBounce?.(); vel.y = Math.abs(vel.y) > 1.2 ? -vel.y * 0.42 : 0; vel.x *= 0.72; vel.z *= 0.72; return true; }
    pos.y = ny; return false;
  }
  // Mesmo passo na preview, no cliente (qualquer FPS) e no servidor (20 Hz).
  function advanceNade(n, dt, onBounce) {
    const age = n.physicsTime || 0;
    dt = Math.min(dt, Math.max(0, (n.poke ? POKE.fuse : NADE.fuse) - age));
    n.physicsTime = age + dt;
    n.physicsLeft = (n.physicsLeft || 0) + dt;
    while (n.physicsLeft + 1e-9 >= NADE.step) {
      stepNade(n.pos, n.vel, NADE.step, onBounce);
      n.physicsLeft = Math.max(0, n.physicsLeft - NADE.step);
    }
  }
  return { solids, solidsAt, topAt, collides, overlapping, depenetrate, groundAt, ceilingAt, moveEntity, rayWorld, rayWorldN, rayWorldS, losClear, nadeBlocked, stepNade, advanceNade, setMovers };
}

export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return -1; const sq = Math.sqrt(h); let t = -b - sq; if (t < 0) t = -b + sq; return t;
}
// esferas de acerto do Docão (iguais ao cliente): cabeça e corpo, relativas aos pés
export const HITBOXES = [[1.5, 0.5, true], [0.8, 0.58, false]];

// O mesmo achatamento vertical da animação: elipsoides, sem estreitar o corpo.
export function rayHitboxes(o, d, pos, crouch = 0) {
  const scale = stanceScale(crouch);
  const origin = { x: o.x, y: pos.y + (o.y - pos.y) / scale, z: o.z };
  const length = Math.hypot(d.x, d.y / scale, d.z);
  if (length < 1e-9) return null;
  const dir = { x: d.x / length, y: d.y / scale / length, z: d.z / length };
  let best = null;
  for (const [y, r, head] of HITBOXES) {
    const t = raySphere(origin, dir, { x: pos.x, y: pos.y + y, z: pos.z }, r) / length;
    if (t > 0 && (!best || t < best.t)) best = { t, head };
  }
  return best;
}

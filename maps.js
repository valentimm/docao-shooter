// ============================================================
//  MAPAS DO DOCÃO SHOOTER: só dados (geometria original).
//  Cada mapa: id, name (pt-BR), desc, size [meia-largura X, meia-profundidade Z], wallH (muro do limite),
//  palette (céu/neblina/luz/chão), boxes (caixas/rampas), props (objetos decorativos/cobertura),
//  spawns [[x, z, y]], pickups [[tipo, x, z, y]] (health | ammo | grenade), waypoints extras [[x, y, z]],
//  showcase [x, y, z] (onde o Docão fica no menu), view [x, y, z, yaw, pitch] (câmera de screenshot),
//  test (pontos usados pelo teste automático de escadas/andares).
//  O grafo de navegação dos bots é gerado automaticamente a partir da geometria (nav.js) + waypoints extras.
// ============================================================

// ---------- mini kit de montagem ----------
// caixa: B(x0, z0, x1, z1, altura, cor, y0)
export const B = (x0, z0, x1, z1, h, c, y0 = 0) => ({ b: [Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y0 + h, Math.max(z0, z1)], c });
// rampa (cunha): sobe de y0 a y1 ao longo do eixo 'x' ou 'z' no sentido dir (+1 / -1)
export const R = (x0, z0, x1, z1, y0, y1, axis, dir, c) => ({ b: [Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1)], c, ramp: { axis, dir } });
export const door = (a, b, h = 2.8) => ({ a, b, y0: 0, y1: h });
export const win = (a, b, lo = 1.0, hi = 2.2) => ({ a, b, y0: lo, y1: hi });
// parede ao longo de X (na linha z) / ao longo de Z (na linha x), com aberturas (portas/janelas)
function wallAlong(axis, s0, s1, line, t, h, c, openings = [], y0 = 0) {
  const out = []; let cur = s0;
  const box = (a, b, ya, yb) => {
    if (b - a < 0.01 || yb - ya < 0.01) return;
    out.push(axis === 'x' ? { b: [a, y0 + ya, line - t / 2, b, y0 + yb, line + t / 2], c } : { b: [line - t / 2, y0 + ya, a, line + t / 2, y0 + yb, b], c });
  };
  for (const o of [...openings].sort((p, q) => p.a - q.a)) {
    box(cur, o.a, 0, h); if (o.y0 > 0) box(o.a, o.b, 0, o.y0); if (o.y1 < h) box(o.a, o.b, o.y1, h); cur = o.b;
  }
  box(cur, s1, 0, h); return out;
}
export const wallX = (x0, x1, z, t, h, c, op, y0) => wallAlong('x', x0, x1, z, t, h, c, op, y0);
export const wallZ = (z0, z1, x, t, h, c, op, y0) => wallAlong('z', z0, z1, x, t, h, c, op, y0);
// transformações de grupos de caixas (para espelhar bases/casas)
export function rot180(list, cx, cz) {
  return list.map((o) => { if (o.wp) return { wp: [2 * cx - o.wp[0], o.wp[1], 2 * cz - o.wp[2]] }; const [x0, y0, z0, x1, y1, z1] = o.b; return { ...o, b: [2 * cx - x1, y0, 2 * cz - z1, 2 * cx - x0, y1, 2 * cz - z0], ramp: o.ramp ? { ...o.ramp, dir: -o.ramp.dir } : undefined }; });
}
export function mirrorZ(list) {
  return list.map((o) => { if (o.wp) return { wp: [o.wp[0], o.wp[1], -o.wp[2]] }; const [x0, y0, z0, x1, y1, z1] = o.b; return { ...o, b: [x0, y0, -z1, x1, y1, -z0], ramp: o.ramp ? { ...o.ramp, dir: o.ramp.axis === 'z' ? -o.ramp.dir : o.ramp.dir } : undefined }; });
}
// gira 90° no sentido horário visto de cima: a fachada que olhava pro sul (−z) passa a olhar pro leste (+x)
function yawBoxes(list) {
  return list.map((o) => {
    if (o.wp) return { wp: [-o.wp[2], o.wp[1], o.wp[0]] };
    const [x0, y0, z0, x1, y1, z1] = o.b;
    const ramp = o.ramp ? (o.ramp.axis === 'x' ? { axis: 'z', dir: o.ramp.dir } : { axis: 'x', dir: -o.ramp.dir }) : undefined;
    return { ...o, b: [Math.min(-z0, -z1), y0, Math.min(x0, x1), Math.max(-z0, -z1), y1, Math.max(x0, x1)], ramp };
  });
}
function moveBoxes(list, dx, dz) {
  return list.map((o) => o.wp ? { wp: [o.wp[0] + dx, o.wp[1], o.wp[2] + dz] } : { ...o, b: [o.b[0] + dx, o.b[1], o.b[2] + dz, o.b[3] + dx, o.b[4], o.b[5] + dz] });
}
const yawXZ = (x, z) => [-z, x];
// casa de 2 andares (frente pro +z), escada interna junto da parede de trás, laje do 2º andar com vão da escada
export function house(x0, z0, x1, z1, col) {
  const t = 0.6, H1 = 3.2, cx = (x0 + x1) / 2, out = [];
  const { wall, floor, roof, stair, trim } = col;
  out.push(...wallX(x0, x1, z0 + t / 2, t, H1, wall, [win(x1 - 3.4, x1 - 1.4)]));
  out.push(...wallX(x0, x1, z1 - t / 2, t, H1, wall, [win(x0 + 1.6, x0 + 4.2), door(cx - 1.3, cx + 1.3, 2.6), win(x1 - 4.2, x1 - 1.6)]));
  out.push(...wallZ(z0 + t, z1 - t, x0 + t / 2, t, H1, wall, [win(z0 + 4.6, z0 + 7.0)]));
  out.push(...wallZ(z0 + t, z1 - t, x1 - t / 2, t, H1, wall, [door(z0 + 5.2, z0 + 7.4, 2.6)]));
  const rs = x0 + 1.0, re = rs + 9.6, s0 = z0 + t, s1 = s0 + 2.8;
  out.push(R(rs, s0, re, s1, 0, 3.5, 'x', 1, stair));
  out.push(B(x0, s1, x1, z1, 0.3, floor, 3.2), B(re, z0, x1, s1, 0.3, floor, 3.2), B(x0, z0, rs, s1, 0.3, floor, 3.2));
  const U = 3.5, H2 = 2.6;
  out.push(...wallX(x0, x1, z0 + t / 2, t, H2, wall, [win(x0 + 2, x0 + 4, 0.9, 2.0), win(x1 - 4, x1 - 2, 0.9, 2.0)], U));
  out.push(...wallX(x0, x1, z1 - t / 2, t, H2, wall, [win(x0 + 1.5, x0 + 5.5, 0.8, 2.0), win(x1 - 5.5, x1 - 1.5, 0.8, 2.0)], U));
  out.push(...wallZ(z0 + t, z1 - t, x0 + t / 2, t, H2, wall, [win(z0 + 3.5, z0 + 6.5, 0.8, 2.0)], U));
  out.push(...wallZ(z0 + t, z1 - t, x1 - t / 2, t, H2, wall, [win(z0 + 3.5, z0 + 6.5, 0.8, 2.0)], U));
  out.push(B(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, 0.35, roof, U + H2));
  out.push(B(x0 - 0.2, z1, x1 + 0.2, z1 + 0.25, 0.25, trim, H1)); // friso entre andares
  return out;
}

// ---------- kit v2: prédios de vários andares ----------
// retângulo menos buracos (para lajes com vão de escada)
export function slab(x0, z0, x1, z1, y, th, c, holes = []) {
  let rects = [[x0, z0, x1, z1]];
  for (const [hx0, hz0, hx1, hz1] of holes) {
    const next = [];
    for (const [a0, b0, a1, b1] of rects) {
      if (hx1 <= a0 || hx0 >= a1 || hz1 <= b0 || hz0 >= b1) { next.push([a0, b0, a1, b1]); continue; }
      const cx0 = Math.max(a0, hx0), cx1 = Math.min(a1, hx1);
      if (hz0 > b0) next.push([a0, b0, a1, hz0]); if (hz1 < b1) next.push([a0, hz1, a1, b1]);
      if (cx0 > a0) next.push([a0, Math.max(b0, hz0), cx0, Math.min(b1, hz1)]); if (cx1 < a1) next.push([cx1, Math.max(b0, hz0), a1, Math.min(b1, hz1)]);
    }
    rects = next;
  }
  return rects.filter(([a0, b0, a1, b1]) => a1 - a0 > 0.05 && b1 - b0 > 0.05).map(([a0, b0, a1, b1]) => B(a0, b0, a1, b1, th, c, y - th));
}
// prédio: x0..x1 × z0..z1, `floors` andares de altura H (piso do andar f em y = f·H, laje de 0,3 por baixo).
//  ops: lista de aberturas { s: 'n'|'s'|'w'|'e' (n = lado z0, s = z1, w = x0, e = x1), a, b (ao longo da parede), f (andar), k: 'door'|'win'|'wide', lo, hi }
//  stairs: [{ f, r: [x0, z0, x1, z1], axis, dir }] rampa do andar f pro f+1 (abre vão na laje de cima)
//  roof: true = laje no topo (y = floors·H) com mureta; roofHoles/roofGaps: vãos na laje/mureta (escada pro telhado)
//  inner: paredes internas [{ axis: 'x'|'z', s0, s1, line, f, ops: [{ a, b, k }] }]
export function building(x0, z0, x1, z1, o) {
  const { col, floors = 2, H = 3.5, t = 0.5, ops = [], stairs = [], roof = true, parapet = 1.0, roofGaps = [], inner = [], noWall = [], floorHoles = {} } = o, out = [];
  const opening = (op, f) => {
    if (op.k === 'win') return win(op.a, op.b, op.lo ?? 1.0, op.hi ?? 2.2);
    if (op.k === 'wide') return { a: op.a, b: op.b, y0: 0, y1: H - 0.3 };
    return door(op.a, op.b, op.hi ?? 2.6);
  };
  const doorWp = (axis, line, a, b, y) => { const c = (a + b) / 2; for (const d of [-1.0, 0, 1.0]) out.push({ wp: axis === 'x' ? [c, y, line + d] : [line + d, y, c] }); };
  for (const q of ops) if (q.k !== 'win') { const y = (q.f ?? 0) * H; if (q.s === 'n') doorWp('x', z0 + t / 2, q.a, q.b, y); if (q.s === 's') doorWp('x', z1 - t / 2, q.a, q.b, y); if (q.s === 'w') doorWp('z', x0 + t / 2, q.a, q.b, y); if (q.s === 'e') doorWp('z', x1 - t / 2, q.a, q.b, y); }
  for (const w of inner) for (const q of w.ops || []) if (q.k !== 'win') doorWp(w.axis, w.line, q.a, q.b, (w.f ?? 0) * H);
  for (let f = 0; f < floors; f++) {
    const y = f * H, h = H, of = (side) => ops.filter((q) => q.s === side && (q.f ?? 0) === f).map((q) => opening(q, f));
    if (!noWall.includes('n' + f)) out.push(...wallX(x0, x1, z0 + t / 2, t, h, col.wall, of('n'), y));
    if (!noWall.includes('s' + f)) out.push(...wallX(x0, x1, z1 - t / 2, t, h, col.wall, of('s'), y));
    if (!noWall.includes('w' + f)) out.push(...wallZ(z0 + t, z1 - t, x0 + t / 2, t, h, col.wall2 || col.wall, of('w'), y));
    if (!noWall.includes('e' + f)) out.push(...wallZ(z0 + t, z1 - t, x1 - t / 2, t, h, col.wall2 || col.wall, of('e'), y));
    if (f > 0) out.push(...slab(x0 + t, z0 + t, x1 - t, z1 - t, y, 0.3, col.floor, [...stairs.filter((st) => st.f === f - 1).map((st) => st.r), ...(floorHoles[f] || [])]));
    if (f > 0 && col.trim) out.push(B(x0 - 0.12, z0 - 0.12, x1 + 0.12, z0 + 0.1, 0.22, col.trim, y - 0.3), B(x0 - 0.12, z1 - 0.1, x1 + 0.12, z1 + 0.12, 0.22, col.trim, y - 0.3));
  }
  for (const w of inner) { const y = (w.f ?? 0) * H, ops2 = (w.ops || []).map((q) => opening(q)); out.push(...(w.axis === 'x' ? wallX(w.s0, w.s1, w.line, 0.3, H - 0.3, col.inner || col.wall, ops2, y) : wallZ(w.s0, w.s1, w.line, 0.3, H - 0.3, col.inner || col.wall, ops2, y))); }
  for (const st of stairs) { const [a0, b0, a1, b1] = st.r; out.push(R(a0, b0, a1, b1, st.f * H, (st.f + 1) * H, st.axis, st.dir, col.stair)); }
  if (roof) {
    const Y = floors * H;
    out.push(...slab(x0, z0, x1, z1, Y, 0.35, col.roof, stairs.filter((st) => st.f === floors - 1).map((st) => st.r)));
    if (parapet > 0) {
      const g = (side) => roofGaps.filter((q) => q.s === side).map((q) => ({ a: q.a, b: q.b, y0: 0, y1: 9 }));
      out.push(...wallX(x0, x1, z0 + 0.15, 0.3, parapet, col.roof2 || col.wall, g('n'), Y), ...wallX(x0, x1, z1 - 0.15, 0.3, parapet, col.roof2 || col.wall, g('s'), Y));
      out.push(...wallZ(z0 + 0.3, z1 - 0.3, x0 + 0.15, 0.3, parapet, col.roof2 || col.wall, g('w'), Y), ...wallZ(z0 + 0.3, z1 - 0.3, x1 - 0.15, 0.3, parapet, col.roof2 || col.wall, g('e'), Y));
    }
  }
  return out;
}
// separa caixas de waypoints (portas viram nós do grafo dos bots)
export const fin = (list) => ({ boxes: list.filter((o) => o.b), waypoints: list.filter((o) => o.wp).map((o) => o.wp) });
// caixote / pilha de caixotes
export const crate = (x, z, s = 1.6, h = 1.6, c = '#9c6b3a', y0 = 0) => B(x - s / 2, z - s / 2, x + s / 2, z + s / 2, h, c, y0);
// sacada: laje externa com guarda-corpo (lado aberto = 'open' fica sem grade, encostado no prédio)
export function balcony(x0, z0, x1, z1, y, c, rail, open) {
  const out = [B(x0, z0, x1, z1, 0.25, c, y - 0.25)], r = 0.15, h = 1.0;
  if (open !== 'n') out.push(B(x0, z0, x1, z0 + r, h, rail, y)); if (open !== 's') out.push(B(x0, z1 - r, x1, z1, h, rail, y));
  if (open !== 'w') out.push(B(x0, z0, x0 + r, z1, h, rail, y)); if (open !== 'e') out.push(B(x1 - r, z0, x1, z1, h, rail, y));
  return out;
}

const DAY = (o) => ({ sky: '#8fd3ff', fog: ['#8fd3ff', 50, 130], hemi: ['#ffffff', '#6a8f4a', 1.6], sun: ['#ffffff', 2.2], clouds: true, ...o });

// =====================================================================
export const MAPS = [];

// ---------- 1) Arena da Fazendinha (3 corredores estilo Shipment/Rust: bases de 2 andares, celeiro no meio, caixa d'água) ----------
{
  const H = 3.5, boxes = [];
  const lado = (c) => { // metade oeste; a leste é a mesma girada 180°
    const o = [];
    o.push(...building(-31, -7, -22, 7, { col: c, floors: 2,
      ops: [{ s: 'e', a: -1, b: 1 }, { s: 'n', a: -27.8, b: -26 }, { s: 's', a: -27.8, b: -26 }, { s: 'e', a: -5, b: -3, k: 'win' }, { s: 'e', a: 3, b: 5, k: 'win' },
        { s: 'e', a: -5, b: -1.5, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: 1.5, b: 5, f: 1, k: 'win', lo: 0.9 }, { s: 'n', a: -30, b: -27, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -30, b: -27, f: 1, k: 'win', lo: 0.9 }],
      stairs: [{ f: 0, r: [-28.7, -6.5, -23.0, -4.6], axis: 'x', dir: 1 }, { f: 1, r: [-28.7, 4.6, -23.0, 6.5], axis: 'x', dir: 1 }],
      inner: [{ axis: 'x', s0: -30.5, s1: -22.5, line: 1.8, ops: [{ a: -25.2, b: -23.4 }] }] }));
    o.push(crate(-29.5, 0.5, 1.4, 1.0, '#b5793e'), crate(-29.5, -2.8, 1.2, 1.2, '#f2c94c', 3.5), crate(-26.5, -2, 1.2, 1.0, '#b5793e', 7), crate(-23.6, 3, 1.0, 1.0, '#f2c94c', 7));
    // galpões entre os corredores (telhado pela pilha de feno)
    for (const zc of [-11, 11]) {
      o.push(...building(-18, zc - 3, -11, zc + 3, { col: { wall: '#b5793e', wall2: '#a0682f', floor: '#c8a27a', roof: '#8b5a2b', roof2: '#6b4423' }, floors: 1, H: 3.2,
        ops: [{ s: 'w', a: zc - 1, b: zc + 0.8 }, { s: 'e', a: zc - 0.8, b: zc + 1 }, { s: zc < 0 ? 's' : 'n', a: -16.5, b: -14, k: 'win' }], roofGaps: [{ s: zc < 0 ? 'n' : 's', a: -14.5, b: -12 }] }));
      const zr = zc < 0 ? zc - 3 : zc + 3, d = zc < 0 ? -1 : 1;
      o.push(R(-14.4, Math.min(zr, zr + d * 5), -12.1, Math.max(zr, zr + d * 5), 0, 3.2, 'z', -d, '#e8c25a'));
    }
    // corredor norte: muretas de pedra e fardos | campo: cercas e caixotes
    o.push(B(-21, -20.6, -16, -19.8, 1.2, '#a8a29a'), B(-12, -24.6, -8, -23.8, 1.2, '#a8a29a'), B(-26, -16, -24.6, -14.2, 1.4, '#f2c94c'), B(-9, -18.8, -7, -16.6, 1.4, '#f2c94c'));
    o.push(B(-29, -22, -27, -20, 1.5, '#b5793e'), B(-25, 22.2, -21, 23.0, 1.1, '#b5793e'), B(-14, 19.6, -10, 20.4, 1.1, '#b5793e'), crate(-27, 18, 1.6, 1.6), crate(-18, 25, 1.4, 1.2, '#f2c94c'));
    o.push(crate(-19, -3.5, 1.6, 1.6), crate(-19, 3.5, 1.6, 1.6), B(-14.5, -0.8, -13.7, 2.8, 1.3, '#b5793e'), crate(-9.5, 6.5, 1.4, 1.2, '#f2c94c'), crate(-9.5, -7.5, 1.4, 1.2, '#f2c94c'));
    return o;
  };
  boxes.push(...lado({ wall: '#f28fb0', wall2: '#e87fa0', inner: '#f7b3c9', floor: '#c8a27a', roof: '#c0392b', roof2: '#a93226', stair: '#b5793e', trim: '#ffffff' }));
  boxes.push(...rot180(lado({ wall: '#4fb3c9', wall2: '#45a2b6', inner: '#7fd3e3', floor: '#c8a27a', roof: '#1d5f8a', roof2: '#174f74', stair: '#b5793e', trim: '#ffffff' }), 0, 0));
  // celeiro do meio: portões largos (corredor do meio passa por dentro), jirau com janelas pros dois lados
  boxes.push(...building(-7, -6, 7, 6, { col: { wall: '#9b7bd6', wall2: '#8a6bc6', floor: '#c8a27a', roof: '#6b4fa8', stair: '#b59be6', trim: '#ffffff' }, floors: 2, roof: true, parapet: 0,
    ops: [{ s: 'w', a: -2, b: 2, k: 'wide' }, { s: 'e', a: -2, b: 2, k: 'wide' }, { s: 'n', a: -1, b: 1 }, { s: 's', a: -1, b: 1 },
      ...['n', 's'].flatMap((q) => [{ s: q, a: -6, b: -3, f: 1, k: 'win', lo: 0.9 }, { s: q, a: 3, b: 6, f: 1, k: 'win', lo: 0.9 }]), ...['w', 'e'].map((q) => ({ s: q, a: -2.5, b: 2.5, f: 1, k: 'win', lo: 0.9 }))],
    stairs: [{ f: 0, r: [-5.2, -5.5, 0.8, -3.7], axis: 'x', dir: 1 }, { f: 0, r: [-0.8, 3.7, 5.2, 5.5], axis: 'x', dir: -1 }] }));
  boxes.push(B(-4, 1.5, -2.2, 3, 1.2, '#f2c94c'), B(2.2, -3, 4, -1.5, 1.2, '#f2c94c'), B(-1, -1, 1, 1, 1.2, '#f2c94c', 3.5));
  boxes.push(B(-2.2, -12.6, 2.2, -11.8, 1.3, '#a8a29a'), crate(-5.5, -14.5, 1.4, 1.2), crate(6.5, -9.5, 1.4, 1.4, '#f2c94c'), crate(-6.5, 9.5, 1.4, 1.4, '#f2c94c'), B(-2.2, 11.8, 2.2, 12.6, 1.3, '#a8a29a'));
  // galinheiro (túnel no corredor norte)
  boxes.push(...building(-5, -23, 5, -17, { col: { wall: '#f7f1e3', wall2: '#e8e0cc', floor: '#c8a27a', roof: '#e63946', roof2: '#c0303c' }, floors: 1, H: 2.9,
    ops: [{ s: 'w', a: -21, b: -19 }, { s: 'e', a: -21, b: -19 }, { s: 's', a: -3.5, b: -1.5, k: 'win' }, { s: 's', a: 1.5, b: 3.5, k: 'win' }, { s: 'n', a: -1, b: 1, k: 'win' }], parapet: 0 }));
  // caixa d'água (plataforma alta no corredor sul; dá pra passar por baixo — linha longa do Sniper)
  for (const [x, z] of [[-2.9, 16.1], [2.4, 16.1], [-2.9, 21.4], [2.4, 21.4]]) boxes.push(B(x, z, x + 0.5, z + 0.5, 4.0, '#8b5a2b'));
  boxes.push(B(-3, 16, 3, 22, 0.4, '#a0682f', 4.0), B(-1.5, 17.6, 1.5, 20.4, 2.6, '#bdc3c7', 4.4), R(3, 17.6, 9, 20.4, 0, 4.4, 'x', -1, '#b5793e'), { wp: [-2.3, 4.4, 19] }, { wp: [-2.3, 4.4, 17] }, { wp: [-2.3, 4.4, 21] });
  boxes.push(B(-3, 16, 3, 16.2, 1.0, '#8b5a2b', 4.4), B(-3, 21.8, 3, 22, 1.0, '#8b5a2b', 4.4));
  for (const sx of [-3.5, 3.5]) for (const sz of [-27.7, 27.7]) boxes.push(B(sx - 0.2, sz - 0.2, sx + 0.2, sz + 0.2, 2.8, '#8b5a2b', 4));
  MAPS.push({
    id: 'arena', name: 'Arena da Fazendinha', desc: 'Três corredores: bases de dois andares com terraço, celeiro com jirau no meio, galinheiro-túnel ao norte e caixa d\'água ao sul.',
    size: [32, 28], wallH: 4, wallColor: ['#e86a5c', '#d85a4c'],
    palette: DAY({ ground: '#7cc95a', tiles: ['#a9e07f', '#9bd972', 64, 14] }),
    ...fin(boxes), props: [{ t: 'logoSign', x: 0, y: 5.2, z: -27.98, rot: 0 }, { t: 'logoSign', x: 0, y: 5.2, z: 27.98, rot: Math.PI },
      { t: 'hay', x: -19, z: -26.5 }, { t: 'hay', x: 19, z: 26.5 }, { t: 'hay', x: -3, z: 25 }, { t: 'hay', x: 3, z: -25.5 }, { t: 'truck', x: -16, z: 21, c: '#e63946' }, { t: 'truck', x: 16, z: -21, c: '#2f80ed' },
      { t: 'tree', x: -24.5, z: -21.5 }, { t: 'tree', x: 24.5, z: 21.5 }, { t: 'tree', x: -9, z: -26 }, { t: 'tree', x: 9, z: 26 }],
    bomb: { sites: [[21, 0, -17], [22.5, 0, 16.5]], atk: [[-28, 0], [-26.5, -10], [-26.5, 10], [-28, -3, 3.5], [-30, 20], [-30, -20]], def: [[28, 0], [26.5, 10], [26.5, -10], [28, 3, 3.5], [30, -4], [30, 5]] }, // Bomba: Ataque na base oeste, Defesa na leste; A nordeste, B sudeste
    spawns: [[-28, 0], [28, 0], [-26.5, -10], [26.5, 10], [-26.5, 10], [26.5, -10], [-17, -25], [17, 25], [-21, 25], [21, -25], [-28, -3, 3.5], [28, 3, 3.5]],
    pickups: [['health', 0, 0], ['health', -26, 3], ['health', 26, -3], ['health', 0, -20], ['health', 2.4, 19, 4.4],
      ['ammo', 2, -4.5, 3.5], ['ammo', -2, 4.5, 3.5], ['ammo', -14.5, -11], ['ammo', 14.5, 11], ['ammo', -27, 3, 7], ['ammo', 27, -3, 7],
      ['grenade', -14.5, 11], ['grenade', 14.5, -11], ['grenade', -20, 0], ['grenade', 20, 0], ['grenade', -2.3, 19, 4.4]],
    showcase: [0, 0, 9], view: [-20, 0, 1.5, -1.62, 0.0], openMax: 7,
    test: { stairs: { from: [-28.4, 0, -5.5], via: [[-23.5, -5.5]], to: [-23.5, 3.5, -3.6], level: 3.5 }, roof: { from: [-28.4, 3.5, 5.5], via: [[-23.5, 5.5]], to: [-23.5, 7.0, 4.0], level: 7.0 }, under: { from: [-29, 0, -2.5], to: [-23.5, 0, -2.5], ceil: 3.2 } },
  });
}

// ---------- 2) Duas Pocilgas (estilo Dust2: túneis do B, meio com portas, catwalk pro A, longo com portões) ----------
{
  const sand = '#d8b077', wall = '#c99a5b', wall2 = '#b98b4e', cr = '#9c6b3a', cr2 = '#b07a45', boxes = [];
  const casa = { wall: '#e2c18a', wall2: '#d6b47a', inner: '#efd6a8', floor: '#c9a46a', roof: '#a0522d', roof2: '#8b4513', stair: '#9c6b3a', trim: '#fff4e0' };
  const C = (x, z, s = 2, h = 2, c = cr, y0 = 0) => boxes.push(crate(x, z, s, h, c, y0));
  // túneis do B (lado oeste, coberto, com parede no meio em zigue-zague)
  boxes.push(...building(-36, 2, -16, 18, { col: { ...casa, wall: '#b98b4e', wall2: '#a97b40', roof: '#8b6a3e' }, floors: 1, H: 3.4, parapet: 0,
    ops: [{ s: 's', a: -33, b: -30.5 }, { s: 's', a: -22, b: -19.5 }, { s: 'n', a: -33, b: -30 }, { s: 'e', a: 8, b: 10.5 }],
    inner: [{ axis: 'z', s0: 2.5, s1: 17.5, line: -26, ops: [{ a: 4, b: 6 }, { a: 13, b: 15 }] }] }));
  // túnel de baixo: corredor coberto ligando os túneis ao meio
  boxes.push(B(-16, -4, -5, 7.5, 6, wall), B(-16, 11, -5, 22, 6, wall), B(-16, 7.5, -5, 11, 0.4, wall2, 3.4), { wp: [-10, 0, 9.2] }, { wp: [-6, 0, 9.2] }, { wp: [-14, 0, 9.2] });
  // meio: portas do meio, caixote "xbox"
  boxes.push(...wallX(-5, 5, -12, 1, 6, wall2, [door(-1.8, 1.8, 3.4)]), B(-16, -12, -5, -4, 6, wall), C(0, -3, 2, 1.6, cr2), C(-3.5, 14, 1.6, 1.4));
  // casa do meio (2 andares; janelas pro meio e pro longo)
  boxes.push(...building(5, 6, 22, 22, { col: casa, floors: 2,
    ops: [{ s: 'w', a: 13, b: 15 }, { s: 'e', a: 9, b: 11 }, { s: 's', a: 9, b: 11 }, { s: 'w', a: 9, b: 12, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: 15, b: 19, f: 1, k: 'win', lo: 0.9 }, { s: 'n', a: 10, b: 14, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [7, 19, 13.5, 21.5], axis: 'x', dir: 1 }, { f: 1, r: [14, 19, 20.2, 21.5], axis: 'x', dir: 1 }],
    inner: [{ axis: 'z', s0: 6.5, s1: 18.5, line: 15, ops: [{ a: 11.5, b: 13.3 }] }] }));
  boxes.push(C(19.5, 8.5, 1.4, 1.2, cr2, 7), C(8, 8.5, 1.4, 1.2, cr, 7));
  // catwalk / curto: rampa do meio até a passarela alta que desce no A
  boxes.push(B(5, -12, 22, -6, 6, wall), R(5.5, -2, 10, 2, 0, 2.2, 'x', 1, cr2), B(10, -2.5, 19, 2.5, 2.2, wall2), B(10, -2.5, 19, -2.2, 0.9, wall, 2.2), R(19, -2.5, 22.5, 2.5, 0, 2.2, 'x', -1, cr2));
  boxes.push(B(5, 2.5, 10, 6, 2.2, wall2), B(10, 2.5, 22, 3, 2.2, wall));
  // longo: portões e muro
  boxes.push(...wallX(22, 40, 4, 1, 6, wall2, [door(28.5, 31.5, 3.4)]), B(22, 5, 23, 22, 6, wall), C(34, 8, 2, 2), C(37, 15, 2, 1.4, cr2), C(26, 18, 1.6, 1.6), B(36, -8, 40, -4, 1.6, cr));
  // A: plataforma com caixotes, casa do A (2 andares, janela pra plataforma, terraço)
  boxes.push(B(22, -26, 36, -12, 1.2, '#e0c08a'), R(28, -12, 32, -8, 0, 1.2, 'z', -1, '#e0c08a'), R(18.5, -23, 22, -19.5, 0, 1.2, 'x', 1, '#d6b47a'), // degrau da plataforma do A pro lado do CT
   C(26, -18, 2, 2, cr, 1.2), C(31, -22, 2, 1.4, cr2, 1.2), C(33.5, -15, 1.6, 1.6, cr, 1.2), C(24, -14, 1.4, 1.2, cr2, 1.2));
  boxes.push(...building(22, -35, 36, -26, { col: casa, floors: 2,
    ops: [{ s: 'w', a: -31, b: -29 }, { s: 's', a: 25, b: 27, f: 0 }, { s: 's', a: 31, b: 35, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: 23, b: 27, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [29, -34.5, 35, -32.6], axis: 'x', dir: 1 }, { f: 1, r: [23, -34.5, 29, -32.6], axis: 'x', dir: -1 }] }));
  // CT: casa com janela olhando o meio inteiro (linha de Sniper)
  boxes.push(...building(-5, -35, 6, -27, { col: casa, floors: 2,
    ops: [{ s: 'e', a: -32, b: -30 }, { s: 'w', a: -32, b: -30 }, { s: 's', a: -2, b: 2, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-3.2, -34.5, 2.8, -32.6], axis: 'x', dir: 1 }] }));
  boxes.push(C(10, -18, 2, 1.6), C(14, -26, 2, 2, cr2), C(-10, -21, 1.6, 1.4), C(8, -31, 1.4, 1.2));
  // B: janela do B (prédio de 2 andares entre B e CT), caixotes e plataforma
  boxes.push(...building(-17, -31, -7, -16, { col: casa, floors: 2,
    ops: [{ s: 'w', a: -26, b: -24 }, { s: 'e', a: -21, b: -19 }, { s: 'w', a: -21, b: -17.5, f: 1, k: 'win', lo: 0.9 }, { s: 'n', a: -15, b: -11, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -13, b: -10, k: 'win' }],
    stairs: [{ f: 0, r: [-15.2, -30.5, -9.2, -28.6], axis: 'x', dir: 1 }, { f: 1, r: [-15.2, -18.4, -9.2, -16.5], axis: 'x', dir: 1 }] }));
  boxes.push(B(-34, -32, -26, -24, 1.2, '#e0c08a'), R(-26, -32, -23, -28, 0, 1.2, 'x', -1, '#e0c08a'), C(-31, -27, 2, 2, cr, 1.2), C(-28.5, -30.5, 1.6, 1.4, cr2, 1.2), C(-22, -12, 2, 2), C(-30, -14, 2, 1.6, cr2), C(-24, -4, 1.6, 1.2), C(-34, -6, 2, 2), C(-20, -24, 1.4, 1.2, cr2), B(-39, -14.4, -34, -13.6, 1.3, wall2), C(-27, -7, 1.6, 1.4, cr2), C(-19, -3, 2, 2), C(-36, 0, 1.6, 1.2), B(-30, -21, -29.2, -17, 1.3, wall2));
  // base do T: caixotes e muretas
  boxes.push(C(-26, 25, 2, 1.6), C(-12, 28, 1.6, 1.4, cr2), C(8, 26, 2, 2), C(18, 31, 1.6, 1.2, cr2), C(30, 26, 2, 1.6), C(-34, 30, 1.6, 1.6), B(-6, 30, 6, 30.8, 1.2, wall2), C(-3, 23, 1.4, 1.2), C(36, 33, 1.4, 1.4), C(-18, 25, 1.6, 1.2), C(25, 24, 1.4, 1.4, cr2), C(13, 31, 1.4, 1.2));
  MAPS.push({
    id: 'duas-pocilgas', name: 'Duas Pocilgas', desc: 'Estilo Dust2: túneis cobertos até o B, meio com portas e linha de Sniper, catwalk alto pro A, longo com portões e casas de dois andares.',
    size: [40, 36], wallH: 6, wallColor: [wall2, wall],
    palette: { sky: '#a9d6f5', fog: ['#ead9b6', 45, 120], hemi: ['#fff4e0', '#a58a5a', 1.5], sun: ['#fff0d0', 2.4], ground: sand, tiles: ['#e2c18a', '#d6b47a', 80, 20], clouds: true },
    ...fin(boxes), props: [{ t: 'sign', x: 0, y: 4.6, z: -11.45, w: 5, h: 1.2, rot: 0, text: 'MEIO', bg: '#7a4a1c', fg: '#ffe7b0' },
      { t: 'sign', x: 30, y: 4.8, z: 4.55, w: 5, h: 1.2, rot: Math.PI, text: 'LONGO', bg: '#7a4a1c', fg: '#ffe7b0' },
      { t: 'sign', x: 39.9, y: 3.2, z: -18, w: 4, h: 2, rot: -Math.PI / 2, text: 'A', bg: '#e63946', fg: '#fff' },
      { t: 'sign', x: -39.9, y: 3.2, z: -20, w: 4, h: 2, rot: Math.PI / 2, text: 'B', bg: '#e63946', fg: '#fff' },
      { t: 'keg', x: -18, z: -34 }, { t: 'keg', x: -16.8, z: -34 }, { t: 'keg', x: 16, z: 33 }],
    bomb: { sites: [[31.5, 1.2, -19.5], [-33.5, 0, -19]], atk: [[-8, 33], [0, 33.5], [8, 33], [-20, 31], [20, 29], [30, 32]], def: [[-3, -24], [6, -24], [14, -31], [-1, -30, 3.5], [-10, -32], [4, -33]] }, // Bomba: Ataque ao sul, Defesa ao norte; A na plataforma leste, B no fim dos túneis
    spawns: [[-8, 33], [0, 33.5], [8, 33], [-20, 31], [20, 29], [30, 32], [-30, 24], [-3, -24], [6, -24], [14, -31], [-22, -34], [18, -20], [-1, -30, 3.5]],
    pickups: [['health', 0, 26], ['health', 0, -22], ['health', 30, 8], ['health', -30, 10], ['health', 12, 14, 3.5],
      ['ammo', 30, -18, 1.2], ['ammo', -26, -18], ['ammo', 0, 3], ['ammo', -20, 14], ['ammo', 15, 0, 2.2], ['ammo', 30, -30, 3.5],
      ['grenade', 0, -18], ['grenade', -12, -24, 3.5], ['grenade', 32, 18], ['grenade', -10, 9.2], ['grenade', 18, 9, 7]],
    showcase: [0, 0, 30], view: [3, 0, 25, 0.1, -0.03], openMax: 7, expMax: 0.3,
    test: { stairs: { from: [7.4, 0, 20.2], to: [13.7, 3.5, 20.2], level: 3.5 }, roof: { from: [14.4, 3.5, 20.2], to: [21, 7.0, 20.2], level: 7.0 }, under: { from: [-34, 0, 16], to: [-28, 0, 16], ceil: 3.2 } },
  });
}

// ---------- 3) Celeiro Industrial (estilo Rust/Office: galpão com mezanino e escritórios, ponte pro pátio de contêineres, telhado) ----------
{
  const metal = '#7f8c8d', cont = ['#2e86c1', '#28b463', '#d68910', '#c0392b', '#7DF9FF'], boxes = [], H = 3.6;
  const col = { wall: '#c0392b', wall2: '#a93226', inner: '#e8d5b0', floor: '#b08a5a', roof: '#5d6d7e', roof2: '#4d5d6e', stair: '#7f8c8d', trim: '#f4f1ea' };
  const K = (x, z, ax, c, y0 = 0) => boxes.push(ax === 'z' ? B(x - 1.2, z - 3, x + 1.2, z + 3, 2.6, c, y0) : B(x - 3, z - 1.2, x + 3, z + 1.2, 2.6, c, y0));
  const C = (x, z, s = 1.6, h = 1.6, c = '#9c6b3a', y0 = 0) => boxes.push(crate(x, z, s, h, c, y0));
  // galpão: térreo alto com vão central, mezanino em volta, escritórios no lado oeste do mezanino
  boxes.push(...building(-22, -16, 14, 16, { col, floors: 2, H, floorHoles: { 1: [[-12, -10, 8.5, 10]] },
    ops: [{ s: 'w', a: -2, b: 2, k: 'wide' }, { s: 'e', a: -2, b: 2, k: 'wide' }, { s: 'n', a: -18, b: -16 }, { s: 'n', a: 6, b: 8 }, { s: 's', a: -18, b: -16 }, { s: 's', a: 8, b: 10 },
      { s: 'e', a: -1, b: 1, f: 1 }, { s: 'n', a: -8, b: -2, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -4, b: 2, f: 1, k: 'win', lo: 0.9 }, { s: 'w', a: -14, b: -9, f: 1, k: 'win', lo: 0.9 }, { s: 'w', a: 8, b: 13, f: 1, k: 'win', lo: 0.9 }, { s: 'w', a: -1, b: 1, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-4, -15.4, 2, -13.4], axis: 'x', dir: 1 }, { f: 0, r: [-2, 13.4, 4, 15.4], axis: 'x', dir: -1 }, { f: 1, r: [5.5, -15.4, 11.5, -13.4], axis: 'x', dir: 1 }],
    inner: [{ axis: 'x', s0: -21.5, s1: -12, line: -5, f: 1, ops: [{ a: -14.8, b: -13 }] }, { axis: 'x', s0: -21.5, s1: -12, line: 5, f: 1, ops: [{ a: -14.8, b: -13 }] }] }));
  // guarda-corpo do vão (com uma passagem pra pular lá de cima)
  boxes.push(B(-12, -10.15, 8.5, -10, 1.0, metal, H), B(-12, 10, -2, 10.15, 1.0, metal, H), B(0.5, 10, 8.5, 10.15, 1.0, metal, H), B(8.5, -10, 8.65, 10, 1.0, metal, H));
  boxes.push(...wallZ(-10, 10, -12.1, 0.2, 1.0, metal, [{ a: -1.5, b: 1.5, y0: 0, y1: 2 }], H));
  // térreo: estantes e empilhadeira (cobertura no vão)
  boxes.push(B(-8, -6, -6.8, 0, 2.6, '#d68910'), B(3, 1, 4.2, 7, 2.6, '#d68910'), B(-10, 4, -6, 5.2, 2.6, '#d68910'), B(1, -7, 6, -5.8, 2.6, '#d68910'), C(-2, 3, 1.6, 1.2), C(5, -2, 1.4, 1.4, '#7DF9FF'));
  boxes.push(C(-19, -12, 1.4, 1.2, '#b08a5a', H), C(-19, 12, 1.4, 1.2, '#b08a5a', H), C(-14, 0, 1.2, 1.0, '#b08a5a', H), C(11, 8, 1.4, 1.2, '#7f8c8d', H), C(-2, -12.5, 1.4, 1.0, '#7f8c8d', H));
  // telhado: casas de máquina e caixas d'água
  boxes.push(B(-18, -6, -14, -2, 2.0, '#95a5a6', 2 * H), B(-6, 4, -2, 8, 1.6, '#95a5a6', 2 * H), B(4, -6, 8, -3, 1.2, '#95a5a6', 2 * H), C(0, 11, 1.6, 1.2, '#95a5a6', 2 * H), C(-14, 12, 1.6, 1.4, '#95a5a6', 2 * H), B(-8, -9, -4, -6.5, 1.5, '#bdc3c7', 2 * H), B(-1, -1, 3, 1.5, 1.5, '#bdc3c7', 2 * H), B(-11, 1, -9, 5, 1.3, '#95a5a6', 2 * H), C(6, 7, 1.6, 1.4, '#95a5a6', 2 * H), C(-20, 4, 1.4, 1.2, '#95a5a6', 2 * H), C(9, -10, 1.4, 1.2, '#95a5a6', 2 * H));
  // ponte do mezanino até a torre de contêineres do pátio leste
  boxes.push(B(14, -1, 20, 1, 0.3, metal, H - 0.3), B(14, -1.15, 20, -1, 1.0, metal, H), B(14, 1, 20, 1.15, 1.0, metal, H), B(20, -3, 26, 3, H, cont[0]), R(26, -1.5, 31, 1.5, 0, H, 'x', -1, metal), B(20, -3, 26, -2.85, 1.0, metal, H));
  // pátio de contêineres (leste): corredores, pilhas com rampa
  K(20, -12, 'z', cont[1]); K(20, 12, 'z', cont[2]); K(30, -20, 'z', cont[3]); K(30, 8, 'z', cont[4]); boxes.push(B(28.8, 5, 31.2, 8, 2.6, cont[0], 2.6)); K(36, -6, 'z', cont[2]); K(36, 34, 'z', cont[1]);
  boxes.push(R(28.8, 11, 31.2, 15.5, 0, 2.6, 'z', -1, metal));
  K(26, -34, 'x', cont[4]); K(18, 34, 'x', cont[3]); K(34, -10 + 22, 'x', cont[1]); K(22, 22, 'z', cont[0]);
  // pátio oeste: guarita de 2 andares, plataforma de carga, silos
  boxes.push(...building(-38, -36, -28, -26, { col: { ...col, wall: '#e8d5b0', wall2: '#d9c49c' }, floors: 2,
    ops: [{ s: 'e', a: -32, b: -30 }, { s: 's', a: -35, b: -33 }, { s: 'e', a: -35, b: -32, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -32, b: -29, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-36.5, -35.5, -30.5, -33.6], axis: 'x', dir: 1 }, { f: 1, r: [-36.5, -28.4, -30.5, -26.5], axis: 'x', dir: 1 }] }));
  boxes.push(B(-30, 2, -22, 12, 1.2, '#95a5a6'), R(-34, 4, -30, 8, 0, 1.2, 'x', 1, metal), C(-27, 6, 1.6, 1.6, '#9c6b3a', 1.2), K(-34, -12, 'z', cont[3]), K(-28, -8 + 30, 'x', cont[2]), C(-36, 0, 1.6, 1.4), C(-26, -20, 1.6, 1.6));
  // norte e sul: docas, caixotes
  K(-12, -26, 'x', cont[1]); K(2, -30, 'x', cont[4]); K(12, -24, 'x', cont[2]); C(-22, -30, 2, 1.6); C(-6, -36, 1.6, 1.2); C(6, -38, 2, 2); C(-16, -22, 1.4, 1.2); C(16, -32, 1.6, 1.6); C(-30, -14, 1.4, 1.2); C(38, 24 - 50, 1.4, 1.4);
  K(-10, 26, 'x', cont[0]); K(4, 30, 'x', cont[3]); C(-20, 34, 2, 1.6); C(10, 22, 1.6, 1.4); C(-4, 37, 1.6, 1.2); C(-14, 20, 1.4, 1.2); C(0, 21, 1.4, 1.4); C(28, 38, 1.4, 1.4);
  MAPS.push({
    id: 'celeiro-industrial', name: 'Celeiro Industrial', desc: 'Estilo Rust/Office: galpão com vão central, mezanino e escritórios, ponte até a torre de contêineres, telhado com casas de máquina e guarita de dois andares.',
    size: [40, 42], wallH: 7, wallColor: ['#8e9ea0', '#7f8c8d'],
    palette: { sky: '#b9d3e8', fog: ['#c8d4dc', 45, 130], hemi: ['#ffffff', '#7a7f70', 1.7], sun: ['#fff6e6', 2.0], ground: '#8f9a8a', tiles: ['#a3aaa0', '#9aa198', 84, 14], clouds: true },
    ...fin(boxes), props: [{ t: 'silo', x: -28, z: 30, r: 4, h: 11, c: '#bdc3c7' }, { t: 'silo', x: 28, z: 25, r: 3.5, h: 12, c: '#d0d3d4' }, { t: 'silo', x: 34, z: -30, r: 3, h: 9, c: '#bdc3c7' },
      { t: 'truck', x: 14, z: 38, c: '#e63946' }, { t: 'truck', x: -6, z: -20, c: '#2f80ed' }, { t: 'sign', x: -4, y: 5.4, z: 16.05, w: 8, h: 2, rot: 0, text: 'CELEIRO C!', bg: '#7a1f17', fg: '#ffe7b0' },
      { t: 'hay', x: -34, z: 38 }, { t: 'hay', x: -36, z: 38 }, { t: 'hay', x: 38, z: 0 }],
    bomb: { sites: [[-17, 0, -33.5], [20.5, 0, -25.5]], atk: [[-12, 38], [8, 33], [24, 38], [-30, 40], [0, 38], [-36, 34]], def: [[-24, -39], [-8, -40], [12, -36], [-34, -30, H], [2, -38], [34, -38]] }, // Bomba: Ataque ao sul, Defesa ao norte
    spawns: [[-12, 38], [8, 33], [24, 38], [-30, 40], [-24, -39], [-8, -40], [12, -36], [24, -26], [37, -20], [-37, 18], [-17, 0, H], [-34, -30, H]],
    pickups: [['health', -2, 0], ['health', -16, -10, H], ['health', 0, 34], ['health', 0, -34], ['health', 30, 9.5, 2.6],
      ['ammo', -16, 10, H], ['ammo', 23, 0, H], ['ammo', -10, 0, 2 * H], ['ammo', -26, 4, 1.2], ['ammo', 34, 0], ['ammo', -34, -32, H],
      ['grenade', 10, 0], ['grenade', 0, -13, H], ['grenade', -30, -20], ['grenade', 30, 30], ['grenade', 26, -26]],
    showcase: [2, 0, 34], view: [3, 0, 13, 0.75, 0.08], openMax: 7,
    test: { stairs: { from: [-3.6, 0, -14.4], to: [3.5, H, -14.4], level: H }, under: { from: [-18, 0, -8], to: [-18, 0, 8], ceil: 3.3 }, roof: { from: [5.8, H, -14.4], to: [12.6, 2 * H, -14.4], level: 2 * H } },
  });
}

// ---------- 4) Mercadão (estilo Mirage: palácio com sacada pro A, apartamentos pro B, sala da janela no fim do meio, conector) ----------
{
  const t1 = '#d9825b', t2 = '#e8a06a', t3 = '#c96f4a', t4 = '#f0c08a', stone = '#e6d3b3', rail = '#8b5a2b', boxes = [], H = 3.5;
  const casa = (w, w2) => ({ wall: w, wall2: w2, inner: t4, floor: '#c9a46a', roof: '#b5523b', roof2: '#9c4532', stair: rail, trim: stone });
  const C = (x, z, s = 1.6, h = 1.6, c = '#9c6b3a', y0 = 0) => boxes.push(crate(x, z, s, h, c, y0));
  // quarteirões maciços que separam os corredores
  boxes.push(B(-28, -12, -12, -4, 7, t1), B(-12, -12, 4, -4, 7, t2), B(-28, 4, 2, 8, 7, t3), B(2, 4, 5, 8.6, 7, t3), B(14, 4, 18, 14, 7, t1), B(-10, -34, 4, -28, 7, t3), B(-20, 26, 0, 34, 7, t2), B(-28, 8, -22, 22, 7, t4));
  // palácio (2 andares): entra pelo T, sai na sacada e desce a rampa pro A
  boxes.push(...building(-26, -34, -10, -20, { col: casa(t2, t1), floors: 2,
    ops: [{ s: 'w', a: -28, b: -26 }, { s: 's', a: -15, b: -13 }, { s: 'e', a: -26, b: -24, f: 1 }, { s: 's', a: -24, b: -20, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: -31, b: -29, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -22, b: -19, k: 'win' }],
    stairs: [{ f: 0, r: [-24.5, -33.5, -18.5, -31.6], axis: 'x', dir: 1 }],
    inner: [{ axis: 'z', s0: -33.5, s1: -20.5, line: -17, ops: [{ a: -25.8, b: -24 }] }, { axis: 'z', s0: -33.5, s1: -20.5, line: -17, f: 1, ops: [{ a: -25.8, b: -24 }] }] }));
  boxes.push(B(-10, -27, -6, -23, 0.25, t4, H - 0.25), B(-10, -27, -6, -26.85, 1.0, rail, H), B(-10, -23.15, -6, -23, 1.0, rail, H), R(-6, -27, -2, -23, 0, H, 'x', -1, stone), { wp: [-8, H, -25] }, { wp: [-4, 1.75, -25] });
  // rampa do A (beco) e o A
  C(-20, -15, 1.4, 1.2); C(-6, -16.5, 1.6, 1.4, '#b07a45');
  boxes.push(B(10, -28, 16, -24, 1.2, stone), R(13, -24, 16, -21, 0, 1.2, 'z', -1, stone), C(12, -27, 1.6, 1.6, '#b07a45', 1.2), C(6, -20, 2, 2), C(20, -30, 1.6, 1.6), C(26, -16, 2, 1.4, '#b07a45'), B(16, -19, 19, -18.2, 1.3, stone));
  boxes.push(...building(22, -26, 30, -20, { col: casa(t4, t2), floors: 1, H: 3.2, ops: [{ s: 'w', a: -24, b: -22 }, { s: 'e', a: -24, b: -22 }, { s: 'n', a: 25, b: 27, k: 'win' }], roofGaps: [{ s: 'n', a: 28, b: 29.8 }] }));
  boxes.push(R(28, -31, 29.8, -26, 0, 3.2, 'z', 1, '#b07a45'));
  // conector (jungle): liga A, meio e a sala da janela
  boxes.push(...building(4, -14, 18, -4, { col: casa(t3, t1), floors: 1, H: 3.4, parapet: 0, ops: [{ s: 'n', a: 8, b: 10 }, { s: 's', a: 6, b: 8 }, { s: 'e', a: -11, b: -9 }, { s: 'n', a: 13, b: 16, k: 'win' }],
    inner: [{ axis: 'z', s0: -13.5, s1: -4.5, line: 11, ops: [{ a: -8, b: -6 }] }] }));
  // sala da janela (2 andares) no fim do meio
  boxes.push(...building(18, -8, 28, 8, { col: casa(t2, t3), floors: 2,
    ops: [{ s: 'n', a: 22, b: 24 }, { s: 's', a: 22, b: 24 }, { s: 'e', a: -1, b: 1 }, { s: 'w', a: -2, b: 2, f: 1, k: 'win', lo: 0.9 }, { s: 'w', a: -6, b: -4, k: 'win' }, { s: 'n', a: 20, b: 22, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: 25, b: 27, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [20, 5.6, 26, 7.5], axis: 'x', dir: -1 }] }));
  C(20.5, -1, 1.2, 1.0, '#9c6b3a', H);
  // meio: caixotes nas laterais (a linha do Sniper fica no centro)
  C(-22, 2.6, 1.6, 1.4); C(-14, -2.6, 1.6, 1.6, '#b07a45'); C(-5, 2.6, 1.6, 1.2); C(3, -2.6, 1.4, 1.4, '#b07a45'); C(10, 2.6, 1.6, 1.6); C(15, -2.6, 1.2, 1.0);
  // apartamentos (2 andares): entra pelo T, corredor de cima, sai na sacada e desce pro B
  boxes.push(...building(-22, 8, -4, 22, { col: casa(t4, t3), floors: 2,
    ops: [{ s: 'w', a: 16, b: 18 }, { s: 'e', a: 18, b: 20 }, { s: 'e', a: 10, b: 12, f: 1 }, { s: 's', a: -18, b: -14, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -10, b: -7, k: 'win' }, { s: 'n', a: -12, b: -8, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-20.5, 8.5, -14.5, 10.4], axis: 'x', dir: 1 }],
    inner: [{ axis: 'x', s0: -21.5, s1: -4.5, line: 14, f: 1, ops: [{ a: -19, b: -17.2 }, { a: -9, b: -7.2 }] }, { axis: 'z', s0: 8.5, s1: 21.5, line: -13, ops: [{ a: 15, b: 17 }] }] }));
  boxes.push(B(-4, 9, 0, 13, 0.25, t4, H - 0.25), B(-4, 9, 0, 9.15, 1.0, rail, H), B(-4, 12.85, 0, 13, 1.0, rail, H), R(0, 9, 4, 13, 0, H, 'x', -1, stone), { wp: [-2, H, 11] }, { wp: [2, 1.75, 11] });
  // mercearia (B curto): do meio até o B
  boxes.push(...building(5, 6, 14, 13, { col: casa(t1, t3), floors: 1, H: 3.3, parapet: 0, ops: [{ s: 'n', a: 7, b: 9 }, { s: 's', a: 10, b: 12 }, { s: 'w', a: 9, b: 11, k: 'win' }] }));
  boxes.push(B(-24, 22, -22, 26, 7, t1)); // fecha o canto do beco
  // B: fonte, bancada e caixotes
  boxes.push(...wallX(14, 18, 18, 0.4, 0.9, stone), ...wallX(14, 18, 22, 0.4, 0.9, stone), ...wallZ(18, 22, 14, 0.4, 0.9, stone), ...wallZ(18, 22, 18, 0.4, 0.9, stone));
  boxes.push(B(20, 26, 28, 31, 1.2, stone), R(16.5, 27, 20, 30, 0, 1.2, 'x', 1, stone), C(25, 28.5, 1.6, 1.6, '#b07a45', 1.2), C(8, 20, 2, 2), C(10, 30, 1.6, 1.4), C(24, 16, 1.6, 1.6, '#b07a45'), C(2, 28, 1.6, 1.2), C(-6, 24, 1.4, 1.2));
  // bases: T a oeste, CT a leste
  C(-34, -12, 2, 1.6); C(-32, 12, 2, 1.6, '#b07a45'); C(-35, 26, 1.6, 1.4); C(-34, -26, 1.6, 1.4); C(-30, 0, 1.4, 1.2); C(-36, 3, 1.4, 1.4);
  C(33, -12, 2, 1.6); C(32, 14, 2, 1.6, '#b07a45'); C(34, 26, 1.6, 1.4); C(34, -28, 1.6, 1.4); C(31, 3, 1.4, 1.2); C(36, -3, 1.4, 1.4);
  MAPS.push({
    id: 'mercadao', name: 'Mercadão', desc: 'Estilo Mirage: palácio com sacada sobre a rampa do A, apartamentos de dois andares até o B, conector, mercearia e a sala da janela olhando o meio.',
    size: [38, 34], wallH: 7, wallColor: [t1, t3],
    palette: { sky: '#9fd0f0', fog: ['#f2d6b0', 45, 115], hemi: ['#fff1dc', '#b07a4a', 1.6], sun: ['#ffe2b8', 2.3], ground: '#e3c9a0', tiles: ['#e8cfa6', '#dcc094', 76, 38], clouds: true },
    ...fin(boxes), props: [...[[0, -17, '#e63946'], [14, -32, '#7DF9FF'], [-33, -18, '#f2c94c'], [30, 20, '#e63946'], [-12, 30 - 6, '#7DF9FF'], [36, -16, '#f2c94c']].map(([x, z, c]) => ({ t: 'stall', x, z, c })),
      { t: 'water', x: 16, z: 20, r: 1.5, y: 0.6 }, { t: 'jar', x: -13, z: -15 }, { t: 'jar', x: 13, z: 17 }, { t: 'jar', x: -27.5, z: 30 },
      { t: 'awning', x0: 26, z0: -12, x1: 29, z1: -10, y: 3, c: '#e63946' },
      { t: 'sign', x: -20, y: 5, z: -12.05, w: 5, h: 1.1, rot: Math.PI, text: 'MERCADÃO', bg: '#8b2f1c', fg: '#ffe7b0' },
      { t: 'sign', x: -12, y: 5, z: 8.05, w: 5, h: 1.1, rot: 0, text: 'FEIRA C!', bg: '#8b2f1c', fg: '#ffe7b0' }],
    bomb: { sites: [[13, 0, -19.5], [21, 0, 21]], atk: [[-34, -5], [-34, 7], [-33, -21], [-34, 19], [-30, 30], [-30, -30]], def: [[34, -20], [34, 0], [34, 20], [30, 31], [30, -31], [23, 0, H]] }, // Bomba: Ataque no T (oeste), Defesa no CT (leste); A perto da rampa, B na fonte
    spawns: [[-34, -5], [-34, 7], [-33, -21], [-34, 19], [-30, 30], [-30, -30], [34, -20], [34, 0], [34, 20], [30, 31], [30, -31], [23, 0, H]],
    pickups: [['health', -30, 4], ['health', 30, -4], ['health', -14, -27, H], ['health', -14, 18, H], ['health', 16, 24],
      ['ammo', 0, 0], ['ammo', 14.4, -25.2, 1.2], ['ammo', 22, 28.5, 1.2], ['ammo', 8, -9], ['ammo', 8, 9.5], ['ammo', 25, 4, H],
      ['grenade', -20, -17], ['grenade', -8, -25, H], ['grenade', -8.5, 23.5], ['grenade', 26, -23], ['grenade', -2, 11, H]],
    showcase: [0, 0, 28], view: [-30, 0, 0, -1.57, 0.0], openMax: 7,
    test: { stairs: { from: [-20.2, 0, 9.4], to: [-13.8, H, 9.4], level: H }, under: { from: [-20, 0, 17], to: [-14, 0, 17], ceil: 3.2 }, roof: { from: [26, 0, 0.5 - 31], via: [[28.9, -30.5]], to: [28.9, 3.2, -23], level: 3.2 } },
  });
}

// ---------- 5) Torres Gêmeas do Barril (mapa de Sniper em 3 corredores: torres, ruínas, planaltos com ponte, casamata) ----------
{
  const red = '#e63946', red2 = '#c0303c', cyan = '#4fd8e8', cyan2 = '#2fb5c9', rock = '#8d8070', earth = '#a58b5f', floor = '#d9c7a0';
  const tower = (wc, wc2) => {
    const o = [];
    o.push(...wallX(-8, 8, 52.4, 0.8, 4, wc, [door(-2, 2, 4)]), ...wallX(-8, 8, 63.6, 0.8, 4, wc, [door(-2, 2, 4)]));
    o.push(...wallZ(52.8, 63.2, -7.6, 0.8, 4, wc2, [door(56, 60, 4)]), ...wallZ(52.8, 63.2, 7.6, 0.8, 4, wc2, [door(56, 60, 4)]));
    o.push(B(-8, 48, 8, 64, 0.4, floor, 4), B(8, 48, 12, 52, 0.4, floor, 4), R(8, 52, 12, 64, 0, 4.4, 'z', -1, wc2));
    o.push(B(-8, 48, -1.2, 48.4, 0.9, wc, 4.4), B(1.2, 48, 8, 48.4, 0.9, wc, 4.4)); // mureta da varanda
    o.push(B(-8.3, 48, -8, 64, 1.0, wc, 4.4), B(7.6, 52, 8, 64, 1.0, wc, 4.4), B(-8, 63.6, 8, 64, 1.0, wc, 4.4), B(4.6, 60.5, 6.2, 62.1, 1.2, '#8b5a2b', 4.4), B(1.5, 50, 3.1, 51.6, 1.2, '#8b5a2b', 4.4), B(-5, 63.6, 5, 64, 1.0, wc, 8.4), B(-3.6, 56.4, -2.4, 57.6, 1.0, '#8b5a2b', 8.4));
    o.push(R(-8, 50, -5, 62, 4.4, 8.4, 'z', 1, wc2), B(-5, 54, 5, 64, 0.4, floor, 8));
    o.push(B(-5, 54, -0.5, 54.4, 0.9, wc, 8.4), B(0.5, 54, 5, 54.4, 0.9, wc, 8.4), B(4.6, 54, 5, 64, 0.9, wc, 8.4)); // mureta do topo (fresta do sniper)
    o.push(B(-1, -1, 1, 1, 0, wc)); // (marcador)
    return o.filter((b) => b.b[4] > b.b[1]);
  };
  const boxes = [...tower(red, red2), ...mirrorZ(tower(cyan, cyan2))];
  const ruin = { wall: '#b8a98f', wall2: '#a89a80', inner: '#c9bba2', floor: '#9c8a6a', stair: '#8b5a2b', trim: '#d9c7a0' };
  const half = []; // metade norte (z > 0); a sul é espelhada
  // planaltos + ponte (dá pra passar por baixo) e ruínas em cima
  half.push(B(-14, 10, 14, 22, 3, earth), R(-3, 22, 3, 31, 0, 3, 'z', -1, earth), R(14, 12, 22, 18, 0, 3, 'x', -1, earth));
  half.push(B(-11, 13, -7, 13.6, 1.3, rock, 3), B(6, 17, 10, 17.6, 1.3, rock, 3), B(-2, 19, -1.4, 21.5, 1.3, rock, 3), crate(11.5, 12.5, 1.4, 1.2, '#8b5a2b', 3));
  // corredor oeste: casa em ruínas de 2 andares (sem telhado) e trincheira
  half.push(...building(-29, 26, -15, 38, { col: ruin, floors: 2, roof: false,
    ops: [{ s: 'e', a: 30, b: 32 }, { s: 'n', a: -24, b: -21 }, { s: 's', a: -19, b: -17 }, { s: 'e', a: 34, b: 37, k: 'win' }, { s: 'n', a: -28, b: -25, f: 1, k: 'win', lo: 0.6 }, { s: 'e', a: 28, b: 33, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -26, b: -21, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-27.2, 36, -21.2, 37.5], axis: 'x', dir: 1 }], inner: [{ axis: 'x', s0: -28.5, s1: -15.5, line: 31, ops: [{ a: -20, b: -18.2 }] }] }));
  half.push(B(-25, 6, -24.3, 19, 1.3, '#8b7d5a'), B(-19.7, 6, -19, 19, 1.3, '#8b7d5a'), B(-29, 12, -26, 12.7, 1.2, '#8b7d5a'), crate(-22, 22, 1.4, 1.2, '#8b5a2b'));
  // corredor leste: paredões de pedra
  half.push(B(15, 26, 16, 40, 2.6, rock), B(22, 30, 25, 33, 2.2, rock), B(26, 20, 30, 21, 2.6, rock), B(18, 44, 22, 45, 2.0, rock));
  // ruínas entre o meio e as torres
  half.push(...wallX(-12, -4, 38, 0.6, 2.4, ruin.wall, [door(-9, -7.4, 1.8)]), ...wallX(2, 9, 42, 0.6, 2.4, ruin.wall), B(-3, 34, -2.4, 37, 1.6, ruin.wall2), crate(5, 34, 1.6, 1.4, '#8b5a2b'), crate(-15.5, 46, 1.4, 1.2, '#8b5a2b'));
  // laterais perto das torres
  half.push(B(-26, 48, -22, 49, 2.0, rock), crate(-18, 64, 1.6, 1.6, '#8b5a2b'), crate(22, 64, 1.6, 1.4, '#8b5a2b'), B(14, 56, 15, 62, 1.6, rock), B(-28, 60, -24, 61, 1.4, rock), crate(-17, 54, 1.6, 1.4, '#8b5a2b'));
  boxes.push(...half, ...mirrorZ(half));
  boxes.push(B(-3, -10, 3, 10, 0.3, '#8b5a2b', 2.7), B(-3, -10, -2.7, 10, 1.0, '#6b4423', 3), B(2.7, -10, 3, 10, 1.0, '#6b4423', 3), B(-0.5, -0.5, 0.5, 0.5, 2.7, '#6b4423'), B(-0.5, -6.5, 0.5, -5.5, 2.7, '#6b4423'), B(-0.5, 5.5, 0.5, 6.5, 2.7, '#6b4423'));
  // casamata no meio do corredor leste (telhado pelas rampas das pontas)
  boxes.push(...building(16, -7, 28, 7, { col: { ...ruin, wall: '#7f8c6d', wall2: '#6f7c5d', roof: '#5f6c4d', roof2: '#4f5c3d' }, floors: 1, H: 3.2,
    ops: [{ s: 'w', a: -1, b: 1 }, { s: 'e', a: -1, b: 1 }, { s: 'n', a: 19, b: 21 }, { s: 's', a: 23, b: 25 }, { s: 'w', a: -5, b: -3, k: 'win', lo: 1.2, hi: 1.8 }, { s: 'w', a: 3, b: 5, k: 'win', lo: 1.2, hi: 1.8 }],
    roofGaps: [{ s: 'n', a: 24, b: 27.5 }, { s: 's', a: 16.5, b: 20 }], inner: [{ axis: 'z', s0: -6.5, s1: 6.5, line: 22, ops: [{ a: -4.5, b: -2.7 }, { a: 2.7, b: 4.5 }] }] }));
  boxes.push(R(24, -12, 27.5, -7, 0, 3.55, 'z', 1, '#7f8c6d'), R(16.5, 7, 20, 12, 0, 3.55, 'z', -1, '#7f8c6d'), crate(20, -2, 1.2, 1.0, '#8b5a2b', 3.55), crate(25, 3, 1.2, 1.0, '#8b5a2b', 3.55));
  // pedras de cobertura nas laterais
  for (const [x, z, s, h] of [[-22, 30 - 30, 3, 2], [-10, 4, 2, 1.4], [8, -4, 2, 1.4], [-27, -4, 2, 1.6], [-14, 2, 1.6, 1.2], [10, 6, 1.6, 1.2], [-6, 26, 2, 1.6], [6, -26, 2, 1.6], [-24, -18 - 6, 2.5, 1.8], [24, 18, 2.5, 1.8], [-8, 42, 2, 1.4], [8, -42, 2, 1.4], [-18, -42, 3, 2], [18, 42 - 6, 3, 2]])
    boxes.push(B(x - s / 2, z - s / 2, x + s / 2, z + s / 2, h, rock), B(x - s / 2, -z - s / 2, x + s / 2, -z + s / 2, h, rock));
  for (const wp of [[-4.2, 8.4, 61.6], [-4.2, 8.4, -61.6], [0, 8.4, 58], [0, 8.4, -58], [-6.5, 8.3, 61.7], [-6.5, 8.3, -61.7]]) boxes.push({ wp });
  const kegs = []; for (const [x, z] of [[-12, 46], [-11, 46], [-11.5, 47], [12, 44], [16, 50], [-13, 24.5], [18, 24]]) kegs.push({ t: 'keg', x, z }, { t: 'keg', x, z: -z });
  MAPS.push({
    id: 'torres-do-barril', name: 'Torres Gêmeas do Barril', desc: 'Mapa comprido de Sniper em três corredores: torres de três andares, ruínas de dois andares com trincheira, planaltos com ponte e casamata com telhado no corredor leste.',
    size: [30, 72], wallH: 5, wallColor: [rock, '#7a6e60'],
    palette: { sky: '#7ec8f2', fog: ['#b8e0f5', 70, 180], hemi: ['#ffffff', '#5a8f3a', 1.6], sun: ['#ffffff', 2.3], ground: '#6cbf4f', tiles: null, clouds: true },
    ...(() => { const F = fin(boxes); F.boxes = F.boxes.filter((b) => b.b[4] - b.b[1] > 0.05); return F; })(), props: [...kegs, { t: 'tree', x: -26, z: 0 }, { t: 'tree', x: 26, z: 4 }, { t: 'tree', x: -26, z: 50 }, { t: 'tree', x: 26, z: -50 },
      { t: 'banner', x: 0, y: 6.2, z: 47.9, c: red, rot: Math.PI }, { t: 'banner', x: 0, y: 6.2, z: -47.9, c: cyan, rot: 0 }],
    bomb: { sites: [[-24, 0, -43], [23, 0, -39.5]], atk: [[0, 58], [-4, 60, 4.4], [20, 60], [-20, 56], [-12, 66], [12, 66]], def: [[0, -58], [4, -60, 4.4], [-20, -60], [20, -56], [-12, -66], [12, -66]] }, // Bomba: Ataque na torre vermelha, Defesa na azul; sites na frente da torre azul
    spawns: [[0, 58], [-4, 60, 4.4], [20, 60], [-20, 56], [0, -58], [4, -60, 4.4], [-20, -60], [20, -56], [-24, 0], [24, 0]],
    pickups: [['health', 1.5, 0, 3], ['health', -22, 40], ['health', 22, -40], ['health', 0, 58], ['health', 0, -58],
      ['ammo', 4, 58, 4.4], ['ammo', -4, -58, 4.4], ['ammo', 0, 60, 8.4], ['ammo', 0, -60, 8.4], ['ammo', -26, -20], ['ammo', 27, 23],
      ['grenade', -24, 0], ['grenade', 24, 0], ['grenade', 0, 16, 3], ['grenade', 0, -16, 3]],
    openMax: 7.5, // mapa de Sniper: um pouco mais aberto de propósito
    showcase: [22, 0, 36], view: [0, 4.4, 50, 0, -0.04],
    test: { stairs: { from: [10, 0, 63], to: [10, 4.4, 50], level: 4.4 }, roof: { from: [-6.5, 4.4, 50.6], via: [[-6.5, 61.6]], to: [-2.5, 8.4, 61.6], level: 8.4 }, under: { from: [-8, 0, 1.8], to: [8, 0, 1.8], ceil: 2.7 } },
  });
}

// ---------- 6) Vizinhança Cheers (inspirado em Nuketown: duas casas frente a frente, garagens, quintais) ----------
{
  // casa norte (a do sul é a mesma girada 180° em volta do centro)
  const casa = (c) => {
    const o = [];
    o.push(...building(-16, -19, -2, -8, { col: c, floors: 2,
      ops: [{ s: 's', a: -10, b: -8.2 }, { s: 's', a: -15, b: -12.5, k: 'win' }, { s: 's', a: -5.5, b: -3, k: 'win' },
        { s: 'n', a: -6.2, b: -4.4 }, { s: 'n', a: -14, b: -11, k: 'win' }, { s: 'w', a: -15, b: -13.2 }, { s: 'e', a: -16, b: -13, k: 'win' },
        { s: 's', a: -10, b: -8.2, f: 1, hi: 2.4 }, { s: 's', a: -15, b: -12, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -6, b: -3, f: 1, k: 'win', lo: 0.9 },
        { s: 'n', a: -14, b: -11, f: 1, k: 'win', lo: 0.9 }, { s: 'w', a: -14, b: -12.2, f: 1, hi: 2.4 }, { s: 'e', a: -16, b: -12, f: 1, k: 'win', lo: 0.9 }],
      stairs: [{ f: 0, r: [-8.5, -18.5, -2.5, -16.6], axis: 'x', dir: 1 }],
      inner: [{ axis: 'z', s0: -15.6, s1: -8.5, line: -11.2, ops: [{ a: -13.4, b: -11.6 }] }, { axis: 'z', s0: -15.6, s1: -8.5, line: -11.2, f: 1, ops: [{ a: -12.6, b: -10.8 }] }],
      roofGaps: [{ s: 'w', a: -18.6, b: -15.8 }] }));
    o.push(...balcony(-12, -8, -6, -6.2, 3.5, c.floor, c.trim, 'n'), B(-12, -6.6, -11.6, -6.2, 3.25, c.trim), B(-6.4, -6.6, -6, -6.2, 3.25, c.trim));
    // garagem (telhado em 3,5 m: liga na janela-porta do 2º andar; rampa no telhado leva ao telhado da casa)
    o.push(...building(-23, -18, -16, -9, { col: { ...c, wall: c.wall2 || c.wall }, floors: 1, ops: [{ s: 's', a: -22, b: -17, k: 'wide' }, { s: 'e', a: -15, b: -13.2 }, { s: 'n', a: -21, b: -19.4 }],
      roofGaps: [{ s: 'w', a: -12.4, b: -10 }, { s: 'e', a: -18, b: -15.6 }, { s: 'e', a: -14.4, b: -11.8 }] }));
    o.push(R(-22.7, -17.7, -16, -15.8, 3.5, 7, 'x', 1, c.stair)); // telhado da garagem → telhado da casa
    o.push(R(-27, -12.2, -23, -10.2, 0, 3.5, 'x', 1, c.stair)); // "escada" do beco lateral → telhado da garagem
    o.push(crate(-20, -14.5, 1.6, 1.4, '#9c6b3a'), crate(-18, -11, 1.2, 1.0, '#b07a45'), crate(-5, -13, 1.4, 0.9, '#9c6b3a'), B(-15.4, -10.6, -13, -9.4, 0.9, '#8b5a2b')); // dentro
    // galpão do quintal leste (telhado alcançável pela pilha de caixotes)
    o.push(...building(6, -19, 14, -12, { col: { wall: '#b5793e', wall2: '#a0682f', floor: '#c8a27a', roof: '#6b4423' }, floors: 1, H: 3.2, ops: [{ s: 's', a: 8.8, b: 10.6 }, { s: 'w', a: -17, b: -14, k: 'win' }, { s: 'e', a: -16.5, b: -14.7 }], roofGaps: [{ s: 's', a: 12, b: 14 }] }));
    o.push(crate(13, -10.8, 1.6, 1.0, '#9c6b3a'), crate(13, -10.8, 1.2, 1.0, '#b07a45', 1.0), B(12.2, -12, 13.8, -11.4, 2.2, '#9c6b3a'), R(12.2, -11.4, 13.8, -9.6, 2.2, 3.2, 'z', -1, '#b07a45'));
    // quintais: cercas com vãos, casinha do cachorro, caixotes
    o.push(B(-30, -20.2, -24, -19.8, 1.2, '#b5793e'), B(-21, -21.2, -12, -20.8, 1.2, '#b5793e'), B(-9, -21.2, -1, -20.8, 1.2, '#b5793e'), B(2, -21.2, 5, -20.8, 1.2, '#b5793e'), B(16, -21.2, 24, -20.8, 1.2, '#b5793e'));
    o.push(B(-1.2, -24, -0.8, -19, 1.2, '#b5793e'), crate(-16, -23.5, 2.2, 1.4, '#a0682f'), crate(-3, -24.4, 1.6, 1.6), crate(19, -23.6, 1.6, 1.6), crate(26, -15, 2, 1.6, '#b07a45'), crate(26, -12.8, 1.4, 1.0));
    o.push(B(20, -17, 22, -14.5, 1.3, '#d35400'), B(-27.5, -4.8, -25.5, -3, 1.4, '#9c6b3a'), crate(-28, 4.5, 1.6, 1.6));
    o.push(B(2.5, -9, 4.5, -7.5, 1.1, '#2f80ed'), B(-29, -17, -27, -15, 1.4, '#9c6b3a')); // caixa de correio grande / lixeira
    return o;
  };
  const cA = { wall: '#f2d16b', wall2: '#e8c25a', inner: '#f7e3a0', floor: '#c8a27a', roof: '#e63946', roof2: '#c0303c', stair: '#b5793e', trim: '#ffffff' };
  const cB = { wall: '#9be8f0', wall2: '#86d8e2', inner: '#c8f3f7', floor: '#c8a27a', roof: '#12233a', roof2: '#1d3557', stair: '#b5793e', trim: '#ffffff' };
  const boxes = [...casa(cA), ...rot180(casa(cB), 0, 0)];
  boxes.push(B(-12, -2.2, -8, 2.2, 1.5, '#2f80ed'), B(8, -2.2, 12, 2.2, 1.5, '#28b463')); // carros no meio da rua (deixam as faixas laterais abertas pro Sniper)
  boxes.push(crate(-20, 4.5, 1.6, 1.2), crate(20, -4.5, 1.6, 1.2), B(-1, -5.5, 1, -4.5, 1.0, '#e8e8e8'), B(-1, 4.5, 1, 5.5, 1.0, '#e8e8e8'));
  MAPS.push({
    id: 'vizinhanca-cheers', name: 'Vizinhança Cheers', desc: 'Estilo Nuketown: duas casas de dois andares frente a frente, garagens com telhado, sacadas, quintais e o ônibus no meio da rua.',
    size: [30, 26], wallH: 3, wallColor: ['#b5793e', '#a0682f'],
    palette: DAY({ ground: '#7cc95a', tiles: null }),
    ...fin(boxes), props: [{ t: 'street', x0: -30, z0: -7, x1: 30, z1: 7 }, { t: 'bus', x: 0, z: 0, c: '#f2c94c' }, { t: 'truck', x: 19, z: 3.6, c: '#e63946' }, { t: 'truck', x: -19, z: -3.6, c: '#2f80ed' },
      { t: 'tree', x: -27, z: -23 }, { t: 'tree', x: 27, z: 23 }, { t: 'tree', x: 27, z: -23 }, { t: 'tree', x: -27, z: 23 }, { t: 'tree', x: -9, z: -24 }, { t: 'tree', x: 9, z: 24 },
      { t: 'sign', x: -9.1, y: 6.0, z: -7.9, w: 3, h: 0.9, rot: 0, text: 'C! 1', bg: '#e63946', fg: '#fff' }, { t: 'sign', x: 9.1, y: 6.0, z: 7.9, w: 3, h: 0.9, rot: Math.PI, text: 'C! 2', bg: '#12233a', fg: '#7DF9FF' }],
    bomb: { sites: [[19, 0, -11], [22, 0, 20]], atk: [[-27.5, -8], [-27, 19], [-20, -23.5], [-12, -11.5], [-27, -19], [-10, 23.5]], def: [[27.5, 8], [27, -19], [12, 11.5], [27.5, -3], [27, 13], [27, -24]] }, // Bomba: Ataque a oeste, Defesa a leste; A no quintal nordeste, B no quintal sudeste
    spawns: [[-20, -23.5], [-6, -23.5], [10, -23.5], [20, 23.5], [6, 23.5], [-10, 23.5], [-27.5, -8], [27.5, 8], [-12, -11.5], [12, 11.5], [27, -19], [-27, 19]],
    pickups: [['health', -12.5, -16], ['health', 12.5, 16], ['ammo', -12, -16.5, 3.5], ['ammo', 12, 16.5, 3.5], ['ammo', -27, 0], ['ammo', 27, 0],
      ['grenade', -9, -13, 7], ['grenade', 9, 13, 7], ['grenade', 10, -15.5], ['grenade', -10, 15.5], ['health', 0, -23], ['health', 0, 23]],
    showcase: [4, 0, -4], view: [22, 0, 5, 1.35, 0.02], openMax: 7,
    test: { stairs: { from: [-9.8, 0, -17.5], via: [[-3.2, -17.5]], to: [-3.2, 3.5, -15.2], level: 3.5 }, under: { from: [-15, 0, -12.5], to: [-10.2, 0, -12.5], ceil: 3.2 }, roof: { from: [-22.4, 3.5, -16.8], to: [-13, 7.0, -16.8], level: 7.0 } },
  });
}

// ---------- 7) Bar Cheers Noturno (estilo Office: salão com balcão, ala de 2 andares com cozinha/depósito e VIP, banheiros, escritório, sinuca, corredores laterais) ----------
{
  const wood = '#5a3420', dark = '#2a2238', neon = '#7DF9FF', pink = '#ff5fa2', boxes = [], H = 3.3;
  const col = { wall: '#3b2a4a', wall2: '#33243f', inner: '#4a3a5a', floor: '#4a2e1e', roof: '#231c30', roof2: '#1b1626', stair: wood, trim: neon };
  const C = (x, z, s = 1.4, h = 1.2, c = '#6b4423', y0 = 0) => boxes.push(crate(x, z, s, h, c, y0));
  // ala norte (2 andares): cozinha | corredor | depósito no térreo; VIP com janelões e sacada em cima; terraço no telhado
  boxes.push(...building(-21, -20, 21, -10, { col, floors: 2, H,
    ops: [{ s: 's', a: -15, b: -13 }, { s: 's', a: -1.5, b: 1.5 }, { s: 's', a: 12, b: 14 }, { s: 'w', a: -16, b: -14 }, { s: 'e', a: -16, b: -14 },
      { s: 's', a: -2, b: 2, f: 1 }, { s: 's', a: -18, b: -8, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: 7, b: 17, f: 1, k: 'win', lo: 0.9 }, { s: 'w', a: -17, b: -13, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: -17, b: -13, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-4.5, -19.5, 1.5, -17.6], axis: 'x', dir: 1 }, { f: 1, r: [9, -19.5, 15, -17.6], axis: 'x', dir: 1 }],
    inner: [{ axis: 'z', s0: -19.5, s1: -10.5, line: -6, ops: [{ a: -14.5, b: -12.7 }] }, { axis: 'z', s0: -19.5, s1: -10.5, line: 6, ops: [{ a: -14.5, b: -12.7 }] },
      { axis: 'z', s0: -19.5, s1: -10.5, line: -8, f: 1, ops: [{ a: -15, b: -13.2 }] }] }));
  boxes.push(B(-19, -19.5, -14, -18.5, 1.0, '#8a8a9a'), B(-12, -14, -9, -12.5, 1.0, '#8a8a9a'), C(9, -16, 1.6, 1.6), C(16, -12.5, 1.4, 1.4), C(18.5, -18, 1.4, 1.2)); // fogão, bancada, caixas do depósito
  boxes.push(B(-18, -16, -15, -14.6, 0.9, '#7a2d5a', H), B(-4, -14.5, 0, -13, 0.9, '#7a2d5a', H), B(14, -12.6, 18, -11.4, 1.0, '#1b1626', H), C(-12, -12, 1.2, 1.0, wood, 2 * H), C(4, -15, 1.4, 1.2, wood, 2 * H), C(-16, -16, 1.4, 1.2, wood, 2 * H));
  // sacada do VIP + escada pro salão
  boxes.push(B(-4, -10, 4, -7.6, 0.25, wood, H - 0.25), B(-4, -7.75, 4, -7.6, 1.0, '#1b1626', H), B(-4, -10, -3.85, -7.6, 1.0, '#1b1626', H), R(4, -10, 9.5, -7.6, 0, H, 'x', -1, wood), { wp: [0, H, -8.8] }, { wp: [6.8, 1.65, -8.8] });
  // salão: balcão em U, mesas, palco com DJ
  boxes.push(B(-7, -4, 7, -2.8, 1.2, wood), B(5.8, -4, 7, 2, 1.2, wood), B(-7, -4, -5.8, 0, 1.2, wood));
  boxes.push(B(-8, 13, 8, 19.5, 1.0, '#3a2a48'), R(8, 13, 11, 19.5, 0, 1, 'x', -1, '#3a2a48'), R(-11, 13, -8, 19.5, 0, 1, 'x', 1, '#3a2a48'));
  boxes.push(B(-2, 16.5, 2, 18, 1.2, '#1b1626', 1), B(-6.5, 17, -5, 18.6, 2.4, '#111', 1), B(5, 17, 6.5, 18.6, 2.4, '#111', 1));
  for (const [x, z] of [[-9, 4], [-4, 8], [4, 8], [9, 4], [-9, -6.5], [10, -2]]) boxes.push(B(x - 0.7, z - 0.7, x + 0.7, z + 0.7, 0.95, '#6b4423'));
  // banheiros (oeste): corredor + cabines
  boxes.push(...building(-21, -7, -12, 7, { col: { ...col, wall: '#4a5a6a', wall2: '#3f4f5f', inner: '#9aa9b9' }, floors: 1, H: 3.0, parapet: 0,
    ops: [{ s: 'e', a: -1, b: 1 }, { s: 'w', a: 3, b: 5 }, { s: 'n', a: -15, b: -13 }],
    inner: [{ axis: 'z', s0: -6.5, s1: 6.5, line: -16.5, ops: [{ a: -5, b: -3.4 }, { a: -0.8, b: 0.8 }, { a: 3.4, b: 5 }] }, { axis: 'x', s0: -20.5, s1: -16.5, line: -2, ops: [] }, { axis: 'x', s0: -20.5, s1: -16.5, line: 2, ops: [] }] }));
  // escritório (leste)
  boxes.push(...building(12, -7, 21, 7, { col, floors: 1, H: 3.0, parapet: 0,
    ops: [{ s: 'w', a: -1, b: 1 }, { s: 'e', a: -5, b: -3 }, { s: 's', a: 17, b: 19 }, { s: 'w', a: 3, b: 5.5, k: 'win' }],
    inner: [{ axis: 'x', s0: 12.5, s1: 20.5, line: 0, ops: [{ a: 17, b: 18.8 }] }] }));
  C(14.5, -4.5, 1.8, 0.9, '#6b4423'); C(18.5, 4, 1.6, 0.9, '#6b4423');
  // sinuca (sudeste) e camarotes (sudoeste)
  boxes.push(...building(12, 9, 21, 19.6, { col, floors: 1, H: 3.0, parapet: 0, ops: [{ s: 'w', a: 13, b: 15 }, { s: 'e', a: 11, b: 13 }, { s: 'n', a: 14, b: 16 }, { s: 'w', a: 16.5, b: 18.5, k: 'win' }] }));
  boxes.push(B(14.5, 13, 18.5, 15, 0.9, '#1e7a4a'));
  boxes.push(B(-20, 9, -14, 10, 1.3, '#7a2d5a'), B(-20, 14, -14, 15, 1.3, '#7a2d5a'), B(-12.5, 11, -11.7, 17, 1.3, '#7a2d5a'), C(-17, 12, 1.2, 0.9, wood), C(-17, 17.5, 1.2, 0.9, wood));
  // corredores laterais (linha longa do Sniper): barris encostados
  C(-22.8, -4, 1.2, 1.2); C(-22.8, 12, 1.2, 1.2); C(22.8, 4, 1.2, 1.2); C(22.8, -12, 1.2, 1.2);
  const props = [];
  for (const [x, z] of [[-3, -6], [-1.8, -6], [3, -6], [1.8, -6.2], [-22.6, 1], [22.6, 10], [-11, -8.5], [11, 11]]) props.push({ t: 'keg', x, z });
  props.push({ t: 'keg', x: 6, z: -16, y: H }, { t: 'keg', x: -10, z: -16, y: H });
  props.push({ t: 'cup', x: -9.5, z: 11, s: 4 }, { t: 'cup', x: 10, z: 8, s: 4 }, { t: 'cup', x: -3, z: -3.4, s: 0.6, y: 1.2, deco: true }, { t: 'cup', x: 2, z: -3.4, s: 0.6, y: 1.2, deco: true });
  props.push({ t: 'neon', x: 0, y: 5.6, z: -9.9, w: 8, h: 1.6, rot: Math.PI, text: 'CHEERS', c: neon });
  props.push({ t: 'neon', x: -11.9, y: 2.6, z: -4, w: 3, h: 1.4, rot: -Math.PI / 2, text: 'WC', c: pink });
  props.push({ t: 'neon', x: 11.9, y: 2.6, z: 4, w: 3.5, h: 1.4, rot: Math.PI / 2, text: 'BAR', c: neon });
  props.push({ t: 'neon', x: 0, y: 4.4, z: 19.9, w: 7, h: 1.6, rot: Math.PI, text: 'OINK!', c: pink });
  props.push({ t: 'strip', x0: -7, z0: -2.78, x1: 7, z1: -2.78, y: 1.0, c: neon }, { t: 'strip', x0: -8, z0: 12.98, x1: 8, z1: 12.98, y: 0.9, c: pink });
  MAPS.push({
    id: 'bar-cheers', name: 'Bar Cheers Noturno', desc: 'Estilo Office: salão com balcão e palco, cozinha e depósito, VIP no andar de cima com sacada, terraço, banheiros, escritório, sinuca e corredores laterais compridos.',
    size: [24, 20], wallH: 6, wallColor: [dark, '#231c30'], laneMin: 35,
    palette: { sky: '#0b0e22', fog: ['#161236', 30, 90], hemi: ['#9a9aff', '#3a1c50', 1.6], sun: ['#b8c4ff', 1.1], ground: '#3a2418', tiles: ['#4a2e1e', '#3c2618', 48, 24], clouds: false, stars: true,
      lights: [[neon, 0, 4.5, -2, 40, 22], [pink, -16, 3, 12, 30, 18], [neon, 16, 3, 0, 30, 18], ['#ffd27a', 0, 3, 16, 25, 14], ['#ffd27a', 0, 3, -15, 25, 14]] },
    ...fin(boxes), props,
    bomb: { sites: [[17, 0, -3.5], [13.5, 0, 14]], atk: [[-22.5, -18], [-22.5, 18], [-16, -12], [-18.5, 0], [-14.5, 12], [-12, -15, H]], def: [[22.5, -18], [22.5, 18], [22.5, 1.5], [22.5, -9], [22.5, 9], [16, -15]] }, // Bomba: Ataque a oeste, Defesa a leste; A no escritório, B na sinuca
    spawns: [[-22.5, -18], [22.5, 18], [-22.5, 18], [22.5, -18], [-16, -12], [16, -15], [-18.5, 0], [16, 3], [16, 17], [-14.5, 12], [0, 10], [-12, -15, H], [12, -14, H]],
    pickups: [['health', 0, -7], ['health', -18.5, -4.5], ['health', 16, -2], ['ammo', 2, -12, H], ['ammo', 15, -16, 2 * H], ['ammo', 16, 11], ['ammo', -22.6, 6],
      ['grenade', 8, 2], ['grenade', -8, 2], ['grenade', 0, 15, 1], ['grenade', -2, -16, 2 * H]],
    showcase: [0, 0, 6], view: [-2, 1, 13, -0.08, -0.08], openMax: 7,
    test: { stairs: { from: [-4.2, 0, -18.5], to: [2.2, H, -18.5], level: H }, under: { from: [-4.5, 0, -15], to: [4.5, 0, -15], ceil: 3.0 }, roof: { from: [9.3, H, -18.5], to: [15.7, 2 * H, -18.5], level: 2 * H } },
  });
}

// ---------- 8) Rodízio do Docão (feito pro modo Bomba: Ataque nasce longe ao norte, Defesa perto dos sites ao sul) ----------
//  Três rotas do curral do Ataque (z > 60) até a faixa dos sites (z < -24):
//   • oeste "Rua do Espeto" (zigue-zague de muros + Casa da Vó estreitando a rua) → A principal;
//   • meio "Avenida da Linguiça" → Praça da Brasa (churrasqueira gigante) → porta da Cozinha → A ou B pela cozinha;
//   • leste "Beco da Farofa" (zigue-zague + Bar do Torresmo) → B principal.
//  Conectores pelos quarteirões: Casa do Seu Torresmo / Açougue Central (oeste ↔ meio) e Depósito / Padaria Pão de Alho (meio ↔ leste).
//  A = Quintal do Espeto (oeste), B = Varanda da Costela (leste); a Defesa nasce no pátio sul, a uns 45 m de cada site.
{
  const H = 3.5, boxes = [];
  const brick = '#b5523b', brick2 = '#9c4532', cream = '#f0dcb4', cream2 = '#e3c99a', terra = '#d9825b', terra2 = '#c96f4a', stone = '#cfc2a8', stone2 = '#b9ab90';
  const wood = '#8b5a2b', wood2 = '#6b4423', crateC = '#9c6b3a', crateC2 = '#b07a45', metal = '#3a3a40', ember = '#ff7a2e', mustard = '#f2c94c';
  const casa = (w, w2, roof = brick, roof2 = brick2) => ({ wall: w, wall2: w2, inner: '#f7e7c6', floor: '#c9a46a', roof, roof2, stair: wood, trim: stone });
  const C = (x, z, s = 1.6, h = 1.6, c = crateC, y0 = 0) => boxes.push(crate(x, z, s, h, c, y0));
  const G = (a, b, h = 4.2) => door(a, b, h); // portão com verga
  const WH = 10; // muros/quarteirões: mais altos que telhado + mureta + pulo (ninguém sobe neles)

  // ===== muros que cortam o mapa de lado a lado =====
  // norte: curral do Ataque → três portões
  boxes.push(...wallX(-46, 46, 60.5, 1, WH, brick, [G(-40, -33), G(-3.5, 3.5), G(33, 40)]));
  // sul da faixa do meio: A principal, porta da Cozinha, B principal
  boxes.push(...wallX(-46, 46, -23, 1, WH, brick, [G(-41, -35), G(-2, 2, 3.2), G(35, 41)]));
  // sul dos sites: saídas do pátio da Defesa (pro A, Cozinha, pro B)
  boxes.push(...wallX(-46, 46, -59, 1, WH, brick2, [G(-31, -24), G(-2.5, 2.5, 3.2), G(24, 31)]));

  // ===== faixa de aproximação (z 22..60) =====
  // rua oeste: zigue-zague
  boxes.push(B(-46, 46.6, -33, 47.4, 3.4, stone), B(-41, 34.6, -28, 35.4, 3.4, stone));
  C(-44, 52); C(-31, 55, 1.4, 1.2, crateC2); C(-36, 41, 2, 1.4); C(-44.5, 41); C(-30, 29, 1.6, 1.6, crateC2); C(-38, 27, 1.4, 1.0);
  // quarteirão oeste: Casa do Seu Torresmo (2 andares + telhado) liga a rua oeste ao meio
  boxes.push(...building(-28, 44, -12, 60, { col: casa(cream, cream2), floors: 2,
    ops: [{ s: 'w', a: 50, b: 52.2 }, { s: 'e', a: 46, b: 48.2 }, { s: 'w', a: 54, b: 57, k: 'win' }, { s: 'e', a: 52, b: 56, k: 'win' },
      { s: 'w', a: 45.5, b: 48.5, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: 49.5, b: 53, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: 55, b: 58, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-24, 52.5, -22, 58.5], axis: 'z', dir: 1 }, { f: 1, r: [-16.5, 45, -14.5, 51], axis: 'z', dir: -1 }],
    inner: [{ axis: 'z', s0: 44.5, s1: 59.5, line: -19, ops: [{ a: 49, b: 51 }] }] }));
  boxes.push(B(-28, 22, -12, 44, WH, terra)); // Frigorífico (maciço)
  C(-14, 49, 1.2, 1.0, crateC2, H); C(-26, 46, 1.2, 1.0, crateC, H);
  // meio: Avenida da Linguiça (bancas e muretas desencontradas) e o quiosque do caldo de cana com telhado
  boxes.push(B(-12, 39.6, -1, 40.4, 3.4, stone), B(1, 31.6, 12, 32.4, 3.4, stone), B(-12, 25.6, -5, 26.4, 1.3, stone));
  boxes.push(...building(-5, 44, 5, 51, { col: casa(terra, terra2, wood2, wood2), floors: 1, H: 3.2, ops: [{ s: 'n', a: -1, b: 1 }, { s: 's', a: -1, b: 1 }, { s: 'w', a: 46.5, b: 48.5, k: 'win' }, { s: 'e', a: 46.5, b: 48.5, k: 'win' }],
    roofGaps: [{ s: 'e', a: 49, b: 50.6 }] }));
  boxes.push(R(5, 48.8, 8.5, 50.6, 0, 3.2, 'x', -1, wood));
  C(-9, 56); C(9, 54, 1.6, 1.4, crateC2); C(8, 42, 1.4, 1.2); C(-8, 34, 1.6, 1.6, crateC2); C(5, 24, 2, 1.4); C(-2, 29, 1.2, 1.0);
  // quarteirão leste: Depósito de Carvão (maciço) + Bar do Torresmo (2 andares, liga o meio ao beco leste)
  boxes.push(B(12, 38, 28, 60, WH, terra2));
  boxes.push(...building(12, 22, 28, 38, { col: casa(cream2, cream, '#7a3b2e', '#5e2d23'), floors: 2,
    ops: [{ s: 'w', a: 24, b: 26.2 }, { s: 'e', a: 32, b: 34.2 }, { s: 'w', a: 29, b: 32, k: 'win' }, { s: 'e', a: 25, b: 28, k: 'win' }, { s: 'n', a: 15, b: 19, k: 'win' },
      { s: 'w', a: 30, b: 34, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: 24, b: 28, f: 1, k: 'win', lo: 0.9 }, { s: 'n', a: 20, b: 25, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [16, 31.5, 22, 33.5], axis: 'x', dir: 1 }, { f: 1, r: [15, 23.5, 21, 25.5], axis: 'x', dir: -1 }],
    inner: [{ axis: 'x', s0: 12.5, s1: 27.5, line: 30, ops: [{ a: 18, b: 20 }] }] }));
  C(14, 29, 1.2, 1.0, crateC2, H);
  // beco leste: zigue-zague e barris
  boxes.push(B(28, 48.6, 41, 49.4, 3.4, stone), B(33, 36.6, 46, 37.4, 3.4, stone));
  C(43, 55, 1.6, 1.4, crateC2); C(31, 52); C(44.5, 43, 2, 1.4); C(37, 42); C(31, 30, 1.4, 1.2); C(42, 26);

  // ===== faixa do meio (z -22.5..22) =====
  // rua oeste: Casa da Vó (2 andares) estreita a rua (8 m) e dá telhado olhando o A principal
  boxes.push(...building(-46, -7, -36, 7, { col: casa(mustard, '#e0b43c'), floors: 2,
    ops: [{ s: 'e', a: -2, b: 0.2 }, { s: 'e', a: 3, b: 5.5, k: 'win' }, { s: 'e', a: -6, b: -3.5, k: 'win' }, { s: 'n', a: -42, b: -39, k: 'win' }, { s: 's', a: -42, b: -39, k: 'win' },
      { s: 'e', a: -5, b: -1, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: 2, b: 6, f: 1, k: 'win', lo: 0.9 }, { s: 's', a: -44, b: -40, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-45.5, -5, -43.6, 1], axis: 'z', dir: -1 }, { f: 1, r: [-41, -1, -39, 5], axis: 'z', dir: 1 }] }));
  C(-31, 14, 1.6, 1.4); C(-33, -14, 2, 1.6, crateC2); C(-44, 16); C(-44, -15, 1.4, 1.2); C(-29.5, 2, 1.2, 1.0, crateC2);
  // quarteirão oeste do meio: Açougue Central (2 andares, liga rua oeste ↔ praça; janelas do 2º andar olham a praça)
  boxes.push(B(-28, 12, -12, 22, WH, brick2), B(-28, -22.5, -12, -12, WH, brick2));
  boxes.push(...building(-28, -12, -12, 12, { col: casa('#e8a06a', terra), floors: 2,
    ops: [{ s: 'w', a: -9, b: -6.8 }, { s: 'e', a: 4, b: 6.2 }, { s: 'w', a: 3, b: 7, k: 'win' }, { s: 'e', a: -6, b: -2, k: 'win' },
      { s: 'e', a: -9, b: -5, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: 1, b: 5, f: 1, k: 'win', lo: 0.9 }, { s: 'w', a: -4, b: 0, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-25, 2, -23, 8], axis: 'z', dir: 1 }, { f: 1, r: [-16, -10, -14, -4], axis: 'z', dir: -1 }],
    inner: [{ axis: 'z', s0: -11.5, s1: 11.5, line: -20, ops: [{ a: -3, b: -1 }] }, { axis: 'x', s0: -19.85, s1: -12.5, line: 0, ops: [{ a: -17, b: -15 }] }] }));
  C(-25, -4, 1.4, 1.2, crateC2); C(-14.5, 8, 1.2, 1.0); C(-24, 3, 1.2, 1.0, crateC, H);
  // Praça da Brasa: churrasqueira gigante com chaminé (quebra a linha do meio), mesas de piquenique
  boxes.push(B(-4, -4, 4, 4, 1.1, brick), B(-3.6, -3.6, 3.6, 3.6, 0.15, metal, 1.1), B(-1.2, -1.2, 1.2, 1.2, 6.5, brick2, 1.25), B(-1.6, -1.6, 1.6, 1.6, 0.5, stone, 7.75));
  boxes.push(B(-10, 12, -6, 13.2, 0.9, wood), B(6, 12, 10, 13.2, 0.9, wood), B(-10, -13.2, -6, -12, 0.9, wood), B(6, -13.2, 10, -12, 0.9, wood));
  C(-9, 4, 1.6, 1.4, crateC2); C(9, -4, 1.6, 1.4, crateC2); C(-3, 17); C(3, -17); C(10, 19, 1.4, 1.2); C(-10, -19, 1.4, 1.2);
  // quarteirão leste do meio: Padaria Pão de Alho (1 andar, telhado pela rampa do beco) liga a praça ↔ beco leste
  boxes.push(B(12, 10, 28, 22, WH, terra), B(12, -22.5, 28, -10, WH, terra));
  boxes.push(...building(12, -10, 28, 10, { col: casa(cream, cream2, '#c96f4a', '#a85a3a'), floors: 1, H: 3.4,
    ops: [{ s: 'w', a: -6, b: -3.8 }, { s: 'e', a: 3, b: 5.2 }, { s: 'w', a: 2, b: 6, k: 'win' }, { s: 'e', a: -6, b: -2, k: 'win' }],
    roofGaps: [{ s: 'e', a: 6.5, b: 9.5 }], inner: [{ axis: 'z', s0: -9.5, s1: 9.5, line: 20, ops: [{ a: -1, b: 1 }] }] }));
  boxes.push(R(28, 6.5, 33, 9.5, 0, 3.4, 'x', -1, wood));
  C(15, 6, 1.2, 1.0, crateC2); C(25, -6, 1.4, 1.0); C(22, 2, 1.2, 1.0, crateC, 3.4);
  // beco leste do meio: barricada e caixotes
  boxes.push(B(36, -2, 46, -1.2, 3.4, stone), B(28, 14.6, 38, 15.4, 3.4, stone));
  C(31, -12, 1.6, 1.6, crateC2); C(43, -14); C(43, 8, 1.4, 1.2); C(38, 20, 1.6, 1.4);

  // ===== faixa dos sites (z -58.5..-23.5) =====
  // divisórias entre os sites e a Cozinha (porta dos CTs no meio de cada uma)
  boxes.push(...wallZ(-58.5, -23.5, -14, 1, WH, stone2, [G(-45, -41)]), ...wallZ(-58.5, -23.5, 14, 1, WH, stone2, [G(-45, -41)]));
  // Cozinha do Rodízio: no centro, portas pro norte (meio), pro sul (Defesa) e pros dois lados
  boxes.push(...building(-9, -50, 9, -29, { col: casa('#f7e7c6', cream2, metal, '#2a2a30'), floors: 1, H: 3.6, parapet: 0,
    ops: [{ s: 'n', a: -1.5, b: 1.5 }, { s: 's', a: -1.5, b: 1.5 }, { s: 'w', a: -44, b: -42 }, { s: 'e', a: -44, b: -42 }, { s: 'w', a: -36, b: -33, k: 'win' }, { s: 'e', a: -36, b: -33, k: 'win' }],
    inner: [{ axis: 'x', s0: -8.5, s1: 8.5, line: -38, ops: [{ a: -6, b: -4 }, { a: 4, b: 6 }] }] }));
  boxes.push(B(-6, -48, 6, -46.5, 1.0, '#9aa3a8'), B(-7.5, -34, -4.5, -31.5, 1.1, metal), B(4.5, -34, 7.5, -31.5, 1.1, metal)); // bancada e fogões
  C(-11.5, -28, 1.4, 1.2); C(11.5, -54, 1.4, 1.2, crateC2); C(-11.5, -55, 1.2, 1.0);
  // ---- A: Quintal do Espeto ----  site em (-30, -42)
  boxes.push(...building(-46, -58.5, -36, -48, { col: casa(cream, '#e8cfa6', brick, brick2), floors: 2, // Casa do Churrasqueiro (olha o site de cima)
    ops: [{ s: 'n', a: -40.5, b: -38.5 }, { s: 'e', a: -56, b: -54 }, { s: 'n', a: -45, b: -42, k: 'win' }, { s: 'e', a: -52, b: -49.5, k: 'win' },
      { s: 'n', a: -44.5, b: -37, f: 1, k: 'win', lo: 0.9 }, { s: 'e', a: -57, b: -50, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [-45.3, -57.5, -43.4, -51.5], axis: 'z', dir: -1 }] }));
  boxes.push(B(-24, -30, -17, -26, 1.2, stone), R(-24, -33, -21, -30, 0, 1.2, 'z', 1, stone), C(-19, -28, 1.6, 1.4, crateC2, 1.2)); // palanque perto da entrada
  boxes.push(B(-37.8, -36, -37.0, -31, 1.3, stone), B(-27, -49.8, -22, -49.0, 1.3, stone)); // muretas
  C(-34, -45, 2, 1.6); C(-25.5, -38, 1.6, 1.6, crateC2); C(-25.5, -38, 1.2, 1.0, crateC, 1.6); C(-31, -53); C(-17, -46, 1.4, 1.2); C(-43, -28, 2, 1.6, crateC2); C(-44, -40, 1.4, 1.2);
  // ---- B: Varanda da Costela ----  site em (30, -42)
  boxes.push(...building(36, -58.5, 46, -46, { col: casa('#9be8f0', '#86d8e2', '#12233a', '#1d3557'), floors: 2, // Bar da Costela, com varanda
    ops: [{ s: 'w', a: -51, b: -49 }, { s: 'n', a: 38, b: 40 }, { s: 'w', a: -56, b: -53.5, k: 'win' },
      { s: 'n', a: 41.5, b: 43.7, f: 1 }, { s: 'w', a: -57, b: -49, f: 1, k: 'win', lo: 0.9 }],
    stairs: [{ f: 0, r: [43.4, -57.5, 45.3, -51.5], axis: 'z', dir: -1 }] }));
  boxes.push(...balcony(40, -46, 45.5, -43, H, '#c9a46a', wood2, 'n'));
  boxes.push(B(30, -56, 36, -51, 1.2, stone), R(26, -56, 30, -53, 0, 1.2, 'x', 1, stone), C(33.5, -53.5, 1.6, 1.4, crateC2, 1.2)); // degrau alto dos fundos
  boxes.push(B(22.2, -36, 23.0, -31, 1.3, stone), B(35, -35.8, 40, -35.0, 1.3, stone));
  C(26, -46, 2, 1.6); C(34, -38.5, 1.6, 1.6, crateC2); C(34, -38.5, 1.2, 1.0, crateC, 1.6); C(18, -30, 1.4, 1.2); C(43, -30, 2, 1.6); C(17, -52, 1.4, 1.2, crateC2);

  // ===== pátios das bases =====
  // curral do Ataque (norte)
  C(-30, 66, 2, 1.6); C(-14, 64, 1.6, 1.4, crateC2); C(14, 64, 1.6, 1.4, crateC2); C(30, 66, 2, 1.6); C(-40, 74, 1.6, 1.4); C(40, 74, 1.6, 1.4); C(0, 64, 1.4, 1.2); C(-20, 76); C(20, 76); C(-7, 70.5, 1.6, 1.4, crateC2); C(7, 70.5, 1.6, 1.4, crateC2); C(-30, 75, 1.4, 1.2); C(30, 75, 1.4, 1.2);
  // pátio da Defesa (sul)
  C(-30, -66, 2, 1.6); C(-12, -64, 1.6, 1.4, crateC2); C(12, -64, 1.6, 1.4, crateC2); C(30, -66, 2, 1.6); C(-40, -74, 1.6, 1.4); C(40, -74, 1.6, 1.4); C(0, -63, 1.4, 1.2); C(-20, -76); C(20, -76); C(-7, -71.5, 1.6, 1.4, crateC2); C(7, -71.5, 1.6, 1.4, crateC2); C(-30, -75, 1.4, 1.2); C(30, -75, 1.4, 1.2);

  const kegs = [[-44, 58], [-43, 58], [44, 58], [-17, 60.8 - 2.6], [-45, 21], [-45, 20], [45, -21], [44, -21], [-16, -26], [16, -26], [-45, -46], [45, -44], [-10.5, -57], [10.5, -57]].map(([x, z]) => ({ t: 'keg', x, z }));
  const spA = [[-24, 70], [-12, 72], [0, 70], [12, 72], [24, 70], [-6, 76], [6, 76], [-34, 70], [34, 70], [-18, 66], [18, 66]];
  const spD = [[-16, -67], [-6, -69], [6, -69], [16, -67], [0, -74], [-24, -72], [24, -72], [-36, -68], [36, -68], [-10, -76], [10, -76]];
  MAPS.push({
    id: 'rodizio', name: 'Rodízio do Docão', desc: 'Feito pro modo Bomba: três rotas compridas do curral do Ataque até o Quintal do Espeto (A) e a Varanda da Costela (B), com zigue-zagues, casas de dois andares com telhado, Praça da Brasa e a Cozinha da Defesa no meio.',
    size: [46, 80], wallH: WH, wallColor: [brick, brick2],
    palette: { sky: '#8fd3ff', fog: ['#ffe3c0', 60, 170], hemi: ['#fff4e0', '#8f6a3a', 1.6], sun: ['#ffe8c8', 2.3], ground: '#d9b98a', tiles: ['#dcbf92', '#cfb083', 92, 46], clouds: true },
    ...fin(boxes), props: [...kegs,
      { t: 'stall', x: -6, z: 36, c: '#e63946' }, { t: 'stall', x: 6, z: 46 - 6, c: '#f2c94c' }, { t: 'stall', x: -36, z: 22, c: '#7DF9FF' }, { t: 'stall', x: 36, z: 24, c: '#e63946' },
      { t: 'tree', x: -44, z: 78 - 4 - 4 }, { t: 'tree', x: 44, z: 70 }, { t: 'tree', x: -44, z: -70 }, { t: 'tree', x: 44, z: -62 }, { t: 'tree', x: -8, z: 8 }, { t: 'tree', x: 8, z: -8 },
      { t: 'truck', x: 30, z: 4, c: '#e63946' }, { t: 'hay', x: -40, z: 10 }, { t: 'hay', x: -32, z: -4 }, { t: 'jar', x: -18, z: -32 }, { t: 'jar', x: 20, z: -40 },
      { t: 'awning', x0: 40, z0: -46, x1: 45.5, z1: -43, y: 6.6, c: '#12233a' }, { t: 'awning', x0: -36, z0: -48 - 0 + 0, x1: -33, z1: -45, y: 3.0, c: '#e63946' },
      { t: 'sign', x: 0, y: 6.2, z: 61.05, w: 9, h: 1.6, rot: 0, text: 'RODÍZIO DO DOCÃO', bg: '#8b2f1c', fg: '#ffe7b0' },
      { t: 'sign', x: -30, y: 6.4, z: -23.55 + 0.0 - 0.0, w: 6, h: 1.4, rot: Math.PI, text: 'A · ESPETO', bg: '#8b2f1c', fg: '#ffe7b0' },
      { t: 'sign', x: 30, y: 6.4, z: -23.55, w: 6, h: 1.4, rot: Math.PI, text: 'B · COSTELA', bg: '#12233a', fg: '#7DF9FF' },
      { t: 'sign', x: -20, y: 5.5, z: 21.99 + 0.07, w: 6, h: 1.2, rot: 0, text: 'AÇOUGUE', bg: '#8b2f1c', fg: '#ffe7b0' },
      { t: 'sign', x: 20, y: 5.5, z: 22.06, w: 6, h: 1.2, rot: 0, text: 'PÃO DE ALHO', bg: '#6b4423', fg: '#ffe7b0' },
      { t: 'sign', x: 0, y: 5.0, z: -28.94, w: 6, h: 1.2, rot: 0, text: 'COZINHA', bg: '#3a3a40', fg: '#ffd27a' },
      { t: 'banner', x: 0, y: 5.5, z: -58.45, c: '#2f80ed', rot: 0 }, { t: 'banner', x: 12, y: 5.5, z: 59.95, c: '#e63946', rot: Math.PI }],
    spawns: [...spA.slice(0, 5), ...spD.slice(0, 5), [-40, 40], [40, 40], [0, 10 + 8], [-32, -10], [32, -10], [-40, -36], [42, -39], [0, -40]],
    bomb: { sites: [[-30, 0, -42], [30, 0, -42]], atk: spA, def: spD },
    pickups: [['health', -36, 52], ['health', 36, 52], ['health', 0, 20], ['health', -20, -4, H], ['health', -30, -56], ['health', 31, -52.5, 1.2],
      ['ammo', 0, 56], ['ammo', -40, 0], ['ammo', 40, 0], ['ammo', 0, -44], ['ammo', -16, 55, H], ['ammo', 20, 30, H],
      ['grenade', -33, 31], ['grenade', 35, 30], ['grenade', 0, -18], ['grenade', -40, -50.5, H], ['grenade', 0, 66], ['grenade', 0, -66]],
    // Invasão: mais caixas de munição espalhadas (perto dos spawns, no meio e pelas pontas). Só na Invasão (a Bomba usa o Rodízio com as caixas normais).
    invPickups: [['ammo', 7, 1], ['ammo', -27, -29], ['ammo', 27, -29], ['ammo', -9, 31], ['ammo', -17, 9], ['ammo', -19, -49], ['ammo', 19, -49], ['ammo', -9, -9], ['ammo', 7, -27], ['ammo', 23, -7], ['ammo', -11, -25], ['ammo', 3, 41], ['ammo', 33, 75], ['ammo', 41, -71], ['ammo', -37, -73], ['ammo', -37, 75], ['ammo', 15, -73], ['ammo', -13, -73], ['ammo', 11, 75], ['ammo', -11, 75], ['ammo', 41, -43], ['ammo', -35, 19]],
    showcase: [0, 0, 30], view: [0, 0, 58, 0, -0.02], openMax: 8, laneMin: 35,
    test: { stairs: { from: [-23, 0, 51.5], to: [-23, H, 59], level: H }, under: { from: [-26.5, 0, 48], to: [-20.5, 0, 48], ceil: 3.2 }, roof: { from: [-15.5, H, 52], to: [-15.5, 2 * H, 44.2], level: 2 * H } },
  });
}

export const BOMB_MAP = 'rodizio'; // mapa padrão do modo Bomba (menu, criar sala, lobby)
// ---------- 🎃 Fazenda Mal-Assombrada (feito pro Modo Invasão: noite de Halloween) ----------
//  Casarão de dois andares no meio (escada pro 1º andar e pro telhado), celeiro velho a noroeste, cemitério com mausoléu
//  a nordeste, capela em ruínas a sudoeste e milharal a sudeste. Os zumbis saem da névoa pelas bordas.
{
  const H = 3.5, boxes = [], props = [];
  const wood = '#5a3e2b', wood2 = '#4a3222', roofC = '#3a2a3e', roofC2 = '#2e2032', stone = '#7d7a72', stone2 = '#6a675f', tomb = '#8c8a85', moss = '#556b2f', corn = '#b59a3a', corn2 = '#a08a30', hayC = '#c9a64a';
  const casa = { wall: '#6b5844', wall2: '#5e4c3a', inner: '#7a6650', floor: '#4a3a2c', roof: roofC, roof2: roofC2, stair: wood, trim: '#2a1d14' };
  // casarão (meio)
  boxes.push(...building(-9, -7, 9, 7, { col: casa, floors: 2,
    ops: [{ s: 'n', a: -1.2, b: 1.2 }, { s: 's', a: -1.2, b: 1.2 }, { s: 'w', a: -1, b: 1 }, { s: 'e', a: -1, b: 1 },
      { s: 'n', a: -7, b: -4.5, k: 'win' }, { s: 'n', a: 4.5, b: 7, k: 'win' }, { s: 's', a: -7, b: -4.5, k: 'win' }, { s: 's', a: 4.5, b: 7, k: 'win' },
      ...['n', 's'].flatMap((q) => [{ s: q, a: -6, b: -2.5, f: 1, k: 'win', lo: 0.9 }, { s: q, a: 2.5, b: 6, f: 1, k: 'win', lo: 0.9 }]), ...['w', 'e'].map((q) => ({ s: q, a: -2, b: 2, f: 1, k: 'win', lo: 0.9 }))],
    stairs: [{ f: 0, r: [-8, -6.5, -2, -4.5], axis: 'x', dir: 1 }, { f: 1, r: [2, 4.5, 8, 6.5], axis: 'x', dir: -1 }] }));
  boxes.push(B(-9.6, 7, 9.6, 9.5, 0.3, wood2, 0), B(-9.6, 9.2, -9.3, 9.5, 2.6, wood), B(9.3, 9.2, 9.6, 9.5, 2.6, wood), B(-9.8, 7, 9.8, 9.8, 0.25, roofC, 2.6)); // varanda
  boxes.push(crate(-6, 3, 1.4, 1.0, '#7a5a3a'), crate(6, -3, 1.2, 1.2, '#7a5a3a'), crate(5, 2, 1.0, 0.9, '#7a5a3a', H), crate(-5, 1, 1.4, 0.9, '#7a5a3a', H));
  // celeiro velho (noroeste): portão largo pro sul, porta a leste, fardos dentro
  boxes.push(...building(-37, -37, -21, -23, { col: { wall: '#6e2f25', wall2: '#5e271f', floor: '#4a3a2c', roof: '#3a1f1a', roof2: '#2e1814' }, floors: 1, H: 5,
    ops: [{ s: 's', a: -31, b: -27, k: 'wide' }, { s: 'e', a: -31, b: -29 }, { s: 'n', a: -34, b: -31, k: 'win', lo: 2, hi: 3.4 }, { s: 'w', a: -32, b: -28, k: 'win', lo: 2, hi: 3.4 }], parapet: 0 }));
  boxes.push(B(-35.5, -35.5, -32, -33, 1.2, hayC), B(-35.5, -33, -33.5, -31, 1.2, hayC), B(-25, -35.5, -22.5, -33, 2.4, hayC), crate(-24, -27, 1.6, 1.4, '#7a5a3a'));
  // cemitério (nordeste): mureta com portões, lápides, cruzes e o mausoléu
  boxes.push(...wallX(15, 39, -13.5, 0.5, 1.1, stone, [{ a: 22, b: 25, y0: 0, y1: 9 }, { a: 31, b: 33, y0: 0, y1: 9 }]));
  boxes.push(...wallZ(-39, -13.5, 15, 0.5, 1.1, stone, [{ a: -30, b: -27, y0: 0, y1: 9 }]));
  for (let x = 18.5; x <= 36; x += 3.5) for (let z = -34; z <= -17; z += 4) {
    if (x > 25 && x < 35 && z < -27) continue; // espaço do mausoléu
    if ((Math.round(x * 3 + z) % 3) === 0) { boxes.push(B(x - 0.09, z - 0.09, x + 0.09, z + 0.09, 1.5, stone2), B(x - 0.45, z - 0.09, x + 0.45, z + 0.09, 0.16, stone2, 0.95)); }
    else boxes.push(B(x - 0.5, z - 0.16, x + 0.5, z + 0.16, 1.05, tomb), B(x - 0.55, z + 0.25, x + 0.55, z + 1.6, 0.14, moss));
  }
  boxes.push(...building(26, -38, 34, -30, { col: { wall: '#8d8a82', wall2: '#7d7a72', floor: '#5a5650', roof: '#4a4744', roof2: '#3a3836' }, floors: 1, H: 3.8,
    ops: [{ s: 's', a: 29, b: 31 }], parapet: 0.6 }));
  boxes.push(B(28.5, -30, 31.5, -29.4, 0.25, stone, 0), B(27.6, -29.6, 28.2, -29.0, 3.9, stone), B(31.8, -29.6, 32.4, -29.0, 3.9, stone));
  // capela em ruínas (sudoeste): sem telhado, paredes com janelões
  boxes.push(...building(-35, 17, -23, 33, { col: { wall: '#9a9488', wall2: '#8a8478', floor: '#5a5650' }, floors: 1, H: 4.6, roof: false,
    ops: [{ s: 'n', a: -30.2, b: -27.8 }, { s: 'e', a: 24, b: 26 }, { s: 'w', a: 21, b: 24, k: 'win', lo: 1.4, hi: 3.6 }, { s: 'w', a: 27, b: 30, k: 'win', lo: 1.4, hi: 3.6 }, { s: 'e', a: 28, b: 31, k: 'win', lo: 1.4, hi: 3.6 }] }));
  boxes.push(B(-31, 29.5, -27, 31, 1.0, stone2), B(-29.15, 30, -28.85, 30.3, 2.6, stone2, 1.0), B(-29.9, 30, -28.1, 30.3, 0.25, stone2, 2.8)); // altar e cruz
  for (const z of [21, 24, 27]) boxes.push(B(-33, z, -30.5, z + 0.6, 0.55, wood), B(-27.5, z, -25, z + 0.6, 0.55, wood)); // bancos
  // poço e carroça
  boxes.push(B(-14, 15, -12, 17, 0.9, stone), B(-14.1, 15.8, -13.9, 16.2, 2.3, wood), B(-12.1, 15.8, -11.9, 16.2, 2.3, wood), B(-14.4, 15.4, -11.6, 16.6, 0.2, roofC, 2.3));
  boxes.push(B(9, 15, 13, 17.2, 1.0, wood), B(9, 15, 13, 15.2, 1.6, wood2, 1.0), B(9, 17, 13, 17.2, 1.6, wood2, 1.0), crate(11, 16.1, 1.2, 1.0, hayC, 1.0));
  // milharal (sudeste): fileiras com corredores
  for (let z = 16.5, r = 0; z <= 37; z += 2.8, r++) for (let x = 16 + (r % 2) * 2.2; x < 38.5; x += 6) boxes.push(B(x, z, Math.min(38.5, x + 4), z + 0.7, 2.3, r % 2 ? corn : corn2));
  // cercas, fardos e caixotes pelo campo
  const fence = (x0, z0, x1, z1) => { boxes.push(B(x0, z0, x1, z1, 1.1, wood)); };
  fence(-19, -12, -12, -11.8); fence(-19, 11.8, -12, 12); fence(12, -12, 19, -11.8); fence(-4, 21, 4, 21.2); fence(-4, -21.2, 4, -21); fence(-24, -4, -23.8, 4); fence(23.8, -4, 24, 4);
  boxes.push(crate(-16, -4, 1.6, 1.4, hayC), crate(16, 5, 1.6, 1.4, hayC), crate(-6, -17, 1.4, 1.2, '#7a5a3a'), crate(7, -17, 1.6, 1.6, hayC), crate(-21, 9, 1.4, 1.2, '#7a5a3a'), crate(20, -8, 1.4, 1.2, '#7a5a3a'));
  boxes.push(crate(0, 27, 1.6, 1.4, hayC), crate(-8, 33, 1.4, 1.2, '#7a5a3a'), crate(30, 0, 1.6, 1.4, hayC), crate(-32, 6, 1.6, 1.4, hayC), crate(-10, -30, 1.6, 1.4, hayC), crate(6, -33, 1.4, 1.2, '#7a5a3a'));
  // espantalhos (poste + braço)
  for (const [x, z] of [[-15, 24], [24, 10], [-26, -12], [6, 36]]) boxes.push(B(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 2.5, wood2), B(x - 0.9, z - 0.07, x + 0.9, z + 0.07, 0.14, wood2, 1.85));
  props.push({ t: 'tree', x: -40, z: 0 }, { t: 'tree', x: 40, z: -4 }, { t: 'tree', x: -4, z: -40 }, { t: 'tree', x: 2, z: 40 }, { t: 'tree', x: -18, z: -18 }, { t: 'tree', x: 18, z: -6 }, { t: 'tree', x: -40, z: 38 }, { t: 'tree', x: 40, z: -40 }, { t: 'tree', x: 13, z: 40 });
  props.push({ t: 'hay', x: -18, z: 4 }, { t: 'hay', x: 17, z: -15 }, { t: 'hay', x: -6, z: 24 }, { t: 'hay', x: 27, z: 12 }, { t: 'keg', x: 10.5, z: 9 }, { t: 'keg', x: -10.5, z: 9 });
  props.push({ t: 'sign', x: 0, y: 4.0, z: 9.65, w: 8, h: 1.3, rot: 0, text: 'FAZENDA MAL-ASSOMBRADA', bg: '#2a1410', fg: '#ff9a2e' });
  props.push({ t: 'sign', x: 23.5, y: 2.2, z: -13.2, w: 4, h: 0.9, rot: 0, text: 'CEMITÉRIO', bg: '#1a1420', fg: '#c9a4ff' });
  MAPS.push({
    id: 'fazenda-assombrada', name: 'Fazenda Mal-Assombrada', desc: '🎃 Feito pro Modo Invasão: casarão de dois andares no meio, celeiro velho, cemitério com mausoléu, capela em ruínas e milharal. Os zumbis saem da névoa.',
    invasionOnly: true, size: [42, 42], wallH: 3, wallColor: ['#3a2f2a', '#2e2420'],
    palette: { sky: '#1a1030', fog: ['#2b1d40', 28, 110], hemi: ['#a89ad8', '#2e2438', 1.25], sun: ['#ffb27a', 1.0], ground: '#3e3b2c', tiles: ['#46422f', '#3a3728', 84, 28], stars: true,
      lights: [['#ff8a2a', 0, 2.4, 9.4, 6, 14], ['#a070ff', 30, 3, -26, 5, 16], ['#ff8a2a', -29, 3.2, -22, 4, 14], ['#ff8a2a', -29, 3, 30, 4, 14]] },
    ...fin(boxes), props,
    spawns: [[0, 12], [12, 0], [0, -12], [-12, 0], [9, 10], [-9, 10.5], [10, -10], [-10, -10], [3, 13], [-3, -13]],
    pickups: [['health', -14, 0], ['health', 14, 0], ['health', 0, -16], ['ammo', 0, 15], ['ammo', -20, -20], ['ammo', 17, 20], ['ammo', -4, 4, H], ['grenade', -20, 14], ['grenade', 20, -20], ['grenade', 4, -4, H],
      // Invasão: mais caixas de munição espalhadas (casarão, cemitério, milharal e pontas)
      ['ammo', 11, -13], ['ammo', -11, -9], ['ammo', 11, 7], ['ammo', -15, 9], ['ammo', -1, -9], ['ammo', -9, 15], ['ammo', -35, 37], ['ammo', 37, -31], ['ammo', 37, -3], ['ammo', 1, -35], ['ammo', -35, -3], ['ammo', -5, 37], ['ammo', -31, 19], ['ammo', 33, 29]],
    showcase: [0, 0, 15], view: [0, 1.6, 22, 0, -0.04], openMax: 9, laneMin: 30,
    test: { stairs: { from: [-7.8, 0, -5.5], to: [0, H, -5.5], level: H }, under: { from: [-6, 0, 2], to: [6, 0, 2], ceil: 3.2 }, roof: { from: [7.9, H, 5.5], to: [0, 2 * H, 5.5], level: 2 * H } },
  });
}

// ---------- HOTMILK: interiores dos dois blocos ----------
const HM = { H: 3.3, col: { wall: '#e7e1d6', wall2: '#d7c4a4', inner: '#cfc6b8', floor: '#d5cfc4', roof: '#3c4248', roof2: '#2c3238', stair: '#8d3a3a', trim: '#2f6b45' }, facade: '#c9c2b4', wood: '#c4a574', green: '#2f6b45', red: '#e23b3b' };

function hotmilkBloco1Interior() {
  const { H, col, wood, green, red } = HM, boxes = [];
  const link = [0, 1, 2].map((f) => ({ s: 'n', a: -6.6, b: 6.6, k: 'wide', f }));
  const wins = [-24, -8, 10, 24].map((x) => ({ s: 's', a: x - 1.6, b: x + 1.6, k: 'win', f: 1 }));
  boxes.push(...building(-31, -3, 31, 11.6, { col, floors: 3, H, t: 0.4, parapet: 0.9, ops: [...link, ...wins,
    { s: 's', a: -22, b: -18, k: 'win' }, { s: 's', a: -6, b: -2, k: 'win' }, { s: 's', a: 4, b: 8, k: 'win' }, { s: 's', a: 18, b: 22, k: 'win' },
    { s: 'w', a: 2, b: 4, k: 'win' }, { s: 'e', a: 2, b: 4, k: 'win' }],
  inner: [
    { axis: 'x', s0: -30.4, s1: -8.6, line: 1.05, ops: [{ a: -27.4, b: -25.6 }, { a: -19.8, b: -18 }, { a: -12.8, b: -11 }] },
    { axis: 'x', s0: 8.6, s1: 30.4, line: 1.05, ops: [{ a: 11.2, b: 13 }, { a: 18.6, b: 20.4 }, { a: 25.4, b: 27.2 }] },
    { axis: 'x', s0: -30.4, s1: -8.6, line: 4.35, ops: [{ a: -27.4, b: -25.6 }, { a: -19.8, b: -18 }, { a: -12.8, b: -11 }] },
    { axis: 'x', s0: 8.6, s1: 30.4, line: 4.35, ops: [{ a: 11.2, b: 13 }, { a: 18.6, b: 20.4 }, { a: 25.4, b: 27.2 }] },
    ...[-22.6, -15.2].flatMap((x) => [{ axis: 'z', s0: -2.6, s1: 0.85, line: x, ops: [] }, { axis: 'z', s0: 4.55, s1: 11.15, line: x, ops: [] }]),
    ...[16, 23.4].flatMap((x) => [{ axis: 'z', s0: -2.6, s1: 0.85, line: x, ops: [] }, { axis: 'z', s0: 4.55, s1: 11.15, line: x, ops: [] }]),
    { axis: 'z', s0: -2.5, s1: 11.15, line: -12, f: 1, ops: [{ a: 7.2, b: 9.2 }] },
    { axis: 'z', s0: -2.5, s1: 11.15, line: 14, f: 1, ops: [{ a: 7.2, b: 9.2 }] },
    { axis: 'z', s0: -2.5, s1: 11.15, line: -4, f: 2, ops: [{ a: -1.2, b: 0.8 }] },
    { axis: 'z', s0: -2.5, s1: 11.15, line: 16, f: 2, ops: [{ a: 8.4, b: 10.4 }] },
  ] }));
  boxes.push(...building(-8, -13, 8, -3, { col, floors: 3, H, t: 0.4, parapet: 0.9, noWall: ['s0', 's1', 's2'],
    ops: [{ s: 'n', a: -1.8, b: 1.8 }, { s: 'n', a: -6.2, b: -3.4, k: 'win' }, { s: 'n', a: 3.4, b: 6.2, k: 'win' },
      { s: 'w', a: -11, b: -8, k: 'win' }, { s: 'e', a: -6, b: -4, k: 'win' },
      { s: 'n', a: -5, b: -1.5, f: 1, k: 'win' }, { s: 'n', a: 1.5, b: 5, f: 1, k: 'win' },
      { s: 'w', a: -10, b: -6, f: 1, k: 'win' }, { s: 'e', a: -10, b: -6, f: 1, k: 'win' }],
    stairs: [{ f: 0, r: [-1.6, -11.5, 1.6, -4.0], axis: 'z', dir: 1 }, { f: 1, r: [2.0, -11.5, 5.2, -4.0], axis: 'z', dir: 1 }] }));
  boxes.push(B(-7.2, -3.7, 7.2, -2.3, 0.3, col.floor, H - 0.3), B(-7.2, -3.7, 7.2, -2.3, 0.3, col.floor, 2 * H - 0.3));
  boxes.push(B(-7.2, -8.7, -4.4, -7.3, 1.1, wood), B(-7.5, -9.4, -6.9, -5.2, 2.5, wood));
  boxes.push(B(-6.4, -11.5, -3.0, -10.6, 0.55, red), B(-6.6, -11.3, -5.6, -9.3, 0.75, red), B(-3.5, -11.3, -2.6, -9.4, 0.75, red));
  boxes.push(B(-5.4, -10.9, -4.0, -9.7, 0.85, green));
  boxes.push(B(6.45, -11.6, 7.25, -6.6, 2.9, green));
  boxes.push(B(-7.3, -6.3, -5.4, -4.3, 3 * H, '#2a2a2a'));
  for (const [x, z] of [[-28.2, -1.6], [-18.5, 7.2], [-13.2, 8.6], [12.5, 7.2], [27.2, -1.6], [25.5, 8.4]]) boxes.push(crate(x, z, 1.0, 1.05, wood));
  for (const x of [-20, -6, 10, 22]) boxes.push(B(x - 0.35, 1.35, x + 0.35, 1.9, 2.4, '#4a463f'));
  for (const [x, z, y] of [[-21, 7, H], [1, 6.5, H], [22, 7, H], [-14, 6, 2 * H], [6, 7, 2 * H], [22, 5.5, 2 * H]]) boxes.push(crate(x, z, 1.3, 1.15, wood, y));
  return {
    boxes,
    props: [
      { t: 'sign', x: 6.35, y: 2.15, z: -9.2, w: 3.4, h: 0.85, rot: Math.PI / 2, text: 'HOTMILK', bg: '#1e3d28', fg: '#ffffff' },
      { t: 'sign', x: 0, y: 2.4, z: -12.55, w: 2.6, h: 0.6, rot: 0, text: 'BLOCO 01', bg: '#2a2a2a', fg: '#ffffff' },
    ],
    spawns: [[-28, 2.7], [28, 2.7], [-25, 8.2], [19, 7.6], [-24.5, -1.6], [21, -1.6], [-3.2, -7.4], [6.8, -5.5],
      [-26, 8, H], [18, 5, H], [0, 2.7, H], [-18, 8, 2 * H], [6, 4, 2 * H], [22, 2.7, 2 * H]],
    pickups: [['health', 0.6, -12.15], ['health', 0, 2.7], ['health', -24, 7, H], ['health', 6, 3, 2 * H],
      ['ammo', -24, 8.4], ['ammo', 25, -1.5], ['ammo', 24, 6, H], ['ammo', -18, 4, 2 * H],
      ['grenade', 6.6, -5.0], ['grenade', -17, 8.5], ['grenade', 4, 8, H], ['grenade', 20, 8, 2 * H]],
    lights: [['#fff4dd', 0, 2.6, -8, 16, 28], ['#fff4dd', -18, 2.5, 2.7, 12, 18], ['#fff4dd', 18, 2.5, 2.7, 12, 18], ['#fff4dd', 0, 2.6 + H, 3, 14, 20], ['#fff6e0', 4, 2.6 + 2 * H, 4, 14, 18]],
    test: { stairs: { from: [0, 0, -12.4], to: [0, H, -3.7], level: H }, under: { from: [-24, 0, 2.7], to: [18, 0, 2.7], ceil: 3.0 }, roof: { from: [3.6, H, -12.2], to: [3.6, 2 * H, -3.7], level: 2 * H } },
  };
}
function hotmilkBloco2Interior() {
  const { H, col, wood, green, red } = HM, boxes = [];
  const linkH = [0, 1, 2].map((f) => ({ s: 'e', a: -8.2, b: 3.2, k: 'wide', f }));
  const linkS = [0, 1, 2].map((f) => ({ s: 'w', a: -8.2, b: 3.2, k: 'wide', f }));
  const doors = [{ a: -2.4, b: -0.8 }, { a: 5.6, b: 7.2 }, { a: 13.4, b: 15.0 }, { a: 18.0, b: 19.6 }];
  boxes.push(...building(-18, -11, -6.2, 4, { col, floors: 3, H, t: 0.4, parapet: 0.9,
    ops: [...linkH, { s: 'n', a: -15.4, b: -12.2 }, { s: 'w', a: -6, b: -3, k: 'win', f: 1 }, { s: 'w', a: 0.4, b: 2.6, k: 'win', f: 2 }],
    stairs: [{ f: 0, r: [-16.6, -7.2, -8.4, -4.0], axis: 'x', dir: 1 }, { f: 1, r: [-16.6, -2.0, -8.4, 1.2], axis: 'x', dir: 1 }] }));
  boxes.push(...building(-6.2, -9, 22, 13, { col, floors: 3, H, t: 0.4, parapet: 0.9,
    ops: [...linkS,
      { s: 's', a: -1, b: 3, k: 'win', f: 1 }, { s: 's', a: 8, b: 12, k: 'win', f: 1 }, { s: 's', a: 16, b: 20, k: 'win', f: 2 },
      { s: 'e', a: -2, b: 2, k: 'win' }, { s: 'e', a: 6, b: 10, k: 'win', f: 1 }, { s: 'n', a: 4, b: 8, k: 'win', f: 1 }],
    inner: [0, 1, 2].flatMap((f) => [
      { axis: 'x', s0: -5.4, s1: 21.4, line: -1.2, f, ops: doors },
      { axis: 'x', s0: -5.4, s1: 21.4, line: 4.6, f, ops: doors },
      { axis: 'z', s0: -8.5, s1: -1.05, line: 2.2, f, ops: [] },
      { axis: 'z', s0: -8.5, s1: -1.05, line: 9.2, f, ops: [] },
      { axis: 'z', s0: -8.5, s1: -1.05, line: 16.2, f, ops: [] },
      { axis: 'z', s0: 4.45, s1: 12.4, line: 0.4, f, ops: [] },
      { axis: 'z', s0: 4.45, s1: 12.4, line: 8.4, f, ops: [] },
      { axis: 'z', s0: 4.45, s1: 12.4, line: 15.4, f, ops: [] },
    ]).concat([
      { axis: 'z', s0: -1.35, s1: 4.75, line: 4.8, f: 1, ops: [{ a: 2.7, b: 4.3 }] },
      { axis: 'z', s0: -1.35, s1: 4.75, line: 13.2, f: 2, ops: [{ a: -0.8, b: 0.8 }] },
    ]) }));
  boxes.push(B(-7.05, -8.6, -5.35, 3.5, 0.3, col.floor, H - 0.3), B(-7.05, -8.6, -5.35, 3.5, 0.3, col.floor, 2 * H - 0.3));
  for (const y of [0, H, 2 * H]) boxes.push({ wp: [-7.4, y, 2.4] }, { wp: [-5.4, y, 2.4] }, { wp: [-7.5, y, -5.6] }, { wp: [-7.5, y, -0.4] });
  boxes.push(B(-17.6, -10.6, -16.2, -9.3, 1.1, wood), B(-16.2, -10.6, -15.2, -9.5, 1.05, green));
  boxes.push(B(-17.6, 3.05, -15.4, 3.6, 0.7, red));
  boxes.push(B(20.3, -8.6, 21.6, -6.4, 3 * H, '#2a2a2a'));
  for (const [x, z] of [[-1.2, -5.2], [6.2, -5.6], [12.4, -5.0], [18.6, -5.4], [-2.2, 8.2], [4.6, 9.0], [11.6, 8.4], [18.8, 9.2]]) {
    boxes.push(crate(x, z, 1.2, 1.1, wood), crate(x + 0.4, z + 0.3, 1.15, 1.1, wood, H), crate(x - 0.3, z - 0.2, 1.15, 1.1, wood, 2 * H));
  }
  for (const x of [-4.6, 3.2, 10.4, 16.0]) boxes.push(crate(x, -0.45, 1.0, 1.05, wood), crate(x, 3.95, 1.0, 1.05, wood));
  return {
    boxes,
    props: [{ t: 'sign', x: -13.8, y: 2.3, z: -10.45, w: 2.8, h: 0.7, rot: 0, text: 'BLOCO 02', bg: '#1e3d28', fg: '#ffffff' }],
    spawns: [[-16.2, 2.4], [-10, 2.4], [-3.2, 2.4], [3.2, 2.4], [10.2, 2.4], [17.2, 2.4], [-14.2, -8.8], [7.4, -4.2],
      [-13.2, 2.6, H], [1.2, 7.6, H], [14.0, -4.4, H], [18.4, 8.2, H],
      [-16.6, 2.8, 2 * H], [6.4, 7.4, 2 * H], [14.4, 2.6, 2 * H]],
    pickups: [['health', -14.4, -8.6], ['health', 6.0, 7.8, H], ['health', -3.6, 8.2, 2 * H],
      ['ammo', 17.0, -3.6], ['ammo', -3.4, -5.2, H], ['ammo', 16.4, 8.6, 2 * H],
      ['grenade', 4.2, -5.4], ['grenade', 16.6, 2.6, H], ['grenade', 8.4, -4.8, 2 * H]],
    lights: [['#fff4dd', -12, 2.6, -4, 16, 22], ['#fff4dd', 8, 2.6, 2, 18, 24], ['#fff4dd', 8, 2.6 + H, 2, 16, 22], ['#fff6e0', 4, 2.6 + 2 * H, 4, 16, 20]],
    test: { stairs: { from: [-17.05, 0, -5.6], to: [-7.5, H, -5.6], level: H }, roof: { from: [-17.05, H, -0.4], to: [-7.5, 2 * H, -0.4], level: 2 * H }, under: { from: [-16, 0, 2.4], to: [19, 0, 2.4], ceil: 3.0 } },
  };
}
// yaw=true gira a fachada sul para o leste; depois translada
function placeHotmilk(core, dx, dz, yaw) {
  const pt = (x, z) => { const q = yaw ? yawXZ(x, z) : [x, z]; return [q[0] + dx, q[1] + dz]; };
  const seg = (s) => {
    const a = pt(s.from[0], s.from[2]), b = pt(s.to[0], s.to[2]);
    const out = { from: [a[0], s.from[1], a[1]], to: [b[0], s.to[1], b[1]] };
    if (s.level != null) out.level = s.level; if (s.ceil != null) out.ceil = s.ceil; return out;
  };
  const prop = (p) => { const q = pt(p.x, p.z); return { ...p, x: q[0], z: q[1], rot: (p.rot || 0) - (yaw ? Math.PI / 2 : 0) }; };
  const light = (L) => { const q = pt(L[1], L[3]); return [L[0], q[0], L[2], q[1], L[4], L[5]]; };
  const spawn = (s) => { const q = pt(s[0], s[1]); return s.length > 2 ? [q[0], q[1], s[2]] : q; };
  const pickup = (p) => { const q = pt(p[1], p[2]); const o = [p[0], q[0], q[1]]; if (p.length > 3) o.push(p[3]); return o; };
  let boxes = core.boxes;
  if (yaw) boxes = yawBoxes(boxes);
  boxes = moveBoxes(boxes, dx, dz);
  const test = {}; for (const k of Object.keys(core.test)) test[k] = seg(core.test[k]);
  return { boxes, props: core.props.map(prop), spawns: core.spawns.map(spawn), pickups: core.pickups.map(pickup), lights: core.lights.map(light), test };
}
// espelha no Z em torno de cz: a fachada leste continua leste, as pontas norte/sul trocam
function flipHotmilkZ(part, cz) {
  const mz = (z) => 2 * cz - z;
  const seg = (s) => {
    const out = { from: [s.from[0], s.from[1], mz(s.from[2])], to: [s.to[0], s.to[1], mz(s.to[2])] };
    if (s.level != null) out.level = s.level; if (s.ceil != null) out.ceil = s.ceil; return out;
  };
  const pickup = (p) => { const o = [p[0], p[1], mz(p[2])]; if (p.length > 3) o.push(p[3]); return o; };
  const test = {}; for (const k of Object.keys(part.test)) test[k] = seg(part.test[k]);
  return {
    boxes: moveBoxes(mirrorZ(moveBoxes(part.boxes, 0, -cz)), 0, cz),
    props: part.props.map((p) => ({ ...p, z: mz(p.z), rot: Math.PI - (p.rot || 0) })),
    spawns: part.spawns.map((s) => (s.length > 2 ? [s[0], mz(s[1]), s[2]] : [s[0], mz(s[1])])),
    pickups: part.pickups.map(pickup), lights: part.lights.map((L) => [L[0], L[1], L[2], mz(L[3]), L[4], L[5]]), test,
  };
}

// ---------- 8) HOTMILK ----------
// Vista de cima: Bloco 01 ao norte, Bloco 02 ao sul, recuado para dentro do estacionamento.
// A praça entre os blocos abre para o leste, onde está o portão e a rua da frente.
// O Bloco 02 é espelhado no Z para a entrada continuar de frente para a praça.
{
  const b1 = placeHotmilk(hotmilkBloco1Interior(), 4, 31, true);
  const b2 = flipHotmilkZ(placeHotmilk(hotmilkBloco2Interior(), -12, -39, true), -37);
  const boxes = [...b1.boxes, ...b2.boxes];
  const props = [...b1.props, ...b2.props,
    { t: 'street', x0: -46, z0: -64, x1: -16, z1: 64 },
    { t: 'street', x0: -16, z0: -66, x1: 6, z1: -15 },
    { t: 'street', x0: 41.2, z0: -64, x1: 47.4, z1: 64 },
    { t: 'sign', x: 41.05, y: 3.85, z: -8, w: 6.4, h: 1.15, rot: Math.PI / 2, text: 'HOTMILK', bg: '#1e3d28', fg: '#ffffff' },
    { t: 'sign', x: -18.2, y: 2.4, z: -8, w: 4.2, h: 0.7, rot: -Math.PI / 2, text: 'ESTACIONAMENTO', bg: '#2a2a2a', fg: '#ffffff' },
  ];
  const gate0 = -15, gate1 = -3, p0 = 28.5, p1 = 33.5;
  boxes.push(B(39.7, -66, 40.3, gate0, 2.3, HM.facade), B(39.7, gate1, 40.3, p0, 2.3, HM.facade), B(39.7, p1, 40.3, 66, 2.3, HM.facade));
  boxes.push(B(39.35, gate0 - 1.15, 40.7, gate0, 3.35, HM.green), B(39.35, gate1, 40.7, gate1 + 1.15, 3.35, HM.green));
  boxes.push(B(39.25, gate0 - 1.15, 40.75, gate1 + 1.15, 0.35, HM.green, 2.95));
  // portão menor do Bloco 01, na mesma parede da frente, alinhado com a porta (z ~31)
  boxes.push(B(39.42, p0 - 0.42, 40.62, p0, 2.05, HM.green), B(39.42, p1, 40.62, p1 + 0.42, 2.05, HM.green));
  boxes.push(B(39.32, p0 - 0.42, 40.72, p1 + 0.42, 0.16, HM.green, 2.05));
  for (const [x, z] of [[-2, -8.5], [8, -8.5], [14, -10.8], [2, -4.8], [-6, -11.8]]) boxes.push(B(x - 0.7, z - 0.7, x + 0.7, z + 0.7, 1.15, '#d7c4a4'));
  boxes.push(B(-1.2, -10.5, 1.5, -9.85, 0.48, HM.wood), B(5.6, -6.9, 8.2, -6.25, 0.48, HM.wood));
  // a fachada leste recua fora do hall: fileira de canteiros pra não abrir um campo na frente
  for (let z = -60; z <= 60; z += 8) {
    if ((z > 26 && z < 36) || (z > -18 && z < 2)) continue;
    boxes.push(B(19.2, z - 0.55, 20.6, z + 0.55, 1.15, '#d7c4a4'));
  }
  for (let z = 4; z <= 20; z += 8) boxes.push(B(11.2, z - 0.55, 12.6, z + 0.55, 1.15, '#d7c4a4'));
  for (let z = 44; z <= 60; z += 8) boxes.push(B(11.2, z - 0.55, 12.6, z + 0.55, 1.15, '#d7c4a4'));
  for (let z = -54; z <= -32; z += 8) boxes.push(B(16.3, z - 0.55, 17.7, z + 0.55, 1.15, '#cfc6b8'));
  for (const [x, z] of [[-18.4, -24], [-18.4, -19], [-12, -12.4], [-12, -4.2], [7.4, -14.2], [7.4, -27.2], [13.2, -15.2], [13.2, -26.5], [26, 27.2], [26, 34.8], [33, 27.2], [33, 34.8]]) boxes.push(B(x - 0.6, z - 0.55, x + 0.6, z + 0.55, 1.15, '#d7c4a4'));
  // círculo de toras na praça, de frente pro portão: um vão entre cada tora
  {
    const cx = 27, cz = -9, n = 6, lr = 4.0, br = 5.7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      props.push({ t: 'log', x: cx + Math.cos(a) * lr, z: cz + Math.sin(a) * lr, r: 0.55, h: [6.4, 5.8, 6.6, 6.0, 6.5, 5.9][i] });
      props.push({ t: 'bench', x: cx + Math.cos(a) * br, z: cz + Math.sin(a) * br, rot: Math.PI / 2 - a });
    }
    props.push({ t: 'flowerbed', x: cx, z: cz });
  }
  for (let z = -60; z <= 60; z += 10) for (const x of [25, 33]) {
    if (Math.hypot(x - 17, z - 31) < 11 || Math.hypot(x - 40, z - 31) < 9 || Math.hypot(x + 1, z + 21) < 7) continue;
    if (Math.hypot(x - 27, z + 9) < 9) continue;
    if (z > -16 && z < 2 && x < 30) continue;
    props.push({ t: 'tree', x, z });
  }
  for (let z = -60; z <= 60; z += 9) {
    if (z > -15 && z < -2) continue;
    if (z <= -16 && z >= -58) continue;
    props.push({ t: 'tree', x: -15.5, z });
  }
  const carColors = ['#f4f1ea', '#d5dae0', '#3c4654', '#8d3a3a', '#2c4d6e', '#c4a574', '#6d6a64'];
  let ci = 0;
  const inB2 = (x, z) => (z > -58.2 && z < -28.2 && x > -26.4 && x < -1.6) || (z > -30.2 && z < -15.6 && x > -17.4 && x < 1.2);
  const inU = (x, z) => x > -46.8 && x < -27.5 && z > 19 && z < 46;
  const carAt = (x, z) => {
    if (inB2(x, z) || inB2(x, z - 1.9) || inB2(x, z + 1.9) || inB2(x - 0.8, z) || inB2(x + 0.8, z)) return;
    if (inU(x, z) || inU(x, z - 1.9) || inU(x, z + 1.9)) return;
    props.push({ t: 'car', x, z, c: carColors[ci % carColors.length], rot: ci % 2 ? Math.PI : 0 });
    ci++;
  };
  for (const x of [-40.5, -31.6, -22.8]) for (let z = -58; z <= 62; z += 6.5) carAt(x, z);
  for (let z = -56; z <= -18; z += 6.5) if (z < -26 || z > -16) carAt(4.2, z);
  for (let x = -22; x <= 4; x += 3.6) carAt(x, -63);
  // rua em U no fundo do estacionamento: entrada e saída, cancela fechada nos dois sentidos
  {
    const arm = (z0, z1) => {
      let i = 0;
      for (let z = z0; z < z1 - 0.02; z += 0.42) {
        boxes.push(B(-40.15, z, -39.95, Math.min(z + 0.42, z1), 0.16, i++ % 2 ? '#f4f1ea' : '#e23b3b', 0.9));
      }
    };
    boxes.push(B(-46.2, 42.6, -28.2, 43.0, 0.22, '#d9d4cc'), B(-46.2, 21.6, -28.2, 22.0, 0.22, '#d9d4cc'), B(-46.2, 22.0, -45.8, 42.6, 0.22, '#d9d4cc'));
    boxes.push(B(-42.3, 30.4, -42.05, 34.4, 2.25, HM.green), B(-38.3, 30.4, -38.05, 34.4, 2.25, HM.facade));
    boxes.push(B(-42.3, 30.4, -38.05, 30.65, 2.25, HM.facade), B(-42.3, 34.15, -38.05, 34.4, 2.25, HM.facade));
    boxes.push(B(-42.45, 30.25, -37.9, 34.55, 0.18, '#3c4248', 2.25));
    boxes.push(B(-40.45, 42.15, -39.7, 42.6, 1.2, '#2a2a2a'), B(-40.45, 21.6, -39.7, 22.15, 1.2, '#2a2a2a'));
    arm(34.4, 42.2);
    arm(22.15, 30.4);
    boxes.push(B(-30.7, 37.6, -29.5, 38.8, 1.15, '#d7c4a4'), B(-30.7, 25.2, -29.5, 26.4, 1.15, '#d7c4a4'));
    props.push({ t: 'sign', x: -42.55, y: 1.7, z: 32.4, w: 1.7, h: 0.4, rot: -Math.PI / 2, text: 'CATRACA', bg: '#2a2a2a', fg: '#ffffff' });
  }
  for (const z of [-48, -30, -8.5, 12, 28, 46]) boxes.push({ wp: [30, 0, z] }, { wp: [44, 0, z] });
  boxes.push({ wp: [0, 0, -8.5] }, { wp: [-16, 0, -8.5] }, { wp: [-36, 0, -8.5] }, { wp: [-36, 0, -36] }, { wp: [-36, 0, 50] });
  MAPS.push({
    id: 'hotmilk', name: 'HOTMILK', desc: 'Campus inteiro: Bloco 01 ao norte, Bloco 02 ao sul, estacionamento atrás, praça entre os blocos e portão na frente.',
    size: [48, 68], wallH: 4.5, wallColor: [HM.facade, '#b7b09f'], laneMin: 35,
    palette: { sky: '#9ec8ea', fog: ['#c5d3df', 70, 190], hemi: ['#ffffff', '#b7a48a', 1.45], sun: ['#fff6e4', 1.55], ground: '#c5bfb2', tiles: ['#d7d1c4', '#c9c2b4', 64, 16], clouds: true, stars: false,
      lights: [...b1.lights, ...b2.lights, ['#fff4dd', 8, 3.2, -8.5, 18, 26], ['#fff4dd', 30, 3.4, -8, 16, 24], ['#fff6e0', 40.2, 3.5, -8, 14, 22]] },
    ...fin(boxes), props,
    spawns: [...b1.spawns, ...b2.spawns, [44, -8], [44, -28], [44, 24], [30, -40], [28, 16], [32, -8.5], [4, -8.5], [-6, -9], [-36, -40], [-36, 0], [-27, 32], [-27, -16]],
    pickups: [...b1.pickups, ...b2.pickups, ['health', 6, -8.5], ['health', -34, 50], ['ammo', 30, -46], ['ammo', -27, -36], ['grenade', 34, -8], ['grenade', -36, -8]],
    showcase: [8, 0, -8.5], view: [44, 0, -8, Math.PI / 2, -0.04], openMax: 7, test: b1.test,
    // Bomba: Ataque nasce no fundo norte (rua e estacionamento atrás do Bloco 01, ~15–21 s até um site), Defesa no estacionamento sul (~6–9 s);
    // A no estacionamento sudoeste, B no pátio sudeste. O Bloco 02 fica entre os dois sites.
    bomb: { sites: [[-36, 0, -36], [30, 0, -40]], atk: [[-27, 62], [-36, 62], [-10, 64], [4, 64], [12, 64], [29, 58], [38, 62], [44, 62]], def: [[-12, -66], [-4, -66], [2, -66], [-8, -60.5], [-14, -60.5], [0, -60.5]] },
  });
}

// =====================================================================
// MAPA 8: Pátio Ferrugem. Rust do Call of Duty, em escala menor:
// pátio quadrado e curto. A torre do meio é a coisa mais alta (meio em 6 m, topo em 13 m).
// Sobe pela rampa laranja do sul (o duto de exaustão) até o meio, e por outra rampa até o topo.
// Em volta: bomba a noroeste, duto ao norte (dá para andar em cima e por baixo),
// contêineres, tanques a leste e uma salinha a sudoeste.
{
  const boxes = [];
  const steel = '#5a626a', rust = '#8d5a34', pipe = '#c4783a', conc = '#b7b1a6', sand = '#c4a574';
  const redC = '#c44536', blueC = '#3d6ea8';
  const fenceOp = [door(-14, -10, 2.2), door(-2, 2, 2.2), door(10, 14, 2.2)];
  boxes.push(...wallX(-20, 20, -20.5, 0.28, 1.5, sand, fenceOp));
  boxes.push(...wallX(-20, 20, 20.5, 0.28, 1.5, sand, fenceOp));
  boxes.push(...wallZ(-20, 20, -20.5, 0.28, 1.5, sand, fenceOp));
  boxes.push(...wallZ(-20, 20, 20.5, 0.28, 1.5, sand, fenceOp));

  // pernas da torre, mais altas que o topo, para o mastro aparecer de longe
  boxes.push(B(-4.6, 2.9, -3.4, 4.05, 16.6, steel), B(3.3, 2.9, 4.5, 4.05, 16.6, steel));
  boxes.push(B(-4.6, -4.3, -3.4, -3.15, 16.6, steel), B(3.3, -4.3, 4.5, -3.15, 16.6, steel));
  // meio da torre, em 6 m. A borda sul para exatamente onde a rampa chega.
  boxes.push(B(-5.1, -4.55, 4.7, 4.15, 0.4, '#6a727a', 5.6));
  boxes.push(B(-4.5, -2.2, -3.4, 0.4, 1.15, steel, 6));
  // passarela leste, ao sul da perna, até o pé da rampa de cima
  boxes.push(B(4.7, -2.45, 13.5, 0.35, 0.35, '#5c656e', 5.65));
  boxes.push(B(12.8, -7.35, 13.5, -2.45, 0.35, '#5c656e', 5.65));
  // rampa do sul: chão → meio. Sobe andando para o norte.
  boxes.push(R(-1.65, 4.15, 1.65, 12.4, 0, 6, 'z', -1, pipe));
  // rampa do lado: meio → topo. Longa de propósito: se for íngreme, o corpo bate na quina da laje.
  boxes.push(R(3.55, -7.25, 13.5, -4.85, 6, 13, 'x', -1, pipe));
  boxes.push(B(-3.1, -2.4, 2.65, 2.7, 0.35, '#4e565e', 12.65));
  boxes.push(B(-0.6, -7.25, 3.55, -2.4, 0.35, '#4e565e', 12.65));
  boxes.push(B(-2.7, 0.8, -1.4, 2.2, 1.15, steel, 13));
  boxes.push(B(-0.4, -0.4, 0.4, 0.4, 5.2, '#3e454c', 13)); // mastro, topo em 18 m
  boxes.push(
    { wp: [0, 3, 8.4] }, { wp: [0, 6, 2.2] }, { wp: [3.2, 6, -1.2] }, { wp: [13.1, 6, -1.2] },
    { wp: [13.1, 6, -6.05] }, { wp: [8, 9.9, -6.05] }, { wp: [1.6, 13, -5.2] }, { wp: [1.4, 13, 1] },
  );

  // bomba de óleo (noroeste), mais baixa que a torre
  boxes.push(B(-18.2, -19.2, -10.2, -15.4, 0.35, rust, 4.65));
  for (const [x, z] of [[-17.6, -18.7], [-11.5, -18.7], [-17.6, -16.5], [-11.5, -16.5]]) boxes.push(B(x, z, x + 0.9, z + 0.9, 5.1, '#4a4038'));
  boxes.push(B(-16.4, -18.5, -13.4, -16.4, 1.25, '#6a4a30', 5));
  boxes.push(R(-10.2, -18.6, -4.2, -16.2, 0, 5, 'x', -1, rust));
  boxes.push({ wp: [-14, 5, -17.2] }, { wp: [-7, 2.4, -17.4] });

  // duto do norte: anda em cima e passa por baixo. Liga na bomba.
  boxes.push(B(-16.5, -13.6, 11.2, -11.6, 0.42, pipe, 2.95));
  boxes.push(R(-16, -15.4, -12.2, -13.6, 3.37, 5, 'z', -1, pipe));
  boxes.push(R(11.2, -13.6, 16.4, -11.6, 0, 3.37, 'x', -1, pipe));
  for (const x of [-14, -9, -4, 1, 6]) boxes.push(B(x, -13.55, x + 0.4, -13.15, 1.1, steel, 3.37));
  boxes.push({ wp: [-8, 3.37, -12.6] }, { wp: [2, 3.37, -12.6] }, { wp: [13.5, 1.6, -12.6] });

  // geradores ao sul da torre, um de cada lado da rampa
  boxes.push(B(-9.2, 6.2, -4.0, 10.2, 2.15, '#c8962e'));
  boxes.push(B(4.0, 6.0, 8.8, 9.6, 2.15, '#c8962e'));

  // contêineres: vermelho a leste, azul a oeste
  boxes.push(B(13.2, 1.5, 18.4, 6.2, 2.55, redC));
  boxes.push(R(13.6, 6.2, 17.8, 9.4, 0, 2.55, 'z', -1, conc));
  boxes.push(B(-18.6, 2, -13.2, 7.2, 2.55, blueC));
  boxes.push(R(-13.2, 2.4, -10, 6.6, 0, 2.55, 'x', -1, conc));

  // salinha coberta (sudoeste): o interior do mapa
  boxes.push(...building(-18.5, 8.2, -9.2, 15.8, {
    col: { wall: '#d2c2a4', wall2: '#c4b496', floor: '#8d8a84', roof: '#6e5438', roof2: '#5c4630', stair: rust, inner: '#e4d8c4', trim: '#6e5438' },
    floors: 1, H: 3.3,
    ops: [{ s: 'n', a: -15.2, b: -12.2 }, { s: 'e', a: 10.4, b: 13.2 }],
  }));

  // caixotes baixos para ninguém ficar no meio do areal
  boxes.push(B(6.2, 2.2, 7.6, 4.8, 2.45, conc), B(-8.2, -6.4, -6.6, -4.4, 2.45, conc), B(10.2, 7.4, 11.8, 9.6, 3.4, steel));
  boxes.push(B(8.4, -10.6, 10.1, -8.5, 2.7, steel), B(-8.1, -1.2, -6.4, 1.4, 2.55, conc));
  for (const [x, z, h] of [[0, 16.2, 2.35], [7.5, 16.5, 2.35], [-7.2, 16.6, 2.35], [16.2, 12.5, 2.35], [17.4, -8.5, 2.35], [5, -15.6, 1.15], [-7, -16, 1.15], [-15.2, -4.5, 1.15], [-4, 15.6, 1.15], [6.2, 13.6, 1.15]]) {
    boxes.push(B(x - 0.6, z - 0.6, x + 0.6, z + 0.6, h, '#cbb892'));
  }

  const props = [
    { t: 'silo', x: 16.5, z: -8, r: 1.45, h: 5.2, c: '#8d8f86' },
    { t: 'silo', x: 18.2, z: -1.5, r: 1.3, h: 4.6, c: '#7e8680' },
    { t: 'truck', x: 4.5, z: 18.2, c: '#c44536' },
    { t: 'truck', x: 11.5, z: 18.2, c: '#3d6ea8' },
    { t: 'sign', x: 0, y: 3.1, z: -20.2, w: 5.4, h: 1.3, rot: 0, text: 'FERRUGEM', bg: '#c44536', fg: '#fff6e4' },
    { t: 'keg', x: -6, z: -9 }, { t: 'keg', x: 6, z: -9 }, { t: 'keg', x: 10, z: 4 }, { t: 'keg', x: -11, z: 0 }, { t: 'keg', x: 2, z: 15 },
  ];
  MAPS.push({
    id: 'patio-ferrugem', name: 'Pátio Ferrugem', desc: 'Pátio pequeno no estilo do Rust: a torre do meio é a mais alta, com rampa do chão até o topo.',
    size: [24, 24], wallH: 3, wallColor: ['#d7c49a', '#c9b48a'], navSpacing: 1.5, expMax: 0.36,
    palette: { ...DAY({ ground: '#e4cc90', tiles: ['#edd7a6', '#d8c08a', 56, 16] }), sky: '#8ec8ea', fog: ['#e7d7b0', 34, 88], hemi: ['#fff4e0', '#c4a36a', 1.55], sun: ['#fff6e4', 2.25] },
    ...fin(boxes), props,
    spawns: [[-18, -5], [2, -19], [12, -18.5], [19, -12], [19.2, 9], [-2, 19.2], [8, 14.5], [-15, 18.2], [-19.2, 2], [-6, 12.4], [18.4, 14.5], [-10, -9]],
    pickups: [['health', 0, 1.2, 6], ['health', 1.2, 0.4, 13], ['health', -14, -6], ['health', -2, 16.2],
      ['ammo', -12.2, -17.4, 5], ['ammo', 0, -12.6, 3.37], ['ammo', -6, 12.6], ['ammo', 15.6, 3.6, 2.55],
      ['grenade', -1.4, -0.6, 13], ['grenade', 0, -8.4], ['grenade', 8.5, -18.6], ['grenade', -13.2, -2]],
    showcase: [0, 0, 9], view: [15, 2.4, 17, 0.75, -0.22],
    test: {
      stairs: { from: [0, 0, 12], to: [0, 6, 2.2], level: 6 },
      roof: { from: [0, 6, 2.2], via: [[3.2, -1.2], [13.1, -1.2], [13.1, -6.05], [1.5, -6.05]], to: [1.4, 13, 1], level: 13 },
      under: { from: [-5, 0, -12.6], to: [5, 0, -12.6], ceil: 3.05 },
    },
  });
}


// ---------- 9) Estande do Docão (modo Treino: alvos que não atacam, só renascem) ----------
// Linha de tiro em z = 22 (os jogadores atiram pra -z). Raias separadas por muretas baixas:
//  A (oeste) distâncias 10/20/30/50 m · B alvos andando · C explosivos e arco · D faca e sabre (perto da linha).
//  Atrás da linha: área de renascimento (leste) e arena pequena de X1 (oeste).
// dummies: { name, x, z, y?, yaw?, move?: { amp, speed, ph } } (move = vai e volta no eixo X; speed = velocidade máxima m/s)
{
  const FIRE = 22, boxes = [], props = [];
  const wood = '#b5793e', wood2 = '#9c6b3a', stone = '#a8a29a', yel = '#f2c94c', red = '#e63946', white = '#fff4e0';
  const signAt = (x, z, text, bg, w = 3.2, h = 0.9, y = 2.3) => { props.push({ t: 'sign', x, y, z: z + 0.06, w, h, rot: 0, text, bg, fg: '#fff6e4' }); boxes.push(B(x - 0.1, z - 0.1, x + 0.1, z, y - h / 2, wood2)); };
  // linha de tiro: balcão baixo com passagens pra cada raia e faixa amarela no chão
  const gaps = [[-31.2, -28.8], [-10.2, -7.8], [10.8, 13.2], [29.8, 32.2]];
  let cx = -40;
  for (const [a, b] of gaps) { boxes.push(B(cx, 20.4, a, 21.2, 1.0, wood)); cx = b; }
  boxes.push(B(cx, 20.4, 40, 21.2, 1.0, wood));
  boxes.push(B(-40, 21.4, 40, 21.7, 0.03, yel));
  // muretas entre as raias (até o balcão)
  for (const x of [-19, 2, 22]) boxes.push(B(x - 0.3, -34, x + 0.3, 20.4, 1.3, stone));
  // ---- Raia A: distâncias ----
  const dummies = [];
  [[10, -36], [20, -31], [30, -26], [50, -22]].forEach(([d, x]) => {
    const z = FIRE - d;
    boxes.push(B(x - 0.7, z - 0.7, x + 0.7, z + 0.7, 0.12, yel));
    boxes.push(B(-38.5, z + 1.1, -19.4, z + 1.3, 0.03, white));
    signAt(x + 2.2, z, `${d} m`, '#2f80ed', 1.8, 0.8, 2.0);
    dummies.push({ name: `Alvo ${d} m`, x, z });
  });
  // ---- Raia B: alvos andando em trilhos ----
  [[12, 2.0, 'Lento'], [24, 3.5, 'Médio'], [38, 5.0, 'Ligeiro']].forEach(([d, sp, tag], i) => {
    const z = FIRE - d;
    boxes.push(B(-16.5, z - 0.25, -1, z + 0.25, 0.06, wood2));
    signAt(-17.2, z - 1.4, `${d} m · ${tag}`, '#8a6bc6', 2.4, 0.7, 2.0);
    dummies.push({ name: `Corredor ${tag}`, x: -8.5, z, move: { amp: 6, speed: sp, ph: i * 2.1 } });
  });
  // ---- Raia C: explosivos e arco ----
  boxes.push(B(5, 5.6, 19, 6.6, 1.2, '#c8b07a')); // sacos de areia: Copo Bomba por cima da mureta
  dummies.push({ name: 'Atrás do Muro 1', x: 8.5, z: 3.5 }, { name: 'Atrás do Muro 2', x: 15.5, z: 3.5 });
  boxes.push(B(8.5, -8.6, 15.5, -4.4, 0.12, '#d9c49a')); // roda dos três (bazuca: dano em área)
  dummies.push({ name: 'Trio 1', x: 10, z: -6 }, { name: 'Trio 2', x: 12, z: -7.2 }, { name: 'Trio 3', x: 14, z: -6 });
  boxes.push(B(15, -20, 19, -16, 4, wood), B(14.8, -20.2, 19.2, -16.2, 0.3, red, 4)); // torre do arco (alvo no alto)
  dummies.push({ name: 'Alvo da Torre', x: 17, z: -18, y: 4.3 });
  boxes.push(B(5, -27.7, 7, -25.7, 0.12, yel));
  dummies.push({ name: 'Alvo Longe', x: 6, z: -26.7 });
  boxes.push(B(4, -12, 6, -10, 2.2, wood2), crate(19.5, -2, 1.4, 1.2, yel)); // cobertura pro foguete bater
  // ---- Raia D: faca e sabre (cercadinho perto da linha) ----
  boxes.push(B(22.3, 2, 40, 2.4, 1.1, wood)); // cerca do fundo
  boxes.push(B(25.2, 7.2, 36.8, 13.8, 0.06, '#d9c49a'));
  dummies.push({ name: 'Saco de Faca 1', x: 27, z: 12 }, { name: 'Saco de Faca 2', x: 35, z: 12 }, { name: 'De Costas', x: 31, z: 8.5, yaw: Math.PI });
  dummies.push({ name: 'Rodando', x: 31, z: 4.8, move: { amp: 4, speed: 1.6, ph: 0 } });
  // ---- arena do X1 (oeste, atrás da linha) ----
  boxes.push(B(-24, 26, -18, 30, 2.4, wood), R(-18, 26.8, -14, 29.2, 0, 2.4, 'x', -1, wood2), B(-24, 25.8, -18, 26, 0.9, wood2, 2.4));
  boxes.push(crate(-34, 26, 1.6, 1.6), crate(-30, 31, 1.4, 1.2, yel), crate(-10, 30.5, 1.6, 1.6), crate(-12, 25.5, 1.4, 1.2, yel), B(-36, 29.5, -32.6, 30.3, 1.2, stone), B(-8, 27.4, -4.6, 28.2, 1.2, stone));
  boxes.push(B(-2.3, 22.6, -1.7, 34, 1.3, stone, 0)); // mureta separando o X1 da área de renascer
  // placas das raias (no fundo) e da entrada
  props.push({ t: 'sign', x: -29.5, y: 3.0, z: -33.9, w: 8, h: 1.6, rot: 0, text: 'DISTÂNCIA', bg: '#2f80ed', fg: '#fff6e4' });
  props.push({ t: 'sign', x: -8.5, y: 3.0, z: -33.9, w: 8, h: 1.6, rot: 0, text: 'EM MOVIMENTO', bg: '#8a6bc6', fg: '#fff6e4' });
  props.push({ t: 'sign', x: 12, y: 3.0, z: -33.9, w: 8, h: 1.6, rot: 0, text: 'EXPLOSIVOS · ARCO', bg: red, fg: '#fff6e4' });
  props.push({ t: 'sign', x: 31, y: 3.0, z: 2.0, w: 7, h: 1.4, rot: 0, text: 'FACA · SABRE', bg: '#c0392b', fg: '#fff6e4' });
  props.push({ t: 'sign', x: 19, y: 3.4, z: 33.9, w: 12, h: 2.0, rot: Math.PI, text: 'ESTANDE DO DOCÃO', bg: red, fg: '#fff6e4' });
  props.push({ t: 'sign', x: -21, y: 3.4, z: 33.9, w: 7, h: 1.6, rot: Math.PI, text: 'ARENA X1', bg: '#1d5f8a', fg: '#fff6e4' });
  props.push({ t: 'sign', x: 19, y: 1.75, z: 33.9, w: 12, h: 0.9, rot: Math.PI, text: 'B primária · N secundária · M faca/sabre', bg: '#2a1410', fg: '#ffd27a' });
  props.push({ t: 'logoSign', x: 0, y: 5.2, z: -33.98, rot: 0 });
  props.push({ t: 'hay', x: 37, z: 31 }, { t: 'hay', x: 3, z: 32 }, { t: 'keg', x: 21, z: 24 }, { t: 'keg', x: 1, z: 24 }, { t: 'tree', x: 38, z: -31 }, { t: 'tree', x: -38, z: -31 });
  MAPS.push({
    id: 'estande', name: 'Estande do Docão', desc: 'Modo Treino: raias de 10/20/30/50 m, alvos andando, área de explosivos e arco, cercadinho da faca/sabre e arena X1. Os alvos não atacam, só renascem.',
    training: true, size: [40, 34], wallH: 4, wallColor: ['#e8c25a', '#d8b24a'],
    palette: DAY({ ground: '#7cc95a', tiles: ['#a9e07f', '#9bd972', 64, 14] }),
    ...fin(boxes), props, dummies,
    spawns: [[5, 26], [10, 30], [15, 26], [20, 30], [25, 26], [30, 30], [35, 26], [8, 32.5], [-6, 26], [-14, 32], [-30, 33], [-37, 24.5]],
    pickups: [['grenade', 8, 23.8], ['grenade', 16, 23.8], ['ammo', 24, 23.8], ['health', -20, 32.5], ['health', 34, 32.5], ['ammo', -28, 24.5]],
    showcase: [12, 0, 26], view: [0, 1.6, 26, 0, -0.05],
  });
}

// ---------- Fazendona (Modo Infecção 🧟): a Arena da Fazendinha esticada 1,6× no chão (mesma altura) pra caber até 50 ----------
// Corredores, casas e portas ficam 60% mais largos/compridos; escadas e rampas ficam mais suaves; os spawns
// do mapa servem de base e o servidor ainda espalha a turma por pontos da malha de navegação.
export function scaleMap(src, k, extra) {
  const sx = (v) => Math.round(v * k * 100) / 100;
  const box = (o) => ({ ...o, b: [sx(o.b[0]), o.b[1], sx(o.b[2]), sx(o.b[3]), o.b[4], sx(o.b[5])], ramp: o.ramp ? { ...o.ramp } : undefined });
  const m = { ...src, ...extra, size: [sx(src.size[0]), sx(src.size[1])], boxes: src.boxes.map(box), waypoints: (src.waypoints || []).map(([x, y, z]) => [sx(x), y, sx(z)]),
    props: (src.props || []).map((p) => ({ ...p, x: sx(p.x), z: sx(p.z) })), spawns: src.spawns.map(([x, z, y]) => (y == null ? [sx(x), sx(z)] : [sx(x), sx(z), y])),
    pickups: src.pickups.map(([t, x, z, y]) => (y == null ? [t, sx(x), sx(z)] : [t, sx(x), sx(z), y])), showcase: src.showcase ? [sx(src.showcase[0]), src.showcase[1], sx(src.showcase[2])] : undefined };
  for (const b of m.boxes) if (!b.ramp) delete b.ramp;
  delete m.test; delete m.bomb; delete m.view; return m;
}
{
  const src = MAPS.find((m) => m.id === 'arena'), k = 1.6;
  const m = scaleMap(src, k, { id: 'fazendona', name: 'Fazendona (Infecção)', infOnly: true, wallH: 4.5, desc: '🧟 Feita pro modo Infecção: a Arena da Fazendinha 1,6× maior no chão, com corredores largos pra até 50 Docões.' });
  m.palette = { ...src.palette, fog: [src.palette.fog[0], 70, 190] };
  // mais spawns espalhados (os 12 da arena esticados + 12 no meio dos corredores)
  m.spawns.push([-30, -38], [30, 38], [-30, 38], [30, -38], [0, -30], [0, 30], [-36, 0], [36, 0], [-12, -40], [12, 40], [-44, -24], [44, 24]);
  m.pickups.push(['ammo', -36, 30], ['ammo', 36, -30], ['ammo', 0, -42], ['ammo', 0, 42], ['health', -40, -40], ['health', 40, 40]);
  MAPS.push(m);
}

export const getMap = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
// mapas jogáveis nas listas/rodízio (o Estande só abre no modo Treino)
// Modo Invasão: o Rodízio do Docão e a Fazenda Mal-Assombrada só abrem na Invasão (os outros modos continuam com os mapas de sempre)
const INV_ONLY = new Set(['rodizio', 'fazenda-assombrada']);
export const PLAY_MAPS = MAPS.filter((m) => !m.training && !m.invasionOnly && !m.infOnly && !INV_ONLY.has(m.id));
// mapas da Invasão: os dois feitos pra ela primeiro, depois os de sempre (com decoração de Halloween só nesse modo)
// mapas do Modo Bomba: só os com sites/spawns feitos à mão (o Rodízio, que na Invasão é exclusivo, vale aqui: foi feito pra Bomba); Pátio Ferrugem é pequeno demais e o Estande é do Treino
export const BOMB_MAPS = MAPS.filter((m) => m.bomb && !m.training && !m.invasionOnly);
export const INV_MAPS = [...MAPS.filter((m) => INV_ONLY.has(m.id)), ...PLAY_MAPS];
// mapas do Modo Infecção (até 50): a Fazendona primeiro, depois os maiores de sempre (o Rodízio, que é da Invasão/Bomba, também serve)
export const INF_MAPS = ['fazendona', 'hotmilk', 'rodizio', 'torres-do-barril', 'celeiro-industrial', 'duas-pocilgas'].map((id) => MAPS.find((m) => m.id === id)).filter(Boolean);

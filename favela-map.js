// Morro do Leitão. Três patamares de verdade: rua (y 0), campinho (y 5,6) e topo (y 11,4).
// Três subidas largas em cada lance — escadaria oeste, rampa central, escadaria leste.
// Casas poucas, plantadas à mão. Sem viela sem saída.
const B = (x0, z0, x1, z1, h, c, y0 = 0) => ({ b: [Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y0 + h, Math.max(z0, z1)], c });
const R = (x0, z0, x1, z1, y0, y1, axis, dir, c) => ({ b: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], c, ramp: { axis, dir } });
const door = (a, b, h = 2.45) => ({ a, b, y0: 0, y1: h });
const win = (a, b, lo = 1.05, hi = 2.05) => ({ a, b, y0: lo, y1: hi });
function wallAlong(axis, s0, s1, line, t, h, c, openings = [], y0 = 0) {
  const out = []; let cur = Math.min(s0, s1); const end = Math.max(s0, s1);
  const box = (a, b, ya, yb) => {
    if (b - a < 0.05 || yb - ya < 0.05) return;
    out.push(axis === 'x'
      ? { b: [a, y0 + ya, line - t / 2, b, y0 + yb, line + t / 2], c }
      : { b: [line - t / 2, y0 + ya, a, line + t / 2, y0 + yb, b], c });
  };
  for (const o of [...openings].sort((p, q) => p.a - q.a)) {
    box(cur, o.a, 0, h);
    if (o.y0 > 0) box(o.a, o.b, 0, o.y0);
    if (o.y1 < h) box(o.a, o.b, o.y1, h);
    cur = Math.max(cur, o.b);
  }
  box(cur, end, 0, h);
  return out;
}
const wallX = (x0, x1, z, t, h, c, op, y0) => wallAlong('x', x0, x1, z, t, h, c, op, y0);
const wallZ = (z0, z1, x, t, h, c, op, y0) => wallAlong('z', z0, z1, x, t, h, c, op, y0);

const BRICK = '#a0503a', BRICK2 = '#8a4030', ROOF = '#7e7e7c', DIRT = '#675b44', DIRT2 = '#7d6c52', GRASS = '#6f8a3e';
const WOOD = '#8b5a2b', TREAD = '#d9d3c4', ASPH = '#3a3a38';
const Y_FIELD = 5.6, Y_TOP = 11.4;

export function morroLeitao() {
  const boxes = [];
  const props = [];
  const wps = [];

  // Escadaria larga. Degrau de 0,18 m (abaixo do STEP) e rampa invisível por baixo, pra não enroscar.
  function stairs(x0, x1, z0, z1, y0, y1, tread = TREAD) {
    const zLo = Math.min(z0, z1), zHi = Math.max(z0, z1);
    const n = Math.max(4, Math.round((y1 - y0) / 0.18));
    const rise = (y1 - y0) / n, run = (zHi - zLo) / n;
    for (let i = 0; i < n; i++) {
      const zA = zLo + i * run, top = y0 + (i + 1) * rise;
      boxes.push(B(x0, zA, x1, zA + run + 0.02, rise, tread, top - rise));
    }
    boxes.push({ b: [x0 + 0.08, y0, zLo, x1 - 0.08, y1, zHi], ramp: { axis: 'z', dir: 1 }, hide: true, c: '#888' });
    const mx = (x0 + x1) / 2;
    wps.push([mx, y0 + 0.25, zLo + 0.45], [mx, (y0 + y1) / 2 + 0.2, (zLo + zHi) / 2], [mx, y1 + 0.2, zHi - 0.35]);
  }

  // ---- morro: rua, campinho, topo. A face de cada caixa é o muro de arrimo. ----
  boxes.push(B(-30.5, -0.05, 30.5, 14.2, Y_FIELD, DIRT));
  boxes.push(B(-30.5, 14.2, 30.5, 18.05, Y_FIELD, DIRT)); // ombro: ao lado da subida pro topo não tem buraco
  boxes.push(B(-30.5, 18.05, 30.5, 24.6, Y_TOP, DIRT2));
  // rua
  boxes.push(B(-29.2, -15.5, 29.2, -11.2, 0.055, ASPH, 0.02));
  for (let x = -26; x < 26; x += 4.4) props.push({ t: 'decal', x0: x, z0: -13.15, x1: x + 2.1, z1: -12.95, y: 0.09, c: 0xf2c94c });

  // rua → campinho. Três vãos de ~6 m. A rampa central é lisa; as laterais são escada.
  // a crista fica depois da face do patamar: o corpo chega na altura cheia antes de encostar no muro
  stairs(-23.2, -17.0, -11.05, -0.15, 0, Y_FIELD);
  boxes.push(R(-3.3, -11.05, 3.3, -0.15, 0, Y_FIELD, 'z', 1, TREAD));
  stairs(17.0, 23.2, -11.05, -0.15, 0, Y_FIELD);
  // patamar raso na boca de cada subida, pra não ter vão nem quina entre a crista e o campinho
  boxes.push(B(-23.4, -0.32, -16.8, 0.15, Y_FIELD, DIRT));
  boxes.push(B(-3.45, -0.32, 3.45, 0.15, Y_FIELD, DIRT));
  boxes.push(B(16.8, -0.32, 23.4, 0.15, Y_FIELD, DIRT));
  wps.push([0, 0.3, -10.6], [0, Y_FIELD * 0.5, -5.5], [0, Y_FIELD + 0.2, 0.2]);

  // campinho → topo. Mesmas três faixas, alinhadas com as de baixo.
  stairs(-23.0, -16.8, 7.6, 18.5, Y_FIELD, Y_TOP);
  stairs(-4.0, 4.0, 7.6, 18.5, Y_FIELD, Y_TOP);
  stairs(16.8, 23.0, 7.6, 18.5, Y_FIELD, Y_TOP);
  wps.push([0, Y_FIELD + 0.3, 8.3], [0, (Y_FIELD + Y_TOP) / 2, 13.2], [0, Y_TOP + 0.2, 18.4]);
  wps.push([-20, 0.3, -12.5], [-20, Y_FIELD + 0.25, 2], [-20, Y_TOP + 0.25, 19.5]);
  wps.push([20, 0.3, -12.5], [20, Y_FIELD + 0.25, 2], [20, Y_TOP + 0.25, 19.5]);

  // campinho
  boxes.push(B(-13.2, 0.35, 13.2, 8.15, 0.07, GRASS, Y_FIELD));
  const gy = Y_FIELD + 0.09;
  props.push(
    { t: 'decal', x0: -12.2, z0: 0.7, x1: 12.2, z1: 0.88, y: gy, c: 0xf7f4ee },
    { t: 'decal', x0: -12.2, z0: 7.55, x1: 12.2, z1: 7.73, y: gy, c: 0xf7f4ee },
    { t: 'decal', x0: -12.2, z0: 0.7, x1: -12.02, z1: 7.73, y: gy, c: 0xf7f4ee },
    { t: 'decal', x0: 12.02, z0: 0.7, x1: 12.2, z1: 7.73, y: gy, c: 0xf7f4ee },
    { t: 'decal', x0: -0.1, z0: 0.7, x1: 0.1, z1: 7.73, y: gy, c: 0xf7f4ee },
  );
  for (const x of [-11.35, 11.35]) {
    boxes.push(B(x, 3.15, x + 0.12, 5.55, 1.35, '#f4f1ea', Y_FIELD + 0.07));
    boxes.push(B(x, 3.15, x + (x < 0 ? -0.55 : 0.67), 3.27, 1.35, '#f4f1ea', Y_FIELD + 0.07));
  }
  // cobertura baixa nas laterais do campo — não atravessa as três subidas
  boxes.push(B(-15.4, 1.15, -14.15, 5.4, 1.15, BRICK, Y_FIELD));
  boxes.push(B(14.15, 1.15, 15.4, 5.4, 1.15, BRICK, Y_FIELD));
  boxes.push(B(-9.2, 6.55, -7.4, 7.85, 1.05, '#c4b49a', Y_FIELD));
  boxes.push(B(7.6, 1.15, 9.3, 2.45, 1.05, WOOD, Y_FIELD));

  function house(x0, z0, x1, z1, y0, col, face, gap) {
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), za = Math.min(z0, z1), zb = Math.max(z0, z1);
    const t = 0.36, H = 3.2, midX = (xa + xb) / 2, midZ = (za + zb) / 2, dw = 1.85;
    const hole = (side, ops) => {
      if (!gap || gap.side !== side) return ops;
      const rest = ops.filter((o) => o.b < gap.a - 0.02 || o.a > gap.b + 0.02);
      return [...rest, { a: gap.a, b: gap.b, y0: 0, y1: H + 0.5 }];
    };
    boxes.push(...wallX(xa, xb, zb - t / 2, t, H, col.wall, hole('n', face === 'n' ? [door(midX - dw / 2, midX + dw / 2)] : [win(midX - 0.85, midX + 0.45)]), y0));
    boxes.push(...wallX(xa, xb, za + t / 2, t, H, col.wall2, hole('s', face === 's' ? [door(midX - dw / 2, midX + dw / 2)] : [win(midX - 0.4, midX + 0.85)]), y0));
    boxes.push(...wallZ(za + t, zb - t, xa + t / 2, t, H, col.wall2, hole('w', face === 'w' ? [door(midZ - dw / 2, midZ + dw / 2)] : [win(midZ - 0.7, midZ + 0.45)]), y0));
    boxes.push(...wallZ(za + t, zb - t, xb - t / 2, t, H, col.wall, hole('e', face === 'e' ? [door(midZ - dw / 2, midZ + dw / 2)] : [win(midZ - 0.35, midZ + 0.8)]), y0));
    const roofY = y0 + H;
    boxes.push(B(xa - 0.08, za - 0.08, xb + 0.08, zb + 0.08, 0.2, col.roof, roofY));
    props.push({ t: 'tank', x: midX + (xa < 0 ? 0.7 : -0.7), z: midZ, y: roofY + 0.2, r: 0.62, h: 1.05, c: '#3a6fb0', cap: '#e7e2d8' });
    if (face === 'n') wps.push([midX, y0 + 0.25, zb + 0.85], [midX, y0 + 0.25, zb - 1.15]);
    if (face === 's') wps.push([midX, y0 + 0.25, za - 0.85], [midX, y0 + 0.25, za + 1.15]);
    if (face === 'e') wps.push([xb + 0.85, y0 + 0.25, midZ], [xb - 1.15, y0 + 0.25, midZ]);
    if (face === 'w') wps.push([xa - 0.85, y0 + 0.25, midZ], [xa + 1.15, y0 + 0.25, midZ]);
    wps.push([midX, roofY + 0.35, midZ]);
    return roofY + 0.2;
  }
  // A rampa chega na altura da laje ANTES da casa. Uma ponte rasa entra no vão, senão a cabeça bate na laje.
  function laje(x0, z0, x1, z1, y0, y1, axis, dir) {
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), za = Math.min(z0, z1), zb = Math.max(z0, z1), inset = 2.05;
    if (axis === 'z' && dir > 0) {
      const crest = zb - inset;
      boxes.push(R(xa, za, xb, crest, y0, y1, 'z', 1, TREAD));
      boxes.push(B(xa, crest - 0.08, xb, zb, 0.16, TREAD, y1 - 0.16));
    } else if (axis === 'z') {
      const crest = za + inset;
      boxes.push(R(xa, crest, xb, zb, y0, y1, 'z', -1, TREAD));
      boxes.push(B(xa, za, xb, crest + 0.08, 0.16, TREAD, y1 - 0.16));
    } else if (dir > 0) {
      const crest = xb - inset;
      boxes.push(R(xa, za, crest, zb, y0, y1, 'x', 1, TREAD));
      boxes.push(B(crest - 0.08, za, xb, zb, 0.16, TREAD, y1 - 0.16));
    } else {
      const crest = xa + inset;
      boxes.push(R(crest, za, xb, zb, y0, y1, 'x', -1, TREAD));
      boxes.push(B(xa, za, crest + 0.08, zb, 0.16, TREAD, y1 - 0.16));
    }
    const mx = (xa + xb) / 2, mz = (za + zb) / 2;
    wps.push([axis === 'x' ? xa + 0.4 : mx, y0 + 0.25, axis === 'z' ? za + 0.4 : mz]);
    wps.push([mx, y1 + 0.15, mz]);
  }

  const brick = { wall: BRICK, wall2: BRICK2, roof: ROOF };
  const sand = { wall: '#c4b49a', wall2: '#b7aea0', roof: ROOF };
  const mint = { wall: '#9bb8ad', wall2: '#7e9e94', roof: '#8d8680' };
  const wood = { wall: WOOD, wall2: '#6b4423', roof: '#6e6256' };
  const yellow = { wall: '#e6c15a', wall2: '#c9a84a', roof: ROOF };
  const green = { wall: '#6a8f4a', wall2: '#8fb56a', roof: '#6e6256' };

  // sul da rua, de frente pra Main. Escada da laje fica atrás, longe da pista.
  let roof = house(-29.4, -21.7, -23.6, -15.75, 0, brick, 'n', { side: 's', a: -28.55, b: -25.95 });
  laje(-28.4, -27.15, -26.1, -20.7, 0, roof, 'z', 1);
  roof = house(-19.2, -21.7, -13.4, -15.75, 0, yellow, 'n', { side: 's', a: -18.35, b: -15.75 });
  laje(-18.2, -27.15, -15.9, -20.7, 0, roof, 'z', 1);
  roof = house(9.6, -21.7, 15.4, -15.75, 0, wood, 'n', { side: 's', a: 10.45, b: 13.05 });
  laje(10.6, -27.15, 12.9, -20.7, 0, roof, 'z', 1);
  roof = house(19.8, -21.7, 26.2, -15.75, 0, mint, 'n', { side: 's', a: 20.65, b: 23.25 });
  laje(20.8, -27.15, 23.1, -20.7, 0, roof, 'z', 1);

  // barraca aberta pro norte: o teste de teto anda aqui, no chão da rua
  boxes.push(...wallX(-4.3, 4.3, -23.55, 0.32, 2.7, BRICK, [], 0));
  boxes.push(...wallZ(-23.4, -18.7, -4.15, 0.32, 2.7, BRICK2, [], 0));
  boxes.push(...wallZ(-23.4, -18.7, 4.15, 0.32, 2.7, BRICK2, [], 0));
  boxes.push(B(-4.15, -23.4, -3.85, -23.1, 2.7, WOOD), B(3.85, -23.4, 4.15, -23.1, 2.7, WOOD));
  boxes.push(B(-4.5, -23.7, 4.5, -18.55, 0.16, '#c45a6a', 2.52));
  props.push({ t: 'sign', x: 0, y: 2.15, z: -18.5, w: 2.4, h: 0.7, rot: 0, text: 'BAR', bg: '#a0503a', fg: '#fff' });
  wps.push([0, 0.3, -21], [0, 0.3, -17.6]);

  // flancos do campinho. A escada da laje sobe pelo norte e não cruza as três rotas.
  roof = house(-29.3, 0.85, -23.5, 6.7, Y_FIELD, sand, 'e', { side: 'n', a: -27.75, b: -25.05 });
  laje(-27.6, 5.5, -25.2, 11.8, Y_FIELD, roof, 'z', -1);
  roof = house(23.5, 0.85, 29.3, 6.7, Y_FIELD, green, 'w', { side: 'n', a: 25.05, b: 27.75 });
  laje(25.2, 5.5, 27.6, 11.8, Y_FIELD, roof, 'z', -1);

  // topo. Miolo livre, olhando a descida.
  house(-29.2, 18.7, -23.2, 23.5, Y_TOP, brick, 'e');
  house(23.2, 18.7, 29.2, 23.5, Y_TOP, yellow, 'w');
  boxes.push(B(-2.3, 21.3, 2.3, 23.5, 1.05, BRICK2, Y_TOP)); // mureta da praça
  props.push({ t: 'tank', x: 0, z: 20.2, y: Y_TOP, r: 0.85, h: 1.35, c: '#d8d2c8', cap: '#3a6fb0' });

  // rua: dois caminhões encostados, fora das três bocas de subida
  props.push({ t: 'truck', x: -10.5, z: -14.55, y: 0.08, c: '#c46a4e' });
  props.push({ t: 'truck', x: 11.2, z: -14.7, y: 0.08, c: '#e6c15a' });
  props.push(
    { t: 'sign', x: -26.2, y: 2.4, z: -15.55, w: 1.8, h: 0.7, rot: 0, text: 'LEO', bg: '#3a6fb0', fg: '#fff' },
    { t: 'sign', x: 22.6, y: 2.4, z: -15.55, w: 1.6, h: 0.65, rot: 0, text: 'FÉ', bg: '#6a8f4a', fg: '#fff' },
  );
  const poles = [];
  for (const x of [-27.2, -10.2, 10.2, 26.4]) {
    boxes.push(B(x - 0.1, -12.45, x + 0.1, -12.25, 5.1, '#6e6256'));
    poles.push([x, 5.1, -12.35]);
  }
  for (let i = 0; i < poles.length - 1; i++) {
    const [x0, y0, z0] = poles[i], [x1, , z1] = poles[i + 1];
    props.push({ t: 'cable', x0, y0, z0, x1, y1: y0 - 0.45, z1, c: '#1c1c1c', r: 0.035 });
  }
  props.push({ t: 'tree', x: -16.2, z: 2.4, y: Y_FIELD }, { t: 'tree', x: 16.4, z: 6.2, y: Y_FIELD });
  boxes.push(B(-6.4, -8.4, -4.7, -6.9, 1.15, WOOD)); // caixote entre a escada oeste e a rampa
  boxes.push(B(4.8, -8.2, 6.6, -6.6, 1.2, '#c4b49a'));
  boxes.push(B(-6.2, 20.15, -4.5, 21.7, 1.1, BRICK, Y_TOP));
  boxes.push(B(4.6, 19.4, 6.4, 20.9, 1.15, WOOD, Y_TOP));

  for (const x of [-26, -16, -8, 0, 8, 16, 24]) wps.push([x, 0.3, -13]);
  for (const x of [-26, -8, 0, 8, 26]) wps.push([x, Y_FIELD + 0.3, 4]);
  for (const x of [-16, -6, 0, 6, 16]) wps.push([x, Y_TOP + 0.3, 20.4]);

  const spawns = [
    [-26.2, -13.3, 0.3], [-14.5, -12.4, 0.3], [-4.2, -13.6, 0.3], [4.6, -12.5, 0.3], [17.2, -13.4, 0.3], [27.8, -13.8, 0.3],
    [-18.6, 3.4, Y_FIELD + 0.3], [-6.5, 4.6, Y_FIELD + 0.3], [5.2, 2.6, Y_FIELD + 0.3], [18.4, 3.8, Y_FIELD + 0.3],
    [-14.2, 20.4, Y_TOP + 0.3], [-6.2, 18.8, Y_TOP + 0.3], [13.6, 20.6, Y_TOP + 0.3],
  ];
  const pickups = [
    ['ammo', -22, -12.6, 0.3], ['health', 2.2, -12.2, 0.3], ['grenade', 24, -12.8, 0.3],
    ['health', -4, 3.2, Y_FIELD + 0.3], ['ammo', 0.2, 5.4, Y_FIELD + 0.3], ['grenade', 20, 4.2, Y_FIELD + 0.3],
    ['health', -8, 20.8, Y_TOP + 0.3], ['ammo', 8.5, 20.2, Y_TOP + 0.3],
  ];

  return {
    id: 'morro-leitao', name: 'Morro do Leitão',
    desc: 'Morro de verdade: a rua embaixo, o campinho no patamar do meio e o topo lá em cima. Três subidas largas.',
    size: [32, 28], wallH: 0.4, wallColor: [DIRT, DIRT], openMax: 12, laneMin: 36, expMax: 0.55, navSpacing: 2,
    skyline: 'favela',
    thumb: { x: 22, y: 26, z: -18, tx: -2, ty: 6, tz: 4 },
    fall: { openWest: true, openEast: true, openNorth: true, openSouth: true },
    palette: { sky: '#9ec4ea', fog: ['#d5e0ea', 70, 210], hemi: ['#fff6e4', '#6a7a48', 1.45], sun: ['#fff1d0', 2.15], ground: DIRT, tiles: null, clouds: true, mountains: false, lights: [] },
    boxes: boxes.filter((o) => o.b),
    waypoints: wps,
    props,
    spawns, pickups,
    showcase: [0, 0, -13],
    view: [0, 1.7, -13.4, Math.PI, -0.18],
    test: {
      stairs: { from: [0, 0.1, -11.6], to: [0, Y_FIELD, 0.35], level: Y_FIELD },
      roof: { from: [0, Y_FIELD + 0.2, 7.3], to: [0, Y_TOP, 18.7], level: Y_TOP },
      under: { from: [0, 0, -22.7], to: [0, 0, -19.35], ceil: 2.56 },
    },
  };
}

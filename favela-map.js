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
  // Lance estreito. y0/y1 são a cota no começo e no fim do sentido da marcha (z0→z1 ou x0→x1).
  function flight(x0, x1, z0, z1, y0, y1) {
    const alongZ = Math.abs(z1 - z0) >= Math.abs(x1 - x0);
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), za = Math.min(z0, z1), zb = Math.max(z0, z1);
    const yLo = alongZ ? (z0 <= z1 ? y0 : y1) : (x0 <= x1 ? y0 : y1);
    const yHi = alongZ ? (z0 <= z1 ? y1 : y0) : (x0 <= x1 ? y1 : y0);
    const dir = yHi >= yLo ? 1 : -1;
    const rise = Math.abs(yHi - yLo), yb = Math.min(yLo, yHi), yt = Math.max(yLo, yHi);
    const n = Math.max(3, Math.round(rise / 0.17));
    const step = rise / n;
    if (alongZ) {
      const run = (zb - za) / n;
      for (let i = 0; i < n; i++) {
        const zA = dir > 0 ? za + i * run : za + (n - 1 - i) * run;
        boxes.push(B(xa, zA, xb, zA + run + 0.02, step, TREAD, yb + i * step));
      }
      boxes.push({ b: [xa + 0.05, yb, za, xb - 0.05, yt, zb], ramp: { axis: 'z', dir }, hide: true, c: '#888' });
    } else {
      const run = (xb - xa) / n;
      for (let i = 0; i < n; i++) {
        const xA = dir > 0 ? xa + i * run : xa + (n - 1 - i) * run;
        boxes.push(B(xA, za, xA + run + 0.02, zb, step, TREAD, yb + i * step));
      }
      boxes.push({ b: [xa, yb, za + 0.05, xb, yt, zb - 0.05], ramp: { axis: 'x', dir }, hide: true, c: '#888' });
    }
    wps.push([(x0 + x1) / 2, y0 + 0.2, (z0 + (alongZ ? 0 : 0))], [(xa + xb) / 2, yb + 0.25, (za + zb) / 2], [(xa + xb) / 2, yt + 0.2, (za + zb) / 2]);
  }
  const pad = (x0, z0, x1, z1, y) => { boxes.push(B(x0, z0, x1, z1, 0.16, TREAD, y - 0.16)); wps.push([(x0 + x1) / 2, y + 0.2, (z0 + z1) / 2]); };

  // ---- morro: rua, campinho, topo. A face de cada caixa é o muro de arrimo. ----
  boxes.push(B(-30.5, -0.05, 30.5, 14.2, Y_FIELD, DIRT));
  boxes.push(B(-30.5, 14.2, 30.5, 18.05, Y_FIELD, DIRT)); // ombro: ao lado da subida pro topo não tem buraco
  boxes.push(B(-30.5, 18.05, 30.5, 24.6, Y_TOP, DIRT2));
  // rua
  boxes.push(B(-29.2, -15.5, 29.2, -11.2, 0.055, ASPH, 0.02));
  for (let x = -26; x < 26; x += 4.4) props.push({ t: 'decal', x0: x, z0: -13.15, x1: x + 2.1, z1: -12.95, y: 0.09, c: 0xf2c94c });

  // Três subidas estreitas em L. O patamar é só a quina, pra não virar teto do lance seguinte.
  const corner = (x, z, y) => pad(x - 1.25, z - 0.35, x + 1.25, z + 1.45, y);
  flight(-4.8, -2.6, -10.8, -6.55, 0, 2.55);
  corner(-3.6, -6.2, 2.55);
  flight(-2.6, 1.8, -6.85, -4.65, 2.55, 4.15);
  corner(1.5, -4.7, 4.15);
  flight(0.3, 2.5, -4.7, -0.2, 4.15, Y_FIELD);
  flight(-23.6, -21.4, -10.8, -6.55, 0, 2.55);
  corner(-22.4, -6.2, 2.55);
  flight(-21.4, -17.0, -6.85, -4.65, 2.55, 4.15);
  corner(-17.2, -4.7, 4.15);
  flight(-18.4, -16.2, -4.7, -0.2, 4.15, Y_FIELD);
  flight(16.2, 18.4, -10.8, -6.55, 0, 2.55);
  corner(17.3, -6.35, 2.55);
  flight(18.7, 22.4, -6.15, -3.95, 2.55, 4.15);
  corner(22.0, -4.05, 4.15);
  flight(20.2, 22.4, -4.05, -0.15, 4.15, Y_FIELD);
  flight(-4.6, -2.4, 8.75, 12.35, Y_FIELD, Y_FIELD + 2.3);
  corner(-3.4, 12.2, Y_FIELD + 2.3);
  flight(-2.4, 1.8, 11.0, 13.2, Y_FIELD + 2.3, Y_FIELD + 4.05);
  corner(1.5, 13.05, Y_FIELD + 4.05);
  flight(0.3, 2.5, 12.85, 18.25, Y_FIELD + 4.05, Y_TOP);
  flight(-23.4, -21.2, 8.75, 12.35, Y_FIELD, Y_FIELD + 2.3);
  corner(-22.2, 12.2, Y_FIELD + 2.3);
  flight(-21.2, -17.0, 11.0, 13.2, Y_FIELD + 2.3, Y_FIELD + 4.05);
  corner(-17.2, 13.05, Y_FIELD + 4.05);
  flight(-18.4, -16.2, 12.85, 18.25, Y_FIELD + 4.05, Y_TOP);
  flight(16.2, 18.4, 8.75, 12.35, Y_FIELD, Y_FIELD + 2.3);
  corner(17.3, 12.15, Y_FIELD + 2.3);
  flight(18.7, 22.4, 12.55, 14.75, Y_FIELD + 2.3, Y_FIELD + 4.05);
  corner(22.0, 14.6, Y_FIELD + 4.05);
  flight(20.2, 22.4, 14.4, 18.25, Y_FIELD + 4.05, Y_TOP);

  // campinho
  boxes.push(B(-13.2, 0.35, 13.2, 8.15, 0.07, GRASS, Y_FIELD));
  // Coberturas pra quem está embaixo: toldo acima da cabeça, muro e lona. Não atravessam as escadas.
  const awn = (x0, z0, x1, z1, y, c) => boxes.push(B(x0, z0, x1, z1, 0.1, c, y));
  awn(-28.2, -14.7, -20.2, -12.35, 2.72, '#c45a6a');
  awn(-7.6, -14.85, -1.6, -12.4, 2.78, '#e6c15a');
  awn(14.2, -14.7, 22.4, -12.4, 2.72, '#3a6fb0');
  awn(-16.4, -13.85, -12.2, -13.15, 3.25, '#d9d3c4');
  awn(5.4, -13.7, 10.6, -13.05, 3.3, '#c45a6a');
  boxes.push(B(-16.4, -14.5, -15.9, -11.7, 2.2, BRICK));
  boxes.push(B(13.1, -14.6, 13.6, -11.8, 2.2, BRICK2));
  awn(-12.2, 1.15, -8.0, 5.6, Y_FIELD + 2.45, '#c45a6a');
  awn(8.2, 2.1, 12.5, 6.3, Y_FIELD + 2.45, '#e6c15a');
  boxes.push(B(-7.7, 1.3, -7.25, 4.4, 1.2, BRICK, Y_FIELD));
  boxes.push(B(7.25, 3.0, 7.7, 6.1, 1.2, BRICK, Y_FIELD));
  boxes.push(B(-24.35, -6.4, -23.9, -2.2, 2.05, BRICK2));
  boxes.push(B(23.9, -6.4, 24.35, -2.2, 2.05, BRICK2));
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
    desc: 'Morro de verdade: rua, campinho e topo. Escadas estreitas em zigue-zague e cobertura pra quem sobe.',
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
      stairs: { from: [-3.7, 0.1, -10.6], to: [1.4, Y_FIELD, -0.45], level: Y_FIELD, via: [[-3.7, -6.7], [-0.4, -5.75], [1.4, -4.2]] },
      roof: { from: [-3.5, Y_FIELD + 0.15, 9.0], to: [1.4, Y_TOP, 17.6], level: Y_TOP, via: [[-3.5, 12.1], [-0.3, 12.1], [1.4, 13.4]] },
      under: { from: [0, 0, -22.7], to: [0, 0, -19.35], ceil: 2.56 },
    },
  };
}

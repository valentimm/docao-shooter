// Bondinho e trenó do Posto Nevasca. A posição sai só do tempo da partida,
// então o offline e todo cliente online veem a mesma coisa.
export const GONDOLA = {
  x: [-1.35, 1.35],
  y: 10,
  zN: 32,
  zS: -32,
  travel: 14,
  dwell: 3.4,
  hx: 0.52,
  hz: 0.58,
  head: 2.2,
};
// Cabine aberta: mureta que cobre o corpo agachado (altura 1,30) e deixa a cabeça em pé de fora.
export const CABIN = { hx: 1.08, hz: 1.14, thick: 0.1, wall: 1.38, door: 0.46 };
// Um elevador por estação, no eixo, entre o platô e o vão. Sobe e desce em ciclo, só com o tempo da partida.
export const ELEVATOR = {
  y0: 0, y1: 10, travel: 3.2, dwellTop: 4.8, dwellBot: 3.2,
  hx: 0.56, hz: 0.46, head: 2.3,
  car: { hx: 1.15, hz: 1.05, thick: 0.11, wall: 1.38 },
  stations: [{ x: 0, z: 35.16, open: -1 }, { x: 0, z: -35.16, open: 1 }],
};
const ELEV_UP = ELEVATOR.travel + ELEVATOR.dwellTop;
const ELEV_PERIOD = ELEV_UP + ELEVATOR.travel + ELEVATOR.dwellBot;
const LEG = GONDOLA.travel + GONDOLA.dwell;
const PERIOD = LEG * 2;

export function gondolaPose(t, i = 0) {
  let u = ((t % PERIOD) + PERIOD) % PERIOD;
  if (i === 1) u = (u + PERIOD / 2) % PERIOD;
  const { zN, zS, travel, dwell, y } = GONDOLA;
  let z, stopped = false;
  if (u < travel) z = zN + (zS - zN) * (u / travel);
  else if (u < travel + dwell) { z = zS; stopped = true; }
  else if (u < travel * 2 + dwell) z = zS + (zN - zS) * ((u - travel - dwell) / travel);
  else { z = zN; stopped = true; }
  return { x: GONDOLA.x[i], y, z, stopped, i };
}

export function elevatorPose(t, i = 0) {
  let u = ((t % ELEV_PERIOD) + ELEV_PERIOD) % ELEV_PERIOD;
  const st = ELEVATOR.stations[i];
  const { y0, y1, travel } = ELEVATOR;
  let y, phase;
  if (u < travel) { y = y0 + (y1 - y0) * (u / travel); phase = 'up'; }
  else if (u < ELEV_UP) { y = y1; phase = 'top'; }
  else if (u < ELEV_UP + travel) { y = y1 + (y0 - y1) * ((u - ELEV_UP) / travel); phase = 'down'; }
  else { y = y0; phase = 'bottom'; }
  return { x: st.x, y, z: st.z, phase, open: st.open, i, stopped: phase === 'top' || phase === 'bottom' };
}

function carry(pos, a, b, hx, hz, head) {
  const lx = pos.x - a.x, ly = pos.y - a.y, lz = pos.z - a.z;
  if (Math.abs(lx) > hx || Math.abs(lz) > hz || ly < -0.55 || ly > head) return null;
  const floor = ly < 0.42;
  return { x: b.x + lx, y: floor ? b.y + Math.max(0, ly) : Math.max(b.y, pos.y), z: b.z + lz, riding: true, floor };
}

// Quem está no piso do elevador ou dentro da cabine acompanha o deslocamento. Fora, nada.
export function rideShift(pos, t, dt) {
  if (!(dt > 0)) return null;
  for (let i = 0; i < 2; i++) {
    const hit = carry(pos, elevatorPose(t - dt, i), elevatorPose(t, i), ELEVATOR.hx, ELEVATOR.hz, ELEVATOR.head);
    if (hit) return hit;
  }
  for (let i = 0; i < 2; i++) {
    const hit = carry(pos, gondolaPose(t - dt, i), gondolaPose(t, i), GONDOLA.hx, GONDOLA.hz, GONDOLA.head);
    if (hit) return hit;
  }
  return null;
}

function coverBox(out, x0, y0, z0, x1, y1, z1) {
  out.push({
    min: { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) },
    max: { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) },
    cover: true,
  });
}

// Muretas do bondinho e do elevador. cover: a bala para, mesmo sendo parede fina.
export function nevascaSolids(t) {
  const out = [];
  const { thick, wall, door } = CABIN;
  for (let i = 0; i < 2; i++) {
    const p = gondolaPose(t, i), y = p.y, hx = CABIN.hx, hz = CABIN.hz;
    const outer = p.x < 0 ? -1 : 1;
    coverBox(out, p.x - hx, y, p.z + hz - thick, p.x + hx, y + wall, p.z + hz);
    coverBox(out, p.x - hx, y, p.z - hz, p.x + hx, y + wall, p.z - hz + thick);
    const oface = p.x + outer * hx, oinner = oface - outer * thick;
    coverBox(out, oinner, y, p.z - hz, oface, y + wall, p.z + hz);
    const face = p.x - outer * hx, inner = face + outer * thick;
    coverBox(out, inner, y, p.z - hz, face, y + wall, p.z - door);
    coverBox(out, inner, y, p.z + door, face, y + wall, p.z + hz);
  }
  const C = ELEVATOR.car;
  for (let i = 0; i < 2; i++) {
    const p = elevatorPose(t, i), y = p.y;
    coverBox(out, p.x - C.hx, y, p.z - C.hz, p.x - C.hx + C.thick, y + C.wall, p.z + C.hz);
    coverBox(out, p.x + C.hx - C.thick, y, p.z - C.hz, p.x + C.hx, y + C.wall, p.z + C.hz);
    const back = -p.open;
    const bz0 = p.z + back * C.hz, bz1 = bz0 + back * C.thick;
    coverBox(out, p.x - C.hx, y, bz0, p.x + C.hx, y + C.wall, bz1);
    if (p.phase === 'up' || p.phase === 'down') {
      const fz0 = p.z + p.open * C.hz, fz1 = fz0 + p.open * C.thick;
      coverBox(out, p.x - C.hx, y, fz0, p.x + C.hx, y + C.wall, fz1);
    }
  }
  return out;
}

// Passagem a cada 30 s, 11 s no ar. A curva sai só do tempo da partida.
export const SLEIGH = { cycle: 30, flight: 11, linger: 3.5 };
const SLEIGH_X = [-44, -8, 16, 46];
const SLEIGH_Z = [-8, 20, 18, -4];

function bez(p, t) {
  const u = 1 - t;
  return u * u * u * p[0] + 3 * u * u * t * p[1] + 3 * u * t * t * p[2] + t * t * t * p[3];
}
function dbez(p, t) {
  const u = 1 - t;
  return 3 * u * u * (p[1] - p[0]) + 6 * u * t * (p[2] - p[1]) + 3 * t * t * (p[3] - p[2]);
}

export function sleighClock(t) {
  const u = ((t % SLEIGH.cycle) + SLEIGH.cycle) % SLEIGH.cycle;
  return { u, k: u / SLEIGH.flight, flying: u <= SLEIGH.flight, cycle: Math.round((t - u) / SLEIGH.cycle) };
}

// k em 0..1. Sobe e desce, e o XZ é uma Bézier (não é reta).
export function sleighAt(k) {
  const t = Math.min(1, Math.max(0, k));
  const dx = dbez(SLEIGH_X, t), dz = dbez(SLEIGH_Z, t);
  const dy = 6.5 * Math.PI * Math.cos(t * Math.PI);
  const horiz = Math.hypot(dx, dz) || 1;
  return {
    x: bez(SLEIGH_X, t),
    y: 16.5 + Math.sin(t * Math.PI) * 6.5,
    z: bez(SLEIGH_Z, t),
    k: t,
    yaw: Math.atan2(-dz, dx),
    pitch: Math.atan2(dy, horiz) * 0.55,
    roll: Math.sin(t * Math.PI) * 0.05,
  };
}

export function sleighPose(t) {
  const c = sleighClock(t);
  if (!c.flying) return null;
  return sleighAt(c.k);
}

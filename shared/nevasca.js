// Bondinho e trenó do Posto Nevasca. A posição sai só do tempo da partida,
// então o offline e todo cliente online veem a mesma coisa.
export const GONDOLA = {
  x: [-1.35, 1.35],
  y: 10,
  zN: 32,
  zS: -32,
  travel: 14,
  dwell: 3.4,
  hx: 1.02,
  hz: 1.12,
  head: 2.2,
};
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

// Quem está dentro da cabine acompanha o deslocamento. Fora dela, nada.
export function rideShift(pos, t, dt) {
  if (!(dt > 0)) return null;
  for (let i = 0; i < 2; i++) {
    const a = gondolaPose(t - dt, i), b = gondolaPose(t, i);
    const lx = pos.x - a.x, ly = pos.y - a.y, lz = pos.z - a.z;
    if (Math.abs(lx) > GONDOLA.hx || Math.abs(lz) > GONDOLA.hz || ly < -0.45 || ly > GONDOLA.head) continue;
    return { x: b.x + lx, y: b.y + Math.max(0, ly), z: b.z + lz, riding: true, floor: ly < 0.35 };
  }
  return null;
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

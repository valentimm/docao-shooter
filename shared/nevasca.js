// Bondinho e trenó do Posto Nevasca. A posição sai só do tempo da partida,
// então o offline e todo cliente online veem a mesma coisa.
export const GONDOLA = {
  x: [-1.35, 1.35],
  y: 12,
  zN: 47,
  zS: -52,
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

export function sleighPose(t) {
  const CYCLE = 30, FLIGHT = 8;
  const u = ((t % CYCLE) + CYCLE) % CYCLE;
  if (u > FLIGHT) return null;
  const k = u / FLIGHT;
  return { x: -52 + k * 104, y: 36 + Math.sin(k * Math.PI) * 2.2, z: -22 + k * 46, k };
}

// Alvo de bônus da Pocilga. Disco na parede do fundo, à frente de quem sobe a rampa.
// Miolo pequeno tira 2 s; o anel soma 2 s. Só o primeiro acerto vale.
// Sem DOM e sem Three.js: o cliente desenha, o ranking confere o raio.
// O número mora em PIT.bonusCut. Aqui só espelha, para o raio e o piso usarem o mesmo 2 s.
let bonusCut = 2;
export function setBonusCut(n) {
  if (Number.isFinite(n) && n >= 0) bonusCut = n;
}
export const BONUS_CENTER = -2;
export const BONUS_RING = 2;

// O plano do miolo fica 11 cm na frente da face da parede (z = 54,95).
// y = 7,18 deixa o disco logo acima do horizonte do corredor de cima.
export const BONUS = {
  id: 'bonus',
  x: 0,
  y: 7.18,
  z: 54.84,
  inner: 0.14,
  outer: 0.65,
  from: { minX: -8, maxX: 30, minY: -0.2, maxY: 9.2, minZ: 18, maxZ: 54.7 },
};

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

export function bonusLine(zone) {
  if (zone === 'center') return '-2s';
  if (zone === 'ring') return '+2s';
  return '—';
}

export function freshBonus() {
  return { locked: false, zone: null, delta: 0, text: '' };
}

export function acceptBonus(state, hit) {
  const cur = state || freshBonus();
  if (!hit || cur.locked) return { ...cur, accepted: false };
  const text = bonusLine(hit.zone);
  return { locked: true, zone: hit.zone, delta: hit.delta, text, accepted: true };
}

export function shotFields(e) {
  return !!(e && [e.ox, e.oy, e.oz, e.dx, e.dy, e.dz, e.w].every(finite));
}

export function bonusShape(e) {
  return !!(e && e.k === 'bonus' && shotFields(e));
}

// Raio contra o disco. A direção é normalizada aqui; t sai em metros.
export function traceBonus(ox, oy, oz, dx, dy, dz, maxT = 80) {
  if (![ox, oy, oz, dx, dy, dz, maxT].every(finite)) return null;
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 1e-8)) return null;
  const ux = dx / len, uy = dy / len, uz = dz / len;
  if (!(uz > 1e-4)) return null;
  const t = (BONUS.z - oz) / uz;
  if (!(t >= 0) || t > maxT) return null;
  const x = ox + ux * t, y = oy + uy * t;
  const dist = Math.hypot(x - BONUS.x, y - BONUS.y);
  if (dist > BONUS.outer + 1e-6) return null;
  const zone = dist <= BONUS.inner + 1e-9 ? 'center' : 'ring';
  const delta = zone === 'center' ? -bonusCut : bonusCut;
  return { t, x, y, z: BONUS.z, dist, zone, delta, ox, oy, oz, dx: ux, dy: uy, dz: uz };
}

function inMouth(e) {
  const b = BONUS.from;
  return e.ox >= b.minX && e.ox <= b.maxX && e.oy >= b.minY && e.oy <= b.maxY && e.oz >= b.minZ && e.oz <= b.maxZ;
}

// O servidor não acredita numa zona escrita no diário: mede o impacto.
export function scoreShot(e, pistol) {
  if (!shotFields(e) || (e.k != null && e.k !== 'bonus') || e.w !== pistol || !inMouth(e)) return null;
  return traceBonus(e.ox, e.oy, e.oz, e.dx, e.dy, e.dz, 80);
}

export function aimAt(ox, oy, oz, x, y) {
  const dx = x - ox, dy = y - oy, dz = BONUS.z - oz;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { ox, oy, oz, dx: dx / len, dy: dy / len, dz: dz / len };
}

// Primeiro raio que realmente acerta. Tiro fora do disco, arma errada ou
// origem fora da rampa não trava o alvo e não muda o tempo.
export function readBonus(events, pistol) {
  const none = { zone: null, delta: 0, dist: null };
  if (!Array.isArray(events)) return none;
  let started = false, finished = false;
  for (const e of events) {
    if (!e) continue;
    if (e.k === 'start') { started = true; continue; }
    if (e.k === 'finish') { finished = true; continue; }
    if (e.k !== 'bonus' || !started || finished) continue;
    const hit = scoreShot(e, pistol);
    if (!hit) continue;
    return { zone: hit.zone, delta: hit.delta, dist: hit.dist };
  }
  return none;
}

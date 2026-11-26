// Capítulos secretos do Modo história. Quatro passos até a wave 20 abrem as waves 21–30.
// A Invasão clássica não lê este arquivo.

export const EGG_CAP = 30;
export const EGG_BASE = 20;

// Bloco 01 da HOTMILK à Noite. Térreo y = 0. Segundo andar y = 3.4.
export const EGG_SPOTS = {
  urinals: [
    { x: -12, y: 0, z: 46.3 },
    { x: -9.2, y: 0, z: 46.3 },
    { x: -6.4, y: 0, z: 46.3 },
  ],
  pool: { x: 0, y: 3.4, z: 22 },
  fridge: { x: 2.6, y: 0, z: 18.2 },
  walls: [
    { id: 'portao', x: 22.6, y: 0, z: 2.6 },
    { id: 'cancela', x: 46.2, y: 0, z: 26.4 },
  ],
};

// Sala de vidro no meio do térreo do Bloco 02. A porta olha para a entrada (+Z).
export const LINK_ROOM = {
  sofa: { x: 0, y: 0, z: -27.45 },
  door: { x: 0, y: 0, z: -25.4 },
  rush: { x: 0, y: 0, z: -24.35 },
  sitYaw: Math.PI,
};
export const LINK_SIT = 15;
export const LINK_SPAWN = 30;
export function linkDoorSolid() {
  return { min: { x: -0.72, y: 0, z: -25.5 }, max: { x: 0.72, y: 2.7, z: -25.28 }, ramp: null };
}
export function linkLocks(humans) { return (humans | 0) > 1; }
export function linkLine(name) {
  return `O player ${name || 'Docão'} ficou trancado na sala da link! Ajudem ele!`;
}

export function createEgg(rnd = Math.random) {
  const roll = rnd();
  return {
    steps: { cria: false, lanche: false, refri: false, muro: false },
    chavi: null,
    chaviDone: false,
    wave: 0,
    secret: false,
    extra: false,
    sodaWave: 1 + Math.floor(roll * EGG_BASE),
    fridge: false,
    drunk: {},
    ritual: {},
    pool: {},
    criaLeft: 0,
    criaArmed: false,
    puddles: [],
  };
}

export function eggComplete(egg) {
  const s = egg && egg.steps;
  return !!(s && s.cria && s.lanche && s.refri && s.muro);
}

export function eggCap(egg) {
  if (!egg) return EGG_BASE;
  if (egg.secret) return EGG_CAP;
  if (egg.extra) return EGG_BASE + 1;
  return EGG_BASE;
}

// No fim da wave: se os quatro fecharam, segue até 30.
// Se os três primeiros fecharam e o controle da cancela ainda vai estrear, abre só a wave 21.
export function eggAfterWave(egg, wave, gateWaiting) {
  if (!egg) return { cap: EGG_BASE, finish: wave >= EGG_BASE };
  if (eggComplete(egg)) egg.secret = true;
  if (wave >= eggCap(egg) && !egg.secret && egg.steps.cria && egg.steps.lanche && egg.steps.refri && gateWaiting && wave === EGG_BASE) {
    egg.extra = true;
  }
  const cap = eggCap(egg);
  return { cap, finish: wave >= cap, opened: egg.secret && cap === EGG_CAP };
}

export function nearSpot(pos, spot, r, y = 1.7) {
  if (!pos || !spot) return false;
  if (Math.abs((pos.y || 0) - (spot.y || 0)) > y) return false;
  return Math.hypot(pos.x - spot.x, pos.z - spot.z) <= r;
}

export function nearestUrinal(pos) {
  if (!pos) return null;
  let best = null, bd = 1e9;
  for (const u of EGG_SPOTS.urinals) {
    const d = Math.hypot(pos.x - u.x, pos.z - u.z);
    if (d < bd) { bd = d; best = u; }
  }
  if (!best || bd > 2.4 || Math.abs((pos.y || 0) - best.y) > 1.7) return null;
  return best;
}

// O mictório fica atrás do corpo. yaw 0 olha para -Z.
export function facingAway(p, spot) {
  if (!p || !spot || !p.pos) return false;
  const fx = -Math.sin(p.yaw || 0), fz = -Math.cos(p.yaw || 0);
  const dx = spot.x - p.pos.x, dz = spot.z - p.pos.z;
  const L = Math.hypot(dx, dz) || 1;
  return (fx * dx + fz * dz) / L < -0.35;
}

export function stepRitual(book, p, T) {
  if (!book || !p || !p.pos || book.steps.cria || book.criaLeft > 0) return null;
  const spot = nearestUrinal(p.pos);
  const rec = book.ritual[p.id] || (book.ritual[p.id] = { n: 0, danced: false, crouch: 0 });
  if (!spot) { rec.n = 0; rec.danced = false; rec.crouch = p.crouch || 0; return null; }
  const c = p.crouch || 0;
  if (rec.crouch < 0.45 && c >= 0.45 && rec.n < 3) rec.n += 1;
  rec.crouch = c;
  if (rec.n >= 3 && p.eggDanceUntil > T) rec.danced = true;
  if (rec.n >= 3 && rec.danced && facingAway(p, spot)) {
    rec.n = 0; rec.danced = false;
    return 'summon';
  }
  return null;
}

export function notePool(book, p, wave) {
  const rec = book.pool[p.id] || (book.pool[p.id] = { wave, n: 0 });
  if (rec.wave !== wave) { rec.wave = wave; rec.n = 0; }
  rec.n += 1;
  return rec.n >= 3 ? 'snack' : rec.n;
}

export function claimMuro(book) {
  if (!book || book.muroTaken || book.steps.muro) return false;
  book.muroTaken = true;
  return true;
}

export function eggPrompt(p, egg) {
  if (!p || !p.pos || !egg || !p.alive) return null;
  if ((egg.wave | 0) >= 21 && !egg.chavi && !egg.chaviDone && !p.eggTrap && nearSpot(p.pos, LINK_ROOM.sofa, 1.6)) return { id: 'sofa', text: '' };
  if (!egg.steps.cria && !egg.criaLeft && nearestUrinal(p.pos)) return { id: 'urina', text: '' };
  if (!egg.steps.lanche && nearSpot(p.pos, EGG_SPOTS.pool, 2.3)) return { id: 'pool', text: '' };
  if (egg.fridge && !egg.drunk[p.id] && nearSpot(p.pos, EGG_SPOTS.fridge, 1.8)) return { id: 'fridge', text: '' };
  if (!egg.muroTaken && !egg.steps.muro && !p.eggShockNext && !p.eggShock) {
    for (const w of EGG_SPOTS.walls) if (nearSpot(p.pos, w, 1.8)) return { id: w.id, text: '' };
  }
  return null;
}

// Revólver do Capataz: tambor, akimbo e cadência por mão. Sem DOM, sem Three.js.
// O tambor da direita mora em e.mag[i] (igual às outras armas). O da esquerda, só no akimbo, mora em e.drum[i].
// drum ausente ou null = cheio (acabou de nascer). Assim um spawn que só preenche mag não deixa a mão esquerda vazia.
import { WEAPONS, PISTOL, SECONDARIES } from './rules.js';
import { falloffMul } from './penetration.js';

export const FUMBLE_CHANCE = 1 / 50;

export function rollFumble(rng = Math.random) {
  return rng() < FUMBLE_CHANCE;
}

function weapon(i) { return WEAPONS[i]; }

export function ensureDrum(e) {
  if (!e.drum) e.drum = WEAPONS.map(() => null);
  while (e.drum.length < WEAPONS.length) e.drum.push(null);
  return e.drum;
}

// renascimento: os dois tambores voltam cheios. Sem isso a mão esquerda lembraria a vida anterior.
export function resetDrums(e) {
  e.drum = WEAPONS.map((w) => (w.akimbo ? w.mag : null));
}

export function setDrum(e, i, n) {
  ensureDrum(e);
  e.drum[i] = n;
}

export function rounds(e, i, hand = 0) {
  const W = weapon(i);
  if (!W) return 0;
  if (hand === 1 && W.akimbo) {
    if (!e.drum || e.drum[i] == null) return W.mag;
    return e.drum[i] | 0;
  }
  return e.mag[i] | 0;
}

export function drumsFull(e, i) {
  const W = weapon(i);
  if (!W || W.melee) return true;
  if (!W.akimbo) return (e.mag[i] | 0) >= W.mag;
  return rounds(e, i, 0) >= W.mag && rounds(e, i, 1) >= W.mag;
}

export function drumsEmpty(e, i) {
  const W = weapon(i);
  if (!W) return true;
  if (!W.akimbo) return (e.mag[i] | 0) <= 0;
  return rounds(e, i, 0) <= 0 && rounds(e, i, 1) <= 0;
}

// ocioso: recarrega com meio tambor (akimbo: os dois juntos não passam de um tambor).
export function ammoLow(e, i) {
  const W = weapon(i);
  if (!W || W.melee || !(W.mag > 0)) return false;
  if (!W.akimbo) return (e.mag[i] | 0) < W.mag * 0.5;
  return rounds(e, i, 0) + rounds(e, i, 1) <= W.mag;
}

export function spendRound(e, i, hand = 0) {
  const W = weapon(i);
  if (!W) return false;
  if (!W.akimbo || hand !== 1) {
    if ((e.mag[i] | 0) <= 0) return false;
    e.mag[i]--;
    return true;
  }
  ensureDrum(e);
  if (e.drum[i] == null) e.drum[i] = W.mag;
  if (e.drum[i] <= 0) return false;
  e.drum[i]--;
  return true;
}

// enche os tambores gastando a reserva. infinite: Gunfight, a reserva não desce (o pente continua finito).
export function refillDrums(e, i, infinite = false) {
  const W = weapon(i);
  if (!W || !(W.mag > 0)) return 0;
  const poolOf = () => infinite ? 1e9 : (e.reserve[i] | 0);
  if (!W.akimbo) {
    const n = Math.min(Math.max(0, W.mag - (e.mag[i] | 0)), poolOf());
    if (n > 0) { e.mag[i] += n; if (!infinite) e.reserve[i] -= n; }
    return n;
  }
  ensureDrum(e);
  let right = e.mag[i] | 0;
  let left = e.drum[i] == null ? W.mag : e.drum[i] | 0;
  let pool = poolOf();
  const takeR = Math.min(Math.max(0, W.mag - right), pool);
  right += takeR; pool -= takeR;
  const takeL = Math.min(Math.max(0, W.mag - left), pool);
  left += takeL; pool -= takeL;
  e.mag[i] = right; e.drum[i] = left;
  if (!infinite) e.reserve[i] = pool;
  return takeR + takeL;
}

// bot akimbo: escolhe a mão que já pode atirar (cada uma no próprio relógio) e alterna.
// slack > 1 deixa o bot mais lento (mira pior atira mais devagar). Devolve 0, 1 ou -1.
export function akimboReady(b, i, now, slack = 1) {
  const W = weapon(i);
  if (!W || !W.akimbo) return -1;
  const rate = W.rate * slack;
  if (!b.handAt) b.handAt = [-9, -9];
  const ready = [];
  if (rounds(b, i, 0) > 0 && now >= b.handAt[0] + rate) ready.push(0);
  if (rounds(b, i, 1) > 0 && now >= b.handAt[1] + rate) ready.push(1);
  if (!ready.length) return -1;
  const prefer = b.handLast === 0 ? 1 : 0;
  const h = ready.includes(prefer) ? prefer : ready[0];
  b.handAt[h] = now;
  b.handLast = h;
  return h;
}

// peso: a maioria continua de pistola; alguns sacam o Capataz, poucos os dois.
const BOT_SIDE = [PISTOL, PISTOL, PISTOL, PISTOL, PISTOL, PISTOL, 23, 23, 24];
export function pickBotSecondary(weapons, rng = Math.random) {
  const pool = BOT_SIDE.filter((i) => SECONDARIES.includes(i) && (!weapons || weapons.includes(i)));
  if (!pool.length) return PISTOL;
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

export function damageAt(W, dist, head = false) {
  if (!W) return 0;
  return W.dmg * (head ? W.headMul : 1) * falloffMul(W, dist);
}

export function shotsToKill(dmg, hp = 100) {
  if (!(dmg > 0)) return Infinity;
  return Math.ceil((hp - 1e-9) / dmg);
}

// tempo entre o primeiro tiro e o que mata (o primeiro sai na hora).
export function ttk(dmg, rate, hp = 100) {
  const n = shotsToKill(dmg, hp);
  if (!Number.isFinite(n)) return Infinity;
  return Math.max(0, n - 1) * rate;
}

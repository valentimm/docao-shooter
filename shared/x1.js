// ============================================================
//  X1: duelo. Mapa pequeno sorteado, um Docão de cada lado,
//  primeiro a 10 abates. Só caixa de munição. Os dois ficam
//  com a mesma arma, e ela troca toda vez que alguém cai.
// ============================================================
import { COMMANDO, UZI, P90, FAMAS, SEMI, LMG, PISTOL, NAIL, CROSS, BOW, DISC_W, CORN_W, EGG_W, REV, REV2, GIFT_W } from './rules.js';

export const X1 = { mode: 'x1', KILLS: 10, MAX: 2 };
export const isX1 = (m) => m === X1.mode;

// Armas de tiro (sem faca, sabre, tampa nem minigun): a caixa de munição precisa servir.
export const X1_GUNS = [0, COMMANDO, UZI, P90, FAMAS, 1, SEMI, 2, 5, 6, 3, LMG, PISTOL, NAIL, CROSS, BOW, DISC_W, CORN_W, EGG_W, REV, REV2, GIFT_W];

// Lado do spawn: x negativo = oeste (0), x positivo = leste (1).
export const x1SpawnSide = (spawn) => (spawn.x < 0 ? 0 : 1);

// Arma nova, diferente da atual quando der. `allowed(i)` corta arma banida na sala.
export function rollX1Weapon(prev, allowed = () => true) {
  const ok = (i) => allowed(i);
  let pool = X1_GUNS.filter((i) => i !== prev && ok(i));
  if (!pool.length) pool = X1_GUNS.filter(ok);
  if (!pool.length) pool = X1_GUNS.filter((i) => i !== prev);
  if (!pool.length) pool = X1_GUNS.slice();
  return pool[(Math.random() * pool.length) | 0];
}

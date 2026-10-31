// ============================================================
//  Caixote da Primeira Safra: skins de arma e faca saem daqui, não da loja.
//  O peso do catálogo (weight) é a faixa da sorte. Quem já tem a skin ganha Docoins (10% do peso).
//  O 1% é o peso 1250 (Rainbow). Sem essa faixa, a Rainbow não saía em caixa nenhuma.
// ============================================================
import { ITEMS } from './closet.js';

export const BOX_ID = 'safra1';
export const BOX_NAME = 'Caixote da Primeira Safra';
export const BOX_EMOJI = '🌽';
// bp = pontos em 10.000 (72,5% = 7250). A soma é 10.000.
export const ODDS = [
  { weight: 500, bp: 7250 },
  { weight: 750, bp: 1600 },
  { weight: 1000, bp: 1000 },
  { weight: 1250, bp: 100 },
  { weight: 2000, bp: 50 },
];
export const DUPE_RATE = 0.1;
export const dupeCoins = (weight) => Math.max(1, Math.round((weight | 0) * DUPE_RATE));
export const lootItems = () => ITEMS.filter((i) => i.loot && i.weight > 0);
export const lootPool = (weight) => lootItems().filter((i) => i.weight === weight);

export function tierOf(ticket) {
  const n = Math.max(0, Math.min(9999, ticket | 0));
  let acc = 0;
  for (const o of ODDS) { acc += o.bp; if (n < acc) return o.weight; }
  return ODDS[ODDS.length - 1].weight;
}

// rng() devolve um número em [0, 1). O primeiro sorteia a faixa; o segundo, a skin dentro dela.
export function rollBox(rng) {
  const weight = tierOf(Math.floor(rng() * 10000));
  const pool = lootPool(weight);
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

// ============================================================
//  Caixote da Primeira Safra: skins de arma e faca saem daqui, não da loja.
//  O peso do catálogo (weight) é a faixa da sorte. Quem já tem a skin ganha Docoins (10% do peso).
//  O 1% é o peso 1250 (Rainbow). Sem essa faixa, a Rainbow não saía em caixa nenhuma.
// ============================================================
import { ITEMS, itemById } from './closet.js';

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

// Roleta: 3 skins saem da mochila. O piso é o maior peso das três.
// Cada faixa acima do piso sai com o dobro da chance do caixote. O resto fica no piso.
export const WHEEL_SIZE = 3;
export const WHEEL_BOOST = 2;

export function wheelInputs(ids) {
  if (!Array.isArray(ids) || ids.length !== WHEEL_SIZE) return null;
  const items = [];
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== 'string' || id.length > 8 || seen.has(id)) return null;
    const it = itemById(id);
    if (!it || !it.loot || !(it.weight > 0)) return null;
    seen.add(id);
    items.push(it);
  }
  return items;
}

export const wheelFloor = (items) => items.reduce((m, it) => Math.max(m, it.weight | 0), 0);

// bp soma 10.000. Sem faixa acima do piso, o resultado é sempre o piso.
export function wheelTable(floor) {
  const tiers = ODDS.filter((o) => o.weight >= floor);
  const row = tiers.find((o) => o.weight === floor);
  if (!row) return null;
  let above = tiers.filter((o) => o.weight > floor).map((o) => ({ weight: o.weight, bp: o.bp * WHEEL_BOOST }));
  let used = above.reduce((s, o) => s + o.bp, 0);
  if (used > 9999) {
    const room = 9999;
    above = above.map((o) => ({ weight: o.weight, bp: Math.floor((o.bp * room) / used) }));
    used = above.reduce((s, o) => s + o.bp, 0);
    above[above.length - 1].bp += room - used;
    used = room;
  }
  return [{ weight: floor, bp: 10000 - used }, ...above];
}

export function wheelTier(floor, ticket) {
  const table = wheelTable(floor);
  if (!table) return null;
  const n = Math.max(0, Math.min(9999, ticket | 0));
  let acc = 0;
  for (const o of table) { acc += o.bp; if (n < acc) return o.weight; }
  return table[table.length - 1].weight;
}

export function rollWheel(items, rng) {
  const floor = wheelFloor(items);
  const weight = wheelTier(floor, Math.floor(rng() * 10000));
  if (weight == null || weight < floor) return null;
  const pool = lootPool(weight);
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

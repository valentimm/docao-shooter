// Caixote da Primeira Safra (sem navegador): faixas, catálogo e pagamento de repetida.
// Uso: node test-lootbox.mjs
import { ITEMS, itemById, isFreeItem } from './shared/closet.js';
import { BOX_ID, BOX_NAME, ODDS, DUPE_RATE, dupeCoins, lootItems, lootPool, tierOf, rollBox, WHEEL_SIZE, wheelInputs, wheelFloor, wheelTable, wheelTier, rollWheel } from './shared/lootbox.js';
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(BOX_ID === 'safra1' && BOX_NAME === 'Caixote da Primeira Safra', 'nome da primeira temporada da granja');
ok(ODDS.reduce((s, o) => s + o.bp, 0) === 10000, 'as chances somam 100%');
ok(tierOf(0) === 500 && tierOf(7249) === 500 && tierOf(7250) === 750 && tierOf(8849) === 750, '72,5% peso 500 e 16% peso 750');
ok(tierOf(8850) === 1000 && tierOf(9849) === 1000 && tierOf(9850) === 1250 && tierOf(9949) === 1250, '10% peso 1000 e 1% peso 1250');
ok(tierOf(9950) === 2000 && tierOf(9999) === 2000, '0,5% peso 2000');
ok(ODDS.every((o) => lootPool(o.weight).length > 0), 'cada faixa tem skin pra sair');
ok([500, 750, 1000, 1250, 2000].every((w) => dupeCoins(w) === Math.round(w * DUPE_RATE)), 'repetida paga 10% do peso em Docoins');

const guns = ['pistol', 'sniper', 'p90', 'carabina', 'rifle'];
const knives = ['skeleton', 'karambit', 'bayonet', 'butterfly'];
const has = (gun, paint, weight) => lootItems().some((i) => i.gun === gun && i.paint === paint && i.weight === weight);
ok(guns.every((g) => has(g, 'camo', 500)) && knives.every((k) => lootItems().some((i) => i.knife === k && i.finish === 'camo' && i.weight === 500)), 'camuflagem peso 500 em todas as armas e facas');
ok(guns.every((g) => has(g, 'rust', 750)), 'ferrugem peso 750 nas cinco armas');
ok(guns.every((g) => has(g, 'waves', 1000)), 'ferrugem waves peso 1000 nas cinco armas');
ok(has('pistol', 'rainbow', 1250) && lootItems().filter((i) => i.paint === 'rainbow' && i.gun).length === 1, 'pistola rainbow peso 1250');
ok(has('rifle', 'gold', 2000) && itemById('t1') && itemById('t1').weight === 2000 && itemById('t1').loot, 'fuzil gold e a lore no peso 2000');
ok(lootPool(500).length === 13 && lootPool(750).length === 9 && lootPool(1000).length === 17 && lootPool(1250).length === 5 && lootPool(2000).length === 2, 'tamanho de cada faixa (facas que já existiam + pinturas novas)');
ok(lootItems().every((i) => [500, 750, 1000, 1250, 2000].includes(i.weight) && !isFreeItem(i.id) && !(i.price > 0)), 'só entra skin de arma ou faca, com peso e sem preço');
ok(ITEMS.filter((i) => i.loot).length === lootItems().length, 'o caixote usa o catálogo inteiro de skins de arma e faca');

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const n = 40000, hit = {};
const rng = mulberry32(20261030);
for (let i = 0; i < n; i++) { const it = rollBox(rng); if (!it) { hit.vazio = (hit.vazio || 0) + 1; continue; } hit[it.weight] = (hit[it.weight] || 0) + 1; }
const near = (w, bp) => Math.abs((hit[w] || 0) / n - bp / 10000) < 0.015;
ok(!hit.vazio && near(500, 7250) && near(750, 1600) && near(1000, 1000) && near(1250, 100) && near(2000, 50), `sorteio de ${n}: ${JSON.stringify(hit)}`);

const pool = (w) => lootPool(w);
const t500 = wheelTable(500), bpOf = (table, w) => table.find((o) => o.weight === w).bp;
ok(t500.reduce((s, o) => s + o.bp, 0) === 10000 && bpOf(t500, 500) === 4500 && bpOf(t500, 750) === 3200 && bpOf(t500, 1000) === 2000 && bpOf(t500, 1250) === 200 && bpOf(t500, 2000) === 100, 'roleta no piso 500: dobro das faixas de cima e o resto no piso');
for (const floor of [750, 1000, 1250, 2000]) {
  const table = wheelTable(floor);
  ok(table.reduce((s, o) => s + o.bp, 0) === 10000, `roleta no piso ${floor} soma 100%`);
  ok(table[0].weight === floor && table.every((o) => o.weight >= floor), `roleta no piso ${floor} não desce de raridade`);
  ok(table.filter((o) => o.weight > floor).every((o) => o.bp === ODDS.find((x) => x.weight === o.weight).bp * 2), `roleta no piso ${floor} dobra a chance do caixote nas faixas de cima`);
}
ok(wheelTable(2000)[0].bp === 10000 && wheelTier(2000, 0) === 2000 && wheelTier(2000, 9999) === 2000, 'três skins no peso máximo devolvem o mesmo peso');
ok(wheelTier(500, 0) === 500 && wheelTier(500, 4499) === 500 && wheelTier(500, 4500) === 750 && wheelTier(500, 9999) === 2000, 'faixas da roleta no piso 500');
const low = pool(500), high = pool(2000), mid = pool(1250);
ok(wheelInputs([low[0].id, low[0].id, low[1].id]) === null && wheelInputs([low[0].id, low[1].id]) === null && wheelInputs([low[0].id, low[1].id, ITEMS.find((i) => !i.loot).id]) === null, 'roleta recusa repetida, menos de 3 e item que não é skin');
ok(wheelInputs([low[0].id, low[1].id, high[0].id]).length === WHEEL_SIZE && wheelFloor(wheelInputs([low[0].id, mid[0].id, high[0].id])) === 2000, 'o piso é o maior peso das 3');
const rngW = mulberry32(20261030);
const hitW = {}, nW = 20000, trio = [low[0], low[1], low[2]];
for (let i = 0; i < nW; i++) { const it = rollWheel(trio, rngW); if (!it || it.weight < 500) { hitW.ruim = (hitW.ruim || 0) + 1; continue; } hitW[it.weight] = (hitW[it.weight] || 0) + 1; }
const nearW = (w, bp) => Math.abs((hitW[w] || 0) / nW - bp / 10000) < 0.015;
ok(!hitW.ruim && nearW(500, 4500) && nearW(750, 3200) && nearW(1000, 2000) && nearW(1250, 200) && nearW(2000, 100), `roleta de ${nW}: ${JSON.stringify(hitW)}`);
const rngTop = mulberry32(11);
let dropped = 0;
for (let i = 0; i < 2000; i++) { const it = rollWheel([high[0], mid[0], low[0]], rngTop); if (!it || it.weight !== 2000) dropped++; }
ok(!dropped, 'com uma skin de peso 2000, a roleta não entrega menos que isso');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK'); process.exit(fails.length ? 1 : 0);

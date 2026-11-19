// Caixote do top 4: só com mais de 6 humanos. Uso: node test-map-box.mjs
import { MAP_BOX_TOP, MAP_BOX_MIN_HUMANS } from './shared/lootbox.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(MAP_BOX_TOP === 4 && MAP_BOX_MIN_HUMANS === 7, 'top 4 e mínimo 7 humanos (mais de 6)');

// Espelha a regra do servidor sem subir a sala
function winners(rows, humanCount) {
  if (humanCount < MAP_BOX_MIN_HUMANS) return [];
  return rows.filter((e) => !e.bot && e.acct).slice(0, MAP_BOX_TOP).map((e) => e.acct);
}
const board = [
  { bot: false, acct: 1, kills: 10 },
  { bot: false, acct: 2, kills: 9 },
  { bot: true, acct: null, kills: 8 },
  { bot: false, acct: 3, kills: 7 },
  { bot: false, acct: 4, kills: 6 },
  { bot: false, acct: 5, kills: 5 },
];
ok(winners(board, 6).length === 0, 'com 6 humanos ninguém ganha caixote');
ok(JSON.stringify(winners(board, 7)) === JSON.stringify([1, 2, 3, 4]), 'com 7+ humanos os 4 melhores com conta ganham');
ok(winners(board, 12).length === 4, 'nunca passa de 4 caixotes');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

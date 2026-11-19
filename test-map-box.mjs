// Caixote do top 4: sorteia 1 ganhador, só com mais de 6 humanos. Uso: node test-map-box.mjs
import { MAP_BOX_TOP, MAP_BOX_MIN_HUMANS, pickMapBoxWinner } from './shared/lootbox.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(MAP_BOX_TOP === 4 && MAP_BOX_MIN_HUMANS === 7, 'top 4 no sorteio e mínimo 7 humanos (mais de 6)');

const board = [
  { bot: false, acct: 1, kills: 10 },
  { bot: false, acct: 2, kills: 9 },
  { bot: true, acct: null, kills: 8 },
  { bot: false, acct: 3, kills: 7 },
  { bot: false, acct: 4, kills: 6 },
  { bot: false, acct: 5, kills: 5 },
];
const ranked = board.filter((e) => !e.bot && e.acct);
ok(pickMapBoxWinner(ranked, 6) === null, 'com 6 humanos ninguém ganha caixote');
ok(pickMapBoxWinner([], 7) === null, 'sem candidatos não sorteia');
ok(pickMapBoxWinner(ranked, 7, () => 0).acct === 1, 'rng 0 pega o 1º do top 4');
ok(pickMapBoxWinner(ranked, 7, () => 0.99).acct === 4, 'rng alto pega o 4º do top 4');
ok(pickMapBoxWinner(ranked, 12, () => 0.5).acct === 3, 'com 7+ humanos só um dos top 4 ganha');
const seen = new Set();
for (let i = 0; i < 200; i++) {
  const w = pickMapBoxWinner(ranked, 8, () => (i % 4) / 4);
  seen.add(w.acct);
}
ok([...seen].sort().join(',') === '1,2,3,4' && !seen.has(5), 'o sorteio fica só entre os 4 melhores com conta');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

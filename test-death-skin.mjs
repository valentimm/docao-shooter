// Qual skin equipada dispara o dragão ou as moedas na morte.
// Uso: node test-death-skin.mjs
import { ITEMS } from './shared/closet.js';
import { deathSkinShow } from './shared/death-skin.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const idOf = (pred) => { const it = ITEMS.find(pred); return it && it.id; };
const loreSniper = idOf((i) => i.sniper === 'lore' && i.gun === 'sniper');
const loreRifle = idOf((i) => i.gun === 'rifle' && i.paint === 'lore');
const goldRifle = idOf((i) => i.gun === 'rifle' && i.paint === 'gold');
const plainRifle = idOf((i) => i.gun === 'rifle' && i.paint === 'camo');

ok(!!loreSniper && !!loreRifle && !!goldRifle, 'existem a Docão Lore da Torresmo, a do fuzil e o Gold Docão');

const none = deathSkinShow(null);
ok(!none.dragon && !none.coins, 'sem conta não tem efeito');
const empty = deathSkinShow({});
ok(!empty.dragon && !empty.coins, 'conta sem skin não tem efeito');

const sniper = deathSkinShow({ sniper: loreSniper, guns: {} });
ok(sniper.dragon && !sniper.coins, 'Torresmo Docão Lore solta o dragão');

const rifle = deathSkinShow({ guns: { rifle: loreRifle } });
ok(rifle.dragon && !rifle.coins, 'Fuzil Docão Lore solta o dragão');

const gold = deathSkinShow({ guns: { rifle: goldRifle } });
ok(!gold.dragon && gold.coins, 'Fuzil Gold Docão solta as moedas');

const both = deathSkinShow({ sniper: loreSniper, guns: { rifle: goldRifle } });
ok(both.dragon && both.coins, 'Lore na Torresmo e Gold no fuzil saem juntos');

const other = deathSkinShow({ sniper: plainRifle, guns: { rifle: plainRifle } });
ok(!other.dragon && !other.coins, 'outra pintura não dispara nada');

if (fails.length) { console.log('FALHOU: ' + fails.join(' | ')); process.exit(1); }
console.log('TUDO OK');

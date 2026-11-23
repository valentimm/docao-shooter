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

const remote = deathSkinShow({ sniper: loreSniper, guns: {}, yaw: 1.2, isPlayer: false, remote: true, bot: false });
ok(remote.dragon && !remote.coins, 'entidade remota com Torresmo Lore dispara o dragão');

const remoteRifle = deathSkinShow({ guns: { rifle: loreRifle }, yaw: 0.4, isPlayer: false, remote: true });
ok(remoteRifle.dragon && !remoteRifle.coins, 'entidade remota com Fuzil Lore dispara o dragão');

const remoteGold = deathSkinShow({ guns: { rifle: goldRifle }, yaw: -0.8, isPlayer: false, remote: true });
ok(!remoteGold.dragon && remoteGold.coins, 'entidade remota com Fuzil Gold dispara as moedas');

const botLore = deathSkinShow({ sniper: loreSniper, guns: { rifle: goldRifle }, yaw: 2, isPlayer: false, bot: true });
ok(botLore.dragon && botLore.coins, 'bot com Lore e Gold equipados dispara os dois');

const botPlain = deathSkinShow({ bot: true, isPlayer: false, yaw: 0, guns: {} });
ok(!botPlain.dragon && !botPlain.coins, 'bot sem essas skins não dispara efeito');

if (fails.length) { console.log('FALHOU: ' + fails.join(' | ')); process.exit(1); }
console.log('TUDO OK');

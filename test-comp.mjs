// Regras do competitivo, sem navegador: node test-comp.mjs
import { newBombState, startRound, stepBomb, attackTeam } from './shared/bomb.js';
import { COMP, normSide, sideSlots, compAttackTeam, isPistolRound, compOver, armComp, buyWeapon, buyArmor, buyUtil, mitigate, payRound, payKill, compEnterRound, isExplosiveWeapon, stripToPistol, flashSeconds } from './shared/comp.js';
import { PISTOL, KNIFE } from './shared/rules.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(normSide(3) === 3 && normSide(4) === 4 && normSide(5) === 5 && normSide(2) === 5 && normSide(9) === 5, 'time só aceita 3, 4 ou 5');
ok(sideSlots(3) === 6 && sideSlots(4) === 8 && sideSlots(5) === 10, 'vagas são o dobro do lado');

ok(compAttackTeam(1) === 0 && compAttackTeam(12) === 0 && compAttackTeam(13) === 1 && compAttackTeam(24) === 1, 'primeiro tempo Vermelho planta, segundo tempo Azul');
ok(compAttackTeam(25) === 0 && compAttackTeam(26) === 1 && compAttackTeam(27) === 0, 'prorrogação troca o lado a cada rodada');
ok(isPistolRound(1) && !isPistolRound(2) && !isPistolRound(12) && isPistolRound(13) && !isPistolRound(14), 'pistola no começo e na troca do segundo tempo');
ok(isPistolRound(25) && isPistolRound(26) && isPistolRound(27), 'cada troca da prorrogação é rodada de pistola');

ok(compOver([13, 0]) && compOver([13, 11]) && !compOver([12, 12]) && !compOver([13, 12]) && compOver([14, 12]) && compOver([15, 13]), '13 encerra; 12 a 12 e 13 a 12 seguem; dois de diferença encerra');

const guy = () => ({ team: 0, alive: true, cash: 800, armor: 0, helmet: false, loss: 0, bot: false, mag: [], reserve: [], slots: [PISTOL, PISTOL, KNIFE], primary: PISTOL, secondary: PISTOL, melee: KNIFE, weapon: PISTOL });
const a = guy(), b = { ...guy(), team: 1, alive: false, cash: 200, loss: 4 };
payKill(a);
ok(a.cash === 800 + COMP.KILL, 'abate paga 300');
payRound([a, b], 0);
ok(a.cash === 800 + COMP.KILL + COMP.WIN_PAY && a.loss === 0 && a.keepKit === true, 'vitória paga 3250 e zera a sequência de derrota');
ok(b.cash === 200 + COMP.LOSS[4] && b.loss === 5 && b.keepKit === false, 'derrota no teto paga 3400');

const pistol = guy(); pistol.cash = 5000; pistol.armor = 80; pistol.helmet = true; pistol.keepKit = true; pistol.primary = 0; pistol.slots = [0, PISTOL, KNIFE];
compEnterRound(pistol, 13);
ok(pistol.cash === COMP.START && pistol.armor === 0 && !pistol.helmet && pistol.slots[0] === PISTOL, 'troca de lado zera em 800, sem colete e de pistolinha');

const rich = guy(); rich.cash = 4000; rich.keepKit = false; rich.alive = false;
payRound([rich], 1);
compEnterRound(rich, 2);
ok(rich.slots[0] === PISTOL && rich.armor === 0 && rich.cash === 4000 + COMP.LOSS[0], 'quem morreu perde a arma e fica com a grana');

const lived = guy(); lived.cash = 1000; lived.primary = 0; lived.slots = [0, PISTOL, KNIFE]; lived.weapon = 0; lived.armor = 40; lived.helmet = false; lived.keepKit = true;
compEnterRound(lived, 3);
ok(lived.slots[0] === 0 && lived.armor === 40 && lived.cash === 1000, 'quem sobreviveu leva a arma e o colete pra próxima');

const shop = guy();
ok(!buyWeapon(shop, 3, true).ok && isExplosiveWeapon(3), 'bazuca não entra');
ok(!buyWeapon(shop, 0, true).ok && shop.cash === 800, 'rodada de pistola não vende fuzil');
ok(buyArmor(shop, 'vest').ok && shop.armor === 100 && shop.cash === 800 - COMP.VEST, 'colete custa 650 e não muda skin');
ok(!buyArmor(shop, 'helmet').ok, 'capacete não cabe com 150 de sobra');
shop.cash = 350;
ok(buyArmor(shop, 'helmet').ok && shop.helmet, 'capacete pede colete e custa 350');
shop.cash = 800;
ok(buyUtil(shop, 'flash').ok && shop.flashNades === 1 && shop.cash === 600, 'flashbang custa 200');
ok(buyUtil(shop, 'smoke').ok && shop.smokeNades === 1, 'fumaça entra na loja');
ok(buyUtil(shop, 'nade').ok && shop.nades === 1, 'copo bomba entra na loja');
ok(!buyUtil(shop, 'smoke').ok && shop.smokeNades === 1, 'fumaça para em uma');
const livedNade = guy(); livedNade.keepKit = true; livedNade.flashNades = 2; livedNade.nades = 1;
compEnterRound(livedNade, 3);
ok(livedNade.flashNades === 2 && livedNade.nades === 1, 'quem sobreviveu leva a granada');
const deadNade = guy(); deadNade.keepKit = false; deadNade.nades = 2; deadNade.flashNades = 1; deadNade.smokeNades = 1;
compEnterRound(deadNade, 2);
ok(deadNade.nades === 0 && deadNade.flashNades === 0 && deadNade.smokeNades === 0, 'quem morreu perde a granada');
ok(flashSeconds(2, 1) > flashSeconds(2, -1) && flashSeconds(30, 1) === 0, 'flash de frente cega mais e longe não cega');

const bare = guy(); bare.armor = 0;
ok(mitigate(bare, 40, false) === 40, 'sem colete o tiro entra inteiro');
const vest = guy(); vest.armor = 100;
ok(mitigate(vest, 40, false) === 20 && vest.armor === 80, 'colete absorve metade do corpo');
ok(mitigate(vest, 40, true) === 40 && vest.armor === 80, 'cabeça ignora colete sem capacete');
vest.helmet = true;
ok(mitigate(vest, 40, true) === 20 && vest.armor === 60, 'capacete faz a cabeça passar pelo colete');
vest.armor = 10;
ok(mitigate(vest, 40, false) === 30 && vest.armor === 0 && !vest.helmet, 'colete que acaba derruba o capacete');

const S = newBombState();
let swapAt = 0;
for (let i = 0; i < 14; i++) {
  const ev = startRound(S, i, [{ id: 1, team: 0, alive: true, pos: { x: 0, y: 0, z: 0 }, isPlayer: true }]);
  if (ev.some((e) => e[0] === 'swap')) swapAt = S.round;
}
ok(swapAt === 13 && attackTeam(12) === 0 && attackTeam(13) === 1, 'protótipo da bomba continua trocando só na 13ª');

const C = armComp(newBombState());
const ents = [
  { id: 1, team: 0, alive: true, pos: { x: 0, y: 0, z: 0 } },
  { id: 2, team: 1, alive: true, pos: { x: 3, y: 0, z: 0 } },
];
startRound(C, 0, ents);
C.phase = 'live'; C.phaseEnd = 1000;
ents[0].alive = false;
const elim = stepBomb(C, ents, 1, 0.05, [{ x: 10, y: 0, z: 0 }, { x: -10, y: 0, z: 0 }]);
ok(elim.some((e) => e[0] === 'win' && e[1] === 1 && e[2] === 'elim'), 'sem atacante vivo a defesa leva a rodada');

const proto = newBombState();
startRound(proto, 0, ents);
proto.phase = 'live'; proto.phaseEnd = 1000;
ents[0].alive = false; ents[1].alive = true;
const still = stepBomb(proto, ents, 1, 0.05, [{ x: 10, y: 0, z: 0 }, { x: -10, y: 0, z: 0 }]);
ok(!still.some((e) => e[0] === 'win'), 'protótipo da bomba não acaba por eliminação');

stripToPistol(lived);
ok(lived.weapon === PISTOL && lived.melee === KNIFE, 'volta pra pistolinha e faca');

if (fails.length) { console.error(fails.length + ' falha(s)'); process.exit(1); }
console.log('competitivo ok');

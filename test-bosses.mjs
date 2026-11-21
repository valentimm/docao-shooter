// Chefões da Invasão: rotação, peso da horda e os zumbis novos. Uso: node test-bosses.mjs
import { BOSS_TYPES, bossOfWave, isBoss, waveSpec, waveQueue, zombieWeight, zombieTaken, shuffleBosses, ZOMBIES, INV, InvasionCore } from './shared/invasion.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(BOSS_TYPES.length === 7 && BOSS_TYPES.includes('boss') && BOSS_TYPES.includes('bossBelly') && BOSS_TYPES.includes('bossHosp'), '7 chefões, com Abóbora, Barriguinha e Hospício');
ok(isBoss('boss') && isBoss('bossHosp') && isBoss('bossCrazy') && !isBoss('tank') && !isBoss('cry'), 'isBoss reconhece só chefões');
ok(bossOfWave(5) === 'boss' && bossOfWave(10) === 'bossBelly' && bossOfWave(15) === 'bossGhost', 'ciclo reserva 5/10/15: Abóbora, Barriguinha, Fantasma');
ok(bossOfWave(20) === 'bossMummy' && bossOfWave(25) === 'bossWolf' && bossOfWave(30) === 'bossCrazy', 'ciclo reserva 20+: Múmia, Lobisomem, Louco');
ok(ZOMBIES.bossBelly.spit.pee && ZOMBIES.bossGhost.phaseEvery && ZOMBIES.bossMummy.spit.wrap && ZOMBIES.bossWolf.howl && ZOMBIES.bossCrazy.spit.volley === 3, 'poderes: mijo, fase, atadura, uivo, rajada');
ok(ZOMBIES.bossHosp.sling && ZOMBIES.bossHosp.howl && ZOMBIES.bossHosp.surgeAt === 0.5, 'Hospício: investida curta e surto abaixo da metade');
const s = waveSpec(10, 2);
ok(s.boss && s.bossKind === 'bossBelly' && s.bossHp > ZOMBIES.boss.hp, `spec reserva da wave 10 ainda aponta a Barriguinha (${Math.round(s.bossHp)})`);
ok(INV.BOSS_EVERY === 5, 'chefão a cada 5 waves');

const mul = (w) => waveSpec(w, 1).bossHp / ZOMBIES.boss.hp;
ok(mul(20) > mul(10) && mul(10) > mul(5) && Math.abs(mul(5) - 1) < 1e-6, 'vida do chefão cresce com a wave (wave 5 = base)');
ok(Math.round(ZOMBIES.bossHosp.hp * mul(20)) > Math.round(ZOMBIES.boss.hp * mul(5)), 'Hospício na wave 20 tem mais vida que a Abóbora na wave 5');

const orderA = shuffleBosses(() => 0.15);
const orderB = shuffleBosses(() => 0.85);
ok(orderA.length === 7 && new Set(orderA).size === 7 && new Set(orderB).size === 7, 'embaralhamento usa cada chefão uma vez');
ok(orderA.join() !== orderB.join(), 'sementes diferentes trocam a ordem');

const events = [];
const core = new InvasionCore({
  size: [20, 20], T: () => 8, nav: null, rnd: () => 0.2,
  players: () => [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 } }],
  emit(ev) { events.push(ev); },
});
core.startWave(5);
ok(core.spec.bossKind === core.bossOrder[0], 'wave 5 usa o primeiro chefão embaralhado da partida');
const banner = events.find((ev) => ev[0] === 'wv' && ev[1] === 1);
ok(banner && banner[3] === BOSS_TYPES.indexOf(core.spec.bossKind) + 1, 'o anúncio da wave leva o índice do chefão de verdade');
core.startWave(10);
ok(core.spec.bossKind === core.bossOrder[1] && core.spec.bossKind !== core.bossOrder[0], 'wave 10 pega o próximo da mesma ordem, sem repetir o primeiro');

const q1 = waveQueue(waveSpec(1, 1), () => 0.5);
ok(q1.length === 18 && q1.every((t) => t === 'walker'), 'wave 1 gasta o orçamento inteiro em podres (peso 1)');
const tanks = waveQueue({ total: 12, mix: { tank: 1 } }, () => 0);
ok(tanks.length === 2 && tanks.every((t) => t === 'tank') && zombieWeight('tank') > zombieWeight('walker'), 'tanque pesa mais: 12 de orçamento viram 2 corpos');
const mixed = waveQueue(waveSpec(12, 1), () => 0.4);
const spent = mixed.reduce((a, t) => a + zombieWeight(t), 0);
ok(spent <= waveSpec(12, 1).total + 1e-6 && spent > waveSpec(12, 1).total - zombieWeight('tank'), 'a mistura da wave 12 cabe no orçamento');

const crying = { zt: 'cry', hp: 190, maxHp: 190, mood: 'cry' };
ok(Math.abs(zombieTaken(crying, 10) - 4) < 1e-6 && crying.mood === 'cry', 'chorona chorando toma 40% do dano');
crying.hp = 50;
zombieTaken(crying, 10);
ok(crying.mood === 'rage', 'só no tiro, aos 25%, ela entra no frenesi extremo');
const awake = { zt: 'cry', hp: 80, maxHp: 190, mood: 'frenzy' };
ok(zombieTaken(awake, 10) === 10 && awake.mood === 'frenzy', 'depois de acordar o tiro entra cheio');
const worn = { zt: 'cry', hp: 98, maxHp: 258, mood: 'cry' };
ok(Math.abs(zombieTaken(worn, 200) - 80) < 1e-6 && worn.mood === 'rage', 'tiro grande ainda reduz o dano e acorda o frenesi extremo');
ok(zombieTaken({ zt: 'cry', hp: 40, maxHp: 258, mood: 'cry' }, 999, true) === 999, 'queda do mapa ignora a resistência');

const elastic = { lastLos: true, nextSling: 0, slingWind: 0, slingFly: 0, vel: { y: 0 }, onGround: true };
const wind = core.trick(elastic, ZOMBIES.sling, {}, 14, 14, 0, 0, 3);
ok(wind && wind.pose === 'wind' && wind.hold && elastic.slingArm.dist === ZOMBIES.sling.sling.max, 'elástico arma o pulo e o alcance fica no teto');
const launchedAt = elastic.slingWind;
const fly = core.trick(elastic, ZOMBIES.sling, {}, 14, 14, 0, 0, launchedAt);
ok(fly && fly.pose === 'sling' && Math.abs((elastic.slingFly - launchedAt) - ZOMBIES.sling.sling.max / ZOMBIES.sling.sling.speed) < 1e-6, 'o voo do elástico dura só o bastante para o teto de metros');
const far = { lastLos: true, nextSling: 0, slingWind: 0, slingFly: 0, vel: { y: 0 }, onGround: true };
ok(core.trick(far, ZOMBIES.sling, {}, 30, 30, 0, 0, 3) == null, 'longe demais o elástico não se joga');

const sit = { mood: 'cry' };
ok(core.trick(sit, ZOMBIES.cry, {}, 9, 9, 0, 0, 1).pose === 'cry' && sit.mood === 'cry', 'chorona longe fica sentada');
ok(core.trick(sit, ZOMBIES.cry, {}, 2, 2, 0, 0, 1).pose === 'frenzy' && sit.mood === 'frenzy', 'chorona perto sai no frenesi');
ok(ZOMBIES.bat.fly > 1 && ZOMBIES.bat.speed < ZOMBIES.walker.speed, 'morcego é mais lento e voa');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

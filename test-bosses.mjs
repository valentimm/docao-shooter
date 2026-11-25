// Chefões da Invasão: rotação, peso da horda e os zumbis novos. Uso: node test-bosses.mjs
import { BOSS_TYPES, bossOfWave, isBoss, waveSpec, waveQueue, zombieWeight, zombieTaken, shuffleBosses, ZOMBIES, INV, InvasionCore, coreView, FERAL, FERAL_ACT, FERAL_FROM, feralChance, feralTune, spawnKind, THEME_P, WAVE_THEMES, themesForWave, rollTheme, applyTheme, themeIndex, INV_CROSS, MUTANT_FROM, MUTANT_P, MUTANT_NAME, mutantProfile, rollMutantParts, SHAPE_FROM, SHAPE_P, SHAPE_GAP, wantShape } from './shared/invasion.js';

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
const lone = { mood: 'cry', quietAt: 0, shots: 0, shotsSeen: 0 };
ok(core.trick(lone, ZOMBIES.cry, {}, 20, 20, 0, 0, 59).pose === 'cry' && lone.mood === 'cry', 'antes de 1 minuto a chorona continua sentada');
ok(core.trick(lone, ZOMBIES.cry, {}, 20, 20, 0, 0, 60).pose === 'frenzy' && lone.mood === 'frenzy', '1 minuto sem tiro e ela entra no frenesi');
const poked = { mood: 'cry', quietAt: 0, shots: 1, shotsSeen: 0 };
ok(core.trick(poked, ZOMBIES.cry, {}, 20, 20, 0, 0, 90).pose === 'cry' && poked.quietAt === 90 && poked.mood === 'cry', 'um tiro reinicia o minuto da chorona');
const counted = { zt: 'cry', hp: 190, maxHp: 190, mood: 'cry', shots: 0 };
zombieTaken(counted, 8);
ok(counted.shots === 1 && counted.mood === 'cry', 'tiro na chorona conta, e ela segue chorando se a vida aguenta');
zombieTaken(counted, 40, true);
ok(counted.shots === 1, 'queda do mapa não conta como tiro');
ok(ZOMBIES.cry.cry.alone === 60, 'a chorona espera 60 s sem tiro');
ok(ZOMBIES.bat.fly > 1 && ZOMBIES.bat.speed < ZOMBIES.walker.speed, 'morcego é mais lento e voa');
ok(ZOMBIES.boss.hp >= 2400 && ZOMBIES.bossGhost.hp >= 2000 && ZOMBIES.bossMummy.hp > ZOMBIES.bossBelly.hp && ZOMBIES.bossHosp.hp > ZOMBIES.boss.hp, 'chefões têm mais vida, e Múmia e Hospício continuam entre os mais duros');

const low = { id: 0, x: 1, y: 0, z: 0, ok: true, e: [] };
const roof = { id: 1, x: 0.3, y: 7, z: 0.2, ok: true, e: [] };
const nav = { nodes: [low, roof], good: [low, roof], nearest: () => roof };
const place = new InvasionCore({ size: [20, 20], T: () => 0, nav, players: () => [], emit() {} });
ok(place.playerNode(0, 2.2, 0) === low, 'jogador numa caixa não manda a horda pro telhado ao lado');
ok(place.playerNode(0.3, 7, 0.2) === roof, 'jogador no telhado continua sendo o destino');
ok(place.footNode(1, 0, 0) === low, 'zumbi no chão não gruda no nó do telhado');

{
  let T = 0;
  const player = { id: 1, alive: true, pos: { x: 6, y: 3, z: 0 }, vel: { x: 0, y: 0, z: 0 }, ghostUntil: 0 };
  const groundAt = (x, z, y) => (y + 0.45 >= 8 ? 8 : 0);
  const fly = new InvasionCore({
    T: () => T, size: [40, 40], botDiff: 'ceva', rnd: () => 0.4,
    players: () => [player],
    nav: { nodes: [roof], good: [roof], nearest: () => roof },
    P: {
      groundAt,
      losClear: () => false,
      moveEntity(e, dt) {
        e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt; e.pos.z += e.vel.z * dt;
        const g = groundAt(e.pos.x, e.pos.z, e.pos.y);
        if (e.pos.y < g) { e.pos.y = g; e.vel.y = 0; }
        return false;
      },
    },
    emit() {}, hurtPlayer() {},
  });
  const z = {
    id: 3, zt: 'bat', pos: { x: 0, y: 0.4, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, alive: true, onGround: true,
    spd: ZOMBIES.bat.speed, dmgMul: 1, size: ZOMBIES.bat.size, nextAtk: 99, nextSpit: 99, nextHowl: 99, nextPhase: 99,
    stunUntil: 0, target: null, retarget: 0, node: null, nodeAt: -9, stuck: 0, lastLos: false, losAt: -9,
    fly: true, pose: '', slingWind: 0, slingFly: 0, nextSling: 99,
  };
  for (let i = 0; i < 90; i++) { T += 1 / 30; fly.stepZombie(z, 1 / 30, T); }
  ok(z.pos.x > 2.5, `morcego voa na direção do jogador (x ${z.pos.x.toFixed(2)})`);
  ok(z.pos.y > 2.4 && z.pos.y < 6, `morcego sobe até o jogador e não vai pro telhado (y ${z.pos.y.toFixed(2)})`);
}

const pairs = {
  boss: ['spit', 'slam'], bossBelly: ['spit', 'slam'], bossGhost: ['spit', 'blink'], bossMummy: ['spit', 'grab'],
  bossWolf: ['howl', 'charge'], bossCrazy: ['spit', 'spin'], bossHosp: ['charge', 'howl'],
};
for (const zt of BOSS_TYPES) {
  const m = ZOMBIES[zt].moves;
  ok(m && m.length === 2 && m[0].kind === pairs[zt][0] && m[1].kind === pairs[zt][1], `${ZOMBIES[zt].name} tem dois ataques do perfil`);
}
ok(!ZOMBIES.walker.moves && !ZOMBIES.spitter.moves && !ZOMBIES.sling.moves, 'zumbi comum continua com um golpe só');
ok(ZOMBIES.boss.moves[1].style === 1 && !ZOMBIES.boss.moves[1].slow && ZOMBIES.bossBelly.moves[1].slow > 1 && ZOMBIES.bossBelly.moves[1].style === 2, 'estouro da Abóbora e poça da Barriguinha são golpes diferentes');

function bossSim(zt, x, rnd) {
  let T = 8;
  const player = { id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, ghostUntil: 0, stunUntil: 0 };
  const events = [], hurts = [], knocks = [];
  const core = new InvasionCore({
    T: () => T, size: [40, 40], botDiff: 'ceva', rnd, nav: null,
    players: () => [player],
    P: {
      groundAt: () => 0, losClear: () => true, collides: () => false,
      moveEntity(e, dt) { e.pos.x += (e.vel.x || 0) * dt; e.pos.z += (e.vel.z || 0) * dt; return false; },
    },
    emit(ev) { events.push(ev.slice()); },
    hurtPlayer(p, dmg) { hurts.push(dmg); },
    knock(p, v) { knocks.push(v); },
  });
  const st = ZOMBIES[zt];
  const z = {
    id: 7, zt, pos: { x, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, alive: true, onGround: true,
    spd: st.speed, dmgMul: 1, size: st.size, hp: st.hp, maxHp: st.hp,
    nextAtk: 0, nextSpit: 0, nextHowl: 0, nextPhase: 99, phaseUntil: 0, stunUntil: 0,
    target: player, retarget: 99, node: null, nodeAt: -9, stuck: 0, lastLos: true, losAt: 8,
    pose: '', fly: false, slingWind: 0, slingFly: 0, nextSling: 0, surge: false,
  };
  return { z, player, events, hurts, knocks, step(dt = 1 / 30) { T += dt; core.stepZombie(z, dt, T); return T; }, now: () => T };
}
const atk = (s) => s.events.filter((e) => e[0] === 'zs' || e[0] === 'zh' || e[0] === 'za' || e[0] === 'zf');

const held = bossSim('boss', 12, () => 0.2); held.z.nextAtk = 99; held.step();
ok(atk(held).length === 0, 'Abóbora em recarga não dispara o cuspe antigo');
const quiet = bossSim('bossHosp', 5, () => 0.1); quiet.z.nextAtk = 99; quiet.step();
ok(!(quiet.z.slingWind > 0) && !quiet.events.some((e) => e[0] === 'zh'), 'Hospício em recarga não investe e não uiva junto');
const common = bossSim('spitter', 10, () => 0.2); common.step();
ok(common.events.filter((e) => e[0] === 'zs').length === 1, 'cuspidor comum continua cuspindo no próprio tempo');

const smash = bossSim('boss', 4, () => 0.9); smash.step();
ok(smash.events.some((e) => e[0] === 'zh' && e[4] === 1) && !smash.events.some((e) => e[0] === 'zs') && smash.knocks.length > 0, 'Abóbora perto sorteia o estouro');
const nSmash = smash.events.length; smash.step();
ok(smash.events.length === nSmash, 'o segundo golpe espera a recarga');
const lob = bossSim('boss', 22, () => 0.9); lob.step();
ok(lob.events.some((e) => e[0] === 'zs') && !lob.events.some((e) => e[0] === 'zh'), 'longe, o estouro não alcança e sobra a abóbora');

const belly = bossSim('bossBelly', 3, () => 0.9); belly.step();
ok(belly.player.stunUntil > 8 && belly.events.some((e) => e[0] === 'zh' && e[4] === 2), 'Barriguinha perto espalha a poça que deixa lento');
const ghost = bossSim('bossGhost', 8, () => 0.9); ghost.step();
ok(ghost.z.pos.x < 3 && ghost.z.phased && ghost.events.some((e) => e[0] === 'zf') && ghost.hurts.length === 1, 'Fantasma atravessa até o jogador');
const mummy = bossSim('bossMummy', 4, () => 0.9); mummy.step();
ok(mummy.player.stunUntil > 8 && mummy.events.some((e) => e[0] === 'za') && !mummy.events.some((e) => e[0] === 'zs'), 'Múmia perto agarra em vez de tacar atadura');

const howl = bossSim('bossWolf', 6, () => 0.1); howl.step();
ok(howl.events.some((e) => e[0] === 'zh' && e[3] === 11) && !(howl.z.slingWind > 0), 'Lobisomem uiva quando o sorteio cai no uivo');
const pounce = bossSim('bossWolf', 6, () => 0.9); pounce.step();
ok(pounce.z.slingWind > 8 && pounce.z.slingHit === 44 && !pounce.events.some((e) => e[0] === 'zh'), 'Lobisomem parte no bote quando o sorteio cai na garra');

const spin = bossSim('bossCrazy', 6, () => 0.9); spin.step();
ok(spin.z.pos.x < 3 && spin.events.some((e) => e[0] === 'zh' && e[4] === 3) && !spin.events.some((e) => e[0] === 'zs'), 'Louco avança no giro');
const volley = bossSim('bossCrazy', 16, () => 0.9); volley.step();
ok(volley.events.filter((e) => e[0] === 'zs').length === 3, 'longe o Louco despeja a rajada de três');

const ram = bossSim('bossHosp', 5, () => 0.1); ram.step();
ok(ram.z.slingWind > 8 && !ram.events.some((e) => e[0] === 'zh'), 'Hospício sorteia a cabeçada');
const scream = bossSim('bossHosp', 5, () => 0.9); scream.step();
ok(scream.events.some((e) => e[0] === 'zh' && Math.abs(e[3] - 7.5) < 0.01) && scream.z.nextAtk - scream.now() > 6, 'Hospício sorteia o grito');
scream.z.hp = scream.z.maxHp * 0.4; scream.z.nextAtk = 0; scream.z.surge = false;
scream.step();
ok(scream.z.surge && scream.z.nextAtk - scream.now() < 4, 'abaixo da metade o grito do Hospício volta mais cedo');

ok(feralChance(1) === 0 && feralChance(FERAL_FROM - 1) === 0 && feralChance(FERAL_FROM) > 0 && feralChance(20) > feralChance(FERAL_FROM) && feralChance(20) <= 0.7, 'feroz só entra nas waves finais e a chance sobe até a 20');
ok(waveSpec(12, 1).feral === 0 && waveSpec(20, 1).feral === feralChance(20), 'o spec da wave carrega a chance de feroz');
ok(waveQueue(waveSpec(12, 1), () => 0).every((t) => !String(t).startsWith('f:')), 'wave 12 ainda é só zumbi normal');
const late = waveQueue({ ...waveSpec(20, 1), feral: 1 }, () => 0);
ok(late.length > 0 && late.every((t) => t.startsWith('f:walker')), 'com chance 1 o orçamento vira podre feroz');
const spentF = late.reduce((a, t) => a + zombieWeight(t), 0);
ok(spentF <= waveSpec(20, 1).total + 1e-6 && zombieWeight('f:walker') === FERAL && zombieWeight('walker') === 1, 'feroz pesa 1,5 e continua cabendo no orçamento');
ok(['walker', 'runner', 'tank', 'spitter', 'sling', 'bat', 'cry'].every((t) => FERAL_ACT[t]) && !FERAL_ACT.boss, 'cada zumbi comum tem um golpe feroz e o chefão fica de fora');
const smart = feralTune({ retarget: [1, 2], losEvery: 1, aggro: 10, spitLead: 0, spitErr: 1, spitRate: 1, atkRate: 1, turn: 8, flank: 0, spd: 1 });
ok(smart.retarget[0] < 1 && smart.aggro > 10 && smart.flank > 3 && smart.turn > 8 && smart.spitErr < 1 && smart.spd === 1, 'feroz troca de alvo, cerca e cospe melhor sem dobrar a velocidade de novo');
ok(spawnKind('f:tank').feral && spawnKind('f:tank').type === 'tank' && !spawnKind('walker').feral, 'a fila marca o feroz com f:');

{
  const made = [];
  const born = new InvasionCore({
    size: [30, 30], T: () => 10, rnd: () => 0.5, nav: { good: [{ x: 20, y: 0, z: 0, id: 0 }], nearest: () => ({ x: 20, y: 0, z: 0, id: 0 }) },
    players: () => [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, ghostUntil: 0 }],
    P: { groundAt: () => 0, collides: () => false, losClear: () => false },
    spawnZombie(type, pos) { const z = { id: made.length + 1, zt: type, name: ZOMBIES[type].name, pos: { ...pos }, vel: { x: 0, y: 0, z: 0 } }; made.push(z); return z; },
    emit() {},
  });
  born.spec = { ...waveSpec(16, 1), feral: 1, hpMul: 2, spdMul: 1, dmgMul: 1, bossHp: 0 };
  const z = born.spawn('f:walker');
  ok(!!z && z.feral && z.zt === 'walker' && z.hp === ZOMBIES.walker.hp * 2 * FERAL && z.dmgMul === FERAL && Math.abs(z.spd - ZOMBIES.walker.speed * FERAL) < 1e-6 && z.name === 'Docão Podre Feroz', 'feroz nasce com 1,5 da vida, da velocidade e do dano da wave');
  const plain = born.spawn('walker');
  ok(plain && !plain.feral && plain.hp === ZOMBIES.walker.hp * 2 && plain.name === 'Docão Podre', 'o normal da mesma wave continua em 1×');
}

function feralSim(zt, x, y, extra = {}) {
  let T = 8;
  const player = { id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, ghostUntil: 0, stunUntil: 0 };
  const events = [];
  const core = new InvasionCore({
    T: () => T, size: [40, 40], botDiff: 'ceva', rnd: () => 0.2, nav: null,
    players: () => [player],
    P: { groundAt: () => 0, losClear: () => true, collides: () => false, moveEntity(e, dt) { e.pos.x += (e.vel.x || 0) * dt; e.pos.z += (e.vel.z || 0) * dt; e.pos.y += (e.vel.y || 0) * dt; return false; } },
    emit(ev) { events.push(ev.slice()); }, hurtPlayer() {}, knock() {},
  });
  const st = ZOMBIES[zt];
  const z = {
    id: 9, zt, feral: true, pos: { x, y, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, alive: true, onGround: true,
    spd: st.speed * FERAL, dmgMul: FERAL, size: st.size, hp: st.hp, maxHp: st.hp,
    nextAtk: 99, nextSpit: 99, nextHowl: 99, nextPhase: 99, nextFeral: 0, phaseUntil: 0, stunUntil: 0,
    target: player, retarget: 99, node: null, nodeAt: -9, stuck: 0, lastLos: true, losAt: 8,
    pose: zt === 'cry' ? 'cry' : '', mood: zt === 'cry' ? 'cry' : '', fly: !!st.fly, slingWind: 0, slingFly: 0, nextSling: 0,
    quietAt: 8, shots: 0, shotsSeen: 0, ...extra,
  };
  return { z, player, events, step(dt = 1 / 30) { T += dt; core.stepZombie(z, dt, T); return T; } };
}
const rush = feralSim('walker', 6, 0);
rush.step();
ok(rush.z.rushUntil > 8 && rush.z.pos.x < 6, 'podre feroz arranca na direção do jogador');
const leap = feralSim('runner', 8, 0);
leap.step();
ok(leap.z.leapUntil > 8 && leap.z.vel.y > 5, 'corredor feroz dá um pulo');
const stomp = feralSim('tank', 3, 0);
stomp.step();
ok(stomp.events.some((e) => e[0] === 'zh' && e[4] === 1), 'barrigão feroz dá um pisão');
const acid = feralSim('spitter', 10, 0);
acid.step();
ok(acid.events.some((e) => e[0] === 'zs' && e[2] === 2), 'cuspidor feroz larga um cuspe que deixa lento');
const band = feralSim('sling', 8, 0);
band.step();
ok(band.z.slingWind > 8 && band.z.slingHit > 0 && band.z.slingStun > 0, 'elástico feroz arma o pulo com atordoamento na queda');
const dive = feralSim('bat', 4, 3.2);
dive.step();
ok(dive.z.diveUntil > 8 && dive.z.vel.y < 0, 'morcego feroz mergulha em quem está embaixo');
const sob = feralSim('cry', 5, 0);
sob.step();
ok(sob.z.mood === 'cry' && sob.player.stunUntil > 8 && sob.events.some((e) => e[0] === 'zh'), 'chorona feroz, ainda sentada, solta um soluço que trava quem está perto');
const calm = feralSim('walker', 6, 0, { feral: false, nextFeral: 0 });
calm.step();
ok(!(calm.z.rushUntil > 8), 'o podre normal não arranca');

function firstWave(type) {
  if (type === 'walker') return 1;
  for (let w = 1; w <= INV.WAVES; w++) if ((waveSpec(w, 1).mix[type] || 0) > 0) return w;
  return 99;
}
const share = (q, type) => q.filter((t) => spawnKind(t).type === type).length / (q.length || 1);
ok(WAVE_THEMES.length === 12 && new Set(WAVE_THEMES.map((t) => t.id)).size === 12, '12 waves temáticas, cada uma com um nome');
ok(WAVE_THEMES.every((t) => t.name && t.blurb && t.from >= 2 && Object.keys(t.mix).every((k) => t.from >= firstWave(k))), 'tema só a partir da wave em que os tipos dele já existem');
ok(!themesForWave(1, waveSpec(1, 1).mix).length && rollTheme(1, () => 0, waveSpec(1, 1).mix) == null, 'wave 1 continua a horda normal');
ok(themesForWave(5, waveSpec(5, 1).mix).some((t) => t.id === 'aereo') && !themesForWave(4, waveSpec(4, 1).mix).some((t) => t.id === 'aereo'), 'ataque aéreo entra junto com o morcego');
ok(!themesForWave(6, waveSpec(6, 1).mix).some((t) => t.id === 'noite') && themesForWave(7, waveSpec(7, 1).mix).some((t) => t.id === 'noite'), 'noite de terror espera o choro');
ok(rollTheme(10, () => THEME_P, waveSpec(10, 1).mix) == null, 'acima da chance a wave não vira temática');
const air = applyTheme(waveSpec(8, 1), WAVE_THEMES.find((t) => t.id === 'aereo'));
const airQ = waveQueue(air, () => 0.4);
ok(air.theme === 'aereo' && share(airQ, 'bat') >= 0.7 && air.total === waveSpec(8, 1).total, 'ataque aéreo enche a wave de morcego sem mudar o orçamento');
const gas = applyTheme(waveSpec(8, 1), WAVE_THEMES.find((t) => t.id === 'gas'));
ok(share(waveQueue(gas, () => 0.4), 'tank') >= 0.6, 'barrigada de gás é feita de barrigão');
const hunt = applyTheme(waveSpec(8, 1), WAVE_THEMES.find((t) => t.id === 'cacada'));
const huntQ = waveQueue(hunt, () => 0.3);
ok(share(huntQ, 'bat') + share(huntQ, 'runner') >= 0.7, 'caçada junta morcego e esqueleto');
const seen = new Set();
for (let i = 0; i < WAVE_THEMES.length; i++) {
  let n = 0;
  const theme = rollTheme(12, () => (n++ === 0 ? 0 : (i + 0.2) / WAVE_THEMES.length), waveSpec(12, 1).mix);
  if (theme) seen.add(theme.id);
}
ok(seen.size >= 8, 'o sorteio alcança temas diferentes');
{
  const evs = [];
  const themed = new InvasionCore({
    size: [20, 20], T: () => 4, nav: null, rnd: () => 0,
    players: () => [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 } }],
    emit(ev) { evs.push(ev); },
  });
  themed.startWave(5);
  const banner = evs.find((ev) => ev[0] === 'wv' && ev[1] === 1);
  ok(themed.spec.theme === 'aereo' && themed.spec.boss && banner && banner[6] === themeIndex('aereo') && themed.spec.bossKind, 'a wave 5 pode ser Ataque Aéreo e ainda traz o chefão');
  ok(coreView(themed).theme === themeIndex('aereo'), 'o estado da wave leva o tema para o HUD');
  themed.startWave(6);
  ok(themed.spec.theme && themed.spec.theme !== 'aereo', 'a wave seguinte não repete o mesmo tema');
}

// ---------- Docão Mutação Macabra ----------
{
  const mix = mutantProfile('tank', 'spitter');
  ok(MUTANT_FROM === 10 && MUTANT_P === 0.01 && mix && mix.name === MUTANT_NAME && mix.boom && mix.spit && mix.hp === ZOMBIES.tank.hp && mix.speed === Math.max(ZOMBIES.tank.speed, ZOMBIES.spitter.speed), 'mutação junta a vida do mais forte com o poder dos dois');
  const crying = { zt: 'mutant', parts: ['walker', 'cry'], hp: 190, maxHp: 190, mood: 'cry' };
  ok(Math.abs(zombieTaken(crying, 10) - 4) < 1e-6, 'mutação com chorona apanha menos enquanto chora');
  ok(rollMutantParts('walker', () => 0)[1] === 'runner', 'o segundo tipo sai da horda comum');
  function hatch(wave, rnd) {
    const core = new InvasionCore({
      size: [30, 30], T: () => 10, rnd, nav: { good: [{ x: 20, y: 0, z: 0, id: 0 }] },
      players: () => [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, ghostUntil: 0 }],
      P: { groundAt: () => 0, collides: () => false, losClear: () => false },
      spawnZombie(type, pos, parts) { return { id: 1, zt: type, parts: parts || null, name: '', pos: { ...pos }, vel: { x: 0, y: 0, z: 0 } }; },
      emit() {},
    });
    core.wave = wave;
    core.spec = { ...waveSpec(wave, 1), hpMul: 1, spdMul: 1, dmgMul: 1, bossHp: 0 };
    return core.spawn('walker');
  }
  const early = hatch(9, () => 0);
  ok(early && early.zt === 'walker' && !early.parts, 'antes da wave 10 o zumbi continua normal');
  const born = hatch(10, () => 0);
  ok(born && born.zt === 'mutant' && born.parts[0] === 'walker' && born.parts[1] === 'runner' && born.name === MUTANT_NAME && born.hp === ZOMBIES.walker.hp, 'na wave 10, 1% troca o zumbi por uma mutação');
  ok(hatch(10, () => 0.5).zt === 'walker', 'acima de 1% a wave 10 continua a horda normal');
  const bossCore = new InvasionCore({
    size: [30, 30], T: () => 10, rnd: () => 0, nav: { good: [{ x: 20, y: 0, z: 0, id: 0 }] },
    players: () => [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, ghostUntil: 0 }],
    P: { groundAt: () => 0, collides: () => false, losClear: () => false },
    spawnZombie(type, pos) { return { id: 2, zt: type, name: '', pos: { ...pos }, vel: { x: 0, y: 0, z: 0 } }; },
    emit() {},
  });
  bossCore.wave = 10;
  bossCore.spec = { ...waveSpec(10, 1), hpMul: 1, spdMul: 1, dmgMul: 1, bossHp: ZOMBIES.boss.hp };
  const boss = bossCore.spawn('boss');
  ok(boss && boss.zt === 'boss' && !boss.parts, 'chefão não vira mutação');
  let T = 8;
  const player = { id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, ghostUntil: 0, stunUntil: 0 };
  const events = [];
  const hurts = [];
  const live = new InvasionCore({
    T: () => T, size: [40, 40], botDiff: 'ceva', rnd: () => 0.2, nav: null,
    players: () => [player],
    P: { groundAt: () => 0, losClear: () => true, collides: () => false, moveEntity() { return false; } },
    emit(ev) { events.push(ev[0]); }, hurtPlayer(p, d) { hurts.push(d); }, knock() {},
  });
  const z = {
    id: 4, zt: 'mutant', parts: ['spitter', 'tank'], hp: 520, maxHp: 520, alive: true, name: MUTANT_NAME,
    pos: { x: 8, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, size: 1.3, spd: 4, dmgMul: 1, feral: false,
    nextAtk: 99, nextSpit: 0, nextHowl: 99, nextPhase: 99, nextFeral: 99, phaseUntil: 0, stunUntil: 0,
    target: player, retarget: 99, lastLos: true, losAt: T, mood: '', pose: '', fly: false, slingWind: 0, slingFly: 0, nextSling: 99, onGround: true,
  };
  live.stepZombie(z, 0.05, T);
  ok(events.includes('zs'), 'mutação com cuspidor cospe');
  z.pos = { x: 1, y: 0, z: 0 };
  live.onZombieDeath(z);
  ok(hurts.length > 0, 'mutação com barrigão explode ao morrer');
}

// ---------- cruz (Normal): desenterrar quem perdeu a última vida ----------
{
  ok(INV_CROSS.hold === 5 && INV_CROSS.key === 'KeyE', 'desenterrar leva 5 s na tecla de desarmar');
  const revived = [];
  let T = 0;
  const dead = { id: 1, pos: { x: 4, y: 1, z: -2 }, alive: false, hp: 0 };
  const mate = { id: 2, pos: { x: 4.4, y: 1, z: -2.2 }, alive: true, hp: 80, useHold: false };
  const players = [dead, mate];
  const core = new InvasionCore({
    size: [30, 30], T: () => T, nav: null, rnd: () => 0.9, hard: false,
    P: { groundAt: () => 1, losClear: () => true },
    players: () => players,
    emit() {},
    revive(p, at, o) { revived.push({ id: p.id, x: at.x, z: at.z, o }); p.alive = true; p.hp = (o && o.hp) || 100; p.pos = { ...at }; },
  });
  core.ensure(dead, true); core.ensure(mate, true);
  dead.lives = 2; dead.alive = false;
  ok(core.onPlayerDeath(dead) === true && core.crosses.length === 0 && dead.lives === 1, 'com vida sobrando não fica cruz');
  dead.pos = { x: 4, y: 1, z: -2 }; dead.alive = false;
  ok(core.onPlayerDeath(dead) === false && dead.out && core.crosses.length === 1 && core.crosses[0].x === 4 && core.crosses[0].z === -2, 'a última vida planta a cruz onde caiu');
  mate.useHold = true;
  core.stepCrosses(2);
  const cr = core.crosses[0];
  ok(cr.by === 2 && cr.prog > 1.9 && cr.prog < 2.1, '2 s segurando enche parte dos 5 s');
  mate.hp = 40;
  core.stepCrosses(0.2);
  ok(cr.prog === 0 && cr.by === 0 && mate.graveBroke, 'qualquer dano zera o desenterro');
  core.stepCrosses(1);
  ok(cr.prog === 0, 'continuar segurando depois do dano não recomeça');
  mate.useHold = false;
  core.stepCrosses(0.05);
  ok(!mate.graveBroke, 'soltar o botão libera uma tentativa nova');
  mate.useHold = true;
  mate.pos = { x: 30, y: 1, z: 30 };
  core.stepCrosses(1);
  ok(cr.prog === 0, 'longe da cruz não cava');
  mate.pos = { x: 4.3, y: 1, z: -2.1 }; mate.hp = 80; mate._digHp = null;
  core.phase = 'break'; core.phaseEnd = 1e9;
  for (let i = 0; i < 10; i++) { T += 0.5; core.step(0.5); }
  ok(revived.length === 1 && dead.lives === 0 && !dead.out && core.crosses.length === 0 && dead.alive, '5 s revivem sem vida extra e tiram a cruz');
  ok(revived[0].o && revived[0].o.exact && revived[0].o.hp === INV_CROSS.hp && Math.hypot(revived[0].x - 4, revived[0].z + 2) < 0.2, 'quem volta nasce na cruz com meia vida');
  const view = coreView(core);
  dead.out = true; dead.alive = false; dead.pos = { x: 4, y: 1, z: -2 }; core.placeCross(dead); core.crosses[0].prog = 2; core.crosses[0].by = 2;
  const snap = coreView(core);
  ok(snap.crosses.length === 1 && snap.crosses[0].id === 1 && snap.crosses[0].x === 4 && Math.abs(snap.crosses[0].prog - 2) < 0.02 && snap.crosses[0].by === 2, 'o estado leva a cruz e a barra pro HUD');
  ok(view && view.phase === 'break', 'a cruz não mexe na fase da wave');
}

// ---------- Docão Shapeshifter ----------
{
  ok(SHAPE_FROM === 5 && Math.abs(SHAPE_P - 1 / 3) < 1e-9 && SHAPE_GAP === 2, 'shapeshifter: wave 5, chance 1/3, folga de 2 waves');
  ok(!wantShape(waveSpec(4, 2), () => 0), 'antes da wave 5 não nasce shapeshifter');
  ok(!wantShape(waveSpec(5, 1), () => 0), 'sozinho não nasce shapeshifter');
  ok(wantShape(waveSpec(5, 2), () => 0), 'na wave 5 com dois jogadores a chance pode pegar');
  ok(!wantShape(waveSpec(5, 2), () => 0.9), 'na wave 5 a chance de 1/3 pode falhar');
  ok(!wantShape(waveSpec(6, 2), () => 0, 5) && !wantShape(waveSpec(7, 2), () => 0, 5), 'depois que aparece, as 2 waves seguintes não têm');
  ok(wantShape(waveSpec(8, 2), () => 0, 5), 'na terceira wave depois já pode voltar');
  const solo = waveQueue(waveSpec(5, 1), () => 0.5);
  ok(!solo.includes('shape'), 'sozinho a horda não tem shapeshifter');
  const early = waveQueue(waveSpec(4, 2), () => 0);
  ok(!early.includes('shape'), 'com dois jogadores, antes da wave 5 a fila não tem shapeshifter');
  const duo = waveQueue(waveSpec(5, 2), () => 0);
  ok(duo.filter((t) => t === 'shape').length === 1, 'com dois jogadores, a partir da wave 5, um zumbi da fila pode virar shapeshifter');
  const miss = waveQueue(waveSpec(5, 2), () => 0.5);
  ok(!miss.includes('shape'), 'se a chance falha, a fila da wave 5 fica sem shapeshifter');
  const cool = waveQueue(waveSpec(7, 2), () => 0, 5);
  ok(!cool.includes('shape'), 'na folga de 2 waves a fila não encaixa shapeshifter');
  const ev = [];
  const ana = { id: 1, name: 'Ana', skin: 'rosa', weapon: 4, alive: true, hp: 80, pos: { x: 1.2, y: 0, z: 0 }, inv: [] };
  const beto = { id: 2, name: 'Beto', skin: 'azul', weapon: 2, alive: true, hp: 90, pos: { x: 28, y: 0, z: 0 }, inv: [] };
  const cris = { id: 3, name: 'Cris', alive: true, hp: 100, soul: 99, pos: { x: 20, y: 0, z: 20 }, inv: [] };
  const core = new InvasionCore({
    size: [80, 80], T: () => 5, rnd: () => 0,
    nav: { good: [{ x: 40, y: 0, z: 0, id: 0 }] },
    players: () => [ana, beto, cris],
    P: { groundAt: () => 0, collides: () => false, losClear: () => false, moveEntity(e, dt) { e.pos.x += (e.vel.x || 0) * dt; e.pos.y += (e.vel.y || 0) * dt; e.pos.z += (e.vel.z || 0) * dt; } },
    spawnZombie(type, pos, parts, face) { return { id: 9, zt: type, parts: parts || null, face, pos: { ...pos }, vel: { x: 0, y: 0, z: 0 } }; },
    emit(evn) { ev.push(evn); },
  });
  core.wave = 10;
  core.spec = { ...waveSpec(10, 2), hpMul: 1, spdMul: 1, dmgMul: 1, bossHp: 0 };
  const z = core.spawn('shape');
  ok(z && z.zt === 'shape' && !z.parts && z.name === 'Ana' && z.skin === 'rosa' && z.weapon === 4 && z.pos.x === 40, 'shapeshifter copia pele, arma e nome e nasce no ponto escondido');
  ok(!core.spawn('shape') && core.zombies.filter((x) => x.alive && x.zt === 'shape').length === 1, 'enquanto um está vivo, outro não nasce');
  core.queue = ['walker', 'shape']; core.nextSpawn = 0; core.wave = 1; core.spec.w = 1; core.spec.maxAlive = 20; core.spec.batch = 4; core.spec.spawnEvery = 1;
  core.stepSpawns(5);
  ok(core.zombies.filter((x) => x.alive && x.zt === 'shape').length === 1 && !core.queue.includes('shape') && core.zombies.some((x) => x.zt === 'walker'), 'a fila tira o segundo shapeshifter e o resto da horda nasce');
  z.pos = { x: 0, y: 0, z: 0 };
  core.stepShape(z, 0.05, 0);
  ok(z.suck && z.suck.id === ana.id && !ana.soul && z.pose === 'suck', 'se chega perto ele pula, e a alma ainda está no lugar');
  core.stepShape(z, 0.05, 1);
  ok(ana.soul === z.id && !beto.soul && cris.soul === 99 && ev.some((e) => e[0] === 'soul' && e[1] === ana.id && e[2] === z.id), 'um segundo de sucção vira zumbi só quem estava perto');
  ok(!ev.some((e) => e[0] === 'za'), 'shapeshifter não morde nem atira');
  core.cure(ana);
  ok(!ana.soul && ev.some((e) => e[0] === 'soul' && e[1] === ana.id && e[2] === 0), 'pegar vida ou ser curado devolve a alma');
  core.curse(ana, z);
  core.onZombieDeath(z);
  ok(!ana.soul && cris.soul === 99 && !z.alive, 'se o shapeshifter que sugou morre, só a alma dele volta');
}
{
  const eye = { id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, ghostUntil: 0 };
  const mk = (los) => new InvasionCore({
    size: [40, 40], T: () => 0, rnd: () => 0,
    nav: { good: [{ x: 10, y: 0, z: 0 }] },
    players: () => [eye],
    P: { groundAt: () => 0, collides: () => false, losClear: () => los },
    spawnZombie: (type, pos) => ({ id: 4, zt: type, pos: { ...pos }, vel: { x: 0, y: 0, z: 0 } }),
    emit() {},
  });
  const open = mk(true);
  ok(!open.shapePos() && !open.spawn('shape'), 'à vista dos jogadores o shapeshifter não aparece');
  const hid = mk(false).shapePos();
  ok(hid && hid.x === 10 && hid.z === 0, 'sem linha de visão ele nasce direto nesse ponto');
}
{
  const people = [
    { id: 1, alive: true, pos: { x: 0, y: 0, z: 0 } },
    { id: 2, alive: true, pos: { x: 2, y: 0, z: 0 } },
  ];
  const core = new InvasionCore({
    size: [40, 40], T: () => 0, rnd: () => 0,
    nav: { good: [{ x: 10, y: 0, z: 0 }] },
    players: () => people,
    P: { groundAt: () => 0, collides: () => false, losClear: () => false },
    spawnZombie: (type, pos) => ({ id: 8, zt: type, pos: { ...pos }, vel: { x: 0, y: 0, z: 0 } }),
    emit() {},
  });
  core.startWave(5);
  ok(core.queue.includes('shape'), 'startWave 5 com dois jogadores pode enfileirar o shapeshifter');
  core.shapeWave = 5;
  core.startWave(6);
  ok(!core.queue.includes('shape'), 'startWave respeita a folga na wave 6');
  core.startWave(7);
  ok(!core.queue.includes('shape'), 'startWave respeita a folga na wave 7');
  core.startWave(8);
  ok(core.queue.includes('shape'), 'startWave 8 já pode enfileirar de novo');
}

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

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

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

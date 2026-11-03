// Survival da Invasão: tiers da Papada, débito, caixa, parede e loadout. Só Node.
// Uso: node test-survival.mjs
import { Game } from './server/src/game.js';
import { getMap, INV_MAPS } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';
import { RAY as RAY_MOVE, stepRay, raySplash } from './shared/ray.js';
import { buildNav } from './nav.js';
import { WEAPONS, PISTOL, KNIFE, UZI, RAY, PRIMARIES, SECONDARIES, CATEGORIES, BOT_PRIMARIES } from './shared/rules.js';
import { INV, waveSpec, ZOMBIES } from './shared/invasion.js';
import {
  PAPADA_NAME, BOX_NAME, SURV, PAP_COST, SURV_ID, PADRAO_ID,
  isSurvival, normSurv, papOk, papRefuse, withPap, tryPap, tryBoxPay, rollBox, takeBox, tryWall,
  applySurvivalLoadout, grantHit, grantKill, killPoints, stationsFor, registerSurvivalMap,
  exclusiveSurvivalMap, SURVIVAL_LAYOUTS, bindStations, statLine, shownDmg, WALL_CATALOG, BOX_POOL,
  survRefill, fmtPts, getSurvivalWaveTuning, papName, RAY_ODDS,
} from './shared/survival.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(PAPADA_NAME === 'Papada' && BOX_NAME === 'Barraca da Sorte', `nomes: ${PAPADA_NAME} e ${BOX_NAME}`);
ok(PAP_COST.join(',') === '10000,25000,50000', `tiers custam ${PAP_COST.join(' / ')}`);
ok(SURV.boxPrice >= 950 && SURV.boxPrice <= 1500, `barraca custa ${SURV.boxPrice}`);
ok(normSurv('survival') === SURV_ID && normSurv('qualquer') === PADRAO_ID && !isSurvival('padrao'), 'variante desconhecida vira Padrão');

// faca, sabre, tampa e minigun não entram
ok(papRefuse(WEAPONS[KNIFE]) === 'lamina' && papRefuse(WEAPONS[8]) === 'lamina', 'faca e sabre: a Papada recusa lâmina');
ok(papRefuse(WEAPONS.find((w) => w.shield)) === 'escudo', 'tampa não entra');
ok(papRefuse(WEAPONS.find((w) => w.key === 'minigun')) === 'especial', 'minigun não entra');
ok(papOk(WEAPONS[PISTOL]) && papOk(WEAPONS[0]) && papOk(WEAPONS[3]), 'pistola, fuzil e bazuca podem');

// tiers sequenciais, dano perceptível e não absurdo, munição cheia
{
  const e = { weapon: PISTOL, pts: 0, slots: [PISTOL, PISTOL, KNIFE], slotOn: [1, 0, 1], mag: WEAPONS.map((w) => w.mag), reserve: WEAPONS.map((w) => w.reserve) };
  const poor = tryPap(e);
  ok(!poor.ok && poor.reason === 'pontos' && e.pts === 0 && !(e.pap && e.pap[PISTOL]), `sem dinheiro não debita (${poor.have}/${poor.cost})`);
  e.pts = 10000;
  const a = tryPap(e);
  ok(a.ok && a.tier === 1 && a.cost === 10000 && e.pts === 0, `tier 1 debita 10.000 e sobra ${e.pts}`);
  ok(e.pap[PISTOL] === 1 && e.mag[PISTOL] === withPap(WEAPONS[PISTOL], 1).mag && e.reserve[PISTOL] === withPap(WEAPONS[PISTOL], 1).reserve, 'tier 1 enche pente e reserva no tamanho novo');
  const again = tryPap({ ...e, pts: 25000, weapon: PISTOL, pap: { ...e.pap }, mag: e.mag.slice(), reserve: e.reserve.slice(), slotOn: e.slotOn });
  ok(again.ok && again.tier === 2 && again.cost === 25000 && e.pap[PISTOL] === 1, 'o mesmo índice sobe pro tier 2 pagando 25.000, sem repetir o preço do 1');
  e.pts = 25000; const b = tryPap(e);
  e.pts = 50000; const c = tryPap(e);
  ok(b.tier === 2 && c.tier === 3 && e.pap[PISTOL] === 3, 'sequência 1 → 2 → 3 na mesma arma');
  const max = tryPap(e);
  ok(!max.ok && max.reason === 'max' && e.pap[PISTOL] === 3, 'tier 3 não sobe de novo');
  const d0 = shownDmg(WEAPONS[PISTOL], 0), d1 = shownDmg(WEAPONS[PISTOL], 1), d2 = shownDmg(WEAPONS[PISTOL], 2), d3 = shownDmg(WEAPONS[PISTOL], 3);
  ok(d1 > d0 * 1.4 && d2 > d1 * 1.25 && d3 > d2 * 1.2 && d3 < d0 * 3.3, `pistola ${d0} → ${d1} → ${d2} → ${d3} (perceptível, não absurdo)`);
  const line = statLine(WEAPONS[PISTOL], 0, 1);
  ok(line.text.includes('dano') && line.text.includes('→') && line.after.tier === 1, `prompt: ${line.text}`);
  const sn = shownDmg(WEAPONS[2], 3) / shownDmg(WEAPONS[2], 0);
  ok(sn > 1.8 && sn < 2.3, `Torresmo no tier 3 fica em ${sn.toFixed(2)}× (teto de sniper)`);
  const sh = shownDmg(WEAPONS[1], 3) / shownDmg(WEAPONS[1], 0);
  ok(sh > 2 && sh < 2.6, `Calibre 12 no tier 3 fica em ${sh.toFixed(2)}×`);
  e.weapon = KNIFE;
  const knife = tryPap(e);
  ok(!knife.ok && knife.reason === 'lamina' && e.pap[KNIFE] == null, 'faca na mão não debita');
}

// Padrão não é Survival: a função de variante barra, e o servidor recusa
ok(!isSurvival(PADRAO_ID) && isSurvival(SURV_ID), 'Padrão e Survival são variantes diferentes');

// mystery box
{
  const e = applySurvivalLoadout({ pts: SURV.boxPrice });
  const pay = tryBoxPay(e);
  ok(pay.ok && e.pts === 0 && pay.cost === SURV.boxPrice, `barraca debita ${SURV.boxPrice}`);
  const broke = tryBoxPay(e);
  ok(!broke.ok && broke.reason === 'pontos', 'sem ponto a barraca não gira');
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(rollBox(() => RAY_ODDS + (i / 500) * (1 - RAY_ODDS - 1e-6)));
  ok(BOX_POOL.every((w) => seen.has(w)) && ![...seen].some((w) => w !== RAY && !papOk(WEAPONS[w])), `sorteio cobre o pool (${BOX_POOL.length}) e não sai faca nem tampa`);
  const rolled = UZI;
  const got = takeBox(e, rolled);
  ok(got.how === 'add' && e.slotOn[1] === 1 && e.slots[1] === UZI && e.weapon === UZI && e.slots[0] === PISTOL, 'primeira arma da barraca ocupa o segundo slot e a pistola fica');
  e.weapon = UZI;
  const swap = takeBox(e, 0);
  ok(swap.how === 'swap' && e.slots[1] === 0 && e.slots[0] === PISTOL, 'com duas armas, troca a que está na mão');
  e.weapon = KNIFE;
  takeBox(e, FAMAS_SAFE());
  ok(e.slots[0] !== PISTOL && e.slots[2] === KNIFE, 'de faca na mão, a troca cai na primária e a faca fica');
}
function FAMAS_SAFE() { return 15; }

// parede: compra e recompra mais barata
{
  const wall = WALL_CATALOG.find((w) => w.w === UZI);
  const e = applySurvivalLoadout({ pts: wall.price - 1 });
  const no = tryWall(e, wall);
  ok(!no.ok && no.reason === 'pontos' && e.pts === wall.price - 1 && e.slotOn[1] === 0, 'parede não fiada');
  e.pts = wall.price;
  const buy = tryWall(e, wall);
  ok(buy.ok && buy.kind === 'add' && buy.cost === wall.price && e.slots[1] === UZI && e.mag[UZI] === withPap(WEAPONS[UZI], 0).mag, `MP5K na parede por ${wall.price}, munição cheia`);
  e.mag[UZI] = 0; e.reserve[UZI] = 0; e.pts = wall.ammo;
  const ammo = tryWall(e, wall);
  ok(ammo.ok && ammo.kind === 'ammo' && ammo.cost === wall.ammo && ammo.cost < wall.price && e.mag[UZI] > 0, `recompra de munição sai ${wall.ammo}, mais barata que a arma`);
  const full = tryWall(e, wall);
  ok(!full.ok && full.reason === 'cheia', 'cheio não gasta a recompra');
  ok(WALL_CATALOG.every((w) => w.price > w.ammo && w.ammo > 0), 'toda arma de parede tem recompra mais barata');
}

// loadout do Survival ignora a classe
{
  const e = { nextPrimary: 0, nextSecondary: 23, nextMelee: 8, slots: [0, 23, 8], weapon: 0, pts: 400, pap: { 4: 2 } };
  applySurvivalLoadout(e);
  ok(e.slots[0] === PISTOL && e.slotOn[1] === 0 && e.slots[2] === KNIFE && e.weapon === PISTOL, 'nasce pistola + faca, secundária fechada');
  ok(e.pap[PISTOL] === 2 && e.pts === 400, 'respawn não apaga tier nem pontos');
  ok(e.mag[PISTOL] === withPap(WEAPONS[PISTOL], 2).mag, 'a pistola que já passou na Papada renasce no tier');
  const base = WEAPONS[0].reserve;
  const holder = applySurvivalLoadout({ pts: 0, pap: {} });
  holder.slots = [0, PISTOL, KNIFE]; holder.slotOn = [1, 1, 1]; holder.pap[0] = 3;
  holder.mag[0] = 0; holder.reserve[0] = 0;
  ok(survRefill(holder) && holder.reserve[0] > base, `caixa de munição não encolhe a reserva do tier 3 (${holder.reserve[0]} > ${base})`);
}

// pontos: acerto, teto e abate
{
  const e = { pts: 0 };
  let h = 0; for (let i = 0; i < SURV.hitCap + 5; i++) h += grantHit(e, 7);
  ok(h === SURV.hit * SURV.hitCap && e.pts === h, `teto de ${SURV.hitCap} acertos no mesmo zumbi`);
  const k = grantKill(e, 'walker', true);
  ok(k === killPoints('walker', true) && k > killPoints('walker', false), `abate no focinho paga ${k}`);
  ok(killPoints('boss', false) > killPoints('tank', false) && killPoints('tank', false) > killPoints('walker', false), 'chefão paga mais que barrigão, que paga mais que podre');
}

// curva: desafiador no começo, Papada 3 alcançável antes do fim
{
  const dmgAt = (tier) => shownDmg(WEAPONS[PISTOL], tier);
  let pts = 0, tier = 0, spent = 0, when = [0, 0, 0];
  const perWave = [];
  for (let w = 1; w <= 20; w++) {
    const spec = getSurvivalWaveTuning(w, 1);
    const mix = spec.mix; const sum = Object.values(mix).reduce((a, b) => a + b, 0);
    let wavePts = 0;
    for (const [zt, weight] of Object.entries(mix)) {
      const n = Math.round(spec.total * weight / sum);
      const hp = ZOMBIES[zt].hp * spec.hpMul;
      const dmg = dmgAt(tier);
      const shots = Math.max(1, Math.ceil(hp / dmg));
      const paid = Math.min(SURV.hitCap, shots - 1);
      wavePts += n * (paid * SURV.hit + killPoints(zt, false));
    }
    if (spec.boss) {
      const hp = spec.bossHp;
      const dmg = dmgAt(tier);
      const shots = Math.max(1, Math.ceil(hp / dmg));
      wavePts += Math.min(SURV.hitCap, shots - 1) * SURV.hit + killPoints('boss', false);
    }
    pts += wavePts; perWave.push(pts);
    while (tier < 3 && pts - spent >= PAP_COST[tier]) { spent += PAP_COST[tier]; tier++; when[tier - 1] = w; }
  }
  const bill = PAP_COST[0] + PAP_COST[1] + PAP_COST[2] + SURV.boxPrice + WALL_CATALOG.find((w) => w.w === UZI).price;
  ok(perWave[1] < PAP_COST[0], `duas waves não pagam a Papada (${fmtPts(perWave[1])} < 10.000)`);
  ok(when[0] >= 3 && when[0] <= 6, `tier 1 por volta da wave ${when[0]}`);
  ok(when[1] > when[0] && when[1] <= 10, `tier 2 na wave ${when[1]}`);
  ok(when[2] > when[1] && when[2] <= 16, `tier 3 na wave ${when[2]}, antes do fim`);
  ok(perWave[13] >= bill, `wave 14 já cobriu Papada completa + barraca + uma parede (${fmtPts(perWave[13])} >= ${fmtPts(bill)})`);
  ok(perWave[6] < bill, `no meio (wave 7) ainda não fecha a conta toda (${fmtPts(perWave[6])})`);
  console.log('     curva solo (pistola, sem headshot): ' + when.map((w, i) => `T${i + 1}@wave ${w}`).join(' · ') + ` · wave20 ${fmtPts(perWave[19])}`);
}

// velocidade do Survival sobe suave; a wave 1 é mais lenta; o Padrão fica onde estava
{
  const rows = [];
  for (let w = 1; w <= 20; w++) rows.push(getSurvivalWaveTuning(w, 1));
  const frac = (w) => getSurvivalWaveTuning(w, 1).spdMul / waveSpec(w, 1).spdMul;
  ok(rows.slice(0, 10).every((s, i, a) => i === 0 || s.spdMul > a[i - 1].spdMul), 'waves 1 a 10: a velocidade sobe a cada wave');
  ok(rows.every((s, i) => i === 0 || s.spdMul >= rows[i - 1].spdMul - 1e-9), 'da wave 1 à 20 a velocidade não volta atrás');
  ok(frac(1) >= 0.55 && frac(1) <= 0.60, `wave 1 a ${Math.round(frac(1) * 100)}% da velocidade do Padrão`);
  ok(frac(8) >= 0.94 && frac(8) < 1 && frac(10) === 1 && frac(20) === 1, `wave 8 a ${Math.round(frac(8) * 100)}%, wave 10 e 20 na velocidade do Padrão`);
  const w1 = rows[0], p1 = waveSpec(1, 1);
  ok(w1.total < p1.total && w1.total >= 8 && w1.hpMul < p1.hpMul && w1.dmgMul < p1.dmgMul && w1.spawnEvery > p1.spawnEvery, `wave 1 alivia quantidade (${w1.total}/${p1.total}), vida, dano e spawn`);
  ok(w1.gap > INV.BREAK && rows[9].gap === INV.BREAK && w1.prep > INV.PREP, `pausa inicial ${w1.gap}s e preparação ${w1.prep}s; no fim volta a ${INV.BREAK}s`);
  ok(w1.batch === 1 && w1.batch < p1.batch && w1.maxAlive < p1.maxAlive, 'wave 1 nasce um por vez e não lota o mapa');
  const fast = ZOMBIES.runner.speed * w1.spdMul, slow = ZOMBIES.tank.speed * w1.spdMul, mid = ZOMBIES.walker.speed * w1.spdMul;
  ok(slow < mid && mid < fast && Math.abs(fast / mid - ZOMBIES.runner.speed / ZOMBIES.walker.speed) < 1e-9, 'corredor continua mais rápido e barrigão mais lento, na mesma proporção');
  const hi = ZOMBIES.walker.speed * w1.spdMul * 1.08, lo = ZOMBIES.walker.speed * w1.spdMul * 0.92;
  ok(hi < ZOMBIES.walker.speed * p1.spdMul * 0.92 && hi / lo < 1.2, 'até o zumbi mais rápido da wave 1 perde pro mais lento do Padrão, com pouca variação');
  for (const w of [10, 12, 20]) {
    const a = getSurvivalWaveTuning(w, 1), b = waveSpec(w, 1);
    ok(a.spdMul === b.spdMul && a.total === b.total && a.hpMul === b.hpMul && a.dmgMul === b.dmgMul && a.spawnEvery === b.spawnEvery && a.batch === b.batch && a.maxAlive === b.maxAlive && a.bossHp === b.bossHp, `wave ${w} acompanha vida, dano, quantidade e spawn do Padrão`);
  }
  const co = getSurvivalWaveTuning(1, 4);
  ok(co.total > w1.total && co.spdMul / waveSpec(1, 4).spdMul === frac(1), 'com mais jogadores a horda cresce e a fração de velocidade fica');
  ok(waveSpec(1, 1).spdMul === 1 && waveSpec(1, 1).total === 18 && waveSpec(20, 1).total === 132 && waveSpec(20, 1).spdMul === 1.45 && waveSpec(1, 1).gap == null, 'waveSpec do Padrão não mudou');
  const bits = [1, 2, 3, 5, 8, 12, 20].map((w) => {
    const s = getSurvivalWaveTuning(w, 1);
    return `w${w} ${Math.round(frac(w) * 100)}% · ${s.total} · ${(ZOMBIES.walker.hp * s.hpMul).toFixed(0)}hp · ${(ZOMBIES.walker.dmg * s.dmgMul).toFixed(1)}dmg · ${s.spawnEvery.toFixed(2)}s`;
  });
  console.log('     tuning solo (walker): ' + bits.join(' | '));
}

// layouts: dados por mapa, exclusive plugável, posições de teste nos mapas atuais
{
  delete SURVIVAL_LAYOUTS['hotmilk-noite'];
  ok(exclusiveSurvivalMap(['hotmilk-noite', 'rodizio']) === null, 'sem registro, nenhum mapa é exclusivo do Survival');
  registerSurvivalMap('hotmilk-noite', {
    exclusive: true,
    papada: { x: 1, z: 2, yaw: 0.5 },
    box: { x: 4, z: -3, yaw: 1 },
    walls: [{ w: UZI, x: -2, z: 1, yaw: 0 }],
    doors: [{ id: 'porteira', x: 0, z: 0, yaw: 0, price: 750 }],
  });
  ok(exclusiveSurvivalMap(['rodizio']) === null, 'exclusive só vale se o id existe na lista conhecida');
  ok(exclusiveSurvivalMap(['hotmilk-noite', 'rodizio']) === 'hotmilk-noite', 'Hotmilk à noite registrado vira o único mapa do Survival');
  const lay = stationsFor({ id: 'hotmilk-noite', size: [40, 40], spawns: [[0, 0]] });
  ok(!lay.test && lay.papada.x === 1 && lay.box.z === -3 && lay.walls[0].price === WALL_CATALOG.find((w) => w.w === UZI).price && lay.doors[0].id === 'porteira' && lay.doors[0].price === 750, 'layout do mapa usa os dados, preço de parede padrão e a porta');
  delete SURVIVAL_LAYOUTS['hotmilk-noite'];
  for (const map of INV_MAPS) {
    const solids = mapSolids(map), P = createPhysics(solids, map.size);
    ok(bindStations(map, P) == null && stationsFor(map) == null, `${map.id}: sem Papada, barraca nem arma de teste`);
  }
  const noite = getMap('hotmilk-noite');
  const Pn = createPhysics(mapSolids(noite), noite.size);
  const sn = bindStations(noite, Pn);
  ok(sn && !sn.test && sn.papada && sn.box && sn.walls.length >= 4, `HOTMILK à Noite: ${sn && sn.walls.length} armas nas âncoras + Papada e barraca`);
  ok(sn.walls.every((w) => w.nx == null || Math.hypot(w.nx, w.nz) > 0.9), 'armas da noite têm normal ou ficam na âncora');
  ok(!INV_MAPS.some((m) => m.id === 'hotmilk-noite') && noite.survivalOnly, 'a noite não entra na lista da Invasão padrão');
}

// servidor: Survival debita e sincroniza; Padrão recusa; respawn volta pra pistola e faca
function room(surv) {
  const g = new Game({ code: 'TEST', map: 'fazenda-assombrada', max: 4, fillBots: false, mode: 'inv', surv }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake;
  const a = g.join({ name: 'A' }).ent; g.welcome(a);
  g.onMessage(a.id, { t: 'start' }); a.connected = true;
  const step = (n = 1, d = 0.05) => { for (let i = 0; i < n; i++) { fake += d; g.tick(); } };
  step(3);
  return { g, a, step };
}
{
  const { g, a } = room(SURV_ID);
  ok(g.survival && a.slots[0] === PISTOL && a.slotOn[1] === 0 && a.slots[2] === KNIFE && a.weapon === PISTOL, 'servidor Survival: nasce pistola e faca');
  ok(g.mapId === 'hotmilk-noite' && g.stations && g.stations.papada && g.stations.box && g.stations.walls.length >= 4, `servidor abre a HOTMILK à Noite e monta as estações (${g.mapId}, ${g.stations && g.stations.walls.length} paredes)`);
  a.pts = 10000; a.pos = { ...g.stations.papada, y: g.stations.papada.y }; a.weapon = PISTOL;
  g.onEvent(a, ['sv', 'pap']);
  ok(a.pap[PISTOL] === 1 && a.pts === 0, 'servidor debita a Papada e grava o tier');
  a.pts = 100000; a.pos = { x: a.pos.x + 30, y: a.pos.y, z: a.pos.z };
  const before = a.pts; g.onEvent(a, ['sv', 'pap']);
  ok(a.pap[PISTOL] === 1 && a.pts === before, 'longe da máquina o servidor não debita');
  a.pos = { ...g.stations.papada, y: g.stations.papada.y }; a.weapon = KNIFE;
  g.onEvent(a, ['sv', 'pap']);
  ok(a.pap[KNIFE] == null && a.pts === before, 'servidor recusa faca');
  a.weapon = PISTOL; a.papUntil = g.T; g.onEvent(a, ['sv', 'pap']); a.papUntil = g.T; g.onEvent(a, ['sv', 'pap']);
  ok(a.pap[PISTOL] === 3, `servidor sobe até o tier 3 (ficou ${a.pap[PISTOL]}, pontos ${a.pts})`);
  const pts3 = a.pts; a.papUntil = g.T; g.onEvent(a, ['sv', 'pap']);
  ok(a.pap[PISTOL] === 3 && a.pts === pts3, 'servidor não cobra um quarto tier');
  a.pos = { ...g.stations.box, y: g.stations.box.y };
  const boxBefore = a.pts; g.onEvent(a, ['sv', 'box']);
  ok(a.pts === boxBefore - SURV.boxPrice && g.boxState.phase === 'spin', 'servidor debita a barraca e trava o sorteio');
  g.boxState.until = g.T; g.tick();
  ok(g.boxState.phase === 'offer' && (BOX_POOL.includes(g.boxState.weapon) || g.boxState.weapon === RAY), `oferta da barraca é do pool ou a Ray Gun (${g.boxState.weapon})`);
  const offered = g.boxState.weapon;
  g.onEvent(a, ['sv', 'take']);
  ok(a.slots.includes(offered) && g.boxState.phase === 'idle', 'pegar a oferta entrega a arma e fecha a barraca');
  const wi = g.stations.walls.findIndex((w) => !a.slots.includes(w.w) || (a.slotOn[1] === 0 && w.w !== a.slots[0]));
  const wall = g.stations.walls[wi];
  a.pos = { x: wall.x, y: wall.y, z: wall.z };
  const had = a.pts; g.onEvent(a, ['sv', 'wall', wi]);
  ok(a.pts < had && a.slots.includes(wall.w), `parede debita no servidor (${WEAPONS[wall.w].short})`);
  // respawn: pistola e faca de novo, tier da pistola continua
  a.alive = false; a.respawnAt = g.T; a.rsReq = true; g.tick();
  ok(a.alive && a.slots[0] === PISTOL && a.slotOn[1] === 0 && a.slots[2] === KNIFE && a.pap[PISTOL] === 3, 'respawn Survival volta pra pistola e faca e guarda o tier');
}
{
  const { g, a } = room(PADRAO_ID);
  ok(!g.survival && !g.stations, 'Padrão não monta loja');
  const prim = a.primary; a.pts = 999999; a.weapon = a.slots[0];
  g.onEvent(a, ['sv', 'pap']); g.onEvent(a, ['sv', 'box']); g.onEvent(a, ['sv', 'wall', 0]);
  ok(a.pts === 999999 && !(a.pap && a.pap[a.weapon]) && a.primary === prim, 'Padrão: servidor não debita e não mexe na arma');
  ok(a.slots[0] !== PISTOL || a.slotOn == null || a.slotOn[1] !== 0, 'Padrão não força pistola e faca');
  const left = g.inv.phaseEnd - g.inv.T;
  ok(left <= INV.PREP && left > INV.PREP - 0.4, `Padrão mantém a preparação de ${INV.PREP}s`);
  g.testInv(a, { wave: 1 });
  const std = waveSpec(1, 1);
  ok(g.inv.spec.spdMul === std.spdMul && g.inv.spec.total === std.total && g.inv.spec.hpMul === std.hpMul && g.inv.spec.dmgMul === std.dmgMul && g.inv.spec.spawnEvery === std.spawnEvery && g.inv.spec.gap == null && !(g.inv.spec.lead > 0), 'servidor Padrão usa o waveSpec, sem a curva do Survival');
  g.testInv(a, { wave: 8 });
  ok(g.inv.spec.spdMul === waveSpec(8, 1).spdMul && g.inv.spec.total === waveSpec(8, 1).total, 'servidor Padrão na wave 8 também não muda');
}
{
  const { g, a, step } = room(SURV_ID);
  const tune = getSurvivalWaveTuning(1, 1);
  const left = g.inv.phaseEnd - g.inv.T;
  ok(left <= tune.prep && left > tune.prep - 0.4, `servidor Survival espera ${tune.prep}s antes da wave 1`);
  g.testInv(a, { wave: 1 });
  ok(g.inv.spec.spdMul === tune.spdMul && g.inv.spec.total === tune.total && g.inv.spec.hpMul === tune.hpMul && g.inv.spec.dmgMul === tune.dmgMul && g.inv.spec.spawnEvery === tune.spawnEvery && g.inv.spec.gap === tune.gap, 'servidor Survival aplica getSurvivalWaveTuning na wave 1');
  step(90, 0.05);
  const zs = g.inv.zombies.filter((z) => z.alive && z.zt === 'walker');
  ok(zs.length >= 1 && zs.length <= tune.maxAlive, `wave 1 no servidor nasce devagar (${zs.length} vivos, teto ${tune.maxAlive})`);
  if (zs.length) {
    const lo = ZOMBIES.walker.speed * tune.spdMul * 0.92, hi = ZOMBIES.walker.speed * tune.spdMul * 1.08;
    ok(zs.every((z) => z.spd >= lo - 1e-6 && z.spd <= hi + 1e-6), `velocidade real na faixa da wave 1 (${zs.map((z) => z.spd.toFixed(2)).join(', ')})`);
    ok(Math.max(...zs.map((z) => z.spd)) < ZOMBIES.walker.speed * waveSpec(1, 1).spdMul * 0.92, 'o zumbi do servidor é mais lento que o walker do Padrão');
  }
  g.testInv(a, { clearQueue: true, killAll: true });
  step(1);
  ok(g.inv.phase === 'break' && Math.abs(g.inv.phaseEnd - g.inv.T - tune.gap) < 0.08, `pausa do servidor depois da wave 1 é ${tune.gap}s`);
  g.testInv(a, { wave: 12 });
  const late = getSurvivalWaveTuning(12, 1);
  ok(g.inv.spec.spdMul === late.spdMul && late.spdMul === waveSpec(12, 1).spdMul, 'na wave 12 o servidor já anda na velocidade do Padrão');
}

// Ray Gun: só a barraca, no Survival, com ricochete e estouro. Não entra em parede, classe, loadout nem Padrão.
{
  const W = WEAPONS[RAY];
  ok(RAY === 27 && W && W.key === 'ray' && W.ray && W.mag === 20 && W.reserve === 160 && W.dmg === 260 && Math.abs(W.rate - 0.22) < 1e-9, `Ray Gun no índice 27 · ${W.mag}/${W.reserve} · dano ${W.dmg} · tiro ${W.rate}s`);
  ok(!PRIMARIES.includes(RAY) && !SECONDARIES.includes(RAY) && !BOT_PRIMARIES.includes(RAY) && !CATEGORIES.some((c) => (c.weapons || []).includes(RAY)) && !BOX_POOL.includes(RAY) && !WALL_CATALOG.some((w) => w.w === RAY), 'fora da parede, das classes, do loadout, dos bots e do pool uniforme');
  ok(Math.abs(RAY_ODDS - 0.065) < 1e-9, `chance na barraca ${RAY_ODDS * 100}%`);
  let k = 0; const seq = () => (k++) / 10000; let rays = 0;
  for (let i = 0; i < 10000; i++) if (rollBox(seq) === RAY) rays++;
  ok(rays === 650, `em 10.000 giros saem ${rays} Ray Guns (6,5% cravado)`);
  const held = applySurvivalLoadout({ pts: 999999 });
  held.weapon = RAY; held.slots[1] = RAY; held.slotOn[1] = 1;
  ok(rollBox(() => 0, RAY) !== RAY, 'quem já está com a Ray Gun não tira outra no primeiro número');
  const wallNo = tryWall(applySurvivalLoadout({ pts: 999999 }), { w: RAY, price: 1, ammo: 1, x: 0, z: 0 });
  ok(!wallNo.ok && wallNo.reason === 'parede', 'parede recusa a Ray Gun mesmo com preço 1');
  ok(papOk(W) && papName(W, 1) === 'Ray Gun na Brasa' && papName(W, 2) === 'Ray Gun Defumado' && papName(W, 3) === 'Ray Gun Pururuca', 'Papada: Ray Gun na Brasa, Defumado, Pururuca');
  const line = statLine(W, 0, 1);
  ok(line.text.includes('dano') && line.text.includes('→') && line.after.name === 'Ray Gun na Brasa', `prompt do tier 1: ${line.text}`);
  const d0 = shownDmg(W, 0), d1 = shownDmg(W, 1), d2 = shownDmg(W, 2), d3 = shownDmg(W, 3);
  ok(d1 > d0 && d2 > d1 && d3 > d2 && d3 < 520, `dano ${d0} → ${d1} → ${d2} → ${d3} (tier 3 não mata o barrigão de um tiro)`);
  const ttk = (hp, dmg, rate) => (Math.ceil(hp / dmg) - 1) * rate;
  const rayTank = ttk(520, d0, W.rate);
  let slower = 0, compared = 0;
  for (const o of WEAPONS) {
    if (!o || o.ray || o.melee || o.shield || o.saber || o.key === 'faca-dourada') continue;
    const dmg = o.rocket ? o.rocket.maxDmg : (o.pellets | 0) > 1 ? o.dmg * o.pellets : o.dmg;
    if (!(dmg > 0) || !(o.rate > 0)) continue;
    compared++;
    if (rayTank < ttk(520, dmg, o.rate)) slower++;
  }
  ok(compared > 10 && slower === compared, `no barrigão (520) a Ray Gun mata em ${rayTank.toFixed(2)}s, mais rápido que as outras ${compared} armas sem upgrade`);
  const splash = raySplash(W);
  const selfCenter = splash.maxDmg * splash.selfMul;
  ok(splash.radius > 1 && splash.radius < 2.2 && selfCenter > 8 && selfCenter < 30, `estouro ${splash.radius} m · auto-dano no centro ${selfCenter.toFixed(1)} (leve)`);
  // ricochete: parede, chão e teto, pela normal. A mesma função que o servidor chama.
  const P = createPhysics([
    { min: { x: 2, y: 0, z: -2 }, max: { x: 2.4, y: 3, z: 2 } },
    { min: { x: -1, y: 2.2, z: -1 }, max: { x: 1, y: 2.5, z: 1 } },
  ], [20, 20]);
  const unit = (x, y, z) => { const L = Math.hypot(x, y, z) || 1; return { x: x / L, y: y / L, z: z / L }; };
  const wall = { pos: { x: 0, y: 1, z: 0 }, dir: { x: 1, y: 0, z: 0 }, bounces: 0, t: 0, traveled: 0 };
  let wallBack = null;
  for (let i = 0; i < 20 && !wall.dead && wallBack == null; i++) { const hs = stepRay(P, wall, 0.05); if (hs.some((h) => !h.dead)) wallBack = wall.dir.x; }
  ok(wallBack != null && wallBack < -0.5, `parede: normal +x devolve o raio (dir.x ${wallBack == null ? '?' : wallBack.toFixed(2)})`);
  const floor = { pos: { x: 0, y: 1.2, z: 0 }, dir: unit(0.1, -1, 0), bounces: 0, t: 0, traveled: 0 };
  let floorHit = null;
  for (let i = 0; i < 20 && !floor.dead; i++) { const hs = stepRay(P, floor, 0.05); if (!floorHit) floorHit = hs.find((h) => !h.dead); }
  ok(floorHit && floorHit.n.y > 0.9 && floor.dir.y > 0.2, `chão: normal pra cima, raio sobe (dir.y ${floor.dir.y.toFixed(2)})`);
  const ceil = { pos: { x: 0, y: 1, z: 0 }, dir: unit(0, 1, 0), bounces: 0, t: 0, traveled: 0 };
  let ceilHit = null;
  for (let i = 0; i < 20 && !ceil.dead; i++) { const hs = stepRay(P, ceil, 0.05); if (!ceilHit) ceilHit = hs.find((h) => !h.dead); }
  ok(ceilHit && ceilHit.n.y < -0.5 && ceil.dir.y < -0.2, `teto: normal pra baixo, raio desce (dir.y ${ceil.dir.y.toFixed(2)})`);
  const alley = createPhysics([
    { min: { x: 1.2, y: 0, z: -1 }, max: { x: 1.5, y: 3, z: 1 } },
    { min: { x: -1.5, y: 0, z: -1 }, max: { x: -1.2, y: 3, z: 1 } },
  ], [20, 20]);
  const hop = { pos: { x: 0, y: 1, z: 0 }, dir: { x: 1, y: 0, z: 0 }, bounces: 0, t: 0, traveled: 0 };
  let bounces = 0;
  for (let i = 0; i < 40 && !hop.dead; i++) bounces += stepRay(alley, hop, 0.05).filter((h) => !h.dead).length;
  ok(hop.dead && bounces === RAY_MOVE.bounces, `para depois de ${bounces} ricochetes (limite ${RAY_MOVE.bounces})`);
  const far = { pos: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: 1 }, bounces: 0, t: 0, traveled: 0 };
  const open = createPhysics([], [80, 80]);
  for (let i = 0; i < 40 && !far.dead; i++) stepRay(open, far, 0.05);
  ok(far.dead && far.traveled <= RAY_MOVE.range + 0.2 && far.traveled > RAY_MOVE.range - RAY_MOVE.speed * 0.05, `alcance máximo ${far.traveled.toFixed(1)} m (teto ${RAY_MOVE.range})`);
}
{
  const { g, a, step } = room(PADRAO_ID);
  a.slots = [RAY, PISTOL, KNIFE]; a.slotOn = [1, 1, 1]; a.weapon = RAY; a.mag[RAY] = 20; a.alive = true;
  const mag = a.mag[RAY], hp = a.hp;
  g.onEvent(a, ['ry', [a.pos.x, a.pos.y + 1.6, a.pos.z], [1, 0, 0], g.now()]);
  step(4);
  ok((a.rejectedShots || 0) > 0 && g.rays.length === 0 && a.mag[RAY] === mag && a.hp === hp, 'Padrão: servidor recusa o disparo e não cria raio');
  g.applyLoadout(a, RAY, PISTOL, KNIFE, true);
  ok(a.slots[0] !== RAY && a.primary !== RAY, 'loadout do Padrão não aceita a Ray Gun');
}
{
  const { g, a, step } = room(SURV_ID);
  a.slots = [PISTOL, RAY, KNIFE]; a.slotOn = [1, 1, 1]; a.weapon = RAY;
  a.mag[RAY] = 20; a.reserve[RAY] = 160; a.alive = true; a.invulnUntil = 0; a.lastShot[RAY] = -9; a.lastCt[RAY] = -9;
  const y = a.pos.y;
  const z = g.makeEnt({ name: 'Barrigao', bot: true, primary: 0 });
  z.zt = 'tank'; z.alive = true; z.hp = 800; z.maxHp = 800; z.invulnUntil = 0; z.connected = true; z.size = 1;
  let aim = null;
  for (let ang = 0; ang < Math.PI * 2 && !aim; ang += 0.35) {
    const d = { x: Math.cos(ang), y: 0, z: Math.sin(ang) };
    const hit = g.P.rayWorldN({ x: a.pos.x, y: y + 1.5, z: a.pos.z }, d, 8);
    if (hit == null || hit.t > 5) aim = d;
  }
  ok(!!aim, 'achou um corredor livre pra o raio');
  z.pos = { x: a.pos.x + aim.x * 1.35, y, z: a.pos.z + aim.z * 1.35 };
  const before = a.hp;
  g.onEvent(a, ['ry', [a.pos.x, y + 1.5, a.pos.z], [aim.x, aim.y, aim.z], g.now()]);
  ok(g.rays.length === 1 && a.mag[RAY] === 19, 'Survival: o servidor cria o raio e gasta uma bala');
  let hurtZ = false, hurtSelf = false;
  for (let i = 0; i < 12; i++) { step(1); if (z.hp < 800) hurtZ = true; if (a.hp < before) hurtSelf = true; }
  const dealt = 800 - z.hp;
  ok(hurtZ && dealt >= 200 && dealt <= 270, `zumbi levou o estouro cheio (${dealt} de dano, vida ${z.hp})`);
  ok(hurtSelf && before - a.hp < 40 && before - a.hp > 0, `auto-dano leve no splash (${(before - a.hp).toFixed(1)})`);
  z.alive = false; z.pos = { x: 999, y, z: 999 };
  a.hp = 100; a.alive = true; a.mag[RAY] = 20; a.lastCt[RAY] = -9; a.lastShot[RAY] = -9;
  g.rays.length = 0;
  g.onEvent(a, ['ry', [a.pos.x, y + 1.45, a.pos.z], [0, -1, 0], g.now()]);
  let foot = 100;
  // No saguão o teto é baixo: o raio quica de novo e acaba estourando. O conserto é o primeiro quique, que só dá o splash leve.
  for (let i = 0; i < 8 && g.rays.length; i++) {
    g.stepRays(0.05);
    foot = a.hp;
    if (g.rays[0] && g.rays[0].bounces > 0) break;
  }
  ok(foot < 100 && 100 - foot < 40, `tiro no pé quica e dá auto-dano leve (${(100 - foot).toFixed(1)})`);
  z.alive = false; z.pos = { x: 999, y, z: 999 };
  a.mag[RAY] = 20; a.lastCt[RAY] = -9; a.lastShot[RAY] = -9; a.alive = true; a.hp = Math.max(a.hp, 40);
  let face = null;
  for (let ang = 0; ang < Math.PI * 2 && !face; ang += 0.15) {
    const d = { x: Math.cos(ang), y: 0, z: Math.sin(ang) };
    const hit = g.P.rayWorldN({ x: a.pos.x, y: y + 1.2, z: a.pos.z }, d, 14);
    if (hit && hit.t > 1.2 && hit.t < 10 && Math.abs(hit.n.y) < 0.2) face = d;
  }
  ok(!!face, 'achou uma parede pra ricochetear');
  g.rays.length = 0;
  g.onEvent(a, ['ry', [a.pos.x, y + 1.2, a.pos.z], [face.x, 0, face.z], g.now()]);
  let bounced = g.events.some((ev) => ev[0] === 'yb');
  for (let i = 0; i < 16 && g.rays.length && !bounced; i++) {
    g.events.length = 0; g.stepRays(0.05); g.T += 0.05;
    if (g.events.some((ev) => ev[0] === 'yb') || (g.rays[0] && g.rays[0].bounces > 0)) bounced = true;
  }
  ok(bounced, 'servidor ricocheteia o raio na parede');
}

console.log(fails.length ? '\nFALHOU ' + fails.length : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

// Navegação dos zumbis no Survival (HOTMILK à Noite).
// Prova caminho, tempo e progresso — não só que A* devolve um array.
// Uso: node test-zombie-nav.mjs
import { Game } from './server/src/game.js';
import { getMap } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';
import { buildNav } from './nav.js';
import { InvasionCore, ZOMBIES, orderZombie } from './shared/invasion.js';
import { closedDoorSolids, createMatchSurvival, unlockedZombieSpawns } from './shared/survival.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const map = getMap('hotmilk-noite');

function mulberry32(a) {
  return function rnd() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boot(openIds, rnd) {
  const state = createMatchSurvival(map);
  for (const id of openIds) {
    state.open.add(id);
    const door = map.survival.doors.find((d) => d.id === id);
    if (door) for (const a of door.areas) state.areas.add(a);
  }
  let solids = mapSolids(map).concat(closedDoorSolids(map, state.open));
  let P = createPhysics(solids, map.size);
  const seedsOf = () => map.spawns.map(([x, z, y = 0]) => [x, P.groundAt(x, z, y + 0.3), z]);
  let nav = buildNav({ hx: map.size[0], hz: map.size[1], spacing: map.navSpacing || 2, collides: P.collides, groundAt: P.groundAt, solids, topAt: P.topAt, seeds: seedsOf(), extra: map.waypoints || [] });
  let T = 0;
  const players = [];
  const bites = [];
  const core = new InvasionCore({
    T: () => T, get P() { return P; }, get nav() { return nav; }, size: map.size, botDiff: 'ceva', rnd, survival: true,
    players: () => players,
    spawnZombie(type, pos) {
      return { id: 0, pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, alive: true, onGround: true, crouch: 0 };
    },
    removeZombie() {},
    hurtPlayer(p, dmg, src) {
      const clear = src && P.losClear({ x: src.pos.x, y: src.pos.y + 0.9, z: src.pos.z }, { x: p.pos.x, y: p.pos.y + 0.9, z: p.pos.z });
      bites.push({ t: T, pid: p.id, z: src && src.id, clear, zx: src.pos.x, zy: src.pos.y, zz: src.pos.z, px: p.pos.x, py: p.pos.y, pz: p.pos.z });
    },
    hurtZombie() {}, knock() {}, heal() {}, revive() {}, invChanged() {}, emit() {}, giveAmmo() { return false; },
    aimOf() { return { o: { x: 0, y: 1.6, z: 0 }, d: { x: 0, y: 0, z: 1 } }; }, over() {},
    spawnPoints: () => unlockedZombieSpawns(map, state).map((s) => ({ x: s.x, z: s.z, y: P.groundAt(s.x, s.z, s.y + 0.35), area: s.area })).filter((s) => !P.collides(s.x, s.y, s.z)),
    spawnAreas: () => map.survival.areas.filter((a) => state.areas.has(a.id)).map((a) => a.box),
  });
  core.phase = 'wave';
  core.spec = { w: 8, n: 1, total: 8, mix: { walker: 1 }, boss: false, hpMul: 1, spdMul: 1, dmgMul: 1, maxAlive: 36, batch: 1, spawnEvery: 0.35, bossHp: 100, lead: 0 };
  const api = {
    get P() { return P; }, get nav() { return nav; }, state, core, players, bites, get T() { return T; },
    addPlayer(id, x, z, y = 0) {
      const py = P.groundAt(x, z, y + 0.4);
      const p = { id, pos: { x, y: py, z }, vel: { x: 0, y: 0, z: 0 }, alive: true, ghostUntil: 0, hp: 100, yaw: 0, pitch: 0, lives: 2, out: false, inv: [] };
      players.push(p); return p;
    },
    place(type, x, z, y = 0) {
      const st = ZOMBIES[type];
      const pos = { x, y: P.groundAt(x, z, y + 0.4), z };
      const zed = { id: core.nid++, pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, alive: true, onGround: true, crouch: 0 };
      Object.assign(zed, { zt: type, zi: 0, hp: st.hp, maxHp: st.hp, spd: st.speed, dmgMul: 1, size: st.size, nextAtk: 0, nextSpit: 1e9, stunUntil: 0, target: null, retarget: 0, node: null, nodeAt: -9, stuck: 0, removeAt: Infinity, lastLos: false, losAt: -9, aiState: '' });
      core.zombies.push(zed); return zed;
    },
    sim(sec, dt = 1 / 30, onTick) {
      const n = Math.round(sec / dt);
      for (let i = 0; i < n; i++) { T += dt; if (onTick) onTick(T, dt); core.step(dt); }
    },
    openDoor(id) {
      state.open.add(id);
      const door = map.survival.doors.find((d) => d.id === id);
      if (door) for (const a of door.areas) state.areas.add(a);
      solids = mapSolids(map).concat(closedDoorSolids(map, state.open));
      P = createPhysics(solids, map.size);
      nav = buildNav({ hx: map.size[0], hz: map.size[1], spacing: map.navSpacing || 2, collides: P.collides, groundAt: P.groundAt, solids, topAt: P.topAt, seeds: seedsOf(), extra: map.waypoints || [] });
      core.rev = null; core._spawnGen = -1;
      for (const z of core.zombies) { z.node = null; z.nodeAt = -9; }
    },
    dist(a, b) { return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z); },
  };
  return api;
}

function throughBites(w) {
  return w.bites.filter((b) => !b.clear);
}

function round(seed) {
  const rnd = mulberry32(seed);
  console.log(`\n--- rodada seed ${seed} ---`);

  // 1) parede em L da escada: tem de contornar, não pular no lugar
  {
    const w = boot([], rnd);
    const p = w.addPlayer(1, -10, 37);
    const z = w.place('walker', 10, 37);
    const x0 = z.pos.x;
    let maxY = z.pos.y, minD = w.dist(z, p);
    const t0 = Date.now();
    w.sim(14, 1 / 30, () => { maxY = Math.max(maxY, z.pos.y); minD = Math.min(minD, w.dist(z, p)); });
    const ms = Date.now() - t0;
    const d = w.dist(z, p);
    ok(d < 2.4, `L escada seed ${seed}: chegou em ${d.toFixed(2)} m (saiu de x ${x0.toFixed(1)} → ${z.pos.x.toFixed(1)}) em 14 s, min ${minD.toFixed(2)}`);
    ok(maxY < 0.85, `L escada seed ${seed}: não ficou pulando na parede (y máx ${maxY.toFixed(2)})`);
    ok(throughBites(w).length === 0, `L escada seed ${seed}: mordida só com vão livre (${throughBites(w).length} através)`);
    console.log(`  tempo sim L ${ms} ms, estado ${z.aiState}`);
  }

  // 2) porta fechada: aproxima e para, sem atravessar e sem morder
  {
    const w = boot([], rnd);
    const p = w.addPlayer(1, -22, 24.9);
    const z = w.place('walker', -8, 24.9);
    w.sim(8);
    const dDoor = -15.65 - z.pos.x;
    ok(z.pos.x > -15.55, `porta fechada seed ${seed}: corpo ficou no saguão (x ${z.pos.x.toFixed(2)})`);
    ok(z.pos.x < -12, `porta fechada seed ${seed}: andou até a folha (x ${z.pos.x.toFixed(2)}, faltam ${dDoor.toFixed(2)} m)`);
    ok(throughBites(w).length === 0 && w.bites.length === 0, `porta fechada seed ${seed}: não mordeu através (${w.bites.length})`);
    const xHold = z.pos.x, yHold = z.pos.y;
    w.sim(2);
    ok(Math.abs(z.pos.x - xHold) < 0.45 && z.pos.y < 0.5, `porta fechada seed ${seed}: parou na folha (Δx ${(z.pos.x - xHold).toFixed(2)}, y ${z.pos.y.toFixed(2)}) em vez de pular`);
    const tOpen = Date.now();
    w.openDoor('porta-cozinha');
    w.sim(12);
    const d = w.dist(z, p);
    ok(d < 2.6, `porta aberta seed ${seed}: atravessou o vão e chegou em ${d.toFixed(2)} m (${Date.now() - tOpen} ms de sim)`);
    ok(throughBites(w).length === 0, `porta aberta seed ${seed}: mordidas com vão (${throughBites(w).length} através)`);
  }

  // 3) mordida colada na folha, alcance horizontal mas parede no meio
  {
    const w = boot([], rnd);
    const p = w.addPlayer(1, -16.72, 24.9);
    const z = w.place('walker', -15.22, 24.9);
    const dh = w.dist(z, p);
    const blocked = !w.P.losClear({ x: z.pos.x, y: z.pos.y + 0.9, z: z.pos.z }, { x: p.pos.x, y: p.pos.y + 0.9, z: p.pos.z });
    w.sim(1.5);
    ok(blocked && dh < ZOMBIES.walker.reach && w.bites.length === 0 && z.pos.x > -15.55, `mordida na folha seed ${seed}: vão fechado, distância ${dh.toFixed(2)} m, 0 acertos, x ${z.pos.x.toFixed(2)}`);
  }

  // 4) balcão: contorna (ou sobe) e chega; não morde com o balcão no meio
  {
    const w = boot(['porta-cozinha'], rnd);
    const p = w.addPlayer(1, -19.2, 24);
    const z = w.place('walker', -24.6, 24);
    let bitesBlocked = 0;
    w.sim(10);
    for (const b of w.bites) if (!b.clear) bitesBlocked++;
    ok(w.dist(z, p) < 2.2, `balcão seed ${seed}: chegou em ${w.dist(z, p).toFixed(2)} m, pos (${z.pos.x.toFixed(1)}, ${z.pos.z.toFixed(1)})`);
    ok(bitesBlocked === 0, `balcão seed ${seed}: sem mordida através (${bitesBlocked})`);
  }

  // 5) corredor em U no 2º andar
  {
    const w = boot(['porta-escada'], rnd);
    const p = w.addPlayer(1, 22, 22, 3.4);
    const z = w.place('walker', -22, 22, 3.4);
    ok(!w.P.collides(p.pos.x, p.pos.y, p.pos.z) && !w.P.collides(z.pos.x, z.pos.y, z.pos.z), `U andar seed ${seed}: os dois pontos são pisáveis`);
    const d0 = w.dist(z, p);
    let minD = d0;
    w.sim(18, 1 / 30, () => { minD = Math.min(minD, w.dist(z, p)); });
    ok(w.dist(z, p) < 2.6, `U andar seed ${seed}: ${d0.toFixed(0)} m → ${w.dist(z, p).toFixed(2)} m em 18 s (mín ${minD.toFixed(2)}) y ${z.pos.y.toFixed(2)}`);
  }

  // 6) alvo troca de lado da escada
  {
    const w = boot([], rnd);
    const p = w.addPlayer(1, -12, 28);
    const z = w.place('walker', 12, 18);
    let swapped = false, dAtSwap = 99, tSwap = 0;
    const tStart = w.T;
    w.sim(16, 1 / 30, (T) => {
      if (!swapped && T - tStart > 5) {
        p.pos.x = 12; p.pos.z = 36; p.pos.y = w.P.groundAt(12, 36, 1);
        swapped = true; dAtSwap = w.dist(z, p); tSwap = T;
      }
    });
    ok(swapped && w.dist(z, p) < 2.8, `alvo muda de lado seed ${seed}: depois da troca (${dAtSwap.toFixed(1)} m em t ${tSwap.toFixed(1)}) chegou a ${w.dist(z, p).toFixed(2)} m`);
  }

  // 7) dois jogadores: um inacessível atrás da porta, o zumbi vai no que dá pra alcançar
  {
    const w = boot([], rnd);
    const near = w.addPlayer(1, 0, 18);
    const far = w.addPlayer(2, -22, 30);
    const z = w.place('walker', 10, 30);
    w.sim(12);
    ok(w.dist(z, near) < 2.6 && w.dist(z, near) + 4 < w.dist(z, far), `dois alvos seed ${seed}: foi no saguão (${w.dist(z, near).toFixed(2)} m) e não na cozinha fechada (${w.dist(z, far).toFixed(2)} m)`);
  }

  // 8) ordem de alvo (gancho da frente de down): persegue o id pedido, não o mais perto
  {
    const w = boot([], rnd);
    const close = w.addPlayer(1, 2, 20);
    const other = w.addPlayer(2, -12, 30);
    const z = w.place('walker', 0, 16);
    orderZombie(z, { targetId: 2 });
    w.sim(12);
    ok(z.target === other && w.dist(z, other) < 2.6, `orderZombie seed ${seed}: alvo ${z.target && z.target.id} a ${w.dist(z, other).toFixed(2)} m (perto ficou a ${w.dist(z, close).toFixed(2)})`);
    orderZombie(z, { hold: true });
    const x = z.pos.x, zz = z.pos.z;
    w.sim(2);
    ok(z.target == null && Math.hypot(z.pos.x - x, z.pos.z - zz) < 1.2, `order hold seed ${seed}: parou de caçar (deslocou ${Math.hypot(z.pos.x - x, z.pos.z - zz).toFixed(2)} m)`);
  }

  // 9) spawn com sala cheia, repetido
  {
    const w = boot([], rnd);
    const spots = [[-6, 15], [6, 15], [-6, 22], [6, 22], [0, 26], [-12, 28], [12, 18], [-10, 16]];
    for (let n = 1; n <= 4; n++) {
      w.players.length = 0;
      for (let i = 0; i < n; i++) w.addPlayer(i + 1, spots[i][0], spots[i][1]);
      let nil = 0, bad = 0, close = 0, out = 0, unlink = 0, got = 0;
      const box = map.survival.areas.find((a) => a.id === 'saguao').box;
      for (let k = 0; k < 25; k++) {
        const s = w.core.spawnPos();
        if (!s) { nil++; continue; }
        got++;
        if (w.P.collides(s.x, s.y, s.z)) bad++;
        let dp = 1e9; for (const p of w.players) dp = Math.min(dp, Math.hypot(s.x - p.pos.x, s.z - p.pos.z));
        if (dp < 3.2) close++;
        if (s.x < box[0] - 0.6 || s.x > box[2] + 0.6 || s.z < box[1] - 0.6 || s.z > box[3] + 0.6) out++;
        const node = w.core.standNode(s.x, s.y, s.z);
        if (!node || !w.core.flow || w.core.flow.dist[node.id] > 1e8) unlink++;
      }
      ok(got >= 20 && bad === 0 && close === 0 && out === 0 && unlink === 0, `spawn ${n} jogadores seed ${seed}: ${got}/25 válidos, sólido ${bad}, em cima ${close}, fora ${out}, sem caminho ${unlink}, null ${nil}`);
    }
  }

  // 10) multidão + custo por tick
  {
    const w = boot([], rnd);
    const p = w.addPlayer(1, 0, 30);
    const zs = [];
    for (let i = 0; i < 16; i++) zs.push(w.place(i % 4 === 0 ? 'runner' : 'walker', -7 + (i % 8) * 1.15, 14 + Math.floor(i / 8) * 1.2));
    const ticks = Math.round(12 / (1 / 30));
    const t0 = Date.now();
    w.sim(12);
    const ms = Date.now() - t0;
    const per = ms / ticks;
    let reached = 0;
    for (const z of zs) if (w.dist(z, p) < 3) reached++;
    ok(reached >= 12, `multidão seed ${seed}: ${reached}/16 a menos de 3 m em 12 s`);
    ok(throughBites(w).length === 0, `multidão seed ${seed}: ${throughBites(w).length} mordidas através de parede`);
    console.log(`  16 zumbis: ${per.toFixed(3)} ms/tick (${ms} ms / ${ticks} ticks)`);
    w.players.length = 0; w.core.zombies = [];
    w.addPlayer(1, 0, 22);
    for (let i = 0; i < 36; i++) w.place('walker', -12 + (i % 9) * 3, 14 + Math.floor(i / 9) * 3);
    const t1 = Date.now();
    const flow0 = Date.now();
    w.core.rev = null; w.core.buildFlow();
    const flowMs = Date.now() - flow0;
    const nTick = 60;
    for (let i = 0; i < nTick; i++) w.sim(1 / 30);
    const tickMs = (Date.now() - t1 - flowMs) / nTick;
    console.log(`  buildFlow ${flowMs} ms; 36 zumbis ${tickMs.toFixed(3)} ms/tick`);
    ok(flowMs < 40 && tickMs < 8, `desempenho seed ${seed}: fluxo ${flowMs} ms, tick ${tickMs.toFixed(3)} ms`);
  }
}

for (const seed of [1105, 42, 9001]) round(seed);

console.log('\n--- host com dois jogadores ---');
{
  const io = () => ({ send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  const g = new Game({ code: 'ZN', map: 'hotmilk-noite', max: 8, fillBots: false, mode: 'survival', test: true }, io());
  const ana = g.join({ name: 'Ana' }).ent;
  const bia = g.join({ name: 'Bia' }).ent;
  g.welcome(ana); g.welcome(bia);
  g.onMessage(ana.id, { t: 'start', map: 'hotmilk-noite' });
  ok(!!g.inv && g.inv.A.survival === true && g.mapId === 'hotmilk-noite', 'host Survival liga o mesmo núcleo com survival:true');
  ana.alive = true; bia.alive = true; ana.hp = bia.hp = 1e6; ana.maxHp = bia.maxHp = 1e6;
  ana.pos = { x: -10, y: g.P.groundAt(-10, 37, 1), z: 37 };
  bia.pos = { x: 12, y: g.P.groundAt(12, 18, 1), z: 18 };
  const farA = { ...ana.pos }, farB = { ...bia.pos };
  ana.pos = { x: 40, y: 0, z: 60 }; bia.pos = { x: 40, y: 0, z: -60 };
  g.inv.phase = 'wave';
  const z = g.inv.spawn('walker');
  ok(!!z, 'host consegue spawnar um zumbi no saguão');
  z.pos.x = 10; z.pos.y = g.P.groundAt(10, 37, 1); z.pos.z = 37; z.vel = { x: 0, y: 0, z: 0 };
  ana.pos = farA; bia.pos = farB;
  const step = (sec) => { for (let i = 0; i < sec * 30; i++) { g.T += 1 / 30; g.inv.step(1 / 30); } };
  step(8);
  const dBia = Math.hypot(z.pos.x - bia.pos.x, z.pos.z - bia.pos.z);
  const dAna = Math.hypot(z.pos.x - ana.pos.x, z.pos.z - ana.pos.z);
  ok(dBia < 2.6 && dBia + 4 < dAna, `host: sem ordem, o zumbi vai na Bia (${dBia.toFixed(2)} m) e não atravessa a escada até a Ana (${dAna.toFixed(2)} m)`);
  orderZombie(z, { targetId: ana.id });
  step(14);
  const dAna2 = Math.hypot(z.pos.x - ana.pos.x, z.pos.z - ana.pos.z);
  const dBia2 = Math.hypot(z.pos.x - bia.pos.x, z.pos.z - bia.pos.z);
  ok(z.target === ana && dAna2 < 2.6 && dAna2 + 4 < dBia2, `host: ordem troca o alvo pra Ana e ele contorna (${dAna2.toFixed(2)} m; Bia ficou a ${dBia2.toFixed(2)})`);
  ok(!g.P.collides(z.pos.x, z.pos.y, z.pos.z), 'host: zumbi termina fora de sólido');
}
console.log(fails.length ? `\n${fails.length} falha(s)` : '\ntudo ok');
process.exit(fails.length ? 1 : 0);

// Portas da HOTMILK à Noite e o mapa preso ao Survival.
// Uso: node test-survival-portas.mjs
import { MAPS, PLAY_MAPS, INV_MAPS, BOMB_MAPS, X1_MAPS, SURVIVAL_MAPS, getMap } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';
import { buildNav } from './nav.js';
import { Game } from './server/src/game.js';
import {
  SURVIVAL, isSurvivalMode, pointsForKill, pointsForHit, createMatchSurvival, killPoints,
  closedDoorSolids, evaluateDoorBuy, commitDoorBuy, unlockedZombieSpawns,
} from './shared/survival.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const io = () => ({ send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });

const map = getMap('hotmilk-noite');
ok(map && map.survivalOnly && map.mode === 'survival', 'mapa existe, survivalOnly e mode survival');
ok(!PLAY_MAPS.some((m) => m.id === 'hotmilk-noite'), 'fora do rodízio comum');
ok(!INV_MAPS.some((m) => m.id === 'hotmilk-noite'), 'fora da Invasão padrão');
ok(!BOMB_MAPS.some((m) => m.id === 'hotmilk-noite'), 'fora da Bomba');
ok(!X1_MAPS.some((m) => m.id === 'hotmilk-noite'), 'fora do X1');
ok(SURVIVAL_MAPS.length === 1 && SURVIVAL_MAPS[0].id === 'hotmilk-noite', 'SURVIVAL_MAPS só tem a HOTMILK à Noite');
ok(isSurvivalMode('survival') && isSurvivalMode('inv', { variant: 'survival' }) && isSurvivalMode('dm', { survival: true }) && !isSurvivalMode('inv') && !isSurvivalMode('dm'), 'flag de modo: survival, variant ou cfg.survival');

const prices = map.survival.doors.map((d) => d.price);
ok(prices.join(',') === '750,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250', `preços crescentes (${prices.join(', ')})`);
ok(map.survival.playerSpawns.length >= 8, `${map.survival.playerSpawns.length} vagas no saguão`);
{
  const ps = map.survival.playerSpawns;
  let min = Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < ps.length; i++) {
    x0 = Math.min(x0, ps[i][0]); x1 = Math.max(x1, ps[i][0]); z0 = Math.min(z0, ps[i][1]); z1 = Math.max(z1, ps[i][1]);
    for (let j = i + 1; j < ps.length; j++) min = Math.min(min, Math.hypot(ps[i][0] - ps[j][0], ps[i][1] - ps[j][1]));
  }
  ok(min >= 4, `vagas afastadas ${min.toFixed(1)} m`);
  ok(x1 - x0 >= 18 && z1 - z0 >= 12, `saguão de partida ${ (x1 - x0).toFixed(0) }×${ (z1 - z0).toFixed(0) } m`);
  ok(ps.every(([x, z]) => x > -16 && x < 16 && z > 12 && z < 33), 'todas as vagas dentro do saguão');
}
const links = new Map();
for (const d of map.survival.doors) for (const a of d.areas) links.set(a, (links.get(a) || 0) + 1);
ok([...links.values()].every((n) => n >= 2), 'cada área tem pelo menos duas portas (loop, sem beco)');
ok(map.survival.anchors.upgrade.length >= 1 && map.survival.anchors.mystery.some((b) => b.start) && map.survival.anchors.wall.length >= 1, 'âncoras de upgrade, mystery box e arma de parede');

ok(pointsForKill('walker') === 70 && pointsForKill('walker', { head: true }) === 110 && pointsForKill('boss', { knife: true }) === 530, 'tabela de pontos do abate');
{
  const z = { ptsHits: 0 };
  const hits = [pointsForHit(z), pointsForHit(z), pointsForHit(z), pointsForHit(z), pointsForHit(z)];
  ok(hits.join(',') === '10,10,10,10,0', 'acerto paga 10, no máximo 4 por zumbi');
}

function boot(mode, extra = {}) {
  const g = new Game({ code: 'T', map: extra.map || 'hotmilk-noite', max: 8, fillBots: false, mode, variant: extra.variant, survival: extra.survival, test: true }, io());
  const a = g.join({ name: 'Ana' }).ent;
  g.welcome(a);
  g.onMessage(a.id, { t: 'start', map: extra.ask || extra.map || 'hotmilk-noite' });
  return { g, a };
}

{
  const dm = boot('dm', { map: 'hotmilk-noite', ask: 'hotmilk-noite' });
  ok(dm.g.mapId !== 'hotmilk-noite', `mata-mata não abre a HOTMILK à Noite (saiu ${dm.g.mapId})`);
  const inv = boot('inv', { map: 'hotmilk-noite', ask: 'hotmilk-noite' });
  ok(inv.g.mapId !== 'hotmilk-noite', `Invasão padrão não abre a HOTMILK à Noite (saiu ${inv.g.mapId})`);
  const via = boot('inv', { variant: 'survival', map: 'rodizio', ask: 'rodizio' });
  ok(via.g.mapId === 'hotmilk-noite', 'mode inv + variant survival cai na HOTMILK à Noite');
}

const { g, a } = boot('survival', { ask: 'arena' });
ok(g.mapId === 'hotmilk-noite' && g.survival && g.invasion, 'mode survival ignora outro mapa e ainda roda a Invasão');
ok(a.points === SURVIVAL.START_POINTS && g.surv.areas.has('saguao') && !g.surv.areas.has('cozinha'), `entra com ${a.points} pontos e só o saguão aberto`);
ok(!unlockedZombieSpawns(map, g.surv).some((s) => s.area !== 'saguao'), 'zumbi só nasce no saguão enquanto as portas estão fechadas');

const door = map.survival.doors[0];
a.pos = { x: door.at[0], y: 0, z: door.at[2] };
const poor = a.points;
g.onMessage(a.id, { t: 'door', id: door.id });
ok(a.points === poor && !g.surv.open.has(door.id), `sem pontos o servidor não debita nem abre (${door.price})`);

a.points = door.price;
g.onMessage(a.id, { t: 'door', id: door.id });
ok(a.points === 0 && g.surv.open.has(door.id) && g.surv.areas.has('cozinha'), 'debita o preço, abre a porta e libera a cozinha');
const sp = unlockedZombieSpawns(map, g.surv);
ok(sp.some((s) => s.area === 'cozinha') && !sp.some((s) => s.area === 'estoque'), 'spawns de zumbi da cozinha entram; o estoque continua fechado');
g.onMessage(a.id, { t: 'door', id: door.id });
ok(a.points === 0 && g.surv.open.size === 1, 'comprar de novo não debita outra vez');

const bia = g.join({ name: 'Bia' }).ent;
ok((bia.points | 0) === SURVIVAL.START_POINTS, 'quem entra depois não paga a porta que já abriu');
const passarela = map.survival.doors.find((d) => d.id === 'porta-passarela');
bia.pos = { x: passarela.at[0], y: passarela.at[1], z: passarela.at[2] };
bia.points = 99999;
g.onMessage(bia.id, { t: 'door', id: passarela.id });
ok(!g.surv.open.has(passarela.id) && bia.points === 99999, 'passarela não abre com o telhado e o bloco 02 ainda fechados');

a.points = 5000;
a.pos = { x: 0, y: 0, z: 20 };
g.onMessage(a.id, { t: 'door', id: 'porta-estoque' });
ok(!g.surv.open.has('porta-estoque') && a.points === 5000, 'longe da folha o servidor recusa');

const before = a.points;
const z = { id: 999, zt: 'walker', alive: true, pos: { x: 0, y: 0, z: 18 }, dmgMul: 1, ptsHits: 0 };
g.killZombie(z, a, 0, true, false, null);
ok(a.points === before + killPoints('walker', true) && a.pts === a.points, `abate de cabeça credita ${killPoints('walker', true)} no mesmo saldo da loja e da porta`);

{
  const state = createMatchSurvival(map);
  const solids = mapSolids(map).concat(closedDoorSolids(map, state.open));
  const P = createPhysics(solids, map.size);
  const seeds = map.survival.playerSpawns.map(([x, z, y = 0]) => [x, P.groundAt(x, z, y + 0.3), z]);
  const nav = buildNav({ hx: map.size[0], hz: map.size[1], spacing: 2, collides: P.collides, groundAt: P.groundAt, solids, topAt: P.topAt, seeds, extra: map.waypoints || [] });
  const blocked = nav.nearest(-22, 0, 24);
  ok(!blocked || blocked.x > -16, 'com a porta fechada a cozinha não entra no grafo do saguão');
  state.open.add('porta-cozinha'); state.areas.add('cozinha');
  const openSolids = mapSolids(map).concat(closedDoorSolids(map, state.open));
  const Po = createPhysics(openSolids, map.size);
  const nav2 = buildNav({ hx: map.size[0], hz: map.size[1], spacing: 2, collides: Po.collides, groundAt: Po.groundAt, solids: openSolids, topAt: Po.topAt, seeds, extra: map.waypoints || [] });
  const inside = nav2.nearest(-22, 0, 24);
  const path = nav2.path({ x: 0, y: 0, z: 22 }, { x: -22, y: 0, z: 24 });
  ok(inside && inside.x < -18 && path && path.length > 3, 'porta aberta: zumbi acha caminho do saguão até a cozinha');
  const up = nav2.path({ x: 0, y: 0, z: 22 }, { x: -3, y: 3.4, z: 40 });
  ok(!up, 'escada segue fechada: não sobe pro segundo andar');
}

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

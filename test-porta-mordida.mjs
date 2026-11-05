// Porta fechada no alcance real da mordida. Não usa folga de 3 m.
// node test-porta-mordida.mjs
import { getMap } from './maps.js';
import { createPhysics, mapSolids } from './shared/physics.js';
import { closedDoorSolids, createMatchSurvival } from './shared/survival.js';
import { InvasionCore, ZOMBIES } from './shared/invasion.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const hyp = (x, z) => Math.hypot(x, z);

const map = getMap('hotmilk-noite');
const surv = createMatchSurvival(map);
const door = map.survival.doors.find((d) => d.id === 'porta-cozinha');
const reach = ZOMBIES.walker.reach;
const z = { id: 1, zt: 'walker', size: 1, alive: true, pos: { x: -15.35, y: 0.06, z: 24.9 }, vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, onGround: true, dmgMul: 1, nextAtk: 0, retarget: 99, losAt: 99, lastLos: true, stunUntil: 0, aiState: 'chase' };
const player = { id: 2, alive: true, down: false, out: false, ghostUntil: 0, hp: 100, pos: { x: -16.9, y: 0.06, z: 24.9 }, vel: { x: 0, y: 0, z: 0 } };
const dh = hyp(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
const dy = player.pos.y - z.pos.y;

function world(open) {
  const solids = mapSolids(map).concat(closedDoorSolids(map, open));
  return createPhysics(solids, map.size, map.fall || null);
}
function coreFor(P, hurt) {
  return new InvasionCore({
    T: () => 1, P, nav: { nodes: [], good: [], walk: () => -1, path: () => [], nearest: () => null }, size: map.size, survival: true, botDiff: () => 'normal',
    players: () => [player],
    hurtPlayer(p, dmg) { hurt.n++; p.hp -= dmg; },
    spawnZombie() { return null; }, removeZombie() {}, emit() {}, knock() {}, heal() {}, revive() {}, invChanged() {}, giveAmmo() { return false; }, aimOf() { return { o: { x: 0, y: 0, z: 0 }, d: { x: 0, y: 0, z: 1 } }; }, over() {},
  });
}

ok(dh < reach && dh > 0.4, `os dois estão no alcance da mordida (${dh.toFixed(2)} m < ${reach} m)`);
ok(door && door.price === 750, 'a folha testada é a Cozinha do Leite');

const shut = world(surv.open);
const openSet = new Set(surv.open); openSet.add(door.id);
const open = world(openSet);
const closedCore = coreFor(shut, { n: 0 });
ok(!shut.losClear({ x: z.pos.x, y: 1.2, z: z.pos.z }, { x: player.pos.x, y: 1.1, z: player.pos.z }), 'a folha fechada corta a linha entre os corpos');
ok(!closedCore.canBite(z, player, dh, dy, reach), 'canBite recusa no alcance, com a porta fechada');

const hits = { n: 0 };
const live = coreFor(shut, hits);
z.target = player; z.nextAtk = 0; player.hp = 100;
live.stepZombie(z, 0.05, 1);
ok(hits.n === 0 && player.hp === 100, 'um passo da horda não tira vida através da porta fechada');

const openCore = coreFor(open, { n: 0 });
ok(open.losClear({ x: z.pos.x, y: 1.2, z: z.pos.z }, { x: player.pos.x, y: 1.1, z: player.pos.z }), 'sem a folha a linha passa');
ok(openCore.canBite(z, player, dh, dy, reach), 'a mesma distância morde quando a porta já abriu');
z.nextAtk = 0; player.hp = 100;
const hitsOpen = { n: 0 };
const liveOpen = coreFor(open, hitsOpen);
liveOpen.stepZombie(z, 0.05, 1);
ok(hitsOpen.n === 1 && player.hp < 100, `com a porta aberta o passo morde (${player.hp} hp, ${hitsOpen.n} golpe)`);

if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\ntudo ok');

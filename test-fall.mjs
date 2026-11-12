// Queda fatal em todo mapa: plano de morte, física do Posto Nevasca e o servidor (não devolve o corpo).
// Uso: node test-fall.mjs
import { MAPS } from './maps.js';
import { mapSolids, createPhysics, fellOff, killFloorY, mapKillFloorY, acceptFloorY, resolveFall, FALL_FLOOR, DEFAULT_KILL_Y, baselineY } from './shared/physics.js';
import { W_FALL } from './shared/rules.js';
import { Game } from './server/src/game.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

const nev = MAPS.find((m) => m.id === 'posto-nevasca');
ok(!!nev && /natal/i.test(nev.desc), `mapa de Natal é o Posto Nevasca (${nev && nev.name})`);
ok(nev.fall && Number.isFinite(nev.fall.y), `Posto Nevasca declara fall.y (${nev.fall && nev.fall.y})`);
ok(nev.fall.y > acceptFloorY(nev.fall, nev), `plano de morte (${nev.fall.y}) fica acima do piso que o servidor aceita (${acceptFloorY(nev.fall, nev)})`);
ok(nev.fall.y > FALL_FLOOR || acceptFloorY(nev.fall, nev) < nev.fall.y, 'a queda não pode ficar abaixo do piso aceito (bug antigo: y = −46, FALL_FLOOR = −40)');

// Todo mapa tem um plano de morte, mesmo sem map.fall.
for (const map of MAPS) {
  const y = mapKillFloorY(map);
  const acc = acceptFloorY(map.fall, map);
  if (!(Number.isFinite(y) && acc < y)) fails.push(`${map.id}: kill=${y} accept=${acc}`);
}
ok(fails.filter((m) => m.includes(': kill=')).length === 0, `todos os ${MAPS.length} mapas têm plano de morte acima do piso aceito`);

ok(killFloorY(null) === DEFAULT_KILL_Y && fellOff(null, DEFAULT_KILL_Y - 0.01) && !fellOff(null, 0), 'mapa sem fall: mata abaixo de −8 e não mata no chão y = 0');
ok(fellOff({ openWest: true }, -9) && !fellOff({ openWest: true }, -7), 'Morro (fall sem y): usa o padrão −8');

const arena = MAPS.find((m) => m.id === 'arena');
ok(!fellOff(arena.fall, 0, arena) && fellOff(arena.fall, -20, arena), 'Arena da Fazendinha: em pé no chão vive, abaixo do plano morre');

// Física: cair no abismo do Posto (vão a oeste da passarela) atravessa o plano de morte.
const P = createPhysics(mapSolids(nev), nev.size, resolveFall(nev));
const [hx, hz] = nev.size;
ok(baselineY(nev.fall, -20, 8, hx, hz) === nev.fall.abyss && P.groundAt(-20, 8, 4) < -8, 'vão a oeste da passarela não tem chão (baseline no abismo)');
ok(P.groundAt(0, 25, 2) >= -0.01, 'platô norte continua com chão em y = 0');

const drop = (x, y, z) => {
  const e = { pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, onGround: false, crouch: 0 };
  let t = 0, dead = false;
  for (let i = 0; i < 200; i++) {
    P.moveEntity(e, 0.05); t += 0.05;
    if (fellOff(nev.fall, e.pos.y, nev)) { dead = true; break; }
  }
  return { t, y: e.pos.y, dead };
};
const off = drop(-15, 4, 10);
ok(off.dead && off.t < 2 && off.y < nev.fall.y, `cair da passarela mata em ${off.t.toFixed(2)} s (y = ${off.y.toFixed(1)})`);
const north = drop(0, 4, 38);
ok(north.dead, 'cair do platô norte também mata');
const stand = drop(0, 0.2, 25);
ok(!stand.dead && stand.y > -0.01, 'ficar no platô não mata');

// Servidor: aceita a posição abaixo do plano e mata (suicídio, sem crédito de abate). Online não deixa o cliente contar duas vezes.
const io = { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} };
const g = new Game({ code: 'FALL', map: 'posto-nevasca', max: 8, fillBots: false, mode: 'dm' }, io);
g.test = true;
let fake = 1000; g.now = () => fake;
const a = g.join({ name: 'Ana' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' });
a.connected = true; a.alive = true; a.hp = 100; a.invulnUntil = 1e9;
a.pos = { x: 0, y: 0.3, z: 25 }; a.vel = { x: 0, y: 0, z: 0 }; a.lastUpd = fake; a.sq = (a.sq || 0);
const deaths0 = a.deaths, kills0 = a.kills;
// Pacote abaixo do FALL_FLOOR antigo (−40) e do plano de morte (−8): tem que matar, não devolver.
g.onUpdate(a, { sq: a.sq, p: [-20, -12, 8], v: [0, -20, 0], y: 0, pi: 0, g: 0, w: a.weapon, ev: [] });
ok(!a.alive && a.deaths === deaths0 + 1 && a.kills === kills0, `servidor mata a queda no Posto (vivo=${a.alive}, mortes ${deaths0}→${a.deaths})`);
const ev = g.events.find((e) => e[0] === 'k' && e[2] === a.id);
ok(ev && ev[1] === 0 && ev[3] === W_FALL, `feed de queda é suicídio com W_FALL (${JSON.stringify(ev)})`);

// Arena: teleporte abaixo do plano também mata (rede de segurança de qualquer mapa).
const g2 = new Game({ code: 'FALL2', map: 'arena', max: 8, fillBots: false, mode: 'dm' }, io);
g2.test = true; let fake2 = 2000; g2.now = () => fake2;
const b = g2.join({ name: 'Beto' }).ent; g2.welcome(b); g2.onMessage(b.id, { t: 'start' });
b.connected = true; b.alive = true; b.hp = 100; b.invulnUntil = 1e9;
b.pos = { x: 0, y: 0.3, z: 0 }; b.lastUpd = fake2;
g2.onUpdate(b, { sq: b.sq, p: [0, -12, 0], v: [0, -10, 0], y: 0, pi: 0, g: 0, w: b.weapon, ev: [] });
ok(!b.alive && b.deaths === 1, 'servidor mata queda abaixo do plano também na Arena (sem map.fall próprio)');

// Bot no Posto: o tick do servidor mata se o corpo atravessar o plano.
const g3 = new Game({ code: 'FALL3', map: 'posto-nevasca', max: 8, fillBots: true, mode: 'dm' }, io);
g3.test = true; let fake3 = 3000; g3.now = () => fake3;
const c = g3.join({ name: 'Caio' }).ent; g3.welcome(c); g3.onMessage(c.id, { t: 'start' });
const bot = [...g3.ents.values()].find((e) => e.bot && e.alive);
ok(!!bot, 'sala com bot no Posto');
if (bot) {
  bot.pos = { x: -20, y: -12, z: 8 }; bot.vel = { x: 0, y: -10, z: 0 }; bot.onGround = false;
  fake3 += 0.05; g3.tick();
  ok(!bot.alive && bot.deaths >= 1, `bot que cai no Posto morre no tick do servidor (mortes=${bot.deaths})`);
}

if (fails.length) { console.log('\n' + fails.length + ' falha(s)'); process.exit(1); }
console.log('\nTodos os testes de queda passaram.');

// Botijões do Morro: layout, fogo aos 50%, estouro, cadeia, abate e respawn.
// O servidor é a autoridade (HP, fogo, explosão). Uso: node test-gas.mjs
import { Game } from './server/src/game.js';
import { GAS, W_GAS, createGasSim, gasCenter } from './shared/gas.js';
import { getMap } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const map = getMap('morro-leitao');
const sim0 = createGasSim('morro-leitao', () => 0);
ok(sim0.list.length >= 6 && sim0.list.length <= 10, `Morro tem ${sim0.list.length} botijões (6 a 10)`);
ok(createGasSim('arena').list.length === 0, 'outro mapa não ganha botijão');

const tanks = (map.props || []).filter((p) => p.t === 'tank');
ok(tanks.length >= 8, `caixas d'água azuis continuam no mapa (${tanks.length})`);
for (const c of sim0.list) {
  for (const t of tanks) {
    const gap = Math.hypot(c.x - t.x, (c.y + c.h * 0.5) - ((t.y || 0) + (t.h || 1) * 0.5), c.z - t.z);
    ok(gap > (c.r + (t.r || 0.6) + 0.15), `botijão ${c.id} não ocupa a caixa d'água (${gap.toFixed(2)} m)`);
  }
}
const P = createPhysics(mapSolids(map), map.size, map.fall || null);
for (const c of sim0.list) {
  const g = P.groundAt(c.x, c.z, c.y + 0.4);
  ok(Math.abs(g - c.y) < 0.25, `botijão ${c.id} apoia na laje (chão ${g.toFixed(2)}, base ${c.y})`);
}

const parent = sim0.list.map(() => -1);
const find = (i) => parent[i] < 0 ? i : (parent[i] = find(parent[i]));
const join = (i, j) => { const a = find(i), b = find(j); if (a !== b) parent[a] = b; };
for (let i = 0; i < sim0.list.length; i++) for (let j = i + 1; j < sim0.list.length; j++) {
  if (dist(gasCenter(sim0.list[i]), gasCenter(sim0.list[j])) <= GAS.chain) join(i, j);
}
const groups = new Map();
for (let i = 0; i < sim0.list.length; i++) groups.set(find(i), (groups.get(find(i)) || 0) + 1);
const sizes = [...groups.values()].sort((a, b) => b - a);
ok(sizes.includes(3) && sizes.includes(2) && sizes.filter((n) => n === 1).length === 2, `cadeia equilibrada (${sizes.join(',')}) — não é o morro inteiro`);

const shooter = { id: 7, name: 'Ana' };
const burn = createGasSim('morro-leitao', () => 0);
const c = burn.list[8];
ok(burn.hurt(c, 20, 0, shooter) === 'hit' && c.phase === 0 && c.hp === 80, 'primeiro tiro só tira vida');
ok(burn.hurt(c, 20, 0.1, shooter) === 'hit' && c.hp === 60, 'dois tiros ainda não acendem');
ok(burn.hurt(c, 20, 0.2, shooter) === 'burn' && c.phase === 1 && c.hp === 40, 'no terceiro tiro (passou de 50%) pega fogo');
ok(c.explodeAt >= 2.2 && c.explodeAt <= 3.2, `pavio de ${c.explodeAt.toFixed(2)} s`);
const fuse = c.explodeAt;
ok(burn.hurt(c, 20, 0.3, shooter) === 'hit' && c.phase === 1 && c.explodeAt < fuse - 0.4, `continuar atirando encurta o pavio (${c.explodeAt.toFixed(2)} < ${fuse.toFixed(2)})`);
ok(burn.hurt(c, 20, 0.4, shooter) === 'boom', 'o tiro que zera a vida estoura na hora');

const chain = createGasSim('morro-leitao', () => 0.5);
chain.hurt(chain.list[8], 60, 1, shooter);
const boomed = [];
chain.step(chain.list[8].explodeAt + 0.01, {
  boom: (cyl, credit) => chain.detonate(cyl, chain.list[8].explodeAt, credit, (ev) => {
    boomed.push(ev.c.id);
    chain.splash(gasCenter(ev.c), GAS.blast, chain.list[8].explodeAt, ev.attacker, {
      boom: (n, who) => chain.detonate(n, chain.list[8].explodeAt, who, (e2) => boomed.push(e2.c.id)),
      sync() {},
    });
  }),
  sync() {},
});
ok(chain.list[8].phase === 2 && chain.list[9].phase === 2 && boomed.includes(9), `a explosão leva o vizinho (${boomed.join(',')})`);
ok(chain.list[6].phase === 0 && chain.list[0].phase === 0, 'o campinho e a rua oeste não entram nessa cadeia');
const back = chain.list[8].respawnAt - chain.list[8].explodeAt;
ok(back >= 30 && back <= 45, `respawn em ${back.toFixed(1)} s`);
const revived = [];
chain.step(chain.list[8].respawnAt + 0.05, { boom() {}, sync(cyl) { revived.push(cyl.id); } });
ok(revived.includes(8) && chain.list[8].phase === 0 && chain.list[8].hp === 100, 'o botijão volta inteiro');

const io = { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} };
let fake = 5000;
const g = new Game({ code: 'GAS', map: 'morro-leitao', max: 6, fillBots: true, mode: 'dm', botDiff: 'leitao' }, io);
g.now = () => fake;
const ana = g.join({ name: 'Ana' }).ent;
g.welcome(ana);
g.onMessage(ana.id, { t: 'start', map: 'morro-leitao' });
ok(g.gas && g.gas.list.length === sim0.list.length, 'a partida online cria os mesmos botijões');
ok(g.startMsg().gas.length === g.gas.list.length && g.startMsg().gas.every((row) => row[1] === 0), 'o snapshot inicial manda todo mundo inteiro');

const solo = g.gas.list[6];
g.hurtGas(solo, 100, ana);
ok(solo.phase === 2 && solo.hp === 0, 'um tiro que leva os 100% estoura na hora, sem esperar o pavio');
ok(g.gas.list[7].phase === 0, 'o outro flanco do campinho está longe demais pra cadeia');

const left = g.gas.list[8], right = g.gas.list[9];
const bot = [...g.ents.values()].find((e) => e.bot);
const bx = right.x + 1.35, bz = right.z;
bot.alive = true; bot.hp = 100; bot.invulnUntil = 0; bot.team = -1;
bot.pos = { x: bx, y: g.P.groundAt(bx, bz, right.y + 2), z: bz };
ana.alive = true; ana.hp = 100; ana.invulnUntil = 0; ana.team = -1;
const origin = { x: left.x - 3, y: left.y + left.h * 0.55, z: left.z };
const dir = { x: 1, y: 0, z: 0 };
g.events = [];
for (let i = 0; i < 3; i++) g.hitscan(ana, origin, [dir], 0);
ok(left.phase === 1 && left.hp === 40, `no servidor, 3 tiros de fuzil acendem (${left.hp}, fase ${left.phase})`);
ok(g.events.some((e) => e[0] === 'cy' && e[1] === left.id && e[2] === 1), 'o servidor avisa que pegou fogo');
const killsBefore = ana.kills;
g.T = left.explodeAt + 0.02;
g.events = [];
g.stepGas();
ok(left.phase === 2 && right.phase === 2, 'o pavio estoura e detona o vizinho');
ok(!bot.alive && bot.hp <= 0, `o bot colado no vizinho morre (${bot.hp})`);
const kill = g.events.find((e) => e[0] === 'k' && e[2] === bot.id);
ok(kill && kill[1] === ana.id && kill[7] === 4, `o abate é de quem acendeu, com ícone de explosão (${kill && kill.slice(0, 8).join(',')})`);
ok(ana.kills === killsBefore + 1, `o placar soma o abate (${ana.kills})`);
ok(g.events.some((e) => e[0] === 'bm' && e[2] === 'g'), 'a explosão reusa o efeito (bm) da granada/bazuca');
const waitL = left.respawnAt - g.T, waitR = right.respawnAt - g.T;
ok(waitL >= 29 && waitL <= 46 && waitR >= 29 && waitR <= 46, `respawn marcado em ${waitL.toFixed(0)} s e ${waitR.toFixed(0)} s`);
g.T = Math.max(left.respawnAt, right.respawnAt) + 0.05;
g.stepGas();
ok(left.phase === 0 && left.hp === 100 && right.phase === 0, 'os dois voltam inteiros');

const arena = new Game({ code: 'AR', map: 'arena', max: 4, fillBots: false, mode: 'dm' }, io);
arena.now = () => fake;
const jo = arena.join({ name: 'Jo' }).ent;
arena.welcome(jo);
arena.onMessage(jo.id, { t: 'start', map: 'arena' });
ok(arena.gas.list.length === 0, 'na Arena o servidor não inventa botijão');
ok(W_GAS === -4, 'o código do abate não colide com a faca nem com o botijão da Bomba');

if (fails.length) { console.log('FALHOU', fails.length); process.exit(1); }
console.log('tudo certo');

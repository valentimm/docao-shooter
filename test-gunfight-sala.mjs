// Gunfight no servidor autoritativo: times, uma arma, sem respawn no live, troca no round 3, overtime.
import { Game } from './server/src/game.js';
import { GF, sideForRound, spawnSide } from './shared/gunfight.js';
import { gfSpawns } from './shared/gunfight-maps.js';
import { getMap } from './maps.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const io = () => ({ send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });

function room(format, map, fillBots = true) {
  const g = new Game({ code: 'GFT', map, max: 8, fillBots, mode: 'gf', format, test: true }, io());
  let now = 1_000_000;
  g.now = () => now;
  const step = (sec) => { const n = Math.max(1, Math.round(sec / 0.05)); for (let i = 0; i < n; i++) { now += 0.05; g.tick(); } };
  const join = (name) => g.join({ name, skin: 'default', primary: 0, secondary: 1, melee: 7 }).ent;
  return { g, step, join };
}

const map = getMap('galpao-assalto');
const { g, step, join } = room(2, 'galpao-assalto', true);
const ana = join('Ana');
const beto = join('Beto');
g.onMessage(ana.id, { t: 'team', team: 0 });
g.onMessage(beto.id, { t: 'team', team: 0 });
g.startMatch('galpao-assalto');

ok(g.cfg.mode === 'gf' && g.cfg.max === 4 && g.gf && g.gf.format === '2v2', `sala 2v2 max 4 (${g.cfg.mode} ${g.cfg.max} ${g.gf && g.gf.format})`);
ok(g.gf.phase === 'prep' && g.gf.round === 1 && Math.abs(g.gf.timeLeft - GF.PREP) < 0.02, `prep ${g.gf.timeLeft}s round 1`);
const live = () => [...g.ents.values()].filter((e) => e.bot || e.connected);
ok(live().length === 4, `4 docões (${live().length})`);
ok(live().filter((e) => e.team === 0).length === 2 && live().filter((e) => e.team === 1).length === 2, 'dois de cada lado');
ok(live().every((e) => e.alive && e.hp === 100 && e.slots.length === 1 && e.slots[0] === g.gf.classId && e.nades === 0), 'vida 100, um slot, sem granada');
const side0 = gfSpawns(map, 0, sideForRound(1) === 1);
const born = live().filter((e) => e.team === 0).map((e) => [e.pos.x, e.pos.z]);
ok(born.every(([x, z]) => side0.some((p) => Math.hypot(p.x - x, p.z - z) < 0.2)), `vermelhos no lado A ${JSON.stringify(born)}`);
ok(spawnSide(1, 0) === 0 && spawnSide(1, 1) === 1, 'round 1: vermelho no lado 0');

step(GF.PREP + 0.15);
ok(g.gf.phase === 'live' && g.gf.timeLeft <= 40 && g.gf.timeLeft > 39, `2v2 ao vivo abre em 40 s (${g.gf.timeLeft.toFixed(2)})`);
const victim = live().find((e) => e.team === 1);
g.kill(victim, ana, ana.weapon, false);
ok(!victim.alive && victim.respawnAt === Infinity && g.gf.phase === 'live', 'uma morte no live não renasce e o round segue');
step(1.2);
ok(!victim.alive && g.gf.phase === 'live', 'depois de 1 s ainda sem respawn');
const hpBefore = ana.hp;
const foe = live().find((e) => e.team === 1 && e.alive);
g.damage(ana, 30, foe, foe.weapon, false);
const hurt = ana.hp;
step(3);
ok(hurt < hpBefore && ana.hp === hurt, `sem regen (${hpBefore} → ${hurt} → ${ana.hp})`);
ok(g.pickups.every((p) => !p.active), 'pickups desligados');

for (const e of live()) if (e.team === 1 && e.alive) g.kill(e, ana, ana.weapon, false);
ok(g.gf.phase === 'end' && g.gf.score[0] === 1 && g.gf.reason === 'elim', `eliminação dá o ponto (${g.gf.score})`);
step(GF.END + 0.2);
ok(g.gf.round === 2 && g.gf.phase === 'prep' && victim.alive && victim.hp === 100, `round 2 revive todo mundo (${g.gf.phase} hp ${victim.hp})`);

step(GF.PREP + 0.15);
for (const e of live()) if (e.team === 1 && e.alive) g.kill(e, ana, ana.weapon, false);
step(GF.END + 0.2);
ok(g.gf.round === 3 && sideForRound(3) === 1, `round 3 inverte o lado (${g.gf.round})`);
const sideB = gfSpawns(map, 0, true);
const born3 = live().filter((e) => e.team === 0 && e.alive).map((e) => [e.pos.x, e.pos.z]);
ok(born3.every(([x, z]) => sideB.some((p) => Math.hypot(p.x - x, p.z - z) < 0.2)), `round 3 vermelhos no lado B ${JSON.stringify(born3)}`);
ok(g.gf.classId !== undefined && live().every((e) => e.slots.length === 1 && e.slots[0] === g.gf.classId), 'classe única no round 3');

// overtime: esgota o live com os dois times de pé (invulneráveis só pra o relógio chegar sem abate)
while (g.gf.phase === 'prep' || g.gf.phase === 'end') step(0.2);
for (const e of live()) e.invulnUntil = 1e12;
const left = g.gf.timeLeft;
step(left + 0.3);
ok(g.gf.phase === 'ot' && g.gf.zone, `overtime com zona (${g.gf.phase} depois de ${left.toFixed(2)}s)`);
for (const e of live()) e.invulnUntil = 0;
ok(live().filter((e) => e.alive).length >= 2, 'overtime não matou ninguém sozinho');
const zone = g.gf.zone;
for (const e of live()) if (e.bot) { e.target = null; e.invulnUntil = 1e12; }
const startD = new Map(live().filter((e) => e.bot && e.alive).map((e) => [e.id, Math.hypot(e.pos.x - zone.x, e.pos.z - zone.z)]));
const best = new Map(startD);
for (let i = 0; i < 16; i++) {
  step(0.5);
  for (const id of startD.keys()) {
    const e = g.ents.get(id); if (!e || !e.alive) continue;
    const d = Math.hypot(e.pos.x - zone.x, e.pos.z - zone.z);
    if (d < best.get(id)) best.set(id, d);
  }
}
const closer = [...startD].filter(([id, d0]) => best.get(id) < d0 - 0.6 || best.get(id) < (zone.r || 4.5) + 2);
ok(closer.length >= 1 || g.gf.capProg > 0, `bots andam pra zona (${closer.length} chegaram mais perto, cap ${g.gf.capProg.toFixed(2)})`);
step(GF.OT);
ok(g.gf.phase !== 'ot', `overtime resolve (${g.gf.phase} ${g.gf.reason})`);

// 1v1 sem bots
const duo = room(1, 'x1-curral', false);
const a = duo.join('Ana');
const b = duo.join('Beto');
duo.g.onMessage(a.id, { t: 'team', team: 0 });
duo.g.onMessage(b.id, { t: 'team', team: 1 });
duo.g.startMatch('x1-curral');
ok(duo.g.cfg.max === 2 && [...duo.g.ents.values()].filter((e) => e.bot).length === 0, '1v1 sem bots');
ok(a.team === 0 && b.team === 1 && a.slots.length === 1 && b.slots.length === 1, '1v1 um contra um, uma arma');
duo.step(GF.PREP + 0.15);
duo.g.kill(b, a, a.weapon, false);
ok(duo.g.gf.score[0] === 1 && !b.alive && b.respawnAt === Infinity, '1v1 eliminação conta e não renasce');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

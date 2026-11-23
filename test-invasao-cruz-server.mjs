// Invasão no servidor (Room): dificuldade no cfg/snapshot, cruz revive com E (bk) e Hardcore sem Ressurreição.
// Uso: node test-invasao-cruz-server.mjs
import { Game } from './server/src/game.js';
import { parseState, INV_CROSS } from './shared/invasion.js';
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const io = { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} };

function room(cfg) {
  const g = new Game({ code: 'TCRZ', map: 'rodizio', max: 10, fillBots: false, mode: 'inv', ...cfg }, io);
  let fake = 1000; g.now = () => fake;
  const a = g.join({ name: 'Ana' }).ent; g.welcome(a); const b = g.join({ name: 'Beto' }).ent; g.welcome(b);
  a.connected = b.connected = true;
  g.onMessage(a.id, { t: 'start' });
  const step = (n = 1) => { for (let i = 0; i < n; i++) { fake += 0.05; g.tick(); } };
  step(3);
  return { g, a, b, step };
}

{
  const { g } = room({});
  ok(g.cfg.invDiff === 'normal', 'sala nova: Normal por padrão');
  g.state = 'lobby'; g.onMessage(g.hostId, { t: 'cfg', invDiff: 'hard' }); ok(g.cfg.invDiff === 'hard', 'anfitrião troca para Hardcore no lobby');
  g.onMessage([...g.ents.values()].find((e) => !e.bot && e.id !== g.hostId).id, { t: 'cfg', invDiff: 'normal' }); ok(g.cfg.invDiff === 'hard', 'quem não é anfitrião não troca');
}

{
  const { g, a, b, step } = room({ invDiff: 'normal' });
  for (const e of [a, b]) { e.invulnUntil = 0; e.spawnLock = 0; }
  ok(a.alive && b.alive && g.inv, 'partida da Invasão começou com os dois de pé');
  a.lives = 1; const at = { ...a.pos }; g.kill(a, null, 0, false);
  ok(!a.alive && a.out && a.respawnAt === Infinity && g.inv.crosses.length === 1, 'Ana sem vidas: fora e com cruz');
  const st = parseState(g.inv.stateArr());
  ok(st.hard === false && st.crosses[0].id === a.id, 'snapshot leva a cruz da Ana');
  b.pos = { x: at.x + 0.5, y: g.inv.crosses[0].y, z: at.z }; b.vel = { x: 0, y: 0, z: 0 };
  g.onUpdate(b, { p: [b.pos.x, b.pos.y, b.pos.z], y: 0, pi: 0, g: 1, w: b.weapon, bk: 1, sq: b.sq });
  ok(b.useHold, 'bk=1 vira useHold no servidor');
  for (let i = 0; i < Math.ceil((INV_CROSS.hold + 1) / 0.05); i++) { b.useHold = true; b.pos = { x: at.x + 0.5, y: g.inv.crosses.length ? g.inv.crosses[0].y : b.pos.y, z: at.z }; step(1); }
  ok(a.alive && !a.out && a.lives === 0, 'Beto segurou E 5 s: Ana voltou, sem vida extra');
  ok(a.hp === INV_CROSS.hp, `Ana volta com ${a.hp} de vida`);
  ok(Math.hypot(a.pos.x - at.x, a.pos.z - at.z) < 0.6, 'Ana levanta no lugar da cruz');
  ok(g.inv.crosses.length === 0, 'cruz some depois do revive');
}

{
  const { g, a, b } = room({ invDiff: 'hard' });
  a.lives = 1; g.kill(a, null, 0, false);
  ok(a.out && g.inv.crosses.length === 0, 'Hardcore: sem cruz');
  ok(parseState(g.inv.stateArr()).hard === true, 'Hardcore no snapshot');
  b.inv = ['revive']; g.onEvent(b, ['pw', 0, [b.pos.x, b.pos.y + 1.5, b.pos.z], [0, 0, 1]]);
  ok(!a.alive && a.out && !b.inv.length, 'Hardcore: servidor recusa a Ressurreição');
}

if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\nTudo certo');

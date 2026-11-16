// Escudo de nascimento (servidor): por INVULN s quem nasce não leva dano E não ataca (tiro, granada, faca...). Depois volta ao normal.
// Bots seguem a mesma regra. Modo deus dos testes (testGod / invulnUntil alto sem spawnLock) não trava o tiro.
// Uso: node test-escudo-nascer.mjs
import { Game } from './server/src/game.js';
import { INVULN, WEAPONS, KNIFE } from './shared/rules.js';
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const g = new Game({ code: 'TEST', map: 'arena', max: 8, fillBots: true, mode: 'dm' }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' });
a.connected = true;
const step = (n = 1) => { for (let i = 0; i < n; i++) { fake += 0.05; g.tick(); } };
step(2);
g.spawn ? g.spawn(a) : null;
if (!a.alive) step(20);
ok(a.alive && g.spawnShielded(a), `nasceu com escudo (T ${g.T.toFixed(2)}, até ${a.invulnUntil.toFixed(2)})`);
const eye = () => { const c = { x: a.pos.x, y: a.pos.y + 1.6, z: a.pos.z }; return [c.x, c.y, c.z]; };
const w = a.slots[0], mag0 = a.mag[w], rej0 = a.rejectedShots | 0;
g.onEvent(a, ['f', eye(), [[0, 0, -1]], w, g.now(), g.T, 0]);
ok(a.mag[w] === mag0 && (a.rejectedShots | 0) > rej0, `tiro recusado no escudo (pente ${mag0} → ${a.mag[w]})`);
const n0 = a.nades; g.onEvent(a, ['n', eye(), [0, 3, -8], 'c']);
ok(a.nades === n0 && !g.nades.some((x) => x.owner === a), `granada recusada no escudo (${n0} → ${a.nades})`);
const ml0 = g.events.filter((e) => e[0] === 'ml' && e[1] === a.id).length; g.onEvent(a, ['m', 0, eye(), [0, 0, -1], g.now(), g.T]);
ok(g.events.filter((e) => e[0] === 'ml' && e[1] === a.id).length === ml0, 'faca recusada no escudo');
const hp0 = a.hp; g.damage(a, 50, null, 0, false); ok(a.hp === hp0, 'continua sem levar dano no escudo');
// bots também não atiram no escudo
const bots = [...g.ents.values()].filter((e) => e.bot && e.alive);
for (const b of bots) { g.spawn(b); b.mag = WEAPONS.map((x) => x.mag); }
const bm = bots.map((b) => b.mag.slice()); const bn = bots.map((b) => b.nades);
let shot = false; for (let i = 0; i < Math.floor(INVULN / 0.05) - 2; i++) { step(1); for (const b of bots) if (b.target && g.spawnShielded(b) && (b.mag.some((m, k) => m < bm[bots.indexOf(b)][k]) || b.nades < bn[bots.indexOf(b)])) shot = true; }
ok(!shot, `bots no escudo não gastam munição/granada (${bots.length} bots)`);
// depois do escudo: volta a atacar
step(Math.ceil(INVULN / 0.05) + 4);
ok(!g.spawnShielded(a) && a.alive, 'escudo acabou');
const n1 = a.nades; g.onEvent(a, ['n', eye(), [0, 3, -8], 'c']);
ok(n1 <= 0 || a.nades === n1 - 1, `depois do escudo a granada sai (${n1} → ${a.nades})`);
// modo deus de teste não trava
a.invulnUntil = g.T + 999; ok(!g.spawnShielded(a), 'modo deus (sem spawnLock) não trava o ataque');
console.log(fails.length ? `${fails.length} FALHA(S)` : 'TUDO OK'); process.exit(fails.length ? 1 : 0);

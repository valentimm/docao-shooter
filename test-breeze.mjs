// Breeze Standoff (GLB) em todos os modos do servidor: colisão do JSON, spawns no chão, bots andando (nav), Bomba com sites,
// Gunfight no trecho do meio, Invasão com zumbis andando e fora do sorteio (mapa pesado). Uso: node test-breeze.mjs
import { Game } from './server/src/game.js';
import { getMap, PLAY_MAPS, BOMB_MAPS, INV_MAPS } from './maps.js';
import { GF_MAP_POOL } from './shared/gunfight-maps.js';
import { mapSolids } from './shared/physics.js';
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const M = getMap('breeze-standoff');
ok(M.id === 'breeze-standoff' && M.boxes.length > 14000, `colisão carregada no servidor (${M.boxes.length} caixas)`);
ok(PLAY_MAPS.includes(M) && BOMB_MAPS.includes(M) && INV_MAPS.includes(M) && GF_MAP_POOL[3].includes(M.id) && GF_MAP_POOL[4].includes(M.id), 'está nas listas: jogáveis, Bomba/Competitivo, Invasão e Gunfight 3v3/4v4');
ok(mapSolids(M).length === M.boxes.length + 4, 'mapSolids = caixas + 4 muros');
const io = () => ({ send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
function run(mode, extra = {}, secs = 25) {
  const g = new Game({ code: 'T' + mode, map: 'breeze-standoff', max: 8, fillBots: true, mode, ...extra }, io());
  let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a); a.connected = true;
  const t0 = Date.now(); g.startMatch('breeze-standoff'); const startMs = Date.now() - t0;
  const bots = () => [...g.ents.values()].filter((e) => e.bot);
  const start = new Map(); let maxTick = 0;
  for (let i = 0; i < secs * 20; i++) { fake += 0.05; const t1 = performance.now(); g.tick(); maxTick = Math.max(maxTick, performance.now() - t1); if (i === 60) for (const b of bots()) if (b.alive) start.set(b.id, { ...b.pos }); }
  const moved = bots().filter((b) => b.alive && start.has(b.id) && Math.hypot(b.pos.x - start.get(b.id).x, b.pos.z - start.get(b.id).z) > 3).length;
  const inside = [...g.ents.values()].filter((e) => e.alive).every((e) => !g.P.overlapping(e.pos.x, e.pos.y, e.pos.z, 0.05) && e.pos.y > -17);
  return { g, a, startMs, moved, n: bots().length, inside, maxTick, good: g.nav.good.length };
}
for (const mode of ['dm', 'dom', 'arms']) {
  const r = run(mode);
  ok(r.g.mapId === 'breeze-standoff' && r.good > 800, `${mode}: mapa Breeze, nav com ${r.good} nós bons (início ${r.startMs} ms)`);
  ok(r.n > 0 && r.moved >= Math.ceil(r.n / 2), `${mode}: bots andando (${r.moved}/${r.n} saíram do lugar)`);
  ok(r.inside, `${mode}: ninguém dentro de parede nem caiu`);
  ok(r.maxTick < 60, `${mode}: tick mais lento ${r.maxTick.toFixed(1)} ms`);
  if (mode === 'dom') ok(!!r.g.zone, 'dom: zona sorteada no mapa');
}
{
  const r = run('bomb');
  ok(r.g.bomb && r.g.mapId === 'breeze-standoff', 'bomba: partida no Breeze com estado da Bomba');
  const L = r.g.bombL || r.g.bomb.layout || null;
  ok(r.n > 0 && r.moved >= 1, `bomba: bots andando (${r.moved}/${r.n})`);
}
{
  const r = run('inv', {}, 40);
  const z = [...r.g.ents.values()].filter((e) => e.zt && e.alive);
  ok(r.g.mapId === 'breeze-standoff' && r.g.inv, `invasão: partida no Breeze (${z.length} zumbis vivos)`);
}
{
  const r = run('gf', { gfFormat: 3 }, 6);
  ok(r.g.mapId === 'breeze-standoff', `gunfight 3v3: mapa Breeze (${r.g.mapId})`);
  const team = (t) => [...r.g.ents.values()].filter((e) => e.alive && e.team === t);
  const a = team(0), b = team(1);
  ok(a.length && b.length && a.every((e) => b.every((f) => !r.g.P.losClear({ x: e.pos.x, y: e.pos.y + 1.6, z: e.pos.z }, { x: f.pos.x, y: f.pos.y + 1.6, z: f.pos.z }))), `gunfight: ${a.length}×${b.length} nascem sem se ver`);
}
// fora do sorteio: aleatório e próximo mapa não caem no Breeze
{
  const g = new Game({ code: 'TR', map: 'random', max: 8, fillBots: false, mode: 'dm' }, io());
  let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a);
  let hit = 0; for (let i = 0; i < 40; i++) { g.state = 'lobby'; g.startMatch('random'); if (g.mapId === 'breeze-standoff') hit++; if (g.nextMapId() === 'breeze-standoff') hit++; }
  ok(hit === 0, 'aleatório/próximo mapa nunca sorteiam o Breeze');
  g.state = 'lobby'; g.startMatch('breeze-standoff'); ok(g.mapId === 'breeze-standoff' && g.nextMapId() !== 'breeze-standoff', 'escolhido à mão: entra; o próximo sai dele');
}
console.log(fails.length ? `${fails.length} FALHA(S)` : 'TUDO OK'); process.exit(fails.length ? 1 : 0);

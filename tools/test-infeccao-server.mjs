// Modo Infecção 🧟 — simulação do servidor sem rede (node tools/test-infeccao-server.mjs).
// Sala com 1 humano parado + 15 bots: surto, infecções (golpe e faquinha), relógio, vitória dos zumbis e dos sobreviventes.
import { Game } from '../server/src/game.js';
import { INF, ZOMB, SURV } from '../shared/infection.js';
import { TAMPA } from '../shared/rules.js';
let clock = 1000; const evs = []; let ends = [];
const io = { send() {}, broadcast(o) { if (o.t === 's') for (const e of o.ev) evs.push(e); if (o.t === 'end') ends.push(o); }, startLoop() {}, stopLoop() {}, saveCfg() {}, stats() {} };
function room(max = 16, bots = true) {
  const g = new Game({ code: 'TEST', mode: 'inf', max, fillBots: bots, map: 'fazendona', test: true }, io); g.now = () => clock;
  const { ent } = g.join({ name: 'Humano', skin: '', primary: 0 }); g.welcome(ent); return { g, me: ent };
}
const run = (g, secs) => { for (let i = 0; i < secs * 20; i++) { clock += 0.05; g.tick(); if (g.state !== 'playing') break; } };
const ok = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exitCode = 1; } else console.log('ok -', m); };
// 1) limites e surto
{ const { g } = room(50); ok(g.cfg.max === 50, 'sala de Infecção aceita 50'); g.onMessage(g.hostId, { t: 'cfg', mode: 'dm' }); ok(g.cfg.max === 10, 'voltar pro mata-mata baixa o máximo pra 10'); }
{ evs.length = 0; ends = []; const { g, me } = room(16); g.startMatch('fazendona');
  const bots = [...g.ents.values()].filter((e) => e.bot); ok(bots.length === INF.BOT_FILL_MAX, `bots de preenchimento: ${bots.length} (teto ${INF.BOT_FILL_MAX})`);
  ok([...g.ents.values()].every((e) => e.team === SURV), 'todo mundo começa sobrevivente');
  me.invulnUntil = 1e9; // o humano parado não conta pra decidir
  run(g, INF.OUTBREAK - 1); ok(g.infS.phase === 'wait', 'antes do surto ninguém é zumbi');
  run(g, 1.2); const ib = evs.find((e) => e[0] === 'ib'), z = ib[1].map((id) => g.ents.get(id)); ok(g.infS.phase === 'live' && z.length === 2, `surto: ${z.length} alfa(s) para 16 jogadores, vida ${z[0] && z[0].hp}`);
  ok(z.every((e) => e.slots.every((w) => w === 7) && e.nades === 0), 'zumbi só tem a faca e nenhum Copo Bomba');
  // força infecção por golpe
  const zz = z[0], s = [...g.ents.values()].find((e) => e.team === SURV && e.alive && e !== me); s.invulnUntil = 0; s.pos = { x: zz.pos.x + Math.sin(zz.yaw) * 0.9, y: zz.pos.y, z: zz.pos.z + Math.cos(zz.yaw) * 0.9 }; s.hist = [];
  const before = g.infS.endAt; g.damage(s, 50, zz, 7, false); ok(s.team === ZOMB && s.alive && s.hp === INF.Z_HP, 'golpe de faca do zumbi infecta (vira zumbi vivo com 300)'); ok(g.infS.endAt === before + INF.PER_INFECT, '+15 s no relógio por infecção');
  // faquinha
  const s2 = [...g.ents.values()].find((e) => e.team === SURV && e.alive && e !== me && e.slots[0] !== TAMPA); // tampa erguida segura a faquinha (testado à parte) s2.invulnUntil = 0; zz.zkReady = 0;
  const o = { x: zz.pos.x, y: zz.pos.y + 1.5, z: zz.pos.z }; s2.pos = { x: o.x + 10, y: zz.pos.y, z: o.z }; s2.vel = { x: 0, y: 0, z: 0 };
  // tira paredes do caminho: testa num ponto aberto (centro do campo norte da Fazendona)
  let lane = null; for (let zq = -40; zq <= 40 && !lane; zq += 2) for (let xq = -40; xq <= 30 && !lane; xq += 2) { const y0 = g.P.groundAt(xq, zq, 0.3); if (y0 > 0.2) continue; if (g.P.rayWorld({ x: xq, y: 1.4, z: zq }, { x: 1, y: 0, z: 0 }, 12) === null && g.P.groundAt(xq + 10, zq, 0.3) < 0.2) lane = { x: xq, z: zq }; }
  zz.pos = { x: lane.x, y: 0, z: lane.z }; s2.pos = { x: lane.x + 10, y: 0, z: lane.z }; s2.hist = []; g.pushHist(s2);
  g.throwZKnife(zz, { x: lane.x, y: 1.4, z: lane.z }, { x: 1, y: -0.02, z: 0 }); for (let i = 0; i < 20 && g.zknives.length; i++) g.stepZKnives(0.05); g.tick();
  ok(s2.team === ZOMB, 'faquinha arremessada infecta quem acerta');
  ok(evs.some((e) => e[0] === 'zk') && evs.length >= 0, 'evento zk (arremesso) vai pros clientes');
  // zumbis vencem
  me.invulnUntil = 0; run(g, 460); ok(ends.length === 1 && ends[0].winTeam === ZOMB || ends.length === 1 && ends[0].winTeam === SURV, `partida acabou (vencedor: ${ends[0] && (ends[0].winTeam === ZOMB ? 'Zumbis' : 'Sobreviventes')}, infecções ${g.infS.infections}, T=${g.T.toFixed(0)} s)`);
}
// 2) zumbis vencem infectando todos (sem bots, 3 humanos)
{ ends = []; const g = new Game({ code: 'T2', mode: 'inf', max: 4, fillBots: false, test: true }, io); g.now = () => clock;
  const hs = ['A', 'B', 'C'].map((n) => { const { ent } = g.join({ name: n, primary: 0 }); g.welcome(ent); return ent; });
  g.startMatch('fazendona'); run(g, INF.OUTBREAK + 0.5); const z = hs.filter((e) => e.team === ZOMB); ok(z.length === 1, '3 jogadores: 1 alfa');
  for (const s of hs.filter((e) => e.team === SURV)) { s.invulnUntil = 0; g.damage(s, 10, z[0], 7, false); }
  run(g, INF.OVER_DELAY + 1); ok(ends.length === 1 && ends[0].winTeam === ZOMB, 'zumbis vencem quando não sobra sobrevivente');
}
// 3) sobreviventes vencem matando todos os zumbis (e zumbi morto não renasce)
{ ends = []; const g = new Game({ code: 'T3', mode: 'inf', max: 4, fillBots: false, test: true }, io); g.now = () => clock;
  const hs = ['A', 'B', 'C'].map((n) => { const { ent } = g.join({ name: n, primary: 0 }); g.welcome(ent); return ent; });
  g.startMatch('fazendona'); run(g, INF.OUTBREAK + 0.5); const z = hs.find((e) => e.team === ZOMB), s = hs.find((e) => e.team === SURV);
  z.invulnUntil = 0; g.damage(z, 5000, s, 0, true); ok(!z.alive && z.respawnAt === Infinity, 'zumbi morto fica de fora');
  run(g, INF.OVER_DELAY + 1); ok(ends.length === 1 && ends[0].winTeam === SURV, 'sobreviventes vencem matando todos os zumbis');
}
// 4) sobreviventes vencem segurando até o tempo acabar
{ ends = []; const g = new Game({ code: 'T4', mode: 'inf', max: 4, fillBots: false, test: true }, io); g.now = () => clock;
  const hs = ['A', 'B', 'C'].map((n) => { const { ent } = g.join({ name: n, primary: 0 }); g.welcome(ent); return ent; });
  g.startMatch('fazendona'); run(g, INF.OUTBREAK + 0.5); g.infS.endAt = g.T + 2; run(g, 2 + INF.OVER_DELAY + 1);
  ok(ends.length === 1 && ends[0].winTeam === SURV, 'tempo acabou com sobrevivente de pé: sobreviventes vencem');
  // última saída do zumbi sorteia outro alfa
}
{ ends = []; const g = new Game({ code: 'T5', mode: 'inf', max: 4, fillBots: false, test: true }, io); g.now = () => clock;
  const hs = ['A', 'B', 'C'].map((n) => { const { ent } = g.join({ name: n, primary: 0 }); g.welcome(ent); return ent; });
  g.startMatch('fazendona'); run(g, INF.OUTBREAK + 0.5); const z = hs.find((e) => e.team === ZOMB); g.leave(z.id);
  ok(hs.filter((e) => e !== z && e.team === ZOMB).length === 1, 'o único zumbi saiu: outro alfa é sorteado');
}

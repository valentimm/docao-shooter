// Sala cheia + refresh: o tiro tem que continuar dando dano.
// O cliente manda performance.now()/1000. Refresh, aba nova e um salto do Safari
// zeram esse relógio; a entidade no Durable Object guarda o valor antigo e recusa tudo.
// Uso: node test-dano-lobby.mjs
import { Game } from './server/src/game.js';
import { GF } from './shared/gunfight.js';
import { WEAPONS } from './shared/rules.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const io = () => ({ send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });

function room(mode, max, map, extra = {}) {
  let wall = 1_700_000_000;
  const g = new Game({ code: 'DANO', map, max, fillBots: false, mode, test: true, ...extra }, io());
  g.now = () => wall;
  const step = (sec) => { const n = Math.max(1, Math.round(sec / 0.05)); for (let i = 0; i < n; i++) { wall += 0.05; g.tick(); } };
  const join = (name) => g.join({ name, skin: 'default', primary: 0, secondary: 4, melee: 7 }).ent;
  return { g, step, join, wall: () => wall };
}

function aim(g, from, to) {
  const o = { x: from.pos.x, y: from.pos.y + 1.6, z: from.pos.z };
  const dx = to.pos.x - o.x, dy = (to.pos.y + 1.05) - o.y, dz = to.pos.z - o.z;
  const L = Math.hypot(dx, dy, dz) || 1;
  const d = { x: dx / L, y: dy / L, z: dz / L };
  const hit = g.P.rayWorld(o, d, 80);
  return { o: [o.x, o.y, o.z], d: [d.x, d.y, d.z], clear: hit == null || hit > L - 0.25, dist: L };
}

// Encosta a vítima numa linha livre, a `dist` metros do atirador.
function park(g, victim, shooter, dist = 6) {
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    const x = shooter.pos.x + Math.sin(ang) * dist, z = shooter.pos.z + Math.cos(ang) * dist;
    const y = g.P.groundAt(x, z, shooter.pos.y + 3);
    if (!Number.isFinite(y) || Math.abs(y - shooter.pos.y) > 1.2) continue;
    victim.pos = { x, y, z }; victim.vel = { x: 0, y: 0, z: 0 }; victim.alive = true; victim.hp = 100; victim.invulnUntil = 0;
    const a = aim(g, shooter, victim);
    if (a.clear && a.dist > 1) return a;
  }
  return null;
}

function fire(g, e, victim, w, ct) {
  const parked = [];
  for (const o of g.ents.values()) if (o !== e && o !== victim) { parked.push([o, o.pos.x, o.pos.y, o.pos.z]); o.pos = { x: o.pos.x + 400, y: -20, z: o.pos.z }; }
  const a = park(g, victim, e, w === 7 ? 1.1 : 6);
  const rejOf = (x) => (x.rejectedShots || 0) + (x.rejectedMelee || 0);
  if (!a) { for (const [o, x, y, z] of parked) o.pos = { x, y, z }; return { hurt: false, why: 'sem linha', hp: victim.hp, rej: 0 }; }
  const hp0 = victim.hp, rej0 = rejOf(e);
  if (w === 7) { e.weapon = 7; g.onEvent(e, ['m', 0, a.o, a.d, +ct.toFixed(3), g.T]); }
  else g.onEvent(e, ['f', a.o, [a.d], w, +ct.toFixed(3), g.T]);
  for (const [o, x, y, z] of parked) o.pos = { x, y, z };
  return { hurt: victim.hp < hp0, hp: victim.hp, hp0, rej: rejOf(e) - rej0, why: '' };
}

// ---------- mata-mata, 12 humanos (cobre 8, 9, 10 e 12) ----------
{
  const { g, step, join } = room('dm', 12, 'arena');
  const names = ['Ana', 'Beto', 'Caio', 'Duda', 'Eva', 'Fe', 'Gabi', 'Hugo', 'Ivo', 'Joao', 'Kim', 'Lia'];
  const ents = names.map(join);
  g.startMatch('arena');
  step(2.4); // escudo de nascimento
  const sponge = ents[ents.length - 1];
  let page = 90; // performance.now() de uma aba já aberta há um minuto e meio
  for (let i = 0; i < ents.length - 1; i++) {
    sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0;
    const r = fire(g, ents[i], sponge, 0, page);
    ok(r.hurt, `${ents.length} humanos: ${ents[i].name} dá dano no fuzil (vida ${r.hp0} → ${r.hp}, recusas ${r.rej}${r.why ? ', ' + r.why : ''})`);
    page += 0.2; step(0.2);
  }
  const ana = ents[0];
  // pistola também, pra encher o outro slot do relógio
  sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0;
  const pis = fire(g, ana, sponge, 4, page);
  ok(pis.hurt, `Ana acerta de pistola antes do refresh (vida ${pis.hp0} → ${pis.hp})`);
  page += 0.3; step(0.3);
  sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0; ana.weapon = 7;
  const faca = fire(g, ana, sponge, 7, page);
  ok(faca.hurt, `Ana acerta de faca antes do refresh (vida ${faca.hp0} → ${faca.hp}, recusas ${faca.rej})`);

  // Safari: performance.now() volta atrás na mesma aba, sem cair a conexão.
  const jumped = 0.4;
  step(0.3);
  sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0;
  const back = fire(g, ana, sponge, 0, jumped);
  ok(back.hurt && ana.alive, `salto do relógio pra trás na mesma vida: fuzil ainda dá dano (vida ${back.hp0} → ${back.hp}, recusas ${back.rej}, lastCt ${ana.lastCt && ana.lastCt[0]})`);

  // Refresh / aba anônima com a mesma conta: mesmo id, performance.now() começa de novo.
  const token = ana.token, id = ana.id;
  const poisoned = ana.lastCt && ana.lastCt[0];
  g.leave(id);
  const again = g.join({ name: 'Ana', skin: 'default', primary: 0, secondary: 4, melee: 7, token }).ent;
  ok(again.id === id && again.token === token, `refresh reaproveita o mesmo id (${again.id})`);
  g.welcome(again);
  step(3);
  ok(again.alive, 'depois do refresh a Ana renasce');
  sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0;
  const fresh = 0.35; // aba nova: performance.now() ~ 0
  const r1 = fire(g, again, sponge, 0, fresh);
  ok(r1.hurt, `refresh: fuzil dá dano de novo (relógio novo ${fresh}, lastCt antigo ${poisoned}, vida ${r1.hp0} → ${r1.hp}, recusas ${r1.rej})`);
  step(0.25);
  sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0;
  const r2 = fire(g, again, sponge, 4, fresh + 0.25);
  ok(r2.hurt, `refresh: pistola dá dano (vida ${r2.hp0} → ${r2.hp}, recusas ${r2.rej})`);
  step(0.5);
  sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0;
  const r3 = fire(g, again, sponge, 7, fresh + 0.8);
  ok(r3.hurt, `refresh: faca dá dano (vida ${r3.hp0} → ${r3.hp}, recusas ${r3.rej})`);

  // quem não deu refresh continua acertando
  const beto = ents[1];
  sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0;
  const betoCt = ((beto.lastCt && beto.lastCt[0]) || page) + 0.3;
  step(0.3);
  sponge.hp = 100; sponge.alive = true; sponge.invulnUntil = 0;
  const still = fire(g, beto, sponge, 0, betoCt);
  ok(still.hurt, `Beto, que não recarregou a página, continua dando dano (vida ${still.hp0} → ${still.hp}, ct ${betoCt}, recusas ${still.rej}${still.why ? ', ' + still.why : ''})`);
}

// ---------- Gunfight 4v4 (8 humanos), refresh no round 1, dano no round 2 ----------
{
  const { g, step, join } = room('gf', 8, 'arena', { format: 4 });
  const names = ['Ana', 'Beto', 'Caio', 'Duda', 'Eva', 'Fe', 'Gabi', 'Hugo'];
  const ents = names.map(join);
  g.startMatch('arena');
  ok(g.gf && g.cfg.max === 8 && ents.length === 8, `gunfight 4v4 com 8 humanos (max ${g.cfg.max}, round ${g.gf && g.gf.round})`);
  const counts = [0, 0];
  for (const e of ents) if (e.team === 0 || e.team === 1) counts[e.team]++;
  ok(counts[0] === 4 && counts[1] === 4, `times 4 a 4 (${counts})`);
  g.gf.classId = 1; // Calibre 12, hitscan estável
  for (const e of ents) g.spawn(e);
  step(GF.PREP + 0.2);
  ok(g.gf.phase === 'live', `round 1 ao vivo (${g.gf.phase})`);
  const ana = ents[0];
  const foe = ents.find((e) => e.team !== ana.team && e.alive);
  let page = 200;
  foe.hp = 100; foe.invulnUntil = 0;
  const live = fire(g, ana, foe, 1, page);
  ok(live.hurt, `round 1: Ana dá dano com 8 na sala (vida ${live.hp0} → ${live.hp}, arma ${ana.slots && ana.slots[0]})`);
  // os outros 7 também, um tiro cada
  for (const e of ents) {
    if (e === ana) continue;
    const t = ents.find((x) => x !== e && x.team !== e.team);
    if (!t) continue;
    t.hp = 100; t.alive = true; t.invulnUntil = 0;
    page += 0.3;
    const r = fire(g, e, t, 1, page);
    ok(r.hurt, `round 1: ${e.name} dá dano (${r.hp0} → ${r.hp}, recusas ${r.rej}, vivo ${e.alive}, alvo ${t.name} t${t.team}${r.why ? ', ' + r.why : ''})`);
  }
  const token = ana.token, id = ana.id, oldCt = ana.lastCt && ana.lastCt[1];
  g.leave(id);
  const again = g.join({ name: 'Ana', skin: 'default', primary: 0, secondary: 4, melee: 7, token }).ent;
  ok(again.id === id, 'gunfight: refresh fica no mesmo id');
  g.welcome(again);
  ok(!again.alive, 'no meio do round o refresh não renasce na hora');
  const enemies = ents.filter((e) => e !== ana && e.team !== ana.team);
  for (const e of enemies) if (e.alive) g.kill(e, ents.find((x) => x.team === ana.team && x !== ana) || ana, 1, false);
  ok(g.gf.phase === 'end' || g.gf.round >= 1, `round fechou (${g.gf.phase} placar ${g.gf.score})`);
  step(GF.END + GF.PREP + 0.4);
  ok(g.gf.round === 2 && g.gf.phase === 'live' && again.alive, `round 2 ao vivo e Ana viva (${g.gf.round} ${g.gf.phase} alive=${again.alive})`);
  const foe2 = ents.find((e) => e !== again && e.team !== again.team && e.alive);
  ok(!!foe2, 'ainda tem adversário vivo no round 2');
  if (foe2) {
    foe2.hp = 100; foe2.invulnUntil = 0;
    const r = fire(g, again, foe2, again.slots[0], 1.2);
    ok(r.hurt, `round 2 depois do refresh: dano volta (lastCt antigo ${oldCt}, vida ${r.hp0} → ${r.hp}, recusas ${r.rej}, arma ${again.slots[0]})`);
  }
}

// ---------- speed hack continua recusado ----------
{
  const { g, step, join, wall } = room('dm', 2, 'arena');
  const a = join('Ana'), b = join('Beto');
  g.startMatch('arena');
  step(2.4);
  let ct = wall() - 1_699_999_000; // ~1000 s de aba, offset estável
  // alinha: um tiro aceito
  b.hp = 100; b.invulnUntil = 0;
  fire(g, a, b, 0, ct);
  const rej0 = a.rejectedShots || 0;
  for (let i = 0; i < 40; i++) { ct += 0.05; step(0.02); b.hp = 100; b.alive = true; b.invulnUntil = 0; fire(g, a, b, 0, ct); }
  ok((a.rejectedShots || 0) > rej0, `relógio 2,5× mais rápido continua recusado (${(a.rejectedShots || 0) - rej0} recusas)`);
}

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

// Bots do Gunfight atiram e machucam um jogador.
// O pool (shared/gunfight-maps.js) não tem mapa chamado "disco voador".
// A classe Disco Voador (arma, range 0) é que parecia muda em qualquer mapa:
// o bot mandava hitscan e a bala morria na boca, sem soltar o disco.
// Aqui: Disco Voador dá dano no Breeze, no Galpão e no Curral; a escopeta também, nos mesmos mapas.
import { Game } from './server/src/game.js';
import { WEAPONS } from './shared/rules.js';
import { GF } from './shared/gunfight.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

function fight(map, format, key, sec = 8) {
  const ev = [];
  const io = {
    send() {},
    broadcast(m) { if (m && m.t === 's' && m.ev) ev.push(...m.ev); },
    startLoop() {}, stopLoop() {},
  };
  const g = new Game({ code: 'BOT' + map.slice(0, 6), map, max: 8, fillBots: true, mode: 'gf', format, test: true }, io);
  let now = 5_000_000;
  g.now = () => now;
  const step = (s) => { for (let i = 0; i < Math.round(s / 0.05); i++) { now += 0.05; g.tick(); } };
  const ana = g.join({ name: 'Ana' }).ent;
  g.welcome(ana); ana.connected = true;
  g.onMessage(ana.id, { t: 'team', team: 0 });
  g.startMatch(map);
  const id = WEAPONS.findIndex((w) => w && w.key === key);
  g.gf.classId = id;
  for (const e of g.ents.values()) {
    e.slots = [id]; e.weapon = id; e.primary = id;
    e.mag[id] = Math.max(WEAPONS[id].mag, 1);
    e.reserve[id] = Math.max(WEAPONS[id].reserve, WEAPONS[id].mag, 1);
  }
  step(GF.PREP + 0.2);
  const foes = () => [...g.ents.values()].filter((e) => e.bot && e.alive && e.team !== ana.team);
  // Fica na frente de um bot inimigo, com linha de visão. O mapa não esconde o jogador.
  const park = () => {
    const list = foes().sort((a, b) => a.id - b.id);
    const foe = list[0];
    if (!foe) return false;
    const eye = { x: foe.pos.x, y: foe.pos.y + 1.6, z: foe.pos.z };
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const x = foe.pos.x + Math.cos(a) * 4.2, z = foe.pos.z + Math.sin(a) * 4.2;
      const y = g.P.groundAt(x, z, foe.pos.y + 1);
      if (Math.abs(y - foe.pos.y) > 1.1 || g.P.collides(x, y, z)) continue;
      if (!g.P.losClear(eye, { x, y: y + 1.1, z })) continue;
      ana.pos = { x, y, z }; ana.vel = { x: 0, y: 0, z: 0 };
      ana.invulnUntil = 0; foe.invulnUntil = 0; foe.spawnLock = 0;
      return true;
    }
    return false;
  };
  let dmg = 0, discs = 0, shots = 0, seen = 0;
  const ticks = Math.round(sec / 0.05);
  for (let i = 0; i < ticks; i++) {
    if (park()) seen++;
    ana.alive = true; ana.hp = 100;
    ev.length = 0;
    now += 0.05; g.tick();
    for (const e of ev) {
      if (e[0] === 'h' && e[1] === ana.id && e[2] && e[2] !== ana.id) dmg += e[5] || 0;
      if (e[0] === 'dl' && e[2] !== ana.id) discs++;
      if (e[0] === 'sh' && e[1] !== ana.id) shots++;
    }
  }
  return { dmg, discs, shots, seen };
}

const maps = [
  ['breeze-standoff', 4],
  ['galpao-assalto', 2],
  ['x1-curral', 2],
];
for (const [map, format] of maps) {
  const disc = fight(map, format, 'disco', 7);
  ok(disc.discs > 0 && disc.dmg > 0, `${map}: bot de Disco Voador solta disco e machuca (${disc.discs} discos, ${disc.dmg} de dano)`);
  const gun = fight(map, format, 'shotgun', 6);
  ok(gun.shots > 0 && gun.dmg > 0, `${map}: bot de escopeta atira e machuca (${gun.shots} tiros, ${gun.dmg} de dano)`);
}

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

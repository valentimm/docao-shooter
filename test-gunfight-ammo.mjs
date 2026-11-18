// Gunfight: a reserva não acaba. O pente recarrega no tempo normal.
// Mata-mata: reserva 0 não enche o pente.
import { Game } from './server/src/game.js';
import { PISTOL, WEAPONS } from './shared/rules.js';
import { GF } from './shared/gunfight.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const io = () => ({ send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });

function boot(mode, fillBots = false) {
  const g = new Game({ code: 'AM' + mode, map: 'x1-curral', max: fillBots ? 4 : 2, fillBots, mode, format: fillBots ? 2 : 1, test: true }, io());
  let now = 8_000_000;
  g.now = () => now;
  const step = (s) => { for (let i = 0; i < Math.round(s / 0.05); i++) { now += 0.05; g.tick(); } };
  const a = g.join({ name: 'Ana' }).ent;
  g.welcome(a); a.connected = true;
  g.onMessage(a.id, { t: 'team', team: 0 });
  g.onMessage(a.id, { t: 'start' });
  if (g.gf) step(GF.PREP + 0.2);
  else step(0.2);
  if (g.gf) for (const e of g.ents.values()) e.invulnUntil = 1e12; // a rodada não acaba no meio da recarga
  return { g, a, step };
}

function arm(a, w, mag, reserve) {
  a.alive = true; a.slots = [w]; a.weapon = w; a.mag[w] = mag; a.reserve[w] = reserve; a.reload = null; a.invulnUntil = 1e12; a.spawnLock = 0;
}

{
  const { g, a, step } = boot('gf', true);
  const W = WEAPONS[PISTOL];
  arm(a, PISTOL, 0, 2);
  g.onEvent(a, ['rl', PISTOL]);
  step(W.reload + 0.2);
  ok(a.mag[PISTOL] === W.mag && a.reserve[PISTOL] === 2, `Gunfight: pente cheio sem gastar a reserva (${a.mag[PISTOL]}/${a.reserve[PISTOL]}, arma ${W.mag}/${W.reserve})`);
  a.mag[PISTOL] = 0; a.reload = null;
  g.onEvent(a, ['rl', PISTOL]);
  step(W.reload + 0.2);
  ok(a.mag[PISTOL] === W.mag && a.reserve[PISTOL] === 2, `Gunfight: segunda recarga ainda além da reserva original (${a.mag[PISTOL]}/${a.reserve[PISTOL]})`);
  const shot = WEAPONS.find((w) => w && w.key === 'shotgun');
  const sw = WEAPONS.indexOf(shot);
  arm(a, sw, 0, 0);
  g.onEvent(a, ['rl', sw]);
  step((shot.reloadStart + shot.reload * shot.mag) + 0.4);
  ok(!a.reload && a.mag[sw] === shot.mag && a.reserve[sw] === 0, `Gunfight: Calibre 12 enche o pente com reserva 0 (${a.mag[sw]}/${a.reserve[sw]})`);
  const b = [...g.ents.values()].find((e) => e.bot) || null;
  if (b) {
    b.alive = true; b.slots = [PISTOL]; b.weapon = PISTOL; b.mag[PISTOL] = 0; b.reserve[PISTOL] = 0; b.reloadEnd = g.T; b.invulnUntil = 1e12;
    step(0.1);
    ok(b.mag[PISTOL] === W.mag, `Gunfight: bot recarrega com reserva 0 (${b.mag[PISTOL]})`);
  } else ok(true, 'sala 1v1 sem bot: o recarregamento do bot já enche o pente sem olhar a reserva');
}

{
  const { g, a, step } = boot('dm');
  const W = WEAPONS[PISTOL];
  arm(a, PISTOL, 0, 2);
  g.onEvent(a, ['rl', PISTOL]);
  step(W.reload + 0.2);
  ok(a.mag[PISTOL] === 2 && a.reserve[PISTOL] === 0, `Mata-mata: a reserva acaba (${a.mag[PISTOL]}/${a.reserve[PISTOL]})`);
  a.reload = null;
  g.onEvent(a, ['rl', PISTOL]);
  step(W.reload + 0.2);
  ok(a.mag[PISTOL] === 2 && a.reserve[PISTOL] === 0 && !a.reload, `Mata-mata: sem reserva não recarrega de novo (mag ${a.mag[PISTOL]})`);
}

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

// Revólver do Capataz (23) e Dois Capatazes (24): dano, falloff, cadência por mão e recarga dos dois tambores.
// Uso: node test-revolver.mjs
import { Game } from './server/src/game.js';
import { WEAPONS, SECONDARIES, CATEGORIES, BOT_RANGE, PISTOL, REV, REV2 } from './shared/rules.js';
import { damageAt, shotsToKill, ttk, rounds, resetDrums, setDrum, pickBotSecondary, rollFumble, drumsFull } from './shared/revolver.js';
import { killIcon } from './killfeed-icons.js';
import { inspectKind } from './inspect.js';
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

const S = WEAPONS[REV], D = WEAPONS[REV2];
ok(REV === 23 && REV2 === 24 && S.key === 'capataz' && D.key === 'capataz2' && WEAPONS.length === 28 && WEAPONS[25].key === 'tampa' && WEAPONS[26].key === 'faca-dourada' && WEAPONS[27].key === 'ray' && WEAPONS.every(Boolean), `índices 23/24 sem buraco, tampa no 25, faca dourada no 26, ray no 27 (${WEAPONS.length})`);
ok(SECONDARIES.includes(REV) && SECONDARIES.includes(REV2) && !SECONDARIES.includes(0), 'os dois entram na secundária e não na primária');
ok(CATEGORIES.some((c) => c.id === 'secundaria' && c.weapons.includes(REV) && c.weapons.includes(REV2)), 'categoria Secundária lista os dois');
ok(BOT_RANGE.length === WEAPONS.length && BOT_RANGE[REV] === 10 && BOT_RANGE[REV2] === 6, 'BOT_RANGE cobre o revólver (10 m) e o akimbo (6 m)');
ok(S.dmg === 58 && S.headMul === 2 && S.rate === 0.4 && S.mag === 6 && S.reload === 2.45 && S.revolver && !S.akimbo && !S.noAds, `single: 58 / cabeça ×2 / 0,4 s / 6 / recarga ${S.reload}`);
ok(D.dmg === 58 && D.rate === 0.4 && D.akimbo && D.noAds && D.move === 0.92 && D.reload === 3.6 && D.spread > S.spread, `akimbo: mesma bala, sem mira, anda ${D.move}, recarga ${D.reload}, spread ${D.spread}`);
ok(Math.round(60 / S.rate) === 150, `150 RPM (${(60 / S.rate).toFixed(0)})`);

const body = (w, dist) => shotsToKill(damageAt(w, dist, false));
const head = (w, dist) => shotsToKill(damageAt(w, dist, true));
ok(body(S, 0) === 2 && head(S, 0) === 1 && ttk(damageAt(S, 0), S.rate) === 0.4, `perto: 2 no corpo (TTK 0,40 s) e 1 na cabeça`);
ok(body(S, 8) === 2 && head(S, 8) === 1, 'até 8 m o dano ainda é cheio');
ok(body(S, 22) === 3 && head(S, 22) === 2, `22 m: ${body(S, 22)} no corpo, ${head(S, 22)} na cabeça`);
ok(body(S, 34) === 4 && head(S, 34) === 2 && damageAt(S, 40) === damageAt(S, 34), `34 m+: ×0,45 → ${body(S, 34)} no corpo, ${head(S, 34)} na cabeça`);
ok(body(WEAPONS[PISTOL], 0) === 4 && ttk(WEAPONS[PISTOL].dmg, WEAPONS[PISTOL].rate) === 0.48, 'pistola continua 4 no corpo, TTK 0,48 s');
ok(inspectKind(S) === 'revolver' && inspectKind(D) === 'revolver' && killIcon('capataz') !== killIcon('pistol') && killIcon('capataz2') !== killIcon('capataz'), 'inspeção e ícones próprios');
ok(rollFumble(() => 0) === true && rollFumble(() => 0.5) === false, 'tropeço no saque só com o dado baixo');
{
  let pistol = 0, single = 0, dual = 0;
  for (let i = 0; i < 900; i++) { const p = pickBotSecondary(null, () => i / 900); if (p === PISTOL) pistol++; else if (p === REV) single++; else if (p === REV2) dual++; }
  ok(pistol > single && single > dual && pistol + single + dual === 900, `bots: pistola ${pistol}, revólver ${single}, akimbo ${dual}`);
  ok(pickBotSecondary([PISTOL]) === PISTOL, 'sala sem o revólver: o bot fica na pistola');
}

const mk = () => {
  const g = new Game({ code: 'TEST', map: 'arena', max: 8, fillBots: true, mode: 'dm' }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' }); a.connected = true;
  const step = (n = 1, d = 0.05) => { for (let i = 0; i < n; i++) { fake += d; a.vel = { x: 0, y: 0, z: 0 }; if (a.alive) a.hp = 100; g.tick(); } };
  step(5); return { g, a, step };
};
function arm(a, w) {
  a.alive = true; a.hp = 100; a.invulnUntil = 0; a.slots = [0, w, 7]; a.secondary = w; a.weapon = w;
  a.mag[w] = WEAPONS[w].mag; a.reserve[w] = WEAPONS[w].reserve; resetDrums(a); a.reload = null;
}
{
  const { g, a, step } = mk();
  arm(a, REV);
  const eye = [a.pos.x, a.pos.y + 1.6, a.pos.z];
  const ct = +g.T.toFixed(3);
  const r0 = a.rejectedShots || 0;
  g.onEvent(a, ['f', eye, [[0, 0, 1]], REV, ct, g.T]);
  ok(a.mag[REV] === 5 && (a.rejectedShots || 0) === r0, `servidor: tiro do Capataz aceito (tambor ${a.mag[REV]})`);
  g.onEvent(a, ['f', eye, [[0, 0, 1]], REV, ct + 0.05, g.T]);
  ok(a.mag[REV] === 5 && (a.rejectedShots || 0) > r0, `servidor: segundo tiro antes de 0,4 s recusado (tambor ${a.mag[REV]})`);
  step(10, 0.05);
  const ct2 = +g.T.toFixed(3);
  g.onEvent(a, ['f', eye, [[0, 0, 1]], REV, ct2, g.T]);
  ok(a.mag[REV] === 4, `servidor: depois da cadência o tiro entra (tambor ${a.mag[REV]})`);
  arm(a, PISTOL);
  const pm = a.mag[PISTOL];
  g.onEvent(a, ['f', eye, [[0, 0, 1]], PISTOL, +g.T.toFixed(3), g.T]);
  ok(a.mag[PISTOL] === pm - 1, `servidor: pistola continua atirando (pente ${a.mag[PISTOL]})`);
}
{
  const { g, a, step } = mk();
  arm(a, REV2);
  const eye = [a.pos.x, a.pos.y + 1.6, a.pos.z];
  const ct = +g.T.toFixed(3);
  g.onEvent(a, ['f', eye, [[0, 0, 1]], REV2, ct, g.T, 0]);
  g.onEvent(a, ['f', eye, [[0, 0, 1]], REV2, ct + 0.01, g.T, 1]);
  ok(a.mag[REV2] === 5 && rounds(a, REV2, 1) === 5, `servidor: as duas mãos atiram no mesmo instante (${a.mag[REV2]}·${rounds(a, REV2, 1)})`);
  const rej = a.rejectedShots || 0;
  g.onEvent(a, ['f', eye, [[0, 0, 1]], REV2, ct + 0.05, g.T, 0]);
  g.onEvent(a, ['f', eye, [[0, 0, 1]], REV2, ct + 0.06, g.T, 1]);
  ok(a.mag[REV2] === 5 && rounds(a, REV2, 1) === 5 && (a.rejectedShots || 0) > rej, 'servidor: a mesma mão não fura a cadência');
  g.onEvent(a, ['f', eye, [[0, 0, 1]], REV2, ct + 0.5, g.T, 2]);
  ok(a.mag[REV2] === 5 && rounds(a, REV2, 1) === 5, 'servidor: mão que não é 0 nem 1 é recusada');
  a.mag[REV2] = 2; setDrum(a, REV2, 1); a.reserve[REV2] = 36; a.reload = null; a.invulnUntil = 1e9;
  g.onEvent(a, ['rl', REV2]);
  ok(!!a.reload, 'servidor: recarrega com um tambor ainda pela metade');
  step(70, 0.05);
  ok(a.mag[REV2] === 6 && rounds(a, REV2, 1) === 6 && a.reserve[REV2] === 27 && !a.reload, `servidor: os dois tambores enchem e a reserva desce (${a.mag[REV2]}·${rounds(a, REV2, 1)} / ${a.reserve[REV2]})`);
  arm(a, REV2);
  g.onEvent(a, ['rl', REV2]);
  ok(!a.reload && drumsFull(a, REV2), 'servidor: tambor cheio não começa recarga');
}
{
  const { g, a, step } = mk();
  const bot = [...g.ents.values()].find((e) => e.bot);
  bot.alive = true; bot.stunUntil = 0; bot.slots = [0, REV, 7]; bot.weapon = REV; bot.mag[REV] = 6; bot.reserve[REV] = 30; bot.nextFire = 0; bot.reloadEnd = 0;
  a.invulnUntil = 1e9;
  g.botShoot(bot, a, 5);
  ok(bot.mag[REV] === 5, `servidor: bot com o Capataz gasta uma bala (${bot.mag[REV]})`);
  bot.slots[1] = REV2; bot.weapon = REV2; bot.mag[REV2] = 6; bot.reserve[REV2] = 36; resetDrums(bot); bot.handAt = [-9, -9]; bot.handLast = -1; bot.nextFire = 0; bot.reloadEnd = 0;
  g.botShoot(bot, a, 4);
  // avança o relógio sem o tick: o bot vivo troca de arma sozinho se a simulação rodar
  g.T = bot.nextFire; bot.nextFire = 0; bot.reloadEnd = 0; bot.weapon = REV2;
  g.botShoot(bot, a, 4);
  const left = rounds(bot, REV2, 1);
  ok(bot.mag[REV2] + left === 10, `servidor: bot akimbo alterna as mãos (${bot.mag[REV2]}·${left})`);
}

console.log(fails.length ? 'FALHOU ' + fails.length : 'TUDO OK');
process.exit(fails.length ? 1 : 0);

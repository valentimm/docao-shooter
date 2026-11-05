// Metralhadora do Chiqueiro (21): regras, servidor (atira, bot usa) e troca na pausa ('px': 1 a cada 10 s, nunca mata na Invasão).
// Uso: node test-lmg.mjs   (só Node: sem navegador)
import { Game } from './server/src/game.js';
import { WEAPONS, PRIMARIES, BOT_PRIMARIES, CATEGORIES, BOT_RANGE, LMG, MINIGUN, isMiniCode } from './shared/rules.js';
import { killIcon, weaponSvg } from './killfeed-icons.js';
import { inspectKind } from './inspect.js';
import { traceShot } from './shared/penetration.js';
import { createPhysics } from './shared/physics.js';
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
// ---- regras ----
const W = WEAPONS[21];
ok(LMG === 21 && W && W.key === 'lmg' && WEAPONS.length === 28 && WEAPONS[22] && WEAPONS[22].key === 'commando' && WEAPONS[23] && WEAPONS[23].key === 'capataz' && WEAPONS[24] && WEAPONS[24].key === 'capataz2' && WEAPONS[25] && WEAPONS[25].key === 'tampa' && WEAPONS[26] && WEAPONS[26].key === 'faca-dourada' && WEAPONS[27] && WEAPONS[27].key === 'ray' && !PRIMARIES.includes(27) && WEAPONS.every(Boolean), `WEAPONS[21] = lmg, [22] = commando, [23] = capataz, [24] = capataz2, [25] = tampa, [26] = faca dourada, [27] = ray fora do arsenal, sem buraco (${WEAPONS.length})`);
ok(W.mag === 100 && W.reserve === 300 && W.dmg === 15 && W.rate === 0.08 && W.auto === true && W.move === 0.95, `números: fita 100/300, 15 de dano, 0,08 s, anda 95% (${W.mag}/${W.reserve}, ${W.dmg}, ${W.rate}, ${W.move})`);
ok(Math.ceil(100 / W.dmg) === 7 && Math.abs((Math.ceil(100 / W.dmg) - 1) * W.rate - 0.48) < 1e-9, 'dano original: 7 tiros no corpo e TTK de 0,48 s');
// O traçado compartilhado é usado no cliente offline e pelo hitscan do servidor.
const physics = createPhysics([], [100, 100]);
for (const [index, damage, bullets, seconds] of [[21, 15, 7, 0.48], [22, 12, 9, 0.72]]) {
  const weapon = WEAPONS[index], target = { e: {}, p: { x: 0, y: 0, z: -8 } };
  const hit = traceShot(physics, { x: 0, y: 0.8, z: 0 }, { x: 0, y: 0, z: -1 }, weapon, [target]).hits[0];
  const count = hit ? Math.ceil(100 / hit.dmg) : 0;
  ok(hit && !hit.head && hit.dmg === damage && count === bullets && Math.abs((count - 1) * weapon.rate - seconds) < 1e-9,
    `${weapon.short}: traçado real causa ${hit && hit.dmg}, mata em ${count} tiros no corpo (${seconds} s)`);
}
ok(W.reload > WEAPONS[0].reload && W.pen > 0, `recarrega mais devagar que o fuzil (${W.reload} s) e atravessa parede fina (${W.pen} m)`);
ok(PRIMARIES.includes(21) && BOT_PRIMARIES.includes(21) && CATEGORIES.some((c) => c.id === 'rajada' && c.weapons.includes(21)), 'está nas primárias, nos bots e na categoria Rajada');
ok(BOT_RANGE.length === WEAPONS.length && BOT_RANGE[21] > 0, `BOT_RANGE cobre as ${WEAPONS.length} armas`);
ok(inspectKind(W) === 'lmg' && killIcon('lmg') !== killIcon('rifle') && weaponSvg('lmg').includes('<path'), 'inspeção e ícones próprios');
ok(MINIGUN === 20 && !PRIMARIES.includes(20) && isMiniCode('minigun'), 'a minigun continua só pelo código, fora do Arsenal');
// ---- servidor ----
const mk = (mode) => {
  const g = new Game({ code: 'TEST', map: 'arena', max: 8, fillBots: mode !== 'inv', mode }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' }); a.connected = true;
  const step = (n = 1, d = 0.05) => { for (let i = 0; i < n; i++) { fake += d; a.vel = { x: 0, y: 0, z: 0 }; if (a.alive) a.hp = 100; g.tick(); } };
  step(5); return { g, a, step, T: () => fake };
};
{
  const { g, a, step } = mk('dm');
  a.alive = true; a.hp = 100; a.invulnUntil = 1e9;
  g.onEvent(a, ['pr', 21, 4, 7]); ok(a.nextPrimary === 21, `servidor: 'pr' aceita a 21 (${a.nextPrimary})`);
  g.equipNow(a); ok(a.slots[0] === 21 && a.weapon === 21 && a.mag[21] === 100 && a.reserve[21] === 300, `servidor: equipada com 100/300 (${a.slots}, ${a.mag[21]}/${a.reserve[21]})`);
  const eye = [a.pos.x, a.pos.y + 1.6, a.pos.z], n0 = a.mag[21], r0 = a.rejectedShots || 0;
  g.onEvent(a, ['f', eye, [[0, 0, 1]], 21, +g.T.toFixed(3), g.T]);
  ok(a.mag[21] === n0 - 1 && (a.rejectedShots || 0) === r0, `servidor: tiro aceito (pente ${a.mag[21]})`);
  // um bot com a metralhadora atira de verdade (gasta fita e solta o evento 'sh' da 21)
  const bot = [...g.ents.values()].find((e) => e.bot); bot.slots[0] = 21; bot.weapon = 21; bot.mag[21] = 100; bot.reserve[21] = 300; bot.nextFire = 0; bot.reloadEnd = 0; bot.alive = true; bot.stunUntil = 0;
  a.invulnUntil = 1e9; const evs = []; g.io.broadcast = (m) => { if (m && Array.isArray(m.ev)) evs.push(...m.ev); }; g.events.length = 0;
  for (let i = 0; i < 6; i++) { bot.nextFire = 0; g.botShoot(bot, a, 8); step(1, 0.01); }
  ok(bot.mag[21] < 100 && [...evs, ...g.events].some((e) => e[0] === 'sh' && e[1] === bot.id && e[2] === 21), `servidor: bot com a 21 atira (pente ${bot.mag[21]})`);
  // troca na pausa ('px'): derruba 1 vez; a 2ª em < 10 s é recusada; depois do tempo passa
  const D0 = a.deaths; a.invulnUntil = 0; a.alive = true; step(2);
  g.onEvent(a, ['px', 0, 4, 7]); ok(a.deaths === D0 + 1 && a.rsReq === true, `servidor DM: 'px' derruba sem abate e pede respawn (mortes ${D0}→${a.deaths})`);
  step(4); ok(a.alive && a.slots[0] === 0, `servidor DM: nasce com a arma nova (${a.slots})`);
  const D1 = a.deaths; g.onEvent(a, ['px', 21, 4, 7]); step(1); ok(a.deaths === D1 && a.alive, `servidor DM: 2ª troca em seguida recusada (mortes ${a.deaths})`);
  step(210); g.onEvent(a, ['px', 21, 4, 7]); ok(a.deaths === D1 + 1, `servidor DM: depois de 10 s a troca vale de novo (mortes ${a.deaths})`);
}
{
  const { g, a, step } = mk('treino'); a.alive = true; step(2);
  const D = a.deaths; g.onEvent(a, ['px', 21, 4, 7]); g.onEvent(a, ['px', 0, 4, 7]); ok(a.deaths === D && a.slots[0] === 0, `servidor Treino: troca na hora, sem derrubar (${a.slots})`);
}
{
  const { g, a, step } = mk('inv'); a.alive = true; step(3);
  const lives = a.lives ?? (g.inv && g.inv.players && g.inv.players.get && g.inv.players.get(a.id)?.lives); const D = a.deaths;
  for (let i = 0; i < 3; i++) { g.onEvent(a, ['px', 21, 4, 7]); g.onEvent(a, ['px', 0, 4, 7]); step(2, 0.05); }
  const lives2 = a.lives ?? (g.inv && g.inv.players && g.inv.players.get && g.inv.players.get(a.id)?.lives);
  g.inv.phase = 'wave'; for (let i = 0; i < 3; i++) { g.onEvent(a, ['px', 21, 4, 7]); g.onEvent(a, ['px', 0, 4, 7]); step(2, 0.05); }
  const lives3 = a.lives ?? (g.inv && g.inv.players && g.inv.players.get && g.inv.players.get(a.id)?.lives);
  ok(a.alive && a.deaths === D && lives3 === lives, `servidor Invasão: no meio da wave também não derruba (vidas ${lives}→${lives3})`);
  ok(a.alive && a.deaths === D && lives2 === lives, `servidor Invasão: 'px' nunca derruba nem gasta vida (fase ${g.inv && g.inv.phase}, vidas ${lives}→${lives2}, mortes ${D}→${a.deaths})`);
}
console.log(fails.length ? 'FALHOU ' + fails.length : 'TUDO OK'); process.exit(fails.length ? 1 : 0);

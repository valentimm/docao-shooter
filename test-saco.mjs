// Saco de Presentes (28): taca caixas em arco que estouram no impacto ou em 1,2 s.
// Servidor faz a mesma conta (shared/gift.js). Teste em Node, sem navegador.
import { Game } from './server/src/game.js';
import { WEAPONS, GIFT_W, RAY, CATEGORIES, PRIMARIES, BOT_PRIMARIES, BOT_RANGE, SECONDARIES } from './shared/rules.js';
import { GIFT, giftAim, stepGift, giftOpts } from './shared/gift.js';
import { createPhysics, mapSolids } from './shared/physics.js';
import { getMap } from './maps.js';
import { killIcon } from './killfeed-icons.js';
import { inspectKind, INSPECT_PROFILES } from './inspect.js';
import { isExplosiveWeapon, buyWeapon, armComp } from './shared/comp.js';
import { papOk, BOX_POOL, bodyDmg, giftBoomDmg } from './shared/survival.js';
import { X1_GUNS } from './shared/x1.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(RAY === 27 && GIFT_W === 28 && WEAPONS[GIFT_W].key === 'saco' && WEAPONS[GIFT_W].gift, `WEAPONS[28] = saco, logo depois da Ray Gun (${GIFT_W})`);
ok(WEAPONS[GIFT_W].name === 'Saco de Presentes' && WEAPONS[GIFT_W].mag === 4 && WEAPONS[GIFT_W].reserve === 8 && WEAPONS[GIFT_W].rate === 0.9, `nome e pente 4/8, cadência 0,9 s`);
ok(CATEGORIES.find((c) => c.id === 'especial').weapons.includes(GIFT_W) && PRIMARIES.includes(GIFT_W) && BOT_PRIMARIES.includes(GIFT_W) && BOT_RANGE[GIFT_W] === 11, 'Especial, PRIMARIES, BOT_PRIMARIES e BOT_RANGE[28] = 11');
ok(killIcon('saco') !== killIcon('rifle') && killIcon('saco') !== killIcon('milho'), 'ícone do killfeed próprio');
ok(inspectKind(WEAPONS[GIFT_W]) === 'gift' && !!INSPECT_PROFILES.gift, 'perfil de inspeção gift');
ok(isExplosiveWeapon(GIFT_W), 'Competitivo recusa o saco (explosivo)');
{
  const shop = armComp({ cash: 16000, weapon: 4, primary: 4, slots: [4, 4, 7] }, 1);
  ok(!buyWeapon(shop, GIFT_W, true).ok, 'loja do Competitivo não vende o saco');
}
ok(papOk(WEAPONS[GIFT_W]) && BOX_POOL.includes(GIFT_W), 'Papada e Barraca da Sorte aceitam o saco');
ok(bodyDmg(WEAPONS[GIFT_W]) === 100 && giftBoomDmg(0) === 100 && giftBoomDmg(1) > 100, `dano base 100, Papada sobe (${giftBoomDmg(1)})`);
ok(X1_GUNS.includes(GIFT_W), 'entra no pool do X1');
ok(GIFT.fuse === 1.2 && GIFT.radius === 4.5 && GIFT.maxDmg === 100 && GIFT.selfMul === 0.4 && GIFT.speed === 18, 'fuse 1,2 s, raio 4,5, 100 de dano, 40% em si, 18 m/s');
ok(giftOpts(GIFT_W).kind === 's' && giftOpts(GIFT_W).fx === 'gift', 'blast tipo s / fx gift (não conflita com o míssil p)');

{
  const a = giftAim({ x: 0, y: 1.5, z: 0 }, { x: 12, y: 1.5, z: 0 });
  ok(a.y > 0, `giftAim compensa a queda (y ${a.y.toFixed(3)})`);
  const open = createPhysics([], getMap('arena').size);
  const g1 = { pos: { x: 0, y: 8, z: 0 }, vel: { x: 0, y: 4, z: 0 }, t: 0 };
  let h = null; for (let i = 0; i < 120 && !h; i++) h = stepGift(open, g1, 1 / 60, [], () => false);
  ok(!!h && g1.dead && Math.abs(g1.t - GIFT.fuse) < 1e-6, `no céu aberto estoura no fuse (${g1.t.toFixed(3)} s)`);
}

// ---- servidor ----
{
  const g = new Game({ code: 'TEST', map: 'arena', max: 8, fillBots: true, mode: 'dm' }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' }); a.connected = true;
  for (let i = 0; i < 5; i++) { fake += 0.05; g.tick(); }
  const reset = () => { a.alive = true; a.hp = 100; a.invulnUntil = 0; a.slots = [GIFT_W, 4, 7]; a.weapon = GIFT_W; a.mag[GIFT_W] = 4; a.reserve[GIFT_W] = 8; a.reload = null; a.lastShot = WEAPONS.map(() => -9); };
  reset();
  const bots = [...g.ents.values()].filter((b) => b.bot); for (const b of bots) { b.alive = false; b.respawnAt = 1e9; }
  const eye = () => ({ x: a.pos.x, y: a.pos.y + 1.6, z: a.pos.z });
  const E = (o) => [o.x, o.y, o.z];
  let all = []; g.io.broadcast = (m) => { if (m && Array.isArray(m.ev)) all.push(...m.ev); };
  const run = (n) => { for (let i = 0; i < n; i++) { fake += 0.05; g.tick(); } };
  let free = null; for (let k = 0; k < 16 && !free; k++) { const t = k / 16 * Math.PI * 2, d = { x: Math.cos(t), y: 0, z: Math.sin(t) }, h = g.P.rayWorld(eye(), d, 14); if (h === null || h > 8) free = d; }
  ok(!!free, `direção livre a partir do spawn (${JSON.stringify(free)})`);

  g.onEvent(a, ['gp', E(eye()), [free.x, 0.15, free.z], g.now()]); run(40);
  const sh = all.filter((e) => e[0] === 'sh' && e[2] === GIFT_W).length;
  const gl = all.filter((e) => e[0] === 'gl');
  const bm = all.filter((e) => e[0] === 'bm' && e[2] === 's');
  ok(sh === 1 && gl.length === 1 && bm.length === 1 && g.gifts.length === 0 && a.mag[GIFT_W] === 3,
    `servidor: 1 'sh', 1 'gl', 1 'bm' tipo s e pente 3 (sh ${sh}, gl ${gl.length}, bm ${bm.length}, pente ${a.mag[GIFT_W]})`);

  reset(); a.rejectedShots = 0; all = []; fake += 1; run(1);
  g.onEvent(a, ['gp', E(eye()), [free.x, 0.1, free.z], g.now()]);
  g.onEvent(a, ['gp', E(eye()), [free.x, 0.1, free.z], g.now() + 0.1]); run(1);
  ok(all.filter((e) => e[0] === 'gl').length === 1 && a.mag[GIFT_W] === 3 && a.rejectedShots >= 1,
    `cadência: 2º tiro 0,1 s depois é recusado (gl ${all.filter((e) => e[0] === 'gl').length}, pente ${a.mag[GIFT_W]}, recusados ${a.rejectedShots})`);
  run(18); g.onEvent(a, ['gp', E(eye()), [free.x, 0.1, free.z], g.now()]); run(1);
  ok(all.filter((e) => e[0] === 'gl').length === 2 && a.mag[GIFT_W] === 2, `cadência: 0,9 s depois passa (pente ${a.mag[GIFT_W]})`);
  run(30);

  reset(); all = []; run(20);
  g.onEvent(a, ['f', E(eye()), [[1, 0, 0]], GIFT_W, g.now() + 5]); run(1);
  ok(a.mag[GIFT_W] === 4 && !all.some((e) => e[0] === 'sh'), `'f' com a arma 28 é recusado (pente ${a.mag[GIFT_W]})`);

  const bot = bots[0]; reset(); all = []; run(20);
  const DIST = 4.2;
  const place = () => { const e = eye(); bot.alive = true; bot.respawnAt = 1e9; bot.invulnUntil = 0; bot.pos.x = a.pos.x + free.x * DIST; bot.pos.z = a.pos.z + free.z * DIST; bot.pos.y = a.pos.y; bot.vel = { x: 0, y: 0, z: 0 }; bot.frozen = true; return e; };
  place(); bot.hp = 100; a.kills = 0;
  const hold = () => { if (!bot.alive) return; bot.pos.x = a.pos.x + free.x * DIST; bot.pos.z = a.pos.z + free.z * DIST; bot.pos.y = a.pos.y; bot.vel = { x: 0, y: 0, z: 0 }; bot.frozen = true; };
  const kTick = () => { for (let i = 0; i < 40; i++) { hold(); a.invulnUntil = 1e9; fake += 0.05; g.tick(); } };
  const aim = giftAim(eye(), { x: bot.pos.x, y: bot.pos.y + 0.8, z: bot.pos.z });
  g.onEvent(a, ['gp', E(eye()), [aim.x, aim.y, aim.z], g.now()]); kTick();
  const hitEv = all.filter((e) => e[0] === 'h' && e[1] === bot.id && e[2] === a.id);
  const kEv = all.find((e) => e[0] === 'k' && e[1] === a.id && e[2] === bot.id);
  ok(bot.hp < 100 && hitEv.length > 0, `servidor: presente acerta o bot a ${DIST} m (hp ${Math.round(bot.hp)}, eventos h ${hitEv.length})`);
  ok(!bot.alive && !!kEv && kEv[3] === GIFT_W && a.kills >= 1, `servidor: kill com a arma 28 (${JSON.stringify(kEv)}, kills ${a.kills})`);
  bot.alive = false; bot.frozen = false; bot.respawnAt = 1e9; bot.pos.x = 999; bot.pos.z = 999;

  reset(); all = []; run(20);
  g.onEvent(a, ['gp', E(eye()), [0, -1, 0.05], g.now()]); run(40);
  ok(a.hp > 0 && a.hp < 100 && a.hp >= 40, `tiro no pé: se machuca, mas com o selfMul 0,4 (hp ${Math.round(a.hp)})`);

  {
    const P = g.P; let wall = null;
    for (let k = 0; k < 64 && !wall; k++) { const t = k / 64 * Math.PI * 2, d = { x: Math.cos(t), y: 0, z: Math.sin(t) }, h = P.rayWorldN(eye(), d, 11); if (h && h.t > 2 && Math.abs(h.n.y) < 0.1) wall = { d, h }; }
    if (!wall) ok(false, 'achar uma parede perto do spawn');
    else {
      const o = eye(), box = { id: 77, pos: { ...o }, vel: { x: wall.d.x * GIFT.speed, y: 0.2, z: wall.d.z * GIFT.speed }, t: 0 };
      let h = null; for (let i = 0; i < 120 && !h; i++) h = stepGift(P, box, 1 / 60, [], () => false);
      const along = h ? (h.pos.x - o.x) * wall.d.x + (h.pos.z - o.z) * wall.d.z : 99;
      ok(!!h && h.n && along <= wall.h.t + 0.2, `parede: presente estoura nela (n ${h && JSON.stringify(h.n)}, ${along.toFixed(2)} ≤ ${wall.h.t.toFixed(2)} m)`);
    }
  }

  {
    reset(); a.invulnUntil = 0; a.hp = 1e6; all = [];
    const b = bots[1]; b.alive = true; b.respawnAt = 1e9; b.invulnUntil = 0; b.hp = 100; b.primary = GIFT_W; b.slots = [GIFT_W, 4, 7]; b.weapon = GIFT_W; b.mag[GIFT_W] = 4; b.reloadEnd = 0; b.lastShot = WEAPONS.map(() => -9);
    const put = (dd) => { b.pos.x = a.pos.x + free.x * dd; b.pos.z = a.pos.z + free.z * dd; b.pos.y = a.pos.y; b.yaw = Math.atan2(-free.x, -free.z); };
    for (let i = 0; i < 200 && !all.some((e) => e[0] === 'gl' && e[2] === b.id); i++) { put(8); a.hp = 1e6; fake += 0.05; g.tick(); }
    ok(all.some((e) => e[0] === 'gl' && e[2] === b.id), `bot com o Saco de Presentes taca a 8 m`);
    run(30); all = []; b.mag[GIFT_W] = 4;
    for (let i = 0; i < 80; i++) { put(2); a.hp = 1e6; fake += 0.05; g.tick(); }
    ok(!all.some((e) => e[0] === 'gl' && e[2] === b.id), `bot não taca presente com o alvo a 2 m`);
  }
}

if (fails.length) { console.error('\nFalhou: ' + fails.join(' | ')); process.exit(1); }
console.log('\nSaco de Presentes: todos os testes em Node passaram.');

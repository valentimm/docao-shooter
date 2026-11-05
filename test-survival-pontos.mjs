// Saldo único do Survival e pontuação da Ray Gun igual à das outras armas.
// Regra (a mesma de grantHit/grantKill, sem bônus por arma):
//   acerto que não mata: +SURV.hit (10), teto SURV.hitCap por zumbi por jogador
//   o golpe que mata não soma o acerto de novo
//   abate: killPoints(tipo, cabeça) — cabeça só no contato direto (tiro ou pulso da Ray Gun)
//   área: cada zumbi no estouro recebe um crédito, uma vez (acerto ou abate)
// Uso: node test-survival-pontos.mjs
import { Game } from './server/src/game.js';
import { WEAPONS, PISTOL, RAY } from './shared/rules.js';
import { ZOMBIES } from './shared/invasion.js';
import { SURV, killPoints, syncPurse, acceptPurse, tryPap } from './shared/survival.js';
import { rayImpactHead } from './shared/ray.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const io = () => ({ send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });

function boot() {
  const g = new Game({ code: 'P', map: 'hotmilk-noite', max: 8, fillBots: false, mode: 'survival', test: true }, io());
  const a = g.join({ name: 'Ana' }).ent;
  g.welcome(a);
  g.onMessage(a.id, { t: 'start', map: 'hotmilk-noite' });
  a.invulnUntil = 0;
  return { g, a };
}
function zombie(g, type, x, zz) {
  const st = ZOMBIES[type];
  const ent = g.makeEnt({ name: type, skin: 'default', primary: 0, bot: true });
  ent.zt = type; ent.alive = true; ent.hp = st.hp; ent.maxHp = st.hp; ent.size = st.size; ent.team = 1;
  ent.pos = { x, y: g.P.groundAt(x, zz, 1), z: zz }; ent.invulnUntil = 0; ent.connected = true;
  return ent;
}
function aim(a, z, y) {
  const eye = { x: a.pos.x, y: a.pos.y + 1.6, z: a.pos.z };
  const dx = z.pos.x - eye.x, dy = (z.pos.y + y) - eye.y, dz = z.pos.z - eye.z;
  const L = Math.hypot(dx, dy, dz) || 1;
  return { eye, dir: { x: dx / L, y: dy / L, z: dz / L } };
}
function arm(a, w) {
  a.slots = [w === PISTOL ? PISTOL : a.slots[0], w === PISTOL ? PISTOL : w, 7];
  if (w !== PISTOL) { a.slots[0] = PISTOL; a.slots[1] = w; }
  a.slotOn = [1, 1, 1]; a.weapon = w;
  a.mag[w] = 30; a.reserve[w] = 200; a.lastShot[w] = -9; a.reload = null;
}
function shot(g, a, z, w, y) {
  const { eye, dir } = aim(a, z, y);
  arm(a, w);
  const before = a.pts | 0;
  g.events = [];
  if (WEAPONS[w].ray) {
    g.humanRay(a, [eye.x, eye.y, eye.z], [dir.x, dir.y, dir.z]);
    for (let i = 0; i < 40 && g.rays.length; i++) g.stepRays(0.05);
  } else g.humanFire(a, [eye.x, eye.y, eye.z], [[dir.x, dir.y, dir.z]], w, g.T);
  const kill = g.events.find((e) => e[0] === 'k' && e[2] === z.id);
  return { delta: (a.pts | 0) - before, alive: z.alive, hp: z.hp, head: !!(kill && kill[4]), pts: a.pts | 0, points: a.points | 0 };
}

// saldo: os dois campos não voltam pro maior depois do gasto
{
  const e = { pts: 1000, points: 1000, _purse: 1000, purseN: 3 };
  e.pts = 200;
  ok(syncPurse(e) === 200 && e.points === 200 && e.pts === 200, `gasto só em pts fica 200 (não volta a 1000), geração ${e.purseN}`);
  e.points = 900;
  ok(syncPurse(e) === 900 && e.pts === 900, 'escrever points de propósito atualiza o saldo único');
  const stale = acceptPurse({ pts: 40, points: 40, _purse: 40, purseN: 5 }, 500, 4);
  ok(stale === false, 'geração velha não devolve o saldo');
  const zeroed = { pts: 1250, points: 1250, _purse: 1250, purseN: 1 };
  ok(acceptPurse(zeroed, 0, 2) === true && zeroed.pts === 0 && zeroed.points === 0, 'saldo zero da barraca entra (0 não é “sem evento”)');
  ok(acceptPurse(zeroed, 1250, 2) === false && zeroed.pts === 0, 'o mesmo pacote não desfaz o zero');
}

{
  const { g, a } = boot();
  ok(a.pts === 500 && a.points === 500 && a.pts === a.points, 'entra com um saldo só');
  const wi = g.stations.walls.findIndex((w) => w.w !== PISTOL);
  const wall = g.stations.walls[wi];
  a.pos = { x: wall.x, y: wall.y || 0, z: wall.z };
  a.pts = wall.price - 1; a.points = a.pts; a._purse = a.pts;
  const broke = a.pts;
  g.onEvent(a, ['sv', 'wall', wi]);
  ok(a.pts === broke && a.points === broke && !a.slots.includes(wall.w), 'sem saldo a parede não debita e não entrega');
  a.pts = wall.price; a.points = wall.price; a._purse = wall.price;
  g.events = [];
  g.onEvent(a, ['sv', 'wall', wi]);
  ok(a.pts === 0 && a.points === 0 && a.slots.includes(wall.w), 'compra da parede zera os dois campos e entrega uma vez');
  const gunEv = g.events.find((e) => e[0] === 'sgun' && e[8]);
  ok(gunEv && gunEv[6] === 0 && gunEv[9] > 0, `evento da parede leva saldo 0 e geração ${gunEv && gunEv[9]}`);
  g.onEvent(a, ['sv', 'wall', wi]);
  ok(a.pts === 0 && a.points === 0, 'comprar de novo sem saldo não debita');
  const gained = a.pts;
  g.damage(zombie(g, 'walker', a.pos.x + 2, a.pos.z), 10, a, PISTOL, false);
  ok(a.pts === gained + SURV.hit && a.points === a.pts, 'depois de gastar, o acerto soma em cima do zero');
  const mid = a.pts;
  a.weapon = PISTOL; a.slots[0] = PISTOL;
  a.pos = { x: g.stations.papada.x, y: g.stations.papada.y || 0, z: g.stations.papada.z };
  g.onEvent(a, ['sv', 'pap']);
  ok(a.pts === mid && !(a.pap && a.pap[PISTOL]), 'Papada sem o preço não debita');
  a.pts = 10000; a.points = 10000; a._purse = a.pts;
  g.onEvent(a, ['sv', 'pap']);
  const afterPap = a.pts;
  ok(afterPap === 0 && a.pap[PISTOL] === 1 && a.points === 0, 'Papada debita uma vez');
  g.onEvent(a, ['sv', 'pap']);
  ok(a.pts === 0 && a.pap[PISTOL] === 1, 'segunda Papada sem saldo não sobe tier nem debita');
  g.damage(zombie(g, 'walker', a.pos.x + 1, a.pos.z), 1e6, a, PISTOL, false);
  ok(a.pts === killPoints('walker', false) && a.points === a.pts, 'abate depois da compra não volta pro saldo antigo');
}

{
  const { g, a } = boot();
  a.pos = { x: g.stations.box.x, y: g.stations.box.y || 0, z: g.stations.box.z };
  a.pts = SURV.boxPrice; a.points = a.pts; a._purse = a.pts;
  g.events = [];
  g.onEvent(a, ['sv', 'box']);
  const spin = g.events.find((e) => e[0] === 'sbox' && e[1] === 'spin');
  ok(a.pts === 0 && a.points === 0 && spin && spin[5] === 0 && spin[6] > 0, 'barraca no preço exato manda saldo 0 com geração');
  g.onEvent(a, ['sv', 'box']);
  ok(a.pts === 0 && g.boxState.phase === 'spin', 'giro repetido não debita outra vez');
  const had = a.weapon;
  a.weapon = a.slots[1] === PISTOL ? PISTOL : a.slots[0];
  const swapBefore = a.pts;
  a.weapon = a.slots[0];
  ok(a.pts === swapBefore && a.weapon !== had || a.pts === swapBefore, 'trocar a arma na mão não mexe no saldo');
}

{
  const { g, a } = boot();
  const b = g.join({ name: 'Bia' }).ent;
  g.spawn(b); b.invulnUntil = 0;
  a.pts = 800; a.points = 800; a._purse = 800;
  const b0 = b.pts | 0;
  const z = zombie(g, 'walker', a.pos.x, a.pos.z - 3);
  g.damage(z, 1e6, a, PISTOL, true);
  ok(a.pts === 800 + killPoints('walker', true) && (b.pts | 0) === b0 && a.pts !== b.pts, `abate da Ana não mexe no saldo da Bia (${a.pts} × ${b.pts})`);
  const infoA = g.entInfo(a).pts, infoB = g.entInfo(b).pts;
  ok(infoA === a.pts && infoB === b.pts && infoA !== infoB, 'o retrato da sala manda o saldo de cada um');
  const keep = a.pts;
  a.alive = false; g.spawn(a);
  ok(a.pts === keep && a.points === keep, 'renascer não apaga nem devolve o saldo');
  a.invulnUntil = g.T + 1e6;
  const wave = a.pts;
  g.testInv(a, { wave: 2, clearQueue: 1 });
  ok(a.pts === wave && a.points === wave, 'trocar de wave não mexe no saldo');
}

// Ray Gun: mesmo crédito do tiro comum no acerto, no abate e na cabeça; área paga cada alvo uma vez
{
  const head = { pos: { x: 0, y: 0, z: 0 }, size: 1 };
  ok(rayImpactHead(head, { x: 0, y: 1.5, z: 0.2 }), 'pulso na esfera da cabeça conta como cabeça');
  ok(!rayImpactHead(head, { x: 0, y: 0.8, z: 0.2 }), 'pulso no corpo não é cabeça');
  ok(!rayImpactHead(head, { x: 3, y: 1.5, z: 0 }), 'estouro longe do corpo não vira cabeça');

  const { g, a } = boot();
  const chip = zombie(g, 'tank', a.pos.x, a.pos.z - 4);
  const pChip = shot(g, a, chip, PISTOL, 0.8);
  const rChip = shot(g, a, chip, RAY, 0.8);
  ok(pChip.delta === SURV.hit && rChip.delta === SURV.hit && chip.alive, `acerto que não mata: pistola ${pChip.delta} e Ray Gun ${rChip.delta}`);

  const { g: g2, a: a2 } = boot();
  const body = zombie(g2, 'walker', a2.pos.x, a2.pos.z - 4);
  let pistolKill = 0, shots = 0;
  while (body.alive && shots < 8) { pistolKill = shot(g2, a2, body, PISTOL, 0.75).delta; shots++; }
  const { g: g3, a: a3 } = boot();
  const bodyR = zombie(g3, 'walker', a3.pos.x, a3.pos.z - 4);
  const rayBody = shot(g3, a3, bodyR, RAY, 0.7);
  ok(!rayBody.alive && rayBody.delta === killPoints('walker', rayBody.head) && rayBody.delta === pistolKill, `abate no corpo: Ray Gun ${rayBody.delta} = último tiro da pistola ${pistolKill} (cabeça ${rayBody.head})`);
  ok(rayBody.pts === rayBody.points, 'abate da Ray Gun grava um saldo só');

  const { g: g4, a: a4 } = boot();
  const hs = zombie(g4, 'walker', a4.pos.x, a4.pos.z - 4);
  const rayHead = shot(g4, a4, hs, RAY, 1.5);
  ok(!rayHead.alive && rayHead.head && rayHead.delta === killPoints('walker', true), `pulso na cabeça paga o bônus das outras armas (${rayHead.delta}, head ${rayHead.head})`);

  const { g: g5, a: a5 } = boot();
  const pack = [-0.7, 0, 0.7].map((x) => zombie(g5, 'walker', a5.pos.x + x, a5.pos.z - 3));
  const before = a5.pts | 0;
  arm(a5, RAY);
  const { eye, dir } = aim(a5, pack[1], 0.8);
  g5.humanRay(a5, [eye.x, eye.y, eye.z], [dir.x, dir.y, dir.z]);
  for (let i = 0; i < 40 && g5.rays.length; i++) g5.stepRays(0.05);
  const dead = pack.filter((z) => !z.alive).length;
  const gained = (a5.pts | 0) - before;
  ok(dead === 3 && gained === 3 * killPoints('walker', false), `três alvos no estouro: ${dead} abates, ${gained} pontos, sem dobro`);
  const ids = g5.events.filter((e) => e[0] === 'spts').map((e) => e[4]);
  ok(new Set(ids).size === ids.length && ids.every((n, i) => i === 0 || n > ids[i - 1]), `gerações do multikill sobem (${ids.join(',')})`);
}

if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\ntudo ok');

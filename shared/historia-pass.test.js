import test from 'node:test';
import assert from 'node:assert/strict';
import { HPASS, HPASS_IDS, RANKS, rollPass, takePass, enqueueHistoria, nextHistoria, passLv, passoMul, passHp, estaloRoll, platePoints, withEspeto, cagasTune, stretchDur, tokenMul, tokenNote, blessCost } from './historia-pass.js';
import { InvasionCore } from './invasion.js';
import { tryPap, tryBoxPay, SURV } from './survival.js';
import { PISTOL } from './rules.js';

test('são 16 passivas, cada uma com bronze, prata e ouro', () => {
  assert.equal(HPASS_IDS.length, 16);
  assert.deepEqual(RANKS.slice(1), ['Bronze', 'Prata', 'Ouro']);
  for (const id of HPASS_IDS) {
    assert.ok(HPASS[id].name && HPASS[id].icon);
    assert.match(HPASS[id].line(1), /./);
    assert.notEqual(HPASS[id].line(1), HPASS[id].line(3));
  }
});

test('a passiva volta até o ouro e depois sai do sorteio', () => {
  let n = 0;
  const rnd = () => { n += 1; return ((n * 17) % 100) / 100; };
  const a = rollPass({}, rnd, new Set());
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3);
  const owned = { [a[0]]: 3, [a[1]]: 1 };
  const b = rollPass(owned, rnd, new Set());
  assert.equal(b.includes(a[0]), false);
  assert.equal(b.length, 3);
  const id = a[1];
  const p = { hPOffer: [id, b[0], b[1]], hPass: { ...owned } };
  assert.equal(takePass(p, id), 2);
  assert.equal(p.hPOffer, null);
  assert.equal(passLv(p, id), 2);
  p.hPOffer = [id];
  p.hPass[id] = 3;
  assert.equal(takePass(p, id), 0);
  assert.equal(rollPass({ [id]: 3 }, rnd, new Set()).includes(id), false);
});

test('a fila guarda a passiva se o upgrade do chefão ainda está aberto', () => {
  const p = { hOffer: ['cafe', 'torta', 'grok'], hQueue: [] };
  assert.equal(enqueueHistoria(p, { k: 'pass', ids: ['passo', 'mola', 'brasa'] }), null);
  p.hOffer = null;
  const nxt = nextHistoria(p);
  assert.equal(nxt.k, 'pass');
  assert.deepEqual(p.hPOffer, ['passo', 'mola', 'brasa']);
});

test('os números sobem com o nível e o ouro para', () => {
  const p = { hPass: { passo: 2, porcao: 3, espeto: 1 } };
  assert.equal(passoMul(p), 1.2);
  assert.equal(passHp(3), 180);
  assert.equal(passHp(4), 100);
  const shot = withEspeto({ pierce: 8, pierceMul: 0.82 }, p);
  assert.equal(shot.pierce, 9);
  assert.equal(shot.pierceMul, 0.88);
  const plain = { pierce: 8, pierceMul: 0.82 };
  assert.equal(withEspeto(plain, { hPass: {} }), plain);
  let rolls = 0;
  const rnd = () => (rolls++ === 0 ? 0.5 : 0);
  assert.equal(estaloRoll(1, rnd), 0);
  assert.equal(estaloRoll(1, rnd), 16);
  const plates = platePoints({ id: 2, pos: { x: 0, y: 0, z: 0 }, hPass: { pratos: 3 } }, 0);
  assert.equal(plates.length, 3);
  assert.ok(Math.hypot(plates[0].x, plates[0].z) > 1);
});

test('anabolizante estica o tempo, a porca barateia e o token anda de pouco em pouco', () => {
  const p = { hPass: { anabol: 3, porca: 3, token: 3 } };
  assert.equal(stretchDur(p, 10), 13.5);
  assert.equal(stretchDur({ hPass: {} }, 10), 10);
  assert.equal(blessCost(p, 1000), 720);
  assert.equal(blessCost({ hPass: {} }, 1000), 1000);
  for (let i = 0; i < 30; i++) tokenNote(p, 'kill');
  assert.ok(tokenMul(p) <= 1.14 + 1e-9);
  assert.ok(tokenMul(p) > 1.1);
  tokenNote(p, 'hit');
  const after = tokenMul(p);
  p.tok = 0;
  assert.equal(tokenMul(p), 1);
  assert.ok(after < 1.14);
  assert.equal(cagasTune(0), null);
  assert.equal(cagasTune(3).heal, 18);
});

test('a comida do cagas afasta zumbi e o peido bom cura aliado', () => {
  const p = { id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, hPass: { cagas: 3 } };
  const ally = { id: 2, alive: true, pos: { x: 1, y: 0, z: 0 }, hp: 40 };
  const z = { id: 9, alive: true, zt: 'walker', pos: { x: 2, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } };
  let T = 0;
  const core = new InvasionCore({
    T: () => T, size: [20, 20], players: () => [p, ally], story: () => true, rnd: () => 0,
    P: { collides: () => false, groundAt: () => 0, losClear: () => false },
    spawnZombie: () => null, emit() {}, over() {}, hurtPlayer() {}, hurtZombie() {},
    knock(e, v) { e.vel.x += v.x; e.vel.z += v.z; },
    heal(e, hp) { e.hp += hp; },
  });
  core.zombies = [z];
  core.stepPassives(0.05, 0);
  assert.equal(z.vel.x, 0);
  T = p.cagasAt;
  core.stepPassives(0.05, T);
  assert.ok(z.vel.x > 0);
  assert.equal(ally.hp, 58);
  assert.equal(p.hp, undefined);
});

test('a benção da porca véia desconta papada e barraca', () => {
  const plain = { weapon: PISTOL, pts: 20000, points: 20000, pap: {}, hPass: {} };
  const blessed = { weapon: PISTOL, pts: 20000, points: 20000, pap: {}, hPass: { porca: 1 } };
  const a = tryPap(plain, undefined, 0);
  const b = tryPap(blessed, undefined, 0);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.cost, 10000);
  assert.equal(b.cost, 9000);
  const box = { pts: 2000, points: 2000, pap: {}, hPass: { porca: 3 } };
  const paid = tryBoxPay(box);
  assert.equal(paid.ok, true);
  assert.equal(paid.cost, Math.max(1, Math.round(SURV.boxPrice * 0.72)));
});

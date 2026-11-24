import test from 'node:test';
import assert from 'node:assert/strict';
import { HPASS, HPASS_IDS, RANKS, rollPass, takePass, enqueueHistoria, nextHistoria, passLv, passoMul, passHp, estaloRoll, platePoints, withEspeto } from './historia-pass.js';

test('são 12 passivas, cada uma com bronze, prata e ouro', () => {
  assert.equal(HPASS_IDS.length, 12);
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

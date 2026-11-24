import test from 'node:test';
import assert from 'node:assert/strict';
import { HUP_IDS, HUPS, rollOffer, takeOffer, hReady, historiaSpot } from './historia-ups.js';

test('são 12 habilidades ativas', () => {
  assert.equal(HUP_IDS.length, 12);
  for (const id of HUP_IDS) assert.ok(HUPS[id].cd > 0 && HUPS[id].name);
});

test('cada jogador recebe 3 upgrades que ainda não tem, e o trio muda', () => {
  let n = 0;
  const rnd = () => {
    n += 1;
    return ((n * 17) % 100) / 100;
  };
  const a = rollOffer([], rnd, new Set());
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3);
  const taken = new Set([a.slice().sort().join(',')]);
  const b = rollOffer(['grok'], rnd, taken);
  assert.equal(b.includes('grok'), false);
  assert.notEqual(b.slice().sort().join(','), a.slice().sort().join(','));
});

test('a escolha entra no personagem e some da oferta', () => {
  const p = { hOffer: ['cafe', 'torta', 'grok'], hUps: [], alive: true };
  assert.equal(takeOffer(p, 'outro'), false);
  assert.equal(takeOffer(p, 'torta'), true);
  assert.deepEqual(p.hUps, ['torta']);
  assert.equal(p.hOffer, null);
  assert.equal(hReady(p, 'torta', 0), true);
  p.hCd = { torta: 10 };
  assert.equal(hReady(p, 'torta', 5), false);
  assert.equal(hReady(p, 'torta', 10), true);
});

test('o teleporte do Grok recusa borda e parede', () => {
  const P = {
    groundAt: (x) => (x > 2 ? 1 : 0),
    collides: (x) => x > 2,
  };
  assert.equal(historiaSpot(P, [20, 20], 0, 0).y, 0.02);
  assert.equal(historiaSpot(P, [20, 20], 19, 0), null);
  assert.equal(historiaSpot(P, [20, 20], 3, 0), null);
});

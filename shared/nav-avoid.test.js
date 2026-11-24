import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNav } from '../nav.js';

function yard() {
  const wall = { min: { x: -1.2, y: 0, z: -3.2 }, max: { x: 1.2, y: 3, z: 3.2 }, ramp: null };
  const solids = [wall];
  const collides = (x, y, z) => x >= wall.min.x && x <= wall.max.x && z >= wall.min.z && z <= wall.max.z && y < wall.max.y;
  const groundAt = () => 0;
  const topAt = () => wall.max.y;
  return buildNav({
    hx: 14, hz: 14, spacing: 2, collides, groundAt, solids, topAt,
    seeds: [[-8, 0, 0], [8, 0, 0]],
  });
}

test('o caminho contorna a parede', () => {
  const nav = yard();
  const route = nav.path({ x: -8, y: 0, z: 0 }, { x: 8, y: 0, z: 0 });
  assert.ok(route && route.length > 2);
  assert.ok(route.some((n) => Math.abs(n.z) > 3.2), 'precisa sair pelo norte ou pelo sul');
});

test('nós evitados obrigam o outro lado da parede', () => {
  const nav = yard();
  const open = nav.path({ x: -8, y: 0, z: 0 }, { x: 8, y: 0, z: 0 });
  const north = open.filter((n) => n.z > 3.2).map((n) => n.id);
  const south = open.filter((n) => n.z < -3.2).map((n) => n.id);
  assert.ok(north.length || south.length);
  const banned = new Set(north.length ? north : south);
  const detour = nav.path({ x: -8, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, banned);
  assert.ok(detour && detour.length > 2);
  assert.ok(detour.every((n) => !banned.has(n.id) || n === detour[0] || n === detour[detour.length - 1]));
  const around = north.length ? detour.some((n) => n.z < -3.2) : detour.some((n) => n.z > 3.2);
  assert.equal(around, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ULTS, ULT_IDS, rollUltimate, frenzyTaken, storyFogOpen } from './historia-ult.js';
import { InvasionCore } from './invasion.js';

test('são 8 ultimates e o CEO volta antes dos outros', () => {
  assert.equal(ULT_IDS.length, 8);
  const ceo = ULTS.ceo.cd;
  for (const id of ULT_IDS) if (id !== 'ceo') assert.ok(ULTS[id].cd > ceo);
  assert.ok(ULTS.ceo.dur < 4);
});

test('o sorteio não repete enquanto houver ultimate livre', () => {
  const taken = new Set();
  const rnd = () => 0;
  const a = rollUltimate(taken, rnd); taken.add(a);
  const b = rollUltimate(taken, rnd);
  assert.notEqual(a, b);
  assert.equal(frenzyTaken(80, { ultForm: 'frenesi', ultUntil: 5 }, 1), 5);
  assert.equal(frenzyTaken(3, { ultForm: 'frenesi', ultUntil: 5 }, 1), 3);
  assert.equal(frenzyTaken(80, { ultForm: 'frenesi', ultUntil: 5 }, 5), 80);
  assert.equal(storyFogOpen(20, true), false);
  assert.equal(storyFogOpen(21, true), true);
  assert.equal(storyFogOpen(21, false), false);
});

test('na história a névoa abre na wave 21 e a clássica continua fechando', () => {
  const make = (story) => {
    const players = [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 } }];
    const core = new InvasionCore({
      T: () => 30, size: [40, 40], players: () => players, story: () => story, emit() {}, over() {},
      spawnZombie: (type, pos) => ({ pos: { ...pos }, zt: type, vel: { x: 0, y: 0, z: 0 } }),
    });
    core.start();
    return core;
  };
  const story = make(true);
  story.egg.secret = true;
  story.egg.steps = { cria: true, lanche: true, refri: true, muro: true };
  story.wave = 20; story.phase = 'wave'; story.spec = { boss: true, gap: 1 };
  story.endWave();
  assert.equal(story.phase, 'break');
  assert.ok(story.fog.tr > Math.hypot(40, 40));
  assert.ok(ULTS[story.A.players()[0].hUlt]);
  story.startWave(21);
  assert.ok(story.fog.tr > Math.hypot(40, 40));
  const classic = make(false);
  classic.startWave(10);
  assert.ok(Number.isFinite(classic.fog.tr) && classic.fog.tr < story.fog.tr);
  assert.equal(classic.A.players()[0].hUlt, undefined);
});

test('a poça do discípulo machuca e o chefão da wave 20 não oferece upgrade', () => {
  const events = [];
  const players = [{ id: 1, alive: true, pos: { x: 0, y: 0, z: 0 }, yaw: 0, hp: 100 }];
  const core = new InvasionCore({
    T: () => 5, size: [40, 40], players: () => players, story: () => true,
    P: { groundAt: () => 0 },
    emit(ev) { events.push(ev); }, over() {},
    spawnZombie: (type, pos) => ({ pos: { ...pos }, zt: type, vel: { x: 0, y: 0, z: 0 } }),
    hurtZombie(z, dmg) { z.hp -= dmg; if (z.hp <= 0) z.alive = false; },
    hurtPlayer() {},
  });
  core.start();
  players[0].hUlt = 'discipulo';
  assert.equal(core.useHistoria(players[0], 'discipulo'), 'discipulo');
  const z = core.spawn('walker', { x: 2, y: 0, z: 0 });
  const before = z.hp;
  core.stepUltimates(0.25, 5);
  assert.ok(z.hp < before);
  assert.ok(z.slowUntil > 5);
  const boss = core.spawn('boss', { x: 12, y: 0, z: 0 });
  core.wave = 20; core.bossId = boss.id;
  core.onZombieDeath(boss, players[0]);
  assert.equal(events.some((ev) => ev[0] === 'hoffer'), false);
});

// Docão Escondido: regras da rodada (shared/hide.js)
import assert from 'node:assert';
import { HIDE, isHide, newHideState, startHideRound, stepHide, hideFrozen, hiderTeam } from './shared/hide.js';
assert(isHide('hide') && !isHide('bomb'));
const ents = [0, 1, 0, 1].map((team, i) => ({ id: i + 1, team, alive: true }));
const S = newHideState(); startHideRound(S, 0, ents);
assert.equal(hiderTeam(1), 1); assert(ents[1].hider && !ents[0].hider && ents[1].prop);
assert(hideFrozen(S, ents[0]) && !hideFrozen(S, ents[1]));
assert.deepEqual(stepHide(S, ents, HIDE.PREP), [['go']]);
assert.deepEqual(stepHide(S, ents, HIDE.PREP + HIDE.WHISTLE_FIRST - 1), []); // ainda não
assert.deepEqual(stepHide(S, ents, HIDE.PREP + HIDE.WHISTLE_FIRST), [['whistle']]);
assert.deepEqual(stepHide(S, ents, HIDE.PREP + HIDE.WHISTLE_FIRST + 1), []);
assert.deepEqual(stepHide(S, ents, HIDE.PREP + HIDE.WHISTLE_FIRST + HIDE.WHISTLE), [['whistle']]);
ents[1].alive = ents[3].alive = false;
let ev = stepHide(S, ents, HIDE.PREP + 1); assert.equal(ev[0][0], 'win'); assert.equal(ev[0][1], 0); assert.equal(ev[0][2], 'caught');
ev = stepHide(S, ents, HIDE.PREP + 1 + HIDE.END); assert.equal(ev[0][0], 'round'); assert(ents[0].hider && !ents[1].hider); // papéis trocaram
for (const e of ents) e.alive = true;
stepHide(S, ents, 100); ev = stepHide(S, ents, 100 + HIDE.ROUND + 1); assert.deepEqual(ev[0], ['win', 0, 'time', 2, 0]);
S.score = [HIDE.WIN, 0]; ev = stepHide(S, ents, 1e6); assert.deepEqual(ev, [['over', 0]]);
// V2: só objetos que existem no mapa (Rodízio) · lista vai pro sorteio e pro E
{ const { propsForMap, nextProp } = await import('./shared/hide.js'); const { getMap } = await import('./maps.js');
  const L = propsForMap(getMap(HIDE.MAP)); assert.equal(HIDE.MAP, 'rodizio'); assert.deepEqual(L, ['keg', 'hay', 'tree', 'jar', 'crate']);
  assert(!L.includes('cup') && !L.includes('bench'));
  const S2 = newHideState(L), es = [{ team: 1, alive: true }, { team: 1, alive: true }, { team: 1, alive: true }]; startHideRound(S2, 0, es); for (const e of es) assert(L.includes(e.prop) && e.propLock === false);
  assert.equal(nextProp('crate', L), 'keg'); }
console.log('test-hide ok');

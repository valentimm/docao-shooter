// Alvo de bônus da Pocilga: miolo, anel, primeiro acerto, reinício e o piso do servidor.
// Uso: node test-pocilga-bonus.mjs
import { PIT, pitEnemies, pitTargets, pitPieces, minPlausible, rankedRun, inspectRun, scriptRun, rankFloor } from './shared/pocilga.js';
import { BONUS, BONUS_CENTER, BONUS_RING, bonusLine, freshBonus, acceptBonus, scoreShot, aimAt, readBonus } from './shared/pocilga-bonus.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const near = (a, b) => Math.abs(a - b) < 0.02;

const floor = minPlausible();
const eye = (z) => ({ x: 0, y: (z - PIT.stair.z0) / (PIT.stair.z1 - PIT.stair.z0) * PIT.deck + 1.6, z });

ok(BONUS.inner >= 0.12 && BONUS.inner <= 0.15 && BONUS.outer >= 0.6 && BONUS.outer <= 0.7, `raios miolo ${BONUS.inner} m e anel ${BONUS.outer} m`);
ok(pitEnemies().length === 25 && !pitTargets().some((t) => t.id === BONUS.id), 'o bônus não entra nos 25 inimigos nem nos gatilhos');

{
  const wall = pitPieces().find((p) => p.b[2] >= 54.9 && p.b[5] <= 55.5 && p.b[0] < 0 && p.b[3] > 20 && p.b[1] >= PIT.deck - 0.01);
  ok(!!wall, 'a parede reta do fundo continua no fim do corredor');
  if (wall) {
    const [x0, y0, z0, x1, y1] = wall.b;
    ok(BONUS.z < z0 && BONUS.z > z0 - 0.2, `o disco fica na face da parede (z=${BONUS.z}, face ${z0})`);
    ok(BONUS.x > x0 + BONUS.outer && BONUS.x < x1 - BONUS.outer, `no meio da rampa (x=${BONUS.x})`);
    ok(BONUS.y - BONUS.outer > y0 + 0.8 && BONUS.y + BONUS.outer < y1 + 0.02, `o disco cabe na parede (y ${BONUS.y})`);
  }
  const at = eye(36);
  const lip = PIT.deck;
  const slope = (lip - at.y) / (47.2 - at.z);
  const horizon = at.y + slope * (BONUS.z - at.z);
  ok(BONUS.y - BONUS.outer > horizon, `de quem sobe, o alvo inteiro fica acima do horizonte (${horizon.toFixed(2)} → base ${(BONUS.y - BONUS.outer).toFixed(2)})`);
}

const shot = (x, y, z, tx, ty) => scoreShot({ k: 'bonus', w: PIT.pistol, ...aimAt(x, y, z, tx, ty) }, PIT.pistol);
const center = shot(0, 4.2, 36, BONUS.x, BONUS.y);
const ring = shot(0, 4.2, 36, BONUS.x + 0.42, BONUS.y);
const edge = shot(0, BONUS.y, 40, BONUS.x + BONUS.inner, BONUS.y);
const outside = shot(0, 4.2, 36, BONUS.x + BONUS.outer + 0.08, BONUS.y);
const behind = shot(0, BONUS.y, BONUS.z + 2, BONUS.x, BONUS.y);
ok(center && center.zone === 'center' && center.delta === BONUS_CENTER && center.dist < BONUS.inner, `miolo a ${center ? center.dist.toFixed(3) : '—'} m do centro, -2 s`);
ok(ring && ring.zone === 'ring' && ring.delta === BONUS_RING && ring.dist > BONUS.inner && ring.dist <= BONUS.outer, `anel a ${ring ? ring.dist.toFixed(3) : '—'} m, +2 s`);
ok(edge && edge.zone === 'center', 'a borda do miolo ainda é miolo');
ok(!outside && !behind, 'fora do disco e por trás da parede não contam');
ok(!scoreShot({ k: 'bonus', w: 0, ...aimAt(0, 4.2, 36, BONUS.x, BONUS.y) }, PIT.pistol), 'outra arma não vale');

function withShots(events, zones) {
  const copy = events.map((e) => ({ ...e }));
  const at = copy.findIndex((e) => e.k === 'start');
  let t = 0.05;
  const extra = zones.map((zone) => {
    const x = zone === 'center' ? BONUS.x : zone === 'ring' ? BONUS.x + 0.42 : BONUS.x + 1.3;
    const ev = { k: 'bonus', t, w: PIT.pistol, ...aimAt(0, 4.2, 36, x, BONUS.y) };
    t += 0.02;
    return ev;
  });
  copy.splice(at + 1, 0, ...extra);
  return copy;
}

const bull = rankedRun(withShots(scriptRun({ finish: floor }), ['center']));
ok(bull.ranked && bull.bonusZone === 'center' && bull.bonus === -PIT.bonusCut && near(bull.final, floor - PIT.bonusCut), `no mínimo físico, o miolo deixa a nota ${bull.final}`);
ok(bull.final + 1e-6 >= rankFloor() && near(rankFloor(), floor - PIT.bonusCut), 'o piso e o miolo usam o mesmo desconto de 2 s, uma vez');
ok(rankedRun(withShots(scriptRun({ finish: rankFloor() }), ['center'])).reason === 'rápido', 'miolo em cima do piso já descontado não tira outros 2 s');

const shaved = rankedRun(withShots(scriptRun({ finish: floor - 0.05 }), ['center']));
ok(shaved.finished && !shaved.ranked && shaved.reason === 'rápido', 'o miolo não cobre um relógio abaixo do piso físico');
ok(rankedRun(scriptRun({ finish: floor - 0.05 })).ranked, 'sem o miolo, um relógio pouco abaixo do físico ainda cabe no piso');
ok(!rankedRun(scriptRun({ finish: rankFloor() - 0.05 })).ranked, 'abaixo do piso único o ranking recusa');

const ringRun = rankedRun(withShots(scriptRun({ finish: 40 }), ['ring']));
ok(ringRun.ranked && ringRun.bonusZone === 'ring' && ringRun.bonus === 2 && ringRun.final === 42, `anel soma 2 s (${ringRun.final})`);
const first = rankedRun(withShots(scriptRun({ finish: 40 }), ['ring', 'center']));
ok(first.bonusZone === 'ring' && first.bonus === 2 && first.final === 42 && first.down.length === 25, 'só o primeiro acerto vale, e os 25 seguem 25');
const missedFirst = withShots(scriptRun({ finish: 40 }), ['miss', 'center']);
ok(rankedRun(missedFirst).bonusZone === 'center' && rankedRun(missedFirst).bonus === -2, 'tiro que erra o disco não gasta o acerto');
ok(rankedRun(scriptRun({ finish: 40 })).bonus === 0 && rankedRun(scriptRun({ finish: 40 })).final === 40, 'sem tiro no alvo o tempo não muda');

ok(rankedRun(withShots(scriptRun({ finish: 53 }), ['center'])).stars === 3, 'o miolo recupera a 3ª estrela');
ok(rankedRun(scriptRun({ finish: 53 })).stars === 2, 'sem o miolo, 53 s fica nas 2 estrelas');
ok(rankedRun(withShots(scriptRun({ finish: 51 }), ['ring'])).stars === 2, 'o anel tira a 3ª estrela');

const junk = scriptRun({ finish: 40 });
junk.splice(1, 0, { k: 'bonus', t: 0.05 });
ok(inspectRun(junk).reason === 'diário', 'bônus sem raio invalida o diário');
const far = withShots(scriptRun({ finish: 40 }), ['center']);
far.find((e) => e.k === 'bonus').oz = 0;
ok(readBonus(far, PIT.pistol).zone == null && rankedRun(far).bonus === 0, 'origem fora da rampa não leva o desconto');

let st = freshBonus();
st = acceptBonus(st, center);
ok(st.locked && st.text === '-2s' && st.delta === -2 && bonusLine('center') === '-2s', 'trava e escreve -2s');
const kept = acceptBonus(st, ring);
ok(!kept.accepted && kept.zone === 'center' && kept.text === '-2s', 'o segundo acerto não troca o -2s');
st = freshBonus();
ok(!st.locked && st.delta === 0 && st.text === '' && bonusLine(null) === '—', 'reinício destrava');
st = acceptBonus(st, ring);
ok(st.locked && st.text === '+2s' && bonusLine('ring') === '+2s', 'anel trava em +2s');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

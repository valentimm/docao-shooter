// Regras da Pocilga: oito etapas, só a Pistolinha, faca no javali perto, tempo mínimo.
// Uso: node test-pocilga.mjs
import { PIT, FINISH_LINE, pitEnemies, pitTargets, pitCivils, pitMovers, boardAabb, rayAabb, minPlausible, rankFloor, starsOf, suggestion, formatPit, inspectRun, rankedRun, scriptRun, pathStats, samplePath, moverAt, inGate, onFinishLine, fillPops, zombiesAwake } from './shared/pocilga.js';
import { ZOMBIES } from './shared/invasion.js';
import { KNIFE, RADIUS, SPEED, JUMP } from './shared/rules.js';
import { getMap } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(pitEnemies().filter((t) => !t.zombie).length === 23 && pitEnemies().filter((t) => t.zombie).length === 2 && pitCivils().length === 5, `23 javalis, 2 zumbis e 5 civis (${pitEnemies().length}/${pitCivils().length})`);
ok(ZOMBIES.walker.hp === 110 && ZOMBIES.walker.speed === 4.4 && PIT.zombie.speed <= 3.4, 'o zumbi da Pocilga reusa o tipo do Survival sem mudar a tabela');
ok(PIT.bays.length === 8, 'oito gatilhos, na ordem do percurso');
ok(pitMovers().length >= 10 && pitMovers().filter((t) => t.kind === 'civil').length >= 2, `vários no trilho, inclusive civis (${pitMovers().map((t) => t.id).join(',')})`);
ok(pitTargets().some((t) => t.close), 'um javali fica ao alcance da faca');
const stats = pathStats();
const timed = [...PIT.path].reverse().find((p) => !p.scenic);
const e24 = pitTargets().find((t) => t.id === 'e24');
const gap = e24.z - timed.z;
ok(gap > 2 && gap < 6 && FINISH_LINE.x1 - FINISH_LINE.x0 > 5 && Math.abs(FINISH_LINE.z - timed.z) < 0.2, `linha a ${gap.toFixed(1)} m do último alvo, de parede a parede`);
ok(onFinishLine({ x: 32, y: 0, z: FINISH_LINE.z }) && !onFinishLine({ x: PIT.spawn[0], y: 0, z: PIT.spawn[1] }), 'cruzar a faixa termina; a largada não');
ok(stats.total > 160 && stats.dash > 25, `o caminho ficou longo (${stats.total} m, disparada ${stats.dash} m)`);
ok(PIT.path.some((p) => p.y > 2.8) && PIT.path.some((p) => p.drop), 'sobe a escada e pula da passarela');
ok(PIT.rise >= 0.15 && PIT.rise <= 0.25 && PIT.lead >= 10, `subida ${PIT.rise}s, gatilho pensado a ${PIT.lead} m`);
const floor = minPlausible();
ok(floor > 18 && floor + 18 < PIT.star3, `mínimo físico ${floor.toFixed(3)} s, folgado abaixo das 3 estrelas`);
ok(starsOf(PIT.star3, 0, true) === 3 && starsOf(PIT.star3 + 0.01, 0, true) === 2 && starsOf(PIT.star2, 1, true) === 2 && starsOf(PIT.star2 + 0.01, 0, true) === 1, `faixas ${formatPit(PIT.star3)} e ${formatPit(PIT.star2)}`);
ok(starsOf(32, 1, true) === 2 && suggestion(3).id === 'javali', 'civil tira a 3ª estrela; sugestão Javali');
ok(formatPit(PIT.star3) === '0:52.00' && formatPit(PIT.star2) === '1:06.00', 'relógio');
for (const g of PIT.gates) {
  if (!g.pop) continue;
  const far = Math.min(...pitTargets().filter((t) => t.bay === g.pop).map((t) => Math.hypot(t.x - g.x, t.z - g.z)));
  ok(far >= 5, `${g.id} arma a ${far.toFixed(1)} m do grupo`);
}
for (const t of pitTargets()) {
  let near = 99;
  for (const q of samplePath(0.45)) near = Math.min(near, Math.hypot(q.x - t.x, q.z - t.z));
  const gate = PIT.gates.find((g) => g.pop === t.bay);
  const dx = gate.x - t.x, dz = gate.z - t.z;
  const facing = t.face === -1 ? dz < -0.5 : t.face === 1 ? dz > 0.5 : t.face === 'x' ? dx > 0.5 : dx < -0.5;
  const high = (t.y || 0) > 1.2;
  ok((high ? near <= 6.4 : near <= 4.6) && facing, `${t.id} na frente de quem corre (${near.toFixed(1)} m do eixo)`);
}

const clean = rankedRun(scriptRun({ finish: 32 }));
ok(clean.ranked && clean.stars === 3 && clean.civs === 0 && clean.down.includes('z1') && clean.down.includes('z2') && clean.down.length === 25, `limpo em 32 s = 3 estrelas, zumbis inclusos (${clean.final})`);
const nipped = rankedRun(scriptRun({ finish: 32, civs: ['c1'] }));
ok(nipped.ranked && nipped.stars === 2 && nipped.final === 35 && nipped.blocked3, 'civil soma 3 s e bloqueia a 3ª');
const slow = rankedRun(scriptRun({ finish: PIT.star2 + 6 }));
ok(slow.ranked && slow.stars === 1, `acima de ${formatPit(PIT.star2)} = 1 estrela (${slow.final})`);
const forgot = inspectRun(scriptRun({ finish: 40, skip: ['e15'] }));
ok(!forgot.finished && forgot.reason === 'alvo' && forgot.missed.includes('e15'), 'javali em pé trava a chegada');
const rifle = rankedRun(scriptRun({ finish: 40, rifle: true }));
ok(!rifle.finished && rifle.missed.length === 25, 'tiro que não é a Pistolinha não derruba, nem o zumbi');
{
  const ev = scriptRun({ finish: 50 });
  const at = ev.find((e) => e.k === 'hit' && e.id === 'z1');
  at.k = 'grab'; delete at.w;
  const grabbed = rankedRun(ev);
  ok(grabbed.finished && grabbed.grabs === 1 && grabbed.penalty === PIT.zombie.penalty && grabbed.stars === 2 && grabbed.down.includes('z1'), `zumbi que alcança soma ${PIT.zombie.penalty} s e tira a 3ª (${grabbed.stars}, +${grabbed.penalty})`);
  const far = PIT.gates.find((g) => g.pop === 'passa');
  for (const id of ['z1', 'z2']) {
    const t = pitTargets().find((x) => x.id === id);
    const d = Math.hypot(t.x - far.x, t.z - far.z);
    ok(d >= 15, `${id} nasce a ${d.toFixed(1)} m do gatilho`);
  }
}
ok(PIT.deck >= 4.8 && PIT.deck <= 6, `a rampa sobe até ${PIT.deck} m`);
const knifed = rankedRun(scriptRun({ finish: 34, knife: ['e15'] }));
ok(knifed.ranked && knifed.down.includes('e15') && knifed.stars === 3, 'a faca derruba o javali perto');
ok(KNIFE === PIT.knife, 'a faca do circuito é a faca do jogo');
const fast = rankedRun(scriptRun({ finish: rankFloor() - 0.05 }));
ok(fast.finished && !fast.ranked && fast.reason === 'rápido', 'tempo abaixo do piso (mínimo físico − bônus) fica fora do ranking');
ok(rankedRun(scriptRun({ finish: rankFloor() })).ranked, 'no piso configurável o ranking aceita');
ok(rankedRun(scriptRun({ finish: floor })).ranked, 'no mínimo físico o ranking aceita');
ok(PIT.bonusCut === 2 && Math.abs(rankFloor() - (floor - PIT.bonusCut)) < 1e-9, `piso = mínimo físico menos ${PIT.bonusCut} s do alvo de bônus (${rankFloor().toFixed(3)})`);
ok(inspectRun([{ k: 'start', t: 0 }, { k: 'swap', w: 4, t: 1 }]).reason === 'diário', 'troca de arma não faz parte do diário');
{
  const skip = inspectRun([{ k: 'start', t: 0 }, { k: 'pop', bay: 'sala', t: 1 }]);
  ok(skip.reason !== 'ordem' && skip.pops.join(',') === 'patio,patio2,patio3,sala', `pular um gate conta os anteriores (${skip.pops.join(',')})`);
}
ok(inspectRun([{ k: 'start', t: 0 }, { k: 'hit', id: 'e1', w: PIT.pistol, t: 0.4 }]).down.includes('e1'), 'alvo já de pé conta o tiro sem o gatilho da subida');
ok(inspectRun([{ k: 'start', t: 0 }, { k: 'finish', t: 1, x: 0, z: 0 }]).reason === 'linha', 'chegada fora da faixa é recusada');

const moved = moverAt(pitMovers()[0], 0), later = moverAt(pitMovers()[0], 1.3);
ok(Math.abs(moved.x - later.x) + Math.abs(moved.z - later.z) > 0.4, 'o trilho muda de lugar com o tempo');
const e5 = pitTargets().find((t) => t.id === 'e5');
const box = boardAabb(e5);
const ox = e5.x, oz = e5.z - 3, oy = 1.6;
const len = Math.hypot(e5.x - ox, 0.95 - oy, e5.z - oz);
const hit = rayAabb(ox, oy, oz, 0, (0.95 - oy) / len, (e5.z - oz) / len, box, 20);
ok(hit != null, `a placa para a bala (${hit && hit.toFixed(2)})`);
const side = boardAabb(pitTargets().find((t) => t.id === 'e9'));
ok(side.maxZ - side.minZ > side.maxX - side.minX, 'no muro a placa fica de lado, de frente pra sala');

const map = getMap(PIT.map);
ok(map && map.course && map.boxes.some((b) => b.ramp), 'o mapa tem a escada de verdade');
const solids = mapSolids(map), P = createPhysics(solids, map.size, null);
const openMap = { ...map, boxes: map.boxes.filter((b) => !b.door) };
const Popen = createPhysics(mapSolids(openMap), map.size, null);
let stuck = null, hi = 0, lo = 99;
for (const q of samplePath(0.35)) {
  const g = Popen.groundAt(q.x, q.z, q.y + 0.5);
  hi = Math.max(hi, g); lo = Math.min(lo, g);
  if (Math.abs(g - q.y) > 0.55 || Popen.collides(q.x, g + 0.02, q.z)) { stuck = { ...q, g, hit: Popen.collides(q.x, g + 0.02, q.z) }; break; }
}
ok(!stuck, `eixo andável na escada, na passarela e no pulo${stuck ? ` (travou em ${stuck.x.toFixed(1)},${stuck.z.toFixed(1)} y=${stuck.y.toFixed(2)} chão=${stuck.g.toFixed(2)} colide=${stuck.hit})` : ` (alto ${hi.toFixed(2)} m)`}`);
{
  const e = { pos: { x: 0, y: 0.05, z: 28.4 }, vel: { x: 0, y: 0, z: SPEED * PIT.sprint }, onGround: true };
  for (let i = 0; i < 150; i++) P.moveEntity(e, 1 / 30);
  ok(e.pos.y > PIT.deck - 0.35 && e.pos.z > 46, `a rampa nova se sobe em sprint (y=${e.pos.y.toFixed(2)} z=${e.pos.z.toFixed(1)})`);
}

{
  const samples = [];
  let s = 0;
  for (let i = 1; i < PIT.path.length; i++) {
    const a = PIT.path[i - 1], b = PIT.path[i];
    if (b.drop) { s += Math.hypot(b.x - a.x, b.z - a.z); continue; }
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
      let left = 12, right = 12;
      for (let d = 0.2; d <= 12; d += 0.2) {
        if (left === 12 && Popen.collides(x - uz * d, y + 0.05, z + ux * d)) left = d;
        if (right === 12 && Popen.collides(x + uz * d, y + 0.05, z - ux * d)) right = d;
        if (left < 12 && right < 12) break;
      }
      const clear = left + right + RADIUS * 2;
      samples.push({ s: s + len * t, x, z, y, clear });
    }
    s += len;
  }
  const narrow = [];
  let run = null;
  for (const q of samples) {
    if (q.clear < 5) {
      if (!run) run = { s0: q.s, s1: q.s, clear: q.clear, x: q.x, z: q.z };
      else { run.s1 = q.s; run.clear = Math.min(run.clear, q.clear); }
    } else if (run) { narrow.push(run); run = null; }
  }
  if (run) narrow.push(run);
  const bad = narrow.filter((r) => r.s1 - r.s0 > 2 || r.clear < 3);
  const doors = narrow.filter((r) => !(r.s1 - r.s0 > 2 || r.clear < 3));
  console.log('largura: trechos abaixo de 5 m:', narrow.map((r) => `${r.clear.toFixed(1)} m por ${(r.s1 - r.s0).toFixed(1)} m em (${r.x.toFixed(1)},${r.z.toFixed(1)})`).join(' | ') || 'nenhum');
  ok(!bad.length, `largura útil ≥ 5 m, porta curta ≥ 3 m${bad.length ? ' · ' + bad.map((r) => `${r.clear.toFixed(1)} m / ${(r.s1 - r.s0).toFixed(1)} m`).join(', ') : ` (${doors.length} porta)`}`);
  const corridorBays = ['patio', 'patio2', 'patio3'];
  const zs = pitTargets().filter((t) => corridorBays.includes(t.bay)).map((t) => t.z).sort((a, b) => a - b);
  ok(zs[zs.length - 1] - zs[0] > 16, `o primeiro corredor espalha os alvos por ${(zs[zs.length - 1] - zs[0]).toFixed(1)} m`);
  let tight = null;
  const crowd = pitTargets().filter((t) => corridorBays.includes(t.bay));
  for (let i = 0; i < crowd.length; i++) for (let j = i + 1; j < crowd.length; j++) {
    const d = Math.hypot(crowd[i].x - crowd[j].x, crowd[i].z - crowd[j].z);
    if (d < 3.4) tight = `${crowd[i].id}–${crowd[j].id} a ${d.toFixed(1)} m`;
  }
  ok(!tight, tight || 'no primeiro corredor há pelo menos 3,4 m entre as placas');
  const spawn = { x: PIT.spawn[0], y: 0, z: PIT.spawn[1] };
  const door = PIT.gates.find((g) => g.id === 'start');
  const abre = PIT.gates.find((g) => g.id === 'abre');
  ok(onFinishLine({ x: (FINISH_LINE.x0 + FINISH_LINE.x1) / 2, y: 0, z: FINISH_LINE.z }) && !onFinishLine(spawn) && !onFinishLine({ x: door.x, y: 0, z: door.z }), 'a faixa é a chegada; spawn e porta de saída não cruzam ela');
  ok(!onFinishLine({ x: 14.2, y: 0, z: -14 }) && !onFinishLine({ x: abre.x, y: 0, z: abre.z }) && !inGate(spawn, abre), 'andar na sala, antes da hora, não é a chegada nem abre o portão');
  ok(!inGate({ x: 12.25, y: 0, z: -26.2 }, abre) && inGate({ x: 12.25, y: 0, z: -24.2 }, abre), 'o portão só abre junto da boca, não no meio da disparada');
{
  const seen = [];
  let awake = false;
  for (const g of PIT.gates.filter((gate) => gate.pop && gate.x0 != null)) {
    const wideX = g.x1 - g.x0 >= g.z1 - g.z0;
    const midX = (g.x0 + g.x1) / 2, midZ = (g.z0 + g.z1) / 2;
    const edges = wideX
      ? [{ x: g.x0 + 0.9, y: g.y, z: midZ }, { x: g.x1 - 0.9, y: g.y, z: midZ }]
      : [{ x: midX, y: g.y, z: g.z0 + 0.9 }, { x: midX, y: g.y, z: g.z1 - 0.9 }];
    for (const q of edges) {
      const dist = Math.hypot(q.x - g.x, q.z - g.z);
      const span = Math.max(g.x1 - g.x0, g.z1 - g.z0);
      const free = !P.collides(q.x, (q.y || 0) + 0.5, q.z);
      ok(inGate(q, g) && free && (span < 8 || dist > 2.4), `${g.id} pega rente à parede a ${dist.toFixed(1)} m do centro antigo${free ? '' : ' (colide)'}`);
    }
    const filled = fillPops(seen, g.pop);
    seen.length = 0;
    for (const id of filled) seen.push(id);
    if (zombiesAwake(seen)) awake = true;
  }
  ok(seen.length === PIT.bays.length && awake && zombiesAwake(seen), `correndo na parede os zumbis acordam e os grupos fecham (${seen.join(',')})`);
  const skipped = scriptRun({ finish: 40 }).filter((e) => e.k !== 'pop');
  const at = skipped.findIndex((e) => e.k === 'start');
  skipped.splice(at + 1, 0, { k: 'pop', bay: 'pulo', t: 0.05 });
  const rushed = rankedRun(skipped);
  ok(rushed.ranked && rushed.pops.length === PIT.bays.length && zombiesAwake(rushed.pops), 'o servidor completa o gate pulado e a chegada aceita');
  ok(!zombiesAwake(['patio', 'patio2']) && zombiesAwake(fillPops([], 'passa')), 'os zumbis só correm a partir do patamar');
}
  ok(P.collides(12.2, 1.5, -22.15) && !Popen.collides(12.2, 1.5, -22.15), 'o portão dos fundos começa fechado e, aberto, a boca fica livre');
  ok(P.collides(7.4, 4.8, -18), 'o muro esquerdo da sala passa da altura da torre');
{
  const aim = (x, z, y) => {
    const dx = 11.4 - x, dy = 4.9 - y, dz = -16.9 - z;
    const L = Math.hypot(dx, dy, dz);
    return P.rayWorld({ x, y, z }, { x: dx / L, y: dy / L, z: dz / L }, 40);
  };
  const far = aim(31.8, -26.2, 1.6);
  const near = aim(13.2, -25.6, 1.6);
  ok(typeof far === 'number' && far < 14 && typeof near === 'number' && near < 6, `da disparada o muro e o portão tapam a torre (${typeof far === 'number' ? far.toFixed(1) : '—'}/${typeof near === 'number' ? near.toFixed(1) : '—'})`);
  ok(Popen.losClear({ x: 12.2, y: 1.6, z: -20.6 }, { x: 11.4, y: 4.6, z: -16.9 }), 'já dentro da sala, de frente, a torre fica à vista');
}
  let blocked = null;
  for (const t of pitTargets()) {
    if ((t.y || 0) > 1.2) continue;
    const spots = [t];
    if (t.move) {
      spots.push({ ...t, x: t.move.axis === 'x' ? t.move.min : t.x, z: t.move.axis === 'z' ? t.move.min : t.z });
      spots.push({ ...t, x: t.move.axis === 'x' ? t.move.max : t.x, z: t.move.axis === 'z' ? t.move.max : t.z });
    }
    for (const spot of spots) {
      let best = 99;
      for (const q of samplePath(0.4)) best = Math.min(best, Math.hypot(q.x - spot.x, q.z - spot.z));
      const half = (spot.face === 'x' || spot.face === '-x') ? 1.05 / 2 : 1.05 / 2;
      if (best - half < 0.55) blocked = `${t.id} encosta no eixo (${(best - half).toFixed(2)} m)`;
    }
  }
  ok(!blocked, blocked || 'nenhum alvo cobre o meio do caminho');
  const g0 = PIT.gates.filter((g) => g.pop);
  let closePop = null;
  for (const g of g0) for (const t of pitTargets().filter((t) => t.bay === g.pop)) {
    const d = Math.hypot(t.x - g.x, t.z - g.z);
    if (d < 5) closePop = `${t.id} surge a ${d.toFixed(1)} m`;
  }
  ok(!closePop, closePop || 'nenhum alvo surge a menos de 5 m do gatilho');
  const open = samples.filter((q) => q.clear >= 5).sort((a, b) => a.clear - b.clear);
  console.log('trechos mais estreitos:', open.slice(0, 5).map((q) => `${q.clear.toFixed(1)} m em (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`).join(' | '));
}

{
  const inside = (x, y, z) => {
    if (y > 2.2 && z > 44.4 && z < 55.6 && x > -7 && x < 28.4) return true;
    if (y < 1.6 && x > 27.8 && x < 36.2 && z > 45.4 && z < 55.6) return true;
    if (y < 1.6 && x > 28.4 && x < 35.4 && z > -29.4 && z < 46) return true;
    if (y < 1.6 && z < -21.6 && z > -29.4 && x > 7.8 && x < 35.8) return true;
    let b = 99;
    for (const q of samplePath(0.8)) b = Math.min(b, Math.hypot(q.x - x, q.z - z));
    return b < 7.5 && y < 4.5;
  };
  const fly = (x, z, y, vx, vz, vy) => {
    const e = { pos: { x, y, z }, vel: { x: vx, y: vy, z: vz }, onGround: false, bodyH: 2, bodyR: RADIUS };
    let air = false;
    for (let i = 0; i < 240; i++) {
      P.moveEntity(e, 1 / 60);
      if (e.pos.y > y + 0.2) air = true;
      if (air && e.onGround) break;
    }
    return e.pos;
  };
  const lip = [];
  for (const z of [46.4, 48.5, 50.5, 52.8, 54.5]) lip.push([27.6, z, PIT.deck]);
  lip.push([14, 46.5, PIT.deck], [14, 54.4, PIT.deck], [20, 50.5, PIT.deck]);
  let escaped = null, n = 0;
  for (const [x, z, y] of lip) {
    for (const speed of [0, SPEED, SPEED * PIT.sprint]) {
      for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
        for (const vy of [0, JUMP]) {
          const a = deg * Math.PI / 180;
          const pos = fly(x, z, y, Math.sin(a) * speed, Math.cos(a) * speed, vy);
          n++;
          if (!inside(pos.x, pos.y, pos.z)) { escaped = `saiu em (${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}) desde (${x},${z}) ${deg}° ${speed.toFixed(1)} m/s`; break; }
        }
        if (escaped) break;
      }
      if (escaped) break;
    }
    if (escaped) break;
  }
  ok(!escaped, escaped || `${n} pulos caem dentro do caminho`);
  ok(P.collides(12, 0.02, 50.5), 'embaixo da passarela o volume é cheio, sem sala escondida');
}
ok(hi > 2.9 && lo < 0.2, `sobe e desce (${hi.toFixed(2)} → ${lo.toFixed(2)})`);
{
  const ref = [];
  for (let i = 1; i < PIT.path.length; i++) {
    const a = PIT.path[i - 1], b = PIT.path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.6));
    for (let k = 0; k <= n; k++) ref.push([a.x + (b.x - a.x) * k / n, a.z + (b.z - a.z) * k / n]);
  }
  const near = (x, z) => { let b = 99; for (const q of ref) b = Math.min(b, Math.hypot(q[0] - x, q[1] - z)); return b; };
  const step = 0.9, seen = new Set(), qq = [[PIT.spawn[0], PIT.spawn[1], 0]];
  const key = (a, b) => a + ',' + b;
  seen.add(key(0, 0));
  let worst = 0, guard = 0;
  while (qq.length && guard < 20000) {
    guard++;
    const [x, z, y] = qq.pop();
    worst = Math.max(worst, near(x, z));
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const nx = x + dx, nz = z + dz, k = key(Math.round(nx / step), Math.round(nz / step));
      if (seen.has(k) || Math.abs(nx) > 33 || Math.abs(nz) > 52) continue;
      const g = P.groundAt(nx, nz, y + 0.8);
      if (P.collides(nx, g + 0.02, nz) || g > y + 0.5) continue;
      const mx = (x + nx) / 2, mz = (z + nz) / 2, mg = P.groundAt(mx, mz, y + 0.8);
      if (P.collides(mx, mg + 0.02, mz)) continue;
      seen.add(k); qq.push([nx, nz, g]);
    }
  }
  ok(worst <= 8.2, `sem atalho: o chão alcançável fica a até ${worst.toFixed(1)} m do eixo`);
}

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

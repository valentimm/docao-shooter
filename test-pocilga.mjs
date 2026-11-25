// Regras da Pocilga: oito etapas, só a Pistolinha, faca no javali perto, tempo mínimo.
// Uso: node test-pocilga.mjs
import { PIT, pitEnemies, pitTargets, pitCivils, pitMovers, boardAabb, rayAabb, minPlausible, starsOf, suggestion, formatPit, inspectRun, rankedRun, scriptRun, pathStats, samplePath, moverAt } from './shared/pocilga.js';
import { KNIFE } from './shared/rules.js';
import { getMap } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(pitEnemies().length === 23 && pitCivils().length === 5, `23 javalis e 5 civis (${pitEnemies().length}/${pitCivils().length})`);
ok(PIT.bays.length === 5, 'cinco etapas, na ordem do percurso');
ok(pitMovers().length >= 10 && pitMovers().filter((t) => t.kind === 'civil').length >= 2, `vários no trilho, inclusive civis (${pitMovers().map((t) => t.id).join(',')})`);
ok(pitTargets().some((t) => t.close), 'um javali fica ao alcance da faca');
const stats = pathStats();
const start = PIT.path[0], end = PIT.path[PIT.path.length - 1];
const back = Math.hypot(start.x - end.x, start.z - end.z);
ok(back < 6, `chegada colada na largada (${back.toFixed(1)} m)`);
ok(stats.total > 160 && stats.dash > 25, `o caminho ficou longo (${stats.total} m, disparada ${stats.dash} m)`);
ok(PIT.path.some((p) => p.y > 2.8) && PIT.path.some((p) => p.drop), 'sobe a escada e pula da passarela');
ok(PIT.rise >= 0.15 && PIT.rise <= 0.25 && PIT.lead >= 10, `subida ${PIT.rise}s, gatilho pensado a ${PIT.lead} m`);
const floor = minPlausible();
ok(floor > 18 && floor + 18 < PIT.star3, `mínimo físico ${floor.toFixed(3)} s, folgado abaixo das 3 estrelas`);
ok(starsOf(PIT.star3, 0, true) === 3 && starsOf(PIT.star3 + 0.01, 0, true) === 2 && starsOf(PIT.star2, 1, true) === 2 && starsOf(PIT.star2 + 0.01, 0, true) === 1, `faixas ${formatPit(PIT.star3)} e ${formatPit(PIT.star2)}`);
ok(starsOf(32, 1, true) === 2 && suggestion(3).id === 'javali', 'civil tira a 3ª estrela; sugestão Javali');
ok(formatPit(PIT.star3) === '0:45.00' && formatPit(PIT.star2) === '0:58.00', 'relógio');
for (const g of PIT.gates) {
  if (!g.pop) continue;
  const far = Math.min(...pitTargets().filter((t) => t.bay === g.pop).map((t) => Math.hypot(t.x - g.x, t.z - g.z)));
  ok(far >= 8, `${g.id} arma a ${far.toFixed(1)} m do grupo`);
}
for (const t of pitTargets()) {
  let near = 99;
  for (const q of samplePath(0.45)) near = Math.min(near, Math.hypot(q.x - t.x, q.z - t.z));
  const gate = PIT.gates.find((g) => g.pop === t.bay);
  const dx = gate.x - t.x, dz = gate.z - t.z;
  const facing = t.face === -1 ? dz < -0.5 : t.face === 1 ? dz > 0.5 : t.face === 'x' ? dx > 0.5 : dx < -0.5;
  const loose = !!(t.move || (t.y || 0) > 1.2);
  ok((loose ? near <= 6.4 : near <= 1.9) && facing, `${t.id} na frente de quem corre (${near.toFixed(1)} m do eixo)`);
}

const clean = rankedRun(scriptRun({ finish: 32 }));
ok(clean.ranked && clean.stars === 3 && clean.civs === 0 && clean.down.length === 23, `limpo em 32 s = 3 estrelas (${clean.final})`);
const nipped = rankedRun(scriptRun({ finish: 32, civs: ['c1'] }));
ok(nipped.ranked && nipped.stars === 2 && nipped.final === 35 && nipped.blocked3, 'civil soma 3 s e bloqueia a 3ª');
const slow = rankedRun(scriptRun({ finish: PIT.star2 + 6 }));
ok(slow.ranked && slow.stars === 1, `acima de ${formatPit(PIT.star2)} = 1 estrela (${slow.final})`);
const forgot = inspectRun(scriptRun({ finish: 40, skip: ['e15'] }));
ok(!forgot.finished && forgot.reason === 'alvo' && forgot.missed.includes('e15'), 'javali em pé trava a chegada');
const rifle = rankedRun(scriptRun({ finish: 40, rifle: true }));
ok(!rifle.finished && rifle.missed.length === 23, 'tiro que não é a Pistolinha não derruba');
const knifed = rankedRun(scriptRun({ finish: 34, knife: ['e15'] }));
ok(knifed.ranked && knifed.down.includes('e15') && knifed.stars === 3, 'a faca derruba o javali perto');
ok(KNIFE === PIT.knife, 'a faca do circuito é a faca do jogo');
const fast = rankedRun(scriptRun({ finish: floor - 0.05 }));
ok(fast.finished && !fast.ranked && fast.reason === 'rápido', 'tempo impossível fica fora do ranking');
ok(rankedRun(scriptRun({ finish: floor })).ranked, 'no mínimo físico o ranking aceita');
ok(inspectRun([{ k: 'start', t: 0 }, { k: 'swap', w: 4, t: 1 }]).reason === 'diário', 'troca de arma não faz parte do diário');
ok(inspectRun([{ k: 'start', t: 0 }, { k: 'pop', bay: 'sala', t: 1 }]).reason === 'ordem', 'pular o pátio invalida');

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
let stuck = null, hi = 0, lo = 99;
for (const q of samplePath(0.35)) {
  const g = P.groundAt(q.x, q.z, q.y + 0.5);
  hi = Math.max(hi, g); lo = Math.min(lo, g);
  if (Math.abs(g - q.y) > 0.55 || P.collides(q.x, g + 0.02, q.z)) { stuck = { ...q, g, hit: P.collides(q.x, g + 0.02, q.z) }; break; }
}
ok(!stuck, `eixo andável na escada, na passarela e no pulo${stuck ? ` (travou em ${stuck.x.toFixed(1)},${stuck.z.toFixed(1)} y=${stuck.y.toFixed(2)} chão=${stuck.g.toFixed(2)} colide=${stuck.hit})` : ` (alto ${hi.toFixed(2)} m)`}`);
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

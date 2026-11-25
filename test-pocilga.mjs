// Regras da Pocilga: oito etapas, só a Pistolinha, faca no javali perto, tempo mínimo.
// Uso: node test-pocilga.mjs
import { PIT, pitEnemies, pitTargets, pitCivils, pitMovers, boardAabb, rayAabb, minPlausible, starsOf, suggestion, formatPit, inspectRun, rankedRun, scriptRun, pathStats, samplePath, moverAt } from './shared/pocilga.js';
import { KNIFE } from './shared/rules.js';
import { getMap } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(pitEnemies().length === 24 && pitCivils().length === 5, `24 javalis e 5 civis (${pitEnemies().length}/${pitCivils().length})`);
ok(PIT.bays.length === 7, 'sete salas, na ordem do percurso');
ok(pitMovers().length >= 2 && pitMovers().some((t) => t.id === 'e4') && pitMovers().some((t) => t.id === 'e22'), `trilhos do telhado e do carro (${pitMovers().map((t) => t.id).join(',')})`);
ok(pitTargets().some((t) => t.close), 'um javali fica ao alcance da faca');
const stats = pathStats();
const start = PIT.path[0], end = PIT.path[PIT.path.length - 1];
const back = Math.hypot(start.x - end.x, start.z - end.z);
ok(back < 6, `chegada colada na largada (${back.toFixed(1)} m)`);
ok(stats.total > 50 && stats.dash > 10, `o caminho dobra e dispara no fim (${stats.total} m, disparada ${stats.dash} m)`);
ok(PIT.path.some((p) => p.y > 2.8) && PIT.path.some((p) => p.drop), 'sobe a escada e pula da passarela');
const floor = minPlausible();
ok(floor > 8 && floor < PIT.star3 - 8, `mínimo físico ${floor.toFixed(3)} s, folgado abaixo das 3 estrelas`);
ok(starsOf(PIT.star3, 0, true) === 3 && starsOf(PIT.star3 + 0.01, 0, true) === 2 && starsOf(PIT.star2, 1, true) === 2 && starsOf(PIT.star2 + 0.01, 0, true) === 1, 'faixas 0:35 e 0:45');
ok(starsOf(32, 1, true) === 2 && suggestion(3).id === 'javali', 'civil tira a 3ª estrela; sugestão Javali');
ok(formatPit(35) === '0:35.00' && formatPit(45) === '0:45.00', 'relógio');

const clean = rankedRun(scriptRun({ finish: 32 }));
ok(clean.ranked && clean.stars === 3 && clean.civs === 0 && clean.down.length === 24, `limpo em 32 s = 3 estrelas (${clean.final})`);
const nipped = rankedRun(scriptRun({ finish: 32, civs: ['c1'] }));
ok(nipped.ranked && nipped.stars === 2 && nipped.final === 35 && nipped.blocked3, 'civil soma 3 s e bloqueia a 3ª');
const slow = rankedRun(scriptRun({ finish: 50 }));
ok(slow.ranked && slow.stars === 1, `acima de 0:45 = 1 estrela (${slow.final})`);
const forgot = inspectRun(scriptRun({ finish: 40, skip: ['e15'] }));
ok(!forgot.finished && forgot.reason === 'alvo' && forgot.missed.includes('e15'), 'javali em pé trava a chegada');
const rifle = rankedRun(scriptRun({ finish: 40, rifle: true }));
ok(!rifle.finished && rifle.missed.length === 24, 'tiro que não é a Pistolinha não derruba');
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
const side = boardAabb(pitTargets().find((t) => t.id === 'e7'));
ok(side.maxZ - side.minZ > side.maxX - side.minX, 'na sala a placa fica de frente pra quem vira à esquerda');

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

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

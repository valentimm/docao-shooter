// Regras da Pocilga (sem navegador): estrelas, civil, alvo esquecido, troca de arma, tempo mínimo, caminho livre.
// Uso: node test-pocilga.mjs
import { PIT, BOARD, pitEnemies, pitTargets, boardAabb, rayAabb, minPlausible, starsOf, suggestion, formatPit, inspectRun, rankedRun, scriptRun, pitAabbs } from './shared/pocilga.js';
import { SPEED } from './shared/rules.js';
import { getMap } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(pitEnemies().length === 10 && pitTargets().filter((t) => t.kind === 'civil').length === 3, '10 javalis e 3 civis');
const floorSec = Math.round(((PIT.sprintZ - PIT.startZ) / SPEED + (PIT.finishZ - PIT.sprintZ) / (SPEED * PIT.sprint) + pitEnemies().length * 0.04) * 1000) / 1000;
ok(minPlausible() === floorSec && floorSec > 10 && floorSec < 13, `mínimo físico ${minPlausible().toFixed(3)} s`);
ok(starsOf(42, 0, true) === 3 && starsOf(42.01, 0, true) === 2 && starsOf(60, 0, true) === 2 && starsOf(60.01, 0, true) === 1, 'faixas 42 / 60 no tempo final');
ok(starsOf(30, 1, true) === 2 && starsOf(90, 2, true) === 1 && starsOf(10, 0, false) === 0, 'civil tira as 3 estrelas; sem chegada não há estrela');
ok(suggestion(3).id === 'javali' && suggestion(2).id === 'ceva' && suggestion(1).id === 'leitao', 'sugestão do Docão acompanha as estrelas');
ok(formatPit(42) === '0:42.00' && formatPit(65.5) === '1:05.50', 'relógio m:ss.cc');

const clean = rankedRun(scriptRun({ finish: 36 }));
ok(clean.ranked && clean.stars === 3 && clean.civs === 0 && Math.abs(clean.final - 36) < 1e-9, `limpo em 36 s = 3 estrelas (${clean.final})`);
const nipped = rankedRun(scriptRun({ finish: 30, civs: ['c1'] }));
ok(nipped.ranked && nipped.stars === 2 && nipped.civs === 1 && Math.abs(nipped.final - 33) < 1e-9 && nipped.blocked3, `civil soma ${PIT.civPenalty} s e bloqueia a 3ª (${nipped.final})`);
const slow = rankedRun(scriptRun({ finish: 75, civs: ['c2', 'c3'] }));
ok(slow.ranked && slow.stars === 1 && Math.abs(slow.final - 81) < 1e-9, `acima de 60 s = 1 estrela (${slow.final})`);
const edge = rankedRun(scriptRun({ finish: 42 }));
ok(edge.ranked && edge.stars === 3 && edge.final === 42, '42.00 s limpo ainda é 3 estrelas');

const forgot = inspectRun(scriptRun({ finish: 40, skip: ['e8'] }));
ok(!forgot.finished && forgot.reason === 'alvo' && forgot.missed.includes('e8') && forgot.stars === 0, 'javali em pé trava a chegada');
const noGun = rankedRun(scriptRun({ finish: 40, latePistol: true }));
ok(!noGun.finished && noGun.missed.some((id) => id.startsWith('e7') || id === 'e7'), 'sala da pistola não cai com o fuzil');
const noSwap = rankedRun(scriptRun({ finish: 40, swap: false }));
ok(!noSwap.finished && noSwap.reason === 'arma', 'sem a troca a chegada não vale');
const fast = rankedRun(scriptRun({ finish: minPlausible() - 0.05 }));
ok(fast.finished && fast.stars === 3 && !fast.ranked && fast.reason === 'rápido', 'tempo impossível fecha o curso e fica fora do ranking');
const floor = rankedRun(scriptRun({ finish: minPlausible() }));
ok(floor.ranked && floor.reason === 'ok', 'no mínimo físico o ranking aceita');

const backwards = [{ k: 'start', t: 0 }, { k: 'pop', bay: 'b1', t: 1 }, { k: 'pop', bay: 'b2', t: 0.5 }];
ok(inspectRun(backwards).reason === 'ordem', 'tempo que volta invalida o diário');
const skipBay = scriptRun({ finish: 40 });
skipBay.splice(1, 1); // tira o pop da primeira sala e deixa o resto
ok(!inspectRun(skipBay).ok, 'pular a primeira sala invalida');

// O papelão em pé para a bala. Deitado não entra nesta caixa.
const e2 = pitTargets().find((t) => t.id === 'e2');
const box = boardAabb(e2);
const dir = { x: e2.x - 0, y: (BOARD.y + BOARD.h * 0.5) - 1.6, z: e2.z - 2 };
const len = Math.hypot(dir.x, dir.y, dir.z);
const hit = rayAabb(0, 1.6, 2, dir.x / len, dir.y / len, dir.z / len, box, 30);
ok(hit != null && hit < 12, `tiro no Javali do meio acerta (${hit && hit.toFixed(2)} m)`);
const over = rayAabb(0, 4, 2, 0, 0, 1, box, 30);
ok(over == null, 'por cima do papelão a bala passa');

// O vão central, do spawn até a faixa, não entra em parede.
const boxes = pitAabbs();
const bodyHits = (x, z) => boxes.some(([x0, y0, z0, x1, y1, z1]) => {
  if (y1 < 0.2 || y0 > 1.7) return false;
  const cx = Math.max(x0, Math.min(x, x1)), cz = Math.max(z0, Math.min(z, z1));
  return (x - cx) ** 2 + (z - cz) ** 2 < 0.42 ** 2;
});
let blockedAt = null;
for (let z = PIT.spawn[1]; z <= PIT.finishZ - 0.3; z += 0.35) {
  if (bodyHits(0, z) || bodyHits(0.7, z) || bodyHits(-0.7, z)) { blockedAt = z; break; }
}
ok(!blockedAt, `corredor central livre até a chegada${blockedAt ? ` (travou em z=${blockedAt.toFixed(1)})` : ''}`);
for (const t of pitTargets()) {
  const room = PIT.rooms.find((r) => t.z >= r.z0 && t.z <= r.z1);
  ok(!!room && Math.abs(t.x) + BOARD.w / 2 < room.hx - 0.2, `${t.id} dentro da sala (${room && room.id})`);
}

const map = getMap(PIT.map);
ok(map && map.course && map.id === 'pocilga' && map.spawns.length === 1, 'mapa dedicado, fora do rodízio');
const solids = mapSolids(map), P = createPhysics(solids, map.size, null);
const g = P.groundAt(0, -12, 1);
ok(Math.abs(g) < 0.05 && !P.collides(0, g, -12), `spawn no chão (y=${g.toFixed(2)})`);
let stuck = null;
for (let z = -11; z <= 69.5 && !stuck; z += 0.5) if (P.collides(0, g, z)) stuck = z;
ok(!stuck, `física do mapa deixa passar no eixo${stuck ? ` (z=${stuck})` : ''}`);

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

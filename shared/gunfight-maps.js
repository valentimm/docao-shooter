// ============================================================
//  Mapas e spawns do Gunfight. Só dados e uma função pura:
//  quem implementa a regra (shared/gunfight.js) escolhe o mapa
//  e passa sideSwapped. Este arquivo não importa o mapa nem a regra.
//
//  map.gf = { a: [[x, z, y, yaw], ...], b: [...], zone: { x, z, r } }
//  yaw: frente do Docão, a mesma convenção do jogo (sin no X, cos no Z),
//  apontando pra zona / pro lado inimigo.
//  Time 0 (A) usa `a` com sideSwapped falso e `b` quando os lados trocam
//  (rounds 3–4, 7–8, …). Time 1 é o contrário. Quem chama passa o booleano.
// ============================================================

// Por formato (jogadores de cada time). 2v2 inclui os currais do X1 como opção apertada.
export const GF_MAP_POOL = {
  1: ['x1-chiqueiro', 'x1-curral', 'x1-pinguela'],
  2: ['galpao-assalto', 'bar-cheers', 'patio-ferrugem', 'x1-chiqueiro', 'x1-curral', 'x1-pinguela'],
  3: ['vizinhanca-cheers', 'arena', 'posto-nevasca', 'breeze-standoff', 'dust2'],
  4: ['vizinhanca-cheers', 'arena', 'posto-nevasca', 'breeze-standoff', 'dust2'], // Breeze/Dust 2: ficam fora do sorteio por serem pesados
};
export const GF_MAPS = GF_MAP_POOL;

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// [x, z, y, yaw] ou { x, z, y, yaw } → cópia simples. y ausente vale 0.
export function gfPoint(p) {
  if (Array.isArray(p)) return { x: num(p[0]), y: num(p[2]), z: num(p[1]), yaw: num(p[3]) };
  if (!p) return null;
  return { x: num(p.x), y: num(p.y), z: num(p.z), yaw: num(p.yaw) };
}

const teamA = (team) => team === 0 || team === 'a' || team === 'A';

// n pontos do lado certo. n omitido devolve o lado inteiro. Lista curta devolve o que existe.
export function gfSpawns(map, team, sideSwapped, n) {
  const gf = map && map.gf;
  if (!gf) return [];
  const list = (teamA(team) !== !!sideSwapped ? gf.a : gf.b) || [];
  const k = n == null ? list.length : Math.max(0, n | 0);
  return list.slice(0, k).map(gfPoint).filter(Boolean);
}

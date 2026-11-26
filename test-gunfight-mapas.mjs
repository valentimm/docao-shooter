// Spawns do Gunfight contra a geometria real do mapa. Uso: node test-gunfight-mapas.mjs
import { MAPS } from './maps.js';
import { GF_MAP_POOL, GF_MAPS, gfSpawns } from './shared/gunfight-maps.js';
import { mapSolids, createPhysics, resolveFall, killFloorY } from './shared/physics.js';
import { EYE, RADIUS } from './shared/rules.js';
import { setGlbBoxes } from './glb-data.js';
import { BREEZE_ID } from './breeze-data.js';
import { DUST2_ID } from './dust2-data.js';
import BREEZE_BOXES from './assets/maps/breeze/breeze-collision.json' with { type: 'json' };
import DUST2_BOXES from './assets/maps/dust2/dust2-collision.json' with { type: 'json' };
setGlbBoxes(MAPS.find((m) => m.id === BREEZE_ID), BREEZE_BOXES); // Breeze: colisão vem do JSON (igual ao servidor)
setGlbBoxes(MAPS.find((m) => m.id === DUST2_ID), DUST2_BOXES); // Dust 2: colisão vem do JSON (igual ao servidor)

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const byId = new Map(MAPS.map((m) => [m.id, m]));
const ang = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const OUT = new Set(['hotmilk', 'hotmilk-noite', 'rodizio', 'fazenda-assombrada', 'estande', 'torres-do-barril', 'morro-leitao', 'duas-pocilgas', 'celeiro-industrial', 'mercadao']);

ok(GF_MAPS === GF_MAP_POOL, 'GF_MAPS e GF_MAP_POOL são o mesmo pool');
for (const fmt of [1, 2, 3, 4]) ok(Array.isArray(GF_MAP_POOL[fmt]) && GF_MAP_POOL[fmt].length >= 3, `formato ${fmt}v${fmt} tem pelo menos 3 mapas`);
ok(GF_MAP_POOL[1].every((id) => id.startsWith('x1-')) && GF_MAP_POOL[1].length === 3, '1v1: só os 3 currais do X1');
ok(['galpao-assalto', 'bar-cheers', 'patio-ferrugem'].every((id) => GF_MAP_POOL[2].includes(id)), '2v2: Galpão, Bar e Pátio');
ok(GF_MAP_POOL[1].every((id) => GF_MAP_POOL[2].includes(id)), '2v2: currais do X1 como opção apertada');
for (const id of ['vizinhanca-cheers', 'arena', 'posto-nevasca']) ok(GF_MAP_POOL[3].includes(id) && GF_MAP_POOL[4].includes(id), `${id} entra em 3v3 e 4v4`);
const pooled = new Set([1, 2, 3, 4].flatMap((f) => GF_MAP_POOL[f]));
for (const id of OUT) ok(!pooled.has(id), `${id} fica fora do Gunfight`);

const seen = new Set();
for (const fmt of [1, 2, 3, 4]) {
  for (const id of GF_MAP_POOL[fmt]) {
    const map = byId.get(id);
    ok(!!map && map.gf && Array.isArray(map.gf.a) && Array.isArray(map.gf.b) && map.gf.zone, `${id} tem bloco gf`);
    if (!map || !map.gf) continue;
    const need = map.x1 ? 2 : Math.max(4, fmt);
    ok(map.gf.a.length >= need && map.gf.b.length >= need, `${id} no ${fmt}v${fmt}: ${map.gf.a.length}/${map.gf.b.length} pontos (pede ${need})`);
    const got = gfSpawns(map, 0, false, fmt);
    ok(got.length === Math.min(fmt, map.gf.a.length) && got[0] && got[0].x === map.gf.a[0][0], `${id}: gfSpawns(time A, sem troca, ${fmt}) lê o lado a`);
    if (seen.has(id)) continue;
    seen.add(id);
    const solids = mapSolids(map);
    const fall = map.fall ? resolveFall(map) : null;
    const P = createPhysics(solids, map.size, fall);
    const kill = killFloorY(fall, map);
    const [hx, hz] = map.size;
    const stand = (x, z, yHint = 0.4) => {
      if (Math.abs(x) > hx - RADIUS || Math.abs(z) > hz - RADIUS) return null;
      const g = P.groundAt(x, z, yHint);
      if (!(g > kill + 1) || g > 1.25) return null;
      if (P.collides(x, g, z)) return null;
      if (P.ceilingAt(x, z, g + 0.2) < g + 1.85) return null;
      return g;
    };
    const lift = (list) => list.map((p) => { const q = Array.isArray(p) ? { x: p[0], y: p[2] || 0, z: p[1], yaw: p[3] || 0 } : p; return { ...q, g: stand(q.x, q.z, (q.y || 0) + 0.35) }; });
    const A = lift(map.gf.a), B = lift(map.gf.b);
    const bad = [...A, ...B].filter((p) => p.g == null);
    ok(!bad.length, `${id}: todo spawn fora de sólido, no chão e com teto ${bad.map((p) => `(${p.x},${p.z})`).join(' ')}`);
    const zone = map.gf.zone;
    const zg = stand(zone.x, zone.z, 0.4);
    ok(zg != null && zone.r > 0.8 && zone.r < 8, `${id}: zona (${zone.x},${zone.z}) r=${zone.r} fora de sólido, chão ${zg == null ? 'nenhum' : zg.toFixed(2)}`);
    const dist = (p) => Math.hypot(p.x - zone.x, p.z - zone.z);
    const avg = (ps) => ps.reduce((s, p) => s + dist(p), 0) / ps.length;
    const minD = (ps) => { let m = Infinity; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) m = Math.min(m, Math.hypot(ps[i].x - ps[j].x, ps[i].z - ps[j].z)); return m; };
    if (A.every((p) => p.g != null) && B.every((p) => p.g != null)) {
      const da = avg(A), db = avg(B), diff = Math.abs(da - db) / Math.max(da, db);
      ok(diff < 0.15, `${id}: distância média até a zona A ${da.toFixed(2)} m, B ${db.toFixed(2)} m, diferença ${(diff * 100).toFixed(1)}%`);
      ok(minD(A) >= 1.5 && minD(B) >= 1.5, `${id}: aliados a pelo menos 1,5 m (A ${minD(A).toFixed(2)}, B ${minD(B).toFixed(2)})`);
      const yawBad = [...A, ...B].filter((p) => Math.abs(ang(p.yaw, Math.atan2(zone.x - p.x, zone.z - p.z))) > 0.02);
      ok(!yawBad.length, `${id}: yaw olha a zona ${yawBad.map((p) => `(${p.x},${p.z})`).join(' ')}`);
      let los = 0, pairs = 0;
      for (const a of A) for (const b of B) { pairs++; if (P.losClear({ x: a.x, y: a.g + EYE, z: a.z }, { x: b.x, y: b.g + EYE, z: b.z })) los++; }
      if (map.x1) console.log(`     ${id}: LOS de olho ${los}/${pairs} (cobertura mais baixa que 1,6 m)`);
      else ok(los === 0, `${id}: nenhum par nasce com linha de visão direta (${los}/${pairs})`);
      console.log(`     ${id}: A [${A.map((p) => dist(p).toFixed(1)).join(', ')}]  B [${B.map((p) => dist(p).toFixed(1)).join(', ')}]`);
    }
    const copy = gfSpawns(map, 0, false, 1);
    copy[0].x = 12345;
    ok(map.gf.a[0][0] !== 12345, `${id}: gfSpawns devolve cópia`);
    const flip = gfSpawns(map, 0, true, 2);
    const back = gfSpawns(map, 1, false, 2);
    const home = gfSpawns(map, 'A', false, 2);
    ok(flip.length === Math.min(2, map.gf.b.length) && flip[0].x === map.gf.b[0][0] && flip[0].z === map.gf.b[0][1], `${id}: troca de lado manda o time A pro lado b`);
    ok(back[0].x === flip[0].x && back[0].z === flip[0].z, `${id}: time B sem troca usa o mesmo lado b`);
    ok(home[0].x === map.gf.a[0][0] && gfSpawns(map, 'b', true, 1)[0].x === map.gf.a[0][0], `${id}: time 'A'/'b' e a troca dupla voltam pro lado a`);
    ok(gfSpawns(map, 0, false, 0).length === 0 && gfSpawns(map, 0, false, 99).length === map.gf.a.length, `${id}: n=0 vazio, n grande devolve o lado inteiro`);
  }
}
ok(gfSpawns({}, 0, false, 2).length === 0 && gfSpawns(null, 1, true).length === 0, 'mapa sem gf devolve lista vazia');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

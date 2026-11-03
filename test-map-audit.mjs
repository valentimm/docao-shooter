// Auditoria dos mapas sem navegador (mesma física/nav do servidor): andares, área aberta, linhas de sniper,
// spawns/itens válidos, zonas da Dominação (dentro de prédio / telhado) e bots subindo andares numa simulação do servidor.
// Uso: node test-map-audit.mjs [id,id]   (DUMP=dir grava JSON pra renderizar a planta com tools/planta.py)
import { MAPS } from './maps.js';
import { mapSolids, createPhysics } from './shared/physics.js';
import { buildNav } from './nav.js';
import { pickZone } from './shared/domination.js';
import { Game } from './server/src/game.js';
import { writeFileSync, mkdirSync } from 'fs';
const ids = process.argv[2] ? process.argv[2].split(',') : MAPS.map((m) => m.id);
const DUMP = process.env.DUMP; if (DUMP) mkdirSync(DUMP, { recursive: true });
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (const id of ids) {
  const map = MAPS.find((m) => m.id === id); console.log(`\n=== ${id} (${map.name})`);
  const solids = mapSolids(map), P = createPhysics(solids, map.size, map.fall || null);
  const spawns = map.spawns.map(([x, z, y = 0]) => ({ x, y: P.groundAt(x, z, y + 0.3), z }));
  const t0 = performance.now();
  const nav = buildNav({ hx: map.size[0], hz: map.size[1], spacing: map.navSpacing || 2, collides: P.collides, groundAt: P.groundAt, solids, topAt: P.topAt, seeds: spawns.map((s) => [s.x, s.y, s.z]), extra: map.waypoints || [], avoid: map.navAvoid || [] });
  const navMs = performance.now() - t0, good = nav.good;
  const roofed = (n) => P.ceilingAt(n.x, n.z, n.y + 2.0) < n.y + 6; // tem algo em cima (dentro de prédio / debaixo de laje)
  const hi = good.filter((n) => n.y > 2.5), inside = good.filter(roofed);
  const levels = [...new Set(good.map((n) => Math.round(n.y)))].sort((a, b) => a - b);
  console.log(`nav: ${good.length} nós bons (${nav.nodes.length} total), ${navMs.toFixed(0)} ms · níveis ${levels.join('/')} · alto ${hi.length} · coberto ${inside.length}`);
  ok(hi.length >= 25, `andares altos alcançáveis (${hi.length} nós acima de 2,5 m)`);
  ok(inside.length >= 25, `interiores alcançáveis (${inside.length} nós com teto)`);
  // área aberta: maior distância de um nó do chão até a cobertura mais próxima (caixa com ≥ 1,1 m acima do pé)
  const cover = solids.filter((s) => s.max.y - s.min.y > 0.9 && s.max.x - s.min.x < 200);
  let worst = 0, worstAt = null;
  const onSmall = (n) => solids.some((s) => !s.ramp && Math.abs(s.max.y - n.y) < 0.05 && n.x >= s.min.x - 0.05 && n.x <= s.max.x + 0.05 && n.z >= s.min.z - 0.05 && n.z <= s.max.z + 0.05 && (s.max.x - s.min.x) * (s.max.z - s.min.z) < 4.5);
  for (const n of good) {
    if (onSmall(n)) continue; // em cima de caixote/mureta: escolha de quem sobe, não é "campo aberto"
    let d = Infinity; for (const s of cover) { if (s.max.y < n.y + 0.9 || s.min.y > n.y + 2) continue; const dx = Math.max(s.min.x - n.x, 0, n.x - s.max.x), dz = Math.max(s.min.z - n.z, 0, n.z - s.max.z); d = Math.min(d, Math.hypot(dx, dz)); }
    const [hx, hz] = map.size; d = Math.min(d, hx - Math.abs(n.x), hz - Math.abs(n.z));
    if (d > worst) { worst = d; worstAt = n; }
  }
  ok(worst <= (map.openMax || 7), `sem campo aberto: ponto mais longe de cobertura a ${worst.toFixed(1)} m (${worstAt && [worstAt.x.toFixed(0), worstAt.y.toFixed(1), worstAt.z.toFixed(0)]})`);
  // linhas de visão (olho a 1,6 m)
  let maxLos = 0, lanes = 0, pairs = 0, seen = 0;
  for (let i = 0; i < 6000; i++) {
    const a = good[Math.floor(rnd() * good.length)], b = good[Math.floor(rnd() * good.length)]; const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); if (d < 10) continue;
    pairs++; if (P.losClear({ x: a.x, y: a.y + 1.6, z: a.z }, { x: b.x, y: b.y + 1.6, z: b.z })) { seen++; if (d > maxLos) maxLos = d; if (d > 35) lanes++; }
  }
  const exp = seen / Math.max(1, pairs);
  ok(maxLos >= (map.laneMin || 35), `existe linha longa de Sniper (${maxLos.toFixed(0)} m)`);
  ok(exp <= (map.expMax || 0.3), `visão quebrada: ${(exp * 100).toFixed(0)}% dos pares (≥10 m) se veem`);
  // spawns e itens
  const bad = []; const chk = (x, z, y, what) => { const g = P.groundAt(x, z, (y || 0) + 0.3); const n = nav.nearest(x, g, z); if (P.collides(x, g, z) || !n || Math.hypot(n.x - x, n.z - z) > 2.2 || Math.abs(n.y - g) > 0.5) bad.push(`${what}@${x},${z},${y || 0}`); };
  map.spawns.forEach(([x, z, y]) => chk(x, z, y, 'spawn')); map.pickups.forEach(([t, x, z, y]) => chk(x, z, y, t));
  ok(!bad.length, `spawns/itens em lugar andável e ligado ao grafo ${bad.join(' ')}`);
  let minSp = Infinity; for (let i = 0; i < spawns.length; i++) for (let j = i + 1; j < spawns.length; j++) minSp = Math.min(minSp, Math.hypot(spawns[i].x - spawns[j].x, spawns[i].z - spawns[j].z) + Math.abs(spawns[i].y - spawns[j].y));
  ok(spawns.length >= 10 && minSp >= 4, `${spawns.length} spawns, distância mínima ${minSp.toFixed(1)} m`);
  // zonas
  const zs = []; let prev = null; for (let i = 0; i < 80; i++) { const z = pickZone(nav, prev, rnd); zs.push(z); prev = z; }
  const zIn = zs.filter((z) => roofed(z)).length, zHi = zs.filter((z) => z.y > 2.5).length;
  ok(zs.every((z) => good.some((n) => Math.abs(n.x - z.x) < 0.01 && Math.abs(n.z - z.z) < 0.01)), `zonas sempre em nó andável (${zIn}/80 cobertas, ${zHi}/80 no alto)`);
  ok(zIn + zHi > 0, 'zona pode aparecer dentro de prédio ou no alto');
  // bots na simulação do servidor
  const g = new Game({ code: 'TEST', map: id, max: 8, fillBots: true, mode: 'dm' }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' });
  a.alive = false; a.respawnAt = 1e9; a.connected = true; // espectador
  const bots = [...g.ents.values()].filter((e) => e.bot); const st = new Map(bots.map((b) => [b, { hi: 0, n: 0, maxY: 0, trans: 0, lastHi: false }]));
  let n = 0; while (g.state === 'playing' && n < 20 * 150) { fake += 0.05; g.tick(); n++; if (n % 10) continue;
    for (const b of bots) { if (!b.alive) continue; const s = st.get(b); s.n++; const h = b.pos.y > 2.5; if (h) s.hi++; if (h !== s.lastHi) s.trans++; s.lastHi = h; s.maxY = Math.max(s.maxY, b.pos.y); } }
  const tot = [...st.values()].reduce((a, s) => ({ hi: a.hi + s.hi, n: a.n + s.n, trans: a.trans + s.trans }), { hi: 0, n: 0, trans: 0 });
  const climbers = [...st.values()].filter((s) => s.maxY > 2.5).length;
  console.log(`bots: ${(100 * tot.hi / tot.n).toFixed(0)}% do tempo no alto, ${tot.trans} trocas de andar, ${climbers}/${bots.length} subiram · abates ${bots.map((b) => b.kills).join(',')} · travadas ${bots.reduce((s, b) => s + (b.stuckCount || 0), 0)}`);
  ok(climbers >= Math.ceil(bots.length / 2) && tot.trans >= 6, `bots sobem e descem andares (${climbers}/${bots.length} subiram, ${tot.trans} trocas)`);
  ok(bots.reduce((s, b) => s + b.kills, 0) >= 5, 'bots se encontram e lutam');
  if (DUMP) writeFileSync(`${DUMP}/${id}.json`, JSON.stringify({ id, size: map.size, solids: solids.map((s) => [s.min.x, s.min.y, s.min.z, s.max.x, s.max.y, s.max.z, s.ramp ? s.ramp.axis + s.ramp.dir : '']), nodes: good.map((n) => [n.x, n.y, n.z, roofed(n) ? 1 : 0]), spawns: spawns.map((s) => [s.x, s.y, s.z]), zones: zs.map((z) => [z.x, z.y, z.z]), worst: worstAt && [worstAt.x, worstAt.z, worst] }));
}
console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK'); process.exit(fails.length ? 1 : 0);

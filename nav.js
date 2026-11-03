// ============================================================
//  Navegação dos bots: grafo gerado automaticamente a partir da colisão do mapa.
//  Nós: amostragem em grade no chão e no topo de caixas/rampas + linha central das rampas + waypoints extras.
//  Arestas: simulação de caminhada (degraus até STEP, quedas de um sentido só, pulos de até ~1.25 m).
//  Caminho: A* com heap binário; nó mais próximo com teste de caminhada.
// ============================================================
export function buildNav(o) {
  const { hx, hz, spacing = 2, collides, groundAt, solids, topAt, seeds = [], extra = [], avoid = [] } = o;
  const inAvoid = (x, z) => { for (const r of avoid) if (x >= r[0] && z >= r[1] && x <= r[2] && z <= r[3]) return true; return false; };
  const nodes = []; const CELL = spacing;
  const hash = new Map(); const key = (ix, iz) => ix * 73856 + iz;
  const addNode = (x, y, z) => {
    for (const n of near(x, z, 0.6)) if (Math.abs(n.y - y) < 0.3 && Math.hypot(n.x - x, n.z - z) < 0.6) return n;
    const n = { id: nodes.length, x, y, z, e: [] }; nodes.push(n);
    const k = key(Math.floor(x / CELL), Math.floor(z / CELL)); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(n); return n;
  };
  function near(x, z, r) {
    const out = []; const r0 = Math.floor((x - r) / CELL), r1 = Math.floor((x + r) / CELL), c0 = Math.floor((z - r) / CELL), c1 = Math.floor((z + r) / CELL);
    for (let i = r0; i <= r1; i++) for (let j = c0; j <= c1; j++) { const l = hash.get(key(i, j)); if (l) out.push(...l); }
    return out;
  }
  const tryNode = (x, z, h) => {
    if (inAvoid(x, z)) return null;
    const y = groundAt(x, z, h + 0.01); if (Math.abs(y - h) > 0.05) return null;
    if (collides(x, y, z)) return null; return addNode(x, y, z);
  };
  // grade
  for (let x = -hx + 0.9; x <= hx - 0.9; x += spacing) for (let z = -hz + 0.9; z <= hz - 0.9; z += spacing) {
    const hs = new Set([0]);
    const low = groundAt(x, z, -3); if (low < -0.05 && low > -8) hs.add(+low.toFixed(3));
    for (const s of solids) if (x >= s.min.x && x <= s.max.x && z >= s.min.z && z <= s.max.z && s.max.y < 30) hs.add(+topAt(s, x, z).toFixed(3));
    for (const h of hs) tryNode(x, z, h);
  }
  // linha central das rampas (garante que rampas estreitas tenham nós)
  for (const s of solids) {
    if (!s.ramp) continue; const ax = s.ramp.axis;
    const a0 = ax === 'x' ? s.min.x : s.min.z, a1 = ax === 'x' ? s.max.x : s.max.z, c = ax === 'x' ? (s.min.z + s.max.z) / 2 : (s.min.x + s.max.x) / 2;
    const n = Math.max(2, Math.ceil((a1 - a0) / 1.3));
    const at = [a0 - 0.6, a0 + 0.3, a1 - 0.3, a1 + 0.6]; for (let i = 1; i < n; i++) at.push(a0 + (a1 - a0) * i / n);
    for (const a of at) { const x = ax === 'x' ? a : c, z = ax === 'x' ? c : a; tryNode(x, z, groundAt(x, z, s.max.y + 0.01)); }
  }
  for (const [x, y, z] of extra) tryNode(x, z, groundAt(x, z, y + 0.01));
  // arestas
  const R = spacing * 1.75 + 0.15;
  for (const a of nodes) for (const b of near(a.x, a.z, R)) {
    if (b === a) continue; const d = Math.hypot(b.x - a.x, b.z - a.z); if (d > R || b.y - a.y > 1.6 || a.y - b.y > 6) continue;
    const w = walk(a, b); if (w >= 0) a.e.push([b.id, d + w + Math.max(0, a.y - b.y) * 0.3]);
  }
  // simulação de caminhada a→b; retorna custo extra (pulo) ou -1 se não dá
  function walk(a, b) {
    let y = a.y, extraCost = 0, jumped = false; const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L / 0.25));
    for (let i = 1; i <= n; i++) {
      const x = a.x + dx * i / n, z = a.z + dz * i / n;
      if (collides(x, y, z)) {
        if (jumped) return -1; const jy = y + 1.25;
        if (collides(x, jy, z) || collides(x - dx / n, jy, z - dz / n)) return -1;
        const g = groundAt(x, z, jy); if (g <= y + 0.45) return -1; y = g; jumped = true; extraCost += 1.5; continue;
      }
      y = groundAt(x, z, y);
    }
    return Math.abs(y - b.y) < 0.4 ? extraCost : -1;
  }
  // mantém só o que é alcançável a partir dos spawns (ida e volta)
  const seedIds = new Set(); for (const [x, y, z] of seeds) { const n = nearest(x, y, z, false); if (n) seedIds.add(n.id); }
  const fwd = bfs([...seedIds], (n) => n.e.map((e) => e[0]));
  const rev = nodes.map(() => []); for (const n of nodes) for (const [j] of n.e) rev[j].push(n.id);
  const back = bfs([...seedIds], (n) => rev[n.id]);
  function bfs(start, nb) { const seen = new Uint8Array(nodes.length), q = [...start]; for (const s of start) seen[s] = 1; while (q.length) { const i = q.pop(); for (const j of nb(nodes[i])) if (!seen[j]) { seen[j] = 1; q.push(j); } } return seen; }
  for (const n of nodes) n.ok = !!(fwd[n.id] && back[n.id]);
  const good = nodes.filter((n) => n.ok);

  function nearest(x, y, z, onlyOk = true) {
    let list = [];
    for (const r of [2.5, 5, 9]) { list = near(x, z, r).filter((n) => (!onlyOk || n.ok) && Math.abs(n.y - y) < 2.2); if (list.length) break; }
    if (!list.length) return null;
    list.sort((p, q) => (Math.hypot(p.x - x, p.z - z) + Math.abs(p.y - y) * 2) - (Math.hypot(q.x - x, q.z - z) + Math.abs(q.y - y) * 2));
    const from = { x, y, z };
    for (let i = 0; i < Math.min(5, list.length); i++) if (walk(from, list[i]) >= 0) return list[i];
    return list[0];
  }
  // A*
  function path(from, to) {
    const s = nearest(from.x, from.y, from.z), g = nearest(to.x, to.y, to.z); if (!s || !g) return null;
    if (s === g) return [g];
    const N = nodes.length, gs = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const h = (n) => Math.hypot(n.x - g.x, n.z - g.z) + Math.abs(n.y - g.y);
    gs[s.id] = 0; push(s.id, h(s)); let it = 0;
    while (heap.length && it++ < 20000) {
      const [, i] = pop(); if (closed[i]) continue; closed[i] = 1; if (i === g.id) break;
      for (const [j, c] of nodes[i].e) { if (!nodes[j].ok) continue; const ng = gs[i] + c; if (ng < gs[j]) { gs[j] = ng; prev[j] = i; push(j, ng + h(nodes[j])); } }
    }
    if (prev[g.id] < 0) return null;
    const out = []; for (let i = g.id; i >= 0; i = prev[i]) out.push(nodes[i]); out.reverse();
    return out;
  }
  const randomNode = () => good[Math.floor(Math.random() * good.length)];
  return { nodes, good, nearest, path, randomNode, walk, edges: nodes.reduce((a, n) => a + n.e.length, 0) };
}

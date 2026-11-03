// Botijões de gás explosivos. Dados por mapa (hoje só o Morro do Leitão) e a simulação
// compartilhada: o cliente offline e o servidor online usam as mesmas contas.
// Sem DOM e sem Three.js. O visual fica em gas-view.js.
// Fase: 0 inteiro, 1 pegando fogo, 2 estourado (espera o respawn).

export const W_GAS = -4; // "arma" do abate no kill feed (ícone de explosão)

export const GAS = {
  hp: 100,
  fire: 0.5, // aos 50% de vida (ou menos) pega fogo
  fuse: [2, 3], // segundos até estourar sozinho
  respawn: [30, 45],
  chain: 6.4, // a explosão detona outro botijão dentro deste raio
  r: 0.4,
  h: 1.22,
  // Mesma família da bazuca / Copo Bomba: falloff em explosionHits, mata colado, empurra.
  blast: { radius: 5.4, maxDmg: 140, selfMul: 0.45, knock: 13, lift: 8 },
};

// y = base (em cima da laje). As caixas d'água azuis continuam onde estão; isto não as substitui.
const R = GAS.r, H = GAS.h;
export const GAS_LAYOUT = {
  'morro-leitao': [
    // rua oeste: patamar da laje + dois telhados. O do meio liga os outros dois.
    { x: -27.2, y: 3.4, z: -21.7, r: R, h: H },
    { x: -24.15, y: 3.4, z: -17.9, r: R, h: H },
    { x: -18.55, y: 3.4, z: -17.9, r: R, h: H },
    // rua leste: telhado, telhado e patamar da laje
    { x: 14.7, y: 3.4, z: -17.9, r: R, h: H },
    { x: 20.35, y: 3.4, z: -16.8, r: R, h: H },
    { x: 21.95, y: 3.4, z: -21.7, r: R, h: H },
    // flancos do campinho (um em cada laje, longe um do outro)
    { x: -28.0, y: 9.0, z: 5.2, r: R, h: H },
    { x: 28.0, y: 9.0, z: 5.2, r: R, h: H },
    // topo, ao lado da caixa d'água da praça (ela continua azul)
    { x: -2.7, y: 11.4, z: 18.85, r: R, h: H },
    { x: 2.7, y: 11.4, z: 18.85, r: R, h: H },
  ],
};

export function gasLayout(mapId) { return GAS_LAYOUT[mapId] || []; }
export function gasCenter(c) { return { x: c.x, y: c.y + c.h * 0.5, z: c.z }; }
const span = (rng, pair) => pair[0] + rng() * (pair[1] - pair[0]);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function pelletOnGas(W, t, scale = 1) {
  let m = 1;
  if (W && W.falloff) {
    const [n0, n1, mn] = W.falloff;
    m = Math.max(mn, Math.min(1, 1 - ((t - n0) / (n1 - n0)) * (1 - mn)));
  }
  return (W ? W.dmg : 0) * (scale || 1) * m;
}

// raio × cilindro em pé (corpo + tampa de cima). null se não acerta antes de far.
export function rayCylinder(o, d, c, far) {
  const r = c.r, y0 = c.y, y1 = c.y + c.h;
  const ox = o.x - c.x, oz = o.z - c.z;
  const inside = ox * ox + oz * oz <= r * r && o.y >= y0 && o.y <= y1;
  if (inside) return 0.04;
  let best = null;
  const take = (t) => { if (t >= 0 && t <= far && (best === null || t < best)) best = t; };
  const A = d.x * d.x + d.z * d.z;
  if (A > 1e-10) {
    const B = 2 * (ox * d.x + oz * d.z), C = ox * ox + oz * oz - r * r, disc = B * B - 4 * A * C;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      for (const t of [(-B - s) / (2 * A), (-B + s) / (2 * A)]) {
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) take(t);
      }
    }
  }
  if (Math.abs(d.y) > 1e-8) {
    const t = (y1 - o.y) / d.y;
    if (t >= 0 && t <= far) {
      const x = o.x + d.x * t, z = o.z + d.z * t;
      if ((x - c.x) ** 2 + (z - c.z) ** 2 <= r * r) take(t);
    }
  }
  return best;
}

// encurta o traço da bala: o botijão é metal, a bala para nele.
export function clipTrace(tr, o, d, hit) {
  if (!hit) return tr;
  tr.end = hit.t; tr.stop = 'gas';
  if (tr.hits) tr.hits = tr.hits.filter((h) => h.t < hit.t - 0.02);
  if (tr.holes) tr.holes = tr.holes.filter((h) => (h.p.x - o.x) * d.x + (h.p.y - o.y) * d.y + (h.p.z - o.z) * d.z < hit.t - 0.02);
  return tr;
}

function fresh(p, i) {
  return { id: i, x: p.x, y: p.y, z: p.z, r: p.r || GAS.r, h: p.h || GAS.h, hp: GAS.hp, max: GAS.hp, phase: 0, explodeAt: 0, respawnAt: 0, attacker: null };
}

export function createGasSim(mapId, rng = Math.random) {
  const list = gasLayout(mapId).map(fresh);
  const sim = {
    mapId, list,
    ray(o, d, far) {
      let best = null;
      for (const c of list) {
        if (c.phase === 2) continue;
        const t = rayCylinder(o, d, c, far);
        if (t !== null && (best === null || t < best.t)) best = { c, t };
      }
      return best;
    },
    // 'boom' esvaziou, 'burn' acabou de pegar fogo, 'hit' só perdeu vida, null se já era sucata.
    hurt(c, dmg, now, attacker) {
      if (!c || c.phase === 2 || !(dmg > 0)) return null;
      const before = c.hp;
      c.attacker = attacker || c.attacker;
      if (c.phase === 1) {
        const left = Math.max(0, c.explodeAt - now);
        c.hp = Math.max(0, c.hp - dmg);
        if (c.hp <= 0) return 'boom';
        c.explodeAt = now + left * (c.hp / before);
        return 'hit';
      }
      c.hp = Math.max(0, before - dmg);
      if (c.hp <= 0) return 'boom';
      if (c.hp <= c.max * GAS.fire) {
        c.phase = 1;
        c.explodeAt = now + span(rng, GAS.fuse);
        return 'burn';
      }
      return 'hit';
    },
    detonate(c, now, attacker, emit) {
      if (!c || c.phase === 2) return;
      c.phase = 2; c.hp = 0; c.attacker = attacker || c.attacker;
      c.respawnAt = now + span(rng, GAS.respawn);
      if (emit) emit({ type: 'boom', c, attacker: c.attacker });
    },
    // explosão (granada, foguete ou outro botijão) perto: detona. Um pouco mais longe, só machuca.
    splash(pos, spec, now, attacker, hooks) {
      if (!list.length || !hooks) return;
      const R = spec && spec.radius || 0, queued = [];
      for (const c of list) {
        if (c.phase === 2) continue;
        const d = dist(gasCenter(c), pos);
        if (d <= GAS.chain || (R > 0 && d < R)) queued.push([c, d]);
      }
      for (const [c, d] of queued) {
        if (c.phase === 2) continue;
        if (d <= GAS.chain) hooks.boom(c, attacker);
        else {
          const dmg = (spec.maxDmg || 0) * (1 - d / R);
          const r = sim.hurt(c, dmg, now, attacker);
          if (r === 'boom') hooks.boom(c, attacker || c.attacker);
          else if (r && hooks.sync) hooks.sync(c);
        }
      }
    },
    step(now, hooks) {
      if (!hooks) return;
      const due = list.filter((c) => c.phase === 1 && now >= c.explodeAt);
      for (const c of due) if (c.phase === 1) hooks.boom(c, c.attacker);
      for (const c of list) if (c.phase === 2 && now >= c.respawnAt) {
        c.phase = 0; c.hp = c.max; c.attacker = null; c.explodeAt = 0; c.respawnAt = 0;
        if (hooks.sync) hooks.sync(c);
      }
    },
    reset() { list.forEach((c, i) => Object.assign(c, fresh(gasLayout(mapId)[i], i))); },
    pack() { return list.map((c) => [c.id, c.phase, Math.round(c.hp), Math.round((c.phase === 1 ? c.explodeAt : c.phase === 2 ? c.respawnAt : 0) * 100) / 100]); },
    apply(rows) {
      if (!rows) return;
      for (const row of rows) {
        const c = list[row[0]]; if (!c) continue;
        c.phase = row[1]; c.hp = row[2];
        if (c.phase === 1) c.explodeAt = row[3];
        if (c.phase === 2) c.respawnAt = row[3];
        if (c.phase === 0) { c.explodeAt = 0; c.respawnAt = 0; }
      }
    },
  };
  return sim;
}

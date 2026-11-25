// ============================================================
//  A Pocilga — circuito solo (cliente offline + validação do ranking).
//  O desenho segue o percurso descrito do The Pit (pátio, fachada, sala
//  com curva, escada, passarela, pulo, corredor e chegada ao lado da
//  largada). Sem asset do COD. Só a Pistolinha Leitão; a faca, se já
//  existir no jogo, também derruba o javali que está ao alcance.
//
//  Javali esquecido trava a chegada. Civil soma tempo e tira as 3 estrelas.
//  O ranking recusa diário incompleto ou mais rápido que o mínimo físico.
//  Sem DOM e sem Three.js.
// ============================================================
import { SPEED, KNIFE } from './rules.js';

export const BOARD = { w: 1.05, h: 1.85, d: 0.12, y: 0.02 };
const H = 2.8;
const DECK = 3.15;
const R0 = 31;
const R1 = 45;
const WALLTOP = 2.9;
const ROUND = (n) => Math.round(n * 1000) / 1000;
const rampY = (z) => ROUND((z - R0) / (R1 - R0) * DECK);

// O texto do vídeo lista 4 civis e pede 5 no total. O quinto fica na fachada.
export const PIT = {
  mode: 'pocilga',
  map: 'pocilga',
  title: 'A Pocilga',
  pistol: 4,
  knife: KNIFE,
  civPenalty: 3,
  // Ajuste fino: rise = segundos até a placa ficar em pé; lead = metros de eixo
  // antes do grupo em que o gatilho deve armar.
  rise: 0.18,
  lead: 12,
  star3: 45,
  star2: 58,
  sprint: 1.45,
  deck: DECK,
  roof: WALLTOP,
  stair: { x: 0, z0: R0, z1: R1, y: DECK },
  spawn: [14.6, -18],
  spawnYaw: Math.PI,
  tower: { x: 15.7, z: -17.15, y: 2.7 },
  path: [
    { x: 14.6, z: -18, y: 0 },
    { x: 14.2, z: -10.2, y: 0 },
    { x: 14.2, z: 16, y: 0 },
    { x: 14.2, z: 24, y: 0 },
    { x: 0, z: 24, y: 0 },
    { x: 0, z: R0, y: 0 },
    { x: 0, z: 36, y: rampY(36) },
    { x: 0, z: 42, y: rampY(42) },
    { x: 0, z: 45.4, y: DECK },
    { x: 0, z: 47.1, y: DECK },
    { x: 16, z: 47.1, y: DECK },
    { x: 20.2, z: 40, y: 0, drop: true },
    { x: 20.2, z: 8, y: 0, sprint: true },
    { x: 20.2, z: -17.4, y: 0, sprint: true },
  ],
  gates: [
    { id: 'start', x: 14.2, z: -10.2, y: 0, r: 2.2, pop: 'patio' },
    { id: 'sala', x: 14.2, z: 16.0, y: 0, r: 2.3, pop: 'sala', say: 'Em cima do muro!' },
    { id: 'escada', x: 0, z: 27.6, y: 0, r: 2.8, pop: 'escada', say: 'Sobe a escada!' },
    { id: 'passa', x: -2.2, z: 47.1, y: DECK, r: 2.6, pop: 'passa' },
    { id: 'pulo', x: 14, z: 47.1, y: DECK, r: 2.3, say: 'Pula!' },
    { id: 'baixo', x: 20.2, z: 39, y: 0, r: 3.6, pop: 'pulo' },
    { id: 'corre', x: 20.2, z: 14, y: 0, r: 3.2, say: 'Corre!' },
    { id: 'finish', x: 20.2, z: -17.4, y: 0, r: 2.4 },
  ],
  bays: [
    { id: 'patio', targets: [
      { id: 'e1', kind: 'enemy', name: 'Javali da porteira', x: 12.8, z: 15.4, y: 0, face: -1 },
      { id: 'e2', kind: 'enemy', name: 'Javali do meio', x: 13.1, z: 15.4, y: 0, face: -1, move: { axis: 'x', min: 12.45, max: 13.7, speed: 0.9, phase: 0.2 } },
      { id: 'e3', kind: 'enemy', name: 'Javali do pátio', x: 14.4, z: 15.4, y: 0, face: -1, move: { axis: 'x', min: 13.85, max: 14.95, speed: 1.05, phase: 1.1 } },
      { id: 'e4', kind: 'enemy', name: 'Javali do trilho', x: 12.7, z: 16.5, y: 0, face: -1, move: { axis: 'x', min: 12.35, max: 13.5, speed: 0.85, phase: 0.4 } },
      { id: 'e5', kind: 'enemy', name: 'Javali da fileira', x: 14.3, z: 16.5, y: 0, face: -1, move: { axis: 'x', min: 13.7, max: 14.9, speed: 1.1, phase: 1.6 } },
      { id: 'c1', kind: 'civil', name: 'Leitão do corredor', x: 13.4, z: 16.5, y: 0, face: -1, move: { axis: 'x', min: 12.7, max: 14.1, speed: 0.75, phase: 0.8 } },
    ] },
    { id: 'sala', targets: [
      { id: 'e6', kind: 'enemy', name: 'Javali da sala', x: 11, z: 25.5, y: 0, face: -1, move: { axis: 'x', min: 8.5, max: 13.5, speed: 0.8, phase: 0.3 } },
      { id: 'e7', kind: 'enemy', name: 'Javali largo', x: 4.5, z: 25.5, y: 0, face: -1, move: { axis: 'x', min: 2.2, max: 7.2, speed: 0.95, phase: 1.2 } },
      { id: 'e8', kind: 'enemy', name: 'Javali do fundo', x: -1.2, z: 25.8, y: 0, face: -1, move: { axis: 'x', min: -3.4, max: 1.2, speed: 0.85, phase: 0.6 } },
      { id: 'c2', kind: 'civil', name: 'Porquinho da sala', x: 7.5, z: 26.6, y: 0, face: -1, move: { axis: 'x', min: 5.2, max: 10.2, speed: 0.7, phase: 1.4 } },
      { id: 'e9', kind: 'enemy', name: 'Javali do muro', x: -5.42, z: 26.2, y: WALLTOP, face: 'x', move: { axis: 'z', min: 24.8, max: 27.8, speed: 0.8, phase: 0.5 } },
      { id: 'e10', kind: 'enemy', name: 'Javali em cima', x: 11.2, z: 29.42, y: WALLTOP, face: -1, move: { axis: 'x', min: 8.8, max: 13.6, speed: 0.9, phase: 1.0 } },
    ] },
    { id: 'escada', targets: [
      { id: 'e12', kind: 'enemy', name: 'Javali da escada', x: -3.6, z: 36.5, y: rampY(36.5), face: -1, move: { axis: 'x', min: -4.8, max: -2.2, speed: 0.8, phase: 0.2 } },
      { id: 'e13', kind: 'enemy', name: 'Javali do meio da escada', x: 0.2, z: 39.6, y: rampY(39.6), face: -1 },
      { id: 'e14', kind: 'enemy', name: 'Javali de cima', x: 3.6, z: 42.6, y: rampY(42.6), face: -1, move: { axis: 'x', min: 2.4, max: 4.8, speed: 0.85, phase: 1.3 } },
    ] },
    { id: 'passa', targets: [
      { id: 'e15', kind: 'enemy', name: 'Javali no peito', x: 6.4, z: 47.1, y: DECK, face: '-x', close: true },
      { id: 'e16', kind: 'enemy', name: 'Javali da passarela', x: 9.2, z: 47.1, y: DECK, face: '-x', move: { axis: 'z', min: 46.45, max: 47.75, speed: 0.9, phase: 0.4 } },
      { id: 'e17', kind: 'enemy', name: 'Javali do corrimão', x: 13.2, z: 47.1, y: DECK, face: '-x' },
      { id: 'c3', kind: 'civil', name: 'Porquinha da passarela', x: 7.2, z: 47.1, y: DECK, face: '-x', move: { axis: 'z', min: 46.45, max: 47.75, speed: 0.7, phase: 1.1 } },
      { id: 'c4', kind: 'civil', name: 'Leitão da passarela', x: 11.2, z: 46.7, y: DECK, face: '-x' },
    ] },
    { id: 'pulo', targets: [
      { id: 'e18', kind: 'enemy', name: 'Javali da queda', x: 21.2, z: 28, y: 0, face: 1, move: { axis: 'x', min: 19.4, max: 23.2, speed: 0.95, phase: 0.2 } },
      { id: 'e19', kind: 'enemy', name: 'Javali do corredor', x: 22.2, z: 22, y: 0, face: 1, move: { axis: 'x', min: 20.2, max: 23.4, speed: 0.85, phase: 0.8 } },
      { id: 'e20', kind: 'enemy', name: 'Javali da reta', x: 20.6, z: 16, y: 0, face: 1 },
      { id: 'c5', kind: 'civil', name: 'Vovó da reta', x: 21.6, z: 12, y: 0, face: 1, move: { axis: 'x', min: 19.6, max: 23.4, speed: 0.7, phase: 1.2 } },
      { id: 'e21', kind: 'enemy', name: 'Javali do meio da reta', x: 21.2, z: 6, y: 0, face: 1 },
      { id: 'e22', kind: 'enemy', name: 'Javali que cruza', x: 21, z: 0, y: 0, face: 1, move: { axis: 'x', min: 19.4, max: 23.2, speed: 1.05, phase: 0.5 } },
      { id: 'e23', kind: 'enemy', name: 'Javali do fim', x: 22.2, z: -8, y: 0, face: 1, move: { axis: 'x', min: 20.2, max: 23.6, speed: 0.9, phase: 1.4 } },
      { id: 'e24', kind: 'enemy', name: 'Javali da chegada', x: 20.8, z: -13, y: 0, face: 1 },
    ] },
  ],
};

export function pitTargets() {
  const out = [];
  for (const b of PIT.bays) for (const t of b.targets) out.push({ ...t, bay: b.id });
  return out;
}
export function pitTarget(id) { return pitTargets().find((t) => t.id === id) || null; }
export function pitEnemies() { return pitTargets().filter((t) => t.kind === 'enemy'); }
export function pitCivils() { return pitTargets().filter((t) => t.kind === 'civil'); }
export function pitMovers() { return pitTargets().filter((t) => t.move); }

function sideOn(face) { return face === 'x' || face === '-x'; }

export function boardAabb(t, ground = 0) {
  const side = sideOn(t.face);
  const hx = (side ? BOARD.d : BOARD.w) / 2;
  const hz = (side ? BOARD.w : BOARD.d) / 2;
  const y0 = ground + BOARD.y;
  return { minX: t.x - hx, maxX: t.x + hx, minY: y0, maxY: y0 + BOARD.h, minZ: t.z - hz, maxZ: t.z + hz };
}

export function rayAabb(ox, oy, oz, dx, dy, dz, box, maxT) {
  let tmin = 0, tmax = maxT;
  const slabs = [[ox, dx, box.minX, box.maxX], [oy, dy, box.minY, box.maxY], [oz, dz, box.minZ, box.maxZ]];
  for (const [o, d, mn, mx] of slabs) {
    if (Math.abs(d) < 1e-8) { if (o < mn || o > mx) return null; continue; }
    let t1 = (mn - o) / d, t2 = (mx - o) / d;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  const t = tmin >= 0 ? tmin : tmax;
  if (t < 0 || t > maxT) return null;
  return t;
}

export function moverAt(t, time) {
  if (!t.move) return { x: t.x, z: t.z };
  const m = t.move;
  const u = Math.sin(time * m.speed + (m.phase || 0));
  const along = (m.min + m.max) / 2 + (m.max - m.min) / 2 * u;
  return m.axis === 'x' ? { x: along, z: t.z } : { x: t.x, z: along };
}

function segLen(a, b) { return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }

export function pathStats() {
  let run = 0, dash = 0;
  for (let i = 1; i < PIT.path.length; i++) {
    const len = segLen(PIT.path[i - 1], PIT.path[i]);
    if (PIT.path[i].sprint) dash += len; else run += len;
  }
  return { run: ROUND(run), dash: ROUND(dash), total: ROUND(run + dash) };
}

export function minPlausible() {
  const { run, dash } = pathStats();
  return ROUND(run / SPEED + dash / (SPEED * PIT.sprint) + pitEnemies().length * 0.04);
}

export function samplePath(step = 0.4) {
  const out = [];
  for (let i = 1; i < PIT.path.length; i++) {
    const a = PIT.path[i - 1], b = PIT.path[i];
    if (b.drop) {
      if (!out.length) out.push({ x: a.x, z: a.z, y: a.y });
      out.push({ x: b.x, z: b.z, y: b.y });
      continue;
    }
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function onSprint(x, y, z) {
  for (let i = 1; i < PIT.path.length; i++) {
    if (!PIT.path[i].sprint) continue;
    const a = PIT.path[i - 1], b = PIT.path[i];
    const abx = b.x - a.x, abz = b.z - a.z, ab2 = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / ab2));
    const dx = x - (a.x + abx * t), dz = z - (a.z + abz * t);
    const midY = a.y + (b.y - a.y) * t;
    if (dx * dx + dz * dz <= 4 * 4 && Math.abs((y || 0) - midY) < 1.6) return true;
  }
  return false;
}

export function inGate(pos, gate) {
  if (!pos || !gate) return false;
  const dx = pos.x - gate.x, dz = pos.z - gate.z;
  return dx * dx + dz * dz <= gate.r * gate.r && Math.abs((pos.y || 0) - gate.y) < 2.2;
}

export function starsOf(final, civs, finished) {
  if (!finished) return 0;
  if (final <= PIT.star3 && civs === 0) return 3;
  if (final <= PIT.star2) return 2;
  return 1;
}

export function suggestion(stars) {
  if (stars >= 3) return { id: 'javali', label: 'Javali', hint: 'pesadelo — o curral foi seu' };
  if (stars >= 2) return { id: 'ceva', label: 'Ceva', hint: 'normal — ainda dá para apertar' };
  if (stars >= 1) return { id: 'leitao', label: 'Leitão', hint: 'fácil — volta sem encostar no civil' };
  return { id: '', label: '', hint: '' };
}

export function formatPit(sec) {
  if (!(sec >= 0) || !Number.isFinite(sec)) return '—';
  const cs = Math.max(0, Math.round(sec * 100));
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

const empty = (reason) => ({
  ok: false, ranked: false, reason, started: false, finished: false,
  raw: null, penalty: 0, final: null, civs: 0, stars: 0, missed: pitEnemies().map((t) => t.id),
  down: [], pops: [], suggestion: suggestion(0), blocked3: false,
});

function countsAsShot(w) { return w === PIT.pistol || w === PIT.knife; }

export function inspectRun(events) {
  if (!Array.isArray(events) || events.length < 2 || events.length > 80) return empty('diário');
  const targets = new Map(pitTargets().map((t) => [t.id, t]));
  const bayOrder = PIT.bays.map((b) => b.id);
  let prev = -1, started = false, finishT = null;
  const pops = [], down = new Map(), civHit = new Set();
  for (const e of events) {
    if (!e || typeof e.k !== 'string' || typeof e.t !== 'number' || !Number.isFinite(e.t)) return empty('diário');
    if (e.t < -1e-9 || e.t > 900 || e.t + 1e-9 < prev) return empty('ordem');
    prev = e.t;
    if (e.k === 'start') {
      if (started || e.t !== 0) return empty('ordem');
      started = true;
      continue;
    }
    if (!started) return empty('ordem');
    if (e.k === 'pop') {
      if (pops.length >= bayOrder.length || e.bay !== bayOrder[pops.length]) return empty('ordem');
      pops.push(e.bay);
      continue;
    }
    if (e.k === 'hit') {
      const t = targets.get(e.id);
      if (!t) return empty('diário');
      if (!countsAsShot(e.w)) continue;
      if (!pops.includes(t.bay)) continue;
      if (t.kind === 'enemy') { if (!down.has(t.id)) down.set(t.id, e.t); }
      else civHit.add(t.id);
      continue;
    }
    if (e.k === 'finish') {
      if (finishT != null) return empty('ordem');
      finishT = e.t;
      continue;
    }
    return empty('diário');
  }
  const missed = pitEnemies().filter((t) => !down.has(t.id)).map((t) => t.id);
  const finished = finishT != null && missed.length === 0 && pops.length === PIT.bays.length;
  const civs = civHit.size;
  const penalty = civs * PIT.civPenalty;
  const final = finished ? ROUND(finishT + penalty) : null;
  const stars = starsOf(final, civs, finished);
  const reason = !started ? 'largada' : finishT == null ? 'andamento' : missed.length ? 'alvo' : pops.length < PIT.bays.length ? 'sala' : 'ok';
  return {
    ok: finished, ranked: false, reason, started, finished,
    raw: finished ? finishT : null, penalty: finished ? penalty : civs * PIT.civPenalty,
    final, civs, stars, missed, down: [...down.keys()], pops: pops.slice(),
    suggestion: suggestion(stars), blocked3: civs > 0,
  };
}

export function rankedRun(events) {
  const run = inspectRun(events);
  if (!run.finished) return run;
  if (!(run.raw + 1e-6 >= minPlausible())) return { ...run, ranked: false, reason: 'rápido' };
  return { ...run, ranked: true, reason: 'ok' };
}

export function scriptRun({ finish = 40, civs = [], skip = [], rifle = false, knife = [] } = {}) {
  const events = [{ k: 'start', t: 0 }];
  let t = 0.2;
  for (const b of PIT.bays) {
    events.push({ k: 'pop', bay: b.id, t: ROUND(t) });
    t += 0.2;
    for (const tgt of b.targets) {
      if (tgt.kind === 'enemy' && skip.includes(tgt.id)) continue;
      if (tgt.kind === 'civil' && !civs.includes(tgt.id)) continue;
      const w = rifle ? 0 : knife.includes(tgt.id) ? PIT.knife : PIT.pistol;
      events.push({ k: 'hit', id: tgt.id, w, t: ROUND(t) });
      t += 0.08;
    }
  }
  events.push({ k: 'finish', t: ROUND(Math.max(t, finish)) });
  return events;
}

// Geometria. ramp sobe no eixo; floor marca laje; tone escolhe a cor no mapa.
export function pitPieces() {
  const out = [];
  const add = (x0, y0, z0, x1, y1, z1, extra) => out.push({
    b: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
    ...extra,
  });
  const wall = (x0, z0, x1, z1, h = H, y0 = 0, tone = 'concrete') => add(x0, y0, z0, x1, y0 + h, z1, { tone });
  const slab = (x0, z0, x1, z1, y, tone = 'metal', th = 0.28) => add(x0, y - th, z0, x1, y, z1, { floor: true, tone });
  const ramp = (x0, z0, x1, z1, yLo, yHi, axis, dir) => add(x0, yLo, z0, x1, yHi, z1, { ramp: { axis, dir }, tone: 'ramp' });

  // 1. Sala da largada. Uma porta só, afastada da torre.
  wall(7.2, -22.3, 16.5, -21.85, H);
  wall(7.2, -22.3, 7.65, -10.15, H);
  wall(16.05, -22.3, 16.5, -10.15, H);
  wall(7.65, -10.6, 12.5, -10.15, H);
  wall(15.5, -10.6, 16.05, -10.15, H);
  add(15.15, 0, -17.7, 15.55, 2.42, -17.25, { tone: 'wood' });
  add(16.0, 0, -17.7, 16.4, 2.42, -17.25, { tone: 'wood' });
  slab(15.05, -17.85, 16.45, -16.35, 2.7, 'wood', 0.28);

  // 2. Corredor único, sem vão lateral.
  wall(11.15, -10.15, 11.6, 18.85, H);
  wall(15.55, -10.15, 16.0, 18.85, H);

  // 3. Sala larga. A parede da esquerda é contínua. A boca da rampa é a única saída.
  wall(-6.2, 18.45, 11.15, 18.9, WALLTOP);
  wall(16.0, 18.45, 16.6, 18.9, WALLTOP);
  wall(-6.2, 18.45, -5.75, 30.15, WALLTOP);
  wall(16.15, 18.45, 16.6, 30.15, WALLTOP);
  wall(-6.2, 29.7, -4.35, 30.15, WALLTOP);
  wall(4.35, 29.7, 16.6, 30.15, WALLTOP);
  slab(-5.75, 24.4, -5.15, 28.2, WALLTOP, 'concrete', 0.16);
  slab(8.2, 29.15, 14.2, 29.7, WALLTOP, 'concrete', 0.16);

  // 4. Rampa larga. O lado direito é parede, não um corredor.
  ramp(-6, R0, 6, R1, 0, DECK, 'z', 1);
  wall(-6.55, 30.15, -6.1, 47.5, 5.9);
  wall(6.1, 30.15, 6.55, 46.15, 5.9);
  add(6.55, 0, 30.15, 16.6, 5.6, 45.7, { tone: 'concrete' });

  // 5. Topo segue em frente. A direita do cume fica fechada. A ponte é uma laje só.
  slab(-6.55, 44.55, 6.55, 48.15, DECK);
  slab(6.15, 46.2, 20.7, 48.15, DECK);
  wall(-6.55, 47.75, 20.7, 48.2, 2.5, DECK, 'metal');
  wall(6.55, 46.2, 20.7, 46.65, 2.5, DECK, 'metal');

  // 6. Disparada: um corredor largo e reto até o arco.
  wall(17.15, -19.5, 17.6, 48.3, H, 0, 'fence');
  wall(24.35, -19.5, 24.8, 48.3, H, 0, 'fence');
  wall(17.15, -19.5, 24.8, -19.05, H, 0, 'fence');
  wall(17.15, 47.9, 24.8, 48.35, H, 0, 'fence');
  return out;
}

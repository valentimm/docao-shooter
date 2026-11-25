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
const H = 2.7;
const DECK = 3.15;
const R0 = 30.2;
const R1 = 43.6;
const ROOF = 3.72;
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
  star3: 50,
  star2: 64,
  sprint: 1.45,
  deck: DECK,
  roof: ROOF,
  stair: { x: -24.5, z0: R0, z1: R1, y: DECK },
  spawn: [0, -18],
  spawnYaw: Math.atan2(3, -1.8),
  tower: { x: -2.9, z: -16.3, y: 2.7 },
  path: [
    { x: 0, z: -18, y: 0 },
    { x: 0, z: -10.4, y: 0 },
    { x: 0, z: 8, y: 0 },
    { x: 0, z: 20, y: 0 },
    { x: 0, z: 27, y: 0 },
    { x: -24.5, z: 27, y: 0 },
    { x: -24.5, z: 31.2, y: rampY(31.2) },
    { x: -24.5, z: 41.4, y: rampY(41.4) },
    { x: -24.5, z: 43.2, y: DECK },
    { x: 6, z: 43.2, y: DECK },
    { x: 10, z: 30, y: 0, drop: true },
    { x: 14.2, z: 16, y: 0 },
    { x: 14.2, z: -13.2, y: 0, sprint: true },
    { x: 9.2, z: -13.2, y: 0, sprint: true },
    { x: 9.2, z: -17, y: 0, sprint: true },
    { x: 4.8, z: -17, y: 0, sprint: true },
  ],
  gates: [
    { id: 'start', x: 0, z: -10.4, y: 0, r: 2.3, pop: 'patio' },
    { id: 'fachada', x: 0, z: 2.2, y: 0, r: 4, pop: 'fachada', say: 'Olha o canto!' },
    { id: 'sala', x: -4, z: 27, y: 0, r: 3.6, pop: 'sala' },
    { id: 'escada', x: -24.5, z: 30.4, y: 0.2, r: 3.2, pop: 'escada', say: 'Sobe a escada!' },
    { id: 'passa', x: -22, z: 43.2, y: DECK, r: 3.4, pop: 'passa' },
    { id: 'pulo', x: 4.2, z: 43.2, y: DECK, r: 2.4, say: 'Pula!' },
    { id: 'baixo', x: 10, z: 32, y: 0, r: 4, pop: 'pulo' },
    { id: 'corre', x: 14.2, z: 14, y: 0, r: 3, say: 'Corre!' },
    { id: 'reta', x: 14.2, z: 6, y: 0, r: 3.5, pop: 'reta' },
    { id: 'finish', x: 4.8, z: -17, y: 0, r: 1.8 },
  ],
  bays: [
    { id: 'patio', targets: [
      { id: 'e1', kind: 'enemy', name: 'Javali da porteira', x: -1.55, z: 1.6, y: 0, face: -1 },
      { id: 'e2', kind: 'enemy', name: 'Javali do meio', x: 1.55, z: 5.4, y: 0, face: -1 },
      { id: 'e3', kind: 'enemy', name: 'Javali do pátio', x: 0.15, z: 9.2, y: 0, face: -1 },
    ] },
    { id: 'fachada', targets: [
      { id: 'e4', kind: 'enemy', name: 'Javali do telhado', x: 0, z: 16.7, y: ROOF, face: -1, move: { axis: 'x', min: -4.2, max: 4.2, speed: 0.85, phase: 0.2 } },
      { id: 'e5', kind: 'enemy', name: 'Javali da esquerda', x: -1.6, z: 13.6, y: 0, face: -1 },
      { id: 'e6', kind: 'enemy', name: 'Javali da direita', x: 1.85, z: 13.8, y: 0, face: -1 },
      { id: 'c1', kind: 'civil', name: 'Leitão da fachada', x: 0.95, z: 11.2, y: 0, face: -1 },
    ] },
    { id: 'sala', targets: [
      { id: 'e7', kind: 'enemy', name: 'Javali da sala', x: -15.2, z: 28.4, y: 0, face: 'x' },
      { id: 'e8', kind: 'enemy', name: 'Javali do canto', x: -18.6, z: 28.4, y: 0, face: 'x' },
      { id: 'e9', kind: 'enemy', name: 'Javali do fundo', x: -22, z: 28.4, y: 0, face: 'x' },
      { id: 'e10', kind: 'enemy', name: 'Javali do trilho', x: -18, z: 25.5, y: 0, face: 'x', move: { axis: 'x', min: -20.4, max: -15.6, speed: 0.9, phase: 0.6 } },
      { id: 'e11', kind: 'enemy', name: 'Javali da curva', x: -13.4, z: 25.55, y: 0, face: 'x' },
      { id: 'c2', kind: 'civil', name: 'Porquinho da sala', x: -16.8, z: 25.55, y: 0, face: 'x' },
    ] },
    { id: 'escada', targets: [
      { id: 'e12', kind: 'enemy', name: 'Javali da escada', x: -23.35, z: 39.4, y: rampY(39.4), face: -1 },
      { id: 'e13', kind: 'enemy', name: 'Javali do meio da escada', x: -23.35, z: 41.1, y: rampY(41.1), face: -1 },
      { id: 'e14', kind: 'enemy', name: 'Javali de cima', x: -23.35, z: 42.7, y: DECK, face: -1 },
    ] },
    { id: 'passa', targets: [
      { id: 'e15', kind: 'enemy', name: 'Javali no peito', x: -10, z: 44.2, y: DECK, face: '-x', close: true },
      { id: 'e16', kind: 'enemy', name: 'Javali da passarela', x: -4, z: 44.25, y: DECK, face: '-x' },
      { id: 'e17', kind: 'enemy', name: 'Javali do corrimão', x: 1.6, z: 44.2, y: DECK, face: '-x' },
      { id: 'c3', kind: 'civil', name: 'Porquinha da passarela', x: -7.2, z: 42.05, y: DECK, face: '-x' },
      { id: 'c4', kind: 'civil', name: 'Leitão da passarela', x: -1.2, z: 42.05, y: DECK, face: '-x' },
    ] },
    { id: 'pulo', targets: [
      { id: 'e18', kind: 'enemy', name: 'Javali da queda', x: 11.05, z: 22.2, y: 0, face: 1 },
      { id: 'e19', kind: 'enemy', name: 'Javali do pátio baixo', x: 12.4, z: 19.4, y: 0, face: 1 },
      { id: 'e20', kind: 'enemy', name: 'Javali da cerca baixa', x: 12.35, z: 18.4, y: 0, face: 1 },
      { id: 'c5', kind: 'civil', name: 'Vovó do carro', x: 12.15, z: 18.2, y: 0, face: 1 },
      { id: 'e21', kind: 'enemy', name: 'Javali do carro', x: 13.7, z: 13.2, y: 0, face: 1 },
      { id: 'e22', kind: 'enemy', name: 'Javali na frente do carro', x: 11.3, z: 21.2, y: 0, face: 1, move: { axis: 'x', min: 10.6, max: 12.0, speed: 1.05, phase: 1.1 } },
    ] },
    { id: 'reta', targets: [
      { id: 'e23', kind: 'enemy', name: 'Javali do fim', x: 13.65, z: -8.6, y: 0, face: 1 },
      { id: 'e24', kind: 'enemy', name: 'Javali da chegada', x: 14.75, z: -11.1, y: 0, face: 1 },
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
    if (dx * dx + dz * dz <= 2.4 * 2.4 && Math.abs((y || 0) - midY) < 1.6) return true;
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

  // 1. Largada comprida, sacos e a torre ao lado do eixo.
  wall(-8.2, -22.3, 8.2, -21.85, 2.6, 0, 'concrete');
  wall(-8.2, -22.3, -7.75, -10.5, 2.6, 0, 'concrete');
  wall(7.75, -22.3, 8.2, -18.7, 2.6, 0, 'concrete');
  wall(7.75, -15.3, 8.2, -10.5, 2.6, 0, 'concrete');
  wall(-8.2, -11.45, -1.55, -10.9, 2.4, 0, 'bag');
  wall(1.55, -11.45, 8.2, -10.9, 2.4, 0, 'bag');
  add(-3.75, 0, -16.95, -3.35, 2.42, -16.5, { tone: 'wood' });
  add(-2.05, 0, -16.95, -1.65, 2.42, -16.5, { tone: 'wood' });
  slab(-3.8, -17.05, -1.6, -15.2, 2.7, 'wood', 0.28);
  wall(-4.45, -22.2, -4.05, -17.95, 2.6, 0, 'fence');
  wall(-4.45, -16.15, -4.05, -11.5, 2.6, 0, 'fence');
  wall(4.05, -22.2, 4.45, -17.95, 2.6, 0, 'fence');
  wall(4.05, -16.15, 4.45, -11.5, 2.6, 0, 'fence');

  // 2. Pátio longo e a fachada. O vão do meio é a porta.
  wall(-10.3, -10.6, -9.85, 15.3, 2.5, 0, 'concrete');
  wall(9.85, -10.6, 10.3, 15.3, 2.5, 0, 'concrete');
  wall(-3.55, -10.55, -3.15, 15.15, 2.6, 0, 'fence');
  wall(3.15, -10.55, 3.55, 15.15, 2.6, 0, 'fence');
  wall(-10.3, 15.35, -1.7, 15.85, 3.6, 0, 'concrete');
  wall(1.7, 15.35, 10.3, 15.85, 3.6, 0, 'concrete');
  slab(-7.2, 15.15, 7.2, 17.35, ROOF, 'concrete', 0.26);
  slab(-7.6, 16.1, 7.6, 30.4, 3.38, 'concrete', 0.3);

  // 3. Sala e o corredor da curva, bem mais comprido.
  wall(-8.25, 15.85, -7.8, 24.4, H, 0, 'concrete');
  wall(-8.25, 29.5, -7.8, 32.1, H, 0, 'concrete');
  wall(7.8, 15.85, 8.25, 32.1, H, 0, 'concrete');
  wall(-8.25, 31.7, 8.25, 32.15, H, 0, 'concrete');
  wall(2.15, 16.05, 2.55, 28.75, 2.6, 0, 'concrete');
  wall(-2.55, 16.05, -2.15, 25.55, 2.6, 0, 'concrete');
  wall(-8.3, 25.35, -2.15, 25.75, 2.6, 0, 'concrete');
  wall(-2.1, 28.9, 8.25, 29.3, 2.6, 0, 'concrete');
  wall(-28.4, 24.55, -8.25, 25.05, H, 0, 'concrete');
  wall(-28.4, 24.55, -27.95, 30.6, H, 0, 'concrete');
  wall(-22.4, 29.35, -8.25, 29.85, H, 0, 'concrete');
  wall(-28.4, 14.6, -10.3, 15.05, 2.6, 0, 'concrete');

  // 4. Escada longa. As placas ficam na frente, no próprio lance.
  ramp(-25.85, R0, -22.55, R1, 0, DECK, 'z', 1);
  wall(-26.45, R0, -25.95, 42.6, 4.4, 0, 'concrete');
  wall(-22.4, R0, -21.95, 42.05, 4.4, 0, 'concrete');

  // 5. Passarela longa. A ponta leste fica aberta pro pulo.
  slab(-26.3, 42.45, -22.2, 44.85, DECK, 'metal');
  slab(-22.2, 41.65, 7.6, 44.85, DECK, 'metal');
  wall(-21.5, 41.15, 5.05, 41.55, 2.3, DECK, 'metal');
  wall(-26.3, 44.85, 7.2, 45.25, 2.3, DECK, 'metal');
  wall(7.2, 41.65, 7.65, 44.85, 1.05, DECK, 'metal');
  wall(-20, 33, 2, 41.2, 4.3, 0, 'concrete');

  // 6. Pátio de baixo, longo, fechado a oeste.
  wall(4.15, 14.2, 4.6, 45.5, 2.6, 0, 'fence');
  wall(15.75, 15.4, 16.2, 45.5, 2.6, 0, 'fence');
  wall(4.6, 32.55, 6.5, 33.0, 2.6, 0, 'concrete');
  wall(11.95, 32.55, 16.2, 33.0, 2.6, 0, 'concrete');
  wall(4.55, 31.6, 6.6, 41.35, 2.6, 0, 'fence');
  wall(11.45, 31.6, 16.25, 41.35, 2.6, 0, 'fence');
  wall(4.6, 14.85, 12.55, 15.3, 2.6, 0, 'concrete');

  // 7. Corredor de grades, longo, e a volta até a largada.
  wall(12.65, -12.45, 13.1, 16.6, 2.9, 0, 'fence');
  wall(15.35, -18.2, 15.8, 16.6, 2.9, 0, 'fence');
  wall(8.3, -12.6, 12.7, -12.2, 2.6, 0, 'fence');
  wall(9.7, -14.25, 15.9, -13.85, 2.6, 0, 'fence');
  wall(8.2, -10.35, 12.75, -9.95, 2.6, 0, 'concrete');
  wall(10.65, -18.6, 11.05, -14.15, 2.6, 0, 'concrete');
  wall(8.25, -19.25, 16.6, -18.85, 2.6, 0, 'concrete');
  wall(-29.2, -10.55, -8.2, -10.15, 2.6, 0, 'fence');
  wall(10.2, -16.35, 16.4, -15.9, 2.6, 0, 'fence');
  wall(-29.2, -22.5, 16.8, -22.1, 2.8, 0, 'fence');
  wall(-29.2, -22.5, -28.8, 45.6, 2.8, 0, 'concrete');
  wall(-28.8, 45.15, 16.9, 45.6, 2.8, 0, 'concrete');
  wall(16.5, -22.5, 16.95, 45.6, 2.8, 0, 'concrete');
  slab(-7.2, 15.2, 7.2, 17.3, 3.84, 'snow', 0.08);

  // 8. Portão de alambrado colado na largada.
  for (const z0 of [-18.55, -15.85]) wall(7.15, z0, 7.5, z0 + 0.42, 2.35, 0, 'fence');
  return out;
}

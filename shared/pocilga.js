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
const R0 = 11.7;
const R1 = 17.3;
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
  star3: 35,
  star2: 45,
  sprint: 1.45,
  deck: DECK,
  roof: ROOF,
  stair: { x: -12.2, z0: R0, z1: R1, y: DECK },
  spawn: [0, -11.4],
  spawnYaw: Math.atan2(3.8, -3.2), // olha o Barriguinha, à frente e à esquerda
  tower: { x: -3.8, z: -8.2, y: 2.7 },
  path: [
    { x: 0, z: -11.4, y: 0 },
    { x: 0, z: -4.2, y: 0 },
    { x: 0, z: 2.2, y: 0 },
    { x: 0, z: 8.2, y: 0 },
    { x: -11.2, z: 9.7, y: 0 },
    { x: -12.2, z: 12.2, y: rampY(12.2) },
    { x: -12.2, z: 16.5, y: rampY(16.5) },
    { x: -12.2, z: 17.6, y: DECK },
    { x: 5.2, z: 17.6, y: DECK },
    { x: 10.6, z: 12.0, y: 0, drop: true },
    { x: 12.3, z: 6.2, y: 0 },
    { x: 12.3, z: -4.4, y: 0, sprint: true },
    { x: 8.6, z: -4.4, y: 0, sprint: true },
    { x: 8.6, z: -9.9, y: 0, sprint: true },
    { x: 4.2, z: -10.0, y: 0, sprint: true },
  ],
  gates: [
    { id: 'start', x: 0, z: -4.2, y: 0, r: 2.05, pop: 'patio' },
    { id: 'fachada', x: 0, z: 2.2, y: 0, r: 2.05, pop: 'fachada', say: 'Olha o canto!' },
    { id: 'sala', x: -5.2, z: 9.2, y: 0, r: 2.3, pop: 'sala' },
    { id: 'escada', x: -12.2, z: 12.4, y: 0.4, r: 2.1, pop: 'escada', say: 'Sobe a escada!' },
    { id: 'passa', x: -2.5, z: 17.6, y: DECK, r: 2.3, pop: 'passa' },
    { id: 'pulo', x: 4.4, z: 17.6, y: DECK, r: 1.7, say: 'Pula!' },
    { id: 'baixo', x: 10.6, z: 12.0, y: 0, r: 2.5, pop: 'pulo' },
    { id: 'corre', x: 12.3, z: 5.2, y: 0, r: 1.8, say: 'Corre!' },
    { id: 'reta', x: 12.3, z: 0.2, y: 0, r: 1.9, pop: 'reta' },
    { id: 'finish', x: 4.2, z: -10.0, y: 0, r: 1.55 },
  ],
  bays: [
    { id: 'patio', targets: [
      { id: 'e1', kind: 'enemy', name: 'Javali da porteira', x: -3.3, z: -1.1, y: 0, face: -1 },
      { id: 'e2', kind: 'enemy', name: 'Javali do meio', x: 2.7, z: 0.2, y: 0, face: -1 },
      { id: 'e3', kind: 'enemy', name: 'Javali do pátio', x: -0.4, z: 1.5, y: 0, face: -1 },
    ] },
    { id: 'fachada', targets: [
      { id: 'e4', kind: 'enemy', name: 'Javali do telhado', x: 0, z: 5.5, y: ROOF, face: -1, move: { axis: 'x', min: -3.1, max: 3.1, speed: 0.95, phase: 0.2 } },
      { id: 'e5', kind: 'enemy', name: 'Javali da esquerda', x: -2.5, z: 3.45, y: 0, face: -1 },
      { id: 'e6', kind: 'enemy', name: 'Javali da direita', x: 2.45, z: 3.45, y: 0, face: -1 },
      { id: 'c1', kind: 'civil', name: 'Leitão da fachada', x: 0.15, z: 3.35, y: 0, face: -1 },
    ] },
    { id: 'sala', targets: [
      { id: 'e7', kind: 'enemy', name: 'Javali da sala', x: -13.05, z: 8.4, y: 0, face: 'x' },
      { id: 'e8', kind: 'enemy', name: 'Javali do canto', x: -13.05, z: 9.4, y: 0, face: 'x' },
      { id: 'e9', kind: 'enemy', name: 'Javali do fundo', x: -13.05, z: 10.4, y: 0, face: 'x' },
      { id: 'e10', kind: 'enemy', name: 'Javali do trilho', x: -9.6, z: 11.15, y: 0, face: 'x', move: { axis: 'x', min: -10.5, max: -8.7, speed: 1.05, phase: 0.6 } },
      { id: 'e11', kind: 'enemy', name: 'Javali da curva', x: -12.15, z: 8.85, y: 0, face: 'x' },
      { id: 'c2', kind: 'civil', name: 'Porquinho da sala', x: -12.15, z: 10.0, y: 0, face: 'x' },
    ] },
    { id: 'escada', targets: [
      { id: 'e12', kind: 'enemy', name: 'Javali da janela', x: -9.45, z: 13.15, y: 0, face: '-x' },
      { id: 'e13', kind: 'enemy', name: 'Javali do meio da escada', x: -9.45, z: 14.7, y: 0, face: '-x' },
      { id: 'e14', kind: 'enemy', name: 'Javali de cima', x: -9.45, z: 15.95, y: 0, face: '-x' },
    ] },
    { id: 'passa', targets: [
      { id: 'e15', kind: 'enemy', name: 'Javali no peito', x: -3.2, z: 18.55, y: DECK, face: '-x', close: true },
      { id: 'e16', kind: 'enemy', name: 'Javali da passarela', x: 0.6, z: 18.55, y: DECK, face: '-x' },
      { id: 'e17', kind: 'enemy', name: 'Javali do corrimão', x: 3.15, z: 18.5, y: DECK, face: '-x' },
      { id: 'c3', kind: 'civil', name: 'Porquinha da passarela', x: -1.15, z: 16.55, y: DECK, face: '-x' },
      { id: 'c4', kind: 'civil', name: 'Leitão da passarela', x: 1.9, z: 16.55, y: DECK, face: '-x' },
    ] },
    { id: 'pulo', targets: [
      { id: 'e18', kind: 'enemy', name: 'Javali da queda', x: 6.7, z: 13.35, y: 0, face: 1 },
      { id: 'e19', kind: 'enemy', name: 'Javali do pátio baixo', x: 9.15, z: 13.05, y: 0, face: 1 },
      { id: 'e20', kind: 'enemy', name: 'Javali da cerca baixa', x: 6.7, z: 6.95, y: 0, face: 1 },
      { id: 'c5', kind: 'civil', name: 'Vovó do carro', x: 9.45, z: 11.35, y: 0, face: 1 },
      { id: 'e21', kind: 'enemy', name: 'Javali do carro', x: 9.25, z: 8.7, y: 0, face: 1 },
      { id: 'e22', kind: 'enemy', name: 'Javali atrás do carro', x: 7.3, z: 7.55, y: 0, face: 1, move: { axis: 'x', min: 6.2, max: 8.4, speed: 1.15, phase: 1.1 } },
    ] },
    { id: 'reta', targets: [
      { id: 'e23', kind: 'enemy', name: 'Javali do fim', x: 10.85, z: -3.35, y: 0, face: 1 },
      { id: 'e24', kind: 'enemy', name: 'Javali da chegada', x: 13.55, z: -3.7, y: 0, face: 1 },
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

  // 1. Largada: curral, sacos e a torre ao lado, sem laje em cima do eixo.
  wall(-6.4, -13.7, 6.4, -13.3, 2.6, 0, 'concrete');
  wall(-6.4, -13.7, -6.0, -4.5, 2.6, 0, 'concrete');
  wall(6.0, -13.7, 6.4, -11.2, 2.6, 0, 'concrete');
  wall(6.0, -8.5, 6.4, -4.5, 2.6, 0, 'concrete');
  wall(-6.4, -4.95, -1.3, -4.45, 1.05, 0, 'bag');
  wall(1.3, -4.95, 6.4, -4.45, 1.05, 0, 'bag');
  add(-4.95, 0, -8.95, -4.55, 2.42, -8.55, { tone: 'wood' });
  add(-3.05, 0, -8.95, -2.65, 2.42, -8.55, { tone: 'wood' });
  slab(-4.95, -8.95, -2.65, -7.35, 2.7, 'wood', 0.28);

  // 2. Pátio e fachada de concreto. O vão do meio é a porta.
  wall(-7.35, -4.6, -6.95, 5.15, 2.5, 0, 'concrete');
  wall(6.95, -4.6, 7.35, 5.15, 2.5, 0, 'concrete');
  wall(-7.35, 4.7, -1.45, 5.15, 3.6, 0, 'concrete');
  wall(1.45, 4.7, 7.35, 5.15, 3.6, 0, 'concrete');
  slab(-6.3, 4.55, 6.3, 6.25, ROOF, 'concrete', 0.26);
  slab(-5.7, 5.25, 4.75, 12.35, 3.35, 'concrete', 0.3);

  // 3. Sala térrea e a curva à esquerda.
  wall(-6.35, 5.15, -5.95, 7.75, H, 0, 'concrete');
  wall(-6.35, 11.75, -5.95, 12.95, H, 0, 'concrete');
  wall(4.75, 5.15, 5.15, 12.95, H, 0, 'concrete');
  wall(-5.95, 12.55, 5.15, 12.95, H, 0, 'concrete');
  wall(-14.25, 7.55, -6.35, 7.95, H, 0, 'concrete');
  wall(-14.25, 7.95, -13.85, 12.45, H, 0, 'concrete');
  wall(-10.5, 12.05, -6.35, 12.45, H, 0, 'concrete');
  wall(-14.25, 4.85, -6.95, 5.25, 2.6, 0, 'concrete');

  // 4. Escada estreita. Os vãos do lado leste são as janelas.
  ramp(-13.05, R0, -11.35, R1, 0, DECK, 'z', 1);
  wall(-13.7, R0, -13.2, 16.7, 4.3, 0, 'concrete');
  wall(-11.2, R0, -10.75, 12.5, 4.3, 0, 'concrete');
  wall(-11.2, 13.8, -10.75, 14.1, 4.3, 0, 'concrete');
  wall(-11.2, 15.35, -10.75, 15.65, 4.3, 0, 'concrete');
  wall(-8.7, 12.7, -8.3, 16.7, 4.3, 0, 'concrete');

  // 5. Passarela metálica. A ponta leste fica aberta pro pulo.
  slab(-13.7, 16.95, -9.7, 19.15, DECK, 'metal');
  slab(-9.7, 16.1, 6.5, 19.15, DECK, 'metal');
  wall(-9.6, 15.7, 3.9, 16.08, 1.05, DECK, 'metal');
  wall(-13.7, 19.15, 6.5, 19.55, 1.05, DECK, 'metal');
  wall(6.15, 16.1, 6.55, 19.15, 1.05, DECK, 'metal');
  wall(-4.6, 13.05, 4.5, 15.95, 4.2, 0, 'concrete');

  // 6. Pátio de baixo, fechado a oeste pra não voltar no prédio.
  wall(5.35, 5.05, 5.75, 14.6, 2.6, 0, 'fence');
  wall(5.15, 4.8, 10.75, 5.2, 2.6, 0, 'concrete');

  // 7. Corredor de grades e o curral do fim.
  wall(10.85, -2.55, 11.25, 5.7, 2.9, 0, 'fence');
  wall(13.85, -6.35, 14.25, 6.6, 2.9, 0, 'fence');
  wall(9.4, -6.35, 14.25, -5.95, 2.6, 0, 'fence');
  wall(-14.25, 5.15, -13.85, 19.4, 2.8, 0, 'concrete');
  wall(-14.25, 19.15, 14.7, 19.55, 2.8, 0, 'concrete');
  wall(14.45, -11.2, 14.85, 19.55, 2.8, 0, 'concrete');

  // 8. Portão de alambrado na volta, colado na largada.
  for (const z0 of [-11.15, -8.95]) wall(5.25, z0, 5.55, z0 + 0.42, 2.35, 0, 'fence');
  return out;
}

// ============================================================
//  A Pocilga — circuito solo (cliente offline + validação do ranking).
//  O desenho segue o percurso descrito do The Pit (pátio, fachada, sala
//  com curva, escada, passarela, pulo e o último corredor entrando pelos
//  fundos da sala da largada). Sem asset do COD. Só a Pistolinha Leitão; a faca, se já
//  existir no jogo, também derruba o Barriguinha que está ao alcance.
//
//  Barriguinha esquecido trava a chegada. Civil soma tempo e tira as 3 estrelas.
//  O ranking recusa diário incompleto ou relógio claramente impossível
//  (abaixo de PIT.rankMin). O modelo de deslocamento é mais lento que o jogo.
//  Sem DOM e sem Three.js.
// ============================================================
import { SPEED, KNIFE } from './rules.js';
import { bonusShape, readBonus, setBonusCut } from './pocilga-bonus.js';

export const BOARD = { w: 1.05, h: 1.85, d: 0.12, y: 0.02 };
const H = 2.8;
const DECK = 5.2;
const R0 = 28;
const R1 = 48;
const WALLTOP = 2.9;
const ROUND = (n) => Math.round(n * 1000) / 1000;
const rampY = (z) => ROUND((z - R0) / (R1 - R0) * DECK);

// O texto do vídeo lista 4 civis e pede 5 no total. O quinto fica na fachada.
export const PIT = {
  mode: 'pocilga',
  map: 'pocilga',
  title: 'Pistoleiro da Pocilga',
  pistol: 4,
  knife: KNIFE,
  civPenalty: 3,
  // Alvo de bônus tira até estes segundos do relógio final.
  bonusCut: 2,
  // Piso folgado do ranking: só recusa tempo claramente impossível.
  // 21,17 s já foi corrida humana em produção, abaixo do minPlausible().
  rankMin: 10,
  zombie: { speed: 3.2, reach: 1.65, penalty: 3 },
  // Ajuste fino: rise = segundos até a placa ficar em pé; lead = metros de eixo
  // antes do grupo em que o gatilho deve armar.
  rise: 0.18,
  lead: 12,
  star3: 52,
  star2: 66,
  sprint: 1.45,
  deck: DECK,
  roof: WALLTOP,
  stair: { x: 0, z0: R0, z1: R1, y: DECK },
  spawn: [14.6, -18],
  spawnYaw: Math.PI,
  tower: { x: 11.4, z: -16.9, y: 2.7 },
  path: [
    { x: 14.6, z: -18, y: 0 },
    { x: 14.2, z: -10.2, y: 0 },
    { x: 14.2, z: 6, y: 0 },
    { x: 14.2, z: 16, y: 0 },
    { x: 14.2, z: 24, y: 0 },
    { x: 0, z: 24, y: 0 },
    { x: 0, z: R0, y: 0 },
    { x: 0, z: 35, y: rampY(35) },
    { x: 0, z: 42, y: rampY(42) },
    { x: 0, z: R1, y: DECK },
    { x: 0, z: 50.5, y: DECK },
    { x: 26, z: 50.5, y: DECK },
    { x: 32, z: 50.5, y: 0, drop: true },
    { x: 31.8, z: 20, y: 0, sprint: true },
    { x: 31.8, z: -21.5, y: 0, sprint: true },
    { x: 31.8, z: -26.2, y: 0, scenic: true },
    { x: 12.25, z: -26.2, y: 0, scenic: true },
    { x: 12.25, z: -19.5, y: 0, scenic: true },
  ],
  gates: [
    // Faixa de parede a parede. x,z ficam dentro da faixa (os testes medem dali).
    { id: 'start', x: 14.2, z: -9.4, y: 0, x0: 9.7, x1: 18.7, z0: -10.05, z1: -8.7, pop: 'patio' },
    { id: 'meio', x: 14.2, z: -1.6, y: 0, x0: 9.65, x1: 18.85, z0: -2.3, z1: -0.9, pop: 'patio2' },
    { id: 'fundo', x: 14.2, z: 6.6, y: 0, x0: 9.65, x1: 19.15, z0: 5.9, z1: 7.3, pop: 'patio3' },
    { id: 'sala', x: 14.2, z: 12.4, y: 0, x0: 9.65, x1: 19.15, z0: 11.7, z1: 13.1, pop: 'sala', say: 'Em cima do muro!' },
    { id: 'escada', x: 0, z: 26.2, y: 0, x0: -5.7, x1: 19.15, z0: 25.5, z1: 26.9, pop: 'escada', say: 'Sobe a escada!' },
    // Patamar: a saída da rampa, na largura toda. É aqui que os zumbis começam a correr.
    { id: 'passa', x: 0.2, z: 48.2, y: DECK, x0: -6.05, x1: 6.65, z0: 47.4, z1: 49.0, pop: 'passa' },
    { id: 'passa2', x: 8.2, z: 50.5, y: DECK, x0: 7.5, x1: 8.9, z0: 46.2, z1: 54.8, pop: 'passa2' },
    { id: 'pulo', x: 26, z: 50.5, y: DECK, r: 2.2, say: 'Pula!' },
    { id: 'baixo', x: 31.85, z: 42, y: 0, x0: 28.7, x1: 35.05, z0: 41.2, z1: 42.8, pop: 'pulo' },
    { id: 'corre', x: 31.8, z: 8, y: 0, r: 3, say: 'Corre!' },
    // O portão dos fundos só existe para quem já chegou pelo corredor. Da sala, ele continua parede.
    { id: 'abre', x: 12.25, z: -24.2, y: 0, r: 1.15, open: true },
    { id: 'finish', x: 11.9, z: -19.5, y: 0, r: 1.55 },
  ],
  bays: [
    { id: 'patio', targets: [
      { id: 'e1', kind: 'enemy', name: 'Barriguinha da porteira', x: 11.0, z: -4.0, y: 0, face: -1 },
      { id: 'e2', kind: 'enemy', name: 'Barriguinha do meio', x: 17.0, z: 0.2, y: 0, face: -1, move: { axis: 'x', min: 16.0, max: 18.0, speed: 0.9, phase: 0.3 } },
    ] },
    { id: 'patio2', targets: [
      { id: 'c1', kind: 'civil', name: 'Leitão do corredor', x: 10.8, z: 4.4, y: 0, face: -1 },
      { id: 'e3', kind: 'enemy', name: 'Barriguinha do pátio', x: 17.2, z: 8.6, y: 0, face: -1 },
    ] },
    { id: 'patio3', targets: [
      { id: 'e4', kind: 'enemy', name: 'Barriguinha do trilho', x: 11.4, z: 12.6, y: 0, face: -1, move: { axis: 'x', min: 10.5, max: 12.4, speed: 0.85, phase: 0.4 } },
      { id: 'e5', kind: 'enemy', name: 'Barriguinha da fileira', x: 17.3, z: 16.6, y: 0, face: -1 },
    ] },
    { id: 'sala', targets: [
      { id: 'e6', kind: 'enemy', name: 'Barriguinha da sala', x: 11, z: 25.5, y: 0, face: -1, move: { axis: 'x', min: 8.5, max: 13.5, speed: 0.8, phase: 0.3 } },
      { id: 'e7', kind: 'enemy', name: 'Barriguinha largo', x: 4.5, z: 25.5, y: 0, face: -1, move: { axis: 'x', min: 2.2, max: 7.2, speed: 0.95, phase: 1.2 } },
      { id: 'e8', kind: 'enemy', name: 'Barriguinha do fundo', x: -1.2, z: 25.8, y: 0, face: -1, move: { axis: 'x', min: -3.4, max: 1.2, speed: 0.85, phase: 0.6 } },
      { id: 'c2', kind: 'civil', name: 'Porquinho da sala', x: 7.5, z: 26.6, y: 0, face: -1, move: { axis: 'x', min: 5.2, max: 10.2, speed: 0.7, phase: 1.4 } },
      { id: 'e9', kind: 'enemy', name: 'Barriguinha do muro', x: -5.42, z: 26.2, y: WALLTOP, face: 'x', move: { axis: 'z', min: 24.8, max: 27.8, speed: 0.8, phase: 0.5 } },
      { id: 'e10', kind: 'enemy', name: 'Barriguinha em cima', x: 11.2, z: 29.42, y: WALLTOP, face: -1, move: { axis: 'x', min: 8.8, max: 13.6, speed: 0.9, phase: 1.0 } },
    ] },
    { id: 'escada', targets: [
      { id: 'e12', kind: 'enemy', name: 'Barriguinha da escada', x: -3.4, z: 33.2, y: rampY(33.2), face: -1, move: { axis: 'x', min: -4.6, max: -2.2, speed: 0.8, phase: 0.2 } },
      { id: 'e13', kind: 'enemy', name: 'Barriguinha do meio da escada', x: 3.2, z: 39.4, y: rampY(39.4), face: -1 },
      { id: 'e14', kind: 'enemy', name: 'Barriguinha de cima', x: -2.8, z: 44.6, y: rampY(44.6), face: -1, move: { axis: 'x', min: -4.2, max: -1.6, speed: 0.85, phase: 1.3 } },
    ] },
    { id: 'passa', targets: [
      { id: 'c3', kind: 'civil', name: 'Porquinha da passarela', x: 13.4, z: 47.4, y: DECK, face: '-x' },
      { id: 'e15', kind: 'enemy', name: 'Barriguinha do muro alto', x: 15.8, z: 54.25, y: DECK + 1.35, face: '-x' },
      { id: 'z1', kind: 'enemy', zombie: true, name: 'Podre da esquerda', x: 26.2, z: 49.1, y: DECK, face: '-x' },
      { id: 'z2', kind: 'enemy', zombie: true, name: 'Podre da direita', x: 27.1, z: 52.2, y: DECK, face: '-x' },
    ] },
    { id: 'passa2', targets: [
      { id: 'c4', kind: 'civil', name: 'Leitão da passarela', x: 19.6, z: 53.6, y: DECK, face: '-x' },
      { id: 'e16', kind: 'enemy', name: 'Barriguinha atrás do caixote', x: 22.5, z: 47.7, y: DECK, face: '-x', close: true },
      { id: 'e17', kind: 'enemy', name: 'Barriguinha que surge de lado', x: 24.6, z: 53.4, y: DECK, face: '-x', move: { axis: 'z', min: 52.2, max: 54.2, speed: 0.85, phase: 0.4 } },
    ] },
    { id: 'pulo', targets: [
      { id: 'e18', kind: 'enemy', name: 'Barriguinha da queda', x: 29.8, z: 32, y: 0, face: 1 },
      { id: 'e19', kind: 'enemy', name: 'Barriguinha do corredor', x: 33.8, z: 26, y: 0, face: 1, move: { axis: 'x', min: 33.0, max: 34.6, speed: 0.85, phase: 0.4 } },
      { id: 'e20', kind: 'enemy', name: 'Barriguinha da reta', x: 29.7, z: 20, y: 0, face: 1 },
      { id: 'c5', kind: 'civil', name: 'Vovó da reta', x: 34.0, z: 14, y: 0, face: 1, move: { axis: 'x', min: 33.2, max: 34.6, speed: 0.7, phase: 0.8 } },
      { id: 'e21', kind: 'enemy', name: 'Barriguinha do meio da reta', x: 29.8, z: 6, y: 0, face: 1 },
      { id: 'e22', kind: 'enemy', name: 'Barriguinha que cruza', x: 33.8, z: -2, y: 0, face: 1, move: { axis: 'x', min: 33.0, max: 34.6, speed: 0.9, phase: 1.1 } },
      { id: 'e23', kind: 'enemy', name: 'Barriguinha do fim', x: 29.8, z: -10, y: 0, face: 1 },
      { id: 'e24', kind: 'enemy', name: 'Barriguinha da chegada', x: 33.9, z: -18, y: 0, face: 1 },
    ] },
  ],
};

setBonusCut(PIT.bonusCut);

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
    if (PIT.path[i].scenic) continue;
    const len = segLen(PIT.path[i - 1], PIT.path[i]);
    if (PIT.path[i].sprint) dash += len; else run += len;
  }
  return { run: ROUND(run), dash: ROUND(dash), total: ROUND(run + dash) };
}

// Só o deslocamento: no circuito o jogador atira andando, então o piso
// não reserva 0,04 s parado por alvo. Sem isso, um relógio justo menos o
// miolo de bônus caía abaixo do piso e o servidor recusava a corrida.
export function minPlausible() {
  const { run, dash } = pathStats();
  return ROUND(run / SPEED + dash / (SPEED * PIT.sprint));
}

// Piso do ranking: só barra relógio claramente impossível. Não usa
// minPlausible() — o deslocamento teórico é mais lento que o jogo real.
export function rankFloor() {
  const hard = Number.isFinite(PIT.rankMin) ? PIT.rankMin : 10;
  return ROUND(Math.max(0, hard));
}

export function pitRescue(x, y, z) {
  let best = null, bd = 1e9;
  for (let i = 1; i < PIT.path.length; i++) {
    const a = PIT.path[i - 1], b = PIT.path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t };
      const d = Math.hypot(q.x - x, q.z - z);
      if (d < bd) { bd = d; best = q; }
    }
  }
  if (!best || bd <= 9.2) return null;
  return best;
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

export const FINISH_LINE = { x0: 28.7, x1: 35.05, z: -21.5, depth: 0.7 };
export function onFinishLine(pos) {
  if (!pos) return false;
  const L = FINISH_LINE;
  return pos.x >= L.x0 && pos.x <= L.x1 && Math.abs((pos.z || 0) - L.z) <= L.depth && Math.abs((pos.y || 0)) < 2.2;
}

export function onSprint(x, y, z) {
  for (let i = 1; i < PIT.path.length; i++) {
    if (!PIT.path[i].sprint || PIT.path[i].scenic) continue;
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
  if (Math.abs((pos.y || 0) - gate.y) >= 2.2) return false;
  if (gate.x0 != null) return pos.x >= gate.x0 && pos.x <= gate.x1 && pos.z >= gate.z0 && pos.z <= gate.z1;
  const dx = pos.x - gate.x, dz = pos.z - gate.z;
  return dx * dx + dz * dz <= gate.r * gate.r;
}

// Gate pulado conta os anteriores, na ordem do percurso. Devolve null se o bay não existe.
export function fillPops(have, bay) {
  const order = PIT.bays.map((b) => b.id);
  const idx = order.indexOf(bay);
  if (idx < 0) return null;
  const next = Array.isArray(have) ? have.slice() : [];
  for (let i = 0; i <= idx; i++) if (!next.includes(order[i])) next.push(order[i]);
  return next;
}

export function zombiesAwake(pops) {
  const order = PIT.bays.map((b) => b.id);
  const at = order.indexOf('passa');
  return at >= 0 && order.slice(at).some((id) => (pops || []).includes(id));
}

export function starsOf(final, civs, finished) {
  if (!finished) return 0;
  if (final <= PIT.star3 && civs === 0) return 3;
  if (final <= PIT.star2) return 2;
  return 1;
}

export function suggestion(stars) {
  if (stars >= 3) return { id: 'javali', label: 'Barriguinha', hint: 'pesadelo — o curral foi seu' };
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
  bonus: 0, bonusZone: null,
});

function countsAsShot(w) { return w === PIT.pistol || w === PIT.knife; }

export function inspectRun(events) {
  if (!Array.isArray(events) || events.length < 2 || events.length > 80) return empty('diário');
  const targets = new Map(pitTargets().map((t) => [t.id, t]));
  const bayOrder = PIT.bays.map((b) => b.id);
  let prev = -1, started = false, finishT = null;
  const pops = [], down = new Map(), civHit = new Set(), grabs = new Set();
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
      if (typeof e.bay !== 'string' || !bayOrder.includes(e.bay)) return empty('diário');
      if (pops.includes(e.bay)) return empty('ordem');
      const filled = fillPops(pops, e.bay);
      pops.length = 0;
      for (const id of filled) pops.push(id);
      continue;
    }
    if (e.k === 'hit') {
      const t = targets.get(e.id);
      if (!t) return empty('diário');
      if (!countsAsShot(e.w)) continue;
      if (t.kind === 'enemy') {
        if (t.zombie && e.w !== PIT.pistol) continue;
        if (!down.has(t.id)) down.set(t.id, e.t);
      }
      else civHit.add(t.id);
      continue;
    }
    if (e.k === 'grab') {
      const t = targets.get(e.id);
      if (!t || !t.zombie || !pops.includes(t.bay)) return empty('diário');
      if (!down.has(t.id)) down.set(t.id, e.t);
      grabs.add(t.id);
      continue;
    }
    if (e.k === 'finish') {
      if (finishT != null) return empty('ordem');
      if (!onFinishLine({ x: e.x, y: 0, z: e.z })) return empty('linha');
      finishT = e.t;
      continue;
    }
    if (e.k === 'bonus') {
      if (!bonusShape(e)) return empty('diário');
      continue;
    }
    return empty('diário');
  }
  const missed = pitEnemies().filter((t) => !down.has(t.id)).map((t) => t.id);
  const finished = finishT != null && missed.length === 0 && pops.length === PIT.bays.length;
  const civs = civHit.size;
  const grabN = grabs.size;
  const penalty = civs * PIT.civPenalty + grabN * PIT.zombie.penalty;
  const scars = civs + grabN;
  const bonus = readBonus(events, PIT.pistol);
  const final = finished ? ROUND(finishT + penalty + bonus.delta) : null;
  const stars = starsOf(final, scars, finished);
  const reason = !started ? 'largada' : finishT == null ? 'andamento' : missed.length ? 'alvo' : pops.length < PIT.bays.length ? 'sala' : 'ok';
  return {
    ok: finished, ranked: false, reason, started, finished,
    raw: finished ? finishT : null, penalty: finished ? penalty : scars * PIT.civPenalty,
    final, civs, grabs: grabN, stars, missed, down: [...down.keys()], pops: pops.slice(),
    suggestion: suggestion(stars), blocked3: scars > 0,
    bonus: bonus.delta, bonusZone: bonus.zone,
  };
}

// Um desconto só: PIT.bonusCut. final não pode cair mais do que cut abaixo do relógio.
// O piso é o mínimo impossível (PIT.rankMin), não o modelo de deslocamento.
export function rankedRun(events) {
  const run = inspectRun(events);
  if (!run.finished) return run;
  const floor = rankFloor();
  const cut = Number.isFinite(PIT.bonusCut) ? PIT.bonusCut : 0;
  if (!(run.raw + 1e-6 >= floor) || !(run.final + 1e-6 >= floor)) return { ...run, ranked: false, reason: 'rápido' };
  if (run.final + 1e-6 < run.raw - cut) return { ...run, ranked: false, reason: 'rápido' };
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
  events.push({ k: 'finish', t: ROUND(Math.max(t, finish)), x: (FINISH_LINE.x0 + FINISH_LINE.x1) / 2, z: FINISH_LINE.z });
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

  // 1. Sala da largada. A saída do começo é a porta norte. Os fundos são um portão
  // que nasce fechado (door) e um lintel alto: da disparada não se vê a torre por cima.
  wall(7.2, -22.35, 9.15, -21.7, 6.2);
  wall(15.35, -22.35, 16.5, -21.7, 6.2);
  wall(9.15, -22.55, 15.35, -21.65, 2.3, 3.9);
  wall(7.2, -22.3, 7.65, -13.4, 6.2);
  wall(7.2, -13.4, 7.65, -10.15, H);
  wall(16.05, -22.3, 16.5, -10.15, H);
  wall(7.65, -10.6, 12.5, -10.15, H);
  wall(15.5, -10.6, 16.05, -10.15, H);
  add(9.15, 0, -22.6, 15.35, 4.15, -21.6, { hide: true, door: true, tone: 'wood' });
  add(10.85, 0, -17.55, 11.25, 2.42, -17.1, { tone: 'wood' });
  add(11.85, 0, -17.55, 12.25, 2.42, -17.1, { tone: 'wood' });
  slab(10.7, -17.7, 12.35, -16.15, 2.7, 'wood', 0.28);

  // A porta da sala fica curta. O corredor logo abre para 9,2 m e acaba em poucos metros.
  wall(16.05, -10.6, 19.7, -10.15, H);
  wall(9.15, -10.15, 9.6, 3.7, H);
  wall(18.8, -10.15, 19.25, 3.7, H);

  // 3. Sala larga. A parede da esquerda é contínua. A boca da rampa é a única saída.
  wall(9.15, 3.7, 9.6, 20.1, H);
  wall(9.15, 27.7, 9.6, 30.15, H);
  wall(-6.2, 17.85, 9.15, 18.3, WALLTOP);
  wall(19.25, 3.3, 19.7, 3.75, WALLTOP);
  wall(-6.2, 17.85, -5.75, 30.15, WALLTOP);
  wall(19.25, 3.3, 19.7, 30.15, WALLTOP);
  wall(-6.2, 29.7, -4.35, 30.15, WALLTOP);
  wall(4.35, 29.7, 19.7, 30.15, WALLTOP);
  slab(-5.75, 24.4, -5.15, 28.2, WALLTOP, 'concrete', 0.16);
  slab(8.2, 29.15, 14.2, 29.7, WALLTOP, 'concrete', 0.16);

  // 4. Rampa mais longa e mais alta. O topo é o patamar do corredor de cima.
  ramp(-6, R0, 6, R1, 0, DECK, 'z', 1);
  wall(-6.55, R0, -6.1, 55.5, DECK + 2.8);
  wall(6.1, R0, 6.55, 47.2, DECK + 2.8);
  add(6.55, 0, 30.4, 17.2, DECK + 2.4, 46.2, { tone: 'concrete' });

  // 5. Patamar. O miolo embaixo continua cheio.
  slab(-6.55, 47.2, 6.7, 55.5, DECK);
  add(6.55, 0, 46.2, 28.15, DECK, 55.5, { floor: true, tone: 'metal' });
  add(20.35, DECK, 47.15, 21.55, DECK + 1.15, 48.45, { tone: 'wood' });
  wall(-6.55, 54.95, 28.15, 55.45, 2.7, DECK, 'metal');
  wall(6.55, 45.55, 28.15, 46.05, 2.7, DECK, 'metal');

  // 6. Pouso fechado, encostado no limite do mapa. A disparada desce e volta pelo fundo da largada.
  wall(28.15, 54.95, 35.7, 55.45, DECK + 3.4);
  wall(28.15, 45.55, 29.0, 46.05, DECK + 3.4);
  wall(34.7, 45.55, 35.7, 46.05, DECK + 3.4);
  wall(28.15, -22.2, 28.6, 45.55, H, 0, 'fence');
  wall(35.15, -29.2, 35.6, 45.55, H, 0, 'fence');
  wall(8.0, -29.2, 35.6, -28.75, H, 0, 'fence');
  wall(8.0, -29.2, 8.45, -22.3, H, 0, 'fence');
  wall(16.5, -22.35, 28.15, -21.85, 6.2);
  return out;
}

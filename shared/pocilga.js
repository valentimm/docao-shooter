// ============================================================
//  A Pocilga — circuito solo (cliente offline + validação do ranking).
//  Inspirado no espírito de um percurso de estande cronometrado: largada,
//  alvos que levantam, civis que penalizam, troca de arma e reta final.
//  Nada aqui copia mapa, arma ou arte de outro jogo. Sem DOM e sem Three.js.
//
//  Alvo inimigo esquecido: a chegada NÃO abre. No percurso de referência,
//  esquecer um alvo obriga a voltar; uma penalidade só de tempo deixaria
//  pular metade do circuito e ainda assim entrar no ranking. O civil não
//  trava a chegada: soma segundos e, se houve algum, tira as 3 estrelas.
//
//  O relógio esportivo é o do cliente. O ranking só aceita o diário se a
//  ordem fecha (largada, salas, troca, todos os javalis, chegada) e o tempo
//  bruto não é menor que o mínimo físico (distância / velocidade do jogo).
// ============================================================
import { SPEED } from './rules.js';

export const BOARD = { w: 1.05, h: 1.85, d: 0.1, y: 0.02 };

export const PIT = {
  mode: 'pocilga',
  map: 'pocilga',
  title: 'A Pocilga',
  rifle: 0, // Fuzil Pururuca
  pistol: 4, // Pistolinha Leitão
  civPenalty: 3, // segundos somados ao tempo, por civil acertado
  star3: 42, // tempo final (já com penalidade), sem nenhum civil
  star2: 60, // tempo final; civil não tira as 2 estrelas
  sprint: 1.45, // a reta final não tem tecla de corrida (Shift agacha): o percurso acelera
  startZ: -6,
  sprintZ: 56,
  finishZ: 70,
  swapZ: 39,
  spawn: [0, -12],
  rooms: [
    { id: 'patio', z0: -16, z1: -6, hx: 5 },
    { id: 'sala1', z0: -6, z1: 12, hx: 6 },
    { id: 'corredor1', z0: 12, z1: 18, hx: 2.35 },
    { id: 'feira', z0: 18, z1: 36, hx: 6.6 },
    { id: 'troca', z0: 36, z1: 42, hx: 2.45 },
    { id: 'galpao', z0: 42, z1: 56, hx: 6.2 },
    { id: 'reta', z0: 56, z1: 74, hx: 2.35 },
  ],
  bays: [
    { id: 'b1', popZ: -2, need: 'any', targets: [
      { id: 'e1', kind: 'enemy', name: 'Javali da porteira', x: -3.1, z: 7 },
      { id: 'e2', kind: 'enemy', name: 'Javali do meio', x: 0, z: 8.2 },
      { id: 'e3', kind: 'enemy', name: 'Javali da cerca', x: 3.1, z: 7 },
    ] },
    { id: 'b2', popZ: 20, need: 'any', targets: [
      { id: 'e4', kind: 'enemy', name: 'Javali da banca', x: -4.4, z: 28 },
      { id: 'c1', kind: 'civil', name: 'Leitão do algodão-doce', x: -2.2, z: 25.6 },
      { id: 'e5', kind: 'enemy', name: 'Javali do milho', x: 0.2, z: 28.6 },
      { id: 'c2', kind: 'civil', name: 'Porquinha da flor', x: 2.3, z: 25.4 },
      { id: 'e6', kind: 'enemy', name: 'Javali do tambor', x: 4.5, z: 28 },
    ] },
    { id: 'b3', popZ: 44, need: 'pistol', targets: [
      { id: 'e7', kind: 'enemy', name: 'Javali do galpão', x: -3.6, z: 50 },
      { id: 'e8', kind: 'enemy', name: 'Javali da janela', x: -1.2, z: 51.4 },
      { id: 'c3', kind: 'civil', name: 'Vovó do chiqueiro', x: 0.7, z: 48.2 },
      { id: 'e9', kind: 'enemy', name: 'Javali do feno', x: 2.4, z: 50.6 },
      { id: 'e10', kind: 'enemy', name: 'Javali da chegada', x: 4.3, z: 49.4 },
    ] },
  ],
};

const ROUND = (n) => Math.round(n * 1000) / 1000;

export function pitTargets() {
  const out = [];
  for (const b of PIT.bays) for (const t of b.targets) out.push({ ...t, bay: b.id, need: b.need });
  return out;
}
export function pitTarget(id) { return pitTargets().find((t) => t.id === id) || null; }
export function pitEnemies() { return pitTargets().filter((t) => t.kind === 'enemy'); }
export function pitCivils() { return pitTargets().filter((t) => t.kind === 'civil'); }
export const pitBay = (id) => PIT.bays.find((b) => b.id === id) || null;

// Caixa do papelão em pé, no chão y = ground. Deitada não usa esta caixa.
export function boardAabb(t, ground = 0) {
  const hw = BOARD.w / 2, hd = BOARD.d / 2, y0 = ground + BOARD.y;
  return { minX: t.x - hw, maxX: t.x + hw, minY: y0, maxY: y0 + BOARD.h, minZ: t.z - hd, maxZ: t.z + hd };
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

// Tempo mínimo para ir da faixa amarela à vermelha na velocidade do jogo, mais um
// intervalo curto por javali (dá para atirar andando). Abaixo disso o ranking recusa.
export function minPlausible() {
  const run = (PIT.sprintZ - PIT.startZ) / SPEED;
  const dash = (PIT.finishZ - PIT.sprintZ) / (SPEED * PIT.sprint);
  return ROUND(run + dash + pitEnemies().length * 0.04);
}

export function starsOf(final, civs, finished) {
  if (!finished) return 0;
  if (final <= PIT.star3 && civs === 0) return 3;
  if (final <= PIT.star2) return 2;
  return 1;
}

export function suggestion(stars) {
  if (stars >= 3) return { id: 'javali', label: 'Javali', hint: 'pesadelo — o curso foi seu' };
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

const empty = (reason, extra = {}) => ({
  ok: false, ranked: false, reason, started: false, finished: false,
  raw: null, penalty: 0, final: null, civs: 0, stars: 0, missed: pitEnemies().map((t) => t.id),
  down: [], pops: [], swapped: false, suggestion: suggestion(0), blocked3: false, ...extra,
});

// Lê o diário na ordem em que chegou. Não reordena: empate de tempo respeita a sequência.
export function inspectRun(events) {
  if (!Array.isArray(events) || events.length < 2 || events.length > 40) return empty('diário');
  const targets = new Map(pitTargets().map((t) => [t.id, t]));
  const bayOrder = PIT.bays.map((b) => b.id);
  let prev = -1;
  let started = false, finishT = null, swapT = null;
  const pops = [];
  const down = new Map();
  const civHit = new Set();
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
    if (e.k === 'swap') {
      if (swapT != null || e.w !== PIT.pistol) return empty('arma');
      swapT = e.t;
      continue;
    }
    if (e.k === 'hit') {
      const t = targets.get(e.id);
      if (!t || (e.w !== PIT.rifle && e.w !== PIT.pistol)) return empty('diário');
      if (!pops.includes(t.bay)) continue; // tiro antes da sala levantar não conta
      if (t.need === 'pistol' && !(swapT != null && e.t + 1e-9 >= swapT && e.w === PIT.pistol)) continue;
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
  const finished = finishT != null && missed.length === 0 && pops.length === PIT.bays.length && swapT != null && swapT <= finishT;
  const raw = finishT;
  const civs = civHit.size;
  const penalty = civs * PIT.civPenalty;
  const final = finished ? ROUND(raw + penalty) : null;
  const stars = starsOf(final, civs, finished);
  const reason = !started ? 'largada' : finishT == null ? 'andamento' : swapT == null ? 'arma' : missed.length ? 'alvo' : pops.length < PIT.bays.length ? 'sala' : 'ok';
  return {
    ok: finished, ranked: false, reason, started, finished,
    raw: finished ? raw : null, penalty: finished ? penalty : civs * PIT.civPenalty,
    final, civs, stars, missed, down: [...down.keys()], pops: pops.slice(),
    swapped: swapT != null, suggestion: suggestion(stars), blocked3: civs > 0,
  };
}

// Ranking: a corrida esportiva tem que fechar e o bruto não pode ser teleporte.
export function rankedRun(events) {
  const run = inspectRun(events);
  if (!run.finished) return run;
  const floor = minPlausible();
  if (!(run.raw + 1e-6 >= floor)) return { ...run, ranked: false, reason: 'rápido' };
  return { ...run, ranked: true, reason: 'ok' };
}

// Diário sintético para teste. `finish` é o tempo bruto na faixa vermelha.
export function scriptRun({ finish = 36, civs = [], skip = [], swap = true, latePistol = false } = {}) {
  const events = [{ k: 'start', t: 0 }];
  let t = 0.2;
  for (const b of PIT.bays) {
    events.push({ k: 'pop', bay: b.id, t: ROUND(t) });
    t += 0.25;
    if (b.id === 'b3' && swap) { events.push({ k: 'swap', w: PIT.pistol, t: ROUND(t) }); t += 0.2; }
    for (const tgt of b.targets) {
      if (tgt.kind === 'enemy' && skip.includes(tgt.id)) continue;
      if (tgt.kind === 'civil' && !civs.includes(tgt.id)) continue;
      const w = b.need === 'pistol' ? (latePistol ? PIT.rifle : PIT.pistol) : PIT.rifle;
      events.push({ k: 'hit', id: tgt.id, w, t: ROUND(t) });
      t += 0.12;
    }
  }
  events.push({ k: 'finish', t: ROUND(Math.max(t, finish)) });
  return events;
}

// Sólidos do percurso (paredes, ombreiras, bancada). O vão central fica livre.
const WALL_T = 0.45, WALL_H = 3.2;
export function pitAabbs() {
  const out = [];
  const wall = (x0, z0, x1, z1, y1 = WALL_H) => {
    out.push([Math.min(x0, x1), 0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1)]);
  };
  const rooms = PIT.rooms;
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    wall(-r.hx - WALL_T, r.z0, -r.hx, r.z1);
    wall(r.hx, r.z0, r.hx + WALL_T, r.z1);
    if (i + 1 < rooms.length) {
      const n = rooms[i + 1];
      const door = Math.min(r.hx, n.hx);
      const wide = Math.max(r.hx, n.hx) + WALL_T;
      if (wide - door > 0.2) {
        wall(-wide, r.z1 - WALL_T / 2, -door, r.z1 + WALL_T / 2);
        wall(door, r.z1 - WALL_T / 2, wide, r.z1 + WALL_T / 2);
      }
    }
  }
  const last = rooms[rooms.length - 1];
  wall(-last.hx, last.z1, last.hx, last.z1 + WALL_T);
  const patio = rooms[0];
  const gate = 1.6;
  wall(-patio.hx, patio.z0 - WALL_T, -gate, patio.z0);
  wall(gate, patio.z0 - WALL_T, patio.hx, patio.z0);
  wall(1.2, 38.15, 2.2, 39.7, 0.9); // bancada da Pistolinha, encostada na parede direita
  wall(-5.35, 1.1, -4.05, 2.5, 1.05);
  wall(4.7, 22.4, 5.9, 23.7, 1.05);
  wall(-5.5, 46.3, -4.25, 47.6, 1.05);
  return out;
}

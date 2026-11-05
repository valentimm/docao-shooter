// UNO do Docão. Regras puras: cliente e servidor importam daqui.
// Todos contra todos. 2, 4 ou 6 cadeiras. Meta 200 ou 500.
// +2 empilha em +2 e +4 empilha em +4. Não mistura.

export const COLORS = ['r', 'y', 'g', 'b'];
export const COLOR_NAME = { r: 'Vermelho', y: 'Amarelo', g: 'Verde', b: 'Azul' };
export const KIND_NAME = { n: '', skip: 'Pula', rev: 'Inverte', d2: '+2', wild: 'Coringa', d4: '+4' };
export const LEVELS = ['facil', 'medio', 'pro'];
export const LEVEL_NAME = { facil: 'Facinho', medio: 'Médio', pro: 'Docão Profissional' };

export const normSeats = (v) => (v === 4 || v === 6 ? v : 2);
export const normTarget = (v) => (Number(v) === 200 ? 200 : 500);
export const normLevel = (v) => (v === 'medio' || v === 'pro' ? v : 'facil');

export function card(color, kind, n = null, copy = 0) {
  const num = n == null ? 'x' : String(n);
  return { id: color + '-' + kind + '-' + num + '-' + copy, color, kind, n: n == null ? null : n | 0 };
}
export function copyCard(c) {
  return c ? { id: c.id, color: c.color, kind: c.kind, n: c.n == null ? null : c.n } : null;
}
export function freshDeck() {
  const d = [];
  for (const color of COLORS) {
    d.push(card(color, 'n', 0, 0));
    for (let n = 1; n <= 9; n++) { d.push(card(color, 'n', n, 0)); d.push(card(color, 'n', n, 1)); }
    for (const kind of ['skip', 'rev', 'd2']) { d.push(card(color, kind, null, 0)); d.push(card(color, kind, null, 1)); }
  }
  for (let i = 0; i < 4; i++) { d.push(card('w', 'wild', null, i)); d.push(card('w', 'd4', null, i)); }
  return d;
}
export function cardPoints(c) {
  if (!c) return 0;
  if (c.kind === 'n') return c.n | 0;
  if (c.kind === 'wild' || c.kind === 'd4') return 50;
  return 20;
}
export function cardLabel(c) {
  if (!c) return '';
  if (c.kind === 'n') return String(c.n);
  return KIND_NAME[c.kind] || '';
}
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = list[i]; list[i] = list[j]; list[j] = t;
  }
  return list;
}
export function step(state, seat, n = 1) {
  let s = ((seat % state.seats) + state.seats) % state.seats;
  const dir = state.direction === -1 ? -1 : 1;
  for (let i = 0; i < n; i++) s = (s + dir + state.seats) % state.seats;
  return s;
}
function topCard(state) { return state.discard.length ? state.discard[state.discard.length - 1] : null; }
function hasColor(hand, color, exceptId) {
  return (hand || []).some((c) => c && c.id !== exceptId && c.color === color);
}
function sameSymbol(card, top) {
  if (!card || !top) return false;
  if (card.kind === 'n' && top.kind === 'n') return card.n === top.n;
  return card.kind !== 'n' && card.kind === top.kind && card.kind !== 'wild' && card.kind !== 'd4';
}
export function canPlayCard(state, c) {
  if (!c || state.closing >= 0) return false;
  if (state.pendingKind) return c.kind === state.pendingKind;
  if (c.kind === 'wild' || c.kind === 'd4') return true;
  if (c.color === state.color) return true;
  return sameSymbol(c, topCard(state));
}
function playableHand(state, seat) {
  return (state.hands[seat] || []).filter((c) => canPlayCard(state, c));
}
export function cardPlayable(v, c) {
  if (!v || !c || v.turn !== v.you || v.closing >= 0) return false;
  if (v.phase === 'drawn') return c.id === v.drawnId;
  if (v.phase !== 'play') return false;
  if (v.pendingKind) return c.kind === v.pendingKind;
  if (c.kind === 'wild' || c.kind === 'd4') return true;
  if (c.color === v.color) return true;
  const top = v.top;
  if (!top) return false;
  if (c.kind === 'n' && top.kind === 'n') return c.n === top.n;
  return c.kind !== 'n' && c.kind === top.kind && c.kind !== 'wild' && c.kind !== 'd4';
}

export function createMatch(opts = {}) {
  const seats = normSeats(opts.seats);
  const target = normTarget(opts.target);
  const scores = Array.from({ length: seats }, (_, i) => {
    const n = opts.scores && opts.scores[i] | 0;
    return n > 0 ? n : 0;
  });
  const state = {
    seats,
    target,
    scores,
    dealer: ((opts.dealer | 0) % seats + seats) % seats,
    direction: opts.direction === -1 ? -1 : 1,
    rand: opts.rand || rng(opts.seed || 1),
    phase: 'play',
    hands: Array.from({ length: seats }, () => []),
    draw: [],
    discard: [],
    color: '',
    turn: 0,
    pendingDraw: 0,
    pendingKind: '',
    pendingFrom: -1,
    bluff: false,
    forgot: -1,
    uno: Array.from({ length: seats }, () => false),
    drawnId: '',
    openingWild: false,
    closing: -1,
    gap: null,
    winner: null,
    seq: 0,
    deck: Array.isArray(opts.deck) ? opts.deck.map(copyCard) : null,
  };
  if (scores.some((n) => n >= target)) {
    state.phase = 'over';
    state.winner = scores.findIndex((n) => n >= target);
    state.events = [];
    return state;
  }
  if (Array.isArray(opts.hands)) {
    script(state, opts);
    state.events = [];
    return state;
  }
  const events = [];
  openHand(state, events);
  state.events = events;
  return state;
}

function script(state, opts) {
  state.hands = Array.from({ length: state.seats }, (_, i) => ((opts.hands && opts.hands[i]) || []).map(copyCard));
  state.draw = (opts.draw || []).map(copyCard);
  state.discard = (opts.discard || []).map(copyCard);
  const top = topCard(state);
  state.color = COLORS.includes(opts.color) ? opts.color : (top && COLORS.includes(top.color) ? top.color : 'r');
  state.turn = ((opts.turn | 0) % state.seats + state.seats) % state.seats;
  state.direction = opts.direction === -1 ? -1 : 1;
  state.pendingDraw = Math.max(0, opts.pendingDraw | 0);
  state.pendingKind = opts.pendingKind === 'd2' || opts.pendingKind === 'd4' ? opts.pendingKind : '';
  state.pendingFrom = Number.isInteger(opts.pendingFrom) ? opts.pendingFrom : -1;
  state.bluff = !!opts.bluff;
  state.forgot = Number.isInteger(opts.forgot) ? opts.forgot : -1;
  state.drawnId = opts.drawnId || '';
  state.openingWild = !!opts.openingWild;
  state.closing = Number.isInteger(opts.closing) ? opts.closing : -1;
  state.phase = opts.phase || 'play';
  state.uno = Array.from({ length: state.seats }, (_, i) => !!(opts.uno && opts.uno[i]));
}

function take(state, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!state.draw.length) {
      if (state.discard.length <= 1) break;
      const keep = state.discard.pop();
      state.draw = shuffle(state.discard, state.rand);
      state.discard = [keep];
    }
    if (!state.draw.length) break;
    out.push(state.draw.pop());
  }
  return out;
}
function give(state, seat, n) {
  const cards = take(state, n);
  for (const c of cards) state.hands[seat].push(c);
  return cards;
}

function openHand(state, events) {
  if (state.scores.some((n) => n >= state.target)) {
    state.phase = 'over';
    state.winner = state.scores.findIndex((n) => n >= state.target);
    return;
  }
  const deck = state.deck ? state.deck : shuffle(freshDeck(), state.rand);
  state.deck = null;
  state.draw = deck;
  state.discard = [];
  state.hands = Array.from({ length: state.seats }, () => []);
  state.pendingDraw = 0;
  state.pendingKind = '';
  state.pendingFrom = -1;
  state.bluff = false;
  state.forgot = -1;
  state.uno = Array.from({ length: state.seats }, () => false);
  state.drawnId = '';
  state.openingWild = false;
  state.closing = -1;
  state.gap = null;
  state.direction = 1;
  const first = (state.dealer + 1) % state.seats;
  for (let round = 0; round < 7; round++) {
    for (let k = 0; k < state.seats; k++) {
      const cardIn = state.draw.pop();
      if (cardIn) state.hands[(first + k) % state.seats].push(cardIn);
    }
  }
  let top = state.draw.pop();
  let guard = 0;
  while (top && top.kind === 'd4' && guard++ < 16) {
    state.draw.push(top);
    shuffle(state.draw, state.rand);
    top = state.draw.pop();
  }
  state.discard = top ? [top] : [];
  state.color = top && COLORS.includes(top.color) ? top.color : '';
  state.turn = first;
  if (!top) { state.phase = 'play'; return; }
  if (top.kind === 'wild') {
    state.phase = 'color';
    state.openingWild = true;
    state.color = '';
  } else if (top.kind === 'skip') {
    state.turn = (first + 1) % state.seats;
    state.phase = 'play';
  } else if (top.kind === 'rev') {
    state.direction = -1;
    state.turn = state.seats === 2 ? state.dealer : (state.dealer - 1 + state.seats) % state.seats;
    state.phase = 'play';
  } else if (top.kind === 'd2') {
    state.pendingDraw = 2;
    state.pendingKind = 'd2';
    state.pendingFrom = -1;
    state.phase = 'play';
  } else state.phase = 'play';
  events.push({
    t: 'deal', turn: state.turn, color: state.color, top: copyCard(top),
    pendingDraw: state.pendingDraw, direction: state.direction, openingWild: state.openingWild,
  });
}

function armGap(state, turn) {
  state.turn = turn;
  state.phase = 'gap';
  state.gap = { kind: 'turn', turn };
}
function armRound(state, winner) {
  state.phase = 'gap';
  state.gap = { kind: 'round', winner: winner == null ? state.closing : winner };
}

export function dueSeat(state) {
  if (!state || state.phase === 'over' || state.phase === 'gap') return -1;
  if (state.phase === 'play' || state.phase === 'color' || state.phase === 'drawn') return state.turn;
  return -1;
}

export function act(state, seat, action) {
  const events = [];
  const error = reject(state, seat, action);
  if (error) return { ok: false, error, events };
  state.seq++;
  apply(state, seat, action, events);
  state.events = events;
  return { ok: true, events };
}

function reject(state, seat, action) {
  if (!action || state.phase === 'over') return 'A partida já acabou';
  if (seat < 0 || seat >= state.seats) return 'Lugar inválido';
  if (action.t === 'catchUno') {
    if (state.forgot < 0) return 'Ninguém esqueceu o UNO';
    if (seat === state.forgot) return 'Não dá para denunciar a si mesmo';
    return '';
  }
  if (state.phase === 'gap') return 'Espera a mesa';
  if (seat !== state.turn) return 'Espera a sua vez';
  if (action.t === 'color') {
    if (state.phase !== 'color') return 'Agora não é hora de escolher cor';
    if (!COLORS.includes(action.color)) return 'Cor inválida';
    return '';
  }
  if (action.t === 'pass') {
    if (state.phase !== 'drawn') return 'Não tem carta comprada na mesa';
    return '';
  }
  if (action.t === 'challenge') {
    if (state.phase !== 'play') return 'Agora não dá para contestar';
    if (!(state.pendingKind === 'd4' && state.pendingDraw === 4)) return 'Só um +4 sozinho pode ser contestado';
    return '';
  }
  if (action.t === 'draw') {
    if (state.phase !== 'play') return 'Agora não é hora de comprar';
    if (state.pendingDraw > 0) return '';
    if (playableHand(state, seat).length) return 'Você tem carta para jogar';
    return '';
  }
  if (action.t === 'play') {
    if (state.phase !== 'play' && state.phase !== 'drawn') return 'Agora não é hora de jogar carta';
    if (state.closing >= 0) return 'A mão já fechou';
    const hand = state.hands[seat] || [];
    const held = hand.find((c) => c.id === action.id);
    if (!held) return 'Essa carta não está na sua mão';
    if (state.phase === 'drawn' && action.id !== state.drawnId) return 'Só dá para baixar a carta que você comprou';
    if (state.pendingKind && held.kind !== state.pendingKind) return state.pendingKind === 'd2' ? 'Essa pilha só aceita +2' : 'Essa pilha só aceita +4';
    if (!state.pendingKind && !canPlayCard(state, held)) return 'Essa carta não encaixa';
    if ((held.kind === 'wild' || held.kind === 'd4') && action.color && !COLORS.includes(action.color)) return 'Cor inválida';
    return '';
  }
  return 'Jogada desconhecida';
}

function closeWindow(state) { state.forgot = -1; }

function apply(state, seat, action, events) {
  if (action.t === 'catchUno') {
    const target = state.forgot;
    const drawn = give(state, target, 2);
    state.uno[target] = false;
    state.forgot = -1;
    events.push({ t: 'catch', seat, target, n: drawn.length });
    return;
  }
  if (action.t === 'color') {
    const opening = state.openingWild;
    state.openingWild = false;
    state.color = action.color;
    closeWindow(state);
    events.push({ t: 'color', seat, color: action.color });
    if (opening) { state.phase = 'play'; return; }
    if (state.closing >= 0 && !state.pendingDraw) { armRound(state); return; }
    armGap(state, step(state, seat));
    return;
  }
  if (action.t === 'pass') {
    closeWindow(state);
    state.drawnId = '';
    events.push({ t: 'pass', seat });
    armGap(state, step(state, seat));
    return;
  }
  if (action.t === 'challenge') {
    closeWindow(state);
    const from = state.pendingFrom;
    if (state.bluff && from >= 0) {
      const drawn = give(state, from, 4);
      events.push({ t: 'challenge', seat, ok: true, from, n: drawn.length });
      state.pendingDraw = 0;
      state.pendingKind = '';
      state.pendingFrom = -1;
      state.bluff = false;
      if (state.closing === from) state.closing = -1;
      state.phase = 'play';
      return;
    }
    const drawn = give(state, seat, 6);
    events.push({ t: 'challenge', seat, ok: false, n: drawn.length });
    state.pendingDraw = 0;
    state.pendingKind = '';
    state.pendingFrom = -1;
    state.bluff = false;
    if (state.closing >= 0) { armRound(state); return; }
    armGap(state, step(state, seat));
    return;
  }
  if (action.t === 'draw') {
    closeWindow(state);
    if (state.pendingDraw > 0) {
      const want = state.pendingDraw;
      const drawn = give(state, seat, want);
      events.push({ t: 'draw', seat, n: drawn.length, pile: want });
      state.pendingDraw = 0;
      state.pendingKind = '';
      state.pendingFrom = -1;
      state.bluff = false;
      state.uno[seat] = state.hands[seat].length === 1;
      if (state.closing >= 0) { armRound(state); return; }
      armGap(state, step(state, seat));
      return;
    }
    const drawn = give(state, seat, 1);
    const got = drawn[0] || null;
    events.push({ t: 'draw', seat, n: drawn.length, pile: 0 });
    state.uno[seat] = false;
    if (state.forgot === seat) state.forgot = -1;
    if (got && canPlayCard(state, got)) {
      state.phase = 'drawn';
      state.drawnId = got.id;
      return;
    }
    state.drawnId = '';
    armGap(state, step(state, seat));
    return;
  }

  const hand = state.hands[seat];
  const idx = hand.findIndex((c) => c.id === action.id);
  const played = hand[idx];
  const stacking = !!(state.pendingKind && played.kind === state.pendingKind);
  const bluff = played.kind === 'd4' && !stacking && hasColor(hand, state.color, played.id);
  hand.splice(idx, 1);
  state.discard.push(played);
  state.drawnId = '';
  closeWindow(state);
  const said = !!(action.uno && hand.length === 1);
  events.push({ t: 'play', seat, card: copyCard(played), uno: said, pending: 0 });
  if (hand.length === 1) {
    state.uno[seat] = said;
    state.forgot = said ? -1 : seat;
    if (said) events.push({ t: 'uno', seat });
  } else {
    state.uno[seat] = false;
  }

  if (played.kind === 'd2') {
    state.pendingKind = 'd2';
    state.pendingDraw += 2;
    state.pendingFrom = seat;
    state.bluff = false;
    state.color = played.color;
  } else if (played.kind === 'd4') {
    state.pendingKind = 'd4';
    state.pendingDraw = stacking ? state.pendingDraw + 4 : 4;
    state.pendingFrom = seat;
    state.bluff = stacking ? false : bluff;
  } else {
    state.pendingDraw = 0;
    state.pendingKind = '';
    state.pendingFrom = -1;
    state.bluff = false;
    if (played.kind !== 'wild') state.color = played.color;
  }
  events[events.length - (said && hand.length === 1 ? 2 : 1)].pending = state.pendingDraw;

  const empty = hand.length === 0;
  const needsColor = played.kind === 'wild' || played.kind === 'd4';
  if (empty) state.closing = seat;
  if (needsColor && !COLORS.includes(action.color)) {
    state.phase = 'color';
    state.turn = seat;
    return;
  }
  if (needsColor) {
    state.color = action.color;
    events.push({ t: 'color', seat, color: action.color });
  }
  if (played.kind === 'rev') {
    state.direction *= -1;
    events.push({ t: 'rev', seat, direction: state.direction });
    if (empty && !needsColor) { armRound(state, seat); return; }
    if (!empty) {
      armGap(state, state.seats === 2 ? seat : step(state, seat));
      return;
    }
  } else if (played.kind === 'skip') {
    events.push({ t: 'skip', seat, skipped: step(state, seat) });
    if (empty) { armRound(state, seat); return; }
    armGap(state, step(state, seat, 2));
    return;
  }
  if (empty && !state.pendingDraw) { armRound(state, seat); return; }
  if (empty && state.pendingDraw) { armGap(state, step(state, seat)); return; }
  armGap(state, step(state, seat));
}

function award(state, events) {
  const winner = state.gap && state.gap.winner != null ? state.gap.winner : state.closing;
  let pts = 0;
  if (winner >= 0) {
    for (let s = 0; s < state.seats; s++) {
      if (s === winner) continue;
      for (const c of state.hands[s] || []) pts += cardPoints(c);
    }
    state.scores[winner] += pts;
  }
  events.push({ t: 'round', winner, points: pts, scores: state.scores.slice() });
  state.closing = -1;
  state.pendingDraw = 0;
  state.pendingKind = '';
  state.pendingFrom = -1;
  state.bluff = false;
  state.gap = null;
  if (winner >= 0 && state.scores[winner] >= state.target) {
    state.phase = 'over';
    state.winner = winner;
    events.push({ t: 'match', winner });
    return;
  }
  state.dealer = (state.dealer + 1) % state.seats;
  openHand(state, events);
}

export function release(state) {
  const events = [];
  if (!state || state.phase !== 'gap' || !state.gap) return { ok: false, events };
  if (state.gap.kind === 'round') award(state, events);
  else {
    state.phase = 'play';
    state.turn = state.gap.turn;
    state.gap = null;
  }
  state.events = events;
  return { ok: true, events };
}

export function view(state, seat) {
  const you = seat < 0 || seat >= state.seats ? 0 : seat;
  const top = topCard(state);
  const mine = (state.hands[you] || []).map(copyCard);
  return {
    seats: state.seats,
    target: state.target,
    scores: state.scores.slice(),
    dealer: state.dealer,
    direction: state.direction,
    phase: state.phase,
    turn: state.turn,
    color: state.color,
    top: copyCard(top),
    discardCount: state.discard.length,
    drawCount: state.draw.length,
    pendingDraw: state.pendingDraw,
    pendingKind: state.pendingKind,
    closing: state.closing,
    forgot: state.forgot,
    uno: state.uno.slice(),
    drawnId: state.phase === 'drawn' && state.turn === you ? state.drawnId : '',
    openingWild: state.openingWild,
    winner: state.winner,
    you,
    hand: mine,
    counts: state.hands.map((h) => h.length),
    seq: state.seq,
  };
}

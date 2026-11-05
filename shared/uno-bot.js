// Decisão do bot. A mesma função joga na mesa local e na sala.
import { cardPoints, normLevel, step } from './uno.js';
export { botName, botSkin } from './truco-bot.js';

const COLORS = ['r', 'y', 'g', 'b'];

function countColor(cards, color) {
  let n = 0;
  for (const c of cards || []) if (c && c.color === color) n++;
  return n;
}
function unseen(state, seat, color) {
  let seen = countColor(state.discard, color) + countColor(state.hands[seat], color);
  return 25 - seen;
}
function nextCount(state, seat) {
  return (state.hands[step(state, seat)] || []).length;
}
function someoneThin(state, seat) {
  for (let i = 0; i < state.seats; i++) {
    if (i !== seat && state.hands[i] && state.hands[i].length > 0 && state.hands[i].length <= 2) return true;
  }
  return false;
}
function pickColor(state, seat, level, rand) {
  const hand = state.hands[seat] || [];
  if (level === 'facil') return COLORS[Math.floor(rand() * COLORS.length)];
  const byHand = COLORS.slice().sort((a, b) => countColor(hand, b) - countColor(hand, a));
  if (level === 'medio') return byHand[0];
  if (nextCount(state, seat) <= 2) {
    return COLORS.slice().sort((a, b) => countColor(state.discard, b) - countColor(state.discard, a))[0];
  }
  return byHand[0];
}
function wantStack(state, seat, level, rand, only) {
  if (only) return true;
  if (level === 'pro') return true;
  if (level === 'medio') return nextCount(state, seat) <= 3 || rand() < 0.45;
  return rand() < 0.5;
}
function wantChallenge(state, seat, level, rand) {
  if (level === 'facil') return rand() < 0.12;
  if (level === 'medio') return rand() < 0.45;
  const left = unseen(state, seat, state.color);
  if (left >= 10) return true;
  if (left <= 4) return false;
  return rand() < 0.5;
}
function playOf(card, state, seat, level, rand) {
  const action = { t: 'play', id: card.id };
  if (card.kind === 'wild' || card.kind === 'd4') action.color = pickColor(state, seat, level, rand);
  const hand = state.hands[seat] || [];
  if (hand.length === 2) {
    const p = level === 'pro' ? 1 : level === 'medio' ? 0.88 : 0.45;
    if (rand() < p) action.uno = true;
  }
  return action;
}
function rank(card, state, seat, level) {
  if (level === 'facil') return 0;
  const nextN = nextCount(state, seat);
  const thin = someoneThin(state, seat);
  let s = 0;
  if (card.kind === 'wild' || card.kind === 'd4') s -= level === 'pro' ? 36 : 22;
  else s += cardPoints(card);
  if (nextN <= 2 && (card.kind === 'skip' || card.kind === 'd2' || card.kind === 'd4' || (state.seats === 2 && card.kind === 'rev'))) s += 34;
  if (thin && card.kind === 'd4') s += 18;
  if (level === 'pro' && thin && card.kind === 'skip' && nextN <= 2) s += 12;
  return s;
}
function chooseCard(cards, state, seat, level, rand) {
  if (level === 'facil') return cards[Math.floor(rand() * cards.length)];
  let best = cards[0];
  let bestS = rank(best, state, seat, level);
  for (let i = 1; i < cards.length; i++) {
    const s = rank(cards[i], state, seat, level);
    if (s > bestS || (s === bestS && rand() < 0.5)) { best = cards[i]; bestS = s; }
  }
  return best;
}
function bark(action, card) {
  if (!action) return '';
  if (action.t === 'challenge') return 'Tá blefando!';
  // UNO, +2, +4, pula e inverte são falados na mesa, não vão para o chat.
  if (action.uno) return '';
  if (!card) return '';
  if (card.kind === 'd2' || card.kind === 'd4' || card.kind === 'skip' || card.kind === 'rev') return '';
  if (card.kind === 'wild') return 'Muda a cor!';
  return '';
}
function emote(rand) {
  if (rand() > 0.18) return '';
  const ids = ['laugh', 'drink', 'wave', 'brow'];
  return ids[Math.floor(rand() * ids.length)];
}

export function botCatch(state, level, rand = Math.random, isBot = () => false) {
  if (!state || state.forgot < 0 || state.phase === 'over') return null;
  const skill = normLevel(level);
  const p = skill === 'pro' ? 1 : skill === 'medio' ? 0.55 : 0.08;
  for (let s = 0; s < state.seats; s++) {
    if (s === state.forgot || !isBot(s)) continue;
    if (rand() < p) return { seat: s, action: { t: 'catchUno' }, bark: 'Esqueceu o UNO!', emote: '' };
  }
  return null;
}

export function botAct(state, seat, level, rand = Math.random) {
  if (!state || state.phase === 'over' || state.phase === 'gap') return null;
  const skill = normLevel(level);
  const hand = state.hands[seat] || [];
  let action = null;
  let card = null;
  if (state.phase === 'color') {
    action = { t: 'color', color: pickColor(state, seat, skill, rand) };
  } else if (state.closing >= 0) {
    action = state.pendingKind === 'd4' && state.pendingDraw === 4 && wantChallenge(state, seat, skill, rand)
      ? { t: 'challenge' }
      : { t: 'draw' };
  } else if (state.phase === 'drawn') {
    card = hand.find((c) => c.id === state.drawnId) || null;
    if (!card) action = { t: 'pass' };
    else if (card.kind === 'wild' || card.kind === 'd4') {
      const keep = skill === 'pro' ? !someoneThin(state, seat) : skill === 'medio' ? rand() < 0.7 : rand() < 0.35;
      action = keep && hand.length > 1 ? { t: 'pass' } : playOf(card, state, seat, skill, rand);
    } else action = skill === 'facil' && rand() < 0.25 ? { t: 'pass' } : playOf(card, state, seat, skill, rand);
  } else if (state.pendingKind) {
    const stacks = hand.filter((c) => c.kind === state.pendingKind);
    if (stacks.length && wantStack(state, seat, skill, rand, hand.length === 1)) {
      card = stacks[0];
      action = playOf(card, state, seat, skill, rand);
    } else if (state.pendingKind === 'd4' && state.pendingDraw === 4 && wantChallenge(state, seat, skill, rand)) {
      action = { t: 'challenge' };
    } else action = { t: 'draw' };
  } else {
    const options = hand.filter((c) => c.kind === 'wild' || c.kind === 'd4' || c.color === state.color || symbol(c, state));
    if (!options.length) action = { t: 'draw' };
    else {
      card = chooseCard(options, state, seat, skill, rand);
      action = playOf(card, state, seat, skill, rand);
    }
  }
  if (!action) return null;
  if (!card && action.t === 'play') card = hand.find((c) => c.id === action.id) || null;
  return { action, bark: bark(action, card), emote: action.t === 'play' ? emote(rand) : '' };
}

function symbol(c, state) {
  const top = state.discard[state.discard.length - 1];
  if (!top || c.kind === 'wild' || c.kind === 'd4') return false;
  if (c.kind === 'n' && top.kind === 'n') return c.n === top.n;
  return c.kind !== 'n' && c.kind === top.kind;
}

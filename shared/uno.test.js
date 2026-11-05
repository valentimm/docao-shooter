import assert from 'node:assert/strict';
import { freshDeck, card, createMatch, act, release, view, cardPoints, canPlayCard, normSeats, normTarget } from './uno.js';
import { botAct } from './uno-bot.js';

const deck = freshDeck();
assert.equal(deck.length, 108);
assert.equal(new Set(deck.map((c) => c.id)).size, 108);
assert.equal(deck.filter((c) => c.kind === 'n' && c.n === 0).length, 4);
assert.equal(deck.filter((c) => c.kind === 'n' && c.n === 7).length, 8);
assert.equal(deck.filter((c) => c.kind === 'skip').length, 8);
assert.equal(deck.filter((c) => c.kind === 'd2').length, 8);
assert.equal(deck.filter((c) => c.kind === 'wild').length, 4);
assert.equal(deck.filter((c) => c.kind === 'd4').length, 4);
assert.equal(cardPoints(card('r', 'n', 7)), 7);
assert.equal(cardPoints(card('r', 'skip')), 20);
assert.equal(cardPoints(card('w', 'wild', null, 0)), 50);
assert.equal(cardPoints(card('w', 'd4', null, 0)), 50);
assert.equal(normSeats(6), 6);
assert.equal(normSeats(3), 2);
assert.equal(normTarget(200), 200);
assert.equal(normTarget(500), 500);

const dealt = createMatch({ seats: 4, seed: 2, target: 500 });
assert.equal(dealt.hands.every((h) => h.length === 7), true);
assert.equal(dealt.discard.length, 1);
assert.notEqual(dealt.discard[0].kind, 'd4');
assert.equal(dealt.hands.reduce((n, h) => n + h.length, 0) + dealt.draw.length + dealt.discard.length, 108);
assert.equal(view(dealt, 0).hand.length, 7);
assert.equal(view(dealt, 0).counts.reduce((a, b) => a + b, 0), 28);
assert.equal(view(dealt, 1).hand.some((c) => dealt.hands[0].some((o) => o.id === c.id)), false);

for (let seed = 1; seed <= 24; seed++) {
  const m = createMatch({ seats: seed % 2 ? 2 : 6, seed });
  assert.notEqual(m.discard[0].kind, 'd4');
  assert.equal(m.hands.every((h) => h.length === 7), true);
}

const red = card('r', 'n', 5, 0);
const blue = card('b', 'n', 3, 0);
const bad = createMatch({
  seats: 2,
  hands: [[red, card('r', 'n', 1, 0)], [blue]],
  discard: [card('b', 'n', 9, 0)],
  color: 'b',
  turn: 0,
  draw: [card('g', 'n', 2, 0)],
});
assert.equal(canPlayCard(bad, red), false);
assert.match(act(bad, 0, { t: 'play', id: red.id }).error, /encaixa/);

const pile = card('r', 'd2', null, 0);
const pile2 = card('b', 'd2', null, 1);
const stacked = createMatch({
  seats: 2,
  hands: [[pile2, card('w', 'd4', null, 2)], [card('y', 'n', 1, 0)]],
  discard: [pile],
  color: 'r',
  pendingDraw: 2,
  pendingKind: 'd2',
  pendingFrom: 1,
  turn: 0,
  draw: [card('g', 'n', 8, 0), card('g', 'n', 6, 0), card('y', 'n', 2, 0), card('y', 'n', 3, 0)],
});
assert.equal(act(stacked, 0, { t: 'play', id: pile2.id }).ok, true);
assert.equal(stacked.pendingDraw, 4);
assert.equal(stacked.pendingKind, 'd2');

const mix = createMatch({
  seats: 2,
  hands: [[card('w', 'd4', null, 1)], [card('r', 'n', 1, 1)]],
  discard: [card('r', 'd2', null, 1)],
  color: 'r',
  pendingDraw: 2,
  pendingKind: 'd2',
  turn: 0,
  draw: [],
});
assert.match(act(mix, 0, { t: 'play', id: 'w-d4-x-1' }).error, /\+2/);

const d4a = card('w', 'd4', null, 0);
const d4b = card('w', 'd4', null, 1);
const stack4 = createMatch({
  seats: 2,
  hands: [[d4b], [card('b', 'n', 2, 0)]],
  discard: [d4a],
  color: 'g',
  pendingDraw: 4,
  pendingKind: 'd4',
  pendingFrom: 1,
  bluff: false,
  turn: 0,
  draw: [card('y', 'n', 1, 0)],
});
assert.equal(act(stack4, 0, { t: 'play', id: d4b.id, color: 'r' }).ok, true);
assert.equal(stack4.pendingDraw, 8);
assert.match(act(releaseTo(stack4) && stack4, 1, { t: 'challenge' }).error, /sozinho/);

function releaseTo(state) {
  if (state.phase === 'gap') release(state);
  return state;
}

const bluffCard = card('w', 'd4', null, 2);
const bluff = createMatch({
  seats: 2,
  hands: [[bluffCard, card('r', 'n', 4, 0)], [card('b', 'n', 8, 0)]],
  discard: [card('r', 'n', 9, 0)],
  color: 'r',
  turn: 0,
  draw: [card('y', 'n', 1, 1), card('y', 'n', 2, 1), card('y', 'n', 3, 1), card('g', 'n', 1, 1), card('g', 'n', 2, 1), card('g', 'n', 3, 1)],
});
assert.equal(act(bluff, 0, { t: 'play', id: bluffCard.id, color: 'b' }).ok, true);
assert.equal(bluff.bluff, true);
assert.equal(bluff.pendingDraw, 4);
releaseTo(bluff);
assert.equal(act(bluff, 1, { t: 'challenge' }).ok, true);
assert.equal(bluff.hands[0].length, 5);
assert.equal(bluff.hands[1].length, 1);
assert.equal(bluff.pendingDraw, 0);
assert.equal(bluff.phase, 'play');
assert.equal(bluff.turn, 1);
assert.equal(bluff.color, 'b');

const legalCard = card('w', 'd4', null, 3);
const legal = createMatch({
  seats: 2,
  hands: [[legalCard, card('b', 'n', 1, 0)], [card('r', 'n', 2, 0)]],
  discard: [card('r', 'n', 3, 0)],
  color: 'r',
  turn: 0,
  draw: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => card('y', 'n', n, 1)),
});
assert.equal(act(legal, 0, { t: 'play', id: legalCard.id, color: 'g' }).ok, true);
assert.equal(legal.bluff, false);
releaseTo(legal);
assert.equal(act(legal, 1, { t: 'challenge' }).ok, true);
assert.equal(legal.hands[1].length, 7);
assert.equal(legal.phase, 'gap');

const rev = createMatch({
  seats: 2,
  hands: [[card('r', 'rev', null, 0), card('r', 'n', 2, 0)], [card('b', 'n', 4, 0)]],
  discard: [card('r', 'n', 8, 0)],
  color: 'r',
  turn: 0,
  direction: 1,
  draw: [],
});
assert.equal(act(rev, 0, { t: 'play', id: 'r-rev-x-0' }).ok, true);
releaseTo(rev);
assert.equal(rev.turn, 0);
assert.equal(rev.direction, -1);

const skip = createMatch({
  seats: 4,
  hands: [[card('g', 'skip', null, 0), card('g', 'n', 3, 1)], [card('r', 'n', 1, 0)], [card('r', 'n', 2, 0)], [card('r', 'n', 3, 0)]],
  discard: [card('g', 'n', 6, 0)],
  color: 'g',
  turn: 0,
  draw: [],
});
assert.equal(act(skip, 0, { t: 'play', id: 'g-skip-x-0' }).ok, true);
releaseTo(skip);
assert.equal(skip.turn, 2);

function arranged(flip, seats = 2) {
  const fillers = freshDeck().filter((c) => c.kind === 'n');
  const deal = [];
  for (let i = 0; i < seats * 7; i++) deal.push(fillers[i]);
  const rest = fillers.slice(seats * 7).filter((c) => c.id !== flip.id);
  return [...rest, flip, ...deal.slice().reverse()];
}
const openSkip = createMatch({ seats: 2, dealer: 0, deck: arranged(card('r', 'skip', null, 0)) });
assert.equal(openSkip.discard[0].kind, 'skip');
assert.equal(openSkip.turn, 0);
const openRev = createMatch({ seats: 2, dealer: 0, deck: arranged(card('b', 'rev', null, 0)) });
assert.equal(openRev.direction, -1);
assert.equal(openRev.turn, 0);
const openRev4 = createMatch({ seats: 4, dealer: 0, deck: arranged(card('y', 'rev', null, 1), 4) });
assert.equal(openRev4.direction, -1);
assert.equal(openRev4.turn, 3);
const openNum = createMatch({ seats: 2, dealer: 0, deck: arranged(card('g', 'n', 6, 0)) });
assert.equal(openNum.turn, 1);
assert.equal(openNum.color, 'g');
const openD2 = createMatch({ seats: 2, dealer: 0, deck: arranged(card('r', 'd2', null, 0)) });
assert.equal(openD2.pendingDraw, 2);
assert.equal(openD2.turn, 1);
const openWild = createMatch({ seats: 2, dealer: 0, deck: arranged(card('w', 'wild', null, 0)) });
assert.equal(openWild.phase, 'color');
assert.equal(openWild.openingWild, true);
assert.equal(act(openWild, openWild.turn, { t: 'color', color: 'y' }).ok, true);
assert.equal(openWild.phase, 'play');
assert.equal(openWild.color, 'y');
assert.equal(openWild.turn, 1);

const uno = createMatch({
  seats: 2,
  hands: [[card('r', 'n', 1, 0), card('r', 'n', 2, 0)], [card('b', 'n', 3, 0)]],
  discard: [card('r', 'n', 9, 0)],
  color: 'r',
  turn: 0,
  draw: [card('g', 'n', 1, 0), card('g', 'n', 2, 0), card('y', 'n', 4, 0), card('y', 'n', 5, 0)],
});
assert.equal(act(uno, 0, { t: 'play', id: 'r-n-1-0' }).ok, true);
assert.equal(uno.forgot, 0);
assert.equal(uno.hands[0].length, 1);
assert.equal(act(uno, 1, { t: 'catchUno' }).ok, true);
assert.equal(uno.hands[0].length, 3);
assert.equal(uno.forgot, -1);

const late = createMatch({
  seats: 2,
  hands: [[card('r', 'n', 4, 1)], [card('r', 'n', 6, 0), card('b', 'n', 1, 1)]],
  discard: [card('r', 'n', 2, 1)],
  color: 'r',
  turn: 1,
  forgot: 0,
  draw: [],
});
assert.equal(act(late, 1, { t: 'play', id: 'r-n-6-0' }).ok, true);
assert.match(act(late, 1, { t: 'catchUno' }).error, /esqueceu|si mesmo/);

const score = createMatch({
  seats: 2,
  target: 200,
  scores: [150, 10],
  hands: [[card('r', 'n', 1, 0)], [card('w', 'wild', null, 1), card('b', 'skip', null, 0)]],
  discard: [card('r', 'n', 5, 1)],
  color: 'r',
  turn: 0,
  draw: [card('g', 'n', 3, 0)],
});
assert.equal(act(score, 0, { t: 'play', id: 'r-n-1-0' }).ok, true);
assert.equal(score.phase, 'gap');
assert.equal(release(score).ok, true);
assert.equal(score.scores[0], 220);
assert.equal(score.phase, 'over');
assert.equal(score.winner, 0);

const mid = createMatch({
  seats: 2,
  target: 500,
  scores: [460, 0],
  hands: [[card('y', 'n', 2, 0)], [card('w', 'd4', null, 1)]],
  discard: [card('y', 'n', 8, 0)],
  color: 'y',
  turn: 0,
  draw: [],
});
assert.equal(act(mid, 0, { t: 'play', id: 'y-n-2-0' }).ok, true);
release(mid);
assert.equal(mid.scores[0], 510);
assert.equal(mid.winner, 0);

const short = createMatch({
  seats: 2,
  target: 500,
  hands: [[card('g', 'n', 2, 0)], [card('b', 'n', 4, 0)]],
  discard: [card('y', 'n', 8, 0), card('g', 'n', 9, 0), card('r', 'n', 1, 0)],
  color: 'r',
  turn: 0,
  draw: [],
});
const before = short.discard[short.discard.length - 1].id;
assert.equal(act(short, 0, { t: 'draw' }).ok, true);
assert.equal(short.discard[short.discard.length - 1].id, before);
assert.equal(short.hands[0].length, 2);
assert.equal(short.draw.length, 1);
assert.equal(short.draw.length + short.discard.length + short.hands[0].length + short.hands[1].length, 5);

const fin = createMatch({
  seats: 2,
  hands: [[card('r', 'd2', null, 0)], [card('b', 'n', 1, 0)]],
  discard: [card('r', 'n', 3, 0)],
  color: 'r',
  turn: 0,
  draw: [card('y', 'n', 1, 0), card('y', 'n', 2, 0), card('g', 'n', 3, 0)],
  target: 500,
});
assert.equal(act(fin, 0, { t: 'play', id: 'r-d2-x-0' }).ok, true);
assert.equal(fin.closing, 0);
assert.equal(fin.pendingDraw, 2);
release(fin);
assert.equal(act(fin, 1, { t: 'play', id: 'b-n-1-0' }).ok, false);
assert.equal(act(fin, 1, { t: 'draw' }).ok, true);
release(fin);
assert.equal(fin.scores[0], 6);
assert.equal(fin.phase, 'play');

let finished = 0;
for (const level of ['facil', 'medio', 'pro']) {
  for (let seed = 1; seed <= 6; seed++) {
    const m = createMatch({ seats: seed % 2 ? 2 : 4, seed, target: 200 });
    let guard = 0;
    while (m.phase !== 'over' && guard++ < 3000) {
      if (m.phase === 'gap') { release(m); continue; }
      const seat = m.turn;
      const picked = botAct(m, seat, level, m.rand);
      assert.ok(picked && picked.action, level + ' sem jogada');
      const r = act(m, seat, picked.action);
      assert.equal(r.ok, true, (r.error || '') + ' ' + level + ' ' + picked.action.t);
    }
    assert.equal(m.phase, 'over', level + ' seed ' + seed + ' não fechou');
    finished++;
  }
}
assert.equal(finished, 18);

const hidden = createMatch({ seats: 2, seed: 9 });
const seen = view(hidden, 0);
assert.equal(Object.hasOwn(seen, 'bluff'), false);
assert.equal(seen.hand.length, 7);
assert.ok(seen.counts[1] === 7);

console.log('uno: ok');

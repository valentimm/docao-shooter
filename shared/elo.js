// ============================================================
//  Elo por modalidade (Docão).
//  Mata-mata, Corrida Armada, Duelo (Gunfight), X1 e Competitivo — cada um com o seu rating.
//  Times: vitória/derrota + média do lado adversário + desempenho na partida.
//  Mata-mata: posição, distância em abates pro primeiro e Elo de quem estava na partida.
//  Insígnias sobem com o rating; no topo (Docão Supremo) vale o ranking daquela modalidade.
//  Sem bots na sala: partidas com bot não alteram Elo (nem pra cima).
//  Competitivo sempre conta. As outras só quando a sala foi criada valendo Elo.
// ============================================================

export const ELO_START = 1000;

// Duelo = Gunfight (rounds). X1 é o outro duelo, 1 contra 1.
export const ELO_MODES = [
  { id: 'dm', name: 'Mata-mata', always: false, how: 'Cada um por si, primeiro a 20 abates. A posição e a distância pro primeiro mudam o quanto o Elo sobe ou desce, e o Elo de quem estava na partida entra na conta. Só conta se a sala foi criada valendo Elo, sem bots.' },
  { id: 'arms', name: 'Corrida Armada', always: false, how: 'Times. Quem chega na faca dourada vence, e o Elo do time sobe ou cai junto. Só conta se a sala foi criada valendo Elo, sem bots.' },
  { id: 'gf', name: 'Duelo', always: false, how: 'Gunfight em rounds, primeiro a 6. O Elo do time sobe ou cai junto. Só conta se a sala foi criada valendo Elo, sem bots.' },
  { id: 'x1', name: 'X1', always: false, how: '1 contra 1, primeiro a 10 abates. Quem tem mais abates sobe; empate não mexe. Só conta se a sala foi criada valendo Elo, sem bots.' },
  { id: 'comp', name: 'Competitivo', always: true, how: 'Times de 3 a 5, primeiro a 13, planta o botijão. Sempre vale Elo, sem bots e sem cheat.' },
];
export const ELO_MODE_IDS = ELO_MODES.map((m) => m.id);
export const eloMode = (id) => ELO_MODES.find((m) => m.id === id) || null;
export const ELO_FLOOR = 0;
export const ELO_K_NEW = 32;   // < 20 partidas
export const ELO_K_MID = 24;   // rating < 1800
export const ELO_K_HIGH = 16;  // veteranos altos
export const ELO_NEW_GAMES = 20;

// Benchmarks: Iron→Radiant / Silver→Global, com tema churrasco/Docão.
// min inclusivo; o último não tem teto.
export const ELO_TIERS = [
  { id: 'pipoca', name: 'Pipoca', emoji: '🍿', min: 0, blurb: 'Começando na fila do fogão.' },
  { id: 'coxinha', name: 'Coxinha', emoji: '🍗', min: 1000, blurb: 'Já segura a arma sem queimar a mão.' },
  { id: 'pastel', name: 'Pastel', emoji: '🥟', min: 1200, blurb: 'Sabe plantar e defender o botijão.' },
  { id: 'espetinho', name: 'Espetinho', emoji: '🍢', min: 1400, blurb: 'Economia afiada e mira firme.' },
  { id: 'churrasqueiro', name: 'Churrasqueiro', emoji: '🔥', min: 1600, blurb: 'O time conta com você no clutch.' },
  { id: 'capataz', name: 'Capataz', emoji: '🤠', min: 1800, blurb: 'Manda no chiqueiro competitivo.' },
  { id: 'pingou', name: 'Pingou', emoji: '🐷', min: 2000, blurb: 'Quase no alto da comanda.' },
  { id: 'docao', name: 'Docão Supremo', emoji: '👑', min: 2200, blurb: 'Insígnia máxima — agora é ranking de Elo.' },
];

export function eloTier(rating) {
  const r = Math.max(ELO_FLOOR, rating | 0);
  let t = ELO_TIERS[0];
  for (const x of ELO_TIERS) if (r >= x.min) t = x;
  return t;
}

export function eloTierNext(rating) {
  const t = eloTier(rating);
  const i = ELO_TIERS.findIndex((x) => x.id === t.id);
  return i >= 0 && i < ELO_TIERS.length - 1 ? ELO_TIERS[i + 1] : null;
}

export function isMaxEloTier(rating) {
  return eloTier(rating).id === ELO_TIERS[ELO_TIERS.length - 1].id;
}

export function eloK(rating, games) {
  if ((games | 0) < ELO_NEW_GAMES) return ELO_K_NEW;
  return (rating | 0) < 1800 ? ELO_K_MID : ELO_K_HIGH;
}

export function expectedScore(myRating, oppRating) {
  return 1 / (1 + 10 ** (((oppRating | 0) - (myRating | 0)) / 400));
}

// Desempenho: score = kills + 2×objs (plant/defuse). Em relação à média do próprio time.
export function perfMul(myScore, teamScores) {
  const list = (teamScores || []).filter((n) => Number.isFinite(n));
  if (!list.length) return 1;
  const avg = list.reduce((a, b) => a + b, 0) / list.length;
  const ratio = (myScore || 0) / Math.max(1, avg); // 1 = na média
  return Math.min(1.35, Math.max(0.65, 0.65 + 0.35 * ratio));
}

/**
 * players: [{ id, team, score, rating, games }]
 * winTeam: 0 | 1 | -1 (empate não mexe)
 * returns [{ id, before, after, delta, tier }]
 */
export function computeCompEloDeltas(players, winTeam) {
  if (winTeam !== 0 && winTeam !== 1) return [];
  const list = (players || []).filter((p) => p && (p.team === 0 || p.team === 1));
  const a = list.filter((p) => p.team === 0);
  const b = list.filter((p) => p.team === 1);
  if (!a.length || !b.length) return [];

  const avg = (arr) => arr.reduce((s, p) => s + (p.rating | 0), 0) / arr.length;
  const avgA = avg(a), avgB = avg(b);
  const scoresOf = (arr) => arr.map((p) => p.score | 0);

  const out = [];
  for (const p of list) {
    const won = p.team === winTeam;
    const myTeamAvg = p.team === 0 ? avgA : avgB;
    const oppAvg = p.team === 0 ? avgB : avgA;
    const E = expectedScore(myTeamAvg, oppAvg);
    const S = won ? 1 : 0;
    const K = eloK(p.rating, p.games);
    const mul = perfMul(p.score, scoresOf(p.team === 0 ? a : b));
    let delta = Math.round(K * (S - E) * mul);
    // Vitória sempre ganha pelo menos 1; derrota sempre perde pelo menos 1 (exceto se já no chão).
    if (won && delta < 1) delta = 1;
    if (!won && delta > -1) delta = -1;
    const before = Math.max(ELO_FLOOR, p.rating | 0);
    let after = before + delta;
    if (after < ELO_FLOOR) { delta = ELO_FLOOR - before; after = ELO_FLOOR; }
    out.push({ id: p.id, before, after, delta, tier: eloTier(after).id, won: !!won });
  }
  return out;
}

// Mata-mata: metade posição, metade distância de abates. Quem fica na frente de alguém
// marca 1 na posição; empate de posição (mesmos abates e mesmas mortes) marca 0,5.
// A distância entra como 0,5 + 0,5 × (meus abates − abates do outro) / abates do líder.
const DM_PLACE_W = 0.5;
const DM_SCORE_W = 0.5;

function dmAhead(a, b) {
  if (a.win && !b.win) return 1;
  if (b.win && !a.win) return -1;
  const ds = (a.score | 0) - (b.score | 0);
  if (ds) return ds > 0 ? 1 : -1;
  const dd = (b.deaths | 0) - (a.deaths | 0);
  if (dd) return dd > 0 ? 1 : -1;
  return 0;
}

/**
 * Mata-mata, cada um por si.
 * players: [{ id, score, deaths, rating, games, win? }]
 * win: fim da chapa — esse jogador é o primeiro mesmo com menos abates.
 * returns [{ id, before, after, delta, tier, won }]
 * O primeiro (sozinho) nunca perde Elo. Empate total entre ratings iguais não mexe o número.
 */
export function computeDmEloDeltas(players) {
  const list = (players || []).filter((p) => p && p.id != null);
  if (list.length < 2) return [];
  const lead = Math.max(0, ...list.map((p) => p.score | 0));
  const out = [];
  for (const p of list) {
    let sSum = 0, eSum = 0, ahead = 0;
    const rivals = list.length - 1;
    for (const o of list) {
      if (o === p) continue;
      const cmp = dmAhead(p, o);
      const sPlace = cmp > 0 ? 1 : cmp < 0 ? 0 : 0.5;
      let sScore = 0.5;
      if (lead > 0) {
        const margin = ((p.score | 0) - (o.score | 0)) / lead;
        sScore = Math.min(1, Math.max(0, 0.5 + 0.5 * margin));
      }
      sSum += DM_PLACE_W * sPlace + DM_SCORE_W * sScore;
      eSum += expectedScore(p.rating, o.rating);
      if (cmp > 0) ahead++;
    }
    const S = sSum / rivals, E = eSum / rivals;
    const K = eloK(p.rating, p.games);
    let delta = Math.round(K * (S - E));
    if (delta === 0 && S !== E) delta = S > E ? 1 : -1;
    const won = ahead === rivals;
    if (won && delta < 1) delta = 1;
    const before = Math.max(ELO_FLOOR, p.rating | 0);
    let after = before + delta;
    if (after < ELO_FLOOR) { delta = ELO_FLOOR - before; after = ELO_FLOOR; }
    out.push({ id: p.id, before, after, delta, tier: eloTier(after).id, won: !!won });
  }
  return out;
}

export function eloEligible({ fillBots, hasBots, humans, mode, eloOn } = {}) {
  const m = mode || 'comp'; // chamada antiga (sem mode) é o competitivo
  if (!ELO_MODE_IDS.includes(m)) return false;
  if (m !== 'comp' && eloOn !== true) return false;
  if (fillBots || hasBots) return false;
  const n = (humans || []).length;
  return n >= 2; // precisa de gente dos dois lados (checado em compute)
}

export function eloSummary(rating, games = 0) {
  const t = eloTier(rating);
  const next = eloTierNext(rating);
  return {
    rating: Math.max(ELO_FLOOR, rating | 0),
    games: games | 0,
    tier: t,
    next,
    max: !next,
    toNext: next ? Math.max(0, next.min - (rating | 0)) : 0,
  };
}

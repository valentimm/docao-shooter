// ============================================================
//  Modo Docão Escondido (estilo Prop Hunt) — PROTÓTIPO, só offline. Regras compartilhadas, sem DOM, sem Three.js.
//   • 2 times (0 = Vermelho, 1 = Azul). A cada rodada um time vira ESCONDIDOS e o outro CAÇADORES; os papéis trocam toda rodada
//     (rodada ímpar: Azul se esconde · rodada par: Vermelho se esconde). Offline com bots: metade de cada lado.
//   • Escondidos: o Docão some e vira um objeto do mapa (barril, feno, copão, banco, árvore, caixote). Andam mais devagar,
//     só têm a faca. E troca o objeto, R gira o objeto. Morreu = fora até a próxima rodada (sem renascer).
//   • Caçadores: Docões armados normais. Na preparação (PREP s) ficam presos no spawn e com a tela preta.
//   • Rodada: PREP s escondendo → ROUND s de caçada.
//     Todos os Escondidos mortos → ponto dos Caçadores. Tempo acabou com 1+ Escondido vivo → ponto dos Escondidos.
//   • Primeiro time a WIN pontos vence (melhor de 5). END s de faixa entre rodadas.
// ============================================================
export const HIDE = { mode: 'hide', WIN: 3, PREP: 25, ROUND: 150, END: 5, SPEED: 0.75, SPOT_R: 9, KEY: 'KeyE', KEY_LABEL: 'E', ROT_KEY: 'KeyR', ROT_LABEL: 'R' };
export const isHide = (m) => m === HIDE.mode;
export const ROLE_NAMES = ['Caçadores', 'Escondidos'];
// objetos que dá pra virar (o cliente tem mesh simples pra cada um, no formato dos props de maps.js)
export const HIDE_PROPS = ['keg', 'hay', 'cup', 'bench', 'tree', 'crate'];
export const PROP_NAMES = { keg: 'Barril', hay: 'Fardo de feno', cup: 'Copão', bench: 'Banco', tree: 'Árvore', crate: 'Caixote' };
export const hiderTeam = (round) => round % 2; // rodada 1: Azul (1) se esconde
export const isHider = (S, e) => !!S && !!e && e.team === hiderTeam(S.round);
export const nextProp = (cur) => HIDE_PROPS[(HIDE_PROPS.indexOf(cur) + 1) % HIDE_PROPS.length];

export function newHideState() { return { round: 0, phase: 'prep', phaseEnd: 0, score: [0, 0], winner: -1 }; }

// começa a próxima rodada: marca quem se esconde e sorteia o objeto de cada Escondido
export function startHideRound(S, t, ents, rnd = Math.random) {
  S.round++; S.phase = 'prep'; S.phaseEnd = t + HIDE.PREP;
  for (const e of ents) { e.hider = isHider(S, e); e.prop = e.hider ? HIDE_PROPS[(rnd() * HIDE_PROPS.length) | 0] : null; e.propRot = 0; }
  return [['round', S.round, hiderTeam(S.round)]];
}
export const hideFrozen = (S, e) => !!S && S.phase === 'prep' && !!e && !e.hider; // caçador parado e cego na preparação
export const hidersAlive = (S, ents) => ents.filter((e) => e.hider && e.alive).length;

// avança o relógio; devolve eventos: ['go'] · ['win', time, motivo, s0, s1] · ['round', n, timeEscondido] · ['over', time]
export function stepHide(S, ents, t, rnd) {
  const ev = [];
  if (!S || S.phase === 'over') return ev;
  const hT = hiderTeam(S.round), cT = 1 - hT;
  if (S.phase === 'prep' && t >= S.phaseEnd) { S.phase = 'live'; S.phaseEnd = t + HIDE.ROUND; ev.push(['go']); }
  if (S.phase === 'live' || S.phase === 'prep') {
    const anyHider = ents.some((e) => e.hider);
    const win = (team, why) => { S.score[team]++; S.phase = 'end'; S.phaseEnd = t + HIDE.END; ev.push(['win', team, why, S.score[0], S.score[1]]); };
    if (anyHider && hidersAlive(S, ents) === 0) win(cT, 'caught');
    else if (S.phase === 'live' && t >= S.phaseEnd) win(hT, 'time');
  } else if (S.phase === 'end' && t >= S.phaseEnd) {
    const w = S.score[0] >= HIDE.WIN ? 0 : S.score[1] >= HIDE.WIN ? 1 : -1;
    if (w >= 0) { S.phase = 'over'; S.winner = w; ev.push(['over', w]); }
    else ev.push(...startHideRound(S, t, ents, rnd));
  }
  return ev;
}

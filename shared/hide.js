// ============================================================
//  Modo Docão Escondido (estilo Prop Hunt) — PROTÓTIPO, só offline. Regras compartilhadas, sem DOM, sem Three.js.
//   • 2 times (0 = Vermelho, 1 = Azul). A cada rodada um time vira ESCONDIDOS e o outro CAÇADORES; os papéis trocam toda rodada
//     (rodada ímpar: Azul se esconde · rodada par: Vermelho se esconde). Offline com bots: metade de cada lado.
//   • Escondidos: o Docão some e vira um objeto que existe no mapa (Rodízio: barril, feno, árvore, jarro, caixote). Andam mais devagar,
//     só têm a faca. E troca o objeto, R gira o objeto, L trava a posição (só a câmera mexe). Morreu = fora até a próxima rodada (sem renascer).
//   • Caçadores: Docões armados normais. Na preparação (PREP s) ficam presos no spawn e com a tela preta.
//   • Rodada: PREP s escondendo → ROUND s de caçada.
//     Todos os Escondidos mortos → ponto dos Caçadores. Tempo acabou com 1+ Escondido vivo → ponto dos Escondidos.
//   • APITO OBRIGATÓRIO: na caçada, WHISTLE_FIRST s depois do início e então a cada WHISTLE s, todo Escondido vivo apita
//     (som de onde ele está + aviso "APITO!"). Não dá pra cancelar. Na preparação não apita. Evento: ['whistle'].
//   • Primeiro time a WIN pontos vence (melhor de 5). END s de faixa entre rodadas.
// ============================================================
export const HIDE = { mode: 'hide', WIN: 3, PREP: 25, ROUND: 150, END: 5, SPEED: 0.75, SPOT_R: 9, WHISTLE: 25, WHISTLE_FIRST: 20, WHISTLE_WARN: 5, KEY: 'KeyE', KEY_LABEL: 'E', ROT_KEY: 'KeyR', ROT_LABEL: 'R', LOCK_KEY: 'KeyL', LOCK_LABEL: 'L', MAP: 'rodizio' };
// V2: o modo roda sempre no mapa grande (Rodízio do Docão, 92×160 m) e só oferece objetos que EXISTEM nesse mapa.
export const isHide = (m) => m === HIDE.mode;
export const ROLE_NAMES = ['Caçadores', 'Escondidos'];
// objetos que dá pra virar (o cliente tem mesh simples pra cada um, no formato dos props de maps.js)
export const HIDE_PROPS = ['keg', 'hay', 'cup', 'bench', 'tree', 'jar', 'crate']; // todos os que o cliente sabe desenhar
export const PROP_NAMES = { keg: 'Barril', hay: 'Fardo de feno', cup: 'Copão', bench: 'Banco', tree: 'Árvore', jar: 'Jarro', crate: 'Caixote' };
// objetos que aparecem no mapa: map.hideProps (lista explícita) ou os props soltos do mapa que estão em HIDE_PROPS
export function propsForMap(map) {
  if (!map) return HIDE_PROPS;
  const list = map.hideProps || [...new Set((map.props || []).filter((p) => !p.deco).map((p) => p.t))];
  const ok = list.filter((t) => HIDE_PROPS.includes(t));
  return ok.length ? ok : HIDE_PROPS;
}
export const hiderTeam = (round) => round % 2; // rodada 1: Azul (1) se esconde
export const isHider = (S, e) => !!S && !!e && e.team === hiderTeam(S.round);
export const nextProp = (cur, list = HIDE_PROPS) => list[(list.indexOf(cur) + 1) % list.length];

export function newHideState(props = HIDE_PROPS) { return { round: 0, phase: 'prep', phaseEnd: 0, score: [0, 0], winner: -1, props }; }

// começa a próxima rodada: marca quem se esconde e sorteia o objeto de cada Escondido
export function startHideRound(S, t, ents, rnd = Math.random) {
  S.round++; S.phase = 'prep'; S.phaseEnd = t + HIDE.PREP;
  for (const e of ents) { e.hider = isHider(S, e); const L = S.props || HIDE_PROPS; e.prop = e.hider ? L[(rnd() * L.length) | 0] : null; e.propRot = 0; e.propLock = false; }
  return [['round', S.round, hiderTeam(S.round)]];
}
export const hideFrozen = (S, e) => !!S && S.phase === 'prep' && !!e && !e.hider; // caçador parado e cego na preparação
export const hidersAlive = (S, ents) => ents.filter((e) => e.hider && e.alive).length;

// avança o relógio; devolve eventos: ['go'] · ['win', time, motivo, s0, s1] · ['round', n, timeEscondido] · ['over', time]
export function stepHide(S, ents, t, rnd) {
  const ev = [];
  if (!S || S.phase === 'over') return ev;
  const hT = hiderTeam(S.round), cT = 1 - hT;
  if (S.phase === 'prep' && t >= S.phaseEnd) { S.phase = 'live'; S.phaseEnd = t + HIDE.ROUND; S.whistleAt = t + HIDE.WHISTLE_FIRST; ev.push(['go']); }
  if (S.phase === 'live' || S.phase === 'prep') {
    const anyHider = ents.some((e) => e.hider);
    const win = (team, why) => { S.score[team]++; S.phase = 'end'; S.phaseEnd = t + HIDE.END; ev.push(['win', team, why, S.score[0], S.score[1]]); };
    if (S.phase === 'live' && S.whistleAt && t >= S.whistleAt && t < S.phaseEnd) { S.whistleAt += HIDE.WHISTLE; ev.push(['whistle']); } // obrigatório
    if (anyHider && hidersAlive(S, ents) === 0) win(cT, 'caught');
    else if (S.phase === 'live' && t >= S.phaseEnd) win(hT, 'time');
  } else if (S.phase === 'end' && t >= S.phaseEnd) {
    const w = S.score[0] >= HIDE.WIN ? 0 : S.score[1] >= HIDE.WIN ? 1 : -1;
    if (w >= 0) { S.phase = 'over'; S.winner = w; ev.push(['over', w]); }
    else ev.push(...startHideRound(S, t, ents, rnd));
  }
  return ev;
}

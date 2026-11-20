// ============================================================
//  Dificuldade dos bots — um lugar só, cliente e servidor.
//
//  A IA antiga (cliente em main.js e servidor em server/src/game.js) era a mesma
//  receita com números soltos: pensa a cada ~0,25 s, reage em 0,35–0,65 s, espalha
//  o tiro num cone fixo (accuracy 0,045–0,07), não prevê movimento em hitscan,
//  não ouve tiro, não busca cobertura e não flanqueia. Granadas saem com 35% de
//  chance entre 8 e 24 m, com erro de ±1,2 m. Killstreaks os bots nunca usaram
//  (o servidor recusa e.bot em useStreak) e continuam sem usar: nuke, Gavião e
//  míssil seriam poder de verdade, não habilidade.
//
//  Ceva é esse comportamento de hoje, de propósito, pra partida antiga não mudar.
//  Os outros níveis mexem em COMO o bot joga, não em vida nem dano.
//
//  O que nenhum nível faz: ver através de parede, atirar sem linha de visão,
//  reagir em 0 s ou ter cone zero. A mira aperta com o tempo de mira (quem
//  espia e some pune o bot). Alvo que muda de direção pune a previsão.
//  Fumaça no offline continua tapando a visão (o servidor não simula fumaça
//  pra visão de bot — isso já era assim).
//
//  Invasão não tem bot de jogador. O mesmo id muda a HORDA (cuspe, reação,
//  cerco). A vida, o dano e a contagem das waves ficam no waveSpec.
// ============================================================

export const BOT_DIFFS = [
  { id: 'leitao', label: 'Leitão', tier: 'fácil', hint: 'Demora pra reagir, erra o focinho e corre reto. Bom pra aprender o mapa.' },
  { id: 'ceva', label: 'Ceva', tier: 'normal', hint: 'O Docão de sempre: vê, mira, erra um pouco e briga de igual.' },
  { id: 'javali', label: 'Javali', tier: 'difícil', hint: 'A mira aperta com o tempo, ouve tiro, cobre e joga o copo no lugar certo.' },
  { id: 'cachaco', label: 'Cachaço', tier: 'pesadelo', hint: 'Quase um jogador bom. Ainda precisa te ver, e a mira não nasce no focinho.' },
];

export const DEFAULT_BOT_DIFF = 'ceva';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ease-out: o primeiro instante de mira é largo; o cone fecha depressa e depois devagar
const ease = (k) => 1 - (1 - k) * (1 - k);
const span = (a, rnd) => a[0] + rnd() * (a[1] - a[0]);

// Cada campo está comentado no Leitão (o extremo fácil). Os outros repetem a mesma ordem.
// Números são segundos, metros ou radianos, como o resto do jogo.
const PROFILES = {
  leitao: {
    // de quanto em quanto tempo escolhe alvo de novo. Alto = fica olhando pra pessoa errada.
    think: [0.40, 0.60],
    // espera depois de ver alguém antes do primeiro tiro. Nunca é zero.
    reaction: [0.75, 1.10],
    // alcance em que um inimigo entra na lista. Sem linha livre, não atira.
    vision: 34,
    // persegue o último lugar VISTO por tantos segundos. Não é visão de parede.
    memory: 2.2,
    // cone inicial (rad) e o piso, sorteado em `accuracy`, depois de mirar `aimSettle` s.
    // Leitão "melhora" e continua ruim: o piso ainda é largo.
    aimTightens: true,
    spreadOpen: 0.17,
    accuracy: [0.090, 0.120],
    aimSettle: 1.20,
    // erro lateral do ponto de mira (m), também encolhe. ±miss.
    missOpen: 0.95,
    missFloor: 0.42,
    // altura do ponto no corpo (0 pé, ~1,55 focinho) quando NÃO vai de cabeça.
    aimH: [0.35, 1.15],
    // chance de puxar pro focinho depois que a mira já assentou (headAfter é 0–1 do ease).
    // headMove multiplica essa chance se o alvo está correndo: focinho em quem strafe é vaidade.
    headP: 0.05,
    headAfter: 0.80,
    headH: 1.50,
    headMove: 1,
    // hitscan chega na hora: lead grande atira no vazio, na frente de quem ainda não chegou.
    // Por isso o valor aqui é curto (0 = atira onde a pessoa está agora). A previsão de
    // verdade, com tempo de vôo, mora no copo, na bazuca, no milho e no cuspe.
    // leadErr erra essa fração (1 = pode inverter o lado quando o alvo troca de direção).
    lead: 0,
    leadAfter: 1,
    leadErr: 0,
    // alvo andando (velocidade > 2) multiplica o cone. Pistola usa pistolMul, igual ao código antigo.
    moveSpread: 2.15,
    pistolMul: 0.9,
    scopeSpread: 0.055,
    scopeMove: 1.7,
    pelletMul: 1.35,
    // o próprio bot andando abre o cone. Ceva é 1 (o código antigo não punia isso).
    selfMove: 1.7,
    // para de strafar por burstStop s a cada burstEvery, pra acertar. 0 = não sabe.
    // holdFire: só atira hitscan parado (o Cachaço). Os outros atiram andando, pior.
    burstStop: 0,
    burstEvery: 1,
    holdFire: false,
    // virar (rad/s) e o quanto o corpo precisa estar alinhado pra o tiro sair.
    turn: 5.2,
    aimGate: 0.50,
    // luneta: o tempo extra antigo (Canhão 1,15 / Carabina 0,45 / Torresmo 0,80) vezes isto.
    scopeScale: 1.35,
    // strafe: chance de ficar parado, peso lateral, duração, pulo.
    strafeStill: 0.62,
    strafeW: 0.35,
    strafeT: [1.2, 2.4],
    jump: 0.04,
    // empurra o alcance preferido da arma. Negativo = chega perto demais e toma tiro.
    rangeBias: -3.5,
    // cadência: multiplica o atraso que os bots já tinham (fuzil ~2,2–3,4× o rate da arma).
    fireMul: 1.40,
    // chance, por pensamento, de NÃO trocar pra arma certa do alcance.
    wrongGun: 0.45,
    // faca: chance ao colar, e só se a vida do alvo estiver até knifeHp.
    knifeP: 0.60,
    knifeHp: 101,
    // recarga fora de combate quando o pente está abaixo desta fração.
    reloadAt: 0.80,
    // recarga NO meio do tiroteio (por pensamento). Leitão larga o fuzil na sua cara.
    panicReload: 0.50,
    panicAt: 0.45,
    // ouve tiro até esta distância e vai até o lugar. 0 = surdo. Não atira no som.
    hear: 0,
    hearMemory: 0,
    // cobertura: se a vida cai abaixo de coverHp, chance de ir a um nó SEM linha até o alvo.
    coverHp: 0,
    coverP: 0,
    coverDist: 8,
    coverHold: 1,
    // flanco: chance de ir pro lado em vez de reto, por flankHold s.
    flankP: 0,
    flankMin: 99,
    flankDist: 0,
    flankHold: 1,
    // Copo Bomba. nadeAim = fração do reaction que precisa ter passado. flush = joga no último lugar visto.
    nadeP: 0.08,
    nadeMin: 10,
    nadeMax: 18,
    nadeAim: 1.4,
    nadeErr: 3.4,
    nadeLead: 0.05,
    nadeCd: [14, 20],
    nadeWait: [3.0, 5.0],
    nadeFlush: 0,
    // bazuca e milho: o erro lateral antigo era ±0,8 e ±0,6. O tempo de vôo continua físico.
    rocketErr: 1.8,
    cornErr: 1.4,
    cornLead: 0.05,
    // quem atirou nele e o jogador humano pesam menos que 1 (prefere). finish = alvo baixo.
    attackerBias: 0.85,
    playerBias: 1,
    finishHp: 0,
    finishBias: 1,
    // horda da Invasão. spd é só um empurrãozinho; o que muda a sensação é cuspe, giro e cerco.
    zombie: {
      retarget: [0.75, 1.15], losEvery: 0.55, aggro: 24,
      spitLead: 0.05, spitErr: 2.6, spitRate: 1.50, keep: 0.75,
      atkRate: 1.30, turn: 5, flank: 0, spd: 0.92,
    },
  },
  ceva: {
    // espelho do comportamento que já estava no jogo. aimTightens false = cone fixo.
    think: [0.18, 0.32],
    reaction: [0.35, 0.65],
    vision: 55,
    memory: 4,
    aimTightens: false,
    spreadOpen: 0.06,
    accuracy: [0.045, 0.070],
    aimSettle: 1,
    missOpen: 0.30,
    missFloor: 0.30,
    aimH: [0.70, 1.60],
    headP: 0,
    headAfter: 1,
    headH: 1.55,
    headMove: 1,
    lead: 0,
    leadAfter: 1,
    leadErr: 0,
    moveSpread: 1.5,
    pistolMul: 0.9,
    scopeSpread: 0.02,
    scopeMove: 1.5,
    pelletMul: 1.2,
    selfMove: 1,
    burstStop: 0,
    burstEvery: 1,
    holdFire: false,
    turn: 9,
    aimGate: 0.35,
    scopeScale: 1,
    strafeStill: 0.20,
    strafeW: 0.8,
    strafeT: [0.6, 1.8],
    jump: 0.15,
    rangeBias: 0,
    fireMul: 1,
    wrongGun: 0,
    knifeP: 0.45,
    knifeHp: 101,
    reloadAt: 0.50,
    panicReload: 0,
    panicAt: 1,
    hear: 0,
    hearMemory: 0,
    coverHp: 0,
    coverP: 0,
    coverDist: 8,
    coverHold: 1,
    flankP: 0,
    flankMin: 99,
    flankDist: 0,
    flankHold: 1,
    nadeP: 0.35,
    nadeMin: 8,
    nadeMax: 24,
    nadeAim: 1,
    nadeErr: 1.2,
    nadeLead: 0.6,
    nadeCd: [7, 13],
    nadeWait: [1.5, 3],
    nadeFlush: 0,
    rocketErr: 0.8,
    cornErr: 0.6,
    cornLead: 0.35,
    attackerBias: 0.5,
    playerBias: 0.85,
    finishHp: 0,
    finishBias: 1,
    zombie: {
      retarget: [0.4, 0.7], losEvery: 0.3, aggro: 40,
      spitLead: 0.35, spitErr: 0, spitRate: 1, keep: 1,
      atkRate: 1, turn: 8, flank: 0, spd: 1,
    },
  },
  javali: {
    think: [0.12, 0.20],
    reaction: [0.22, 0.38],
    vision: 64,
    memory: 7,
    aimTightens: true,
    spreadOpen: 0.070,
    accuracy: [0.016, 0.026],
    aimSettle: 0.50,
    missOpen: 0.34,
    missFloor: 0.09,
    aimH: [0.90, 1.45],
    headP: 0.34,
    headAfter: 0.45,
    headH: 1.52,
    headMove: 0.40,
    // 0,08 s de avanço: acompanha quem cruza sem atirar um metro na frente.
    lead: 0.08,
    leadAfter: 0.45,
    leadErr: 0.50,
    moveSpread: 1.28,
    pistolMul: 0.9,
    scopeSpread: 0.012,
    scopeMove: 1.25,
    pelletMul: 1.15,
    selfMove: 1.35,
    burstStop: 0.10,
    burstEvery: 0.55,
    holdFire: false,
    turn: 12,
    aimGate: 0.22,
    scopeScale: 0.85,
    strafeStill: 0.08,
    strafeW: 1.05,
    strafeT: [0.35, 0.90],
    jump: 0.20,
    rangeBias: 1,
    fireMul: 0.88,
    wrongGun: 0,
    knifeP: 0.18,
    knifeHp: 101,
    reloadAt: 0.35,
    panicReload: 0,
    panicAt: 1,
    hear: 28,
    hearMemory: 3.5,
    coverHp: 48,
    coverP: 0.55,
    coverDist: 12,
    coverHold: 2.8,
    flankP: 0.28,
    flankMin: 10,
    flankDist: 8,
    flankHold: 3.2,
    nadeP: 0.55,
    nadeMin: 7,
    nadeMax: 26,
    nadeAim: 0.85,
    nadeErr: 0.70,
    nadeLead: 0.85,
    nadeCd: [6, 10],
    nadeWait: [0.8, 1.6],
    nadeFlush: 1.6,
    rocketErr: 0.45,
    cornErr: 0.35,
    cornLead: 0.55,
    attackerBias: 0.42,
    playerBias: 0.80,
    finishHp: 35,
    finishBias: 0.72,
    zombie: {
      retarget: [0.25, 0.42], losEvery: 0.20, aggro: 46,
      spitLead: 0.55, spitErr: 0.55, spitRate: 0.85, keep: 1.05,
      atkRate: 0.90, turn: 11, flank: 2.8, spd: 1.03,
    },
  },
  cachaco: {
    think: [0.08, 0.14],
    reaction: [0.14, 0.24],
    vision: 72,
    memory: 10,
    aimTightens: true,
    spreadOpen: 0.040,
    accuracy: [0.007, 0.012],
    aimSettle: 0.32,
    missOpen: 0.20,
    missFloor: 0.045,
    aimH: [1.05, 1.50],
    headP: 0.58,
    headAfter: 0.35,
    headH: 1.56,
    headMove: 0.22,
    // quase no corpo. Quem é bom em hitscan rastreia onde você está; o cuspe é que antecipa.
    lead: 0.06,
    leadAfter: 0.28,
    leadErr: 0.35,
    moveSpread: 1.12,
    pistolMul: 0.9,
    scopeSpread: 0.006,
    scopeMove: 1.12,
    pelletMul: 1.1,
    selfMove: 1.60,
    burstStop: 0.16,
    burstEvery: 0.45,
    holdFire: true,
    turn: 15,
    aimGate: 0.18,
    scopeScale: 0.70,
    strafeStill: 0.04,
    strafeW: 1.15,
    strafeT: [0.28, 0.70],
    jump: 0.18,
    rangeBias: 2,
    fireMul: 0.75,
    wrongGun: 0,
    knifeP: 0.12,
    knifeHp: 45,
    reloadAt: 0.72,
    panicReload: 0,
    panicAt: 1,
    hear: 40,
    hearMemory: 5,
    coverHp: 62,
    coverP: 0.80,
    coverDist: 14,
    coverHold: 2.2,
    flankP: 0.45,
    flankMin: 8,
    flankDist: 12,
    flankHold: 4,
    nadeP: 0.70,
    nadeMin: 7,
    nadeMax: 28,
    nadeAim: 0.70,
    nadeErr: 0.40,
    nadeLead: 1.0,
    nadeCd: [5, 8],
    nadeWait: [0.4, 1.0],
    nadeFlush: 2.2,
    rocketErr: 0.25,
    cornErr: 0.22,
    cornLead: 0.7,
    attackerBias: 0.35,
    playerBias: 0.75,
    finishHp: 40,
    finishBias: 0.55,
    zombie: {
      retarget: [0.16, 0.28], losEvery: 0.14, aggro: 52,
      spitLead: 0.72, spitErr: 0.28, spitRate: 0.75, keep: 1.12,
      atkRate: 0.80, turn: 13, flank: 5.5, spd: 1.06,
    },
  },
};

for (const p of Object.values(PROFILES)) { Object.freeze(p.zombie); Object.freeze(p); }

export function normBotDiff(id) {
  return PROFILES[id] ? id : DEFAULT_BOT_DIFF;
}
export function botDiffMeta(id) {
  const key = normBotDiff(id);
  return BOT_DIFFS.find((d) => d.id === key);
}
export function botProfile(id) { return PROFILES[normBotDiff(id)]; }
export function profileOf(bot) { return botProfile(bot && bot.diff); }
export function zombieTune(diffId) {
  const id = typeof diffId === 'function' ? diffId() : diffId;
  return botProfile(id).zombie;
}

// personalidade sorteada uma vez (criação, ou quando o anfitrião troca o nível)
export function applyBotDiff(bot, diffId, rnd = Math.random) {
  const id = normBotDiff(diffId);
  const p = PROFILES[id];
  bot.diff = id;
  bot.reaction = span(p.reaction, rnd);
  bot.accuracy = span(p.accuracy, rnd);
  bot.coverUntil = 0; bot.coverGoal = null;
  bot.flankUntil = 0; bot.flankGoal = null;
  bot.holdUntil = 0; bot.burstAt = 0;
  bot.heard = null; bot.heardAt = -99; bot.stepHeard = null;
  bot.sloppy = false;
  return bot;
}

export function nextThink(p, rnd = Math.random) { return span(p.think, rnd); }

// null = fora da visão. Menor score = alvo preferido. Não olha vida através de parede:
// o caller já filtrou por linha de visão.
export function considerTarget(p, dist, { attacker = false, player = false, hp = 100 } = {}) {
  if (dist > p.vision) return null;
  let s = dist;
  if (attacker) s *= p.attackerBias;
  if (player) s *= p.playerBias;
  if (p.finishHp > 0 && hp <= p.finishHp) s *= p.finishBias;
  return s;
}

export function scopeDelay(p, weaponIndex, scoped) {
  if (!scoped) return 0;
  const base = weaponIndex === 5 ? 1.15 : weaponIndex === 6 ? 0.45 : 0.8;
  return base * p.scopeScale;
}

function aimEase(p, aimTime) {
  if (!p.aimTightens) return 1;
  return ease(clamp(aimTime / p.aimSettle, 0, 1));
}

// cone do tiro, em radianos, no mesmo espírito do spread antigo.
export function shotSpread(p, bot, o) {
  const egged = o.egged ? 2.5 : 1;
  const self = o.selfMoving ? p.selfMove : 1;
  if (o.pellets > 1) return o.weaponSpread * p.pelletMul * self * egged;
  if (o.scope) return p.scopeSpread * (o.targetMoving ? p.scopeMove : 1) * self * egged;
  const e = p.aimTightens ? ease(clamp(o.aimTime / p.aimSettle, 0, 1)) : 0;
  const acc = p.aimTightens ? p.spreadOpen * (1 - e) + bot.accuracy * e : bot.accuracy;
  return acc * (o.targetMoving ? p.moveSpread : 1) * (o.pistol ? p.pistolMul : 1) * self * egged;
}

// ponto de mira no mundo + spread. target/vel são {x,y,z}. stance achata quem agacha.
export function hitscanAim(p, bot, target, vel, o) {
  const rnd = o.rnd || Math.random;
  const e = aimEase(p, o.aimTime || 0);
  const miss = p.missOpen + (p.missFloor - p.missOpen) * (p.aimTightens ? e : 1);
  const headP = p.headP * (o.targetMoving ? (p.headMove ?? 1) : 1);
  const goHead = headP > 0 && e >= p.headAfter && rnd() < headP;
  let h;
  if (goHead) h = p.headH + (rnd() - 0.5) * 0.05;
  else if (o.scope) h = 0.75 + rnd() * 0.40;
  else h = p.aimH[0] + rnd() * (p.aimH[1] - p.aimH[0]);
  h *= o.stance || 1;
  const leadK = e >= p.leadAfter ? p.lead : 0;
  const jitter = 1 + (rnd() - 0.5) * 2 * (p.leadErr || 0);
  const vx = vel ? vel.x || 0 : 0, vz = vel ? vel.z || 0 : 0;
  return {
    x: target.x + vx * leadK * jitter + (rnd() - 0.5) * 2 * miss,
    y: target.y + h,
    z: target.z + vz * leadK * jitter + (rnd() - 0.5) * 2 * miss,
    spread: shotSpread(p, bot, o),
    head: !!goHead,
  };
}

export function rollStrafe(p, rnd = Math.random) {
  const dir = rnd() < p.strafeStill ? 0 : (rnd() < 0.5 ? -1 : 1);
  return { dir, t: span(p.strafeT, rnd), jump: rnd() < p.jump };
}

export function wantPanicReload(p, magFrac, rnd = Math.random) {
  return p.panicReload > 0 && magFrac < p.panicAt && rnd() < p.panicReload;
}
export function wantSafeReload(p, magFrac) { return magFrac < p.reloadAt; }

// 'throw' | 'wait' | 'no'. wait = desiste por um instante (o caller soma nadeWait).
export function nadeChoice(p, bot, dist, dy, now, rnd = Math.random) {
  if (!bot || bot.nades <= 0) return 'no';
  if (dist < p.nadeMin || dist > p.nadeMax || Math.abs(dy) >= 3) return 'no';
  if (now <= (bot.nextNade || 0)) return 'no';
  if ((bot.aim || 0) <= (bot.reaction || 0) * p.nadeAim) return 'no';
  return rnd() < p.nadeP ? 'throw' : 'wait';
}
export function nadeWaitFor(p, rnd = Math.random) { return span(p.nadeWait, rnd); }
export function nadeCooldown(p, rnd = Math.random) { return span(p.nadeCd, rnd); }

// sampleNode() → {x,y,z} ou null. losClear(a, b) → o olho do alvo vê o ponto?
export function refreshCover(p, bot, threat, sampleNode, losClear, now, rnd = Math.random) {
  if (bot.coverUntil > now && bot.coverGoal) {
    if (bot.hp > p.coverHp + 18) { bot.coverUntil = 0; bot.coverGoal = null; return null; }
    return bot.coverGoal;
  }
  if (!(p.coverP > 0) || bot.hp > p.coverHp || !sampleNode || rnd() > p.coverP) {
    bot.coverGoal = null; return null;
  }
  let best = null, bestS = 1e9;
  for (let i = 0; i < 8; i++) {
    const n = sampleNode(); if (!n) break;
    const d = Math.hypot(n.x - bot.pos.x, n.z - bot.pos.z);
    if (d < 2.5 || d > p.coverDist) continue;
    const hidden = !losClear(
      { x: threat.x, y: threat.y + 1.5, z: threat.z },
      { x: n.x, y: (n.y || 0) + 1.2, z: n.z },
    );
    if (!hidden) continue;
    const s = d + rnd() * 2;
    if (s < bestS) { bestS = s; best = n; }
  }
  if (!best) return null;
  bot.coverGoal = { x: best.x, y: best.y || bot.pos.y, z: best.z };
  bot.coverUntil = now + p.coverHold;
  return bot.coverGoal;
}

export function refreshFlank(p, bot, threat, dist, now, rnd = Math.random) {
  if (bot.flankUntil > now && bot.flankGoal) return bot.flankGoal;
  if (!(p.flankP > 0) || dist < p.flankMin || rnd() > p.flankP) { bot.flankGoal = null; return null; }
  const tx = threat.x - bot.pos.x, tz = threat.z - bot.pos.z, L = Math.hypot(tx, tz) || 1;
  const side = rnd() < 0.5 ? -1 : 1;
  bot.flankGoal = {
    x: threat.x + (-tz / L) * p.flankDist * side,
    y: bot.pos.y,
    z: threat.z + (tx / L) * p.flankDist * side,
  };
  bot.flankUntil = now + p.flankHold;
  return bot.flankGoal;
}

// tiro ouvido vira um lugar pra investigar. Quem já está vendo um alvo não larga ele.
export function hearGunshot(bots, origin, shooter, now) {
  if (!origin || !shooter || shooter.zt) return;
  for (const b of bots) {
    if (!b || b === shooter || !b.alive || !b.bot || b.zt || b.dummy) continue;
    const p = profileOf(b);
    if (!(p.hear > 0)) continue;
    const d = Math.hypot(b.pos.x - origin.x, b.pos.z - origin.z);
    if (d > p.hear || d < 0.8) continue;
    if (b.target && b.target.alive) continue;
    b.heard = { x: origin.x, y: origin.y, z: origin.z };
    b.heardAt = now;
  }
}

// Costas: o bot não vê quem está atrás do olhar. Passo bem perto é a única pista.
export const STEP_ALERT = 5;
export const STEP_ALERT_MEM = 1.6;

export function isBehind(bot, other) {
  if (!bot || !other || !bot.pos || !other.pos) return false;
  const dx = other.pos.x - bot.pos.x, dz = other.pos.z - bot.pos.z;
  const L = Math.hypot(dx, dz);
  if (!(L > 0.35)) return false;
  const dot = (Math.sin(bot.yaw || 0) * dx + Math.cos(bot.yaw || 0) * dz) / L;
  return dot < -0.2;
}

export function noteFootstep(bots, walker, now, hostile = () => true) {
  if (!walker || !walker.alive || walker.zt || !walker.pos) return;
  for (const b of bots) {
    if (!b || b === walker || !b.alive || !b.bot || b.zt || b.dummy) continue;
    if (!hostile(b, walker)) continue;
    const d = Math.hypot(b.pos.x - walker.pos.x, b.pos.z - walker.pos.z);
    if (!(d <= STEP_ALERT) || d < 0.15) continue;
    b.stepHeard = { who: walker, at: now };
    if (!isBehind(b, walker) || (b.target && b.target.alive)) continue;
    b.heard = { x: walker.pos.x, y: walker.pos.y, z: walker.pos.z };
    b.heardAt = now;
  }
}

export function canSpot(bot, other, now) {
  if (!isBehind(bot, other)) return true;
  const h = bot && bot.stepHeard;
  return !!(h && h.who === other && now - h.at < STEP_ALERT_MEM);
}

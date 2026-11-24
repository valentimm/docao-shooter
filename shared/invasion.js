// ============================================================
//  Modo Invasão (Halloween 🎃): co-op contra hordas de zumbis — regras + simulação compartilhada.
//  Roda igual no cliente offline (solo) e no servidor online (autoritativo). Sem DOM, sem Three.js.
//  • Todos os jogadores de verdade no mesmo time, sem bots de jogador. Sem fogo amigo: tiro, explosão, killstreak
//    e poder nunca machucam jogador (nem você mesmo). Quem machuca jogador é zumbi e a Névoa Assombrada.
//  • 20 waves, cada uma mais difícil (mais zumbis, mais vida, mais rápidos). Da wave 13 em diante parte da
//    horda nasce feroz: 1,5× o zumbi normal da wave, mais esperta e com um golpe a mais do próprio tipo.
//    Às vezes a wave vira temática: a horda puxa para um grupo de zumbis que já entrou na rotação.
//    Da wave 10 em diante, 1% dos zumbis comuns nasce Docão Mutação Macabra: dois tipos no mesmo corpo, com o poder dos dois.
//    Com mais de um jogador, um Docão Shapeshifter (nunca dois ao mesmo tempo) nasce escondido, fora da visão: copia a pele e a arma de alguém e, se chegarem perto, suga a alma.
//    Chefão a cada 5 waves (Abóbora, Barriguinha, Fantasma, Múmia, Lobisomem, Louco ou Hospício).
//    Pausa de ~15 s entre as waves. Wave 20 = vitória.
//  • 2 vidas por jogador: morreu com vida sobrando, renasce normal; sem vidas, fica assistindo.
//    Normal: fica uma cruz no chão e um aliado revive segurando E 5 s (cavando). Qualquer dano no meio
//    zera o progresso e é preciso soltar e segurar de novo. A Ressurreição também vale (máx. 4 por bloco
//    de 5 waves e 1 por wave) e levanta todo mundo de uma vez. Hardcore: sem cruz e sem Ressurreição.
//    Todo mundo fora = fim de jogo.
//  • Poderes caem dos zumbis (chance baixa), pega no chão andando por cima, guarda até 3.
//  • Névoa Assombrada (estilo tempestade do Fortnite): círculo seguro diminui e muda de lugar a cada wave.
//    Fora dele o jogador perde vida; zumbi não sente a névoa.
//  Integração: o host (main.js offline ou server/src/game.js) passa um adaptador A (ver InvasionCore).
//  A.botDiff (string ou função) escolhe o jeito da horda em shared/bot-difficulty.js.
//  Vida, dano e quantidade de zumbis continuam no waveSpec — a dificuldade não multiplica isso.
// ============================================================
import { zombieTune } from './bot-difficulty.js';
import { fellOff } from './physics.js';
import { HUPS, rollOffer, takeOffer, hReady, historiaSpot } from './historia-ups.js';
import { rollPass, takePass, enqueueHistoria, nextHistoria, passLv, passHp, brasaStats, plateBlocks, coveiroScale } from './historia-pass.js';
import { createEgg, stepRitual, notePool, eggAfterWave, claimMuro, EGG_SPOTS, nearSpot } from './historia-egg.js';
import { storyPlan, STORY_ZTS, praisesTable } from './historia-finale.js';
import { ULTS, rollUltimate } from './historia-ult.js';
export const INV = {
  mode: 'inv', WAVES: 20, PREP: 12, BREAK: 15, LIVES: 2, INV_MAX: 3,
  DROP_LIFE: 35, PICK_R: 1.5, BOSS_EVERY: 5, RES_PER_BLOCK: 4, BLOCK: 5,
  FOG_MIN_R: 11, FOG_SHRINK: 32, FOG_DPS: 5, FOG_DPS_WAVE: 0.5,
  MAX_PLAYERS: 30, DEFAULT_MAP: 'rodizio', ZOMBIE_LINGER: 2.4, SPAWN_MIN: 12,
};
export const isInvasion = (m) => m === INV.mode;
// Modo história: a mesma Invasão zumbi, sempre na HOTMILK à Noite (Papada, barraca, parede e portas) e sempre no Normal.
export const HISTORIA = { mode: 'historia', map: 'hotmilk-noite', diff: 'normal' };
export const isHistoria = (m) => m === HISTORIA.mode;
// Dificuldade da Invasão (quem cria a sala escolhe; padrão Normal).
//  • normal: como sempre + quem fica sem vidas vira uma cruz no chão; um aliado segura E por 5 s ao lado dela e revive.
//  • hard (Hardcore): sem cruz e a Ressurreição nunca cai nem pode ser usada. Sem vidas = assistindo até o fim.
// A cruz é só da Invasão Clássica: o Survival já tem o caído (shared/downed.js).
export const INV_DIFFS = ['normal', 'hard'];
export const INV_DIFF_LABEL = { normal: 'Normal', hard: 'Hardcore' };
export function normInvDiff(v) { return v === 'hard' || v === 'hardcore' ? 'hard' : 'normal'; }
export const INV_CROSS = { hold: 5, range: 2.2, reachY: 1.6, hp: 50, key: 'KeyE', keyLabel: 'E' };
// A futura frente de down chama isto no zumbi (não implementa o estado caído).
// order: { targetId?: number, hold?: boolean }. targetId troca o alvo na hora;
// hold faz o zumbi parar de caçar. A.targetable(player) no adaptador, se existir,
// tira alguém da lista (por exemplo um jogador caído) sem mudar o resto da horda.
export function orderZombie(z, order) {
  if (!z) return;
  z.order = order || null;
  z.retarget = 0;
}
// Munição na Invasão: caixas do mapa voltam rápido, dão mais (reserva até 1,5× e pente cheio, +2 foguetes) e zumbi também solta caixa.
export const INV_AMMO = { respawn: 6, reserveMul: 1.5, rockets: 2, zdrop: { walker: 0.14, runner: 0.12, tank: 0.4, spitter: 0.2, sling: 0.16, bat: 0.14, cry: 0.22, boss: 1, bossBelly: 1, bossGhost: 1, bossMummy: 1, bossWolf: 1, bossCrazy: 1, bossHosp: 1 } };
// mesma conta no cliente offline, no cliente online (espelho do 'got'/'dg') e no servidor. Devolve true se pegou alguma coisa.
export function invRefillAmmo(e, WEAPONS) {
  let got = false;
  for (const i of e.slots) {
    const w = WEAPONS[i]; if (!w || !(w.reserve > 0)) continue;
    const cap = Math.ceil(w.reserve * INV_AMMO.reserveMul);
    const left = w.akimbo ? (e.drum && e.drum[i] != null ? e.drum[i] : w.mag) : w.mag;
    if (e.reserve[i] >= cap && e.mag[i] >= w.mag && left >= w.mag) continue;
    e.reserve[i] = Math.min(cap, e.reserve[i] + (w.rocket ? INV_AMMO.rockets : w.reserve));
    e.mag[i] = Math.max(e.mag[i], w.mag);
    if (w.akimbo) { if (!e.drum) e.drum = WEAPONS.map(() => null); e.drum[i] = w.mag; }
    got = true;
  }
  return got;
}
export const PHASES = ['prep', 'wave', 'break', 'over'];

// tipos de zumbi (animatrônicos do Docão). size = escala do corpo (hitbox e modelo).
// Chefões: todos começam com "boss" (isBoss). Rotação a cada BOSS_EVERY waves.
export const BOSS_TYPES = ['boss', 'bossBelly', 'bossGhost', 'bossMummy', 'bossWolf', 'bossCrazy', 'bossHosp'];
export const isBoss = (zt) => typeof zt === 'string' && zt.startsWith('boss');
export const bossOfWave = (w) => BOSS_TYPES[Math.max(0, Math.floor(w / INV.BOSS_EVERY) - 1) % BOSS_TYPES.length];
// A partida embaralha esta lista. O ciclo de bossOfWave fica só de reserva.
export function shuffleBosses(rnd = Math.random) {
  const a = BOSS_TYPES.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const ZPOSE = ['', 'wind', 'sling', 'cry', 'frenzy', 'rage', 'suck'];
export const ZTYPES = ['walker', 'runner', 'tank', 'spitter', 'sling', 'bat', 'cry', ...BOSS_TYPES, 'shape'];
export const ZOMBIES = {
  walker: { name: 'Docão Podre', hp: 110, speed: 4.4, dmg: 14, rate: 1.0, reach: 1.75, size: 1, drop: 0.06, weight: 1 },
  runner: { name: 'Esqueleto Corredor', hp: 55, speed: 6.6, dmg: 8, rate: 0.7, reach: 1.55, size: 0.95, drop: 0.05, weight: 0.7 },
  tank: { name: 'Barrigão de Gás', hp: 520, speed: 3.0, dmg: 26, rate: 1.4, reach: 2.1, size: 1.3, drop: 0.3, weight: 4.2, boom: { radius: 4.8, dmg: 38, knock: 9 } },
  spitter: { name: 'Cuspidor', hp: 85, speed: 4.0, dmg: 10, rate: 1.2, reach: 1.65, size: 1.05, drop: 0.09, weight: 1.5, spit: { range: 22, keep: 11, every: 2.6, speed: 15, dmg: 13, radius: 1.8 } },
  // Estilingue: arma o corpo e se joga, mas o voo tem teto de metros.
  sling: { name: 'Docão Elástico', hp: 95, speed: 4.2, dmg: 16, rate: 1.05, reach: 1.7, size: 1, drop: 0.08, weight: 1.8, sling: { range: 16, wind: 0.65, speed: 20, max: 11, cd: 4.2, hop: 6.2 } },
  // Mais lento no plano. Voa na altura de quem está caçando, sem subir num telhado mais alto.
  bat: { name: 'Docão Morcego', hp: 80, speed: 3.15, dmg: 12, rate: 1.15, reach: 1.7, size: 0.92, drop: 0.07, weight: 1.6, fly: 1.85 },
  // Sentada chorando (apanha menos). Perto, corre. Um minuto sem levar tiro, corre também.
  // Só tiro, sem chegar perto: aos 25% fica ainda mais rápida.
  cry: { name: 'Docão Chorona', hp: 190, speed: 4.6, dmg: 14, rate: 0.85, reach: 1.6, size: 0.98, drop: 0.1, weight: 2.6, cry: { resist: 0.4, wake: 4.2, frenzy: 1.85, rage: 2.7, rageAt: 0.25, alone: 60 } },
  // Copia pele e arma de um jogador. Não morde: anda como gente e, se alguém chega perto, suga a alma.
  shape: { name: 'Docão Shapeshifter', hp: 240, speed: 5.6, dmg: 0, rate: 9, reach: 0, size: 1, drop: 0.08, weight: 1, shape: { near: 2.35, suck: 1 } },
  // Docão Abóbora: abóbora explosiva, ou estoura o chão em volta. Na hora de atacar, sorteia um.
  boss: { name: 'Docão Abóbora', hp: 2600, speed: 4.4, dmg: 36, rate: 1.3, reach: 2.7, size: 1.7, drop: 1, spit: { range: 34, keep: 0, every: 4.2, speed: 17, dmg: 26, radius: 3.6, big: 1 }, moves: [
    { kind: 'spit' },
    { kind: 'slam', every: 3.6, range: 8, dmg: 38, radius: 4.6, knock: 11, stun: 0.5, style: 1 },
  ] },
  // Barriguinha: jato que deixa lento, ou barrigada que espalha a poça.
  bossBelly: { name: 'Barriguinha', hp: 2700, speed: 3.6, dmg: 32, rate: 1.45, reach: 2.5, size: 1.65, drop: 1, spit: { range: 28, keep: 0, every: 3.4, speed: 14, dmg: 22, radius: 3.2, pee: 1, slow: 2.4 }, moves: [
    { kind: 'spit' },
    { kind: 'slam', every: 3.2, range: 7.2, dmg: 30, radius: 3.8, knock: 7, slow: 2.1, style: 2 },
  ] },
  // Docão Fantasma: cuspe etéreo, ou atravessa até o jogador. A fase imune continua no próprio tempo.
  bossGhost: { name: 'Docão Fantasma', hp: 2200, speed: 5.0, dmg: 28, rate: 1.1, reach: 2.4, size: 1.55, drop: 1, phaseEvery: 7.5, phaseDur: 2.2, spit: { range: 30, keep: 0, every: 3.8, speed: 16, dmg: 20, radius: 2.8 }, moves: [
    { kind: 'spit' },
    { kind: 'blink', every: 4.4, range: 15, min: 2.2, dist: 8, dmg: 30, phase: 0.8 },
  ] },
  // Docão Múmia: atadura de longe, ou abraço que prende de perto.
  bossMummy: { name: 'Docão Múmia', hp: 2900, speed: 3.4, dmg: 30, rate: 1.5, reach: 2.6, size: 1.6, drop: 1, spit: { range: 26, keep: 0, every: 3.6, speed: 13, dmg: 18, radius: 2.6, wrap: 1, stun: 2.8 }, moves: [
    { kind: 'spit' },
    { kind: 'grab', every: 2.6, range: 6.2, dmg: 36, stun: 1.7 },
  ] },
  // Docão Lobisomem: uivo que atordoa, ou bote de garra.
  bossWolf: { name: 'Docão Lobisomem', hp: 2500, speed: 6.2, dmg: 40, rate: 0.95, reach: 2.8, size: 1.65, drop: 1, howlEvery: 6.5, howl: { radius: 11, stun: 2.2, dmg: 12 }, moves: [
    { kind: 'howl' },
    { kind: 'charge', every: 2.8, dmg: 44, sling: { range: 14, wind: 0.28, speed: 22, max: 9, hop: 5.4 } },
  ] },
  // Docão Louco: rajada de cuspe, ou giro que avança.
  bossCrazy: { name: 'Docão Louco', hp: 2400, speed: 5.4, dmg: 34, rate: 0.7, reach: 2.5, size: 1.55, drop: 1, spit: { range: 32, keep: 0, every: 2.2, speed: 18, dmg: 14, radius: 2.4, volley: 3 }, moves: [
    { kind: 'spit' },
    { kind: 'spin', every: 2.1, range: 9, step: 4.2, dmg: 28, radius: 5, knock: 6, style: 3 },
  ] },
  // Camisa de força: cabeçada curta ou grito. Abaixo da metade da vida, o grito volta mais cedo.
  bossHosp: { name: 'Docão Hospício', hp: 2850, speed: 4.7, dmg: 42, rate: 0.85, reach: 2.45, size: 1.6, drop: 1, sling: { range: 12, wind: 0.42, speed: 17, max: 8, cd: 2.6, hop: 4.5 }, howlEvery: 6.5, howl: { radius: 7.5, stun: 1.35, dmg: 16 }, surgeAt: 0.5, moves: [
    { kind: 'charge', dmg: 46, stun: 0.5 },
    { kind: 'howl' },
  ] },
  filho: { name: 'Filho do Barriguinha', storyHp: 260, hp: 260, speed: 3.8, dmg: 16, rate: 1.1, reach: 1.45, size: 0.82, drop: 0.04, boom: { radius: 3.2, dmg: 28, knock: 7 } },
  sinuca: { name: 'Link Neles', storyHp: 460, hp: 460, speed: 3.3, dmg: 26, rate: 0.95, reach: 1.85, size: 1.05, drop: 0.08, spit: { every: 2.8, speed: 16, dmg: 18, radius: 0.7, range: 18, style: 4, grav: 0.35 } },
  bonezinho: { name: 'Bonezinho', storyHp: 1280, hp: 1280, speed: 4.6, dmg: 34, rate: 0.7, reach: 2.05, size: 1.28, drop: 0.2, spit: { every: 1.5, speed: 18, dmg: 22, radius: 0.75, range: 20, style: 4, grav: 0.3 } },
  corrupt: { name: 'Docão Corrompido', storyHp: 720, hp: 720, speed: 3.5, dmg: 18, rate: 0.8, reach: 1.5, size: 1.05, drop: 0.1, spit: { every: 0.85, speed: 28, dmg: 14, radius: 0.35, range: 26, style: 9, grav: 0.12 } },
  bossMini: { name: 'Barriguinha Mirim', storyHp: 980, hp: 980, speed: 3.4, dmg: 22, rate: 1.1, reach: 1.9, size: 1.22, drop: 1, spit: { every: 2.4, speed: 13, dmg: 12, radius: 1.5, range: 16, pee: 1 }, moves: [{ kind: 'spit' }, { kind: 'slam', dmg: 26, radius: 3.2, stun: 0.45 }] },
  bossOclinhos: { name: 'Oclinhos', storyHp: 4200, hp: 4200, speed: 3.1, dmg: 36, rate: 0.9, reach: 2.4, size: 1.85, drop: 1 },
  bossBig: { name: 'Big Corrompido', storyHp: 6800, hp: 6800, speed: 3.4, dmg: 40, rate: 0.85, reach: 2.6, size: 2.2, drop: 1 },
};
// Feroz: 1,5 do zumbi normal da mesma wave (vida, velocidade, dano e peso no orçamento).
// A fila marca com "f:" na frente do tipo. Chefão não entra nessa conta.
export const FERAL = 1.5;
export const FERAL_FROM = 13;
export function spawnKind(token) {
  const s = typeof token === 'string' ? token : '';
  if (s.startsWith('f:')) return { type: s.slice(2), feral: true };
  return { type: s, feral: false };
}
export function feralChance(w) {
  if (w < FERAL_FROM) return 0;
  const t = (Math.min(INV.WAVES, w) - FERAL_FROM) / (INV.WAVES - FERAL_FROM);
  return Math.round((0.16 + 0.5 * t) * 100) / 100;
}
// Um golpe a mais, simples, do próprio tipo. A mira mais rápida fica em feralTune.
export const FERAL_ACT = { walker: 'rush', runner: 'leap', tank: 'stomp', spitter: 'acid', sling: 'stun', bat: 'dive', cry: 'sob' };
export function feralTune(base) {
  return {
    ...base,
    retarget: [base.retarget[0] * 0.55, base.retarget[1] * 0.55],
    losEvery: base.losEvery * 0.55,
    aggro: base.aggro * 1.35,
    spitLead: Math.min(0.9, (base.spitLead || 0) + 0.28),
    spitErr: (base.spitErr || 0) * 0.4,
    spitRate: base.spitRate * 0.72,
    atkRate: base.atkRate * 0.78,
    turn: base.turn + 4,
    flank: Math.max(base.flank || 0, 3.4),
  };
}
export const zombieWeight = (type) => {
  const { type: base, feral } = spawnKind(type);
  const st = ZOMBIES[base];
  const w = st && st.weight > 0 ? st.weight : 1;
  return feral ? w * FERAL : w;
};
// Docão Mutação Macabra: a partir da wave 10, 1% dos zumbis comuns nasce no lugar de outro.
// Junta o tipo que ia nascer com um segundo tipo da horda e fica com o poder dos dois.
export const MUTANT_FROM = 10;
export const MUTANT_P = 0.01;
export const MUTANT_NAME = 'Docão Mutação Macabra';
const MUTANT_POOL = ['walker', 'runner', 'tank', 'spitter', 'sling', 'bat', 'cry'];
export function rollMutantParts(type, rnd = Math.random) {
  const pool = MUTANT_POOL.filter((k) => k !== type && ZOMBIES[k]);
  if (!pool.length) return null;
  const other = pool[Math.floor(rnd() * pool.length) % pool.length];
  return [type, other];
}
export function mutantProfile(a, b) {
  const A = ZOMBIES[a], B = ZOMBIES[b];
  if (!A || !B) return null;
  const st = {
    name: MUTANT_NAME,
    hp: Math.max(A.hp, B.hp),
    speed: Math.max(A.speed, B.speed),
    dmg: Math.max(A.dmg, B.dmg),
    rate: Math.min(A.rate, B.rate),
    reach: Math.max(A.reach, B.reach),
    size: Math.max(A.size, B.size),
    drop: Math.max(A.drop, B.drop),
    weight: Math.max(A.weight, B.weight),
    parts: [a, b],
  };
  if (A.boom || B.boom) st.boom = A.boom || B.boom;
  if (A.spit || B.spit) st.spit = { ...(A.spit || B.spit) };
  if (A.sling || B.sling) st.sling = A.sling || B.sling;
  if (A.fly || B.fly) st.fly = Math.max(A.fly || 0, B.fly || 0);
  if (A.cry || B.cry) st.cry = A.cry || B.cry;
  return st;
}
export function zombieProfile(z) {
  if (!z) return null;
  if (z.zt === 'mutant' && z.parts && z.parts.length === 2) return mutantProfile(z.parts[0], z.parts[1]);
  return ZOMBIES[z.zt] || null;
}
const partOf = (z, k) => !!(z && (z.zt === k || (z.parts && z.parts.includes(k))));
// Chorona chorando toma menos dano. Cada tiro (queda do mapa não conta) reinicia o minuto.
// Aos 25% da vida, sem ter acordado, entra no frenesi extremo.
export function zombieTaken(z, amount, fall = false) {
  if (!z || !(amount > 0) || fall) return amount;
  const st = zombieProfile(z);
  if (!st || !st.cry) return amount;
  z.shots = (z.shots || 0) + 1;
  if (z.mood === 'frenzy' || z.mood === 'rage') return amount;
  const taken = amount * st.cry.resist;
  if (z.hp - taken <= (z.maxHp || st.hp) * st.cry.rageAt) z.mood = 'rage';
  return taken;
}
// poderes especiais (inventário de 3). w = peso no sorteio do drop.
export const POWERS = {
  pumpkin: { name: 'Abóbora Explosiva', icon: '🎃', w: 1.0, speed: 19, fuse: 1.8, radius: 6.5, dmg: 340, knock: 14, desc: 'Arremessa uma abóbora que explode em área' },
  howl: { name: 'Uivo do Lobisomem', icon: '🐺', w: 1.0, radius: 10, stun: 3.5, knock: 15, dmg: 25, desc: 'Empurra e atordoa os zumbis em volta' },
  potion: { name: 'Poção de Cura', icon: '🧪', w: 1.0, radius: 9, heal: 70, desc: 'Cura você e os aliados perto' },
  lantern: { name: 'Lanterna Sagrada', icon: '🔦', w: 0.9, range: 17, cone: 0.42, dur: 4.5, dps: 150, desc: 'Cone de luz que queima os zumbis' },
  ghost: { name: 'Fantasma', icon: '👻', w: 0.8, dur: 7, speed: 1.3, desc: 'Invisível pros zumbis e mais rápido' },
  revive: { name: 'Ressurreição', icon: '✨', w: 0.45, desc: 'Revive todos os aliados mortos' },
};
export const POWER_KEYS = ['pumpkin', 'howl', 'potion', 'lantern', 'ghost', 'revive'];
export const DROP_KEYS = [...POWER_KEYS, 'ammo']; // índice enviado no 'dp'/'dg': poderes e a caixa de munição que o zumbi solta
export const KEYS = { use: 'KeyG', useLabel: 'G', cycle: 'KeyX', cycleLabel: 'X' };
export const SPIT_GRAV = 20;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = (dx, dz) => Math.hypot(dx, dz);
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const r2 = (v) => Math.round(v * 100) / 100;

// composição da wave w (1..20) com n jogadores. Esta é a curva do Padrão.
// Survival não mexe aqui: passa getSurvivalWaveTuning em A.specFor.
export function waveSpec(w, n = 1) {
  n = clamp(n | 0 || 1, 1, INV.MAX_PLAYERS);
  const total = Math.round((12 + w * 6) * (1 + 0.6 * (n - 1))); // orçamento de peso (~18 na wave 1, ~132 na 20). Tipo forte come mais do orçamento.
  const mix = {
    walker: 1,
    runner: w >= 2 ? 0.14 + 0.022 * w : 0,
    sling: w >= 3 ? 0.08 + 0.01 * w : 0,
    spitter: w >= 4 ? 0.12 + 0.004 * w : 0,
    bat: w >= 5 ? 0.07 + 0.008 * w : 0,
    tank: w >= 6 ? 0.05 + 0.006 * w : 0,
    cry: w >= 7 ? 0.06 + 0.006 * w : 0,
  };
  const bossHpMul = (1 + 0.55 * (w / INV.BOSS_EVERY - 1)) * (1 + 0.5 * (n - 1));
  return {
    w, n, total, mix, boss: w % INV.BOSS_EVERY === 0,
    hpMul: (1 + 0.09 * (w - 1)) * (1 + 0.12 * (n - 1)),
    spdMul: Math.min(1.45, 1 + 0.025 * (w - 1)),
    dmgMul: 1 + 0.04 * (w - 1),
    maxAlive: Math.min(18 + 3 * n + w, 48), // teto de vivos ao mesmo tempo (desempenho); o resto entra em lotes
    batch: Math.min(6, 2 + Math.floor(w / 5) + Math.floor(n / 3)), // zumbis por lote
    spawnEvery: Math.max(0.35, 1.3 - 0.045 * w) / Math.sqrt(n),
    bossKind: bossOfWave(w),
    bossHpMul,
    bossHp: ZOMBIES.boss.hp * bossHpMul, // vida da abóbora nesta wave; cada chefão usa a própria base × bossHpMul
    feral: feralChance(w),
  };
}
// Waves temáticas. from = primeira wave em que todo tipo do tema já entrou na rotação normal.
// O mix substitui o da wave: o orçamento continua o mesmo, mas a horda puxa para o tema.
// THEME_P é a chance de a wave ser temática, entre as que já podem acontecer.
export const THEME_P = 0.2;
export const WAVE_THEMES = [
  { id: 'aereo', name: 'Ataque Aéreo', from: 5, blurb: 'O céu fechou de morcego.', mix: { bat: 7, walker: 0.4 } },
  { id: 'esqueleto', name: 'Corrida de Esqueleto', from: 2, blurb: 'Os esqueletos saíram na frente.', mix: { runner: 6, walker: 0.4 } },
  { id: 'elastico', name: 'Festa do Elástico', from: 3, blurb: 'Eles vêm pulando.', mix: { sling: 6, walker: 0.35 } },
  { id: 'cuspe', name: 'Cusparada', from: 4, blurb: 'Cuspe de todo lado.', mix: { spitter: 6, walker: 0.4 } },
  { id: 'gas', name: 'Barrigada de Gás', from: 6, blurb: 'Os barrigões tomaram a frente.', mix: { tank: 5, walker: 0.5 } },
  { id: 'choro', name: 'Coral de Choro', from: 7, blurb: 'O choro vem de todo canto.', mix: { cry: 6, walker: 0.35 } },
  { id: 'porteira', name: 'Estouro da Porteira', from: 2, blurb: 'A porteira abriu de uma vez.', mix: { walker: 1.1, runner: 2.8 } },
  { id: 'cerco', name: 'Cerco', from: 4, blurb: 'Cuspe na frente e podre fechando.', mix: { spitter: 2.6, walker: 1.2, runner: 0.6 } },
  { id: 'investida', name: 'Investida', from: 3, blurb: 'Corredor e elástico, sem dar tempo.', mix: { runner: 2.4, sling: 2.6, walker: 0.3 } },
  { id: 'cacada', name: 'Caçada', from: 5, blurb: 'Morcego em cima, esqueleto no chão.', mix: { bat: 3, runner: 2, walker: 0.3 } },
  { id: 'paredao', name: 'Paredão', from: 6, blurb: 'Barrigão na frente, o resto atrás.', mix: { tank: 2.8, walker: 1.4, runner: 0.5 } },
  { id: 'noite', name: 'Noite de Terror', from: 7, blurb: 'Choro, morcego e cuspe juntos.', mix: { cry: 2.4, bat: 2.4, spitter: 1.1, walker: 0.25 } },
];
export function themesForWave(w, mix) {
  return WAVE_THEMES.filter((t) => t.from <= w && Object.keys(t.mix).every((k) => ZOMBIES[k] && t.mix[k] > 0 && (!mix || mix[k] > 0)));
}
export function rollTheme(w, rnd = Math.random, mix, avoidId = '') {
  let pool = themesForWave(w, mix);
  if (avoidId && pool.length > 1) pool = pool.filter((t) => t.id !== avoidId);
  if (!pool.length || rnd() >= THEME_P) return null;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}
export function applyTheme(spec, theme) {
  if (!spec || !theme) return spec;
  const mix = {};
  for (const [k, v] of Object.entries(theme.mix)) if (v > 0 && ZOMBIES[k]) mix[k] = v;
  if (!Object.keys(mix).length) return spec;
  return { ...spec, mix, theme: theme.id, themeName: theme.name, themeBlurb: theme.blurb };
}
export function themeIndex(id) {
  const i = WAVE_THEMES.findIndex((t) => t.id === id);
  return i < 0 ? 0 : i + 1;
}
// fila da wave: o total é um orçamento. Tipo mais forte pesa mais e entra menos vezes.
export function waveQueue(spec, rnd = Math.random) {
  const keys = Object.keys(spec.mix).filter((k) => spec.mix[k] > 0 && ZOMBIES[k]);
  if (!keys.length) return [];
  const sum = keys.reduce((a, k) => a + spec.mix[k], 0);
  const light = keys.slice().sort((a, b) => zombieWeight(a) - zombieWeight(b))[0];
  const chance = spec.feral > 0 ? spec.feral : 0;
  const q = [];
  let budget = spec.total;
  let guard = Math.ceil(spec.total / zombieWeight(light)) + 4;
  while (budget + 1e-6 >= zombieWeight(light) && guard-- > 0) {
    let r = rnd() * sum, k = keys[0];
    for (const kk of keys) { r -= spec.mix[kk]; if (r <= 0) { k = kk; break; } }
    let feral = chance > 0 && rnd() < chance;
    let wgt = zombieWeight(k) * (feral ? FERAL : 1);
    if (feral && wgt > budget + 1e-6) { feral = false; wgt = zombieWeight(k); }
    if (wgt > budget + 1e-6) { k = light; feral = false; wgt = zombieWeight(k); }
    q.push(feral ? 'f:' + k : k);
    budget -= wgt;
  }
  if ((spec.n | 0) > 1 && q.length) {
    const walkers = [];
    q.forEach((t, idx) => { if (spawnKind(t).type === 'walker') walkers.push(idx); });
    const pool = walkers.length ? walkers : q.map((_, idx) => idx);
    q[pool[Math.floor(rnd() * pool.length) % pool.length]] = 'shape';
  }
  return q;
}
// raio do círculo seguro alvo da wave w (mapa com meia-largura hx/hz)
export function fogRadius(w, hx, hz) {
  const R0 = Math.hypot(hx, hz) * 0.8, f = Math.pow(1 - (w - 1) / (INV.WAVES - 1), 1.25);
  return Math.max(INV.FOG_MIN_R, INV.FOG_MIN_R + (R0 - INV.FOG_MIN_R) * f);
}
export const fogDps = (w) => INV.FOG_DPS + INV.FOG_DPS_WAVE * w;
// a Ressurreição pode cair? (máx. RES_PER_BLOCK por bloco de 5 waves, 1 por wave)
export function reviveAllowed(counts, wave) {
  const blk = Math.floor((Math.max(1, wave) - 1) / INV.BLOCK);
  return !(counts.wave[wave] >= 1) && (counts.block[blk] || 0) < INV.RES_PER_BLOCK;
}
export function noteRevive(counts, wave) { const blk = Math.floor((Math.max(1, wave) - 1) / INV.BLOCK); counts.wave[wave] = (counts.wave[wave] || 0) + 1; counts.block[blk] = (counts.block[blk] || 0) + 1; }
// direção da câmera a partir do yaw/pitch do MODELO (yaw do modelo = câmera + π)
export function modelAim(yaw, pitch) { const c = Math.cos(pitch); return { x: Math.sin(yaw) * c, y: Math.sin(pitch), z: Math.cos(yaw) * c }; }
// raio × esfera escalada (zumbis maiores têm hitbox maior): usa as mesmas esferas do Docão (shared/physics HITBOXES)
export function scaleHit(o, d, pos, size, fn) {
  if (!size || size === 1) return fn(o, pos);
  const so = { x: pos.x + (o.x - pos.x) / size, y: pos.y + (o.y - pos.y) / size, z: pos.z + (o.z - pos.z) / size };
  const h = fn(so, pos); return h ? { ...h, t: h.t * size } : null;
}

// ------------------------------------------------------------
//  Simulação. A (adaptador do host):
//   T() tempo de jogo · P física (shared/physics) · nav (nav.js) · size [hx, hz]
//   players() humanos na partida (vivos ou não): { id, pos, vel, alive, hp, yaw, pitch, lives, out, inv, ghostUntil }
//   spawnZombie(type, pos) → ent (host cria e põe na lista dele; o core preenche os campos de zumbi)
//   removeZombie(z) · hurtPlayer(p, dmg, src|null) · hurtZombie(z, dmg, by, kind) · knock(e, {x,y,z})
//   heal(p, hp) · revive(p, pos, { exact, hp }?) · invChanged(p) · emit(ev) · aimOf(p) → { o, d } · over(won, wave)
//   rnd() opcional · hard (bool ou função): Hardcore
//   players() também lê p.useHold (segurando E) para a cruz do Normal
// ------------------------------------------------------------
export class InvasionCore {
  constructor(A) {
    this.A = A; this.rnd = A.rnd || Math.random;
    this.phase = 'prep'; this.wave = 0; this.phaseEnd = 0; this.queue = []; this.nextSpawn = 0; this.bossAt = 0;
    this.zombies = []; this.drops = []; this.projs = []; this.lanterns = []; this.nid = 1;
    this.resCount = { wave: {}, block: {} }; this.spec = null; this.bossId = 0; this.won = false; this.bossOrder = shuffleBosses(this.rnd);
    const [hx, hz] = A.size; this.hx = hx; this.hz = hz;
    const R = Math.hypot(hx, hz) + 6; this.fog = { cx: 0, cz: 0, r: R, fx: 0, fz: 0, fr: R, tx: 0, tz: 0, tr: R, t0: 0, t1: 0 };
    this.flow = null; this.flowAt = -9; this.rev = null; this.fogTick = 0; this.overAt = 0; this.embers = [];
    this.kills = 0;
    this.crosses = []; // Normal: { p, x, y, z, by, prog } — quem ficou sem vidas espera aqui um aliado
  }
  get T() { return this.A.T(); }
  // Hardcore: A.hard (bool ou função). Lido na hora (a sala pode trocar antes de começar).
  get hard() { const h = this.A.hard; return typeof h === 'function' ? !!h() : !!h; }
  get crossOn() { return !this.hard && !this.A.survival; }
  // Padrão: waveSpec. Survival liga A.specFor e o resto da simulação lê o spec que sair dali.
  specFor(w, n) {
    const fn = this.A.specFor;
    return typeof fn === 'function' ? fn(w, n) : waveSpec(w, n);
  }
  start() {
    this.phase = 'prep'; this.wave = 0;
    const custom = typeof this.A.specFor === 'function';
    const prep = custom ? this.specFor(1, Math.max(1, this.A.players().length)).prep : 0;
    this.phaseEnd = this.T + (prep > 0 ? prep : INV.PREP);
    for (const p of this.A.players()) { this.ensure(p, true); p.eggShock = p.eggShockNext = p.eggSuit = false; p.eggHideUntil = p.eggJumpUntil = p.eggPoolUntil = p.eggDanceUntil = p.eggShockAt = p.eggBoost = 0; }
    this.egg = this.A.story && this.A.story() ? createEgg(this.rnd) : null;
    this.A.emit(['wv', 0, 0, r2(this.phaseEnd)]);
  }
  ensure(p, reset = false) {
    if (reset || p.lives == null) { p.lives = INV.LIVES; p.out = false; p.inv = []; p.ghostUntil = 0; p.graveBroke = false; p.digLock = false; p._digHp = null; }
    if (!p.inv) p.inv = []; return p;
  }
  humansAlive() { return this.A.players().filter((p) => p.alive); }
  liveZombies() { return this.zombies.filter((z) => z.alive); }
  waveZombies() { return this.zombies.filter((z) => z.alive && !z.egg); }
  // ---------- laço ----------
  step(dt) {
    if (this.phase === 'over') return;
    const T = this.T;
    for (const p of this.A.players()) this.ensure(p);
    if ((this.phase === 'prep' || this.phase === 'break') && T >= this.phaseEnd) this.startWave(this.wave + 1);
    if (this.phase === 'wave') this.stepSpawns(T);
    this.stepFog(T, dt);
    if (T - this.flowAt > 0.5 || (this.A.survival && T - this.flowAt > 0.22 && this.flowSeedsMoved())) this.buildFlow();
    for (const z of this.zombies) if (z.alive) this.stepZombie(z, dt, T);
    this.separate();
    this.stepProjs(dt, T);
    this.stepPassives(dt, T);
    this.stepEggs(dt, T);
    this.stepFinale(dt, T);
    this.stepUltimates(dt, T);
    this.stepLanterns(dt, T);
    this.stepDrops(T);
    this.stepCrosses(dt);
    for (const z of this.zombies.filter((x) => !x.alive && T >= x.removeAt)) { this.zombies = this.zombies.filter((x) => x !== z); this.A.removeZombie(z); }
    if (this.phase === 'wave' && !this.queue.length && !this.bossPending && !(this.drip && this.drip.length) && !this.waveZombies().length) { this.shapeWant = false; this.endWave(); }
    const H = this.A.players();
    if (H.length && H.every((p) => !p.alive && p.out)) { if (!this.overAt) this.overAt = T + 1.2; else if (T >= this.overAt) this.finish(false); }
    else this.overAt = 0;
  }
  startWave(w) {
    const n = Math.max(1, this.A.players().length);
    this.wave = w; this.phase = 'wave'; this.spec = this.specFor(w, n);
    if (this.spec.boss) {
      if (!this.bossOrder || !this.bossOrder.length) this.bossOrder = shuffleBosses(this.rnd);
      const i = Math.floor(w / INV.BOSS_EVERY) - 1;
      if (i > 0 && i % BOSS_TYPES.length === 0) this.bossOrder = shuffleBosses(this.rnd);
      this.spec.bossKind = this.bossOrder[((i % this.bossOrder.length) + this.bossOrder.length) % this.bossOrder.length];
    }
    const theme = rollTheme(w, this.rnd, this.spec.mix, this.themeId);
    this.spec = applyTheme(this.spec, theme);
    if (theme) this.themeId = theme.id;
    this.queue = waveQueue(this.spec, this.rnd);
    this.drip = []; this.storyName = '';
    if (this.egg) { const plan = storyPlan(w); if (plan) this.applyStoryPlan(plan); }
    this.nextSpawn = this.T + (this.spec.lead > 0 ? this.spec.lead : 0.8); this.bossPending = this.spec.boss; this.bossAt = this.T + 3.5; this.bossId = 0;
    this.planFog(w);
    const bossN = this.spec.boss ? BOSS_TYPES.indexOf(this.spec.bossKind) + 1 : 0;
    this.A.emit(['wv', 1, w, bossN, this.spec.boss ? 1 : 0, this.queue.length + (this.spec.boss ? 1 : 0) + ((this.drip && this.drip.length) || 0), themeIndex(this.spec.theme)]);
    if (this.storyName) this.A.emit(['qe', 'wv', this.storyName, this.storyBlurb || '']);
    this.openEggWave();
  }
  endWave() {
    if (!this.egg) { if (this.wave >= INV.WAVES) { this.finish(true); return; } }
    else if (this.closeEggWave().finish) { this.finish(true); return; }
    const bossWave = !!(this.spec && this.spec.boss);
    this.phase = 'break'; this.phaseEnd = this.T + (this.spec && this.spec.gap > 0 ? this.spec.gap : INV.BREAK);
    this.A.emit(['wv', 2, this.wave, r2(this.phaseEnd)]);
    if (!bossWave) this.offerPassivas();
    if (this.egg && this.wave === 20) this.grantUltimates();
    if (this.egg && this.wave >= 20) this.openStoryFog();
  }
  finish(won) {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.won = won; this.A.emit(['wv', 3, this.wave, won ? 1 : 0]);
    this.A.over(won, this.wave);
  }
  // ---------- névoa ----------
  openStoryFog() {
    const R = Math.hypot(this.hx, this.hz) + 24, F = this.fog;
    Object.assign(F, { fx: F.cx, fz: F.cz, fr: F.r, tx: 0, tz: 0, tr: R, t0: this.T, t1: this.T + 1.6 });
  }
  planFog(w) {
    if (this.egg && w >= 21) { this.openStoryFog(); return; }
    const F = this.fog, tr = fogRadius(w, this.hx, this.hz);
    const room = Math.max(0, Math.min(F.r, F.fr === F.tr ? F.r : F.r) - tr);
    let best = null, bs = -1e9; const good = (this.A.nav && this.A.nav.good) || [];
    for (let i = 0; i < 70 && good.length; i++) {
      const nd = good[Math.floor(this.rnd() * good.length)]; if (nd.y > 1.5) continue;
      const dc = hyp(nd.x - F.cx, nd.z - F.cz); if (dc > room) continue;
      // fica longe da borda do mapa e anda um pouco (move de verdade, sem pular pra longe demais)
      const edge = Math.min(this.hx - Math.abs(nd.x), this.hz - Math.abs(nd.z));
      const s = Math.min(edge, tr * 0.6) + Math.min(dc, room * 0.7) * 0.5 + this.rnd() * 4;
      if (s > bs) { bs = s; best = nd; }
    }
    const c = best || { x: F.cx, z: F.cz };
    Object.assign(F, { fx: F.cx, fz: F.cz, fr: F.r, tx: c.x, tz: c.z, tr, t0: this.T, t1: this.T + INV.FOG_SHRINK });
  }
  stepFog(T, dt) {
    const F = this.fog;
    if (F.t1 > F.t0) { const k = clamp((T - F.t0) / (F.t1 - F.t0), 0, 1), e = k * k * (3 - 2 * k); F.cx = F.fx + (F.tx - F.fx) * e; F.cz = F.fz + (F.tz - F.fz) * e; F.r = F.fr + (F.tr - F.fr) * e; }
    this.fogTick += dt; if (this.fogTick < 0.5) return; const step = this.fogTick; this.fogTick = 0;
    if (this.phase === 'prep') return;
    for (const p of this.A.players()) if (p.alive && !this.inSafe(p.pos)) this.A.hurtPlayer(p, fogDps(Math.max(1, this.wave)) * step, null);
  }
  inSafe(pos, F = this.fog) { return hyp(pos.x - F.cx, pos.z - F.cz) <= F.r; }
  // ---------- zumbis ----------
  stepSpawns(T) {
    const S = this.spec;
    if (this.bossPending && T >= this.bossAt) { const kind = (this.spec && this.spec.bossKind) || bossOfWave(this.wave); const z = this.spawn(kind); if (z) { this.bossPending = false; this.bossId = z.id; } }
    if (this.queue.length) {
      const rest = [];
      let want = false;
      for (const t of this.queue) {
        if (spawnKind(t).type === 'shape') want = true;
        else rest.push(t);
      }
      if (want) { this.queue = rest; if (!this.zombies.some((z) => z.alive && z.zt === 'shape')) this.shapeWant = true; }
    }
    if (this.queue.length && T >= this.nextSpawn) {
      if (this.waveZombies().length >= S.maxAlive) this.nextSpawn = T + 0.4;
      else {
        const burst = Math.min(S.batch || 1, S.maxAlive - this.waveZombies().length); // lote (sem passar do teto)
        for (let i = 0; i < burst && this.queue.length; i++) if (this.spawn(this.queue[0])) this.queue.shift();
        this.nextSpawn = T + S.spawnEvery * (0.6 + this.rnd() * 0.8);
      }
    }
    if (this.drip && this.drip.length && T >= (this.dripAt || 0) && this.waveZombies().length < (S.maxAlive || 24)) {
      if (this.spawn(this.drip[0])) this.drip.shift();
      this.dripAt = T + 6.5;
    }
    this.tryShape(T);
  }
  // Só um no mapa. Nasce num ponto andável que nenhum jogador vivo enxerga, para não verem o surgimento.
  tryShape(T) {
    if (!this.shapeWant) return;
    if (this.zombies.some((z) => z.alive && z.zt === 'shape')) { this.shapeWant = false; return; }
    if (T < (this.nextShape || 0)) return;
    const pos = this.shapePos();
    if (!pos || !this.spawn('shape', pos)) { this.nextShape = T + 0.5; return; }
    this.shapeWant = false;
  }
  shapePos() {
    const custom = this.A.spawnPoints ? this.A.spawnPoints() : null;
    const good = (custom && custom.length ? custom : ((this.A.nav && this.A.nav.good) || []));
    if (!good.length) return null;
    const H = this.A.players().filter((p) => this.visible(p)), P = this.A.P;
    const hidden = (nd) => {
      for (const p of H) {
        if (d3(nd, p.pos) < 6) return false;
        if (P && P.losClear && P.losClear({ x: p.pos.x, y: p.pos.y + 1.6, z: p.pos.z }, { x: nd.x, y: (nd.y || 0) + 1.2, z: nd.z })) return false;
      }
      return true;
    };
    const tries = Math.min(good.length, 80);
    for (let i = 0; i < tries; i++) {
      const nd = good[Math.floor(this.rnd() * good.length) % good.length];
      if (hidden(nd)) return { x: nd.x, y: nd.y, z: nd.z };
    }
    return null;
  }
  // onde nasce um zumbi: ponto ALEATÓRIO andável do mapa inteiro (nav.good = chão alcançável, fora de parede),
  // a pelo menos SPAWN_MIN m de todo jogador vivo e, se der, fora da linha de visão deles (sem susto à queima-roupa)
  spawnPos() {
    // Survival: A.spawnPoints() devolve só os pontos das áreas já compradas (array).
    // Sem o método, ou devolvendo null, continua o sorteio no mapa inteiro.
    const custom = this.A.spawnPoints ? this.A.spawnPoints() : null;
    if (custom && !custom.length) return null;
    if (custom && this.A.survival) return this.survivalSpawn(custom);
    const good = custom || ((this.A.nav && this.A.nav.good) || []), H = this.A.players().filter((p) => p.alive), P = this.A.P;
    let best = null, bs = -1e9;
    const tries = custom ? Math.min(80, Math.max(24, custom.length * 4)) : 60;
    for (let i = 0; i < tries && good.length; i++) {
      const nd = good[Math.floor(this.rnd() * good.length)];
      let dp = 1e9; for (const p of H) dp = Math.min(dp, d3(nd, p.pos)); if (dp < INV.SPAWN_MIN) continue;
      let seen = false;
      if (P && P.losClear && dp < 45) for (const p of H) { if (d3(nd, p.pos) < 45 && P.losClear({ x: p.pos.x, y: p.pos.y + 1.6, z: p.pos.z }, { x: nd.x, y: nd.y + 1.2, z: nd.z })) { seen = true; break; } }
      const s = this.rnd() * 10 - (seen ? 25 : 0) - Math.max(0, dp - 50) * 0.4; // aleatório; escondido; não longe demais da ação
      if (s > bs) { bs = s; best = nd; } if (!seen && dp <= 50 && i > 8) break;
    }
    return best ? { x: best.x, y: best.y, z: best.z } : null;
  }
  spawn(token, at) {
    let cast = null;
    if (typeof token === 'string' && token.startsWith('c:')) {
      const p = token.split(':');
      cast = { skin: p[1] || 'classico', w: p[2] | 0 };
      token = 'corrupt';
    }
    const { type, feral } = spawnKind(token);
    if (type === 'shape' && this.zombies.some((z) => z.alive && z.zt === 'shape')) return null;
    const pos = at || (type === 'shape' ? this.shapePos() : this.spawnPos()); if (!pos) return null;
    const waveN = Math.max(this.wave | 0, (this.spec && this.spec.w) | 0);
    let zt = type, parts = null;
    if (!this._noMutant && type !== 'shape' && !isBoss(type) && !STORY_ZTS.has(type) && waveN >= MUTANT_FROM && this.rnd() < MUTANT_P) {
      parts = rollMutantParts(type, this.rnd);
      if (parts) zt = 'mutant';
    }
    const st = zt === 'mutant' ? mutantProfile(parts[0], parts[1]) : ZOMBIES[type];
    if (!st) return null;
    const face = type === 'shape' ? this.copyFace() : null;
    const S = this.spec || waveSpec(1, 1);
    const z = this.A.spawnZombie(zt, pos, parts, face); if (!z) return null;
    const waveMul = S.bossHp > 0 ? S.bossHp / ZOMBIES.boss.hp : (S.bossHpMul > 0 ? S.bossHpMul : 1);
    const fierce = feral ? FERAL : 1;
    const hp = (isBoss(type) ? st.hp * waveMul : st.hp * S.hpMul) * fierce;
    Object.assign(z, { zt, parts, zi: ZTYPES.indexOf(zt), hp, maxHp: hp, alive: true, spd: st.speed * S.spdMul * (0.92 + this.rnd() * 0.16) * fierce, dmgMul: (S.dmgMul || 1) * fierce, size: st.size, feral,
      nextAtk: this.T + 0.6, nextSpit: this.T + 1 + this.rnd() * st.rate, nextHowl: this.T + 2 + this.rnd() * 2, nextPhase: this.T + 3 + this.rnd() * 2, nextFeral: this.T + 0.8 + this.rnd() * 1.4, phaseUntil: 0, stunUntil: 0, target: null, retarget: 0, node: null, nodeAt: -9, stuck: 0, removeAt: Infinity, lastLos: false, losAt: -9,
      mood: st.cry ? 'cry' : '', pose: st.cry ? 'cry' : '', fly: !!st.fly, slingWind: 0, slingFly: 0, nextSling: this.T + 0.6, surge: false, quietAt: st.cry ? this.T : 0, shots: 0, shotsSeen: 0, rushUntil: 0, leapUntil: 0, diveUntil: 0 });
    if (face) { z.face = face; z.skin = face.skin; z.weapon = face.w | 0; z.primary = z.weapon; z.name = face.name; }
    else z.name = feral ? `${st.name} Feroz` : st.name;
    if (st.storyHp) { z.hp = z.maxHp = st.storyHp * fierce; z.spd = st.speed * (0.92 + this.rnd() * 0.16); z.dmgMul = fierce || 1; z.size = st.size; }
    if (cast) { z.skin = cast.skin; z.weapon = cast.w; z.primary = cast.w; z.name = 'Docão Corrompido'; }
    if (type === 'bossBig') { z.skin = 'c20'; z.name = 'Big Corrompido'; }
    z.vel.x = z.vel.y = z.vel.z = 0; z.onGround = true; z.crouch = 0;
    this.zombies.push(z); if (this.A.spawned) this.A.spawned(z); return z;
  }
  visible(p) { return p.alive && !(p.ghostUntil > this.T); }
  buildFlow() {
    this.flowAt = this.T; const nav = this.A.nav; if (!nav || !nav.nodes) return;
    const N = nav.nodes.length;
    if (!this.rev) { this.rev = nav.nodes.map(() => []); for (const n of nav.nodes) if (n.ok) for (const [j, c] of n.e) if (nav.nodes[j].ok) this.rev[j].push([n.id, c]); }
    // Float64 de propósito: Float32 arredonda a diagonal (√2) pra baixo e o teste
    // `d > dist[i]` joga fora a única entrada da heap. O campo parava na quina e o
    // zumbi ia reto na parede. Cada nó expande uma vez.
    const dist = new Float64Array(N).fill(Infinity), next = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [];
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    for (const p of this.A.players()) {
      if (!this.zombieWants(p)) continue;
      const nd = this.A.survival ? this.standNode(p.pos.x, p.pos.y, p.pos.z) : this.playerNode(p.pos.x, p.pos.y, p.pos.z);
      if (nd) { dist[nd.id] = 0; next[nd.id] = nd.id; push(nd.id, 0); }
    }
    const cap = N * 6 + 1000; let it = 0;
    while (heap.length && it++ < cap) {
      const [d, i] = pop(); if (closed[i] || d > dist[i]) continue; closed[i] = 1;
      for (const [j, c] of this.rev[i]) { const nd = d + c; if (nd < dist[j]) { dist[j] = nd; next[j] = i; push(j, nd); } }
    }
    this.flow = { dist, next };
    this._apSet = null; this.flowGen = (this.flowGen || 0) + 1;
    this._seedKey = this.currentSeedKey();
  }
  zombieWants(p) {
    if (!this.visible(p)) return false;
    if (typeof this.A.targetable === 'function') return !!this.A.targetable(p);
    return true;
  }
  currentSeedKey() {
    const nav = this.A.nav; if (!nav) return '';
    const ids = [];
    for (const p of this.A.players()) if (this.zombieWants(p)) { const n = this.standNode(p.pos.x, p.pos.y, p.pos.z); ids.push(p.id, n ? n.id : -1); }
    return ids.join(',');
  }
  flowSeedsMoved() { return this.currentSeedKey() !== this._seedKey; }
  // Destino da horda. Um telhado mais alto ao lado não conta: a horda ia pra lá
  // e deixava o jogador sozinho na caixa em que ele subiu.
  playerNode(x, y, z) {
    const nav = this.A.nav; if (!nav || !nav.nearest) return null;
    const n0 = nav.nearest(x, y, z);
    if (n0) {
      const dxz = Math.hypot(n0.x - x, n0.z - z), dy = n0.y - y;
      if ((dxz <= 1.35 && dy <= 0.9 && dy >= -1.25) || (dxz <= 4 && dy <= 0.45 && dy >= -1.25)) return n0;
    }
    let best = null, bs = 1e9;
    const list = nav.good || [];
    for (let i = 0; i < list.length; i++) {
      const g = list[i], dxz = Math.hypot(g.x - x, g.z - z), dy = g.y - y;
      if (dxz > 6 || dy > 0.45 || dy < -3.5) continue;
      const s = dxz + Math.max(0, -dy) * 1.2;
      if (s < bs) { bs = s; best = g; }
    }
    return best;
  }
  // Nó do chão em que o zumbi está. nearest() aceita um piso até 2 m acima e a horda subia nele.
  footNode(x, y, z) {
    const nav = this.A.nav; if (!nav || !nav.nearest) return null;
    const n0 = nav.nearest(x, y, z);
    if (n0 && Math.abs(n0.y - y) <= 0.7 && Math.hypot(n0.x - x, n0.z - z) <= 3) return n0;
    let best = null, bs = 1e9;
    const list = nav.good || [];
    for (let i = 0; i < list.length; i++) {
      const g = list[i], dxz = Math.hypot(g.x - x, g.z - z);
      if (dxz > 3.5 || Math.abs(g.y - y) > 0.7) continue;
      const s = dxz + Math.abs(g.y - y) * 2;
      if (s < bs) { bs = s; best = g; }
    }
    return best || (n0 && Math.abs(n0.y - y) <= 1.1 ? n0 : null);
  }
  // Nó em que o corpo realmente pisa. nearest() devolve o mais perto mesmo
  // quando a caminhada até ele atravessa a parede; isso semeava o fluxo do lado errado.
  standNode(x, y, z) {
    const nav = this.A.nav; if (!nav) return null;
    const from = { x, y, z };
    const n0 = nav.nearest(x, y, z);
    if (n0 && Math.hypot(n0.x - x, n0.z - z) < 3.2 && Math.abs(n0.y - y) < 1.4 && nav.walk(from, n0) >= 0) return n0;
    const near = [];
    for (const g of nav.good) {
      const d = Math.hypot(g.x - x, g.z - z);
      if (d > 4 || Math.abs(g.y - y) > 1.5) continue;
      near.push([d, g]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(6, near.length); i++) if (nav.walk(from, near[i][1]) >= 0) return near[i][1];
    return null;
  }
  pickTarget(z) {
    if (z.order && z.order.hold) return null;
    if (z.order && z.order.targetId != null) {
      const forced = this.A.players().find((p) => p.id === z.order.targetId);
      if (forced && this.zombieWants(forced)) return forced;
    }
    let best = null, bd = 1e9;
    for (const p of this.A.players()) { if (!this.zombieWants(p)) continue; const d = d3(p.pos, z.pos) * (p === z.target ? 0.8 : 1); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  setPose(z, pose) {
    pose = pose || '';
    if ((z.pose || '') === pose) return;
    z.pose = pose;
    this.A.emit(['zp', z.id, Math.max(0, ZPOSE.indexOf(pose))]);
  }
  // Sem tiro por `alone` segundos, a Chorona larga o choro e corre. Cada tiro reinicia a conta.
  cryClock(z, st, T) {
    if (!st || !st.cry || z.mood === 'frenzy' || z.mood === 'rage') return;
    if ((z.shots || 0) !== (z.shotsSeen || 0)) { z.shotsSeen = z.shots || 0; z.quietAt = T; }
    if (z.quietAt == null) z.quietAt = T;
    if (T - z.quietAt >= (st.cry.alone > 0 ? st.cry.alone : 60)) z.mood = 'frenzy';
  }
  // Elástico arma e se joga (alcance limitado). Chorona senta até acordar.
  trick(z, st, t, dh, dx, dz, dy, T) {
    let cryOut = null;
    if (st.cry) {
      this.cryClock(z, st, T);
      if (z.mood !== 'rage' && dh < st.cry.wake && Math.abs(dy) < 2.4) z.mood = 'frenzy';
      if (z.mood !== 'frenzy' && z.mood !== 'rage') return { override: true, hold: true, noBite: true, pose: 'cry' };
      cryOut = { spMul: z.mood === 'rage' ? st.cry.rage : st.cry.frenzy, pose: z.mood };
    }
    const sling = z.slingSpec || st.sling;
    if (!sling) return cryOut;
    if (z.slingFly > T && z.slingDir) return { override: true, mx: z.slingDir.x, mz: z.slingDir.z, sp: sling.speed, pose: 'sling' };
    if (z.slingWind && T >= z.slingWind && z.slingArm) {
      const arm = z.slingArm;
      z.slingDir = { x: arm.x, z: arm.z };
      z.slingFly = T + Math.max(0.18, arm.dist / sling.speed);
      z.slingWind = 0;
      z.vel.y = Math.max(z.vel.y, sling.hop || 6);
      z.onGround = false;
      return { override: true, mx: arm.x, mz: arm.z, sp: sling.speed, pose: 'sling' };
    }
    if (z.slingWind > T) return { override: true, hold: true, pose: 'wind' };
    if (st.moves) return cryOut;
    if (z.lastLos && T >= (z.nextSling || 0) && dh > 3.2 && dh <= sling.range) {
      z.slingWind = T + sling.wind;
      z.nextSling = T + sling.cd;
      z.slingArm = { x: dx / dh, z: dz / dh, dist: Math.min(dh, sling.max) };
      if (z.feral) { z.slingHit = st.dmg * 0.85; z.slingStun = 0.5; }
      return { override: true, hold: true, pose: 'wind' };
    }
    return cryOut;
  }
  // Golpe extra do feroz. O normal continua valendo; isto só acrescenta um.
  feralAct(z, st, t, dh, dx, dz, dy, T, trick) {
    if (!z.feral || T < (z.nextFeral || 0)) return;
    const types = z.parts && z.parts.length ? z.parts : [z.zt];
    const last = z.feralKind;
    const ordered = last && types.includes(last) ? types.filter((k) => k !== last).concat(last) : types;
    const held = !!(trick && trick.hold);
    for (const kind of ordered) {
      if (kind === 'walker' && !held && z.lastLos && dh > 2.6 && dh < 9) {
        z.nextFeral = T + 3.6; z.feralKind = kind; z.rushUntil = T + 0.48; z.rushDir = { x: dx / dh, z: dz / dh }; return;
      } else if (kind === 'runner' && !held && z.lastLos && dh > 3.4 && dh < 12 && !(z.leapUntil > T)) {
        z.nextFeral = T + 2.6; z.feralKind = kind; z.leapUntil = T + 0.42; z.leapDir = { x: dx / dh, z: dz / dh };
        z.vel.y = Math.max(z.vel.y, 6.4); z.onGround = false; return;
      } else if (kind === 'tank' && dh < 4.8 && Math.abs(dy) < 2.2) {
        z.nextFeral = T + 4.6; z.feralKind = kind;
        this.bossNova(z, { dmg: 14, radius: 3.2, knock: 5.5, style: 1 }); return;
      } else if (kind === 'spitter' && z.lastLos && st.spit && dh > 4 && dh < st.spit.range + 2) {
        z.nextFeral = T + 5.4; z.feralKind = kind;
        this.spit(z, t, 0, { ...st.spit, pee: 1, slow: 1.8, dmg: 9, radius: 2.2, speed: st.spit.speed * 0.9 }); return;
      } else if (kind === 'bat' && dh < 9 && z.pos.y > t.pos.y + 1.3) {
        z.nextFeral = T + 3.2; z.feralKind = kind; z.diveUntil = T + 0.65; return;
      } else if (kind === 'cry' && z.mood !== 'frenzy' && z.mood !== 'rage' && dh < 7.2) {
        z.nextFeral = T + 4.5; z.feralKind = kind;
        this.bossHowl(z, { radius: 6.2, stun: 0.8, dmg: 5 }, 0); return;
      }
    }
  }
  copyFace() {
    const all = this.A.players().filter((p) => p && !p.zt);
    const live = all.filter((p) => p.alive);
    const pool = live.length ? live : all;
    const who = pool.length ? pool[Math.floor(this.rnd() * pool.length) % pool.length] : null;
    if (!who) return { skin: '', w: 0, name: ZOMBIES.shape.name };
    const w = who.weapon != null ? who.weapon : (who.primary != null ? who.primary : 0);
    return { skin: who.skin || who.skinId || '', w: w | 0, name: who.name || ZOMBIES.shape.name };
  }
  curse(p, z) {
    if (!p || p.zt || !p.alive) return;
    p.soul = z.id;
    this.A.emit(['soul', p.id, z.id]);
  }
  cure(p) {
    if (!p || !p.soul) return;
    p.soul = 0;
    this.A.emit(['soul', p.id, 0]);
  }
  cureBy(id) { for (const p of this.A.players()) if (p && p.soul === id) this.cure(p); }
  stepShape(z, dt, T) {
    const P = this.A.P, nav = this.A.nav, spec = ZOMBIES.shape.shape || {};
    const near = spec.near || 2.35, suckT = spec.suck || 1;
    const find = (id) => this.A.players().find((p) => p && p.id === id);
    const pose = (name) => { const i = ZPOSE.indexOf(name); if (z.pose === name) return; z.pose = name; this.A.emit(['zp', z.id, i < 0 ? 0 : i]); };
    if (z.suck) {
      const p = find(z.suck.id);
      if (!p || !p.alive || p.zt) { z.suck = null; pose(''); }
      else {
        const dx = p.pos.x - z.pos.x, dz = p.pos.z - z.pos.z, d = Math.hypot(dx, dz) || 1;
        z.yaw = Math.atan2(dx, dz);
        z.vel.x = (dx / d) * 9; z.vel.z = (dz / d) * 9;
        if (!z.suck.hopped) { z.vel.y = 7; z.suck.hopped = true; }
        pose('suck');
        if (P && P.moveEntity) P.moveEntity(z, dt, nav, { step: 0.42, h: 1.7 });
        if (T >= z.suck.until) {
          if (p.alive && !p.zt) this.curse(p, z);
          z.suck = null; pose(''); z.nextSuck = T + 3;
        }
        return;
      }
    }
    let prey = null, bd = near;
    const H = this.A.players().filter((p) => this.visible(p) && !p.zt);
    for (const p of H) {
      if (Math.abs(p.pos.y - z.pos.y) > 2.2) continue;
      const d = Math.hypot(p.pos.x - z.pos.x, p.pos.z - z.pos.z);
      if (d < bd && !(z.nextSuck > T)) { bd = d; prey = p; }
    }
    if (prey) {
      z.suck = { id: prey.id, until: T + suckT, hopped: false };
      pose('suck');
      return;
    }
    if (!z.goal || z.goalT < T || z.stuck > 2.5) {
      const prey = this.A.players().filter((p) => this.visible(p) && !p.zt)
        .sort((a, b) => hyp(a.pos.x - z.pos.x, a.pos.z - z.pos.z) - hyp(b.pos.x - z.pos.x, b.pos.z - z.pos.z))[0];
      if (z.stuck > 2.5 && prey) {
        this.repathAround(z, T);
        const s = this.routeTo(z, prey, T);
        if (s && !s.hold && (s.x || s.z)) z.goal = { x: z.pos.x + s.x * 6, y: prey.pos.y, z: z.pos.z + s.z * 6 };
        else z.goal = { x: prey.pos.x, y: prey.pos.y, z: prey.pos.z };
        z.goalT = T + 3;
      } else {
        const spot = nav && typeof nav.good === 'function' ? nav.good(this.rnd) : (nav && nav.good && nav.good.length ? nav.good[Math.floor(this.rnd() * nav.good.length)] : null);
        z.goal = spot ? { x: spot.x, y: spot.y, z: spot.z } : { x: (this.A.fog && this.A.fog.cx) || 0, y: z.pos.y, z: (this.A.fog && this.A.fog.cz) || 0 };
        z.goalT = T + 4 + this.rnd() * 3;
      }
      z.stuck = 0;
    }
    const dx = z.goal.x - z.pos.x, dz = z.goal.z - z.pos.z, d = Math.hypot(dx, dz);
    if (d < 1.2) { z.vel.x = z.vel.z = 0; z.goalT = 0; }
    else {
      z.yaw = Math.atan2(dx, dz);
      z.vel.x = (dx / d) * z.spd; z.vel.z = (dz / d) * z.spd;
      const moved = Math.hypot(z.pos.x - (z.px || z.pos.x), z.pos.z - (z.pz || z.pos.z));
      z.stuck = moved < 0.04 ? z.stuck + dt : 0;
    }
    z.px = z.pos.x; z.pz = z.pos.z;
    if (z.pose) pose('');
    if (P && P.moveEntity) P.moveEntity(z, dt, nav, { step: 0.42, h: 1.7 });
  }
  stepZombie(z, dt, T) {
    if (z.zt === 'shape') { this.stepShape(z, dt, T); return; }
    if (z.friendly) { this.stepAlly(z, dt, T); return; }
    if (z.fightUntil > T) { this.stepTurned(z, dt, T); return; }
    if (z.egg === 'lanche') { this.stepLanche(z, T); return; }
    if (z.campUntil > T) { z.vel.x = z.vel.z = 0; return; }
    if (praisesTable(z, EGG_SPOTS.pool)) {
      const spot = EGG_SPOTS.pool;
      z.yaw = Math.atan2(z.pos.x - spot.x, z.pos.z - spot.z);
      z.vel.x = z.vel.y = z.vel.z = 0;
      z.pose = 'cry';
      return;
    }
    const st = zombieProfile(z), P = this.A.P, tune0 = zombieTune(this.A.botDiff), tune = z.feral ? feralTune(tune0) : tune0;
    if (!st) return;
    if (st.cry) this.cryClock(z, st, T);
    if (st.phaseEvery && T >= z.nextPhase) { // Docão Fantasma: some por alguns segundos (imune)
      z.phaseUntil = T + st.phaseDur; z.nextPhase = T + st.phaseEvery * (0.85 + this.rnd() * 0.3);
      z.phased = true; this.A.emit(['zf', z.id, 1]);
    } else if (z.phased && !(z.phaseUntil > T)) { z.phased = false; this.A.emit(['zf', z.id, 0]); }
    if (T >= z.retarget) { z.target = this.pickTarget(z); z.retarget = T + tune.retarget[0] + this.rnd() * (tune.retarget[1] - tune.retarget[0]); }
    let t = z.target; if (t && !this.zombieWants(t)) { t = z.target = null; }
    if (z.egg === 'refri') { z.spd = Math.min(z.spd || 2, 2.3); if (t && hyp(t.pos.x - z.pos.x, t.pos.z - z.pos.z) > 5.2) t = z.target = null; }
    if (z.lureUntil > T && !this.ultProtected(z)) {
      const who = this.A.players().find((p) => p && p.id === z.lureId && p.alive);
      if (who) {
        const ld = hyp(who.pos.x - z.pos.x, who.pos.z - z.pos.z);
        if (ld < 1.4) { z.fightUntil = z.lureUntil; z.lureUntil = 0; this.stepTurned(z, dt, T); return; }
        z.target = t = who;
      }
    }
    let mx = 0, mz = 0, trick = null; const stunned = z.stunUntil > T;
    if (st.fly) z.fly = true;
    if (st.surgeAt && z.hp <= z.maxHp * st.surgeAt) z.surge = true;
    if (t && !stunned) {
      const dx = t.pos.x - z.pos.x, dz = t.pos.z - z.pos.z, dh = hyp(dx, dz) || 1, dy = t.pos.y - z.pos.y;
      if (T - z.losAt > tune.losEvery) { z.losAt = T; z.lastLos = dh < tune.aggro && P.losClear({ x: z.pos.x, y: z.pos.y + 1.5 * z.size, z: z.pos.z }, { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z }); }
      const struck = !!(st.moves && this.bossAttack(z, st, t, dh, dx, dz, dy, T, tune));
      if (!st.moves) {
        const howlEvery = st.howlEvery * (z.surge ? 0.42 : 1);
        if (st.howl && T >= z.nextHowl && dh < st.howl.radius) { z.nextHowl = T + howlEvery * (0.9 + this.rnd() * 0.25); this.bossHowl(z); }
      }
      trick = this.trick(z, st, t, dh, dx, dz, dy, T);
      const spit = !st.moves && st.spit && z.lastLos && dh < st.spit.range && !(trick && trick.override);
      if (spit && T >= z.nextSpit && dh > 3) {
        z.nextSpit = T + st.spit.every * tune.spitRate * (0.85 + this.rnd() * 0.3);
        const n = Math.max(1, st.spit.volley | 0);
        for (let i = 0; i < n; i++) this.spit(z, t, i * 0.08);
      }
      const reach = st.reach * Math.max(1, z.size * 0.85);
      const runnerSide = partOf(z, 'runner') ? 1.35 : 1;
      if (trick && trick.override) {
        mx = trick.hold ? 0 : (trick.mx || 0); mz = trick.hold ? 0 : (trick.mz || 0);
      } else if (st.fly) { mx = dx / dh; mz = dz / dh; z.aiState = 'fly'; }
      else if (this.A.survival || z.detourUntil > T) {
        const nav = this.A.nav;
        const straight = !!(z.lastLos && nav && dh < 16 && Math.abs(dy) < 1.35 && dh > reach * 0.55 && nav.walk(z.pos, t.pos) >= 0);
        if (straight) { mx = dx / dh; mz = dz / dh; z.aiState = 'direct'; z.route = null; }
        else if (dh > reach * 0.55) {
          const s = this.routeTo(z, t, T);
          if (s && !s.hold) { mx = s.x; mz = s.z; z.aiState = s.via || 'seek'; }
          else { z.aiState = 'hold'; }
        } else z.aiState = 'seek';
        if ((mx || mz) && tune.flank > 0 && dh > reach * 2) {
          const side = (z.id % 2 ? 1 : -1) * runnerSide;
          mx += (-dz / dh) * tune.flank * 0.05 * side; mz += (dx / dh) * tune.flank * 0.05 * side;
        }
        if (mx || mz) {
          const slot = ((z.id % 5) - 2) * 0.18;
          const ox = mx - mz * slot, oz = mz + mx * slot, L = hyp(ox, oz) || 1;
          const steered = this.steerClear(z, ox / L, oz / L);
          if (steered) { mx = steered.x; mz = steered.z; } else { mx = 0; mz = 0; z.aiState = 'hold'; }
        }
      } else {
        const keep = st.spit && st.spit.keep ? st.spit.keep * tune.keep : 0;
        let goDirect = z.lastLos && dh < (z.feral ? 14 : 9) && Math.abs(dy) < (st.fly ? st.fly + 1.2 : 1.3);
        if (spit && keep && dh < keep + 2) { goDirect = true; if (dh < keep - 2) { mx = -dx / dh; mz = -dz / dh; } }
        else if (goDirect) { if (dh > st.reach * 0.6) { mx = dx / dh; mz = dz / dh; } }
        else { const s = this.flowDir(z, T); if (s) { mx = s.x; mz = s.z; } else { mx = dx / dh; mz = dz / dh; } }
        // cerco: cada zumbi puxa um pouco pro lado (par/ímpar) pra não empilhar na mesma porta. 0 no Leitão e na Ceva.
        if (tune.flank > 0 && dh > st.reach * 2) { const side = (z.id % 2 ? 1 : -1) * runnerSide; mx += (-dz / dh) * tune.flank * 0.08 * side; mz += (dx / dh) * tune.flank * 0.08 * side; }
      }
      if (z.feral) this.feralAct(z, st, t, dh, dx, dz, dy, T, trick);
      if (z.rushUntil > T && z.rushDir && !(trick && trick.override)) { mx = z.rushDir.x; mz = z.rushDir.z; }
      if (z.leapUntil > T && z.leapDir && !(trick && trick.hold)) { mx = z.leapDir.x; mz = z.leapDir.z; }
      const faceRoute = (this.A.survival || z.detourUntil > T) && (mx || mz);
      const faceX = faceRoute ? mx : dx, faceZ = faceRoute ? mz : dz;
      const yawT = Math.atan2(faceX, faceZ); let dd = yawT - z.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); z.yaw += dd * Math.min(1, dt * tune.turn);
      if (z.slingHit && !(z.slingFly > T) && !(z.slingWind > T)) {
        const ram = z.slingHit, ramStun = z.slingStun || 0;
        z.slingHit = 0; z.slingStun = 0; z.slingSpec = null;
        if (dh < st.reach + 1.35 && Math.abs(dy) < 2.4) {
          this.A.emit(['za', z.id]);
          this.A.hurtPlayer(t, ram * (z.dmgMul || 1), z);
          if (ramStun) t.stunUntil = Math.max(t.stunUntil || 0, T + ramStun);
        }
      }
      const biteDy = st.fly ? st.fly + 0.75 : 1.7;
      const bite = !struck && !(trick && trick.noBite) && (this.A.survival ? this.canBite(z, t, dh, dy, reach) : (dh < reach && Math.abs(dy) < biteDy));
      if (bite && T >= z.nextAtk) {
        z.nextAtk = T + st.rate * tune.atkRate; this.A.emit(['za', z.id]); this.A.hurtPlayer(t, st.dmg * z.dmgMul, z);
      }
    } else if (!stunned) { // sem alvo (todo mundo fantasma ou morto): anda devagar pro centro da névoa
      if (st.cry && z.mood !== 'frenzy' && z.mood !== 'rage') trick = { hold: true, pose: 'cry' };
      else {
        const dx = this.fog.cx - z.pos.x, dz = this.fog.cz - z.pos.z, dh = hyp(dx, dz);
        if (dh > 4) { const s = this.flowDir(z, T); mx = (s ? s.x : dx / dh) * 0.4; mz = (s ? s.z : dz / dh) * 0.4; }
        if (st.cry) trick = { spMul: z.mood === 'rage' ? st.cry.rage : st.cry.frenzy, pose: z.mood };
      }
    }
    if (trick && trick.pose != null) this.setPose(z, trick.pose);
    else if (!(z.slingWind > T) && !(z.slingFly > T)) this.setPose(z, '');
    const base = trick && trick.sp > 0 ? trick.sp : z.spd * tune.spd * ((trick && trick.spMul) || 1);
    const ml = hyp(mx, mz);
    let sp = base * (stunned || (trick && trick.hold) ? 0 : 1);
    if (!(trick && trick.hold)) {
      if (z.rushUntil > T) sp *= 1.45;
      if (z.leapUntil > T) sp = Math.max(sp, (z.spd || 4) * 1.25);
    }
    if (ml > 0) { mx = mx / Math.max(1, ml) * sp; mz = mz / Math.max(1, ml) * sp; }
    if (mx || mz) { const yawM = Math.atan2(mx, mz); if (!t || stunned) { let dd = yawM - z.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); z.yaw += dd * Math.min(1, dt * (6 * tune.turn / 8)); } }
    const acc = (z.onGround || z.fly) ? 9 : 2.5; z.vel.x += (mx - z.vel.x) * Math.min(1, acc * dt); z.vel.z += (mz - z.vel.z) * Math.min(1, acc * dt);
    if (trick && trick.pose === 'sling' && trick.sp > 0) {
      const L = hyp(trick.mx || 0, trick.mz || 0) || 1;
      z.vel.x = (trick.mx || 0) / L * trick.sp; z.vel.z = (trick.mz || 0) / L * trick.sp;
    }
    if (st.fly && P && P.groundAt && !(trick && trick.hold)) {
      const floor = P.groundAt(z.pos.x, z.pos.z, z.pos.y + 0.15);
      const diving = !!(t && z.diveUntil > T);
      const aim = diving ? t.pos.y + 0.35 : (t ? t.pos.y + 1.15 : floor + st.fly);
      const bob = diving ? 0 : Math.sin(T * 3.1 + (z.id || 0)) * 0.12;
      const want = Math.max(floor + 0.4, aim) + bob;
      z.vel.y = clamp((want - z.pos.y) * (diving ? 10 : 5), diving ? -10 : -4.5, diving ? 2 : 6.5);
      z.onGround = false;
    }
    if (z.slowUntil > T) { z.vel.x *= 0.42; z.vel.z *= 0.42; }
    const blocked = P.moveEntity(z, dt);
    if (this.fellOffMap(z)) { this.killFallen(z); return; }
    if (this.A.survival) this.afterMoveSurvival(z, blocked, dt, T, t);
    else {
      if (blocked && ml > 0 && !st.fly) {
        z.stuck += dt;
        const dyP = t ? t.pos.y - z.pos.y : 0;
        const dhP = t ? hyp(t.pos.x - z.pos.x, t.pos.z - z.pos.z) : 99;
        const nd = z.node;
        const stepUp = nd && nd.y > z.pos.y + 0.4 && nd.y <= z.pos.y + 1.55 && hyp(nd.x - z.pos.x, nd.z - z.pos.z) < 2.4;
        const onto = t && dyP > 0.55 && dyP < 2.4 && dhP < 3.4;
        if (z.onGround && z.stuck > 0.28 && (stepUp || onto)) z.vel.y = 8.5;
        if (z.stuck > 2.4) { this.repathAround(z, T); z.stuck = 0; }
      } else if (!st.fly) z.stuck = Math.max(0, z.stuck - dt * 0.5);
      if (st.fly && blocked && t) {
        const side = (z.id % 2 ? 1 : -1), dhb = hyp(t.pos.x - z.pos.x, t.pos.z - z.pos.z) || 1;
        z.vel.x += (-(t.pos.z - z.pos.z) / dhb) * side * 2.4;
        z.vel.z += ((t.pos.x - z.pos.x) / dhb) * side * 2.4;
      }
    }
    const chasing = !!(t && !stunned && !st.fly && !(trick && trick.hold) && ml > 0.2);
    this.watchStuck(z, T, chasing);
  }
  // Parado no mesmo chão enquanto caça: o caminho atual está furado. Marca esses nós
  // e pede outro até o jogador. Não teleporta.
  watchStuck(z, T, chasing) {
    if (!chasing) { z.watchAt = T; z.watchX = z.pos.x; z.watchZ = z.pos.z; return; }
    if (z.watchAt == null) { z.watchAt = T; z.watchX = z.pos.x; z.watchZ = z.pos.z; return; }
    if (T - z.watchAt < 2.6) return;
    const moved = hyp(z.pos.x - z.watchX, z.pos.z - z.watchZ);
    z.watchAt = T; z.watchX = z.pos.x; z.watchZ = z.pos.z;
    if (moved >= 0.55) { z.stuckTries = Math.max(0, (z.stuckTries || 0) - 1); return; }
    this.repathAround(z, T);
  }
  repathAround(z, T) {
    if ((z.repathLock || 0) > T) return;
    z.repathLock = T + 2.2;
    if (!z.avoid) z.avoid = [];
    z.avoid = z.avoid.filter((a) => a.until > T);
    const here = this.standNode(z.pos.x, z.pos.y, z.pos.z);
    const hereId = here ? here.id : -1;
    const ban = (id) => {
      if (id == null || id < 0 || id === hereId) return;
      if (z.avoid.some((a) => a.id === id)) return;
      z.avoid.push({ id, until: T + 9 });
    };
    if (z.node && z.node.id !== hereId) ban(z.node.id);
    if (z.route && z.route[z.ri || 0]) ban(z.route[z.ri || 0].id);
    if (z.route && z.route[(z.ri || 0) + 1]) ban(z.route[(z.ri || 0) + 1].id);
    z.stuckTries = (z.stuckTries || 0) + 1;
    if (z.stuckTries >= 3 && this.A.nav && this.A.nav.good) {
      for (const n of this.A.nav.good) {
        if (n.id === hereId) continue;
        if (Math.hypot(n.x - z.pos.x, n.z - z.pos.z) < 1.8 && Math.abs(n.y - z.pos.y) < 0.8) ban(n.id);
      }
      z.stuckTries = 0;
    }
    if (z.avoid.length > 24) z.avoid.splice(0, z.avoid.length - 24);
    z.avoidGen = (z.avoidGen || 0) + 1;
    z.route = null; z.routeGen = -1; z.repathAt = 0; z.node = null; z.nodeAt = -9; z.stall = 0;
    z.detourUntil = T + 9;
  }
  avoidIds(z, T) {
    if (!z.avoid) return null;
    z.avoid = z.avoid.filter((a) => a.until > T);
    return z.avoid.length ? new Set(z.avoid.map((a) => a.id)) : null;
  }
  fallCfg() { const f = this.A.fall; return typeof f === 'function' ? f() : f; }
  fellOffMap(z) { return !!(z && z.alive && fellOff(this.fallCfg(), z.pos.y)); }
  killFallen(z) { if (!z || !z.alive) return; this.A.hurtZombie(z, (z.hp || 0) + 999, null, 'fall'); }
  unstick(z) { const p = this.spawnPos(); if (p) { z.pos.x = p.x; z.pos.y = p.y; z.pos.z = p.z; z.vel.x = z.vel.y = z.vel.z = 0; } z.stuck = 0; z.node = null; }
  flowDir(z, T, careful = false) {
    const nav = this.A.nav, F = this.flow; if (!nav || !F) return null;
    const refresh = !z.node || T - z.nodeAt > 0.45 || hyp(z.node.x - z.pos.x, z.node.z - z.pos.z) < 0.9;
    if (refresh) { z.node = careful ? this.standNode(z.pos.x, z.pos.y, z.pos.z) : this.footNode(z.pos.x, z.pos.y, z.pos.z); z.nodeAt = T; }
    const nd = z.node; if (!nd) return null;
    let via = 'seek', idx = F.next[nd.id];
    if (idx < 0) {
      if (!careful) return null;
      idx = this.approachTo(nd.id);
      via = 'approach';
      if (idx < 0) return { x: 0, z: 0, hold: true, via };
    }
    let tgt = nav.nodes[idx];
    if (!tgt) return null;
    if (via === 'approach' && tgt === nd) return { x: 0, z: 0, hold: true, via };
    if (hyp(nd.x - z.pos.x, nd.z - z.pos.z) > 1.6 && Math.abs(nd.y - z.pos.y) < 1.2) tgt = nd; // ainda não chegou no nó
    else if (via !== 'approach') {
      const n2 = F.next[tgt.id] >= 0 ? nav.nodes[F.next[tgt.id]] : null;
      if (n2 && n2 !== tgt && Math.abs(n2.y - z.pos.y) < 0.3 && Math.abs(tgt.y - z.pos.y) < 0.3 && (!careful || nav.walk(z.pos, n2) >= 0)) tgt = n2;
    }
    const vx = tgt.x - z.pos.x, vz = tgt.z - z.pos.z, L = hyp(vx, vz);
    if (L < 0.05) { z.node = tgt; return via === 'approach' ? { x: 0, z: 0, hold: true, via } : null; }
    if (L < 0.9) { z.node = tgt; z.nodeAt = T; }
    if (via === 'approach' && L < 1.15 && this.approachAnchor(tgt.id)) return { x: 0, z: 0, hold: true, via };
    return { x: vx / L, z: vz / L, via };
  }
  approachAnchor(id) {
    if (!this._apSet) return false;
    for (const table of this._apSet.values()) if (table[id] === id) return true;
    return false;
  }
  // Componente sem caminho até o jogador: anda até o nó acessível mais perto dele e para.
  // Não empurra o vetor através da parede. Recalcula quando o fluxo (porta, alvo) muda.
  approachTo(id, target = null) {
    const nav = this.A.nav, F = this.flow;
    if (!nav || !F || id < 0) return -1;
    const who = target ? target.id : 0;
    if (!this._apSet || this._apGen !== this.flowGen) { this._apGen = this.flowGen; this._apSet = new Map(); }
    let table = this._apSet.get(who);
    if (!table) { table = new Int32Array(nav.nodes.length).fill(-2); this._apSet.set(who, table); }
    if (table[id] !== -2) return table[id];
    const nodes = nav.nodes, mark = new Uint8Array(nodes.length), comp = [id];
    mark[id] = 1;
    for (let qi = 0; qi < comp.length; qi++) {
      const i = comp[qi];
      const see = (j) => { if (!nodes[j] || !nodes[j].ok || mark[j]) return; mark[j] = 1; comp.push(j); };
      for (const [j] of nodes[i].e) see(j);
      const incoming = this.rev && this.rev[i];
      if (incoming) for (const [j] of incoming) see(j);
    }
    const players = target ? [target] : this.A.players().filter((p) => this.zombieWants(p));
    let anchor = comp[0], ad = 1e9;
    for (const i of comp) {
      const n = nodes[i]; let dp = players.length ? 1e9 : Math.hypot(n.x, n.z);
      for (const p of players) dp = Math.min(dp, Math.hypot(n.x - p.pos.x, n.z - p.pos.z) + Math.abs(n.y - p.pos.y) * 2);
      if (dp < ad) { ad = dp; anchor = i; }
    }
    const dist = new Float64Array(nodes.length).fill(Infinity), next = new Int32Array(nodes.length).fill(-1), closed = new Uint8Array(nodes.length);
    dist[anchor] = 0; next[anchor] = anchor;
    const heap = [[0, anchor]];
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    while (heap.length) {
      const [d, i] = pop(); if (!mark[i] || closed[i] || d > dist[i]) continue; closed[i] = 1;
      for (const [j, c] of this.rev[i] || []) { if (!mark[j]) continue; const nd = d + c; if (nd < dist[j]) { dist[j] = nd; next[j] = i; push(j, nd); } }
    }
    for (const i of comp) table[i] = next[i];
    return table[id];
  }
  // Caminho até o alvo deste zumbi (não o mais perto no campo compartilhado).
  // Repete no máximo a cada 0,5 s, ou quando o alvo anda, a porta abre ou o progresso trava.
  routeTo(z, target, T) {
    const nav = this.A.nav; if (!nav || !target) return null;
    if (!this.flow) this.buildFlow();
    const goal = z.routeGoal;
    const goalMoved = !goal || Math.hypot(goal.x - target.pos.x, goal.z - target.pos.z) > 2.4 || Math.abs(goal.y - target.pos.y) > 0.9;
    const stale = z.routeGen !== this.flowGen || z.routeAvoid !== (z.avoidGen || 0) || goalMoved || (z.stall || 0) > 0.9 || T >= (z.repathAt || 0);
    if (stale) {
      const avoid = this.avoidIds(z, T);
      let route = nav.path(z.pos, target.pos, avoid);
      if ((!route || !route.length) && z.avoid && z.avoid.length) {
        z.avoid.shift();
        route = nav.path(z.pos, target.pos, this.avoidIds(z, T));
      }
      z.route = route;
      z.routeAvoid = z.avoidGen || 0;
      z.routeGoal = { x: target.pos.x, y: target.pos.y, z: target.pos.z };
      z.routeGen = this.flowGen;
      z.repathAt = T + 0.5;
      z.ri = 0;
    }
    const path = z.route;
    if (!path || !path.length) {
      const n = this.standNode(z.pos.x, z.pos.y, z.pos.z);
      z.node = n;
      if (!n) return { hold: true, via: 'approach' };
      const idx = this.approachTo(n.id, target);
      if (idx < 0) return { hold: true, via: 'approach' };
      const tgt = nav.nodes[idx];
      if (!tgt || tgt === n) return { hold: true, via: 'approach' };
      const vx = tgt.x - z.pos.x, vz = tgt.z - z.pos.z, L = hyp(vx, vz);
      if (L < 1.15 && idx === n.id) return { hold: true, via: 'approach' };
      if (L < 0.08) return { hold: true, via: 'approach' };
      return { x: vx / L, z: vz / L, via: 'approach' };
    }
    while (z.ri < path.length) {
      const n = path[z.ri];
      if (Math.hypot(n.x - z.pos.x, n.z - z.pos.z) < 0.95 && Math.abs(n.y - z.pos.y) < 1.35) z.ri++;
      else break;
    }
    if (z.ri + 1 < path.length && Math.abs(path[z.ri + 1].y - z.pos.y) < 0.45 && nav.walk(z.pos, path[z.ri + 1]) >= 0) z.ri++;
    if (z.ri >= path.length) {
      if (nav.walk(z.pos, target.pos) >= 0) {
        const vx = target.pos.x - z.pos.x, vz = target.pos.z - z.pos.z, L = hyp(vx, vz) || 1;
        return { x: vx / L, z: vz / L, via: 'direct' };
      }
      return { hold: true, via: 'seek' };
    }
    const tgt = path[z.ri];
    z.node = tgt;
    const vx = tgt.x - z.pos.x, vz = tgt.z - z.pos.z, L = hyp(vx, vz);
    if (L < 0.08) return { hold: true, via: 'seek' };
    return { x: vx / L, z: vz / L, via: 'seek' };
  }
  steerClear(z, mx, mz) {
    const P = this.A.P, step = 0.62, L = hyp(mx, mz) || 1; mx /= L; mz /= L;
    const free = (x, zz) => !P.collides(x, z.pos.y, zz);
    if (free(z.pos.x + mx * step, z.pos.z + mz * step)) return { x: mx, z: mz };
    let best = null, bd = -1e9;
    for (const deg of [32, -32, 58, -58, 90, -90, 125, -125]) {
      const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const rx = mx * c - mz * s, rz = mx * s + mz * c;
      if (!free(z.pos.x + rx * step, z.pos.z + rz * step)) continue;
      const dot = rx * mx + rz * mz;
      if (dot > bd) { bd = dot; best = { x: rx, z: rz }; }
    }
    return best;
  }
  canBite(z, t, dh, dy, reach) {
    if (!(dh < reach) || !(Math.abs(dy) < 1.25)) return false;
    const P = this.A.P;
    for (const h of [0.42, 0.9, 1.25]) {
      if (!P.losClear({ x: z.pos.x, y: z.pos.y + h * z.size, z: z.pos.z }, { x: t.pos.x, y: t.pos.y + Math.min(1.35, 0.4 + h * 0.45), z: t.pos.z })) return false;
    }
    return true;
  }
  afterMoveSurvival(z, blocked, dt, T, t) {
    const gd = t ? hyp(z.pos.x - t.pos.x, z.pos.z - t.pos.z) : 0;
    if (!z.trail || T - z.trail.at > 0.45) {
      if (z.trail) {
        const moved = hyp(z.pos.x - z.trail.x, z.pos.z - z.trail.z);
        const gained = z.trail.gd - gd;
        if (z.aiState === 'hold') z.stall = 0;
        else if (moved < 0.2 && gained < 0.12) z.stall = (z.stall || 0) + (T - z.trail.at);
        else z.stall = Math.max(0, (z.stall || 0) - 0.2);
        if ((z.stall || 0) > 1.05) { z.node = null; z.nodeAt = -9; z.stall = 0.4; }
      }
      z.trail = { x: z.pos.x, z: z.pos.z, gd, at: T };
    }
    z.stuck = z.stall || 0;
    const stepUp = z.node && z.node.y > z.pos.y + 0.48 && z.node.y < z.pos.y + 1.35;
    if (blocked && z.onGround && stepUp && T > (z.hopAt || 0)) { z.vel.y = 8.5; z.hopAt = T + 0.85; }
    if (this.fellOffMap(z)) this.killFallen(z);
    else if (this.A.P.overlapping && this.A.P.overlapping(z.pos.x, z.pos.y, z.pos.z)) this.A.P.depenetrate(z);
  }
  // Correção curta se o corpo caiu do mapa. Não teleporta até o jogador.
  recoverZombie(z) {
    const nav = this.A.nav;
    if (this.A.P.depenetrate) this.A.P.depenetrate(z);
    if (z.pos.y >= -1) { z.stuck = 0; return; }
    const n = nav && this.standNode(z.pos.x, Math.max(0, z.pos.y), z.pos.z);
    if (n && Math.hypot(n.x - z.pos.x, n.z - z.pos.z) <= 3) { z.pos.x = n.x; z.pos.y = n.y; z.pos.z = n.z; z.vel.x = z.vel.y = z.vel.z = 0; }
    z.stuck = 0; z.node = null;
  }
  survivalSpawn(custom) {
    if (!this.flow || this.T - this.flowAt > 0.45) this.buildFlow();
    const P = this.A.P, nav = this.A.nav;
    const boxes = (this.A.spawnAreas && this.A.spawnAreas()) || [];
    if (this._spawnGen !== this.flowGen) {
      this._spawnGen = this.flowGen;
      const pts = [], seen = new Set();
      const push = (x, y, z) => {
        if (Math.abs(x) > this.hx - 1.2 || Math.abs(z) > this.hz - 1.2) return;
        if (P && P.collides(x, y, z)) return;
        let node = null;
        if (nav) { node = this.standNode(x, y, z); if (!node) return; }
        const px = node ? node.x : x, py = node ? node.y : y, pz = node ? node.z : z;
        const key = (px * 2 | 0) + ',' + (pz * 2 | 0) + ',' + (py | 0);
        if (seen.has(key)) return; seen.add(key);
        if (P && P.collides(px, py, pz)) return;
        pts.push({ x: px, y: py, z: pz, id: node ? node.id : -1 });
      };
      for (const s of custom) push(s.x, s.y, s.z);
      if (nav && boxes.length) for (const n of nav.good) {
        if (n.id % 3) continue;
        let inside = false;
        for (const b of boxes) if (n.x >= b[0] && n.x <= b[2] && n.z >= b[1] && n.z <= b[3] && n.y >= (b[4] || 0) - 0.45 && n.y <= (b[5] || 4) + 0.35) { inside = true; break; }
        if (!inside || (P && P.collides(n.x, n.y, n.z))) continue;
        const key = (n.x * 2 | 0) + ',' + (n.z * 2 | 0) + ',' + (n.y | 0);
        if (seen.has(key)) continue; seen.add(key);
        pts.push({ x: n.x, y: n.y, z: n.z, id: n.id });
      }
      this._spawnPts = pts;
    }
    const pts = this._spawnPts || []; if (!pts.length) return null;
    const H = this.A.players().filter((p) => this.zombieWants(p));
    const linked = (id) => !!(this.flow && id >= 0 && this.flow.dist[id] < 1e8);
    const anyLink = pts.some((p) => linked(p.id));
    let best = null, bs = -1e9;
    const tries = Math.min(96, Math.max(28, pts.length));
    for (let i = 0; i < tries; i++) {
      const nd = pts[Math.floor(this.rnd() * pts.length)];
      if (anyLink && !linked(nd.id)) continue;
      let dp = 1e9; for (const p of H) dp = Math.min(dp, d3(nd, p.pos));
      if (H.length && dp < 3.2) continue;
      let seenBy = false;
      if (P && P.losClear && dp < 40) for (const p of H) {
        if (d3(nd, p.pos) < 40 && P.losClear({ x: p.pos.x, y: p.pos.y + 1.5, z: p.pos.z }, { x: nd.x, y: nd.y + 1.15, z: nd.z })) { seenBy = true; break; }
      }
      const far = dp >= INV.SPAWN_MIN ? 28 : dp >= 6 ? 12 : dp * 0.4;
      const s = far + this.rnd() * 6 - (seenBy ? 10 : 0) - Math.max(0, dp - 42) * 0.25;
      if (s > bs) { bs = s; best = nd; }
    }
    return best ? { x: best.x, y: best.y, z: best.z } : null;
  }
  separate() {
    const Z = this.zombies.filter((z) => z.alive);
    for (let i = 0; i < Z.length; i++) for (let j = i + 1; j < Z.length; j++) {
      const a = Z[i], b = Z[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = hyp(dx, dz), min = 0.55 * (a.size + b.size);
      if (d >= min || d < 1e-4 || Math.abs(a.pos.y - b.pos.y) > 1.5) continue;
      const push = (min - d) * 0.5, ux = dx / d, uz = dz / d, P = this.A.P;
      const tryMove = (e, sx, sz) => { const nx = e.pos.x + sx, nz = e.pos.z + sz; if (!P.collides(nx, e.pos.y, nz)) { e.pos.x = nx; e.pos.z = nz; } };
      tryMove(a, -ux * push, -uz * push); tryMove(b, ux * push, uz * push);
    }
  }
  // zumbi morreu (o host chama depois de tirar ele do jogo): drop de poder e explosão do Barrigão
  onZombieDeath(z, killer) {
    if (z.friendly) {
      z.alive = false; z.removeAt = this.T + 1.2;
      this.allyWait = this.allyWait || [];
      this.allyWait.push({ ownerId: z.ownerId, at: this.T + 10 });
      return;
    }
    z.alive = false; z.removeAt = this.T + INV.ZOMBIE_LINGER; this.kills++;
    if (z.zt === 'shape') this.cureBy(z.id);
    const st = zombieProfile(z);
    if (st && st.boom) {
      const c = { x: z.pos.x, y: z.pos.y + 1, z: z.pos.z }; this.A.emit(['zb', z.id, [r2(c.x), r2(c.y), r2(c.z)]]);
      for (const p of this.A.players()) {
        if (!p.alive || p.eggHideUntil > this.T) continue; const d = d3({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, c); if (d > st.boom.radius) continue;
        const k = 1 - d / st.boom.radius, hx = p.pos.x - c.x, hz = p.pos.z - c.z, L = hyp(hx, hz) || 1;
        this.A.knock(p, { x: hx / L * st.boom.knock * k, y: 5 * k, z: hz / L * st.boom.knock * k });
        this.A.hurtPlayer(p, st.boom.dmg * (0.3 + 0.7 * k) * (z.dmgMul || 1), z);
      }
    }
    if (z.zt === 'bossOclinhos' || z.zt === 'bossBig') this.vanishCrew(z.id);
    if (z.egg) { this.noteEggDeath(z); return; }
    if (z.id === this.bossId) { for (let i = 0; i < 2; i++) this.drop(z.pos, i === 0); this.dropAmmo(z.pos, 1.4); this.dropAmmo(z.pos, 1.4); if (!(this.egg && this.wave === 20)) this.offerHistoria(); return; }
    if (st && this.rnd() < st.drop) this.drop(z.pos, false);
    const ammoP = z.parts && z.parts.length ? Math.max(...z.parts.map((k) => INV_AMMO.zdrop[k] || 0)) : (INV_AMMO.zdrop[z.zt] || 0);
    if (this.rnd() < ammoP) this.dropAmmo(z.pos, 0.6);
  }
  dropAmmo(pos, off) { // caixa de munição (não ocupa slot de poder): quem precisa de munição e pisa ganha
    const a = this.rnd() * Math.PI * 2, x = clamp(pos.x + Math.cos(a) * off, -this.hx + 1, this.hx - 1), z = clamp(pos.z + Math.sin(a) * off, -this.hz + 1, this.hz - 1);
    const d = { id: this.nid++, kind: 'ammo', x, y: this.A.P.groundAt(x, z, pos.y + 0.5), z, born: this.T };
    this.drops.push(d); this.A.emit(['dp', d.id, DROP_KEYS.indexOf('ammo'), [r2(d.x), r2(d.y), r2(d.z)]]);
    return d;
  }
  drop(pos, bossBonus) {
    const H = this.A.players(), someoneOut = H.some((p) => p.out || !p.alive);
    const keys = POWER_KEYS.filter((k) => k !== 'revive' || (!this.hard && reviveAllowed(this.resCount, this.wave))); // Hardcore: a Ressurreição nunca cai
    const w = (k) => (k === 'revive' ? POWERS.revive.w * (someoneOut ? 5 : 1) * (bossBonus ? 3 : 1) : POWERS[k].w);
    const sum = keys.reduce((a, k) => a + w(k), 0); let r = this.rnd() * sum, kind = keys[0];
    for (const k of keys) { r -= w(k); if (r <= 0) { kind = k; break; } }
    if (kind === 'revive') noteRevive(this.resCount, this.wave);
    const a = this.rnd() * Math.PI * 2, off = bossBonus || this.drops.length ? 0.9 : 0;
    const x = clamp(pos.x + Math.cos(a) * off, -this.hx + 1, this.hx - 1), z = clamp(pos.z + Math.sin(a) * off, -this.hz + 1, this.hz - 1);
    const d = { id: this.nid++, kind, x, y: this.A.P.groundAt(x, z, pos.y + 0.5), z, born: this.T };
    this.drops.push(d); this.A.emit(['dp', d.id, POWER_KEYS.indexOf(kind), [r2(d.x), r2(d.y), r2(d.z)]]);
    return d;
  }
  stepDrops(T) {
    const R2 = INV.PICK_R * INV.PICK_R;
    this.drops = this.drops.filter((d) => {
      if (T - d.born > INV.DROP_LIFE) { this.A.emit(['dg', d.id, 0]); return false; }
      for (const p of this.A.players()) {
        if (!p.alive || (d.kind !== 'ammo' && p.inv.length >= INV.INV_MAX)) continue;
        const dx = p.pos.x - d.x, dz = p.pos.z - d.z; if (dx * dx + dz * dz > R2 || Math.abs(p.pos.y - d.y) > 1.6) continue;
        if (d.kind === 'ammo') { if (!this.A.giveAmmo(p)) continue; this.A.emit(['dg', d.id, p.id, DROP_KEYS.indexOf('ammo')]); return false; }
        p.inv.push(d.kind); this.A.emit(['dg', d.id, p.id, POWER_KEYS.indexOf(d.kind)]); this.A.invChanged(p); return false;
      }
      return true;
    });
  }
  // ---------- projéteis (cuspe, abóbora/mijo do chefão, abóbora do poder) ----------
  // Dois golpes. Sorteia na hora; se o escolhido não alcança, usa o outro. Recarga segura a mordida genérica.
  bossAttack(z, st, t, dh, dx, dz, dy, T, tune) {
    const moves = st.moves;
    if (!moves || moves.length < 2) return false;
    if (z.slingWind > T || z.slingFly > T) return true;
    if (T < (z.nextAtk || 0)) return true;
    const first = this.rnd() < 0.5 ? 0 : 1;
    for (const i of [first, 1 - first]) {
      if (!this.useMove(z, st, moves[i], t, dh, dx, dz, dy, T)) continue;
      z.nextAtk = T + this.moveEvery(st, moves[i], z) * tune.atkRate * (0.85 + this.rnd() * 0.3);
      z.atkMove = i;
      return true;
    }
    return false;
  }
  moveEvery(st, move, z) {
    let every = move.every;
    if (!(every > 0)) {
      if (move.kind === 'spit') every = st.spit && st.spit.every;
      else if (move.kind === 'howl') every = st.howlEvery;
      else if (move.kind === 'charge') every = (move.sling || st.sling || {}).cd;
    }
    if (!(every > 0)) every = st.rate || 1;
    if (z.surge && move.kind === 'howl') every *= 0.42;
    return every;
  }
  useMove(z, st, move, t, dh, dx, dz, dy, T) {
    const kind = move.kind;
    if (kind === 'spit') {
      const S = move.spit || st.spit;
      if (!S || !z.lastLos || dh > S.range || dh < (move.min || 0)) return false;
      const n = Math.max(1, S.volley | 0);
      for (let i = 0; i < n; i++) this.spit(z, t, i * 0.08, S);
      return true;
    }
    if (kind === 'howl') {
      const W = move.howl || st.howl;
      if (!W || dh > W.radius || Math.abs(dy) > 3.2) return false;
      this.bossHowl(z, W, move.style | 0);
      return true;
    }
    if (kind === 'slam' || kind === 'spin') {
      if (dh > (move.range || 6) || Math.abs(dy) > 2.2) return false;
      if (kind === 'spin' && move.step > 0 && dh > 2.2) this.stepBoss(z, dx, dz, dh, Math.min(move.step, Math.max(0, dh - 1.3)));
      this.bossNova(z, move);
      return true;
    }
    if (kind === 'grab') {
      if (dh > (move.range || st.reach) || Math.abs(dy) > 2) return false;
      this.A.emit(['za', z.id]);
      this.A.hurtPlayer(t, (move.dmg || st.dmg) * (z.dmgMul || 1), z);
      if (move.stun) t.stunUntil = Math.max(t.stunUntil || 0, T + move.stun);
      return true;
    }
    if (kind === 'blink') {
      if (!z.lastLos || dh > (move.range || 14) || dh < (move.min || 2) || Math.abs(dy) > 3) return false;
      return this.blinkBoss(z, t, dx, dz, dh, move, T);
    }
    if (kind === 'charge') {
      const sling = move.sling || st.sling;
      if (!sling || !z.lastLos || dh > sling.range || dh < (move.min || 1.6) || Math.abs(dy) > 2.4) return false;
      z.slingSpec = sling;
      z.slingHit = move.dmg || st.dmg;
      z.slingStun = move.stun || 0;
      z.slingWind = T + sling.wind;
      z.slingArm = { x: dx / dh, z: dz / dh, dist: Math.min(Math.max(dh - 1.05, 0.8), sling.max) };
      return true;
    }
    return false;
  }
  stepBoss(z, dx, dz, dh, dist) {
    if (!(dist > 0)) return;
    const P = this.A.P, nx = z.pos.x + (dx / dh) * dist, nz = z.pos.z + (dz / dh) * dist;
    if (P && P.collides && P.collides(nx, z.pos.y, nz)) return;
    z.pos.x = nx; z.pos.z = nz;
  }
  blinkBoss(z, t, dx, dz, dh, move, T) {
    const P = this.A.P;
    const dist = Math.min(move.dist || 7, Math.max(0, dh - 1.15));
    if (dist < 0.8) return false;
    let nx = z.pos.x + (dx / dh) * dist, nz = z.pos.z + (dz / dh) * dist;
    const ny = P && P.groundAt ? P.groundAt(nx, nz, t.pos.y + 0.5) : z.pos.y;
    if (P && P.collides && P.collides(nx, ny, nz)) {
      const half = dist * 0.5;
      nx = z.pos.x + (dx / dh) * half; nz = z.pos.z + (dz / dh) * half;
      if (P.collides(nx, ny, nz)) return false;
    }
    z.pos.x = nx; z.pos.y = ny; z.pos.z = nz;
    z.vel.x = z.vel.z = z.vel.y = 0;
    if (move.phase) {
      z.phaseUntil = Math.max(z.phaseUntil || 0, T + move.phase);
      z.phased = true;
      this.A.emit(['zf', z.id, 1]);
    }
    this.A.emit(['za', z.id]);
    if (hyp(t.pos.x - nx, t.pos.z - nz) < (move.hit || 2.4)) this.A.hurtPlayer(t, (move.dmg || 24) * (z.dmgMul || 1), z);
    return true;
  }
  bossNova(z, move) {
    const c = { x: z.pos.x, y: z.pos.y + 0.35 * (z.size || 1), z: z.pos.z };
    const radius = move.radius || 4, style = move.style | 0;
    this.A.emit(['za', z.id]);
    this.A.emit(['zh', z.id, [r2(c.x), r2(c.y), r2(c.z)], r2(radius), style]);
    for (const p of this.A.players()) {
      if (!p.alive) continue;
      const d = d3({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, c);
      if (d > radius) continue;
      const k = 1 - d / radius;
      this.A.hurtPlayer(p, (move.dmg || 20) * (0.45 + 0.55 * k) * (z.dmgMul || 1), z);
      const slow = move.slow || move.stun;
      if (slow) p.stunUntil = Math.max(p.stunUntil || 0, this.T + slow * (0.55 + 0.45 * k));
      if (move.knock && this.A.knock) {
        const hx = p.pos.x - c.x, hz = p.pos.z - c.z, L = hyp(hx, hz) || 1;
        this.A.knock(p, { x: (hx / L) * move.knock * k, y: 3.2 * k, z: (hz / L) * move.knock * k });
      }
    }
  }
  spit(z, t, delay = 0, spec = null) {
    const S = spec || (zombieProfile(z) || {}).spit; if (!S) return;
    const o = { x: z.pos.x + Math.sin(z.yaw) * 0.5 * z.size, y: z.pos.y + 1.45 * z.size, z: z.pos.z + Math.cos(z.yaw) * 0.5 * z.size };
    const tune = zombieTune(this.A.botDiff), lead = tune.spitLead + delay, err = tune.spitErr + (delay ? 0.6 : 0);
    const to = { x: t.pos.x + (t.vel ? t.vel.x : 0) * lead + (this.rnd() - 0.5) * 2 * err, y: t.pos.y + 0.9, z: t.pos.z + (t.vel ? t.vel.z : 0) * lead + (this.rnd() - 0.5) * 2 * err };
    const dx = to.x - o.x, dz = to.z - o.z, dh = hyp(dx, dz), T = Math.max(0.35, dh / S.speed);
    const v = { x: dx / T, y: (to.y - o.y + 0.5 * SPIT_GRAV * T * T) / T, z: dz / T };
    const style = S.style != null ? S.style : (S.pee ? 2 : S.big ? 1 : 0);
    const pr = { id: this.nid++, kind: S.pee ? 'pee' : S.big ? 'boss' : 'spit', owner: z, pos: o, vel: v, born: this.T, S, style, grav: S.grav, life: S.life, home: S.home && t ? t.id : 0 };
    this.projs.push(pr); this.A.emit(['zs', pr.id, style, [r2(o.x), r2(o.y), r2(o.z)], [r2(v.x), r2(v.y), r2(v.z)]]);
  }
  bossHowl(z, W = null, style = 0) {
    W = W || ZOMBIES[z.zt].howl; if (!W) return;
    const c = { x: z.pos.x, y: z.pos.y + 1.2 * z.size, z: z.pos.z };
    this.A.emit(['zh', z.id, [r2(c.x), r2(c.y), r2(c.z)], r2(W.radius), style | 0]);
    for (const p of this.A.players()) {
      if (!p.alive) continue; const d = d3({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, c); if (d > W.radius) continue;
      p.stunUntil = Math.max(p.stunUntil || 0, this.T + W.stun * (1 - d / W.radius * 0.35));
      this.A.hurtPlayer(p, W.dmg * (0.4 + 0.6 * (1 - d / W.radius)) * (z.dmgMul || 1), z);
    }
  }
  stepProjs(dt, T) {
    const P = this.A.P;
    this.projs = this.projs.filter((pr) => {
      if (pr.kind === 'cough') {
        const n = 3; let boom = false;
        for (let i = 0; i < n && !boom; i++) {
          const h = dt / n;
          pr.vel.y -= SPIT_GRAV * 0.35 * h;
          pr.pos.x += pr.vel.x * h; pr.pos.y += pr.vel.y * h; pr.pos.z += pr.vel.z * h;
          if (T - pr.born > 2.4 || pr.pos.y <= P.groundAt(pr.pos.x, pr.pos.z, pr.pos.y + 0.4) + 0.08 || P.nadeBlocked(pr.pos.x, pr.pos.y, pr.pos.z)) boom = true;
          for (const z of this.zombies) if (z.alive && d3({ x: z.pos.x, y: z.pos.y + z.size, z: z.pos.z }, pr.pos) < 0.7 * z.size + 0.35) boom = true;
        }
        if (!boom) return true;
        this.coughBlast(pr); return false;
      }
      if (pr.kind === 'pumpkin') {
        for (let s = 0; s < 2; s++) P.stepNade(pr.pos, pr.vel, dt / 2);
        let hit = T - pr.born >= POWERS.pumpkin.fuse;
        if (!hit && T - pr.born > 0.15) for (const z of this.zombies) if (z.alive && d3({ x: z.pos.x, y: z.pos.y + 1 * z.size, z: z.pos.z }, pr.pos) < 1.0 * z.size + 0.3) { hit = true; break; }
        if (hit) { this.pumpkinBlast(pr); return false; }
        return true;
      }
      const n = 3; let boom = null;
      for (let i = 0; i < n && !boom; i++) {
        const h = dt / n;
        if (pr.home) this.homeProj(pr);
        pr.vel.y -= SPIT_GRAV * (pr.grav == null ? 1 : pr.grav) * h; pr.pos.x += pr.vel.x * h; pr.pos.y += pr.vel.y * h; pr.pos.z += pr.vel.z * h;
        if (T - pr.born > (pr.life || 4) || pr.pos.y <= P.groundAt(pr.pos.x, pr.pos.z, pr.pos.y + 0.3) + 0.05 || P.nadeBlocked(pr.pos.x, pr.pos.y, pr.pos.z)) boom = true;
        if (!boom && this.A.story && this.A.story()) {
          for (const p of this.A.players()) if (p && p.alive && plateBlocks(p, pr.pos, T)) { boom = 'plate'; break; }
        }
        for (const p of this.A.players()) {
          if (boom === 'plate' || !p.alive || d3({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, pr.pos) >= 0.9) continue;
          if (!pr.back && p.hReflectUntil > T) {
            const src = pr.owner && pr.owner.pos;
            if (src) {
              const dx = src.x - pr.pos.x, dy = (src.y + 1.1) - pr.pos.y, dz = src.z - pr.pos.z, L = Math.hypot(dx, dy, dz) || 1;
              const sp = Math.max(10, Math.hypot(pr.vel.x, pr.vel.y, pr.vel.z));
              pr.vel.x = dx / L * sp; pr.vel.y = dy / L * sp; pr.vel.z = dz / L * sp;
            } else { pr.vel.x *= -1; pr.vel.y *= -1; pr.vel.z *= -1; }
            pr.back = p.id; boom = null; break;
          }
          if (pr.back === p.id) continue;
          boom = true;
        }
      }
      if (!boom) return true;
      if (boom === 'plate') { this.A.emit(['zx', pr.id, [r2(pr.pos.x), r2(pr.pos.y), r2(pr.pos.z)], 0]); this.A.emit(['hbk', pr.id]); return false; }
      const S = pr.S, c = pr.pos, style = pr.style != null ? pr.style : (S.pee ? 2 : S.big ? 1 : 0);
      this.A.emit(['zx', pr.id, [r2(c.x), r2(c.y), r2(c.z)], style]);
      if (pr.back) {
        for (const z of this.zombies) {
          if (!z.alive) continue;
          const d = d3({ x: z.pos.x, y: z.pos.y + z.size, z: z.pos.z }, c); if (d > S.radius) continue;
          this.A.hurtZombie(z, S.dmg * (0.45 + 0.55 * (1 - d / S.radius)), pr.owner, 'integra');
        }
        return false;
      }
      for (const p of this.A.players()) {
        if (!p.alive) continue; const d = d3({ x: p.pos.x, y: p.pos.y + 0.9, z: p.pos.z }, c); if (d > S.radius) continue;
        this.A.hurtPlayer(p, S.dmg * (0.45 + 0.55 * (1 - d / S.radius)) * (pr.owner.dmgMul || 1), pr.owner);
        if (S.pee || S.wrap) p.stunUntil = Math.max(p.stunUntil || 0, T + (S.slow || S.stun || 1.2) * (0.55 + 0.45 * (1 - d / S.radius)));
      }
      return false;
    });
  }
  pumpkinBlast(pr) {
    const W = POWERS.pumpkin, c = pr.pos; this.A.emit(['pb', pr.id, [r2(c.x), r2(c.y), r2(c.z)]]);
    for (const z of this.zombies) {
      if (!z.alive) continue; const d = d3({ x: z.pos.x, y: z.pos.y + z.size, z: z.pos.z }, c) - 0.4 * z.size; if (d > W.radius) continue;
      const k = 1 - clamp(d, 0, W.radius) / W.radius, hx = z.pos.x - c.x, hz = z.pos.z - c.z, L = hyp(hx, hz) || 1;
      if (!isBoss(z.zt)) this.A.knock(z, { x: hx / L * W.knock * k, y: 6 * k, z: hz / L * W.knock * k });
      this.A.hurtZombie(z, W.dmg * (0.25 + 0.75 * k), pr.owner, 'pumpkin');
    }
  }
  coughBlast(pr) {
    const c = pr.pos, R = pr.radius || 3.8;
    this.A.emit(['zx', pr.id, [r2(c.x), r2(c.y), r2(c.z)], 3]);
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const d = d3({ x: z.pos.x, y: z.pos.y + z.size, z: z.pos.z }, c); if (d > R) continue;
      const k = 1 - d / R, hx = z.pos.x - c.x, hz = z.pos.z - c.z, L = hyp(hx, hz) || 1;
      if (!isBoss(z.zt)) this.A.knock(z, { x: hx / L * 5 * k, y: 3 * k, z: hz / L * 5 * k });
      this.A.hurtZombie(z, (pr.dmg || 95) * (0.45 + 0.55 * k), pr.owner, 'tosse');
    }
  }
  // Modo história: na morte do chefão, cada jogador recebe 3 upgrades diferentes dos que já tem.
  offerHistoria() {
    if (!this.A.story || !this.A.story()) return 0;
    const taken = new Set(); let n = 0;
    for (const p of this.A.players()) {
      if (!p || p.bot || p.zt) continue;
      const offer = rollOffer(p.hUps, this.rnd, taken);
      if (!offer.length) continue;
      taken.add(offer.slice().sort().join(','));
      const shown = enqueueHistoria(p, offer);
      if (shown) this.A.emit(['hoffer', p.id, ...shown.ids]);
      n++;
    }
    return n;
  }
  // Wave sem chefão: 3 passivas. A mesma pode voltar até o ouro.
  offerPassivas() {
    if (!this.A.story || !this.A.story()) return 0;
    const taken = new Set(); let n = 0;
    for (const p of this.A.players()) {
      if (!p || p.bot || p.zt) continue;
      const offer = rollPass(p.hPass, this.rnd, taken);
      if (!offer.length) continue;
      taken.add(offer.slice().sort().join(','));
      const shown = enqueueHistoria(p, { k: 'pass', ids: offer });
      if (shown) this.A.emit(['hpoffer', p.id, ...shown.ids]);
      n++;
    }
    return n;
  }
  showNextHistoria(p) {
    const nxt = nextHistoria(p);
    if (nxt) this.A.emit([nxt.k === 'pass' ? 'hpoffer' : 'hoffer', p.id, ...nxt.ids]);
  }
  pickHistoria(p, id) {
    if (!this.A.story || !this.A.story() || !takeOffer(p, id)) return false;
    this.A.emit(['hgot', p.id, id]);
    this.showNextHistoria(p);
    return true;
  }
  pickPassiva(p, id) {
    if (!this.A.story || !this.A.story()) return false;
    const lv = takePass(p, id);
    if (!lv) return false;
    if (id === 'porcao') {
      const prev = p.hpCap > 100 ? p.hpCap : 100;
      p.hpCap = passHp(lv);
      p.hp = Math.min(p.hpCap, (p.hp || 0) + (p.hpCap - prev));
    }
    this.A.emit(['hpgot', p.id, id, lv, Math.round(p.hp || 0), p.hpCap | 0]);
    this.showNextHistoria(p);
    return true;
  }
  stepPassives(dt, T) {
    if (!this.A.story || !this.A.story()) return;
    this.embers = (this.embers || []).filter((em) => em.until > T);
    for (const p of this.A.players()) {
      if (!p || !p.alive || p.down || p.bot) continue;
      const lv = passLv(p, 'brasa');
      const st = brasaStats(lv);
      if (!st || !p.pos) continue;
      const x = p.pos.x, z = p.pos.z;
      if (p._brx == null || Math.hypot(x - p._brx, z - p._brz) >= st.step) {
        p._brx = x; p._brz = z;
        const y = p.pos.y || 0;
        this.embers.push({ x, y, z, until: T + st.life, r: st.r, dps: st.dps, owner: p });
        this.A.emit(['hem', r2(x), r2(z), r2(y), r2(st.r), r2(st.life)]);
      }
    }
    for (const em of this.embers) {
      for (const z of this.zombies) {
        if (!z.alive) continue;
        if (hyp(z.pos.x - em.x, z.pos.z - em.z) > em.r) continue;
        if (Math.abs((z.pos.y || 0) - em.y) > 2.4) continue;
        this.A.hurtZombie(z, em.dps * dt * (isBoss(z.zt) ? 0.5 : 1), em.owner, 'brasa');
      }
    }
  }
  useHistoria(p, id, extra = {}) {
    if (ULTS[id]) return this.useUltimate(p, id);
    if (!this.A.story || !this.A.story() || !hReady(p, id, this.T)) return null;
    const u = HUPS[id], T = this.T, A = this.A;
    if (id === 'grok') {
      const spot = historiaSpot(A.P, [this.hx, this.hz], extra.x, extra.z);
      if (!spot) { if (A.deny) A.deny(p, 'O PC do Grok não achou chão aí'); return null; }
      p.pos.x = spot.x; p.pos.y = spot.y; p.pos.z = spot.z;
      if (p.vel) { p.vel.x = 0; p.vel.y = 0; p.vel.z = 0; }
      p.onGround = true;
    }
    if (!p.hCd) p.hCd = {};
    p.hCd[id] = T + u.cd;
    p.hAnim = id; p.hAnimUntil = T + u.anim;
    if (id === 'monster') p.hSpeedUntil = T + u.dur;
    else if (id === 'torta') { A.heal(p, 50); p.hShield = 50; p.hShieldUntil = T + u.dur; }
    else if (id === 'tosse') this.spitCough(p, extra);
    else if (id === 'barriga') {
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const d = hyp(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
        if (d > 8 || Math.abs(z.pos.y - p.pos.y) > 3.2) continue;
        z.stunUntil = Math.max(z.stunUntil || 0, T + 3);
        if (z.vel) { z.vel.x = 0; z.vel.z = 0; }
      }
    } else if (id === 'bencao') {
      for (const q of A.players()) {
        if (!q || !q.alive || q.down) continue;
        const d = hyp(q.pos.x - p.pos.x, q.pos.z - p.pos.z);
        if (q !== p && (d > 8 || Math.abs((q.pos.y || 0) - p.pos.y) > 3.2)) continue;
        q.hDmgUntil = T + u.dur;
        if (q !== p) A.emit(['hbuff', q.id, 'dmg']);
      }
    } else if (id === 'cachaca') p.hImmuneUntil = T + u.dur;
    else if (id === 'grokbot') p.hAimUntil = T + u.dur;
    else if (id === 'integra') p.hReflectUntil = T + u.dur;
    else if (id === 'cheers') {
      const c = { x: p.pos.x, y: p.pos.y + 1, z: p.pos.z };
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const d = d3({ x: z.pos.x, y: z.pos.y + z.size, z: z.pos.z }, c); if (d > 8.5) continue;
        const k = 1 - d / 8.5, hx = z.pos.x - c.x, hz = z.pos.z - c.z, L = hyp(hx, hz) || 1;
        if (!isBoss(z.zt)) A.knock(z, { x: hx / L * 9 * k, y: 5 * k, z: hz / L * 9 * k });
        A.hurtZombie(z, 1800 * (0.55 + 0.45 * k), p, 'cheers');
      }
      p.hp = 1; p.hShield = 0; p.hShieldUntil = 0; p.hRootUntil = T + 3;
    } else if (id === 'joelhos') {
      if (p.vel) p.vel.y = 20;
      p.onGround = false; p.hHopUntil = T + 0.75;
    } else if (id === 'cafe') {
      const yaw = p.yaw || 0;
      if (p.vel) { p.vel.x += -Math.sin(yaw) * 13; p.vel.z += -Math.cos(yaw) * 13; }
      p.hDashUntil = T + 0.4;
    }
    A.emit(['hcast', p.id, id, Math.round(p.hp), Math.round(p.hShield || 0)]);
    return id;
  }
  spitCough(p, extra) {
    let dx = +extra.dx || 0, dy = +extra.dy || 0, dz = +extra.dz || 0, L = Math.hypot(dx, dy, dz);
    if (!(L > 0.2)) { const a = this.A.aimOf(p); dx = a.d.x; dy = a.d.y; dz = a.d.z; L = Math.hypot(dx, dy, dz) || 1; }
    const sp = 18, o = { x: p.pos.x + dx / L * 0.6, y: p.pos.y + 1.45, z: p.pos.z + dz / L * 0.6 };
    const v = { x: dx / L * sp, y: dy / L * sp + 1.5, z: dz / L * sp };
    const pr = { id: this.nid++, kind: 'cough', owner: p, pos: o, vel: v, born: this.T, dmg: 95, radius: 3.8 };
    this.projs.push(pr);
    this.A.emit(['zs', pr.id, 3, [r2(o.x), r2(o.y), r2(o.z)], [r2(v.x), r2(v.y), r2(v.z)]]);
  }
  // ---------- poderes ----------
  // usa o poder do slot (o cliente manda olho+direção; o host já validou). Devolve o tipo usado ou null.
  usePower(p, slot, aim) {
    if (!p.alive || this.phase === 'over' || !p.inv || !p.inv.length) return null;
    slot = clamp(slot | 0, 0, p.inv.length - 1); const kind = p.inv[slot];
    if (kind === 'revive' && this.hard) { p.inv.splice(slot, 1); this.A.invChanged(p); return null; } // Hardcore: não existe (some do inventário)
    const at = { x: p.pos.x, y: p.pos.y, z: p.pos.z }, A = this.A, T = this.T;
    const a = aim && aim.o && aim.d ? aim : A.aimOf(p);
    if (kind === 'revive' && !A.players().some((q) => !q.alive && q !== p)) return null; // ninguém pra reviver: guarda
    p.inv.splice(slot, 1); A.invChanged(p);
    const dir = a.d, ev = ['pw', POWER_KEYS.indexOf(kind), p.id, [r2(at.x), r2(at.y), r2(at.z)], [r2(dir.x), r2(dir.y), r2(dir.z)]];
    if (kind === 'pumpkin') {
      const W = POWERS.pumpkin, o = { x: a.o.x + dir.x * 0.6, y: a.o.y + dir.y * 0.6, z: a.o.z + dir.z * 0.6 };
      const v = { x: dir.x * W.speed, y: dir.y * W.speed + 4, z: dir.z * W.speed };
      const pr = { id: this.nid++, kind: 'pumpkin', owner: p, pos: o, vel: v, born: T }; this.projs.push(pr);
      ev.push(pr.id, [r2(o.x), r2(o.y), r2(o.z)], [r2(v.x), r2(v.y), r2(v.z)]);
    } else if (kind === 'howl') {
      const W = POWERS.howl;
      for (const z of this.zombies) {
        if (!z.alive) continue; const dx = z.pos.x - at.x, dz = z.pos.z - at.z, d = hyp(dx, dz); if (d > W.radius || Math.abs(z.pos.y - at.y) > 4) continue;
        const k = 1 - d / W.radius, L = d || 1; z.stunUntil = T + W.stun * (isBoss(z.zt) ? 0.4 : 1);
        if (!isBoss(z.zt)) A.knock(z, { x: dx / L * W.knock * (0.4 + 0.6 * k), y: 5, z: dz / L * W.knock * (0.4 + 0.6 * k) });
        A.hurtZombie(z, W.dmg, p, 'howl');
      }
    } else if (kind === 'potion') {
      const W = POWERS.potion;
      for (const q of A.players()) if (q.alive && d3(q.pos, at) <= W.radius) A.heal(q, W.heal);
    } else if (kind === 'lantern') {
      this.lanterns = this.lanterns.filter((l) => l.owner !== p); this.lanterns.push({ owner: p, until: T + POWERS.lantern.dur });
    } else if (kind === 'ghost') {
      p.ghostUntil = T + POWERS.ghost.dur; for (const z of this.zombies) if (z.target === p) z.target = null;
    } else if (kind === 'revive') {
      let n = 0; for (const q of A.players()) if (!q.alive && q !== p) { q.out = false; q.lives = Math.max(1, q.lives || 0); A.revive(q, at); n++; }
      ev.push(n);
    }
    A.emit(ev); return kind;
  }
  stepLanterns(dt, T) {
    if (!this.lanterns.length) return; const W = POWERS.lantern, P = this.A.P;
    this.lanterns = this.lanterns.filter((l) => {
      const p = l.owner; if (T >= l.until || !p.alive) return false;
      const a = this.A.aimOf(p), hd = hyp(a.d.x, a.d.z) || 1, fx = a.d.x / hd, fz = a.d.z / hd;
      for (const z of this.zombies) {
        if (!z.alive) continue; const c = { x: z.pos.x, y: z.pos.y + z.size, z: z.pos.z }, dx = c.x - a.o.x, dz = c.z - a.o.z, d = hyp(dx, dz);
        if (d > W.range || d < 0.01) continue;
        if ((dx / d) * fx + (dz / d) * fz < Math.cos(W.cone)) continue;
        if (!P.losClear(a.o, c)) continue;
        this.A.hurtZombie(z, W.dps * dt * (isBoss(z.zt) ? 0.5 : 1), p, 'lantern');
      }
      return true;
    });
  }
  // ---------- jogadores ----------
  // morreu: gasta uma vida. Devolve true se ainda renasce.
  onPlayerDeath(p) {
    this.ensure(p); p.lives = Math.max(0, p.lives - 1); p.ghostUntil = 0;
    p.ultForm = ''; p.ultUntil = 0; p.fly = false; p.hPhaseUntil = 0;
    this.lanterns = this.lanterns.filter((l) => l.owner !== p);
    if (p.lives <= 0) { p.out = true; this.placeCross(p); return false; }
    return true;
  }
  // ---------- cruz (Normal) ----------
  placeCross(p) {
    if (!this.crossOn || this.phase === 'over' || !p || !p.pos) return null;
    this.crosses = this.crosses.filter((c) => c.p !== p);
    const x = p.pos.x, z = p.pos.z, P = this.A.P, y = P && P.groundAt ? P.groundAt(x, z, p.pos.y + 0.5) : p.pos.y;
    const c = { p, x, y: Number.isFinite(y) ? y : p.pos.y, z, by: 0, prog: 0 };
    this.crosses.push(c); return c;
  }
  // aliado de pé, perto da cruz e segurando E (useHold). Dano no meio (graveBroke) exige soltar e segurar de novo.
  canRevive(q, c) {
    return !!(q && q !== c.p && q.alive && !q.down && !q.zt && q.useHold && !q.graveBroke && hyp(q.pos.x - c.x, q.pos.z - c.z) <= INV_CROSS.range && Math.abs(q.pos.y - c.y) <= INV_CROSS.reachY);
  }
  stepCrosses(dt) {
    const H = this.A.players(), busy = new Set();
    for (const q of H) { q.digLock = false; if (q.graveBroke && !q.useHold) q.graveBroke = false; }
    if (!this.crosses.length) return;
    if (this.phase === 'over' || !this.crossOn) { this.crosses = []; return; }
    this.crosses = this.crosses.filter((c) => {
      const p = c.p;
      if (!H.includes(p) || p.alive || !p.out) return false; // Ressurreição, saiu da sala ou já voltou
      let r = c.by ? H.find((q) => q.id === c.by) : null;
      if (r && r._digHp != null && r.hp + 0.05 < r._digHp) { c.by = 0; c.prog = 0; r.graveBroke = true; r._digHp = r.hp; r = null; } // dano no meio: zera e precisa soltar E
      if (!this.canRevive(r, c) || busy.has(r)) r = null;
      if (!r) { let bd = 1e9; for (const q of H) { if (busy.has(q) || !this.canRevive(q, c)) continue; const d = hyp(q.pos.x - c.x, q.pos.z - c.z); if (d < bd) { bd = d; r = q; } } }
      if (!r) { c.by = 0; c.prog = 0; return true; } // soltou, morreu, tomou dano ou saiu de perto: zera
      if (r.id !== c.by) { c.by = r.id; c.prog = 0; }
      busy.add(r); c.prog += dt; r._digHp = r.hp; r.digLock = true;
      const dig = INV_CROSS.hold * (this.A.story && this.A.story() ? coveiroScale(r) : 1);
      if (c.prog < dig) return true;
      p.out = false; p.lives = 0; // volta sem vida extra: morreu de novo, cruz de novo
      this.A.revive(p, { x: c.x, y: c.y, z: c.z }, { exact: true, hp: INV_CROSS.hp });
      this.A.emit(['cxr', p.id, r.id]);
      r.digLock = false; r._digHp = null;
      return false;
    });
  }
  // onde renascer: perto de um aliado vivo e dentro da área segura
  spawnPoint(p, near = null) {
    const nav = this.A.nav, good = (nav && nav.good) || [], F = this.fog;
    const mates = this.A.players().filter((q) => q !== p && q.alive);
    const anchor = near || (mates.length ? mates[Math.floor(this.rnd() * mates.length)].pos : { x: F.cx, y: 0, z: F.cz });
    let best = null, bs = -1e9;
    for (let i = 0; i < 80 && good.length; i++) {
      const nd = good[Math.floor(this.rnd() * good.length)]; if (!this.inSafe(nd, { ...F, r: F.r * 0.85 })) continue;
      let dz = 1e9; for (const z of this.zombies) if (z.alive) dz = Math.min(dz, d3(z.pos, nd));
      const da = d3(nd, anchor), s = -Math.abs(da - 4) - (dz < 10 ? 30 : 0) + this.rnd() * 2;
      if (s > bs) { bs = s; best = nd; }
    }
    return best ? { x: best.x, y: best.y, z: best.z } : null;
  }
  // ---------- capítulos secretos (só Modo história) ----------
  eggSay(text) { this.A.emit(['qe', 'msg', text]); }
  openEggWave() {
    const book = this.egg; if (!book) return;
    if (this.wave === book.sodaWave && !book.sodaOut && this.wave <= 20) {
      book.sodaOut = true;
      const at = this.spawnPos() || { x: -8, y: 0, z: 16 };
      this.spawnEgg('refri', at);
    }
    for (const p of this.A.players()) if (p && p.eggShockNext) {
      p.eggShockNext = false; p.eggShock = true;
      this.A.emit(['qe', 'shock', p.id]);
    }
    if (this.wave >= 20 && !book.fireOn) { book.fireOn = true; this.A.emit(['qe', 'fire']); }
  }
  closeEggWave() {
    const book = this.egg;
    let waiting = false;
    for (const p of this.A.players()) {
      if (!p) continue;
      if (p.eggShock || p.eggShockNext) waiting = true;
      if (p.eggShock) { book.steps.muro = true; p.eggShock = false; }
      if (p.eggBoost === this.wave) {
        const base = p._hpCap0 > 100 ? p._hpCap0 : 100;
        p.hpCap = p._hpCap0 || 0; p.eggBoost = 0;
        p.hp = Math.min(p.hp || 0, base);
        this.A.emit(['qe', 'hp', p.id, Math.round(p.hp), p.hpCap | 0]);
      }
    }
    const was = book.secret;
    const out = eggAfterWave(book, this.wave, waiting && !book.steps.muro);
    if (!was && book.secret) this.eggSay('Os capítulos secretos da HOTMILK estão abertos.');
    if (out.cap !== book.told) { book.told = out.cap; if (out.cap !== 20) this.A.emit(['qe', 'cap', out.cap]); }
    return out;
  }
  spawnEgg(kind, at) {
    const type = kind === 'cria' ? 'tank' : 'walker';
    this._noMutant = true;
    const z = this.spawn(type, at);
    this._noMutant = false;
    if (!z) return null;
    z.egg = kind;
    if (kind === 'cria') { z.hp = z.maxHp = Math.round(420 * ((this.spec && this.spec.hpMul) || 1)); z.size = 0.88; z.name = 'Cria do Barriguinha'; }
    else if (kind === 'lanche') { z.hp = z.maxHp = 640; z.spd = 0; z.size = 1.05; z.name = 'Lancheiro da Tarde'; }
    else { z.hp = z.maxHp = Math.round(900 * ((this.spec && this.spec.hpMul) || 1)); z.size = 1.35; z.spd = 2.2; z.name = 'Promo do Refri'; }
    this.A.emit(['qe', 'z', z.id, kind, z.name, Math.round(z.hp), r2(z.size || 1)]);
    return z;
  }
  summonCria(p) {
    const book = this.egg; if (!book || book.steps.cria || book.criaLeft > 0 || !p || !p.pos) return;
    let n = 0;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const z = this.spawnEgg('cria', { x: p.pos.x + Math.cos(a) * 2.1, y: p.pos.y || 0, z: p.pos.z + Math.sin(a) * 2.1 });
      if (z) n++;
    }
    if (!n) return;
    book.criaLeft = n; book.criaArmed = true;
  }
  summonLanche() {
    const book = this.egg; if (!book || book.steps.lanche || this.zombies.some((z) => z.alive && z.egg === 'lanche')) return;
    const spot = EGG_SPOTS.pool;
    this.eggSay('É hora do lanchinho da tarde');
    this.spawnEgg('lanche', { x: spot.x + 2.1, y: spot.y, z: spot.z + 0.4 });
  }
  stepLanche(z) {
    const spot = EGG_SPOTS.pool;
    z.yaw = Math.atan2(z.pos.x - spot.x, z.pos.z - spot.z);
    z.vel.x = z.vel.y = z.vel.z = 0;
  }
  noteEggDeath(z) {
    const book = this.egg; if (!book || !z) return;
    if (z.egg === 'cria') {
      book.criaLeft = Math.max(0, (book.criaLeft | 0) - 1);
      if (book.criaArmed && book.criaLeft === 0 && !book.steps.cria) {
        book.steps.cria = true;
        this.A.emit(['qe', 'step', 'cria']);
        this.eggSay('Crias do barriguinha eliminadas, algo está estranho na hotmilk');
      }
    } else if (z.egg === 'lanche' && !book.steps.lanche) {
      book.steps.lanche = true;
      this.A.emit(['qe', 'step', 'lanche']);
    } else if (z.egg === 'refri' && !book.fridge) {
      book.fridge = true;
      this.A.emit(['qe', 'fridge']);
      this.eggSay('Finalmente a Promo Voltou');
    }
  }
  eggUse(p, id) {
    const book = this.egg; if (!book || !p || !p.alive || !p.pos || p.eggHideUntil > this.T) return false;
    if (id === 'pool') {
      if (book.steps.lanche || p.eggPoolUntil > this.T || !nearSpot(p.pos, EGG_SPOTS.pool, 2.3)) return false;
      p.eggPoolUntil = this.T + 2;
      this.A.emit(['qe', 'anim', p.id, 'pool']);
      return true;
    }
    if (id === 'fridge') {
      if (!book.fridge || book.drunk[p.id] || !nearSpot(p.pos, EGG_SPOTS.fridge, 1.8)) return false;
      book.drunk[p.id] = this.wave;
      book.steps.refri = true;
      if (!(p.eggBoost > 0)) p._hpCap0 = p.hpCap || 0;
      const base = p._hpCap0 > 100 ? p._hpCap0 : 100;
      p.eggBoost = this.wave; p.hpCap = base + 50;
      p.hp = Math.min(p.hpCap, (p.hp || 0) + 50);
      this.A.emit(['qe', 'boost', p.id, Math.round(p.hp), p.hpCap]);
      this.A.emit(['qe', 'step', 'refri']);
      return true;
    }
    const wall = EGG_SPOTS.walls.find((w) => w.id === id);
    if (wall && !book.muroTaken && !book.steps.muro && !p.eggShockNext && !p.eggJumpUntil && nearSpot(p.pos, wall, 1.8) && claimMuro(book)) {
      p.eggJumpUntil = this.T + 0.8;
      p.eggShockNext = true;
      this.A.emit(['qe', 'muro']);
      this.A.emit(['qe', 'anim', p.id, 'wall']);
      return true;
    }
    return false;
  }
  eggShock(p) {
    if (!this.egg || !p || !p.alive || !p.eggShock || p.eggShockAt > this.T) return false;
    p.eggShockAt = this.T + 1.15;
    this.A.emit(['qe', 'zap', p.id, r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)]);
    for (const z of this.zombies) {
      if (!z.alive || !z.pos) continue;
      const d = Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
      if (d > 6.5 || Math.abs((z.pos.y || 0) - (p.pos.y || 0)) > 2.4) continue;
      z.stunUntil = Math.max(z.stunUntil || 0, this.T + 1.1);
      this.A.hurtZombie(z, 55 * (0.55 + 0.45 * (1 - d / 6.5)), p, 'shock');
    }
    return true;
  }
  stepEggs(dt, T) {
    const book = this.egg; if (!book || this.phase === 'over') return;
    for (const p of this.A.players()) {
      if (!p || p.bot || p.zt) continue;
      if (p.alive && stepRitual(book, p, T) === 'summon') this.summonCria(p);
      if (p.eggPoolUntil && T >= p.eggPoolUntil) {
        p.eggPoolUntil = 0;
        if (nearSpot(p.pos, EGG_SPOTS.pool, 2.6)) {
          const n = notePool(book, p, this.wave || 1);
          this.A.emit(['qe', 'pool', p.id, n === 'snack' ? 3 : n]);
          if (n === 'snack') this.summonLanche();
        }
      }
      if (p.eggJumpUntil && T >= p.eggJumpUntil) {
        p.eggJumpUntil = 0; p.eggHideUntil = T + 10;
        this.eggSay(`O player ${p.name || 'Docão'} cansou de ficar trancado na hotmilk, liberdade!`);
        this.A.emit(['qe', 'hide', p.id, 10]);
      }
      if (p.eggHideUntil && T >= p.eggHideUntil && !p.eggSuit) {
        p.eggHideUntil = 0; p.eggSuit = true;
        this.A.emit(['qe', 'suit', p.id]);
      }
    }
    for (const z of this.zombies) {
      if (!z.alive || z.egg !== 'cria' || !z.pos) continue;
      const x = z.pos.x, zz = z.pos.z;
      if (z._px == null || Math.hypot(x - z._px, zz - z._pz) >= 0.9) {
        z._px = x; z._pz = zz;
        book.puddles.push({ x, z: zz, y: z.pos.y || 0, until: T + 5.5 });
        this.A.emit(['qe', 'pee', r2(x), r2(zz), r2(z.pos.y || 0)]);
      }
    }
    book.puddles = (book.puddles || []).filter((g) => g.until > T);
    for (const g of book.puddles) for (const p of this.A.players()) {
      if (!p || !p.alive || !p.pos || p.eggHideUntil > T) continue;
      if (Math.hypot(p.pos.x - g.x, p.pos.z - g.z) <= 1.15 && Math.abs((p.pos.y || 0) - g.y) < 1.4) this.A.hurtPlayer(p, 14 * dt, null);
    }
  }
  grantUltimates() {
    const taken = new Set();
    for (const p of this.A.players()) {
      if (!p || p.bot || p.zt || p.hUlt) continue;
      const id = rollUltimate(taken, this.rnd);
      taken.add(id);
      p.hUlt = id;
      p.hSel = id;
      this.A.emit(['qe', 'ult', p.id, id]);
      if (id === 'rei') this.ensureAlly(p);
    }
  }
  useUltimate(p, id) {
    const u = ULTS[id];
    if (!this.A.story || !this.A.story() || !u || !p || !p.alive || p.down) return null;
    if (p.hUlt !== id) return null;
    if (p.hRootUntil > this.T) return null;
    if (p.hCd && p.hCd[id] > this.T) return null;
    if (!p.hCd) p.hCd = {};
    p.hCd[id] = this.T + u.cd;
    p.hAnim = id; p.hAnimUntil = this.T + (u.anim || 0.6);
    const T = this.T;
    if (u.dur > 0) { p.ultForm = id; p.ultUntil = T + u.dur; }
    if (id === 'frenesi') this.A.emit(['qe', 'form', p.id, 'frenesi', u.dur]);
    else if (id === 'sinuca') this.cueSmash(p);
    else if (id === 'vendedor') { p.hImmuneUntil = T + u.dur; this.lureNear(p, u.dur); }
    else if (id === 'rei') { this.ensureAlly(p); const z = this.livingAlly(p); if (z) this.bossAlly(z, u.dur); }
    else if (id === 'vampiro') { p.fly = true; p.hHopUntil = T + u.dur; }
    else if (id === 'bebado') { p.hImmuneUntil = T + u.dur; p.hSpeedUntil = T + u.dur; p.ultAnchor = { x: p.pos.x, z: p.pos.z }; p.ultAng = 0; }
    else if (id === 'discipulo') this.dropPuddle(p, u.dur);
    else if (id === 'ceo') { p.hPhaseUntil = T + u.dur; p.ultForm = 'ceo'; p.ultUntil = T + u.dur; }
    this.A.emit(['hcast', p.id, id, Math.round(p.hp || 0), 0]);
    return id;
  }
  ultProtected(z) { return !z || z.friendly || isBoss(z.zt) || z.zt === 'bonezinho' || z.zt === 'corrupt'; }
  livingAlly(p) { return this.zombies.find((z) => z && z.alive && z.friendly && z.ownerId === p.id); }
  ensureAlly(p) {
    if (!p || this.livingAlly(p)) return;
    if ((this.allyWait || []).some((a) => a.ownerId === p.id)) return;
    const at = { x: p.pos.x + 1.6, y: p.pos.y || 0, z: p.pos.z + 0.4 };
    this._noMutant = true;
    const z = this.spawn('walker', at);
    this._noMutant = false;
    if (!z) return;
    z.friendly = true; z.egg = 'ally'; z.ownerId = p.id; z.name = 'Docão Amigo';
    z.hp = z.maxHp = 180; z.spd = 3.4;
    this.A.emit(['qe', 'z', z.id, 'ally', z.name, z.hp, z.size || 1]);
  }
  bossAlly(z, dur) {
    const kind = BOSS_TYPES[Math.floor(this.rnd() * BOSS_TYPES.length)];
    const st = ZOMBIES[kind] || ZOMBIES.walker;
    z.bossForm = kind; z.zt = kind; z.formUntil = this.T + dur;
    z.hp = z.maxHp = Math.max(220, Math.round(st.hp * 0.28));
    z.size = (st.size || 1.4) * 0.72; z.spd = 4.1;
    this.A.emit(['qe', 'ally', z.id, kind, r2(z.size)]);
  }
  calmAlly(z) {
    z.bossForm = ''; z.formUntil = 0; z.zt = 'walker'; z.size = 1; z.spd = 3.4;
    z.hp = Math.min(z.hp || 180, 180); z.maxHp = 180;
    this.A.emit(['qe', 'ally', z.id, 'walker', 1]);
  }
  stepAlly(z, dt, T) {
    if (z.bossForm && z.formUntil && T >= z.formUntil) this.calmAlly(z);
    const owner = this.A.players().find((p) => p && p.id === z.ownerId);
    let foe = null, bd = 16;
    for (const o of this.zombies) {
      if (!o.alive || o === z || o.friendly) continue;
      const d = hyp(o.pos.x - z.pos.x, o.pos.z - z.pos.z);
      if (d < bd) { bd = d; foe = o; }
    }
    const goal = foe || (owner && owner.alive ? owner : null);
    if (!goal) { z.vel.x = z.vel.z = 0; return; }
    const dx = goal.pos.x - z.pos.x, dz = goal.pos.z - z.pos.z, d = hyp(dx, dz) || 1;
    z.yaw = Math.atan2(dx, dz);
    const spd = z.bossForm ? 4.2 : 3.4;
    if (!foe && d < 2.3) z.vel.x = z.vel.z = 0;
    else { z.vel.x = dx / d * spd; z.vel.z = dz / d * spd; }
    if (foe && d < 1.55 && T >= (z.nextAtk || 0)) {
      z.nextAtk = T + (z.bossForm ? 0.65 : 1.05);
      this.A.hurtZombie(foe, z.bossForm ? 46 : 16, owner && !owner.zt ? owner : null, 'ally');
      this.A.emit(['za', z.id]);
    }
    const P = this.A.P;
    if (P && P.moveEntity) P.moveEntity(z, dt);
  }
  stepTurned(z, dt, T) {
    let foe = null, bd = 12;
    for (const o of this.zombies) {
      if (!o.alive || o === z || o.friendly || o.fightUntil > T) continue;
      const d = hyp(o.pos.x - z.pos.x, o.pos.z - z.pos.z);
      if (d < bd) { bd = d; foe = o; }
    }
    if (!foe) { z.vel.x = z.vel.z = 0; return; }
    const dx = foe.pos.x - z.pos.x, dz = foe.pos.z - z.pos.z, d = hyp(dx, dz) || 1;
    z.yaw = Math.atan2(dx, dz);
    z.vel.x = dx / d * 3.6; z.vel.z = dz / d * 3.6;
    if (d < 1.45 && T >= (z.nextAtk || 0)) {
      z.nextAtk = T + 0.7;
      this.A.hurtZombie(foe, 22, null, 'cheers');
      this.A.emit(['za', z.id]);
    }
    const P = this.A.P;
    if (P && P.moveEntity) P.moveEntity(z, dt);
  }
  lureNear(p, dur) {
    for (const z of this.zombies) {
      if (!z.alive || this.ultProtected(z)) continue;
      const d = hyp(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
      if (d > 18 || Math.abs((z.pos.y || 0) - (p.pos.y || 0)) > 4) continue;
      z.lureId = p.id; z.lureUntil = this.T + dur;
    }
  }
  cueSmash(p) {
    const yaw = p.yaw || 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const reach = Math.hypot(this.hx, this.hz) * 2.2;
    this.A.emit(['qe', 'line', r2(p.pos.x), r2((p.pos.y || 0) + 1.1), r2(p.pos.z), r2(fx), r2(fz)]);
    for (const z of this.zombies) {
      if (!z.alive || z.friendly) continue;
      const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z;
      const along = dx * fx + dz * fz;
      if (along < 0.3 || along > reach) continue;
      if (Math.abs(dx * fz - dz * fx) > 1.35) continue;
      this.A.hurtZombie(z, isBoss(z.zt) ? 170 : 460, p, 'sinuca');
    }
  }
  frenzyArm(p) {
    if (!p || p.ultForm !== 'frenesi' || !(p.ultUntil > this.T)) return false;
    if (p.ultSwingAt > this.T) return false;
    p.ultSwingAt = this.T + 0.48;
    for (const z of this.zombies) {
      if (!z.alive || z.friendly) continue;
      const d = hyp(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
      if (d > 3.5 || Math.abs((z.pos.y || 0) - (p.pos.y || 0)) > 2.4) continue;
      const k = 1 - d / 3.5;
      if (!isBoss(z.zt)) this.A.knock(z, { x: (z.pos.x - p.pos.x) / (d || 1) * 7 * k, y: 3 * k, z: (z.pos.z - p.pos.z) / (d || 1) * 7 * k });
      this.A.hurtZombie(z, 86 * (0.6 + 0.4 * k), p, 'frenesi');
    }
    this.A.emit(['qe', 'arm', p.id]);
    return true;
  }
  dropPuddle(p, dur) {
    this.ultPuddles = this.ultPuddles || [];
    const g = { x: p.pos.x, z: p.pos.z, y: p.pos.y || 0, r: 7, until: this.T + dur, dps: 26, owner: p };
    this.ultPuddles.push(g);
    this.A.emit(['qe', 'pud', r2(g.x), r2(g.z), r2(g.y), g.r, dur]);
  }
  stepUltimates(dt, T) {
    if (!this.egg) return;
    for (const p of this.A.players()) {
      if (!p) continue;
      if (p.ultForm && !(p.ultUntil > T)) {
        if (p.ultForm === 'vampiro') p.fly = false;
        p.ultForm = '';
      }
      if (p.ultForm === 'vampiro' && p.alive) {
        p._vampAcc = (p._vampAcc || 0) + dt;
        if (p._vampAcc >= 0.2) {
          const tick = p._vampAcc; p._vampAcc = 0; let heal = 0;
          for (const z of this.zombies) {
            if (!z.alive || z.friendly) continue;
            if (hyp(z.pos.x - p.pos.x, z.pos.z - p.pos.z) > 6.5) continue;
            if (Math.abs((z.pos.y || 0) - (p.pos.y || 0)) > 3.2) continue;
            this.A.hurtZombie(z, 34 * tick, p, 'vampiro');
            heal += 16 * tick;
          }
          if (heal > 0) this.A.heal(p, heal);
        }
      }
      if (p.ultForm === 'bebado' && p.alive && p.ultAnchor) {
        p._bebAcc = (p._bebAcc || 0) + dt;
        if (p._bebAcc >= 0.2) {
          const tick = p._bebAcc; p._bebAcc = 0;
          for (const z of this.zombies) {
            if (!z.alive || z.friendly) continue;
            if (hyp(z.pos.x - p.ultAnchor.x, z.pos.z - p.ultAnchor.z) > 5.2) continue;
            this.A.hurtZombie(z, 38 * tick, p, 'bebado');
          }
        }
      }
    }
    this.ultPuddles = (this.ultPuddles || []).filter((g) => g.until > T);
    for (const g of this.ultPuddles) {
      g.acc = (g.acc || 0) + dt;
      if (g.acc < 0.2) continue;
      const tick = g.acc; g.acc = 0;
      for (const z of this.zombies) {
        if (!z.alive || z.friendly) continue;
        if (hyp(z.pos.x - g.x, z.pos.z - g.z) > g.r) continue;
        if (Math.abs((z.pos.y || 0) - g.y) > 2.2) continue;
        z.slowUntil = T + 0.35;
        this.A.hurtZombie(z, g.dps * tick, g.owner, 'discipulo');
      }
    }
    this.allyWait = (this.allyWait || []).filter((a) => {
      if (a.at > T) return true;
      const owner = this.A.players().find((p) => p && p.id === a.ownerId && p.hUlt === 'rei');
      if (owner) this.ensureAlly(owner);
      return false;
    });
  }
  applyStoryPlan(plan) {
    this.spec.theme = null;
    this.spec.boss = !!plan.boss;
    this.spec.bossKind = plan.boss || null;
    this.queue = (plan.queue || []).slice();
    this.drip = (plan.drip || []).slice();
    this.dripAt = this.T + 8;
    this.storyName = plan.name;
    this.storyBlurb = plan.blurb;
  }
  stepFinale(dt, T) {
    if (!this.egg) return;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      if (z.zt === 'bossOclinhos') this.stepOclinhos(z, T);
      else if (z.zt === 'bossBig') this.stepBig(z, T);
    }
  }
  livePlayer() {
    const H = this.A.players().filter((p) => p && p.alive && !p.zt);
    return H.length ? H[Math.floor(this.rnd() * H.length)] : null;
  }
  homeProj(pr) {
    const p = this.A.players().find((x) => x && x.id === pr.home && x.alive);
    if (!p) return;
    const dx = p.pos.x - pr.pos.x, dy = (p.pos.y + 1) - pr.pos.y, dz = p.pos.z - pr.pos.z;
    const L = Math.hypot(dx, dy, dz) || 1, sp = (pr.S && pr.S.speed) || 6.5;
    pr.vel.x += (dx / L * sp - pr.vel.x) * 0.18;
    pr.vel.y += (dy / L * sp - pr.vel.y) * 0.18;
    pr.vel.z += (dz / L * sp - pr.vel.z) * 0.18;
  }
  summonCrew(z, type) {
    const at = { x: z.pos.x + (this.rnd() - 0.5) * 5, y: z.pos.y, z: z.pos.z + (this.rnd() - 0.5) * 5 };
    const c = this.spawn(type, at); if (!c) return null;
    c.egg = 'capataz'; c.bossId = z.id;
    const base = (ZOMBIES[type] && (ZOMBIES[type].storyHp || ZOMBIES[type].hp)) || 400;
    c.hp = c.maxHp = Math.max(180, Math.round(base * (isBoss(type) ? 0.35 : 1)));
    this.A.emit(['qe', 'z', c.id, 'capataz', c.name, Math.round(c.hp), c.size || 1]);
    return c;
  }
  vanishCrew(id) {
    for (const o of this.zombies) {
      if (!o.alive || o.egg !== 'capataz' || o.bossId !== id) continue;
      this.A.hurtZombie(o, (o.hp || 0) + 999, null, 'fall');
    }
  }
  stepOclinhos(z, T) {
    const p = this.livePlayer(); if (!p) return;
    if (z.nextBall == null) { z.nextBall = T + 2.2; z.nextBread = T + 5; z.nextCrew = T + 4; z.nextTable = T + 8; }
    z.yaw = Math.atan2(p.pos.x - z.pos.x, p.pos.z - z.pos.z);
    if (!z.boneOut && z.maxHp && z.hp <= z.maxHp * 0.5) {
      z.boneOut = true;
      this.spawn('bonezinho', { x: z.pos.x + 2.2, y: z.pos.y, z: z.pos.z });
      this.eggSay('O Bonezinho entrou na sinuca');
    }
    const crew = this.zombies.filter((o) => o.alive && o.egg === 'capataz' && o.bossId === z.id).length;
    if (crew < 4 && T >= (z.nextCrew || 0)) { this.summonCrew(z, 'sinuca'); z.nextCrew = T + 8; }
    if (T >= (z.nextBall || 0)) { this.spit(z, p, 0, { speed: 6.5, dmg: 24, radius: 1.05, range: 30, style: 5, home: 1, grav: 0.12, life: 4.5 }); z.nextBall = T + 7; }
    if (T >= (z.nextBread || 0)) { z.breadUntil = T + 3; this.A.emit(['qe', 'bread', z.id, 3]); z.nextBread = T + 11; }
    if (z.tableAt && T >= z.tableAt) { const who = this.A.players().find((q) => q && q.id === z.tableWho && q.alive) || p; this.dropTable(z, who); z.tableAt = 0; }
    else if (T >= (z.nextTable || 0)) {
      z.tableWho = p.id; z.tableAt = T + 0.85; z.nextTable = T + 13;
      this.A.emit(['qe', 'warn', p.id, 'A mesa de sinuca vai cair na sua cabeça!']);
    }
  }
  dropTable(z, p) {
    const o = { x: p.pos.x, y: (p.pos.y || 0) + 16, z: p.pos.z };
    const S = { dmg: 55, radius: 1.7, knock: 4 };
    const pr = { id: this.nid++, kind: 'spit', owner: z, pos: o, vel: { x: 0, y: -3.4, z: 0 }, born: this.T, S, style: 8, grav: 0.04, life: 8 };
    this.projs.push(pr);
    this.A.emit(['zs', pr.id, 8, [r2(o.x), r2(o.y), r2(o.z)], [0, r2(-3.4), 0]]);
  }
  stepBig(z, T) {
    const p = this.livePlayer(); if (!p) return;
    if (z.nextLaser == null) { z.nextLaser = T + 2.5; z.nextCrew = T + 6; z.nextCamp = T + 9; z.nextPizza = T + 4; z.nextDebris = T + 3; }
    if (!(z.campUntil > T)) z.yaw = Math.atan2(p.pos.x - z.pos.x, p.pos.z - z.pos.z);
    const crew = this.zombies.some((o) => o.alive && o.egg === 'capataz' && o.bossId === z.id);
    if (!crew && T >= (z.nextCrew || 0)) {
      const kind = BOSS_TYPES[Math.floor(this.rnd() * BOSS_TYPES.length)];
      this.summonCrew(z, kind); z.nextCrew = T + 14;
    }
    if (T >= (z.nextLaser || 0)) { this.cheersLaser(z); z.nextLaser = T + 5.5; }
    if (z.campUntil > T && z.campShots > 0 && T >= (z.campNext || 0)) {
      this.spit(z, p, 0, { speed: 32, dmg: 28, radius: 0.45, range: 40, style: 9, grav: 0.08, life: 2.2 });
      z.campShots -= 1; z.campNext = T + 0.65;
    } else if (T >= (z.nextCamp || 0)) {
      const spot = this.shapePos() || { x: z.pos.x, y: z.pos.y, z: z.pos.z };
      z.pos.x = spot.x; z.pos.y = spot.y; z.pos.z = spot.z;
      z.vel.x = z.vel.y = z.vel.z = 0;
      z.campUntil = T + 3.4; z.campShots = 3; z.campNext = T + 0.35; z.nextCamp = T + 16;
      this.A.emit(['qe', 'camp', z.id, r2(spot.x), r2(spot.y), r2(spot.z)]);
    }
    if (!z.ruined && z.maxHp && z.hp <= z.maxHp * 0.5) {
      z.ruined = true;
      this.A.emit(['qe', 'ruin']);
      this.eggSay('O Big derrubou o bloco 1. A HOTMILK ficou com o pátio.');
    }
    if (z.ruined && T >= (z.nextDebris || 0)) { this.spit(z, p, 0, { speed: 13, dmg: 30, radius: 1.8, range: 28, style: 7, grav: 1 }); z.nextDebris = T + 3.2; }
    if (T >= (z.nextPizza || 0)) { this.spit(z, p, 0, { speed: 15, dmg: 22, radius: 1.35, range: 24, style: 6, grav: 1 }); z.nextPizza = T + 6.5; }
  }
  cheersLaser(z) {
    const fx = Math.sin(z.yaw), fz = Math.cos(z.yaw);
    this.A.emit(['qe', 'laser', r2(z.pos.x), r2(z.pos.y + 1.5 * (z.size || 1)), r2(z.pos.z), r2(fx), r2(fz)]);
    for (const p of this.A.players()) {
      if (!p || !p.alive) continue;
      const dx = p.pos.x - z.pos.x, dz = p.pos.z - z.pos.z;
      const along = dx * fx + dz * fz;
      if (along < 1.2 || along > 24) continue;
      if (Math.abs(dx * fz - dz * fx) > 0.95) continue;
      if (Math.abs((p.pos.y || 0) - z.pos.y) > 2.6) continue;
      this.A.hurtPlayer(p, 34, z);
    }
  }
  // ---------- estado compacto (snapshot online) ----------
  stateArr() {
    const F = this.fog, T = this.T;
    return [PHASES.indexOf(this.phase), this.wave, r2(Math.max(0, this.phaseEnd - T)), this.waveZombies().length, this.queue.length + (this.bossPending ? 1 : 0) + this.waveZombies().length + ((this.drip && this.drip.length) || 0),
      r2(F.cx), r2(F.cz), r2(F.r), r2(F.tx), r2(F.tz), r2(F.tr), this.bossId, this.A.players().map((p) => [p.id, p.lives ?? INV.LIVES, p.out ? 1 : 0, p.ghostUntil > T ? 1 : 0]),
      this.lanterns.map((l) => [l.owner.id, r2(l.until - T)]), this.hard ? 1 : 0,
      this.crosses.map((c) => [c.p.id, r2(c.x), r2(c.y), r2(c.z), c.by | 0, r2(c.prog)]), themeIndex(this.spec && this.spec.theme)];
  }
}
// lê o estado compacto (cliente online) no mesmo formato que o cliente offline monta a partir do core
export function parseState(a) {
  if (!a) return null;
  return { phase: PHASES[a[0]] || 'prep', wave: a[1], left: a[2], alive: a[3], remaining: a[4], fog: { cx: a[5], cz: a[6], r: a[7], tx: a[8], tz: a[9], tr: a[10] }, bossId: a[11],
    lives: new Map((a[12] || []).map(([id, l, o, g]) => [id, { lives: l, out: !!o, ghost: !!g }])), lanterns: new Map((a[13] || []).map(([id, t]) => [id, t])),
    hard: !!a[14], crosses: (a[15] || []).map(([id, x, y, z, by, prog]) => ({ id, x, y, z, by, prog })), theme: a[16] | 0 };
}
export function coreView(core) {
  if (!core) return null; const a = core.stateArr(); const v = parseState(a); return v;
}

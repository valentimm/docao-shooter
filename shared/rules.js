// ============================================================
//  Regras compartilhadas (cliente + servidor). Sem DOM, sem Three.js.
//  Armas, Copo Bomba, física do Docão, tempos de partida e nomes dos bots.
//  Vida, bloqueio e golpe da Tampa do Tacho: shared/shield.js (não duplicar número aqui sem atualizar o teste).
// ============================================================
import { SHIELD, noteWeapons } from './shield.js';
export const KILL_LIMIT = 20, TIME_LIMIT = 300, RESPAWN_TIME = 5, INVULN = 2;
// duração da partida escolhida pelo anfitrião (minutos); 0 = padrão do modo (5 min Mata-mata, 7 min Dominação)
export const TIME_OPTIONS = [0, 3, 5, 7, 10, 15, 20];
export const normTime = (v) => { const n = Number(v); return TIME_OPTIONS.includes(n) ? n : 0; };
// Regeneração fora de combate: 5 s sem levar dano → +10 de vida por segundo até 100.
// Só se o último dano veio de OUTRO Docão: dano em si mesmo (bazuca/foguete no pé, Copo Bomba próprio, míssil/nuke em si,
// atacante = você ou sem atacante) não libera e cancela a regeneração pendente. Pickup de vida e bacon não mexem nisso.
export const REGEN_DELAY = 5, REGEN_RATE = 10;
export function noteHurt(e, attacker, now) { e.lastHurt = now; e.regenOk = !!attacker && attacker !== e; }
export function resetRegen(e) { e.lastHurt = -1e9; e.regenOk = false; e.regenOn = false; }
export function regenStep(e, now, dt) {
  e.regenOn = !!(e.alive && e.regenOk && e.hp > 0 && e.hp < 100 && now - e.lastHurt >= REGEN_DELAY);
  if (e.regenOn) e.hp = Math.min(100, e.hp + REGEN_RATE * dt);
  return e.regenOn;
}
// Bacon que cura: quem pisa no bacon de um Docão morto (menos o próprio morto) ganha +10 de vida e o bacon some.
// life = tempo que o bacon fica visível no cliente (bacon.js: LINGER 3,0 + FADE 0,45 s); from = já virou bacon (MORPH 0,3 s).
// radius/dy: igual aos pickups de vida (raio horizontal ~1,2 m, mesmo andar).
export const BACON_ITEM = { heal: 10, radius: 1.2, dy: 1.0, from: 0.3, life: 3.45 };
export const GRAV = -24, JUMP = 8.5, SPEED = 6.8, BOT_SPEED = 5.4, STEP = 0.45, RADIUS = 0.42, HEIGHT = 2.0, EYE = 1.6;

// Tranco de quem leva tiro (flinch). Ângulos em radianos. A luneta de sniper leva o tranco cheio;
// fora dela fica hip (bem menor): o castigo é de quem fica parado de scope, sem reescrever o duelo de fuzil.
// recover: ~95% da volta em 0,32 s (entre 0,25 e 0,4). maxPitch/maxYaw: tiros seguidos não acumulam sem teto.
export const FLINCH = {
  pitch: 0.05, yaw: 0.014, refDmg: 40, cap: 1, hip: 0.18, recover: 0.32, maxPitch: 0.072, maxYaw: 0.03,
};
export function flinchKick(dmg, scope01 = 0, rnd = Math.random) {
  const k = Math.min(FLINCH.cap, Math.max(0, Number(dmg) || 0) / FLINCH.refDmg);
  const s = FLINCH.hip + (1 - FLINCH.hip) * Math.max(0, Math.min(1, scope01));
  return { pitch: FLINCH.pitch * k * s, yaw: (rnd() * 2 - 1) * FLINCH.yaw * k * s };
}
// Soma no estado { flinch: { pitch, yaw } } respeitando o teto. Devolve o que entra na câmera agora.
export function applyFlinch(state, dmg, scope01 = 0, rnd = Math.random) {
  const kick = flinchKick(dmg, scope01, rnd);
  const f = state.flinch ||= { pitch: 0, yaw: 0 };
  const pitch = Math.min(kick.pitch, Math.max(0, FLINCH.maxPitch - f.pitch));
  const nextY = Math.max(-FLINCH.maxYaw, Math.min(FLINCH.maxYaw, f.yaw + kick.yaw));
  const yaw = nextY - f.yaw;
  f.pitch += pitch; f.yaw = nextY;
  return { pitch, yaw };
}
// Quanto devolver da câmera neste frame. Em recover segundos sobra ~5% (e^{-3}).
export function decayFlinch(f, dt) {
  if (!f) return { pitch: 0, yaw: 0 };
  const decay = Math.exp(-Math.max(0, dt) / (FLINCH.recover / 3));
  const pitch = f.pitch, yaw = f.yaw;
  f.pitch = Math.abs(pitch * decay) < 1e-4 ? 0 : pitch * decay;
  f.yaw = Math.abs(yaw * decay) < 1e-4 ? 0 : yaw * decay;
  return { pitch: pitch - f.pitch, yaw: yaw - f.yaw };
}

// Red dot dos fuzis de assalto (cat: 'ar'). adsFov 63 com FOV base 75 ≈ 1,19×.
// recoil 0,35 = mirando, o coice real da câmera (subida, lateral, padrão) fica em 35% (−65%). Não zera.
// visual = tremor do modelo, sem deslocar o ponto. No quadril o recoil da arma continua o de sempre.
export const RED_DOT = { adsFov: 63, adsSpread: 0.02, recoil: 0.35, visual: 0.12, ads: 0.85 };

// Armas. Primárias (menu): 0 Fuzil, 22 Commando, 21 Metralhadora do Chiqueiro, 1 Calibre 12 (pump), 12 Semi, 2 Sniper Torresmo, 5 Canhão, 6 Carabina, 3 Bazuca. Faca 7, sabre 8. Secundária: 4 pistola, 11 furadeira, 13 besta, 14 arco, 19 estilingue. 18 lança-milho, 20 minigun (só código). A besta e o arco são fracas de propósito: um tiro no corpo não mata.
// cat 'ar' = fuzil de assalto (Fuzil, FAMAS, Commando). O menu 'rajada' também tem SMG e LMG; isso não é AR.
export const WEAPONS = [
  { key: 'rifle', name: 'Fuzil Pururuca', short: 'Fuzil Pururuca', chip: 'Fuzil', cat: 'ar', mag: 30, reserve: 120, dmg: 20, headMul: 2, rate: 0.1, auto: true, pellets: 1, spread: 0.01, reload: 1.6, range: 140, recoil: 0.018, adsFov: 40, adsSpread: 0.12, flashZ: -0.76,
    desc: 'Automático · 30/120 · 20 dano' },
  // 1 · Calibre 12 (SPAS-12 pump): 9 chumbos × 17 = 153 no corpo; mata de 1 tiro até ~8 m andando (moveSpread 1,35 no lugar do 2,2 geral); cai forte depois de 8 m; empurra quem leva (knock, ver shotKnock em combat.js)
  { key: 'shotgun', name: 'Escopeta Chiqueiro · Calibre 12', short: 'Calibre 12', chip: 'Calibre 12', mag: 8, reserve: 32, dmg: 17, headMul: 1.5, rate: 0.62, auto: false, pellets: 9, spread: 0.05, moveSpread: 1.35, reload: 0.38, shellReload: true, reloadStart: 0.2, range: 45, recoil: 0.085, adsFov: 55, adsSpread: 0.7, flashZ: -0.86,
    falloff: [8, 20, 0.2], knock: { push: 7, lift: 2.6 }, pump: true, desc: 'Calibre 12 · pump · 8/32 · 1 tiro mata até ~8 m · empurra' },
  // Intermediária: ferrolho clássico, 1 tiro no corpo (ref. Intervention).
  { key: 'sniper', name: 'Sniper Torresmo', short: 'Sniper Torresmo', chip: 'Torresmo', mag: 5, reserve: 20, dmg: 100, headMul: 1.5, rate: 1.15, auto: false, pellets: 1, spread: 0.07, reload: 2.3, range: 220, recoil: 0.055, adsFov: 13, adsSpread: 0, flashZ: -1.1,
    scope: true, bolt: true, beam: true, scopeStyle: 'torresmo', desc: 'Ferrolho médio · 5/20 · 1 tiro no corpo · botão direito = luneta' },
  { key: 'bazooka', name: 'Bazuca do Chiqueiro', short: 'Bazuca', chip: 'Bazuca', mag: 1, reserve: 4, dmg: 0, headMul: 1, rate: 0.6, auto: false, pellets: 0, spread: 0.004, reload: 2.5, range: 0, recoil: 0.09, adsFov: 55, adsSpread: 0.5, flashZ: -0.9,
    rocket: { speed: 24, radius: 5, maxDmg: 120, selfMul: 0.4, knock: 11, lift: 13 }, desc: 'Foguete · 1/4 · dano em área · rocket jump' },
  { key: 'pistol', name: 'Pistolinha Leitão', short: 'Pistolinha', chip: 'Pistola', mag: 12, reserve: 60, dmg: 25, headMul: 2, rate: 0.16, auto: false, pellets: 1, spread: 0.007, reload: 1.1, range: 110, recoil: 0.03, adsFov: 50, adsSpread: 0.4, flashZ: -0.42,
    desc: 'Semiautomática · 12/60 · 25 dano' },
  // Pesada: pouca bala, dano alto, luneta forte (ref. Barrett).
  { key: 'canhao', name: 'Canhão do Barril', short: 'Canhão do Barril', chip: 'Canhão', mag: 3, reserve: 12, dmg: 180, headMul: 1, rate: 1.85, auto: false, pellets: 1, spread: 0.045, reload: 3.1, range: 260, recoil: 0.1, adsFov: 8, adsSpread: 0, flashZ: -1.25,
    scope: true, bolt: true, beam: true, scopeStyle: 'canhao', desc: 'Ferrolho lento · 3/12 · mata em qualquer lugar · luneta pesada' },
  // Leve: ferrolho rápido, 5 no pente e 40 na reserva. Antes do flinch não havia adsIn: a Granja usava os 0,15 s globais. adsIn 0,19125 s = +27,5% sobre esse original (o 0,24 s era +60%). scopeAt: a lente só abre com a arma já no lugar.
  { key: 'carabina', name: 'Carabina da Granja', short: 'Carabina da Granja', chip: 'Carabina', mag: 5, reserve: 40, dmg: 55, headMul: 2.2, rate: 0.58, auto: false, pellets: 1, spread: 0.09, reload: 2.9, range: 180, recoil: 0.04, adsFov: 24, adsSpread: 0, flashZ: -0.95,
    scope: true, bolt: true, beam: true, scopeStyle: 'carabina', adsIn: 0.15 * 1.275, scopeAt: 0.97, desc: 'Ferrolho rápido · 5/40 · luneta mais lenta · recarrega mais lento · fraca no corpo · luneta aberta' },
  // 7 · Faca de churrasqueiro: corpo a corpo, sempre no slot 3 (sem munição). Regras de acerto em shared/melee.js
  { key: 'knife', name: 'Faca de churrasqueiro', short: 'Faca', chip: 'Faca', mag: 0, reserve: 0, dmg: 40, headMul: 1, rate: 0.42, auto: true, pellets: 0, spread: 0, reload: 0, range: 1.6, recoil: 0, adsFov: 75, adsSpread: 1, flashZ: 0,
    melee: true, desc: 'Golpe 40 · estocada no botão direito · pelas costas mata' },
  // 8 · Sabre de Luz: duelista. Combo de 3 (o último é o forte), parry, investida e arremesso. Anda na velocidade normal.
  // Números de verdade (alcance, dano, cooldown) estão em shared/saber.js — daqui só o que o menu e a cadência mínima leem.
  { key: 'sabre', name: 'Sabre de Luz', short: 'Sabre de Luz', chip: 'Sabre', mag: 0, reserve: 0, dmg: 52, headMul: 1, rate: 0.30, auto: false, pellets: 0, spread: 0, reload: 0, range: 2.55, recoil: 0, adsFov: 75, adsSpread: 1, flashZ: -0.5,
    melee: true, saber: true, reach: 2.55, arc: 0.78,
    desc: 'Duelista · combo 36/36/52 · botão direito bloqueia · C investida · Z arremesso · velocidade normal' },
  // 9 · MP5K no lugar da Mini Uzi, mesmo índice.
  { key: 'uzi', name: 'MP5K da Granja', short: 'MP5K', chip: 'MP5K', mag: 30, reserve: 90, dmg: 16, headMul: 1.5, rate: 0.088, auto: true, pellets: 1, spread: 0.02, reload: 1.5, range: 90, recoil: 0.02, adsFov: 52, adsSpread: 0.5, flashZ: -0.52,
    falloff: [8, 28, 0.35], desc: 'Da granja · 30/90 · rajada um pouco mais lenta que a P90 · dano de SMG' },
  // 10 · Compacta no estilo P90: carregador grande em cima, rajada mais estável.
  { key: 'p90', name: 'P90 da Granja', short: 'P90', chip: 'P90', mag: 50, reserve: 150, dmg: 14, headMul: 1.5, rate: 0.07, auto: true, pellets: 1, spread: 0.016, reload: 1.7, range: 110, recoil: 0.024, adsFov: 48, adsSpread: 0.28, flashZ: -0.55,
    falloff: [16, 48, 0.45], desc: 'Compacta · 50/150 · rajada estável' },
  // 11 · Furadeira de prego: opção de secundária. Um prego por clique.
  { key: 'prego', name: 'Furadeira de Prego', short: 'Furadeira', chip: 'Prego', mag: 16, reserve: 64, dmg: 18, headMul: 1.4, rate: 0.11, auto: false, pellets: 1, spread: 0.02, reload: 1.25, range: 40, recoil: 0.02, adsFov: 58, adsSpread: 0.55, flashZ: -0.48,
    falloff: [6, 22, 0.25], desc: 'Secundária · um prego por clique · forte de perto' },
  // 12 · Escopeta semi: sem pump. Cada tiro é mais fraco que a Calibre 12, mas o próximo sai bem antes.
  { key: 'semi', name: 'Escopeta Semi do Leitão', short: 'Semi', chip: 'Semi', mag: 8, reserve: 32, dmg: 13, headMul: 1.5, rate: 0.36, auto: false, pellets: 8, spread: 0.075, reload: 1.4, range: 40, recoil: 0.048, adsFov: 58, adsSpread: 0.7, flashZ: -0.72,
    falloff: [6, 22, 0.25], desc: 'Semi · 8/32 · atira rápido · mais fraca que a pump' },
  // 13 · Besta: secundária de um virote. Não mata no corpo (vida 100).
  { key: 'besta', name: 'Besta do Leitão', short: 'Besta', chip: 'Besta', mag: 1, reserve: 10, dmg: 38, headMul: 1.35, rate: 0.45, auto: false, pellets: 1, spread: 0.004, reload: 1.35, range: 80, recoil: 0.045, adsFov: 58, adsSpread: 0.45, flashZ: -0.7,
    falloff: [12, 40, 0.45], desc: 'Secundária · um virote · recarrega armando a corda' },
  // 14 · Arco: secundária mais fraca, corda mais rápida que a besta.
  { key: 'arco', name: 'Arco da Granja', short: 'Arco', chip: 'Arco', mag: 1, reserve: 16, dmg: 26, headMul: 1.4, rate: 0.35, auto: false, pellets: 1, spread: 0.015, reload: 0.85, range: 65, recoil: 0.03, adsFov: 62, adsSpread: 0.55, flashZ: -0.55,
    falloff: [10, 36, 0.4], draw: 0.7, desc: 'Secundária · segura o clique para puxar a corda · solta mais forte' },
  // 15 · Bullpup de rajada (ref. FAMAS do CoD): um clique = 3 tiros. rate = intervalo dentro da rajada; burstDelay = pausa até a próxima.
  { key: 'famas', name: 'FAMAS da Pocilga', short: 'FAMAS', chip: 'FAMAS', cat: 'ar', mag: 30, reserve: 120, dmg: 34, headMul: 1.5, rate: 0.065, auto: false, pellets: 1, spread: 0.022, reload: 2.1, range: 150, recoil: 0.02, adsFov: 46, adsSpread: 0.11, flashZ: -0.78,
    burst: 3, burstDelay: 0.3, falloff: [16, 50, 0.6], desc: 'Rajada de 3 · 30/120 · uma rajada inteira mata de perto' },
  // 16 · Disco Voador: dispara um disco-OVNI que quica 3 vezes (regras em shared/disc.js). Dois discos no corpo matam.
  { key: 'disco', name: 'Disco Voador', short: 'Disco Voador', chip: 'Disco', mag: 4, reserve: 16, dmg: 60, headMul: 1.5, rate: 0.6, auto: false, pellets: 0, spread: 0, reload: 1.7, range: 0, recoil: 0.04, adsFov: 55, adsSpread: 0.5, flashZ: -0.62,
    disc: true, desc: 'Disco-OVNI · quica 3 vezes na parede · 4/16' },
  // 17 · Sabre Duplo: um em cada mão, cone largo, giro em área. Anda na velocidade normal (a lentidão antiga saiu).
  { key: 'sabre2', name: 'Sabre Duplo', short: 'Sabre Duplo', chip: 'Sabre 2x', mag: 0, reserve: 0, dmg: 42, headMul: 1, rate: 0.26, auto: false, pellets: 0, spread: 0, reload: 0, range: 2.45, recoil: 0, adsFov: 75, adsSpread: 1, flashZ: -0.5,
    melee: true, saber: true, dual: true, reach: 2.45, arc: 1.22,
    desc: 'Área · combo 28/32/42 · botão direito bloqueia · C investida curta · Z giro · velocidade normal' },
  // 18 · Lança-Milho: 3 grãos com gravidade leve; cada um estoura em 3 pipocas (regras em shared/corn.js). Bom pra limpar canto.
  { key: 'milho', name: 'Lança-Milho da Quermesse', short: 'Lança-Milho', chip: 'Milho', mag: 6, reserve: 24, dmg: 0, headMul: 1, rate: 0.7, auto: false, pellets: 0, spread: 0, reload: 2.3, range: 0, recoil: 0.05, adsFov: 58, adsSpread: 0.5, flashZ: -0.5,
    corn: true, desc: '3 grãos por tiro · estouram em pipoca · 6/24 · limpa canto' },
  // 19 · Estilingue de Ovo: secundária silenciosa. Segura o clique pra esticar; o ovo voa em arco (shared/egg.js) e suja a tela de quem leva.
  { key: 'estilingue', name: 'Estilingue de Ovo', short: 'Estilingue', chip: 'Ovo', mag: 1, reserve: 14, dmg: 34, headMul: 1.5, rate: 0.3, auto: false, pellets: 0, spread: 0, reload: 0.7, range: 0, recoil: 0.025, adsFov: 62, adsSpread: 0.5, flashZ: -0.5,
    draw: 0.55, egg: true, silent: true, pen: 0, desc: 'Secundária · segura o clique pra esticar · ovo em arco suja a tela · quase sem barulho' },
  // 20 · Minigun do Galpão: fora do Arsenal (código "minigun" no chat). Embala 0,6 s, ~22 tiros/s, esquenta e trava; 600 tiros sem reserva, sem zoom.
  { key: 'minigun', name: 'Minigun do Galpão', short: 'Minigun', chip: 'Minigun', mag: 600, reserve: 0, dmg: 12, headMul: 1.4, rate: 0.045, auto: true, pellets: 1, spread: 0.03, reload: 4.2, range: 120, recoil: 0.006, adsFov: 75, adsSpread: 1, flashZ: -0.86,
    falloff: [14, 45, 0.55], spin: { up: 0.6, down: 0.9, heat: 0.005, cool: 0.5 }, heavy: true, noAds: true, move: 1, desc: 'Embala 0,6 s · ~22 tiros/s · esquenta e trava · 600 tiros, sem reserva' },
  // 21 · Metralhadora do Chiqueiro: fita grande, recuo forte, recarga lenta e movimento 5% mais lento.
  { key: 'lmg', name: 'Metralhadora do Chiqueiro', short: 'Metralhadora', chip: 'LMG', mag: 100, reserve: 300, dmg: 15, headMul: 1.6, rate: 0.08, auto: true, pellets: 1, spread: 0.024, reload: 3.1, range: 130, recoil: 0.032, adsFov: 48, adsSpread: 0.22, flashZ: -0.95,
    falloff: [18, 55, 0.5], move: 0.95, inspect: 'lmg', desc: 'Fita · 100/300 · recuo forte · anda 5% mais devagar · recarga lenta' },
  // 22 · Commando da Granja: cone preciso, mas a rajada sobe e exige compensação.
  { key: 'commando', name: 'Commando da Granja', short: 'Commando', chip: 'Commando', cat: 'ar', mag: 30, reserve: 120, dmg: 12, headMul: 1.4, rate: 0.09, auto: true, pellets: 1, spread: 0.003, reload: 1.8, range: 150, recoil: 0.025, adsFov: 36, adsSpread: 0.04, flashZ: -0.8,
    move: 1, desc: 'Rajada com subida · 12 de dano · 30/120 · compense o recuo' },
  // 23 · Revólver do Capataz: secundária de dupla ação. 58 no corpo (2 tiros) e 116 na cabeça (1) até o começo do falloff.
  // rate 0,4 s = 150 RPM. O coice sobe forte e volta (recoilBack) antes do próximo tiro. Tambor de 6, recarga lenta.
  { key: 'capataz', name: 'Revólver do Capataz', short: 'Capataz', chip: 'Revólver', mag: 6, reserve: 30, dmg: 58, headMul: 2, rate: 0.4, auto: false, pellets: 1, spread: 0.011, moveSpread: 1.55, reload: 2.45, range: 85, recoil: 0.074, recoilBack: 0.4, adsFov: 46, adsSpread: 0.1, flashZ: -0.55,
    falloff: [8, 34, 0.45], equip: 0.74, revolver: true, inspect: 'revolver', desc: 'Dupla ação · 6/30 · 2 no corpo ou 1 na cabeça de perto · recarga do tambor' },
  // 24 · Dois Capatazes: um em cada mão. Sem mira (o botão direito atira a esquerda). Cada tambor tem o próprio relógio de 0,4 s.
  { key: 'capataz2', name: 'Dois Capatazes', short: '2 Capatazes', chip: 'Akimbo', mag: 6, reserve: 36, dmg: 58, headMul: 2, rate: 0.4, auto: false, pellets: 1, spread: 0.048, moveSpread: 2.5, reload: 3.6, range: 75, recoil: 0.05, recoilBack: 0.7, adsFov: 75, adsSpread: 1, flashZ: -0.55,
    falloff: [8, 34, 0.45], equip: 0.9, revolver: true, akimbo: true, noAds: true, move: 0.92, inspect: 'revolver', desc: 'Um em cada mão · sem mira · o esquerdo no botão direito · recarrega os dois' },
  // 25 · Tampa do Tacho: escudo primário. O índice 23 ficou com o revólver (as duas branches pediram o 23).
  // Bloqueio, vida e vazamento estão em shared/shield.js. dmg/rate/range/move espelham SHIELD.
  { key: 'tampa', name: 'Tampa do Tacho', short: 'Tampa do Tacho', chip: 'Tampa', mag: 0, reserve: 0, dmg: SHIELD.bash.dmg, headMul: 1, rate: SHIELD.bash.rate, auto: false, pellets: 0, spread: 0, reload: 0, range: SHIELD.bash.reach, recoil: 0, adsFov: 75, adsSpread: 1, flashZ: 0,
    shield: true, noAds: true, move: SHIELD.move, inspect: 'shield',
    desc: `Escudo · vida ${SHIELD.hp} · bloqueio frontal · golpe ${SHIELD.bash.dmg} · anda ${Math.round((1 - SHIELD.move) * 100)}% mais devagar` },
];
// Exclusiva da Corrida Armada: ID próprio, fora do arsenal e das classes.
export const GOLD_KNIFE = WEAPONS.length;
WEAPONS.push({ ...WEAPONS[7], key: 'faca-dourada', name: 'Faca Dourada', short: 'Faca Dourada', chip: 'Ouro', noAds: true, desc: 'Corrida Armada · uma eliminação válida vence a partida' });
// 27 · Ray Gun: só a Barraca da Sorte no Survival. Fora de PRIMARIES, SECONDARIES, categorias, bots, parede e X1.
// dmg é o centro do estouro (raio e auto-dano em shared/ray.js). Não é hitscan.
export const RAY = WEAPONS.length;
WEAPONS.push({
  key: 'ray', name: 'Ray Gun', short: 'Ray Gun', chip: 'Ray', mag: 20, reserve: 160, dmg: 260, headMul: 1, rate: 0.22, auto: true, pellets: 0, spread: 0.006, reload: 1.7, range: 0, recoil: 0.028, adsFov: 58, adsSpread: 0.35, flashZ: -0.55,
  ray: true, inspect: 'ray', desc: 'Survival · Barraca da Sorte · pulso que quica 3 vezes · estouro curto · 20/160',
});
export const isKnife = (i) => i === 7 || i === GOLD_KNIFE;

// Penetração e collateral (regra em shared/penetration.js). pen = metros de parede fina por bala (caixote conta 45%);
// pierce = corpos extras que a bala atravessa; pierceMul = dano que sobra a cada corpo. Sem entrada = não atravessa nada.
const PEN_STATS = { rifle: [0.35], lmg: [0.4], commando: [0.3], famas: [0.35], p90: [0.25], uzi: [0.2], pistol: [0.2], sniper: [0.9, 2, 0.75], canhao: [1.6, 3, 0.85], carabina: [0.6, 1, 0.6], minigun: [0.4], capataz: [0.22], capataz2: [0.22] };
for (const w of WEAPONS) { const s = PEN_STATS[w.key]; w.pen = s ? s[0] : 0; w.pierce = s ? s[1] || 0 : 0; w.pierceMul = s ? s[2] ?? 1 : 1; }
noteWeapons(WEAPONS);
export const UZI = 9, P90 = 10, NAIL = 11, SEMI = 12;
export const CROSS = 13, BOW = 14, FAMAS = 15, DISC_W = 16, SABER2 = 17;
export const CORN_W = 18;
export const EGG_W = 19; // Estilingue de Ovo
export const MINIGUN = 20; // fora do Arsenal: só pelo código "minigun" no chat
export const LMG = 21; // Metralhadora do Chiqueiro
export const COMMANDO = 22; // Commando da Granja
export const REV = 23; // Revólver do Capataz
export const REV2 = 24; // Dois Capatazes (akimbo)
export const TAMPA = 25; // Tampa do Tacho (escudo). 23 e 24 são os revólveres.
export const isSaber = (i) => !!(WEAPONS[i] && WEAPONS[i].saber); // Sabre (8) ou Sabre Duplo (17)
export const isAssault = (i) => !!(WEAPONS[i] && WEAPONS[i].cat === 'ar');
export const PRIMARIES = [0, COMMANDO, UZI, P90, FAMAS, 1, 2, 5, 6, 3, SEMI, DISC_W, CORN_W, LMG, TAMPA], PISTOL = 4, KNIFE = 7, SABER = 8, W_NADE = -1, W_FALL = -3;
export const SECONDARIES = [PISTOL, NAIL, CROSS, BOW, EGG_W, REV, REV2];
export const MELEES = [KNIFE, SABER, SABER2];
export const BOT_PRIMARIES = [0, COMMANDO, LMG, UZI, P90, FAMAS, 1, SEMI, 2, 5, 6, 3, CORN_W];
// Menu: cada grupo é uma escolha. primary = uma primária. melee = faca ou sabre. secondary = pistola, furadeira, besta, arco ou estilingue.
export const CATEGORIES = [
  { id: 'rajada', title: 'Rajada', pick: 'primary', weapons: [0, COMMANDO, LMG, UZI, P90, FAMAS] },
  { id: 'escopeta', title: 'Escopeta', pick: 'primary', weapons: [1, SEMI] },
  { id: 'precisao', title: 'Precisão', pick: 'primary', weapons: [2, 5, 6] },
  { id: 'explosivo', title: 'Explosivo', pick: 'primary', weapons: [3, CORN_W] },
  { id: 'especial', title: 'Especial', pick: 'primary', weapons: [DISC_W] },
  { id: 'escudo', title: 'Escudo', pick: 'primary', weapons: [TAMPA] },
  { id: 'faca', title: 'Faca', pick: 'melee', weapons: [KNIFE, SABER, SABER2] },
  { id: 'secundaria', title: 'Secundária', pick: 'secondary', weapons: [PISTOL, NAIL, CROSS, BOW, EGG_W, REV, REV2] },
];
// Faca: golpe (clique) e estocada (botão direito). range = alcance até a superfície do corpo; cone = meia-abertura (rad).
// Pelas costas (atacante atrás da vítima: cos(frente da vítima, vítima→atacante) < backDot) = morte instantânea.
export const MELEE = {
  slash: { dmg: 40, range: 1.6, cone: 0.62, rate: 0.42 },
  stab: { dmg: 75, range: 1.8, cone: 0.36, rate: 1.0 },
  backDot: -0.4, backDmg: 1000, speedMul: 1.15, draw: 0.2,
};
WEAPONS[GOLD_KNIFE].move = MELEE.speedMul; // a dourada corre como a faca de churrasqueiro
export const SABER_COLORS = [
  { id: 'vermelho', hex: '#ff2a2a' },
  { id: 'azul', hex: '#3d7eff' },
  { id: 'verde', hex: '#39e07a' },
  { id: 'roxo', hex: '#b44dff' },
  { id: 'amarelo', hex: '#ffe14a' },
  { id: 'branco', hex: '#f4fbff' },
];
// Copo Bomba (granada)
export const NADE = { max: 3, spawnWith: 1, fuse: 2.5, charge: 1.2, step: 1 / 120, radius: 6, maxDmg: 130, selfMul: 0.4, grav: -20, r: 0.14, pickupRespawn: 20, knock: 14, lift: 7 };
// Pokébola (código "pokebola" no chat): joga no Q no lugar do copo; ao abrir engole todo inimigo no raio (com linha livre).
export const POKE = { fuse: 1.4, radius: 5.5, max: 3 };
export const isPokeCode = (text) => /pok[eé]\s*bola/i.test(String(text || ''));
// Minigun (código "minigun" no chat): troca a primária pela minigun até morrer
export const isMiniCode = (text) => /\bmini\s*-?\s*gun\b/i.test(String(text || ''));
export const WEAPON_SHORT = (i) => (i === W_NADE ? 'Copo Bomba' : i === W_FALL ? 'Penhasco' : WEAPONS[i] ? WEAPONS[i].short : '?');
export const BOT_DEFS = [
  { name: 'Farofa' }, { name: 'Pipoca' }, { name: 'Trufa' }, { name: 'Bolota' }, { name: 'Torresmo' }, { name: 'Paçoca' }, { name: 'Linguiça' }, { name: 'Quindim' }, { name: 'Coxinha' }, { name: 'Pururuca' },
];

export const BOT_RANGE = [14, 4.5, 26, 14, 10, 34, 18, 1.2, 2.2, 8, 12, 6, 6, 16, 14, 20, 12, 2.2, 9, 14, 16, 16, 18, 10, 6, 4, 1.2, 14]; // 23 revólver (como a pistola), 24 akimbo (cola), 25 tampa (chega perto pra porrada), 26 faca dourada (cola, igual a faca), 27 Ray Gun (não entra no sorteio dos bots)
export const TAG_COLORS = ['#7DF9FF', '#ffd27a', '#ff9fb6', '#9be37a', '#c9a4ff', '#ffb36b', '#9fd0ff', '#ffa3d8', '#b8f2e6', '#ffe9a8'];

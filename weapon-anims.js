// Personalidade de cada arma. Só visual: curva, coice do viewmodel, idle, saque, inspeção.
// Os tempos de recarga, saque e tiro continuam em shared/rules.js. Aqui não existe reload, rate nem dmg.
// Tudo é função pura (sem Three.js) pra testar no Node e ajustar sem caçar número no main.js.
//
// Como mexer: ache a chave da arma em FLAIR e troque os números.
//   draw  = saque (bell no meio, early na primeira metade; y negativo = arma mais baixa, o teste exige isso)
//   recoil = multiplicador do coice visual em cima do fp.kick que já existe (pitch 1.2 e z 0.5 reproduzem o antigo)
//   bob = balanço ao correr (1 = o de hoje)
//   loco = inclinação extra de corrida / pulo
//   rare = idle raro depois de parado (amplitude)
//   kill = gesto curto depois do abate (cancela com qualquer input de combate)
//   inspect = extra da tecla I (ry e rz ficam 0: o teste de inspeção olha o sinal desses eixos na pose base)
//   reload = tempero em cima da recarga que já existe (dip/tilt/pitch/yaw + tapa)
//   egg = o que acontece na versão rara (~8%)

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const bell = (k) => Math.sin(Math.PI * clamp01(k));
const early = (k) => Math.sin(Math.PI * clamp01(k) * 2);

const P = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => ({ x, y, z, rx, ry, rz });
const ZERO = P();
const add = (a, b, s = 1) => P(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s, a.rx + b.rx * s, a.ry + b.ry * s, a.rz + b.rz * s);

// draw: [x, y, z, rx, ry, rz] no bell e no early. y <= 0.
const D = (b, e) => ({ b, e });

export const RARE_IDLE_AFTER = 8; // segundos parado, fora de tiro/recarga/mira/inspeção
export const KILL_TIME = 0.38;
export const EGG_P = 0.08;

const FLAIR = {
  // Fuzil Pururuca: gira no dedo antes de encaixar. No ovo raro, o giro é um pião.
  rifle: {
    draw: D(P(0, -0.02, 0, 0.05, 0.15, 0.2), P(0, -0.01, 0, 0, 1.15, 0.25)),
    recoil: { pitch: 1.15, z: 0.55, yaw: 0.12, roll: 0.04, recover: 7, wobble: 18 },
    bob: 1, loco: 0.03, jump: 0.05,
    rare: P(0, 0.012, 0, 0.04, 0.08, 0),
    kill: P(0, 0.01, 0, -0.04, 0.1, 0),
    inspect: P(0, 0.02, 0.03, 0.12, 0, 0),
    reload: { dip: 0.04, tilt: 0.06, pitch: 0, yaw: 0.04, slap: 0.5, slapPitch: 0.12 },
    brass: [0.09, 0.05, 0.02], heat: false, egg: 'fumaça em forma de porquinho',
    drawCue: [['whoosh', 0.12], ['click', 0.72]],
    inspectCue: [['cloth', 0.2]],
    rareCue: 'tap',
  },
  // Calibre 12: a telha bate pra frente no saque, como quem engatilha com raiva.
  shotgun: {
    draw: D(P(0, -0.045, -0.06, 0.2, 0, 0.15), P(0, -0.02, 0.05, -0.15, 0.1, 0)),
    recoil: { pitch: 2.1, z: 0.9, yaw: 0.02, roll: 0.1, recover: 3.2, wobble: 8 },
    bob: 1.25, loco: 0.06, jump: 0.09,
    rare: P(0, -0.01, 0.02, 0.08, 0, 0.06),
    kill: P(0, 0, -0.02, 0.1, 0, 0),
    inspect: P(0, -0.02, 0.04, -0.16, 0, 0),
    reload: { dip: 0.06, tilt: 0.08, pitch: 0.04, yaw: 0, slap: 0.72, slapPitch: 0.1, wobble: 0.045 },
    brass: [0.08, 0.02, 0.05], heat: false, egg: 'cartucho escapa e volta com um tapa',
    drawCue: [['pump', 0.35]],
    inspectCue: [['blow', 0.25]],
    rareCue: 'pump',
  },
  // Sniper Torresmo: sopra o cano no saque. Na inspeção, o Docão dá uma mordida.
  sniper: {
    draw: D(P(0, -0.03, 0.02, -0.28, 0.05, 0.08), P(0, -0.015, 0, 0.12, 0, 0)),
    recoil: { pitch: 1.8, z: 0.7, yaw: 0, roll: 0.02, recover: 2.8, wobble: 6 },
    bob: 0.65, loco: 0.015, jump: 0.03,
    rare: P(0, 0.008, 0.02, -0.1, 0, 0),
    kill: P(0, 0.015, 0.02, -0.08, 0, 0),
    inspect: P(0, 0.07, 0.08, -0.35, 0, 0),
    reload: { dip: 0.02, tilt: 0, pitch: 0.05, yaw: -0.04, slap: 0.7, slapPitch: 0.08 },
    brass: [0.07, 0.04, 0.12], heat: false, egg: 'mordida no cano com nhac',
    drawCue: [['blow', 0.28], ['cloth', 0.62]],
    inspectCue: [['bite', 0.48]],
    rareCue: 'blow',
  },
  // Bazuca do Chiqueiro: chega pesada, sobe com esforço. Recarga ronca.
  bazooka: {
    draw: D(P(0, -0.07, 0, 0.18, 0.05, 0.45), P(0.02, -0.03, 0, 0.1, 0, -0.2)),
    recoil: { pitch: 2.4, z: 1.1, yaw: 0.04, roll: 0.12, recover: 2.4, wobble: 5 },
    bob: 1.45, loco: 0.07, jump: 0.11,
    rare: P(0, -0.015, 0, 0.06, 0.05, 0),
    kill: P(0, 0.01, 0, 0.05, 0.12, 0),
    inspect: P(0, -0.03, 0, 0.1, 0, 0),
    reload: { dip: 0.08, tilt: -0.06, pitch: 0.08, yaw: 0, slap: 0.8, slapPitch: 0.14 },
    brass: null, heat: false, egg: 'ronco de porco e fumaça de focinho',
    drawCue: [['grunt', 0.4]],
    inspectCue: [['oink', 0.45]],
    rareCue: 'oink',
  },
  // Pistolinha Leitão: gira no dedo, seca e rápida.
  pistol: {
    draw: D(P(0, -0.02, 0, 0, 0.2, 0.15), P(0, 0, 0, 0, 1.6, 0.2)),
    recoil: { pitch: 1.45, z: 0.7, yaw: 0.18, roll: 0.06, recover: 11, wobble: 26 },
    bob: 0.85, loco: 0.04, jump: 0.06,
    rare: P(0.01, 0.01, 0, 0, 0.2, 0.1),
    kill: P(0, 0.012, 0, -0.06, 0.14, 0),
    inspect: P(0, 0.03, 0.04, 0.2, 0, 0),
    reload: { dip: 0.03, tilt: 0.08, pitch: 0.02, yaw: 0.06, slap: 0.86, slapPitch: 0.1 },
    brass: [0.06, 0.04, -0.02], heat: false, egg: 'sopra a fumaça do cano',
    drawCue: [['whoosh', 0.18]],
    inspectCue: [['whoosh', 0.3]],
    rareCue: 'blow',
  },
  // Canhão do Barril: rola até a mão e é erguido com esforço. Bala emperrada leva tapa.
  canhao: {
    draw: D(P(0, -0.08, 0, 0.12, 0, 0.7), P(0, -0.04, 0, 0.2, 0.1, -0.35)),
    recoil: { pitch: 2.6, z: 1.2, yaw: 0.03, roll: 0.16, recover: 2.2, wobble: 4 },
    bob: 1.55, loco: 0.05, jump: 0.12,
    rare: P(0, -0.02, 0, 0.1, 0, 0.08),
    kill: P(0, -0.01, 0, 0.08, 0, 0),
    inspect: P(0, -0.04, 0, 0.14, 0, 0),
    reload: { dip: 0.1, tilt: 0.05, pitch: 0.06, yaw: 0.05, slap: 0.48, slapPitch: 0.22 },
    brass: [0.08, 0.05, 0.16], heat: false, egg: 'a bala emperra e leva um tapa',
    drawCue: [['grunt', 0.45], ['clunk', 0.78]],
    inspectCue: [['grunt', 0.35]],
    rareCue: 'grunt',
  },
  // Carabina da Granja: saque casual, assovia no idle raro.
  carabina: {
    draw: D(P(0, -0.025, 0, 0.08, 0.25, 0.12), P(0, -0.01, 0, 0, 0.35, 0)),
    recoil: { pitch: 1.05, z: 0.45, yaw: 0.06, roll: 0.03, recover: 6.5, wobble: 14 },
    bob: 0.8, loco: 0.025, jump: 0.04,
    rare: P(0, 0.01, 0, -0.05, 0.06, 0),
    kill: P(0, 0.008, 0, -0.03, 0.05, 0),
    inspect: P(0, 0.015, 0.02, 0.08, 0, 0),
    reload: { dip: 0.03, tilt: 0.04, pitch: 0.03, yaw: -0.03, slap: 0.84, slapPitch: 0.06 },
    brass: [0.07, 0.045, 0.1], heat: false, egg: 'assovio de granja',
    drawCue: [['click', 0.7]],
    inspectCue: [['cloth', 0.4]],
    rareCue: 'whistle',
  },
  // Faca: o saque dela já é próprio (knifeAnim). Aqui ficam as variações de golpe e o idle.
  knife: {
    draw: D(P(), P()),
    recoil: { pitch: 0, z: 0, yaw: 0, roll: 0, recover: 6, wobble: 0 },
    bob: 0.7, loco: 0.05, jump: 0.04,
    rare: P(0, 0.01, 0, 0, 0, 0.15),
    kill: P(0, 0, 0, 0, 0, 0.2),
    inspect: P(0, 0.01, 0, 0, 0, 0),
    reload: { dip: 0, tilt: 0, pitch: 0, yaw: 0 },
    brass: null, heat: false, egg: 'gireta extra no dedo',
    drawCue: [],
    inspectCue: [],
    rareCue: 'whoosh',
  },
  // Sabre: acende com um corte no ar. Os golpes variam em saberCut.
  sabre: {
    draw: D(P(0, -0.03, 0, 0, 0.3, 0.35), P(0, -0.01, 0, 0.15, 0.4, -0.2)),
    recoil: { pitch: 0, z: 0, yaw: 0, roll: 0, recover: 6, wobble: 0 },
    bob: 0.75, loco: 0.04, jump: 0.05,
    rare: P(0, 0.012, 0, 0, 0.1, 0.12),
    kill: P(0, 0.02, 0, -0.15, 0, 0),
    inspect: P(0, 0.02, 0, -0.1, 0, 0),
    reload: { dip: 0, tilt: 0, pitch: 0, yaw: 0 },
    brass: null, heat: false, egg: 'corta o ar duas vezes',
    drawCue: [['whoosh', 0.2], ['whoosh', 0.55]],
    inspectCue: [['hum', 0.4]],
    rareCue: 'hum',
  },
  // MP5K: entra de lado, estilo "já tô atirando".
  uzi: {
    draw: D(P(0.02, -0.03, 0, 0.05, -0.2, 0.35), P(0, -0.01, 0, 0, 0.45, -0.1)),
    recoil: { pitch: 0.85, z: 0.4, yaw: 0.22, roll: 0.08, recover: 9, wobble: 30 },
    bob: 1.1, loco: 0.05, jump: 0.06,
    rare: P(0, 0, 0, 0.03, 0.06, 0.08),
    kill: P(0, 0.008, 0, 0.04, 0.08, 0),
    inspect: P(0.02, 0.01, 0, 0.06, 0, 0),
    reload: { dip: 0.04, tilt: 0.1, pitch: 0, yaw: -0.08, slap: 0.7, slapPitch: 0.08 },
    brass: [0.08, 0.04, 0.02], heat: false, egg: 'bate o pente na palma',
    drawCue: [['click', 0.65]],
    inspectCue: [['tap', 0.35]],
    rareCue: 'tap',
  },
  // P90: mostra o pente de cima, estável na corrida.
  p90: {
    draw: D(P(0, -0.02, 0, -0.2, 0.1, 0.1), P(0, -0.01, 0, 0.08, 0, 0)),
    recoil: { pitch: 0.7, z: 0.35, yaw: 0.08, roll: 0.03, recover: 8, wobble: 16 },
    bob: 0.9, loco: 0.02, jump: 0.04,
    rare: P(0, 0.016, 0, -0.06, 0, 0),
    kill: P(0, 0.01, 0, -0.04, 0, 0),
    inspect: P(0, 0.03, 0, -0.12, 0, 0),
    reload: { dip: 0.02, tilt: -0.06, pitch: 0.06, yaw: 0, slap: 0.66, slapPitch: 0.07 },
    brass: [0.07, 0.02, 0.16], heat: false, egg: 'o pente de cima dá uma voltinha',
    drawCue: [['click', 0.6]],
    inspectCue: [['tap', 0.5]],
    rareCue: 'tap',
  },
  // Furadeira: o saque dá uma acelerada na broca.
  prego: {
    draw: D(P(0, -0.02, -0.02, 0.1, 0, 0.2), P(0, -0.01, 0, 0, 0.3, 0)),
    recoil: { pitch: 0.6, z: 0.35, yaw: 0.04, roll: 0.05, recover: 10, wobble: 40 },
    bob: 0.95, loco: 0.03, jump: 0.04,
    rare: P(0, 0, -0.01, 0.05, 0.04, 0.1),
    kill: P(0, 0, 0, 0.06, 0, 0.08),
    inspect: P(0, 0.01, -0.02, 0.1, 0, 0),
    reload: { dip: 0.03, tilt: 0.05, pitch: 0, yaw: -0.06, slap: 0.7, slapPitch: 0.06 },
    brass: null, heat: false, egg: 'a broca dispara sozinha um tiquinho',
    drawCue: [['buzz', 0.3]],
    inspectCue: [['buzz', 0.45]],
    rareCue: 'buzz',
  },
  // Semi: ombro firme, coice mais curto que a pump.
  semi: {
    draw: D(P(0, -0.035, 0, 0.16, 0.05, 0.18), P(0, -0.01, 0, 0, 0, 0.08)),
    recoil: { pitch: 1.5, z: 0.65, yaw: 0.06, roll: 0.07, recover: 5, wobble: 12 },
    bob: 1.15, loco: 0.045, jump: 0.07,
    rare: P(0, 0, 0, 0.05, 0, 0.05),
    kill: P(0, 0, -0.01, 0.07, 0, 0),
    inspect: P(0, -0.01, 0.02, 0.08, 0, 0),
    reload: { dip: 0.05, tilt: 0.07, pitch: 0.03, yaw: 0.04, slap: 0.7, slapPitch: 0.1 },
    brass: [0.09, 0.04, 0.06], heat: false, egg: 'um cartucho vazio pula e é pego',
    drawCue: [['clunk', 0.55]],
    inspectCue: [['tap', 0.4]],
    rareCue: 'click',
  },
  // Besta: a corda sobe até a boca (puxada com os dentes) no meio do saque.
  besta: {
    draw: D(P(0, -0.02, 0.03, -0.22, 0, 0.12), P(0, -0.025, 0.02, -0.15, 0, 0)),
    recoil: { pitch: 1.3, z: 0.4, yaw: 0, roll: 0.02, recover: 5, wobble: 9 },
    bob: 0.8, loco: 0.02, jump: 0.04,
    rare: P(0, 0.01, 0, -0.08, 0, 0.04),
    kill: P(0, 0.01, 0, -0.05, 0, 0),
    inspect: P(0, 0.04, 0.05, -0.22, 0, 0),
    reload: { dip: 0.04, tilt: 0.06, pitch: -0.08, yaw: 0, slap: 0.42, slapPitch: -0.12 },
    brass: null, heat: false, egg: 'a corda é puxada com os dentes',
    drawCue: [['bite', 0.4], ['twang', 0.72]],
    inspectCue: [['twang', 0.5]],
    rareCue: 'twang',
  },
  // Arco: encaixa a flecha com um gesto largo.
  arco: {
    draw: D(P(0, -0.02, 0, -0.1, 0.15, -0.12), P(0, -0.01, 0, 0, -0.2, 0.1)),
    recoil: { pitch: 0.8, z: 0.3, yaw: 0, roll: 0.03, recover: 7, wobble: 10 },
    bob: 0.75, loco: 0.03, jump: 0.045,
    rare: P(0, 0.012, 0, -0.06, 0.08, 0),
    kill: P(0, 0.015, 0, -0.1, 0, 0),
    inspect: P(0, 0.05, 0, -0.25, 0, 0),
    reload: { dip: 0.03, tilt: 0, pitch: -0.06, yaw: 0.05, slap: 0.8, slapPitch: 0.04 },
    brass: null, heat: false, egg: 'mira pro céu e pisca',
    drawCue: [['twang', 0.6]],
    inspectCue: [['twang', 0.42]],
    rareCue: 'twang',
  },
  // FAMAS: apresenta a traseira (o pente mora lá atrás).
  famas: {
    draw: D(P(0, -0.03, 0, -0.12, -0.15, 0.22), P(0, -0.01, 0, 0.06, 0.2, 0)),
    recoil: { pitch: 0.9, z: 0.4, yaw: 0.05, roll: 0.04, recover: 8, wobble: 22 },
    bob: 1, loco: 0.03, jump: 0.05,
    rare: P(0, 0.008, 0, 0.04, -0.06, 0),
    kill: P(0, 0.006, 0, 0.03, 0, 0),
    inspect: P(0, -0.02, 0.02, -0.08, 0, 0),
    reload: { dip: 0.03, tilt: 0.05, pitch: -0.04, yaw: -0.05, slap: 0.7, slapPitch: 0.09 },
    brass: null, heat: false, egg: 'três toquinhos na alça, um por tiro da rajada',
    drawCue: [['click', 0.62]],
    inspectCue: [['tap', 0.3], ['tap', 0.42], ['tap', 0.54]],
    rareCue: 'tap',
  },
  // Ray Gun: pulso curto, sem cápsula. A arma é compacta e quase não sobe.
  ray: {
    draw: D(P(0, -0.025, 0, -0.08, 0.12, 0.08), P(0, -0.01, 0, 0.02, 0.2, 0)),
    recoil: { pitch: 0.45, z: 0.22, yaw: 0.02, roll: 0.03, recover: 9, wobble: 8 },
    bob: 0.75, loco: 0.02, jump: 0.04,
    rare: P(0, 0.01, 0, 0.02, 0.06, 0),
    kill: P(0, 0.008, 0, 0.02, 0.04, 0),
    inspect: P(0, 0.02, 0.02, -0.06, 0, 0),
    reload: { dip: 0.03, tilt: 0.04, pitch: 0.05, yaw: 0.04, slap: 0.72, slapPitch: 0.06 },
    brass: null, heat: false, egg: 'a câmara pisca e assenta',
    drawCue: [['hum', 0.35], ['boop', 0.62]],
    inspectCue: [['hum', 0.4]],
    rareCue: 'hum',
  },
  // Disco Voador: o disco sobe girando até o berço.
  disco: {
    draw: D(P(0, -0.03, 0, -0.1, 0.2, 0.15), P(0, -0.02, 0, 0, 0.5, 0)),
    recoil: { pitch: 0.7, z: 0.3, yaw: 0.1, roll: 0.12, recover: 6, wobble: 11 },
    bob: 0.9, loco: 0.04, jump: 0.05,
    rare: P(0, 0.02, 0, 0, 0.15, 0.1),
    kill: P(0, 0.02, 0, 0, 0.2, 0),
    inspect: P(0, 0.04, 0, -0.1, 0, 0),
    reload: { dip: 0.04, tilt: 0.05, pitch: 0.08, yaw: 0.06, slap: 0.74, slapPitch: 0.08 },
    brass: null, heat: false, egg: 'o disco dá um loop antes de sentar',
    drawCue: [['whoosh', 0.25], ['boop', 0.7]],
    inspectCue: [['boop', 0.45]],
    rareCue: 'boop',
  },
  // Sabre Duplo: as duas lâminas se cruzam e abrem.
  sabre2: {
    draw: D(P(0, -0.035, 0, 0, 0, 0.4), P(0, -0.015, 0, 0, 0.2, -0.25)),
    recoil: { pitch: 0, z: 0, yaw: 0, roll: 0, recover: 6, wobble: 0 },
    bob: 0.85, loco: 0.055, jump: 0.05,
    rare: P(0, 0.01, 0, 0, 0, 0.18),
    kill: P(0, 0.02, 0, -0.12, 0, 0.1),
    inspect: P(0, 0.02, 0, -0.08, 0, 0),
    reload: { dip: 0, tilt: 0, pitch: 0, yaw: 0 },
    brass: null, heat: false, egg: 'as lâminas se cruzam na frente da cara',
    drawCue: [['whoosh', 0.22], ['hum', 0.6]],
    inspectCue: [['hum', 0.5]],
    rareCue: 'hum',
  },
  // Lança-Milho: uma volta de manivela no saque.
  milho: {
    draw: D(P(0, -0.03, 0, 0.1, 0.1, 0.2), P(0, -0.015, 0, 0, 0, 0.15)),
    recoil: { pitch: 1.1, z: 0.45, yaw: 0.05, roll: 0.06, recover: 5.5, wobble: 13 },
    bob: 1.05, loco: 0.04, jump: 0.06,
    rare: P(0, 0.012, 0, 0.05, 0.08, 0),
    kill: P(0, 0.01, 0, 0.06, 0.1, 0),
    inspect: P(0, 0.04, 0.02, -0.12, 0, 0),
    reload: { dip: 0.04, tilt: -0.05, pitch: 0.06, yaw: 0.04, slap: 0.64, slapPitch: 0.1 },
    brass: null, heat: false, egg: 'chacoalha a espiga na orelha',
    drawCue: [['crank', 0.4]],
    inspectCue: [['rattle', 0.35], ['crank', 0.6]],
    rareCue: 'pop',
  },
  // Estilingue de Ovo: chacoalha o ovo perto da orelha.
  estilingue: {
    draw: D(P(0.03, -0.01, 0.02, 0, 0.35, 0.1), P(0.02, -0.02, 0, -0.1, -0.2, 0.15)),
    recoil: { pitch: 0.55, z: 0.25, yaw: 0.04, roll: 0.08, recover: 8, wobble: 20 },
    bob: 0.8, loco: 0.035, jump: 0.05,
    rare: P(0.04, 0.02, 0, -0.12, 0.2, 0.12),
    kill: P(0.02, 0.015, 0, -0.08, 0.1, 0),
    inspect: P(0.05, 0.04, 0.02, -0.18, 0, 0),
    reload: { dip: 0.03, tilt: 0.05, pitch: -0.04, yaw: 0.08, slap: 0.55, slapPitch: 0.05, wobble: 0.03 },
    brass: null, heat: false, egg: 'o ovo quase escorrega e é salvo no ar',
    drawCue: [['rattle', 0.25], ['rattle', 0.45]],
    inspectCue: [['rattle', 0.3], ['rattle', 0.48]],
    rareCue: 'rattle',
  },
  // Minigun: pesada, canos já esquentam no main. Saque é um içar.
  minigun: {
    draw: D(P(0, -0.06, 0, 0.1, 0.05, 0.3), P(0, -0.03, 0, 0.12, 0, 0.1)),
    recoil: { pitch: 0.45, z: 0.25, yaw: 0.04, roll: 0.06, recover: 14, wobble: 48 },
    bob: 1.35, loco: 0.04, jump: 0.1,
    rare: P(0, -0.008, 0, 0.03, 0.04, 0.05),
    kill: P(0, 0, 0, 0.03, 0, 0.04),
    inspect: P(0, -0.02, 0, 0.06, 0, 0),
    reload: { dip: 0.06, tilt: -0.08, pitch: 0.04, yaw: 0.04, slap: 0.7, slapPitch: 0.1 },
    brass: null, heat: true, egg: 'os canos desenham um porquinho de fumaça',
    drawCue: [['grunt', 0.35], ['spin', 0.7]],
    inspectCue: [['spin', 0.4]],
    rareCue: 'spin',
  },
  // Metralhadora: fita, bipé e cano que esquenta (heat).
  lmg: {
    draw: D(P(0, -0.05, 0, 0.14, 0, 0.28), P(0, -0.02, 0, 0.06, 0.08, -0.1)),
    recoil: { pitch: 0.75, z: 0.4, yaw: 0.06, roll: 0.04, recover: 8.5, wobble: 24 },
    bob: 1.3, loco: 0.035, jump: 0.08,
    rare: P(0, -0.01, 0, 0.05, -0.06, 0),
    kill: P(0, 0.006, 0, 0.04, 0, 0),
    inspect: P(-0.01, -0.015, 0, 0.05, 0, 0),
    reload: { dip: 0.07, tilt: 0.08, pitch: 0.04, yaw: -0.06, slap: 0.74, slapPitch: 0.16 },
    brass: [0.1, 0.04, 0.08], heat: true, egg: 'um elo da fita emperra e leva um tapa',
    drawCue: [['clunk', 0.5]],
    inspectCue: [['tap', 0.4]],
    rareCue: 'tap',
  },
  // Commando: saque certinho e, de brincadeira, um aceno minúsculo depois do tiro (o coice de verdade é quase zero).
  commando: {
    draw: D(P(0, -0.015, 0, 0.04, 0.08, 0.08), P(0, -0.02, 0, 0, 0.9, 0.15)),
    recoil: { pitch: 0.35, z: 0.2, yaw: 0, roll: 0, recover: 14, wobble: 0, nod: true },
    bob: 0.7, loco: 0.012, jump: 0.025,
    rare: P(0, 0.006, 0.01, -0.04, 0, 0),
    kill: P(0, 0.008, 0, -0.03, 0.04, 0),
    inspect: P(0, 0.01, 0.03, 0.06, 0, 0),
    reload: { dip: 0.02, tilt: 0.04, pitch: 0, yaw: 0.03, slap: 0.88, slapPitch: 0.05 },
    brass: [0.07, 0.045, 0.04], heat: false, egg: 'tira um cisco do cano com o dedinho',
    drawCue: [['whoosh', 0.2], ['click', 0.75]],
    inspectCue: [['blow', 0.55]],
    rareCue: 'blow',
  },
  // Revólver do Capataz: o giro no dedo mora no viewmodel. Aqui só um coice curto e um saque baixo, pra não brigar com o tambor.
  capataz: {
    draw: D(P(0, -0.012, 0, 0.04, 0.06, 0.05), P(0, -0.008, 0, 0, 0.2, 0.04)),
    recoil: { pitch: 1.7, z: 0.72, yaw: 0.08, roll: 0.05, recover: 5.2, wobble: 10 },
    bob: 0.85, loco: 0.02, jump: 0.04,
    rare: P(0, -0.006, 0.01, 0.05, 0.04, 0),
    kill: P(0, 0.008, 0, -0.04, 0.06, 0),
    inspect: P(0, 0.012, 0.02, 0.05, 0, 0),
    reload: { dip: 0.02, tilt: 0.03, pitch: 0.02, yaw: 0.02, slap: 0.72, slapPitch: 0.06 },
    brass: null, heat: false, egg: 'o tambor dá uma volta a mais',
    drawCue: [['whoosh', 0.18], ['click', 0.7]],
    inspectCue: [['click', 0.4]],
    rareCue: 'click',
  },
  // Dois Capatazes: o mesmo tempero, um pouco mais largo, porque as duas mãos já ocupam o quadro.
  capataz2: {
    draw: D(P(0, -0.016, 0, 0.05, 0, 0.08), P(0, -0.01, 0, 0, 0.12, -0.06)),
    recoil: { pitch: 1.35, z: 0.55, yaw: 0.1, roll: 0.08, recover: 6, wobble: 12 },
    bob: 0.95, loco: 0.028, jump: 0.05,
    rare: P(0, -0.008, 0, 0.04, -0.05, 0.03),
    kill: P(0, 0.006, 0, 0.03, 0, 0.04),
    inspect: P(0, 0.01, 0.015, 0.04, 0, 0),
    reload: { dip: 0.025, tilt: 0.04, pitch: 0.02, yaw: -0.03, slap: 0.66, slapPitch: 0.05 },
    brass: null, heat: false, egg: 'os dois tambores batem juntos',
    drawCue: [['whoosh', 0.16], ['click', 0.62]],
    inspectCue: [['click', 0.35]],
    rareCue: 'click',
  },
  // Tampa do Tacho: a pose de escudo reescreve o root. A curva existe pra o teste e pro coice não cair no fuzil.
  tampa: {
    draw: D(P(0, -0.02, 0, 0.06, 0.04, 0.08), P(0, -0.01, 0, 0, 0.1, 0.04)),
    recoil: { pitch: 0.4, z: 0.15, yaw: 0, roll: 0, recover: 6, wobble: 0 },
    bob: 0.55, loco: 0.01, jump: 0.02,
    rare: P(0, -0.006, 0, 0.03, 0, 0.02),
    kill: P(0, 0.006, 0, -0.03, 0, 0),
    inspect: P(0, 0.01, 0.02, 0.04, 0, 0),
    reload: { dip: 0, tilt: 0, pitch: 0, yaw: 0 },
    brass: null, heat: false, egg: 'a tampa range no cabo',
    drawCue: [['clunk', 0.4]],
    inspectCue: [['tap', 0.45]],
    rareCue: 'tap',
  },
};

export const FLAIR_KEYS = Object.keys(FLAIR);
export function flairOf(key) { return FLAIR[key] || FLAIR.rifle; }

function mixDraw(spec, k, variant) {
  const b = bell(k), e = early(k);
  const egg = variant >= 2 ? 1.45 : variant === 1 ? 1.12 : 1;
  const p = add(add(ZERO, spec.b, b), spec.e, e * egg);
  if (p.y > 0) p.y = 0;
  return p;
}

export function drawFlair(key, k, variant = 0) {
  return mixDraw(flairOf(key).draw, k, variant);
}

export function recoilRecover(key) { return flairOf(key).recoil.recover; }
export function bobMul(key) { return flairOf(key).bob; }
export function ejectsBrass(key) { return !!flairOf(key).brass; }
export function brassPort(key) { return flairOf(key).brass; }
export function heatsBarrel(key) { return !!flairOf(key).heat; }
export function eggLine(key) { return flairOf(key).egg; }
export function drawCues(key) { return flairOf(key).drawCue || []; }
export function inspectCues(key) { return flairOf(key).inspectCue || []; }
export function rareCue(key) { return flairOf(key).rareCue || 'tap'; }

// kick = escalar que o jogo já decai. age = segundos desde o último tiro. ads 0..1 tira o que sujaria a mira.
export function recoilFlair(key, kick, age, ads) {
  const r = flairOf(key).recoil;
  const k = Math.max(0, kick || 0);
  if (k <= 0) return ZERO;
  const wob = r.wobble ? Math.sin(Math.min(age, 0.25) * r.wobble) * (1 - clamp01(age / 0.25)) : 0;
  const nod = r.nod ? Math.sin(ss(0.08, 0.16, age) * Math.PI) * (1 - ss(0.16, 0.28, age)) : 0;
  const hip = 1 - clamp01(ads);
  return P(0, 0, k * r.z * (1 - ads * 0.5), k * (r.pitch + nod * 6), k * r.yaw * wob * hip, k * r.roll * (0.35 + 0.65 * Math.abs(wob)) * hip);
}

export function idleFlair(key, time) {
  const f = flairOf(key);
  const s = Math.sin(time * 1.7 + (key.length % 5));
  const c = Math.cos(time * 1.15);
  return P(c * 0.0012, s * 0.0016, 0, s * 0.004, 0, c * 0.003 * Math.min(1, f.loco * 20));
}

export function rareFlair(key, k, egg) {
  const base = flairOf(key).rare;
  const env = bell(k);
  const scale = egg ? 1.8 : 1;
  const wob = egg ? Math.sin(k * Math.PI * 6) * 0.02 * env : 0;
  return P(base.x * env * scale + wob, base.y * env * scale, base.z * env * scale, base.rx * env * scale, base.ry * env * scale + wob, base.rz * env * scale);
}

export function locoFlair(key, phase, speed, air, ads) {
  const f = flairOf(key);
  const hip = (1 - clamp01(ads)) * clamp01(speed);
  const run = Math.sin(phase) * f.loco * hip;
  const hop = air * f.jump * (1 - clamp01(ads) * 0.75);
  return P(0, -Math.abs(air) * 0.012 * (1 - ads), 0, hop, 0, run);
}

export function killFlair(key, k) {
  const base = flairOf(key).kill;
  const env = Math.sin(clamp01(k) * Math.PI);
  return P(base.x * env, base.y * env, base.z * env, base.rx * env, base.ry * env, base.rz * env);
}

// Soma em cima da inspeção que já existe. ry e rz são sempre 0.
export function inspectFlair(key, k, egg) {
  const base = flairOf(key).inspect;
  const env = bell(k) * (0.65 + 0.35 * Math.sin(clamp01(k) * Math.PI));
  const scale = egg ? 1.35 : 1;
  const bite = (key === 'sniper' || key === 'canhao' || egg) ? Math.sin(ss(0.4, 0.55, k) * Math.PI) * (1 - ss(0.55, 0.7, k)) : 0;
  return P(base.x * env * scale, base.y * env * scale + bite * 0.04, base.z * env * scale, base.rx * env * scale - bite * 0.25, 0, 0);
}

export function reloadFlourish(key, k, variant = 0) {
  const r = flairOf(key).reload || {};
  const env = ss(0, 0.12, k) * (1 - ss(0.88, 1, k));
  const slapAt = r.slap ?? 0.7;
  const slap = ss(slapAt, slapAt + 0.03, k) * (1 - ss(slapAt + 0.03, slapAt + 0.12, k));
  const egg = variant > 0.92;
  const fumble = egg ? Math.sin(k * 50) * 0.03 * env : (variant > 0.5 ? Math.sin(k * 28) * 0.012 * env : 0);
  return {
    dip: (r.dip || 0) * env,
    tilt: (r.tilt || 0) * env + fumble,
    pitch: (r.pitch || 0) * env + slap * (r.slapPitch || 0),
    yaw: (r.yaw || 0) * env,
    wobble: (r.wobble || 0) * (egg ? 1.8 : 1) * Math.sin(k * Math.PI * 5),
    magSpin: egg ? (1 - ss(0.45, 0.72, k)) * Math.PI * 2 * ss(0.4, 0.5, k) : 0,
    slap,
  };
}

// Variações de golpe da faca. Variante 0 = o arco de hoje (extra zero). Some no começo e no fim.
export function knifeExtra(variant, k) {
  const t = clamp01(k);
  if (variant === 1) { // corte de cima pra baixo
    const e = Math.sin(t * Math.PI);
    return P(0.04 * e, 0.12 * e - 0.18 * Math.sin(ss(0.2, 0.55, t) * Math.PI), -0.06 * e, 0.45 * e, 0.2 * e, -0.35 * e);
  }
  if (variant === 2) { // revés, da esquerda
    const e = Math.sin(t * Math.PI);
    return P(-0.16 * e, 0.04 * e, -0.05 * e, 0.1 * e, -0.7 * e, 0.4 * e);
  }
  return ZERO;
}

// Cortes do sabre: 0 é o de hoje. 1 desce, 2 vem do outro lado, 3 (ovo) gira.
export function saberCutDir(variant) {
  if (variant === 1) return [-0.15, -0.9, -0.4];
  if (variant === 2) return [0.7, -0.2, -0.68];
  if (variant === 3) return [-0.4, 0.15, -0.85];
  return null; // null = direção original
}
export const SABER_VARIANTS = 4;

// Chacoalho do Copo Bomba na MÃO (não no copo que define a origem do arremesso).
export function cupHandShake(charge, time) {
  const k = clamp01(charge);
  return {
    x: Math.sin(time * 17) * 0.04 * k,
    z: Math.sin(time * 26) * (0.06 + 0.12 * k) * k, // sem carga, a mão fica quieta
    rattle: k > 0.2,
  };
}

// 3ª pessoa: tempero barato em cima da inclinação de recarga que já existe.
export function tpReloadExtra(key) {
  const map = {
    bazooka: { rx: -0.12, rz: 0 }, canhao: { rx: 0.08, rz: 0.1 }, shotgun: { rx: 0.05, rz: 0.12 },
    sniper: { rx: 0.06, rz: 0.08 }, lmg: { rx: 0.04, rz: 0.1 }, minigun: { rx: 0.05, rz: -0.12 },
    besta: { rx: -0.08, rz: 0.06 }, arco: { rx: -0.06, rz: 0 }, milho: { rx: 0.06, rz: -0.08 },
    disco: { rx: 0.05, rz: 0.1 }, estilingue: { rx: -0.04, rz: 0.08 },
  };
  return map[key] || { rx: 0.02, rz: 0.04 };
}
export function tpKickScale(key) {
  const r = flairOf(key).recoil;
  return 0.15 + r.pitch * 0.12;
}

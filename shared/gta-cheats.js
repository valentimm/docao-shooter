// Cheats no chat, no mesmo esquema do "minigun": o texto da mensagem liga o efeito.
// Valem em qualquer modo (Mata-mata, Gunfight, Survival, …), offline e online.
// O servidor é quem liga, conta o tempo e manda o estado no snapshot. O cliente só prevê o movimento.
//
// Códigos (palavra inteira, maiúsculas ou não):
//   CJ05 — mini tanque. Vida 1000 (10× os 100 de um Docão). Sai digitando de novo, ou quando a vida zera (morre / cai no Survival).
//   LGPD — jetpack no estilo ROCKETMAN. 18 s. Segura Espaço para subir. No fim, desce no máximo a 4 m/s até o chão.
//   BIG  — 3× o tamanho por 20 s (de novo desliga antes). A hitbox de tiro e de explosão cresce junto. A câmera sobe.
//   SUBIDO — chapado pelo resto da vida. De novo desliga. Morrer (e o down do Survival) acaba.
//            Não muda corpo, hitbox nem movimento. Empilha com LGPD e BIG.
//            CJ05 não apaga o SUBIDO: o tanque continua com 1000 de vida e o dano reduzido vale em cima.
//            Uma mensagem só aplica o primeiro código (CJ05, depois LGPD, BIG, SUBIDO).
import { HEIGHT, RADIUS, EYE, GRAV } from './rules.js';
import { BODY } from './combat.js';
import { HITBOXES } from './physics.js';

export const BASE_HP = 100;
export const W_TANK = -6; // killfeed: WEAPON_SHORT(-6) = 'Canhão'. Não entra no arsenal.

// Porta mais estreita dos mapas (ops de building / inner): 1,60 m de vão.
// A verga mais baixa que ainda é porta (não janela) e cabe um Docão em pé (altura 2,0) é 2,4 m;
// existe um vão de 1,8 m (door() em maps.js) por onde o Docão em pé não passa. O tanque passa nos dois.
export const NARROW_DOOR = 1.6;
export const SHORT_DOOR = 1.8;

export const TANK = {
  hp: BASE_HP * 10,
  height: 1.5, // < HEIGHT (2,0) e < o vão de 1,8 m
  radius: 0.68, // diâmetro 1,36 m: cabe no vão de 1,60 m com 12 cm de cada lado
  eye: 1.2, // POV na escotilha, olhando por cima do cano
  speed: 4.4,
  // canhão: projétil explosivo (a mesma conta do foguete), mais lento, um tiro a cada 1,25 s
  cannon: { rate: 1.25, speed: 16, radius: 5, maxDmg: 140, selfMul: 0.35, knock: 12, lift: 8 },
  // esferas de acerto: casco largo e baixo, cabeça do comandante pequena
  hit: [[0.55, 0.68, false], [1.28, 0.26, true]],
  capsule: { y0: 0.28, y1: 1.42, r: 0.68 },
};

export const JET = {
  time: 18,
  up: 11, // m/s segurando Espaço (chega suave, não é um pulo)
  sink: -2.4, // m/s com combustível e sem Espaço: ainda dá para descer no controle
  safeFall: 4, // m/s no máximo depois que o tempo acaba, até encostar no chão
  horiz: 7.2,
};

export const BIG = {
  scale: 3,
  time: 20,
  hit: HITBOXES.map(([y, r, head]) => [y * 3, r * 3, head]),
  capsule: { y0: BODY.y0 * 3, y1: BODY.y1 * 3, r: BODY.r * 3 },
};

// 25% menos dano (multiplicador 0,75). Dura a vida, não o relógio.
export const SUBIDO = {
  dmgMul: 0.75,
  lowHz: 680,
  sway: 0.018,
  bob: 0.035,
  wave: 0.022,
  chroma: 0.006,
};

const word = (text, code) => new RegExp('\\b' + code + '\\b', 'i').test(String(text || ''));
export const isTankCode = (text) => word(text, 'CJ05');
export const isJetCode = (text) => word(text, 'LGPD');
export const isBigCode = (text) => word(text, 'BIG');
export const isSubidoCode = (text) => word(text, 'SUBIDO');

export function cheatEye(e) {
  if (!e) return EYE;
  if (e.tank) return TANK.eye;
  if (e.big) return EYE * BIG.scale;
  return EYE;
}

// Corpo usado na colisão com o mapa. Raio 0 = o raio normal (o BIG fica largo na hitbox de tiro, não na porta).
// Altura do BIG é 6 m: verga de porta normal (2,4–2,6 m) não deixa ele entrar.
export function syncCheatBody(e) {
  if (!e) return e;
  if (e.tank) {
    e.bodyH = TANK.height; e.bodyR = TANK.radius; e.hpCap = TANK.hp;
    e.cheatBody = TANK.capsule; e.hitSpheres = TANK.hit;
  } else if (e.big) {
    e.bodyH = HEIGHT * BIG.scale; e.bodyR = 0; e.hpCap = 0;
    e.cheatBody = BIG.capsule; e.hitSpheres = BIG.hit;
  } else {
    e.bodyH = 0; e.bodyR = 0; e.hpCap = 0;
    e.cheatBody = null; e.hitSpheres = null;
  }
  return e;
}

export function clearCheats(e) {
  if (!e) return;
  e.tank = false; e.jet = false; e.jetGlide = false; e.big = false; e.subido = false; e.fly = 0;
  e.jetUntil = 0; e.bigUntil = 0;
  syncCheatBody(e);
}

export function toggleTank(e) {
  if (e.tank) {
    e.tank = false;
    e.hp = Math.max(1, Math.min(BASE_HP, e.hp || BASE_HP));
    syncCheatBody(e);
    return 'Saiu do tanque';
  }
  e.jet = false; e.jetGlide = false; e.big = false; e.jetUntil = 0; e.bigUntil = 0;
  e.tank = true; e.crouch = 0; e.hp = TANK.hp;
  syncCheatBody(e);
  return 'CJ05 · tanque · 1000 de vida · clique atira o canhão · CJ05 de novo para sair';
}

export function grantJet(e, now) {
  if (e.tank) return 'O tanque não voa';
  if (e.jet || e.jetGlide) return ''; // não renova: o tempo é o tempo
  e.jet = true; e.jetGlide = false; e.jetUntil = now + JET.time; e.jetLeft = JET.time;
  return `LGPD · jetpack ${JET.time}s · segura Espaço para subir`;
}

export function toggleBig(e, now) {
  if (e.tank) return 'Sai do tanque primeiro (CJ05)';
  if (e.big) {
    e.big = false; e.bigUntil = 0; e.bigLeft = 0;
    syncCheatBody(e);
    return 'Voltou ao tamanho normal';
  }
  e.big = true; e.crouch = 0; e.bigUntil = now + BIG.time; e.bigLeft = BIG.time;
  syncCheatBody(e);
  return `BIG · 3× maior por ${BIG.time}s · BIG de novo para voltar`;
}

export function toggleSubido(e) {
  if (e.subido) { e.subido = false; return 'A brisa passou'; }
  e.subido = true;
  return 'SUBIDO · chapado até morrer · 25% menos dano · SUBIDO de novo desliga';
}

// Dano que o Docão toma. Sem SUBIDO, devolve o valor. Com SUBIDO, 75%.
export function subidoTaken(e, amount) {
  if (!e || !e.subido || !(amount > 0)) return amount;
  return amount * SUBIDO.dmgMul;
}

// Devolve a frase para o HUD, ou '' se o texto não era cheat. null se o Docão não pode usar agora.
export function applyCheatText(e, text, now) {
  if (!e || e.alive === false || e.down) return null;
  if (isTankCode(text)) return toggleTank(e);
  if (isJetCode(text)) return grantJet(e, now);
  if (isBigCode(text)) return toggleBig(e, now);
  if (isSubidoCode(text)) return toggleSubido(e);
  return '';
}

// Offline: o cliente conta o tempo. Online: o snapshot manda, e esta função não roda.
export function stepCheats(e, now, onGround) {
  if (!e) return;
  if (e.jet) {
    e.jetLeft = Math.max(0, (e.jetUntil || now) - now);
    if (now >= (e.jetUntil || 0)) { e.jet = false; e.jetLeft = 0; e.jetGlide = true; }
  }
  if (e.jetGlide && onGround) e.jetGlide = false;
  if (e.big) {
    e.bigLeft = Math.max(0, (e.bigUntil || now) - now);
    if (now >= (e.bigUntil || 0)) { e.big = false; e.bigLeft = 0; syncCheatBody(e); }
  }
}

// bits: 1 tanque, 2 jetpack com combustível, 4 grande, 8 descida do jetpack, 16 subido
export function packCheats(e, now) {
  const flags = (e.tank ? 1 : 0) | (e.jet ? 2 : 0) | (e.big ? 4 : 0) | (e.jetGlide ? 8 : 0) | (e.subido ? 16 : 0);
  const jetLeft = e.jet ? Math.max(0, (e.jetUntil || now) - now) : 0;
  const bigLeft = e.big ? Math.max(0, (e.bigUntil || now) - now) : 0;
  return [flags, jetLeft, bigLeft];
}

export function unpackCheats(e, flags, jetLeft, bigLeft) {
  if (!e || flags == null || flags === '') return;
  const f = flags | 0;
  e.tank = !!(f & 1); e.jet = !!(f & 2); e.big = !!(f & 4); e.jetGlide = !!(f & 8); e.subido = !!(f & 16);
  e.jetLeft = e.jet ? Math.max(0, +jetLeft || 0) : 0;
  e.bigLeft = e.big ? Math.max(0, +bigLeft || 0) : 0;
  if (e.tank || e.big) e.crouch = 0;
  syncCheatBody(e);
}

// Subida / descida do jetpack. fly = 1 pede para o movimento não somar a gravidade de novo.
export function jetVertical(e, holdJump, dt) {
  if (!e || e.tank) { if (e) e.fly = 0; return; }
  if (e.jet) {
    const target = holdJump ? JET.up : JET.sink;
    e.vel.y += (target - e.vel.y) * Math.min(1, 8 * dt);
    e.fly = 1;
    return;
  }
  if (e.jetGlide) {
    e.vel.y = Math.max(-JET.safeFall, e.vel.y + GRAV * dt);
    e.fly = 1;
    return;
  }
  e.fly = 0;
}

export function tankFitsDoors() {
  return TANK.height < HEIGHT && TANK.height < SHORT_DOOR && TANK.radius * 2 < NARROW_DOOR - 0.2 && TANK.radius > RADIUS;
}

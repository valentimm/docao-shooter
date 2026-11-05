// ============================================================
//  Survival: caído (down) e loadout guardado.
//  Só a variante Survival. A Invasão clássica e os outros modos não passam aqui.
//
//  Corações (regra JÁ existente em shared/invasion.js, INV.LIVES = 2):
//    Cada jogador começa com 2 vidas. onPlayerDeath gasta 1.
//    Com vida sobrando (2 → 1) a morte é a de sempre: tela de morte, renasce.
//    A morte que zeraria a vida (1 → 0, ou já 0) NÃO vira espectador na hora.
//    Entra em down. O gasto do último coração continua; não há coração novo,
//    loja de revive nem auto-revive.
//    Revivido por um amigo: continua com 0 corações. A próxima queda é down de novo.
//    Sangrar até o fim, ou todo mundo caído, usa o "fora" antigo (out + Ressurreição).
//
//  Integração (economia / IA de zumbi — não alterar esses sistemas daqui):
//    beginDown / finishRevive / bleed não debitam pontos, não chamam grantHit,
//    tryPap, tryWall, tryBoxPay nem refill de caixa.
//    A munição restaurada é a do snapshot. A pistola do chão usa downMag e não
//    escreve em mag/reserve.
//    Zumbi continua na IA atual. Dano extra enquanto down não mata: quem finaliza
//    é o timer (DOWN.bleed) ou DOWN.allDown quando ninguém está de pé.
//    Porta, Papada, barraca e poder são recusados enquanto down (o caller checa e.down).
// ============================================================
import { PISTOL, WEAPONS } from './rules.js';

export const DOWN = {
  bleed: 28,
  allDown: 1.2,
  speed: 0.22,
  range: 2.15,
  reachY: 1.5,
  hold: 3,
  key: 'KeyL',
  keyLabel: 'L',
  eye: 0.42,
  mag: WEAPONS[PISTOL].mag,
  pistol: PISTOL,
};

const copyKit = (k) => {
  const o = {};
  for (const [key, v] of Object.entries(k || {})) o[key] = v && typeof v === 'object' ? { ...v } : v;
  return o;
};

export function goesDown(e, startLives = 2) {
  if (!e || e.down || e.downFinal || e.bot || e.zt) return false;
  const n = e.lives == null ? startLives : e.lives;
  return n <= 1;
}

// Só armas. pts, points, _purse e purseN ficam de fora: a carteira é outra frente
// e um snapshot velho não pode devolver saldo nem escolher o maior dos dois campos.
export function snapshotLoadout(e) {
  return {
    slots: (e.slots || []).slice(),
    slotOn: (e.slotOn || [1, 1, 1]).slice(),
    weapon: e.weapon | 0,
    primary: e.primary | 0,
    secondary: e.secondary | 0,
    melee: e.melee | 0,
    nextPrimary: (e.nextPrimary ?? e.primary) | 0,
    nextSecondary: (e.nextSecondary ?? e.secondary) | 0,
    nextMelee: (e.nextMelee ?? e.melee) | 0,
    mag: (e.mag || []).slice(),
    reserve: (e.reserve || []).slice(),
    pap: { ...(e.pap || {}) },
    kit: copyKit(e.kit),
    drum: e.drum ? e.drum.slice() : null,
  };
}

export function restoreLoadout(e, s) {
  if (!e || !s) return false;
  const purse = { pts: e.pts, points: e.points, _purse: e._purse, purseN: e.purseN };
  e.slots = s.slots.slice();
  e.slotOn = s.slotOn.slice();
  e.weapon = s.weapon | 0;
  e.primary = s.primary | 0;
  e.secondary = s.secondary | 0;
  e.melee = s.melee | 0;
  e.nextPrimary = s.nextPrimary | 0;
  e.nextSecondary = s.nextSecondary | 0;
  e.nextMelee = s.nextMelee | 0;
  e.mag = s.mag.slice();
  e.reserve = s.reserve.slice();
  e.pap = { ...s.pap };
  e.kit = copyKit(s.kit);
  if (s.drum) e.drum = s.drum.slice();
  if (purse.pts !== undefined) e.pts = purse.pts;
  if (purse.points !== undefined) e.points = purse.points;
  if (purse._purse !== undefined) e._purse = purse._purse;
  if (purse.purseN !== undefined) e.purseN = purse.purseN;
  return true;
}

export function sameGuns(e, s) {
  if (!e || !s) return false;
  if ((e.weapon | 0) !== (s.weapon | 0)) return false;
  if (!e.slots || e.slots.length !== s.slots.length) return false;
  for (let i = 0; i < s.slots.length; i++) {
    if ((e.slots[i] | 0) !== (s.slots[i] | 0)) return false;
    if (e.slotOn && s.slotOn && (e.slotOn[i] ? 1 : 0) !== (s.slotOn[i] ? 1 : 0)) return false;
  }
  for (let i = 0; i < s.mag.length; i++) {
    if ((e.mag[i] | 0) !== (s.mag[i] | 0)) return false;
    if ((e.reserve[i] | 0) !== (s.reserve[i] | 0)) return false;
  }
  const pap = e.pap || {}, want = s.pap || {};
  const keys = new Set([...Object.keys(pap), ...Object.keys(want)]);
  for (const k of keys) if ((pap[k] | 0) !== (want[k] | 0)) return false;
  return true;
}

// 16 números: arma, 3 slots, bits dos slots, 3 pentes, 3 reservas, 3 tiers, 2 tambores.
export function packKeep(e) {
  const s = e.slots || [PISTOL, PISTOL, 7];
  const on = e.slotOn || [1, 1, 1];
  const mag = e.mag || [];
  const res = e.reserve || [];
  const pap = e.pap || {};
  const drum = e.drum || [];
  const bits = (on[0] ? 1 : 0) | (on[1] ? 2 : 0) | (on[2] ? 4 : 0);
  const d = (i) => drum[i] == null ? -1 : drum[i] | 0;
  return [e.weapon | 0, s[0] | 0, s[1] | 0, s[2] | 0, bits,
    mag[s[0]] | 0, mag[s[1]] | 0, mag[s[2]] | 0,
    res[s[0]] | 0, res[s[1]] | 0, res[s[2]] | 0,
    pap[s[0]] | 0, pap[s[1]] | 0, pap[s[2]] | 0,
    d(s[0]), d(s[1])];
}

export function applyKeep(e, pack) {
  if (!e || !pack || pack.length < 15) return false;
  const [w, a, b, c, bits, ma, mb, mc, ra, rb, rc, pa, pb, pc, da, db] = pack;
  if (!e.mag) e.mag = [];
  if (!e.reserve) e.reserve = [];
  e.slots = [a | 0, b | 0, c | 0];
  e.slotOn = [bits & 1 ? 1 : 0, bits & 2 ? 1 : 0, bits & 4 ? 1 : 0];
  e.primary = e.nextPrimary = a | 0;
  e.secondary = e.nextSecondary = b | 0;
  e.melee = e.nextMelee = c | 0;
  e.weapon = w | 0;
  e.mag[a | 0] = ma | 0; e.mag[b | 0] = mb | 0; e.mag[c | 0] = mc | 0;
  e.reserve[a | 0] = ra | 0; e.reserve[b | 0] = rb | 0; e.reserve[c | 0] = rc | 0;
  if (!e.pap) e.pap = {};
  e.pap[a | 0] = pa | 0; e.pap[b | 0] = pb | 0; e.pap[c | 0] = pc | 0;
  if (da >= 0 || db >= 0) {
    if (!e.drum) e.drum = [];
    if (da >= 0) e.drum[a | 0] = da | 0;
    if (db >= 0) e.drum[b | 0] = db | 0;
  }
  return true;
}

export function beginDown(e, T, startLives = 2) {
  if (!e || e.down) return false;
  e.loadSnap = snapshotLoadout(e);
  const before = e.lives == null ? startLives : e.lives;
  e.lives = before > 0 ? before - 1 : 0;
  e.out = false;
  e.down = true;
  e.downFinal = false;
  e.downUntil = T + DOWN.bleed;
  e.revP = 0;
  e.revBy = 0;
  e.downMag = DOWN.mag;
  e.crouch = 0;
  e.alive = true;
  if (!(e.hp > 0)) e.hp = 1;
  return true;
}

export function finishRevive(e) {
  if (!e) return false;
  const snap = e.loadSnap;
  restoreLoadout(e, snap);
  e.down = false;
  e.downFinal = false;
  e.revP = 0;
  e.revBy = 0;
  e.downMag = 0;
  e.out = false;
  e.alive = true;
  e.hp = 100;
  e.crouch = 0;
  return true;
}

export function clearDownFlags(e) {
  if (!e) return;
  e.down = false;
  e.downFinal = false;
  e.revP = 0;
  e.revBy = 0;
  e.revHold = false;
  e.downMag = 0;
  e.loadSnap = null;
}

export function losPoints(h, t) {
  const yaw = t.yaw || 0;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return {
    a: { x: h.pos.x, y: (h.pos.y || 0) + (h.down ? DOWN.eye : 1.55), z: h.pos.z },
    b: { x: t.pos.x + fx * 0.45, y: (t.pos.y || 0) + 0.32, z: t.pos.z + fz * 0.45 },
  };
}

function nearDown(h, t) {
  if (!h?.pos || !t?.pos) return false;
  const dx = h.pos.x - t.pos.x, dy = (h.pos.y || 0) - (t.pos.y || 0), dz = h.pos.z - t.pos.z;
  return Math.hypot(dx, dz) <= DOWN.range && Math.abs(dy) <= DOWN.reachY;
}

function holdOk(h, t, losClear) {
  if (!h || !t || h === t) return false;
  if (!h.alive || h.down || !h.revHold) return false;
  if (!t.alive || !t.down) return false;
  if (!nearDown(h, t)) return false;
  if (!losClear) return true;
  const pts = losPoints(h, t);
  return !!losClear(pts.a, pts.b);
}

// humans: jogadores da partida (vivos ou não). losClear(a, b) → bool, ou null.
// mem.allDownAt é o relógio de "ninguém de pé" (não encurta o sangramento de um solo).
export function stepDowned(humans, dt, T, losClear, mem = { allDownAt: 0 }) {
  const dtS = Math.max(0, dt || 0);
  const list = humans || [];
  const standing = [];
  const downed = [];
  for (const p of list) {
    if (!p || !p.alive) continue;
    if (p.down) downed.push(p); else standing.push(p);
  }
  const crowd = list.filter((p) => p && (p.alive || p.down)).length;
  if (crowd >= 2 && standing.length === 0 && downed.length) {
    if (!mem.allDownAt) mem.allDownAt = T;
  } else mem.allDownAt = 0;

  const busy = new Set();
  for (const t of downed) {
    const h = t.revBy ? list.find((p) => p && p.id === t.revBy) : null;
    if (h && holdOk(h, t, losClear)) {
      busy.add(h.id);
      t.revP = Math.min(1, (t.revP || 0) + dtS / DOWN.hold);
    } else {
      t.revBy = 0;
      t.revP = 0;
    }
  }
  for (const h of standing) {
    if (!h.revHold || busy.has(h.id)) continue;
    let best = null, bd = Infinity;
    for (const t of downed) {
      if (t.revBy) continue;
      if (!holdOk(h, t, losClear)) continue;
      const d = Math.hypot(h.pos.x - t.pos.x, h.pos.z - t.pos.z);
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) continue;
    best.revBy = h.id;
    best.revP = Math.min(1, dtS / DOWN.hold);
    busy.add(h.id);
  }
  const up = [];
  const bleed = [];
  const seen = new Set();
  const allDown = !!(mem.allDownAt && T - mem.allDownAt >= DOWN.allDown);
  for (const t of downed) {
    if ((t.revP || 0) >= 1) { up.push(t); continue; }
    if (T >= (t.downUntil || 0) || allDown) {
      if (!seen.has(t.id)) { seen.add(t.id); bleed.push(t); }
    }
  }
  return { up, bleed, mem };
}

// ============================================================
//  Competitivo: plantar o botijão, com economia.
//  Times de 3 a 5. Primeiro a 13. 12 a 12 vai a dois.
//  Rodada de pistola no começo do mapa e sempre que troca quem planta e quem defende.
//  Colete e capacete só diminuem dano — não entram na skin.
//  Sem arma explosiva (bazuca, lança-milho, ray gun, saco de presentes). Copo Bomba, fumaça e flashbang se compram.
// ============================================================
import { WEAPONS, PRIMARIES, SECONDARIES, MELEES, PISTOL, KNIFE, CORN_W, NADE } from './rules.js';
import { GUN_EQUIP_KEYS } from './closet.js';

export const COMP = {
  mode: 'comp',
  MIN_SIDE: 3,
  MAX_SIDE: 5,
  WIN: 13,
  HALF: 12,
  OT_LEAD: 2,
  PREP: 15,
  START: 800,
  MAX_CASH: 16000,
  KILL: 300,
  WIN_PAY: 3250,
  PLANT: 300,
  DEFUSE: 300,
  LOSS: [1400, 1900, 2400, 2900, 3400],
  VEST: 650,
  HELM: 350,
  KIT: 1000,
  ARMOR: 100,
  NADE: 300,
  SMOKE: 300,
  FLASH: 200,
  NADE_MAX: NADE.max,
  SMOKE_MAX: 1,
  FLASH_MAX: 2,
  SMOKE_FUSE: 1.15,
  FLASH_FUSE: 1.45,
  FLASH_R: 22,
};

// Grana pra comprar. A pistolinha e a faca já nascem com o Docão (não estão na loja).
// Primárias caras ficam fora da rodada de pistola porque a rodada começa com START.
const PRICE = {
  11: 500, // furadeira
  19: 300, // estilingue
  14: 450, // arco
  13: 500, // besta
  23: 800, // revólver — gasta a grana inteira da pistola, sem colete
  24: 1600, // dois revólveres
  9: 1500, // MP5K
  12: 1300, // semi
  1: 1850, // calibre 12
  16: 1700, // disco
  10: 2350, // P90
  6: 2500, // carabina
  22: 2700, // commando
  0: 2900, // fuzil
  21: 3000, // metralhadora
  15: 3200, // FAMAS
  25: 1000, // tampa
  2: 4750, // sniper
  5: 5000, // canhão
  8: 0, // sabre
  17: 0, // sabre duplo
};

const BOOM = new Set(['bazooka', 'milho', 'ray', 'saco']);
export const isComp = (m) => m === COMP.mode;
export const isExplosiveWeapon = (id) => {
  const w = WEAPONS[id];
  return !w || BOOM.has(w.key) || id === 3 || id === CORN_W;
};
export const priceOf = (id) => (Object.prototype.hasOwnProperty.call(PRICE, id) ? PRICE[id] : null);
export const normSide = (v) => {
  const n = v | 0;
  return n >= COMP.MIN_SIDE && n <= COMP.MAX_SIDE ? n : COMP.MAX_SIDE;
};
export const sideSlots = (side) => normSide(side) * 2;

// Rodadas 1–12: Vermelho planta. 13–24: Azul planta. Depois, um lado por rodada até alguém abrir 2.
export function compAttackTeam(round) {
  const n = round | 0;
  if (n <= COMP.HALF) return 0;
  if (n <= COMP.HALF * 2) return 1;
  return (n - (COMP.HALF * 2 + 1)) % 2 === 0 ? 0 : 1;
}
export function isPistolRound(round) {
  const n = round | 0;
  if (n <= 1) return true;
  return compAttackTeam(n) !== compAttackTeam(n - 1);
}
export function compOver(score) {
  const a = score[0] | 0, b = score[1] | 0;
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi < COMP.WIN) return false;
  if (lo < COMP.HALF) return true;
  return hi - lo >= COMP.OT_LEAD;
}
export function armComp(S) {
  if (!S) return S;
  S.attackOf = compAttackTeam;
  S.matchOver = compOver;
  S.elim = true;
  S.prep = COMP.PREP;
  return S;
}

export function slotOf(id) {
  if (priceOf(id) == null || isExplosiveWeapon(id)) return -1;
  if (id !== PISTOL && PRIMARIES.includes(id)) return 0;
  if (SECONDARIES.includes(id)) return 1;
  if (MELEES.includes(id)) return 2;
  return -1;
}
const sidearm = (id) => id === PISTOL || SECONDARIES.includes(id);

export function fillGun(e, id) {
  const w = WEAPONS[id];
  if (!e || !w || !e.mag || !e.reserve) return;
  e.mag[id] = w.mag;
  e.reserve[id] = w.reserve;
}
export function stripToPistol(e) {
  e.primary = e.nextPrimary = PISTOL;
  e.secondary = e.nextSecondary = PISTOL;
  e.melee = e.nextMelee = KNIFE;
  e.slots = [PISTOL, PISTOL, KNIFE];
  e.weapon = PISTOL;
  fillGun(e, PISTOL);
  fillGun(e, KNIFE);
}
export function applyBuy(e, r) {
  if (!e || !r || !r.ok || r.id == null) return;
  const id = r.id;
  if (!e.slots || e.slots.length < 3) e.slots = [e.primary ?? PISTOL, e.secondary ?? PISTOL, e.melee ?? KNIFE];
  if (r.slot === 0) { e.primary = e.nextPrimary = id; e.slots[0] = id; e.weapon = id; }
  else if (r.slot === 1) {
    e.secondary = e.nextSecondary = id; e.slots[1] = id; e.weapon = id;
    if (sidearm(e.slots[0])) { e.primary = e.nextPrimary = id; e.slots[0] = id; }
  } else if (r.slot === 2) { e.melee = e.nextMelee = id; e.slots[2] = id; }
  fillGun(e, id);
}

function owns(e, id) {
  if (!e || !e.slots) return false;
  if (id === PISTOL) return e.slots[0] === PISTOL && e.slots[1] === PISTOL;
  return e.slots.includes(id);
}
export function buyWeapon(e, id, pistol) {
  const price = priceOf(id);
  const slot = slotOf(id);
  if (price == null || slot < 0) return { ok: false, why: 'Essa arma não entra no competitivo.' };
  if (pistol && slot === 0) return { ok: false, why: 'Rodada de pistola: só pistola, faca e proteção.' };
  if (owns(e, id)) return { ok: false, why: 'Você já está com isso.' };
  if ((e.cash | 0) < price) return { ok: false, why: 'Grana curta.' };
  e.cash = (e.cash | 0) - price;
  return { ok: true, id, slot, price };
}
export function buyArmor(e, kind) {
  if (!e) return { ok: false, why: 'Não deu.' };
  if (kind === 'vest') {
    if ((e.armor | 0) >= COMP.ARMOR) return { ok: false, why: 'O colete já está inteiro.' };
    if ((e.cash | 0) < COMP.VEST) return { ok: false, why: 'Grana curta.' };
    e.cash -= COMP.VEST; e.armor = COMP.ARMOR;
    return { ok: true, cost: COMP.VEST };
  }
  if (kind === 'helmet') {
    if (!(e.armor > 0)) return { ok: false, why: 'O capacete pede o colete.' };
    if (e.helmet) return { ok: false, why: 'Você já está de capacete.' };
    if ((e.cash | 0) < COMP.HELM) return { ok: false, why: 'Grana curta.' };
    e.cash -= COMP.HELM; e.helmet = true;
    return { ok: true, cost: COMP.HELM };
  }
  if (kind === 'kit') {
    if ((e.armor | 0) >= COMP.ARMOR && e.helmet) return { ok: false, why: 'Você já está protegido.' };
    const cost = (e.armor | 0) > 0 ? COMP.HELM : COMP.KIT;
    if ((e.cash | 0) < cost) return { ok: false, why: 'Grana curta.' };
    e.cash -= cost; e.armor = COMP.ARMOR; e.helmet = true;
    return { ok: true, cost };
  }
  return { ok: false, why: 'Não tem isso na loja.' };
}

const UTIL = {
  nade: ['nades', COMP.NADE, COMP.NADE_MAX],
  smoke: ['smokeNades', COMP.SMOKE, COMP.SMOKE_MAX],
  flash: ['flashNades', COMP.FLASH, COMP.FLASH_MAX],
};
export const utilKinds = () => Object.keys(UTIL);
export function buyUtil(e, kind) {
  const row = UTIL[kind];
  if (!e || !row) return { ok: false, why: 'Não tem isso na loja.' };
  const [key, price, max] = row;
  if ((e[key] | 0) >= max) return { ok: false, why: 'Já está no máximo.' };
  if ((e.cash | 0) < price) return { ok: false, why: 'Grana curta.' };
  e.cash -= price;
  e[key] = (e[key] | 0) + 1;
  return { ok: true, cost: price, kind, have: e[key] };
}
export function clearUtil(e) {
  if (!e) return;
  e.nades = 0; e.smokeNades = 0; e.flashNades = 0;
}
// Segundos de cegueira. dot é o quanto a vítima está virada para o estouro (1 de frente, -1 de costas).
export function flashSeconds(dist, dot) {
  const d = Math.max(0, Number(dist) || 0);
  if (d > COMP.FLASH_R) return 0;
  const near = 1 - d / COMP.FLASH_R;
  const look = dot > 0.35 ? 1 : dot > 0 ? 0.45 : 0.15;
  const s = 2.6 * near * look;
  return s < 0.2 ? 0 : Math.round(s * 10) / 10;
}

// Corpo com colete: metade do dano, e a metade sai do colete.
// Cabeça ignora o colete, a menos que tenha capacete. Colete zerou: o capacete cai junto.
export function mitigate(e, amount, head) {
  const dmg = Math.max(0, Number(amount) || 0);
  if (!e) return dmg;
  const armor = e.armor | 0;
  if (armor <= 0 || (head && !e.helmet)) return dmg;
  const absorbed = Math.min(armor, dmg * 0.5);
  e.armor = armor - absorbed;
  if (e.armor <= 0) { e.armor = 0; e.helmet = false; }
  return dmg - absorbed;
}

const capCash = (n) => Math.max(0, Math.min(COMP.MAX_CASH, n | 0));
export function payKill(e) {
  if (!e || (e.team !== 0 && e.team !== 1)) return 0;
  e.cash = capCash((e.cash | 0) + COMP.KILL);
  return COMP.KILL;
}
export function payObj(e, kind) {
  if (!e) return 0;
  const n = kind === 'defuse' ? COMP.DEFUSE : COMP.PLANT;
  e.cash = capCash((e.cash | 0) + n);
  return n;
}
export function payRound(ents, winner) {
  for (const e of ents) {
    if (!e || (e.team !== 0 && e.team !== 1)) continue;
    e.keepKit = !!e.alive;
    if (e.team === winner) { e.loss = 0; e.cash = capCash((e.cash | 0) + COMP.WIN_PAY); }
    else {
      const i = Math.min(COMP.LOSS.length - 1, e.loss | 0);
      e.cash = capCash((e.cash | 0) + COMP.LOSS[i]);
      e.loss = (e.loss | 0) + 1;
    }
  }
}

export function shopRows(pistol) {
  const ids = pistol ? [...SECONDARIES, ...MELEES] : [...PRIMARIES, ...SECONDARIES, ...MELEES];
  const rows = [];
  for (const id of ids) {
    if (id === PISTOL || priceOf(id) == null || isExplosiveWeapon(id)) continue;
    const w = WEAPONS[id];
    rows.push({ id, price: PRICE[id], slot: slotOf(id), name: w.short, cat: slotOf(id) === 0 ? 'Primária' : slotOf(id) === 1 ? 'Pistola' : 'Faca' });
  }
  return rows;
}
export function botShop(e) {
  const out = [];
  const pistol = !!e.pistolLock;
  if (!pistol && e.keepKit) {
    if (!((e.armor | 0) > 0)) out.push(buyArmor(e, 'vest'));
    if ((e.armor | 0) > 0 && !e.helmet) out.push(buyArmor(e, 'helmet'));
    return out.filter((r) => r && r.ok);
  }
  if (!pistol) {
    const guns = shopRows(false).filter((r) => r.slot === 0 && r.price <= (e.cash | 0)).sort((a, b) => b.price - a.price);
    if (guns.length) out.push(buyWeapon(e, guns[0].id, false));
  }
  if (!((e.armor | 0) > 0)) out.push(buyArmor(e, 'vest'));
  if (!pistol && (e.armor | 0) > 0 && !e.helmet) out.push(buyArmor(e, 'helmet'));
  return out.filter((r) => r && r.ok);
}
// Começo da rodada. Quem morreu perde arma e proteção e fica na pistolinha.
// Quem sobreviveu leva o que tinha, menos na rodada de pistola: aí todo mundo zera em 800.
export function compEnterRound(e, round) {
  const pistol = isPistolRound(round);
  e.pistolLock = pistol;
  if (!e.ownGuns) e.ownGuns = { ...(e.guns || {}) };
  const keepGun = !pistol && !!e.keepKit;
  if (!keepGun) e.guns = { ...e.ownGuns };
  if (pistol) {
    e.cash = COMP.START;
    stripToPistol(e);
    e.armor = 0; e.helmet = false;
    clearUtil(e);
  } else if (!e.keepKit) {
    stripToPistol(e);
    e.armor = 0; e.helmet = false;
    clearUtil(e);
  }
  if (e.bot) for (const r of botShop(e)) if (r.id != null) applyBuy(e, r);
  if (!e.slots) e.slots = [PISTOL, PISTOL, KNIFE];
  if (!e.slots.includes(e.weapon)) e.weapon = e.slots[0];
  e.keepKit = false;
  return e;
}

const firearm = (id) => {
  const w = WEAPONS[id];
  return !!(w && !w.melee && !w.shield);
};
export function skinKeyOf(id) {
  const w = WEAPONS[id];
  return w && GUN_EQUIP_KEYS.includes(w.key) ? w.key : '';
}
export function deathGun(e) {
  if (!e) return -1;
  if (firearm(e.weapon)) return e.weapon;
  const p = e.slots && e.slots[0];
  return firearm(p) ? p : -1;
}
export function primaryGun(e) {
  const id = e && e.slots && e.slots[0];
  return slotOf(id) === 0 ? id : -1;
}
export function packGun(e, id) {
  const key = skinKeyOf(id);
  const w = WEAPONS[id] || {};
  return {
    w: id,
    skin: key && e.guns ? (e.guns[key] || '') : '',
    mag: e.mag ? (e.mag[id] | 0) : (w.mag | 0),
    reserve: e.reserve ? (e.reserve[id] | 0) : (w.reserve | 0),
  };
}
export function tossSpot(pos, yaw, pitch, groundAt) {
  const cy = Math.cos(pitch || 0);
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let x = pos.x + fx * 0.55, y = (pos.y || 0) + 1.15, z = pos.z + fz * 0.55;
  let vx = fx * cy * 7.4, vy = 3.1 + Math.sin(pitch || 0) * 2.2, vz = fz * cy * 7.4;
  const gfn = groundAt || (() => 0);
  for (let i = 0; i < 28; i++) {
    vy -= 24 * 0.045;
    x += vx * 0.045; y += vy * 0.045; z += vz * 0.045;
    const g = gfn(x, z, y + 1);
    if (y <= g + 0.16) return { x: +x.toFixed(2), y: +(g + 0.14).toFixed(2), z: +z.toFixed(2) };
  }
  const g = gfn(x, z, y + 1);
  return { x: +x.toFixed(2), y: +(g + 0.14).toFixed(2), z: +z.toFixed(2) };
}
export function dropFromHand(e, id) {
  const slot = slotOf(id);
  if (!e || slot < 0 || slot > 1) return null;
  const packed = packGun(e, id);
  if (slot === 0) { e.slots[0] = PISTOL; e.primary = e.nextPrimary = PISTOL; fillGun(e, PISTOL); }
  else { e.slots[1] = PISTOL; e.secondary = e.nextSecondary = PISTOL; fillGun(e, PISTOL); }
  if (e.weapon === id) e.weapon = e.slots[0];
  return packed;
}
export function takeGun(e, drop) {
  const id = drop.w | 0;
  const slot = slotOf(id);
  if (!e || !e.alive || slot < 0 || slot > 1) return { ok: false };
  if (!e.slots) e.slots = [PISTOL, PISTOL, KNIFE];
  if (!e.guns) e.guns = {};
  if (!e.mag) e.mag = [];
  if (!e.reserve) e.reserve = [];
  const held = e.weapon;
  const out = firearm(held) ? held : (firearm(e.slots[slot]) ? e.slots[slot] : -1);
  const dumped = out >= 0 ? packGun(e, out) : null;
  const inKey = skinKeyOf(id);
  const outKey = out >= 0 ? skinKeyOf(out) : '';
  if (inKey) e.guns[inKey] = drop.skin || '';
  e.slots[slot] = id;
  if (slot === 0) e.primary = e.nextPrimary = id;
  if (slot === 1) e.secondary = e.nextSecondary = id;
  if (dumped && slotOf(dumped.w) !== slot) {
    const os = slotOf(dumped.w);
    if (os === 0) { e.slots[0] = PISTOL; e.primary = e.nextPrimary = PISTOL; fillGun(e, PISTOL); }
    else if (os === 1) { e.slots[1] = PISTOL; e.secondary = e.nextSecondary = PISTOL; fillGun(e, PISTOL); }
  }
  if (outKey && outKey !== inKey && !(e.slots || []).some((s) => skinKeyOf(s) === outKey)) delete e.guns[outKey];
  e.mag[id] = drop.mag | 0;
  e.reserve[id] = drop.reserve | 0;
  e.weapon = id;
  return { ok: true, dumped, inKey, outKey: outKey !== inKey ? outKey : '' };
}
export function utilCount(e, k) {
  if (!e) return 0;
  if (k === 'nade') return e.nades | 0;
  if (k === 'smoke') return e.smokeNades | 0;
  if (k === 'flash') return e.flashNades | 0;
  return 0;
}
export function compWheel(e) {
  const list = [{ t: 'gun', i: 0 }, { t: 'gun', i: 1 }, { t: 'gun', i: 2 }];
  if (utilCount(e, 'nade') > 0) list.push({ t: 'util', k: 'nade' });
  if (utilCount(e, 'smoke') > 0) list.push({ t: 'util', k: 'smoke' });
  if (utilCount(e, 'flash') > 0) list.push({ t: 'util', k: 'flash' });
  return list;
}

export function armorLabel(e) {
  if (!e || !(e.armor > 0)) return 'sem colete';
  return e.helmet ? `colete ${e.armor | 0} + capacete` : `colete ${e.armor | 0}`;
}
export function cashLabel(n) { return `$${n | 0}`; }

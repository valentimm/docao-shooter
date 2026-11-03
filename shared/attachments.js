// ============================================================
//  Peças da arma (bancada). Sem DOM e sem Three.js.
//  Cliente e servidor importam o mesmo módulo. Ninguém muta WEAPONS.
// ============================================================
import { WEAPONS, MELEE, PRIMARIES, SECONDARIES, MELEES, PISTOL, KNIFE, RED_DOT, isAssault } from './rules.js';
import { clampLoadout, normHand } from './loadout.js';

export const CLASS_COUNT = 5;

const RAJADA = new Set(['rifle', 'commando', 'lmg', 'uzi', 'p90', 'famas', 'pistol', 'prego']);
const ESCOPETA = new Set(['shotgun', 'semi']);
const PRECISAO = new Set(['sniper', 'canhao', 'carabina']);
const CORONHA = new Set(['rifle', 'commando', 'lmg', 'famas', 'shotgun', 'semi', 'sniper', 'canhao', 'carabina']);
const LEVE = new Set(['uzi', 'p90', 'pistol', 'prego']);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pt = (n, d) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export function weaponKey(i) { return WEAPONS[i] ? WEAPONS[i].key : ''; }

export function familyOf(i) {
  const k = weaponKey(i);
  if (RAJADA.has(k)) return 'rajada';
  if (ESCOPETA.has(k)) return 'escopeta';
  if (PRECISAO.has(k)) return 'precisao';
  return null;
}

function stockLabel(i) {
  const k = weaponKey(i);
  if (PRECISAO.has(k)) return 'Apoio';
  if (LEVE.has(k)) return 'Empunhadura';
  if (CORONHA.has(k)) return 'Coronha';
  return 'Mão';
}

export function slotsOf(i) {
  const f = familyOf(i);
  if (f === 'rajada') return [
    { id: 'optic', label: 'Mira' },
    { id: 'barrel', label: 'Cano' },
    { id: 'mag', label: 'Pente' },
    { id: 'stock', label: stockLabel(i) },
  ];
  if (f === 'escopeta') return [
    { id: 'barrel', label: 'Boca' },
    { id: 'stock', label: 'Coronha' },
    { id: 'mag', label: 'Cartucheira' },
  ];
  if (f === 'precisao') return [
    { id: 'optic', label: 'Luneta' },
    { id: 'barrel', label: 'Cano' },
    { id: 'mag', label: 'Pente' },
    { id: 'stock', label: 'Apoio' },
  ];
  return [];
}

const MIRA = [
  { id: '', name: 'Massa de milho', blurb: 'De fábrica. A mira que já veio.' },
  { id: 'arame', name: 'Alça de arame', blurb: 'Aproxima e fecha o tiro no botão direito. No quadril, abre um pouco.' },
  { id: 'barbante', name: 'Anel de barbante', blurb: 'Abre o campo. Acha o alvo mais rápido e fecha menos o tiro.' },
];
const RED_DOT_PIECE = {
  id: 'reddot', name: 'Red dot da granja',
  blurb: 'Ponto vermelho no trilho. Mirando, o coice da câmera cai 65%. No quadril, o fuzil recua como sempre.',
};
const LUNETA = [
  { id: '', name: 'Luneta da casa', blurb: 'A lente que a arma já tinha.' },
  { id: 'vidro', name: 'Vidro de conserva', blurb: 'Aproxima mais. Sem a luneta, espalha mais. Anda um pouco menos.' },
  { id: 'curta', name: 'Luneta curta da quermesse', blurb: 'Campo mais aberto. Mais fácil de achar o porco. Menos aumento.' },
];
const CANO = [
  { id: '', name: 'Cano da casa', blurb: 'O cano que já veio.' },
  { id: 'bica', name: 'Cano de bica', blurb: 'Mais curto: recua menos e atravessa menos tábua. Longe, o tiro amansa.' },
  { id: 'fogao', name: 'Cano de fogão', blurb: 'Mais longo: fura mais parede e segura a queda de quem já tinha. Recua mais e anda menos.' },
];
const BOCA = [
  { id: '', name: 'Boca da casa', blurb: 'O chumbo que você já conhece.' },
  { id: 'aberta', name: 'Boca aberta', blurb: 'Abre o leque. Perto, empurra a mesma vida. Longe, some mais rápido.' },
  { id: 'fechada', name: 'Boca fechada', blurb: 'Junta o chumbo. Alcança um palmo a mais. O ombro sente.' },
];
const PENTE = [
  { id: '', name: 'Pente de lata', blurb: 'De fábrica.' },
  { id: 'linguica', name: 'Fita de linguiça', blurb: 'Mais bala na arma. Demora mais para encher e pesa no passo.' },
  { id: 'bolso', name: 'Pente de bolso', blurb: 'Acaba logo. Volta para a briga mais cedo.' },
];
const CARTUCHO = [
  { id: '', name: 'Tubo da casa', blurb: 'Oito, do jeito da SPAS.' },
  { id: 'cartucheira', name: 'Cartucheira de lona', blurb: 'Dois cartuchos a mais. Cada um entra um pouco mais devagar.' },
  { id: 'curto', name: 'Tubo curto', blurb: 'Menos cartucho. O pump volta mais cedo.' },
];
const CABO = { id: '', name: 'Cabo da casa', blurb: 'O cabo que já veio.' };
const ENXADA = { id: 'enxada', name: 'Coronha de enxada', blurb: 'Firma o tiro. O passo encurta.' };
const SABUGO = { id: 'sabugo', name: 'Empunhadura de sabugo', blurb: 'Mais solta na mão. O cano sobe mais. Mirando, fecha um pouco.' };
const BIPE = { id: 'bipe', name: 'Tripé de ordenha', blurb: 'Parado na luneta, o balanço de quem anda cai pela metade. No quadril e no passo, piora.' };

export function piecesOf(i, slot) {
  const f = familyOf(i);
  const k = weaponKey(i);
  if (!f) return [];
  if (slot === 'optic') return f === 'precisao' ? LUNETA : f === 'rajada' ? (isAssault(i) ? [RED_DOT_PIECE, ...MIRA] : MIRA) : [];
  if (slot === 'barrel') return f === 'escopeta' ? BOCA : CANO;
  if (slot === 'mag') return f === 'escopeta' ? CARTUCHO : PENTE;
  if (slot === 'stock') {
    const list = [CABO];
    if (CORONHA.has(k)) list.push(ENXADA);
    if (CORONHA.has(k) || LEVE.has(k)) list.push(SABUGO);
    if (PRECISAO.has(k)) list.push(BIPE);
    return list;
  }
  return [];
}

export function pieceInfo(i, slot, id) {
  return piecesOf(i, slot).find((p) => p.id === id) || null;
}

export function pieceBlurb(i, slot, id) {
  const p = pieceInfo(i, slot, id);
  if (!p) return '';
  if (id === 'vidro' && WEAPONS[i] && WEAPONS[i].adsFov <= 8) return `${p.blurb} O zoom já está no talo.`;
  return p.blurb;
}

export function defaultKit(i) {
  const k = clampKit(i, {});
  if (isAssault(i)) k.optic = 'reddot';
  return k;
}
export function equippedKit(i, raw) {
  if (raw == null) return defaultKit(i);
  return clampKit(i, raw);
}
export function kitIsDefault(i, kit) {
  const d = defaultKit(i), k = clampKit(i, kit);
  return slotsOf(i).every((s) => (k[s.id] || '') === (d[s.id] || ''));
}
export function clampKit(i, kit) {
  const slots = slotsOf(i);
  if (!slots.length) return {};
  const src = kit && typeof kit === 'object' ? kit : {};
  const out = {};
  for (const s of slots) {
    const id = typeof src[s.id] === 'string' ? src[s.id] : '';
    out[s.id] = piecesOf(i, s.id).some((p) => p.id === id) ? id : '';
  }
  return out;
}

export function clampKitMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (let i = 0; i < WEAPONS.length; i++) {
    const key = WEAPONS[i].key;
    if (raw[key] == null || !familyOf(i)) continue;
    out[key] = clampKit(i, raw[key]);
  }
  return out;
}

function applyOptic(w, id) {
  if (id === 'reddot') {
    w.adsFov = RED_DOT.adsFov; w.adsSpread = RED_DOT.adsSpread;
    w.redDot = true; w.redDotAds = RED_DOT.ads; w.adsRecoil = RED_DOT.recoil;
  }
  else if (id === 'arame') { w.adsFov *= 0.85; w.adsSpread *= 0.75; w.spread *= 1.15; }
  else if (id === 'barbante') { w.adsFov *= 1.2; w.adsSpread *= 1.25; w.spread *= 0.9; }
  else if (id === 'vidro') { w.adsFov *= 0.75; w.move = (w.move ?? 1) * 0.92; w.hipMul = (w.hipMul || 1) * 1.25; }
  else if (id === 'curta') { w.adsFov *= 1.35; w.move = (w.move ?? 1) * 1.03; w.hipMul = (w.hipMul || 1) * 0.85; }
}
function applyBarrel(w, id, precision) {
  if (id === 'bica') {
    w.pen = (w.pen || 0) * 0.7; w.recoil *= 0.8; w.move = (w.move ?? 1) * 1.04;
    if (w.falloff) w.falloff = [w.falloff[0] * 0.8, w.falloff[1] * 0.85, w.falloff[2]];
    else if (!precision && w.range) w.falloff = [0.45 * w.range, 0.8 * w.range, 0.72];
  } else if (id === 'fogao') {
    w.pen = (w.pen || 0) * 1.3; w.recoil *= 1.25; w.move = (w.move ?? 1) * 0.94;
    if (w.falloff) w.falloff = [w.falloff[0] * 1.2, w.falloff[1] * 1.25, w.falloff[2]];
  } else if (id === 'aberta') {
    w.spread *= 1.25; w.recoil *= 0.85;
    if (w.falloff) w.falloff = [w.falloff[0] * 0.75, w.falloff[1], w.falloff[2]];
  } else if (id === 'fechada') {
    w.spread *= 0.75; w.recoil *= 1.1;
    if (w.falloff) w.falloff = [w.falloff[0], w.falloff[1] * 1.15, w.falloff[2]];
  }
}
function applyMag(w, id) {
  if (id === 'linguica') { w.mag = Math.round(w.mag * 1.5); w.reload *= 1.35; w.move = (w.move ?? 1) * 0.96; }
  else if (id === 'bolso') { w.mag = Math.max(1, Math.round(w.mag * 0.6)); w.reload *= 0.75; w.move = (w.move ?? 1) * 1.02; }
  else if (id === 'cartucheira') { w.mag += 2; w.reload *= 1.15; }
  else if (id === 'curto') { w.mag = Math.max(2, w.mag - 2); w.reload *= 0.85; }
}
function applyStock(w, id) {
  if (id === 'enxada') { w.recoil *= 0.75; w.move = (w.move ?? 1) * 0.95; }
  else if (id === 'sabugo') { w.recoil *= 1.15; w.adsSpread *= 0.85; w.move = (w.move ?? 1) * 1.03; }
  else if (id === 'bipe') { w.move = (w.move ?? 1) * 0.88; w.swayMul = (w.swayMul || 1) * 0.5; w.hipMul = (w.hipMul || 1) * 1.15; }
}

export function resolveWeapon(i, kit) {
  const base = WEAPONS[i];
  if (!base) return null;
  const w = { ...base };
  if (base.falloff) w.falloff = base.falloff.slice();
  if (base.knock) w.knock = { ...base.knock };
  if (!familyOf(i)) return w;
  const k = clampKit(i, kit);
  const precision = familyOf(i) === 'precisao';
  applyOptic(w, k.optic || '');
  applyBarrel(w, k.barrel || '', precision);
  applyMag(w, k.mag || '');
  applyStock(w, k.stock || '');
  w.adsFov = clamp(w.adsFov, 8, 70);
  w.pen = clamp(w.pen || 0, 0, 2.4);
  if (w.move != null) w.move = clamp(w.move, 0.75, 1.08);
  w.mag = Math.max(1, Math.round(w.mag));
  if (w.reload) w.reload = Math.max(0.3, w.reload);
  w.hipMul = w.hipMul || 1;
  w.swayMul = w.swayMul || 1;
  return w;
}

function pushDiff(rows, label, a, b, digits) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) < 1e-6) return;
  rows.push({ label, now: pt(a, digits), next: pt(b, digits) });
}

export function compare(before, after) {
  const rows = [];
  if (!before || !after) return rows;
  pushDiff(rows, 'aproxima', before.adsFov, after.adsFov, 0);
  pushDiff(rows, 'mirando', before.adsSpread, after.adsSpread, 2);
  pushDiff(rows, 'quadril', before.spread, after.spread, 3);
  pushDiff(rows, 'parede', before.pen || 0, after.pen || 0, 2);
  pushDiff(rows, 'recuo', before.recoil, after.recoil, 3);
  if (!!before.redDot !== !!after.redDot) rows.push({ label: 'coice mirando', now: before.redDot ? '65% menos' : 'normal', next: after.redDot ? '65% menos' : 'normal' });
  pushDiff(rows, 'passo', before.move ?? 1, after.move ?? 1, 2);
  pushDiff(rows, 'pente', before.mag, after.mag, 0);
  pushDiff(rows, 'recarga', before.reload, after.reload, 2);
  pushDiff(rows, 'sem luneta', before.hipMul || 1, after.hipMul || 1, 2);
  pushDiff(rows, 'balanço', before.swayMul || 1, after.swayMul || 1, 2);
  const bf = before.falloff, af = after.falloff;
  if (JSON.stringify(bf || null) !== JSON.stringify(af || null)) {
    const txt = (f) => (f ? `${pt(f[0], 0)}–${pt(f[1], 0)} m` : 'sem queda');
    rows.push({ label: 'queda', now: txt(bf), next: txt(af) });
  }
  return rows;
}

function shotsPerSec(w) {
  if (!w || !w.rate) return 0;
  if (w.burst > 1) {
    const cycle = (w.burstDelay || 0) + w.rate * (w.burst - 1);
    return cycle > 0 ? w.burst / cycle : 0;
  }
  return 1 / w.rate;
}
function moveOf(w) {
  if (!w) return 1;
  if (w.move != null) return w.move;
  if (w.key === 'knife') return MELEE.speedMul;
  return 1;
}

export function statBars(now, factory) {
  const dmgN = (w) => (w.dmg || 0) * Math.max(w.pellets || 0, 1);
  const dano = dmgN(now);
  const bars = [{
    id: 'dano', label: 'Dano', fill: Math.min(100, dano), tick: null,
    num: String(Math.round(dano)), note: '',
  }];
  if (!now.range) {
    bars.push({ id: 'alcance', label: 'Alcance', fill: 0, tick: null, num: '—', note: 'O verbo é outro.' });
  } else {
    const created = !!(now.falloff && !(factory && factory.falloff));
    const fill = (created ? now.falloff[0] : now.range) / 260 * 100;
    const tick = factory && factory.range ? factory.range / 260 * 100 : null;
    bars.push({
      id: 'alcance', label: 'Alcance', fill, tick: tick != null && Math.abs(tick - fill) > 0.6 ? tick : null,
      num: `${Math.round(created ? now.falloff[0] : now.range)} m`, note: created ? 'A queda começa antes do alcance de fábrica.' : '',
    });
  }
  const sps = shotsPerSec(now), sps0 = shotsPerSec(factory || now);
  bars.push({
    id: 'cadencia', label: 'Cadência', fill: Math.min(100, sps / 12 * 100),
    tick: Math.abs(sps - sps0) > 0.05 ? Math.min(100, sps0 / 12 * 100) : null,
    num: `${pt(sps, sps >= 10 ? 0 : 1)}/s`, note: '',
  });
  const mv = moveOf(now), mv0 = moveOf(factory || now);
  const mob = (m) => (m - 0.7) / 0.45 * 100;
  bars.push({
    id: 'mobilidade', label: 'Mobilidade', fill: mob(mv),
    tick: Math.abs(mv - mv0) > 0.005 ? mob(mv0) : null,
    num: pt(mv, 2), note: '',
  });
  const ctrl = (r) => (1 - (r || 0) / 0.1) * 100;
  bars.push({
    id: 'controle', label: 'Controle', fill: ctrl(now.recoil),
    tick: factory && Math.abs((now.recoil || 0) - (factory.recoil || 0)) > 1e-5 ? ctrl(factory.recoil) : null,
    num: pt(now.recoil || 0, 3), note: '',
  });
  for (const b of bars) {
    b.fill = clamp(b.fill, 0, 100);
    if (b.tick != null) b.tick = clamp(b.tick, 0, 100);
  }
  return bars;
}

export function clampClassIndex(n) {
  const i = Number(n);
  return Number.isInteger(i) && i >= 0 && i < CLASS_COUNT ? i : 0;
}

function blankClass(i, base) {
  return {
    name: `Classe ${i + 1}`,
    primary: base.primary,
    secondary: base.secondary,
    melee: base.melee,
    hand: base.hand,
    kits: {},
  };
}

function readKits(raw) {
  const kits = {};
  if (!raw || typeof raw !== 'object') return kits;
  for (let i = 0; i < WEAPONS.length; i++) {
    const key = WEAPONS[i].key;
    if (raw[key] == null || !familyOf(i)) continue;
    const k = clampKit(i, raw[key]);
    if (!kitIsDefault(i, k)) kits[key] = k;
  }
  return kits;
}

export function normalizeClasses(raw, legacy = {}) {
  const base = {
    primary: PRIMARIES.includes(legacy.primary | 0) ? legacy.primary | 0 : 0,
    secondary: SECONDARIES.includes(legacy.secondary | 0) ? legacy.secondary | 0 : PISTOL,
    melee: MELEES.includes(legacy.melee | 0) ? legacy.melee | 0 : KNIFE,
    hand: normHand(legacy.hand),
  };
  const fresh = () => Array.from({ length: CLASS_COUNT }, (_, i) => blankClass(i, base));
  if (!Array.isArray(raw) || raw.length !== CLASS_COUNT) return fresh();
  try {
    return raw.map((c, i) => {
      if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('classe');
      const name = String(c.name || '').trim().slice(0, 16) || `Classe ${i + 1}`;
      const primary = PRIMARIES.includes(c.primary | 0) ? c.primary | 0 : base.primary;
      const secondary = SECONDARIES.includes(c.secondary | 0) ? c.secondary | 0 : base.secondary;
      const melee = MELEES.includes(c.melee | 0) ? c.melee | 0 : base.melee;
      return { name, primary, secondary, melee, hand: normHand(c.hand), kits: readKits(c.kits) };
    });
  } catch (e) {
    return fresh();
  }
}

export function classLoad(c, weapons) {
  const row = c || {};
  const load = clampLoadout(row.primary, row.secondary, row.melee, weapons);
  const kits = {};
  for (const i of [load.primary, load.secondary, load.melee]) {
    const key = WEAPONS[i].key;
    const rawKits = row.kits || {};
    const has = Object.prototype.hasOwnProperty.call(rawKits, key);
    kits[key] = has ? clampKit(i, rawKits[key]) : defaultKit(i);
  }
  return { ...load, hand: normHand(row.hand), kits };
}

// ============================================================
//  Invasão · Survival. Regras puras (sem DOM, sem Three.js).
//  Só vale quando a sala está em Invasão E na variante Survival.
//  Padrão não cria loja, não debita ponto e não troca o loadout.
//
//  Pontos da partida: a HUD antiga (+10 no acerto, +100/+150 no abate) é só
//  enfeite e não se gasta. Aqui a carteira é outra, da partida, no mesmo espírito
//  (acerto paga pouco, abate paga o grosso) e quem debita é o servidor.
//
//  Registrar o mapa do Survival (o outro agente faz o 'Hotmilk à noite'):
//    import { registerSurvivalMap } from './shared/survival.js';
//    registerSurvivalMap('hotmilk-noite', {
//      exclusive: true, // Survival passa a jogar SÓ neste mapa
//      papada: { x: 0, z: 4, yaw: 0 },
//      box: { x: 8, z: -2, yaw: Math.PI },
//      walls: [{ w: 9, x: -6, z: 2, yaw: 0 }], // w = índice em WEAPONS; preço opcional
//      doors: [{ id: 'porteira', x: 2, z: 0, yaw: 0, price: 750 }], // portas compráveis: o mapa lê este array
//    });
//  Sem exclusive, cada mapa da Invasão ganha posições de TESTE (stationsFor).
//  doors não é simulado aqui: fica no layout pra quem implementa a porta.
// ============================================================
import { INV_AMMO, waveSpec } from './invasion.js';
import { WEAPONS, PISTOL, KNIFE, UZI, P90, NAIL, SEMI, BOW, CORN_W, TAMPA, RAY, PRIMARIES, SECONDARIES } from './rules.js';

export const PAPADA_NAME = 'Papada';
export const BOX_NAME = 'Barraca da Sorte';
export const SURV_ID = 'survival';
export const PADRAO_ID = 'padrao';

export const SURV = {
  hit: 10,
  hitCap: 36, // acertos pagos por zumbi, por jogador (o golpe que mata não conta de novo)
  head: 50,
  cook: 2.6,
  boxSpin: 2.2,
  boxHold: 8,
  reach: 2.6,
  use: 'KeyF',
  useLabel: 'F',
  hold: 0.45,
  boxPrice: 1250,
};

// Custo pra sair do tier atual (0→1, 1→2, 2→3). Tier 3 não sobe.
export const PAP_COST = [10000, 25000, 50000];
const TAG = ['', 'na Brasa', 'Defumado', 'Pururuca'];

// Multiplicadores do tier (1, 2, 3). dmg no corpo; rate e reload são fração do tempo (menor = mais rápido).
// Sniper sobe menos (já mata). Escopeta sobe menos por causa do chumbo. Explosivo mexe na área, não vira metralhadora.
const PROFILE = {
  bullet: [
    { dmg: 1.55, mag: 1.45, reserve: 1.6, rate: 0.9, reload: 0.82 },
    { dmg: 2.2, mag: 1.9, reserve: 2.15, rate: 0.8, reload: 0.68 },
    { dmg: 2.9, mag: 2.35, reserve: 2.75, rate: 0.72, reload: 0.55 },
  ],
  shotgun: [
    { dmg: 1.4, mag: 1.5, reserve: 1.6, rate: 0.92, reload: 0.85 },
    { dmg: 1.85, mag: 1.85, reserve: 2.1, rate: 0.84, reload: 0.72 },
    { dmg: 2.3, mag: 2.25, reserve: 2.6, rate: 0.76, reload: 0.6 },
  ],
  sniper: [
    { dmg: 1.35, mag: 1.4, reserve: 1.5, rate: 0.92, reload: 0.85 },
    { dmg: 1.7, mag: 1.8, reserve: 1.9, rate: 0.85, reload: 0.72 },
    { dmg: 2.05, mag: 2.0, reserve: 2.3, rate: 0.78, reload: 0.62 },
  ],
  boom: [
    { dmg: 1.45, mag: 1, reserve: 1.5, rate: 0.95, reload: 0.85 },
    { dmg: 1.9, mag: 1, reserve: 2, rate: 0.9, reload: 0.75 },
    { dmg: 2.35, mag: 2, reserve: 2.5, rate: 0.85, reload: 0.65 },
  ],
  // Ray Gun já é a mais forte sem upgrade. O tier sobe, mas o 3 ainda não mata o barrigão de um tiro.
  ray: [
    { dmg: 1.28, mag: 1.2, reserve: 1.25, rate: 0.92, reload: 0.88 },
    { dmg: 1.55, mag: 1.35, reserve: 1.5, rate: 0.86, reload: 0.78 },
    { dmg: 1.82, mag: 1.5, reserve: 1.75, rate: 0.8, reload: 0.7 },
  ],
};
const SNIPER_KEYS = new Set(['sniper', 'canhao', 'carabina']);
const SHOT_KEYS = new Set(['shotgun', 'semi']);
const BOOM_KEYS = new Set(['bazooka', 'milho']);

const KILL = { walker: 120, runner: 90, tank: 240, spitter: 140, boss: 700 };

// Armas fracas e úteis na parede. price = primeira compra; ammo = recompra de munição.
export const WALL_CATALOG = [
  { w: PISTOL, price: 500, ammo: 250 },
  { w: UZI, price: 1100, ammo: 450 },
  { w: NAIL, price: 900, ammo: 350 },
  { w: SEMI, price: 1300, ammo: 500 },
  { w: BOW, price: 1000, ammo: 400 },
  { w: P90, price: 1500, ammo: 550 },
];

const BOX_SKIP = new Set([TAMPA, KNIFE, RAY]);
export const BOX_POOL = [...PRIMARIES, ...SECONDARIES].filter((w, i, a) => a.indexOf(w) === i && !BOX_SKIP.has(w) && papOk(WEAPONS[w]) && !(WEAPONS[w] && WEAPONS[w].ray));
// 6,5%: um pouco acima de uma arma comum do pool (~1/20 ≈ 5%), ainda rara.
// Em 15 giros (15 × 1.250 = 18.750 pts, entre o tier 1 e o tier 2 da Papada) a chance de ter visto a Ray Gun ao menos uma vez é ~63%.
// 5% atrasaria demais o achado; 8% a deixaria tão comum quanto duas armas normais juntas.
export const RAY_ODDS = 0.065;

export function normSurv(v) { return v === SURV_ID ? SURV_ID : PADRAO_ID; }
export function isSurvival(v) { return normSurv(v) === SURV_ID; }

export function papOk(w) {
  if (!w || w.melee || w.shield || w.saber || w.key === 'minigun' || w.key === 'faca-dourada') return false;
  return w.dmg > 0 || !!w.rocket || !!w.corn || !!w.disc || !!w.egg;
}
export function papRefuse(w) {
  if (!w) return 'arma';
  if (w.melee || w.key === 'faca-dourada' || w.saber) return 'lamina';
  if (w.shield) return 'escudo';
  if (w.key === 'minigun') return 'especial';
  if (!papOk(w)) return 'especial';
  return '';
}

function profileOf(w) {
  if (!w) return PROFILE.bullet;
  if (w.ray) return PROFILE.ray;
  if (SNIPER_KEYS.has(w.key)) return PROFILE.sniper;
  if (SHOT_KEYS.has(w.key)) return PROFILE.shotgun;
  if (BOOM_KEYS.has(w.key) || w.rocket || w.corn) return PROFILE.boom;
  return PROFILE.bullet;
}
export function tierMul(w, tier) {
  const t = tier | 0;
  if (t < 1) return null;
  const row = profileOf(w);
  return row[Math.min(3, t) - 1];
}
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;

export function papName(w, tier) {
  const t = tier | 0;
  if (!w || t < 1) return w ? (w.short || w.name) : '';
  return `${w.short || w.name} ${TAG[Math.min(3, t)]}`;
}

export function withPap(base, tier) {
  if (!base) return base;
  const t = tier | 0;
  if (t < 1 || !papOk(base)) return base;
  const m = tierMul(base, t);
  const mag0 = base.mag | 0;
  let mag = mag0;
  if (mag0 <= 1) mag = mag0 + (t >= 3 ? 2 : t === 2 ? 1 : 0);
  else mag = Math.max(mag0, Math.ceil(mag0 * m.mag));
  const reserve0 = base.reserve | 0;
  const reserve = reserve0 > 0 ? Math.max(reserve0, Math.ceil(reserve0 * m.reserve)) : 0;
  const next = {
    ...base,
    dmg: r1(base.dmg * m.dmg),
    mag, reserve,
    rate: r3(Math.max(0.03, base.rate * m.rate)),
    reload: base.reload > 0 ? r3(Math.max(0.15, base.reload * m.reload)) : base.reload,
    pap: t,
    papName: papName(base, t),
  };
  next.name = next.papName;
  next.short = next.papName;
  if (base.rocket) next.rocket = { ...base.rocket, maxDmg: Math.round(base.rocket.maxDmg * m.dmg) };
  return next;
}

export function bodyDmg(w) {
  if (!w) return 0;
  if (w.rocket) return w.rocket.maxDmg;
  if (w.corn) return Math.round(18 * (w.pap ? tierMul(WEAPONS.find((x) => x.key === 'milho') || w, w.pap).dmg : 1));
  if ((w.pellets | 0) > 1) return Math.round(w.dmg * w.pellets);
  return r1(w.dmg);
}

export function gunStats(base, tier) {
  const w = tier ? withPap(base, tier) : base;
  return {
    tier: tier | 0,
    name: tier ? papName(base, tier) : (base.short || base.name),
    dmg: bodyDmg(tier ? w : { ...base, pap: 0 }),
    mag: w.mag | 0,
    reserve: w.reserve | 0,
    rate: w.rate,
    reload: w.reload || 0,
  };
}
// milho: o dano de verdade está em CORN.maxDmg (18). withPap não mexe nele; bodyDmg acima usa o tier.
// Ajuste: gunStats do milho sem tier deve mostrar 18.
const CORN_POP = 18;
export function shownDmg(base, tier) {
  if (base && base.corn) {
    const m = tier ? tierMul(base, tier) : null;
    return Math.round(CORN_POP * (m ? m.dmg : 1));
  }
  return gunStats(base, tier).dmg;
}

export function statLine(base, fromTier, toTier) {
  const a = gunStats(base, fromTier), b = gunStats(base, toTier);
  a.dmg = shownDmg(base, fromTier); b.dmg = shownDmg(base, toTier);
  const n = (x) => String(x).replace('.', ',');
  const bits = [`dano ${n(a.dmg)} → ${n(b.dmg)}`];
  if (b.mag !== a.mag) bits.push(`pente ${a.mag} → ${b.mag}`);
  if (b.reserve !== a.reserve) bits.push(`reserva ${a.reserve} → ${b.reserve}`);
  if (b.rate !== a.rate && a.rate > 0) bits.push(`tiro ${n(a.rate)}s → ${n(b.rate)}s`);
  if (b.reload !== a.reload && a.reload > 0) bits.push(`recarga ${n(a.reload)}s → ${n(b.reload)}s`);
  return { before: a, after: b, text: bits.join(' · '), tier: toTier | 0, name: b.name };
}

export function fmtPts(n) {
  const v = Math.max(0, n | 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Um saldo só. A loja escreve `pts` e a porta escreve `points`; os dois ficam iguais.
export function syncPurse(e) {
  if (!e) return 0;
  if (e.pts == null && e.points == null) { e.pts = 0; e.points = 0; }
  else if (e.pts == null) e.pts = e.points | 0;
  else if (e.points == null) e.points = e.pts | 0;
  else if ((e.pts | 0) !== (e.points | 0)) {
    const v = Math.max(0, e.pts | 0, e.points | 0);
    e.pts = v; e.points = v;
  }
  return e.pts | 0;
}
function setPurse(e, n) {
  const v = Math.max(0, n | 0);
  e.pts = v; e.points = v;
  return v;
}
export function ensurePurse(e) {
  if (!e.pap || typeof e.pap !== 'object') e.pap = {};
  if (!e.slotOn) e.slotOn = [1, 1, 1];
  syncPurse(e);
  if (!e.hitFarm) e.hitFarm = {};
  return e;
}
export function papTierOf(e, w) { return (e && e.pap && e.pap[w] | 0) || 0; }

export function killPoints(zt, head) { return (KILL[zt] || 100) + (head ? SURV.head : 0); }
export function grantHit(e, zid) {
  ensurePurse(e);
  const k = String(zid);
  const n = e.hitFarm[k] | 0;
  if (n >= SURV.hitCap) return 0;
  e.hitFarm[k] = n + 1;
  setPurse(e, syncPurse(e) + SURV.hit);
  return SURV.hit;
}
export function grantKill(e, zt, head) {
  ensurePurse(e);
  const add = killPoints(zt, head);
  setPurse(e, syncPurse(e) + add);
  return add;
}

export function fillGun(e, w, weapons = WEAPONS) {
  const base = weapons[w]; if (!base) return;
  const g = withPap(base, papTierOf(e, w));
  if (!e.mag) e.mag = weapons.map((x) => x.mag);
  if (!e.reserve) e.reserve = weapons.map((x) => x.reserve);
  e.mag[w] = g.mag;
  e.reserve[w] = g.reserve;
}
export function needsAmmo(e, w, weapons = WEAPONS) {
  const base = weapons[w]; if (!base || !(base.reserve > 0)) return false;
  const g = withPap(base, papTierOf(e, w));
  return (e.mag[w] | 0) < g.mag || (e.reserve[w] | 0) < g.reserve;
}

export function applySurvivalLoadout(e, weapons = WEAPONS) {
  ensurePurse(e);
  e.primary = e.nextPrimary = PISTOL;
  e.secondary = e.nextSecondary = PISTOL;
  e.melee = e.nextMelee = KNIFE;
  e.slots = [PISTOL, PISTOL, KNIFE];
  e.slotOn = [1, 0, 1];
  e.weapon = PISTOL;
  e.kit = {};
  e.papGun = -1; e.papUntil = 0;
  fillGun(e, PISTOL, weapons);
  return e;
}
export function slotLive(e, i) { return !e.slotOn || e.slotOn[i] !== 0; }

export function giveGun(e, w, weapons = WEAPONS) {
  ensurePurse(e);
  const on = e.slotOn;
  if ((on[0] && e.slots[0] === w) || (on[1] && e.slots[1] === w)) { fillGun(e, w, weapons); return 'have'; }
  if (!on[1]) {
    e.slots[1] = w; e.secondary = e.nextSecondary = w; on[1] = 1;
    fillGun(e, w, weapons); e.weapon = w; return 'add';
  }
  const slot = e.weapon === e.slots[1] ? 1 : 0;
  e.slots[slot] = w;
  if (slot === 0) e.primary = e.nextPrimary = w; else e.secondary = e.nextSecondary = w;
  fillGun(e, w, weapons); e.weapon = w; return 'swap';
}

export function tryPap(e, weapons = WEAPONS, now = 0) {
  ensurePurse(e);
  const w = e.weapon | 0;
  const base = weapons[w];
  const why = papRefuse(base);
  if (why) return { ok: false, reason: why };
  if ((e.papUntil || 0) > now && e.papGun === w) return { ok: false, reason: 'cozinha' };
  const cur = papTierOf(e, w);
  if (cur >= 3) return { ok: false, reason: 'max', tier: 3 };
  const cost = PAP_COST[cur];
  const have = syncPurse(e);
  if (have < cost) return { ok: false, reason: 'pontos', cost, have, tier: cur };
  const line = statLine(base, cur, cur + 1);
  setPurse(e, have - cost);
  e.pap[w] = cur + 1;
  fillGun(e, w, weapons);
  return { ok: true, weapon: w, tier: cur + 1, cost, pts: e.pts | 0, line };
}

export function tryBoxPay(e) {
  ensurePurse(e);
  const have = syncPurse(e);
  if (have < SURV.boxPrice) return { ok: false, reason: 'pontos', cost: SURV.boxPrice, have };
  setPurse(e, have - SURV.boxPrice);
  return { ok: true, cost: SURV.boxPrice, pts: e.pts | 0 };
}
export function rollBox(rng, avoid = -1) {
  const rnd = rng || Math.random;
  const u = rnd();
  const rareOn = !!(WEAPONS[RAY] && WEAPONS[RAY].ray) && RAY !== avoid;
  if (rareOn && u < RAY_ODDS) return RAY;
  const pool = BOX_POOL.filter((w) => w !== avoid && w !== RAY);
  const src = pool.length ? pool : BOX_POOL;
  const base = rareOn ? RAY_ODDS : 0;
  const span = rareOn ? 1 - RAY_ODDS : 1;
  const t = span > 0 ? (u - base) / span : u;
  const i = Math.min(src.length - 1, Math.max(0, Math.floor(t * src.length)));
  return src[i];
}
export function takeBox(e, w, weapons = WEAPONS) {
  const how = giveGun(e, w, weapons);
  return { ok: true, how, weapon: w, pts: e.pts | 0 };
}

export function tryWall(e, wall, weapons = WEAPONS) {
  ensurePurse(e);
  if (!wall) return { ok: false, reason: 'longe' };
  const w = wall.w | 0;
  if (weapons[w] && weapons[w].ray) return { ok: false, reason: 'parede', weapon: w };
  const on = e.slotOn || [1, 1, 1];
  const owns = (on[0] && e.slots[0] === w) || (on[1] && e.slots[1] === w);
  if (owns) {
    if (!needsAmmo(e, w, weapons)) return { ok: false, reason: 'cheia', weapon: w };
    const cost = wall.ammo | 0;
    const haveAmmo = syncPurse(e);
    if (haveAmmo < cost) return { ok: false, reason: 'pontos', cost, have: haveAmmo, weapon: w, kind: 'ammo' };
    setPurse(e, haveAmmo - cost); fillGun(e, w, weapons);
    return { ok: true, kind: 'ammo', cost, pts: e.pts | 0, weapon: w };
  }
  const cost = wall.price | 0;
  const have = syncPurse(e);
  if (have < cost) return { ok: false, reason: 'pontos', cost, have, weapon: w, kind: 'buy' };
  setPurse(e, have - cost);
  const how = giveGun(e, w, weapons);
  return { ok: true, kind: how, cost, pts: e.pts | 0, weapon: w };
}

// Caixa de munição do mapa, no teto da arma já passada na Papada (não encolhe a reserva upada).
export function survRefill(e, weapons = WEAPONS) {
  ensurePurse(e);
  let got = false;
  const on = e.slotOn || [1, 1, 1];
  for (let s = 0; s < e.slots.length; s++) {
    if (on[s] === 0) continue;
    const i = e.slots[s];
    const base = weapons[i]; if (!base || !(base.reserve > 0)) continue;
    const w = withPap(base, papTierOf(e, i));
    const cap = Math.ceil(w.reserve * INV_AMMO.reserveMul);
    if ((e.reserve[i] | 0) >= cap && (e.mag[i] | 0) >= w.mag) continue;
    e.reserve[i] = Math.min(cap, (e.reserve[i] | 0) + (base.rocket ? INV_AMMO.rockets : w.reserve));
    e.mag[i] = Math.max(e.mag[i] | 0, w.mag);
    got = true;
  }
  return got;
}

// ---------- curva de dificuldade (só Survival) ----------
// O Padrão continua em waveSpec (shared/invasion.js). Aqui é a curva própria do Survival:
// wave 1 perto de 57% da velocidade de hoje, subida suave até a velocidade normal na wave 10,
// e daí pra frente os mesmos números do Padrão. Mexer nesta tabela recalibra o modo inteiro.
// A quantidade cai pouco no começo: a Papada 1 continua na wave 3, a 2 na 7 e a 3 na 12.
// O alívio é a velocidade, o lote de um em um e o intervalo maior entre os spawns.
//
// Frações em cima do waveSpec da mesma wave (1 = igual ao Padrão).
//   speed  velocidade (walker, corredor, barrigão, cuspidor e chefão usam a mesma fração)
//   count  quantidade da wave
//   hp     vida (e a vida do chefão)
//   dmg    dano da mordida, do cuspe e da explosão do barrigão
//   spawn  intervalo entre lotes (>1 = nascem mais devagar)
//   batch  tamanho do lote, em fração do lote do Padrão
//   alive  teto de zumbis vivos ao mesmo tempo, em fração do teto do Padrão
//   gap    pausa em segundos depois de limpar a wave
//   lead   espera, em segundos, até o primeiro zumbi da wave
// Entre as âncoras a fração anda com smoothstep (sem degrau). A variação de cada zumbi
// (±8% em volta da velocidade da wave) continua no spawn, igual nos dois modos.
const SURVIVAL_PREP = 16; // segundos antes da wave 1 (o Padrão usa INV.PREP = 12)
const SURVIVAL_WAVE_KEYS = [
  { w: 1, speed: 0.57, count: 0.90, hp: 0.86, dmg: 0.80, spawn: 1.50, batch: 0.50, alive: 0.23, gap: 20, lead: 1.4 },
  { w: 3, speed: 0.68, count: 0.94, hp: 0.92, dmg: 0.88, spawn: 1.35, batch: 0.55, alive: 0.22, gap: 18, lead: 1.2 },
  { w: 5, speed: 0.82, count: 0.98, hp: 0.97, dmg: 0.94, spawn: 1.15, batch: 0.70, alive: 0.35, gap: 16, lead: 1.0 },
  { w: 8, speed: 0.97, count: 1, hp: 1, dmg: 1, spawn: 1.04, batch: 1, alive: 1, gap: 15, lead: 0.8 },
  { w: 10, speed: 1, count: 1, hp: 1, dmg: 1, spawn: 1, batch: 1, alive: 1, gap: 15, lead: 0.8 },
];
function smoothstep01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}
function sampleWaveKey(w, name) {
  const keys = SURVIVAL_WAVE_KEYS;
  if (w <= keys[0].w) return keys[0][name];
  const last = keys[keys.length - 1];
  if (w >= last.w) return last[name];
  let i = 0;
  while (keys[i + 1].w < w) i++;
  const a = keys[i], b = keys[i + 1];
  return a[name] + (b[name] - a[name]) * smoothstep01((w - a.w) / (b.w - a.w));
}
// Um spec no mesmo formato de waveSpec, mais gap (pausa), lead (primeiro spawn) e prep.
export function getSurvivalWaveTuning(wave, n = 1) {
  const w = Math.max(1, wave | 0);
  const base = waveSpec(w, n);
  const speed = sampleWaveKey(w, 'speed');
  const count = sampleWaveKey(w, 'count');
  const hp = sampleWaveKey(w, 'hp');
  const dmg = sampleWaveKey(w, 'dmg');
  const spawn = sampleWaveKey(w, 'spawn');
  const batch = sampleWaveKey(w, 'batch');
  const alive = sampleWaveKey(w, 'alive');
  return easeEarlyRunners({
    ...base,
    spdMul: speed === 1 ? base.spdMul : base.spdMul * speed,
    total: count === 1 ? base.total : Math.max(8, Math.round(base.total * count)),
    hpMul: hp === 1 ? base.hpMul : base.hpMul * hp,
    dmgMul: dmg === 1 ? base.dmgMul : base.dmgMul * dmg,
    bossHp: hp === 1 ? base.bossHp : base.bossHp * hp,
    spawnEvery: spawn === 1 ? base.spawnEvery : base.spawnEvery * spawn,
    batch: batch === 1 ? base.batch : Math.max(1, Math.round(base.batch * batch)),
    maxAlive: alive === 1 ? base.maxAlive : Math.min(base.maxAlive, Math.max(4, Math.round(base.maxAlive * alive))),
    gap: Math.round(sampleWaveKey(w, 'gap')),
    lead: sampleWaveKey(w, 'lead'),
    prep: SURVIVAL_PREP,
    speedScale: speed,
  }, w);
}
// O corredor do Padrão entra na wave 2 quase na velocidade do jogador. No Survival
// a pistola ainda é a arma: wave 2 é só podre, o corredor volta na 3 e a mistura
// inteira na 5. A velocidade dele, quando entra, segue a mesma fração da wave.
function easeEarlyRunners(spec, w) {
  if (w >= 5 || !(spec.mix && spec.mix.runner)) return spec;
  const k = w <= 2 ? 0 : w === 3 ? 0.55 : 0.85;
  return { ...spec, mix: { ...spec.mix, runner: spec.mix.runner * k } };
}

// ---------- layouts por mapa ----------
// Objeto mutável de propósito: registerSurvivalMap pluga um mapa novo sem editar este arquivo.
export const SURVIVAL_LAYOUTS = {};

export function registerSurvivalMap(id, layout) {
  if (!id || !layout) return null;
  SURVIVAL_LAYOUTS[id] = layout;
  return layout;
}
export function exclusiveSurvivalMap(knownIds) {
  for (const [id, lay] of Object.entries(SURVIVAL_LAYOUTS)) {
    if (lay && lay.exclusive && (!knownIds || knownIds.includes(id))) return id;
  }
  return null;
}

function wallFrom(raw, cat) {
  const src = cat || WALL_CATALOG.find((c) => c.w === raw.w) || WALL_CATALOG[0];
  return { w: raw.w | 0, x: raw.x, z: raw.z, yaw: raw.yaw || 0, price: raw.price > 0 ? raw.price : src.price, ammo: raw.ammo > 0 ? raw.ammo : src.ammo };
}

// Anel solto no meio do mapa: só o fallback sem física. O jogo usa bindStations, que encosta na parede de verdade.
export function testStations(map) {
  const [hx, hz] = map.size || [20, 20];
  const sp = (map.spawns || [[0, 0]]).map((s) => ({ x: s[0], z: s[1] }));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const a = sp[0] || { x: 0, z: 0 };
  const pap = { x: clamp(a.x * 0.5, -hx + 4, hx - 4), z: clamp(a.z * 0.5, -hz + 4, hz - 4) };
  const box = { x: clamp(-pap.x || 6, -hx + 4, hx - 4), z: clamp(-pap.z || -6, -hz + 4, hz - 4) };
  return { id: map.id, test: true, exclusive: false, papada: { ...pap, yaw: 0 }, box: { ...box, yaw: 0 }, walls: [], doors: [] };
}

function spawnsOf(map) {
  return (map.spawns || [[0, 0]]).map((s) => ({ x: s[0], z: s[1], y: s[2] || 0 }));
}

// Faces verticais das caixas do mapa + o muro do limite. Cada amostra é um ponto de peito na superfície, com a normal pra fora.
function wallSamples(map, phys, anchor) {
  const [hx, hz] = map.size;
  const wh = map.wallH || 4;
  const boxes = [];
  boxes.push({ b: [-hx - 1, 0, -hz - 1, hx + 1, wh, -hz] });
  boxes.push({ b: [-hx - 1, 0, hz, hx + 1, wh, hz + 1] });
  boxes.push({ b: [-hx - 1, 0, -hz, -hx, wh, hz] });
  boxes.push({ b: [hx, 0, -hz, hx + 1, wh, hz] });
  for (const o of map.boxes || []) if (o && o.b && !o.ramp) boxes.push(o);
  const out = [];
  const sp = spawnsOf(map);
  for (const o of boxes) {
    const [x0, y0, z0, x1, y1, z1] = o.b;
    if (y1 - y0 < 1.7 || y0 > 0.45) continue;
    const sides = [
      { nx: 1, nz: 0, line: x1, a0: z0, a1: z1, along: 'z' },
      { nx: -1, nz: 0, line: x0, a0: z0, a1: z1, along: 'z' },
      { nx: 0, nz: 1, line: z1, a0: x0, a1: x1, along: 'x' },
      { nx: 0, nz: -1, line: z0, a0: x0, a1: x1, along: 'x' },
    ];
    for (const s of sides) {
      const len = s.a1 - s.a0;
      if (len < 1.35) continue;
      const pad = Math.min(0.55, len * 0.22);
      for (const t of [0.5, 0.32, 0.68]) {
        const along = s.a0 + pad + (len - pad * 2) * t;
        const sx = s.along === 'z' ? s.line + s.nx * 1.15 : along;
        const sz = s.along === 'x' ? s.line + s.nz * 1.15 : along;
        if (Math.abs(sx) > hx - 0.8 || Math.abs(sz) > hz - 0.8) continue;
        const gy = phys.groundAt(sx, sz, Math.max(1.2, y0 + 1));
        if (gy > 1.35) continue;
        if (phys.collides(sx, gy + 0.45, sz)) continue;
        const chest = gy + 1.35;
        if (chest < y0 + 0.35 || chest > y1 - 0.2) continue;
        const dir = { x: -s.nx, y: 0, z: -s.nz };
        const hit = phys.rayWorldN({ x: sx, y: chest, z: sz }, dir, 1.8);
        if (!hit || hit.t < 0.35 || hit.t > 1.55 || Math.abs(hit.n.y) > 0.45) continue;
        const nl = Math.hypot(hit.n.x, hit.n.z) || 1;
        const nx = hit.n.x / nl, nz = hit.n.z / nl;
        const mx = sx + dir.x * hit.t + nx * 0.025;
        const mz = sz + dir.z * hit.t + nz * 0.025;
        let near = 1e9;
        for (const p of sp) near = Math.min(near, Math.hypot(sx - p.x, sz - p.z));
        if (anchor) near = Math.min(near, Math.hypot(sx - anchor.x, sz - anchor.z) * 0.55);
        out.push({
          x: mx, y: chest, z: mz, nx, nz,
          yaw: Math.atan2(-nz, nx),
          stand: { x: sx, y: gy, z: sz },
          score: 28 - Math.min(near, 40) + Math.min(len, 8),
        });
      }
    }
  }
  return out;
}

function pickSpread(cands, n, minSep) {
  const left = cands.slice().sort((a, b) => b.score - a.score);
  const got = [];
  while (got.length < n && left.length) {
    const i = left.findIndex((c) => got.every((g) => Math.hypot(g.x - c.x, g.z - c.z) >= minSep));
    if (i < 0) break;
    got.push(left.splice(i, 1)[0]);
  }
  return got;
}

function openSpot(phys, map, prefer, avoid) {
  const [hx, hz] = map.size;
  let best = null, bs = -1e9;
  for (let i = 0; i < 90; i++) {
    const ang = i * 2.399963, rad = 3.2 + (i % 14) * 0.85;
    const x = prefer.x + Math.cos(ang) * rad, z = prefer.z + Math.sin(ang) * rad;
    if (Math.abs(x) > hx - 2.4 || Math.abs(z) > hz - 2.4) continue;
    const y = phys.groundAt(x, z, 2);
    if (y > 1.1) continue;
    let blocked = false;
    for (const [dx, dz] of [[0, 0], [1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3], [0.9, 0.9]]) {
      if (phys.collides(x + dx, y + 0.5, z + dz)) { blocked = true; break; }
    }
    if (blocked) continue;
    let penalty = 0;
    for (const a of avoid) if (Math.hypot(x - a.x, z - a.z) < 5) penalty -= 40;
    const d = Math.hypot(x - prefer.x, z - prefer.z);
    const s = -Math.abs(d - 6.5) + penalty;
    if (s > bs) { bs = s; best = { x, y, z, yaw: Math.atan2(prefer.x - x, prefer.z - z) }; }
  }
  if (best) return best;
  const y = phys.groundAt(prefer.x, prefer.z, 2);
  return { x: prefer.x, y, z: prefer.z, yaw: 0 };
}

// A loja do mapa noturno sai das âncoras (Papada no saguão, barraca no ponto inicial, armas onde o mapa marcou).
// Sem âncora e sem layout registrado, não inventa Papada no Rodízio, na Fazenda, na Arena nem em mapa nenhum.
function mountWall(phys, w) {
  const chest = w.y > 0 ? w.y : 1.3;
  if (!phys || !phys.rayWorldN) return { x: w.x, y: chest, z: w.z, yaw: w.yaw || 0 };
  const dirs = [{ nx: 1, nz: 0 }, { nx: -1, nz: 0 }, { nx: 0, nz: 1 }, { nx: 0, nz: -1 }];
  let best = null;
  for (const d of dirs) {
    const hit = phys.rayWorldN({ x: w.x, y: chest, z: w.z }, { x: d.nx, y: 0, z: d.nz }, 4.2);
    if (!hit || hit.t < 0.15 || Math.abs(hit.n.y) > 0.45) continue;
    if (!best || hit.t < best.t) best = { hit, d };
  }
  if (!best) return { x: w.x, y: chest, z: w.z, yaw: w.yaw || 0 };
  const nl = Math.hypot(best.hit.n.x, best.hit.n.z) || 1;
  const nx = best.hit.n.x / nl, nz = best.hit.n.z / nl;
  const t = Math.max(0.05, best.hit.t - 0.04);
  return {
    x: w.x + best.d.nx * t + nx * 0.03,
    y: chest,
    z: w.z + best.d.nz * t + nz * 0.03,
    nx, nz, yaw: Math.atan2(-nz, nx),
    stand: { x: w.x + nx * 0.9, y: 0, z: w.z + nz * 0.9 },
  };
}
function layoutFromAnchors(map, phys) {
  const pack = map && map.survival && map.survival.anchors;
  if (!pack || !pack.upgrade || !pack.upgrade.length || !pack.mystery || !pack.mystery.length || !pack.wall || !pack.wall.length) return null;
  const up = pack.upgrade.find((a) => a.area === 'saguao') || pack.upgrade[0];
  const box = pack.mystery.find((a) => a.start) || pack.mystery[0];
  const walls = [];
  for (const w of pack.wall) {
    const idx = WEAPONS.findIndex((g) => g.key === w.weapon);
    if (idx < 0 || (WEAPONS[idx] && WEAPONS[idx].ray)) continue;
    const cat = WALL_CATALOG.find((c) => WEAPONS[c.w] && WEAPONS[c.w].key === w.weapon);
    const price = w.suggestedPrice > 0 ? w.suggestedPrice | 0 : (cat ? cat.price : 500);
    const ammo = w.ammo > 0 ? w.ammo | 0 : (cat ? cat.ammo : Math.max(250, Math.round(price / 2)));
    const mount = mountWall(phys, w);
    walls.push({ ...mount, w: idx, price, ammo, area: w.area, id: w.id });
  }
  if (!walls.length) return null;
  const gy = (p) => (phys ? phys.groundAt(p.x, p.z, (p.y || 0) + 1) : (p.y || 0));
  return {
    id: map.id, test: false, exclusive: true, mounted: true,
    papada: { x: up.x, y: gy(up), z: up.z, yaw: up.yaw || 0, area: up.area },
    box: { x: box.x, y: gy(box), z: box.z, yaw: box.yaw || 0, area: box.area },
    walls, doors: map.survival.doors || [],
  };
}

// Papada, barraca e parede só existem no layout do mapa (HOTMILK à Noite) ou num registerSurvivalMap.
// anchor fica na assinatura porque o servidor passa o spawn; o mapa noturno não usa posição de teste.
export function bindStations(map, phys, anchor) {
  void anchor;
  const custom = map && SURVIVAL_LAYOUTS[map.id];
  if (custom && custom.papada && custom.box && Array.isArray(custom.walls) && custom.walls.length) {
    const lay = stationsFor(map);
    if (!lay) return null;
    if (!phys) return lay;
    return {
      ...lay,
      papada: { ...lay.papada, y: lay.papada.y != null ? lay.papada.y : phys.groundAt(lay.papada.x, lay.papada.z, 2) },
      box: { ...lay.box, y: lay.box.y != null ? lay.box.y : phys.groundAt(lay.box.x, lay.box.z, 2) },
      walls: lay.walls.map((w) => ({ ...w, y: w.y != null ? w.y : phys.groundAt(w.x, w.z, 2) + 1.35 })),
    };
  }
  return layoutFromAnchors(map, phys);
}

export function stationsFor(map) {
  const lay = map && SURVIVAL_LAYOUTS[map.id];
  if (lay && lay.papada && lay.box && Array.isArray(lay.walls) && lay.walls.length) {
    return {
      id: map.id,
      test: false,
      exclusive: !!lay.exclusive,
      papada: { x: lay.papada.x, y: lay.papada.y, z: lay.papada.z, yaw: lay.papada.yaw || 0 },
      box: { x: lay.box.x, y: lay.box.y, z: lay.box.z, yaw: lay.box.yaw || 0 },
      walls: lay.walls.map((w) => wallFrom(w)),
      doors: (lay.doors || []).map((d) => ({ id: d.id, x: d.x, z: d.z, yaw: d.yaw || 0, price: d.price | 0 })),
    };
  }
  return layoutFromAnchors(map, null);
}

// Empurra um ponto pra fora de parede, se a física disser que está preso. Layout exclusivo também passa por aqui.
export function settlePoint(point, map, phys) {
  const [hx, hz] = map.size;
  const ok = (x, z) => {
    if (Math.abs(x) > hx - 1.2 || Math.abs(z) > hz - 1.2) return false;
    const y = phys.groundAt(x, z, 2);
    if (phys.collides(x, y + 0.4, z)) return false;
    return y;
  };
  const y0 = ok(point.x, point.z);
  if (y0 !== false) return { ...point, y: y0 };
  for (let r = 1; r <= 10; r++) {
    for (let a = 0; a < 10; a++) {
      const nx = point.x + Math.cos(a * 0.63 + r) * r;
      const nz = point.z + Math.sin(a * 0.63 + r) * r;
      const y = ok(nx, nz);
      if (y !== false) return { ...point, x: nx, y, z: nz };
    }
  }
  return { ...point, y: phys.groundAt(point.x, point.z, 2) };
}
export function settleLayout(layout, map, phys) {
  return {
    ...layout,
    papada: settlePoint(layout.papada, map, phys),
    box: settlePoint(layout.box, map, phys),
    walls: layout.walls.map((w) => settlePoint(w, map, phys)),
    doors: (layout.doors || []).map((d) => settlePoint(d, map, phys)),
  };
}

export function nearPoint(pos, point, reach = SURV.reach) {
  if (!pos || !point) return false;
  const y = point.y || 0;
  return Math.hypot(pos.x - point.x, pos.z - point.z) <= reach && Math.abs((pos.y || 0) - y) < 2.4;
}

export function cornPopDmg(tier) {
  const m = tier ? tierMul(WEAPONS[CORN_W], tier) : null;
  return Math.round(CORN_POP * (m ? m.dmg : 1));
}

// ---------- HOTMILK à Noite: o único mapa do Survival, com portas ----------
// O saldo é o mesmo da Papada (`pts` e `points` juntos). O abate na partida
// usa grantHit/grantKill. pointsForKill fica pra quem quiser a tabela da porta.
export const SURVIVAL = {
  mode: 'survival',
  variant: 'survival',
  DEFAULT_MAP: 'hotmilk-noite',
  START_POINTS: 500,
  USE_R: 2.35,
  KILL: { walker: 70, runner: 90, tank: 160, spitter: 110, boss: 500 },
  HEAD_BONUS: 40,
  KNIFE_BONUS: 30,
  HIT: 10,
  HIT_CAP: 4,
};

export function isSurvivalMode(mode, cfg) {
  if (mode === SURVIVAL.mode) return true;
  if (!cfg || typeof cfg !== 'object') return false;
  if (cfg.mode === SURVIVAL.mode) return true;
  if (cfg.variant === SURVIVAL.variant) return true;
  if (cfg.surv === SURVIVAL.variant) return true;
  return cfg.survival === true || cfg.survival === 1;
}

export function pointsForKill(zt, opts = {}) {
  const base = SURVIVAL.KILL[zt] ?? SURVIVAL.KILL.walker;
  return base + (opts.head ? SURVIVAL.HEAD_BONUS : 0) + (opts.knife ? SURVIVAL.KNIFE_BONUS : 0);
}

export function pointsForHit(zombie) {
  if (!zombie) return 0;
  const n = zombie.ptsHits | 0;
  if (n >= SURVIVAL.HIT_CAP) return 0;
  zombie.ptsHits = n + 1;
  return SURVIVAL.HIT;
}

export function grantPoints(ent, n) {
  if (!ent || !(n > 0)) return 0;
  setPurse(ent, syncPurse(ent) + n);
  return n;
}

export function trySpendPoints(ent, price) {
  const cost = price | 0;
  if (!ent || cost < 0) return false;
  const have = syncPurse(ent);
  if (have < cost) return false;
  setPurse(ent, have - cost);
  return true;
}

export function createMatchSurvival(map) {
  const pack = map && map.survival;
  if (!pack) return null;
  const areas = new Set((pack.areas || []).filter((a) => a.start).map((a) => a.id));
  return { open: new Set(), areas };
}

export function doorById(map, id) {
  const doors = map && map.survival && map.survival.doors;
  if (!doors) return null;
  return doors.find((d) => d.id === id) || null;
}

export function areaById(map, id) {
  const areas = map && map.survival && map.survival.areas;
  if (!areas) return null;
  return areas.find((a) => a.id === id) || null;
}

function doorDist(door, pos) {
  if (!pos || !door.at) return Infinity;
  const dx = pos.x - door.at[0], dy = (pos.y || 0) - (door.at[1] || 0), dz = pos.z - door.at[2];
  return Math.hypot(dx, dy, dz);
}

export function evaluateDoorBuy(map, state, ent, doorId) {
  const door = doorById(map, doorId);
  if (!map || !map.survival || !state || !door) return { ok: false, reason: 'none' };
  if (state.open.has(door.id)) return { ok: false, reason: 'open', door };
  if (!ent || ent.alive === false) return { ok: false, reason: 'dead', door };
  if (!door.areas.some((a) => state.areas.has(a))) return { ok: false, reason: 'locked', door };
  if (doorDist(door, ent.pos) > SURVIVAL.USE_R) return { ok: false, reason: 'far', door };
  const have = syncPurse(ent);
  if (have < door.price) return { ok: false, reason: 'points', door, price: door.price, have };
  return { ok: true, door, price: door.price, unlock: door.areas.filter((a) => !state.areas.has(a)) };
}

export function commitDoorBuy(state, ent, door) {
  setPurse(ent, syncPurse(ent) - door.price);
  state.open.add(door.id);
  const unlocked = [];
  for (const id of door.areas) if (!state.areas.has(id)) { state.areas.add(id); unlocked.push(id); }
  return { points: ent.points, unlocked };
}

export function nearestClosedDoor(map, state, pos) {
  if (!map || !map.survival || !state || !pos) return null;
  let best = null, bd = SURVIVAL.USE_R;
  for (const door of map.survival.doors) {
    if (state.open.has(door.id)) continue;
    if (!door.areas.some((a) => state.areas.has(a))) continue;
    const d = doorDist(door, pos);
    if (d < bd) { bd = d; best = door; }
  }
  return best ? { door: best, dist: bd } : null;
}

export function unlockedZombieSpawns(map, state) {
  if (!map || !map.survival || !state) return [];
  const out = [];
  for (const area of map.survival.areas || []) {
    if (!state.areas.has(area.id)) continue;
    for (const s of area.zspawns || []) out.push({ area: area.id, x: s[0], z: s[1], y: s[2] || 0 });
  }
  return out;
}

export function closedDoorSolids(map, openSet) {
  if (!map || !map.survival) return [];
  const open = openSet || new Set();
  const out = [];
  for (const door of map.survival.doors) {
    if (open.has(door.id)) continue;
    const [x0, y0, z0, x1, y1, z1] = door.block;
    out.push({ min: { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) }, max: { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) }, ramp: null, door: door.id });
  }
  return out;
}

export const DOOR_FAIL = {
  points: 'Pontos insuficientes',
  far: 'Chega mais perto da porta',
  locked: 'Esse lado ainda está fechado',
  dead: 'Só vivo compra porta',
  open: '',
  none: '',
};

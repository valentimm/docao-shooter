// Checkpoint do Modo história. A sala guarda isto e o código fica dela até a partida
// acabar, alguém apagar, ou passarem 10 dias.

export const ADVENTURE_DAYS = 10;
export const ADVENTURE_MS = ADVENTURE_DAYS * 24 * 60 * 60 * 1000;

export function adventureExpired(snap, now = Date.now()) {
  return !snap || !(snap.exp > now);
}

export function packEgg(egg) {
  const e = egg || {};
  return {
    steps: { ...(e.steps || {}) },
    secret: !!e.secret,
    extra: !!e.extra,
    sodaWave: e.sodaWave | 0,
    fridge: !!e.fridge,
    drunk: { ...(e.drunk || {}) },
    muroTaken: !!e.muroTaken,
    chaviDone: !!e.chaviDone,
    fireOn: !!e.fireOn,
    sodaOut: !!e.sodaOut,
    told: e.told | 0,
  };
}

export function restoreEgg(egg, raw) {
  if (!egg || !raw) return egg;
  egg.steps = { cria: false, lanche: false, refri: false, muro: false, ...(raw.steps || {}) };
  egg.secret = !!raw.secret;
  egg.extra = !!raw.extra;
  if (raw.sodaWave) egg.sodaWave = raw.sodaWave | 0;
  egg.fridge = !!raw.fridge;
  egg.drunk = { ...(raw.drunk || {}) };
  egg.muroTaken = !!raw.muroTaken;
  egg.chaviDone = !!raw.chaviDone;
  egg.chavi = null;
  egg.fireOn = !!raw.fireOn;
  egg.sodaOut = !!raw.sodaOut;
  egg.told = raw.told | 0;
  return egg;
}

function packPlayer(p) {
  return {
    acct: p.acct && p.acct.id ? p.acct.id | 0 : 0,
    name: p.name || '',
    points: (p.pts != null ? p.pts : p.points) | 0,
    lives: p.lives | 0,
    hp: Math.round(p.hp || 0),
    ups: (p.hUps || []).slice(),
    pass: { ...(p.hPass || {}) },
    ult: p.hUlt || '',
    primary: p.primary | 0,
    secondary: p.secondary | 0,
    melee: p.melee | 0,
    pap: { ...(p.pap || {}) },
    slotOn: p.slotOn ? p.slotOn.slice() : null,
  };
}

export function matchAdventureRow(rows, p) {
  const list = rows || [];
  const acct = p && p.acct && p.acct.id ? p.acct.id | 0 : 0;
  if (acct) { const hit = list.find((r) => r && (r.acct | 0) === acct); if (hit) return hit; }
  const name = p && p.name;
  if (name) return list.find((r) => r && r.name === name) || null;
  return null;
}

export function applyAdventureRow(p, row) {
  if (!p || !row) return;
  const pts = row.points | 0;
  p.points = pts; p.pts = pts; p._purse = pts;
  if (row.lives != null) { p.lives = row.lives | 0; p.out = p.lives <= 0; }
  if (row.hp > 0) p.hp = row.hp | 0;
  p.hUps = (row.ups || []).slice();
  p.hPass = { ...(row.pass || {}) };
  p.hUlt = row.ult || '';
  p.hSel = p.hUlt || p.hUps[0] || '';
  if (row.pap) p.pap = { ...row.pap };
  if (row.slotOn) p.slotOn = row.slotOn.slice();
  if (row.primary != null) {
    p.primary = p.nextPrimary = row.primary | 0;
    p.secondary = p.nextSecondary = row.secondary | 0;
    p.melee = p.nextMelee = row.melee | 0;
    p.slots = [p.primary, p.secondary, p.melee];
    p.weapon = p.slots.includes(p.weapon) ? p.weapon : p.primary;
  }
}

export function packAdventure(inv, players, now = Date.now()) {
  const wave = Math.max(1, (inv && inv.wave) | 0);
  return {
    at: now,
    exp: now + ADVENTURE_MS,
    wave,
    egg: packEgg(inv && inv.egg),
    players: (players || []).filter((p) => p && !p.bot && !p.zt).map(packPlayer),
  };
}

// Volta a partida para o começo da wave salva, com o ovo e o kit de cada um.
export function applyAdventure(core, players, snap) {
  if (!core || !core.egg || adventureExpired(snap)) return false;
  restoreEgg(core.egg, snap.egg);
  const list = Array.isArray(players) ? players : [];
  for (const p of list) applyAdventureRow(p, matchAdventureRow(snap.players, p));
  core.startWave(Math.max(1, snap.wave | 0));
  return true;
}

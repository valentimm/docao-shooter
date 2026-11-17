// ============================================================
//  Gunfight (id de modo `gf`) — regras puras, offline + servidor. Sem DOM, sem Three.js.
//  Inspirado no Gunfight do CoD. A partida é uma máquina prep → live → (ot) → end → over,
//  no mesmo espírito de shared/bomb.js e shared/hide.js. O equipamento é uma arma só,
//  no espírito de equipX1 / equipArmsRace (slots = [w], sem copo).
//
//  Times: 0 = Vermelho, 1 = Azul. Formatos 1v1, 2v2, 3v3 e 4v4 (GF.FORMATS). Máximo de
//  jogadores = n × 2. Uma vida por rodada: ninguém renasce no live nem no overtime.
//  O único "renascer" é o prep da rodada seguinte (vida 100, pente cheio, congelado).
//
//  Placar: primeiro a GF.WIN (6). 5×5 joga a 11ª, que decide. Teto de GF.MAX_ROUNDS (11).
//  Se a 11ª acabar e ninguém tiver 6, ganha quem tiver mais rodadas; empate no placar
//  encerra a partida sem campeão (winner -1). Rodada empatada não dá ponto.
//
//  Classe: a mesma pra todo mundo. Troca a cada 2 rodadas (1–2 classe A, 3–4 classe B…),
//  sorteada sem repetir a anterior e, enquanto couber, sem repetir na partida.
//  Lado: troca junto (1–2 lado normal, 3–4 invertido…). sideForRound(n) = 0 normal, 1 invertido.
//  spawnSide(n, time) é o lado físico (0 ou 1) daquele time nessa rodada.
//
//  Tempo do live: 40 s (1v1 e 2v2), 50 s (3v3), 60 s (4v4). Acabou com os dois times vivos:
//  overtime de 10 s e uma zona no centro. A zona vem do mapa — createGunfight({ zone })
//  ou stepGunfight(..., { zone }). Captura EXCLUSIVA (só um time dentro) por GF.CAP (3 s)
//  ganha a rodada. Contestada ou vazia não anda o cronômetro da captura (pausa, não zera).
//  Se o outro time ficar sozinho, a captura recomeça pra ele. Overtime sem captura e sem
//  eliminação: ganha quem tiver mais vida somada dos vivos. Vida igual = rodada empatada.
//
//  Fora deste módulo (o integrador lê as flags): sem regeneração (GF.REGEN), sem killstreak,
//  sem poder e sem pickup de vida. A Barraca do Survival não muda; a Ray Gun só entra na
//  lista de classes daqui.
//
//  API
//    GF, isGunfight(mode)
//    createGunfight({ format, zone, rnd }) → estado
//    startRound(state, rnd | { rnd, ents }) → eventos; com ents, revive e equipa o prep
//    stepGunfight(state, dt, world) → eventos
//        world = { ents, zone, rnd }
//        ents = [{ id, team, alive, hp, pos:{x,y,z} }]
//    onKill(state, victim, ents) → eventos (eliminação imediata; ents = elenco inteiro)
//    packGunfight(state) / unpackGunfight(pack, state?)
//    rollClass(prevId, usedIds, rnd) → id da arma
//    equipGunfight(entity, classId) → a mesma entidade (1 slot, nades 0, skin da conta intacta)
//    sideForRound(round) / spawnSide(round, team)
//    aliveByTeam(ents) / hpByTeam(ents) / nextClass(state) / classInfo(id) / gunfightHud(state, ents)
//    gunfightFrozen(state) / allowsRespawn(state) / inGunfightZone(zone, pos)
//    maxPlayers(format) / roundTime(format)
//
//  Eventos (o primeiro campo é o tipo):
//    ['round', n]            prep da rodada n
//    ['swap']                os lados inverteram nesta rodada
//    ['class', weaponId]     classe desta rodada (índice em WEAPONS)
//    ['go']                  acabou o prep, live
//    ['ot']                  live esgotou com os dois times vivos
//    ['win', time, why]      time 0|1, ou -1 se empatou. why: 'elim' | 'cap' | 'hp' | 'draw'
//    ['over', time]          faixa de fim acabou. time 0|1, ou -1 se a partida empatou
//  Cada step atravessa no máximo uma fronteira de fase; o dt que sobra não roda a fase nova.
// ============================================================
import { WEAPONS, GOLD_KNIFE, resetRegen } from './rules.js';
import { resetDrums } from './revolver.js';
import { resetShield } from './shield.js';

const CLASS_KEYS = ['knife', 'bazooka', 'minigun', 'sabre', 'tampa', 'shotgun', 'canhao', 'milho', 'disco', 'estilingue', 'capataz2', 'ray', 'saco'];
const CLASS_IDS = CLASS_KEYS.map((key) => {
  const id = WEAPONS.findIndex((w) => w.key === key);
  if (id < 0) throw new Error('Gunfight: arma ausente em WEAPONS: ' + key);
  return id;
});
if (CLASS_IDS.includes(GOLD_KNIFE) || CLASS_KEYS.includes('faca-dourada')) throw new Error('Gunfight: Faca Dourada não entra na rotação');

const FORMATS = {
  '1v1': { n: 1, max: 2, time: 40 },
  '2v2': { n: 2, max: 4, time: 40 },
  '3v3': { n: 3, max: 6, time: 50 },
  '4v4': { n: 4, max: 8, time: 60 },
};
for (const f of Object.values(FORMATS)) Object.freeze(f);

export const GF = Object.freeze({
  mode: 'gf',
  WIN: 6,
  MAX_ROUNDS: 11,
  BLOCK: 2,
  PREP: 4,
  END: 3,
  OT: 10,
  CAP: 3,
  HP: 100,
  ZONE_R: 4.5,
  ZONE_H: 3,
  NADES: 0,
  REGEN: false,
  KILLSTREAKS: false,
  POWERS: false,
  PICKUPS: false,
  CLASS_KEYS: Object.freeze(CLASS_KEYS.slice()),
  CLASSES: Object.freeze(CLASS_IDS.slice()),
  FORMATS: Object.freeze(FORMATS),
  TEAMS: Object.freeze(['Vermelho', 'Azul']),
});
export const PHASES = Object.freeze(['wait', 'prep', 'live', 'ot', 'end', 'over']);
export const isGunfight = (mode) => mode === GF.mode;

const EPS = 1e-6;
const r3 = (v) => Math.round((+v || 0) * 1000) / 1000;

export function maxPlayers(format) {
  const f = GF.FORMATS[format];
  return f ? f.max : 0;
}
export function roundTime(format) {
  const f = GF.FORMATS[format];
  return f ? f.time : 0;
}
export function classInfo(id) {
  const w = WEAPONS[id];
  if (!w) return null;
  return { id, key: w.key, name: w.short || w.name };
}

// 0 = Vermelho no lado 0 e Azul no lado 1. 1 = lados invertidos. Rodadas 1–2, 5–6… = 0; 3–4, 7–8… = 1.
export function sideForRound(round) {
  const n = Math.max(1, round | 0);
  return Math.floor((n - 1) / GF.BLOCK) % 2;
}
// Lado físico do spawn desse time na rodada (0 ou 1). Time fora de 0/1 devolve -1.
export function spawnSide(round, team) {
  if (team !== 0 && team !== 1) return -1;
  return sideForRound(round) ? 1 - team : team;
}

// Próxima classe só quando a PRÓXIMA rodada troca (rodada par: 2, 4, 6…). Senão null.
export function nextClass(S) {
  if (!S || S.over || S.phase === 'over' || S.phase === 'wait' || (S.round | 0) < 1) return null;
  if ((S.round | 0) % GF.BLOCK !== 0) return null;
  return S.nextClassId;
}

export function rollClass(prev, used = [], rnd = Math.random) {
  const pool = GF.CLASSES;
  const ban = new Set(Array.isArray(used) ? used : []);
  let pick = pool.filter((id) => id !== prev && !ban.has(id));
  if (!pick.length) pick = pool.filter((id) => id !== prev);
  if (!pick.length) pick = pool.slice();
  const r = typeof rnd === 'function' ? +rnd() : Math.random();
  const u = Number.isFinite(r) ? r : 0;
  const i = Math.max(0, Math.min(pick.length - 1, Math.floor(u * pick.length)));
  return pick[i];
}

function blank(format) {
  return {
    format,
    round: 0,
    phase: 'wait',
    timeLeft: 0,
    score: [0, 0],
    classId: -1,
    nextClassId: -1,
    used: [],
    capTeam: -1,
    capProg: 0,
    contested: false,
    lastWin: -1,
    reason: '',
    over: false,
    winner: -1,
    zone: null,
  };
}

export function normGunfightZone(zone) {
  if (!zone) return null;
  const src = Array.isArray(zone) ? { x: zone[0], y: zone[1], z: zone[2] } : zone;
  if (!src || src.x == null || src.z == null) return null;
  return {
    x: +src.x || 0,
    y: +src.y || 0,
    z: +src.z || 0,
    r: src.r > 0 ? +src.r : GF.ZONE_R,
    h: src.h > 0 ? +src.h : GF.ZONE_H,
  };
}

export function createGunfight(cfg = {}) {
  const format = cfg && GF.FORMATS[cfg.format] ? cfg.format : '2v2';
  const rnd = cfg && typeof cfg.rnd === 'function' ? cfg.rnd : Math.random;
  const S = blank(format);
  S.zone = normGunfightZone(cfg && cfg.zone);
  const first = rollClass(-1, [], rnd);
  S.classId = first;
  S.used = [first];
  S.nextClassId = rollClass(first, S.used, rnd);
  return S;
}

// Uma arma só. Não mexe em e.guns / e.knife / e.sniper / e.ownGuns (skin da conta).
// e.kit (peça da bancada, não skin) zera, igual ao X1. Recusa id fora da rotação, inclusive a Faca Dourada.
export function equipGunfight(e, classId) {
  if (!e) return e;
  const w = classId | 0;
  const W = WEAPONS[w];
  if (!W || !GF.CLASSES.includes(w)) return e;
  e.primary = e.nextPrimary = w;
  e.secondary = e.nextSecondary = w;
  e.melee = e.nextMelee = w;
  e.slots = [w];
  e.weapon = w;
  e.prevWeapon = w;
  e.knifeMode = false;
  e.kit = {};
  e.mag = WEAPONS.map((x) => x.mag);
  e.reserve = WEAPONS.map((x) => x.reserve);
  e.reload = null;
  e.reloadEnd = 0;
  e.switchEnd = 0;
  e.actionEnd = 0;
  e.burstLeft = 0;
  e.nades = 0;
  e.smokeNades = 0;
  e.stunNades = 0;
  e.flashNades = 0;
  e.shocks = 0;
  e.pokeballs = 0;
  e.mg = null;
  e.mgSpin = 0;
  e.mgHeat = 0;
  e.mgHot = false;
  e.mgWant = false;
  e.mgFiring = false;
  e.mgSpinOn = false;
  resetDrums(e);
  resetShield(e);
  resetRegen(e);
  return e;
}

function ready(e, classId) {
  if (!e) return;
  e.alive = true;
  e.hp = GF.HP;
  e.respawnAt = Infinity;
  equipGunfight(e, classId);
}

export function startRound(S, rndOrOpts) {
  if (!S || S.over || S.phase === 'over') return [];
  const opts = typeof rndOrOpts === 'function' ? { rnd: rndOrOpts } : (rndOrOpts || {});
  const rnd = typeof opts.rnd === 'function' ? opts.rnd : Math.random;
  const ents = Array.isArray(opts.ents) ? opts.ents : [];
  S.round += 1;
  if (S.round > 1 && S.round % GF.BLOCK === 1) {
    S.classId = S.nextClassId;
    if (!S.used.includes(S.classId)) S.used.push(S.classId);
    S.nextClassId = rollClass(S.classId, S.used, rnd);
  }
  S.phase = 'prep';
  S.timeLeft = GF.PREP;
  S.capTeam = -1;
  S.capProg = 0;
  S.contested = false;
  S.reason = '';
  for (const e of ents) ready(e, S.classId);
  const ev = [['round', S.round]];
  if (S.round > 1 && sideForRound(S.round) !== sideForRound(S.round - 1)) ev.push(['swap']);
  ev.push(['class', S.classId]);
  return ev;
}

function isUp(e) {
  return !!(e && (e.team === 0 || e.team === 1) && e.alive && !(typeof e.hp === 'number' && e.hp <= 0));
}
// Time que ganha por eliminação, -1 se os dois caíram juntos, null se a rodada segue.
// Time sem ninguém na lista não conta como eliminado.
function wipedWinner(ents) {
  const has = [false, false], up = [false, false];
  for (const e of ents || []) {
    if (!e || (e.team !== 0 && e.team !== 1)) continue;
    has[e.team] = true;
    if (isUp(e)) up[e.team] = true;
  }
  const d0 = has[0] && !up[0], d1 = has[1] && !up[1];
  if (d0 && d1) return -1;
  if (d0) return 1;
  if (d1) return 0;
  return null;
}

function matchCall(S) {
  if (S.score[0] >= GF.WIN) return 0;
  if (S.score[1] >= GF.WIN) return 1;
  if (S.round >= GF.MAX_ROUNDS) {
    if (S.score[0] > S.score[1]) return 0;
    if (S.score[1] > S.score[0]) return 1;
    return -1;
  }
  return null;
}

function finishRound(S, team, why) {
  if (team === 0 || team === 1) S.score[team] += 1;
  S.phase = 'end';
  S.timeLeft = GF.END;
  S.lastWin = team;
  S.reason = why;
  S.capProg = 0;
  S.contested = false;
  const winner = matchCall(S);
  if (winner !== null) { S.over = true; S.winner = winner; }
  return ['win', team, why];
}

export function inGunfightZone(zone, p) {
  const z = normGunfightZone(zone);
  if (!z || !p) return false;
  const py = p.y == null ? z.y : p.y;
  return Math.hypot((+p.x || 0) - z.x, (+p.z || 0) - z.z) <= z.r + EPS && py >= z.y - 1.2 && py <= z.y + z.h;
}

// Quem está sozinho na zona (0|1), ou -1 se vazia, contestada ou sem zona. Atualiza S.contested.
function exclusiveTeam(S, ents) {
  const inn = [false, false];
  if (S.zone) {
    for (const e of ents) if (isUp(e) && inGunfightZone(S.zone, e.pos)) inn[e.team] = true;
  }
  S.contested = inn[0] && inn[1];
  if (inn[0] === inn[1]) return -1;
  return inn[0] ? 0 : 1;
}

function hpRound(S, ents) {
  const hp = hpByTeam(ents);
  if (hp[0] > hp[1]) return finishRound(S, 0, 'hp');
  if (hp[1] > hp[0]) return finishRound(S, 1, 'hp');
  return finishRound(S, -1, 'draw');
}

function stepOvertime(S, ents, dt) {
  const w = wipedWinner(ents);
  if (w !== null) return [finishRound(S, w, w < 0 ? 'draw' : 'elim')];
  const who = exclusiveTeam(S, ents);
  if (who >= 0) {
    if (S.capTeam !== who) { S.capTeam = who; S.capProg = 0; }
    const need = GF.CAP - S.capProg;
    if (need <= dt + EPS && need <= S.timeLeft + EPS) {
      S.capProg = GF.CAP;
      S.timeLeft = Math.max(0, S.timeLeft - Math.max(need, 0));
      return [finishRound(S, who, 'cap')];
    }
    S.capProg += Math.min(dt, Math.max(S.timeLeft, 0));
  }
  S.timeLeft -= dt;
  if (S.timeLeft > EPS) return [];
  S.timeLeft = 0;
  return [hpRound(S, ents)];
}

export function stepGunfight(S, dt, world) {
  if (!S || S.phase === 'over') return [];
  const W = world && typeof world === 'object' ? world : {};
  const ents = Array.isArray(W.ents) ? W.ents : [];
  const rnd = typeof W.rnd === 'function' ? W.rnd : Math.random;
  if (W.zone) S.zone = normGunfightZone(W.zone);
  const step = Number.isFinite(+dt) ? Math.max(0, +dt) : 0;
  if (S.phase === 'wait') return [];
  if (S.phase === 'prep') {
    S.timeLeft -= step;
    if (S.timeLeft > EPS) return [];
    S.phase = 'live';
    S.timeLeft = roundTime(S.format);
    return [['go']];
  }
  if (S.phase === 'live') {
    const w = wipedWinner(ents);
    if (w !== null) return [finishRound(S, w, w < 0 ? 'draw' : 'elim')];
    S.timeLeft -= step;
    if (S.timeLeft > EPS) return [];
    S.phase = 'ot';
    S.timeLeft = GF.OT;
    S.capTeam = -1;
    S.capProg = 0;
    S.contested = false;
    return [['ot']];
  }
  if (S.phase === 'ot') return stepOvertime(S, ents, step);
  if (S.phase === 'end') {
    S.timeLeft -= step;
    if (S.timeLeft > EPS) return [];
    if (S.over) { S.phase = 'over'; S.timeLeft = 0; return [['over', S.winner]]; }
    return startRound(S, { rnd, ents });
  }
  return [];
}

// Marca a vítima fora e, no live/ot, encerra a rodada se o time dela acabou.
// `ents` é o elenco inteiro — sem ele a eliminação fica pro próximo stepGunfight.
export function onKill(S, victim, ents) {
  if (!S) return [];
  if (victim) {
    victim.alive = false;
    victim.hp = 0;
    victim.respawnAt = Infinity;
  }
  if (S.phase !== 'live' && S.phase !== 'ot') return [];
  const list = Array.isArray(ents) ? ents : [];
  const w = wipedWinner(list);
  if (w === null) return [];
  return [finishRound(S, w, w < 0 ? 'draw' : 'elim')];
}

export const gunfightFrozen = (S) => !!S && S.phase !== 'live' && S.phase !== 'ot';
// A rodada não devolve a vida. Quem cai espera o prep seguinte, que o startRound recompõe.
export function allowsRespawn(_state) {
  return false;
}

export function aliveByTeam(ents = []) {
  const n = [0, 0];
  for (const e of ents) if (isUp(e)) n[e.team] += 1;
  return n;
}
export function hpByTeam(ents = []) {
  const h = [0, 0];
  for (const e of ents) if (isUp(e)) h[e.team] += Math.max(0, +e.hp || 0);
  return h;
}
export function gunfightHud(S, ents = []) {
  const cur = S ? classInfo(S.classId) : null;
  const nxtId = nextClass(S);
  const nxt = nxtId == null ? null : classInfo(nxtId);
  return {
    round: S ? S.round | 0 : 0,
    score: S ? [S.score[0] | 0, S.score[1] | 0] : [0, 0],
    phase: S ? S.phase : 'wait',
    timeLeft: S ? Math.max(0, S.timeLeft || 0) : 0,
    classId: S ? S.classId : -1,
    classKey: cur ? cur.key : '',
    className: cur ? cur.name : '',
    nextClassId: nxtId,
    nextClassKey: nxt ? nxt.key : '',
    side: sideForRound(S ? S.round : 1),
    alive: aliveByTeam(ents),
    hp: hpByTeam(ents),
    contested: !!(S && S.contested),
    capTeam: S ? S.capTeam : -1,
    capProg: S ? S.capProg || 0 : 0,
    capNeed: GF.CAP,
    over: !!(S && S.over),
    winner: S ? S.winner : -1,
    reason: S && S.reason || '',
  };
}

// Pacote achatado pra snapshot. Versão no índice 0. `used` viaja como lista de ids.
export function packGunfight(S) {
  const z = S && S.zone;
  return [
    1,
    S.format,
    S.round | 0,
    S.phase,
    r3(S.timeLeft),
    S.score[0] | 0,
    S.score[1] | 0,
    S.classId | 0,
    S.nextClassId | 0,
    (S.used || []).map((id) => id | 0),
    S.capTeam | 0,
    r3(S.capProg),
    S.lastWin | 0,
    S.reason || '',
    S.over ? 1 : 0,
    S.winner | 0,
    S.contested ? 1 : 0,
    z ? r3(z.x) : null,
    z ? r3(z.y) : null,
    z ? r3(z.z) : null,
    z ? r3(z.r) : null,
    z ? r3(z.h) : null,
  ];
}
export function unpackGunfight(a, S = blank('2v2')) {
  if (!S) S = blank('2v2');
  if (!Array.isArray(a) || a[0] !== 1) return S;
  const [ , format, round, phase, timeLeft, s0, s1, classId, nextClassId, used, capTeam, capProg, lastWin, reason, over, winner, contested, zx, zy, zz, zr, zh ] = a;
  S.format = GF.FORMATS[format] ? format : (S.format || '2v2');
  S.round = round | 0;
  S.phase = PHASES.includes(phase) ? phase : 'prep';
  S.timeLeft = r3(timeLeft);
  S.score = [s0 | 0, s1 | 0];
  S.classId = classId | 0;
  S.nextClassId = nextClassId | 0;
  S.used = Array.isArray(used) ? used.map((id) => id | 0) : [];
  S.capTeam = capTeam | 0;
  S.capProg = r3(capProg);
  S.lastWin = lastWin | 0;
  S.reason = reason || '';
  S.over = !!over;
  S.winner = winner | 0;
  S.contested = !!contested;
  S.zone = zx == null ? null : normGunfightZone({ x: zx, y: zy, z: zz, r: zr, h: zh });
  return S;
}

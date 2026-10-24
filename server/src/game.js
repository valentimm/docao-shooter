// ============================================================
//  Simulação autoritativa de uma sala online (roda dentro do Durable Object).
//  Não depende de APIs da Cloudflare: recebe callbacks send/broadcast/loop.
//  Autoridade do servidor: acertos (hitscan com rewind ~100 ms + ping/2), dano, abates, placar, renascimento,
//  pickups, Copo Bomba e foguetes (física + explosão), tempo de partida, fim de partida e bots.
//  O cliente é dono só do próprio movimento (com checagem de velocidade/paredes) e manda eventos de tiro com origem+direção.
// ============================================================
import { MAPS, PLAY_MAPS, INV_MAPS, BOMB_MAPS, INF_MAPS, getMap } from '../../maps.js';
import { INF, isInfection, SURV, ZOMB, clampInfMax, alphaCount, alphaHp, knifeCd, packInf, stepKnife } from '../../shared/infection.js';
import { INV, INV_AMMO, DROP_KEYS, invRefillAmmo, isInvasion, InvasionCore, POWER_KEYS, modelAim } from '../../shared/invasion.js';
import { TRAIN, isTraining, dummyX } from '../../shared/training.js';
import { buildNav } from '../../nav.js';
import { SKINS, skinOk } from '../../skins.js';
import { EARN } from '../../shared/closet.js';
import { CHAL_MODES } from '../../shared/challenges.js';
import { cleanName, uniqueName, NAME_MAX } from '../../shared/names.js';
import { KILL_LIMIT, TIME_LIMIT, normTime, RESPAWN_TIME, INVULN, JUMP, SPEED, BOT_SPEED, EYE, WEAPONS, PRIMARIES, SECONDARIES, MELEES, PISTOL, KNIFE, SABER, SABER2, isSaber, POKE, isPokeCode, MINIGUN, isMiniCode, UZI, P90, DISC_W, CORN_W, EGG_W, NAIL, SEMI, MELEE, W_NADE, NADE, BACON_ITEM, noteHurt, resetRegen, regenStep, BOT_DEFS, BOT_RANGE, TAG_COLORS, TAMPA } from '../../shared/rules.js';
import { normBotDiff, applyBotDiff, profileOf, nextThink, considerTarget, hitscanAim, nadeChoice, nadeWaitFor, nadeCooldown, rollStrafe, wantPanicReload, wantSafeReload, refreshCover, refreshFlank, hearGunshot as noteGunshot, scopeDelay } from '../../shared/bot-difficulty.js';
import { SHIELD, isShieldW, shieldRaised, resetShield, bulletOnShield, splashOnShield, meleeOnShield, hurtShield, noteBlocked, shieldBashHit, classifyRay, raisedAt, shieldAim, aimOffset, botWantsShield } from '../../shared/shield.js';
import { normWeapons, normPowers, clampLoadout, botPool, weaponOn, powerOn } from '../../shared/loadout.js';
import { clampKitMap, resolveWeapon } from '../../shared/attachments.js';
import { DANCE_TIME, danceId } from '../../shared/emote.js';
import { meleeHit, MELEE_KINDS } from '../../shared/melee.js';
import { mapSolids, createPhysics, raySphere, HITBOXES, rayHitboxes } from '../../shared/physics.js';
import { stanceScale, stanceHeight, stepCrouch } from '../../shared/stance.js';
import { traceShot } from '../../shared/penetration.js';
import { DISC, stepDisc } from '../../shared/disc.js';
import { CORN, cornDirs, cornAim, stepCorn, popChain, popOpts } from '../../shared/corn.js';
import { EGG, eggSpeed, eggDmg, stepEgg } from '../../shared/egg.js';
import { explosionHits, rayCapsule, ROCKET_PAD, shotKnock } from '../../shared/combat.js';
import { SHOCK, stepShock, shockTop, shockReach, shockDmg, shockStun } from '../../shared/shock.js';
import { streakRewards, PREDATOR, HELI, GUNNER, NUKE, heliOrbit, heliPos, AC130 } from '../../shared/killstreaks.js';
import { DOM, pickZone, newZoneState, zoneCounts, stepZone, canJoinTeam, smallerTeam, inZone } from '../../shared/domination.js';
import { BOMB, W_BOMB, bombLayout, newBombState, startRound, stepBomb, blastVictims, packBomb, spawnList, botObjective, bombFrozen } from '../../shared/bomb.js';
import { rounds, spendRound, drumsFull, drumsEmpty, refillDrums, resetDrums, setDrum, pickBotSecondary, akimboReady, ammoLow } from '../../shared/revolver.js';
import { SABER_KIT, profileOf as saberProfile, moveScale, ensureSaber, stepStamina, guardOpen, inFront, payGuard, payProjectile, bladeTouch, peekSwing, applySwing, tryDash, trySpecial, spinDue, catchBlade, botSkill, botPlan, targetsInArc } from '../../shared/saber.js';
const CHAL_WEAPONS = { shotgun: 'w_shot', semi: 'w_shot', sniper: 'w_snip', canhao: 'w_snip', carabina: 'w_snip', besta: 'w_bow', arco: 'w_bow', estilingue: 'w_bow', sabre: 'w_saber', sabre2: 'w_saber', bazooka: 'w_boom', milho: 'w_boom' }; // grupos de armas dos desafios
const MODE_OK = (m) => (m === 'dom' || m === 'bomb' || isTraining(m) || isInvasion(m) || isInfection(m) ? m : 'dm');
const maxFor = (mode, n) => (isInfection(mode) ? clampInfMax(n) : clamp(n | 0 || 6, 2, MAX_PLAYERS)); // Infecção: até 50; o resto: até 10

export const MAX_PLAYERS = 10;
const RS_SAFETY = 60; // s: cliente antigo que nunca manda 'rs' renasce sozinho depois disso
const PX_COOLDOWN = 10; // s: mínimo entre duas trocas de arma na pausa que derrubam o jogador (fora Treino e Invasão)
const PENDING_WAIT = 60; // s de relógio de parede pra escolher o time ao entrar no meio; depois vai no Automático
const TICK = 0.05, HIST = 1.0, DC_GRACE = 30;
const TICK_DT = (g) => clamp(g.T - (g.lastZoneT ?? g.T), 0, 0.25) + (g.lastZoneT = g.T, 0);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = (v) => Math.round(v * 100) / 100;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const vlen = (v) => Math.hypot(v.x, v.y, v.z);
const norm = (v) => { const l = vlen(v) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const arr3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
const obj3 = (a) => (Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) ? { x: a[0], y: a[1], z: a[2] } : null);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const copyKit = (k) => { const o = {}; for (const [key, v] of Object.entries(k || {})) o[key] = { ...v }; return o; };
const center = (e, y = 1.0, p = e.pos) => ({ x: p.x, y: p.y + y * stanceScale(e.crouch), z: p.z });

export class Game {
  constructor(cfg, io) {
    this.test = !!cfg.test; // só no `wrangler dev` com ALLOW_TEST=1: aceita teleporte (testes automatizados)
    this.cfg = { code: cfg.code, map: cfg.map || 'arena', max: maxFor(cfg.mode, cfg.max), fillBots: cfg.fillBots !== false, botDiff: normBotDiff(cfg.botDiff), mode: MODE_OK(cfg.mode), time: normTime(cfg.time), chat: cfg.chat !== false, weapons: normWeapons(cfg.weapons), powers: normPowers(cfg.powers) };
    this.chatLog = Array.isArray(cfg.chatLog) ? cfg.chatLog.filter((x) => x && typeof x.text === 'string').slice(-30) : [];
    this.io = io; // { send(id, obj), broadcast(obj), startLoop(), stopLoop() }
    this.ents = new Map(); this.nextId = 1; this.hostId = 0;
    this.state = 'lobby'; this.mapId = null; this.T = 0; this.t0 = 0;
    this.events = []; this.personal = new Map(); this.nades = []; this.shocks = []; this.rockets = []; this.blades = []; this.discs = []; this.eggs = []; this.corns = []; this.cornPops = []; this.pickups = []; this.bacons = []; this.helis = []; this.gunships = []; this.nukes = []; this.projId = 1;
    this.forcedWinTeam = null; this.nukeWinner = 0;
  }
  now() { return Date.now() / 1000; }
  // o mundo só avança com mensagens (limite de CPU): depois de um tempo parado, T fica velho. Acerta pelo relógio de parede antes de usar.
  syncClock() { if (this.state === 'playing' && this.t0) this.T = Math.max(this.T, this.now() - this.t0); }
  get teamMode() { return this.cfg.mode === 'dom' || this.cfg.mode === 'bomb'; } // Dominação e Bomba têm times
  get bombMode() { return this.cfg.mode === 'bomb'; }
  get invasion() { return isInvasion(this.cfg.mode); } // Modo Invasão: co-op contra zumbis (shared/invasion.js)
  get infMode() { return isInfection(this.cfg.mode); } // Modo Infecção: zumbis × sobreviventes (shared/infection.js)
  get mapList() { return this.bombMode ? BOMB_MAPS : this.invasion ? INV_MAPS : this.infMode ? INF_MAPS : PLAY_MAPS; } // Bomba: só os mapas com sites feitos à mão
  nextMapId() { const L = this.mapList; return L[(L.findIndex((m) => m.id === this.mapId) + 1) % L.length].id; }
  get training() { return isTraining(this.cfg.mode); } // Estande do Docão: bots = alvos parados/andando
  live() { return [...this.ents.values()].filter((e) => e.bot || e.connected); }
  teamCounts(exclude, humansOnly = true) { const c = [0, 0]; for (const e of this.live()) if (e !== exclude && (!humansOnly || !e.bot) && (e.team === 0 || e.team === 1)) c[e.team]++; return c; }
  // escolha de time (lobby, pré-partida ou entrando no meio): -1 = automático. Bloqueia se deixaria 2+ humanos a mais.
  chooseTeam(e, want) {
    want = want === 0 || want === 1 ? want : -1; e.teamPref = want;
    const c = this.teamCounts(e); let team = want, blocked = false;
    if (want >= 0 && !canJoinTeam(want, c)) { blocked = true; team = -1; e.teamPref = -1; } // bloqueado: vira Automático
    if (team < 0) team = smallerTeam(c);
    e.team = team; return { team, blocked };
  }
  humans(connectedOnly = true) { return [...this.ents.values()].filter((e) => !e.bot && (!connectedOnly || e.connected)); }
  // ---------- entrada/saída ----------
  // acct (opcional): { id, nick, skin } já conferido pelo Worker. Com conta, o nome é o apelido fixo e a skin é a da conta.
  join({ name, skin, primary, secondary, melee, token, acct }) {
    this.syncClock(); this.purge();
    let e = token ? [...this.ents.values()].find((x) => !x.bot && x.token === token) : null;
    if (acct && (!e || !e.acct || e.acct.id !== acct.id)) e = [...this.ents.values()].find((x) => !x.bot && x.acct && x.acct.id === acct.id) || null; // mesma conta de volta (outra aba / voltou do zero): assume o lugar
    if (e && (acct ? (!e.acct || e.acct.id !== acct.id) : e.acct)) e = null; // token de sala que não é seu (convidado não herda lugar de conta): ignora
    if (e) { if (acct && e.acct) { e.name = acct.nick; if (skinOk(acct.skin)) e.skin = acct.skin; } e.cameBack = !e.connected; e.connected = true; e.dcAt = 0; e.voice = 'off'; } // reconexão: mesmo id e placar; o microfone volta mudo
    else {
      if (this.humans().length >= this.cfg.max) return { error: 'Sala cheia' };
      if (acct) { for (const x of this.ents.values()) if (!x.acct && x.name.toLowerCase() === acct.nick.toLowerCase()) x.name = this.freeName(Array.from(x.name).slice(0, NAME_MAX - 7).join('') + ' (conv)', x); } // o apelido da conta é dela: quem estava usando vira "(conv)"
      e = this.makeEnt({ name: acct ? acct.nick : this.freeName(name), skin: acct && skinOk(acct.skin) ? acct.skin : SKINS.some((x) => x.id === skin) ? skin : undefined, primary, secondary, melee, bot: false });
      e.jt = this.state === 'playing' ? this.T : 0; // quando entrou (segundos de partida): bônus de fim só pra quem jogou um tempo
      if (acct) { e.acct = { id: acct.id, nick: acct.nick }; e.sk = 0; e.sd = 0; e.ck = 0; e.cpaid = 0; }
      if (this.teamMode) { this.chooseTeam(e, -1); if (this.state === 'playing') { e.pendingTeam = true; e.pendingSince = this.now(); } }
      if (this.infMode) e.team = this.state === 'playing' && this.infS && this.infS.phase !== 'wait' ? ZOMB : SURV; // depois do surto entra como zumbi
      e.token = token && /^[a-z0-9]{8,32}$/i.test(token) ? token : Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
      e.arrived = true;
    }
    // Partida no ar: o humano ocupa a vaga de um bot (mata-mata e dominação). Reconectar também, porque a saída tinha preenchido o lugar.
    if (this.state === 'playing' && this.P && !this.training && !this.invasion) this.syncBots();
    if (!this.hostId || !this.ents.get(this.hostId)?.connected) this.hostId = e.id;
    return { ent: e };
  }
  // skin equipada e JÁ conferida pelo Worker (dona dos itens); nunca vem direto do cliente
  setVerifiedSkin(id, skin) { const e = this.ents.get(id); if (e && e.acct && skinOk(skin)) { e.skin = skin; return true; } return false; }
  welcome(e) {
    this.syncClock(); if (this.state === 'playing') this.io.startLoop(); // o loop para quando o último humano sai: volta ao entrar/reconectar
    const fresh = !!e.arrived; e.arrived = false;
    this.io.send(e.id, { t: 'welcome', id: e.id, token: e.token, code: this.cfg.code, hostId: this.hostId, cfg: this.cfg, state: this.state, maps: MAPS.map((m) => [m.id, m.name]), chat: this.chatLog });
    if (this.state === 'lobby') this.sendLobby();
    else {
      this.io.send(e.id, this.startMsg());
      if (this.state === 'playing') { this.events.push(['j', this.entInfo(e)]); if (!e.alive) e.needRs = false; if (!e.alive) e.respawnAt = e.pendingTeam ? this.T + PENDING_WAIT : Math.min(e.respawnAt || this.T, this.T + 0.5); } // escolhendo time: espera até 60 s (depois vai no Automático)
      if (this.state === 'over') this.io.send(e.id, this.endMsg());
    }
    this.sendLobby();
    if (fresh) this.postChat({ sys: 1, text: `${e.name} entrou` });
    else if (e.cameBack) this.postChat({ sys: 1, text: `${e.name} voltou` });
    e.cameBack = false;
    this.sendVoices();
  }
  leave(id) {
    const e = this.ents.get(id); if (!e) return;
    if (e.acct) this.flushStats(e, false);
    const name = e.name, bot = e.bot;
    e.connected = false; e.dcAt = this.now(); e.alive = false; e.voice = 'off';
    if (this.hostId === id) { const h = this.humans()[0]; this.hostId = h ? h.id : 0; }
    if (this.state === 'lobby') this.ents.delete(id);
    else this.events.push(['l', id]);
    if (this.infMode && this.state === 'playing') this.infAfterLeave(e);
    this.syncBots(); this.sendLobby();
    if (!bot) this.postChat({ sys: 1, text: `${name} saiu` });
    this.sendVoices();
    if (!this.humans().length) this.io.stopLoop();
  }
  purge() { // remove quem caiu e não voltou (o “saiu” já foi pro chat no leave)
    const t = this.now();
    for (const e of [...this.ents.values()]) if (!e.bot && !e.connected && t - e.dcAt > DC_GRACE) this.ents.delete(e.id);
  }
  // nome limpo e sem repetir ("Matheus (2)") entre quem está na sala (humanos conectados e bots)
  freeName(raw, self = null) { return uniqueName(cleanName(raw), [...this.ents.values()].filter((x) => x !== self).map((x) => x.name)); }
  // Arma fora da lista da sala volta para a primeira liberada daquele slot. live = já vale na mão (lobby); na partida vale no próximo nascimento.
  applyLoadout(e, primary, secondary, melee, live, kit) {
    const c = clampLoadout(PRIMARIES.includes(primary) ? primary : e.nextPrimary, SECONDARIES.includes(secondary) ? secondary : e.nextSecondary, MELEES.includes(melee) ? melee : e.nextMelee, this.cfg.weapons);
    e.nextPrimary = c.primary; e.nextSecondary = c.secondary; e.nextMelee = c.melee;
    if (arguments.length > 5) { e.nextKit = clampKitMap(kit); if (live) e.kit = copyKit(e.nextKit); }
    if (live) { e.primary = c.primary; e.secondary = c.secondary; e.melee = c.melee; e.slots = [c.primary, c.secondary, c.melee]; if (!e.slots.includes(e.weapon)) e.weapon = c.primary; }
    return c;
  }
  resolvedW(e, w) {
    const base = WEAPONS[w];
    if (!base || !e || e.bot) return base;
    return resolveWeapon(w, e.kit && e.kit[base.key]);
  }
  makeEnt({ name, skin, primary, secondary, melee, bot }) {
    const id = this.nextId++;
    const rawP = bot ? (botPool(this.cfg.weapons).includes(primary) ? primary : pick(botPool(this.cfg.weapons))) : primary;
    const c = clampLoadout(rawP, secondary, melee, this.cfg.weapons);
    const prim = c.primary, sec = c.secondary, mel = c.melee;
    const e = { id, bot, name: cleanName(name), skin: skinOk(skin) ? skin : pick(SKINS).id, tag: TAG_COLORS[(id - 1) % TAG_COLORS.length],
      primary: prim, nextPrimary: prim, secondary: sec, nextSecondary: sec, melee: mel, nextMelee: mel, slots: [prim, sec, mel], weapon: 0, kit: {}, nextKit: {},
      pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, crouch: 0, onGround: true, hp: 100, alive: false, kills: 0, deaths: 0, invulnUntil: 0, respawnAt: 0,
      nades: 0, mag: WEAPONS.map((w) => w.mag), reserve: WEAPONS.map((w) => w.reserve), lastShot: WEAPONS.map(() => -9), lastShotL: WEAPONS.map(() => -9), lastCt: [], lastCtL: [], reload: null, hist: [], ping: 0, lastUpd: 0, sq: 0, lastKnock: -9,
      connected: !bot, dcAt: 0, lastAttacker: 0, team: -1, teamPref: -1, caps: 0, voice: 'off', shieldHp: 0, shieldBroken: false, shieldBlocked: 0, shieldMedal: false, shieldDashAt: -99 };
    if (bot) Object.assign(e, { think: 0, target: null, aim: 0, strafeDir: 1, strafeT: 0, wp: null, path: null, stuck: 0, lastSeen: null, lastSeenAt: -99, nextNade: 0, nextFire: 0, reloadEnd: 0, repathAt: 0 });
    if (bot) applyBotDiff(e, this.cfg.botDiff);
    this.ents.set(id, e); return e;
  }
  entInfo(e) { const o = { id: e.id, name: e.name, skin: e.skin, bot: e.bot, tag: e.tag, kills: e.kills, deaths: e.deaths, alive: e.alive, primary: e.primary, w: e.weapon, team: e.team, caps: e.caps, pend: e.pendingTeam ? 1 : 0 };
    if (e.zt) { o.zt = e.zt; o.hp = Math.round(e.hp); o.mx = Math.round(e.maxHp || 100); } return o; }
  sendLobby() {
    this.io.broadcast({ t: 'lobby', cfg: this.cfg, hostId: this.hostId, state: this.state, mapId: this.mapId,
      players: [...this.ents.values()].filter((e) => (e.bot && !e.zt) || e.connected).map((e) => ({ id: e.id, name: e.name, skin: e.skin, bot: e.bot, ping: e.ping, kills: e.kills, deaths: e.deaths, team: e.team, pref: e.teamPref })) });
  }
  // ---------- bots de preenchimento ----------
  syncBots() {
    if (this.state === 'lobby') return;
    if (this.invasion) return; // Invasão: sem bots de jogador (os zumbis são do core)
    if (this.training) return this.syncDummies();
    const want = this.cfg.fillBots ? Math.max(0, Math.min(this.infMode ? INF.BOT_FILL_MAX : MAX_PLAYERS, this.cfg.max - this.humans().length)) : 0; // Infecção: no máximo INF.BOT_FILL_MAX bots (CPU)
    let bots = [...this.ents.values()].filter((e) => e.bot);
    const tc = () => this.teamCounts(null, false);
    while (bots.length > want) { // Dominação: tira do time maior
      let b = bots[bots.length - 1]; if (this.teamMode) { const c = tc(), big = c[0] >= c[1] ? 0 : 1; b = [...bots].reverse().find((x) => x.team === big) || b; }
      bots = bots.filter((x) => x !== b); this.ents.delete(b.id); this.events.push(['l', b.id]);
    }
    if (this.teamMode) { // rebalanceia bots se um time ficou 2+ maior
      for (let i = 0; i < MAX_PLAYERS; i++) { const c = tc(), big = c[0] > c[1] ? 0 : 1; if (c[big] - c[1 - big] < 2) break; const b = bots.find((x) => x.team === big); if (!b) break; b.team = 1 - big; this.events.push(['tm', b.id, b.team]); }
    }
    const used = new Set(this.live().map((b) => b.name)); // bot não pega nome de humano
    while (bots.length < want) {
      const name = BOT_DEFS.map((d) => d.name).find((n) => !used.has(n)) || 'Bot ' + this.nextId; used.add(name);
      const b = this.makeEnt({ name, skin: pick(SKINS).id, primary: pick(botPool(this.cfg.weapons)), secondary: pickBotSecondary(this.cfg.weapons), bot: true }); bots.push(b);
      if (this.teamMode) b.team = smallerTeam(tc());
      if (this.infMode) b.team = this.state === 'playing' && this.infS && this.infS.phase !== 'wait' ? ZOMB : SURV;
      if (this.state === 'playing') { this.events.push(['j', this.entInfo(b)]); this.spawn(b); }
    }
  }
  // Treino: um alvo por posição do mapa (independe de max/bots); recria se a lista mudou
  syncDummies() {
    const D = (this.map && this.map.dummies) || [], bots = [...this.ents.values()].filter((e) => e.bot);
    if (bots.length === D.length && bots.every((b, i) => b.dummy === D[i])) return;
    for (const b of bots) { this.ents.delete(b.id); this.events.push(['l', b.id]); }
    D.forEach((d) => {
      const b = this.makeEnt({ name: d.name, skin: pick(SKINS).id, primary: 0, bot: true }); b.name = d.name; b.dummy = d;
      if (this.state === 'playing') { this.events.push(['j', this.entInfo(b)]); this.spawn(b); }
    });
  }
  placeDummy(b) {
    const d = b.dummy, x = dummyX(d, this.T), y = this.P.groundAt(x, d.z, (d.y || 0) + 0.3), px = b.pos.x;
    b.pos = { x, y, z: d.z }; b.vel = { x: 0, y: 0, z: 0 }; b.onGround = true; b.yaw = d.yaw || 0; b.pitch = 0; b.weapon = PISTOL;
    return x - px;
  }
  removeOneBot() { const b = [...this.ents.values()].reverse().find((e) => e.bot); if (b) { this.ents.delete(b.id); this.events.push(['l', b.id]); } }
  // ---------- partida ----------
  startMatch(mapId) {
    const LIST = this.mapList;
    const id = this.training ? TRAIN.map : mapId === 'random' || !LIST.some((m) => m.id === mapId) ? (this.invasion && mapId !== 'random' ? INV.DEFAULT_MAP : this.infMode && mapId !== 'random' ? INF.DEFAULT_MAP : pick(LIST.filter((m) => m.id !== this.mapId)).id) : mapId;
    if (this.invasion) for (const b of [...this.ents.values()]) if (b.bot) { this.ents.delete(b.id); } // começa sem zumbi velho/bot
    const map = getMap(id); this.mapId = id; this.map = map;
    const solids = mapSolids(map); this.P = createPhysics(solids, map.size);
    this.spawns = map.spawns.map(([x, z, y = 0]) => ({ x, y: this.P.groundAt(x, z, y + 0.3), z }));
    this.nav = buildNav({ hx: map.size[0], hz: map.size[1], spacing: map.navSpacing || 2, collides: this.P.collides, groundAt: this.P.groundAt, solids, topAt: this.P.topAt, seeds: this.spawns.map((s) => [s.x, s.y, s.z]), extra: map.waypoints || [] });
    this.pickups = (this.invasion && map.invPickups ? [...map.pickups, ...map.invPickups] : map.pickups).map(([type, x, z, y]) => { const on = powerOn(type, this.cfg.powers); return { type, pos: { x, y: this.P.groundAt(x, z, (y || 0) + 0.3), z }, active: on, respawnAt: on ? 0 : 1e9 }; });
    this.nades = []; this.shocks = []; this.rockets = []; this.blades = []; this.discs = []; this.eggs = []; this.corns = []; this.cornPops = []; this.bacons = []; this.helis = []; this.gunships = []; this.nukes = []; this.events = []; this.personal.clear();
    this.state = 'playing'; this.t0 = this.now(); this.T = 0; this.lastTick = this.now();
    this.infS = null; this.zknives = []; // Infecção: os bots de preenchimento abaixo nascem sobreviventes
    this.curLimit = this.cfgLimit;
    for (const e of this.ents.values()) { e.ck = 0; e.cpaid = 0; e.jt = 0; e.cpl = 0; e.cdf = 0; e.vu = e.voice && e.voice !== 'off' ? 1 : 0;
      e.kills = 0; e.deaths = 0; e.alive = false; e.needRs = false; e.caps = 0; e.pendingTeam = false; if (!this.teamMode) e.team = this.infMode ? SURV : -1; e.zAlpha = false; e.zOut = false; e.zkReady = 0;
      // this.T e o relógio do cliente voltam a 0 na partida nova: zera cadência/anti speed-hack, senão os tiros da partida anterior
      // (lastShot/lastCt/lastMelee no futuro) fazem o servidor rejeitar todo tiro no "Próximo mapa"/"Jogar de novo" (sem dano)
      e.lastShot = WEAPONS.map(() => -9); e.lastShotL = WEAPONS.map(() => -9); e.lastCt = []; e.lastCtL = []; e.maxOff = undefined; e.lastMeleeCt = undefined; e.lastMeleeT = undefined; e.lastMeleeRate = 0; e.lastKnock = -9; e.mg = null; e.shotBud = [];
      this.resetStreak(e); e.pokeballs = 0; e.rejectedShots = 0; e.rejectedMelee = 0; e.reload = null; e.hist = []; e.nextFire = 0; e.reloadEnd = 0; e.knifeRoll = 0; e.knifeMode = false;
      if (e.bot) Object.assign(e, { think: 0, lastSeenAt: -99, nextNade: 0, repathAt: 0 });
    }
    if (this.teamMode) { // times
      const hs = this.humans(); // os times do lobby já respeitam a regra; só completa quem está sem time e reequilibra (automáticos primeiro)
      for (const e of hs) if (e.team !== 0 && e.team !== 1) e.team = e.teamPref >= 0 && canJoinTeam(e.teamPref, this.teamCounts(e)) ? e.teamPref : smallerTeam(this.teamCounts(e));
      for (let g = 0; g < 16; g++) {
        const c = this.teamCounts(null), big = c[0] - c[1] >= 2 ? 0 : c[1] - c[0] >= 2 ? 1 : -1; if (big < 0) break;
        const mv = hs.find((x) => x.team === big && x.teamPref < 0) || hs.find((x) => x.team === big); mv.team = 1 - big;
      }
      for (const b of [...this.ents.values()].filter((x) => x.bot)) b.team = -1;
    }
    this.syncBots();
    if (this.teamMode) { for (const b of [...this.ents.values()].filter((x) => x.bot)) b.team = -1; for (const b of [...this.ents.values()].filter((x) => x.bot)) b.team = smallerTeam(this.teamCounts(null, false)); }
    this.teamScore = [0, 0]; this.forcedWinTeam = null; this.nukeWinner = 0; this.zone = this.cfg.mode === 'dom' ? newZoneState(pickZone(this.nav)) : null;
    this.bomb = null; this.bombL = null;
    if (this.bombMode) { // Modo Bomba (protótipo): lados + sites A/B do mapa, rodada 1 começa na preparação
      this.bombL = bombLayout(this.nav, this.spawns, map, this.P.groundAt); this.bomb = newBombState(); this.teamScore = this.bomb.score;
      for (const ev of startRound(this.bomb, 0, this.live())) this.events.push(['bb', ...ev]);
    }
    this.inv = this.invasion ? this.makeInvasion() : null; if (this.inv) this.inv.start();
    this.zknives = []; this.infS = this.infMode ? { phase: 'wait', outbreakAt: INF.OUTBREAK, endAt: INF.OUTBREAK + INF.ROUND, surv: 0, zomb: 0, winner: -1, overAt: 0, infections: 0 } : null;
    if (this.infMode) this.infSpawns = this.makeInfSpawns();
    let si = 0; for (const e of this.ents.values()) if (e.bot || e.connected) { if (this.inv && !e.bot) e.firstSpawn = si++; this.spawn(e, true); }
    this.io.broadcast(this.startMsg()); this.sendLobby();
    this.io.startLoop();
  }
  get cfgLimit() { return this.bombMode ? 1e6 : this.training || this.invasion || this.infMode ? Infinity : this.cfg.time ? this.cfg.time * 60 : this.teamMode ? DOM.TIME_LIMIT_DOM : TIME_LIMIT; } // Treino: não acaba; Bomba: acaba em 13 rodadas, não por tempo
  get timeLimit() { return this.curLimit || this.cfgLimit; } // mudar o tempo no meio da partida só vale na próxima
  zoneArr() { const z = this.zone; return z ? [r2(z.x), r2(z.y), r2(z.z), +z.progress.toFixed(3), z.team, z.contested ? 1 : 0, z.counts[0], z.counts[1], this.teamScore[0], this.teamScore[1]] : null; }
  startMsg() { return { t: 'start', mode: this.cfg.mode, inf: this.infS ? packInf(this.infS) : undefined, iv: this.inv ? this.inv.stateArr() : undefined, drops: this.inv ? this.inv.drops.map((d) => [d.id, DROP_KEYS.indexOf(d.kind), [r2(d.x), r2(d.y), r2(d.z)]]) : undefined, zone: this.zoneArr(), bomb: this.bomb ? { sites: this.bombL.sites.map((s) => [r2(s.x), r2(s.y), r2(s.z)]), atk: this.bombL.atk, def: this.bombL.def, pts: this.bombL.pts ? this.bombL.pts.map((p) => [r2(p.x), r2(p.y), r2(p.z)]) : undefined, s: packBomb(this.bomb) } : undefined, win: DOM.WIN_CAPS, map: this.mapId, T: r2(this.T), limit: Number.isFinite(this.timeLimit) ? this.timeLimit : 0, kills: KILL_LIMIT, hostId: this.hostId, ents: [...this.ents.values()].filter((e) => e.bot || e.connected).map((e) => this.entInfo(e)), pk: this.pickups.map((p) => (p.active ? 1 : 0)) }; }
  // ranking: soma abates/mortes (e partida/vitória no fim) das contas. Treino não conta. Falha de gravação nunca derruba a sala.
  // Docoins (moeda do jogo): o SERVIDOR calcula tudo aqui. Abates contam na hora (e.ck); fim de partida/vitória/waves só no flush final ou na saída.
  // Teto por partida (EARN.matchCap); o teto por dia fica no D1 (recordStats). Treino não rende (flushStats nem chega aqui).
  coinsDelta(e, final, won) {
    let raw = e.ck | 0;
    if (this.inv) { const w = Math.max(0, (this.inv.wave | 0) - 1); raw += w * EARN.invWave + (final && this.inv.won ? EARN.invWin : 0); }
    else if (final && this.T - (e.jt || 0) >= EARN.minSecs) raw += EARN.finish + (won ? EARN.win : 0);
    const earned = Math.max(0, Math.min(EARN.matchCap, raw)), delta = Math.max(0, earned - (e.cpaid | 0)); e.cpaid = earned; return delta;
  }
  // contadores dos desafios desta gravação: o que a sala somou (e.cq) + o que só se sabe no fim/saída (melhor partida, vitória...)
  chalCounts(e, final, won) {
    const q = e.cq || {}; e.cq = {}; const mode = this.cfg.mode;
    if (mode === 'dm' && e.kills > 0) q.mk = e.kills;
    if (this.inv) q.wave = this.inv.wave | 0;
    if ((e.cpl | 0) >= 3 && (e.cdf | 0) >= 2) q.pd32 = 1;
    if (final && (this.inv || this.T - (e.jt || 0) >= EARN.minSecs)) { // partida jogada até o fim (mesma regra do bônus de fim)
      q.m = 1; if (e.vu) q.voice = 1; if (this.humans().length >= 3) q.m3h = 1;
      const bit = CHAL_MODES.indexOf(mode); if (bit >= 0) q.modes = 1 << bit;
      if (won) { q.win = 1; if (mode === 'dm' && e.deaths <= 5) q.win5 = 1; if (mode === 'dom' && e.caps >= 3) q.win3c = 1; if (this.inv && e.deaths === 0) q.win0 = 1; }
    }
    for (const x in q) if (!q[x]) delete q[x];
    return Object.keys(q).length ? q : null;
  }
  flushStats(e, final, won = false) {
    if (!e.acct || this.training || !this.io.stats) return;
    const k = e.sk | 0, d = e.sd | 0; e.sk = 0; e.sd = 0;
    const c = this.coinsDelta(e, final, won), q = this.chalCounts(e, final, won);
    if (!k && !d && !c && !final && !q) return;
    try { this.io.stats([{ acct: e.acct.id, mode: this.cfg.mode, k, d, c, w: final && won ? 1 : 0, m: final ? 1 : 0, q }]); } catch (err) { console.error('stats', err && err.message); }
  }
  matchWon(e, rows) {
    if (this.inv) return !!this.inv.won;
    if (this.infS) return this.infS.winner >= 0 && e.team === this.infS.winner; // Infecção: o time de quem está no fim (sobrevivente que virou zumbi perde com os sobreviventes)
    if (this.teamMode) { const ts = (this.bomb ? this.bomb.score : this.teamScore) || [0, 0], w = this.forcedWinTeam === 0 || this.forcedWinTeam === 1 ? this.forcedWinTeam : ts[0] > ts[1] ? 0 : ts[1] > ts[0] ? 1 : -1; return w >= 0 && e.team === w; } // Fim da chapa: quem chamou vence
    if (this.nukeWinner) return this.nukeWinner === e.id;
    return !!rows[0] && rows[0].id === e.id && rows[0].kills > 0;
  }
  endMatch() {
    const rows = [...this.ents.values()].filter((e) => (e.bot && !e.zt) || e.connected).sort((a, b) => this.score(b) - this.score(a) || a.deaths - b.deaths);
    for (const e of rows) if (e.acct && e.connected) this.flushStats(e, true, this.matchWon(e, rows));
    this.state = 'over'; this.io.stopLoop(); this.zknives = []; this.nades = []; this.shocks = []; this.rockets = []; this.blades = []; this.discs = []; this.eggs = []; this.corns = []; this.cornPops = []; this.helis = []; this.gunships = []; this.nukes = [];
    this.io.broadcast(this.endMsg()); this.sendLobby();
  }
  endMsg() {
    const rows = [...this.ents.values()].filter((e) => (e.bot && !e.zt) || e.connected).sort((a, b) => this.score(b) - this.score(a) || a.deaths - b.deaths);
    const ts = (this.bomb ? this.bomb.score : this.teamScore) || [0, 0], forced = this.forcedWinTeam;
    const winTeam = this.infS ? this.infS.winner : this.teamMode ? (forced === 0 || forced === 1 ? forced : (ts[0] > ts[1] ? 0 : ts[1] > ts[0] ? 1 : -1)) : null;
    const nukeId = !this.teamMode && this.nukeWinner ? this.nukeWinner : 0;
    const hit = nukeId && rows.find((e) => e.id === nukeId);
    const boardRows = hit ? [hit, ...rows.filter((e) => e !== hit)] : rows; // mata-mata: quem estourou fica no topo mesmo com menos abates
    const winner = nukeId || (rows[0] ? rows[0].id : 0);
    return { t: 'end', mode: this.cfg.mode, ts, winTeam, board: boardRows.map((e) => [e.id, e.name, e.kills, e.deaths, e.bot, e.team, e.caps]), winner, map: this.mapId, next: this.nextMapId(), hostId: this.hostId,
      inv: this.inv ? { wave: this.inv.wave, won: this.inv.won ? 1 : 0, kills: this.inv.kills } : undefined, inf: this.infS ? packInf(this.infS) : undefined };
  }
  score(e) { return this.teamMode ? e.kills + 2 * e.caps : e.kills; }
  // ---------- mensagens dos clientes ----------
  onMessage(id, m) {
    this.syncClock();
    const e = this.ents.get(id); if (!e || !m || typeof m !== 'object') return;
    const isHost = id === this.hostId;
    switch (m.t) {
      case 'u': this.onUpdate(e, m); break;
      case 'rs': if (this.state === 'playing' && !e.alive) e.rsReq = true; break; // botão Renascer
      case 'prof': if (typeof m.name === 'string' && this.state !== 'playing' && !e.acct) e.name = this.freeName(m.name, e); // nome só muda fora da partida (as plaquinhas são criadas no início)
         if (SKINS.some((s) => s.id === m.skin)) e.skin = m.skin; this.applyLoadout(e, m.primary, m.secondary, m.melee, this.state === 'lobby', m.kit); this.sendLobby(); break;
      case 'cfg': if (!isHost) return;
        if (m.map === 'random' || MAPS.some((x) => x.id === m.map)) this.cfg.map = m.map;
        if (isInvasion(m.mode) && m.max) m.max = Math.min(m.max | 0, INV.MAX_PLAYERS);
        { const md = (m.mode === 'dm' || m.mode === 'dom' || m.mode === 'bomb' || isTraining(m.mode) || isInvasion(m.mode) || isInfection(m.mode)) && this.state !== 'playing' ? m.mode : this.cfg.mode, top = isInfection(md) ? INF.MAX_PLAYERS : MAX_PLAYERS;
          if (m.max || top < this.cfg.max) this.cfg.max = clamp((m.max | 0) || this.cfg.max, Math.max(2, this.humans().length), top); }
        if (typeof m.fillBots === 'boolean') this.cfg.fillBots = m.fillBots;
        if (typeof m.botDiff === 'string') { const next = normBotDiff(m.botDiff); if (next !== this.cfg.botDiff) { this.cfg.botDiff = next; for (const b of this.ents.values()) if (b.bot && !b.zt && !b.dummy) applyBotDiff(b, next); } else this.cfg.botDiff = next; }
        if (m.time !== undefined) this.cfg.time = normTime(m.time);
        if ((m.mode === 'dm' || m.mode === 'dom' || m.mode === 'bomb' || isTraining(m.mode) || isInvasion(m.mode) || isInfection(m.mode)) && this.state !== 'playing') { this.cfg.mode = m.mode; for (const h of this.humans()) { if (m.mode === 'dom' || m.mode === 'bomb') this.chooseTeam(h, h.teamPref); else { h.team = -1; if (h.voice === 'team') h.voice = 'all'; } } }
        if (typeof m.chat === 'boolean') this.cfg.chat = m.chat;
        if (m.weapons !== undefined || m.powers !== undefined) {
          if (m.weapons !== undefined) this.cfg.weapons = normWeapons(m.weapons);
          if (m.powers !== undefined) this.cfg.powers = normPowers(m.powers);
          const live = this.state !== 'playing';
          for (const h of this.humans(false)) this.applyLoadout(h, h.nextPrimary, h.nextSecondary, h.nextMelee, live);
        }
        this.io.saveCfg && this.io.saveCfg(this.cfg); if (this.state === 'playing') this.syncBots(); this.sendLobby(); this.sendVoices(); break;
      case 'testGod': if (this.test && e.alive) e.invulnUntil = this.T + clamp(+m.s || 0, 0, 120); break; // só testes (ALLOW_TEST=1): invulnerável por s segundos
      case 'testKs': if (this.test && this.state === 'playing' && e.alive) { const n = clamp(m.n | 0, 0, 30); for (let i = 0; i < n; i++) this.streakKill(e); } break; // só testes (ALLOW_TEST=1)
      case 'testKill': if (this.test && this.state === 'playing' && e.alive) { const v = [...this.ents.values()].find((x) => x !== e && x.alive && !x.zt); if (v) this.kill(v, e, e.weapon, !!m.head); } break; // só testes (ALLOW_TEST=1): abate o 1º vivo (ranking); head: 1 = de cabeça (desafio D03)
      case 'testEnd': if (this.test && isHost && this.state === 'playing') this.endMatch(); break; // só testes (ALLOW_TEST=1)
      case 'start': if (!isHost || this.state === 'playing') return; this.startMatch(m.map || (m.next && this.mapId ? this.nextMapId() : this.cfg.map)); break;
      case 'testInv': if (this.test && this.inv && this.state === 'playing') this.testInv(e, m); break; // só testes (ALLOW_TEST=1)
      case 'testInf': if (this.test && this.infS && this.state === 'playing') this.testInf(e, m); break; // só testes (ALLOW_TEST=1): surto já / tempo / virar zumbi
      case 'team': {
        if (!this.teamMode) return; const r = this.chooseTeam(e, m.team);
        if (this.state === 'playing') {
          if (e.pendingTeam) { e.pendingTeam = false; e.respawnAt = this.T + 0.3; this.syncBots(); }
          else if (e.alive) { e.alive = false; e.deaths++; e.respawnAt = this.T + RESPAWN_TIME; this.events.push(['k', 0, e.id, -2, 0, 0, e.deaths]); } // troca no meio: renasce no time novo
          this.events.push(['tm', e.id, e.team]);
        }
        this.io.send(e.id, { t: 'teamOk', team: r.team, blocked: r.blocked, pref: e.teamPref }); this.sendLobby(); this.sendVoices(); break;
      }
      case 'lobby': if (!isHost || this.state !== 'over') return; this.state = 'lobby'; for (const b of [...this.ents.values()]) if (b.bot) this.ents.delete(b.id); this.sendLobby(); break;
      case 'say': this.onSay(e, m); break;
      case 'voice': {
        let scope = m.scope === 'all' || m.scope === 'team' ? m.scope : 'off';
        if (scope === 'team' && !this.teamMode) scope = 'all';
        e.voice = scope; if (scope !== 'off') e.vu = 1; this.sendVoices(); break;
      }
      case 'sig': this.onSig(e, m); break;
      default: break;
    }
  }
  cleanChat(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  hearsChat(h, line) {
    if (line.sys || h.id === line.id) return true;
    if (line.dead && !(this.state === 'playing' && !h.alive)) return false;
    if (line.scope === 'team' && h.team !== line.team) return false;
    return true;
  }
  postChat(line) {
    const row = { id: line.id || 0, name: line.name || '', team: line.team ?? -1, scope: line.scope === 'team' ? 'team' : 'all', dead: line.dead ? 1 : 0, sys: line.sys ? 1 : 0, text: line.text, at: Date.now() };
    this.chatLog.push(row); while (this.chatLog.length > 30) this.chatLog.shift();
    const msg = { t: 'chat', ...row };
    for (const h of this.humans()) if (this.hearsChat(h, row)) this.io.send(h.id, msg);
    if (this.io.saveCfg) this.io.saveCfg();
  }
  onSay(e, m) {
    if (this.cfg.chat === false || e.bot) return;
    const text = this.cleanChat(m.text); if (!text) return;
    if (isPokeCode(text) && this.state === 'playing' && !this.inv) { e.pokeballs = Math.min(POKE.max, (e.pokeballs || 0) + 1); this.toMe(e, ['pkb', e.pokeballs]); } // código da Pokébola
    const now = Date.now();
    const times = e.sayAt = (e.sayAt || []).filter((t) => now - t < 5000);
    if (times.length >= 4) return;
    times.push(now);
    if (isMiniCode(text) && this.state === 'playing' && !this.inv && e.alive && !e.slots.includes(MINIGUN)) this.giveMinigun(e); // código da minigun (passa pelo limite do chat; já tendo, não reabastece nem esfria)
    const scope = m.scope === 'team' && this.teamMode ? 'team' : 'all';
    const dead = this.state === 'playing' && !e.alive ? 1 : 0;
    this.postChat({ id: e.id, name: e.name, team: e.team, scope, dead, text }); this.cq(e, 'chat');
  }
  voiceReaches(from, to) {
    const s = from.voice || 'off'; if (s === 'off' || from === to) return false;
    if (s === 'all') return true;
    return s === 'team' && this.teamMode && from.team >= 0 && from.team === to.team;
  }
  voicePair(a, b) { return this.voiceReaches(a, b) || this.voiceReaches(b, a); }
  sendVoices() {
    this.io.broadcast({ t: 'voices', list: this.humans().map((h) => [h.id, h.voice || 'off', h.team]) });
  }
  onSig(e, m) {
    const other = this.ents.get(m.to | 0);
    if (!other || other.bot || !other.connected || other.id === e.id || !this.voicePair(e, other)) return;
    if (m.kind !== 'offer' && m.kind !== 'answer' && m.kind !== 'ice') return;
    let data = m.data;
    if (m.kind === 'ice') {
      if (!data || typeof data !== 'object' || typeof data.candidate !== 'string' || !data.candidate) return;
      data = { candidate: data.candidate.slice(0, 2000), sdpMid: typeof data.sdpMid === 'string' ? data.sdpMid.slice(0, 32) : null, sdpMLineIndex: Number.isInteger(data.sdpMLineIndex) ? data.sdpMLineIndex : null };
    } else if (typeof data !== 'string' || data.length < 8 || data.length > 6000 || !data.startsWith('v=0')) return;
    this.io.send(other.id, { t: 'sig', from: e.id, kind: m.kind, data });
  }
  onUpdate(e, m) {
    if (this.state !== 'playing') return;
    const t = this.now(); if (Number.isFinite(m.pg)) e.ping = clamp(m.pg | 0, 0, 2000);
    if (Array.isArray(m.ev)) for (const ev of m.ev) if (ev && ev[0] === 'sd') this.saberDash(e, ev); // a investida vale já neste pacote, senão o anti-cheat devolve o passo
    if (m.sq === e.sq && e.alive) {
      const p = obj3(m.p), v = obj3(m.v);
      if (p) {
        const dt = clamp(t - (e.lastUpd || t), 0.016, 1);
        // Não confia em uma redução instantânea da hitbox enviada pelo cliente.
        // Clientes antigos omitem c e continuam em pé.
        stepCrouch(e, m.c, dt, this.P);
        const horiz = Math.hypot(p.x - e.pos.x, p.z - e.pos.z);
        const knocked = this.T - e.lastKnock < 2.5;
        const dash = e.saber && e.saber.dashUntil > this.T ? e.saber : null;
        const dashRate = dash ? (dash.dashDist || 0) / Math.max(0.05, dash.dashDur || 0.16) : 0;
        const dashExtra = dash ? Math.min((dash.dashDist || 0) + 0.5, dashRate * dt + 0.5) : 0;
        // Sabre não reduz o teto: a punição de movimento saiu. A folga extra só existe enquanto a investida autorizada está no ar.
        const maxH = (SPEED * 1.35 * (e.ghostUntil > this.T ? 1.4 : 1) + (knocked ? 22 : 0)) * dt + 0.6 + dashExtra;
        const [hx, hz] = this.map.size;
        const inside = Math.abs(p.x) <= hx && Math.abs(p.z) <= hz && p.y >= -0.5 && p.y < 45;
        if (this.test && m.tp) { e.pos = p; e.lastKnock = this.T; }
        else if (horiz > maxH || !inside || this.P.overlapping(p.x, p.y, p.z, 0.03, stanceHeight(e)) || (p.y - e.pos.y > (knocked ? 12 : 3.2) * Math.max(dt, 0.25) + 1)) {
          e.badMoves = (e.badMoves || 0) + 1; this.toMe(e, ['pos', arr3(e.pos)]); // anti-cheat: devolve pra última posição válida
        } else { e.pos = p; if (v) e.vel = { x: clamp(v.x, -40, 40), y: clamp(v.y, -60, 40), z: clamp(v.z, -40, 40) }; }
        e.lastUpd = t;
      }
      if (Number.isFinite(m.y)) e.yaw = m.y + Math.PI; // câmera → modelo
      if (Number.isFinite(m.pi)) e.pitch = clamp(m.pi, -1.6, 1.6);
      e.onGround = !!m.g;
      if (e.slots.includes(m.w) && m.w !== e.weapon && !(isShieldW(m.w) && e.shieldBroken)) { e.weapon = m.w; e.reload = null; if (m.w === EGG_W) e.eggAt = this.T; if (e.mg && e.mg.on) this.events.push(['mgs', e.id, 0]); e.mg = e.mg && { ...e.mg, on: false, v: 0, at: -1e9 }; } // tampa quebrada não volta pra mão até nascer de novo
      this.pushHist(e);
    }
    e.useHold = !!m.bk; // Modo Bomba: segurando E (plantar/desarmar)
    this.noteEmote(e, m.dn);
    if (Array.isArray(m.ev)) for (const ev of m.ev.slice(0, 24)) this.onEvent(e, ev);
  }
  noteEmote(e, raw) {
    if (typeof raw !== 'string') return;
    const id = danceId(raw);
    if (!id || !e.alive) { e.emote = ''; return; }
    if (e.emote === id) return; // o cliente manda o mesmo id até acabar; '' libera a próxima
    e.emote = id; e.emoteAt = this.T; this.events.push(['dn', e.id, id]);
    if (this.T - (e.danceCnt ?? -99) >= DANCE_TIME) { e.danceCnt = this.T; this.cq(e, 'dance'); } // desafio: uma dança a cada 3,2 s no máximo
  }
  emoting(e) { return !!(e.emote && this.T - (e.emoteAt || 0) < DANCE_TIME); }
  onEvent(e, ev) {
    if (!Array.isArray(ev)) return;
    const [k] = ev;
    if (k === 'pr') { this.applyLoadout(e, ev[1], ev[2], ev[3], false, ev[4]); if ((this.training || bombFrozen(this.bomb) || (this.inv && (this.inv.phase === 'break' || this.inv.phase === 'prep'))) && e.alive) this.equipNow(e); return; } // Treino, preparação da Bomba e pausas da Invasão: troca na hora
    // pausa: troca o loadout. Treino equipa na hora. Invasão: só como o 'pr' do main (preparação/pausa entre waves, sem matar nem gastar vida).
    // Nos outros modos morre (sem abate) e nasce neste tick, no máximo 1 vez a cada PX_COOLDOWN s (senão vira fuga de tiroteio).
    if (k === 'px') {
      this.applyLoadout(e, ev[1], ev[2], ev[3], false, ev[4]);
      if (!e.alive) return;
      if (this.bombMode) { if (bombFrozen(this.bomb)) this.equipNow(e); return; } // Bomba: na preparação troca na hora; no meio da rodada só vale na próxima (nunca mata pra trocar de arma)
      if (this.training || (this.inv && (this.inv.phase === 'break' || this.inv.phase === 'prep'))) { this.equipNow(e); return; }
      if (this.inv || this.infMode) return; // Invasão no meio da wave / Infecção: vale só no próximo renascimento, nunca mata
      if (e.slots[0] === e.nextPrimary && e.slots[1] === e.nextSecondary && e.slots[2] === e.nextMelee) return;
      if (this.T - (e.pxAt ?? -1e9) < PX_COOLDOWN) { this.toMe(e, ['pxw', Math.ceil(PX_COOLDOWN - (this.T - e.pxAt))]); return; }
      e.pxAt = this.T;
      this.kill(e, null, e.weapon, false); // atacante null: deaths++, ninguém ganha o abate
      e.respawnAt = this.T; e.rsReq = true; // o laço spawna humano quando rsReq e T >= respawnAt, sem os 5 s
      return;
    }
    if (!e.alive) return;
    if (this.emoting(e) && (k === 'f' || k === 'mgs' || k === 'r' || k === 'dk' || k === 'cn' || k === 'eg' || k === 'n' || k === 'm' || k === 'sw' || k === 'sd' || k === 'ss' || k === 'sbg' || k === 'tb' || k === 'gf' || k === 'af' || k === 'rl' || k === 'sk')) return;
    if (e.stunUntil > this.T && this.T - (e.stunAt ?? -9) > 0.3 && (k === 'f' || k === 'r' || k === 'dk' || k === 'cn' || k === 'eg' || k === 'n' || k === 'm' || k === 'sw' || k === 'sd' || k === 'ss' || k === 'tb' || k === 'sk')) { if (k === 'sk') this.toMe(e, ['skn', e.shocks | 0]); else if (k === 'n') this.toMe(e, ev[3] === 'p' ? ['pkb', e.pokeballs | 0] : ['ndn', e.nades | 0]); return; } // levou choque: não atira (0,3 s de folga pra rede)
    if (k === 'rl') { const w = ev[1], W = e.slots.includes(w) ? this.resolvedW(e, w) : null; const full = W && (W.revolver ? drumsFull(e, w) : e.mag[w] >= W.mag); if (W && !full && !W.melee && !W.shield && e.reserve[w] > 0) e.reload = { w, start: this.T, done: 0 }; return; }
    if (k === 'f') { const Wf = WEAPONS[ev[3]]; const hand = Wf && Wf.akimbo ? ev[6] : 0; if (Wf && Wf.akimbo && hand !== 0 && hand !== 1) { e.rejectedShots = (e.rejectedShots || 0) + 1; return; } return this.clockOk(e, ev[4], ev[3], hand) && this.mgOk(e, ev[3], ev[4]) && this.humanFire(e, ev[1], ev[2], ev[3], ev[5], ev[6]); }
    if (k === 'mgs') return this.mgSpin(e, ev[1], ev[2]);
    if (k === 'r') return this.clockOk(e, ev[3], 3) && this.humanRocket(e, ev[1], ev[2]);
    if (k === 'dk') return this.clockOk(e, ev[3], DISC_W) && this.humanDisc(e, ev[1], ev[2]);
    if (k === 'cn') return this.clockOk(e, ev[3], CORN_W) && this.humanCorn(e, ev[1], ev[2]);
    if (k === 'eg') return this.clockOk(e, ev[4], EGG_W) && this.humanEgg(e, ev[1], ev[2], ev[3]);
    if (k === 'sk') return this.humanShock(e, ev[1], ev[2]);
    if (k === 'zk') return this.humanZKnife(e, ev[1], ev[2]); // Infecção: faquinha do zumbi (Q)
    if (k === 'n') return this.humanNade(e, ev[1], ev[2], ev[3]);
    if (k === 'm') return this.humanMelee(e, ev[1], ev[2], ev[3], ev[4], ev[5]);
    if (k === 'tb') return ev[1] === 1 ? (this.T < (e.shieldDashAt || 0) ? undefined : this.humanBash(e, 1, ev[2], ev[3])) : this.clockOk(e, ev[4], TAMPA) && this.humanBash(e, 0, ev[2], ev[3]);
    if (k === 'sw') return this.saberSwing(e, ev);
    if (k === 'sd') return this.saberDash(e, ev);
    if (k === 'ss') return this.saberSpecial(e, ev);
    if (k === 'sbg') return this.saberBlock(e, ev[1]);
    if (k === 'ks') return this.useStreak(e, ev[1], ev[2]);
    if (k === 'ms') return this.missileImpact(e, ev[1]);
    if (k === 'pw' && this.inv) { const o = obj3(ev[2]), d = obj3(ev[3]); if (this.inv.usePower(e, ev[1] | 0, this.eyeOk(e, o) && d && vlen(d) > 0.5 ? { o, d: norm(d) } : null) === 'revive') this.cq(e, 'rev'); return; } // poder da Invasão (slot, olho, direção)
    if (k === 'gf') return this.gunnerFire(e, ev[1], ev[2]);
    if (k === 'af') return this.ac130Fire(e, ev[1], ev[2]);
  }
  // ---------- killstreaks (servidor autoritativo; regras em shared/killstreaks.js) ----------
  resetStreak(e) { e.ksKills = 0; e.ksBank = { missile: 0, heli: 0, gunner: 0, ac130: 0, nuke: 0 }; e.ksMissile = null; }
  // abate que conta pra sequência (quem matou precisa estar vivo, igual ao cliente)
  streakKill(a) {
    if (!a.ksBank) this.resetStreak(a);
    if (this.inv || this.infMode) return; // Invasão: sem killstreaks (só os poderes de Halloween); Infecção também não
    a.ksKills++; if (a.ksKills === 3) this.cq(a, 'seq3');
    for (const r of streakRewards(a.ksKills)) if (powerOn(r, this.cfg.powers) && r in a.ksBank) a.ksBank[r]++;
  }
  // F: 'p' = Míssil (abre o laptop; o cliente pilota e manda o impacto em 'ms'), 'h' = Gavião, 'x' = nuke
  useStreak(e, kind, startA) {
    const B = e.ksBank; if (!B || e.bot || this.inv || this.infMode || bombFrozen(this.bomb)) return; // Invasão: servidor recusa killstreaks; Bomba: nada de streak na preparação
    const streakId = kind === 'p' ? 'missile' : kind === 'h' ? 'heli' : kind === 'g' ? 'gunner' : kind === 'a' ? 'ac130' : kind === 'x' ? 'nuke' : null;
    if (streakId && !powerOn(streakId, this.cfg.powers)) return;
    if (kind === 'p') {
      const st = obj3(startA); if (!B.missile || e.ksMissile || !st || Math.hypot(st.x - e.pos.x, st.z - e.pos.z) > PREDATOR.back + 2.5) return;
      B.missile--; this.cq(e, 'ks_p'); e.ksMissile = { T0: this.T, start: { x: st.x, y: this.P.groundAt(st.x, st.z, e.pos.y + 4) + PREDATOR.height, z: st.z } };
    } else if (kind === 'h') {
      if (!B.heli) return; B.heli--; this.cq(e, 'ks_h');
      for (const h of this.helis) if (h.owner === e && h.alive && !h.gunner) { h.alive = false; this.events.push(['hx', h.id, 0]); } // um Gavião por dono (como o offline); o Chopper é à parte
      const h = { id: this.projId++, owner: e, alive: true, hp: HELI.hp, ang: Math.random() * Math.PI * 2, orbit: heliOrbit(this.map.size), born: this.T, until: this.T + HELI.life, cool: 0.4 };
      this.helis.push(h); this.events.push(['hl', h.id, e.id, r2(h.ang), r2(h.orbit), r2(h.born), r2(h.until), h.hp]);
    } else if (kind === 'g') { // Chopper da granja: um por dono; o dono mira e atira com 'gf'
      if (!B.gunner || this.helis.some((h) => h.owner === e && h.gunner && h.alive)) return; B.gunner--; this.cq(e, 'ks_g');
      const h = { id: this.projId++, owner: e, gunner: true, alive: true, hp: GUNNER.hp, ang: Math.random() * Math.PI * 2, orbit: heliOrbit(this.map.size) * GUNNER.orbit, height: GUNNER.height, spin: GUNNER.spin, born: this.T, until: this.T + GUNNER.life, cool: 0, last: { mini: -9, sniper: -9 } };
      this.helis.push(h); this.events.push(['hl', h.id, e.id, r2(h.ang), r2(h.orbit), r2(h.born), r2(h.until), h.hp, 1]);
    } else if (kind === 'gx') { // saiu antes do fim: o Chopper vai embora
      for (const h of this.helis) if (h.owner === e && h.gunner && h.alive) { h.alive = false; this.events.push(['hx', h.id, 0]); }
    } else if (kind === 'a') { // Grelha da granja: um avião por dono, fora da lista do Gavião
      if (!B.ac130 || this.gunships.some((h) => h.owner === e && h.alive)) return; B.ac130--; this.cq(e, 'ks_a');
      const h = { id: this.projId++, owner: e, alive: true, hp: AC130.hp, ang: Math.random() * Math.PI * 2, orbit: heliOrbit(this.map.size) * AC130.orbit, height: AC130.height, spin: AC130.spin, born: this.T, until: this.T + AC130.life, last: { espeto: -9, panela: -9, caldeirao: -9 } };
      this.gunships.push(h); this.events.push(['al', h.id, e.id, r2(h.ang), r2(h.orbit), r2(h.born), r2(h.until), h.hp]);
    } else if (kind === 'ax') { // saiu antes do fim: o avião vai embora
      for (const h of this.gunships) if (h.owner === e && h.alive) { h.alive = false; this.events.push(['ae', h.id, 0]); }
    } else if (kind === 'x') { // sem rádio: só arma a contagem; o dono não fica segurando o rádio
      if (!B.nuke || this.nukes.some((n) => n.owner === e)) return; B.nuke--; this.cq(e, 'ks_x');
      const n = { owner: e, at: this.T + NUKE.delay }; this.nukes.push(n); this.events.push(['nk', e.id, r2(n.at)]);
    }
  }
  // impacto do míssil pilotado: precisa ter um míssil no ar e o ponto tem que ser alcançável desde o lançamento
  missileImpact(e, cA) {
    const M = e.ksMissile, c = obj3(cA); if (!M || !c) return;
    const fly = this.T - M.T0 - PREDATOR.laptop, cap = PREDATOR.speed * (PREDATOR.boost || 1), slack = 6 + clamp(e.ping / 1000, 0, 0.5) * cap;
    const [hx, hz] = this.map.size;
    if (fly < -0.4 || fly > PREDATOR.life + 2 || dist(M.start, c) > cap * Math.max(0, fly) + slack || Math.abs(c.x) > hx + 2 || Math.abs(c.z) > hz + 2 || c.y > M.start.y + 1) { e.rejectedShots = (e.rejectedShots || 0) + 1; e.ksMissile = null; return; }
    e.ksMissile = null;
    this.blast(c, e, { radius: PREDATOR.radius, maxDmg: PREDATOR.maxDmg, selfMul: PREDATOR.selfMul, knock: PREDATOR.knock, lift: PREDATOR.lift, wIdx: W_NADE, kind: 'p', ks: 'p' });
  }
  heliAt(h, T = this.T) { return heliPos(h, T); }
  heliR(h) { return h.gunner ? GUNNER.hit : HELI.hit; }
  // tiro do Chopper: sai da barriga do helicóptero do dono; minigun ou sniper (cadência com folga pra rede)
  gunnerFire(e, mode, dA) {
    const h = this.helis.find((x) => x.owner === e && x.gunner && x.alive), M = GUNNER[mode], d0 = obj3(dA);
    if (!h || !M || (mode !== 'mini' && mode !== 'sniper') || !d0) return;
    if (this.T - h.last[mode] < M.rate * 0.5) { e.rejectedShots = (e.rejectedShots || 0) + 1; return; }
    h.last[mode] = this.T;
    const hp = this.heliAt(h), o = { x: hp.x, y: hp.y - 1.6, z: hp.z }, d = norm(d0);
    const wall = this.P.rayWorld(o, d, GUNNER.range), wallD = wall ?? GUNNER.range; let best = null;
    for (const t of this.ents.values()) {
      if (t === e || !t.alive || (!t.bot && !t.connected) || this.friends(t, e)) continue;
      for (const [y, r, head] of HITBOXES) { const tt = raySphere(o, d, center(t, y), r); if (tt > 0 && tt < wallD && (!best || tt < best.tt)) best = { t, tt, head }; }
    }
    const L = best ? best.tt : wallD;
    this.events.push(['gs', h.id, [r2(o.x + d.x * L), r2(o.y + d.y * L), r2(o.z + d.z * L)], mode === 'sniper' ? 1 : 0, best ? 1 : 0]);
    if (best) this.damage(best.t, M.dmg * (best.head ? M.headMul : 1), e, 0, best.head, false, 'g', 0, o);
  }
  // tiro da Grelha: espeto é hitscan; panela e caldeirão estouram no chão ou na parede (alcance 180)
  ac130Fire(e, mode, dA) {
    const h = this.gunships.find((x) => x.owner === e && x.alive), M = AC130[mode], d0 = obj3(dA);
    if (!h || !M || !d0 || (mode !== 'espeto' && mode !== 'panela' && mode !== 'caldeirao')) return;
    if (this.T - h.last[mode] < M.rate * 0.5) { e.rejectedShots = (e.rejectedShots || 0) + 1; return; }
    h.last[mode] = this.T;
    const hp = this.heliAt(h), o = { x: hp.x, y: hp.y - 1.2, z: hp.z }, d = norm(d0), RANGE = 180;
    if (M.radius > 0) {
      const hit = this.P.rayWorld(o, d, RANGE), L = hit == null ? RANGE : hit;
      const c = { x: o.x + d.x * L, y: o.y + d.y * L, z: o.z + d.z * L };
      this.events.push(['as', h.id, arr3(c), mode === 'caldeirao' ? 2 : 1]);
      for (const t of this.ents.values()) {
        if (t === e || !t.alive || (!t.bot && !t.connected) || this.friends(t, e)) continue;
        const dd = dist(c, center(t, 1));
        if (dd < M.radius) this.damage(t, M.dmg * (1 - dd / M.radius), e, 0, false, false, 'a', 0, c);
      }
      return;
    }
    const wall = this.P.rayWorld(o, d, RANGE), wallD = wall ?? RANGE; let best = null;
    for (const t of this.ents.values()) {
      if (t === e || !t.alive || (!t.bot && !t.connected) || this.friends(t, e)) continue;
      for (const [y, r] of HITBOXES) { const tt = raySphere(o, d, center(t, y), r); if (tt > 0 && tt < wallD && (!best || tt < best.tt)) best = { t, tt }; }
    }
    const L = best ? best.tt : wallD;
    this.events.push(['as', h.id, [r2(o.x + d.x * L), r2(o.y + d.y * L), r2(o.z + d.z * L)], 0]);
    if (best) this.damage(best.t, M.dmg, e, 0, false, false, 'a', 0, o);
  }
  hurtHeli(h, amount, by) {
    if (!h.alive || !(amount > 0)) return;
    const gun = this.gunships.includes(h);
    h.hp = Math.max(0, h.hp - amount); this.events.push([gun ? 'ah' : 'hh', h.id, Math.round(h.hp)]);
    if (h.hp <= 0) { h.alive = false; this.events.push([gun ? 'ae' : 'hx', h.id, 1, by ? by.id : 0]); }
  }
  // inimigo do dono do Gavião (pode atirar nele / ele atira em você)
  heliFoe(h, e) { return e && e !== h.owner && !this.friends(e, h.owner); }
  stepHelis(dt) {
    for (const h of this.helis) {
      if (!h.alive) continue;
      if (this.T >= h.until) { h.alive = false; this.events.push(['hx', h.id, 0]); continue; }
      if (h.gunner) continue; // o Chopper não atira sozinho: quem atira é o dono ('gf')
      h.cool -= dt; if (h.cool > 0) continue;
      const hp = this.heliAt(h); let best = null, bd = 1e9;
      for (const e of this.ents.values()) {
        if (!e.alive || (!e.bot && !e.connected) || !this.heliFoe(h, e)) continue;
        const d = dist(hp, e.pos); if (d < bd && this.P.losClear(hp, center(e, 1.1))) { best = e; bd = d; }
      }
      if (!best) continue;
      h.cool = HELI.rate;
      const to = center(best, 1.0), miss = Math.random() < HELI.miss; // erra de vez em quando: o tiro passa do lado
      if (miss) { const a = Math.random() * Math.PI * 2, r = rand(0.9, 1.6); to.x += Math.cos(a) * r; to.z += Math.sin(a) * r; to.y += rand(-0.6, 0.3); }
      this.events.push(['hs', h.id, arr3(to)]);
      if (!miss) this.damage(best, HELI.dmg, h.owner, 0, false, false, 'h', 0, hp);
    }
    this.helis = this.helis.filter((h) => h.alive);
  }
  stepGunships() {
    for (const h of this.gunships) {
      if (!h.alive) continue;
      if (this.T >= h.until) { h.alive = false; this.events.push(['ae', h.id, 0]); }
    }
    this.gunships = this.gunships.filter((h) => h.alive);
  }
  stepNukes() {
    if (!this.inv) for (const n of this.nukes.filter((x) => this.T >= x.at)) {
      this.nukes = this.nukes.filter((x) => x !== n);
      const o = n.owner; if (!this.ents.has(o.id)) continue; // dono saiu de vez: cancela
      this.events.push(['nb', o.id]); // morrer depois de chamar não cancela
      for (const t of [...this.ents.values()]) if (t !== o && t.alive && (t.bot || t.connected) && !this.friends(t, o)) this.kill(t, o, W_NADE, false, false, 'x');
      if (this.teamMode && (o.team === 0 || o.team === 1)) this.forcedWinTeam = o.team;
      else if (!this.teamMode) this.nukeWinner = o.id;
      this.pendingEnd = true; // o tick manda os abates e o endMatch fecha a partida
      break;
    }
    // Offline: em updateRewards (main.js), quando a contagem chega a zero, chamar endGame()
    // com o time do player — teamMode: esse time vence; mata-mata: o player é o vencedor.
    // Não cancelar se ele morreu depois de chamar. Invasão não tem nuke.
    // O cliente ainda não faz isso; ligar no main.js depois, sem mudar o ciclo de 15.
  }
  // Minigun (código no chat): no lugar da primária até morrer; o spawn remonta os slots com e.primary
  giveMinigun(e) { e.slots[0] = MINIGUN; e.mag[MINIGUN] = WEAPONS[MINIGUN].mag; e.reserve[MINIGUN] = WEAPONS[MINIGUN].reserve; e.weapon = MINIGUN; e.reload = null; e.mg = null; this.toMe(e, ['mgn', 1]); }
  // Treino: troca de arma na hora (teclas B/N/M), com pente cheio
  equipNow(e) {
    const prev = e.slots[0];
    e.primary = e.nextPrimary; e.secondary = e.nextSecondary ?? PISTOL; e.melee = e.nextMelee ?? KNIFE; const old = e.slots.slice(); e.slots = [e.primary, e.secondary, e.melee];
    e.kit = copyKit(e.nextKit);
    for (const w of e.slots) {
      const cap = this.resolvedW(e, w).mag;
      if (!old.includes(w)) { e.mag[w] = cap; e.reserve[w] = WEAPONS[w].reserve; if (WEAPONS[w].akimbo) setDrum(e, w, WEAPONS[w].mag); if (w === EGG_W) e.eggAt = this.T; }
      else e.mag[w] = Math.min(e.mag[w] | 0, cap);
    }
    if (isShieldW(e.slots[0]) && e.slots[0] !== prev) resetShield(e);
    if (!e.slots.includes(e.weapon) || (isShieldW(e.weapon) && e.shieldBroken)) e.weapon = e.shieldBroken && isShieldW(e.primary) ? e.secondary : e.primary; e.reload = null;
  }
  // Tampa levou dano. Um evento 'td' por vez: [id, hp, quebrada, dano segurado na partida].
  payShield(e, shield, blocked) {
    if (!e || (!(shield > 0) && !(blocked > 0))) return;
    if (blocked > 0) noteBlocked(e, blocked);
    if (shield > 0) {
      const r = hurtShield(e, shield);
      if (r.broke && isShieldW(e.weapon)) { e.weapon = e.slots[1] ?? PISTOL; e.reload = null; }
    }
    this.events.push(['td', e.id, Math.round(e.shieldHp || 0), e.shieldBroken ? 1 : 0, Math.round(e.shieldBlocked || 0)]);
  }
  // cadência: usa o relógio do cliente (tiros chegam agrupados pela rede), mas o relógio do cliente não pode
  // andar mais rápido que o do servidor (speed hack): (tServidor - tCliente) não pode cair mais que 0,75 s abaixo do máximo visto
  clockOk(e, ct, w, hand = 0) {
    if (!Number.isFinite(ct) || !WEAPONS[w]) return false;
    const off = this.now() - ct; e.maxOff = Math.max(e.maxOff ?? -Infinity, off);
    if (off < e.maxOff - 0.75) { e.rejectedShots = (e.rejectedShots || 0) + 1; return false; }
    const left = !!(WEAPONS[w].akimbo && hand === 1);
    const bag = left ? (e.lastCtL || (e.lastCtL = [])) : e.lastCt;
    const last = bag[w] ?? -Infinity; if (ct - last < WEAPONS[w].rate * 0.9) { e.rejectedShots = (e.rejectedShots || 0) + 1; return false; }
    bag[w] = ct; return true;
  }
  // Minigun: embalo e calor modelados no relógio do cliente (o mesmo de clockOk), com folga pra rede
  mgLevel(e, ct) { const m = e.mg, S = WEAPONS[MINIGUN].spin; if (!m) return 0; const d = Math.max(0, ct - m.at); return clamp(m.v + (m.on ? d / S.up : -d / S.down), 0, 1); }
  mgSpin(e, on, ct) {
    if (!Number.isFinite(ct) || e.weapon !== MINIGUN || !e.slots.includes(MINIGUN)) return;
    const m = e.mg || (e.mg = { v: 0, on: false, at: -1e9, onT: -9, fresh: false, heat: 0, lastCt: -9, hotUntil: -1e9 });
    if (ct < m.at) return; // fora de ordem
    const off = this.now() - ct; e.maxOff = Math.max(e.maxOff ?? -Infinity, off); if (off < e.maxOff - 0.75) return; // relógio adiantado (speed hack)
    m.v = this.mgLevel(e, ct); m.fresh = !!on && m.v < 0.2; m.on = !!on; m.at = ct; if (on) m.onT = this.T;
    this.events.push(['mgs', e.id, on ? 1 : 0]);
  }
  mgOk(e, w, ct) {
    const W = WEAPONS[w], S = W && W.spin; if (!S) return true; const m = e.mg;
    // embalado (80%: folga), fora da trava de calor e, se embalou do zero, pelo menos meia subida no relógio do servidor (anti "mgs" antedatado)
    if (!m || this.mgLevel(e, ct) < 0.8 || ct < m.hotUntil || (m.fresh && this.T - m.onT < S.up * 0.5)) { e.rejectedShots = (e.rejectedShots || 0) + 1; return false; }
    m.heat = Math.max(0, m.heat - Math.max(0, ct - m.lastCt - W.rate) * S.cool) + S.heat * 0.8; m.lastCt = ct; // servidor sempre um pouco mais frio que o cliente
    if (m.heat >= 1) { m.heat = 1; m.hotUntil = ct + 0.85 / S.cool; }
    return true;
  }
  eyeOk(e, o) { return o && dist(o, center(e, EYE)) < 2.6; }
  // recarga do lado do servidor (mesma temporização do cliente, com 20% de folga pra rede)
  progressReload(e) {
    const R = e.reload; if (!R) return; const w = this.resolvedW(e, R.w), el = this.T - R.start, i = R.w;
    if (w.shellReload) {
      const shells = el >= (w.reloadStart + w.reload) * 0.8 ? Math.floor((el - w.reloadStart * 0.8) / (w.reload * 0.8)) : 0;
      while (R.done < shells && e.mag[i] < w.mag && e.reserve[i] > 0) { e.mag[i]++; e.reserve[i]--; R.done++; }
      if (e.mag[i] >= w.mag || e.reserve[i] <= 0) e.reload = null;
    } else if (el >= w.reload * 0.8) { refillDrums(e, i); e.reload = null; if (i === EGG_W) e.eggAt = R.start + w.reload * 0.8; } // ovo na mão: a puxada conta daqui
  }
  canShoot(e, w, hand = 0) {
    const W = WEAPONS[w]; if (!W || !e.slots.includes(w)) return false;
    const h = W.akimbo && hand === 1 ? 1 : 0;
    const bag = h === 1 ? (e.lastShotL || (e.lastShotL = WEAPONS.map(() => -9))) : e.lastShot;
    let bud = 0; if (W.spin) { bud = Math.min(6, (e.shotBud?.[w] ?? 6) + (this.T - e.lastShot[w]) / (W.rate * 0.9)); if (bud < 1) return false; } // minigun: até 6 tiros de folga, recarrega na cadência
    else if (this.T - (bag[w] ?? -9) < W.rate * 0.35) return false; // folga pra rede; a cadência real é checada em clockOk
    this.progressReload(e);
    if (rounds(e, w, h) <= 0) return false;
    if (e.reload && W.shellReload) e.reload = null; // atirar interrompe a recarga do Calibre 12
    else if (e.reload) return false;
    if (W.spin) (e.shotBud ||= [])[w] = bud - 1;
    spendRound(e, w, h); bag[w] = this.T; e.invulnUntil = Math.min(e.invulnUntil, this.T); e.weapon = w; return true;
  }
  humanFire(e, oA, dirs, w, rt, pull) {
    if (WEAPONS[w] && WEAPONS[w].egg) { e.rejectedShots = (e.rejectedShots || 0) + 1; return; } // estilingue não é hitscan: só 'eg'
    const o = obj3(oA); if (!this.eyeOk(e, o) || !Number.isInteger(w) || !WEAPONS[w] || WEAPONS[w].rocket || WEAPONS[w].egg || WEAPONS[w].corn || WEAPONS[w].disc || !Array.isArray(dirs)) return; // projéteis têm evento próprio
    const hand = WEAPONS[w].akimbo && pull === 1 ? 1 : 0;
    if (!this.canShoot(e, w, hand)) { e.rejectedShots = (e.rejectedShots || 0) + 1; return; }
    const ds = dirs.slice(0, Math.max(1, WEAPONS[w].pellets)).map(obj3).filter(Boolean).map(norm);
    // compensação de lag: o cliente manda o tempo de servidor do que estava desenhando (rt); senão estima RTT + 100 ms de interpolação
    const rewind = Number.isFinite(rt) ? clamp(rt, this.T - 0.4, this.T) : this.T - clamp(e.ping / 1000 + 0.1, 0, 0.4);
    const mul = WEAPONS[w].key === 'arco' ? clamp(Number(pull) || 1, 0.35, 1.3) : 1;
    this.hitscan(e, o, ds, w, rewind, mul);
  }
  humanRocket(e, oA, dA) {
    const o = obj3(oA), d = obj3(dA); if (!this.eyeOk(e, o) || !d || !this.canShoot(e, 3)) return;
    this.launchRocket(e, o, norm(d));
  }
  // Faca (servidor autoritativo): precisa estar com a faca na mão, olho perto do olho que o servidor conhece,
  // cadência pelo relógio do cliente (mesma checagem anti speed-hack dos tiros) + piso pelo relógio do servidor,
  // alcance/cone/pelas costas calculados aqui (shared/melee.js) contra posições e yaw voltados no tempo (lag comp).
  humanMelee(e, kindIdx, oA, dA, ct, rt) {
    const kind = MELEE_KINDS[kindIdx], o = obj3(oA), d0 = obj3(dA);
    if (!kind || !o || !d0 || vlen(d0) < 0.5 || e.weapon !== KNIFE || !e.slots.includes(KNIFE) || dist(o, center(e, EYE)) > 1.3 || !Number.isFinite(ct)) { e.rejectedMelee = (e.rejectedMelee || 0) + 1; return; }
    const off = this.now() - ct; e.maxOff = Math.max(e.maxOff ?? -Infinity, off);
    const lastRate = e.lastMeleeRate || 0;
    if (off < e.maxOff - 0.75 || ct - (e.lastMeleeCt ?? -Infinity) < lastRate * 0.9 || this.T - (e.lastMeleeT ?? -9) < lastRate * 0.35) { e.rejectedMelee = (e.rejectedMelee || 0) + 1; return; }
    e.lastMeleeCt = ct; e.lastMeleeT = this.T; e.lastMeleeRate = MELEE[kind].rate; e.invulnUntil = Math.min(e.invulnUntil, this.T);
    const rewind = Number.isFinite(rt) ? clamp(rt, this.T - 0.4, this.T) : this.T - clamp(e.ping / 1000 + 0.1, 0, 0.4);
    this.melee(e, kind, o, norm(d0), rewind);
  }
  melee(e, kind, o, d, rewindT = this.T) {
    const targets = [...this.ents.values()].filter((t) => t !== e && t.alive && (t.bot || t.connected) && !this.friends(t, e))
      .map((t) => ({ e: t, p: rewindT < this.T ? this.posAt(t, rewindT) : t.pos, yaw: rewindT < this.T ? this.yawAt(t, rewindT) : t.yaw, crouch: this.crouchAt(t, rewindT) }));
    const h = meleeHit(o, d, kind, targets, (a, b) => this.P.losClear(a, b));
    this.events.push(['ml', e.id, MELEE_KINDS.indexOf(kind), h ? 1 : 0]);
    if (h) {
      const met = meleeOnShield(h.e, h.e.yaw, o, h.dmg, kind);
      this.payShield(h.e, met.shield, met.blocked);
      if (met.dmg > 0) this.damage(h.e, met.dmg, e, KNIFE, false, h.back);
    }
    return h;
  }
  humanNade(e, oA, vA, kind) {
    const o = obj3(oA), v = obj3(vA); if (!this.eyeOk(e, o) || !v || vlen(v) > 34) return;
    if (kind === 'p') { if (!(e.pokeballs > 0)) return; e.pokeballs--; this.toMe(e, ['pkb', e.pokeballs]); this.throwNade(e, o, v, true); return; } // Pokébola
    if (e.nades <= 0) return;
    e.nades--; e.lastNadeT = this.T; this.throwNade(e, o, v);
  }
  // Pau de choque (tecla 5): servidor confere carga/poder/origem, simula a estaca (shared/shock.js), dá dano que não mata e atordoa
  humanShock(e, oA, vA) {
    const o = obj3(oA), v = obj3(vA); if (!powerOn('stun', this.cfg.powers) || !(e.shocks > 0) || !this.eyeOk(e, o) || !v || vlen(v) > SHOCK.speed + 9) { this.toMe(e, ['skn', e.shocks | 0]); return; }
    e.shocks--; e.lastShockT = this.T; this.toMe(e, ['skn', e.shocks]);
    const s = { id: this.projId++, owner: e, pos: { ...o }, vel: { ...v }, t: 0, stuck: false };
    this.shocks.push(s); this.events.push(['sk', s.id, e.id, arr3(o), arr3(v)]);
  }
  stepShocks(dt) {
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      if (!s.stuck) { const hit = stepShock(this.P, s, dt); if (hit) { s.until = this.T + SHOCK.life; s.nextPulse = this.T; this.events.push(['sx', s.id, arr3(hit.pos), arr3(hit.n)]); } else if (s.dead) { this.shocks.splice(i, 1); this.events.push(['se', s.id]); } continue; }
      if (this.T >= s.until) { this.shocks.splice(i, 1); this.events.push(['se', s.id]); continue; }
      if (this.T < s.nextPulse) continue; s.nextPulse += SHOCK.tick;
      const v = shockReach(s, this.live(), this.T, (a, b) => this.friends(a, b), (a, b) => this.P.losClear(a, b), center);
      for (const t of v) { if (t !== s.owner && !(s.hitIds || (s.hitIds = new Set())).has(t.id)) { s.hitIds.add(t.id); this.cq(s.owner, 'shock'); } this.shockNow = true; if (!(t.stunUntil > this.T)) t.stunAt = this.T; t.stunUntil = Math.max(t.stunUntil || 0, this.T + shockStun(t)); const d = shockDmg(t.hp); if (d > 0) this.damage(t, d, s.owner, W_NADE, false, false, null, 0, shockTop(s)); this.shockNow = false; if (t.bot) { t.target = null; t.aim = 0; } } // damage() faz o bot mirar em quem bateu: zera depois
      this.events.push(['sz', s.id, v.map((t) => t.id), r2(SHOCK.stun)]);
    }
  }
  // Pokébola abriu: engole todo inimigo no raio com linha livre (morre na hora, sem bacon); 'pke' leva quem foi engolido pro efeito
  pokeOpen(n) {
    const eaten = [], c = { x: n.pos.x, y: n.pos.y + 0.3, z: n.pos.z };
    for (const t of this.ents.values()) {
      if (t === n.owner || !t.alive || (!t.bot && !t.connected) || this.friends(t, n.owner)) continue;
      if (dist(center(t, 1), c) > POKE.radius || !this.P.losClear(c, center(t, 1))) continue;
      if (this.T < t.invulnUntil) continue;
      eaten.push(t);
    }
    for (const t of eaten) this.damage(t, 9999, n.owner, W_NADE, false, false, 'pk');
    this.events.push(['pke', n.id, arr3(n.pos), eaten.map((t) => t.id)]);
  }
  humanBash(e, kind, oA, dA) {
    const spec = kind === 1 ? SHIELD.charge : SHIELD.bash;
    const o = obj3(oA), d0 = obj3(dA);
    if (!shieldRaised(e) || !this.eyeOk(e, o) || !d0 || vlen(d0) < 0.5) return;
    if (kind === 1) { e.shieldDashAt = this.T + SHIELD.charge.cd; e.lastKnock = this.T; e.shieldDashUntil = this.T + SHIELD.charge.time; }
    const d = norm(d0);
    const targets = [...this.ents.values()].filter((t) => t !== e && t.alive && (t.bot || t.connected) && !this.friends(t, e))
      .map((t) => ({ e: t, p: t.pos, yaw: t.yaw, crouch: t.crouch }));
    const h = shieldBashHit(o, d, spec, targets, (a, b) => this.P.losClear(a, b));
    this.events.push(['tb', e.id, kind === 1 ? 1 : 0, h ? 1 : 0]);
    if (!h) return;
    this.damage(h.e, spec.dmg, e, TAMPA, false);
    h.e.lastKnock = this.T;
    const v = { x: h.dir.x * spec.push, y: spec.lift, z: h.dir.z * spec.push };
    if (h.e.bot) { h.e.vel.x += v.x; h.e.vel.z += v.z; h.e.vel.y = Math.max(h.e.vel.y, v.y); h.e.onGround = false; }
    else this.toMe(h.e, ['kn', arr3(v)]);
  }
  // ---------- sabres (shared/saber.js). O servidor é quem aplica dano, alcance, combo, cooldown e o bloqueio. ----------
  saberSwing(e, ev) {
    const prof = saberProfile(WEAPONS[e.weapon]);
    if (!e.alive || !prof) return;
    const o = obj3(ev[1]), dir = obj3(ev[2]);
    if (!this.eyeOk(e, o) || !dir) return;
    const st = ensureSaber(e);
    const sw0 = peekSwing(st, this.T, prof, 0.08);
    if (!sw0) { e.rejectedShots = (e.rejectedShots || 0) + 1; return; }
    if (!this.clockOk(e, ev[3], e.weapon)) return;
    const sw = applySwing(st, this.T, sw0);
    const fl = Math.hypot(dir.x, dir.z) || 1;
    this.saberArc(e, o, { x: dir.x / fl, z: dir.z / fl }, sw.dmg, sw.reach, sw.arc);
    this.events.push(['swg', e.id, sw.idx, e.weapon]);
  }
  saberDash(e, ev) {
    const prof = saberProfile(WEAPONS[e.weapon]);
    if (!e.alive || !prof || this.emoting(e) || e.stunUntil > this.T) return false;
    const st = ensureSaber(e);
    if (this.T + 0.05 < st.dashReady) return false;
    const dx = Number(ev[1]), dz = Number(ev[2]);
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return false;
    const res = tryDash(st, this.T, prof, { x: dx, z: dz });
    if (!res) return false;
    this.events.push(['sdp', e.id, r2(res.dx), r2(res.dz), r2(res.dur)]);
    return true;
  }
  saberSpecial(e, ev) {
    const prof = saberProfile(WEAPONS[e.weapon]);
    if (!e.alive || !prof) return;
    const st = ensureSaber(e);
    const res = trySpecial(st, this.T, prof);
    if (!res) return;
    if (res.kind === 'spin') { this.events.push(['ssp', e.id, r2(res.dur)]); return; }
    const d = obj3(ev[1]);
    const o = center(e, EYE);
    if (!d) { catchBlade(st); st.specialReady = this.T; return; }
    this.launchBlade(e, o, norm(d), res);
  }
  saberBlock(e, on) {
    if (!e.alive || !isSaber(e.weapon)) return;
    const st = ensureSaber(e);
    const want = !!on && this.T >= st.lockUntil && st.stam > 0;
    if (want === st.wantBlock && want === st.blocking) return;
    st.wantBlock = want;
    if (want && !st.blocking) { st.blocking = true; st.blockAt = this.T; }
    if (!want) st.blocking = false;
    this.events.push(['sbb', e.id, want ? 1 : 0]);
  }
  saberArc(e, o, forward, dmg, reach, arc) {
    const targets = [];
    for (const t of this.ents.values()) {
      if (t === e || !t.alive || (!t.bot && !t.connected) || this.friends(t, e)) continue;
      if (!this.P.losClear(o, center(t, 1))) continue;
      targets.push({ e: t, x: t.pos.x, z: t.pos.z });
    }
    const hits = targetsInArc(o, forward, reach, arc, targets);
    for (const h of hits) {
      const met = meleeOnShield(h.e, h.e.yaw, e.pos, dmg, 'saber');
      this.payShield(h.e, met.shield, met.blocked);
      if (met.dmg > 0) this.damage(h.e, met.dmg, e, e.weapon, false);
    }
    return hits;
  }
  saberRadius(e, dmg, radius) {
    const o = center(e, 1);
    let n = 0;
    for (const t of this.ents.values()) {
      if (t === e || !t.alive || (!t.bot && !t.connected) || this.friends(t, e)) continue;
      if (Math.abs(t.pos.y - e.pos.y) > 1.7) continue;
      if (Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z) > radius) continue;
      if (!this.P.losClear(o, center(t, 1))) continue;
      const met = meleeOnShield(t, t.yaw, e.pos, dmg, 'saber');
      this.payShield(t, met.shield, met.blocked);
      if (!(met.dmg > 0)) continue;
      this.damage(t, met.dmg, e, e.weapon, false); n++;
    }
    if (n) this.events.push(['spr', e.id, 3, arr3(o)]);
    return n;
  }
  launchBlade(e, o, d, spec) {
    const id = this.projId++;
    const b = { id, owner: e, pos: { x: o.x + d.x * 0.55, y: o.y - 0.1, z: o.z + d.z * 0.55 }, dir: { x: d.x, y: 0, z: d.z }, phase: 'out', traveled: 0, t: 0, hit: new Set(), backHit: new Set(), spec };
    this.blades.push(b);
    this.events.push(['sbl', id, e.id, arr3(b.pos), arr3(b.dir)]);
  }
  stepSabers(dt) {
    for (const e of this.ents.values()) {
      if (!e.alive || !isSaber(e.weapon)) { if (e.saber) { e.saber.blocking = false; e.saber.wantBlock = false; } continue; }
      const st = ensureSaber(e), prof = saberProfile(WEAPONS[e.weapon]);
      const was = st.blocking;
      stepStamina(st, this.T, dt, !!st.wantBlock);
      if (st.blocking !== was) this.events.push(['sbb', e.id, st.blocking ? 1 : 0]);
      if (!st.dashStruck && this.T >= st.dashStrikeAt) {
        st.dashStruck = true;
        const D = prof.dash;
        this.saberArc(e, center(e, EYE), st.dashDir, D.dmg, D.reach, D.arc);
        this.events.push(['swg', e.id, 3, e.weapon]);
      }
      const tick = spinDue(st, this.T, prof);
      if (tick) this.saberRadius(e, tick.dmg, tick.radius);
    }
    this.stepBlades(dt);
  }
  stepBlades(dt) {
    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i], spec = b.spec || SABER_KIT.single.throw, owner = b.owner;
      b.t += dt;
      if (!owner || b.t > spec.life + 0.2) { this.endBlade(i, b, false); continue; }
      if (b.phase === 'back') {
        const eye = center(owner, 1.2);
        const dx = eye.x - b.pos.x, dy = eye.y - b.pos.y, dz = eye.z - b.pos.z, L = Math.hypot(dx, dy, dz) || 1;
        b.dir = { x: dx / L, y: dy / L, z: dz / L };
        if (L < 0.85) { this.endBlade(i, b, true); continue; }
      }
      const step = spec.speed * (b.phase === 'back' ? 1.15 : 1) * dt;
      const wall = this.P.rayWorld(b.pos, b.dir, step + 0.05);
      let hit = null;
      for (const t of this.ents.values()) {
        if (t === owner || !t.alive || (!t.bot && !t.connected) || this.friends(t, owner)) continue;
        const bag = b.phase === 'back' ? b.backHit : b.hit;
        if (bag.has(t.id)) continue;
        for (const [y, r] of HITBOXES) {
          const tt = raySphere(b.pos, b.dir, center(t, y), r + spec.radius);
          if (tt > 0 && tt <= step + 0.05 && (wall === null || tt < wall) && (!hit || tt < hit.tt)) hit = { t, tt };
        }
      }
      if (hit) {
        (b.phase === 'back' ? b.backHit : b.hit).add(hit.t.id);
        this.events.push(['spr', owner.id, 1, arr3({ x: b.pos.x + b.dir.x * hit.tt, y: b.pos.y + b.dir.y * hit.tt, z: b.pos.z + b.dir.z * hit.tt })]);
        this.damage(hit.t, b.phase === 'back' ? spec.backDmg : spec.outDmg, owner, SABER, false);
      }
      if (wall !== null && b.phase === 'out') { b.phase = 'back'; b.dir = { x: -b.dir.x, y: 0.05, z: -b.dir.z }; this.events.push(['sbr', b.id, arr3(b.pos)]); continue; }
      b.pos.x += b.dir.x * step; b.pos.y += b.dir.y * step; b.pos.z += b.dir.z * step;
      if (b.phase === 'out') { b.traveled += step; if (b.traveled >= spec.range) { b.phase = 'back'; this.events.push(['sbr', b.id, arr3(b.pos)]); } }
    }
  }
  endBlade(i, b, caught) {
    this.blades.splice(i, 1);
    if (b.owner && b.owner.saber) catchBlade(b.owner.saber);
    this.events.push(['sbx', b.id, caught ? 1 : 0, arr3(b.pos)]);
  }
  // Projétil cruzou a lâmina de quem está bloqueando. Parry perfeito devolve; segurar só desvia.
  deflectProjectile(kind, proj, dt) {
    if (!proj || (proj.guardSkip && this.T < proj.guardSkip)) return false;
    const pos = proj.pos;
    const vel = proj.vel;
    const dir = vel ? norm(vel) : proj.dir;
    if (!dir) return false;
    const speed = vel ? Math.max(0.01, vlen(vel)) : (kind === 'rocket' ? WEAPONS[3].rocket.speed : kind === 'disc' ? DISC.speed : kind === 'corn' ? CORN.speed : 16);
    const to = { x: pos.x + dir.x * speed * dt, y: pos.y + (dir.y || 0) * speed * dt, z: pos.z + dir.z * speed * dt };
    for (const e of this.ents.values()) {
      if (!e.alive || e === proj.owner || (proj.guardId === e.id && this.T < (proj.guardSkip || 0))) continue;
      const saberOn = isSaber(e.weapon);
      const touch = bladeTouch(e.pos, e.yaw, 'model', pos, to, dir, this.T, saberOn ? ensureSaber(e) : null, saberOn);
      if (!touch) continue;
      payProjectile(e.saber, this.T, touch.perfect);
      const nd = touch.dir;
      if (vel) proj.vel = { x: nd.x * speed, y: nd.y * speed, z: nd.z * speed };
      else proj.dir = { x: nd.x, y: nd.y, z: nd.z };
      if (touch.perfect) proj.owner = e;
      if (kind === 'rocket') proj.born = this.T;
      proj.guardSkip = this.T + 0.3; proj.guardId = e.id;
      const code = kind === 'rocket' ? 'r' : kind === 'disc' ? 'd' : kind === 'egg' ? 'e' : 'c';
      this.events.push(['srd', code, proj.id, e.id, arr3(pos), [r2(nd.x), r2(nd.y), r2(nd.z)], touch.perfect ? 1 : 0]);
      this.events.push(['spr', e.id, touch.perfect ? 2 : 1, arr3(pos)]);
      return true;
    }
    return false;
  }
  pileHit(hits, h) {
    const a = hits.get(h.e) || { dmg: 0, head: false, fx: 0 };
    a.dmg += h.dmg; a.head = a.head || h.head; a.fx |= (h.walls ? 1 : 0) | (h.bodies ? 2 : 0); hits.set(h.e, a);
  }
  saberGate(t, origin) {
    if (!t || !isSaber(t.weapon) || this.T < t.invulnUntil) return null;
    const open = guardOpen(t.saber, this.T);
    if (!open) return null;
    if (!inFront(t.yaw, 'model', t.pos, origin, SABER_KIT.block.half, 120)) return null;
    return open;
  }
  // ---------- histórico de posições (rewind) ----------
  pushHist(e) { e.hist.push([this.T, e.pos.x, e.pos.y, e.pos.z, e.yaw, e.crouch]); while (e.hist.length > 2 && e.hist[0][0] < this.T - HIST) e.hist.shift(); }
  posAt(e, t) {
    const h = e.hist; if (!h.length || t >= h[h.length - 1][0]) return e.pos;
    for (let i = h.length - 1; i > 0; i--) if (h[i - 1][0] <= t) { const a = h[i - 1], b = h[i], k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, z: a[3] + (b[3] - a[3]) * k }; }
    return { x: h[0][1], y: h[0][2], z: h[0][3] };
  }
  yawAt(e, t) { const h = e.hist; let y = e.yaw; for (let i = h.length - 1; i >= 0; i--) { y = h[i][4] ?? y; if (h[i][0] <= t) break; } return y; }
  crouchAt(e, t) {
    const h = e.hist; if (!h.length || t >= h[h.length - 1][0]) return e.crouch || 0;
    for (let i = h.length - 1; i > 0; i--) if (h[i - 1][0] <= t) {
      const a = h[i - 1], b = h[i], k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return (a[5] || 0) + ((b[5] || 0) - (a[5] || 0)) * k;
    }
    return h[0][5] || 0;
  }
  // ---------- combate ----------
  // bala: atravessa parede leve e corpos (collateral) pela regra de shared/penetration.js (a mesma do cliente offline)
  hitscan(shooter, o, dirs, w, rewindT = this.T, mul = 1) {
    this.hearGunshot(o, shooter);
    const W = this.resolvedW(shooter, w), hits = new Map(), ends = [], holes = [], heliDmg = new Map(); const heliT = this.T - (shooter.bot ? 0 : clamp(shooter.ping / 1000, 0, 0.4));
    const scale = W.key === 'arco' ? clamp(Number(mul) || 1, 0.35, 1.3) : 1;
    const targets = [...this.ents.values()].filter((t) => t !== shooter && t.alive && (t.bot || t.connected) && !this.friends(t, shooter)).map((t) => ({ e: t, p: rewindT < this.T ? this.posAt(t, rewindT) : t.pos, crouch: this.crouchAt(t, rewindT), size: t.zt ? t.size : 1 })); // agachado achata o corpo (traceShot)
    const helis = []; for (const hl of this.helis) if (hl.alive && this.heliFoe(hl, shooter)) helis.push({ h: hl, c: this.heliAt(hl, heliT), r: this.heliR(hl) }, { h: hl, c: this.heliAt(hl, rewindT), r: this.heliR(hl) }); // o cliente desenha o Gavião sem atraso: vale o ping ou o rewind
    for (const hl of this.gunships) if (hl.alive && this.heliFoe(hl, shooter)) helis.push({ h: hl, c: this.heliAt(hl, heliT), r: AC130.hit }, { h: hl, c: this.heliAt(hl, rewindT), r: AC130.hit }); // Grelha: mesma esfera do helicóptero, raio do avião
    const shotW = this.inv ? { ...W, pierce: 8, pierceMul: 0.82 } : W; // Invasão: a bala segue na fila de zumbis (8 corpos, ×0,82 de dano). Fora dela, o pierce da arma.
    const lids = new Map(), raw = new Map();
    for (const d of dirs) {
      const tr = traceShot(this.P, o, d, shotW, targets, helis, scale);
      ends.push([r2(o.x + d.x * tr.end), r2(o.y + d.y * tr.end), r2(o.z + d.z * tr.end), tr.hits.length ? 1 : 0]);
      for (const h of tr.holes) if (holes.length < 12) holes.push([r2(h.p.x), r2(h.p.y), r2(h.p.z), h.n.x, h.n.y, h.n.z, h.out ? 1 : 0]);
      if (tr.heli) heliDmg.set(tr.heli.h, (heliDmg.get(tr.heli.h) || 0) + tr.heli.dmg);
      let stopped = false;
      for (const h of tr.hits) {
        if (stopped) { h.dmg = 0; continue; }
        const met = bulletOnShield(h.e, h.e.yaw, o, d, h.t, W.key, h.dmg);
        if (met.shield > 0 || met.blocked > 0) { const a = lids.get(h.e) || { shield: 0, blocked: 0 }; a.shield += met.shield; a.blocked += met.blocked; lids.set(h.e, a); }
        h.dmg = met.dmg; if (met.stop) stopped = true;
        if (h.dmg > 0) { const a = raw.get(h.e) || []; a.push(h); raw.set(h.e, a); }
      }
    }
    const bounced = [];
    for (const [t, list] of raw) {
      const gate = this.saberGate(t, o);
      if (!gate) { for (const h of list) this.pileHit(hits, h); continue; }
      const pay = payGuard(ensureSaber(t), this.T, { perfect: gate.perfect, dmgEach: list.map((h) => h.dmg) });
      list.forEach((h, i) => { if (!pay.blocked[i]) this.pileHit(hits, h); });
      if (pay.blocked.some(Boolean)) this.events.push(['spr', t.id, gate.perfect && pay.reflect > 0 ? 2 : 1, arr3(center(t, 1.1))]);
      if (pay.reflect > 0) bounced.push({ t, dmg: pay.reflect });
    }
    this.events.push(holes.length ? ['sh', shooter.id, w, arr3(o), ends, holes] : ['sh', shooter.id, w, arr3(o), ends]); // [5] = furos [x,y,z,nx,ny,nz,saída]
    for (const [hl, dmg] of heliDmg) this.hurtHeli(hl, dmg, shooter);
    for (const [ent, n] of lids) this.payShield(ent, n.shield, n.blocked);
    let kills = 0; const hurt = new Set(); for (const [t, h] of hits) { if (!(h.dmg > 0)) continue; const hp0 = t.hp; if (this.damage(t, h.dmg, shooter, w, h.head, false, null, h.fx)) kills++; if (t.hp < hp0) hurt.add(t); }
    for (const b of bounced) if (shooter && shooter.alive && shooter !== b.t) this.damage(shooter, b.dmg, b.t, isSaber(b.t.weapon) ? b.t.weapon : SABER, false);
    if (W.knock) for (const [t, h] of hits) { // Calibre 12: empurra quem sobreviveu e levou dano de fato (proteção de nascimento não é empurrada; bot no servidor, humano pelo 'kn' igual ao rocket jump)
      if (!t.alive || t.dummy || !hurt.has(t)) continue; const v = shotKnock(W, o, t.pos, h.dmg, t.zt); if (!v) continue; t.lastKnock = this.T;
      if (t.bot) { t.vel.x += v.x; t.vel.z += v.z; t.vel.y = Math.max(t.vel.y, v.y); t.onGround = false; } else this.toMe(t, ['kn', arr3(v)]);
    }
    if (kills >= 2) { this.events.push(['mk', shooter.id, kills]); if (!this.inv) this.cq(shooter, 'col'); } // collateral: várias mortes num tiro só
    return hits;
  }
  friends(a, b) { if (this.invasion) return !!(a && b && a !== b && !a.zt === !b.zt); return (this.teamMode || this.infMode) && a && b && a !== b && a.team === b.team && a.team >= 0; }
  damage(t, amount, a, w, head, back = false, ks = null, fx = 0, origin = a && a !== t && !a.fog ? a.pos : null) {
    if (!t.alive || this.T < t.invulnUntil || this.friends(t, a) || bombFrozen(this.bomb)) return false; // sem fogo amigo; Bomba: ninguém leva dano na preparação
    if (this.invasion && !t.zt && a && !a.zt && !a.fog) return false; // Invasão: jogador nunca machuca jogador (nem a si mesmo)
    if (this.infMode && a && a !== t && a.team === ZOMB && t.team === SURV) { if (w === KNIFE) { this.infect(t, a, 0); return true; } return false; } // Infecção: qualquer golpe de faca do zumbi infecta
    t.hp -= amount; t.lastAttacker = a ? a.id : 0; noteHurt(t, a, this.T); // regen só com dano de outro
    if (t.bot && a && a !== t && !t.target) { t.target = a; t.aim = t.reaction * 0.5; }
    this.events.push(['h', t.id, a ? a.id : 0, Math.max(0, Math.round(t.hp)), head ? 1 : 0, Math.round(amount), fx, origin ? arr3(origin) : null]); // [5] = dano, [6] = parede/collateral, [7] = origem no instante do golpe
    if (t.hp <= 0) { this.kill(t, a, w, head, back, ks, fx); return true; }
    return false;
  }
  // ks: abate de killstreak ('p' míssil, 'h' Gavião, 'x' nuke) → ev[8]; Gavião e nuke não contam pra sequência
  kill(t, a, w, head, back = false, ks = null, fx = 0) {
    if (this.inv && t.zt) return this.killZombie(t, a, w, head, back, ks);
    if (this.infS) this.infOnKill(t, a);
    t.alive = false; t.hp = 0; t.deaths++; if (t.acct) t.sd++; t.respawnAt = this.T + (t.dummy ? TRAIN.respawn : RESPAWN_TIME); if (!t.bot) { t.needRs = true; t.rsReq = false; } // humano: só renasce clicando em Renascer
    if (a && a !== t) { a.kills++; if (a.acct) { a.sk++; if (!this.inv && !(this.teamMode && a.team === t.team)) a.ck = (a.ck | 0) + (t.bot || t.zt ? EARN.killBot : EARN.killHuman); this.chalKill(a, w, head, back, ks, fx); } if (a.alive && ks !== 'h' && ks !== 'x' && ks !== 'g' && ks !== 'a') this.streakKill(a); }
    t.ksKills = 0; t.ksMissile = null; // morreu: sequência zera (míssil no ar cai junto); os streaks já ganhos (ksBank) continuam guardados
    // faca: ev[3] = pistola (clientes antigos não conhecem a arma 5) e ev[7] = 1 (faca) / 2 (pelas costas)
    const ev = ['k', a ? a.id : 0, t.id, w === KNIFE ? PISTOL : w === W_BOMB ? W_NADE : w, head ? 1 : 0, a ? a.kills : 0, t.deaths]; if (w === KNIFE) ev.push(back ? 2 : 1); else if (w === W_BOMB) ev.push(3); // 3 = botijão (clientes antigos veem Copo Bomba)
    if (ks || fx) { while (ev.length < 8) ev.push(0); ev.push(ks || 0); } if (fx) ev.push(fx); // ev[9]: 1 pela parede, 2 collateral
    this.events.push(ev);
    // vira bacon que cura: fica no chão onde morreu pelo mesmo tempo que o bacon aparece no cliente
    this.bacons = this.bacons.filter((b) => b.id !== t.id);
    this.bacons.push({ id: t.id, x: t.pos.x, y: this.P.groundAt(t.pos.x, t.pos.z, t.pos.y + 0.3), z: t.pos.z, born: this.T });
    if (this.inv && !t.bot && !this.inv.onPlayerDeath(t)) { t.respawnAt = Infinity; t.needRs = false; } // Invasão: sem vidas = fica assistindo
    if (this.infS) this.infAfterKill(t);
    if (a && a.kills >= KILL_LIMIT && !this.teamMode && !this.training && !this.invasion && !this.infMode) this.pendingEnd = true;
  }
  // ---------- desafios diários: a sala só CONTA (e.cq); quem guarda e paga é o Worker (recordStats → accounts.chal) ----------
  cq(e, key, n = 1) { if (!e || !e.acct || this.training) return; const q = e.cq || (e.cq = {}); q[key] = (q[key] | 0) + n; }
  chalKill(a, w, head, back, ks, fx) {
    this.cq(a, 'k'); if (head) this.cq(a, 'hs'); if (fx & 1) this.cq(a, 'wall');
    if (w === KNIFE) { this.cq(a, 'knife'); if (back) this.cq(a, 'back'); }
    if (w === W_NADE && !ks && !this.shockNow) this.cq(a, 'nade'); // Copo Bomba (fora: Pokébola, choque, poderes)
    const g = CHAL_WEAPONS[WEAPONS[w] ? WEAPONS[w].key : '']; if (g) this.cq(a, g);
  }
  blast(c, owner, o, direct = null) {
    this.events.push(['bm', o.pid || 0, o.kind, arr3(c)]);
    for (const hl of this.helis) { // explosão perto do Gavião (mesma conta do offline)
      if (!hl.alive || !this.heliFoe(hl, owner)) continue;
      const d = dist(c, this.heliAt(hl)), reach = o.radius + this.heliR(hl) * 0.4; if (d < reach) this.hurtHeli(hl, o.maxDmg * (0.35 + 0.65 * (1 - d / reach)), owner);
    }
    for (const hl of this.gunships) { // a Grelha também leva explosão (a vida dela deixa de ser só número)
      if (!hl.alive || !this.heliFoe(hl, owner)) continue;
      const d = dist(c, this.heliAt(hl)), reach = o.radius + AC130.hit * 0.4; if (d < reach) this.hurtHeli(hl, o.maxDmg * (0.35 + 0.65 * (1 - d / reach)), owner);
    }
    const hits = explosionHits(c, o, this.invasion ? this.live().filter((x) => x.zt || x === owner) : this.live(), (a, b) => this.P.losClear(a, b), owner, this.teamMode, direct);
    for (const h of hits) {
      const e = h.e; e.lastKnock = this.T;
      const met = splashOnShield(e, e.yaw, c, h.dmg, e === owner, e === direct);
      if (met.knockMul !== 1) { h.knock.x *= met.knockMul; h.knock.y *= met.knockMul; h.knock.z *= met.knockMul; }
      if (e.bot) { e.vel.x += h.knock.x; e.vel.z += h.knock.z; e.vel.y = Math.max(e.vel.y, h.knock.y); e.onGround = false; }
      else this.toMe(e, ['kn', arr3(h.knock)]); // empurrão aplicado pelo próprio cliente (rocket jump)
      this.payShield(e, met.shield, met.blocked);
      if (met.dmg > 0) this.damage(e, met.dmg, owner, o.wIdx, false, false, o.ks || null, 0, c);
    }
    return hits;
  }
  throwNade(e, o, v, poke = false) {
    const n = { id: this.projId++, owner: e, pos: { ...o }, vel: { ...v }, explodeAt: this.T + (poke ? POKE.fuse : NADE.fuse), poke };
    this.nades.push(n); this.events.push(['nd', n.id, e.id, arr3(o), arr3(v), poke ? 1 : 0]);
  }
  hearGunshot(origin, shooter) { noteGunshot([...this.ents.values()], origin, shooter, this.T); }
  launchRocket(e, o, d) {
    this.hearGunshot(o, e);
    const R = WEAPONS[3].rocket, near = this.P.rayWorld(o, d, 0.7);
    this.events.push(['sh', e.id, 3, arr3(o), []]);
    if (near !== null) { const t = Math.max(0, near - 0.12); this.blast({ x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t }, e, { ...R, wIdx: 3, kind: 'r' }); return; }
    const r = { id: this.projId++, owner: e, pos: { x: o.x + d.x * 0.6, y: o.y + d.y * 0.6, z: o.z + d.z * 0.6 }, dir: d, born: this.T };
    this.rockets.push(r); this.events.push(['rk', r.id, e.id, arr3(r.pos), arr3(d)]);
  }
  // Lança-Milho: o servidor espalha os grãos (semente = id), voa, estoura em pipoca (shared/corn.js) e dá o dano com blast() tipo 'c'
  humanCorn(e, oA, dA) { const o = obj3(oA), d = obj3(dA); if (!this.eyeOk(e, o) || !d || !this.canShoot(e, CORN_W)) return; this.launchCorn(e, o, norm(d)); }
  launchCorn(e, o, d) {
    this.events.push(['sh', e.id, CORN_W, arr3(o), []]); // som do disparo pros outros
    const id0 = this.projId; this.projId += CORN.grains; const list = [];
    cornDirs(d, id0).forEach((v, k) => { const g = { id: id0 + k, owner: e, pos: { x: o.x + v.x * 0.5, y: o.y + v.y * 0.5 - 0.1, z: o.z + v.z * 0.5 }, vel: { x: v.x * CORN.speed, y: v.y * CORN.speed, z: v.z * CORN.speed }, t: 0 }; this.corns.push(g); list.push([g.id, arr3(g.pos), arr3(g.vel)]); });
    this.events.push(['cl', e.id, list]);
  }
  stepCorns(dt) {
    for (let i = this.corns.length - 1; i >= 0; i--) {
      const g = this.corns[i];
      if (this.deflectProjectile('corn', g, dt)) continue;
      const h = stepCorn(this.P, g, dt, this.live(), (t) => (t === g.owner && g.t < 0.15) || this.friends(t, g.owner)); if (!h) continue;
      this.corns.splice(i, 1); popChain(this.P, h.pos, h.n, g.id).forEach((p, k) => this.cornPops.push({ at: this.T + k * CORN.gap, pos: p, owner: g.owner, pid: k ? 0 : g.id, direct: k ? null : h.e }));
    }
    for (let i = this.cornPops.length - 1; i >= 0; i--) { const q = this.cornPops[i]; if (this.T < q.at) continue; this.cornPops.splice(i, 1); this.blast(q.pos, q.owner, { ...popOpts(CORN_W), pid: q.pid }, q.direct); }
  }
  // Disco Voador: o servidor voa e quica (shared/disc.js), avisa cada quique ('db') pra todo mundo ressincronizar e aplica o dano
  humanDisc(e, oA, dA) {
    const o = obj3(oA), d = obj3(dA); if (!this.eyeOk(e, o) || !d || !this.canShoot(e, DISC_W)) return;
    const n = norm(d), id = this.projId++, disc = { id, owner: e, pos: { x: o.x + n.x * 0.5, y: o.y + n.y * 0.5 - 0.15, z: o.z + n.z * 0.5 }, dir: n, bounces: 0, t: 0 };
    this.discs.push(disc); this.events.push(['dl', id, e.id, arr3(disc.pos), arr3(n)]);
  }
  stepDiscs(dt) {
    const W = WEAPONS[DISC_W];
    for (let i = this.discs.length - 1; i >= 0; i--) {
      const d = this.discs[i];
      if (this.deflectProjectile('disc', d, dt)) { const step = DISC.speed * dt; d.pos.x += d.dir.x * step; d.pos.y += d.dir.y * step; d.pos.z += d.dir.z * step; continue; }
      const from = { ...d.pos }, hits = stepDisc(this.P, d, dt);
      // pedaços do caminho deste passo (pode ter dobrado num quique) contra os corpos
      const pts = [from, ...hits.map((h) => h.pos), { ...d.pos }]; let hit = null;
      for (let k = 0; k < pts.length - 1 && !hit; k++) {
        const a = pts[k], b = pts[k + 1], L = dist(a, b); if (L < 1e-5) continue; const dir = { x: (b.x - a.x) / L, y: (b.y - a.y) / L, z: (b.z - a.z) / L };
        for (const t of this.ents.values()) {
          if (t === d.owner || !t.alive || (!t.bot && !t.connected) || this.friends(t, d.owner)) continue;
          for (const [y, r, head] of HITBOXES) { const tt = raySphere(a, dir, center(t, y), r + DISC.r * 0.5); if (tt > 0 && tt <= L && (!hit || tt < hit.tt)) hit = { t, tt, head, dir, from: a, at: { x: a.x + dir.x * tt, y: a.y + dir.y * tt, z: a.z + dir.z * tt } }; }
        }
      }
      if (hit) {
        const raw = W.dmg * (hit.head ? W.headMul : 1);
        const met = bulletOnShield(hit.t, hit.t.yaw, hit.from, hit.dir, hit.tt, 'disco', raw);
        this.discs.splice(i, 1); this.events.push(['dx', d.id, arr3(hit.at), 1]);
        this.payShield(hit.t, met.shield, met.blocked);
        if (met.dmg > 0) this.damage(hit.t, met.dmg, d.owner, DISC_W, hit.head);
        continue;
      }
      for (const h of hits) if (!h.dead) this.events.push(['db', d.id, arr3(h.pos), arr3(d.dir), d.bounces]);
      if (d.dead) { this.discs.splice(i, 1); this.events.push(['dx', d.id, arr3(d.pos), 0]); }
    }
  }
  // Estilingue de Ovo: o servidor calcula a velocidade pela força (k limitado a 0..1 e ao tempo de puxada), voa em arco (shared/egg.js) e dá o dano. Sem 'sh': é silencioso
  humanEgg(e, oA, dA, pull) {
    const o = obj3(oA), d = obj3(dA), last = e.lastShot[EGG_W] ?? -Infinity; if (!this.eyeOk(e, o) || !d || vlen(d) < 0.5 || !this.canShoot(e, EGG_W)) return;
    // força limitada pelo tempo que o ovo está na mão (puxada medida no servidor, 20% de folga pra rede)
    const held = this.T - Math.max(e.eggAt ?? -Infinity, last), k = Math.min(clamp(Number(pull) || 0, 0, 1), clamp(held / (WEAPONS[EGG_W].draw * 0.8), 0, 1)), n = norm(d), sp = eggSpeed(k), id = this.projId++;
    const g = { id, owner: e, k, pos: { ...o }, vel: { x: n.x * sp, y: n.y * sp, z: n.z * sp }, t: 0 };
    this.eggs.push(g); this.events.push(['el', id, e.id, arr3(g.pos), arr3(g.vel), r2(k)]);
  }
  stepEggs(dt) {
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const g = this.eggs[i];
      if (this.deflectProjectile('egg', g, dt)) continue;
      const st = stepEgg(this.P, g, dt), a = st.from, L = dist(a, g.pos); let hit = null;
      if (L > 1e-5) { const dir = { x: (g.pos.x - a.x) / L, y: (g.pos.y - a.y) / L, z: (g.pos.z - a.z) / L };
        for (const t of this.ents.values()) {
          if (t === g.owner || !t.alive || (!t.bot && !t.connected) || this.friends(t, g.owner)) continue;
          for (const [y, r, head] of HITBOXES) { const tt = raySphere(a, dir, center(t, y), r + EGG.pad); if (tt > 0 && tt <= L && (!hit || tt < hit.tt)) hit = { t, tt, head, dir, from: a, at: { x: a.x + dir.x * tt, y: a.y + dir.y * tt, z: a.z + dir.z * tt } }; }
        } }
      if (hit) { this.eggs.splice(i, 1); this.events.push(['ex', g.id, arr3(hit.at), 1, 0]); this.eggHit(hit.t, g, hit.head, hit.from, hit.dir, hit.tt); continue; }
      if (g.dead) { this.eggs.splice(i, 1); this.events.push(['ex', g.id, arr3(g.pos), 0, st.wall ? arr3(st.wall.n) : 0]); }
    }
  }
  eggHit(t, g, head, from = null, dir = null, tt = 0) {
    const raw = eggDmg(WEAPONS[EGG_W], g.k, head);
    const met = from && dir ? bulletOnShield(t, t.yaw, from, dir, tt, 'estilingue', raw) : { dmg: raw, shield: 0, blocked: 0 };
    this.payShield(t, met.shield, met.blocked);
    const ok = t.alive && this.T >= t.invulnUntil && !this.friends(t, g.owner) && met.dmg > 0;
    if (met.dmg > 0) this.damage(t, met.dmg, g.owner, EGG_W, head);
    if (ok && t.alive) { t.eggUntil = this.T + EGG.splat; this.toMe(t, ['egg', EGG.splat]); } // tela suja só pra quem levou e continua vivo
  }
  stepProjectiles(dt) {
    this.stepDiscs(dt); this.stepEggs(dt); this.stepCorns(dt); this.stepShocks(dt);
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i]; this.P.advanceNade(n, dt);
      if (this.T >= n.explodeAt && n.poke) { this.nades.splice(i, 1); this.pokeOpen(n); continue; }
      if (this.T >= n.explodeAt) { this.nades.splice(i, 1); this.blast({ ...n.pos }, n.owner, { radius: NADE.radius, maxDmg: NADE.maxDmg, selfMul: NADE.selfMul, knock: NADE.knock, lift: NADE.lift, wIdx: W_NADE, kind: 'n', pid: n.id }); }
    }
    const R = WEAPONS[3].rocket;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i], step = R.speed * dt;
      if (this.deflectProjectile('rocket', r, dt)) { r.pos.x += r.dir.x * step; r.pos.y += r.dir.y * step; r.pos.z += r.dir.z * step; continue; }
      let hitT = this.P.rayWorld(r.pos, r.dir, step + 0.1), hitE = null, hitLid = null;
      for (const e of this.ents.values()) {
        if (!e.alive || (!e.bot && !e.connected) || (e === r.owner && this.T - r.born < 0.3)) continue;
        if (this.friends(e, r.owner)) continue;
        const t = rayCapsule(r.pos, r.dir, step + 0.1, e.pos, ROCKET_PAD, e.crouch);
        if (t !== null && (hitT === null || t < hitT)) {
          const blocked = classifyRay(e, e.yaw, r.pos, r.dir, t).block;
          hitT = t; hitE = blocked ? null : e; hitLid = blocked ? e : null; // face da tampa para o foguete; pé, borda e fresta levam o direto
        }
      }
      if (hitT !== null || this.T - r.born > 6) {
        const t = Math.max(0, (hitT ?? 0) - 0.05); this.rockets.splice(i, 1);
        this.blast({ x: r.pos.x + r.dir.x * t, y: r.pos.y + r.dir.y * t, z: r.pos.z + r.dir.z * t }, r.owner, { ...R, wIdx: 3, kind: 'r', pid: r.id }, hitE);
        if (hitLid) this.payShield(hitLid, SHIELD.rocketFace, 0);
        continue;
      }
      r.pos.x += r.dir.x * step; r.pos.y += r.dir.y * step; r.pos.z += r.dir.z * step;
    }
  }
  // ---------- renascimento e pickups ----------
  pickSpawn(e) {
    if (this.inv && !e.bot) { // Invasão: começa junto (spawns do mapa em ordem); renasce perto de um aliado, dentro da área segura
      if (e.firstSpawn != null) { const s = this.spawns[e.firstSpawn % this.spawns.length]; e.firstSpawn = null; return s; }
      const p = this.inv.spawnPoint(e, e.reviveAt || null); e.reviveAt = null; if (p) return { x: p.x, y: this.P.groundAt(p.x, p.z, p.y + 0.3), z: p.z };
    }
    const list = this.infMode && this.infSpawns ? this.infSpawns : spawnList(this.bomb, this.bombL, e.team, this.spawns); // Bomba: spawn do lado do time; Infecção: spawns + pontos da malha
    let best = list[0], bd = -Infinity;
    for (const s of list) {
      let md = 1e9, seen = false; const eye = { x: s.x, y: s.y + 1.5, z: s.z };
      for (const o of this.ents.values()) { if (o === e || !o.alive) continue; if (this.friends(o, e) && !(this.infS && this.infS.phase === 'wait')) { if (this.bomb && dist(o.pos, s) < 2.5) md = Math.min(md, -40); continue; } // Bomba: não nasce em cima do colega; Infecção antes do surto: espalha todo mundo
        const d = dist(o.pos, s); md = Math.min(md, d); if (!seen && d < 60 && this.P.losClear(eye, center(o, 1.5))) seen = true; }
      const score = Math.min(md, 40) + Math.random() * 6 - (seen ? 30 : 0); if (score > bd) { bd = score; best = s; }
    }
    return best;
  }
  spawn(e, silent = false) {
    const s = this.pickSpawn(e); e.pos = { ...s }; e.vel = { x: 0, y: 0, z: 0 }; e.crouch = 0; e.hp = 100; e.alive = true; resetRegen(e); e.needRs = false; e.rsReq = false; e.invulnUntil = this.T + INVULN; e.sq++;
    if (e.bot && !e.dummy && botWantsShield(e.id) && weaponOn(TAMPA, this.cfg.weapons)) e.nextPrimary = TAMPA;
    else if (e.bot && (Math.random() < 0.3 || !weaponOn(e.nextPrimary, this.cfg.weapons))) e.nextPrimary = pick(botPool(this.cfg.weapons));
    const c = clampLoadout(e.nextPrimary, e.nextSecondary ?? PISTOL, e.nextMelee ?? KNIFE, this.cfg.weapons);
    e.primary = e.nextPrimary = c.primary; e.secondary = e.nextSecondary = c.secondary; e.melee = e.nextMelee = c.melee; e.slots = [e.primary, e.secondary, e.melee]; e.weapon = e.primary; e.knifeMode = false; e.mg = null; e.kit = e.bot ? {} : copyKit(e.nextKit); e.mag = WEAPONS.map((w) => w.mag); e.reserve = WEAPONS.map((w) => w.reserve); if (!e.bot) for (const w of e.slots) e.mag[w] = this.resolvedW(e, w).mag; resetDrums(e); e.reload = null; e.eggAt = this.T; e.nades = NADE.spawnWith; e.shocks = powerOn('stun', this.cfg.powers) ? SHOCK.spawnWith : 0; e.stunUntil = 0; e.lastShockT = -99; resetShield(e); this.toMe(e, ['skn', e.shocks]);
    e.yaw = Math.atan2(-s.x, -s.z); e.pitch = 0; // modelo olhando pro centro
    if (e.dummy) { this.placeDummy(e); e.invulnUntil = this.T; e.slots = [0, PISTOL, KNIFE]; }
    e.hist = []; this.pushHist(e); e.lastUpd = this.now();
    if (e.bot) Object.assign(e, { target: null, wp: null, path: null, stuck: 0, reloadEnd: 0 });
    if (this.infMode && e.team === ZOMB) this.makeZombie(e, e.zHp || INF.Z_HP);
    this.events.push(['sp', e.id, arr3(e.pos), r2(e.yaw), e.primary, e.sq]);
  }
  refillAmmo(e) {
    if (this.invasion) return invRefillAmmo(e, WEAPONS); // Invasão: mais munição por caixa (mesma regra do cliente)
    let got = false;
    for (const i of e.slots) { const w = WEAPONS[i]; if (e.reserve[i] >= w.reserve) continue; e.reserve[i] = w.rocket ? Math.min(w.reserve, e.reserve[i] + 1) : w.reserve; got = true; }
    return got;
  }
  updatePickups() {
    this.pickups.forEach((p, i) => {
      if (!powerOn(p.type, this.cfg.powers)) return;
      if (!p.active) { if (this.T >= p.respawnAt) { p.active = true; this.events.push(['pk', i, 1]); } return; }
      for (const e of this.ents.values()) {
        if (!e.alive || e.zt || (this.infMode && e.team === ZOMB) || (!e.bot && !e.connected)) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; if (dx * dx + dz * dz > 1.5 || Math.abs(e.pos.y - p.pos.y) > 1.5) continue;
        if (p.type === 'health') { if (e.hp >= 100) continue; e.hp = Math.min(100, e.hp + 50); }
        else if (p.type === 'grenade') { const sk = !e.bot && powerOn('stun', this.cfg.powers) && (e.shocks | 0) < SHOCK.max; if (e.nades >= NADE.max && !sk) continue; if (e.nades < NADE.max) e.nades++; if (sk) e.shocks = (e.shocks | 0) + 1; } // Copo Bomba também dá +1 pau de choque
        else if (!this.refillAmmo(e)) continue;
        p.active = false; p.respawnAt = this.T + (p.type === 'grenade' ? NADE.pickupRespawn : this.invasion && p.type === 'ammo' ? INV_AMMO.respawn : 15);
        this.events.push(['pk', i, 0]); if (!e.bot) this.toMe(e, ['got', p.type, Math.round(e.hp), e.nades, e.shocks | 0]);
        break;
      }
    });
  }
  // bacon que cura: quem pisar (vivo, menos o próprio morto, com vida < 100) ganha +10 e o bacon some; evento 'bc' pra todos
  updateBacons() {
    if (!this.bacons.length) return;
    const R2 = BACON_ITEM.radius * BACON_ITEM.radius;
    this.bacons = this.bacons.filter((b) => {
      const age = this.T - b.born; if (age >= BACON_ITEM.life) return false; if (age < BACON_ITEM.from) return true;
      for (const e of this.ents.values()) {
        if (!e.alive || e.zt || e.id === b.id || (!e.bot && !e.connected) || e.hp >= 100) continue;
        const dx = e.pos.x - b.x, dz = e.pos.z - b.z; if (dx * dx + dz * dz > R2 || Math.abs(e.pos.y - b.y) >= BACON_ITEM.dy) continue;
        e.hp = Math.min(100, e.hp + BACON_ITEM.heal); this.events.push(['bc', b.id, e.id, Math.round(e.hp)]); return false;
      }
      return true;
    });
  }
  toMe(e, ev) { if (e.bot) return; if (!this.personal.has(e.id)) this.personal.set(e.id, []); this.personal.get(e.id).push(ev); }
  // ---------- laço do servidor (20 Hz) ----------
  tick() {
    if (this.state !== 'playing') return;
    const t = this.now(); let dt = clamp(t - this.lastTick, 0, 0.25); this.lastTick = t;
    this.T = t - this.t0; this.purge();
    while (dt > 1e-4) { const h = Math.min(TICK, dt); dt -= h; for (const e of this.ents.values()) if (e.bot && !e.zt) { if (this.infMode && e.team === ZOMB) this.updateZombieBot(e, h); else this.updateBot(e, h); } this.stepSabers(h); if (this.zknives && this.zknives.length) this.stepZKnives(h); if (this.inv) this.inv.step(h); this.stepProjectiles(h); this.stepHelis(h); this.stepGunships(); }
    this.stepNukes();
    for (const e of this.ents.values()) {
      if (!e.alive && (e.bot || e.connected) && this.T >= e.respawnAt && !(e.needRs && !e.rsReq && this.T < e.respawnAt + RS_SAFETY) && !(e.pendingTeam && this.now() - (e.pendingSince || 0) < PENDING_WAIT)) { if (e.pendingTeam) { e.pendingTeam = false; this.syncBots(); } this.spawn(e); }
      if (e.bot) this.pushHist(e);
      if (!e.bot && e.alive) this.progressReload(e);
      if (this.training && !e.bot && e.alive) { // munição de reserva infinita e Copo Bomba volta sozinho
        for (const w of e.slots) e.reserve[w] = WEAPONS[w].reserve;
        if (e.nades < NADE.max && this.T - (e.lastNadeT ?? -9) > TRAIN.nadeRefill) e.nades = NADE.max;
        if (powerOn('stun', this.cfg.powers) && !(e.shocks > 0) && this.T - (e.lastShockT ?? -99) > SHOCK.trainRefill) { e.shocks = 1; this.toMe(e, ['skn', 1]); } // pau de choque volta em 10 s
      }
    }
    this.updatePickups(); this.updateBacons();
    { const rt = clamp(this.T - (this.lastRegenT ?? this.T), 0, 0.25); this.lastRegenT = this.T; for (const e of this.ents.values()) if (!e.zt) regenStep(e, this.T, rt); }
    if (this.zone) this.updateZone(TICK_DT(this));
    if (this.bomb) this.updateBomb(clamp(this.T - (this.lastBombT ?? this.T), 0, 0.25)); this.lastBombT = this.T;
    if (this.infS) this.updateInf();
    const snap = { t: 's', T: r2(this.T), f: this.infS ? packInf(this.infS) : undefined, d: this.zoneArr() || undefined, iv: this.inv ? this.inv.stateArr() : undefined, b: this.bomb ? packBomb(this.bomb) : undefined, e: [...this.ents.values()].filter((e) => e.bot || e.connected).map((e) => [e.id, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), r2(e.yaw), r2(e.pitch), e.weapon,
      (e.alive ? 1 : 0) | (this.T < e.invulnUntil ? 2 : 0) | (e.onGround ? 4 : 0) | ((e.bot ? e.reloadEnd > this.T : !!e.reload) ? 8 : 0) | (e.regenOn ? 16 : 0), Math.round(e.hp), e.ping, r2(e.crouch), isShieldW(e.slots[0]) ? (e.shieldBroken ? 0 : Math.round(e.shieldHp ?? SHIELD.hp)) : -1]), ev: this.events };
    this.events = [];
    this.io.broadcast(snap);
    for (const [id, evs] of this.personal) this.io.send(id, { t: 'p', ev: evs }); this.personal.clear();
    if (this.pendingEnd || this.T >= this.timeLimit) { this.pendingEnd = false; this.endMatch(); }
  }
  updateZone(dt) {
    const z = this.zone, got = stepZone(z, zoneCounts(z, this.live()), dt);
    if (got >= 0) {
      this.teamScore[got]++; for (const e of this.live()) if (e.alive && e.team === got && inZone(z, e.pos)) { e.caps++; this.cq(e, 'cap'); }
      const nz = newZoneState(pickZone(this.nav, z)); this.zone = nz;
      this.events.push(['zc', got, this.teamScore[0], this.teamScore[1], [r2(nz.x), r2(nz.y), r2(nz.z)], [...this.live()].filter((e) => e.caps).map((e) => [e.id, e.caps])]);
      if (this.teamScore[got] >= DOM.WIN_CAPS) this.pendingEnd = true;
    }
  }
  // Modo Bomba: rodadas, plantar/desarmar, explosão (regras em shared/bomb.js; eventos 'bb' pros clientes)
  updateBomb(dt) {
    const S = this.bomb, live = this.live();
    for (const ev of stepBomb(S, live, this.T, dt, this.bombL.sites)) {
      this.events.push(['bb', ...ev]);
      if (ev[0] === 'plant' || ev[0] === 'defuse') { const e = this.ents.get(ev[1]); if (e) { e.caps++; this.cq(e, ev[0]); if (ev[0] === 'plant') e.cpl = (e.cpl | 0) + 1; else e.cdf = (e.cdf | 0) + 1; } } // conta como objetivo no placar
      else if (ev[0] === 'win') { for (const e of live) if (!e.bot && e.team === ev[1]) this.cq(e, 'rw'); }
      else if (ev[0] === 'boom') { const pl = this.ents.get(ev[4]); for (const v of blastVictims(S, live, { x: ev[1], y: ev[2], z: ev[3] })) this.kill(v, pl && pl !== v && !this.friends(pl, v) ? pl : null, W_BOMB, false); }
      else if (ev[0] === 'round') { this.bombRoundStreaks(); this.nades = []; this.rockets = []; this.blades = []; for (const e of live) if (!e.pendingTeam) this.spawn(e); } // rodada nova: todo mundo volta pro spawn com vida cheia
      else if (ev[0] === 'over') this.pendingEnd = true;
    }
  }
  // rodada nova: sequência e streaks guardados continuam; o que estava no ar acaba (Gavião sai; míssil no ar e nuke na contagem voltam pro banco)
  bombRoundStreaks() {
    for (const h of this.helis) if (h.alive) { h.alive = false; this.events.push(['hx', h.id, 0]); }
    this.helis = [];
    for (const n of this.nukes) if (n.owner.ksBank) n.owner.ksBank.nuke++;
    this.nukes = [];
    for (const e of this.ents.values()) if (e.ksMissile) { e.ksMissile = null; if (e.ksBank) e.ksBank.missile++; }
  }
  // ---------- Modo Infecção 🧟 (regras em shared/infection.js) ----------
  // pontos de nascimento: os do mapa + pontos da malha de navegação no chão (50 pessoas não cabem em 12 spawns)
  makeInfSpawns() {
    const L = this.spawns.slice(), want = 48;
    for (let i = 0; i < want * 6 && L.length < this.spawns.length + want; i++) {
      const n = this.nav.randomNode(); if (!n || n.y > 0.6) continue; // só no térreo (nada de nascer em telhado)
      const p = { x: n.x, y: this.P.groundAt(n.x, n.z, n.y + 0.3), z: n.z };
      if (L.every((s) => Math.hypot(s.x - p.x, s.z - p.z) > 4)) L.push(p);
    }
    return L;
  }
  // zumbi: só a faca (1/2/3 são todos faca), vida alta, sem Copo Bomba nem choque
  makeZombie(e, hp) {
    e.team = ZOMB; e.slots = [KNIFE, KNIFE, KNIFE]; e.primary = e.secondary = e.melee = KNIFE; e.weapon = KNIFE; e.reload = null; e.mg = null; e.knifeMode = true;
    e.nades = 0; e.shocks = 0; e.pokeballs = 0; e.hp = hp; e.maxHp = hp; e.zHp = 0; if (!e.zkReady || e.zkReady < this.T) e.zkReady = this.T + 1.5;
  }
  // sobrevivente atingido pela faca/faquinha do zumbi: vira zumbi ali mesmo (kind: 0 golpe, 1 faquinha)
  infect(t, a, kind) {
    const S = this.infS; if (!S || S.phase !== 'live' || !t.alive || t.team !== SURV) return;
    t.deaths++; if (t.acct) t.sd++; t.ksKills = 0;
    if (a && a !== t) { a.kills++; if (a.acct) { a.sk++; a.ck = (a.ck | 0) + (t.bot ? EARN.killBot : EARN.killHuman); this.cq(a, 'k'); } a.hp = Math.min(Math.max(a.hp, INF.Z_HP_CAP), a.hp + INF.INFECT_HEAL); a.maxHp = Math.max(a.maxHp || 0, a.hp); } // ZP: zumbi recupera vida a cada infecção
    this.makeZombie(t, INF.Z_HP); t.invulnUntil = this.T + INF.INFECT_INVULN; t.zkReady = this.T + 2; t.target = null; t.path = null;
    S.infections++; S.endAt = Math.min(INF.ROUND_MAX + INF.OUTBREAK, S.endAt + INF.PER_INFECT);
    this.events.push(['if', t.id, a ? a.id : 0, kind | 0, a ? a.kills : 0, t.deaths, Math.round(t.hp), a ? Math.round(a.hp) : 0]);
    this.infCount();
  }
  infCount() { const S = this.infS; let s = 0, z = 0, zw = 0; for (const e of this.live()) { if (e.team === SURV && e.alive) s++; else if (e.team === ZOMB) { if (e.alive) z++; else if (!e.zOut) zw++; } } S.surv = s; S.zomb = z; S.zwait = zw; return S; }
  infOnKill(t, a) { t.wasTeam = t.team; }
  infAfterKill(t) {
    const S = this.infS; t.needRs = false;
    if (t.wasTeam === ZOMB) { t.respawnAt = Infinity; t.zOut = true; } // zumbi morto: fora até o fim da rodada (estilo Zombie Plague)
    else if (S.phase === 'live') { t.team = ZOMB; t.respawnAt = this.T + INF.SUICIDE_RESPAWN; S.infections++; this.events.push(['tm', t.id, ZOMB]); } // sobrevivente que se matou volta como zumbi (Halo)
    else { t.respawnAt = this.T + INF.SUICIDE_RESPAWN; } // antes do surto: volta sobrevivente
    this.infCount();
  }
  // saiu da sala: se era o último zumbi de pé (e ainda há gente), sorteia outro alfa pra rodada não acabar de graça
  infAfterLeave(e) {
    const S = this.infCount(); if (S.phase !== 'live' || e.team !== ZOMB || e.zOut) return;
    if (S.zomb + S.zwait === 0 && S.surv >= 2) this.outbreak(1);
  }
  outbreak(forceN = 0) {
    const S = this.infS, pool = this.live().filter((e) => e.alive && e.team === SURV); const n = this.live().length;
    if (pool.length < 2) return false;
    const k = forceN || alphaCount(n), hp = alphaHp(n, k);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const alphas = pool.slice(0, Math.min(k, pool.length - 1));
    for (const e of alphas) { this.makeZombie(e, hp); e.zAlpha = true; e.invulnUntil = this.T + INF.INFECT_INVULN; e.zkReady = this.T + 1; e.target = null; }
    S.phase = 'live';
    this.events.push(['ib', alphas.map((e) => e.id), hp]);
    this.infCount(); return true;
  }
  updateInf() {
    const S = this.infS;
    if (S.phase === 'wait') {
      if (this.T >= S.outbreakAt && !this.outbreak()) { S.outbreakAt = this.T + 5; S.endAt = S.outbreakAt + INF.ROUND; } // ainda não tem 2 de pé: espera mais 5 s
      this.infCount(); return;
    }
    if (S.phase === 'over') { if (this.T >= S.overAt) this.pendingEnd = true; return; }
    this.infCount();
    let w = -1; if (S.surv === 0) w = ZOMB; else if (S.zomb + S.zwait === 0 || this.T >= S.endAt) w = SURV;
    if (w >= 0) { S.phase = 'over'; S.winner = w; S.overAt = this.T + INF.OVER_DELAY; this.forcedWinTeam = w; this.events.push(['iw', w]); this.zknives = []; }
  }
  // Q do zumbi: arremessa a faquinha. Servidor confere vez, recarga e olho; a física é a mesma do cliente (shared/infection.js)
  humanZKnife(e, oA, dA) {
    const o = obj3(oA), d0 = obj3(dA);
    if (!this.infS || this.infS.phase !== 'live' || e.team !== ZOMB || !e.alive || !this.eyeOk(e, o) || !d0 || vlen(d0) < 0.5 || this.T < (e.zkReady || 0) - 0.25) { this.toMe(e, ['zkr', r2(Math.max(0, (e.zkReady || 0) - this.T))]); return; }
    this.throwZKnife(e, o, norm(d0));
  }
  throwZKnife(e, o, d) {
    e.zkReady = this.T + knifeCd(e.zAlpha); e.invulnUntil = Math.min(e.invulnUntil, this.T);
    const S = INF.KNIFE, k = { id: this.projId++, owner: e, pos: { ...o }, vel: { x: d.x * S.speed, y: d.y * S.speed + 1, z: d.z * S.speed }, t: 0 };
    this.zknives.push(k); this.events.push(['zk', k.id, e.id, arr3(k.pos), arr3(k.vel)]);
    this.toMe(e, ['zkr', r2(knifeCd(e.zAlpha))]);
  }
  stepZKnives(dt) {
    for (let i = this.zknives.length - 1; i >= 0; i--) {
      const k = this.zknives[i], own = k.owner;
      const tg = []; for (const t of this.ents.values()) { if (!t.alive || t.team !== SURV || (!t.bot && !t.connected)) continue; tg.push({ e: t, pts: HITBOXES.map(([y, r]) => [center(t, y), r]) }); }
      const r = stepKnife(k, dt, this.P.rayWorld, raySphere, tg);
      if (!r) continue;
      this.zknives.splice(i, 1);
      if (r.t && own && this.ents.has(own.id) && own.team === ZOMB) {
        const met = meleeOnShield(r.t, r.t.yaw, own.pos, 50, 'stab'); this.payShield(r.t, met.shield, met.blocked); // tampa erguida segura a faquinha
        if (met.dmg > 0 && this.T >= r.t.invulnUntil) this.infect(r.t, own, 1);
      }
      this.events.push(['zkx', k.id, arr3(r.at || r.wall), r.t ? r.t.id : 0, own ? own.id : 0]);
    }
  }
  // bot zumbi: fareja o sobrevivente mais perto (sem precisar ver, igual ao radar do CoD), corre pela malha, golpeia colado e arremessa a faquinha de longe
  updateZombieBot(b, dt) {
    if (!b.alive) return;
    const S = this.infS; const mind = profileOf(b);
    b.think -= dt;
    if (b.think <= 0 || (b.target && !b.target.alive) || (b.target && b.target.team !== SURV)) {
      b.think = 0.35 + Math.random() * 0.25; let best = null, bd = 1e9;
      for (const o of this.ents.values()) { if (!o.alive || o.team !== SURV || (!o.bot && !o.connected)) continue; const d = dist(o.pos, b.pos); if (d < bd) { bd = d; best = o; } }
      b.target = best; b.seesT = best ? this.P.losClear(center(b, 1.5), center(best, 1.2)) : false;
    }
    const t = b.target; let mx = 0, mz = 0, desiredYaw = b.yaw;
    if (t && S.phase === 'live') {
      const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
      if (b.seesT && Math.abs(t.pos.y - b.pos.y) < 1.5) { mx = dx / d; mz = dz / d; } else { const st = this.steer(b, t.pos); if (st) { mx = st.x; mz = st.z; } else { mx = dx / d; mz = dz / d; } }
      desiredYaw = b.seesT ? Math.atan2(dx, dz) : Math.atan2(mx, mz);
      if (b.seesT && d < MELEE.slash.range + 0.6 && this.T >= b.nextFire) { const o = center(b, 1.5), at = center(t, 1.1); b.nextFire = this.T + MELEE.slash.rate * rand(1.2, 1.6); this.melee(b, 'slash', o, norm({ x: at.x - o.x, y: at.y - o.y, z: at.z - o.z })); }
      else if (b.seesT && d > 5 && d < 26 && this.T >= (b.zkReady || 0) && this.T >= (b.zkRoll || 0)) {
        b.zkRoll = this.T + 0.8; if (Math.random() < 0.55) {
          const o = center(b, 1.5), err = 0.3 + (b.accuracy || 0.06) * 12, lead = d / INF.KNIFE.speed;
          const at = { x: t.pos.x + (t.vel.x || 0) * lead + rand(-err, err), y: t.pos.y + 1.0 + INF.KNIFE.grav * lead * lead * 0.5, z: t.pos.z + (t.vel.z || 0) * lead + rand(-err, err) };
          this.throwZKnife(b, o, norm({ x: at.x - o.x, y: at.y - o.y - 1 / INF.KNIFE.speed * d, z: at.z - o.z }));
        }
      }
    } else { if (!b.wp || dist(b.wp, b.pos) < 1.5) b.wp = this.randomWaypoint(); const st = this.steer(b, b.wp); if (st) { mx = st.x; mz = st.z; desiredYaw = Math.atan2(mx, mz); } }
    const sp = BOT_SPEED * MELEE.speedMul * INF.Z_SPEED * (b.stunUntil > this.T ? SHOCK.slow : 1), ml = Math.hypot(mx, mz); if (ml > 0) { mx = mx / ml * sp; mz = mz / ml * sp; }
    const acc = b.onGround ? 10 : 3; b.vel.x += (mx - b.vel.x) * Math.min(1, acc * dt); b.vel.z += (mz - b.vel.z) * Math.min(1, acc * dt);
    const blocked = this.P.moveEntity(b, dt);
    if (blocked) { b.stuck += dt; if (b.onGround) b.vel.y = JUMP * INF.Z_JUMP; if (b.stuck > 1.2) { b.wp = this.randomWaypoint(); b.path = null; b.stuck = 0; } } else b.stuck = Math.max(0, b.stuck - dt);
    let dy = desiredYaw - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * Math.min(1, dt * (mind.turn || 8));
  }
  testInf(e, m) { // só testes (ALLOW_TEST=1): { go: 1 } surto agora · { hold: s } adia o surto · { left: s } tempo restante · { me: 1 } eu viro zumbi alfa · { zk: [dx,dy,dz] } arremesso sem recarga
    const S = this.infS;
    if (Number.isFinite(m.hold) && S.phase === 'wait') { S.outbreakAt = this.T + clamp(+m.hold, 0, 600); S.endAt = S.outbreakAt + INF.ROUND; } // segura o surto (testes lentos)
    if (m.go && S.phase === 'wait') { S.outbreakAt = this.T; this.updateInf(); }
    if (Number.isFinite(m.left)) S.endAt = this.T + clamp(+m.left, 0, 600);
    if (m.me && e.alive && e.team === SURV) { if (S.phase === 'wait') S.phase = 'live'; this.makeZombie(e, alphaHp(this.live().length, 1)); e.zAlpha = true; this.events.push(['ib', [e.id], Math.round(e.hp)]); this.infCount(); }
    if (m.surv && e.alive && e.team === ZOMB) { e.team = SURV; this.spawn(e); this.events.push(['tm', e.id, SURV]); }
    if (m.cd != null) e.zkReady = this.T;
  }
  // ---------- Modo Invasão (regras e simulação em shared/invasion.js) ----------
  makeInvasion() {
    const g = this;
    return new InvasionCore({
      T: () => g.T, P: g.P, nav: g.nav, size: g.map.size, botDiff: () => g.cfg.botDiff,
      players: () => g.humans(),
      spawnZombie(type, pos) {
        const z = g.makeEnt({ name: '', skin: SKINS[0].id, primary: 0, bot: true }); z.zt = type;
        z.name = ({ walker: 'Docão Podre', runner: 'Esqueleto Corredor', tank: 'Barrigão de Gás', spitter: 'Cuspidor', boss: 'Docão Abóbora' })[type] || 'Zumbi';
        z.pos = { x: pos.x, y: pos.y, z: pos.z }; z.vel = { x: 0, y: 0, z: 0 }; z.alive = true; z.team = 1; z.invulnUntil = 0; z.weapon = KNIFE; z.slots = [KNIFE]; z.hist = []; z.respawnAt = Infinity;
        z.yaw = Math.atan2(-pos.x, -pos.z); g.pushHist(z);
        return z;
      },
      spawned(z) { g.events.push(['j', g.entInfo(z)]); }, // depois do core preencher vida/tipo
      removeZombie(z) { if (g.ents.delete(z.id)) g.events.push(['l', z.id]); },
      hurtPlayer(p, dmg, src) { g.damage(p, dmg, src || { fog: true, id: 0, zt: 'fog' }, src ? KNIFE : W_NADE, false, false, src ? null : 'fog'); },
      hurtZombie(z, dmg, by, kind) { g.damage(z, dmg, by, W_NADE, false, false, 'i' + POWER_KEYS.indexOf(kind)); },
      knock(e, v) { e.lastKnock = g.T; if (e.bot) { e.vel.x += v.x; e.vel.z += v.z; e.vel.y = Math.max(e.vel.y, v.y); e.onGround = false; } else g.toMe(e, ['kn', arr3(v)]); },
      heal(p, hp) { p.hp = Math.min(100, p.hp + hp); g.toMe(p, ['heal', Math.round(p.hp)]); },
      revive(p, at) { p.needRs = false; p.rsReq = false; p.respawnAt = g.T + 0.4; p.reviveAt = at; },
      invChanged(p) { const n = p.inv.length; if (n > (p.invSeen | 0)) g.cq(p, 'pw', n - (p.invSeen | 0)); p.invSeen = n; g.toMe(p, ['inv', p.inv.map((k) => POWER_KEYS.indexOf(k))]); },
      giveAmmo(p) { return g.refillAmmo(p); }, // caixa que o zumbi solta: o cliente espelha no 'dg'
      emit(ev) { g.events.push(ev); },
      aimOf(p) { return { o: center(p, EYE), d: modelAim(p.yaw, p.pitch) }; },
      over() { g.pendingEnd = true; },
    });
  }
  killZombie(t, a, w, head, back, ks) {
    t.alive = false; t.hp = 0; t.deaths++; if (t.acct) t.sd++; t.respawnAt = Infinity;
    if (a && a !== t && !a.zt) { a.kills++; if (a.acct) { a.sk++; this.cq(a, 'zk'); if (head) this.cq(a, 'zhs'); if (t.zt === 'spitter') this.cq(a, 'spit'); else if (t.zt === 'tank') this.cq(a, 'tank'); else if (t.zt === 'boss') this.cq(a, 'boss'); } if (a.alive && ks !== 'h' && ks !== 'x') this.streakKill(a); }
    const ev = ['k', a ? a.id : 0, t.id, w === KNIFE ? PISTOL : w, head ? 1 : 0, a ? a.kills : 0, t.deaths]; if (w === KNIFE) ev.push(back ? 2 : 1);
    if (ks) { while (ev.length < 8) ev.push(0); ev.push(ks); }
    this.events.push(ev);
    this.inv.onZombieDeath(t, a);
  }
  // testes automatizados (ALLOW_TEST=1): pula pra uma wave, dá poderes, mata zumbis
  testInv(e, m) {
    const I = this.inv;
    if (m.give) { e.inv = m.give.filter((k) => POWER_KEYS.includes(k)).slice(0, INV.INV_MAX); I.A.invChanged(e); }
    if (m.wave) { for (const z of I.zombies) if (z.alive) { z.alive = false; this.ents.delete(z.id); this.events.push(['l', z.id]); } I.zombies = []; I.queue = []; I.bossPending = false; I.startWave(m.wave | 0); }
    if (m.killAll) for (const z of [...I.zombies]) if (z.alive) this.damage(z, 1e6, e, 0, false);
    if (m.clearQueue) { I.queue = []; I.bossPending = false; }
    if (m.drop) I.drop({ x: e.pos.x + 2, y: e.pos.y, z: e.pos.z }, false);
    if (m.ammoDrop) { for (const i of e.slots) { e.reserve[i] = 0; e.mag[i] = 0; if (WEAPONS[i].akimbo) setDrum(e, i, 0); } I.dropAmmo({ x: e.pos.x + 2, y: e.pos.y, z: e.pos.z }, 0); } // zera a munição e solta uma caixa de zumbi ao lado
    if (m.lives != null) e.lives = m.lives | 0;
    if (m.hurt) this.damage(e, m.hurt, null, 0, false);
    if (m.fog) Object.assign(I.fog, m.fog, { t0: 0, t1: 0 });
    if (m.hold) I.phaseEnd = this.T + 1e6; // segura a pausa/preparação (testes lentos)
  }
  // ---------- bots (mesma lógica dos bots offline, sem Three.js) ----------
  randomWaypoint() { const n = this.nav.randomNode(); return n ? { x: n.x, y: n.y, z: n.z } : { x: rand(-10, 10), y: 0, z: rand(-10, 10) }; }
  steer(b, goal) {
    if (!b.path || !b.pathGoal || dist(b.pathGoal, goal) > 2 || this.T > b.repathAt) { b.path = this.nav.path(b.pos, goal) || []; b.pathGoal = { ...goal }; b.repathAt = this.T + rand(2.5, 3.5); }
    const P = b.path;
    while (P.length) { const n = P[0], dx = n.x - b.pos.x, dz = n.z - b.pos.z; if (dx * dx + dz * dz < 0.8 && Math.abs(n.y - b.pos.y) < 1.4) P.shift(); else break; }
    let tgt = P.length ? P[0] : goal;
    if (P.length > 1 && this.T > (b.nextShortcut || 0)) { b.nextShortcut = this.T + 0.25; const n2 = P[1]; if (Math.abs(n2.y - b.pos.y) < 0.3 && Math.abs(P[0].y - b.pos.y) < 0.3 && Math.hypot(n2.x - b.pos.x, n2.z - b.pos.z) < 3.2 && this.nav.walk(b.pos, n2) >= 0) { P.shift(); tgt = n2; } }
    const vx = tgt.x - b.pos.x, vz = tgt.z - b.pos.z, L = Math.hypot(vx, vz); return L > 0.1 ? { x: vx / L, z: vz / L } : null;
  }
  // Dominação: ponto dentro da zona pra onde o bot vai (null = já está dentro, ou modo sem zona)
  zoneGoal(b) {
    if (this.bomb) return botObjective(this.bomb, b, this.bombL.sites, this.live()); // Bomba: site/botijão (null = segura a posição)
    const z = this.zone; if (!z) return null;
    if (inZone(z, b.pos) && Math.hypot(b.pos.x - z.x, b.pos.z - z.z) < DOM.RADIUS * 0.7) return null;
    if (!b.zoneOff || b.zoneOff.z !== z) { const a = rand(0, Math.PI * 2), r = rand(0, DOM.RADIUS * 0.5); b.zoneOff = { z, x: Math.cos(a) * r, zz: Math.sin(a) * r }; }
    return { x: z.x + b.zoneOff.x, y: z.y, z: z.z + b.zoneOff.zz };
  }
  botWeaponFor(b, d) {
    const mind = profileOf(b), hp = b.target ? b.target.hp : 100;
    const side = b.slots[1] ?? PISTOL, pr = b.primary;
    if (isShieldW(pr)) { if (b.shieldBroken) return side; b.knifeMode = false; return d < SHIELD.holdRange ? pr : side; } // perto segura a tampa; longe saca a pistola e ela fica nas costas
    const hasAmmo = (i) => b.mag[i] > 0 || b.reserve[i] > 0;
    // faca: colado no alvo; no Cachaço só pra acabar quem já está baixo
    if (d < 3 && this.T > (b.knifeRoll || 0)) { b.knifeRoll = this.T + 1.5; b.knifeMode = hp <= mind.knifeHp && Math.random() < mind.knifeP; }
    if (b.knifeMode && d < 7) return b.slots[2] ?? KNIFE; if (d >= 7) b.knifeMode = false;
    if (b.sloppy && hasAmmo(b.weapon)) return b.weapon; // Leitão insiste na arma errada pro alcance
    if (pr === 1) return d < 14 ? pr : side;
    if (WEAPONS[pr] && WEAPONS[pr].scope) { const min = pr === 5 ? 14 : pr === 6 ? 6 : 9; return d >= min ? pr : side; }
    if (pr === 3) return d >= 6 && d <= 28 ? pr : side;
    if (pr === UZI) return d < 24 ? pr : side;
    if (pr === P90) return d < 36 ? pr : side;
    if (pr === SEMI) return d < 16 ? pr : side;
    if (pr === CORN_W) return d >= 4 && d <= 13 ? pr : side; // pipoca: nem colado nem longe
    if (WEAPONS[side] && WEAPONS[side].revolver && d < (WEAPONS[side].akimbo ? 6 : 8) && pr !== 1 && pr !== SEMI) return side; // revólver no colo; escopeta e semi ficam na primária
    return pr;
  }
  updateBot(b, dt) {
    if (!b.alive) return;
    if (bombFrozen(this.bomb)) { b.vel.x = b.vel.z = 0; b.useHold = false; return; } // Bomba: preparação, todo mundo parado
    if (b.dummy) { this.placeDummy(b); return; } // Treino: alvo não pensa, não mira, não atira
    if (b.reloadEnd && this.T >= b.reloadEnd) { const Ww = WEAPONS[b.weapon]; b.mag[b.weapon] = Ww.mag; if (Ww.akimbo) setDrum(b, b.weapon, Ww.mag); b.reloadEnd = 0; }
    const mind = profileOf(b);
    b.think -= dt;
    if (b.think <= 0) {
      b.think = nextThink(mind);
      b.sloppy = Math.random() < mind.wrongGun;
      let best = null, bs = 1e9; const eye = center(b, 1.5);
      for (const o of this.ents.values()) {
        if (o === b || !o.alive || (!o.bot && !o.connected) || this.friends(o, b)) continue;
        const d = dist(o.pos, b.pos);
        const score = considerTarget(mind, d, { attacker: o.id === b.lastAttacker, player: !o.bot, hp: o.hp });
        if (score != null && score < bs && this.P.losClear(eye, center(o, 1.2))) { best = o; bs = score; }
      }
      if (b.stunUntil > this.T) best = null; // levou choque: não trava alvo
      if (best !== b.target) { b.target = best; b.aim = 0; }
      if (best) {
        b.lastSeen = { ...best.pos }; b.lastSeenAt = this.T;
        refreshCover(mind, b, best.pos, () => this.nav.randomNode(), (a, c) => this.P.losClear(a, c), this.T);
        if (!(b.coverUntil > this.T)) refreshFlank(mind, b, best.pos, dist(best.pos, b.pos), this.T);
        else { b.flankUntil = 0; b.flankGoal = null; }
        const W = WEAPONS[b.weapon]; if (W && W.mag && wantPanicReload(mind, b.mag[b.weapon] / W.mag) && !b.reloadEnd) b.reloadEnd = this.T + W.reload;
      } else if (mind.nadeFlush && b.nades > 0 && b.lastSeen && this.T - b.lastSeenAt < mind.nadeFlush && this.T > b.nextNade && Math.random() < mind.nadeP) {
        this.botThrow(b, { pos: b.lastSeen, vel: { x: 0, y: 0, z: 0 } }); // copo no último lugar visto, não através da parede
      }
    }
    if (b.target && !b.target.alive) b.target = null;
    const t = b.target; let mx = 0, mz = 0, desiredYaw = b.yaw;
    const face = (x, z) => Math.atan2(x, z); // yaw do modelo (o boneco olha pra +z)
    if (t) {
      let tx = t.pos.x - b.pos.x, tz = t.pos.z - b.pos.z; const d = Math.hypot(tx, tz) || 1; tx /= d; tz /= d; desiredYaw = face(tx, tz);
      const want = this.botWeaponFor(b, d); if (want !== b.weapon && !b.reloadEnd) { b.weapon = want; b.nextFire = Math.max(b.nextFire, this.T + 0.35); }
      const range = (BOT_RANGE[b.weapon] || 10) + mind.rangeBias;
      const zg = this.zoneGoal(b);
      const coverOn = b.coverUntil > this.T && b.coverGoal;
      const flankOn = !coverOn && b.flankUntil > this.T && b.flankGoal;
      if (zg) { const st = this.steer(b, zg); if (st) { mx += st.x * 1.5; mz += st.z * 1.5; } } // Dominação: vai pra zona atirando
      else if (this.zone || this.bomb) { /* dentro da zona / no objetivo: segura a posição, só strafe */ }
      else if (coverOn) { const st = this.steer(b, b.coverGoal); if (st) { mx += st.x; mz += st.z; } } // ferido: some da linha de visão
      else if (flankOn) { const st = this.steer(b, b.flankGoal); if (st) { mx += st.x; mz += st.z; } } // dá a volta em vez de correr reto
      else if (Math.abs(t.pos.y - b.pos.y) > 1.2 && d > 3) { const st = this.steer(b, t.pos); if (st) { mx += st.x; mz += st.z; } }
      else if (isSaber(b.weapon)) { const reach = (saberProfile(WEAPONS[b.weapon]) || { reach: 2.4 }).reach; if (d > reach - 0.15) { mx += tx; mz += tz; } this.botSaberThink(b, t, d); }
      else if (b.weapon === KNIFE) { if (d > 1.1) { mx += tx; mz += tz; } } // faca: cola no alvo
      else if (isShieldW(b.weapon)) { if (d > 1.8) { mx += tx; mz += tz; } } // tampa: chega na porrada
      else if (d > range + 3) { mx += tx; mz += tz; } else if (d < range - 3) { mx -= tx; mz -= tz; }
      const faceShield = raisedAt(t, t.yaw, b.pos);
      b.strafeT -= dt; if (b.strafeT <= 0) { const s = rollStrafe(mind); b.strafeDir = s.dir; b.strafeT = s.t; if (s.jump && b.onGround) b.vel.y = JUMP; }
      if (mind.burstStop && b.aim > b.reaction * 0.75 && this.T >= (b.burstAt || 0)) { b.holdUntil = this.T + mind.burstStop; b.burstAt = this.T + mind.burstEvery; }
      const stopping = this.T < (b.holdUntil || 0); // contra-strafe: para um instante pra o tiro sair reto
      if (!coverOn && !stopping) { const sideStep = mind.strafeW * (faceShield ? 2 : 1); mx += tz * b.strafeDir * sideStep; mz += -tx * b.strafeDir * sideStep; }
      let nade = nadeChoice(mind, b, d, t.pos.y - b.pos.y, this.T);
      if (faceShield && nade === 'wait' && Math.random() < SHIELD.botNade) nade = 'throw';
      if (nade === 'throw') this.botThrow(b, t); else if (nade === 'wait') b.nextNade = this.T + nadeWaitFor(mind);
      b.aim += dt;
      let diff = desiredYaw - b.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const scopeWait = scopeDelay(mind, b.weapon, !!(WEAPONS[b.weapon] && WEAPONS[b.weapon].scope));
      if (b.aim > b.reaction + scopeWait && Math.abs(diff) < mind.aimGate) this.botShoot(b, t, d);
    } else {
      this.botShootHeli(b); // sem alvo no chão: atira no Gavião inimigo que estiver à vista (como os bots offline)
      let goal = null;
      const near = (type, maxD) => this.pickups.filter((p) => p.active && p.type === type && dist(p.pos, b.pos) < maxD).sort((a, c) => dist(a.pos, b.pos) - dist(c.pos, b.pos))[0];
      const hp = b.hp < 45 ? near('health', 1e9) : null, np = !hp && b.nades < 2 ? near('grenade', 22) : null;
      const zg = this.zoneGoal(b);
      let bc = null; if (b.hp < 60) { let bd = 12; for (const x of this.bacons) { if (x.id === b.id || this.T - x.born < BACON_ITEM.from || Math.abs(x.y - b.pos.y) >= BACON_ITEM.dy) continue; const d = dist(x, b.pos); if (d < bd) { bd = d; bc = x; } } }
      const heardFresh = b.heard && this.T - b.heardAt < mind.hearMemory;
      const seenFresh = b.lastSeen && this.T - b.lastSeenAt < mind.memory;
      if (bc) goal = bc; else if (hp && b.hp < 30) goal = hp.pos; else if (zg) goal = zg; else if (this.zone || this.bomb) goal = b.pos; else if (hp) goal = hp.pos; else if (np) goal = np.pos;
      else if (heardFresh && (!seenFresh || b.heardAt >= b.lastSeenAt)) goal = { x: b.heard.x, y: b.heard.y || b.pos.y, z: b.heard.z };
      else if (seenFresh) goal = b.lastSeen;
      else { if (!b.wp) b.wp = this.randomWaypoint(); goal = b.wp; }
      const gx = goal.x - b.pos.x, gz = goal.z - b.pos.z;
      if (Math.hypot(gx, gz) < 1.5 && Math.abs(goal.y - b.pos.y) < 1.5 && !(bc && Math.hypot(gx, gz) > 0.1)) {
        if (goal === b.wp) b.wp = null; else if (goal === b.lastSeen) b.lastSeenAt = -99; else if (b.heard && goal.x === b.heard.x && goal.z === b.heard.z) b.heardAt = -99;
      }
      else { const st = this.steer(b, goal) || { x: gx / Math.hypot(gx, gz), z: gz / Math.hypot(gx, gz) }; mx = st.x; mz = st.z; desiredYaw = face(st.x, st.z); }
      const W = WEAPONS[b.weapon];
      if (W && W.revolver) { if (ammoLow(b, b.weapon) && !b.reloadEnd) b.reloadEnd = this.T + W.reload; }
      else if (W && W.mag && wantSafeReload(mind, b.mag[b.weapon] / W.mag) && !b.reloadEnd) b.reloadEnd = this.T + W.reload;
    }
    if (b.useHold) { mx = 0; mz = 0; } // plantando/desarmando: fica parado
    const sp = BOT_SPEED * moveScale(WEAPONS[b.weapon], b.weapon, KNIFE, MELEE.speedMul) * (b.stunUntil > this.T ? SHOCK.slow : 1), ml = Math.hypot(mx, mz); if (ml > 0) { mx = mx / ml * sp; mz = mz / ml * sp; }
    const dashing = b.saber && this.T < b.saber.dashUntil;
    if (b.shieldDashUntil > this.T) { const spc = SHIELD.charge.speed; b.vel.x = Math.sin(b.yaw) * spc; b.vel.z = Math.cos(b.yaw) * spc; } // investida: 13,5 m/s na frente do modelo, acima do cap da arma
    else if (dashing) { const rate = (b.saber.dashDist || 0) / Math.max(0.05, b.saber.dashDur || 0.16); b.vel.x = b.saber.dashDir.x * rate; b.vel.z = b.saber.dashDir.z * rate; }
    else { const acc = b.onGround ? 10 : 3; b.vel.x += (mx - b.vel.x) * Math.min(1, acc * dt); b.vel.z += (mz - b.vel.z) * Math.min(1, acc * dt); }
    const blocked = this.P.moveEntity(b, dt);
    if (blocked) { b.stuck += dt; if (b.onGround) b.vel.y = JUMP; if (b.stuck > 1.2) { b.wp = this.randomWaypoint(); b.path = null; b.lastSeenAt = -99; b.strafeDir *= -1; b.stuck = 0; b.stuckCount = (b.stuckCount || 0) + 1; } }
    else b.stuck = Math.max(0, b.stuck - dt);
    let d = desiredYaw - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); b.yaw += d * Math.min(1, dt * mind.turn);
    for (const i of b.slots) if (b.reserve[i] < WEAPONS[i].mag && !(WEAPONS[i].rocket && b.reserve[i] > 0)) b.reserve[i] = WEAPONS[i].reserve;
  }
  botSaberThink(b, t, d) {
    const prof = saberProfile(WEAPONS[b.weapon]); if (!prof || b.stunUntil > this.T) return;
    const st = ensureSaber(b);
    const skill = botSkill(b.reaction, b.accuracy);
    if (this.T >= (b.saberPlanUntil || 0)) {
      let foes = 0;
      for (const o of this.ents.values()) if (o !== b && o.alive && (o.bot || o.connected) && !this.friends(o, b) && Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) <= (prof.spin ? prof.spin.radius : 3)) foes++;
      const gun = !!(t && WEAPONS[t.weapon] && !WEAPONS[t.weapon].melee);
      b.saberPlan = botPlan(skill, {
        dist: d, dual: !!WEAPONS[b.weapon].dual, foesNear: foes, gun, hp: b.hp,
        dashReady: this.T >= st.dashReady, specialReady: this.T >= st.specialReady && !st.bladeOut,
        canBlock: this.T >= st.lockUntil && st.stam > 22, inReach: d <= prof.reach + 0.15, roll: Math.random(),
      });
      b.saberPlanUntil = this.T + (b.saberPlan.block ? b.saberPlan.blockSeconds || 0.25 : 0.28);
    }
    const plan = b.saberPlan || {};
    let block = !!plan.block;
    if (block && plan.blockSeconds <= 0.22 && st.blocking && this.T - st.blockAt > SABER_KIT.block.parry) block = false;
    if (block !== st.wantBlock) this.saberBlock(b, block);
    const forward = { x: Math.sin(b.yaw), z: Math.cos(b.yaw) };
    if (plan.dash && this.T >= st.dashReady) this.saberDash(b, ['sd', forward.x, forward.z]);
    else if (plan.special && this.T >= st.specialReady && !st.bladeOut) this.saberSpecial(b, ['ss', [forward.x, 0, forward.z]]);
    else if (plan.swing && d <= prof.reach + 0.2 && peekSwing(st, this.T, prof, 0)) {
      const sw = applySwing(st, this.T, peekSwing(st, this.T, prof, 0));
      b.nextFire = st.nextSwing;
      this.saberArc(b, center(b, EYE), forward, sw.dmg, sw.reach, sw.arc);
      this.events.push(['swg', b.id, sw.idx, b.weapon]);
    }
  }
  botShoot(b, t, d) {
    const w = WEAPONS[b.weapon];
    if (b.stunUntil > this.T) return; // atordoado não atira
    if (isSaber(b.weapon)) return; // o sabre age em botSaberThink (combo, bloqueio, investida, especial)
    if (w.shield) { // porrada; de vez em quando investe pra fechar (não rola o dado todo quadro)
      if (this.T < b.nextFire || b.shieldBroken) return;
      if (d > 2.4 && d < 6.5 && this.T >= (b.shieldDashAt || 0) && this.T >= (b.shieldRoll || 0)) {
        b.shieldRoll = this.T + 1.2;
        if (Math.random() < 0.35) { const o = center(b, 1.4); this.humanBash(b, 1, o, { x: Math.sin(b.yaw), y: 0, z: Math.cos(b.yaw) }); b.nextFire = this.T + 0.4; return; }
      }
      if (d > SHIELD.bash.reach + 0.35) return;
      const o = center(b, 1.4), at = center(t, 1.1);
      this.humanBash(b, 0, o, { x: at.x - o.x, y: at.y - o.y, z: at.z - o.z });
      b.nextFire = this.T + SHIELD.bash.rate;
      return;
    }
    if (this.T < b.nextFire || b.reloadEnd > this.T) return;
    if (w.melee) { // faca dos bots: mesma regra dos humanos
      if (d > MELEE.slash.range + 0.8) return;
      const kind = Math.random() < 0.3 ? 'stab' : 'slash', o = center(b, 1.5), at = center(t, 1.1);
      b.nextFire = this.T + MELEE[kind].rate * rand(1.3, 1.9); b.invulnUntil = Math.min(b.invulnUntil, this.T);
      this.melee(b, kind, o, norm({ x: at.x - o.x, y: at.y - o.y, z: at.z - o.z })); return;
    }
    const mind = profileOf(b);
    const stopping = this.T < (b.holdUntil || 0);
    const selfMoving = !stopping && Math.hypot(b.vel.x, b.vel.z) > 1.15;
    if (w.akimbo) {
      const slack = 1 + Math.max(0, ((b.accuracy || 0.05) - 0.045) * 8);
      const h = akimboReady(b, b.weapon, this.T, slack);
      if (h < 0) { if (drumsEmpty(b, b.weapon)) b.reloadEnd = this.T + w.reload; return; }
      if (mind.holdFire && selfMoving) return;
      spendRound(b, b.weapon, h); b.nextFire = this.T + w.rate * 0.45 * mind.fireMul; b.invulnUntil = Math.min(b.invulnUntil, this.T);
    } else {
      if (b.mag[b.weapon] <= 0) { b.reloadEnd = this.T + w.reload; return; }
      if (w.rocket && d < 6) return;
      if (w.corn && d < 4) return;
      if (mind.holdFire && selfMoving && !w.melee && !w.rocket && !w.corn && !(w.pellets > 1)) return; // Cachaço só dispara hitscan no contra-strafe
      b.mag[b.weapon]--; b.nextFire = this.T + w.rate * ([rand(2.2, 3.4), 1.4, 1.6, 1, rand(1.8, 2.6), 1.15, 1.05][b.weapon] || 1.2) * mind.fireMul; b.invulnUntil = Math.min(b.invulnUntil, this.T);
    }
    if (w.burst) { b.burstLeft = (b.burstLeft || w.burst) - 1; b.nextFire = this.T + (b.burstLeft > 0 ? w.rate : w.burstDelay * rand(1.6, 2.6)); } // FAMAS: rajada de 3 e respira
    const o = center(b, 1.3), tMoving = Math.hypot(t.vel.x, t.vel.z) > 2;
    if (w.corn) { const oo = center(b, 1.4); this.launchCorn(b, oo, cornAim(oo, { x: t.pos.x + (t.vel.x || 0) * mind.cornLead + rand(-mind.cornErr, mind.cornErr), y: t.pos.y + 0.7, z: t.pos.z + (t.vel.z || 0) * mind.cornLead + rand(-mind.cornErr, mind.cornErr) })); return; }
    if (w.rocket) { const lead = d / w.rocket.speed, at = { x: t.pos.x + (t.vel.x || 0) * lead + rand(-mind.rocketErr, mind.rocketErr), y: t.pos.y + 0.25, z: t.pos.z + (t.vel.z || 0) * lead + rand(-mind.rocketErr, mind.rocketErr) }; const oo = center(b, 1.4); this.launchRocket(b, oo, norm({ x: at.x - oo.x, y: at.y - oo.y, z: at.z - oo.z })); return; }
    const aimPt = hitscanAim(mind, b, t.pos, t.vel, { aimTime: b.aim, scope: !!w.scope, pellets: w.pellets, pistol: b.weapon === PISTOL || (!!w.revolver && !w.akimbo), targetMoving: tMoving, selfMoving, egged: b.eggUntil > this.T, weaponSpread: w.spread, stance: stanceScale(t.crouch) });
    if (w.akimbo) aimPt.spread *= 1.45; else if (w.revolver) aimPt.spread *= 0.72 / (mind.pistolMul || 0.9);
    const sa = !w.scope && shieldAim(b.pos, t, t.yaw, (b.reaction || 0.5) < 0.48);
    if (sa) { const off = aimOffset(t.yaw, sa.xOff); aimPt.x = t.pos.x + off.x; aimPt.y = t.pos.y + sa.y; aimPt.z = t.pos.z + off.z; }
    const base = norm({ x: aimPt.x - o.x, y: aimPt.y - o.y, z: aimPt.z - o.z });
    const spread = aimPt.spread;
    const dirs = []; for (let p = 0; p < Math.max(1, w.pellets); p++) dirs.push(norm({ x: base.x + (Math.random() - 0.5) * 2 * spread, y: base.y + (Math.random() - 0.5) * 2 * spread, z: base.z + (Math.random() - 0.5) * 2 * spread }));
    this.hitscan(b, o, dirs, b.weapon);
    if (w.scope) b.aim = b.reaction * 0.4;
  }
  botShootHeli(b) {
    if (!this.helis.length || this.T < b.nextFire || b.reloadEnd > this.T) return;
    const eye = center(b, 1.5); let hl = null, hp = null;
    for (const h of this.helis) { if (!h.alive || !this.heliFoe(h, b)) continue; const p = this.heliAt(h), d = dist(eye, p); if (d <= 62 && d >= 4 && this.P.losClear(eye, p)) { hl = h; hp = p; break; } }
    if (!hl) return;
    const w = WEAPONS[b.weapon]; if (w.melee || w.rocket || w.shield || isSaber(b.weapon)) return;
    if (w.akimbo) {
      if (drumsEmpty(b, b.weapon)) { b.reloadEnd = this.T + w.reload; return; }
      const h = akimboReady(b, b.weapon, this.T, 1.2);
      if (h < 0) return;
      spendRound(b, b.weapon, h); b.nextFire = this.T + w.rate * 0.45;
    } else {
      if (b.mag[b.weapon] <= 0) { b.reloadEnd = this.T + w.reload; return; }
      b.mag[b.weapon]--; b.nextFire = this.T + w.rate * 1.6;
    }
    b.yaw = Math.atan2(hp.x - b.pos.x, hp.z - b.pos.z);
    b.invulnUntil = Math.min(b.invulnUntil, this.T);
    const o = center(b, 1.3), base = norm({ x: hp.x - o.x, y: hp.y - o.y, z: hp.z - o.z }), sp = 0.05, dirs = [];
    for (let i = 0; i < Math.max(1, w.pellets); i++) dirs.push(norm({ x: base.x + (Math.random() - 0.5) * 2 * sp, y: base.y + (Math.random() - 0.5) * 2 * sp, z: base.z + (Math.random() - 0.5) * 2 * sp }));
    this.hitscan(b, o, dirs, b.weapon);
  }
  botThrow(b, t) {
    const p = profileOf(b), from = center(b, 1.6), tp = t.pos, tv = t.vel || { x: 0, y: 0, z: 0 };
    const to = { x: tp.x + (tv.x || 0) * p.nadeLead + rand(-p.nadeErr, p.nadeErr), y: tp.y + 0.2, z: tp.z + (tv.z || 0) * p.nadeLead + rand(-p.nadeErr, p.nadeErr) };
    const dx = to.x - from.x, dz = to.z - from.z, T = 0.55 + Math.hypot(dx, dz) / 16, g = -NADE.grav;
    b.nades--; this.throwNade(b, from, { x: dx / T, y: (to.y - from.y + 0.5 * g * T * T) / T, z: dz / T }); b.nextNade = this.T + nadeCooldown(p);
  }
}

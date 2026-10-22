// Docão Shooter — jogo original de tiro em primeira pessoa com o Docão (mascote Cheers).
import * as THREE from 'three';
import { makeWardrobeCase } from './menu-wardrobe.js';
import { makeMenuBackdrop } from './menu-backdrop.js';
import { makeDocao, makeFPArms, makeFPForearm, poseFPForearm, setPose, setCrouchPose, toon, outline, makeCup, makeRocket, drawLogo, makeKnife } from './docao.js';
import { makeFPSniper, poseSniperBolt } from './sniper-view.js';
import { makeFPSaber, makeWorldSaber, setSaberColor, poseSaber } from './saber-view.js';
import { makeFPCrossbow, makeFPBow, poseDraw, poseRelease, makeFlightShaft } from './bow-view.js';
import { renderWeaponThumb } from './weapon-thumbs.js';
import { camoLevel, camoInfo, nextCamo, applyWeaponCamo, resetWeaponCamo } from './weapon-camo.js';
import { createSaberSfx } from './saber-sfx.js';
import { resetFeedback, feedbackPoints, feedbackHit, feedbackKill, feedbackAward, tickFeedback } from './feedback.js';
import { SMOKE, STUN, makeTacticalMesh, makeSmokeCloud, inRadius } from './tactical-nades.js';
import { mountUav, showUav, drawUav, tickUav, hideUav } from './uav.js';
import { mountStreakUi, setStreakCount, setStreakCycle, openStrikeMap, closeStrikeMap, showNukeCount, hideNuke, showNukeReady, hideNukeReady } from './killstreak-ui.js';
import { makeTablet, poseTablet, makeLaptop, poseLaptop, makeRadio, poseRadio } from './fp-gear.js';
import { SKINS, getSkin, DEFAULT_SKIN } from './skins.js';
import './costumes.js';
import { MAPS, PLAY_MAPS, getMap } from './maps.js';
import { TRAIN, isTraining, dummyX } from './shared/training.js';
import { buildWorld, disposeWorld, applyPalette, renderThumb } from './world.js';
import { buildNav } from './nav.js';
import { initBacon, spawnBacon, updateBacon, clearBacon, popModel, baconStats, activeBacons, edibleBacons, eatBacon, BACON } from './bacon.js';
import { Net, createRoom, roomInfo } from './net.js';
import { initChat, chatTyping, chatShown, chatRoomOn, chatConsumeUnlock, chatNoteLocked, openChat, closeChat, chatSeed, chatPush, chatSetRoom, chatSetTeam, chatClear, chatUseAll } from './chat.js';
import { initVoice, voicePtt, voiceCycle, voiceReset, voiceRoster, voiceSignal, voiceTalking, voiceMuted, voiceToggleMute, voiceRefresh } from './voice.js';
import { SEND_HZ, INTERP_DELAY } from './config.js';
import { cleanName, NAME_MAX } from './shared/names.js';
import { createPhysics, rayHitboxes } from './shared/physics.js';
import { CROUCH, crouchAmount, stanceScale, eyeHeight, stepCrouch } from './shared/stance.js';
import { explosionHits, rayCapsule, ROCKET_PAD, sniperSpread } from './shared/combat.js';
import { meleeHit, MELEE_KINDS } from './shared/melee.js';
import { DOM, TEAM_NAMES, TEAM_COLORS, TEAM_HEX, TEAM_DARK, pickZone, newZoneState, zoneCounts, stepZone, inZone, smallerTeam } from './shared/domination.js';
import { BACON_ITEM, noteHurt, resetRegen, regenStep } from './shared/rules.js';
import { KS_KILL_NAME, heliPos } from './shared/killstreaks.js';
import { KILL_LIMIT, TIME_LIMIT, normTime, RESPAWN_TIME, INVULN, GRAV, JUMP, SPEED, BOT_SPEED, STEP, RADIUS, HEIGHT, EYE, WEAPONS, PRIMARIES, BOT_PRIMARIES, SECONDARIES, MELEES, CATEGORIES, PISTOL, KNIFE, SABER, UZI, P90, NAIL, SEMI, CROSS, BOW, MELEE, SABER_COLORS, W_NADE, NADE, WEAPON_SHORT, BOT_DEFS, BOT_RANGE, TAG_COLORS } from './shared/rules.js';

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- Constantes ----------------
// ---------------- Constantes (regras em shared/rules.js) ----------------
const BASE_FOV = 75, ADS_TIME = 0.15, ADS_SPEED = 0.6; // mira (botão direito)
const COLORS = { skin: 0xF7A531, snout: 0xF58A6E, cheek: 0xFF7FA0, hoof: 0x7a4535, outline: 0x2a1410, red: 0xe63946, cyan: 0x7DF9FF };

// ---------------- Renderer / cenas ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0x8fd3ff, 50, 120);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300); // near 0,1 (era 0,05): 2× mais precisão de profundidade, menos piscar de piso ao longe; o corpo (raio 0,42) nunca deixa a câmera tão perto de uma parede
camera.rotation.order = 'YXZ';
scene.add(camera);

const fpScene = new THREE.Scene();
const fpCam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);

const hemi = new THREE.HemisphereLight(0xffffff, 0x6a8f4a, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 120 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
const fpHemi = new THREE.HemisphereLight(0xffffff, 0x6a8f4a, 1.8); fpScene.add(fpHemi);
const fpSun = new THREE.DirectionalLight(0xffffff, 2); fpSun.position.set(1, 2, 1); fpScene.add(fpSun);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = fpCam.aspect = innerWidth / innerHeight;
  if (state === 'menu') camera.clearViewOffset();
  camera.updateProjectionMatrix(); fpCam.updateProjectionMatrix();
});

// ---------------- Materiais toon ----------------
const basic = (color) => new THREE.MeshBasicMaterial({ color });
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function nameSprite(text, color = '#ffffff') {
  const tex = canvasTex(256, 64, (x, w, h) => {
    x.font = 'bold 34px "Trebuchet MS", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 7; x.strokeStyle = '#2a1410'; x.strokeText(text, w / 2, h / 2); x.fillStyle = color; x.fillText(text, w / 2, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(1.8, 0.45, 1); s.position.y = 2.55; return s;
}

// ---------------- Mapa (dados em maps.js, construção em world.js) ----------------
let solids = [], worldMeshes = [], SPAWNS = [], nav = null, currentMap = null, worldGroup = null, mapBounds = [36, 36];
// Física/colisão: a MESMA implementação do servidor (shared/physics.js) — a predição online bate com o servidor.
let PHYS = createPhysics([], mapBounds);
function indexSolids() { PHYS = createPhysics(solids, mapBounds); } // broadphase em grade 4 m + movimento compartilhado
const solidsAt = (x, z) => PHYS.solidsAt(x, z);
const topAt = (s, x, z) => PHYS.topAt(s, x, z);
// AABB completo: só bloqueia se o corpo (pés..cabeça) cruza a caixa; dá pra andar debaixo de lajes e 2º andar
const collides = (x, y, z) => PHYS.collides(x, y, z);
const groundAt = (x, z, y) => PHYS.groundAt(x, z, y);
const ceilingAt = (x, z, headY) => PHYS.ceilingAt(x, z, headY);
const moveEntity = (e, dt) => PHYS.moveEntity(e, dt);

const raycaster = new THREE.Raycaster();
function wallDistance(o, d, far) {
  raycaster.set(o, d); raycaster.far = far;
  const h = raycaster.intersectObjects(worldMeshes, false);
  return h.length ? h[0] : null;
}
function losClear(a, b) {
  const d = b.clone().sub(a); const len = d.length(); d.divideScalar(len);
  return !wallDistance(a, d, len - 0.3);
}
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return -1; const sq = Math.sqrt(h); let t = -b - sq; if (t < 0) t = -b + sq; return t;
}
const center = (e, y = 1.0) => new V3(e.pos.x, e.pos.y + y * stanceScale(e.crouch), e.pos.z);

// ---------------- Áudio sintetizado ----------------
let actx = null, master = null, noiseBuf = null, menuMuted = false;
function initAudio() {
  if (actx) { actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = menuMuted ? 0 : 0.4; master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    saberSfx.bind(actx, master);
  } catch (e) { actx = null; }
}
function noise(dur, freq, vol, type = 'lowpass', delay = 0) {
  if (!actx) return; const t = actx.currentTime + delay;
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!actx) return; const t = actx.currentTime + delay;
  const o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  rifle: (v = 1) => { noise(0.11, 3000, 0.5 * v); tone('square', 220, 60, 0.07, 0.15 * v); },
  shotgun: (v = 1) => { noise(0.45, 1300, 1.0 * v); tone('sawtooth', 100, 30, 0.3, 0.35 * v); noise(0.12, 5000, 0.25 * v, 'highpass'); },
  pump: (v = 1, d = 0) => { noise(0.05, 1800, 0.35 * v, 'bandpass', d); tone('square', 240, 180, 0.04, 0.08 * v, d); noise(0.05, 2600, 0.4 * v, 'bandpass', d + 0.17); tone('square', 320, 260, 0.04, 0.1 * v, d + 0.17); },
  shell: () => { tone('square', 620, 520, 0.03, 0.08); noise(0.04, 3000, 0.15, 'bandpass', 0.02); },
  sniper: (v = 1) => { noise(0.9, 1800, 1.3 * v); tone('sine', 140, 28, 0.7, 0.6 * v); noise(0.18, 7000, 0.5 * v, 'highpass'); noise(1.4, 500, 0.35 * v, 'lowpass', 0.15); },
  canhao: (v = 1) => { noise(1.15, 700, 1.5 * v); tone('sine', 70, 22, 0.85, 0.75 * v); noise(0.22, 5000, 0.35 * v, 'highpass'); noise(1.6, 280, 0.45 * v, 'lowpass', 0.12); },
  carabina: (v = 1) => { noise(0.35, 2400, 0.85 * v); tone('sine', 200, 55, 0.28, 0.4 * v); noise(0.08, 6000, 0.3 * v, 'highpass'); },
  bolt: (v = 1, d = 0) => { tone('square', 420, 380, 0.04, 0.1 * v, d); noise(0.06, 2400, 0.3 * v, 'bandpass', d + 0.12); noise(0.05, 3200, 0.3 * v, 'bandpass', d + 0.42); tone('square', 520, 480, 0.03, 0.1 * v, d + 0.55); },
  bazooka: (v = 1) => { noise(0.6, 900, 0.9 * v, 'bandpass'); tone('sawtooth', 180, 60, 0.4, 0.3 * v); noise(1.0, 2500, 0.2 * v, 'highpass', 0.05); },
  pistol: (v = 1) => { noise(0.08, 3600, 0.45 * v); tone('square', 330, 90, 0.06, 0.14 * v); },
  uzi: (v = 1) => { noise(0.045, 4200, 0.32 * v); tone('square', 280, 90, 0.04, 0.08 * v); },
  p90: (v = 1) => { noise(0.05, 3400, 0.28 * v); tone('square', 240, 80, 0.045, 0.07 * v); },
  prego: (v = 1) => { noise(0.04, 2200, 0.35 * v, 'bandpass'); tone('square', 180, 70, 0.05, 0.1 * v); noise(0.03, 5000, 0.12 * v, 'highpass'); },
  semi: (v = 1) => { noise(0.28, 1600, 0.75 * v); tone('sawtooth', 140, 50, 0.16, 0.22 * v); noise(0.08, 5200, 0.18 * v, 'highpass'); },
  besta: (v = 1) => { tone('triangle', 220, 70, 0.09, 0.2 * v); noise(0.06, 1800, 0.35 * v, 'bandpass'); tone('sine', 640, 180, 0.05, 0.1 * v, 0.02); },
  arco: (v = 1) => { tone('triangle', 280, 90, 0.08, 0.16 * v); noise(0.05, 2400, 0.28 * v, 'highpass'); tone('sine', 520, 160, 0.05, 0.08 * v); },
  empty: () => tone('square', 1100, 1000, 0.03, 0.08),
  reload: () => { tone('square', 500, 420, 0.04, 0.1); tone('square', 700, 600, 0.04, 0.1, 0.35); noise(0.06, 2500, 0.3, 'highpass', 0.8); },
  hit: () => tone('sine', 1300, 1700, 0.06, 0.25),
  kill: () => { tone('triangle', 700, 1400, 0.18, 0.3); tone('triangle', 1050, 2100, 0.2, 0.2, 0.06); },
  oink: (v = 1, p = 1) => { tone('sawtooth', 430 * p, 250 * p, 0.12, 0.18 * v); tone('sawtooth', 400 * p, 230 * p, 0.12, 0.15 * v, 0.14); },
  die: (v = 1) => tone('sawtooth', 520, 110, 0.55, 0.22 * v),
  chomp: (v = 1) => { noise(0.06, 2400, 0.32 * v, 'bandpass'); noise(0.06, 1900, 0.26 * v, 'bandpass', 0.1); tone('sine', 520, 880, 0.1, 0.16 * v, 0.04); tone('triangle', 880, 1320, 0.12, 0.14 * v, 0.16); }, // nhac nhac + plim
  pickup: () => { tone('sine', 660, 660, 0.08, 0.2); tone('sine', 880, 880, 0.08, 0.2, 0.08); tone('sine', 1320, 1320, 0.12, 0.2, 0.16); },
  jump: () => tone('sine', 300, 600, 0.1, 0.06),
  boom: (v = 1) => { noise(1.1, 700, 1.4 * v); tone('sine', 110, 28, 0.8, 0.7 * v); noise(0.5, 3500, 0.25 * v, 'highpass', 0.12); noise(0.9, 6000, 0.12 * v, 'highpass', 0.3); tone('triangle', 900, 1600, 0.08, 0.12 * v, 0.05); },
  incoming: (v = 1) => { tone('sine', 980, 160, 1.05, 0.16 * v); noise(0.9, 1400, 0.1 * v, 'bandpass'); },
  toss: (v = 1) => { noise(0.18, 1800, 0.25 * v, 'bandpass'); tone('sine', 500, 260, 0.15, 0.08 * v); },
  bounce: (v = 1) => tone('square', 260 + Math.random() * 80, 180, 0.05, 0.08 * v),
  charge: () => tone('sine', 300, 300, 0.03, 0.03),
  knife: (v = 1, kind = 'slash') => { // golpe: assobio do ar cortando
    if (kind === 'stab') { noise(0.16, 1400, 0.5 * v, 'bandpass'); tone('sine', 520, 160, 0.14, 0.08 * v); }
    else { noise(0.14, 2600, 0.45 * v, 'bandpass'); noise(0.1, 4800, 0.18 * v, 'highpass', 0.03); tone('sine', 900, 320, 0.12, 0.06 * v); }
  },
  knifeHit: (v = 1) => { noise(0.09, 700, 0.9 * v); tone('square', 170, 70, 0.09, 0.22 * v); tone('triangle', 2600, 1900, 0.06, 0.07 * v, 0.01); },
  knifeDraw: (v = 1) => { tone('triangle', 1700, 2900, 0.14, 0.06 * v); noise(0.12, 6500, 0.12 * v, 'highpass'); },
  pop: (v = 1) => { tone('sine', 820, 180, 0.12, 0.25 * v); noise(0.18, 1400, 0.35 * v, 'bandpass'); },
  streak: (n = 2) => { const k = Math.min(Math.max(n, 2), 6); for (let i = 0; i < k - 1; i++) tone('square', 340 + i * 80, 520 + i * 90, 0.07, 0.11, i * 0.055); if (k >= 5) noise(0.18, 1600, 0.22, 'bandpass', 0.18); },
  sizzle: (v = 1, dur = 1.5) => { // bacon fritando: chiado agudo + estalinhos de gordura
    if (v < 0.03) return; noise(dur, 5200, 0.16 * v, 'highpass'); noise(dur * 0.7, 2600, 0.08 * v, 'bandpass', 0.05);
    const n = Math.round(6 + dur * 10); for (let i = 0; i < n; i++) noise(0.025, 2500 + Math.random() * 3500, (0.12 + Math.random() * 0.2) * v, 'bandpass', Math.random() * dur);
  },
};
const distVol = (p) => clamp(1 - p.distanceTo(player.pos) / 60, 0.05, 1);
const saberSfx = createSaberSfx();

// ---------------- Entidades ----------------
let gameTime = 0, state = 'menu', hadLock = false, entities = [], player = null, sens = 1.4, sensAds = 1, revengeName = null;
try {
  const savedSens = localStorage.getItem('docao.sens'); if (savedSens) $('sens').value = savedSens;
  const savedAds = localStorage.getItem('docao.sensAds'); if (savedAds) $('sensAds').value = savedAds;
  sens = parseFloat($('sens').value) || 1.4; sensAds = parseFloat($('sensAds').value) || 1;
} catch (e) { /* sem storage */ }
let mode = 'dm', teamScore = [0, 0], zone = null, zoneT = 0; // modo de jogo: 'dm' (mata-mata) | 'dom' (Dominação) | 'explore' (mapa vazio)
let spawnHold = 'primary'; // arma na mão ao renascer (tela de morte)
const teamMode = () => mode === 'dom';
const training = () => isTraining(mode); // Estande do Docão: bots viram alvos
const exploreMode = () => mode === 'explore';
const friends = (a, b) => teamMode() && a && b && a !== b && a.team === b.team && a.team >= 0;
let online = null; // modo online: { net, code, myId, hostId, ents: Map(id → entidade), evq, ... } (ver seção Online)
let ads = 0; // 0 = normal, 1 = mirando (zoom)
const keys = {}; let mouseDown = false, firedThisPress = false;

function makeEntity(name, isPlayer, skinId, tag = '#ffffff') {
  const skin = getSkin(skinId);
  const e = { name, isPlayer, skinId: skin.id, float: !!skin.float, floatPh: Math.random() * 6, nextWisp: 0, shirt: (skin.shirt && skin.shirt.color) || '#d8261c', tag, pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, crouch: 0, onGround: false, hp: 100, alive: true,
    kills: 0, deaths: 0, invulnUntil: 0, weapon: 0, primary: 0, nextPrimary: 0, mag: WEAPONS.map(() => 0), reserve: WEAPONS.map(() => 0), reloadEnd: 0, nextFire: 0, switchEnd: 0, actionEnd: 0,
    respawnAt: 0, deathAt: 0, fxDeath: 0, lastAttacker: null, flashUntil: 0, nades: 0, smokeNades: 0, stunNades: 0, stunUntil: 0, charging: false, chargeStart: 0, nextNade: 0, gunKills: WEAPONS.map(() => 0) };
  e.nextPrimary = isPlayer ? selectedPrimary : BOT_PRIMARIES[Math.floor(Math.random() * BOT_PRIMARIES.length)];
  e.nextSecondary = isPlayer ? selectedSecondary : PISTOL;
  e.nextMelee = isPlayer ? selectedMelee : KNIFE;
  if (!isPlayer) {
    e.model = makeDocao(skin); scene.add(e.model.group);
    if (e.model.guns[SABER]) setSaberColor(e.model.guns[SABER], saberColor);
    e.tagSprite = nameSprite(name, tag); e.model.group.add(e.tagSprite);
    e.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.25, depthWrite: false }));
    e.bubble.position.y = 1.0; e.model.group.add(e.bubble);
    Object.assign(e, { think: 0, target: null, aim: 0, reaction: rand(0.35, 0.65), strafeDir: 1, strafeT: 0, wp: null, stuck: 0, lastSeen: null, lastSeenAt: -99, walk: 0, accuracy: rand(0.045, 0.07) });
  }
  return e;
}

// spawn equilibrado: longe dos vivos e, se possível, fora da linha de visão deles
function pickSpawn(e) {
  let best = SPAWNS[0], bd = -Infinity;
  for (const s of SPAWNS) {
    let md = 1e9, seen = false; const eye = new V3(s.x, s.y + 1.5, s.z);
    for (const o of entities) {
      if (o === e || !o.alive || friends(o, e)) continue; const d = o.pos.distanceTo(s); md = Math.min(md, d);
      if (!seen && d < 60 && losClear(eye, center(o, 1.5))) seen = true;
    }
    const score = Math.min(md, 40) + Math.random() * 6 - (seen ? 30 : 0); if (score > bd) { bd = score; best = s; }
  }
  return best;
}
function respawn(e) {
  e.pos.copy(pickSpawn(e)); e.vel.set(0, 0, 0); e.crouch = 0; e.hp = 100; e.alive = true; e.invulnUntil = gameTime + INVULN; resetRegen(e);
  if (e.isPlayer) keys.Space = false;
  if (!e.isPlayer && Math.random() < 0.3) e.nextPrimary = BOT_PRIMARIES[Math.floor(Math.random() * BOT_PRIMARIES.length)]; // bots às vezes trocam de primária, nunca pro sabre
  e.primary = e.nextPrimary; e.secondary = e.nextSecondary ?? PISTOL; e.melee = e.nextMelee ?? KNIFE;
  e.slots = [e.primary, e.secondary, e.melee]; e.knifeMode = false; e.prevWeapon = e.primary;
  e.mag = WEAPONS.map((w) => w.mag); e.reserve = WEAPONS.map((w) => w.reserve); e.reloadEnd = 0; e.switchEnd = 0; e.actionEnd = 0; e.nades = NADE.spawnWith; e.smokeNades = 1; e.stunNades = 1; e.stunUntil = 0; e.charging = false;
  setWeapon(e, e.isPlayer && spawnHold === 'secondary' ? e.secondary : e.primary);
  e.yaw = Math.atan2(-e.pos.x, -e.pos.z) + Math.PI; e.bonk = false; // olha pro centro
  if (e.model) { e.model.group.visible = true; e.model.group.scale.set(1, 1, 1); e.target = null; e.wp = null; e.path = null; e.yaw = Math.atan2(-e.pos.x, -e.pos.z); }
  else { e.pitch = 0; $('stamp').classList.remove('show'); onPlayerRespawn(); }
  if (e.dummy) { e.invulnUntil = gameTime; e.slots = [0, PISTOL, KNIFE]; placeDummy(e); setWeapon(e, PISTOL); }
}
// Treino: posição do alvo (parado ou no trilho), sempre de frente pra linha de tiro
function placeDummy(b) {
  const d = b.dummy, x = dummyX(d, gameTime), px = b.pos.x;
  b.pos.set(x, groundAt(x, d.z, (d.y || 0) + 0.3), d.z); b.yaw = d.yaw || 0; b.onGround = true;
  b.vel.set(0, 0, 0); b.travelV = (x - px);
}

// ---------------- Pickups ----------------
// caixa de munição: enche a reserva da primária e da pistola; a bazuca é escassa (+1 foguete por caixa)
function refillAmmo(e) {
  let got = false;
  for (const i of e.slots) {
    const w = WEAPONS[i]; if (e.reserve[i] >= w.reserve) continue;
    e.reserve[i] = w.rocket ? Math.min(w.reserve, e.reserve[i] + 1) : w.reserve; got = true;
  }
  return got;
}
// Exploração: a reserva, os copos e as granadas táticas não acabam, pra dar pra testar sem caçar caixa.
// O pente continua finito: a recarga acontece do mesmo jeito.
function refillExplore(e) {
  for (const i of e.slots) {
    const w = WEAPONS[i]; if (!w || w.melee || e.reserve[i] >= w.reserve) continue;
    e.reserve[i] = w.reserve;
  }
  if (e.nades < NADE.max) e.nades = NADE.max;
  if ((e.smokeNades || 0) < 1) e.smokeNades = 1;
  if ((e.stunNades || 0) < 1) e.stunNades = 1;
}
const pickups = [];
function makePickup(type, x, z, yHint = 0) {
  const g = new THREE.Group();
  if (type === 'health') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), toon(0xff7fa0)); outline(b, 0.025); g.add(b);
    for (const [w, h] of [[0.5, 0.15], [0.15, 0.5]]) for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), basic(0xffffff)); c.position.z = s * 0.36; g.add(c); const c2 = c.clone(); c2.rotation.y = Math.PI / 2; c2.position.set(s * 0.36, 0, 0); g.add(c2); }
  } else if (type === 'grenade') {
    const cup = makeCup(2.0); cup.position.y = -0.3; cup.rotation.z = 0.25; g.add(cup);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 32), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = -0.62; g.add(glow);
  } else {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.55), toon(0x6b7a3a)); outline(b, 0.025); g.add(b);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.57), toon(0xf2c94c)); g.add(st);
  }
  const y = groundAt(x, z, yHint + 0.3); g.position.set(x, y + 0.7, z); scene.add(g);
  pickups.push({ type, mesh: g, pos: new V3(x, y, z), active: true, respawnAt: 0, baseY: y + 0.7 });
}

function updatePickups(dt) {
  for (const p of pickups) {
    if (!p.active) { if (gameTime >= p.respawnAt) { p.active = true; p.mesh.visible = true; } continue; }
    p.mesh.rotation.y += dt * 1.6; p.mesh.position.y = p.baseY + Math.sin(gameTime * 3 + p.pos.x) * 0.12;
    if (online) continue; // online: o servidor decide quem pegou
    for (const e of entities) {
      if (!e.alive) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      if (dx * dx + dz * dz > 1.5 || Math.abs(e.pos.y - p.pos.y) > 1.5) continue;
      if (p.type === 'health') { if (e.hp >= 100) continue; e.hp = Math.min(100, e.hp + 50); }
      else if (p.type === 'grenade') { if (e.nades >= NADE.max) continue; e.nades++; }
      else if (!refillAmmo(e)) continue;
      p.active = false; p.mesh.visible = false; p.respawnAt = gameTime + (p.type === 'grenade' ? NADE.pickupRespawn : 15);
      if (e.isPlayer) { sfx.pickup(); flashMsg(p.type === 'health' ? '+50 de vida' : p.type === 'grenade' ? `+1 Copo Bomba (${e.nades}/${NADE.max})` : e.primary === 3 ? `Munição! +1 foguete (${e.reserve[3]}/${WEAPONS[3].reserve})` : 'Munição cheia!'); }
      break;
    }
  }
}

// Bacon que cura (offline; online quem decide é o servidor, evento 'bc'): +10 de vida pra quem pisar, menos o próprio morto
function baconNear(e, b) { const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z; return dx * dx + dz * dz <= BACON_ITEM.radius * BACON_ITEM.radius && Math.abs(e.pos.y - b.pos.y) < BACON_ITEM.dy; }
function updateBaconPickups() {
  if (online) return;
  for (const b of edibleBacons()) for (const e of entities) {
    if (!e.alive || e === b.ent || e.hp >= 100 || !baconNear(e, b)) continue;
    e.hp = Math.min(100, e.hp + BACON_ITEM.heal); baconEaten(b, e); break;
  }
}
function baconEaten(b, e) { // efeito + som (todo mundo vê); aviso só pra quem comeu
  if (b) { sfx.chomp(e && e.isPlayer ? 1 : distVol(b.pos)); eatBacon(b); }
  if (e && e.isPlayer) flashMsg(`+${BACON_ITEM.heal} de vida (bacon!)`);
}
function nearBacon(b, maxD) { // bot com pouca vida: bacon dos outros por perto
  let best = null, bd = maxD;
  for (const x of edibleBacons()) { if (x.ent === b || Math.abs(x.pos.y - b.pos.y) >= BACON_ITEM.dy + 0.3) continue; const d = x.pos.distanceTo(b.pos); if (d < bd) { bd = d; best = x; } }
  return best;
}

// ---------------- Efeitos ----------------
const effects = [];
const FLASH = new THREE.Color(0xcc2222);
const tracerMat = new THREE.LineBasicMaterial({ color: 0xfff27a, transparent: true });
function tracer(a, b, beam = false) {
  if (beam) { // rastro grosso do sniper
    const len = a.distanceTo(b); const geo = new THREE.CylinderGeometry(0.018, 0.03, len, 6, 1, true);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, depthWrite: false }));
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
    scene.add(m); effects.push({ obj: m, t: 0, life: 0.4, kind: 'beam' }); return;
  }
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(geo, tracerMat.clone()); scene.add(l); effects.push({ obj: l, t: 0, life: 0.07, kind: 'line' });
}
const puffGeo = new THREE.SphereGeometry(0.12, 8, 6);
function puff(p, color = 0xffffff) {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true })); m.position.copy(p); scene.add(m);
  effects.push({ obj: m, t: 0, life: 0.3, kind: 'puff' });
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const f = effects[i]; f.t += dt; const k = f.t / f.life;
    f.obj.material.opacity = 1 - k; if (f.kind === 'beam') f.obj.scale.set(1 + k * 2, 1, 1 + k * 2); if (f.kind === 'puff') f.obj.scale.setScalar(1 + k * 2);
    if (k >= 1) { scene.remove(f.obj); f.obj.material.dispose(); if (f.kind === 'line' || f.kind === 'beam') f.obj.geometry.dispose(); effects.splice(i, 1); }
  }
}
// flecha e virote: o dano continua no tiro normal; isto só mostra o projétil indo até a parede
const shafts = [];
function launchShaft(from, dir, speed) {
  const d = dir.clone().normalize();
  const wh = wallDistance(from, d, 42);
  const mesh = makeFlightShaft();
  mesh.position.copy(from);
  mesh.lookAt(from.clone().add(d));
  scene.add(mesh);
  shafts.push({ mesh, pos: from.clone(), dir: d, speed, dist: 0, max: wh ? Math.max(0.4, wh.distance - 0.15) : 42 });
}
function updateShafts(dt) {
  for (let i = shafts.length - 1; i >= 0; i--) {
    const s = shafts[i];
    const step = s.speed * dt;
    s.dist += step; s.pos.addScaledVector(s.dir, step); s.mesh.position.copy(s.pos);
    if (s.dist >= s.max) { scene.remove(s.mesh); shafts.splice(i, 1); }
  }
}

// ---------------- Morte = BACON (ver bacon.js) ----------------
initBacon(scene, { groundAt, collides: (x, y, z) => collides(x, y, z), pop: (v) => sfx.pop(v), sizzle: (v, d) => sfx.sizzle(v, d) });
const DEATHCAM_HOLD = 1.1; // s de câmera em 3ª pessoa no seu bacon antes dos cartões de arma
let ghost = null; // Docão do jogador local (ele não tem modelo em 1ª pessoa) só pra animação de morte
const deathCamState = { on: false, dist: 0, target: null };
function deathFx(e) { // dispara uma vez por morte (offline: kill(); online: evento 'k' ou snapshot)
  if (e.fxDeath === e.deathAt) return; e.fxDeath = e.deathAt;
  if (gameTime - e.deathAt > 1.0) return; // morte antiga (entrou no meio): sem animação
  e.baconOk = true;
  spawnBacon(e, e.isPlayer ? 'player' : e.remote && !e.bot ? 'remote' : 'bot', e.isPlayer ? 1 : distVol(e.pos));
  if (e.isPlayer) {
    if (!ghost || ghost.skin !== e.skinId) { if (ghost) scene.remove(ghost.model.group); ghost = { skin: e.skinId, model: makeDocao(getSkin(e.skinId)) }; scene.add(ghost.model.group); }
    ghost.model.group.position.copy(e.pos); ghost.model.group.rotation.set(0, e.yaw + Math.PI, 0); ghost.model.group.scale.set(1, 1, 1); ghost.model.group.visible = true;
    deathCamState.on = true; deathCamState.dist = 0; deathCamState.ang = e.yaw;
    const atk = e.lastAttacker;
    if (atk && atk !== e) {
      const dx = atk.pos.x - e.pos.x, dz = atk.pos.z - e.pos.z;
      if (dx * dx + dz * dz > 0.04) deathCamState.ang = Math.atan2(-dx, -dz);
    }
  }
}
const camTmp = new V3(), camTgt = new V3();
function deathCam(p, dt) { // 3ª pessoa: parada, olhando para quem matou (encurta se tiver parede)
  const t = gameTime - p.deathAt;
  if (ghost && ghost.model.group.visible) popModel(ghost.model.group, t, p.yaw + Math.PI);
  const b = p.bacon && p.bacon.on ? p.bacon : null;
  camTgt.set(b ? b.pos.x : p.pos.x, (b ? b.pos.y : p.pos.y) + 0.25, b ? b.pos.z : p.pos.z);
  const a = deathCamState.ang;
  const want = Math.min(3.4, 1.2 + t * 6); let d = want;
  for (; d > 0.8; d -= 0.4) { camTmp.set(camTgt.x + Math.sin(a) * d, camTgt.y + 0.55 + d * 0.42, camTgt.z + Math.cos(a) * d); if (losClear(camTgt, camTmp)) break; }
  camTmp.set(camTgt.x + Math.sin(a) * d, camTgt.y + 0.55 + d * 0.42, camTgt.z + Math.cos(a) * d);
  if (!deathCamState.dist) camera.position.copy(camTmp); else camera.position.lerp(camTmp, Math.min(1, dt * 6));
  deathCamState.dist = d; deathCamState.target = camTgt.toArray();
  camera.lookAt(camTgt);
}

// ---------------- Copo Bomba (granada) ----------------
const grenades = [], particles = []; let shake = 0, explosions = 0, lastKnock = -99;
function nadeBlocked(x, y, z) {
  for (const sd of solidsAt(x, z)) {
    if (x > sd.min.x - NADE.r && x < sd.max.x + NADE.r && z > sd.min.z - NADE.r && z < sd.max.z + NADE.r && y > sd.min.y - NADE.r) {
      const top = topAt(sd, clamp(x, sd.min.x, sd.max.x), clamp(z, sd.min.z, sd.max.z));
      if (y < top - 0.05) return true;
    }
  }
  return false;
}
function throwGrenade(e, origin, vel) {
  if (e.nades <= 0) return null;
  e.nades--; e.lastNadeT = gameTime;
  if (online && e.isPlayer) { netEv(['n', v3a(origin), v3a(vel)]); sfx.toss(1); return null; } // o copo aparece quando o servidor confirmar
  const mesh = makeCup(1.15); scene.add(mesh);
  const gnd = { owner: e, pos: origin.clone(), vel: vel.clone(), explodeAt: gameTime + NADE.fuse, mesh, spin: new V3(rand(-8, 8), rand(-4, 4), rand(-8, 8)), lastBounce: 0 };
  grenades.push(gnd); sfx.toss(e.isPlayer ? 1 : distVol(e.pos)); return gnd;
}
function stepNade(pos, vel, dt, onBounce) {
  vel.y += NADE.grav * dt;
  const nx = pos.x + vel.x * dt; if (nadeBlocked(nx, pos.y, pos.z)) { vel.x *= -0.45; if (onBounce) onBounce(); } else pos.x = nx;
  const nz = pos.z + vel.z * dt; if (nadeBlocked(pos.x, pos.y, nz)) { vel.z *= -0.45; if (onBounce) onBounce(); } else pos.z = nz;
  if (vel.y > 0 && nadeBlocked(pos.x, pos.y + vel.y * dt + NADE.r, pos.z)) { vel.y = -vel.y * 0.35; if (onBounce) onBounce(); } // quica no teto
  const ny = pos.y + vel.y * dt; const g = groundAt(pos.x, pos.z, pos.y - NADE.r + 0.3) + NADE.r;
  if (ny <= g) { pos.y = g; if (Math.abs(vel.y) > 1.5 && onBounce) onBounce(); vel.y = Math.abs(vel.y) > 1.2 ? -vel.y * 0.42 : 0; vel.x *= 0.72; vel.z *= 0.72; return true; }
  pos.y = ny; return false;
}
function throwVelocity(power) { // direção da câmera + leve arco pra cima
  const dir = new V3(0, 0, -1).applyQuaternion(camera.quaternion); dir.y += 0.28; dir.normalize();
  return dir.multiplyScalar(7 + 15 * power).add(new V3(player.vel.x * 0.5, 0, player.vel.z * 0.5));
}
const throwOrigin = () => camera.localToWorld(new V3(-0.25, -0.15, -0.5));
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const n = grenades[i];
    stepNade(n.pos, n.vel, dt, () => { if (gameTime - n.lastBounce > 0.12) { sfx.bounce(distVol(n.pos)); n.lastBounce = gameTime; } n.spin.multiplyScalar(0.6); });
    n.mesh.position.copy(n.pos).y -= 0.1; n.mesh.rotation.x += n.spin.x * dt; n.mesh.rotation.y += n.spin.y * dt; n.mesh.rotation.z += n.spin.z * dt;
    const left = n.explodeAt - gameTime; n.mesh.scale.setScalar(1.15 * (left < 0.6 ? 1 + Math.sin(gameTime * 40) * 0.08 : 1));
    if (n.net) { if (left < -1.5) { scene.remove(n.mesh); grenades.splice(i, 1); } continue; } // online: explode quando o servidor mandar
    if (left <= 0) { explode(n); scene.remove(n.mesh); grenades.splice(i, 1); }
  }
}
function explode(n) { blast(n.pos.clone(), n.owner, { radius: NADE.radius, maxDmg: NADE.maxDmg, selfMul: NADE.selfMul, knock: NADE.knock, lift: NADE.lift, wIdx: W_NADE }); }

const tacticals = [], smokes = [];
function smoked(a, b) { for (const s of smokes) if (s.blocks(a, b)) return true; return false; }
function throwTactical(kind) {
  if (!player || !player.alive) return;
  if (online) { flashMsg('Fumaça e atordoamento só na partida com bots'); return; }
  const stun = kind === 'stun';
  const spec = stun ? STUN : SMOKE;
  const bag = stun ? 'stunNades' : 'smokeNades';
  if (player[bag] <= 0) { flashMsg(stun ? 'Sem atordoamento' : 'Sem fumaça'); return; }
  player[bag]--;
  const origin = throwOrigin();
  const dir = new V3(0, 0, -1).applyQuaternion(camera.quaternion);
  dir.y += 0.22; dir.normalize();
  const vel = dir.multiplyScalar(spec.speed).add(new V3(player.vel.x * 0.4, 0, player.vel.z * 0.4));
  const mesh = makeTacticalMesh(kind);
  scene.add(mesh);
  tacticals.push({ kind, pos: origin.clone(), vel, mesh, explodeAt: gameTime + spec.fuse, spin: new V3(rand(-6, 6), rand(-3, 3), rand(-6, 6)), lastBounce: 0 });
  sfx.toss(1);
}
function popTactical(n) {
  scene.remove(n.mesh);
  if (n.kind === 'smoke') {
    const cloud = makeSmokeCloud(n.pos);
    scene.add(cloud.group); smokes.push(cloud); sfx.pop(distVol(n.pos));
    return;
  }
  sfx.boom(player ? clamp(1 - n.pos.distanceTo(player.pos) / 40, 0.25, 0.7) : 0.5);
  for (const e of entities) {
    if (!e.alive || !inRadius(n.pos, e.pos, STUN.radius)) continue;
    e.stunUntil = gameTime + STUN.life;
    if (!e.isPlayer) { e.target = null; e.aim = 0; }
  }
}
function updateSmokeSight() {
  const veil = $('smokeVeil'), flash = $('stunFlash');
  const eye = player ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null;
  let thick = false;
  if (eye) for (const s of smokes) if (inRadius(s.pos, eye, s.radius * 0.7)) thick = true;
  if (veil) veil.style.opacity = thick ? '0.8' : '0';
  if (flash && player) flash.style.opacity = player.alive && player.stunUntil > gameTime ? '0.75' : '0';
  if (!eye) return;
  for (const e of entities) {
    if (!e.model || e.isPlayer || !e.alive) continue;
    e.model.group.visible = !smoked(eye, { x: e.pos.x, y: e.pos.y + 1.1, z: e.pos.z });
  }
}
function updateTacticals(dt) {
  for (let i = tacticals.length - 1; i >= 0; i--) {
    const n = tacticals[i];
    stepNade(n.pos, n.vel, dt, () => { if (gameTime - n.lastBounce > 0.12) { sfx.bounce(distVol(n.pos)); n.lastBounce = gameTime; } });
    n.mesh.position.copy(n.pos); n.mesh.rotation.x += n.spin.x * dt; n.mesh.rotation.z += n.spin.z * dt;
    if (gameTime >= n.explodeAt) { popTactical(n); tacticals.splice(i, 1); }
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    if (!smokes[i].update(dt)) { scene.remove(smokes[i].group); smokes.splice(i, 1); }
  }
  updateSmokeSight();
}
function clearTacticals() {
  for (const n of tacticals) scene.remove(n.mesh); tacticals.length = 0;
  for (const s of smokes) scene.remove(s.group); smokes.length = 0;
  updateSmokeSight();
}
// explosão genérica (Copo Bomba e foguete da bazuca)
function blastFx(c, radius) {
  explosions++;
  sfx.boom(player ? clamp(1 - c.distanceTo(player.pos) / 70, 0.15, 1) : 1);
  if (player) shake = Math.max(shake, clamp(1 - c.distanceTo(player.pos) / 16, 0, 1) * 0.6);
  burst(c, radius);
}
function blast(c, owner, o, direct = null) {
  blastFx(c, o.radius); // som, tremida, confete (conta a explosão)
  if (heli && heli.alive) {
    const d = c.distanceTo(heli.pos);
    const reach = o.radius + HELI.hit * 0.4;
    if (d < reach) hurtHeli(o.maxDmg * (0.35 + 0.65 * (1 - d / reach)));
  }
  const los = (a, b) => losClear(new V3(a.x, a.y, a.z), new V3(b.x, b.y, b.z));
  for (const h of explosionHits(c, o, entities, los, owner, teamMode(), direct)) { // mesma regra do servidor (shared/combat.js)
    const e = h.e; e.vel.x += h.knock.x; e.vel.z += h.knock.z; e.vel.y = Math.max(e.vel.y, h.knock.y); e.onGround = false; // empurrão (rocket jump)
    if (e.isPlayer) lastKnock = gameTime;
    damage(e, h.dmg, owner, o.wIdx, false);
  }
}
// partículas: confete vermelho/ciano + espuma + gotas âmbar + clarão + onda
const confGeo = new THREE.PlaneGeometry(0.12, 0.07), foamGeo = new THREE.SphereGeometry(0.16, 8, 6), dropGeo = new THREE.SphereGeometry(0.05, 6, 5);
function burst(c, radius = NADE.radius) {
  const add = (mesh, vel, life, kind, extra = {}) => { mesh.position.copy(c); scene.add(mesh); particles.push({ mesh, vel, life, t: 0, kind, radius, ...extra }); };
  const confCols = [0xe63946, COLORS.cyan, 0xffffff, 0xffd27a, 0xe63946, COLORS.cyan];
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(confGeo, new THREE.MeshBasicMaterial({ color: confCols[i % confCols.length], side: THREE.DoubleSide, transparent: true }));
    const v = new V3(rand(-1, 1), rand(0.3, 1.6), rand(-1, 1)).normalize().multiplyScalar(rand(4, 13));
    add(m, v, rand(1.4, 2.4), 'conf', { spin: new V3(rand(-12, 12), rand(-12, 12), rand(-12, 12)) });
  }
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(foamGeo, new THREE.MeshBasicMaterial({ color: i % 3 ? 0xfff8e8 : 0xffe9b0, transparent: true }));
    add(m, new V3(rand(-1, 1), rand(0.6, 2.2), rand(-1, 1)).multiplyScalar(rand(1.5, 4.5)), rand(0.7, 1.2), 'foam', { s0: rand(0.8, 1.6) });
  }
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(dropGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf2b233 : 0xffcf5a, transparent: true }));
    add(m, new V3(rand(-1, 1), rand(0.5, 1.8), rand(-1, 1)).normalize().multiplyScalar(rand(5, 11)), rand(0.6, 1.1), 'drop');
  }
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.9 }));
  add(flash, new V3(), 0.22, 'flash');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 40), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true }));
  ring.rotation.x = Math.PI / 2; add(ring, new V3(), 0.45, 'ring');
  const light = new THREE.PointLight(0xffd27a, 30, 14); light.position.copy(c).y += 0.6; scene.add(light); particles.push({ mesh: light, vel: new V3(), life: 0.25, t: 0, kind: 'light' });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.t += dt; const k = p.t / p.life; const m = p.mesh;
    if (p.kind === 'conf') { p.vel.y -= 9 * dt; p.vel.multiplyScalar(1 - 1.6 * dt); m.position.addScaledVector(p.vel, dt); if (m.position.y < 0.03) { m.position.y = 0.03; p.vel.set(0, 0, 0); } m.rotation.x += p.spin.x * dt; m.rotation.y += p.spin.y * dt; m.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1; }
    else if (p.kind === 'foam') { p.vel.multiplyScalar(1 - 2.5 * dt); p.vel.y -= 1.5 * dt; m.position.addScaledVector(p.vel, dt); m.scale.setScalar(p.s0 * (0.6 + k * 1.4)); m.material.opacity = 1 - k; }
    else if (p.kind === 'drop') { p.vel.y -= 18 * dt; m.position.addScaledVector(p.vel, dt); m.material.opacity = 1 - k; }
    else if (p.kind === 'flash') { m.scale.setScalar(0.5 + k * (p.radius * 0.8 - 0.5)); m.material.opacity = 0.9 * (1 - k); }
    else if (p.kind === 'ring') { m.scale.setScalar(0.2 + k * (p.radius - 0.2)); m.material.opacity = 1 - k; } // anel termina exatamente no raio de dano
    else if (p.kind === 'light') { m.intensity = 30 * (1 - k); }
    else if (p.kind === 'mag') { const g = groundAt(m.position.x, m.position.z, m.position.y) + 0.06; p.vel.y -= 14 * dt; m.position.addScaledVector(p.vel, dt); if (m.position.y <= g) { m.position.y = g; p.vel.set(0, 0, 0); p.spin.set(0, 0, 0); } m.rotation.x += p.spin.x * dt; m.rotation.z += p.spin.z * dt; m.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1; }
    else if (p.kind === 'wisp') { m.position.addScaledVector(p.vel, dt); m.scale.setScalar(p.s0 * (1 + k)); m.material.opacity = 0.3 * (1 - k); }
    else if (p.kind === 'smoke') { p.vel.multiplyScalar(1 - 1.5 * dt); p.vel.y += 0.6 * dt; m.position.addScaledVector(p.vel, dt); m.scale.setScalar(p.s0 * (1 + k * 2.2)); m.material.opacity = 0.7 * (1 - k); }
    if (k >= 1) { scene.remove(m); if (m.material) m.material.dispose(); if (p.kind === 'flash' || p.kind === 'ring') m.geometry.dispose(); particles.splice(i, 1); }
  }
}
// pré-visualização da trajetória
const arcGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 60 }, () => new V3()));
const arcLine = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: COLORS.cyan, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.9, depthTest: false }));
arcLine.renderOrder = 10; arcLine.visible = false; arcLine.frustumCulled = false; scene.add(arcLine);
const arcMark = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 28), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
arcMark.rotation.x = -Math.PI / 2; arcMark.visible = false; arcMark.renderOrder = 10; scene.add(arcMark);
function updateArc(power) {
  const pos = throwOrigin(), vel = throwVelocity(power); const pts = arcGeo.attributes.position; let landed = -1;
  for (let i = 0; i < 60; i++) {
    pts.setXYZ(i, pos.x, pos.y, pos.z);
    if (landed < 0) { for (let s = 0; s < 3; s++) if (stepNade(pos, vel, 1 / 60) && landed < 0) landed = i; }
  }
  if (landed >= 0) for (let i = landed; i < 60; i++) pts.setXYZ(i, pos.x, pos.y, pos.z);
  pts.needsUpdate = true; arcLine.computeLineDistances(); arcGeo.computeBoundingSphere();
  arcMark.position.set(pos.x, pos.y - NADE.r + 0.04, pos.z); arcMark.visible = true; arcLine.visible = true;
}
function startCharge() { const p = player; if (!p || !p.alive || p.nades <= 0 || p.charging) { if (p && p.alive && p.nades <= 0 && !p.charging) flashMsg('Sem Copo Bomba! Pegue um copo vermelho'); return; } p.charging = true; p.chargeStart = gameTime; }
function chargePower() { return clamp((gameTime - player.chargeStart) / NADE.charge, 0, 1); }
function releaseCharge() {
  const p = player; if (!p || !p.charging) return; p.charging = false; arcLine.visible = arcMark.visible = false;
  if (!p.alive) return;
  const power = 0.15 + 0.85 * chargePower(); throwGrenade(p, throwOrigin(), throwVelocity(power)); fp.cupThrowT = 0.25;
}
function botThrow(b, t) {
  const from = center(b, 1.6); const to = t.pos.clone().add(new V3(t.vel.x * 0.6 + rand(-1.2, 1.2), 0.2, t.vel.z * 0.6 + rand(-1.2, 1.2)));
  const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz); const T = 0.55 + dist / 16; const g = -NADE.grav;
  const vel = new V3(dx / T, (to.y - from.y + 0.5 * g * T * T) / T, dz / T);
  throwGrenade(b, from, vel); b.nextNade = gameTime + rand(7, 13);
}

function wisp(p) { // rastro do fantasminha
  const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: 0xcffbff, transparent: true, opacity: 0.3, depthWrite: false }));
  m.position.set(p.x + rand(-0.25, 0.25), p.y + rand(0.2, 0.5), p.z + rand(-0.25, 0.25)); scene.add(m);
  particles.push({ mesh: m, vel: new V3(0, 0.25, 0), life: 0.9, t: 0, kind: 'wisp', s0: rand(1.2, 1.8) });
}
// ---------------- Bazuca do Chiqueiro (foguetes) ----------------
const rockets = []; const smokeGeo = new THREE.SphereGeometry(0.14, 8, 6);
function launchRocket(e, origin, dir) {
  const R = WEAPONS[3].rocket;
  if (online && e.isPlayer) { netEv(['r', v3a(origin), v3a(dir), +(performance.now() / 1000).toFixed(3)]); return null; } // o servidor cria o foguete
  const near = wallDistance(origin, dir, 0.7); // colado na parede/chão: explode na hora
  if (near) { blast(near.point.clone().addScaledVector(dir, -0.12), e, { ...R, wIdx: 3 }); return null; }
  const start = origin.clone().addScaledVector(dir, 0.6);
  const mesh = makeRocket(1.5); scene.add(mesh); mesh.position.copy(start); mesh.lookAt(start.clone().add(dir));
  const r = { owner: e, pos: start, dir: dir.clone(), mesh, born: gameTime, nextSmoke: 0 };
  rockets.push(r); return r;
}
function updateRockets(dt) {
  const R = WEAPONS[3].rocket;
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]; const step = R.speed * dt; let hitT = null, hitE = null;
    if (r.net) { // online: só visual, quem explode é o servidor
      if (gameTime - r.born > 6.5) { scene.remove(r.mesh); rockets.splice(i, 1); continue; }
      r.pos.addScaledVector(r.dir, step); r.mesh.position.copy(r.pos); r.mesh.children[0].rotation.z += dt * 10; rocketSmoke(r, R); continue;
    }
    const wh = wallDistance(r.pos, r.dir, step + 0.1); if (wh) hitT = wh.distance;
    for (const e of entities) {
      if (!e.alive || (e === r.owner && gameTime - r.born < 0.3)) continue;
      if (friends(e, r.owner)) continue;
      const t = rayCapsule(r.pos, r.dir, step + 0.1, e.pos, ROCKET_PAD, e.crouch); if (t !== null && (hitT === null || t < hitT)) { hitT = t; hitE = e; } // casco do Docão
    }
    if (wh && hitE && wh.distance < hitT) hitE = null;
    if (hitT !== null || gameTime - r.born > 6) {
      window.__lastBlast = { c: r.pos.clone().addScaledVector(r.dir, Math.max(0, (hitT ?? 0) - 0.05)).toArray(), hit: hitE ? hitE.name : null };
      blast(r.pos.clone().addScaledVector(r.dir, Math.max(0, (hitT ?? 0) - 0.05)), r.owner, { ...R, wIdx: 3 }, hitE);
      scene.remove(r.mesh); rockets.splice(i, 1); continue;
    }
    r.pos.addScaledVector(r.dir, step); r.mesh.position.copy(r.pos); r.mesh.children[0].rotation.z += dt * 10;
    rocketSmoke(r, R);
  }
}
function rocketSmoke(r, R) {
  {
    if (gameTime - r.born < 0.06) r.nextSmoke = gameTime; // sem fumaça colada na cara de quem atirou
    if (gameTime - r.nextSmoke > 0.5) r.nextSmoke = gameTime; // relógio sincronizado com o servidor pode pular
    while (r.nextSmoke <= gameTime) { // rastro de fumaça
      const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xf2efe8 : 0xd9d4cc, transparent: true, depthWrite: false }));
      m.position.copy(r.pos).addScaledVector(r.dir, -0.35 - (gameTime - r.nextSmoke) * R.speed); scene.add(m); // espalha ao longo do caminho
      particles.push({ mesh: m, vel: new V3(rand(-0.4, 0.4), rand(0, 0.5), rand(-0.4, 0.4)), life: rand(0.7, 1.1), t: 0, kind: 'smoke', s0: rand(0.4, 0.7) });
      r.nextSmoke = (r.nextSmoke || gameTime) + 0.02;
    }
  }
}

// ---------------- Combate ----------------
function fire(shooter, origin, dir, wIdx, spread, muzzle, mul = 1) {
  const w = WEAPONS[wIdx]; const res = { hit: false, kill: false };
  const scale = wIdx === BOW ? clamp(Number(mul) || 1, 0.35, 1.3) : 1;
  const hitsBy = new Map(), dirs = [];
  let heliDmg = 0;
  for (let p = 0; p < w.pellets; p++) {
    const d = dir.clone(); d.x += (Math.random() - 0.5) * 2 * spread; d.y += (Math.random() - 0.5) * 2 * spread; d.z += (Math.random() - 0.5) * 2 * spread; d.normalize(); dirs.push(d);
    const wh = wallDistance(origin, d, w.range); const wallD = wh ? wh.distance : w.range;
    let heliT = -1;
    if (heli && heli.alive) {
      const ht = raySphere(origin, d, heli.pos, HELI.hit);
      if (ht > 0.15 && ht < wallD) heliT = ht;
    }
    let best = null;
    for (const e of entities) {
      if (e === shooter || !e.alive || friends(e, shooter)) continue; // time: bala atravessa o companheiro
      const hit = rayHitboxes(origin, d, e.pos, e.crouch);
      if (hit && hit.t < wallD && (heliT < 0 || hit.t < heliT) && (!best || hit.t < best.t)) best = { e, ...hit };
    }
    const end = origin.clone().addScaledVector(d, best ? best.t : heliT > 0 ? heliT : wallD);
    if (p < 4 || shooter.isPlayer) tracer(muzzle, end, !!w.beam);
    if (best) {
      const h = hitsBy.get(best.e) || { dmg: 0, head: false };
      let fo = 1; if (w.falloff) { const [n0, n1, mn] = w.falloff; fo = clamp(1 - (best.t - n0) / (n1 - n0) * (1 - mn), mn, 1); } // queda de dano com a distância
      h.dmg += w.dmg * scale * (best.head ? w.headMul : 1) * fo; h.head = h.head || best.head; hitsBy.set(best.e, h);
      puff(end, 0xff9fb0);
    } else if (heliT > 0) {
      let fo = 1; if (w.falloff) { const [n0, n1, mn] = w.falloff; fo = clamp(1 - (heliT - n0) / (n1 - n0) * (1 - mn), mn, 1); }
      heliDmg += w.dmg * scale * fo; puff(end, 0xffe08a);
    } else if (wh) puff(end);
  }
  if (heliDmg > 0) { hurtHeli(heliDmg); res.hit = true; if (shooter && shooter.isPlayer) sfx.hit(); }
  if (online && shooter.isPlayer) { const ev = ['f', v3a(origin), dirs.map(v3a), wIdx, +(performance.now() / 1000).toFixed(3), +renderServerT().toFixed(3)]; if (wIdx === BOW) ev.push(+scale.toFixed(3)); netEv(ev); return res; } // dano: servidor. O arco manda a força da puxada.
  for (const [e, h] of hitsBy) { res.hit = true; if (damage(e, h.dmg, shooter, wIdx, h.head)) res.kill = true; }
  return res;
}

function damage(t, amount, attacker, wIdx, head, back = false) {
  if (!t.alive || gameTime < t.invulnUntil || friends(t, attacker)) return false; // sem fogo amigo
  t.hp -= amount; t.lastAttacker = attacker; t.flashUntil = gameTime + 0.12; noteHurt(t, attacker, gameTime); // regen só com dano de outro
  if (t.isPlayer) { hurtFlash(); sfx.oink(0.8, 1.15); }
  else { if (attacker && attacker !== t && !t.target) { t.target = attacker; t.aim = t.reaction * 0.5; } if (Math.random() < 0.3) sfx.oink(distVol(t.pos) * 0.6, 1.3); }
  if (attacker && attacker.isPlayer && attacker !== t) { if (t.hp > 0) feedbackHit({ head }); sfx.hit(); if (training()) dmgPopup(t, amount, head); }
  if (t.hp <= 0) { kill(t, attacker, wIdx, head, back); return true; }
  return false;
}

function kill(t, a, wIdx, head, back = false, noReward = false) {
  t.alive = false; t.hp = 0; t.deaths++; t.deathAt = gameTime; t.respawnAt = gameTime + (t.dummy ? TRAIN.respawn : exploreMode() && t.isPlayer ? 1 : RESPAWN_TIME); t.killW = wIdx; t.killBack = !!back;
  if (a && a !== t) a.kills++;
  addKillFeed(a, t, wIdx, head, back);
  sfx.die(t.isPlayer ? 1 : distVol(t.pos));
  if (a && a.isPlayer && a !== t) { sfx.kill(); if (!noReward) { notePlayerKill(t, head); noteWeaponKill(a, wIdx); } }
  if (t.isPlayer) { if (a && a !== t) revengeName = a.name; showStamp(wIdx); onPlayerDeath(); }
  if (a && a.kills >= KILL_LIMIT && mode === 'dm') endGame();
}

function startReload(e) {
  const w = WEAPONS[e.weapon];
  if (e.reloadEnd > gameTime || e.mag[e.weapon] >= w.mag || e.reserve[e.weapon] <= 0) return;
  e.reloadStartT = gameTime;
  if (online && e.isPlayer) netEv(['rl', e.weapon]);
  if (w.shellReload) e.reloadEnd = gameTime + w.reloadStart + w.reload; // Calibre 12: cartucho por cartucho
  else { e.reloadEnd = gameTime + w.reload; reloadSfx(w, e.isPlayer ? 1 : distVol(e.pos) * 0.5); }
}
function finishReload(e) {
  if (!e.reloadEnd || gameTime < e.reloadEnd) return;
  const w = WEAPONS[e.weapon];
  if (w.shellReload) {
    if (e.reserve[e.weapon] > 0 && e.mag[e.weapon] < w.mag) { e.mag[e.weapon]++; e.reserve[e.weapon]--; if (e.isPlayer) { sfx.shell(); fp.shellT = 0.18; } }
    if (e.mag[e.weapon] < w.mag && e.reserve[e.weapon] > 0) e.reloadEnd += w.reload;
    else { e.reloadEnd = 0; if (e.isPlayer) { sfx.pump(0.8); fp.actionT = 0.45; fp.actionLen = 0.45; } }
    return;
  }
  const need = w.mag - e.mag[e.weapon]; const take = Math.min(need, e.reserve[e.weapon]);
  e.mag[e.weapon] += take; e.reserve[e.weapon] -= take; e.reloadEnd = 0;
}
function setWeapon(e, idx) { e.weapon = idx; if (e.model) e.model.guns.forEach((g, i) => (g.visible = i === idx)); }
function switchWeapon(e, idx) {
  if (idx === e.weapon || !e.alive) return;
  if (e.weapon !== KNIFE && e.weapon !== SABER) e.prevWeapon = e.weapon;
  const side = idx === PISTOL || idx === NAIL || idx === CROSS || idx === BOW;
  setWeapon(e, idx); e.reloadEnd = 0; e.switchEnd = gameTime + (idx === KNIFE ? MELEE.draw : idx === SABER ? 0.22 : side ? 0.28 : 0.4);
  if (e.isPlayer) { fp.actionT = 0; fp.stringT = 0; e.bowDraw = 0; if (idx === KNIFE) { fp.knifeDrawT = MELEE.draw + 0.1; sfx.knifeDraw(0.8); rightStale = rightDown; } } // mirando (botão direito segurado) e trocou pra faca: só estoca num clique novo
}
// troca rápida (V): corpo a corpo (faca ou sabre) ↔ última arma
function quickKnife(e) {
  const mel = e.slots[2] ?? KNIFE;
  switchWeapon(e, e.weapon === mel ? (e.slots.includes(e.prevWeapon) && e.prevWeapon !== mel && e.prevWeapon !== SABER ? e.prevWeapon : e.slots[0]) : mel);
}
// ---------------- Faca de churrasqueiro (corpo a corpo) — regra em shared/melee.js (igual no servidor) ----------------
const modelYaw = (e) => (e.isPlayer ? e.yaw + Math.PI : e.yaw); // frente do boneco = (sin, cos)
function meleeTargets(attacker) {
  return entities.filter((t) => t !== attacker && t.alive && !friends(t, attacker)).map((t) => ({ e: t, p: t.pos, yaw: modelYaw(t) }));
}
const losPlain = (a, b) => losClear(new V3(a.x, a.y, a.z), new V3(b.x, b.y, b.z));
function knifeAttack(e, kind, eye, dir) { // offline (jogador e bots); online o jogador só manda o evento
  const K = MELEE[kind]; e.nextFire = gameTime + K.rate; e.invulnUntil = Math.min(e.invulnUntil, gameTime);
  const st = (window.__knifeStats ||= { player: 0, bot: 0, hits: 0 }); st[e.isPlayer ? 'player' : 'bot']++;
  sfx.knife(e.isPlayer ? 1 : distVol(e.pos) * 0.8, kind);
  if (e.model) { e.swingT = 0; e.swingKind = kind; }
  if (online && e.isPlayer) { netEv(['m', MELEE_KINDS.indexOf(kind), v3a(eye), v3a(dir), +(performance.now() / 1000).toFixed(3), +renderServerT().toFixed(3)]); window.__lastMelee = { kind, net: true }; return null; }
  const h = meleeHit(eye, dir, kind, meleeTargets(e), losPlain);
  window.__lastMelee = e.isPlayer ? { kind, hit: h ? h.e.name : null, back: !!(h && h.back), dmg: h ? h.dmg : 0, dist: h ? +h.dist.toFixed(2) : null } : window.__lastMelee;
  if (h) { st.hits++; puff(new V3(h.point.x, h.point.y, h.point.z), 0xff9fb0); sfx.knifeHit(e.isPlayer || h.e.isPlayer ? 1 : distVol(e.pos) * 0.7); damage(h.e, h.dmg, e, KNIFE, false, h.back); }
  return h;
}

// ---------------- HUD ----------------
let hurtLevel = 0, msgTimer = 0;
function notePlayerKill(victim, head) {
  if (!player || !victim || victim === player) return;
  const dist = player.pos.distanceTo(victim.pos);
  const revenge = !!(revengeName && victim.name === revengeName);
  if (revenge) revengeName = null;
  const streak = feedbackKill({ head: !!head, dist, revenge });
  if (streak >= 2) sfx.streak(streak);
  onRewardKill();
}
function hurtFlash() { hurtLevel = 1; }
function flashMsg(t) { $('centermsg').textContent = t; msgTimer = 1.5; }

// Abates sem morrer. O ciclo mostra 3, 5 e 7 e volta depois do 10. O 10 é o nuke secreto, fora da barra.
const STREAK_LAP = 10;
const streakCycle = (kills) => (kills <= 0 ? 0 : ((kills - 1) % STREAK_LAP) + 1);
let rewardKills = 0, nukeAt = 0, uavLive = false, pickingStrike = false, nukeReady = false;
let streakReady = [];
let tabletWant = 0, radioWant = 0, laptopWant = 0, tabletK = 0, radioK = 0, laptopK = 0;
let heli = null;
const HELI = { hp: 280, life: 30, height: 17, hit: 3.1, dmg: 16, rate: 0.22, points: 25 }; // mesmos números de shared/killstreaks.js (servidor)
function syncRewardHud() {
  setStreakCount(rewardKills);
  setStreakCycle(streakCycle(rewardKills));
}
function resetRewards(keepBoom = false) {
  const pending = keepBoom && nukeAt > gameTime ? nukeAt : 0;
  rewardKills = 0; uavLive = false; nukeReady = false; streakReady = [];
  tabletWant = 0; laptopWant = 0;
  clearPredator();
  if (!pending) { nukeAt = 0; radioWant = 0; hideNuke(); }
  hideUav(); hideNukeReady(); syncRewardHud();
  if (pickingStrike) { pickingStrike = false; closeStrikeMap(); }
}
function grantUav() {
  if (!currentMap) return;
  showUav({ size: currentMap.size, boxes: currentMap.boxes, seconds: 10 });
  uavLive = true; flashMsg('Olho da granja');
}
// Chuva de torresmo: 3 foguetes descem do céu. O anel no chão é a área do estrago.
const STRIKE = { radius: 9, maxDmg: 320, selfMul: 0.22, knock: 18, lift: 12, speed: 42 };
const strikes = [];
function clearStrikes() {
  for (const s of strikes) { scene.remove(s.mesh); scene.remove(s.ring); }
  strikes.length = 0;
}
function spawnSkyMissile(spot, owner) {
  const y = groundAt(spot.x, spot.z, 8);
  const target = new V3(spot.x, y + 0.25, spot.z);
  const start = target.clone().add(new V3(14 + rand(-1.5, 1.5), 48, 5 + rand(-1.5, 1.5)));
  const dir = target.clone().sub(start).normalize();
  const mesh = makeRocket(3.6);
  mesh.children[0].rotation.y = Math.PI; // focinho no -Z, que é a direção do lookAt
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
  flame.position.z = 0.46; // rastro de fogo na cauda
  mesh.add(flame);
  const glow = new THREE.PointLight(0xffb15a, 14, 26);
  glow.position.z = 0.4;
  mesh.add(glow);
  scene.add(mesh);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff4d3a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.RingGeometry(STRIKE.radius * 0.88, STRIKE.radius, 64), ringMat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(STRIKE.radius * 0.88, 48), new THREE.MeshBasicMaterial({ color: 0xff4d3a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  rim.rotation.x = -Math.PI / 2; fill.rotation.x = -Math.PI / 2;
  ring.add(rim); ring.add(fill);
  ring.position.set(target.x, y + 0.08, target.z);
  scene.add(ring);
  const s = { owner, pos: start, dir, target, mesh, ring, flame, born: gameTime, nextSmoke: gameTime, speed: STRIKE.speed };
  aimStrike(s);
  if (player) sfx.incoming(clamp(1 - target.distanceTo(player.pos) / 70, 0.25, 1));
  strikes.push(s);
  return s;
}
function aimStrike(s) {
  s.mesh.position.copy(s.pos);
  s.mesh.lookAt(s.pos.clone().add(s.dir));
}
function strikeSmoke(s) {
  if (gameTime < s.nextSmoke) return;
  s.nextSmoke = gameTime + 0.018;
  const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: Math.random() < 0.35 ? 0x6a727a : 0xe7e2da, transparent: true, depthWrite: false }));
  m.position.copy(s.pos);
  scene.add(m);
  particles.push({ mesh: m, vel: new V3(rand(-0.6, 0.6), rand(0.6, 1.6), rand(-0.6, 0.6)), life: rand(1.1, 1.7), t: 0, kind: 'smoke', s0: rand(7, 11) });
}
function updateStrikes(dt) {
  for (let i = strikes.length - 1; i >= 0; i--) {
    const s = strikes[i];
    const step = s.speed * dt;
    const left = s.target.distanceTo(s.pos);
    const pulse = 0.97 + Math.sin(gameTime * 10) * 0.03;
    s.ring.scale.set(pulse, pulse, pulse);
    s.flame.scale.setScalar(0.8 + Math.random() * 0.5);
    if (left <= step + 0.4 || gameTime - s.born > 3.5) {
      blast(s.target.clone(), s.owner, { radius: STRIKE.radius, maxDmg: STRIKE.maxDmg, selfMul: STRIKE.selfMul, knock: STRIKE.knock, lift: STRIKE.lift, wIdx: W_NADE });
      scene.remove(s.mesh); scene.remove(s.ring);
      strikes.splice(i, 1);
      continue;
    }
    s.pos.addScaledVector(s.dir, step);
    aimStrike(s);
    if (s.mesh.children[0]) s.mesh.children[0].rotation.z += dt * 16;
    strikeSmoke(s);
  }
}
function grantMissiles() {
  if (pickingStrike || !currentMap) return;
  pickingStrike = true;
  tabletWant = 1;
  if (document.pointerLockElement) document.exitPointerLock();
  const pending = openStrikeMap({ size: currentMap.size, boxes: currentMap.boxes });
  flashMsg('Escolhe 3 lugares no tablet');
  if (!pending || !pending.then) { pickingStrike = false; tabletWant = 0; return; }
  pending.then((spots) => {
    pickingStrike = false; tabletWant = 0;
    spots.forEach((spot, i) => {
      setTimeout(() => {
        if (!player || (state !== 'playing' && state !== 'paused')) return;
        spawnSkyMissile(spot, player);
      }, 280 + i * 420);
    });
    if (state === 'playing' && player && player.alive) lockPointer();
  }).catch(() => { pickingStrike = false; tabletWant = 0; });
}
function makeHeliMesh() {
  const g = new THREE.Group();
  const add = (geo, color, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, toon(color));
    m.position.set(x, y, z);
    parent.add(m);
    outline(m, 0.015);
    return m;
  };
  add(new THREE.BoxGeometry(1.15, 0.72, 2.5), 0xe63946, 0, 0, 0);
  add(new THREE.BoxGeometry(0.72, 0.42, 0.95), 0x9ad7ef, 0, 0.18, 0.28);
  add(new THREE.BoxGeometry(0.28, 0.26, 1.9), 0xc1121f, 0, 0.16, 2.05);
  add(new THREE.BoxGeometry(0.08, 0.72, 0.38), 0xf5e6d0, 0, 0.5, 2.85);
  for (const [x, z] of [[-0.42, 0.35], [0.42, 0.35], [-0.42, -0.55], [0.42, -0.55]]) add(new THREE.BoxGeometry(0.08, 0.38, 0.08), 0x2a241c, x, -0.52, z);
  add(new THREE.BoxGeometry(1.15, 0.06, 0.08), 0x2a241c, 0, -0.7, 0.35);
  add(new THREE.BoxGeometry(1.15, 0.06, 0.08), 0x2a241c, 0, -0.7, -0.55);
  add(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 8), 0x22252c, 0, 0.5, 0);
  const rotor = new THREE.Group();
  rotor.position.y = 0.68;
  const bladeGeo = new THREE.BoxGeometry(5.2, 0.05, 0.2);
  const bladeMat = toon(0x1c1c1c);
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  b2.rotation.y = Math.PI / 2;
  rotor.add(b1, b2);
  g.add(rotor);
  const tailR = new THREE.Group();
  tailR.position.set(0.16, 0.5, 2.9);
  tailR.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.1), bladeMat));
  g.add(tailR);
  add(new THREE.BoxGeometry(0.16, 0.16, 0.7), 0x22252c, 0, -0.32, -1.25);
  g.userData.rotor = rotor;
  g.userData.tailR = tailR;
  g.scale.setScalar(1.45);
  return g;
}
function ensureHeliHud() {
  let node = document.getElementById('heliHud');
  if (!node) {
    const style = document.createElement('style');
    style.textContent = '#heliHud{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:20;display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(14,10,8,.92);border:2px solid #e63946;border-radius:8px;pointer-events:none;user-select:none}#heliHud[hidden]{display:none!important}#heliHud b{font-family:"Trebuchet MS",Arial,sans-serif;font-size:13px;color:#ffd27a}#heliHud i{display:block;width:120px;height:8px;border-radius:2px;background:#3a1818;box-shadow:inset 0 0 0 1px #000}#heliHud i span{display:block;height:100%;width:100%;background:linear-gradient(#ffd27a,#e63946)}#heliHud small{font-family:Impact,Arial,sans-serif;font-size:16px;color:#fff}';
    document.head.appendChild(style);
    node = document.createElement('div');
    node.id = 'heliHud';
    node.hidden = true;
    node.innerHTML = '<b>Gavião da granja</b><i><span></span></i><small>30s</small>';
    document.body.appendChild(node);
  }
  return node;
}
function removeHeli() {
  if (!heli) return;
  scene.remove(heli.mesh);
  heli = null;
  const hud = document.getElementById('heliHud');
  if (hud) hud.hidden = true;
}
function clearHeli() { removeHeli(); clearNetHelis(); netNukeAt = 0; }
// ---------- killstreaks online: o servidor decide (eventos 'hl'/'hh'/'hx'/'hs', 'nk'/'nb', 'bm' tipo 'p'); aqui é só o visual ----------
const netHelis = new Map(); let netNukeAt = 0;
function clearNetHelis() { for (const h of netHelis.values()) scene.remove(h.mesh); netHelis.clear(); }
function netHeliSpawn([, id, oid, ang, orbit, born, until, hp]) {
  if (netHelis.has(id)) return; const mesh = makeHeliMesh(); scene.add(mesh);
  const owner = entOf(oid), h = { id, owner, mesh, ang, orbit, born, until, hp, max: HELI.hp, alive: true, crash: false, dieT: 0, pos: new V3(), vel: new V3() };
  const p = heliPos(h, gameTime); h.pos.set(p.x, p.y, p.z); mesh.position.copy(h.pos); netHelis.set(id, h);
  if (owner === player) { ensureHeliHud().hidden = false; flashMsg('Gavião da granja'); } else if (owner) flashMsg(`${owner.name} chamou o Gavião`);
}
function netHeliDown(id, crash) {
  const h = netHelis.get(id); if (!h || !h.alive) return;
  h.alive = false; h.crash = !!crash; h.dieT = crash ? 0.9 : 1.25; if (crash) flashMsg('Derrubaram o gavião');
}
function updateNetHelis(dt) {
  for (const h of [...netHelis.values()]) {
    const ud = h.mesh.userData; if (ud.rotor) ud.rotor.rotation.y += dt * 26; if (ud.tailR) ud.tailR.rotation.x += dt * 32;
    const mine = h.owner === player, hud = mine ? ensureHeliHud() : null;
    if (!h.alive) {
      h.pos.y += dt * (h.crash ? -20 : 16); h.mesh.rotation.z += dt * (h.crash ? 2.4 : 0); h.mesh.position.copy(h.pos); h.dieT -= dt;
      if (hud) hud.hidden = true;
      if (h.dieT <= 0 || h.pos.y < 0.5) { if (h.crash) blastFx(h.pos.clone(), 5); scene.remove(h.mesh); netHelis.delete(h.id); }
      continue;
    }
    const prev = h.pos.clone(), p = heliPos(h, gameTime); h.pos.set(p.x, p.y + Math.sin(gameTime * 1.6) * 0.35, p.z);
    h.vel.copy(h.pos).sub(prev).multiplyScalar(1 / Math.max(dt, 0.001)); h.mesh.position.copy(h.pos);
    if (h.vel.lengthSq() > 0.04) h.mesh.lookAt(h.pos.clone().add(h.vel));
    if (hud) { hud.hidden = false; const bar = hud.querySelector('span'); if (bar) bar.style.width = Math.max(0, h.hp / h.max * 100) + '%'; const tm = hud.querySelector('small'); if (tm) tm.textContent = Math.max(0, Math.ceil(h.until - gameTime)) + 's'; }
  }
}
function hurtHeli(amount) {
  if (!heli || !heli.alive || !(amount > 0)) return;
  heli.hp = Math.max(0, heli.hp - amount);
  if (heli.hp <= 0) { heli.alive = false; heli.crash = true; heli.dieT = 0.9; flashMsg('Derrubaram o gavião'); }
}
function grantHeli() {
  if (!currentMap) return;
  if (heli) removeHeli();
  const mesh = makeHeliMesh();
  scene.add(mesh);
  const half = Math.min(mapBounds[0] || 24, mapBounds[1] || 24);
  heli = {
    mesh, alive: true, crash: false, dieT: 0, hp: HELI.hp, max: HELI.hp,
    until: gameTime + HELI.life, ang: Math.random() * Math.PI * 2,
    orbit: clamp(half * 0.42, 10, 18), cool: 0.4,
    pos: new V3(), vel: new V3(),
  };
  ensureHeliHud().hidden = false;
  flashMsg('Gavião da granja');
}
function heliAimBot(b, dist) {
  if (!heli || !heli.alive || (dist && dist < 12)) return null;
  const eye = center(b, 1.5);
  const hd = eye.distanceTo(heli.pos);
  if (hd > 62 || hd < 4 || !losClear(eye, heli.pos)) return null;
  return hd;
}
function heliShoot() {
  let best = null, bd = 1e9;
  for (const e of entities) {
    if (!e.alive || e.isPlayer || friends(e, player)) continue;
    const d = heli.pos.distanceTo(e.pos);
    if (d < bd && losClear(heli.pos, center(e, 1.1))) { best = e; bd = d; }
  }
  if (!best) return;
  heli.cool = HELI.rate;
  const to = center(best, 1.0);
  const from = heli.pos.clone();
  from.y -= 0.4;
  tracer(from, to, false);
  sfx.rifle(distVol(heli.pos) * 0.45);
  if (!best.alive || gameTime < best.invulnUntil) return;
  best.hp -= HELI.dmg;
  best.lastAttacker = player;
  best.flashUntil = gameTime + 0.08;
  if (best.hp <= 0) { kill(best, player, 0, false, false, true); feedbackAward(HELI.points); }
}
function updateHeli(dt) {
  if (!heli) return;
  const rotor = heli.mesh.userData.rotor;
  const tailR = heli.mesh.userData.tailR;
  if (rotor) rotor.rotation.y += dt * 26;
  if (tailR) tailR.rotation.x += dt * 32;
  if (!heli.alive) {
    heli.pos.y += dt * (heli.crash ? -20 : 16);
    heli.mesh.rotation.z += dt * (heli.crash ? 2.4 : 0);
    heli.mesh.position.copy(heli.pos);
    heli.dieT -= dt;
    const hud = document.getElementById('heliHud');
    if (hud) hud.hidden = true;
    if (heli.dieT <= 0 || heli.pos.y < 0.5) {
      if (heli.crash) blastFx(heli.pos.clone(), 5);
      removeHeli();
    }
    return;
  }
  if (gameTime >= heli.until) { heli.alive = false; heli.crash = false; heli.dieT = 1.25; return; }
  const prev = heli.pos.clone();
  heli.ang += dt * 0.42;
  heli.pos.set(Math.cos(heli.ang) * heli.orbit, HELI.height + Math.sin(gameTime * 1.6) * 0.35, Math.sin(heli.ang) * heli.orbit);
  heli.vel.copy(heli.pos).sub(prev).multiplyScalar(1 / Math.max(dt, 0.001));
  heli.mesh.position.copy(heli.pos);
  if (heli.vel.lengthSq() > 0.04) heli.mesh.lookAt(heli.pos.clone().add(heli.vel));
  heli.cool -= dt;
  if (heli.cool <= 0) heliShoot();
  const hud = ensureHeliHud();
  hud.hidden = false;
  const bar = hud.querySelector('span');
  if (bar) bar.style.width = Math.max(0, heli.hp / heli.max * 100) + '%';
  const time = hud.querySelector('small');
  if (time) time.textContent = Math.max(0, Math.ceil(heli.until - gameTime)) + 's';
}
// Míssil da granja: o de 5. Abre o laptop e você pilota um míssil que desce do céu.
const PREDATOR = { radius: 26, maxDmg: 460, selfMul: 0.4, knock: 20, lift: 14, speed: 28, life: 16, height: 98 };
const STREAK_PROMPT = { uav: 'F · Olho da granja', missile: 'F · Míssil da granja', heli: 'F · Gavião da granja', nuke: 'F · Fim da chapa' };
let predator = null;
function refreshStreakPrompt() {
  const id = streakReady[0];
  if (!id) { hideNukeReady(); return; }
  showNukeReady();
  const node = document.getElementById('nukeReady');
  if (node) node.textContent = STREAK_PROMPT[id] || 'F · killstreak';
}
function bankStreak(id) {
  streakReady.push(id);
  flashMsg(`${(STREAK_PROMPT[id] || id).replace('F · ', '')} pronto · aperte F`);
  refreshStreakPrompt();
}
function ensurePredatorHud() {
  let node = document.getElementById('predatorHud');
  if (!node) {
    node = document.createElement('div');
    node.id = 'predatorHud';
    node.hidden = true;
    node.innerHTML = '<b>MÍSSIL DA GRANJA</b><i></i><small>mexe o mouse · ele vem do céu</small>';
    document.body.appendChild(node);
    const style = document.createElement('style');
    style.textContent = '#predatorHud{position:fixed;inset:0;z-index:24;pointer-events:none;box-shadow:inset 0 0 0 34px #140e0c,inset 0 0 0 38px #3a2a22,inset 0 0 80px rgba(0,0,0,.45)}#predatorHud[hidden]{display:none!important}#predatorHud b{position:absolute;top:46px;left:50%;transform:translateX(-50%);font-family:Impact,Arial,sans-serif;letter-spacing:1px;color:#d7f3ff;text-shadow:0 2px 0 #000}#predatorHud small{position:absolute;bottom:46px;left:50%;transform:translateX(-50%);color:#ffe8c2;font-weight:bold;text-shadow:0 2px 0 #000}#predatorHud i{position:absolute;left:50%;top:50%;width:18px;height:18px;transform:translate(-50%,-50%)}#predatorHud i:before,#predatorHud i:after{content:"";position:absolute;background:#fff;box-shadow:0 0 0 1px #000}#predatorHud i:before{left:8px;top:-10px;width:2px;height:38px}#predatorHud i:after{top:8px;left:-10px;height:2px;width:38px}';
    document.head.appendChild(style);
  }
  return node;
}
function showPredatorHud(on) {
  const node = ensurePredatorHud();
  node.hidden = !on;
}
function clearPredator() {
  if (!predator) return;
  scene.remove(predator.mesh);
  predator = null;
  laptopWant = 0;
  showPredatorHud(false);
  if (camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
}
function grantPredator() {
  if (predator || !currentMap || !player) return;
  const yaw = player.yaw;
  const x = player.pos.x - Math.sin(yaw) * 8;
  const z = player.pos.z - Math.cos(yaw) * 8;
  const ground = groundAt(x, z, player.pos.y + 4);
  const mesh = makeRocket(3.2);
  mesh.children[0].rotation.y = Math.PI;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
  flame.position.z = 0.55;
  mesh.add(flame);
  const glow = new THREE.PointLight(0xffb15a, 18, 30);
  glow.position.z = 0.4;
  mesh.add(glow);
  scene.add(mesh);
  predator = {
    mesh, flame, phase: 'laptop', until: gameTime + 0.7, born: gameTime,
    pos: new V3(x, ground + PREDATOR.height, z), yaw, pitch: -1.05, nextSmoke: 0,
  };
  laptopWant = 1;
  if (online) netEv(['ks', 'p', v3a(predator.pos)]); // online: o servidor confere o míssil e aplica a explosão
  mesh.position.copy(predator.pos);
  flashMsg('Laptop aberto · segura o mouse');
  if (state === 'playing' && !document.pointerLockElement) lockPointer();
}
function predatorDir(p) {
  const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  return new V3(-Math.sin(p.yaw) * cp, sp, -Math.cos(p.yaw) * cp);
}
function predatorAim(p, dir) {
  p.mesh.position.copy(p.pos);
  p.mesh.lookAt(p.pos.clone().add(dir));
}
function predatorSmoke(p) {
  if (gameTime < p.nextSmoke) return;
  p.nextSmoke = gameTime + 0.02;
  const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: Math.random() < 0.35 ? 0x6a727a : 0xe7e2da, transparent: true, depthWrite: false }));
  m.position.copy(p.pos);
  scene.add(m);
  particles.push({ mesh: m, vel: new V3(rand(-0.4, 0.4), rand(0.2, 0.8), rand(-0.4, 0.4)), life: rand(0.8, 1.3), t: 0, kind: 'smoke', s0: rand(4, 7) });
}
function missileHit(from, to) {
  for (let i = 1; i <= 4; i++) {
    const p = from.clone().lerp(to, i / 4);
    const g = groundAt(p.x, p.z, p.y + 1.2);
    if (p.y <= g + 0.45) return new V3(p.x, g + 0.25, p.z);
    if (collides(p.x, p.y, p.z)) return p;
  }
  return null;
}
function endPredator(at) {
  const where = at.clone();
  clearPredator();
  if (online) { netEv(['ms', v3a(where)]); refreshStreakPrompt(); return; } // a explosão (e o dano) vem do servidor
  blast(where, player, { radius: PREDATOR.radius, maxDmg: PREDATOR.maxDmg, selfMul: PREDATOR.selfMul, knock: PREDATOR.knock, lift: PREDATOR.lift, wIdx: W_NADE });
  refreshStreakPrompt();
}
function posePredatorCam() {
  const dir = predatorDir(predator);
  const side = new V3(dir.z, 0, -dir.x);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  // Atrás, acima e um pouco de lado: dá pra ver o corpo do míssil e o chão pra onde ele aponta.
  camera.up.set(0, 1, 0);
  camera.position.copy(predator.pos).addScaledVector(dir, -5.2).addScaledVector(side, 1.7);
  camera.position.y += 2.2;
  camera.lookAt(predator.pos.clone().addScaledVector(dir, 16));
  if (camera.fov !== 58) { camera.fov = 58; camera.updateProjectionMatrix(); }
}
function updatePredator(dt) {
  if (!predator) return;
  const p = predator;
  if (p.phase === 'laptop') {
    predatorAim(p, predatorDir(p));
    if (gameTime >= p.until) { p.phase = 'fly'; p.born = gameTime; laptopWant = 0; showPredatorHud(true); }
    return;
  }
  const dir = predatorDir(p);
  const next = p.pos.clone().addScaledVector(dir, PREDATOR.speed * dt);
  const hit = missileHit(p.pos, next);
  if (hit || gameTime - p.born > PREDATOR.life) { endPredator(hit || next); return; }
  p.pos.copy(next);
  if (p.flame) p.flame.scale.setScalar(0.75 + Math.random() * 0.55);
  if (p.mesh.children[0]) p.mesh.children[0].rotation.z += dt * 14;
  predatorAim(p, dir);
  predatorSmoke(p);
  posePredatorCam();
}
function startNukeCountdown() {
  nukeReady = false; radioWant = 1;
  nukeAt = gameTime + 5; showNukeCount(5); flashMsg('Fim da chapa');
  if (online) netEv(['ks', 'x']);
  refreshStreakPrompt();
}
function useStreak() {
  if (!player || !player.alive || predator || nukeAt) return;
  const id = streakReady.shift();
  if (!id) return;
  refreshStreakPrompt();
  if (id === 'uav') grantUav();
  else if (id === 'missile') grantPredator();
  else if (id === 'heli') { if (online) { netEv(['ks', 'h']); flashMsg('Gavião a caminho'); } else grantHeli(); }
  else if (id === 'nuke') startNukeCountdown();
}
function grantNuke() { bankStreak('nuke'); }
function callNuke() {
  if (!player || !player.alive || nukeAt) return;
  const i = streakReady.indexOf('nuke');
  if (i < 0 && !nukeReady) return;
  if (i >= 0) streakReady.splice(i, 1);
  startNukeCountdown();
}
function onRewardKill() {
  if (!player || !player.alive) return;
  rewardKills++;
  const cycle = streakCycle(rewardKills);
  syncRewardHud();
  if (cycle === 3) bankStreak('uav');
  else if (cycle === 5) bankStreak('missile');
  else if (cycle === 7) bankStreak('heli');
  if (rewardKills % STREAK_LAP === 0) bankStreak('nuke');
}
function nukeFlash() {
  let el = document.getElementById('nukeFlash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nukeFlash';
    el.style.cssText = 'position:fixed;inset:0;z-index:55;pointer-events:none;background:#fff6d0;opacity:0';
    document.body.appendChild(el);
  }
  el.style.transition = 'none';
  el.style.opacity = '0.9';
  requestAnimationFrame(() => { el.style.transition = 'opacity .55s linear'; el.style.opacity = '0'; });
}
function updateRewards(dt) {
  if (uavLive && player) {
    const enemies = [];
    for (const e of entities) if (e.alive && e !== player && !friends(e, player)) enemies.push({ x: e.pos.x, z: e.pos.z });
    drawUav({ player: { x: player.pos.x, z: player.pos.z, yaw: player.yaw }, enemies });
    if (!tickUav(dt)) uavLive = false;
  }
  updateHeli(dt);
  if (online) {
    updateNetHelis(dt);
    if (netNukeAt && !nukeAt) { const l = Math.ceil(netNukeAt - gameTime); if (l > 0) showNukeCount(l); }
  }
  if (!nukeAt) return;
  const left = Math.ceil(nukeAt - gameTime);
  if (left > 0) showNukeCount(left);
  if (gameTime < nukeAt) return;
  if (online) { nukeAt = 0; radioWant = 0; if (!netNukeAt) hideNuke(); return; } // online: o servidor detona (evento 'nb')
  nukeAt = 0; radioWant = 0; hideNuke(); sfx.boom(1); shake = Math.max(shake, 1.2); nukeFlash();
  const victims = entities.filter((e) => e.alive && !e.isPlayer && !friends(e, player));
  for (const e of victims) kill(e, player, W_NADE, false, false, true);
}
const KILL_PHRASES = [
  (a, t) => `${a} pururucou ${t}`, (a, t) => `${a} pururucou ${t}`, (a, t) => `${a} pururucou ${t}`,
  (a, t) => `${a} fritou ${t}`, (a, t) => `${a} transformou ${t} em torresmo`, (a, t) => `${a} mandou ${t} pra chapa`,
  (a, t) => `${a} defumou ${t}`, (a, t) => `${a} fez ${t} virar bacon`, (a, t) => `${a} serviu ${t} no café da manhã`,
  (a, t) => `${a} botou ${t} no espeto`, (a, t) => `${a} temperou ${t} com chumbo`,
];
const SELF_PHRASES = [(t) => `${t} se pururucou`, (t) => `${t} virou bacon sozinho`, (t) => `${t} se jogou na frigideira`, (t) => `${t} fritou no próprio óleo`];
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
function showStamp(wIdx) { const s = $('stamp'); s.textContent = wIdx === KNIFE ? 'MOGGADO!' : 'PURURUCADO!'; s.classList.remove('show'); void s.offsetWidth; s.classList.add('show'); }
function addKillFeed(a, t, wIdx, head, back = false, label = null) {
  const div = document.createElement('div'); div.className = 'kf' + (wIdx === KNIFE ? ' knife' : '');
  const nm = (e) => `<b class="${e.isPlayer ? 'me' : ''}">${escapeHtml(e.name)}</b>`;
  const knife = wIdx === KNIFE && a && a !== t; // faca: frase fixa "moggou"
  div.innerHTML = knife ? `${nm(a)} moggou ${nm(t)} <i>[Faca${back ? ' · pelas costas!' : ''}]</i>`
    : a && a !== t ? `${pick(KILL_PHRASES)(nm(a), nm(t))} <i>[${label || WEAPON_SHORT(wIdx)}${head ? ' · direto no focinho!' : ''}]</i>` : pick(SELF_PHRASES)(nm(t));
  // log canônico p/ testes (o texto exibido varia; faca é fixo)
  { const L = (window.__feedLog ||= []); L.push(knife ? `${a.name} moggou ${t.name} [Faca${back ? ' · pelas costas!' : ''}]` : a && a !== t ? `${a.name} pururucou ${t.name} [${label || WEAPON_SHORT(wIdx)}]` : `${t.name} se pururucou`); if (L.length > 20) L.shift(); }
  const kf = $('killfeed'); kf.prepend(div); while (kf.children.length > 6) kf.lastChild.remove();
  setTimeout(() => div.remove(), 6000);
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function boardHtml() {
  const rows = [...entities].sort((a, b) => scoreOf(b) - scoreOf(a) || a.deaths - b.deaths);
  const pg = (e) => (online ? `<td>${e.bot ? 'bot' : (e.isPlayer ? online.net.ping : e.ping || 0) + ' ms'}</td>` : '');
  return `<table><tr><th>#</th><th style="text-align:left">Docão</th><th>Abates</th><th>Mortes</th><th>K/D</th>${online ? '<th>Ping</th>' : ''}</tr>${rows.map((e, i) =>
    `<tr class="${e.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td style="text-align:left"><span class="dot" style="background:${teamMode() && e.team >= 0 ? TEAM_COLORS[e.team] : e.shirt}"></span>${escapeHtml(e.name)}${teamMode() ? ` <small style="color:${TEAM_COLORS[e.team] || '#fff'}">${e.caps || 0} zona${(e.caps || 0) === 1 ? '' : 's'}</small>` : ''}</td><td>${e.kills}</td><td>${e.deaths}</td><td>${(e.kills / Math.max(1, e.deaths)).toFixed(2)}</td>${pg(e)}</tr>`).join('')}</table>`;
}
function updateHud(dt) {
  const p = player, w = WEAPONS[p.weapon];
  $('hpfill').style.width = Math.max(0, p.hp) + '%'; $('hptext').textContent = Math.max(0, Math.ceil(p.hp));
  $('hpfill').style.background = p.hp > 35 ? '' : 'linear-gradient(#ff7b7b,#e63946)';
  hpBar.classList.toggle('regen', !!(p.alive && p.regenOn)); // brilho verde + "+" pulsando enquanto regenera
  $('mag').textContent = w.melee ? '∞' : p.mag[p.weapon]; $('reserve').textContent = w.melee ? '' : ' / ' + p.reserve[p.weapon]; $('wname').textContent = weaponTitle(p);
  for (let i = 0; i < NADE.max; i++) $('nade' + i).classList.toggle('on', i < p.nades);
  const pm = $('powermeter');
  const pulling = !!(p.alive && p.weapon === BOW && p.bowDraw && !p.charging);
  pm.classList.toggle('hidden', !p.charging && !pulling);
  if (p.charging) { const k = chargePower(); $('powerfill').style.width = (k * 100).toFixed(0) + '%'; $('powertext').textContent = k >= 1 ? 'FORÇA MÁXIMA! solte Q' : 'Força do arremesso · solte Q'; }
  else if (pulling) { const k = clamp((gameTime - p.bowDraw) / (WEAPONS[BOW].draw || 0.7), 0, 1); $('powerfill').style.width = (k * 100).toFixed(0) + '%'; $('powertext').textContent = k >= 1 ? 'CORDA NO TALO! solte o clique' : 'Segura o clique · a flecha fica mais forte'; }
  $('slot1').textContent = '1 ' + WEAPONS[p.slots[0]].chip; $('slot2').textContent = '2 ' + WEAPONS[p.slots[1]].chip;
  $('slot1').classList.toggle('active', p.weapon === p.slots[0]); $('slot2').classList.toggle('active', p.weapon === p.slots[1]); $('slot3').classList.toggle('active', p.weapon === p.slots[2]);
  const smokeN = $('smokeN'), stunN = $('stunN');
  if (smokeN) smokeN.textContent = p.smokeNades || 0;
  if (stunN) stunN.textContent = p.stunNades || 0;
  { const dh = p.alive || gameTime - p.deathAt < DEATHCAM_HOLD; const wasDead = document.body.classList.contains('dead'); $('deathpick').classList.toggle('hidden', dh); document.body.classList.toggle('dead', !dh); if (wasDead === dh) placeSocialHud(); if (!p.alive) updateRespawnBtn(p); } crossEl.style.visibility = p.alive && !(predator && predator.phase === 'fly') ? '' : 'hidden';
  $('reloadmsg').textContent = w.melee ? '' : p.reloadEnd > gameTime ? (w.shellReload ? 'Recarregando... (atire para interromper)' : 'Recarregando...') : (p.mag[p.weapon] === 0 ? (p.reserve[p.weapon] ? 'Aperte R' : 'Sem munição! Pegue uma caixa') : '');
  const left = Math.max(0, matchLimit() - gameTime); $('timer').textContent = exploreMode() ? '∞' : Number.isFinite(left) ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Treino ∞';
  $('score').textContent = exploreMode() ? `Exploração · ${currentMap ? currentMap.name : ''}` : `Abates: ${p.kills} · Mortes: ${p.deaths} · K/D: ${(p.kills / Math.max(1, p.deaths)).toFixed(2)} · Pontos: ${feedbackPoints()}`;
  const lead = entities.reduce((a, b) => (b.kills > a.kills ? b : a));
  $('leader').textContent = exploreMode() ? 'Mapa vazio · , . ou [ ] trocam a primária' : training() ? 'Estande do Docão · B/N/M trocam a arma · munição infinita' : teamMode() ? `Dominação · primeiro time a ${DOM.WIN_CAPS} zonas vence` : lead.kills ? `Líder: ${lead.name} (${lead.kills}/${KILL_LIMIT})` : `Primeiro a ${KILL_LIMIT} abates vence`;
  updateLeaderboard(dt); tickFeedback(dt);
  hurtLevel = Math.max(0, hurtLevel - dt * 2.5);
  $('vignette').style.opacity = Math.max(hurtLevel, p.alive && p.hp < 35 ? 0.35 + Math.sin(gameTime * 6) * 0.1 : 0);
  const cm = $('centermsg');
  if (!p.alive) cm.textContent = `Você foi ${p.killW === KNIFE ? 'moggado' : 'pururucado'} por ${p.lastAttacker && p.lastAttacker !== p ? p.lastAttacker.name : '???'}${p.killW === KNIFE && p.killBack ? ' (pelas costas!)' : ''} · ${respawnReady(p) ? (rsSent ? 'renascendo...' : 'clique em RENASCER (ou Espaço)') : Number.isFinite(p.respawnAt) ? `renasce em ${Math.max(0, p.respawnAt - gameTime).toFixed(1)}s` : 'aguarde...'}`;
  else if (msgTimer > 0) msgTimer -= dt; // mensagem (ex.: "Mapa: …") tem prioridade
  else if (gameTime < p.invulnUntil) cm.textContent = 'PROTEGIDO';
  else cm.textContent = '';
  if (!$('tabboard').classList.contains('hidden')) $('tabboard').innerHTML = boardHtml();
}

// ---------------- Arma em 1ª pessoa (cascos segurando) ----------------
const fp = (() => {
  const root = new THREE.Group(); fpScene.add(root);
  const add = (geo, mat, x, y, z, parent, ol = 0.006) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); if (ol) outline(m, ol); return m; };
  const guns = [];
  // fuzil
  const r = new THREE.Group(); root.add(r);
  add(new THREE.BoxGeometry(0.11, 0.13, 0.62), toon(0x3b3f4a), 0, 0, -0.1, r);
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 10), toon(0x22252c), 0, 0.01, -0.56, r).rotation.x = Math.PI / 2;
  const rMag = add(new THREE.BoxGeometry(0.075, 0.22, 0.11), toon(COLORS.red), 0, -0.15, -0.12, r); rMag.rotation.x = 0.2; // pente (sai/entra na recarga)
  add(new THREE.BoxGeometry(0.1, 0.15, 0.24), toon(COLORS.red), 0, -0.03, 0.3, r);
  add(new THREE.BoxGeometry(0.04, 0.04, 0.1), toon(COLORS.cyan), 0, 0.09, -0.02, r);
  const rCh = add(new THREE.BoxGeometry(0.03, 0.025, 0.04), toon(0x22252c), 0.07, 0.035, 0.08, r, 0.004); // alavanca de manejo
  // Calibre 12 (pump): cano único + tubo de cartuchos + telha (pump) de madeira que corre
  const s = new THREE.Group(); root.add(s);
  add(new THREE.BoxGeometry(0.12, 0.13, 0.3), toon(0x4a4f5a), 0, 0, 0.02, s);
  add(new THREE.BoxGeometry(0.105, 0.15, 0.32), toon(0x8b5a2b), 0, -0.035, 0.32, s).rotation.x = -0.12;
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 14), toon(0x55555f), 0, 0.035, -0.48, s).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 12), toon(0x3f434c), 0, -0.03, -0.42, s).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.032, 0.008, 6, 16), toon(0xf5e6d0), 0, 0.035, -0.8, s, 0.003);
  add(new THREE.SphereGeometry(0.014, 8, 6), toon(COLORS.cyan), 0, 0.07, -0.8, s, 0.003);
  add(new THREE.BoxGeometry(0.125, 0.05, 0.12), toon(COLORS.red), 0, 0.02, 0.02, s, 0.004); // faixa "12"
  const pumpPart = new THREE.Group(); pumpPart.position.set(0, -0.035, -0.36); s.add(pumpPart);
  const sShell = new THREE.Group(); s.add(sShell); sShell.visible = false; // cartucho entrando pela janela de baixo
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10), toon(COLORS.red), 0, 0, 0, sShell, 0.004).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 10), toon(0xd9a441), 0, 0, 0.04, sShell, 0.003).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.1, 0.085, 0.22), toon(0x9a6532), 0, 0, 0, pumpPart);
  for (const z of [-0.07, 0, 0.07]) add(new THREE.BoxGeometry(0.104, 0.012, 0.012), toon(0x5a3a1c), 0, 0.01, z, pumpPart, 0);
  const pumpShoulder = new THREE.Vector3(-0.42, -0.5, 0.28);
  let pumpHand = makeFPForearm(getSkin()); s.add(pumpHand);
  // Três snipers: a mão do ferrolho fica dentro de cada modelo (sniper-view.js)
  const sn = makeFPSniper('torresmo'); root.add(sn);
  // bala da recarga (vai pra sniper que estiver na mão: Torresmo, Canhão ou Carabina)
  const sRound = new THREE.Group(); sn.add(sRound); sRound.visible = false;
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), toon(0xd9a441), 0, 0, 0, sRound, 0.003).rotation.x = Math.PI / 2;
  add(new THREE.ConeGeometry(0.012, 0.025, 8), toon(0xb87333), 0, 0, -0.042, sRound, 0.003).rotation.x = -Math.PI / 2;
  // Bazuca do Chiqueiro: RPG no ombro — tubo longo, boca na frente (-Z), traseira alargada, ogiva saindo da boca
  const bz = new THREE.Group(); bz.position.set(0.2, -0.16, -0.06); bz.rotation.set(0.06, 0.26, -0.07); bz.scale.setScalar(1.58); root.add(bz);
  const TY = 0.06, MZ = -1.34; // eixo do tubo e boca (z negativo = frente da câmera)
  const tube = add(new THREE.CylinderGeometry(0.09, 0.09, 1.52, 20), toon(0x6b7a3a), 0, TY, -0.54, bz); tube.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.092, 0.122, 0.08, 18), toon(0x3d4a28), 0, TY, MZ + 0.02, bz).rotation.x = Math.PI / 2; // quebra-chama, largo na frente
  add(new THREE.TorusGeometry(0.116, 0.016, 8, 22), toon(0xf5e6d0), 0, TY, MZ, bz, 0.004); // anel da boca
  for (const z of [-1.02, -0.22]) add(new THREE.CylinderGeometry(0.102, 0.102, 0.05, 18), toon(COLORS.red), 0, TY, z, bz).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.102, 0.102, 0.38, 18), toon(0x5a6834), 0, TY, -0.35, bz).rotation.x = Math.PI / 2; // capa do meio
  const rear = add(new THREE.CylinderGeometry(0.17, 0.092, 0.3, 18), toon(0x4a5528), 0, TY, 0.36, bz); rear.rotation.x = Math.PI / 2; // venturi largo para trás (+Z)
  add(new THREE.TorusGeometry(0.164, 0.014, 8, 20), toon(0x2a2d24), 0, TY, 0.5, bz, 0.003);
  add(new THREE.BoxGeometry(0.05, 0.2, 0.062), toon(0x2c3038), 0, TY - 0.15, 0.08, bz).rotation.x = -0.48; // empunhadura
  add(new THREE.BoxGeometry(0.042, 0.014, 0.11), toon(0x22252c), 0, TY - 0.055, 0.0, bz, 0.003); // guarda-mato
  add(new THREE.BoxGeometry(0.046, 0.15, 0.05), toon(0x2c3038), 0, TY - 0.13, -0.52, bz); // grip dianteiro
  add(new THREE.BoxGeometry(0.016, 0.14, 0.016), toon(0x1a1c22), 0, TY + 0.12, -1.08, bz, 0.003); // poste da alça da frente
  add(new THREE.SphereGeometry(0.018, 8, 6), toon(0x1a1c22), 0, TY + 0.19, -1.08, bz, 0.003);
  add(new THREE.BoxGeometry(0.014, 0.13, 0.014), toon(0x1a1c22), -0.03, TY + 0.1, -0.02, bz, 0.003);
  add(new THREE.BoxGeometry(0.014, 0.13, 0.014), toon(0x1a1c22), 0.03, TY + 0.1, -0.02, bz, 0.003);
  add(new THREE.BoxGeometry(0.078, 0.016, 0.016), toon(0x1a1c22), 0, TY + 0.16, -0.02, bz, 0.003); // alça de trás
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.075), new THREE.MeshBasicMaterial({ transparent: true, map: (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#f5e6d0'; x.beginPath(); x.roundRect(4, 4, 120, 88, 18); x.fill(); drawLogo(x, 64, 48, 60, '#e63946'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
  sticker.position.set(-0.108, TY + 0.01, -0.48); sticker.rotation.y = -Math.PI / 2; bz.add(sticker);
  const rocketTip = makeRocket(1.15); rocketTip.rotation.y = Math.PI; rocketTip.position.set(0, TY, -1.62); bz.add(rocketTip); // ogiva (focinho) para -Z, cauda na boca
  const loadRocket = makeRocket(1.15); loadRocket.rotation.y = Math.PI; loadRocket.visible = false; bz.add(loadRocket); // foguete novo entrando no tubo
  // Pistolinha Leitão: ferrolho rosinha, cabo escuro
  const ps = new THREE.Group(); ps.position.set(0, 0.05, -0.04); root.add(ps);
  const slide = new THREE.Group(); ps.add(slide);
  add(new THREE.BoxGeometry(0.075, 0.08, 0.3), toon(0xff9fb6), 0, 0.03, -0.1, slide);
  add(new THREE.BoxGeometry(0.03, 0.03, 0.03), toon(COLORS.cyan), 0, 0.085, -0.23, slide, 0.003);
  add(new THREE.BoxGeometry(0.05, 0.025, 0.025), toon(0x22252c), 0, 0.083, 0.03, slide, 0.003);
  add(new THREE.CircleGeometry(0.014, 10), basic(0x111111), 0, 0.03, -0.252, slide, 0).rotation.y = Math.PI;
  add(new THREE.BoxGeometry(0.07, 0.05, 0.26), toon(0x3b3f4a), 0, -0.02, -0.08, ps);
  add(new THREE.BoxGeometry(0.065, 0.17, 0.09), toon(0x3b3f4a), 0, -0.12, 0.03, ps).rotation.x = 0.22;
  const pMag = add(new THREE.BoxGeometry(0.055, 0.16, 0.075), toon(0xff9fb6), 0, -0.14, 0.035, ps, 0.004); pMag.rotation.x = 0.22; pMag.scale.set(0.9, 1, 0.9); // pente da pistola (base aparece no cabo)
  // Faca de churrasqueiro: rig próprio (faca + braço direito) que faz as animações de sacar/golpe/estocada
  const kr = new THREE.Group(); root.add(kr); const kpiv = new THREE.Group(); kpiv.position.set(0.02, -0.12, 0.06); kr.add(kpiv);
  const knife = makeKnife(1.55, 0.006); knife.rotation.set(0.42, 0.32, -0.55); kpiv.add(knife);
  const snH = makeFPSniper('canhao'); root.add(snH);
  const snL = makeFPSniper('carabina'); root.add(snL);
  guns.push(r, s, sn, bz, ps, snH, snL, kr); for (const o of [s, sn, bz, ps, snH, snL, kr]) o.visible = false; // índice = arma (7 = faca)
  const saberHold = new THREE.Group();
  saberHold.position.set(0.06, -0.2, 0.1);
  saberHold.rotation.set(0.95, -0.62, 0.85);
  saberHold.scale.setScalar(2.45);
  const saber = makeFPSaber(); saberHold.add(saber); saberHold.userData.saber = saber;
  saberHold.userData.blade = saber.userData.blade; saberHold.userData.glow = saber.userData.glow;
  saberHold.visible = false; root.add(saberHold); guns.push(saberHold); // 8 = sabre
  let saberR = makeFPForearm(getSkin()), saberL = makeFPForearm(getSkin());
  root.add(saberR, saberL); saberR.visible = saberL.visible = false;
  let bowGrip = makeFPForearm(getSkin()), bowDraw = makeFPForearm(getSkin());
  root.add(bowGrip, bowDraw); bowGrip.visible = bowDraw.visible = false;
  const uzi = new THREE.Group(); uzi.position.set(0.01, 0.03, 0.02); root.add(uzi);
  add(new THREE.BoxGeometry(0.09, 0.11, 0.46), toon(0x2a2d35), 0, 0, -0.02, uzi);
  add(new THREE.BoxGeometry(0.055, 0.06, 0.24), toon(0x1a1c22), 0, 0.01, -0.36, uzi);
  add(new THREE.BoxGeometry(0.07, 0.13, 0.09), toon(0x3b3f4a), 0, -0.1, 0.14, uzi).rotation.x = 0.18;
  add(new THREE.BoxGeometry(0.08, 0.09, 0.14), toon(0x2a2d35), 0, -0.01, 0.28, uzi);
  add(new THREE.BoxGeometry(0.095, 0.028, 0.08), toon(COLORS.red), 0, 0.03, 0.06, uzi);
  const uMag = add(new THREE.BoxGeometry(0.05, 0.22, 0.055), toon(0x3b3f4a), 0, -0.16, -0.02, uzi, 0.004); uMag.rotation.x = 0.12;
  const uCh = add(new THREE.BoxGeometry(0.02, 0.025, 0.07), toon(0x111318), 0.055, 0.045, 0.02, uzi, 0.003);
  const p90g = new THREE.Group(); p90g.position.set(0.0, 0.04, 0.0); root.add(p90g);
  add(new THREE.BoxGeometry(0.11, 0.075, 0.56), toon(0x4a5568), 0, 0.02, -0.02, p90g);
  add(new THREE.BoxGeometry(0.045, 0.04, 0.22), toon(0x22252c), 0, 0.02, -0.4, p90g);
  add(new THREE.BoxGeometry(0.06, 0.13, 0.08), toon(0x2a2d35), 0, -0.08, 0.16, p90g).rotation.x = 0.22;
  add(new THREE.BoxGeometry(0.09, 0.08, 0.16), toon(0x3a4250), 0, 0.0, 0.3, p90g);
  const p90Mag = add(new THREE.BoxGeometry(0.09, 0.07, 0.3), toon(0xc9a36a), 0, 0.09, -0.02, p90g, 0.004);
  const p90Ch = add(new THREE.BoxGeometry(0.025, 0.02, 0.05), toon(0x1a1c22), 0.06, 0.02, 0.18, p90g, 0.003);
  const nail = new THREE.Group(); nail.position.set(0, 0.08, -0.02); root.add(nail);
  add(new THREE.BoxGeometry(0.15, 0.12, 0.3), toon(0xf0c14a), 0, 0.02, 0.02, nail);
  add(new THREE.CylinderGeometry(0.022, 0.008, 0.32, 10), toon(0xd0d4dc), 0, 0.02, -0.28, nail).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.07, 0.16, 0.08), toon(0x2a2d35), 0, -0.12, 0.08, nail).rotation.x = 0.18;
  const nStrip = add(new THREE.BoxGeometry(0.06, 0.055, 0.14), toon(0xe8eef2), 0.04, 0.09, 0.04, nail, 0.004);
  for (const o of [uzi, p90g, nail]) o.visible = false;
  guns.push(uzi, p90g, nail); // 9 mini uzi, 10 P90, 11 furadeira
  // Escopeta semi: cano curto, pente embaixo, sem telha de pump
  const semi = new THREE.Group(); semi.position.set(0.02, 0.02, 0.02); root.add(semi);
  add(new THREE.BoxGeometry(0.12, 0.12, 0.44), toon(0x2c3138), 0, 0.02, 0.02, semi);
  add(new THREE.BoxGeometry(0.1, 0.14, 0.28), toon(0x5c4030), 0, -0.02, 0.34, semi).rotation.x = -0.1;
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 12), toon(0x3a3e46), 0, 0.045, -0.4, semi).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.03, 0.007, 6, 14), toon(0xf5e6d0), 0, 0.045, -0.64, semi, 0.003);
  add(new THREE.BoxGeometry(0.13, 0.035, 0.1), toon(COLORS.cyan), 0, 0.045, 0.1, semi, 0.004);
  const semiMag = add(new THREE.BoxGeometry(0.07, 0.16, 0.09), toon(0xc45a3a), 0, -0.12, 0.04, semi, 0.004); semiMag.rotation.x = 0.1;
  const semiCh = add(new THREE.BoxGeometry(0.02, 0.03, 0.06), toon(0x111318), 0.07, 0.07, 0.12, semi, 0.003);
  semi.visible = false; guns.push(semi); // 12 = semi
  const cross = makeFPCrossbow(); cross.position.set(0.22, -0.14, 0.06); cross.rotation.set(0.18, 0.55, 0.08); cross.scale.setScalar(2.05); cross.visible = false; root.add(cross);
  const bow = makeFPBow(); bow.position.set(0.08, -0.06, 0.16); bow.rotation.set(0.08, 0.28, 0); bow.scale.setScalar(1.7); bow.visible = false; root.add(bow);
  guns.push(cross, bow); // 13 besta, 14 arco
  // braços (pose de fuzil, de pistola e de faca)
  let arms = makeFPArms(getSkin()), armsP = makeFPArms(getSkin(), 'pistol'), armsK = makeFPArms(getSkin(), 'knife'); root.add(arms, armsP); kr.add(armsK); armsP.visible = false; armsP.position.set(0, 0.07, -0.04);
  const setSkin = (id) => { root.remove(arms, armsP); kr.remove(armsK); arms = makeFPArms(getSkin(id)); armsP = makeFPArms(getSkin(id), 'pistol'); armsK = makeFPArms(getSkin(id), 'knife'); armsP.position.set(0, 0.07, -0.04); root.add(arms, armsP); kr.add(armsK); fpRef.arms = arms; fpRef.armsP = armsP; s.remove(pumpHand); pumpHand = makeFPForearm(getSkin(id)); s.add(pumpHand); root.remove(saberR, saberL); saberR = makeFPForearm(getSkin(id)); saberL = makeFPForearm(getSkin(id)); root.add(saberR, saberL); fpRef.saberR = saberR; fpRef.saberL = saberL; root.remove(bowGrip, bowDraw); bowGrip = makeFPForearm(getSkin(id)); bowDraw = makeFPForearm(getSkin(id)); root.add(bowGrip, bowDraw); fpRef.bowGrip = bowGrip; fpRef.bowDraw = bowDraw; pumpHand.userData.noCamo = true; armsK.userData.noCamo = true; };
  const fpRef = { arms, armsP };
  // clarão do disparo
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), basic(0xfff27a)); flash.position.set(0, 0.01, -0.78); flash.scale.set(1, 1, 2); flash.visible = false; root.add(flash);
  root.scale.setScalar(0.62);
  const cup = makeCup(0.55); cup.rotation.set(0.25, 0.4, 0.15); cup.visible = false; fpScene.add(cup);
  const hoofHint = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), toon(0xee9c22)); hoofHint.position.set(0.0, 0.07, 0.07); outline(hoofHint, 0.006); cup.add(hoofHint);
  fpRef.saberR = saberR; fpRef.saberL = saberL; fpRef.bowGrip = bowGrip; fpRef.bowDraw = bowDraw;
  return { root, guns, flash, setSkin, cup, cupThrowT: 0, kick: 0, bob: 0, flashT: 0, pumpPart, get pumpHand() { return pumpHand; }, pumpShoulder, rocketTip, slide, fpRef, actionT: 0, actionLen: 1, shellT: 0, stringT: 0, kr, kpiv, rMag, rCh, pMag, uMag, uCh, p90Mag, p90Ch, nStrip, semiMag, semiCh, sShell, sRound, loadRocket, drops: [], reloadSeen: 0, knifeT: 9, knifeKind: 'slash', knifeDrawT: 0 };
})();
fp.tablet = makeTablet(); fp.laptop = makeLaptop(); fp.radio = makeRadio(); fpScene.add(fp.tablet, fp.laptop, fp.radio);
// Mãos dentro da arma (pump, ferrolho, braço da faca) não entram na camuflagem nem na miniatura.
function markWeaponHands() {
  if (fp.pumpHand) fp.pumpHand.userData.noCamo = true;
  for (const g of fp.guns) {
    if (g.userData.boltHand) g.userData.boltHand.userData.noCamo = true;
    g.traverse((o) => {
      if (o === g || !o.userData) return;
      if (o.userData.handR || (o.userData.grip && 'support' in o.userData)) o.userData.noCamo = true;
    });
  }
}
markWeaponHands();
function weaponTitle(p) {
  const w = WEAPONS[p.weapon], n = (p.gunKills && p.gunKills[p.weapon]) || 0;
  const info = camoInfo(n), nxt = nextCamo(n);
  if (info && !nxt) return `${w.name} · ${info.name}`;
  if (info && nxt) return `${w.name} · ${info.name} · ${n}/${nxt.at}`;
  if (nxt) return `${w.name} · ${n}/${nxt.at}`;
  return w.name;
}
function noteWeaponKill(a, wIdx) {
  if (!a || !a.isPlayer || wIdx < 0 || wIdx >= WEAPONS.length) return;
  if (!a.gunKills) a.gunKills = WEAPONS.map(() => 0);
  const before = camoLevel(a.gunKills[wIdx]);
  a.gunKills[wIdx]++;
  const after = camoLevel(a.gunKills[wIdx]);
  if (after === before) return;
  applyWeaponCamo(fp.guns[wIdx], after);
  const info = camoInfo(a.gunKills[wIdx]);
  if (info) flashMsg(`${WEAPONS[wIdx].short}: ${info.name}`);
}
function resetMatchCamos() { for (const g of fp.guns) resetWeaponCamo(g); }

const _saberPt = new V3(), _saberInv = new THREE.Matrix4();
const SABER_SHOULDERS = [new V3(0.46, -0.62, 0.58), new V3(-0.28, -0.58, 0.52)];
const BOW_SHOULDERS = { grip: new V3(0.05, -0.62, 0.12), draw: new V3(0.46, -0.58, 0.22) };
const CROSS_SHOULDERS = { grip: new V3(0.5, -0.68, 0.32), draw: new V3(-0.02, -0.6, 0.12) };
const SABER_GRIPS = [new V3(0.08, 0.02, -0.01), new V3(-0.08, 0.02, 0.03)];
function poseSaberHands() {
  const group = fp.guns[SABER], saber = group && group.userData.saber;
  const hands = [fp.fpRef.saberR, fp.fpRef.saberL];
  if (!saber || !hands[0]) return;
  saber.updateWorldMatrix(true, false);
  fp.root.updateWorldMatrix(true, false);
  _saberInv.copy(fp.root.matrixWorld).invert();
  hands.forEach((hand, i) => {
    _saberPt.copy(SABER_GRIPS[i]);
    saber.localToWorld(_saberPt);
    hand.position.copy(_saberPt).applyMatrix4(_saberInv);
    poseFPForearm(hand, SABER_SHOULDERS[i]);
  });
}
function poseBowHands() {
  const g = fp.guns[player.weapon];
  const hands = [fp.fpRef.bowGrip, fp.fpRef.bowDraw];
  if (!g || !g.userData.grip || !hands[0]) return;
  const shoulders = player.weapon === BOW ? BOW_SHOULDERS : CROSS_SHOULDERS;
  g.updateWorldMatrix(true, false);
  fp.root.updateWorldMatrix(true, false);
  _saberInv.copy(fp.root.matrixWorld).invert();
  [[g.userData.grip, hands[0], shoulders.grip], [g.userData.draw, hands[1], shoulders.draw]].forEach(([pt, hand, shoulder]) => {
    _saberPt.copy(pt);
    g.localToWorld(_saberPt);
    hand.position.copy(_saberPt).applyMatrix4(_saberInv);
    if (hand === hands[1]) hand.position.x += player.weapon === BOW ? 0.14 : 0.08;
    poseFPForearm(hand, shoulder);
  });
}

function updateFP(dt) {
  const p = player, moving = Math.hypot(p.vel.x, p.vel.z) > 1 && p.onGround;
  if (moving) fp.bob += dt * 10;
  fp.kick = Math.max(0, fp.kick - dt * 6);
  fp.guns.forEach((g, i) => (g.visible = i === p.weapon));
  const w = WEAPONS[p.weapon];
  const bolting = !!(w.bolt && fp.actionT > 0);
  const drawn = p.weapon === CROSS || p.weapon === BOW;
  fp.fpRef.arms.visible = p.weapon !== PISTOL && p.weapon !== NAIL && p.weapon !== KNIFE && p.weapon !== SABER && !drawn && !bolting; fp.fpRef.armsP.visible = p.weapon === PISTOL || p.weapon === NAIL;
  if (p.weapon === KNIFE) knifeAnim(dt);
  let dip = 0, tilt = 0;
  // animações de ação: pump da Calibre 12, ferrolho do Sniper, ferrolho da pistola, foguete na boca da bazuca
  fp.actionT = Math.max(0, fp.actionT - dt); fp.shellT = Math.max(0, fp.shellT - dt);
  const ak = fp.actionT > 0 ? 1 - fp.actionT / fp.actionLen : 0; // 0..1 ao longo da ação
  const cyc = ak > 0.25 && ak < 0.85 ? Math.sin((ak - 0.25) / 0.6 * Math.PI) : 0;
  const pumpZ = -0.36 + cyc * 0.14;
  fp.pumpPart.position.z = pumpZ;
  const onShotgun = p.weapon === 1;
  const support = fp.fpRef.arms.userData.support;
  if (support) support.visible = !onShotgun;
  fp.pumpHand.visible = onShotgun;
  if (onShotgun) { fp.pumpHand.position.set(-0.11, -0.07, pumpZ); poseFPForearm(fp.pumpHand, fp.pumpShoulder); }
  fp.guns.forEach((g, i) => {
    if (!g.userData.boltHand) return;
    const active = i === p.weapon && w.bolt && fp.actionT > 0;
    g.userData.boltHand.visible = active;
    poseSniperBolt(g, active ? ak : 0);
  });
  if (p.weapon === SABER && fp.guns[SABER]) poseSaber(fp.guns[SABER].userData.saber || fp.guns[SABER], fp.actionT > 0 ? 1 - fp.actionT / fp.actionLen : 0);
  if (fp.fpRef.saberR) { const on = p.weapon === SABER; fp.fpRef.saberR.visible = on; fp.fpRef.saberL.visible = on; if (on) poseSaberHands(); }
  if (fp.fpRef.bowGrip) {
    fp.fpRef.bowGrip.visible = drawn; fp.fpRef.bowDraw.visible = drawn;
    if (drawn) {
      const g = fp.guns[p.weapon];
      fp.stringT = Math.max(0, fp.stringT - dt);
      const reloading = p.reloadEnd > gameTime;
      const k = reloading ? clamp(1 - (p.reloadEnd - gameTime) / w.reload, 0, 1) : 0;
      if (fp.stringT > 0) poseRelease(g, 1 - fp.stringT / 0.14);
      else if (reloading) poseDraw(g, k);
      else if (p.weapon === BOW && p.bowDraw) poseDraw(g, 0.28 + 0.72 * clamp((gameTime - p.bowDraw) / (w.draw || 0.7), 0, 1));
      else if (p.weapon === BOW) poseDraw(g, p.mag[p.weapon] > 0 ? 0.28 : 0);
      else poseDraw(g, p.mag[p.weapon] > 0 ? 1 : 0);
      poseBowHands();
    }
  }
  fp.slide.position.z = p.weapon === PISTOL ? fp.kick * 0.9 : 0;
  fp.rocketTip.visible = p.mag[3] > 0;
  const rl = fpReload(p, w, dt); dip = rl.dip; tilt = rl.tilt;
  if (p.switchEnd > gameTime) dip = Math.max(dip, (p.switchEnd - gameTime) / 0.4);
  if (w.pump || w.bolt) tilt += cyc * 0.12;
  const bobA = 1 - ads * 0.8; // mirando: arma no centro, levantada, quase sem balanço
  const adsX = w.rocket ? 0.12 : 0, adsY = w.rocket ? 0.0 : 0.065;
  fp.root.position.set(0.2 + (adsX - 0.2) * ads + Math.cos(fp.bob) * 0.012 * bobA, -0.2 + ads * adsY + Math.abs(Math.sin(fp.bob)) * 0.015 * bobA - dip * 0.25 - fp.shellT * 0.1, -0.62 + ads * 0.06 + fp.kick * (0.5 - ads * 0.25));
  fp.root.rotation.set(fp.kick * 1.2 - dip * 0.6 + rl.pitch, rl.yaw, dip * 0.3 + tilt);
  fp.flashT -= dt; fp.flash.visible = fp.flashT > 0; fp.flash.position.set(w.rocket ? 0.04 : 0, w.rocket ? 0.056 : 0.01, w.flashZ); fp.flash.scale.setScalar(w.rocket ? 2.2 : w.scope ? 1.6 : 1).z *= 2; fp.flash.rotation.z = Math.random() * 3;
  fp.root.visible = p.alive && !scoped(); // com a luneta a arma some
  tabletK += (tabletWant - tabletK) * Math.min(1, dt * 7);
  radioK += (radioWant - radioK) * Math.min(1, dt * 7);
  laptopK += (laptopWant - laptopK) * Math.min(1, dt * 8);
  fp.tablet.visible = tabletK > 0.04; fp.radio.visible = radioK > 0.04; fp.laptop.visible = laptopK > 0.04;
  poseTablet(fp.tablet, tabletK); poseRadio(fp.radio, radioK); poseLaptop(fp.laptop, laptopK);
  if (tabletK > 0.2 || radioK > 0.2 || laptopK > 0.2) fp.root.visible = false; // guarda a arma para segurar o tablet, o laptop ou o rádio
  // copo na mão enquanto carrega o arremesso
  fp.cupThrowT = Math.max(0, fp.cupThrowT - dt);
  if (p.charging && p.alive) { const k = chargePower(); fp.cup.visible = true; fp.cup.position.set(-0.36 - k * 0.05, -0.27 + k * 0.06, -0.72 + k * 0.08); fp.cup.rotation.set(0.25 - k * 0.5, 0.4, 0.15 + k * 0.3); }
  else if (fp.cupThrowT > 0) { const k = 1 - fp.cupThrowT / 0.25; fp.cup.visible = true; fp.cup.position.set(-0.3 + k * 0.2, -0.22 + k * 0.1, -0.7 - k * 0.8); }
  else fp.cup.visible = false;
}

// ---------------- Recarga em 1ª pessoa (tempo = WEAPONS[i].reload, sincronizado com a recarga de verdade) ----------------
// Fuzil/pistola: inclina, pente velho cai, pente novo entra, puxa a alavanca/ferrolho. Sniper: abre o ferrolho, põe 3 balas, fecha.
// Calibre 12: cartucho por cartucho (entra pela janela) e pump no fim (interrompível). Bazuca: baixa do ombro, foguete novo entra pela boca.
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RELOAD_SFX = { // momentos (fração do tempo de recarga) dos cliques
  rifle: [['out', 0.2], ['in', 0.7], ['charge', 0.88]], pistol: [['out', 0.2], ['in', 0.7], ['slide', 0.88]],
  uzi: [['out', 0.2], ['in', 0.7], ['charge', 0.88]], p90: [['out', 0.18], ['in', 0.62], ['charge', 0.88]],
  prego: [['out', 0.2], ['in', 0.68], ['slide', 0.9]],
  semi: [['out', 0.2], ['in', 0.68], ['charge', 0.88]],
  besta: [['charge', 0.42], ['in', 0.9]],
  arco: [['charge', 0.38], ['in', 0.86]],
  sniper: [['bolt', 0.12], ['round', 0.4], ['round', 0.53], ['round', 0.66], ['bolt', 0.86]], bazooka: [['clank', 0.2], ['slide', 0.55], ['thunk', 0.8], ['in', 0.92]],
};
function reloadSfx(w, v = 1) {
  for (const [k, f] of RELOAD_SFX[w.key] || []) { const d = f * w.reload;
    if (k === 'out') { tone('square', 520, 400, 0.04, 0.1 * v, d); noise(0.05, 2400, 0.25 * v, 'bandpass', d); }
    else if (k === 'in') { noise(0.06, 1600, 0.4 * v, 'bandpass', d); tone('square', 300, 240, 0.05, 0.14 * v, d); }
    else if (k === 'charge' || k === 'slide') { noise(0.05, 3000, 0.3 * v, 'bandpass', d); tone('square', 700, 600, 0.04, 0.1 * v, d); noise(0.05, 3600, 0.3 * v, 'bandpass', d + 0.09); tone('square', 820, 700, 0.03, 0.1 * v, d + 0.09); }
    else if (k === 'bolt') { tone('square', 420, 380, 0.04, 0.1 * v, d); noise(0.07, 2400, 0.3 * v, 'bandpass', d + 0.06); }
    else if (k === 'round') { tone('triangle', 1500, 1300, 0.03, 0.08 * v, d); noise(0.03, 4000, 0.15 * v, 'highpass', d); }
    else if (k === 'clank') { tone('square', 180, 120, 0.08, 0.14 * v, d); noise(0.1, 900, 0.3 * v, 'lowpass', d); }
    else if (k === 'thunk') { noise(0.12, 500, 0.6 * v, 'lowpass', d); tone('sine', 140, 70, 0.12, 0.25 * v, d); }
  }
}
const _wp = new V3();
function playMag(mag, base, dir, k, outDist, inDist) {
  if (k > 0.16 && k < 0.3) mag.position.copy(base).addScaledVector(dir, sstep(0.16, 0.26, k) * outDist);
  if (k >= 0.24 && !fp.dropped) { fp.dropped = true; mag.position.copy(base).addScaledVector(dir, outDist); dropMag(mag); }
  if (k >= 0.26 && k < 0.45) mag.visible = false;
  if (k >= 0.45 && k < 0.72) mag.position.copy(base).addScaledVector(dir, (1 - sstep(0.45, 0.7, k)) * inDist);
}
function dropMag(src) { // pente velho caindo (cópia do mesh), some em 0,8 s
  fp.root.updateMatrixWorld(true); src.getWorldPosition(_wp);
  const m = new THREE.Mesh(src.geometry, src.material); m.position.copy(_wp); m.quaternion.copy(src.getWorldQuaternion(new THREE.Quaternion())); m.scale.setScalar(0.62);
  fpScene.add(m); fp.drops.push({ m, vel: new V3(0.15, -0.3, 0.05), spin: new V3(rand(-4, 4), 0, rand(-6, 6)), t: 0 });
  window.__magDrops = (window.__magDrops || 0) + 1;
}
function fpReload(p, w, dt) {
  const out = { dip: 0, tilt: 0, pitch: 0, yaw: 0 }, i = p.weapon, on = p.reloadEnd > gameTime;
  for (let j = fp.drops.length - 1; j >= 0; j--) { const d = fp.drops[j]; d.t += dt; d.vel.y -= 5 * dt; d.m.position.addScaledVector(d.vel, dt); d.m.rotation.x += d.spin.x * dt; d.m.rotation.z += d.spin.z * dt; if (d.t > 0.8) { fpScene.remove(d.m); fp.drops.splice(j, 1); } }
  // posições de descanso
  fp.rMag.position.set(0, -0.15, -0.12); fp.rMag.visible = true; fp.rCh.position.z = 0.08; fp.pMag.position.set(0, -0.14, 0.035); fp.pMag.visible = true;
  fp.uMag.position.set(0, -0.16, -0.02); fp.uMag.visible = true; fp.uCh.position.set(0.055, 0.045, 0.02);
  fp.p90Mag.position.set(0, 0.09, -0.02); fp.p90Mag.visible = true; fp.p90Ch.position.set(0.06, 0.02, 0.18);
  fp.nStrip.position.set(0.04, 0.09, 0.04); fp.nStrip.visible = true;
  fp.semiMag.position.set(0, -0.12, 0.04); fp.semiMag.rotation.x = 0.1; fp.semiMag.visible = true; fp.semiCh.position.set(0.07, 0.07, 0.12);
  fp.sShell.visible = false; fp.sRound.visible = false; fp.loadRocket.visible = false;
  if (!on || w.melee) { fp.reloadKey = 0; return out; }
  if (w.shellReload) { // Calibre 12: inclinada; cada cartucho sobe até a janela e entra quando o servidor/cliente conta +1
    out.dip = 0.35; out.tilt = 0.5;
    const cycle = w.reload, ph = clamp(1 - (p.reloadEnd - gameTime) / cycle, 0, 1);
    if (p.reserve[i] > 0 && p.mag[i] < w.mag) { fp.sShell.visible = ph > 0.1; const a = sstep(0.1, 0.9, ph); fp.sShell.position.set(0.06 * (1 - a), -0.2 + 0.13 * a, 0.06 - 0.08 * a); fp.sShell.rotation.x = -0.6 * (1 - a); }
    return out;
  }
  const k = clamp(1 - (p.reloadEnd - gameTime) / w.reload, 0, 1);
  const key = p.reloadStartT || 0; if (fp.reloadKey !== key) { fp.reloadKey = key; fp.dropped = false; }
  const env = sstep(0, 0.14, k) * (1 - sstep(0.86, 1, k));
  if (i === 0 || i === PISTOL || i === UZI || i === P90 || i === NAIL || i === SEMI) { // pente (uzi embaixo, P90 por cima, furadeira no pente de pregos, semi embaixo)
    const mag = i === 0 ? fp.rMag : i === PISTOL ? fp.pMag : i === UZI ? fp.uMag : i === P90 ? fp.p90Mag : i === NAIL ? fp.nStrip : fp.semiMag;
    const base = mag.position.clone();
    const dir = (i === P90 ? new V3(0, 1, 0.08) : i === NAIL ? new V3(1, -0.25, 0.05) : new V3(0, -1, i === 0 ? -0.2 : -0.2)).normalize();
    out.tilt = env * (i === P90 ? -0.4 : 0.5); out.dip = env * 0.24; out.yaw = env * (i === NAIL ? -0.16 : 0.12);
    if (i === P90) out.pitch = env * 0.18;
    playMag(mag, base, dir, k, i === P90 ? 0.16 : 0.12, i === P90 ? 0.26 : 0.28);
    const pull = sstep(0.84, 0.9, k) * (1 - sstep(0.92, 0.98, k));
    if (i === 0) fp.rCh.position.z = 0.08 + pull * 0.1;
    else if (i === PISTOL) fp.slide.position.z = pull * 0.08;
    else if (i === UZI) fp.uCh.position.z = 0.02 + pull * 0.08;
    else if (i === P90) fp.p90Ch.position.z = 0.18 + pull * 0.06;
    else if (i === SEMI) fp.semiCh.position.z = 0.12 + pull * 0.07;
  } else if (w.bolt) { // Sniper: ferrolho
    out.tilt = env * 0.35; out.dip = env * 0.15; out.yaw = -env * 0.1;
    const open = sstep(0.08, 0.16, k) * (1 - sstep(0.84, 0.92, k)), back = sstep(0.15, 0.24, k) * (1 - sstep(0.78, 0.86, k));
    // ferrolho do modelo da sniper na mão (sniper-view.js): abre e puxa (0→0,58), segura aberto enquanto entram as balas, empurra e fecha (0,58→1)
    const g = fp.guns[i], ak = k < 0.78 ? 0.58 * sstep(0.06, 0.26, k) : 0.58 + 0.42 * sstep(0.78, 0.94, k);
    if (g && g.userData.boltHand) { poseSniperBolt(g, ak); g.userData.boltHand.visible = true; fp.fpRef.arms.visible = false; out.boltHand = true; }
    const rest = (g && g.userData.boltRest) || { x: 0.055, y: 0.03, z: 0.12 };
    if (g && fp.sRound.parent !== g) g.add(fp.sRound);
    for (const c of [0.4, 0.53, 0.66]) if (k > c - 0.12 && k < c) { const a = sstep(c - 0.12, c, k); fp.sRound.visible = true; fp.sRound.position.set(rest.x + 0.085 - 0.14 * a, rest.y - 0.07 + 0.09 * a, rest.z + 0.04 - 0.06 * a); }
  } else if (w.rocket) { // Bazuca: baixa do ombro e carrega pela boca
    out.dip = env * 0.55; out.pitch = env * 0.35; out.tilt = -env * 0.15;
    fp.rocketTip.visible = k > 0.8;
    if (k > 0.35 && k <= 0.8) { const a = sstep(0.4, 0.8, k); fp.loadRocket.visible = true; fp.loadRocket.position.set(0, 0.06 - 0.28 * (1 - a), -1.62 - 0.95 * (1 - a)); fp.loadRocket.rotation.set(0.3 * (1 - a), Math.PI, 0); }
  } else if (i === CROSS || i === BOW) {
    out.dip = env * 0.2; out.pitch = env * (i === BOW ? -0.18 : 0.12);
  }
  return out;
}

// animações da faca em 1ª pessoa: parada (balanço), sacar (sobe girando), golpe (arco da direita pra esquerda), estocada (recua e fura)
const KNIFE_ANIM = { slash: 0.32, stab: 0.5 };
function knifeAnim(dt) {
  const kr = fp.kr, kp = fp.kpiv; fp.knifeT += dt; fp.knifeDrawT = Math.max(0, fp.knifeDrawT - dt);
  let px = 0, py = Math.sin(gameTime * 1.7) * 0.006, pz = 0, rx = Math.sin(gameTime * 1.3) * 0.015, ry = 0, rz = 0;
  const L = KNIFE_ANIM[fp.knifeKind], k = fp.knifeT / L;
  if (k < 1) {
    const ease = (x) => x * x * (3 - 2 * x);
    if (fp.knifeKind === 'slash') {
      if (k < 0.22) { const a = ease(k / 0.22); px += 0.12 * a; py += 0.08 * a; ry += 0.7 * a; rz -= 0.35 * a; }
      else if (k < 0.55) { const a = ease((k - 0.22) / 0.33); px += 0.12 - 0.5 * a; py += 0.08 - 0.14 * a; pz -= 0.12 * Math.sin(a * Math.PI); ry += 0.7 - 1.8 * a; rz += -0.35 + 0.95 * a; rx -= 0.3 * Math.sin(a * Math.PI); }
      else { const a = ease((k - 0.55) / 0.45); px += -0.38 * (1 - a); py += -0.06 * (1 - a); ry += -1.1 * (1 - a); rz += 0.6 * (1 - a); }
    } else {
      if (k < 0.3) { const a = ease(k / 0.3); pz += 0.14 * a; py -= 0.03 * a; rx += 0.25 * a; }
      else if (k < 0.5) { const a = ease((k - 0.3) / 0.2); pz += 0.14 - 0.5 * a; py += -0.03 + 0.06 * a; px -= 0.06 * a; rx += 0.25 - 0.45 * a; }
      else { const a = ease((k - 0.5) / 0.5); pz += -0.36 * (1 - a); py += 0.03 * (1 - a); px -= 0.06 * (1 - a); rx -= 0.2 * (1 - a); }
    }
  }
  if (fp.knifeDrawT > 0) { const d = fp.knifeDrawT / (MELEE.draw + 0.1); py -= 0.35 * d; rx += 0.9 * d; rz += 1.6 * d; }
  kr.position.set(px, py, pz); kr.rotation.set(rx, ry, 0); kp.rotation.z = rz;
}

// ---------------- Mira (botão direito) ----------------
const hpBar = document.getElementById('hpbar');
const adsVig = document.getElementById('adsvig'), crossEl = document.getElementById('crosshair');
function updateAds(dt, want) {
  ads = clamp(ads + (want ? 1 : -1) * dt / ADS_TIME, 0, 1);
  const e = ads * ads * (3 - 2 * ads); // suavizado
  const target = WEAPONS[player ? player.weapon : 0].adsFov;
  const fov = BASE_FOV + (target - BASE_FOV) * e;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const sc = scoped(); const scopeEl = $('scope');
  scopeEl.classList.toggle('hidden', !sc); crossEl.classList.toggle('hidden', !!sc);
  scopeEl.classList.remove('torresmo', 'canhao', 'carabina');
  const scopeStyle = player && WEAPONS[player.weapon].scopeStyle;
  if (scopeStyle) scopeEl.classList.add(scopeStyle);
  adsVig.style.opacity = sc ? 0 : e.toFixed(3);
  crossEl.style.transform = `translate(-50%,-50%) scale(${(1 - 0.45 * e).toFixed(3)})`;
  crossEl.classList.toggle('ads', e > 0.5);
}
// sempre booleano: classList.toggle('hidden', undefined) vira toggle simples e a mira piscava a cada quadro (armas sem luneta)
const scoped = () => !!(player && player.alive && WEAPONS[player.weapon].scope && ads > 0.85 && !(fp.actionT > 0 && WEAPONS[player.weapon].bolt));
function resetAds() { $('scope').classList.add('hidden'); crossEl.classList.remove('hidden'); ads = 0; camera.fov = BASE_FOV; camera.updateProjectionMatrix(); adsVig.style.opacity = 0; crossEl.style.transform = ''; crossEl.classList.remove('ads'); }

// ---------------- Jogador ----------------
const fwd = new V3(), right = new V3();
function swingSaber(p) {
  const w = WEAPONS[SABER];
  p.nextFire = gameTime + w.rate;
  fp.actionT = fp.actionLen = w.rate;
  saberSfx.swing();
  const origin = p.isPlayer ? camera.position.clone() : center(p, EYE);
  const forward = new V3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  if (online && p.isPlayer) { netEv(['sw', v3a(origin), v3a(forward), +(performance.now() / 1000).toFixed(3)]); return; }
  let hit = false;
  for (const e of entities) {
    if (e === p || !e.alive || friends(e, p)) continue;
    const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > w.reach || dist < 0.05) continue;
    if ((dx / dist) * forward.x + (dz / dist) * forward.z < Math.cos(w.arc)) continue;
    if (!losClear(center(p, EYE), center(e, 1))) continue;
    damage(e, w.dmg, p, SABER, false);
    hit = true;
  }
  if (hit) saberSfx.clash();
}
// Arco: segura o clique para puxar a corda. Soltar cedo sai fraco; no talo, mais forte. A besta continua no clique.
function releaseBow(p) {
  const w = WEAPONS[BOW];
  const can = p.alive && p.reloadEnd <= gameTime && p.switchEnd <= gameTime && p.stunUntil <= gameTime && !p.charging && p.mag[BOW] > 0 && gameTime >= p.nextFire;
  if (!can) { p.bowDraw = 0; return; }
  if (mouseDown && !p.bowDraw) p.bowDraw = gameTime;
  const tap = !p.bowDraw && !mouseDown && clickLatch && performance.now() - clickLatch < 250;
  const release = !!p.bowDraw && !mouseDown;
  if (!tap && !release) return;
  const k = tap ? 0 : clamp((gameTime - p.bowDraw) / (w.draw || 0.7), 0, 1);
  p.bowDraw = 0; firedThisPress = true; clickLatch = 0;
  p.mag[BOW]--; p.nextFire = gameTime + w.rate; p.invulnUntil = Math.min(p.invulnUntil, gameTime);
  const dir = new V3(0, 0, -1).applyQuaternion(camera.quaternion);
  const spread = w.spread * (1.7 - k);
  const muzzle = camera.localToWorld(new V3(0.2, -0.18, -0.9));
  const force = 0.35 + 0.95 * k;
  fire(p, camera.position.clone(), dir, BOW, spread, muzzle, force);
  sfx[w.key](); fp.kick = Math.min(0.14, fp.kick + w.recoil * (1.2 + k)); fp.flashT = 0.04; fp.stringT = 0.14;
  launchShaft(muzzle, dir, 16 + 26 * k);
  p.pitch = clamp(p.pitch + w.recoil * (0.35 + k), -1.5, 1.5);
  window.__lastShot = { dir: dir.toArray(), origin: camera.position.toArray(), spread, w: BOW, force };
  if (p.mag[BOW] === 0) startReload(p);
}
function updatePlayer(dt) {
  const p = player;
  // Consome o toque mesmo no ar: segurar Espaço não rearma o pulo ao aterrissar.
  const jumpPressed = !!keys.Space; keys.Space = false;
  if (!p.alive) {
    saberSfx.hum(false);
    if (p.charging) { p.charging = false; arcLine.visible = arcMark.visible = false; }
    deathFx(p); deathCam(p, dt);
    // humano não renasce sozinho: espera RESPAWN_TIME e o clique em RENASCER (ou Espaço/Enter) — ver requestRespawn()
    updateAds(dt, false);
    return;
  }
  // mira com zoom: segura o botão direito (Shift agacha; com a faca o botão direito é a estocada). No ferrolho da sniper a luneta desce pra mão aparecer.
  const guiding = !!predator;
  stepCrouch(p, !guiding && !chatTyping() && (keys.ShiftLeft || keys.ShiftRight) ? 1 : 0, dt, PHYS);
  const bolting = fp.actionT > 0 && WEAPONS[p.weapon].bolt;
  updateAds(dt, !guiding && !bolting && p.weapon !== KNIFE && p.weapon !== SABER && rightDown && p.reloadEnd <= gameTime && p.switchEnd <= gameTime);
  saberSfx.hum(p.weapon === SABER && !guiding);
  fwd.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)); right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  const wish = new V3();
  if (!guiding && (keys.KeyW || keys.ArrowUp)) wish.add(fwd); if (!guiding && (keys.KeyS || keys.ArrowDown)) wish.sub(fwd);
  if (!guiding && (keys.KeyD || keys.ArrowRight)) wish.add(right); if (!guiding && (keys.KeyA || keys.ArrowLeft)) wish.sub(right);
  if (wish.lengthSq()) wish.normalize().multiplyScalar(SPEED * (WEAPONS[p.weapon].move || (p.weapon === KNIFE ? MELEE.speedMul : 1)) * (p.stunUntil > gameTime ? 0.35 : 1) * (1 - (1 - ADS_SPEED) * ads) * (1 - (1 - CROUCH.speed) * p.crouch)); // faca corre; agachado anda mais devagar
  const acc = p.onGround ? 14 : 4;
  p.vel.x += (wish.x - p.vel.x) * Math.min(1, acc * dt); p.vel.z += (wish.z - p.vel.z) * Math.min(1, acc * dt);
  if (!guiding && jumpPressed && p.onGround) { p.vel.y = JUMP; p.onGround = false; sfx.jump(); }
  moveEntity(p, dt);
  const bob = p.onGround ? Math.abs(Math.sin(fp.bob)) * 0.05 * stanceScale(p.crouch) : 0;
  camera.position.set(p.pos.x, p.pos.y + eyeHeight(p) + bob, p.pos.z); camera.rotation.set(p.pitch, p.yaw, 0);
  if (shake > 0) {
    if (!guiding) { camera.position.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.25)); camera.rotation.z += rand(-1, 1) * shake * 0.05; }
    shake = Math.max(0, shake - dt * 1.8);
  }
  if (guiding) { updatePredator(dt); if (predator && predator.phase === 'fly') posePredatorCam(); return; }
  // tiro
  finishReload(p);
  const w = WEAPONS[p.weapon];
  if (p.charging) updateArc(chargePower());
  // Calibre 12: atirar interrompe a recarga cartucho a cartucho
  const canFire = p.reloadEnd <= gameTime || (w.shellReload && p.mag[p.weapon] > 0);
  const latched = !mouseDown && clickLatch && performance.now() - clickLatch < 250;
  if (p.weapon === SABER) {
    if (!p.charging && p.stunUntil <= gameTime && (mouseDown || latched) && gameTime >= p.nextFire && p.switchEnd <= gameTime) {
      firedThisPress = true; clickLatch = 0; swingSaber(p);
    }
    return;
  }
  if (w.melee) { // faca: clique = golpe (segurando repete), botão direito = estocada
    const rLatched = !rightDown && rightLatch && performance.now() - rightLatch < 250;
    const rHeld = rightDown && !rightStale;
    if (!p.charging && p.stunUntil <= gameTime && gameTime >= p.nextFire && p.switchEnd <= gameTime && (rHeld || rLatched || mouseDown || latched)) {
      const kind = rHeld || rLatched ? 'stab' : 'slash'; if (kind === 'stab') rightFired = true; else firedThisPress = true; clickLatch = 0; rightLatch = 0;
      fp.knifeT = 0; fp.knifeKind = kind;
      knifeAttack(p, kind, camera.position.clone(), new V3(0, 0, -1).applyQuaternion(camera.quaternion));
    }
    return;
  }
  if (p.weapon === BOW) releaseBow(p);
  else if ((mouseDown || latched) && !p.charging && p.stunUntil <= gameTime && (w.auto || !firedThisPress || latched) && gameTime >= p.nextFire && canFire && p.switchEnd <= gameTime) {
    firedThisPress = true; clickLatch = 0;
    if (p.mag[p.weapon] > 0) {
      if (p.reloadEnd > gameTime) p.reloadEnd = 0;
      p.mag[p.weapon]--; p.nextFire = gameTime + w.rate; p.invulnUntil = Math.min(p.invulnUntil, gameTime);
      const dir = new V3(0, 0, -1).applyQuaternion(camera.quaternion);
      const moving = Math.hypot(p.vel.x, p.vel.z) > 1 || !p.onGround;
      let spread;
      if (w.scope) spread = sniperSpread(scoped(), Math.hypot(p.vel.x, p.vel.z), !p.onGround, w.scopeStyle === 'torresmo'); // luneta + parado = zero; Torresmo sem luneta abre bem mais
      else spread = w.spread * (moving ? 2.2 - ads * 0.8 : 1) * (1 - (1 - w.adsSpread) * ads);
      const muzzle = scoped() ? camera.localToWorld(new V3(0, -0.12, -0.6)) : camera.localToWorld(new V3(0.2 * (1 - ads), -0.18 + ads * 0.06, -0.9));
      if (w.rocket) {
        const d = dir.clone(); if (spread) { d.x += rand(-1, 1) * spread; d.y += rand(-1, 1) * spread; d.normalize(); }
        launchRocket(p, camera.localToWorld(new V3(0.08 * (1 - ads), -0.05, 0)), d);
      } else fire(p, camera.position.clone(), dir, p.weapon, spread, muzzle);
      sfx[w.key](); fp.kick = Math.min(0.14, fp.kick + w.recoil * 2.5); fp.flashT = w.rocket ? 0.08 : 0.04;
      if (p.weapon === CROSS || p.weapon === BOW) { fp.stringT = 0.14; launchShaft(muzzle, dir, p.weapon === CROSS ? 42 : 28); }
      if (w.pump) { sfx.pump(0.9, 0.3); fp.actionT = fp.actionLen = w.rate; }
      if (w.bolt) { sfx.bolt(0.9, 0.3); fp.actionT = fp.actionLen = w.rate; }
      if (w.scope) shake = Math.max(shake, 0.15);
      if (!w.scope) { p.pitch = clamp(p.pitch + w.recoil * (0.5 + Math.random() * 0.5), -1.5, 1.5); p.yaw += (Math.random() - 0.5) * w.recoil * 0.4; } // Sniper: coice só visual, a mira não sai do lugar
      window.__lastShot = { dir: dir.toArray(), origin: camera.position.toArray(), spread, w: p.weapon }; // testes
      if (p.mag[p.weapon] === 0) startReload(p);
    } else { sfx.empty(); p.nextFire = gameTime + 0.25; startReload(p); }
  }
}

// ---------------- Bots ----------------
function updateBot(b, dt) {
  const m = b.model;
  if (!b.alive) {
    deathFx(b);
    if (b.fxDeath === b.deathAt && b.baconOk) popModel(m.group, gameTime - b.deathAt, b.yaw); // pop → puf → bacon
    else { const k = Math.min(1, (gameTime - b.deathAt) / 0.15); m.group.scale.set(1 + 0.45 * k, 1 - 0.85 * k, 1 + 0.45 * k); if (gameTime - b.deathAt > 2.2) m.group.visible = false; }
    if (!b.remote && gameTime >= b.respawnAt) respawn(b);
    return;
  }
  if (b.remote) { interpRemote(b); animateBot(b, dt); return; } // online: posição vem do servidor
  if (b.dummy) { placeDummy(b); const sp = b.travelV / Math.max(dt, 1e-3); b.vel.x = sp; animateBot(b, dt); b.vel.x = 0; return; } // Treino: não pensa nem atira
  if (b.frozen) { m.group.position.copy(b.pos); m.group.rotation.y = b.yaw; if (b.frozen === 'anim') animateBot(b, dt); return; } // usado só em testes ('anim': parado mas animando)
  finishReload(b);
  b.think -= dt;
  if (b.think <= 0) {
    b.think = rand(0.18, 0.32);
    let best = null, bs = 1e9; const eye = center(b, 1.5);
    for (const o of entities) {
      if (o === b || !o.alive || friends(o, b)) continue;
      const d = o.pos.distanceTo(b.pos); if (d > 55) continue;
      const score = d * (o === b.lastAttacker ? 0.5 : 1) * (o.isPlayer ? 0.85 : 1);
      if (score < bs && losClear(eye, center(o, 1.2)) && !smoked(eye, center(o, 1.2))) { best = o; bs = score; }
    }
    if (b.passive || b.stunUntil > gameTime) best = null; // atordoado não trava alvo
    if (best !== b.target) { b.target = best; b.aim = 0; }
    if (best) { b.lastSeen = best.pos.clone(); b.lastSeenAt = gameTime; }
  }
  if (b.target && !b.target.alive) b.target = null;
  const t = b.target; const move = new V3(); let desiredYaw = b.yaw;
  if (t) {
    const to = t.pos.clone().sub(b.pos); to.y = 0; const dist = to.length(); to.normalize();
    desiredYaw = Math.atan2(to.x, to.z);
    const want = botWeaponFor(b, dist);
    if (want !== b.weapon && b.switchEnd <= gameTime && (b.reloadEnd <= gameTime || WEAPONS[b.weapon].shellReload)) switchWeapon(b, want);
    const range = BOT_RANGE[b.weapon];
    const dy = t.pos.y - b.pos.y;
    const zg = zoneGoal(b);
    if (zg) { const st = steer(b, zg); if (st) move.add(st.multiplyScalar(1.5)); } // Dominação: vai pra zona atirando
    else if (zone) { /* dentro da zona: segura a posição, só strafe */ }
    else if (Math.abs(dy) > 1.2 && dist > 3) { const st = steer(b, t.pos); if (st) move.add(st); } // outro andar: vai pelo grafo (rampas)
    else if (b.weapon === KNIFE) { if (dist > 1.1) move.add(to); } // faca: cola no alvo
    else if (dist > range + 3) move.add(to); else if (dist < range - 3) move.sub(to);
    b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeDir = [-1, 1, 1, -1, 0][Math.floor(Math.random() * 5)]; b.strafeT = rand(0.6, 1.8); if (Math.random() < 0.15 && b.onGround) b.vel.y = JUMP; }
    move.add(new V3(to.z, 0, -to.x).multiplyScalar(b.strafeDir * 0.8));
    if (b.nades > 0 && dist > 8 && dist < 24 && gameTime > b.nextNade && b.aim > b.reaction && Math.abs(t.pos.y - b.pos.y) < 3) { if (Math.random() < 0.35) botThrow(b, t); else b.nextNade = gameTime + rand(1.5, 3); }
    b.aim += dt;
    const sky = heliAimBot(b, dist);
    let shotT = t, shotDist = dist;
    if (sky) { shotT = heli; shotDist = sky; desiredYaw = Math.atan2(heli.pos.x - b.pos.x, heli.pos.z - b.pos.z); }
    let diff = desiredYaw - b.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const scopeWait = WEAPONS[b.weapon].scope ? (b.weapon === 5 ? 1.15 : b.weapon === 6 ? 0.45 : 0.8) : 0;
    const needAim = b.reaction + scopeWait; // sniper: os bots demoram mais pra mirar (justo)
    if (b.aim > needAim && Math.abs(diff) < (sky ? 0.6 : 0.35)) botShoot(b, shotT, shotDist);
  } else {
    let goal = null;
    const hp = b.hp < 45 ? pickups.filter((p) => p.active && p.type === 'health').sort((a, c) => a.pos.distanceTo(b.pos) - c.pos.distanceTo(b.pos))[0] : null;
    const nadeP = !hp && b.nades < 2 ? pickups.filter((p) => p.active && p.type === 'grenade' && p.pos.distanceTo(b.pos) < 22).sort((a, c) => a.pos.distanceTo(b.pos) - c.pos.distanceTo(b.pos))[0] : null;
    const zg = zoneGoal(b), bc = b.hp < 60 ? nearBacon(b, 12) : null;
    if (bc) goal = bc.pos; else if (hp && b.hp < 30) goal = hp.pos; else if (zg) goal = zg; else if (zone) goal = b.pos; else if (hp) goal = hp.pos; else if (nadeP) goal = nadeP.pos;
    else if (b.lastSeen && gameTime - b.lastSeenAt < 4) goal = b.lastSeen;
    else { if (!b.wp) b.wp = randomWaypoint(); goal = b.wp; }
    const to = goal.clone().sub(b.pos); to.y = 0;
    if (to.length() < 1.5 && Math.abs(goal.y - b.pos.y) < 0.5 && !bc) { if (goal === b.wp) b.wp = null; else b.lastSeenAt = -99; }
    else { const st = steer(b, goal) || to.normalize(); move.copy(st); desiredYaw = Math.atan2(st.x, st.z); }
    if (b.mag[b.weapon] < WEAPONS[b.weapon].mag * 0.5) startReload(b);
  }
  if (move.lengthSq()) move.normalize().multiplyScalar(BOT_SPEED * (WEAPONS[b.weapon].move || (b.weapon === KNIFE ? MELEE.speedMul : 1)) * (b.stunUntil > gameTime ? 0.35 : 1));
  const acc = b.onGround ? 10 : 3;
  b.vel.x += (move.x - b.vel.x) * Math.min(1, acc * dt); b.vel.z += (move.z - b.vel.z) * Math.min(1, acc * dt);
  const blocked = moveEntity(b, dt);
  if (blocked) { b.stuck += dt; if (b.onGround) b.vel.y = JUMP; if (b.stuck > 1.2) { b.wp = randomWaypoint(); b.path = null; b.lastSeenAt = -99; b.strafeDir *= -1; b.stuck = 0; b.stuckCount = (b.stuckCount || 0) + 1; } }
  else b.stuck = Math.max(0, b.stuck - dt);
  let d = desiredYaw - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); b.yaw += d * Math.min(1, dt * 9);
  for (const i of b.slots) if (b.reserve[i] < WEAPONS[i].mag && !(WEAPONS[i].rocket && b.reserve[i] > 0)) b.reserve[i] = WEAPONS[i].reserve; // bots nunca ficam totalmente sem bala
  animateBot(b, dt);
}
function animateBot(b, dt) { // visual: andar, flutuar, piscar ao levar dano, bolha de proteção, pose de recarga
  const m = b.model;
  const speed = Math.hypot(b.vel.x, b.vel.z); b.walk += dt * speed * 2.2; b.travel = (b.travel || 0) + speed * dt;
  if (b.float) { // Fantasminha: flutua de leve e deixa um rastro fraquinho
    m.group.position.set(b.pos.x, b.pos.y + 0.14 + Math.sin(gameTime * 2.6 + b.floatPh) * 0.07, b.pos.z);
    if (gameTime > b.nextWisp && speed > 1) { b.nextWisp = gameTime + 0.12; wisp(b.pos); }
  } else m.group.position.set(b.pos.x, b.pos.y + (b.onGround ? Math.abs(Math.sin(b.walk)) * 0.07 : 0), b.pos.z);
  m.group.rotation.y = b.yaw;
  m.legs[0].rotation.x = Math.sin(b.walk) * 0.6 * Math.min(1, speed); m.legs[1].rotation.x = -m.legs[0].rotation.x;
  setCrouchPose(m, b.crouch);
  const flashing = gameTime < b.flashUntil;
  for (const mat of m.flashMats) mat.emissive.copy(flashing ? FLASH : mat.userData.baseEmissive);
  b.bubble.visible = gameTime < b.invulnUntil;
  const reloading = b.reloadEnd > gameTime, pose = b.weapon === KNIFE ? 'knife' : b.weapon === SABER ? 'saber' : reloading ? 'reload' : 'gun';
  if (pose !== b.wasPose) { setPose(m, pose); b.wasPose = pose; }
  // recarga em 3ª pessoa (bots e outros jogadores online: a flag de recarga já vem no snapshot)
  const gi = b.weapon, gun = m.guns[gi];
  if (gun && gi !== KNIFE && gi !== SABER) {
    if (gun.userData.baseY === undefined) gun.userData.baseY = gun.position.y;
    let rx = 0, rz = 0, py = 0;
    if (reloading) {
      const W = WEAPONS[gi], el = gameTime - (b.reloadStartT ?? gameTime), k = W.shellReload ? (el % W.reload) / W.reload : clamp(el / W.reload, 0, 1);
      const env = W.shellReload ? 1 : sstep(0, 0.14, k) * (1 - sstep(0.86, 1, k));
      if (W.rocket) { rx = -0.55 * env; py = -0.3 * env; } else { rz = 0.6 * env; rx = 0.15 * env; }
      m.arms[1].rotation.x = -0.8 + 0.45 * Math.sin(k * Math.PI * 2); // mão de apoio: tira/põe pente, cartucho, foguete
      if ((gi === 0 || gi === PISTOL) && k >= 0.25 && b.magDropKey !== b.reloadStartT) { b.magDropKey = b.reloadStartT; worldMagDrop(b, gi); }
    }
    gun.rotation.set(rx, 0, rz); gun.position.y = gun.userData.baseY + py;
  }
  if (pose === 'knife') { // golpe em 3ª pessoa: braço direito faz o arco (golpe) ou fura pra frente (estocada)
    b.swingT = (b.swingT ?? 9) + dt; const L = KNIFE_ANIM[b.swingKind || 'slash'], k = b.swingT / L, a = m.arms[0];
    a.rotation.set(-1.05, 0.25, -0.1);
    if (k < 1) {
      const sn = Math.sin(Math.min(1, k / 0.6) * Math.PI);
      if (b.swingKind === 'stab') { a.rotation.x = k < 0.3 ? -1.05 + 0.5 * (k / 0.3) : -0.55 - 1.0 * Math.sin(Math.min(1, (k - 0.3) / 0.4) * Math.PI / 2) * (1 - Math.max(0, (k - 0.7) / 0.3)); }
      else { a.rotation.y = 0.25 + (k < 0.25 ? -0.9 * (k / 0.25) : -0.9 + 2.0 * Math.min(1, (k - 0.25) / 0.35)) * (1 - Math.max(0, (k - 0.6) / 0.4)); a.rotation.x = -1.05 - 0.35 * sn; }
    }
  }
  if (pose === 'saber') { // as duas mãos no cabo; o corte gira o braço direito e o sabre vai junto
    b.swingT = (b.swingT ?? 9) + dt; const k = b.swingT / 0.48, a = m.arms[0], off = m.arms[1];
    a.rotation.set(-1.15, 0.42, -0.08); off.rotation.set(-1.05, -0.55, 0.28);
    if (k < 1) { const sn = Math.sin(Math.min(1, k / 0.45) * Math.PI); a.rotation.y = 0.42 - 1.15 * sn; a.rotation.x = -1.15 - 0.2 * sn; off.rotation.y = -0.55 - 0.65 * sn; }
  }
}

const magGeo = new THREE.BoxGeometry(0.1, 0.24, 0.13);
function worldMagDrop(b, gi) { // pente caindo da arma de quem recarrega (3ª pessoa)
  const m = new THREE.Mesh(magGeo, new THREE.MeshBasicMaterial({ color: gi === PISTOL ? 0xff9fb6 : 0xe63946, transparent: true }));
  m.position.set(b.pos.x + Math.sin(b.yaw) * 0.5, b.pos.y + 0.75, b.pos.z + Math.cos(b.yaw) * 0.5); scene.add(m);
  particles.push({ mesh: m, vel: new V3(rand(-0.4, 0.4), 0.5, rand(-0.4, 0.4)), life: 2.2, t: 0, kind: 'mag', spin: new V3(rand(-5, 5), 0, rand(-5, 5)) });
  window.__worldMags = (window.__worldMags || 0) + 1;
}
// Dominação: ponto dentro da zona pra onde o bot vai (null = já está dentro / sem zona)
function zoneGoal(b) {
  if (!zone || online) return null;
  if (inZone(zone, b.pos) && Math.hypot(b.pos.x - zone.x, b.pos.z - zone.z) < DOM.RADIUS * 0.7) return null;
  if (!b.zoneOff || b.zoneOff.z !== zone) { const a = rand(0, Math.PI * 2), r = rand(0, DOM.RADIUS * 0.5); b.zoneOff = { z: zone, p: new V3(zone.x + Math.cos(a) * r, zone.y, zone.z + Math.sin(a) * r) }; }
  return b.zoneOff.p;
}
// navegação: segue o caminho A* do grafo do mapa até o objetivo; devolve a direção horizontal
function randomWaypoint() { const n = nav && nav.randomNode(); return n ? new V3(n.x, n.y, n.z) : new V3(rand(-10, 10), 0, rand(-10, 10)); }
function steer(b, goal) {
  if (!nav) { const v = goal.clone().sub(b.pos); v.y = 0; return v.lengthSq() > 0.01 ? v.normalize() : null; }
  if (!b.path || !b.pathGoalPos || b.pathGoalPos.distanceToSquared(goal) > 4 || gameTime > b.repathAt) {
    b.path = nav.path(b.pos, goal) || []; b.pathGoalPos = goal.clone(); b.repathAt = gameTime + rand(2.5, 3.5);
  }
  const P = b.path;
  while (P.length) { const n = P[0], dx = n.x - b.pos.x, dz = n.z - b.pos.z; if (dx * dx + dz * dz < 0.8 && Math.abs(n.y - b.pos.y) < 1.4) P.shift(); else break; }
  let tgt = P.length ? P[0] : goal;
  if (P.length > 1 && gameTime > (b.nextShortcut || 0)) { // atalho: pula nó intermediário se dá pra ir reto
    b.nextShortcut = gameTime + 0.25; const n2 = P[1];
    if (Math.abs(n2.y - b.pos.y) < 0.3 && Math.abs(P[0].y - b.pos.y) < 0.3 && Math.hypot(n2.x - b.pos.x, n2.z - b.pos.z) < 3.2 && nav.walk(b.pos, n2) >= 0) { P.shift(); tgt = n2; }
  }
  const v = new V3(tgt.x - b.pos.x, 0, tgt.z - b.pos.z); return v.lengthSq() > 0.01 ? v.normalize() : null;
}

// escolha de arma dos bots pelo alcance: Calibre 12 de perto, Sniper de longe, Bazuca a média distância, pistola no resto
function botWeapon(b, i) { return b.mag[i] > 0 || b.reserve[i] > 0; }
function botWeaponFor(b, dist) {
  // faca: de vez em quando, colado no alvo, o bot saca a faca e persegue (até 7 m)
  if (dist < 3 && gameTime > (b.knifeRoll || 0)) { b.knifeRoll = gameTime + 1.5; b.knifeMode = Math.random() < 0.45; }
  if (b.knifeMode && dist < 7) return b.slots[2] ?? KNIFE; if (dist >= 7) b.knifeMode = false;
  const side = b.slots[1] ?? PISTOL;
  const pr = b.primary; if (!botWeapon(b, pr)) return side;
  if (pr === 1) return dist < 14 ? pr : side;
  if (WEAPONS[pr].scope) { const min = pr === 5 ? 14 : pr === 6 ? 6 : 9; return dist >= min ? pr : side; }
  if (pr === 3) return dist >= 6 && dist <= 28 ? pr : side;
  if (pr === UZI) return dist < 24 ? pr : side;
  if (pr === P90) return dist < 36 ? pr : side;
  if (pr === SEMI) return dist < 16 ? pr : side;
  return pr;
}
const BOT_RATE = [() => rand(2.2, 3.4), () => 1.4, () => 1.6, () => 1, () => rand(1.8, 2.6), () => 1.15, () => 1.05, () => 1.5];
function botShoot(b, t, dist = 10) {
  if (b.stunUntil > gameTime) return;
  const w = WEAPONS[b.weapon];
  if (b.weapon === SABER) {
    if (gameTime < b.nextFire || dist > w.reach) return;
    b.nextFire = gameTime + w.rate; b.swingT = 0;
    damage(t, w.dmg, b, b.weapon, false);
    return;
  }
  if (gameTime < b.nextFire || b.switchEnd > gameTime) return;
  if (w.melee) { // faca: só golpeia de perto; às vezes estocada
    if (dist > MELEE.slash.range + 0.8) return;
    const kind = Math.random() < 0.3 ? 'stab' : 'slash', eye = center(b, 1.5), dir = center(t, 1.1).sub(eye).normalize();
    knifeAttack(b, kind, eye, dir); b.nextFire = gameTime + MELEE[kind].rate * rand(1.3, 1.9); return;
  }
  if (b.reloadEnd > gameTime) { if (w.shellReload && b.mag[b.weapon] > 0) b.reloadEnd = 0; else return; }
  if (b.mag[b.weapon] <= 0) { startReload(b); return; }
  if (w.rocket && dist < 6) return; // não se explode
  b.mag[b.weapon]--;
  b.nextFire = gameTime + w.rate * (BOT_RATE[b.weapon] || (() => 1.2))();
  const origin = center(b, 1.3);
  const tMoving = Math.hypot(t.vel.x, t.vel.z) > 2 ? 1.5 : 1;
  const muzzle = origin.clone().add(new V3(Math.sin(b.yaw) * 1.0, -0.25, Math.cos(b.yaw) * 1.0));
  if (w.rocket) { // mira no pé, com antecipação
    const lead = dist / w.rocket.speed; const at = t.pos.clone().add(new V3(t.vel.x * lead + rand(-0.8, 0.8), 0.25, t.vel.z * lead + rand(-0.8, 0.8)));
    const o = center(b, 1.4); launchRocket(b, o, at.sub(o).normalize());
  } else {
    const aimPt = (w.scope ? center(t, rand(0.75, 1.15)) : center(t, rand(0.7, 1.6))).add(new V3(rand(-0.3, 0.3), 0, rand(-0.3, 0.3)));
    const dir = aimPt.sub(origin).normalize();
    const spread = w.pellets > 1 ? w.spread * 1.2 : w.scope ? 0.02 * tMoving : b.accuracy * tMoving * (b.weapon === PISTOL ? 0.9 : 1);
    fire(b, origin, dir, b.weapon, spread, muzzle);
    if (w.scope) b.aim = b.reaction * 0.4; // precisa remirar depois de cada tiro de sniper
  }
  sfx[w.key](distVol(b.pos) * 0.7);
  if (w.pump) sfx.pump(distVol(b.pos) * 0.5, 0.3); if (w.bolt) sfx.bolt(distVol(b.pos) * 0.5, 0.3);
  b.invulnUntil = Math.min(b.invulnUntil, gameTime);
}

// Entradas do menu fazem parte da vitrine; a comanda mantém a partida a um clique.
const menuViewButtons = [...document.querySelectorAll('[data-menu-view]')];
let menuViewTrigger = null;
function setMenuView(view, trigger) {
  for (const name of ['match', 'arsenal', 'operator', 'settings']) $('menu-' + name).hidden = name !== view;
  for (const button of menuViewButtons) button.setAttribute('aria-expanded', String(button.dataset.menuView === view));
  $('menuBack').hidden = view === 'match';
  $('menu').dataset.view = view;
  $('menu').querySelector('.menu-content').scrollTop = 0;
  if (trigger) menuViewTrigger = trigger;
  if (view !== 'match') $('menu-' + view).focus();
  else if (menuViewTrigger) menuViewTrigger.focus();
}
// Uma única progressão dirige tampa, personagem, câmera e interface, inclusive na volta.
const crateJourney = { progress: 0, target: 0, phase: 'closed', view: 'arsenal', nextView: 'match', homeNear: .1, homePosition: new V3(), homeQuaternion: new THREE.Quaternion(), homeOffset: 0 };
function crateMenuBusy(busy) {
  const menu = $('menu'); menu.setAttribute('aria-busy', String(busy));
  for (const selector of ['.menu-panel', '.menu-tools', '.showcase-actions', '.menu-key-hints']) menu.querySelector(selector).inert = busy;
  if (busy) { menu.tabIndex = -1; menu.focus({ preventScroll: true }); }
}
function openMenuView(view, trigger) {
  if ((view === 'arsenal' || view === 'operator') && crateJourney.phase === 'closed') {
    if (trigger) menuViewTrigger = trigger;
    crateJourney.view = view; crateJourney.homeNear = camera.near;
    $('menu').dataset.container = view === 'operator' ? 'wardrobe' : 'arsenal';
    crateJourney.homePosition.copy(camera.position); crateJourney.homeQuaternion.copy(camera.quaternion);
    crateJourney.homeOffset = camera.view?.enabled ? camera.view.offsetX / innerWidth : 0;
    crateJourney.target = 1; crateJourney.phase = 'opening';
    $('menu').dataset.crateState = 'opening'; crateMenuBusy(true);
    return;
  }
  if (crateJourney.phase !== 'closed') {
    if (view === crateJourney.view) return;
    crateJourney.nextView = view; crateJourney.target = 0; crateJourney.phase = 'closing';
    $('menu').dataset.crateState = 'closing'; crateMenuBusy(true);
    return;
  }
  setMenuView(view, trigger);
}
menuViewButtons.forEach((button) => button.onclick = () => openMenuView(button.dataset.menuView, button));
$('menuBack').onclick = () => openMenuView('match');
$('menu').addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && (crateJourney.phase !== 'closed' || ($('menu').dataset.view && $('menu').dataset.view !== 'match'))) {
    event.preventDefault(); openMenuView('match');
  }
});
$('menuSound').onclick = () => {
  const muted = $('menuSound').getAttribute('aria-pressed') !== 'true';
  $('menuSound').setAttribute('aria-pressed', String(muted));
  $('menuSound').setAttribute('aria-label', muted ? 'Ativar áudio' : 'Silenciar áudio');
  $('menuSound').title = muted ? 'Ativar áudio' : 'Silenciar áudio';
  menuMuted = muted;
  if (master) master.gain.value = muted ? 0 : 0.4;
};

// Os valores acompanham os controles nativos, inclusive pelo teclado.
for (const id of ['sens', 'sensAds']) {
  const updateRangeTicket = () => {
    $(id + 'Value').value = Number($(id).value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  };
  $(id).addEventListener('input', updateRangeTicket);
  // As preferências salvas são carregadas mais abaixo durante a inicialização.
  requestAnimationFrame(updateRangeTicket);
}

// ---------------- Fluxo do jogo ----------------
// Vitrine independente: a arte do menu e sua luz não alteram os mapas jogáveis.
const menuScene = new THREE.Scene();
menuScene.background = new THREE.Color(0xdfb477);
const menuBackdrop = makeMenuBackdrop(THREE, menuScene, camera);
menuScene.add(new THREE.HemisphereLight(0xffe6bd, 0x79522f, 2.1));
const menuSun = new THREE.DirectionalLight(0xffd292, 2.4);
menuSun.position.set(-3, 7, 5); menuScene.add(menuSun);
const menuStage = new THREE.Group(); menuScene.add(menuStage);
const menuActorRoot = new THREE.Group(); menuScene.add(menuActorRoot);
const crateLid = new THREE.Group(); crateLid.position.set(0, -.02, -.53); menuStage.add(crateLid);
function onCrateLid(mesh) { crateLid.attach(mesh); return mesh; }
// Pinceladas largas e veios quentes aproximam a caixa do assoalho ilustrado.
const crateWood = ['#a76a36', '#b77b43', '#986032'].map((base, board) => {
  const map = canvasTex(512, 256, (ctx) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 256);
    let seed = 43 + board * 137;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 65; i++) {
      const x = rand() * 512, y = rand() * 256, length = 25 + rand() * 170;
      ctx.fillStyle = i % 3 ? '#4c281318' : '#f4bd7425';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y - 2 - rand() * 5);
      ctx.lineTo(x + length * .82, y + 2); ctx.lineTo(x - 12, y + 3 + rand() * 5); ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const x = rand() * 512, y = rand() * 256;
      ctx.strokeStyle = '#512a1965'; ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 30, y - 5, x + 65, y + 6, x + 100, y - 2); ctx.stroke();
    }
    // Nós e pequenas lascas, desenhados em poucos planos como o chão da cena.
    const knotX = 115 + board * 113, knotY = 90 + board * 32;
    ctx.strokeStyle = '#59331d66'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(knotX, knotY, 27, 7, -.05, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#59331d66'; ctx.beginPath(); ctx.ellipse(knotX + 3, knotY, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
    for (const x of [35 + board * 23, 340 - board * 35]) {
      ctx.fillStyle = '#5b331c88'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 9, 0); ctx.lineTo(x + 4, 25); ctx.lineTo(x - 5, 34); ctx.fill();
      ctx.fillStyle = '#e4a56066'; ctx.beginPath(); ctx.moveTo(x + 9, 0); ctx.lineTo(x + 13, 0); ctx.lineTo(x + 8, 27); ctx.lineTo(x - 5, 34); ctx.fill();
    }
    ctx.strokeStyle = '#e8ac644c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(512, 3); ctx.stroke();
    ctx.fillStyle = '#49291455'; ctx.fillRect(0, 249, 512, 7);
  });
  return new THREE.MeshStandardMaterial({ map, roughness: .95 });
});
const crateIron = new THREE.MeshStandardMaterial({ color: 0x544a37, roughness: 0.8, metalness: 0.12 });
function crateBox(w, h, d, x, y, z, material) {
  // Chanfros pequenos capturam a luz nas bordas das tábuas sem textura realista.
  let geometry;
  if (crateWood.includes(material) && Math.min(w, h, d) >= 0.1) {
    const bevel = Math.min(0.015, Math.min(w, h, d) / 8);
    const shape = new THREE.Shape();
    const hw = w / 2 - bevel, hh = h / 2 - bevel;
    shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.closePath();
    geometry = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 });
    geometry.translate(0, 0, -d / 2 + bevel);
  } else geometry = new THREE.BoxGeometry(w, h, d);
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z); menuStage.add(part); return part;
}
// Tampa, corpo de tábuas e moldura frontal: o personagem fica sobre a caixa.
for (let i = 0; i < 6; i++) {
  onCrateLid(crateBox(0.34, 0.13, 1.1, (i - 2.5) * 0.35, -0.085, 0, crateWood[i % 3]));
}
for (let row = 0; row < 3; row++) {
  const y = -0.24 - row * 0.26;
  // Quatro paredes, em vez de blocos maciços: a câmera pode entrar de verdade.
  for (const z of [-.478, .478]) crateBox(2.06, .25, .075, 0, y, z, crateWood[row % 3]);
  for (const x of [-.993, .993]) crateBox(.075, .25, .9, x, y, 0, crateWood[(row + 1) % 3]);
}
crateBox(2.06, .1, 1.03, 0, -.88, 0, crateWood[0]);
crateBox(2.13, 0.12, 0.12, 0, -0.18, 0.55, crateWood[2]);
crateBox(2.13, 0.12, 0.12, 0, -0.91, 0.55, crateWood[0]);
for (const x of [-0.97, 0.97]) {
  crateBox(0.14, 0.85, 0.14, x, -0.54, 0.56, crateWood[2]);
}
for (const x of [-0.76, 0.76]) {
  crateBox(0.095, 0.88, 0.035, x, -0.52, 0.61, crateIron);
  onCrateLid(crateBox(0.095, 0.028, 1.09, x, -0.011, 0, crateIron));
  for (const y of [-0.17, -0.86]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 6), new THREE.MeshBasicMaterial({ color: 0xb7a37d }));
    rivet.rotation.x = Math.PI / 2; rivet.position.set(x, y, 0.64); menuStage.add(rivet);
  }
}
// Pequeno estojo sobre a tampa, ao lado do Docão.
onCrateLid(crateBox(0.48, 0.18, 0.24, -0.68, 0.08, -0.18, new THREE.MeshStandardMaterial({ color: 0x893d2b, roughness: 1 })));
for (const x of [-0.83, -0.53]) onCrateLid(crateBox(0.035, 0.19, 0.25, x, 0.085, -0.18, crateIron));
// Dobradiças e travessas ficam visíveis com a tampa aberta.
for (const x of [-.72, .72]) {
  crateBox(.17, .09, .10, x, -.12, -.53, crateIron);
  onCrateLid(crateBox(.10, .06, .94, x, -.18, 0, crateWood[0]));
}
// Mala de figurinos apoiada na quina direita, com a base no mesmo piso da caixa.
const wardrobeCase = makeWardrobeCase(THREE, canvasTex);
wardrobeCase.position.set(1.43, -.975, .38); wardrobeCase.rotation.set(0, .10, .14);
menuStage.add(wardrobeCase);
const wardrobeAnchor = new V3(), wardrobeCorner = new V3();
// A tinta faz parte da geometria: recebe a mesma luz e perspectiva da madeira.
// O botão HTML transparente preserva foco, teclado e nome acessível.
const cratePaint = new THREE.MeshStandardMaterial({ color: 0xe5bf85, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
const crateInscription = new THREE.Mesh(new THREE.PlaneGeometry(1.38, .34), cratePaint);
crateInscription.position.set(0, -.52, .518); crateInscription.visible = false; menuStage.add(crateInscription);
const crateLetters = new Image();
crateLetters.onload = () => {
  cratePaint.map = canvasTex(1024, 256, (ctx) => {
    ctx.drawImage(crateLetters, 200, 8, 810, 240);
    const pixels = ctx.getImageData(0, 0, 1024, 256);
    for (let i = 0; i < pixels.data.length; i += 4) {
      // Retira a extrusão escura do lettering original, mantendo só a face pintada.
      const face = Math.min(1, Math.max(0, (pixels.data[i + 1] - 95) / 60));
      pixels.data[i + 3] *= face * .92;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      const x = 25 + i * 48;
      ctx.beginPath(); ctx.moveTo(x, 214); ctx.lineTo(x + 2, 76); ctx.lineTo(x + 17, 27);
      ctx.lineTo(x + 33, 76); ctx.lineTo(x + 34, 214); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-out';
    // Falhas de tinta seguem os veios e a junta entre as duas tábuas.
    for (let i = 0; i < 110; i++) {
      ctx.fillStyle = i % 4 ? '#0005' : '#000b';
      ctx.fillRect((i * 173 + 39) % 1024, (i * 47 + 13) % 256, 4 + i % 23, 1 + i % 2);
    }
    ctx.clearRect(0, 202, 1024, 8);
  });
  cratePaint.needsUpdate = true; crateInscription.visible = true;
};
crateLetters.src = './assets/menu/lettering-arsenal.webp';
const crateLabelPoint = new V3(), crateBasePoint = new V3(), crateLabelLeft = new V3(), crateLabelRight = new V3();
const stageShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), new THREE.MeshBasicMaterial({
  map: canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64); g.addColorStop(0, '#24160cc0'); g.addColorStop(1, '#24160c00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  }), transparent: true, depthWrite: false,
}));
stageShadow.rotation.x = -Math.PI / 2; stageShadow.position.y = -0.012; menuStage.add(stageShadow);
const crateContactShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), stageShadow.material.clone());
crateContactShadow.rotation.x = -Math.PI / 2;
crateContactShadow.position.set(.08, -.98, .05); menuStage.add(crateContactShadow);
const wardrobeShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.05, .65), stageShadow.material.clone());
wardrobeShadow.rotation.x = -Math.PI / 2; wardrobeShadow.position.set(1.45, -.98, .38); menuStage.add(wardrobeShadow);
const crateEndPosition = new V3(), crateEndLook = new V3(), crateLookMatrix = new THREE.Matrix4(), crateEndQuaternion = new THREE.Quaternion();
const crateEase = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function updateCrateJourney(dt) {
  const trip = crateJourney;
  if (trip.phase === 'closed') { menuActorRoot.position.set(0, 0, 0); stageShadow.material.opacity = 1; return; }
  const reducedMotion = prefersReducedMotion.matches;
  const direction = trip.target ? 1 : -1;
  trip.progress = reducedMotion ? trip.target : clamp(trip.progress + direction * dt / 1.85, 0, 1);
  const p = trip.progress, dressing = trip.view === 'operator';
  // O Docão dá espaço à tampa antes de a câmera descer.
  const step = dressing ? 0 : crateEase(p / .24);
  stageShadow.material.opacity = 1 - step;
  menuActorRoot.position.set(1.75 * step, -.94 * step, -.8 * step).applyAxisAngle(new V3(0, 1, 0), menuStage.rotation.y);
  const opening = crateEase((p - .14) / .38);
  crateLid.rotation.x = dressing ? 0 : -1.95 * opening;
  wardrobeCase.userData.door.rotation.y = dressing ? -1.95 * opening : 0;
  const dive = crateEase((p - .32) / .68);
  if (dressing) {
    crateEndPosition.set(0, .42, .035).applyMatrix4(wardrobeCase.matrixWorld);
    crateEndLook.set(0, .42, -.16).applyMatrix4(wardrobeCase.matrixWorld);
  } else {
    crateEndPosition.set(0, -.23, .21).applyMatrix4(menuStage.matrixWorld);
    crateEndLook.set(0, -.79, -.37).applyMatrix4(menuStage.matrixWorld);
  }
  crateLookMatrix.lookAt(crateEndPosition, crateEndLook, camera.up); crateEndQuaternion.setFromRotationMatrix(crateLookMatrix);
  camera.position.lerpVectors(trip.homePosition, crateEndPosition, dive);
  camera.quaternion.copy(trip.homeQuaternion).slerp(crateEndQuaternion, dive);
  camera.near = THREE.MathUtils.lerp(trip.homeNear, dressing ? .015 : .1, dive);
  camera.setViewOffset(innerWidth, innerHeight, trip.homeOffset * innerWidth * (1 - dive), 0, innerWidth, innerHeight);
  if (trip.target && p === 1 && trip.phase === 'opening') {
    trip.phase = 'inside'; $('menu').dataset.crateState = 'inside';
    crateMenuBusy(false); setMenuView(trip.view);
    $('menuBack').textContent = dressing ? '← FECHAR MALA' : '← FECHAR CAIXA';
  } else if (!trip.target && p === 0) {
    trip.phase = 'closed'; delete $('menu').dataset.crateState; delete $('menu').dataset.container;
    crateMenuBusy(false); setMenuView(trip.nextView);
    $('menuBack').textContent = '← VOLTAR À PARTIDA';
    menuActorRoot.position.set(0, 0, 0);
  }
}
const showcase = new THREE.Group(); showcase.position.set(0, 3, 0); scene.add(showcase);
const wardrobePreviewScene = new THREE.Scene();
wardrobePreviewScene.add(new THREE.HemisphereLight(0xffedca, 0x46573a, 2.1));
const wardrobePreviewLight = new THREE.DirectionalLight(0xffd79b, 2.4);
wardrobePreviewLight.position.set(-3, 7, 5); wardrobePreviewScene.add(wardrobePreviewLight);
const wardrobePreviewCamera = new THREE.PerspectiveCamera(38, 1, .1, 20);
wardrobePreviewCamera.position.set(0, 1.05, 4.5); wardrobePreviewCamera.lookAt(0, 1.05, 0);
const wardrobePreviewPosition = new V3(), wardrobePreviewRotation = new THREE.Quaternion();
let wardrobePreviewRenderer = null;
let wardrobePreviewWidth = 0, wardrobePreviewHeight = 0;
function renderWardrobePreview() {
  if (crateJourney.phase !== 'inside' || crateJourney.view !== 'operator') return;
  if (!wardrobePreviewRenderer) {
    wardrobePreviewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    wardrobePreviewRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    wardrobePreviewRenderer.domElement.setAttribute('aria-hidden', 'true');
    $('wardrobePreview').appendChild(wardrobePreviewRenderer.domElement);
  }
  const rect = $('wardrobePreview').getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  wardrobePreviewPosition.copy(showcase.position); wardrobePreviewRotation.copy(showcase.quaternion);
  wardrobePreviewScene.add(showcase); showcase.position.set(0, 0, 0); showcase.rotation.set(0, .12 + Math.sin(menuT * 1.8) * .1, 0);
  wardrobePreviewCamera.aspect = rect.width / rect.height; wardrobePreviewCamera.updateProjectionMatrix();
  if (wardrobePreviewWidth !== rect.width || wardrobePreviewHeight !== rect.height) {
    wardrobePreviewRenderer.setSize(rect.width, rect.height, false);
    wardrobePreviewWidth = rect.width; wardrobePreviewHeight = rect.height;
  }
  wardrobePreviewRenderer.render(wardrobePreviewScene, wardrobePreviewCamera);
  menuActorRoot.add(showcase); showcase.position.copy(wardrobePreviewPosition); showcase.quaternion.copy(wardrobePreviewRotation);
}
let selectedSkin = getSkin(localStorage.getItem('docao.skin') || DEFAULT_SKIN).id, preview = null;
// loadout: arma primária escolhida (salva no navegador)
let selectedPrimary = (() => { const v = parseInt(localStorage.getItem('docao.primary')); return PRIMARIES.includes(v) ? v : 0; })();
let selectedSecondary = (() => { const v = parseInt(localStorage.getItem('docao.secondary')); return SECONDARIES.includes(v) ? v : PISTOL; })();
let selectedMelee = (() => { const v = parseInt(localStorage.getItem('docao.melee')); return MELEES.includes(v) ? v : KNIFE; })();
let saberColor = (() => { try { const v = localStorage.getItem('docao.saber'); if (SABER_COLORS.some((c) => c.hex === v)) return v; } catch (e) { /* sem storage */ } return SABER_COLORS[0].hex; })();
function paintSabers() {
  if (fp.guns[SABER]) setSaberColor(fp.guns[SABER], saberColor);
  for (const e of entities) if (e.model && e.model.guns[SABER]) setSaberColor(e.model.guns[SABER], saberColor);
}
function buildSaberColors() {
  const row = $('saberColors'); if (!row) return;
  row.innerHTML = '';
  for (const c of SABER_COLORS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'saberchip'; b.title = c.id; b.style.background = c.hex;
    b.classList.toggle('active', c.hex === saberColor);
    b.onclick = () => {
      saberColor = c.hex; try { localStorage.setItem('docao.saber', saberColor); } catch (e) { /* sem storage */ }
      document.querySelectorAll('.saberchip').forEach((el) => el.classList.toggle('active', el.title === c.id));
      paintSabers();
    };
    row.appendChild(b);
  }
  paintSabers();
  const wrap = $('saberRow'); if (wrap) wrap.hidden = selectedMelee !== SABER;
}
function primChip(i, keyHint, onPick, kind) {
  const w = WEAPONS[i]; const b = document.createElement('button'); b.className = 'primchip'; b.dataset.i = i; b.dataset.pick = kind || 'primary';
  const name = w.key === 'shotgun' ? 'Calibre 12 Chiqueiro' : w.name;
  b.innerHTML = `${keyHint ? `<kbd>[${keyHint}]</kbd>` : ''}<span class="wthumb" data-w="${i}"></span><span class="wtxt">${escapeHtml(name)}<small>${escapeHtml(w.desc)}</small></span>`;
  if (weaponThumbs[i]) b.querySelector('.wthumb').style.backgroundImage = `url("${weaponThumbs[i]}")`;
  b.onclick = () => onPick(i); return b;
}
function markPick(kind, i) {
  document.querySelectorAll(`.primchip[data-pick="${kind}"]`).forEach((c) => c.classList.toggle('active', +c.dataset.i === i));
}
// ---------------- Treino (Estande do Docão) ----------------
// B / N / M: próxima primária / secundária / faca-sabre, na hora e com pente cheio (online o servidor faz o mesmo ao receber 'pr')
function trainSwap(code) {
  const p = player, cyc = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];
  let w;
  if (code === 'KeyB') { setPrimary(cyc(PRIMARIES, selectedPrimary)); w = selectedPrimary; }
  else if (code === 'KeyN') { setSecondary(cyc(SECONDARIES, selectedSecondary)); w = selectedSecondary; }
  else { setMelee(cyc(MELEES, selectedMelee)); w = selectedMelee; }
  const old = p.slots; p.primary = selectedPrimary; p.secondary = selectedSecondary; p.melee = selectedMelee; p.slots = [p.primary, p.secondary, p.melee];
  for (const i of p.slots) if (!old.includes(i)) { p.mag[i] = WEAPONS[i].mag; p.reserve[i] = WEAPONS[i].reserve; }
  p.reloadEnd = 0; p.knifeMode = false; switchWeapon(p, w); if (p.weapon !== w) setWeapon(p, w);
  flashMsg(`${WEAPONS[w].name} · ${WEAPONS[w].desc}`);
}
// munição de reserva infinita e Copo Bomba/fumaça/atordoamento voltam sozinhos (offline e online; online o servidor confere)
function trainRefill() {
  const p = player; if (!p || !p.alive) return;
  for (const i of p.slots) p.reserve[i] = WEAPONS[i].reserve;
  if (p.nades < NADE.max && gameTime - (p.lastNadeT ?? -9) > TRAIN.nadeRefill + 0.25 && !p.charging) p.nades = NADE.max;
  if (!online) { p.smokeNades = Math.max(p.smokeNades || 0, 1); p.stunNades = Math.max(p.stunNades || 0, 1); }
}
// número de dano subindo em cima do alvo (amarelo = cabeça) + painel "último acerto"
const dmgPops = [];
function dmgPopup(t, amount, head) {
  const n = Math.round(amount); if (!(n > 0) || !t.pos) return;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const x = cv.getContext('2d');
  x.font = '900 64px "Arial Black", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#2a1410';
  const txt = head ? `${n}!` : String(n); x.strokeText(txt, 128, 52); x.fillStyle = head ? '#ffd23a' : '#ffffff'; x.fillText(txt, 128, 52);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  sp.renderOrder = 999; const s = head ? 0.085 : 0.065; sp.scale.set(s * 2.67, s, 1);
  sp.position.set(t.pos.x + rand(-0.35, 0.35), t.pos.y + 2.3 + rand(0, 0.25), t.pos.z); scene.add(sp); dmgPops.push({ sp, born: gameTime, vy: 1.1 });
  const d = player ? Math.round(Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z)) : 0;
  const tot = (t.trainTot && gameTime - t.trainLast < 3 ? t.trainTot : 0) + n; t.trainTot = tot; t.trainLast = gameTime;
  const el = $('trainInfo'); if (el) { el.classList.remove('hidden'); el.innerHTML = `Último: <b class="${head ? 'hd' : ''}">${n}</b> ${head ? 'CABEÇA' : 'corpo'} · ${d} m · ${escapeHtml(t.name)} · seguidos: <b>${tot}</b>`; }
}
function updateDmgPops(dt) {
  for (let i = dmgPops.length - 1; i >= 0; i--) {
    const q = dmgPops[i], age = gameTime - q.born; q.sp.position.y += q.vy * dt; q.sp.material.opacity = Math.max(0, 1 - Math.max(0, age - 0.5) / 0.4);
    if (age > 0.9 || age < 0) { scene.remove(q.sp); q.sp.material.map.dispose(); q.sp.material.dispose(); dmgPops.splice(i, 1); }
  }
}
function sendLoadout() { if (online) netEv(['pr', selectedPrimary, selectedSecondary, selectedMelee]); }
function setPrimary(i) {
  selectedPrimary = i; try { localStorage.setItem('docao.primary', String(i)); } catch (e) { /* sem storage */ }
  if (player) player.nextPrimary = i;
  if (player && !player.alive) { spawnHold = 'primary'; buildDeathSec(); }
  sendLoadout();
  markPick('primary', i);
}
function setSecondary(i) {
  selectedSecondary = i; try { localStorage.setItem('docao.secondary', String(i)); } catch (e) { /* sem storage */ }
  if (player) player.nextSecondary = i;
  sendLoadout();
  markPick('secondary', i);
  buildDeathSec();
}
function setMelee(i) {
  selectedMelee = i; try { localStorage.setItem('docao.melee', String(i)); } catch (e) { /* sem storage */ }
  if (player) player.nextMelee = i;
  sendLoadout();
  markPick('melee', i);
  const row = $('saberRow'); if (row) row.hidden = i !== SABER;
  buildDeathMelee();
}
function buildPrimaryPickers() {
  const l = $('primList'), d = $('deathList'); l.innerHTML = d.innerHTML = '';
  for (const cat of CATEGORIES) {
    const box = document.createElement('div'); box.className = 'wcat';
    const title = document.createElement('div'); title.className = 'label2'; title.textContent = cat.title; box.appendChild(title);
    const grid = document.createElement('div'); grid.className = 'wgrid' + (cat.weapons.length < 3 || cat.id === 'secundaria' ? ' small' : '');
    const onPick = cat.pick === 'secondary' ? setSecondary : cat.pick === 'melee' ? setMelee : setPrimary;
    for (const i of cat.weapons) grid.appendChild(primChip(i, '', onPick, cat.pick));
    box.appendChild(grid);
    if (cat.id === 'faca') { const row = $('saberRow'); if (row) box.appendChild(row); }
    l.appendChild(box);
    if (cat.pick === 'primary') cat.weapons.forEach((i) => d.appendChild(primChip(i, PRIMARIES.indexOf(i) + 1, setPrimary, 'primary')));
  }
  markPick('primary', selectedPrimary); markPick('secondary', selectedSecondary); markPick('melee', selectedMelee);
  const row = $('saberRow'); if (row) row.hidden = selectedMelee !== SABER;
  buildDeathSec(); buildDeathMelee();
}
function setPreview(id) {
  selectedSkin = getSkin(id).id; try { localStorage.setItem('docao.skin', selectedSkin); } catch (e) { /* sem storage */ }
  if (preview) showcase.remove(preview.group);
  preview = makeDocao(selectedSkin, { withGun: false, pose: 'idle' }); showcase.add(preview.group);
  $('skinName').textContent = getSkin(selectedSkin).name;
  $('wardrobePreview').setAttribute('aria-label', `Prévia do visual ${getSkin(selectedSkin).name}`);
  $('skinIdx').textContent = `${SKINS.findIndex((s) => s.id === selectedSkin) + 1}/${SKINS.length}`;
  document.querySelectorAll('.skinchip').forEach((c) => c.classList.toggle('active', c.dataset.id === selectedSkin));
}
function buildSkinPicker() {
  const list = $('skinList'); list.innerHTML = '';
  for (const sk of SKINS) {
    const b = document.createElement('button'); b.className = 'skinchip'; b.dataset.id = sk.id; b.title = sk.name;
    const base = sk.shirt && sk.shirt.color ? sk.shirt.color : '#d8261c'; const acc = (sk.parts || []).find((p) => p.color);
    b.style.background = acc ? `linear-gradient(180deg, ${acc.color} 0 45%, ${base} 45% 100%)` : base; b.onclick = () => setPreview(sk.id); list.appendChild(b);
  }
  const step = (d) => { const i = SKINS.findIndex((s) => s.id === selectedSkin); setPreview(SKINS[(i + d + SKINS.length) % SKINS.length].id); };
  $('skinPrev').onclick = () => step(-1); $('skinNext').onclick = () => step(1);
}
const weaponThumbs = [];
buildSkinPicker(); setPreview(selectedSkin); buildPrimaryPickers(); buildSaberColors();
function paintWeaponThumbs() {
  document.querySelectorAll('.wthumb').forEach((el) => {
    const url = weaponThumbs[+el.dataset.w];
    if (url) el.style.backgroundImage = `url("${url}")`;
  });
}
function makeWeaponThumbs() {
  let i = 0;
  const next = () => {
    if (i >= fp.guns.length) { paintWeaponThumbs(); window.__gunThumbs = weaponThumbs.length; return; }
    try { weaponThumbs[i] = renderWeaponThumb(fp.guns[i]); } catch (e) { console.warn('miniatura da arma', i, e); }
    i++; requestAnimationFrame(next);
  };
  requestAnimationFrame(next);
}
makeWeaponThumbs();

// ---------------- Mapas ----------------
let navMs = 0, showBaseY = 3, menuPreviewX = 0, showCamYaw = 0;
// câmera da vitrine: por padrão olha o Docão de frente (+Z), mas se tiver parede/ônibus/casa no caminho (ex.: Vizinhança Cheers,
// onde a câmera ficava dentro do ônibus e o menu mostrava só um fundo escuro) gira em volta até achar um ângulo livre.
function pickShowcaseCam() {
  const sp = showcase.position, head = new V3(sp.x, showBaseY + 1.0, sp.z);
  for (const a of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5, Math.PI]) {
    const far = new V3(sp.x + Math.sin(a) * 4.6, showBaseY + 1.25, sp.z + Math.cos(a) * 4.6);
    if (losClear(head, far)) { showCamYaw = a; return; }
  }
  showCamYaw = 0;
}
function loadMap(id) {
  const map = getMap(id);
  if (currentMap === map && worldGroup) return map;
  if (worldGroup) { scene.remove(worldGroup); disposeWorld(worldGroup); }
  for (const p of pickups) scene.remove(p.mesh); pickups.length = 0;
  const w = buildWorld(map); worldGroup = w.group; scene.add(worldGroup);
  solids = w.solids; worldMeshes = w.meshes; mapBounds = map.size; indexSolids();
  applyPalette(scene, hemi, sun, map); fpHemi.intensity = map.palette.stars ? 1.25 : 1.8;
  SPAWNS = map.spawns.map(([x, z, y = 0]) => new V3(x, groundAt(x, z, y + 0.3), z));
  for (const [t, x, z, y] of map.pickups) makePickup(t, x, z, y || 0);
  pickups.forEach((p) => (p.mesh.visible = state !== 'menu'));
  const t0 = performance.now();
  nav = buildNav({ hx: map.size[0], hz: map.size[1], spacing: map.navSpacing || 2, collides, groundAt, solids, topAt, seeds: SPAWNS.map((s) => [s.x, s.y, s.z]), extra: map.waypoints || [] });
  navMs = performance.now() - t0;
  showcase.position.set(...map.showcase); showBaseY = map.showcase[1]; pickShowcaseCam();
  currentMap = map; return map;
}
// seletor: mapa salvo no navegador ('random' = aleatório a cada partida)
let selectedMap = (() => { const v = localStorage.getItem('docao.map'); return v === 'random' || PLAY_MAPS.some((m) => m.id === v) ? v : MAPS[0].id; })();
const thumbs = {};
function mapCard(id) {
  const b = document.createElement('button'); b.className = 'mapcard' + (id === 'random' ? ' random' : ''); b.dataset.map = id;
  const m = id === 'random' ? null : getMap(id);
  b.innerHTML = `<span class="thumb">${m ? '' : '?'}</span><span class="mtxt"><b>${m ? escapeHtml(m.name) : 'Aleatório'}</b><small>${m ? escapeHtml(m.desc) : 'Um mapa diferente sorteado a cada partida.'}</small></span>`;
  if (m && thumbs[id]) b.querySelector('.thumb').style.backgroundImage = `url(${thumbs[id]})`;
  b.onclick = () => { selectMap(id); $('mapModal').classList.add('hidden'); };
  return b;
}
function refreshMapUI() {
  const m = selectedMap === 'random' ? null : getMap(selectedMap);
  $('mapName').textContent = m ? m.name : 'Aleatório'; $('mapDesc').textContent = m ? m.desc : 'Um mapa diferente sorteado a cada partida.';
  const th = $('mapBtn').querySelector('.thumb'); th.textContent = m ? '' : '?'; th.style.backgroundImage = m && thumbs[m.id] ? `url(${thumbs[m.id]})` : '';
  th.classList.toggle('rnd', !m);
  document.querySelectorAll('#mapGrid .mapcard').forEach((c) => c.classList.toggle('active', c.dataset.map === selectedMap));
}
function selectMap(id) {
  selectedMap = id; try { localStorage.setItem('docao.map', id); } catch (e) { /* sem storage */ }
  if (id !== 'random') loadMap(id);
  refreshMapUI();
}
function buildMapGrid() { const g = $('mapGrid'); g.innerHTML = ''; for (const m of PLAY_MAPS) g.appendChild(mapCard(m.id)); g.appendChild(mapCard('random')); refreshMapUI(); }
function makeThumbs() { // miniaturas renderizadas da vista aérea, uma por quadro pra não travar o menu
  let i = 0; const next = () => {
    if (i >= MAPS.length) { buildMapGrid(); window.__thumbsReady = true; return; }
    const m = MAPS[i++]; try { thumbs[m.id] = renderThumb(m); } catch (e) { console.warn('miniatura', m.id, e); }
    refreshMapUI(); requestAnimationFrame(next);
  }; requestAnimationFrame(next);
}
function pickMapForMatch() {
  if (selectedMap !== 'random') return selectedMap;
  const pool = PLAY_MAPS.filter((m) => !currentMap || m.id !== currentMap.id); return pool[Math.floor(Math.random() * pool.length)].id;
}
$('mapBtn').onclick = () => { buildMapGrid(); $('mapModal').classList.remove('hidden'); };
$('mapClose').onclick = () => $('mapModal').classList.add('hidden');
loadMap(selectedMap === 'random' ? MAPS[0].id : selectedMap); buildMapGrid(); makeThumbs();

function clearBots() {
  for (const e of entities) if (e.model) scene.remove(e.model.group); entities = [];
  for (const n of grenades) scene.remove(n.mesh); grenades.length = 0; for (const r of rockets) scene.remove(r.mesh); rockets.length = 0; for (const p of particles) scene.remove(p.mesh); particles.length = 0; shake = 0;
  clearStrikes();
  clearTacticals();
  clearHeli();
  clearBacon(); if (ghost) ghost.model.group.visible = false;
  for (const q of dmgPops) scene.remove(q.sp); dmgPops.length = 0; $('trainInfo').classList.add('hidden');
}
function cycleExplorePrimary(dir) {
  if (!exploreMode() || !player || !player.alive) return;
  const cur = PRIMARIES.indexOf(player.primary);
  const i = PRIMARIES[(cur + dir + PRIMARIES.length) % PRIMARIES.length];
  setPrimary(i);
  player.primary = player.nextPrimary = i;
  player.slots[0] = i;
  player.mag[i] = WEAPONS[i].mag; player.reserve[i] = WEAPONS[i].reserve;
  player.reloadEnd = 0;
  if (player.weapon !== i) switchWeapon(player, i); else setWeapon(player, i);
  flashMsg(WEAPONS[i].name);
}
function startGame(mapId) {
  resetAds();
  initAudio();
  loadMap($('modeSel').value === TRAIN.mode ? TRAIN.map : typeof mapId === 'string' ? mapId : pickMapForMatch());
  const name = myName(); saveName(name);
  sens = parseFloat($('sens').value) || 1.4; sensAds = parseFloat($('sensAds').value) || 1;
  try { localStorage.setItem('docao.sens', String(sens)); localStorage.setItem('docao.sensAds', String(sensAds)); } catch (e) { /* sem storage */ }
  revengeName = null; resetFeedback(); resetRewards(); resetMatchCamos();
  clearBots(); gameTime = 0;
  player = makeEntity(name, true, selectedSkin, '#ffd27a'); entities.push(player); fp.setSkin(selectedSkin);
  const picked = $('modeSel').value;
  mode = picked === 'dom' || picked === 'explore' || picked === TRAIN.mode ? picked : 'dm'; teamScore = [0, 0]; zone = null; window.__capLog = []; offlineMinutes = normTime($('timeSel').value);
  if (training()) (currentMap.dummies || []).forEach((d, i) => { const b = makeEntity(d.name, false, SKINS[Math.floor(Math.random() * SKINS.length)].id, TAG_COLORS[i % TAG_COLORS.length]); b.dummy = d; entities.push(b); });
  else { const n = exploreMode() ? 0 : (parseInt($('botCount').value, 10) || 5);
    for (let i = 0; i < n; i++) entities.push(makeEntity(BOT_DEFS[i].name, false, SKINS[Math.floor(Math.random() * SKINS.length)].id, TAG_COLORS[i % TAG_COLORS.length])); }
  if (teamMode()) { // seu time (escolhido no menu ou automático); bots completam os dois lados
    applyTeam(player, menuTeam >= 0 ? menuTeam : Math.random() < 0.5 ? 0 : 1);
    for (const b of entities) if (!b.isPlayer) { const c = [0, 0]; for (const x of entities) if (x.team === 0 || x.team === 1) c[x.team]++; applyTeam(b, smallerTeam(c)); }
    zone = newZoneState(pickZone(nav));
  } else for (const e of entities) applyTeam(e, -1);
  for (const e of entities) e.caps = 0;
  for (const e of entities) { e.alive = false; }
  for (const e of entities) respawn(e);
  pickups.forEach((p) => { p.active = true; p.mesh.visible = true; });
  showcase.visible = false;
  $('killfeed').innerHTML = ''; flashMsg(exploreMode() ? `Exploração · ${currentMap.name} · , . ou [ ] trocam a primária` : teamMode() ? `Dominação · você é do time ${TEAM_NAMES[player.team]}` : training() ? 'Estande do Docão · B/N/M trocam a arma' : `Mapa: ${currentMap.name}`); refreshModeHud();
  $('menu').classList.add('hidden'); $('gameover').classList.add('hidden'); $('pause').classList.add('hidden'); $('hud').classList.remove('hidden'); $('socialHud').classList.add('hidden'); $('overChat').classList.add('hidden');
  camera.clearViewOffset(); state = 'playing'; lockPointer();
}
function endGame() {
  resetAds();
  if (state === 'over') return;
  state = 'over'; mouseDown = false; rightDown = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const rows = [...entities].sort((a, b) => scoreOf(b) - scoreOf(a) || a.deaths - b.deaths);
  if (teamMode()) { const w = teamScore[0] > teamScore[1] ? 0 : teamScore[1] > teamScore[0] ? 1 : -1; setTeamWinner(w); }
  else $('winner').textContent = rows[0].isPlayer ? 'Você venceu! 🏆' : `${rows[0].name} venceu!`;
  $('finalboard').innerHTML = boardHtml();
  const nm = PLAY_MAPS[(PLAY_MAPS.indexOf(currentMap) + 1) % PLAY_MAPS.length]; $('overMap').innerHTML = `Mapa: <b>${escapeHtml(currentMap.name)}</b> · próximo: <b>${escapeHtml(nm.name)}</b>`;
  ['againBtn', 'nextMapBtn'].forEach((id) => $(id).classList.remove('hidden')); $('overWait').classList.add('hidden');
  $('overChat').classList.add('hidden');
  $('gameover').classList.remove('hidden'); $('tabboard').classList.add('hidden');
}
function setTeamWinner(w) {
  const el = $('winner'); el.style.color = w >= 0 ? TEAM_COLORS[w] : '';
  el.textContent = w < 0 ? `Empate! ${teamScore[0]} × ${teamScore[1]}` : `Time ${TEAM_NAMES[w]} venceu! ${teamScore[0]} × ${teamScore[1]}${player && player.team === w ? ' 🏆' : ''}`;
}
function refreshModeHud() {
  $('domhud').classList.toggle('hidden', !teamMode());
  if (teamMode() && player) { $('myTeam').textContent = `Você: Time ${TEAM_NAMES[player.team] || '?'}`; $('myTeam').style.color = TEAM_COLORS[player.team] || '#fff'; }
  $('winner').style.color = '';
}
function pause() { if (state !== 'playing') return; state = 'paused'; mouseDown = false; rightDown = false; keys.Space = keys.ShiftLeft = keys.ShiftRight = false; resetAds(); if (player) { player.charging = false; player.bowDraw = 0; arcLine.visible = arcMark.visible = false; } if (pickingStrike) { pickingStrike = false; closeStrikeMap(); } $('pauseInvite').classList.toggle('hidden', !online); $('pauseVoice').classList.toggle('hidden', !online); $('pause').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); }
function resume() { $('pause').classList.add('hidden'); state = 'playing'; lockPointer(); }
function toMenu() {
  if (online) leaveOnline();
  zone = null; mode = 'dm'; $('domhud').classList.add('hidden'); $('zoneMark').classList.add('hidden'); $('teamPick').classList.add('hidden');
  state = 'menu'; clearBots(); if (selectedMap !== 'random') loadMap(selectedMap); showcase.visible = true; pickups.forEach((p) => (p.mesh.visible = false)); camera.clearViewOffset();
  ['pause', 'gameover', 'hud'].forEach((id) => $(id).classList.add('hidden')); $('menu').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
// pede o pointer lock DENTRO do gesto do usuário (clique/tecla). Se o navegador recusar, mostra o aviso e o próximo clique no jogo tenta de novo.
const RELOCK_MSG = 'Clique pra voltar a mirar';
function lockPointer() {
  window.__lockCalls = (window.__lockCalls || 0) + 1;
  const fail = () => { if (state === 'playing' && player && player.alive && document.pointerLockElement !== canvas) flashMsg(RELOCK_MSG); };
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(fail); } catch (e) { fail(); }
}

$('playBtn').onclick = () => startGame(); $('menuBtn').onclick = toMenu;
$('resumeBtn').onclick = resume; $('quitBtn').onclick = toMenu;
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); e.stopPropagation(); });

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { hadLock = true; deathUnlock = false; chatNoteLocked(); if ($('centermsg').textContent === RELOCK_MSG) { $('centermsg').textContent = ''; msgTimer = 0; } }
  else if (state === 'playing' && hadLock && !deathUnlock && !pickingStrike && !chatConsumeUnlock()) pause(); // soltar o mouse ao morrer, no chat ou pra escolher o míssil, não pausa
});
document.addEventListener('mousemove', (e) => {
  if (state !== 'playing' || document.pointerLockElement !== canvas || !player) return;
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return; // ignora saltos espúrios do pointer lock
  if (predator && predator.phase === 'fly') {
    predator.yaw -= e.movementX * 0.0022;
    predator.pitch = clamp(predator.pitch - e.movementY * 0.002, -1.2, 0.22);
    return;
  }
  if (predator) return;
  const s = sens * (ads > 0.2 ? sensAds : 1) * (camera.fov / BASE_FOV); // mirando usa o slider "Mirando"; o zoom ainda deixa o mouse mais lento
  player.yaw -= e.movementX * 0.0015 * s; player.pitch = clamp(player.pitch - e.movementY * 0.0015 * s, -1.5, 1.5);
});
canvas.addEventListener('mousedown', (e) => {
  if (state !== 'playing') return;
  if (!$('teamPick').classList.contains('hidden')) return; // escolhendo time
  if (chatTyping()) closeChat(false);
  if (e.button === 2) e.preventDefault(); // senão o navegador solta o mouse ao abrir o menu
  if (e.button === 0 && (document.pointerLockElement || !deathUnlock)) { mouseDown = true; firedThisPress = false; }
  if (e.button === 2 && (document.pointerLockElement || !deathUnlock)) { rightDown = true; rightFired = false; rightStale = false; }
  if (!document.pointerLockElement) lockPointer();
});
// botão direito: mira (ADS) nas armas de fogo; com a faca na mão vira a estocada
let clickLatch = 0, rightDown = false, rightLatch = 0, rightFired = false, rightStale = false; // clique mais curto que um frame ainda dispara (máquinas lentas)
document.addEventListener('contextmenu', (e) => { if (state === 'playing' || document.pointerLockElement) e.preventDefault(); });
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) { if (mouseDown && !firedThisPress) clickLatch = performance.now(); mouseDown = false; }
  if (e.button === 2) { if (rightDown && !rightFired && !rightStale && player && player.weapon === KNIFE) rightLatch = performance.now(); rightDown = false; rightStale = false; }
});
document.addEventListener('wheel', (e) => { // rodinha: primária → pistola → faca (e volta)
  if (state !== 'playing' || !player || !player.alive) return;
  const S = player.slots, i = Math.max(0, S.indexOf(player.weapon)), n = S.length; switchWeapon(player, S[(i + (e.deltaY < 0 ? n - 1 : 1)) % n]);
});
function tryOpenChat(e) {
  if (!online || e.repeat || !chatShown() || !chatRoomOn() || state !== 'playing') return false;
  if (e.code === 'KeyT') { chatUseAll(); return openChat('all'); }
  if (e.code === 'KeyY' || e.code === 'KeyU') return openChat(socialTeam() ? 'team' : 'all');
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && player && player.alive) return openChat('all');
  return false;
}
document.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (chatTyping()) { if (e.code === 'Escape') { e.preventDefault(); closeChat(true); } return; }
  if (e.code === 'KeyK') voicePtt(true);
  if (e.code === 'KeyJ' && !e.repeat && online) { e.preventDefault(); voiceCycle(); }
  if (tryOpenChat(e)) { e.preventDefault(); return; }
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.code !== 'Space' || !e.repeat) keys[e.code] = true;
  if (state === 'playing' && player) {
    if (e.code === 'KeyR') startReload(player);
    if (!player.alive && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat && requestRespawn()) keys[e.code] = false; // Espaço não vira pulo ao renascer
    if (!player.alive && /^Digit[1-9]$/.test(e.code)) { const pick = PRIMARIES[+e.code.slice(5) - 1]; if (pick != null) setPrimary(pick); } // escolha na tela de morte
    else {
      if (e.code === 'Digit1') switchWeapon(player, player.slots[0]);
      if (e.code === 'Digit2') switchWeapon(player, player.slots[1]);
      if (e.code === 'Digit3') switchWeapon(player, player.slots[2]);
      if (e.code === 'KeyV' && !e.repeat) quickKnife(player);
      if (e.code === 'Digit4' && player.alive && !e.repeat) throwTactical('smoke');
      if (e.code === 'Digit5' && player.alive && !e.repeat) throwTactical('stun');
      if (e.code === 'KeyF' && player.alive && !e.repeat) useStreak();
      if (training() && player.alive && !e.repeat && (e.code === 'KeyB' || e.code === 'KeyN' || e.code === 'KeyM')) trainSwap(e.code);
      if (exploreMode() && player.alive && !e.repeat && (e.code === 'Comma' || e.code === 'Period' || e.code === 'BracketLeft' || e.code === 'BracketRight')) cycleExplorePrimary(e.code === 'Period' || e.code === 'BracketRight' ? 1 : -1);
    }
    if (e.code === 'KeyQ' && !e.repeat) startCharge();
    if (e.code === 'Tab') $('tabboard').classList.remove('hidden');
    if (e.code === 'Escape' || e.code === 'KeyP') pause();
  } else if (state === 'paused' && (e.code === 'KeyP')) resume();
});
document.addEventListener('keyup', (e) => { if (e.code === 'KeyK') voicePtt(false); keys[e.code] = false; if (e.code === 'KeyQ' && state === 'playing') releaseCharge(); if (e.code === 'Tab') $('tabboard').classList.add('hidden'); });
addEventListener('blur', () => { voicePtt(false); for (const k in keys) keys[k] = false; mouseDown = false; rightDown = false; if (player) { player.charging = false; player.bowDraw = 0; arcLine.visible = arcMark.visible = false; } });

// ---------------- Loop ----------------
const clock = new THREE.Clock(); let menuT = 0;
function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(clock.getDelta(), 0.05);
  if (window.__stopAt != null) dt = Math.max(0, Math.min(dt, window.__stopAt - gameTime)); // testes/screenshots: congela o tempo de jogo num instante exato
  if (state === 'playing' || (online && state === 'paused' && player)) { // online o jogo não pausa
    gameTime += dt;
    if (exploreMode() && player && player.alive) refillExplore(player);
    if (state === 'playing') updatePlayer(dt); else if (player.alive) { stepCrouch(player, 0, dt, PHYS); player.vel.x = player.vel.z = 0; moveEntity(player, dt); }
    if (online) netTick(dt);
    for (const e of entities) if (!e.isPlayer) updateBot(e, dt);
    updatePickups(dt); updateGrenades(dt); updateTacticals(dt); updateRockets(dt); updateStrikes(dt); updateParticles(dt); updateBacon(dt); updateBaconPickups(); if (training()) { trainRefill(); updateDmgPops(dt); } if (!online) for (const e of entities) regenStep(e, gameTime, dt); updateFP(dt); updateEffects(dt); updateShafts(dt); updateHud(dt); updateRewards(dt);
    updateDomOffline(dt); updateZoneGfx(dt);
    if (!online && !exploreMode() && gameTime >= matchLimit()) endGame();
  } else if (state === 'menu') {
    menuT += dt * 0.25;
    const sp = showcase.position; camera.position.set(sp.x + Math.sin(showCamYaw) * 3.5, showBaseY + 1.25, sp.z + Math.cos(showCamYaw) * 3.5); camera.lookAt(sp.x, showBaseY + 1.0, sp.z);
    // Docão da vitrine centralizado no espaço livre à direita do painel do menu (recalcula a cada frame: janela redimensionada,
    // menu mais largo com as 6 primárias...). Antes era um deslocamento fixo de 22% e, em janelas menores, a skin ficava atrás do menu.
    const pr = $('menu').classList.contains('hidden') || crateJourney.phase !== 'closed' ? null : $('menu').querySelector('.panel').getBoundingClientRect();
    const free = pr ? innerWidth - pr.right : innerWidth, cx = pr && free >= 200 ? pr.right + free * (innerWidth > 720 ? 0.42 : 0.5) : innerWidth * 0.72;
    const offX = innerWidth / 2 - cx; menuPreviewX = cx;
    if (!camera.view || !camera.view.enabled || Math.abs(camera.view.offsetX - offX) > 0.5 || camera.view.fullWidth !== innerWidth || camera.view.fullHeight !== innerHeight) camera.setViewOffset(innerWidth, innerHeight, offX, 0, innerWidth, innerHeight);
    showcase.rotation.y = showCamYaw + 0.15 + Math.sin(menuT * 1.8) * 0.12; showcase.position.y = showBaseY + (getSkin(selectedSkin).float ? 0.1 + Math.sin(menuT * 10) * 0.06 : Math.abs(Math.sin(menuT * 6)) * 0.06);
    for (const p of pickups) p.mesh.rotation.y += dt;
  }
  renderer.clear();
  const camO = window.__cam; // testes/screenshots: câmera livre { p: [x, y, z], t: [x, y, z], fov }
  if (camO) { camera.position.set(...camO.p); camera.lookAt(...camO.t); if (camO.fov && camera.fov !== camO.fov) { camera.fov = camO.fov; camera.updateProjectionMatrix(); } }
  if (state === 'menu' && !camO) {
    if (showcase.parent !== menuActorRoot) menuActorRoot.add(showcase);
    menuStage.position.set(showcase.position.x, showBaseY, showcase.position.z);
    menuStage.rotation.y = showCamYaw - 0.23;
    menuStage.updateMatrixWorld(true);
    updateCrateJourney(dt);
    camera.updateMatrixWorld(true);
    if (crateJourney.phase === 'closed') menuBackdrop.fit(showBaseY - .985);
    if (innerWidth > 720) {
      crateLabelPoint.set(0, -0.52, 0.65).applyMatrix4(menuStage.matrixWorld).project(camera);
      crateBasePoint.set(0, -0.97, 0.61).applyMatrix4(menuStage.matrixWorld).project(camera);
      crateLabelLeft.set(-0.6, -0.52, 0.65).applyMatrix4(menuStage.matrixWorld).project(camera);
      crateLabelRight.set(0.6, -0.52, 0.65).applyMatrix4(menuStage.matrixWorld).project(camera);
      const labelAngle = Math.atan2(-(crateLabelRight.y - crateLabelLeft.y) * innerHeight, (crateLabelRight.x - crateLabelLeft.x) * innerWidth) * 180 / Math.PI;
      const menuStyle = $('menu').style;
      menuStyle.setProperty('--crate-label-angle', `${labelAngle}deg`);
      wardrobeAnchor.set(0, .44, .17).applyMatrix4(wardrobeCase.matrixWorld).project(camera);
      menuStyle.setProperty('--wardrobe-x', `${(wardrobeAnchor.x + 1) * innerWidth / 2}px`);
      menuStyle.setProperty('--wardrobe-y', `${(1 - wardrobeAnchor.y) * innerHeight / 2}px`);
      wardrobeCorner.set(.39, .94, .17).applyMatrix4(wardrobeCase.matrixWorld).project(camera);
      const wardrobeTop = (1 - wardrobeCorner.y) * innerHeight / 2;
      wardrobeCorner.set(-.39, 0, .17).applyMatrix4(wardrobeCase.matrixWorld).project(camera);
      menuStyle.setProperty('--wardrobe-height', `${Math.max(60, (1 - wardrobeCorner.y) * innerHeight / 2 - wardrobeTop)}px`);
      menuStyle.setProperty('--wardrobe-width', `${Math.max(55, Math.abs(wardrobeCorner.x - wardrobeAnchor.x) * innerWidth * 1.08)}px`);
      menuStyle.setProperty('--arsenal-x', `${(crateLabelPoint.x + 1) * innerWidth / 2}px`);
      menuStyle.setProperty('--arsenal-y', `${(1 - crateLabelPoint.y) * innerHeight / 2}px`);
      menuStyle.setProperty('--crate-bottom', `${Math.min(innerHeight - 55, (1 - crateBasePoint.y) * innerHeight / 2)}px`);
    }
    renderer.render(menuScene, camera);
    renderWardrobePreview();
  } else {
    if (showcase.parent !== scene) scene.add(showcase);
    renderer.render(scene, camera);
  }
  if (state !== 'menu' && player && player.alive && !camO && !(predator && predator.phase === 'fly')) { renderer.clearDepth(); renderer.render(fpScene, fpCam); }
}
mountUav();
mountStreakUi();
if (!$('smokeVeil')) {
  const veil = document.createElement('div');
  veil.id = 'smokeVeil';
  veil.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none;background:radial-gradient(circle,rgba(210,214,216,.15),rgba(140,146,150,.86));opacity:0';
  document.body.appendChild(veil);
}
if (!$('stunFlash')) {
  const flash = document.createElement('div');
  flash.id = 'stunFlash';
  flash.style.cssText = 'position:fixed;inset:0;z-index:6;pointer-events:none;background:rgba(255,244,160,.92);opacity:0';
  document.body.appendChild(flash);
}
loop();


// ============================================================
//  Times, Dominação (zonas), placar no canto e tela de morte clicável
//  Regras em shared/domination.js (iguais no servidor).
// ============================================================
const outlineTeamCache = new Map();
function teamOutline(base, team) {
  const key = base.uuid + team; if (outlineTeamCache.has(key)) return outlineTeamCache.get(key);
  const m = base.clone(); m.onBeforeCompile = base.onBeforeCompile; const ck = base.customProgramCacheKey(); m.customProgramCacheKey = () => ck;
  m.color.setHex(TEAM_DARK[team]); outlineTeamCache.set(key, m); return m;
}
// cor do time: contorno, anel no pé e nome
function applyTeam(e, team) {
  e.team = team; if (!e.model) return;
  const on = teamMode() && (team === 0 || team === 1);
  e.model.group.traverse((o) => { if (!o.userData.isOutline) return; if (!o.userData.baseMat) o.userData.baseMat = o.material; o.material = on ? teamOutline(o.userData.baseMat, team) : o.userData.baseMat; });
  if (e.tagSprite) e.model.group.remove(e.tagSprite);
  e.tagSprite = nameSprite(e.name, on ? TEAM_COLORS[team] : e.tag); e.model.group.add(e.tagSprite);
  if (!e.teamRing) { e.teamRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); e.teamRing.rotation.x = -Math.PI / 2; e.teamRing.position.y = 0.04; e.model.group.add(e.teamRing); }
  e.teamRing.visible = on; if (on) e.teamRing.material.color.setHex(TEAM_HEX[team]);
}
// zona no mundo: anel no chão, coluna translúcida e disco de progresso
const zoneGfx = (() => {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const ring = new THREE.Mesh(new THREE.RingGeometry(DOM.RADIUS - 0.25, DOM.RADIUS, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(DOM.RADIUS, DOM.RADIUS, 7, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  col.position.y = 3.5; g.add(col);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(DOM.RADIUS - 0.3, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.06; g.add(fill);
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xffffff })); beacon.position.y = 7.6; g.add(beacon);
  return { g, ring, col, fill, beacon };
})();
function zoneColor(z) { return z.contested ? 0xffd27a : z.team >= 0 ? TEAM_HEX[z.team] : 0xffffff; }
function updateZoneGfx(dt) {
  const G = zoneGfx; G.g.visible = !!zone && state !== 'menu';
  if (!zone) { $('zoneMark').classList.add('hidden'); return; }
  G.g.position.set(zone.x, zone.y, zone.z); const c = zoneColor(zone);
  for (const m of [G.ring, G.col, G.fill, G.beacon]) m.material.color.setHex(c);
  G.fill.scale.setScalar(Math.max(0.001, zone.progress)); G.beacon.rotation.y += dt * 2; G.beacon.position.y = 7.6 + Math.sin(gameTime * 3) * 0.2;
  G.col.material.opacity = zone.contested ? 0.18 + Math.sin(gameTime * 12) * 0.06 : 0.13;
  // HUD
  const pct = Math.round(zone.progress * 100), cnt = zone.counts || [0, 0];
  $('zoneFill').style.width = pct + '%'; $('zoneFill').style.background = zone.team >= 0 ? TEAM_COLORS[zone.team] : '#888';
  $('zoneBar').classList.toggle('contested', !!zone.contested);
  $('zoneText').textContent = zone.contested ? `CONTESTADA! (${cnt[0]} × ${cnt[1]})` : zone.team >= 0 ? `Zona: ${pct}% ${TEAM_NAMES[zone.team]}${cnt[zone.team] ? ` · ${cnt[zone.team]} dentro` : ''}` : 'Zona neutra — entre pra capturar';
  $('ts0').textContent = teamScore[0]; $('ts1').textContent = teamScore[1];
  // marcador na tela / indicador fora da tela
  const mk = $('zoneMark'), wp = new V3(zone.x, zone.y + 3, zone.z), d = player ? Math.hypot(zone.x - player.pos.x, zone.z - player.pos.z) : 0;
  const inside = player && inZone(zone, player.pos);
  mk.classList.toggle('hidden', !player || state === 'over' || inside);
  const v = wp.clone().project(camera), behind = v.z > 1; let x = v.x, y = v.y;
  if (behind) { x = -x; y = -y; }
  const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.85;
  if (off) { const k = 0.9 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85, 1e-3); x *= k; y *= k; if (behind && Math.abs(y) < 0.85) y = -0.8; }
  let px = (x + 1) / 2 * innerWidth, py = (1 - y) / 2 * innerHeight;
  if (off) { const r = $('tl').getBoundingClientRect(); if (px < r.right + 30 && py < r.bottom + 30) { if (py < r.bottom + 30 && Math.abs(y) < 0.85) py = r.bottom + 40; else px = r.right + 40; } } // não cobre o placar
  mk.style.left = px + 'px'; mk.style.top = py + 'px';
  mk.style.color = '#' + c.toString(16).padStart(6, '0');
  mk.querySelector('.zarrow').style.transform = off ? `rotate(${Math.atan2(x, y)}rad)` : 'rotate(180deg)';
  $('zoneDist').textContent = Math.round(d) + ' m'; mk.dataset.off = off ? '1' : '0';
}
// Dominação offline: mesma regra do servidor
function updateDomOffline(dt) {
  if (!zone || online) return;
  const got = stepZone(zone, zoneCounts(zone, entities), dt);
  if (got >= 0) onZoneCaptured(got, null);
}
function onZoneCaptured(team, next, capsList) {
  if (!online) { teamScore[team]++; for (const e of entities) if (e.alive && e.team === team && inZone(zone, e.pos)) e.caps = (e.caps || 0) + 1; }
  const mine = player && player.team === team;
  flashMsg(`${mine ? 'Seu time' : 'Time ' + TEAM_NAMES[team]} capturou a zona! (${teamScore[0]} × ${teamScore[1]})`); (mine ? sfx.kill : sfx.die)(0.6);
  window.__capLog = (window.__capLog || []).concat([[team, teamScore[0], teamScore[1]]]);
  zone = newZoneState(next || pickZone(nav, zone));
  if (!online && teamScore[team] >= DOM.WIN_CAPS) endGame();
}
const scoreOf = (e) => (teamMode() ? e.kills + 2 * (e.caps || 0) : e.kills);
// placar compacto no canto superior esquerdo (offline e online)
let lbT = 0;
// duração da partida: online vem do servidor (start.limit); offline do select "Tempo" (0 = padrão do modo)
let offlineMinutes = 0;
function matchLimit() {
  if (training()) return Infinity; // Treino: não acaba
  if (online && online.limit) return online.limit;
  return offlineMinutes ? offlineMinutes * 60 : teamMode() ? DOM.TIME_LIMIT_DOM : TIME_LIMIT;
}
function updateLeaderboard(dt) {
  lbT -= dt; if (lbT > 0) return; lbT = 0.25;
  const rows = [...entities].sort((a, b) => scoreOf(b) - scoreOf(a) || a.deaths - b.deaths).slice(0, 10);
  const head = exploreMode() ? `<div class="lbh"><span>Exploração</span><span>só você</span></div>` : teamMode() ? `<div class="lbh"><span class="r">Vermelho ${teamScore[0]}</span><span>/${DOM.WIN_CAPS}</span><span class="b">${teamScore[1]} Azul</span></div>` : `<div class="lbh"><span>Placar</span><span>abates</span></div>`;
  $('lb').innerHTML = head + rows.map((e, i) => { const pid = online ? (e.isPlayer ? online.myId : (e.netId || 0)) : 0; return `<div class="row${e.isPlayer ? ' me' : ''}${e.alive ? '' : ' dead'}${pid && voiceTalking(pid) ? ' talking' : ''}${pid && voiceMuted(pid) ? ' vmuted' : ''}"${pid ? ` data-pid="${pid}"` : ''}><span>${i + 1}</span><span class="dot" style="background:${teamMode() && e.team >= 0 ? TEAM_COLORS[e.team] : e.shirt}"></span><span class="n">${escapeHtml(e.name)}</span><span class="k">${scoreOf(e)}</span></div>`; }).join('');
}
// botões de time (Vermelho / Azul / Automático)
function teamButtons(el, current, onPick, counts) { // atualiza no lugar: o lobby re-renderiza a cada ping e não pode engolir cliques
  const defs = [[0, 'Vermelho', 't0'], [1, 'Azul', 't1'], [-1, 'Automático', 'ta']];
  if (el.children.length !== 3) { el.innerHTML = ''; for (const [t, , cls] of defs) { const b = document.createElement('button'); b.className = `teambtn ${cls}`; b.dataset.team = t; el.appendChild(b); } }
  defs.forEach(([t, label, cls], i) => {
    const b = el.children[i], html = `${label}${counts && t >= 0 ? `<small>${counts[t]} jogador${counts[t] === 1 ? '' : 'es'}</small>` : t < 0 ? '<small>equilibra</small>' : ''}`;
    if (b.innerHTML !== html) b.innerHTML = html; b.className = `teambtn ${cls}${current === t ? ' active' : ''}`;
    b.onclick = (ev) => { ev.stopPropagation(); onPick(t); };
  });
}
let menuTeam = -1;
const MENU_RULES = {
  dm: 'Todos contra todos · vence quem fizer 20 abates ou liderar em 5 minutos',
  dom: 'Times · capture a zona · o primeiro a completar as capturas vence',
  treino: 'Estande do Docão: alvos que não atacam e voltam em 2 s. B/N/M trocam a arma, munição infinita, sem tempo.',
  explore: 'Mapa vazio, só você. Ande e teste as armas. Vírgula, ponto ou [ ] trocam a primária. Munição não acaba e a partida não termina.',
};
function refreshMenuMode() {
  const v = ['dom', 'explore', TRAIN.mode].includes($('modeSel').value) ? $('modeSel').value : 'dm';
  $('menuTrain').classList.toggle('hidden', v !== TRAIN.mode);
  $('menuTeam').classList.toggle('hidden', v !== 'dom');
  $('botCount').closest('label').classList.toggle('hidden', v === 'explore' || v === TRAIN.mode);
  $('timeSel').closest('label').classList.toggle('hidden', v === 'explore' || v === TRAIN.mode);
  const playTitle = v === 'explore' ? 'EXPLORAR' : v === TRAIN.mode ? 'TREINAR' : '<img class="menu-lettering" src="./assets/menu/lettering-jogar.webp" alt="Jogar">';
  const playHint = v === 'explore' ? 'SEM BOTS · SEM PRESSA' : v === TRAIN.mode ? 'ESTANDE · SEM LIMITE' : 'SOLO · CONTRA BOTS';
  $('playBtn').innerHTML = `<span class="play-title">${playTitle}</span><small>${playHint}</small>`;
  $('menuRules').textContent = MENU_RULES[v];
  teamButtons($('menuTeamBtns'), menuTeam, (t) => { menuTeam = t; refreshMenuMode(); });
}
$('modeSel').onchange = () => { try { localStorage.setItem('docao.mode', $('modeSel').value); } catch (e) { /* */ } refreshMenuMode(); };
try { const m = localStorage.getItem('docao.mode'); if (m === 'dom' || m === 'dm' || m === 'explore' || m === TRAIN.mode) $('modeSel').value = m; } catch (e) { /* */ }
$('timeSel').onchange = () => { try { localStorage.setItem('docao.time', $('timeSel').value); } catch (e) { /* */ } };
try { $('timeSel').value = String(normTime(localStorage.getItem('docao.time'))); } catch (e) { /* */ }
refreshMenuMode();
// tela de morte: primária e secundária clicáveis; solta o mouse ao morrer e trava de novo ao voltar
let deathUnlock = false;
function buildDeathSec() {
  const d = $('deathSec'); if (!d) return; d.innerHTML = '';
  for (const i of SECONDARIES) {
    const b = primChip(i, '', (picked) => { selectedSecondary = picked; try { localStorage.setItem('docao.secondary', String(picked)); } catch (e) { /* */ } if (player) player.nextSecondary = picked; spawnHold = 'secondary'; sendLoadout(); markPick('secondary', picked); buildDeathSec(); }, 'secondary');
    b.classList.toggle('active', i === selectedSecondary);
    b.querySelector('small').textContent = i === selectedSecondary && spawnHold === 'secondary' ? 'Renasce com ela na mão ✓' : 'Clique pra levar essa';
    d.appendChild(b);
  }
}
function buildDeathMelee() {
  const d = $('deathMelee'); if (!d) return; d.innerHTML = '';
  for (const i of MELEES) {
    const b = primChip(i, i === KNIFE ? 'V' : '', setMelee, 'melee');
    b.classList.toggle('active', i === selectedMelee);
    d.appendChild(b);
  }
}
// botão RENASCER: só libera depois de RESPAWN_TIME; online pede ao servidor ({t:'rs'}), que é quem decide
let rsSent = false;
const respawnReady = (p) => !!p && !p.alive && Number.isFinite(p.respawnAt) && gameTime >= p.respawnAt;
function updateRespawnBtn(p) {
  const b = $('respawnBtn'), ok = respawnReady(p) && !rsSent;
  const txt = rsSent ? 'Renascendo...' : ok ? 'RENASCER (Espaço)' : Number.isFinite(p.respawnAt) ? `Renascer em ${Math.max(0, p.respawnAt - gameTime).toFixed(1)}s` : 'Aguarde...';
  if (b.disabled === ok) b.disabled = !ok; if (b.textContent !== txt) b.textContent = txt; b.classList.toggle('ready', ok);
}
function requestRespawn() {
  const p = player; if (state !== 'playing' || !respawnReady(p) || rsSent) return false;
  lockPointer(); // primeiro, ainda dentro do gesto (clique em RENASCER ou Espaço/Enter): a mira volta na hora
  if (online) { rsSent = true; online.net.send({ t: 'rs' }); } else respawn(p);
  return true;
}
$('respawnBtn').onclick = (ev) => { ev.stopPropagation(); requestRespawn(); };
function onPlayerDeath() { rsSent = false; resetRewards(true); if (document.pointerLockElement) { deathUnlock = true; document.exitPointerLock(); } mouseDown = false; rightDown = false; if (player) player.bowDraw = 0; }
function onPlayerRespawn() { rsSent = false; deathCamState.on = false; if (ghost) ghost.model.group.visible = false;
  // o pointer lock é assíncrono: só avisa se ainda estiver sem mouse depois de um tempinho (o clique em RENASCER já pediu o lock)
  setTimeout(() => { if (!document.pointerLockElement && deathUnlock && state === 'playing' && player && player.alive) flashMsg(RELOCK_MSG); }, 600); }

// ============================================================
//  Online (Cloudflare Worker + Durable Object — ver server/ e net.js)
//  O servidor manda em acertos, dano, abates, placar, renascimento, pickups, Copo Bomba/foguetes e tempo.
//  Este cliente: move o próprio Docão (predição local), envia estado + eventos de tiro a SEND_HZ,
//  e desenha os outros com interpolação (INTERP_DELAY atrás do último pacote).
// ============================================================
const v3a = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
const a3v = (a) => new V3(a[0], a[1], a[2]);
function netEv(ev) { if (online) online.evq.push(ev); }
// tempo de servidor do que está sendo desenhado agora (interpolação) — vai junto do tiro pra compensação de lag exata
function renderServerT() {
  const M = online && online.tmap; if (!M || !M.length) return gameTime;
  const rt = performance.now() / 1000 - INTERP_DELAY;
  for (let i = M.length - 1; i > 0; i--) if (M[i - 1].t <= rt) { const a = M[i - 1], b = M[i], k = clamp((rt - a.t) / Math.max(1e-3, b.t - a.t), 0, 1.2); return a.T + (b.T - a.T) * k; }
  return M[0].T - (M[0].t - rt);
}
// ---------- nome do jogador: um só valor nos 3 campos (menu, janela online, lobby), salvo no navegador ----------
const NAME_FIELDS = ['nameInput', 'onlineName', 'lobbyName'];
function myName() { return cleanName($('nameInput').value); }
function saveName(n, from) {
  n = cleanName(n); for (const id of NAME_FIELDS) if (id !== from) $(id).value = n;
  try { localStorage.setItem('docao.name', n); } catch (e) { /* sem storage */ }
  return n;
}
function profile() { return { name: saveName(myName()), skin: selectedSkin, primary: selectedPrimary, secondary: selectedSecondary, melee: selectedMelee }; }
try { saveName(localStorage.getItem('docao.name') || $('nameInput').value); } catch (e) { saveName($('nameInput').value); }
for (const id of NAME_FIELDS) {
  const el = $(id); el.maxLength = NAME_MAX;
  el.addEventListener('input', () => { for (const o of NAME_FIELDS) if (o !== id) $(o).value = el.value; });
  el.addEventListener('change', () => { const n = saveName(el.value); el.value = n; if (id === 'lobbyName') sendName(); });
  el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && id === 'lobbyName') { el.blur(); } });
}
// lobby: manda o nome novo pro servidor (ele limpa e evita repetido, ex.: "Matheus (2)")
function sendName() { if (!online || !online.net) return; const n = saveName($('lobbyName').value); online.net.send({ t: 'prof', name: n, skin: selectedSkin, primary: selectedPrimary, secondary: selectedSecondary, melee: selectedMelee }); online.nameSent = n; }
$('lobbyNameBtn').onclick = () => sendName();
const roomLink = (code) => { const u = new URL(location.href); u.search = ''; const sv = new URLSearchParams(location.search).get('server'); if (sv) u.searchParams.set('server', sv); u.searchParams.set('sala', code); return u.toString(); };
function socialTeam() { if (!online) return false; const cfg = (online.lobby && online.lobby.cfg) || online.cfg; return !!(cfg && cfg.mode === 'dom'); }
function inviteBlurb(code) { return `Bora jogar Docão Shooter! Sala ${code}\n${roomLink(code)}`; }
function fillInvite(code) { const link = roomLink(code); document.querySelectorAll('.invite-link').forEach((el) => { el.value = link; }); }
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; } ta.remove(); return ok;
  }
}
function bindInvite(root) {
  const toast = root.querySelector('[data-toast]'); let timer = 0;
  const ping = (msg) => { toast.textContent = msg; clearTimeout(timer); timer = setTimeout(() => { if (toast.textContent === msg) toast.textContent = ''; }, 2200); };
  const code = () => (online && online.code) || '';
  root.querySelector('[data-act=link]').onclick = async () => { if (!code()) return; ping((await copyText(roomLink(code()))) ? 'Link copiado!' : 'Não deu para copiar'); };
  root.querySelector('[data-act=code]').onclick = async () => { if (!code()) return; ping((await copyText(code())) ? 'Código copiado!' : 'Não deu para copiar'); };
  root.querySelector('[data-act=wa]').onclick = () => { if (!code()) return; window.open('https://wa.me/?text=' + encodeURIComponent(inviteBlurb(code())), '_blank', 'noopener'); };
  root.querySelector('[data-act=tg]').onclick = () => { if (!code()) return; window.open('https://t.me/share/url?url=' + encodeURIComponent(roomLink(code())) + '&text=' + encodeURIComponent(inviteBlurb(code())), '_blank', 'noopener'); };
  root.querySelector('[data-act=slack]').onclick = async () => { if (!code()) return; await copyText(inviteBlurb(code())); ping('Mensagem copiada. Cole no Slack.'); window.open('slack://open'); };
  const native = root.querySelector('[data-act=native]');
  if (!navigator.share) native.classList.add('hidden');
  else { native.classList.remove('hidden'); native.onclick = async () => { if (!code()) return; try { await navigator.share({ title: 'Docão Shooter', text: inviteBlurb(code()), url: roomLink(code()) }); } catch (e) { /* cancelou */ } }; }
}

function joinRoom(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { $('onlineErr').textContent = 'O código tem 4 letras'; return; }
  if (online) leaveOnline(true);
  initAudio();
  online = { code, myId: 0, hostId: 0, ents: new Map(), evq: [], sendAcc: 0, cfg: null, lobby: null, inMatch: false, status: 'connecting' };
  online.net = new Net(code, profile(), { onMessage: onNetMessage, onStatus: onNetStatus });
  history.replaceState(null, '', roomLink(code));
  $('lobbyCode').textContent = code; fillInvite(code); chatClear(); voiceReset();
  $('lobbyPlayers').innerHTML = ''; $('lobbyStatus').textContent = 'Conectando…'; $('lobbyInfo').textContent = '';
  $('hostCtl').classList.add('hidden'); $('lobbyWait').classList.add('hidden');
  ['menu', 'onlineModal', 'gameover', 'pause'].forEach((id) => $(id).classList.add('hidden')); $('lobby').classList.remove('hidden');
}
function leaveOnline(silent) {
  const o = online; if (!o) return; voiceReset(); chatClear(); online = null; o.net.close();
  const u = new URL(location.href); u.searchParams.delete('sala'); history.replaceState(null, '', u.toString());
  $('lobby').classList.add('hidden'); $('netbar').classList.add('hidden'); $('socialHud').classList.add('hidden'); $('overChat').classList.add('hidden');
  if (!silent && state !== 'menu') toMenu(); else if (!silent) $('menu').classList.remove('hidden');
}
function onNetStatus(st, detail) {
  if (!online) return; online.status = st;
  const txt = st === 'reconnecting' ? 'Reconectando…' : st === 'connecting' ? 'Conectando…' : st === 'error' ? (detail || 'Erro de conexão') : '';
  $('lobbyStatus').textContent = txt; $('netStatus').textContent = st === 'open' ? '' : ' · ' + txt;
  if (st === 'error') {
    if (state === 'playing' || state === 'paused' || state === 'over') { const msg = txt; leaveOnline(); flashMenuErr(msg); }
    else { $('lobbyStatus').textContent = txt; }
  }
}
function flashMenuErr(msg) { $('onlineErr').textContent = msg; $('onlineModal').classList.remove('hidden'); $('menu').classList.add('hidden'); }
function onNetMessage(m) {
  const o = online; if (!o) return;
  switch (m.t) {
    case 'welcome': o.myId = m.id; o.hostId = m.hostId; o.cfg = m.cfg; voiceReset(); chatSeed(m.chat); chatSetRoom(!m.cfg || m.cfg.chat !== false); chatSetTeam(socialTeam()); break;
    case 'lobby': o.lobby = m; o.hostId = m.hostId; o.cfg = m.cfg; renderLobby(); break;
    case 'chat': chatPush(m); break;
    case 'voices': voiceRoster(m.list); break;
    case 'sig': voiceSignal(m.from, m.kind, m.data); break;
    case 'start': startOnlineMatch(m); break;
    case 's': if (o.inMatch) applySnapshot(m); break;
    case 'p': if (o.inMatch) for (const ev of m.ev) personalEvent(ev); break;
    case 'end': if (o.inMatch) onlineEnd(m); break;
    case 'teamOk': {
      o.myPref = m.pref; const msg = m.blocked ? 'Esse time ficaria com 2 jogadores a mais — você foi pro Automático (equilibrado).' : '';
      $('lobbyTeamErr').textContent = msg; $('teamPickErr').textContent = msg;
      if (o.inMatch && !$('teamPick').classList.contains('hidden')) { $('teamPick').classList.add('hidden'); if (m.blocked) flashMsg(msg); }
      renderLobby(); break;
    }
    default: break;
  }
}
// ---------- lobby ----------
function fillMapSelect(sel, value) {
  if (!sel.options.length) { for (const m of PLAY_MAPS) sel.add(new Option(m.name, m.id)); sel.add(new Option('Aleatório', 'random')); }
  if (value) sel.value = value;
}
function renderLobby() {
  const o = online, L = o.lobby; if (!L) return;
  const isHost = o.myId === o.hostId, cfg = L.cfg;
  const mapName = cfg.map === 'random' ? 'Aleatório' : getMap(cfg.map).name;
  $('lobbyInfo').textContent = `${mapName} · até ${cfg.max} jogadores · bots: ${cfg.fillBots ? 'sim' : 'não'} · ${cfg.time ? cfg.time + ' min' : 'tempo padrão'}${L.state === 'playing' ? ' · partida em andamento' : ''}`;
  const rows = L.players.filter((p) => !p.bot), dom = cfg.mode === 'dom';
  const counts = [0, 0]; for (const p of rows) if (p.team === 0 || p.team === 1) counts[p.team]++;
  $('lobbyTeam').classList.toggle('hidden', !dom);
  if (dom) { const me = rows.find((p) => p.id === o.myId); teamButtons($('lobbyTeamBtns'), me ? me.pref : -1, (t) => o.net.send({ t: 'team', team: t }), counts); }
  $('lobbyInfo').textContent = (dom ? 'DOMINAÇÃO · ' : isTraining(cfg.mode) ? 'TREINO (Estande do Docão) · ' : 'MATA-MATA · ') + $('lobbyInfo').textContent;
  $('lobbyPlayers').innerHTML = `<table><tr><th style="text-align:left">Jogadores (${rows.length}/${cfg.max})</th><th>Ping</th></tr>${rows.map((p) =>
    `<tr data-pid="${p.bot ? '' : p.id}" class="${p.id === o.myId ? 'me' : ''}${!p.bot && voiceTalking(p.id) ? ' talking' : ''}${!p.bot && voiceMuted(p.id) ? ' vmuted' : ''}"><td style="text-align:left"><span class="dot" style="background:${(getSkin(p.skin).shirt || {}).color || '#d8261c'}"></span>${escapeHtml(p.name)}${p.id === L.hostId ? '<span class="host">★ anfitrião</span>' : ''}${dom && p.team >= 0 ? `<span class="tm${p.team}">${TEAM_NAMES[p.team]}${p.pref < 0 ? ' (auto)' : ''}</span>` : ''}</td><td>${p.id === o.myId ? o.net.ping : p.ping} ms</td></tr>`).join('')}</table>`;
  chatSetRoom(cfg.chat !== false); chatSetTeam(!!dom); voiceRefresh();
  { const me = L.players.find((p) => p.id === o.myId); const inGame = L.state === 'playing';
    $('lobbyName').disabled = $('lobbyNameBtn').disabled = inGame;
    $('lobbyNameMsg').textContent = me && me.name !== myName() ? `Na sala você aparece como “${me.name}”${inGame ? '' : ' (nome repetido ou ajustado)'}` : inGame ? 'Partida em andamento: o nome muda na próxima partida' : ''; }
  $('hostCtl').classList.toggle('hidden', !isHost); $('lobbyWait').classList.toggle('hidden', isHost || L.state !== 'lobby');
  if (isHost) { fillMapSelect($('lobbyMap'), cfg.map); $('lobbyMax').value = String(cfg.max); $('lobbyBots').value = cfg.fillBots ? '1' : '0'; $('lobbyMode').value = cfg.mode || 'dm'; $('lobbyTime').value = String(normTime(cfg.time)); $('lobbyChatOn').value = cfg.chat === false ? '0' : '1'; }
  if (state === 'over') { const h = o.myId === o.hostId; $('againBtn').classList.toggle('hidden', !h); $('nextMapBtn').classList.toggle('hidden', !h); $('overWait').classList.toggle('hidden', h); }
}
const sendCfg = () => online && online.net.send({ t: 'cfg', map: $('lobbyMap').value, max: +$('lobbyMax').value, fillBots: $('lobbyBots').value === '1', mode: $('lobbyMode').value, time: +$('lobbyTime').value, chat: $('lobbyChatOn').value === '1' });
['lobbyMap', 'lobbyMax', 'lobbyBots', 'lobbyMode', 'lobbyTime', 'lobbyChatOn'].forEach((id) => ($(id).onchange = sendCfg));
$('startOnline').onclick = () => { if (online) { initAudio(); online.net.send({ t: 'start', map: $('lobbyMap').value }); } };
$('leaveLobby').onclick = () => leaveOnline();
// ---------- menu online ----------
function onlineTab(create) { $('tabCreate').classList.toggle('active', create); $('tabJoin').classList.toggle('active', !create); $('paneCreate').classList.toggle('hidden', !create); $('paneJoin').classList.toggle('hidden', create); }
$('onlineBtn').onclick = () => { fillMapSelect($('roomMap'), selectedMap); $('onlineErr').textContent = ''; $('menu').classList.add('hidden'); $('onlineModal').classList.remove('hidden'); };
$('onlineClose').onclick = () => { $('onlineModal').classList.add('hidden'); $('menu').classList.remove('hidden'); };
$('tabCreate').onclick = () => onlineTab(true); $('tabJoin').onclick = () => { onlineTab(false); $('joinCode').focus(); };
$('createBtn').onclick = async () => {
  const b = $('createBtn'); b.disabled = true; $('onlineErr').textContent = 'Criando sala…';
  try { const code = await createRoom({ map: $('roomMap').value, max: +$('roomMax').value, fillBots: $('roomBots').value === '1', mode: $('roomMode').value, time: +$('roomTime').value }); $('onlineErr').textContent = ''; joinRoom(code); }
  catch (e) { $('onlineErr').textContent = 'Não deu pra criar a sala: ' + (e.message || 'servidor fora do ar'); }
  b.disabled = false;
};
$('joinBtn').onclick = async () => {
  const code = $('joinCode').value.trim().toUpperCase(); if (!/^[A-Z]{4}$/.test(code)) { $('onlineErr').textContent = 'O código tem 4 letras'; return; }
  $('onlineErr').textContent = 'Procurando sala…';
  try { const info = await roomInfo(code); if (!info.exists) { $('onlineErr').textContent = 'Sala não encontrada'; return; } if (info.players >= info.max) { $('onlineErr').textContent = 'Sala cheia'; return; } $('onlineErr').textContent = ''; joinRoom(code); }
  catch (e) { $('onlineErr').textContent = 'Servidor fora do ar'; }
};
$('joinCode').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('joinBtn').click(); });
// ---------- partida ----------
function remoteEnt(info) {
  const o = online; if (info.id === o.myId || o.ents.has(info.id)) return o.ents.get(info.id);
  const e = makeEntity(info.name, false, info.skin, info.tag || '#ffffff');
  Object.assign(e, { remote: true, netId: info.id, bot: !!info.bot, buf: [], kills: info.kills || 0, deaths: info.deaths || 0, alive: false, primary: info.primary || 0, ping: 0 });
  e.model.group.visible = false; setWeapon(e, info.w || 0); e.slots = [e.primary, e.secondary ?? PISTOL, e.melee ?? KNIFE]; e.caps = info.caps || 0; applyTeam(e, info.team ?? -1);
  o.ents.set(info.id, e); entities.push(e); return e;
}
function removeEnt(id) {
  const o = online, e = o.ents.get(id); if (!e || e === player) return;
  scene.remove(e.model.group); o.ents.delete(id); entities = entities.filter((x) => x !== e);
}
function startOnlineMatch(m) {
  const o = online;
  if (o.inMatch && o.mapId === m.map && state !== 'over' && player) { // reconexão no meio da partida: só ressincroniza
    for (const info of m.ents) if (!o.ents.has(info.id) && info.id !== o.myId) remoteEnt(info);
    return;
  }
  resetAds(); loadMap(m.map); clearBots(); gameTime = m.T; o.mapId = m.map; o.inMatch = true; o.ents.clear(); o.tmap = [];
  mode = m.mode === 'dom' || isTraining(m.mode) ? m.mode : 'dm'; window.__capLog = []; o.limit = m.limit > 0 ? m.limit : 0;
  zone = m.zone ? newZoneState({ x: m.zone[0], y: m.zone[1], z: m.zone[2] }) : null; teamScore = m.zone ? [m.zone[8], m.zone[9]] : [0, 0];
  const me = m.ents.find((x) => x.id === o.myId) || { name: profile().name, skin: selectedSkin };
  player = makeEntity(me.name, true, me.skin, '#ffd27a'); player.netId = o.myId; player.sq = 0; player.alive = false; player.respawnAt = Infinity;
  player.kills = me.kills || 0; player.deaths = me.deaths || 0; player.gunKills = WEAPONS.map(() => 0); revengeName = null; resetFeedback(); resetMatchCamos();
  player.primary = player.nextPrimary = selectedPrimary; player.nextSecondary = selectedSecondary; player.nextMelee = selectedMelee; player.slots = [selectedPrimary, selectedSecondary, selectedMelee]; setWeapon(player, selectedPrimary); // até o servidor mandar o renascimento
  entities.push(player); o.ents.set(o.myId, player); fp.setSkin(me.skin); player.caps = me.caps || 0; applyTeam(player, me.team ?? -1);
  for (const info of m.ents) remoteEnt(info);
  refreshModeHud(); $('teamPick').classList.add('hidden');
  if (teamMode() && me.pend) showTeamPick(m.ents);
  pickups.forEach((p, i) => { p.active = !!(m.pk ? m.pk[i] : 1); p.mesh.visible = p.active; });
  showcase.visible = false; $('killfeed').innerHTML = ''; flashMsg(`Mapa: ${currentMap.name}`);
  ['menu', 'gameover', 'pause', 'lobby', 'onlineModal'].forEach((id) => $(id).classList.add('hidden')); $('hud').classList.remove('hidden'); $('socialHud').classList.remove('hidden'); $('overChat').classList.add('hidden');
  $('netbar').classList.remove('hidden'); $('netRoom').textContent = 'Sala ' + o.code;
  camera.clearViewOffset(); state = 'playing'; if ($('teamPick').classList.contains('hidden')) lockPointer(); // escolhendo time: mouse livre pros botões
}
function netTick(dt) {
  const o = online; if (!o || !o.inMatch || !player) return;
  o.sendAcc += dt; if (o.sendAcc < 1 / SEND_HZ) return; o.sendAcc = 0;
  const p = player, msg = { t: 'u', sq: p.sq, y: +p.yaw.toFixed(3), pi: +p.pitch.toFixed(3), c: +p.crouch.toFixed(3), g: p.onGround ? 1 : 0, w: p.weapon, pg: o.net.ping };
  if (p.alive) { msg.p = v3a(p.pos); msg.v = v3a(p.vel); }
  if (o.evq.length) { msg.ev = o.evq; o.evq = []; }
  o.net.send(msg);
  $('netPing').textContent = o.net.ping + ' ms';
}
function interpRemote(e) {
  const B = e.buf; if (!B.length) return;
  const rt = performance.now() / 1000 - INTERP_DELAY;
  while (B.length > 2 && B[1].t <= rt) B.shift();
  let a = B[0], b = B[1] || B[0];
  const k = b === a ? 1 : clamp((rt - a.t) / (b.t - a.t), 0, 1.2); // extrapola no máximo 20% se o pacote atrasar
  const nx = a.x + (b.x - a.x) * k, ny = a.y + (b.y - a.y) * k, nz = a.z + (b.z - a.z) * k;
  const span = Math.max(1e-3, b.t - a.t); e.vel.set((b.x - a.x) / span, (b.y - a.y) / span, (b.z - a.z) / span);
  e.pos.set(nx, ny, nz);
  e.crouch = crouchAmount((a.crouch || 0) + ((b.crouch || 0) - (a.crouch || 0)) * Math.min(1, k));
  let dy = b.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw = a.yaw + dy * Math.min(1, k);
}
function applySnapshot(s) {
  const o = online, now = performance.now() / 1000;
  if (Math.abs(gameTime - s.T) > 0.25) gameTime = s.T; else gameTime += (s.T - gameTime) * 0.1;
  o.tmap.push({ t: now, T: s.T }); if (o.tmap.length > 40) o.tmap.shift();
  if (s.d && zone) { const d = s.d; Object.assign(zone, { x: d[0], y: d[1], z: d[2], progress: d[3], team: d[4], contested: !!d[5], counts: [d[6], d[7]] }); teamScore = [d[8], d[9]]; }
  for (const ev of s.ev) netEvent(ev);
  for (const [id, x, y, z, yaw, pitch, w, fl, hp, ping, crouch = 0] of s.e) {
    const e = o.ents.get(id); if (!e) continue;
    e.ping = ping; e.hp = hp; e.onGround = !!(fl & 4); e.regenOn = !!(fl & 16); // 16: regenerando (servidor novo)
    if (e === player) continue;
    const alive = !!(fl & 1);
    if (alive && !e.alive) { e.alive = true; e.model.group.visible = true; e.model.group.scale.set(1, 1, 1); e.buf = []; e.pos.set(x, y, z); }
    else if (!alive && e.alive) { e.alive = false; e.deathAt = gameTime; }
    if (w !== e.weapon) setWeapon(e, w);
    e.invulnUntil = fl & 2 ? gameTime + 0.15 : 0; e.reloadEnd = fl & 8 ? gameTime + 0.15 : 0;
    if ((fl & 8) && !e.wasRl) { e.reloadStartT = gameTime; const W = WEAPONS[w]; if (W && !W.shellReload && !W.melee) reloadSfx(W, distVol(e.pos) * 0.5); } e.wasRl = !!(fl & 8);
    e.buf.push({ t: now, x, y, z, yaw, crouch: crouchAmount(crouch) });
    if (e.buf.length > 30) e.buf.shift();
  }
}
const entOf = (id) => (online ? online.ents.get(id) : null);
function remoteMuzzle(e) { return center(e, 1.3).add(new V3(Math.sin(e.yaw) * 1.0, -0.25, Math.cos(e.yaw) * 1.0)); }
function netEvent(ev) {
  const o = online, k = ev[0];
  if (k === 'sh') {
    const [, sid, w, , ends] = ev; if (sid === o.myId) return; const e = entOf(sid); if (!e) return; const W = WEAPONS[w];
    const vol = distVol(e.pos) * 0.7; sfx[W.key](vol); if (W.pump) sfx.pump(vol * 0.7, 0.3); if (W.bolt) sfx.bolt(vol * 0.7, 0.3);
    e.invulnUntil = 0; const mz = remoteMuzzle(e);
    ends.slice(0, 4).forEach(([x, y, z, hit]) => { const end = new V3(x, y, z); tracer(mz, end, !!W.beam); puff(end, hit ? 0xff9fb0 : 0xffffff); });
  } else if (k === 'h') {
    const [, tid, aid, hp, head] = ev; const t = entOf(tid), a = entOf(aid); if (!t) return;
    const prevHp = t.hp; t.hp = hp; t.flashUntil = gameTime + 0.12; t.lastAttacker = a || null;
    if (t === player) { hurtFlash(); sfx.oink(0.8, 1.15); } else if (Math.random() < 0.3) sfx.oink(distVol(t.pos) * 0.6, 1.3);
    if (aid === o.myId && t !== player) { if (hp > 0) feedbackHit({ head: !!head }); sfx.hit(); if (training()) dmgPopup(t, ev[5] ?? Math.max(0, prevHp - hp), !!head); }
  } else if (k === 'ml') { // golpe de faca de alguém: animação + som (o dano vem nos eventos 'h'/'k')
    const [, id, kind, hit] = ev; const e = entOf(id); if (!e) return; const kn = MELEE_KINDS[kind] || 'slash';
    if (e === player) { if (hit) sfx.knifeHit(1); return; }
    e.swingT = 0; e.swingKind = kn; e.invulnUntil = 0; sfx.knife(distVol(e.pos) * 0.8, kn); if (hit) sfx.knifeHit(distVol(e.pos) * 0.7);
  } else if (k === 'k') {
    // ev[7] (servidor novo): 1 = faca, 2 = faca pelas costas. ev[3] vem como pistola pra clientes antigos.
    // ev[8] (servidor novo): killstreak 'p' míssil, 'h' Gavião, 'x' nuke. Gavião e nuke não contam pra sequência (Gavião vale 25 pts).
    const [, aid, tid, w0, head, aK, tD, mk, ks] = ev; const a = entOf(aid), t = entOf(tid); if (!t) return; const w = mk ? KNIFE : w0, back = mk === 2;
    if (a) a.kills = aK; t.deaths = tD; t.alive = false; t.hp = 0; t.deathAt = gameTime; t.respawnAt = gameTime + RESPAWN_TIME; t.lastAttacker = a || null; t.killW = w; t.killBack = back;
    if (w === -2) { t.fxDeath = t.deathAt; return; } // trocou de time (sem bacon)
    addKillFeed(a, t, w, head, back, KS_KILL_NAME[ks] || null); sfx.die(t === player ? 1 : distVol(t.pos));
    if (a === player && t !== player) { sfx.kill(); if (ks === 'h' || ks === 'x') { if (ks === 'h') feedbackAward(HELI.points); } else { notePlayerKill(t, !!head); if (w >= 0) noteWeaponKill(player, w); } }
    if (t === player) { if (a && a !== player) revengeName = a.name; onPlayerDeath(); showStamp(w); player.charging = false; arcLine.visible = arcMark.visible = false; }
  } else if (k === 'sp') {
    const [, id, pos, yaw, prim, sq] = ev; const e = entOf(id); if (!e) return;
    e.pos.set(pos[0], pos[1], pos[2]); e.vel.set(0, 0, 0); e.crouch = 0; e.hp = 100; e.alive = true; e.invulnUntil = gameTime + INVULN; resetRegen(e);
    e.primary = prim; e.secondary = e.secondary ?? PISTOL; e.melee = e.melee ?? KNIFE; e.slots = [prim, e.secondary, e.melee]; e.mag = WEAPONS.map((x) => x.mag); e.reserve = WEAPONS.map((x) => x.reserve); e.reloadEnd = 0; e.switchEnd = 0; e.nades = NADE.spawnWith; setWeapon(e, prim);
    if (e === player) { keys.Space = false; player.sq = sq; player.yaw = yaw + Math.PI; player.pitch = 0; player.respawnAt = Infinity; player.nextPrimary = prim; player.secondary = selectedSecondary; player.melee = selectedMelee; player.slots = [prim, selectedSecondary, selectedMelee]; player.onGround = true; $('stamp').classList.remove('show'); if (spawnHold === 'secondary') setWeapon(player, selectedSecondary); $('teamPick').classList.add('hidden'); onPlayerRespawn(); }
    else { e.yaw = yaw; e.model.group.visible = true; e.model.group.scale.set(1, 1, 1); e.buf = [{ t: performance.now() / 1000 - INTERP_DELAY, x: pos[0], y: pos[1], z: pos[2], yaw }]; }
  } else if (k === 'pk') { const p = pickups[ev[1]]; if (p) { p.active = !!ev[2]; p.mesh.visible = p.active; } }
  else if (k === 'nd') {
    const [, pid, oid, op, vel] = ev; const mesh = makeCup(1.15); scene.add(mesh); const owner = entOf(oid);
    grenades.push({ net: true, pid, owner, pos: a3v(op), vel: a3v(vel), explodeAt: gameTime + NADE.fuse, mesh, spin: new V3(rand(-8, 8), rand(-4, 4), rand(-8, 8)), lastBounce: 0 });
    if (oid !== o.myId && owner) sfx.toss(distVol(owner.pos));
  } else if (k === 'rk') {
    const [, pid, oid, pos, dir] = ev; const start = a3v(pos), d = a3v(dir);
    const mesh = makeRocket(1.5); scene.add(mesh); mesh.position.copy(start); mesh.lookAt(start.clone().add(d));
    rockets.push({ net: true, pid, owner: entOf(oid), pos: start, dir: d, mesh, born: gameTime, nextSmoke: 0 });
  } else if (k === 'bm') {
    const [, pid, kind, c] = ev;
    const list = kind === 'n' ? grenades : rockets; const i = list.findIndex((x) => x.pid === pid && pid); if (i >= 0) { scene.remove(list[i].mesh); list.splice(i, 1); }
    blastFx(a3v(c), kind === 'n' ? NADE.radius : kind === 'p' ? PREDATOR.radius : WEAPONS[3].rocket.radius);
    if (kind === 'p') shake = Math.max(shake, 0.9);
  }
  else if (k === 'hl') netHeliSpawn(ev);
  else if (k === 'hh') { const h = netHelis.get(ev[1]); if (h) h.hp = ev[2]; }
  else if (k === 'hx') netHeliDown(ev[1], ev[2]);
  else if (k === 'hs') { const h = netHelis.get(ev[1]); if (h) { const from = h.pos.clone(); from.y -= 0.4; tracer(from, a3v(ev[2]), false); sfx.rifle(distVol(h.pos) * 0.45); } }
  else if (k === 'nk') { const [, oid, at] = ev; if (oid !== o.myId) { netNukeAt = at; const e = entOf(oid); flashMsg(`${e ? e.name : 'Alguém'} puxou o rádio · Fim da chapa`); showNukeCount(Math.max(1, Math.ceil(at - gameTime))); } }
  else if (k === 'nb') { netNukeAt = 0; if (!nukeAt) hideNuke(); sfx.boom(1); shake = Math.max(shake, 1.2); nukeFlash(); window.__nukeBooms = (window.__nukeBooms || 0) + 1; } else if (k === 'zc') {
    const [, team, s0, s1, nz, caps] = ev; teamScore = [s0, s1];
    for (const [id, c] of caps || []) { const e = entOf(id); if (e) e.caps = c; }
    onZoneCaptured(team, { x: nz[0], y: nz[1], z: nz[2] });
  } else if (k === 'tm') { const e = entOf(ev[1]); if (e) { applyTeam(e, ev[2]); if (e === player) refreshModeHud(); } }
  else if (k === 'bc') { // bacon comido (servidor): [, morto, quem comeu, vida nova]
    const [, did, eid, hp] = ev; const d = entOf(did), e = entOf(eid);
    if (e && hp != null) e.hp = hp; baconEaten(d && d.bacon && d.bacon.on ? d.bacon : null, e);
  }
  else if (k === 'j') { remoteEnt(ev[1]); }
  else if (k === 'l') { removeEnt(ev[1]); }
}
function personalEvent(ev) {
  const p = player; if (!p) return;
  if (ev[0] === 'pos') { p.pos.set(ev[1][0], ev[1][1], ev[1][2]); p.vel.set(0, 0, 0); }
  else if (ev[0] === 'kn') { const [x, y, z] = ev[1]; p.vel.x += x; p.vel.z += z; p.vel.y = Math.max(p.vel.y, y); p.onGround = false; lastKnock = gameTime; }
  else if (ev[0] === 'got') {
    const [, type, hp, nades] = ev; sfx.pickup(); p.hp = hp; p.nades = nades; if (type === 'ammo') refillAmmo(p);
    flashMsg(type === 'health' ? '+50 de vida' : type === 'grenade' ? `+1 Copo Bomba (${p.nades}/${NADE.max})` : p.primary === 3 ? `Munição! +1 foguete (${p.reserve[3]}/${WEAPONS[3].reserve})` : 'Munição cheia!');
  }
}
function onlineEnd(m) {
  const o = online; resetAds(); state = 'over'; mouseDown = false; rightDown = false; o.endMsg = m;
  if (document.pointerLockElement) document.exitPointerLock();
  for (const [id, , k, d] of m.board) { const e = entOf(id); if (e) { e.kills = k; e.deaths = d; } }
  for (const r of m.board) { const e = entOf(r[0]); if (e && r[6] != null) e.caps = r[6]; }
  const w = m.board[0];
  if (m.mode === 'dom') { teamScore = m.ts || teamScore; setTeamWinner(m.winTeam ?? -1); }
  else $('winner').textContent = w && w[0] === o.myId ? 'Você venceu! 🏆' : `${w ? w[1] : '???'} venceu!`;
  $('finalboard').innerHTML = boardHtml();
  $('overMap').innerHTML = `Mapa: <b>${escapeHtml(getMap(m.map).name)}</b> · próximo: <b>${escapeHtml(getMap(m.next).name)}</b>`;
  $('overChat').classList.remove('hidden');
  $('gameover').classList.remove('hidden'); $('tabboard').classList.add('hidden'); renderLobby();
  const h = o.myId === o.hostId; $('againBtn').classList.toggle('hidden', !h); $('nextMapBtn').classList.toggle('hidden', !h); $('overWait').classList.toggle('hidden', h);
}
// entrou no meio de uma partida de Dominação: escolhe o time antes de nascer
function showTeamPick(ents) {
  const c = [0, 0]; for (const e of ents) if (e.id !== online.myId && (e.team === 0 || e.team === 1)) c[e.team]++;
  $('teamPickErr').textContent = ''; $('teamPick').classList.remove('hidden');
  deathUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); // mouse livre (não pausa)
  teamButtons($('teamPickBtns'), -1, (t) => { online.net.send({ t: 'team', team: t }); lockPointer(); }, c);
}
// botões do fim de jogo: offline como antes; online só o anfitrião reinicia
$('againBtn').onclick = () => (online ? online.net.send({ t: 'start', map: online.mapId }) : startGame(currentMap.id));
$('nextMapBtn').onclick = () => (online ? online.net.send({ t: 'start', map: online.endMsg ? online.endMsg.next : 'random' }) : startGame(MAPS[(MAPS.indexOf(currentMap) + 1) % MAPS.length].id));
function placeSocialHud() {
  const kf = $('killfeed'); if (!kf) return;
  if (!document.body.classList.contains('dead')) { kf.style.top = ''; return; }
  const tl = $('tl'); kf.style.top = Math.round((tl ? tl.getBoundingClientRect().bottom : 72) + 8) + 'px';
}
function paintVoiceMarks() {
  document.querySelectorAll('[data-pid]').forEach((el) => {
    const id = +el.dataset.pid; if (!id) return;
    el.classList.toggle('talking', voiceTalking(id));
    el.classList.toggle('vmuted', voiceMuted(id));
  });
}
initChat({
  send: (m) => { if (online && online.net) online.net.send(m); },
  teamMode: () => socialTeam(),
  me: () => {
    if (!online) return null;
    const id = online.myId;
    const row = online.lobby && online.lobby.players.find((p) => p.id === id);
    return { id, name: (player && player.name) || (row && row.name) || 'Você', team: player ? player.team : (row ? row.team : -1), dead: !!(state === 'playing' && player && !player.alive) };
  },
  shouldLock: () => state === 'playing' && !!player && player.alive && $('pause').classList.contains('hidden') && $('teamPick').classList.contains('hidden'),
  lockPointer,
  clearKeys: () => { for (const k in keys) keys[k] = false; mouseDown = false; rightDown = false; if (player) player.charging = false; },
});
initVoice({
  send: (m) => { if (online && online.net) online.net.send(m); },
  teamMode: () => socialTeam(),
  myId: () => (online && online.myId) || 0,
  onChange: paintVoiceMarks,
});
$('lb').addEventListener('click', (ev) => {
  const row = ev.target.closest('[data-pid]'); if (!row || !online) return;
  const id = +row.dataset.pid; if (!id || id === online.myId) return;
  voiceToggleMute(id); paintVoiceMarks();
});
$('lobbyPlayers').addEventListener('click', (ev) => {
  const row = ev.target.closest('tr[data-pid]'); if (!row || !online) return;
  const id = +row.dataset.pid; if (!id || id === online.myId) return;
  voiceToggleMute(id); paintVoiceMarks();
});
document.querySelectorAll('.invite').forEach(bindInvite);
// link ?sala=ABCD entra direto
{ const sala = new URLSearchParams(location.search).get('sala'); if (sala) joinRoom(sala); }

// ganchos para testes automatizados
window.__docao = { get state() { return state; }, get entities() { return entities; }, get player() { return player; }, get camera() { return camera; }, startGame, endGame, pause, visible: (e) => losClear(center(player, EYE), center(e, 1.2)),
  set time(v) { gameTime = v; }, get time() { return gameTime; }, get grenades() { return grenades; }, get explosions() { return explosions; }, get pickups() { return pickups; }, get ads() { return ads; }, get fov() { return camera.fov; }, get rockets() { return rockets; }, get lastKnock() { return lastKnock; }, WEAPONS, setPrimary, get scoped() { return scoped(); },
  MAPS, loadMap, selectMap, get map() { return currentMap; }, get nav() { return nav; }, get navMs() { return navMs; }, get spawns() { return SPAWNS; }, groundAt, collides, get solids() { return solids; },
  get online() { return online; }, joinRoom, leaveOnline, netEv,
  get mode() { return mode; }, get zone() { return zone; }, set zone(v) { zone = v; }, get teamScore() { return teamScore; }, get spawnHold() { return spawnHold; }, get selectedPrimary() { return selectedPrimary; },
  DOM, applyTeam, damage, kill: (e) => kill(e, null, 0, false), V3, KNIFE, MELEE, switchWeapon, quickKnife, knifeAttack, meleeHit, modelYaw, get fpBoltHand() { const g = fp.guns[player ? player.weapon : -1]; return !!(g && g.userData.boltHand && g.userData.boltHand.visible && fp.sRound.parent === g); }, get menuPreviewX() { return menuPreviewX; }, get previewScreen() { if (!preview || !showcase.visible) return null; const v = showcase.position.clone(); v.y += 0.9; v.project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, skin: selectedSkin, kids: preview.group.children.length }; }, get fpKnife() { return { t: fp.knifeT, kind: fp.knifeKind, visible: fp.kr.visible }; }, get bacon() { return baconStats; }, los: (a, b) => losClear(new V3(...a), new V3(...b)), activeBacons, BACON, get deathCam() { return deathCamState; },
  blastAt: (x, y, z, kind = 'r', owner) => blast(new V3(x, y, z), owner || player, kind === 'n' ? { radius: NADE.radius, maxDmg: NADE.maxDmg, selfMul: NADE.selfMul, knock: NADE.knock, lift: NADE.lift, wIdx: W_NADE } : { ...WEAPONS[3].rocket, wIdx: 3 }),
  rocketAt: (o, d, owner) => launchRocket(owner || player, new V3(...o), new V3(...d).normalize()),
  rewardKill: () => onRewardKill(), get rewardKills() { return rewardKills; }, useStreak, get streakReady() { return streakReady.slice(); }, callNuke, get nukeReady() { return nukeReady || streakReady.includes('nuke'); }, get nukeAt() { return nukeAt; }, spawnHeli: () => grantHeli(), get heli() { return heli; }, get netHelis() { return [...netHelis.values()].map((h) => ({ id: h.id, owner: h.owner ? h.owner.name : '', hp: h.hp, alive: h.alive, pos: h.pos.toArray() })); }, get netNukeAt() { return netNukeAt; }, hurtHeli, get predator() { return predator; }, throwSmoke: () => throwTactical('smoke'), throwStun: () => throwTactical('stun'), get smokes() { return smokes; }, get tacticals() { return tacticals; }, strikeAt: (x, z) => spawnSkyMissile({ x, z }, player), get strikes() { return strikes; }, STRIKE, PREDATOR, get gunKills() { return player ? player.gunKills : null; }, addWeaponKills: (w, n = 1) => { for (let i = 0; i < n; i++) noteWeaponKill(player, w); }, camoLevel,
  swingSaber: () => swingSaber(player) };

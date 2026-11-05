// Docão UNO: mesa no boteco. As regras moram em shared/uno.js.
import * as THREE from 'three';
import { canvasTex, drawLogo, makeCup, makeDocao, setExpression, setPose, updateExpression } from './docao.js';
import { EMOTES } from './shared/truco.js';
import { COLOR_NAME, act, cardPlayable, createMatch, dueSeat, normLevel, normSeats, normTarget, release, view } from './shared/uno.js';
import { botAct, botCatch, botName, botSkin } from './shared/uno-bot.js';
import { getSkin } from './skins.js';
import { HTTP_URL, SERVER_URL } from './config.js';
import { chatClear, chatPush, chatSay, chatSeed, chatSetTeam, chatUseHooks } from './chat.js';
import { voiceArm, voiceCycle, voicePtt, voiceRefresh, voiceRestore, voiceRoster, voiceSignal, voiceSnap, voiceTalking, voiceToggleMute, voiceUseHooks } from './voice.js';

const $ = (id) => document.getElementById(id);
const EMOTE_NAME = { brow: 'Sombrancelha', wink: 'Piscar', ear: 'Orelha', chin: 'Mogado', point: 'Apontar', laugh: 'Rir', wave: 'Acenar', drink: 'Beber' };
const INK_HEX = { r: 0xd32027, y: 0xf0b400, g: 0x1f8a3e, b: 0x1d4eab };
const FACE = {
  r: { body: '#d32027', mark: '#a5161c' },
  y: { body: '#f0b400', mark: '#2a2118' },
  g: { body: '#1f8a3e', mark: '#146b2e' },
  b: { body: '#1d4eab', mark: '#163e88' },
};
const OVAL = ['#d32027', '#f0b400', '#1f8a3e', '#1d4eab'];
const MARK_FONT = '900 1px Arial Black, Impact, Trebuchet MS, Arial';
const TURN_MS = 25000;
const _cupAt = new THREE.Vector3();

let mode = '';
let match = null;
let current = null;
let players = [];
let localSeat = 0;
let myId = 0;
let hostId = 0;
let phase = '';
let seatsN = 4;
let level = 'medio';
let target = 500;
let roomCode = '';
let paused = false;
let fillBots = true;
let deadline = 0;
let picked = 0;
let shout = false;
let armed = '';
let ws = null;
let wantWs = false;
let tries = 0;
let busy = false;
let pumpTimer = 0;
let answerTimer = 0;
let rolled = '';
let painting = false;
let unchat = null;
let unvoice = null;
let voiceWas = null;
let micArmed = false;
let running = false;
let lastFrame = 0;
let pigKey = '';
let toastTimer = 0;
let renderer, scene, camera, world, cardRoot, ray;

const app = () => $('unoApp');
function readName() { return ($('nameInput') && $('nameInput').value) || 'Docão'; }
function readSkin() { try { return localStorage.getItem('docao.skin') || 'classico'; } catch (e) { return 'classico'; } }
function readSetup() {
  return {
    seats: normSeats(Number($('unoSeatsSel') && $('unoSeatsSel').value)),
    level: normLevel($('unoLevelSel') && $('unoLevelSel').value),
    target: normTarget(Number($('unoTargetSel') && $('unoTargetSel').value)),
  };
}
function seatName(s) { return (players[s] && players[s].name) || ('Cadeira ' + (s + 1)); }
function toast(text) {
  const el = $('unoToast'); if (!el) return;
  el.textContent = text || ''; el.style.display = text ? 'block' : 'none';
  clearTimeout(toastTimer); if (text) toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2400);
}
let unoSpoken = false;
const liveSpeech = [];
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices());
}
function tableVoice() {
  try {
    const voices = speechSynthesis.getVoices();
    return voices.find((v) => /pt-BR/i.test(v.lang)) || voices.find((v) => /^pt/i.test(v.lang || '')) || null;
  } catch (e) { return null; }
}
function shoutLine(text) {
  const el = $('unoBanner');
  if (el) el.textContent = text;
  if (typeof speechSynthesis === 'undefined') return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR'; u.rate = 1.05; u.volume = 1;
  const voice = tableVoice();
  if (voice) u.voice = voice;
  liveSpeech.push(u);
  const drop = () => {
    const i = liveSpeech.indexOf(u);
    if (i >= 0) liveSpeech.splice(i, 1);
  };
  u.onend = drop;
  u.onerror = drop;
  try {
    if (speechSynthesis.paused) speechSynthesis.resume();
    speechSynthesis.resume();
    speechSynthesis.speak(u);
  } catch (e) { /* sem voz */ }
}
function armUno() {
  shout = !shout;
  if (shout) { unoSpoken = true; shoutLine('Uno papudo'); }
  else unoSpoken = false;
  paint();
}

function onEvents(events) {
  let voiced = false;
  for (const e of events || []) {
    if (e.t === 'play' && e.card) {
      const k = e.card.kind;
      const line = k === 'd4' ? 'Compra ai, barriguinha'
        : k === 'd2' ? 'Compra ai, então'
          : k === 'skip' ? 'Espera sentado'
            : k === 'rev' ? 'Volta pro oclinho'
              : '';
      if (line) { shoutLine(line); voiced = true; }
    } else if (e.t === 'uno') {
      const mine = e.seat === localSeat && unoSpoken && !voiced;
      unoSpoken = false;
      if (mine) { const el = $('unoBanner'); if (el) el.textContent = 'Uno papudo'; }
      else shoutLine('Uno papudo');
    } else if (e.t === 'catch') chatPush({ sys: 1, text: seatName(e.target) + ' esqueceu o UNO e compra ' + e.n + '.', at: Date.now() });
    else if (e.t === 'challenge') chatPush({ sys: 1, text: e.ok ? 'Blefe! Quem jogou o +4 compra 4.' : 'O +4 era legal. Compra 6.', at: Date.now() });
    else if (e.t === 'draw' && e.pile) chatPush({ sys: 1, text: seatName(e.seat) + ' compra ' + e.n + '.', at: Date.now() });
    else if (e.t === 'round') chatPush({ sys: 1, text: (e.winner == null ? 'Mão sem vencedor.' : seatName(e.winner) + ' marcou ' + e.points + '.') + ' Meta ' + target + '.', at: Date.now() });
    else if (e.t === 'match') chatPush({ sys: 1, text: seatName(e.winner) + ' fechou a mesa.', at: Date.now() });
    else if (e.t === 'color' && e.color) chatPush({ sys: 1, text: 'Cor: ' + (COLOR_NAME[e.color] || e.color) + '.', at: Date.now() });
  }
}

function openTable() {
  if (mode) return;
  mode = 'boot';
  $('menu').classList.add('hidden');
  app().classList.add('on');
  chatSetTeam(false);
  chatClear();
  voiceWas = voiceSnap();
  unchat = chatUseHooks({
    send: (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
    teamMode: () => false,
    me: () => ({ id: myId, name: readName(), team: -1, dead: 0 }),
    shouldLock: () => false, lockPointer() {}, clearKeys() {},
  });
  unvoice = voiceUseHooks({
    send: (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
    teamMode: () => false,
    myId: () => myId,
    order: () => ['off', 'all'],
    onChange() {},
  });
  ensureWorld();
  voiceRefresh();
  running = true; lastFrame = performance.now();
  requestAnimationFrame(frame);
  resize();
}
function closeTable() {
  wantWs = false; mode = '';
  clearTimeout(pumpTimer); clearTimeout(answerTimer);
  if (ws) { try { ws.close(1000, 'saiu'); } catch (e) { /* já fechou */ } ws = null; }
  running = false;
  app().classList.remove('on');
  $('menu').classList.remove('hidden');
  if (unchat) unchat(); if (unvoice) unvoice();
  unchat = unvoice = null;
  chatSetTeam(false); chatClear();
  if (voiceWas) voiceRestore(voiceWas);
  voiceWas = null; micArmed = false; shout = false; unoSpoken = false; armed = '';
  const u = new URL(location.href); u.searchParams.delete('uno'); history.replaceState(null, '', u);
}

function startLocal(setup) {
  seatsN = setup.seats; level = setup.level; target = setup.target;
  const you = { id: 1, name: readName(), skin: readSkin(), bot: false, seat: 0, empty: false };
  const gift = Math.random() < 0.25 ? 1 + Math.floor(Math.random() * (seatsN - 1)) : -1;
  const taken = [you.name];
  const worn = [you.skin];
  players = [you];
  for (let i = 1; i < seatsN; i++) {
    const name = botName(taken, i === gift);
    const skin = botSkin(worn);
    taken.push(name); worn.push(skin);
    players.push({ id: i + 1, name, skin, bot: true, seat: i, empty: false });
  }
  localSeat = 0; myId = 1; hostId = 1; phase = 'play'; paused = false; roomCode = ''; shout = false; unoSpoken = false; armed = '';
  match = createMatch({ seats: seatsN, target, seed: (Math.random() * 1e9) | 0 });
  current = view(match, 0);
  openTable();
  mode = 'local';
  onEvents(match.events);
  sync();
  schedule();
}

async function createOnline() {
  const setup = readSetup();
  const r = await fetch(HTTP_URL + '/api/uno/rooms', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(setup),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.code) throw new Error(j.error || 'Servidor indisponível');
  seatsN = setup.seats; level = setup.level; target = setup.target;
  openTable();
  mode = 'online';
  connect(j.code);
}
function joinOnline(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (code.length !== 4) { $('unoMenuErr').textContent = 'O código tem 4 letras.'; return; }
  openTable();
  mode = 'online';
  connect(code);
}
function connect(code) {
  roomCode = code; wantWs = true;
  const u = new URL(location.href); u.searchParams.set('uno', code); history.replaceState(null, '', u);
  const token = sessionStorage.getItem('docao.uno.' + code) || '';
  const qs = new URLSearchParams({ name: readName(), skin: readSkin(), token });
  const sock = new WebSocket(`${SERVER_URL}/ws/uno/${code}?${qs}`);
  ws = sock;
  sock.onopen = () => { tries = 0; };
  sock.onmessage = (ev) => { if (ev.data === 'pong') return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onNet(m); };
  sock.onclose = (ev) => {
    if (ws !== sock || !wantWs || ev.code === 4000 || ev.code === 4001) return;
    if (tries++ >= 8) { toast('Sem conexão com a sala'); return; }
    setTimeout(() => { if (wantWs && roomCode === code) connect(code); }, Math.min(4000, 500 * tries));
  };
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function onNet(m) {
  if (m.t === 'welcome') {
    myId = m.id; hostId = m.hostId; roomCode = m.code;
    try { sessionStorage.setItem('docao.uno.' + m.code, m.token); } catch (e) { /* sem storage */ }
    chatSeed(m.chat || []);
  } else if (m.t === 'state') {
    busy = false; phase = m.phase; hostId = m.hostId; localSeat = m.you; players = m.players || [];
    seatsN = m.seats || (m.view && m.view.seats) || seatsN;
    level = normLevel(m.level); target = normTarget(m.target);
    paused = !!m.paused; fillBots = m.fill !== false; current = m.view; deadline = m.deadline || 0;
    chatSetTeam(false);
    voiceRefresh();
    if (phase === 'play') maybeArm();
    sync();
  } else if (m.t === 'events') onEvents(m.events);
  else if (m.t === 'chat') chatPush(m);
  else if (m.t === 'voices') voiceRoster(m.list);
  else if (m.t === 'sig') voiceSignal(m.from, m.kind, m.data);
  else if (m.t === 'emote') showEmote(m.seat, m.id);
  else if (m.t === 'error') { busy = false; unoSpoken = false; toast(m.msg || 'Não deu'); }
}

async function maybeArm() {
  if (micArmed) return;
  const others = players.filter((p) => p && !p.empty && !p.bot && p.id !== myId);
  if (!others.length) return;
  micArmed = true;
  await voiceArm('all', 'open');
}

function doAct(action) {
  armed = '';
  clearTimeout(pumpTimer);
  clearTimeout(answerTimer);
  if (action && action.t === 'play') action = { ...action, uno: !!(action.uno || shout) };
  if (action && action.t === 'play') shout = false;
  if (mode === 'local') {
    const r = act(match, localSeat, action);
    if (!r.ok) { unoSpoken = false; toast(r.error); schedule(); return; }
    onEvents(r.events);
    current = view(match, localSeat);
    phase = match.phase === 'over' ? 'over' : 'play';
    sync(); schedule();
    return;
  }
  if (busy) return;
  busy = true;
  send({ t: 'act', act: action });
}

function schedule() {
  clearTimeout(pumpTimer); clearTimeout(answerTimer);
  if (!match || mode !== 'local') return;
  if (match.phase === 'over') { phase = 'over'; deadline = 0; paint(); return; }
  const rollKey = match.seq + ':' + match.forgot;
  if (match.forgot >= 0 && rolled !== rollKey) {
    rolled = rollKey;
    const hit = botCatch(match, level, Math.random, (s) => players[s] && players[s].bot);
    if (hit) {
      pumpTimer = setTimeout(() => {
        const who = players[hit.seat];
        const r = act(match, hit.seat, hit.action);
        if (hit.bark && who) chatPush({ id: who.id, name: who.name, scope: 'all', text: hit.bark, at: Date.now() });
        if (r.ok) onEvents(r.events);
        current = view(match, localSeat);
        phase = match.phase === 'over' ? 'over' : 'play';
        sync(); schedule();
      }, 450);
      paint();
      return;
    }
  }
  if (match.phase === 'gap') {
    pumpTimer = setTimeout(() => {
      const r = release(match);
      if (r.ok) onEvents(r.events);
      current = view(match, localSeat);
      phase = match.phase === 'over' ? 'over' : 'play';
      sync(); schedule();
    }, 900);
    deadline = 0;
    paint();
    return;
  }
  const seat = dueSeat(match);
  const who = players[seat];
  if (who && who.bot) {
    deadline = 0;
    pumpTimer = setTimeout(() => {
      const pickedBot = botAct(match, seat, level, Math.random);
      if (!pickedBot) return;
      const r = act(match, seat, pickedBot.action);
      if (pickedBot.bark) chatPush({ id: who.id, name: who.name, scope: 'all', text: pickedBot.bark, at: Date.now() });
      if (pickedBot.emote) showEmote(seat, pickedBot.emote);
      if (r.ok) onEvents(r.events);
      current = view(match, localSeat);
      phase = match.phase === 'over' ? 'over' : 'play';
      sync(); schedule();
    }, 700);
    return;
  }
  if (seat === localSeat) {
    deadline = Date.now() + TURN_MS;
    answerTimer = setTimeout(() => {
      const pickedBot = botAct(match, localSeat, level, Math.random);
      if (pickedBot) doAct(pickedBot.action);
    }, TURN_MS);
  } else deadline = 0;
  paint();
}

function again() {
  if (mode === 'local') {
    shout = false; unoSpoken = false; armed = '';
    match = createMatch({ seats: seatsN, target, seed: (Math.random() * 1e9) | 0 });
    current = view(match, 0); phase = 'play';
    onEvents(match.events); sync(); schedule();
  } else send({ t: 'again' });
}

function ensureWorld() {
  if (renderer) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3d7a4);
  scene.fog = new THREE.Fog(0xf3d7a4, 9, 20);
  camera = new THREE.PerspectiveCamera(52, 1, 0.1, 40);
  camera.position.set(0, 6.4, 0.85);
  camera.lookAt(0, 0.78, 0.15);
  renderer = new THREE.WebGLRenderer({ canvas: $('unoCanvas'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  scene.add(new THREE.HemisphereLight(0xfff1d2, 0x8a5a32, 1.15));
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.25); sun.position.set(-4, 7, 3); scene.add(sun);
  world = new THREE.Group(); scene.add(world);
  cardRoot = new THREE.Group(); scene.add(cardRoot);
  ray = new THREE.Raycaster();
  buildBar();
  window.addEventListener('resize', resize);
}
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); world.add(m); return m;
}
function buildBar() {
  box(14, 0.2, 14, 0xc4a574, 0, -0.1, 0);
  box(8, 2.4, 0.3, 0xe7d3b0, 0, 1.2, -3.5);
  box(0.3, 2.4, 6, 0xd9b48a, -3.8, 1.2, -0.4);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.1, 32), new THREE.MeshLambertMaterial({ color: 0x8a5430 }));
  table.position.y = 0.78; world.add(table);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.74, 10), new THREE.MeshLambertMaterial({ color: 0x5c3a22 }));
  leg.position.y = 0.36; world.add(leg);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * (Math.PI / 2);
    const cup = makeCup(0.38); cup.position.set(Math.cos(a) * 1.15, 0.84, Math.sin(a) * 1.15); world.add(cup);
  }
}

function angleFor(i) { return Math.PI / 2 + (i - localSeat) * (Math.PI * 2 / Math.max(2, seatsN)); }
function lookFor(p) {
  const skin = getSkin(p && p.skin);
  if (!p || String(p.name || '').toLowerCase() !== 'oclinhos') return skin.id;
  const parts = (skin.parts || []).slice();
  const has = parts.some((part) => part.type === 'glasses' || part.type === 'squareGlasses' || part.type === 'sunglasses');
  if (!has) parts.push({ type: 'glasses', color: '#2a1408' });
  return { ...skin, parts };
}
function rebuildSeats() {
  const key = players.map((p) => (p ? p.id + ':' + p.skin + ':' + p.name + ':' + (p.bot ? 1 : 0) : '-')).join('|') + '@' + localSeat + '#' + seatsN;
  if (key === pigKey) return;
  pigKey = key;
  for (const c of [...world.children]) if (c.userData.seatGroup) world.remove(c);
  players.forEach((p, i) => {
    if (i >= seatsN) return;
    const ang = angleFor(i);
    const g = new THREE.Group();
    g.userData.seatGroup = 1;
    g.position.set(Math.cos(ang) * 1.85, 0, Math.sin(ang) * 1.85);
    g.lookAt(0, 0.4, 0);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), new THREE.MeshLambertMaterial({ color: 0x6b3e26 }));
    chair.position.y = 0.42; chair.userData.kind = 'seat'; chair.userData.seat = i; g.add(chair);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.08), new THREE.MeshLambertMaterial({ color: 0x5c3a22 }));
    back.position.set(0, 0.7, -0.24); g.add(back);
    if (p && !p.empty) {
      const model = makeDocao(lookFor(p), { withGun: false, pose: 'idle' });
      model.legs.forEach((leg) => { leg.rotation.x = -1.05; });
      model.group.position.y = 0.2;
      model.group.userData.kind = 'pig'; model.group.userData.seat = i; model.group.userData.pid = p.id;
      g.add(model.group);
      g.userData.model = model;
      const bubble = nameSprite(p.name);
      bubble.position.set(0, 1.35, 0.2); g.add(bubble); g.userData.bubble = bubble;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 28), new THREE.MeshBasicMaterial({ color: 0xfff0cc, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false;
      g.add(ring); g.userData.ring = ring; g.userData.seat = i;
    }
    world.add(g);
  });
}
function nameSprite(text) {
  const t = canvasTex(384, 80, (x) => {
    x.fillStyle = '#3b2418'; x.fillRect(6, 10, 372, 60);
    x.fillStyle = '#fff0cc'; x.font = '700 32px Trebuchet MS, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(text).slice(0, 18), 192, 40);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(1.15, 0.28, 1); s.renderOrder = 5; return s;
}
function countSprite(n) {
  const t = canvasTex(128, 64, (x) => {
    x.fillStyle = '#291e18'; x.fillRect(8, 8, 112, 48);
    x.fillStyle = '#fff0cc'; x.font = '900 32px Trebuchet MS, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(n), 64, 32);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(0.42, 0.22, 1); s.renderOrder = 6; return s;
}

function roundRect(x, a, b, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  x.beginPath();
  x.moveTo(a + rr, b);
  x.arcTo(a + w, b, a + w, b + h, rr);
  x.arcTo(a + w, b + h, a, b + h, rr);
  x.arcTo(a, b + h, a, b, rr);
  x.arcTo(a, b, a + w, b, rr);
  x.closePath();
}
function drawMark(x, c, size, ink) {
  const wild = c.kind === 'wild';
  const paint = ink || (FACE[c.color] ? FACE[c.color].mark : '#fffaf0');
  x.save();
  x.fillStyle = paint;
  x.strokeStyle = paint;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  if (wild) {
    const r = size * 0.46;
    OVAL.forEach((col, i) => {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(0, 0);
      x.arc(0, 0, r, i * Math.PI / 2 - Math.PI / 2, (i + 1) * Math.PI / 2 - Math.PI / 2);
      x.closePath();
      x.fill();
    });
    x.strokeStyle = '#fffaf0';
    x.lineWidth = Math.max(3, size * 0.07);
    x.beginPath();
    x.arc(0, 0, r, 0, Math.PI * 2);
    x.stroke();
  } else if (c.kind === 'n' || c.kind === 'd2' || c.kind === 'd4') {
    const label = c.kind === 'n' ? String(c.n) : (c.kind === 'd2' ? '+2' : '+4');
    x.font = MARK_FONT.replace('1px', Math.round(size) + 'px');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(label, 0, size * 0.04);
  } else if (c.kind === 'skip') {
    x.lineWidth = Math.max(6, size * 0.12);
    x.beginPath();
    x.arc(0, 0, size * 0.34, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    x.moveTo(-size * 0.24, size * 0.24);
    x.lineTo(size * 0.24, -size * 0.24);
    x.stroke();
  } else if (c.kind === 'rev') {
    const arm = (dir, y) => {
      x.save();
      x.translate(0, y);
      x.scale(dir, 1);
      x.lineWidth = Math.max(6, size * 0.1);
      x.beginPath();
      x.moveTo(-size * 0.2, size * 0.1);
      x.quadraticCurveTo(0, -size * 0.14, size * 0.18, 0);
      x.stroke();
      x.beginPath();
      x.moveTo(size * 0.02, -size * 0.15);
      x.lineTo(size * 0.3, 0.02);
      x.lineTo(size * 0.02, size * 0.12);
      x.closePath();
      x.fill();
      x.restore();
    };
    arm(1, -size * 0.18);
    arm(-1, size * 0.18);
  }
  x.restore();
}
function paintOval(x, w, h, wild) {
  const rx = w * 0.29;
  const ry = h * 0.27;
  x.save();
  x.translate(w / 2, h * 0.53);
  x.rotate(-0.32);
  x.beginPath();
  x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  if (wild) {
    x.save();
    x.clip();
    const boxes = [[-rx, -ry], [0, -ry], [-rx, 0], [0, 0]];
    OVAL.forEach((col, i) => {
      x.fillStyle = col;
      x.fillRect(boxes[i][0], boxes[i][1], rx, ry);
    });
    x.restore();
    x.lineWidth = 8;
    x.strokeStyle = '#fffaf0';
    x.stroke();
  } else {
    x.fillStyle = '#fffaf0';
    x.fill();
  }
  x.restore();
}
function paintCardShell(x, w, h, body) {
  roundRect(x, 0, 0, w, h, 52);
  x.fillStyle = '#fffaf0';
  x.fill();
  roundRect(x, 20, 20, w - 40, h - 40, 40);
  x.fillStyle = body;
  x.fill();
  roundRect(x, 6, 6, w - 12, h - 12, 48);
  x.strokeStyle = '#2a1c14';
  x.lineWidth = 10;
  x.stroke();
}
const backTex = () => canvasTex(512, 768, (x, w, h) => {
  paintCardShell(x, w, h, '#1a120e');
  roundRect(x, 40, 40, w - 80, h - 80, 32);
  x.strokeStyle = '#fffaf0';
  x.lineWidth = 8;
  x.stroke();
  x.save();
  x.translate(w / 2, h * 0.46);
  x.rotate(-0.4);
  x.beginPath();
  x.ellipse(0, 0, 158, 214, 0, 0, Math.PI * 2);
  x.clip();
  const boxes = [[-170, -230], [0, -230], [-170, 0], [0, 0]];
  OVAL.forEach((col, i) => {
    x.fillStyle = col;
    x.fillRect(boxes[i][0], boxes[i][1], 170, 230);
  });
  x.restore();
  x.beginPath();
  x.arc(w / 2, h * 0.46, 86, 0, Math.PI * 2);
  x.fillStyle = '#1a120e';
  x.fill();
  x.lineWidth = 8;
  x.strokeStyle = '#fffaf0';
  x.stroke();
  drawLogo(x, w / 2, h * 0.46, 100, '#fffaf0');
});
let backMap = null;
const faceCache = new Map();
function faceTex(c) {
  const key = c.color + ':' + c.kind + ':' + (c.n == null ? '' : c.n);
  const hit = faceCache.get(key);
  if (hit) return hit;
  const wild = c.kind === 'wild' || c.kind === 'd4';
  const tex = canvasTex(512, 768, (x, w, h) => {
    paintCardShell(x, w, h, wild ? '#1a120e' : (FACE[c.color] ? FACE[c.color].body : '#1a120e'));
    paintOval(x, w, h, wild);
    x.save();
    x.translate(w / 2, h * 0.53);
    if (c.kind === 'd4') {
      x.beginPath();
      x.ellipse(0, 0, 78, 78, 0, 0, Math.PI * 2);
      x.fillStyle = '#1a120e';
      x.fill();
      drawMark(x, c, 108, '#fffaf0');
    } else if (c.kind !== 'wild') {
      drawMark(x, c, c.kind === 'n' ? 196 : 168);
    }
    x.restore();
    const corner = wild ? '#fffaf0' : (c.color === 'y' ? FACE.y.mark : '#fffaf0');
    const pip = c.kind === 'n' ? 86 : 72;
    x.save();
    x.translate(78, 108);
    drawMark(x, c, pip, corner);
    x.restore();
    x.save();
    x.translate(w - 78, h - 108);
    x.rotate(Math.PI);
    drawMark(x, c, pip, corner);
    x.restore();
  });
  tex.userData.shared = true;
  faceCache.set(key, tex);
  return tex;
}
function cardMesh(c, covered) {
  if (!backMap) {
    backMap = backTex();
    backMap.userData.shared = true;
  }
  const map = !c || covered ? backMap : faceTex(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.68),
    new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.2 })
  );
  mesh.userData.kind = 'card';
  mesh.userData.playId = c && c.id || '';
  return mesh;
}
function rebuildCards() {
  for (const c of [...cardRoot.children]) {
    cardRoot.remove(c);
    if (c.geometry) c.geometry.dispose();
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    mats.forEach((mat) => {
      if (mat && mat.map && !mat.map.userData.shared) mat.map.dispose();
      if (mat) mat.dispose();
    });
  }
  if (!current || phase === 'lobby') return;
  const hand = current.hand || [];
  const n = hand.length;
  if (picked >= n) picked = 0;
    const gap = n > 1 ? Math.min(0.36, 3.8 / (n - 1)) : 0;
  hand.forEach((c, i) => {
    const mesh = cardMesh(c, !c);
    const x = (i - (n - 1) / 2) * gap;
    const baseY = 0.98 + i * 0.008;
    const hot = (armed && c.id === armed) || i === picked;
    layCard(mesh, x, hot ? 0.98 + Math.max(n - 1, 0) * 0.008 + 0.1 : baseY, 1.28, n > 12 ? 0.7 : 0.92, (i - (n - 1) / 2) * 0.035);
    mesh.renderOrder = 10 + i;
    mesh.material.polygonOffset = true;
    mesh.material.polygonOffsetFactor = -i - 1;
    mesh.material.polygonOffsetUnits = -4;
    mesh.userData.handIndex = i;
    mesh.userData.playId = c.id;
    mesh.userData.baseY = baseY;
    cardRoot.add(mesh);
  });
  (current.counts || []).forEach((count, i) => {
    if (i === current.you) return;
    const ang = angleFor(i);
    const show = Math.min(count || 0, 4);
    for (let k = 0; k < show; k++) {
      const mesh = cardMesh(null, true);
      const slide = (k - (show - 1) / 2) * 0.03;
      layCard(mesh, Math.cos(ang) * 1.05 + slide, 0.9 + k * 0.012, Math.sin(ang) * 1.05, 0.42, ang);
      mesh.renderOrder = k;
      mesh.material.polygonOffset = true;
      mesh.material.polygonOffsetFactor = -k - 1;
      mesh.material.polygonOffsetUnits = -4;
      mesh.userData.kind = 'back';
      cardRoot.add(mesh);
    }
    const tag = countSprite(count || 0);
    tag.position.set(Math.cos(ang) * 1.05, 1.25, Math.sin(ang) * 1.05);
    cardRoot.add(tag);
  });
  if (current.top) {
    const mesh = cardMesh(current.top, false);
    layCard(mesh, 0.22, 0.9, 0.05, 0.9, 0.08);
    mesh.userData.kind = 'table';
    cardRoot.add(mesh);
  }
  const drawPile = cardMesh(null, true);
  layCard(drawPile, -0.55, 0.9, 0.05, 0.9, -0.04);
  drawPile.userData.kind = 'draw';
  cardRoot.add(drawPile);
  if (INK_HEX[current.color]) {
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.19, 28), new THREE.MeshBasicMaterial({ color: INK_HEX[current.color], side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(0.22, 0.86, 0.48); cardRoot.add(disc);
  }
}
function layCard(mesh, x, y, z, scale, ang) {
  mesh.position.set(x, y, z);
  mesh.scale.setScalar(scale);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(-Math.PI / 2, ang, 0);
}

function pigEars(model) {
  if (model.ears) return model.ears;
  model.ears = model.head.children.filter((c) => c.isGroup && c.position.y > 1.7 && c.position.y < 1.95);
  model.ears.forEach((e) => { if (!e.userData.baseEar) e.userData.baseEar = e.rotation.clone(); });
  return model.ears;
}
function resetSignal(model) {
  setPose(model, 'idle');
  setExpression(model, 'neutral', 0);
  model.head.rotation.set(0, 0, 0);
  for (const e of pigEars(model)) if (e.userData.baseEar) e.rotation.copy(e.userData.baseEar);
  if (model.face) {
    for (const eye of model.face.eyes) eye.scale.set(1, 1, 1);
    for (const brow of model.face.brows) {
      const base = brow.userData.base;
      if (!base) continue;
      brow.position.copy(base.p); brow.quaternion.copy(base.q); brow.scale.set(1, 1, 1);
    }
  }
  if (model.handCup) model.handCup.visible = false;
}
function applySignal(model, id, now) {
  const wave = Math.sin(now / 140);
  if (id === 'brow') model.head.rotation.x = 0.28;
  else if (id === 'wink') { model.head.rotation.z = 0.22; if (model.face && model.face.eyes[0]) model.face.eyes[0].scale.y = 0.08; }
  else if (id === 'ear') {
    pigEars(model).forEach((e, i) => {
      const base = e.userData.baseEar;
      if (base) e.rotation.z = base.z + (i === 0 ? -1 : 1) * (0.45 + wave * 0.35);
    });
  } else if (id === 'laugh') { model.head.rotation.x = wave * 0.18; model.arms.forEach((a, i) => a.rotation.set(-0.4, 0, (i === 0 ? -1 : 1) * 0.9)); }
  else if (id === 'wave') { setPose(model, 'wave'); if (model.arms[1]) model.arms[1].rotation.z = 2.2 + wave * 0.35; }
  else if (id === 'point') model.arms[0].rotation.set(-1.7, 0.35, -0.15);
  else if (id === 'drink') {
    model.head.rotation.x = -0.2;
    model.arms[0].rotation.set(-2.4, 0.5, -0.55);
    if (!model.handCup) {
      model.handCup = makeCup(0.85);
      model.group.add(model.handCup);
    }
    _cupAt.set(0, -0.46, 0.05);
    model.arms[0].localToWorld(_cupAt);
    model.group.worldToLocal(_cupAt);
    model.handCup.position.copy(_cupAt);
    model.handCup.visible = true;
  } else if (id === 'chin') model.arms[0].rotation.set(-0.48, -1.08, 1.6);
}
function showEmote(seat, id) {
  if (!EMOTES.includes(id) || !world) return;
  for (const g of world.children) {
    if (!g.userData || !g.userData.model) continue;
    const model = g.userData.model;
    if (model.group.userData.seat !== seat) continue;
    g.userData.emo = id;
    g.userData.emoUntil = performance.now() + 1600;
    applySignal(model, id, performance.now());
  }
}

function myTurn() {
  return current && !paused && phase === 'play' && current.turn === current.you && (current.phase === 'play' || current.phase === 'drawn' || current.phase === 'color');
}
function sync() { rebuildSeats(); rebuildCards(); paint(); }
function paint() {
  const score = $('unoScore');
  if (score) {
    if (!current || phase === 'lobby') score.innerHTML = '';
    else {
      const bits = [];
      for (let i = 0; i < seatsN; i++) {
        const on = current.turn === i && current.phase !== 'gap' ? ' on' : '';
        bits.push(`<div class="who${on}"><span>${seatName(i)}</span><b>${current.scores[i] || 0}</b><small>${(current.counts && current.counts[i]) || 0} cartas</small></div>`);
      }
      const cor = current.color ? COLOR_NAME[current.color] : 'escolhe a cor';
      const pile = current.pendingDraw ? `<br>Compra ${current.pendingDraw}` : '';
      bits.splice(Math.ceil(seatsN / 2), 0, `<div class="mid">${cor}${pile}<br>meta ${current.target || target}</div>`);
      score.innerHTML = bits.join('');
    }
  }
  const acts = $('unoActs');
  if (acts) {
    acts.innerHTML = '';
    const add = (label, fn, alt, on) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      if (alt) b.className = 'alt'; if (on) b.classList.add('on');
      b.addEventListener('click', fn); acts.appendChild(b);
    };
    if (current && phase === 'play' && !paused) {
      if (current.forgot >= 0 && current.forgot !== current.you) add('Denunciar UNO', () => doAct({ t: 'catchUno' }));
      if (myTurn() && current.phase === 'play' && (current.pendingDraw || !(current.hand || []).some((c) => cardPlayable(current, c)))) add(current.pendingDraw ? 'Comprar ' + current.pendingDraw : 'Comprar', () => doAct({ t: 'draw' }));
      if (myTurn() && current.phase === 'play' && current.pendingKind === 'd4' && current.pendingDraw === 4) add('Contestar +4', () => doAct({ t: 'challenge' }), 'alt');
      if (myTurn() && current.phase === 'drawn') add('Ficar com a carta', () => doAct({ t: 'pass' }), 'alt');
      if (myTurn() && (current.hand || []).length === 2) add(shout ? 'UNO! armado' : 'UNO!', armUno, '', shout);
    }
  }
  const colors = $('unoColors');
  if (colors) {
    const show = myTurn() && (current.phase === 'color' || armed);
    colors.classList.toggle('on', !!show);
    colors.innerHTML = '';
    if (show) {
      for (const col of ['r', 'y', 'g', 'b']) {
        const b = document.createElement('button'); b.type = 'button'; b.className = col; b.setAttribute('aria-label', COLOR_NAME[col]);
        b.addEventListener('click', () => {
          if (current.phase === 'color') doAct({ t: 'color', color: col });
          else if (armed) doAct({ t: 'play', id: armed, color: col, uno: shout });
        });
        colors.appendChild(b);
      }
    }
  }
  const hint = $('unoHint');
  if (hint) {
    if (!current || phase === 'lobby') hint.textContent = 'Clica numa cadeira. O anfitrião inicia.';
    else if (paused) hint.textContent = 'Alguém caiu. A mesa espera um minuto.';
    else if (current.phase === 'gap') hint.textContent = 'Olha a carta.';
    else if (current.phase === 'color' && current.turn === current.you) hint.textContent = current.openingWild ? 'A primeira carta é coringa. Escolhe a cor.' : 'Escolhe a cor.';
    else if (armed) hint.textContent = 'Escolhe a cor do coringa.';
    else if (myTurn() && current.phase === 'drawn') hint.textContent = 'A carta comprada serve. Clica nela ou fica com ela.';
    else if (myTurn() && current.pendingDraw) hint.textContent = 'Empilha outro ' + (current.pendingKind === 'd2' ? '+2' : '+4') + ' ou compra ' + current.pendingDraw + '.';
    else if (myTurn()) hint.textContent = 'Sua vez. Clica na carta.';
    else if (phase === 'over') hint.textContent = 'Partida fechada.';
    else hint.textContent = 'Vez de ' + seatName(current.turn) + '.';
  }
  markTurn();
  const lobby = $('unoLobby'); const over = $('unoOver');
  if (lobby) lobby.style.display = mode === 'online' && phase === 'lobby' ? 'block' : 'none';
  if (over) over.style.display = phase === 'over' ? 'block' : 'none';
  if (lobby && lobby.style.display === 'block') paintLobby();
  if (phase === 'over' && current) {
    const won = current.winner === current.you;
    $('unoOverTitle').textContent = won ? 'Você fechou a mesa!' : seatName(current.winner) + ' fechou a mesa';
    $('unoAgain').style.display = mode === 'local' || myId === hostId ? 'inline-block' : 'none';
  }
  const clock = $('unoClock');
  if (clock) clock.style.display = deadline > Date.now() ? 'block' : 'none';
}
function markTurn() {
  const turn = current && current.phase !== 'gap' && current.phase !== 'over' ? current.turn : -1;
  for (const g of world ? world.children : []) {
    if (!g.userData || g.userData.seat == null || !g.userData.ring) continue;
    g.userData.ring.visible = g.userData.seat === turn;
  }
}
function paintLobby() {
  $('unoLobbyCode').textContent = roomCode ? 'Sala ' + roomCode : '';
  painting = true;
  if ($('unoLobbySeats')) $('unoLobbySeats').value = String(seatsN === 6 ? 6 : seatsN === 4 ? 4 : 2);
  if ($('unoLobbyLevel')) $('unoLobbyLevel').value = level;
  if ($('unoLobbyTarget')) $('unoLobbyTarget').value = String(target);
  const host = myId === hostId;
  ['unoLobbySeats', 'unoLobbyLevel', 'unoLobbyTarget'].forEach((id) => { if ($(id)) $(id).disabled = !host; });
  painting = false;
  const box = $('unoSeats'); box.innerHTML = '';
  for (let i = 0; i < seatsN; i++) {
    const p = players[i];
    const b = document.createElement('button'); b.type = 'button';
    const label = !p || p.empty ? 'Cadeira vazia' : p.name + (p.bot ? ' · bot' : '') + (p.host || p.id === hostId ? ' · anfitrião' : '');
    b.textContent = 'Cadeira ' + (i + 1) + ' · ' + label;
    if (p && p.id === myId) b.className = 'me';
    b.addEventListener('click', () => send({ t: 'sit', seat: i }));
    box.appendChild(b);
  }
  $('unoStart').style.display = host ? 'inline-block' : 'none';
  $('unoFill').checked = fillBots;
  $('unoFill').disabled = !host;
}
function sendSetup() {
  if (painting || mode !== 'online' || myId !== hostId) return;
  send({
    t: 'setup',
    seats: normSeats(Number($('unoLobbySeats').value)),
    level: normLevel($('unoLobbyLevel').value),
    target: normTarget(Number($('unoLobbyTarget').value)),
  });
}

function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  for (const g of world.children) {
    const model = g.userData && g.userData.model;
    if (!model) continue;
    updateExpression(model, dt);
    const p = players[model.group.userData.seat];
    if (p && voiceTalking(p.id) && g.userData.bubble) g.userData.bubble.position.y = 1.35 + Math.sin(now / 120) * 0.04;
    if (g.userData.emoUntil) {
      if (now > g.userData.emoUntil) { resetSignal(model); g.userData.emoUntil = 0; g.userData.emo = ''; }
      else applySignal(model, g.userData.emo, now);
    }
  }
  const clock = $('unoClock');
  if (clock && deadline) { const i = clock.querySelector('i'); if (i) i.style.transform = `scaleX(${Math.max(0, Math.min(1, (deadline - Date.now()) / TURN_MS))})`; }
  renderer.render(scene, camera);
}
function resize() {
  if (!renderer) return;
  const w = app().clientWidth || innerWidth, h = app().clientHeight || innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
function tagOf(obj) { let o = obj; while (o) { if (o.userData && o.userData.kind) return o.userData; o = o.parent; } return null; }
function pick(ev) {
  const rect = $('unoCanvas').getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera({ x, y }, camera);
  const hits = ray.intersectObjects(scene.children, true);
  return hits.length ? tagOf(hits[0].object) : null;
}
function playId(id) {
  const c = (current.hand || []).find((card) => card.id === id);
  if (!c) return;
  if (!cardPlayable(current, c) && current.phase !== 'color') { toast('Essa carta não encaixa'); return; }
  if (c.kind === 'wild' || c.kind === 'd4') { armed = id; rebuildCards(); paint(); return; }
  doAct({ t: 'play', id, uno: shout });
}

function bindTable() {
  const emo = $('unoEmotes');
  for (const id of EMOTES) { const b = document.createElement('button'); b.type = 'button'; b.dataset.emote = id; b.textContent = EMOTE_NAME[id] || id; emo.appendChild(b); }
  $('unoCanvas').addEventListener('click', (ev) => {
    const tag = pick(ev); if (!tag) return;
    if (tag.kind === 'seat' && mode === 'online' && phase === 'lobby') send({ t: 'sit', seat: tag.seat });
    if (!current) return;
    if (tag.kind === 'draw' && myTurn() && current.phase === 'play') doAct({ t: 'draw' });
    if (tag.kind === 'card' && tag.playId && myTurn() && (current.phase === 'play' || current.phase === 'drawn')) playId(tag.playId);
  });
  $('unoCanvas').addEventListener('pointermove', (ev) => {
    const tag = pick(ev);
    if (!tag || tag.handIndex == null || tag.handIndex === picked) return;
    picked = tag.handIndex;
    for (const c of cardRoot.children) {
      if (!c.userData || c.userData.handIndex == null) continue;
      const hot = (armed && c.userData.playId === armed) || c.userData.handIndex === picked;
      const n = (current && current.hand && current.hand.length) || 1;
      c.position.y = hot ? 0.98 + Math.max(n - 1, 0) * 0.008 + 0.1 : (c.userData.baseY || 0.98);
    }
  });
  $('unoCanvas').addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const tag = pick(ev);
    if (tag && tag.kind === 'pig' && tag.pid && tag.pid !== myId) voiceToggleMute(tag.pid);
  });
  $('unoLeave').addEventListener('click', closeTable);
  $('unoEmoteBtn').addEventListener('click', () => $('unoEmotes').classList.toggle('on'));
  $('unoEmotes').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-emote]'); if (!b) return;
    $('unoEmotes').classList.remove('on');
    if (mode === 'local') showEmote(localSeat, b.dataset.emote);
    else send({ t: 'emote', id: b.dataset.emote });
  });
  $('unoSay').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = $('unoSayInput');
    chatSay('all', input.value);
    input.value = '';
  });
  $('unoStart').addEventListener('click', () => send({ t: 'start' }));
  $('unoAgain').addEventListener('click', again);
  $('unoFill').addEventListener('change', () => send({ t: 'fill', on: $('unoFill').checked }));
  $('unoCopy').addEventListener('click', () => { const link = location.origin + location.pathname + '?uno=' + roomCode; navigator.clipboard?.writeText(link).then(() => toast('Link copiado'), () => toast(link)); });
  ['unoLobbySeats', 'unoLobbyLevel', 'unoLobbyTarget'].forEach((id) => $(id).addEventListener('change', sendSetup));
  document.addEventListener('keydown', (ev) => {
    if (!mode || mode === 'boot') return;
    const tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (ev.code === 'Escape') ev.target.blur(); return; }
    ev.stopPropagation(); ev.stopImmediatePropagation();
    if (ev.code === 'KeyK') voicePtt(true);
    if (ev.code === 'KeyJ' && !ev.repeat && mode === 'online') voiceCycle();
    if (ev.code === 'KeyT' && !ev.repeat) { $('unoSayInput').focus(); }
    if (ev.code === 'KeyF' && !ev.repeat) $('unoEmotes').classList.add('on');
    if (ev.code === 'KeyU' && !ev.repeat && myTurn() && current && (current.hand || []).length === 2) armUno();
    if (ev.code === 'Escape') { $('unoEmotes').classList.remove('on'); armed = ''; paint(); return; }
    if (!myTurn() || ev.repeat) return;
    const n = ev.code.startsWith('Digit') ? Number(ev.code.slice(5)) - 1 : -1;
    if (n >= 0 && current.hand && current.hand[n]) playId(current.hand[n].id);
  }, true);
  document.addEventListener('keyup', (ev) => { if (mode && ev.code === 'KeyK') { voicePtt(false); ev.stopPropagation(); } }, true);
}

function hideUnoTab() {
  document.body.classList.remove('uno-menu');
  const panel = $('unoPanel'); if (panel) panel.hidden = true;
  const btn = $('modeUno'); if (btn) btn.classList.remove('on');
}
function showUnoTab() {
  document.body.classList.add('uno-menu');
  document.body.classList.remove('truco-menu');
  $('modeUno').classList.add('on');
  $('modeShoot').classList.remove('on');
  $('modeTruco').classList.remove('on');
  $('unoPanel').hidden = false;
  const trucoPanel = $('trucoPanel'); if (trucoPanel) trucoPanel.hidden = true;
}
function bindMenu() {
  $('modeShoot').addEventListener('click', hideUnoTab);
  $('modeTruco').addEventListener('click', hideUnoTab);
  $('modeUno').addEventListener('click', showUnoTab);
  $('unoBots').addEventListener('click', () => { $('unoMenuErr').textContent = ''; startLocal(readSetup()); });
  $('unoCreate').addEventListener('click', () => { $('unoMenuErr').textContent = ''; createOnline().catch((e) => { closeTable(); $('unoMenuErr').textContent = e.message || 'Sem sala'; }); });
  $('unoJoin').addEventListener('click', () => { $('unoMenuErr').textContent = ''; joinOnline($('unoCode').value); });
  $('unoCode').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('unoJoin').click(); } });
  const preset = new URLSearchParams(location.search).get('uno');
  if (preset) { showUnoTab(); joinOnline(preset); }
}

bindMenu();
bindTable();
addEventListener('resize', resize);

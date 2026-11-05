// Docão Truco: mesa paulista no boteco. As regras moram em shared/truco.js.
import * as THREE from 'three';
import { canvasTex, drawLogo, makeCup, makeDocao, setExpression, setPose, updateExpression } from './docao.js';
import { EMOTES, STAKE_WORD, SUIT_NAME, act, createMatch, dueSeat, nextStake, release, view } from './shared/truco.js';
import { botAct, botName, botSkin } from './shared/truco-bot.js';
import { getSkin } from './skins.js';
import { HTTP_URL, SERVER_URL } from './config.js';
import { chatClear, chatPush, chatSay, chatSeed, chatSetTeam, chatTeamWord, chatUseHooks } from './chat.js';
import { voiceArm, voiceCycle, voicePtt, voiceRefresh, voiceRestore, voiceRoster, voiceSignal, voiceSnap, voiceTalking, voiceToggleMute, voiceUseHooks } from './voice.js';

const $ = (id) => document.getElementById(id);
const EMOTE_NAME = { brow: 'Sombrancelha', wink: 'Piscar', ear: 'Orelha', chin: 'Mogado', point: 'Apontar', laugh: 'Rir', wave: 'Acenar', drink: 'Beber' };
const _cupAt = new THREE.Vector3();
const _crawl = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const SUIT_COLOR = { ouros: '#e0232b', copas: '#e0232b', espadas: '#241814', paus: '#241814' };

let mode = '';
let match = null;
let current = null;
let players = [];
let localSeat = 0;
let myId = 0;
let hostId = 0;
let phase = '';
let seatsN = 4;
let roomCode = '';
let paused = false;
let fillBots = true;
let deadline = 0;
let picked = 0;
let hiding = false;
let crawl = null;
let ws = null;
let wantWs = false;
let tries = 0;
let busy = false;
let pumpTimer = 0;
let answerTimer = 0;
let unchat = null;
let unvoice = null;
let voiceWas = null;
let micArmed = false;
let running = false;
let lastFrame = 0;
let pigKey = '';
let toastTimer = 0;
let renderer, scene, camera, world, cardRoot, ray;

const app = () => $('trucoApp');

function readName() { return ($('nameInput') && $('nameInput').value) || 'Docão'; }
function readSkin() { try { return localStorage.getItem('docao.skin') || 'classico'; } catch (e) { return 'classico'; } }
function myTeam() { return current ? current.team : (seatsN === 2 ? localSeat : localSeat % 2); }
function toast(text) {
  const el = $('trucoToast'); if (!el) return;
  el.textContent = text || ''; el.style.display = text ? 'block' : 'none';
  clearTimeout(toastTimer); if (text) toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2400);
}
function shout(text) {
  const el = $('trucoBanner'); if (el) el.textContent = text;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR'; u.rate = 1.05;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* sem voz */ }
}

function onEvents(events) {
  for (const e of events || []) {
    if (e.t === 'call' || e.t === 'raise') shout((e.word || 'Truco') + '!');
    else if (e.t === 'accept') shout('Aceito!');
    else if (e.t === 'run' || e.t === 'elevenRun') shout('Corre!');
    else if (e.t === 'ferro') chatPush({ sys: 1, text: 'Mão de ferro. Às cegas, sem truco.', at: Date.now() });
    else if (e.t === 'eleven') chatPush({ sys: 1, text: 'Mão de onze. A dupla decide se joga.', at: Date.now() });
    else if (e.t === 'elevenGo') chatPush({ sys: 1, text: 'Aceitaram. A mão vale 3.', at: Date.now() });
    else if (e.t === 'hand') chatPush({ sys: 1, text: e.winner == null ? 'Mão empatada.' : e.winner === myTeam() ? `Nós marcamos ${e.points}.` : `Eles marcaram ${e.points}.`, at: Date.now() });
    else if (e.t === 'match') chatPush({ sys: 1, text: e.winner === myTeam() ? 'Nós fechamos a partida.' : 'Eles fecharam a partida.', at: Date.now() });
    else if (e.t === 'trick' && e.result === 'T') chatPush({ sys: 1, text: 'Rodada empatada.', at: Date.now() });
  }
}

function openTable() {
  if (mode) return;
  mode = 'boot';
  $('menu').classList.add('hidden');
  app().classList.add('on');
  chatTeamWord('Dupla');
  chatSetTeam(seatsN === 4);
  chatClear();
  voiceWas = voiceSnap();
  unchat = chatUseHooks({
    send: (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
    teamMode: () => seatsN === 4,
    me: () => ({ id: myId, name: readName(), team: myTeam(), dead: 0 }),
    shouldLock: () => false, lockPointer() {}, clearKeys() {},
  });
  unvoice = voiceUseHooks({
    send: (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
    teamMode: () => seatsN === 4,
    myId: () => myId,
    order: () => seatsN === 4 ? ['off', 'team', 'all'] : ['off', 'all'],
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
  chatTeamWord('Time'); chatSetTeam(false); chatClear();
  if (voiceWas) voiceRestore(voiceWas);
  voiceWas = null; micArmed = false;
  const u = new URL(location.href); u.searchParams.delete('truco'); history.replaceState(null, '', u);
}

function startLocal(n) {
  seatsN = n === 2 ? 2 : 4;
  const you = { id: 1, name: readName(), skin: readSkin(), bot: false, team: 0, seat: 0, empty: false };
  const gift = Math.random() < 0.25 ? 1 + Math.floor(Math.random() * (seatsN - 1)) : -1;
  const taken = [you.name];
  const worn = [you.skin];
  players = [you];
  for (let i = 1; i < seatsN; i++) {
    const name = botName(taken, i === gift);
    const skin = botSkin(worn);
    taken.push(name);
    worn.push(skin);
    players.push({ id: i + 1, name, skin, bot: true, team: seatsN === 2 ? 1 : i % 2, seat: i, empty: false });
  }
  localSeat = 0; myId = 1; hostId = 1; phase = 'play'; paused = false; roomCode = '';
  match = createMatch({ seats: seatsN, seed: (Math.random() * 1e9) | 0 });
  current = view(match, 0);
  openTable();
  mode = 'local';
  chatSetTeam(seatsN === 4);
  onEvents(match.events);
  sync();
  schedule();
}

async function createOnline() {
  const seats = $('trucoSeatsSel').value === '2' ? 2 : 4;
  const r = await fetch(HTTP_URL + '/api/truco/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seats }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.code) throw new Error(j.error || 'Servidor indisponível');
  seatsN = seats;
  openTable();
  mode = 'online';
  connect(j.code);
}
function joinOnline(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (code.length !== 4) { $('trucoMenuErr').textContent = 'O código tem 4 letras.'; return; }
  openTable();
  mode = 'online';
  connect(code);
}
function connect(code) {
  roomCode = code; wantWs = true;
  const u = new URL(location.href); u.searchParams.set('truco', code); history.replaceState(null, '', u);
  const token = sessionStorage.getItem('docao.truco.' + code) || '';
  const qs = new URLSearchParams({ name: readName(), skin: readSkin(), token });
  const sock = new WebSocket(`${SERVER_URL}/ws/truco/${code}?${qs}`);
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
    try { sessionStorage.setItem('docao.truco.' + m.code, m.token); } catch (e) { /* sem storage */ }
    chatSeed(m.chat || []);
  } else if (m.t === 'state') {
    busy = false; phase = m.phase; hostId = m.hostId; localSeat = m.you; players = m.players || []; seatsN = (m.view && m.view.seats) || players.length || seatsN;
    paused = !!m.paused; fillBots = m.fill !== false; current = m.view; deadline = m.deadline || 0;
    chatSetTeam(seatsN === 4);
    voiceRefresh();
    if (phase === 'play') maybeArm();
    sync();
  } else if (m.t === 'events') onEvents(m.events);
  else if (m.t === 'chat') chatPush(m);
  else if (m.t === 'voices') voiceRoster(m.list);
  else if (m.t === 'sig') voiceSignal(m.from, m.kind, m.data);
  else if (m.t === 'emote') showEmote(m.seat, m.id);
  else if (m.t === 'error') { busy = false; toast(m.msg || 'Não deu'); }
}

async function maybeArm() {
  if (micArmed) return;
  const others = players.filter((p) => p && !p.empty && !p.bot && p.id !== myId);
  if (!others.length) return;
  micArmed = true;
  const withPartner = seatsN === 4 && others.some((p) => p.team === myTeam());
  await voiceArm(withPartner ? 'team' : 'all', 'open');
}

function doAct(action) {
  hiding = false;
  clearTimeout(answerTimer);
  if (mode === 'local') {
    const r = act(match, localSeat, action);
    if (!r.ok) { toast(r.error); schedule(); return; }
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
  if (match.phase === 'over') { phase = 'over'; paint(); return; }
  if (match.phase === 'gap') {
    pumpTimer = setTimeout(() => {
      const r = release(match);
      if (r.ok) onEvents(r.events);
      current = view(match, localSeat);
      phase = match.phase === 'over' ? 'over' : 'play';
      sync(); schedule();
    }, 1200);
    paint();
    return;
  }
  const seat = dueSeat(match, (s) => players[s] && players[s].bot);
  const who = players[seat];
  if (who && who.bot) {
    pumpTimer = setTimeout(() => {
      const picked = botAct(match, seat, Math.random);
      if (!picked) return;
      const r = act(match, seat, picked.action);
      if (picked.bark) chatPush({ id: who.id, name: who.name, team: who.team, scope: 'all', text: picked.bark, at: Date.now() });
      if (picked.emote) showEmote(seat, picked.emote);
      if (r.ok) onEvents(r.events);
      current = view(match, localSeat);
      phase = match.phase === 'over' ? 'over' : 'play';
      sync(); schedule();
    }, 700);
    return;
  }
  if (match.phase === 'respond' || match.phase === 'eleven') deadline = Date.now() + 25000;
  else deadline = 0;
  if ((match.phase === 'respond' || match.phase === 'eleven') && seat === localSeat) {
    answerTimer = setTimeout(() => {
      if (match.phase === 'respond') doAct({ t: 'answer', a: 'run' });
      else if (match.phase === 'eleven') doAct({ t: 'eleven', play: false });
    }, 25000);
  }
  paint();
}

function again() {
  if (mode === 'local') {
    match = createMatch({ seats: seatsN, seed: (Math.random() * 1e9) | 0 });
    current = view(match, 0); phase = 'play';
    onEvents(match.events); sync(); schedule();
  } else send({ t: 'again' });
}

function ensureWorld() {
  if (renderer) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3d7a4);
  scene.fog = new THREE.Fog(0xf3d7a4, 8, 18);
  camera = new THREE.PerspectiveCamera(52, 1, 0.1, 40);
  camera.position.set(0, 6.15, 0.7);
  camera.lookAt(0, 0.78, 0);
  renderer = new THREE.WebGLRenderer({ canvas: $('trucoCanvas'), antialias: true });
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
  box(8, 2.4, 0.3, 0xe7d3b0, 0, 1.2, -3.3);
  box(0.3, 2.4, 6, 0xd9b48a, -3.6, 1.2, -0.4);
  box(3.2, 1.05, 0.7, 0x6b3e26, -2.2, 0.55, -2.5);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.1, 28), new THREE.MeshLambertMaterial({ color: 0x8a5430 }));
  table.position.y = 0.78; world.add(table);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.74, 10), new THREE.MeshLambertMaterial({ color: 0x5c3a22 }));
  leg.position.y = 0.36; world.add(leg);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * (Math.PI / 2);
    const cup = makeCup(0.38); cup.position.set(Math.cos(a) * 1.02, 0.84, Math.sin(a) * 1.02); world.add(cup);
  }
  for (let i = 0; i < 8; i++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe7a8 : 0xfff0cc }));
    bulb.position.set(-2.4 + i * 0.7, 2.15, -3.1); world.add(bulb);
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
  const key = players.map((p) => (p ? p.id + ':' + p.skin + ':' + p.name + ':' + (p.bot ? 1 : 0) : '-')).join('|') + '@' + localSeat;
  if (key === pigKey) return;
  pigKey = key;
  for (const c of [...world.children]) if (c.userData.seatGroup) world.remove(c);
  players.forEach((p, i) => {
    if (i >= seatsN) return;
    const ang = angleFor(i);
    const g = new THREE.Group();
    g.userData.seatGroup = 1;
    g.position.set(Math.cos(ang) * 1.5, 0, Math.sin(ang) * 1.5);
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
      bubble.position.set(1.25, 1.15, 0.15); g.add(bubble); g.userData.bubble = bubble;
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

const backTex = () => canvasTex(256, 384, (x, w, h) => {
  x.fillStyle = '#f7f1e4'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#a5121a'; x.lineWidth = 14; x.strokeRect(10, 10, w - 20, h - 20);
  const gr = x.createLinearGradient(70, 0, 190, 0);
  gr.addColorStop(0, '#a5121a'); gr.addColorStop(0.5, '#e0232b'); gr.addColorStop(1, '#a5121a');
  x.fillStyle = gr; x.beginPath(); x.moveTo(78, 78); x.lineTo(178, 78); x.lineTo(166, 268); x.quadraticCurveTo(128, 292, 90, 268); x.closePath(); x.fill();
  x.fillStyle = '#ffffff'; x.fillRect(74, 64, 108, 16);
  drawLogo(x, 128, 168, 72, '#f5e6d0');
});
let backMap = null;
function faceTex(card) {
  return canvasTex(256, 384, (x, w, h) => {
    x.fillStyle = '#fffaf0'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#34402e'; x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = SUIT_COLOR[card.s] || '#241814';
    x.font = '900 64px Trebuchet MS, Arial'; x.textAlign = 'left'; x.fillText(card.r, 24, 78);
    x.save(); x.translate(128, 210); drawSuit(x, card.s, 70); x.restore();
  });
}
function drawSuit(x, suit, r) {
  x.beginPath();
  if (suit === 'ouros') { x.moveTo(0, -r); x.lineTo(r * 0.7, 0); x.lineTo(0, r); x.lineTo(-r * 0.7, 0); }
  else if (suit === 'copas') {
    x.arc(-r * 0.32, -r * 0.15, r * 0.38, Math.PI, 0); x.arc(r * 0.32, -r * 0.15, r * 0.38, Math.PI, 0);
    x.lineTo(0, r * 0.85); x.lineTo(-r * 0.7, -r * 0.05);
  } else if (suit === 'paus') {
    x.arc(0, -r * 0.25, r * 0.32, 0, Math.PI * 2); x.moveTo(-r * 0.38, r * 0.2); x.arc(-r * 0.38, r * 0.2, r * 0.32, 0, Math.PI * 2);
    x.moveTo(r * 0.38, r * 0.2); x.arc(r * 0.38, r * 0.2, r * 0.32, 0, Math.PI * 2);
  } else {
    x.moveTo(0, -r); x.lineTo(r * 0.16, -r * 0.1); x.lineTo(r * 0.08, r); x.lineTo(-r * 0.08, r); x.lineTo(-r * 0.16, -r * 0.1);
  }
  x.closePath(); x.fill();
}
function cardMesh(card, covered) {
  if (!backMap) backMap = backTex();
  const map = !card || covered ? backMap : faceTex(card);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.5), new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
  mesh.userData.kind = 'card'; mesh.userData.playId = card && card.id || ''; mesh.userData.blind = !card;
  return mesh;
}
function rebuildCards() {
  for (const c of [...cardRoot.children]) {
    cardRoot.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material && c.material.map && c.material.map !== backMap) c.material.map.dispose();
    if (c.material) c.material.dispose();
  }
  if (!current) return;
  const hand = current.hand || [];
  if (picked >= hand.length) picked = 0;
  hand.forEach((card, i) => {
    const mesh = cardMesh(card, !card);
    const x = (i - (hand.length - 1) / 2) * 0.42;
    layCard(mesh, x, i === picked ? 0.96 : 0.9, 0.98, 0.78, 0);
    mesh.userData.handIndex = i;
    cardRoot.add(mesh);
  });
  (current.partnerHand || []).forEach((card, i) => {
    const mesh = cardMesh(card, false);
    const ang = angleFor(current.partner);
    layCard(mesh, Math.cos(ang) * 0.95 + (i - 1) * 0.28, 0.9, Math.sin(ang) * 0.95, 0.5, ang);
    cardRoot.add(mesh);
  });
  (current.trick || []).forEach((p) => {
    const ang = angleFor(p.seat);
    const mesh = cardMesh(p.card, p.covered || !p.card);
    layCard(mesh, Math.cos(ang) * 0.58, 0.86, Math.sin(ang) * 0.58, 1.05, 0);
    mesh.userData.kind = 'table';
    cardRoot.add(mesh);
  });
  if (current.vira) {
    const mesh = cardMesh(current.vira, false);
    layCard(mesh, 0, 0.875, 0, 0.95, 0);
    mesh.userData.kind = 'table';
    cardRoot.add(mesh);
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
      brow.position.copy(base.p);
      brow.quaternion.copy(base.q);
      brow.scale.set(1, 1, 1);
    }
  }
  if (model.point) {
    model.point.visible = false;
    model.point.scale.setScalar(1);
    if (model.point.parent !== model.arms[0]) model.arms[0].attach(model.point);
    model.point.position.set(0, 0, 0);
    model.point.rotation.set(0, 0, 0);
  }
  if (model.handCup) model.handCup.visible = false;
}
function raiseBrow(model) {
  model.head.rotation.x = 0.28;
  const brow = model.face && model.face.brows[0];
  const base = brow && brow.userData.base;
  if (!base) return;
  brow.position.copy(base.p);
  brow.position.y += 0.22;
  brow.quaternion.copy(base.q);
  brow.rotateZ(-1.05);
  brow.scale.set(1.55, 1.25, 1.55);
}
function handCup(model) {
  if (!model.handCup) {
    const cup = makeCup(0.85);
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (x) => drawLogo(x, 64, 64, 108, '#f5e6d0')), transparent: true, depthTest: false })
    );
    logo.position.set(0, 0.16, 0.09);
    cup.add(logo);
    model.handCup = cup;
    model.handLogo = logo;
    model.group.add(cup);
    cup.visible = false;
  }
  _cupAt.set(0, -0.46, 0.05);
  model.arms[0].localToWorld(_cupAt);
  model.group.worldToLocal(_cupAt);
  model.handCup.position.copy(_cupAt);
  model.handCup.rotation.set(0.35, 0, 0);
  model.handLogo.lookAt(camera.position);
  model.handCup.visible = true;
}
function strokeChin(model, now) {
  const slide = Math.sin(now / 150);
  setPose(model, 'idle');
  model.arms[0].rotation.set(-0.48, -1.08 + slide * 0.22, 1.6);
  if (model.point) model.point.visible = false;
}
function applySignal(model, id, now) {
  const wave = Math.sin(now / 140);
  if (id === 'brow') raiseBrow(model);
  else if (id === 'wink') {
    model.head.rotation.z = 0.22;
    if (model.face && model.face.eyes[0]) model.face.eyes[0].scale.y = 0.08;
  } else if (id === 'ear') {
    pigEars(model).forEach((e, i) => {
      const base = e.userData.baseEar;
      if (!base) return;
      e.rotation.z = base.z + (i === 0 ? -1 : 1) * (0.45 + wave * 0.35);
    });
  } else if (id === 'chin') strokeChin(model, now);
  else if (id === 'point') model.arms[0].rotation.set(-1.7, 0.35, -0.15);
  else if (id === 'laugh') {
    model.head.rotation.x = wave * 0.18;
    model.arms.forEach((a, i) => a.rotation.set(-0.4, 0, (i === 0 ? -1 : 1) * 0.9));
  } else if (id === 'wave') {
    setPose(model, 'wave');
    if (model.arms[1]) model.arms[1].rotation.z = 2.2 + wave * 0.35;
  } else if (id === 'drink') {
    model.head.rotation.x = -0.2;
    model.arms[0].rotation.set(-2.4, 0.5, -0.55);
    handCup(model);
  }
}
function showEmote(seat, id) {
  if (!EMOTES.includes(id)) return;
  for (const g of world.children) {
    if (!g.userData || !g.userData.model) continue;
    const model = g.userData.model;
    if (model.group.userData.seat !== seat) continue;
    g.userData.emo = id;
    g.userData.emoUntil = performance.now() + (id === 'chin' ? 2200 : 1600);
    applySignal(model, id, performance.now());
  }
}

function sync() { rebuildSeats(); rebuildCards(); paint(); }
function paint() {
  const score = $('trucoScore');
  const us = current ? current.scores[current.team] : 0;
  const them = current ? current.scores[current.team === 0 ? 1 : 0] : 0;
  if (score) {
    const word = current && current.pending ? current.pending.word : current && current.stake > 1 ? (STAKE_WORD[current.stake] || '') : '';
    const viraBit = current && current.vira ? `Vira ${current.vira.r} de ${SUIT_NAME[current.vira.s] || ''}` : '';
    const maniBit = current && current.manilha ? `Manilha ${current.manilha}` : '';
    const stakeBit = paused ? 'Mesa pausada' : word ? 'Mão: ' + word : current && current.ferro ? 'Mão de ferro' : current && current.phase === 'eleven' ? 'Mão de onze' : 'Mão vale ' + ((current && current.stake) || 1);
    score.innerHTML = `<div><span>NÓS</span><b>${us}</b></div><div class="stake">${stakeBit}${viraBit ? '<br>' + viraBit : ''}${maniBit ? '<br>' + maniBit : ''}</div><div><span>ELES</span><b>${them}</b></div>`;
  }
  const acts = $('trucoActs');
  if (acts) {
    const btns = [];
    if (current && !paused && phase === 'play') {
      if (current.phase === 'eleven' && current.eleven === current.team) {
        btns.push(['Jogar a mão', () => doAct({ t: 'eleven', play: true })]);
        btns.push(['Correr (dá 1)', () => doAct({ t: 'eleven', play: false }), 'alt']);
      }
      if (current.phase === 'respond' && current.pending && current.pending.team !== current.team) {
        btns.push(['Aceitar ' + current.pending.word, () => doAct({ t: 'answer', a: 'accept' })]);
        btns.push(['Correr', () => doAct({ t: 'answer', a: 'run' }), 'alt']);
        if (nextStake(current.pending.value)) btns.push(['Pedir ' + (STAKE_WORD[nextStake(current.pending.value)] || ''), () => doAct({ t: 'answer', a: 'raise' })]);
      }
      if (current.phase === 'play' && current.turn === current.you && !current.ferro && !current.pending && nextStake(current.stake) && current.lastRaiseTeam !== current.team) {
        const w = STAKE_WORD[nextStake(current.stake)];
        btns.push(['Pedir ' + w, () => doAct({ t: 'call' })]);
      }
      if (current.phase === 'play' && current.turn === current.you && !current.ferro && !current.blind) {
        btns.push([current.stake > 1 ? 'Correr (dá ' + current.stake + ')' : 'Correr', () => doAct({ t: 'run' }), 'alt']);
      }
      if (current.phase === 'play' && current.turn === current.you && current.tricks && current.tricks.length >= 1 && !current.blind) {
        btns.push([hiding ? 'Cancela' : 'Esconder', armHide, 'alt']);
      } else hiding = false;
    }
    acts.innerHTML = '';
    for (const [label, fn, alt] of btns) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (alt) b.className = 'alt';
      b.addEventListener('click', fn); acts.appendChild(b);
    }
  }
  const hint = $('trucoHint');
  if (hint) {
    if (!current || phase === 'lobby') hint.textContent = 'Clica numa cadeira. O anfitrião inicia.';
    else if (paused) hint.textContent = 'Alguém caiu. A mão espera um minuto.';
    else if (current.phase === 'gap') hint.textContent = 'Olha a rodada.';
    else if (current.phase === 'eleven') hint.textContent = current.eleven === current.team ? 'Mão de onze. Vocês decidem se jogam.' : 'Mão de onze. A outra dupla decide.';
    else if (current.phase === 'respond') hint.textContent = current.pending && current.pending.team !== current.team ? `Eles pediram ${current.pending.word}.` : 'Esperando a resposta.';
    else if (current.phase === 'play' && current.turn === current.you) hint.textContent = current.blind ? 'Mão de ferro. Clica para jogar a próxima carta às cegas.' : hiding ? 'Clica na carta que você quer esconder.' : 'Sua vez. Clica na carta, ou aperta 1, 2 e 3.';
    else if (phase === 'over') hint.textContent = isShutout() ? 'Por baixo da mesa!' : 'Partida fechada.';
    else hint.textContent = 'Vez de ' + ((players[current.turn] && players[current.turn].name) || '...');
  }
  markTurn();
  shameWalk();
  const lobby = $('trucoLobby'); const over = $('trucoOver');
  const crawling = crawl && performance.now() - crawl.t0 < 3100;
  if (lobby) lobby.style.display = mode === 'online' && phase === 'lobby' ? 'block' : 'none';
  if (over) over.style.display = phase === 'over' && !crawling ? 'block' : 'none';
  if (lobby && lobby.style.display === 'block') paintLobby();
  if (phase === 'over') {
    const won = current && current.winner != null && current.winner === current.team;
    $('trucoOverTitle').textContent = isShutout() ? (won ? '12 a 0. Eles vão por baixo!' : '12 a 0. Por baixo da mesa!') : won ? 'Fechamos!' : current && current.winner != null ? 'Eles fecharam' : 'Fim de jogo';
    $('trucoAgain').style.display = mode === 'local' || myId === hostId ? 'inline-block' : 'none';
  }
  const clock = $('trucoClock');
  if (clock) clock.style.display = deadline > Date.now() ? 'block' : 'none';
}
function armHide() {
  hiding = !hiding;
  for (const c of cardRoot.children) {
    if (c.userData && c.userData.handIndex != null) c.position.y = hiding ? 0.98 : 0.9;
  }
  paint();
}
function markTurn() {
  const turn = current && (current.phase === 'play' || current.phase === 'respond' || current.phase === 'eleven') ? current.turn : -1;
  for (const g of world ? world.children : []) {
    if (!g.userData || g.userData.seat == null || !g.userData.ring) continue;
    g.userData.ring.visible = g.userData.seat === turn;
  }
}
function paintLobby() {
  $('trucoLobbyCode').textContent = roomCode ? 'Sala ' + roomCode : '';
  const box = $('trucoSeats'); box.innerHTML = '';
  for (let i = 0; i < seatsN; i++) {
    const p = players[i];
    const b = document.createElement('button'); b.type = 'button';
    const label = !p || p.empty ? 'Cadeira vazia' : p.name + (p.bot ? ' · bot' : '') + (p.host || p.id === hostId ? ' · anfitrião' : '');
    b.textContent = (p && p.team === 0 ? 'Dupla A · ' : 'Dupla B · ') + label;
    if (p && p.id === myId) b.className = 'me';
    b.addEventListener('click', () => send({ t: 'sit', seat: i }));
    box.appendChild(b);
  }
  $('trucoStart').style.display = myId === hostId ? 'inline-block' : 'none';
  $('trucoFill').checked = fillBots;
}

function isShutout() {
  if (!current || current.winner == null || !current.scores) return false;
  const loser = current.winner === 0 ? 1 : 0;
  return current.scores[current.winner] >= 12 && current.scores[loser] === 0;
}
function seatTeam(seat) { return seatsN === 2 ? seat : seat % 2; }
function shameWalk() {
  if (phase !== 'over' || !isShutout()) { crawl = null; return; }
  if (crawl && crawl.key === pigKey) return;
  const loser = current.winner === 0 ? 1 : 0;
  const groups = [];
  for (const g of world.children) {
    if (!g.userData || !g.userData.model) continue;
    const model = g.userData.model;
    const seat = model.group.userData.seat;
    if (seatTeam(seat) !== loser) { showEmote(seat, 'laugh'); continue; }
    g.userData.emoUntil = 0;
    g.userData.crawlSide = seat % 2 ? -0.38 : 0.38;
    setPose(model, 'idle');
    model.legs.forEach((leg) => { leg.rotation.x = -0.25; });
    if (g.userData.bubble) g.userData.bubble.visible = false;
    groups.push(g);
  }
  crawl = { t0: performance.now(), groups, key: pigKey };
  chatPush({ sys: 1, text: '12 a 0. Por baixo da mesa!', at: Date.now() });
}
function tickCrawl(now) {
  if (!crawl) return;
  const t = (now - crawl.t0) / 1000;
  const dive = Math.min(1, t / 0.5);
  const slide = Math.max(0, Math.min(1, (t - 0.22) / 2.7));
  const ease = slide * slide * (3 - 2 * slide);
  const dist = ease * 2.4;
  for (const g of crawl.groups) {
    const model = g.userData.model;
    if (!model) continue;
    g.updateMatrixWorld(true);
    _fwd.set(0, 0, 1).transformDirection(g.matrixWorld);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.set(1, 0, 0).transformDirection(g.matrixWorld);
    _right.y = 0;
    _right.normalize();
    g.getWorldPosition(_crawl);
    _crawl.addScaledVector(_fwd, dist).addScaledVector(_right, g.userData.crawlSide || 0);
    _crawl.y = 0.04 + (slide > 0 && slide < 1 ? Math.abs(Math.sin(t * 14)) * 0.03 : 0);
    g.worldToLocal(_crawl);
    model.group.scale.set(1, 1 - dive * 0.7, 1);
    model.group.rotation.set(dive * 1.05, 0, 0);
    model.group.position.copy(_crawl);
    if (slide > 0 && slide < 1) model.legs.forEach((leg, i) => { leg.rotation.x = -0.35 + Math.sin(t * 13 + i * Math.PI) * 0.6; });
  }
  if (t > 3.1) {
    const over = $('trucoOver');
    if (over && phase === 'over') over.style.display = 'block';
  }
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
    if (p && voiceTalking(p.id) && g.userData.bubble) g.userData.bubble.position.y = 1.15 + Math.sin(now / 120) * 0.04;
    if (g.userData.emoUntil) {
      if (now > g.userData.emoUntil) { resetSignal(model); g.userData.emoUntil = 0; g.userData.emo = ''; }
      else applySignal(model, g.userData.emo, now);
    }
  }
  tickCrawl(now);
  const clock = $('trucoClock');
  if (clock && deadline) { const i = clock.querySelector('i'); if (i) i.style.transform = `scaleX(${Math.max(0, Math.min(1, (deadline - Date.now()) / 25000))})`; }
  renderer.render(scene, camera);
}
function resize() {
  if (!renderer) return;
  const w = app().clientWidth || innerWidth, h = app().clientHeight || innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
function tagOf(obj) { let o = obj; while (o) { if (o.userData && o.userData.kind) return o.userData; o = o.parent; } return null; }
function pick(ev) {
  const rect = $('trucoCanvas').getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera({ x, y }, camera);
  const hits = ray.intersectObjects(scene.children, true);
  return hits.length ? tagOf(hits[0].object) : null;
}

function bindTable() {
  const emo = $('trucoEmotes');
  for (const id of EMOTES) { const b = document.createElement('button'); b.type = 'button'; b.dataset.emote = id; b.textContent = EMOTE_NAME[id] || id; emo.appendChild(b); }
  const canvas = $('trucoCanvas');
  canvas.addEventListener('click', (ev) => {
    const tag = pick(ev); if (!tag) return;
    if (tag.kind === 'seat' && mode === 'online' && phase !== 'play') send({ t: 'sit', seat: tag.seat });
    if (tag.kind === 'card' && current && current.phase === 'play' && current.turn === current.you) {
      if (current.blind || tag.blind) doAct({ t: 'play' });
      else if (tag.playId) doAct({ t: 'play', id: tag.playId, cover: hiding });
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    const tag = pick(ev);
    if (hiding || !tag || tag.handIndex == null || tag.handIndex === picked) return;
    picked = tag.handIndex;
    for (const c of cardRoot.children) {
      if (c.userData && c.userData.handIndex != null) c.position.y = c.userData.handIndex === picked ? 0.96 : 0.9;
    }
  });
  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const tag = pick(ev);
    if (tag && tag.kind === 'pig' && tag.pid && tag.pid !== myId) voiceToggleMute(tag.pid);
  });
  $('trucoLeave').addEventListener('click', closeTable);
  $('trucoEmoteBtn').addEventListener('click', () => $('trucoEmotes').classList.toggle('on'));
  $('trucoEmotes').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-emote]'); if (!b) return;
    const id = b.dataset.emote;
    $('trucoEmotes').classList.remove('on');
    if (mode === 'local') showEmote(localSeat, id);
    else send({ t: 'emote', id });
  });
  $('trucoSay').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = $('trucoSayInput');
    chatSay($('trucoSay').dataset.scope || 'all', input.value);
    input.value = '';
  });
  $('trucoStart').addEventListener('click', () => send({ t: 'start' }));
  $('trucoAgain').addEventListener('click', again);
  $('trucoFill').addEventListener('change', () => send({ t: 'fill', on: $('trucoFill').checked }));
  $('trucoCopy').addEventListener('click', () => { const link = location.origin + location.pathname + '?truco=' + roomCode; navigator.clipboard?.writeText(link).then(() => toast('Link copiado'), () => toast(link)); });
  document.addEventListener('keydown', (ev) => {
    if (!mode || mode === 'boot') return;
    const tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') { if (ev.code === 'Escape') ev.target.blur(); return; }
    ev.stopPropagation(); ev.stopImmediatePropagation();
    if (ev.code === 'KeyK') voicePtt(true);
    if (ev.code === 'KeyJ' && !ev.repeat && mode === 'online') voiceCycle();
    if (ev.code === 'KeyT' && !ev.repeat) { $('trucoSay').dataset.scope = 'all'; $('trucoSayInput').placeholder = 'Mensagem da mesa'; $('trucoSayInput').focus(); }
    if (ev.code === 'KeyY' && !ev.repeat && seatsN === 4) { $('trucoSay').dataset.scope = 'team'; $('trucoSayInput').placeholder = 'Mensagem da dupla'; $('trucoSayInput').focus(); }
    if (ev.code === 'KeyF' && !ev.repeat) $('trucoEmotes').classList.add('on');
    if (ev.code === 'Escape') { $('trucoEmotes').classList.remove('on'); if (hiding) armHide(); return; }
    if (!current || current.turn !== current.you || current.phase !== 'play' || ev.repeat) return;
    const n = ev.code === 'Digit1' ? 0 : ev.code === 'Digit2' ? 1 : ev.code === 'Digit3' ? 2 : -1;
    if (n < 0) return;
    if (current.blind) { if (n === 0) doAct({ t: 'play' }); return; }
    const card = current.hand && current.hand[n];
    if (card) doAct({ t: 'play', id: card.id, cover: hiding || ev.shiftKey });
  }, true);
  document.addEventListener('keyup', (ev) => { if (mode && ev.code === 'KeyK') { voicePtt(false); ev.stopPropagation(); } }, true);
}

function bindMenu() {
  $('modeShoot').addEventListener('click', () => { document.body.classList.remove('truco-menu'); $('modeShoot').classList.add('on'); $('modeTruco').classList.remove('on'); $('trucoPanel').hidden = true; const unoPanel = $('unoPanel'); if (unoPanel) unoPanel.hidden = true; const modeUno = $('modeUno'); if (modeUno) modeUno.classList.remove('on'); document.body.classList.remove('uno-menu'); });
  $('modeTruco').addEventListener('click', () => { document.body.classList.add('truco-menu'); document.body.classList.remove('uno-menu'); $('modeTruco').classList.add('on'); $('modeShoot').classList.remove('on'); $('trucoPanel').hidden = false; const unoPanel = $('unoPanel'); if (unoPanel) unoPanel.hidden = true; const modeUno = $('modeUno'); if (modeUno) modeUno.classList.remove('on'); });
  $('trucoBots').addEventListener('click', () => { $('trucoMenuErr').textContent = ''; startLocal($('trucoSeatsSel').value === '2' ? 2 : 4); });
  $('trucoCreate').addEventListener('click', () => { $('trucoMenuErr').textContent = ''; createOnline().catch((e) => { closeTable(); $('trucoMenuErr').textContent = e.message || 'Sem sala'; }); });
  $('trucoJoin').addEventListener('click', () => { $('trucoMenuErr').textContent = ''; joinOnline($('trucoCode').value); });
  $('trucoCode').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('trucoJoin').click(); } });
  const preset = new URLSearchParams(location.search).get('truco');
  if (preset) { document.body.classList.add('truco-menu'); $('modeTruco').classList.add('on'); $('modeShoot').classList.remove('on'); $('trucoPanel').hidden = false; joinOnline(preset); }
}

bindMenu();
bindTable();
addEventListener('resize', resize);

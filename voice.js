// Voz da sala: o áudio vai de navegador a navegador (WebRTC). O servidor só apresenta os jogadores.
// O mesmo AudioContext do jogo. Um segundo contexto deixa o Safari mudo.
import { sharedAudio, unlockAudio } from './audio.js';
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const $ = (id) => document.getElementById(id);

let hooks = { send() {}, teamMode() { return false; }, myId() { return 0; }, onChange() {} };
let scope = 'off';
let mode = 'hold'; // hold = só enquanto K está presa; open = microfone ligado o tempo todo
let stream = null;
let ptt = false;
let away = false;
let localAn = null;
let roster = new Map();
let peers = new Map();
let muted = new Set();
let talking = new Set();
let actx = null;

export function voiceTalking(id) { return talking.has(id); }
export function voiceMuted(id) { return muted.has(id); }
export function voiceToggleMute(id) {
  if (!id) return;
  if (muted.has(id)) muted.delete(id); else muted.add(id);
  const rec = peers.get(id); if (rec && rec.audio) rec.audio.volume = muted.has(id) ? 0 : 1;
  hooks.onChange();
}
export function voiceScope() { return scope; }
export function voiceSnap() { return { scope, mode }; }
export function voiceCycle() {
  const order = hooks.order ? hooks.order() : hooks.teamMode() ? ['off', 'all', 'team'] : ['off', 'all'];
  const i = order.indexOf(scope);
  setScope(order[(i < 0 ? 0 : i + 1) % order.length]);
}
export function voiceUseHooks(next) {
  const prev = hooks;
  hooks = { ...hooks, ...next };
  return () => { hooks = prev; };
}
export async function voiceArm(nextScope, nextMode) {
  const prev = { scope, mode };
  let scopeTo = nextScope === 'team' || nextScope === 'all' ? nextScope : 'off';
  if (scopeTo === 'team' && !hooks.teamMode()) scopeTo = 'all';
  if (scopeTo !== 'off') { const ok = await ensureMic(); if (!ok) return prev; }
  mode = nextMode === 'open' ? 'open' : 'hold';
  scope = scopeTo; ptt = false;
  const mine = roster.get(hooks.myId()); if (mine) mine.scope = scope;
  applyMic();
  hooks.send({ t: 'voice', scope });
  syncPeers(); paint();
  return prev;
}
export function voiceRestore(prev) {
  if (!prev) return;
  scope = prev.scope === 'team' || prev.scope === 'all' ? prev.scope : 'off';
  if (scope === 'team' && !hooks.teamMode()) scope = 'all';
  mode = prev.mode === 'open' ? 'open' : 'hold';
  ptt = false;
  const mine = roster.get(hooks.myId()); if (mine) mine.scope = scope;
  applyMic();
  hooks.send({ t: 'voice', scope });
  syncPeers(); paint();
}

export function initVoice(h) {
  hooks = h;
  try { mode = localStorage.getItem('docao.voice.gate') === 'open' ? 'open' : 'hold'; } catch (e) { mode = 'hold'; }
  document.querySelectorAll('[data-voicebox] [data-voice]').forEach((b) => { b.addEventListener('click', () => setScope(b.dataset.voice)); });
  document.querySelectorAll('[data-voicebox] [data-mic]').forEach((b) => { b.addEventListener('click', () => setMode(b.dataset.mic)); });
  const unlock = () => { resume(); for (const rec of peers.values()) if (rec.audio) rec.audio.play().catch(() => {}); };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  window.addEventListener('blur', () => { away = true; ptt = false; applyMic(); });
  window.addEventListener('focus', () => { away = false; applyMic(); });
  setInterval(sample, 120);
  paint();
}

export function voicePtt(down) {
  if (mode === 'open') return;
  if (scope === 'off' || !stream || away) { ptt = false; applyMic(); return; }
  ptt = !!down;
  applyMic();
}

export function voiceReset() {
  scope = 'off'; ptt = false; roster = new Map(); muted.clear(); talking.clear(); localAn = null;
  for (const id of [...peers.keys()]) closePeer(id);
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  paint(); hooks.onChange();
}

export function voiceRoster(list) {
  roster = new Map((list || []).map(([id, sc, team]) => [id, { scope: sc || 'off', team }]));
  const mine = roster.get(hooks.myId());
  if (mine && mine.scope !== scope) scope = mine.scope;
  if (scope === 'off') ptt = false;
  applyMic();
  syncPeers(); paint();
}
export function voiceSignal(from, kind, data) { onSignal(from, kind, data); }
export function voiceRefresh() { paint(); syncPeers(); }

async function setScope(next) {
  if (next !== 'off' && next !== 'all' && next !== 'team') next = 'off';
  if (next === 'team' && !hooks.teamMode()) next = 'all';
  if (next === scope) { paint(); return; }
  if (next !== 'off') { const ok = await ensureMic(); if (!ok) { paint(); return; } }
  scope = next; ptt = false;
  const mine = roster.get(hooks.myId()); if (mine) mine.scope = scope;
  applyMic();
  hooks.send({ t: 'voice', scope });
  syncPeers(); paint();
}
async function setMode(next) {
  const want = next === 'open' ? 'open' : 'hold';
  if (want === mode) { paint(); return; }
  if (want === 'open' && scope !== 'off') { const ok = await ensureMic(); if (!ok) { paint(); return; } }
  mode = want; ptt = false;
  try { localStorage.setItem('docao.voice.gate', mode); } catch (e) { /* sem storage */ }
  applyMic();
}
function applyMic() {
  const on = scope !== 'off' && !away && (mode === 'open' || ptt);
  const track = stream && stream.getAudioTracks()[0];
  if (track) track.enabled = on;
  if (!(mode === 'open' && scope !== 'off' && !away)) mark(hooks.myId(), mode === 'hold' && on);
  paint();
}
async function ensureMic() {
  if (stream) { resume(); return true; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    stream.getAudioTracks().forEach((t) => { t.enabled = false; });
    armLocal();
    resume();
    return true;
  } catch (e) {
    const toast = document.querySelector('#lobbyInvite [data-toast]');
    if (toast) toast.textContent = 'Não deu para usar o microfone';
    return false;
  }
}
function armLocal() {
  if (!stream || localAn) return;
  const c = audio(); if (!c) return;
  const src = c.createMediaStreamSource(stream);
  const an = c.createAnalyser(); an.fftSize = 512; src.connect(an); localAn = an;
}
function resume() { actx = unlockAudio() || actx; }
function audio() { actx = sharedAudio(); return actx; }

function reaches(fromId, toId) {
  const a = roster.get(fromId); if (!a || a.scope === 'off' || fromId === toId) return false;
  if (a.scope === 'all') return true;
  const b = roster.get(toId);
  return a.scope === 'team' && !!b && a.team >= 0 && a.team === b.team;
}
function wantPeer(id) { return id !== hooks.myId() && roster.has(id) && (reaches(hooks.myId(), id) || reaches(id, hooks.myId())); }
function iSend(id) { return reaches(hooks.myId(), id) && !!stream; }

function syncPeers() {
  const me = hooks.myId(); if (!me) return;
  for (const id of [...peers.keys()]) {
    const rec = peers.get(id);
    const send = iSend(id);
    if (!wantPeer(id) || (!!rec.sending !== !!send)) closePeer(id);
  }
  for (const id of roster.keys()) if (wantPeer(id) && !peers.has(id)) connect(id);
}
function connect(id) {
  if (peers.has(id) || id === hooks.myId()) return;
  const pc = new RTCPeerConnection(ICE);
  const rec = { pc, polite: hooks.myId() > id, making: false, sending: false, audio: null, an: null };
  peers.set(id, rec);
  if (iSend(id)) { pc.addTrack(stream.getAudioTracks()[0], stream); rec.sending = true; }
  else pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.onicecandidate = (ev) => { if (ev.candidate) hooks.send({ t: 'sig', to: id, kind: 'ice', data: ev.candidate.toJSON() }); };
  pc.ontrack = (ev) => {
    const audioEl = new Audio(); audioEl.autoplay = true; audioEl.srcObject = ev.streams[0]; audioEl.volume = muted.has(id) ? 0 : 1;
    rec.audio = audioEl; audioEl.play().catch(() => {});
    const c = audio(); if (c) { const src = c.createMediaStreamSource(ev.streams[0]); const an = c.createAnalyser(); an.fftSize = 512; src.connect(an); rec.an = an; }
  };
  pc.onnegotiationneeded = async () => {
    try { rec.making = true; await pc.setLocalDescription(); hooks.send({ t: 'sig', to: id, kind: 'offer', data: pc.localDescription.sdp }); }
    catch (e) { /* o outro lado oferece */ }
    finally { rec.making = false; }
  };
}
function closePeer(id) {
  const rec = peers.get(id); if (!rec) return;
  try { rec.pc.onicecandidate = null; rec.pc.onnegotiationneeded = null; rec.pc.close(); } catch (e) { /* já fechou */ }
  if (rec.audio) rec.audio.srcObject = null;
  peers.delete(id); talking.delete(id);
}
async function onSignal(from, kind, data) {
  if (!peers.has(from) && (kind === 'offer' || kind === 'answer')) connect(from);
  const rec = peers.get(from); if (!rec) return;
  const pc = rec.pc;
  try {
    if (kind === 'offer') {
      const collision = rec.making || pc.signalingState !== 'stable';
      if (collision && !rec.polite) return;
      if (collision) { try { await pc.setLocalDescription({ type: 'rollback' }); } catch (e) { /* estado já andou */ } }
      await pc.setRemoteDescription({ type: 'offer', sdp: data });
      await pc.setLocalDescription();
      hooks.send({ t: 'sig', to: from, kind: 'answer', data: pc.localDescription.sdp });
    } else if (kind === 'answer') {
      if (pc.signalingState === 'stable') return;
      await pc.setRemoteDescription({ type: 'answer', sdp: data });
    } else if (kind === 'ice' && data && data.candidate) {
      await pc.addIceCandidate(data);
    }
  } catch (e) { /* renegociação no meio do caminho */ }
}
function mark(id, on) {
  if (!id) return;
  const had = talking.has(id);
  if (on) talking.add(id); else talking.delete(id);
  if (had !== on) hooks.onChange();
}
function loud(an) {
  const buf = new Uint8Array(an.fftSize); an.getByteTimeDomainData(buf);
  let sum = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
  return Math.sqrt(sum / buf.length) > 0.05;
}
function sample() {
  let changed = false;
  const hear = (id, on) => {
    const had = talking.has(id);
    if (on) talking.add(id); else talking.delete(id);
    if (had !== on) changed = true;
  };
  if (mode === 'open' && scope !== 'off' && !away && localAn) hear(hooks.myId(), loud(localAn));
  for (const [id, rec] of peers) if (rec.an) hear(id, loud(rec.an) && !muted.has(id));
  if (changed) hooks.onChange();
}
function paint() {
  const team = hooks.teamMode();
  const gate = mode === 'open' ? 'microfone aberto' : 'segure K';
  const hint = scope === 'off' ? (mode === 'open' ? 'J troca a voz · mudo · aberto quando ligar' : 'J troca a voz · mudo') : scope === 'team' ? `J troca · ${gate} · só o time` : `J troca · ${gate} · a sala ouve`;
  const hot = scope !== 'off' && !away && (mode === 'open' || ptt);
  document.querySelectorAll('[data-voicebox]').forEach((box) => {
    const teamBtn = box.querySelector('[data-voice=team]');
    if (teamBtn) teamBtn.classList.toggle('hidden', !team);
    box.querySelectorAll('[data-voice]').forEach((b) => b.classList.toggle('on', b.dataset.voice === scope));
    box.querySelectorAll('[data-mic]').forEach((b) => b.classList.toggle('on', b.dataset.mic === mode));
    box.classList.toggle('live', hot);
    const h = box.querySelector('.voicehint'); if (h) h.textContent = hint;
  });
}

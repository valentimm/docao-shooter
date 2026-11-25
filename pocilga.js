// A Pocilga no cliente: circuito, alvos que andam, Docão Barriguinha na torre e a tela final.
// O placar sai de shared/pocilga.js. O áudio usa o contexto que o jogo já abriu.
import * as THREE from 'three';
import { makeDocao, setPose } from './docao.js';
import { lookToSkin } from './shared/closet.js';
import { PIT, BOARD, pitTargets, boardAabb, rayAabb, inspectRun, formatPit, suggestion, moverAt, inGate, onSprint } from './shared/pocilga.js';
import { loadPitRank, submitPit, getAccount } from './account.js';

const LOCAL_KEY = 'docao.pocilga.best';
const LINES = [
  'Barriguinha na torre. Escuta, leitão.',
  'Javali vermelho, de fuzil pra frente: derruba. Azul, sem arma, mão baixa: é civil.',
  'Só a Pistolinha o percurso inteiro. Vinte e quatro javalis, cinco civis.',
  'Chega em 50 segundos, sem civil: três estrelas.',
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const starsTxt = (n) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
const ease = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

let deps = null, root = null, boards = [], run = null, coach = null;
let bannerUntil = 0, bannerText = '', warned = false, gen = 0, lineAt = 0;
let shout = '', shoutUntil = 0;

function $(id) { return document.getElementById(id); }
function readBest() {
  try { const o = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); return o && o.final >= 0 ? o : null; } catch (e) { return null; }
}
function writeBest(result) {
  if (!result || !result.finished) return readBest();
  const prev = readBest();
  if (prev && !(result.final < prev.final)) return prev;
  const row = { final: result.final, raw: result.raw, penalty: result.penalty, civs: result.civs, stars: result.stars, at: Date.now() };
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(row)); } catch (e) { /* sem storage */ }
  return row;
}

function faceTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 448;
  const g = c.getContext('2d');
  const enemy = kind === 'enemy';
  g.fillStyle = enemy ? '#6b120e' : '#d9f4ea';
  g.fillRect(0, 0, 256, 448);
  if (!enemy) {
    g.fillStyle = '#f7fbff';
    for (let y = 86; y < 360; y += 28) g.fillRect(28, y, 200, 14);
  }
  g.fillStyle = enemy ? '#9d1c14' : '#1f7a58';
  g.fillRect(14, 14, 228, 64);
  g.fillStyle = '#fff6e4';
  g.font = '700 34px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(enemy ? 'JAVALI' : 'CIVIL', 128, 46);
  g.fillStyle = enemy ? '#c45a4a' : '#f4b7c8';
  g.beginPath(); g.ellipse(62, 168, 28, 36, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(194, 168, 28, 36, 0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = enemy ? '#e07a6a' : '#f7c3d0';
  g.beginPath(); g.ellipse(128, 214, 78, 70, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1a100c';
  g.lineWidth = 8;
  g.lineCap = 'round';
  if (enemy) {
    g.beginPath(); g.moveTo(78, 176); g.lineTo(108, 196); g.stroke();
    g.beginPath(); g.moveTo(178, 176); g.lineTo(148, 196); g.stroke();
  }
  g.fillStyle = '#1a100c';
  g.beginPath(); g.arc(98, 204, enemy ? 9 : 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(158, 204, enemy ? 9 : 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f8d0da';
  g.beginPath(); g.ellipse(128, 238, 34, 24, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5c2430';
  g.beginPath(); g.arc(116, 238, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(140, 238, 5, 0, Math.PI * 2); g.fill();
  if (enemy) {
    g.strokeStyle = '#1a100c';
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(86, 268); g.lineTo(170, 268); g.stroke();
    g.fillStyle = '#1c140e';
    g.fillRect(108, 292, 40, 18);
    g.fillRect(118, 300, 20, 78);
  } else {
    g.strokeStyle = '#1d4e38';
    g.lineWidth = 7;
    g.beginPath(); g.arc(128, 272, 16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.strokeStyle = '#f2c9b0';
    g.lineWidth = 16;
    g.beginPath(); g.moveTo(52, 250); g.lineTo(46, 390); g.stroke();
    g.beginPath(); g.moveTo(204, 250); g.lineTo(210, 390); g.stroke();
  }
  g.fillStyle = enemy ? '#ffd0c8' : '#14382c';
  g.font = '700 26px Fredoka, sans-serif';
  g.fillText(enemy ? 'ARMADO' : 'SEM ARMA', 128, 418);
  const tex = new THREE.CanvasTexture(c);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function faceYaw(face) {
  if (face === 'x') return Math.PI / 2;
  if (face === '-x') return -Math.PI / 2;
  if (face === 1) return 0;
  return Math.PI;
}

function own(mesh) { mesh.userData.own = true; return mesh; }

function makeBoard(t, ground) {
  const grp = new THREE.Group();
  grp.position.set(t.x, ground, t.z);
  const enemy = t.kind === 'enemy';
  const stake = own(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), new THREE.MeshLambertMaterial({ color: enemy ? 0x3a1814 : 0x2f6f86 })));
  stake.position.y = 0.21;
  grp.add(stake);
  if (t.move) {
    const m = t.move;
    const len = Math.abs(m.max - m.min) + BOARD.w;
    const rail = own(new THREE.Mesh(
      new THREE.BoxGeometry(m.axis === 'x' ? len : 0.16, 0.08, m.axis === 'z' ? len : 0.16),
      new THREE.MeshLambertMaterial({ color: enemy ? 0x6e2a22 : 0x3d8f9a }),
    ));
    const mid = (m.min + m.max) / 2;
    rail.position.set(m.axis === 'x' ? mid - t.x : 0, 0.05, m.axis === 'z' ? mid - t.z : 0);
    grp.add(rail);
  }
  const pivot = new THREE.Group();
  pivot.position.y = BOARD.y;
  pivot.rotation.order = 'YXZ';
  pivot.rotation.y = faceYaw(t.face);
  grp.add(pivot);
  const frame = own(new THREE.Mesh(
    new THREE.BoxGeometry(BOARD.w + 0.08, BOARD.h + 0.08, BOARD.d),
    new THREE.MeshLambertMaterial({ color: enemy ? 0x8d1a12 : 0x1f7a58 }),
  ));
  frame.position.y = BOARD.h / 2;
  pivot.add(frame);
  const face = own(new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w * 0.9, BOARD.h * 0.9), new THREE.MeshLambertMaterial({ map: faceTexture(t.kind) })));
  face.position.set(0, BOARD.h / 2, BOARD.d / 2 + 0.02);
  pivot.add(face);
  if (enemy) {
    const gun = own(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.78), new THREE.MeshLambertMaterial({ color: 0x1c140e })));
    gun.position.set(0.22, BOARD.h * 0.5, BOARD.d / 2 + 0.42);
    pivot.add(gun);
    const barrel = own(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), new THREE.MeshLambertMaterial({ color: 0x3a3a3a })));
    barrel.position.set(0.22, BOARD.h * 0.56, BOARD.d / 2 + 0.78);
    pivot.add(barrel);
  } else {
    for (const s of [-1, 1]) {
      const arm = own(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.12), new THREE.MeshLambertMaterial({ color: 0xf2c9b0 })));
      arm.position.set(s * 0.52, BOARD.h * 0.34, BOARD.d / 2 + 0.08);
      pivot.add(arm);
    }
    const basket = own(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), new THREE.MeshLambertMaterial({ color: 0xe8c56b })));
    basket.position.set(0, BOARD.h * 0.22, BOARD.d / 2 + 0.16);
    pivot.add(basket);
  }
  root.add(grp);
  return { ...t, ground, grp, pivot, frame, phase: 'down', anim: 1 };
}

function pose(b) {
  const flat = Math.PI / 2;
  let ang = flat;
  if (b.phase === 'rise') ang = flat * (1 - ease(b.anim));
  else if (b.phase === 'up') ang = 0;
  else if (b.phase === 'fall') ang = flat * ease(b.anim);
  b.pivot.rotation.x = -ang;
  b.frame.material.color.setHex(b.phase === 'dead' || b.phase === 'fall' ? 0x3a342e : (b.kind === 'enemy' ? 0x8d1a12 : 0x1f7a58));
}

function banner(text, bad, hold = 1.6) {
  bannerText = text;
  bannerUntil = performance.now() + hold * 1000;
  const el = $('pitBanner');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('bad', !!bad);
  el.classList.remove('hidden');
}
function hideBanner() {
  const el = $('pitBanner');
  if (el) el.classList.add('hidden');
  bannerText = '';
}

function yell(text) {
  shout = text;
  shoutUntil = performance.now() + 2400;
  banner(text, false, 1.5);
}

function paintTalk(force) {
  const el = $('pitTalk');
  if (!el) return;
  const yelling = performance.now() < shoutUntil && !!shout;
  const show = run && !run.done && (!run.started || yelling);
  el.classList.toggle('hidden', !show);
  if (!show) return;
  const i = Math.floor(lineAt / 3.1) % LINES.length;
  const text = yelling ? shout : LINES[i];
  const key = yelling ? `s:${text}` : String(i);
  if (force || el.dataset.i !== key) { el.dataset.i = key; el.textContent = text; }
  if (coach && coach.bubble) {
    const ctx = coach.ctx, w = coach.canvas.width, h = coach.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff6e4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a1410';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#2a1410';
    ctx.font = '700 28px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = text.split(' ');
    let line = '', rows = [];
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > w * 0.86) { rows.push(line); line = word; } else line = next;
    }
    if (line) rows.push(line);
    rows.forEach((row, k) => ctx.fillText(row, w / 2, h / 2 + (k - (rows.length - 1) / 2) * 36));
    coach.tex.needsUpdate = true;
  }
}

function pushEvent(k, extra) {
  const t = Math.round(run.clock * 1000) / 1000;
  const last = run.events[run.events.length - 1];
  run.events.push({ k, t: last && t < last.t ? last.t : t, ...extra });
}

function standing(b) { return b.phase === 'up' || (b.phase === 'rise' && b.anim > 0.72); }

function placeCoach() {
  const skin = lookToSkin('x1.0.c.c10');
  const model = makeDocao(skin || 'classico', { withGun: false });
  setPose(model, 'idle');
  if (model.arms && model.arms[0]) model.arms[0].rotation.set(-0.9, 0.35, -0.7);
  const tw = PIT.tower;
  const dx = PIT.spawn[0] - tw.x, dz = PIT.spawn[1] - tw.z;
  const yaw = Math.atan2(dx, dz);
  model.group.position.set(tw.x, tw.y, tw.z + 0.15);
  model.group.rotation.y = yaw;
  root.add(model.group);
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 180;
  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const bubble = own(new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.88), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
  const len = Math.hypot(dx, dz) || 1;
  bubble.position.set(tw.x + dx / len * 0.15, tw.y + 2.2, tw.z + dz / len * 0.15);
  bubble.rotation.y = yaw;
  root.add(bubble);
  coach = { model, bubble, canvas, ctx: canvas.getContext('2d'), tex };
}

export function pitRay(ox, oy, oz, dx, dy, dz, maxT) {
  if (!run || run.done) return null;
  let best = null;
  for (const b of boards) {
    if (!standing(b)) continue;
    const t = rayAabb(ox, oy, oz, dx, dy, dz, boardAabb(b, b.ground), maxT);
    if (t == null) continue;
    if (!best || t < best.t) best = { t, id: b.id };
  }
  return best;
}

export function pitHit(id, weapon) {
  if (!run || !run.started || run.done) return false;
  const b = boards.find((x) => x.id === id);
  if (!b || !standing(b)) return false;
  const before = inspectRun(run.events);
  pushEvent('hit', { id, w: weapon });
  const after = inspectRun(run.events);
  const sane = after.reason !== 'diário' && after.reason !== 'ordem';
  const freshEnemy = sane && b.kind === 'enemy' && !before.down.includes(id) && after.down.includes(id);
  const freshCivil = sane && b.kind === 'civil' && after.civs > before.civs;
  if (!freshEnemy && !freshCivil) { run.events.pop(); return false; }
  b.phase = 'fall'; b.anim = 0;
  if (freshCivil) { banner(`+${PIT.civPenalty.toFixed(1).replace('.', ',')} s · ${b.name}`, true, 1.8); deps.sfx.oink(); }
  else deps.sfx.hit();
  if (freshEnemy && after.missed.length === 0) { banner('Javalis no chão. Dispara na volta!', false, 1.4); deps.sfx.pickup(); }
  return true;
}

export function pitMelee(ox, oy, oz, dx, dy, dz) {
  if (!run || !run.started || run.done) return false;
  let best = null, bestD = 1.9;
  for (const b of boards) {
    if (!standing(b)) continue;
    const cx = b.x, cy = b.ground + BOARD.y + BOARD.h * 0.45, cz = b.z;
    const vx = cx - ox, vy = cy - oy, vz = cz - oz;
    const dist = Math.hypot(vx, vy, vz);
    if (!(dist < bestD) || dist < 0.05) continue;
    if ((vx * dx + vy * dy + vz * dz) / dist < 0.4) continue;
    best = b; bestD = dist;
  }
  return best ? pitHit(best.id, PIT.knife) : false;
}

export function pitSpeedMul() {
  if (!run || !run.started || run.done || !deps) return 1;
  const p = deps.player();
  return p && onSprint(p.pos.x, p.pos.y, p.pos.z) ? PIT.sprint : 1;
}
export function pitHolding() { return !!(run && run.done); }
export function pitResultOn() { return !!(run && run.done); }
export const pitActive = () => !!run;

function liveStars(clock, civs, started) {
  if (!started) return 0;
  const final = clock + civs * PIT.civPenalty;
  if (final <= PIT.star3 && civs === 0) return 3;
  if (final <= PIT.star2) return 2;
  return 1;
}

function paintHud() {
  const timer = $('timer'), leader = $('leader'), score = $('score'), lb = $('lb');
  if (!run || !timer) return;
  const view = run.events.length >= 2 ? inspectRun(run.events) : null;
  const enemies = pitEnemiesCount();
  const civTotal = pitTargets().filter((t) => t.kind === 'civil').length;
  const down = view ? view.down.length : 0;
  const civs = view ? view.civs : 0;
  const clockText = !run.started ? '0:00.00' : (run.done && run.result && run.result.final != null ? formatPit(run.result.final) : formatPit(run.clock));
  if (!run.started) timer.textContent = 'LARGADA';
  else timer.textContent = clockText;
  let lead = 'O Barriguinha explica. A faixa amarela liga o relógio.';
  if (run.done) lead = 'Missão cumprida. R tenta de novo.';
  else if (run.started && onSprint(deps.player().pos.x, deps.player().pos.y, deps.player().pos.z)) lead = 'CORRE até a chegada';
  else if (run.started) lead = view && view.missed.length ? `Faltam ${view.missed.length} javalis` : 'Javalis no chão';
  if (leader) { leader.textContent = lead; leader.dataset.h = ''; }
  if (score) score.textContent = run.started ? `Inimigos ${down}/${enemies} · civis ${civs}/${civTotal}` : 'Pistolinha · javali vermelho, civil azul';
  const cod = $('pitCod');
  if (cod) {
    cod.classList.remove('hidden');
    const time = $('pitCodTime');
    if (time) time.textContent = clockText;
    const en = $('pitCodEnemy');
    if (en) en.textContent = `INIMIGOS ${down}/${enemies}`;
    const cv = $('pitCodCivil');
    if (cv) cv.textContent = `CIVIS ${civs}/${civTotal}`;
    const stars = $('pitCodStars');
    if (stars) {
      const n = run.done && run.result ? (run.result.stars || 0) : liveStars(run.started ? run.clock : 0, civs, run.started);
      stars.innerHTML = [0, 1, 2].map((i) => `<i class="${i < n ? 'on' : 'off'}">★</i>`).join('');
    }
  }
  if (lb) lb.innerHTML = `<div class="lbh"><span>A Pocilga</span><span>relógio</span></div><div class="row me"><span>1</span><span class="dot" style="background:#e07a6a"></span><span class="n">você</span><span class="k">${timer.textContent}</span></div>`;
  const ban = $('pitBanner');
  if (ban && performance.now() > bannerUntil) { ban.classList.add('hidden'); bannerText = ''; }
  paintTalk(false);
}
function pitEnemiesCount() { return pitTargets().filter((t) => t.kind === 'enemy').length; }

function rankRows(rows, meNick) {
  if (!rows || !rows.length) return '<p class="pit-empty">Ranking ainda vazio. O primeiro tempo com conta abre a lista.</p>';
  return `<ol class="pit-rank">${rows.map((r) => `<li class="${meNick && r.nick === meNick ? 'me' : ''}"><b>${r.place}. ${esc(r.nick)}</b><span>${esc(r.clock)} ${starsTxt(r.stars | 0)}</span></li>`).join('')}</ol>`;
}

function paintCard(result, extra) {
  const card = $('pitCard');
  if (!card || !result) return;
  const best = readBest();
  const sug = result.suggestion || suggestion(result.stars);
  const remote = extra && extra.remote;
  let note = 'Convidado: o melhor tempo fica neste navegador. Entre na conta para o ranking.';
  if (getAccount() && getAccount().nick && getAccount().nick !== 'DEV local') {
    if (!remote) note = 'Mandando o tempo para o ranking…';
    else if (remote.guest) note = 'Convidado: o melhor tempo fica neste navegador.';
    else if (remote.ok && remote.saved) note = 'Este tempo entrou no ranking da conta.';
    else if (remote.run && remote.run.reason === 'rápido') note = 'O servidor recusou o ranking: tempo abaixo do mínimo físico.';
    else if (remote.error) note = esc(remote.error);
    else note = 'O servidor não guardou este tempo.';
  }
  const rows = (remote && remote.rows) || (extra && extra.rank && extra.rank.rows) || [];
  const me = (remote && remote.me) || (extra && extra.rank && extra.rank.me);
  const enemies = pitEnemiesCount();
  const hitE = result.down ? result.down.length : 0;
  card.innerHTML = `
    <p class="pit-kicker">A Pocilga</p>
    <h2>${result.finished ? 'MISSÃO CUMPRIDA' : 'Incompleta'}</h2>
    <p class="pit-time">${result.finished ? formatPit(result.final) : '—'}</p>
    <p class="pit-stars" aria-label="${result.stars} estrelas">${starsTxt(result.stars || 0)}</p>
    <p class="pit-split">Inimigos ${hitE}/${enemies} · Civis ${result.civs || 0}/${pitTargets().filter((t) => t.kind === 'civil').length}</p>
    <p class="pit-split">Tempo ${formatPit(result.raw)} · penalidade +${(result.penalty || 0).toFixed(2)} s</p>
    <p class="pit-sug">${result.finished ? `Sugestão do Docão: <b>${esc(sug.label)}</b> · ${esc(sug.hint)}` : 'A chegada não abriu.'}</p>
    <p class="pit-best">Seu melhor ${getAccount() && me ? 'na conta' : 'neste navegador'}: <b>${best ? formatPit(best.final) + ' ' + starsTxt(best.stars) : '—'}</b>${me ? ` · ranking ${me.place}º (${esc(me.clock)})` : ''}</p>
    <h3>Mais rápidos</h3>
    ${rankRows(rows, me && me.nick)}
    <p class="pit-note">${note}</p>
    <div class="pit-actions"><button type="button" id="pitAgain">DE NOVO · R</button><button type="button" id="pitMenu" class="secondary">MENU</button></div>`;
  const again = $('pitAgain'), menu = $('pitMenu');
  if (again) again.onclick = () => restartCourse();
  if (menu) menu.onclick = () => deps && deps.menu();
}

function showResult(result, extra) {
  const el = $('pitOver');
  if (el) el.classList.remove('hidden');
  paintCard(result, extra);
}

async function closeRun() {
  const mine = gen;
  run.done = true;
  run.result = inspectRun(run.events);
  writeBest(run.result);
  deps.unlock();
  banner('CHEGADA', false, 2.2);
  deps.sfx.fanfare();
  showResult(run.result, { remote: null, rank: null });
  const [remote, rank] = await Promise.all([
    submitPit(run.events).catch(() => ({ ok: false, error: 'Sem conexão com o ranking' })),
    loadPitRank().catch(() => null),
  ]);
  if (mine !== gen || !run || !run.done) return;
  showResult(run.result, { remote, rank });
}

function stepMovers(dt) {
  run.moverT += dt;
  for (const b of boards) {
    if (!b.move || b.phase === 'fall' || b.phase === 'dead') continue;
    const at = moverAt(b, run.moverT);
    b.x = at.x; b.z = at.z;
    b.grp.position.x = at.x; b.grp.position.z = at.z;
  }
}

export function tickCourse(dt) {
  if (!run || !deps) return;
  lineAt += dt;
  stepMovers(dt);
  if (coach) coach.model.group.position.y = PIT.tower.y + Math.sin(lineAt * 1.7) * 0.04;
  for (const b of boards) {
    if (b.phase === 'rise' || b.phase === 'fall') {
      b.anim += dt / (b.phase === 'rise' ? PIT.rise : 0.22);
      if (b.anim >= 1) { b.anim = 1; b.phase = b.phase === 'rise' ? 'up' : 'dead'; }
    }
    pose(b);
  }
  if (run.done) { paintHud(); return; }
  const p = deps.player();
  if (!p) return;
  if (deps.weapon() !== PIT.pistol) deps.armPistol();
  const pos = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
  if (!run.started && inGate(pos, PIT.gates[0])) {
    run.started = true;
    run.clock = 0;
    pushEvent('start');
    banner('JÁ!', false, 0.7);
  }
  if (run.started) run.clock += dt;
  for (const gate of PIT.gates) {
    if (!inGate(pos, gate)) continue;
    if (gate.say && !run.said.has(gate.id)) { run.said.add(gate.id); yell(gate.say); }
    if (!gate.pop || run.pops.has(gate.pop)) continue;
    if (run.pops.size !== PIT.bays.findIndex((b) => b.id === gate.pop)) continue;
    run.pops.add(gate.pop);
    pushEvent('pop', { bay: gate.pop });
    for (const b of boards) if (b.bay === gate.pop && b.phase === 'down') { b.phase = 'rise'; b.anim = 0; }
  }
  const finish = PIT.gates[PIT.gates.length - 1];
  if (run.started && inGate(pos, finish)) {
    const view = inspectRun(run.events);
    if (view.missed.length === 0 && view.pops.length === PIT.bays.length) {
      pushEvent('finish');
      closeRun();
    } else if (!warned) {
      warned = true;
      const n = view.missed.length;
      banner(n ? `Volta. Faltam ${n} javali${n > 1 ? 's' : ''}.` : 'Ainda falta sala.', true, 1.6);
    }
  } else if (!inGate(pos, finish)) warned = false;
  paintHud();
}

export function beginCourse(next) {
  clearCourse();
  deps = next;
  root = new THREE.Group();
  root.name = 'pocilga';
  deps.scene.add(root);
  boards = pitTargets().map((t) => makeBoard(t, deps.groundAt(t.x, t.z, (t.y || 0) + 1)));
  for (const b of boards) pose(b);
  placeCoach();
  run = { clock: 0, moverT: 0, started: false, done: false, events: [], pops: new Set(), said: new Set(), result: null };
  gen++;
  lineAt = 0;
  deps.armPistol();
  deps.sfx.oink();
  document.body.classList.add('pit-on');
  const p = deps.player();
  if (p) {
    p.nades = 0; p.smokeNades = 0; p.stunNades = 0; p.flashNades = 0;
    p.yaw = PIT.spawnYaw; p.pitch = -0.5;
  }
  hideBanner();
  const over = $('pitOver'); if (over) over.classList.add('hidden');
  paintTalk(true);
  paintHud();
}

export function clearCourse() {
  gen++;
  if (root && deps) deps.scene.remove(root);
  if (root) root.traverse((o) => {
    if (!o.userData || !o.userData.own) return;
    if (o.geometry) o.geometry.dispose();
    const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of list) { if (m.map) m.map.dispose(); m.dispose(); }
  });
  root = null;
  boards = [];
  run = null;
  coach = null;
  deps = null;
  hideBanner();
  shout = ''; shoutUntil = 0;
  document.body.classList.remove('pit-on');
  const talk = $('pitTalk'); if (talk) talk.classList.add('hidden');
  const cod = $('pitCod'); if (cod) cod.classList.add('hidden');
  const over = $('pitOver'); if (over) over.classList.add('hidden');
}

export function restartCourse() {
  if (!deps) return;
  const keep = deps;
  beginCourse(keep);
  const p = deps.player();
  const [x, z] = PIT.spawn;
  const y = deps.groundAt(x, z, 1);
  p.pos.set(x, y, z);
  p.vel.set(0, 0, 0);
  p.yaw = PIT.spawnYaw;
  p.pitch = -0.5;
  p.alive = true;
  deps.lock();
}

export function courseSnap() {
  const view = run && run.events.length >= 2 ? inspectRun(run.events) : null;
  return {
    on: !!run,
    started: !!(run && run.started),
    done: !!(run && run.done),
    clock: run ? run.clock : 0,
    timer: $('timer') ? $('timer').textContent : '',
    banner: bannerText,
    talk: $('pitTalk') ? $('pitTalk').textContent : '',
    cod: $('pitCod') ? $('pitCod').innerText : '',
    result: run && run.result,
    best: readBest(),
    missed: view ? view.missed : [],
    civs: view ? view.civs : 0,
    pops: run ? [...run.pops] : [],
    targets: boards.map((b) => ({ id: b.id, kind: b.kind, name: b.name, x: b.x, z: b.z, y: b.y || 0, phase: b.phase, face: b.face || -1, mover: !!b.move })),
    card: $('pitOver') ? !$('pitOver').classList.contains('hidden') : false,
    coach: !!coach,
  };
}

export async function paintPitMenu() {
  const host = $('pitMenuRank');
  if (!host) return;
  const best = readBest();
  host.innerHTML = `<p class="pit-best">Seu melhor aqui: <b>${best ? formatPit(best.final) + ' ' + starsTxt(best.stars) : '—'}</b></p><div id="pitRankList">carregando o ranking…</div>`;
  const data = await loadPitRank().catch(() => null);
  const list = $('pitRankList');
  if (!list) return;
  if (!data) { list.textContent = 'Ranking do servidor indisponível agora.'; return; }
  const me = data.me;
  list.innerHTML = rankRows(data.rows, me && me.nick) + (me ? `<p class="pit-best">Na sua conta: ${esc(me.clock)} · ${me.place}º</p>` : '');
}

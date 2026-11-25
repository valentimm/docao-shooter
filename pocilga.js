// A Pocilga no cliente: papelões, relógio, penalidade, tela final e restart.
// O placar sai de shared/pocilga.js. O áudio usa o contexto que o jogo já abriu.
import * as THREE from 'three';
import { PIT, BOARD, pitTargets, boardAabb, rayAabb, inspectRun, formatPit, suggestion } from './shared/pocilga.js';
import { loadPitRank, submitPit, getAccount } from './account.js';

const LOCAL_KEY = 'docao.pocilga.best';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const starsTxt = (n) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
const ease = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

let deps = null;
let root = null;
let boards = [];
let run = null;
let bannerUntil = 0;
let bannerText = '';
let warned = false;
let gen = 0;

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
  g.fillStyle = enemy ? '#e7c99a' : '#f4efe4';
  g.fillRect(0, 0, 256, 448);
  g.fillStyle = enemy ? '#c0392b' : '#2f9e6b';
  g.fillRect(16, 16, 224, 56);
  g.fillStyle = '#fff6e4';
  g.font = '700 34px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(enemy ? 'JAVALI' : 'CIVIL', 128, 44);
  g.fillStyle = enemy ? '#e07a8c' : '#f3b7c6';
  g.beginPath(); g.ellipse(70, 168, 28, 36, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(186, 168, 28, 36, 0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = enemy ? '#f0a3b4' : '#f7c3d0';
  g.beginPath(); g.ellipse(128, 230, 78, 72, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a1410';
  g.beginPath(); g.arc(100, 214, 7, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(156, 214, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f8d0da';
  g.beginPath(); g.ellipse(128, 258, 36, 26, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6d3140';
  g.beginPath(); g.arc(116, 258, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(142, 258, 5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a1410';
  g.lineWidth = 6;
  g.lineCap = 'round';
  if (enemy) {
    g.beginPath(); g.moveTo(78, 188); g.lineTo(114, 200); g.stroke();
    g.beginPath(); g.moveTo(178, 188); g.lineTo(142, 200); g.stroke();
  } else {
    g.beginPath(); g.arc(128, 286, 18, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = '#e63946';
    g.beginPath(); g.arc(200, 150, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2c94c';
    g.beginPath(); g.arc(200, 150, 7, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#2a1410';
  g.font = '700 28px Fredoka, sans-serif';
  g.fillText(enemy ? 'DERRUBE' : 'NÃO ATIRE', 128, 400);
  const tex = new THREE.CanvasTexture(c);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeBoard(t, ground) {
  const grp = new THREE.Group();
  grp.position.set(t.x, ground, t.z);
  const stake = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), new THREE.MeshLambertMaterial({ color: 0x5c3d22 }));
  stake.position.y = 0.21;
  grp.add(stake);
  const pivot = new THREE.Group();
  pivot.position.y = BOARD.y;
  grp.add(pivot);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD.w + 0.06, BOARD.h + 0.06, BOARD.d), new THREE.MeshLambertMaterial({ color: 0x6b4428 }));
  frame.position.y = BOARD.h / 2;
  pivot.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w * 0.9, BOARD.h * 0.9), new THREE.MeshLambertMaterial({ map: faceTexture(t.kind) }));
  face.position.set(0, BOARD.h / 2, -(BOARD.d / 2 + 0.012));
  face.rotation.y = Math.PI;
  pivot.add(face);
  root.add(grp);
  return { ...t, ground, grp, pivot, frame, phase: 'down', anim: 1 };
}

function pose(b) {
  const flat = Math.PI / 2;
  let ang = flat;
  if (b.phase === 'rise') ang = flat * (1 - ease(b.anim));
  else if (b.phase === 'up') ang = 0;
  else if (b.phase === 'fall') ang = flat * ease(b.anim);
  b.pivot.rotation.x = ang;
  const dead = b.phase === 'dead' || b.phase === 'fall';
  b.frame.material.color.setHex(dead ? 0x4a4038 : 0x6b4428);
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

function pushEvent(k, extra) {
  const t = Math.round(run.clock * 1000) / 1000;
  const last = run.events[run.events.length - 1];
  run.events.push({ k, t: last && t < last.t ? last.t : t, ...extra });
}

function standing(b) {
  return b.phase === 'up' || (b.phase === 'rise' && b.anim > 0.72);
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
  if (freshEnemy || freshCivil) {
    b.phase = 'fall'; b.anim = 0;
    if (freshCivil) { banner(`+${PIT.civPenalty.toFixed(1).replace('.', ',')} s · ${b.name}`, true, 1.8); deps.sfx.oink(); }
    else deps.sfx.hit();
    if (freshEnemy && after.missed.length === 0 && after.swapped) { banner('Javalis no chão. Dispara!', false, 1.4); deps.sfx.pickup(); }
  }
  return freshEnemy || freshCivil;
}

export function pitSpeedMul() {
  if (!run || !run.started || run.done || !deps) return 1;
  const p = deps.player();
  return p && p.pos.z >= PIT.sprintZ ? PIT.sprint : 1;
}
export function pitHolding() { return !!(run && run.done); }
export function pitResultOn() { return !!(run && run.done); }
export const pitActive = () => !!run;

function paintHud() {
  const timer = $('timer'), leader = $('leader'), score = $('score'), lb = $('lb');
  if (!run || !timer) return;
  const view = inspectRun(run.events);
  const enemies = pitTargets().filter((t) => t.kind === 'enemy').length;
  const down = view.down.length;
  if (!run.started) timer.textContent = 'LARGADA';
  else if (run.done && run.result && run.result.final != null) timer.textContent = formatPit(run.result.final);
  else timer.textContent = formatPit(run.clock);
  let lead = 'Cruze a faixa amarela. O relógio começa ali.';
  if (run.done) lead = 'Fim de circuito. R tenta de novo.';
  else if (run.started && run.swapped && deps.player() && deps.player().pos.z >= PIT.sprintZ) lead = 'DISPARA até a faixa vermelha';
  else if (run.started && !run.swapped && deps.player() && deps.player().pos.z > 30) lead = 'A Pistolinha está na bancada';
  else if (run.started) lead = view.missed.length ? `Faltam ${view.missed.length} javalis` : 'Javalis no chão';
  if (leader) { leader.textContent = lead; leader.dataset.h = ''; }
  if (score) {
    const pen = view.civs * PIT.civPenalty;
    score.textContent = run.started ? `Javalis ${down}/${enemies} · civis ${view.civs} · +${pen.toFixed(1)} s` : `Javalis 0/${enemies} · não atire no civil`;
  }
  if (lb) lb.innerHTML = `<div class="lbh"><span>A Pocilga</span><span>relógio</span></div><div class="row me"><span>1</span><span class="dot" style="background:#e7c99a"></span><span class="n">você</span><span class="k">${timer.textContent}</span></div>`;
  const ban = $('pitBanner');
  if (ban && performance.now() > bannerUntil) { ban.classList.add('hidden'); bannerText = ''; }
}

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
  card.innerHTML = `
    <p class="pit-kicker">A Pocilga</p>
    <h2>${result.finished ? formatPit(result.final) : 'Incompleta'}</h2>
    <p class="pit-stars" aria-label="${result.stars} estrelas">${starsTxt(result.stars || 0)}</p>
    <p class="pit-split">Bruto ${formatPit(result.raw)} · penalidade +${(result.penalty || 0).toFixed(2)} s · ${result.civs || 0} civil${result.civs === 1 ? '' : 'is'}</p>
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

export function tickCourse(dt) {
  if (!run || !deps) return;
  for (const b of boards) {
    if (b.phase === 'rise' || b.phase === 'fall') {
      b.anim += dt / (b.phase === 'rise' ? 0.32 : 0.28);
      if (b.anim >= 1) { b.anim = 1; b.phase = b.phase === 'rise' ? 'up' : 'dead'; }
    }
    pose(b);
  }
  if (run.done) { paintHud(); return; }
  const p = deps.player();
  if (!p) return;
  const z = p.pos.z;
  if (!run.started && z >= PIT.startZ) {
    run.started = true;
    run.clock = 0;
    pushEvent('start');
    banner('JÁ!', false, 0.7);
  }
  if (run.started) run.clock += dt;
  for (const bay of PIT.bays) {
    if (run.pops.has(bay.id) || z < bay.popZ) continue;
    if (run.pops.size !== PIT.bays.findIndex((b) => b.id === bay.id)) continue;
    run.pops.add(bay.id);
    pushEvent('pop', { bay: bay.id });
    for (const b of boards) if (b.bay === bay.id && b.phase === 'down') { b.phase = 'rise'; b.anim = 0; }
  }
  if (run.started && !run.swapped && z >= PIT.swapZ) {
    run.swapped = true;
    pushEvent('swap', { w: PIT.pistol });
    deps.armPistol();
    banner('Pistolinha na mão', false, 1.3);
    deps.sfx.pickup();
  }
  if (run.swapped && deps.weapon() !== PIT.pistol) deps.armPistol();
  if (run.started && z >= PIT.finishZ) {
    const view = inspectRun(run.events);
    if (view.missed.length === 0 && view.swapped && view.pops.length === PIT.bays.length) {
      pushEvent('finish');
      closeRun();
    } else if (!warned) {
      warned = true;
      const n = view.missed.length;
      banner(n ? `Volta. Faltam ${n} javali${n > 1 ? 's' : ''}.` : 'Ainda não fechou o circuito.', true, 1.6);
    }
  } else if (z < PIT.finishZ - 1.2) warned = false;
  paintHud();
}

export function beginCourse(next) {
  clearCourse();
  deps = next;
  root = new THREE.Group();
  root.name = 'pocilga';
  deps.scene.add(root);
  boards = pitTargets().map((t) => makeBoard(t, deps.groundAt(t.x, t.z, 1)));
  for (const b of boards) pose(b);
  run = { clock: 0, started: false, swapped: false, done: false, events: [], pops: new Set(), result: null };
  gen++;
  deps.armRifle();
  const p = deps.player();
  if (p) {
    p.nades = 0; p.smokeNades = 0; p.stunNades = 0; p.flashNades = 0;
    p.yaw = Math.PI; p.pitch = -0.04;
  }
  hideBanner();
  const over = $('pitOver'); if (over) over.classList.add('hidden');
  paintHud();
}

export function clearCourse() {
  gen++;
  if (root && deps) deps.scene.remove(root);
  if (root) root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) { if (m.map) m.map.dispose(); m.dispose(); }
    }
  });
  root = null;
  boards = [];
  run = null;
  deps = null;
  hideBanner();
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
  p.yaw = Math.PI;
  p.pitch = -0.04;
  p.alive = true;
  deps.lock();
}

export function courseSnap() {
  const view = run ? inspectRun(run.events) : null;
  return {
    on: !!run,
    started: !!(run && run.started),
    done: !!(run && run.done),
    swapped: !!(run && run.swapped),
    clock: run ? run.clock : 0,
    timer: $('timer') ? $('timer').textContent : '',
    banner: bannerText,
    result: run && run.result,
    best: readBest(),
    missed: view ? view.missed : [],
    civs: view ? view.civs : 0,
    targets: boards.map((b) => ({ id: b.id, kind: b.kind, name: b.name, x: b.x, z: b.z, phase: b.phase })),
    card: $('pitOver') ? !$('pitOver').classList.contains('hidden') : false,
    rank: $('pitRankList') ? $('pitRankList').textContent : '',
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

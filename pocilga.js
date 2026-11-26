// A Pocilga no cliente: circuito, alvos que andam, Docão Barriguinha na torre e a tela final.
// O placar sai de shared/pocilga.js. O áudio usa o contexto que o jogo já abriu.
import * as THREE from 'three';
import { makeDocao, setPose } from './docao.js';
import { makeZombie, animateZombie } from './invasion-gfx.js';
import { lookToSkin } from './shared/closet.js';
import { PIT, BOARD, FINISH_LINE, pitTargets, boardAabb, rayAabb, inspectRun, formatPit, suggestion, moverAt, inGate, onFinishLine, onSprint, pitRescue, fillPops, zombiesAwake } from './shared/pocilga.js';
import { bonusLine } from './shared/pocilga-bonus.js';
import { mountBonusTarget, clearBonusTarget, tickBonusTarget, offerBonus, armBonus, takeBonusShot, bonusAdjust, bonusSnap } from './pocilga-bonus.js';
import { loadPitRank, submitPit, getAccount, getToken } from './account.js';
import { formatRankClock, GUEST_RANK_NOTE } from './pocilga-rank.js';

const LOCAL_KEY = 'docao.pocilga.best';
const LINES = [
  'Barriguinha na torre. Escuta, leitão.',
  'Barriguinha de camisa vermelha, de fuzil pra frente: derruba. Azul, sem arma, mão baixa: é civil.',
  'Só a Pistolinha o percurso inteiro. Vinte e três Barriguinhas, dois zumbis, cinco civis.',
  'Chega em 52 segundos, sem civil: três estrelas.',
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const starsTxt = (n) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
const ease = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

let deps = null, root = null, boards = [], zeds = [], run = null, coach = null, natal = null, bits = null, arrival = null;
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

// Pintura chapada do Barriguinha clássico: pele #ee9c22, focinho #ec5c0c, camisa #d8261c com C!.
function paintBarriguinha(g) {
  g.fillStyle = '#f3e2b0';
  g.fillRect(0, 0, 256, 448);
  g.fillStyle = '#8d1a12';
  g.fillRect(14, 14, 228, 52);
  g.fillStyle = '#fff6e4';
  g.font = '700 22px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BARRIGUINHA', 128, 40);
  g.fillStyle = '#ee9c22';
  g.beginPath(); g.ellipse(78, 150, 26, 34, -0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(178, 150, 26, 34, 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8682a';
  g.beginPath(); g.ellipse(78, 154, 12, 18, -0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(178, 154, 12, 18, 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ee9c22';
  g.beginPath(); g.arc(128, 196, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a1408';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(86, 168); g.lineTo(112, 180); g.stroke();
  g.beginPath(); g.moveTo(170, 168); g.lineTo(144, 180); g.stroke();
  g.fillStyle = '#fffaf0';
  g.beginPath(); g.ellipse(106, 188, 14, 16, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(150, 188, 14, 16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5a2c12';
  g.beginPath(); g.arc(108, 190, 7, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(152, 190, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#120604';
  g.beginPath(); g.arc(109, 191, 3.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(153, 191, 3.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ec5c0c';
  g.beginPath(); g.ellipse(128, 214, 28, 20, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3a0806';
  g.beginPath(); g.ellipse(118, 214, 5, 7, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(138, 214, 5, 7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d8261c';
  g.fillRect(78, 268, 100, 78);
  g.fillStyle = '#1d1410';
  g.fillRect(78, 268, 100, 8);
  g.fillStyle = '#f5e6d0';
  g.font = '700 36px Fredoka, sans-serif';
  g.fillText('C!', 128, 308);
  g.fillStyle = '#ee9c22';
  g.fillRect(58, 278, 22, 48);
  g.fillRect(176, 278, 22, 48);
  g.fillStyle = '#1d1410';
  g.fillRect(90, 346, 32, 52);
  g.fillRect(134, 346, 32, 52);
  g.fillStyle = '#1c140e';
  g.fillRect(168, 300, 46, 10);
  g.fillRect(206, 292, 8, 26);
  g.fillStyle = '#8d1a12';
  g.font = '700 22px Fredoka, sans-serif';
  g.fillText('ARMADO', 128, 424);
}

function faceTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 448;
  const g = c.getContext('2d');
  const enemy = kind === 'enemy';
  if (enemy) paintBarriguinha(g);
  else {
    g.fillStyle = '#d9f4ea';
    g.fillRect(0, 0, 256, 448);
    g.fillStyle = '#f7fbff';
    for (let y = 86; y < 360; y += 28) g.fillRect(28, y, 200, 14);
    g.fillStyle = '#1f7a58';
    g.fillRect(14, 14, 228, 64);
    g.fillStyle = '#fff6e4';
    g.font = '700 34px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CIVIL', 128, 46);
    g.fillStyle = '#f4b7c8';
    g.beginPath(); g.ellipse(62, 168, 28, 36, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(194, 168, 28, 36, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f7c3d0';
    g.beginPath(); g.ellipse(128, 214, 78, 70, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a100c';
    g.beginPath(); g.arc(98, 204, 6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(158, 204, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f8d0da';
    g.beginPath(); g.ellipse(128, 238, 34, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5c2430';
    g.beginPath(); g.arc(116, 238, 5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(140, 238, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1d4e38';
    g.lineWidth = 7;
    g.beginPath(); g.arc(128, 272, 16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.strokeStyle = '#f2c9b0';
    g.lineWidth = 16;
    g.beginPath(); g.moveTo(52, 250); g.lineTo(46, 390); g.stroke();
    g.beginPath(); g.moveTo(204, 250); g.lineTo(210, 390); g.stroke();
    g.fillStyle = '#14382c';
    g.font = '700 26px Fredoka, sans-serif';
    g.fillText('SEM ARMA', 128, 418);
  }
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
  return { ...t, ground, grp, pivot, frame, phase: 'up', anim: 0 };
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
  const show = !!(run && (yelling || (!run.done && !run.started)));
  el.classList.toggle('hidden', !show);
  if (coach && coach.bubble) coach.bubble.visible = !!show;
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 32;
    const words = text.split(' ');
    let line = '', rows = [];
    const layout = () => {
      ctx.font = `700 ${size}px Fredoka, sans-serif`;
      line = ''; rows = [];
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > w * 0.84) { if (line) rows.push(line); line = word; } else line = next;
      }
      if (line) rows.push(line);
    };
    layout();
    while (size > 20 && (rows.length > 2 || rows.some((row) => ctx.measureText(row).width > w * 0.9))) { size -= 2; layout(); }
    rows.forEach((row, k) => ctx.fillText(row, w / 2, h / 2 + (k - (rows.length - 1) / 2) * (size + 8)));
    coach.tex.needsUpdate = true;
  }
}

const ROUND2 = (n) => Math.round(n * 1000) / 1000;
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
  const yaw = Math.PI;
  model.group.position.set(tw.x, tw.y, tw.z + 0.15);
  model.group.rotation.y = yaw;
  const felt = new THREE.MeshBasicMaterial({ color: 0xc4364a });
  const wool = new THREE.MeshBasicMaterial({ color: 0xf7f4ee });
  const hat = new THREE.Group();
  const cone = own(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 8), felt));
  cone.position.y = 0.2;
  const brim = own(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 6, 12), wool));
  brim.rotation.x = Math.PI / 2;
  const pom = own(new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 6), wool));
  pom.position.y = 0.4;
  hat.add(cone, brim, pom);
  hat.position.set(0.04, 2.0, 0.04);
  hat.rotation.z = -0.4;
  model.group.add(hat);
  root.add(model.group);
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 180;
  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const bubble = own(new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.88), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
  bubble.position.set(tw.x, tw.y + 2.35, tw.z - 0.2);
  bubble.rotation.y = yaw;
  root.add(bubble);
  coach = { model, bubble, canvas, ctx: canvas.getContext('2d'), tex };
}

function mountNatal() {
  const bulbs = [];
  const push = (pts, y) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const n = Math.max(1, Math.round(len / 1.55));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        bulbs.push([a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t]);
      }
    }
  };
  push([[7.5, -21.5], [7.5, -11]], 2.35);
  push([[16.2, -21.5], [16.2, -11]], 2.35);
  push([[9.4, -9.6], [9.4, 3.2]], 2.35);
  push([[19.0, -9.6], [19.0, 3.2]], 2.35);
  push([[-5.9, 20], [-5.9, 29]], 2.45);
  push([[17.4, 4], [17.4, 36]], 2.35);
  push([[24.5, 4], [24.5, 36]], 2.35);
  bulbs.push([15.4, 2.85, -17.4], [16.2, 2.85, -17.4], [15.8, 3.15, -16.5]);
  bulbs.push([19.2, 2.55, -18.7], [20.2, 2.7, -18.7], [21.2, 2.55, -18.7], [19.2, 1.5, -18.7], [21.2, 1.5, -18.7]);
  const geo = new THREE.SphereGeometry(0.065, 6, 4);
  const warm = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const cool = new THREE.MeshBasicMaterial({ color: 0xb7dcff });
  const even = own(new THREE.InstancedMesh(geo, warm, Math.ceil(bulbs.length / 2)));
  const odd = own(new THREE.InstancedMesh(geo.clone(), cool, Math.floor(bulbs.length / 2)));
  const matrix = new THREE.Matrix4();
  let ie = 0, io = 0;
  for (let i = 0; i < bulbs.length; i++) {
    matrix.makeTranslation(bulbs[i][0], bulbs[i][1], bulbs[i][2]);
    if (i % 2 === 0) even.setMatrixAt(ie++, matrix);
    else odd.setMatrixAt(io++, matrix);
  }
  even.count = ie; odd.count = io;
  even.instanceMatrix.needsUpdate = odd.instanceMatrix.needsUpdate = true;
  const cream = new THREE.MeshBasicMaterial({ color: 0xf3e2b0 });
  const gar = own(new THREE.InstancedMesh(new THREE.BoxGeometry(1.05, 0.06, 0.06), cream, bulbs.length));
  for (let i = 0; i < bulbs.length; i++) {
    matrix.makeTranslation(bulbs[i][0], bulbs[i][1] - 0.18, bulbs[i][2]);
    gar.setMatrixAt(i, matrix);
  }
  gar.instanceMatrix.needsUpdate = true;
  root.add(even, odd, gar);
  const pine = new THREE.MeshBasicMaterial({ color: 0x234640 });
  const snow = new THREE.MeshBasicMaterial({ color: 0xf7fbff });
  const wood = new THREE.MeshBasicMaterial({ color: 0x6a4a32 });
  const tree = new THREE.Group();
  const trunk = own(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.46, 6), wood));
  trunk.position.y = 0.23; tree.add(trunk);
  [[0.62, 0.62, 0.78], [0.44, 0.5, 1.28], [0.26, 0.38, 1.7]].forEach(([r, h, y]) => {
    const cone = own(new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), pine));
    cone.position.y = y; tree.add(cone);
  });
  const star = own(new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), new THREE.MeshBasicMaterial({ color: 0xffd56a })));
  star.position.y = 1.95; tree.add(star);
  tree.position.set(9.4, 0, -17.5);
  root.add(tree);
  const arch = new THREE.Group();
  const woodArch = new THREE.MeshBasicMaterial({ color: 0x6a4a32 });
  const leafMat = new THREE.MeshBasicMaterial({ color: 0x8d6238 });
  const brace = new THREE.MeshBasicMaterial({ color: 0x4e3424 });
  const holly = new THREE.MeshBasicMaterial({ color: 0x1f6b45 });
  const zLeaf = -22.28;
  for (const x of [9.15, 15.35]) {
    const post = own(new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.7, 0.42), woodArch));
    post.position.set(x, 2.35, -22.72);
    arch.add(post);
  }
  const beam = own(new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.36, 0.48), warm));
  beam.position.set(12.25, 4.35, -22.72);
  arch.add(beam);
  const berry = new THREE.MeshBasicMaterial({ color: 0xc4364a });
  for (let i = 0; i < 11; i++) {
    const ball = own(new THREE.Mesh(new THREE.SphereGeometry(i === 5 ? 0.16 : 0.11, 7, 6), i === 5 ? berry : holly));
    ball.position.set(9.55 + i * 0.54, 4.62, -23.02);
    arch.add(ball);
  }
  const sign = document.createElement('canvas');
  sign.width = 512; sign.height = 128;
  const sg = sign.getContext('2d');
  sg.fillStyle = '#6a2430';
  sg.fillRect(0, 0, 512, 128);
  sg.strokeStyle = '#ffd27a';
  sg.lineWidth = 10;
  sg.strokeRect(8, 8, 496, 112);
  sg.fillStyle = '#ffd27a';
  sg.font = '700 72px Fredoka, sans-serif';
  sg.textAlign = 'center';
  sg.textBaseline = 'middle';
  sg.fillText('CHEGADA', 256, 68);
  const signTex = new THREE.CanvasTexture(sign);
  if ('colorSpace' in signTex && THREE.SRGBColorSpace) signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  const bannerSign = own(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), signMat));
  bannerSign.position.set(12.25, 4.95, -22.95);
  bannerSign.rotation.y = Math.PI;
  arch.add(bannerSign);
  const bannerIn = own(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), signMat.clone()));
  bannerIn.position.set(12.25, 4.95, -21.5);
  arch.add(bannerIn);
  const bulbGeo = new THREE.SphereGeometry(0.075, 6, 4);
  for (let i = 0; i < 16; i++) {
    const along = i / 15;
    const bulb = own(new THREE.Mesh(bulbGeo, i % 2 ? warm : cool));
    bulb.position.set(9.35 + along * 5.8, 4.62, -22.95);
    arch.add(bulb);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const bulb = own(new THREE.Mesh(bulbGeo, i % 2 ? cool : warm));
      bulb.position.set(12.25 + side * 3.05, 1.15 + i * 0.72, -22.95);
      arch.add(bulb);
    }
  }
  const leafW = 2.85, leafH = 3.82;
  const makeLeaf = (hingeX, signX) => {
    const g = new THREE.Group();
    g.position.set(hingeX, 0, zLeaf);
    const plank = own(new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.12), leafMat));
    plank.position.set(signX * leafW / 2, leafH / 2, 0);
    const bar = own(new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.86, 0.14, 0.16), brace));
    bar.position.set(signX * leafW / 2, leafH * 0.55, 0.04);
    g.add(plank, bar);
    arch.add(g);
    return g;
  };
  const left = makeLeaf(9.4, 1);
  const right = makeLeaf(15.1, -1);
  root.add(arch);
  arrival = { left, right, opening: false, t: 0 };
  const wraps = [0xf4efe4, 0xe6b325, 0x24344d, 0x6b3040];
  [[8.7, -18.2, 0.28, 0.2], [10.2, -18.4, 0.22, 0.16], [9.8, -16.7, 0.3, 0.2], [8.4, -16.6, 0.24, 0.16]].forEach(([x, z, w, h], i) => {
    const box = own(new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.82), new THREE.MeshBasicMaterial({ color: wraps[i] })));
    box.position.set(x, h / 2, z); box.rotation.y = i * 0.4;
    const ribbon = own(new THREE.Mesh(new THREE.BoxGeometry(0.045, h * 1.05, w * 0.84), snow));
    ribbon.position.y = 0; box.add(ribbon);
    root.add(box);
  });
  natal = { warm, cool };
}

function mountFinish() {
  const L = FINISH_LINE;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#1a100c' : '#f7f4ee';
    g.fillRect(i * 8, 0, 8, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  const stripe = own(new THREE.Mesh(new THREE.PlaneGeometry(L.x1 - L.x0, L.depth * 2), new THREE.MeshBasicMaterial({ map: tex })));
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set((L.x0 + L.x1) / 2, 0.045, L.z);
  root.add(stripe);
  const sign = document.createElement('canvas');
  sign.width = 512; sign.height = 128;
  const sg = sign.getContext('2d');
  sg.fillStyle = '#6a2430'; sg.fillRect(0, 0, 512, 128);
  sg.fillStyle = '#ffd27a'; sg.font = '700 72px Fredoka, sans-serif';
  sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('CHEGADA', 256, 68);
  const map = new THREE.CanvasTexture(sign);
  const banner = own(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide })));
  banner.position.set((L.x0 + L.x1) / 2, 2.15, L.z);
  root.add(banner);
}

function burstConfetti() {
  if (!root) return;
  const specs = [
    { color: 0xffd56a, n: 72, origin: [31.9, 2.4, -21.5] },
    { color: 0xfff4dc, n: 36, origin: [31.4, 2.9, -21.2] },
  ];
  const list = [];
  for (const spec of specs) {
    const pos = new Float32Array(spec.n * 3);
    const vel = [];
    for (let i = 0; i < spec.n; i++) {
      pos[i * 3] = spec.origin[0] + (Math.random() - 0.5) * 3.6;
      pos[i * 3 + 1] = spec.origin[1] + (Math.random() - 0.5) * 1.8;
      pos[i * 3 + 2] = spec.origin[2] + (Math.random() - 0.5) * 2.2;
      vel.push([(Math.random() - 0.5) * 2.2, 1.8 + Math.random() * 2.6, (Math.random() - 0.5) * 2.0]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = own(new THREE.Points(geo, new THREE.PointsMaterial({ color: spec.color, size: 0.16, transparent: true, opacity: 0.95 })));
    root.add(pts);
    list.push({ pts, vel });
  }
  bits = { list, age: 0 };
}
function tickBits(dt) {
  if (!bits) return;
  bits.age += dt;
  for (const item of bits.list) {
    const arr = item.pts.geometry.attributes.position.array;
    for (let i = 0; i < item.vel.length; i++) {
      item.vel[i][1] -= 4.2 * dt;
      arr[i * 3] += item.vel[i][0] * dt;
      arr[i * 3 + 1] += item.vel[i][1] * dt;
      arr[i * 3 + 2] += item.vel[i][2] * dt;
    }
    item.pts.geometry.attributes.position.needsUpdate = true;
  }
  if (bits.age > 2.8 && root) {
    for (const item of bits.list) root.remove(item.pts);
    bits = null;
  }
}
function tickGate(dt) {
  if (!arrival || !arrival.opening || arrival.t >= 1) return;
  arrival.t = Math.min(1, arrival.t + dt / 0.42);
  const a = ease(arrival.t) * 1.5;
  arrival.left.rotation.y = -a;
  arrival.right.rotation.y = a;
}

function tickNatal(t) {
  if (!natal) return;
  const s = 0.5 + 0.5 * Math.sin(t * 2.6);
  natal.warm.color.setRGB(1, 0.62 + 0.28 * s, 0.28 + 0.25 * s);
  natal.cool.color.setRGB(0.55 + 0.25 * (1 - s), 0.78 + 0.1 * s, 1);
}

function zedBox(z) {
  return { minX: z.x - 0.42, maxX: z.x + 0.42, minY: z.y + 0.15, maxY: z.y + 1.75, minZ: z.z - 0.42, maxZ: z.z + 0.42 };
}
function makeZed(t) {
  const model = makeZombie('walker');
  model.group.visible = true;
  model.group.position.set(t.x, t.y, t.z);
  root.add(model.group);
  return {
    ...t, model, phase: 'wait', x: t.x, z: t.z, y: t.y,
    alive: true, onGround: true, stunned: false, walk: 0, vel: { x: 0, z: 0 },
    pos: { x: t.x, y: t.y, z: t.z }, yaw: -Math.PI / 2,
  };
}
function wakeZeds() {
  for (const z of zeds) if (z.phase === 'wait') z.phase = 'run';
}
export function pitRay(ox, oy, oz, dx, dy, dz, maxT) {
  if (!run || run.done) return null;
  let best = null;
  for (const z of zeds) {
    if (z.phase !== 'run') continue;
    const t = rayAabb(ox, oy, oz, dx, dy, dz, zedBox(z), maxT);
    if (t == null) continue;
    if (!best || t < best.t) best = { t, id: z.id };
  }
  for (const b of boards) {
    if (!standing(b)) continue;
    const t = rayAabb(ox, oy, oz, dx, dy, dz, boardAabb(b, b.ground), maxT);
    if (t == null) continue;
    if (!best || t < best.t) best = { t, id: b.id };
  }
  const bonus = offerBonus(ox, oy, oz, dx, dy, dz, maxT);
  if (bonus && (!best || bonus.t < best.t)) {
    armBonus(bonus.shot);
    return { t: bonus.t, id: bonus.id };
  }
  armBonus(null);
  return best;
}

export function pitHit(id, weapon) {
  if (!run || !run.started || run.done) return false;
  if (id === 'bonus') {
    return takeBonusShot(weapon, {
      started: true, done: false,
      push: (extra) => pushEvent('bonus', extra),
      events: () => run.events,
      pop: () => run.events.pop(),
      sfx: deps && deps.sfx,
    });
  }
  const zed = zeds.find((x) => x.id === id);
  if (zed) {
    if (zed.phase !== 'run' || weapon !== PIT.pistol) return false;
    const before = inspectRun(run.events);
    pushEvent('hit', { id, w: weapon });
    const after = inspectRun(run.events);
    if (!(after.reason !== 'diário' && after.reason !== 'ordem' && !before.down.includes(id) && after.down.includes(id))) {
      run.events.pop(); return false;
    }
    zed.phase = 'dead';
    zed.model.group.visible = false;
    deps.sfx.hit();
    return true;
  }
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
  if (freshEnemy && after.missed.length === 0) { banner('Barriguinhas no chão. Dispara na volta!', false, 1.4); deps.sfx.pickup(); }
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
let escQuietUntil = 0;
const cardOpen = () => {
  const el = $('pitOver');
  return !!(el && !el.classList.contains('hidden'));
};
export function pitHolding() { return false; }
export function pitFinished() { return !!(run && run.done); }
export function pitResultOn() { return !!(run && run.done && cardOpen()); }
export function pitEscQuiet() { return performance.now() < escQuietUntil; }
export function dismissResult() {
  escQuietUntil = performance.now() + 700;
  const el = $('pitOver');
  if (el) el.classList.add('hidden');
}
export const pitActive = () => !!run;

function liveStars(clock, civs, started) {
  if (!started) return 0;
  const final = clock + civs * PIT.civPenalty + bonusAdjust();
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
  const clockText = !run.started ? '0:00.00' : (run.done && run.result && run.result.final != null ? formatPit(run.result.final) : formatPit(Math.max(0, run.clock + bonusAdjust())));
  if (!run.started) timer.textContent = 'LARGADA';
  else timer.textContent = clockText;
  let lead = 'O Barriguinha explica. Camisa vermelha cai. Azul é civil.';
  if (run.done) lead = 'Missão cumprida. R tenta de novo.';
  else if (run.started && onSprint(deps.player().pos.x, deps.player().pos.y, deps.player().pos.z)) lead = 'CRUZE A LINHA';
  else if (run.started) {
    const left = view ? view.missed.length : 0;
    lead = left ? (left === 1 ? 'Falta 1 Barriguinha' : `Faltam ${left} Barriguinhas`) : 'Barriguinhas no chão';
  }
  if (leader) { leader.textContent = lead; leader.dataset.h = ''; }
  if (score) score.textContent = run.started ? `Inimigos ${down}/${enemies} · civis ${civs}/${civTotal}` : 'Pistolinha · Barriguinha vermelho, civil azul';
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
  if (lb) lb.innerHTML = `<div class="lbh"><span>${PIT.title}</span><span>relógio</span></div><div class="row me"><span>1</span><span class="dot" style="background:#e07a6a"></span><span class="n">você</span><span class="k">${timer.textContent}</span></div>`;
  const ban = $('pitBanner');
  if (ban && performance.now() > bannerUntil) { ban.classList.add('hidden'); bannerText = ''; }
  paintTalk(false);
}
function pitEnemiesCount() { return pitTargets().filter((t) => t.kind === 'enemy').length; }

function rankRows(rows, meNick) {
  if (!rows || !rows.length) return '<p class="pit-empty">Ranking ainda vazio. O primeiro tempo com conta abre a lista.</p>';
  return `<ol class="pit-rank">${rows.map((r) => `<li class="${meNick && r.nick === meNick ? 'me' : ''}"><b>${r.place}. ${esc(r.nick)}</b><span>${esc(formatRankClock(r.best))} ${starsTxt(r.stars | 0)}</span></li>`).join('')}</ol>`;
}

function paintCard(result, extra) {
  const card = $('pitCard');
  if (!card || !result) return;
  const best = readBest();
  const sug = result.suggestion || suggestion(result.stars);
  const remote = extra && extra.remote;
  const logged = !!(getToken() && getAccount() && !getAccount().dev);
  let note = GUEST_RANK_NOTE;
  if (logged) {
    if (!remote) note = 'Mandando o tempo para o ranking…';
    else if (remote.guest) note = GUEST_RANK_NOTE;
    else if (remote.ok && remote.saved) note = 'Este tempo entrou no ranking da conta.';
    else if (remote.run && remote.run.reason === 'rápido') note = 'O servidor recusou o ranking: tempo abaixo do mínimo.';
    else if (remote.error) note = esc(remote.error);
    else note = 'O servidor não guardou este tempo.';
  }
  const rows = (remote && remote.rows) || (extra && extra.rank && extra.rank.rows) || [];
  const me = (remote && remote.me) || (extra && extra.rank && extra.rank.me);
  const enemies = pitEnemiesCount();
  const hitE = result.down ? result.down.length : 0;
  card.innerHTML = `
    <button type="button" id="pitDismiss" class="pit-x" aria-label="Fechar">×</button>
    <p class="pit-kicker">${PIT.title}</p>
    <h2>${result.finished ? 'MISSÃO CUMPRIDA' : 'Incompleta'}</h2>
    <p class="pit-time">${result.finished ? formatPit(result.final) : '—'}</p>
    <p class="pit-stars" aria-label="${result.stars} estrelas">${starsTxt(result.stars || 0)}</p>
    <p class="pit-split">Inimigos ${hitE}/${enemies} · Civis ${result.civs || 0}/${pitTargets().filter((t) => t.kind === 'civil').length}</p>
    <p class="pit-split">Tempo ${formatPit(result.raw)} · penalidade +${(result.penalty || 0).toFixed(2)} s</p>
    <p class="pit-split">Alvo: <span style="color:${result.bonusZone === 'center' ? '#7CFF6B' : result.bonusZone === 'ring' ? '#ff4b4b' : 'inherit'}">${bonusLine(result.bonusZone)}</span></p>
    <p class="pit-sug">${result.finished ? `Sugestão do Docão: <b>${esc(sug.label)}</b> · ${esc(sug.hint)}` : 'A chegada não abriu.'}</p>
    <p class="pit-best">Seu melhor ${logged && me ? 'na conta' : 'neste navegador'}: <b>${best ? formatRankClock(best.final) + ' ' + starsTxt(best.stars) : '—'}</b>${me ? ` · ranking ${me.place}º (${esc(formatRankClock(me.best))})` : ''}</p>
    <h3>Mais rápidos</h3>
    ${rankRows(rows, me && me.nick)}
    <p class="pit-note">${note}</p>
    <p class="pit-how">R volta pra largada e começa outra. Esc ou FECHAR só tira este cartaz: você continua andando no mapa, e R recomeça.</p>
    <div class="pit-actions"><button type="button" id="pitAgain">DE NOVO · R</button><button type="button" id="pitClose" class="secondary">FECHAR · ESC</button></div>`;
  const again = $('pitAgain'), close = $('pitClose'), x = $('pitDismiss');
  if (again) again.onclick = () => restartCourse();
  if (close) close.onclick = () => dismissResult();
  if (x) x.onclick = () => dismissResult();
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
  shout = 'ISSO, PORQUINHO!';
  shoutUntil = performance.now() + 3200;
  if (coach && coach.model) setPose(coach.model, 'wave');
  burstConfetti();
  deps.sfx.fanfare();
  showResult(run.result, { remote: null, rank: null });
  const [remote, rank] = await Promise.all([
    submitPit(run.events).catch(() => ({ ok: false, error: 'Sem conexão com o ranking' })),
    loadPitRank().catch(() => null),
  ]);
  if (mine !== gen || !run || !run.done || !cardOpen()) return;
  showResult(run.result, { remote, rank });
}

function grabZed(z) {
  if (z.phase !== 'run') return;
  const before = inspectRun(run.events.length >= 2 ? run.events : [{ k: 'start', t: 0 }, { k: 'pop', bay: z.bay, t: 0 }]);
  pushEvent('grab', { id: z.id });
  const after = inspectRun(run.events);
  if (after.reason === 'diário' || after.reason === 'ordem' || !(after.grabs > (before.grabs || 0))) {
    run.events.pop();
    return;
  }
  z.phase = 'dead';
  z.model.group.visible = false;
  banner(`+${PIT.zombie.penalty.toFixed(1).replace('.', ',')} s · ${z.name} te alcançou`, true, 1.8);
  deps.sfx.oink();
}
function stepZeds(dt) {
  if (!run || !deps) return;
  const p = deps.player();
  for (const z of zeds) {
    if (z.phase === 'wait') {
      z.vel.x = 0; z.vel.z = 0;
      z.pos.x = z.x; z.pos.y = z.y; z.pos.z = z.z;
      animateZombie(z.model, z, dt, lineAt, false);
      continue;
    }
    if (z.phase !== 'run' || !run.started || run.done || !p) continue;
    const dx = p.pos.x - z.x, dz = p.pos.z - z.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (dist < PIT.zombie.reach) { grabZed(z); continue; }
    const step = Math.min(dist - 0.2, PIT.zombie.speed * dt);
    z.x += dx / dist * step;
    z.z += dz / dist * step;
    z.yaw = Math.atan2(dx, dz);
    z.vel.x = dx / dist * PIT.zombie.speed;
    z.vel.z = dz / dist * PIT.zombie.speed;
    z.pos.x = z.x; z.pos.y = z.y; z.pos.z = z.z;
    animateZombie(z.model, z, dt, lineAt, false);
  }
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
  tickBonusTarget(dt);
  tickNatal(lineAt);
  tickBits(dt);
  tickGate(dt);
  stepMovers(dt);
  stepZeds(dt);
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
  const back = pitRescue(pos.x, pos.y, pos.z);
  if (back) {
    p.pos.set(back.x, deps.groundAt(back.x, back.z, (back.y || 0) + 1), back.z);
    p.vel.set(0, 0, 0);
  }
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
    if (gate.open && !run.opened) {
      run.opened = true;
      if (deps.openDoor) deps.openDoor();
      if (arrival) arrival.opening = true;
    }
    if (gate.pop && !run.pops.has(gate.pop)) {
      const before = run.pops.size;
      const filled = fillPops([...run.pops], gate.pop);
      if (!filled) continue;
      for (const id of filled) {
        if (run.pops.has(id)) continue;
        run.pops.add(id);
        pushEvent('pop', { bay: id });
      }
      if (filled.length > before && zombiesAwake(filled)) wakeZeds();
    }
  }
  if (run.started && onFinishLine(pos)) {
    const view = inspectRun(run.events);
    if (view.missed.length === 0 && view.pops.length === PIT.bays.length) {
      pushEvent('finish', { x: ROUND2(pos.x), z: ROUND2(pos.z) });
      closeRun();
    } else if (!warned) {
      warned = true;
      const n = view.missed.length;
      banner(n ? (n === 1 ? 'Volta. Falta 1 Barriguinha.' : `Volta. Faltam ${n} Barriguinhas.`) : 'Ainda falta sala.', true, 1.6);
    }
  } else if (!onFinishLine(pos)) warned = false;
  paintHud();
}

export function beginCourse(next) {
  clearCourse();
  deps = next;
  root = new THREE.Group();
  root.name = 'pocilga';
  deps.scene.add(root);
  boards = pitTargets().filter((t) => !t.zombie).map((t) => {
    const floor = deps.groundAt(t.x, t.z, (t.y || 0) + 1);
    const ground = (t.y || 0) > floor + 0.8 ? t.y : floor;
    return makeBoard(t, ground);
  });
  zeds = pitTargets().filter((t) => t.zombie).map((t) => makeZed(t));
  for (const b of boards) pose(b);
  placeCoach();
  mountNatal();
  mountFinish();
  mountBonusTarget(root);
  run = { clock: 0, moverT: 0, started: false, done: false, opened: false, events: [], pops: new Set(), said: new Set(), result: null };
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
  for (const z of zeds) {
    const g = z.model && z.model.group;
    if (g && root) root.remove(g);
    if (g) g.traverse((o) => {
      const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of list) m.dispose();
    });
  }
  zeds = [];
  run = null;
  coach = null;
  natal = null;
  clearBonusTarget();
  arrival = null;
  bits = null;
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
    targets: boards.map((b) => ({ id: b.id, kind: b.kind, name: b.name, x: b.x, z: b.z, y: b.y || 0, phase: b.phase, face: b.face || -1, mover: !!b.move, zombie: false })).concat(zeds.map((z) => ({ id: z.id, kind: z.kind, name: z.name, x: z.x, z: z.z, y: z.y || 0, phase: z.phase === 'run' ? 'up' : z.phase === 'dead' ? 'dead' : 'down', face: z.face || '-x', mover: false, zombie: true, shown: !!(z.model && z.model.group.visible) }))),
    card: $('pitOver') ? !$('pitOver').classList.contains('hidden') : false,
    coach: !!coach,
    bonus: bonusSnap(),
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

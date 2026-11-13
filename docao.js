// Docão procedural: modelo 3D fiel à arte oficial + sistema de skins.
// O loop da partida deve chamar makeNukeRider() e pôr o grupo na cena (cai no centro). Ainda não está ligado.
import * as THREE from 'three';
import { makeWorldSaber } from './saber-view.js';
import { makeWorldShield } from './shield-view.js';
import { getSkin } from './skins.js';
import { mergeVertices } from './vendor/BufferGeometryUtils.js';
import { crouchAmount, stanceScale } from './shared/stance.js';
import { butterflyInspectAngles } from './inspect.js';

const V3 = THREE.Vector3, V2 = THREE.Vector2;
const TAU = Math.PI * 2;

// Paleta amostrada da arte oficial
export const PALETTE = {
  skin: '#ee9c22', snout: '#ec5c0c', nostril: '#3a0806', blush: '#e2482a', earInner: '#e8682a',
  eyeWhite: '#fffaf0', iris: '#5a2c12', pupil: '#120604', brow: '#2a1408', outline: '#2b1206',
  mouth: '#2e0503', tongue: '#e8606a', teeth: '#fffaf0', hoof: '#5a3020',
};

// ---------- materiais ----------
const gradTex = (() => {
  const t = new THREE.DataTexture(new Uint8Array([95, 160, 210]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
export function toon(color, extra = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradTex, ...extra });
  return m;
}
// sombra saturada (como na arte): um pouco de emissive da própria cor
export function toonWarm(color, k = 0.22, extra = {}, warm = null) {
  const m = toon(color, extra); m.emissive = (warm ? new THREE.Color(warm) : new THREE.Color(color)).multiplyScalar(k); m.userData.baseEmissive = m.emissive.clone(); return m;
}
const outlineCache = new Map();
export function outlineMat(th = 0.012) {
  if (outlineCache.has(th)) return outlineCache.get(th);
  const m = new THREE.MeshBasicMaterial({ color: PALETTE.outline, side: THREE.BackSide });
  m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${th.toFixed(4)};`); };
  m.customProgramCacheKey = () => 'outline' + th;
  outlineCache.set(th, m); return m;
}
// geometria com normais suavizadas para o contorno não "abrir" nas quinas
const smoothCache = new WeakMap();
function smoothGeo(geo) {
  if (smoothCache.has(geo)) return smoothCache.get(geo);
  let g = geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g = mergeVertices(g, 1e-3); g.computeVertexNormals(); smoothCache.set(geo, g); return g;
}
export function outline(mesh, th = 0.012) {
  const o = new THREE.Mesh(smoothGeo(mesh.geometry), outlineMat(th)); o.raycast = () => {}; o.userData.isOutline = true; mesh.add(o); return mesh;
}
export const basic = (c) => new THREE.MeshBasicMaterial({ color: c });

// ---------- tom de pele travado na identidade ----------
function safeTone(hex) {
  const c = new THREE.Color(hex || PALETTE.skin); const hsl = {}; c.getHSL(hsl);
  c.setHSL(THREE.MathUtils.clamp(hsl.h, 30 / 360, 46 / 360), Math.max(hsl.s, 0.78), THREE.MathUtils.clamp(hsl.l, 0.5, 0.66));
  return '#' + c.getHexString();
}

// ---------- geometria: cabeça (lathe em forma de pera, bochechuda embaixo) ----------
export const HEAD = { y0: 1.0, y1: 2.04, zs: 0.92, n: 40 };
export function headR(y) {
  const t = THREE.MathUtils.clamp((y - HEAD.y0) / (HEAD.y1 - HEAD.y0), 0, 1);
  const u = 2 * t - 1; const p = t < 0.45 ? 0.26 : 0.55;
  return Math.max(0.001, (0.6 - 0.16 * t) * Math.pow(Math.max(0, 1 - u * u), p));
}
let headGeo = null;
function getHeadGeo() {
  if (headGeo) return headGeo;
  const pts = []; for (let i = 0; i <= HEAD.n; i++) { const y = HEAD.y0 + (HEAD.y1 - HEAD.y0) * i / HEAD.n; pts.push(new V2(headR(y), y)); }
  headGeo = new THREE.LatheGeometry(pts, 56, Math.PI, TAU); return headGeo;
}
// ponto/normal na superfície da cabeça (θ = ângulo a partir da frente, + para a direita do personagem = +x)
export function headPoint(theta, y, out = 0) {
  const r = headR(y) + out; return new V3(r * Math.sin(theta), y, r * HEAD.zs * Math.cos(theta));
}
export function headNormal(theta, y) {
  const dy = 0.01, dr = (headR(y + dy) - headR(y - dy)) / (2 * dy);
  return new V3(Math.sin(theta), -dr * 0.9, HEAD.zs * Math.cos(theta)).normalize();
}

// ---------- geometria: tronco (camiseta) ----------
export const TORSO_PTS = new THREE.SplineCurve([new V2(0.01, 0.4), new V2(0.36, 0.42), new V2(0.47, 0.56), new V2(0.5, 0.72), new V2(0.48, 0.9), new V2(0.42, 1.03), new V2(0.28, 1.12), new V2(0.01, 1.15)]).getSpacedPoints(36);
let torsoGeo = null;
const getTorsoGeo = () => torsoGeo || (torsoGeo = new THREE.LatheGeometry(TORSO_PTS, 48, Math.PI, TAU));
export function torsoR(y) { let best = TORSO_PTS[0], bd = 9; for (const p of TORSO_PTS) if (Math.abs(p.y - y) < bd && p.x > 0.05) { bd = Math.abs(p.y - y); best = p; } return best.x; }
function torsoV(y) { let best = 0, bd = 9; TORSO_PTS.forEach((p, i) => { if (i > 2 && i < 33 && Math.abs(p.y - y) < bd) { bd = Math.abs(p.y - y); best = i; } }); return best / (TORSO_PTS.length - 1); }

function roundedCyl(r, h, e = 0.05, seg = 40) {
  const pts = [new V2(0.001, -h / 2)];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI / 2; pts.push(new V2(r - e + Math.cos(a) * e, -h / 2 + e + Math.sin(a) * e)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new V2(r - e + Math.cos(a) * e, h / 2 - e + Math.sin(a) * e)); }
  pts.push(new V2(0.001, h / 2));
  return new THREE.LatheGeometry(pts, seg);
}

// ---------- texturas ----------
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// Logo "C!" desenhado à mão (não depende de fonte instalada)
export function drawLogo(x, cx, cy, h, color, outlineColor = null) {
  const paths = () => {
    x.beginPath(); x.arc(cx - h * 0.2, cy, h * 0.33, Math.PI * 0.27, Math.PI * 1.73);
  };
  const bang = (grow) => {
    x.beginPath(); const bx = cx + h * 0.36; const w = h * 0.2 + grow;
    x.moveTo(bx - w / 2 + h * 0.03, cy - h * 0.48 - grow / 2); x.lineTo(bx + w / 2 + h * 0.03, cy - h * 0.48 - grow / 2);
    x.lineTo(bx + w * 0.3, cy + h * 0.18 + grow / 2); x.lineTo(bx - w * 0.3, cy + h * 0.18 + grow / 2); x.closePath(); x.fill();
    x.beginPath(); x.arc(bx, cy + h * 0.38, h * 0.11 + grow / 2, 0, TAU); x.fill();
  };
  x.lineCap = 'butt';
  if (outlineColor) { x.strokeStyle = x.fillStyle = outlineColor; x.lineWidth = h * 0.26 + h * 0.1; paths(); x.stroke(); bang(h * 0.1); }
  x.strokeStyle = x.fillStyle = color; x.lineWidth = h * 0.26; paths(); x.stroke(); bang(0);
}
const texCache = new Map();
function headTexture(tone, beard = null, paint = null, angry = false) { // angry: cara de bravo (dentes cerrados, sem blush)
  const key = 'head' + tone + beard + paint + (angry ? ':angry' : ''); if (texCache.has(key)) return texCache.get(key);
  const W = 1024, H = 512;
  const t = canvasTex(W, H, (x) => {
    x.fillStyle = tone; x.fillRect(0, 0, W, H);
    const P = (theta, y) => [(0.5 + theta / TAU) * W, (1 - (y - HEAD.y0) / (HEAD.y1 - HEAD.y0)) * H];
    const pxH = (y) => W / (TAU * headR(y)), pxV = H / (HEAD.y1 - HEAD.y0);
    // bochechas (blush) suaves
    for (const s of angry ? [] : [-1, 1]) {
      const [cx, cy] = P(s * 0.86, 1.47); const g = x.createRadialGradient(cx, cy, 2, cx, cy, 0.13 * pxH(1.47));
      g.addColorStop(0, PALETTE.blush); g.addColorStop(0.55, PALETTE.blush + 'cc'); g.addColorStop(1, PALETTE.blush + '00');
      x.save(); x.translate(cx, cy); x.scale(1, pxV / pxH(1.47) * 0.85); x.translate(-cx, -cy); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 0.13 * pxH(1.47), 0, TAU); x.fill(); x.restore();
    }
    if (beard) { // barba por fazer: pontinhos no queixo e nas laterais da boca (a boca é pintada por cima)
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const zone = () => { x.beginPath(); for (let i = 0; i <= 24; i++) { const th = -0.9 + (i / 24) * 1.8; const e = Math.abs(th) / 0.9; x.lineTo(...P(th, 1.36 - e * e * 0.1)); } for (let i = 24; i >= 0; i--) { const th = -0.9 + (i / 24) * 1.8; const e = Math.abs(th) / 0.9; x.lineTo(...P(th, 1.05 + e * e * 0.16)); } x.closePath(); };
      x.save(); x.filter = 'blur(10px)'; zone(); x.fillStyle = beard + '33'; x.fill(); x.restore();
      x.save(); zone(); x.clip(); x.fillStyle = beard + '66';
      for (let i = 0; i < 900; i++) { const [px, py] = P((rnd() * 2 - 1) * 0.9, 1.04 + rnd() * 0.33); x.fillRect(px, py, 2, 2); }
      x.restore();
    }
    if (angry) { // boca de bravo: dentes cerrados, cantos caídos
      const pts = [[-0.36, 1.13], [-0.3, 1.22], [0, 1.26], [0.3, 1.22], [0.36, 1.13], [0.3, 1.09], [0, 1.1], [-0.3, 1.09]].map(([t, y]) => P(t, y));
      const path = () => { x.beginPath(); x.moveTo(...pts[0]); x.quadraticCurveTo(...pts[1], ...P(-0.12, 1.255)); x.quadraticCurveTo(...pts[2], ...P(0.12, 1.255)); x.quadraticCurveTo(...pts[3], ...pts[4]);
        x.quadraticCurveTo(...pts[5], ...P(0.1, 1.098)); x.quadraticCurveTo(...pts[6], ...P(-0.1, 1.098)); x.quadraticCurveTo(...pts[7], ...pts[0]); x.closePath(); };
      path(); x.fillStyle = PALETTE.teeth; x.fill();
      x.save(); path(); x.clip(); x.strokeStyle = PALETTE.mouth; x.lineWidth = 5; x.beginPath();
      const ym = P(0, 1.175)[1]; x.moveTo(P(-0.4, 0)[0], ym); x.lineTo(P(0.4, 0)[0], ym);
      for (const t of [-0.24, -0.12, 0, 0.12, 0.24]) { const [tx] = P(t, 0); x.moveTo(tx, P(0, 1.3)[1]); x.lineTo(tx, P(0, 1.05)[1]); }
      x.stroke(); x.restore();
      path(); x.lineWidth = 7; x.strokeStyle = PALETTE.outline; x.lineJoin = 'round'; x.stroke();
    }
    // boca: sorriso aberto com dentes e língua (logo abaixo do focinho)
    const L = P(-0.5, 1.37), R = P(0.5, 1.37), topC = P(0, 1.2), botC = P(0, 0.86);
    const mouthPath = () => { x.beginPath(); x.moveTo(...L); x.quadraticCurveTo(...topC, ...R); x.quadraticCurveTo(...botC, ...L); x.closePath(); };
    if (!angry) {
    mouthPath(); x.fillStyle = PALETTE.mouth; x.fill();
    x.save(); mouthPath(); x.clip();
    const tg = P(0.05, 1.1); x.fillStyle = PALETTE.tongue; x.beginPath(); x.ellipse(tg[0], tg[1] + 12, 80, 34, 0, 0, TAU); x.fill();
    x.fillStyle = PALETTE.teeth; x.beginPath(); x.moveTo(L[0], L[1] - 6); x.quadraticCurveTo(topC[0], topC[1] - 6, R[0], R[1] - 6); x.lineTo(R[0], R[1] + 16); x.quadraticCurveTo(topC[0], topC[1] + 16, L[0], L[1] + 16); x.closePath(); x.fill();
    x.restore();
    mouthPath(); x.lineWidth = 7; x.strokeStyle = PALETTE.outline; x.lineJoin = 'round'; x.stroke();
    }
    if (paint === 'spider') { // máscara vermelha com teia na cabeça toda, menos a frente do focinho/boca; orelhas (malha à parte) continuam de porco
      const yCut = P(0, 1.40)[1], xL = P(-0.95, 1.2)[0], xR = P(0.95, 1.2)[0];
      x.fillStyle = '#d8261c';
      x.fillRect(0, 0, W, yCut); // topo
      x.fillRect(0, yCut, xL, H - yCut); // lado esquerdo + costas (emenda)
      x.fillRect(xR, yCut, W - xR, H - yCut); // lado direito + costas
      x.save();
      x.beginPath(); x.rect(0, 0, W, yCut); x.rect(0, yCut, xL, H - yCut); x.rect(xR, yCut, W - xR, H - yCut); x.clip();
      x.strokeStyle = '#111114'; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round';
      for (let i = 0; i < 16; i++) { const th = -Math.PI + i * TAU / 16; x.beginPath(); x.moveTo(...P(th, HEAD.y1)); x.lineTo(...P(th, HEAD.y0)); x.stroke(); }
      for (const y of [1.98, 1.86, 1.74, 1.62, 1.50, 1.36, 1.22]) { x.beginPath(); x.moveTo(...P(-Math.PI, y)); x.lineTo(...P(Math.PI, y)); x.stroke(); }
      x.restore();
    }
    if (paint === 'skull') { // pintura de caveira leve: máscara branca ao redor dos olhos + detalhes verdes (bochechas e focinho continuam)
      for (const s of [-1, 1]) {
        const [cx, cy] = P(s * 0.33, 1.71); const rx = 0.2 * pxH(1.71), ry = 0.21 * pxV;
        x.fillStyle = '#f7f7f2'; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.fill();
        x.strokeStyle = '#8dff6a'; x.lineWidth = 5; x.beginPath(); x.ellipse(cx, cy, rx + 3, ry + 3, 0, 0, TAU); x.stroke();
        for (let k = 0; k < 5; k++) { const a = Math.PI * (0.15 + k * 0.175); x.fillStyle = '#8dff6a'; x.beginPath(); x.arc(cx + Math.cos(a) * (rx + 16) * -s * -1, cy - Math.sin(a) * (ry + 16), 5, 0, TAU); x.fill(); }
      }
      const [fx, fy] = P(0, 1.9); x.fillStyle = '#f7f7f2'; x.beginPath(); x.moveTo(fx, fy - 26); x.lineTo(fx + 20, fy + 8); x.lineTo(fx - 20, fy + 8); x.closePath(); x.fill(); // losango na testa
      x.strokeStyle = '#2e0503'; x.lineWidth = 3; for (const s of [-1, 1]) { const [mx, my] = P(s * 0.55, 1.33); for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(mx + s * k * 10, my - 8); x.lineTo(mx + s * k * 10, my + 8); x.stroke(); } } // pontinhos de costura no canto da boca
    }
    for (const [p, s] of angry ? [] : [[L, -1], [R, 1]]) { x.beginPath(); x.moveTo(p[0] - s * 4, p[1] - 14); x.quadraticCurveTo(p[0] + s * 14, p[1] - 4, p[0] + s * 4, p[1] + 14); x.lineWidth = 6; x.stroke(); }
  });
  texCache.set(key, t); return t;
}
function shirtTexture(shirt) {
  const key = 'shirt' + JSON.stringify(shirt); if (texCache.has(key)) return texCache.get(key);
  const W = 1024, H = 512;
  const t = canvasTex(W, H, (x) => {
    x.fillStyle = shirt.color || '#d8261c'; x.fillRect(0, 0, W, H);
    const pat = shirt.pattern;
    if (pat && pat.colors && pat.colors.length) {
      const n = pat.count || 8;
      for (let i = 0; i < n; i++) {
        x.fillStyle = pat.colors[i % pat.colors.length];
        if (pat.type === 'hoops') x.fillRect(0, i * H / n, W, H / n + 1); else x.fillRect(i * W / n, 0, W / n + 1, H);
      }
    }
    const PT = (th, y) => [(0.5 + th / TAU) * W, (1 - torsoV(y)) * H];
    for (const d of shirt.details || []) { const fn = SHIRT_DETAILS[d.type]; if (fn) fn(x, d, PT, W, H); else console.warn('Detalhe de camiseta desconhecido:', d.type); }
    const logo = shirt.logo;
    if (logo) {
      const v = torsoV(logo.y || 0.76), cy = (1 - v) * H, cx = (0.5 + (logo.x || 0) / TAU) * W;
      const pxH = W / (TAU * 0.5), pxV = H / 1.43; // px por unidade (aprox.)
      const hUnits = logo.size || 0.3;
      x.save(); x.translate(cx, cy); x.scale(pxH / pxV, 1); x.translate(-cx, -cy);
      const hp = hUnits * pxV;
      if (logo.text === 'C!' || !logo.text) drawLogo(x, cx, cy, hp, logo.color || '#f5e6d0', logo.outline || null);
      else { x.font = `900 ${hp}px Impact, "Arial Black", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; if (logo.outline) { x.lineWidth = hp * 0.12; x.strokeStyle = logo.outline; x.strokeText(logo.text, cx, cy); } x.fillStyle = logo.color || '#fff'; x.fillText(logo.text, cx, cy); }
      if (logo.sub) { x.font = `bold ${hp * 0.32}px "Trebuchet MS", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = logo.color || '#fff'; x.fillText(logo.sub, cx, cy + hp * 0.78); }
      x.restore();
    }
  });
  texCache.set(key, t); return t;
}

// ---------- detalhes pintados na camiseta (shirt.details) ----------
export const SHIRT_DETAILS = {
  military(x, d, PT, W) { // jaqueta militar: duas fileiras de botões dourados + alamares + barra
    const c = d.color || '#e8b830';
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6; x.beginPath(); x.moveTo(...PT(0, 1.1)); x.lineTo(...PT(0, 0.42)); x.stroke();
    for (let i = 0; i < 5; i++) {
      const y = 1.0 - i * 0.11, L = PT(-0.22, y), R = PT(0.22, y);
      x.strokeStyle = c; x.lineWidth = 7; x.beginPath(); x.moveTo(...L); x.lineTo(...R); x.stroke();
      for (const p of [L, R]) { x.fillStyle = c; x.beginPath(); x.arc(p[0], p[1], 11, 0, TAU); x.fill(); x.strokeStyle = '#6a4a00'; x.lineWidth = 3; x.stroke(); }
    }
    const h = PT(0, 0.46); x.fillStyle = c; x.fillRect(0, h[1] - 6, W, 12);
  },
  frogs(x, d, PT) { // fecho central com botões de nó (estilo tradicional chinês)
    const c = d.color || '#f2c14e';
    x.strokeStyle = c; x.lineWidth = 8; x.beginPath(); x.moveTo(...PT(0, 1.1)); x.lineTo(...PT(0, 0.42)); x.stroke();
    for (let i = 0; i < 5; i++) {
      const p = PT(0, 1.0 - i * 0.12); x.lineWidth = 6;
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(p[0] + s * 26, p[1], 22, 9, 0, 0, TAU); x.stroke(); }
      x.fillStyle = c; x.beginPath(); x.arc(p[0], p[1], 10, 0, TAU); x.fill();
    }
  },
  clouds(x, d, PT, W) { // barra de nuvens estilizadas
    const c = d.color || '#f2c14e'; const y = PT(0, d.y || 0.5)[1];
    x.fillStyle = c; x.fillRect(0, y + 10, W, 16);
    x.strokeStyle = c; x.lineWidth = 6;
    for (let k = 0; k < W; k += 72) { x.beginPath(); x.arc(k + 18, y, 14, Math.PI, 0); x.arc(k + 40, y - 6, 16, Math.PI, 0); x.arc(k + 60, y + 2, 10, Math.PI, 0.3); x.stroke(); }
  },
  tie(x, d, PT) { // gravata listrada
    const [a, b] = d.colors || ['#8b1a1a', '#d4a537'];
    const top = PT(0, 1.08), knotB = PT(0, 1.0), tip = PT(0, 0.6);
    x.save(); x.beginPath(); x.moveTo(top[0] - 22, top[1]); x.lineTo(top[0] + 22, top[1]); x.lineTo(knotB[0] + 14, knotB[1]); x.lineTo(knotB[0] + 34, tip[1] - 30); x.lineTo(tip[0], tip[1]); x.lineTo(knotB[0] - 34, tip[1] - 30); x.lineTo(knotB[0] - 14, knotB[1]); x.closePath();
    x.fillStyle = a; x.fill(); x.clip(); x.strokeStyle = b; x.lineWidth = 12;
    for (let k = -200; k < 400; k += 36) { x.beginPath(); x.moveTo(top[0] - 60, top[1] + k); x.lineTo(top[0] + 60, top[1] + k - 60); x.stroke(); }
    x.restore(); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 3; x.beginPath(); x.moveTo(knotB[0] - 14, knotB[1]); x.lineTo(knotB[0] + 14, knotB[1]); x.stroke();
  },
  zipper(x, d, PT) { const c = d.color || '#bbbbbb'; x.strokeStyle = c; x.lineWidth = 5; x.beginPath(); x.moveTo(...PT(0, 1.1)); x.lineTo(...PT(0, 0.42)); x.stroke(); },
  backStripes(x, d, PT, W) { // listras nas costas (fantasia)
    const c = d.color || '#7a4a1c';
    for (const y of d.ys || [0.95, 0.78]) { const yy = PT(0, y)[1]; x.fillStyle = c; for (const [x0, x1] of [[0, W * 0.1], [W * 0.9, W]]) { x.beginPath(); x.roundRect ? x.roundRect(x0 - 20, yy - 16, x1 - x0 + 40, 32, 16) : x.rect(x0, yy - 16, x1 - x0, 32); x.fill(); } }
  },
};

// ---------- peças de skin (chapéus/acessórios) ----------
// Cada builder recebe (opções da skin, rig) e retorna um Object3D. Adicione novos tipos aqui.
export const PARTS = {
  cap(o, rig) {
    const g = new THREE.Group(); const m = toon(o.color || '#7DF9FF'), bm = toon(o.brim || o.color || '#12233a');
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 16, 0, TAU, 0, Math.PI / 2), m); dome.scale.set(1.04, 0.62, 0.98); outline(dome, 0.012); g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 32, 1, false, -Math.PI / 2, Math.PI), bm);
    brim.scale.set(1, 1, 1.2); brim.position.set(0, 0.005, 0.36); brim.rotation.x = 0.12; outline(brim, 0.01); g.add(brim);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), bm); btn.position.y = 0.27; g.add(btn);
    if (o.logo) {
      const tex = canvasTex(256, 256, (x) => { if (o.logo === 'arcs') { x.strokeStyle = o.logoColor || '#2ec4b6'; x.lineWidth = 26; x.lineCap = 'round'; for (const s of [-1, 1]) { x.beginPath(); x.arc(128 + s * 120, 128, 90, s < 0 ? -0.75 : Math.PI - 0.75, s < 0 ? 0.75 : Math.PI + 0.75); x.stroke(); } } else drawLogo(x, 128, 128, 170, o.logoColor || '#12233a'); });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
      p.position.set(0, 0.15, 0.39); p.rotation.x = -0.45; g.add(p);
    }
    g.position.set(0, 1.74 + (o.lift || 0), -0.01); g.rotation.x = -0.12; if (o.scale) g.scale.setScalar(o.scale); return g;
  },
  glasses(o, rig) {
    const g = new THREE.Group(); const m = basic(o.color || '#2a1408');
    for (const e of rig.eyes) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.016, 8, 28), m); ring.position.copy(e.position).addScaledVector(e.userData.n, 0.06);
      ring.lookAt(ring.position.clone().add(e.userData.n)); ring.scale.set(1, 1.1, 1); g.add(ring);
    }
    const a = rig.eyes[0].position.clone().addScaledVector(rig.eyes[0].userData.n, 0.07), b = rig.eyes[1].position.clone().addScaledVector(rig.eyes[1].userData.n, 0.07);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, a.distanceTo(b) - 0.25, 6), m);
    br.position.copy(a).add(b).multiplyScalar(0.5); br.position.y += 0.03; br.rotation.z = Math.PI / 2; g.add(br);
    return g;
  },
  sunglasses(o, rig) {
    const g = new THREE.Group(); const lens = toon(o.lens || '#111318'), fr = basic(o.color || '#111');
    for (const e of rig.eyes) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 12), lens); l.scale.set(1.15, 0.8, 0.3);
      l.position.copy(e.position).addScaledVector(e.userData.n, 0.065); l.lookAt(l.position.clone().add(e.userData.n)); outline(l, 0.01); g.add(l);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.03), fr); bar.position.copy(rig.eyes[0].position).add(rig.eyes[1].position).multiplyScalar(0.5); bar.position.y += 0.07; bar.position.z += 0.07; g.add(bar);
    return g;
  },
  bandana(o) {
    const g = new THREE.Group(); const m = toon(o.color || '#c0392b');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 10, 28), m); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 0.85, 1); outline(ring, 0.01); g.add(ring);
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 3), m); tri.rotation.x = Math.PI; tri.position.set(0, -0.12, 0.27); tri.scale.z = 0.35; outline(tri, 0.01); g.add(tri);
    g.position.y = 1.1; return g;
  },
  headphones(o) {
    const g = new THREE.Group(); const m = toon(o.color || '#222'); const d = toon(o.accent || '#7DF9FF');
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 32, Math.PI), m); band.position.y = 1.5; outline(band, 0.008); g.add(band);
    for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 20), d); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.52, 1.5, 0); outline(cup, 0.01); g.add(cup); }
    return g;
  },
};

// ---------- montagem do Docão ----------
export function makeDocao(skinOrId, opts = {}) {
  const skin = typeof skinOrId === 'string' ? getSkin(skinOrId) : (skinOrId || getSkin());
  const { withGun = true, pose = withGun ? 'gun' : 'idle' } = opts;
  const tone = safeTone(skin.body && skin.body.tone);
  const shirt = skin.shirt || {}; const trim = shirt.trim || '#1d1410';
  const beardPart = (skin.parts || []).find((p) => p.type === 'beard'); const beard = beardPart && beardPart.stubble !== false ? (beardPart.color || '#3a2412') : null; // stubble:false = só o bigode 3D, sem barba no queixo
  const skinM = toonWarm(tone, 0.42, {}, '#e0500a'), facePaint = skin.face && skin.face.paint, faceM = toonWarm('#ffffff', 0.3, { map: headTexture(tone, beard, facePaint), emissiveMap: headTexture(tone, beard, facePaint) }, '#ff9a80');
  const snoutM = toonWarm(PALETTE.snout, 0.25), earInM = toonWarm(PALETTE.earInner, 0.2), hoofM = toon(PALETTE.hoof);
  const shirtM = toonWarm('#ffffff', 0.14, { map: shirtTexture(shirt), emissiveMap: shirtTexture(shirt) });
  const sleeveM = toonWarm(sleeveColor(shirt), 0.12); const sleeves = shirt.sleeves || 'short';
  const trimM = toon(trim), pantsM = toon(skin.pants || '#1d1410');
  const dark = basic(PALETTE.nostril), white = basic(PALETTE.eyeWhite);

  const g = new THREE.Group();
  const mesh = (geo, mat, parent = g, ol = 0.012, shadow = false) => { const m = new THREE.Mesh(geo, mat); parent.add(m); if (ol) outline(m, ol); if (shadow) m.castShadow = true; return m; };

  // pernas, shorts, cascos
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.2, 0.4, 0); g.add(leg);
    mesh(new THREE.CapsuleGeometry(0.13, 0.2, 4, 12), skinM, leg, 0.012, true).position.y = -0.2;
    const hoof = mesh(new THREE.SphereGeometry(0.155, 16, 10), hoofM, leg, 0.012, true); hoof.position.set(0, -0.36, 0.04); hoof.scale.set(1, 0.6, 1.25);
    const cleft = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.1), dark); cleft.position.set(0, -0.36, 0.22); leg.add(cleft);
    legs.push(leg);
  }
  const shorts = mesh(roundedCyl(0.41, 0.24, 0.07), pantsM, g, 0.012, true); shorts.position.y = 0.47; shorts.scale.z = 0.85;
  // tronco/camiseta
  const torso = mesh(getTorsoGeo(), shirtM, g, 0.014, true); torso.scale.z = 0.85;
  const collar = mesh(new THREE.TorusGeometry(0.27, 0.045, 10, 32), trimM, g, 0.01); collar.rotation.x = Math.PI / 2; collar.position.y = 1.1; collar.scale.y = 0.85;
  // rabinho enrolado
  var tail = mesh(new THREE.TorusGeometry(0.08, 0.032, 8, 16, Math.PI * 1.7), skinM, g, 0.01); tail.position.set(0, 0.6, -0.44); tail.rotation.y = Math.PI / 2;

  // cabeça
  const head = new THREE.Group(); g.add(head);
  const skull = mesh(getHeadGeo(), faceM, head, 0.016, true); skull.scale.z = 1; // lathe já usa HEAD.zs abaixo
  skull.scale.set(1, 1, HEAD.zs);
  // tufinho no topo
  const tuft = [];
  [[-0.06, 0.45, 0.4], [0.02, 0.05, 0.5], [0.09, -0.4, 0.36]].forEach(([x, rz, h]) => {
    const c = mesh(new THREE.ConeGeometry(0.045, 0.16, 10), skinM, head, 0.008); c.position.set(x, HEAD.y1 - 0.03, 0.08); c.rotation.set(0.35, 0, rz); c.scale.y = h / 0.4; tuft.push(c);
  });
  // orelhas grandes e pontudas
  const earShape = new THREE.Shape(); earShape.moveTo(-0.17, 0); earShape.quadraticCurveTo(-0.2, 0.3, 0.03, 0.46); earShape.quadraticCurveTo(0.2, 0.26, 0.17, 0); earShape.quadraticCurveTo(0, -0.05, -0.17, 0);
  const earGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 16 });
  const inner = earShape.getPoints(24).map((p) => new V2(p.x * 0.62, p.y * 0.66 + 0.06));
  const innerGeo = new THREE.ShapeGeometry(new THREE.Shape(inner));
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ears.push(ear); ear.position.set(s * 0.33, 1.84, -0.03); ear.rotation.set(-0.12, s * 0.3, -s * 0.62); ear.scale.setScalar(1.08); head.add(ear);
    mesh(earGeo, skinM, ear, 0.012);
    const inn = new THREE.Mesh(innerGeo, earInM); inn.position.z = 0.07; ear.add(inn);
  }
  // focinho grande, oval e achatado na frente
  const snoutY = 1.47, snoutDepth = 0.22;
  const sp = headPoint(0, snoutY);
  const snout = mesh(roundedCyl(0.2, snoutDepth, 0.065), snoutM, head, 0.012);
  snout.rotation.x = Math.PI / 2 - 0.12; snout.scale.set(1.22, 1, 0.82); snout.position.set(0, snoutY, sp.z + snoutDepth / 2 - 0.08);
  const jaw = mesh(new THREE.BoxGeometry(0.34, 0.13, 0.18), snoutM, head, 0.008); // queixo quadrado, só aparece no Mewing
  jaw.position.set(0, snoutY - 0.22, sp.z + 0.06); jaw.visible = false;
  for (const s of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.CircleGeometry(0.042, 18), dark); n.scale.set(0.85, 1.35, 1);
    n.position.set(s * 0.085, snoutY + 0.01, sp.z + snoutDepth - 0.08 + 0.004); n.rotation.set(-0.12, 0, -s * 0.2); head.add(n);
  }
  // olhos grandes: branco + íris marrom + pupila + brilho; sobrancelhas grossas
  const eyes = [], brows = [];
  for (const s of [-1, 1]) {
    const th = s * 0.33, ey = 1.7; const n = headNormal(th, ey); const p = headPoint(th, ey, -0.02);
    const eye = new THREE.Group(); eye.position.copy(p); eye.lookAt(p.clone().add(n)); eye.userData.n = n; head.add(eye);
    const w = mesh(new THREE.SphereGeometry(0.135, 24, 16), white, eye, 0.012); w.scale.set(0.95, 1.2, 0.55);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), basic((skin.eyes && skin.eyes.iris) || PALETTE.iris)); iris.scale.set(1, 1.1, 0.4); iris.position.set(-s * 0.012, -0.01, 0.052); eye.add(iris);
    if (skin.eyes && skin.eyes.ring) { // anel mais escuro em volta da íris (opcional, por skin)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.012, 8, 28), basic(skin.eyes.ring)); ring.scale.set(1, 1.1, 0.4); ring.position.set(-s * 0.012, -0.01, 0.066); eye.add(ring);
    }
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), basic(PALETTE.pupil)); pup.scale.set(1, 1.08, 0.4); pup.position.set(-s * 0.012, -0.01, 0.068); eye.add(pup);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), white); hl.position.set(-s * 0.012 + 0.03, 0.025, 0.08); eye.add(hl);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), white); hl2.position.set(-s * 0.012 - 0.025, -0.04, 0.078); eye.add(hl2);
    eyes.push(eye);
    const bp = headPoint(s * 0.36, 1.95, 0.02), bn = headNormal(s * 0.36, 1.95);
    const brow = new THREE.Group(); brow.position.copy(bp); brow.lookAt(bp.clone().add(bn)); head.add(brow);
    const arc = 1.5; const b = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.032, 8, 20, arc), basic(PALETTE.brow));
    b.rotation.z = (Math.PI - arc) / 2 - s * 0.18; b.position.y = -0.1; b.scale.set(1, 0.8, 0.6); brow.add(b); brows.push(brow);
  }

  // braços: manga (cor da camiseta) + punho escuro + braço + mão-luva (punho fechado)
  const arms = [], fists = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.46, 1.0, 0); g.add(piv);
    if (sleeves === 'short') {
      const sl = mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.22, 18), sleeveM, piv, 0.012); sl.position.y = -0.06;
      const cuff = mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 20), trimM, piv, 0.008); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.17;
    } else {
      const puffy = sleeves === 'puffy'; const R = puffy ? 0.2 : 0.155;
      const sl = mesh(new THREE.CylinderGeometry(R, R * 0.9, 0.46, 18), sleeveM, piv, 0.012); sl.position.y = -0.2;
      if (puffy) for (const yy of [-0.08, -0.22, -0.36]) { const r = mesh(new THREE.TorusGeometry(R * 0.95, 0.05, 8, 20), sleeveM, piv, 0.008); r.rotation.x = Math.PI / 2; r.position.y = yy; }
      const cuff = mesh(new THREE.TorusGeometry(R * 0.85, 0.035, 8, 20), trimM, piv, 0.008); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.44;
    }
    mesh(new THREE.CapsuleGeometry(0.125, 0.28, 4, 12), skinM, piv, 0.012).position.y = -0.33;
    const fist = mesh(new THREE.SphereGeometry(0.155, 18, 14), skinM, piv, 0.012); fist.position.y = -0.57; fist.scale.set(1, 0.95, 1.05);
    const thumb = mesh(new THREE.CapsuleGeometry(0.04, 0.06, 4, 8), skinM, piv, 0.008); thumb.position.set(-s * 0.08, -0.5, 0.08); thumb.rotation.z = s * 0.6; if (s === -1) thumb.userData.isThumb = true;
    arms.push(piv); fists.push({ fist, thumb });
  }
  // dedo indicador da mão direita: só aparece no Mewing, arrastando a mandíbula
  const point = new THREE.Group(); point.visible = false; arms[0].add(point);
  mesh(new THREE.CapsuleGeometry(0.03, 0.13, 4, 8), skinM, point, 0.005).position.y = 0.095;
  const nail = mesh(new THREE.SphereGeometry(0.026, 8, 6), toon('#fff3dc'), point, 0); nail.scale.set(0.8, 0.45, 1); nail.position.y = 0.175;
  // armas em 3ª pessoa
  const guns = [];
  let backLid = null;
  if (withGun) {
    const r = new THREE.Group(); r.position.set(0.0, 0.9, 0.62); g.add(r); r.userData.rifleForward = 1;
    mesh(new THREE.BoxGeometry(0.11, 0.13, 0.62), toon('#3b3f4a'), r, 0.01).userData.gunPart = 'body';
    const mag = mesh(new THREE.BoxGeometry(0.07, 0.2, 0.1), toon('#e63946'), r, 0.01);
    mag.position.set(0, -0.13, 0.02); mag.userData.gunPart = 'mag';
    const br = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), toon('#222'), r, 0); br.position.set(0, 0.01, 0.42); br.rotation.x = Math.PI / 2;
    // Calibre 12 em 3ª pessoa: SPAS-12 (preta, protetor de calor furado, tubo, telha com sulcos, coronha dobrada por cima)
    const sg = new THREE.Group(); sg.position.copy(r.position); g.add(sg);
    const spM = toon('#2a2d33'), spD = toon('#1b1d22'), spP = toon('#202227'), spH = toon('#08090b');
    mesh(new THREE.BoxGeometry(0.11, 0.13, 0.32), spM, sg, 0.01).position.z = -0.04;
    const spG = mesh(new THREE.BoxGeometry(0.06, 0.15, 0.07), spP, sg, 0.008); spG.position.set(0, -0.12, -0.14); spG.rotation.x = 0.35;
    const spB = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.55, 10), toon('#3a3d44'), sg, 0.008); spB.rotation.x = Math.PI / 2; spB.position.set(0, 0.035, 0.38);
    const spS = mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.3, 12), spD, sg, 0.008); spS.rotation.x = Math.PI / 2; spS.position.set(0, 0.04, 0.3);
    for (const z of [0.2, 0.28, 0.36]) mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 8), spH, sg, 0).position.set(0, 0.077, z); // furos
    const spT = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.48, 10), spM, sg, 0.008); spT.rotation.x = Math.PI / 2; spT.position.set(0, -0.035, 0.36);
    mesh(new THREE.BoxGeometry(0.1, 0.085, 0.2), spP, sg, 0.008).position.set(0, -0.035, 0.32); // telha
    for (const z of [0.25, 0.3, 0.35, 0.4]) mesh(new THREE.BoxGeometry(0.104, 0.089, 0.012), spH, sg, 0).position.set(0, -0.035, z);
    for (const x of [-0.04, 0.04]) mesh(new THREE.BoxGeometry(0.01, 0.014, 0.4), spD, sg, 0.004).position.set(x, 0.09, 0); // coronha dobrada
    mesh(new THREE.BoxGeometry(0.09, 0.05, 0.02), spD, sg, 0.004).position.set(0, 0.075, 0.2);
    // sniper (cano longo + luneta)
    const sn = new THREE.Group(); sn.position.copy(r.position); sn.userData.kind = 'torresmo'; sn.userData.muzzle = 1; g.add(sn);
    const snBody = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.75), toon('#5c7a3a'), sn, 0.01); snBody.position.z = 0.02; snBody.userData.gunPart = 'body';
    const snb = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 8), toon('#22252c'), sn, 0.008); snb.position.set(0, 0.01, 0.62); snb.rotation.x = Math.PI / 2; snb.userData.gunPart = 'barrel';
    const sc = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 12), toon('#2a2d35'), sn, 0.008); sc.position.set(0, 0.12, 0.05); sc.rotation.x = Math.PI / 2; sc.userData.gunPart = 'scope';
    // bazuca no ombro (RPG: tubo longo, traseira alargada, grip) — continua sendo guns[3]
    const bz = new THREE.Group(); bz.position.set(0.55, 1.2, 0.02); bz.scale.setScalar(1.12); g.add(bz);
    const tube = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.55, 16), toon('#6b7a3a'), bz, 0.012); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.02, 0.32);
    const lip = mesh(new THREE.CylinderGeometry(0.135, 0.102, 0.09, 16), toon('#4a5528'), bz, 0.008); lip.rotation.x = Math.PI / 2; lip.position.set(0, 0.02, 1.12);
    const ring = mesh(new THREE.TorusGeometry(0.128, 0.02, 6, 16), toon('#f5e6d0'), bz, 0.006); ring.position.set(0, 0.02, 1.16);
    for (const z of [0.85, 0.15]) { const band = mesh(new THREE.CylinderGeometry(0.114, 0.114, 0.06, 16), toon('#e63946'), bz, 0.008); band.rotation.x = Math.PI / 2; band.position.set(0, 0.02, z); }
    const rear = mesh(new THREE.CylinderGeometry(0.102, 0.175, 0.32, 16), toon('#4a5528'), bz, 0.01); rear.rotation.x = Math.PI / 2; rear.position.set(0, 0.02, -0.615);
    const grip = mesh(new THREE.BoxGeometry(0.055, 0.2, 0.065), toon('#2c3038'), bz, 0.008); grip.position.set(0, -0.14, 0.02); grip.rotation.x = -0.5;
    const fg = mesh(new THREE.BoxGeometry(0.048, 0.14, 0.05), toon('#2c3038'), bz, 0.008); fg.position.set(0, -0.12, 0.48);
    const sf = mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), toon('#1a1c22'), bz, 0.004); sf.position.set(0, 0.14, 0.95);
    const sr = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.016), toon('#1a1c22'), bz, 0.004); sr.position.set(0, 0.15, 0.05);
    const og = mesh(new THREE.CylinderGeometry(0.055, 0.095, 0.22, 12), toon('#e63946'), bz, 0.008); og.rotation.x = Math.PI / 2; og.position.set(0, 0.02, 1.28);
    const bzNose = mesh(new THREE.SphereGeometry(0.055, 10, 8), toon('#F58A6E'), bz, 0.006); bzNose.position.set(0, 0.02, 1.42); bzNose.scale.set(1, 0.82, 0.7);
    // pistola
    const ps = new THREE.Group(); ps.position.set(0.0, 0.9, 0.55); g.add(ps);
    mesh(new THREE.BoxGeometry(0.07, 0.08, 0.26), toon('#ff9fb6'), ps, 0.01);
    mesh(new THREE.BoxGeometry(0.06, 0.15, 0.08), toon('#3b3f4a'), ps, 0.01).position.set(0, -0.1, -0.06);
    // faca de churrasqueiro na mão direita (filha do braço: acompanha o golpe)
    const kn = makeKnife(1.7, 0.006); kn.rotation.set(-Math.PI / 2, 0, 0); kn.position.set(0, -0.6, 0.02); arms[0].add(kn);
    // canhão e carabina ficam aqui (não vêm de sniper-view: aquele arquivo importa este)
    const cn = new THREE.Group(); cn.position.copy(r.position); g.add(cn);
    mesh(new THREE.BoxGeometry(0.16, 0.16, 0.95), toon('#1a1c22'), cn, 0.01).position.z = 0.08;
    const cnb = mesh(new THREE.CylinderGeometry(0.04, 0.044, 0.8, 10), toon('#111318'), cn, 0.008); cnb.position.set(0, 0.02, 0.92); cnb.rotation.x = Math.PI / 2;
    const cnm = mesh(new THREE.CylinderGeometry(0.08, 0.044, 0.14, 12), toon('#111318'), cn, 0.008); cnm.position.set(0, 0.02, 1.34); cnm.rotation.x = Math.PI / 2;
    const cns = mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.48, 12), toon('#2a2d35'), cn, 0.008); cns.position.set(0, 0.2, 0.12); cns.rotation.x = Math.PI / 2;
    const cnl = mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.045, 14), basic('#f0a020'), cn, 0); cnl.rotation.x = Math.PI / 2; cnl.position.set(0, 0.2, 0.38);
    const cb = new THREE.Group(); cb.position.copy(r.position); g.add(cb);
    mesh(new THREE.BoxGeometry(0.07, 0.08, 0.44), toon('#d7b07a'), cb, 0.01).position.z = -0.06;
    mesh(new THREE.BoxGeometry(0.062, 0.1, 0.18), toon('#c9956a'), cb, 0.008).position.set(0, -0.01, -0.28);
    const cbb = mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.36, 8), toon('#5c4a32'), cb, 0.008); cbb.position.set(0, 0.012, 0.34); cbb.rotation.x = Math.PI / 2;
    const cbs = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 10), toon('#2a2d35'), cb, 0.008); cbs.position.set(0, 0.078, -0.02); cbs.rotation.x = Math.PI / 2;
    const cbl = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), basic('#f4fbff'), cb, 0); cbl.rotation.x = Math.PI / 2; cbl.position.set(0, 0.078, 0.05);
    guns.push(r, sg, sn, bz, ps, cn, cb, kn);
    const hold = new THREE.Group(); hold.position.set(0, -0.64, 0.05); hold.rotation.set(-Math.PI / 2, 0.2, 0.05); arms[0].add(hold);
    const sb = makeWorldSaber(); hold.add(sb);
    hold.userData.blade = sb.userData.blade; hold.userData.glow = sb.userData.glow;
    guns.push(hold);
    const uz = new THREE.Group(); uz.position.copy(r.position); g.add(uz);
    mesh(new THREE.BoxGeometry(0.09, 0.11, 0.46), toon('#2a2d35'), uz, 0.008).position.z = 0.02;
    mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), toon('#3b3f4a'), uz, 0.006).position.set(0, -0.12, -0.02);
    const p9 = new THREE.Group(); p9.position.copy(r.position); g.add(p9);
    mesh(new THREE.BoxGeometry(0.11, 0.07, 0.52), toon('#4a5568'), p9, 0.008);
    mesh(new THREE.BoxGeometry(0.09, 0.07, 0.28), toon('#c9a36a'), p9, 0.006).position.y = 0.07;
    const nl = new THREE.Group(); nl.position.copy(ps.position); g.add(nl);
    mesh(new THREE.BoxGeometry(0.13, 0.11, 0.26), toon('#f0c14a'), nl, 0.008);
    const bit = mesh(new THREE.CylinderGeometry(0.02, 0.008, 0.26, 8), toon('#d0d4dc'), nl, 0.004); bit.rotation.x = Math.PI / 2; bit.position.z = 0.22;
    guns.push(uz, p9, nl);
    const sm = new THREE.Group(); sm.position.copy(r.position); g.add(sm);
    mesh(new THREE.BoxGeometry(0.12, 0.12, 0.44), toon('#2c3138'), sm, 0.008);
    mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), toon('#c45a3a'), sm, 0.006).position.set(0, -0.12, 0.02);
    const smb = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.4, 8), toon('#3a3e46'), sm, 0.006); smb.rotation.x = Math.PI / 2; smb.position.z = 0.34;
    guns.push(sm);
    const xb = new THREE.Group(); xb.name = 'besta'; xb.position.set(0.04, 0.98, 0.62); g.add(xb);
    mesh(new THREE.BoxGeometry(0.06, 0.045, 0.46), toon('#6b3f22'), xb, 0.008);
    mesh(new THREE.BoxGeometry(0.045, 0.1, 0.07), toon('#2a2d35'), xb, 0.006).position.set(0, -0.07, -0.14);
    const xl = mesh(new THREE.BoxGeometry(0.2, 0.025, 0.03), toon('#7a4a28'), xb, 0.005); xl.position.set(-0.1, 0.04, 0.16); xl.rotation.z = 0.6;
    const xr = mesh(new THREE.BoxGeometry(0.2, 0.025, 0.03), toon('#7a4a28'), xb, 0.005); xr.position.set(0.1, 0.04, 0.16); xr.rotation.z = -0.6;
    mesh(new THREE.BoxGeometry(0.24, 0.012, 0.012), toon('#f4efe4'), xb, 0.004).position.set(0, 0.03, 0.02);
    const xbolt = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), toon('#c4a574'), xb, 0.004); xbolt.rotation.x = Math.PI / 2; xbolt.position.z = 0.06;
    const bw = new THREE.Group(); bw.name = 'arco'; bw.position.set(-0.18, 1.12, 0.38); bw.rotation.z = 0.15; g.add(bw);
    mesh(new THREE.BoxGeometry(0.035, 0.62, 0.03), toon('#6b3f22'), bw, 0.008);
    mesh(new THREE.BoxGeometry(0.012, 0.52, 0.012), toon('#f4efe4'), bw, 0.004).position.z = 0.05;
    const arr = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 6), toon('#c4a574'), bw, 0.004); arr.rotation.x = Math.PI / 2; arr.position.set(0, 0.02, 0.18);
    guns.push(xb, bw);
    // FAMAS (bullpup): corpo comprido, alça de transporte em cima, pente atrás do cabo
    const fm = new THREE.Group(); fm.position.copy(r.position); g.add(fm);
    mesh(new THREE.BoxGeometry(0.1, 0.12, 0.66), toon('#4b5240'), fm, 0.01).position.z = 0.02;
    mesh(new THREE.BoxGeometry(0.03, 0.03, 0.4), toon('#2a2d35'), fm, 0.006).position.set(0, 0.13, 0.04);
    for (const z of [-0.14, 0.22]) mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), toon('#2a2d35'), fm, 0.004).position.set(0, 0.09, z);
    mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), toon('#2a2d35'), fm, 0.006).position.set(0, -0.12, 0.12);
    mesh(new THREE.BoxGeometry(0.06, 0.15, 0.08), toon('#e63946'), fm, 0.006).position.set(0, -0.13, -0.14);
    const fmb = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), toon('#22252c'), fm, 0.006); fmb.rotation.x = Math.PI / 2; fmb.position.set(0, 0.01, 0.45);
    guns.push(fm);
    // Disco Voador: lançador roxo com o disquinho em cima da boca
    const dk = new THREE.Group(); dk.position.copy(r.position); g.add(dk);
    mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), toon('#5b3fa0'), dk, 0.008).position.z = 0.02;
    const dkc = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.04, 16), toon('#2a2d35'), dk, 0.006); dkc.position.set(0, 0.07, 0.36);
    const dks = mesh(new THREE.SphereGeometry(0.15, 14, 8), toon('#c9d1d9'), dk, 0.006); dks.position.set(0, 0.11, 0.36); dks.scale.set(1, 0.26, 1);
    mesh(new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#7df9ff'), dk, 0.004).position.set(0, 0.12, 0.36);
    guns.push(dk);
    // Sabre Duplo: um em cada mão (o da esquerda é o twin; main.js liga/desliga os dois juntos)
    const dualHold = (arm, s) => { const h = new THREE.Group(); h.position.set(0, -0.64, 0.05); h.rotation.set(-Math.PI / 2, s * 0.2, s * 0.05); arm.add(h); const sb = makeWorldSaber(); h.add(sb); h.userData.blade = sb.userData.blade; h.userData.glow = sb.userData.glow; return h; };
    const d2r = dualHold(arms[0], 1), d2l = dualHold(arms[1], -1); d2r.userData.twin = d2l;
    guns.push(d2r);
    // Lança-Milho: tambor de pipoqueira vermelho/branco, cano curto com boca amarela e a espiga em cima
    const mh = new THREE.Group(); mh.position.copy(r.position); g.add(mh);
    const mhd = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 14), toon('#e63946'), mh, 0.008); mhd.rotation.x = Math.PI / 2;
    const mhs = mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.05, 14), toon('#f5f1e8'), mh, 0); mhs.rotation.x = Math.PI / 2; mhs.position.z = 0.04;
    const mhb = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 10), toon('#2a2d35'), mh, 0.006); mhb.rotation.x = Math.PI / 2; mhb.position.z = 0.3;
    mesh(new THREE.TorusGeometry(0.052, 0.012, 6, 14), toon('#ffd23f'), mh, 0).position.z = 0.42;
    mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.16, 8), toon('#f2c230'), mh, 0.005).position.set(0, 0.17, 0);
    guns.push(mh); // 18 = Lança-Milho
    // Estilingue de Ovo: forquilha de madeira, elástico vermelho e o ovinho puxado pra trás
    const es = new THREE.Group(); es.name = 'estilingue'; es.position.set(0.04, 1.0, 0.6); g.add(es);
    mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.14, 8), toon('#8b5a2b'), es, 0.006);
    for (const s of [-1, 1]) { const f = mesh(new THREE.BoxGeometry(0.025, 0.12, 0.025), toon('#8b5a2b'), es, 0.005); f.position.set(s * 0.05, 0.11, 0); f.rotation.z = -s * 0.45; }
    mesh(new THREE.BoxGeometry(0.12, 0.012, 0.012), toon('#e63946'), es, 0.004).position.set(0, 0.17, -0.04);
    const eo = mesh(new THREE.SphereGeometry(0.04, 10, 8), toon('#fff3dc'), es, 0.004); eo.scale.set(1, 1.3, 1); eo.position.set(0, 0.17, -0.07);
    guns.push(es); // 19 = Estilingue de Ovo
    // Minigun: carcaça, 6 canos num grupo que gira (main.js gira por userData.barrels), caixa de munição à esquerda
    const mg = new THREE.Group(); mg.position.copy(r.position); mg.position.y -= 0.08; g.add(mg);
    mesh(new THREE.BoxGeometry(0.15, 0.16, 0.42), toon('#3a3f4a'), mg, 0.01).position.z = 0.0;
    mesh(new THREE.BoxGeometry(0.155, 0.04, 0.1), toon('#e63946'), mg, 0.006).position.set(0, 0.09, 0.05);
    const mgb = new THREE.Group(); mgb.position.set(0, 0, 0.42); mg.add(mgb);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.46, 8), toon('#22252c'), mgb, 0.005); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0); }
    mesh(new THREE.TorusGeometry(0.062, 0.012, 6, 16), toon('#1a1c22'), mgb, 0.004).position.z = 0.2;
    mesh(new THREE.BoxGeometry(0.12, 0.15, 0.2), toon('#5c6b3a'), mg, 0.006).position.set(-0.14, -0.07, -0.04);
    mesh(new THREE.BoxGeometry(0.05, 0.1, 0.03), toon('#2a2d35'), mg, 0.004).position.set(0, 0.14, -0.02); // alça
    mg.userData.barrels = mgb; guns.push(mg); // 20 = Minigun
    const lm = new THREE.Group(); lm.name = 'lmg'; lm.position.copy(r.position); g.add(lm);
    mesh(new THREE.BoxGeometry(0.12, 0.14, 0.72), toon('#3a4034'), lm, 0.01).position.z = 0.04;
    const lmb = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.4, 8), toon('#22252c'), lm, 0.006); lmb.rotation.x = Math.PI / 2; lmb.position.set(0, 0.02, 0.52);
    mesh(new THREE.BoxGeometry(0.1, 0.16, 0.14), toon('#5c6b3a'), lm, 0.006).position.set(-0.12, -0.06, 0.02);
    mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), toon('#2a2d35'), lm, 0.006).position.set(0, -0.12, 0.1);
    guns.push(lm); // 21 = Metralhadora do Chiqueiro
    const cd = new THREE.Group(); cd.name = 'commando'; cd.position.copy(r.position); g.add(cd);
    mesh(new THREE.BoxGeometry(0.07, 0.08, 0.7), toon('#3a4038'), cd, 0.008).position.z = 0.02;
    const cdb = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 8), toon('#22252c'), cd, 0.005); cdb.rotation.x = Math.PI / 2; cdb.position.set(0, 0.015, 0.56);
    mesh(new THREE.BoxGeometry(0.06, 0.08, 0.22), toon('#5c4632'), cd, 0.006).position.set(0, -0.01, -0.32);
    mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), toon('#2a2d35'), cd, 0.005).position.set(0, -0.1, 0.02);
    guns.push(cd); // 22 = Commando da Granja
    const worldRev = (side) => {
      const gun = new THREE.Group(); gun.name = side < 0 ? 'capataz-l' : 'capataz';
      const grip = mesh(new THREE.BoxGeometry(0.05, 0.13, 0.05), toon('#6b3a1e'), gun, 0.006);
      grip.position.set(0, -0.07, 0.03); grip.rotation.x = 0.45; grip.userData.noCamo = true;
      mesh(new THREE.BoxGeometry(0.06, 0.07, 0.12), toon('#3c414c'), gun, 0.006);
      const hinge = new THREE.Group(); hinge.position.set(side * 0.02, 0.015, -0.01); gun.add(hinge);
      const cyl = new THREE.Group(); hinge.add(cyl);
      const drum = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 10), toon('#d9a441'), cyl, 0.004);
      drum.rotation.x = Math.PI / 2; drum.userData.noCamo = true;
      const barrel = mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.22, 8), toon('#2a2e36'), gun, 0.005);
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, 0.16);
      mesh(new THREE.BoxGeometry(0.012, 0.04, 0.016), toon('#14171c'), gun, 0.003).position.set(0, 0.05, -0.02);
      gun.userData.cyl = cyl; gun.userData.hinge = hinge; gun.userData.side = side;
      gun.scale.setScalar(1.65); // na mão do boneco o tambor precisa ler de longe
      return gun;
    };
    const rv = worldRev(1); rv.position.set(0, -0.52, 0.05); rv.rotation.set(-Math.PI / 2, 0.18, 0.08); arms[0].add(rv); guns.push(rv); // 23 = Revólver do Capataz
    const rv2 = new THREE.Group(); rv2.name = 'capataz2'; g.add(rv2);
    const rvR = worldRev(1); rvR.position.set(0, -0.52, 0.05); rvR.rotation.set(-Math.PI / 2, 0.28, 0.12); arms[0].add(rvR);
    const rvL = worldRev(-1); rvL.position.set(0, -0.52, 0.05); rvL.rotation.set(-Math.PI / 2, -0.28, -0.12); arms[1].add(rvL);
    rv2.userData.extra = rvR; rv2.userData.twin = rvL; guns.push(rv2); // 24 = Dois Capatazes
    const tp = makeWorldShield(); tp.name = 'tampa'; tp.position.set(0, 0.98, 0.62); g.add(tp); guns.push(tp); // 25 = Tampa do Tacho
    const goldKnife = makeKnife(1.7, 0.006, true); goldKnife.position.copy(kn.position); goldKnife.rotation.copy(kn.rotation); goldKnife.visible = false; arms[0].add(goldKnife); guns.push(goldKnife); // 26 = Faca Dourada
    const ry = new THREE.Group(); ry.name = 'ray'; ry.position.copy(r.position); g.add(ry);
    mesh(new THREE.BoxGeometry(0.09, 0.1, 0.26), toon('#24302a'), ry, 0.008);
    mesh(new THREE.BoxGeometry(0.1, 0.035, 0.1), toon('#c45a2a'), ry, 0.004).position.set(0, 0.04, 0.02);
    mesh(new THREE.SphereGeometry(0.055, 12, 8), toon('#141a16'), ry, 0.005).position.set(0, 0.01, 0.08);
    const ryCore = mesh(new THREE.SphereGeometry(0.032, 10, 8), new THREE.MeshBasicMaterial({ color: 0x39ff6a }), ry, 0); ryCore.position.set(0, 0.01, 0.08);
    const ryb = mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 8), toon('#1a1c22'), ry, 0.004); ryb.rotation.x = Math.PI / 2; ryb.position.set(0, 0.01, 0.22);
    const ryd = mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 12), new THREE.MeshBasicMaterial({ color: 0x7dff6a }), ry, 0); ryd.position.set(0, 0.01, 0.3);
    mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), toon('#141a16'), ry, 0.004).position.set(0, -0.08, -0.04);
    ry.visible = false; guns.push(ry); // 27 = Ray Gun
    const sk = new THREE.Group(); sk.name = 'saco'; sk.position.copy(r.position); sk.position.y -= 0.04; g.add(sk);
    // saco vermelho com corda dourada (mesmo desenho do Papai Noel, em menor escala na mão)
    const sackM = toon('#8a2a1a'), cordM = toon('#d4a82a');
    const sackPts = [[0.01, -0.22], [0.16, -0.2], [0.22, -0.08], [0.2, 0.05], [0.15, 0.16], [0.08, 0.24], [0.06, 0.27]].map(([r, y]) => new THREE.Vector2(r, y));
    mesh(new THREE.LatheGeometry(sackPts, 16), sackM, sk, 0.008);
    mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.07, 10), sackM, sk, 0.005).position.y = 0.3;
    const tie = mesh(new THREE.TorusGeometry(0.062, 0.014, 6, 12), cordM, sk, 0.003); tie.rotation.x = Math.PI / 2; tie.position.y = 0.33;
    const box = mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1), toon('#2b8fd8'), sk, 0.004); box.position.set(-0.03, 0.4, 0.02); box.rotation.set(0.15, 0.3, 0.1);
    mesh(new THREE.BoxGeometry(0.11, 0.02, 0.11), toon('#f2c94c'), sk, 0).position.copy(box.position).add(new THREE.Vector3(0, 0.015, 0));
    sk.rotation.x = 0.35; sk.visible = false; guns.push(sk); // 28 = Saco de Presentes
    backLid = makeWorldShield(); backLid.name = 'tampa-costas'; backLid.position.set(0, 1.15, -0.32); backLid.rotation.y = Math.PI; backLid.visible = false; g.add(backLid);
    for (const o of [sg, sn, bz, ps, cn, cb, kn, hold, uz, p9, nl, sm, xb, bw, fm, dk, d2r, d2l, mh, es, mg, lm, cd, rv, rv2, rvR, rvL, tp, sk]) o.visible = false;
  }
  setPose({ arms }, pose);

  // peças da skin
  const rig = { group: g, head, eyes, brows, torso, legs, arms, fists, tail, tuft, ears, skin, skinM };
  for (const part of skin.parts || []) {
    const b = PARTS[part.type]; if (!b) { console.warn('Peça de skin desconhecida:', part.type); continue; }
    const obj = b(part, rig); if (!obj) continue;
    (obj.userData.anchor === 'head' || ['cap', 'glasses', 'sunglasses', 'headphones'].includes(part.type) ? head : g).add(obj);
  }
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline && o.parent === g) o.castShadow = true; });
  for (const b of brows) b.userData.base = { p: b.position.clone(), q: b.quaternion.clone() };
  const face = { eyes, brows, faceM, tex: [tone, beard, facePaint], neutralMap: faceM.map, angryMap: null, t: 0, target: 0, hold: 0 };
  return { group: g, legs, arms, guns, head, snout, jaw, point, skin, face, backLid, flashMats: [skinM, faceM, shirtM, snoutM] };
}

// Pose cartunesca: abaixa o corpo e dobra as pernas, mantendo os cascos no chão.
// amount é a mesma transição usada pelas hitboxes, inclusive no multiplayer.
export function setCrouchPose(model, amount) {
  const c = crouchAmount(amount), bend = c * 0.7;
  model.group.scale.y = stanceScale(c);
  model.legs.forEach((leg, i) => {
    leg.rotation.x += bend;
    leg.rotation.z = (i === 0 ? -1 : 1) * c * 0.12;
    leg.position.y = 0.4 + 0.36 * (Math.cos(bend) - 1) + 0.04 * Math.sin(bend);
  });
}

export function sleeveColor(shirt) { return shirt.sleeveColor || (shirt.pattern ? shirt.pattern.colors[0] : (shirt.color || '#d8261c')); }
// material de luva (branca com brilho) usado por PARTS.glove e pelos braços em 1ª pessoa
let rainbowGloveMap = null;
function rainbowGloveTex() {
  if (rainbowGloveMap) return rainbowGloveMap;
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const x = c.getContext('2d');
  for (let i = 0; i < 64; i++) { x.fillStyle = `hsl(${Math.round((i / 64) * 300)} 85% 54%)`; x.fillRect(i, 0, 1, 8); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  rainbowGloveMap = tex; return tex;
}
export function gloveMat(color = '#ffffff', opt = {}) {
  if (opt && opt.rainbow) return toonWarm('#ffffff', 0.1, { map: rainbowGloveTex() }, '#ffffff');
  if (opt && opt.gold) return toonWarm(opt.color || color || '#f3d78a', 0.32, {}, '#fff1a8');
  return toonWarm(color, 0.18, {}, (opt && opt.warm) || '#c8d8ff');
}
export function gloveSparkles(mesh, glove, r = 0.158) {
  if (!mesh || !glove) return;
  if (glove.rainbow) { for (const col of ['#ff4d4d', '#ffd24a', '#3dff7a', '#4db4ff', '#d06bff']) addSparkles(mesh, 3, r, col); return; }
  if (glove.gold) { addSparkles(mesh, 14, r, '#fff1a8'); return; }
  if (glove.sparkle !== false) addSparkles(mesh, 14, r);
}
export function addSparkles(mesh, n = 10, r = 0.16, color = '#e8f4ff') {
  const m = basic(color);
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.018 + Math.random() * 0.012, 0), m);
    const v = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(r);
    sp.position.copy(v); sp.rotation.set(Math.random() * 3, Math.random() * 3, 0); mesh.add(sp);
  }
}

// Deitado para a frente, ao longo da mira, com o tronco apoiado no chão.
// YXZ fica fixo enquanto cai: trocar a ordem do Euler a cada quadro derrubava o WebGL.
// blend 0 = em pé, 1 = caído. O caller já pôs yaw e a posição nos pés.
export function setDownPose(model, blend) {
  const k = Math.max(0, Math.min(1, Number(blend) || 0));
  const yaw = model.group.rotation.y;
  const lie = k * (Math.PI / 2);
  model.group.rotation.order = 'YXZ';
  model.group.rotation.set(lie, yaw, 0);
  model.group.position.y += Math.sin(lie) * 0.36;
  if (model.arms && model.arms[0]) {
    model.arms[0].rotation.set(-0.4, 0.15, -0.2);
    if (model.arms[1]) model.arms[1].rotation.set(-0.25, -0.1, 0.35);
  }
  if (model.legs && model.legs[0]) {
    model.legs[0].rotation.set(0.15 * k, 0, 0.05 * k);
    if (model.legs[1]) model.legs[1].rotation.set(0.08 * k, 0, -0.04 * k);
  }
}

export function setPose(model, pose) {
  model.arms.forEach((a, i) => {
    const s = i === 0 ? -1 : 1;
    if (pose === 'gun') a.rotation.set(-1.32, -s * 0.5, s * 0.12);
    else if (pose === 'reload') a.rotation.set(-0.8, -s * 0.4, s * 0.1);
    else if (pose === 'knife') { if (i === 0) a.rotation.set(-1.05, 0.25, -0.1); else a.rotation.set(-0.35, -0.15, 0.28); } // faca na direita, esquerda solta
    else if (pose === 'saber2') { if (i === 0) a.rotation.set(-1.25, 0.15, -0.4); else a.rotation.set(-1.25, -0.15, 0.4); } // um sabre em cada mão, abertos
    else if (pose === 'revolver2') { if (i === 0) a.rotation.set(-1.2, 0.42, -0.45); else a.rotation.set(-1.2, -0.42, 0.45); } // um revólver em cada casco
    else if (pose === 'revolver') { if (i === 0) a.rotation.set(-1.25, 0.28, -0.2); else a.rotation.set(-0.35, -0.15, 0.25); } // direita no cabo, esquerda solta
    else if (pose === 'saber') { if (i === 0) a.rotation.set(-1.15, 0.42, -0.08); else a.rotation.set(-1.05, -0.55, 0.28); } // as duas mãos juntas no cabo
    else if (pose === 'shield') { if (i === 0) a.rotation.set(-0.9, 0.35, -0.2); else a.rotation.set(-1.45, -0.25, 0.15); } // esquerda segura a tampa na frente
    else if (pose === 'wave') a.rotation.set(s > 0 ? 0 : 0.1, 0, s > 0 ? 2.5 : -0.25);
    else a.rotation.set(0.05, 0, s * 0.22); // idle
  });
}

// ---------- braços em 1ª pessoa (manga + punho + mão-luva) ----------
export function makeFPArms(skinOrId, pose = 'rifle') {
  const skin = typeof skinOrId === 'string' ? getSkin(skinOrId) : skinOrId;
  const shirt = skin.shirt || {}; const tone = safeTone(skin.body && skin.body.tone);
  const skinM = toonWarm(tone, 0.42, {}, '#e0500a'), sleeveM = toonWarm(sleeveColor(shirt), 0.12), trimM = toon(shirt.trim || '#1d1410');
  const sleeves = shirt.sleeves || 'short', long = sleeves !== 'short', puffy = sleeves === 'puffy';
  const glove = (skin.parts || []).find((p) => p.type === 'glove'); let limbIdx = 0;
  const wraps = (skin.parts || []).find((p) => p.type === 'armWraps'), bones = (skin.parts || []).find((p) => p.type === 'boneLimbs'); const sStripes = (skin.parts || []).find((p) => p.type === 'sleeveStripes');
  const webs = (skin.parts || []).find((p) => p.type === 'webLimbs'), fur = (skin.parts || []).find((p) => p.type === 'furTrim');
  const g = new THREE.Group();
  function limb(a, b, r) {
    const limbG = new THREE.Group(); g.add(limbG);
    const addL = (geo, mat, th = 0.008) => { const m = new THREE.Mesh(geo, mat); limbG.add(m); outline(m, th); return m; };
    const dir = b.clone().sub(a); const len = dir.length(); dir.normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir);
    const arm = addL(new THREE.CylinderGeometry(r, r * 1.12, len, 16), skinM); arm.position.copy(a).add(b).multiplyScalar(0.5); arm.quaternion.copy(q);
    const sk = long ? 0.86 : 0.6, sr = puffy ? 2.1 : 1.6;
    const sl = addL(new THREE.CylinderGeometry(r * sr, r * sr, len * sk, 16), sleeveM); sl.position.copy(a).addScaledVector(dir, len * sk / 2); sl.quaternion.copy(q);
    if (puffy) for (const f of [0.25, 0.5, 0.72]) { const pr = addL(new THREE.TorusGeometry(r * sr * 0.97, r * 0.45, 8, 20), sleeveM, 0.005); pr.position.copy(a).addScaledVector(dir, len * f); pr.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2)); }
    const cf = addL(new THREE.TorusGeometry(r * (sr - 0.05), r * 0.3, 8, 20), trimM, 0.006); cf.position.copy(a).addScaledVector(dir, len * sk); cf.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2));
    if (wraps) for (const f of wraps.fp || [0.3, 0.5, 0.7]) { const wr = addL(new THREE.TorusGeometry(r * sr * 1.02, r * 0.28, 8, 20), toon(wraps.color || '#6b4a2b'), 0.005); wr.position.copy(a).addScaledVector(dir, len * f * sk); wr.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2)); }
    if (sStripes) for (const f of [0.15, 0.4, 0.65]) { const st = addL(new THREE.TorusGeometry(r * sr * 1.02, r * 0.16, 6, 20), toon(sStripes.color || '#1fb89a'), 0); st.position.copy(a).addScaledVector(dir, len * f * sk); st.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + 0.45, 0, 0))); }
    if (bones) { // osso pintado em cima da manga
      const up = new V3(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y)).normalize();
      const bm = basic(bones.color || '#f7f7f2'), p0 = a.clone().addScaledVector(dir, len * 0.12 * sk).addScaledVector(up, r * sr * 0.92), p1 = a.clone().addScaledVector(dir, len * 0.9 * sk).addScaledVector(up, r * sr * 0.92);
      const shaft = addL(new THREE.CapsuleGeometry(r * 0.28, p0.distanceTo(p1), 4, 8), bm, 0.004); shaft.position.copy(p0).add(p1).multiplyScalar(0.5); shaft.quaternion.copy(q);
      for (const pp of [p0, p1]) for (const k of [-1, 1]) { const kn = addL(new THREE.SphereGeometry(r * 0.38, 10, 8), bm, 0.004); kn.position.copy(pp).addScaledVector(new V3().crossVectors(dir, up).normalize(), k * r * 0.3); }
    }
    if (webs) for (const f of [0.2, 0.45, 0.7]) { const wr = addL(new THREE.TorusGeometry(r * sr * 1.02, r * 0.08, 6, 20), basic(webs.color || '#111114'), 0); wr.position.copy(a).addScaledVector(dir, len * f * sk); wr.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2)); }
    if (fur) { const ff = addL(new THREE.TorusGeometry(r * sr * 1.05, r * 0.42, 8, 16), toonWarm(fur.color || '#f4f4f4', 0.2), 0.005); ff.position.copy(a).addScaledVector(dir, len * sk); ff.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2)); }
    const hand = limbIdx++ === 0 ? 'right' : 'left';
    const gl = glove && (glove.hand === 'both' || (glove.hand || 'right') === hand); const handM = gl ? gloveMat(glove.color, glove) : skinM;
    const fist = addL(new THREE.SphereGeometry(r * 1.45, 18, 14), handM); fist.position.copy(b).addScaledVector(dir, r * 0.6); fist.scale.set(1, 0.9, 1.1);
    if (gl) gloveSparkles(fist, glove, r * 1.45);
    const th = addL(new THREE.CapsuleGeometry(r * 0.42, r * 0.6, 4, 8), handM, 0.005); th.position.copy(fist.position).add(new V3(-0.03, 0.05, -0.04)); th.rotation.set(0.4, 0, 0.9);
    return limbG;
  }
  const grip = limb(pose === 'knife' ? new V3(0.22, -0.55, 0.45) : pose === 'pistol' ? new V3(0.14, -0.55, 0.5) : new V3(0.14, -0.5, 0.45), pose === 'knife' ? new V3(0.02, -0.12, 0.06) : pose === 'pistol' ? new V3(0.0, -0.15, 0.02) : new V3(0.0, -0.13, 0.13), 0.07);
  let support = null;
  if (pose === 'pistol') support = limb(new V3(-0.4, -0.6, 0.35), new V3(-0.07, -0.19, 0.0), 0.07);
  else if (pose !== 'knife') support = limb(new V3(-0.45, -0.52, 0.25), new V3(-0.04, -0.1, -0.3), 0.07);
  g.userData.grip = grip; g.userData.support = support;
  return g;
}

// Antebraço + casco que segura o pump da Calibre 12. O ombro fica parado; o casco vai na telha.
const _foreDir = new V3(), _foreQ = new THREE.Quaternion(), _FORE_UP = new V3(0, 1, 0);
export function makeFPForearm(skinOrId) {
  const skin = typeof skinOrId === 'string' ? getSkin(skinOrId) : skinOrId;
  const shirt = skin.shirt || {};
  const tone = safeTone(skin.body && skin.body.tone);
  const skinM = toonWarm(tone, 0.42, {}, '#e0500a'), sleeveM = toonWarm(sleeveColor(shirt), 0.12);
  const glove = (skin.parts || []).find((p) => p.type === 'glove');
  const handM = glove && (glove.hand === 'both' || glove.hand === 'left' || !glove.hand) ? gloveMat(glove.color, glove) : skinM;
  const g = new THREE.Group();
  const armLen = 0.52;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.052, armLen, 14), skinM); outline(arm, 0.006); g.add(arm);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.088, armLen * 0.42, 14), sleeveM); sleeve.position.y = armLen * 0.2; outline(sleeve, 0.005); arm.add(sleeve);
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), handM); fist.scale.set(1.2, 0.82, 1.05); outline(fist, 0.007); g.add(fist);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.05, 4, 8), handM); thumb.position.set(0.05, 0.04, 0.02); thumb.rotation.set(0.7, 0, 0.8); outline(thumb, 0.004); g.add(thumb);
  if (glove && handM !== skinM) gloveSparkles(fist, glove, 0.1);
  g.userData.arm = arm; g.userData.armLen = armLen; g.userData.handR = 0.1;
  return g;
}
export function poseFPForearm(hand, shoulder) {
  const arm = hand.userData.arm; if (!arm) return;
  _foreDir.copy(shoulder).sub(hand.position);
  const len = _foreDir.length(); if (len < 1e-4) return;
  _foreDir.multiplyScalar(1 / len);
  const reach = Math.max(0.2, len - hand.userData.handR * 0.65);
  if (_foreDir.dot(_FORE_UP) > 0.999) _foreQ.identity(); else _foreQ.setFromUnitVectors(_FORE_UP, _foreDir);
  arm.quaternion.copy(_foreQ);
  arm.position.copy(_foreDir).multiplyScalar(hand.userData.handR * 0.3 + reach * 0.5);
  arm.scale.set(1, reach / hand.userData.armLen, 1);
}

// ---------- Copo Bomba: copo de festa vermelho com logo C! ----------
const CUP_H = 0.31;
function cupR(y) {
  const t = y / CUP_H; const ridge = (c) => 0.006 * Math.exp(-Math.pow((y - c) / 0.007, 2));
  return 0.096 + 0.044 * t + ridge(0.085) + ridge(0.205) + (y > CUP_H - 0.012 ? 0.004 : 0);
}
let cupTex = null;
function getCupTex() {
  if (cupTex) return cupTex;
  cupTex = canvasTex(512, 256, (x, W, H) => {
    const gr = x.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#a5121a'); gr.addColorStop(0.5, '#e0232b'); gr.addColorStop(1, '#a5121a');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (const y of [0.085, 0.205]) { const py = (1 - y / CUP_H) * H; x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, py + 2, W, 3); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, py - 3, W, 3); }
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, 6);
    const cy = (1 - 0.148 / CUP_H) * H; x.save(); x.translate(W / 2, cy); x.scale(0.82, 1); x.translate(-W / 2, -cy);
    drawLogo(x, W / 2, cy, 78, '#f5e6d0'); x.restore();
  });
  return cupTex;
}
export function makeCup(scale = 1) {
  const g = new THREE.Group();
  const outer = [], inner = [];
  for (let i = 0; i <= 40; i++) { const y = CUP_H * i / 40; outer.push(new V2(cupR(y), y)); }
  for (let i = 0; i <= 20; i++) { const y = 0.02 + (CUP_H - 0.02) * i / 20; inner.push(new V2(cupR(y) - 0.006, y)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(outer, 40, Math.PI, TAU), toonWarm('#ffffff', 0.18, { map: getCupTex(), emissiveMap: getCupTex() }));
  outline(body, 0.008); body.castShadow = true; g.add(body);
  const ins = new THREE.Mesh(new THREE.LatheGeometry(inner, 40), toon('#f7f4ee', { side: THREE.BackSide })); g.add(ins);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(cupR(0.02) - 0.006, 32), toon('#f7f4ee')); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.021; g.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(cupR(CUP_H), 0.008, 8, 40), toon('#ffffff')); rim.rotation.x = Math.PI / 2; rim.position.y = CUP_H; g.add(rim);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.096, 32), toon('#a5121a')); bottom.rotation.x = Math.PI / 2; g.add(bottom);
  g.scale.setScalar(scale); return g;
}

// ---------- foguete da Bazuca do Chiqueiro: corpo vermelho com faixa "C!", ponta de focinho de porquinho ----------
let rocketTex = null;
export function makeRocket(scale = 1) {
  if (!rocketTex) rocketTex = canvasTex(256, 128, (x, W, H) => {
    x.fillStyle = '#e63946'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#f5e6d0'; x.fillRect(0, H * 0.3, W, H * 0.4);
    for (const cx of [W * 0.25, W * 0.75]) drawLogo(x, cx, H / 2, H * 0.34, '#e63946');
  });
  const root = new THREE.Group(); const g = new THREE.Group(); root.add(g); // filho gira em torno do eixo
  const m = (geo, mat, th = 0.006) => { const o = new THREE.Mesh(geo, mat); g.add(o); if (th) outline(o, th); return o; };
  const body = m(new THREE.CylinderGeometry(0.065, 0.065, 0.36, 16), toon('#ffffff', { map: rocketTex })); body.rotation.x = Math.PI / 2;
  const cone = m(new THREE.CylinderGeometry(0.075, 0.065, 0.1, 16), toon('#F7A531')); cone.rotation.x = Math.PI / 2; cone.position.z = 0.23; // cabeça (amarelo-laranja)
  const snout = m(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 18), toon('#F58A6E')); snout.rotation.x = Math.PI / 2; snout.position.z = 0.3; // focinho
  for (const sx of [-1, 1]) { const n = m(new THREE.SphereGeometry(0.014, 8, 6), basic('#5a1e12'), 0); n.position.set(sx * 0.022, 0, 0.332); n.scale.z = 0.4; }
  for (let i = 0; i < 4; i++) { const f = m(new THREE.BoxGeometry(0.012, 0.09, 0.09), toon('#7DF9FF'), 0.004); const a = i * Math.PI / 2; f.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, -0.15); f.rotation.z = a + Math.PI / 2; }
  const back = m(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 14), toon('#3b3f4a')); back.rotation.x = Math.PI / 2; back.position.z = -0.2;
  root.scale.setScalar(scale); return root;
}

// ---------- Facas ----------
// Origem = centro da empunhadura; lâmina aponta pra -z, fio pra -y, espessura em x. Usada em 1ª e 3ª pessoa.
// kind: chef (churrasqueiro), skeleton, karambit, bayonet.
// finish: factory, rusty, rainbow, sapphire, emerald, ruby, camo, obsidian. O churrasqueiro não tem pintura.
let knifeLogoTex = null;
const KNIFE_FINISH = {
  factory: { steel: '#d5dde6', warm: '#f4f8ff', metal: '#8d939c', dark: '#1a1c20', edge: '#ffffff', fuller: '#8aa0b4' },
  rusty: { steel: '#8a4a28', warm: '#e08a40', metal: '#6a3a22', dark: '#2a1810', edge: '#e2b56a', fuller: '#5c3018', rust: true },
  rainbow: { steel: '#f4f4f8', warm: '#ffffff', metal: '#d8d8e4', dark: '#1a1c20', edge: '#ffffff', fuller: '#ffffff', rainbow: true },
  sapphire: { steel: '#1d4ed8', warm: '#9ec5ff', metal: '#12358f', dark: '#0a1020', edge: '#e7f1ff', fuller: '#16367a' },
  emerald: { steel: '#0f9d58', warm: '#8dffc0', metal: '#0b6b3a', dark: '#07140e', edge: '#e9fff0', fuller: '#0d5a32' },
  ruby: { steel: '#d0123a', warm: '#ff9aaf', metal: '#8a142c', dark: '#1a0a0e', edge: '#ffe8ee', fuller: '#7a1830' },
  camo: { steel: '#4a5c32', warm: '#8aa05a', metal: '#2c3a20', dark: '#141c10', edge: '#d5ddc4', fuller: '#3d4a28', camo: true },
  obsidian: { steel: '#16161c', warm: '#b388ff', metal: '#2a1840', dark: '#0c0c10', edge: '#e6d4ff', fuller: '#3a2158', obsidian: true },
};
function tintVerts(mesh, fn) {
  const geo = mesh.geometry; if (!geo || !geo.attributes.position) return;
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { fn(c, pos.getX(i), pos.getY(i), pos.getZ(i)); colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  mesh.material.vertexColors = true; mesh.material.needsUpdate = true;
}
function knifePal(finish) {
  const f = KNIFE_FINISH[finish] || KNIFE_FINISH.factory;
  const dress = (mesh) => {
    if (!mesh) return mesh;
    if (f.rainbow) {
      const geo = mesh.geometry; geo.computeBoundingBox(); const bb = geo.boundingBox;
      const dx = bb.max.x - bb.min.x, dy = bb.max.y - bb.min.y, dz = bb.max.z - bb.min.z;
      const axis = dx >= dy && dx >= dz ? 'x' : dy >= dz ? 'y' : 'z';
      const min = bb.min[axis], span = Math.max(1e-4, bb.max[axis] - min);
      tintVerts(mesh, (c, x, y, z) => { const p = axis === 'x' ? x : axis === 'y' ? y : z; c.setHSL((((p - min) / span) % 1) * 0.92, 0.88, 0.52); });
    } else if (f.rust) {
      tintVerts(mesh, (c, x, y, z) => {
        const n = Math.sin(x * 90 + z * 40) * Math.cos(y * 70 + z * 25);
        c.set(n > 0.35 ? '#d4783a' : n > -0.15 ? '#8d4b28' : '#3e2416');
      });
    } else if (f.camo) {
      tintVerts(mesh, (c, x, y, z) => {
        const n = Math.sin(x * 46 + z * 18) + Math.cos(y * 28 + x * 12);
        c.set(n > 0.6 ? '#6d8348' : n > -0.2 ? '#3d5228' : '#1c2814');
      });
    } else if (f.obsidian) {
      tintVerts(mesh, (c, x, y, z) => {
        const n = Math.sin(x * 80 + z * 30) + Math.cos(y * 50);
        c.set(n > 0.7 ? '#c9a6ff' : n > 0.05 ? '#3a2158' : '#121216');
      });
    }
    return mesh;
  };
  return {
    steel: () => toonWarm(f.steel, 0.14, {}, f.warm),
    metal: () => toon(f.metal),
    dark: () => toon(f.dark),
    edge: () => basic(f.edge),
    fuller: () => toon(f.fuller),
    dress,
  };
}
function knifeShape(g, th, shape, mat, pos, segs = 8) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0012, bevelSegments: 1, curveSegments: segs });
  geo.translate(0, 0, -0.004); geo.rotateY(Math.PI / 2); // +x do perfil vira -z
  const o = new THREE.Mesh(geo, mat); o.position.copy(pos); g.add(o); if (th) outline(o, th); return o;
}
function fillChef(g, th, golden = false) {
  if (!knifeLogoTex) knifeLogoTex = canvasTex(128, 64, (x, W, H) => {
    x.fillStyle = '#f5e6d0'; x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, 16); x.fill();
    drawLogo(x, W / 2, H / 2, H * 0.62, '#e63946');
  });
  const m = (geo, mat, t = th) => { const o = new THREE.Mesh(geo, mat); g.add(o); if (t) outline(o, t); return o; };
  const s = new THREE.Shape();
  s.moveTo(0, 0.012); s.lineTo(0.235, 0.012); s.quadraticCurveTo(0.285, 0.008, 0.305, -0.006);
  s.quadraticCurveTo(0.25, -0.042, 0.13, -0.05); s.lineTo(0, -0.05); s.closePath();
  const bg = new THREE.ExtrudeGeometry(s, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.002, bevelSegments: 1, curveSegments: 10 });
  bg.translate(0, 0, -0.0035); bg.rotateY(Math.PI / 2); // comprimento → -z, espessura → x
  const blade = m(bg, toonWarm(golden ? '#ffc52e' : '#cfd6de', 0.1, {}, golden ? '#fff3a6' : '#eef6ff')); blade.position.set(0, 0.018, -0.085);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.0115, 0.006, 0.2), basic('#ffffff')); edge.position.set(0, -0.027, -0.2); g.add(edge); // fio brilhante
  m(new THREE.BoxGeometry(0.022, 0.07, 0.022), toon(golden ? '#d49918' : '#9aa3ad')).position.set(0, 0.0, -0.075); // reforço (bolster)
  // cabo de madeira + rebites + logo
  const wood = toonWarm('#8b5a2b', 0.2, {}, '#c8813e');
  const h = m(new THREE.BoxGeometry(0.03, 0.05, 0.15), wood); h.position.set(0, -0.004, 0.005);
  const cap = m(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), wood); cap.rotation.z = Math.PI / 2; cap.position.set(0, -0.004, 0.08); cap.scale.set(1, 1, 1.1);
  for (const z of [-0.058, -0.026, 0.066]) for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 10), toon('#e8edf2')); r.rotation.z = Math.PI / 2; r.position.set(sx * 0.0165, -0.004, z); g.add(r); }
  for (const sx of [-1, 1]) { const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.02), new THREE.MeshBasicMaterial({ map: knifeLogoTex, transparent: true })); lg.position.set(sx * 0.0162, -0.004, 0.022); lg.rotation.y = sx * Math.PI / 2; g.add(lg); }
}
// Skeleton: ponta afilada, três furos pequenos na lâmina e um furo grande no meio, na guarda. Cabo escuro canelado.
function fillSkeleton(g, th, pal) {
  const m = (geo, mat, t = th) => { const o = new THREE.Mesh(geo, mat); g.add(o); if (t) outline(o, t); return o; };
  const s = new THREE.Shape();
  s.moveTo(-0.02, -0.016);
  s.lineTo(0.0, -0.038);
  s.lineTo(0.06, -0.03);
  s.lineTo(0.26, -0.012);
  s.lineTo(0.34, 0.0);
  s.lineTo(0.26, 0.014);
  s.lineTo(0.06, 0.032);
  s.lineTo(0.0, 0.04);
  s.lineTo(-0.02, 0.016);
  s.closePath();
  const big = new THREE.Path();
  big.absellipse(0.012, 0.001, 0.02, 0.02, 0, Math.PI * 2, true);
  s.holes.push(big);
  for (const [cx, cy, r] of [[0.068, 0.006, 0.0065], [0.096, 0.008, 0.0056], [0.122, 0.01, 0.0048]]) {
    const hole = new THREE.Path(); hole.absellipse(cx, cy, r, r, 0, Math.PI * 2, true); s.holes.push(hole);
  }
  pal.dress(knifeShape(g, Math.min(th, 0.0032), s, pal.steel(), new THREE.Vector3(0, 0.002, -0.03), 16));
  m(new THREE.BoxGeometry(0.024, 0.03, 0.1), pal.dark()).position.set(0, -0.002, 0.042);
  for (const z of [0.002, 0.024, 0.046, 0.068]) pal.dress(m(new THREE.BoxGeometry(0.028, 0.034, 0.007), pal.metal(), 0.002)).position.set(0, -0.002, z);
  const pom = new THREE.Shape();
  pom.absellipse(0, 0, 0.015, 0.017, 0, Math.PI * 2, false);
  const lace = new THREE.Path(); lace.absellipse(0.004, 0, 0.005, 0.005, 0, Math.PI * 2, true); pom.holes.push(lace);
  pal.dress(knifeShape(g, 0.0025, pom, pal.metal(), new THREE.Vector3(0, -0.002, 0.1), 12));
}
// Karambit: a garra sai da frente do cabo, desce e aponta pra frente. A argola fica no fim do cabo.
function fillKarambit(g, th, pal) {
  const m = (geo, mat, t = th) => { const o = new THREE.Mesh(geo, mat); g.add(o); if (t) outline(o, t); return o; };
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.012);
  s.quadraticCurveTo(0.12, 0.03, 0.2, -0.04);
  s.quadraticCurveTo(0.22, -0.1, 0.12, -0.09);
  s.quadraticCurveTo(0.14, -0.02, 0.0, -0.01);
  s.closePath();
  pal.dress(knifeShape(g, th, s, pal.steel(), new THREE.Vector3(0, -0.01, -0.06)));
  m(new THREE.BoxGeometry(0.03, 0.036, 0.09), pal.dark()).position.set(0, 0, 0.02);
  pal.dress(m(new THREE.BoxGeometry(0.04, 0.016, 0.012), pal.metal())).position.set(0, 0, -0.03);
  const ring = pal.dress(m(new THREE.TorusGeometry(0.024, 0.0055, 8, 16), pal.steel(), 0.003));
  ring.rotation.y = Math.PI / 2; ring.position.set(0, 0, KARAMBIT_RING_Z);
}
// Bayonetta (baioneta): lâmina reta de ponta cortada, guarda cruzada e o anel que entrava no cano.
function fillBayonet(g, th, pal) {
  const m = (geo, mat, t = th) => { const o = new THREE.Mesh(geo, mat); g.add(o); if (t) outline(o, t); return o; };
  const s = new THREE.Shape();
  s.moveTo(0, 0.012); s.lineTo(0.3, 0.012); s.lineTo(0.38, -0.002); s.lineTo(0.32, -0.02); s.lineTo(0, -0.02); s.closePath();
  pal.dress(knifeShape(g, th, s, pal.steel(), new THREE.Vector3(0, 0.008, -0.07)));
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.006, 0.22), pal.fuller()); fuller.position.set(0, 0.012, -0.2); g.add(fuller); pal.dress(fuller);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.004, 0.26), pal.edge()); edge.position.set(0, -0.012, -0.22); g.add(edge);
  pal.dress(m(new THREE.BoxGeometry(0.09, 0.012, 0.014), pal.metal())).position.set(0, 0.004, -0.055);
  const hoop = pal.dress(m(new THREE.TorusGeometry(0.016, 0.004, 6, 12), pal.metal(), 0.003));
  hoop.rotation.x = Math.PI / 2; hoop.position.set(0.038, 0.004, -0.07);
  m(new THREE.BoxGeometry(0.026, 0.032, 0.11), pal.dark()).position.set(0, 0, 0.012);
  for (const z of [-0.02, 0.03]) for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 8), pal.metal()); r.rotation.z = Math.PI / 2; r.position.set(sx * 0.014, 0, z); g.add(r); pal.dress(r); }
  pal.dress(m(new THREE.CylinderGeometry(0.016, 0.018, 0.02, 10), pal.metal())).rotation.z = Math.PI / 2;
  g.children[g.children.length - 1].position.set(0, 0, 0.078);
}
// Butterfly (balisong): um cabo fica na mão e o outro gira no pino, junto com a lâmina.
function fillButterfly(g, th, pal) {
  const m = (parent, geo, mat, t = th) => { const o = new THREE.Mesh(geo, mat); parent.add(o); if (t) outline(o, t); return o; };
  const pivot = new THREE.Group(); pivot.position.set(0, 0, -0.02); g.add(pivot);
  const blade = new THREE.Group(); const bite = new THREE.Group();
  pivot.add(blade); pivot.add(bite);
  g.userData.bflyBlade = blade; g.userData.bflyBite = bite;
  const s = new THREE.Shape();
  s.moveTo(0, 0.01); s.lineTo(0.16, 0.008); s.lineTo(0.22, -0.001); s.lineTo(0.16, -0.012); s.lineTo(0, -0.01); s.closePath();
  pal.dress(knifeShape(blade, th, s, pal.steel(), new THREE.Vector3(0, 0.002, 0)));
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.14), pal.edge()); edge.position.set(0, -0.01, -0.08); blade.add(edge);
  const pin = pal.dress(m(g, new THREE.CylinderGeometry(0.008, 0.008, 0.046, 10), pal.metal(), 0.002));
  pin.rotation.z = Math.PI / 2; pin.position.copy(pivot.position);
  const channel = (parent, x) => {
    m(parent, new THREE.BoxGeometry(0.011, 0.009, 0.16), pal.dark()).position.set(x, 0.013, 0.09);
    m(parent, new THREE.BoxGeometry(0.011, 0.009, 0.16), pal.dark()).position.set(x, -0.013, 0.09);
    pal.dress(m(parent, new THREE.BoxGeometry(0.018, 0.034, 0.016), pal.metal(), 0.002)).position.set(x, 0, 0.175);
  };
  const safe = new THREE.Group(); safe.position.copy(pivot.position); g.add(safe);
  channel(safe, -0.011);
  channel(bite, 0.011);
}
const KNIFE_FILL = { chef: fillChef, skeleton: fillSkeleton, karambit: fillKarambit, bayonet: fillBayonet, butterfly: fillButterfly };
function fillKnife(g, kind, th, finish) {
  g.userData.bflyBlade = null; g.userData.bflyBite = null;
  if (kind === 'gold') { fillChef(g, th, true); return; }
  if (!KNIFE_FILL[kind] || kind === 'chef') { fillChef(g, th, false); return; }
  KNIFE_FILL[kind](g, th, knifePal(finish));
}
// O furo da argola. A inspeção da karambit gira em volta desse ponto.
export const KARAMBIT_RING_Z = 0.086;
// k 0 = aberta na mão, k 1 = aberta de novo. No meio a lâmina dá uma volta e o cabo de cima abre.
// show (inspeção) deixa a lâmina e o cabo de cima abertos, pra olhar o fio.
export function poseButterfly(group, k, show = 0) {
  const blade = group && group.userData.bflyBlade, bite = group && group.userData.bflyBite;
  if (!blade || !bite) return;
  const a = butterflyInspectAngles(k, show);
  blade.rotation.x = a.blade;
  bite.rotation.x = a.bite;
}
function dropKnife(group) {
  for (const c of group.children.slice()) {
    group.remove(c);
    c.traverse((o) => {
      if (!o.isMesh || (o.userData && o.userData.isOutline)) return;
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
  }
}
export function makeKnife(scale = 1, th = 0.004, kind = 'chef', finish = 'factory') {
  const golden = kind === true || kind === 'gold';
  const g = new THREE.Group();
  g.userData.knifeSkin = true; g.userData.knifeGold = golden; g.userData.knifeTh = th;
  g.userData.knifeKind = golden ? 'chef' : (kind || 'chef'); g.userData.knifeFinish = golden ? 'factory' : (finish || 'factory');
  fillKnife(g, golden ? 'gold' : g.userData.knifeKind, th, g.userData.knifeFinish);
  g.scale.setScalar(scale); return g;
}
// Troca o modelo sem mexer na empunhadura (posição, giro e escala do grupo continuam).
// A faca dourada da Corrida Armada não aceita skin do Brechó.
export function applyKnifeSkin(group, kind = 'chef', finish = 'factory') {
  if (!group || group.userData.knifeGold) return;
  kind = KNIFE_FILL[kind] ? kind : 'chef';
  finish = KNIFE_FINISH[finish] ? finish : 'factory';
  if (kind === 'chef') finish = 'factory';
  if (group.userData.knifeKind === kind && group.userData.knifeFinish === finish && group.children.length) return;
  const scale = group.scale.x || 1;
  const th = group.userData.knifeTh || 0.006;
  dropKnife(group);
  group.scale.setScalar(1);
  fillKnife(group, kind, th, finish);
  group.scale.setScalar(scale);
  group.userData.knifeSkin = true; group.userData.knifeTh = th; group.userData.knifeKind = kind; group.userData.knifeFinish = finish;
}

// ---------- expressão: 'neutral' (sorrisão) e 'angry' (bravo ao atirar/golpear) ----------
// setExpression(model, 'angry', hold) segura a cara de bravo por `hold` s depois do último chamado; updateExpression(model, dt)
// faz a mistura (~0,08 s pra entrar, ~0,15 s pra voltar). Só mexe em transform das sobrancelhas/olhos e troca a textura do rosto
// (variante 'brava' criada uma vez por combinação tom/barba/pintura e reaproveitada): nada de geometria nova por frame.
const _eq = new THREE.Quaternion(), _ez = new V3(0, 0, 1), _ey = new V3();
export function setExpression(model, expr = 'neutral', hold = 0.5) {
  const f = model && model.face; if (!f) return;
  if (expr === 'angry') { f.target = 1; f.hold = Math.max(f.hold, hold); } else { f.target = 0; f.hold = 0; }
  model.expression = expr;
}
export function updateExpression(model, dt) {
  const f = model && model.face; if (!f) return;
  if (f.target && (f.hold -= dt) <= 0) { f.target = 0; model.expression = 'neutral'; }
  if (f.t === f.target && f.applied) return;
  f.t = f.target > f.t ? Math.min(f.target, f.t + dt / 0.08) : Math.max(f.target, f.t - dt / 0.15); f.applied = true;
  const t = f.t * f.t * (3 - 2 * f.t);
  for (let i = 0; i < f.brows.length; i++) { // sobrancelhas descem, achatam e giram pro centro (V)
    const b = f.brows[i], s = i === 0 ? -1 : 1, B = b.userData.base;
    b.quaternion.copy(B.q).multiply(_eq.setFromAxisAngle(_ez, s * 0.7 * t)); b.scale.set(1 + 0.4 * t, 1 - 0.15 * t, 1 + 0.4 * t);
    _ey.set(0, 1, 0).applyQuaternion(B.q); b.position.copy(B.p).addScaledVector(_ey, -0.1 * t);
  }
  for (const e of f.eyes) e.scale.set(1, 1 - 0.42 * t, 1); // aperta os olhos
  const angry = f.t > 0.5;
  if (angry && !f.angryMap) f.angryMap = headTexture(...f.tex, true);
  const map = angry ? f.angryMap : f.neutralMap;
  if (f.faceM.map !== map) { f.faceM.map = map; f.faceM.emissiveMap = map; }
}

// Fim da chapa: Docão enorme, bravo, segurando a ogiva. O loop anima a queda; aqui só nasce o grupo.
const NUKE_HOLD = 120;
function makeFarmOgiva() {
  const g = new THREE.Group();
  g.name = 'ogiva';
  g.position.set(0, 0.28, 0.62);
  const add = (geo, color, th = 0.014) => {
    const m = new THREE.Mesh(geo, toonWarm(color, 0.18));
    outline(m, th); m.castShadow = true; g.add(m); return m;
  };
  add(new THREE.CylinderGeometry(0.4, 0.44, 1.28, 8), '#5f6b32');
  const band = add(new THREE.CylinderGeometry(0.47, 0.47, 0.2, 8), '#fff0cc', 0.01); band.position.y = 0.08;
  const stripe = add(new THREE.CylinderGeometry(0.48, 0.48, 0.07, 8), '#a52e26', 0.008); stripe.position.y = 0.32;
  const nose = add(new THREE.CylinderGeometry(0.05, 0.44, 0.58, 8), '#a52e26', 0.012); nose.position.y = -0.9;
  const snout = add(new THREE.CylinderGeometry(0.15, 0.17, 0.09, 8), '#ec5c0c', 0.008); snout.position.y = -1.22;
  for (const s of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), basic('#3a0806'));
    n.position.set(s * 0.055, -1.22, 0.055); g.add(n);
  }
  const cap = add(new THREE.CylinderGeometry(0.26, 0.4, 0.14, 8), '#203e35', 0.01); cap.position.y = 0.68;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const fin = add(new THREE.BoxGeometry(0.34, 0.36, 0.05), '#203e35', 0.008);
    fin.position.set(Math.cos(a) * 0.56, 0.62, Math.sin(a) * 0.56);
    fin.rotation.y = a;
  }
  const plate = add(new THREE.BoxGeometry(0.02, 0.26, 0.32), '#fff0cc', 0.006); plate.position.set(0.49, 0.02, 0);
  return g;
}
export function makeNukeRider() {
  const root = new THREE.Group();
  root.name = 'nukeRider';
  const model = makeDocao(null, { withGun: false, pose: 'idle' });
  model.arms[0].rotation.set(-0.35, 0.55, -0.7);
  model.arms[1].rotation.set(-0.35, -0.55, 0.7);
  setExpression(model, 'angry', NUKE_HOLD);
  updateExpression(model, 1);
  model.group.add(makeFarmOgiva());
  root.add(model.group);
  root.scale.setScalar(2.45); // ~5 m de altura
  root.position.set(0, 44, 0);
  root.rotation.x = -0.12;
  root.userData.model = model;
  return root;
}

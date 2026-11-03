// ============================================================
//  Construção do mundo a partir dos dados de maps.js.
//  Caixas/rampas viram UMA malha por cor (geometria mesclada) + UMA malha de contornos,
//  props têm visual próprio e colisão AABB (proxy invisível mesclado para os raycasts).
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { toon, outline, makeCup, canvasTex, drawLogo } from './docao.js';
import { visualOffsets } from './world-offsets.js';
import { mountNevasca } from './nevasca-show.js';
import { elevatorPose, gondolaPose } from './shared/nevasca.js';
// camadas finas no chão (piso xadrez, asfalto, meio-fio, faixa) ficam a 1–2 cm do chão: de longe a profundidade não separa e pisca.
// polygonOffset empurra cada camada pra frente no depth buffer (camada maior = mais na frente), sem mexer na posição.
function decal(m, layer) { m.polygonOffset = true; m.polygonOffsetFactor = -1 * layer; m.polygonOffsetUnits = -4 * layer; return m; }

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a1410 });
const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
export const WALL_COLLIDE_H = 40; // limite do mapa é bem alto na colisão (ninguém escapa com rocket jump)

function boxGeo(x0, y0, z0, x1, y1, z1, ramp) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, h, d);
  if (ramp) { // cunha: abaixa os vértices de cima do lado baixo
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const c = ramp.axis === 'x' ? pos.getX(i) : pos.getZ(i);
      const low = ramp.dir > 0 ? c < 0 : c > 0;
      if (pos.getY(i) > 0 && low) pos.setY(i, -h / 2);
    }
    geo.computeVertexNormals();
  }
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return geo;
}

function textPlane(w, h, draw, opts = {}) {
  const r = w / h, cw = 512, ch = Math.max(32, Math.round(512 / r));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(cw, ch, draw), transparent: !!opts.transparent, depthWrite: !opts.transparent, fog: opts.fog !== false, toneMapped: false }));
  return m;
}
function fitFont(x, text, maxW, size, weight = '900') {
  let s = size; x.font = `${weight} ${s}px "Arial Black", Arial`;
  while (x.measureText(text).width > maxW && s > 10) { s -= 4; x.font = `${weight} ${s}px "Arial Black", Arial`; }
}
function stripes(c1, c2, n = 8) { const t = canvasTex(256, 32, (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? c2 : c1; x.fillRect(i * w / n, 0, w / n + 1, h); } }); return t; }

// ---------- props ----------
function buildProp(p, ctx) {
  const { group, solid, add } = ctx;
  const y = p.y || 0;
  switch (p.t) {
    case 'logoSign': {
      const m = textPlane(8, 3, (x, w, h) => {
        x.fillStyle = '#e63946'; x.fillRect(0, 0, w, h); x.lineWidth = 14; x.strokeStyle = '#2a1410'; x.strokeRect(7, 7, w - 14, h - 14);
        x.font = '900 120px "Arial Black", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; x.strokeText('C!', 120, 100); x.fillStyle = '#fff'; x.fillText('C!', 120, 100);
        x.font = '900 52px "Arial Black", Arial'; x.fillStyle = '#7DF9FF'; x.fillText('DOCÃO', 350, 70); x.fillStyle = '#fff'; x.fillText('SHOOTER', 350, 130);
      });
      m.position.set(p.x, p.y, p.z); m.rotation.y = p.rot || 0; group.add(m); break;
    }
    case 'clock': { // relógio da partida: o canvas é redesenhado no loop
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
      const tex = new THREE.CanvasTexture(canvas);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = p.rot || 0;
      mesh.userData.clock = { canvas, tex, ctx: canvas.getContext('2d') };
      (group.userData.clocks = group.userData.clocks || []).push(mesh); group.add(mesh); break;
    }
    case 'cable': {
      const dx = p.x1 - p.x0, dy = p.y1 - p.y0, dz = p.z1 - p.z0, len = Math.hypot(dx, dy, dz) || 0.01;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r || 0.07, p.r || 0.07, len, 5), toon(p.c || '#2c3338'));
      m.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
      group.add(m); break;
    }
    case 'glow': {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(p.x1 - p.x0), Math.abs(p.z1 - p.z0)), new THREE.MeshBasicMaterial({ color: p.c || 0xF2D9A0, transparent: true, opacity: p.o || 0.85, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set((p.x0 + p.x1) / 2, p.y, (p.z0 + p.z1) / 2); group.add(m); break;
    }
    case 'decal': {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(p.x1 - p.x0), Math.abs(p.z1 - p.z0)), new THREE.MeshBasicMaterial({ color: p.c || 0x4a5258 }));
      m.rotation.x = -Math.PI / 2; m.position.set((p.x0 + p.x1) / 2, p.y || 0.02, (p.z0 + p.z1) / 2); group.add(m); break;
    }
    case 'sign': {
      const m = textPlane(p.w, p.h, (x, w, h) => {
        x.fillStyle = p.bg; x.fillRect(0, 0, w, h); x.lineWidth = 10; x.strokeStyle = '#2a1410'; x.strokeRect(5, 5, w - 10, h - 10);
        x.textAlign = 'center'; x.textBaseline = 'middle'; fitFont(x, p.text, w * 0.86, h * 0.62);
        x.lineWidth = 8; x.strokeText(p.text, w / 2, h / 2 + 4); x.fillStyle = p.fg; x.fillText(p.text, w / 2, h / 2 + 4);
      });
      m.position.set(p.x, p.y, p.z); m.rotation.y = p.rot || 0; group.add(m); break;
    }
    case 'neon': { // letreiro neon: texto com brilho, não é afetado pela neblina
      const back = new THREE.Mesh(new THREE.PlaneGeometry(p.w + 0.4, p.h + 0.3), new THREE.MeshBasicMaterial({ color: 0x120c1c }));
      const m = textPlane(p.w, p.h, (x, w, h) => {
        x.textAlign = 'center'; x.textBaseline = 'middle'; fitFont(x, p.text, w * 0.8, h * 0.6);
        x.shadowColor = p.c; x.shadowBlur = 28; x.lineWidth = 10; x.strokeStyle = p.c; x.strokeText(p.text, w / 2, h / 2 + 4);
        x.shadowBlur = 12; x.fillStyle = '#ffffff'; x.fillText(p.text, w / 2, h / 2 + 4);
      }, { transparent: true, fog: false });
      const g = new THREE.Group(); g.add(back); m.position.z = 0.02; g.add(m); g.position.set(p.x, p.y, p.z); g.rotation.y = p.rot || 0; group.add(g); break;
    }
    case 'strip': { // tubo neon fino
      const len = Math.hypot(p.x1 - p.x0, p.z1 - p.z0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.05), new THREE.MeshBasicMaterial({ color: p.c, fog: false, toneMapped: false }));
      m.position.set((p.x0 + p.x1) / 2, p.y, (p.z0 + p.z1) / 2); m.rotation.y = -Math.atan2(p.z1 - p.z0, p.x1 - p.x0); group.add(m); break;
    }
    case 'keg': { // barril de chope
      const g = new THREE.Group(), r = p.r || 0.48, h = p.h || 1.1;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, h, 18), toon(p.c || '#8b5a2b')); body.position.y = h / 2; outline(body, 0.02); g.add(body);
      for (const k of [0.18, 0.82]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.09, 18), toon('#9aa3a8')); ring.position.y = h * k; g.add(ring); }
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 0.03, 18), toon('#c0c7cc')); lid.position.y = h + 0.01; g.add(lid);
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      solid(p.x - r * 0.85, y, p.z - r * 0.85, p.x + r * 0.85, y + h, p.z + r * 0.85); break;
    }
    case 'cup': { // copão vermelho gigante (cobertura) ou decorativo no balcão
      const c = makeCup(p.s || 4); c.position.set(p.x, y, p.z); group.add(c);
      if (!p.deco) { const s = p.s || 4; solid(p.x - 0.11 * s, y, p.z - 0.11 * s, p.x + 0.11 * s, y + 0.31 * s, p.z + 0.11 * s); }
      break;
    }
    case 'bus': { // ônibus (ao longo de X)
      const g = new THREE.Group(), L = 10, W = 2.8, H = 3.1;
      const body = new THREE.Mesh(new THREE.BoxGeometry(L, H - 0.4, W), toon(p.c)); body.position.y = 0.4 + (H - 0.4) / 2; outline(body, 0.03); g.add(body);
      const winM = toon('#24324a');
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(L - 1.6, 0.8, 0.04), winM); w.position.set(0.3, 2.3, s * (W / 2 + 0.01)); g.add(w); }
      const fw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, W - 0.5), winM); fw.position.set(L / 2 + 0.01, 2.2, 0); g.add(fw);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(L + 0.02, 0.25, W + 0.02), toon('#e63946')); stripe.position.y = 1.35; g.add(stripe);
      const logo = textPlane(1.6, 1.0, (x, w, h) => { x.clearRect(0, 0, w, h); drawLogo(x, w / 2, h / 2, h * 0.7, '#e63946', '#2a1410'); }, { transparent: true });
      logo.position.set(-2, 1.0, W / 2 + 0.03); g.add(logo);
      for (const wx of [-3.3, 3.3]) for (const s of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), toon('#222')); wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.5, s * (W / 2 - 0.1)); g.add(wh); }
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); group.add(g);
      solid(p.x - L / 2, y, p.z - W / 2, p.x + L / 2, y + H, p.z + W / 2); break;
    }
    case 'truck': { // caminhão (cabine + baú) ao longo de X
      const g = new THREE.Group();
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.5), toon('#f5efe6')); cargo.position.set(-1, 0.6 + 1.3, 0); outline(cargo, 0.03); g.add(cargo);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.4), toon(p.c)); cab.position.set(3.2, 0.6 + 1.0, 0); outline(cab, 0.03); g.add(cab);
      const ws = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 2.0), toon('#24324a')); ws.position.set(4.31, 2.0, 0); g.add(ws);
      const logo = textPlane(3, 1.4, (x, w, h) => { x.fillStyle = '#f5efe6'; x.fillRect(0, 0, w, h); drawLogo(x, w * 0.28, h / 2, h * 0.7, '#e63946', '#2a1410'); x.font = '900 70px "Arial Black", Arial'; x.fillStyle = '#e63946'; x.textBaseline = 'middle'; x.fillText('CHEERS', w * 0.45, h / 2); });
      for (const s of [-1, 1]) { const l = logo.clone(); l.position.set(-1, 1.9, s * 1.26); l.rotation.y = s > 0 ? 0 : Math.PI; g.add(l); }
      for (const wx of [-3, 0.2, 3.2]) for (const s of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 14), toon('#222')); wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.48, s * 1.1); g.add(wh); }
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); group.add(g);
      solid(p.x - 4, y, p.z - 1.25, p.x + 2, y + 3.2, p.z + 1.25); solid(p.x + 2, y, p.z - 1.2, p.x + 4.3, y + 2.6, p.z + 1.2); break;
    }
    case 'log': { // tora alta (tronco em pé)
      const h = p.h || 6, r = p.r || 0.46;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, h, 12), toon('#6b3a22')); trunk.position.y = h / 2; outline(trunk, 0.025); g.add(trunk);
      const cut = new THREE.Mesh(new THREE.CircleGeometry(r * 0.84, 12), toon('#d7b07a')); cut.rotation.x = -Math.PI / 2; cut.position.y = h + 0.01; g.add(cut);
      for (const k of [0.22, 0.58]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.12, 12), toon('#4a2a16')); ring.position.y = h * k; g.add(ring); }
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      solid(p.x - r, y, p.z - r, p.x + r, y + h, p.z + r); break;
    }
    case 'bench': { // banco virado pra dentro: rot é o yaw do encosto (costas apontam no +Z local)
      const g = new THREE.Group();
      const wood = toon('#c4a574'), leg = toon('#5a3420');
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.46), wood); seat.position.set(0, 0.46, -0.02); outline(seat, 0.02); g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), wood); back.position.set(0, 0.78, 0.26); outline(back, 0.02); g.add(back);
      for (const sx of [-0.7, 0.7]) for (const sz of [-0.16, 0.14]) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), leg); po.position.set(sx, 0.21, sz); g.add(po); }
      g.position.set(p.x, y, p.z); g.rotation.y = p.rot || 0; g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0), hx = 0.85, z0 = -0.25, z1 = 0.32;
      let x0 = Infinity, x1 = -Infinity, a0 = Infinity, a1 = -Infinity;
      for (const lx of [-hx, hx]) for (const lz of [z0, z1]) {
        const wx = p.x + lx * c + lz * s, wz = p.z - lx * s + lz * c;
        x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); a0 = Math.min(a0, wz); a1 = Math.max(a1, wz);
      }
      solid(x0, y, a0, x1, y + 0.95, a1); break;
    }
    case 'flowerbed': { // canteiro baixo com flores
      const g = new THREE.Group(), r = 0.95;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.55, 16), toon('#cfc6b8')); rim.position.y = 0.28; outline(rim, 0.02); g.add(rim);
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.12, 16), toon('#4a3424')); soil.position.y = 0.52; g.add(soil);
      const cols = ['#e23b3b', '#f2c94c', '#ff5fa2', '#ffffff', '#7cc95a', '#e23b3b', '#f2c94c', '#ff5fa2'];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, rad = i % 2 ? 0.38 : 0.62;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 5), toon('#2f6b45')); stem.position.set(Math.cos(a) * rad, 0.74, Math.sin(a) * rad); g.add(stem);
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), toon(cols[i])); bloom.position.set(Math.cos(a) * rad, 0.98, Math.sin(a) * rad); outline(bloom, 0.015); g.add(bloom);
      }
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      solid(p.x - r, y, p.z - r, p.x + r, y + 0.62, p.z + r); break;
    }
    case 'car': { // carro ao longo de Z (rot 0 olha pra +Z, PI olha pra −Z). Colisão em duas metades pra o teto não virar chão.
      const g = new THREE.Group(), L = 4.05, W = 1.68, body = toon(p.c || '#f4f1ea'), glass = toon('#24324a'), black = toon('#1c1c1c');
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(W, 0.48, L), body); chassis.position.y = 0.62; outline(chassis, 0.02); g.add(chassis);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.46, 1.7), body); cab.position.set(0, 1.02, 0); outline(cab, 0.02); g.add(cab);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 1.35), glass); w.position.set(s * (W / 2 - 0.02), 1.04, 0); g.add(w); }
      const wind = new THREE.Mesh(new THREE.BoxGeometry(W - 0.36, 0.32, 0.04), glass); wind.position.set(0, 1.05, 0.86); g.add(wind);
      const rear = wind.clone(); rear.position.z = -0.86; g.add(rear);
      for (const wz of [-1.28, 1.28]) for (const s of [-1, 1]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12), black); wh.rotation.z = Math.PI / 2; wh.position.set(s * (W / 2 - 0.02), 0.32, wz); g.add(wh);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 8), toon('#c0c7cc')); hub.rotation.z = Math.PI / 2; hub.position.set(s * (W / 2 + 0.02), 0.32, wz); g.add(hub);
      }
      for (const s of [-1, 1]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.05), toon('#fff6d8')); hl.position.set(s * 0.48, 0.66, L / 2); g.add(hl);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.05), toon('#e23b3b')); tl.position.set(s * 0.48, 0.7, -L / 2); g.add(tl);
      }
      g.position.set(p.x, y, p.z); g.rotation.y = p.rot || 0; g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); group.add(g);
      const seg = 1.9;
      solid(p.x - W / 2, y + 0.08, p.z - L / 2, p.x + W / 2, y + 1.12, p.z - L / 2 + seg);
      solid(p.x - W / 2, y + 0.08, p.z + L / 2 - seg, p.x + W / 2, y + 1.12, p.z + L / 2);
      solid(p.x - 0.72, y + 0.9, p.z - 0.85, p.x + 0.72, y + 1.28, p.z + 0.85); break;
    }
    case 'tree': {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 10), toon('#8b5a2b')); tr.position.y = 1.5; outline(tr, 0.02); g.add(tr);
      const lm = toon('#4caf50');
      for (const [dx, dy, dz, r] of [[0, 3.6, 0, 1.8], [0.9, 3.1, 0.4, 1.2], [-0.8, 3.2, -0.4, 1.3], [0.2, 4.5, -0.2, 1.2]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), lm); l.position.set(dx, dy, dz); outline(l, 0.03); g.add(l); }
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      solid(p.x - 0.4, y, p.z - 0.4, p.x + 0.4, y + 3, p.z + 0.4); break;
    }
    case 'silo': {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, p.h, 24), toon(p.c)); b.position.y = p.h / 2; outline(b, 0.04); g.add(b);
      for (let k = 1; k < 4; k++) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(p.r + 0.05, p.r + 0.05, 0.15, 24), toon('#95a5a6')); ring.position.y = p.h * k / 4; g.add(ring); }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(p.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon('#e63946')); dome.position.y = p.h; outline(dome, 0.04); g.add(dome);
      const logo = textPlane(p.r * 1.2, p.r * 0.8, (x, w, h) => { x.clearRect(0, 0, w, h); drawLogo(x, w / 2, h / 2, h * 0.8, '#e63946', '#2a1410'); }, { transparent: true });
      logo.position.set(0, p.h * 0.62, p.r + 0.02); g.add(logo);
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      const q = p.r * 0.9; solid(p.x - q, y, p.z - q, p.x + q, y + p.h, p.z + q); break;
    }
    case 'hay': add(p.x - 1, y, p.z - 0.6, p.x + 1, y + 1.2, p.z + 0.6, '#f2c94c'); break;
    case 'stall': { // barraca de feira: balcão + toldo listrado + postes
      add(p.x - 1.2, y, p.z - 0.6, p.x + 1.2, y + 1.0, p.z + 0.6, '#8b5a2b');
      const aw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2.2), toon('#ffffff', { map: stripes(p.c, '#fff7ea') })); aw.position.set(p.x, y + 2.66, p.z); outline(aw, 0.02); aw.castShadow = true; group.add(aw);
      solid(p.x - 1.6, y + 2.6, p.z - 1.1, p.x + 1.6, y + 2.72, p.z + 1.1);
      for (const sx of [-1.5, 1.5]) for (const sz of [-1.0, 1.0]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), toon('#6b4423')); po.position.set(p.x + sx, y + 1.3, p.z + sz); group.add(po); }
      for (let k = 0; k < 4; k++) { const fr = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toon(['#e63946', '#f2c94c', '#7cc95a', '#F7A531'][k])); fr.position.set(p.x - 0.8 + k * 0.53, y + 1.15, p.z); group.add(fr); }
      break;
    }
    case 'awning': {
      const w = p.x1 - p.x0, d = p.z1 - p.z0;
      const aw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), toon('#ffffff', { map: stripes(p.c, '#fff7ea') })); aw.position.set((p.x0 + p.x1) / 2, p.y + 0.06, (p.z0 + p.z1) / 2); outline(aw, 0.02); group.add(aw);
      solid(p.x0, p.y, p.z0, p.x1, p.y + 0.12, p.z1); break;
    }
    case 'water': {
      const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), new THREE.MeshBasicMaterial({ color: 0x7DF9FF, transparent: true, opacity: 0.8 }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, p.y, p.z); group.add(m); break;
    }
    case 'jar': {
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.18 + Math.sin(t * Math.PI) * 0.32 - (t > 0.85 ? (t - 0.85) * 0.8 : 0), t * 1.1)); }
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), toon('#c96f4a')); m.position.set(p.x, y, p.z); outline(m, 0.02); m.castShadow = true; group.add(m);
      solid(p.x - 0.4, y, p.z - 0.4, p.x + 0.4, y + 1.1, p.z + 0.4); break;
    }
    case 'street': { // asfalto + faixa tracejada
      const w = p.x1 - p.x0, d = p.z1 - p.z0;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), decal(toon('#5a5f68'), 2)); m.rotation.x = -Math.PI / 2; m.position.set((p.x0 + p.x1) / 2, 0.015, (p.z0 + p.z1) / 2); m.receiveShadow = true; group.add(m);
      const lm = decal(new THREE.MeshBasicMaterial({ color: 0xf2c94c }), 4);
      for (let x = p.x0 + 1; x < p.x1 - 1; x += 3) { const l = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), lm); l.rotation.x = -Math.PI / 2; l.position.set(x + 0.8, 0.02, (p.z0 + p.z1) / 2); group.add(l); }
      for (const z of [p.z0, p.z1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.5), decal(toon('#d9d4cc'), 3)); c.rotation.x = -Math.PI / 2; c.position.set((p.x0 + p.x1) / 2, 0.018, z); group.add(c); }
      break;
    }
    case 'banner': { // estandarte da base (Torres)
      const m = textPlane(3, 2.2, (x, w, h) => { x.fillStyle = p.c; x.fillRect(0, 0, w, h); x.lineWidth = 10; x.strokeStyle = '#2a1410'; x.strokeRect(5, 5, w - 10, h - 10); drawLogo(x, w / 2, h / 2, h * 0.62, '#ffffff', '#2a1410'); });
      m.position.set(p.x, p.y, p.z); m.rotation.y = p.rot || 0; group.add(m); break;
    }
    case 'moon': { // vidraça com luz de lua: sem colisão, visível dos dois lados
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w || 1.6, p.h || 1.1), new THREE.MeshBasicMaterial({ color: p.c || '#9eb6e4', transparent: true, opacity: 0.72, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
      m.position.set(p.x, p.y, p.z); m.rotation.y = p.rot || 0; group.add(m); break;
    }
    case 'pine': { // pinheiro nevado: só o tronco colide; o visual é instanciado no fim
      if (p.y == null || p.y > -2) solid(p.x - 0.4, y, p.z - 0.4, p.x + 0.4, y + 3.1, p.z + 0.4); break;
    }
    case 'drift': { // monte de neve chanfrado (cone), colisão só no miolo
      const r = p.r || 1.1, h = p.h || 0.8;
      const g = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), toon(p.c || '#E8EDF2')); cone.position.y = h / 2; g.add(cone);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.34, 8, 6), toon('#F7FBFF')); cap.position.y = h * 0.86; g.add(cap);
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      solid(p.x - r * 0.45, y, p.z - r * 0.45, p.x + r * 0.45, y + h * 0.5, p.z + r * 0.45); break;
    }
    case 'grate': { // grade da passarela: só visual
      const w = p.x1 - p.x0, d = p.z1 - p.z0;
      const tex = canvasTex(64, 64, (x) => { x.fillStyle = '#5c656c'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#1c2428'; for (let i = 0; i < 8; i++) { x.fillRect(i * 8, 0, 2, 64); x.fillRect(0, i * 8, 64, 2); } });
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, w / 2), Math.max(1, d / 2));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon(0xffffff, { map: tex }));
      m.rotation.x = -Math.PI / 2; m.position.set((p.x0 + p.x1) / 2, p.y || 0.03, (p.z0 + p.z1) / 2); group.add(m); break;
    }
    case 'dish': { // parabólica, sem colisão
      const r = p.r || 1.1;
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), toon(p.c || '#d5dbe0'));
      d.rotation.x = -0.9; d.position.set(p.x, p.y, p.z); group.add(d);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), toon('#6E7378')); mast.position.set(p.x, p.y - 0.4, p.z); group.add(mast); break;
    }
    case 'heli': { // silhueta na neblina, sem colisão
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 2.4), toon('#2a3138')); body.position.y = 1.2; g.add(body);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.7, 0.7), toon('#2a3138')); tail.position.set(-5.2, 1.6, 0); g.add(tail);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.35), toon('#1c2228')); rotor.position.y = 2.5; g.add(rotor);
      g.position.set(p.x, p.y, p.z); g.rotation.y = p.rot || 0; group.add(g); break;
    }
    case 'dome': { // domo / tanque esférico (radar)
      const r = p.r || 2.2, h = p.h || 1.3;
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 16), toon(p.c || '#9C9A94')); base.position.y = h / 2; outline(base, 0.03); g.add(base);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.94, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(p.cap || '#E8EDF2')); cap.position.y = h; outline(cap, 0.03); g.add(cap);
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      solid(p.x - r, y, p.z - r, p.x + r, y + h + r * 0.55, p.z + r); break;
    }
    case 'tank': { // tanque vertical (propano / combustível)
      const r = p.r || 1.15, h = p.h || 2.5;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), toon(p.c || '#8A8D8F')); body.position.y = h / 2; outline(body, 0.03); g.add(body);
      const top = new THREE.Mesh(new THREE.SphereGeometry(r * 0.98, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(p.cap || '#E8EDF2')); top.position.y = h; g.add(top);
      if (p.band) { const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.18, 16), toon(p.band)); band.position.y = h * 0.62; g.add(band); }
      g.position.set(p.x, y, p.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(g);
      solid(p.x - r, y, p.z - r, p.x + r, y + h, p.z + r); break;
    }
    case 'pane': { // vidro sem colisão (claraboia / janela): tiro e gente passam
      const ww = Math.abs((p.x1 ?? p.x) - (p.x0 ?? p.x)) || 0.04, dd = Math.abs((p.z1 ?? p.z) - (p.z0 ?? p.z)) || 0.04;
      const horiz = (p.axis || (ww >= dd ? 'x' : 'z')) === 'y';
      const geo = horiz ? new THREE.PlaneGeometry(Math.max(ww, 0.4), Math.max(dd, 0.4)) : new THREE.PlaneGeometry(Math.max(ww, dd), p.h || 2.2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: p.c || 0xBFDDEB, transparent: true, opacity: p.o ?? 0.28, side: THREE.DoubleSide, depthWrite: false }));
      if (horiz) m.rotation.x = -Math.PI / 2;
      else if ((p.axis || (ww >= dd ? 'x' : 'z')) === 'z') m.rotation.y = Math.PI / 2;
      const cx = ((p.x0 ?? p.x) + (p.x1 ?? p.x)) / 2, cz = ((p.z0 ?? p.z) + (p.z1 ?? p.z)) / 2;
      m.position.set(cx, p.y, cz); group.add(m); break;
    }
    default: console.warn('prop desconhecido', p.t);
  }
}

function punchRect(rects, hole) {
  const [hx0, hz0, hx1, hz1] = hole, next = [];
  for (const [a0, b0, a1, b1] of rects) {
    if (hx1 <= a0 || hx0 >= a1 || hz1 <= b0 || hz0 >= b1) { next.push([a0, b0, a1, b1]); continue; }
    const cx0 = Math.max(a0, hx0), cx1 = Math.min(a1, hx1);
    if (hz0 > b0) next.push([a0, b0, a1, hz0]);
    if (hz1 < b1) next.push([a0, hz1, a1, b1]);
    if (cx0 > a0) next.push([a0, Math.max(b0, hz0), cx0, Math.min(b1, hz1)]);
    if (cx1 < a1) next.push([cx1, Math.max(b0, hz0), a1, Math.min(b1, hz1)]);
  }
  return next;
}
function fallRectsOf(map) {
  const f = map.fall; if (!f) return [];
  const [hx, hz] = map.size, r = (f.rects || []).map((q) => q.slice());
  if (f.margin) { const m = f.margin; r.push([-hx, hz - m, hx, hz], [-hx, -hz, hx, -hz + m], [-hx, -hz + m, -hx + m, hz - m], [hx - m, -hz + m, hx, hz - m]); }
  return r;
}

// ---------- mundo ----------
// Docão Escondido: a mesma malha do prop do mapa, solta (sem colisão), pra o Escondido virar o objeto igualzinho ao do cenário
export function buildPropMesh(p) {
  const group = new THREE.Group(), noop = () => {};
  const add = (x0, y0, z0, x1, y1, z1, color) => { const m = new THREE.Mesh(boxGeo(x0, y0, z0, x1, y1, z1), toon(color)); m.castShadow = true; group.add(m); };
  buildProp({ x: 0, z: 0, ...p }, { group, solid: noop, add });
  return group;
}
export function buildWorld(map) {
  const group = new THREE.Group(); group.name = 'world:' + map.id;
  const solids = [], meshes = [], byColor = new Map(), edges = [], proxies = [];
  const [hx, hz] = map.size, pal = map.palette;
  const pushGeo = (geo, color, withEdges = true) => {
    const k = new THREE.Color(color).getHexString(); if (!byColor.has(k)) byColor.set(k, []); byColor.get(k).push(geo);
    if (withEdges) { const e = new THREE.EdgesGeometry(geo, 20); edges.push(e.attributes.position.array); e.dispose(); }
  };
  const add = (x0, y0, z0, x1, y1, z1, color, ramp = null, collideTop = null, d = null) => {
    // d: ajuste só visual (anti z-fighting, ver world-offsets.js); a caixa de colisão continua exata
    pushGeo(d ? boxGeo(x0 - d[0], y0 - d[1], z0 - d[2], x1 + d[3], y1 + d[4], z1 + d[5], ramp) : boxGeo(x0, y0, z0, x1, y1, z1, ramp), color);
    solids.push({ min: new V3(x0, y0, z0), max: new V3(x1, collideTop ?? y1, z1), ramp });
  };
  const solid = (x0, y0, z0, x1, y1, z1) => { solids.push({ min: new V3(x0, y0, z0), max: new V3(x1, y1, z1), ramp: null }); proxies.push(boxGeo(x0, y0, z0, x1, y1, z1)); };

  // chão. Com map.fall, a faixa do abismo vira um plano escuro lá embaixo (o corpo morre antes de chegar).
  const ext = Math.max(hx, hz);
  const R = ext + 130;
  let groundRects = [[-R, -R, R, R]];
  const voids = fallRectsOf(map);
  const cuts = (map.fall && map.fall.cuts) || [];
  for (const v of [...voids, ...cuts]) groundRects = punchRect(groundRects, v);
  for (const [x0, z0, x1, z1] of groundRects) {
    if (x1 - x0 < 0.2 || z1 - z0 < 0.2) continue;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), toon(pal.ground));
    ground.rotation.x = -Math.PI / 2; ground.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); ground.receiveShadow = true; group.add(ground); meshes.push(ground);
  }
  if (map.fall) for (const [x0, z0, x1, z1] of voids) {
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.4, x1 - x0), Math.max(0.4, z1 - z0)), toon(map.fall.pit || '#1a2228'));
    pit.rotation.x = -Math.PI / 2; pit.position.set((x0 + x1) / 2, (map.fall.floor ?? -30), (z0 + z1) / 2); pit.receiveShadow = true; group.add(pit);
  }
  if (map.fall && map.fall.slopes) {
    // faixas da crista (neve) até o fundo (rocha): o plano liso da cor da névoa lia como chão plano
    const bands = map.fall.slopeBands || ['#F4F7FA', '#E8EDF2', '#C5CED6', '#9AA6B0', '#6E757C', '#4A4E54', '#3A4046'];
    const byBand = bands.map(() => []);
    for (const s of map.fall.slopes) {
      const { x0, z0, x1, z1, axis, dir } = s;
      const yLo = Math.min(s.y0, s.y1), yHi = Math.max(s.y0, s.y1);
      const n = bands.length;
      const yAtX = (t) => { const yx0 = dir > 0 ? yLo : yHi, yx1 = dir > 0 ? yHi : yLo; return yx0 + (yx1 - yx0) * t; };
      const yAtZ = (t) => { const yz0 = dir > 0 ? yLo : yHi, yz1 = dir > 0 ? yHi : yLo; return yz0 + (yz1 - yz0) * t; };
      const highT = dir > 0 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n, u = highT === 1 ? (a + b) / 2 : 1 - (a + b) / 2;
        const ci = Math.min(n - 1, Math.floor((1 - u) * n));
        const geo = new THREE.BufferGeometry();
        let pos;
        if (axis === 'x') {
          const xa = x0 + (x1 - x0) * a, xb = x0 + (x1 - x0) * b, ya = yAtX(a), yb = yAtX(b);
          pos = [xa, ya, z0, xb, yb, z0, xb, yb, z1, xa, ya, z0, xb, yb, z1, xa, ya, z1];
        } else {
          const za = z0 + (z1 - z0) * a, zb = z0 + (z1 - z0) * b, ya = yAtZ(a), yb = yAtZ(b);
          pos = [x0, ya, za, x1, ya, za, x1, yb, zb, x0, ya, za, x1, yb, zb, x0, yb, zb];
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        byBand[ci].push(geo);
      }
    }
    bands.forEach((c, i) => {
      if (!byBand[i].length) return;
      const slope = new THREE.Mesh(mergeGeometries(byBand[i], false), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      slope.receiveShadow = true; group.add(slope); meshes.push(slope);
    });
  }
  if (map.fall && map.fall.haze) {
    const haze = new THREE.Group();
    const hazeMat = (o) => new THREE.MeshBasicMaterial({ color: 0xC9D3DC, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    for (const [yy, op, grow] of [[-18, 0.22, 14], [-27, 0.45, 30]]) {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2 + grow, hz * 2 + grow), hazeMat(op));
      h.rotation.x = -Math.PI / 2; h.position.y = yy; haze.add(h);
    }
    group.add(haze); group.userData.haze = haze;
  }
  if (map.skyline === 'favela') {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(46, 78, 8), toon('#6d8a48')); hill.position.set(86, 6, 58); group.add(hill);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(24, 40, 6), toon('#8d7b68')); rock.position.set(74, 22, 52); group.add(rock);
    const christ = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 0.9), toon('#f4f1ea')); body.position.y = 4.5;
    const arms = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.15, 0.75), toon('#f4f1ea')); arms.position.y = 7.1;
    christ.add(body, arms); christ.position.set(86, 46, 58); group.add(christ);
    for (const [px, pz, sc] of [[-78, -20, 1.3], [-70, 10, 1.1], [90, -30, 1.2], [60, 70, 1], [-40, 68, 1.15]]) {
      const palm = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 7, 6), toon('#6b4423')); tr.position.y = 3.5; palm.add(tr);
      for (let k = 0; k < 6; k++) {
        const fr = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.55), toon('#3e6b32'));
        fr.position.set(Math.cos(k) * 1.1, 6.7, Math.sin(k) * 1.1); fr.rotation.y = k; fr.rotation.z = 0.5; palm.add(fr);
      }
      palm.position.set(px, 0, pz); palm.scale.setScalar(sc); group.add(palm);
    }
  }
  if (pal.mountains) {
    const geo = new THREE.ConeGeometry(18, 46, 5); geo.translate(0, 18, 0);
    const peaks = new THREE.InstancedMesh(geo, toon('#e7eef3'), 9);
    const dummy = new THREE.Object3D();
    const ring = [[-90, -40], [-70, 50], [-20, -100], [40, -90], [100, -30], [80, 60], [10, 100], [-100, 10], [0, -70]];
    ring.forEach(([x, z], i) => { dummy.position.set(x, -8, z); dummy.scale.set(1, 0.7 + (i % 3) * 0.25, 1); dummy.updateMatrix(); peaks.setMatrixAt(i, dummy.matrix); });
    group.add(peaks);
  }
  if (pal.tiles) {
    const [c1, c2, size, count] = pal.tiles, cell = size / count;
    const tex = canvasTex(64, 64, (x) => { x.fillStyle = c1; x.fillRect(0, 0, 64, 64); x.fillStyle = c2; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter; tex.repeat.set(hx * 2 / cell / 2, hz * 2 / cell / 2);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hz * 2), decal(toon(0xffffff, { map: tex }), 1)); t.rotation.x = -Math.PI / 2; t.position.y = 0.01; t.receiveShadow = true; group.add(t);
  }
  // limites do mapa (visual na altura wallH; colisão bem alta)
  const wh = map.wallH || 4, [wc1, wc2] = map.wallColor || ['#e86a5c', '#d85a4c'];
  if (map.fall && map.fall.openSouth) solid(-hx - 1, 0, -hz - 1, hx + 1, WALL_COLLIDE_H, -hz);
  else add(-hx - 1, 0, -hz - 1, hx + 1, wh, -hz, wc1, null, WALL_COLLIDE_H);
  if (map.fall && map.fall.openNorth) solid(-hx - 1, 0, hz, hx + 1, WALL_COLLIDE_H, hz + 1);
  else add(-hx - 1, 0, hz, hx + 1, wh, hz + 1, wc1, null, WALL_COLLIDE_H);
  if (map.fall && map.fall.openWest) solid(-hx - 1, 0, -hz, -hx, WALL_COLLIDE_H, hz);
  else add(-hx - 1, 0, -hz, -hx, wh, hz, wc2, null, WALL_COLLIDE_H);
  if (map.fall && map.fall.openEast) solid(hx, 0, -hz, hx + 1, WALL_COLLIDE_H, hz);
  else add(hx, 0, -hz, hx + 1, wh, hz, wc2, null, WALL_COLLIDE_H);
  // caixas e rampas do mapa
  // caixas e rampas do mapa. Pisos e paredes no mesmo plano saem uns milímetros pra fora só na malha.
  // hide: colisor do penhasco, sem malha.
  const vis = map.boxes.filter((o) => { const [x0, y0, z0, x1, y1, z1] = o.b; return !(x1 - x0 < 0.01 || y1 - y0 < 0.01 || z1 - z0 < 0.01); });
  const shown = vis.filter((o) => !o.hide && !o.flat);
  const voff = visualOffsets(shown);
  for (const o of vis) if (o.hide) {
    const [x0, y0, z0, x1, y1, z1] = o.b;
    solids.push({ min: new V3(x0, y0, z0), max: new V3(x1, y1, z1), ramp: o.ramp || null });
    proxies.push(boxGeo(x0, y0, z0, x1, y1, z1, o.ramp || null));
  }
  for (const o of vis) if (o.flat) {
    const [x0, y0, z0, x1, y1, z1] = o.b;
    const m = new THREE.Mesh(boxGeo(x0, y0, z0, x1, y1, z1, o.ramp || null), new THREE.MeshBasicMaterial({ color: o.c }));
    m.castShadow = m.receiveShadow = true; group.add(m);
    solids.push({ min: new V3(x0, y0, z0), max: new V3(x1, y1, z1), ramp: o.ramp || null });
  }
  shown.forEach((o, i) => { const [x0, y0, z0, x1, y1, z1] = o.b; add(x0, y0, z0, x1, y1, z1, o.c, o.ramp || null, null, voff[i]); });
  for (const p of map.props || []) buildProp(p, { group, solid, add });
  buildPines((map.props || []).filter((p) => p.t === 'pine'), group);
  if (map.weather) { const w = makeWeather(map); group.userData.weather = w; group.add(w.pts); }
  // mescla: uma malha por cor
  for (const [k, list] of byColor) {
    const geo = mergeGeometries(list, false); list.forEach((g) => g.dispose());
    const m = new THREE.Mesh(geo, toon('#' + k)); m.castShadow = m.receiveShadow = true; group.add(m); meshes.push(m);
  }
  if (edges.length) {
    let n = 0; for (const a of edges) n += a.length; const arr = new Float32Array(n); let o = 0; for (const a of edges) { arr.set(a, o); o += a.length; }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(arr, 3)); group.add(new THREE.LineSegments(eg, edgeMat));
  }
  if (proxies.length) { const pm = new THREE.Mesh(mergeGeometries(proxies, false), proxyMat); proxies.forEach((g) => g.dispose()); pm.visible = false; group.add(pm); meshes.push(pm); }
  // céu: nuvens ou estrelas
  if (pal.clouds) {
    const cm = toon(0xffffff);
    for (let i = 0; i < 14; i++) {
      const cl = new THREE.Group();
      for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(rand(3, 5), 12, 10), cm); s.position.set(k * 4 - 6, rand(-1, 1), rand(-2, 2)); cl.add(s); }
      const a = Math.random() * Math.PI * 2, r = ext + rand(35, 75); cl.position.set(Math.cos(a) * r, rand(30, 45), Math.sin(a) * r); cl.scale.y = 0.5; group.add(cl);
    }
  }
  if (pal.stars) {
    const pts = []; for (let i = 0; i < 400; i++) { const a = Math.random() * Math.PI * 2, e = rand(0.15, 1.4); pts.push(Math.cos(a) * Math.cos(e) * 140, Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  }
  const nightLights = [];
  for (const L of pal.lights || []) {
    const [c, x, y, z, i, d, kind] = L;
    const l = new THREE.PointLight(c, i, d, 1.4); l.position.set(x, y, z);
    if (kind) { l.userData.flicker = kind; l.userData.base = i; nightLights.push(l); }
    group.add(l);
  }
  const doors = [];
  for (const d of (map.survival && map.survival.doors) || []) {
    const [x0, y0, z0, x1, y1, z1] = d.block;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), dz = Math.abs(z1 - z0);
    const alongZ = dx < dz;
    const swing = d.swing || 1;
    const g = new THREE.Group();
    g.userData.doorId = d.id;
    if (alongZ) {
      g.position.set((x0 + x1) / 2, (y0 + y1) / 2, swing > 0 ? Math.min(z0, z1) : Math.max(z0, z1));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), toon('#1f6b45'));
      mesh.position.z = swing > 0 ? dz / 2 : -dz / 2; mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
      g.userData.openAngle = swing > 0 ? -1.25 : 1.25;
    } else {
      g.position.set(swing > 0 ? Math.min(x0, x1) : Math.max(x0, x1), (y0 + y1) / 2, (z0 + z1) / 2);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), toon('#1f6b45'));
      mesh.position.x = swing > 0 ? dx / 2 : -dx / 2; mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
      g.userData.openAngle = swing > 0 ? 1.25 : -1.25;
    }
    g.userData.want = 0;
    group.add(g); doors.push(g);
  }
  return { group, solids, meshes, doors, nightLights };
}

// pinheiros instanciados: 2 draw calls para o mapa inteiro (Safari)
function buildPines(list, group) {
  if (!list.length) return;
  const onMap = list.filter((p) => !(p.y < -2));
  if (onMap.length) {
    const trunkG = new THREE.CylinderGeometry(0.22, 0.38, 2.4, 6); trunkG.translate(0, 1.2, 0);
    const fol1 = new THREE.ConeGeometry(1.55, 2.2, 7); fol1.translate(0, 2.5, 0);
    const fol2 = new THREE.ConeGeometry(1.15, 1.8, 7); fol2.translate(0, 3.7, 0);
    const snowG = new THREE.ConeGeometry(0.7, 1.3, 6); snowG.translate(0, 4.7, 0);
    const trunks = new THREE.InstancedMesh(trunkG, toon('#3a2a22'), onMap.length);
    const a1 = new THREE.InstancedMesh(fol1, toon('#2F3A36'), onMap.length);
    const a2 = new THREE.InstancedMesh(fol2, toon('#2F3A36'), onMap.length);
    const caps = new THREE.InstancedMesh(snowG, toon('#E8EDF2'), onMap.length);
    const dummy = new THREE.Object3D();
    onMap.forEach((p, i) => {
      dummy.position.set(p.x, p.y || 0, p.z); dummy.rotation.y = (i * 1.7) % 6; dummy.scale.setScalar(p.s || 1);
      dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); a1.setMatrixAt(i, dummy.matrix); a2.setMatrixAt(i, dummy.matrix); caps.setMatrixAt(i, dummy.matrix);
    });
    for (const m of [trunks, a1, a2, caps]) { m.castShadow = true; m.frustumCulled = false; }
    group.add(trunks, a1, a2, caps);
  }
  // na encosta, árvore própria: o branco da neblina engolia o pinheiro instanciado
  for (const p of list.filter((q) => q.y < -2)) {
    const s = p.s || 1, g = new THREE.Group(), pine = '#2F3A36', snow = '#E8EDF2';
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 2.4, 6), toon('#3a2a22')); trunk.position.y = 1.2; g.add(trunk);
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.2, 7), toon(pine)); c1.position.y = 2.5; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.8, 7), toon(pine)); c2.position.y = 3.7; g.add(c2);
    const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.3, 6), toon(snow)); c3.position.y = 4.7; g.add(c3);
    g.position.set(p.x, p.y, p.z); g.scale.setScalar(s); g.traverse((o) => { o.castShadow = true; }); group.add(g);
  }
}

// neve leve: um Points só, vento na horizontal, flocos param em cima dos telhados
function makeWeather(map) {
  const w = map.weather, n = w.n || 1400, [hx, hz] = map.size;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() * 2 - 1) * hx; pos[i * 3 + 1] = Math.random() * (w.top || 28); pos[i * 3 + 2] = (Math.random() * 2 - 1) * hz; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: w.color || 0xF4F7FA, size: w.size || 0.16, transparent: true, opacity: 0.85, depthWrite: false, fog: true }));
  pts.frustumCulled = false; pts.userData.skipOutline = true;
  return { pts, geo, n, fall: w.fall || 6.5, wind: w.wind || [2, 0, 0.4], top: w.top || 28, hx, hz, roofs: w.roofs || [], t: 0 };
}

export function updateWeather(group, dt) {
  const w = group && group.userData.weather; if (!w || dt <= 0) return;
  if (!w.pts.parent) group.add(w.pts);
  w.t += dt; const gust = 1 + 0.28 * Math.sin(w.t * 0.55);
  const a = w.geo.attributes.position.array, wx = w.wind[0] * gust * dt, wz = w.wind[2] * gust * dt, fy = w.fall * dt;
  for (let i = 0; i < a.length; i += 3) {
    let roofY = -1;
    for (let r = 0; r < w.roofs.length; r++) {
      const R = w.roofs[r];
      if (a[i] > R[0] && a[i] < R[2] && a[i + 2] > R[1] && a[i + 2] < R[3]) { roofY = R[4]; break; }
    }
    if (roofY >= 0 && a[i + 1] <= roofY + 0.35) { a[i] += wx * 0.35; a[i + 2] += wz * 0.35; a[i + 1] = roofY + ((i * 17) % 10) * 0.03; }
    else { a[i] += wx; a[i + 1] -= fy; a[i + 2] += wz; }
    if (a[i + 1] < 0 || a[i] > w.hx || a[i] < -w.hx || a[i + 2] > w.hz || a[i + 2] < -w.hz) {
      a[i] = (Math.random() * 2 - 1) * w.hx; a[i + 1] = w.top * (0.65 + Math.random() * 0.35); a[i + 2] = (Math.random() * 2 - 1) * w.hz;
    }
  }
  w.geo.attributes.position.needsUpdate = true;
}

export function disposeWorld(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) { if (m === edgeMat || m === proxyMat) continue; if (m.map) m.map.dispose(); m.dispose(); }
  });
}

// aplica céu/neblina/luzes numa cena
export function applyPalette(scene, hemi, sun, map) {
  const pal = map.palette, [hx, hz] = map.size, ext = Math.max(hx, hz);
  scene.background = new THREE.Color(pal.sky);
  scene.fog = pal.fogExp ? new THREE.FogExp2(pal.fogExp[0], pal.fogExp[1]) : new THREE.Fog(pal.fog[0], pal.fog[1], pal.fog[2]);
  hemi.color.set(pal.hemi[0]); hemi.groundColor.set(pal.hemi[1]); hemi.intensity = pal.hemi[2];
  sun.color.set(pal.sun[0]); sun.intensity = pal.sun[1];
  // Mapa noturno grande: a sombra do sol cobre o campus inteiro e escurece todo interior.
  sun.castShadow = pal.shadow !== false;
  sun.position.set(ext * 0.8, 50, ext * 0.5); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
  const e = ext + 6; Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 50 + ext * 2.5 }); sun.shadow.camera.updateProjectionMatrix();
}

// miniatura (vista aérea oblíqua) para o seletor de mapas
let thumbRenderer = null;
export function renderThumb(map, w = 320, h = 180) {
  if (!thumbRenderer) { thumbRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
  thumbRenderer.setSize(w, h, false);
  const scene = new THREE.Scene(); const hemi = new THREE.HemisphereLight(); const sun = new THREE.DirectionalLight(); scene.add(hemi, sun, sun.target);
  applyPalette(scene, hemi, sun, map); scene.fog = null; sun.intensity = Math.max(sun.intensity, 1.15);
  if (map.palette.stars) hemi.intensity = map.palette.hemi[2] * 2.2; // noturno: um pouco mais claro na miniatura
  const { group } = buildWorld(map); scene.add(group);
  if (map.id === 'posto-nevasca') {
    // A capa usa o mesmo renderThumb das outras, mas o Natal, os bondinhos e a neve
    // não estão nas caixas do mapa: entram pelo show, parados num instante legível.
    const show = mountNevasca(group, map);
    const t = 3;
    for (let i = 0; i < 2; i++) {
      const p = gondolaPose(t, i);
      show.cabins[i].position.set(p.x, p.y, p.z);
      show.cabins[i].rotation.y = i === 0 ? 0 : Math.PI;
      const e = elevatorPose(t, i);
      show.lifts[i].position.set(e.x, e.y, e.z);
      show.lifts[i].rotation.y = i === 0 ? 0 : Math.PI;
    }
    if (show.sled) show.sled.visible = false;
    if (show.trail) show.trail.visible = false;
    if (show.cloud) show.cloud.visible = false;
    const flakes = group.userData.weather && group.userData.weather.pts;
    if (flakes) { flakes.material.size = 0.55; flakes.material.opacity = 0.92; }
  } else if (group.userData.weather) group.remove(group.userData.weather.pts);
  if (group.userData.haze) group.remove(group.userData.haze);
  const [hx, hz] = map.size, long = Math.max(hx, hz);
  const cam = new THREE.PerspectiveCamera(36, w / h, 1, 600);
  const d = long * 1.55 + 8;
  if (map.thumb) { cam.position.set(map.thumb.x, map.thumb.y, map.thumb.z); cam.lookAt(map.thumb.tx, map.thumb.ty, map.thumb.tz); }
  else if (hz > hx * 1.2) { cam.position.set(d * 0.78, d * 0.72, 0); cam.lookAt(0, 0, 0); }
  else { cam.position.set(0, d * 0.72, d * 0.78); cam.lookAt(0, 0, 0); }
  thumbRenderer.render(scene, cam);
  const url = thumbRenderer.domElement.toDataURL('image/jpeg', 0.85);
  disposeWorld(group);
  return url;
}

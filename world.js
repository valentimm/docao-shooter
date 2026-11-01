// ============================================================
//  Construção do mundo a partir dos dados de maps.js.
//  Caixas/rampas viram UMA malha por cor (geometria mesclada) + UMA malha de contornos,
//  props têm visual próprio e colisão AABB (proxy invisível mesclado para os raycasts).
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { toon, outline, makeCup, canvasTex, drawLogo } from './docao.js';
import { visualOffsets } from './world-offsets.js';
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
    default: console.warn('prop desconhecido', p.t);
  }
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

  // chão
  const ext = Math.max(hx, hz);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2 + 260, ext * 2 + 260), toon(pal.ground)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground); meshes.push(ground);
  if (pal.tiles) {
    const [c1, c2, size, count] = pal.tiles, cell = size / count;
    const tex = canvasTex(64, 64, (x) => { x.fillStyle = c1; x.fillRect(0, 0, 64, 64); x.fillStyle = c2; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter; tex.repeat.set(hx * 2 / cell / 2, hz * 2 / cell / 2);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hz * 2), decal(toon(0xffffff, { map: tex }), 1)); t.rotation.x = -Math.PI / 2; t.position.y = 0.01; t.receiveShadow = true; group.add(t);
  }
  // limites do mapa (visual na altura wallH; colisão bem alta)
  const wh = map.wallH || 4, [wc1, wc2] = map.wallColor || ['#e86a5c', '#d85a4c'];
  add(-hx - 1, 0, -hz - 1, hx + 1, wh, -hz, wc1, null, WALL_COLLIDE_H); add(-hx - 1, 0, hz, hx + 1, wh, hz + 1, wc1, null, WALL_COLLIDE_H);
  add(-hx - 1, 0, -hz, -hx, wh, hz, wc2, null, WALL_COLLIDE_H); add(hx, 0, -hz, hx + 1, wh, hz, wc2, null, WALL_COLLIDE_H);
  // caixas e rampas do mapa
  // caixas e rampas do mapa. Pisos, telhados e paredes que dividem o mesmo plano (laje por cima da parede, faixa no piso…)
  // piscavam (z-fighting): cada face em conflito sai uns milímetros pra fora só na malha.
  const vis = map.boxes.filter((o) => { const [x0, y0, z0, x1, y1, z1] = o.b; return !(x1 - x0 < 0.01 || y1 - y0 < 0.01 || z1 - z0 < 0.01); });
  const voff = visualOffsets(vis);
  vis.forEach((o, i) => { const [x0, y0, z0, x1, y1, z1] = o.b; add(x0, y0, z0, x1, y1, z1, o.c, o.ramp || null, null, voff[i]); });
  for (const p of map.props || []) buildProp(p, { group, solid, add });
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
  for (const [c, x, y, z, i, d] of pal.lights || []) { const l = new THREE.PointLight(c, i, d, 1.4); l.position.set(x, y, z); group.add(l); }
  return { group, solids, meshes };
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
  scene.fog = new THREE.Fog(pal.fog[0], pal.fog[1], pal.fog[2]);
  hemi.color.set(pal.hemi[0]); hemi.groundColor.set(pal.hemi[1]); hemi.intensity = pal.hemi[2];
  sun.color.set(pal.sun[0]); sun.intensity = pal.sun[1];
  sun.position.set(ext * 0.8, 50, ext * 0.5); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
  const e = ext + 6; Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 50 + ext * 2.5 }); sun.shadow.camera.updateProjectionMatrix();
}

// miniatura (vista aérea oblíqua) para o seletor de mapas
let thumbRenderer = null;
export function renderThumb(map, w = 320, h = 180) {
  if (!thumbRenderer) { thumbRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
  thumbRenderer.setSize(w, h, false);
  const scene = new THREE.Scene(); const hemi = new THREE.HemisphereLight(); const sun = new THREE.DirectionalLight(); scene.add(hemi, sun, sun.target);
  applyPalette(scene, hemi, sun, map); scene.fog = null;
  if (map.palette.stars) hemi.intensity = map.palette.hemi[2] * 2.2; // noturno: um pouco mais claro na miniatura
  const { group } = buildWorld(map); scene.add(group);
  const [hx, hz] = map.size, long = Math.max(hx, hz);
  const cam = new THREE.PerspectiveCamera(36, w / h, 1, 600);
  const d = long * 1.55 + 8;
  if (hz > hx * 1.2) cam.position.set(d * 0.78, d * 0.72, 0); else cam.position.set(0, d * 0.72, d * 0.78);
  cam.lookAt(0, 0, 0);
  thumbRenderer.render(scene, cam);
  const url = thumbRenderer.domElement.toDataURL('image/jpeg', 0.85);
  disposeWorld(group);
  return url;
}

// Pintura de skin de arma (caixote). Não mexe na camuflagem de abates: quem equipa skin, a camuflagem da partida espera.
import * as THREE from 'three';
import { toon, outline, canvasTex, drawLogo } from './docao.js';
import { resetWeaponCamo } from './weapon-camo.js';

const TEX = 64;

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paintPixels(ctx, colorAt) {
  const image = ctx.createImageData(TEX, TEX);
  const data = image.data;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const c = colorAt(x, y);
      const i = (y * TEX + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function makeTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  paintPixels(c.getContext('2d'), draw);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return tex;
}

const G1 = rgb('#243018'), G2 = rgb('#3d5228'), G3 = rgb('#5c7340'), G4 = rgb('#1a2412');
const camoTex = makeTex((x, y) => {
  const n = Math.sin(x * 0.55 + y * 0.2) + Math.cos(y * 0.48 - x * 0.15) + Math.sin((x + y) * 0.22);
  if (n > 1.1) return G3;
  if (n > 0.15) return G2;
  if (n > -0.7) return G1;
  return G4;
});

const R1 = rgb('#3e2416'), R2 = rgb('#8a4a28'), R3 = rgb('#c46a32'), R4 = rgb('#d8a15a');
const rustTex = makeTex((x, y) => {
  const n = Math.sin(x * 0.9 + y * 0.35) * Math.cos(y * 0.7 + x * 0.2);
  if (n > 0.45) return R4;
  if (n > 0.05) return R3;
  if (n > -0.35) return R2;
  return R1;
});

const W1 = rgb('#0c3044'), W2 = rgb('#147a92'), W3 = rgb('#2eb8a0'), W4 = rgb('#f4f7f2');
const wavesTex = makeTex((x, y) => {
  const t = (y / TEX + Math.sin(x / 7) * 0.08) % 1;
  const u = t < 0 ? t + 1 : t;
  if (u < 0.12) return W4;
  if (u < 0.4) return W2;
  if (u < 0.62) return W3;
  return W1;
});

const rainbowTex = makeTex((x) => {
  const c = new THREE.Color().setHSL((x / TEX) % 1, 0.82, 0.52);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
});

const O1 = rgb('#0c0c10'), O2 = rgb('#1a1a20'), O3 = rgb('#3a2158'), O4 = rgb('#b388ff');
const obsidianTex = makeTex((x, y) => {
  const n = Math.sin(x * 0.72 + y * 0.18) + Math.cos(y * 0.58 - x * 0.36);
  const vein = (x + y * 2) % 17 < 2;
  if (vein && n > -0.2) return O4;
  if (n > 0.75) return O3;
  if (n > -0.15) return O2;
  return O1;
});

const J1 = rgb('#e2a23c'), J2 = rgb('#c47a22'), J3 = rgb('#1a120c'), J4 = rgb('#f0c56a');
const ONCA = [[10, 14], [30, 8], [48, 18], [16, 34], [38, 30], [54, 40], [8, 52], [28, 50], [46, 54]];
const oncaTex = makeTex((x, y) => {
  for (const [cx, cy] of ONCA) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < 2.6) return J4;
    if (d < 5.1) return J3;
  }
  return Math.sin(x * 0.31) * Math.cos(y * 0.27) > 0 ? J1 : J2;
});

function cheersTex() {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, TEX, TEX);
  g.addColorStop(0, '#ff5a46');
  g.addColorStop(0.42, '#d8261c');
  g.addColorStop(1, '#7a100c');
  x.fillStyle = g;
  x.fillRect(0, 0, TEX, TEX);
  x.fillStyle = '#ffd7cf';
  x.fillRect(0, 0, TEX, 3);
  drawLogo(x, TEX / 2, TEX * 0.56, TEX * 0.42, '#fff6e8', '#4a0c08');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return tex;
}

function gemTex(base, light, dark) {
  const B = rgb(base), L = rgb(light), D = rgb(dark);
  return makeTex((x, y) => {
    const edge = x % 21 < 2 || y % 21 < 2;
    if (edge) return D;
    return ((Math.floor(x / 21) + Math.floor(y / 21)) % 2 === 0) ? L : B;
  });
}
const sapphireTex = gemTex('#1d4ed8', '#d7e6ff', '#0c1c4d');
const emeraldTex = gemTex('#0f9d58', '#d8ffe8', '#084028');
const rubyTex = gemTex('#d0123a', '#ffd0d8', '#4a0818');

function loreTex() {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, TEX, TEX);
  g.addColorStop(0, '#f6e7a8');
  g.addColorStop(0.5, '#e2b34a');
  g.addColorStop(1, '#a56b2f');
  x.fillStyle = g;
  x.fillRect(0, 0, TEX, TEX);
  x.fillStyle = '#1f8f4a';
  for (const [cx, cy, r] of [[14, 18, 7], [34, 12, 5], [48, 28, 8], [22, 40, 6], [40, 48, 7]]) {
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  drawLogo(x, TEX / 2, TEX * 0.62, TEX * 0.28, '#fff6e8', '#4a3010');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return tex;
}

const TEX_OF = { camo: camoTex, rust: rustTex, waves: wavesTex, rainbow: rainbowTex, obsidian: obsidianTex, onca: oncaTex, cheers: cheersTex(), sapphire: sapphireTex, emerald: emeraldTex, ruby: rubyTex, lore: loreTex() };

const ASIIMOV_WHITE = '#f0f2ee', ASIIMOV_ORANGE = '#ff5315', ASIIMOV_DARK = '#20252c';

function asiimovTexture(width, height, base, draw) {
  const texture = canvasTex(width, height, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    const poly = (color, points) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      ctx.fill();
    };
    draw(poly);
  });
  texture.channel = 1;
  return texture;
}

const ASIIMOV_TEXTURES = {
  body: asiimovTexture(512, 128, ASIIMOV_WHITE, (poly) => {
    poly(ASIIMOV_ORANGE, [[0, 0], [136, 0], [86, 128], [0, 128]]);
    poly(ASIIMOV_DARK, [[0, 0], [104, 0], [91, 24], [0, 24]]);
    poly(ASIIMOV_WHITE, [[112, 0], [119, 0], [69, 128], [62, 128]]);
    poly(ASIIMOV_DARK, [[451, 0], [512, 0], [512, 128], [354, 128]]);
    poly(ASIIMOV_WHITE, [[486, 0], [497, 0], [400, 128], [389, 128]]);
    poly(ASIIMOV_ORANGE, [[179, 37], [222, 37], [208, 60], [166, 60]]);
    poly(ASIIMOV_ORANGE, [[236, 37], [273, 37], [252, 71], [215, 71]]);
    poly(ASIIMOV_ORANGE, [[287, 37], [327, 37], [348, 3], [367, 3], [324, 73], [265, 73]]);
    poly(ASIIMOV_DARK, [[148, 85], [185, 85], [160, 105], [138, 105]]);
    poly(ASIIMOV_ORANGE, [[193, 85], [205, 85], [193, 105], [181, 105]]);
  }),
  stock: asiimovTexture(256, 128, ASIIMOV_WHITE, (poly) => {
    poly(ASIIMOV_DARK, [[0, 0], [46, 0], [17, 128], [0, 128]]);
    poly(ASIIMOV_DARK, [[69, 92], [122, 36], [156, 36], [103, 92]]);
    poly(ASIIMOV_DARK, [[116, 92], [169, 36], [186, 36], [133, 92]]);
    poly(ASIIMOV_ORANGE, [[224, 0], [256, 0], [256, 128], [184, 128]]);
  }),
  mag: asiimovTexture(128, 128, ASIIMOV_DARK, (poly) => {
    poly(ASIIMOV_WHITE, [[0, 97], [128, 107], [128, 128], [0, 128]]);
    poly(ASIIMOV_ORANGE, [[0, 104], [128, 114], [128, 128], [0, 128]]);
    poly(ASIIMOV_ORANGE, [[59, 46], [78, 46], [67, 64], [48, 64]]);
  }),
};

// UV separado para a pintura. A coordenada horizontal vai da frente à traseira
// nos dois modelos, inclusive por cima da arma, onde o padrão contorna a quina.
function asiimovUV(geometry, forward) {
  if (geometry.hasAttribute('uv1')) return;
  const { width, height, depth } = geometry.parameters;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new THREE.Float32BufferAttribute(position.count * 2, 2);
  for (let i = 0; i < position.count; i++) {
    const u = 0.5 - forward * position.getZ(i) / depth;
    const v = 0.5 + position.getY(i) / height;
    const top = normal.getY(i) > 0;
    uv.setXY(i, u, top ? 1 - 0.02 * Math.abs(2 * position.getX(i) / width) : v);
  }
  geometry.setAttribute('uv1', uv);
}

function skip(obj) {
  if (!obj) return true;
  if (obj.name === 'red-dot' || obj.name === 'gold-dress' || obj.name === 'lore-dress') return true;
  const u = obj.userData;
  return !!(u && (u.noCamo || u.noPaint || u.isOutline || u.loreBit));
}

function restoreMesh(mesh) {
  const mat = mesh.material;
  if (!mat || !mat.userData || !mat.userData.paintSrc) return;
  mesh.material = mat.userData.paintSrc;
  mat.dispose();
}

function walk(obj, fn) {
  if (!obj || skip(obj)) return;
  if (obj.isMesh) fn(obj);
  const children = obj.children;
  if (!children) return;
  for (let i = 0; i < children.length; i++) walk(children[i], fn);
}

function clearPaint(root) {
  const dress = root.userData && root.userData.goldDress;
  if (dress) { root.remove(dress); root.userData.goldDress = null; }
  walk(root, restoreMesh);
  if (root.userData) root.userData.gunPaint = '';
}

function ownMaterial(mesh) {
  const mat = mesh.material;
  if (!mat || mat.isMeshBasicMaterial || Array.isArray(mat) || !mat.color) return null;
  if (mat.userData && mat.userData.paintOwn) return mat;
  const clone = mat.clone();
  clone.userData = { paintOwn: true, paintSrc: mat };
  mesh.material = clone;
  return clone;
}

function paintMesh(mesh, paint, rifleForward) {
  const mat = ownMaterial(mesh);
  if (!mat) return;
  if (paint === 'asiimov') {
    const texture = ASIIMOV_TEXTURES[mesh.userData.gunPart];
    if (texture) asiimovUV(mesh.geometry, rifleForward);
    mat.color.set(texture ? '#ffffff' : ASIIMOV_DARK);
    mat.map = texture || null;
  } else if (paint === 'gold') {
    mat.color.set('#e8c56b');
    mat.map = null;
    if (mat.emissive && mat.emissive.set) { mat.emissive.set('#c4892a'); mat.emissiveIntensity = 0.38; }
  } else {
    mat.color.set('#ffffff');
    mat.map = TEX_OF[paint];
    if (paint === 'obsidian' && mat.emissive && mat.emissive.set) { mat.emissive.set('#5a2d91'); mat.emissiveIntensity = 0.34; }
    else if (paint === 'cheers' && mat.emissive && mat.emissive.set) { mat.emissive.set('#8a1410'); mat.emissiveIntensity = 0.22; }
    else if (paint === 'sapphire' && mat.emissive && mat.emissive.set) { mat.emissive.set('#3d6dff'); mat.emissiveIntensity = 0.28; }
    else if (paint === 'emerald' && mat.emissive && mat.emissive.set) { mat.emissive.set('#1f8f4a'); mat.emissiveIntensity = 0.28; }
    else if (paint === 'ruby' && mat.emissive && mat.emissive.set) { mat.emissive.set('#d0123a'); mat.emissiveIntensity = 0.28; }
    else if (paint === 'lore' && mat.emissive && mat.emissive.set) { mat.emissive.set('#c4892a'); mat.emissiveIntensity = 0.3; }
    else if (mat.emissive && mat.emissive.set) { mat.emissive.set('#000000'); mat.emissiveIntensity = 0.06; }
  }
  mat.needsUpdate = true;
}

function goldMark() {
  const tex = canvasTex(64, 64, (x, W, H) => {
    x.fillStyle = '#f3d78a';
    x.beginPath();
    x.roundRect(2, 2, W - 4, H - 4, 10);
    x.fill();
    drawLogo(x, W / 2, H / 2, H * 0.55, '#8a1420');
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  plate.userData.noPaint = true;
  return plate;
}

function addGoldDress(group) {
  const dress = new THREE.Group();
  dress.name = 'gold-dress';
  dress.userData.noPaint = true;
  const gold = toon('#f3d78a'), skin = toon('#f7a531'), snoutC = toon('#f58a6e'), nose = toon('#3a0806');
  const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); dress.add(mesh); outline(mesh, 0.003); return mesh; };
  const disc = put(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.01, 14), gold), -0.062, 0.01, -0.06);
  disc.rotation.z = Math.PI / 2;
  const pig = put(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.014, 12), snoutC), -0.072, 0.01, -0.06);
  pig.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) put(new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), nose), -0.08, s * 0.008, -0.06);
  for (const s of [-1, 1]) {
    const ear = put(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), skin), -0.068, 0.04, -0.06 + s * 0.018);
    ear.scale.set(0.45, 1.3, 0.7);
  }
  const plate = goldMark();
  plate.position.set(-0.076, 0.0, 0.04);
  plate.rotation.y = -Math.PI / 2;
  dress.add(plate);
  group.add(dress);
  return dress;
}

export function applyGunPaint(root, paint) {
  if (!root) return;
  const rifleForward = root.userData.rifleForward;
  const next = paint === 'gold' || TEX_OF[paint] || (paint === 'asiimov' && rifleForward) ? paint : '';
  if ((root.userData.gunPaint || '') === next && (next !== 'gold' || root.userData.goldDress)) return;
  clearPaint(root);
  resetWeaponCamo(root);
  root.userData.gunPaint = next;
  if (!next) return;
  walk(root, (o) => paintMesh(o, next, rifleForward));
  if (next === 'gold') root.userData.goldDress = addGoldDress(root);
}

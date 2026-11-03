// Máquinas do Survival. Partes que precisam aparecer no escuro (Halloween, Safari)
// usam cor chapada, sem depender da luz do mapa. A Papada e a barraca ainda têm luz própria.
import * as THREE from 'three';

const flat = (hex, opacity = 1) => new THREE.MeshBasicMaterial({
  color: hex, transparent: opacity < 1, opacity, depthWrite: opacity >= 0.9, fog: false,
});
const basic = flat;
const toon = (hex) => new THREE.MeshToonMaterial({ color: hex });
function box(w, h, d, mat, x, y, z) {
  return add(new THREE.Group(), new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}

function add(g, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

function sign(text, fg, bg, cw = 512, ch = 160) {
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, cw, ch);
  x.strokeStyle = fg; x.lineWidth = 14; x.strokeRect(10, 10, cw - 20, ch - 20);
  x.fillStyle = fg;
  x.font = `900 ${Math.floor(ch * 0.42)}px Fredoka, Arial Black, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = String(text).split('\n');
  lines.forEach((line, i) => x.fillText(line, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * ch * 0.38));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.42), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false }));
  return m;
}

function beam(color, h = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.55, h, 10, 1, true), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
  }));
  m.position.y = h / 2;
  return m;
}

// Origem no chão. Máquina alta, laranja, com facho.
export function makePapada() {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(2.5, 1.7, 1.35), toon(0x6a2a14), 0, 1.05, 0);
  add(g, new THREE.BoxGeometry(2.7, 0.22, 1.5), flat(0xfff0c8), 0, 1.95, 0);
  add(g, new THREE.BoxGeometry(2.15, 0.7, 0.12), flat(0xff5a12), 0, 1.15, 0.7);
  const mouth = add(g, new THREE.BoxGeometry(1.5, 0.42, 0.08), flat(0xffd24a), 0, 1.05, 0.76);
  add(g, new THREE.BoxGeometry(0.18, 1.15, 0.18), toon(0x2a1810), -1.05, 0.58, 0.5);
  add(g, new THREE.BoxGeometry(0.18, 1.15, 0.18), toon(0x2a1810), 1.05, 0.58, 0.5);
  add(g, new THREE.BoxGeometry(0.18, 1.15, 0.18), toon(0x2a1810), -1.05, 0.58, -0.5);
  add(g, new THREE.BoxGeometry(0.18, 1.15, 0.18), toon(0x2a1810), 1.05, 0.58, -0.5);
  const plaque = sign('PAPADA', '#3a1608', '#ffb03a');
  plaque.position.set(0, 2.45, 0.2); plaque.scale.set(1.35, 1.35, 1); g.add(plaque);
  const glow = new THREE.PointLight(0xff6a1a, 6, 16, 1.4);
  glow.position.set(0, 2.1, 0.8); g.add(glow);
  const b = beam(0xff7a18, 16); b.position.y = 8; g.add(b);
  g.userData.mouth = mouth; g.userData.glow = glow; g.userData.kind = 'papada';
  return g;
}

export function makeMysteryBox() {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(1.7, 1.25, 1.7), toon(0xc47a2a), 0, 0.75, 0);
  add(g, new THREE.BoxGeometry(1.85, 0.16, 1.85), flat(0xffe08a), 0, 1.42, 0);
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
    const bulb = add(g, new THREE.SphereGeometry(0.1, 10, 8), flat(0xfff6c8), x, 1.58, z);
    bulb.userData.bulb = true;
  }
  const mark = sign('?', '#fff8e4', '#7a220c', 256, 256);
  mark.scale.set(0.7, 2.2, 1); mark.position.set(0, 2.15, 0); g.add(mark);
  const glow = new THREE.PointLight(0xffc14a, 5, 14, 1.4);
  glow.position.set(0, 2.2, 0); g.add(glow);
  const b = beam(0xffd24a, 14); b.position.y = 7.2; g.add(b);
  g.userData.glow = glow; g.userData.kind = 'box';
  return g;
}

// Origem no contato com a parede, na altura do peito. +X sai da parede (a normal).
export function makeWallGun(name, price) {
  const g = new THREE.Group();
  const board = add(g, new THREE.BoxGeometry(0.06, 0.95, 1.45), toon(0x5c3a22), 0.04, 0, 0);
  // contorno de giz, um pouco maior que a tábua
  const chalk = flat(0xfff6d2);
  add(g, new THREE.BoxGeometry(0.02, 0.06, 1.6), chalk, 0.09, 0.5, 0);
  add(g, new THREE.BoxGeometry(0.02, 0.06, 1.6), chalk, 0.09, -0.5, 0);
  add(g, new THREE.BoxGeometry(0.02, 1.06, 0.06), chalk, 0.09, 0, 0.77);
  add(g, new THREE.BoxGeometry(0.02, 1.06, 0.06), chalk, 0.09, 0, -0.77);
  const metal = flat(0xe8eef6);
  // silhueta no plano da parede (olhando de frente se vê o perfil, não o canto)
  add(g, new THREE.BoxGeometry(0.08, 0.2, 1.05), metal, 0.14, 0.02, -0.05);
  add(g, new THREE.BoxGeometry(0.08, 0.1, 0.55), flat(0x2a2a32), 0.18, 0.12, -0.55);
  add(g, new THREE.BoxGeometry(0.08, 0.32, 0.16), toon(0x6b4224), 0.14, -0.22, 0.38);
  const label = sign(`${name}\n${price}`, '#3a2414', '#fff0c4', 512, 220);
  label.rotation.y = Math.PI / 2;
  label.position.set(0.16, 0.72, 0); label.scale.set(0.95, 0.85, 1); g.add(label);
  const glow = new THREE.PointLight(0xffe08a, 1.8, 5, 1.6);
  glow.position.set(0.35, 0.2, 0); g.add(glow);
  g.userData.board = board; g.userData.kind = 'wall';
  return g;
}

export function makeRayOffer() {
  const g = new THREE.Group();
  g.add(box(0.16, 0.14, 0.42, toon(0x24302a), 0, 1.45, 0));
  g.add(box(0.18, 0.05, 0.16, toon(0xc45a2a), 0, 1.54, 0.02));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), basic(0x39ff6a));
  core.position.set(0, 1.48, -0.08); g.add(core);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 10), toon(0x141a16));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.48, -0.28); g.add(barrel);
  const dish = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 16), basic(0x7dff6a));
  dish.position.set(0, 1.48, -0.4); g.add(dish);
  const lamp = new THREE.PointLight(0x39ff6a, 1.2, 3.2);
  lamp.position.set(0, 1.55, -0.2); g.add(lamp);
  g.userData.kind = 'offer'; g.userData.ray = true;
  return g;
}

export function makeOfferGun() {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(0.18, 0.2, 0.95), flat(0xffe08a), 0, 1.7, 0);
  add(g, new THREE.BoxGeometry(0.1, 0.1, 0.5), flat(0xfff8e0), 0, 1.82, -0.5);
  g.userData.kind = 'offer';
  return g;
}

export function tickStation(mesh, t, phase) {
  const u = mesh.userData;
  if (!u) return;
  if (u.kind === 'papada' && u.mouth) {
    const k = 0.75 + Math.sin(t * 7) * 0.25;
    u.mouth.material.opacity = k;
    if (u.glow) u.glow.intensity = 4.5 + k * 3;
  }
  if (u.kind === 'box') {
    mesh.rotation.y = Math.sin(t * 0.6) * 0.05;
    if (u.glow) u.glow.intensity = phase && phase !== 'idle' ? 8 : 4 + Math.sin(t * 4) * 1.2;
  }
  if (u.kind === 'offer') mesh.rotation.y = t * 1.6;
}

// Snipers em 1ª pessoa: Torresmo, Canhão do Barril e Carabina da Granja.
// Escala local da sniper atual (o root do jogo aplica 0.62 depois). Cano em −Z.
import * as THREE from 'three';
import { outline, toon, drawLogo } from './docao.js';

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();

const SKIN = '#ee9c22';
const HAND_R = 0.09;
const BOLT_UP = 1.3;
const BOLT_PULL = 0.16;
const GRAB_X = 0.07;

function mesh(parent, geo, mat, x, y, z, ol = 0.006, part = '') {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (part) m.userData.gunPart = part;
  parent.add(m);
  if (ol) outline(m, ol);
  return m;
}

function glass(color) {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
}

function smooth(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

function span(ak, a, b) {
  return smooth((ak - a) / (b - a));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function addScope(parent, s) {
  const tube = mesh(parent, new THREE.CylinderGeometry(s.r, s.r, s.len, 14), toon(s.color), 0, s.y, s.z, 0.006, 'scope');
  tube.rotation.x = Math.PI / 2;
  const bell = mesh(parent, new THREE.CylinderGeometry(s.bellR, s.r * 1.02, s.bellLen, 14), toon(s.color), 0, s.y, s.bellZ, 0.006, 'scope');
  bell.rotation.x = Math.PI / 2;
  const eye = mesh(parent, new THREE.CylinderGeometry(s.eyeR, s.r * 1.02, s.eyeLen, 14), toon(s.color), 0, s.y, s.eyeZ, 0.006, 'scope');
  eye.rotation.x = Math.PI / 2;
  const lens = glass(s.lens);
  const front = mesh(parent, new THREE.CircleGeometry(s.bellR * 0.78, 18), lens, 0, s.y, s.bellZ - s.bellLen * 0.5 - 0.002, 0, 'lens');
  front.rotation.y = Math.PI;
  mesh(parent, new THREE.CircleGeometry(s.eyeR * 0.72, 18), lens, 0, s.y, s.eyeZ + s.eyeLen * 0.5 + 0.002, 0, 'lens');
  for (const z of s.mounts) {
    mesh(parent, new THREE.BoxGeometry(s.mountW, s.mountH, s.mountD), toon('#22252c'), 0, s.y - s.r - s.mountH * 0.35, z, 0.004, 'mount');
  }
}

function addBarrel(parent, b) {
  const bar = mesh(parent, new THREE.CylinderGeometry(b.r0, b.r1, b.len, 14), toon(b.color), 0, b.y, b.z, 0.006, 'barrel');
  bar.rotation.x = Math.PI / 2;
  if (b.flare) {
    // rotation.x = 90° manda o raio de baixo (−Y) para −Z, a boca.
    const flare = mesh(parent, new THREE.CylinderGeometry(b.flare.rIn, b.flare.rOut, b.flare.len, 16), toon(b.color), 0, b.y, b.flare.z, 0.006, 'barrel');
    flare.rotation.x = Math.PI / 2;
  }
  if (b.muzzle) {
    mesh(parent, new THREE.BoxGeometry(b.muzzle.w, b.muzzle.h, b.muzzle.d), toon(b.color), 0, b.y, b.muzzle.z, 0.006, 'barrel');
  }
}

function makeBolt(parent, b) {
  const bolt = new THREE.Group();
  bolt.position.set(b.x, b.y, b.z);
  const shaft = mesh(bolt, new THREE.CylinderGeometry(b.leverR * 1.2, b.leverR * 1.2, 0.18, 8), toon('#aeb4be'), 0, 0, 0.01, 0.004, 'bolt');
  shaft.rotation.x = Math.PI / 2;
  const lever = mesh(bolt, new THREE.CylinderGeometry(b.leverR, b.leverR, b.lever, 8), toon('#c8ccd4'), b.lever / 2, 0, 0, 0.004, 'bolt');
  lever.rotation.z = Math.PI / 2;
  const knobX = b.lever + b.knob * 0.3;
  mesh(bolt, new THREE.SphereGeometry(b.knob, 12, 10), toon(b.knobColor), knobX, 0, 0, 0.004, 'knob');
  parent.add(bolt);
  return { bolt, knobX };
}

function makeBoltHand(shoulder) {
  const g = new THREE.Group();
  const skin = toon(SKIN);
  const armLen = 0.5;
  const arm = mesh(g, new THREE.CylinderGeometry(0.062, 0.046, armLen, 12), skin, 0, 0, 0, 0.006);
  const fist = mesh(g, new THREE.SphereGeometry(HAND_R, 18, 14), skin, 0, 0, 0, 0.007);
  fist.scale.set(1.08, 0.9, 1.14);
  const thumb = mesh(g, new THREE.CapsuleGeometry(0.032, 0.05, 4, 8), skin, 0.02, 0.062, 0.03, 0.005);
  thumb.rotation.set(1.05, 0.2, 0.4);
  g.userData.arm = arm;
  g.userData.armLen = armLen;
  g.userData.handR = HAND_R;
  g.userData.shoulder = shoulder;
  g.visible = true;
  return g;
}

function aimArm(hand) {
  const arm = hand.userData.arm;
  _q.copy(hand.quaternion).invert();
  _dir.copy(hand.userData.shoulder).sub(hand.position).applyQuaternion(_q);
  const len = _dir.length();
  if (len < 1e-4) return;
  _dir.multiplyScalar(1 / len);
  const handR = hand.userData.handR;
  const reach = Math.max(0.16, len - handR * 0.75);
  const mid = handR * 0.45 + reach * 0.5;
  if (_dir.dot(UP) > 0.999) _q.identity();
  else _q.setFromUnitVectors(UP, _dir);
  arm.quaternion.copy(_q);
  arm.position.copy(_dir).multiplyScalar(mid);
  arm.scale.set(1, reach / hand.userData.armLen, 1);
}

const SPECS = {
  torresmo: {
    body: { w: 0.1, h: 0.12, d: 0.66, color: '#5c7a3a', y: 0, z: -0.08 },
    barrel: { r0: 0.022, r1: 0.026, len: 0.62, color: '#22252c', y: 0.015, z: -0.7, muzzle: { w: 0.06, h: 0.05, d: 0.08, z: -1.02 } },
    stock: { w: 0.1, h: 0.17, d: 0.34, color: '#4a6a2e', y: -0.035, z: 0.36, rx: -0.1 },
    grip: { w: 0.075, h: 0.2, d: 0.1, color: '#e63946', y: -0.15, z: 0.1, rx: 0.25 },
    scope: {
      r: 0.045, len: 0.34, color: '#2a2d35', y: 0.13, z: -0.08,
      bellR: 0.06, bellLen: 0.07, bellZ: -0.27,
      eyeR: 0.052, eyeLen: 0.06, eyeZ: 0.11,
      lens: '#7DF9FF', mounts: [-0.16, 0], mountW: 0.04, mountH: 0.07, mountD: 0.04,
    },
    bolt: { x: 0.055, y: 0.03, z: 0.12, lever: 0.09, leverR: 0.012, knob: 0.025, knobColor: '#e63946' },
    hand: { x: 0.04, y: -0.18, z: 0.17 },
    handRot: { x: 0.55, y: 0.15, z: 0.85 },
    shoulder: new THREE.Vector3(0.28, -0.5, 0.55),
  },
  canhao: {
    body: { w: 0.17, h: 0.18, d: 0.98, color: '#2a2e36', y: -0.01, z: -0.1 },
    barrel: {
      r0: 0.042, r1: 0.052, len: 0.9, color: '#16181e', y: 0.02, z: -1.02,
      flare: { rIn: 0.052, rOut: 0.095, len: 0.18, z: -1.54 },
    },
    stock: { w: 0.15, h: 0.24, d: 0.48, color: '#12141a', y: -0.04, z: 0.6, rx: -0.08 },
    grip: { w: 0.095, h: 0.26, d: 0.13, color: '#0e1016', y: -0.22, z: 0.24, rx: 0.2 },
    scope: {
      r: 0.098, len: 0.6, color: '#0e1016', y: 0.27, z: -0.02,
      bellR: 0.132, bellLen: 0.13, bellZ: -0.4,
      eyeR: 0.11, eyeLen: 0.11, eyeZ: 0.34,
      lens: '#f0a020', mounts: [-0.24, 0.1], mountW: 0.07, mountH: 0.14, mountD: 0.07,
    },
    extras: [{ w: 0.11, h: 0.14, d: 0.24, color: '#1a1c22', y: -0.15, z: -0.02 }],
    bolt: { x: 0.108, y: 0.05, z: 0.2, lever: 0.12, leverR: 0.016, knob: 0.036, knobColor: '#e8ecf2' },
    hand: { x: 0.06, y: -0.24, z: 0.32 },
    handRot: { x: 0.5, y: 0.12, z: 0.8 },
    shoulder: new THREE.Vector3(0.34, -0.52, 0.64),
  },
  carabina: {
    body: { w: 0.066, h: 0.08, d: 0.4, color: '#e6c48e', y: 0, z: 0 },
    barrel: { r0: 0.012, r1: 0.016, len: 0.38, color: '#6b5436', y: 0.01, z: -0.38, muzzle: { w: 0.032, h: 0.026, d: 0.04, z: -0.59 } },
    stock: { w: 0.064, h: 0.11, d: 0.22, color: '#d0a56c', y: -0.015, z: 0.26, rx: -0.14 },
    grip: { w: 0.048, h: 0.12, d: 0.06, color: '#b88850', y: -0.095, z: 0.07, rx: 0.34 },
    scope: {
      r: 0.022, len: 0.12, color: '#2a2d35', y: 0.068, z: 0,
      bellR: 0.03, bellLen: 0.028, bellZ: -0.08,
      eyeR: 0.026, eyeLen: 0.026, eyeZ: 0.07,
      lens: '#f4fbff', mounts: [-0.02], mountW: 0.026, mountH: 0.036, mountD: 0.026,
    },
    bolt: { x: 0.046, y: 0.026, z: 0.06, lever: 0.068, leverR: 0.009, knob: 0.018, knobColor: '#f3ead8' },
    hand: { x: 0.028, y: -0.12, z: 0.11 },
    handRot: { x: 0.5, y: 0.15, z: 0.8 },
    shoulder: new THREE.Vector3(0.26, -0.48, 0.5),
  },
};

export function makeFPSniper(kind) {
  const spec = SPECS[kind] || SPECS.torresmo;
  const g = new THREE.Group();
  g.name = `fp-${SPECS[kind] ? kind : 'torresmo'}`;
  g.userData.muzzle = -1;
  const body = spec.body;
  mesh(g, new THREE.BoxGeometry(body.w, body.h, body.d), toon(body.color), 0, body.y, body.z, 0.006, 'body');
  addBarrel(g, spec.barrel);
  const stock = mesh(g, new THREE.BoxGeometry(spec.stock.w, spec.stock.h, spec.stock.d), toon(spec.stock.color), 0, spec.stock.y, spec.stock.z, 0.006, 'stock');
  stock.rotation.x = spec.stock.rx;
  const grip = mesh(g, new THREE.BoxGeometry(spec.grip.w, spec.grip.h, spec.grip.d), toon(spec.grip.color), 0, spec.grip.y, spec.grip.z, 0.006, 'grip');
  grip.rotation.x = spec.grip.rx;
  addScope(g, spec.scope);
  for (const p of spec.extras || []) mesh(g, new THREE.BoxGeometry(p.w, p.h, p.d), toon(p.color), 0, p.y, p.z, 0.005);
  const { bolt, knobX } = makeBolt(g, spec.bolt);
  const hand = makeBoltHand(spec.shoulder);
  g.add(hand);
  g.userData.kind = SPECS[kind] ? kind : 'torresmo';
  g.userData.boltPart = bolt;
  g.userData.boltHand = hand;
  g.userData.boltRest = { x: spec.bolt.x, y: spec.bolt.y, z: spec.bolt.z };
  g.userData.knobX = knobX;
  g.userData.grip = spec.hand;
  g.userData.gripRot = spec.handRot;
  poseSniperBolt(g, 0);
  return g;
}

function grabOf(rest, knobX, rotZ, z) {
  const c = Math.cos(rotZ), s = Math.sin(rotZ);
  return {
    x: rest.x + knobX * c + GRAB_X,
    y: rest.y + knobX * s - 0.01,
    z: z + 0.035,
  };
}

export function poseSniperBolt(group, ak) {
  const t = Number.isFinite(ak) ? Math.min(1, Math.max(0, ak)) : 0;
  const bolt = group.userData.boltPart;
  const hand = group.userData.boltHand;
  const rest = group.userData.boltRest;
  const grip = group.userData.grip;
  const gripRot = group.userData.gripRot;
  const knobX = group.userData.knobX;

  const lift = span(t, 0.12, 0.32);
  const pull = span(t, 0.32, 0.58);
  const push = span(t, 0.58, 0.82);
  const shut = span(t, 0.82, 0.93);
  const drop = span(t, 0.93, 1);
  const reach = span(t, 0, 0.12);

  let rotZ = BOLT_UP * lift;
  if (t >= 0.82) rotZ = BOLT_UP * (1 - shut);

  let z = rest.z;
  if (t >= 0.32 && t < 0.58) z = rest.z + BOLT_PULL * pull;
  else if (t >= 0.58 && t < 0.82) z = rest.z + BOLT_PULL * (1 - push);

  bolt.position.set(rest.x, rest.y, z);
  bolt.rotation.set(0, 0, rotZ);

  const grab = grabOf(rest, knobX, rotZ, z);
  const holdZ = 0.35 + rotZ;
  let px, py, pz, rx, ry, rz;
  if (t < 0.12) {
    px = lerp(grip.x, grab.x, reach);
    py = lerp(grip.y, grab.y, reach);
    pz = lerp(grip.z, grab.z, reach);
    rx = lerp(gripRot.x, 0.25, reach);
    ry = lerp(gripRot.y, -0.15, reach);
    rz = lerp(gripRot.z, holdZ, reach);
  } else if (t < 0.93) {
    px = grab.x; py = grab.y; pz = grab.z;
    rx = 0.25; ry = -0.15; rz = holdZ;
  } else {
    px = lerp(grab.x, grip.x, drop);
    py = lerp(grab.y, grip.y, drop);
    pz = lerp(grab.z, grip.z, drop);
    rx = lerp(0.25, gripRot.x, drop);
    ry = lerp(-0.15, gripRot.y, drop);
    rz = lerp(holdZ, gripRot.z, drop);
  }
  hand.position.set(px, py, pz);
  hand.rotation.set(rx, ry, rz);
  aimArm(hand);
}

// A Docão Lore: ouro e dragão no jeito da Dragon Lore, mais focinho, orelha e o C! do Docão.
const LORE_PAINT = {
  body: '#e2b34a', stock: '#a56b2f', grip: '#8f1d22', barrel: '#3a2c1c',
  scope: '#14382c', lens: '#2f9d5a', mount: '#d4af37', bolt: '#f0d78a', knob: '#f7a531',
};

function eachGunPart(group, fn) {
  group.traverse((o) => {
    if (!o.isMesh || (o.userData && o.userData.isOutline) || !o.userData.gunPart) return;
    if (!o.material || !o.material.color) return;
    fn(o);
  });
}

function dropDress(group) {
  const dress = group.userData.loreDress;
  if (!dress) return;
  group.remove(dress);
  const mats = new Set();
  dress.traverse((o) => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.isMesh && o.material && !mats.has(o.material)) {
      mats.add(o.material);
      if (o.material.map && o.material.map.dispose) o.material.map.dispose();
      if (o.material.dispose) o.material.dispose();
    }
  });
  group.userData.loreDress = null;
}

function loreMark() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#d8261c';
  x.beginPath(); x.roundRect(2, 2, 60, 60, 12); x.fill();
  drawLogo(x, 30, 34, 28, '#fff0cc');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  plate.userData.loreBit = true;
  return plate;
}

function addLoreDress(group) {
  const f = group.userData.muzzle || -1;
  const zOf = (u) => f * u; // u > 0 aponta pra boca, nos dois modelos
  const dress = new THREE.Group();
  dress.name = 'lore-dress';
  const gold = toon('#f3d78a');
  const emerald = toon('#1f8f4a');
  const deep = toon('#0e5a32');
  const snoutC = toon('#f58a6e');
  const skin = toon('#f7a531');
  const earIn = toon('#e8682a');
  const nose = toon('#3a0806');
  const eyeC = toon('#d8261c');
  const side = -0.078; // lateral esquerda: a que aparece ao lado da mira
  for (const u of [-0.06, 0.06, 0.18, 0.3]) {
    const i = u > 0.1 ? 1 : 0;
    const seg = mesh(dress, new THREE.SphereGeometry(0.036, 10, 8), i ? emerald : deep, side, 0.018 + (u > 0 ? 0.01 : 0), zOf(u), 0);
    seg.scale.set(0.82, 0.68, 1.4);
    const spike = mesh(dress, new THREE.ConeGeometry(0.008, 0.028, 5), gold, side - 0.01, 0.05, zOf(u), 0);
    spike.rotation.z = 0.7;
  }
  const headU = 0.4;
  const head = mesh(dress, new THREE.SphereGeometry(0.05, 12, 10), emerald, side - 0.008, 0.04, zOf(headU), 0);
  head.scale.set(0.95, 0.72, 1.2);
  const jaw = mesh(dress, new THREE.ConeGeometry(0.02, 0.062, 8), deep, side - 0.008, 0.028, zOf(headU + 0.05), 0);
  jaw.rotation.x = f > 0 ? -Math.PI / 2 : Math.PI / 2;
  for (const s of [-1, 1]) {
    const horn = mesh(dress, new THREE.ConeGeometry(0.009, 0.052, 6), gold, side + s * 0.016, 0.088, zOf(headU - 0.01), 0);
    horn.rotation.z = s * -0.35;
    horn.rotation.x = f > 0 ? 0.35 : -0.35;
  }
  mesh(dress, new THREE.SphereGeometry(0.009, 8, 6), eyeC, side - 0.038, 0.052, zOf(headU + 0.012), 0);
  const wing = mesh(dress, new THREE.SphereGeometry(0.038, 8, 6), emerald, side - 0.04, 0.07, zOf(headU - 0.04), 0);
  wing.scale.set(1.7, 0.28, 0.75);
  wing.rotation.z = 0.8;
  const wing2 = mesh(dress, new THREE.SphereGeometry(0.026, 8, 6), deep, side - 0.02, 0.055, zOf(headU - 0.08), 0);
  wing2.scale.set(1.4, 0.3, 0.6);
  wing2.rotation.z = 0.4;
  for (const u of [0.55, 0.72, 0.88]) {
    const ring = mesh(dress, new THREE.TorusGeometry(0.034, 0.006, 6, 14), gold, 0, 0.018, zOf(u), 0);
    ring.rotation.y = Math.PI / 2;
  }
  // Focinho e orelha na face da coronha que a mira enxerga, mais o rabinho.
  const cheekZ = zOf(-0.34);
  const disc = mesh(dress, new THREE.CylinderGeometry(0.05, 0.05, 0.012, 16), gold, side + 0.01, 0.0, cheekZ, 0);
  disc.rotation.z = Math.PI / 2;
  const pig = mesh(dress, new THREE.CylinderGeometry(0.034, 0.036, 0.02, 14), snoutC, side - 0.008, 0.0, cheekZ, 0);
  pig.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) mesh(dress, new THREE.SphereGeometry(0.008, 8, 6), nose, side - 0.02, s * 0.01, cheekZ + f * 0.006, 0);
  for (const s of [-1, 1]) {
    const ear = mesh(dress, new THREE.SphereGeometry(0.024, 8, 6), skin, side - 0.01, 0.055, cheekZ + s * 0.03, 0);
    ear.scale.set(0.45, 1.4, 0.7);
    const inner = mesh(dress, new THREE.SphereGeometry(0.012, 8, 6), earIn, side - 0.02, 0.06, cheekZ + s * 0.03, 0);
    inner.scale.set(0.3, 0.9, 0.45);
  }
  const tail = mesh(dress, new THREE.TorusGeometry(0.022, 0.006, 6, 12, Math.PI * 1.6), skin, side - 0.01, 0.02, zOf(-0.16), 0);
  tail.rotation.x = Math.PI / 2;
  const plate = loreMark();
  plate.scale.setScalar(1.8);
  plate.position.set(side - 0.02, 0.01, zOf(-0.2));
  plate.rotation.y = -Math.PI / 2;
  dress.add(plate);
  group.add(dress);
  return dress;
}

export function applySniperSkin(group, kind) {
  if (!group) return;
  const next = kind === 'lore' ? 'lore' : '';
  if ((group.userData.sniperSkin || '') === next && (next !== 'lore' || group.userData.loreDress)) return;
  eachGunPart(group, (o) => {
    const base = o.material.userData && o.material.userData.loreHex;
    if (base != null) o.material.color.setHex(base);
  });
  dropDress(group);
  group.userData.sniperSkin = next;
  if (!next) return;
  eachGunPart(group, (o) => {
    if (!o.material.userData) o.material.userData = {};
    if (o.material.userData.loreHex == null) o.material.userData.loreHex = o.material.color.getHex();
    const hex = LORE_PAINT[o.userData.gunPart];
    if (hex) o.material.color.set(hex);
  });
  group.userData.loreDress = addLoreDress(group);
}

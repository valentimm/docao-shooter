// Visual dos cheats CJ05 / LGPD / BIG. Malha low-poly, sem arquivo externo.
// O tanque fica na cena (não é filho do Docão): o Docão encolhe e sobe para a escotilha.
// O jetpack é filho do modelo, nas costas. O BIG só escala o grupo.
import * as THREE from 'three';
import { toon } from './docao.js';
import { BIG } from './shared/gta-cheats.js';
import { stanceScale } from './shared/stance.js';

const box = (w, h, d, color, parent) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};

export function makeTank() {
  const g = new THREE.Group();
  const hull = box(0.92, 0.52, 1.45, '#5d6b3a', g); hull.position.set(0, 0.5, 0.05);
  const stripe = box(0.94, 0.08, 1.2, '#e2c14a', g); stripe.position.set(0, 0.62, 0.02);
  for (const s of [-1, 1]) {
    const track = box(0.22, 0.32, 1.62, '#2a2a28', g); track.position.set(s * 0.56, 0.22, 0);
    for (let i = -3; i <= 3; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 8), toon('#1a1a18'));
      wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 0.66, 0.16, i * 0.2); g.add(wheel);
    }
  }
  const turret = box(0.62, 0.36, 0.62, '#6d7a48', g); turret.position.set(0, 0.9, -0.02);
  const hatch = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 10), toon('#3e4a28'));
  hatch.rotation.x = Math.PI / 2; hatch.position.set(0, 1.1, -0.02); g.add(hatch);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.15, 8), toon('#3a3f34'));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.92, 0.85); g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), toon('#22261e'));
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.92, 1.4); g.add(muzzle);
  g.userData.barrel = barrel;
  return g;
}

export function makeJetpack() {
  const g = new THREE.Group();
  const back = box(0.36, 0.42, 0.18, '#4a5560', g); back.position.set(0, 0, 0);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.9, depthWrite: false });
  const flames = [];
  for (const s of [-1, 1]) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 6), toon('#2c3136'));
    noz.position.set(s * 0.1, -0.26, 0); g.add(noz);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 6), flameMat);
    flame.rotation.x = Math.PI; flame.position.set(s * 0.1, -0.48, 0); flame.visible = false; g.add(flame);
    flames.push(flame);
  }
  g.userData.flames = flames;
  g.visible = false;
  return g;
}

function ensureJet(model) {
  if (!model || !model.group) return null;
  if (model.jetpack) return model.jetpack;
  const j = makeJetpack();
  j.position.set(0, 0.95, -0.5);
  model.group.add(j);
  model.jetpack = j;
  return j;
}

function ensureTank(e, scene) {
  if (e.tankView) return e.tankView;
  const t = makeTank(); t.visible = false; scene.add(t); e.tankView = t; return t;
}

export function hideGta(e) {
  if (e && e.tankView) e.tankView.visible = false;
  const j = e && e.model && e.model.jetpack;
  if (j) j.visible = false;
  if (e && e.subidoView) e.subidoView.visible = false;
}

function ensureHaze(e) {
  if (e.subidoView) return e.subidoView;
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x3dff6a, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending });
  const spots = [[0, 1.05, 0, 0.62], [0.28, 1.4, 0.08, 0.28], [-0.22, 0.72, -0.06, 0.34], [0.04, 1.72, 0.1, 0.2]];
  const blobs = spots.map(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
    m.position.set(x, y, z); m.userData.baseY = y; g.add(m); return m;
  });
  g.userData.blobs = blobs; g.visible = false;
  e.subidoView = g;
  return g;
}

export function poseHaze(e, scene, time) {
  const on = !!(e && e.alive && e.subido && !e.isPlayer);
  if (!on) { if (e && e.subidoView) e.subidoView.visible = false; return; }
  const g = ensureHaze(e);
  if (g.parent !== scene) scene.add(g);
  g.visible = true;
  g.position.set(e.pos.x, e.pos.y, e.pos.z);
  const t = time || 0;
  g.userData.blobs.forEach((m, i) => {
    m.position.y = m.userData.baseY + Math.sin(t * 1.4 + i) * 0.06;
    m.scale.setScalar(1 + Math.sin(t * 2 + i * 1.7) * 0.08);
  });
}

// Terceira pessoa (o outro jogador, ou um bot). O grupo do Docão já foi posicionado neste quadro.
export function poseRemote(e, scene, time = 0) {
  if (!e || !e.model) return;
  const on = !!(e.alive && (e.tank || e.big || e.jet || e.jetGlide));
  if (!on) hideGta(e);
  else {
  const m = e.model;
  if (e.tank) {
    m.group.scale.set(0.42, 0.42, 0.42);
    m.group.position.y = e.pos.y + 0.82;
    const t = ensureTank(e, scene);
    t.visible = true;
    t.position.set(e.pos.x, e.pos.y, e.pos.z);
    t.rotation.y = e.yaw;
  } else if (e.tankView) e.tankView.visible = false;
  if (e.big && !e.tank) {
    const c = stanceScale(e.crouch || 0);
    m.group.scale.set(BIG.scale, c * BIG.scale, BIG.scale);
  }
  const jet = ensureJet(m);
  const flying = !!(e.jet || e.jetGlide);
  if (jet) jet.visible = flying && !e.tank;
  const rise = e.vel ? e.vel.y : 0;
  if (jet) for (const f of jet.userData.flames) {
    f.visible = flying && !e.tank;
    const k = e.jet ? 0.85 + Math.max(0, Math.min(1, rise / 8)) * 0.6 : 0.4;
    f.scale.set(1, Math.max(0.4, k), 1);
  }
  }
  poseHaze(e, scene, time);
}

let localTank = null;
// Primeira pessoa: o cano e a escotilha no mundo, a câmera dentro.
export function poseLocal(player, scene) {
  if (!localTank) { localTank = makeTank(); scene.add(localTank); }
  const on = !!(player && player.alive && player.tank);
  localTank.visible = on;
  if (!on || !player) return;
  localTank.position.set(player.pos.x, player.pos.y, player.pos.z);
  localTank.rotation.y = player.yaw + Math.PI;
}

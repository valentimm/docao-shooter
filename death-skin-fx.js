// Dragão da Docão Lore sobe ao céu. Moedas do Fuzil Gold Docão caem em volta de quem morreu.
import * as THREE from 'three';
import { toon, outline, drawLogo } from './docao.js';

const COIN_N = 16;
let coinMap = null;
let coinFaceGeo = null;

function coinTexture() {
  if (coinMap) return coinMap;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#f8e7b0';
  x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#a56b22'; x.lineWidth = 5;
  x.beginPath(); x.arc(32, 32, 23, 0, Math.PI * 2); x.stroke();
  drawLogo(x, 32, 35, 26, '#8a1420');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  coinMap = tex;
  return tex;
}

function put(parent, geo, color, x, y, z, th = 0.01) {
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.position.set(x, y, z);
  outline(mesh, th);
  parent.add(mesh);
  return mesh;
}

function makeDragon() {
  const g = new THREE.Group();
  const body = put(g, new THREE.SphereGeometry(0.28, 12, 10), '#1f8f4a', 0, 0, 0, 0.016);
  body.scale.set(0.72, 0.55, 1.55);
  const head = put(g, new THREE.SphereGeometry(0.2, 12, 10), '#24924a', 0, 0.06, 0.48, 0.014);
  head.scale.set(0.95, 0.78, 1.05);
  const snout = put(g, new THREE.CylinderGeometry(0.07, 0.08, 0.07, 12), '#f58a6e', 0, 0.02, 0.66, 0.008);
  snout.rotation.x = Math.PI / 2;
  put(g, new THREE.SphereGeometry(0.018, 8, 6), '#3a0806', -0.025, 0.02, 0.7, 0.004);
  put(g, new THREE.SphereGeometry(0.018, 8, 6), '#3a0806', 0.025, 0.02, 0.7, 0.004);
  for (const s of [-1, 1]) {
    const ear = put(g, new THREE.SphereGeometry(0.07, 8, 6), '#f7a531', s * 0.1, 0.2, 0.42, 0.008);
    ear.scale.set(0.42, 1.35, 0.55);
    const horn = put(g, new THREE.ConeGeometry(0.035, 0.22, 6), '#f3d78a', s * 0.08, 0.28, 0.4, 0.008);
    horn.rotation.z = s * -0.35;
    horn.rotation.x = -0.4;
    const eye = put(g, new THREE.SphereGeometry(0.028, 8, 6), '#d8261c', s * 0.08, 0.1, 0.6, 0.004);
    eye.scale.set(1, 0.7, 0.6);
  }
  for (const z of [-0.05, 0.18, 0.38]) {
    const spike = put(g, new THREE.ConeGeometry(0.04, 0.16, 5), '#f3d78a', 0, 0.22, z, 0.006);
    spike.rotation.x = 0.3;
  }
  for (const z of [-0.28, -0.48, -0.64]) {
    const tail = put(g, new THREE.SphereGeometry(0.12, 8, 6), z < -0.5 ? '#0e5a32' : '#1f8f4a', 0, 0.02, z, 0.01);
    tail.scale.set(0.7, 0.55, 1.1);
  }
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.18, 0.08, 0.02);
    const sail = put(pivot, new THREE.SphereGeometry(0.34, 8, 6), '#1f8f4a', s * 0.36, 0, -0.02, 0.012);
    sail.scale.set(1.35, 0.08, 0.72);
    const tip = put(pivot, new THREE.SphereGeometry(0.16, 8, 6), '#0e5a32', s * 0.62, 0.02, 0.08, 0.008);
    tip.scale.set(0.9, 0.1, 0.45);
    g.add(pivot);
    wings.push(pivot);
  }
  g.userData.wings = wings;
  g.scale.setScalar(1.25);
  return g;
}

function makeCoin() {
  const g = new THREE.Group();
  const disc = put(g, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 18), '#e8c56b', 0, 0, 0, 0.006);
  if (!coinFaceGeo) coinFaceGeo = new THREE.CircleGeometry(0.11, 16);
  const faceMat = new THREE.MeshBasicMaterial({ map: coinTexture(), transparent: true, side: THREE.DoubleSide });
  const face = new THREE.Mesh(coinFaceGeo, faceMat);
  face.position.y = 0.022;
  face.rotation.x = -Math.PI / 2;
  const back = new THREE.Mesh(coinFaceGeo, faceMat);
  back.position.y = -0.022;
  back.rotation.x = Math.PI / 2;
  g.add(face, back);
  g.userData.disc = disc;
  return g;
}

function dropMesh(mesh) {
  if (mesh.parent) mesh.parent.remove(mesh);
  const seen = new Set();
  mesh.traverse((o) => {
    if (!o.isMesh) return;
    const skip = o.userData && o.userData.isOutline;
    if (o.geometry && o.geometry !== coinFaceGeo && o.geometry.dispose) o.geometry.dispose();
    if (skip || !o.material || seen.has(o.material)) return;
    seen.add(o.material);
    o.material.dispose();
  });
}

export function createDeathSkinFx(scene, groundAt) {
  const shows = [];
  function play(pos, show, host = scene, yaw = 0) {
    const origin = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z);
    if (show && show.dragon) {
      const mesh = makeDragon();
      mesh.position.set(origin.x, origin.y + 1.05, origin.z);
      host.add(mesh);
      shows.push({ kind: 'dragon', mesh, t: 0, life: 2.8, origin, yaw });
    }
    if (show && show.coins) {
      for (let i = 0; i < COIN_N; i++) {
        const mesh = makeCoin();
        const ang = Math.random() * Math.PI * 2;
        const rad = 0.2 + Math.random() * 1.35;
        mesh.position.set(origin.x + Math.cos(ang) * rad, origin.y + 3.2 + Math.random() * 3.4, origin.z + Math.sin(ang) * rad);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        host.add(mesh);
        shows.push({
          kind: 'coin', mesh, origin, t: 0, life: 2.5 + Math.random() * 0.4,
          delay: i * 0.035,
          vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, -0.4 - Math.random() * 0.8, (Math.random() - 0.5) * 1.2),
          spin: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8),
        });
      }
    }
  }
  function update(dt) {
    for (let i = shows.length - 1; i >= 0; i--) {
      const s = shows[i];
      s.t += dt;
      if (s.kind === 'dragon') stepDragon(s);
      else stepCoin(s, dt);
      if (s.t >= s.life) { dropMesh(s.mesh); shows.splice(i, 1); }
    }
  }
  function stepDragon(s) {
    const climb = Math.min(1, s.t / 2.4);
    const rise = climb * climb * 11 + climb * 1.6;
    const toward = Math.min(1.15, s.t * 0.7);
    const sway = Math.sin(s.t * 2.2) * 0.35;
    const yaw = s.yaw;
    s.mesh.position.set(
      s.origin.x + Math.sin(yaw) * toward + Math.cos(yaw) * sway,
      s.origin.y + 1.05 + rise,
      s.origin.z + Math.cos(yaw) * toward - Math.sin(yaw) * sway,
    );
    const ahead = s.mesh.position.clone();
    ahead.x += Math.sin(yaw);
    ahead.y += 0.9;
    ahead.z += Math.cos(yaw);
    s.mesh.lookAt(ahead);
    s.mesh.rotateZ(Math.sin(s.t * 2.4) * 0.18);
    const flap = Math.sin(s.t * 15);
    const wings = s.mesh.userData.wings || [];
    if (wings[0]) wings[0].rotation.z = 0.15 + flap * 0.85;
    if (wings[1]) wings[1].rotation.z = -0.15 - flap * 0.85;
    const k = s.t / s.life;
    const fade = k > 0.78 ? Math.max(0, (1 - k) / 0.22) : 1;
    s.mesh.traverse((o) => {
      if (!o.isMesh || (o.userData && o.userData.isOutline) || !o.material) return;
      if (o.material.opacity === 1 && fade === 1) return;
      o.material.transparent = true;
      o.material.opacity = fade;
    });
  }
  function stepCoin(s, dt) {
    if (s.t < s.delay) return;
    s.vel.y -= 13 * dt;
    s.mesh.position.addScaledVector(s.vel, dt);
    let floor = s.origin.y + 0.08;
    if (typeof groundAt === 'function') {
      const g = groundAt(s.mesh.position.x, s.mesh.position.z, s.mesh.position.y);
      if (Number.isFinite(g)) floor = g + 0.08;
    }
    if (s.mesh.position.y <= floor) {
      s.mesh.position.y = floor;
      if (s.vel.y < -1.6) s.vel.y = -s.vel.y * 0.32;
      else s.vel.y = 0;
      s.vel.x *= 0.7; s.vel.z *= 0.7;
    }
    s.mesh.rotation.x += s.spin * dt;
    s.mesh.rotation.z += s.spin * 0.35 * dt;
    const k = s.t / s.life;
    if (k > 0.72) {
      const fade = Math.max(0, (1 - k) / 0.28);
      s.mesh.traverse((o) => {
        if (!o.isMesh || (o.userData && o.userData.isOutline) || !o.material) return;
        o.material.transparent = true;
        o.material.opacity = fade;
      });
    }
  }
  function clear() {
    for (const s of shows) dropMesh(s.mesh);
    shows.length = 0;
  }
  return { play, update, clear };
}

// Pódio do fim de partida: até 3 Docões, cada um com a própria skin e a dança padrão.
import * as THREE from 'three';
import { makeDocao } from './docao.js';
import { poseVictory, hideVictoryGuns, normDance } from './victory-dance.js';
import { getSkin } from './skins.js';

const SLOTS = {
  2: { x: -1.55, h: 0.42, color: 0xc5ccd6 },
  1: { x: 0, h: 0.82, color: 0xf0c14a },
  3: { x: 1.55, h: 0.24, color: 0xd4894a },
};

export function createPodiumStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  cam.position.set(0, 2.05, 7.4);
  cam.lookAt(0, 1.25, 0);
  scene.add(new THREE.AmbientLight(0xfff4e0, 0.92));
  const key = new THREE.DirectionalLight(0xfff8ee, 1.2);
  key.position.set(2.2, 6, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb070, 0.4);
  rim.position.set(-3.2, 2.4, -1);
  scene.add(rim);
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(3.3, 3.5, 0.08, 40),
    new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.82 }),
  );
  floor.position.y = -0.04;
  scene.add(floor);
  const blocks = {};
  for (const place of [2, 1, 3]) {
    const s = SLOTS[place];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.38, s.h, 1.2),
      new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.48, metalness: 0.12 }),
    );
    mesh.position.set(s.x, s.h / 2, 0);
    scene.add(mesh);
    blocks[place] = mesh;
  }
  let cast = [];
  let clock = 0;

  function clearCast() {
    for (const c of cast) scene.remove(c.model.group);
    cast = [];
  }
  function setCast(rows) {
    clearCast();
    for (const row of rows || []) {
      const s = SLOTS[row.place] || SLOTS[1];
      const model = makeDocao(getSkin(row.skin), { withGun: false, pose: 'idle' });
      hideVictoryGuns(model);
      if (model.snout && !model.snoutBase) model.snoutBase = model.snout.scale.clone();
      model.danceBase = { x: s.x, y: s.h, z: 0, yaw: 0 };
      model.group.position.set(s.x, s.h, 0);
      scene.add(model.group);
      cast.push({ model, dance: normDance(row.dance), phase: (row.place - 1) * 0.45 });
    }
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    const pr = Math.min(devicePixelRatio, 2);
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) renderer.setSize(w, h, false);
    if (Math.abs(cam.aspect - w / h) > 0.01) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
  }
  function tick(dt) {
    clock += dt;
    resize();
    for (const c of cast) poseVictory(c.model, c.dance, clock + c.phase);
    renderer.render(scene, cam);
  }
  function dispose() {
    clearCast();
    renderer.dispose();
  }
  return { setCast, tick, dispose };
}

import * as THREE from 'three';
import { applyWeaponCamo } from './weapon-camo.js';

// Um renderer só para todas as armas, como renderThumb em world.js.
let thumbRenderer = null;

// clone(true) grava o userData em JSON. Ferrolho, mão e corda apontam para
// objetos da própria arma, e isso faria o clone estourar. Troca por uma cópia
// segura só na hora do clone e devolve o userData original em seguida.
function cloneWeapon(group) {
  const saved = [];
  group.traverse((o) => {
    const data = o.userData || {};
    let safe;
    try {
      safe = JSON.parse(JSON.stringify(data));
    } catch {
      safe = {};
      if (data.noCamo) safe.noCamo = true;
    }
    saved.push(o, data);
    o.userData = safe;
  });
  try {
    return group.clone(true);
  } finally {
    for (let i = 0; i < saved.length; i += 2) saved[i].userData = saved[i + 1];
  }
}

// Tira mãos/antebraços (userData.noCamo) e a subárvore inteira. Não descarta
// geometry nem material: eles são os mesmos da arma de verdade.
function stripNoCamo(root) {
  if (root.userData && root.userData.noCamo) return false;
  const drop = [];
  root.traverse((o) => {
    if (o !== root && o.userData && o.userData.noCamo) drop.push(o);
  });
  for (const o of drop) if (o.parent) o.parent.remove(o);
  return true;
}

function shown(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function boundsOfVisibleMeshes(root) {
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !shown(obj)) return;
    const geo = obj.geometry;
    if (geo.boundingBox === null) geo.computeBoundingBox();
    if (!geo.boundingBox) return;
    part.copy(geo.boundingBox).applyMatrix4(obj.matrixWorld);
    box.union(part);
  });
  return box;
}

export function renderWeaponThumb(group, w = 256, h = 160, prepare) {
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setClearColor(0x000000, 0);
  }
  thumbRenderer.setSize(w, h, false);

  const clone = cloneWeapon(group);
  clone.visible = true;
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  if (typeof prepare === 'function') prepare(clone);

  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = null;
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x6a5038, 2.1);
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(2, 3, 1);
  const fill = new THREE.DirectionalLight(0xfff2dc, 1.7);
  fill.position.set(-1, 1.4, -3);
  scene.add(hemi, sun, sun.target, fill);

  const keep = stripNoCamo(clone);
  if (keep) scene.add(clone);

  const cam = new THREE.PerspectiveCamera(30, w / h, 0.05, 50);
  if (keep) {
    const box = boundsOfVisibleMeshes(clone);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 1e-6);
      cam.position.set(center.x + radius * 2.25, center.y + radius * 1.375, center.z + radius * -3.625);
      cam.near = radius * 0.01;
      cam.far = radius * 20;
      cam.lookAt(center);
    }
  }
  cam.updateProjectionMatrix();

  thumbRenderer.render(scene, cam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  if (clone.parent) scene.remove(clone);
  return url;
}

// Prévia interativa isolada: clones e materiais próprios, sem tocar na arma da partida.
export function createWeaponViewer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5038, 2.5));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(2, 4, -3); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 100);
  const pivot = new THREE.Group(); scene.add(pivot);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Prévia 3D da arma. Arraste ou use as setas para girar.');
  let clone, host, drag;
  function draw() {
    if (!host || !host.isConnected || !host.clientWidth || !host.clientHeight) return;
    const width = host.clientWidth, height = host.clientHeight;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    const distance = 1.15 / Math.sin(Math.atan(Math.tan(Math.PI / 12) * Math.min(1, camera.aspect)));
    camera.position.set(0, .12, distance); camera.lookAt(0, 0, 0); renderer.render(scene, camera);
  }
  const resize = new ResizeObserver(draw);
  canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    pivot.rotation.y += (e.clientX - drag[0]) * .009;
    pivot.rotation.x = THREE.MathUtils.clamp(pivot.rotation.x + (e.clientY - drag[1]) * .009, -1.2, 1.2);
    drag = [e.clientX, e.clientY]; draw();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { drag = null; });
  canvas.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'ArrowLeft') pivot.rotation.y -= .15;
    if (e.key === 'ArrowRight') pivot.rotation.y += .15;
    if (e.key === 'ArrowUp') pivot.rotation.x -= .15;
    if (e.key === 'ArrowDown') pivot.rotation.x += .15;
    draw();
  });
  return {
    show(mount, model, level = 0, prepare) {
      if (clone) {
        pivot.remove(clone);
        clone.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); });
      }
      resize.disconnect(); host = mount; mount.appendChild(canvas); resize.observe(mount);
      if (!model) return;
      clone = cloneWeapon(model); stripNoCamo(clone);
      clone.visible = true; clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0);
      clone.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); });
      if (prepare) prepare(clone);
      const box = boundsOfVisibleMeshes(clone), center = box.getCenter(new THREE.Vector3());
      const size = Math.max(box.getSize(new THREE.Vector3()).length() * .5, .01);
      clone.position.copy(center).multiplyScalar(-1 / size); clone.scale.setScalar(1 / size);
      pivot.rotation.set(.12, 2.5, 0); pivot.add(clone);
      // A mesma camuflagem do jogo, aplicada apenas na cópia da prévia.
      applyWeaponCamo(clone, level); draw();
    },
  };
}

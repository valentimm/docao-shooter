import * as THREE from 'three';

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
      cam.position.set(center.x + radius * 0.9, center.y + radius * 0.55, center.z + radius * -1.45);
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

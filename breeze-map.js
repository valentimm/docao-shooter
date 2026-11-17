import * as THREE from 'three';

const asset = new URL('./assets/maps/breeze/', import.meta.url);
export const breezeMap = {
  id: 'breeze-standoff',
  name: 'Breeze Standoff',
  desc: 'Exploração · modelo enviado por frostychaos144 no Sketchfab.',
  thumbUrl: new URL('breeze-thumb.jpg', asset).href,
  size: [110, 95],
  palette: {
    sky: '#a6c8de', fog: ['#a6c8de', 135, 295], hemi: ['#ffffff', '#c8bdb3', 1.7],
    sun: ['#fff5e5', 0.8], shadow: false,
  },
  fall: { y: -18, rects: [[-111, -96, 111, 96]] },
  spawns: [[-29, 12, -0.6]],
  showcase: [-29, -0.6, 12],
  pickups: [],
};

let pending;
let resources;

export function prepareBreezeMap() {
  if (resources) return Promise.resolve();
  if (!pending) {
    pending = Promise.all([
      import('./vendor/GLTFLoader.js'),
      fetch(new URL('breeze-collision.json', asset)).then((response) => {
        if (!response.ok) throw new Error('Colisão do Breeze indisponível');
        return response.json();
      }),
    ]).then(async ([{ GLTFLoader }, boxes]) => {
      const { scene } = await new GLTFLoader().loadAsync(new URL('breeze_standoff_2.glb', asset).href);
      scene.scale.setScalar(0.2);
      scene.name = breezeMap.id;
      scene.traverse((object) => {
        const material = object.material;
        if (!object.isMesh || material?.name !== '9_Wall_Orange') return;
        // O GLB marca este material como BLEND, mas toda a textura é opaca.
        material.transparent = false;
        material.depthWrite = true;
      });
      resources = { scene, boxes };
    }).finally(() => { pending = null; });
  }
  return pending;
}

export function breezeMapReady() {
  return resources !== undefined;
}

export function buildBreezeWorld() {
  const group = new THREE.Group();
  const model = resources.scene.clone();
  group.name = 'world:' + breezeMap.id;
  // A cópia compartilha os materiais e a geometria do GLB em memória.
  group.userData.reuseResources = true;
  group.add(model);
  group.updateMatrixWorld(true);
  const meshes = [];
  model.traverse((o) => {
    if (o.isMesh && !/Decals|Mask_2sided|Water/.test(o.material.name)) meshes.push(o);
  });
  const solids = resources.boxes.map(([x0, y0, z0, x1, y1, z1]) => ({
    min: new THREE.Vector3(x0, y0, z0),
    max: new THREE.Vector3(x1, y1, z1),
    ramp: null,
  }));
  return { group, meshes, solids };
}

import * as THREE from 'three';
import { getMap } from './maps.js';
import { BREEZE_ID, setBreezeBoxes } from './breeze-data.js';
import { mapSolids } from './shared/physics.js';

const asset = new URL('./assets/maps/breeze/', import.meta.url);
// mesmo objeto de maps.js (servidor e cliente usam os mesmos spawns/sites); aqui só entra o que é do navegador
export const breezeMap = getMap(BREEZE_ID);
breezeMap.thumbUrl = new URL('breeze-thumb.jpg', asset).href;

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
      setBreezeBoxes(breezeMap, boxes);
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
  // a mesma colisão do servidor (caixas do JSON + muros da borda), igual a mapSolids nos outros mapas
  const solids = mapSolids(breezeMap).map((o) => ({ min: new THREE.Vector3(o.min.x, o.min.y, o.min.z), max: new THREE.Vector3(o.max.x, o.max.y, o.max.z), ramp: null }));
  return { group, meshes, solids };
}

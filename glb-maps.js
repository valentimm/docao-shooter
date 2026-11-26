import * as THREE from 'three';
import { getMap } from './maps.js';
import { setGlbBoxes } from './glb-data.js';
import { BREEZE_ID } from './breeze-data.js';
import { DUST2_ID } from './dust2-data.js';
import { mapSolids } from './shared/physics.js';

// Registro central dos mapas baseados em modelo GLB + arquivo de colisão JSON.
// Cada entrada compartilha a mesma geometria/materiais em memória e baixa sob demanda.
const GLB_SPECS = {
  [BREEZE_ID]: {
    dir: './assets/maps/breeze/',
    glb: 'breeze_standoff_2.glb',
    collision: 'breeze-collision.json',
    thumb: 'breeze-thumb.jpg',
    scale: 0.2,
    sizeLabel: '32 MB',
    onSceneLoaded(scene) {
      scene.traverse((object) => {
        const material = object.material;
        if (!object.isMesh || material?.name !== '9_Wall_Orange') return;
        // O GLB marca este material como BLEND, mas toda a textura é opaca.
        material.transparent = false;
        material.depthWrite = true;
      });
    },
    meshFilter: (o) => o.isMesh && !/Decals|Mask_2sided|Water/.test(o.material?.name || ''),
  },
  [DUST2_ID]: {
    dir: './assets/maps/dust2/',
    glb: 'de_dust_2_with_real_light.glb',
    collision: 'dust2-collision.json',
    thumb: 'dust2-thumb.jpg',
    scale: 1.45,
    offset: [8, 0, 28],
    sizeLabel: '10 MB',
    meshFilter: (o) => o.isMesh,
  },
};

const pendingById = new Map();
const resourcesById = new Map();

export function glbThumbs() {
  const out = {};
  for (const [id, spec] of Object.entries(GLB_SPECS)) {
    const map = getMap(id);
    if (!map || map.id !== id) continue;
    const base = new URL(spec.dir, import.meta.url);
    map.thumbUrl = new URL(spec.thumb, base).href;
    out[id] = map.thumbUrl;
  }
  return out;
}

export function glbSizeLabel(id) {
  return GLB_SPECS[id]?.sizeLabel || '';
}

export function glbMapReady(id) {
  return resourcesById.has(id);
}

export function prepareGlbMap(id) {
  if (resourcesById.has(id)) return Promise.resolve();
  const spec = GLB_SPECS[id];
  const map = getMap(id);
  if (!spec || !map || map.id !== id) return Promise.reject(new Error(`Mapa GLB desconhecido: ${id}`));
  if (!pendingById.has(id)) {
    const base = new URL(spec.dir, import.meta.url);
    const p = Promise.all([
      import('./vendor/GLTFLoader.js'),
      fetch(new URL(spec.collision, base)).then((response) => {
        if (!response.ok) throw new Error(`Colisão de ${map.name} indisponível`);
        return response.json();
      }),
    ]).then(async ([{ GLTFLoader }, boxes]) => {
      const { scene } = await new GLTFLoader().loadAsync(new URL(spec.glb, base).href);
      if (spec.scale != null) scene.scale.setScalar(spec.scale);
      if (spec.offset) scene.position.set(...spec.offset);
      scene.name = map.id;
      if (spec.onSceneLoaded) spec.onSceneLoaded(scene);
      setGlbBoxes(map, boxes);
      resourcesById.set(id, { scene, boxes });
    }).finally(() => { pendingById.delete(id); });
    pendingById.set(id, p);
  }
  return pendingById.get(id);
}

export function buildGlbWorld(id) {
  const spec = GLB_SPECS[id];
  const map = getMap(id);
  const res = resourcesById.get(id);
  if (!spec || !res) throw new Error(`Mapa GLB não carregado: ${id}`);
  const group = new THREE.Group();
  const model = res.scene.clone();
  group.name = 'world:' + map.id;
  // A cópia compartilha os materiais e a geometria do GLB em memória.
  group.userData.reuseResources = true;
  group.add(model);
  group.updateMatrixWorld(true);
  const meshes = [];
  const keep = spec.meshFilter || ((o) => o.isMesh);
  model.traverse((o) => { if (keep(o)) meshes.push(o); });
  // a mesma colisão do servidor (caixas do JSON + muros da borda), igual a mapSolids nos outros mapas
  const solids = mapSolids(map).map((o) => ({ min: new THREE.Vector3(o.min.x, o.min.y, o.min.z), max: new THREE.Vector3(o.max.x, o.max.y, o.max.z), ramp: null }));
  return { group, meshes, solids };
}

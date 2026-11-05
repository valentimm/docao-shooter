// Camuflagem da arma nesta partida. Não liga nada no jogo:
// quem chama é applyWeaponCamo(arma, nível) e resetWeaponCamo(arma).
import * as THREE from 'three';

export const CAMO_TIERS = [
  { at: 5, id: 'chiqueiro', name: 'Camuflagem de chiqueiro' },
  { at: 10, id: 'bacon', name: 'Camuflagem de bacon' },
  { at: 15, id: 'ouro', name: 'Dourada' },
];

const TEX_SIZE = 64;
const BLADE_COLOR = { 1: '#c6e07a', 2: '#ff8eb0', 3: '#ffe28a' };
const BLADE_EMISSIVE = '#ffbf3a';
const STRIPE_EMISSIVE = '#000000';
const STRIPE_EMISSIVE_INTENSITY = 0.12;

function killCount(kills) {
  const n = Number(kills);
  return Number.isFinite(n) ? n : 0;
}

export function camoLevel(kills) {
  const n = killCount(kills);
  let level = 0;
  for (let i = 0; i < CAMO_TIERS.length; i++) {
    if (n >= CAMO_TIERS[i].at) level = i + 1;
  }
  return level;
}

export function camoInfo(kills) {
  const level = camoLevel(kills);
  if (!level) return null;
  const tier = CAMO_TIERS[level - 1];
  return { at: tier.at, id: tier.id, name: tier.name, level };
}

export function nextCamo(kills) {
  const level = camoLevel(kills);
  if (level >= CAMO_TIERS.length) return null;
  const tier = CAMO_TIERS[level];
  const left = tier.at - killCount(kills);
  return { at: tier.at, id: tier.id, name: tier.name, level: level + 1, left };
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paintPixels(ctx, colorAt) {
  const image = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const data = image.data;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const c = colorAt(x, y);
      const i = (y * TEX_SIZE + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

const OLIVE = rgb('#3f4f28');
const MUD = rgb('#6b4a32');

function paintChiqueiro(ctx) {
  // 16 passos na diagonal ≈ 11px de largura, e 16 divide 64 (repete sem emenda).
  paintPixels(ctx, (x, y) => (((x + y) >> 4) & 1) === 0 ? OLIVE : MUD);
}

const PINK = rgb('#e48a9a');
const LEATHER = rgb('#c47a4a');
const FAT = rgb('#f6e2d2');

function paintBacon(ctx) {
  paintPixels(ctx, (x, y) => {
    const wave = Math.sin((x / TEX_SIZE) * Math.PI * 2) * 4;
    let v = (y + wave) % 32;
    if (v < 0) v += 32;
    if (v < 11) return PINK;
    if (v < 21) return LEATHER;
    return FAT;
  });
}

function makeCamoTexture(paint) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  paint(canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  return tex;
}

const chiqueiroTex = makeCamoTexture(paintChiqueiro);
const baconTex = makeCamoTexture(paintBacon);

function asLevel(level) {
  const n = level | 0;
  if (n <= 0) return 0;
  if (n >= 3) return 3;
  return n;
}

function hasColor(material) {
  return !!(material && material.color && typeof material.color.set === 'function' && typeof material.color.clone === 'function');
}

function matData(material) {
  if (!material.userData) material.userData = {};
  return material.userData;
}

function snapshot(material) {
  return {
    color: material.color.clone(),
    emissive: material.emissive && typeof material.emissive.clone === 'function' ? material.emissive.clone() : null,
    map: material.map || null,
    emissiveIntensity: typeof material.emissiveIntensity === 'number' ? material.emissiveIntensity : null,
  };
}

function assignMap(material, next) {
  if (!('map' in material)) return;
  const incoming = next || null;
  if ((material.map || null) === incoming) return;
  material.map = incoming;
  material.needsUpdate = true;
}

function restoreMaterial(material) {
  const base = matData(material).camoBase;
  if (!base) return;
  material.color.copy(base.color);
  if (material.emissive && base.emissive && typeof material.emissive.copy === 'function') material.emissive.copy(base.emissive);
  if (typeof material.emissiveIntensity === 'number' && typeof base.emissiveIntensity === 'number') {
    material.emissiveIntensity = base.emissiveIntensity;
  }
  assignMap(material, base.map);
}

function setEmissive(material, hex, intensity) {
  if (material.emissive && typeof material.emissive.set === 'function') material.emissive.set(hex);
  if (typeof material.emissiveIntensity === 'number' && typeof intensity === 'number') material.emissiveIntensity = intensity;
}

function paintBlade(material, level) {
  material.color.set(BLADE_COLOR[level]);
  const base = matData(material).camoBase;
  if (material.emissive && typeof material.emissive.set === 'function') {
    if (level === 3) material.emissive.set(BLADE_EMISSIVE);
    else if (base && base.emissive) material.emissive.copy(base.emissive);
  }
  if (typeof material.emissiveIntensity === 'number' && base && typeof base.emissiveIntensity === 'number') {
    material.emissiveIntensity = base.emissiveIntensity;
  }
}

function paintBody(material, level) {
  if (level === 3) {
    material.color.set('#f0c14a');
    assignMap(material, null);
    setEmissive(material, '#c4892a', 0.45);
    return;
  }
  material.color.set('#ffffff');
  assignMap(material, level === 1 ? chiqueiroTex : baconTex);
  setEmissive(material, STRIPE_EMISSIVE, STRIPE_EMISSIVE_INTENSITY);
}

function isBladeMesh(mesh) {
  const data = mesh.parent && mesh.parent.userData;
  return !!(data && (data.blade === mesh || data.glow === mesh));
}

function paintMaterial(mesh, material, level) {
  if (!hasColor(material)) return;
  const data = matData(material);
  if (level === 0) {
    if (!data.camoBase || data.camoLevel == null) return;
    restoreMaterial(material);
    delete data.camoLevel;
    return;
  }
  if (data.camoLevel === level) return;
  if (data.camoLevel == null || !data.camoBase) data.camoBase = snapshot(material);
  if (isBladeMesh(mesh) || material.blending === THREE.AdditiveBlending) paintBlade(material, level);
  else paintBody(material, level);
  data.camoLevel = level;
}

function eachMaterial(mesh, fn) {
  const material = mesh.material;
  if (!material) return;
  if (Array.isArray(material)) {
    for (let i = 0; i < material.length; i++) fn(material[i]);
  } else fn(material);
}

function walk(obj, level) {
  if (!obj) return;
  if (obj.userData && obj.userData.noCamo) return;
  if (obj.isMesh && !(obj.userData && obj.userData.isOutline)) {
    eachMaterial(obj, (material) => paintMaterial(obj, material, level));
  }
  const children = obj.children;
  if (!children) return;
  for (let i = 0; i < children.length; i++) walk(children[i], level);
}

export function applyWeaponCamo(root, level) {
  if (!root) return;
  if (root.userData && (root.userData.sniperSkin || root.userData.gunPaint)) return;
  walk(root, asLevel(level));
}

export function resetWeaponCamo(root) {
  applyWeaponCamo(root, 0);
}

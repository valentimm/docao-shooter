// Saco de Presentes (visão em 1ª pessoa, no mundo e o projétil): saco vermelho com corda dourada,
// no estilo do saco das costas do Papai Noel (c23), e caixas embrulhadas com laço.
import * as THREE from 'three';
import { toon, toonWarm, outline } from './docao.js';

const V2 = THREE.Vector2, TAU = Math.PI * 2;
const M = (geo, mat, parent, th = 0.01) => { const m = new THREE.Mesh(geo, mat); if (parent) parent.add(m); if (th) outline(m, th); m.castShadow = true; return m; };
function lathe(pts, opts = {}) { return new THREE.LatheGeometry(pts.map(([r, y]) => new V2(r, y)), opts.seg || 28, opts.phiStart || 0, opts.phiLength || TAU); }

export const GIFT_WRAPS = ['#c62828', '#1b7a3a', '#2b8fd8', '#f2c94c', '#7b3fa0', '#e85d04'];
export const GIFT_RIBBONS = ['#f2c94c', '#d8261c', '#ffffff', '#2b8fd8', '#1b7a3a'];

export function giftColors(seed = 1) {
  const s = (seed >>> 0) || 1;
  return { wrap: GIFT_WRAPS[s % GIFT_WRAPS.length], ribbon: GIFT_RIBBONS[(s * 7) % GIFT_RIBBONS.length] };
}

// Caixa embrulhada com fita cruzada e lacinho. seed escolhe as cores (igual no cliente e no servidor visual).
export function makeGiftBox(seed = 1, scale = 1) {
  const g = new THREE.Group();
  const { wrap, ribbon } = giftColors(seed);
  const wrapM = toon(wrap), ribM = toon(ribbon);
  M(new THREE.BoxGeometry(0.22, 0.18, 0.22), wrapM, g, 0.006);
  M(new THREE.BoxGeometry(0.232, 0.04, 0.232), ribM, g, 0).position.y = 0.01;
  M(new THREE.BoxGeometry(0.04, 0.192, 0.232), ribM, g, 0);
  M(new THREE.BoxGeometry(0.232, 0.192, 0.04), ribM, g, 0);
  const bow = new THREE.Group(); bow.position.set(0, 0.12, 0); g.add(bow);
  for (const s of [-1, 1]) {
    const l = M(new THREE.ConeGeometry(0.045, 0.07, 8), ribM, bow, 0.003);
    l.rotation.z = s * Math.PI / 2; l.position.x = s * 0.04;
  }
  M(new THREE.SphereGeometry(0.024, 8, 8), ribM, bow, 0);
  g.scale.setScalar(scale);
  return g;
}

// Saco vermelho de Papai Noel, amarrado no topo com corda dourada. peek = caixinhas espiando na boca.
export function makeGiftSack(scale = 1, peek = true) {
  const g = new THREE.Group();
  const sack = toonWarm('#8a2a1a', 0.15), cord = toon('#d4a82a');
  M(lathe([[0.01, -0.3], [0.22, -0.28], [0.31, -0.12], [0.29, 0.06], [0.22, 0.22], [0.11, 0.32], [0.08, 0.36]]), sack, g, 0.012);
  const neck = M(new THREE.CylinderGeometry(0.07, 0.11, 0.1, 12), sack, g, 0.008); neck.position.y = 0.4;
  const tie = M(new THREE.TorusGeometry(0.085, 0.02, 6, 14), cord, g, 0.004); tie.rotation.x = Math.PI / 2; tie.position.y = 0.44;
  const drop = M(new THREE.CapsuleGeometry(0.014, 0.1, 4, 8), cord, g, 0); drop.position.set(0.09, 0.36, 0.03); drop.rotation.z = 0.45;
  const knot = M(new THREE.SphereGeometry(0.028, 8, 8), cord, g, 0.002); knot.position.set(0.12, 0.42, 0.02);
  if (peek) {
    const gift = makeGiftBox(2, 0.7); gift.position.set(-0.05, 0.54, 0.03); gift.rotation.set(0.15, 0.35, 0.1); g.add(gift);
    const gift2 = makeGiftBox(5, 0.55); gift2.position.set(0.07, 0.52, -0.03); gift2.rotation.set(-0.2, -0.4, 0.15); g.add(gift2);
  }
  g.scale.setScalar(scale);
  return g;
}

// Visão em 1ª pessoa: saco na mão direita, boca pra frente/cima, uma caixa pronta pra sair.
export function makeFPGiftSack() {
  const root = new THREE.Group(); root.name = 'fp-saco';
  const sack = makeGiftSack(1.15, true);
  sack.rotation.set(0.85, 0.15, 0.35);
  sack.position.set(0.02, -0.08, -0.02);
  root.add(sack);
  const loaded = makeGiftBox(1, 0.7);
  loaded.position.set(0.03, 0.12, -0.14);
  loaded.rotation.set(0.4, 0.5, 0.2);
  root.add(loaded);
  root.userData.loaded = loaded;
  root.userData.sack = sack;
  return root;
}

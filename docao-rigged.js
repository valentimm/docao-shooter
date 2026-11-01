// ============================================================
//  M0 — Docão com ESQUELETO de verdade (SkinnedMesh + Skeleton +
//  AnimationMixer). Protótipo para aprovação visual; ainda não é
//  usado no jogo. Depois a malha vem de um .glb (Blender), mas os
//  nomes de ossos, encaixes e clipes já seguem o plano.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { PALETTE } from './docao.js';

const V3 = THREE.Vector3;
// [nome, pai, posição local]
const BONES = [
  ['root', null, [0, 0, 0]], ['hips', 'root', [0, 0.46, 0]], ['spine', 'hips', [0, 0.24, 0]], ['chest', 'spine', [0, 0.26, 0]],
  ['neck', 'chest', [0, 0.16, 0]], ['head', 'neck', [0, 0.06, 0]],
  ['ear_L', 'head', [0.3, 0.78, -0.05]], ['ear_R', 'head', [-0.3, 0.78, -0.05]],
  ['shoulder_L', 'chest', [0.4, 0.06, 0]], ['upper_L', 'shoulder_L', [0.06, 0, 0]], ['fore_L', 'upper_L', [0, -0.26, 0]], ['hand_L', 'fore_L', [0, -0.24, 0]],
  ['shoulder_R', 'chest', [-0.4, 0.06, 0]], ['upper_R', 'shoulder_R', [-0.06, 0, 0]], ['fore_R', 'upper_R', [0, -0.26, 0]], ['hand_R', 'fore_R', [0, -0.24, 0]],
  ['thigh_L', 'hips', [0.19, -0.02, 0]], ['shin_L', 'thigh_L', [0, -0.22, 0]], ['foot_L', 'shin_L', [0, -0.2, 0]],
  ['thigh_R', 'hips', [-0.19, -0.02, 0]], ['shin_R', 'thigh_R', [0, -0.22, 0]], ['foot_R', 'shin_R', [0, -0.2, 0]],
  ['tail_1', 'hips', [0, 0.08, -0.42]], ['tail_2', 'tail_1', [0, 0.04, -0.09]], ['tail_3', 'tail_2', [0, 0.05, -0.07]],
  ['sock_hat', 'head', [0, 1.02, 0]], ['sock_face', 'head', [0, 0.5, 0.5]], ['sock_back', 'chest', [0, 0, -0.4]], ['sock_hand_R', 'hand_R', [0, -0.08, 0]], ['sock_hand_L', 'hand_L', [0, -0.08, 0]],
];
export const BONE_NAMES = BONES.map((b) => b[0]);

function buildSkeleton() {
  const map = {};
  for (const [n, p, pos] of BONES) { const b = new THREE.Bone(); b.name = n; b.position.set(...pos); map[n] = b; if (p) map[p].add(b); }
  map.root.updateMatrixWorld(true);
  return map;
}

// peça rígida presa a 1 osso (ou mistura com 2º osso por altura: juntas macias)
function part(geo, color, bones, map, boneName, opts = {}) {
  geo = geo.toNonIndexed ? geo.index ? geo.toNonIndexed() : geo : geo;
  if (opts.m) geo.applyMatrix4(opts.m);
  const n = geo.attributes.position.count, col = new THREE.Color(color);
  const c = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const i0 = BONE_NAMES.indexOf(boneName), i1 = opts.blend ? BONE_NAMES.indexOf(opts.blend.bone) : -1;
  const pos = geo.attributes.position;
  for (let i = 0; i < n; i++) {
    c.set([col.r, col.g, col.b], i * 3);
    let w = 1;
    if (i1 >= 0) { const y = pos.getY(i); const { y0, y1 } = opts.blend; w = THREE.MathUtils.clamp((y - y1) / (y0 - y1), 0, 1); }
    si[i * 4] = i0; sw[i * 4] = w; si[i * 4 + 1] = Math.max(i1, 0); sw[i * 4 + 1] = 1 - w;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
  return geo;
}
const W = (map, n) => map[n].getWorldPosition(new V3());
const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));

export function makeDocaoRigged(skin = {}) {
  const map = buildSkeleton();
  const P = PALETTE, shirt = skin.shirt?.color || '#d8261c', trim = skin.shirt?.trim || '#1d1410', pants = skin.pants || '#1d1410';
  const g = [];
  const add = (geo, color, bone, opts) => g.push(part(geo, color, null, map, bone, opts));
  const h = W(map, 'head');
  // cabeça grande de porquinho
  add(new THREE.SphereGeometry(0.56, 40, 28), P.skin, 'head', { m: T(h.x, h.y + 0.48, h.z, 0, 0, 0, 1, 0.92, 0.9) });
  add(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 32), P.snout, 'head', { m: T(0, h.y + 0.36, 0.5, Math.PI / 2, 0, 0, 1.25, 1, 0.85) });
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.04, 12, 8), P.nostril, 'head', { m: T(s * 0.08, h.y + 0.36, 0.58, 0, 0, 0, 1, 1.4, 0.5) });
    add(new THREE.SphereGeometry(0.13, 20, 14), P.eyeWhite, 'head', { m: T(s * 0.2, h.y + 0.62, 0.42, 0, 0, 0, 0.85, 1.1, 0.6) });
    add(new THREE.SphereGeometry(0.065, 16, 10), P.iris, 'head', { m: T(s * 0.19, h.y + 0.61, 0.5, 0, 0, 0, 1, 1.15, 0.6) });
    add(new THREE.SphereGeometry(0.035, 12, 8), P.pupil, 'head', { m: T(s * 0.19, h.y + 0.61, 0.53) });
    add(new THREE.CircleGeometry(0.08, 20), P.blush, 'head', { m: T(s * 0.4, h.y + 0.34, 0.37, 0, s * 0.75, 0) });
    add(new THREE.BoxGeometry(0.16, 0.035, 0.03), P.brow, 'head', { m: T(s * 0.2, h.y + 0.8, 0.44, -0.3, 0, s * -0.15) });
    const e = W(map, s > 0 ? 'ear_L' : 'ear_R');
    add(new THREE.ConeGeometry(0.15, 0.32, 4), P.skin, s > 0 ? 'ear_L' : 'ear_R', { m: T(e.x, e.y + 0.1, e.z, -0.3, Math.PI / 4, -s * 0.5, 1, 1, 0.45) });
  }
  add(new THREE.TorusGeometry(0.09, 0.022, 8, 20, Math.PI), P.mouth, 'head', { m: T(0, h.y + 0.21, 0.46, 0, 0, Math.PI) });
  // tronco: camisa (peito) + short (quadril), com junta macia na cintura
  const sp = W(map, 'spine');
  add(new THREE.CapsuleGeometry(0.38, 0.28, 8, 28), shirt, 'chest', { m: T(0, sp.y + 0.14, 0, 0, 0, 0, 1, 1, 0.82), blend: { bone: 'hips', y0: sp.y + 0.12, y1: sp.y - 0.1 } });
  add(new THREE.TorusGeometry(0.17, 0.03, 8, 24), trim, 'chest', { m: T(0, W(map, 'neck').y - 0.02, 0, Math.PI / 2) });
  add(new THREE.CylinderGeometry(0.4, 0.36, 0.26, 28), pants, 'hips', { m: T(0, W(map, 'hips').y - 0.02, 0, 0, 0, 0, 1, 1, 0.84) });
  // braços (manga + pele + luva), juntas macias no cotovelo
  for (const s of ['L', 'R']) {
    const u = W(map, 'upper_' + s), f = W(map, 'fore_' + s), hd = W(map, 'hand_' + s);
    add(new THREE.CapsuleGeometry(0.1, 0.14, 6, 14), shirt, 'upper_' + s, { m: T(u.x, u.y - 0.08, u.z) });
    add(new THREE.CapsuleGeometry(0.08, 0.26, 6, 14), P.skin, 'fore_' + s, { m: T(f.x, f.y - 0.08, f.z), blend: { bone: 'upper_' + s, y0: f.y - 0.04, y1: f.y + 0.06 } });
    add(new THREE.SphereGeometry(0.11, 16, 12), '#ffffff', 'hand_' + s, { m: T(hd.x, hd.y - 0.04, hd.z) });
    const t = W(map, 'thigh_' + s), sh = W(map, 'shin_' + s), ft = W(map, 'foot_' + s);
    add(new THREE.CapsuleGeometry(0.11, 0.14, 6, 14), P.skin, 'thigh_' + s, { m: T(t.x, t.y - 0.1, t.z) });
    add(new THREE.CapsuleGeometry(0.1, 0.12, 6, 14), P.skin, 'shin_' + s, { m: T(sh.x, sh.y - 0.1, sh.z), blend: { bone: 'thigh_' + s, y0: sh.y - 0.04, y1: sh.y + 0.06 } });
    add(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 16), P.hoof, 'foot_' + s, { m: T(ft.x, ft.y + 0.04, ft.z + 0.03, 0, 0, 0, 1, 1, 1.3) });
  }
  for (const [n, r] of [['tail_1', 0.04], ['tail_2', 0.035], ['tail_3', 0.03]]) { const p = W(map, n); add(new THREE.TorusGeometry(0.045, r * 0.6, 6, 12, Math.PI * 1.4), P.skin, n, { m: T(p.x, p.y, p.z, 0, Math.PI / 2, 0) }); }

  const geo = mergeGeometries(g); geo.computeBoundingSphere();
  const mat = new THREE.MeshToonMaterial({ vertexColors: true });
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.castShadow = true; mesh.frustumCulled = false;
  const bones = BONE_NAMES.map((n) => map[n]);
  mesh.add(map.root); mesh.bind(new THREE.Skeleton(bones));
  // contorno toon: casca invertida com o MESMO esqueleto
  const ol = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial({ color: P.outline, side: THREE.BackSide }));
  ol.material.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n transformed += normalize(objectNormal) * 0.014;').replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>'); };
  ol.frustumCulled = false; ol.bind(mesh.skeleton, mesh.bindMatrix); mesh.add(ol);
  const root = new THREE.Group(); root.add(mesh);
  const rig = { group: root, mesh, skeleton: mesh.skeleton, bones: map, head: map.head, arms: [map.upper_L, map.upper_R], legs: [map.thigh_L, map.thigh_R], tail: map.tail_1, sockets: { hat: map.sock_hat, face: map.sock_face, back: map.sock_back, handR: map.sock_hand_R, handL: map.sock_hand_L } };
  root.userData.rig = rig;
  rig.mixer = new THREE.AnimationMixer(mesh);
  rig.actions = Object.fromEntries(makeClips().map((c) => [c.name, rig.mixer.clipAction(c)]));
  rig.play = (name, fade = 0.25) => { const a = rig.actions[name]; if (rig.cur === a) return; a.reset().play(); if (rig.cur) rig.cur.crossFadeTo(a, fade, false); rig.cur = a; };
  return rig;
}

// clipes amostrados: f(fase 0..1) → { osso: [rx,ry,rz] , _hipsY }
function sample(name, dur, f, fps = 30) {
  const n = Math.round(dur * fps) + 1, times = [], rot = {}, hy = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); times.push(t * dur); const o = f(t * Math.PI * 2);
    hy.push(0, 0.46 + (o._hipsY || 0), 0);
    for (const [b, r] of Object.entries(o)) { if (b[0] === '_') continue; (rot[b] ||= []).push(...q.setFromEuler(e.set(...r)).toArray()); }
  }
  const tracks = Object.entries(rot).map(([b, v]) => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, v));
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, hy));
  return new THREE.AnimationClip(name, dur, tracks);
}
const S = Math.sin, C = Math.cos;
export function makeClips() {
  const idle = sample('idle', 2.4, (p) => ({
    _hipsY: S(p) * 0.012, chest: [S(p) * 0.03, 0, 0], head: [S(p + 1) * 0.04, S(p * 0.5) * 0.12, S(p) * 0.03],
    upper_L: [0, 0, 0.18 + S(p) * 0.03], upper_R: [0, 0, -0.18 - S(p) * 0.03], fore_L: [-0.2, 0, 0], fore_R: [-0.2, 0, 0],
    ear_L: [S(p * 2) * 0.08, 0, 0], ear_R: [S(p * 2 + 1) * 0.08, 0, 0],
    tail_1: [0, S(p * 3) * 0.5, 0], tail_2: [0, S(p * 3 - 0.6) * 0.5, 0], tail_3: [0, S(p * 3 - 1.2) * 0.5, 0],
  }));
  const gait = (name, dur, amp, bob, lean, arm) => sample(name, dur, (p) => ({
    _hipsY: Math.abs(S(p)) * bob - bob * 0.5, hips: [0, S(p) * 0.12, 0], spine: [lean, -S(p) * 0.1, 0], chest: [0, -S(p) * 0.08, S(p) * 0.03], head: [-lean * 0.6 + S(p * 2) * 0.04, S(p) * 0.06, 0],
    thigh_L: [-S(p) * amp, 0, 0], thigh_R: [S(p) * amp, 0, 0], shin_L: [Math.max(0, C(p)) * amp * 1.3, 0, 0], shin_R: [Math.max(0, -C(p)) * amp * 1.3, 0, 0],
    foot_L: [S(p) * 0.25, 0, 0], foot_R: [-S(p) * 0.25, 0, 0],
    upper_L: [S(p) * arm, 0, 0.16], upper_R: [-S(p) * arm, 0, -0.16], fore_L: [-0.4 - arm * 0.6, 0, 0], fore_R: [-0.4 - arm * 0.6, 0, 0],
    ear_L: [S(p * 2) * 0.25, 0, 0], ear_R: [S(p * 2 + 0.5) * 0.25, 0, 0],
    tail_1: [0, S(p * 2) * 0.7, 0], tail_2: [0, S(p * 2 - 0.6) * 0.7, 0], tail_3: [0, S(p * 2 - 1.2) * 0.7, 0],
  }));
  return [idle, gait('walk', 0.9, 0.55, 0.05, 0.06, 0.5), gait('run', 0.55, 0.95, 0.1, 0.25, 1.1)];
}

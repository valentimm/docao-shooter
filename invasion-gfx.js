// ============================================================
//  Modo Invasão 🎃 — visual do cliente (Three.js): zumbis animatrônicos do Docão (estilo Five Nights at Freddy's),
//  decoração de Halloween (só neste modo), Névoa Assombrada, drops de poder, projéteis e efeitos dos poderes.
//  Regras e simulação ficam em shared/invasion.js.
// ============================================================
import * as THREE from 'three';
import { toon, outline, HEAD, headR, TORSO_PTS } from './docao.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { POWERS, POWER_KEYS, ZOMBIES, isBoss } from './shared/invasion.js';

const V3 = THREE.Vector3, V2 = THREE.Vector2;
const rnd = (a, b) => a + Math.random() * (b - a);
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });
const addMat = (c, o = 0.6) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const glowTexCache = new Map();
function glowTex(color) {
  if (glowTexCache.has(color)) return glowTexCache.get(color);
  const t = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, color); g.addColorStop(0.35, color + 'aa'); g.addColorStop(1, color + '00'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  glowTexCache.set(color, t); return t;
}
const glowSprite = (color, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); sp.scale.setScalar(s); return sp; };

// ---------------- zumbis ----------------
// cores por tipo: fantasia (pelúcia do Docão) podre, endoesqueleto de metal, olhos
const ZCOL = {
  walker: { suit: '#a8743a', suit2: '#7d5228', snout: '#b4664a', eye: '#ff2a1a', metal: '#5d6066', hat: '#1c1414' },
  runner: { suit: '#8e6a3e', suit2: '#5e4426', snout: '#9a5a44', eye: '#ffe14a', metal: '#7a7f88', hat: null },
  tank: { suit: '#7d8a3a', suit2: '#5b6628', snout: '#8a6a3a', eye: '#ff8a1a', metal: '#4b4e54', hat: null },
  spitter: { suit: '#6e8f5a', suit2: '#4a6640', snout: '#7a8a52', eye: '#7dff4a', metal: '#5a6a5e', hat: null },
  boss: { suit: '#2a1c30', suit2: '#140c18', snout: '#ff6a12', eye: '#ffb020', metal: '#2c2e34', hat: '#0c080c' },
  bossBelly: { suit: '#8e2418', suit2: '#5c140e', snout: '#8a3028', eye: '#ffd24a', metal: '#3a2c28', hat: null },
  bossGhost: { suit: '#b7c6dc', suit2: '#8ea0ba', snout: '#d5e0ee', eye: '#eaf6ff', metal: '#5a6a80', hat: null },
  bossMummy: { suit: '#cbb892', suit2: '#a89068', snout: '#b8a078', eye: '#ffd27a', metal: '#6a5a40', hat: null },
  bossWolf: { suit: '#3a2c26', suit2: '#1c1410', snout: '#5a3a2e', eye: '#ff3018', metal: '#2a2222', hat: null },
  bossCrazy: { suit: '#4a1848', suit2: '#2a0c2c', snout: '#e85a30', eye: '#ff20a0', metal: '#2a1a30', hat: null },
  sling: { suit: '#c6e04a', suit2: '#8aaa28', snout: '#d8ee78', eye: '#f4ff6a', metal: '#6a7040', hat: null },
  bat: { suit: '#3a2848', suit2: '#241830', snout: '#5a4068', eye: '#ff4a6a', metal: '#3a3040', hat: null },
  cry: { suit: '#6a8ec8', suit2: '#4a6a98', snout: '#8aa8d8', eye: '#9ad0ff', metal: '#4a5a70', hat: null },
  bossHosp: { suit: '#d8d2c6', suit2: '#b7aea0', snout: '#c8a898', eye: '#ff2020', metal: '#6a645c', hat: null },
  filho: { suit: '#c45a28', suit2: '#8a3414', snout: '#e8a070', eye: '#ffe14a', metal: '#4a4038', hat: null },
  sinuca: { suit: '#141414', suit2: '#2a2a2a', snout: '#c8a090', eye: '#7DF9FF', metal: '#6b3a1c', hat: null },
  bonezinho: { suit: '#f4efe4', suit2: '#d8d0c4', snout: '#e8d8c8', eye: '#ff3030', metal: '#8a8078', hat: null },
  bossMini: { suit: '#a82818', suit2: '#6c140e', snout: '#c85848', eye: '#ffd24a', metal: '#3a2c28', hat: null },
  bossOclinhos: { suit: '#101010', suit2: '#2c2418', snout: '#d8b89a', eye: '#f7f7f7', metal: '#c8a050', hat: null },
  bossBig: { suit: '#1a1a1a', suit2: '#d8261c', snout: '#e8c8a8', eye: '#F7A531', metal: '#3a3a3a', hat: '#111' },
  corrupt: { suit: '#3a1848', suit2: '#140810', snout: '#c87898', eye: '#ff20a0', metal: '#2a1a30', hat: null },
};
let headGeo = null, torsoGeo = null;
function getHeadGeo() {
  if (headGeo) return headGeo; const pts = [];
  for (let i = 0; i <= 24; i++) { const y = HEAD.y0 + (HEAD.y1 - HEAD.y0) * (i / 24); pts.push(new V2(Math.max(0.01, headR(y)), y)); }
  pts[0].x = 0.01; pts[pts.length - 1].x = 0.01; return (headGeo = new THREE.LatheGeometry(pts, 20));
}
const getTorsoGeo = () => torsoGeo || (torsoGeo = new THREE.LatheGeometry(TORSO_PTS, 18));
const G = { cyl: new THREE.CylinderGeometry(1, 1, 1, 8), sph: new THREE.SphereGeometry(1, 10, 8), box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 6) };

// Junta malhas irmãs do mesmo material (e mesmas flags) num grupo. Cada peça animada
// (perna, braço, cabeça, mandíbula, corpo) continua sendo um grupo que gira sozinho;
// só some o tanto de draw call das dezenas de cubos/esferas que não se movem uma
// sem a outra. A geometria unida é compartilhada entre zumbis do mesmo tipo (clone).
function bakeMeshGeo(mesh) {
  mesh.updateMatrix();
  const g = mesh.geometry.clone(); // clone: nunca aplica a matriz na geometria compartilhada (cilindro/esfera/caixa)
  g.applyMatrix4(mesh.matrix);
  return g;
}
function partKey(mesh) {
  const u = mesh.userData || {};
  if (u.isOutline || u.blink || u.eye || u.goo || u.zRole === 'wing' || u.zRole === 'tear') return null; // animação/visão própria
  const ol = mesh.children.find((c) => c.userData && c.userData.isOutline);
  const th = ol ? (ol.userData.olTh != null ? ol.userData.olTh : 'x') : '0';
  return (mesh.material && mesh.material.uuid) + '|' + (u.tiny ? '1' : '0') + '|' + (mesh.castShadow ? '1' : '0') + '|' + th;
}
function collapseParts(root) {
  for (const c of root.children.slice()) if (c.isGroup) collapseParts(c);
  const buckets = new Map();
  for (const c of root.children) {
    if (!c.isMesh) continue;
    const k = partKey(c); if (!k) continue;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(c);
  }
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const baked = list.map(bakeMeshGeo);
    const indexed = baked.every((g) => g.index);
    const geos = indexed ? baked : baked.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const proto = list[0];
    const m = new THREE.Mesh(merged, proto.material);
    m.castShadow = proto.castShadow;
    m.receiveShadow = proto.receiveShadow;
    if (proto.userData.tiny) m.userData.tiny = true;
    const ol = proto.children.find((c) => c.userData && c.userData.isOutline);
    if (ol) outline(m, ol.userData.olTh != null ? ol.userData.olTh : 0.01);
    root.add(m);
    for (const old of list) root.remove(old);
  }
  batchVertexParts(root);
}
function batchVertexParts(root) {
  const can = (mesh) => {
    if (!mesh.isMesh) return false;
    const u = mesh.userData || {}, mat = mesh.material;
    if (u.isOutline || u.blink || u.eye || u.goo || u.zRole === 'wing' || u.zRole === 'tear' || !mat || Array.isArray(mat)) return false;
    if (mat.userData && (mat.userData.zFlash != null || mat.userData.zEye)) return false;
    if (mat.transparent && mat.opacity < 0.99) return false;
    if (!(mat.isMeshToonMaterial || mat.isMeshBasicMaterial) || !mat.color) return false;
    return true;
  };
  const buckets = new Map();
  for (const c of root.children) {
    if (!can(c)) continue;
    const kind = c.material.isMeshToonMaterial ? 'toon' : 'basic';
    const k = kind + '|' + (c.userData.tiny ? '1' : '0') + '|' + (c.castShadow ? '1' : '0');
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(c);
  }
  for (const [k, list] of buckets) {
    if (list.length < 2) continue;
    const kind = k.split('|')[0];
    const geos = [];
    for (const mesh of list) {
      const g = bakeMeshGeo(mesh);
      const col = mesh.material.color;
      const n = (g.getAttribute('position').count);
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
      geos.push(g);
    }
    const indexed = geos.every((g) => g.index);
    const ready = indexed ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(ready, false);
    for (const g of ready) g.dispose();
    if (!merged) continue;
    const proto = list[0];
    const mat = kind === 'toon' ? toon('#ffffff') : new THREE.MeshBasicMaterial({ color: 0xffffff });
    mat.vertexColors = true;
    if (kind === 'toon' && proto.material.gradientMap) mat.gradientMap = proto.material.gradientMap;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = proto.castShadow;
    if (proto.userData.tiny) m.userData.tiny = true;
    const ol = proto.children.find((c) => c.userData && c.userData.isOutline);
    if (ol) outline(m, ol.userData.olTh != null ? ol.userData.olTh : 0.01);
    root.add(m);
    for (const old of list) root.remove(old);
  }
}
function cloneMat(mat, map) {
  if (!mat) return mat;
  if (map.has(mat)) return map.get(mat);
  const c = mat.clone();
  c.userData = { ...mat.userData };
  if (mat.userData.baseEmissive && mat.userData.baseEmissive.clone) c.userData.baseEmissive = mat.userData.baseEmissive.clone();
  if (mat.userData.ghostBase) c.userData.ghostBase = { t: mat.userData.ghostBase.t, o: mat.userData.ghostBase.o };
  map.set(mat, c);
  return c;
}
function cloneZombie(proto) {
  const mats = new Map();
  const group = proto.group.clone(true);
  group.visible = true;
  group.traverse((o) => {
    if (!o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => cloneMat(m, mats)) : cloneMat(o.material, mats);
  });
  const legs = [], arms = [], wings = [], tears = [], flash = [];
  let body, head, jaw, eyeM;
  group.traverse((o) => {
    const u = o.userData || {};
    if (u.zRole === 'body') body = o;
    else if (u.zRole === 'leg') legs[u.zSlot] = o;
    else if (u.zRole === 'arm') arms[u.zSlot] = o;
    else if (u.zRole === 'head') head = o;
    else if (u.zRole === 'jaw') jaw = o;
    else if (u.zRole === 'wing') wings[u.zSlot] = o;
    else if (u.zRole === 'tear') tears[u.zSlot] = o;
    for (const m of [].concat(o.material || [])) {
      if (m.userData && m.userData.zEye) eyeM = m;
      if (m.userData && m.userData.zFlash != null) flash[m.userData.zFlash] = m;
    }
  });
  const blinks = []; group.traverse((o) => { if (o.userData.blink) blinks.push(o); });
  group.userData.blinks = blinks;
  if (wings.length) group.userData.wings = wings; else delete group.userData.wings;
  if (tears.length) group.userData.tears = tears; else delete group.userData.tears;
  group.userData.size = proto.group.userData.size;
  // materiais de flash/olho vêm do protótipo (mesmo que alguma malha tenha sido unida e o traverse não os ache)
  const flashMats = (proto.flashMats || []).map((m) => cloneMat(m, mats)).filter(Boolean);
  eyeM = (proto.eyeM && cloneMat(proto.eyeM, mats)) || eyeM;
  return { group, body, legs, arms, head, jaw: jaw || null, guns: [], flashMats, type: proto.type, eyeM, boss: proto.boss };
}
const protoZombies = new Map();
export function makeZombie(type) {
  const key = type || 'walker';
  let proto = protoZombies.get(key);
  if (!proto) { proto = assembleZombie(key); proto.group.visible = false; protoZombies.set(key, proto); }
  return cloneZombie(proto);
}
function assembleZombie(type) {

  const C = ZCOL[type] || ZCOL.walker, st = ZOMBIES[type] || ZOMBIES.walker;
  const suitM = toon(C.suit), suit2M = toon(C.suit2), metalM = toon(C.metal), darkM = toon('#141012'), snoutM = toon(C.snout), toothM = toon('#e8e0c8');
  for (const m of [suitM, suit2M, metalM, snoutM]) { m.emissive = new THREE.Color(0x000000); m.userData.baseEmissive = m.emissive.clone(); }
  const eyeM = glowMat(C.eye);
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mesh = (geo, mat, parent = body, ol = 0.012) => { const m = new THREE.Mesh(geo, mat); parent.add(m); if (ol) outline(m, ol); m.castShadow = true; return m; };
  const part = (geo, mat, parent, [x, y, z], [sx, sy, sz], rot = null, ol = 0.01) => { const m = mesh(geo, mat, parent, ol); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (rot) m.rotation.set(...rot); if (Math.max(sx, sy, sz) <= 0.12 || (geo === G.cone && sx <= 0.03)) m.castShadow = false; if (geo === G.cone && sx <= 0.03) m.userData.tiny = true; return m; }; // tiny: dente/garra (o LOD esconde de longe) // dente, garra, olho, narina: a sombra seria menor que 1 cm (e custa um draw call na passada de sombra)
  const thin = type === 'runner', fat = type === 'tank' || type === 'bossBelly', bossPumpkin = type === 'boss', spit = type === 'spitter';
  const boss = isBoss(type);
  // pernas (endoesqueleto: coxa de metal, joelho, canela, pé)
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * (fat ? 0.26 : 0.18), 0.5, 0); body.add(leg);
    if (thin || (type === 'walker' && s > 0)) { part(G.cyl, metalM, leg, [0, -0.13, 0], [0.045, 0.28, 0.045]); part(G.sph, metalM, leg, [0, -0.28, 0], [0.07, 0.07, 0.07]); part(G.cyl, metalM, leg, [0, -0.38, 0], [0.04, 0.2, 0.04]); }
    else part(G.sph, s > 0 ? suitM : suit2M, leg, [0, -0.2, 0], fat ? [0.2, 0.32, 0.2] : [0.14, 0.28, 0.14]);
    part(G.box, darkM, leg, [0, -0.47, 0.06], [fat ? 0.26 : 0.18, 0.08, 0.3]);
    legs.push(leg);
  }
  // tronco: fantasia rasgada com o endoesqueleto aparecendo (costelas de metal no buraco)
  const torso = mesh(getTorsoGeo(), thin ? metalM : suitM); torso.scale.set(fat ? 1.35 : thin ? 0.6 : 1, fat ? 0.95 : 1, fat ? 1.25 : thin ? 0.55 : 0.85);
  if (!thin) {
    part(G.sph, darkM, body, [0.12, 0.78, fat ? 0.52 : 0.36], [0.2, 0.22, 0.08], null, 0);
    for (let i = 0; i < 3; i++) part(G.box, metalM, body, [0.12, 0.68 + i * 0.09, fat ? 0.55 : 0.4], [0.28, 0.025, 0.04], null, 0);
    part(G.box, suit2M, body, [-0.25, 0.55, 0.32], [0.16, 0.12, 0.05], [0, 0, 0.4], 0); // remendo
  } else for (let i = 0; i < 4; i++) part(G.box, metalM, body, [0, 0.6 + i * 0.11, 0.12], [0.36, 0.03, 0.2], null, 0); // costelas
  if (type === 'tank') { // barrigão com o tanque de gás brilhando (explode quando morre)
    part(G.sph, suit2M, body, [0, 0.62, 0.25], [0.55, 0.5, 0.45]);
    part(G.cyl, toon('#c0392b'), body, [0, 0.9, -0.55], [0.22, 0.55, 0.22]);
    const lamp = part(G.sph, glowMat('#ff5a1a'), body, [0, 1.22, -0.55], [0.09, 0.09, 0.09], null, 0); lamp.userData.blink = true;
  }
  if (type === 'bossBelly') { // barriga esticada, veia, ponto e a camisa só no ombro
    const flesh = toon('#d7a090'); const bruise = toon('#8a4060');
    part(G.sph, flesh, body, [0, 0.52, 0.4], [0.58, 0.5, 0.48]);
    part(G.sph, toon('#b56a62'), body, [0, 0.46, 0.64], [0.09, 0.07, 0.05], null, 0);
    part(G.box, bruise, body, [-0.1, 0.64, 0.6], [0.028, 0.3, 0.018], [0.15, 0, 0.45], 0);
    part(G.box, bruise, body, [0.14, 0.5, 0.62], [0.022, 0.22, 0.016], [-0.25, 0, -0.2], 0);
    for (let i = 0; i < 5; i++) part(G.box, darkM, body, [-0.12 + i * 0.06, 0.74, 0.66], [0.012, 0.04, 0.012], null, 0);
    part(G.sph, flesh, body, [0.46, 0.48, 0.08], [0.18, 0.15, 0.16], null, 0);
    part(G.sph, flesh, body, [-0.44, 0.46, 0.04], [0.16, 0.14, 0.14], null, 0);
    for (const s of [-1, 1]) part(G.box, suitM, body, [s * 0.36, 1.02, 0.12], [0.26, 0.14, 0.1], [0.55, 0, s * 0.35], 0);
  }
  if (type === 'walker' || bossPumpkin) { // gravatinha borboleta (Freddy)
    for (const s of [-1, 1]) part(G.cone, darkM, body, [s * 0.08, 1.06, 0.3], [0.07, 0.12, 0.05], [0, 0, s * Math.PI / 2], 0);
  }
  // braços (metal com garras), levantados pra frente (pose de zumbi)
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * (fat ? 0.62 : thin ? 0.3 : 0.45), 1.02, 0); body.add(arm);
    const sleeve = !thin && !(type === 'walker' && s < 0);
    if (sleeve) part(G.sph, suitM, arm, [0, -0.17, 0], [0.12, 0.22, 0.12]); else part(G.cyl, metalM, arm, [0, -0.17, 0], [0.04, 0.34, 0.04]);
    part(G.sph, metalM, arm, [0, -0.36, 0], [0.06, 0.06, 0.06], null, 0);
    part(G.cyl, metalM, arm, [0, -0.52, 0], [0.035, 0.3, 0.035], null, 0);
    const claw = type === 'bossWolf' ? 0.2 : boss ? 0.15 : 0.11;
    for (const f of [-1, 0, 1]) part(G.cone, toothM, arm, [f * 0.04, -0.72, 0.02], [0.022, claw, 0.022], [Math.PI, 0, 0], 0);
    arm.rotation.x = -1.25; arms.push(arm);
  }
  // cabeça: máscara do Docão gasta, focinho com mandíbula de metal, olhos fundos que brilham
  const head = new THREE.Group(); head.position.set(0, -0.15, spit ? 0.12 : 0); body.add(head);
  const headPivot = new THREE.Group(); headPivot.position.y = 1.15; head.add(headPivot); // pivô no pescoço
  const hg = new THREE.Group(); hg.position.y = -1.15; headPivot.add(hg);
  if (spit) { part(G.cyl, metalM, body, [0, 1.15, 0.06], [0.06, 0.3, 0.06], [0.3, 0, 0]); head.position.y = 0.05; }
  if (bossPumpkin) { // abóbora podre: gomos escuros, olhos fundos e boca rasgada virados pra quem olha
    const rind = toon('#a84410', { emissive: new THREE.Color('#ff5a10'), emissiveIntensity: 0.22 });
    part(G.sph, rind, hg, [0, 1.55, 0], [0.6, 0.5, 0.56], null, 0.014);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      part(G.sph, toon(i % 2 ? '#7a300c' : '#d65a14'), hg, [Math.cos(a) * 0.2, 1.56 + (i % 2 ? 0.03 : -0.02), Math.sin(a) * 0.16], [0.26, 0.44, 0.24], null, 0);
    }
    for (const s of [-1, 1]) {
      part(G.cone, darkM, hg, [s * 0.16, 1.66, 0.4], [0.12, 0.16, 0.07], [Math.PI / 2, 0, s * 0.35], 0);
      const e = part(G.sph, eyeM, hg, [s * 0.16, 1.62, 0.5], [0.04, 0.055, 0.03], null, 0); e.userData.eye = true;
      const gl = glowSprite('#ffb020', 0.5); gl.position.set(s * 0.16, 1.62, 0.56); hg.add(gl);
    }
    part(G.box, darkM, hg, [0, 1.36, 0.44], [0.32, 0.1, 0.08], null, 0);
    for (let i = 0; i < 6; i++) part(G.cone, toothM, hg, [-0.14 + i * 0.055, 1.42, 0.5], [0.02, 0.06 + (i % 2) * 0.045, 0.02], [Math.PI, 0, (i - 2.5) * 0.12], 0);
    part(G.box, darkM, hg, [-0.2, 1.55, 0.4], [0.025, 0.24, 0.03], [0, 0.15, 0.35], 0);
    const leak = glowSprite('#ff6a10', 0.85); leak.position.set(0, 1.34, 0.52); hg.add(leak);
    part(G.cyl, toon('#24380f'), hg, [0.05, 2.06, 0], [0.045, 0.16, 0.045], [0.55, 0.2, 0.45]);
    part(G.cyl, toon(C.hat), hg, [0.05, 2.24, -0.02], [0.26, 0.3, 0.26], [0.14, 0, 0.2]);
    part(G.cyl, toon(C.hat), hg, [0.02, 2.06, 0], [0.46, 0.04, 0.44], [0.08, 0, 0.12]);
  } else {
    const skull = mesh(getHeadGeo(), thin ? metalM : suitM, hg, 0.014); skull.scale.set(thin ? 0.8 : 1, thin ? 0.9 : 1, HEAD.zs * (thin ? 0.8 : 1));
    if (thin) skull.material = new THREE.MeshToonMaterial({ color: C.metal, transparent: true, opacity: 0.95 });
    // rasgo na máscara mostrando o crânio de metal
    part(G.sph, metalM, hg, [-0.26, 1.72, 0.3], [0.14, 0.16, 0.08], null, 0);
    // orelhas: uma inteira, a outra arrancada (fios pra fora)
    part(G.cone, suit2M, hg, [0.33, 1.98, -0.03], [0.14, 0.32, 0.05], [0, 0, -0.55]);
    for (let i = 0; i < 3; i++) part(G.cyl, toon(['#e63946', '#ffd24a', '#3a6bd6'][i]), hg, [-0.3 - i * 0.03, 1.95 + i * 0.03, 0], [0.012, 0.18, 0.012], [0, 0, 0.6 + i * 0.3], 0);
    if (C.hat) { part(G.cyl, toon(C.hat), hg, [0, 2.12, 0], [0.18, 0.2, 0.18], [0, 0, 0.12]); part(G.cyl, toon(C.hat), hg, [0, 2.02, 0], [0.3, 0.03, 0.3], [0, 0, 0.12]); }
    // focinho (de cima) e mandíbula de metal (abre e fecha) com dentes
    part(G.cyl, snoutM, hg, [0, 1.52, 0.5], [0.19, 0.16, 0.13], [Math.PI / 2 - 0.12, 0, 0]);
    for (const s of [-1, 1]) part(G.sph, darkM, hg, [s * 0.075, 1.53, 0.585], [0.035, 0.05, 0.02], null, 0);
    const jaw = new THREE.Group(); jaw.position.set(0, 1.37, 0.32); hg.add(jaw);
    part(G.box, metalM, jaw, [0, -0.03, 0.17], [0.3, 0.06, 0.3], null, 0);
    for (let i = 0; i < 6; i++) part(G.cone, toothM, jaw, [-0.12 + i * 0.048, 0.03, 0.29], [0.018, 0.07, 0.018], null, 0);
    for (let i = 0; i < 6; i++) part(G.cone, toothM, hg, [-0.12 + i * 0.048, 1.4, 0.6], [0.018, 0.07, 0.018], [Math.PI, 0, 0], 0);
    if (spit) { const goo = part(G.sph, glowMat('#7dff4a'), jaw, [0, 0.04, 0.2], [0.1, 0.05, 0.1], null, 0); goo.userData.goo = true; }
    hg.userData.jaw = jaw;
    // olhos fundos
    for (const s of [-1, 1]) {
      const crazy = type === 'bossCrazy';
      const y = crazy ? (s < 0 ? 1.86 : 1.64) : 1.74;
      const sc = crazy ? (s < 0 ? 0.072 : 0.04) : 0.045;
      part(G.sph, darkM, hg, [s * 0.18, y, 0.43], [sc + 0.05, (crazy && s > 0 ? 0.1 : sc) + 0.04, 0.05], null, 0);
      const pupil = crazy && s > 0 ? glowMat('#20ffd0') : eyeM;
      const e = part(G.sph, pupil, hg, [s * 0.18, y, 0.48], [sc, crazy && s > 0 ? 0.1 : sc, 0.03], null, 0); e.userData.eye = true;
      const gl = glowSprite(crazy && s > 0 ? '#20ffd0' : C.eye, crazy && s < 0 ? 0.62 : 0.42); gl.position.set(s * 0.18, y, 0.54); hg.add(gl);
    }
  }
  if (bossPumpkin) { // capa em tiras, não um retângulo só
    const capeMat = new THREE.MeshToonMaterial({ color: '#1a0c16', side: THREE.DoubleSide });
    for (const [x, z, ry, h] of [[0, -0.5, 0, 1.25], [-0.34, -0.28, 0.55, 1.05], [0.36, -0.26, -0.5, 0.95], [0.08, -0.55, 0.15, 0.8]]) {
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.42, h), capeMat);
      cape.position.set(x, 0.55 + h * 0.15, z); cape.rotation.y = ry; cape.rotation.x = 0.22; body.add(cape);
    }
  }
  if (type === 'bossGhost') { // lençol por cima do corpo, com buracos que continuam escuros quando ele fica transparente
    eyeM.userData.keepSolid = true;
    const sheet = toon('#d7e1ef', { transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
    const hole = toon('#07080c'); hole.userData.keepSolid = true;
    part(G.sph, sheet, hg, [0, 1.64, 0.02], [0.78, 0.84, 0.66], null, 0);
    part(G.sph, sheet, body, [0, 0.82, 0.02], [0.95, 1.15, 0.72], null, 0);
    for (const s of [-1, 1]) {
      part(G.sph, hole, hg, [s * 0.16, 1.74, 0.58], [0.1, 0.14, 0.05], null, 0);
      const gl = glowSprite('#d7f4ff', 0.28); gl.material.userData.keepSolid = true; gl.position.set(s * 0.16, 1.72, 0.66); hg.add(gl);
    }
    part(G.sph, hole, hg, [0, 1.46, 0.64], [0.12, 0.16, 0.05], null, 0);
    for (let i = 0; i < 5; i++) part(G.cone, sheet, body, [-0.4 + i * 0.2, 0.12, 0.42], [0.07, 0.24, 0.015], [0.35, 0, (i - 2) * 0.18], 0);
    setGhostLook({ group: g }, true);
  }
  if (type === 'bossMummy') { // ataduras sujas, uma tira caída e um olho só de fora
    const linen = toon('#e4d3aa'); const stain = toon('#6e5840');
    for (let i = 0; i < 7; i++) part(G.box, i % 3 === 0 ? stain : linen, body, [0, 0.38 + i * 0.11, 0.02], [0.78, 0.05, 0.66], [0.08, i % 2 ? 0.45 : -0.3, i % 2 ? 0.16 : -0.1], 0);
    part(G.box, linen, hg, [0.02, 1.86, 0.12], [0.58, 0.1, 0.46], [-0.15, 0.1, 0.12], 0);
    part(G.box, linen, hg, [-0.02, 1.66, 0.28], [0.52, 0.09, 0.28], [0.25, -0.1, -0.08], 0);
    part(G.box, stain, hg, [0.16, 1.74, 0.5], [0.16, 0.07, 0.06], [0.2, 0, 0.15], 0);
    part(G.box, linen, body, [0.38, 0.5, 0.16], [0.05, 0.5, 0.035], [0.15, 0, 0.7], 0);
    part(G.box, stain, hg, [-0.3, 1.48, 0.22], [0.035, 0.32, 0.03], [0.4, 0, -0.35], 0);
  }
  if (type === 'bossWolf') { // orelha alta, focinho comprido, presa e juba
    for (const s of [-1, 1]) {
      part(G.cone, suit2M, hg, [s * 0.24, 2.22, -0.04], [0.13, 0.46, 0.06], [0.12, 0, s * -0.18]);
      part(G.cone, toon('#120c0c'), hg, [s * 0.24, 2.08, 0.01], [0.055, 0.18, 0.025], [0.12, 0, s * -0.18], 0);
    }
    part(G.cyl, snoutM, hg, [0, 1.46, 0.66], [0.13, 0.3, 0.15], [Math.PI / 2 - 0.4, 0, 0]);
    part(G.sph, darkM, hg, [0, 1.44, 0.84], [0.045, 0.035, 0.03], null, 0);
    for (const s of [-1, 1]) part(G.cone, toothM, hg, [s * 0.07, 1.34, 0.74], [0.028, 0.16, 0.026], [0.25, 0, s * 0.15], 0);
    for (let i = 0; i < 7; i++) part(G.cone, suit2M, body, [-0.28 + i * 0.09, 1.15, -0.28], [0.05, 0.2, 0.04], [-0.9, 0, (i - 3) * 0.12], 0);
  }
  if (type === 'bossCrazy') { // cartola caída, sorriso a mais e a testa costurada
    part(G.cyl, toon('#120810'), hg, [0.12, 2.2, -0.02], [0.24, 0.3, 0.24], [0.4, 0.3, 0.55]);
    part(G.cyl, toon('#120810'), hg, [0.02, 2.02, 0.02], [0.4, 0.035, 0.36], [0.25, 0, 0.35]);
    for (let i = 0; i < 7; i++) part(G.cone, toothM, hg, [-0.16 + i * 0.052, 1.32, 0.68], [0.016, 0.05 + (i % 2) * 0.05, 0.016], [Math.PI * 0.12, 0, (i - 3) * 0.08], 0);
    for (let i = 0; i < 4; i++) part(G.box, darkM, hg, [-0.06 + i * 0.045, 1.98, 0.4], [0.012, 0.045, 0.012], null, 0);
  }
  if (type === 'sling') { // elásticos nos braços, puxados pra trás na hora do pulo
    for (const arm of arms) part(G.box, toon('#f4ff6a'), arm, [0, -0.4, 0.04], [0.07, 0.5, 0.03], null, 0);
  }
  if (type === 'bat') {
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.42), new THREE.MeshToonMaterial({ color: '#241428', side: THREE.DoubleSide }));
      w.position.set(s * 0.72, 1.02, -0.02); body.add(w); wings.push(w);
    }
    g.userData.wings = wings;
    for (const s of [-1, 1]) part(G.cone, suit2M, hg, [s * 0.22, 2.08, 0.02], [0.08, 0.24, 0.04], [0.35, 0, s * -0.25]);
  }
  if (type === 'cry') {
    const tears = [];
    for (const s of [-1, 1]) {
      const tear = new THREE.Mesh(G.sph, glowMat('#7ec8ff'));
      tear.position.set(s * 0.16, 1.62, 0.55); tear.scale.set(0.045, 0.08, 0.04); hg.add(tear); tears.push(tear);
    }
    g.userData.tears = tears;
  }
  if (type === 'bossHosp') { // camisa de força fechada, correias e cabelo irregular
    const jacket = toon('#e7e0d2'); const strap = toon('#b7a88e'); const buckle = toon('#5c5346');
    part(G.box, jacket, body, [0, 0.78, 0.4], [0.82, 0.72, 0.18], null, 0);
    part(G.cyl, jacket, body, [0.16, 0.96, 0.5], [0.12, 0.58, 0.12], [0, 0, 1.2]);
    part(G.cyl, jacket, body, [-0.14, 0.76, 0.52], [0.12, 0.58, 0.12], [0, 0, -1.05]);
    for (const y of [0.6, 0.84, 1.08]) part(G.box, strap, body, [0, y, 0.58], [0.74, 0.045, 0.04], [0, 0, y === 0.84 ? 0.12 : -0.08], 0);
    for (const s of [-1, 1]) part(G.box, buckle, body, [s * 0.18, 0.84, 0.62], [0.09, 0.09, 0.035], null, 0);
    for (const s of [-1, 1]) part(G.sph, toon('#6a3038'), hg, [s * 0.18, 1.68, 0.48], [0.08, 0.03, 0.02], null, 0);
    for (let i = 0; i < 8; i++) part(G.cone, toon('#120c14'), hg, [-0.26 + (i % 5) * 0.12, 2.04 + (i % 3) * 0.03, -0.06 + (i % 2) * 0.08], [0.028, 0.16 + (i % 3) * 0.08, 0.028], [0.35, i * 0.4, (i - 3) * 0.22], 0);
  }
  // postura: corcunda (corredor bem inclinado pra frente)
  body.rotation.x = thin ? 0.38 : spit ? 0.22 : fat ? 0.08 : type === 'bossWolf' ? 0.36 : type === 'bossCrazy' ? 0.24 : 0.14;
  g.scale.setScalar(st.size); g.userData.size = st.size;
  const flashMats = [suitM, suit2M, metalM, snoutM];
  suitM.userData.zFlash = 0; suit2M.userData.zFlash = 1; metalM.userData.zFlash = 2; snoutM.userData.zFlash = 3; eyeM.userData.zEye = 1;
  body.userData.zRole = 'body'; headPivot.userData.zRole = 'head';
  if (hg.userData.jaw) hg.userData.jaw.userData.zRole = 'jaw';
  for (let i = 0; i < legs.length; i++) { legs[i].userData.zRole = 'leg'; legs[i].userData.zSlot = i; }
  for (let i = 0; i < arms.length; i++) { arms[i].userData.zRole = 'arm'; arms[i].userData.zSlot = i; }
  const wings = g.userData.wings || []; for (let i = 0; i < wings.length; i++) { wings[i].userData.zRole = 'wing'; wings[i].userData.zSlot = i; }
  const tears = g.userData.tears || []; for (let i = 0; i < tears.length; i++) { tears[i].userData.zRole = 'tear'; tears[i].userData.zSlot = i; }
  collapseParts(g);
  const blinks = []; const wings2 = [], tears2 = []; g.traverse((o) => { if (o.userData.blink) blinks.push(o); if (o.userData.zRole === 'wing') wings2[o.userData.zSlot] = o; if (o.userData.zRole === 'tear') tears2[o.userData.zSlot] = o; }); g.userData.blinks = blinks; if (wings2.length) g.userData.wings = wings2; if (tears2.length) g.userData.tears = tears2;
  return { group: g, body, legs, arms, head: headPivot, jaw: hg.userData.jaw || null, guns: [], flashMats, type, eyeM, boss };
}
// Dois modelos prontos, um de cada lado, costurados no meio. Cada metade continua com a animação do próprio tipo.
export function makeMutant(a, b) {
  const A = makeZombie(a), B = makeZombie(b);
  A.pin = { x: -0.26, y: 0, z: 0, yaw: 0.42 };
  B.pin = { x: 0.26, y: 0, z: 0, yaw: -0.42 };
  A.group.scale.multiplyScalar(0.8);
  B.group.scale.multiplyScalar(0.8);
  const g = new THREE.Group();
  g.add(A.group, B.group);
  const seam = new THREE.Mesh(G.sph, glowMat('#d15cff'));
  seam.scale.set(0.18, 0.28, 0.16);
  seam.position.set(0, 1.05, 0.12);
  g.add(seam);
  g.userData.size = 1;
  return { group: g, halves: [A, B], type: 'mutant', parts: [a, b], flashMats: A.flashMats.concat(B.flashMats), eyeM: A.eyeM, boss: false, legs: A.legs, arms: A.arms, body: A.body, head: A.head, jaw: A.jaw };
}
function pumpkinFaceTex() {
  return canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#e8701a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#c85a12'; for (let i = 0; i < 8; i++) x.fillRect(i * 32 + 14, 0, 4, h);
    x.fillStyle = '#ffd24a'; const f = (pts) => { x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.closePath(); x.fill(); };
    const cx = 64; f([[cx - 26, 52], [cx - 12, 30], [cx - 2, 52]]); f([[cx + 2, 52], [cx + 12, 30], [cx + 26, 52]]); f([[cx - 4, 62], [cx, 54], [cx + 4, 62]]);
    x.beginPath(); x.moveTo(cx - 30, 72); for (let i = 0; i <= 6; i++) x.lineTo(cx - 30 + i * 10, 72 + (i % 2 ? 12 : 4)); x.lineTo(cx + 30, 92); x.quadraticCurveTo(cx, 108, cx - 30, 92); x.closePath(); x.fill();
  });
}
// animação: andar arrastado, braços pra frente balançando, cabeça dando "tranco" (animatrônico), mandíbula abrindo, ataque
export function animateZombie(m, z, dt, T, flashing) {
  if (m.halves) {
    const walk = z.walk || 0;
    for (const h of m.halves) { z.walk = walk; animateZombie(h, z, dt, T, flashing); }
    m.group.position.set(z.pos.x, z.pos.y, z.pos.z);
    m.group.rotation.y = z.yaw;
    return;
  }
  const speed = Math.hypot(z.vel.x, z.vel.z); z.walk = (z.walk || 0) + dt * speed * (m.type === 'runner' ? 2.6 : 2.0);
  const sw = Math.sin(z.walk), k = Math.min(1, speed / 2);
  m.legs[0].rotation.x = sw * 0.7 * k; m.legs[1].rotation.x = -sw * 0.7 * k;
  const atk = z.atkT != null ? T - z.atkT : 9, swing = atk < 0.45 ? Math.sin((atk / 0.45) * Math.PI) : 0;
  m.arms[0].rotation.x = -1.25 + Math.sin(T * 3 + 1) * 0.12 - swing * 0.9 + sw * 0.1;
  m.arms[1].rotation.x = -1.3 + Math.sin(T * 3.4) * 0.12 - swing * 0.7 - sw * 0.1;
  m.arms[0].rotation.z = -0.12; m.arms[1].rotation.z = 0.12;
  if (T > (z.twitchAt || 0)) { z.twitchAt = T + rnd(0.25, 1.6); z.twitch = [rnd(-0.35, 0.35), rnd(-0.5, 0.5), rnd(-0.3, 0.3)]; } // tranco de animatrônico
  const tw = z.twitch || [0, 0, 0]; m.head.rotation.set(tw[0] + (z.stunned ? 0.5 : 0), tw[1], tw[2] + (z.stunned ? Math.sin(T * 9) * 0.4 : 0));
  if (m.jaw) m.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(T * (m.type === 'spitter' ? 5 : 7) + z.walk)) * 0.35 + swing * 0.5;
  const bob = z.onGround ? Math.abs(sw) * 0.05 : 0;
  if (m.pin) { m.group.position.set(m.pin.x, m.pin.y + bob, m.pin.z); m.group.rotation.y = m.pin.yaw; }
  else { m.group.position.set(z.pos.x, z.pos.y + bob, z.pos.z); m.group.rotation.y = z.yaw; }
  m.body.rotation.z = Math.sin(z.walk * 0.5) * 0.08 * k;
  const pose = z.pose || '';
  if (m.type === 'sling' || m.type === 'bossHosp') {
    if (pose === 'wind') { m.arms[0].rotation.x = 1.05; m.arms[1].rotation.x = 1.05; m.body.rotation.x = -0.4; }
    else if (pose === 'sling') { m.arms[0].rotation.x = -2.5; m.arms[1].rotation.x = -2.5; m.body.rotation.x = 0.7; }
    else if (m.type === 'bossHosp') { m.arms[0].rotation.z = 1.05; m.arms[1].rotation.z = -1.05; m.arms[0].rotation.x = -0.35; m.arms[1].rotation.x = -0.35; }
  }
  if (pose === 'cry') {
    m.legs[0].rotation.x = 1.2; m.legs[1].rotation.x = 1.2;
    m.arms[0].rotation.x = 0.55; m.arms[1].rotation.x = 0.5;
    m.body.rotation.x = 0.42; m.group.position.y = m.pin ? m.pin.y - 0.22 : z.pos.y - 0.32;
  } else if (pose === 'frenzy' || pose === 'rage') {
    m.body.rotation.x = pose === 'rage' ? 0.62 : 0.42;
    m.arms[0].rotation.x = -1.85; m.arms[1].rotation.x = -1.75;
  }
  const tears = m.group.userData.tears;
  if (tears) for (const tear of tears) { tear.visible = pose === 'cry'; tear.position.y = 1.62 - ((T * 1.6 + tear.position.x) % 1) * 0.4; }
  const wings = m.group.userData.wings;
  if (wings) { const f = Math.sin(T * (7 + Math.min(8, speed * 2))) * 0.75; wings[0].rotation.z = -0.45 + f; wings[1].rotation.z = 0.45 - f; }
  const eye = z.feral ? '#ff1c14' : (ZCOL[m.type] || ZCOL.walker).eye;
  for (const mat of m.flashMats) if (mat && mat.emissive) mat.emissive.set(flashing ? 0x992222 : (z.feral ? (T % 0.4 < 0.08 ? 0x6a1010 : 0x2a0808) : 0x000000));
  if (z.feral && pose !== 'cry') { m.body.rotation.x += 0.14; m.arms[0].rotation.x -= 0.22; m.arms[1].rotation.x -= 0.22; }
  if (m.eyeM && m.eyeM.color) m.eyeM.color.copy(T % (z.feral ? 0.45 : 0.9) < 0.06 ? WHITE : eyeColor(eye)); // pisca; feroz fica com o olho em brasa
  const blinks = m.group.userData.blinks;
  if (blinks) { const on = T % 0.6 < 0.3; for (let i = 0; i < blinks.length; i++) blinks[i].visible = on; }
}
const WHITE = new THREE.Color('#ffffff'), eyeColors = new Map(); // cores prontas: antes Color.set(string) parseava texto por zumbi por frame
function eyeColor(hex) { let c = eyeColors.get(hex); if (!c) eyeColors.set(hex, c = new THREE.Color(hex)); return c; }
// morte: desaba e afunda; devolve true quando já pode sumir
export function dieZombie(m, z, T) {
  const k = Math.min(1, (T - z.deathAt) / 0.5), s = m.group.userData.size || 1;
  m.group.rotation.x = -k * 1.4; m.group.position.y = z.pos.y - Math.max(0, (T - z.deathAt - 0.9)) * 0.9;
  m.group.scale.setScalar(s);
  return T - z.deathAt > 2.2;
}

// ---------------- decoração de Halloween ----------------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) { let a = seed || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const HALLOWEEN_PAL = { sky: '#140a24', fog: ['#2a1840', 24, 110], hemi: ['#9a8ad8', '#221a2c', 0.85], sun: ['#ff9a4a', 0.75] };
// noite: céu, neblina e luz (o mapa base não muda; sair do modo chama applyPalette de novo)
export function applyHalloweenPalette(scene, hemi, sun, map) {
  const P = HALLOWEEN_PAL; scene.background = new THREE.Color(P.sky); scene.fog = new THREE.Fog(P.fog[0], P.fog[1], P.fog[2]);
  hemi.color.set(P.hemi[0]); hemi.groundColor.set(P.hemi[1]); hemi.intensity = P.hemi[2]; sun.color.set(P.sun[0]); sun.intensity = P.sun[1];
  const ext = Math.max(map.size[0], map.size[1]); sun.position.set(-ext * 0.7, 45, -ext * 0.9); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
}
let pumpkinGeo = null;
export function makePumpkin(s = 1, lit = true) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(pumpkinGeo || (pumpkinGeo = new THREE.SphereGeometry(0.35, 14, 10)), toon('#e8701a', { map: pumpkinFaceTex(), emissive: new THREE.Color(lit ? '#ff7a1a' : '#000000'), emissiveIntensity: 0.25 }));
  m.scale.set(1, 0.8, 1); m.position.y = 0.27; m.rotation.y = -Math.PI / 2; outline(m, 0.012); g.add(m);
  const stem = new THREE.Mesh(G.cyl, toon('#3a5a1a')); stem.scale.set(0.04, 0.12, 0.04); stem.position.y = 0.56; g.add(stem);
  if (lit) { const gl = glowSprite('#ffa030', 0.9); gl.position.set(0, 0.3, 0.32); g.add(gl); }
  g.scale.setScalar(s); return g;
}
function makeCandles(r) {
  const g = new THREE.Group(), flames = [];
  for (let i = 0; i < 3; i++) {
    const h = 0.15 + r() * 0.25, c = new THREE.Mesh(G.cyl, toon('#f2e6c8')); c.scale.set(0.04, h, 0.04); const x = (r() - 0.5) * 0.35, z = (r() - 0.5) * 0.35; c.position.set(x, h / 2, z); g.add(c);
    const f = new THREE.Mesh(G.cone, glowMat('#ffb030')); f.scale.set(0.025, 0.07, 0.025); f.position.set(x, h + 0.04, z); g.add(f); flames.push(f);
    const gl = glowSprite('#ffa030', 0.35); gl.position.set(x, h + 0.05, z); g.add(gl);
  }
  g.userData.flames = flames; return g;
}
let fogPlaneTex = null;
function groundFogMat() {
  fogPlaneTex = fogPlaneTex || canvasTex(128, 128, (x) => { const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(190,170,230,0.55)'); gr.addColorStop(0.6, 'rgba(150,120,200,0.22)'); gr.addColorStop(1, 'rgba(120,90,170,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); });
  return new THREE.MeshBasicMaterial({ map: fogPlaneTex, transparent: true, depthWrite: false, opacity: 0.8 });
}
// monta a decoração num grupo (posições determinísticas por mapa: todo mundo online vê igual)
export function buildHalloween(map, nav, groundAt) {
  const group = new THREE.Group(); group.name = 'halloween'; const r = seeded(hashStr(map.id + ':halloween'));
  const [hx, hz] = map.size, ext = Math.max(hx, hz);
  const good = ((nav && nav.good) || []).filter((n) => n.y < 0.5 || r() < 0.25);
  const pickNode = () => good[Math.floor(r() * good.length)];
  // lua laranja + estrelas
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), glowMat('#ffa64a')); moon.position.set(-ext * 1.2 - 40, 70, -ext * 1.4 - 40); group.add(moon);
  const halo = glowSprite('#ff9a3a', 60); halo.position.copy(moon.position); group.add(halo);
  const pts = []; for (let i = 0; i < 350; i++) { const a = r() * Math.PI * 2, e = 0.2 + r() * 1.2; pts.push(Math.cos(a) * Math.cos(e) * 180, Math.sin(e) * 180, Math.sin(a) * Math.cos(e) * 180); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); group.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false })));
  const sp = (map.spawns || []).map(([x, z]) => ({ x, z }));
  const away = (n, d) => sp.every((s) => Math.hypot(s.x - n.x, s.z - n.z) > d);
  // abóboras (algumas com luz de verdade), velas, neblina rasteira
  const nP = Math.round(18 + ext * 0.35), lights = []; let nl = 0;
  for (let i = 0; i < nP && good.length; i++) {
    const n = pickNode(); if (!away(n, 1.5)) continue; const pk = makePumpkin(0.8 + r() * 0.7, true); pk.position.set(n.x + (r() - 0.5), groundAt(n.x, n.z, n.y + 0.3), n.z + (r() - 0.5)); pk.rotation.y = r() * Math.PI * 2; group.add(pk);
    if (nl < 6 && r() < 0.35) { const l = new THREE.PointLight('#ff7a1a', 5, 11, 1.5); l.position.set(pk.position.x, pk.position.y + 0.6, pk.position.z); l.userData.decorLight = true; l.userData.baseIntensity = 5; group.add(l); lights.push(l); nl++; }
  }
  const candles = [];
  for (let i = 0; i < Math.round(12 + ext * 0.2) && good.length; i++) { const n = pickNode(); const c = makeCandles(r); c.position.set(n.x + (r() - 0.5) * 1.5, groundAt(n.x, n.z, n.y + 0.3), n.z + (r() - 0.5) * 1.5); group.add(c); candles.push(c); }
  const fogs = [], fm = groundFogMat(), fg = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < Math.round(30 + ext * 0.5) && good.length; i++) {
    const n = pickNode(), f = new THREE.Mesh(fg, fm); f.rotation.x = -Math.PI / 2; const s = 6 + r() * 9; f.scale.set(s, s, 1);
    f.position.set(n.x, groundAt(n.x, n.z, n.y + 0.3) + 0.15 + r() * 0.35, n.z); f.renderOrder = 2; f.userData.ph = r() * 6; f.userData.base = f.position.clone(); group.add(f); fogs.push(f);
  }
  // morcegos voando em círculo
  const bats = []; const batM = new THREE.MeshBasicMaterial({ color: '#0c0810', side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Group(); const body = new THREE.Mesh(G.sph, batM); body.scale.set(0.12, 0.1, 0.18); b.add(body);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), batM); w.position.x = s * 0.28; b.add(w); b.userData['w' + s] = w; }
    b.userData = { ...b.userData, R: 10 + r() * ext * 0.6, h: 9 + r() * 10, sp: 0.3 + r() * 0.4, ph: r() * 6, cx: (r() - 0.5) * hx, cz: (r() - 0.5) * hz }; group.add(b); bats.push(b);
  }
  group.userData.lights = lights;
  group.userData.tick = (T) => {
    for (const c of candles) for (const f of c.userData.flames) f.scale.y = 0.06 + Math.sin(T * 17 + f.position.x * 40) * 0.015;
    for (const f of fogs) { const p = f.userData.ph; f.position.x = f.userData.base.x + Math.sin(T * 0.15 + p) * 1.2; f.position.z = f.userData.base.z + Math.cos(T * 0.12 + p) * 1.2; f.rotation.z = T * 0.03 + p; }
    for (const l of lights) l.intensity = 4.2 + Math.sin(T * 9 + l.position.x) * 0.8;
    for (const b of bats) { const u = b.userData, a = T * u.sp + u.ph; b.position.set(u.cx + Math.cos(a) * u.R, u.h + Math.sin(T * 1.3 + u.ph) * 1.2, u.cz + Math.sin(a) * u.R); b.rotation.y = -a; const f = Math.sin(T * 18 + u.ph) * 0.8; u['w-1'].rotation.y = f; u.w1.rotation.y = -f; }
  };
  return group;
}

// ---------------- Névoa Assombrada ----------------
export function makeFogWall() {
  const tex = canvasTex(256, 128, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(120,60,200,0)'); gr.addColorStop(0.55, 'rgba(140,70,220,0.55)'); gr.addColorStop(1, 'rgba(170,90,255,0.9)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(230,200,255,${0.05 + Math.random() * 0.12})`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 20 + Math.random() * 60); }
  });
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(10, 1);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, opacity: 0.85 }));
  wall.position.y = 14; wall.renderOrder = 3;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: '#c070ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
  const next = new THREE.Mesh(new THREE.RingGeometry(0.99, 1, 128), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  next.rotation.x = -Math.PI / 2; next.position.y = 0.08;
  const group = new THREE.Group(); group.add(wall, ring, next); group.name = 'fogwall';
  return {
    group,
    update(F, T, showNext) {
      if (!F) { group.visible = false; return; } group.visible = true;
      wall.position.x = ring.position.x = F.cx; wall.position.z = ring.position.z = F.cz; wall.scale.set(F.r, 28, F.r); ring.scale.set(F.r, F.r, 1);
      tex.offset.x = (T * 0.01) % 1; tex.offset.y = Math.sin(T * 0.4) * 0.03;
      next.visible = !!showNext && Math.abs(F.tr - F.r) > 0.5; next.position.x = F.tx; next.position.z = F.tz; next.scale.set(F.tr, F.tr, 1);
    },
  };
}

// ---------------- drops de poder ----------------
const POWER_COL = { pumpkin: '#ff8a1a', howl: '#a8c8ff', potion: '#5aff8a', lantern: '#fff27a', ghost: '#d8e8ff', revive: '#ffd24a', ammo: '#f2c94c' };
export const powerColor = (k) => POWER_COL[k] || '#ffffff';
const iconTexCache = new Map();
function iconTex(k) {
  if (iconTexCache.has(k)) return iconTexCache.get(k);
  const t = canvasTex(128, 128, (x) => { const gr = x.createRadialGradient(64, 64, 10, 64, 64, 62); gr.addColorStop(0, powerColor(k) + 'cc'); gr.addColorStop(1, powerColor(k) + '00'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); x.font = '72px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(k === 'ammo' ? '📦' : POWERS[k].icon, 64, 70); });
  iconTexCache.set(k, t); return t;
}
function graveNameSprite(label) {
  const text = String(label || 'Aliado');
  const font = 'bold 34px Fredoka, "Trebuchet MS", Arial, sans-serif';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const w = Math.max(256, Math.ceil(probe.measureText(text).width) + 36), h = 64;
  const tex = canvasTex(w, h, (x) => {
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 7; x.strokeStyle = '#2a1410'; x.strokeText(text, w / 2, h / 2);
    x.fillStyle = '#ffe08a'; x.fillText(text, w / 2, h / 2);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(w / h * 0.42, 0.42, 1); sp.position.y = 1.62;
  return sp;
}
// Cruz de madeira fincada onde a pessoa perdeu a última vida, com o nome em cima.
export function makeGraveMark(label) {
  const g = new THREE.Group();
  const wood = toon('#6b3e24'), iron = toon('#8d949c');
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.28, 0.12), wood);
  outline(post, 0.008); post.position.y = 0.64; post.castShadow = true; g.add(post);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.11), wood);
  outline(bar, 0.008); bar.position.y = 1.02; bar.castShadow = true; g.add(bar);
  const nail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.14), iron);
  nail.position.set(0, 1.02, 0); g.add(nail);
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), toon('#6a4a2c'));
  mound.scale.set(1.15, 0.28, 0.85); mound.position.y = 0.06; g.add(mound);
  g.add(graveNameSprite(label));
  g.userData.label = label || '';
  return g;
}

let dropRingGeo = null;
export function makeDropMesh(kind) {
  const g = new THREE.Group();
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(kind), depthWrite: false, transparent: true, fog: false })); icon.scale.setScalar(1.0); icon.position.y = 1.0; g.add(icon);
  const beam = new THREE.Mesh(G.cyl, addMat(powerColor(kind), 0.35)); beam.scale.set(0.07, 7, 0.07); beam.position.y = 3.5; g.add(beam);
  const ring = new THREE.Mesh(dropRingGeo || (dropRingGeo = new THREE.RingGeometry(0.45, 0.6, 32)), addMat(powerColor(kind), 0.7)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.userData.icon = icon; g.userData.ring = ring; return g;
}
export function tickDrop(g, T, born) { g.userData.icon.position.y = 1.0 + Math.sin(T * 3 + born) * 0.15; g.userData.ring.rotation.z = T * 2; }

// ---------------- projéteis e efeitos ----------------
// style: 0 cuspe, 1 abóbora, 2 mijo (Barriguinha), 3 tosse de energia
export function makeSpitMesh(style) {
  if (style === 3) {
    const g = new THREE.Group(); const m = new THREE.Mesh(G.sph, glowMat('#b6ff4a')); m.scale.setScalar(0.34); g.add(m);
    g.add(glowSprite('#d6ff6a', 1.5)); return g;
  }
  if (style === 1 || style === true) { const p = makePumpkin(1.1, true); return p; }
  if (style === 2) {
    const g = new THREE.Group(); const m = new THREE.Mesh(G.sph, glowMat('#d4c84a')); m.scale.setScalar(0.2); g.add(m);
    const gl = glowSprite('#c8b830', 1.0); g.add(gl); return g;
  }
  if (style === 4) {
    const g = new THREE.Group(); const m = new THREE.Mesh(G.sph, glowMat('#f2f2f2')); m.scale.setScalar(0.22); g.add(m);
    const band = new THREE.Mesh(G.sph, glowMat('#d8261c')); band.scale.set(0.08, 0.22, 0.22); g.add(band); return g;
  }
  if (style === 5) {
    const g = new THREE.Group(); const m = new THREE.Mesh(G.sph, glowMat('#111111')); m.scale.setScalar(0.28); g.add(m);
    const spot = new THREE.Mesh(G.sph, glowMat('#f7f7f7')); spot.scale.setScalar(0.1); spot.position.z = 0.2; g.add(spot); return g;
  }
  if (style === 6) {
    const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), glowMat('#e2b15a')); m.rotation.x = Math.PI / 2; g.add(m);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), glowMat('#d8261c')); top.rotation.x = Math.PI / 2; top.position.z = 0.04; g.add(top); return g;
  }
  if (style === 7) {
    const g = new THREE.Group(); const m = new THREE.Mesh(G.box, glowMat('#8a7560')); m.scale.set(0.55, 0.28, 0.4); g.add(m); return g;
  }
  if (style === 8) {
    const g = new THREE.Group(); const m = new THREE.Mesh(G.box, glowMat('#1c6b3a')); m.scale.set(2.1, 0.28, 1.15); g.add(m);
    const felt = new THREE.Mesh(G.box, glowMat('#2f9e57')); felt.scale.set(1.7, 0.08, 0.85); felt.position.y = 0.16; g.add(felt); return g;
  }
  if (style === 9) {
    const g = new THREE.Group(); const m = new THREE.Mesh(G.sph, glowMat('#F7A531')); m.scale.setScalar(0.12); g.add(m);
    g.add(glowSprite('#d8261c', 0.7)); return g;
  }
  const g = new THREE.Group(); const m = new THREE.Mesh(G.sph, glowMat('#8aff4a')); m.scale.setScalar(0.17); g.add(m); const gl = glowSprite('#7dff4a', 0.9); g.add(gl); return g;
}
export function makePowerPumpkin() { return makePumpkin(0.75, true); }
// anel que cresce e some (uivo, poção, ressurreição, splash de cuspe)
let ringGeo = null; // compartilhada: antes cada anel criava uma RingGeometry(48) que nunca era descartada (vazava na GPU a cada uivo/poção/splash)
export function makeRing(color, from, to, life, y = 0.1) {
  const m = new THREE.Mesh(ringGeo || (ringGeo = new THREE.RingGeometry(0.8, 1, 48)), addMat(color, 0.8)); m.rotation.x = -Math.PI / 2; m.position.y = y;
  m.userData = { from, to, life, t: 0 }; return m;
}
export function tickRing(m, dt) { const u = m.userData; u.t += dt; const k = Math.min(1, u.t / u.life); const s = u.from + (u.to - u.from) * k; m.scale.set(s, s, 1); m.material.opacity = 0.8 * (1 - k); return k >= 1; }
// cone da Lanterna Sagrada (aponta pro −z do pai)
export function makeLanternCone() {
  const L = POWERS.lantern, len = L.range, rad = Math.tan(L.cone) * len;
  const geo = new THREE.ConeGeometry(rad, len, 24, 1, true); geo.translate(0, -len / 2, 0); geo.rotateX(Math.PI / 2); // ponta na origem, abre pro −z
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.rotation.y = Math.PI; return m;
}
export function setGhostLook(model, on) {
  model.group.traverse((o) => { if (!o.material || o.userData.isOutline) { if (o.userData.isOutline) o.visible = !on; return; } for (const mat of [].concat(o.material)) { if (mat.userData.keepSolid) continue; if (mat.userData.ghostBase === undefined) mat.userData.ghostBase = { t: mat.transparent, o: mat.opacity }; mat.transparent = on ? true : mat.userData.ghostBase.t; mat.opacity = on ? 0.28 : mat.userData.ghostBase.o; } });
}
export { POWER_KEYS };
// ---------------- cruz (Invasão Normal) ----------------
// quem ficou sem vidas vira uma cruz de madeira no chão: monte de terra, plaquinha com o nome e um brilho dourado
// que pulsa. O anel no chão enche enquanto um aliado segura E (setCrossProgress).
function nameTex(name) {
  return canvasTex(256, 64, (x, w, h) => { x.fillStyle = 'rgba(20,10,6,0.78)'; x.fillRect(0, 0, w, h); x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffe6a0'; x.fillText(String(name || '').slice(0, 16), w / 2, h / 2 + 2); });
}
export function makeCrossMesh(name) {
  const g = new THREE.Group(), wood = toon('#7a4a24'), wood2 = toon('#5c3518'), dirt = toon('#3a2a1c');
  const mound = new THREE.Mesh(G.sph, dirt); mound.scale.set(0.55, 0.16, 0.42); mound.position.y = 0.02; g.add(mound);
  const tilt = new THREE.Group(); tilt.rotation.z = 0.08; g.add(tilt);
  const post = new THREE.Mesh(G.box, wood); post.scale.set(0.14, 1.25, 0.12); post.position.y = 0.62; outline(post, 0.02); post.castShadow = true; tilt.add(post);
  const arm = new THREE.Mesh(G.box, wood2); arm.scale.set(0.72, 0.13, 0.12); arm.position.y = 0.92; outline(arm, 0.02); arm.castShadow = true; tilt.add(arm);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex(name), depthWrite: false, transparent: true, fog: false })); tag.scale.set(1.3, 0.33, 1); tag.position.y = 1.65; g.add(tag);
  const glow = glowSprite('#ffd24a', 1.6); glow.position.y = 0.8; g.add(glow);
  const ringBg = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 48), addMat('#ffd24a', 0.25)); ringBg.rotation.x = -Math.PI / 2; ringBg.position.y = 0.06; g.add(ringBg);
  const fill = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 48, 1, 0, 0.0001), addMat('#fff3a0', 0.9)); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.07; g.add(fill);
  g.userData = { glow, fill, prog: -1 };
  return g;
}
export function setCrossProgress(g, k) {
  const u = g.userData; k = Math.max(0, Math.min(1, k || 0)); if (Math.abs(k - u.prog) < 0.005) return; u.prog = k;
  u.fill.geometry.dispose(); u.fill.geometry = new THREE.RingGeometry(0.95, 1.1, 48, 1, Math.PI / 2, Math.max(0.0001, k * Math.PI * 2));
}
export function tickCross(g, T) { g.userData.glow.material.opacity = 0.55 + Math.sin(T * 3) * 0.25; }

// ============================================================
//  Modo Invasão 🎃 — visual do cliente (Three.js): zumbis animatrônicos do Docão (estilo Five Nights at Freddy's),
//  decoração de Halloween (só neste modo), Névoa Assombrada, drops de poder, projéteis e efeitos dos poderes.
//  Regras e simulação ficam em shared/invasion.js.
// ============================================================
import * as THREE from 'three';
import { toon, outline, HEAD, headR, TORSO_PTS } from './docao.js';
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
  boss: { suit: '#3a2a40', suit2: '#24182a', snout: '#ff8a1a', eye: '#ffd24a', metal: '#3c3f46', hat: '#120c10' },
  bossBelly: { suit: '#b73c28', suit2: '#8e2c1e', snout: '#c44b36', eye: '#ffd24a', metal: '#4a3a32', hat: null },
  bossGhost: { suit: '#c8d8f0', suit2: '#9ab0d0', snout: '#e8f0ff', eye: '#a8e0ff', metal: '#6a7a90', hat: '#e8f4ff' },
  bossMummy: { suit: '#d8c89a', suit2: '#b8a878', snout: '#c8b888', eye: '#2a1a10', metal: '#8a7a5a', hat: null },
  bossWolf: { suit: '#4a3a32', suit2: '#2e241c', snout: '#6a4a3a', eye: '#ff4020', metal: '#3a3030', hat: null },
  bossCrazy: { suit: '#6a2a6a', suit2: '#4a1a4a', snout: '#ff6a3a', eye: '#ff20a0', metal: '#3a2a40', hat: '#1a0a1a' },
  sling: { suit: '#c6e04a', suit2: '#8aaa28', snout: '#d8ee78', eye: '#f4ff6a', metal: '#6a7040', hat: null },
  bat: { suit: '#3a2848', suit2: '#241830', snout: '#5a4068', eye: '#ff4a6a', metal: '#3a3040', hat: null },
  cry: { suit: '#6a8ec8', suit2: '#4a6a98', snout: '#8aa8d8', eye: '#9ad0ff', metal: '#4a5a70', hat: null },
  bossHosp: { suit: '#f2efe6', suit2: '#d8d0c4', snout: '#e8c8b8', eye: '#ff3030', metal: '#8a8478', hat: null },
};
let headGeo = null, torsoGeo = null;
function getHeadGeo() {
  if (headGeo) return headGeo; const pts = [];
  for (let i = 0; i <= 24; i++) { const y = HEAD.y0 + (HEAD.y1 - HEAD.y0) * (i / 24); pts.push(new V2(Math.max(0.01, headR(y)), y)); }
  pts[0].x = 0.01; pts[pts.length - 1].x = 0.01; return (headGeo = new THREE.LatheGeometry(pts, 20));
}
const getTorsoGeo = () => torsoGeo || (torsoGeo = new THREE.LatheGeometry(TORSO_PTS, 18));
const G = { cyl: new THREE.CylinderGeometry(1, 1, 1, 8), sph: new THREE.SphereGeometry(1, 10, 8), box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 6) };

export function makeZombie(type) {
  const C = ZCOL[type] || ZCOL.walker, st = ZOMBIES[type] || ZOMBIES.walker;
  const suitM = toon(C.suit), suit2M = toon(C.suit2), metalM = toon(C.metal), darkM = toon('#141012'), snoutM = toon(C.snout), toothM = toon('#e8e0c8');
  for (const m of [suitM, suit2M, metalM, snoutM]) { m.emissive = new THREE.Color(0x000000); m.userData.baseEmissive = m.emissive.clone(); }
  const eyeM = glowMat(C.eye);
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mesh = (geo, mat, parent = body, ol = 0.012) => { const m = new THREE.Mesh(geo, mat); parent.add(m); if (ol) outline(m, ol); m.castShadow = true; return m; };
  const part = (geo, mat, parent, [x, y, z], [sx, sy, sz], rot = null, ol = 0.01) => { const m = mesh(geo, mat, parent, ol); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (rot) m.rotation.set(...rot); return m; };
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
  if (type === 'bossBelly') { // Barriguinha: camisa arregaçada e barriga de fora
    part(G.sph, toon('#e8a090'), body, [0, 0.58, 0.38], [0.48, 0.42, 0.4]);
    part(G.sph, toon('#d08070'), body, [0, 0.52, 0.52], [0.12, 0.1, 0.08], null, 0); // umbigo
    for (const s of [-1, 1]) part(G.box, suitM, body, [s * 0.28, 0.95, 0.2], [0.22, 0.18, 0.08], [0.4, 0, s * 0.3], 0); // rolo da camisa
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
    for (const f of [-1, 0, 1]) part(G.cone, toothM, arm, [f * 0.04, -0.72, 0.02], [0.022, 0.11, 0.022], [Math.PI, 0, 0], 0);
    arm.rotation.x = -1.25; arms.push(arm);
  }
  // cabeça: máscara do Docão gasta, focinho com mandíbula de metal, olhos fundos que brilham
  const head = new THREE.Group(); head.position.set(0, -0.15, spit ? 0.12 : 0); body.add(head);
  const headPivot = new THREE.Group(); headPivot.position.y = 1.15; head.add(headPivot); // pivô no pescoço
  const hg = new THREE.Group(); hg.position.y = -1.15; headPivot.add(hg);
  if (spit) { part(G.cyl, metalM, body, [0, 1.15, 0.06], [0.06, 0.3, 0.06], [0.3, 0, 0]); head.position.y = 0.05; }
  if (bossPumpkin) { // cabeça de abóbora com cara entalhada
    const pk = part(G.sph, toon('#e8701a'), hg, [0, 1.52, 0], [0.62, 0.52, 0.58], null, 0.014);
    pk.material.map = pumpkinFaceTex(); pk.material.needsUpdate = true; pk.rotation.y = -Math.PI / 2;
    for (let i = 0; i < 5; i++) part(G.sph, toon('#d6601a'), hg, [Math.cos(i * 1.26) * 0.3, 1.52, Math.sin(i * 1.26) * 0.3], [0.32, 0.5, 0.32], null, 0);
    part(G.cyl, toon('#3a5a1a'), hg, [0, 2.07, 0], [0.06, 0.18, 0.06], [0.2, 0, 0.2]);
    const inner = glowSprite('#ffb02a', 1.6); inner.position.set(0, 1.5, 0.5); hg.add(inner);
    part(G.cyl, toon(C.hat), hg, [0, 2.2, 0], [0.32, 0.36, 0.32]); part(G.cyl, toon(C.hat), hg, [0, 2.03, 0], [0.5, 0.04, 0.5]); // cartola
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
      part(G.sph, darkM, hg, [s * 0.17, 1.74, 0.43], [0.1, 0.09, 0.05], null, 0);
      const e = part(G.sph, eyeM, hg, [s * 0.17, 1.74, 0.47], [0.045, 0.045, 0.03], null, 0); e.userData.eye = true;
      const gl = glowSprite(C.eye, 0.45); gl.position.set(s * 0.17, 1.74, 0.52); hg.add(gl);
    }
  }
  if (bossPumpkin) { // capa rasgada
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3, 1, 3), new THREE.MeshToonMaterial({ color: '#4a1a5a', side: THREE.DoubleSide })); cape.position.set(0, 0.65, -0.42); cape.rotation.x = 0.12; body.add(cape);
  }
  if (type === 'bossGhost') { // véu translúcido
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5, 1, 3), new THREE.MeshToonMaterial({ color: '#d8e8ff', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    veil.position.set(0, 0.7, -0.35); veil.rotation.x = 0.15; body.add(veil);
    setGhostLook({ group: g }, true);
  }
  if (type === 'bossMummy') { // faixas de atadura
    for (let i = 0; i < 6; i++) part(G.box, toon('#efe6c8'), body, [(i % 2 ? 1 : -1) * 0.08, 0.45 + i * 0.12, 0.38], [0.55, 0.04, 0.08], [0, 0, (i % 2 ? 0.25 : -0.25)], 0);
    part(G.box, toon('#efe6c8'), hg, [0, 1.78, 0.35], [0.5, 0.08, 0.12], [0.2, 0, 0], 0);
  }
  if (type === 'bossWolf') { // orelhas e focinho de lobo
    for (const s of [-1, 1]) part(G.cone, suit2M, hg, [s * 0.28, 2.15, -0.05], [0.12, 0.28, 0.08], [0.2, 0, s * -0.35]);
    part(G.cyl, snoutM, hg, [0, 1.48, 0.58], [0.16, 0.22, 0.14], [Math.PI / 2 - 0.2, 0, 0]);
  }
  if (type === 'bossCrazy') { // olhos tortos e coroa torta
    part(G.cyl, toon(C.hat || '#1a0a1a'), hg, [0.08, 2.18, 0], [0.28, 0.22, 0.28], [0.15, 0, 0.4]);
    part(G.box, toon('#ff20a0'), hg, [-0.2, 1.78, 0.48], [0.1, 0.08, 0.04], [0, 0, 0.5], 0);
    part(G.box, toon('#20ffd0'), hg, [0.22, 1.7, 0.48], [0.08, 0.12, 0.04], [0, 0, -0.35], 0);
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
  if (type === 'bossHosp') { // camisa de força, fivelas e cabelo em pé
    part(G.box, toon('#f7f4ee'), body, [0, 0.82, 0.4], [0.72, 0.58, 0.1], null, 0);
    part(G.box, toon('#efe6d8'), body, [0.12, 0.98, 0.48], [0.58, 0.055, 0.04], [0, 0, 0.65], 0);
    part(G.box, toon('#efe6d8'), body, [-0.12, 0.74, 0.48], [0.58, 0.055, 0.04], [0, 0, -0.65], 0);
    for (const s of [-1, 1]) part(G.box, toon('#b7a48c'), body, [s * 0.2, 0.88, 0.5], [0.07, 0.07, 0.04], null, 0);
    for (let i = 0; i < 5; i++) part(G.cone, toon('#1a1020'), hg, [-0.18 + i * 0.09, 2.08, -0.04], [0.035, 0.14 + (i % 2) * 0.08, 0.035], [0.25, 0, (i - 2) * 0.28], 0);
  }
  // postura: corcunda (corredor bem inclinado pra frente)
  body.rotation.x = thin ? 0.38 : spit ? 0.22 : fat ? 0.06 : type === 'bossWolf' ? 0.2 : 0.14;
  g.scale.setScalar(st.size); g.userData.size = st.size;
  const flashMats = [suitM, suit2M, metalM, snoutM];
  return { group: g, body, legs, arms, head: headPivot, jaw: hg.userData.jaw || null, guns: [], flashMats, type, eyeM, boss };
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
  m.group.position.set(z.pos.x, z.pos.y + (z.onGround ? Math.abs(sw) * 0.05 : 0), z.pos.z);
  m.group.rotation.y = z.yaw;
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
    m.body.rotation.x = 0.42; m.group.position.y = z.pos.y - 0.32;
  } else if (pose === 'frenzy' || pose === 'rage') {
    m.body.rotation.x = pose === 'rage' ? 0.62 : 0.42;
    m.arms[0].rotation.x = -1.85; m.arms[1].rotation.x = -1.75;
  }
  const tears = m.group.userData.tears;
  if (tears) for (const tear of tears) { tear.visible = pose === 'cry'; tear.position.y = 1.62 - ((T * 1.6 + tear.position.x) % 1) * 0.4; }
  const wings = m.group.userData.wings;
  if (wings) { const f = Math.sin(T * (7 + Math.min(8, speed * 2))) * 0.75; wings[0].rotation.z = -0.45 + f; wings[1].rotation.z = 0.45 - f; }
  for (const mat of m.flashMats) mat.emissive.set(flashing ? 0x992222 : 0x000000);
  m.eyeM.color.set(T % 0.9 < 0.06 ? '#ffffff' : (ZCOL[m.type] || ZCOL.walker).eye); // pisca
  m.group.traverse((o) => { if (o.userData.blink) o.visible = T % 0.6 < 0.3; });
}
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
    if (nl < 6 && r() < 0.35) { const l = new THREE.PointLight('#ff7a1a', 5, 11, 1.5); l.position.set(pk.position.x, pk.position.y + 0.6, pk.position.z); group.add(l); lights.push(l); nl++; }
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
export function makeDropMesh(kind) {
  const g = new THREE.Group();
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(kind), depthWrite: false, transparent: true, fog: false })); icon.scale.setScalar(1.0); icon.position.y = 1.0; g.add(icon);
  const beam = new THREE.Mesh(G.cyl, addMat(powerColor(kind), 0.35)); beam.scale.set(0.07, 7, 0.07); beam.position.y = 3.5; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 32), addMat(powerColor(kind), 0.7)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.userData.icon = icon; g.userData.ring = ring; return g;
}
export function tickDrop(g, T, born) { g.userData.icon.position.y = 1.0 + Math.sin(T * 3 + born) * 0.15; g.userData.ring.rotation.z = T * 2; }

// ---------------- projéteis e efeitos ----------------
// style: 0 cuspe, 1 abóbora, 2 mijo (Barriguinha)
export function makeSpitMesh(style) {
  if (style === 1 || style === true) { const p = makePumpkin(1.1, true); return p; }
  if (style === 2) {
    const g = new THREE.Group(); const m = new THREE.Mesh(G.sph, glowMat('#d4c84a')); m.scale.setScalar(0.2); g.add(m);
    const gl = glowSprite('#c8b830', 1.0); g.add(gl); return g;
  }
  const g = new THREE.Group(); const m = new THREE.Mesh(G.sph, glowMat('#8aff4a')); m.scale.setScalar(0.17); g.add(m); const gl = glowSprite('#7dff4a', 0.9); g.add(gl); return g;
}
export function makePowerPumpkin() { return makePumpkin(0.75, true); }
// anel que cresce e some (uivo, poção, ressurreição, splash de cuspe)
export function makeRing(color, from, to, life, y = 0.1) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), addMat(color, 0.8)); m.rotation.x = -Math.PI / 2; m.position.y = y;
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
  model.group.traverse((o) => { if (!o.material || o.userData.isOutline) { if (o.userData.isOutline) o.visible = !on; return; } for (const mat of [].concat(o.material)) { if (mat.userData.ghostBase === undefined) mat.userData.ghostBase = { t: mat.transparent, o: mat.opacity }; mat.transparent = on ? true : mat.userData.ghostBase.t; mat.opacity = on ? 0.28 : mat.userData.ghostBase.o; } });
}
export { POWER_KEYS };

// Peças de fantasia do Docão. Cada função recebe (opções da skin, rig) e devolve um Object3D
// (userData.anchor = 'head' para prender na cabeça) ou null quando só altera o rig.
// A identidade do Docão (cabeça, focinho, orelhas, bochechas, olhos, contorno) nunca é removida.
import * as THREE from 'three';
import { PARTS, SHIRT_DETAILS, toon, toonWarm, basic, outline, canvasTex, headR, headPoint, HEAD, TORSO_PTS, torsoR, gloveMat, gloveSparkles, addSparkles, drawLogo, headNormal } from './docao.js';

const V3 = THREE.Vector3, V2 = THREE.Vector2, TAU = Math.PI * 2;
const M = (geo, mat, parent, th = 0.01) => { const m = new THREE.Mesh(geo, mat); if (parent) parent.add(m); if (th) outline(m, th); m.castShadow = true; return m; };
const onHead = (g) => { g.userData.anchor = 'head'; return g; };
const hideTuft = (rig) => rig.tuft.forEach((t) => (t.visible = false));
function lathe(pts, opts = {}) { return new THREE.LatheGeometry(pts.map(([r, y]) => new V2(r, y)), opts.seg || 40, opts.phiStart || 0, opts.phiLength || TAU); }
function stripeTex(colors, n = 8, horizontal = false) {
  return canvasTex(256, 256, (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = colors[i % colors.length]; if (horizontal) x.fillRect(0, i * h / n, w, h / n + 1); else x.fillRect(i * w / n, 0, w / n + 1, h); } });
}

Object.assign(PARTS, {
  // ---------- chapéus ----------
  fedora(o, rig) {
    hideTuft(rig); const g = new THREE.Group(); const m = toon(o.color || '#15151a'), band = toon(o.band || '#f4f4f4');
    const crown = M(lathe([[0.001, 0.32], [0.16, 0.31], [0.27, 0.27], [0.31, 0.16], [0.34, 0.02], [0.35, 0.0]]), m, g, 0.012);
    const dent = M(new THREE.SphereGeometry(0.12, 16, 8), toon('#0c0c10'), g, 0); dent.scale.set(1.6, 0.25, 0.6); dent.position.set(0, 0.315, -0.02);
    const brim = M(lathe([[0.33, 0.02], [0.5, 0.005], [0.66, 0.03], [0.68, 0.045], [0.66, 0.035], [0.5, -0.015], [0.33, -0.005]], { seg: 48 }), m, g, 0.01);
    brim.scale.z = 0.88;
    M(new THREE.CylinderGeometry(0.345, 0.352, 0.075, 40, 1, true), band, g, 0).position.y = 0.06;
    g.position.set(0, 1.9, -0.02); g.rotation.set(-0.1, 0, 0.12); return onHead(g);
  },
  bucketHat(o, rig) {
    hideTuft(rig); const g = new THREE.Group(); const m = toon(o.color || '#8a8a5c', { side: THREE.DoubleSide }), band = toon(o.band || '#5a5a38');
    M(lathe([[0.001, 0.27], [0.25, 0.265], [0.34, 0.22], [0.37, 0.1], [0.38, 0.0], [0.47, -0.07], [0.6, -0.14]], { seg: 44 }), m, g, 0.012);
    const b = M(new THREE.CylinderGeometry(0.375, 0.385, 0.07, 40, 1, true), band, g, 0); b.position.y = 0.04;
    for (const s of [-1, 1]) { const eye = M(new THREE.TorusGeometry(0.025, 0.008, 6, 12), basic('#c9c9c9'), g, 0); eye.position.set(s * 0.33, 0.15, 0.1); eye.rotation.y = s * 1.3; }
    // anzol decorativo
    const hook = M(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI * 1.4), basic('#d0d0d0'), g, 0); hook.position.set(0.27, 0.12, 0.25); hook.rotation.y = 0.8;
    g.position.set(0, 1.86, -0.02); g.rotation.x = -0.08; return onHead(g);
  },
  roundCap(o, rig) { // gorro redondo tradicional com nó no topo
    hideTuft(rig); const g = new THREE.Group(); const m = toon(o.color || '#15151a');
    const dome = M(new THREE.SphereGeometry(0.36, 32, 16, 0, TAU, 0, Math.PI / 2), m, g, 0.012); dome.scale.set(1, 0.62, 0.95);
    M(new THREE.CylinderGeometry(0.362, 0.362, 0.05, 40, 1, true), toon(o.band || '#15151a'), g, 0).position.y = 0.0;
    for (let i = 0; i < 6; i++) { const seam = M(new THREE.TorusGeometry(0.355, 0.006, 4, 24, Math.PI / 2), basic('#3a3a44'), g, 0); seam.rotation.y = i * Math.PI / 3; seam.scale.set(1, 0.62, 0.95); }
    M(new THREE.SphereGeometry(0.055, 14, 10), toon(o.knot || '#d0202a'), g, 0.008).position.y = 0.23;
    g.position.set(0, 1.86, -0.03); g.rotation.x = -0.15; return onHead(g);
  },
  hood(o, rig) { // capuz de fantasia com orelhas compridas de ponta preta
    hideTuft(rig); const g = new THREE.Group(); const c = o.color || '#ffd23a';
    const m = toonWarm(c, 0.15, { side: THREE.DoubleSide });
    // casca com abertura redonda para o rosto (o rosto do Docão fica 100% visível)
    const shell = M(new THREE.SphereGeometry(0.645, 44, 30, 0, TAU, 1.12, Math.PI - 1.12), m, g, 0.012);
    shell.rotation.x = Math.PI / 2 - 0.4; shell.scale.set(1.02, 1, 0.96);
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(s * 0.22, 0.56, -0.1); ear.rotation.set(-0.2, 0, -s * 0.42); g.add(ear);
      const base = M(new THREE.CylinderGeometry(0.04, 0.12, 0.44, 18), m, ear, 0.01); base.position.y = 0.22; base.scale.z = 0.5;
      const tip = M(new THREE.ConeGeometry(0.04, 0.2, 18), toon(o.tip || '#1a1a1a'), ear, 0.01); tip.position.y = 0.54; tip.scale.z = 0.5;
      const dir = new V3(s * Math.sin(1.2), -0.12, Math.cos(1.2)).normalize(); const pos = dir.clone().multiplyScalar(0.66); pos.x *= 1.02; pos.z *= 0.96;
      const dot = M(new THREE.CircleGeometry(0.09, 20), toon(o.cheeks || '#e8322a'), g, 0); dot.position.copy(pos); dot.lookAt(pos.clone().add(dir));
    }
    g.position.set(0, 1.52, -0.02); return onHead(g);
  },
  longHair(o, rig) { // cabeleira de roqueiro
    hideTuft(rig); const g = new THREE.Group(); const c = o.color || '#3b2414'; const m = toonWarm(c, 0.1);
    const scalp = M(new THREE.SphereGeometry(0.6, 36, 18, 0, TAU, 0, Math.PI * 0.36), m, g, 0.012);
    scalp.position.set(0, 1.47, -0.06); scalp.rotation.x = -0.42; scalp.scale.set(1.0, 1.0, 0.98);
    let k = 0;
    for (const row of [{ y: 1.78, out: 0.07, len: 0.62 }, { y: 1.62, out: 0.13, len: 0.55 }]) {
      for (let a = -2.05; a <= 2.05; a += 0.27) {
        const th = Math.PI + a; const r = headR(row.y) + row.out;
        const lock = M(new THREE.CapsuleGeometry(0.095, row.len, 4, 10), m, g, 0.01);
        const px = r * Math.sin(th), pz = r * HEAD.zs * Math.cos(th);
        lock.position.set(px * 1.05, row.y - row.len * 0.45, pz * 1.05 - 0.02);
        lock.rotation.set(-Math.cos(th) * 0.28, 0, Math.sin(th) * 0.28 + ((k++ % 3) - 1) * 0.06);
        lock.scale.set(1, 1, 0.75);
      }
    }
    if (o.headband) { const hb = M(new THREE.TorusGeometry(0.5, 0.035, 8, 40), toon(o.headband), g, 0.008); hb.rotation.x = Math.PI / 2 - 0.42; hb.position.set(0, 1.84, -0.06); hb.scale.set(1.0, 0.92, 1); }
    return onHead(g);
  },

  // ---------- rosto ----------

  // ---------- mãos e pés ----------
  glove(o, rig) { // luva (ex.: uma luva branca brilhante)
    const sides = o.hand === 'both' ? [0, 1] : [(o.hand || 'right') === 'right' ? 0 : 1];
    for (const i of sides) {
      const { fist, thumb } = rig.fists[i]; const gm = gloveMat(o.color, o);
      fist.material = gm; thumb.material = gm; fist.scale.multiplyScalar(1.04);
      gloveSparkles(fist, o, 0.158);
      const cuff = M(new THREE.TorusGeometry(0.12, 0.03, 8, 18), gm, rig.arms[i], 0.008); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.45;
    }
    return null;
  },
  shoes(o, rig) { // sapato (mocassim) cobrindo o casco
    const m = toon(o.color || '#111114');
    for (const leg of rig.legs) {
      const sh = M(new THREE.SphereGeometry(0.17, 18, 12), m, leg, 0.01); sh.position.set(0, -0.35, 0.07); sh.scale.set(1, 0.58, 1.45);
      const sole = M(new THREE.CylinderGeometry(0.17, 0.17, o.sole ? 0.045 : 0.03, 18), toon(o.sole || '#2a2a2a'), leg, 0); sole.position.set(0, -0.43, 0.07); sole.scale.z = 1.45;
      const strap = M(new THREE.BoxGeometry(0.2, 0.025, 0.05), toon(o.strap || '#2a2a30'), leg, 0); strap.position.set(0, -0.29, 0.2);
    }
    return null;
  },
  socks(o, rig) {
    const m = toon(o.color || '#ffffff');
    for (const leg of rig.legs) { const s = M(new THREE.CylinderGeometry(0.142, 0.142, 0.12, 18), m, leg, 0.008); s.position.y = -0.26; }
    return null;
  },

  // ---------- corpo ----------
  epaulettes(o, rig) { // dragonas douradas nos ombros
    const m = toon(o.color || '#e8b830');
    for (const piv of rig.arms) {
      const pad = M(new THREE.CylinderGeometry(0.17, 0.19, 0.05, 24), m, piv, 0.008); pad.position.y = 0.04;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const f = M(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 5), m, piv, 0); f.position.set(Math.cos(a) * 0.18, -0.02, Math.sin(a) * 0.18); }
    }
    return null;
  },
  puffer(o, rig) { // jaqueta bufante oversized com capuz nas costas
    const g = new THREE.Group(); const c = o.color || '#202329'; const m = toonWarm(c, 0.12);
    const shell = M(new THREE.LatheGeometry(TORSO_PTS.map((p) => new V2(p.x * 1.05 + 0.01, p.y)), 40), m, g, 0.014); shell.scale.z = 0.88;
    for (let i = 0; i < 4; i++) {
      const y = 0.52 + i * 0.14; const r = torsoR(y) * 1.03 + 0.03;
      const ring = M(new THREE.TorusGeometry(r, 0.06, 10, 40), m, g, 0.008); ring.rotation.x = Math.PI / 2; ring.position.y = y; ring.scale.y = 0.88;
    }
    const hood = M(new THREE.TorusGeometry(0.3, 0.11, 12, 28, Math.PI * 1.2), m, g, 0.01); hood.position.set(0, 1.12, -0.06); hood.rotation.set(Math.PI / 2 + 0.35, 0, Math.PI * -0.1 + Math.PI); 
    const zip = M(new THREE.BoxGeometry(0.03, 0.6, 0.02), basic(o.zipper || '#c9c9c9'), g, 0); zip.position.set(0, 0.76, 0.535); zip.rotation.x = -0.12;
    return g;
  },
  chain(o, rig) { // corrente grossa dourada com medalhão liso
    const g = new THREE.Group(); const gold = toonWarm(o.color || '#f2c230', 0.25, {}, '#ffb000');
    const a = 0.6; const ch = M(new THREE.TorusGeometry(0.34, 0.034, 10, 40), gold, g, 0.006); ch.rotation.x = -(Math.PI / 2 - a); ch.position.set(0, 1.06, 0.3);
    
    const med = new THREE.Group(); med.position.set(0, 0.75, 0.62); med.rotation.x = -0.25; g.add(med);
    const coin = M(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 32), gold, med, 0.008); coin.rotation.x = Math.PI / 2;
    M(new THREE.TorusGeometry(0.075, 0.012, 6, 28), toonWarm('#ffd860', 0.3), med, 0).position.z = 0.016;
    const bail = M(new THREE.TorusGeometry(0.03, 0.012, 6, 12), gold, med, 0); bail.position.y = 0.115;
    return g;
  },
  robe(o, rig) { // túnica longa de estudante de magia, aberta na frente
    if (rig.tail) rig.tail.visible = false; // rabinho fica por baixo da túnica
    const g = new THREE.Group(); const m = toonWarm(o.color || '#1b1b22', 0.1, { side: THREE.DoubleSide });
    const pts = [[0.24, 1.14], [0.42, 1.06], [0.53, 0.92], [0.56, 0.72], [0.59, 0.45], [0.64, 0.12], [0.66, 0.06]];
    const shell = M(lathe(pts, { phiStart: 0.42, phiLength: TAU - 0.84, seg: 44 }), m, g, 0.012); shell.scale.z = 0.92;
    const lin = new THREE.Mesh(lathe(pts.map(([r, y]) => [r * 0.985, y]), { phiStart: 0.42, phiLength: TAU - 0.84, seg: 44 }), toon(o.lining || '#8b1a1a', { side: THREE.BackSide })); lin.scale.z = 0.92; g.add(lin);
    const hood = M(new THREE.TorusGeometry(0.28, 0.08, 10, 24, Math.PI), m, g, 0.008); hood.position.set(0, 1.1, -0.12); hood.rotation.set(Math.PI / 2 + 0.6, 0, Math.PI);
    return g;
  },
  scarf(o, rig) { // cachecol listrado
    const g = new THREE.Group(); const cols = o.colors || ['#8b1a1a', '#d4a537'];
    const t1 = stripeTex(cols, 16), t2 = stripeTex(cols, 8, true);
    const ring = M(new THREE.TorusGeometry(0.29, 0.075, 12, 36), toon('#ffffff', { map: t1 }), g, 0.01); ring.rotation.x = Math.PI / 2; ring.position.y = 1.1; ring.scale.y = 0.9;
    for (const [x, rz, len] of [[0.12, 0.08, 0.46], [0.22, -0.05, 0.38]]) { const tail = M(new THREE.BoxGeometry(0.13, len, 0.04), toon('#ffffff', { map: t2 }), g, 0.008); tail.position.set(x, 1.08 - len / 2, 0.42); tail.rotation.set(-0.25, 0, rz); }
    return g;
  },
  wand(o, rig) { // varinha guardada no cinto
    const g = new THREE.Group(); const m = toon(o.color || '#6b4423');
    M(new THREE.CylinderGeometry(0.012, 0.02, 0.4, 8), m, g, 0.006).position.y = 0;
    M(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 8), toon('#3e2614'), g, 0.006).position.y = -0.15;
    g.position.set(-0.4, 0.58, 0.22); g.rotation.set(0.2, 0, -0.35); return g;
  },
  mandarinCollar(o, rig) {
    const g = new THREE.Group(); const m = toon(o.color || '#b3121b');
    M(new THREE.CylinderGeometry(0.25, 0.28, 0.1, 32, 1, true), toon(o.color || '#b3121b', { side: THREE.DoubleSide }), g, 0.008).position.y = 1.13;
    const e = M(new THREE.TorusGeometry(0.25, 0.012, 6, 32), toon(o.edge || '#f2c14e'), g, 0); e.rotation.x = Math.PI / 2; e.position.y = 1.18;
    return g;
  },
  vest(o, rig) { // colete de pescador com bolsos
    const g = new THREE.Group(); const c = o.color || '#c2ae7e'; const m = toonWarm(c, 0.1, { side: THREE.DoubleSide }); const dark = toon(o.pocket || '#a8925e');
    const pts = TORSO_PTS.filter((p) => p.y > 0.5 && p.y < 1.1).map((p) => new V2(p.x * 1.05 + 0.02, p.y));
    const shell = M(new THREE.LatheGeometry(pts, 40, 0.45, TAU - 0.9), m, g, 0.012); shell.scale.z = 0.88;
    for (const s of [-1, 1]) for (const y of [0.68, 0.9]) {
      const th = s * 0.68; const r = torsoR(y) * 1.05 + 0.03;
      const pk = new THREE.Group(); const pos = new V3(r * Math.sin(th), y, r * 0.88 * Math.cos(th)); pk.position.copy(pos); pk.lookAt(pos.clone().add(new V3(Math.sin(th), 0, 0.88 * Math.cos(th)))); g.add(pk);
      M(new THREE.BoxGeometry(0.17, 0.15, 0.05), dark, pk, 0.008).position.z = 0.02;
      const flap = M(new THREE.BoxGeometry(0.18, 0.05, 0.06), m, pk, 0.006); flap.position.set(0, 0.075, 0.035);
      M(new THREE.SphereGeometry(0.012, 6, 6), basic('#444'), pk, 0).position.set(0, 0.065, 0.07);
    }
    const ring = M(new THREE.TorusGeometry(0.03, 0.008, 6, 12), basic('#cfcfcf'), g, 0); ring.position.set(-0.3, 1.0, 0.38);
    return g;
  },
  fish(o, rig) { // peixe pendurado no cinto
    const g = new THREE.Group(); const m = toonWarm(o.color || '#7fb3d5', 0.15);
    M(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), basic('#e8e8e8'), g, 0).position.y = -0.08;
    const body = M(new THREE.SphereGeometry(0.1, 18, 12), m, g, 0.008); body.scale.set(0.55, 1.6, 1); body.position.y = -0.3;
    const tail = M(new THREE.ConeGeometry(0.08, 0.12, 3), m, g, 0.008); tail.position.y = -0.5; tail.scale.z = 0.3;
    for (const s of [-1, 1]) M(new THREE.SphereGeometry(0.014, 6, 6), basic('#111'), g, 0).position.set(s * 0.05, -0.2, 0.03);
    const belly = M(new THREE.SphereGeometry(0.06, 10, 8), toon('#e8f0f4'), g, 0); belly.scale.set(0.4, 1.6, 0.8); belly.position.set(0, -0.31, 0.04);
    g.position.set(0.43, 0.56, 0.12); g.rotation.z = 0.12; return g;
  },
  boltTail(o, rig) { // rabo em forma de raio (substitui o rabinho enrolado só nessa fantasia)
    if (rig.tail) rig.tail.visible = false;
    const pts = [[0, 0], [0.1, 0], [0.07, 0.17], [0.23, 0.17], [0.15, 0.34], [0.33, 0.34], [0.12, 0.64], [0.16, 0.44], [-0.01, 0.44], [0.07, 0.27], [-0.08, 0.27]];
    const sh = new THREE.Shape(pts.map(([x, y]) => new V2(x, y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
    const g = new THREE.Group(); M(geo, toonWarm(o.color || '#ffd23a', 0.15), g, 0.008);
    const base = M(new THREE.BoxGeometry(0.13, 0.08, 0.08), toon(o.base || '#7a4a1c'), g, 0.006); base.position.set(0.05, 0.03, 0.025);
    g.position.set(0, 0.58, -0.4); g.rotation.set(0, Math.PI / 2, 0.25); g.scale.setScalar(1.25); return g;
  },
});

// ---------- estampas novas na camiseta/macacão ----------
Object.assign(SHIRT_DETAILS, {
  bones(x, d, PT, W) { // macacão de esqueleto: costelas, coluna e bacia em branco + brilho verde
    const c = d.color || '#f7f7f2', glow = d.glow || '#8dff6a';
    const line = (pts, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p))); x.stroke(); };
    for (const [col, extra] of [[glow, 8], [c, 0]]) {
      line([PT(0, 1.08), PT(0, 0.5)], 18 + extra, col); // coluna/esterno
      for (let i = 0; i < 4; i++) { const y = 1.0 - i * 0.1; for (const s of [-1, 1]) line([PT(0, y), PT(s * 0.25, y - 0.015), PT(s * 0.48, y - 0.06)], 13 + extra, col); } // costelas (frente)
      for (const s of [-1, 1]) line([PT(s * 0.18, 0.5), PT(s * 0.38, 0.44), PT(s * 0.32, 0.4)], 15 + extra, col); // bacia
      line([PT(Math.PI, 1.08), PT(Math.PI, 0.45)], 16 + extra, col); // coluna nas costas
      for (let i = 0; i < 5; i++) { const y = 1.0 - i * 0.1; line([PT(Math.PI - 0.3, y), PT(Math.PI + 0.3, y)], 10 + extra, col); }
    }
    for (let i = 0; i < 6; i++) { const p = PT(0, 1.04 - i * 0.1); x.fillStyle = '#1a1a1a'; x.fillRect(p[0] - 9, p[1] - 2, 18, 4); } // vértebras
  },
  tunicWrap(x, d, PT) { // túnica em camadas: lapelas cruzadas
    const c = d.color || '#b89f72', c2 = d.inner || '#efe3c6';
    x.fillStyle = c2; x.beginPath(); x.moveTo(...PT(-0.28, 1.12)); x.lineTo(...PT(0.28, 1.12)); x.lineTo(...PT(0, 0.82)); x.closePath(); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = c; x.beginPath(); x.moveTo(...PT(s * 0.3, 1.12)); x.lineTo(...PT(s * 0.18, 1.12)); x.lineTo(...PT(-s * 0.22, 0.56)); x.lineTo(...PT(-s * 0.36, 0.56)); x.closePath(); x.fill(); }
    x.strokeStyle = 'rgba(60,40,20,.45)'; x.lineWidth = 4; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(...PT(s * 0.18, 1.12)); x.lineTo(...PT(-s * 0.22, 0.56)); x.stroke(); }
  },
  stillsuit(x, d, PT, W) { // traje de deserto: nervuras, painéis, tubos e válvulas
    const rib = d.rib || '#1b1d20', tube = d.tube || '#8a8f96', panel = d.panel || '#3a3e44';
    for (const s of [-1, 1]) { x.fillStyle = panel; x.beginPath(); x.moveTo(...PT(s * 0.12, 1.02)); x.lineTo(...PT(s * 0.5, 0.98)); x.lineTo(...PT(s * 0.52, 0.72)); x.lineTo(...PT(s * 0.14, 0.76)); x.closePath(); x.fill(); }
    x.strokeStyle = rib; x.lineWidth = 5; for (let y = 0.45; y < 1.1; y += 0.045) { const a = PT(-Math.PI, y), b = PT(Math.PI, y); if (Math.abs(y - 0.87) < 0.15) continue; x.beginPath(); x.moveTo(0, a[1]); x.lineTo(W, b[1]); x.stroke(); }
    x.strokeStyle = tube; x.lineWidth = 12; x.lineCap = 'round';
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(...PT(s * 0.08, 0.5)); x.bezierCurveTo(...PT(s * 0.22, 0.7), ...PT(s * 0.06, 0.9), ...PT(s * 0.2, 1.1)); x.stroke(); }
    x.fillStyle = '#c9cdd2'; for (const s of [-1, 1]) for (const y of [0.62, 0.95]) { const p = PT(s * 0.33, y); x.beginPath(); x.arc(p[0], p[1], 10, 0, Math.PI * 2); x.fill(); x.strokeStyle = rib; x.lineWidth = 3; x.stroke(); }
    const b = PT(0, 0.52); x.fillStyle = '#4a4036'; x.fillRect(0, b[1] - 12, W, 24); // cinto
  },
});

Object.assign(PARTS, {
  // ---------- Fantasminha ----------
  ghostSheet(o, rig) { // lençol de fantasma: capuz com abertura pro rosto + manto até perto do chão com barra ondulada e brilho ciano
    hideTuft(rig); const g = new THREE.Group(); const c = o.color || '#f6fbff';
    const sheetM = toonWarm(c, 0.18, { side: THREE.DoubleSide, transparent: true, opacity: o.opacity || 0.93 }, '#bdf6ff');
    const rimM = new THREE.MeshBasicMaterial({ color: o.rim || '#bff8ff', transparent: true, opacity: 0.45, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending });
    // capuz (rosto, focinho, olhos e orelhas aparecem)
    const hoodG = new THREE.Group(); hoodG.position.set(0, 1.52, -0.02); hoodG.userData.anchor = 'head';
    const hoodM = toonWarm(c, 0.18, { side: THREE.DoubleSide }, '#bdf6ff');
    const shell = M(new THREE.SphereGeometry(0.64, 44, 30, 0, TAU, 0.92, Math.PI - 0.92), hoodM, hoodG, 0.012); shell.rotation.x = Math.PI / 2 - 0.22; shell.scale.set(1.03, 1.02, 0.97);
    // dobrinhas do lençol caindo dos lados do rosto
    for (const sx of [-1, 1]) { const fold = M(new THREE.CapsuleGeometry(0.07, 0.3, 4, 10), hoodM, hoodG, 0.008); fold.position.set(sx * 0.5, -0.32, 0.28); fold.rotation.set(0.2, 0, sx * 0.25); }
    rig.head.add(hoodG);
    // manto com barra ondulada
    const pts = [[0.26, 1.2], [0.48, 1.1], [0.58, 0.92], [0.63, 0.65], [0.68, 0.38], [0.72, 0.2], [0.73, 0.14]];
    const geo = lathe(pts, { seg: 56 }); const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < 0.4) { const th = Math.atan2(pos.getX(i), pos.getZ(i)); const k = (0.4 - y) / 0.26; pos.setY(i, y + Math.sin(th * 7) * 0.07 * k); const rr = 1 + Math.cos(th * 7) * 0.04 * k; pos.setX(i, pos.getX(i) * rr); pos.setZ(i, pos.getZ(i) * rr); } }
    geo.computeVertexNormals();
    const drape = M(geo, sheetM, g, 0.012); drape.scale.z = 0.9;
    const glow = new THREE.Mesh(geo, rimM); glow.scale.set(1.05, 1.0, 0.95); g.add(glow);
    if (rig.tail) rig.tail.visible = false; // rabinho fica embaixo do lençol
    g.userData.float = true; return g;
  },
  // ---------- Esqueletão ----------
  boneLimbs(o, rig) { // ossos pintados nas mangas e nas pernas do macacão
    const bm = basic(o.color || '#f7f7f2'), glow = new THREE.MeshBasicMaterial({ color: o.glow || '#8dff6a', transparent: true, opacity: 0.55 });
    const bone = (parent, x, y0, y1, z, r = 0.03) => {
      const sh = M(new THREE.CapsuleGeometry(r, y0 - y1, 4, 8), bm, parent, 0.004); sh.position.set(x, (y0 + y1) / 2, z);
      for (const y of [y0, y1]) for (const k of [-1, 1]) M(new THREE.SphereGeometry(r * 1.35, 10, 8), bm, parent, 0.004).position.set(x + k * r, y, z);
      const gl = new THREE.Mesh(new THREE.CapsuleGeometry(r * 1.9, y0 - y1, 4, 8), glow); gl.position.set(x, (y0 + y1) / 2, z - 0.012); parent.add(gl);
    };
    for (const piv of rig.arms) bone(piv, 0, -0.05, -0.38, 0.16, 0.026);
    for (const leg of rig.legs) {
      M(new THREE.CapsuleGeometry(0.145, 0.16, 4, 14), toon(o.suit || '#16161a'), leg, 0.01).position.y = -0.17; // perna do macacão
      bone(leg, 0, -0.04, -0.28, 0.15, 0.028);
    }
    return null;
  },
  // ---------- Cavaleiro Galáctico ----------
  sash(o, rig) { // faixa/cinto largo marrom com fivela e pontas
    const g = new THREE.Group(); const m = toon(o.color || '#6b4a2b');
    const r = torsoR(0.56) * 1.02 + 0.03; const band = M(new THREE.CylinderGeometry(r, r * 1.02, 0.14, 40, 1, true), toon(o.color || '#6b4a2b', { side: THREE.DoubleSide }), g, 0.008); band.position.y = 0.56; band.scale.z = 0.88;
    const belt = M(new THREE.TorusGeometry(r + 0.01, 0.022, 6, 40), toon(o.belt || '#3e2a18'), g, 0); belt.rotation.x = Math.PI / 2; belt.position.y = 0.53; belt.scale.y = 0.88;
    const buckle = M(new THREE.BoxGeometry(0.1, 0.07, 0.03), toon(o.buckle || '#c9c2b0'), g, 0.006); buckle.position.set(0, 0.53, r * 0.88 + 0.02);
    for (const [x, y] of [[0.3, 0.62], [-0.3, 0.62]]) { const pouch = M(new THREE.BoxGeometry(0.09, 0.08, 0.05), m, g, 0.006); pouch.position.set(x, 0.52, r * 0.82); pouch.rotation.y = x > 0 ? 0.5 : -0.5; }
    const tab = M(new THREE.BoxGeometry(0.16, 0.3, 0.03), toon(o.tabard || '#b89f72'), g, 0.006); tab.position.set(0, 0.36, r * 0.88 - 0.01); tab.rotation.x = -0.05;
    return g;
  },
  laserSword(o, rig) { // espada laser presa no cinto (lâmina brilhante)
    const g = new THREE.Group();
    const metal = toon('#c9ccd2'), dark = toon('#2a2c30');
    M(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 14), metal, g, 0.006);
    for (const y of [-0.06, -0.02, 0.02]) M(new THREE.CylinderGeometry(0.033, 0.033, 0.018, 14), dark, g, 0).position.y = y;
    M(new THREE.CylinderGeometry(0.036, 0.03, 0.04, 14), dark, g, 0.005).position.y = 0.12;
    const bladeC = o.blade || '#7DF9FF';
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.62, 12), basic('#f2ffff')); blade.position.y = 0.45; g.add(blade);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.66, 14), new THREE.MeshBasicMaterial({ color: bladeC, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.y = 0.45; g.add(halo);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), halo.material); tip.position.y = 0.78; g.add(tip);
    g.position.set(-0.47, 0.5, 0.12); g.rotation.set(0.35, 0, 2.55); return g; // lâmina pra baixo e pra trás
  },
  armWraps(o, rig) { // faixas enroladas nas mangas (também aparecem nos braços em 1ª pessoa)
    const m = toon(o.color || '#6b4a2b');
    for (const piv of rig.arms) for (const y of o.ys || [-0.14, -0.26, -0.38]) { const w = M(new THREE.TorusGeometry(0.15, 0.022, 8, 20), m, piv, 0.004); w.rotation.x = Math.PI / 2; w.position.y = y; }
    return null;
  },
  hoodDown(o, rig) { // capuz abaixado, amontoado nas costas da capa
    const g = new THREE.Group(); const m = toonWarm(o.color || '#5a3b22', 0.1, { side: THREE.DoubleSide });
    const h = M(new THREE.SphereGeometry(0.3, 28, 16, 0, TAU, 0, Math.PI * 0.62), m, g, 0.01); h.scale.set(1.25, 0.75, 0.55); h.rotation.x = Math.PI * 0.92;
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), toon(o.inner || '#3e2716')); inner.scale.set(1.3, 0.55, 1); inner.position.set(0, 0.07, 0.02); inner.rotation.x = -Math.PI / 2 + 0.3; g.add(inner);
    g.position.set(0, 0.98, -0.44); return g;
  },
  // ---------- Nômade do Deserto ----------
  noseTube(o, rig) { // tubo do traje que sobe do colarinho até o lado do focinho (sem cobrir o focinho)
    const g = new THREE.Group(); g.userData.anchor = 'head'; const m = toon(o.color || '#3a3e44');
    for (const s of [-1, 1]) {
      const end = headPoint(s * 0.42, 1.4, 0.03);
      const curve = new THREE.CatmullRomCurve3([new V3(s * 0.2, 1.1, 0.32), headPoint(s * 0.85, 1.16, 0.035), headPoint(s * 0.7, 1.27, 0.03), end]);
      M(new THREE.TubeGeometry(curve, 28, 0.02, 8, false), m, g, 0.006);
      const plug = M(new THREE.SphereGeometry(0.034, 12, 10), toon(o.plug || '#8a8f96'), g, 0.005); plug.position.copy(end);
    }
    return g;
  },
  desertScarf(o, rig) { // lenço de areia enrolado no pescoço com ponta caída
    const g = new THREE.Group(); const m = toonWarm(o.color || '#c9a66b', 0.12);
    for (const [y, r] of [[1.1, 0.3], [1.17, 0.27]]) { const t = M(new THREE.TorusGeometry(r, 0.07, 10, 32), m, g, 0.008); t.rotation.x = Math.PI / 2; t.position.y = y; t.scale.y = 0.88; }
    const tail = M(new THREE.BoxGeometry(0.2, 0.42, 0.04), m, g, 0.008); tail.position.set(0.28, 0.9, -0.28); tail.rotation.set(0.25, -0.6, -0.15);
    return g;
  },
});

// ============================================================
//  Skins novas: Boi Caprichoso, Docão Felipe, Docão Matheus
// ============================================================
// cabelo que acompanha o formato da cabeça, com linha do cabelo por ângulo (θ = 0 é a testa)
function hairCap(hairline, off = 0.03, bulge = 0.04, cols = 48, rows = 12) {
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const u = j / rows;
    for (let i = 0; i <= cols; i++) {
      const th = -Math.PI + (i / cols) * TAU; const y0 = hairline(th);
      const y = y0 + (HEAD.y1 - y0) * Math.pow(u, 0.8); const r = headR(y) + off + bulge * Math.sin(Math.PI * Math.min(1, u * 1.3)) * (j === rows ? 0 : 1);
      pos.push(r * Math.sin(th), y + bulge * 0.6 * u, r * HEAD.zs * Math.cos(th));
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + cols + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
// mecha cônica ancorada na superfície do cabelo
function tuft(g, m, th, y, out, len, rad, tilt = 0, twist = 0) {
  const p = headPoint(th, y, out), n = headNormal(th, y);
  const c = M(new THREE.ConeGeometry(rad, len, 10), m, g, 0.008);
  c.position.copy(p).addScaledVector(n, len * 0.3);
  const dir = n.clone().add(new V3(0, 0.9 + tilt, 0)).normalize(); dir.applyAxisAngle(new V3(0, 1, 0), twist);
  c.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir); c.scale.z = 0.7; return c;
}
// tubo afinando até a ponta (chifres)
function taperTube(curve, r0, r1, seg = 20, rad = 10) {
  const geo = new THREE.TubeGeometry(curve, seg, 1, rad, false); const p = geo.attributes.position;
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg); const r = r0 + (r1 - r0) * Math.pow(i / seg, 0.9);
    for (let k = 0; k <= rad; k++) { const v = i * (rad + 1) + k; p.setXYZ(v, c.x + (p.getX(v) - c.x) * r, c.y + (p.getY(v) - c.y) * r, c.z + (p.getZ(v) - c.z) * r); }
  }
  geo.computeVertexNormals(); return geo;
}
function starPath(x, cx, cy, rx, ry, rot = 0, inner = 0.45) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, k = i % 2 ? inner : 1; const px = cx + Math.sin(a) * rx * k, py = cy - Math.cos(a) * ry * k; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.closePath();
}

Object.assign(SHIRT_DETAILS, {
  star(x, d, PT) { // estrela grande no peito (+ estrelinhas espalhadas)
    const c = d.color || '#ffffff', y = d.y || 0.8, sz = d.size || 0.17;
    const px = (PT(0.1, y)[0] - PT(0, y)[0]) / (0.1 * torsoR(y)), py = (PT(0, y - 0.05)[1] - PT(0, y + 0.05)[1]) / 0.1;
    const [cx, cy] = PT(d.x || 0, y);
    if (d.outline) { starPath(x, cx, cy, sz * px * 1.18, sz * py * 1.18); x.fillStyle = d.outline; x.fill(); }
    starPath(x, cx, cy, sz * px, sz * py); x.fillStyle = c; x.fill();
    for (const [th, yy, s] of d.small || []) { const [sx, sy] = PT(th, yy); starPath(x, sx, sy, s * px, s * py, th); x.fillStyle = c; x.fill(); }
  },
  zigzag(x, d, PT, W) { // barra em ziguezague (franja festiva)
    const c = d.color || '#ffffff', y = PT(0, d.y || 0.47)[1], h = d.h || 22;
    x.fillStyle = c; x.fillRect(0, y, W, h * 0.6);
    x.beginPath(); x.moveTo(0, y); for (let k = 0; k <= W; k += 32) { x.lineTo(k + 16, y - h); x.lineTo(k + 32, y); } x.closePath(); x.fill();
  },
  diagStripes(x, d, PT) { // listras diagonais esportivas nas laterais e nos ombros
    const c = d.color || '#1fb89a';
    x.save(); x.strokeStyle = c; x.lineCap = 'round';
    for (const s of [-1, 1]) for (const [th, y0, n] of [[0.95, 0.62, 7], [1.55, 0.5, 9], [2.2, 0.62, 6]]) for (let k = 0; k < n; k++) {
      const a = PT(s * (th - 0.25 + k * 0.07), y0 + k * 0.045), b = PT(s * (th - 0.05 + k * 0.07), y0 + 0.16 + k * 0.045);
      x.lineWidth = 7 + (k % 3) * 3; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke();
    }
    x.restore();
  },
  polo(x, d, PT) { // camisa polo: filete da gola e um botão
    const c = d.color || '#24160e', btn = d.button || '#e6d3b0';
    x.strokeStyle = c; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.moveTo(...PT(0, 1.08)); x.lineTo(...PT(0, 0.88)); x.stroke();
    const [bx, by] = PT(0, 0.9);
    x.fillStyle = btn; x.beginPath(); x.arc(bx, by, 8, 0, TAU); x.fill();
    x.strokeStyle = c; x.lineWidth = 3; x.stroke();
  },
  hoodie(x, d, PT, W) { // moletom: zíper prateado, bolso canguru e barra canelada
    const c = d.color || '#0e0e10', zip = d.zip || '#a8acb2';
    x.strokeStyle = c; x.lineWidth = 5;
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(...PT(s * 0.06, 0.48)); x.lineTo(...PT(s * 0.5, 0.48)); x.lineTo(...PT(s * 0.4, 0.68)); x.lineTo(...PT(s * 0.06, 0.68)); x.stroke(); }
    x.strokeStyle = zip; x.lineWidth = 7; x.beginPath(); x.moveTo(...PT(0, 1.12)); x.lineTo(...PT(0, 0.42)); x.stroke();
    x.fillStyle = zip; const t = PT(0, 0.95); x.fillRect(t[0] - 6, t[1], 12, 22);
    const b = PT(0, 0.44); x.fillStyle = c; x.fillRect(0, b[1] - 10, W, 20);
  },
});

Object.assign(PARTS, {
  // ---------- Boi Caprichoso ----------
  boiHorns(o, rig) { // chifrinhos de boi curvados (brancos), entre as orelhas e a testa
    const g = new THREE.Group(); const m = toonWarm(o.color || '#fbfbf6', 0.12, {}, '#cfe0ff'), tip = toon(o.tip || '#dfe6f2');
    for (const s of [-1, 1]) {
      const b = headPoint(s * 0.72, 1.93, -0.02), n = headNormal(s * 0.72, 1.93);
      const pts = [b, b.clone().addScaledVector(n, 0.13).add(new V3(s * 0.05, 0.03, 0)), b.clone().addScaledVector(n, 0.2).add(new V3(s * 0.08, 0.14, 0.02)), b.clone().addScaledVector(n, 0.17).add(new V3(s * 0.03, 0.27, 0.06))];
      const curve = new THREE.CatmullRomCurve3(pts);
      M(taperTube(curve, 0.075, 0.012), m, g, 0.01);
      const ring = M(new THREE.TorusGeometry(0.07, 0.022, 8, 18), toon(o.band || '#1b4fbf'), g, 0.006); ring.position.copy(curve.getPointAt(0.12)); ring.lookAt(ring.position.clone().add(curve.getTangentAt(0.12)));
      void tip;
    }
    return onHead(g);
  },
  ribbonSkirt(o, rig) { // saiote de fitas festivas na cintura (azul, branco e um toque de cor)
    const g = new THREE.Group(); const cols = o.colors || ['#1b4fbf', '#ffffff', '#0b2f86', '#ffffff', '#3d8bff'];
    const r = 0.44, n = 26;
    const band = M(new THREE.TorusGeometry(r, 0.045, 8, 44), toon(o.band || '#ffffff'), g, 0.008); band.rotation.x = Math.PI / 2; band.position.y = 0.57; band.scale.y = 0.86;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU; const len = 0.26 + ((i * 7) % 5) * 0.012;
      const rb = M(new THREE.BoxGeometry(0.085, len, 0.018), toon(cols[i % cols.length], { side: THREE.DoubleSide }), g, 0.005);
      rb.position.set(Math.sin(a) * (r + 0.02), 0.56 - len / 2, Math.cos(a) * (r + 0.02) * 0.86); rb.rotation.y = a; rb.rotation.x = 0.16; rb.rotation.order = 'YXZ';
    }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.3; const st = M(new THREE.SphereGeometry(0.028, 8, 6), basic('#ffffff'), g, 0); st.position.set(Math.sin(a) * (r + 0.05), 0.57, Math.cos(a) * (r + 0.05) * 0.86); }
    if (rig.tail) rig.tail.position.z -= 0.08;
    return g;
  },
  // ---------- Docão Felipe ----------
  messyHair(o, rig) { // cabelo volumoso e bagunçado, castanho-escuro
    hideTuft(rig); const g = new THREE.Group(); const m = toonWarm(o.color || '#3a2416', 0.12, { side: THREE.DoubleSide });
    const line = (th) => { const a = Math.abs(th); return a < 0.7 ? 1.98 - a * 0.05 : a < 1.7 ? 1.945 - (a - 0.7) * 0.2 : 1.745 - (a - 1.7) * 0.1; };
    M(hairCap(line, 0.035, 0.1), m, g, 0.014);
    // mechas espetadas em volta e no topo
    const ring = [[0, 1.99, 0.16, 0.1], [0.3, 1.985, 0.17, 0.09], [-0.3, 1.985, 0.15, 0.09], [0.6, 1.96, 0.16, 0.09], [-0.6, 1.96, 0.17, 0.09], [0.95, 1.9, 0.15, 0.085], [-0.95, 1.9, 0.15, 0.085],
      [1.35, 1.86, 0.15, 0.085], [-1.35, 1.86, 0.15, 0.085], [1.8, 1.82, 0.14, 0.08], [-1.8, 1.82, 0.14, 0.08], [2.3, 1.8, 0.14, 0.08], [-2.3, 1.8, 0.14, 0.08], [2.8, 1.82, 0.14, 0.08], [-2.8, 1.82, 0.14, 0.08], [Math.PI, 1.84, 0.14, 0.08]];
    ring.forEach(([th, y, len, rad], i) => tuft(g, m, th, y + 0.03, 0.09, len, rad, -0.5 + (i % 3) * 0.25, (i % 2 ? 0.4 : -0.4)));
    for (let i = 0; i < 14; i++) { const th = 1.45 + (i / 13) * (TAU - 2.9); const a = th > Math.PI ? th - TAU : th; tuft(g, m, a, line(a) + 0.03, 0.05, 0.14, 0.075, -1.2, i % 2 ? 0.3 : -0.3); } // nuca desfiada
    for (const [th, y, len] of [[0.2, 2.03, 0.2], [-0.4, 2.02, 0.18], [1.2, 1.99, 0.18], [-1.2, 2.0, 0.17], [2.6, 1.98, 0.17], [-2.4, 1.99, 0.18], [0.8, 2.02, 0.17]]) tuft(g, m, th, y, 0.08, len, 0.085, 0.6);
    // franja caindo de lado na testa
    for (const [th, rz, len] of [[-0.05, -0.9, 0.24], [0.2, -1.05, 0.22], [-0.3, -0.7, 0.2], [0.45, -1.2, 0.18]]) {
      const p = headPoint(th, 1.985, 0.07); const c = M(new THREE.ConeGeometry(0.075, len, 10), m, g, 0.008); c.position.copy(p); c.rotation.set(0.9, 0, rz); c.scale.z = 0.6;
    }
    return onHead(g);
  },
  squareGlasses(o, rig) { // óculos de armação grossa, retangular e preta (prende na cabeça, como os outros óculos)
    const g = new THREE.Group(); const m = toon(o.color || '#121214'), lensM = new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.12, depthWrite: false });
    const W = 0.36, H = 0.3, T = 0.05, R = 0.06;
    const rr = (s, w, h, r) => { s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); };
    const sh = new THREE.Shape(); rr(sh, W, H, R); const hole = new THREE.Path(); rr(hole, W - T * 2, H - T * 2, R * 0.5); sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 6 });
    const ends = [];
    rig.eyes.forEach((e, i) => {
      const s = i === 0 ? -1 : 1; const f = new THREE.Group(); f.position.copy(e.position).addScaledVector(e.userData.n, 0.07); f.lookAt(f.position.clone().add(e.userData.n)); g.add(f);
      M(geo, m, f, 0.008).position.z = -0.02;
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(W - T * 2, H - T * 2), lensM); lens.position.z = 0.0; f.add(lens);
      ends.push({ f, s });
    });
    const a = ends[0].f.position, b = ends[1].f.position; const mid = a.clone().add(b).multiplyScalar(0.5);
    const br = M(new THREE.BoxGeometry(Math.max(0.04, a.distanceTo(b) - W * 0.9), 0.045, 0.04), m, g, 0.006); br.position.copy(mid); br.position.y += 0.06; br.position.z += 0.01;
    for (const { f, s } of ends) { // hastes até as orelhas
      const p0 = new V3(s * W / 2, 0.04, -0.01); f.localToWorld(p0); g.worldToLocal(p0);
      const p1 = headPoint(s * 1.45, 1.76, 0.015);
      const len = p0.distanceTo(p1); const arm = M(new THREE.BoxGeometry(0.035, 0.045, len), m, g, 0.006); arm.position.copy(p0).add(p1).multiplyScalar(0.5); arm.lookAt(p1);
    }
    return onHead(g);
  },
  sleeveStripes(o, rig) { // listras diagonais nas mangas (também em 1ª pessoa)
    const m = toon(o.color || '#1fb89a');
    for (const [i, piv] of rig.arms.entries()) for (const y of [-0.02, -0.08, -0.14]) { const t = M(new THREE.TorusGeometry(0.163, 0.014, 6, 24), m, piv, 0); t.rotation.set(Math.PI / 2, 0.45 * (i ? 1 : -1), 0); t.position.y = y; }
    return null;
  },
  shortsStripes(o, rig) { // faixas laterais no shorts
    const g = new THREE.Group(); const m = toon(o.color || '#1fb89a');
    for (const s of [-1, 1]) for (const dz of [-0.035, 0.035]) { const b = M(new THREE.BoxGeometry(0.02, 0.22, 0.03), m, g, 0); b.position.set(s * 0.413, 0.47, dz); }
    return g;
  },
  // ---------- Docão Matheus ----------
  quiffHair(o, rig) { // cabelo curto: laterais baixinhas e topete na frente
    hideTuft(rig); const g = new THREE.Group(); const m = toonWarm(o.color || '#2e1c12', 0.12, { side: THREE.DoubleSide }), side = toonWarm(o.side || '#3a281c', 0.1, { side: THREE.DoubleSide });
    const top = (th) => { const a = Math.abs(th); return a < 0.8 ? 1.985 : a < 1.8 ? 1.985 - (a - 0.8) * 0.15 : 1.835 - (a - 1.8) * 0.08; };
    const sides = (th) => { const a = Math.abs(th); return a < 0.9 ? 1.99 : a < 1.7 ? 1.97 - (a - 0.9) * 0.3 : 1.73 - (a - 1.7) * 0.07; };
    M(hairCap(sides, 0.018, 0.0), side, g, 0.01);
    M(hairCap(top, 0.04, 0.05), m, g, 0.013);
    // topete: mechas pra cima e pra trás na frente
    for (const [th, len, rad, tw] of [[0.0, 0.27, 0.12, 0.0], [0.28, 0.24, 0.11, 0.3], [-0.28, 0.22, 0.11, -0.3], [0.55, 0.18, 0.1, 0.4], [-0.55, 0.17, 0.1, -0.4], [0.14, 0.25, 0.1, 0.15]]) {
      const p = headPoint(th, 1.99, 0.06); const c = M(new THREE.ConeGeometry(rad, len, 12), m, g, 0.008);
      c.position.copy(p).add(new V3(0, 0.07, -0.02)); c.rotation.set(-0.55, tw, -th * 0.5); c.scale.z = 0.8;
    }
    return onHead(g);
  },
  beard(o, rig) { // bigode ralo embaixo do focinho (a barba por fazer é pintada no rosto, salvo o.stubble === false)
    const g = new THREE.Group(); const m = toonWarm(o.color || '#3a2618', 0.05);
    for (const s of [-1, 1]) {
      const p = headPoint(s * 0.2, 1.32, 0.035); const c = M(new THREE.CapsuleGeometry(0.024, 0.12, 4, 8), m, g, 0.003);
      c.position.copy(p).add(new V3(0, 0, 0.065)); c.rotation.set(0, 0, s * 1.25); c.scale.z = 0.5;
    }
    if (o.soul) { // mosquinha sob a boca; só quando a skin pede (os outros bigodes não ganham)
      const p = headPoint(0, 1.16, 0.02);
      const patch = M(new THREE.CapsuleGeometry(0.014, 0.03, 3, 6), m, g, 0.003);
      patch.position.copy(p).add(new V3(0, -0.012, 0.02)); patch.scale.set(0.7, 1, 0.4);
    }
    return onHead(g);
  },
  hoodStrings(o, rig) { // cordões brancos do capuz
    const g = new THREE.Group(); const m = toon(o.color || '#f4f4f4');
    for (const [s, len] of [[-1, 0.26], [1, 0.22]]) {
      const top = 1.08, x = s * 0.1; const z = (y) => torsoR(y) * 0.85 + 0.025;
      const curve = new THREE.CatmullRomCurve3([new V3(x, top, z(top) - 0.04), new V3(x * 1.05, top - len * 0.5, z(top - len * 0.5)), new V3(x * 1.1, top - len, z(top - len))]);
      M(new THREE.TubeGeometry(curve, 10, 0.014, 6, false), m, g, 0.004);
      const tip = M(new THREE.CylinderGeometry(0.02, 0.018, 0.05, 8), toon('#d8d8d8'), g, 0.004); tip.position.copy(curve.getPointAt(1)).add(new V3(0, -0.02, 0));
    }
    return g;
  },
  lanyard(o, rig) { // cordão vermelho no pescoço com crachá branco do logo C!
    const g = new THREE.Group(); const m = toon(o.color || '#d81e2a');
    const z = (y) => torsoR(y) * 0.85 + 0.03; const by = 0.74;
    for (const s of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([new V3(0, 1.15, -0.27), new V3(s * 0.24, 1.15, -0.08), new V3(s * 0.25, 1.1, 0.2), new V3(s * 0.16, 0.98, z(0.98)), new V3(s * 0.04, by + 0.13, z(by + 0.13))]);
      M(new THREE.TubeGeometry(curve, 24, 0.017, 6, false), m, g, 0.004);
    }
    const badge = new THREE.Group(); badge.position.set(0, by, z(by) + 0.01); badge.rotation.x = -0.12; g.add(badge);
    M(new THREE.BoxGeometry(0.17, 0.21, 0.02), toon('#fbfbfb'), badge, 0.006);
    M(new THREE.BoxGeometry(0.05, 0.03, 0.025), toon('#9aa0a6'), badge, 0).position.y = 0.115;
    const tex = canvasTex(128, 160, (x, W, H) => { x.fillStyle = '#fbfbfb'; x.fillRect(0, 0, W, H); x.fillStyle = '#d81e2a'; x.fillRect(0, H - 24, W, 24); drawLogo(x, W / 2, H * 0.44, 74, o.logo || '#d81e2a'); });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.19), new THREE.MeshBasicMaterial({ map: tex })); face.position.z = 0.0115; badge.add(face);
    return g;
  },
  longPants(o, rig) { // calça comprida cobrindo as pernas
    const m = toon(o.color || '#141416');
    for (const leg of rig.legs) M(new THREE.CapsuleGeometry(0.15, 0.16, 4, 14), m, leg, 0.01).position.y = -0.15;
    return null;
  },
  // Faixa presidencial: banda diagonal no peito (ombro direito → quadril esquerdo), verde/amarela/azul, com o brasão no centro.
  faixa(o, rig) {
    const g = new THREE.Group();
    const GREEN = (o.colors && o.colors[0]) || '#009c3b';
    const YELLOW = (o.colors && o.colors[1]) || '#ffdf00';
    const BLUE = (o.colors && o.colors[2]) || '#002776';
    const hug = (x, y, z, lift = 0.03) => {
      const yy = Math.max(0.42, Math.min(1.12, y));
      const R = torsoR(yy);
      const sx = x, sz = z / 0.85, d = Math.hypot(sx, sz);
      if (d < R + lift) { const k = (R + lift) / (d || 1); return new V3(sx * k, y, sz * k * 0.85); }
      return new V3(x, y, z);
    };
    // ombro direito do Docão é −x (a mão direita é arms[0])
    const curve = new THREE.CatmullRomCurve3([
      hug(-0.22, 0.98, -0.46, 0.02),
      new V3(-0.55, 1.08, 0.02),
      hug(-0.28, 0.96, 0.28, 0.035),
      hug(-0.12, 0.82, 0.36, 0.04),
      hug(0.04, 0.70, 0.40, 0.04),
      hug(0.20, 0.56, 0.34, 0.035),
      hug(0.32, 0.44, 0.16, 0.03),
      new V3(0.30, 0.30, 0.28),
      new V3(0.22, 0.16, 0.34),
    ], false, 'centripetal');
    const frames = [];
    let prevB = null;
    const SAMPLES = 32;
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const radial = new V3(p.x, p.y > 1.05 ? 0.4 : 0, p.z);
      if (radial.lengthSq() < 1e-5) radial.set(0, 0, 1);
      radial.normalize();
      let B = new V3().crossVectors(tan, radial);
      if (B.lengthSq() < 1e-6) B = new V3().crossVectors(tan, new V3(0, 1, 0));
      B.normalize();
      if (prevB && B.dot(prevB) < 0) B.negate();
      let N = new V3().crossVectors(B, tan).normalize();
      if (N.dot(radial) < 0) { N.negate(); B.negate(); }
      if (prevB && B.dot(prevB) < 0) { B.negate(); N.negate(); }
      prevB = B.clone();
      frames.push({ p, tan, B, N });
    }
    const stripe = (offset, half, color, lift) => {
      const pos = [], idx = [];
      frames.forEach((f, i) => {
        const c = f.p.clone().addScaledVector(f.B, offset).addScaledVector(f.N, lift);
        const a = c.clone().addScaledVector(f.B, -half), b = c.clone().addScaledVector(f.B, half);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, toon(color, { side: THREE.DoubleSide }));
      g.add(mesh); outline(mesh, 0.006); mesh.castShadow = true;
    };
    // borda escura + três faixas. O lado +B fica mais alto no peito: verde em cima, amarelo no meio, azul embaixo.
    stripe(0, 0.112, '#1a120c', 0.012);
    stripe(0.07, 0.034, GREEN, 0.022);
    stripe(0, 0.034, YELLOW, 0.024);
    stripe(-0.07, 0.034, BLUE, 0.022);
    // brasão no meio do peito, virado pra fora, estrela pra cima
    let best = frames[0], score = 99;
    for (const f of frames) { const s = Math.abs(f.p.y - 0.72) + Math.abs(f.p.x) * 0.25; if (f.p.z > 0.15 && s < score) { score = s; best = f; } }
    const up = new V3(0, 1, 0);
    let xAxis = new V3().crossVectors(up, best.N).normalize();
    if (xAxis.lengthSq() < 0.2) xAxis = new V3(1, 0, 0);
    const yAxis = new V3().crossVectors(best.N, xAxis).normalize();
    const badge = new THREE.Group();
    badge.position.copy(best.p).addScaledVector(best.N, 0.05);
    badge.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, best.N));
    g.add(badge);
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.045 : 0.105;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? starShape.lineTo(x, y) : starShape.moveTo(x, y);
    }
    starShape.closePath();
    const gold = toon('#e2b33a'), goldDark = toon('#8a6414'), leaf = toon('#1f7a34'), leafDark = toon('#145226');
    M(new THREE.ExtrudeGeometry(starShape, { depth: 0.018, bevelEnabled: false }), gold, badge, 0.006).position.z = -0.01;
    const globe = M(new THREE.SphereGeometry(0.052, 18, 14), toon(BLUE), badge, 0.005); globe.position.z = 0.02;
    const band = M(new THREE.TorusGeometry(0.05, 0.011, 6, 24), toon('#f7f4ea'), badge, 0.003);
    band.rotation.x = Math.PI / 2; band.scale.y = 0.42; band.position.z = 0.02;
    // Cruzeiro do Sul, bem simples, no globo azul
    for (const [x, y] of [[0.0, 0.028], [0.012, 0.012], [-0.01, 0.006], [0.006, -0.008], [-0.016, 0.022]]) {
      const st = M(new THREE.SphereGeometry(0.007, 8, 6), toon('#f7f7f2'), badge, 0);
      st.position.set(x, y, 0.062);
    }
    const top = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.008 : 0.02;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? top.lineTo(x, y) : top.moveTo(x, y);
    }
    top.closePath();
    const topStar = M(new THREE.ExtrudeGeometry(top, { depth: 0.01, bevelEnabled: false }), gold, badge, 0.003);
    topStar.position.set(0, 0.1, 0.01);
    // espada atrás da estrela (só a lâmina, pra ler de longe)
    const sword = M(new THREE.BoxGeometry(0.012, 0.2, 0.008), toon('#d9dde4'), badge, 0.003);
    sword.position.set(0, 0.01, -0.012);
    M(new THREE.BoxGeometry(0.04, 0.012, 0.01), goldDark, badge, 0.003).position.set(0, -0.07, -0.01);
    // ramos: café à esquerda, fumo à direita (leitura do brasão, bem reduzida)
    for (const s of [-1, 1]) {
      const sprig = new THREE.Group(); sprig.position.set(s * 0.09, -0.01, 0.01); sprig.rotation.z = s * 0.7; badge.add(sprig);
      M(new THREE.CylinderGeometry(0.006, 0.008, 0.11, 6), toon('#6b4a2a'), sprig, 0.003).rotation.z = 0.4;
      for (const [yy, sc] of [[0.02, 1], [0.045, 0.85], [-0.01, 0.7]]) {
        const lf = M(new THREE.SphereGeometry(0.022, 10, 8), yy > 0 ? leaf : leafDark, sprig, 0.003);
        lf.scale.set(0.45, 1, 0.28); lf.position.set(s * -0.012, yy, 0.01); lf.rotation.z = s * 0.8;
        lf.scale.multiplyScalar(sc);
      }
    }
    return g;
  },
  // ---------- Docão Barriguinha (derrota do Docão Minado: camisa arregaçada, barriga de fora) ----------
  // A barriga é a mesma construção do Barrigão (esfera na frente do tronco), no material de pele que o Docão já usa. Sem malha nova.
  bellyOut(o, rig) {
    const g = new THREE.Group();
    const belly = M(new THREE.SphereGeometry(0.32, 28, 18), rig.skinM, g, 0.012);
    belly.scale.set(1.15, 0.82, 0.95); belly.position.set(0, 0.58, 0.4);
    const navel = M(new THREE.TorusGeometry(0.032, 0.01, 8, 16), toon('#c45a18'), g, 0);
    navel.position.set(0, 0.55, 0.7); navel.rotation.x = Math.PI / 2 - 0.25;
    const y = 0.84, r = torsoR(y) + 0.04;
    const roll = M(new THREE.TorusGeometry(r, 0.07, 12, 32), toon(o.roll || '#c44b36'), g, 0.008);
    roll.rotation.x = Math.PI / 2; roll.position.set(0, y, 0.06); roll.scale.set(1, 0.9, 1);
    const cream = M(new THREE.TorusGeometry(r + 0.01, 0.02, 8, 28), toon('#f6e4bd'), g, 0);
    cream.rotation.x = Math.PI / 2; cream.position.set(0, y + 0.01, 0.08); cream.scale.set(1, 0.9, 1);
    const band = M(new THREE.TorusGeometry(r * 0.98, 0.022, 8, 28), toon(o.rollDark || '#8e2c1e'), g, 0);
    band.rotation.x = Math.PI / 2; band.position.set(0, y + 0.055, 0.04); band.scale.set(1, 0.9, 1);
    return g;
  },
  // ---------- Docão Bigzão (cabelo ondulado + colar de pérola; óculos reusa squareGlasses) ----------
  wavyHair(o, rig) { // cabelo médio ondulado: casca lisa (igual aos outros cabelos) + ondas grossas deitadas, sem tufo
    hideTuft(rig); const g = new THREE.Group();
    const m = toonWarm(o.color || '#a56b3c', 0.16, { side: THREE.DoubleSide }, '#c4844a');
    const hi = toonWarm(o.highlight || '#d7a15a', 0.22, { side: THREE.DoubleSide }, '#f0c48a');
    const line = (th) => {
      const a = Math.abs(th);
      let y = a < 0.45 ? 1.95 : a < 1.15 ? 1.95 - (a - 0.45) * 0.18 : a < 2.1 ? 1.824 - (a - 1.15) * 0.14 : 1.68;
      if (th < 0 && a < 0.85) y -= 0.03;
      return y;
    };
    M(hairCap(line, 0.038, 0.08), m, g, 0.011);
    const wave = (pts, rad, mat) => M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, rad, 8, false), mat, g, 0.005);
    // ondas deitadas no topo, da direita pra esquerda (não são mechas em pé)
    wave([headPoint(0.95, 1.96, 0.06), headPoint(0.35, 2.01, 0.09), headPoint(-0.3, 1.99, 0.08), headPoint(-0.95, 1.93, 0.05)], 0.058, hi);
    wave([headPoint(1.05, 1.9, 0.05), headPoint(0.25, 1.95, 0.075), headPoint(-0.5, 1.92, 0.065), headPoint(-1.1, 1.86, 0.04)], 0.05, m);
    wave([headPoint(0.8, 1.86, 0.045), headPoint(0.05, 1.9, 0.06), headPoint(-0.7, 1.86, 0.045)], 0.042, hi);
    return onHead(g);
  },
  pearl(o) { // cordão fino prateado com uma pérola redonda no peito (não é a corrente grossa)
    const g = new THREE.Group();
    const silver = toonWarm(o.color || '#d5dbe3', 0.45, {}, '#ffffff');
    const gem = toonWarm(o.pearl || '#f7f3ea', 0.3, {}, '#fffdf8');
    const chain = M(new THREE.TorusGeometry(0.23, 0.012, 8, 40), silver, g, 0.004);
    chain.rotation.x = -(Math.PI / 2 - 0.78); chain.position.set(0, 1.06, 0.24); chain.scale.z = 0.9;
    const pend = new THREE.Group(); pend.position.set(0, 0.94, 0.52); pend.rotation.x = -0.15; g.add(pend);
    M(new THREE.SphereGeometry(0.058, 18, 14), gem, pend, 0.006);
    const shine = M(new THREE.SphereGeometry(0.016, 8, 6), basic('#ffffff'), pend, 0); shine.position.set(0.014, 0.018, 0.04);
    const bail = M(new THREE.TorusGeometry(0.018, 0.006, 6, 10), silver, pend, 0); bail.position.y = 0.062;
    return g;
  },
  // ---------- DocOny: raquete de beach tennis nas costas (cintura fica pros itens de cinto) ----------
  beachRacket(o) {
    const root = new THREE.Group();
    const g = new THREE.Group();
    const red = toon(o.face || '#e10600'), black = toon(o.rim || '#141416'), green = toon(o.accent || '#2fce4a');
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.2);
    shape.bezierCurveTo(0.24, -0.14, 0.32, 0.06, 0.3, 0.22);
    shape.bezierCurveTo(0.26, 0.44, 0.1, 0.52, 0, 0.52);
    shape.bezierCurveTo(-0.1, 0.52, -0.26, 0.44, -0.3, 0.22);
    shape.bezierCurveTo(-0.32, 0.06, -0.24, -0.14, 0, -0.2);
    const face = M(new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 8 }), red, g, 0.008);
    face.position.z = -0.022;
    let rimPts = shape.getPoints(24).map((p) => new V3(p.x, p.y, 0));
    if (rimPts.length > 2 && rimPts[0].distanceTo(rimPts[rimPts.length - 1]) < 1e-3) rimPts = rimPts.slice(0, -1);
    M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 64, 0.022, 7, true), black, g, 0.004);
    const holeM = basic(o.holes || '#f4f1ea');
    for (const [x, y] of [[0, 0.28], [-0.1, 0.16], [0.1, 0.16], [-0.16, 0.02], [0, 0.02], [0.16, 0.02], [-0.1, -0.1], [0.1, -0.1]]) {
      const h = M(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), holeM, g, 0);
      h.rotation.x = Math.PI / 2; h.position.set(x, y, 0.028);
    }
    const chevL = M(new THREE.BoxGeometry(0.2, 0.032, 0.016), green, g, 0.003); chevL.position.set(-0.06, 0.1, 0.04); chevL.rotation.z = 0.65;
    const chevR = M(new THREE.BoxGeometry(0.2, 0.032, 0.016), green, g, 0.003); chevR.position.set(0.06, 0.1, 0.04); chevR.rotation.z = -0.65;
    const tip = M(new THREE.BoxGeometry(0.1, 0.028, 0.016), green, g, 0.003); tip.position.set(0.16, 0.4, 0.02); tip.rotation.z = 0.45;
    M(new THREE.CylinderGeometry(0.04, 0.028, 0.09, 10), black, g, 0.004).position.y = -0.26;
    M(new THREE.CylinderGeometry(0.024, 0.026, 0.28, 10), toon(o.handle || '#1c1e22'), g, 0.004).position.y = -0.44;
    M(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), toon('#2a2c30'), g, 0).position.y = -0.46;
    const butt = M(new THREE.SphereGeometry(0.03, 10, 8), black, g, 0.003); butt.scale.y = 0.65; butt.position.y = -0.58;
    // ombro esquerdo (−x), atrás do tronco: a face sobe ao lado da cabeça, o cabo desce nas costas
    g.position.set(-0.34, 1.18, -0.42); g.rotation.set(0.18, 0.45, -0.55); root.add(g);
    const zb = (y) => -(torsoR(y) * 0.85 + 0.05);
    const strap = new THREE.CatmullRomCurve3([
      new V3(-0.28, 0.72, zb(0.72) - 0.06),
      new V3(-0.46, 0.98, zb(0.98)),
      new V3(-0.5, 1.12, -0.06),
      new V3(-0.28, 0.98, torsoR(0.98) * 0.55),
    ]);
    M(new THREE.TubeGeometry(strap, 16, 0.016, 6, false), toon('#1a1c20'), root, 0.003);
    return root;
  },
});

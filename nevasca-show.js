// Natal, bondinhos e trenó do Posto Nevasca. Luzes são instâncias emissivas, sem luz real extra.
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { makeDocao } from './docao.js';
import { gondolaPose, elevatorPose, sleighPose, sleighAt, sleighClock, SLEIGH, CABIN, ELEVATOR, GONDOLA } from './shared/nevasca.js';

const COLORS = [0xff2a2a, 0x3d8f3d, 0xf2c94c, 0x4aa3ff, 0xff7ad1];
const emissive = (hex) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });

function parapet(g, x, z, sx, sz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, CABIN.wall, sz), mat);
  m.position.set(x, CABIN.wall / 2, z); g.add(m);
}
function cabin() {
  const g = new THREE.Group();
  const metal = new THREE.MeshToonMaterial({ color: 0xc23b3b });
  const wood = new THREE.MeshToonMaterial({ color: 0x6e5438 });
  const { hx, hz, thick, door } = CABIN;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 0.1, hz * 2), wood);
  floor.position.y = 0.02; g.add(floor);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.16, 0.08, hz * 2 + 0.16), new THREE.MeshToonMaterial({ color: 0xf4f7fa }));
  roof.position.y = 2.35; g.add(roof);
  parapet(g, 0, hz - thick / 2, hx * 2, thick, metal);
  parapet(g, 0, -hz + thick / 2, hx * 2, thick, metal);
  parapet(g, -hx + thick / 2, 0, thick, hz * 2, metal);
  const jamb = (hz - door) / 2;
  parapet(g, hx - thick / 2, hz - jamb / 2, thick, jamb, metal);
  parapet(g, hx - thick / 2, -(hz - jamb / 2), thick, jamb, metal);
  const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.08), new THREE.MeshToonMaterial({ color: 0x2a3138 }));
  hanger.position.set(0, 2.85, 0); g.add(hanger);
  return g;
}
function xmasTree() {
  const g = new THREE.Group();
  const wood = new THREE.MeshToonMaterial({ color: 0x5c3a22 });
  const green = new THREE.MeshToonMaterial({ color: 0x1d6b32 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.35, 7), wood);
  trunk.position.y = 0.68; g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.15 - i * 0.26, 1.35, 8), green);
    cone.position.y = 1.55 + i * 0.85; g.add(cone);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.38), emissive(0xffe27a));
  star.position.y = 6.85; g.add(star);
  const cols = [0xff2a2a, 0xf2c94c, 0x4aa3ff, 0xff7ad1, 0xffffff];
  for (let i = 0; i < 22; i++) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), emissive(cols[i % cols.length]));
    const h = 1.7 + (i % 5) * 0.85;
    const r = 1.35 - (i % 5) * 0.18;
    const a = i * 2.4;
    ball.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
    g.add(ball);
  }
  const wrap = [0xc0392b, 0x1f6b32, 0x3d7ec4, 0xf2c94c];
  [[-0.85, 0.28, 0.7, 0.55, 0.42], [0.7, 0.22, 0.55, 0.4, 0.36], [-0.15, 0.2, -0.95, 0.48, 0.4], [0.95, 0.18, -0.35, 0.36, 0.3]].forEach(([x, h, z, w, d], i) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h * 2, d), new THREE.MeshToonMaterial({ color: wrap[i] }));
    box.position.set(x, h, z); g.add(box);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 2.02, 0.06), new THREE.MeshToonMaterial({ color: 0xf2c94c }));
    rib.position.set(x, h, z); g.add(rib);
  });
  g.name = 'xmas-tree';
  return g;
}
function liftCar() {
  const g = new THREE.Group();
  const metal = new THREE.MeshToonMaterial({ color: 0x8a9298 });
  const wood = new THREE.MeshToonMaterial({ color: 0x6e5438 });
  const { hx, hz, thick, wall } = ELEVATOR.car;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 - 0.04, 0.1, hz * 2 - 0.04), wood);
  floor.position.y = 0.04; g.add(floor);
  const side = (x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(thick, wall, hz * 2), metal);
    m.position.set(x, wall / 2, 0); g.add(m);
  };
  side(-hx + thick / 2); side(hx - thick / 2);
  const back = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, wall, thick), metal);
  back.position.set(0, wall / 2, hz - thick / 2); g.add(back);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, wall, thick), metal);
  gate.position.set(0, wall / 2, -hz + thick / 2); gate.name = 'gate'; g.add(gate);
  return g;
}

function tree() {
  const g = new THREE.Group();
  const wood = new THREE.MeshToonMaterial({ color: 0x6b4423 });
  const green = new THREE.MeshToonMaterial({ color: 0x1f6b32 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.2, 6), wood); trunk.position.y = 0.6; g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4 - i * 0.38, 1.7, 7), green);
    cone.position.y = 1.5 + i * 1.15; g.add(cone);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), emissive(0xffe27a));
  star.position.y = 7.5; g.add(star);
  return g;
}

function gift(w, h, d, hex) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshToonMaterial({ color: hex }));
  g.add(box);
  const rib = new THREE.MeshToonMaterial({ color: 0xf2c94c });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 1.04, d * 0.14), rib));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, h * 1.04, d * 1.04), rib));
  const bow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, h * 0.18, d * 0.34), rib);
  bow.position.y = h * 0.58; g.add(bow);
  return g;
}

function reindeer(rudolph, fur) {
  const g = new THREE.Group();
  const dark = new THREE.MeshToonMaterial({ color: 0x3a2416 });
  const antlerM = new THREE.MeshToonMaterial({ color: 0xe2c48a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 0.34), fur);
  torso.position.set(0.08, 0.78, 0); g.add(torso);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.22), fur);
  neck.position.set(0.58, 1.02, 0); neck.rotation.z = -0.6; g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.26), fur);
  head.position.set(0.86, 1.16, 0); g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 5), fur);
    ear.position.set(0.78, 1.32, s * 0.1); ear.rotation.z = -0.4; g.add(ear);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.32, 0.045), antlerM);
    stem.position.set(0.74, 1.48, s * 0.08); g.add(stem);
    const tine = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), antlerM);
    tine.position.set(0.84, 1.6, s * 0.08); g.add(tine);
  }
  const noseMat = rudolph ? new THREE.MeshBasicMaterial({ color: 0xff1a1a, toneMapped: false }) : dark;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(rudolph ? 0.16 : 0.055, 10, 8), noseMat);
  nose.position.set(1.12, 1.14, 0); g.add(nose);
  let halo = null, haloMat = null;
  if (rudolph) {
    haloMat = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
    halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), haloMat);
    halo.position.copy(nose.position); g.add(halo);
  }
  const legs = [];
  [[0.38, 0.14, 0], [0.38, -0.14, Math.PI], [-0.22, 0.14, Math.PI], [-0.22, -0.14, 0]].forEach(([x, z, phase]) => {
    const piv = new THREE.Group(); piv.position.set(x, 0.64, z); piv.userData.phase = phase;
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.09), fur); limb.position.y = -0.17; piv.add(limb);
    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.13), dark); hoof.position.y = -0.36; piv.add(hoof);
    g.add(piv); legs.push(piv);
  });
  g.userData = { legs, nose, noseMat, halo, haloMat, rudolph };
  return g;
}

function santaHat() {
  const g = new THREE.Group();
  const red = new THREE.MeshToonMaterial({ color: 0xc0392b });
  const white = new THREE.MeshToonMaterial({ color: 0xfffaf0 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.1, 8), white);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.52, 8), red);
  cone.position.y = 0.26; cone.rotation.z = 0.45; cone.position.x = 0.06;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), white);
  pom.position.set(0.22, 0.42, 0.02);
  g.add(brim, cone, pom);
  g.position.set(0, 2.02, 0.04);
  return g;
}

function sleighRig() {
  const g = new THREE.Group(); g.name = 'docao-sleigh'; g.frustumCulled = false;
  const bob = new THREE.Group(); g.add(bob);
  const red = new THREE.MeshToonMaterial({ color: 0xb42318 });
  const gold = new THREE.MeshToonMaterial({ color: 0xf2c94c });
  const goldBright = new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.72, 1.4), red);
  body.position.set(-0.15, 0.78, 0); bob.add(body);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.08, 1.48), gold);
  lip.position.set(-0.15, 1.14, 0); bob.add(lip);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 1.28), red);
  back.position.set(-1.32, 1.2, 0); bob.add(back);
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 6, 8, Math.PI), gold);
  scroll.position.set(-1.28, 1.55, 0); scroll.rotation.y = Math.PI / 2; bob.add(scroll);
  const prow = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 6, 8, Math.PI * 0.65), gold);
  prow.position.set(1.05, 0.7, 0); prow.rotation.z = -0.4; bob.add(prow);
  for (const z of [-0.52, 0.52]) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.07, 0.08), goldBright);
    runner.position.set(0.05, 0.16, z); bob.add(runner);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 5, 7, Math.PI), gold);
    curl.position.set(1.35, 0.36, z); curl.rotation.z = Math.PI / 2; bob.add(curl);
  }
  const bed = 1.14;
  const pile = [
    [-0.85, 0.46, 0.08, 0.52, 0.4, 0.46, 0xc0392b],
    [-0.45, 0.32, 0.32, 0.38, 0.32, 0.34, 0x1f6b32],
    [-0.55, 0.28, -0.28, 0.34, 0.28, 0.32, 0x3d7ec4],
    [-1.1, 0.34, -0.28, 0.4, 0.32, 0.36, 0xff7ad1],
    [-0.2, 0.26, -0.34, 0.3, 0.24, 0.28, 0xf2c94c],
    [0.35, 0.28, 0.4, 0.32, 0.26, 0.3, 0xc0392b],
    [0.05, 0.24, -0.42, 0.28, 0.22, 0.26, 0x1f6b32],
    [-0.7, 0.36, 0.02, 0.3, 0.26, 0.28, 0xf7f1e3],
  ];
  for (const [x, h, z, w, hh, d, hex] of pile) {
    const p = gift(w, hh, d, hex); p.position.set(x, bed + hh / 2, z); bob.add(p);
  }
  const fur = new THREE.MeshToonMaterial({ color: 0x8d6a43 });
  const furLead = new THREE.MeshToonMaterial({ color: 0xa86b3a });
  const deer = [];
  const team = new THREE.Group(); bob.add(team);
  for (let rank = 0; rank < 4; rank++) {
    for (let side = 0; side < 2; side++) {
      const lead = rank === 3 && side === 0;
      const d = reindeer(lead, lead ? furLead : fur);
      d.position.set(2.05 + rank * 1.38 + (lead ? 0.62 : 0), 0, side === 0 ? 0.46 : -0.46);
      d.userData.baseY = 0; team.add(d); deer.push(d);
    }
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.84), gold);
    yoke.position.set(2.35 + rank * 1.38, 1.02, 0); team.add(yoke);
  }
  const rider = makeDocao('classico', { withGun: false, pose: 'wave' });
  rider.group.scale.setScalar(0.86);
  rider.group.position.set(0.05, 1.02, 0);
  rider.group.rotation.y = Math.PI / 2;
  rider.legs.forEach((leg) => { leg.rotation.x = 1.05; });
  rider.head.add(santaHat());
  bob.add(rider.group);

  const burst = new THREE.Group(); burst.visible = false; g.add(burst);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + (i % 3) * 0.08), starMat);
    const a = i / 9 * Math.PI * 2;
    s.position.set(7.7 + Math.cos(a) * 0.15, 1.35 + Math.sin(i) * 0.4, Math.sin(a) * 0.7);
    burst.add(s);
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), glowMat);
  glow.position.set(7.6, 1.25, 0); burst.add(glow);
  return { group: g, bob, deer, wave: rider.arms[1], burst, starMat, glowMat };
}

// Cenário do cume. Sem colisão: quem cai da passarela continua caindo até o plano de morte.
function summit() {
  const g = new THREE.Group();
  g.name = 'summit';
  const rock = [], ledge = [], snow = [];
  const put = (bucket, x0, y0, z0, x1, y1, z1) => {
    const geo = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    bucket.push(geo);
  };
  const gaps = [[-28.6, -23.2], [-8.1, -2.8], [-2.3, 2.3], [2.8, 8.1], [23.2, 28.6]];
  const spans = (z0, z1) => {
    const out = []; let z = z0;
    for (const [a, b] of gaps) { if (a > z + 0.5) out.push([z, a]); z = Math.max(z, b); }
    if (z1 > z + 0.5) out.push([z, z1]);
    return out;
  };
  // Face externa contínua, bem embaixo da tábua. A interna abre onde tem escada e ponte.
  put(rock, -20.6, -36, -36, -18.7, 3.35, 36);
  put(rock, 18.7, -36, -36, 20.6, 3.35, 36);
  for (const [za, zb] of spans(-34, 34)) {
    put(rock, -16.6, -30, za, -16.1, 3.3, zb);
    put(rock, 16.1, -30, za, 16.6, 3.3, zb);
    put(rock, -12.6, -28, za, -12.05, 0.05, zb);
    put(rock, 12.05, -28, za, 12.6, 0.05, zb);
  }
  put(rock, -16, -32, 36.3, 16, 0.05, 39.2);
  put(rock, -16, -32, -39.2, 16, 0.05, -36.3);
  // Ressaltos de rocha com capa de neve, descendo até o vale.
  const shelves = [
    [-34, -20.2, -48, 48, -8, -5.6], [20.2, 34, -48, 48, -8, -5.6],
    [-52, -30, -62, 62, -20, -16.5], [30, 52, -62, 62, -20, -16.5],
    [-78, -46, -78, 78, -36, -31], [46, 78, -78, 78, -36, -31],
    [-22, 22, 39, 58, -12, -8], [-22, 22, -58, -39, -12, -8],
    [-36, 36, 56, 86, -28, -22], [-36, 36, -86, -56, -28, -22],
    [-90, -70, -40, 40, -50, -44], [70, 90, -40, 40, -50, -44],
  ];
  for (const [x0, x1, z0, z1, y0, y1] of shelves) {
    put(ledge, x0, y0, z0, x1, y1, z1);
    put(snow, x0 + 0.4, y1 - 0.35, z0 + 0.4, x1 - 0.4, y1 + 0.15, z1 - 0.4);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const z = -30 + i * 10;
      put(ledge, side * 24, -22 + (i % 3) * -4, z, side * 31, -6, z + 3.2);
      put(rock, side * 21.2, -30, z + 1, side * 23.4, 1.2, z + 1.8);
    }
  }
  const meshOf = (list, color) => {
    if (!list.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(list, false), new THREE.MeshToonMaterial({ color }));
    mesh.castShadow = mesh.receiveShadow = false;
    g.add(mesh);
  };
  meshOf(rock, 0x3c4652);
  meshOf(ledge, 0x596574);
  meshOf(snow, 0xe4eef4);

  const cone = new THREE.ConeGeometry(1, 1, 6); cone.translate(0, 0.5, 0);
  const peaks = (rows, color) => {
    const mesh = new THREE.InstancedMesh(cone, new THREE.MeshToonMaterial({ color }), rows.length);
    const dummy = new THREE.Object3D();
    rows.forEach(([x, z, base, h, r], i) => {
      dummy.position.set(x, base, z); dummy.scale.set(r, h, r); dummy.rotation.y = i * 0.7; dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = false; g.add(mesh);
  };
  // Perto (alguns picos acima do platô, outros abaixo), médio e longe. A base encosta na encosta ou na névoa.
  // Base no vale (y=-58): o cone desce até o chão, não fica solto no céu. A ponta varia acima e abaixo do cume.
  const near = [[-78, 28, -58, 78, 22], [-96, -36, -58, 64, 20], [-58, 78, -58, 72, 18], [70, 48, -58, 88, 24], [92, -30, -58, 60, 18], [46, -86, -58, 76, 20], [-30, -96, -58, 66, 18], [110, 12, -58, 54, 16]];
  const mid = [[-140, 55, -58, 96, 32], [-168, -62, -58, 84, 28], [150, 72, -58, 108, 34], [172, -48, -58, 90, 30], [24, 168, -58, 100, 32], [-48, -176, -58, 86, 28], [128, -132, -58, 94, 30], [-155, 128, -58, 88, 26]];
  const far = [[8, 230, -58, 112, 42], [190, 170, -58, 128, 46], [-200, 150, -58, 118, 44], [220, -70, -58, 100, 38], [-230, -50, -58, 122, 42], [90, -230, -58, 108, 40], [-80, 240, -58, 104, 38], [245, 30, -58, 96, 36]];
  peaks(near, 0x6d7884);
  peaks(near.map(([x, z, base, h, r]) => [x, z, base + h * 0.62, h * 0.42, r * 0.62]), 0xf2f7fb);
  peaks(mid, 0x8b98a6);
  peaks(mid.map(([x, z, base, h, r]) => [x, z, base + h * 0.66, h * 0.38, r * 0.58]), 0xe7eef5);
  peaks(far, 0xb7c4d0);
  peaks(far.map(([x, z, base, h, r]) => [x, z, base + h * 0.7, h * 0.34, r * 0.55]), 0xf7fbfe);

  const pineGeo = (() => {
    const trunk = new THREE.CylinderGeometry(0.18, 0.28, 1.3, 5); trunk.translate(0, 0.65, 0);
    const a = new THREE.ConeGeometry(1.15, 2.4, 6); a.translate(0, 2.15, 0);
    const b = new THREE.ConeGeometry(0.8, 1.7, 6); b.translate(0, 3.45, 0);
    return mergeGeometries([trunk, a, b], false);
  })();
  const pines = [];
  const addPine = (x, y, z, s) => pines.push([x, y, z, s]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const z = -42 + i * 6.4;
      addPine(side * 27, -5.5, z, 0.9 + (i % 3) * 0.25);
      addPine(side * 40, -16.2, z * 1.05, 1.1 + (i % 2) * 0.3);
      addPine(side * 58, -30.6, z * 1.15, 1.3);
    }
  }
  for (let i = 0; i < 10; i++) {
    addPine(-18 + i * 4, -7.8, 48, 1);
    addPine(-18 + i * 4, -7.8, -48, 1);
  }
  // Vale: floresta, lago congelado e vilinha. Fica abaixo do plano em que a queda mata.
  const valley = new THREE.Mesh(new THREE.CircleGeometry(230, 28), new THREE.MeshToonMaterial({ color: 0x2d4a3c }));
  valley.rotation.x = -Math.PI / 2; valley.position.y = -58; valley.receiveShadow = false; g.add(valley);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(28, 20), new THREE.MeshToonMaterial({ color: 0xd5e3ea }));
  lake.rotation.x = -Math.PI / 2; lake.position.set(-96, -57.6, 12); g.add(lake);
  const lake2 = lake.clone(); lake2.position.set(102, -57.6, -18); lake2.scale.set(0.7, 1, 1.3); g.add(lake2);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(70, 4.5), new THREE.MeshToonMaterial({ color: 0xc5d6e0 }));
  river.rotation.x = -Math.PI / 2; river.position.set(-55, -57.55, 8); river.rotation.z = 0.4; g.add(river);
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2;
    const rad = 78 + (i % 5) * 14;
    addPine(Math.cos(a) * rad, -57.7, Math.sin(a) * rad * 0.85, 1.4 + (i % 3) * 0.35);
  }
  const town = new THREE.Group();
  const wall = new THREE.MeshToonMaterial({ color: 0x8d6848 });
  const roofM = new THREE.MeshToonMaterial({ color: 0x8e2f2a });
  const win = new THREE.MeshBasicMaterial({ color: 0xffe1a0, toneMapped: false });
  for (let i = 0; i < 7; i++) {
    const hx = (i % 4) * 7, hz = Math.floor(i / 4) * 8;
    const house = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 3.6), wall);
    house.position.set(hx, 1.6, hz); town.add(house);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(3.3, 2.1, 4), roofM);
    rf.position.set(hx, 4.1, hz); rf.rotation.y = Math.PI / 4; town.add(rf);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), win);
    lamp.position.set(hx, 2.2, hz + 1.85); town.add(lamp);
  }
  town.position.set(-112, -57.7, 28); g.add(town);
  const bulbs = [[-128, -54.2, 24], [-112, -53.6, 36], [-98, -54, 26], [-120, -53.4, 42]];
  for (const [x, y, z] of bulbs) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 5, 4), new THREE.MeshBasicMaterial({ color: 0xff4a4a, toneMapped: false }));
    b.position.set(x, y, z); g.add(b);
  }
  const pineMesh = new THREE.InstancedMesh(pineGeo, new THREE.MeshToonMaterial({ color: 0x1c4a30 }), pines.length);
  const dummy = new THREE.Object3D();
  pines.forEach(([x, y, z, s], i) => { dummy.position.set(x, y, z); dummy.scale.setScalar(s); dummy.rotation.y = i; dummy.updateMatrix(); pineMesh.setMatrixAt(i, dummy.matrix); });
  pineMesh.castShadow = false; g.add(pineMesh);

  const puff = new THREE.MeshToonMaterial({ color: 0xf7fbff });
  for (const [x, y, z, sc] of [[-46, -12, 24, 1], [54, -16, -18, 1.2], [-78, -8, -6, 0.8], [24, -20, 62, 1.3], [-18, -14, -74, 1.1], [86, -11, 36, 0.9], [-96, -18, 48, 1.15], [8, -22, -96, 1.4], [64, -9, -58, 0.85], [-58, -15, 70, 1]]) {
    const cl = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), puff);
      s.position.set(k * 8 - 8, 0, (k % 2) * 3); cl.add(s);
    }
    cl.position.set(x, y, z); cl.scale.set(sc, sc * 0.32, sc); g.add(cl);
  }
  const fogMat = (opacity) => new THREE.MeshBasicMaterial({ color: 0xd5e4ee, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  for (const [y, op, rad] of [[-48, 0.28, 200], [-40, 0.16, 160]]) {
    const fog = new THREE.Mesh(new THREE.CircleGeometry(rad, 24), fogMat(op));
    fog.rotation.x = -Math.PI / 2; fog.position.y = y; g.add(fog);
  }
  return g;
}

function festive(root) {
  const red = new THREE.MeshToonMaterial({ color: 0xc0392b });
  const green = new THREE.MeshToonMaterial({ color: 0x1f6b32 });
  const gold = new THREE.MeshToonMaterial({ color: 0xf2c94c });
  const white = new THREE.MeshToonMaterial({ color: 0xf7fbff });
  const add = (mesh, x, y, z, rot = 0) => { mesh.position.set(x, y, z); mesh.rotation.y = rot; root.add(mesh); };
  const gift = (w, h, d, hex) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshToonMaterial({ color: hex })));
    const rib = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 1.02, 0.07), gold);
    g.add(rib);
    return g;
  };
  // presentes e meias encostados na parede, fora da reta e das escadas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pile = gift(0.7, 0.45, 0.5, sx * sz > 0 ? 0xc0392b : 0x3d7ec4);
    add(pile, sx * 5.6, 0.22, sz * 10.7);
    const sock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.08), red);
    add(sock, sx * 4.2, 2.15, sz * 11.35, sz > 0 ? 0 : Math.PI);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), gold);
    add(bell, sx * 5.2, 6.45, sz * 4.2);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), emissive(0xffe27a));
    add(star, sx * 3.4, 3.05, sz * 4.5);
  }
  // pingentes no beiral
  const ice = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.28, 4), white, 48);
  const dummy = new THREE.Object3D();
  let n = 0;
  for (const z of [-12.15, 12.15]) for (let i = 0; i < 12; i++) {
    dummy.position.set(-10 + i * 1.8, 6.55, z); dummy.rotation.x = Math.PI; dummy.updateMatrix();
    ice.setMatrixAt(n++, dummy.matrix);
  }
  for (const x of [-11.15, 11.15]) for (let i = 0; i < 12; i++) {
    dummy.position.set(x, 6.55, -10 + i * 1.8); dummy.rotation.x = Math.PI; dummy.updateMatrix();
    ice.setMatrixAt(n++, dummy.matrix);
  }
  root.add(ice);
  // renas de enfeite no pátio, longe das portas
  for (const [x, z] of [[9.2, 16.5], [-9.2, -16.5]]) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.38, 0.32), new THREE.MeshToonMaterial({ color: 0x8d6a43 }));
    body.position.y = 0.55; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.22), new THREE.MeshToonMaterial({ color: 0xa86b3a }));
    head.position.set(0.55, 0.78, 0); g.add(head);
    add(g, x, 0, z, x > 0 ? -0.4 : 2.6);
  }
  // placa fora da porta norte, ao lado, sem cruzar o vão
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 180;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c0392b'; ctx.fillRect(0, 0, 512, 180);
  ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 18; ctx.strokeRect(14, 14, 484, 152);
  ctx.fillStyle = '#fff6d8'; ctx.font = 'bold 78px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('FELIZ NATAL', 256, 96);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) }));
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), new THREE.MeshToonMaterial({ color: 0x5c3a22 }));
  post.position.set(7.4, 1.1, 13.5); root.add(post);
  sign.position.set(7.4, 2.45, 13.55); root.add(sign);
  // faixa colorida na parede interna, só visual
  const stripe = (x, z, rot, hex) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshToonMaterial({ color: hex }));
    m.position.set(x, 1.8, z); m.rotation.y = rot; root.add(m);
  };
  stripe(-6.4, 11.42, 0, 0xc0392b); stripe(6.4, 11.42, 0, 0x1f6b32);
  stripe(-6.4, -11.42, Math.PI, 0x1f6b32); stripe(6.4, -11.42, Math.PI, 0xc0392b);
  stripe(-11.42, 5.5, Math.PI / 2, 0xf2c94c); stripe(11.42, -5.5, -Math.PI / 2, 0xf2c94c);
}

export function mountNevasca(group, map) {
  const root = new THREE.Group(); root.name = 'nevasca-show';
  root.add(summit());
  const cabins = [cabin(), cabin()];
  cabins.forEach((c) => root.add(c));
  const lifts = [liftCar(), liftCar()];
  lifts.forEach((c) => root.add(c));
  const big = tree(); big.position.set(0, 6.9, 0); root.add(big);
  root.add(xmasTree());

  const bulbs = [];
  const pushLine = (x0, y0, z0, x1, y1, z1, n) => {
    for (let i = 0; i <= n; i++) bulbs.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, z0 + (z1 - z0) * i / n]);
  };
  // beiral da Sala Fria, guarda das passarelas e o cabo dos bondinhos
  pushLine(-11, 7.15, -12, 11, 7.15, -12, 16);
  pushLine(-11, 7.15, 12, 11, 7.15, 12, 16);
  pushLine(-11, 7.15, -12, -11, 7.15, 12, 16);
  pushLine(11, 7.15, -12, 11, 7.15, 12, 16);
  pushLine(-11, 4.5, -12, 11, 4.5, -12, 14);
  pushLine(-11, 4.5, 12, 11, 4.5, 12, 14);
  pushLine(-17.7, 4.45, -28, -17.7, 4.45, 28, 22);
  pushLine(17.7, 4.45, -28, 17.7, 4.45, 28, 22);
  pushLine(-16.5, 4.45, -28, -16.5, 4.45, 28, 22);
  pushLine(16.5, 4.45, -28, 16.5, 4.45, 28, 22);
  pushLine(GONDOLA.x[0], 12.7, 32, GONDOLA.x[0], 12.7, -32, 26);
  pushLine(GONDOLA.x[1], 12.7, 32, GONDOLA.x[1], 12.7, -32, 26);
  // varais por dentro, no beiral do mezanino e na plataforma do bondinho
  pushLine(-9, 3.15, -9, 9, 3.15, -9, 14);
  pushLine(-9, 3.15, 9, 9, 3.15, 9, 14);
  pushLine(-9, 3.15, -9, -9, 3.15, 9, 12);
  pushLine(9, 3.15, -9, 9, 3.15, 9, 12);
  pushLine(-9, 6.35, -9, 9, 6.35, -9, 12);
  pushLine(-9, 6.35, 9, 9, 6.35, 9, 12);
  for (const s of [1, -1]) {
    pushLine(-4.6, 11.7, s * 31.2, 4.6, 11.7, s * 31.2, 10);
    pushLine(s * 4.8, 11.7, s * 29.6, s * 4.8, 11.7, s * 33.4, 6);
  }
  for (const p of map.props || []) if (p.t === 'pine') {
    const s = p.s || 1, y = (p.y || 0) + 3.2 * s;
    for (let k = 0; k < 4; k++) bulbs.push([p.x + Math.cos(k) * 0.45 * s, y - k * 0.45, p.z + Math.sin(k) * 0.45 * s]);
  }
  const geo = new THREE.SphereGeometry(0.09, 5, 4);
  const mesh = new THREE.InstancedMesh(geo, emissive(0xffffff), bulbs.length);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  bulbs.forEach((b, i) => {
    dummy.position.set(b[0], b[1], b[2]); dummy.scale.setScalar(1); dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.setHex(COLORS[i % COLORS.length]));
  });
  root.add(mesh);

  // guirlanda nas portas largas do pátio e um laço
  const wreath = () => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 6, 10), new THREE.MeshToonMaterial({ color: 0x1f6b32 }));
    g.add(ring);
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), new THREE.MeshToonMaterial({ color: 0xc0392b }));
    bow.position.y = -0.38; g.add(bow);
    return g;
  };
  for (const [x, z, rot, y] of [[-4.2, 12.2, 0, 2.3], [4.2, -12.2, Math.PI, 2.3], [-11.15, 2.15, Math.PI / 2, 2.2], [11.15, -2.15, -Math.PI / 2, 2.2], [-11.15, 7.9, Math.PI / 2, 5.1], [11.15, -7.9, -Math.PI / 2, 5.1], [-11.15, -2.6, Math.PI / 2, 5.1], [11.15, 2.6, -Math.PI / 2, 5.1]]) {
    const w = wreath(); w.position.set(x, y, z); w.rotation.y = rot; w.scale.setScalar(y > 3 ? 1.15 : 1.35); root.add(w);
  }
  // boneco, bengala, quebra-nozes e poste — poucos, fora das rotas
  const deco = (fn, x, y, z) => { const m = fn(); m.position.set(x, y, z); root.add(m); };
  const snowman = () => {
    const g = new THREE.Group(), white = new THREE.MeshToonMaterial({ color: 0xf7fbff });
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), white); a.position.y = 0.55; g.add(a);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), white); b.position.y = 1.25; g.add(b);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 5), new THREE.MeshToonMaterial({ color: 0xe67e22 }));
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.28, 0.4); g.add(nose);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.46, 6), new THREE.MeshToonMaterial({ color: 0xc0392b }));
    hat.position.y = 1.72; g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 6), new THREE.MeshToonMaterial({ color: 0xf7fbff }));
    brim.position.y = 1.5; g.add(brim);
    return g;
  };
  const cane = () => {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), new THREE.MeshToonMaterial({ color: 0xf4f7fa }));
    stick.position.y = 1.2; g.add(stick);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 6), new THREE.MeshToonMaterial({ color: 0xc0392b }));
    band.position.y = 1.5; g.add(band);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 5, 8, Math.PI), new THREE.MeshToonMaterial({ color: 0xf4f7fa }));
    hook.position.y = 2.35; g.add(hook);
    return g;
  };
  const nut = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.5, 0.4), new THREE.MeshToonMaterial({ color: 0xc0392b }));
    body.position.y = 0.75; g.add(body);
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.5), new THREE.MeshToonMaterial({ color: 0xf2c94c }));
    hat.position.y = 1.65; g.add(hat);
    return g;
  };
  const lamp = () => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), new THREE.MeshToonMaterial({ color: 0x2a3138 }));
    pole.position.y = 1.6; g.add(pole);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), emissive(0xffe0a0));
    glow.position.y = 3.25; g.add(glow);
    return g;
  };
  for (const sz of [1, -1]) {
    deco(snowman, -8.2, 0, sz * 22.5); deco(snowman, 8.2, 0, sz * 22.5);
    deco(cane, -3.4, 0, sz * 29.2); deco(cane, 3.4, 0, sz * 29.2);
    deco(nut, sz * 9.2, 0, sz * 27.4);
    deco(lamp, -9.4, 0, sz * 18.5); deco(lamp, 9.4, 0, sz * 18.5);
    deco(lamp, 0, 10.05, sz * 32);
    const bigCane = cane(); bigCane.scale.setScalar(1.7); bigCane.position.set(sz * 5.4, 0, sz * 13.6); root.add(bigCane);
  }
  festive(root);

  const rig = sleighRig(); root.add(rig.group);
  const TRAIL_N = 72;
  const trail = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, toneMapped: false }), TRAIL_N);
  trail.frustumCulled = false; root.add(trail);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xf7fbff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const cloud = new THREE.Group(); cloud.visible = false; cloud.frustumCulled = false;
  for (let i = 0; i < 11; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42 + (i % 3) * 0.16, 10, 8), puffMat);
    const a = i / 11 * Math.PI * 2;
    s.position.set(Math.cos(a) * 1.1, (i % 4) * 0.28, Math.sin(a) * 0.9);
    cloud.add(s);
  }
  const puffCore = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }));
  cloud.add(puffCore); root.add(cloud);
  group.add(root);
  return { root, cabins, lifts, bulbs: mesh, bulbN: bulbs.length, sled: rig.group, bob: rig.bob, deer: rig.deer, wave: rig.wave, burst: rig.burst, starMat: rig.starMat, glowMat: rig.glowMat, trail, trailN: TRAIL_N, cloud, puffMat, puffCore, big };
}

const dummy = new THREE.Object3D();
const color = new THREE.Color();
export function updateNevasca(show, t, dt, onPass) {
  if (!show) return;
  for (let i = 0; i < 2; i++) {
    const p = gondolaPose(t, i);
    show.cabins[i].position.set(p.x, p.y, p.z);
    show.cabins[i].rotation.y = i === 0 ? 0 : Math.PI;
    const e = elevatorPose(t, i);
    show.lifts[i].position.set(e.x, e.y, e.z);
    show.lifts[i].rotation.y = i === 0 ? 0 : Math.PI;
    const gate = show.lifts[i].getObjectByName('gate');
    if (gate) gate.visible = e.phase === 'up' || e.phase === 'down';
  }
  const phase = Math.floor(t * 2.2);
  if (phase !== show._phase) {
    show._phase = phase;
    for (let i = 0; i < show.bulbN; i++) {
      const on = ((i + phase) % 3) !== 0;
      color.setHex(COLORS[i % COLORS.length]);
      if (!on) color.multiplyScalar(0.18);
      show.bulbs.setColorAt(i, color);
    }
    show.bulbs.instanceColor.needsUpdate = true;
  }
  const clock = sleighClock(t);
  const pose = clock.flying ? sleighAt(Math.min(1, clock.k)) : null;
  const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const vis = pose ? Math.min(smooth(0.012, 0.1, pose.k), 1 - smooth(0.86, 1, pose.k)) : 0;
  show.sled.visible = vis > 0.04;
  if (pose && vis > 0.04) {
    show.sled.position.set(pose.x, pose.y, pose.z);
    show.sled.rotation.order = 'YXZ';
    show.sled.rotation.set(pose.pitch, pose.yaw, pose.roll);
    show.bob.scale.setScalar(0.22 + 0.78 * vis);
    show.bob.position.y = Math.sin(t * 2.4) * 0.16;
    show.bob.rotation.z = Math.sin(t * 1.7) * 0.05;
    const gallop = t * 11;
    show.deer.forEach((d, di) => {
      const ph = gallop + di * 0.45;
      d.position.y = Math.abs(Math.sin(ph)) * 0.1;
      d.userData.legs.forEach((leg) => { leg.rotation.x = Math.sin(ph + leg.userData.phase) * 0.9; });
      if (d.userData.rudolph) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 7.5);
        d.userData.nose.scale.setScalar(0.75 + pulse * 0.7);
        d.userData.noseMat.color.setRGB(1, 0.12 * (1 - pulse), 0.05 * (1 - pulse));
        d.userData.halo.scale.setScalar(0.8 + pulse * 0.9);
        d.userData.haloMat.opacity = 0.15 + pulse * 0.55;
      }
    });
    const flap = Math.sin(t * 7);
    // sobe no plano do perfil (pra ler de lado) e abre um pouco pra fora do corpo
    show.wave.rotation.set(-2.05 + flap * 0.7, 0.15, 0.65);
  }
  const enter = !!(pose && pose.k < 0.2);
  show.burst.visible = enter;
  if (enter) {
    const a = 1 - smooth(0.02, 0.2, pose.k);
    show.burst.scale.setScalar(0.7 + (1 - a) * 2.4);
    show.starMat.opacity = 0.25 + 0.7 * a;
    show.glowMat.opacity = 0.08 + 0.32 * a;
    show.burst.rotation.y = t * 1.4;
  }
  const exitAt = SLEIGH.flight * 0.88;
  const cloudAge = clock.u - exitAt;
  const cloudOn = cloudAge > 0 && cloudAge < 2.5;
  show.cloud.visible = cloudOn;
  if (cloudOn) {
    const at = sleighAt(Math.min(1, Math.max(0.9, clock.flying ? clock.k : 1)));
    show.cloud.position.set(at.x, at.y + 0.4, at.z);
    show.cloud.scale.setScalar(0.45 + Math.min(1, cloudAge / 0.9) * 1.15);
    const op = Math.max(0, 1 - Math.max(0, cloudAge - 0.25) / 2.1);
    show.puffMat.opacity = 0.5 * op;
    show.puffCore.material.opacity = 0.4 * op;
  }
  for (let i = 0; i < show.trailN; i++) {
    const age = ((i + 0.35) / show.trailN) * SLEIGH.linger;
    const born = sleighPose(t - age);
    if (!born) { dummy.position.set(0, -80, 0); dummy.scale.setScalar(0.0001); dummy.updateMatrix(); show.trail.setMatrixAt(i, dummy.matrix); continue; }
    const fx = Math.cos(born.yaw), fz = -Math.sin(born.yaw);
    const lx = Math.sin(born.yaw), lz = Math.cos(born.yaw);
    const h1 = Math.sin(i * 12.989) * 0.5 + 0.5, h2 = Math.sin(i * 78.233) * 0.5 + 0.5, h3 = Math.sin(i * 39.7) * 0.5 + 0.5;
    const arriving = born.k < 0.12;
    const back = arriving ? h1 * 1.1 : 2.3 + h1 * 2.6;
    const spread = arriving ? 1.6 : 0.85;
    dummy.position.set(
      born.x - fx * back + lx * (h2 - 0.5) * spread,
      born.y + 0.85 + (h3 - 0.4) * (arriving ? 1.3 : 0.7),
      born.z - fz * back + lz * (h2 - 0.5) * spread,
    );
    const fade = Math.pow(1 - age / SLEIGH.linger, 1.15);
    dummy.scale.setScalar((0.26 + h1 * 0.34) * fade * (arriving ? 1.4 : 1));
    dummy.rotation.set(0, t + i, 0);
    dummy.updateMatrix();
    show.trail.setMatrixAt(i, dummy.matrix);
    color.setHex(born.k > 0.9 ? 0xf7fbff : (i % 4 === 0 ? 0xfff6d8 : 0xffd56a));
    color.multiplyScalar(0.45 + 0.55 * fade);
    show.trail.setColorAt(i, color);
  }
  show.trail.instanceMatrix.needsUpdate = true;
  if (show.trail.instanceColor) show.trail.instanceColor.needsUpdate = true;
  if (pose && pose.k < 0.12 && show._ann !== clock.cycle) {
    show._ann = clock.cycle;
    if (onPass) onPass();
  }
}

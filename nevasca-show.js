// Natal, bondinhos e trenó do Posto Nevasca. Luzes são instâncias emissivas, sem luz real extra.
import * as THREE from 'three';
import { makeDocao } from './docao.js';
import { gondolaPose, sleighPose, sleighAt, sleighClock, SLEIGH } from './shared/nevasca.js';

const COLORS = [0xff2a2a, 0x3d8f3d, 0xf2c94c, 0x4aa3ff, 0xff7ad1];
const emissive = (hex) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });

function cabin() {
  const g = new THREE.Group();
  const metal = new THREE.MeshToonMaterial({ color: 0xc23b3b });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 2.15), new THREE.MeshToonMaterial({ color: 0x6e5438 }));
  floor.position.y = 0.06; g.add(floor);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.1, 2.35), new THREE.MeshToonMaterial({ color: 0xf4f7fa }));
  roof.position.y = 2.15; g.add(roof);
  for (const x of [-0.98, 0.98]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 2.15), metal);
    w.position.set(x, 1.1, 0); g.add(w);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.9, 0.08), metal);
  back.position.set(0, 1.1, -1.02); g.add(back);
  // porta aberta no +X (vira pra plataforma)
  const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.5), metal);
  jamb.position.set(0.98, 1.1, 0.8); g.add(jamb);
  const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), new THREE.MeshToonMaterial({ color: 0x2a3138 }));
  hanger.position.set(0, 2.7, 0); g.add(hanger);
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

export function mountNevasca(group, map) {
  const root = new THREE.Group(); root.name = 'nevasca-show';
  const cabins = [cabin(), cabin()];
  cabins.forEach((c) => root.add(c));
  const big = tree(); big.position.set(0, 6.9, 0); root.add(big);

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
  pushLine(-1.35, 12.7, 32, -1.35, 12.7, -32, 26);
  pushLine(1.35, 12.7, 32, 1.35, 12.7, -32, 26);
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
  }

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
  return { root, cabins, bulbs: mesh, bulbN: bulbs.length, sled: rig.group, bob: rig.bob, deer: rig.deer, wave: rig.wave, burst: rig.burst, starMat: rig.starMat, glowMat: rig.glowMat, trail, trailN: TRAIL_N, cloud, puffMat, puffCore, big };
}

const dummy = new THREE.Object3D();
const color = new THREE.Color();
export function updateNevasca(show, t, dt, onPass) {
  if (!show) return;
  for (let i = 0; i < 2; i++) {
    const p = gondolaPose(t, i);
    show.cabins[i].position.set(p.x, p.y, p.z);
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

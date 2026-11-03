// Natal, bondinhos e trenó do Posto Nevasca. Luzes são instâncias emissivas, sem luz real extra.
import * as THREE from 'three';
import { makeDocao } from './docao.js';
import { gondolaPose, sleighPose } from './shared/nevasca.js';

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

function sleighRig() {
  const g = new THREE.Group();
  const red = new THREE.MeshToonMaterial({ color: 0xc0392b });
  const wood = new THREE.MeshToonMaterial({ color: 0x8b5a2b });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.15), red); body.position.set(0, 0.7, 0); g.add(body);
  const runner = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.1), new THREE.MeshToonMaterial({ color: 0xd5dbe0 }));
  runner.position.set(0.2, 0.15, 0.4); g.add(runner);
  const runner2 = runner.clone(); runner2.position.z = -0.4; g.add(runner2);
  const deer = new THREE.Group();
  const fur = new THREE.MeshToonMaterial({ color: 0x8d6a43 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.55), fur); torso.position.set(2.3, 1.15, 0); deer.add(torso);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.3), fur); neck.position.set(3.05, 1.55, 0); deer.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.35), fur); head.position.set(3.4, 1.85, 0); deer.add(head);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), emissive(0xff2a2a));
  nose.position.set(3.7, 1.82, 0); deer.add(nose);
  g.add(deer);
  const rider = makeDocao('classico', { withGun: false, pose: 'idle' }).group;
  rider.scale.setScalar(0.85); rider.position.set(-0.15, 0.95, 0); rider.rotation.y = -Math.PI / 2; g.add(rider);
  const sack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.7), wood); sack.position.set(-0.7, 1.15, 0); g.add(sack);
  return g;
}

export function mountNevasca(group, map) {
  const root = new THREE.Group(); root.name = 'nevasca-show';
  const cabins = [cabin(), cabin()];
  cabins.forEach((c) => root.add(c));
  const big = tree(); big.position.set(0, 6.85, 12.4); root.add(big);

  const bulbs = [];
  const pushLine = (x0, y0, z0, x1, y1, z1, n) => {
    for (let i = 0; i <= n; i++) bulbs.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, z0 + (z1 - z0) * i / n]);
  };
  // telhados, passarelas e o cabo dos bondinhos
  pushLine(-16, 7.15, -6, 12, 7.15, -6, 18);
  pushLine(-16, 7.15, 16, 12, 7.15, 16, 18);
  pushLine(-16, 7.15, -6, -16, 7.15, 16, 14);
  pushLine(12, 7.15, -6, 12, 7.15, 16, 14);
  pushLine(-12, 4.05, -46, 12, 4.05, -46, 12);
  pushLine(-7.2, 3.05, 45.6, 8.4, 3.05, 45.6, 8);
  pushLine(-27.85, 5.55, 2.4, -27.85, 5.55, 51.6, 22);
  pushLine(29.5, 5.55, 2.4, 29.5, 5.55, 51.6, 22);
  pushLine(-1.35, 14.3, 47, -1.35, 14.3, -52, 30);
  pushLine(1.35, 14.3, 47, 1.35, 14.3, -52, 30);
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
  for (const [x, z, rot] of [[-16.2, 7.6, Math.PI / 2], [18.15, 7.6, -Math.PI / 2], [-2, -6.15, 0], [4, -29.9, Math.PI]]) {
    const w = wreath(); w.position.set(x, 1.7, z); w.rotation.y = rot; root.add(w);
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
  deco(snowman, -14, 0, 22); deco(snowman, 14, -1.5, -18); deco(cane, -10, 0, 30); deco(cane, 9, 0, -40);
  deco(nut, 6, 0, 34); deco(nut, -6, 0, -42); deco(lamp, -9, 0, -8); deco(lamp, 9, 0, 20); deco(lamp, 0, 12, 40); deco(lamp, 0, 12, -48);

  const sled = sleighRig(); root.add(sled);
  const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 5, 4), new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }), 10);
  root.add(trail);
  group.add(root);
  return { root, cabins, bulbs: mesh, bulbN: bulbs.length, sled, trail, big };
}

const dummy = new THREE.Object3D();
const color = new THREE.Color();
export function updateNevasca(show, t, dt, bell) {
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
  const sled = sleighPose(t);
  show.sled.visible = !!sled;
  show.trail.visible = !!sled;
  if (sled) {
    show.sled.position.set(sled.x, sled.y, sled.z);
    show.sled.lookAt(sled.x + 1, sled.y, sled.z + 0.45);
    for (let i = 0; i < 10; i++) {
      const k = Math.max(0, sled.k - i * 0.012);
      dummy.position.set(-52 + k * 104, 35.2, -22 + k * 46); dummy.scale.setScalar(1 - i * 0.06); dummy.updateMatrix();
      show.trail.setMatrixAt(i, dummy.matrix);
    }
    show.trail.instanceMatrix.needsUpdate = true;
    const chime = Math.floor(sled.k * 4);
    if (chime !== show._chime) { show._chime = chime; if (bell) bell(); }
  } else show._chime = -1;
}

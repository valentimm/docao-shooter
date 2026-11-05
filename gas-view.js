// Visual dos botijões: vermelho, faixa clara e losango de inflamável.
// Chama, fumaça e chiado quando a simulação (shared/gas.js) marca fase 1.
// A caixa d'água azul continua sendo o prop 'tank' do mapa — isto é outro objeto.
import * as THREE from 'three';
import { toon, outline, canvasTex } from './docao.js';
import { gasLayout } from './shared/gas.js';

let bodyTex = null;
function gasTex() {
  if (bodyTex) return bodyTex;
  bodyTex = canvasTex(512, 256, (x, W, H) => {
    x.fillStyle = '#d0121c'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#f3ecdf'; x.fillRect(0, H * 0.36, W, H * 0.28);
    const flame = (cx, cy, s) => {
      x.beginPath();
      x.moveTo(cx, cy + s * 0.9);
      x.quadraticCurveTo(cx - s * 1.15, cy + s * 0.15, cx - s * 0.18, cy - s * 0.25);
      x.quadraticCurveTo(cx - s * 0.55, cy - s * 0.95, cx + s * 0.02, cy - s * 1.15);
      x.quadraticCurveTo(cx + s * 0.45, cy - s * 0.45, cx + s * 0.22, cy - s * 0.05);
      x.quadraticCurveTo(cx + s * 1.2, cy + s * 0.35, cx, cy + s * 0.9);
      x.fill();
    };
    for (const u of [0.25, 0.75]) {
      const cx = W * u, cy = H * 0.5, s = H * 0.22;
      x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
      x.fillStyle = '#f5c518'; x.fillRect(-s, -s, s * 2, s * 2);
      x.restore();
      x.fillStyle = '#1a120c'; flame(cx, cy + s * 0.08, s * 0.72);
    }
  });
  return bodyTex;
}

function makeMesh(c) {
  const g = new THREE.Group();
  const r = c.r, h = c.h;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, h * 0.78, 16), toon('#ffffff', { map: gasTex() }));
  body.position.y = h * 0.42; outline(body, 0.02); body.castShadow = true; g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.025, r + 0.025, 0.06, 16), toon('#f7f1e6'));
  band.position.y = h * 0.48; g.add(band);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.72, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#3a342e'));
  cap.position.y = h * 0.8; outline(cap, 0.015); g.add(cap);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.34, h * 0.12, 10), toon('#2c2622'));
  collar.position.y = h * 0.9; g.add(collar);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.12, h * 0.1, 8), toon('#d9a441'));
  valve.position.y = h * 0.98; g.add(valve);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.22, 0.025, 6, 14), toon('#c8202c'));
  handle.position.y = h * 1.02; handle.rotation.x = Math.PI / 2; g.add(handle);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.08, 0.06, 14), toon('#2a241c'));
  foot.position.y = 0.03; g.add(foot);

  const flames = new THREE.Group(); flames.position.y = h * 0.98; g.add(flames);
  const cols = [0xfff3c4, 0xff9a1f, 0xff3b10];
  const hgts = [1.25, 0.9, 0.6];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.16 + i * 0.07, hgts[i], 8), new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.92 - i * 0.12, depthWrite: false }));
    m.position.y = hgts[i] * 0.5; flames.add(m);
  }
  flames.visible = false;
  const light = new THREE.PointLight(0xff7a2a, 0, 7, 2); light.position.y = h * 1.15; g.add(light);
  g.position.set(c.x, c.y + 0.02, c.z);
  g.userData.gasId = c.id;
  return { id: c.id, group: g, body, flames, light, burning: false, wasGone: false, pop: 0, smokeT: 0, smokes: [] };
}

const smokeGeo = new THREE.SphereGeometry(0.16, 6, 5);

export function createGasView(scene, hooks = {}) {
  const root = new THREE.Group(); root.name = 'gas-cylinders'; scene.add(root);
  const items = [];
  const byId = new Map();
  let hissT = 0;
  const view = {
    mapId: '',
    mount(mapId) {
      view.clear();
      view.mapId = mapId || '';
      gasLayout(mapId).forEach((c, i) => {
        const v = makeMesh({ ...c, id: i }); items.push(v); byId.set(i, v); root.add(v.group);
      });
    },
    clear() {
      for (const v of items) { for (const s of v.smokes) root.remove(s.mesh); root.remove(v.group); }
      items.length = 0; byId.clear();
    },
    sync(c) {
      const v = byId.get(c.id); if (!v) return;
      const gone = c.phase === 2;
      if (gone) v.wasGone = true;
      else if (v.wasGone && c.phase === 0) { v.wasGone = false; v.pop = 0.32; }
      v.group.visible = !gone;
      v.burning = c.phase === 1;
      v.flames.visible = v.burning;
      v.light.intensity = v.burning ? 2.4 : 0;
      if (!v.burning) v.body.material.emissive.setHex(0x000000);
      if (!gone && !v.pop) v.group.scale.setScalar(1);
    },
    syncAll(list) { for (const c of list) view.sync(c); },
    update(dt, time, ear) {
      let hiss = 0;
      for (const v of items) {
        if (v.pop > 0) {
          v.pop = Math.max(0, v.pop - dt);
          const k = 1 - v.pop / 0.32;
          v.group.scale.setScalar(0.35 + 0.65 * (1 - (1 - k) ** 2));
        }
        if (v.burning) {
          const w = 0.82 + Math.sin(time * 17 + v.id) * 0.18;
          v.flames.scale.set(w, 0.7 + Math.sin(time * 23 + v.id * 2) * 0.28, w);
          v.flames.rotation.y = time * 3 + v.id;
          v.body.material.emissive.setHex(0xff5a18);
          v.body.material.emissiveIntensity = 0.65 + Math.sin(time * 22) * 0.25;
          v.light.intensity = 1.6 + Math.sin(time * 28 + v.id) * 0.9;
          v.smokeT -= dt;
          if (v.smokeT <= 0 && v.smokes.length < 10) {
            v.smokeT = 0.09;
            const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: 0x8e8982, transparent: true, opacity: 0.62, depthWrite: false }));
            m.position.copy(v.group.position);
            m.position.y += 1.55;
            m.position.x += (Math.random() - 0.5) * 0.55;
            m.position.z += (Math.random() - 0.5) * 0.55;
            m.scale.setScalar(1.8);
            root.add(m); v.smokes.push({ mesh: m, life: 0, vel: 0.85 + Math.random() * 0.45, s0: 1.8 });
          }
          if (ear) {
            const dx = ear.x - v.group.position.x, dy = ear.y - v.group.position.y, dz = ear.z - v.group.position.z;
            const vol = Math.max(0, 1 - Math.hypot(dx, dy, dz) / 26);
            if (vol > hiss) hiss = vol;
          }
        }
        for (let i = v.smokes.length - 1; i >= 0; i--) {
          const s = v.smokes[i]; s.life += dt; const k = s.life / 1.15;
          s.mesh.position.y += s.vel * dt; s.mesh.scale.setScalar((s.s0 || 1) * (1 + k * 1.6));
          s.mesh.material.opacity = 0.4 * (1 - k);
          if (k >= 1) { root.remove(s.mesh); s.mesh.material.dispose(); v.smokes.splice(i, 1); }
        }
      }
      hissT -= dt;
      if (hiss > 0.03 && hissT <= 0 && hooks.hiss) { hissT = 0.09; hooks.hiss(hiss); }
    },
    dispose() { view.clear(); scene.remove(root); },
  };
  return view;
}

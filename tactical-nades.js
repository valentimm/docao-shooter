// Granadas táticas: fumaça (tampa a visão) e o Pau de choque (estaca elétrica; regras em shared/shock.js).
import * as THREE from 'three';

export const SMOKE = { fuse: 1.15, life: 12, radius: 5.6, speed: 15 };

// corpo baixo (~0.28 de altura no total), faixa e ponta
const bodyGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.2, 8);
const bandGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.038, 8);
const tipGeo = new THREE.SphereGeometry(0.042, 8, 6);
const puffGeo = new THREE.SphereGeometry(1, 7, 5);

const GRAYS = [0x7d868e, 0x626a72, 0x6e767e, 0x8a929a];
const PUFFS = 22;

// disco cinza quase sólido no meio, some só na borda — esfera transparente parece vidro
function smokeTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const SMOKE_TEX = smokeTex();

function flat(geo, color, extra) {
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, ...extra }));
}

export function makeFlashMesh() {
  const g = new THREE.Group();
  const body = flat(bodyGeo, 0xf4f1e8);
  body.position.y = 0.1;
  g.add(body);
  const band = flat(bandGeo, 0xf2c230);
  band.position.y = 0.12;
  g.add(band);
  return g;
}
export function makeTacticalMesh() { // fumaça
  const g = new THREE.Group();
  const body = flat(bodyGeo, 0x8d939b);
  body.position.y = 0.1; // cilindro de 0.2, base no chão do grupo
  g.add(body);
  const band = flat(bandGeo, 0xf7f7f7);
  band.position.y = 0.12;
  g.add(band);
  const puff = flat(puffGeo, 0xc5ccd2, { transparent: true, opacity: 0.45, depthWrite: false });
  puff.scale.setScalar(0.05);
  puff.position.y = 0.23;
  g.add(puff);
  return g;
}

// Pau de choque: eixo +y = para fora da superfície onde finca; ponta pra -y, luz azul no topo (userData.light)
const stakeSeg = new THREE.CylinderGeometry(0.032, 0.032, 0.1, 8);
const stakeTip = new THREE.ConeGeometry(0.034, 0.14, 8);
const stakeCap = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8);
const stakePin = new THREE.BoxGeometry(0.012, 0.08, 0.012);
const stakeLight = new THREE.SphereGeometry(0.028, 8, 6);
export function makeShockStake() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const s = flat(stakeSeg, i % 2 ? 0x161616 : 0xf2c230); s.position.y = 0.05 + i * 0.1; g.add(s); } // haste listrada amarelo/preto
  const tip = flat(stakeTip, 0xb8c0c8); tip.rotation.x = Math.PI; tip.position.y = -0.07; g.add(tip);
  const cap = flat(stakeCap, 0x9aa3ab); cap.position.y = 0.52; g.add(cap);
  for (const x of [-0.025, 0.025]) { const p = flat(stakePin, 0xc8d0d8); p.position.set(x, 0.58, 0); g.add(p); }
  const light = flat(stakeLight, 0x66ccff); light.position.y = 0.6; g.add(light);
  g.userData.light = light;
  return g;
}
// arco elétrico: Line de 9 pontos com zigue-zague novo a cada set(a, b)
export function makeShockArc() {
  const N = 9, pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.95, depthWrite: false }));
  line.frustumCulled = false;
  return {
    line,
    set(a, b) {
      for (let i = 0; i < N; i++) {
        const k = i / (N - 1), j = i > 0 && i < N - 1 ? 0.12 : 0;
        pos[i * 3] = a.x + (b.x - a.x) * k + (Math.random() * 2 - 1) * j;
        pos[i * 3 + 1] = a.y + (b.y - a.y) * k + (Math.random() * 2 - 1) * j;
        pos[i * 3 + 2] = a.z + (b.z - a.z) * k + (Math.random() * 2 - 1) * j;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

// distância ao quadrado do ponto p até o segmento a–b
function segDist2(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = ab2 > 1e-8 ? (apx * abx + apy * aby + apz * abz) / ab2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = a.x + abx * t - p.x;
  const dy = a.y + aby * t - p.y;
  const dz = a.z + abz * t - p.z;
  return dx * dx + dy * dy + dz * dz;
}

export function inRadius(pos, point, radius) {
  return dist2(pos, point) <= radius * radius;
}

export function makeSmokeCloud(pos) {
  const group = new THREE.Group();
  const center = { x: pos.x, y: pos.y, z: pos.z };
  group.position.set(center.x, center.y, center.z);
  const puffs = [];
  for (let i = 0; i < PUFFS; i++) {
    const core = i < 8; // miolo fechado; o resto faz a borda
    const mat = new THREE.SpriteMaterial({
      map: SMOKE_TEX,
      color: core ? 0x555d65 : GRAYS[i % GRAYS.length],
      transparent: true,
      depthWrite: false,
      opacity: core ? 1 : 0.94,
    });
    const m = new THREE.Sprite(mat);
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * SMOKE.radius * (core ? 0.16 : 0.42);
    const y = (Math.random() - 0.1) * SMOKE.radius * (core ? 0.18 : 0.34);
    const s0 = core ? 4.4 + Math.random() * 1.1 : 3.4 + Math.random() * 1.3;
    m.position.set(Math.cos(ang) * dist, y, Math.sin(ang) * dist);
    m.scale.setScalar(s0);
    m.userData.y0 = y;
    m.userData.phase = Math.random() * Math.PI * 2;
    m.userData.s0 = s0;
    m.userData.op0 = mat.opacity;
    m.userData.rise = 0.08 + Math.random() * 0.1; // sobe devagar
    group.add(m);
    puffs.push(m);
  }
  return {
    group,
    pos: center,
    radius: SMOKE.radius,
    life: SMOKE.life,
    age: 0,
    update(dt) {
      this.age += dt;
      if (this.age >= this.life) {
        this.group.visible = false;
        return false;
      }
      const k = this.age / this.life;
      const fade = k > 0.82 ? (1 - k) / 0.18 : 1;
      for (const m of puffs) {
        const u = m.userData;
        const wave = Math.sin(this.age * 1.7 + u.phase);
        m.position.y = u.y0 + this.age * u.rise;
        m.scale.setScalar(u.s0 * (1 + 0.1 * wave));
        m.material.opacity = u.op0 * (0.94 + 0.06 * wave) * fade;
      }
      return true;
    },
    blocks(eye, target) {
      return segDist2(this.pos, eye, target) < this.radius * this.radius;
    },
  };
}

// Desenho do alvo de bônus e o texto que flutua depois do primeiro acerto.
// O placar e o raio ficam em shared/pocilga-bonus.js. O som entra pelo sfx do jogo.
import * as THREE from 'three';
import { PIT, inspectRun } from './shared/pocilga.js';
import { BONUS, acceptBonus, freshBonus, scoreShot, traceBonus } from './shared/pocilga-bonus.js';

let state = freshBonus();
let armed = null;
let view = null;

const own = (mesh) => { mesh.userData.own = true; return mesh; };

function disc(radius, color, z) {
  const mesh = own(new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  ));
  mesh.position.z = z;
  return mesh;
}

function paintLabel(text, good) {
  const canvas = view.canvas;
  const ctx = view.ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '700 108px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#1a100c';
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
  ctx.fillStyle = good ? '#7CFF6B' : '#ff4b4b';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  view.tex.needsUpdate = true;
}

export function mountBonusTarget(root) {
  state = freshBonus();
  armed = null;
  const grp = new THREE.Group();
  grp.name = 'pocilga-bonus';
  grp.position.set(BONUS.x, BONUS.y, BONUS.z);
  grp.rotation.y = Math.PI;
  // Anéis de arco, nas cores do Natal do mapa. O miolo é o disco de 14 cm.
  const layers = [
    [0.70, -0.09, 0x6a4a32],
    [BONUS.outer, -0.075, 0xc4364a],
    [0.50, -0.06, 0xffd27a],
    [0.36, -0.045, 0x1f6b45],
    [0.24, -0.03, 0xf7f1df],
    [BONUS.inner, -0.015, 0xfff3b0],
    [0.035, 0, 0xc4364a],
  ];
  for (const [radius, z, color] of layers) grp.add(disc(radius, color, z));
  const leaf = new THREE.MeshBasicMaterial({ color: 0x1f6b45 });
  const berry = new THREE.MeshBasicMaterial({ color: 0xc4364a });
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 9));
    const ball = own(new THREE.Mesh(new THREE.SphereGeometry(i % 2 ? 0.045 : 0.06, 8, 6), i % 2 ? berry : leaf));
    ball.position.set(Math.cos(a) * 0.68, Math.sin(a) * 0.68, -0.02);
    grp.add(ball);
  }
  root.add(grp);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const label = own(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })));
  label.position.set(BONUS.x, BONUS.y + BONUS.outer + 0.78, BONUS.z - 0.4);
  label.scale.set(2.5, 1.08, 1);
  label.renderOrder = 10;
  label.visible = false;
  root.add(label);
  view = { grp, label, canvas, ctx: canvas.getContext('2d'), tex, age: 0, baseY: label.position.y };
}

export function clearBonusTarget() {
  state = freshBonus();
  armed = null;
  view = null;
}

export function tickBonusTarget(dt) {
  if (!view) return;
  view.age += dt;
  if (!state.locked) { view.label.visible = false; return; }
  view.label.visible = true;
  view.label.position.y = view.baseY + Math.sin(view.age * 2.6) * 0.07;
}

export function armBonus(hit) { armed = hit || null; }

export function bonusAdjust() { return state.locked ? state.delta : 0; }

export function bonusSnap() {
  return {
    locked: !!state.locked, zone: state.zone, delta: state.delta, text: state.text || '',
    x: BONUS.x, y: BONUS.y, z: BONUS.z, inner: BONUS.inner, outer: BONUS.outer,
  };
}

export function offerBonus(ox, oy, oz, dx, dy, dz, maxT) {
  const hit = traceBonus(ox, oy, oz, dx, dy, dz, maxT);
  if (!hit) return null;
  return { t: hit.t, id: BONUS.id, shot: hit };
}

export function takeBonusShot(weapon, api) {
  const shot = armed;
  armed = null;
  if (!api || !api.started || api.done) return false;
  if (state.locked) return true;
  if (!shot || weapon !== PIT.pistol) return false;
  const extra = { w: weapon, ox: shot.ox, oy: shot.oy, oz: shot.oz, dx: shot.dx, dy: shot.dy, dz: shot.dz };
  const hit = scoreShot(extra, PIT.pistol);
  if (!hit) return false;
  const next = acceptBonus(state, hit);
  if (!next.accepted) return true;
  const before = api.events().length;
  api.push(extra);
  const after = inspectRun(api.events());
  if (after.reason === 'diário' || after.reason === 'ordem' || after.bonusZone !== hit.zone) {
    if (api.events().length > before) api.pop();
    return false;
  }
  state = next;
  if (view) {
    paintLabel(state.text, hit.zone === 'center');
    view.label.visible = true;
  }
  const sfx = api.sfx;
  if (sfx) {
    if (hit.zone === 'center' && sfx.bonusGood) sfx.bonusGood();
    else if (hit.zone === 'ring' && sfx.bonusBad) sfx.bonusBad();
  }
  return true;
}

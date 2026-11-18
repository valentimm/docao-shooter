// Tela do SUBIDO: onda, saturação e aberração cromática em cima do quadro já desenhado.
// prefers-reduced-motion: sem onda e sem aberração, só uma saturação parada.
import * as THREE from 'three';
import { SUBIDO } from './shared/gta-cheats.js';

let rt = null;
let passScene = null;
let passCam = null;
let mat = null;

export function subidoMotionOk() {
  if (typeof matchMedia !== 'function') return true;
  try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return true; }
}

function ensure(renderer) {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const w = Math.max(2, size.x | 0), h = Math.max(2, size.y | 0);
  if (!passScene) {
    passCam = new THREE.Camera();
    mat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAmp: { value: SUBIDO.wave },
        uChroma: { value: SUBIDO.chroma },
        uSat: { value: 2 },
        uPulse: { value: 1 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uAmp;
        uniform float uChroma;
        uniform float uSat;
        uniform float uPulse;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          float t = uTime;
          vec2 o = vec2(
            sin(uv.y * 22.0 + t * 1.7) * uAmp + sin(uv.y * 7.0 - t * 0.6) * uAmp * 0.45,
            sin(uv.x * 18.0 + t * 1.3) * uAmp * 0.85
          );
          float c = uChroma;
          vec3 col;
          col.r = texture2D(tDiffuse, uv + o + vec2(c, c * 0.3)).r;
          col.g = texture2D(tDiffuse, uv + o).g;
          col.b = texture2D(tDiffuse, uv + o - vec2(c, c * 0.25)).b;
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, uSat);
          vec3 ghost = texture2D(tDiffuse, uv + o * 1.6 + vec2(0.006, -0.003)).rgb;
          col = mix(col, ghost, 0.16 * uPulse);
          col.r *= 1.0 + uPulse * 0.22 * sin(t * 0.8);
          col.g *= 1.0 + uPulse * 0.28 * sin(t * 0.8 + 2.0);
          col.b *= 1.0 + uPulse * 0.25 * sin(t * 0.8 + 4.1);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    passScene = new THREE.Scene();
    passScene.add(mesh);
  }
  if (!rt || rt.width !== w || rt.height !== h) {
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, {
      depthBuffer: true,
      stencilBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
    });
    mat.uniforms.tDiffuse.value = rt.texture;
  }
}

export function subidoBind(renderer) {
  ensure(renderer);
  if (renderer.getRenderTarget() === rt) return;
  renderer.setRenderTarget(rt);
  renderer.clear(true, true, true);
}

export function subidoPresent(renderer, time, reduced) {
  if (!rt || !mat) return;
  renderer.setRenderTarget(null);
  const still = !!reduced;
  mat.uniforms.uTime.value = time || 0;
  mat.uniforms.uAmp.value = still ? 0 : SUBIDO.wave;
  mat.uniforms.uChroma.value = still ? 0 : SUBIDO.chroma;
  mat.uniforms.uSat.value = still ? 1.35 : 2.05;
  mat.uniforms.uPulse.value = still ? 0 : 1;
  renderer.render(passScene, passCam);
}

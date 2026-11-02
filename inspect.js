// Inspecionar arma (tecla I): curva da animação e perfis por tipo. Sem DOM, sem three (testável no Node).
export const INSPECT_DUR = 2.2, INSPECT_HOLD = 0.7, INSPECT_FADE = 0.12;
const P = (ry, rz, rx, x, y, z) => ({ ry, rz, rx, x, y, z });
export const INSPECT_PROFILES = {
  rifle: { a: P(0.85, 0.35, 0.12, -0.08, 0.05, 0.05), b: P(-0.55, -0.55, 0.25, -0.05, 0.07, 0.03) },
  pistol: { a: P(1.1, 0.45, 0.1, -0.1, 0.06, 0.08), b: P(-0.8, -0.7, 0.3, -0.06, 0.08, 0.06) },
  sniper: { a: P(0.6, 0.3, 0.08, -0.06, 0.04, 0.03), b: P(-0.35, -0.5, 0.18, -0.04, 0.05, 0.02) },
  rocket: { a: P(0.38, 0.12, -0.1, -0.04, -0.08, 0), b: P(-0.15, -0.3, 0.12, 0, -0.05, 0) }, // bazuca: baixa do ombro e mostra o adesivo
  bow: { a: P(0.7, -0.25, 0.1, -0.08, 0.05, 0.04), b: P(-0.4, 0.35, 0.2, -0.05, 0.06, 0.03) },
  knife: { a: P(0.3, 0.2, 0.06, -0.05, 0.04, 0.02), b: P(-0.2, -0.3, 0.1, -0.03, 0.05, 0.02), flip: true }, // churrasqueira: gira no dedo. Os outros modelos trocam esse giro (knifeInspectLocal)
  saber: { a: P(0.35, 0.25, 0.05, -0.05, 0.03, 0), b: P(-0.3, -0.3, 0.08, -0.03, 0.04, 0), twist: 1.2 }, // torce o cabo
  disc: { a: P(0.7, 0.3, -0.15, -0.07, 0.06, 0.04), b: P(-0.45, -0.6, 0.2, -0.05, 0.07, 0.03) },
  heavy: { a: P(0.45, 0.2, -0.05, -0.05, -0.03, 0), b: P(-0.25, -0.35, 0.12, -0.03, -0.01, 0), spin: true }, // minigun: pesada, gira pouco
  lmg: { a: P(-1.25, 0.14, 0.06, -0.02, -0.04, 0.02), b: P(0.7, -0.18, 0.05, 0.03, -0.035, 0.02) }, // giro largo pro lado da caixa de fita e do cano; baixada leve
  shield: { a: P(0.55, 0.4, 0.08, -0.04, 0.02, 0.06), b: P(-0.7, -0.25, 0.12, 0.02, 0.04, 0.04) }, // tampa: mostra a fresta e o aro de latão
  revolver: { a: P(0.42, 0.16, 0.05, -0.03, 0.02, 0.015), b: P(-0.28, -0.2, 0.06, -0.02, 0.03, 0.012) }, // o giro no dedo mora no viewmodel; aqui só um inclinar curto
};
// perfil pelas flags que já existem (arma nova funciona sem mexer aqui); w.inspect força um perfil
export function inspectKind(w) {
  if (!w) return 'rifle';
  if (w.inspect && INSPECT_PROFILES[w.inspect]) return w.inspect;
  if (w.saber) return 'saber'; if (w.melee) return 'knife'; if (w.rocket) return 'rocket'; if (w.scope) return 'sniper'; if (w.disc) return 'disc';
  if (w.heavy || w.spin) return 'heavy';
  if (w.key === 'arco' || w.key === 'besta' || w.egg) return 'bow'; // estilingue usa as mesmas mãos do arco
  if (w.key === 'pistol' || w.key === 'prego') return 'pistol';
  return 'rifle';
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const AX = ['ry', 'rz', 'rx', 'x', 'y', 'z'];
// k 0..1: descanso → lado A (0–0,18) · segura A (até 0,42) · vira pro B (0,42–0,62) · segura B (até 0,8) · volta (0,8–1)
export function inspectPose(k, prof, out = {}) {
  const ta = ss(0, 0.18, k) * (1 - ss(0.42, 0.62, k)), tb = ss(0.42, 0.62, k) * (1 - ss(0.8, 1, k));
  for (const c of AX) out[c] = prof.a[c] * ta + prof.b[c] * tb;
  out.ry += Math.sin(k * Math.PI * 3) * 0.04 * (ta + tb); // respira
  const f = ss(0.44, 0.6, k); out.flip = prof.flip && f < 1 ? f * Math.PI * 2 : 0;
  out.twist = (prof.twist || 0) * (ta - tb); out.spin = !!prof.spin; out.k = k;
  return out;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const Z = () => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, spin: 0, flick: 0, show: 0, finger: true });
// Inspeção por modelo, no jeito do Counter-Strike. k 0 e 1 = descanso.
// churrasqueira: o giro no dedo (flip do perfil knife). karambit: uma volta na argola e mostra a curva.
// bayoneta: o pulso apresenta a lâmina e vira até o anel do cano. skeleton: a face furada, depois a outra.
// butterfly: o flick no pino e, em seguida, a lâmina aberta à mostra.
export function knifeInspectLocal(kind, k) {
  const finger = kind !== 'skeleton' && kind !== 'karambit' && kind !== 'bayonet' && kind !== 'butterfly';
  const z = Z(); z.finger = finger;
  const t = clamp01(k);
  if (t <= 0 || t >= 1 || finger) return z;
  if (kind === 'karambit') {
    const env = ss(0.04, 0.14, t) * (1 - ss(0.86, 0.98, t));
    const show = ss(0.4, 0.55, t) * (1 - ss(0.8, 0.96, t));
    z.spin = ss(0.08, 0.36, t) * Math.PI * 2; // uma volta na argola; 2π cai no mesmo lugar do descanso
    z.y = 0.05 * env + 0.02 * show;
    z.rx = -0.45 * show; // depois do giro, a curva aponta pro olho
    z.z = 0.05 * show;
    return z;
  }
  if (kind === 'bayonet') {
    const env = ss(0.08, 0.26, t) * (1 - ss(0.8, 0.97, t));
    const ring = ss(0.3, 0.48, t) * (1 - ss(0.78, 0.94, t));
    z.ry = 0.75 * env;
    z.rx = -0.28 * env;
    z.rz = 1.15 * ring; // o pulso vira e o anel da guarda passa na frente
    z.y = 0.04 * env;
    z.z = -0.06 * env; // a ponta vai pra frente
    return z;
  }
  if (kind === 'skeleton') {
    const env = ss(0.06, 0.24, t) * (1 - ss(0.82, 0.97, t));
    const other = ss(0.42, 0.56, t) * (1 - ss(0.74, 0.9, t));
    z.rx = 0.85 * env; // deita a face furada pra câmera
    z.ry = -1.05 * env + 0.55 * other;
    z.rz = -0.35 * env + 1.05 * other; // a outra face dos furos
    z.x = -0.02 * env;
    z.y = 0.05 * env;
    z.z = 0.1 * env; // chega mais perto, senão o furo some
    return z;
  }
  // butterfly
  z.flick = ss(0.02, 0.32, t);
  z.show = ss(0.4, 0.55, t) * (1 - ss(0.78, 0.94, t));
  z.ry = 0.35 * z.show;
  z.y = 0.02 * z.show;
  return z;
}
// Cancela uma volta inteira sem desenrolar: ângulo perto de 2π fica em 2π, que é o descanso.
export function fadeFullTurn(angle, w) {
  const tau = Math.PI * 2, nearest = Math.round(angle / tau) * tau;
  return nearest + (angle - nearest) * w;
}
// flick 0..1 é o abrir da butterfly (show 0 = o mesmo de sempre). show abre a lâmina e segura o cabo de cima.
export function butterflyInspectAngles(flick, show = 0) {
  const e = clamp01(flick), s = clamp01(show), u = e * e * (3 - 2 * e);
  return {
    blade: u * Math.PI * 2 + s * Math.PI,
    bite: Math.sin(u * Math.PI) * Math.PI * (1 - s) + s * Math.PI,
  };
}

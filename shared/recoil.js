// Recoil da câmera: padrões reproduzíveis, separados da animação da arma.
// Ângulos em radianos. O tiro atual sai antes do impulso; o próximo já usa a mira elevada.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PATTERNS = {
  rifle: [0, 0.08, 0.18, 0.35, 0.55, 0.7, 0.45, 0.1, -0.35, -0.65, -0.5, -0.2],
  smg: [0.08, -0.12, 0.2, 0.3, 0.1, -0.3, -0.4, -0.1, 0.2, 0.35],
  heavy: [0, 0.2, 0.35, 0.5, 0.3, -0.15, -0.45, -0.5, -0.2, 0.15],
  burst: [0, 0.08, -0.08],
  single: [0.1, -0.1, 0.06, -0.06],
};
export function recoilProfile(w, scoped = false) {
  const automatic = !!(w.auto || w.spin || w.burst);
  const pattern = w.burst ? PATTERNS.burst : w.spin || w.key === 'lmg' ? PATTERNS.heavy
    : w.key === 'uzi' || w.key === 'p90' ? PATTERNS.smg : automatic ? PATTERNS.rifle : PATTERNS.single;
  const hipGain = w.key === 'canhao' ? 1.8 : w.key === 'carabina' ? 2.2 : 0.85;
  return { pattern, gain: w.scope ? (scoped ? 0.85 : hipGain) : w.revolver ? 0.8 : w.pellets > 1 ? 0.85 : 1,
    delay: Math.max(0.18, Math.min(0.32, (w.rate || 0.1) * 1.35)),
    reset: Math.max(0.4, (w.rate || 0.1) * 1.8), recover: w.scope ? 9 : 7,
    pitchCap: 0.24, yawCap: 0.065, automatic };
}
export function resetRecoil(p) { p.recoil = null; p.recoilLift = 0; }
// O jogador assume a direção atual. Não há alvo antigo para onde puxar a mira.
export function cancelRecoilReturn(p) {
  if (p.recoil) { p.recoil.pitch = 0; p.recoil.yaw = 0; }
  p.recoilLift = 0;
}
export function kickRecoil(p, w, now, ads = 0, scoped = ads >= 0.85) {
  if (!(w.recoil > 0) || w.melee || w.saber) return;
  const prof = recoilProfile(w, scoped);
  if (!p.recoil || p.recoil.key !== w.key) resetRecoil(p);
  const r = p.recoil ||= { key: w.key, shots: 0, last: -Infinity, pitch: 0, yaw: 0, profile: prof };
  if (now - r.last > prof.reset) r.shots = 0;
  const shot = r.shots++, horizontal = prof.pattern[shot % prof.pattern.length];
  const control = (1 - 0.25 * clamp(ads, 0, 1)) * (1 - 0.15 * clamp(p.crouch || 0, 0, 1));
  // Red dot no ADS fechado: 35% do coice real (subida, lateral e padrão) que a arma aplicaria nesse estado.
  // Abaixo do limiar, e no quadril, o multiplicador é 1.
  const dotMul = w.redDot && ads >= (w.redDotAds ?? 0.85) ? (Number.isFinite(w.adsRecoil) ? w.adsRecoil : 0.35) : 1;
  const kick = w.recoil * prof.gain * control * dotMul;
  const climb = prof.automatic ? 0.8 + Math.min(shot, 8) * 0.07 : 1;
  const vertical = Math.min(kick * climb, Math.max(0, prof.pitchCap - r.pitch));
  const pitch = clamp(p.pitch + vertical, -1.5, 1.5) - p.pitch;
  const yaw = clamp(r.yaw + kick * horizontal, -prof.yawCap, prof.yawCap) - r.yaw;
  p.pitch += pitch; p.yaw += yaw; r.pitch += pitch; r.yaw += yaw;
  r.last = now; r.profile = prof;
}
export function stepRecoil(p, dt, now) {
  const r = p.recoil; if (!r) return;
  // Só a parte do frame depois do atraso participa da recuperação.
  const active = Math.min(dt, Math.max(0, now - r.last - r.profile.delay));
  if (active <= 0) return;
  const decay = Math.exp(-r.profile.recover * active);
  const nextPitch = Math.abs(r.pitch * decay) < 1e-6 ? 0 : r.pitch * decay;
  const nextYaw = Math.abs(r.yaw * decay) < 1e-6 ? 0 : r.yaw * decay;
  p.pitch = clamp(p.pitch - (r.pitch - nextPitch), -1.5, 1.5);
  p.yaw -= r.yaw - nextYaw; r.pitch = nextPitch; r.yaw = nextYaw;
}

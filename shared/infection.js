// ============================================================
//  Modo Infecção 🧟 (zumbis × sobreviventes, até 50 por sala) — regras compartilhadas (servidor e cliente).
//  Sem DOM, sem Three.js. Números escolhidos a partir de CoD Infected, Halo Infection e Zombie Plague (CS 1.6):
//  veja /workspace/invasao-prev/PESQUISA.md (resumo) e o README.
//  • Todo mundo começa sobrevivente (time 0). Depois de OUTBREAK s o surto escolhe o(s) zumbi(s) alfa (time 1),
//    1 a cada ALPHA_PER jogadores (mínimo 1, sempre sobra pelo menos 1 sobrevivente).
//  • Zumbi só tem a faca: golpe que acerta sobrevivente = infecção na hora (vira zumbi ali mesmo).
//    No lugar do Q (Copo Bomba) o zumbi arremessa a faquinha (um acerto infecta), com recarga KNIFE.cd.
//  • Zumbi tem mais vida (Z_HP; o alfa mais ainda) e corre um pouco mais. Zumbi morto fica de fora até o fim
//    da rodada (estilo Zombie Plague): os sobreviventes vencem matando todos os zumbis OU segurando até o tempo acabar.
//  • Zumbis vencem quando não sobra nenhum sobrevivente. Cada infecção soma PER_INFECT s no relógio (CoD).
//  • Sobrevivente que morre sem ser por zumbi (próprio Copo Bomba, queda) volta como zumbi em SUICIDE_RESPAWN s (Halo).
//  • Quem entra no meio da rodada (depois do surto) entra como zumbi.
// ============================================================
export const INF = {
  mode: 'inf', MAX_PLAYERS: 50, MAX_CHOICES: [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50], DEFAULT_MAX: 16,
  BOT_FILL_MAX: 15, // bots de preenchimento no máximo (CPU da sala); os outros lugares ficam pra gente de verdade
  OUTBREAK: 15, // s até o surto (CoD MW2: 15 s; Zombie Plague: 10–15 s; BO3: 8 s)
  ROUND: 180, PER_INFECT: 15, ROUND_MAX: 420, // s: rodada de 3 min, +15 s por infecção, teto de 7 min
  ALPHA_PER: 8, // 1 alfa a cada 8 jogadores (Halo: 2–3 em 16; Halo 3: 25%; CoD: 1)
  Z_HP: 300, ALPHA_HP_BASE: 400, ALPHA_HP_PER: 100, ALPHA_HP_MAX: 2000, // vida: humano 100; ZP usa alfa = 2× zumbi
  INFECT_HEAL: 100, Z_HP_CAP: 600, // ZP: zumbi recupera vida a cada infecção
  Z_SPEED: 1.1, Z_JUMP: 1.1, // Halo: 110% de velocidade e de pulo (por cima dos 1,15× de quem corre de faca)
  INFECT_INVULN: 1.0, // s de proteção de quem acabou de virar (não morre no mesmo tiro que estava levando)
  SUICIDE_RESPAWN: 3,
  OVER_DELAY: 2.5, // s entre a vitória e a tela de fim (dá pra ver o último infectado/zumbi cair)
  KNIFE: { cd: 8, alphaCd: 5, speed: 30, grav: 6, life: 1.4, radius: 0.16 }, // faquinha: ~40 m de alcance, cai um pouco
  DEFAULT_MAP: 'fazendona',
  SEND_HZ: 15, // envio do cliente nesse modo (20 nos outros): 25% menos mensagens cobradas na Cloudflare
};
export const isInfection = (m) => m === INF.mode;
export const SURV = 0, ZOMB = 1;
export const INF_TEAM_NAMES = ['Sobreviventes', 'Zumbis'];
export const INF_TEAM_COLORS = ['#ffd23f', '#6ee05a'];
export const INF_TEAM_HEX = [0xffd23f, 0x6ee05a];
export const INF_PHASES = ['wait', 'live', 'over'];
export const clampInfMax = (n) => Math.max(2, Math.min(INF.MAX_PLAYERS, n | 0 || INF.DEFAULT_MAX));
export const alphaCount = (n) => Math.max(1, Math.min(n - 1, Math.round(n / INF.ALPHA_PER)));
export const alphaHp = (n, alphas) => Math.min(INF.ALPHA_HP_MAX, INF.ALPHA_HP_BASE + INF.ALPHA_HP_PER * Math.max(0, Math.round(n / Math.max(1, alphas)) - 1));
export const knifeCd = (alpha) => (alpha ? INF.KNIFE.alphaCd : INF.KNIFE.cd);
// estado da rodada → array curto pro snapshot: [fase, surto em, fim em, sobreviventes vivos, zumbis vivos, vencedor]
export function packInf(s) { return [INF_PHASES.indexOf(s.phase), Math.round(s.outbreakAt * 10) / 10, Math.round(s.endAt * 10) / 10, s.surv | 0, s.zomb | 0, s.winner]; }
export function unpackInf(a) { return a ? { phase: INF_PHASES[a[0]] || 'wait', outbreakAt: a[1], endAt: a[2], surv: a[3], zomb: a[4], winner: a[5] } : null; }
// Faquinha no ar: anda dt (com um pouco de gravidade). Devolve null (segue voando), { wall: ponto } ou { t: alvo, at: ponto }.
// targets: [{ e, pts: [[centro, raio], ...] }] já sem o dono nem aliados. rayWorld/raySphere vêm de shared/physics.js.
export function stepKnife(k, dt, rayWorld, raySphere, targets) {
  k.t += dt; k.vel.y -= INF.KNIFE.grav * dt;
  const L = Math.hypot(k.vel.x, k.vel.y, k.vel.z) * dt || 1e-6, d = { x: k.vel.x * dt / L, y: k.vel.y * dt / L, z: k.vel.z * dt / L };
  const wall = rayWorld(k.pos, d, L + 0.02);
  let best = null;
  for (const tg of targets) for (const [c, r] of tg.pts) {
    const tt = raySphere(k.pos, d, c, r + INF.KNIFE.radius);
    if (tt >= 0 && tt <= L + 0.02 && (wall === null || tt < wall) && (!best || tt < best.tt)) best = { e: tg.e, tt };
  }
  const at = (tt) => ({ x: k.pos.x + d.x * tt, y: k.pos.y + d.y * tt, z: k.pos.z + d.z * tt });
  if (best) return { t: best.e, at: at(best.tt) };
  if (wall !== null) return { wall: at(wall) };
  k.pos.x += k.vel.x * dt; k.pos.y += k.vel.y * dt; k.pos.z += k.vel.z * dt;
  if (k.t >= INF.KNIFE.life || k.pos.y < -2) return { wall: { ...k.pos } };
  return null;
}

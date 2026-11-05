// ============================================================
//  Modo Invasão (Halloween 🎃): co-op contra hordas de zumbis — regras + simulação compartilhada.
//  Roda igual no cliente offline (solo) e no servidor online (autoritativo). Sem DOM, sem Three.js.
//  • Todos os jogadores de verdade no mesmo time, sem bots de jogador. Sem fogo amigo: tiro, explosão, killstreak
//    e poder nunca machucam jogador (nem você mesmo). Quem machuca jogador é zumbi e a Névoa Assombrada.
//  • 20 waves, cada uma mais difícil (mais zumbis, mais vida, mais rápidos). Chefão "Docão Abóbora" a cada 5 waves.
//    Pausa de ~15 s entre as waves (troca de arma no painel). Sobreviveu à wave 20 = vitória.
//  • 2 vidas por jogador: morreu com vida sobrando, renasce normal; sem vidas, fica assistindo.
//    Só a Ressurreição traz de volta (máx. 4 por bloco de 5 waves e 1 por wave). Todo mundo fora = fim de jogo.
//  • Poderes caem dos zumbis (chance baixa), pega no chão andando por cima, guarda até 3.
//  • Névoa Assombrada (estilo tempestade do Fortnite): círculo seguro diminui e muda de lugar a cada wave.
//    Fora dele o jogador perde vida; zumbi não sente a névoa.
//  Integração: o host (main.js offline ou server/src/game.js) passa um adaptador A (ver InvasionCore).
//  A.botDiff (string ou função) escolhe o jeito da horda em shared/bot-difficulty.js.
//  Vida, dano e quantidade de zumbis continuam no waveSpec — a dificuldade não multiplica isso.
// ============================================================
import { zombieTune } from './bot-difficulty.js';
export const INV = {
  mode: 'inv', WAVES: 20, PREP: 12, BREAK: 15, LIVES: 2, INV_MAX: 3,
  DROP_LIFE: 35, PICK_R: 1.5, BOSS_EVERY: 5, RES_PER_BLOCK: 4, BLOCK: 5,
  FOG_MIN_R: 11, FOG_SHRINK: 32, FOG_DPS: 5, FOG_DPS_WAVE: 0.5,
  MAX_PLAYERS: 30, DEFAULT_MAP: 'rodizio', ZOMBIE_LINGER: 2.4, SPAWN_MIN: 12,
};
export const isInvasion = (m) => m === INV.mode;
// Munição na Invasão: caixas do mapa voltam rápido, dão mais (reserva até 1,5× e pente cheio, +2 foguetes) e zumbi também solta caixa.
export const INV_AMMO = { respawn: 6, reserveMul: 1.5, rockets: 2, zdrop: { walker: 0.14, runner: 0.12, tank: 0.4, spitter: 0.2, boss: 1 } };
// mesma conta no cliente offline, no cliente online (espelho do 'got'/'dg') e no servidor. Devolve true se pegou alguma coisa.
export function invRefillAmmo(e, WEAPONS) {
  let got = false;
  for (const i of e.slots) {
    const w = WEAPONS[i]; if (!w || !(w.reserve > 0)) continue;
    const cap = Math.ceil(w.reserve * INV_AMMO.reserveMul);
    const left = w.akimbo ? (e.drum && e.drum[i] != null ? e.drum[i] : w.mag) : w.mag;
    if (e.reserve[i] >= cap && e.mag[i] >= w.mag && left >= w.mag) continue;
    e.reserve[i] = Math.min(cap, e.reserve[i] + (w.rocket ? INV_AMMO.rockets : w.reserve));
    e.mag[i] = Math.max(e.mag[i], w.mag);
    if (w.akimbo) { if (!e.drum) e.drum = WEAPONS.map(() => null); e.drum[i] = w.mag; }
    got = true;
  }
  return got;
}
export const PHASES = ['prep', 'wave', 'break', 'over'];

// tipos de zumbi (animatrônicos do Docão). size = escala do corpo (hitbox e modelo).
export const ZTYPES = ['walker', 'runner', 'tank', 'spitter', 'boss'];
export const ZOMBIES = {
  walker: { name: 'Docão Podre', hp: 110, speed: 4.4, dmg: 14, rate: 1.0, reach: 1.75, size: 1, drop: 0.06 },
  runner: { name: 'Esqueleto Corredor', hp: 55, speed: 6.6, dmg: 8, rate: 0.7, reach: 1.55, size: 0.95, drop: 0.05 },
  tank: { name: 'Barrigão de Gás', hp: 520, speed: 3.0, dmg: 26, rate: 1.4, reach: 2.1, size: 1.3, drop: 0.3, boom: { radius: 4.8, dmg: 38, knock: 9 } },
  spitter: { name: 'Cuspidor', hp: 85, speed: 4.0, dmg: 10, rate: 1.2, reach: 1.65, size: 1.05, drop: 0.09, spit: { range: 22, keep: 11, every: 2.6, speed: 15, dmg: 13, radius: 1.8 } },
  boss: { name: 'Docão Abóbora', hp: 1500, speed: 4.4, dmg: 36, rate: 1.3, reach: 2.7, size: 1.7, drop: 1, spit: { range: 34, keep: 0, every: 4.2, speed: 17, dmg: 26, radius: 3.6, big: 1 } },
};
// poderes especiais (inventário de 3). w = peso no sorteio do drop.
export const POWERS = {
  pumpkin: { name: 'Abóbora Explosiva', icon: '🎃', w: 1.0, speed: 19, fuse: 1.8, radius: 6.5, dmg: 340, knock: 14, desc: 'Arremessa uma abóbora que explode em área' },
  howl: { name: 'Uivo do Lobisomem', icon: '🐺', w: 1.0, radius: 10, stun: 3.5, knock: 15, dmg: 25, desc: 'Empurra e atordoa os zumbis em volta' },
  potion: { name: 'Poção de Cura', icon: '🧪', w: 1.0, radius: 9, heal: 70, desc: 'Cura você e os aliados perto' },
  lantern: { name: 'Lanterna Sagrada', icon: '🔦', w: 0.9, range: 17, cone: 0.42, dur: 4.5, dps: 150, desc: 'Cone de luz que queima os zumbis' },
  ghost: { name: 'Fantasma', icon: '👻', w: 0.8, dur: 7, speed: 1.3, desc: 'Invisível pros zumbis e mais rápido' },
  revive: { name: 'Ressurreição', icon: '✨', w: 0.45, desc: 'Revive todos os aliados mortos' },
};
export const POWER_KEYS = ['pumpkin', 'howl', 'potion', 'lantern', 'ghost', 'revive'];
export const DROP_KEYS = [...POWER_KEYS, 'ammo']; // índice enviado no 'dp'/'dg': poderes e a caixa de munição que o zumbi solta
export const KEYS = { use: 'KeyG', useLabel: 'G', cycle: 'KeyX', cycleLabel: 'X' };
export const SPIT_GRAV = 20;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = (dx, dz) => Math.hypot(dx, dz);
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const r2 = (v) => Math.round(v * 100) / 100;

// composição da wave w (1..20) com n jogadores
export function waveSpec(w, n = 1) {
  n = clamp(n | 0 || 1, 1, INV.MAX_PLAYERS);
  const total = Math.round((12 + w * 6) * (1 + 0.6 * (n - 1))); // ~2,5× a versão 1 (7→18 na wave 1, 53→132 na 20)
  const mix = { walker: 1, runner: w >= 2 ? 0.14 + 0.022 * w : 0, spitter: w >= 4 ? 0.12 + 0.004 * w : 0, tank: w >= 6 ? 0.05 + 0.006 * w : 0 };
  return {
    w, n, total, mix, boss: w % INV.BOSS_EVERY === 0,
    hpMul: (1 + 0.09 * (w - 1)) * (1 + 0.12 * (n - 1)),
    spdMul: Math.min(1.45, 1 + 0.025 * (w - 1)),
    dmgMul: 1 + 0.04 * (w - 1),
    maxAlive: Math.min(18 + 3 * n + w, 48), // teto de vivos ao mesmo tempo (desempenho); o resto entra em lotes
    batch: Math.min(6, 2 + Math.floor(w / 5) + Math.floor(n / 3)), // zumbis por lote
    spawnEvery: Math.max(0.35, 1.3 - 0.045 * w) / Math.sqrt(n),
    bossHp: ZOMBIES.boss.hp * (1 + 0.55 * (w / INV.BOSS_EVERY - 1)) * (1 + 0.5 * (n - 1)),
  };
}
// fila de tipos da wave (determinística com rnd)
export function waveQueue(spec, rnd = Math.random) {
  const keys = Object.keys(spec.mix).filter((k) => spec.mix[k] > 0), sum = keys.reduce((a, k) => a + spec.mix[k], 0), q = [];
  for (let i = 0; i < spec.total; i++) { let r = rnd() * sum, k = keys[0]; for (const kk of keys) { r -= spec.mix[kk]; if (r <= 0) { k = kk; break; } } q.push(k); }
  return q;
}
// raio do círculo seguro alvo da wave w (mapa com meia-largura hx/hz)
export function fogRadius(w, hx, hz) {
  const R0 = Math.hypot(hx, hz) * 0.8, f = Math.pow(1 - (w - 1) / (INV.WAVES - 1), 1.25);
  return Math.max(INV.FOG_MIN_R, INV.FOG_MIN_R + (R0 - INV.FOG_MIN_R) * f);
}
export const fogDps = (w) => INV.FOG_DPS + INV.FOG_DPS_WAVE * w;
// a Ressurreição pode cair? (máx. RES_PER_BLOCK por bloco de 5 waves, 1 por wave)
export function reviveAllowed(counts, wave) {
  const blk = Math.floor((Math.max(1, wave) - 1) / INV.BLOCK);
  return !(counts.wave[wave] >= 1) && (counts.block[blk] || 0) < INV.RES_PER_BLOCK;
}
export function noteRevive(counts, wave) { const blk = Math.floor((Math.max(1, wave) - 1) / INV.BLOCK); counts.wave[wave] = (counts.wave[wave] || 0) + 1; counts.block[blk] = (counts.block[blk] || 0) + 1; }
// direção da câmera a partir do yaw/pitch do MODELO (yaw do modelo = câmera + π)
export function modelAim(yaw, pitch) { const c = Math.cos(pitch); return { x: Math.sin(yaw) * c, y: Math.sin(pitch), z: Math.cos(yaw) * c }; }
// raio × esfera escalada (zumbis maiores têm hitbox maior): usa as mesmas esferas do Docão (shared/physics HITBOXES)
export function scaleHit(o, d, pos, size, fn) {
  if (!size || size === 1) return fn(o, pos);
  const so = { x: pos.x + (o.x - pos.x) / size, y: pos.y + (o.y - pos.y) / size, z: pos.z + (o.z - pos.z) / size };
  const h = fn(so, pos); return h ? { ...h, t: h.t * size } : null;
}

// ------------------------------------------------------------
//  Simulação. A (adaptador do host):
//   T() tempo de jogo · P física (shared/physics) · nav (nav.js) · size [hx, hz]
//   players() humanos na partida (vivos ou não): { id, pos, vel, alive, hp, yaw, pitch, lives, out, inv, ghostUntil }
//   spawnZombie(type, pos) → ent (host cria e põe na lista dele; o core preenche os campos de zumbi)
//   removeZombie(z) · hurtPlayer(p, dmg, src|null) · hurtZombie(z, dmg, by, kind) · knock(e, {x,y,z})
//   heal(p, hp) · revive(p, pos) · invChanged(p) · emit(ev) · aimOf(p) → { o, d } · over(won, wave)
//   rnd() opcional
// ------------------------------------------------------------
export class InvasionCore {
  constructor(A) {
    this.A = A; this.rnd = A.rnd || Math.random;
    this.phase = 'prep'; this.wave = 0; this.phaseEnd = 0; this.queue = []; this.nextSpawn = 0; this.bossAt = 0;
    this.zombies = []; this.drops = []; this.projs = []; this.lanterns = []; this.nid = 1;
    this.resCount = { wave: {}, block: {} }; this.spec = null; this.bossId = 0; this.won = false;
    const [hx, hz] = A.size; this.hx = hx; this.hz = hz;
    const R = Math.hypot(hx, hz) + 6; this.fog = { cx: 0, cz: 0, r: R, fx: 0, fz: 0, fr: R, tx: 0, tz: 0, tr: R, t0: 0, t1: 0 };
    this.flow = null; this.flowAt = -9; this.rev = null; this.fogTick = 0; this.overAt = 0;
    this.kills = 0;
  }
  get T() { return this.A.T(); }
  start() {
    this.phase = 'prep'; this.wave = 0; this.phaseEnd = this.T + INV.PREP;
    for (const p of this.A.players()) this.ensure(p, true);
    this.A.emit(['wv', 0, 0, r2(this.phaseEnd)]);
  }
  ensure(p, reset = false) {
    if (reset || p.lives == null) { p.lives = INV.LIVES; p.out = false; p.inv = []; p.ghostUntil = 0; }
    if (!p.inv) p.inv = []; return p;
  }
  humansAlive() { return this.A.players().filter((p) => p.alive); }
  liveZombies() { return this.zombies.filter((z) => z.alive); }
  // ---------- laço ----------
  step(dt) {
    if (this.phase === 'over') return;
    const T = this.T;
    for (const p of this.A.players()) this.ensure(p);
    if ((this.phase === 'prep' || this.phase === 'break') && T >= this.phaseEnd) this.startWave(this.wave + 1);
    if (this.phase === 'wave') this.stepSpawns(T);
    this.stepFog(T, dt);
    if (T - this.flowAt > 0.5) this.buildFlow();
    for (const z of this.zombies) if (z.alive) this.stepZombie(z, dt, T);
    this.separate();
    this.stepProjs(dt, T);
    this.stepLanterns(dt, T);
    this.stepDrops(T);
    for (const z of this.zombies.filter((x) => !x.alive && T >= x.removeAt)) { this.zombies = this.zombies.filter((x) => x !== z); this.A.removeZombie(z); }
    if (this.phase === 'wave' && !this.queue.length && !this.bossPending && !this.liveZombies().length) this.endWave();
    const H = this.A.players();
    if (H.length && H.every((p) => !p.alive && p.out)) { if (!this.overAt) this.overAt = T + 1.2; else if (T >= this.overAt) this.finish(false); }
    else this.overAt = 0;
  }
  startWave(w) {
    const n = Math.max(1, this.A.players().length);
    this.wave = w; this.phase = 'wave'; this.spec = waveSpec(w, n); this.queue = waveQueue(this.spec, this.rnd);
    this.nextSpawn = this.T + 0.8; this.bossPending = this.spec.boss; this.bossAt = this.T + 3.5; this.bossId = 0;
    this.planFog(w);
    this.A.emit(['wv', 1, w, 0, this.spec.boss ? 1 : 0, this.queue.length + (this.spec.boss ? 1 : 0)]);
  }
  endWave() {
    if (this.wave >= INV.WAVES) { this.finish(true); return; }
    this.phase = 'break'; this.phaseEnd = this.T + INV.BREAK;
    this.A.emit(['wv', 2, this.wave, r2(this.phaseEnd)]);
  }
  finish(won) {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.won = won; this.A.emit(['wv', 3, this.wave, won ? 1 : 0]);
    this.A.over(won, this.wave);
  }
  // ---------- névoa ----------
  planFog(w) {
    const F = this.fog, tr = fogRadius(w, this.hx, this.hz);
    const room = Math.max(0, Math.min(F.r, F.fr === F.tr ? F.r : F.r) - tr);
    let best = null, bs = -1e9; const good = (this.A.nav && this.A.nav.good) || [];
    for (let i = 0; i < 70 && good.length; i++) {
      const nd = good[Math.floor(this.rnd() * good.length)]; if (nd.y > 1.5) continue;
      const dc = hyp(nd.x - F.cx, nd.z - F.cz); if (dc > room) continue;
      // fica longe da borda do mapa e anda um pouco (move de verdade, sem pular pra longe demais)
      const edge = Math.min(this.hx - Math.abs(nd.x), this.hz - Math.abs(nd.z));
      const s = Math.min(edge, tr * 0.6) + Math.min(dc, room * 0.7) * 0.5 + this.rnd() * 4;
      if (s > bs) { bs = s; best = nd; }
    }
    const c = best || { x: F.cx, z: F.cz };
    Object.assign(F, { fx: F.cx, fz: F.cz, fr: F.r, tx: c.x, tz: c.z, tr, t0: this.T, t1: this.T + INV.FOG_SHRINK });
  }
  stepFog(T, dt) {
    const F = this.fog;
    if (F.t1 > F.t0) { const k = clamp((T - F.t0) / (F.t1 - F.t0), 0, 1), e = k * k * (3 - 2 * k); F.cx = F.fx + (F.tx - F.fx) * e; F.cz = F.fz + (F.tz - F.fz) * e; F.r = F.fr + (F.tr - F.fr) * e; }
    this.fogTick += dt; if (this.fogTick < 0.5) return; const step = this.fogTick; this.fogTick = 0;
    if (this.phase === 'prep') return;
    for (const p of this.A.players()) if (p.alive && !this.inSafe(p.pos)) this.A.hurtPlayer(p, fogDps(Math.max(1, this.wave)) * step, null);
  }
  inSafe(pos, F = this.fog) { return hyp(pos.x - F.cx, pos.z - F.cz) <= F.r; }
  // ---------- zumbis ----------
  stepSpawns(T) {
    const S = this.spec;
    if (this.bossPending && T >= this.bossAt) { const z = this.spawn('boss'); if (z) { this.bossPending = false; this.bossId = z.id; } }
    if (!this.queue.length || T < this.nextSpawn) return;
    if (this.liveZombies().length >= S.maxAlive) { this.nextSpawn = T + 0.4; return; }
    const burst = Math.min(S.batch || 1, S.maxAlive - this.liveZombies().length); // lote (sem passar do teto)
    for (let i = 0; i < burst && this.queue.length; i++) if (this.spawn(this.queue[0])) this.queue.shift();
    this.nextSpawn = T + S.spawnEvery * (0.6 + this.rnd() * 0.8);
  }
  // onde nasce um zumbi: ponto ALEATÓRIO andável do mapa inteiro (nav.good = chão alcançável, fora de parede),
  // a pelo menos SPAWN_MIN m de todo jogador vivo e, se der, fora da linha de visão deles (sem susto à queima-roupa)
  spawnPos() {
    const good = (this.A.nav && this.A.nav.good) || [], H = this.A.players().filter((p) => p.alive), P = this.A.P;
    let best = null, bs = -1e9;
    for (let i = 0; i < 60 && good.length; i++) {
      const nd = good[Math.floor(this.rnd() * good.length)];
      let dp = 1e9; for (const p of H) dp = Math.min(dp, d3(nd, p.pos)); if (dp < INV.SPAWN_MIN) continue;
      let seen = false;
      if (P && P.losClear && dp < 45) for (const p of H) { if (d3(nd, p.pos) < 45 && P.losClear({ x: p.pos.x, y: p.pos.y + 1.6, z: p.pos.z }, { x: nd.x, y: nd.y + 1.2, z: nd.z })) { seen = true; break; } }
      const s = this.rnd() * 10 - (seen ? 25 : 0) - Math.max(0, dp - 50) * 0.4; // aleatório; escondido; não longe demais da ação
      if (s > bs) { bs = s; best = nd; } if (!seen && dp <= 50 && i > 8) break;
    }
    return best ? { x: best.x, y: best.y, z: best.z } : null;
  }
  spawn(type) {
    const pos = this.spawnPos(); if (!pos) return null;
    const st = ZOMBIES[type], S = this.spec || waveSpec(1, 1);
    const z = this.A.spawnZombie(type, pos); if (!z) return null;
    const hp = type === 'boss' ? S.bossHp : st.hp * S.hpMul;
    Object.assign(z, { zt: type, zi: ZTYPES.indexOf(type), hp, maxHp: hp, alive: true, spd: st.speed * S.spdMul * (0.92 + this.rnd() * 0.16), dmgMul: S.dmgMul, size: st.size,
      nextAtk: this.T + 0.6, nextSpit: this.T + 1 + this.rnd() * st.rate, stunUntil: 0, target: null, retarget: 0, node: null, nodeAt: -9, stuck: 0, removeAt: Infinity, lastLos: false, losAt: -9 });
    z.vel.x = z.vel.y = z.vel.z = 0; z.onGround = true; z.crouch = 0;
    this.zombies.push(z); if (this.A.spawned) this.A.spawned(z); return z;
  }
  visible(p) { return p.alive && !(p.ghostUntil > this.T); }
  buildFlow() {
    this.flowAt = this.T; const nav = this.A.nav; if (!nav || !nav.nodes) return;
    const N = nav.nodes.length;
    if (!this.rev) { this.rev = nav.nodes.map(() => []); for (const n of nav.nodes) if (n.ok) for (const [j, c] of n.e) if (nav.nodes[j].ok) this.rev[j].push([n.id, c]); }
    const dist = new Float32Array(N).fill(Infinity), next = new Int32Array(N).fill(-1), heap = [];
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    for (const p of this.A.players()) { if (!this.visible(p)) continue; const nd = nav.nearest(p.pos.x, p.pos.y, p.pos.z); if (nd) { dist[nd.id] = 0; next[nd.id] = nd.id; push(nd.id, 0); } }
    let it = 0;
    while (heap.length && it++ < 60000) { const [d, i] = pop(); if (d > dist[i]) continue; for (const [j, c] of this.rev[i]) { const nd = d + c; if (nd < dist[j]) { dist[j] = nd; next[j] = i; push(j, nd); } } }
    this.flow = { dist, next };
  }
  pickTarget(z) {
    let best = null, bd = 1e9;
    for (const p of this.A.players()) { if (!this.visible(p)) continue; const d = d3(p.pos, z.pos) * (p === z.target ? 0.8 : 1); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  stepZombie(z, dt, T) {
    const st = ZOMBIES[z.zt], P = this.A.P, tune = zombieTune(this.A.botDiff);
    if (T >= z.retarget) { z.target = this.pickTarget(z); z.retarget = T + tune.retarget[0] + this.rnd() * (tune.retarget[1] - tune.retarget[0]); }
    let t = z.target; if (t && !this.visible(t)) { t = z.target = null; }
    let mx = 0, mz = 0; const stunned = z.stunUntil > T;
    if (t && !stunned) {
      const dx = t.pos.x - z.pos.x, dz = t.pos.z - z.pos.z, dh = hyp(dx, dz) || 1, dy = t.pos.y - z.pos.y;
      if (T - z.losAt > tune.losEvery) { z.losAt = T; z.lastLos = dh < tune.aggro && P.losClear({ x: z.pos.x, y: z.pos.y + 1.5 * z.size, z: z.pos.z }, { x: t.pos.x, y: t.pos.y + 1.2, z: t.pos.z }); }
      const spit = st.spit && z.lastLos && dh < st.spit.range;
      if (spit && T >= z.nextSpit && dh > 3) { z.nextSpit = T + st.spit.every * tune.spitRate * (0.85 + this.rnd() * 0.3); this.spit(z, t); }
      const keep = st.spit && st.spit.keep ? st.spit.keep * tune.keep : 0;
      let goDirect = z.lastLos && dh < 9 && Math.abs(dy) < 1.3;
      if (spit && keep && dh < keep + 2) { goDirect = true; if (dh < keep - 2) { mx = -dx / dh; mz = -dz / dh; } }
      else if (goDirect) { if (dh > st.reach * 0.6) { mx = dx / dh; mz = dz / dh; } }
      else { const s = this.flowDir(z, T); if (s) { mx = s.x; mz = s.z; } else { mx = dx / dh; mz = dz / dh; } }
      // cerco: cada zumbi puxa um pouco pro lado (par/ímpar) pra não empilhar na mesma porta. 0 no Leitão e na Ceva.
      if (tune.flank > 0 && dh > st.reach * 2) { const side = (z.id % 2 ? 1 : -1) * (z.zt === 'runner' ? 1.35 : 1); mx += (-dz / dh) * tune.flank * 0.08 * side; mz += (dx / dh) * tune.flank * 0.08 * side; }
      const yawT = Math.atan2(dx, dz); let dd = yawT - z.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); z.yaw += dd * Math.min(1, dt * tune.turn);
      if (dh < st.reach * Math.max(1, z.size * 0.85) && Math.abs(dy) < 1.7 && T >= z.nextAtk) {
        z.nextAtk = T + st.rate * tune.atkRate; this.A.emit(['za', z.id]); this.A.hurtPlayer(t, st.dmg * z.dmgMul, z);
      }
    } else if (!stunned) { // sem alvo (todo mundo fantasma ou morto): anda devagar pro centro da névoa
      const dx = this.fog.cx - z.pos.x, dz = this.fog.cz - z.pos.z, dh = hyp(dx, dz);
      if (dh > 4) { const s = this.flowDir(z, T); mx = (s ? s.x : dx / dh) * 0.4; mz = (s ? s.z : dz / dh) * 0.4; }
    }
    const ml = hyp(mx, mz), sp = z.spd * tune.spd * (stunned ? 0 : 1);
    if (ml > 0) { mx = mx / Math.max(1, ml) * sp; mz = mz / Math.max(1, ml) * sp; }
    if (mx || mz) { const yawM = Math.atan2(mx, mz); if (!t || stunned) { let dd = yawM - z.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); z.yaw += dd * Math.min(1, dt * (6 * tune.turn / 8)); } }
    const acc = z.onGround ? 9 : 2.5; z.vel.x += (mx - z.vel.x) * Math.min(1, acc * dt); z.vel.z += (mz - z.vel.z) * Math.min(1, acc * dt);
    const blocked = P.moveEntity(z, dt);
    if (blocked && ml > 0) { z.stuck += dt; if (z.onGround && z.stuck > 0.25) z.vel.y = 8.5; if (z.stuck > 6) this.unstick(z); }
    else z.stuck = Math.max(0, z.stuck - dt * 0.5);
    if (z.pos.y < -5) this.unstick(z);
  }
  unstick(z) { const p = this.spawnPos(); if (p) { z.pos.x = p.x; z.pos.y = p.y; z.pos.z = p.z; z.vel.x = z.vel.y = z.vel.z = 0; } z.stuck = 0; z.node = null; }
  flowDir(z, T) {
    const nav = this.A.nav, F = this.flow; if (!nav || !F) return null;
    if (!z.node || T - z.nodeAt > 0.45 || hyp(z.node.x - z.pos.x, z.node.z - z.pos.z) < 0.9) { z.node = nav.nearest(z.pos.x, z.pos.y, z.pos.z); z.nodeAt = T; }
    const nd = z.node; if (!nd || F.next[nd.id] < 0) return null;
    let tgt = nav.nodes[F.next[nd.id]];
    if (hyp(nd.x - z.pos.x, nd.z - z.pos.z) > 1.6 && Math.abs(nd.y - z.pos.y) < 1.2) tgt = nd; // ainda não chegou no nó
    else { const n2 = nav.nodes[F.next[tgt.id]]; if (n2 && n2 !== tgt && Math.abs(n2.y - z.pos.y) < 0.3 && Math.abs(tgt.y - z.pos.y) < 0.3) tgt = n2; } // atalho
    const vx = tgt.x - z.pos.x, vz = tgt.z - z.pos.z, L = hyp(vx, vz);
    if (L < 0.05) { z.node = tgt; return null; }
    if (L < 0.9) { z.node = tgt; z.nodeAt = T; }
    return { x: vx / L, z: vz / L };
  }
  separate() {
    const Z = this.zombies.filter((z) => z.alive);
    for (let i = 0; i < Z.length; i++) for (let j = i + 1; j < Z.length; j++) {
      const a = Z[i], b = Z[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = hyp(dx, dz), min = 0.55 * (a.size + b.size);
      if (d >= min || d < 1e-4 || Math.abs(a.pos.y - b.pos.y) > 1.5) continue;
      const push = (min - d) * 0.5, ux = dx / d, uz = dz / d, P = this.A.P;
      const tryMove = (e, sx, sz) => { const nx = e.pos.x + sx, nz = e.pos.z + sz; if (!P.collides(nx, e.pos.y, nz)) { e.pos.x = nx; e.pos.z = nz; } };
      tryMove(a, -ux * push, -uz * push); tryMove(b, ux * push, uz * push);
    }
  }
  // zumbi morreu (o host chama depois de tirar ele do jogo): drop de poder e explosão do Barrigão
  onZombieDeath(z, killer) {
    z.alive = false; z.removeAt = this.T + INV.ZOMBIE_LINGER; this.kills++;
    const st = ZOMBIES[z.zt];
    if (st.boom) {
      const c = { x: z.pos.x, y: z.pos.y + 1, z: z.pos.z }; this.A.emit(['zb', z.id, [r2(c.x), r2(c.y), r2(c.z)]]);
      for (const p of this.A.players()) {
        if (!p.alive) continue; const d = d3({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, c); if (d > st.boom.radius) continue;
        const k = 1 - d / st.boom.radius, hx = p.pos.x - c.x, hz = p.pos.z - c.z, L = hyp(hx, hz) || 1;
        this.A.knock(p, { x: hx / L * st.boom.knock * k, y: 5 * k, z: hz / L * st.boom.knock * k });
        this.A.hurtPlayer(p, st.boom.dmg * (0.3 + 0.7 * k) * (z.dmgMul || 1), z);
      }
    }
    if (z.id === this.bossId) { for (let i = 0; i < 2; i++) this.drop(z.pos, i === 0); this.dropAmmo(z.pos, 1.4); this.dropAmmo(z.pos, 1.4); return; }
    if (this.rnd() < st.drop) this.drop(z.pos, false);
    if (this.rnd() < (INV_AMMO.zdrop[z.zt] || 0)) this.dropAmmo(z.pos, 0.6);
  }
  dropAmmo(pos, off) { // caixa de munição (não ocupa slot de poder): quem precisa de munição e pisa ganha
    const a = this.rnd() * Math.PI * 2, x = clamp(pos.x + Math.cos(a) * off, -this.hx + 1, this.hx - 1), z = clamp(pos.z + Math.sin(a) * off, -this.hz + 1, this.hz - 1);
    const d = { id: this.nid++, kind: 'ammo', x, y: this.A.P.groundAt(x, z, pos.y + 0.5), z, born: this.T };
    this.drops.push(d); this.A.emit(['dp', d.id, DROP_KEYS.indexOf('ammo'), [r2(d.x), r2(d.y), r2(d.z)]]);
    return d;
  }
  drop(pos, bossBonus) {
    const H = this.A.players(), someoneOut = H.some((p) => p.out || !p.alive);
    const keys = POWER_KEYS.filter((k) => k !== 'revive' || reviveAllowed(this.resCount, this.wave));
    const w = (k) => (k === 'revive' ? POWERS.revive.w * (someoneOut ? 5 : 1) * (bossBonus ? 3 : 1) : POWERS[k].w);
    const sum = keys.reduce((a, k) => a + w(k), 0); let r = this.rnd() * sum, kind = keys[0];
    for (const k of keys) { r -= w(k); if (r <= 0) { kind = k; break; } }
    if (kind === 'revive') noteRevive(this.resCount, this.wave);
    const a = this.rnd() * Math.PI * 2, off = bossBonus || this.drops.length ? 0.9 : 0;
    const x = clamp(pos.x + Math.cos(a) * off, -this.hx + 1, this.hx - 1), z = clamp(pos.z + Math.sin(a) * off, -this.hz + 1, this.hz - 1);
    const d = { id: this.nid++, kind, x, y: this.A.P.groundAt(x, z, pos.y + 0.5), z, born: this.T };
    this.drops.push(d); this.A.emit(['dp', d.id, POWER_KEYS.indexOf(kind), [r2(d.x), r2(d.y), r2(d.z)]]);
    return d;
  }
  stepDrops(T) {
    const R2 = INV.PICK_R * INV.PICK_R;
    this.drops = this.drops.filter((d) => {
      if (T - d.born > INV.DROP_LIFE) { this.A.emit(['dg', d.id, 0]); return false; }
      for (const p of this.A.players()) {
        if (!p.alive || (d.kind !== 'ammo' && p.inv.length >= INV.INV_MAX)) continue;
        const dx = p.pos.x - d.x, dz = p.pos.z - d.z; if (dx * dx + dz * dz > R2 || Math.abs(p.pos.y - d.y) > 1.6) continue;
        if (d.kind === 'ammo') { if (!this.A.giveAmmo(p)) continue; this.A.emit(['dg', d.id, p.id, DROP_KEYS.indexOf('ammo')]); return false; }
        p.inv.push(d.kind); this.A.emit(['dg', d.id, p.id, POWER_KEYS.indexOf(d.kind)]); this.A.invChanged(p); return false;
      }
      return true;
    });
  }
  // ---------- projéteis (cuspe, abóbora do chefão, abóbora do poder) ----------
  spit(z, t) {
    const S = ZOMBIES[z.zt].spit, o = { x: z.pos.x + Math.sin(z.yaw) * 0.5 * z.size, y: z.pos.y + 1.45 * z.size, z: z.pos.z + Math.cos(z.yaw) * 0.5 * z.size };
    const tune = zombieTune(this.A.botDiff), lead = tune.spitLead, err = tune.spitErr;
    const to = { x: t.pos.x + (t.vel ? t.vel.x : 0) * lead + (this.rnd() - 0.5) * 2 * err, y: t.pos.y + 0.9, z: t.pos.z + (t.vel ? t.vel.z : 0) * lead + (this.rnd() - 0.5) * 2 * err };
    const dx = to.x - o.x, dz = to.z - o.z, dh = hyp(dx, dz), T = Math.max(0.35, dh / S.speed);
    const v = { x: dx / T, y: (to.y - o.y + 0.5 * SPIT_GRAV * T * T) / T, z: dz / T };
    const pr = { id: this.nid++, kind: S.big ? 'boss' : 'spit', owner: z, pos: o, vel: v, born: this.T, S };
    this.projs.push(pr); this.A.emit(['zs', pr.id, S.big ? 1 : 0, [r2(o.x), r2(o.y), r2(o.z)], [r2(v.x), r2(v.y), r2(v.z)]]);
  }
  stepProjs(dt, T) {
    const P = this.A.P;
    this.projs = this.projs.filter((pr) => {
      if (pr.kind === 'pumpkin') {
        for (let s = 0; s < 2; s++) P.stepNade(pr.pos, pr.vel, dt / 2);
        let hit = T - pr.born >= POWERS.pumpkin.fuse;
        if (!hit && T - pr.born > 0.15) for (const z of this.zombies) if (z.alive && d3({ x: z.pos.x, y: z.pos.y + 1 * z.size, z: z.pos.z }, pr.pos) < 1.0 * z.size + 0.3) { hit = true; break; }
        if (hit) { this.pumpkinBlast(pr); return false; }
        return true;
      }
      const n = 3; let boom = null;
      for (let i = 0; i < n && !boom; i++) {
        const h = dt / n; pr.vel.y -= SPIT_GRAV * h; pr.pos.x += pr.vel.x * h; pr.pos.y += pr.vel.y * h; pr.pos.z += pr.vel.z * h;
        if (T - pr.born > 4 || pr.pos.y <= P.groundAt(pr.pos.x, pr.pos.z, pr.pos.y + 0.3) + 0.05 || P.nadeBlocked(pr.pos.x, pr.pos.y, pr.pos.z)) boom = true;
        for (const p of this.A.players()) if (p.alive && d3({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, pr.pos) < 0.9) boom = true;
      }
      if (!boom) return true;
      const S = pr.S, c = pr.pos; this.A.emit(['zx', pr.id, [r2(c.x), r2(c.y), r2(c.z)], S.big ? 1 : 0]);
      for (const p of this.A.players()) {
        if (!p.alive) continue; const d = d3({ x: p.pos.x, y: p.pos.y + 0.9, z: p.pos.z }, c); if (d > S.radius) continue;
        this.A.hurtPlayer(p, S.dmg * (0.45 + 0.55 * (1 - d / S.radius)) * (pr.owner.dmgMul || 1), pr.owner);
      }
      return false;
    });
  }
  pumpkinBlast(pr) {
    const W = POWERS.pumpkin, c = pr.pos; this.A.emit(['pb', pr.id, [r2(c.x), r2(c.y), r2(c.z)]]);
    for (const z of this.zombies) {
      if (!z.alive) continue; const d = d3({ x: z.pos.x, y: z.pos.y + z.size, z: z.pos.z }, c) - 0.4 * z.size; if (d > W.radius) continue;
      const k = 1 - clamp(d, 0, W.radius) / W.radius, hx = z.pos.x - c.x, hz = z.pos.z - c.z, L = hyp(hx, hz) || 1;
      if (z.zt !== 'boss') this.A.knock(z, { x: hx / L * W.knock * k, y: 6 * k, z: hz / L * W.knock * k });
      this.A.hurtZombie(z, W.dmg * (0.25 + 0.75 * k), pr.owner, 'pumpkin');
    }
  }
  // ---------- poderes ----------
  // usa o poder do slot (o cliente manda olho+direção; o host já validou). Devolve o tipo usado ou null.
  usePower(p, slot, aim) {
    if (!p.alive || this.phase === 'over' || !p.inv || !p.inv.length) return null;
    slot = clamp(slot | 0, 0, p.inv.length - 1); const kind = p.inv[slot];
    const at = { x: p.pos.x, y: p.pos.y, z: p.pos.z }, A = this.A, T = this.T;
    const a = aim && aim.o && aim.d ? aim : A.aimOf(p);
    if (kind === 'revive' && !A.players().some((q) => !q.alive && q !== p)) return null; // ninguém pra reviver: guarda
    p.inv.splice(slot, 1); A.invChanged(p);
    const dir = a.d, ev = ['pw', POWER_KEYS.indexOf(kind), p.id, [r2(at.x), r2(at.y), r2(at.z)], [r2(dir.x), r2(dir.y), r2(dir.z)]];
    if (kind === 'pumpkin') {
      const W = POWERS.pumpkin, o = { x: a.o.x + dir.x * 0.6, y: a.o.y + dir.y * 0.6, z: a.o.z + dir.z * 0.6 };
      const v = { x: dir.x * W.speed, y: dir.y * W.speed + 4, z: dir.z * W.speed };
      const pr = { id: this.nid++, kind: 'pumpkin', owner: p, pos: o, vel: v, born: T }; this.projs.push(pr);
      ev.push(pr.id, [r2(o.x), r2(o.y), r2(o.z)], [r2(v.x), r2(v.y), r2(v.z)]);
    } else if (kind === 'howl') {
      const W = POWERS.howl;
      for (const z of this.zombies) {
        if (!z.alive) continue; const dx = z.pos.x - at.x, dz = z.pos.z - at.z, d = hyp(dx, dz); if (d > W.radius || Math.abs(z.pos.y - at.y) > 4) continue;
        const k = 1 - d / W.radius, L = d || 1; z.stunUntil = T + W.stun * (z.zt === 'boss' ? 0.4 : 1);
        if (z.zt !== 'boss') A.knock(z, { x: dx / L * W.knock * (0.4 + 0.6 * k), y: 5, z: dz / L * W.knock * (0.4 + 0.6 * k) });
        A.hurtZombie(z, W.dmg, p, 'howl');
      }
    } else if (kind === 'potion') {
      const W = POWERS.potion;
      for (const q of A.players()) if (q.alive && d3(q.pos, at) <= W.radius) A.heal(q, W.heal);
    } else if (kind === 'lantern') {
      this.lanterns = this.lanterns.filter((l) => l.owner !== p); this.lanterns.push({ owner: p, until: T + POWERS.lantern.dur });
    } else if (kind === 'ghost') {
      p.ghostUntil = T + POWERS.ghost.dur; for (const z of this.zombies) if (z.target === p) z.target = null;
    } else if (kind === 'revive') {
      let n = 0; for (const q of A.players()) if (!q.alive && q !== p) { q.out = false; q.lives = Math.max(1, q.lives || 0); A.revive(q, at); n++; }
      ev.push(n);
    }
    A.emit(ev); return kind;
  }
  stepLanterns(dt, T) {
    if (!this.lanterns.length) return; const W = POWERS.lantern, P = this.A.P;
    this.lanterns = this.lanterns.filter((l) => {
      const p = l.owner; if (T >= l.until || !p.alive) return false;
      const a = this.A.aimOf(p), hd = hyp(a.d.x, a.d.z) || 1, fx = a.d.x / hd, fz = a.d.z / hd;
      for (const z of this.zombies) {
        if (!z.alive) continue; const c = { x: z.pos.x, y: z.pos.y + z.size, z: z.pos.z }, dx = c.x - a.o.x, dz = c.z - a.o.z, d = hyp(dx, dz);
        if (d > W.range || d < 0.01) continue;
        if ((dx / d) * fx + (dz / d) * fz < Math.cos(W.cone)) continue;
        if (!P.losClear(a.o, c)) continue;
        this.A.hurtZombie(z, W.dps * dt * (z.zt === 'boss' ? 0.5 : 1), p, 'lantern');
      }
      return true;
    });
  }
  // ---------- jogadores ----------
  // morreu: gasta uma vida. Devolve true se ainda renasce.
  onPlayerDeath(p) {
    this.ensure(p); p.lives = Math.max(0, p.lives - 1); p.ghostUntil = 0;
    this.lanterns = this.lanterns.filter((l) => l.owner !== p);
    if (p.lives <= 0) { p.out = true; return false; }
    return true;
  }
  // onde renascer: perto de um aliado vivo e dentro da área segura
  spawnPoint(p, near = null) {
    const nav = this.A.nav, good = (nav && nav.good) || [], F = this.fog;
    const mates = this.A.players().filter((q) => q !== p && q.alive);
    const anchor = near || (mates.length ? mates[Math.floor(this.rnd() * mates.length)].pos : { x: F.cx, y: 0, z: F.cz });
    let best = null, bs = -1e9;
    for (let i = 0; i < 80 && good.length; i++) {
      const nd = good[Math.floor(this.rnd() * good.length)]; if (!this.inSafe(nd, { ...F, r: F.r * 0.85 })) continue;
      let dz = 1e9; for (const z of this.zombies) if (z.alive) dz = Math.min(dz, d3(z.pos, nd));
      const da = d3(nd, anchor), s = -Math.abs(da - 4) - (dz < 10 ? 30 : 0) + this.rnd() * 2;
      if (s > bs) { bs = s; best = nd; }
    }
    return best ? { x: best.x, y: best.y, z: best.z } : null;
  }
  // ---------- estado compacto (snapshot online) ----------
  stateArr() {
    const F = this.fog, T = this.T;
    return [PHASES.indexOf(this.phase), this.wave, r2(Math.max(0, this.phaseEnd - T)), this.liveZombies().length, this.queue.length + (this.bossPending ? 1 : 0) + this.liveZombies().length,
      r2(F.cx), r2(F.cz), r2(F.r), r2(F.tx), r2(F.tz), r2(F.tr), this.bossId, this.A.players().map((p) => [p.id, p.lives ?? INV.LIVES, p.out ? 1 : 0, p.ghostUntil > T ? 1 : 0]),
      this.lanterns.map((l) => [l.owner.id, r2(l.until - T)])];
  }
}
// lê o estado compacto (cliente online) no mesmo formato que o cliente offline monta a partir do core
export function parseState(a) {
  if (!a) return null;
  return { phase: PHASES[a[0]] || 'prep', wave: a[1], left: a[2], alive: a[3], remaining: a[4], fog: { cx: a[5], cz: a[6], r: a[7], tx: a[8], tz: a[9], tr: a[10] }, bossId: a[11],
    lives: new Map((a[12] || []).map(([id, l, o, g]) => [id, { lives: l, out: !!o, ghost: !!g }])), lanterns: new Map((a[13] || []).map(([id, t]) => [id, t])) };
}
export function coreView(core) {
  if (!core) return null; const a = core.stateArr(); const v = parseState(a); return v;
}

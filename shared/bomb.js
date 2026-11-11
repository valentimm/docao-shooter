// ============================================================
//  Modo Bomba ("Planta o Botijão") — PROTÓTIPO. Regras compartilhadas (offline + servidor). Sem DOM, sem Three.js.
//  Inspirado no Valorant, com o Docão:
//   • 2 times (0 = Vermelho, 1 = Azul). Rodadas 1–12: Vermelho ataca e Azul defende; a partir da 13ª os lados trocam ("Troca de lado!").
//   • Cada rodada: PREP s de preparação (todo mundo parado no spawn do seu lado) → ROUND s pra plantar.
//   • Um atacante carrega o Botijão. Morreu? O botijão cai no chão e qualquer atacante pega passando por cima.
//   • Plantar: o carregador segura a tecla (E) por PLANT s dentro do bomb site A ou B.
//   • Plantado: o botijão explode em FUSE s (mata quem estiver a BLAST_R m) → ponto do Ataque.
//     Defensor segura E perto dele por DEFUSE s pra desarmar (passou da metade, HALF_DEFUSE, o progresso fica salvo) → ponto da Defesa.
//   • Tempo da rodada acabou sem plantar → ponto da Defesa. Rodada NÃO acaba por eliminação: o renascimento continua normal (5 s + RENASCER).
//   • Primeiro a WIN rodadas vence. Depois de cada rodada: END s de faixa com o resultado e tudo volta pro spawn com vida cheia.
// ============================================================
export const BOMB = { WIN: 13, HALF: 12, PREP: 10, ROUND: 100, PLANT: 4, DEFUSE: 7, HALF_DEFUSE: 3.5, FUSE: 45, END: 5,
  SITE_R: 4.5, SITE_H: 3, PICK_R: 1.4, DEFUSE_R: 1.9, BLAST_R: 16, KEY: 'KeyE', KEY_LABEL: 'E', NAME: 'Botijão' };
export const W_BOMB = -3; // "arma" das mortes pela explosão do botijão (kill feed)
export const SIDE_NAMES = ['Ataque', 'Defesa'];
export const SITE_NAMES = ['A', 'B'];
export const PHASES = ['prep', 'live', 'planted', 'end', 'over'];
// time que ataca na rodada n (1-based): Vermelho até a 12ª, Azul depois
export function attackTeam(round, S) {
  if (S && typeof S.attackOf === 'function') return S.attackOf(round);
  return round <= BOMB.HALF ? 0 : 1;
}
export const sideOf = (S, team) => (team === 0 || team === 1 ? (attackTeam(S.round, S) === team ? 0 : 1) : -1); // 0 = Ataque, 1 = Defesa
export const inSite = (s, p) => !!s && Math.hypot(p.x - s.x, p.z - s.z) <= BOMB.SITE_R && p.y >= s.y - 1.2 && p.y <= s.y + BOMB.SITE_H;
export const siteAt = (sites, p) => { for (let i = 0; i < sites.length; i++) if (inSite(sites[i], p)) return i; return -1; };
const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const nearBomb = (S, p) => !!S.bomb && hd(S.bomb, p) <= BOMB.DEFUSE_R && Math.abs(p.y - S.bomb.y) < 1.6;

// ---------- layout por mapa: lados (spawns) e bomb sites A/B ----------
// Lados: os 2 spawns mais distantes viram o "lado do Ataque" e o "lado da Defesa"; cada spawn vai pro lado mais perto (projeção no eixo).
// Sites: nós andáveis do grafo com chão em volta, na metade da Defesa e longe do spawn do Ataque, o par mais afastado entre si.
// Determinístico (sem sorteio): cliente e servidor chegam no mesmo resultado. map.bombSites [[x, y, z], [x, y, z]] sobrescreve.
// map.bomb = { sites: [[x, y, z], [x, y, z]], atk: [[x, z, y?], ...], def: [[x, z, y?], ...] } (feito à mão, preferido):
//  spawns próprios do modo Bomba — o Ataque nasce longe dos sites, a Defesa perto. Os índices de atk/def apontam pra layout.pts.
//  groundAt (opcional) acerta a altura do chão de cada ponto.
export function bombLayout(nav, spawns, map = null, groundAt = null) {
  const hb = map && map.bomb;
  if (hb && Array.isArray(hb.sites) && hb.sites.length >= 2 && Array.isArray(hb.atk) && hb.atk.length && Array.isArray(hb.def) && hb.def.length) {
    const pt = ([x, z, y = 0]) => ({ x, y: groundAt ? groundAt(x, z, y + 0.3) : y, z });
    const ap = hb.atk.map(pt), dp = hb.def.map(pt), pts = [...ap, ...dp];
    const cen = (l) => ({ x: l.reduce((a, p) => a + p.x, 0) / l.length, y: 0, z: l.reduce((a, p) => a + p.z, 0) / l.length });
    const sites = hb.sites.slice(0, 2).map(([x, y, z], i) => ({ x, y: groundAt ? groundAt(x, z, y + 0.3) : y, z, name: SITE_NAMES[i] }));
    return { sites, atk: ap.map((_, i) => i), def: dp.map((_, i) => ap.length + i), pts, atkC: cen(ap), defC: cen(dp) };
  }
  const sp = spawns.map((s) => ({ x: s.x, y: s.y || 0, z: s.z }));
  let ia = 0, ib = Math.min(1, sp.length - 1), best = -1;
  for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++) { const d = hd(sp[i], sp[j]) - (sp[i].y + sp[j].y) * 2; if (d > best) { best = d; ia = i; ib = j; } }
  const A = sp[ia] || { x: -20, y: 0, z: 0 }, D = sp[ib] || { x: 20, y: 0, z: 0 };
  const ux = D.x - A.x, uz = D.z - A.z, L2 = ux * ux + uz * uz || 1, L = Math.sqrt(L2);
  const tOf = (p) => ((p.x - A.x) * ux + (p.z - A.z) * uz) / L2; // 0 = Ataque, 1 = Defesa
  const latOf = (p) => ((p.x - A.x) * -uz + (p.z - A.z) * ux) / L;
  const order = sp.map((s, i) => [tOf(s), i]).sort((a, b) => a[0] - b[0]);
  const half = Math.max(2, Math.floor(sp.length / 2));
  const atk = order.slice(0, half).map((x) => x[1]), def = order.slice(-half).map((x) => x[1]);
  let sites = null;
  if (map && Array.isArray(map.bombSites) && map.bombSites.length >= 2) sites = map.bombSites.slice(0, 2).map(([x, y, z]) => ({ x, y, z }));
  else {
    const good = (nav && nav.good) || [];
    const pick = (tMin, minAtk, needFloor) => {
      let c = good.filter((n) => { const t = tOf(n); return t >= tMin && t <= 1.08 && hd(n, A) >= minAtk; });
      const step = Math.max(1, Math.floor(c.length / 220)); c = c.filter((_, i) => i % step === 0);
      c = c.filter((n) => { let f = 0; for (const m of good) if (Math.abs(m.y - n.y) < 0.4 && hd(m, n) < BOMB.SITE_R * 0.8) f++; return f >= needFloor; });
      const [hx, hz] = (map && map.size) || [999, 999];
      const edge = (n) => Math.max(0, 7 - Math.min(hx - Math.abs(n.x), hz - Math.abs(n.z))) * 3; // longe do muro do limite
      const tq = (n) => Math.abs(tOf(n) - 0.68) * L * 0.6; // perto do lado da Defesa, mas não em cima do spawn dela
      let bs = -Infinity, pr = null;
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
        const a = c[i], b = c[j], sep = hd(a, b); if (sep < 14) continue;
        const score = Math.min(sep, L * 0.6) + Math.min(Math.abs(latOf(a) - latOf(b)), L * 0.6) * 0.5 - tq(a) - tq(b) - edge(a) - edge(b) - (a.y + b.y) * 1.5 - (hd(a, D) < 8 ? 10 : 0) - (hd(b, D) < 8 ? 10 : 0);
        if (score > bs) { bs = score; pr = [a, b]; }
      }
      return pr;
    };
    const pr = pick(0.5, 16, 6) || pick(0.35, 12, 4) || pick(0.2, 8, 2) || (good.length > 1 ? [good[0], good[good.length - 1]] : null);
    sites = pr ? pr.map((n) => ({ x: n.x, y: n.y, z: n.z })) : [{ x: D.x - 6, y: 0, z: D.z - 6 }, { x: D.x + 6, y: 0, z: D.z + 6 }];
    if (latOf(sites[0]) > latOf(sites[1])) sites.reverse(); // A sempre do mesmo lado do mapa
  }
  sites.forEach((s, i) => (s.name = SITE_NAMES[i]));
  return { sites, atk, def, atkC: A, defC: D };
}
// índices dos spawns permitidos pra esse Docão agora (lado do time na rodada atual); null = qualquer um
export function spawnPool(S, layout, team) {
  if (!S || !layout || (team !== 0 && team !== 1)) return null;
  return sideOf(S, team) === 0 ? layout.atk : layout.def;
}
// pontos de nascimento permitidos (layout.pts quando o mapa tem spawns próprios do modo Bomba; senão os spawns do mapa)
export function spawnList(S, layout, team, spawns) {
  const pool = spawnPool(S, layout, team); if (!pool) return spawns;
  const src = (layout && layout.pts) || spawns, l = pool.map((i) => src[i]).filter(Boolean); return l.length ? l : spawns;
}

// ---------- estado da partida ----------
export function newBombState() {
  return { round: 0, phase: 'prep', phaseEnd: 0, score: [0, 0], carrier: 0, bomb: null, dropped: false, planted: false, site: -1, explodeAt: 0,
    plantProg: 0, defuseProg: 0, planter: 0, defuser: 0, lastWin: -1, reason: '', over: false, target: 0 };
}
export const bombFrozen = (S) => !!S && S.phase === 'prep';
// pode usar a tecla agora? (carregador dentro do site na fase ao vivo, ou defensor perto do botijão plantado)
export function bombCanUse(S, e, sites) {
  if (!S || !e || !e.alive) return false; const side = sideOf(S, e.team);
  if (S.phase === 'live' && side === 0 && S.carrier === e.id) return siteAt(sites, e.pos) >= 0;
  if (S.phase === 'planted' && side === 1) return nearBomb(S, e.pos);
  return false;
}
// começa uma rodada: sorteia quem carrega o botijão e o site-alvo dos bots. Devolve eventos.
export function startRound(S, T, ents, rnd = Math.random) {
  S.round++; S.phase = 'prep'; S.phaseEnd = T + (S.prep > 0 ? S.prep : BOMB.PREP);
  Object.assign(S, { bomb: null, dropped: false, planted: false, site: -1, explodeAt: 0, plantProg: 0, defuseProg: 0, planter: 0, defuser: 0, reason: '' });
  const atk = attackTeam(S.round, S), c = ents.filter((e) => e.team === atk);
  const hum = c.filter((e) => e.isPlayer || e.bot === false); // prefere um humano (é mais divertido carregar)
  const pool = hum.length && rnd() < 0.6 ? hum : c;
  S.carrier = pool.length ? pool[Math.floor(rnd() * pool.length)].id : 0;
  S.target = rnd() < 0.5 ? 0 : 1;
  const ev = [['round', S.round, atk, S.carrier]];
  if (S.round > 1 && attackTeam(S.round, S) !== attackTeam(S.round - 1, S)) ev.push(['swap']);
  return ev;
}
function endRound(S, T, team, reason) {
  S.score[team]++; S.phase = 'end'; S.phaseEnd = T + BOMB.END; S.lastWin = team; S.reason = reason; S.carrier = 0; S.plantProg = 0;
  S.over = typeof S.matchOver === 'function' ? !!S.matchOver(S.score) : S.score[team] >= BOMB.WIN;
  return ['win', team, reason, S.score[0], S.score[1], S.over ? 1 : 0];
}
export function plantNow(S, T, e, site) {
  S.planted = true; S.dropped = false; S.phase = 'planted'; S.site = site; S.explodeAt = T + BOMB.FUSE; S.planter = e ? e.id : 0; S.carrier = 0; S.plantProg = 0; S.defuseProg = 0; S.defuser = 0;
  S.bomb = e ? { x: e.pos.x, y: e.pos.y, z: e.pos.z } : S.bomb;
  return ['plant', S.planter, site, +S.bomb.x.toFixed(2), +S.bomb.y.toFixed(2), +S.bomb.z.toFixed(2)];
}
// avança um passo. ents: [{ id, team, alive, pos, useHold }]. Devolve eventos:
//  ['round', n, timeAtaque, carregador] ['swap'] ['go'] ['pick', id] ['drop', id, x, y, z] ['plant', id, site, x, y, z]
//  ['defuse', id] ['boom', x, y, z, plantador] ['win', time, motivo('boom'|'defuse'|'time'), placar0, placar1, acabou] ['over']
export function stepBomb(S, ents, T, dt, sites, rnd = Math.random) {
  const ev = []; if (S.phase === 'over') return ev;
  const byId = (id) => ents.find((e) => e.id === id);
  const atk = attackTeam(S.round, S), def = 1 - atk;
  const wiped = () => {
    if (!S.elim) return null;
    const has = (team) => ents.some((e) => e.team === team);
    const up = (team) => ents.some((e) => e.alive && e.team === team);
    if (S.phase === 'live') {
      if (has(atk) && !up(atk)) return def;
      if (has(def) && !up(def)) return atk;
    } else if (S.phase === 'planted' && has(def) && !up(def)) return atk;
    return null;
  };
  if (S.phase === 'prep') {
    if (S.carrier && !byId(S.carrier)) { const c = ents.filter((e) => e.team === atk); S.carrier = c.length ? c[0].id : 0; }
    if (T >= S.phaseEnd) { S.phase = 'live'; S.phaseEnd = T + BOMB.ROUND; ev.push(['go']); }
    return ev;
  }
  if (S.phase === 'live') {
    const c = S.carrier ? byId(S.carrier) : null;
    if (S.carrier && (!c || !c.alive || c.team !== atk)) {
      const p = c ? c.pos : S.lastCarrierPos || sites[S.target];
      S.bomb = { x: p.x, y: p.y, z: p.z }; S.dropped = true; ev.push(['drop', S.carrier, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]); S.carrier = 0; S.plantProg = 0;
    } else if (c) S.lastCarrierPos = { x: c.pos.x, y: c.pos.y, z: c.pos.z };
    if (!S.carrier && S.dropped && S.bomb) {
      for (const e of ents) if (e.alive && e.team === atk && hd(e.pos, S.bomb) <= BOMB.PICK_R && Math.abs(e.pos.y - S.bomb.y) < 1.6) { S.carrier = e.id; S.dropped = false; S.bomb = null; ev.push(['pick', e.id]); break; }
    } else if (!S.carrier && !S.dropped) { // ninguém recebeu (ex.: time vazio no começo): o primeiro atacante vivo pega
      const e = ents.find((x) => x.alive && x.team === atk); if (e) { S.carrier = e.id; ev.push(['pick', e.id]); }
    }
    const cc = S.carrier ? byId(S.carrier) : null, st = cc ? siteAt(sites, cc.pos) : -1;
    if (cc && cc.alive && cc.useHold && st >= 0) { S.plantProg += dt; S.planter = cc.id; if (S.plantProg >= BOMB.PLANT) ev.push(plantNow(S, T, cc, st)); }
    else { S.plantProg = 0; S.planter = 0; }
    const wipe = S.phase === 'live' ? wiped() : null;
    if (wipe != null) ev.push(endRound(S, T, wipe, 'elim'));
    else if (S.phase === 'live' && T >= S.phaseEnd) ev.push(endRound(S, T, def, 'time'));
    return ev;
  }
  if (S.phase === 'planted') {
    let d = S.defuser ? byId(S.defuser) : null;
    const can = (e) => e && e.alive && e.team === def && e.useHold && nearBomb(S, e.pos);
    if (!can(d)) d = ents.find(can) || null;
    if (d) { S.defuser = d.id; S.defuseProg += dt; if (S.defuseProg >= BOMB.DEFUSE) { ev.push(['defuse', d.id]); ev.push(endRound(S, T, def, 'defuse')); return ev; } }
    else { S.defuser = 0; S.defuseProg = S.defuseProg >= BOMB.HALF_DEFUSE ? BOMB.HALF_DEFUSE : 0; } // passou da metade: fica salvo
    const wipe = wiped();
    if (wipe != null) ev.push(endRound(S, T, wipe, 'elim'));
    else if (T >= S.explodeAt) { const b = S.bomb; ev.push(['boom', +b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), S.planter]); ev.push(endRound(S, T, atk, 'boom')); }
    return ev;
  }
  if (S.phase === 'end' && T >= S.phaseEnd) {
    if (S.over) { S.phase = 'over'; ev.push(['over']); }
    else ev.push(...startRound(S, T, ents, rnd));
  }
  return ev;
}
// quem morre na explosão: todo mundo vivo a até BLAST_R m (não precisa de linha de visão; é um botijão!)
export function blastVictims(S, ents, at = S.bomb) {
  if (!at) return []; return ents.filter((e) => e.alive && Math.hypot(e.pos.x - at.x, e.pos.y + 1 - at.y, e.pos.z - at.z) <= BOMB.BLAST_R);
}

// ---------- rede: estado compacto no snapshot ----------
const r2 = (v) => Math.round(v * 100) / 100;
export function packBomb(S) {
  const b = S.bomb;
  return [S.round, PHASES.indexOf(S.phase), r2(S.phaseEnd), S.score[0], S.score[1], S.carrier, b ? r2(b.x) : null, b ? r2(b.y) : null, b ? r2(b.z) : null,
    S.dropped ? 1 : 0, S.planted ? 1 : 0, S.site, r2(S.explodeAt), r2(S.plantProg), r2(S.defuseProg), S.planter, S.defuser, S.lastWin, S.reason, S.over ? 1 : 0];
}
export function unpackBomb(a, S = newBombState()) {
  if (!Array.isArray(a)) return S;
  const [round, ph, phaseEnd, s0, s1, carrier, bx, by, bz, dropped, planted, site, explodeAt, plantProg, defuseProg, planter, defuser, lastWin, reason, over] = a;
  Object.assign(S, { round, phase: PHASES[ph] || 'prep', phaseEnd, score: [s0, s1], carrier, bomb: bx == null ? null : { x: bx, y: by, z: bz }, dropped: !!dropped, planted: !!planted, site,
    explodeAt, plantProg, defuseProg, planter, defuser, lastWin, reason: reason || '', over: !!over });
  return S;
}

// ---------- bots (versão simples) ----------
// Devolve o ponto pra onde o bot vai (null = segura a posição) e liga b.useHold quando é hora de plantar/desarmar.
//  Ataque: o carregador vai pro site-alvo e planta; os outros escoltam o carregador, pegam o botijão caído e guardam o plantado.
//  Defesa: cada um guarda um site (A ou B); plantou → todo mundo vai pro botijão e o primeiro que chega desarma.
export function botObjective(S, b, sites, ents, rnd = Math.random) {
  b.useHold = false;
  if (!S || (b.team !== 0 && b.team !== 1) || S.phase === 'prep' || S.phase === 'over' || S.phase === 'end') return null;
  if (b.bombRound !== S.round) { b.bombRound = S.round; b.bombSite = rnd() < 0.5 ? 0 : 1; const a = rnd() * Math.PI * 2, r = 1 + rnd() * (BOMB.SITE_R * 0.55); b.bombOff = { x: Math.cos(a) * r, z: Math.sin(a) * r }; }
  const side = sideOf(S, b.team), off = b.bombOff;
  const around = (p, k = 1) => ({ x: p.x + off.x * k, y: p.y, z: p.z + off.z * k });
  const goTo = (p, stop) => (hd(b.pos, p) < stop && Math.abs(b.pos.y - p.y) < 1.5 ? null : p);
  if (side === 0) {
    if (S.planted && S.bomb) return goTo(around(S.bomb, 1.2), 1.5);
    const tgt = sites[S.target] || sites[0];
    if (S.carrier === b.id) { if (inSite(tgt, b.pos) && hd(b.pos, tgt) < BOMB.SITE_R * 0.7) { b.useHold = true; return null; } return tgt; }
    if (S.dropped && S.bomb) return S.bomb;
    const c = ents.find((e) => e.id === S.carrier && e.alive);
    if (c && hd(c.pos, tgt) > BOMB.SITE_R) return goTo(around(c.pos, 0.6), 2.5); // escolta
    return goTo(around(tgt, 1), 1.5);
  }
  if (S.planted && S.bomb) { if (nearBomb(S, b.pos)) { b.useHold = true; return null; } return S.bomb; }
  return goTo(around(sites[b.bombSite] || sites[0], 1), 1.5);
}

// HUD do Gunfight. Não importa regras, mapa nem áudio: só pinta um estado.
// Outro agente escreve shared/gunfight.js (modo `gf`) e os spawns. O integrador
// empurra o objeto abaixo; se o formato mudar, adapta aqui, não no contrário.
//
// O integrador NÃO precisa montar o estado à mão. shared/gunfight.js (branch
// cursor/gunfight-regras, ainda não está neste branch) exporta:
//   gunfightHud(state, ents) → {
//     round, score, phase, timeLeft, classId, classKey, className,
//     nextClassId, nextClassKey, side, alive:[n0,n1], hp:[hp0,hp1],
//     contested, capTeam, capProg, capNeed, over, winner, reason
//   }
//   reason: 'elim' | 'cap' | 'hp' | 'draw'. Time -1 = empate.
//   Eventos: ['round',n] ['swap'] ['class',id] ['go'] ['ot'] ['win',team,why] ['over',team]
// adaptGunfightHud(hud, { format, ents }) traduz isso. O roster (nome, hp, vivo)
// sai das entidades — o helper só manda a contagem e a vida somada.
//
// Plugar:
//   const hud = gunfightHud(S, ents);
//   syncGunfightHud(adaptGunfightHud(hud, { format: S.format, ents }), { events });
//   ou pushGunfight(hud, events) no main (já junta as entidades da partida).
//   spectatePool + cycleSpectate + spectateCaption alimentam gfSpectate().
//   ['over', time] vira kind 'over' — o main chama endGame().
//
// GF_LIVE fica false até as regras existirem. Com a flag apagada, escolher gf
// no menu ou na sala não abre o modo: a partida cai no Mata-mata (GF_STUB_NOTICE).
// Ligue GF_LIVE quando shared/gunfight.js passar a ser a autoridade.

export const GF_MODE = 'gf';
export const GF_LIVE = false;
export const GF_TO_WIN = 6;
export const GF_FORMATS = [1, 2, 3, 4];
export const GF_DEFAULT_FORMAT = 2;
export const GF_STUB_NOTICE = 'Gunfight em breve — esta partida cai no Mata-mata até as regras chegarem.';

export const GF_WHY = { elim: 'Eliminação', cap: 'Zona', zone: 'Zona', hp: 'Vida', draw: 'Empate' };

const PHASES = ['wait', 'prep', 'live', 'ot', 'end', 'over'];
// Curtos das classes da rotação (WEAPONS.short). O helper manda className pronto;
// a tabela só cobre classKey / nextClassKey quando o nome não vem junto.
const CLASS_NAMES = {
  knife: 'Faca', bazooka: 'Bazuca', bazuca: 'Bazuca', minigun: 'Minigun', sabre: 'Sabre de Luz',
  tampa: 'Tampa do Tacho', shotgun: 'Calibre 12', canhao: 'Canhão do Barril', milho: 'Lança-Milho',
  disco: 'Disco Voador', estilingue: 'Estilingue', capataz2: '2 Capatazes', ray: 'Ray Gun', saco: 'Saco de Presentes',
  sniper: 'Sniper', fuzil: 'Fuzil', rifle: 'Fuzil', pistola: 'Pistola', pistol: 'Pistola', carabina: 'Carabina',
};

let classExtra = {};
let lastState = null;
let bannerUntil = 0;

export function normFormat(v) {
  if (typeof v === 'string') {
    const m = /^([1-4])v\1$/i.exec(v.trim());
    if (m) return Number(m[1]);
  }
  const n = Number(v);
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : GF_DEFAULT_FORMAT;
}

export function setGunfightClasses(map) {
  classExtra = { ...classExtra, ...(map || {}) };
}

export function className(id, state) {
  if (state && state.className != null && state.className !== '' && (id == null || id === -1 || sameId(id, state.classId))) return String(state.className);
  if (id == null || id === '' || id === -1) return '—';
  const raw = typeof id === 'string' ? id.trim() : id;
  const key = typeof raw === 'string' ? raw.toLowerCase() : raw;
  if (classExtra[raw] != null) return String(classExtra[raw]);
  if (classExtra[key] != null) return String(classExtra[key]);
  if (CLASS_NAMES[raw] != null) return CLASS_NAMES[raw];
  if (CLASS_NAMES[key] != null) return CLASS_NAMES[key];
  return String(raw);
}

function sameId(a, b) { return String(a ?? '') === String(b ?? ''); }

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function sideKey(side) {
  if (side === 1 || side === 'blue' || side === 'azul' || side === 'b') return 'blue';
  return 'red';
}

function teamIndex(team) {
  if (team === 1 || team === 'blue' || team === 'azul' || team === 'b') return 1;
  if (team === 0 || team === 'red' || team === 'vermelho' || team === 'r') return 0;
  return -1;
}

function teamWord(team) { return team === 1 ? 'Azul' : team === 0 ? 'Vermelho' : ''; }

function isHudShape(s) {
  return !!(s && Array.isArray(s.alive) && s.alive.length === 2 && typeof s.alive[0] === 'number'
    && (s.classKey != null || s.capNeed != null || Array.isArray(s.hp)));
}

export function rosterFromEnts(ents) {
  const red = [], blue = [];
  for (const e of ents || []) {
    if (!e || e.zt || (e.team !== 0 && e.team !== 1)) continue;
    const alive = !!(e.alive && !(typeof e.hp === 'number' && e.hp <= 0));
    const row = { id: e.id, name: e.name || '', hp: Math.max(0, num(e.hp)), alive };
    (e.team === 1 ? blue : red).push(row);
  }
  return { red, blue };
}

function countsToRoster(counts, format) {
  const fill = (n, side) => {
    const up = Math.max(0, Math.min(format, num(n)));
    const rows = [];
    for (let i = 0; i < format; i++) rows.push({ id: `${side}${i}`, name: '', hp: 0, alive: i < up });
    return rows;
  };
  return { red: fill(counts[0], 'r'), blue: fill(counts[1], 'b') };
}

// Traduz a saída de gunfightHud(state, ents). `extra.ents` (ou extra.roster) traz nome/hp/vivo.
// format aceita 2 ou '2v2'. Não importa shared/gunfight.js: o objeto basta.
export function adaptGunfightHud(hud, extra = {}) {
  const h = hud || {};
  const x = extra || {};
  const ents = x.ents || h.ents;
  const roster = x.roster || h.roster || (ents ? rosterFromEnts(ents) : null);
  const capNeed = num(h.capNeed) > 0 ? num(h.capNeed) : 3;
  const capProg = Math.max(0, num(h.capProg));
  const capTeam = h.capTeam === 0 || h.capTeam === 1 ? h.capTeam : -1;
  const contested = !!h.contested;
  const why = h.reason || (h.lastWin && h.lastWin.why) || '';
  const roundTeam = typeof h.lastWin === 'number' ? h.lastWin : (h.lastWin && typeof h.lastWin.team === 'number' ? h.lastWin.team : null);
  const nextKey = h.nextClassKey || '';
  const nextId = h.nextClassId == null || h.nextClassId === -1 || h.nextClassId === '' ? null : h.nextClassId;
  const showZone = h.phase === 'ot' || contested || capProg > 0;
  return {
    format: x.format ?? h.format,
    round: h.round,
    phase: h.phase,
    timeLeft: h.timeLeft,
    score: h.score,
    toWin: x.toWin || h.toWin,
    classId: h.classId,
    className: h.className || (h.classKey ? className(h.classKey) : undefined),
    nextClassId: nextId,
    nextClassName: h.nextClassName || (nextKey ? className(nextKey) : undefined),
    sideSwapped: h.side === 1 || !!h.sideSwapped,
    roster: roster || undefined,
    aliveCounts: Array.isArray(h.alive) ? h.alive : null,
    teamHp: h.hp || h.teamHp,
    zone: showZone ? { progress: Math.max(0, Math.min(1, capProg / capNeed)), team: contested || capTeam < 0 ? null : capTeam, contested } : (h.zone || null),
    lastWin: (roundTeam === 0 || roundTeam === 1 || roundTeam === -1 || why === 'draw')
      ? { team: why === 'draw' ? -1 : roundTeam, why }
      : (why ? { team: null, why } : null),
    winner: h.winner,
  };
}

export function normalizeGunfight(state) {
  const s = isHudShape(state) ? adaptGunfightHud(state, state) : (state || {});
  const format = normFormat(s.format);
  const phase = PHASES.includes(s.phase) ? s.phase : 'live';
  let redRows = asPeople(s.roster && s.roster.red, s.alive && !Array.isArray(s.alive) && s.alive.red);
  let blueRows = asPeople(s.roster && s.roster.blue, s.alive && !Array.isArray(s.alive) && s.alive.blue);
  if (!redRows.length && !blueRows.length && s.aliveCounts) {
    const built = countsToRoster(s.aliveCounts, format);
    redRows = built.red; blueRows = built.blue;
  }
  const roster = { red: redRows, blue: blueRows };
  const score = [num(s.score && s.score[0]), num(s.score && s.score[1])];
  const teamHp = s.teamHp && s.teamHp.length >= 2
    ? [num(s.teamHp[0]), num(s.teamHp[1])]
    : [sumHp(roster.red), sumHp(roster.blue)];
  const zone = normalizeZone(s.zone);
  const last = s.lastWin && typeof s.lastWin === 'object' ? { team: s.lastWin.team, why: s.lastWin.why || '' } : null;
  return {
    format, round: s.round == null ? 1 : Math.max(0, num(s.round)), phase,
    timeLeft: Math.max(0, num(s.timeLeft)),
    score, toWin: Math.max(1, num(s.toWin) || GF_TO_WIN),
    classId: s.classId == null ? null : s.classId,
    nextClassId: s.nextClassId == null || s.nextClassId === '' ? null : s.nextClassId,
    className: s.className, nextClassName: s.nextClassName,
    sideSwapped: !!s.sideSwapped,
    alive: {
      red: roster.red.filter((p) => p.alive).map((p) => p.id),
      blue: roster.blue.filter((p) => p.alive).map((p) => p.id),
    },
    roster, teamHp, zone, lastWin: last,
  };
}

function asPeople(list, aliveIds) {
  const rows = Array.isArray(list) ? list : [];
  const ids = Array.isArray(aliveIds) ? aliveIds : null;
  if (!rows.length && ids) return ids.map((id) => ({ id, name: '', hp: 0, alive: true }));
  return rows.map((p) => {
    const id = p && p.id != null ? p.id : p;
    const alive = ids ? ids.some((x) => sameId(x, id)) : !(p && p.alive === false);
    return { id, name: p && p.name ? String(p.name) : '', hp: num(p && p.hp), alive };
  });
}

function sumHp(list) { return list.reduce((a, p) => a + (p.alive ? Math.max(0, p.hp) : 0), 0); }

function normalizeZone(zone) {
  if (!zone || typeof zone !== 'object') return null;
  let progress = num(zone.progress);
  if (progress > 1) progress /= 100;
  progress = Math.max(0, Math.min(1, progress));
  const idx = teamIndex(zone.team);
  return { progress, team: idx < 0 ? null : idx, contested: !!zone.contested };
}

export function formatGunfightClock(state) {
  const s = state && state.phase ? state : normalizeGunfight(state);
  const t = Math.max(0, Math.ceil(s.timeLeft || 0));
  if (s.phase === 'ot') return `OVERTIME ${t}`;
  if (s.phase === 'wait') return '—';
  if (s.phase === 'end' || s.phase === 'over') return 'FIM';
  if (s.phase === 'prep') return `PREP ${t}`;
  const m = Math.floor(t / 60);
  return `${m}:${String(t % 60).padStart(2, '0')}`;
}

export function formatLabel(format) { return `${normFormat(format)}v${normFormat(format)}`; }

function whyText(why) { return GF_WHY[why] || (why ? String(why) : 'Rodada encerrada'); }

function scoreLine(s) { return `Vermelho ${s.score[0]} × ${s.score[1]} Azul`; }

export function gunfightEvents(prev, next) {
  const n = normalizeGunfight(next);
  const p = prev ? normalizeGunfight(prev) : null;
  const out = [];
  const roundChanged = !p || p.round !== n.round;
  const phaseChanged = !p || p.phase !== n.phase;
  const playing = n.phase === 'prep' || n.phase === 'live' || n.phase === 'ot';
  const swap = !!n.sideSwapped && (!p || !p.sideSwapped || roundChanged);
  if (roundChanged && playing) {
    if (swap) {
      out.push({ kind: 'swap', title: 'Troca de lado!', sub: `Nova classe: ${className(n.classId, n)}`, color: '#ffd27a', dur: 4, round: n.round });
    } else {
      out.push({ kind: 'round', title: `Round ${n.round} — Classe: ${className(n.classId, n)}`, sub: `Primeiro a ${n.toWin}`, color: '#fff6e4', dur: 3.5, round: n.round });
    }
  } else if (swap && playing) {
    out.push({ kind: 'swap', title: 'Troca de lado!', sub: `Nova classe: ${className(n.classId, n)}`, color: '#ffd27a', dur: 4, round: n.round });
  }
  if (phaseChanged && n.phase === 'end') out.push(roundEndBanner(n));
  if (phaseChanged && (n.phase === 'over' || (sOver(next) && n.phase !== 'end'))) out.push(matchEndBanner(n));
  return out;
}

function roundEndBanner(s) {
  const w = s.lastWin || {};
  const why = whyText(w.why);
  const known = w.team === 0 || w.team === 1 || w.team === -1 || w.why === 'draw';
  const team = !known ? null : (w.why === 'draw' || w.team === -1 ? -1 : teamIndex(w.team));
  const score = scoreLine(s);
  if (team == null) return { kind: 'end', title: 'Fim da rodada!', sub: `${why} · ${score}`, color: '#ffd27a', dur: 3.4, team: null, why: w.why || '' };
  if (team < 0) return { kind: 'end', title: 'Empate!', sub: `${why} · ${score}`, color: '#ffd27a', dur: 3.4, team: -1, why: w.why || 'draw' };
  const name = teamWord(team);
  return { kind: 'end', title: `${name} venceu a rodada!`, sub: `${why} · ${score}`, color: team === 1 ? '#4da6ff' : '#ff4d4d', dur: 3.4, team, why: w.why || '' };
}

function matchEndBanner(s, teamOverride) {
  const team = teamOverride === 0 || teamOverride === 1 || teamOverride === -1
    ? teamOverride
    : (s.winner === 0 || s.winner === 1 || s.winner === -1 ? s.winner : (s.score[0] === s.score[1] ? -1 : s.score[0] > s.score[1] ? 0 : 1));
  const title = team < 0 ? 'Empate!' : `Time ${teamWord(team)} venceu!`;
  return { kind: 'over', title, sub: `${scoreLine(s)} · primeiro a ${s.toWin}`, color: team < 0 ? '#ffd27a' : team === 1 ? '#4da6ff' : '#ff4d4d', dur: 4, team, score: s.score.slice() };
}

function winFromEvent(s, team, why) {
  const draw = team === -1 || why === 'draw';
  const idx = draw ? -1 : teamIndex(team);
  const score = scoreLine(s);
  const label = whyText(why);
  if (idx < 0) return { kind: 'end', title: 'Empate!', sub: `${label} · ${score}`, color: '#ffd27a', dur: 3.4, team: -1, why: why || 'draw' };
  return { kind: 'end', title: `${teamWord(idx)} venceu a rodada!`, sub: `${label} · ${score}`, color: idx === 1 ? '#4da6ff' : '#ff4d4d', dur: 3.4, team: idx, why: why || '' };
}

function classShown(id, view) {
  const named = view && view.className;
  const viewId = view ? view.classId : null;
  if (named && (id == null || id === -1 || viewId == null || viewId === -1 || sameId(id, viewId))) return String(named);
  if (id == null || id === -1) return className(viewId, view);
  return className(id);
}

// Lote do stepGunfight / startRound. Time -1 em win/over é empate. why 'cap' = zona.
export function gunfightBannersFromEvents(events, view) {
  const s = normalizeGunfight(view || {});
  const list = Array.isArray(events) ? events : [];
  let roundN = null, classId = null, swap = false, go = false, ot = false, win = null, over = null;
  for (const ev of list) {
    if (!ev) continue;
    const k = Array.isArray(ev) ? ev[0] : ev.kind;
    const a = Array.isArray(ev) ? ev : ev.args || [];
    if (k === 'round') roundN = a[1];
    else if (k === 'swap') swap = true;
    else if (k === 'class') classId = a[1];
    else if (k === 'go') go = true;
    else if (k === 'ot') ot = true;
    else if (k === 'win') win = { team: a[1], why: a[2] };
    else if (k === 'over') over = a[1];
  }
  const out = [];
  const shown = classShown(classId != null ? classId : s.classId, s);
  if (swap) out.push({ kind: 'swap', title: 'Troca de lado!', sub: `Nova classe: ${shown}`, color: '#ffd27a', dur: 4, round: roundN || s.round });
  else if (roundN != null) out.push({ kind: 'round', title: `Round ${roundN} — Classe: ${shown}`, sub: `Primeiro a ${s.toWin}`, color: '#fff6e4', dur: 3.5, round: roundN });
  if (go) out.push({ kind: 'go', title: 'VALENDO!', sub: shown === '—' ? '' : `Classe: ${shown}`, color: '#fff6e4', dur: 2.2 });
  if (ot) out.push({ kind: 'ot', title: 'OVERTIME', sub: '10 s · a zona decide', color: '#ff4d4d', dur: 2.6 });
  if (win) out.push(winFromEvent(s, win.team, win.why));
  if (over != null) out.push(matchEndBanner(s, over));
  return out;
}

export function spectatePool(state, mySide, selfId) {
  const s = normalizeGunfight(state);
  const me = sideKey(mySide);
  const foe = me === 'blue' ? 'red' : 'blue';
  const drop = (list) => list.filter((p) => p && p.alive && !sameId(p.id, selfId));
  const mine = drop(s.roster[me]);
  const theirs = drop(s.roster[foe]);
  const roundOn = s.phase === 'prep' || s.phase === 'live' || s.phase === 'ot';
  if (!roundOn) return { list: [], enemy: false, reason: 'banner' };
  if (s.format === 1 || mine.length === 0) return { list: theirs, enemy: true, reason: s.format === 1 ? 'duel' : 'wiped' };
  return { list: mine, enemy: false, reason: 'ally' };
}

export function cycleSpectate(list, currentId, dir) {
  if (!list || !list.length) return null;
  const step = dir < 0 ? -1 : 1;
  const n = list.length;
  const i = list.findIndex((p) => p && sameId(p.id, currentId));
  const j = i < 0 ? (step < 0 ? n - 1 : 0) : (i + step + n) % n;
  return list[j];
}

export function spectateCaption(name) {
  const n = name && String(name).trim() ? String(name).trim() : 'aliado';
  return `Assistindo ${n} · clique troca`;
}

function pipSlots(state, side) {
  const people = state.roster[side] || [];
  const out = [];
  for (let i = 0; i < state.format; i++) {
    const p = people[i];
    if (!p) out.push({ alive: false, empty: true, name: '' });
    else out.push({ alive: !!p.alive, empty: false, name: p.name || '' });
  }
  return out;
}

function zoneVisible(s) {
  if (s.phase === 'ot') return true;
  return !!(s.zone && (s.zone.contested || s.zone.progress > 0));
}

export function mountGunfightHud(doc = document) {
  const parent = doc.getElementById('hud') || doc.body;
  let hud = doc.getElementById('gfhud');
  if (!hud) {
    hud = doc.createElement('div');
    hud.id = 'gfhud';
    hud.className = 'hidden';
    parent.appendChild(hud);
  }
  if (!hud.dataset.built) {
    hud.setAttribute('aria-label', 'Gunfight');
    hud.innerHTML = '<div id="gfScore"><span class="gfside red"><span class="gfname">Vermelho</span> <b id="gfRed">0</b><span class="gfpips" id="gfPipsRed"></span></span><span class="gfvs">×</span><span class="gfside blue"><b id="gfBlue">0</b> <span class="gfname">Azul</span><span class="gfpips" id="gfPipsBlue"></span></span></div><div id="gfMeta"></div><div id="gfTime" class="hidden"></div><div id="gfZone" class="hidden"><div id="gfZoneFill"></div><span id="gfZoneText"></span></div><div id="gfHpRow"><div class="gfhp red" id="gfHpRed"><span class="lab">VIDA VERMELHO</span><b>0</b><span class="bar"><i></i></span><em></em></div><div class="gfhp blue" id="gfHpBlue"><span class="lab">VIDA AZUL</span><b>0</b><span class="bar"><i></i></span><em></em></div></div><div id="gfClass"><span id="gfClassNow"></span><span id="gfNext"></span></div>';
    hud.dataset.built = '1';
  }
  let watch = doc.getElementById('gfWatch');
  if (!watch) {
    watch = doc.createElement('div');
    watch.id = 'gfWatch';
    watch.className = 'hidden';
    parent.appendChild(watch);
  }
  let banner = doc.getElementById('bombBanner');
  if (!banner) {
    banner = doc.createElement('div');
    banner.id = 'bombBanner';
    banner.className = 'hidden';
    banner.innerHTML = '<div class="b1"></div><div class="b2"></div>';
    parent.appendChild(banner);
  }
  return { hud, watch, banner };
}

function paintPips(el, slots) {
  const sig = slots.map((p) => (p.empty ? 'e' : p.alive ? 'a' : 'd') + p.name).join('|');
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  el.replaceChildren();
  for (const p of slots) {
    const i = el.ownerDocument.createElement('i');
    i.className = 'gfpip' + (p.empty ? ' empty' : p.alive ? ' on' : ' off');
    i.title = p.empty ? 'vazio' : `${p.name || 'Docão'} · ${p.alive ? 'vivo' : 'morto'}`;
    el.appendChild(i);
  }
}

function paintHp(card, hp, other) {
  const lead = hp > other;
  const tie = hp === other;
  card.classList.toggle('lead', lead);
  card.classList.toggle('tie', tie);
  const b = card.querySelector('b');
  const em = card.querySelector('em');
  const fill = card.querySelector('i');
  if (b) b.textContent = String(Math.max(0, Math.round(hp)));
  if (em) em.textContent = lead ? 'NA FRENTE' : tie ? 'EMPATE' : '';
  const cap = Math.max(hp, other, 1);
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, (hp / cap) * 100)).toFixed(1)}%`;
}

export function renderGunfightHud(state, opts = {}) {
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  const s = normalizeGunfight(state);
  const { hud } = mountGunfightHud(doc);
  hud.classList.remove('hidden');
  hud.dataset.phase = s.phase;
  hud.dataset.format = String(s.format);
  const red = hud.querySelector('#gfRed');
  const blue = hud.querySelector('#gfBlue');
  if (red) red.textContent = String(s.score[0]);
  if (blue) blue.textContent = String(s.score[1]);
  paintPips(hud.querySelector('#gfPipsRed'), pipSlots(s, 'red'));
  paintPips(hud.querySelector('#gfPipsBlue'), pipSlots(s, 'blue'));
  const meta = hud.querySelector('#gfMeta');
  if (meta) meta.textContent = `Round ${s.round} · ${formatLabel(s.format)} · primeiro a ${s.toWin}${s.sideSwapped ? ' · lados trocados' : ''}`;
  const clock = formatGunfightClock(s);
  const timer = opts.timerEl || doc.getElementById('timer');
  const own = hud.querySelector('#gfTime');
  if (timer) {
    timer.textContent = clock;
    timer.classList.toggle('gf-ot', s.phase === 'ot');
    timer.classList.toggle('gf-prep', s.phase === 'prep');
    if (own) own.classList.add('hidden');
  } else if (own) {
    own.textContent = clock;
    own.classList.remove('hidden');
    own.classList.toggle('ot', s.phase === 'ot');
    own.classList.toggle('prep', s.phase === 'prep');
  }
  const leader = opts.leaderEl || doc.getElementById('leader');
  if (leader && opts.leader !== false) {
    const line = `Gunfight · ${formatLabel(s.format)} · primeiro a ${s.toWin}`;
    if (leader.dataset.h !== line) { leader.dataset.h = line; leader.textContent = line; }
  }
  const zone = hud.querySelector('#gfZone');
  const showZone = zoneVisible(s);
  if (zone) {
    zone.classList.toggle('hidden', !showZone);
    zone.classList.toggle('contested', !!(s.zone && s.zone.contested));
    zone.classList.toggle('ot', s.phase === 'ot');
    const fill = zone.querySelector('#gfZoneFill');
    const text = zone.querySelector('#gfZoneText');
    const pct = s.zone ? Math.round(s.zone.progress * 100) : 0;
    const who = s.zone && s.zone.team != null ? teamWord(s.zone.team) : '';
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.dataset.team = s.zone && s.zone.team == null ? '' : String(s.zone ? s.zone.team : '');
    }
    if (text) {
      if (s.zone && s.zone.contested) text.textContent = s.phase === 'ot' ? 'OVERTIME · CONTESTADA' : 'CONTESTADA';
      else if (!who) text.textContent = s.phase === 'ot' ? 'OVERTIME · zona neutra' : 'Zona neutra';
      else text.textContent = `${s.phase === 'ot' ? 'OVERTIME · ' : ''}${who} ${pct}%`;
    }
  }
  paintHp(hud.querySelector('#gfHpRed'), s.teamHp[0], s.teamHp[1]);
  paintHp(hud.querySelector('#gfHpBlue'), s.teamHp[1], s.teamHp[0]);
  const now = hud.querySelector('#gfClassNow');
  const next = hud.querySelector('#gfNext');
  if (now) now.textContent = `Classe: ${className(s.classId, s)}`;
  const nextId = s.nextClassId;
  const showNext = nextId != null && !sameId(nextId, s.classId);
  if (next) {
    next.classList.toggle('hidden', !showNext);
    next.textContent = showNext ? `próxima: ${className(nextId, { classId: nextId, className: s.nextClassName })}` : '';
  }
  return s;
}

export function showGunfightBanner(ev, doc = document) {
  if (!doc || !ev) return;
  mountGunfightHud(doc);
  const b = doc.getElementById('bombBanner');
  if (!b) return;
  const t1 = b.querySelector('.b1');
  const t2 = b.querySelector('.b2');
  if (t1) { t1.textContent = ev.title || ''; t1.style.color = ev.color || '#fff'; }
  if (t2) t2.textContent = ev.sub || '';
  b.dataset.gf = '1';
  b.classList.remove('hidden');
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  bannerUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + (Number(ev.dur) || 3) * 1000;
  const log = (globalThis.__gfBanners ||= []);
  log.push(ev.title || '');
  if (log.length > 30) log.shift();
}

export function tickGunfightBanner(now, doc = typeof document !== 'undefined' ? document : null) {
  if (!bannerUntil) return;
  const t = now == null ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) : now;
  if (t < bannerUntil || !doc) return;
  bannerUntil = 0;
  const b = doc.getElementById('bombBanner');
  if (b && b.dataset.gf === '1') b.classList.add('hidden');
}

export function hideGunfightHud(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  const hud = doc.getElementById('gfhud');
  if (hud) hud.classList.add('hidden');
  const w = doc.getElementById('gfWatch');
  if (w) w.classList.add('hidden');
}

export function resetGunfightHud(doc = typeof document !== 'undefined' ? document : null) {
  lastState = null;
  bannerUntil = 0;
  if (!doc) return;
  hideGunfightHud(doc);
  const timer = doc.getElementById('timer');
  if (timer) timer.classList.remove('gf-ot', 'gf-prep');
  const b = doc.getElementById('bombBanner');
  if (b && b.dataset.gf === '1') { b.classList.add('hidden'); delete b.dataset.gf; }
}

function sOver(state) { return !!(state && state.over); }

export function syncGunfightHud(state, opts = {}) {
  const view = isHudShape(state) ? adaptGunfightHud(state, state) : state;
  const prev = lastState;
  const events = opts.events ? gunfightBannersFromEvents(opts.events, view) : gunfightEvents(prev, view);
  lastState = normalizeGunfight(view);
  renderGunfightHud(lastState, opts);
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  for (const ev of events) if (doc) showGunfightBanner(ev, doc);
  return events;
}

export function setGunfightWatch(name, doc = document) {
  if (!doc) return;
  mountGunfightHud(doc);
  const w = doc.getElementById('gfWatch');
  if (!w) return;
  if (!name) { w.classList.add('hidden'); w.textContent = ''; return; }
  w.textContent = spectateCaption(name);
  w.classList.remove('hidden');
}

const pig = (id, name, hp, alive) => ({ id, name, hp, alive });

function hudView(partial) {
  return {
    classId: -1, classKey: '', className: '', nextClassId: null, nextClassKey: '',
    side: 0, contested: false, capTeam: -1, capProg: 0, capNeed: 3,
    over: false, winner: -1, reason: '', ...partial,
  };
}

export const GF_PREVIEWS = {
  live: hudView({
    format: '2v2', round: 3, phase: 'live', timeLeft: 74, score: [2, 1],
    classKey: 'bazooka', className: 'Bazuca', nextClassId: 1, nextClassKey: 'shotgun',
    alive: [2, 1], hp: [180, 95],
    roster: { red: [pig(1, 'Docão', 90, true), pig(2, 'Bacon', 90, true)], blue: [pig(3, 'Torresmo', 95, true), pig(4, 'Linguiça', 0, false)] },
  }),
  ot: hudView({
    format: '4v4', round: 6, phase: 'ot', timeLeft: 10, score: [5, 5],
    classKey: 'minigun', className: 'Minigun', nextClassId: null, nextClassKey: '',
    alive: [3, 4], hp: [240, 310], contested: true, capTeam: 0, capProg: 1.86,
    roster: {
      red: [pig(1, 'Docão', 40, true), pig(2, 'Bacon', 80, true), pig(3, 'Pernil', 70, true), pig(4, 'Costela', 0, false)],
      blue: [pig(5, 'Azulão', 90, true), pig(6, 'Nuvem', 80, true), pig(7, 'Anil', 70, true), pig(8, 'Jeans', 70, true)],
    },
  }),
  spec: hudView({
    format: '2v2', round: 2, phase: 'live', timeLeft: 48, score: [1, 1],
    classKey: 'knife', className: 'Faca', nextClassId: 3, nextClassKey: 'bazooka',
    alive: [1, 2], hp: [64, 150],
    roster: { red: [pig(1, 'Docão', 0, false), pig(2, 'Bacon', 64, true)], blue: [pig(3, 'Torresmo', 80, true), pig(4, 'Linguiça', 70, true)] },
    watch: 'Bacon',
  }),
  swap: hudView({
    format: '2v2', round: 4, phase: 'prep', timeLeft: 8, score: [2, 2], side: 1,
    classKey: 'sabre', className: 'Sabre de Luz', nextClassId: 1, nextClassKey: 'shotgun',
    alive: [2, 2], hp: [200, 200],
    roster: { red: [pig(1, 'Docão', 100, true), pig(2, 'Bacon', 100, true)], blue: [pig(3, 'Torresmo', 100, true), pig(4, 'Linguiça', 100, true)] },
    events: [['round', 4], ['swap'], ['class', 8]],
  }),
  duel: hudView({
    format: '1v1', round: 5, phase: 'live', timeLeft: 36, score: [4, 2],
    classKey: 'bazooka', className: 'Bazuca', nextClassId: null, nextClassKey: '',
    alive: [1, 1], hp: [90, 20],
    roster: { red: [pig(1, 'Docão', 90, true)], blue: [pig(2, 'Torresmo', 20, true)] },
  }),
};

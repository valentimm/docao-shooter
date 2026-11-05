// ============================================================
//  DESAFIOS DIÁRIOS: banco de 60, 3 por dia (1 fácil + 1 médio + 1 difícil), iguais o dia todo pra mesma conta.
//  O dia vira à 0h de Brasília (America/Sao_Paulo). O sorteio é hash(conta, dia): nada sorteado é gravado.
//  Quem conta o progresso é o SERVIDOR (sala online, só conta logada; Treino e offline nunca contam).
//  Estado na conta (accounts.chal, JSON curto): { d: dia, p: [progresso dos 3], k: bits dos já pagos }.
//  Desafio NÃO tem teto de ganho (o limite é ser só 3 por dia); o teto de 80/partida e 400/dia é só das partidas.
// ============================================================

// ev = contador que a sala manda (ver server/src/game.js); mo = só vale nesse modo; ty: 'sum' soma no dia, 'max' melhor partida, 'bits' modos diferentes
const L = [
  // ---- qualquer modo online
  ['D01', 'Jogue 2 partidas online até o fim', null, 'm', 2, 20, 'F'],
  ['D02', 'Faça 10 abates (somando o dia)', null, 'k', 10, 20, 'F'],
  ['D03', 'Faça 5 abates com tiro na cabeça ("direto no focinho!")', null, 'hs', 5, 25, 'F'],
  ['D04', 'Mate 3 inimigos com o Copo Bomba', null, 'nade', 3, 30, 'F'],
  ['D05', 'Faça 3 abates seguidos sem morrer, 3 vezes', null, 'seq3', 3, 40, 'M'],
  ['D06', 'Chame um Míssil da granja (5 abates seguidos)', null, 'ks_p', 1, 45, 'M'],
  ['D07', 'Chame um Gavião da granja (7 abates seguidos)', null, 'ks_h', 1, 55, 'M'],
  ['D08', 'Chame um Chopper da granja (10 abates seguidos)', null, 'ks_g', 1, 90, 'D'],
  ['D09', 'Chame a Grelha da granja (13 abates seguidos)', null, 'ks_a', 1, 110, 'D'],
  ['D10', 'Faça 15 abates seguidos e chame o Fim da chapa', null, 'ks_x', 1, 120, 'D'],
  ['D11', 'Mate 2 inimigos com um tiro só (collateral)', null, 'col', 1, 70, 'D'],
  // ---- armas
  ['D12', 'Mate 3 inimigos com a Calibre 12 ou a Semi', null, 'w_shot', 3, 25, 'F'],
  ['D13', 'Mate 5 inimigos com Sniper, Canhão ou Carabina', null, 'w_snip', 5, 40, 'M'],
  ['D14', 'Mate 3 inimigos através da parede', null, 'wall', 3, 45, 'M'],
  ['D15', 'Moggue 2 inimigos (faca pelas costas)', null, 'back', 2, 50, 'M'],
  ['D16', 'Mate 3 inimigos com a Besta, o Arco ou o Estilingue de Ovo', null, 'w_bow', 3, 45, 'M'],
  ['D17', 'Mate 3 inimigos com o Sabre de Luz ou o Sabre Duplo', null, 'w_saber', 3, 40, 'M'],
  ['D18', 'Mate 4 inimigos com a Bazuca ou o Lança-Milho', null, 'w_boom', 4, 40, 'M'],
  ['D19', 'Acerte o pau de choque em 3 inimigos', null, 'shock', 3, 40, 'M'],
  // ---- Mata-mata
  ['D20', 'Termine uma partida de Mata-mata', 'dm', 'm', 1, 20, 'F'],
  ['D21', 'Faça 15 abates numa só partida de Mata-mata', 'dm', 'mk', 15, 45, 'M', 'max'],
  ['D22', 'Vença uma partida de Mata-mata', 'dm', 'win', 1, 55, 'M'],
  ['D23', 'Vença o Mata-mata morrendo no máximo 5 vezes', 'dm', 'win5', 1, 100, 'D', 'max'],
  // ---- Dominação
  ['D24', 'Capture 2 zonas na Dominação', 'dom', 'cap', 2, 25, 'F'],
  ['D25', 'Faça 10 abates na Dominação', 'dom', 'k', 10, 25, 'F'],
  ['D26', 'Capture 5 zonas na Dominação (somando o dia)', 'dom', 'cap', 5, 50, 'M'],
  ['D27', 'Vença uma partida de Dominação', 'dom', 'win', 1, 55, 'M'],
  ['D28', 'Vença a Dominação com 3 capturas suas', 'dom', 'win3c', 1, 90, 'D', 'max'],
  // ---- substitutos dos antigos de Treino/Exploração (só modos online)
  ['D29', 'Faça 5 abates no Mata-mata', 'dm', 'k', 5, 20, 'F'],
  ['D30', 'Jogue uma partida de Dominação até o fim', 'dom', 'm', 1, 20, 'F'],
  ['D31', 'Desarme o botijão 1 vez', 'bomb', 'defuse', 1, 25, 'F'],
  ['D32', 'Faça 25 abates (somando o dia)', null, 'k', 25, 45, 'M'],
  ['D33', 'Mate 2 inimigos com a faca', null, 'knife', 2, 25, 'F'],
  ['D34', 'Derrube 10 zumbis com tiro na cabeça', 'inv', 'zhs', 10, 25, 'F'],
  // ---- Bomba
  ['D35', 'Plante o botijão', 'bomb', 'plant', 1, 25, 'F'],
  ['D36', 'Faça 10 abates na Bomba', 'bomb', 'k', 10, 25, 'F'],
  ['D37', 'Vença 3 rodadas de Bomba', 'bomb', 'rw', 3, 30, 'F'],
  ['D38', 'Plante o botijão 5 vezes', 'bomb', 'plant', 5, 60, 'M'],
  ['D39', 'Desarme o botijão 3 vezes', 'bomb', 'defuse', 3, 60, 'M'],
  ['D40', 'Vença 6 rodadas de Bomba (somando o dia)', 'bomb', 'rw', 6, 50, 'M'],
  ['D41', 'Vença uma partida de Bomba (13 rodadas)', 'bomb', 'win', 1, 90, 'D'],
  ['D42', 'Plante o botijão 3 vezes e desarme 2 na mesma partida', 'bomb', 'pd32', 1, 100, 'D', 'max'],
  // ---- Invasão
  ['D43', 'Chegue à wave 5 na Invasão', 'inv', 'wave', 5, 25, 'F', 'max'],
  ['D44', 'Mate 50 zumbis na Invasão (somando o dia)', 'inv', 'zk', 50, 25, 'F'],
  ['D45', 'Pegue 3 poderes na Invasão', 'inv', 'pw', 3, 20, 'F'],
  ['D46', 'Mate 5 Cuspidores', 'inv', 'spit', 5, 25, 'F'],
  ['D47', 'Chegue à wave 10 na Invasão', 'inv', 'wave', 10, 50, 'M', 'max'],
  ['D48', 'Mate 150 zumbis na Invasão (somando o dia)', 'inv', 'zk', 150, 55, 'M'],
  ['D49', 'Derrube o Docão Abóbora (chefão)', 'inv', 'boss', 1, 60, 'M'],
  ['D50', 'Reviva um aliado com a Ressurreição', 'inv', 'rev', 1, 50, 'M'],
  ['D51', 'Mate 3 Barrigões de Gás', 'inv', 'tank', 3, 45, 'M'],
  ['D52', 'Chegue à wave 15 na Invasão', 'inv', 'wave', 15, 90, 'D', 'max'],
  ['D53', 'Sobreviva à wave 20 e vença a Invasão', 'inv', 'win', 1, 120, 'D'],
  ['D54', 'Vença a Invasão sem perder nenhuma vida', 'inv', 'win0', 1, 120, 'D', 'max'],
  // ---- voz / emotes / social
  ['D55', 'Dance 3 vezes numa partida online (tecla B)', null, 'dance', 3, 20, 'F'],
  ['D56', 'Dance 10 vezes numa partida online (tecla B)', null, 'dance', 10, 35, 'M'],
  ['D57', 'Ligue a voz (Todos ou Time) e jogue uma partida até o fim', null, 'voice', 1, 20, 'F'],
  ['D58', 'Jogue uma partida até o fim com pelo menos 3 jogadores de verdade', null, 'm3h', 1, 25, 'F'],
  ['D59', 'Mande 5 mensagens no chat da sala', null, 'chat', 5, 20, 'F'],
  ['D60', 'Jogue até o fim partidas de 3 modos diferentes no mesmo dia', null, 'modes', 3, 70, 'D', 'bits'],
];
export const MODE_NAMES = { dm: 'Mata-mata', dom: 'Dominação', bomb: 'Bomba', inv: 'Invasão' };
export const TIERS = { F: 'Fácil', M: 'Médio', D: 'Difícil' };
export const CHALLENGES = L.map(([id, text, mo, ev, goal, reward, tier, ty]) => ({ id, text, mo, ev, goal, reward, tier, ty: ty || 'sum' }));
export const CHAL_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
const POOL = { F: CHALLENGES.filter((c) => c.tier === 'F'), M: CHALLENGES.filter((c) => c.tier === 'M'), D: CHALLENGES.filter((c) => c.tier === 'D') };
export const CHAL_MODES = ['dm', 'dom', 'bomb', 'inv']; // bit do modo pro D60
export const CHAL_PER_DAY = 3;

// ---------- dia de Brasília ----------
const SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function spParts(ms) { const o = {}; for (const p of SP.formatToParts(new Date(ms))) o[p.type] = +p.value || 0; return o; }
export function spDay(ms = Date.now()) { const p = spParts(ms); return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86400000); } // nº do dia (como se fosse UTC) da data de Brasília
export function secsToReset(ms = Date.now()) { const p = spParts(ms); return Math.max(1, 86400 - (p.hour * 3600 + p.minute * 60 + p.second)); }

// ---------- sorteio determinístico ----------
function hash32(a, b, salt) { // mistura simples (murmur3 fmix) de conta + dia + nível
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16; return h >>> 0;
}
export function dailyIds(acct, day) { return ['F', 'M', 'D'].map((t, i) => POOL[t][hash32(acct, day, i + 1) % POOL[t].length].id); }

// ---------- estado guardado ----------
export function parseChal(raw, day) {
  let o = null; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { o = null; }
  if (!o || o.d !== day || !Array.isArray(o.p) || o.p.length !== CHAL_PER_DAY) return { d: day, p: [0, 0, 0], k: 0 }; // dia novo (ou lixo): começa do zero
  return { d: day, p: o.p.map((x) => Math.max(0, Math.min(1e6, x | 0))), k: (o.k | 0) & 7 };
}
const pop = (x) => { let n = 0; while (x) { n += x & 1; x >>>= 1; } return n; };
const progOf = (c, v) => (c.ty === 'bits' ? pop(v) : v);
// aplica os contadores de uma gravação da sala (q = { ev: n }, mode = modo da sala). Devolve o estado novo e quanto pagar agora.
export function applyChal(state, acct, q, mode) {
  const ids = dailyIds(acct, state.d), s = { d: state.d, p: state.p.slice(), k: state.k }; let reward = 0, boxes = 0, changed = false;
  ids.forEach((id, i) => {
    const c = CHAL_BY_ID[id], v = q && q[c.ev] | 0; if (!v || (c.mo && c.mo !== mode) || (s.k & (1 << i))) return;
    const before = s.p[i];
    if (c.ty === 'max') s.p[i] = Math.max(before, v); else if (c.ty === 'bits') s.p[i] = before | v; else s.p[i] = before + v;
    if (c.ty !== 'bits') s.p[i] = Math.min(s.p[i], c.goal);
    if (s.p[i] !== before) changed = true;
    if (progOf(c, s.p[i]) >= c.goal) { s.k |= 1 << i; reward += c.reward; boxes += 1; changed = true; }
  });
  return { state: s, reward, boxes, changed };
}
// o que a tela mostra
export function chalView(acct, raw, ms = Date.now()) {
  const day = spDay(ms), s = parseChal(raw, day);
  return { day, resetIn: secsToReset(ms), list: dailyIds(acct, day).map((id, i) => { const c = CHAL_BY_ID[id]; return { id, text: c.text, mode: c.mo ? MODE_NAMES[c.mo] : 'Qualquer modo online', tier: c.tier, goal: c.goal, reward: c.reward, prog: Math.min(c.goal, progOf(c, s.p[i])), done: !!(s.k & (1 << i)) }; }) };
}

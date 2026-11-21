// Prêmios do pódio: os 3 primeiros, cada um com uma curiosidade em que foi o melhor da partida.
import { FREE_DANCES } from './emote.js';

export function emptyFun() {
  return { hs: 0, knife: 0, streak: 0, best: 0, dmg: 0, far: 0 };
}
export function notePodiumKill(fun, { head = false, knife = false, dist = 0 } = {}) {
  if (!fun) return;
  fun.streak = (fun.streak | 0) + 1;
  if (fun.streak > (fun.best | 0)) fun.best = fun.streak;
  if (head) fun.hs = (fun.hs | 0) + 1;
  if (knife) fun.knife = (fun.knife | 0) + 1;
  if (dist > (fun.far || 0)) fun.far = dist;
}
export function notePodiumHurt(fun, amount) {
  if (!fun || !(amount > 0)) return;
  fun.dmg = (fun.dmg || 0) + amount;
}
export function notePodiumDeath(fun) {
  if (fun) fun.streak = 0;
}

export function defaultDance(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return FREE_DANCES[h % FREE_DANCES.length];
}

const CATS = [
  { id: 'kills', emoji: '🏆', title: 'Rei da chapa', min: 1, value: (r) => r.kills | 0, line: (n) => `Mais abates da partida: ${n}.` },
  { id: 'streak', emoji: '🔥', title: 'Sem esfriar', min: 3, value: (r) => r.fun.best | 0, line: (n) => `Maior sequência sem morrer: ${n} abates seguidos.` },
  { id: 'hs', emoji: '🐽', title: 'No focinho', min: 1, value: (r) => r.fun.hs | 0, line: (n) => `Mais tiro no focinho: ${n}.` },
  { id: 'far', emoji: '🎯', title: 'De longe', min: 12, value: (r) => r.fun.far || 0, line: (n) => `Abate mais longe: ${Math.round(n)} m.` },
  { id: 'knife', emoji: '🔪', title: 'Mão na faca', min: 1, value: (r) => r.fun.knife | 0, line: (n) => `Mais moggada de faca: ${n}.` },
  { id: 'caps', emoji: '🚩', title: 'Dono do ponto', min: 1, value: (r) => r.caps | 0, line: (n) => `Mais objetivo da partida: ${n}.` },
  { id: 'dmg', emoji: '💥', title: 'Mais brasa', min: 1, value: (r) => Math.round(r.fun.dmg || 0), line: (n) => `Mais dano causado: ${n}.` },
  { id: 'firm', emoji: '🛡️', title: 'Couro duro', min: 0, low: true, value: (r) => r.deaths | 0, line: (n) => (n === 0 ? 'Terminou sem morrer.' : `Menos mortes da partida: ${n}.`) },
];

function leads(cat, row, all) {
  const v = cat.value(row);
  if (!(v >= cat.min)) return false;
  if (cat.low) {
    if (!all.some((o) => o !== row && cat.value(o) > v)) return false;
    return all.every((o) => o === row || cat.value(o) >= v);
  }
  return all.every((o) => o === row || cat.value(o) <= v);
}

function fallbackPrize(row) {
  const k = row.kills | 0, d = row.deaths | 0;
  return { emoji: '🏅', title: 'Menção da casa', line: k || d ? `${k} abates e ${d} ${d === 1 ? 'morte' : 'mortes'} nesta partida.` : 'Entrou na chapa e ficou no pódio.' };
}

// rows já ordenadas: melhor primeiro. Devolve até 3, cada um com um prêmio que ele liderou.
export function awardPodium(rows) {
  const all = (rows || []).map((r) => ({ ...r, fun: { ...emptyFun(), ...(r.fun || {}) } }));
  const top = all.slice(0, 3);
  const used = new Set();
  return top.map((row, i) => {
    const cat = CATS.find((c) => !used.has(c.id) && leads(c, row, all));
    if (cat) used.add(cat.id);
    const prize = cat ? { emoji: cat.emoji, title: cat.title, line: cat.line(cat.value(row), row) } : fallbackPrize(row);
    return {
      place: i + 1,
      id: row.id,
      name: row.name || '???',
      skin: row.skin || '',
      dance: row.dance || defaultDance(row.name),
      kills: row.kills | 0,
      deaths: row.deaths | 0,
      ...prize,
    };
  });
}

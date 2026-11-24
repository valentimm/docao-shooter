// Ultimates do Modo história. Um por jogador, sorteado ao entrar na wave 21.
// Recarga longa. O CEO é o único curto, para atravessar bloco mais vezes.
export const ULTS = {
  frenesi: { id: 'frenesi', name: 'Frenesi do Energético Monster', icon: '⚡', cd: 46, dur: 12, anim: 0.9, desc: 'Vira um monstro. Cada hit que você toma vira 5 de dano e o braço bate em área.' },
  sinuca: { id: 'sinuca', name: 'Sinuca Feroz', icon: '🎱', cd: 34, dur: 0, anim: 0.45, desc: 'Uma tacada atravessa o mapa e acerta todo zumbi no caminho.' },
  vendedor: { id: 'vendedor', name: 'Vendedor do Clube Cheers', icon: '🍻', cd: 52, dur: 11, anim: 0.8, desc: 'Puxa os zumbis. Quem encosta em você passa a brigar com os outros. Você fica imune.' },
  rei: { id: 'rei', name: 'Rei dos Docões', icon: '👑', cd: 50, dur: 14, anim: 1.0, desc: 'Um zumbi amigo te segue e volta 10 s depois de cair. No ultimate ele vira um chefão reduzido.' },
  vampiro: { id: 'vampiro', name: 'Docão Vampirão', icon: '🦇', cd: 40, dur: 9, anim: 0.7, desc: 'Voa e suga a vida dos zumbis perto.' },
  bebado: { id: 'bebado', name: 'Rei da Bebedeira', icon: '🥃', cd: 44, dur: 6.5, anim: 0.6, desc: 'Você perde o controle, gira sem tomar dano e bate em todo zumbi da roda.' },
  discipulo: { id: 'discipulo', name: 'Discípulo do Barriguinha', icon: '🚽', cd: 38, dur: 8, anim: 0.7, desc: 'Uma poça grande deixa os zumbis perto lentos e tomando dano.' },
  ceo: { id: 'ceo', name: 'CEO da HOTMILK', icon: '🚪', cd: 14, dur: 2.4, anim: 0.35, desc: 'Atravessa o bloco. Dura pouco e volta mais rápido que os outros ultimates.' },
};
export const ULT_IDS = Object.keys(ULTS);

export function rollUltimate(taken, rnd = Math.random) {
  const used = taken || new Set();
  const pool = ULT_IDS.filter((id) => !used.has(id));
  const bag = pool.length ? pool : ULT_IDS;
  return bag[Math.floor(rnd() * bag.length) % bag.length];
}

export function frenzyTaken(amount, p, now) {
  if (!p || p.ultForm !== 'frenesi' || !(p.ultUntil > now) || !(amount > 5)) return amount;
  return 5;
}

export function storyFogOpen(wave, story) {
  return !!(story && wave >= 21);
}

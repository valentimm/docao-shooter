// Upgrades do Modo história. Caem na morte de cada chefão: cada jogador escolhe 1 de 3
// e fica com ele até o fim da partida. Ativo: um botão, com recarga conforme a força.
export const HUPS = {
  grok: { id: 'grok', name: 'Help do Grok', icon: '💻', cd: 45, anim: 1.05, desc: 'Abre o mapa e te teletransporta para o ponto escolhido.' },
  monster: { id: 'monster', name: 'Gole do Energético Monster', icon: '⚡', cd: 28, dur: 10, anim: 0.9, desc: '+50% de velocidade por 10 segundos.' },
  torta: { id: 'torta', name: 'Torta Basca', icon: '🍰', cd: 32, dur: 10, anim: 1.05, desc: 'Cura 50 e ganha um escudo de 50 por 10 segundos.' },
  tosse: { id: 'tosse', name: 'Tosse da Morte', icon: '💨', cd: 18, anim: 0.85, desc: 'Joga uma bola de tosse que explode em área.' },
  barriga: { id: 'barriga', name: 'Pose do Barriguinha', icon: '👖', cd: 22, anim: 1.15, desc: 'Congela os inimigos próximos por 3 segundos.' },
  bencao: { id: 'bencao', name: 'Benção do Docão', icon: '🙏', cd: 26, dur: 5, anim: 1.1, desc: 'Você e os aliados perto ganham +25% de dano por 5 segundos.' },
  cachaca: { id: 'cachaca', name: 'Cachaçado', icon: '🥃', cd: 40, dur: 3, anim: 0.95, desc: 'Fica imune a dano por 3 segundos.' },
  grokbot: { id: 'grokbot', name: 'Controle Mental do Grok Bot', icon: '🎯', cd: 36, dur: 10, anim: 1.0, desc: 'A mira gruda na cabeça dos zumbis por 10 segundos.' },
  integra: { id: 'integra', name: 'Camiseta do Integra', icon: '👕', cd: 34, dur: 10, anim: 1.05, desc: 'Projéteis inimigos voltam para quem atirou por 10 segundos.' },
  cheers: { id: 'cheers', name: 'Pelo Bem da Cheers', icon: '💥', cd: 50, anim: 1.25, desc: 'Explode com um dano enorme, fica com 1 de vida e parado por 3 segundos.' },
  joelhos: { id: 'joelhos', name: 'Joelhos do Big Mecânicos', icon: '🦵', cd: 16, anim: 0.7, desc: 'Um pulo bem mais alto que o normal.' },
  cafe: { id: 'cafe', name: 'Cafézinho', icon: '☕', cd: 8, anim: 0.65, desc: 'Um gole de café e um dash curto para frente.' },
};
export const HUP_IDS = Object.keys(HUPS);

export function rollOffer(owned, rnd, taken) {
  const have = owned || [];
  const pool = HUP_IDS.filter((id) => !have.includes(id));
  if (!pool.length) return [];
  const draw = () => {
    const b = pool.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b.slice(0, Math.min(3, b.length));
  };
  const key = (a) => a.slice().sort().join(',');
  let best = draw();
  for (let n = 0; n < 10 && taken && taken.has(key(best)) && pool.length > 3; n++) best = draw();
  return best;
}

export function takeOffer(p, id) {
  if (!p || !p.hOffer || !p.hOffer.includes(id) || !HUPS[id]) return false;
  if (!p.hUps) p.hUps = [];
  if (!p.hUps.includes(id)) p.hUps.push(id);
  p.hOffer = null;
  return true;
}

export function hReady(p, id, T) {
  if (!p || !p.alive || p.down || !HUPS[id]) return false;
  if (!(p.hUps || []).includes(id)) return false;
  if (p.hRootUntil > T) return false;
  if ((p.hCd && p.hCd[id]) > T) return false;
  return true;
}

// Ponto andável dentro do mapa. null se for parede, borda ou sem chão.
export function historiaSpot(P, size, x, z) {
  if (!P || !size || !Number.isFinite(+x) || !Number.isFinite(+z)) return null;
  x = +x; z = +z;
  const hx = size[0], hz = size[1];
  if (Math.abs(x) > hx - 1.4 || Math.abs(z) > hz - 1.4) return null;
  const y = P.groundAt(x, z, 8);
  if (!Number.isFinite(y)) return null;
  if (P.collides(x, y + 0.35, z) || P.collides(x, y + 1.15, z)) return null;
  return { x, y: y + 0.02, z };
}

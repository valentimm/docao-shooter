// Passivas do Modo história. No fim de cada wave sem chefão, cada jogador escolhe 1 de 3.
// A mesma pode voltar: bronze, prata, ouro. No ouro ela sai do sorteio.
export const RANKS = ['', 'Bronze', 'Prata', 'Ouro'];
export const HPASS = {
  passo: { id: 'passo', name: 'Passinho do Hotmilk', icon: '👟', pose: 'monster', line: (lv) => `+${[0, 10, 20, 30][lv]}% de velocidade o tempo todo.` },
  mola: { id: 'mola', name: 'Mola do Palco', icon: '🎪', pose: 'joelhos', line: (lv) => `O pulo fica ${[0, 5, 10, 15][lv]}% mais alto.` },
  brasa: { id: 'brasa', name: 'Chão de Brasa', icon: '🔥', pose: 'tosse', line: (lv) => `O chão por onde você passa queima zumbis (${[0, 12, 20, 32][lv]} de dano por segundo, por ${[0, '2,2', '2,8', '3,4'][lv]} s).` },
  porta: { id: 'porta', name: 'Café na Porta', icon: '🚪', pose: 'cachaca', line: (lv) => `Ao renascer, ${[0, '3,5', '5', '7'][lv]} s sem levar dano.` },
  pratos: { id: 'pratos', name: 'Pratos da Casa', icon: '🍽️', pose: 'integra', line: (lv) => lv <= 1 ? '1 prato gira em volta e quebra o projétil que encostar.' : `${lv} pratos giram em volta e quebram o projétil que encostar.` },
  caldo: { id: 'caldo', name: 'Caldo da Casa', icon: '🥣', pose: 'torta', line: (lv) => `Depois de ${[0, 4, 3, 2][lv]} s sem levar dano, recupera ${[0, 16, 22, 30][lv]} de vida por segundo.` },
  porcao: { id: 'porcao', name: 'Porção Extra', icon: '🍖', pose: 'barriga', line: (lv) => `A vida máxima sobe para ${[0, 125, 150, 180][lv]}.` },
  estalo: { id: 'estalo', name: 'Estalo de Torresmo', icon: '🥓', pose: 'cheers', line: (lv) => `${[0, 8, 14, 22][lv]}% de chance do tiro estourar e machucar os zumbis em volta (${[0, 16, 28, 42][lv]} de dano).` },
  espeto: { id: 'espeto', name: 'Espeto Furante', icon: '🍢', pose: 'grok', line: (lv) => `A bala atravessa mais ${[0, 1, 2, 4][lv]} ${lv === 1 ? 'zumbi' : 'zumbis'} e perde menos força no caminho.` },
  pimenta: { id: 'pimenta', name: 'Pele de Pimenta', icon: '🌶️', pose: 'barriga', line: (lv) => `O zumbi que te morde ainda te machuca, e leva ${[0, 14, 26, 40][lv]} de dano de volta.` },
  coveiro: { id: 'coveiro', name: 'Agilidade de Coveiro', icon: '⚰️', pose: 'bencao', line: (lv) => `Levantar um aliado caído fica ${[0, 22, 43, 62][lv]}% mais rápido.` },
  casca: { id: 'casca', name: 'Casca Grossa', icon: '🛡️', pose: 'cachaca', line: (lv) => `Depois de um golpe de zumbi, ${[0, '0,45', '0,7', '1'][lv]} s sem levar outro.` },
};
export const HPASS_IDS = Object.keys(HPASS);
const lv3 = (n) => (n >= 1 && n <= 3 ? n : 0);

export function passLv(p, id) {
  return lv3(p && p.hPass ? p.hPass[id] | 0 : 0);
}
export function passoMul(p) { return [1, 1.1, 1.2, 1.3][passLv(p, 'passo')] || 1; }
export function molaMul(p) { return [1, 1.05, 1.1, 1.15][passLv(p, 'mola')] || 1; }
export function portaTime(p) { return [0, 3.5, 5, 7][passLv(p, 'porta')] || 0; }
export function cascaTime(p) { return [0, 0.45, 0.7, 1][passLv(p, 'casca')] || 0; }
export function pimentaDmg(p) { return [0, 14, 26, 40][passLv(p, 'pimenta')] || 0; }
export function coveiroScale(p) { return [1, 0.78, 0.57, 0.38][passLv(p, 'coveiro')] || 1; }
export function passHp(lv) { return [100, 125, 150, 180][lv3(lv)] || 100; }
export function caldoTune(p) {
  const n = passLv(p, 'caldo');
  if (!n) return null;
  return { delay: [0, 4, 3, 2][n], rate: [0, 16, 22, 30][n] };
}
export function brasaStats(lv) {
  const n = lv3(lv);
  if (!n) return null;
  return { step: 0.85, life: [0, 2.2, 2.8, 3.4][n], r: [0, 1.05, 1.25, 1.45][n], dps: [0, 12, 20, 32][n] };
}
export function estaloRoll(lv, rnd) {
  const n = lv3(lv);
  const chance = [0, 0.08, 0.14, 0.22][n] || 0;
  if (!(chance > 0) || rnd() >= chance) return 0;
  return [0, 16, 28, 42][n];
}
export const ESTALO_R = 2.4;
export function espetoTune(p) {
  const n = passLv(p, 'espeto');
  if (!n) return null;
  return { extra: [0, 1, 2, 4][n], mul: [0, 0.88, 0.94, 1][n] };
}
export function withEspeto(shotW, p) {
  const t = espetoTune(p);
  if (!t || !shotW) return shotW;
  return { ...shotW, pierce: (shotW.pierce || 0) + t.extra, pierceMul: Math.max(shotW.pierceMul || 0, t.mul) };
}

export function platePoints(p, T) {
  const n = passLv(p, 'pratos');
  if (!n || !p || !p.pos) return [];
  const spin = 2.15, rad = 1.18, out = [];
  for (let i = 0; i < n; i++) {
    const a = T * spin + (i / n) * Math.PI * 2 + ((p.id | 0) % 7);
    out.push({ x: p.pos.x + Math.cos(a) * rad, y: p.pos.y + 1.05, z: p.pos.z + Math.sin(a) * rad });
  }
  return out;
}
export function plateBlocks(p, pos, T, reach = 0.5) {
  if (!pos) return false;
  for (const q of platePoints(p, T)) {
    if (Math.hypot(q.x - pos.x, q.y - pos.y, q.z - pos.z) <= reach) return true;
  }
  return false;
}

export function rollPass(owned, rnd, taken) {
  const have = owned || {};
  const pool = HPASS_IDS.filter((id) => (have[id] | 0) < 3);
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

export function takePass(p, id) {
  if (!p || !p.hPOffer || !p.hPOffer.includes(id) || !HPASS[id]) return 0;
  if (!p.hPass) p.hPass = {};
  const next = (p.hPass[id] | 0) + 1;
  if (next > 3) return 0;
  p.hPass[id] = next;
  p.hPOffer = null;
  return next;
}

// Fila única com os ativos (array de ids) e as passivas ({ k:'pass', ids }).
// Se já tem uma oferta na tela, a nova espera. Senão, abre na hora.
export function enqueueHistoria(p, item) {
  if (!p) return null;
  const busy = (p.hOffer && p.hOffer.length) || (p.hPOffer && p.hPOffer.length);
  if (busy) {
    if (!p.hQueue) p.hQueue = [];
    p.hQueue.push(item);
    return null;
  }
  if (Array.isArray(item)) {
    p.hOffer = item;
    return { k: 'up', ids: item };
  }
  if (item && item.k === 'pass' && item.ids && item.ids.length) {
    p.hPOffer = item.ids;
    return { k: 'pass', ids: item.ids };
  }
  return null;
}
export function nextHistoria(p) {
  const q = (p && p.hQueue) || [];
  while (q.length) {
    const item = q.shift();
    if (Array.isArray(item) && item.length) { p.hOffer = item; return { k: 'up', ids: item }; }
    if (item && item.k === 'pass' && item.ids && item.ids.length) { p.hPOffer = item.ids; return { k: 'pass', ids: item.ids }; }
  }
  return null;
}

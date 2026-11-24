// Capítulos secretos do Modo história (waves 21, 24, 25, 29 e 30).
// A invasão clássica não importa este plano. O Big (fantasia Él Big, c20) não entra na wave 29.
import { isKnife, W_FALL, W_NADE } from './rules.js';

export const CORRUPT_SKINS = ['classico', 'clube', 'rei-do-pop', 'rapper', 'bruxinho', 'kung-fu', 'cabeludo', 'pescador', 'choquinho', 'bone', 'fantasminha', 'esqueletao', 'cavaleiro-galactico', 'nomade-do-deserto', 'boi-caprichoso', 'docao-felipe', 'docao-matheus', 'faixa-presidencial'];
export const STORY_ZTS = new Set(['filho', 'sinuca', 'bonezinho', 'corrupt', 'bossMini', 'bossOclinhos', 'bossBig']);
export const POOL_PRAISE_R = 6.5;

const GUNS = [0, 1, 2, 3, 4, 5, 6];

export function storyPlan(wave) {
  if (wave === 21) return { name: 'Crias do Barriguinha', blurb: 'Os filhos cercam a HOTMILK. O Barriguinha mirim veio junto.', boss: 'bossMini', queue: Array(8).fill('filho') };
  if (wave === 24) return { name: 'Link Neles', blurb: 'A sinuca virou altar. Eles batem com o taco e atiram a bola.', queue: Array(10).fill('sinuca') };
  if (wave === 25) return { name: 'Oclinhos', blurb: 'Óculos, taco gigante e a camisa do link. A mesa pode cair na sua cabeça.', boss: 'bossOclinhos', queue: ['walker', 'walker', 'runner', 'runner'] };
  if (wave === 29) return {
    name: 'Porcada Corrompida',
    blurb: 'As skins do Docão Shooter viraram zumbis. Eles atiram sem acabar a munição. O Big não está aqui.',
    queue: Array(8).fill('walker').concat(['runner', 'runner', 'tank']),
    drip: CORRUPT_SKINS.map((skin, i) => `c:${skin}:${GUNS[i % GUNS.length]}`),
  };
  if (wave === 30) return { name: 'Big Corrompido', blurb: 'O Big da Cheers foi corrompido. Temos que libertar ele.', boss: 'bossBig', queue: [] };
  return null;
}

export function breadBlocks(t, w, now) {
  if (!t || !t.zt || !(t.breadUntil > now)) return false;
  if (isKnife(w) || w === W_FALL || w === W_NADE) return false;
  return true;
}

export function praisesTable(z, pool) {
  if (!z || !pool || (z.zt !== 'sinuca')) return false;
  if (Math.abs((z.pos.y || 0) - pool.y) > 2.2) return false;
  return Math.hypot(z.pos.x - pool.x, z.pos.z - pool.z) <= POOL_PRAISE_R;
}

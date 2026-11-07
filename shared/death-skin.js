// Efeito de morte ligado à skin equipada. Só a regra: o desenho fica no cliente.
import { sniperKind, gunPaint } from './closet.js';

// A Docão Lore é a Torresmo dourada ou o Fuzil Pururuca com a mesma pintura.
// O Gold Docão é só o fuzil. As duas podem estar equipadas ao mesmo tempo.
export function deathSkinShow(account) {
  const sniper = sniperKind(account && account.sniper);
  const rifle = gunPaint(account && account.guns && account.guns.rifle);
  return {
    dragon: sniper === 'lore' || rifle === 'lore',
    coins: rifle === 'gold',
  };
}

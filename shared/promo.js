// ============================================================
//  Churrasco Relâmpago: +1000 Docoins, uma vez por conta, até 19/11/2026 23:59 BRT.
//  Constantes e textos do popup (cliente e servidor). O crédito em si é só no Worker.
// ============================================================
export const PROMO_ID = 'churrasco-relampago-2026-11';
export const PROMO_NAME = 'Churrasco Relâmpago';
export const PROMO_COINS = 1000;
// 19/11/2026 23:59:59.999 horário de Brasília (UTC-3)
export const PROMO_EXPIRES_AT = Date.parse('2026-11-20T02:59:59.999Z');

export const promoActive = (now = Date.now()) => now <= PROMO_EXPIRES_AT;

export const PROMO_TITLE = 'Churrasco Relâmpago 🔥🐷';
export const PROMO_KICKER = 'Promoção da casa';
export const PROMO_CREDIT_OK = 'VALEU, PORCA VÉIA';
export const PROMO_GUEST_OK = 'ENTRAR / CRIAR CONTA';
export const PROMO_GUEST_SKIP = 'DEIXA PRA LÁ';

export function promoCreditText(coins = PROMO_COINS) {
  return `A Porca Véia acordou com vontade de festa e abriu o freezer. Caiu ${coins} Docoins na sua comanda — um prato por porco, só dessa vez. Corre no Brechó antes que ela lembre que toucinho não se dá de graça.`;
}

export function promoGuestText(coins = PROMO_COINS) {
  return `A Porca Véia tá servindo ${coins} Docoins no Churrasco Relâmpago, mas só pra quem tem comanda. Entra ou cria a conta pra levar o troco: um prato por porco, até 19/11.`;
}

export function promoCreditHtml(coins = PROMO_COINS) {
  return `A Porca Véia acordou com vontade de festa e abriu o freezer. Caiu <b>${coins} Docoins</b> na sua comanda — um prato por porco, só dessa vez. Corre no Brechó antes que ela lembre que toucinho não se dá de graça.`;
}

export function promoGuestHtml(coins = PROMO_COINS) {
  return `A Porca Véia tá servindo <b>${coins} Docoins</b> no Churrasco Relâmpago, mas só pra quem tem comanda. Entra ou cria a conta pra levar o troco: um prato por porco, até 19/11.`;
}

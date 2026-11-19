// ============================================================
//  Feriadão Relâmpago: +1000 Docoins, uma vez por conta, só em 20/11/2026
//  (00:00 às 23:59:59 horário de Brasília). Constantes e textos do popup
//  (cliente e servidor). O crédito em si é só no Worker.
// ============================================================
export const PROMO_ID = 'feriadao-relampago-2026-11-20';
export const PROMO_NAME = 'Feriadão Relâmpago';
export const PROMO_COINS = 1000;
// 20/11/2026 00:00:00.000 a 23:59:59.999 horário de Brasília (UTC-3)
export const PROMO_STARTS_AT = Date.parse('2026-11-20T03:00:00.000Z');
export const PROMO_EXPIRES_AT = Date.parse('2026-11-21T02:59:59.999Z');

export const promoActive = (now = Date.now()) => now >= PROMO_STARTS_AT && now <= PROMO_EXPIRES_AT;

export const PROMO_TITLE = 'Feriadão Relâmpago 🐷🔥';
export const PROMO_KICKER = 'Promoção da casa';
export const PROMO_CREDIT_OK = 'VALEU, PORCA VÉIA';
export const PROMO_GUEST_OK = 'ENTRAR / CRIAR CONTA';
export const PROMO_GUEST_SKIP = 'DEIXA PRA LÁ';

export function promoCreditText(coins = PROMO_COINS) {
  return `A Porca Véia viu feriadão no calendário e já ligou a churrasqueira. Caiu ${coins} Docoins na sua comanda — um prato por porco, só nesse feriado, até meia-noite. Corre no Brechó antes que ela volte do descanso e lembre que toucinho não se dá de graça.`;
}

export function promoGuestText(coins = PROMO_COINS) {
  return `A Porca Véia tá servindo ${coins} Docoins no Feriadão Relâmpago, mas só pra quem tem comanda. Entra ou cria a conta pra levar o troco: um prato por porco, só nesse feriado, até meia-noite.`;
}

export function promoCreditHtml(coins = PROMO_COINS) {
  return `A Porca Véia viu feriadão no calendário e já ligou a churrasqueira. Caiu <b>${coins} Docoins</b> na sua comanda — um prato por porco, só nesse feriado, até meia-noite. Corre no Brechó antes que ela volte do descanso e lembre que toucinho não se dá de graça.`;
}

export function promoGuestHtml(coins = PROMO_COINS) {
  return `A Porca Véia tá servindo <b>${coins} Docoins</b> no Feriadão Relâmpago, mas só pra quem tem comanda. Entra ou cria a conta pra levar o troco: um prato por porco, só nesse feriado, até meia-noite.`;
}

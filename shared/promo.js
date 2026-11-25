// ============================================================
//  INTEGRA: +500 Docoins e +5 caixotes, uma vez por conta, na
//  janela abaixo (horário de Brasília). Constantes e textos do
//  popup (cliente e servidor). O crédito em si é só no Worker.
//  Para mudar o prazo, altere só PROMO_STARTS_AT e PROMO_EXPIRES_AT.
// ============================================================
export const PROMO_ID = 'integra-2026-2027';
export const PROMO_NAME = 'INTEGRA';
export const PROMO_COINS = 500;
export const PROMO_BOXES = 5;
// 25/11/2026 00:00:00.000 a 29/11/2026 23:59:59.999 horário de Brasília (UTC-3)
export const PROMO_STARTS_AT = Date.parse('2026-11-25T03:00:00.000Z');
export const PROMO_EXPIRES_AT = Date.parse('2026-11-30T02:59:59.999Z');

export const promoActive = (now = Date.now()) => now >= PROMO_STARTS_AT && now <= PROMO_EXPIRES_AT;

export const PROMO_TITLE = 'INTEGRA 🎉🐷';
export const PROMO_KICKER = 'Festa de final de ano da Cheers';
export const PROMO_CREDIT_OK = 'VALEU, INTEGRA';
export const PROMO_GUEST_OK = 'ENTRAR / CRIAR CONTA';
export const PROMO_GUEST_SKIP = 'DEIXA PRA LÁ';

// Rótulo do último dia da janela em Brasília, para o texto acompanhar a data.
export function promoUntilLabel(expires = PROMO_EXPIRES_AT) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(expires));
}

export function promoCreditText(coins = PROMO_COINS, boxes = PROMO_BOXES) {
  return `A Cheers chama pra festa de final de ano e o Docão abriu a comanda. Caiu ${coins} Docoins e ${boxes} caixotes na sua conta — o Integra chegou. Vale uma vez por comanda, até ${promoUntilLabel()}. Corre no Brechó e abre os caixotes antes que a Porca Véia recolha o salgadinho.`;
}

export function promoGuestText(coins = PROMO_COINS, boxes = PROMO_BOXES) {
  return `O Integra pingou, mas a Porca Véia só deposita ${coins} Docoins e ${boxes} caixotes pra quem tem comanda. Entra ou cria a conta pra ir pra festa: até ${promoUntilLabel()}.`;
}

export function promoCreditHtml(coins = PROMO_COINS, boxes = PROMO_BOXES) {
  return `A Cheers chama pra festa de final de ano e o Docão abriu a comanda. Caiu <b>${coins} Docoins</b> e <b>${boxes} caixotes</b> na sua conta — o Integra chegou. Vale uma vez por comanda, até ${promoUntilLabel()}. Corre no Brechó e abre os caixotes antes que a Porca Véia recolha o salgadinho.`;
}

export function promoGuestHtml(coins = PROMO_COINS, boxes = PROMO_BOXES) {
  return `O Integra pingou, mas a Porca Véia só deposita <b>${coins} Docoins</b> e <b>${boxes} caixotes</b> pra quem tem comanda. Entra ou cria a conta pra ir pra festa: até ${promoUntilLabel()}.`;
}

// ============================================================
//  DÉCIMO PINGOU: +1000 Docoins, uma vez por conta, só em 19/11/2026
//  (00:00 às 23:59:59 horário de Brasília). Constantes e textos do popup
//  (cliente e servidor). O crédito em si é só no Worker.
// ============================================================
export const PROMO_ID = 'decimo-pingou-2026-11-19';
export const PROMO_NAME = 'DÉCIMO PINGOU';
export const PROMO_COINS = 1000;
// 19/11/2026 00:00:00.000 a 23:59:59.999 horário de Brasília (UTC-3)
export const PROMO_STARTS_AT = Date.parse('2026-11-19T03:00:00.000Z');
export const PROMO_EXPIRES_AT = Date.parse('2026-11-20T02:59:59.999Z');

export const promoActive = (now = Date.now()) => now >= PROMO_STARTS_AT && now <= PROMO_EXPIRES_AT;

// Z + 8 z + 18 u, grafia pedida (o nome longo quebra no CSS do popup)
export const PROMO_THANKS_NAME = 'Z' + 'z'.repeat(8) + 'u'.repeat(18);

export const PROMO_TITLE = 'DÉCIMO PINGOU 🐷💸';
export const PROMO_KICKER = 'Promoção da casa';
export const PROMO_CREDIT_OK = 'VALEU, MEU 13º';
export const PROMO_GUEST_OK = 'ENTRAR / CRIAR CONTA';
export const PROMO_GUEST_SKIP = 'DEIXA PRA LÁ';

const thanks = `Agradecimento especial à ${PROMO_THANKS_NAME}`;
const thanksHtml = `Agradecimento especial à <span class="promo-thanks">${PROMO_THANKS_NAME}</span>`;

export function promoCreditText(coins = PROMO_COINS) {
  return `O Docão recebeu o 13º e, em vez de guardar, transformou tudo em Docoins pra turma. Caiu ${coins} Docoins na sua comanda — o décimo pingou, só hoje, até meia-noite. ${thanks}. Corre no Brechó antes que o RH peça o salário de volta.`;
}

export function promoGuestText(coins = PROMO_COINS) {
  return `O décimo pingou, mas a Porca Véia só deposita ${coins} Docoins pra quem tem comanda. Entra ou cria a conta pra levar o 13º: só hoje, até meia-noite. ${thanks}.`;
}

export function promoCreditHtml(coins = PROMO_COINS) {
  return `O Docão recebeu o 13º e, em vez de guardar, transformou tudo em Docoins pra turma. Caiu <b>${coins} Docoins</b> na sua comanda — o décimo pingou, só hoje, até meia-noite. ${thanksHtml}. Corre no Brechó antes que o RH peça o salário de volta.`;
}

export function promoGuestHtml(coins = PROMO_COINS) {
  return `O décimo pingou, mas a Porca Véia só deposita <b>${coins} Docoins</b> pra quem tem comanda. Entra ou cria a conta pra levar o 13º: só hoje, até meia-noite. ${thanksHtml}.`;
}

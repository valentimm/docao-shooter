// ============================================================
//  INTEGRA: +500 Docoins e +5 caixotes, uma vez por conta, na
//  janela abaixo (horário de Brasília). Constantes e textos do
//  popup (cliente e servidor). O crédito em si é só no Worker.
//  A janela e o liga/desliga em produção vêm de promo_config no D1.
//  Estas constantes são o fallback (e o seed) se a linha não existir.
// ============================================================
export const PROMO_ID = 'integra-2026-2027';
export const PROMO_NAME = 'INTEGRA';
export const PROMO_COINS = 500;
export const PROMO_BOXES = 5;
export const PROMO_CONFIG_ID = 'integra';
// Janela padrão / seed: 25/11/2026 00:00:00.000 a 29/11/2026 23:59:59.999 BRT.
// Formato ISO com offset de Brasília (-03:00), o mesmo usado no console do D1.
export const PROMO_STARTS_AT_ISO = '2026-11-25T00:00:00.000-03:00';
export const PROMO_EXPIRES_AT_ISO = '2026-11-29T23:59:59.999-03:00';
export const PROMO_STARTS_AT = Date.parse(PROMO_STARTS_AT_ISO);
export const PROMO_EXPIRES_AT = Date.parse(PROMO_EXPIRES_AT_ISO);

export const promoActive = (now = Date.now(), starts = PROMO_STARTS_AT, expires = PROMO_EXPIRES_AT) => now >= starts && now <= expires;

// Lê uma linha de promo_config. Sem linha (ou inválida): janela padrão, desligada.
export function promoFromConfig(row, now = Date.now()) {
  const fallback = !row;
  const startsAt = fallback ? PROMO_STARTS_AT : Date.parse(String(row.starts_at ?? '').trim());
  const expiresAt = fallback ? PROMO_EXPIRES_AT : Date.parse(String(row.expires_at ?? '').trim());
  const startsOk = Number.isFinite(startsAt);
  const expiresOk = Number.isFinite(expiresAt);
  const enabled = !fallback && Number(row.enabled) === 1;
  return {
    id: PROMO_ID,
    configId: PROMO_CONFIG_ID,
    name: PROMO_NAME,
    coins: PROMO_COINS,
    boxes: PROMO_BOXES,
    enabled,
    startsAt: startsOk ? startsAt : PROMO_STARTS_AT,
    expiresAt: expiresOk ? expiresAt : PROMO_EXPIRES_AT,
    startsAtIso: fallback || row.starts_at == null || row.starts_at === '' ? PROMO_STARTS_AT_ISO : String(row.starts_at),
    expiresAtIso: fallback || row.expires_at == null || row.expires_at === '' ? PROMO_EXPIRES_AT_ISO : String(row.expires_at),
    active: enabled && startsOk && expiresOk && now >= startsAt && now <= expiresAt,
    source: fallback ? 'fallback' : 'db',
  };
}

export function publicPromo(state) {
  if (!state) state = promoFromConfig(null);
  return {
    id: state.id,
    name: state.name,
    coins: state.coins,
    boxes: state.boxes,
    active: !!state.active,
    enabled: !!state.enabled,
    startsAt: state.startsAt,
    expiresAt: state.expiresAt,
    startsAtIso: state.startsAtIso,
    expiresAtIso: state.expiresAtIso,
  };
}

export const PROMO_TITLE = 'INTEGRA 🎉🐷';
export const PROMO_KICKER = 'Festa de final de ano da Cheers';
export const PROMO_CREDIT_OK = 'VALEU, INTEGRA';
export const PROMO_GUEST_OK = 'ENTRAR / CRIAR CONTA';
export const PROMO_GUEST_SKIP = 'DEIXA PRA LÁ';

// Rótulo do último dia da janela em Brasília, para o texto acompanhar a data.
export function promoUntilLabel(expires = PROMO_EXPIRES_AT) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(expires));
}

export function promoCreditText(coins = PROMO_COINS, boxes = PROMO_BOXES, expires = PROMO_EXPIRES_AT) {
  return `A Cheers chama pra festa de final de ano e o Docão abriu a comanda. Caiu ${coins} Docoins e ${boxes} caixotes na sua conta — o Integra chegou. Vale uma vez por comanda, até ${promoUntilLabel(expires)}. Corre no Brechó e abre os caixotes antes que a Porca Véia recolha o salgadinho.`;
}

export function promoGuestText(coins = PROMO_COINS, boxes = PROMO_BOXES, expires = PROMO_EXPIRES_AT) {
  return `O Integra pingou, mas a Porca Véia só deposita ${coins} Docoins e ${boxes} caixotes pra quem tem comanda. Entra ou cria a conta pra ir pra festa: até ${promoUntilLabel(expires)}.`;
}

export function promoCreditHtml(coins = PROMO_COINS, boxes = PROMO_BOXES, expires = PROMO_EXPIRES_AT) {
  return `A Cheers chama pra festa de final de ano e o Docão abriu a comanda. Caiu <b>${coins} Docoins</b> e <b>${boxes} caixotes</b> na sua conta — o Integra chegou. Vale uma vez por comanda, até ${promoUntilLabel(expires)}. Corre no Brechó e abre os caixotes antes que a Porca Véia recolha o salgadinho.`;
}

export function promoGuestHtml(coins = PROMO_COINS, boxes = PROMO_BOXES, expires = PROMO_EXPIRES_AT) {
  return `O Integra pingou, mas a Porca Véia só deposita <b>${coins} Docoins</b> e <b>${boxes} caixotes</b> pra quem tem comanda. Entra ou cria a conta pra ir pra festa: até ${promoUntilLabel(expires)}.`;
}

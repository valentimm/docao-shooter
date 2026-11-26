// ============================================================
//  Loja e visual personalizado (Docoins). TUDO autoritativo aqui: saldo, ganho, compra, mochila e o que pode ser equipado.
//  O cliente só pede ("quero comprar h3", "quero usar este visual"); nunca informa saldo nem ganho.
//  Custo D1: ganho = 1 UPDATE por jogador junto do lote de estatísticas (fim de partida/saída); compra = 1 lote atômico;
//  equipar = 1 UPDATE condicional (não grava se nada mudou); mochila vai junto do /api/me (1 SELECT pequeno), sem polling.
// ============================================================
import { SKINS, skinOk } from '../../skins.js';
import { ITEMS, itemById, parseLook, lookItemIds, isFreeItem, knifeKind, sniperKind, gunKey, parseGuns, GUN_EQUIP_KEYS, EARN } from '../../shared/closet.js';
import { spDay, parseChal, applyChal, chalView } from '../../shared/challenges.js';
import { rollBox, BOX_NAME, BOX_PRICE, wheelInputs, rollWheel } from '../../shared/lootbox.js';
import { PROMO_ID, PROMO_NAME, PROMO_COINS, PROMO_BOXES, PROMO_CONFIG_ID, promoFromConfig, publicPromo } from '../../shared/promo.js';

const now = () => Math.floor(Date.now() / 1000);
export const dayNow = () => Math.floor(now() / 86400);

// instrução SQL do ganho: soma `c` Docoins respeitando o teto diário (atômico, uma linha). Entra no mesmo lote do ranking.
// chal (opcional) = { old, json, reward }: desafios diários vão NO MESMO UPDATE (uma linha gravada por jogador por gravação).
// O prêmio do desafio não entra no teto diário. "chal IS old" barra pagar duas vezes se duas salas gravarem juntas.
export function coinCreditStmt(env, acct, c, chal = null, mapBoxes = 0) {
  c = Math.max(0, Math.min(EARN.matchCap, c | 0));
  const boxAdd = Math.max(0, Math.min(4, (chal ? Math.max(0, Math.min(3, chal.boxes | 0)) : 0) + (mapBoxes | 0)));
  if (!c && !chal && !boxAdd) return null;
  const day = dayNow();
  const earn = `MAX(0, MIN(?3, ?4 - (CASE WHEN earn_day = ?2 THEN earn_today ELSE 0 END)))`;
  if (!chal) return env.DB.prepare(
    `UPDATE accounts SET
       coins = coins + ${earn},
       earn_today = (CASE WHEN earn_day = ?2 THEN earn_today ELSE 0 END) + ${earn},
       earn_day = ?2,
       boxes = boxes + ?5
     WHERE id = ?1`).bind(acct, day, c, EARN.dayCap, boxAdd);
  return env.DB.prepare(
    `UPDATE accounts SET
       coins = coins + ${earn} + (CASE WHEN chal IS ?5 THEN ?6 ELSE 0 END),
       earn_today = (CASE WHEN earn_day = ?2 THEN earn_today ELSE 0 END) + ${earn},
       earn_day = ?2,
       chal = (CASE WHEN chal IS ?5 THEN ?7 ELSE chal END),
       boxes = boxes + (CASE WHEN chal IS ?5 THEN ?8 ELSE 0 END) + ?9
     WHERE id = ?1`).bind(acct, day, c, EARN.dayCap, chal.old, chal.reward | 0, chal.json, Math.max(0, Math.min(3, chal.boxes | 0)), Math.max(0, Math.min(4, mapBoxes | 0)));
}
// desafios: lê o estado das contas desta gravação (1 SELECT pequeno, só se a sala contou algo) e calcula o novo em JS
export async function chalUpdates(env, items) {
  const want = items.filter((i) => i && i.acct > 0 && i.q && typeof i.q === 'object'); if (!want.length) return new Map();
  const ids = [...new Set(want.map((i) => i.acct | 0))].slice(0, 50);
  const { results } = await env.DB.prepare(`SELECT id, chal FROM accounts WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const raw = new Map((results || []).map((r) => [r.id, r.chal ?? null])), day = spDay(), out = new Map();
  for (const i of want) {
    if (!raw.has(i.acct)) continue; const old = raw.get(i.acct);
    const prev = out.has(i.acct) ? out.get(i.acct).state : parseChal(old, day);
    const r = applyChal(prev, i.acct, i.q, i.mode); if (!r.changed) continue;
    const o = out.get(i.acct); out.set(i.acct, { old, state: r.state, json: JSON.stringify(r.state), reward: (o ? o.reward : 0) + r.reward, boxes: (o ? o.boxes : 0) + (r.boxes | 0) });
  }
  return out;
}

export async function wallet(env, id) { // saldo + mochila + quanto já ganhou hoje
  const [a, inv] = await env.DB.batch([
    env.DB.prepare('SELECT coins, custom, earn_day, earn_today, chal, knife, sniper, boxes, guns, box_buy_day FROM accounts WHERE id = ?').bind(id),
    env.DB.prepare('SELECT item, qty FROM inventory WHERE account_id = ?').bind(id),
  ]);
  const r = (a.results && a.results[0]) || { coins: 0, custom: null, earn_day: 0, earn_today: 0 };
  const items = [];
  for (const x of inv.results || []) {
    if (!itemById(x.item)) continue;
    const n = Math.max(1, Math.min(99, x.qty == null ? 1 : x.qty | 0));
    for (let i = 0; i < n; i++) items.push(x.item);
  }
  const knife = knifeKind(r.knife) && (isFreeItem(r.knife) || items.includes(r.knife)) ? r.knife : null;
  const sniper = sniperKind(r.sniper) && (isFreeItem(r.sniper) || items.includes(r.sniper)) ? r.sniper : null;
  return { coins: r.coins | 0, custom: r.custom && parseLook(r.custom) ? r.custom : null, items, knife, sniper, guns: parseGuns(r.guns), boxes: r.boxes | 0, boxBought: (r.box_buy_day | 0) === spDay(), earnToday: r.earn_day === dayNow() ? r.earn_today | 0 : 0, dayCap: EARN.dayCap, chal: chalView(id, r.chal) };
}
export async function equipSniper(env, id, itemId) {
  const clear = itemId == null || itemId === '';
  if (!clear) {
    if (!sniperKind(itemId)) return false;
    if (!isFreeItem(itemId)) {
      const own = await env.DB.prepare('SELECT 1 AS x FROM inventory WHERE account_id = ? AND item = ?').bind(id, itemId).first();
      if (!own) return false;
    }
  }
  await env.DB.prepare('UPDATE accounts SET sniper = ?2 WHERE id = ?1').bind(id, clear ? null : itemId).run();
  return true;
}
// equipar faca: '' volta pra faca de churrasqueiro. Paga só entra se estiver na mochila. O preço não volta.
export async function equipKnife(env, id, itemId) {
  const clear = itemId == null || itemId === '';
  if (!clear) {
    if (!knifeKind(itemId)) return false;
    if (!isFreeItem(itemId)) {
      const own = await env.DB.prepare('SELECT 1 AS x FROM inventory WHERE account_id = ? AND item = ?').bind(id, itemId).first();
      if (!own) return false;
    }
  }
  await env.DB.prepare('UPDATE accounts SET knife = ?2 WHERE id = ?1').bind(id, clear ? null : itemId).run();
  return true;
}

// compra: erro amigável por pré-leitura, segurança por lote atômico (INSERT condicional + débito condicional; chave primária barra compra dupla)
export async function buyItem(env, id, itemId) {
  const it = typeof itemId === 'string' ? itemById(itemId) : null; if (!it) return { status: 400, error: 'Item inexistente' };
  if (it.loot) return { status: 400, error: `Essa skin não se compra. Ela sai no ${BOX_NAME}.` };
  if (isFreeItem(it.id)) return { status: 409, error: 'Esse item já é seu: é padrão e de graça' }; // sem escrita no D1, sem debitar Docoin
  const t = now();
  const [a, inv] = await env.DB.batch([
    env.DB.prepare('SELECT coins FROM accounts WHERE id = ?').bind(id),
    env.DB.prepare('SELECT 1 AS x FROM inventory WHERE account_id = ? AND item = ?').bind(id, it.id),
  ]);
  if (inv.results && inv.results.length) return { status: 409, error: 'Você já tem esse item' };
  if (((a.results && a.results[0] && a.results[0].coins) | 0) < it.price) return { status: 402, error: 'Docoins insuficientes' };
  try {
    const out = await env.DB.batch([
      env.DB.prepare('INSERT INTO inventory (account_id, item, acquired_at) SELECT ?1, ?2, ?3 WHERE (SELECT coins FROM accounts WHERE id = ?1) >= ?4').bind(id, it.id, t, it.price),
      env.DB.prepare('UPDATE accounts SET coins = coins - ?3 WHERE id = ?1 AND coins >= ?3 AND EXISTS (SELECT 1 FROM inventory WHERE account_id = ?1 AND item = ?2)').bind(id, it.id, it.price),
      env.DB.prepare('SELECT coins FROM accounts WHERE id = ?').bind(id),
    ]);
    if (!out[0].meta || !out[0].meta.changes) return { status: 402, error: 'Docoins insuficientes' }; // perdeu a corrida pelo saldo
    return { status: 200, item: it.id, coins: (out[2].results[0].coins) | 0 };
  } catch (e) {
    return { status: 409, error: 'Você já tem esse item' }; // chave primária: outra compra igual entrou primeiro (nada foi cobrado: o lote voltou atrás)
  }
}

// equipar: skin da lista (sempre pode) ou visual personalizado. Parte paga tem que estar na mochila; parte grátis (price 0) passa sem linha no D1. Só grava se mudou.
export async function equipSkin(env, id, skin) {
  if (typeof skin !== 'string') return false;
  if (SKINS.some((s) => s.id === skin)) {
    await env.DB.prepare('UPDATE accounts SET skin = ?2 WHERE id = ?1 AND skin IS NOT ?2').bind(id, skin).run(); return true;
  }
  if (!skinOk(skin)) return false;
  const ids = lookItemIds(skin).filter((i) => !isFreeItem(i)); // item grátis não precisa estar na mochila
  const ph = ids.map((_, i) => '?' + (i + 3)).join(',');
  const own = ids.length ? `(SELECT COUNT(*) FROM inventory WHERE account_id = ?1 AND item IN (${ph})) = ${ids.length}` : '1 = 1';
  const r = await env.DB.prepare(`UPDATE accounts SET skin = ?2, custom = ?2 WHERE id = ?1 AND (skin IS NOT ?2 OR custom IS NOT ?2) AND ${own}`).bind(id, skin, ...ids).run();
  if (r.meta && r.meta.changes) return true;
  const cur = await env.DB.prepare('SELECT skin, custom FROM accounts WHERE id = ?').bind(id).first(); // nada mudou: ou já estava assim, ou faltou item
  return !!cur && cur.skin === skin && cur.custom === skin;
}
// Compra 1 caixote por dia de Brasília. O preço é o do servidor. O dia da compra não é o dia do caixote grátis.
export async function buyBox(env, id) {
  const day = spDay();
  const row = await env.DB.prepare('SELECT coins, box_buy_day FROM accounts WHERE id = ?').bind(id).first();
  if (!row) return { status: 404, error: 'Conta não encontrada' };
  if ((row.box_buy_day | 0) === day) return { status: 409, error: 'Você já comprou o caixote de hoje. Volta amanhã.' };
  if ((row.coins | 0) < BOX_PRICE) return { status: 402, error: 'Docoins insuficientes' };
  const upd = await env.DB.prepare(
    `UPDATE accounts SET coins = coins - ?3, boxes = boxes + 1, box_buy_day = ?2
     WHERE id = ?1 AND coins >= ?3 AND box_buy_day IS NOT ?2`
  ).bind(id, day, BOX_PRICE).run();
  if (!upd.meta || !upd.meta.changes) {
    const again = await env.DB.prepare('SELECT coins, box_buy_day FROM accounts WHERE id = ?').bind(id).first();
    if (again && (again.box_buy_day | 0) === day) return { status: 409, error: 'Você já comprou o caixote de hoje. Volta amanhã.' };
    return { status: 402, error: 'Docoins insuficientes' };
  }
  const done = await env.DB.prepare('SELECT coins, boxes FROM accounts WHERE id = ?').bind(id).first();
  return { status: 200, coins: (done && done.coins) | 0, boxes: (done && done.boxes) | 0, boxBought: true };
}


// Config da promo no D1 (promo_config). Cache curto pra não consultar a cada /api/me.
export const PROMO_CACHE_MS = 45_000;
let promoCache = { at: 0, env: null, row: undefined };
export function clearPromoConfigCache() { promoCache = { at: 0, env: null, row: undefined }; }

async function readPromoConfig(env) {
  try {
    return await env.DB.prepare('SELECT promo_id, enabled, starts_at, expires_at FROM promo_config WHERE promo_id = ?1').bind(PROMO_CONFIG_ID).first();
  } catch (e) {
    return null; // tabela ainda não existe: cai no fallback desligado
  }
}

export async function getPromoState(env, now = Date.now()) {
  if (promoCache.env === env && promoCache.row !== undefined && (now - promoCache.at) < PROMO_CACHE_MS) {
    return promoFromConfig(promoCache.row, now);
  }
  const row = await readPromoConfig(env);
  promoCache = { at: now, env, row: row || null };
  return promoFromConfig(row, now);
}

// Promoção vigente (INTEGRA): +N Docoins e +N caixotes uma vez por conta, só se
// enabled=1 e o relógio estiver entre starts_at e expires_at no banco.
// INSERT + crédito no mesmo lote atômico.
// Segunda chamada (reload, outro aparelho) não soma de novo. Outro promo_id não bloqueia.
export async function grantPromo(env, id, now = Date.now()) {
  const state = await getPromoState(env, now);
  if (!state.active) return { granted: false, expired: true, promo: publicPromo(state) };
  const t = Math.floor(now / 1000);
  try {
    const out = await env.DB.batch([
      env.DB.prepare('INSERT INTO promo_claims (account_id, promo_id, coins, claimed_at) VALUES (?1, ?2, ?3, ?4)').bind(id, PROMO_ID, PROMO_COINS, t),
      env.DB.prepare('UPDATE accounts SET coins = coins + ?2, boxes = boxes + ?3 WHERE id = ?1').bind(id, PROMO_COINS, PROMO_BOXES),
    ]);
    if (!out[0].meta || !out[0].meta.changes) return { granted: false };
    return { granted: true, coins: PROMO_COINS, boxes: PROMO_BOXES, id: PROMO_ID, name: PROMO_NAME };
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/unique|constraint/i.test(msg)) return { granted: false };
    console.error('promo', msg);
    return { granted: false, error: true };
  }
}

// Um caixote por dia de Brasília, na primeira leitura da conta nesse dia (login ou sessão que continua aberta).
export async function grantLoginBox(env, id) {
  const day = spDay();
  const r = await env.DB.prepare('UPDATE accounts SET boxes = boxes + 1, box_day = ?2 WHERE id = ?1 AND box_day IS NOT ?2').bind(id, day).run();
  return !!(r.meta && r.meta.changes);
}

function cryptoRand() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

const dropView = (it) => ({ id: it.id, name: it.name, emoji: it.emoji, weight: it.weight, gun: it.gun || '', knife: it.knife || '', paint: it.paint || it.finish || '' });

// Abre um caixote. O servidor sorteia. Skin repetida soma qty na mochila (não vira Docoin). O débito do caixote é condicional.
export async function openBox(env, id) {
  const inv = await env.DB.prepare('SELECT item FROM inventory WHERE account_id = ?').bind(id).all();
  const owned = new Set((inv.results || []).map((x) => x.item));
  const it = rollBox(cryptoRand);
  if (!it) return { status: 500, error: 'O caixote veio vazio' };
  const dupe = owned.has(it.id);
  const dec = await env.DB.prepare('UPDATE accounts SET boxes = boxes - 1 WHERE id = ?1 AND boxes >= 1').bind(id).run();
  if (!dec.meta || !dec.meta.changes) return { status: 409, error: 'Você não tem caixote para abrir' };
  await env.DB.prepare(
    `INSERT INTO inventory (account_id, item, acquired_at, qty) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(account_id, item) DO UPDATE SET qty = qty + 1`
  ).bind(id, it.id, now()).run();
  const row = await env.DB.prepare('SELECT coins, boxes FROM accounts WHERE id = ?').bind(id).first();
  return { status: 200, dupe, item: dropView(it), coins: (row && row.coins) | 0, gain: 0, boxes: (row && row.boxes) | 0 };
}

// A skin equipada só sai se ela foi uma das três e não voltou como prêmio.
function wheelEquip(current, spent, prizeId, dupe) {
  if (!current || !spent.includes(current)) return current || null;
  return !dupe && current === prizeId ? current : null;
}

// Gasta 3 skins e entrega uma de peso >= o maior das três. Skin repetida soma qty (não vira Docoin).
export async function spinWheel(env, id, ids) {
  const picked = wheelInputs(ids);
  if (!picked) return { status: 400, error: 'Escolha 3 skins da mochila' };
  const spent = picked.map((it) => it.id);
  const inv = await env.DB.prepare('SELECT item, qty FROM inventory WHERE account_id = ?').bind(id).all();
  const qtyOf = new Map((inv.results || []).map((x) => [x.item, Math.max(1, x.qty == null ? 1 : x.qty | 0)]));
  const need = new Map();
  for (const sid of spent) need.set(sid, (need.get(sid) || 0) + 1);
  for (const [sid, n] of need) if ((qtyOf.get(sid) || 0) < n) return { status: 409, error: 'Uma dessas skins não está na mochila' };
  const it = rollWheel(picked, cryptoRand);
  if (!it) return { status: 500, error: 'A roleta veio vazia' };
  const keepPrize = spent.includes(it.id); // uma das três voltou: qty -1 +1 = net 0 nas outras
  const dupe = qtyOf.has(it.id) && !keepPrize;
  const acc = await env.DB.prepare('SELECT knife, sniper, guns FROM accounts WHERE id = ?').bind(id).first();
  const guns = parseGuns(acc && acc.guns);
  for (const k of GUN_EQUIP_KEYS) if (!wheelEquip(guns[k], spent, it.id, false)) delete guns[k];
  const gunsJson = Object.keys(guns).length ? JSON.stringify(guns) : null;
  const knife = wheelEquip(acc && acc.knife, spent, it.id, false);
  const sniper = wheelEquip(acc && acc.sniper, spent, it.id, false);
  // baixa 1 de cada skin gasta; se qty chega a 0, apaga a linha
  for (const sid of spent) {
    const q = qtyOf.get(sid) | 0;
    if (q <= 1) await env.DB.prepare('DELETE FROM inventory WHERE account_id = ?1 AND item = ?2').bind(id, sid).run();
    else await env.DB.prepare('UPDATE inventory SET qty = qty - 1 WHERE account_id = ?1 AND item = ?2 AND qty >= 1').bind(id, sid).run();
    qtyOf.set(sid, q - 1);
  }
  await env.DB.prepare(
    `INSERT INTO inventory (account_id, item, acquired_at, qty) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(account_id, item) DO UPDATE SET qty = qty + 1`
  ).bind(id, it.id, now()).run();
  const gone = [...new Set(spent)].filter((sid) => sid !== it.id && (qtyOf.get(sid) || 0) <= 0);
  await env.DB.prepare(
    `UPDATE accounts SET knife = ?2, sniper = ?3, guns = ?4
     WHERE id = ?1
       AND EXISTS (SELECT 1 FROM inventory WHERE account_id = ?1 AND item = ?5)
       AND (?6 = '' OR NOT EXISTS (SELECT 1 FROM inventory WHERE account_id = ?1 AND item = ?6))
       AND (?7 = '' OR NOT EXISTS (SELECT 1 FROM inventory WHERE account_id = ?1 AND item = ?7))
       AND (?8 = '' OR NOT EXISTS (SELECT 1 FROM inventory WHERE account_id = ?1 AND item = ?8))`
  ).bind(id, knife, sniper, gunsJson, it.id, gone[0] || '', gone[1] || '', gone[2] || '').run();
  const done = await env.DB.prepare('SELECT coins, boxes, knife, sniper, guns FROM accounts WHERE id = ?').bind(id).first() || {};
  return {
    status: 200, dupe, item: dropView(it), spent, gain: 0,
    coins: (done.coins) | 0, boxes: (done.boxes) | 0,
    knife: done.knife || null, sniper: done.sniper || null, guns: parseGuns(done.guns),
  };
}

// Equipa pistola, P90, carabina ou fuzil. '' tira a pintura. A Torresmo e a faca têm as rotas delas.
export async function equipGun(env, id, key, itemId) {
  if (!GUN_EQUIP_KEYS.includes(key)) return false;
  const clear = itemId == null || itemId === '';
  if (!clear) {
    if (gunKey(itemId) !== key) return false;
    const own = await env.DB.prepare('SELECT 1 AS x FROM inventory WHERE account_id = ? AND item = ?').bind(id, itemId).first();
    if (!own) return false;
  }
  const cur = await env.DB.prepare('SELECT guns FROM accounts WHERE id = ?').bind(id).first();
  const g = parseGuns(cur && cur.guns);
  if (clear) delete g[key]; else g[key] = itemId;
  const json = Object.keys(g).length ? JSON.stringify(g) : null;
  await env.DB.prepare('UPDATE accounts SET guns = ?2 WHERE id = ?1').bind(id, json).run();
  return g;
}

export { ITEMS };

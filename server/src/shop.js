// ============================================================
//  Loja e visual personalizado (Docoins). TUDO autoritativo aqui: saldo, ganho, compra, mochila e o que pode ser equipado.
//  O cliente só pede ("quero comprar h3", "quero usar este visual"); nunca informa saldo nem ganho.
//  Custo D1: ganho = 1 UPDATE por jogador junto do lote de estatísticas (fim de partida/saída); compra = 1 lote atômico;
//  equipar = 1 UPDATE condicional (não grava se nada mudou); mochila vai junto do /api/me (1 SELECT pequeno), sem polling.
// ============================================================
import { SKINS, skinOk } from '../../skins.js';
import { ITEMS, itemById, parseLook, lookItemIds, isFreeItem, knifeKind, sniperKind, gunKey, parseGuns, GUN_EQUIP_KEYS, EARN } from '../../shared/closet.js';
import { spDay, parseChal, applyChal, chalView } from '../../shared/challenges.js';
import { rollBox, dupeCoins, BOX_NAME, wheelInputs, rollWheel } from '../../shared/lootbox.js';

const now = () => Math.floor(Date.now() / 1000);
export const dayNow = () => Math.floor(now() / 86400);

// instrução SQL do ganho: soma `c` Docoins respeitando o teto diário (atômico, uma linha). Entra no mesmo lote do ranking.
// chal (opcional) = { old, json, reward }: desafios diários vão NO MESMO UPDATE (uma linha gravada por jogador por gravação).
// O prêmio do desafio não entra no teto diário. "chal IS old" barra pagar duas vezes se duas salas gravarem juntas.
export function coinCreditStmt(env, acct, c, chal = null) {
  c = Math.max(0, Math.min(EARN.matchCap, c | 0)); if (!c && !chal) return null;
  const day = dayNow();
  const earn = `MAX(0, MIN(?3, ?4 - (CASE WHEN earn_day = ?2 THEN earn_today ELSE 0 END)))`;
  if (!chal) return env.DB.prepare(
    `UPDATE accounts SET
       coins = coins + ${earn},
       earn_today = (CASE WHEN earn_day = ?2 THEN earn_today ELSE 0 END) + ${earn},
       earn_day = ?2
     WHERE id = ?1`).bind(acct, day, c, EARN.dayCap);
  return env.DB.prepare(
    `UPDATE accounts SET
       coins = coins + ${earn} + (CASE WHEN chal IS ?5 THEN ?6 ELSE 0 END),
       earn_today = (CASE WHEN earn_day = ?2 THEN earn_today ELSE 0 END) + ${earn},
       earn_day = ?2,
       chal = (CASE WHEN chal IS ?5 THEN ?7 ELSE chal END),
       boxes = boxes + (CASE WHEN chal IS ?5 THEN ?8 ELSE 0 END)
     WHERE id = ?1`).bind(acct, day, c, EARN.dayCap, chal.old, chal.reward | 0, chal.json, Math.max(0, Math.min(3, chal.boxes | 0)));
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
    env.DB.prepare('SELECT coins, custom, earn_day, earn_today, chal, knife, sniper, boxes, guns FROM accounts WHERE id = ?').bind(id),
    env.DB.prepare('SELECT item FROM inventory WHERE account_id = ?').bind(id),
  ]);
  const r = (a.results && a.results[0]) || { coins: 0, custom: null, earn_day: 0, earn_today: 0 };
  const items = (inv.results || []).map((x) => x.item).filter((i) => itemById(i));
  const knife = knifeKind(r.knife) && (isFreeItem(r.knife) || items.includes(r.knife)) ? r.knife : null;
  const sniper = sniperKind(r.sniper) && (isFreeItem(r.sniper) || items.includes(r.sniper)) ? r.sniper : null;
  return { coins: r.coins | 0, custom: r.custom && parseLook(r.custom) ? r.custom : null, items, knife, sniper, guns: parseGuns(r.guns), boxes: r.boxes | 0, earnToday: r.earn_day === dayNow() ? r.earn_today | 0 : 0, dayCap: EARN.dayCap, chal: chalView(id, r.chal) };
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

// Abre um caixote. O servidor sorteia. Repetida vira Docoins; skin nova entra na mochila. O débito do caixote é condicional.
export async function openBox(env, id) {
  const inv = await env.DB.prepare('SELECT item FROM inventory WHERE account_id = ?').bind(id).all();
  const owned = new Set((inv.results || []).map((x) => x.item));
  const it = rollBox(cryptoRand);
  if (!it) return { status: 500, error: 'O caixote veio vazio' };
  const dupe = owned.has(it.id);
  const gain = dupe ? dupeCoins(it.weight) : 0;
  const dec = await env.DB.prepare('UPDATE accounts SET boxes = boxes - 1, coins = coins + ?2 WHERE id = ?1 AND boxes >= 1').bind(id, gain).run();
  if (!dec.meta || !dec.meta.changes) return { status: 409, error: 'Você não tem caixote para abrir' };
  if (!dupe) {
    try {
      await env.DB.prepare('INSERT INTO inventory (account_id, item, acquired_at) VALUES (?1, ?2, ?3)').bind(id, it.id, now()).run();
    } catch (e) {
      const extra = dupeCoins(it.weight);
      await env.DB.prepare('UPDATE accounts SET coins = coins + ?2 WHERE id = ?1').bind(id, extra).run();
      const row = await env.DB.prepare('SELECT coins, boxes FROM accounts WHERE id = ?').bind(id).first();
      return { status: 200, dupe: true, item: dropView(it), coins: (row && row.coins) | 0, gain: extra, boxes: (row && row.boxes) | 0 };
    }
  }
  const row = await env.DB.prepare('SELECT coins, boxes FROM accounts WHERE id = ?').bind(id).first();
  return { status: 200, dupe, item: dropView(it), coins: (row && row.coins) | 0, gain, boxes: (row && row.boxes) | 0 };
}

// A skin equipada só sai se ela foi uma das três e não voltou como prêmio.
function wheelEquip(current, spent, prizeId, dupe) {
  if (!current || !spent.includes(current)) return current || null;
  return !dupe && current === prizeId ? current : null;
}

// Gasta 3 skins e entrega uma de peso >= o maior das três. Repetida (que não foi gasta) vira Docoins.
export async function spinWheel(env, id, ids) {
  const picked = wheelInputs(ids);
  if (!picked) return { status: 400, error: 'Escolha 3 skins diferentes da mochila' };
  const spent = picked.map((it) => it.id);
  const inv = await env.DB.prepare('SELECT item FROM inventory WHERE account_id = ?').bind(id).all();
  const owned = new Set((inv.results || []).map((x) => x.item));
  if (!spent.every((sid) => owned.has(sid))) return { status: 409, error: 'Uma dessas skins não está na mochila' };
  const it = rollWheel(picked, cryptoRand);
  if (!it) return { status: 500, error: 'A roleta veio vazia' };
  const dupe = owned.has(it.id) && !spent.includes(it.id);
  const gain = dupe ? dupeCoins(it.weight) : 0;
  const acc = await env.DB.prepare('SELECT knife, sniper, guns FROM accounts WHERE id = ?').bind(id).first();
  const guns = parseGuns(acc && acc.guns);
  for (const k of GUN_EQUIP_KEYS) if (!wheelEquip(guns[k], spent, it.id, dupe)) delete guns[k];
  const gunsJson = Object.keys(guns).length ? JSON.stringify(guns) : null;
  const knife = wheelEquip(acc && acc.knife, spent, it.id, dupe);
  const sniper = wheelEquip(acc && acc.sniper, spent, it.id, dupe);
  const del = env.DB.prepare(
    `DELETE FROM inventory WHERE account_id = ?1 AND item IN (?2, ?3, ?4)
     AND (SELECT COUNT(*) FROM inventory WHERE account_id = ?1 AND item IN (?2, ?3, ?4)) = 3`
  ).bind(id, spent[0], spent[1], spent[2]);
  let wrote;
  try {
    wrote = dupe
      ? await env.DB.batch([del, env.DB.prepare('UPDATE accounts SET coins = coins + ?2 WHERE id = ?1 AND changes() = 3').bind(id, gain)])
      : await env.DB.batch([del, env.DB.prepare('INSERT INTO inventory (account_id, item, acquired_at) SELECT ?1, ?2, ?3 WHERE changes() = 3').bind(id, it.id, now())]);
  } catch (e) {
    return { status: 409, error: 'Não deu pra girar. Tente de novo.' };
  }
  const deleted = (wrote[0].meta && wrote[0].meta.changes) | 0;
  const applied = (wrote[1].meta && wrote[1].meta.changes) | 0;
  if (deleted !== 3) return { status: 409, error: 'Uma dessas skins não está na mochila' };
  if (!dupe && !applied) {
    try { await env.DB.prepare('INSERT INTO inventory (account_id, item, acquired_at) VALUES (?1, ?2, ?3)').bind(id, it.id, now()).run(); } catch (e) { /* já entrou */ }
  } else if (dupe && !applied && gain) {
    await env.DB.prepare('UPDATE accounts SET coins = coins + ?2 WHERE id = ?1').bind(id, gain).run();
  }
  const gone = spent.filter((sid) => dupe || sid !== it.id);
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
    status: 200, dupe, item: dropView(it), spent, gain: dupe ? gain : 0,
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

// DÉCIMO PINGOU: +1000 Docoins uma vez por conta, só na janela, sem crédito duplo.
// Quem já pegou o Churrasco ou o Feriadão ainda leva esta. Sem navegador e sem wrangler.
// Uso: node test-promo.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PROMO_ID, PROMO_NAME, PROMO_COINS, PROMO_STARTS_AT, PROMO_EXPIRES_AT, PROMO_THANKS_NAME, promoActive, promoCreditText, promoGuestText } from './shared/promo.js';
import { START_COINS } from './shared/closet.js';
import { grantPromo } from './server/src/shop.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const INSIDE = Date.parse('2026-11-19T15:00:00.000Z'); // 12:00 BRT, no meio da janela
const OLD_PROMO_IDS = ['churrasco-relampago-2026-11', 'feriadao-relampago-2026-11-19'];
const grant = (env, id, t = INSIDE) => grantPromo(env, id, t);

ok(PROMO_ID === 'decimo-pingou-2026-11-19' && PROMO_NAME === 'DÉCIMO PINGOU', `promo ${PROMO_ID} / ${PROMO_NAME}`);
ok(PROMO_COINS === 1000, `crédito é 1000 Docoins (${PROMO_COINS})`);
ok(PROMO_STARTS_AT === Date.parse('2026-11-19T03:00:00.000Z'), 'abre em 19/11/2026 00:00:00.000 BRT');
ok(PROMO_EXPIRES_AT === Date.parse('2026-11-20T02:59:59.999Z'), 'fecha em 19/11/2026 23:59:59.999 BRT');
ok(!promoActive(PROMO_STARTS_AT - 1) && promoActive(PROMO_STARTS_AT), 'ainda não vale no milissegundo anterior e abre no primeiro');
ok(promoActive(INSIDE), 'vale no meio do dia 19/11 (12:00 BRT)');
ok(promoActive(PROMO_EXPIRES_AT) && !promoActive(PROMO_EXPIRES_AT + 1), 'ainda vale no último milissegundo e expira logo depois');
ok(promoActive(Date.parse('2026-11-19T23:59:59.999-03:00')), 'em 19/11 23:59 BRT ainda vale');
ok(!promoActive(Date.parse('2026-11-18T23:59:59.999-03:00')), 'em 18/11 23:59 BRT ainda não aparece nem credita');
ok(!promoActive(Date.parse('2026-11-20T00:00:00.000-03:00')), 'em 20/11 00:00 BRT já acabou');
ok(promoActive(Date.now()), 'o relógio de agora (19/11) está dentro da janela');
ok(PROMO_THANKS_NAME === 'Z' + 'z'.repeat(8) + 'u'.repeat(18) && PROMO_THANKS_NAME.length === 27, `agradecimento tem Z + 8 z + 18 u (${PROMO_THANKS_NAME})`);
ok(promoCreditText().includes('1000 Docoins') && promoCreditText().includes('13º') && promoCreditText().includes('décimo pingou') && promoCreditText().includes('só hoje, até meia-noite'), 'texto do crédito cita 1000 Docoins, o 13º e que é só hoje');
ok(promoCreditText().includes('Agradecimento especial à ' + PROMO_THANKS_NAME), 'texto do crédito agradece o nome pedido, grafia exata');
ok(promoGuestText().includes('comanda') && promoGuestText().includes('13º') && promoGuestText().includes('só hoje, até meia-noite') && promoGuestText().includes('Agradecimento especial à ' + PROMO_THANKS_NAME), 'texto do convidado pede login, cita o 13º e agradece o nome');

const migs = readdirSync(new URL('./server/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
ok(migs.includes('0009_promo_claims.sql') && migs[migs.length - 1] === '0010_inventory_qty.sql', `0009_promo_claims existe e a última migração é 0010 (${migs[migs.length - 1]}) — a promo reusa promo_claims`);
const mig = read('./server/migrations/0009_promo_claims.sql');
ok(/CREATE TABLE IF NOT EXISTS promo_claims/i.test(mig) && /PRIMARY KEY\s*\(\s*account_id\s*,\s*promo_id\s*\)/i.test(mig), '0009 cria promo_claims com chave (account_id, promo_id)');
ok(!/\b(DROP|TRUNCATE|DELETE FROM)\b/i.test(mig.replace(/--.*$/gm, '')), 'migração não apaga conta nem tabela');

function memory() {
  const db = new DatabaseSync(':memory:');
  for (const f of migs) db.exec(read('./server/migrations/' + f));
  const bound = (sql, args) => { if (!args.length) return []; if (/\?\d/.test(sql)) { const o = {}; args.forEach((v, i) => { o[i + 1] = v; }); return [o]; } return args; };
  const wrap = (sql, args = []) => ({ sql, args, bind(...a) { return wrap(sql, a); },
    async all() { return { results: db.prepare(sql).all(...bound(sql, args)) }; },
    async first() { return db.prepare(sql).get(...bound(sql, args)) || null; },
    async run() { const r = db.prepare(sql).run(...bound(sql, args)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
  const env = { DB: { prepare: (sql) => wrap(sql), async batch(list) {
    db.exec('BEGIN');
    try {
      const out = [];
      for (const s of list) {
        const st = db.prepare(s.sql);
        out.push(/^\s*SELECT/i.test(s.sql) ? { results: st.all(...bound(s.sql, s.args)) } : { meta: { changes: Number(st.run(...bound(s.sql, s.args)).changes), last_row_id: Number(st.run ? 0 : 0) } });
      }
      db.exec('COMMIT'); return out;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  } } };
  return { db, env };
}

const { db, env } = memory();
const add = (id, nick, coins) => db.prepare('INSERT INTO accounts (id, nick, nick_key, pass_hash, created_at, coins) VALUES (?, ?, ?, ?, ?, ?)').run(id, nick, nick.toLowerCase(), 'x', 1, coins);
const coins = (id) => db.prepare('SELECT coins FROM accounts WHERE id = ?').get(id).coins;
const claims = (id, promo = PROMO_ID) => db.prepare('SELECT * FROM promo_claims WHERE account_id = ? AND promo_id = ?').get(id, promo);

add(1, 'Porco', 500);
const first = await grant(env, 1);
ok(first.granted && first.coins === 1000 && first.id === PROMO_ID && first.name === PROMO_NAME, `primeira chamada credita e avisa (${JSON.stringify(first)})`);
ok(coins(1) === 1500 && claims(1) && claims(1).coins === 1000, `saldo 500→${coins(1)} e uma linha em promo_claims`);

const second = await grant(env, 1);
ok(!second.granted && !second.expired && coins(1) === 1500, 'segunda chamada não credita de novo (reload / outro aparelho)');
ok(db.prepare('SELECT COUNT(*) AS n FROM promo_claims WHERE account_id = 1').get().n === 1, 'continua uma única reclamação desta promo');

add(2, 'Leitão', 0);
const rs = await Promise.all([grant(env, 2), grant(env, 2), grant(env, 2)]);
ok(rs.filter((r) => r.granted).length === 1 && coins(2) === 1000, `3 chamadas simultâneas: só 1 passa (saldo ${coins(2)}, granted ${rs.map((r) => r.granted).join(',')})`);

add(3, 'Atrasado', 200);
const late = await grant(env, 3, PROMO_EXPIRES_AT + 1);
ok(late.expired && !late.granted && coins(3) === 200 && !claims(3), 'depois do prazo não credita e não marca a conta');

add(4, 'Em cima', 10);
const lastTick = await grant(env, 4, PROMO_EXPIRES_AT);
ok(lastTick.granted && coins(4) === 1010, 'no último milissegundo ainda credita');

add(6, 'Ansioso', 200);
const early = await grant(env, 6, PROMO_STARTS_AT - 1);
ok((early.expired || early.granted === false) && !early.granted && coins(6) === 200 && !claims(6), 'antes do início não credita e não marca a conta');
const firstTick = await grant(env, 6, PROMO_STARTS_AT);
ok(firstTick.granted && coins(6) === 1200 && claims(6), 'no primeiro milissegundo da janela já credita');

add(5, 'Veterano', 500);
for (const oldId of OLD_PROMO_IDS) db.prepare('INSERT INTO promo_claims (account_id, promo_id, coins, claimed_at) VALUES (?, ?, ?, ?)').run(5, oldId, 1000, 1);
ok(OLD_PROMO_IDS.every((id) => claims(5, id)) && !claims(5), 'Veterano já pegou o Churrasco e o Feriadão e ainda não o DÉCIMO PINGOU');
const afterOld = await grant(env, 5);
ok(afterOld.granted && afterOld.id === PROMO_ID && coins(5) === 1500, 'quem já pegou o Churrasco e o Feriadão ainda leva o DÉCIMO PINGOU');
ok(db.prepare('SELECT COUNT(*) AS n FROM promo_claims WHERE account_id = 5').get().n === 3, 'três reclamações (promos diferentes) na mesma conta');
const afterOld2 = await grant(env, 5);
ok(!afterOld2.granted && coins(5) === 1500, 'segunda chamada do DÉCIMO PINGOU não soma de novo, mesmo com as promos antigas na tabela');

// /api/me: conta nova ganha a promo na primeira leitura, e só nela (relógio fingido dentro da janela)
const { db: live, env: envMe } = memory();
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const req = (method, path, body, token) => new Request('https://docao.test' + path, { method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
const { handleAccountRoute } = await import('./server/src/auth.js');
const realNow = Date.now;
Date.now = () => INSIDE;
try {
  const reg = await handleAccountRoute(req('POST', '/api/auth/register', { nick: 'Churras', password: 'senha-forte-123' }), envMe, new URL('https://docao.test/api/auth/register'), json);
  const regBody = await reg.json();
  const row = live.prepare('SELECT coins FROM accounts WHERE nick = ?').get('Churras');
  ok(reg.status === 201 && regBody.account.coins === START_COINS && row.coins === START_COINS, `cadastro ainda nasce com ${START_COINS} (a promo entra no /api/me)`);
  const me1 = await handleAccountRoute(req('GET', '/api/me', null, regBody.token), envMe, new URL('https://docao.test/api/me'), json);
  const b1 = await me1.json();
  ok(me1.status === 200 && b1.promoGrant && b1.promoGrant.granted && b1.account.coins === START_COINS + PROMO_COINS, `/api/me credita e devolve promoGrant (saldo ${b1.account && b1.account.coins})`);
  const me2 = await handleAccountRoute(req('GET', '/api/me', null, regBody.token), envMe, new URL('https://docao.test/api/me'), json);
  const b2 = await me2.json();
  ok(me2.status === 200 && b2.promoGrant && !b2.promoGrant.granted && b2.account.coins === START_COINS + PROMO_COINS, 'segunda leitura: saldo igual, promoGrant.granted falso');

  // /api/me antes da janela: não credita
  Date.now = () => PROMO_STARTS_AT - 1;
  const { db: earlyDb, env: envEarly } = memory();
  const regEarly = await handleAccountRoute(req('POST', '/api/auth/register', { nick: 'Cedo', password: 'senha-forte-123' }), envEarly, new URL('https://docao.test/api/auth/register'), json);
  const tokEarly = (await regEarly.json()).token;
  const meEarly = await handleAccountRoute(req('GET', '/api/me', null, tokEarly), envEarly, new URL('https://docao.test/api/me'), json);
  const bEarly = await meEarly.json();
  ok(meEarly.status === 200 && bEarly.account.coins === START_COINS && bEarly.promoGrant && !bEarly.promoGrant.granted, `antes da janela o /api/me não credita (saldo ${bEarly.account && bEarly.account.coins})`);
  ok(!earlyDb.prepare('SELECT * FROM promo_claims WHERE promo_id = ?').get(PROMO_ID), 'antes da janela não grava reclamação');

  Date.now = () => INSIDE;
  // sem a tabela (migração ainda não aplicada): /api/me não quebra, mesmo com a promo ativa
  const bare = new DatabaseSync(':memory:');
  for (const f of migs.filter((f) => f !== '0009_promo_claims.sql')) bare.exec(read('./server/migrations/' + f));
  const bound = (sql, args) => { if (!args.length) return []; if (/\?\d/.test(sql)) { const o = {}; args.forEach((v, i) => { o[i + 1] = v; }); return [o]; } return args; };
  const wrap = (sql, args = []) => ({ sql, args, bind(...a) { return wrap(sql, a); },
    async all() { return { results: bare.prepare(sql).all(...bound(sql, args)) }; },
    async first() { return bare.prepare(sql).get(...bound(sql, args)) || null; },
    async run() { const r = bare.prepare(sql).run(...bound(sql, args)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
  const envBare = { DB: { prepare: (sql) => wrap(sql), async batch(list) {
    bare.exec('BEGIN');
    try {
      const out = [];
      for (const s of list) {
        const st = bare.prepare(s.sql);
        out.push(/^\s*SELECT/i.test(s.sql) ? { results: st.all(...bound(s.sql, s.args)) } : { meta: { changes: Number(st.run(...bound(s.sql, s.args)).changes) } });
      }
      bare.exec('COMMIT'); return out;
    } catch (e) { bare.exec('ROLLBACK'); throw e; }
  } } };
  const reg2 = await handleAccountRoute(req('POST', '/api/auth/register', { nick: 'SemMig', password: 'senha-forte-123' }), envBare, new URL('https://docao.test/api/auth/register'), json);
  const tok2 = (await reg2.json()).token;
  const meBare = await handleAccountRoute(req('GET', '/api/me', null, tok2), envBare, new URL('https://docao.test/api/me'), json);
  const bBare = await meBare.json();
  ok(meBare.status === 200 && bBare.account.coins === START_COINS && bBare.promoGrant && !bBare.promoGrant.granted, `sem migração 0009 o /api/me segue e não credita (status ${meBare.status}, saldo ${bBare.account && bBare.account.coins})`);
} finally {
  Date.now = realNow;
}

// cliente: convidado não tem carteira local; o popup de login e o de crédito existem na UI
const ui = read('./account-ui.js'), html = read('./index.html');
ok(ui.includes('onPromoGrant') && ui.includes('showPromoGuestOnce') && ui.includes('promoCreditHtml') && ui.includes('promoGuestHtml'), 'account-ui abre o popup no crédito e convida quem não está logado');
ok(html.includes('id="promoModal"') && html.includes('id="promoOk"') && html.includes('id="promoSkip"') && html.includes('DÉCIMO PINGOU'), 'index.html tem o modal da promoção com o título DÉCIMO PINGOU');
const css = read('./style.css');
ok(css.includes('.promo-thanks') && /overflow-wrap\s*:\s*anywhere/.test(css) && /word-break\s*:\s*break-word/.test(css), 'CSS quebra o nome longo no popup (overflow-wrap/word-break)');


console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

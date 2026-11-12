// Churrasco Relâmpago: +1000 Docoins uma vez por conta, no prazo, sem crédito duplo.
// Sem navegador e sem wrangler. Uso: node test-promo.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PROMO_ID, PROMO_NAME, PROMO_COINS, PROMO_EXPIRES_AT, promoActive, promoCreditText, promoGuestText } from './shared/promo.js';
import { START_COINS } from './shared/closet.js';
import { grantPromo } from './server/src/shop.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

ok(PROMO_ID === 'churrasco-relampago-2026-11' && PROMO_NAME === 'Churrasco Relâmpago', `promo ${PROMO_ID} / ${PROMO_NAME}`);
ok(PROMO_COINS === 1000, `crédito é 1000 Docoins (${PROMO_COINS})`);
ok(PROMO_EXPIRES_AT === Date.parse('2026-11-13T02:59:59.999Z'), 'validade é 12/11/2026 23:59:59.999 BRT');
ok(promoActive(PROMO_EXPIRES_AT) && !promoActive(PROMO_EXPIRES_AT + 1), 'ainda vale no último milissegundo e expira logo depois');
ok(promoCreditText().includes('1000 Docoins') && promoCreditText().includes('Porca Véia') && promoCreditText().includes('só hoje, até meia-noite'), 'texto do crédito cita 1000 Docoins, a Porca Véia e que é só hoje');
ok(promoGuestText().includes('comanda') && promoGuestText().includes('só hoje, até meia-noite'), 'texto do convidado pede login e cita que é só hoje');

const migs = readdirSync(new URL('./server/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
ok(migs.includes('0009_promo_claims.sql') && migs[migs.length - 1] === '0009_promo_claims.sql', `migração 0009 é a última (${migs[migs.length - 1]})`);
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
const claims = (id) => db.prepare('SELECT * FROM promo_claims WHERE account_id = ? AND promo_id = ?').get(id, PROMO_ID);

add(1, 'Porco', 500);
const first = await grantPromo(env, 1);
ok(first.granted && first.coins === 1000 && first.id === PROMO_ID && first.name === PROMO_NAME, `primeira chamada credita e avisa (${JSON.stringify(first)})`);
ok(coins(1) === 1500 && claims(1) && claims(1).coins === 1000, `saldo 500→${coins(1)} e uma linha em promo_claims`);

const second = await grantPromo(env, 1);
ok(!second.granted && !second.expired && coins(1) === 1500, 'segunda chamada não credita de novo (reload / outro aparelho)');
ok(db.prepare('SELECT COUNT(*) AS n FROM promo_claims WHERE account_id = 1').get().n === 1, 'continua uma única reclamação da promo');

add(2, 'Leitão', 0);
const rs = await Promise.all([grantPromo(env, 2), grantPromo(env, 2), grantPromo(env, 2)]);
ok(rs.filter((r) => r.granted).length === 1 && coins(2) === 1000, `3 chamadas simultâneas: só 1 passa (saldo ${coins(2)}, granted ${rs.map((r) => r.granted).join(',')})`);

add(3, 'Atrasado', 200);
const late = await grantPromo(env, 3, PROMO_EXPIRES_AT + 1);
ok(late.expired && !late.granted && coins(3) === 200 && !claims(3), 'depois do prazo não credita e não marca a conta');

add(4, 'Em cima', 10);
const lastTick = await grantPromo(env, 4, PROMO_EXPIRES_AT);
ok(lastTick.granted && coins(4) === 1010, 'no último milissegundo ainda credita');

// /api/me: conta nova ganha a promo na primeira leitura, e só nela
const { db: live, env: envMe } = memory();
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const req = (method, path, body, token) => new Request('https://docao.test' + path, { method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
const { handleAccountRoute } = await import('./server/src/auth.js');
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

// sem a tabela (migração ainda não aplicada): /api/me não quebra
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

// cliente: convidado não tem carteira local; o popup de login e o de crédito existem na UI
const ui = read('./account-ui.js'), html = read('./index.html');
ok(ui.includes('onPromoGrant') && ui.includes('showPromoGuestOnce') && ui.includes('promoCreditHtml') && ui.includes('promoGuestHtml'), 'account-ui abre o popup no crédito e convida quem não está logado');
ok(html.includes('id="promoModal"') && html.includes('id="promoOk"') && html.includes('id="promoSkip"'), 'index.html tem o modal da promoção com fechar e pular');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

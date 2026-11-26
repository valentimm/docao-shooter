// INTEGRA: +500 Docoins e +5 caixotes uma vez por conta, só na janela, sem crédito duplo.
// Quem já pegou o Churrasco, o Feriadão ou o DÉCIMO PINGOU ainda leva esta. Sem navegador e sem wrangler.
// Uso: node test-promo.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PROMO_ID, PROMO_NAME, PROMO_COINS, PROMO_BOXES, PROMO_CONFIG_ID, PROMO_STARTS_AT, PROMO_EXPIRES_AT, PROMO_STARTS_AT_ISO, PROMO_EXPIRES_AT_ISO, promoActive, promoCreditText, promoGuestText, promoUntilLabel, promoFromConfig, publicPromo } from './shared/promo.js';
import { START_COINS } from './shared/closet.js';
import { grantPromo, getPromoState, clearPromoConfigCache, PROMO_CACHE_MS } from './server/src/shop.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const INSIDE = Date.parse('2026-11-27T15:00:00.000Z'); // 12:00 BRT, no meio da janela
const OLD_PROMO_IDS = ['churrasco-relampago-2026-11', 'feriadao-relampago-2026-11-19', 'decimo-pingou-2026-11-19'];
const grant = (env, id, t = INSIDE) => grantPromo(env, id, t);

ok(PROMO_ID === 'integra-2026-2027' && PROMO_NAME === 'INTEGRA', `promo ${PROMO_ID} / ${PROMO_NAME}`);
ok(PROMO_COINS === 500, `crédito é 500 Docoins (${PROMO_COINS})`);
ok(PROMO_BOXES === 5, `crédito é 5 caixotes (${PROMO_BOXES})`);
ok(PROMO_CONFIG_ID === 'integra', 'linha da config no banco é integra');
ok(PROMO_STARTS_AT_ISO === '2026-11-25T00:00:00.000-03:00' && PROMO_EXPIRES_AT_ISO === '2026-11-29T23:59:59.999-03:00', 'datas padrão em ISO com offset -03:00');
ok(PROMO_STARTS_AT === Date.parse('2026-11-25T03:00:00.000Z') && PROMO_STARTS_AT === Date.parse(PROMO_STARTS_AT_ISO), 'abre em 25/11/2026 00:00:00.000 BRT');
ok(PROMO_EXPIRES_AT === Date.parse('2026-11-30T02:59:59.999Z') && PROMO_EXPIRES_AT === Date.parse(PROMO_EXPIRES_AT_ISO), 'fecha em 29/11/2026 23:59:59.999 BRT');
ok(!promoActive(PROMO_STARTS_AT - 1) && promoActive(PROMO_STARTS_AT), 'ainda não vale no milissegundo anterior e abre no primeiro');
ok(promoActive(INSIDE), 'vale no meio da janela (27/11 12:00 BRT)');
ok(promoActive(PROMO_EXPIRES_AT) && !promoActive(PROMO_EXPIRES_AT + 1), 'ainda vale no último milissegundo e expira logo depois');
ok(promoActive(Date.parse('2026-11-25T00:00:00.000-03:00')), 'em 25/11/2026 00:00 BRT já vale');
ok(!promoActive(Date.parse('2026-11-24T23:59:59.999-03:00')), 'em 24/11/2026 23:59 BRT ainda não aparece nem credita');
ok(promoActive(Date.parse('2026-11-29T23:59:59.999-03:00')), 'em 29/11/2026 23:59 BRT ainda vale');
ok(!promoActive(Date.parse('2026-11-30T00:00:00.000-03:00')), 'em 30/11/2026 00:00 BRT já acabou');
ok(promoActive(Date.now()), 'o relógio de agora está dentro da janela');
ok(promoUntilLabel() === '29 de novembro de 2026', `rótulo do prazo é 29 de novembro de 2026 (${promoUntilLabel()})`);
ok(promoCreditText().includes('500 Docoins') && promoCreditText().includes('5 caixotes') && promoCreditText().includes('Integra') && promoCreditText().includes('até 29 de novembro de 2026'), 'texto do crédito cita 500 Docoins, 5 caixotes, o Integra e o prazo');
ok(promoGuestText().includes('comanda') && promoGuestText().includes('500 Docoins') && promoGuestText().includes('5 caixotes') && promoGuestText().includes('Integra') && promoGuestText().includes('até 29 de novembro de 2026'), 'texto do convidado pede login, cita o prêmio e o prazo');

{
  const off = promoFromConfig(null, INSIDE);
  ok(!off.enabled && !off.active && off.source === 'fallback' && off.startsAt === PROMO_STARTS_AT && off.expiresAt === PROMO_EXPIRES_AT, 'sem linha no banco: janela padrão, desligada');
  const on = promoFromConfig({ enabled: 1, starts_at: PROMO_STARTS_AT_ISO, expires_at: PROMO_EXPIRES_AT_ISO }, INSIDE);
  ok(on.enabled && on.active && on.source === 'db', 'enabled=1 e relógio na janela: ativa');
  const closed = promoFromConfig({ enabled: 1, starts_at: PROMO_STARTS_AT_ISO, expires_at: PROMO_EXPIRES_AT_ISO }, PROMO_EXPIRES_AT + 1);
  ok(closed.enabled && !closed.active, 'enabled=1 depois do prazo: não está ativa');
  const pub = publicPromo(off);
  ok(pub.active === false && pub.enabled === false && pub.startsAtIso === PROMO_STARTS_AT_ISO && !('source' in pub), 'publicPromo expõe a janela sem campos internos');
}

const migs = readdirSync(new URL('./server/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
ok(migs.includes('0009_promo_claims.sql') && migs.includes('0013_pocilga.sql') && migs.includes('0014_promo_config.sql') && migs[migs.length - 1] === '0014_promo_config.sql', `0009 e 0014 existem, a última migração é 0014 (${migs[migs.length - 1]})`);
const mig = read('./server/migrations/0009_promo_claims.sql');
ok(/CREATE TABLE IF NOT EXISTS promo_claims/i.test(mig) && /PRIMARY KEY\s*\(\s*account_id\s*,\s*promo_id\s*\)/i.test(mig), '0009 cria promo_claims com chave (account_id, promo_id)');
ok(!/\b(DROP|TRUNCATE|DELETE FROM)\b/i.test(mig.replace(/--.*$/gm, '')), 'migração 0009 não apaga conta nem tabela');
const migCfg = read('./server/migrations/0014_promo_config.sql');
ok(/CREATE TABLE IF NOT EXISTS promo_config/i.test(migCfg) && /promo_id TEXT PRIMARY KEY/i.test(migCfg) && /starts_at TEXT/i.test(migCfg) && /expires_at TEXT/i.test(migCfg), '0014 cria promo_config (promo_id, enabled, starts_at, expires_at)');
ok(/INSERT OR IGNORE INTO promo_config/i.test(migCfg) && /'integra'/i.test(migCfg) && /2026-11-25T00:00:00\.000-03:00/i.test(migCfg) && /2026-11-29T23:59:59\.999-03:00/i.test(migCfg), '0014 semeia a linha integra com as datas ISO em Brasília');
ok(/enabled[\s\S]{0,40}0/.test(migCfg) && !/enabled[\s,\)]{0,20}1/.test(migCfg.split('VALUES')[1] || ''), 'seed da Integra nasce desligada (enabled=0)');
ok(!/\b(DROP|TRUNCATE|DELETE FROM)\b/i.test(migCfg.replace(/--.*$/gm, '')), 'migração 0014 não apaga conta nem tabela');
ok(PROMO_CACHE_MS === 45_000, 'cache da config dura 45 s');

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
const add = (id, nick, coins, boxes = 0) => db.prepare('INSERT INTO accounts (id, nick, nick_key, pass_hash, created_at, coins, boxes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, nick, nick.toLowerCase(), 'x', 1, coins, boxes);
const coins = (id) => db.prepare('SELECT coins FROM accounts WHERE id = ?').get(id).coins;
const boxesOf = (id) => db.prepare('SELECT boxes FROM accounts WHERE id = ?').get(id).boxes;
const claims = (id, promo = PROMO_ID) => db.prepare('SELECT * FROM promo_claims WHERE account_id = ? AND promo_id = ?').get(id, promo);

const setPromo = (d, enabled = 1, starts = PROMO_STARTS_AT_ISO, expires = PROMO_EXPIRES_AT_ISO) => {
  d.prepare('UPDATE promo_config SET enabled = ?, starts_at = ?, expires_at = ? WHERE promo_id = ?').run(enabled, starts, expires, PROMO_CONFIG_ID);
  clearPromoConfigCache();
};

const seed = db.prepare('SELECT * FROM promo_config WHERE promo_id = ?').get(PROMO_CONFIG_ID);
ok(seed && seed.enabled === 0 && seed.starts_at === PROMO_STARTS_AT_ISO && seed.expires_at === PROMO_EXPIRES_AT_ISO, `seed da Integra no banco: desligada, janela atual (${seed && seed.starts_at} → ${seed && seed.expires_at})`);

add(1, 'Porco', 500, 2);
const offGrant = await grant(env, 1);
ok(!offGrant.granted && offGrant.expired && coins(1) === 500 && boxesOf(1) === 2 && !claims(1), 'com enabled=0, mesmo dentro da janela, não credita');
const offState = await getPromoState(env, INSIDE);
ok(!offState.active && !offState.enabled && offState.source === 'db' && offState.startsAt === PROMO_STARTS_AT, 'getPromoState lê o banco e vê desligada');

const { handleAccountRoute } = await import('./server/src/auth.js');
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const req = (method, path, body, token) => new Request('https://docao.test' + path, { method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
const promoRes = await handleAccountRoute(req('GET', '/api/promo'), env, new URL('https://docao.test/api/promo'), json);
const promoBody = await promoRes.json();
ok(promoRes.status === 200 && promoBody.ok && promoBody.promo && promoBody.promo.active === false && promoBody.promo.enabled === false && promoBody.promo.startsAtIso === PROMO_STARTS_AT_ISO, `/api/promo reflete a promo desligada (${promoRes.status})`);

db.prepare('DELETE FROM promo_config WHERE promo_id = ?').run(PROMO_CONFIG_ID);
clearPromoConfigCache();
const fb = await getPromoState(env, INSIDE);
ok(!fb.active && !fb.enabled && fb.source === 'fallback' && fb.startsAt === PROMO_STARTS_AT, 'sem a linha no banco, cai no fallback desligado');
const fbGrant = await grant(env, 1, INSIDE);
ok(!fbGrant.granted && coins(1) === 500 && !claims(1), 'fallback desligado não credita');
db.prepare('INSERT INTO promo_config (promo_id, enabled, starts_at, expires_at) VALUES (?, 0, ?, ?)').run(PROMO_CONFIG_ID, PROMO_STARTS_AT_ISO, PROMO_EXPIRES_AT_ISO);
clearPromoConfigCache();
await getPromoState(env, INSIDE);
db.prepare('UPDATE promo_config SET enabled = 1 WHERE promo_id = ?').run(PROMO_CONFIG_ID);
const cached = await getPromoState(env, INSIDE);
ok(!cached.active, 'cache de 45 s ainda vê a promo desligada depois de ligar no banco');
clearPromoConfigCache();
const fresh = await getPromoState(env, INSIDE);
ok(fresh.active && fresh.enabled, 'sem o cache, a promo ligada aparece na hora');

setPromo(db, 1);
const first = await grant(env, 1);
ok(first.granted && first.coins === 500 && first.boxes === 5 && first.id === PROMO_ID && first.name === PROMO_NAME, `primeira chamada credita e avisa (${JSON.stringify(first)})`);
ok(coins(1) === 1000 && boxesOf(1) === 7 && claims(1) && claims(1).coins === 500, `saldo 500→${coins(1)}, caixotes 2→${boxesOf(1)} e uma linha em promo_claims`);

const second = await grant(env, 1);
ok(!second.granted && !second.expired && coins(1) === 1000 && boxesOf(1) === 7, 'segunda chamada não credita de novo (reload / outro aparelho)');
ok(db.prepare('SELECT COUNT(*) AS n FROM promo_claims WHERE account_id = 1').get().n === 1, 'continua uma única reclamação desta promo');

add(2, 'Leitão', 0);
const rs = await Promise.all([grant(env, 2), grant(env, 2), grant(env, 2)]);
ok(rs.filter((r) => r.granted).length === 1 && coins(2) === 500 && boxesOf(2) === 5, `3 chamadas simultâneas: só 1 passa (saldo ${coins(2)}, caixotes ${boxesOf(2)}, granted ${rs.map((r) => r.granted).join(',')})`);

add(3, 'Atrasado', 200, 1);
const late = await grant(env, 3, PROMO_EXPIRES_AT + 1);
ok(late.expired && !late.granted && coins(3) === 200 && boxesOf(3) === 1 && !claims(3), 'depois do prazo não credita e não marca a conta');

add(4, 'Em cima', 10, 0);
const lastTick = await grant(env, 4, PROMO_EXPIRES_AT);
ok(lastTick.granted && coins(4) === 510 && boxesOf(4) === 5, 'no último milissegundo ainda credita moedas e caixotes');

add(6, 'Ansioso', 200, 0);
const early = await grant(env, 6, PROMO_STARTS_AT - 1);
ok((early.expired || early.granted === false) && !early.granted && coins(6) === 200 && boxesOf(6) === 0 && !claims(6), 'antes do início não credita e não marca a conta');
const firstTick = await grant(env, 6, PROMO_STARTS_AT);
ok(firstTick.granted && coins(6) === 700 && boxesOf(6) === 5 && claims(6), 'no primeiro milissegundo da janela já credita');

add(5, 'Veterano', 500, 3);
for (const oldId of OLD_PROMO_IDS) db.prepare('INSERT INTO promo_claims (account_id, promo_id, coins, claimed_at) VALUES (?, ?, ?, ?)').run(5, oldId, 1000, 1);
ok(OLD_PROMO_IDS.every((id) => claims(5, id)) && !claims(5), 'Veterano já pegou o Churrasco, o Feriadão e o DÉCIMO PINGOU e ainda não o INTEGRA');
const afterOld = await grant(env, 5);
ok(afterOld.granted && afterOld.id === PROMO_ID && coins(5) === 1000 && boxesOf(5) === 8, 'quem já pegou as promos antigas ainda leva o INTEGRA (500 moedas + 5 caixotes)');
ok(db.prepare('SELECT COUNT(*) AS n FROM promo_claims WHERE account_id = 5').get().n === 4, 'quatro reclamações (promos diferentes) na mesma conta');
const afterOld2 = await grant(env, 5);
ok(!afterOld2.granted && coins(5) === 1000 && boxesOf(5) === 8, 'segunda chamada do INTEGRA não soma de novo, mesmo com as promos antigas na tabela');

// /api/me: conta nova ganha a promo na primeira leitura, e só nela (relógio fingido dentro da janela)
const { db: live, env: envMe } = memory();
setPromo(live, 1);
const realNow = Date.now;
Date.now = () => INSIDE;
try {
  const reg = await handleAccountRoute(req('POST', '/api/auth/register', { nick: 'Churras', password: 'senha-forte-123' }), envMe, new URL('https://docao.test/api/auth/register'), json);
  const regBody = await reg.json();
  const row = live.prepare('SELECT coins, boxes FROM accounts WHERE nick = ?').get('Churras');
  ok(reg.status === 201 && regBody.account.coins === START_COINS && row.coins === START_COINS && (row.boxes | 0) === 0, `cadastro ainda nasce com ${START_COINS} e 0 caixotes (a promo entra no /api/me)`);
  const me1 = await handleAccountRoute(req('GET', '/api/me', null, regBody.token), envMe, new URL('https://docao.test/api/me'), json);
  const b1 = await me1.json();
  // /api/me também entrega o caixote diário de login (+1), além dos 5 da promo
  ok(me1.status === 200 && b1.promoGrant && b1.promoGrant.granted && b1.promoGrant.boxes === 5 && b1.account.coins === START_COINS + PROMO_COINS && b1.account.boxes === 1 + PROMO_BOXES, `/api/me credita promo + caixote do dia (saldo ${b1.account && b1.account.coins}, caixotes ${b1.account && b1.account.boxes})`);
  const me2 = await handleAccountRoute(req('GET', '/api/me', null, regBody.token), envMe, new URL('https://docao.test/api/me'), json);
  const b2 = await me2.json();
  ok(me2.status === 200 && b2.promoGrant && !b2.promoGrant.granted && b2.account.coins === START_COINS + PROMO_COINS && b2.account.boxes === 1 + PROMO_BOXES, 'segunda leitura: saldo e caixotes iguais, promoGrant.granted falso');
  ok(b1.promo && b1.promo.active && b2.promo && b2.promo.active, '/api/me também devolve o estado da promo (ativa)');
  const livePromo = await handleAccountRoute(req('GET', '/api/promo'), envMe, new URL('https://docao.test/api/promo'), json);
  const livePromoBody = await livePromo.json();
  ok(livePromo.status === 200 && livePromoBody.promo && livePromoBody.promo.active === true, '/api/promo vê a promo ligada na janela');

  // /api/me antes da janela: não credita a promo (o caixote diário segue normal)
  Date.now = () => PROMO_STARTS_AT - 1;
  const { db: earlyDb, env: envEarly } = memory();
  setPromo(earlyDb, 1);
  const regEarly = await handleAccountRoute(req('POST', '/api/auth/register', { nick: 'Cedo', password: 'senha-forte-123' }), envEarly, new URL('https://docao.test/api/auth/register'), json);
  const tokEarly = (await regEarly.json()).token;
  const meEarly = await handleAccountRoute(req('GET', '/api/me', null, tokEarly), envEarly, new URL('https://docao.test/api/me'), json);
  const bEarly = await meEarly.json();
  ok(meEarly.status === 200 && bEarly.account.coins === START_COINS && bEarly.account.boxes === 1 && bEarly.promoGrant && !bEarly.promoGrant.granted, `antes da janela o /api/me não credita a promo (saldo ${bEarly.account && bEarly.account.coins}, caixotes ${bEarly.account && bEarly.account.boxes})`);
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

  // sem a 0014: cai no fallback desligado e não credita, mesmo dentro da janela
  const noCfg = new DatabaseSync(':memory:');
  for (const f of migs.filter((f) => f !== '0014_promo_config.sql')) noCfg.exec(read('./server/migrations/' + f));
  const wrapCfg = (sql, args = []) => ({ sql, args, bind(...a) { return wrapCfg(sql, a); },
    async all() { return { results: noCfg.prepare(sql).all(...bound(sql, args)) }; },
    async first() { return noCfg.prepare(sql).get(...bound(sql, args)) || null; },
    async run() { const r = noCfg.prepare(sql).run(...bound(sql, args)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
  const envNoCfg = { DB: { prepare: (sql) => wrapCfg(sql), async batch(list) {
    noCfg.exec('BEGIN');
    try {
      const out = [];
      for (const s of list) {
        const st = noCfg.prepare(s.sql);
        out.push(/^\s*SELECT/i.test(s.sql) ? { results: st.all(...bound(s.sql, s.args)) } : { meta: { changes: Number(st.run(...bound(s.sql, s.args)).changes) } });
      }
      noCfg.exec('COMMIT'); return out;
    } catch (e) { noCfg.exec('ROLLBACK'); throw e; }
  } } };
  clearPromoConfigCache();
  const stNoCfg = await getPromoState(envNoCfg, INSIDE);
  ok(!stNoCfg.active && !stNoCfg.enabled && stNoCfg.source === 'fallback', 'sem a tabela promo_config, fallback desligado');
  const regNoCfg = await handleAccountRoute(req('POST', '/api/auth/register', { nick: 'SemCfg', password: 'senha-forte-123' }), envNoCfg, new URL('https://docao.test/api/auth/register'), json);
  const tokNoCfg = (await regNoCfg.json()).token;
  const meNoCfg = await handleAccountRoute(req('GET', '/api/me', null, tokNoCfg), envNoCfg, new URL('https://docao.test/api/me'), json);
  const bNoCfg = await meNoCfg.json();
  ok(meNoCfg.status === 200 && bNoCfg.promo && bNoCfg.promo.active === false && bNoCfg.account.coins === START_COINS && bNoCfg.promoGrant && !bNoCfg.promoGrant.granted, `sem migração 0014 o /api/me segue e não credita (status ${meNoCfg.status})`);
} finally {
  Date.now = realNow;
}

// cliente: convidado não tem carteira local; o popup de login e o de crédito existem na UI
const ui = read('./account-ui.js'), html = read('./index.html');
ok(ui.includes('onPromoGrant') && ui.includes('showPromoGuestOnce') && ui.includes('loadPromo') && ui.includes('p.active') && ui.includes('promoCreditHtml') && ui.includes('promoGuestHtml') && ui.includes('PROMO_BOXES'), 'account-ui abre o popup no crédito, consulta /api/promo e convida quem não está logado');
ok(html.includes('id="promoModal"') && html.includes('id="promoOk"') && html.includes('id="promoSkip"') && html.includes('INTEGRA'), 'index.html tem o modal da promoção com o título INTEGRA');
const css = read('./style.css');
ok(css.includes('.promo-reward') && css.includes('.promo-coins') && /display\s*:\s*flex/.test(css), 'CSS coloca Docoins e caixotes lado a lado no popup');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

// Saldo inicial de Docoin (sem navegador, sem wrangler): conta nova nasce com START_COINS;
// a migração 0004 soma o mesmo valor uma vez em cada conta que já existia, sem zerar o que tinha.
// Uso: node test-saldo-inicial.mjs
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { START_COINS } from './shared/closet.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

ok(START_COINS === 500, `saldo inicial é 500 Docoin (${START_COINS})`);

const mig = read('./server/migrations/0004_saldo_inicial.sql');
const stmt = mig.replace(/--.*$/gm, '').trim();
ok(/^UPDATE\s+accounts\s+SET\s+coins\s*=\s*coins\s*\+\s*500\s*;?$/i.test(stmt), 'migração 0004 só soma 500 ao saldo (não reescreve)');
ok(!/\b(DELETE|DROP|TRUNCATE)\b/i.test(stmt), 'migração não apaga conta nem tabela');

const auth = read('./server/src/auth.js');
ok(/INSERT INTO accounts \(nick, nick_key, pass_hash, created_at, coins\)/.test(auth) && /START_COINS/.test(auth), 'cadastro grava coins com START_COINS');

const db = new DatabaseSync(':memory:');
for (const f of ['0001_contas.sql', '0002_loja.sql', '0003_desafios.sql']) db.exec(read('./server/migrations/' + f));
const ins = db.prepare('INSERT INTO accounts (nick, nick_key, pass_hash, created_at, coins) VALUES (?, ?, ?, ?, ?)');
ins.run('Velha', 'velha', 'x', 1, 0);
ins.run('Rica', 'rica', 'x', 1, 120);
db.exec(mig);
const coins = (nick) => db.prepare('SELECT coins FROM accounts WHERE nick = ?').get(nick).coins;
ok(coins('Velha') === START_COINS && coins('Rica') === 120 + START_COINS, `contas existentes: 0→${coins('Velha')} e 120→${coins('Rica')} (soma, saldo anterior fica)`);

ins.run('Nova', 'nova', 'x', 2, START_COINS);
ok(coins('Nova') === START_COINS && coins('Rica') === 620, `conta criada depois da migração fica em ${coins('Nova')} e a antiga não ganha de novo`);

// cadastro de verdade (PBKDF2 + D1 falso): o INSERT do Worker grava 500, e a migração já aplicada não soma de novo
const live = new DatabaseSync(':memory:');
for (const f of ['0001_contas.sql', '0002_loja.sql', '0003_desafios.sql', '0004_saldo_inicial.sql', '0005_faca.sql']) live.exec(read('./server/migrations/' + f));
const wrap = (sql, args = []) => ({ sql, args, bind(...a) { return wrap(sql, a); },
  async all() { return { results: live.prepare(sql).all(...args) }; },
  async first() { return live.prepare(sql).get(...args) || null; },
  async run() { const r = live.prepare(sql).run(...args); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
const env = { DB: { prepare: (sql) => wrap(sql), async batch(list) {
  live.exec('BEGIN');
  try {
    const out = [];
    for (const s of list) {
      const st = live.prepare(s.sql);
      if (/^\s*SELECT/i.test(s.sql)) out.push({ results: st.all(...s.args) });
      else { const r = st.run(...s.args); out.push({ meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }); }
    }
    live.exec('COMMIT'); return out;
  } catch (e) { live.exec('ROLLBACK'); throw e; }
} } };
const { handleAccountRoute } = await import('./server/src/auth.js');
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const req = (method, path, body, token) => new Request('https://docao.test' + path, { method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.8', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
const reg = await handleAccountRoute(req('POST', '/api/auth/register', { nick: 'Leitão', password: 'senha-forte-123' }), env, new URL('https://docao.test/api/auth/register'), json);
const regBody = await reg.json();
const row = live.prepare('SELECT coins FROM accounts WHERE nick = ?').get('Leitão');
ok(reg.status === 201 && regBody.account.coins === START_COINS && row.coins === START_COINS, `cadastro devolve e grava ${row && row.coins} Docoins`);
const me = await handleAccountRoute(req('GET', '/api/me', null, regBody.token), env, new URL('https://docao.test/api/me'), json);
const meBody = await me.json();
ok(me.status === 200 && meBody.account.coins === START_COINS, `/api/me da conta nova traz ${meBody.account && meBody.account.coins} Docoins`);

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

// Compra de caixote: 400 Docoins, no máximo 1 por dia de Brasília, sem comer o caixote grátis.
// Uso: node test-caixa-compra.mjs
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { BOX_PRICE } from './shared/lootbox.js';
import { spDay } from './shared/challenges.js';
import { buyBox, grantLoginBox, wallet } from './server/src/shop.js';

const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
ok(BOX_PRICE === 400, 'o caixote comprado custa 400 Docoins');

const db = new DatabaseSync(':memory:');
for (const f of ['0001_contas.sql', '0002_loja.sql', '0003_desafios.sql', '0004_saldo_inicial.sql', '0005_faca.sql', '0006_sniper.sql', '0007_caixote.sql', '0008_caixa_compra.sql']) db.exec(readFileSync(new URL('./server/migrations/' + f, import.meta.url), 'utf8'));
const bound = (sql, args) => { if (!args.length) return []; if (/\?\d/.test(sql)) { const o = {}; args.forEach((v, i) => { o[i + 1] = v; }); return [o]; } return args; };
const wrap = (sql, args = []) => ({ sql, args, bind(...a) { return wrap(sql, a); },
  async all() { return { results: db.prepare(sql).all(...bound(sql, args)) }; }, async first() { return db.prepare(sql).get(...bound(sql, args)) || null; },
  async run() { const r = db.prepare(sql).run(...bound(sql, args)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
const env = { DB: { prepare: (sql) => wrap(sql), async batch(list) { db.exec('BEGIN'); try { const out = []; for (const s of list) { const st = db.prepare(s.sql); out.push(/^\s*SELECT/i.test(s.sql) ? { results: st.all(...bound(s.sql, s.args)) } : { meta: { changes: Number(st.run(...bound(s.sql, s.args)).changes) } }); } db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } } } };

const add = (id, nick, coins) => db.prepare('INSERT INTO accounts (id, nick, nick_key, pass_hash, created_at, coins) VALUES (?, ?, ?, ?, ?, ?)').run(id, nick, nick.toLowerCase(), 'x', 1, coins);
const row = (id) => db.prepare('SELECT coins, boxes, box_day, box_buy_day FROM accounts WHERE id = ?').get(id);

add(1, 'Cheio', 500);
let r = await buyBox(env, 1);
ok(r.status === 200 && r.coins === 100 && r.boxes === 1 && r.boxBought, `500 Docoins compram 1 caixote e sobram 100 (saldo ${r.coins}, caixotes ${r.boxes})`);
const w = await wallet(env, 1);
ok(w.boxBought && w.coins === 100 && w.boxes === 1, 'a conta passa a dizer que o caixote de hoje já foi comprado');
r = await buyBox(env, 1);
ok(r.status === 409 && row(1).coins === 100 && row(1).boxes === 1, 'o segundo do mesmo dia não cobra e não entrega outro caixote');
const granted = await grantLoginBox(env, 1), after = row(1);
ok(granted && after.boxes === 2 && after.coins === 100 && after.box_day === after.box_buy_day && after.box_day > 0, 'o caixote grátis do mesmo dia continua saindo, sem cobrar de novo');

add(2, 'Curto', 399);
r = await buyBox(env, 2);
ok(r.status === 402 && row(2).coins === 399 && row(2).boxes === 0 && row(2).box_buy_day === 0, '399 Docoins não compram e não marcam o dia');

add(3, 'Exato', 400);
r = await buyBox(env, 3);
ok(r.status === 200 && row(3).coins === 0 && row(3).boxes === 1, '400 certinhos zeram o saldo e entregam o caixote');
db.prepare('UPDATE accounts SET box_buy_day = ?, coins = 400 WHERE id = 3').run(spDay() - 1);
r = await buyBox(env, 3);
ok(r.status === 200 && row(3).coins === 0 && row(3).boxes === 2, 'no dia seguinte dá pra comprar de novo');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

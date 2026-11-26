// Ranking da Pocilga: deslogado não grava, um melhor tempo por conta, ordem e o texto do Tab.
// Uso: node test-pocilga-rank.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PIT, minPlausible, rankFloor, rankedRun, scriptRun } from './shared/pocilga.js';
import { BONUS, aimAt } from './shared/pocilga-bonus.js';
import { pitRank, pitSave } from './server/src/pocilga.js';
import { handleAccountRoute, sha256hex } from './server/src/auth.js';
import { GUEST_RANK_NOTE, PIT_RANK_LIMIT, PIT_TAB_CACHE_MS, formatRankClock, pitBoardRows, renderPitRank, createRankCache } from './pocilga-rank.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

ok(GUEST_RANK_NOTE === 'Entre na conta para entrar no ranking', 'aviso do deslogado é a frase pedida');
ok(PIT.bonusCut === 2, 'o desconto do alvo de bônus é a constante 2 s');
ok(Math.abs(rankFloor() - (minPlausible() - PIT.bonusCut)) < 1e-9, `piso ${rankFloor()} = mínimo físico − bonusCut`);
ok(formatRankClock(52) === '0:52,000' && formatRankClock(66.5) === '1:06,500' && formatRankClock(125.004) === '2:05,004', 'tempo do ranking é m:ss,mmm');
ok(formatRankClock(-1) === '—' && formatRankClock(Number.NaN) === '—', 'tempo inválido não vira número');

const fast = rankedRun(scriptRun({ finish: rankFloor() - 0.05 }));
ok(fast.finished && !fast.ranked && fast.reason === 'rápido', 'abaixo do piso o ranking recusa');
ok(rankedRun(scriptRun({ finish: rankFloor() })).ranked, 'no piso o ranking aceita');

const migs = readdirSync(new URL('./server/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
ok(migs.includes('0013_pocilga.sql'), 'a tabela da Pocilga está na migração 0013');
const mig = read('./server/migrations/0013_pocilga.sql');
ok(/account_id INTEGER PRIMARY KEY/.test(mig) && /best_ms INTEGER NOT NULL/.test(mig), 'uma linha por conta, com o melhor tempo');
ok(!/\b(DROP|TRUNCATE|DELETE FROM)\b/i.test(mig.replace(/--.*$/gm, '')), 'a migração não apaga conta');

function memory() {
  const db = new DatabaseSync(':memory:');
  for (const f of migs) db.exec(read('./server/migrations/' + f));
  const bound = (sql, args) => {
    if (!args.length) return [];
    if (/\?\d/.test(sql)) { const o = {}; args.forEach((v, i) => { o[i + 1] = v; }); return [o]; }
    return args;
  };
  const wrap = (sql, args = []) => ({ sql, args, bind(...a) { return wrap(sql, a); },
    async all() { return { results: db.prepare(sql).all(...bound(sql, args)) }; },
    async first() { return db.prepare(sql).get(...bound(sql, args)) || null; },
    async run() { const r = db.prepare(sql).run(...bound(sql, args)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
  const env = { DB: { prepare: (sql) => wrap(sql) } };
  return { db, env };
}

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const post = (path, body, token) => new Request('http://local' + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body),
});
const get = (path, token) => new Request('http://local' + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });

const { db, env } = memory();
const add = (nick) => db.prepare('INSERT INTO accounts (nick, nick_key, pass_hash, created_at) VALUES (?, ?, ?, ?)').run(nick, nick.toLowerCase(), 'x', 1);
const count = () => db.prepare('SELECT COUNT(*) AS n FROM pocilga_times').get().n;
const rowOf = (nick) => db.prepare('SELECT t.best_ms, t.stars, t.runs FROM pocilga_times t JOIN accounts a ON a.id = t.account_id WHERE a.nick = ?').get(nick);

add('Ana'); add('Beto'); add('Caio');
const idOf = (nick) => db.prepare('SELECT id FROM accounts WHERE nick = ?').get(nick).id;

const guest = await handleAccountRoute(post('/api/pocilga/run', { events: scriptRun({ finish: 40 }), accountId: idOf('Ana'), nick: 'Ana' }), env, new URL('http://local/api/pocilga/run'), json);
const guestBody = await guest.json();
ok(guest.status === 401 && guestBody.error === GUEST_RANK_NOTE && count() === 0, `deslogado não grava (${guest.status} ${guestBody.error})`);

const rejected = await pitSave(env, idOf('Ana'), scriptRun({ finish: rankFloor() - 0.05 }));
ok(rejected.status === 422 && !rejected.body.saved && count() === 0, 'tempo abaixo do piso não cria linha');

const slow = await pitSave(env, idOf('Ana'), scriptRun({ finish: 60 }));
ok(slow.status === 200 && slow.body.saved && slow.body.run.stars === 2 && rowOf('Ana').runs === 1, `primeira corrida da Ana entra (${slow.body.run && slow.body.run.final})`);
const worse = await pitSave(env, idOf('Ana'), scriptRun({ finish: 70, civs: ['c1'] }));
ok(worse.status === 200 && rowOf('Ana').runs === 2 && rowOf('Ana').best_ms === Math.round(60 * 1000) && rowOf('Ana').stars === 2, 'corrida pior não troca o melhor tempo nem as estrelas');
const better = await pitSave(env, idOf('Ana'), scriptRun({ finish: 45 }));
ok(better.status === 200 && better.body.saved && rowOf('Ana').runs === 3 && rowOf('Ana').best_ms === Math.round(45 * 1000) && rowOf('Ana').stars === 3 && count() === 1, 'só fica o melhor tempo, ainda uma linha');

await pitSave(env, idOf('Beto'), scriptRun({ finish: 40 }));
await pitSave(env, idOf('Caio'), scriptRun({ finish: 80 }));
ok(count() === 3, 'três contas, três linhas');
const board = await pitRank(env, idOf('Caio'), 10);
ok(board.rows.map((r) => r.nick).join(',') === 'Beto,Ana,Caio', `ordem por tempo (${board.rows.map((r) => r.nick + ' ' + r.clock).join(' · ')})`);
ok(board.rows.every((r, i) => r.place === i + 1) && board.rows[0].best < board.rows[1].best && board.rows[1].best < board.rows[2].best, 'posições sobem com o tempo');
ok(board.me && board.me.nick === 'Caio' && board.me.place === 3, `a própria linha vem com a posição (${board.me && board.me.place})`);
const top1 = await pitRank(env, idOf('Caio'), 1);
ok(top1.rows.length === 1 && top1.rows[0].nick === 'Beto' && top1.me.place === 3 && top1.me.nick === 'Caio', 'fora do top a posição real continua na linha da conta');

const token = 'pitranktoken000000000000000001';
const exp = Math.floor(Date.now() / 1000) + 3600;
db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(await sha256hex(token), idOf('Beto'), exp - 10, exp);
const spoof = await handleAccountRoute(post('/api/pocilga/run', { events: scriptRun({ finish: 42 }), accountId: idOf('Ana'), nick: 'Ana' }, token), env, new URL('http://local/api/pocilga/run'), json);
const spoofBody = await spoof.json();
ok(spoof.status === 200 && spoofBody.saved && rowOf('Beto').best_ms === Math.round(40 * 1000) && rowOf('Ana').best_ms === Math.round(45 * 1000), 'o apelido do pedido não troca a conta da sessão, e 42 s não bate o recorde de 40 s');

const listed = await handleAccountRoute(get('/api/pocilga/rank?limit=10', token), env, new URL('http://local/api/pocilga/rank?limit=10'), json);
const listedBody = await listed.json();
ok(listed.status === 200 && listedBody.me && listedBody.me.nick === 'Beto' && listedBody.me.place === 1 && listedBody.rows[0].nick === 'Beto', 'com sessão, o ranking aponta a própria conta');
const anon = await handleAccountRoute(get('/api/pocilga/rank?limit=10'), env, new URL('http://local/api/pocilga/rank?limit=10'), json);
const anonBody = await anon.json();
ok(anon.status === 200 && anonBody.me == null && anonBody.rows.length === 3, 'sem sessão a lista sai e a linha própria não');

const data = {
  rows: Array.from({ length: PIT_RANK_LIMIT }, (_, i) => ({ place: i + 1, nick: 'P' + i, best: 40 + i, stars: i < 3 ? 3 : 2 })),
  me: { place: 14, nick: 'Eu', best: 70.25, stars: 1 },
};
const mine = renderPitRank(data, { nick: 'Eu', logged: true, variant: 'menu' });
ok(mine.includes('>14<') && mine.includes('Eu') && mine.includes('1:10,250') && mine.includes('★☆☆') && mine.includes('class="me"'), 'menu e Tab incluem quem ficou fora do top, com tempo e estrela');
ok(!mine.includes(GUEST_RANK_NOTE) && (mine.match(/class="me"/g) || []).length === 1, 'logado não vê o aviso e a própria linha não duplica');
const guestHtml = renderPitRank(data, { nick: 'Eu', logged: false, variant: 'tab' });
ok(guestHtml.includes(GUEST_RANK_NOTE) && !guestHtml.includes('>14<') && !guestHtml.includes('class="me"') && guestHtml.includes('Pistoleiro da Pocilga'), 'Tab deslogado mostra o aviso e não inventa linha');
const inside = renderPitRank({ rows: data.rows, me: data.rows[2] }, { nick: 'P2', logged: true });
ok((inside.match(/<tr /g) || []).length === PIT_RANK_LIMIT && (inside.match(/class="me"/g) || []).length === 1, 'quem já está no top não ganha segunda linha');

let calls = 0, now = 1000;
const cache = createRankCache({ load: async () => { calls++; return { rows: data.rows.slice(0, 2), me: null }; }, now: () => now, ttl: PIT_TAB_CACHE_MS });
const a = await cache.get(), b = await cache.get();
now += PIT_TAB_CACHE_MS - 1;
const c = await cache.get();
now += 2;
const d = await cache.get();
ok(calls === 2 && a === b && b === c && d !== c, `cache curto: duas aberturas no prazo usam a mesma resposta (${calls} buscas)`);

{
  add('Lia');
  const clock = 40;
  const events = scriptRun({ finish: clock });
  const at = events.findIndex((e) => e.k === 'start');
  events.splice(at + 1, 0, { k: 'bonus', t: 0.05, w: PIT.pistol, ...aimAt(0, 4.2, 36, BONUS.x, BONUS.y) });
  const saved = await pitSave(env, idOf('Lia'), events);
  const row = rowOf('Lia');
  const board = await pitRank(env, idOf('Lia'), 10);
  const line = board.rows.find((r) => r.nick === 'Lia');
  ok(saved.status === 200 && saved.body.saved && saved.body.run.bonus === -PIT.bonusCut && saved.body.run.raw === clock && saved.body.run.final === clock - PIT.bonusCut, `miolo grava o relógio menos ${PIT.bonusCut} s (${saved.body.run && saved.body.run.final})`);
  ok(row && row.best_ms === Math.round((clock - PIT.bonusCut) * 1000), `a linha da Lia é ${row && row.best_ms} ms`);
  ok(line && line.best === clock - PIT.bonusCut && formatRankClock(line.best) === '0:38,000', `a linha do Tab seria ${line && formatRankClock(line.best)}`);
}

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

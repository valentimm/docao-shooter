// Desafios diários (sem navegador e sem wrangler): banco de 60, sorteio por conta/dia de Brasília, contadores da sala
// e gravação no D1 (um SQLite de verdade em memória, com as migrações do projeto). Uso: node test-desafios-regras.mjs
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CHALLENGES, CHAL_BY_ID, dailyIds, spDay, secsToReset, parseChal, applyChal, chalView } from './shared/challenges.js';
import { Game } from './server/src/game.js';
import { recordStats } from './server/src/auth.js';
import { EARN } from './shared/closet.js';
const fails = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

// ---- banco ----
const tiers = { F: 0, M: 0, D: 0 }; CHALLENGES.forEach((c) => tiers[c.tier]++);
ok(CHALLENGES.length === 60 && tiers.F === 24 && tiers.M === 24 && tiers.D === 12, `60 desafios: ${tiers.F} fáceis, ${tiers.M} médios, ${tiers.D} difíceis`);
ok(new Set(CHALLENGES.map((c) => c.id)).size === 60 && CHALLENGES.every((c, i) => c.id === 'D' + String(i + 1).padStart(2, '0')), 'ids D01..D60 únicos e em ordem');
ok(CHALLENGES.every((c) => !c.mo || ['dm', 'dom', 'bomb', 'inv'].includes(c.mo)), 'nenhum desafio de Treino nem de Exploração (só modos online)');
ok(!CHALLENGES.some((c) => /treino|estande|explora/i.test(c.text)), 'nenhum texto fala de Treino/Estande/Exploração');
const avg = (t) => CHALLENGES.filter((c) => c.tier === t).reduce((s, c) => s + c.reward, 0) / tiers[t];
ok(Math.abs(avg('F') - 23) < 2 && Math.abs(avg('M') - 49) < 2 && Math.abs(avg('D') - 98) < 2, `calibragem mantida: média F ${avg('F').toFixed(1)} · M ${avg('M').toFixed(1)} · D ${avg('D').toFixed(1)}`);
// ---- dia de Brasília e sorteio ----
const utc = (s) => Date.parse(s);
ok(spDay(utc('2026-10-24T02:59:59Z')) === spDay(utc('2026-10-23T03:00:00Z')) && spDay(utc('2026-10-24T03:00:00Z')) === spDay(utc('2026-10-23T03:00:00Z')) + 1, 'o dia vira à 0h de Brasília (03:00 UTC), não à 0h UTC');
ok(secsToReset(utc('2026-10-24T02:59:00Z')) === 60 && secsToReset(utc('2026-10-23T03:00:00Z')) === 86400, 'contagem até o reset: 60 s antes da meia-noite de Brasília');
const d0 = spDay(utc('2026-10-23T15:00:00Z'));
ok(JSON.stringify(dailyIds(42, d0)) === JSON.stringify(dailyIds(42, d0)), 'mesma conta + mesmo dia = mesmos 3 desafios');
ok(dailyIds(42, d0).map((id) => CHAL_BY_ID[id].tier).join('') === 'FMD', '1 fácil + 1 médio + 1 difícil por dia');
let diffDay = 0, diffAcct = 0; for (let i = 0; i < 50; i++) { if (dailyIds(42, d0 + i + 1).join() !== dailyIds(42, d0 + i).join()) diffDay++; if (dailyIds(100 + i, d0).join() !== dailyIds(101 + i, d0).join()) diffAcct++; }
ok(diffDay >= 45 && diffAcct >= 45, `muda de um dia pro outro (${diffDay}/50) e de conta pra conta (${diffAcct}/50)`);
const seen = new Set(); for (let a = 1; a <= 400; a++) dailyIds(a, d0).forEach((id) => seen.add(id)); ok(seen.size === 60, `todos os 60 aparecem no sorteio (${seen.size})`);
// ---- progresso e pagamento (regras puras) ----
const findAcct = (pred, day = d0) => { for (let a = 1; a < 1e5; a++) if (pred(dailyIds(a, day).map((id) => CHAL_BY_ID[id]))) return a; return 0; };
{ const A = findAcct((L) => L[0].id === 'D02'); let s = parseChal(null, d0); // F = 10 abates somando o dia
  let r = applyChal(s, A, { k: 4 }, 'dm'); ok(r.changed && r.reward === 0 && r.state.p[0] === 4, 'soma: 4 de 10 abates, nada pago ainda'); s = r.state;
  r = applyChal(s, A, { k: 9 }, 'bomb'); ok(r.reward === 20 && r.boxes === 1 && (r.state.k & 1) && r.state.p[0] === 10, 'completou (qualquer modo): paga 20, entrega 1 caixote e trava em 10/10'); s = r.state;
  r = applyChal(s, A, { k: 50 }, 'dm'); ok(r.reward === 0 && r.boxes === 0, 'já pago: não paga de novo nem entrega outro caixote');
  ok(parseChal(JSON.stringify(s), d0 + 1).k === 0 && parseChal(JSON.stringify(s), d0 + 1).p.join() === '0,0,0', 'dia novo: progresso e pagos zeram'); }
{ const A = findAcct((L) => L[1].id === 'D21'); let s = parseChal(null, d0); // M = 15 abates numa só partida de Mata-mata
  s = applyChal(s, A, { mk: 9 }, 'dm').state; s = applyChal(s, A, { mk: 7 }, 'dm').state;
  ok(s.p[1] === 9, '"numa só partida": guarda a melhor partida (9), não soma (9+7)');
  ok(applyChal(s, A, { mk: 20 }, 'dom').reward === 0, 'desafio de Mata-mata não anda na Dominação');
  ok(applyChal(s, A, { mk: 15 }, 'dm').reward === 45, '15 numa partida de Mata-mata: paga 45'); }
{ const A = findAcct((L) => L[2].id === 'D60'); let s = parseChal(null, d0);
  s = applyChal(s, A, { modes: 1 }, 'dm').state; s = applyChal(s, A, { modes: 1 }, 'dm').state; ok(s.k === 0 || !(s.k & 4), '2 partidas do mesmo modo contam 1 modo');
  s = applyChal(s, A, { modes: 2 }, 'dom').state; const r = applyChal(s, A, { modes: 8 }, 'inv'); ok(r.reward === 70, '3 modos diferentes no dia: paga 70');
  const v = chalView(A, JSON.stringify(r.state), utc('2026-10-23T15:00:00Z')); ok(v.list[2].done && v.list[2].prog === 3 && v.list.length === 3 && v.resetIn > 0, 'tela: 3 desafios, progresso 3/3, completo e contagem do reset'); }
ok(chalView(5, '{lixo', utc('2026-10-23T15:00:00Z')).list.every((x) => x.prog === 0 && !x.done), 'estado inválido no banco vira dia zerado (sem quebrar)');

// ---- contadores da sala ----
function mk(mode = 'dm', map = 'arena') {
  const stats = []; let fake = 1000;
  const g = new Game({ code: 'TEST', map, max: 8, fillBots: true, mode }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {}, stats: (items) => stats.push(...items) });
  g.now = () => fake; const a = g.join({ name: 'A', acct: { id: 7, nick: 'A', skin: '' } }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' }); a.connected = true;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { fake += 0.05; g.tick(); } }; step(5);
  a.alive = true; a.hp = 100; a.invulnUntil = 1e9;
  const bot = () => { const v = [...g.ents.values()].find((x) => x !== a && x.bot && !x.zt && (!g.teamMode || x.team !== a.team)); v.alive = true; v.hp = 100; v.invulnUntil = 0; return v; };
  return { g, a, stats, step, bot };
}
{ const { g, a, stats, bot } = mk();
  g.kill(bot(), a, 0, true); g.kill(bot(), a, 1, false); g.kill(bot(), a, 7, false, true); g.kill(bot(), a, 2, false, false, null, 1); g.kill(bot(), a, -1, false);
  ok(a.cq.k === 5 && a.cq.hs === 1 && a.cq.w_shot === 1 && a.cq.knife === 1 && a.cq.back === 1 && a.cq.w_snip === 1 && a.cq.wall === 1 && a.cq.nade === 1 && a.cq.seq3 === 1, 'abates contam: total, cabeça, armas, faca/costas, parede, Copo Bomba, 3 seguidos');
  g.kill(bot(), a, -1, false, false, 'pk'); ok(a.cq.nade === 1, 'Pokébola não conta como Copo Bomba');
  g.onMessage(a.id, { t: 'say', text: 'oi' }); ok(a.cq.chat === 1, 'mensagem no chat conta');
  a.jt = 0; g.T = EARN.minSecs + 5; g.endMatch(); const s = stats.find((x) => x.acct === 7 && x.m);
  ok(s && s.q && s.q.k === 6 && s.q.m === 1 && s.q.mk === 6 && s.q.modes === 1, `fim de partida: contadores vão junto da gravação (q=${JSON.stringify(s && s.q)})`);
  ok(!a.cq || !Object.keys(a.cq).length, 'depois de gravar, a sala zera os contadores (não grava duas vezes)'); }
{ const { g, a, stats, bot } = mk(); g.kill(bot(), a, 0, false); g.T = 10; g.endMatch(); const s = stats.find((x) => x.acct === 7);
  ok(s && s.q && !s.q.m && s.q.k === 1, `partida curta (<${EARN.minSecs}s) não conta como "jogada até o fim"`); }
{ const { g, a, stats } = mk('treino', 'estande'); a.cq = undefined; g.onMessage(a.id, { t: 'say', text: 'oi' }); g.flushStats(a, true, true); ok(stats.length === 0 && !(a.cq && a.cq.chat), 'Treino: nada conta nem é gravado'); }
{ const { g, a, stats, bot } = mk(); g.leave(a.id); ok(!stats.some((x) => x.q && x.q.m), 'sair no meio não conta partida'); }

// ---- gravação no D1 (SQLite em memória com as migrações) ----
const db = new DatabaseSync(':memory:');
for (const f of ['0001_contas.sql', '0002_loja.sql', '0003_desafios.sql', '0004_saldo_inicial.sql', '0005_faca.sql', '0006_sniper.sql', '0007_caixote.sql']) db.exec(readFileSync(new URL('./server/migrations/' + f, import.meta.url), 'utf8'));
const bound = (sql, args) => { if (!args.length) return []; if (/\?\d/.test(sql)) { const o = {}; args.forEach((v, i) => { o[i + 1] = v; }); return [o]; } return args; }; // node:sqlite liga ?1 como parâmetro nomeado
const wrap = (sql, args = []) => ({ sql, args, bind(...a) { return wrap(sql, a); },
  async all() { return { results: db.prepare(sql).all(...bound(sql, args)) }; }, async first() { return db.prepare(sql).get(...bound(sql, args)) || null; },
  async run() { const r = db.prepare(sql).run(...bound(sql, args)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
const env = { DB: { prepare: (sql) => wrap(sql), async batch(list) { db.exec('BEGIN'); try { const out = []; for (const s of list) { const st = db.prepare(s.sql); out.push(/^\s*SELECT/i.test(s.sql) ? { results: st.all(...bound(s.sql, s.args)) } : { meta: { changes: Number(st.run(...bound(s.sql, s.args)).changes) } }); } db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } } } };
const today = spDay();
const A = findAcct((L) => L[0].id === 'D02', today);
db.prepare('INSERT INTO accounts (id, nick, nick_key, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(A, 'Teste', 'teste', 'x', 1);
const row = () => db.prepare('SELECT coins, earn_today, chal, boxes FROM accounts WHERE id = ?').get(A);
let writes = 0; const origBatch = env.DB.batch; env.DB.batch = async (l) => { writes += l.filter((s) => /^\s*UPDATE accounts/i.test(s.sql)).length; return origBatch(l); };
await recordStats(env, [{ acct: A, mode: 'dm', k: 6, d: 1, c: 6, w: 0, m: 0, q: { k: 6 } }]);
let r = row(); ok(r.coins === 6 && r.boxes === 0 && JSON.parse(r.chal).p[0] === 6 && writes === 1, `6 abates: 6 Docoins da partida e progresso 6/10 no MESMO UPDATE (${writes} escrita na conta), sem caixote ainda`);
await recordStats(env, [{ acct: A, mode: 'dom', k: 5, d: 0, c: 5, w: 0, m: 0, q: { k: 5 } }]);
r = row(); ok(r.coins === 6 + 5 + 20 && r.boxes === 1 && (JSON.parse(r.chal).k & 1) && writes === 2, `completou o fácil: +5 da partida +20 do desafio e 1 caixote (saldo ${r.coins})`);
db.prepare('UPDATE accounts SET earn_day = ?, earn_today = ? WHERE id = ?').run(Math.floor(Date.now() / 86400000), EARN.dayCap, A);
const before = row().coins; const ids = dailyIds(A, today), M = CHAL_BY_ID[ids[1]];
await recordStats(env, [{ acct: A, mode: M.mo || 'dm', k: 0, d: 0, c: 30, w: 0, m: 0, q: { [M.ev]: M.ty === 'bits' ? 7 : M.goal } }]);
r = row(); ok(r.coins === before + M.reward && r.boxes === 2 && r.earn_today === EARN.dayCap, `teto diário das partidas cheio: partida rende 0, mas o desafio médio paga ${M.reward} e mais 1 caixote (sem teto)`);
await recordStats(env, [{ acct: A, mode: M.mo || 'dm', k: 0, d: 0, c: 0, w: 0, m: 0, q: { [M.ev]: M.goal } }]);
ok(row().coins === before + M.reward && row().boxes === 2, 'desafio já pago: gravar de novo não paga duas vezes nem entrega outro caixote');
const w0 = writes; await recordStats(env, [{ acct: A, mode: 'dm', k: 1, d: 0, c: 0, w: 0, m: 0, q: { chat: 1 } }]);
ok(writes === w0 || CHAL_BY_ID[ids[2]].ev === 'chat', 'contador que não é de nenhum desafio do dia não gera escrita na conta');
// conflito: outra sala mudou o chal no meio (estado velho) → o UPDATE não paga em cima de estado velho
db.prepare('UPDATE accounts SET chal = ? WHERE id = ?').run(JSON.stringify({ d: today, p: [0, 0, 0], k: 0 }), A);
const { coinCreditStmt } = await import('./server/src/shop.js');
const c0 = row().coins, b0 = row().boxes; await env.DB.batch([coinCreditStmt(env, A, 0, { old: '{"velho":1}', json: '{"d":1,"p":[1,1,1],"k":7}', reward: 999, boxes: 3 })]);
ok(row().coins === c0 && row().boxes === b0 && JSON.parse(row().chal).k === 0, 'corrida entre duas salas: estado mudou no meio, nada é pago em dobro nem entra caixote');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK'); process.exit(fails.length ? 1 : 0);

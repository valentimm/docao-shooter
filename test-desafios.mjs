// Desafios diários de ponta a ponta (Worker + Room + D1 locais): sorteio no /api/me, progresso contado pela sala online,
// gravado em accounts.chal no fim da partida e pago uma vez só. Treino não conta.
// Precisa: cd server && npx wrangler d1 migrations apply docao-contas --local && npx wrangler dev --var ALLOW_TEST:1 --var RATE_REG_MAX:500   (SÓ LOCAL)
// Uso: node test-desafios.mjs [http://127.0.0.1:8787]
import { execSync } from 'node:child_process';
import { SKINS } from './skins.js';
import { EARN, START_COINS } from './shared/closet.js';
import { promoActive, PROMO_COINS } from './shared/promo.js';
import { CHAL_BY_ID, dailyIds, spDay } from './shared/challenges.js';
const H = process.argv[2] || 'http://127.0.0.1:8787', WS = H.replace(/^http/, 'ws');
const fails = []; const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) fails.push(m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Math.random().toString(36).slice(2, 5);
async function call(method, path, body, token) {
  const r = await fetch(H + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const sql = (q) => JSON.parse(execSync(`cd server && npx wrangler d1 execute docao-contas --local --json --command "${q}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))[0].results;
const me = (t) => call('GET', '/api/me', null, t).then((r) => r.data);
function join(code, token) {
  return new Promise((res) => {
    const q = new URLSearchParams({ name: 'x', skin: SKINS[0].id, primary: '0', secondary: '', melee: '', token: '' });
    const ws = new WebSocket(`${WS}/ws/${code}?${q}`, ['docao', 'tk.' + token]); const c = { ws };
    ws.onopen = () => setTimeout(() => res(c), 700); ws.onerror = () => res(c); c.send = (o) => ws.send(JSON.stringify(o));
  });
}
async function play(token, kills, mode = 'dm', map = 'arena', end = true) {
  const code = (await call('POST', '/api/rooms', { map, max: 4, fillBots: mode !== 'treino', mode })).data.code;
  const P = await join(code, token); P.send({ t: 'start' }); await wait(6000);
  for (let i = 0; i < kills; i++) { P.send({ t: 'testKill' }); await wait(150); }
  if (end) { P.send({ t: 'testEnd' }); await wait(2500); }
  P.ws.close(); await wait(1500);
}
const BANKROLL = START_COINS + (promoActive() ? PROMO_COINS : 0); // /api/me já aplica a promo, se estiver no prazo
// acha uma conta cujo desafio fácil de hoje é "abates" (D02: 10 no dia, ou D29: 5 no Mata-mata): os dois andam com abates em bots
let tok = '', m = null, n = 0;
for (; n < 80; n++) {
  const r = await call('POST', '/api/auth/register', { nick: 'Desafio' + tag + n, password: 'senha-forte-123' }); if (r.status !== 201) { console.log('cadastro', r.status, r.data); break; }
  m = await me(r.data.token); if (['D02', 'D29'].includes(m.chal.list[0].id)) { tok = r.data.token; break; }
}
ok(!!tok, `achou conta com desafio fácil de abates (${n + 1} cadastros)`);
ok(m.chal && m.chal.list.length === 3 && m.chal.list.map((x) => x.tier).join('') === 'FMD' && m.chal.day === spDay(), '/api/me traz os 3 desafios do dia (fácil, médio, difícil) e o dia de Brasília');
ok(m.chal.resetIn > 0 && m.chal.resetIn <= 86400, `contagem até o reset: ${m.chal.resetIn} s`);
ok(m.chal.list.every((x) => x.prog === 0 && !x.done && x.reward > 0), 'conta nova: tudo zerado, com prêmio');
const id = sql(`SELECT id FROM accounts WHERE nick = '${m.account.nick}'`)[0].id;
ok(JSON.stringify(dailyIds(id, spDay())) === JSON.stringify(m.chal.list.map((x) => x.id)), 'sorteio do servidor = hash(conta, dia) do módulo shared');
ok(sql(`SELECT chal FROM accounts WHERE id = ${id}`)[0].chal === null, 'só ler os desafios não grava nada no banco');
const F = CHAL_BY_ID[m.chal.list[0].id];
// Treino não conta
await play(tok, 6, 'treino', 'estande', false); m = await me(tok);
ok(m.chal.list[0].prog === 0 && m.account.coins === BANKROLL, 'Treino: abates não andam o desafio nem rendem');
// partida online: 3 abates por partida (o teste mata os bots vivos da sala); o saldo da partida = nº de abates (1 por bot), fora os 500 iniciais
await play(tok, 3); m = await me(tok); let kills = (m.account.coins - BANKROLL) / EARN.killBot;
ok(kills >= 1 && m.chal.list[0].prog === kills && !m.chal.list[0].done, `partida online: progresso ${m.chal.list[0].prog}/${F.goal} gravado no fim (= ${kills} abates)`);
const chal1 = sql(`SELECT chal FROM accounts WHERE id = ${id}`)[0].chal;
ok(chal1 && JSON.parse(chal1).d === spDay() && chal1.length < 60, `accounts.chal é um JSON curtinho (${chal1})`);
let paid = false, guard = 0;
while (!paid && guard++ < 8) {
  await play(tok, 3); m = await me(tok); paid = m.chal.list[0].done;
  if (!paid) { kills = (m.account.coins - BANKROLL) / EARN.killBot; ok(m.chal.list[0].prog === kills, `andando: ${kills}/${F.goal}`); }
}
ok(paid && m.chal.list[0].prog === F.goal, 'completou o desafio fácil');
const k2 = (m.account.coins - BANKROLL - F.reward) / EARN.killBot;
ok(Number.isInteger(k2) && k2 >= F.goal && k2 <= F.goal + 3, `pagou o prêmio ${F.reward} uma vez (saldo ${m.account.coins} = ${k2} abates + ${F.reward})`);
await play(tok, 3); const m2 = await me(tok);
ok(m2.account.coins > m.account.coins && m2.account.coins - m.account.coins <= 3 * EARN.killBot, 'mais abates depois de completo: só o valor dos abates, o prêmio não paga de novo');
// dia novo (simulado no banco local): começa do zero
sql(`UPDATE accounts SET chal = '{\\"d\\":${spDay() - 1},\\"p\\":[10,0,0],\\"k\\":1}' WHERE id = ${id}`); m = await me(tok);
ok(m.chal.list.every((x) => !x.done && x.prog === 0), 'estado de ontem no banco: hoje aparece zerado');
console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK'); process.exit(fails.length ? 1 : 0);

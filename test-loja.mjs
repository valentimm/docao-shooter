// Teste do servidor da loja (Brechó da Porca Véia): ganho de Docoins, tetos, compra, compra dupla, equipar item que não é seu, skins na rede.
// Precisa: cd server && npx wrangler d1 migrations apply docao-contas --local && npx wrangler dev --var ALLOW_TEST:1 --var RATE_REG_MAX:500   (SÓ LOCAL)
// Uso: node test-loja.mjs [http://127.0.0.1:8787]
import { execSync } from 'node:child_process';
import { SKINS } from './skins.js';
import { ITEMS, encodeLook, parseLook, EARN, START_COINS } from './shared/closet.js';
import { promoActive, PROMO_COINS } from './shared/promo.js';
const H = process.argv[2] || 'http://127.0.0.1:8787', WS = H.replace(/^http/, 'ws');
const fails = []; const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) fails.push(m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Math.random().toString(36).slice(2, 6);
async function call(method, path, body, token) {
  const r = await fetch(H + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const sql = (q) => JSON.parse(execSync(`cd server && npx wrangler d1 execute docao-contas --local --json --command "${q}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))[0].results;
const reg = async (n) => (await call('POST', '/api/auth/register', { nick: n + tag, password: 'senha-forte-123' })).data.token;
const me = (t) => call('GET', '/api/me', null, t).then((r) => r.data);
const today = Math.floor(Date.now() / 86400000);
const BANKROLL = START_COINS + (promoActive() ? PROMO_COINS : 0); // /api/me já aplica a promo, se estiver no prazo

// ---- carteira e segurança básica ----
const tA = await reg('Loja'); let m = await me(tA);
ok(m.account.coins === BANKROLL && Array.isArray(m.items) && m.items.length === 0 && m.earn.cap === EARN.dayCap, `conta nova: ${BANKROLL} Docoins (saldo inicial + promo se ativa), mochila vazia, teto diário informado`);
let r = await call('POST', '/api/shop/buy', { item: 'h1' }); ok(r.status === 401, 'comprar sem login: 401');
const id = sql(`SELECT id FROM accounts WHERE nick = '${'Loja' + tag}'`)[0].id;
sql(`UPDATE accounts SET coins = 0 WHERE id = ${id}`);
r = await call('POST', '/api/shop/buy', { item: 'h1' }, tA); ok(r.status === 402, 'sem saldo: 402 (nada é cobrado nem entregue)');
r = await call('POST', '/api/shop/buy', { item: 'nao-existe' }, tA); ok(r.status === 400, 'item inexistente: 400');
r = await call('POST', '/api/shop/buy', { item: { $ne: 1 } }, tA); ok(r.status === 400, 'item que não é texto: 400');
r = await call('PUT', '/api/me/skin', { skin: 'classico', coins: 99999 }, tA); m = await me(tA);
ok(r.status === 200 && m.account.coins === 0, 'cliente mandar "coins" não muda o saldo');
// ---- compra ----
sql(`UPDATE accounts SET coins = 500 WHERE id = ${id}`);
r = await call('POST', '/api/shop/buy', { item: 'h1', price: 0, coins: 9999 }, tA);
ok(r.status === 200 && r.data.coins === 440, 'compra do h1 (60): saldo 440; preço informado pelo cliente é ignorado');
r = await call('POST', '/api/shop/buy', { item: 'h1' }, tA); m = await me(tA);
ok(r.status === 409 && m.account.coins === 440 && m.items.includes('h1'), 'comprar de novo: 409, sem cobrar duas vezes');
const rs = await Promise.all([1, 2, 3, 4, 5].map(() => call('POST', '/api/shop/buy', { item: 'h3' }, tA))); m = await me(tA);
ok(rs.filter((x) => x.status === 200).length === 1 && m.account.coins === 290 && m.items.filter((i) => i === 'h3').length === 1, `5 compras simultâneas do mesmo item: só 1 passa, cobrado 1x (saldo ${m.account.coins})`);
sql(`UPDATE accounts SET coins = 100 WHERE id = ${id}`);
const rs2 = await Promise.all([call('POST', '/api/shop/buy', { item: 'f2' }, tA), call('POST', '/api/shop/buy', { item: 'f5' }, tA)]); m = await me(tA);
ok(rs2.filter((x) => x.status === 200).length === 1 && m.account.coins >= 0 && m.account.coins < 100, `saldo 100, duas compras (90 e 120): no máximo uma entra, nunca fica negativo (${m.account.coins})`);
ok(sql(`SELECT COUNT(*) AS n FROM accounts WHERE coins < 0`)[0].n === 0, 'nenhuma conta com saldo negativo no banco');
// ---- equipar ----
const own = (items) => encodeLook({ shirt: 3, pants: 12, items });
r = await call('PUT', '/api/me/skin', { skin: own({ w: 'w3' }) }, tA); ok(r.status === 400, 'equipar visual com parte que NÃO é sua: 400');
r = await call('PUT', '/api/me/skin', { skin: 'x1.3.5.h3.h1' }, tA); ok(r.status === 400, 'código inválido (dois itens no mesmo espaço): 400');
r = await call('PUT', '/api/me/skin', { skin: 'x1.zz' }, tA); ok(r.status === 400, 'código malformado: 400');
const mine = own({ h: 'h3' });
r = await call('PUT', '/api/me/skin', { skin: mine }, tA); m = await me(tA);
ok(r.status === 200 && m.account.skin === mine && m.account.custom === mine, 'equipar visual com parte própria: salvo na conta');
r = await call('PUT', '/api/me/skin', { skin: SKINS[2].id }, tA); m = await me(tA);
ok(r.status === 200 && m.account.skin === SKINS[2].id && m.account.custom === mine, 'voltar a uma skin da lista mantém o visual personalizado guardado');
// ---- ganho de Docoins (partida online com bots, servidor local com ALLOW_TEST) ----
function join(code, { name = 'x', token, skin = SKINS[0].id } = {}) {
  return new Promise((res) => {
    const q = new URLSearchParams({ name, skin, primary: '0', secondary: '', melee: '', token: '' });
    const ws = token ? new WebSocket(`${WS}/ws/${code}?${q}`, ['docao', 'tk.' + token]) : new WebSocket(`${WS}/ws/${code}?${q}`);
    const c = { ws, welcome: null, error: null, last: {} };
    ws.onmessage = (ev) => { if (ev.data === 'pong') return; let o; try { o = JSON.parse(ev.data); } catch (e) { return; } c.last[o.t] = o; if (o.t === 'welcome') c.welcome = o; if (o.t === 'error') c.error = o.msg; };
    ws.onopen = () => setTimeout(() => res(c), 700); ws.onerror = () => res(c); c.send = (o) => ws.send(JSON.stringify(o));
  });
}
async function playMatch(token, kills, mode = 'dm') {
  const code = (await call('POST', '/api/rooms', { map: 'arena', max: 4, fillBots: true, mode })).data.code;
  const P = await join(code, { token }); P.send({ t: 'start' }); await wait(6500);
  for (let i = 0; i < kills; i++) { P.send({ t: 'testKill' }); await wait(150); }
  P.send({ t: 'testEnd' }); await wait(2500); P.ws.close(); await wait(500); return code;
}
const tB = await reg('Ganha'); const idB = sql(`SELECT id FROM accounts WHERE nick = '${'Ganha' + tag}'`)[0].id;
await playMatch(tB, 3); m = await me(tB);
ok(m.account.coins === BANKROLL + 3 * EARN.killBot, `3 abates em bots rendem ${3 * EARN.killBot} Docoins e partida curta não leva bônus de fim (saldo ${m.account.coins})`);
sql(`UPDATE accounts SET earn_day = ${today}, earn_today = ${EARN.dayCap - 1}, coins = 0 WHERE id = ${idB}`);
await playMatch(tB, 4); m = await me(tB);
ok(m.account.coins === 1 && m.earn.today === EARN.dayCap, `teto diário: faltava 1 pra ${EARN.dayCap}, só entrou 1 (saldo ${m.account.coins}, hoje ${m.earn.today})`);
await playMatch(tB, 3); m = await me(tB);
ok(m.account.coins === 1, 'depois do teto diário: partida nova não rende mais');
sql(`UPDATE accounts SET earn_day = ${today - 1}, earn_today = ${EARN.dayCap} WHERE id = ${idB}`);
await playMatch(tB, 2); m = await me(tB);
ok(m.account.coins === 1 + 2 * EARN.killBot && m.earn.today === 2 * EARN.killBot, `dia novo zera a contagem do teto (saldo ${m.account.coins})`);
// treino não rende
{
  const before = (await me(tB)).account.coins;
  const code = (await call('POST', '/api/rooms', { map: 'estande', max: 2, fillBots: false, mode: 'treino' })).data.code;
  const P = await join(code, { token: tB }); P.send({ t: 'start' }); await wait(4500);
  for (let i = 0; i < 5; i++) { P.send({ t: 'testKill' }); await wait(150); }
  P.ws.close(); await wait(1500);
  ok((await me(tB)).account.coins === before, 'Treino não rende Docoins (abates e saída)');
}
// teto por partida: servidor limita no jogo (80) mesmo que passem mais abates
ok(EARN.matchCap === 80 && EARN.dayCap === 400, 'regras: teto por partida 80 e por dia 400');
// ---- skins na rede ----
const tC = await reg('Visual'); const idC = sql(`SELECT id FROM accounts WHERE nick = '${'Visual' + tag}'`)[0].id;
sql(`INSERT INTO inventory (account_id, item, acquired_at) VALUES (${idC}, 'h3', 1), (${idC}, 'f2', 1)`);
const look = own({ h: 'h3', f: 'f2' });
ok((await call('PUT', '/api/me/skin', { skin: look }, tC)).status === 200, 'conta com h3+f2 equipa o visual');
const room = (await call('POST', '/api/rooms', { map: 'arena', max: 6, fillBots: true, mode: 'dm' })).data.code;
const C = await join(room, { token: tC }); const G = await join(room, { name: 'Espiao', skin: look });
const pl = (c, nm) => ((c.last.lobby || {}).players || []).find((p) => p.name === nm);
await wait(500);
ok(pl(G, 'Visual' + tag) && pl(G, 'Visual' + tag).skin === look, 'outros jogadores veem o visual personalizado da conta (código curto na rede)');
ok(look.length <= 48, `payload pequeno: ${look.length} caracteres`);
ok(pl(C, 'Espiao') && pl(C, 'Espiao').skin !== look && SKINS.some((s) => s.id === pl(C, 'Espiao').skin), 'CONVIDADO mandando o código na URL NÃO ganha o visual (vira skin da lista)');
G.send({ t: 'prof', name: 'Espiao', skin: look, primary: 0 }); await wait(600);
ok(pl(C, 'Espiao') && pl(C, 'Espiao').skin !== look, 'convidado mandando o código no lobby também é barrado');
C.send({ t: 'prof', skin: own({ w: 'w3' }), primary: 0 }); await wait(700);
ok(pl(G, 'Visual' + tag).skin === look, 'conta mandando visual com parte que não tem: continua com o visual anterior');
C.send({ t: 'prof', skin: own({ h: 'h3' }), primary: 0 }); await wait(700);
ok(pl(G, 'Visual' + tag).skin === own({ h: 'h3' }), 'conta trocando pra visual que tem (só h3): os outros veem');
C.send({ t: 'prof', skin: 'x1.0.0.' + 'h3.'.repeat(30), primary: 0 }); await wait(400);
ok(pl(G, 'Visual' + tag).skin === own({ h: 'h3' }), 'código gigante/forjado ignorado');
const C2 = await join(room, { token: tC }); await wait(500);
ok(pl(C2, 'Visual' + tag) && parseLook(pl(C2, 'Visual' + tag).skin), 'ao reentrar, a conta volta com o visual guardado');
for (const c of [C, G, C2]) try { c.ws.close(); } catch (e) { /* */ }
// custo: equipar a mesma coisa de novo não escreve (UPDATE condicional)
const w0 = sql(`SELECT coins, skin, custom FROM accounts WHERE id = ${idC}`)[0];
await call('PUT', '/api/me/skin', { skin: w0.skin }, tC); ok(sql(`SELECT skin FROM accounts WHERE id = ${idC}`)[0].skin === w0.skin, 'equipar o mesmo visual de novo é inofensivo');
console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK'); process.exit(fails.length ? 1 : 0);

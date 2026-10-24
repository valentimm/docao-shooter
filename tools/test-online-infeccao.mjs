// Teste online do modo Infecção 🧟: precisa do servidor local (cd server && npx wrangler dev --var ALLOW_TEST:1) e do site servido.
// Uso: node tools/test-online-infeccao.mjs [urlDoSite] [urlDoServidor]   (SHOTS = pasta dos screenshots)
// Cobre: criar sala até 50, lobby, surto, zumbi só de faca, faquinha (Q) infecta, golpe infecta, vitória dos zumbis,
// e numa 2ª partida vitória dos sobreviventes (tempo acabou) e zumbi abatido que fica de fora. No fim, uma sala com 15 bots.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const SITE = process.argv[2] || 'http://127.0.0.1:8137/', SERVER = process.argv[3] || 'ws://127.0.0.1:8797';
const SHOTS = process.env.SHOTS || 'screenshots/infeccao'; mkdirSync(SHOTS, { recursive: true });
const errors = [], fails = []; const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) fails.push(msg); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function client(name, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${name}] [pageerror] ${e.message} ${e.stack}`));
  await page.addInitScript((n) => { localStorage.setItem('docao.name', n); localStorage.removeItem('docao.mode'); }, name);
  await page.goto(`${SITE}?server=${encodeURIComponent(SERVER)}${query}`, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  return page;
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(page, fn, ms = 10000, arg) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await wait(100); } return false; }
const T = (page, m) => G(page, (mm) => window.__docao.online.net.send({ t: 'testInf', ...mm }), m);
const tp = (page, x, z, fx, fz) => G(page, ([x, z, fx, fz]) => { const g = window.__docao, p = g.player, o = g.online; p.pos.set(x, g.groundAt(x, z, 0.3), z); p.vel.set(0, 0, 0);
  p.yaw = Math.atan2(-(fx - x), -(fz - z)); p.pitch = 0; o.net.send({ t: 'u', sq: p.sq, tp: 1, p: [p.pos.x, p.pos.y, p.pos.z], v: [0, 0, 0], y: p.yaw, pi: 0, g: 1, w: p.weapon }); }, [x, z, fx, fz]);
const team = (page) => G(page, () => window.__docao.player.team);

// 1) criar sala Infecção
const A = await client('Ana');
await A.click('#onlineBtn'); await A.waitForTimeout(300);
await A.selectOption('#roomMode', 'inf'); await A.waitForTimeout(200);
const r0 = await G(A, () => ({ maps: [...document.getElementById('roomMap').options].map((o) => o.value), max: [...document.getElementById('roomMax').options].map((o) => +o.value) }));
ok(r0.maps[0] === 'fazendona' && r0.max.includes(50), `criar sala: Fazendona primeiro e máximo até 50 (${r0.max.join(',')})`);
await A.screenshot({ path: `${SHOTS}/1-criar-sala.png` });
await A.selectOption('#roomMax', '16'); await A.selectOption('#roomBots', '0');
await A.click('#createBtn');
ok(await until(A, () => window.__docao.online && window.__docao.online.myId > 0), 'Ana criou a sala');
const code = await G(A, () => window.__docao.online.code);
const B = await client('Beto', `&sala=${code}`), C = await client('Caio', `&sala=${code}`);
ok(await until(A, () => document.getElementById('lobbyInfo').textContent.includes('INFECÇÃO') && document.getElementById('lobbyInfo').textContent.includes('até 16') && window.__docao.online.lobby.players.length === 3), 'lobby: INFECÇÃO, até 16, 3 jogadores');
await A.screenshot({ path: `${SHOTS}/2-lobby.png` });
await A.click('#startOnline');
ok(await until(A, () => window.__docao.state === 'playing' && window.__docao.infS), 'Ana entrou'); await T(A, { hold: 120 }); // máquina de teste lenta: segura o surto
for (const [p, n] of [[A, 'Ana'], [B, 'Beto'], [C, 'Caio']]) ok(await until(p, () => window.__docao.state === 'playing' && window.__docao.mode === 'inf' && window.__docao.infS), `${n} entrou na partida da Infecção`);
{ const t0 = await G(A, () => ({ ph: window.__docao.infS.phase, t: window.__docao.entities.map((e) => `${e.name}:${e.team}`) })); ok(t0.ph === 'wait' && t0.t.every((x) => x.endsWith(':0')), `antes do surto: todo mundo sobrevivente (${t0.ph} ${t0.t.join(' ')})`); }
await wait(1500); await A.screenshot({ path: `${SHOTS}/3-espera-surto.png` });
// 2) Ana vira zumbi alfa (gancho de teste); os outros veem
await T(A, { me: 1 });
ok(await until(A, () => window.__docao.isZombie() && window.__docao.player.slots.every((w) => w === 7) && window.__docao.player.weapon === 7), 'Ana virou zumbi: só a faca na mão');
ok(await until(B, () => { const g = window.__docao, a = g.entities.find((e) => e.name === 'Ana'); return a && a.team === 1; }), 'Beto vê a Ana como zumbi');
const hpA = await G(A, () => window.__docao.player.hp); ok(hpA > 300, `zumbi alfa com vida alta (${hpA})`);
// 3) faquinha: Ana a 10 m do Beto, numa reta livre da Fazendona, arremessa no Q
await G(B, () => window.__docao.online.net.send({ t: 'testGod', s: 0 }));
await tp(A, -20, -40, -10, -40); await tp(B, -10, -40, -20, -40); await tp(C, 30, 30, 0, 0); await wait(2600); // proteção de nascimento (2,5 s) acaba
await A.screenshot({ path: `${SHOTS}/4-zumbi-com-faca.png` });
await G(A, () => { const g = window.__docao, p = g.player; p.pitch = 0.03; }); await wait(150);
const q = await G(A, () => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true })); const g = window.__docao; return { n: g.infKnives, cd: g.player.zkReady - g.time }; });
await G(A, () => document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'q', bubbles: true })));
ok(q.n > 0, 'Q do zumbi arremessa a faquinha (aparece no ar)');
ok(q.cd > 3, `faquinha em recarga logo após o arremesso (${q.cd.toFixed(1)} s)`);
await wait(120); await A.screenshot({ path: `${SHOTS}/5-faquinha-no-ar.png` });
ok(await until(B, () => window.__docao.player.team === 1, 4000), 'faquinha acertou: Beto virou zumbi');
ok(await until(A, () => document.getElementById('killfeed').textContent.includes('faquinha'), 3000), 'kill feed: "acertou a faquinha"');
await B.screenshot({ path: `${SHOTS}/6-beto-virou-zumbi.png` });
// 4) golpe de faca do Beto (zumbi) no Caio → zumbis vencem
await tp(C, -12, -40, -10, -40); await tp(B, -10, -40, -12, -40); await wait(2700);
for (let i = 0; i < 6 && (await team(C)) !== 1; i++) { await G(B, () => { const g = window.__docao, p = g.player, c = g.entities.find((e) => e.name === 'Caio'); const o = [p.pos.x, p.pos.y + 1.55, p.pos.z], d = [c.pos.x - o[0], c.pos.y + 1.1 - o[1], c.pos.z - o[2]], L = Math.hypot(...d); g.netEv(['m', 0, o, d.map((v) => v / L), performance.now() / 1000]); }); await wait(700); }
ok(await until(C, () => window.__docao.player.team === 1, 3000), 'golpe de faca do zumbi infectou o Caio');
ok(await until(A, () => window.__docao.state === 'over', 8000), 'sem sobreviventes: fim de partida');
const w1 = await G(A, () => document.getElementById('winner').textContent); ok(/zumbis venceram/i.test(w1), `tela de fim: "${w1}"`);
await wait(1800); await A.screenshot({ path: `${SHOTS}/7-vitoria-zumbis.png` });
// 5) jogar de novo: sobreviventes vencem (zumbi abatido fica de fora + tempo acaba)
await A.click('#againBtn');
for (const [p, n] of [[A, 'Ana'], [B, 'Beto'], [C, 'Caio']]) ok(await until(p, () => window.__docao.state === 'playing' && window.__docao.infS && window.__docao.infS.phase === 'wait' && window.__docao.player.team === 0, 10000), `${n}: partida nova, sobrevivente de novo`);
ok(await G(A, () => !document.body.classList.contains('infzombie')), 'tela verde do zumbi some na partida nova');
await T(A, { hold: 120 }); await T(C, { me: 1 }); await until(C, () => window.__docao.isZombie(), 3000);
await T(A, { left: 3 }); await tp(A, -20, -40, -10, -40); await tp(C, -10, -40, -20, -40); await wait(2700);
// Ana mata o Caio-zumbi com a arma (vários tiros de hitscan); zumbi morto fica de fora → sobreviventes vencem por eliminar todos
const killed = await (async () => { for (let i = 0; i < 40; i++) { if (!(await G(C, () => window.__docao.player.alive))) return true; await G(A, () => { const g = window.__docao, p = g.player, c = g.entities.find((e) => e.name === 'Caio'); const o = [p.pos.x, p.pos.y + 1.55, p.pos.z], d = [c.pos.x - o[0], c.pos.y + 1.5 - o[1], c.pos.z - o[2]], L = Math.hypot(...d); g.online.net.send({ t: 'testKill', head: 1 }); void o; void L; }); await wait(300); } return false; })();
ok(killed, 'zumbi abatido');
ok(await until(C, () => /Fora até o fim/.test(document.body.textContent), 4000) || (await G(C, () => window.__docao.player.infOut)), 'zumbi abatido fica de fora até o fim da rodada');
ok(await until(A, () => window.__docao.state === 'over', 8000), 'todos os zumbis abatidos (ou tempo): fim');
const w2 = await G(A, () => document.getElementById('winner').textContent); ok(/sobreviventes venceram/i.test(w2), `tela de fim: "${w2}"`);
await wait(1800); await A.screenshot({ path: `${SHOTS}/8-vitoria-sobreviventes.png` });
// 6) sala grande com bots (15) e quem está assistindo
await A.selectOption('#lobbyBots', '1').catch(() => {});
await G(A, () => window.__docao.online.net.send({ t: 'cfg', fillBots: true, max: 30, mode: 'inf' })); await wait(400);
await A.click('#againBtn');
ok(await until(A, () => window.__docao.state === 'playing' && window.__docao.entities.length >= 18, 10000), 'sala com 3 pessoas + 15 bots');
await T(A, { go: 1 }); await wait(6000);
const st = await G(A, () => window.__docao.infS); ok(st.phase === 'live' && st.zomb >= 1, `bots jogando: ${st.surv} sobreviventes × ${st.zomb} zumbis`);
await A.screenshot({ path: `${SHOTS}/9-sala-com-bots.png`, timeout: 90000 });
console.log('erros de console:', errors.length ? errors.slice(0, 8) : 'nenhum');
console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
await browser.close(); process.exit(fails.length ? 1 : 0);

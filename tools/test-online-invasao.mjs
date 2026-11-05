// Teste online do modo Invasão 🎃: precisa do servidor local (cd server && npx wrangler dev --var ALLOW_TEST:1) e do site servido.
// Uso: node tools/test-online-invasao.mjs [urlDoSite] [urlDoServidor]   (SHOTS = pasta dos screenshots)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const SITE = process.argv[2] || 'http://127.0.0.1:8170/', SERVER = process.argv[3] || 'ws://127.0.0.1:8171';
const SHOTS = process.env.SHOTS || 'screenshots/invasao'; mkdirSync(SHOTS, { recursive: true });
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
const T = (page, m) => G(page, (mm) => window.__docao.online.net.send({ t: 'testInv', ...mm }), m); // gancho de teste do servidor
const NOFOG = { cx: 0, cz: 0, r: 400, tx: 0, tz: 0, tr: 400, fx: 0, fz: 0, fr: 400 }; // névoa longe (pra névoa não confundir os outros testes)
const myLives = (page) => G(page, () => { const g = window.__docao, v = g.invView; return v && v.lives.get(g.online.myId); });
// anda devagar (o servidor recusa teleporte)
async function walkTo(page, x, z, step = 0.22) {
  for (let i = 0; i < 80; i++) {
    const done = await G(page, ([x, z, step]) => { const p = window.__docao.player, dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz); if (d < 0.3) return true; const k = Math.min(step, d) / d; p.pos.x += dx * k; p.pos.z += dz * k; p.pos.y = window.__docao.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.5); return false; }, [x, z, step]);
    if (done) return true; await wait(70);
  }
  return false;
}

// 1) criar sala Invasão
const A = await client('Ana');
await A.click('#onlineBtn'); await A.waitForTimeout(300);
await A.selectOption('#roomMode', 'inv'); await A.waitForTimeout(200);
const roomMaps = await G(A, () => [...document.getElementById('roomMap').options].map((o) => o.value));
ok(roomMaps[0] === 'rodizio' && roomMaps.includes('fazenda-assombrada'), 'criar sala: Invasão lista Rodízio e Fazenda');
await A.selectOption('#roomMap', 'rodizio'); await A.selectOption('#roomMax', '10');
await A.click('#createBtn');
ok(await until(A, () => window.__docao.online && window.__docao.online.myId > 0), 'Ana criou a sala da Invasão');
const code = await G(A, () => window.__docao.online.code);
const B = await client('Beto', `&sala=${code}`);
ok(await until(B, () => window.__docao.online && window.__docao.online.myId > 0), 'Beto entrou pelo link');
ok(await until(A, () => document.getElementById('lobbyInfo').textContent.includes('INVASÃO') && document.getElementById('lobbyInfo').textContent.includes('até 10')), 'lobby: INVASÃO, até 10 jogadores');
const maxCap = await G(A, () => { window.__docao.online.net.send({ t: 'cfg', max: 40, mode: 'inv' }); return true; });
await wait(600);
ok(await G(A, () => window.__docao.online.lobby.cfg.max === 30), 'sala da Invasão aceita até 30 jogadores');
await A.screenshot({ path: `${SHOTS}/online-lobby.png` });
await A.click('#startOnline');
for (const [p, n] of [[A, 'Ana'], [B, 'Beto']]) ok(await until(p, () => window.__docao.state === 'playing' && window.__docao.mode === 'inv' && window.__docao.invView), `${n} entrou na partida da Invasão`);
await until(A, () => !!window.__docao.invHal, 5000);
const s0 = await G(A, () => { const g = window.__docao; return { humans: g.entities.filter((e) => !e.zt).length, bots: g.entities.filter((e) => e.bot && !e.zt).length, hal: !!g.invHal, ph: g.invView.phase }; });
ok(s0.humans === 2 && s0.bots === 0, 'online: só jogadores de verdade, sem bots');
ok(s0.hal && (s0.ph === 'prep' || s0.ph === 'wave'), 'online: decoração de Halloween e partida começando (prep/wave 1)');
ok(await until(A, () => { const v = window.__docao.invView; return [...v.lives.values()].length === 2 && [...v.lives.values()].every((s) => s.lives === 2); }), '2 vidas pra cada um (estado do servidor)');
// 2) wave 1: zumbis aparecem nos dois
await T(A, { wave: 1, fog: NOFOG });
for (const [p, n] of [[A, 'Ana'], [B, 'Beto']]) ok(await until(p, () => window.__docao.invView.phase === 'wave' && window.__docao.entities.some((e) => e.zt && e.alive), 15000), `${n} vê a wave 1 e os zumbis`);
// sem killstreaks online: o servidor recusa (teste de sequência + pedido direto de Gavião/nuke)
await G(A, () => { const o = window.__docao.online; o.net.send({ t: 'testKs', n: 12 }); o.evq.push(['ks', 'h'], ['ks', 'x']); });
await wait(1500);
for (const [p, n] of [[A, 'Ana'], [B, 'Beto']]) { const r = await G(p, () => ({ h: window.__docao.netHelis.length, x: window.__docao.netNukeAt || 0, k: window.__docao.rewardKills })); ok(!r.h && !r.x && !r.k, `${n}: servidor recusa killstreaks na Invasão (Gavião ${r.h}, nuke ${r.x})`); }
// 3) sem fogo amigo: foguete da Ana no pé dela e no Beto
await until(A, () => window.__docao.player.alive && window.__docao.time > window.__docao.player.invulnUntil, 8000); await until(B, () => window.__docao.player.alive && window.__docao.time > window.__docao.player.invulnUntil, 8000);
await T(A, { clearQueue: true, killAll: true });
await wait(500);
const hp0 = await G(B, () => window.__docao.player.hp), hpA0 = await G(A, () => window.__docao.player.hp);
await G(A, () => { const g = window.__docao, p = g.player; g.netEv(['r', [p.pos.x, p.pos.y + 1.6, p.pos.z], [0, -1, 0], performance.now() / 1000]); });
const bp = await G(B, () => { const p = window.__docao.player.pos; return [p.x, p.y, p.z]; });
await G(A, (bp) => { const g = window.__docao, p = g.player, o = [p.pos.x, p.pos.y + 1.6, p.pos.z], d = [bp[0] - o[0], bp[1] + 0.6 - o[1], bp[2] - o[2]], L = Math.hypot(...d); g.netEv(['r', o, d.map((v) => v / L), performance.now() / 1000]); }, bp);
await wait(2500);
const hpA1 = await G(A, () => window.__docao.player.hp), hp1 = await G(B, () => window.__docao.player.hp);
ok(hpA1 >= hpA0 && hp1 >= hp0, `sem fogo amigo online (Ana ${hpA0}→${hpA1}, Beto ${hp0}→${hp1})`);
// 4) drop → pegar → usar (Poção de Cura)
ok(await until(A, () => window.__docao.invView.phase === 'break', 15000), 'wave limpa → pausa (online)');
await T(A, { hold: true, fog: NOFOG }); // a pausa não acaba no meio do teste
ok(await until(A, () => window.__docao.invPick, 3000), 'painel de troca de arma abre na pausa (online)');
const nd0 = await G(B, () => Math.max(0, ...window.__docao.invDrops)); // lê antes de pedir o drop (senão o servidor pode ganhar a corrida)
await T(A, { drop: true });
ok(await until(B, (n) => window.__docao.invDrops.some((d) => d > n), 5000, nd0), 'Beto vê o poder que caiu');
const did = await G(B, () => Math.max(...window.__docao.invDrops));
const dpos = await G(A, () => { const p = window.__docao.player.pos; return [p.x + 2, p.z]; });
await walkTo(A, dpos[0], dpos[1]);
ok(await until(A, () => window.__docao.invInv.length === 1, 5000), 'Ana pegou o poder (inventário do servidor)');
ok(await until(B, (id) => !window.__docao.invDrops.includes(id), 3000, did), 'drop sumiu pro Beto também');
// caixa de munição que o zumbi solta (online): o servidor enche a munição e o cliente espelha
const nd1 = await G(B, () => Math.max(0, ...window.__docao.invDrops));
await T(A, { ammoDrop: true });
await G(A, () => { const p = window.__docao.player; for (const i of p.slots) { p.reserve[i] = 0; p.mag[i] = 0; } });
ok(await until(B, (n) => window.__docao.invDrops.some((d) => d > n), 5000, nd1), 'Beto vê a caixa de munição que caiu');
const aid = await G(B, (n) => Math.min(...window.__docao.invDrops.filter((d) => d > n)), nd1);
const apos = await G(A, () => { const p = window.__docao.player.pos; return [p.x + 2, p.z]; });
await walkTo(A, apos[0], apos[1]);
ok(await until(A, () => { const g = window.__docao, p = g.player, w = g.WEAPONS[p.slots[0]]; return p.reserve[p.slots[0]] >= w.reserve && p.mag[p.slots[0]] === w.mag; }, 5000), 'Ana pegou a caixa de munição do zumbi (reserva e pente cheios, espelhado no cliente)');
ok(await until(B, (id) => !window.__docao.invDrops.includes(id), 3000, aid), 'caixa sumiu pro Beto também');
await T(A, { give: ['potion'], hurt: 45 });
ok(await until(A, () => window.__docao.invInv[0] === 'potion' && window.__docao.player.hp <= 56, 4000), 'gancho: poção no inventário e Ana machucada');
await G(A, () => window.__docao.invUse());
ok(await until(A, () => window.__docao.invInv.length === 0 && window.__docao.player.hp > 90, 4000), 'G usa a Poção de Cura (servidor cura)');
await A.screenshot({ path: `${SHOTS}/online-pausa.png` });
// 5) vidas: Beto morre duas vezes e fica fora
await T(B, { hurt: 500 });
ok(await until(B, async () => !window.__docao.player.alive, 4000), 'Beto morreu');
ok(await until(B, () => { const g = window.__docao, s = g.invView.lives.get(g.online.myId); return s && s.lives === 1 && !s.out; }, 4000), 'Beto: 1 vida sobrando');
await until(B, () => !document.getElementById('respawnBtn').disabled, 8000); await G(B, () => document.getElementById('respawnBtn').click());
ok(await until(B, () => window.__docao.player.alive, 6000), 'Beto renasceu');
await until(B, () => window.__docao.time > window.__docao.player.invulnUntil, 6000);
await T(B, { hurt: 500 });
ok(await until(B, () => { const g = window.__docao, s = g.invView.lives.get(g.online.myId); return s && s.out && !g.player.alive; }, 5000), 'Beto sem vidas: fora');
await wait(3000);
ok(await G(B, () => !document.getElementById('invOut').classList.contains('hidden') && document.getElementById('respawnBtn').disabled), 'Beto vê "SEM VIDAS" e não consegue renascer');
await B.screenshot({ path: `${SHOTS}/online-espectador.png` });
// 6) Ressurreição da Ana traz o Beto
await T(A, { give: ['revive'] }); await until(A, () => window.__docao.invInv[0] === 'revive', 3000);
await G(A, () => window.__docao.invUse());
ok(await until(B, () => { const g = window.__docao, s = g.invView.lives.get(g.online.myId); return g.player.alive && s && !s.out; }, 6000), 'Ressurreição da Ana trouxe o Beto de volta');
// 7) névoa
await until(A, () => window.__docao.time > window.__docao.player.invulnUntil, 5000);
const ah = await G(A, () => window.__docao.player.hp);
await G(A, () => { const p = window.__docao.player.pos; window.__fogAt = [p.x + 80, p.z]; });
const fa = await G(A, () => window.__fogAt);
await T(A, { wave: 2, clearQueue: true, fog: { cx: fa[0], cz: fa[1], r: 3, tx: fa[0], tz: fa[1], tr: 3, fx: fa[0], fz: fa[1], fr: 3 } });
ok(await until(A, (h) => window.__docao.player.hp < h, 8000, ah), 'fora da Névoa Assombrada a Ana perde vida (online)');
ok(await until(A, () => +getComputedStyle(document.getElementById('fogVeil')).opacity > 0.2, 3000), 'tela roxa da névoa (online)');
await T(A, { fog: NOFOG });
// 8) todos fora → fim "sobreviveu até a wave 2"
await T(B, { lives: 1 }); await until(B, () => window.__docao.time > window.__docao.player.invulnUntil, 6000); await T(B, { hurt: 500 });
await T(A, { lives: 1 }); await until(A, () => window.__docao.time > window.__docao.player.invulnUntil, 6000); await T(A, { hurt: 500 });

for (const [p, n] of [[A, 'Ana'], [B, 'Beto']]) ok(await until(p, () => window.__docao.state === 'over', 20000), `${n}: todos fora → fim de jogo`);
const endA = await G(A, () => document.getElementById('winner').textContent);
ok(/Sobreviveu até a wave 2/.test(endA), `tela final online: "${endA}"`);
await A.screenshot({ path: `${SHOTS}/online-fim.png` });
// 9) de novo → vitória na wave 20
await G(A, () => document.getElementById('againBtn').click());
for (const [p, n] of [[A, 'Ana'], [B, 'Beto']]) ok(await until(p, () => window.__docao.state === 'playing' && window.__docao.invView && window.__docao.invView.phase === 'prep', 10000), `${n}: nova partida`);
ok(await until(A, () => [...window.__docao.invView.lives.values()].every((s) => s.lives === 2 && !s.out), 4000), 'nova partida: vidas zeradas (2 de novo)');
await T(A, { wave: 20, clearQueue: true, fog: NOFOG }); await wait(800); await T(A, { killAll: true });
for (const [p, n] of [[A, 'Ana'], [B, 'Beto']]) ok(await until(p, () => window.__docao.state === 'over', 12000), `${n}: wave 20 limpa → fim`);
ok(/sobreviveram às 20 waves/i.test(await G(B, () => document.getElementById('winner').textContent)), 'tela de vitória online');

console.log('\nerros de página:', errors.length ? errors.slice(0, 12).join('\n') : 'nenhum');
ok(errors.length === 0, 'sem erros no console');
await browser.close();
console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

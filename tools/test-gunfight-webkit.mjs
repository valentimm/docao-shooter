// Gunfight no WebKit: um browser, dois contextos (Ana e Beto). Sem segundo Chromium.
// Servidor: cd server && npx wrangler dev --port 8787 --var ALLOW_TEST:1
// Site: python3 -m http.server 8124
import { webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const SITE = process.argv[2] || 'http://127.0.0.1:8124/';
const SERVER = process.argv[3] || 'ws://127.0.0.1:8787';
const OUT = '/opt/cursor/artifacts/gunfight';
mkdirSync(OUT, { recursive: true });

const log = [];
const note = (s) => { const row = new Date().toISOString().slice(11, 19) + ' ' + s; log.push(row); console.log(row); };
const results = [];
const ok = (c, m) => { results.push({ ok: !!c, m }); note((c ? 'OK   ' : 'FALHA') + ' ' + m); };

const browser = await webkit.launch();
const hard = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + ms)), ms))]);

async function boot(name, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => note('PAGE ' + name + ' ' + String(e.message).slice(0, 200)));
  await page.addInitScript((n) => { try { localStorage.setItem('docao.name', n); localStorage.setItem('docao.mode', 'dm'); } catch (e) {} }, name);
  await page.goto(SITE + '?server=' + encodeURIComponent(SERVER), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__docao && window.__docao.renderer, null, { timeout: 25000 });
  await page.evaluate(() => { const r = window.__docao.renderer; r.setPixelRatio(1); if (r.shadowMap) r.shadowMap.enabled = false; });
  return { ctx, page };
}
async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, timeout: 8000 });
  note('shot ' + name);
  return path;
}
async function resize(page, w, h) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250); }
const read = (page) => page.evaluate(() => {
  const g = window.__docao;
  const S = g.gunfight && g.gunfight.S;
  const ents = (g.entities || []).filter((e) => !e.zt).map((e) => ({
    id: e.id, name: e.name, team: e.team, alive: !!e.alive, hp: e.hp | 0,
    slots: (e.slots || []).slice(), bot: !!e.bot, x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2),
    respawnAt: e.respawnAt,
  }));
  const banner = document.getElementById('bombBanner');
  const watch = document.getElementById('gfWatch');
  const hp = document.getElementById('gfHpRow');
  const hr = hp ? hp.getBoundingClientRect() : null;
  return {
    state: g.state, mode: g.mode, map: g.map && g.map.id,
    phase: S && S.phase, round: S && S.round, timeLeft: S ? +S.timeLeft.toFixed(2) : null,
    score: S && S.score && S.score.slice(), format: S && S.format, classId: S && S.classId,
    over: S && S.over, reason: S && S.reason, winner: S && S.winner,
    ents, me: g.player && { alive: !!g.player.alive, team: g.player.team, slots: (g.player.slots || []).slice(), hp: g.player.hp | 0 },
    banner: banner && !banner.classList.contains('hidden') ? banner.innerText : '',
    banners: (window.__gfBanners || []).slice(-8),
    watch: watch && !watch.classList.contains('hidden') ? watch.textContent : '',
    hpBox: hr ? { x: Math.round(hr.x), y: Math.round(hr.y), w: Math.round(hr.width), h: Math.round(hr.height) } : null,
    timer: document.getElementById('timer') ? document.getElementById('timer').textContent : '',
    winnerText: document.getElementById('winner') ? document.getElementById('winner').textContent : '',
    gfLabel: document.getElementById('gfSideLabel') ? !document.getElementById('gfSideLabel').classList.contains('hidden') : false,
  };
});
async function until(page, fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

let ana, beto;
try {
  ana = await boot('Ana', 1280, 800);
  await ana.page.selectOption('#modeSel', 'gf');
  await ana.page.waitForTimeout(300);
  const menu = await read(ana.page);
  ok(menu.gfLabel, 'menu mostra o seletor de formato');
  await shot(ana.page, 'menu-formato-1280x800');
  await resize(ana.page, 1440, 900);
  await shot(ana.page, 'menu-formato-1440x900');
  await resize(ana.page, 1280, 800);

  await ana.page.click('#onlineBtn');
  await ana.page.selectOption('#roomMode', 'gf');
  await ana.page.selectOption('#roomGf', '2');
  await ana.page.selectOption('#roomBots', '1');
  await ana.page.waitForTimeout(200);
  const maps = await ana.page.evaluate(() => [...document.getElementById('roomMap').options].map((o) => o.value));
  ok(maps.includes('x1-curral'), 'sala 2v2 lista mapa do pool (' + maps.join(',') + ')');
  await ana.page.selectOption('#roomMap', 'x1-curral');
  await ana.page.click('#createBtn');
  ok(await until(ana.page, () => window.__docao.online && window.__docao.online.myId > 0, 15000), 'Ana criou a sala');
  const code = await ana.page.evaluate(() => window.__docao.online.code);
  note('sala ' + code);
  await ana.page.click('#lobbyTeamBtns .teambtn.t0');

  beto = await boot('Beto', 1280, 800);
  await beto.page.goto(SITE + '?server=' + encodeURIComponent(SERVER) + '&sala=' + code, { waitUntil: 'domcontentloaded', timeout: 30000 });
  ok(await until(beto.page, () => window.__docao.online && window.__docao.online.code, 15000), 'Beto entrou na sala');
  await beto.page.click('#lobbyTeamBtns .teambtn.t0');
  await ana.page.waitForTimeout(400);
  await ana.page.click('#startOnline');
  ok(await until(ana.page, () => window.__docao.state === 'playing' && window.__docao.mode === 'gf' && window.__docao.gunfight.S, 20000), 'partida online Gunfight');
  ok(await until(beto.page, () => window.__docao.state === 'playing' && window.__docao.mode === 'gf', 20000), 'Beto na mesma partida');
  ok(await until(ana.page, () => window.__docao.gunfight.S && window.__docao.gunfight.S.phase === 'live', 12000), 'prep de 4 s virou live');

  const live = await read(ana.page);
  note('live ' + JSON.stringify({ phase: live.phase, round: live.round, time: live.timeLeft, timer: live.timer, score: live.score, format: live.format, map: live.map, me: live.me, n: live.ents.length, teams: live.ents.map((e) => e.team + (e.bot ? 'b' : 'h')) }));
  ok(live.map === 'x1-curral' && live.format === '2v2', 'mapa do pool e formato 2v2');
  ok(live.me && live.me.slots.length === 1 && live.ents.every((e) => e.slots.length === 1), 'só 1 slot de arma');
  ok(live.ents.filter((e) => e.team === 0).length === 2 && live.ents.filter((e) => e.team === 1).length === 2, 'Ana e Beto no mesmo time, dois bots no outro');
  ok(live.timer.startsWith('0:') && !live.timer.startsWith('1:'), 'timer do live não é 1:14 (' + live.timer + ')');
  ok(live.hpBox && live.hpBox.x < 280 && live.hpBox.y > 80, 'cards de vida no canto esquerdo ' + JSON.stringify(live.hpBox));
  await shot(ana.page, 'live-2v2-1280x800');
  await resize(ana.page, 1440, 900);
  await shot(ana.page, 'live-2v2-1440x900');
  await resize(ana.page, 1280, 800);

  const scored = await until(ana.page, () => {
    const S = window.__docao.gunfight.S;
    return S && (S.score[0] + S.score[1] > 0);
  }, 45000);
  const both = await Promise.all([read(ana.page), read(beto.page)]);
  ok(scored && both[0].score && both[1].score && both[0].score[0] === both[1].score[0] && both[0].score[1] === both[1].score[1] && both[0].score[0] + both[0].score[1] > 0, 'eliminação atualiza o placar nos dois clientes ' + JSON.stringify([both[0].score, both[1].score]));
  const deadLive = both[0].ents.filter((e) => !e.alive && both[0].phase === 'live');
  if (deadLive.length && both[0].phase === 'live') {
    await ana.page.waitForTimeout(1200);
    const still = await read(ana.page);
    const same = still.phase === 'live' && deadLive.every((d) => still.ents.some((e) => e.id === d.id && !e.alive));
    ok(same, 'morto no live continua morto 1,2 s depois');
  } else note('sem corpo no live neste instante (fase ' + both[0].phase + ') — o placar já mudou');

  const died = await until(ana.page, () => window.__docao.player && !window.__docao.player.alive, 25000);
  if (died) {
    await ana.page.waitForTimeout(1100);
    const spec = await read(ana.page);
    note('spec ' + spec.watch + ' banners ' + spec.banners.join(' | '));
    ok(/Assistindo/.test(spec.watch), 'depois da killcam o espectador segue alguém (' + spec.watch + ')');
    await shot(ana.page, 'espectador-1280x800');
    await resize(ana.page, 1440, 900);
    await shot(ana.page, 'espectador-1440x900');
    await resize(ana.page, 1280, 800);
    const before = spec.watch;
    await ana.page.mouse.click(640, 420);
    await ana.page.waitForTimeout(400);
    const after = await read(ana.page);
    note('clique ' + before + ' -> ' + after.watch);
    ok(!!after.watch, 'clique no espectador mantém um alvo (' + after.watch + ')');
  } else note('Ana não morreu em 25 s neste 2v2 — espectador online fica para o 3v3');

  const round3 = await until(ana.page, () => window.__docao.gunfight.S && window.__docao.gunfight.S.round >= 3, 100000);
  const r3 = await read(ana.page);
  note('r3 ' + JSON.stringify({ round: r3.round, phase: r3.phase, banner: r3.banner, banners: r3.banners, score: r3.score }));
  ok(round3 && r3.round >= 3, 'chegou no round ' + r3.round);
  ok((r3.banners || []).some((t) => /Troca de lado/.test(t)) || /Troca de lado/.test(r3.banner), 'banner Troca de lado apareceu');
  await shot(ana.page, 'troca-lado-1280x800');
  await resize(ana.page, 1440, 900);
  await shot(ana.page, 'troca-lado-1440x900');
  await resize(ana.page, 1280, 800);

  const ended = await until(ana.page, () => window.__docao.state === 'over', 150000);
  const end = await read(ana.page);
  note('fim ' + end.state + ' ' + end.winnerText + ' ' + JSON.stringify(end.score));
  ok(ended && end.state === 'over', 'fim de partida no fluxo normal');
  await shot(ana.page, 'fim-1280x800');
  await resize(ana.page, 1440, 900);
  await shot(ana.page, 'fim-1440x900');
  await resize(ana.page, 1280, 800);

  await ana.page.evaluate(() => { if (window.__docao.online) window.__docao.online.net.send({ t: 'lobby' }); });
  await until(ana.page, () => document.getElementById('lobby') && !document.getElementById('lobby').classList.contains('hidden'), 8000);
  await ana.page.selectOption('#lobbyMode', 'gf');
  await ana.page.selectOption('#lobbyGf', '2');
  await ana.page.selectOption('#lobbyBots', '1');
  await ana.page.waitForTimeout(300);
  const maps2 = await ana.page.evaluate(() => [...document.getElementById('lobbyMap').options].map((o) => o.value));
  if (maps2.includes('galpao-assalto')) await ana.page.selectOption('#lobbyMap', 'galpao-assalto');
  await ana.page.click('#startOnline');
  ok(await until(ana.page, () => window.__docao.state === 'playing' && window.__docao.gunfight.S && window.__docao.map && window.__docao.map.id === 'galpao-assalto', 20000), 'segunda partida no Galpão');
  const ot = await until(ana.page, () => { const S = window.__docao.gunfight.S; return S && (S.phase === 'ot' || S.reason === 'elim' || (S.score && S.score[0] + S.score[1] > 0)); }, 55000);
  const otS = await read(ana.page);
  note('ot-check ' + JSON.stringify({ phase: otS.phase, reason: otS.reason, score: otS.score, round: otS.round, timer: otS.timer }));
  if (otS.phase === 'ot') {
    ok(true, 'overtime com zona no navegador');
    await shot(ana.page, 'overtime-1280x800');
    await resize(ana.page, 1440, 900);
    await shot(ana.page, 'overtime-1440x900');
  } else {
    ok(false, 'overtime no navegador não chegou (fase ' + otS.phase + ' motivo ' + otS.reason + ' placar ' + JSON.stringify(otS.score) + ')');
  }

  await ana.page.evaluate(() => window.__docao.toMenu());
  await until(ana.page, () => window.__docao.state === 'menu', 8000);
  await ana.page.selectOption('#modeSel', 'gf');
  await ana.page.selectOption('#gfSide', '3');
  await ana.page.click('#playBtn');
  ok(await until(ana.page, () => window.__docao.state === 'playing' && window.__docao.mode === 'gf' && !window.__docao.online, 20000), 'offline 3v3 começou');
  const off = await read(ana.page);
  note('off ' + JSON.stringify({ format: off.format, phase: off.phase, time: off.timeLeft, timer: off.timer, n: off.ents.length, teams: off.ents.map((e) => e.team), slots: off.me && off.me.slots }));
  ok(off.format === '3v3' && off.ents.length === 6, 'offline 3v3 tem 6 docões');
  ok(off.ents.filter((e) => e.team === 0).length === 3 && off.ents.filter((e) => e.team === 1).length === 3, 'três de cada lado');
  ok(off.me && off.me.slots.length === 1 && off.ents.every((e) => e.slots.length === 1), 'offline também é 1 arma');
  ok(off.phase === 'prep' && off.timeLeft <= 4 && off.timeLeft > 2, 'prep offline perto de 4 s (' + off.timeLeft + ')');
  ok(await until(ana.page, () => window.__docao.gunfight.S.phase === 'live', 8000), 'offline entrou no live');
  const offLive = await read(ana.page);
  ok(offLive.timer.startsWith('0:') && offLive.timeLeft > 45 && offLive.timeLeft <= 50, '3v3 live ~50 s (' + offLive.timer + ' ' + offLive.timeLeft + ')');
  const victimId = await ana.page.evaluate(() => {
    const foe = window.__docao.entities.find((e) => e.bot && e.alive && e.team !== window.__docao.player.team);
    window.__docao.kill(foe);
    return foe.id;
  });
  await ana.page.waitForTimeout(1500);
  const afterKill = await read(ana.page);
  const corpse = afterKill.ents.find((e) => e.id === victimId);
  ok(afterKill.phase === 'live' && corpse && !corpse.alive, 'offline: abate no live não renasce em 1,5 s');
  await ana.page.evaluate(() => window.__docao.kill(window.__docao.player));
  await ana.page.waitForTimeout(1100);
  const spec3 = await read(ana.page);
  note('spec3 ' + spec3.watch);
  ok(/Assistindo/.test(spec3.watch), '3v3 espectador após a morte (' + spec3.watch + ')');
  const w0 = spec3.watch;
  await ana.page.mouse.click(640, 420);
  await ana.page.waitForTimeout(300);
  const w1 = (await read(ana.page)).watch;
  note('troca alvo ' + w0 + ' -> ' + w1);
  ok(w1 && w1 !== w0, 'clique troca o aliado assistido');
} catch (e) {
  note('ERRO ' + (e && e.stack || e));
  ok(false, 'exceção: ' + (e && e.message));
  try { if (ana) await shot(ana.page, 'erro'); } catch { /* */ }
} finally {
  writeFileSync(OUT + '/resultado.json', JSON.stringify({ results, log }, null, 2));
  await browser.close();
}
const bad = results.filter((r) => !r.ok).length;
note(bad ? bad + ' FALHA(S)' : 'TUDO OK');
process.exit(bad ? 1 : 0);

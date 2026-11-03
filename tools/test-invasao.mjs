// Teste do modo Invasão 🎃 (offline + regras puras). Uso: node tools/test-invasao.mjs [urlDoSite]
// Site servido na raiz do repo (ex.: python3 -m http.server 8170). Screenshots em SHOTS (padrão screenshots/invasao).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { INV, waveSpec, waveQueue, fogRadius, reviveAllowed, noteRevive, scaleHit, POWER_KEYS, ZTYPES } from '../shared/invasion.js';
import { MAPS, PLAY_MAPS, INV_MAPS } from '../maps.js';
const SITE = process.argv[2] || 'http://127.0.0.1:8170/';
const SHOTS = process.env.SHOTS || 'screenshots/invasao'; mkdirSync(SHOTS, { recursive: true });
const errors = [], fails = []; const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) fails.push(msg); };

// ---------- 0) regras puras ----------
{
  const tot = []; for (let w = 1; w <= INV.WAVES; w++) tot.push(waveSpec(w, 1));
  ok(tot.every((s, i) => i === 0 || (s.total >= tot[i - 1].total && s.hpMul > tot[i - 1].hpMul)), '20 waves: cada uma com mais zumbis e mais vida que a anterior');
  ok(tot.filter((s) => s.boss).map((s) => s.w).join() === '5,10,15,20', 'chefão Docão Abóbora nas waves 5, 10, 15 e 20');
  ok(waveSpec(1, 4).total > waveSpec(1, 1).total && waveSpec(1, 10).n === 10 && waveSpec(1, 50).n === 30, 'mais jogadores = wave maior (limite de 30)');
  ok(waveSpec(1, 1).total === 18 && waveSpec(20, 1).total === 132 && waveSpec(1, 4).total === 50, `zumbis por wave: 18 (w1) → 132 (w20) solo; 50 na w1 com 4 jogadores`);
  ok(tot.every((s) => s.maxAlive <= 48 && s.batch >= 2 && s.batch <= 6) && waveSpec(20, 10).maxAlive === 48, 'teto de vivos (≤ 48) e lotes de 2–6');
  ok(waveSpec(20, 1).spdMul > waveSpec(1, 1).spdMul && waveSpec(20, 1).spdMul <= 1.45, 'velocidade cresce com a wave (até 1,45×)');
  const q1 = waveQueue(waveSpec(1)), q12 = waveQueue(waveSpec(12));
  ok(q1.every((k) => k === 'walker'), 'wave 1 só tem Docão Podre (walker)');
  ok(['runner', 'spitter', 'tank'].every((k) => q12.includes(k) || waveSpec(12).mix[k] > 0), 'wave 12 mistura corredor, cuspidor e barrigão');
  ok(fogRadius(1, 40, 40) > fogRadius(10, 40, 40) && fogRadius(10, 40, 40) > fogRadius(20, 40, 40) && fogRadius(20, 40, 40) >= INV.FOG_MIN_R, 'névoa fecha a cada wave (com raio mínimo)');
  // Ressurreição: máx. 1 por wave e 4 por bloco de 5 waves
  const c = { wave: {}, block: {} }; let got = 0;
  for (let w = 1; w <= 5; w++) for (let k = 0; k < 3; k++) if (reviveAllowed(c, w)) { noteRevive(c, w); got++; }
  ok(got === 4, `Ressurreição: no máximo 4 no bloco de waves 1–5 (caíram ${got})`);
  ok(!reviveAllowed({ wave: { 3: 1 }, block: { 0: 1 } }, 3) && reviveAllowed({ wave: { 3: 1 }, block: { 0: 1 } }, 4), 'Ressurreição: no máximo 1 por wave');
  ok(reviveAllowed(c, 6), 'Ressurreição: bloco novo (waves 6–10) libera de novo');
  const big = scaleHit({ x: 0, y: 1.0, z: 5 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, 1.7, (o) => (Math.abs(o.x) < 0.5 && o.y < 2 ? { t: o.z - 0.4 } : null));
  ok(big && Math.abs(big.t - (5 / 1.7 - 0.4) * 1.7) < 1e-6, 'hitbox escalada pro zumbi grande');
  ok(INV_MAPS[0].id === 'rodizio' && INV_MAPS[1].id === 'fazenda-assombrada' && !PLAY_MAPS.some((m) => m.id === 'rodizio' || m.id === 'fazenda-assombrada'), 'Rodízio e Fazenda Mal-Assombrada só na Invasão');
  ok(MAPS.some((m) => m.id === 'fazenda-assombrada' && m.invasionOnly), 'mapa novo de Halloween existe');
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + ' ' + e.stack));
await page.addInitScript(() => { localStorage.setItem('docao.name', 'Matheus'); localStorage.removeItem('docao.mode'); localStorage.removeItem('docao.invMap'); });
await page.goto(SITE, { waitUntil: 'load' }); await page.waitForTimeout(2500);
const G = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
// tempo de JOGO (o swiftshader roda a poucos FPS e o dt é limitado a 0,05 s por quadro)
async function waitGame(sec, maxMs = 30000) { const t0 = await G(() => window.__docao.time), r0 = Date.now(); while (Date.now() - r0 < maxMs) { if ((await G(() => window.__docao.time)) - t0 >= sec) return; await wait(100); } }
async function until(fn, ms = 8000, arg) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await wait(100); } return false; }

// ---------- 1) menu ----------
const gridIds = () => G(() => { document.getElementById('mapBtn').click(); const ids = [...document.querySelectorAll('#mapGrid .mapcard')].map((c) => c.dataset.map); document.getElementById('mapClose').click(); return ids; });
const dmGrid = await gridIds();
ok(!dmGrid.includes('rodizio') && !dmGrid.includes('fazenda-assombrada'), 'Mata-mata: grade de mapas sem os mapas da Invasão');
await page.selectOption('#modeSel', 'inv'); await wait(600);
const invGrid = await gridIds();
ok(invGrid[0] === 'rodizio' && invGrid.includes('fazenda-assombrada') && invGrid.includes('arena'), 'Invasão: grade com Rodízio, Fazenda e os mapas normais');
ok(await G(() => window.__docao.map.id === 'rodizio'), 'Invasão: mapa padrão é o Rodízio');
ok(await G(() => document.getElementById('playBtn').textContent.includes('SOBREVIVER') && document.getElementById('menuRules').textContent.includes('20 waves')), 'menu mostra regras e botão da Invasão');
ok(await G(() => document.getElementById('botCount').closest('label').classList.contains('hidden')), 'Invasão: sem opção de bots');
await page.screenshot({ path: `${SHOTS}/menu-invasao.png` });

// ---------- 2) partida solo ----------
await page.click('#playBtn'); await wait(1200);
const st0 = await G(() => { const g = window.__docao; return { mode: g.mode, n: g.entities.length, hal: !!g.invHal, ph: g.invView.phase, lives: g.invView.lives.get(-1), sky: g.camera && document.body.classList.contains('invmode') }; });
ok(st0.mode === 'inv' && st0.n === 1, 'Invasão solo: só você, sem bots');
ok(st0.hal && st0.sky, 'decoração de Halloween ligada no Rodízio');
ok(st0.ph === 'prep' && st0.lives && st0.lives.lives === 2, 'preparação antes da wave 1 e 2 vidas');
ok(await G(() => !document.getElementById('invBanner').classList.contains('hidden')), 'banner de início aparece');
// sem fogo amigo: foguete no próprio pé e dano de jogador não machucam
const ff = await G(() => { const g = window.__docao, p = g.player; p.invulnUntil = 0; const hp0 = p.hp; g.blastAt(p.pos.x, p.pos.y + 0.3, p.pos.z, 'r', p); const k = g.lastKnock; const d = g.damage(p, 50, p, 0, false); return { hp0, hp: p.hp, d, knock: k > 0 }; });
ok(ff.hp === ff.hp0 && !ff.d, 'sem dano próprio/amigo (foguete no pé e tiro)');
ok(ff.knock, 'rocket jump ainda empurra');
// força a wave 1
await G(() => { const g = window.__docao; g.inv.phaseEnd = g.time; });
ok(await until(() => window.__docao.invView.phase === 'wave' && window.__docao.entities.some((e) => e.zt && e.alive), 25000), 'wave 1 começou e zumbis nasceram');
ok(await until(() => window.__docao.invMusic && window.__docao.invMusic.on && window.__docao.invMusic.level === 1, 5000), 'trilha de terror tocando (intensidade de wave)');
ok(await until(() => window.__docao.entities.filter((e) => e.zt && e.alive).length >= 2, 15000), 'zumbis entram em lote');
ok(await G(() => window.__docao.invView.remaining >= 15 && window.__docao.entities.filter((e) => e.zt && e.alive).length <= window.__docao.inv.spec.maxAlive), 'wave 1 com ~18 zumbis e vivos dentro do teto');
ok(await G(() => document.getElementById('invWaveN').textContent.includes('WAVE 1/20')), 'HUD mostra WAVE 1/20');
// sem killstreaks na Invasão (só os poderes G/X)
{
  const ks = await G(() => { const g = window.__docao; for (let i = 0; i < 12; i++) g.rewardKill(); g.useStreak(); g.callNuke(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    const vis = (id) => { const n = document.getElementById(id); return !!n && getComputedStyle(n).display !== 'none' && !n.hidden; };
    return { k: g.rewardKills, ready: g.streakReady.length, nuke: g.nukeReady, at: g.nukeAt, pred: !!g.predator, heli: !!g.heli, hud: vis('streakCount') || vis('streakBar') || vis('nukeReady') }; });
  ok(ks.k === 0 && ks.ready === 0 && !ks.nuke && !ks.at, `Invasão: abates não rendem killstreak (${ks.k} na sequência, ${ks.ready} prontos)`);
  ok(!ks.pred && !ks.heli, 'Invasão: F não chama míssil/Gavião/nuke');
  ok(!ks.hud, 'Invasão: sem coluna/HUD de killstreak');
}
await page.screenshot({ path: `${SHOTS}/wave-banner.png` });
// zumbis nascem na borda (longe do jogador)
const zd = await G(() => { const g = window.__docao, p = g.player; return Math.min(...g.entities.filter((e) => e.zt).map((e) => e.pos.distanceTo(p.pos))); });
ok(zd >= 11.5, `zumbis nascem a 12+ m do jogador (${zd.toFixed(1)} m)`);
{ // espalhados pelo mapa (não só na borda) e quase sempre fora da visão do jogador — mesma regra no servidor
  const r = await G(() => { const g = window.__docao, I = g.inv, p = g.player, out = []; for (let i = 0; i < 40; i++) out.push(I.spawnPos()); const [hx, hz] = g.map.size;
    const inner = out.filter((q) => Math.abs(q.x) < hx - 8 && Math.abs(q.z) < hz - 8).length, near = out.filter((q) => Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < 11.5).length;
    const seen = out.filter((q) => g.visible({ pos: new g.V3(q.x, q.y, q.z), crouch: 0 })).length; return { inner, near, seen }; });
  ok(r.inner >= 10 && r.near === 0, `nascem em pontos aleatórios do mapa (${r.inner}/40 longe da borda, ${r.near} perto do jogador)`);
  ok(r.seen <= 8, `nascem fora da visão do jogador (${r.seen}/40 visíveis)`);
}
// mata a wave inteira → pausa
await G(() => { const g = window.__docao; g.inv.queue = []; for (const z of g.entities.filter((e) => e.zt && e.alive)) g.damage(z, 1e5, g.player, 0, false); });
ok(await until(() => window.__docao.invView.phase === 'break', 6000), 'wave limpa → pausa entre waves');
ok(await G(() => window.__docao.invView.left > 12 && window.__docao.invView.left <= 15), 'pausa de ~15 s');
ok(await until(() => window.__docao.invMusic.level === 0, 3000), 'música acalma na pausa');
ok(await G(() => window.__docao.invPick && !document.getElementById('iLoad').classList.contains('hidden')), 'painel de troca de arma abre na pausa');
await page.keyboard.press('Digit3'); await wait(200);
const swapped = await G(() => { const g = window.__docao; return g.player.primary === g.selectedPrimary && g.player.slots[0] === g.selectedPrimary; });
ok(swapped, 'troca de primária na pausa vale na hora');
await page.screenshot({ path: `${SHOTS}/pausa-loadout.png` });
await page.keyboard.press('KeyB'); await wait(200);
ok(await G(() => !window.__docao.invPick), 'B fecha o painel');
// ---------- 3) poderes ----------
const dropped = await G(() => { const g = window.__docao, p = g.player; const d = g.inv.drop({ x: p.pos.x + 3, y: p.pos.y, z: p.pos.z }, false); d.kind = 'potion'; return d.id; });
ok(await until((id) => window.__docao.invDrops.includes(id), 2000, dropped), 'poder caiu no chão (drop visível)');
await G((id) => { const g = window.__docao, p = g.player, d = g.inv.drops.find((x) => x.id === id); p.pos.set(d.x, d.y, d.z); }, dropped);
ok(await until(() => window.__docao.invInv.length === 1, 3000), 'andou por cima → pegou o poder');
ok(await G(() => document.querySelectorAll('#invSlots .islot.on').length === 1 && document.querySelector('#invSlots .islot.sel').textContent.includes('🧪')), 'HUD mostra o poder no slot');
await G(() => window.__docao.invGive(['pumpkin', 'howl', 'lantern']));
const cap = await G(() => { const g = window.__docao, p = g.player; const d = g.inv.drop({ x: p.pos.x, y: p.pos.y, z: p.pos.z }, false); return d.id; });
await wait(600);
ok(await G((id) => window.__docao.invInv.length === 3 && window.__docao.invDrops.includes(id), cap), 'inventário cheio (3): não pega o 4º');
await G((id) => { const I = window.__docao.inv; I.drops = I.drops.filter((d) => d.id !== id); }, cap); // tira do chão (senão pega quando abrir vaga)
await page.keyboard.press('KeyX'); await wait(100);
ok(await G(() => window.__docao.invSel === 1), 'X troca o poder selecionado');
await page.screenshot({ path: `${SHOTS}/hud-poderes.png` });
// próxima wave + uivo
await G(() => { const g = window.__docao; g.inv.phaseEnd = g.time; });
ok(await until(() => window.__docao.invView.phase === 'wave' && window.__docao.invView.wave === 2, 4000), 'wave 2 começou depois da pausa');
const howl = await G(() => { const g = window.__docao, p = g.player; const z = g.inv.spawn('walker'); z.pos.set(p.pos.x + 3, p.pos.y, p.pos.z); return z.id; });
await page.keyboard.press('KeyG'); await waitGame(0.2);
const hw = await G((id) => { const g = window.__docao, z = g.inv.zombies.find((x) => x.id === id); return { stun: z.stunUntil > g.time, inv: g.invInv, sel: g.invSel, alive: z.alive }; }, howl);
console.log('uivo', JSON.stringify(hw));
ok(hw.stun && hw.inv.length === 2 && !hw.inv.includes('howl'), 'G usa o Uivo do Lobisomem: atordoa e sai do inventário');
// ---------- 4) névoa ----------
const fog = await G(() => { const g = window.__docao, p = g.player, I = g.inv; p.invulnUntil = 0; p.hp = 100; Object.assign(I.fog, { cx: p.pos.x + 60, cz: p.pos.z, r: 5, tx: p.pos.x + 60, tz: p.pos.z, tr: 5, fx: p.pos.x + 60, fz: p.pos.z, fr: 5, t0: g.time, t1: g.time + 999 }); const z = I.spawn('walker'); z.pos.set(p.pos.x - 8, p.pos.y, p.pos.z); z.stunUntil = g.time + 99; window.__fz = z; return true; });
await waitGame(1.6);
const fg = await G(() => { const g = window.__docao; return { hp: g.player.hp, veil: +getComputedStyle(document.getElementById('fogVeil')).opacity, arrow: !document.getElementById('invFogArrow').classList.contains('hidden'), zhp: window.__fz.alive && window.__fz.hp === window.__fz.maxHp }; });
ok(fg.hp < 100, `fora da Névoa Assombrada perde vida (${fg.hp.toFixed(0)})`);
ok(fg.veil > 0.2 && fg.arrow, 'tela roxa + seta pra área segura');
ok(fg.zhp, 'zumbi fora da névoa não perde vida');
await page.screenshot({ path: `${SHOTS}/nevoa-fora.png` });
// névoa vista de cima
await G(() => { const g = window.__docao, p = g.player, I = g.inv; p.hp = 100; Object.assign(I.fog, { cx: 0, cz: -10, r: 22, tx: 6, tz: -14, tr: 14, fx: 0, fz: -10, fr: 22, t0: g.time, t1: g.time + 999 }); window.__cam = { p: [38, 44, 46], t: [0, 0, -8], fov: 70 }; });
await wait(700); await page.screenshot({ path: `${SHOTS}/nevoa-circulo.png` });
await G(() => { window.__cam = null; const I = window.__docao.inv; const R = 200; Object.assign(I.fog, { cx: 0, cz: 0, r: R, tx: 0, tz: 0, tr: R, fx: 0, fz: 0, fr: R }); I.planFog = () => {}; });
// ---------- 5) vidas, espectador, Ressurreição, fim ----------
await G(() => { const g = window.__docao; for (const z of g.inv.zombies) if (z.alive) g.damage(z, 1e6, g.player, 0, false); g.inv.queue = []; g.inv.bossPending = false; });
await G(() => { const g = window.__docao, p = g.player; p.invulnUntil = 0; g.kill(p); });
const l1 = await G(() => { const g = window.__docao; return { lives: g.invView.lives.get(-1), rs: Number.isFinite(g.player.respawnAt) }; });
ok(l1.lives.lives === 1 && !l1.lives.out && l1.rs, 'morreu: 1 vida sobrando e pode renascer');
await G(() => { const g = window.__docao; g.time = g.player.respawnAt + 0.1; }); await page.keyboard.press('Space'); await wait(300);
ok(await G(() => window.__docao.player.alive), 'renasceu com a vida que sobrou');
// segura o fim de jogo (Ressurreição): finge um aliado vivo
await G(() => { const g = window.__docao, I = g.inv; window.__mate = { id: 77, isPlayer: false, name: 'Aliado', pos: g.player.pos.clone(), vel: new g.V3(), alive: true, hp: 100, yaw: 0, pitch: 0 }; const P = I.A.players; I.A.players = () => [...P(), window.__mate]; I.ensure(window.__mate, true); });
await G(() => { const g = window.__docao, p = g.player; p.invulnUntil = 0; g.kill(p); });
await waitGame(2.8);
const out = await G(() => { const g = window.__docao; return { s: g.invView.lives.get(-1), rs: g.player.respawnAt, ui: !document.getElementById('invOut').classList.contains('hidden'), btn: document.getElementById('respawnBtn').textContent }; });
ok(out.s.out && out.s.lives === 0 && out.rs === Infinity, 'sem vidas: fica fora (não renasce)');
ok(out.ui && out.btn.includes('Ressurreição'), 'tela de espectador "SEM VIDAS" e botão travado');
await page.screenshot({ path: `${SHOTS}/sem-vidas.png` });
// aliado usa a Ressurreição
await G(() => { const g = window.__docao, I = g.inv; window.__mate.inv = ['revive']; I.usePower(window.__mate, 0, { o: window.__mate.pos, d: { x: 0, y: 0, z: -1 } }); });
await wait(300);
ok(await G(() => { const g = window.__docao, s = g.invView.lives.get(-1); return g.player.alive && !s.out && s.lives === 1; }), 'Ressurreição traz de volta quem estava fora');
// todo mundo fora = fim
await G(() => { const g = window.__docao, I = g.inv; window.__mate.alive = false; window.__mate.out = true; window.__mate.lives = 0; g.player.lives = 1; g.player.invulnUntil = 0; g.kill(g.player); });
ok(await until(() => window.__docao.state === 'over', 20000), 'todos fora → fim de jogo');
const endTxt = await G(() => document.getElementById('winner').textContent);
ok(/Sobreviveu até a wave 2/.test(endTxt), `tela final: "${endTxt}"`);
await page.screenshot({ path: `${SHOTS}/fim-wave.png` });

// ---------- 6) vitória na wave 20 ----------
await G(() => window.__docao.startGame('rodizio')); await wait(800);
await G(() => window.__docao.inv.startWave(20)); ok(await until(() => window.__docao.invMusic.level === 2, 4000), 'música mais intensa na wave do chefão');
await G(() => { const g = window.__docao, I = g.inv; I.queue = []; I.bossPending = false; for (const z of I.zombies) if (z.alive) g.damage(z, 1e6, g.player, 0, false); });
ok(await until(() => window.__docao.state === 'over', 20000), 'wave 20 limpa → vitória');
ok(/sobreviveram às 20 waves/i.test(await G(() => document.getElementById('winner').textContent)), 'tela de vitória');

// ---------- 7) tipos de zumbi + chefão (screenshots sem HUD) ----------
const hud = (on) => G((v) => { document.getElementById('hud').style.visibility = v ? '' : 'hidden'; }, on);
await G(() => window.__docao.startGame('rodizio')); await wait(800);
const types = await G(() => {
  const g = window.__docao, I = g.inv, p = g.player; I.phase = 'break'; I.phaseEnd = 1e9; window.__stopAt = g.time + 0.05;
  // praça aberta: o ponto do nav com mais vizinhos livres na frente (zumbis em fila + câmera)
  const good = g.nav.good.filter((n) => n.y < 0.5); let c = good[0], bc = -1;
  for (let i = 0; i < 400; i++) { const q = good[Math.floor(Math.random() * good.length)]; let k = 0; for (const n of good) if (Math.abs(n.y - q.y) < 0.4 && Math.abs(n.x - q.x) < 9 && n.z - q.z > -3 && n.z - q.z < 13) k++; if (k > bc) { bc = k; c = q; } }
  const out = []; ['walker', 'runner', 'tank', 'spitter', 'boss'].forEach((t, i) => { const z = I.spawn(t); const x = c.x - 6.4 + i * 3.2; z.pos.set(x, g.groundAt(x, c.z, c.y + 1), c.z); z.yaw = 0; z.stunUntil = 0; z.target = null; out.push([t, z.model.group.children.length, +z.size]); });
  for (const z of I.zombies) { z.spd = 0; } p.pos.set(c.x, c.y, c.z + 30); window.__line = { x: c.x, y: c.y, z: c.z }; return out;
});
ok(types.length === 5 && new Set(types.map((t) => t[2])).size >= 4, `5 tipos de zumbi com silhuetas diferentes (${types.map((t) => t[0] + '×' + t[2]).join(', ')})`);
await hud(false);
await G(() => { const L = window.__line; window.__cam = { p: [L.x + 0.3, L.y + 2.3, L.z + 9.5], t: [L.x + 0.3, L.y + 1.4, L.z], fov: 62 }; });
await wait(900); await page.screenshot({ path: `${SHOTS}/zumbis-tipos.png` });
await G(() => { const L = window.__line; window.__cam = { p: [L.x + 7.6, L.y + 2.7, L.z + 4.6], t: [L.x + 6.4, L.y + 2.0, L.z], fov: 55 }; }); await wait(500);
await page.screenshot({ path: `${SHOTS}/chefao-docao-abobora.png` });
// Rodízio de Halloween (noite, lua laranja, abóboras, velas, névoa no chão)
await G(() => { window.__cam = { p: [-30, 26, 62], t: [0, 0, 10], fov: 70 }; }); await wait(700);
await page.screenshot({ path: `${SHOTS}/rodizio-halloween.png` });
await G(() => { const L = window.__line; window.__cam = { p: [L.x - 8, L.y + 3.5, L.z + 16], t: [L.x, L.y + 1, L.z], fov: 72 }; }); await wait(500);
await page.screenshot({ path: `${SHOTS}/rodizio-halloween-chao.png` });
await G(() => { window.__cam = null; window.__stopAt = null; });

// ---------- 8) mapa novo: Fazenda Mal-Assombrada ----------
await G(() => window.__docao.startGame('fazenda-assombrada')); await wait(1200);
ok(await G(() => window.__docao.map.id === 'fazenda-assombrada' && !!window.__docao.invHal), 'Fazenda Mal-Assombrada abre na Invasão (com decoração)');
await hud(false); await G(() => { window.__stopAt = window.__docao.time + 0.05; window.__cam = { p: [34, 30, 40], t: [0, 0, 0], fov: 70 }; }); await wait(800);
await page.screenshot({ path: `${SHOTS}/fazenda-assombrada.png` });
await G(() => { window.__cam = { p: [-4, 2.4, 16], t: [0, 3, 0], fov: 70 }; }); await wait(500);
await page.screenshot({ path: `${SHOTS}/fazenda-assombrada-casarao.png` });
await G(() => { window.__cam = null; window.__stopAt = null; }); await hud(true);

// ---------- 9) modos base intactos ----------
await G(() => window.__docao.endGame()); await G(() => document.getElementById('menuBtn').click());
await wait(400);
await page.selectOption('#modeSel', 'dm'); await wait(500);
await G(() => window.__docao.startGame('arena')); await wait(1000);
const base = await G(() => { const g = window.__docao; return { mode: g.mode, bots: g.entities.filter((e) => !e.isPlayer).length, zt: g.entities.some((e) => e.zt), hal: !!g.invHal, cls: document.body.classList.contains('invmode'), hud: document.getElementById('invhud').classList.contains('hidden') }; });
ok(await G(() => !window.__docao.invMusic || !window.__docao.invMusic.on), 'música para fora da Invasão');
ok(base.mode === 'dm' && base.bots > 0 && !base.zt && !base.hal && !base.cls && base.hud, 'Mata-mata continua igual (bots, sem zumbi, sem decoração, sem HUD da Invasão)');

console.log('\nerros de página:', errors.length ? errors.slice(0, 12).join('\n') : 'nenhum');
ok(errors.length === 0, 'sem erros no console');
await browser.close();
console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

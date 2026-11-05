// Inspecionar arma (tecla I): curva pura (Node), servidor intocado e, no navegador, todas as armas giram, mostram os dois lados,
// voltam pro lugar, mãos ficam no cabo, HUD com camuflagem, segurar o I, cancelar atirando/recarregando/mirando/trocando e bloqueios.
// Uso: SITE=http://localhost:8123/ node test-inspect.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { Game } from './server/src/game.js';
import { WEAPONS } from './shared/rules.js';
import { INSPECT_DUR, INSPECT_PROFILES, inspectKind, inspectPose, knifeInspectLocal, fadeFullTurn, butterflyInspectAngles } from './inspect.js';
const SITE = process.env.SITE || 'http://localhost:8123/';
const fails = [], errors = []; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

// ---- curva (Node puro) ----
{
  const AX = ['ry', 'rz', 'rx', 'x', 'y', 'z', 'twist'];
  let bad = [];
  for (const [name, prof] of Object.entries(INSPECT_PROFILES)) {
    const p0 = inspectPose(0, prof), p1 = inspectPose(1, prof);
    if (AX.some((c) => Math.abs(p0[c]) > 1e-9 || Math.abs(p1[c]) > 1e-9) || p0.flip !== 0 || p1.flip !== 0) bad.push(name + ':pontas');
    let jump = 0, prev = inspectPose(0, prof, {});
    for (let k = 0.001; k <= 1.0000001; k += 0.001) { const c = inspectPose(Math.min(1, k), prof, {}); for (const a of AX) jump = Math.max(jump, Math.abs(c[a] - prev[a])); prev = c; }
    if (jump > 0.02) bad.push(`${name}:salto ${jump.toFixed(3)}`);
    if (Math.abs(inspectPose(0.3, prof).ry - prof.a.ry) > 0.05 || Math.abs(inspectPose(0.71, prof).ry - prof.b.ry) > 0.05) bad.push(name + ':lados');
  }
  ok(bad.length === 0, `curva: começa e termina em zero, sem salto, lados A e B certos${bad.length ? ' — ' + bad.join(' ') : ''}`);
  const want = { 0: 'rifle', 1: 'rifle', 2: 'sniper', 3: 'rocket', 4: 'pistol', 5: 'sniper', 6: 'sniper', 7: 'knife', 8: 'saber', 11: 'pistol', 13: 'bow', 14: 'bow', 16: 'disc', 17: 'saber', 18: 'rifle', 19: 'bow', 20: 'heavy', 21: 'lmg' };
  const wrong = Object.entries(want).filter(([i, k]) => WEAPONS[i] && inspectKind(WEAPONS[i]) !== k).map(([i, k]) => `${WEAPONS[i].key}=${inspectKind(WEAPONS[i])}≠${k}`);
  ok(wrong.length === 0 && WEAPONS.every((w) => INSPECT_PROFILES[inspectKind(w)]), `perfil por arma (${WEAPONS.length} armas)${wrong.length ? ' — ' + wrong.join(' ') : ''}`);
  if (WEAPONS.length < 21) console.log('AVISO: WEAPONS tem só', WEAPONS.length, 'armas');
  const kinds = ['chef', 'skeleton', 'karambit', 'bayonet', 'butterfly'];
  const LIN = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'flick', 'show'];
  const ang = (a) => { const t = Math.PI * 2; let d = a % t; if (d > Math.PI) d -= t; if (d < -Math.PI) d += t; return d; };
  bad = [];
  for (const kind of kinds) {
    const a0 = knifeInspectLocal(kind, 0), a1 = knifeInspectLocal(kind, 1);
    if (LIN.some((c) => Math.abs(a0[c]) > 1e-9 || Math.abs(a1[c]) > 1e-9) || Math.abs(ang(a0.spin)) > 1e-6 || Math.abs(ang(a1.spin)) > 1e-6) bad.push(kind + ':pontas');
    let jump = 0, prev = knifeInspectLocal(kind, 0);
    for (let k = 0.001; k <= 1.0000001; k += 0.001) {
      const c = knifeInspectLocal(kind, Math.min(1, k));
      for (const x of LIN) if (kind !== 'butterfly' || x !== 'flick') jump = Math.max(jump, Math.abs(c[x] - prev[x]));
      jump = Math.max(jump, Math.abs(ang(c.spin - prev.spin)));
      if (kind === 'butterfly') {
        const a = butterflyInspectAngles(prev.flick, prev.show), b = butterflyInspectAngles(c.flick, c.show);
        jump = Math.max(jump, Math.abs(ang(b.blade - a.blade)), Math.abs(ang(b.bite - a.bite)));
      }
      prev = c;
    }
    if (jump > 0.05) bad.push(`${kind}:salto ${jump.toFixed(3)}`);
  }
  const at = (kind, k) => knifeInspectLocal(kind, k);
  const chef = at('chef', 0.5), kara = at('karambit', 0.25), bay = at('bayonet', 0.7), skel = at('skeleton', 0.7), fly = at('butterfly', 0.7);
  if (!chef.finger || kara.finger || bay.finger || skel.finger || fly.finger) bad.push('dedo');
  if (!(kara.spin > 2)) bad.push('karambit sem volta na argola');
  if (!(bay.rz > 0.8 && bay.z < 0)) bad.push('baioneta sem o anel');
  if (!(skel.rx > 0.5 && skel.z > 0.05 && skel.ry < bay.ry)) bad.push('skeleton sem a face furada');
  if (!(fly.flick > 0.9 && fly.show > 0.9)) bad.push('butterfly sem o flick');
  const sig = [kara, bay, skel, fly].map((p) => [p.spin, p.rx, p.ry, p.rz, p.flick, p.show].map((n) => n.toFixed(2)).join(','));
  if (new Set(sig).size !== sig.length) bad.push('modelos iguais');
  const open = butterflyInspectAngles(1, 0), shown = butterflyInspectAngles(1, 1), half = butterflyInspectAngles(0.5, 0);
  if (Math.abs(open.blade - Math.PI * 2) > 1e-6 || Math.abs(open.bite) > 1e-6) bad.push('butterfly fechou diferente');
  if (Math.abs(shown.bite - Math.PI) > 1e-6 || shown.blade < Math.PI * 2) bad.push('butterfly não mostra a lâmina');
  if (Math.abs(half.blade - Math.PI) > 1e-6) bad.push('flick pela metade');
  if (Math.abs(fadeFullTurn(Math.PI * 2, 0) - Math.PI * 2) > 1e-6 || Math.abs(fadeFullTurn(0.4, 0)) > 1e-6) bad.push('fade da volta');
  ok(bad.length === 0, `cada faca inspeciona diferente e volta ao descanso${bad.length ? ' — ' + bad.join(' ') : ''}`);
}

// ---- servidor: só visual, nada muda lá ----
{
  ok(!/inspect/i.test(readFileSync(new URL('./server/src/game.js', import.meta.url), 'utf8')), 'servidor não conhece inspecionar (só visual no cliente)');
  const g = new Game({ code: 'TEST', map: 'arena', max: 8, fillBots: true, mode: 'dm' }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
  let fake = 1000; g.now = () => fake; const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' }); a.connected = true;
  let thrown = null; try { for (let i = 0; i < 40; i++) { fake += 0.05; g.tick(); } } catch (e) { thrown = e; }
  ok(!thrown, `servidor roda normal com as 21 armas${thrown ? ': ' + thrown.message : ''}`);
}

// ---- cliente ----
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(SITE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__docao && window.__docao.startGame, null, { timeout: 120000, polling: 250 });
const G = (fn, a) => page.evaluate(fn, a);
const waitGame = async (sec) => { const t0 = await G(() => window.__docao.time); await page.waitForFunction((t) => window.__docao.time >= t, t0 + sec, { timeout: 180000, polling: 30 }); };
const freezeAt = async (t) => { await G((t) => { window.__stopAt = t; }, t); await page.waitForFunction(() => window.__docao.time >= window.__stopAt - 1e-6, null, { timeout: 120000, polling: 30 }); await page.waitForTimeout(150); };
const unfreeze = () => G(() => { window.__stopAt = null; });
const ins = () => G(() => window.__docao.inspecting);
const hud = () => G(() => { const el = document.getElementById('inspect'); return { hidden: el.classList.contains('hidden'), text: el.textContent, fill: document.getElementById('inspFill').style.width, title: el.title }; });
await G(() => { const g = window.__docao; g.startGame('arena'); for (const e of g.entities) if (!e.isPlayer) { e.frozen = true; e.pos.set(999, -50, 999); } g.player.invulnUntil = g.time + 9999; });
await waitGame(0.6);
// arma na mão, pronta (sem saque) e sem pente vazio
const equip = async (w) => {
  await G((w) => { const g = window.__docao, p = g.player, o = w === 4 ? 0 : 4; p.slots = [w, o, 7]; g.switchWeapon(p, o); p.switchEnd = g.time; g.switchWeapon(p, w); p.switchEnd = g.time; p.reloadEnd = 0; p.mag[w] = Math.max(1, g.WEAPONS[w].mag); p.mgSpin = 0; p.mgHeat = 0; p.pitch = 0; }, w);
  await waitGame(0.3);
};
const N = WEAPONS.length, H = ['arms', 'armsP', 'pump', 'saberR', 'saberL', 'bowGrip', 'bowDraw', 'kr'];
const bad = { start: [], sides: [], back: [], hands: [], err: [], hud: [] };
for (let w = 0; w < N; w++) {
  const key = WEAPONS[w].key;
  await equip(w);
  const rest = await G(() => window.__docao.fpPose()), h0 = await G(() => window.__docao.fpHands());
  let t0;
  if (w === 0) { t0 = await G(() => window.__docao.time); await page.keyboard.press('KeyI'); }
  else t0 = await G(() => { const g = window.__docao; window.__insOk = g.inspect(); return g.time; });
  const s0 = await ins();
  if (!s0 || s0.wpn !== w) { bad.start.push(key); continue; }
  await freezeAt(t0 + 0.3 * INSPECT_DUR);
  const A = await G(() => window.__docao.fpPose()), hA = await G(() => window.__docao.fpHands()), eA = await G(() => window.__docao.fpHandErr()), hu = await hud();
  await page.screenshot({ path: `screenshots/inspect-${key}-A.png` });
  if (key === 'knife') { await unfreeze(); await freezeAt(t0 + 0.52 * INSPECT_DUR); const kf = await G(() => window.__docao.fpHands().knifeFlip); if (!(Math.abs(kf) > 1)) bad.hands.push(`faca não gira (${kf.toFixed(2)})`); }
  await unfreeze(); await freezeAt(t0 + 0.71 * INSPECT_DUR);
  const B = await G(() => window.__docao.fpPose()), hB = await G(() => window.__docao.fpHands()), eB = await G(() => window.__docao.fpHandErr());
  await page.screenshot({ path: `screenshots/inspect-${key}-B.png` });
  await unfreeze(); await waitGame(INSPECT_DUR * 0.29 + 0.4);
  const end = await G(() => window.__docao.fpPose()), hEnd = await G(() => window.__docao.fpHands()), sEnd = await ins(), huEnd = await hud();
  const dA = A.ry - rest.ry, dB = B.ry - rest.ry;
  if (!(Math.abs(dA) + Math.abs(A.rz - rest.rz) > 0.25 && Math.sign(dA) !== Math.sign(dB))) bad.sides.push(`${key}(${dA.toFixed(2)}/${dB.toFixed(2)})`);
  if (sEnd || ['x', 'y', 'ry', 'rz'].some((c) => Math.abs(end[c] - rest[c]) > 0.015) || Math.abs(hEnd.knifeFlip) > 1e-6) bad.back.push(`${key}(${sEnd ? 'ainda' : (end.ry - rest.ry).toFixed(3)})`);
  if (H.some((h) => hA[h] !== h0[h] || hB[h] !== h0[h])) bad.hands.push(key);
  if (eA > 0.01 || eB > 0.01) bad.err.push(`${key}(${eA.toFixed(3)}/${eB.toFixed(3)})`);
  if (hu.hidden || !hu.text.includes(WEAPONS[w].name) || !huEnd.hidden) bad.hud.push(key);
}
ok(!bad.start.length, `as ${N} armas começam a inspeção (fuzil pela tecla I)${bad.start.length ? ' — falhou: ' + bad.start.join(' ') : ''}`);
ok(!bad.sides.length, `lado A gira e lado B vai pro outro lado${bad.sides.length ? ' — falhou: ' + bad.sides.join(' ') : ''}`);
ok(!bad.back.length, `volta exatamente pro descanso no fim${bad.back.length ? ' — falhou: ' + bad.back.join(' ') : ''}`);
ok(!bad.hands.length, `mãos/braços iguais ao descanso (e a faca gira no dedo)${bad.hands.length ? ' — falhou: ' + bad.hands.join(' ') : ''}`);
ok(!bad.err.length, `arco/besta/estilingue/sabres: mão continua no cabo${bad.err.length ? ' — falhou: ' + bad.err.join(' ') : ''}`);
ok(!bad.hud.length, `cartão do HUD aparece com o nome e some no fim${bad.hud.length ? ' — falhou: ' + bad.hud.join(' ') : ''}`);

// HUD da camuflagem
await equip(0);
await G(() => { const p = window.__docao.player; p.gunKills = window.__docao.WEAPONS.map(() => 0); p.gunKills[0] = 7; window.__docao.inspect(); });
let hu = await hud();
ok(hu.text.includes('Camuflagem de chiqueiro') && hu.text.includes('Camuflagem de bacon em 3') && hu.fill === '40%' && hu.title.includes('7/10'), `HUD com 7 abates: chiqueiro, bacon em 3, barra 40% (${hu.text} · ${hu.fill})`);
await G(() => window.__docao.stopInspect()); await waitGame(0.2);
await G(() => { const p = window.__docao.player; p.gunKills[0] = 15; window.__docao.inspect(); });
hu = await hud();
ok(hu.text.includes('Dourada') && hu.text.includes('camuflagem máxima') && hu.fill === '100%', `HUD com 15 abates: Dourada, camuflagem máxima (${hu.text})`);
await G(() => { window.__docao.stopInspect(); window.__docao.player.gunKills[0] = 0; }); await waitGame(0.2);

// segurar o I: para no lado B até soltar
await equip(0);
await page.keyboard.down('KeyI'); await waitGame(2.6);
let s = await ins();
ok(!!s && s.hold && Math.abs(s.t - INSPECT_DUR * 0.7) < 0.05, `segurando I fica no lado B (${s ? `hold ${s.hold}, t ${s.t.toFixed(2)}` : 'parou'})`);
await page.keyboard.up('KeyI'); await waitGame(1.0);
ok((await ins()) === null, 'soltou o I: termina a animação');

// cancelar atirando: o tiro sai e a pose some num fade
await equip(0);
await G(() => window.__docao.inspect()); await waitGame(0.6);
const mag0 = await G(() => window.__docao.player.mag[0]);
await page.mouse.move(480, 270); await page.mouse.down(); await page.waitForTimeout(20); await page.mouse.up();
await page.waitForFunction(() => { const s = window.__docao.inspecting; return !s || s.out; }, null, { timeout: 60000, polling: 20 });
const mid = await ins();
await waitGame(0.3);
const fired = await G(() => window.__docao.player.mag[0]);
ok((await ins()) === null && fired < mag0 && (await hud()).hidden, `atirar cancela (fade ${mid ? mid.out : 'já acabou'}) e o tiro sai (pente ${mag0} → ${fired})`);

// cancelar recarregando
await equip(0); await G(() => { window.__docao.player.mag[0] = 10; window.__docao.inspect(); }); await waitGame(0.5);
await page.keyboard.press('KeyR'); await waitGame(0.3);
let r = await G(() => ({ s: window.__docao.inspecting, rl: window.__docao.player.reloadEnd > window.__docao.time }));
ok(r.s === null && r.rl, 'R recarrega e cancela a inspeção');
await G(() => { const g = window.__docao; g.player.reloadEnd = 0; g.player.mag[0] = g.WEAPONS[0].mag; });
// cancelar mirando
await equip(0); await G(() => window.__docao.inspect()); await waitGame(0.4);
await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' }); await waitGame(0.3);
r = await G(() => ({ s: window.__docao.inspecting, ads: window.__docao.ads }));
ok(r.s === null && r.ads > 0, `mirar (botão direito) cancela (ads ${r.ads.toFixed(2)})`);
// bloqueio: mirando não começa
await waitGame(0.4);
ok(await G(() => window.__docao.inspect()) === false, 'mirando não dá pra inspecionar');
await page.mouse.up({ button: 'right' }); await waitGame(0.5);
// Shift agora agacha: agachar não cancela a inspeção
await equip(0); await G(() => window.__docao.inspect()); await waitGame(0.3);
await page.keyboard.down('ShiftLeft'); await waitGame(0.4);
r = await G(() => ({ s: window.__docao.inspecting, crouch: window.__docao.player.crouch || 0 }));
await page.keyboard.up('ShiftLeft'); await waitGame(0.6);
ok(r.s !== null && r.crouch > 0.5, `agachar (Shift) não cancela a inspeção (crouch ${r.crouch.toFixed(2)})`);
await G(() => window.__docao.stopInspect && window.__docao.stopInspect(true)); await waitGame(2.4);
// cancelar trocando (tecla 2) e com o V
await equip(0); await G(() => window.__docao.inspect()); await waitGame(0.4);
await page.keyboard.press('Digit2');
r = await G(() => ({ s: window.__docao.inspecting, w: window.__docao.player.weapon, want: window.__docao.player.slots[1] }));
ok(r.s === null && r.w === r.want, 'trocar de arma (2) corta a inspeção na hora');
await equip(0); await G(() => window.__docao.inspect()); await waitGame(0.4);
await page.keyboard.press('KeyV');
r = await G(() => ({ s: window.__docao.inspecting, w: window.__docao.player.weapon }));
ok(r.s === null && r.w === 7, 'V (faca rápida) corta a inspeção');
// bloqueios: recarregando, pump da Calibre 12, ferrolho da sniper
await equip(0); await G(() => { const g = window.__docao; g.player.reloadEnd = g.time + 5; });
ok(await G(() => window.__docao.inspect()) === false, 'recarregando não dá pra inspecionar');
await G(() => { window.__docao.player.reloadEnd = 0; });
await equip(1); await page.mouse.down(); await page.waitForTimeout(20); await page.mouse.up(); await waitGame(0.25);
ok(await G(() => window.__docao.inspect()) === false, 'Calibre 12 no pump não inspeciona');
await waitGame(1.2);
await equip(2); await page.mouse.down(); await page.waitForTimeout(20); await page.mouse.up();
await page.waitForFunction(() => window.__docao.fpBoltHand, null, { timeout: 60000, polling: 20 });
r = await G(() => ({ ok: window.__docao.inspect(), bolt: window.__docao.fpBoltHand }));
ok(r.ok === false && r.bolt, 'Sniper no ferrolho não inspeciona');
await waitGame(1.5); await equip(0); await G(() => window.__docao.inspect()); await waitGame(0.5);
r = await G(() => { const g = window.__docao; const was = !!g.inspecting; g.endGame(); const el = document.getElementById('inspect'); return { was, hid: el.classList.contains('hidden') || getComputedStyle(el).display === 'none', ins: g.inspecting }; });
ok(r.was && r.hid && !r.ins, `fim de partida no meio da inspeção some com o cartão (${JSON.stringify(r)})`);
await G(() => window.__docao.startGame('arena')); await waitGame(0.3);
r = await G(() => { const el = document.getElementById('inspect'); return { ins: window.__docao.inspecting, hid: el.classList.contains('hidden') || getComputedStyle(el).display === 'none' }; });
ok(!r.ins && r.hid, `'Jogar de novo' não herda inspeção velha (${JSON.stringify(r)})`);

ok(errors.length === 0, `sem erro no console${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
if (fails.length) { console.log('FALHOU', fails.length); process.exit(1); }
console.log('tudo certo');

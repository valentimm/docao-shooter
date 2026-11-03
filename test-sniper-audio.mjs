// Perfil sonoro das snipers, sem navegador: node test-sniper-audio.mjs
// Cada ferrolho (scope + bolt) precisa de voz própria, ferrolho no tempo da animação
// e tiro longe mais grave. SITE=http://127.0.0.1:PORT/ também dispara no jogo.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { WEAPONS } from './shared/rules.js';

const FS = 48000;
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok' : 'FALHOU'}  ${msg}`); if (!cond) failed++; };

const snipers = WEAPONS.filter((w) => w.scope && w.bolt);
ok(snipers.length === 3, `três snipers de luneta/ferrolho (${snipers.map((w) => w.name).join(', ')})`);
const byStyle = Object.fromEntries(snipers.map((w) => [w.scopeStyle, w]));
for (const style of ['carabina', 'torresmo', 'canhao']) ok(!!byStyle[style], `${style} está na lista de armas`);

const sfx = readFileSync(new URL('./sniper-sfx.js', import.meta.url), 'utf8');
const zumbiSfx = readFileSync(new URL('./modo/zumbi/sniper-sfx.js', import.meta.url), 'utf8');
ok(sfx === zumbiSfx, 'modo zumbi usa o mesmo player de sniper');
ok(!sfx.includes('createConvolver') && !sfx.includes('createWaveShaper'), 'o tiro não cria reverb nem um limiter que achata o volume');
ok(sfx.includes('dist < 1.5'), 'o tiro do próprio jogador não passa por lowpass');
ok(sfx.includes('canhao: 2.2') && sfx.includes('sniper: 1.95') && sfx.includes('carabina: 1.7'), 'ganho: Canhão mais alto que Torresmo, Torresmo mais alto que Carabina');
ok(sfx.includes('bufs[id] = b'), 'cada amostra é decodificada uma vez e reusada');
ok(/0\.965 \+ Math\.random\(\) \* 0\.07/.test(sfx), 'cada tiro varia o tom (±3,5%)');
ok(/0\.90 \+ Math\.random\(\) \* 0\.14/.test(sfx), 'cada tiro varia o volume');
ok(/0\.994 \+ Math\.random\(\) \* 0\.012/.test(sfx), 'o ferrolho quase não desafina, pra continuar na animação');
for (const w of snipers) {
  ok(sfx.includes(`${w.key}: '${w.scopeStyle}'`), `${w.name} (${w.key}) aponta pro perfil ${w.scopeStyle}`);
  for (const part of ['near-a', 'near-b', 'far', 'bolt', 'reload']) {
    ok(sfx.includes(`'${w.scopeStyle}-${part}'`), `${w.scopeStyle}-${part} está no player`);
  }
}

const py = readFileSync(new URL('./tools/synth-sniper-audio.py', import.meta.url), 'utf8');
ok(py.includes('BOLT_OPEN = 0.16') && py.includes('BOLT_SHELL = 0.50') && py.includes('BOLT_CLOSE = 0.88'), 'ferrolho: abre 0,16 / cápsula 0,50 / fecha 0,88 (dentro da animação)');
ok(py.includes('RELOAD_ROUNDS = (0.40, 0.53, 0.66)'), 'recarga nos três cartuchos da animação');

const man = JSON.parse(readFileSync(new URL('./assets/audio/sniper/manifest.json', import.meta.url), 'utf8'));
const rootDir = new URL('./assets/audio/sniper/', import.meta.url);
const zumbiDir = new URL('./modo/zumbi/assets/audio/sniper/', import.meta.url);

function decode(url) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', url.pathname, '-f', 'f32le', '-ac', '1', '-ar', String(FS), 'pipe:1'], { maxBuffer: 32 * 1024 * 1024 });
  const x = new Float32Array(buf.length / 4);
  for (let i = 0; i < x.length; i++) x[i] = buf.readFloatLE(i * 4);
  return x;
}
function rms(x, t0, t1) {
  const a = Math.max(0, Math.floor(t0 * FS));
  const b = Math.min(x.length, Math.floor(t1 * FS));
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / (b - a));
}
function peak(x, t0 = 0, t1 = Infinity) {
  const a = Math.max(0, Math.floor(t0 * FS));
  const b = Math.min(x.length, Number.isFinite(t1) ? Math.floor(t1 * FS) : x.length);
  let m = 0;
  for (let i = a; i < b; i++) m = Math.max(m, Math.abs(x[i]));
  return m;
}
function biquad(x, type, fc) {
  const w0 = 2 * Math.PI * fc / FS;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * 0.707);
  const b0 = type === 'hp' ? (1 + cos) / 2 : (1 - cos) / 2;
  const b1 = type === 'hp' ? -(1 + cos) : (1 - cos);
  const b2 = b0;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xn = x[i];
    const yn = (b0 / a0) * xn + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = xn; y2 = y1; y1 = yn;
    y[i] = yn;
  }
  return y;
}
function share(x, t0, t1, type, fc) {
  const base = rms(x, t0, t1);
  return base > 0 ? rms(biquad(x, type, fc), t0, t1) / base : 0;
}
function tailSeconds(x) {
  const p = peak(x) || 1;
  const limit = p * 10 ** (-42 / 20);
  const win = Math.floor(0.03 * FS);
  let last = 0;
  for (let i = 0; i + win < x.length; i += Math.floor(win / 2)) {
    if (rms(x, i / FS, (i + win) / FS) > limit) last = i + win;
  }
  return last / FS;
}
function corr(a, b, t0, t1) {
  const i0 = Math.floor(t0 * FS);
  const i1 = Math.min(a.length, b.length, Math.floor(t1 * FS));
  let ma = 0, mb = 0, n = i1 - i0;
  if (n < 8) return 1;
  for (let i = i0; i < i1; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let dot = 0, na = 0, nb = 0;
  for (let i = i0; i < i1; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    dot += da * db; na += da * da; nb += db * db;
  }
  return dot / (Math.sqrt(na * nb) + 1e-12);
}

const measured = {};
for (const style of ['carabina', 'torresmo', 'canhao']) {
  const w = byStyle[style];
  const meta = man[style];
  ok(!!meta, `manifest tem ${style}`);
  ok(Math.abs(meta.rate - w.rate) < 1e-9, `${w.name}: amostra do ferrolho em ${meta.rate}s = rate ${w.rate}s`);
  ok(Math.abs(meta.reload - w.reload) < 1e-9, `${w.name}: recarga em ${meta.reload}s = reload da arma`);
  const open = meta.bolt_frac.open, shell = meta.bolt_frac.shell, close = meta.bolt_frac.close;
  ok(open > 0.12 && open < 0.32, `${style}: clique de abrir cai na levantada do ferrolho`);
  ok(shell > 0.32 && shell < 0.58, `${style}: cápsula sai enquanto o ferrolho está atrás`);
  ok(close > 0.82 && close < 0.93, `${style}: fechamento cai na batida do ferrolho`);

  const near = decode(new URL(`${style}-near-a.ogg`, rootDir));
  const nearB = decode(new URL(`${style}-near-b.ogg`, rootDir));
  const far = decode(new URL(`${style}-far.ogg`, rootDir));
  const bolt = decode(new URL(`${style}-bolt.ogg`, rootDir));
  const reload = decode(new URL(`${style}-reload.ogg`, rootDir));
  for (const part of ['near-a', 'near-b', 'far', 'bolt', 'reload']) {
    const a = readFileSync(new URL(`${style}-${part}.ogg`, rootDir));
    const b = readFileSync(new URL(`${style}-${part}.ogg`, zumbiDir));
    ok(a.equals(b), `${style}-${part}.ogg igual no modo zumbi`);
    ok(a.length < 150000, `${style}-${part}.ogg leve (${a.length} B)`);
  }

  const p = peak(near);
  const atk = peak(near, 0, 0.005);
  const hf = share(near, 0, 0.012, 'hp', 4000);
  const sub = share(near, 0, 0.18, 'lp', 120);
  const tail = tailSeconds(near);
  const bodyEnd = style === 'canhao' ? 0.82 : style === 'torresmo' ? 0.52 : 0.36;
  const echo = peak(near, bodyEnd) / p;
  measured[style] = { hf, sub, tail, atk: atk / p, echo };
  console.log(`  ${style}: agudo ${hf.toFixed(3)}  grave ${sub.toFixed(3)}  corpo ${tail.toFixed(2)}s  ataque ${(atk / p).toFixed(2)}  eco ${echo.toFixed(3)}`);

  ok(atk / p > 0.45, `${w.name}: o estalo chega nos primeiros 5 ms (${(atk / p).toFixed(2)} do pico)`);
  ok(echo < 0.08, `${w.name}: depois do estrondo não sobra eco (${echo.toFixed(3)})`);
  ok(corr(near, nearB, 0.08, Math.min(0.7, near.length / FS - 0.05)) < 0.85, `${w.name}: as duas variações de perto não são a mesma amostra`);

  const nearHf = 20 * Math.log10(rms(biquad(near, 'hp', 3500), 0, near.length / FS) + 1e-12);
  const farHf = 20 * Math.log10(rms(biquad(far, 'hp', 3500), 0, far.length / FS) + 1e-12);
  ok(farHf < nearHf - 6, `${w.name}: longe mais abafado (${farHf.toFixed(1)} dB agudo vs ${nearHf.toFixed(1)})`);
  ok(peak(far, 0, 0.005) < atk * 0.6, `${w.name}: de longe o ataque chega espalhado, sem o crack seco`);

  ok(rms(bolt, open * w.rate, open * w.rate + 0.04) > 0.015, `${w.name}: som ao abrir o ferrolho`);
  ok(rms(bolt, shell * w.rate, shell * w.rate + 0.04) > 0.015, `${w.name}: cápsula ejetada`);
  ok(rms(bolt, close * w.rate, close * w.rate + 0.05) > 0.015, `${w.name}: ferrolho fechando`);
  for (const frac of meta.reload_frac.rounds) {
    ok(rms(reload, frac * w.reload, frac * w.reload + 0.035) > 0.012, `${w.name}: cartucho em ${(frac * 100).toFixed(0)}% da recarga`);
  }
  ok(rms(reload, meta.reload_frac.close * w.reload, meta.reload_frac.close * w.reload + 0.05) > 0.015, `${w.name}: ferrolho fecha na recarga`);
}

ok(measured.carabina.hf > measured.torresmo.hf + 0.04 && measured.torresmo.hf > measured.canhao.hf + 0.08, 'estalo: Carabina mais aguda que Torresmo, Torresmo mais que Canhão');
ok(measured.canhao.sub > measured.torresmo.sub + 0.02 && measured.torresmo.sub > measured.carabina.sub + 0.08, 'grave: Canhão > Torresmo > Carabina');
ok(measured.carabina.tail < measured.torresmo.tail && measured.torresmo.tail < measured.canhao.tail, 'o corpo do Canhão dura mais; a Carabina apaga primeiro');
ok(measured.canhao.tail < 1.15 && measured.carabina.tail < 0.45, 'sem cauda de eco: o som morre com o estrondo');

const decays = {
  carabina: [0.0, 0.06, 0.36, 0.48],
  torresmo: [0.0, 0.08, 0.52, 0.68],
  canhao: [0.02, 0.1, 0.82, 1.02],
};
for (const [style, [a, b, c, d]] of Object.entries(decays)) {
  const x = decode(new URL(`${style}-near-a.ogg`, rootDir));
  const early = rms(x, a, b), lateR = rms(x, c, d);
  ok(early > lateR * 1.4, `${style}: cauda decai (${early.toFixed(3)} → ${lateR.toFixed(3)})`);
}

if (process.env.SITE) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.SITE, { waitUntil: 'load' });
  await page.evaluate(() => { const s = document.getElementById('modeSel'); s.value = 'explore'; s.dispatchEvent(new Event('change')); });
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__docao && window.__docao.state === 'playing', null, { timeout: 20000 });
  const ready = await page.waitForFunction(() => window.__docao.sniperAudioReady(), null, { timeout: 8000 }).then(() => true).catch(() => false);
  ok(ready, 'amostras das três snipers decodificadas no jogo');
  const guns = snipers.map((w) => [w.key, WEAPONS.indexOf(w)]);
  for (const [key, idx] of guns) {
    await page.evaluate((i) => {
      const g = window.__docao, p = g.player;
      g.setPrimary(i);
      p.primary = p.nextPrimary = i; p.slots[0] = i;
      p.mag[i] = g.WEAPONS[i].mag; p.reserve[i] = g.WEAPONS[i].reserve;
      p.reloadEnd = 0; p.nextFire = 0;
      if (p.weapon !== i) g.switchWeapon(p, i);
      else p.switchEnd = g.time;
    }, idx);
    await page.waitForFunction((i) => {
      const p = window.__docao.player;
      return p.weapon === i && p.switchEnd <= window.__docao.time;
    }, idx, { timeout: 8000 });
    const before = await page.evaluate(() => (window.__sniperSfxLog || []).length);
    await page.evaluate(() => document.querySelector('canvas').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1 })));
    await page.waitForTimeout(280);
    await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })));
    await page.waitForTimeout(200);
    await page.evaluate((i) => {
      const p = window.__docao.player;
      if (p.mag[i] >= window.__docao.WEAPONS[i].mag) p.mag[i] = Math.max(0, window.__docao.WEAPONS[i].mag - 1);
    }, idx);
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(250);
    const far = await page.evaluate((key) => window.__docao.sniperHeard(key, 36), key);
    ok(far === true, `${key}: tiro a 36 m passou pelo player`);
    const log = await page.evaluate((n) => (window.__sniperSfxLog || []).slice(n), before);
    ok(log.some((e) => e.ev === 'shot' && e.key === key && e.dist === 0), `${key}: tiro perto`);
    ok(log.some((e) => e.ev === 'bolt' && e.key === key), `${key}: ferrolho no tempo da animação`);
    ok(log.some((e) => e.ev === 'reload' && e.key === key), `${key}: recarga própria`);
    ok(log.some((e) => e.ev === 'shot' && e.dist >= 30 && e.far >= 0.7), `${key}: longe cruza pro arquivo abafado`);
  }
  ok(errors.length === 0, `sem erro de página${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
}

if (failed) { console.log(failed + ' falha(s)'); process.exit(1); }
console.log('snipers ok');

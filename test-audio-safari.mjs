// O Safari desktop ficava mudo desde o trenó (bd7d093).
// Exige AudioContext único em 'running' e sinal de verdade (não só nó criado)
// em tiro, passo, trilha, Jingle Bells e HO HO HO. WebKit e Chromium.
// Uso: node test-audio-safari.mjs
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.PORT || 8155);
const SITE = process.env.SITE || `http://127.0.0.1:${PORT}/`;
const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

function serve() {
  if (process.env.SITE) return null;
  return spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: new URL('.', import.meta.url).pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function boot(page, { map, mode }) {
  await page.addInitScript((cfg) => {
    localStorage.setItem('docao.map', cfg.map);
    localStorage.setItem('docao.mode', cfg.mode);
    localStorage.setItem('docao.primary', '0');
  }, { map, mode });
  await page.goto(SITE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__docao && window.__audio, null, { timeout: 20000 });
}

async function play(page) {
  const before = await page.evaluate(() => ({ state: window.__audio.state, count: window.__audio.count }));
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__docao.state === 'playing' && window.__audio.state === 'running', null, { timeout: 20000 });
  return before;
}

async function waitPeak(page, kind, min, ms = 4000) {
  const t0 = Date.now();
  let last = 0;
  while (Date.now() - t0 < ms) {
    last = await page.evaluate((k) => window.__audio.peakOf(k), kind);
    if (last >= min) return last;
    await sleep(50);
  }
  return last;
}

async function run(name, browserType, launch) {
  const errors = [];
  const browser = await browserType.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await boot(page, { map: 'arena', mode: 'explore' });
  const before = await page.evaluate(() => ({ state: window.__audio.state, count: window.__audio.count }));
  ok(before.count === 0 && before.state === 'none', `${name}: sem AudioContext antes do gesto (${JSON.stringify(before)})`);
  const atClick = await play(page);
  const started = await page.evaluate(() => ({
    state: window.__audio.state,
    count: window.__audio.count,
    master: window.__audio.master(),
    game: window.__docao.state,
    map: window.__docao.map && window.__docao.map.id,
  }));
  console.log(name, 'contexto', JSON.stringify({ ...started, beforeClick: atClick }));
  ok(started.state === 'running', `${name}: AudioContext.state === 'running' (${started.state})`);
  ok(started.count === 1 && atClick.count === 0, `${name}: um único AudioContext (${started.count}, antes do clique ${atClick.count})`);
  ok(started.master > 0.2 && started.master < 0.6, `${name}: master audível (${started.master})`);

  await page.evaluate(() => window.__audio.resetPeaks());
  await page.keyboard.down('KeyW');
  const stepPeak = await waitPeak(page, 'step', 3, 4000);
  await page.keyboard.up('KeyW');
  console.log(name, 'passo', stepPeak);
  ok(stepPeak >= 3, `${name}: passo soa (pico ${stepPeak})`);

  await page.evaluate(() => window.__audio.resetPeaks());
  await page.mouse.move(640, 360);
  await page.mouse.down();
  const shotPeak = await waitPeak(page, 'shot', 4, 3000);
  await page.mouse.up();
  console.log(name, 'tiro', shotPeak);
  ok(shotPeak >= 4, `${name}: tiro soa (pico ${shotPeak})`);

  await page.evaluate(() => window.__audio.resetPeaks());
  const hoCalled = await page.evaluate(() => window.__audio.hoho());
  const hoPeak = await waitPeak(page, 'hohoho', 4, 3000);
  console.log(name, 'hohoho', hoCalled, hoPeak);
  ok(hoCalled === true && hoPeak >= 4, `${name}: HO HO HO soa (pico ${hoPeak})`);

  await sleep(2200);
  await page.evaluate(() => window.__audio.resetPeaks());
  const jCalled = await page.evaluate(() => window.__audio.jingle());
  const jPeak = await waitPeak(page, 'jingle', 4, 3000);
  console.log(name, 'jingle', jCalled, jPeak);
  ok(jCalled === true && jPeak >= 4, `${name}: Jingle Bells soa (pico ${jPeak})`);

  const bad = await page.evaluate(() => window.__audio.bad());
  ok(bad.threw === false && bad.state === 'running', `${name}: rampa inválida não derruba o contexto (${JSON.stringify(bad)})`);
  await page.evaluate(() => window.__audio.resetPeaks());
  await page.mouse.down();
  const shotAfter = await waitPeak(page, 'shot', 4, 3000);
  await page.mouse.up();
  ok(shotAfter >= 4 && (await page.evaluate(() => window.__audio.state)) === 'running', `${name}: tiro ainda soa depois da rampa ruim (pico ${shotAfter})`);

  const audioErr = errors.filter((e) => /audio|InvalidState|NotAllowed|exponential|AudioContext/i.test(e));
  ok(audioErr.length === 0, `${name}: sem erro de áudio no console${audioErr.length ? ' — ' + audioErr.slice(0, 4).join(' | ') : ''}`);
  await page.close();

  const sled = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  sled.on('pageerror', (e) => errors.push(e.message));
  await boot(sled, { map: 'posto-nevasca', mode: 'explore' });
  await play(sled);
  const sledPeakJ = await waitPeak(sled, 'jingle', 4, 5000);
  const sledPeakH = await waitPeak(sled, 'hohoho', 4, 2000);
  const sledState = await sled.evaluate(() => ({
    state: window.__audio.state,
    count: window.__audio.count,
    map: window.__docao.map && window.__docao.map.id,
    kinds: window.__audio.log.filter((r) => r.kind === 'jingle' || r.kind === 'hohoho').map((r) => r.kind + ':' + r.peak),
  }));
  console.log(name, 'trenó', JSON.stringify({ ...sledState, jingle: sledPeakJ, hoho: sledPeakH }));
  ok(sledState.map === 'posto-nevasca' && sledState.state === 'running' && sledState.count === 1, `${name}: trenó no Posto com um contexto running`);
  ok(sledPeakJ >= 4 && sledPeakH >= 4, `${name}: a passagem toca Jingle Bells (${sledPeakJ}) e HO HO HO (${sledPeakH})`);
  await sled.close();

  const inv = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  inv.on('pageerror', (e) => errors.push(e.message));
  await boot(inv, { map: 'rodizio', mode: 'inv' });
  await play(inv);
  const musicPeak = await waitPeak(inv, 'music', 2, 5000);
  const musicState = await inv.evaluate(() => window.__audio.state);
  console.log(name, 'música', musicPeak, musicState);
  ok(musicState === 'running' && musicPeak >= 2, `${name}: trilha da Invasão soa (pico ${musicPeak}, ${musicState})`);
  await inv.close();
  await browser.close();
}

const child = serve();
await sleep(300);
try {
  const gpu = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] };
  await run('webkit', webkit, {});
  await run('chromium', chromium, gpu);
} finally {
  if (child) child.kill('SIGTERM');
}
if (fails.length) { console.error('\n' + fails.length + ' falha(s)'); process.exit(1); }
console.log('\ntudo ok');

// Screenshots do HUD do Gunfight no WebKit, um processo, dois tamanhos.
// Uso: node tools/shot-gunfight-hud.mjs
import { webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.PORT || 8177);
const SITE = `http://127.0.0.1:${PORT}/tools/gunfight-hud-preview.html`;
const OUT = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
});
await sleep(250);

const scenes = [
  ['live', '2v2 ao vivo'],
  ['ot', '4v4 overtime contestado'],
  ['spec', 'espectador no aliado'],
  ['swap', 'troca de lado'],
  ['duel', '1v1'],
];
const sizes = [[1280, 800], [1440, 900]];
const fails = [];
const browser = await webkit.launch();
try {
  for (const [w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    for (const [id, label] of scenes) {
      await page.goto(`${SITE}?cena=${id}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForSelector('#gfhud:not(.hidden)');
      await page.waitForTimeout(450);
      const text = await page.evaluate(() => ({
        timer: document.getElementById('timer').textContent,
        red: document.getElementById('gfRed').textContent,
        blue: document.getElementById('gfBlue').textContent,
        hpR: document.querySelector('#gfHpRed b').textContent,
        hpB: document.querySelector('#gfHpBlue b').textContent,
        ahead: [...document.querySelectorAll('.gfhp em')].map((e) => e.textContent).join('|'),
        cls: document.getElementById('gfClassNow').textContent,
        next: document.getElementById('gfNext').textContent,
        zone: document.getElementById('gfZoneText').textContent,
        zoneOn: !document.getElementById('gfZone').classList.contains('hidden'),
        pips: document.querySelectorAll('#gfPipsRed .gfpip').length + '+' + document.querySelectorAll('#gfPipsBlue .gfpip').length,
        watch: document.getElementById('gfWatch').textContent,
        watchOn: !document.getElementById('gfWatch').classList.contains('hidden'),
        b1: document.querySelector('#bombBanner .b1').textContent,
        b2: document.querySelector('#bombBanner .b2').textContent,
        bannerOn: !document.getElementById('bombBanner').classList.contains('hidden'),
      }));
      const bad = [];
      if (id === 'live' && !(text.timer === '1:14' && text.red === '2' && text.blue === '1' && text.hpR === '180' && text.hpB === '95' && text.cls.includes('Bazuca') && text.next.includes('Calibre 12') && text.pips === '2+2' && text.ahead.includes('NA FRENTE'))) bad.push(JSON.stringify(text));
      if (id === 'ot' && !(text.timer === 'OVERTIME 10' && text.zoneOn && text.zone.includes('CONTESTADA') && text.hpR === '240' && text.hpB === '310' && text.pips === '4+4')) bad.push(JSON.stringify(text));
      if (id === 'spec' && !(text.watchOn && text.watch === 'Assistindo Bacon · clique troca' && text.hpR === '64')) bad.push(JSON.stringify(text));
      if (id === 'swap' && !(text.bannerOn && text.b1 === 'Troca de lado!' && text.b2 === 'Nova classe: Sabre de Luz' && text.timer.startsWith('PREP'))) bad.push(JSON.stringify(text));
      if (id === 'duel' && !(text.pips === '1+1' && text.red === '4' && text.blue === '2' && text.hpR === '90' && text.ahead.startsWith('NA FRENTE'))) bad.push(JSON.stringify(text));
      if (bad.length) fails.push(`${label} ${w}x${h}: ${bad[0]}`);
      const file = `${OUT}/gunfight-hud-${id}-${w}x${h}.png`;
      await page.screenshot({ path: file });
      console.log((bad.length ? 'FALHA' : 'OK   ') + ` ${label} ${w}x${h}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (fails.length) {
  console.log(fails.join('\n'));
  process.exit(1);
}
console.log('screenshots em ' + OUT);

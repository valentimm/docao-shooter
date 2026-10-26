// Bancada e classes: monta no Arsenal, morre, troca no respawn e confere o stat.
// Uso: SITE=http://127.0.0.1:8124/ node tools/test-classes.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const SITE = process.env.SITE || 'http://127.0.0.1:8124/';
const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts/screenshots';
const VIDEOS = process.env.VIDEOS || '/opt/cursor/artifacts/videos';
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });
const errors = [], fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  reducedMotion: 'reduce',
  recordVideo: { dir: VIDEOS, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !/favicon\.ico/.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem('docao.primary', '0');
  localStorage.setItem('docao.secondary', '4');
  localStorage.setItem('docao.melee', '7');
  localStorage.setItem('docao.hand', 'primary');
  localStorage.setItem('docao.map', 'arena');
  localStorage.setItem('docao.name', 'Matheus');
  localStorage.removeItem('docao.classes');
  localStorage.removeItem('docao.classe');
});
await page.goto(SITE, { waitUntil: 'load' });
const G = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const until = async (fn, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await wait(100); }
  return false;
};
ok(await until(() => window.__gunThumbs >= 23, 20000), 'fotos das armas saíram do modelo');
ok(!(await G(() => document.querySelector('#deathList .clsrow') == null)), 'a lista de classes existe no menu de morte');

await page.click('[data-menu-view="arsenal"]');
ok(await until(() => !document.getElementById('menu-arsenal').hidden && !document.getElementById('temperBtn').classList.contains('hidden'), 15000), 'a caixa do Arsenal abre');
await page.click('#temperBtn');
ok(await until(() => !document.getElementById('bench').hidden && document.querySelectorAll('.bench-piece').length >= 3, 5000), 'a bancada abre no fuzil');
await page.locator('.bench-piece', { hasText: 'Alça de arame' }).click();
await page.locator('.bench-stamp').click();
await page.fill('#benchName', 'Arame');
ok(await G(() => { const c = window.__docao.classes[0]; return c.name === 'Arame' && c.kits.rifle && c.kits.rifle.optic === 'arame'; }), 'Alça de arame carimbada na classe 1');
await page.screenshot({ path: `${SHOTS}/bancada-desktop.png` });

await page.locator('#benchChips .classchip').nth(1).click();
await page.fill('#benchName', 'Bolso');
await page.locator('.bench-slot', { hasText: 'Pente' }).click();
await page.locator('.bench-piece', { hasText: 'Pente de bolso' }).click();
await page.locator('.bench-stamp').click();
ok(await G(() => { const c = window.__docao.classes[1]; return c.name === 'Bolso' && c.kits.rifle && c.kits.rifle.mag === 'bolso' && window.__docao.classIndex === 1; }), 'Pente de bolso carimbado na classe 2');
await page.locator('#benchChips .classchip').nth(0).click();
ok(await G(() => window.__docao.classIndex === 0 && window.__docao.classes[0].kits.rifle.optic === 'arame'), 'volta pra classe do Arame antes de jogar');
await page.click('#benchBack');
await page.click('#menuBack');
ok(await until(() => document.getElementById('menu-arsenal').hidden, 8000), 'fecha a caixa e volta pra partida');

await page.click('#playBtn');
ok(await until(() => window.__docao.state === 'playing' && window.__docao.player && window.__docao.player.alive, 15000), 'a partida começa');
const vivo = await G(() => { const g = window.__docao, h = g.held; return { fov: h && h.adsFov, mag: g.player.mag[0], spread: h && h.spread }; });
ok(vivo.fov === 34 && vivo.mag === 30 && Math.abs(vivo.spread - 0.0115) < 1e-6, `nasceu com a Alça de arame (zoom ${vivo.fov}, pente ${vivo.mag}, cone ${vivo.spread})`);
await G(() => document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 2, buttons: 2, bubbles: true, cancelable: true })));
ok(await until(() => Math.abs(window.__docao.fov - 34) < 1.5, 4000), 'a mira da câmera fecha no zoom da Alça de arame');
const mirando = await G(() => window.__docao.fov);
await G(() => document.getElementById('game').dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true })));
ok(Math.abs(mirando - 34) < 1.5, `zoom da câmera ${mirando.toFixed(1)}`);

const matador = await G(() => {
  const g = window.__docao;
  const bot = g.entities.find((e) => e !== g.player && e.alive && e.name);
  g.player.invulnUntil = 0;
  g.damage(g.player, 999, bot, 0, false);
  return bot ? bot.name : '';
});
ok(!!matador, `um bot mata o jogador (${matador})`);
ok(await until(() => !document.getElementById('deathpick').classList.contains('hidden') && document.querySelector('#deathList .clsrow.on'), 20000), 'na morte abre a lista de classes');
const morte = await G((nome) => {
  const tela = document.getElementById('deathpick');
  const st = getComputedStyle(tela);
  const stamp = getComputedStyle(document.getElementById('stamp'));
  const feed = getComputedStyle(document.getElementById('killfeed'));
  const msg = getComputedStyle(document.getElementById('centermsg'));
  const slot = document.querySelector('#classGun .gs-slot b');
  const foto = document.querySelector('#classGun .wthumb.is-big');
  return {
    rows: document.querySelectorAll('#deathList .clsrow').length,
    foto: /url\(/.test((foto && foto.style.backgroundImage) || ''),
    clock: document.getElementById('classClockTxt').textContent,
    nome: document.querySelector('#deathList .clsrow.on .clsmeta b').textContent,
    who: document.getElementById('deathWho').textContent,
    opaco: st.opacity === '1' && st.backgroundColor !== 'rgba(0, 0, 0, 0)',
    cobre: tela.getBoundingClientRect().width > 1000 && tela.getBoundingClientRect().height > 600,
    hud: stamp.display === 'none' && feed.display === 'none' && msg.display === 'none',
    slot: slot ? slot.textContent : '',
    slotAlto: slot ? slot.getBoundingClientRect().height : 0,
    killcam: document.body.classList.contains('killcam'),
    armas: ['deathList', 'classGun', 'deathArms'].some((id) => getComputedStyle(document.getElementById(id)).display !== 'none'),
    centroLivre: (() => {
      const cx = innerWidth / 2, cy = innerHeight / 2, r = tela.getBoundingClientRect();
      const tapa = r.width > 8 && r.height > 8 && r.left <= cx && r.right >= cx && r.top <= cy && r.bottom >= cy;
      return !tapa;
    })(),
    score: getComputedStyle(document.getElementById('score')).display !== 'none',
    chat: getComputedStyle(document.getElementById('socialHud')).display !== 'none',
    feed: getComputedStyle(document.getElementById('killfeed')).display !== 'none',
  };
}, matador);
ok(morte.rows === 5 && morte.foto && /Renasce em/.test(morte.clock) && morte.nome === 'Arame', `ficha da morte: ${morte.rows} classes, foto ${morte.foto}, "${morte.clock}", ${morte.nome}`);
ok(morte.who === `Você foi pururucado por ${matador}` && !/^\?|por \?\?\?/.test(morte.who), `o cabeçalho diz quem matou: "${morte.who}"`);
ok(morte.killcam && !morte.cobre && !morte.armas && morte.centroLivre && morte.score && morte.chat && morte.feed, `kill cam sem menu de armas (killcam ${morte.killcam}, cobre ${morte.cobre}, armas ${morte.armas}, centro ${morte.centroLivre}, score ${morte.score}, chat ${morte.chat}, feed ${morte.feed})`);
ok(!morte.armas, `a ficha de arma não aparece na kill cam ("${morte.slot}", ${morte.slotAlto.toFixed(0)}px)`);
const grade = await G(() => {
  const list = getComputedStyle(document.getElementById('deathList'));
  const rows = [...document.querySelectorAll('#deathList .clsrow')];
  const tops = rows.map((r) => Math.round(r.getBoundingClientRect().top));
  const last = getComputedStyle(rows[4]);
  const foto = document.querySelector('#classGun .wthumb.is-big').getBoundingClientRect();
  const btn = document.getElementById('respawnBtn').getBoundingClientRect();
  const bars = document.querySelector('#classGun .gbars').getBoundingClientRect();
  const who = getComputedStyle(document.getElementById('deathWho'));
  return {
    col: list.flexDirection === 'column' && list.display === 'flex',
    pilha: tops.every((t, i) => i === 0 || t > tops[i - 1] + 20),
    fundo: last.backgroundColor,
    foto: Math.round(foto.height),
    folga: Math.round(btn.top - bars.bottom),
    fonte: who.fontFamily,
    peso: who.fontWeight,
  };
});
ok(!grade.col && grade.foto === 0, `lista e foto da arma ficam fora da kill cam (foto ${grade.foto}px, fundo ${grade.fundo})`);
ok(/Arial Black|Impact/i.test(grade.fonte) && Number(grade.peso) >= 800, `título em negrito (${grade.fonte}, ${grade.peso})`);
await page.screenshot({ path: `${SHOTS}/morte-desktop.png` });
await page.keyboard.press('Digit2');
await wait(200);
ok(await G(() => window.__docao.classIndex === 1 && document.querySelector('#deathList .clsrow.on').dataset.i === '1'), 'tecla 2 escolhe a classe Bolso');
ok(await until(() => !document.getElementById('respawnBtn').disabled, 30000), 'o botão de nascer libera');
await page.click('#respawnBtn');
ok(await until(() => window.__docao.player.alive, 8000), 'nasceu de novo');
const troca = await G(() => { const g = window.__docao, h = g.held; return { fov: h.adsFov, mag: g.player.mag[0], nome: g.classes[g.classIndex].name }; });
ok(troca.fov === 40 && troca.mag === 18 && troca.nome === 'Bolso', `a classe nova vale: zoom ${troca.fov} (fábrica) e pente ${troca.mag}`);
await page.keyboard.press('Escape');
await wait(300);
ok(await G(() => {
  const pausa = !document.getElementById('pause').classList.contains('hidden');
  const listaFora = document.getElementById('pauseClass').classList.contains('hidden');
  const semFicha = !document.querySelector('#pause .cls-sheet');
  const morte = document.getElementById('deathpick');
  const morteFora = getComputedStyle(morte).display === 'none';
  return window.__docao.state === 'paused' && window.__docao.player.alive && pausa && listaFora && semFicha && morteFora && !document.body.classList.contains('dead');
}), 'a pausa abre o modal, sem a ficha da morte por trás');
await page.screenshot({ path: `${SHOTS}/pausa-desktop.png` });
await page.click('#pauseClassBtn');
await wait(250);
ok(await G(() => !document.getElementById('pauseClass').classList.contains('hidden') && document.querySelectorAll('#pauseGuns .clsrow').length === 5 && window.__docao.player.alive), 'Trocar classe abre a ficha inteira e não derruba');
await page.screenshot({ path: `${SHOTS}/pausa-classes.png` });
await page.click('#pauseClassBack');
await wait(200);
await page.click('#quitBtn');
await until(() => window.__docao.state === 'menu', 8000);

await page.selectOption('#modeSel', 'bomb');
await page.click('#menuTeamBtns .teambtn.t0');
await G(() => document.getElementById('playBtn').click());
ok(await until(() => window.__docao.mode === 'bomb' && !document.getElementById('bLoad').classList.contains('hidden') && document.querySelectorAll('#bLoad .clsrow').length === 5, 15000), 'na preparação da Bomba a ficha abre em tela cheia');
ok(await G(() => {
  const list = getComputedStyle(document.querySelector('#bLoad .cls-list'));
  const foto = document.querySelector('#bLoad .wthumb.is-big').getBoundingClientRect().height;
  const tops = [...document.querySelectorAll('#bLoad .clsrow')].map((r) => r.getBoundingClientRect().top);
  return list.display === 'flex' && list.flexDirection === 'column' && tops.every((t, i) => i === 0 || t > tops[i - 1] + 20) && foto >= 100;
}), 'Bomba usa a mesma lista vertical e a foto grande');
await page.screenshot({ path: `${SHOTS}/bomba-classes.png` });
await page.keyboard.press('Escape');
await wait(150);
await page.keyboard.press('Escape');
await wait(200);
await page.click('#quitBtn');
await until(() => window.__docao.state === 'menu', 8000);

await page.selectOption('#modeSel', 'inv');
await G(() => document.getElementById('playBtn').click());
ok(await until(() => window.__docao.mode === 'inv' && window.__docao.player && window.__docao.player.alive, 15000), 'a Invasão começa');
await G(() => window.__docao.invOpenPick());
ok(await until(() => !document.getElementById('iLoad').classList.contains('hidden') && document.querySelectorAll('#iLoad .clsrow').length === 5, 8000), 'entre as waves a ficha abre em tela cheia');
ok(await G(() => {
  const list = getComputedStyle(document.querySelector('#iLoad .cls-list'));
  const foto = document.querySelector('#iLoad .wthumb.is-big').getBoundingClientRect().height;
  const tops = [...document.querySelectorAll('#iLoad .clsrow')].map((r) => r.getBoundingClientRect().top);
  return list.display === 'flex' && list.flexDirection === 'column' && tops.every((t, i) => i === 0 || t > tops[i - 1] + 20) && foto >= 100;
}), 'entre as waves a lista é vertical e a foto é grande');
await page.screenshot({ path: `${SHOTS}/waves-classes.png` });
await page.keyboard.press('Escape');
await wait(150);
await page.keyboard.press('Escape');
await wait(200);
await page.click('#quitBtn');
await until(() => window.__docao.state === 'menu', 8000);
await page.setViewportSize({ width: 390, height: 844 });
await wait(300);
await page.click('[data-menu-view="arsenal"]');
ok(await until(() => !document.getElementById('menu-arsenal').hidden, 15000), 'Arsenal na tela estreita');
await page.click('#temperBtn');
await until(() => !document.getElementById('bench').hidden, 5000);
await page.screenshot({ path: `${SHOTS}/bancada-estreita.png` });
await page.click('#benchBack');
await page.click('#menuBack');
await until(() => document.getElementById('menu-arsenal').hidden, 8000);
await G(() => document.getElementById('playBtn').click());
ok(await until(() => window.__docao.state === 'playing' && window.__docao.player && window.__docao.player.alive, 15000), 'partida na tela estreita');
await G(() => { const g = window.__docao; const bot = g.entities.find((e) => e !== g.player && e.name); g.player.invulnUntil = 0; g.damage(g.player, 999, bot, 0, false); });
ok(await until(() => !document.getElementById('deathpick').classList.contains('hidden'), 20000), 'morte na tela estreita');
ok(await G(() => {
  const list = getComputedStyle(document.getElementById('deathList'));
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const tela = document.getElementById('deathpick').getBoundingClientRect();
  const tapa = tela.width > 8 && tela.height > 8 && tela.left <= cx && tela.right >= cx && tela.top <= cy && tela.bottom >= cy;
  const btn = document.getElementById('respawnBtn').getBoundingClientRect();
  return document.body.classList.contains('killcam') && list.display === 'none' && !tapa && btn.width > 80 && btn.height > 20;
}), 'na estreita a kill cam continua sem o menu de armas e o Renascer fica no canto');
await page.screenshot({ path: `${SHOTS}/morte-estreita.png` });

console.log('\nERROS:', errors.length ? errors.slice(0, 8) : 'nenhum');
if (errors.length) fails.push('erros de console');
await context.close();
await browser.close();
console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

// SITE=http://127.0.0.1:8124 CHROMIUM_EXECUTABLE=/usr/bin/chromium node test-grenade-browser.mjs
// Copo Bomba, fumaça e flashbang ficam na mão direita e só saem ao soltar o clique.
// A Pokébola continua no Q, com a prévia da trajetória.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.SITE || 'http://127.0.0.1:8124');
  await page.waitForFunction(() => !!window.__docao, null, { timeout: 120000 });
  await page.selectOption('#modeSel', 'explore');
  await page.evaluate(() => window.__docao.startGame('arena'));
  for (const scenario of [
    { name: 'na mão, solta o clique' },
    { name: 'andando', moving: true },
    { name: 'agachado junto à parede', wall: true, crouch: true },
    { name: 'zoom e mira para cima', fov: 40, pitch: 0.7 },
  ]) {
    await page.evaluate((s) => {
      const g = window.__docao, p = g.player;
      p.nades = 3; p.pokeballs = 0; p.utilSel = ''; p.pos.set(-25, 0, s.wall ? -g.map.size[1] + 0.45 : -22); p.vel.set(0, 0, 0);
      p.yaw = 0; p.pitch = s.pitch || 0; p.invulnUntil = 1e9; g.camera.fov = s.fov || 75; g.camera.updateProjectionMatrix();
    }, scenario);
    if (scenario.crouch) await page.keyboard.down('ShiftLeft');
    if (scenario.moving) await page.keyboard.down('KeyD');
    await page.waitForTimeout(250);
    const result = await page.evaluate(async () => {
      const g = window.__docao, p = g.player, before = g.grenades.length;
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const held = { sel: p.utilSel, aim: g.grenadeAim, nades: p.nades };
      const canvas = document.querySelector('canvas');
      canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const whileHeld = g.grenades.length;
      document.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const n = g.grenades.at(-1);
      return { held, whileHeld, before, thrown: g.grenades.length, blocked: n ? g.PHYS.nadeBlocked(n.pos.x, n.pos.y, n.pos.z) : true, speed: n ? n.vel.length() : 0, cupAfter: g.grenadeAim.cupVisible, arc: g.grenadeAim.visible };
    });
    assert.equal(result.held.sel, 'nade', `${scenario.name}: Q deixa o copo na mão`);
    assert.equal(result.held.aim.visible, false, `${scenario.name}: sem mira de trajetória`);
    assert.equal(result.held.aim.cupVisible, true, `${scenario.name}: copo visível na mão`);
    assert.equal(result.held.aim.handVisible, true);
    assert.ok(result.held.aim.cupX > 0.12, `${scenario.name}: mão direita`);
    assert.equal(result.whileHeld, result.before, `${scenario.name}: segurar o clique não joga`);
    assert.equal(result.thrown, result.before + 1, `${scenario.name}: soltar joga`);
    assert.equal(result.blocked, false, `${scenario.name}: origem fora da parede`);
    assert.ok(result.speed > 8, `${scenario.name}: saiu com força`);
    assert.equal(result.cupAfter, false, `${scenario.name}: o copo da mão não fica voando`);
    assert.equal(result.arc, false);
    if (scenario.crouch) await page.keyboard.up('ShiftLeft');
    if (scenario.moving) await page.keyboard.up('KeyD');
    console.log(`OK ${scenario.name}`);
  }
  const powers = await page.evaluate(async () => {
    const g = window.__docao, p = g.player;
    p.pos.set(-25, 0, -22); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; p.smokeNades = 2; p.utilSel = '';
    const toss = async (button) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4' }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const before = g.tacticals.length, aim = g.grenadeAim;
      g.holdFire(button, true);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const held = g.tacticals.length;
      g.holdFire(button, false);
      const n = g.tacticals.at(-1);
      return { sel: p.utilSel, before, held, after: g.tacticals.length, speed: n ? n.vel.length() : 0, right: aim.cupX > 0.12, smoke: aim.smokeVisible, arc: aim.visible };
    };
    const left = await toss(0);
    p.smokeNades = Math.max(1, p.smokeNades); p.utilSel = 'smoke';
    const right = await toss(2);
    return { left, right };
  });
  assert.equal(powers.left.sel, 'smoke', '4 deixa a fumaça na mão');
  assert.equal(powers.left.smoke, true);
  assert.equal(powers.left.right, true, 'fumaça na mão direita');
  assert.equal(powers.left.arc, false);
  assert.equal(powers.left.held, powers.left.before, 'segurar não joga a fumaça');
  assert.equal(powers.left.after, powers.left.before + 1);
  assert.ok(powers.right.speed > powers.left.speed + 4, `direito mais forte (${powers.right.speed}) que o esquerdo (${powers.left.speed})`);
  console.log(`OK fumaça: esquerdo ${powers.left.speed.toFixed(1)} · direito ${powers.right.speed.toFixed(1)}`);

  await page.evaluate(() => {
    const g = window.__docao, p = g.player;
    p.nades = 3; p.pokeballs = 1; p.utilSel = ''; p.pos.set(-25, 0, -22); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; p.invulnUntil = 1e9;
    g.camera.fov = 75; g.camera.updateProjectionMatrix();
  });
  const poke = await page.evaluate(() => {
    const g = window.__docao, p = g.player;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    p.chargeStart = g.time - 0.6;
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const aim = g.grenadeAim;
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' }));
      const n = g.grenades.at(-1);
      resolve({ visible: aim.visible, vel: aim.velocity, pos: n.pos.toArray(), nvel: n.vel.toArray(), points: aim.points });
    })));
  });
  const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  assert.ok(poke.visible, 'Pokébola ainda mostra a trajetória');
  assert.ok(distance(poke.vel, poke.nvel) < 1e-8);
  assert.ok(distance(poke.points.slice(0, 3), poke.pos) < 1e-4);
  console.log('OK Pokébola: preview e lançamento coincidem');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

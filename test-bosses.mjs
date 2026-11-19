// Chefões da Invasão: rotação e tipos. Uso: node test-bosses.mjs
import { BOSS_TYPES, bossOfWave, isBoss, waveSpec, ZOMBIES, INV } from './shared/invasion.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(BOSS_TYPES.length === 6 && BOSS_TYPES.includes('boss') && BOSS_TYPES.includes('bossBelly'), '6 chefões, Abóbora e Barriguinha na lista');
ok(isBoss('boss') && isBoss('bossCrazy') && !isBoss('tank') && !isBoss('walker'), 'isBoss reconhece só chefões');
ok(bossOfWave(5) === 'boss' && bossOfWave(10) === 'bossBelly' && bossOfWave(15) === 'bossGhost', 'waves 5/10/15: Abóbora, Barriguinha, Fantasma');
ok(bossOfWave(20) === 'bossMummy' && bossOfWave(25) === 'bossWolf' && bossOfWave(30) === 'bossCrazy', 'waves 20+: Múmia, Lobisomem, Louco (ciclo)');
ok(ZOMBIES.bossBelly.spit.pee && ZOMBIES.bossGhost.phaseEvery && ZOMBIES.bossMummy.spit.wrap && ZOMBIES.bossWolf.howl && ZOMBIES.bossCrazy.spit.volley === 3, 'poderes: mijo, fase, atadura, uivo, rajada');
const s = waveSpec(10, 2);
ok(s.boss && s.bossKind === 'bossBelly' && s.bossHp > ZOMBIES.boss.hp, `wave 10 marca Barriguinha com vida de chefão (${Math.round(s.bossHp)})`);
ok(INV.BOSS_EVERY === 5, 'chefão a cada 5 waves');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

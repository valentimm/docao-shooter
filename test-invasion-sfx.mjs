// Cada tipo da Invasão tem uma voz própria. Uso: node test-invasion-sfx.mjs
import { ZOMBIE_VOICES } from './invasion-sfx.js';
import { BOSS_TYPES, ZOMBIES } from './shared/invasion.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const sig = (notes) => notes.map((s) => (s.noise ? 'n' + s.noise : s.osc + ':' + s.f0 + '>' + s.f1)).join('|');

const types = Object.keys(ZOMBIES);
ok(types.every((t) => ZOMBIE_VOICES[t] && ZOMBIE_VOICES[t].idle && ZOMBIE_VOICES[t].bite), 'todo tipo tem voz de perto e de mordida');
ok(ZOMBIE_VOICES.bossWolf.howl && ZOMBIE_VOICES.bossHosp.howl && !ZOMBIE_VOICES.walker.howl, 'uivo só no Lobisomem e no Hospício');
ok(BOSS_TYPES.every((t) => ZOMBIE_VOICES[t].near && ZOMBIE_VOICES[t].near.length >= 3), 'cada chefão tem um som de quando chega perto');
const nears = BOSS_TYPES.map((t) => sig(ZOMBIE_VOICES[t].near));
ok(new Set(nears).size === BOSS_TYPES.length, 'o som de chegada de cada chefão é diferente');
ok(ZOMBIE_VOICES.cry.cry && sig(ZOMBIE_VOICES.cry.cry) !== sig(ZOMBIE_VOICES.cry.idle), 'a Chorona tem um choro próprio');
const dur = (notes) => notes.reduce((a, s) => a + s.dur, 0);
ok(ZOMBIE_VOICES.cry.cry.some((s) => s.noise) && dur(ZOMBIE_VOICES.cry.cry) > dur(ZOMBIE_VOICES.cry.idle) + 0.8, 'o choro é mais longo e tem sopro');

const idles = types.map((t) => sig(ZOMBIE_VOICES[t].idle));
ok(new Set(idles).size === types.length, 'a voz de perto de cada tipo é diferente');
const bites = types.map((t) => sig(ZOMBIE_VOICES[t].bite));
ok(new Set(bites).size === types.length, 'a mordida de cada tipo é diferente');

if (fails.length) { console.log('FALHOU: ' + fails.join(' | ')); process.exit(1); }
console.log('TUDO OK');

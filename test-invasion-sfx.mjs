// Cada tipo da Invasão tem uma voz própria. Uso: node test-invasion-sfx.mjs
import { ZOMBIE_VOICES } from './invasion-sfx.js';
import { ZOMBIES } from './shared/invasion.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

const types = Object.keys(ZOMBIES);
ok(types.every((t) => ZOMBIE_VOICES[t] && ZOMBIE_VOICES[t].idle && ZOMBIE_VOICES[t].bite), 'todo tipo tem voz de perto e de mordida');
ok(ZOMBIE_VOICES.bossWolf.howl && ZOMBIE_VOICES.bossHosp.howl && !ZOMBIE_VOICES.walker.howl, 'uivo só no Lobisomem e no Hospício');

const sig = (notes) => notes.map((s) => (s.noise ? 'n' + s.noise : s.osc + ':' + s.f0 + '>' + s.f1)).join('|');
const idles = types.map((t) => sig(ZOMBIE_VOICES[t].idle));
ok(new Set(idles).size === types.length, 'a voz de perto de cada tipo é diferente');
const bites = types.map((t) => sig(ZOMBIE_VOICES[t].bite));
ok(new Set(bites).size === types.length, 'a mordida de cada tipo é diferente');

if (fails.length) { console.log('FALHOU: ' + fails.join(' | ')); process.exit(1); }
console.log('TUDO OK');

// Protocolo do chat e da voz, sem navegador: sala falsa em volta do Game.
import { Game } from './server/src/game.js';

const sent = [];
const g = new Game({ code: 'ABCD', map: 'arena', max: 4, fillBots: false, mode: 'dom' }, {
  send(id, o) { sent.push([id, o]); },
  broadcast(o) { sent.push(['*', o]); },
  startLoop() {}, stopLoop() {}, saveCfg() {},
});
const a = g.join({ name: 'Ana', skin: 'classico', primary: 0 }).ent;
const b = g.join({ name: 'Bruno', skin: 'classico', primary: 0 }).ent;
g.welcome(a); g.welcome(b);
a.team = 0; b.team = 1; a.alive = true; b.alive = false; g.state = 'playing';

const chats = () => sent.filter(([, m]) => m.t === 'chat');
function say(id, text, scope) { const n = chats().length; g.onMessage(id, { t: 'say', text, scope }); return chats().slice(n); }

let got = say(a.id, 'oi vivo', 'all');
if (got.length !== 2) throw new Error('morto devia ouvir o vivo: ' + JSON.stringify(got));
got = say(b.id, 'oi morto', 'all');
if (!(got.length === 1 && got[0][0] === b.id && got[0][1].dead === 1)) throw new Error('morto falou com vivo: ' + JSON.stringify(got));
b.alive = true; b.team = 0;
got = say(a.id, 'aliado', 'team');
if (got.map(([id]) => id).sort().join() !== [a.id, b.id].sort().join()) throw new Error('time não entregou aos dois: ' + JSON.stringify(got));
b.team = 1;
got = say(a.id, 'secreto', 'team');
if (got.length !== 1 || got[0][0] !== a.id) throw new Error('time vazou: ' + JSON.stringify(got));
g.cfg.mode = 'dm'; a.sayAt = [];
got = say(a.id, 'geral', 'team');
if (got.length !== 2 || got[0][1].scope !== 'all') throw new Error('mata-mata devia virar todos');
a.sayAt = [];
for (let i = 0; i < 4; i++) say(a.id, 'spam ' + i, 'all');
if (say(a.id, 'quinto', 'all').length) throw new Error('passou do limite de 4 mensagens');
g.cfg.chat = false;
a.sayAt = [];
if (say(a.id, 'calado', 'all').length) throw new Error('chat desligado ainda entregou');
g.cfg.chat = true; g.cfg.mode = 'dom'; a.team = 0; b.team = 0; a.voice = 'all'; b.voice = 'team';
sent.length = 0;
g.onMessage(a.id, { t: 'sig', to: b.id, kind: 'offer', data: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n' });
if (!sent.some(([, m]) => m.t === 'sig' && m.from === a.id)) throw new Error('não reencaminhou a oferta');
b.team = 1; b.voice = 'off'; a.voice = 'team';
sent.length = 0;
g.onMessage(a.id, { t: 'sig', to: b.id, kind: 'offer', data: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n' });
if (sent.length) throw new Error('voz de time atravessou o adversário');
// Competitivo: "Todos" vira time e o sinal não atravessa o adversário
g.cfg.mode = 'comp'; a.team = 0; b.team = 1; a.voice = 'off'; b.voice = 'off';
sent.length = 0;
g.onMessage(a.id, { t: 'voice', scope: 'all' });
if (a.voice !== 'team') throw new Error('competitivo aceitou voz pra sala toda: ' + a.voice);
const voiceList = sent.find(([, m]) => m.t === 'voices');
if (!voiceList || !voiceList[1].list.some((row) => row[0] === a.id && row[1] === 'team')) throw new Error('roster competitivo sem time');
a.voice = 'team'; b.voice = 'team';
sent.length = 0;
g.onMessage(a.id, { t: 'sig', to: b.id, kind: 'offer', data: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n' });
if (sent.length) throw new Error('competitivo deixou voz cruzar o time adversário');
b.team = 0;
sent.length = 0;
g.onMessage(a.id, { t: 'sig', to: b.id, kind: 'offer', data: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n' });
if (!sent.some(([, m]) => m.t === 'sig' && m.from === a.id)) throw new Error('competitivo não entregou voz ao aliado');
if (!g.chatLog.some((l) => l.sys && l.text === 'Ana entrou')) throw new Error('faltou a linha de entrada');
console.log('chat e voz ok', g.chatLog.length, 'linhas');

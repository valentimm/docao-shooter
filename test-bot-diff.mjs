// Dificuldade dos bots: limites justos, Ceva = IA antiga, e o servidor carimba o perfil.
// Uso: node test-bot-diff.mjs
import { Game } from './server/src/game.js';
import {
  BOT_DIFFS, DEFAULT_BOT_DIFF, normBotDiff, botProfile, shotSpread, hitscanAim,
  considerTarget, nadeChoice, hearGunshot, zombieTune, applyBotDiff, isBehind, canSpot, noteFootstep, STEP_ALERT,
} from './shared/bot-difficulty.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const io = { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} };
const ORDER = ['leitao', 'ceva', 'javali', 'cachaco'];
const mid = (a) => (a[0] + a[1]) / 2;

ok(BOT_DIFFS.map((d) => d.id).join(',') === ORDER.join(','), 'quatro níveis, do Leitão ao Cachaço');
ok(DEFAULT_BOT_DIFF === 'ceva' && normBotDiff('hack') === 'ceva' && normBotDiff('javali') === 'javali', 'id desconhecido volta pra Ceva');

for (const id of ORDER) {
  const p = botProfile(id);
  ok(p.reaction[0] >= 0.12 && p.reaction[1] > p.reaction[0], `${id}: reação nunca é instantânea`);
  ok(p.accuracy[0] > 0.004 && p.accuracy[1] >= p.accuracy[0], `${id}: o cone tem piso`);
  ok(p.vision <= 80 && p.vision >= 20, `${id}: visão curta, sem mapa inteiro`);
  ok(p.hear <= 45 && p.hear >= 0, `${id}: ouvido limitado`);
  ok(p.headP <= 0.65 && p.headP >= 0, `${id}: cabeça não é garantida`);
  ok(p.lead <= 0.6 && p.leadErr >= 0, `${id}: previsão curta e com erro`);
  ok(p.hpMul == null && p.dmgMul == null && p.zombie.hpMul == null, `${id}: sem multiplicar vida ou dano`);
  ok(p.zombie.spd >= 0.85 && p.zombie.spd <= 1.12, `${id}: a horda quase não muda de velocidade`);
  ok(p.missFloor > 0.03, `${id}: o ponto de mira ainda erra um pouco`);
}

const reac = ORDER.map((id) => mid(botProfile(id).reaction));
ok(reac[0] > reac[1] && reac[1] > reac[2] && reac[2] > reac[3], `reação desce Leitão→Cachaço (${reac.map((n) => n.toFixed(2)).join(' > ')})`);
const vis = ORDER.map((id) => botProfile(id).vision);
ok(vis[0] < vis[1] && vis[1] < vis[2] && vis[2] < vis[3], 'visão sobe com a dificuldade');
const floors = ORDER.map((id) => botProfile(id).accuracy[1]);
ok(floors[0] > floors[1] && floors[1] > floors[2] && floors[2] > floors[3], 'o piso da mira aperta');

const ceva = botProfile('ceva');
const bot = { accuracy: 0.055, reaction: 0.5, aim: 1, nades: 1, nextNade: 0, pos: { x: 0, y: 0, z: 0 } };
const still = { aimTime: 0, pellets: 1, targetMoving: false, selfMoving: false, egged: false, pistol: false, scope: false, weaponSpread: 0.08 };
ok(shotSpread(ceva, bot, still) === shotSpread(ceva, bot, { ...still, aimTime: 5 }), 'Ceva: o cone não fecha com o tempo (igual à IA antiga)');
ok(Math.abs(shotSpread(ceva, bot, still) - 0.055) < 1e-9, 'Ceva parado: spread = accuracy');
ok(Math.abs(shotSpread(ceva, bot, { ...still, targetMoving: true }) - 0.055 * 1.5) < 1e-9, 'Ceva: alvo andando ×1,5');
ok(Math.abs(shotSpread(ceva, bot, { ...still, pellets: 8, targetMoving: true }) - 0.08 * 1.2) < 1e-9, 'Ceva: cartucheira ignora o alvo andando e usa ×1,2');
ok(Math.abs(shotSpread(ceva, bot, { ...still, scope: true, targetMoving: true }) - 0.02 * 1.5) < 1e-9, 'Ceva: luneta 0,02 ×1,5 se o alvo corre');

const hard = botProfile('cachaco');
const open = shotSpread(hard, { accuracy: 0.01 }, still);
const shut = shotSpread(hard, { accuracy: 0.01 }, { ...still, aimTime: 2 });
ok(open > shut * 2 && shut < 0.02, `Cachaço: a mira fecha (${open.toFixed(3)} → ${shut.toFixed(3)})`);
ok(shotSpread(hard, { accuracy: 0.01 }, { ...still, aimTime: 2, selfMoving: true }) > shut, 'Cachaço andando abre o cone de novo');

const rnd = () => 0.5;
const aim = hitscanAim(ceva, bot, { x: 3, y: 0, z: 4 }, { x: 0, y: 0, z: 0 }, { ...still, rnd, stance: 1 });
ok(Math.abs(aim.x - 3) < 1e-9 && Math.abs(aim.z - 4) < 1e-9, 'Ceva com rnd no meio: sem desvio lateral extra além do spread');
ok(aim.y > 0.7 && aim.y < 1.6 && !aim.head, 'Ceva mira no tronco, nunca na cabeça');
const headShots = [];
for (let i = 0; i < 400; i++) headShots.push(hitscanAim(hard, { accuracy: 0.01 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { ...still, aimTime: 1, stance: 1 }).head);
const headRate = headShots.filter(Boolean).length / headShots.length;
ok(headRate > 0.35 && headRate < 0.75, `Cachaço busca o focinho às vezes (${(headRate * 100).toFixed(0)}%), não sempre`);

ok(considerTarget(ceva, 60, {}) == null && considerTarget(ceva, 10, {}) === 10, 'fora da visão não vira alvo');
ok(considerTarget(botProfile('leitao'), 40, {}) == null, 'Leitão não enxerga a 40 m');

const nadeBot = { nades: 1, nextNade: 0, aim: 1, reaction: 0.5 };
let threw = 0;
for (let i = 0; i < 200; i++) if (nadeChoice(ceva, nadeBot, 12, 0, 5) === 'throw') threw++;
ok(threw > 40 && threw < 110, `Ceva joga o copo perto de 35% (${threw}/200)`);
ok(nadeChoice(ceva, nadeBot, 4, 0, 5) === 'no', 'colado demais: não joga o copo');
ok(nadeChoice(botProfile('leitao'), { ...nadeBot, aim: 0.2, reaction: 0.9 }, 12, 0, 5) === 'no', 'Leitão não joga antes de mirar de verdade');

const heard = [{ bot: true, alive: true, diff: 'javali', pos: { x: 0, y: 0, z: 0 }, target: null }];
hearGunshot(heard, { x: 12, y: 1, z: 0 }, { id: 9 }, 3);
ok(heard[0].heard && heard[0].heard.x === 12 && heard[0].target == null, 'Javali ouve o tiro e não ganha alvo através da parede');
const busy = [{ bot: true, alive: true, diff: 'cachaco', pos: { x: 0, y: 0, z: 0 }, target: { alive: true } }];
hearGunshot(busy, { x: 8, y: 1, z: 0 }, { id: 9 }, 3);
ok(!busy[0].heard, 'quem já está vendo alguém ignora o som');
const deaf = [{ bot: true, alive: true, diff: 'ceva', pos: { x: 0, y: 0, z: 0 }, target: null }];
hearGunshot(deaf, { x: 8, y: 1, z: 0 }, { id: 9 }, 3);
ok(!deaf[0].heard, 'Ceva continua surda, como antes');
ok(zombieTune(() => 'leitao').spitErr > zombieTune('ceva').spitErr && zombieTune('ceva').spitErr === 0, 'a horda lê o id, e a Ceva cuspe sem erro extra');
ok(zombieTune('cachaco').spd < 1.1 && zombieTune('leitao').flank === 0, 'Cachaço não vira foguete; Leitão não cerca');

function boot(diff) {
  const g = new Game({ code: 'DIFF', map: 'arena', max: 4, fillBots: true, mode: 'dm', botDiff: diff }, io);
  let fake = 1000; g.now = () => fake;
  const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' }); a.connected = true;
  for (let i = 0; i < 20; i++) { fake += 0.05; g.tick(); }
  return g;
}
{
  const g = boot('cachaco');
  const bots = [...g.ents.values()].filter((e) => e.bot && !e.zt);
  ok(bots.length >= 1 && bots.every((b) => b.diff === 'cachaco' && b.reaction >= 0.14 && b.reaction <= 0.24), `servidor carimba Cachaço (${bots.map((b) => b.reaction.toFixed(2)).join(', ')})`);
  ok(g.cfg.botDiff === 'cachaco', 'a sala guarda botDiff');
}
{
  const g = boot(undefined);
  const bots = [...g.ents.values()].filter((e) => e.bot && !e.zt);
  ok(g.cfg.botDiff === 'ceva' && bots.every((b) => b.diff === 'ceva' && b.reaction >= 0.35 && b.reaction <= 0.65), 'sem escolha, a sala fica na Ceva com a reação antiga');
  g.onMessage([...g.ents.values()].find((e) => !e.bot).id, { t: 'cfg', botDiff: 'leitao' });
  ok(bots.every((b) => b.diff === 'leitao' && b.reaction >= 0.75), 'o anfitrião troca o nível e os bots vivos recebem o perfil novo');
}
{
  const g = new Game({ code: 'SMOKE', map: 'arena', max: 3, fillBots: true, mode: 'dm' }, io);
  let fake = 5000; g.now = () => fake;
  const a = g.join({ name: 'A' }).ent; g.welcome(a); g.onMessage(a.id, { t: 'start' }); a.connected = true;
  let threw = false;
  try { for (let i = 0; i < 40; i++) { fake += 0.05; g.tick(); } } catch (e) { threw = true; console.log(e); }
  ok(!threw, 'Ceva com bots andando e atirando não quebra o tick');
  const stamped = applyBotDiff({ bot: true }, 'javali', () => 0);
  ok(stamped.reaction === botProfile('javali').reaction[0] && stamped.heardAt === -99, 'applyBotDiff sorteia dentro da faixa e zera a memória de som');
}

{
  const bot = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, alive: true, bot: true, target: null };
  const front = { pos: { x: 0, y: 0, z: 4 }, alive: true };
  const back = { pos: { x: 0, y: 0, z: -3 }, alive: true };
  const far = { pos: { x: 0, y: 0, z: -(STEP_ALERT + 4) }, alive: true };
  ok(!isBehind(bot, front) && isBehind(bot, back), 'costas é o lado oposto do olhar');
  ok(canSpot(bot, front, 0) && !canSpot(bot, back, 0), 'sem passo, o bot não descobre quem está atrás');
  noteFootstep([bot], back, 10);
  ok(canSpot(bot, back, 10.4) && bot.heard && bot.heard.z === -3, 'passo bem perto atrás entrega a posição');
  noteFootstep([bot], far, 20);
  ok(!canSpot(bot, far, 20), 'passo longe atrás não conta');
  const mate = { pos: { x: 0, y: 0, z: -2 }, alive: true };
  const quiet = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, alive: true, bot: true, target: null };
  noteFootstep([quiet], mate, 1, () => false);
  ok(!quiet.stepHeard, 'passo de aliado não acorda o bot');
}

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

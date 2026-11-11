// Memória de armas, limites da sala e entrada no lugar de um bot. Sem navegador.
import { Game } from './server/src/game.js';
import { normWeapons, normPowers, clampLoadout, savedToLimits, limitsToSaved, powerOn, POWER_IDS } from './shared/loadout.js';
import { PRIMARIES, PISTOL, KNIFE, CATEGORIES } from './shared/rules.js';

const fails = [];
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) fails.push(msg); };

ok(normWeapons(null) === null && normPowers(null) === null, 'null continua “tudo liberado”');
ok(normWeapons([0, 4, 7]).join() === '0,4,7', 'lista mínima de um de cada slot passa direto');
const banned = clampLoadout(3, 11, 8, normWeapons([0, 4, 7]));
ok(banned.primary === 0 && banned.secondary === 4 && banned.melee === 7, 'bazuca, furadeira e sabre fora da lista voltam pro fuzil, pistola e faca');
const full = savedToLimits(limitsToSaved({ weapons: null, powers: null }));
ok(full.weapons === null && full.powers === null, 'tudo marcado salva e volta como “tudo”');
const onlyRajada = savedToLimits({ cats: ['rajada', 'secundaria', 'faca'], powers: ['health', 'uav'] });
ok(onlyRajada.weapons.includes(0) && !onlyRajada.weapons.includes(3) && onlyRajada.powers.join() === 'health,uav', 'desligar categorias tira a bazuca e guarda os power-ups marcados');
ok(!powerOn('missile', onlyRajada.powers) && powerOn('health', onlyRajada.powers), 'power-up de fora não liga');
ok(CATEGORIES.length > 0 && PRIMARIES.includes(0) && PISTOL === 4 && KNIFE === 7 && POWER_IDS.includes('uav'), 'ids do teste batem com as regras');

function room(extra) {
  const g = new Game({ code: 'TEST', map: 'arena', max: 4, fillBots: true, mode: 'dm', ...extra }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {}, saveCfg() {} });
  return g;
}
function enter(g, name, primary = 0, secondary = 4, melee = 7) {
  const r = g.join({ name, skin: 'classico', primary, secondary, melee, token: '' });
  if (r.ent) g.welcome(r.ent);
  return r;
}
const bots = (g) => [...g.ents.values()].filter((e) => e.bot);

const limited = room({ weapons: [0, 4, 7], powers: ['health'] });
const ana = enter(limited, 'Ana', 3, 11, 8);
ok(ana.ent && ana.ent.primary === 0 && ana.ent.secondary === 4 && ana.ent.melee === 7, 'entrar com arma proibida já nasce no loadout permitido');
limited.onMessage(ana.ent.id, { t: 'start', map: 'vizinhanca-cheers' });
ok(limited.pickups.some((p) => p.type === 'health' && p.active) && limited.pickups.some((p) => p.type === 'ammo' && !p.active) && limited.pickups.some((p) => p.type === 'grenade' && !p.active), 'só o power-up de vida fica no mapa');
for (let i = 0; i < 5; i++) limited.streakKill(ana.ent);
ok(ana.ent.ksBank.missile === 0, 'míssil desligado não entra no banco');
const open = room({});
const host = enter(open, 'Host');
open.onMessage(host.ent.id, { t: 'start', map: 'arena' });
for (let i = 0; i < 5; i++) open.streakKill(host.ent);
ok(host.ent.ksBank.missile === 1, 'sem limite o míssil do 5º abate entra');

const before = bots(limited).length;
const bia = enter(limited, 'Bia', 0, 4, 7);
ok(!bia.error && bia.ent && bots(limited).length === before - 1 && limited.humans().length === 2, 'quem entra no meio da partida substitui um bot');
ok([...limited.ents.values()].filter((e) => e.bot || e.connected).length === limited.cfg.max, 'humanos + bots continuam no máximo da sala');

const dom = room({ mode: 'dom', max: 4 });
const d0 = enter(dom, 'Duda');
dom.onMessage(d0.ent.id, { t: 'start', map: 'arena' });
const db = bots(dom).length;
const d1 = enter(dom, 'Davi');
ok(!d1.error && d1.ent.pendingTeam && bots(dom).length === db - 1, 'na dominação também sai um bot, e a pessoa escolhe o time antes de nascer');

const fullRoom = room({ max: 2, fillBots: false });
enter(fullRoom, 'Um'); enter(fullRoom, 'Dois');
const tres = fullRoom.join({ name: 'Tres', skin: 'classico', primary: 0, secondary: 4, melee: 7 });
ok(tres.error === 'Sala cheia', 'sala sem vaga continua cheia');

const aberta = room({ max: 4, fillBots: false, mode: 'dm' });
const um = enter(aberta, 'Um');
aberta.onMessage(um.ent.id, { t: 'start', map: 'arena' });
ok(bots(aberta).length === 0, 'mata-mata sem bots começa só com quem está na sala');
ok(!enter(aberta, 'Dois').error && !enter(aberta, 'Tres').error && aberta.humans().length === 3, 'sem bots, a partida aceita gente até o máximo');
const vazia = room({ max: 6, fillBots: true, mode: 'comp', side: 3 });
ok(vazia.cfg.fillBots === false && vazia.cfg.max === 6, 'competitivo 3v3 cabe 6 e não completa com bot');
const dono = enter(vazia, 'Dono');
vazia.onMessage(dono.ent.id, { t: 'start', map: 'rodizio' });
ok(bots(vazia).length === 0, 'a partida sem bots não inventa jogador');
const dois = enter(vazia, 'Dois');
const tresComp = enter(vazia, 'Tres');
ok(!dois.error && !tresComp.error && vazia.humans().length === 3 && bots(vazia).length === 0, 'com a partida no ar, gente entra até o máximo e o lugar continua sem bot');
vazia.onMessage(dono.ent.id, { t: 'cfg', fillBots: true, side: 3, mode: 'comp', max: 6 });
ok(vazia.cfg.fillBots === false && vazia.cfg.max === 6, 'competitivo não liga bot no meio da configuração');

const train = new Game({ code: 'TR', map: 'arena', max: 4, fillBots: true, mode: 'treino' }, { send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });
const t0 = enter(train, 'Treinador');
train.onMessage(t0.ent.id, { t: 'start' });
const dummies = bots(train).length;
enter(train, 'Visitante');
ok(bots(train).length === dummies && dummies > 0, 'no estande entrar no meio não apaga os alvos');

if (fails.length) { console.error('\n' + fails.length + ' falha(s)'); process.exit(1); }
console.log('\ntudo certo');

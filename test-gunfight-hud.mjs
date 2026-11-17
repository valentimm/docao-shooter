// HUD do Gunfight, sem navegador: adaptador do gunfightHud e os banners dos eventos.
import { adaptGunfightHud, gunfightBannersFromEvents, gunfightEvents, normalizeGunfight, normFormat, rosterFromEnts, spectatePool, cycleSpectate, spectateCaption, formatGunfightClock, GF_LIVE, GF_MODE, GF_WHY } from './gunfight-hud.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(GF_MODE === 'gf' && GF_LIVE === true, 'modo gf existe e a partida está ligada (GF_LIVE true)');
ok(normFormat('2v2') === 2 && normFormat(4) === 4 && normFormat('9v9') === 2 && normFormat('1v1') === 1, 'formato aceita 2 e "2v2"');

const ents = [
  { id: 1, name: 'Docão', team: 0, hp: 0, alive: false },
  { id: 2, name: 'Bacon', team: 0, hp: 64, alive: true },
  { id: 3, name: 'Torresmo', team: 1, hp: 80, alive: true },
];
const hud = {
  round: 3, score: [2, 1], phase: 'live', timeLeft: 74,
  classId: 3, classKey: 'bazooka', className: 'Bazuca',
  nextClassId: 1, nextClassKey: 'shotgun', side: 0,
  alive: [1, 1], hp: [64, 80],
  contested: false, capTeam: -1, capProg: 0, capNeed: 3,
  over: false, winner: -1, reason: '',
};
const view = normalizeGunfight(adaptGunfightHud(hud, { format: '2v2', ents }));
ok(view.format === 2 && view.className === 'Bazuca' && view.nextClassName === 'Calibre 12', `classe e próxima (${view.className} → ${view.nextClassName})`);
ok(view.teamHp[0] === 64 && view.teamHp[1] === 80, 'vida somada vem de hp:[hp0,hp1]');
ok(view.roster.red.length === 2 && view.roster.red[1].name === 'Bacon' && view.roster.red[0].alive === false, 'roster com nome/hp/vivo sai das entidades');
ok(formatGunfightClock(view) === '1:14', 'timer live 74 s = 1:14');
const prep4 = normalizeGunfight(adaptGunfightHud({ round: 3, phase: 'prep', timeLeft: 4, score: [1, 0], side: 1, alive: [2, 2], hp: [200, 200], className: 'Bazuca' }, { format: '2v2' }));
ok(formatGunfightClock(prep4) === 'PREP 4', 'prep de 4 s escreve PREP 4');
const live40 = normalizeGunfight(adaptGunfightHud({ round: 1, phase: 'live', timeLeft: 40, score: [0, 0], side: 0, alive: [2, 2], hp: [200, 200], className: 'Faca' }, { format: '2v2' }));
ok(formatGunfightClock(live40) === '0:40', '2v2 ao vivo com 40 s escreve 0:40');
const r2 = normalizeGunfight(adaptGunfightHud({ round: 2, phase: 'prep', timeLeft: 4, score: [1, 0], side: 0, alive: [2, 2], hp: [200, 200], className: 'Faca' }, { format: 2 }));
const r3 = normalizeGunfight(adaptGunfightHud({ round: 3, phase: 'prep', timeLeft: 4, score: [1, 0], side: 1, alive: [2, 2], hp: [200, 200], className: 'Bazuca' }, { format: 2 }));
ok(gunfightEvents(r2, r3).some((e) => e.kind === 'swap' && e.title === 'Troca de lado!'), 'round 3 abre com Troca de lado');
const r4 = normalizeGunfight(adaptGunfightHud({ round: 4, phase: 'prep', timeLeft: 4, score: [1, 1], side: 1, alive: [2, 2], hp: [200, 200], className: 'Bazuca' }, { format: 2 }));
ok(!gunfightEvents(r3, r4).some((e) => e.kind === 'swap'), 'round 4 não repete a troca de lado');
const r5 = normalizeGunfight(adaptGunfightHud({ round: 5, phase: 'prep', timeLeft: 4, score: [2, 1], side: 0, alive: [2, 2], hp: [200, 200], className: 'Faca' }, { format: 2 }));
ok(gunfightEvents(r4, r5).some((e) => e.kind === 'swap'), 'round 5 troca de lado de novo');

const ot = normalizeGunfight(adaptGunfightHud({
  round: 6, score: [5, 5], phase: 'ot', timeLeft: 10,
  classKey: 'minigun', className: 'Minigun', nextClassId: null, nextClassKey: '',
  side: 0, alive: [3, 4], hp: [240, 310],
  contested: true, capTeam: 0, capProg: 1.86, capNeed: 3,
  over: false, winner: -1, reason: '',
}, { format: '4v4' }));
ok(formatGunfightClock(ot) === 'OVERTIME 10', 'overtime escreve OVERTIME 10');
ok(formatGunfightClock({ phase: 'ot', timeLeft: 9.2, format: 2 }) === 'OVERTIME 10', '9,2 s ainda mostra OVERTIME 10 (teto)');
ok(formatGunfightClock({ phase: 'ot', timeLeft: 0.2, format: 2 }) === 'OVERTIME 1', 'último segundo é OVERTIME 1');
ok(formatGunfightClock({ phase: 'ot', timeLeft: 0, format: 2 }) === 'OVERTIME 0', 'zero escreve OVERTIME 0');
ok(formatGunfightClock({ phase: 'end', timeLeft: 2, format: 2 }) === 'FIM', 'acabou o overtime: o relógio sai de OVERTIME');
ok(ot.zone && ot.zone.contested && Math.abs(ot.zone.progress - 1.86 / 3) < 1e-9, 'barra de captura = capProg/capNeed, contestada');

const swap = gunfightBannersFromEvents([['round', 4], ['swap'], ['class', 8]], { className: 'Sabre de Luz', classId: -1, score: [2, 2], round: 4 });
ok(swap.length === 1 && swap[0].kind === 'swap' && swap[0].title === 'Troca de lado!' && !/classe/i.test(swap[0].sub || ''), 'Troca de lado! não repete a classe');

const round = gunfightBannersFromEvents([['round', 3], ['class', 3]], { classId: 3, className: 'Bazuca', score: [0, 0], round: 3 });
ok(round[0].title === 'Round 3' && !/classe/i.test(round[0].title + (round[0].sub || '')), 'início de round não repete a classe');

const win = gunfightBannersFromEvents([['win', 0, 'elim']], { score: [3, 1], round: 3, className: 'Bazuca' });
ok(win[0].title === 'Vermelho venceu a rodada!' && win[0].sub.startsWith('Eliminação'), 'vitória por eliminação');
const cap = gunfightBannersFromEvents([['win', 1, 'cap']], { score: [5, 6], round: 6 });
ok(cap[0].title === 'Azul venceu a rodada!' && cap[0].sub.startsWith(GF_WHY.cap), 'cap vira Zona no banner');
const draw = gunfightBannersFromEvents([['win', -1, 'draw']], { score: [2, 2], round: 4 });
ok(draw[0].title === 'Empate!' && draw[0].team === -1, 'time -1 é empate');
const hp = gunfightBannersFromEvents([['win', 0, 'hp']], { score: [4, 3], round: 5 });
ok(hp[0].sub.startsWith('Vida'), 'desempate por vida');
const over = gunfightBannersFromEvents([['over', -1]], { score: [5, 5], round: 11 });
ok(over[0].kind === 'over' && over[0].title === 'Empate!', 'fim de partida empatada');
const go = gunfightBannersFromEvents([['go']], { className: 'Faca', classId: 7, score: [0, 0], round: 1 });
ok(go[0].kind === 'go' && go[0].title === 'VALENDO!' && !/classe/i.test(go[0].sub || ''), 'go avisa VALENDO sem repetir a classe');

const roster = rosterFromEnts(ents);
const spec = spectatePool({ format: 2, phase: 'live', roster }, 'red', 1);
ok(spec.reason === 'ally' && spec.list.length === 1 && spec.list[0].name === 'Bacon', 'espectador segue o aliado vivo');
ok(spectateCaption('Bacon') === 'Assistindo Bacon · clique troca', 'texto do espectador');
const duel = spectatePool({ format: 1, phase: 'live', roster: { red: [{ id: 1, name: 'Docão', alive: false }], blue: [{ id: 2, name: 'Torresmo', alive: true }] } }, 0, 1);
ok(duel.enemy && duel.list[0].name === 'Torresmo', '1v1 segue o inimigo vivo');
const wiped = spectatePool({ format: '4v4', phase: 'ot', roster: { red: [{ id: 1, alive: false }], blue: [{ id: 9, name: 'Azulão', alive: true }, { id: 8, name: 'Jeans', alive: true }] } }, 0, 1);
ok(wiped.reason === 'wiped' && wiped.list.length === 2, 'time morto no overtime segue inimigo até o banner');
const ended = spectatePool({ format: 2, phase: 'end', roster }, 0, 1);
ok(ended.list.length === 0 && ended.reason === 'banner', 'fase end solta a câmera pro banner');
const nxt = cycleSpectate(wiped.list, 9, 1);
ok(nxt && nxt.id === 8, 'Q/E ou clique avança o alvo');
const prev = cycleSpectate(wiped.list, 9, -1);
ok(prev && prev.id === 8, 'ciclo para trás fecha o anel');

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);

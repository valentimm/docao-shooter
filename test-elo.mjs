// Elo do Competitivo, sem navegador: node test-elo.mjs
import {
  ELO_START, ELO_TIERS, ELO_MODES, eloTier, eloTierNext, isMaxEloTier, eloK, expectedScore,
  perfMul, computeCompEloDeltas, computeDmEloDeltas, eloEligible, eloSummary,
} from './shared/elo.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(eloTier(0).id === 'pipoca' && eloTier(999).id === 'pipoca', 'abaixo de 1000 é Pipoca');
ok(eloTier(1000).id === 'coxinha' && eloTier(1199).id === 'coxinha', '1000–1199 Coxinha');
ok(eloTier(2200).id === 'docao' && isMaxEloTier(2500), '2200+ é Docão Supremo');
ok(eloTierNext(1000)?.id === 'pastel' && !eloTierNext(2200), 'próxima insígnia e fim da lista');
ok(ELO_TIERS.length === 8 && ELO_TIERS[0].min === 0 && ELO_TIERS.at(-1).min === 2200, '8 insígnias até Docão Supremo');
ok(ELO_MODES.map((m) => m.id).join(',') === 'dm,arms,gf,x1,comp' && ELO_MODES.find((m) => m.id === 'comp').always && !ELO_MODES.find((m) => m.id === 'dm').always, '5 modalidades; só o competitivo é sempre');

ok(eloK(1000, 0) === 32 && eloK(1000, 19) === 32 && eloK(1000, 20) === 24 && eloK(1800, 20) === 16, 'K novo/médio/alto');
ok(Math.abs(expectedScore(1000, 1000) - 0.5) < 1e-9, 'favorito empatado = 50%');
ok(expectedScore(1400, 1000) > 0.7 && expectedScore(1000, 1400) < 0.3, 'favorito tem expectativa maior');

ok(perfMul(10, [10, 10]) === 1, 'na média do time = 1');
ok(perfMul(20, [10, 10]) > 1 && perfMul(2, [10, 10]) < 1, 'acima/abaixo da média');

const even = [
  { id: 1, team: 0, score: 10, rating: ELO_START, games: 5 },
  { id: 2, team: 0, score: 8, rating: ELO_START, games: 5 },
  { id: 3, team: 1, score: 9, rating: ELO_START, games: 5 },
  { id: 4, team: 1, score: 7, rating: ELO_START, games: 5 },
];
const win = computeCompEloDeltas(even, 0);
ok(win.length === 4, 'todos com conta recebem delta');
ok(win.filter((d) => d.id === 1 || d.id === 2).every((d) => d.delta > 0 && d.won), 'time vencedor sobe');
ok(win.filter((d) => d.id === 3 || d.id === 4).every((d) => d.delta < 0 && !d.won), 'time perdedor desce');
ok(win.find((d) => d.id === 1).delta >= win.find((d) => d.id === 2).delta, 'melhor score no time ganha mais (ou igual)');

const upset = computeCompEloDeltas([
  { id: 1, team: 0, score: 5, rating: 900, games: 30 },
  { id: 2, team: 1, score: 5, rating: 1400, games: 30 },
], 0);
ok(upset.find((d) => d.id === 1).delta > 0 && upset.find((d) => d.id === 2).delta < 0, 'zebra: underdog sobe e favorito desce');
ok(upset.find((d) => d.id === 1).delta >= 8, 'zebra rende ganho relevante ao underdog');

ok(!eloEligible({ fillBots: true, hasBots: false, humans: [1, 2] }), 'fillBots bloqueia');
ok(!eloEligible({ fillBots: false, hasBots: true, humans: [1, 2] }), 'bot na sala bloqueia');
ok(eloEligible({ fillBots: false, hasBots: false, humans: [1, 2] }), 'só humanos libera (competitivo, sem mode)');
ok(!eloEligible({ fillBots: false, hasBots: false, humans: [1, 2], mode: 'dm', eloOn: false }), 'mata-mata sem a opção não conta');
ok(eloEligible({ fillBots: false, hasBots: false, humans: [1, 2], mode: 'dm', eloOn: true }), 'mata-mata valendo Elo libera');
ok(!eloEligible({ fillBots: false, hasBots: false, humans: [1, 2], mode: 'arms', eloOn: false }), 'corrida sem a opção não conta');
ok(eloEligible({ fillBots: false, hasBots: false, humans: [1, 2], mode: 'arms', eloOn: true }), 'corrida valendo Elo libera');
ok(eloEligible({ fillBots: false, hasBots: false, humans: [1, 2], mode: 'gf', eloOn: true }), 'duelo valendo Elo libera');
ok(eloEligible({ fillBots: false, hasBots: false, humans: [1, 2], mode: 'x1', eloOn: true }), 'x1 valendo Elo libera');
ok(eloEligible({ fillBots: false, hasBots: false, humans: [1, 2], mode: 'comp', eloOn: false }), 'competitivo conta mesmo sem a opção');
ok(computeCompEloDeltas(even, -1).length === 0, 'empate não mexe');
const x1 = computeCompEloDeltas([
  { id: 1, team: 0, score: 10, rating: ELO_START, games: 3 },
  { id: 2, team: 1, score: 7, rating: ELO_START, games: 3 },
], 0);
ok(x1.length === 2 && x1.find((d) => d.id === 1).delta > 0 && x1.find((d) => d.id === 2).delta < 0, 'x1: quem fez mais abates sobe');

const dmP = (id, score, deaths, rating = ELO_START, games = 5, win = false) => ({ id, score, deaths, rating, games, win });
const dmOf = (rows, id) => rows.find((d) => d.id === id);
const blow = computeDmEloDeltas([dmP(1, 20, 2), dmP(2, 0, 8)]);
const close = computeDmEloDeltas([dmP(1, 20, 2), dmP(2, 19, 3)]);
ok(blow.length === 2 && dmOf(blow, 1).won && dmOf(blow, 1).delta > 0 && dmOf(blow, 2).delta < 0, 'mata-mata: primeiro sobe e o último desce');
ok(dmOf(close, 1).delta > 0 && dmOf(close, 1).delta < dmOf(blow, 1).delta, 'vitória apertada rende menos do que um banho');
ok(dmOf(close, 2).delta < 0 && dmOf(close, 2).delta > dmOf(blow, 2).delta, 'perder por um abate dói menos do que perder de lavada');
const pod = computeDmEloDeltas([dmP(1, 20, 1), dmP(2, 12, 4), dmP(3, 4, 6)]);
ok(dmOf(pod, 1).delta > dmOf(pod, 2).delta && dmOf(pod, 2).delta > dmOf(pod, 3).delta, 'posição melhor muda mais o Elo, na mesma sala');
const field = computeDmEloDeltas([dmP(1, 20, 1, 1000, 30), dmP(2, 6, 4, 1000, 30)]);
const beatHigh = computeDmEloDeltas([dmP(1, 20, 1, 1000, 30), dmP(2, 6, 4, 1600, 30)]);
ok(dmOf(beatHigh, 1).delta > dmOf(field, 1).delta, 'ganhar de Elo mais alto rende mais');
const loseToHigh = computeDmEloDeltas([dmP(1, 20, 1, 1600, 30), dmP(2, 6, 4, 1000, 30)]);
const loseToLow = computeDmEloDeltas([dmP(1, 20, 1, 900, 30), dmP(2, 6, 4, 1000, 30)]);
ok(dmOf(loseToHigh, 2).delta > dmOf(loseToLow, 2).delta, 'perder de Elo mais alto dói menos');
const fav = computeDmEloDeltas([dmP(1, 20, 2, 1800, 40), dmP(2, 19, 3, 1000, 40)]);
ok(fav.find((d) => d.id === 1).won && fav.find((d) => d.id === 1).delta >= 1, 'favorito que ganha apertado não perde Elo');
const tie = computeDmEloDeltas([dmP(1, 8, 3), dmP(2, 8, 3)]);
ok(tie.every((d) => d.delta === 0 && !d.won), 'empate de abates e mortes, mesmo Elo, não mexe');
const deaths = computeDmEloDeltas([dmP(1, 15, 4), dmP(2, 15, 9)]);
ok(dmOf(deaths, 1).won && dmOf(deaths, 1).delta > 0 && dmOf(deaths, 2).delta < 0, 'mesmos abates: menos mortes fica na frente');
ok(dmOf(deaths, 1).delta < dmOf(blow, 1).delta, 'desempate por mortes mexe menos do que um banho de abates');
const nuke = computeDmEloDeltas([dmP(1, 4, 2, ELO_START, 5, true), dmP(2, 18, 3)]);
ok(dmOf(nuke, 1).won && dmOf(nuke, 1).delta > 0 && !dmOf(nuke, 2).won, 'fim da chapa é o primeiro mesmo com menos abates');
ok(computeDmEloDeltas([dmP(1, 20, 0)]).length === 0, 'sozinho não tem Elo');
const floor = computeDmEloDeltas([dmP(1, 20, 0, 1000, 5), dmP(2, 0, 9, 0, 40)]);
ok(dmOf(floor, 2).after === 0 && dmOf(floor, 2).delta === 0, 'Elo do mata-mata não passa de zero');

const s = eloSummary(1650, 12);
ok(s.tier.id === 'churrasqueiro' && s.toNext === 1800 - 1650 && s.next.id === 'capataz', 'resumo com progresso');

if (fails.length) { console.error('\n' + fails.length + ' falha(s)'); process.exit(1); }
console.log('\nelo ok');

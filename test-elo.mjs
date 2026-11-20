// Elo do Competitivo, sem navegador: node test-elo.mjs
import {
  ELO_START, ELO_TIERS, ELO_MODES, eloTier, eloTierNext, isMaxEloTier, eloK, expectedScore,
  perfMul, computeCompEloDeltas, eloEligible, eloSummary,
} from './shared/elo.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

ok(eloTier(0).id === 'pipoca' && eloTier(999).id === 'pipoca', 'abaixo de 1000 é Pipoca');
ok(eloTier(1000).id === 'coxinha' && eloTier(1199).id === 'coxinha', '1000–1199 Coxinha');
ok(eloTier(2200).id === 'docao' && isMaxEloTier(2500), '2200+ é Docão Supremo');
ok(eloTierNext(1000)?.id === 'pastel' && !eloTierNext(2200), 'próxima insígnia e fim da lista');
ok(ELO_TIERS.length === 8 && ELO_TIERS[0].min === 0 && ELO_TIERS.at(-1).min === 2200, '8 insígnias até Docão Supremo');
ok(ELO_MODES.map((m) => m.id).join(',') === 'arms,gf,x1,comp' && ELO_MODES.find((m) => m.id === 'comp').always && !ELO_MODES.find((m) => m.id === 'gf').always, '4 modalidades; só o competitivo é sempre');

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
ok(!eloEligible({ fillBots: false, hasBots: false, humans: [1, 2], mode: 'dm', eloOn: true }), 'mata-mata não tem Elo');
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

const s = eloSummary(1650, 12);
ok(s.tier.id === 'churrasqueiro' && s.toNext === 1800 - 1650 && s.next.id === 'capataz', 'resumo com progresso');

if (fails.length) { console.error('\n' + fails.length + ' falha(s)'); process.exit(1); }
console.log('\nelo ok');

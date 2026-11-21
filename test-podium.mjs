import { awardPodium, notePodiumKill, notePodiumHurt, notePodiumDeath, emptyFun } from './shared/podium.js';

const a = { id: 1, name: 'Docão', skin: 'classico', dance: 'mewing', kills: 8, deaths: 2, caps: 0, fun: emptyFun() };
const b = { id: 2, name: 'Leitão', skin: 'classico', kills: 5, deaths: 4, caps: 1, fun: emptyFun() };
const c = { id: 3, name: 'Porca', skin: 'classico', kills: 3, deaths: 0, caps: 0, fun: emptyFun() };
notePodiumKill(a.fun, { head: true, dist: 8 });
notePodiumKill(a.fun, { head: true, dist: 6 });
notePodiumKill(a.fun, { head: true });
notePodiumDeath(a.fun);
notePodiumKill(b.fun, { knife: true, dist: 4 });
notePodiumKill(b.fun, { knife: true });
notePodiumHurt(b.fun, 40);
notePodiumHurt(a.fun, 900);
notePodiumHurt(c.fun, 10);
const prizes = awardPodium([a, b, c]);
if (prizes.length !== 3) throw new Error('podium size');
if (prizes[0].title !== 'Rei da chapa') throw new Error('1st should lead kills: ' + prizes[0].title);
if (prizes[0].dance !== 'mewing') throw new Error('keeps chosen dance');
const titles = prizes.map((p) => p.title);
if (new Set(titles).size !== 3) throw new Error('prizes must differ: ' + titles.join(','));
if (!prizes.some((p) => p.title === 'Mão na faca')) throw new Error('knife lead missing');
if (!prizes.some((p) => p.title === 'Couro duro' && p.name === 'Porca')) throw new Error('zero deaths should win firm');
if (prizes[1].dance !== 'moonwalk' && prizes[1].dance !== 'mewing' && prizes[1].dance !== 'sixseven') throw new Error('bot dance');

const solo = awardPodium([{ id: 1, name: 'Só', kills: 0, deaths: 0, fun: emptyFun() }]);
if (solo.length !== 1 || !solo[0].line) throw new Error('solo podium');
console.log('podium ok', titles.join(' · '));

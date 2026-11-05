// Fase 1 da integração Survival: saldo único + IA no mesmo jogo de servidor.
// Não é multiplayer de navegador (isso está em test-survival-sala.mjs).
//
// REVIVE — próxima rodada, commit ainda não entra aqui:
//   2 corações preservados, down deitado/rastejo/pistola, hold-to-revive,
//   armas preservadas no revive e no respawn.
//   Acrescentar os asserts nesse bloco sem reescrever saldo nem navegação.
// Uso: node test-survival-integrado.mjs
import { Game } from './server/src/game.js';
import { getMap } from './maps.js';
import { getSurvivalWaveTuning, SURVIVAL } from './shared/survival.js';
import { orderZombie } from './shared/invasion.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const io = () => ({ send() {}, broadcast() {}, startLoop() {}, stopLoop() {} });

const g = new Game({ code: 'INTG', map: 'rodizio', max: 4, fillBots: false, mode: 'inv', variant: 'survival', test: true }, io());
const ana = g.join({ name: 'Ana' }).ent;
const bia = g.join({ name: 'Bia' }).ent;
g.welcome(ana);
g.welcome(bia);
g.onMessage(ana.id, { t: 'start' });

ok(g.mapId === 'hotmilk-noite' && g.survival && g.invasion, 'Invasão + Survival abre só a HOTMILK à Noite');
ok(g.inv && g.inv.A && g.inv.A.survival === true, 'o núcleo da horda recebe survival:true');
ok(ana.alive && bia.alive, 'os dois entram vivos');
ok((ana.pts | 0) === 500 && ana.pts === ana.points && (bia.pts | 0) === 500 && bia.pts === bia.points, 'cada um entra com o próprio saldo de 500');

const beforeAreas = g.inv.A.spawnAreas().length;
const door = getMap('hotmilk-noite').survival.doors[0];
ana.pos = { x: door.at[0], y: door.at[1] || 0, z: door.at[2] };
const price = door.price;
ana.pts = price; ana.points = price; ana._purse = price;
const gen = ana.purseN | 0;
g.onMessage(ana.id, { t: 'door', id: door.id });
ok(ana.pts === 0 && ana.points === 0 && ana.pts === ana.points, 'a porta gasta os dois campos juntos e o zero permanece');
ok((ana.purseN | 0) > gen, 'a geração do saldo sobe no gasto');
ok((bia.pts | 0) === 500 && bia.pts === bia.points, 'a compra da Ana não mexe no saldo da Bia');
ok(g.surv.areas.has('cozinha'), 'a área comprada entra no conjunto aberto');
const afterAreas = g.inv.A.spawnAreas().length;
ok(afterAreas > beforeAreas, `spawnAreas da IA cresce com a área comprada (${beforeAreas} → ${afterAreas})`);
const info = g.entInfo(ana);
ok(info.pts === 0 && (info.pn | 0) === (ana.purseN | 0) && info.kills === 0, 'o retrato manda saldo 0 e geração, sem misturar com o placar');

const w1 = getSurvivalWaveTuning(1, 2);
const w20 = getSurvivalWaveTuning(20, 2);
ok(w1.speedScale < 0.7 && w1.maxAlive <= w20.maxAlive && w20.speedScale === 1, `curva intacta (wave 1 ×${w1.speedScale}, teto ${w1.maxAlive}; wave 20 ×${w20.speedScale})`);
ok(typeof orderZombie === 'function', 'orderZombie segue exportado para a IA');
ok(typeof g.inv.A.targetable === 'function' && g.inv.A.targetable(ana) && g.inv.zombieWants(ana), 'jogador de pé continua alvo da horda');

// Down (WIP do revive) no mesmo saldo e na mesma IA. Não muda bleed/hold/alcance.
{
  const purse = 320;
  ana.pts = purse; ana.points = purse; ana._purse = purse; ana.purseN = 4;
  ana.lives = 1; ana.invulnUntil = 0;
  g.damage(ana, 500, null, 0, false);
  ok(ana.alive && ana.down && !ana.out && ana.lives === 0, 'a morte que zera o coração entra em down, sem virar fora');
  ok(ana.pts === purse && ana.points === purse && ana.purseN === 4, 'cair não debita nem devolve a carteira');
  g.damage(ana, 500, null, 0, false);
  ok(ana.down && ana.hp > 0, 'dano extra no caído não finaliza');
  bia.pos = { x: ana.pos.x + 18, y: ana.pos.y, z: ana.pos.z };
  g.inv.phase = 'wave';
  const z = g.inv.spawn('walker');
  ok(!!z, 'a horda ainda solta zumbi com um jogador caído');
  if (z) {
    z.pos = { x: ana.pos.x + 1, y: ana.pos.y, z: ana.pos.z };
    const tgt = g.inv.pickTarget(z);
    ok(tgt && tgt.id === bia.id, `o zumbi ignora o caído e escolhe quem está de pé (${tgt && tgt.id})`);
    orderZombie(z, { targetId: ana.id });
    ok(g.inv.pickTarget(z) == null || g.inv.pickTarget(z).id !== ana.id, 'ordem apontando pro caído não vira alvo');
    orderZombie(z, null);
  }
  bia.lives = 1; bia.invulnUntil = 0;
  g.damage(bia, 500, null, 0, false);
  ok(bia.down && !g.inv.zombieWants(ana) && !g.inv.zombieWants(bia), 'dois caídos saem da lista; a horda não trata isso como morte permanente');
  let fake = g.now();
  g.now = () => fake;
  g.lastTick = fake;
  const step = (sec) => { const n = Math.max(1, Math.round(sec / 0.05)); for (let i = 0; i < n; i++) { fake += 0.05; g.tick(); } };
  step(2);
  ok(!ana.alive && ana.out && !bia.alive && bia.out, 'todos caídos sangram e saem, a partida não fica presa neles');
  ok((ana.pts | 0) === purse && (bia.pts | 0) === 500, 'o sangramento não mexe nas carteiras');
  step(2);
  ok(g.inv.phase === 'over' || g.pendingEnd, `a horda encerra depois que os dois estão fora (${g.inv.phase})`);
}

if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\ntudo ok');

// Invasão: dificuldade Normal (cruz + revive segurando E 5 s) e Hardcore (sem cruz, sem Ressurreição). Uso: node test-invasao-cruz.mjs
import { InvasionCore, INV_CROSS, normInvDiff, parseState, POWER_KEYS } from './shared/invasion.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

function setup(hard, extra = {}) {
  let T = 10; const events = [], revived = [];
  const mk = (id, x) => ({ id, alive: true, hp: 100, pos: { x, y: 0, z: 0 }, useHold: false });
  const H = [mk(1, 0), mk(2, 5), mk(3, 30)];
  const core = new InvasionCore({
    size: [40, 40], T: () => T, nav: null, rnd: () => 0.3, hard, ...extra,
    P: { groundAt: () => 0, losClear: () => true },
    players: () => H,
    emit(ev) { events.push(ev); },
    revive(p, at, o) { revived.push({ p, at, o }); p.alive = true; p.hp = (o && o.hp) || 100; p.pos = { ...at }; },
    invChanged() {}, aimOf: () => ({ o: { x: 0, y: 1, z: 0 }, d: { x: 0, y: 0, z: 1 } }),
  });
  for (const p of H) core.ensure(p, true);
  core.phase = 'wave'; core.wave = 3;
  const die = (p) => { p.alive = false; p.hp = 0; return core.onPlayerDeath(p); };
  return { core, H, events, revived, die, tick: (dt) => { T += dt; core.stepCrosses(dt); } };
}

ok(normInvDiff(undefined) === 'normal' && normInvDiff('xyz') === 'normal' && normInvDiff('hard') === 'hard' && normInvDiff('hardcore') === 'hard', 'padrão é Normal; hard/hardcore viram Hardcore');

{ // Normal: cruz e revive
  const { core, H, events, revived, die, tick } = setup(false);
  const [a, b, c] = H;
  ok(die(a) === true && core.crosses.length === 0, 'com vida sobrando: renasce normal, sem cruz');
  a.alive = true; a.pos = { x: 0, y: 0, z: 0 };
  ok(die(a) === false && a.out && core.crosses.length === 1, 'sem vidas: fica fora e vira cruz');
  const cr = core.crosses[0];
  ok(cr.x === 0 && cr.z === 0 && cr.y === 0, 'cruz no lugar onde morreu');
  b.pos = { x: 1, y: 0, z: 0 };
  tick(2); ok(cr.prog === 0 && !cr.by, 'perto mas sem segurar E: nada');
  b.useHold = true; tick(2); ok(cr.by === b.id && cr.prog >= 2, 'segurando E perto: começa a reviver');
  b.pos = { x: 10, y: 0, z: 0 }; tick(0.1); ok(cr.prog === 0 && cr.by === 0, 'saiu de perto: interrompe e zera');
  b.pos = { x: 1, y: 0, z: 0 }; tick(3); b.useHold = false; tick(0.1); ok(cr.prog === 0, 'soltou E: interrompe');
  b.useHold = true; tick(2); b.alive = false; tick(0.1); ok(cr.prog === 0, 'reviver morreu: interrompe');
  b.alive = true;
  c.pos = { x: 30, y: 0, z: 0 }; c.useHold = true; tick(1); ok(cr.by === b.id, 'só quem está perto revive');
  const st = parseState(core.stateArr());
  ok(st.hard === false && st.crosses.length === 1 && st.crosses[0].id === a.id && st.crosses[0].by === b.id, 'snapshot leva dificuldade e cruz (quem e progresso)');
  for (let i = 0; i < 45; i++) tick(0.1);
  ok(revived.length === 1 && revived[0].p === a && revived[0].o.exact && revived[0].o.hp === INV_CROSS.hp, `revive no lugar da cruz com ${INV_CROSS.hp}% de vida após ${INV_CROSS.hold} s`);
  ok(!a.out && a.lives === 0 && core.crosses.length === 0, 'revivido sem vida extra e a cruz some');
  ok(events.some((e) => e[0] === 'cxr' && e[1] === a.id && e[2] === b.id), 'evento cxr avisa quem reviveu quem');
  a.pos = { x: 3, y: 0, z: 3 };
  ok(die(a) === false && core.crosses.length === 1 && core.crosses[0].x === 3, 'morreu de novo: cruz de novo');
  a.out = false; tick(0.1); ok(core.crosses.length === 0, 'Ressurreição (out=false) tira a cruz');
  die(a); core.phase = 'over'; tick(0.1); ok(core.crosses.length === 0, 'fim da partida limpa as cruzes');
}

{ // um reviver por vez em duas cruzes
  const { core, H, die, tick } = setup(false);
  const [a, b, c] = H; a.lives = 1; c.lives = 1; c.pos = { x: 0.5, y: 0, z: 0 };
  die(a); die(c); b.pos = { x: 0.2, y: 0, z: 0 }; b.useHold = true; tick(1);
  ok(core.crosses.filter((x) => x.by === b.id).length === 1, 'quem segura E revive uma cruz de cada vez');
}

{ // Survival não usa cruz (tem o caído)
  const { core, H, die } = setup(false, { survival: true });
  H[0].lives = 1; die(H[0]); ok(core.crosses.length === 0, 'Survival: sem cruz');
}

{ // Hardcore
  const { core, H, die } = setup(true);
  const [a, b] = H; a.lives = 1;
  ok(die(a) === false && a.out && core.crosses.length === 0, 'Hardcore: sem vidas = fora, sem cruz');
  let drops = 0; for (let i = 0; i < 400; i++) { core.rnd = () => (i % 97) / 97; const d = core.drop({ x: 0, y: 0, z: 0 }, true); if (d.kind === 'revive') drops++; }
  ok(drops === 0, 'Hardcore: a Ressurreição nunca cai (400 drops de chefão)');
  b.inv = ['revive']; const used = core.usePower(b, 0, null);
  ok(used === null && !b.inv.includes('revive') && a.out && !a.alive, 'Hardcore: Ressurreição no inventário não funciona (o servidor recusa)');
  ok(parseState(core.stateArr()).hard === true, 'snapshot avisa Hardcore');
}

{ // Normal ainda deixa a Ressurreição cair
  const { core } = setup(false);
  let seen = false; for (let i = 0; i < 200 && !seen; i++) { core.rnd = () => (i % 89) / 89; core.resCount = { wave: {}, block: {} }; const d = core.drop({ x: 0, y: 0, z: 0 }, true); if (d.kind === 'revive') seen = true; }
  ok(seen && POWER_KEYS.includes('revive'), 'Normal: a Ressurreição continua existindo');
}

if (fails.length) { console.log(`\n${fails.length} falha(s)`); process.exit(1); }
console.log('\nTudo certo');

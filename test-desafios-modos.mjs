// Desafios contam em qualquer sala online (Corrida Armada, X1), não só nos 4 modos do ranking. Treino nunca.
import { recordStats } from './server/src/auth.js';
import { dailyIds, CHAL_BY_ID, spDay } from './shared/challenges.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) fail++; };
const acct = [...Array(500).keys()].slice(1).find((a) => CHAL_BY_ID[dailyIds(a, spDay())[0]].ev === 'k' && !CHAL_BY_ID[dailyIds(a, spDay())[0]].mo);
function fakeEnv() {
  const env = { writes: [] }; const stmt = (sql) => ({ sql, args: [], bind(...a) { this.args = a; return this; }, async all() { return { results: [{ id: acct, chal: null }] }; } });
  env.DB = { prepare: stmt, async batch(list) { env.writes.push(...list); return []; } }; return env;
}
for (const [mode, want] of [['arms', true], ['x1', true], ['dm', true], ['treino', false]]) {
  const env = fakeEnv(); await recordStats(env, [{ acct, mode, k: 3, d: 0, c: 0, w: 0, m: 0, q: { k: 3 } }]);
  const w = env.writes.find((s) => /chal =/.test(s.sql));
  ok(!!w === want, `${mode}: desafio "k" ${want ? 'conta' : 'não conta'}` + (w ? ` (${w.args[6]})` : ''));
}
console.log(fail ? 'FALHOU' : 'TUDO OK'); process.exit(fail ? 1 : 0);

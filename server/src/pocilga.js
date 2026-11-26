// Ranking da Pocilga no D1. A conta do tempo é shared/pocilga.js; aqui só grava o que já passou.
import { rankedRun, formatPit } from '../../shared/pocilga.js';
import { bonusLine } from '../../shared/pocilga-bonus.js';

const now = () => Math.floor(Date.now() / 1000);
const ms = (sec) => Math.round(sec * 1000);
const sec = (n) => Math.round(n) / 1000;

export function publicRun(run) {
  return {
    ok: !!run.finished, ranked: !!run.ranked, reason: run.reason,
    raw: run.raw, penalty: run.penalty, final: run.final, civs: run.civs, stars: run.stars,
    missed: run.missed, suggestion: run.suggestion, clock: run.final != null ? formatPit(run.final) : null,
    bonus: run.bonus || 0, alvo: bonusLine(run.bonusZone),
  };
}

async function rowsOf(env, limit) {
  const { results } = await env.DB.prepare(
    `SELECT a.nick AS nick, t.best_ms AS best_ms, t.stars AS stars, t.civs AS civs, t.runs AS runs
     FROM pocilga_times t JOIN accounts a ON a.id = t.account_id
     ORDER BY t.best_ms ASC, a.nick ASC LIMIT ?1`,
  ).bind(limit).all();
  return (results || []).map((r, i) => ({
    place: i + 1, nick: r.nick, best: sec(r.best_ms), stars: r.stars | 0, civs: r.civs | 0, runs: r.runs | 0,
    clock: formatPit(sec(r.best_ms)),
  }));
}

export async function pitRank(env, accountId, limit) {
  const rows = await rowsOf(env, limit);
  let me = null;
  if (accountId) {
    const row = await env.DB.prepare(
      `SELECT a.nick AS nick, t.best_ms AS best_ms, t.stars AS stars, t.civs AS civs, t.runs AS runs,
              (SELECT COUNT(*) FROM pocilga_times o WHERE o.best_ms < t.best_ms) AS ahead
       FROM pocilga_times t JOIN accounts a ON a.id = t.account_id WHERE t.account_id = ?1`,
    ).bind(accountId).first();
    if (row) me = { nick: row.nick, best: sec(row.best_ms), stars: row.stars | 0, civs: row.civs | 0, runs: row.runs | 0, place: (row.ahead | 0) + 1, clock: formatPit(sec(row.best_ms)) };
  }
  return { rows, me };
}

// Devolve { status, body }. best_ms só troca quando o novo final é menor.
export async function pitSave(env, accountId, events) {
  const run = rankedRun(events);
  if (!run.ranked) return { status: 422, body: { ok: false, saved: false, run: publicRun(run) } };
  const t = now();
  const best = ms(run.final), raw = ms(run.raw), pen = ms(run.penalty);
  await env.DB.prepare(
    `INSERT INTO pocilga_times (account_id, best_ms, raw_ms, penalty_ms, civs, stars, runs, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)
     ON CONFLICT(account_id) DO UPDATE SET
       runs = runs + 1,
       updated_at = ?7,
       best_ms = CASE WHEN excluded.best_ms < pocilga_times.best_ms THEN excluded.best_ms ELSE pocilga_times.best_ms END,
       raw_ms = CASE WHEN excluded.best_ms < pocilga_times.best_ms THEN excluded.raw_ms ELSE pocilga_times.raw_ms END,
       penalty_ms = CASE WHEN excluded.best_ms < pocilga_times.best_ms THEN excluded.penalty_ms ELSE pocilga_times.penalty_ms END,
       civs = CASE WHEN excluded.best_ms < pocilga_times.best_ms THEN excluded.civs ELSE pocilga_times.civs END,
       stars = CASE WHEN excluded.best_ms < pocilga_times.best_ms THEN excluded.stars ELSE pocilga_times.stars END`,
  ).bind(accountId, best, raw, pen, run.civs, run.stars, t).run();
  const board = await pitRank(env, accountId, 10);
  const saved = !!(board.me && board.me.best <= run.final + 1e-6);
  return { status: 200, body: { ok: true, saved, run: publicRun(run), ...board } };
}

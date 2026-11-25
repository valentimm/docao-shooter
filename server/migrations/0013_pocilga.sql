-- A Pocilga: melhor tempo por conta. O Worker só grava corrida que passou em shared/pocilga.js.
-- Aplicar no D1 antes do deploy do Worker que lê esta tabela.
CREATE TABLE IF NOT EXISTS pocilga_times (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  best_ms INTEGER NOT NULL,
  raw_ms INTEGER NOT NULL,
  penalty_ms INTEGER NOT NULL,
  civs INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  runs INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pocilga_best ON pocilga_times(best_ms);

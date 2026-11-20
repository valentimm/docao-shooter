-- Elo do Competitivo: rating por conta, partidas e pico.
-- NÃO aplicar em produção sem aval.
CREATE TABLE IF NOT EXISTS comp_elo (
  account_id INTEGER PRIMARY KEY,
  rating INTEGER NOT NULL DEFAULT 1000,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  peak INTEGER NOT NULL DEFAULT 1000,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_comp_elo_rating ON comp_elo(rating DESC);

-- Elo por modalidade (Corrida Armada, Duelo/Gunfight, X1, Competitivo).
-- O que já existia em comp_elo vira o Elo do Competitivo.
-- NÃO aplicar em produção sem aval.
CREATE TABLE IF NOT EXISTS mode_elo (
  account_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  peak INTEGER NOT NULL DEFAULT 1000,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, mode),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_mode_elo_rating ON mode_elo(mode, rating DESC);
INSERT OR IGNORE INTO mode_elo (account_id, mode, rating, games, wins, peak, updated_at)
SELECT account_id, 'comp', rating, games, wins, peak, updated_at FROM comp_elo;

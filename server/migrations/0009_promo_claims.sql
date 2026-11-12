-- Churrasco Relâmpago: +1000 Docoins, uma vez por conta (chave account_id + promo_id).
-- NÃO aplicar em produção sem aval. Aplicar no D1 ANTES do deploy do Worker novo.
-- Sem esta tabela, o Worker não credita (e o /api/me continua funcionando).
CREATE TABLE IF NOT EXISTS promo_claims (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  promo_id TEXT NOT NULL,
  coins INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, promo_id)
);

-- Mochila com quantidade: skin repetida do caixote/roleta soma qty em vez de virar Docoin.
-- NÃO aplicar em produção sem aval.
ALTER TABLE inventory ADD COLUMN qty INTEGER NOT NULL DEFAULT 1;

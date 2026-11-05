-- Compra de 1 caixote por dia de Brasília. NÃO aplicar em produção sem aval.
-- box_buy_day = dia em que a compra já foi feita. Não é o box_day do caixote grátis.
ALTER TABLE accounts ADD COLUMN box_buy_day INTEGER NOT NULL DEFAULT 0;

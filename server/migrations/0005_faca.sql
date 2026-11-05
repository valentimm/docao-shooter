-- Faca equipada na conta (id do catálogo, ex. k1). Só o servidor grava, e só se a faca está na mochila.
ALTER TABLE accounts ADD COLUMN knife TEXT;

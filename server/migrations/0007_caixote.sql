-- Caixote da Primeira Safra. NÃO aplicar em produção sem aval.
-- boxes = caixotes fechados. box_day = dia de Brasília em que o caixote de login já foi entregue.
-- guns = skins equipadas de pistola, P90, carabina e fuzil ({"pistol":"a4",...}). A Torresmo continua em sniper; a faca, em knife.
ALTER TABLE accounts ADD COLUMN boxes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN box_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN guns TEXT;

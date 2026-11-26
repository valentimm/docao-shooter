-- Configuração das promoções: ligar/desligar e janela no banco, sem novo deploy.
-- Datas em ISO 8601 com fuso de Brasília (offset -03:00), fáceis de editar no console do D1.
-- Exemplo: 2026-11-25T00:00:00.000-03:00  →  25/11/2026 00:00 em Brasília.
-- A promo só vale com enabled=1 e o relógio entre starts_at e expires_at.
-- A linha 'integra' nasce desligada (enabled=0). Matheus ajusta o início e liga quando quiser.
-- Sem esta tabela, o Worker cai nos valores padrão de shared/promo.js, mas desligado (não credita).
CREATE TABLE IF NOT EXISTS promo_config (
  promo_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

INSERT OR IGNORE INTO promo_config (promo_id, enabled, starts_at, expires_at)
VALUES (
  'integra',
  0,
  '2026-11-25T00:00:00.000-03:00',
  '2026-11-29T23:59:59.999-03:00'
);

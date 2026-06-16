-- =============================================================
-- RDY DOC CONTROL — seed.sql
-- Dados iniciais para novo projeto Supabase
-- Execute APÓS 001_schema.sql e 002_rls.sql
-- IMPORTANTE: troque a senha do CTO antes de usar em produção
-- =============================================================

INSERT INTO balanceamento_usuarios (username, password, label, role, cidade)
VALUES
  ('cto', 'TROQUE_ESTA_SENHA', 'Administrador CTO', 'cto', NULL)
ON CONFLICT (username) DO NOTHING;

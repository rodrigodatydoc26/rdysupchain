-- =============================================================
-- RDY DOC CONTROL — 002_rls.sql
-- Row Level Security para a chave anon (usada pelo front-end)
-- =============================================================

ALTER TABLE clientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE balanceamento_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico         ENABLE ROW LEVEL SECURITY;
ALTER TABLE balanceamento_usuarios ENABLE ROW LEVEL SECURITY;

-- Operacionais: anon pode SELECT, INSERT, UPDATE, DELETE
-- (acesso controlado pelo portal via autenticação própria)
CREATE POLICY "anon_all" ON clientes
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all" ON equipamentos
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all" ON balanceamento_entregas
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_all" ON ordens_servico
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Usuários: anon pode tudo (portal admin gerencia via sessão própria)
CREATE POLICY "anon_all" ON balanceamento_usuarios
  FOR ALL TO anon USING (true) WITH CHECK (true);

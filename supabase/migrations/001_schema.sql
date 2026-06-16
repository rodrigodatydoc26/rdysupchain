-- =============================================================
-- RDY DOC CONTROL — 001_schema.sql
-- Cria todas as tabelas e a view de relatório
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── clientes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  cidade     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clientes_nome   ON clientes (nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cidade ON clientes (cidade);

-- ── equipamentos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipamentos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id           UUID REFERENCES clientes(id) ON DELETE SET NULL,
  serie                TEXT NOT NULL UNIQUE,
  patrimonio           TEXT,
  modelo               TEXT,
  secretaria           TEXT,
  media_referencia     NUMERIC DEFAULT 0,
  ultimo_contador      BIGINT,
  data_ultimo_contador TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipamentos_cliente ON equipamentos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_serie   ON equipamentos (serie);

-- ── balanceamento_entregas ───────────────────────────────────
CREATE TABLE IF NOT EXISTS balanceamento_entregas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id       UUID REFERENCES equipamentos(id) ON DELETE CASCADE,
  cliente_id           UUID REFERENCES clientes(id)    ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'confirmado',
  quantidade_definida  NUMERIC,
  media_consumo_mensal NUMERIC,
  opcao_entrega        NUMERIC,
  contador_atual       BIGINT,
  numero_os            TEXT,
  observacao           TEXT,
  criado_por           TEXT DEFAULT 'Portal',
  data_registro        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entregas_equipamento ON balanceamento_entregas (equipamento_id);
CREATE INDEX IF NOT EXISTS idx_entregas_status      ON balanceamento_entregas (status);
CREATE INDEX IF NOT EXISTS idx_entregas_data        ON balanceamento_entregas (data_registro DESC);
CREATE INDEX IF NOT EXISTS idx_entregas_cliente     ON balanceamento_entregas (cliente_id);

-- ── ordens_servico ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordens_servico (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID REFERENCES equipamentos(id) ON DELETE CASCADE,
  cliente_id     UUID REFERENCES clientes(id)    ON DELETE SET NULL,
  numero_os      TEXT,
  contador_atual BIGINT,
  data_os        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_os_equipamento ON ordens_servico (equipamento_id);
CREATE INDEX IF NOT EXISTS idx_os_data        ON ordens_servico (data_os DESC);

-- ── balanceamento_usuarios ───────────────────────────────────
CREATE TABLE IF NOT EXISTS balanceamento_usuarios (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  label    TEXT NOT NULL,
  role     TEXT NOT NULL CHECK (role IN ('cto', 'gestor', 'tecnico')),
  cidade   TEXT
);

-- ── VIEW: ranking de equipamentos ────────────────────────────
CREATE OR REPLACE VIEW view_top_equipamentos AS
SELECT
  e.id,
  e.serie,
  e.secretaria,
  c.nome                                     AS cliente_nome,
  c.cidade,
  COUNT(be.id)                               AS total_chamados,
  COALESCE(SUM(be.quantidade_definida), 0)   AS total_resmas,
  COALESCE(AVG(be.media_consumo_mensal), 0)  AS media_media
FROM equipamentos e
LEFT JOIN clientes               c  ON c.id  = e.cliente_id
LEFT JOIN balanceamento_entregas be ON be.equipamento_id = e.id
                                   AND be.status = 'confirmado'
GROUP BY e.id, e.serie, e.secretaria, c.nome, c.cidade
ORDER BY total_chamados DESC;

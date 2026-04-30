-- Tabela de clientes (caso não exista)
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cidade TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de equipamentos (caso não exista)
CREATE TABLE IF NOT EXISTS equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  serie TEXT,
  patrimonio TEXT,
  modelo TEXT,
  secretaria TEXT, -- ADM, SAUDE, EDUCAÇÃO, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de entregas_papel (caso não exista)
CREATE TABLE IF NOT EXISTS entregas_papel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID REFERENCES equipamentos(id),
  cliente_id UUID REFERENCES clientes(id),
  numero_os TEXT,
  quantidade NUMERIC(10,2) NOT NULL,
  data_entrega TIMESTAMP DEFAULT NOW(),
  origem TEXT,
  balanceamento_id UUID, -- será referenciado mais tarde se necessário
  created_at TIMESTAMP DEFAULT NOW()
);


-- Tabela de balanceamento_entregas
CREATE TABLE IF NOT EXISTS balanceamento_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID REFERENCES equipamentos(id),
  cliente_id UUID REFERENCES clientes(id),
  numero_os TEXT NOT NULL,
  data_registro TIMESTAMP DEFAULT NOW(),
  media_consumo_mensal NUMERIC(10,2),       -- calculada automaticamente
  opcao_entrega INTEGER CHECK (opcao_entrega IN (0, 1, 2, 3)), -- 0=manual, 1, 2 ou 3 visitas/mês
  quantidade_sugerida NUMERIC(10,2),         -- calculada pelo sistema
  quantidade_definida NUMERIC(10,2),         -- pode ser editada pelo analista
  status TEXT DEFAULT 'pendente',            -- pendente | confirmado | entregue
  contador_atual NUMERIC,
  observacao TEXT,
  criado_por TEXT,                           -- nome ou ID do analista
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- MIGRAÇÃO: Estrutura Sub-Clientes
-- Execute BLOCO POR BLOCO no Supabase Dashboard → SQL Editor
-- ================================================================

-- ── BLOCO 1: Criar tabela sub_clientes
CREATE TABLE IF NOT EXISTS public.sub_clientes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id  UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sub_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_sub_clientes" ON public.sub_clientes
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_sub_clientes" ON public.sub_clientes
  FOR INSERT TO anon WITH CHECK (nome IS NOT NULL AND nome != '');

CREATE POLICY "anon_update_sub_clientes" ON public.sub_clientes
  FOR UPDATE TO anon USING (true);

CREATE POLICY "anon_delete_sub_clientes" ON public.sub_clientes
  FOR DELETE TO anon USING (true);


-- ── BLOCO 2: Migrar sub_nome existente de clientes → sub_clientes
-- Cria um sub-cliente para cada cliente que já tinha sub_nome preenchido
INSERT INTO public.sub_clientes (cliente_id, nome)
SELECT id, sub_nome
FROM public.clientes
WHERE sub_nome IS NOT NULL AND trim(sub_nome) != ''
ON CONFLICT DO NOTHING;


-- ── BLOCO 3: Adicionar sub_cliente_id nos equipamentos
ALTER TABLE public.equipamentos
ADD COLUMN IF NOT EXISTS sub_cliente_id UUID REFERENCES public.sub_clientes(id);


-- ── BLOCO 4: Vincular equipamentos existentes ao sub-cliente migrado
-- Para cada equipamento, busca o sub-cliente que veio do sub_nome do seu cliente
UPDATE public.equipamentos e
SET sub_cliente_id = sc.id
FROM public.sub_clientes sc
WHERE sc.cliente_id = e.cliente_id
  AND e.sub_cliente_id IS NULL;


-- ── BLOCO 5 (VERIFICAÇÃO): Confirmar resultado
SELECT
  c.nome    AS cliente,
  c.cidade,
  COUNT(DISTINCT sc.id) AS qtd_sub_clientes,
  COUNT(DISTINCT e.id)  AS qtd_equipamentos,
  COUNT(DISTINCT CASE WHEN e.sub_cliente_id IS NULL THEN e.id END) AS equip_sem_sub
FROM public.clientes c
LEFT JOIN public.sub_clientes sc ON sc.cliente_id = c.id
LEFT JOIN public.equipamentos  e  ON e.cliente_id = c.id
GROUP BY c.id, c.nome, c.cidade
ORDER BY c.cidade, c.nome;
-- "equip_sem_sub" deve ser 0 para clientes que tinham sub_nome

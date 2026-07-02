-- ================================================================
-- SUPABASE SECURITY FIX — RDY DOC CONTROL
-- Execute no Supabase Dashboard → SQL Editor
-- Data: 2026-07-01
-- ================================================================
-- ORDEM: execute bloco por bloco e verifique cada um antes do próximo


-- ================================================================
-- BLOCO 1 (CRÍTICO) — core_users sem RLS
-- Qualquer pessoa com a anon key pode ler/gravar dados de usuários
-- ================================================================

ALTER TABLE public.core_users ENABLE ROW LEVEL SECURITY;

-- Bloqueia SELECT anônimo (nenhuma policy = nenhum acesso para anon)
-- service_role sempre bypassa RLS — operações internas do Supabase continuam

-- Se o sistema precisar que usuários autenticados vejam apenas si mesmos,
-- adicione a policy abaixo (substitua 'user_id' pelo nome da coluna de PK/FK):
-- CREATE POLICY "core_users: cada usuario ve apenas si mesmo"
--   ON public.core_users FOR SELECT
--   USING (auth.uid() = user_id);


-- ================================================================
-- BLOCO 2 (CRÍTICO) — audit_log sem RLS
-- Log de auditoria exposto publicamente — risco de vazamento
-- ================================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Somente service_role (backend) pode inserir — anon não acessa
-- Se o painel admin precisar ler logs, adicione:
-- CREATE POLICY "audit_log: somente autenticados leem"
--   ON public.audit_log FOR SELECT
--   USING (auth.role() = 'authenticated');


-- ================================================================
-- BLOCO 3 — Módulo Supply (sup_stock, sup_movements)
-- Tabelas de estoque sem proteção
-- ================================================================

ALTER TABLE public.sup_stock     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_movements ENABLE ROW LEVEL SECURITY;

-- Se o módulo de estoque usa a anon key, adicione policies específicas.
-- Se usa service_role: nenhuma policy necessária (service_role bypassa RLS).


-- ================================================================
-- BLOCO 4 — Módulo RMA (rma_tickets, rma_attachments, rma_status_history)
-- Tickets e anexos expostos
-- ================================================================

ALTER TABLE public.rma_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rma_attachments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rma_status_history ENABLE ROW LEVEL SECURITY;

-- Se o portal RMA usa anon key e precisa de acesso público, adicione:
-- CREATE POLICY "rma_tickets: leitura autenticada"
--   ON public.rma_tickets FOR SELECT
--   USING (auth.role() = 'authenticated');


-- ================================================================
-- BLOCO 5 — View com SECURITY DEFINER
-- view_top_equipamentos usa permissões do criador, bypassa RLS
-- ================================================================

-- PASSO 1: Veja a definição atual da view (execute isso PRIMEIRO)
SELECT pg_get_viewdef('public.view_top_equipamentos', true);

-- PASSO 2: Após confirmar a definição, execute o ALTER abaixo
-- (compatível com PostgreSQL 15+ — Supabase usa PG15+)
ALTER VIEW public.view_top_equipamentos SET (security_invoker = true);

-- Se o ALTER não funcionar (PG < 15), recrie manualmente:
-- DROP VIEW public.view_top_equipamentos;
-- CREATE VIEW public.view_top_equipamentos
--   WITH (security_invoker = true)
--   AS <cole aqui a definição retornada no PASSO 1>;


-- ================================================================
-- VERIFICAÇÃO FINAL
-- Execute após todos os blocos para confirmar que os alertas sumiram
-- ================================================================

SELECT
  c.relname       AS tabela,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'core_users','audit_log',
    'sup_stock','sup_movements',
    'rma_tickets','rma_attachments','rma_status_history'
  )
ORDER BY c.relname;
-- rls_enabled deve ser TRUE para todas as tabelas acima

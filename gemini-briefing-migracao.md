# Briefing — Migração de Banco de Dados Supabase (PostgreSQL)

## Contexto do projeto

Sistema web chamado **RDY DOC CONTROL** — controle de balanceamento de impressoras/copiadoras.
Banco de dados: **Supabase (PostgreSQL)**, acessado via PostgREST (API REST).

---

## Por que estamos fazendo essa migração

### Problema atual

A tabela `clientes` foi usada de forma flat (plana), misturando **cidade** e **local específico** no mesmo campo `nome`. Exemplo real dos dados atuais:

| id | nome | cidade |
|----|------|--------|
| 1 | INDAIATUBA - CIAEI | INDAIATUBA |
| 2 | INDAIATUBA - UBS NORTE | INDAIATUBA |
| 3 | INDAIATUBA - PREFEITURA | INDAIATUBA |
| 4 | LIMEIRA - HOSPITAL | LIMEIRA |

Isso gera problemas:
- O dropdown de "Cliente" no sistema mostra "INDAIATUBA - CIAEI", "INDAIATUBA - UBS NORTE" — confuso e redundante
- Não é possível filtrar por cidade de forma limpa
- A hierarquia real (cidade → local) não está modelada no banco

### Estrutura desejada

**CLIENTE** = a cidade (ex: INDAIATUBA, LIMEIRA)
**SUB-CLIENTE** = o local específico dentro da cidade (ex: CIAEI, UBS NORTE, PREFEITURA)

| clientes | sub_clientes |
|----------|-------------|
| INDAIATUBA | CIAEI |
| INDAIATUBA | UBS NORTE |
| INDAIATUBA | PREFEITURA |
| LIMEIRA | HOSPITAL |

No formulário do sistema: o usuário seleciona **INDAIATUBA** no dropdown de Cliente → o dropdown de Sub-Cliente carrega automaticamente **CIAEI**, **UBS NORTE**, **PREFEITURA** etc.

---

## Estrutura atual do banco (tabelas relevantes)

```sql
-- Tabela de clientes (já existente)
public.clientes (
  id       UUID PK,
  nome     TEXT,   -- atualmente contém "CIDADE - LOCAL"
  cidade   TEXT,   -- atualmente contém só "CIDADE"
  sub_nome TEXT    -- campo legado, pode ignorar
)

-- Tabela de equipamentos (já existente)
public.equipamentos (
  id              UUID PK,
  cliente_id      UUID FK → clientes.id,
  sub_cliente_id  UUID FK → sub_clientes.id,  -- pode ser NULL se migração não rodou ainda
  serie           TEXT,
  modelo          TEXT,
  secretaria      TEXT,
  patrimonio      TEXT,
  media_referencia NUMERIC
)

-- Tabela nova (criada pela migração)
public.sub_clientes (
  id         UUID PK,
  cliente_id UUID FK → clientes.id,
  nome       TEXT,
  created_at TIMESTAMPTZ
)
```

---

## O que o script SQL faz (passo a passo)

1. **Cria a tabela `sub_clientes`** com RLS habilitado e policies para a role `anon`
2. **Adiciona coluna `sub_cliente_id`** na tabela `equipamentos` (FK para `sub_clientes`)
3. **Cria um cliente por cidade** — insere `{ nome: "INDAIATUBA", cidade: "INDAIATUBA" }` para cada cidade distinta
4. **Cria sub-clientes** extraindo o sufixo após " - " do nome antigo: `"INDAIATUBA - CIAEI"` → sub-cliente `"CIAEI"` vinculado ao cliente `"INDAIATUBA"`
5. **Reatribui os equipamentos** para o novo `cliente_id` (cidade) e o novo `sub_cliente_id` (local)
6. **Apaga os clientes granulares antigos** (os que tinham formato "CIDADE - LOCAL") — só apaga os que não têm mais equipamentos vinculados
7. **Verificação final** — mostra cliente / sub-cliente / quantidade de equipamentos

---

## SQL completo para executar no Supabase SQL Editor

```sql
-- ═══════════════════════════════════════════════════════
-- PASSO 1: Criar tabela sub_clientes (se ainda não existe)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sub_clientes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sub_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_sub_clientes" ON public.sub_clientes;
DROP POLICY IF EXISTS "anon_insert_sub_clientes" ON public.sub_clientes;
DROP POLICY IF EXISTS "anon_update_sub_clientes" ON public.sub_clientes;
DROP POLICY IF EXISTS "anon_delete_sub_clientes" ON public.sub_clientes;
CREATE POLICY "anon_select_sub_clientes" ON public.sub_clientes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_sub_clientes" ON public.sub_clientes FOR INSERT TO anon WITH CHECK (nome IS NOT NULL AND nome != '');
CREATE POLICY "anon_update_sub_clientes" ON public.sub_clientes FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_sub_clientes" ON public.sub_clientes FOR DELETE TO anon USING (true);

-- ═══════════════════════════════════════════════════════
-- PASSO 2: Adicionar coluna sub_cliente_id nos equipamentos
-- ═══════════════════════════════════════════════════════
ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS sub_cliente_id UUID REFERENCES public.sub_clientes(id);

-- ═══════════════════════════════════════════════════════
-- PASSO 3: Criar UM cliente por cidade (ex: "INDAIATUBA")
-- ═══════════════════════════════════════════════════════
INSERT INTO public.clientes (nome, cidade)
SELECT DISTINCT cidade, cidade
FROM public.clientes
WHERE cidade IS NOT NULL AND cidade != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.clientes x
    WHERE x.nome = public.clientes.cidade
      AND x.cidade = public.clientes.cidade
  );

-- ═══════════════════════════════════════════════════════
-- PASSO 4: Criar sub_clientes a partir dos nomes antigos
-- "INDAIATUBA - CIAEI" → sub_cliente "CIAEI" do cliente "INDAIATUBA"
-- ═══════════════════════════════════════════════════════
INSERT INTO public.sub_clientes (cliente_id, nome)
SELECT DISTINCT
  agg.id,
  TRIM(
    CASE
      WHEN velho.nome LIKE velho.cidade || ' - %'
        THEN SUBSTRING(velho.nome FROM LENGTH(velho.cidade) + 4)
      ELSE velho.nome
    END
  )
FROM public.clientes velho
JOIN public.clientes agg ON agg.nome = velho.cidade AND agg.cidade = velho.cidade
WHERE velho.nome != velho.cidade
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- PASSO 5: Reatribuir equipamentos para novo cliente + sub-cliente
-- ═══════════════════════════════════════════════════════
UPDATE public.equipamentos e
SET
  cliente_id     = agg.id,
  sub_cliente_id = sc.id
FROM public.clientes velho
JOIN public.clientes agg ON agg.nome = velho.cidade AND agg.cidade = velho.cidade
JOIN public.sub_clientes sc
  ON sc.cliente_id = agg.id
  AND sc.nome = TRIM(
    CASE
      WHEN velho.nome LIKE velho.cidade || ' - %'
        THEN SUBSTRING(velho.nome FROM LENGTH(velho.cidade) + 4)
      ELSE velho.nome
    END
  )
WHERE e.cliente_id = velho.id
  AND velho.nome != velho.cidade;

-- ═══════════════════════════════════════════════════════
-- PASSO 6: Apagar clientes granulares antigos
-- (só apaga se não tiver mais equipamentos vinculados)
-- ═══════════════════════════════════════════════════════
DELETE FROM public.clientes
WHERE nome != cidade
  AND NOT EXISTS (
    SELECT 1 FROM public.equipamentos e WHERE e.cliente_id = public.clientes.id
  );

-- ═══════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════
SELECT
  c.nome      AS cliente,
  sc.nome     AS sub_cliente,
  COUNT(e.id) AS equipamentos
FROM public.clientes c
JOIN public.sub_clientes sc ON sc.cliente_id = c.id
LEFT JOIN public.equipamentos e ON e.sub_cliente_id = sc.id
GROUP BY c.nome, sc.nome
ORDER BY c.nome, sc.nome;
```

---

## O que esperar no resultado da verificação final

```
cliente      | sub_cliente       | equipamentos
-------------|-------------------|-------------
INDAIATUBA   | CIAEI             | 12
INDAIATUBA   | PREFEITURA        | 5
INDAIATUBA   | UBS NORTE         | 3
LIMEIRA      | HOSPITAL          | 8
...
```

Cada linha = um sub-cliente com seus equipamentos. A coluna `cliente` deve mostrar **só a cidade**, sem " - " no nome.

---

## Observações importantes

- O script é **idempotente**: pode rodar mais de uma vez sem duplicar dados (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `ADD COLUMN IF NOT EXISTS`)
- O PASSO 6 **não apaga nada que ainda tenha equipamentos** — seguro
- Após rodar, o sistema carrega o formulário com `Cliente = INDAIATUBA` e sub-clientes sem o prefixo da cidade
- A role usada é `anon` (chave pública do Supabase) — as policies RLS garantem acesso correto

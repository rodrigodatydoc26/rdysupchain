-- ================================================================
-- CORREÇÃO DE HIERARQUIA — executa TUDO de uma vez no SQL Editor
-- Estado atual: sub_clientes existem mas apontam para clientes
-- granulares ("INDAIATUBA - X") em vez da cidade ("INDAIATUBA")
-- ================================================================


-- PASSO 1: Criar clientes agregadores — um por cidade
-- Ex: { nome: "INDAIATUBA", cidade: "INDAIATUBA" }
INSERT INTO public.clientes (nome, cidade)
SELECT DISTINCT cidade, cidade
FROM public.clientes
WHERE cidade IS NOT NULL
  AND cidade != ''
  AND nome != cidade
  AND NOT EXISTS (
    SELECT 1 FROM public.clientes x
    WHERE x.nome = public.clientes.cidade
      AND x.cidade = public.clientes.cidade
  );


-- PASSO 2: Re-parenta sub_clientes dos clientes granulares
-- para o cliente agregador da mesma cidade
UPDATE public.sub_clientes sc
SET cliente_id = agg.id
FROM public.clientes velho
JOIN public.clientes agg
  ON agg.nome = velho.cidade
 AND agg.cidade = velho.cidade
WHERE sc.cliente_id = velho.id
  AND velho.nome != velho.cidade;


-- PASSO 3a: Redireciona equipamentos que apontam para sub_clientes
-- duplicados (mesmo nome sob o mesmo cliente agregador)
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY cliente_id, LOWER(TRIM(nome))
      ORDER BY created_at ASC NULLS LAST
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY cliente_id, LOWER(TRIM(nome))
      ORDER BY created_at ASC NULLS LAST
    ) AS rn
  FROM public.sub_clientes
)
UPDATE public.equipamentos e
SET sub_cliente_id = r.keep_id
FROM ranked r
WHERE e.sub_cliente_id = r.id
  AND r.rn > 1;


-- PASSO 3b: Remove sub_clientes duplicados (mantém o mais antigo)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY cliente_id, LOWER(TRIM(nome))
      ORDER BY created_at ASC NULLS LAST
    ) AS rn
  FROM public.sub_clientes
)
DELETE FROM public.sub_clientes
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);


-- PASSO 4: Atualiza equipamentos para apontar ao cliente agregador
UPDATE public.equipamentos e
SET cliente_id = agg.id
FROM public.clientes velho
JOIN public.clientes agg
  ON agg.nome = velho.cidade
 AND agg.cidade = velho.cidade
WHERE e.cliente_id = velho.id
  AND velho.nome != velho.cidade;


-- PASSO 5: Apaga clientes granulares (agora sem dependências FK)
DELETE FROM public.clientes
WHERE nome != cidade;


-- ================================================================
-- VERIFICAÇÃO FINAL — resultado esperado:
-- cliente = só cidade | sub_cliente = só o local | equipamentos = count
-- ================================================================
SELECT
  c.nome      AS cliente,
  sc.nome     AS sub_cliente,
  COUNT(e.id) AS equipamentos
FROM public.clientes c
JOIN public.sub_clientes sc ON sc.cliente_id = c.id
LEFT JOIN public.equipamentos e ON e.sub_cliente_id = sc.id
GROUP BY c.nome, sc.nome
ORDER BY c.nome, sc.nome;

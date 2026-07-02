-- ================================================================
-- CONSOLIDAÇÃO DE HIERARQUIA — CLIENTE / SUB-CLIENTE
-- Lógica: CIDADE = Cliente único | tudo após "CIDADE - " = Sub-cliente
-- Exemplo: "INDAIATUBA - CIAEI - ADM" → cliente=INDAIATUBA, sub=CIAEI - ADM
--
-- Execute BLOCO POR BLOCO — sempre leia o resultado antes do próximo
-- ================================================================


-- ── BLOCO 1 (PREVIEW — sem alterações): Ver como vai ficar
SELECT
  c.cidade AS novo_cliente,
  TRIM(
    CASE
      WHEN c.nome LIKE c.cidade || ' - %'
        THEN SUBSTRING(c.nome FROM LENGTH(c.cidade) + 4)
      ELSE c.nome
    END
  ) AS novo_sub_cliente,
  COUNT(DISTINCT e.id) AS qtd_equipamentos
FROM public.clientes c
LEFT JOIN public.equipamentos e ON e.cliente_id = c.id
GROUP BY
  c.cidade,
  TRIM(CASE
    WHEN c.nome LIKE c.cidade || ' - %'
      THEN SUBSTRING(c.nome FROM LENGTH(c.cidade) + 4)
    ELSE c.nome
  END)
ORDER BY c.cidade, novo_sub_cliente;


-- ── BLOCO 2: Criar um cliente por cidade (o cliente agregador)
-- Ex: insere um registro { nome="INDAIATUBA", cidade="INDAIATUBA" }

INSERT INTO public.clientes (nome, cidade)
SELECT DISTINCT c.cidade, c.cidade
FROM public.clientes c
WHERE c.cidade IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.clientes x
    WHERE x.nome = c.cidade AND x.cidade = c.cidade
  );

-- Verificar:
SELECT id, nome, cidade FROM public.clientes WHERE nome = cidade ORDER BY nome;


-- ── BLOCO 3: Criar sub-clientes a partir dos clientes granulares
-- Para "INDAIATUBA - CIAEI - ADM", cria sub-cliente "CIAEI - ADM" ligado ao cliente "INDAIATUBA"

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

-- Verificar (primeiros 50):
SELECT sc.nome AS sub_cliente, c.nome AS cliente, c.cidade
FROM public.sub_clientes sc
JOIN public.clientes c ON c.id = sc.cliente_id
ORDER BY c.cidade, sc.nome
LIMIT 50;


-- ── BLOCO 4: Reatribuir equipamentos para novo cliente + novo sub-cliente
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

-- Verificar:
SELECT
  COUNT(*)                          AS total_equipamentos,
  COUNT(sub_cliente_id)             AS com_sub_cliente,
  COUNT(*) - COUNT(sub_cliente_id)  AS sem_sub_cliente
FROM public.equipamentos;


-- ── BLOCO 5: Apagar os clientes granulares antigos (os que viraram sub-clientes)
-- Só apaga registros que não têm mais equipamentos vinculados

DELETE FROM public.clientes
WHERE nome != cidade
  AND NOT EXISTS (
    SELECT 1 FROM public.equipamentos e WHERE e.cliente_id = public.clientes.id
  );

-- Verificar clientes que sobraram (devem ser só os agregadores por cidade):
SELECT c.nome, c.cidade,
       COUNT(DISTINCT sc.id) AS sub_clientes,
       COUNT(DISTINCT e.id)  AS equipamentos
FROM public.clientes c
LEFT JOIN public.sub_clientes sc ON sc.cliente_id = c.id
LEFT JOIN public.equipamentos  e  ON e.cliente_id = c.id
GROUP BY c.id, c.nome, c.cidade
ORDER BY c.cidade;


-- ── BLOCO 6: Resultado final
SELECT
  c.nome      AS cliente,
  sc.nome     AS sub_cliente,
  COUNT(e.id) AS equipamentos
FROM public.clientes c
JOIN public.sub_clientes sc ON sc.cliente_id = c.id
LEFT JOIN public.equipamentos e ON e.sub_cliente_id = sc.id
GROUP BY c.id, c.nome, sc.id, sc.nome
ORDER BY c.nome, sc.nome
LIMIT 100;

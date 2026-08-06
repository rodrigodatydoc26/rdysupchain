# Briefing — Numerador único + Realtime (Supabase PostgreSQL)

## Contexto do projeto

Sistema web **RDY DOC CONTROL** — controle de balanceamento de impressoras/copiadoras.
Banco de dados: **Supabase (PostgreSQL)**, acessado via PostgREST (API REST).

---

## Por que estamos fazendo essa migração

### Problema atual

O "numerador atual" de um equipamento vive em dois lugares:

- `public.ctrl_os` — histórico de leituras (uma linha por leitura registrada: `equipment_id`, `counter_reading`, `os_date`, `created_at`). **Fonte da verdade**, usada para calcular média de consumo e para as regras de balanceamento/entrega. **Não pode ser alterada por essa migração.**
- `public.equipamentos.current_counter` — uma cópia do valor mais recente, hoje mantida **manualmente pelo código JavaScript** de cada tela (admin, portal do técnico). Cada tela precisa lembrar de, depois de inserir em `ctrl_os`, também fazer um `UPDATE`/`PATCH` em `equipamentos.current_counter`.

Isso já causou bugs reais:
1. Uma tela ("cadastro rápido" no admin) insere em `ctrl_os` mas nunca atualizava `current_counter` — ficava desatualizado.
2. Quando o mesmo equipamento recebe mais de uma correção no mesmo dia, o código que calculava "qual é a leitura mais recente" ordenava por `os_date` (granularidade de **dia**, sem horário) — com duas leituras no mesmo dia, o empate podia ser resolvido na ordem errada, mostrando o numerador antigo em vez do corrigido.

### Estrutura desejada

- `equipamentos.current_counter` deixa de depender do JavaScript acertar dois escritas. Um **trigger no Postgres** passa a atualizar `current_counter` automaticamente toda vez que uma linha nova é inserida em `ctrl_os`, não importa qual tela fez o insert. Fica **garantido pelo banco**, não pelo aplicativo.
- `ctrl_os` continua exatamente como está — o trigger só faz `AFTER INSERT`, nunca altera/apaga linhas existentes. O histórico de leituras e os cálculos de balanceamento/entrega continuam 100% baseados nele, sem nenhuma mudança de comportamento.
- A tabela `equipamentos` passa a ter **Realtime habilitado**, para que o portal do técnico (e o admin) recebam a atualização do numerador via WebSocket assim que ela acontece — sem precisar de F5 ou esperar o sync offline periódico.

---

## Estrutura atual do banco (tabelas relevantes)

```sql
-- Histórico de leituras (já existente, NÃO alterar linhas existentes)
public.ctrl_os (
  id               UUID PK,
  equipment_id     UUID FK → equipamentos.id,
  os_number        TEXT,
  os_date          DATE,
  counter_reading  INTEGER,
  reams_delivered  INTEGER,
  created_at       TIMESTAMPTZ DEFAULT now()
)

-- Equipamentos (já existente)
public.equipamentos (
  id                          UUID PK,
  serie                       TEXT,
  current_counter             INTEGER,   -- cópia do valor mais recente (hoje mantida na mão)
  -- current_counter_updated_at ainda não existe — criado por esta migração
  ...
)
```

---

## O que o script SQL faz (passo a passo)

1. **Adiciona a coluna `current_counter_updated_at`** em `equipamentos` (timestamp de quando o numerador foi atualizado pela última vez).
2. **Cria a função `sync_current_counter()`** — copia `counter_reading` e `created_at` da linha recém-inserida em `ctrl_os` para `equipamentos.current_counter` / `current_counter_updated_at` do equipamento correspondente.
3. **Cria o trigger `trg_sync_current_counter`** em `ctrl_os`, disparando `AFTER INSERT FOR EACH ROW` — ou seja, roda automaticamente a cada leitura nova, sem exigir nenhuma mudança no código das telas.
4. **Habilita Realtime** na tabela `equipamentos` (`ALTER PUBLICATION supabase_realtime ADD TABLE`), necessário para o portal do técnico escutar mudanças via WebSocket.
5. **Verificação final** — confirma que a coluna, a função, o trigger e a publicação existem.

---

## SQL completo para executar no Supabase SQL Editor

```sql
-- ═══════════════════════════════════════════════════════
-- PASSO 1: Coluna de timestamp do numerador
-- ═══════════════════════════════════════════════════════
ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS current_counter_updated_at timestamptz;

-- ═══════════════════════════════════════════════════════
-- PASSO 2: Função que sincroniza o numerador
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_current_counter()
RETURNS trigger AS $$
BEGIN
  UPDATE public.equipamentos
     SET current_counter = NEW.counter_reading,
         current_counter_updated_at = COALESCE(NEW.created_at, now())
   WHERE id = NEW.equipment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════
-- PASSO 3: Trigger — dispara em toda inserção em ctrl_os
-- (não altera nem apaga nenhuma linha existente de ctrl_os)
-- ═══════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_sync_current_counter ON public.ctrl_os;
CREATE TRIGGER trg_sync_current_counter
AFTER INSERT ON public.ctrl_os
FOR EACH ROW
EXECUTE FUNCTION public.sync_current_counter();

-- ═══════════════════════════════════════════════════════
-- PASSO 4: Habilita Realtime na tabela equipamentos
-- ═══════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipamentos;

-- ═══════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='equipamentos'
      AND column_name='current_counter_updated_at')  AS coluna_criada,
  (SELECT count(*) FROM pg_trigger
    WHERE tgname = 'trg_sync_current_counter')         AS trigger_criado,
  (SELECT count(*) FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'equipamentos') AS realtime_habilitado;
```

---

## O que esperar no resultado da verificação final

```
coluna_criada | trigger_criado | realtime_habilitado
--------------|-----------------|---------------------
1             | 1               | 1
```

Os três valores devem ser `1`. Se `realtime_habilitado` vier `0`, é porque a publicação `supabase_realtime` pode já não incluir a tabela por outro motivo (nesse caso, habilitar manualmente em Database → Replication → marcar `equipamentos`).

Depois, um teste rápido: insira uma linha de teste em `ctrl_os` para qualquer `equipment_id` existente e confirme que `equipamentos.current_counter` daquele mesmo equipamento mudou sozinho, sem nenhum outro comando.

---

## Observações importantes

- O script é **idempotente**: pode rodar mais de uma vez sem erro (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`). Se o `ALTER PUBLICATION` der erro de "already member", pode ignorar — significa que já estava habilitado.
- **Não apaga, não altera e não recria nenhuma linha de `ctrl_os` ou de `equipamentos`** — só adiciona uma coluna nova e um trigger que passa a agir a partir de agora.
- As regras de cálculo de média/consumo e de entrega continuam iguais, baseadas em `ctrl_os` como sempre foram.
- Depois que este SQL rodar, o código do aplicativo (já sendo ajustado em paralelo) vai usar Realtime para refletir o numerador no portal do técnico sem precisar de F5.

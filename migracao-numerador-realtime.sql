-- Numerador único + Realtime
-- Roda no SQL Editor do Supabase (Dashboard > SQL Editor > New query > Run)
--
-- O que faz:
-- 1. Garante que equipamentos.current_counter é sempre atualizado automaticamente
--    toda vez que uma leitura nova entra em ctrl_os, não importa qual tela do
--    sistema fez o insert (admin, portal do tecnico, Sistema Original). Isso
--    elimina a necessidade de cada tela lembrar de sincronizar manualmente, e
--    corrige a raiz do bug de numerador desatualizado.
-- 2. ctrl_os NUNCA e alterado por isso -- so leitura (trigger dispara em
--    INSERT). O historico continua intacto como referencia dos calculos de
--    media/consumo e das regras de balanceamento/entrega.
-- 3. Habilita o Supabase Realtime na tabela equipamentos, para que o portal
--    do tecnico reflita mudancas em tempo real (sem F5, sem esperar o sync
--    offline de 15min).

ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS current_counter_updated_at timestamptz;

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

DROP TRIGGER IF EXISTS trg_sync_current_counter ON public.ctrl_os;
CREATE TRIGGER trg_sync_current_counter
AFTER INSERT ON public.ctrl_os
FOR EACH ROW
EXECUTE FUNCTION public.sync_current_counter();

ALTER PUBLICATION supabase_realtime ADD TABLE public.equipamentos;

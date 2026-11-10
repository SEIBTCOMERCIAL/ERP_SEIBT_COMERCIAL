-- Etapas de lead passam a ter um "tipo" que define o status do lead ao entrar na etapa.
-- Migration aditiva: não apaga dados. Rodar DEPOIS do arquivo 031.
ALTER TABLE public.etapas_lead
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'intermediaria';

DO $$ BEGIN
  ALTER TABLE public.etapas_lead
    ADD CONSTRAINT etapas_lead_tipo_check
    CHECK (tipo IN ('novo','encaminhado','em_qualificacao','qualificado','convertido','descartado','intermediaria'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.etapas_lead SET tipo = CASE lower(trim(nome))
  WHEN 'novo' THEN 'novo'
  WHEN 'encaminhado' THEN 'encaminhado'
  WHEN 'em qualificação' THEN 'em_qualificacao'
  WHEN 'qualificado' THEN 'qualificado'
  WHEN 'convertido' THEN 'convertido'
  WHEN 'descartado' THEN 'descartado'
  ELSE tipo END
WHERE tipo = 'intermediaria';

-- A conversão passa a localizar a etapa pelo tipo (e não mais pelo nome).
CREATE OR REPLACE FUNCTION public.registrar_historico_lead() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE evento jsonb;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status::text='convertido' AND OLD.status IS DISTINCT FROM NEW.status THEN
   SELECT id INTO NEW.etapa_id FROM public.etapas_lead WHERE tipo='convertido' ORDER BY ordem LIMIT 1;
 END IF;
 evento=jsonb_build_object('data',now(),'usuario',auth.uid(),'status',NEW.status,'observacoes',NEW.observacoes,'representante_id',NEW.representante_id,'proxima_acao',NEW.proxima_acao,'proxima_acao_em',NEW.proxima_acao_em,'motivo_descarte',NEW.motivo_descarte,'etapa_id',NEW.etapa_id);
 IF TG_OP='UPDATE' THEN NEW.historico=OLD.historico||jsonb_build_array(evento); ELSE NEW.historico=jsonb_build_array(evento); END IF;
 RETURN NEW;
END; $$;

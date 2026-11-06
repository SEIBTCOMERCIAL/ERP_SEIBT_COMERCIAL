CREATE TABLE public.etapas_lead (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nome text NOT NULL CHECK(length(trim(nome)) BETWEEN 1 AND 80),
 ordem integer NOT NULL DEFAULT 0,
 cor text NOT NULL DEFAULT '#2C4F79' CHECK(cor ~ '^#[0-9A-Fa-f]{6}$'),
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etapas_lead ENABLE ROW LEVEL SECURITY;
CREATE POLICY etapas_lead_leitura ON public.etapas_lead FOR SELECT TO authenticated USING(true);
CREATE POLICY etapas_lead_admin ON public.etapas_lead FOR ALL TO authenticated USING(public.get_my_perfil()='admin') WITH CHECK(public.get_my_perfil()='admin');
INSERT INTO public.etapas_lead(nome,ordem) VALUES ('Novo',0),('Encaminhado',1),('Em qualificação',2),('Qualificado',3),('Convertido',4),('Descartado',5);
ALTER TABLE public.leads ADD COLUMN etapa_id uuid REFERENCES public.etapas_lead(id) ON DELETE RESTRICT;
UPDATE public.leads l SET etapa_id=e.id FROM public.etapas_lead e WHERE e.nome=CASE l.status::text WHEN 'novo' THEN 'Novo' WHEN 'encaminhado' THEN 'Encaminhado' WHEN 'em_qualificacao' THEN 'Em qualificação' WHEN 'qualificado' THEN 'Qualificado' WHEN 'convertido' THEN 'Convertido' WHEN 'descartado' THEN 'Descartado' END;
-- Histórico existente permanece preservado; registrar também a coluna comercial.
CREATE OR REPLACE FUNCTION public.registrar_historico_lead() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE evento jsonb;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status::text='convertido' AND OLD.status IS DISTINCT FROM NEW.status THEN
   SELECT id INTO NEW.etapa_id FROM public.etapas_lead WHERE nome='Convertido' ORDER BY ordem LIMIT 1;
 END IF;
 evento=jsonb_build_object('data',now(),'usuario',auth.uid(),'status',NEW.status,'observacoes',NEW.observacoes,'representante_id',NEW.representante_id,'proxima_acao',NEW.proxima_acao,'proxima_acao_em',NEW.proxima_acao_em,'motivo_descarte',NEW.motivo_descarte,'etapa_id',NEW.etapa_id);
 IF TG_OP='UPDATE' THEN NEW.historico=OLD.historico||jsonb_build_array(evento); ELSE NEW.historico=jsonb_build_array(evento); END IF;
 RETURN NEW;
END; $$;

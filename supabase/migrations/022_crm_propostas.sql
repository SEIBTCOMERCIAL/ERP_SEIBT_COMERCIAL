-- CRM de propostas: mercado, alternativas complementares e alertas por tipo.
-- Migration aditiva: não remove nem altera propostas existentes.

DO $$ BEGIN
  CREATE TYPE public.mercado_proposta AS ENUM ('nacional', 'exportacao');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.papel_proposta AS ENUM ('principal', 'complementar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.status_proposta ADD VALUE IF NOT EXISTS 'cancelada';
ALTER TYPE public.status_proposta ADD VALUE IF NOT EXISTS 'complementar_nao_selecionada';

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS mercado public.mercado_proposta NOT NULL DEFAULT 'nacional',
  ADD COLUMN IF NOT EXISTS pais_destino text,
  ADD COLUMN IF NOT EXISTS papel public.papel_proposta NOT NULL DEFAULT 'principal',
  ADD COLUMN IF NOT EXISTS proposta_principal_id uuid REFERENCES public.propostas(id),
  ADD COLUMN IF NOT EXISTS motivo_encerramento_codigo text,
  ADD COLUMN IF NOT EXISTS motivo_encerramento_detalhes text,
  ADD COLUMN IF NOT EXISTS motivo_congelamento text,
  ADD COLUMN IF NOT EXISTS retomada_prevista date;

UPDATE public.propostas
SET mercado = 'exportacao'
WHERE tipo = 'exportacao' AND mercado = 'nacional';

DO $$ BEGIN
  ALTER TABLE public.propostas
    ADD CONSTRAINT propostas_complementar_principal_check
    CHECK (
      (papel = 'principal' AND proposta_principal_id IS NULL)
      OR
      (papel = 'complementar' AND proposta_principal_id IS NOT NULL AND proposta_principal_id <> id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Motivos padronizados de perda/desistência/cancelamento (lista confirmada em 07/10/2026).
DO $$ BEGIN
  ALTER TABLE public.propostas
    ADD CONSTRAINT propostas_motivo_encerramento_check
    CHECK (
      motivo_encerramento_codigo IS NULL
      OR motivo_encerramento_codigo IN ('preco', 'prazo', 'concorrente', 'cliente_desistiu', 'sem_retorno', 'projeto_cancelado', 'outro')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Integridade do negócio: a complementar aponta para uma principal do mesmo cliente,
-- sem encadear complementar de complementar; principal com alternativas não vira complementar
-- nem troca de cliente sozinha.
CREATE OR REPLACE FUNCTION public.validar_proposta_complementar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_principal record;
BEGIN
  IF NEW.papel = 'complementar' THEN
    SELECT id, cliente_id, papel, deleted_at
      INTO v_principal
      FROM public.propostas
     WHERE id = NEW.proposta_principal_id;

    IF NOT FOUND OR v_principal.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'A proposta principal não foi encontrada.';
    END IF;
    IF v_principal.papel <> 'principal' THEN
      RAISE EXCEPTION 'Uma complementar deve apontar para uma proposta principal, não para outra complementar.';
    END IF;
    IF v_principal.cliente_id IS DISTINCT FROM NEW.cliente_id THEN
      RAISE EXCEPTION 'A proposta complementar deve pertencer ao mesmo cliente da proposta principal.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM public.propostas c
     WHERE c.proposta_principal_id = NEW.id AND c.deleted_at IS NULL
  ) THEN
    IF NEW.papel = 'complementar' THEN
      RAISE EXCEPTION 'Esta proposta já tem alternativas complementares e não pode virar complementar.';
    END IF;
    IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
      RAISE EXCEPTION 'Esta proposta tem alternativas complementares; o cliente não pode ser trocado só nela.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_proposta_complementar ON public.propostas;
CREATE TRIGGER trg_validar_proposta_complementar
  BEFORE INSERT OR UPDATE OF papel, proposta_principal_id, cliente_id ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.validar_proposta_complementar();

CREATE INDEX IF NOT EXISTS idx_propostas_cliente_papel
  ON public.propostas(cliente_id, papel)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_propostas_principal
  ON public.propostas(proposta_principal_id)
  WHERE proposta_principal_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.configuracoes_inatividade_proposta (
  tipo public.tipo_proposta PRIMARY KEY,
  dias_alerta integer NOT NULL DEFAULT 7 CHECK (dias_alerta BETWEEN 1 AND 365),
  dias_escalonamento_admin integer NOT NULL DEFAULT 15 CHECK (dias_escalonamento_admin BETWEEN 1 AND 365),
  atualizado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inatividade_escalonamento_check CHECK (dias_escalonamento_admin >= dias_alerta)
);

INSERT INTO public.configuracoes_inatividade_proposta (tipo, dias_alerta, dias_escalonamento_admin)
VALUES
  ('maquina', 7, 15),
  ('sistema', 7, 15),
  ('pecas', 7, 15),
  ('servico', 7, 15),
  ('mista', 7, 15),
  ('exportacao', 7, 15)
ON CONFLICT (tipo) DO NOTHING;

ALTER TABLE public.configuracoes_inatividade_proposta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_inatividade_read" ON public.configuracoes_inatividade_proposta;
CREATE POLICY "config_inatividade_read"
  ON public.configuracoes_inatividade_proposta FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "config_inatividade_admin" ON public.configuracoes_inatividade_proposta;
CREATE POLICY "config_inatividade_admin"
  ON public.configuracoes_inatividade_proposta FOR ALL
  USING (public.get_my_perfil() = 'admin')
  WITH CHECK (public.get_my_perfil() = 'admin');

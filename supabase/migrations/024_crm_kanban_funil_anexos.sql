-- CRM de propostas, fase 2: funil configurável (Kanban), motivos padrão, anexos e histórico da negociação.
-- Migration aditiva: não apaga nem sobrescreve dados. Rodar DEPOIS do arquivo 022.

-- ─── 1. Etapas do funil: tipo e regra de próxima ação ───────────────────────────────
ALTER TABLE public.etapas_funil
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'intermediaria',
  ADD COLUMN IF NOT EXISTS exige_proxima_acao boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.etapas_funil
    ADD CONSTRAINT etapas_funil_tipo_check
    CHECK (tipo IN ('inicial', 'intermediaria', 'ganho', 'perda', 'congelamento'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Uma única etapa inicial ativa por funil.
CREATE UNIQUE INDEX IF NOT EXISTS uq_etapa_inicial_por_funil
  ON public.etapas_funil(funil_id) WHERE tipo = 'inicial' AND ativo;

-- ─── 2. Funil comercial padrão (só se ainda não existir nenhum) ─────────────────────
DO $$
DECLARE
  v_funil uuid;
  v_admin uuid;
BEGIN
  SELECT id INTO v_funil FROM public.funis WHERE usuario_id IS NULL ORDER BY criado_em LIMIT 1;

  IF v_funil IS NULL THEN
    SELECT id INTO v_admin FROM public.usuarios WHERE perfil = 'admin' ORDER BY id LIMIT 1;
    IF v_admin IS NULL THEN
      RETURN; -- sem administrador cadastrado: o funil pode ser criado depois em Configurações
    END IF;
    INSERT INTO public.funis (nome, usuario_id, criado_por)
    VALUES ('Funil Comercial', NULL, v_admin)
    RETURNING id INTO v_funil;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.etapas_funil WHERE funil_id = v_funil) THEN
    INSERT INTO public.etapas_funil (funil_id, nome, ordem, cor, ativo, tipo, exige_proxima_acao) VALUES
      (v_funil, 'Novo',             1, '#6B7B8D', true, 'inicial',       false),
      (v_funil, 'Em elaboração',    2, '#7C3AED', true, 'intermediaria', false),
      (v_funil, 'Proposta enviada', 3, '#2074B9', true, 'intermediaria', true),
      (v_funil, 'Em negociação',    4, '#D97706', true, 'intermediaria', true),
      (v_funil, 'Ganho',            5, '#16A34A', true, 'ganho',         false),
      (v_funil, 'Perdido',          6, '#DC2626', true, 'perda',         false),
      (v_funil, 'Congelado',        7, '#0891B2', true, 'congelamento',  false);
  END IF;

  -- Propostas antigas sem etapa recebem uma etapa válida (nunca ficam em "Sem etapa").
  UPDATE public.propostas p
  SET etapa_funil_id = COALESCE(
        (SELECT e.id FROM public.etapas_funil e
          WHERE e.funil_id = v_funil AND e.ativo
            AND e.nome = CASE p.status::text
              WHEN 'elaboracao' THEN 'Em elaboração'
              WHEN 'aguardando_precificacao' THEN 'Em elaboração'
              WHEN 'enviada' THEN 'Proposta enviada'
              WHEN 'em_negociacao' THEN 'Em negociação'
              WHEN 'vendida' THEN 'Ganho'
              WHEN 'perdida' THEN 'Perdido'
              WHEN 'desistencia' THEN 'Perdido'
              WHEN 'cancelada' THEN 'Perdido'
              WHEN 'stand_by' THEN 'Congelado'
              ELSE 'Novo' END
          LIMIT 1),
        (SELECT e.id FROM public.etapas_funil e
          WHERE e.funil_id = v_funil AND e.ativo
            AND e.tipo = CASE
              WHEN p.status::text = 'vendida' THEN 'ganho'
              WHEN p.status::text IN ('perdida', 'desistencia', 'cancelada') THEN 'perda'
              WHEN p.status::text = 'stand_by' THEN 'congelamento'
              ELSE 'inicial' END
          ORDER BY e.ordem LIMIT 1)
      )
  WHERE p.etapa_funil_id IS NULL
    AND p.deleted_at IS NULL
    AND p.status::text <> 'complementar_nao_selecionada';
END $$;

-- ─── 3. Motivos padrão (perda, congelamento, proposta complementar) ─────────────────
CREATE TABLE IF NOT EXISTS public.motivos_proposta (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria IN ('perda', 'congelamento', 'complementar')),
  codigo    text NOT NULL,
  nome      text NOT NULL,
  ordem     integer NOT NULL DEFAULT 0,
  ativo     boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (categoria, codigo)
);

INSERT INTO public.motivos_proposta (categoria, codigo, nome, ordem) VALUES
  ('perda', 'preco', 'Preço', 1),
  ('perda', 'prazo', 'Prazo de entrega', 2),
  ('perda', 'concorrente', 'Escolheu concorrente', 3),
  ('perda', 'cliente_desistiu', 'Cliente desistiu', 4),
  ('perda', 'sem_retorno', 'Sem retorno', 5),
  ('perda', 'projeto_cancelado', 'Projeto cancelado', 6),
  ('perda', 'outro', 'Outro', 7),
  ('congelamento', 'aguardando_decisao', 'Aguardando decisão do cliente', 1),
  ('congelamento', 'aguardando_financiamento', 'Aguardando financiamento', 2),
  ('congelamento', 'projeto_adiado', 'Projeto adiado pelo cliente', 3),
  ('congelamento', 'aguardando_definicao_tecnica', 'Aguardando definição técnica', 4),
  ('congelamento', 'outro', 'Outro', 5),
  ('complementar', 'outra_alternativa', 'Cliente escolheu outra alternativa da mesma negociação', 1),
  ('complementar', 'outro', 'Outro', 2)
ON CONFLICT (categoria, codigo) DO NOTHING;

ALTER TABLE public.motivos_proposta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motivos_proposta_read" ON public.motivos_proposta;
CREATE POLICY "motivos_proposta_read"
  ON public.motivos_proposta FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "motivos_proposta_admin" ON public.motivos_proposta;
CREATE POLICY "motivos_proposta_admin"
  ON public.motivos_proposta FOR ALL
  USING (public.get_my_perfil() = 'admin')
  WITH CHECK (public.get_my_perfil() = 'admin');

-- A lista de motivos passa a ser configurável: a trava fixa da migration 022 sai.
ALTER TABLE public.propostas DROP CONSTRAINT IF EXISTS propostas_motivo_encerramento_check;

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS motivo_congelamento_detalhes text;

-- ─── 4. Numeração: nunca duplicar o número de uma proposta ativa ────────────────────
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_propostas_numero_completo_ativas
    ON public.propostas(numero_completo) WHERE deleted_at IS NULL;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Já existem números repetidos entre propostas ativas; índice único não criado.';
END $$;

-- ─── 5. Anexos e documentos da proposta ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposta_anexos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id   uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  categoria     text NOT NULL DEFAULT 'outro'
                CHECK (categoria IN ('pedido_pdf', 'proposta_externa', 'demonstrativo', 'foto', 'desenho', 'documento_tecnico', 'planilha', 'outro')),
  nome          text NOT NULL,
  mime_type     text,
  tamanho_bytes bigint,
  storage_path  text NOT NULL UNIQUE,
  enviado_por   uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposta_anexos_proposta ON public.proposta_anexos(proposta_id, criado_em DESC);

ALTER TABLE public.proposta_anexos ENABLE ROW LEVEL SECURITY;

-- Quem enxerga a proposta enxerga os anexos dela (a regra de acesso da proposta vale aqui também).
DROP POLICY IF EXISTS "proposta_anexos_read" ON public.proposta_anexos;
CREATE POLICY "proposta_anexos_read"
  ON public.proposta_anexos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id));

DROP POLICY IF EXISTS "proposta_anexos_insert" ON public.proposta_anexos;
CREATE POLICY "proposta_anexos_insert"
  ON public.proposta_anexos FOR INSERT
  WITH CHECK (
    enviado_por = auth.uid()
    AND EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id)
  );

DROP POLICY IF EXISTS "proposta_anexos_delete" ON public.proposta_anexos;
CREATE POLICY "proposta_anexos_delete"
  ON public.proposta_anexos FOR DELETE
  USING (enviado_por = auth.uid() OR public.get_my_perfil() = 'admin');

-- Bucket privado: o acesso aos arquivos é sempre por link temporário gerado pelo sistema.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
SELECT 'proposta-anexos', 'proposta-anexos', false, 52428800
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'proposta-anexos');

-- ─── 6. Histórico da negociação ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposta_historico (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id  uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  tipo         text NOT NULL,
  descricao    text NOT NULL,
  detalhes     jsonb,
  usuario_id   uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_nome text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposta_historico_proposta ON public.proposta_historico(proposta_id, criado_em DESC);

ALTER TABLE public.proposta_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposta_historico_read" ON public.proposta_historico;
CREATE POLICY "proposta_historico_read"
  ON public.proposta_historico FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id));

DROP POLICY IF EXISTS "proposta_historico_insert" ON public.proposta_historico;
CREATE POLICY "proposta_historico_insert"
  ON public.proposta_historico FOR INSERT
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id)
  );

-- Registro automático: criação, status, etapa, valor, classificação, mercado, responsável e versão.
CREATE OR REPLACE FUNCTION public.registrar_historico_proposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_nome text;
  v_de   text;
  v_para text;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT nome INTO v_nome FROM public.usuarios WHERE id = v_uid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.proposta_historico (proposta_id, tipo, descricao, detalhes, usuario_id, usuario_nome)
    VALUES (NEW.id, 'criacao', 'Proposta criada',
            jsonb_build_object('numero', NEW.numero_completo, 'tipo', NEW.tipo::text, 'status', NEW.status::text),
            v_uid, v_nome);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.proposta_historico (proposta_id, tipo, descricao, detalhes, usuario_id, usuario_nome)
    VALUES (NEW.id, 'status', 'Status alterado',
            jsonb_build_object(
              'de', OLD.status::text, 'para', NEW.status::text,
              'motivo', COALESCE(NEW.motivo_encerramento_codigo, NEW.motivo_congelamento),
              'observacao', COALESCE(NEW.motivo_encerramento_detalhes, NEW.motivo_congelamento_detalhes),
              'retomada_prevista', NEW.retomada_prevista),
            v_uid, v_nome);
  END IF;

  IF NEW.etapa_funil_id IS DISTINCT FROM OLD.etapa_funil_id THEN
    SELECT nome INTO v_de FROM public.etapas_funil WHERE id = OLD.etapa_funil_id;
    SELECT nome INTO v_para FROM public.etapas_funil WHERE id = NEW.etapa_funil_id;
    INSERT INTO public.proposta_historico (proposta_id, tipo, descricao, detalhes, usuario_id, usuario_nome)
    VALUES (NEW.id, 'etapa', 'Etapa alterada',
            jsonb_build_object('de', v_de, 'para', v_para), v_uid, v_nome);
  END IF;

  IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
    INSERT INTO public.proposta_historico (proposta_id, tipo, descricao, detalhes, usuario_id, usuario_nome)
    VALUES (NEW.id, 'valor', 'Valor alterado',
            jsonb_build_object('de', OLD.valor_total, 'para', NEW.valor_total, 'moeda', NEW.moeda::text),
            v_uid, v_nome);
  END IF;

  IF NEW.papel IS DISTINCT FROM OLD.papel OR NEW.proposta_principal_id IS DISTINCT FROM OLD.proposta_principal_id THEN
    SELECT numero_completo INTO v_para FROM public.propostas WHERE id = NEW.proposta_principal_id;
    INSERT INTO public.proposta_historico (proposta_id, tipo, descricao, detalhes, usuario_id, usuario_nome)
    VALUES (NEW.id, 'classificacao', 'Classificação alterada',
            jsonb_build_object('de', OLD.papel::text, 'para', NEW.papel::text, 'principal', v_para),
            v_uid, v_nome);
  END IF;

  IF NEW.mercado IS DISTINCT FROM OLD.mercado OR NEW.pais_destino IS DISTINCT FROM OLD.pais_destino THEN
    INSERT INTO public.proposta_historico (proposta_id, tipo, descricao, detalhes, usuario_id, usuario_nome)
    VALUES (NEW.id, 'mercado', 'Mercado alterado',
            jsonb_build_object('de', OLD.mercado::text, 'para', NEW.mercado::text, 'pais', NEW.pais_destino),
            v_uid, v_nome);
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    SELECT nome INTO v_de FROM public.usuarios WHERE id = OLD.responsavel_id;
    SELECT nome INTO v_para FROM public.usuarios WHERE id = NEW.responsavel_id;
    INSERT INTO public.proposta_historico (proposta_id, tipo, descricao, detalhes, usuario_id, usuario_nome)
    VALUES (NEW.id, 'responsavel', 'Responsável alterado',
            jsonb_build_object('de', v_de, 'para', v_para), v_uid, v_nome);
  END IF;

  IF NEW.revisao IS DISTINCT FROM OLD.revisao THEN
    INSERT INTO public.proposta_historico (proposta_id, tipo, descricao, detalhes, usuario_id, usuario_nome)
    VALUES (NEW.id, 'versao', 'Nova versão da proposta',
            jsonb_build_object('de', OLD.revisao, 'para', NEW.revisao, 'numero', NEW.numero_completo),
            v_uid, v_nome);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historico_proposta ON public.propostas;
CREATE TRIGGER trg_historico_proposta
  AFTER INSERT OR UPDATE OF status, etapa_funil_id, valor_total, papel, proposta_principal_id,
                            mercado, pais_destino, responsavel_id, revisao
  ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_proposta();

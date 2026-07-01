-- Migration 006 — Máquinas catálogo + checklist técnico + requer_engenharia + fretes

-- requer_engenharia nos itens de proposta
ALTER TABLE public.itens_proposta
  ADD COLUMN IF NOT EXISTS requer_engenharia boolean NOT NULL DEFAULT false;

-- checklist técnico de aplicação (vinculado a uma proposta)
CREATE TABLE IF NOT EXISTS public.checklist_tecnico (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id         uuid        NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  segmento_aplicacao  text        NOT NULL,
  produto_final       text        NOT NULL,
  material            text        NOT NULL,
  dimensoes           text        NOT NULL,
  granulometria       text        NOT NULL,
  moagem_tipo         text        NOT NULL DEFAULT 'a_seco',
  forma_abastecimento text        NOT NULL DEFAULT 'esteira',
  producao_horaria_kgh numeric    NOT NULL,
  voltagem            text        NOT NULL,
  completo            boolean     NOT NULL DEFAULT false,
  preenchido_em       timestamptz,
  preenchido_por      uuid        REFERENCES public.usuarios(id)
);

ALTER TABLE public.checklist_tecnico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados leem checklist"
  ON public.checklist_tecnico FOR SELECT
  USING (get_my_perfil() IS NOT NULL);

CREATE POLICY "autenticados escrevem checklist"
  ON public.checklist_tecnico FOR ALL
  USING (get_my_perfil() IS NOT NULL);

-- ficha de frete
CREATE TABLE IF NOT EXISTS public.fretes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id         uuid        REFERENCES public.propostas(id) ON DELETE SET NULL,
  pedido_numero       text,
  descricao_produto   text        NOT NULL,
  peso_bruto_kg       numeric,
  volume_m3           numeric,
  dimensoes_l         numeric,
  dimensoes_a         numeric,
  dimensoes_p         numeric,
  tipo_frete          text        NOT NULL DEFAULT 'cif',
  cidade_origem       text,
  estado_origem       text,
  endereco_origem     text,
  cidade_destino      text,
  estado_destino      text,
  endereco_destino    text,
  transportadora      text,
  observacoes         text,
  pdf_folder_cliente_url       text,
  pdf_folder_transportadora_url text,
  criado_por          uuid        REFERENCES public.usuarios(id),
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados leem fretes"
  ON public.fretes FOR SELECT
  USING (get_my_perfil() IS NOT NULL);

CREATE POLICY "admin gerencia fretes"
  ON public.fretes FOR ALL
  USING (get_my_perfil() IN ('admin', 'vendedor_interno'));

-- metas por vendedor/mês
CREATE TABLE IF NOT EXISTS public.metas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid        REFERENCES public.usuarios(id) ON DELETE CASCADE,
  representante_id uuid       REFERENCES public.representantes(id) ON DELETE CASCADE,
  mes             int         NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano             int         NOT NULL,
  meta_total_brl  numeric     NOT NULL DEFAULT 0,
  meta_maquinas_brl numeric   DEFAULT 0,
  meta_pecas_brl  numeric     DEFAULT 0,
  realizado_brl   numeric     NOT NULL DEFAULT 0,
  realizado_maquinas_brl numeric DEFAULT 0,
  realizado_pecas_brl numeric   DEFAULT 0,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_unica UNIQUE (usuario_id, mes, ano)
);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados leem metas"
  ON public.metas FOR SELECT
  USING (get_my_perfil() IS NOT NULL);

CREATE POLICY "admin gerencia metas"
  ON public.metas FOR ALL
  USING (get_my_perfil() = 'admin');

-- ============================================================
-- SEED — Catálogo de Máquinas (categoria='maquina')
-- ============================================================

INSERT INTO public.produtos
  (codigo, descricao, categoria, ipi_pct, preco_brl, ncm, tem_variantes, ativo, linha, specs)
VALUES
  ('MGHS-600',  'Moinho de Facas MGHS 600',    'maquina', 0, 180000.00, '84779000', false, true, 'MGHS',
   '{"modelo":"MGHS 600","rotor_rpm":400,"potencia_cv":50,"capacidade_kgh":300,"camera":"600x400mm","furos_rotor":4,"peso_kg":1200,"tensao":"380V 60Hz"}'),
  ('MGHS-800',  'Moinho de Facas MGHS 800',    'maquina', 0, 280000.00, '84779000', false, true, 'MGHS',
   '{"modelo":"MGHS 800","rotor_rpm":360,"potencia_cv":75,"capacidade_kgh":600,"camera":"800x500mm","furos_rotor":4,"peso_kg":1800,"tensao":"380V 60Hz"}'),
  ('MGHS-1200', 'Moinho de Facas MGHS 1200',   'maquina', 0, 420000.00, '84779000', false, true, 'MGHS',
   '{"modelo":"MGHS 1200","rotor_rpm":300,"potencia_cv":125,"capacidade_kgh":1200,"camera":"1200x600mm","furos_rotor":6,"peso_kg":3200,"tensao":"380V 60Hz"}'),
  ('TPS-600',   'Picotador TPS 600',           'maquina', 0, 95000.00,  '84779000', false, true, 'TPS',
   '{"modelo":"TPS 600","rotor_rpm":600,"potencia_cv":20,"capacidade_kgh":200,"camera":"600x300mm","peso_kg":650,"tensao":"380V 60Hz"}'),
  ('TPS-800',   'Picotador TPS 800',           'maquina', 0, 135000.00, '84779000', false, true, 'TPS',
   '{"modelo":"TPS 800","rotor_rpm":550,"potencia_cv":30,"capacidade_kgh":400,"camera":"800x300mm","peso_kg":900,"tensao":"380V 60Hz"}'),
  ('TS-400',    'Triturador de Eixo TS 400',   'maquina', 0, 68000.00,  '84798990', false, true, 'TS',
   '{"modelo":"TS 400","eixos":1,"potencia_cv":15,"capacidade_kgh":150,"camera":"400x300mm","peso_kg":480,"tensao":"380V 60Hz"}'),
  ('TS-600',    'Triturador de Eixo TS 600',   'maquina', 0, 98000.00,  '84798990', false, true, 'TS',
   '{"modelo":"TS 600","eixos":1,"potencia_cv":25,"capacidade_kgh":300,"camera":"600x400mm","peso_kg":720,"tensao":"380V 60Hz"}'),
  ('ES-75',     'Estação de Separação ES 75',  'maquina', 0, 52000.00,  '84798990', false, true, 'ES',
   '{"modelo":"ES 75","tipo":"Separação por densidade","capacidade_kgh":500,"tensao":"380V 60Hz","peso_kg":380}'),
  ('AS-900',    'Alimentador de Silo AS 900',  'maquina', 0, 38000.00,  '84798990', false, true, 'AS',
   '{"modelo":"AS 900","tipo":"Helicoidal","capacidade_kgh":800,"comprimento_mm":900,"tensao":"380V 60Hz","peso_kg":120}')
ON CONFLICT DO NOTHING;

-- seed de metas de exemplo (precisa de usuários existentes — condicional)
DO $$
DECLARE
  v_admin uuid;
BEGIN
  SELECT id INTO v_admin FROM public.usuarios WHERE perfil = 'admin' LIMIT 1;
  IF v_admin IS NOT NULL THEN
    INSERT INTO public.metas (usuario_id, mes, ano, meta_total_brl, meta_maquinas_brl, meta_pecas_brl, realizado_brl, realizado_maquinas_brl, realizado_pecas_brl)
    VALUES
      (v_admin, 6, 2026, 800000, 600000, 200000, 708000, 540000, 168000)
    ON CONFLICT (usuario_id, mes, ano) DO NOTHING;
  END IF;
END $$;

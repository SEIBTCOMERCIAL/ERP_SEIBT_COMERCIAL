-- Migration 005 — Taxa de Câmbio + maquina_id em propostas + seed de produtos

-- maquina_id na proposta (vinculação para proposta de peças)
ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS maquina_id uuid REFERENCES public.maquinas_cliente(id) ON DELETE SET NULL;

-- Tabela de taxas de câmbio configuráveis
CREATE TABLE IF NOT EXISTS public.taxas_cambio (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  moeda           text        NOT NULL DEFAULT 'USD',
  taxa            numeric(12,6) NOT NULL,
  vigente_desde   date        NOT NULL DEFAULT CURRENT_DATE,
  atualizado_por  uuid        REFERENCES public.usuarios(id),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.taxas_cambio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados leem taxas"
  ON public.taxas_cambio FOR SELECT
  USING (get_my_perfil() IS NOT NULL);

CREATE POLICY "admin gerencia taxas"
  ON public.taxas_cambio FOR ALL
  USING (get_my_perfil() = 'admin');

-- Taxa inicial
INSERT INTO public.taxas_cambio (moeda, taxa, vigente_desde)
VALUES ('USD', 5.70, '2026-06-01')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED — Produtos de exemplo (navalhas, peneiras, rolamentos)
-- ============================================================

INSERT INTO public.produtos
  (codigo, descricao, categoria, ipi_pct, preco_brl, ncm, tem_variantes, ativo, linha, specs)
VALUES
  ('728',  'Navalha Rotativa — Aço Rápido M2',      'navalha',   5.20, 3200.00, '82029900', true,  true, 'MGHS', '{"material":"Aço Rápido M2","furo":"ø28mm","qtd_conjunto":4,"garantia":"90 dias"}'),
  ('441',  'Navalha Fixa — Aço Carbono',             'navalha',   5.20,  980.00, '82029900', false, true, 'MGHS', '{"material":"Aço Carbono","tipo":"Contra-faca","qtd_conjunto":2}'),
  ('819',  'Navalha Rotativa — Aço Inox 440C',       'navalha',   5.20, 4800.00, '82029900', false, true, 'MGHS', '{"material":"Aço Inox 440C","qtd_conjunto":4,"obs":"Alta resistência"}'),
  ('312',  'Navalha Rotativa M2 — Furo ø22mm',       'navalha',   5.20, 2100.00, '82029900', false, true, 'MGHS', '{"material":"Aço Rápido M2","furo":"ø22mm","qtd_conjunto":6}'),
  ('094',  'Navalha Rotativa M2 — TPS 600/800',      'navalha',   5.20, 1640.00, '82029900', true,  true, 'TPS',  '{"material":"Aço Rápido M2","aplicacao":"Picotador","qtd_conjunto":8}'),
  ('156',  'Navalha Fixa — TPS 600',                 'navalha',   5.20,  540.00, '82029900', false, true, 'TPS',  '{"material":"Aço Carbono","tipo":"Contra-faca picotador","qtd_conjunto":2}'),
  ('601',  'Navalha Rotativa Inox — MGHS 600',       'navalha',   5.20, 2840.00, '82029900', false, true, 'MGHS', '{"material":"Aço Inox 440C","qtd_conjunto":4}'),
  ('722',  'Navalha Rotativa M2 — MGHS 800 ø35',     'navalha',   5.20, 3520.00, '82029900', false, true, 'MGHS', '{"material":"Aço Rápido M2","furo":"ø35mm","qtd_conjunto":4}'),
  ('512',  'Peneira — Malha 8mm',                    'peneira',   5.20, 1250.00, '84639000', false, true, NULL,   '{"material":"Aço Inox 304","malha":"8mm","tipo":"Chapa perfurada"}'),
  ('513',  'Peneira — Malha 12mm',                   'peneira',   5.20, 1180.00, '84639000', false, true, NULL,   '{"material":"Aço Inox 304","malha":"12mm","tipo":"Chapa perfurada"}'),
  ('514',  'Peneira — Malha 20mm',                   'peneira',   5.20,  980.00, '84639000', false, true, NULL,   '{"material":"Aço Inox 304","malha":"20mm","tipo":"Chapa perfurada"}'),
  ('201',  'Rolamento SKF 6308',                     'rolamento', 0.00,  320.00, '84823000', false, true, NULL,   '{"marca":"SKF","tipo":"Rígido","dim":"40x90x23"}'),
  ('202',  'Rolamento NSK 6310',                     'rolamento', 0.00,  480.00, '84823000', false, true, NULL,   '{"marca":"NSK","tipo":"Rígido","dim":"50x110x27"}'),
  ('203',  'Rolamento FAG 6206',                     'rolamento', 0.00,  185.00, '84823000', false, true, NULL,   '{"marca":"FAG","tipo":"Rígido","dim":"30x62x16"}'),
  ('301',  'Parafuso Sextavado M12x40 Inox',         'parafuso',  0.00,   28.00, '73181500', false, true, NULL,   '{"material":"Inox A2","rosca":"M12","comp":"40mm"}'),
  ('302',  'Parafuso Sextavado M16x60 Inox',         'parafuso',  0.00,   45.00, '73181500', false, true, NULL,   '{"material":"Inox A2","rosca":"M16","comp":"60mm"}')
ON CONFLICT (codigo) DO NOTHING;

-- Compatibilidades
INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, unnest(ARRAY['MGHS 800','MGHS 1200']) FROM public.produtos WHERE codigo = '728' ON CONFLICT DO NOTHING;

INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, unnest(ARRAY['MGHS 800','MGHS 600']) FROM public.produtos WHERE codigo = '441' ON CONFLICT DO NOTHING;

INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, 'MGHS 1200' FROM public.produtos WHERE codigo = '819' ON CONFLICT DO NOTHING;

INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, 'MGHS 600' FROM public.produtos WHERE codigo = '312' ON CONFLICT DO NOTHING;

INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, unnest(ARRAY['TPS 600','TPS 800']) FROM public.produtos WHERE codigo = '094' ON CONFLICT DO NOTHING;

INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, 'TPS 600' FROM public.produtos WHERE codigo = '156' ON CONFLICT DO NOTHING;

INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, 'MGHS 600' FROM public.produtos WHERE codigo = '601' ON CONFLICT DO NOTHING;

INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, 'MGHS 800' FROM public.produtos WHERE codigo = '722' ON CONFLICT DO NOTHING;

INSERT INTO public.compatibilidades_produto (produto_id, modelo_maquina)
SELECT id, unnest(ARRAY['MGHS 800','MGHS 600','MGHS 1200']) FROM public.produtos WHERE codigo IN ('512','513','514') ON CONFLICT DO NOTHING;

-- Histórico de preços inicial (seeds com admin user)
-- Nota: requer ao menos um usuario na tabela. Inserção condicional.
DO $$
DECLARE
  v_user_id uuid;
  v_prod_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.usuarios WHERE perfil = 'admin' LIMIT 1;
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_prod_id FROM public.produtos WHERE codigo = '728';
  IF v_prod_id IS NOT NULL THEN
    INSERT INTO public.historico_precos (produto_id, preco_anterior_brl, preco_novo_brl, percentual_reajuste, motivo, data_reajuste, reajustado_por)
    VALUES
      (v_prod_id, 2963, 3200, 8.0, 'Reajuste anual', '2026-03-01', v_user_id),
      (v_prod_id, 2822, 2963, 5.0, 'Reajuste anual', '2026-01-01', v_user_id),
      (v_prod_id, 2638, 2822, 7.0, 'Reajuste anual', '2025-03-01', v_user_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

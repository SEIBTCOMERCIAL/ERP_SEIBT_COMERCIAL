-- Produtos: operações atômicas (cadastro, ficha técnica, peças, vínculos, arquivos), visão de pendências e
-- bucket privado para documentos. Migration aditiva: não altera nem apaga dados existentes.
-- Rodar DEPOIS do arquivo 033, no SQL Editor do Supabase (instruções no final).
--
-- Regras de situação (padronizadas):
--   deleted_at preenchido  → EXCLUÍDO (oculto em todas as telas; não reajusta; histórico preservado)
--   status = 'descontinuado' → DESCONTINUADO (continua no cadastro; sai de propostas novas e do catálogo)
--   ativo = false           → INATIVO (marca antiga, preservada; não reajusta)
--   caso contrário          → ATIVO

-- ─── 1. Categorias de peça: tipo interno estável (em vez de deduzir pelo nome) ─────────────────
ALTER TABLE public.categorias_peca ADD COLUMN IF NOT EXISTS categoria_produto text NOT NULL DEFAULT 'outro';

UPDATE public.categorias_peca SET categoria_produto = CASE nome
  WHEN 'Navalhas' THEN 'navalha' WHEN 'Peneiras' THEN 'peneira' WHEN 'Rolamentos' THEN 'rolamento'
  WHEN 'Parafusos' THEN 'parafuso' WHEN 'Rotores' THEN 'rotor' WHEN 'Insertos' THEN 'inserto'
  ELSE categoria_produto END
WHERE categoria_produto = 'outro' AND nome IN ('Navalhas','Peneiras','Rolamentos','Parafusos','Rotores','Insertos');

DO $$ BEGIN
  ALTER TABLE public.categorias_peca ADD CONSTRAINT categorias_peca_categoria_produto_check
    CHECK (categoria_produto IN ('navalha','peneira','rolamento','parafuso','rotor','inserto','periferico','outro'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Vínculos peça × equipamento: sem duplicidade e quantidade válida ───────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.compatibilidades_equip GROUP BY peca_id, equipamento_id HAVING count(*) > 1) THEN
    RAISE NOTICE 'Existem vínculos duplicados em compatibilidades_equip; o índice único não foi criado. Corrija e rode de novo.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_compat_peca_equip ON public.compatibilidades_equip(peca_id, equipamento_id);
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE public.compatibilidades_equip ADD CONSTRAINT compat_quantidade_positiva CHECK (quantidade >= 1) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Arquivos: documentos ficam num bucket privado ──────────────────────────────────────────
ALTER TABLE public.produto_arquivos ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'produto-arquivos';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'produto-documentos', 'produto-documentos', false, 4194304, ARRAY['application/pdf','image/jpeg','image/png']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'produto-documentos');

DROP POLICY IF EXISTS "prod_doc_leitura" ON storage.objects;
DROP POLICY IF EXISTS "prod_doc_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "prod_doc_admin_delete" ON storage.objects;
CREATE POLICY "prod_doc_leitura" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'produto-documentos' AND public.get_my_perfil() IS NOT NULL);
CREATE POLICY "prod_doc_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produto-documentos' AND public.get_my_perfil() = 'admin');
CREATE POLICY "prod_doc_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'produto-documentos' AND public.get_my_perfil() = 'admin');

-- ─── 4. Funções (rodam com as permissões de quem chama; sempre exigem administrador) ───────────
CREATE OR REPLACE FUNCTION public.produtos_exigir_admin() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_my_perfil() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
END $$;

-- Registra preço inicial (produto novo ou preço antes vazio): histórico sem preço anterior.
CREATE OR REPLACE FUNCTION public.produtos_registrar_preco_inicial(p_produto uuid, p_componente text, p_preco numeric, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  INSERT INTO public.historico_precos (produto_id, componente, preco_anterior_brl, preco_novo_brl, percentual_reajuste, motivo, data_reajuste, reajustado_por)
  VALUES (p_produto, p_componente, NULL, p_preco, NULL, p_motivo, (now() AT TIME ZONE 'America/Sao_Paulo')::date, auth.uid());
END $$;

-- Preço informado no cadastro/edição: aceita preço novo só quando o campo estava vazio.
-- Alterar um preço já existente é papel do Reajuste (aplicar_reajuste).
CREATE OR REPLACE FUNCTION public.produtos_tratar_preco(p_produto uuid, p_componente text, p_atual numeric, p_novo numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_novo IS NULL THEN RETURN false; END IF;
  IF p_novo < 0 OR p_novo <> round(p_novo, 2) THEN RAISE EXCEPTION 'PRECO_INVALIDO'; END IF;
  IF p_atual IS NULL THEN
    PERFORM public.produtos_registrar_preco_inicial(p_produto, p_componente, p_novo, 'Preço inicial');
    RETURN true;
  END IF;
  IF p_novo <> p_atual THEN RAISE EXCEPTION 'USE_REAJUSTE'; END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.produto_criar_equipamento(p_linha uuid, p_dados jsonb, p_specs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id uuid; v_codigo text := btrim(coalesce(p_dados->>'codigo', '')); v_desc text := btrim(coalesce(p_dados->>'descricao', ''));
  v_p0 numeric := nullif(p_dados->>'preco_brl', '')::numeric;
  v_p220 numeric := nullif(p_dados->>'preco_painel_220', '')::numeric;
  v_p380 numeric := nullif(p_dados->>'preco_painel_380', '')::numeric;
BEGIN
  PERFORM public.produtos_exigir_admin();
  IF NOT EXISTS (SELECT 1 FROM public.linhas WHERE id = p_linha) THEN RAISE EXCEPTION 'LINHA_INEXISTENTE'; END IF;
  IF v_codigo = '' THEN RAISE EXCEPTION 'CODIGO_OBRIGATORIO'; END IF;
  IF v_desc = '' THEN RAISE EXCEPTION 'DESCRICAO_OBRIGATORIA'; END IF;
  IF coalesce(v_p0, 0) < 0 OR coalesce(v_p220, 0) < 0 OR coalesce(v_p380, 0) < 0 THEN RAISE EXCEPTION 'PRECO_INVALIDO'; END IF;

  INSERT INTO public.produtos (codigo, descricao, descricao_painel, potencia_motor, categoria, linha_id, preco_brl, preco_painel_220, preco_painel_380,
                               ncm, ipi_pct, ativo, status, tem_variantes, solicitar_engenharia, specs)
  VALUES (v_codigo, v_desc, nullif(btrim(coalesce(p_dados->>'descricao_painel', '')), ''), nullif(btrim(coalesce(p_dados->>'potencia_motor', '')), ''),
          'maquina', p_linha, v_p0, v_p220, v_p380, nullif(btrim(coalesce(p_dados->>'ncm', '')), ''), 0, true, 'ativo', false,
          coalesce((p_dados->>'solicitar_engenharia')::boolean, false),
          CASE WHEN jsonb_typeof(p_specs) = 'object' THEN p_specs ELSE '{}'::jsonb END)
  RETURNING id INTO v_id;

  IF v_p0 IS NOT NULL THEN PERFORM public.produtos_registrar_preco_inicial(v_id, 'moinho', v_p0, 'Preço inicial'); END IF;
  IF v_p220 IS NOT NULL THEN PERFORM public.produtos_registrar_preco_inicial(v_id, 'painel_220', v_p220, 'Preço inicial'); END IF;
  IF v_p380 IS NOT NULL THEN PERFORM public.produtos_registrar_preco_inicial(v_id, 'painel_380', v_p380, 'Preço inicial'); END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- Edita só os campos presentes em p_dados. Confere linha e versão (edição simultânea).
CREATE OR REPLACE FUNCTION public.produto_editar_equipamento(p_id uuid, p_linha uuid, p_versao text, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v public.produtos%ROWTYPE; v_nova timestamptz;
BEGIN
  PERFORM public.produtos_exigir_admin();
  SELECT * INTO v FROM public.produtos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'PRODUTO_INEXISTENTE'; END IF;
  IF v.categoria <> 'maquina' OR v.linha_id IS DISTINCT FROM p_linha THEN RAISE EXCEPTION 'LINHA_INCOMPATIVEL'; END IF;
  IF p_versao IS NOT NULL AND v.atualizado_em IS DISTINCT FROM p_versao::timestamptz THEN RAISE EXCEPTION 'CONFLITO_EDICAO'; END IF;
  IF p_dados ? 'codigo' AND btrim(coalesce(p_dados->>'codigo', '')) = '' THEN RAISE EXCEPTION 'CODIGO_OBRIGATORIO'; END IF;
  IF p_dados ? 'descricao' AND btrim(coalesce(p_dados->>'descricao', '')) = '' THEN RAISE EXCEPTION 'DESCRICAO_OBRIGATORIA'; END IF;

  IF p_dados ? 'preco_brl' THEN PERFORM public.produtos_tratar_preco(v.id, 'moinho', v.preco_brl, nullif(p_dados->>'preco_brl', '')::numeric); END IF;
  IF p_dados ? 'preco_painel_220' THEN PERFORM public.produtos_tratar_preco(v.id, 'painel_220', v.preco_painel_220, nullif(p_dados->>'preco_painel_220', '')::numeric); END IF;
  IF p_dados ? 'preco_painel_380' THEN PERFORM public.produtos_tratar_preco(v.id, 'painel_380', v.preco_painel_380, nullif(p_dados->>'preco_painel_380', '')::numeric); END IF;

  UPDATE public.produtos SET
    codigo = CASE WHEN p_dados ? 'codigo' THEN btrim(p_dados->>'codigo') ELSE codigo END,
    descricao = CASE WHEN p_dados ? 'descricao' THEN btrim(p_dados->>'descricao') ELSE descricao END,
    descricao_painel = CASE WHEN p_dados ? 'descricao_painel' THEN nullif(btrim(coalesce(p_dados->>'descricao_painel', '')), '') ELSE descricao_painel END,
    potencia_motor = CASE WHEN p_dados ? 'potencia_motor' THEN nullif(btrim(coalesce(p_dados->>'potencia_motor', '')), '') ELSE potencia_motor END,
    ncm = CASE WHEN p_dados ? 'ncm' THEN nullif(btrim(coalesce(p_dados->>'ncm', '')), '') ELSE ncm END,
    solicitar_engenharia = CASE WHEN p_dados ? 'solicitar_engenharia' THEN coalesce((p_dados->>'solicitar_engenharia')::boolean, false) ELSE solicitar_engenharia END,
    preco_brl = CASE WHEN p_dados ? 'preco_brl' AND preco_brl IS NULL THEN nullif(p_dados->>'preco_brl', '')::numeric ELSE preco_brl END,
    preco_painel_220 = CASE WHEN p_dados ? 'preco_painel_220' AND preco_painel_220 IS NULL THEN nullif(p_dados->>'preco_painel_220', '')::numeric ELSE preco_painel_220 END,
    preco_painel_380 = CASE WHEN p_dados ? 'preco_painel_380' AND preco_painel_380 IS NULL THEN nullif(p_dados->>'preco_painel_380', '')::numeric ELSE preco_painel_380 END,
    atualizado_em = clock_timestamp()
  WHERE id = v.id RETURNING atualizado_em INTO v_nova;
  RETURN jsonb_build_object('versao', v_nova);
END $$;

-- Ficha técnica: define/remove chaves explicitamente; o resto das especificações é preservado.
CREATE OR REPLACE FUNCTION public.produto_atualizar_specs(p_id uuid, p_linha uuid, p_versao text, p_definir jsonb, p_remover text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v public.produtos%ROWTYPE; v_nova timestamptz; v_base jsonb;
BEGIN
  PERFORM public.produtos_exigir_admin();
  SELECT * INTO v FROM public.produtos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'PRODUTO_INEXISTENTE'; END IF;
  IF v.categoria <> 'maquina' OR v.linha_id IS DISTINCT FROM p_linha THEN RAISE EXCEPTION 'LINHA_INCOMPATIVEL'; END IF;
  IF p_versao IS NOT NULL AND v.atualizado_em IS DISTINCT FROM p_versao::timestamptz THEN RAISE EXCEPTION 'CONFLITO_EDICAO'; END IF;
  IF p_definir IS NOT NULL AND jsonb_typeof(p_definir) <> 'object' THEN RAISE EXCEPTION 'SPECS_INVALIDAS'; END IF;
  v_base := CASE WHEN jsonb_typeof(v.specs) = 'object' THEN v.specs ELSE '{}'::jsonb END;
  UPDATE public.produtos SET specs = (v_base - coalesce(p_remover, '{}'::text[])) || coalesce(p_definir, '{}'::jsonb), atualizado_em = clock_timestamp()
  WHERE id = v.id RETURNING atualizado_em INTO v_nova;
  RETURN jsonb_build_object('versao', v_nova);
END $$;

-- Peça nova (opcionalmente já vinculada a um equipamento): tudo ou nada.
CREATE OR REPLACE FUNCTION public.produto_criar_peca(p_categoria uuid, p_dados jsonb, p_equipamento uuid DEFAULT NULL, p_quantidade integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_tipo text; v_id uuid; v_codigo text := btrim(coalesce(p_dados->>'codigo', '')); v_desc text := btrim(coalesce(p_dados->>'descricao', ''));
  v_preco numeric := nullif(p_dados->>'preco_brl', '')::numeric; v_ipi numeric := coalesce(nullif(p_dados->>'ipi_pct', '')::numeric, 0);
BEGIN
  PERFORM public.produtos_exigir_admin();
  SELECT categoria_produto INTO v_tipo FROM public.categorias_peca WHERE id = p_categoria;
  IF NOT FOUND THEN RAISE EXCEPTION 'CATEGORIA_INEXISTENTE'; END IF;
  IF v_codigo = '' THEN RAISE EXCEPTION 'CODIGO_OBRIGATORIO'; END IF;
  IF v_desc = '' THEN RAISE EXCEPTION 'DESCRICAO_OBRIGATORIA'; END IF;
  IF coalesce(v_preco, 0) < 0 OR v_preco <> round(v_preco, 2) THEN RAISE EXCEPTION 'PRECO_INVALIDO'; END IF;
  IF v_ipi < 0 OR v_ipi > 100 THEN RAISE EXCEPTION 'IPI_INVALIDO'; END IF;
  IF p_equipamento IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.produtos WHERE id = p_equipamento AND categoria = 'maquina' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'EQUIPAMENTO_INEXISTENTE'; END IF;
    IF p_quantidade IS NULL OR p_quantidade < 1 OR p_quantidade > 10000 THEN RAISE EXCEPTION 'QUANTIDADE_INVALIDA'; END IF;
  END IF;

  INSERT INTO public.produtos (codigo, descricao, categoria, categoria_peca_id, preco_brl, ipi_pct, ncm, furo_diametro, observacao, ativo, status, tem_variantes)
  VALUES (v_codigo, v_desc, v_tipo::public.categoria_produto, p_categoria, v_preco, v_ipi, nullif(btrim(coalesce(p_dados->>'ncm', '')), ''),
          nullif(btrim(coalesce(p_dados->>'furo_diametro', '')), ''), nullif(btrim(coalesce(p_dados->>'observacao', '')), ''), true, 'ativo', false)
  RETURNING id INTO v_id;
  IF v_preco IS NOT NULL THEN PERFORM public.produtos_registrar_preco_inicial(v_id, NULL, v_preco, 'Preço inicial'); END IF;
  IF p_equipamento IS NOT NULL THEN
    INSERT INTO public.compatibilidades_equip (peca_id, equipamento_id, quantidade) VALUES (v_id, p_equipamento, p_quantidade);
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- Dados globais da peça (valem para todos os equipamentos que a usam). Devolve quantos são.
CREATE OR REPLACE FUNCTION public.produto_editar_peca(p_id uuid, p_versao text, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v public.produtos%ROWTYPE; v_nova timestamptz; v_ipi numeric; v_equip integer;
BEGIN
  PERFORM public.produtos_exigir_admin();
  SELECT * INTO v FROM public.produtos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v.deleted_at IS NOT NULL OR v.categoria_peca_id IS NULL THEN RAISE EXCEPTION 'PRODUTO_INEXISTENTE'; END IF;
  IF p_versao IS NOT NULL AND v.atualizado_em IS DISTINCT FROM p_versao::timestamptz THEN RAISE EXCEPTION 'CONFLITO_EDICAO'; END IF;
  IF p_dados ? 'codigo' AND btrim(coalesce(p_dados->>'codigo', '')) = '' THEN RAISE EXCEPTION 'CODIGO_OBRIGATORIO'; END IF;
  IF p_dados ? 'descricao' AND btrim(coalesce(p_dados->>'descricao', '')) = '' THEN RAISE EXCEPTION 'DESCRICAO_OBRIGATORIA'; END IF;
  IF p_dados ? 'ipi_pct' THEN
    v_ipi := nullif(p_dados->>'ipi_pct', '')::numeric;
    IF v_ipi IS NULL OR v_ipi < 0 OR v_ipi > 100 THEN RAISE EXCEPTION 'IPI_INVALIDO'; END IF;
  END IF;
  IF p_dados ? 'preco_brl' THEN PERFORM public.produtos_tratar_preco(v.id, NULL, v.preco_brl, nullif(p_dados->>'preco_brl', '')::numeric); END IF;

  UPDATE public.produtos SET
    codigo = CASE WHEN p_dados ? 'codigo' THEN btrim(p_dados->>'codigo') ELSE codigo END,
    descricao = CASE WHEN p_dados ? 'descricao' THEN btrim(p_dados->>'descricao') ELSE descricao END,
    ncm = CASE WHEN p_dados ? 'ncm' THEN nullif(btrim(coalesce(p_dados->>'ncm', '')), '') ELSE ncm END,
    ipi_pct = CASE WHEN p_dados ? 'ipi_pct' THEN v_ipi ELSE ipi_pct END,
    furo_diametro = CASE WHEN p_dados ? 'furo_diametro' THEN nullif(btrim(coalesce(p_dados->>'furo_diametro', '')), '') ELSE furo_diametro END,
    observacao = CASE WHEN p_dados ? 'observacao' THEN nullif(btrim(coalesce(p_dados->>'observacao', '')), '') ELSE observacao END,
    preco_brl = CASE WHEN p_dados ? 'preco_brl' AND preco_brl IS NULL THEN nullif(p_dados->>'preco_brl', '')::numeric ELSE preco_brl END,
    atualizado_em = clock_timestamp()
  WHERE id = v.id RETURNING atualizado_em INTO v_nova;
  SELECT count(*) INTO v_equip FROM public.compatibilidades_equip WHERE peca_id = v.id;
  RETURN jsonb_build_object('versao', v_nova, 'equipamentos', v_equip);
END $$;

CREATE OR REPLACE FUNCTION public.produto_vincular_peca(p_equipamento uuid, p_peca uuid, p_quantidade integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.produtos_exigir_admin();
  IF NOT EXISTS (SELECT 1 FROM public.produtos WHERE id = p_equipamento AND categoria = 'maquina' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'EQUIPAMENTO_INEXISTENTE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.produtos WHERE id = p_peca AND categoria_peca_id IS NOT NULL AND deleted_at IS NULL) THEN RAISE EXCEPTION 'PECA_INEXISTENTE'; END IF;
  IF p_quantidade IS NULL OR p_quantidade < 1 OR p_quantidade > 10000 THEN RAISE EXCEPTION 'QUANTIDADE_INVALIDA'; END IF;
  IF EXISTS (SELECT 1 FROM public.compatibilidades_equip WHERE peca_id = p_peca AND equipamento_id = p_equipamento) THEN RAISE EXCEPTION 'VINCULO_DUPLICADO'; END IF;
  INSERT INTO public.compatibilidades_equip (peca_id, equipamento_id, quantidade) VALUES (p_peca, p_equipamento, p_quantidade) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.produto_atualizar_vinculo(p_vinculo uuid, p_equipamento uuid, p_quantidade integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_linhas integer;
BEGIN
  PERFORM public.produtos_exigir_admin();
  IF p_quantidade IS NULL OR p_quantidade < 1 OR p_quantidade > 10000 THEN RAISE EXCEPTION 'QUANTIDADE_INVALIDA'; END IF;
  UPDATE public.compatibilidades_equip SET quantidade = p_quantidade WHERE id = p_vinculo AND equipamento_id = p_equipamento;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas <> 1 THEN RAISE EXCEPTION 'VINCULO_INEXISTENTE'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.produto_desvincular_peca(p_vinculo uuid, p_equipamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_linhas integer;
BEGIN
  PERFORM public.produtos_exigir_admin();
  DELETE FROM public.compatibilidades_equip WHERE id = p_vinculo AND equipamento_id = p_equipamento;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas <> 1 THEN RAISE EXCEPTION 'VINCULO_INEXISTENTE'; END IF;
END $$;

-- Descontinuar, reativar ou excluir (exclusão é lógica: o registro e o histórico ficam preservados).
CREATE OR REPLACE FUNCTION public.produto_alterar_situacao(p_id uuid, p_acao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v public.produtos%ROWTYPE; v_vinculos integer := 0;
BEGIN
  PERFORM public.produtos_exigir_admin();
  IF p_acao NOT IN ('descontinuar', 'reativar', 'excluir') THEN RAISE EXCEPTION 'ACAO_INVALIDA'; END IF;
  SELECT * INTO v FROM public.produtos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'PRODUTO_INEXISTENTE'; END IF;
  IF p_acao = 'descontinuar' THEN
    UPDATE public.produtos SET status = 'descontinuado', atualizado_em = clock_timestamp() WHERE id = v.id;
  ELSIF p_acao = 'reativar' THEN
    UPDATE public.produtos SET status = 'ativo', atualizado_em = clock_timestamp() WHERE id = v.id;
  ELSE
    -- Peça excluída deixa de aparecer nos equipamentos (e no catálogo): os vínculos saem junto.
    IF v.categoria_peca_id IS NOT NULL THEN
      DELETE FROM public.compatibilidades_equip WHERE peca_id = v.id;
      GET DIAGNOSTICS v_vinculos = ROW_COUNT;
    END IF;
    UPDATE public.produtos SET deleted_at = now(), atualizado_em = clock_timestamp() WHERE id = v.id;
  END IF;
  RETURN jsonb_build_object('vinculos_removidos', v_vinculos);
END $$;

-- Cópia de equipamento: copia dados e ficha; preços entram como preço inicial (com histórico).
CREATE OR REPLACE FUNCTION public.produto_duplicar_equipamento(p_id uuid, p_linha uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE o public.produtos%ROWTYPE; v_id uuid; v_codigo text; v_n integer := 1;
BEGIN
  PERFORM public.produtos_exigir_admin();
  SELECT * INTO o FROM public.produtos WHERE id = p_id;
  IF NOT FOUND OR o.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'PRODUTO_INEXISTENTE'; END IF;
  IF o.categoria <> 'maquina' OR o.linha_id IS DISTINCT FROM p_linha THEN RAISE EXCEPTION 'LINHA_INCOMPATIVEL'; END IF;
  v_codigo := 'CÓPIA ' || o.codigo;
  WHILE EXISTS (SELECT 1 FROM public.produtos WHERE codigo = v_codigo) LOOP
    v_n := v_n + 1; v_codigo := 'CÓPIA ' || v_n || ' ' || o.codigo;
  END LOOP;
  INSERT INTO public.produtos (codigo, descricao, descricao_painel, potencia_motor, categoria, linha_id, preco_brl, preco_painel_220, preco_painel_380,
                               ncm, ipi_pct, specs, ativo, status, tem_variantes, solicitar_engenharia)
  VALUES (v_codigo, o.descricao, o.descricao_painel, o.potencia_motor, 'maquina', o.linha_id, o.preco_brl, o.preco_painel_220, o.preco_painel_380,
          o.ncm, coalesce(o.ipi_pct, 0), o.specs, true, 'ativo', false, coalesce(o.solicitar_engenharia, false))
  RETURNING id INTO v_id;
  IF o.preco_brl IS NOT NULL THEN PERFORM public.produtos_registrar_preco_inicial(v_id, 'moinho', o.preco_brl, 'Preço inicial (cópia de ' || o.codigo || ')'); END IF;
  IF o.preco_painel_220 IS NOT NULL THEN PERFORM public.produtos_registrar_preco_inicial(v_id, 'painel_220', o.preco_painel_220, 'Preço inicial (cópia de ' || o.codigo || ')'); END IF;
  IF o.preco_painel_380 IS NOT NULL THEN PERFORM public.produtos_registrar_preco_inicial(v_id, 'painel_380', o.preco_painel_380, 'Preço inicial (cópia de ' || o.codigo || ')'); END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- Foto da linha: escolha explícita entre preservar fotos individuais ou substituir todas (tudo ou nada).
CREATE OR REPLACE FUNCTION public.produto_aplicar_foto_linha(p_linha uuid, p_url text, p_nome text, p_substituir boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_ids uuid[]; v_total integer; v_antigas text[];
BEGIN
  PERFORM public.produtos_exigir_admin();
  IF coalesce(btrim(p_url), '') = '' THEN RAISE EXCEPTION 'ARQUIVO_INVALIDO'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.linhas WHERE id = p_linha) THEN RAISE EXCEPTION 'LINHA_INEXISTENTE'; END IF;
  SELECT count(*) INTO v_total FROM public.produtos WHERE linha_id = p_linha AND categoria = 'maquina' AND deleted_at IS NULL;
  IF v_total = 0 THEN RAISE EXCEPTION 'LINHA_SEM_EQUIPAMENTOS'; END IF;
  SELECT array_agg(id) INTO v_ids FROM public.produtos
   WHERE linha_id = p_linha AND categoria = 'maquina' AND deleted_at IS NULL AND (p_substituir OR foto_url IS NULL);
  IF v_ids IS NULL THEN RETURN jsonb_build_object('afetados', 0, 'preservados', v_total, 'urls_substituidas', '[]'::jsonb); END IF;
  SELECT array_agg(DISTINCT foto_url) INTO v_antigas FROM public.produtos WHERE id = ANY (v_ids) AND foto_url IS NOT NULL AND foto_url <> p_url;

  INSERT INTO public.produto_arquivos (produto_id, tipo, nome, url, storage_path, bucket)
  SELECT id, 'imagem', coalesce(p_nome, 'foto-da-linha'), p_url, NULL, 'produto-arquivos' FROM public.produtos
   WHERE id = ANY (v_ids) AND NOT EXISTS (SELECT 1 FROM public.produto_arquivos a WHERE a.produto_id = produtos.id AND a.url = p_url);
  UPDATE public.produtos SET foto_url = p_url, atualizado_em = clock_timestamp() WHERE id = ANY (v_ids);
  RETURN jsonb_build_object('afetados', coalesce(array_length(v_ids, 1), 0), 'preservados', v_total - coalesce(array_length(v_ids, 1), 0),
                            'urls_substituidas', to_jsonb(coalesce(v_antigas, '{}'::text[])));
END $$;

-- Remove um arquivo do produto (confere o vínculo) e acerta a foto principal se necessário.
CREATE OR REPLACE FUNCTION public.produto_remover_arquivo(p_arquivo uuid, p_produto uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE a public.produto_arquivos%ROWTYPE; v_nova_foto text; v_trocou boolean := false; v_outros boolean;
BEGIN
  PERFORM public.produtos_exigir_admin();
  SELECT * INTO a FROM public.produto_arquivos WHERE id = p_arquivo AND produto_id = p_produto FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARQUIVO_INEXISTENTE'; END IF;
  DELETE FROM public.produto_arquivos WHERE id = a.id;
  IF a.tipo = 'imagem' AND EXISTS (SELECT 1 FROM public.produtos WHERE id = p_produto AND foto_url = a.url) THEN
    SELECT url INTO v_nova_foto FROM public.produto_arquivos WHERE produto_id = p_produto AND tipo = 'imagem' ORDER BY ordem, criado_em, id LIMIT 1;
    UPDATE public.produtos SET foto_url = v_nova_foto, atualizado_em = clock_timestamp() WHERE id = p_produto;
    v_trocou := true;
  END IF;
  v_outros := EXISTS (SELECT 1 FROM public.produto_arquivos WHERE url = a.url) OR EXISTS (SELECT 1 FROM public.produtos WHERE foto_url = a.url);
  RETURN jsonb_build_object('storage_path', a.storage_path, 'bucket', a.bucket, 'url', a.url, 'tipo', a.tipo,
                            'foto_principal_trocada', v_trocou, 'nova_foto', v_nova_foto, 'ainda_usado', v_outros);
END $$;

-- ─── 5. Visão de pendências e contagens (cálculo no banco) ─────────────────────────────────────
-- Ficha técnica incompleta: campos do modelo da linha (linha_spec_campos) sem valor. Painéis ausentes não
-- contam como pendência (nem todo equipamento tem os dois).
CREATE OR REPLACE VIEW public.produtos_resumo WITH (security_invoker = true) AS
SELECT t.*, (coalesce(t.ficha_total, 0) > coalesce(t.ficha_preenchidos, 0)) AS ficha_incompleta
FROM (
  SELECT p.id, p.codigo, p.descricao, p.modelo, p.categoria, p.linha_id, p.categoria_peca_id, p.status, p.ativo, p.deleted_at,
         p.preco_brl, p.preco_painel_220, p.preco_painel_380, p.ipi_pct, p.ncm, p.foto_url, p.potencia_motor,
         coalesce(p.solicitar_engenharia, false) AS solicitar_engenharia, p.atualizado_em,
         l.nome AS linha_nome, l.ordem AS linha_ordem, l.grupo AS familia, l.grupo_ordem AS familia_ordem,
         cp.nome AS categoria_peca_nome, cp.ordem AS categoria_peca_ordem,
         (p.foto_url IS NULL) AS sem_foto,
         (p.preco_brl IS NULL AND NOT coalesce(p.solicitar_engenharia, false)) AS sem_preco,
         CASE WHEN p.categoria = 'maquina' THEN (SELECT count(*) FROM public.linha_spec_campos c WHERE c.linha_id = p.linha_id) END AS ficha_total,
         CASE WHEN p.categoria = 'maquina' THEN (SELECT count(*) FROM public.linha_spec_campos c WHERE c.linha_id = p.linha_id
                                                  AND nullif(btrim(coalesce(p.specs ->> c.nome, '')), '') IS NOT NULL) END AS ficha_preenchidos,
         (p.categoria_peca_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.compatibilidades_equip ce WHERE ce.peca_id = p.id)) AS sem_vinculo
  FROM public.produtos p
  LEFT JOIN public.linhas l ON l.id = p.linha_id
  LEFT JOIN public.categorias_peca cp ON cp.id = p.categoria_peca_id
) t;

GRANT SELECT ON public.produtos_resumo TO authenticated;

CREATE OR REPLACE FUNCTION public.produtos_contagens()
RETURNS TABLE (tipo text, escopo_id uuid, total bigint, descontinuados bigint, sem_foto bigint, sem_preco bigint, ficha_incompleta bigint, sem_vinculo bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT 'linha'::text, linha_id, count(*), count(*) FILTER (WHERE status = 'descontinuado'), count(*) FILTER (WHERE sem_foto),
         count(*) FILTER (WHERE sem_preco), count(*) FILTER (WHERE ficha_incompleta), 0::bigint
    FROM public.produtos_resumo WHERE deleted_at IS NULL AND categoria = 'maquina' AND linha_id IS NOT NULL GROUP BY linha_id
  UNION ALL
  SELECT 'categoria'::text, categoria_peca_id, count(*), count(*) FILTER (WHERE status = 'descontinuado'), 0::bigint,
         count(*) FILTER (WHERE sem_preco), 0::bigint, count(*) FILTER (WHERE sem_vinculo)
    FROM public.produtos_resumo WHERE deleted_at IS NULL AND categoria_peca_id IS NOT NULL GROUP BY categoria_peca_id
$$;

REVOKE ALL ON FUNCTION public.produtos_exigir_admin(), public.produtos_registrar_preco_inicial(uuid, text, numeric, text), public.produtos_tratar_preco(uuid, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.produtos_exigir_admin(), public.produtos_registrar_preco_inicial(uuid, text, numeric, text), public.produtos_tratar_preco(uuid, text, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.produto_criar_equipamento(uuid, jsonb, jsonb), public.produto_editar_equipamento(uuid, uuid, text, jsonb),
  public.produto_atualizar_specs(uuid, uuid, text, jsonb, text[]), public.produto_criar_peca(uuid, jsonb, uuid, integer),
  public.produto_editar_peca(uuid, text, jsonb), public.produto_vincular_peca(uuid, uuid, integer), public.produto_atualizar_vinculo(uuid, uuid, integer),
  public.produto_desvincular_peca(uuid, uuid), public.produto_alterar_situacao(uuid, text), public.produto_duplicar_equipamento(uuid, uuid),
  public.produto_aplicar_foto_linha(uuid, text, text, boolean), public.produto_remover_arquivo(uuid, uuid), public.produtos_contagens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.produto_criar_equipamento(uuid, jsonb, jsonb), public.produto_editar_equipamento(uuid, uuid, text, jsonb),
  public.produto_atualizar_specs(uuid, uuid, text, jsonb, text[]), public.produto_criar_peca(uuid, jsonb, uuid, integer),
  public.produto_editar_peca(uuid, text, jsonb), public.produto_vincular_peca(uuid, uuid, integer), public.produto_atualizar_vinculo(uuid, uuid, integer),
  public.produto_desvincular_peca(uuid, uuid), public.produto_alterar_situacao(uuid, text), public.produto_duplicar_equipamento(uuid, uuid),
  public.produto_aplicar_foto_linha(uuid, text, text, boolean), public.produto_remover_arquivo(uuid, uuid), public.produtos_contagens() TO authenticated;

-- ─── INSTRUÇÕES DE APLICAÇÃO ─────────────────────────────────────────────────────────────────
-- 1. Aplique ANTES a migração 033 (Reajuste); esta usa a tabela historico_precos e o padrão dela.
-- 2. Supabase → SQL Editor → New query → cole TODO este arquivo → Run ("Success. No rows returned").
-- 3. Pode ser executado de novo sem erro. Se aparecer o aviso de vínculos duplicados, corrija-os e rode de novo.
-- 4. Nenhum dado existente é alterado. Sem esta migração, as telas de Produtos mostram um aviso e o
--    cadastro/edição ficam bloqueados (a leitura continua funcionando).

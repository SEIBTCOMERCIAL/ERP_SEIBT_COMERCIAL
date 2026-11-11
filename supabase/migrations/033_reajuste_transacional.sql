-- Reajuste de preços com integridade: preço + histórico numa única transação, proteção contra
-- repetição (duplo clique) e contra alteração concorrente. Migration aditiva: não altera nem apaga dados.
-- Rodar DEPOIS do arquivo 032, no SQL Editor do Supabase (veja instruções no final deste arquivo).

-- ─── 1. Histórico: ligação com o lote e índices de consulta ─────────────────────────────────
ALTER TABLE public.historico_precos ADD COLUMN IF NOT EXISTS lote_id uuid;
CREATE INDEX IF NOT EXISTS idx_historico_precos_lote ON public.historico_precos(lote_id);
CREATE INDEX IF NOT EXISTS idx_historico_precos_produto_data ON public.historico_precos(produto_id, data_reajuste DESC);
CREATE INDEX IF NOT EXISTS idx_historico_precos_data ON public.historico_precos(data_reajuste);

-- ─── 2. Lotes de reajuste: identifica cada operação e impede aplicá-la duas vezes ────────────
CREATE TABLE IF NOT EXISTS public.reajuste_lotes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       uuid NOT NULL UNIQUE,
  motivo      text NOT NULL,
  produtos    integer NOT NULL,
  componentes integer NOT NULL,
  resumo      jsonb NOT NULL,
  criado_por  uuid NOT NULL REFERENCES public.usuarios(id),
  criado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reajuste_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reajuste_lotes_admin_le" ON public.reajuste_lotes;
CREATE POLICY "reajuste_lotes_admin_le" ON public.reajuste_lotes
  FOR SELECT TO authenticated USING (public.get_my_perfil() = 'admin');

DROP POLICY IF EXISTS "reajuste_lotes_admin_cria" ON public.reajuste_lotes;
CREATE POLICY "reajuste_lotes_admin_cria" ON public.reajuste_lotes
  FOR INSERT TO authenticated WITH CHECK (public.get_my_perfil() = 'admin' AND criado_por = auth.uid());

-- ─── 3. Função que aplica o reajuste (tudo ou nada) ─────────────────────────────────────────
-- p_itens: [{"produto_id": uuid, "componente": "moinho|painel_220|painel_380|peca",
--            "preco_esperado": número, "preco_novo": número}, ...]
-- Roda com as permissões de quem chamou (SECURITY INVOKER): as regras de acesso das tabelas continuam valendo.
CREATE OR REPLACE FUNCTION public.aplicar_reajuste(p_itens jsonb, p_motivo text, p_chave uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_hoje        date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_motivo      text := btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g'));
  v_item        jsonb;
  v_prod        public.produtos%ROWTYPE;
  v_comp        text;
  v_atual       numeric;
  v_esperado    numeric;
  v_novo        numeric;
  v_linhas      integer;
  v_existente   public.reajuste_lotes%ROWTYPE;
  v_lote        uuid := gen_random_uuid();
  v_componentes integer := 0;
  v_produtos    uuid[] := '{}';
  v_ignorados   jsonb := '[]'::jsonb;
  v_resumo      jsonb;
BEGIN
  IF v_uid IS NULL OR public.get_my_perfil() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  IF length(v_motivo) < 3 OR length(v_motivo) > 200 THEN
    RAISE EXCEPTION 'MOTIVO_INVALIDO';
  END IF;
  IF p_chave IS NULL THEN
    RAISE EXCEPTION 'CHAVE_INVALIDA';
  END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'NENHUMA_ALTERACAO';
  END IF;

  -- Mesma requisição repetida (duplo clique, reenvio): devolve o resultado já gravado, sem reaplicar.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_chave::text, 0));
  SELECT * INTO v_existente FROM public.reajuste_lotes WHERE chave = p_chave;
  IF FOUND THEN
    RETURN v_existente.resumo || jsonb_build_object('repetido', true);
  END IF;

  -- Ordem fixa evita travamento entre duas operações simultâneas.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_itens) ORDER BY value->>'produto_id', value->>'componente'
  LOOP
    v_comp := v_item->>'componente';
    IF v_comp IS NULL OR v_comp NOT IN ('moinho', 'painel_220', 'painel_380', 'peca') THEN
      RAISE EXCEPTION 'COMPONENTE_INVALIDO';
    END IF;

    SELECT * INTO v_prod FROM public.produtos WHERE id = (v_item->>'produto_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN
      v_ignorados := v_ignorados || jsonb_build_object('produto_id', v_item->>'produto_id', 'componente', v_comp, 'motivo', 'nao_encontrado');
      CONTINUE;
    END IF;
    IF v_prod.deleted_at IS NOT NULL THEN
      v_ignorados := v_ignorados || jsonb_build_object('produto_id', v_prod.id, 'codigo', v_prod.codigo, 'componente', v_comp, 'motivo', 'excluido');
      CONTINUE;
    END IF;
    IF v_prod.ativo IS NOT TRUE THEN
      v_ignorados := v_ignorados || jsonb_build_object('produto_id', v_prod.id, 'codigo', v_prod.codigo, 'componente', v_comp, 'motivo', 'inativo');
      CONTINUE;
    END IF;
    -- Máquinas têm máquina e painéis; as demais, só o preço da peça.
    IF (v_comp = 'peca') = (v_prod.categoria = 'maquina') THEN
      RAISE EXCEPTION 'COMPONENTE_INVALIDO';
    END IF;

    v_atual := CASE v_comp
      WHEN 'moinho' THEN v_prod.preco_brl
      WHEN 'peca' THEN v_prod.preco_brl
      WHEN 'painel_220' THEN v_prod.preco_painel_220
      WHEN 'painel_380' THEN v_prod.preco_painel_380
    END;
    IF v_atual IS NULL THEN
      v_ignorados := v_ignorados || jsonb_build_object('produto_id', v_prod.id, 'codigo', v_prod.codigo, 'componente', v_comp, 'motivo', 'sem_preco');
      CONTINUE;
    END IF;

    v_esperado := (v_item->>'preco_esperado')::numeric;
    v_novo := (v_item->>'preco_novo')::numeric;
    IF v_novo IS NULL OR v_novo <= 0 OR v_novo <> round(v_novo, 2) THEN
      RAISE EXCEPTION 'PRECO_INVALIDO:%', v_prod.codigo;
    END IF;
    -- O preço mudou depois da prévia: interrompe tudo e pede nova conferência.
    IF v_esperado IS DISTINCT FROM v_atual THEN
      RAISE EXCEPTION 'PRECO_ALTERADO:%', v_prod.codigo;
    END IF;
    IF v_novo = v_atual THEN
      v_ignorados := v_ignorados || jsonb_build_object('produto_id', v_prod.id, 'codigo', v_prod.codigo, 'componente', v_comp, 'motivo', 'sem_alteracao');
      CONTINUE;
    END IF;

    UPDATE public.produtos SET
      preco_brl        = CASE WHEN v_comp IN ('moinho', 'peca') THEN v_novo ELSE preco_brl END,
      preco_painel_220 = CASE WHEN v_comp = 'painel_220' THEN v_novo ELSE preco_painel_220 END,
      preco_painel_380 = CASE WHEN v_comp = 'painel_380' THEN v_novo ELSE preco_painel_380 END,
      atualizado_em    = now()
    WHERE id = v_prod.id;
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    IF v_linhas <> 1 THEN
      RAISE EXCEPTION 'FALHA_ATUALIZACAO:%', v_prod.codigo;
    END IF;

    INSERT INTO public.historico_precos
      (produto_id, componente, preco_anterior_brl, preco_novo_brl, percentual_reajuste, motivo, data_reajuste, reajustado_por, lote_id)
    VALUES
      (v_prod.id, CASE WHEN v_comp = 'peca' THEN NULL ELSE v_comp END, v_atual, v_novo,
       CASE WHEN v_atual > 0 THEN round((v_novo - v_atual) / v_atual * 100, 2) ELSE NULL END,
       v_motivo, v_hoje, v_uid, v_lote);

    v_componentes := v_componentes + 1;
    IF NOT (v_prod.id = ANY (v_produtos)) THEN
      v_produtos := v_produtos || v_prod.id;
    END IF;
  END LOOP;

  -- Nada mudou: cancela (nenhum histórico de alteração que não ocorreu).
  IF v_componentes = 0 THEN
    RAISE EXCEPTION 'NENHUMA_ALTERACAO';
  END IF;

  v_resumo := jsonb_build_object(
    'lote_id', v_lote, 'produtos', coalesce(array_length(v_produtos, 1), 0), 'componentes', v_componentes,
    'ignorados', v_ignorados, 'data', v_hoje, 'repetido', false);

  INSERT INTO public.reajuste_lotes (id, chave, motivo, produtos, componentes, resumo, criado_por)
  VALUES (v_lote, p_chave, v_motivo, coalesce(array_length(v_produtos, 1), 0), v_componentes, v_resumo, v_uid);

  RETURN v_resumo;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_reajuste(jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_reajuste(jsonb, text, uuid) TO authenticated;

-- ─── 4. Permissões do histórico: só leitura, exceto a gravação feita pela função acima ───────
-- Engenharia não altera preços (a tabela de produtos só aceita escrita de administrador); permitir
-- que ela gravasse histórico criaria registros de reajustes que não ocorreram.
DROP POLICY IF EXISTS "historico_engenharia_full" ON public.historico_precos;
DROP POLICY IF EXISTS "historico_engenharia_read" ON public.historico_precos;
CREATE POLICY "historico_engenharia_read" ON public.historico_precos
  FOR SELECT TO authenticated USING (public.get_my_perfil() = 'engenharia');

-- O histórico é um registro permanente: ninguém o edita nem apaga pela aplicação.
DROP POLICY IF EXISTS "historico_precos_admin_atualiza" ON public.historico_precos;
DROP POLICY IF EXISTS "historico_precos_admin_exclui" ON public.historico_precos;

-- ─── INSTRUÇÕES DE APLICAÇÃO ─────────────────────────────────────────────────────────────────
-- 1. Abra o Supabase → SQL Editor → New query.
-- 2. Cole TODO este arquivo e clique em Run. Deve aparecer "Success. No rows returned".
-- 3. O arquivo pode ser executado de novo sem causar erro.
-- 4. Antes de aplicar em produção, confirme que nenhuma outra tela grava em historico_precos
--    diretamente (a tela de Reajuste e a de Preços passam a usar a função aplicar_reajuste).

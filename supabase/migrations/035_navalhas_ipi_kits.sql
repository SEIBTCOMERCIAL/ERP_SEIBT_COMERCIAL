-- IPI das navalhas: padrão de 5,20% (determinação do usuário), histórico de cada mudança de IPI e edição manual protegida.
-- Rodar DEPOIS dos arquivos 033 e 034, no SQL Editor do Supabase (instruções no final).
-- Aditiva e repetível: não altera preços-base nem quantidades e não mexe em propostas ou pedidos já emitidos
-- (cada item emitido guarda o próprio IPI da época). Alterar só o IPI NÃO é reajuste: o histórico de IPI é separado
-- do histórico de preços (historico_precos), então a data do "último reajuste" não muda.

-- ─── 1. Marca de edição manual ───────────────────────────────────────────────────────────────
-- Quem tem a marca nunca volta ao padrão por esta migração (nem por rodá-la de novo).
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ipi_manual boolean NOT NULL DEFAULT false;

-- ─── 2. Histórico de IPI ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.produto_ipi_historico (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id    uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  ipi_anterior  numeric(6,2),
  ipi_novo      numeric(6,2),
  origem        text NOT NULL CHECK (origem IN ('padrao_navalhas', 'manual')),
  motivo        text,
  alterado_por  uuid REFERENCES public.usuarios(id),
  responsavel   text,
  lote_id       uuid,
  alterado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_produto_ipi_historico_produto ON public.produto_ipi_historico(produto_id, alterado_em DESC);
CREATE INDEX IF NOT EXISTS idx_jogos_navalha_itens_produto ON public.jogos_navalha_itens(produto_id);

ALTER TABLE public.produto_ipi_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ipi_historico_leitura" ON public.produto_ipi_historico;
CREATE POLICY "ipi_historico_leitura" ON public.produto_ipi_historico
  FOR SELECT TO authenticated USING (public.get_my_perfil() IN ('admin', 'engenharia'));
-- Sem política de escrita: só o gatilho abaixo grava, e ninguém edita ou apaga o histórico pela aplicação.

-- ─── 3. Gatilho: toda mudança de IPI deixa registro ──────────────────────────────────────────
-- Vale para qualquer caminho de gravação (tela de peças, edição de kit, função abaixo, migração).
CREATE OR REPLACE FUNCTION public.produtos_registrar_ipi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem text := coalesce(nullif(current_setting('app.ipi_origem', true), ''), 'manual');
BEGIN
  INSERT INTO public.produto_ipi_historico (produto_id, ipi_anterior, ipi_novo, origem, motivo, alterado_por, responsavel, lote_id)
  VALUES (
    NEW.id, OLD.ipi_pct, NEW.ipi_pct, v_origem,
    nullif(current_setting('app.ipi_motivo', true), ''),
    auth.uid(),
    nullif(current_setting('app.ipi_responsavel', true), ''),
    nullif(current_setting('app.ipi_lote', true), '')::uuid
  );
  IF v_origem <> 'padrao_navalhas' THEN
    NEW.ipi_manual := true;   -- qualquer ajuste feito por pessoa passa a ser protegido
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produtos_registrar_ipi ON public.produtos;
CREATE TRIGGER trg_produtos_registrar_ipi
  BEFORE UPDATE OF ipi_pct ON public.produtos
  FOR EACH ROW
  WHEN (OLD.ipi_pct IS DISTINCT FROM NEW.ipi_pct)
  EXECUTE FUNCTION public.produtos_registrar_ipi();

-- ─── 4. Edição manual do IPI das navalhas (somente administrador) ────────────────────────────
-- p_produtos: navalhas escolhidas (uma, ou as peças de um kit com o alcance já definido pela tela).
-- Só aceita produtos da categoria navalha; qualquer outro produto cancela a operação inteira.
CREATE OR REPLACE FUNCTION public.produto_definir_ipi(p_produtos uuid[], p_ipi numeric, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_motivo  text := btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g'));
  v_ids     uuid[];
  v_id      uuid;
  v_prod    public.produtos%ROWTYPE;
  v_lote    uuid := gen_random_uuid();
  v_alterados integer := 0;
  v_iguais    integer := 0;
BEGIN
  IF v_uid IS NULL OR public.get_my_perfil() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'SEM_PERMISSAO'; END IF;
  IF p_ipi IS NULL OR p_ipi < 0 OR p_ipi > 100 OR p_ipi <> round(p_ipi, 2) THEN RAISE EXCEPTION 'IPI_INVALIDO'; END IF;
  IF length(v_motivo) < 3 OR length(v_motivo) > 200 THEN RAISE EXCEPTION 'MOTIVO_INVALIDO'; END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x), '{}') INTO v_ids FROM unnest(coalesce(p_produtos, '{}')) AS x;
  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'NENHUMA_ALTERACAO'; END IF;
  IF array_length(v_ids, 1) > 2000 THEN RAISE EXCEPTION 'SELECAO_GRANDE_DEMAIS'; END IF;

  PERFORM set_config('app.ipi_origem', 'manual', true);
  PERFORM set_config('app.ipi_motivo', v_motivo, true);
  PERFORM set_config('app.ipi_responsavel', '', true);
  PERFORM set_config('app.ipi_lote', v_lote::text, true);

  FOREACH v_id IN ARRAY v_ids LOOP   -- ordem fixa evita travamento entre operações simultâneas
    SELECT * INTO v_prod FROM public.produtos WHERE id = v_id FOR UPDATE;
    IF NOT FOUND OR v_prod.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'PRODUTO_INEXISTENTE:%', v_id; END IF;
    IF v_prod.categoria IS DISTINCT FROM 'navalha' THEN RAISE EXCEPTION 'NAO_NAVALHA:%', v_prod.codigo; END IF;
    IF v_prod.ipi_pct IS NOT DISTINCT FROM p_ipi THEN v_iguais := v_iguais + 1; ELSE v_alterados := v_alterados + 1; END IF;
    -- Mesmo quando o valor já é igual, a marca "manual" é gravada: confirma o valor e impede o padrão de sobrescrevê-lo.
    UPDATE public.produtos SET ipi_pct = p_ipi, ipi_manual = true, atualizado_em = now() WHERE id = v_id;
  END LOOP;

  RETURN jsonb_build_object('lote_id', v_lote, 'produtos', array_length(v_ids, 1), 'alterados', v_alterados, 'sem_mudanca', v_iguais);
END;
$$;
REVOKE ALL ON FUNCTION public.produto_definir_ipi(uuid[], numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.produto_definir_ipi(uuid[], numeric, text) TO authenticated;

-- ─── 5. Cadastros que exigem revisão (não são alterados automaticamente) ─────────────────────
-- Navalha = produto da categoria "navalha". Ficam de fora da correção e listados aqui:
--   • categoria "navalha" ligada a uma categoria de peças que não é a de navalhas;
--   • produto de outra categoria, mas dentro da categoria de peças "navalha" ou com descrição de navalha.
CREATE OR REPLACE VIEW public.navalhas_ipi_revisao WITH (security_invoker = true) AS
SELECT p.id, p.codigo, p.descricao, p.categoria::text AS categoria, cp.nome AS categoria_peca, p.ipi_pct, p.ipi_manual,
       CASE
         WHEN p.categoria = 'navalha' AND cp.id IS NOT NULL AND cp.categoria_produto <> 'navalha' THEN 'categoria navalha, mas ligada a outra categoria de peças'
         WHEN p.categoria <> 'navalha' AND cp.categoria_produto = 'navalha' THEN 'ligada à categoria navalha, mas o tipo do produto é outro'
         ELSE 'descrição de navalha em produto de outro tipo'
       END AS motivo
  FROM public.produtos p
  LEFT JOIN public.categorias_peca cp ON cp.id = p.categoria_peca_id
 WHERE p.deleted_at IS NULL
   AND (   (p.categoria = 'navalha' AND cp.id IS NOT NULL AND cp.categoria_produto <> 'navalha')
        OR (p.categoria <> 'navalha' AND cp.categoria_produto = 'navalha')
        OR (p.categoria <> 'navalha' AND p.categoria <> 'maquina' AND p.descricao ~* '^\s*NAVALHAS?\s'));

-- ─── 6. Correção autorizada: IPI de todas as navalhas = 5,20% ────────────────────────────────
-- Atinge só produtos da categoria navalha, sem os cadastros em revisão e sem quem já teve ajuste manual.
-- Repetir esta migração não grava nada de novo (só muda quem ainda não está em 5,20%).
DO $$
DECLARE
  v_lote       uuid := gen_random_uuid();
  v_alterados  integer;
  v_ja_certos  integer;
  v_manuais    integer;
  v_revisao    integer;
BEGIN
  PERFORM set_config('app.ipi_origem', 'padrao_navalhas', true);
  PERFORM set_config('app.ipi_motivo', 'IPI padrão das navalhas: 5,20% (determinação do usuário)', true);
  PERFORM set_config('app.ipi_responsavel', 'Migração 035 — determinação do usuário', true);
  PERFORM set_config('app.ipi_lote', v_lote::text, true);

  SELECT count(*) INTO v_ja_certos FROM public.produtos p
   WHERE p.categoria = 'navalha' AND p.ipi_pct IS NOT DISTINCT FROM 5.20
     AND NOT EXISTS (SELECT 1 FROM public.navalhas_ipi_revisao r WHERE r.id = p.id);
  SELECT count(*) INTO v_manuais FROM public.produtos p
   WHERE p.categoria = 'navalha' AND p.ipi_manual AND p.ipi_pct IS DISTINCT FROM 5.20;
  SELECT count(*) INTO v_revisao FROM public.navalhas_ipi_revisao;

  UPDATE public.produtos p
     SET ipi_pct = 5.20, atualizado_em = now()
   WHERE p.categoria = 'navalha'
     AND p.ipi_manual IS NOT TRUE
     AND p.ipi_pct IS DISTINCT FROM 5.20
     AND NOT EXISTS (SELECT 1 FROM public.navalhas_ipi_revisao r WHERE r.id = p.id);
  GET DIAGNOSTICS v_alterados = ROW_COUNT;

  RAISE NOTICE 'IPI das navalhas: % alteradas para 5,20%%; % já estavam em 5,20%%; % mantidas por edição manual; % cadastros em revisão (veja a visão navalhas_ipi_revisao).',
    v_alterados, v_ja_certos, v_manuais, v_revisao;
END $$;

-- ─── INSTRUÇÕES DE APLICAÇÃO ─────────────────────────────────────────────────────────────────
-- 1. Confirme que os arquivos 033 e 034 já foram aplicados.
-- 2. Supabase → SQL Editor → New query → cole TODO este arquivo → Run. Aparece "Success".
--    A mensagem com as contagens (alteradas / já em 5,20% / manuais / em revisão) fica em "Messages".
-- 3. Conferência (somente leitura):
--      SELECT count(*) FILTER (WHERE ipi_pct = 5.20) AS em_5_20, count(*) AS total FROM produtos WHERE categoria = 'navalha';
--      SELECT * FROM navalhas_ipi_revisao;
--      SELECT origem, count(*) FROM produto_ipi_historico GROUP BY origem;
-- 4. Pode ser executado de novo sem efeito colateral.

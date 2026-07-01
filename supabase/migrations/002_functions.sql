-- ============================================================
-- ERP COMERCIAL SEIBT — FUNÇÕES E TRIGGERS v1.0
-- Arquivo 2/4: Funções auxiliares + Triggers de negócio
-- ============================================================

-- ============================================================
-- FUNÇÕES AUXILIARES PARA RLS
-- (SECURITY DEFINER = bypass RLS ao consultar public.usuarios)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_perfil()
RETURNS public.perfil
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil FROM public.usuarios
  WHERE id = auth.uid() AND ativo = true AND deleted_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.get_my_pode_configurar()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(pode_configurar, false)
  FROM public.usuarios
  WHERE id = auth.uid() AND ativo = true AND deleted_at IS NULL
$$;

-- Retorna o id do representante vinculado ao usuário atual
CREATE OR REPLACE FUNCTION public.get_my_representante_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.representantes
  WHERE usuario_id = auth.uid() AND ativo = true
  LIMIT 1
$$;

-- Retorna os estados cobertos pelo representante atual
CREATE OR REPLACE FUNCTION public.get_my_estados()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(rr.estado)
  FROM public.representantes r
  JOIN public.regioes_representante rr ON rr.representante_id = r.id
  WHERE r.usuario_id = auth.uid()
    AND r.ativo = true
    AND rr.estado IS NOT NULL
$$;

-- ============================================================
-- NUMERAÇÃO ATÔMICA DE PROPOSTAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.next_proposta_numero(p_ano integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero integer;
BEGIN
  INSERT INTO public.sequencias_proposta (ano, ultimo_numero)
  VALUES (p_ano, 0)
  ON CONFLICT (ano) DO NOTHING;

  UPDATE public.sequencias_proposta
  SET    ultimo_numero = ultimo_numero + 1,
         atualizado_em = now()
  WHERE  ano = p_ano
  RETURNING ultimo_numero INTO v_numero;

  RETURN v_numero;
END;
$$;

-- ============================================================
-- TRIGGER: gerar numero_completo ao criar proposta
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_proposta_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano    integer;
  v_numero integer;
BEGIN
  v_ano := EXTRACT(YEAR FROM now())::integer;

  IF NEW.proposta_original_id IS NOT NULL AND NEW.revisao IS NOT NULL THEN
    -- Revisão: herda o número do original
    SELECT numero INTO v_numero
    FROM public.propostas
    WHERE id = NEW.proposta_original_id;

    NEW.numero        := v_numero;
    NEW.numero_completo := LPAD(v_numero::text, 4, '0')
                          || ' ' || NEW.revisao
                          || '/' || v_ano::text;
  ELSE
    -- Proposta nova: gera próximo número da sequência anual
    NEW.numero        := public.next_proposta_numero(v_ano);
    NEW.numero_completo := LPAD(NEW.numero::text, 4, '0') || '/' || v_ano::text;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER before_proposta_insert
  BEFORE INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.handle_proposta_numero();

-- ============================================================
-- TRIGGER: calcular total e desconto% dos itens
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_item_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total := NEW.quantidade
               * NEW.preco_unitario
               * (1 + COALESCE(NEW.ipi_pct, 0) / 100.0);

  IF NEW.preco_tabela IS NOT NULL AND NEW.preco_tabela > 0 THEN
    NEW.desconto_pct := ROUND(
      ((NEW.preco_tabela - NEW.preco_unitario) / NEW.preco_tabela) * 100, 2
    );
  ELSE
    NEW.desconto_pct := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER before_item_save
  BEFORE INSERT OR UPDATE ON public.itens_proposta
  FOR EACH ROW EXECUTE FUNCTION public.compute_item_totals();

-- ============================================================
-- TRIGGER: calcular volume_m3 nas fichas de frete
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_volume_frete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dimensao_comp_cm IS NOT NULL
    AND NEW.dimensao_larg_cm IS NOT NULL
    AND NEW.dimensao_alt_cm  IS NOT NULL THEN
    NEW.volume_m3 := ROUND(
      (NEW.dimensao_comp_cm * NEW.dimensao_larg_cm * NEW.dimensao_alt_cm / 1000000.0)::numeric,
      4
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_frete_save
  BEFORE INSERT OR UPDATE ON public.fichas_frete
  FOR EACH ROW EXECUTE FUNCTION public.compute_volume_frete();

-- ============================================================
-- TRIGGER: historico_precos ao reajustar produto/variante
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só registra se houve mudança real de preço
  IF OLD.preco_brl IS NOT DISTINCT FROM NEW.preco_brl
    AND OLD.preco_usd IS NOT DISTINCT FROM NEW.preco_usd THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'produtos' THEN
    INSERT INTO public.historico_precos (
      produto_id,
      preco_anterior_brl, preco_novo_brl,
      preco_anterior_usd, preco_novo_usd,
      percentual_reajuste,
      data_reajuste, reajustado_por
    ) VALUES (
      NEW.id,
      OLD.preco_brl, NEW.preco_brl,
      OLD.preco_usd, NEW.preco_usd,
      CASE
        WHEN OLD.preco_brl IS NOT NULL AND OLD.preco_brl > 0 AND NEW.preco_brl IS NOT NULL
        THEN ROUND(((NEW.preco_brl - OLD.preco_brl) / OLD.preco_brl) * 100, 2)
        ELSE NULL
      END,
      CURRENT_DATE,
      auth.uid()
    );
  END IF;

  IF TG_TABLE_NAME = 'variantes_produto' THEN
    INSERT INTO public.historico_precos (
      produto_id, variante_id,
      preco_anterior_brl, preco_novo_brl,
      preco_anterior_usd, preco_novo_usd,
      percentual_reajuste,
      data_reajuste, reajustado_por
    ) VALUES (
      NEW.produto_id, NEW.id,
      OLD.preco_brl, NEW.preco_brl,
      OLD.preco_usd, NEW.preco_usd,
      CASE
        WHEN OLD.preco_brl IS NOT NULL AND OLD.preco_brl > 0 AND NEW.preco_brl IS NOT NULL
        THEN ROUND(((NEW.preco_brl - OLD.preco_brl) / OLD.preco_brl) * 100, 2)
        ELSE NULL
      END,
      CURRENT_DATE,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_produto_price_change
  AFTER UPDATE OF preco_brl, preco_usd ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.handle_price_change();

CREATE TRIGGER on_variante_price_change
  AFTER UPDATE OF preco_brl, preco_usd ON public.variantes_produto
  FOR EACH ROW EXECUTE FUNCTION public.handle_price_change();

-- ============================================================
-- TRIGGER: criar preferências padrão ao inserir usuário
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.preferencias_usuario (usuario_id)
  VALUES (NEW.id)
  ON CONFLICT (usuario_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_usuario_created
  AFTER INSERT ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_usuario();

-- ============================================================
-- TRIGGER: atualizado_em automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER upd_clientes        BEFORE UPDATE ON public.clientes        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_leads           BEFORE UPDATE ON public.leads           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_propostas       BEFORE UPDATE ON public.propostas       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_produtos        BEFORE UPDATE ON public.produtos        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_metas           BEFORE UPDATE ON public.metas           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_funis           BEFORE UPDATE ON public.funis           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_preferencias    BEFORE UPDATE ON public.preferencias_usuario FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_rascunhos       BEFORE UPDATE ON public.rascunhos       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FUNÇÃO: atualizar último acesso (chamada pelo cliente)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_last_access()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.usuarios
  SET ultimo_acesso = now()
  WHERE id = auth.uid();
$$;

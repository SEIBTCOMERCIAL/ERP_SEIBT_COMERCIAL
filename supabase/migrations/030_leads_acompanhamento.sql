ALTER TYPE public.status_lead ADD VALUE IF NOT EXISTS 'encaminhado';
ALTER TYPE public.tipo_interesse_lead ADD VALUE IF NOT EXISTS 'mista';
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS mercado text NOT NULL DEFAULT 'nacional',
  ADD COLUMN IF NOT EXISTS encaminhado_em timestamptz,
  ADD COLUMN IF NOT EXISTS proxima_acao text,
  ADD COLUMN IF NOT EXISTS proxima_acao_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_descarte text,
  ADD COLUMN IF NOT EXISTS historico jsonb NOT NULL DEFAULT '[]';

CREATE OR REPLACE FUNCTION public.registrar_historico_lead() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.historico := OLD.historico || jsonb_build_array(jsonb_build_object(
      'data', now(), 'usuario', auth.uid(), 'status', NEW.status,
      'observacoes', NEW.observacoes, 'representante_id', NEW.representante_id,
      'proxima_acao', NEW.proxima_acao, 'proxima_acao_em', NEW.proxima_acao_em,
      'motivo_descarte', NEW.motivo_descarte));
  ELSE
    NEW.historico := jsonb_build_array(jsonb_build_object('data', now(), 'usuario', auth.uid(), 'status', NEW.status, 'observacoes', NEW.observacoes));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER leads_historico BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_lead();

-- Transação única: a falha em qualquer etapa desfaz toda a conversão.
CREATE OR REPLACE FUNCTION public.converter_lead(p_lead uuid, p_cliente uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE l public.leads; destino uuid;
BEGIN
  SELECT * INTO l FROM public.leads WHERE id = p_lead AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT (get_my_perfil() = 'admin' OR (get_my_perfil() = 'vendedor_interno' AND l.responsavel_id = auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão para converter este lead';
  END IF;
  IF l.cliente_id IS NOT NULL THEN RETURN l.cliente_id; END IF;
  IF l.status <> 'qualificado' THEN RAISE EXCEPTION 'Qualifique o lead antes de converter'; END IF;
  IF p_cliente IS NOT NULL THEN
    SELECT id INTO destino FROM public.clientes WHERE id = p_cliente AND deleted_at IS NULL;
    IF destino IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  ELSE
    IF nullif(trim(l.empresa_nome), '') IS NULL THEN RAISE EXCEPTION 'Informe a empresa'; END IF;
    IF EXISTS (SELECT 1 FROM public.clientes WHERE deleted_at IS NULL AND lower(trim(razao_social)) = lower(trim(l.empresa_nome))) THEN
      RAISE EXCEPTION 'Já existe cliente com esse nome. Selecione o cadastro existente';
    END IF;
    INSERT INTO public.clientes(razao_social, segmento, porte, status, pais, cidade, estado, responsavel_id, representante_id, criado_por)
    VALUES(l.empresa_nome, 'outro', 'pequeno', 'prospect', CASE WHEN l.mercado = 'nacional' THEN 'Brasil' ELSE 'Não informado' END, l.cidade, l.estado, l.responsavel_id, l.representante_id, auth.uid()) RETURNING id INTO destino;
    IF nullif(trim(l.contato_nome), '') IS NOT NULL THEN
      INSERT INTO public.contatos_cliente(cliente_id, nome, telefone, email, principal)
      VALUES(destino, l.contato_nome, l.contato_telefone, l.contato_email, true);
    END IF;
  END IF;
  UPDATE public.leads SET cliente_id = destino, status = 'convertido', proxima_acao = NULL, proxima_acao_em = NULL WHERE id = l.id;
  RETURN destino;
END; $$;
REVOKE ALL ON FUNCTION public.converter_lead(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.converter_lead(uuid, uuid) TO authenticated;

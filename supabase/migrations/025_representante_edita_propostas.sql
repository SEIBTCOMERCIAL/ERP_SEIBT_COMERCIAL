-- O representante que acompanha a proposta (representante_id) passa a poder alterá-la:
-- mover de etapa, mudar status e editar itens. Antes ele só podia ver, registrar follow-up e anexar.
-- Vale só para propostas em que ele foi escolhido como representante; as que ele vê apenas pela região
-- (estado ou cliente) continuam somente leitura. Não permite excluir (a exclusão é só do administrador).

DROP POLICY IF EXISTS "propostas_representante_update" ON public.propostas;
CREATE POLICY "propostas_representante_update" ON public.propostas
  FOR UPDATE TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND deleted_at IS NULL
    AND representante_id = get_my_representante_id()
  )
  WITH CHECK (
    get_my_perfil() = 'representante'
    AND deleted_at IS NULL
    AND representante_id = get_my_representante_id()
  );

DROP POLICY IF EXISTS "itens_representante_write" ON public.itens_proposta;
CREATE POLICY "itens_representante_write" ON public.itens_proposta
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_id AND p.deleted_at IS NULL
        AND p.representante_id = get_my_representante_id()
    )
  )
  WITH CHECK (
    get_my_perfil() = 'representante'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_id AND p.deleted_at IS NULL
        AND p.representante_id = get_my_representante_id()
    )
  );

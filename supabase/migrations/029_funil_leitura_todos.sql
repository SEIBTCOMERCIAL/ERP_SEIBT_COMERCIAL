-- Todo usuário logado (representante, engenharia etc.) passa a poder LER o funil geral e suas etapas.
-- Antes só o administrador e o vendedor interno enxergavam as etapas: para o representante o quadro
-- de propostas abria sem colunas. Só leitura; quem cria/edita etapas continua sendo o administrador.

DROP POLICY IF EXISTS "funis_leitura_geral" ON public.funis;
CREATE POLICY "funis_leitura_geral" ON public.funis
  FOR SELECT TO authenticated
  USING (usuario_id IS NULL);

DROP POLICY IF EXISTS "etapas_leitura_geral" ON public.etapas_funil;
CREATE POLICY "etapas_leitura_geral" ON public.etapas_funil
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funis f
      WHERE f.id = funil_id AND f.usuario_id IS NULL
    )
  );

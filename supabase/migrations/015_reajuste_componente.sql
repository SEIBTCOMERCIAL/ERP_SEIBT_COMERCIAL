-- Componente do reajuste (moinho, painel_220, painel_380) — null para peças
ALTER TABLE public.historico_precos ADD COLUMN IF NOT EXISTS componente text;

-- Páginas visíveis por usuário (array de hrefs; vazio = sem restrição = usa perfil)
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS paginas_visiveis text[] DEFAULT '{}';

-- RLS: somente admin pode gravar no historico_precos
DROP POLICY IF EXISTS "historico_precos_admin_escreve" ON public.historico_precos;
CREATE POLICY "historico_precos_admin_escreve" ON public.historico_precos
  FOR INSERT WITH CHECK (get_my_perfil() = 'admin');

DROP POLICY IF EXISTS "historico_precos_admin_atualiza" ON public.historico_precos;
CREATE POLICY "historico_precos_admin_atualiza" ON public.historico_precos
  FOR UPDATE USING (get_my_perfil() = 'admin');

DROP POLICY IF EXISTS "historico_precos_admin_exclui" ON public.historico_precos;
CREATE POLICY "historico_precos_admin_exclui" ON public.historico_precos
  FOR DELETE USING (get_my_perfil() = 'admin');

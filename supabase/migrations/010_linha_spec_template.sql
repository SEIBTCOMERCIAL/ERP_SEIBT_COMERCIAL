-- 010_linha_spec_template.sql
-- Adiciona descricao_painel em produtos e cria tabela de template de specs por linha

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS descricao_painel text;

CREATE TABLE IF NOT EXISTS public.linha_spec_campos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linha_id   uuid NOT NULL REFERENCES public.linhas(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  ordem      integer NOT NULL DEFAULT 0,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(linha_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_lsc_linha_id ON public.linha_spec_campos(linha_id, ordem);

ALTER TABLE public.linha_spec_campos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lsc_select"  ON public.linha_spec_campos;
DROP POLICY IF EXISTS "lsc_insert"  ON public.linha_spec_campos;
DROP POLICY IF EXISTS "lsc_update"  ON public.linha_spec_campos;
DROP POLICY IF EXISTS "lsc_delete"  ON public.linha_spec_campos;

CREATE POLICY "lsc_select"  ON public.linha_spec_campos FOR SELECT TO authenticated USING (true);
CREATE POLICY "lsc_insert"  ON public.linha_spec_campos FOR INSERT TO authenticated WITH CHECK (get_my_perfil() = 'admin');
CREATE POLICY "lsc_update"  ON public.linha_spec_campos FOR UPDATE TO authenticated USING (get_my_perfil() = 'admin');
CREATE POLICY "lsc_delete"  ON public.linha_spec_campos FOR DELETE TO authenticated USING (get_my_perfil() = 'admin');

-- Seed: 12 campos para linhas A2, BSC, LRX (case-insensitive)
WITH campos(nome, ordem) AS (
  VALUES
    ('Bocal de alimentação (mm)',  1),
    ('Câmara de moagem (mm)',       2),
    ('Diâmetro do rotor (mm)',      3),
    ('Motor (cv)',                  4),
    ('Produção (kg/h)',             5),
    ('Navalhas rotativas (un.)',    6),
    ('Navalhas fixas (un.)',        7),
    ('Rotação do rotor (rpm)',      8),
    ('Altura de alimentação',       9),
    ('Peneira padrão (Ømm)',       10),
    ('Área ocupada (mm)',          11),
    ('Peso (kg)',                  12)
)
INSERT INTO public.linha_spec_campos (linha_id, nome, ordem)
SELECT l.id, c.nome, c.ordem
FROM   public.linhas l
CROSS  JOIN campos c
WHERE  l.nome ILIKE ANY(ARRAY['%BSC%','%A2%','%LRX%'])
ON CONFLICT (linha_id, nome) DO NOTHING;

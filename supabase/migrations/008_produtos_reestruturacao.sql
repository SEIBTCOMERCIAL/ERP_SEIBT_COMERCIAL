-- Migration 008: Reestruturação /produtos — Linhas, Categorias de Peça, Preços de Painel, Arquivos

-- ─── Tabelas novas ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.linhas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  ordem      int  NOT NULL DEFAULT 0,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES public.usuarios(id)
);

CREATE TABLE IF NOT EXISTS public.categorias_peca (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  ordem      int  NOT NULL DEFAULT 0,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES public.usuarios(id)
);

CREATE TABLE IF NOT EXISTS public.produto_arquivos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id   uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('imagem', 'desenho')),
  nome         text NOT NULL,
  url          text NOT NULL,
  storage_path text,
  ordem        int  NOT NULL DEFAULT 0,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compatibilidades_equip (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peca_id        uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  UNIQUE(peca_id, equipamento_id)
);

-- ─── Novos campos em produtos ────────────────────────────────────────────────

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS linha_id          uuid REFERENCES public.linhas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_peca_id uuid REFERENCES public.categorias_peca(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preco_painel_220  numeric,
  ADD COLUMN IF NOT EXISTS preco_painel_380  numeric;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.linhas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_peca        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_arquivos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibilidades_equip ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "linhas_todos_leem"    ON public.linhas;
DROP POLICY IF EXISTS "linhas_admin_escreve" ON public.linhas;
CREATE POLICY "linhas_todos_leem"    ON public.linhas FOR SELECT USING (get_my_perfil() IS NOT NULL);
CREATE POLICY "linhas_admin_escreve" ON public.linhas FOR ALL    USING (get_my_perfil() = 'admin');

DROP POLICY IF EXISTS "catpeca_todos_leem"    ON public.categorias_peca;
DROP POLICY IF EXISTS "catpeca_admin_escreve" ON public.categorias_peca;
CREATE POLICY "catpeca_todos_leem"    ON public.categorias_peca FOR SELECT USING (get_my_perfil() IS NOT NULL);
CREATE POLICY "catpeca_admin_escreve" ON public.categorias_peca FOR ALL    USING (get_my_perfil() = 'admin');

DROP POLICY IF EXISTS "parquivos_todos_leem"    ON public.produto_arquivos;
DROP POLICY IF EXISTS "parquivos_admin_escreve" ON public.produto_arquivos;
CREATE POLICY "parquivos_todos_leem"    ON public.produto_arquivos FOR SELECT USING (get_my_perfil() IS NOT NULL);
CREATE POLICY "parquivos_admin_escreve" ON public.produto_arquivos FOR ALL    USING (get_my_perfil() = 'admin');

DROP POLICY IF EXISTS "cequip_todos_leem"    ON public.compatibilidades_equip;
DROP POLICY IF EXISTS "cequip_admin_escreve" ON public.compatibilidades_equip;
CREATE POLICY "cequip_todos_leem"    ON public.compatibilidades_equip FOR SELECT USING (get_my_perfil() IS NOT NULL);
CREATE POLICY "cequip_admin_escreve" ON public.compatibilidades_equip FOR ALL    USING (get_my_perfil() = 'admin');

-- Representante: leitura de produtos (estava faltando)
DROP POLICY IF EXISTS "produtos_representante_read" ON public.produtos;
CREATE POLICY "produtos_representante_read" ON public.produtos
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'representante' AND deleted_at IS NULL);

-- historico_precos: todos os perfis leem
DROP POLICY IF EXISTS "historico_todos_leem" ON public.historico_precos;
CREATE POLICY "historico_todos_leem" ON public.historico_precos
  FOR SELECT USING (get_my_perfil() IS NOT NULL);

-- ─── Storage bucket: produto-arquivos ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'produto-arquivos', 'produto-arquivos', true, 52428800,
       ARRAY['image/jpeg','image/png','image/webp','application/pdf']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'produto-arquivos');

DROP POLICY IF EXISTS "prod_arq_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "prod_arq_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "prod_arq_admin_delete" ON storage.objects;

CREATE POLICY "prod_arq_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produto-arquivos');

CREATE POLICY "prod_arq_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'produto-arquivos' AND get_my_perfil() = 'admin');

CREATE POLICY "prod_arq_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'produto-arquivos' AND get_my_perfil() = 'admin');

-- ─── Seed: Linhas ────────────────────────────────────────────────────────────

INSERT INTO public.linhas (nome, ordem) VALUES
  ('MGHS', 1), ('TPS', 2), ('TS', 3), ('ES', 4), ('AS', 5)
ON CONFLICT (nome) DO NOTHING;

UPDATE public.produtos p
SET    linha_id = l.id
FROM   public.linhas l
WHERE  upper(trim(p.linha)) = upper(trim(l.nome))
  AND  p.categoria = 'maquina'
  AND  p.deleted_at IS NULL
  AND  p.linha_id IS NULL;

-- ─── Seed: Categorias de peça ────────────────────────────────────────────────

INSERT INTO public.categorias_peca (nome, ordem) VALUES
  ('Navalhas', 1), ('Peneiras', 2), ('Rolamentos', 3),
  ('Parafusos', 4), ('Rotores', 5), ('Insertos', 6)
ON CONFLICT (nome) DO NOTHING;

UPDATE public.produtos p
SET    categoria_peca_id = cp.id
FROM   public.categorias_peca cp
WHERE (
  (p.categoria = 'navalha'   AND cp.nome = 'Navalhas')  OR
  (p.categoria = 'peneira'   AND cp.nome = 'Peneiras')  OR
  (p.categoria = 'rolamento' AND cp.nome = 'Rolamentos') OR
  (p.categoria = 'parafuso'  AND cp.nome = 'Parafusos') OR
  (p.categoria = 'rotor'     AND cp.nome = 'Rotores')   OR
  (p.categoria = 'inserto'   AND cp.nome = 'Insertos')
)
AND p.deleted_at IS NULL
AND p.categoria_peca_id IS NULL;

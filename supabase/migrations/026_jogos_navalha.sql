-- Jogos de navalhas por equipamento: cada jogo reúne as linhas do orçamento (navalhas rotoras esquerda/direita,
-- navalha fixa...) com o número de peças e o código de cada uma. Um equipamento pode ter vários jogos,
-- por exemplo de materiais diferentes, e o vendedor escolhe qual cotar. Os preços continuam vindo do
-- cadastro da peça (nunca digitados aqui). Aditiva: não altera os vínculos nem as peças existentes.

CREATE TABLE IF NOT EXISTS public.jogos_navalha (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome           text NOT NULL DEFAULT 'Padrão',
  material       text,
  ordem          integer NOT NULL DEFAULT 0,
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jogos_navalha_equipamento ON public.jogos_navalha(equipamento_id, ordem);

CREATE TABLE IF NOT EXISTS public.jogos_navalha_itens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id    uuid NOT NULL REFERENCES public.jogos_navalha(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  titulo     text NOT NULL,
  pecas      integer NOT NULL DEFAULT 1 CHECK (pecas > 0),
  codigo     text,
  ordem      integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_jogos_navalha_itens_jogo ON public.jogos_navalha_itens(jogo_id, ordem);

ALTER TABLE public.jogos_navalha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogos_navalha_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jogos_navalha_leitura" ON public.jogos_navalha;
CREATE POLICY "jogos_navalha_leitura" ON public.jogos_navalha FOR SELECT USING (public.get_my_perfil() IS NOT NULL);
DROP POLICY IF EXISTS "jogos_navalha_admin" ON public.jogos_navalha;
CREATE POLICY "jogos_navalha_admin" ON public.jogos_navalha FOR ALL
  USING (public.get_my_perfil() = 'admin') WITH CHECK (public.get_my_perfil() = 'admin');

DROP POLICY IF EXISTS "jogos_navalha_itens_leitura" ON public.jogos_navalha_itens;
CREATE POLICY "jogos_navalha_itens_leitura" ON public.jogos_navalha_itens FOR SELECT USING (public.get_my_perfil() IS NOT NULL);
DROP POLICY IF EXISTS "jogos_navalha_itens_admin" ON public.jogos_navalha_itens;
CREATE POLICY "jogos_navalha_itens_admin" ON public.jogos_navalha_itens FOR ALL
  USING (public.get_my_perfil() = 'admin') WITH CHECK (public.get_my_perfil() = 'admin');

-- Carga inicial: um jogo "Padrão" por equipamento, montado a partir das navalhas já vinculadas.
--   Navalha fixa            → "NAVALHA FIXA <modelo>"
--   Navalha rotora (código "A/ B") → duas linhas: "NAVALHAS ROTORAS ESQ. MOINHO <modelo>" (código A)
--                                    e "NAVALHAS ROTORAS DIR. MOINHO <modelo>" (código B), metade das peças em cada.
--   Rotora de código único  → "NAVALHAS ROTORAS MOINHO <modelo>"
-- Só roda para equipamentos que ainda não têm jogo cadastrado.
DO $$
DECLARE
  eq     record;
  v      record;
  j      uuid;
  modelo text;
  qtd    integer;
  cod1   text;
  cod2   text;
  n      integer;
BEGIN
  FOR eq IN
    SELECT DISTINCT c.equipamento_id
      FROM public.compatibilidades_equip c
      JOIN public.produtos p ON p.id = c.peca_id
     WHERE p.categoria = 'navalha' AND p.deleted_at IS NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.jogos_navalha WHERE equipamento_id = eq.equipamento_id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.jogos_navalha (equipamento_id, nome, ordem)
    VALUES (eq.equipamento_id, 'Padrão', 1)
    RETURNING id INTO j;

    n := 0;
    FOR v IN
      SELECT c.quantidade, p.id AS pid, p.codigo, p.descricao
        FROM public.compatibilidades_equip c
        JOIN public.produtos p ON p.id = c.peca_id
       WHERE c.equipamento_id = eq.equipamento_id
         AND p.categoria = 'navalha' AND p.deleted_at IS NULL
       ORDER BY (p.descricao ~* '^NAVALHA\s+FIXA\s') DESC, p.descricao
    LOOP
      modelo := trim(regexp_replace(v.descricao, '^NAVALHA\s+(FIXA|ROTORA|ROTATIVA)\s+', '', 'i'));
      qtd := GREATEST(COALESCE(v.quantidade, 1), 1);

      IF v.descricao ~* '^NAVALHA\s+FIXA\s' THEN
        n := n + 1;
        INSERT INTO public.jogos_navalha_itens (jogo_id, produto_id, titulo, pecas, codigo, ordem)
        VALUES (j, v.pid, 'NAVALHA FIXA ' || modelo, qtd, trim(v.codigo), n);

      ELSIF v.descricao ~* '^NAVALHA\s+ROT(ORA|ATIVA)\s' THEN
        IF position('/' IN v.codigo) > 0 AND qtd >= 2 THEN
          cod1 := trim(split_part(v.codigo, '/', 1));
          cod2 := trim(split_part(v.codigo, '/', 2));
          n := n + 1;
          INSERT INTO public.jogos_navalha_itens (jogo_id, produto_id, titulo, pecas, codigo, ordem)
          VALUES (j, v.pid, 'NAVALHAS ROTORAS ESQ. MOINHO ' || modelo, (qtd + 1) / 2, cod1, n);
          n := n + 1;
          INSERT INTO public.jogos_navalha_itens (jogo_id, produto_id, titulo, pecas, codigo, ordem)
          VALUES (j, v.pid, 'NAVALHAS ROTORAS DIR. MOINHO ' || modelo, qtd / 2, cod2, n);
        ELSE
          n := n + 1;
          INSERT INTO public.jogos_navalha_itens (jogo_id, produto_id, titulo, pecas, codigo, ordem)
          VALUES (j, v.pid, 'NAVALHAS ROTORAS MOINHO ' || modelo, qtd, trim(v.codigo), n);
        END IF;

      ELSE
        n := n + 1;
        INSERT INTO public.jogos_navalha_itens (jogo_id, produto_id, titulo, pecas, codigo, ordem)
        VALUES (j, v.pid, v.descricao, qtd, trim(v.codigo), n);
      END IF;
    END LOOP;
  END LOOP;
END $$;

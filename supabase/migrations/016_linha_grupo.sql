-- Migration 016: agrupamento de linhas por família
--
-- Com o catálogo completo carregado, o número de linhas passou de 1 para ~49.
-- A tela de Produtos ficava com uma grade única de 49 cards sem hierarquia.
-- O grupo dá o nível de cima: Moagem, Reciclagem, Transporte, Extrusão,
-- Auxiliares e Linhas Completas.

ALTER TABLE public.linhas
  ADD COLUMN IF NOT EXISTS grupo       text,
  ADD COLUMN IF NOT EXISTS grupo_ordem int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_linhas_grupo ON public.linhas(grupo_ordem, ordem);

COMMENT ON COLUMN public.linhas.grupo IS
  'Família da linha (Moagem, Reciclagem, Transporte, Extrusão, Auxiliares, Linhas Completas). Nulo = aparece em "Sem família".';
COMMENT ON COLUMN public.linhas.grupo_ordem IS
  'Ordem de exibição da família na tela de Produtos.';

-- 019_modo_catalogo_linha.sql
-- Permite marcar cada linha como "completo" (foto + preço + especificações,
-- usada no Catálogo) ou "lista" (linha compacta, sem foto/specs) na visão
-- "Catálogo completo". Ponto de partida: Moagem = completo, resto = lista
-- (o Administrador pode trocar qualquer linha depois, pela tela).
-- Executado manualmente pelo Lucas no SQL Editor da Supabase em 2026-09-18.

ALTER TABLE public.linhas
  ADD COLUMN IF NOT EXISTS modo_catalogo text NOT NULL DEFAULT 'completo'
  CHECK (modo_catalogo IN ('completo', 'lista'));

UPDATE public.linhas
SET modo_catalogo = 'lista'
WHERE grupo IS DISTINCT FROM 'Moagem';

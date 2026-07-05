-- Migration 009: Campo status nos produtos (ativo / descontinuado)

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'descontinuado'));

-- Garante que todos os existentes tenham 'ativo'
UPDATE public.produtos SET status = 'ativo' WHERE status IS NULL;

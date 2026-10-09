-- Item que dá nome à proposta ("cabeçalho"): aparece no topo da proposta, no cartão do funil e no nome
-- do arquivo Word. Sem item marcado, o sistema usa o moinho da proposta (ou o primeiro equipamento).
-- Aditiva: não altera nenhum item existente.

ALTER TABLE public.itens_proposta
  ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false;

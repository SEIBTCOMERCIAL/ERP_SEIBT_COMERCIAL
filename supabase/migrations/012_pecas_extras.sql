-- Quantidade por vínculo equipamento-peça (ex: 2 navalhas por máquina)
ALTER TABLE public.compatibilidades_equip ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 1;

-- Diâmetro do furo para peneiras
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS furo_diametro text;

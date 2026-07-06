ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS solicitar_engenharia boolean NOT NULL DEFAULT false;

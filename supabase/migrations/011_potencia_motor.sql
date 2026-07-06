-- 011_potencia_motor.sql
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS potencia_motor text;

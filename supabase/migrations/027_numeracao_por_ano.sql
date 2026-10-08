-- Numeração das propostas por ano, com formato configurável em cada ano.
--   2026 (ano especial): SB01/2026, SB02/2026, SB03/2026 ... (prefixo "SB", 2 dígitos)
--   Demais anos (padrão): 0001/2027, 0002/2027 ... (sem prefixo, 4 dígitos), reiniciando todo ano.
-- Para outro ano ter formato especial, basta alterar a linha daquele ano na tabela sequencias_proposta.

ALTER TABLE public.sequencias_proposta
  ADD COLUMN IF NOT EXISTS prefixo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS digitos integer NOT NULL DEFAULT 4 CHECK (digitos BETWEEN 1 AND 8);

-- 2026: formato SB01/2026 e recomeço da contagem (as propostas antigas de 2026 foram apagadas;
-- as que ainda existirem mantêm o número que já têm).
INSERT INTO public.sequencias_proposta (ano, ultimo_numero, prefixo, digitos)
VALUES (2026, 0, 'SB', 2)
ON CONFLICT (ano) DO UPDATE
  SET prefixo = 'SB', digitos = 2, ultimo_numero = 0, atualizado_em = now();

-- O número completo passa a seguir o prefixo e os dígitos configurados para o ano.
CREATE OR REPLACE FUNCTION public.handle_proposta_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano     integer;
  v_numero  integer;
  v_prefixo text;
  v_digitos integer;
BEGIN
  v_ano := EXTRACT(YEAR FROM now())::integer;

  IF NEW.proposta_original_id IS NOT NULL AND NEW.revisao IS NOT NULL THEN
    -- Revisão: herda o número do original
    SELECT numero INTO v_numero
    FROM public.propostas
    WHERE id = NEW.proposta_original_id;

    SELECT prefixo, digitos INTO v_prefixo, v_digitos
    FROM public.sequencias_proposta WHERE ano = v_ano;

    NEW.numero          := v_numero;
    NEW.numero_completo := COALESCE(v_prefixo, '') || LPAD(v_numero::text, COALESCE(v_digitos, 4), '0')
                          || ' ' || NEW.revisao
                          || '/' || v_ano::text;
  ELSE
    -- Proposta nova: próximo número da sequência do ano (cria a linha do ano se ainda não existir)
    NEW.numero := public.next_proposta_numero(v_ano);

    SELECT prefixo, digitos INTO v_prefixo, v_digitos
    FROM public.sequencias_proposta WHERE ano = v_ano;

    NEW.numero_completo := COALESCE(v_prefixo, '') || LPAD(NEW.numero::text, COALESCE(v_digitos, 4), '0')
                          || '/' || v_ano::text;
  END IF;

  RETURN NEW;
END;
$$;

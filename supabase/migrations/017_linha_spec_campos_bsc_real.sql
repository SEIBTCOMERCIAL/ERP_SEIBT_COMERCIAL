-- 017_linha_spec_campos_bsc_real.sql
-- A migração 010 tentou semear linha_spec_campos para linhas com nome
-- contendo 'BSC'/'A2'/'LRX', mas as linhas reais da base atual se chamam
-- "Linha BSC" / "Linha BSC BR" (criadas depois, pela carga do catálogo) e a
-- migração 010 não encontrou nenhuma linha correspondente na época — o
-- resultado é 0 linhas em linha_spec_campos para elas até hoje, mesmo com os
-- produtos já tendo os 12 valores certos em produtos.specs.
--
-- Os nomes abaixo usam exatamente a grafia (maiúsculas/acentos) já presente
-- em produtos.specs hoje, porque a busca do valor é por igualdade exata da
-- chave.

WITH campos(nome, ordem) AS (
  VALUES
    ('BOCAL DE ALIMENTAÇÃO (mm)',   1),
    ('CÂMARA DE MOAGEM (mm)',       2),
    ('DIÂMETRO DO ROTOR (mm)',      3),
    ('MOTOR (cv)',                  4),
    ('PRODUÇÃO (kg/h)',             5),
    ('NAVALHAS ROTATIVAS (un.)',    6),
    ('NAVALHAS FIXAS (un.)',        7),
    ('ROTAÇÃO DO ROTOR (rpm)',      8),
    ('ALTURA DE ALIMENTAÇÃO (mm)',  9),
    ('PENEIRA PADRÃO (Ømm)',       10),
    ('ÁREA OCUPADA (mm)',          11),
    ('PESO (kg)',                  12)
)
INSERT INTO public.linha_spec_campos (linha_id, nome, ordem)
SELECT l.id, c.nome, c.ordem
FROM   public.linhas l
CROSS  JOIN campos c
WHERE  l.nome IN ('Linha BSC', 'Linha BSC BR')
ON CONFLICT (linha_id, nome) DO NOTHING;

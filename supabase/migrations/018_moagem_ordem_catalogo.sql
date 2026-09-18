-- 018_moagem_ordem_catalogo.sql
-- Reorganiza o grupo "Moagem" com a ordem de exibição pedida pelo Lucas pro
-- Catálogo (que também é usada na tela de Produtos, já que é o mesmo campo
-- linhas.grupo/ordem). Move para dentro de "Moagem" algumas linhas que
-- estavam em Auxiliares/Extrusão/Reciclagem (Exaustores, Silos, Cabines,
-- Soft Starters, Reservatórios de Moído, Carenagens, Extrusora, Aglutinador,
-- Separador de Pó, Separador de Fibras, Guilhotina).

WITH ordem_moagem(nome, ordem) AS (
  VALUES
    ('Linha BSC BR',           1),
    ('Linha LR',               2),
    ('Linha LRX',              3),
    ('Linha A',                4),
    ('Linha N',                5),
    ('Linha BSC',              6),
    ('Linha A2',               7),
    ('Exaustores',             8),
    ('Silos',                  9),
    ('Cabines',                10),
    ('Soft Starters',          11),
    ('Reservatórios de Moído', 12),
    ('Carenagens',             13),
    ('Triturador TPS',         14),
    ('Triturador TS',          15),
    ('Moinho para Tubos',      16),
    ('TFV',                    17),
    ('MGHS E',                 18),
    ('RCX',                    19),
    ('PS',                     20),
    ('Extrusora',              21),
    ('Aglutinador',            22),
    ('Separador de Pó',        23),
    ('Separador de Fibras',    24),
    ('Guilhotina',             25)
)
UPDATE public.linhas l
SET    grupo = 'Moagem',
       ordem = om.ordem
FROM   ordem_moagem om
WHERE  l.nome = om.nome;

-- 020_specs_padroniza_e_modelos_por_linha.sql
-- Já aplicado em produção em 2026-09-23 (via script, mesmo efeito deste SQL).
--
-- 1) Padroniza a grafia de 2 campos técnicos nas máquinas (os valores não mudam),
--    pra cada campo ter um nome só — o "modelo de campos" da linha e o catálogo
--    buscam o valor pelo nome exato. Não mexe em máquina que já tem as duas
--    grafias (nesse caso são campos diferentes, ex.: RCX).
UPDATE public.produtos
SET    specs = (specs - 'ALTURA DE ALIMENTAÇÃO(mm)')
             || jsonb_build_object('ALTURA DE ALIMENTAÇÃO (mm)', specs -> 'ALTURA DE ALIMENTAÇÃO(mm)')
WHERE  categoria = 'maquina'
  AND  specs ? 'ALTURA DE ALIMENTAÇÃO(mm)'
  AND  NOT specs ? 'ALTURA DE ALIMENTAÇÃO (mm)';

UPDATE public.produtos
SET    specs = (specs - 'ÁREA OCUPADA C/ CICLONETE')
             || jsonb_build_object('ÁREA OCUPADA C/ CICLONETE (mm)', specs -> 'ÁREA OCUPADA C/ CICLONETE')
WHERE  categoria = 'maquina'
  AND  specs ? 'ÁREA OCUPADA C/ CICLONETE'
  AND  NOT specs ? 'ÁREA OCUPADA C/ CICLONETE (mm)';

-- 2) Cria o modelo de campos técnicos (linha_spec_campos) das linhas que tinham
--    dados nas máquinas mas nenhum modelo — sem modelo, a aba "Especificações" do
--    equipamento mostrava "Nenhum template configurado" e o catálogo não trazia a
--    tabela técnica. Os campos são exatamente os que já existem nas máquinas.
WITH modelo(linha, nome, ordem) AS (
  VALUES
    -- 12 campos padrão
    ('Linha A2','BOCAL DE ALIMENTAÇÃO (mm)',1),('Linha A2','CÂMARA DE MOAGEM (mm)',2),('Linha A2','DIÂMETRO DO ROTOR (mm)',3),('Linha A2','MOTOR (cv)',4),('Linha A2','PRODUÇÃO (kg/h)',5),('Linha A2','NAVALHAS ROTATIVAS (un.)',6),('Linha A2','NAVALHAS FIXAS (un.)',7),('Linha A2','ROTAÇÃO DO ROTOR (rpm)',8),('Linha A2','ALTURA DE ALIMENTAÇÃO (mm)',9),('Linha A2','PENEIRA PADRÃO (Ømm)',10),('Linha A2','ÁREA OCUPADA (mm)',11),('Linha A2','PESO (kg)',12),
    ('Linha A','BOCAL DE ALIMENTAÇÃO (mm)',1),('Linha A','CÂMARA DE MOAGEM (mm)',2),('Linha A','DIÂMETRO DO ROTOR (mm)',3),('Linha A','MOTOR (cv)',4),('Linha A','PRODUÇÃO (kg/h)',5),('Linha A','NAVALHAS ROTATIVAS (un.)',6),('Linha A','NAVALHAS FIXAS (un.)',7),('Linha A','ROTAÇÃO DO ROTOR (rpm)',8),('Linha A','ALTURA DE ALIMENTAÇÃO (mm)',9),('Linha A','PENEIRA PADRÃO (Ømm)',10),('Linha A','ÁREA OCUPADA (mm)',11),('Linha A','PESO (kg)',12),
    ('Linha N','BOCAL DE ALIMENTAÇÃO (mm)',1),('Linha N','CÂMARA DE MOAGEM (mm)',2),('Linha N','DIÂMETRO DO ROTOR (mm)',3),('Linha N','MOTOR (cv)',4),('Linha N','PRODUÇÃO (kg/h)',5),('Linha N','NAVALHAS ROTATIVAS (un.)',6),('Linha N','NAVALHAS FIXAS (un.)',7),('Linha N','ROTAÇÃO DO ROTOR (rpm)',8),('Linha N','ALTURA DE ALIMENTAÇÃO (mm)',9),('Linha N','PENEIRA PADRÃO (Ømm)',10),('Linha N','ÁREA OCUPADA (mm)',11),('Linha N','PESO (kg)',12),
    -- TFV: padrão sem peneira + bocal auxiliar
    ('TFV','BOCAL DE ALIMENTAÇÃO (mm)',1),('TFV','CÂMARA DE MOAGEM (mm)',2),('TFV','DIÂMETRO DO ROTOR (mm)',3),('TFV','MOTOR (cv)',4),('TFV','PRODUÇÃO (kg/h)',5),('TFV','NAVALHAS ROTATIVAS (un.)',6),('TFV','NAVALHAS FIXAS (un.)',7),('TFV','ROTAÇÃO DO ROTOR (rpm)',8),('TFV','ALTURA DE ALIMENTAÇÃO (mm)',9),('TFV','ÁREA OCUPADA (mm)',10),('TFV','PESO (kg)',11),('TFV','BOCAL DE ALIMENTAÇÃO AUX. (mm)',12),
    -- MGHS E: padrão sem peneira
    ('MGHS E','BOCAL DE ALIMENTAÇÃO (mm)',1),('MGHS E','CÂMARA DE MOAGEM (mm)',2),('MGHS E','DIÂMETRO DO ROTOR (mm)',3),('MGHS E','MOTOR (cv)',4),('MGHS E','PRODUÇÃO (kg/h)',5),('MGHS E','NAVALHAS ROTATIVAS (un.)',6),('MGHS E','NAVALHAS FIXAS (un.)',7),('MGHS E','ROTAÇÃO DO ROTOR (rpm)',8),('MGHS E','ALTURA DE ALIMENTAÇÃO (mm)',9),('MGHS E','ÁREA OCUPADA (mm)',10),('MGHS E','PESO (kg)',11),
    -- LR / LRX: com gaveta / ciclonete / exaustor
    ('Linha LR','BOCAL DE ALIMENTAÇÃO (mm)',1),('Linha LR','CÂMARA DE MOAGEM (mm)',2),('Linha LR','DIÂMETRO DO ROTOR (mm)',3),('Linha LR','MOTOR (cv)',4),('Linha LR','PRODUÇÃO (kg/h)',5),('Linha LR','NAVALHAS ROTATIVAS (un.)',6),('Linha LR','NAVALHAS FIXAS (un.)',7),('Linha LR','ROTAÇÃO DO ROTOR (rpm)',8),('Linha LR','ALTURA DE ALIMENTAÇÃO (mm)',9),('Linha LR','PENEIRA PADRÃO (Ømm)',10),('Linha LR','ALTURA C/ CICLONETE (mm)',11),('Linha LR','ALTURA C/ GAVETA (mm)',12),('Linha LR','ÁREA OCUPADA C/ GAVETA (mm)',13),('Linha LR','MOTOR DO EXAUSTOR (cv)',14),('Linha LR','PESO C/ EXAUSTOR E CICLONETE (kg)',15),('Linha LR','ÁREA OCUPADA C/ CICLONETE (mm)',16),
    ('Linha LRX','BOCAL DE ALIMENTAÇÃO (mm)',1),('Linha LRX','CÂMARA DE MOAGEM (mm)',2),('Linha LRX','DIÂMETRO DO ROTOR (mm)',3),('Linha LRX','MOTOR (cv)',4),('Linha LRX','PRODUÇÃO (kg/h)',5),('Linha LRX','NAVALHAS ROTATIVAS (un.)',6),('Linha LRX','NAVALHAS FIXAS (un.)',7),('Linha LRX','ROTAÇÃO DO ROTOR (rpm)',8),('Linha LRX','ALTURA DE ALIMENTAÇÃO (mm)',9),('Linha LRX','PENEIRA PADRÃO (Ømm)',10),('Linha LRX','ALTURA C/ CICLONETE (mm)',11),('Linha LRX','ALTURA C/ GAVETA (mm)',12),('Linha LRX','ÁREA OCUPADA C/ GAVETA (mm)',13),('Linha LRX','MOTOR DO EXAUSTOR (cv)',14),('Linha LRX','PESO C/ EXAUSTOR E CICLONETE (kg)',15),('Linha LRX','ÁREA OCUPADA C/ CICLONETE (mm)',16),
    -- RCX: campos próprios (duas grafias de motor/produção são campos distintos)
    ('RCX','BOCAL DE ALIMENTAÇÃO (mm)',1),('RCX','CÂMARA DE MOAGEM (mm)',2),('RCX','DIÂMETRO DO ROTOR (mm)',3),('RCX','MOTOR (cv)',4),('RCX','MOTOR cv',5),('RCX','PRODUÇÃO (kg/h)',6),('RCX','PRODUÇÃO (KG/h)',7),('RCX','NAVALHAS ROTATIVAS (un.)',8),('RCX','NAVALHAS FIXAS (un.)',9),('RCX','ROTAÇÃO DO ROTOR (rpm)',10),('RCX','ALTURA DE ALIMENTAÇÃO (mm)',11),('RCX','ÁREA OCUPADA (mm)',12),('RCX','PESO (kg)',13),('RCX','ALTURA DO BOCAL DE ALIMENTAÇÃO',14),('RCX','DIÂMETRO DA ROSCA (mm)',15),('RCX','DIÂMETRO DE GIRO (mm)',16),('RCX','NÚMERO DE NAVALHAS ROTATIVAS (mm)',17),('RCX','PENEIRA',18),('RCX','POTÊNCIA DO MOTOR PRINCIPAL',19),('RCX','ROTAÇÃO (rpm)',20),('RCX','ROTAÇÃO DO MOTOR (rpm)',21)
)
INSERT INTO public.linha_spec_campos (linha_id, nome, ordem)
SELECT l.id, m.nome, m.ordem
FROM   modelo m
JOIN   public.linhas l ON l.nome = m.linha
ON CONFLICT (linha_id, nome) DO NOTHING;

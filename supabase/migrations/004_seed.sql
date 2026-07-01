-- ============================================================
-- ERP COMERCIAL SEIBT — SEED v1.0
-- Arquivo 4/4: Dados iniciais
--
-- PRÉ-REQUISITO: Criar os usuários Auth antes de rodar este arquivo.
-- Supabase Dashboard → Authentication → Users → Add user
-- Use email + senha Seibt@2026! para cada usuário abaixo:
--
--   lucasmoreiraconcencia@gmail.com  (Admin Lucas)
--   adao@seibt.com.br                (Admin Adão)
--   leandro@seibt.com.br             (Vendedor Interno)
--   eliezer@seibt.com.br             (Vendedor Interno)
--   sedenir@seibt.com.br             (Vendedor Interno + Rep. RS)
--   michel@seibt.com.br              (Vendedor Interno + Rep. Exportação)
--   juliana@seibt.com.br             (Vendedor Interno)
--   humberto@seibt.com.br            (Representante Externo SC)
--   alexandre@seibt.com.br           (Representante Externo PR)
--   fernando@seibt.com.br            (Representante Externo RMSP)
--   almir@seibt.com.br               (Representante Externo SP Interior)
--
-- Ajuste emails reais antes de rodar em PRODUÇÃO.
-- ============================================================

-- ============================================================
-- USUÁRIOS DE NEGÓCIO
-- ============================================================

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Lucas Moreira', u.email, 'admin', 'LW', true, true
FROM auth.users u WHERE u.email = 'lucasmoreiraconcencia@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome, perfil = EXCLUDED.perfil,
  iniciais_pdf = EXCLUDED.iniciais_pdf, pode_configurar = EXCLUDED.pode_configurar;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Adão', u.email, 'admin', 'SAA', false, true
FROM auth.users u WHERE u.email = 'adao@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome, perfil = EXCLUDED.perfil, iniciais_pdf = EXCLUDED.iniciais_pdf;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Leandro', u.email, 'vendedor_interno', 'LS', false, true
FROM auth.users u WHERE u.email = 'leandro@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Eliezer', u.email, 'vendedor_interno', 'ES', false, true
FROM auth.users u WHERE u.email = 'eliezer@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Sedenir', u.email, 'vendedor_interno', 'SE', false, true
FROM auth.users u WHERE u.email = 'sedenir@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Michel', u.email, 'vendedor_interno', 'MK', false, true
FROM auth.users u WHERE u.email = 'michel@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Juliana', u.email, 'vendedor_interno', 'JU', false, true
FROM auth.users u WHERE u.email = 'juliana@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Humberto', u.email, 'representante', 'HA', false, true
FROM auth.users u WHERE u.email = 'humberto@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Alexandre', u.email, 'representante', 'AB', false, true
FROM auth.users u WHERE u.email = 'alexandre@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Fernando', u.email, 'representante', 'FM', false, true
FROM auth.users u WHERE u.email = 'fernando@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

INSERT INTO public.usuarios (id, nome, email, perfil, iniciais_pdf, pode_configurar, ativo)
SELECT u.id, 'Almir', u.email, 'representante', 'AM', false, true
FROM auth.users u WHERE u.email = 'almir@seibt.com.br'
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil;

-- ============================================================
-- REPRESENTANTES
-- ============================================================

-- Internos com dupla função (vendedor_interno + cobertura regional)
INSERT INTO public.representantes (nome, tipo, usuario_id, ativo, observacoes)
SELECT 'Sedenir', 'interno_duplo',
  (SELECT id FROM public.usuarios WHERE email = 'sedenir@seibt.com.br'),
  true, 'RS — vendedor interno com cobertura regional'
WHERE EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'sedenir@seibt.com.br');

INSERT INTO public.representantes (nome, tipo, usuario_id, ativo, observacoes)
SELECT 'Michel', 'interno_duplo',
  (SELECT id FROM public.usuarios WHERE email = 'michel@seibt.com.br'),
  true, 'Exportação — mercado externo'
WHERE EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'michel@seibt.com.br');

-- Representantes externos
INSERT INTO public.representantes (nome, tipo, usuario_id, empresa, ativo, observacoes)
SELECT 'Humberto', 'externo',
  (SELECT id FROM public.usuarios WHERE email = 'humberto@seibt.com.br'),
  'Link', true, 'SC'
WHERE EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'humberto@seibt.com.br');

INSERT INTO public.representantes (nome, tipo, usuario_id, ativo, observacoes)
SELECT 'Alexandre', 'externo',
  (SELECT id FROM public.usuarios WHERE email = 'alexandre@seibt.com.br'),
  true, 'PR'
WHERE EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'alexandre@seibt.com.br');

INSERT INTO public.representantes (nome, tipo, usuario_id, ativo, observacoes)
SELECT 'Fernando', 'externo',
  (SELECT id FROM public.usuarios WHERE email = 'fernando@seibt.com.br'),
  true, 'Região Metropolitana de São Paulo'
WHERE EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'fernando@seibt.com.br');

INSERT INTO public.representantes (nome, tipo, usuario_id, ativo, observacoes)
SELECT 'Almir', 'externo',
  (SELECT id FROM public.usuarios WHERE email = 'almir@seibt.com.br'),
  true, 'Interior de SP'
WHERE EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'almir@seibt.com.br');

-- ============================================================
-- REGIÕES DOS REPRESENTANTES
-- ============================================================

INSERT INTO public.regioes_representante (representante_id, estado, observacao)
SELECT id, 'RS', null FROM public.representantes WHERE nome = 'Sedenir';

INSERT INTO public.regioes_representante (representante_id, estado, observacao)
SELECT id, 'SC', null FROM public.representantes WHERE nome = 'Humberto';

INSERT INTO public.regioes_representante (representante_id, estado, observacao)
SELECT id, 'PR', null FROM public.representantes WHERE nome = 'Alexandre';

INSERT INTO public.regioes_representante (representante_id, estado, observacao)
SELECT id, 'SP', 'Região Metropolitana de São Paulo' FROM public.representantes WHERE nome = 'Fernando';

INSERT INTO public.regioes_representante (representante_id, estado, observacao)
SELECT id, 'SP', 'Interior de SP — exceto RMSP' FROM public.representantes WHERE nome = 'Almir';

-- Michel: exportação (sem estado, múltiplos países)
INSERT INTO public.regioes_representante (representante_id, estado, pais, observacao)
SELECT r.id, null, p.pais, 'Exportação'
FROM public.representantes r
CROSS JOIN (VALUES
  ('Argentina'), ('Chile'), ('Colômbia'), ('México'),
  ('Peru'), ('Venezuela'), ('Paraguai'), ('Uruguai')
) AS p(pais)
WHERE r.nome = 'Michel';

-- ============================================================
-- SEQUÊNCIA DE PROPOSTAS — ANO ATUAL
-- ATENÇÃO: ajuste ultimo_numero para continuar a partir do CRM
-- Exemplo: se o último número do CRM foi 1243, coloque 1243 aqui
-- ============================================================

INSERT INTO public.sequencias_proposta (ano, ultimo_numero)
VALUES (2026, 0)
ON CONFLICT (ano) DO NOTHING;

-- ============================================================
-- FUNIS PADRÃO
-- ============================================================

DO $$
DECLARE
  v_lucas_id    uuid;
  v_funil_vi_id uuid;
  v_funil_rp_id uuid;
BEGIN
  SELECT id INTO v_lucas_id
  FROM public.usuarios
  WHERE email = 'lucasmoreiraconcencia@gmail.com';

  IF v_lucas_id IS NULL THEN
    RAISE NOTICE 'AVISO: Lucas não encontrado em public.usuarios. Crie o usuário Auth antes de rodar o seed.';
    RETURN;
  END IF;

  -- Funil padrão — Vendedor Interno
  INSERT INTO public.funis (nome, usuario_id, perfil_alvo, criado_por)
  VALUES ('Padrão Vendedor Interno', null, 'vendedor_interno', v_lucas_id)
  RETURNING id INTO v_funil_vi_id;

  INSERT INTO public.etapas_funil (funil_id, nome, ordem, cor) VALUES
    (v_funil_vi_id, 'Orçamento',          1, '#6B7B8D'),
    (v_funil_vi_id, 'Aguardando Cliente', 2, '#D97706'),
    (v_funil_vi_id, 'Em Negociação',      3, '#2074B9'),
    (v_funil_vi_id, 'Pedido',             4, '#16A34A');

  -- Funil padrão — Representante
  INSERT INTO public.funis (nome, usuario_id, perfil_alvo, criado_por)
  VALUES ('Padrão Representante', null, 'representante', v_lucas_id)
  RETURNING id INTO v_funil_rp_id;

  INSERT INTO public.etapas_funil (funil_id, nome, ordem, cor) VALUES
    (v_funil_rp_id, 'Lead',       1, '#6B7B8D'),
    (v_funil_rp_id, 'Contato',    2, '#D97706'),
    (v_funil_rp_id, 'Proposta',   3, '#2074B9'),
    (v_funil_rp_id, 'Negociação', 4, '#7C3AED'),
    (v_funil_rp_id, 'Fechado',    5, '#16A34A');

  RAISE NOTICE 'Seed concluído com sucesso.';
END;
$$;

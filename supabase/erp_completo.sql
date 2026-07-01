-- ============================================================
-- ERP COMERCIAL SEIBT — SCRIPT COMPLETO v1.0
-- Gerado em: 2026-06-29
-- 
-- ORDEM DE EXECUÇÃO (automática neste arquivo):
--   001 Schema  — extensões, enums, tabelas, índices
--   002 Functions — funções auxiliares + triggers
--   003 RLS     — políticas de segurança por perfil
--   004 Seed    — dados iniciais (requer usuários Auth criados)
--
-- Como rodar:
--   Supabase Dashboard → SQL Editor → Cole este arquivo → Run
-- ============================================================

-- ============================================================
-- 001_schema.sql
-- ============================================================

-- ============================================================
-- ERP COMERCIAL SEIBT — SCHEMA v1.0
-- Arquivo 1/4: Extensões + ENUMs + Tabelas + Índices
-- Executar no Supabase SQL Editor (service_role)
-- ============================================================

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMs
-- ============================================================

CREATE TYPE public.perfil AS ENUM (
  'admin', 'vendedor_interno', 'representante', 'engenharia'
);

CREATE TYPE public.tipo_representante AS ENUM ('externo', 'interno_duplo');

CREATE TYPE public.segmento_cliente AS ENUM (
  'transformador', 'reciclador', 'industria', 'outro'
);

CREATE TYPE public.porte_cliente AS ENUM ('pequeno', 'medio', 'grande');
CREATE TYPE public.status_cliente AS ENUM ('prospect', 'ativo', 'inativo');
CREATE TYPE public.tratamento_contato AS ENUM ('sr', 'sra', 'dr', 'dra');

CREATE TYPE public.canal_origem AS ENUM (
  'whatsapp', 'email', 'feira', 'site', 'indicacao',
  'telefone', 'recorrencia', 'outro'
);

CREATE TYPE public.status_proposta AS ENUM (
  'rascunho', 'elaboracao', 'aguardando_precificacao',
  'enviada', 'em_negociacao', 'vendida', 'perdida', 'desistencia', 'stand_by'
);

CREATE TYPE public.temperatura_proposta AS ENUM ('quente', 'morna', 'fria');

CREATE TYPE public.tipo_proposta AS ENUM (
  'maquina', 'sistema', 'exportacao', 'pecas', 'servico', 'mista'
);

CREATE TYPE public.moeda_proposta AS ENUM ('BRL', 'USD');

CREATE TYPE public.canal_followup AS ENUM (
  'whatsapp', 'telefone', 'email', 'visita', 'video', 'sms', 'outro'
);

CREATE TYPE public.status_lead AS ENUM (
  'novo', 'em_qualificacao', 'qualificado', 'convertido', 'descartado'
);

CREATE TYPE public.tipo_interesse_lead AS ENUM (
  'maquina', 'pecas', 'sistema', 'servico', 'exportacao'
);

CREATE TYPE public.status_solicitacao AS ENUM (
  'pendente', 'em_analise', 'respondida', 'cancelada'
);

CREATE TYPE public.categoria_produto AS ENUM (
  'maquina', 'navalha', 'peneira', 'rolamento', 'parafuso',
  'rotor', 'inserto', 'periferico', 'linha', 'outro'
);

CREATE TYPE public.mercado_meta AS ENUM ('interno', 'exportacao');
CREATE TYPE public.tipo_frete AS ENUM ('cif', 'fob');
CREATE TYPE public.moagem_tipo AS ENUM ('seco', 'umido');
CREATE TYPE public.pdf_template AS ENUM ('template_1', 'template_2', 'template_3');
CREATE TYPE public.perfil_funil AS ENUM ('vendedor_interno', 'representante');

-- ============================================================
-- DOMÍNIO 1 — IDENTIDADE & ACESSO
-- ============================================================

CREATE TABLE public.usuarios (
  id              uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            text          NOT NULL,
  email           text          NOT NULL UNIQUE,
  perfil          public.perfil NOT NULL DEFAULT 'vendedor_interno',
  iniciais_pdf    text,
  pode_configurar boolean       NOT NULL DEFAULT false,
  ativo           boolean       NOT NULL DEFAULT true,
  avatar_url      text,
  criado_em       timestamptz   NOT NULL DEFAULT now(),
  ultimo_acesso   timestamptz,
  deleted_at      timestamptz
);

CREATE TABLE public.representantes (
  id          uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text                      NOT NULL,
  tipo        public.tipo_representante NOT NULL DEFAULT 'externo',
  usuario_id  uuid                      REFERENCES public.usuarios(id) ON DELETE SET NULL,
  empresa     text,
  telefone    text,
  email       text,
  ativo       boolean                   NOT NULL DEFAULT true,
  observacoes text
);

CREATE TABLE public.regioes_representante (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  estado           text,
  pais             text,
  observacao       text
);

-- ============================================================
-- DOMÍNIO 2 — MERCADO
-- ============================================================

CREATE TABLE public.clientes (
  id               uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social     text                    NOT NULL,
  nome_fantasia    text,
  cnpj             text,
  segmento         public.segmento_cliente NOT NULL DEFAULT 'outro',
  porte            public.porte_cliente    NOT NULL DEFAULT 'pequeno',
  status           public.status_cliente   NOT NULL DEFAULT 'prospect',
  estado           text,
  cidade           text,
  pais             text                    NOT NULL DEFAULT 'Brasil',
  endereco         text,
  representante_id uuid                    REFERENCES public.representantes(id) ON DELETE SET NULL,
  responsavel_id   uuid                    REFERENCES public.usuarios(id) ON DELETE SET NULL,
  importado_dez    boolean                 NOT NULL DEFAULT false,
  criado_por       uuid                    NOT NULL REFERENCES public.usuarios(id),
  criado_em        timestamptz             NOT NULL DEFAULT now(),
  atualizado_em    timestamptz             NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- CNPJ único apenas entre registros não excluídos
CREATE UNIQUE INDEX clientes_cnpj_ativo_idx
  ON public.clientes(cnpj)
  WHERE cnpj IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.contatos_cliente (
  id         uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid                       NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome       text                       NOT NULL,
  cargo      text,
  tratamento public.tratamento_contato,
  telefone   text,
  email      text,
  whatsapp   text,
  principal  boolean                    NOT NULL DEFAULT false,
  ativo      boolean                    NOT NULL DEFAULT true
);

CREATE TABLE public.maquinas_cliente (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  modelo            text,
  numero_serie      text,
  ano_fabricacao    integer,
  plaqueta_foto_url text,
  observacoes       text,
  registrado_em     timestamptz NOT NULL DEFAULT now(),
  registrado_por    uuid        NOT NULL REFERENCES public.usuarios(id)
);

CREATE TABLE public.leads (
  id               uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid                       REFERENCES public.clientes(id) ON DELETE SET NULL,
  empresa_nome     text,
  contato_nome     text,
  contato_telefone text,
  contato_email    text,
  canal_entrada    public.canal_origem        NOT NULL DEFAULT 'outro',
  tipo_interesse   public.tipo_interesse_lead NOT NULL DEFAULT 'maquina',
  responsavel_id   uuid                       NOT NULL REFERENCES public.usuarios(id),
  representante_id uuid                       REFERENCES public.representantes(id) ON DELETE SET NULL,
  status           public.status_lead         NOT NULL DEFAULT 'novo',
  observacoes      text,
  criado_em        timestamptz                NOT NULL DEFAULT now(),
  atualizado_em    timestamptz                NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- ============================================================
-- DOMÍNIO 12 — NUMERAÇÃO (criado antes de propostas)
-- ============================================================

CREATE TABLE public.sequencias_proposta (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  ano           integer NOT NULL UNIQUE,
  ultimo_numero integer NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DOMÍNIO 8 — FUNIL CONFIGURÁVEL (criado antes de propostas)
-- ============================================================

CREATE TABLE public.funis (
  id            uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text              NOT NULL,
  usuario_id    uuid              REFERENCES public.usuarios(id) ON DELETE CASCADE,
  perfil_alvo   public.perfil_funil,
  criado_por    uuid              NOT NULL REFERENCES public.usuarios(id),
  criado_em     timestamptz       NOT NULL DEFAULT now(),
  atualizado_em timestamptz       NOT NULL DEFAULT now()
);

CREATE TABLE public.etapas_funil (
  id       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  funil_id uuid    NOT NULL REFERENCES public.funis(id) ON DELETE CASCADE,
  nome     text    NOT NULL,
  ordem    integer NOT NULL,
  cor      text    NOT NULL DEFAULT '#6B7B8D',
  ativo    boolean NOT NULL DEFAULT true
);

-- ============================================================
-- DOMÍNIO 3 — FUNIL COMERCIAL
-- ============================================================

CREATE TABLE public.propostas (
  id                   uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  numero               integer                NOT NULL,
  revisao              text,
  proposta_original_id uuid                   REFERENCES public.propostas(id) ON DELETE SET NULL,
  numero_completo      text                   NOT NULL,
  tipo                 public.tipo_proposta   NOT NULL DEFAULT 'maquina',
  cliente_id           uuid                   REFERENCES public.clientes(id) ON DELETE SET NULL,
  lead_id              uuid                   REFERENCES public.leads(id) ON DELETE SET NULL,
  contato_nome         text,
  contato_email        text,
  contato_telefone     text,
  responsavel_id       uuid                   NOT NULL REFERENCES public.usuarios(id),
  representante_id     uuid                   REFERENCES public.representantes(id) ON DELETE SET NULL,
  canal_origem         public.canal_origem,
  moeda                public.moeda_proposta  NOT NULL DEFAULT 'BRL',
  status               public.status_proposta NOT NULL DEFAULT 'rascunho',
  temperatura          public.temperatura_proposta,
  etapa_funil_id       uuid                   REFERENCES public.etapas_funil(id) ON DELETE SET NULL,
  valor_total          numeric(15,2),
  desconto_medio_pct   numeric(6,2),
  condicao_pagamento   text,
  prazo_entrega        text,
  validade_proposta    date,
  observacoes          text,
  descricao_livre      text,
  motivo_perda         text,
  numero_pedido_dez    text,
  valor_pedido_real    numeric(15,2),
  data_pedido_dez      date,
  estornado            boolean                NOT NULL DEFAULT false,
  pdf_url              text,
  pdf_template         public.pdf_template,
  criado_em            timestamptz            NOT NULL DEFAULT now(),
  enviada_em           timestamptz,
  fechada_em           timestamptz,
  atualizado_em        timestamptz            NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

-- DOMÍNIO 5 — CATÁLOGO (criado antes de itens_proposta)

CREATE TABLE public.produtos (
  id              uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text                     NOT NULL UNIQUE,
  descricao       text                     NOT NULL,
  categoria       public.categoria_produto NOT NULL DEFAULT 'outro',
  modelo          text,
  linha           text,
  preco_brl       numeric(15,2),
  preco_usd       numeric(15,2),
  ipi_pct         numeric(6,2)             NOT NULL DEFAULT 0,
  ncm             text,
  produto_especial boolean                 NOT NULL DEFAULT false,
  tem_variantes   boolean                  NOT NULL DEFAULT false,
  ativo           boolean                  NOT NULL DEFAULT true,
  specs           jsonb,
  foto_url        text,
  criado_em       timestamptz              NOT NULL DEFAULT now(),
  atualizado_em   timestamptz              NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE TABLE public.variantes_produto (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id         uuid    NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  codigo_variante    text    NOT NULL UNIQUE,
  descricao_variante text    NOT NULL,
  preco_brl          numeric(15,2),
  preco_usd          numeric(15,2),
  ipi_pct            numeric(6,2),
  ativo              boolean NOT NULL DEFAULT true
);

CREATE TABLE public.itens_proposta (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id            uuid        NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  produto_id             uuid        REFERENCES public.produtos(id) ON DELETE SET NULL,
  variante_id            uuid        REFERENCES public.variantes_produto(id) ON DELETE SET NULL,
  descricao              text        NOT NULL,
  quantidade             integer     NOT NULL DEFAULT 1,
  preco_tabela           numeric(15,2),
  preco_unitario         numeric(15,2) NOT NULL,
  desconto_pct           numeric(6,2),
  desconto_justificativa text,
  ipi_pct                numeric(6,2) NOT NULL DEFAULT 0,
  total                  numeric(15,2),
  observacao             text,
  ordem                  integer     NOT NULL DEFAULT 0,
  opcional               boolean     NOT NULL DEFAULT false,
  e_subitem              boolean     NOT NULL DEFAULT false,
  item_pai_id            uuid        REFERENCES public.itens_proposta(id) ON DELETE SET NULL,
  numero_item            text
);

CREATE TABLE public.checklist_tecnico (
  id                   uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id          uuid              NOT NULL UNIQUE REFERENCES public.propostas(id) ON DELETE CASCADE,
  segmento_aplicacao   text,
  produto_final        text,
  material             text,
  dimensoes            text,
  granulometria        text,
  moagem_tipo          public.moagem_tipo,
  forma_abastecimento  text,
  producao_horaria_kgh numeric(10,2),
  voltagem             text,
  observacoes_tecnicas text,
  completo             boolean           NOT NULL DEFAULT false,
  preenchido_em        timestamptz,
  preenchido_por       uuid              REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE TABLE public.followups (
  id                 uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id        uuid                  NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  usuario_id         uuid                  NOT NULL REFERENCES public.usuarios(id),
  data_contato       date                  NOT NULL,
  canal              public.canal_followup NOT NULL DEFAULT 'whatsapp',
  motivo             text,
  descricao          text,
  temperatura        public.temperatura_proposta,
  etapa_proposta     text,
  proxima_acao_data  date,
  proxima_acao_tipo  text,
  proxima_acao_notas text,
  criado_em          timestamptz           NOT NULL DEFAULT now()
);

CREATE TABLE public.solicitacoes_precificacao (
  id                  uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id         uuid                     NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  item_descricao      text                     NOT NULL,
  especificacoes      text,
  prazo_desejado      date,
  urgente             boolean                  NOT NULL DEFAULT false,
  solicitante_id      uuid                     NOT NULL REFERENCES public.usuarios(id),
  status              public.status_solicitacao NOT NULL DEFAULT 'pendente',
  preco_respondido    numeric(15,2),
  resposta_engenharia text,
  respondido_por      uuid                     REFERENCES public.usuarios(id) ON DELETE SET NULL,
  respondido_em       timestamptz,
  criado_em           timestamptz              NOT NULL DEFAULT now()
);

-- ============================================================
-- DOMÍNIO 4 — PEDIDOS & RECONCILIAÇÃO
-- ============================================================

CREATE TABLE public.pedidos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_dez    text        NOT NULL UNIQUE,
  proposta_id   uuid        REFERENCES public.propostas(id) ON DELETE SET NULL,
  cliente_id    uuid        REFERENCES public.clientes(id) ON DELETE SET NULL,
  classificacao text,
  valor         numeric(15,2),
  data_pedido   date,
  estornado     boolean     NOT NULL DEFAULT false,
  observacoes   text,
  registrado_por uuid       NOT NULL REFERENCES public.usuarios(id),
  registrado_em  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DOMÍNIO 5 — CATÁLOGO (continuação)
-- ============================================================

CREATE TABLE public.historico_precos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id          uuid        REFERENCES public.produtos(id) ON DELETE SET NULL,
  variante_id         uuid        REFERENCES public.variantes_produto(id) ON DELETE SET NULL,
  preco_anterior_brl  numeric(15,2),
  preco_novo_brl      numeric(15,2),
  preco_anterior_usd  numeric(15,2),
  preco_novo_usd      numeric(15,2),
  percentual_reajuste numeric(8,2),
  motivo              text,
  data_reajuste       date        NOT NULL DEFAULT CURRENT_DATE,
  reajustado_por      uuid        NOT NULL REFERENCES public.usuarios(id),
  CONSTRAINT historico_precos_ref_check
    CHECK (produto_id IS NOT NULL OR variante_id IS NOT NULL)
);

CREATE TABLE public.compatibilidades_produto (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id     uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  modelo_maquina text,
  furos_codigos  text,
  observacao     text
);

-- ============================================================
-- DOMÍNIO 6 — METAS
-- ============================================================

CREATE TABLE public.metas (
  id                uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  ano               integer           NOT NULL,
  responsavel_id    uuid              REFERENCES public.usuarios(id) ON DELETE SET NULL,
  representante_id  uuid              REFERENCES public.representantes(id) ON DELETE SET NULL,
  mercado           public.mercado_meta NOT NULL DEFAULT 'interno',
  tipo_produto      text              NOT NULL,
  valor_meta_anual  numeric(15,2)     NOT NULL DEFAULT 0,
  real_ano_anterior numeric(15,2)     NOT NULL DEFAULT 0,
  criado_por        uuid              NOT NULL REFERENCES public.usuarios(id),
  criado_em         timestamptz       NOT NULL DEFAULT now(),
  atualizado_em     timestamptz       NOT NULL DEFAULT now()
);

-- ============================================================
-- DOMÍNIO 7 — FRETE
-- ============================================================

CREATE TABLE public.fichas_frete (
  id                      uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id               uuid              REFERENCES public.pedidos(id) ON DELETE SET NULL,
  proposta_id             uuid              REFERENCES public.propostas(id) ON DELETE SET NULL,
  cliente_id              uuid              REFERENCES public.clientes(id) ON DELETE SET NULL,
  produto_descricao       text,
  peso_kg                 numeric(10,2),
  dimensao_comp_cm        numeric(10,2),
  dimensao_larg_cm        numeric(10,2),
  dimensao_alt_cm         numeric(10,2),
  volume_m3               numeric(10,4),
  tipo_frete              public.tipo_frete,
  local_retirada          text,
  destino_endereco        text,
  transportadora_indicada text,
  observacoes             text,
  pdf_cliente_url         text,
  pdf_transportadora_url  text,
  criado_por              uuid              NOT NULL REFERENCES public.usuarios(id),
  criado_em               timestamptz       NOT NULL DEFAULT now()
);

-- ============================================================
-- DOMÍNIO 9 — NOTIFICAÇÕES & PREFERÊNCIAS
-- ============================================================

CREATE TABLE public.notificacoes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo            text        NOT NULL,
  titulo          text        NOT NULL,
  mensagem        text,
  link            text,
  referencia_id   uuid,
  referencia_tipo text,
  lida            boolean     NOT NULL DEFAULT false,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  lida_em         timestamptz
);

CREATE TABLE public.preferencias_usuario (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       uuid        NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  dashboard_layout jsonb       NOT NULL DEFAULT '[]',
  favoritos        jsonb       NOT NULL DEFAULT '[]',
  notif_canais     jsonb       NOT NULL DEFAULT '{"inapp": true, "email": false, "whatsapp": false}',
  notif_eventos    jsonb       NOT NULL DEFAULT '{}',
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DOMÍNIO 10 — RASCUNHOS
-- ============================================================

CREATE TABLE public.rascunhos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo          text        NOT NULL,
  entidade_id   uuid,
  dados         jsonb       NOT NULL DEFAULT '{}',
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Um rascunho por (usuario, tipo) para novos registros
CREATE UNIQUE INDEX rascunhos_novo_uq
  ON public.rascunhos(usuario_id, tipo)
  WHERE entidade_id IS NULL;

-- Um rascunho por (usuario, tipo, entidade) para edições
CREATE UNIQUE INDEX rascunhos_existente_uq
  ON public.rascunhos(usuario_id, tipo, entidade_id)
  WHERE entidade_id IS NOT NULL;

-- ============================================================
-- DOMÍNIO 11 — AUDITORIA
-- ============================================================

CREATE TABLE public.audit_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_id          uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ator_perfil      text,
  entidade         text        NOT NULL,
  entidade_id      uuid        NOT NULL,
  operacao         text        NOT NULL,
  campos_alterados jsonb,
  ip_address       text,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Propostas
CREATE INDEX idx_propostas_status
  ON public.propostas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_propostas_responsavel
  ON public.propostas(responsavel_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_propostas_cliente
  ON public.propostas(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_propostas_numero_completo
  ON public.propostas(numero_completo);
CREATE INDEX idx_propostas_pedido_dez
  ON public.propostas(numero_pedido_dez) WHERE numero_pedido_dez IS NOT NULL;
CREATE INDEX idx_propostas_validade
  ON public.propostas(validade_proposta) WHERE deleted_at IS NULL AND validade_proposta IS NOT NULL;
CREATE INDEX idx_propostas_deleted
  ON public.propostas(deleted_at) WHERE deleted_at IS NOT NULL;

-- Clientes
CREATE INDEX idx_clientes_estado
  ON public.clientes(estado) WHERE deleted_at IS NULL;
CREATE INDEX idx_clientes_responsavel
  ON public.clientes(responsavel_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clientes_razao_trgm
  ON public.clientes USING gin(razao_social gin_trgm_ops);
CREATE INDEX idx_clientes_fantasia_trgm
  ON public.clientes USING gin(nome_fantasia gin_trgm_ops) WHERE nome_fantasia IS NOT NULL;
CREATE INDEX idx_clientes_cnpj_trgm
  ON public.clientes USING gin(cnpj gin_trgm_ops) WHERE cnpj IS NOT NULL;

-- Produtos
CREATE INDEX idx_produtos_codigo_trgm
  ON public.produtos USING gin(codigo gin_trgm_ops);
CREATE INDEX idx_produtos_descricao_trgm
  ON public.produtos USING gin(descricao gin_trgm_ops);
CREATE INDEX idx_produtos_categoria
  ON public.produtos(categoria) WHERE deleted_at IS NULL;

-- Leads
CREATE INDEX idx_leads_empresa_trgm
  ON public.leads USING gin(empresa_nome gin_trgm_ops) WHERE empresa_nome IS NOT NULL;
CREATE INDEX idx_leads_contato_trgm
  ON public.leads USING gin(contato_nome gin_trgm_ops) WHERE contato_nome IS NOT NULL;
CREATE INDEX idx_leads_responsavel
  ON public.leads(responsavel_id) WHERE deleted_at IS NULL;

-- Follow-ups
CREATE INDEX idx_followups_proxima_acao
  ON public.followups(proxima_acao_data) WHERE proxima_acao_data IS NOT NULL;
CREATE INDEX idx_followups_proposta
  ON public.followups(proposta_id);

-- Solicitações
CREATE INDEX idx_solicitacoes_status
  ON public.solicitacoes_precificacao(status);
CREATE INDEX idx_solicitacoes_proposta
  ON public.solicitacoes_precificacao(proposta_id);

-- Notificações
CREATE INDEX idx_notificacoes_usuario
  ON public.notificacoes(usuario_id, lida, criado_em DESC);

-- Audit
CREATE INDEX idx_audit_entidade
  ON public.audit_log(entidade, entidade_id);
CREATE INDEX idx_audit_ator
  ON public.audit_log(ator_id);
CREATE INDEX idx_audit_criado
  ON public.audit_log(criado_em DESC);



-- ============================================================
-- 002_functions.sql
-- ============================================================

-- ============================================================
-- ERP COMERCIAL SEIBT — FUNÇÕES E TRIGGERS v1.0
-- Arquivo 2/4: Funções auxiliares + Triggers de negócio
-- ============================================================

-- ============================================================
-- FUNÇÕES AUXILIARES PARA RLS
-- (SECURITY DEFINER = bypass RLS ao consultar public.usuarios)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_perfil()
RETURNS public.perfil
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil FROM public.usuarios
  WHERE id = auth.uid() AND ativo = true AND deleted_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.get_my_pode_configurar()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(pode_configurar, false)
  FROM public.usuarios
  WHERE id = auth.uid() AND ativo = true AND deleted_at IS NULL
$$;

-- Retorna o id do representante vinculado ao usuário atual
CREATE OR REPLACE FUNCTION public.get_my_representante_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.representantes
  WHERE usuario_id = auth.uid() AND ativo = true
  LIMIT 1
$$;

-- Retorna os estados cobertos pelo representante atual
CREATE OR REPLACE FUNCTION public.get_my_estados()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(rr.estado)
  FROM public.representantes r
  JOIN public.regioes_representante rr ON rr.representante_id = r.id
  WHERE r.usuario_id = auth.uid()
    AND r.ativo = true
    AND rr.estado IS NOT NULL
$$;

-- ============================================================
-- NUMERAÇÃO ATÔMICA DE PROPOSTAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.next_proposta_numero(p_ano integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero integer;
BEGIN
  INSERT INTO public.sequencias_proposta (ano, ultimo_numero)
  VALUES (p_ano, 0)
  ON CONFLICT (ano) DO NOTHING;

  UPDATE public.sequencias_proposta
  SET    ultimo_numero = ultimo_numero + 1,
         atualizado_em = now()
  WHERE  ano = p_ano
  RETURNING ultimo_numero INTO v_numero;

  RETURN v_numero;
END;
$$;

-- ============================================================
-- TRIGGER: gerar numero_completo ao criar proposta
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_proposta_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano    integer;
  v_numero integer;
BEGIN
  v_ano := EXTRACT(YEAR FROM now())::integer;

  IF NEW.proposta_original_id IS NOT NULL AND NEW.revisao IS NOT NULL THEN
    -- Revisão: herda o número do original
    SELECT numero INTO v_numero
    FROM public.propostas
    WHERE id = NEW.proposta_original_id;

    NEW.numero        := v_numero;
    NEW.numero_completo := LPAD(v_numero::text, 4, '0')
                          || ' ' || NEW.revisao
                          || '/' || v_ano::text;
  ELSE
    -- Proposta nova: gera próximo número da sequência anual
    NEW.numero        := public.next_proposta_numero(v_ano);
    NEW.numero_completo := LPAD(NEW.numero::text, 4, '0') || '/' || v_ano::text;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER before_proposta_insert
  BEFORE INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.handle_proposta_numero();

-- ============================================================
-- TRIGGER: calcular total e desconto% dos itens
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_item_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total := NEW.quantidade
               * NEW.preco_unitario
               * (1 + COALESCE(NEW.ipi_pct, 0) / 100.0);

  IF NEW.preco_tabela IS NOT NULL AND NEW.preco_tabela > 0 THEN
    NEW.desconto_pct := ROUND(
      ((NEW.preco_tabela - NEW.preco_unitario) / NEW.preco_tabela) * 100, 2
    );
  ELSE
    NEW.desconto_pct := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER before_item_save
  BEFORE INSERT OR UPDATE ON public.itens_proposta
  FOR EACH ROW EXECUTE FUNCTION public.compute_item_totals();

-- ============================================================
-- TRIGGER: calcular volume_m3 nas fichas de frete
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_volume_frete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dimensao_comp_cm IS NOT NULL
    AND NEW.dimensao_larg_cm IS NOT NULL
    AND NEW.dimensao_alt_cm  IS NOT NULL THEN
    NEW.volume_m3 := ROUND(
      (NEW.dimensao_comp_cm * NEW.dimensao_larg_cm * NEW.dimensao_alt_cm / 1000000.0)::numeric,
      4
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_frete_save
  BEFORE INSERT OR UPDATE ON public.fichas_frete
  FOR EACH ROW EXECUTE FUNCTION public.compute_volume_frete();

-- ============================================================
-- TRIGGER: historico_precos ao reajustar produto/variante
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só registra se houve mudança real de preço
  IF OLD.preco_brl IS NOT DISTINCT FROM NEW.preco_brl
    AND OLD.preco_usd IS NOT DISTINCT FROM NEW.preco_usd THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'produtos' THEN
    INSERT INTO public.historico_precos (
      produto_id,
      preco_anterior_brl, preco_novo_brl,
      preco_anterior_usd, preco_novo_usd,
      percentual_reajuste,
      data_reajuste, reajustado_por
    ) VALUES (
      NEW.id,
      OLD.preco_brl, NEW.preco_brl,
      OLD.preco_usd, NEW.preco_usd,
      CASE
        WHEN OLD.preco_brl IS NOT NULL AND OLD.preco_brl > 0 AND NEW.preco_brl IS NOT NULL
        THEN ROUND(((NEW.preco_brl - OLD.preco_brl) / OLD.preco_brl) * 100, 2)
        ELSE NULL
      END,
      CURRENT_DATE,
      auth.uid()
    );
  END IF;

  IF TG_TABLE_NAME = 'variantes_produto' THEN
    INSERT INTO public.historico_precos (
      produto_id, variante_id,
      preco_anterior_brl, preco_novo_brl,
      preco_anterior_usd, preco_novo_usd,
      percentual_reajuste,
      data_reajuste, reajustado_por
    ) VALUES (
      NEW.produto_id, NEW.id,
      OLD.preco_brl, NEW.preco_brl,
      OLD.preco_usd, NEW.preco_usd,
      CASE
        WHEN OLD.preco_brl IS NOT NULL AND OLD.preco_brl > 0 AND NEW.preco_brl IS NOT NULL
        THEN ROUND(((NEW.preco_brl - OLD.preco_brl) / OLD.preco_brl) * 100, 2)
        ELSE NULL
      END,
      CURRENT_DATE,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_produto_price_change
  AFTER UPDATE OF preco_brl, preco_usd ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.handle_price_change();

CREATE TRIGGER on_variante_price_change
  AFTER UPDATE OF preco_brl, preco_usd ON public.variantes_produto
  FOR EACH ROW EXECUTE FUNCTION public.handle_price_change();

-- ============================================================
-- TRIGGER: criar preferências padrão ao inserir usuário
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.preferencias_usuario (usuario_id)
  VALUES (NEW.id)
  ON CONFLICT (usuario_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_usuario_created
  AFTER INSERT ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_usuario();

-- ============================================================
-- TRIGGER: atualizado_em automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER upd_clientes        BEFORE UPDATE ON public.clientes        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_leads           BEFORE UPDATE ON public.leads           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_propostas       BEFORE UPDATE ON public.propostas       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_produtos        BEFORE UPDATE ON public.produtos        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_metas           BEFORE UPDATE ON public.metas           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_funis           BEFORE UPDATE ON public.funis           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_preferencias    BEFORE UPDATE ON public.preferencias_usuario FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER upd_rascunhos       BEFORE UPDATE ON public.rascunhos       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FUNÇÃO: atualizar último acesso (chamada pelo cliente)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_last_access()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.usuarios
  SET ultimo_acesso = now()
  WHERE id = auth.uid();
$$;



-- ============================================================
-- 003_rls.sql
-- ============================================================

-- ============================================================
-- ERP COMERCIAL SEIBT — ROW LEVEL SECURITY v1.0
-- Arquivo 3/4: Habilitar RLS + todas as políticas
-- ============================================================

-- ============================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================

ALTER TABLE public.usuarios                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representantes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regioes_representante     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos_cliente          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas_cliente          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_proposta            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_tecnico         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_precificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variantes_produto         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_precos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibilidades_produto  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas_frete              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funis                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etapas_funil              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferencias_usuario      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rascunhos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequencias_proposta       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USUARIOS
-- ============================================================

CREATE POLICY "usuarios_admin_full" ON public.usuarios
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

-- Todo usuário vê e edita somente seus próprios dados
CREATE POLICY "usuarios_self" ON public.usuarios
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- REPRESENTANTES
-- ============================================================

CREATE POLICY "representantes_admin_full" ON public.representantes
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "representantes_vendedor_read" ON public.representantes
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'vendedor_interno');

CREATE POLICY "representantes_self_read" ON public.representantes
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND usuario_id = auth.uid()
  );

-- ============================================================
-- REGIOES_REPRESENTANTE
-- ============================================================

CREATE POLICY "regioes_admin_full" ON public.regioes_representante
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "regioes_vendedor_read" ON public.regioes_representante
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'vendedor_interno');

CREATE POLICY "regioes_self_read" ON public.regioes_representante
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND representante_id = get_my_representante_id()
  );

-- ============================================================
-- CLIENTES
-- ============================================================

CREATE POLICY "clientes_admin_full" ON public.clientes
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

-- Vendedor: criou, é responsável, ou sem responsável (pool)
CREATE POLICY "clientes_vendedor" ON public.clientes
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND deleted_at IS NULL
    AND (
      criado_por     = auth.uid()
      OR responsavel_id = auth.uid()
      OR responsavel_id IS NULL
    )
  )
  WITH CHECK (get_my_perfil() = 'vendedor_interno');

-- Representante: clientes do seu estado ou com override de representante_id
CREATE POLICY "clientes_representante_read" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND deleted_at IS NULL
    AND (
      representante_id = get_my_representante_id()
      OR estado = ANY(get_my_estados())
    )
  );

-- ============================================================
-- CONTATOS_CLIENTE
-- ============================================================

CREATE POLICY "contatos_admin_full" ON public.contatos_cliente
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "contatos_vendedor" ON public.contatos_cliente
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.deleted_at IS NULL
        AND (c.criado_por = auth.uid() OR c.responsavel_id = auth.uid() OR c.responsavel_id IS NULL)
    )
  );

CREATE POLICY "contatos_representante_read" ON public.contatos_cliente
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.deleted_at IS NULL
        AND (c.estado = ANY(get_my_estados()) OR c.representante_id = get_my_representante_id())
    )
  );

-- ============================================================
-- MAQUINAS_CLIENTE
-- ============================================================

CREATE POLICY "maquinas_admin_full" ON public.maquinas_cliente
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "maquinas_vendedor" ON public.maquinas_cliente
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.deleted_at IS NULL
        AND (c.criado_por = auth.uid() OR c.responsavel_id = auth.uid() OR c.responsavel_id IS NULL)
    )
  );

CREATE POLICY "maquinas_representante_read" ON public.maquinas_cliente
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.deleted_at IS NULL
        AND (c.estado = ANY(get_my_estados()) OR c.representante_id = get_my_representante_id())
    )
  );

-- ============================================================
-- LEADS
-- ============================================================

CREATE POLICY "leads_admin_full" ON public.leads
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "leads_vendedor" ON public.leads
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND deleted_at IS NULL
    AND (responsavel_id = auth.uid() OR responsavel_id IS NULL)
  )
  WITH CHECK (get_my_perfil() = 'vendedor_interno');

CREATE POLICY "leads_representante_read" ON public.leads
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND deleted_at IS NULL
    AND representante_id = get_my_representante_id()
  );

-- ============================================================
-- PROPOSTAS
-- ============================================================

CREATE POLICY "propostas_admin_full" ON public.propostas
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "propostas_vendedor_own" ON public.propostas
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND deleted_at IS NULL
    AND responsavel_id = auth.uid()
  )
  WITH CHECK (
    get_my_perfil() = 'vendedor_interno'
    AND responsavel_id = auth.uid()
  );

-- Representante: propostas da sua região (por cliente.estado ou representante_id)
CREATE POLICY "propostas_representante_read" ON public.propostas
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND deleted_at IS NULL
    AND (
      representante_id = get_my_representante_id()
      OR EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_id AND c.deleted_at IS NULL
          AND (c.estado = ANY(get_my_estados()) OR c.representante_id = get_my_representante_id())
      )
    )
  );

-- Engenharia: propostas com solicitações pendentes/em_analise
CREATE POLICY "propostas_engenharia_read" ON public.propostas
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'engenharia'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.solicitacoes_precificacao sp
      WHERE sp.proposta_id = id
        AND sp.status IN ('pendente', 'em_analise')
    )
  );

-- ============================================================
-- ITENS_PROPOSTA
-- ============================================================

CREATE POLICY "itens_admin_full" ON public.itens_proposta
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "itens_vendedor" ON public.itens_proposta
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_id AND p.deleted_at IS NULL
        AND p.responsavel_id = auth.uid()
    )
  );

CREATE POLICY "itens_representante_read" ON public.itens_proposta
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_id AND p.deleted_at IS NULL
        AND (
          p.representante_id = get_my_representante_id()
          OR EXISTS (
            SELECT 1 FROM public.clientes c
            WHERE c.id = p.cliente_id AND c.deleted_at IS NULL
              AND (c.estado = ANY(get_my_estados()) OR c.representante_id = get_my_representante_id())
          )
        )
    )
  );

CREATE POLICY "itens_engenharia_read" ON public.itens_proposta
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'engenharia');

-- ============================================================
-- CHECKLIST_TECNICO
-- ============================================================

CREATE POLICY "checklist_admin_full" ON public.checklist_tecnico
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "checklist_vendedor" ON public.checklist_tecnico
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_id AND p.deleted_at IS NULL
        AND p.responsavel_id = auth.uid()
    )
  );

-- Engenharia: CRUD completo em todos os checklists
CREATE POLICY "checklist_engenharia_full" ON public.checklist_tecnico
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'engenharia');

CREATE POLICY "checklist_representante_read" ON public.checklist_tecnico
  FOR SELECT TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_id AND p.deleted_at IS NULL
        AND (
          p.representante_id = get_my_representante_id()
          OR EXISTS (
            SELECT 1 FROM public.clientes c
            WHERE c.id = p.cliente_id AND c.deleted_at IS NULL
              AND (c.estado = ANY(get_my_estados()) OR c.representante_id = get_my_representante_id())
          )
        )
    )
  );

-- ============================================================
-- FOLLOWUPS
-- ============================================================

CREATE POLICY "followups_admin_full" ON public.followups
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "followups_vendedor" ON public.followups
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_id AND p.deleted_at IS NULL
        AND p.responsavel_id = auth.uid()
    )
  );

-- Representante: CRUD em followups de propostas da sua região
CREATE POLICY "followups_representante" ON public.followups
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'representante'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_id AND p.deleted_at IS NULL
        AND (
          p.representante_id = get_my_representante_id()
          OR EXISTS (
            SELECT 1 FROM public.clientes c
            WHERE c.id = p.cliente_id AND c.deleted_at IS NULL
              AND (c.estado = ANY(get_my_estados()) OR c.representante_id = get_my_representante_id())
          )
        )
    )
  );

-- ============================================================
-- SOLICITACOES_PRECIFICACAO
-- ============================================================

CREATE POLICY "solicita_admin_full" ON public.solicitacoes_precificacao
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

-- Vendedor: cria (via proposta própria) e acompanha as suas
CREATE POLICY "solicita_vendedor" ON public.solicitacoes_precificacao
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND solicitante_id = auth.uid()
  )
  WITH CHECK (
    get_my_perfil() = 'vendedor_interno'
    AND solicitante_id = auth.uid()
  );

-- Engenharia: vê pendentes/em_analise, pode responder
CREATE POLICY "solicita_engenharia" ON public.solicitacoes_precificacao
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'engenharia'
    AND status IN ('pendente', 'em_analise')
  )
  WITH CHECK (
    get_my_perfil() = 'engenharia'
    AND status IN ('em_analise', 'respondida')
  );

-- ============================================================
-- PEDIDOS
-- ============================================================

CREATE POLICY "pedidos_admin_full" ON public.pedidos
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "pedidos_others_read" ON public.pedidos
  FOR SELECT TO authenticated
  USING (get_my_perfil() IN ('vendedor_interno', 'representante'));

-- ============================================================
-- PRODUTOS
-- ============================================================

CREATE POLICY "produtos_admin_full" ON public.produtos
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "produtos_vendedor_read" ON public.produtos
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'vendedor_interno' AND deleted_at IS NULL);

CREATE POLICY "produtos_engenharia_read" ON public.produtos
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'engenharia' AND deleted_at IS NULL);

-- ============================================================
-- VARIANTES_PRODUTO
-- ============================================================

CREATE POLICY "variantes_admin_full" ON public.variantes_produto
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "variantes_vendedor_read" ON public.variantes_produto
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'vendedor_interno');

CREATE POLICY "variantes_engenharia_read" ON public.variantes_produto
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'engenharia');

-- ============================================================
-- HISTORICO_PRECOS
-- ============================================================

CREATE POLICY "historico_admin_read" ON public.historico_precos
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "historico_engenharia_full" ON public.historico_precos
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'engenharia');

-- ============================================================
-- COMPATIBILIDADES_PRODUTO
-- ============================================================

CREATE POLICY "compat_admin_full" ON public.compatibilidades_produto
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "compat_others_read" ON public.compatibilidades_produto
  FOR SELECT TO authenticated
  USING (get_my_perfil() IN ('vendedor_interno', 'engenharia'));

-- ============================================================
-- METAS
-- ============================================================

CREATE POLICY "metas_admin_full" ON public.metas
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "metas_own_read" ON public.metas
  FOR SELECT TO authenticated
  USING (
    (get_my_perfil() = 'vendedor_interno' AND responsavel_id = auth.uid())
    OR (get_my_perfil() = 'representante' AND representante_id = get_my_representante_id())
  );

-- ============================================================
-- FICHAS_FRETE
-- ============================================================

CREATE POLICY "frete_admin_full" ON public.fichas_frete
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "frete_vendedor_full" ON public.fichas_frete
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'vendedor_interno');

CREATE POLICY "frete_representante_read" ON public.fichas_frete
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'representante');

-- ============================================================
-- FUNIS
-- ============================================================

CREATE POLICY "funis_admin_full" ON public.funis
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

-- Vendedor: lê templates globais (usuario_id IS NULL) + gerencia o próprio
CREATE POLICY "funis_vendedor" ON public.funis
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND (usuario_id IS NULL OR usuario_id = auth.uid())
  )
  WITH CHECK (
    get_my_perfil() = 'vendedor_interno'
    AND usuario_id = auth.uid()
  );

-- ============================================================
-- ETAPAS_FUNIL
-- ============================================================

CREATE POLICY "etapas_admin_full" ON public.etapas_funil
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "etapas_vendedor" ON public.etapas_funil
  FOR ALL TO authenticated
  USING (
    get_my_perfil() = 'vendedor_interno'
    AND EXISTS (
      SELECT 1 FROM public.funis f
      WHERE f.id = funil_id
        AND (f.usuario_id IS NULL OR f.usuario_id = auth.uid())
    )
  )
  WITH CHECK (
    get_my_perfil() = 'vendedor_interno'
    AND EXISTS (
      SELECT 1 FROM public.funis f
      WHERE f.id = funil_id AND f.usuario_id = auth.uid()
    )
  );

-- ============================================================
-- NOTIFICACOES
-- ============================================================

CREATE POLICY "notif_admin_full" ON public.notificacoes
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "notif_own" ON public.notificacoes
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- ============================================================
-- PREFERENCIAS_USUARIO
-- ============================================================

CREATE POLICY "pref_admin_full" ON public.preferencias_usuario
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "pref_own" ON public.preferencias_usuario
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- ============================================================
-- RASCUNHOS
-- ============================================================

CREATE POLICY "rascunho_admin_full" ON public.rascunhos
  FOR ALL TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "rascunho_own" ON public.rascunhos
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- ============================================================
-- AUDIT_LOG (somente leitura para admin; escrita via service_role)
-- ============================================================

CREATE POLICY "audit_admin_read" ON public.audit_log
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'admin');

-- ============================================================
-- SEQUENCIAS_PROPOSTA (acesso via função next_proposta_numero)
-- ============================================================

CREATE POLICY "seq_admin_read" ON public.sequencias_proposta
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'admin' AND get_my_pode_configurar() = true);



-- ============================================================
-- 004_seed.sql
-- ============================================================

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
VALUES (2026, 1162)
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



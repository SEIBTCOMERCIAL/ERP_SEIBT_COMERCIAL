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

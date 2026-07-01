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

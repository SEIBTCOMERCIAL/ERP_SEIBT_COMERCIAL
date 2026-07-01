-- Migration 007 — Notificações + Audit Log

-- ============================================================
-- NOTIFICAÇÕES IN-APP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo         text        NOT NULL,
  titulo       text        NOT NULL,
  corpo        text,
  lida         boolean     NOT NULL DEFAULT false,
  entidade     text,
  entidade_id  uuid,
  link         text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Cada usuário só vê as suas próprias notificações
CREATE POLICY "notif_usuario_select" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "notif_usuario_update" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Qualquer autenticado pode inserir (server actions usam anon key com perfil)
CREATE POLICY "notif_insert_autenticado" ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (get_my_perfil() IS NOT NULL);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id           uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_nome         text,
  acao                 text        NOT NULL,
  entidade             text        NOT NULL,
  entidade_id          uuid,
  entidade_referencia  text,
  dados                jsonb,
  criado_em            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (get_my_perfil() = 'admin');

CREATE POLICY "audit_insert_autenticado" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (get_my_perfil() IS NOT NULL);

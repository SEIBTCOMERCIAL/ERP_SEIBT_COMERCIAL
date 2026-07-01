"use server";

import { createClient } from "@/lib/supabase/server";

export async function registrarAuditoria({
  acao,
  entidade,
  entidade_id,
  entidade_referencia,
  dados,
}: {
  acao: string;
  entidade: string;
  entidade_id?: string;
  entidade_referencia?: string;
  dados?: Record<string, unknown>;
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    let usuarioNome: string | null = null;
    if (user?.id) {
      const { data } = await supabase
        .from("usuarios")
        .select("nome")
        .eq("id", user.id)
        .single();
      usuarioNome = data?.nome ?? null;
    }

    await supabase.from("audit_logs").insert({
      usuario_id: user?.id ?? null,
      usuario_nome: usuarioNome,
      acao,
      entidade,
      entidade_id: entidade_id ?? null,
      entidade_referencia: entidade_referencia ?? null,
      dados: dados ?? null,
    });
  } catch {
    // Auditoria nunca deve quebrar o fluxo principal
  }
}

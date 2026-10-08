"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarHistorico, usuarioAtual } from "@/lib/propostas/crm-servidor";

/** Texto livre do Checklist Técnico: observações, informações adicionais e ressalvas. */
export async function salvarObservacoesTecnicas(propostaId: string, texto: string): Promise<{ error?: string; success?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { error: "Não autorizado." };
  const novo = texto.trim().slice(0, 5000);

  const { data: proposta } = await supabase.from("propostas").select("id").eq("id", propostaId).is("deleted_at", null).maybeSingle();
  if (!proposta) return { error: "Proposta não encontrada ou sem acesso." };

  const { data: atual } = await supabase.from("checklist_tecnico").select("observacoes_tecnicas").eq("proposta_id", propostaId).maybeSingle();
  if ((atual?.observacoes_tecnicas ?? "") === novo) return { success: true };

  const { error } = await supabase
    .from("checklist_tecnico")
    .upsert({ proposta_id: propostaId, observacoes_tecnicas: novo || null }, { onConflict: "proposta_id" });
  if (error) return { error: error.message };

  await registrarHistorico(supabase, {
    propostaId,
    tipo: "checklist",
    descricao: "Observações técnicas atualizadas",
    detalhes: { anterior: atual?.observacoes_tecnicas ?? null, novo: novo || null },
  });
  revalidatePath(`/propostas/${propostaId}`);
  return { success: true };
}

/** Anotação livre no histórico da negociação. */
export async function adicionarObservacaoNegociacao(propostaId: string, texto: string): Promise<{ error?: string; success?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { error: "Não autorizado." };
  const nota = texto.trim().slice(0, 2000);
  if (!nota) return { error: "Escreva a observação." };

  const { data: proposta } = await supabase.from("propostas").select("id").eq("id", propostaId).is("deleted_at", null).maybeSingle();
  if (!proposta) return { error: "Proposta não encontrada ou sem acesso." };

  const { error } = await supabase.from("proposta_historico").insert({
    proposta_id: propostaId,
    tipo: "observacao",
    descricao: nota,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome,
  });
  if (error) return { error: error.message };
  revalidatePath(`/propostas/${propostaId}`);
  return { success: true };
}

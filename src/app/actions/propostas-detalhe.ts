"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarHistorico, usuarioAtual } from "@/lib/propostas/crm-servidor";
import { faltaEstruturaCrm } from "@/lib/propostas/crm";

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

/** Marca o item que dá nome à proposta (topo, cartão do funil e nome do arquivo Word). */
export async function definirItemCabecalho(propostaId: string, itemId: string): Promise<{ error?: string; success?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { error: "Não autorizado." };

  const { data: item } = await supabase.from("itens_proposta").select("id").eq("id", itemId).eq("proposta_id", propostaId).maybeSingle();
  if (!item) return { error: "Item não encontrado." };

  const { error: errLimpar } = await supabase.from("itens_proposta").update({ destaque: false }).eq("proposta_id", propostaId).neq("id", itemId);
  if (errLimpar) {
    return { error: faltaEstruturaCrm(errLimpar) ? "Esta opção depende da atualização do banco de dados (arquivo 028), que ainda não foi aplicada." : errLimpar.message };
  }
  const { data, error } = await supabase.from("itens_proposta").update({ destaque: true }).eq("id", itemId).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Você não tem permissão para alterar esta proposta." };
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
  return { success: true };
}

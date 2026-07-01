"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface PrecificacaoFormState {
  errors?: Record<string, string>;
  message?: string;
  success?: boolean;
}

export async function criarSolicitacaoPrecificacao(
  _prev: PrecificacaoFormState,
  formData: FormData
): Promise<PrecificacaoFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const proposta_id = formData.get("proposta_id") as string;
  const item_descricao = (formData.get("item_descricao") as string)?.trim();
  const especificacoes = (formData.get("especificacoes") as string)?.trim();
  const prazo_desejado = formData.get("prazo_desejado") as string;
  const urgente = formData.get("urgente") === "true";

  if (!item_descricao) return { errors: { item_descricao: "Obrigatório" } };

  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase.from("solicitacoes_precificacao").insert({
    proposta_id,
    item_descricao,
    especificacoes: especificacoes || null,
    prazo_desejado: prazo_desejado || null,
    urgente,
    solicitante_id: user?.user?.id ?? null,
    status: "pendente",
  });

  if (error) return { message: error.message };

  // marca item como aguardando
  await supabase
    .from("propostas")
    .update({ status: "aguardando_precificacao" })
    .eq("id", proposta_id);

  revalidatePath(`/propostas/${proposta_id}`);
  revalidatePath("/precificacao");
  return { success: true };
}

export async function responderSolicitacao(
  _prev: PrecificacaoFormState,
  formData: FormData
): Promise<PrecificacaoFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const solicitacao_id = formData.get("solicitacao_id") as string;
  const preco_respondido = parseFloat(formData.get("preco_respondido") as string);
  const resposta_engenharia = (formData.get("resposta_engenharia") as string)?.trim();

  if (!resposta_engenharia) return { errors: { resposta_engenharia: "Obrigatório" } };
  if (!preco_respondido || isNaN(preco_respondido)) return { errors: { preco_respondido: "Informe o preço" } };

  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("solicitacoes_precificacao")
    .update({
      preco_respondido,
      resposta_engenharia,
      respondido_por: user?.user?.id ?? null,
      respondido_em: new Date().toISOString(),
      status: "respondida",
    })
    .eq("id", solicitacao_id);

  if (error) return { message: error.message };

  revalidatePath("/precificacao");
  return { success: true };
}

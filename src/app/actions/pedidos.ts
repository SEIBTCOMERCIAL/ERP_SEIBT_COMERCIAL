"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type PedidoDEZFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

const pedidoSchema = z.object({
  proposta_id:     z.string().uuid("Proposta inválida"),
  numero_dez:      z.string().min(1, "Informe o número do pedido DEZ"),
  valor_fechado:   z.coerce.number().min(0.01, "Informe o valor fechado"),
  data_pedido_dez: z.string().optional().nullable(),
  observacoes:     z.string().optional(),
});

export async function registrarPedidoDEZ(
  _prev: PedidoDEZFormState,
  formData: FormData
): Promise<PedidoDEZFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const raw = {
    proposta_id:     formData.get("proposta_id"),
    numero_dez:      formData.get("numero_dez"),
    valor_fechado:   formData.get("valor_fechado"),
    data_pedido_dez: formData.get("data_pedido_dez") || null,
    observacoes:     formData.get("observacoes") || undefined,
  };

  const parsed = pedidoSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;

  // Verifica se numero_dez já existe
  const { data: existing } = await supabase
    .from("pedidos")
    .select("id, numero_dez")
    .eq("numero_dez", d.numero_dez)
    .maybeSingle();

  if (existing) {
    return { message: `Pedido DEZ "${d.numero_dez}" já está registrado. Verifique o número e tente novamente.` };
  }

  // Verifica se proposta já tem pedido DEZ
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, cliente_id, numero_completo, numero_pedido_dez, valor_total")
    .eq("id", d.proposta_id)
    .single();

  if (!proposta) return { message: "Proposta não encontrada" };

  if (proposta.numero_pedido_dez) {
    return { message: `Proposta ${proposta.numero_completo} já está vinculada ao pedido DEZ ${proposta.numero_pedido_dez}.` };
  }

  // Cria registro no pedidos
  const { error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      numero_dez:     d.numero_dez,
      proposta_id:    d.proposta_id,
      cliente_id:     proposta.cliente_id || null,
      valor:          d.valor_fechado,
      data_pedido:    d.data_pedido_dez || null,
      observacoes:    d.observacoes || null,
      registrado_por: user.id,
    });

  if (pedidoError) {
    return { message: "Erro ao registrar pedido: " + pedidoError.message };
  }

  // Atualiza proposta
  const { error: updateError } = await supabase
    .from("propostas")
    .update({
      numero_pedido_dez: d.numero_dez,
      valor_pedido_real: d.valor_fechado,
      data_pedido_dez:   d.data_pedido_dez || null,
      status:            "vendida",
      fechada_em:        new Date().toISOString(),
    })
    .eq("id", d.proposta_id);

  if (updateError) {
    return { message: "Pedido criado, mas erro ao atualizar proposta: " + updateError.message };
  }

  revalidatePath("/propostas");
  revalidatePath(`/propostas/${d.proposta_id}`);
  revalidatePath("/pedidos/reconciliar");
  redirect(`/propostas/${d.proposta_id}`);
}

export async function estornarPedidoDEZ(pedidoId: string, propostaId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  await supabase.from("pedidos").update({ estornado: true }).eq("id", pedidoId);
  await supabase
    .from("propostas")
    .update({
      numero_pedido_dez: null,
      valor_pedido_real: null,
      data_pedido_dez:   null,
      status:            "em_negociacao",
      fechada_em:        null,
    })
    .eq("id", propostaId);

  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/pedidos/reconciliar");
}

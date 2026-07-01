"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface MetaFormState {
  errors?: Record<string, string>;
  message?: string;
  success?: boolean;
}

export async function salvarMeta(
  _prev: MetaFormState,
  formData: FormData
): Promise<MetaFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const usuario_id = (formData.get("usuario_id") as string) || null;
  const mes = parseInt(formData.get("mes") as string);
  const ano = parseInt(formData.get("ano") as string);
  const meta_total_brl = parseFloat(formData.get("meta_total_brl") as string);
  const meta_maquinas_brl = parseFloat(formData.get("meta_maquinas_brl") as string) || null;
  const meta_pecas_brl = parseFloat(formData.get("meta_pecas_brl") as string) || null;

  if (!usuario_id) return { errors: { usuario_id: "Selecione um responsável" } };
  if (isNaN(meta_total_brl) || meta_total_brl <= 0) return { errors: { meta_total_brl: "Meta inválida" } };

  const { error } = await supabase
    .from("metas")
    .upsert(
      { usuario_id, mes, ano, meta_total_brl, meta_maquinas_brl, meta_pecas_brl, atualizado_em: new Date().toISOString() },
      { onConflict: "usuario_id,mes,ano" }
    );

  if (error) return { message: error.message };

  revalidatePath("/metas");
  return { success: true };
}

export async function atualizarRealizado(
  _prev: MetaFormState,
  formData: FormData
): Promise<MetaFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const usuario_id = formData.get("usuario_id") as string;
  const mes = parseInt(formData.get("mes") as string);
  const ano = parseInt(formData.get("ano") as string);

  // recalcula realizado a partir de propostas vendidas
  const { data: vendidas } = await supabase
    .from("propostas")
    .select("valor_total, data_pedido_dez, fechada_em")
    .eq("responsavel_id", usuario_id)
    .eq("status", "vendida")
    .is("deleted_at", null);

  const realizado = (vendidas ?? [])
    .filter((p: { fechada_em: string | null }) => {
      const d = p.fechada_em ? new Date(p.fechada_em) : null;
      return d && d.getMonth() + 1 === mes && d.getFullYear() === ano;
    })
    .reduce((a: number, p: { valor_total: number | null }) => a + (p.valor_total ?? 0), 0);

  const { error } = await supabase
    .from("metas")
    .update({ realizado_brl: realizado, atualizado_em: new Date().toISOString() })
    .eq("usuario_id", usuario_id)
    .eq("mes", mes)
    .eq("ano", ano);

  if (error) return { message: error.message };

  revalidatePath("/metas");
  return { success: true };
}

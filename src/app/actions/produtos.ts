"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const reajusteSchema = z.object({
  produto_id:   z.string().uuid(),
  variante_id:  z.string().uuid().optional().nullable(),
  novo_preco:   z.coerce.number().positive("Preço deve ser maior que zero"),
  percentual:   z.coerce.number().optional().nullable(),
  motivo:       z.enum(["Reajuste anual", "Variação cambial", "Custo matéria-prima", "Outro"]),
  data_vigencia: z.string().min(1, "Data obrigatória"),
});

export type ReajusteFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};

export async function reajustarPreco(
  _prev: ReajusteFormState,
  formData: FormData
): Promise<ReajusteFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const raw = {
    produto_id:    formData.get("produto_id"),
    variante_id:   formData.get("variante_id") || null,
    novo_preco:    formData.get("novo_preco"),
    percentual:    formData.get("percentual") || null,
    motivo:        formData.get("motivo"),
    data_vigencia: formData.get("data_vigencia"),
  };

  const parsed = reajusteSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const { data: produto, error: fetchErr } = await supabase
    .from("produtos")
    .select("preco_brl, preco_usd")
    .eq("id", d.produto_id)
    .single();

  if (fetchErr || !produto) return { message: "Produto não encontrado." };

  const preco_anterior_brl = produto.preco_brl as number | null;
  const percentual_calc = preco_anterior_brl && preco_anterior_brl > 0
    ? ((d.novo_preco - preco_anterior_brl) / preco_anterior_brl) * 100
    : (d.percentual ?? null);

  const { error: histError } = await supabase
    .from("historico_precos")
    .insert({
      produto_id:          d.produto_id,
      variante_id:         d.variante_id || null,
      preco_anterior_brl,
      preco_novo_brl:      d.novo_preco,
      percentual_reajuste: percentual_calc ? Math.round(percentual_calc * 100) / 100 : null,
      motivo:              d.motivo,
      data_reajuste:       d.data_vigencia,
      reajustado_por:      user.id,
    });

  if (histError) return { message: "Erro ao registrar histórico: " + histError.message };

  const { error: updateErr } = await supabase
    .from("produtos")
    .update({ preco_brl: d.novo_preco, atualizado_em: new Date().toISOString() })
    .eq("id", d.produto_id);

  if (updateErr) return { message: "Erro ao atualizar preço: " + updateErr.message };

  revalidatePath("/produtos");
  revalidatePath("/precos");

  return { success: true };
}

export async function atualizarTaxaCambio(
  _prev: ReajusteFormState,
  formData: FormData
): Promise<ReajusteFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const taxa = parseFloat(formData.get("taxa") as string);
  if (isNaN(taxa) || taxa <= 0) return { message: "Taxa inválida" };

  const { error } = await supabase
    .from("taxas_cambio")
    .insert({
      moeda: "USD",
      taxa,
      vigente_desde: new Date().toISOString().split("T")[0],
      atualizado_por: user.id,
    });

  if (error) return { message: "Erro ao atualizar taxa: " + error.message };

  revalidatePath("/produtos");
  revalidatePath("/precos");
  revalidatePath("/propostas/pecas/nova");

  return { success: true };
}

export async function registrarMaquina(
  _prev: { success?: boolean; maquinaId?: string; error?: string },
  formData: FormData
): Promise<{ success?: boolean; maquinaId?: string; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const cliente_id   = formData.get("cliente_id") as string;
  const modelo       = formData.get("modelo") as string;
  const numero_serie = (formData.get("numero_serie") as string) || null;
  const ano_str      = formData.get("ano_fabricacao") as string;
  const ano_fabricacao = ano_str ? parseInt(ano_str) : null;
  const plaqueta     = formData.get("plaqueta") as File | null;

  let plaqueta_foto_url: string | null = null;

  if (plaqueta && plaqueta.size > 0) {
    const ext = plaqueta.name.split(".").pop() ?? "jpg";
    const path = `${cliente_id}/${Date.now()}.${ext}`;
    const buffer = await plaqueta.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from("plaquetas")
      .upload(path, buffer, { contentType: plaqueta.type, upsert: false });

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from("plaquetas").getPublicUrl(path);
      plaqueta_foto_url = urlData?.publicUrl ?? null;
    }
  }

  const { data: maquina, error } = await supabase
    .from("maquinas_cliente")
    .insert({
      cliente_id,
      modelo: modelo || null,
      numero_serie,
      ano_fabricacao,
      plaqueta_foto_url,
      registrado_por: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: "Erro ao registrar máquina: " + error.message };

  revalidatePath(`/clientes/${cliente_id}`);

  return { success: true, maquinaId: maquina.id };
}

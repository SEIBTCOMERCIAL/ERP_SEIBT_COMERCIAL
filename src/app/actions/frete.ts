"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface FreteFormState {
  errors?: Record<string, string>;
  message?: string;
  success?: boolean;
  freteId?: string;
}

export async function criarFicha(
  _prev: FreteFormState,
  formData: FormData
): Promise<FreteFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const descricao_produto = (formData.get("descricao_produto") as string)?.trim();
  if (!descricao_produto) return { errors: { descricao_produto: "Obrigatório" } };

  const { data: user } = await supabase.auth.getUser();

  const payload = {
    pedido_numero: (formData.get("pedido_numero") as string) || null,
    descricao_produto,
    peso_bruto_kg: parseFloat(formData.get("peso_bruto_kg") as string) || null,
    volume_m3: parseFloat(formData.get("volume_m3") as string) || null,
    dimensoes_l: parseFloat(formData.get("dimensoes_l") as string) || null,
    dimensoes_a: parseFloat(formData.get("dimensoes_a") as string) || null,
    dimensoes_p: parseFloat(formData.get("dimensoes_p") as string) || null,
    tipo_frete: (formData.get("tipo_frete") as string) || "cif",
    cidade_origem: (formData.get("cidade_origem") as string) || null,
    estado_origem: (formData.get("estado_origem") as string) || null,
    endereco_origem: (formData.get("endereco_origem") as string) || null,
    cidade_destino: (formData.get("cidade_destino") as string) || null,
    estado_destino: (formData.get("estado_destino") as string) || null,
    endereco_destino: (formData.get("endereco_destino") as string) || null,
    transportadora: (formData.get("transportadora") as string) || null,
    observacoes: (formData.get("observacoes") as string) || null,
    proposta_id: (formData.get("proposta_id") as string) || null,
    criado_por: user?.user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("fretes")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { message: error.message };

  revalidatePath("/frete");
  return { success: true, freteId: data?.id };
}

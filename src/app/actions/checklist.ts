"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ChecklistFormState {
  errors?: Record<string, string>;
  message?: string;
  success?: boolean;
}

export async function salvarChecklist(
  _prev: ChecklistFormState,
  formData: FormData
): Promise<ChecklistFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const proposta_id = formData.get("proposta_id") as string;
  const segmento_aplicacao = (formData.get("segmento_aplicacao") as string)?.trim();
  const produto_final = (formData.get("produto_final") as string)?.trim();
  const material = (formData.get("material") as string)?.trim();
  const dimensoes = (formData.get("dimensoes") as string)?.trim();
  const granulometria = (formData.get("granulometria") as string)?.trim();
  const moagem_tipo = (formData.get("moagem_tipo") as string)?.trim();
  const forma_abastecimento = (formData.get("forma_abastecimento") as string)?.trim();
  const producao_horaria_kgh = parseFloat(formData.get("producao_horaria_kgh") as string);
  const voltagem = (formData.get("voltagem") as string)?.trim();

  const errors: Record<string, string> = {};
  if (!segmento_aplicacao) errors.segmento_aplicacao = "Obrigatório";
  if (!produto_final) errors.produto_final = "Obrigatório";
  if (!material) errors.material = "Obrigatório";
  if (!dimensoes) errors.dimensoes = "Obrigatório";
  if (!granulometria) errors.granulometria = "Obrigatório";
  if (!moagem_tipo) errors.moagem_tipo = "Obrigatório";
  if (!forma_abastecimento) errors.forma_abastecimento = "Obrigatório";
  if (!producao_horaria_kgh || isNaN(producao_horaria_kgh)) errors.producao_horaria_kgh = "Obrigatório";
  if (!voltagem) errors.voltagem = "Obrigatório";

  if (Object.keys(errors).length > 0) return { errors };

  const { data: user } = await supabase.auth.getUser();
  const completo = true;

  const { error } = await supabase
    .from("checklist_tecnico")
    .upsert(
      {
        proposta_id,
        segmento_aplicacao,
        produto_final,
        material,
        dimensoes,
        granulometria,
        moagem_tipo,
        forma_abastecimento,
        producao_horaria_kgh,
        voltagem,
        completo,
        preenchido_em: new Date().toISOString(),
        preenchido_por: user?.user?.id ?? null,
      },
      { onConflict: "proposta_id" }
    );

  if (error) return { message: error.message };

  revalidatePath(`/propostas/${proposta_id}`);
  return { success: true };
}

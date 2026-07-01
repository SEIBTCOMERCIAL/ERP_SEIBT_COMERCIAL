"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type FollowupFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

const followupSchema = z.object({
  proposta_id:        z.string().uuid(),
  data_contato:       z.string().min(1, "Data obrigatória"),
  canal:              z.enum(["whatsapp", "telefone", "email", "visita", "video", "sms", "outro"]),
  motivo:             z.string().optional(),
  descricao:          z.string().optional(),
  temperatura:        z.enum(["quente", "morna", "fria"]).optional().nullable(),
  proxima_acao_data:  z.string().optional().nullable(),
  proxima_acao_tipo:  z.string().optional().nullable(),
  proxima_acao_notas: z.string().optional().nullable(),
});

export async function criarFollowup(
  _prev: FollowupFormState,
  formData: FormData
): Promise<FollowupFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const raw = {
    proposta_id:        formData.get("proposta_id"),
    data_contato:       formData.get("data_contato"),
    canal:              formData.get("canal"),
    motivo:             formData.get("motivo") || undefined,
    descricao:          formData.get("descricao") || undefined,
    temperatura:        formData.get("temperatura") || null,
    proxima_acao_data:  formData.get("proxima_acao_data") || null,
    proxima_acao_tipo:  formData.get("proxima_acao_tipo") || null,
    proxima_acao_notas: formData.get("proxima_acao_notas") || null,
  };

  const parsed = followupSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const { error } = await supabase.from("followups").insert({
    proposta_id:        d.proposta_id,
    usuario_id:         user.id,
    data_contato:       d.data_contato,
    canal:              d.canal,
    motivo:             d.motivo   || null,
    descricao:          d.descricao || null,
    temperatura:        d.temperatura || null,
    proxima_acao_data:  d.proxima_acao_data  || null,
    proxima_acao_tipo:  d.proxima_acao_tipo  || null,
    proxima_acao_notas: d.proxima_acao_notas || null,
  });

  if (error) return { message: "Erro ao registrar follow-up: " + error.message };

  if (d.temperatura) {
    await supabase
      .from("propostas")
      .update({ temperatura: d.temperatura })
      .eq("id", d.proposta_id);
  }

  revalidatePath(`/propostas/${d.proposta_id}`);
  revalidatePath("/agenda");
  return {};
}

export async function excluirFollowup(followupId: string, propostaId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  await supabase.from("followups").delete().eq("id", followupId);
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/agenda");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const criarLeadSchema = z.object({
  empresa_nome:     z.string().optional().nullable(),
  contato_nome:     z.string().optional().nullable(),
  contato_telefone: z.string().optional().nullable(),
  contato_email:    z.string().email("E-mail inválido").optional().or(z.literal("")).nullable(),
  canal_entrada:    z.enum(["whatsapp","email","feira","site","indicacao","telefone","recorrencia","outro"]).default("outro"),
  tipo_interesse:   z.enum(["maquina","pecas","sistema","servico","exportacao"]).default("maquina"),
  representante_id: z.string().uuid().optional().nullable(),
  observacoes:      z.string().optional().nullable(),
});

export type LeadFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};

export async function criarLead(
  _prev: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const raw = {
    empresa_nome:     (formData.get("empresa_nome") as string) || null,
    contato_nome:     (formData.get("contato_nome") as string) || null,
    contato_telefone: (formData.get("contato_telefone") as string) || null,
    contato_email:    (formData.get("contato_email") as string) || null,
    canal_entrada:    formData.get("canal_entrada") || "outro",
    tipo_interesse:   formData.get("tipo_interesse") || "maquina",
    representante_id: (formData.get("representante_id") as string) || null,
    observacoes:      (formData.get("observacoes") as string) || null,
  };

  const parsed = criarLeadSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const { error } = await supabase.from("leads").insert({
    empresa_nome:     d.empresa_nome || null,
    contato_nome:     d.contato_nome || null,
    contato_telefone: d.contato_telefone || null,
    contato_email:    d.contato_email || null,
    canal_entrada:    d.canal_entrada,
    tipo_interesse:   d.tipo_interesse,
    responsavel_id:   user.id,
    representante_id: d.representante_id || null,
    observacoes:      d.observacoes || null,
    status:           "novo",
  });

  if (error) return { message: "Erro ao criar lead: " + error.message };

  revalidatePath("/leads");
  return { success: true };
}

export async function atualizarStatusLead(id: string, status: string): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/leads");
  return {};
}

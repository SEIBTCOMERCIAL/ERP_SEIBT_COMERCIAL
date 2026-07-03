"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const repSchema = z.object({
  nome:       z.string().min(1, "Nome obrigatório"),
  tipo:       z.enum(["externo", "interno_duplo"]),
  empresa:    z.string().optional().nullable(),
  telefone:   z.string().optional().nullable(),
  email:      z.string().email("E-mail inválido").optional().or(z.literal("")).nullable(),
  observacoes: z.string().optional().nullable(),
});

export type RepresentanteFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};

export async function criarRepresentante(
  _prev: RepresentanteFormState,
  formData: FormData
): Promise<RepresentanteFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const raw = {
    nome:        formData.get("nome"),
    tipo:        formData.get("tipo"),
    empresa:     (formData.get("empresa") as string) || null,
    telefone:    (formData.get("telefone") as string) || null,
    email:       (formData.get("email") as string) || null,
    observacoes: (formData.get("observacoes") as string) || null,
  };

  const parsed = repSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const { error } = await supabase.from("representantes").insert({
    nome:        d.nome,
    tipo:        d.tipo,
    empresa:     d.empresa || null,
    telefone:    d.telefone || null,
    email:       d.email || null,
    observacoes: d.observacoes || null,
    ativo:       true,
  });

  if (error) return { message: "Erro ao criar representante: " + error.message };

  revalidatePath("/representantes");
  return { success: true };
}

export async function atualizarRepresentante(
  _prev: RepresentanteFormState,
  formData: FormData
): Promise<RepresentanteFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const id = formData.get("id") as string;
  const raw = {
    nome:        formData.get("nome"),
    tipo:        formData.get("tipo"),
    empresa:     (formData.get("empresa") as string) || null,
    telefone:    (formData.get("telefone") as string) || null,
    email:       (formData.get("email") as string) || null,
    observacoes: (formData.get("observacoes") as string) || null,
  };

  const parsed = repSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const { error } = await supabase.from("representantes").update({
    nome:        d.nome,
    tipo:        d.tipo,
    empresa:     d.empresa || null,
    telefone:    d.telefone || null,
    email:       d.email || null,
    observacoes: d.observacoes || null,
  }).eq("id", id);

  if (error) return { message: "Erro ao atualizar: " + error.message };

  revalidatePath("/representantes");
  return { success: true };
}

export async function toggleAtivoRepresentante(id: string, ativo: boolean): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { error } = await supabase.from("representantes").update({ ativo: !ativo }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/representantes");
  return {};
}

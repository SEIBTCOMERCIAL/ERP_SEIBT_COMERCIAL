"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tipoDaEtapa } from "@/lib/leads/etapas";

type Resultado = { error?: string; success?: boolean };

const TIPOS = ["novo", "encaminhado", "em_qualificacao", "qualificado", "convertido", "descartado", "intermediaria"] as const;
const campos = z.object({
  nome: z.string().trim().min(1).max(80),
  cor: z.string().regex(/^#[0-9a-f]{6}$/i),
  tipo: z.enum(TIPOS).optional(),
});

async function admin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createClient() as any;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, erro: "Sessão expirada." };
  const { data: u } = await sb.from("usuarios").select("perfil").eq("id", user.id).single();
  if (u?.perfil !== "admin") return { sb, erro: "Somente administrador pode configurar etapas." };
  return { sb, erro: null as string | null };
}

export async function salvarEtapaLead(dados: unknown): Promise<Resultado> {
  const p = campos.safeParse(dados);
  if (!p.success) return { error: "Confira nome, cor e tipo." };
  const { sb, erro } = await admin();
  if (erro) return { error: erro };
  const { data: ultima } = await sb.from("etapas_lead").select("ordem").order("ordem", { ascending: false }).limit(1);
  const ordem = ((ultima?.[0]?.ordem as number | undefined) ?? -1) + 1;
  const { error } = await sb.from("etapas_lead").insert({ ...p.data, ordem });
  if (error) return { error: error.message as string };
  revalidatePath("/leads");
  return { success: true };
}

export async function atualizarEtapaLead(id: string, dados: unknown): Promise<Resultado> {
  const p = campos.safeParse(dados);
  if (!z.string().uuid().safeParse(id).success || !p.success) return { error: "Confira nome, cor e tipo." };
  const { sb, erro } = await admin();
  if (erro) return { error: erro };
  const { error } = await sb.from("etapas_lead").update(p.data).eq("id", id);
  if (error) return { error: error.message as string };
  revalidatePath("/leads");
  return { success: true };
}

/** Sobe ou desce a etapa uma posição e regrava a ordem de todas, sem repetir números. */
export async function reordenarEtapaLead(id: string, direcao: "subir" | "descer"): Promise<Resultado> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Etapa inválida." };
  const { sb, erro } = await admin();
  if (erro) return { error: erro };
  const { data: todas } = await sb.from("etapas_lead").select("id,ordem,nome").order("ordem").order("nome");
  const lista = (todas ?? []) as { id: string }[];
  const i = lista.findIndex((e) => e.id === id);
  const j = direcao === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return { success: true };
  [lista[i], lista[j]] = [lista[j], lista[i]];
  for (let k = 0; k < lista.length; k++) {
    const { error } = await sb.from("etapas_lead").update({ ordem: k }).eq("id", lista[k].id);
    if (error) return { error: error.message as string };
  }
  revalidatePath("/leads");
  return { success: true };
}

export async function excluirEtapaLead(id: string): Promise<Resultado> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Etapa inválida." };
  const { sb, erro } = await admin();
  if (erro) return { error: erro };
  const { data: etapa } = await sb.from("etapas_lead").select("*").eq("id", id).single();
  if (!etapa) return { error: "Etapa não encontrada." };
  const tipo = tipoDaEtapa(etapa);
  if (tipo === "convertido" || tipo === "descartado") return { error: "As etapas Convertido e Descartado são necessárias e não podem ser excluídas." };
  const { count } = await sb.from("leads").select("id", { count: "exact", head: true }).eq("etapa_id", id).is("deleted_at", null);
  if (count) return { error: `Há ${count} lead(s) nesta etapa. Mova-os para outra etapa antes de excluir.` };
  const { error } = await sb.from("etapas_lead").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir a etapa. Mova os leads dela e tente novamente." };
  revalidatePath("/leads");
  return { success: true };
}

"use server";

import { AVISO_ESTRUTURA_CRM, faltaEstruturaCrm } from "@/lib/propostas/crm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "./auditoria";

// ── CÂMBIO ──────────────────────────────────────────────────────────────────

export interface CambioState {
  error?: string;
  success?: boolean;
}

export async function atualizarCambio(
  _prev: CambioState,
  formData: FormData
): Promise<CambioState> {
  const taxaStr = formData.get("taxa") as string;
  const taxa = parseFloat(taxaStr.replace(",", "."));
  if (!taxa || taxa <= 0) return { error: "Taxa inválida." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("taxas_cambio").insert({
    moeda: "USD",
    taxa,
    vigente_desde: new Date().toISOString().split("T")[0],
    atualizado_por: user?.id ?? null,
  });

  if (error) return { error: error.message };

  await registrarAuditoria({
    acao: "atualizar_cambio",
    entidade: "taxas_cambio",
    dados: { moeda: "USD", taxa },
  });

  revalidatePath("/configuracoes");
  return { success: true };
}

// ── FUNIL — ETAPAS ──────────────────────────────────────────────────────────

export interface EtapaState {
  error?: string;
  success?: boolean;
}

export interface InatividadeState {
  error?: string;
  success?: boolean;
}

export async function salvarPrazosInatividade(
  _prev: InatividadeState,
  formData: FormData
): Promise<InatividadeState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("id", user.id)
    .single();
  if (perfil?.perfil !== "admin") return { error: "Somente o administrador pode alterar estes prazos." };

  const tipos = ["maquina", "pecas", "sistema", "servico", "mista"] as const;
  const registros = tipos.map((tipo) => ({
    tipo,
    dias_alerta: Number(formData.get(`${tipo}_alerta`)),
    dias_escalonamento_admin: Number(formData.get(`${tipo}_admin`)),
    atualizado_por: user.id,
    atualizado_em: new Date().toISOString(),
  }));

  for (const registro of registros) {
    if (!Number.isInteger(registro.dias_alerta) || registro.dias_alerta < 1 || registro.dias_alerta > 365) {
      return { error: "O prazo de alerta deve ficar entre 1 e 365 dias." };
    }
    if (!Number.isInteger(registro.dias_escalonamento_admin) || registro.dias_escalonamento_admin < registro.dias_alerta || registro.dias_escalonamento_admin > 365) {
      return { error: "O alerta do administrador deve ser igual ou posterior ao alerta do responsável." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("configuracoes_inatividade_proposta")
    .upsert(registros, { onConflict: "tipo" });
  if (error) return { error: faltaEstruturaCrm(error) ? AVISO_ESTRUTURA_CRM : error.message };

  await registrarAuditoria({
    acao: "atualizar_prazos_inatividade",
    entidade: "configuracoes_inatividade_proposta",
    dados: { prazos: registros.map(({ tipo, dias_alerta, dias_escalonamento_admin }) => ({ tipo, dias_alerta, dias_escalonamento_admin })) },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/propostas");
  return { success: true };
}

export async function criarEtapaFunil(
  _prev: EtapaState,
  formData: FormData
): Promise<EtapaState> {
  const funilId = formData.get("funil_id") as string;
  const nome = (formData.get("nome") as string)?.trim();
  const cor = (formData.get("cor") as string) || "#6B7B8D";
  const ordem = parseInt(formData.get("ordem") as string, 10) || 99;

  if (!funilId || !nome) return { error: "Nome obrigatório." };

  const admin = createAdminClient();
  const { error } = await admin.from("etapas_funil").insert({ funil_id: funilId, nome, cor, ordem, ativo: true });

  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function atualizarEtapaFunil(
  _prev: EtapaState,
  formData: FormData
): Promise<EtapaState> {
  const id = formData.get("id") as string;
  const nome = (formData.get("nome") as string)?.trim();
  const cor = formData.get("cor") as string;
  const ordem = parseInt(formData.get("ordem") as string, 10);

  if (!id || !nome) return { error: "Dados inválidos." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("etapas_funil")
    .update({ nome, cor, ordem })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function toggleEtapaFunil(id: string, ativo: boolean) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("etapas_funil")
    .update({ ativo })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function excluirEtapaFunil(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("etapas_funil").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

// ── FUNIL — CRUD ────────────────────────────────────────────────────────────

export async function criarFunil(
  _prev: EtapaState,
  formData: FormData
): Promise<EtapaState> {
  const nome = (formData.get("nome") as string)?.trim();
  const perfilAlvo = formData.get("perfil_alvo") as string || null;

  if (!nome) return { error: "Nome obrigatório." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from("funis").insert({
    nome,
    usuario_id: null,
    perfil_alvo: perfilAlvo,
    criado_por: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

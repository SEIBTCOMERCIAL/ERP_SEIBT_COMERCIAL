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

// Todas as ações abaixo (funil, etapas e motivos) são exclusivas do administrador.
async function exigirAdmin(): Promise<{ erro: string; usuarioId?: undefined } | { erro?: undefined; usuarioId: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Não autorizado." };
  const { data } = await supabase.from("usuarios").select("perfil").eq("id", user.id).maybeSingle();
  if (data?.perfil !== "admin") return { erro: "Somente o administrador pode alterar o funil e os motivos." };
  return { usuarioId: user.id };
}

const TIPOS_ETAPA_VALIDOS = ["inicial", "intermediaria", "ganho", "perda", "congelamento"];

function lerCamposEtapa(formData: FormData) {
  const tipoBruto = String(formData.get("tipo") ?? "intermediaria");
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    cor: String(formData.get("cor") ?? "") || "#6B7B8D",
    tipo: TIPOS_ETAPA_VALIDOS.includes(tipoBruto) ? tipoBruto : "intermediaria",
    exige_proxima_acao: formData.get("exige_proxima_acao") === "on",
  };
}

/** Só pode existir uma etapa inicial ativa por funil: ao marcar outra, a anterior vira intermediária. */
async function liberarEtapaInicial(admin: ReturnType<typeof createAdminClient>, funilId: string, exceto?: string) {
  let q = admin.from("etapas_funil").update({ tipo: "intermediaria" }).eq("funil_id", funilId).eq("tipo", "inicial");
  if (exceto) q = q.neq("id", exceto);
  await q;
}

export async function criarEtapaFunil(
  _prev: EtapaState,
  formData: FormData
): Promise<EtapaState> {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };

  const funilId = formData.get("funil_id") as string;
  const campos = lerCamposEtapa(formData);
  if (!funilId || !campos.nome) return { error: "Nome obrigatório." };

  const admin = createAdminClient();
  const { data: ultima } = await admin.from("etapas_funil").select("ordem").eq("funil_id", funilId).order("ordem", { ascending: false }).limit(1).maybeSingle();
  const ordem = (ultima?.ordem ?? 0) + 1;

  if (campos.tipo === "inicial") await liberarEtapaInicial(admin, funilId);
  const { error } = await admin.from("etapas_funil").insert({ funil_id: funilId, ordem, ativo: true, ...campos });
  if (error) {
    if (faltaEstruturaCrm(error)) return { error: AVISO_ESTRUTURA_CRM.replace("022", "024") };
    return { error: error.message };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/propostas");
  return { success: true };
}

export async function atualizarEtapaFunil(
  _prev: EtapaState,
  formData: FormData
): Promise<EtapaState> {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };

  const id = formData.get("id") as string;
  const campos = lerCamposEtapa(formData);
  if (!id || !campos.nome) return { error: "Dados inválidos." };

  const admin = createAdminClient();
  const { data: atual } = await admin.from("etapas_funil").select("funil_id, tipo").eq("id", id).maybeSingle();
  if (!atual) return { error: "Etapa não encontrada." };

  // Não deixar o funil sem etapa inicial nem sem etapa de ganho/perda.
  if (atual.tipo && atual.tipo !== campos.tipo && ["inicial", "ganho", "perda"].includes(atual.tipo)) {
    const { count } = await admin.from("etapas_funil").select("id", { count: "exact", head: true })
      .eq("funil_id", atual.funil_id).eq("tipo", atual.tipo).eq("ativo", true).neq("id", id);
    if (!count) return { error: `O funil precisa de pelo menos uma etapa do tipo "${atual.tipo}". Marque outra etapa como "${atual.tipo}" antes.` };
  }

  if (campos.tipo === "inicial") await liberarEtapaInicial(admin, atual.funil_id, id);
  const { error } = await admin.from("etapas_funil").update(campos).eq("id", id);
  if (error) return { error: faltaEstruturaCrm(error) ? AVISO_ESTRUTURA_CRM.replace("022", "024") : error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/propostas");
  return { success: true };
}

export async function reordenarEtapaFunil(id: string, direcao: "subir" | "descer") {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };

  const admin = createAdminClient();
  const { data: atual } = await admin.from("etapas_funil").select("id, funil_id, ordem").eq("id", id).maybeSingle();
  if (!atual) return { error: "Etapa não encontrada." };
  const { data: lista } = await admin.from("etapas_funil").select("id, ordem").eq("funil_id", atual.funil_id).order("ordem").order("id");
  const etapas = (lista ?? []) as Array<{ id: string; ordem: number }>;
  const i = etapas.findIndex((e) => e.id === id);
  const j = direcao === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= etapas.length) return { success: true };

  // Regrava a ordem 1..n da lista já trocada (evita ordens repetidas).
  [etapas[i], etapas[j]] = [etapas[j], etapas[i]];
  for (let k = 0; k < etapas.length; k++) {
    if (etapas[k].ordem !== k + 1) await admin.from("etapas_funil").update({ ordem: k + 1 }).eq("id", etapas[k].id);
  }
  revalidatePath("/configuracoes");
  revalidatePath("/propostas");
  return { success: true };
}

export async function toggleEtapaFunil(id: string, ativo: boolean) {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };

  const admin = createAdminClient();
  if (!ativo) {
    const { data: etapa } = await admin.from("etapas_funil").select("funil_id, tipo").eq("id", id).maybeSingle();
    if (etapa?.tipo && ["inicial", "ganho", "perda"].includes(etapa.tipo)) {
      const { count } = await admin.from("etapas_funil").select("id", { count: "exact", head: true })
        .eq("funil_id", etapa.funil_id).eq("tipo", etapa.tipo).eq("ativo", true).neq("id", id);
      if (!count) return { error: `Esta é a única etapa ativa do tipo "${etapa.tipo}". Marque outra etapa com esse tipo antes de desativar.` };
    }
  }
  const { error } = await admin.from("etapas_funil").update({ ativo }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/propostas");
  return { success: true };
}

export async function excluirEtapaFunil(id: string) {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };

  const admin = createAdminClient();
  const { data: etapa } = await admin.from("etapas_funil").select("funil_id, tipo").eq("id", id).maybeSingle();
  if (!etapa) return { error: "Etapa não encontrada." };

  // Propostas nunca ficam sem etapa por causa de uma exclusão.
  const { count: emUso } = await admin.from("propostas").select("id", { count: "exact", head: true }).eq("etapa_funil_id", id).is("deleted_at", null);
  if (emUso) return { error: `Há ${emUso} ${emUso === 1 ? "proposta" : "propostas"} nesta etapa. Mova-as para outra etapa ou apenas desative esta etapa.` };

  if (etapa.tipo && ["inicial", "ganho", "perda"].includes(etapa.tipo)) {
    const { count } = await admin.from("etapas_funil").select("id", { count: "exact", head: true })
      .eq("funil_id", etapa.funil_id).eq("tipo", etapa.tipo).eq("ativo", true).neq("id", id);
    if (!count) return { error: `Esta é a única etapa do tipo "${etapa.tipo}". Marque outra etapa com esse tipo antes de excluir.` };
  }

  const { error } = await admin.from("etapas_funil").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  revalidatePath("/propostas");
  return { success: true };
}

// ── FUNIL — CRUD ────────────────────────────────────────────────────────────

export async function criarFunil(
  _prev: EtapaState,
  formData: FormData
): Promise<EtapaState> {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };

  const nome = (formData.get("nome") as string)?.trim();
  const perfilAlvo = formData.get("perfil_alvo") as string || null;

  if (!nome) return { error: "Nome obrigatório." };

  const admin = createAdminClient();
  const { error } = await admin.from("funis").insert({
    nome,
    usuario_id: null,
    perfil_alvo: perfilAlvo,
    criado_por: auth.usuarioId,
  });

  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

// ── MOTIVOS PADRÃO ──────────────────────────────────────────────────────────

export interface MotivoState {
  error?: string;
  success?: boolean;
}

const CATEGORIAS_VALIDAS = ["perda", "congelamento", "complementar"];

function gerarCodigo(nome: string) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "motivo";
}

export async function criarMotivo(
  _prev: MotivoState,
  formData: FormData
): Promise<MotivoState> {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };

  const categoria = String(formData.get("categoria") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!CATEGORIAS_VALIDAS.includes(categoria)) return { error: "Categoria inválida." };
  if (!nome) return { error: "Escreva o nome do motivo." };

  const admin = createAdminClient();
  const { data: existentes, error: errLeitura } = await admin.from("motivos_proposta").select("codigo, nome, ordem").eq("categoria", categoria);
  if (errLeitura) return { error: faltaEstruturaCrm(errLeitura) ? AVISO_ESTRUTURA_CRM.replace("022", "024") : errLeitura.message };
  const lista = (existentes ?? []) as Array<{ codigo: string; nome: string; ordem: number }>;
  if (lista.some((m) => m.nome.trim().toLowerCase() === nome.toLowerCase())) return { error: "Já existe um motivo com esse nome." };

  const base = gerarCodigo(nome);
  let codigo = base;
  for (let n = 2; lista.some((m) => m.codigo === codigo); n++) codigo = `${base}_${n}`;
  const ordem = Math.max(0, ...lista.map((m) => m.ordem)) + 1;

  const { error } = await admin.from("motivos_proposta").insert({ categoria, codigo, nome, ordem, ativo: true });
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

export async function renomearMotivo(id: string, nome: string) {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };
  const novo = nome.trim();
  if (!novo) return { error: "Escreva o nome do motivo." };
  const { error } = await createAdminClient().from("motivos_proposta").update({ nome: novo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

/** Motivos já usados em propostas nunca são apagados: apenas desativados (somem da lista de escolha). */
export async function alternarMotivo(id: string, ativo: boolean) {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };
  const admin = createAdminClient();
  if (!ativo) {
    const { data: motivo } = await admin.from("motivos_proposta").select("categoria").eq("id", id).maybeSingle();
    if (motivo) {
      const { count } = await admin.from("motivos_proposta").select("id", { count: "exact", head: true }).eq("categoria", motivo.categoria).eq("ativo", true).neq("id", id);
      if (!count) return { error: "Mantenha pelo menos um motivo ativo em cada lista." };
    }
  }
  const { error } = await admin.from("motivos_proposta").update({ ativo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

export async function reordenarMotivo(id: string, direcao: "subir" | "descer") {
  const auth = await exigirAdmin();
  if (auth.erro) return { error: auth.erro };
  const admin = createAdminClient();
  const { data: atual } = await admin.from("motivos_proposta").select("categoria").eq("id", id).maybeSingle();
  if (!atual) return { error: "Motivo não encontrado." };
  const { data: lista } = await admin.from("motivos_proposta").select("id, ordem").eq("categoria", atual.categoria).order("ordem").order("id");
  const motivos = (lista ?? []) as Array<{ id: string; ordem: number }>;
  const i = motivos.findIndex((m) => m.id === id);
  const j = direcao === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= motivos.length) return { success: true };
  [motivos[i], motivos[j]] = [motivos[j], motivos[i]];
  for (let k = 0; k < motivos.length; k++) {
    if (motivos[k].ordem !== k + 1) await admin.from("motivos_proposta").update({ ordem: k + 1 }).eq("id", motivos[k].id);
  }
  revalidatePath("/configuracoes");
  return { success: true };
}

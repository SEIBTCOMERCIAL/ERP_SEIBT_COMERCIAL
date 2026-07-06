"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminState = { error?: string; success?: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(): Promise<{ supabase: any; userId: string } | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };
  const { data: u } = await supabase.from("usuarios").select("perfil").eq("id", user.id).single();
  if (u?.perfil !== "admin") return { error: "Acesso restrito a administradores" };
  return { supabase, userId: user.id };
}

// ─── Linhas ──────────────────────────────────────────────────────────────────

export async function criarLinha(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const nome = (formData.get("nome") as string)?.trim();
  if (!nome) return { error: "Nome obrigatório" };
  const { error } = await auth.supabase.from("linhas").insert({ nome, criado_por: auth.userId });
  if (error) return { error: error.message.includes("unique") ? `A linha "${nome}" já existe` : error.message };
  revalidatePath("/produtos");
  return { success: true };
}

export async function excluirLinha(id: string): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { count } = await auth.supabase.from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("linha_id", id).is("deleted_at", null);
  if ((count ?? 0) > 0) return { error: "Remova os equipamentos desta linha antes de excluí-la" };
  const { error } = await auth.supabase.from("linhas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/produtos");
  return { success: true };
}

// ─── Categorias de peça ───────────────────────────────────────────────────────

export async function criarCategoriaPeca(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const nome = (formData.get("nome") as string)?.trim();
  if (!nome) return { error: "Nome obrigatório" };
  const { error } = await auth.supabase.from("categorias_peca").insert({ nome, criado_por: auth.userId });
  if (error) return { error: error.message.includes("unique") ? `A categoria "${nome}" já existe` : error.message };
  revalidatePath("/produtos");
  return { success: true };
}

export async function excluirCategoriaPeca(id: string): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { count } = await auth.supabase.from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("categoria_peca_id", id).is("deleted_at", null);
  if ((count ?? 0) > 0) return { error: "Remova as peças desta categoria antes de excluí-la" };
  const { error } = await auth.supabase.from("categorias_peca").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/produtos");
  return { success: true };
}

// ─── Equipamentos ─────────────────────────────────────────────────────────────

function parseCurr(s: string | null | undefined): number | null {
  if (!s || !s.trim()) return null;
  const clean = s.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

export async function criarEquipamento(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const linha_id = formData.get("linha_id") as string;
  const codigo = (formData.get("codigo") as string)?.trim();
  const descricao = (formData.get("descricao") as string)?.trim();
  if (!codigo || !descricao) return { error: "Código e descrição obrigatórios" };
  const preco_brl = parseCurr(formData.get("preco_brl") as string);
  const preco_painel_220 = parseCurr(formData.get("preco_painel_220") as string);
  const preco_painel_380 = parseCurr(formData.get("preco_painel_380") as string);
  const ncm = (formData.get("ncm") as string)?.trim() || null;
  const descricao_painel = (formData.get("descricao_painel") as string)?.trim() || null;
  const potencia_motor = (formData.get("potencia_motor") as string)?.trim() || null;
  const specs: Record<string, string> = {};
  Array.from(formData.entries()).forEach(([key, val]) => {
    if (key.startsWith("spec__") && (val as string).trim()) specs[key.slice(6)] = (val as string).trim();
  });
  const { error } = await auth.supabase.from("produtos").insert({
    codigo, descricao, descricao_painel, potencia_motor, categoria: "maquina", linha_id,
    preco_brl, preco_painel_220, preco_painel_380,
    ncm, ipi_pct: 0, ativo: true, tem_variantes: false, specs,
  });
  if (error) return { error: error.message.includes("unique") ? `Código "${codigo}" já cadastrado` : error.message };
  revalidatePath(`/produtos/linhas/${linha_id}`);
  return { success: true };
}

export async function editarEquipamento(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const id = formData.get("id") as string;
  const linha_id = formData.get("linha_id") as string;
  const descricao = (formData.get("descricao") as string)?.trim();
  if (!descricao) return { error: "Descrição obrigatória" };
  const preco_brl = parseCurr(formData.get("preco_brl") as string);
  const preco_painel_220 = parseCurr(formData.get("preco_painel_220") as string);
  const preco_painel_380 = parseCurr(formData.get("preco_painel_380") as string);
  const ncm = (formData.get("ncm") as string)?.trim() || null;
  const descricao_painel = (formData.get("descricao_painel") as string)?.trim() || null;
  const potencia_motor = (formData.get("potencia_motor") as string)?.trim() || null;
  const specs: Record<string, string> = {};
  Array.from(formData.entries()).forEach(([key, val]) => {
    if (key.startsWith("spec__") && (val as string).trim()) specs[key.slice(6)] = (val as string).trim();
  });
  const { error } = await auth.supabase.from("produtos")
    .update({ descricao, descricao_painel, potencia_motor, preco_brl, preco_painel_220, preco_painel_380, ncm, specs, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/linhas/${linha_id}`);
  revalidatePath(`/produtos/linhas/${linha_id}/${id}`);
  return { success: true };
}

export async function excluirEquipamento(id: string, linhaId: string): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase.from("produtos")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/linhas/${linhaId}`);
  return { success: true };
}

// ─── Peças ───────────────────────────────────────────────────────────────────

export async function criarPeca(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const categoria_peca_id = formData.get("categoria_peca_id") as string;
  const codigo = (formData.get("codigo") as string)?.trim();
  const descricao = (formData.get("descricao") as string)?.trim();
  if (!codigo || !descricao) return { error: "Código e descrição obrigatórios" };
  const preco_brl = parseFloat(formData.get("preco_brl") as string) || null;
  const ipi_pct = parseFloat(formData.get("ipi_pct") as string) || 0;
  const ncm = (formData.get("ncm") as string)?.trim() || null;

  // Determine categoria from categoria_peca_id nome
  const { data: cat } = await auth.supabase.from("categorias_peca").select("nome").eq("id", categoria_peca_id).single();
  const nomeMap: Record<string, string> = {
    Navalhas: "navalha", Peneiras: "peneira", Rolamentos: "rolamento",
    Parafusos: "parafuso", Rotores: "rotor", Insertos: "inserto",
  };
  const categoria = nomeMap[cat?.nome ?? ""] ?? "outro";

  const { error } = await auth.supabase.from("produtos").insert({
    codigo, descricao, categoria, categoria_peca_id,
    preco_brl, ipi_pct, ncm, ativo: true, tem_variantes: false,
  });
  if (error) return { error: error.message.includes("unique") ? `Código "${codigo}" já cadastrado` : error.message };
  revalidatePath(`/produtos/categorias/${categoria_peca_id}`);
  return { success: true };
}

export async function editarPeca(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const id = formData.get("id") as string;
  const categoria_peca_id = formData.get("categoria_peca_id") as string;
  const descricao = (formData.get("descricao") as string)?.trim();
  if (!descricao) return { error: "Descrição obrigatória" };
  const preco_brl = parseFloat(formData.get("preco_brl") as string) || null;
  const ipi_pct = parseFloat(formData.get("ipi_pct") as string) || 0;
  const ncm = (formData.get("ncm") as string)?.trim() || null;
  const { error } = await auth.supabase.from("produtos")
    .update({ descricao, preco_brl, ipi_pct, ncm, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/categorias/${categoria_peca_id}`);
  return { success: true };
}

export async function excluirPeca(id: string, categoriaId: string): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase.from("produtos")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/categorias/${categoriaId}`);
  return { success: true };
}

// ─── Arquivos de produto ──────────────────────────────────────────────────────

export async function uploadArquivoProduto(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const produto_id = formData.get("produto_id") as string;
  const linha_id = formData.get("linha_id") as string;
  const tipo = formData.get("tipo") as "imagem" | "desenho";
  const file = formData.get("arquivo") as File;
  if (!file || file.size === 0) return { error: "Arquivo obrigatório" };
  if (file.size > 52428800) return { error: "Arquivo muito grande (máx 50MB)" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${produto_id}/${tipo}/${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("produto-arquivos")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Falha no upload: " + upErr.message };
  const { data: urlData } = admin.storage.from("produto-arquivos").getPublicUrl(path);
  const { error } = await auth.supabase.from("produto_arquivos").insert({
    produto_id, tipo, nome: file.name, url: urlData.publicUrl, storage_path: path,
  });
  if (error) return { error: error.message };
  revalidatePath(`/produtos/linhas/${linha_id}/${produto_id}`);
  return { success: true };
}

export async function excluirArquivoProduto(
  arquivoId: string,
  storagePath: string | null,
  produtoId: string,
  linhaId: string
): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  if (storagePath) {
    const admin = createAdminClient();
    await admin.storage.from("produto-arquivos").remove([storagePath]);
  }
  const { error } = await auth.supabase.from("produto_arquivos").delete().eq("id", arquivoId);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/linhas/${linhaId}/${produtoId}`);
  return { success: true };
}

// ─── Specs e preços de painel (edição inline no detalhe) ─────────────────────

export async function atualizarPaineis(
  produtoId: string,
  linhaId: string,
  preco_brl: number | null,
  preco_painel_220: number | null,
  preco_painel_380: number | null
): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase.from("produtos")
    .update({ preco_brl, preco_painel_220, preco_painel_380, atualizado_em: new Date().toISOString() })
    .eq("id", produtoId);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/linhas/${linhaId}/${produtoId}`);
  revalidatePath(`/produtos/linhas/${linhaId}`);
  return { success: true };
}

export async function atualizarSpecs(
  produtoId: string,
  linhaId: string,
  specsJson: string
): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  let specs: Record<string, unknown> = {};
  try { specs = JSON.parse(specsJson); } catch { return { error: "JSON inválido" }; }
  const { error } = await auth.supabase.from("produtos")
    .update({ specs, atualizado_em: new Date().toISOString() })
    .eq("id", produtoId);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/linhas/${linhaId}/${produtoId}`);
  return { success: true };
}

// ─── Duplicar equipamento ─────────────────────────────────────────────────────

export async function duplicarEquipamento(
  equipId: string,
  linhaId: string
): Promise<{ novoId?: string; error?: string }> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const { data: orig, error: fetchErr } = await auth.supabase
    .from("produtos")
    .select("codigo, descricao, categoria, linha_id, preco_brl, preco_painel_220, preco_painel_380, ncm, ipi_pct, specs, ativo")
    .eq("id", equipId)
    .single();

  if (fetchErr || !orig) return { error: "Equipamento não encontrado" };

  const novoCodigo = `CÓPIA ${orig.codigo}`;
  const { data: novo, error: insErr } = await auth.supabase
    .from("produtos")
    .insert({
      codigo: novoCodigo,
      descricao: orig.descricao,
      categoria: orig.categoria,
      linha_id: orig.linha_id,
      preco_brl: orig.preco_brl,
      preco_painel_220: orig.preco_painel_220,
      preco_painel_380: orig.preco_painel_380,
      ncm: orig.ncm,
      ipi_pct: orig.ipi_pct ?? 0,
      specs: orig.specs,
      ativo: true,
      status: "ativo",
      tem_variantes: false,
    })
    .select("id")
    .single();

  if (insErr) return { error: insErr.message };

  revalidatePath(`/produtos/linhas/${linhaId}`);
  return { novoId: novo.id };
}

// ─── Status do equipamento ────────────────────────────────────────────────────

export async function atualizarStatusEquipamento(
  id: string,
  linhaId: string,
  status: "ativo" | "descontinuado"
): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase.from("produtos")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/linhas/${linhaId}`);
  revalidatePath(`/produtos/linhas/${linhaId}/${id}`);
  return { success: true };
}

// ─── Template de specs por linha ─────────────────────────────────────────────

export async function criarLinhaSpecCampo(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const linha_id = formData.get("linha_id") as string;
  const nome = (formData.get("nome") as string)?.trim();
  if (!nome) return { error: "Nome do campo obrigatório" };
  const { data: last } = await auth.supabase
    .from("linha_spec_campos")
    .select("ordem")
    .eq("linha_id", linha_id)
    .order("ordem", { ascending: false })
    .limit(1);
  const ordem = ((last?.[0]?.ordem ?? 0) as number) + 1;
  const { error } = await auth.supabase.from("linha_spec_campos").insert({ linha_id, nome, ordem });
  if (error) return { error: error.message.includes("unique") ? `Campo "${nome}" já existe nesta linha` : error.message };
  revalidatePath(`/produtos/linhas/${linha_id}`);
  return { success: true };
}

export async function excluirLinhaSpecCampo(id: string, linhaId: string): Promise<AdminState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase.from("linha_spec_campos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/produtos/linhas/${linhaId}`);
  return { success: true };
}

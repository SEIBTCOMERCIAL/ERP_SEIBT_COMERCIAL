"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/propostas/crm-servidor";
import { faltaEstruturaCrm } from "@/lib/propostas/crm";

// Cadastro dos jogos de navalhas: somente administrador. Os preços ficam no cadastro de cada peça.

interface Resultado {
  error?: string;
  success?: boolean;
}

const AVISO_SEM_TABELA = "Os jogos de navalhas dependem da atualização do banco de dados (arquivo 026), que ainda não foi aplicada.";

async function exigirAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (usuario?.perfil !== "admin") return { erro: "Somente o administrador altera os jogos de navalhas." as const };
  return { supabase };
}

function atualizarTelas(equipamentoId?: string | null) {
  revalidatePath("/produtos", "layout");
  if (equipamentoId) revalidatePath(`/produtos/linhas`, "layout");
  revalidatePath("/propostas/maquinas/nova");
  revalidatePath("/propostas/pecas/nova");
}

function msg(error: { code?: string; message?: string }) {
  return faltaEstruturaCrm(error as { code?: string; message?: string }) ? AVISO_SEM_TABELA : error.message ?? "Erro desconhecido.";
}

export async function criarJogoNavalha(equipamentoId: string, nome: string, material: string): Promise<Resultado> {
  const auth = await exigirAdmin();
  if ("erro" in auth) return { error: auth.erro };
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) return { error: "Dê um nome ao jogo (ex.: Padrão, Aço rápido)." };
  const { data: ultimo } = await auth.supabase.from("jogos_navalha").select("ordem").eq("equipamento_id", equipamentoId).order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { error } = await auth.supabase.from("jogos_navalha").insert({
    equipamento_id: equipamentoId, nome: nomeLimpo, material: material.trim() || null, ordem: (ultimo?.ordem ?? 0) + 1,
  });
  if (error) return { error: msg(error) };
  atualizarTelas(equipamentoId);
  return { success: true };
}

export async function atualizarJogoNavalha(jogoId: string, dados: { nome: string; material: string; ativo: boolean }): Promise<Resultado> {
  const auth = await exigirAdmin();
  if ("erro" in auth) return { error: auth.erro };
  if (!dados.nome.trim()) return { error: "Dê um nome ao jogo." };
  const { error } = await auth.supabase.from("jogos_navalha").update({
    nome: dados.nome.trim(), material: dados.material.trim() || null, ativo: dados.ativo,
  }).eq("id", jogoId);
  if (error) return { error: msg(error) };
  atualizarTelas();
  return { success: true };
}

/** Copia o jogo (com as linhas) para criar uma variação, por exemplo de outro material. */
export async function duplicarJogoNavalha(jogoId: string, novoNome: string): Promise<Resultado> {
  const auth = await exigirAdmin();
  if ("erro" in auth) return { error: auth.erro };
  const { data: jogo } = await auth.supabase.from("jogos_navalha").select("equipamento_id, material").eq("id", jogoId).maybeSingle();
  if (!jogo) return { error: "Jogo não encontrado." };
  const { data: itens } = await auth.supabase.from("jogos_navalha_itens").select("produto_id, titulo, pecas, codigo, ordem").eq("jogo_id", jogoId).order("ordem");
  const { data: ultimo } = await auth.supabase.from("jogos_navalha").select("ordem").eq("equipamento_id", jogo.equipamento_id).order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { data: novo, error } = await auth.supabase.from("jogos_navalha").insert({
    equipamento_id: jogo.equipamento_id, nome: novoNome.trim() || "Novo jogo", material: jogo.material, ordem: (ultimo?.ordem ?? 0) + 1,
  }).select("id").single();
  if (error || !novo) return { error: msg(error ?? {}) };
  if (itens?.length) {
    const { error: errItens } = await auth.supabase.from("jogos_navalha_itens").insert(
      (itens as Array<{ produto_id: string; titulo: string; pecas: number; codigo: string | null; ordem: number }>).map((i) => ({ ...i, jogo_id: novo.id }))
    );
    if (errItens) return { error: msg(errItens) };
  }
  atualizarTelas(jogo.equipamento_id);
  return { success: true };
}

export async function excluirJogoNavalha(jogoId: string): Promise<Resultado> {
  const auth = await exigirAdmin();
  if ("erro" in auth) return { error: auth.erro };
  const { error } = await auth.supabase.from("jogos_navalha").delete().eq("id", jogoId);
  if (error) return { error: msg(error) };
  atualizarTelas();
  return { success: true };
}

export async function salvarItemJogoNavalha(
  jogoId: string,
  item: { id?: string; produtoId: string; titulo: string; pecas: number; codigo: string }
): Promise<Resultado> {
  const auth = await exigirAdmin();
  if ("erro" in auth) return { error: auth.erro };
  if (!item.produtoId) return { error: "Escolha a navalha do cadastro." };
  if (!item.titulo.trim()) return { error: "Escreva o título da linha." };
  if (!Number.isInteger(item.pecas) || item.pecas < 1) return { error: "O número de peças deve ser 1 ou mais." };

  if (item.id) {
    const { error } = await auth.supabase.from("jogos_navalha_itens").update({
      produto_id: item.produtoId, titulo: item.titulo.trim(), pecas: item.pecas, codigo: item.codigo.trim() || null,
    }).eq("id", item.id);
    if (error) return { error: msg(error) };
  } else {
    const { data: ultimo } = await auth.supabase.from("jogos_navalha_itens").select("ordem").eq("jogo_id", jogoId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const { error } = await auth.supabase.from("jogos_navalha_itens").insert({
      jogo_id: jogoId, produto_id: item.produtoId, titulo: item.titulo.trim(), pecas: item.pecas,
      codigo: item.codigo.trim() || null, ordem: (ultimo?.ordem ?? 0) + 1,
    });
    if (error) return { error: msg(error) };
  }
  atualizarTelas();
  return { success: true };
}

export async function excluirItemJogoNavalha(itemId: string): Promise<Resultado> {
  const auth = await exigirAdmin();
  if ("erro" in auth) return { error: auth.erro };
  const { error } = await auth.supabase.from("jogos_navalha_itens").delete().eq("id", itemId);
  if (error) return { error: msg(error) };
  atualizarTelas();
  return { success: true };
}

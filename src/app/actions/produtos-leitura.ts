"use server";

// Consultas chamadas pela tela de Produtos sob demanda (busca de peças, vínculos de uma categoria, detalhe de peça).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { ehUuid, sanitizarBusca } from "@/lib/produtos/regras";
import { buscarPecasDisponiveis, carregarPeca, listarVinculosDaCategoria } from "@/lib/produtos/servidor";
import type { PecaBusca, PecaDetalhe, VinculoPeca } from "@/lib/produtos/tipos";

type Lido<T> = { ok: true; dados: T } | { ok: false; erro: string };
const FALHA = "Não foi possível carregar. Atualize a página e tente novamente.";

async function logado() {
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function listarVinculos(equipamentoId: string, categoriaId: string): Promise<Lido<VinculoPeca[]>> {
  const supabase = await logado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  if (!ehUuid(equipamentoId) || !ehUuid(categoriaId)) return { ok: false, erro: "Seleção inválida." };
  try { return { ok: true, dados: await listarVinculosDaCategoria(supabase, equipamentoId, categoriaId) }; } catch { return { ok: false, erro: FALHA }; }
}

export async function buscarPecasParaVincular(equipamentoId: string, termo: string, categoriaId: string | null): Promise<Lido<PecaBusca[]>> {
  const supabase = await logado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  if (!ehUuid(equipamentoId) || (categoriaId !== null && !ehUuid(categoriaId))) return { ok: false, erro: "Seleção inválida." };
  try { return { ok: true, dados: await buscarPecasDisponiveis(supabase, equipamentoId, sanitizarBusca(termo), categoriaId) }; } catch { return { ok: false, erro: FALHA }; }
}

export async function carregarPecaDetalhe(id: string): Promise<Lido<PecaDetalhe>> {
  const supabase = await logado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  if (!ehUuid(id)) return { ok: false, erro: "Peça inválida." };
  try {
    const p = await carregarPeca(supabase, id);
    return p ? { ok: true, dados: p } : { ok: false, erro: "Peça não encontrada (pode ter sido excluída)." };
  } catch { return { ok: false, erro: FALHA }; }
}

export interface PecaDaCategoria { id: string; codigo: string; descricao: string; preco_brl: number | null; ipi_pct: number }

/** Peças de uma categoria (lista compacta), carregadas só quando a aba de navalhas é aberta. */
export async function listarPecasDaCategoria(categoriaId: string): Promise<Lido<PecaDaCategoria[]>> {
  const supabase = await logado();
  if (!supabase) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  if (!ehUuid(categoriaId)) return { ok: false, erro: "Categoria inválida." };
  try {
    const { buscarTodos } = await import("@/lib/supabase/buscar-todos");
    const dados = await buscarTodos((de, ate) => supabase.from("produtos").select("id, codigo, descricao, preco_brl, ipi_pct")
      .eq("categoria_peca_id", categoriaId).is("deleted_at", null).eq("status", "ativo").order("codigo").order("id").range(de, ate));
    return { ok: true, dados: (dados as any[]).map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao ?? "", preco_brl: p.preco_brl === null ? null : Number(p.preco_brl), ipi_pct: Number(p.ipi_pct ?? 0) })) };
  } catch { return { ok: false, erro: FALHA }; }
}

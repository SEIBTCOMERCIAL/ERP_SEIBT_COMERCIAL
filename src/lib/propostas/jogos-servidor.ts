// Leitura dos jogos de navalhas no banco. Só para código de servidor (páginas e ações).

import type { Jogo } from "./jogos-navalha";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

const CAMPOS = `id, equipamento_id, nome, material, ativo, ordem,
  equipamento:produtos!jogos_navalha_equipamento_id_fkey(id, codigo, linha),
  itens:jogos_navalha_itens(id, titulo, pecas, codigo, ordem, produto:produtos!jogos_navalha_itens_produto_id_fkey(id, codigo, preco_brl, preco_usd, ipi_pct))`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function montar(rows: any[]): Jogo[] {
  return rows.map((j) => ({
    id: j.id,
    equipamentoId: j.equipamento_id,
    equipamentoCodigo: j.equipamento?.codigo ?? "",
    equipamentoLinha: j.equipamento?.linha ?? null,
    nome: j.nome,
    material: j.material ?? null,
    ativo: j.ativo,
    itens: ((j.itens ?? []) as any[])
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({
        id: i.id,
        produtoId: i.produto?.id ?? "",
        titulo: i.titulo,
        pecas: i.pecas,
        codigo: i.codigo ?? i.produto?.codigo ?? "",
        preco: i.produto?.preco_brl ?? null,
        precoUsd: i.produto?.preco_usd ?? null,
        ipi: Number(i.produto?.ipi_pct ?? 0),
      }))
      .filter((i) => i.produtoId),
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Jogos ativos de todos os equipamentos, para escolher na hora de cotar. Sem a tabela (arquivo 026), volta vazio. */
export async function carregarJogosParaCotacao(supabase: SupabaseAny): Promise<{ jogos: Jogo[]; disponivel: boolean }> {
  const { data, error } = await supabase.from("jogos_navalha").select(CAMPOS).eq("ativo", true).order("ordem");
  if (error) return { jogos: [], disponivel: false };
  return { jogos: montar(data ?? []).filter((j) => j.itens.length > 0), disponivel: true };
}

/** Todos os jogos (inclusive desativados) de um equipamento, para a tela de cadastro. */
export async function carregarJogosDoEquipamento(supabase: SupabaseAny, equipamentoId: string): Promise<{ jogos: Jogo[]; disponivel: boolean }> {
  const { data, error } = await supabase.from("jogos_navalha").select(CAMPOS).eq("equipamento_id", equipamentoId).order("ordem");
  if (error) return { jogos: [], disponivel: false };
  return { jogos: montar(data ?? []), disponivel: true };
}

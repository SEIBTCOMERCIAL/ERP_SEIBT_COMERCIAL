// Jogos de navalhas: regras que valem no navegador e no servidor (sem consulta ao banco).

import type { CartItemInput } from "@/app/actions/propostas-pecas";

export interface JogoItem {
  id: string;
  produtoId: string;
  /** Título da linha no orçamento, ex.: "NAVALHAS ROTORAS ESQ. MOINHO MGHS 800 A2". */
  titulo: string;
  pecas: number;
  /** Código mostrado no orçamento (pode ser parte do código do cadastro, como "79691"). */
  codigo: string;
  /** Preço e IPI vêm do cadastro da peça. */
  preco: number | null;
  precoUsd: number | null;
  ipi: number;
}

export interface Jogo {
  id: string;
  equipamentoId: string;
  equipamentoCodigo: string;
  equipamentoLinha: string | null;
  nome: string;
  material: string | null;
  ativo: boolean;
  itens: JogoItem[];
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Linha do orçamento, no formato dos modelos da SEIBT:
 * "NAVALHAS ROTORAS ESQ. MOINHO MGHS 800 A2 (COMPOSTO POR 03 PEÇAS) - CÓD. 79691". */
export function descricaoLinhaJogo(item: Pick<JogoItem, "titulo" | "pecas" | "codigo">, material?: string | null): string {
  const titulo = material?.trim() ? `${item.titulo} – ${material.trim()}` : item.titulo;
  const codigo = item.codigo?.trim() ? ` - CÓD. ${item.codigo.trim()}` : "";
  return `${titulo} (COMPOSTO POR ${doisDigitos(item.pecas)} ${item.pecas === 1 ? "PEÇA" : "PEÇAS"})${codigo}`;
}

/** Valor do jogo com IPI, em reais. */
export function totalJogo(jogo: Pick<Jogo, "itens">): number {
  return jogo.itens.reduce((s, i) => s + i.pecas * (i.preco ?? 0) * (1 + i.ipi / 100), 0);
}

/** Chave única da linha no carrinho (linhas de jogo podem repetir a mesma peça). */
export function chaveItem(i: Pick<CartItemInput, "produto_id"> & { chave?: string }): string {
  return i.chave ?? i.produto_id;
}

/** Linhas do carrinho de um jogo; `multiplicador` = quantos jogos completos. */
export function itensDoJogo(
  jogo: Jogo,
  opcoes: { multiplicador?: number; moeda?: "BRL" | "USD"; taxaDolar?: number } = {}
): Array<CartItemInput & { chave: string }> {
  const mult = Math.max(1, opcoes.multiplicador ?? 1);
  const usd = opcoes.moeda === "USD";
  return jogo.itens.map((i) => {
    const preco = usd
      ? i.precoUsd ?? (i.preco ?? 0) / (opcoes.taxaDolar || 1)
      : i.preco ?? 0;
    return {
      chave: `jogo:${i.id}`,
      produto_id: i.produtoId,
      variante_id: null,
      codigo: i.codigo || "",
      descricao: descricaoLinhaJogo(i, jogo.material),
      preco_unitario: preco,
      ipi_pct: i.ipi,
      quantidade: i.pecas * mult,
    };
  });
}

/** Navalhas que fazem parte de algum jogo: na cotação elas entram pelo jogo (no formato do orçamento),
 * não pela lista solta de peças. */
export function idsNavalhasEmJogos(jogos: Jogo[]): Set<string> {
  return new Set(jogos.flatMap((j) => j.itens.map((i) => i.produtoId)));
}

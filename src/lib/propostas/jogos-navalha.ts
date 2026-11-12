// Jogos de navalhas: regras que valem no navegador e no servidor (sem consulta ao banco).

import type { CartItemInput } from "@/app/actions/propostas-pecas";
import { calcularKit, classificarComponente, PROBLEMA_ROTULO, type CalculoKit } from "@/lib/reajuste/kits";

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

/** Cálculo central do conjunto (o mesmo da tela de Reajuste e do catálogo): arredondamento por linha, IPI de cada peça. */
export function calculoDoJogo(jogo: Pick<Jogo, "itens">): CalculoKit {
  return calcularKit(jogo.itens.map((i) => ({ pecas: i.pecas, preco: i.preco, ipi: i.ipi, grupo: classificarComponente(i.titulo) })));
}

/** Valor do jogo com IPI, em reais; null quando o jogo está incompleto (nunca um total parcial). */
export function totalJogo(jogo: Pick<Jogo, "itens">): number | null {
  return calculoDoJogo(jogo).total;
}

/** Texto do total para telas: valor formatado ou o motivo de não haver total. */
export function textoTotalJogo(jogo: Pick<Jogo, "itens">, formatar: (v: number) => string): string {
  const c = calculoDoJogo(jogo);
  return c.total !== null ? formatar(c.total) : PROBLEMA_ROTULO[c.problemas[0] ?? "sem_componentes"];
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

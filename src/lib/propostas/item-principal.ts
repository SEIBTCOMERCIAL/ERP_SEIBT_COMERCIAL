// Item que dá nome à proposta ("cabeçalho"): o marcado pelo vendedor; sem marcação, o moinho;
// sem moinho, o primeiro equipamento; senão, o primeiro item. Sem dependências de servidor.

import { ehMoinho } from "./descritivo-maquina";

export interface ItemParaCabecalho {
  descricao: string;
  destaque?: boolean | null;
  produto?: { codigo?: string | null; categoria?: string | null } | null;
}

export function indiceItemCabecalho(itens: ItemParaCabecalho[]): number {
  if (!itens.length) return -1;
  const marcado = itens.findIndex((i) => i.destaque);
  if (marcado >= 0) return marcado;
  const equipamento = (i: ItemParaCabecalho) => i.produto?.categoria === "maquina";
  const moinho = itens.findIndex((i) => equipamento(i) && ehMoinho(i.produto?.codigo, i.descricao));
  if (moinho >= 0) return moinho;
  const primeiroEquipamento = itens.findIndex(equipamento);
  return primeiroEquipamento >= 0 ? primeiroEquipamento : 0;
}

/** "MGHS 800 A2 / 75 CV (+8 itens)" — ou a descrição inicial, quando a proposta ainda não tem itens. */
export function resumoProduto(itens: ItemParaCabecalho[], semItens: string | null): string | null {
  const i = indiceItemCabecalho(itens);
  if (i < 0) return semItens;
  const outros = itens.length - 1;
  return outros > 0 ? `${itens[i].descricao} (+${outros} ${outros === 1 ? "item" : "itens"})` : itens[i].descricao;
}

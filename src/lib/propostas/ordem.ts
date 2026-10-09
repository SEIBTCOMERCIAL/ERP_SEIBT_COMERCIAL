// Ordem dos itens da proposta (a mesma que sai no Word). Sem dependências de servidor.

/** Move o elemento de `de` para a posição `para`, devolvendo uma lista nova. */
export function moverParaPosicao<T>(lista: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return lista;
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item!);
  return copia;
}

/** Ordena `itens` pela lista de chaves `ordem`; o que não estiver na lista vai ao final, na ordem natural. */
export function aplicarOrdem<T>(itens: T[], ordem: string[], chave: (i: T) => string): T[] {
  if (!ordem.length) return itens;
  const posicao = new Map(ordem.map((k, i) => [k, i]));
  return itens
    .map((item, natural) => ({ item, natural, pos: posicao.get(chave(item)) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => (a.pos !== b.pos ? a.pos - b.pos : a.natural - b.natural))
    .map((x) => x.item);
}

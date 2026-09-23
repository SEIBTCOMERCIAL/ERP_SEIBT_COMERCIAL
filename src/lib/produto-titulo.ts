// Título do equipamento = o próprio código (ex.: "MGHS 300 A2 10 CV").

/** "MGHS 1300 A2 200 CV" → "MGHS 1300 A2 / 200 CV"; "BOMBA ÁGUA 15M³ — 1,5 CV" → "BOMBA ÁGUA 15M³ / 1,5 CV". */
export function tituloComSeparador(nome: string): string {
  const potencia = /\s[—–-]\s*(\d+(?:[.,]\d+)?\s*CV\b)/i;
  if (potencia.test(nome)) return nome.replace(potencia, " / $1");
  return nome.replace(/(?<!\/)\s+(\d+(?:[.,]\d+)?\s*CV\b)/i, " / $1");
}

/**
 * Primeiro número do nome, pra ordenar do menor pro maior equipamento
 * ("MGHS 200" antes de "MGHS 1200" — em ordem alfabética seria o contrário).
 * Sem número, vai pro final.
 */
export function tamanhoModelo(nome: string): number {
  const match = nome.match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

export function compararPorTamanho(a: string, b: string): number {
  const diff = tamanhoModelo(a) - tamanhoModelo(b);
  return diff !== 0 ? diff : a.localeCompare(b);
}

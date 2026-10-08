// Revisões da proposta: cada edição salva ganha a próxima letra
// (sem letra → A → B → … → Z → AA → AB …), ex.: "1177/2026" → "1177/2026 A".

export function proximaRevisao(atual: string | null | undefined): string {
  const r = (atual ?? "").trim().toUpperCase();
  if (!/^[A-Z]+$/.test(r)) return "A";
  const letras = r.split("");
  let i = letras.length - 1;
  while (i >= 0) {
    if (letras[i] !== "Z") {
      letras[i] = String.fromCharCode(letras[i]!.charCodeAt(0) + 1);
      return letras.join("");
    }
    letras[i] = "A";
    i--;
  }
  return "A" + letras.join("");
}

/** "1177/2026" ou "1177/2026 A" + "B" → "1177/2026 B". */
export function numeroComRevisao(numeroCompleto: string, revisao: string): string {
  return `${numeroCompleto.replace(/\s+[A-Z]+$/i, "").trim()} ${revisao}`;
}

/** Preço final do item com desconto %, arredondado em centavos. */
export function precoComDesconto(precoTabela: number, descontoPct: number | null | undefined): number {
  const d = Math.min(100, Math.max(0, Number(descontoPct) || 0));
  return Math.round(precoTabela * (1 - d / 100) * 100) / 100;
}

/** Preço final do item com desconto % ou acréscimo % (margem) sobre o preço de tabela, em centavos.
 * Usa-se um dos dois por item; se vierem os dois, aplica o acréscimo e depois o desconto. */
export function precoComAjuste(
  precoTabela: number,
  descontoPct: number | null | undefined,
  acrescimoPct: number | null | undefined
): number {
  const d = Math.min(100, Math.max(0, Number(descontoPct) || 0));
  const a = Math.max(0, Number(acrescimoPct) || 0);
  return Math.round(precoTabela * (1 + a / 100) * (1 - d / 100) * 100) / 100;
}

/** Desconto ou acréscimo (%) a partir do preço de tabela e do preço final gravados. */
export function ajusteDoPreco(precoTabela: number, precoFinal: number): { desconto: number; acrescimo: number } {
  if (!(precoTabela > 0)) return { desconto: 0, acrescimo: 0 };
  const pct = Math.round((precoFinal / precoTabela - 1) * 10000) / 100;
  return pct > 0 ? { desconto: 0, acrescimo: pct } : { desconto: Math.max(0, -pct), acrescimo: 0 };
}

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

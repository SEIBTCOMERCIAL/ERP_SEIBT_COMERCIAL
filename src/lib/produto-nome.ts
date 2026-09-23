// Itens que vieram do catálogo antigo sem código real ganharam um código
// provisório na importação (REC-0001, PEPP-0001…). O nome de verdade deles
// está na descrição.
const CODIGO_PROVISORIO = /^(REC|PEPP)-\d+$/i;

export function codigoProvisorio(codigo: string): boolean {
  return CODIGO_PROVISORIO.test(codigo.trim());
}

/** Nome para exibir. Código provisório → 1ª linha da descrição; senão, o código. */
export function nomeExibicao(codigo: string, descricao: string | null | undefined): string {
  if (!codigoProvisorio(codigo)) return codigo;
  const primeiraLinha = (descricao ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  return primeiraLinha ?? codigo;
}

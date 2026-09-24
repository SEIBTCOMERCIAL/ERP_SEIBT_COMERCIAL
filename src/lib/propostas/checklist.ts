// Tipo de moagem do checklist técnico: a tela mostra o texto ("A seco"), o banco
// guarda o código ("seco") — a coluna só aceita os códigos abaixo.

export const OPCOES_MOAGEM = [
  { codigo: "seco", rotulo: "A seco" },
  { codigo: "umido", rotulo: "Úmida" },
  { codigo: "semi_umido", rotulo: "Semi-úmida" },
] as const;

export const ROTULOS_MOAGEM = OPCOES_MOAGEM.map((o) => o.rotulo);

/** "A seco" → "seco". Aceita também o próprio código. */
export function moagemParaBanco(valor: string | null | undefined): string {
  const v = (valor ?? "").trim();
  const op = OPCOES_MOAGEM.find((o) => o.rotulo === v || o.codigo === v);
  return op?.codigo ?? v;
}

/** "seco" → "A seco". Aceita também o próprio texto. */
export function moagemRotulo(valor: string | null | undefined): string {
  const v = (valor ?? "").trim();
  const op = OPCOES_MOAGEM.find((o) => o.codigo === v || o.rotulo === v);
  return op?.rotulo ?? v;
}

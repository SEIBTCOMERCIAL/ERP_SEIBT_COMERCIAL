// Atualiza as telas que leem produtos e preços depois de uma gravação bem-sucedida.
// revalidatePath em "layout" cobre as páginas aninhadas (catálogo por linha, completo, peças, detalhe de equipamento).
import { revalidatePath } from "next/cache";

const TELAS_DE_PRODUTOS = ["/produtos", "/catalogo"] as const;
const TELAS_DE_PROPOSTA = ["/propostas/pecas/nova", "/propostas/maquinas/nova"] as const;

/** Cadastro de produtos mudou (dados, fotos, vínculos, ficha). */
export function revalidarProdutos() {
  for (const r of TELAS_DE_PRODUTOS) revalidatePath(r, "layout");
  for (const r of TELAS_DE_PROPOSTA) revalidatePath(r);
}

/** Um reajuste foi confirmado: preços vigentes mudaram. Propostas já emitidas guardam o preço da época e não mudam. */
export function revalidarPrecos() {
  revalidarProdutos();
  revalidatePath("/reajuste");
  revalidatePath("/precos");
}

// Nomes das opções de painel de cada linha de equipamento.
// Moinhos e demais linhas: painel 220V e painel 380V.
// Exaustores: painel compartilhado (valor menor) e painel dedicado (valor maior) — Base de Preço 2026.
// Os valores continuam nos mesmos campos do cadastro: "painel 220V" guarda o compartilhado e
// "painel 380V" guarda o dedicado.

export interface RotulosPainel {
  compartilhado: boolean;
  /** Nome da primeira opção de painel (campo 220V do cadastro). */
  p220: string;
  /** Nome da segunda opção de painel (campo 380V do cadastro). */
  p380: string;
  /** Selo curto dos totais. */
  selo220: string;
  selo380: string;
  /** Texto "usada para ..." da descrição do painel. */
  usoDescricao: string;
}

const LINHA_EXAUSTOR = /exaustor/i;

export function rotulosPainel(linhaNome: string | null | undefined): RotulosPainel {
  if (linhaNome && LINHA_EXAUSTOR.test(linhaNome)) {
    return {
      compartilhado: true,
      p220: "Painel compartilhado",
      p380: "Painel dedicado",
      selo220: "COMPARTILHADO",
      selo380: "DEDICADO",
      usoDescricao: "painel compartilhado e dedicado",
    };
  }
  return { compartilhado: false, p220: "Painel 220V", p380: "Painel 380V", selo220: "220V", selo380: "380V", usoDescricao: "220V e 380V" };
}

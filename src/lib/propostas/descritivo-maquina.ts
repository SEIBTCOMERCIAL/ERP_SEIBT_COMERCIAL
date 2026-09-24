// Monta o texto do item "máquina" da proposta a partir da "Descrição do moinho"
// (produtos.descricao / produtos.descricao_painel). Sem dependências de servidor:
// usado no formulário (cliente) e na geração do Word.

import { tituloComSeparador } from "@/lib/produto-titulo";

export type VoltagemPainel = "220" | "380";

/** Início do bloco do painel dentro da descrição ("PAINEL ELÉTRICO ADEQUADO..."). */
const INICIO_PAINEL = /^[ \t]*PAINEL\s+EL[ÉE]TRICO/im;

/** Observação de NR-12 que o modelo do Word já traz fixa no item da máquina. */
const OBSERVACAO_NR12 = /^[ \t]*OBSERVA[ÇC][ÃA]O:\s*A\s+valida[çc][ãa]o\s+da\s+NR/im;

function cortarObservacaoNr12(texto: string): string {
  const i = texto.search(OBSERVACAO_NR12);
  return (i >= 0 ? texto.slice(0, i) : texto).trimEnd();
}

/**
 * Separa a descrição em parte da máquina e parte do painel. Usa a "Descrição do
 * painel" quando preenchida; senão, procura o bloco "PAINEL ELÉTRICO" dentro da
 * própria descrição do moinho.
 */
export function separarDescritivo(
  descricao: string | null | undefined,
  descricaoPainel: string | null | undefined
): { maquina: string; painel: string } {
  const texto = (descricao ?? "").replace(/\r\n/g, "\n");
  const i = texto.search(INICIO_PAINEL);
  const maquina = cortarObservacaoNr12(i >= 0 ? texto.slice(0, i) : texto);
  const painelProprio = (descricaoPainel ?? "").replace(/\r\n/g, "\n").trim();
  const painel = cortarObservacaoNr12(painelProprio || (i >= 0 ? texto.slice(i) : ""));
  return { maquina: maquina.trim(), painel: painel.trim() };
}

/** Descrição "de verdade" — não vazia e não só um pedaço do título (ex.: "10 CV"). */
function temDescritivo(maquina: string, codigo: string): boolean {
  const d = maquina.trim();
  return d.length > 0 && !codigo.toLowerCase().includes(d.toLowerCase());
}

function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");
}

/**
 * Texto completo do item da máquina, como vai na coluna DETALHES do Word:
 * descrição do moinho + (se escolhido) o bloco do painel na voltagem escolhida e
 * a linha "Valor Painel NR 12 R$ X – INCLUSO NO VALOR DO MOINHO".
 * Retorna null quando não há nada além do título.
 */
export function montarDescritivoMaquina(
  maquina: { codigo: string; descricao?: string | null; descricao_painel?: string | null },
  painel: { voltagem: VoltagemPainel; preco: number } | null
): string | null {
  const titulo = tituloComSeparador(maquina.codigo);
  const partes = separarDescritivo(maquina.descricao, maquina.descricao_painel);
  const base = temDescritivo(partes.maquina, maquina.codigo) ? partes.maquina : null;

  if (!painel) return base;

  const v = `${painel.voltagem}V`;
  const blocoPainel = partes.painel
    ? partes.painel.replace(/220\s*V?\s*OU\s*380\s*V?/gi, v)
    : `PAINEL ELÉTRICO ADEQUADO A NORMA DE SEGURANÇA NR 12 – ${v} (COM LAUDO TÉCNICO)`;
  const ehMoinho = /^MGHS|MOINHO/i.test(maquina.codigo) || /MOINHO/i.test(base ?? "");
  const linhaValor = `- Valor Painel NR 12 ${formatarReais(painel.preco)} – INCLUSO NO VALOR DO ${ehMoinho ? "MOINHO" : "EQUIPAMENTO"}`;

  return `${base ?? titulo}\n\n${blocoPainel}\n${linhaValor}`;
}

/** Iniciais para a assinatura, ex.: "Lucas Moreira Concencia" → "LMC". */
export function iniciaisAssinatura(nome: string): string {
  return nome
    .split(/\s+/)
    .filter((p) => p && !/^(de|da|do|das|dos|e)$/i.test(p))
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

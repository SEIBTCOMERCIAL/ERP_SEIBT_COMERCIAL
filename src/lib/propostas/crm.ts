// Regras do CRM de propostas (PRD v2.2, M5) num só lugar, usadas pela página de
// Propostas (Clientes, Propostas e Funil), pelos indicadores e pelas ações.
// Sem dependências de servidor: pode ser usado também em componentes de cliente.

export const STATUS_ABERTOS = new Set([
  "rascunho", "elaboracao", "aguardando_precificacao", "enviada", "em_negociacao", "stand_by",
]);

export const STATUS_ENCERRADOS = new Set([
  "vendida", "perdida", "desistencia", "cancelada", "complementar_nao_selecionada",
]);

/** Status "em acompanhamento": exigem próxima ação definida. Rascunho/elaboração não exigem;
 * congelada usa a previsão de retomada no lugar da próxima ação. */
export const STATUS_EM_ACOMPANHAMENTO = new Set(["enviada", "em_negociacao"]);

/** Encerramentos que exigem motivo padronizado + explicação. */
export const STATUS_COM_MOTIVO = new Set(["perdida", "desistencia", "cancelada"]);

export const STATUS_LISTA = [
  "rascunho", "elaboracao", "aguardando_precificacao", "enviada", "em_negociacao", "stand_by",
  "vendida", "perdida", "desistencia", "cancelada", "complementar_nao_selecionada",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  elaboracao: "Em elaboração",
  aguardando_precificacao: "Aguardando precificação",
  enviada: "Enviada",
  em_negociacao: "Em negociação",
  stand_by: "Congelada",
  vendida: "Vendida",
  perdida: "Perdida",
  desistencia: "Desistência",
  cancelada: "Cancelada",
  complementar_nao_selecionada: "Complementar não selecionada",
};

/** Tipos válidos para propostas novas. "exportacao" ficou só para registros antigos:
 * exportação agora é mercado, não tipo. */
export const TIPOS_PROPOSTA = [
  { value: "maquina", label: "Máquina" },
  { value: "pecas", label: "Peças" },
  { value: "sistema", label: "Sistema" },
  { value: "servico", label: "Serviço" },
  { value: "mista", label: "Mista" },
] as const;

export const TIPO_LABELS: Record<string, string> = {
  maquina: "Máquina", pecas: "Peças", sistema: "Sistema", servico: "Serviço", mista: "Mista",
  exportacao: "Exportação (antigo)",
};

/** Motivos padronizados de perda, desistência e cancelamento (confirmados pelo Lucas em 07/10/2026). */
export const MOTIVOS_ENCERRAMENTO = [
  { value: "preco", label: "Preço" },
  { value: "prazo", label: "Prazo de entrega" },
  { value: "concorrente", label: "Escolheu concorrente" },
  { value: "cliente_desistiu", label: "Cliente desistiu" },
  { value: "sem_retorno", label: "Sem retorno" },
  { value: "projeto_cancelado", label: "Projeto cancelado" },
  { value: "outro", label: "Outro" },
] as const;

export const MOTIVO_LABELS: Record<string, string> = Object.fromEntries(
  MOTIVOS_ENCERRAMENTO.map((m) => [m.value, m.label])
);

/** Prazo usado quando o tipo não tem configuração própria (PRD: "prazo padrão"). */
export const DIAS_SEM_MOVIMENTACAO_PADRAO = 7;

/** Dias até o vencimento da validade para gerar alerta. */
export const DIAS_ALERTA_VALIDADE = 5;

export type Mercado = "nacional" | "exportacao";
export type Papel = "principal" | "complementar";

export interface PropostaCrm {
  id: string;
  tipo: string;
  status: string;
  valor_total: number | null;
  mercado?: Mercado | null;
  papel?: Papel | null;
  proposta_principal_id?: string | null;
}

/** Mercado de uma proposta; registros antigos (antes do campo existir) usam o tipo legado. */
export function mercadoDe(p: { mercado?: string | null; tipo: string }): Mercado {
  if (p.mercado === "exportacao" || p.mercado === "nacional") return p.mercado;
  return p.tipo === "exportacao" ? "exportacao" : "nacional";
}

/** Identificador do negócio: a principal e suas complementares formam um negócio só. */
export function negocioDe(p: PropostaCrm): string {
  return p.papel === "complementar" && p.proposta_principal_id ? p.proposta_principal_id : p.id;
}

export interface IndicadoresCrm {
  /** Soma de todas as propostas (inclui todas as alternativas). */
  valorApresentado: number;
  /** Funil sem duplicar: para cada negócio com proposta aberta, a alternativa de maior valor. */
  funilAtivo: number;
  /** Soma de todas as propostas abertas, inclusive alternativas do mesmo negócio. */
  funilComAlternativas: number;
  negociosAbertos: number;
  negociosGanhos: number;
  negociosPerdidos: number;
  /** Ganhos ÷ (ganhos + perdidos), por negócio. Complementar não selecionada e cancelada ficam fora. */
  taxaConversao: number;
}

export function calcularIndicadores(propostas: PropostaCrm[]): IndicadoresCrm {
  const valorApresentado = propostas.reduce((s, p) => s + (p.valor_total ?? 0), 0);

  const negocios = new Map<string, PropostaCrm[]>();
  for (const p of propostas) {
    const id = negocioDe(p);
    negocios.set(id, [...(negocios.get(id) ?? []), p]);
  }

  let funilAtivo = 0;
  let funilComAlternativas = 0;
  let negociosAbertos = 0;
  let negociosGanhos = 0;
  let negociosPerdidos = 0;

  negocios.forEach((itens) => {
    const abertas = itens.filter((p) => STATUS_ABERTOS.has(p.status));
    if (abertas.length) {
      negociosAbertos++;
      funilAtivo += Math.max(...abertas.map((p) => p.valor_total ?? 0));
      funilComAlternativas += abertas.reduce((s, p) => s + (p.valor_total ?? 0), 0);
    }
    // Conversão por negócio: ganho se qualquer alternativa foi vendida; perdido só quando
    // tudo está encerrado sem venda e houve perda ou desistência.
    if (itens.some((p) => p.status === "vendida")) negociosGanhos++;
    else if (!abertas.length && itens.some((p) => p.status === "perdida" || p.status === "desistencia")) negociosPerdidos++;
  });

  const base = negociosGanhos + negociosPerdidos;
  return {
    valorApresentado,
    funilAtivo,
    funilComAlternativas,
    negociosAbertos,
    negociosGanhos,
    negociosPerdidos,
    taxaConversao: base ? Math.round((negociosGanhos / base) * 100) : 0,
  };
}

/** Erro do banco quando uma coluna/tabela nova (arquivo 022) ainda não foi aplicada. */
export function faltaEstruturaCrm(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.code === "22P02" ||
    /column .* does not exist|schema cache|invalid input value for enum/i.test(error.message ?? "")
  );
}

export const AVISO_ESTRUTURA_CRM =
  "Esta opção depende da atualização do banco de dados do CRM (arquivo 022), que ainda não foi aplicada.";

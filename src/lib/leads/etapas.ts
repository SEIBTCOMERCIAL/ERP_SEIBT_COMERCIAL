// Regras de etapas e status de leads, compartilhadas entre telas e ações do servidor.

export const STATUS_LEAD: Record<string, string> = {
  novo: "Novo",
  encaminhado: "Encaminhado",
  em_qualificacao: "Em qualificação",
  qualificado: "Qualificado",
  convertido: "Convertido",
  descartado: "Descartado",
};

export const TIPOS_ETAPA_LEAD = [
  { value: "novo", label: "Novo" },
  { value: "encaminhado", label: "Encaminhado" },
  { value: "em_qualificacao", label: "Em qualificação" },
  { value: "qualificado", label: "Qualificado" },
  { value: "convertido", label: "Convertido (só por conversão em cliente)" },
  { value: "descartado", label: "Descartado" },
  { value: "intermediaria", label: "Intermediária (mantém o status atual)" },
] as const;

export interface EtapaLead {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  /** Ausente enquanto a migração 032 não foi aplicada. */
  tipo?: string | null;
}

const POR_NOME: Record<string, string> = {
  novo: "novo",
  encaminhado: "encaminhado",
  "em qualificação": "em_qualificacao",
  qualificado: "qualificado",
  convertido: "convertido",
  descartado: "descartado",
};

export function tipoDaEtapa(e: Pick<EtapaLead, "nome" | "tipo">): string {
  if (e.tipo) return e.tipo;
  return POR_NOME[e.nome.trim().toLowerCase()] ?? "intermediaria";
}

/** Status que o lead assume ao entrar na etapa (intermediária mantém o atual). */
export function statusDaEtapa(e: Pick<EtapaLead, "nome" | "tipo">, atual: string): string {
  const tipo = tipoDaEtapa(e);
  return tipo === "intermediaria" ? atual : tipo;
}

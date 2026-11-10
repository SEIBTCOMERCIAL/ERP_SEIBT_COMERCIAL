export interface HistoricoLead {
  data: string;
  status: string;
  observacoes?: string | null;
  proxima_acao?: string | null;
  proxima_acao_em?: string | null;
  etapa_id?: string | null;
  motivo_descarte?: string | null;
}

export interface Lead {
  id: string;
  empresa_nome: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  cidade: string | null;
  estado: string | null;
  canal_entrada: string;
  tipo_interesse: string;
  mercado: string | null;
  status: string;
  etapa_id: string | null;
  representante_id: string | null;
  cliente_id: string | null;
  encaminhado_em: string | null;
  proxima_acao: string | null;
  proxima_acao_em: string | null;
  motivo_descarte: string | null;
  observacoes: string | null;
  historico?: HistoricoLead[] | null;
}

export interface Representante { id: string; nome: string }
export interface ClienteOpcao { id: string; razao_social: string }

export const CANAIS_LEAD: Record<string, string> = {
  site: "Site", whatsapp: "WhatsApp", email: "E-mail", feira: "Feira", indicacao: "Indicação",
  telefone: "Telefone", recorrencia: "Recorrência", outro: "Outro",
};

export const INTERESSES_LEAD: Record<string, string> = {
  maquina: "Máquina", pecas: "Peças", sistema: "Sistema", servico: "Serviço", mista: "Mista",
};

export function leadAtrasado(l: Pick<Lead, "status" | "proxima_acao_em">): boolean {
  return !["convertido", "descartado"].includes(l.status) && !!l.proxima_acao_em && new Date(l.proxima_acao_em).getTime() < Date.now();
}

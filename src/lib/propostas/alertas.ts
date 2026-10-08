// Alertas de acompanhamento das propostas (atraso, sem movimentação, validade). Dentro do ERP por ora;
// e-mail e WhatsApp ficam para uma fase futura. Usado pelo Kanban e pela página de Clientes.

import { DIAS_ALERTA_VALIDADE, DIAS_SEM_MOVIMENTACAO_PADRAO, STATUS_ABERTOS, STATUS_EM_ACOMPANHAMENTO } from "./crm";

export interface FollowupResumo {
  proposta_id: string;
  data_contato: string;
  proxima_acao_data: string | null;
  proxima_acao_tipo: string | null;
  proxima_acao_notas: string | null;
  criado_em: string;
}

export interface Acompanhamento {
  ultimoContato: FollowupResumo | null;
  proximaAcao: FollowupResumo | null;
}

export interface Alertas {
  atrasado: boolean;
  parado: boolean;
  vencendo: boolean;
  semAcao: boolean;
}

export interface PropostaParaAlerta {
  id: string;
  tipo: string;
  status: string;
  atualizado_em: string;
  validade_proposta: string | null;
  retomada_prevista?: string | null;
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function diasDesde(data: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 86_400_000));
}

export function diasAte(data: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${data}T00:00:00`).getTime() - hoje.getTime()) / 86_400_000);
}

/** Follow-ups já ordenados do mais recente para o mais antigo → último contato e próxima ação de cada proposta. */
export function montarAcompanhamentos(followups: FollowupResumo[]) {
  const mapa = new Map<string, Acompanhamento>();
  for (const f of followups) {
    const atual = mapa.get(f.proposta_id) ?? { ultimoContato: null, proximaAcao: null };
    if (!atual.ultimoContato) atual.ultimoContato = f;
    if (!atual.proximaAcao && f.proxima_acao_data) atual.proximaAcao = f;
    mapa.set(f.proposta_id, atual);
  }
  return mapa;
}

/** Última movimentação: o mais recente entre o último contato e a última alteração da proposta. */
export function ultimaMovimentacao(p: { atualizado_em: string }, acomp?: Acompanhamento) {
  const contato = acomp?.ultimoContato?.data_contato;
  if (!contato) return p.atualizado_em;
  return new Date(contato).getTime() > new Date(p.atualizado_em).getTime() ? contato : p.atualizado_em;
}

export function calcularAlertas(p: PropostaParaAlerta, acomp: Acompanhamento | undefined, prazos: Map<string, number>): Alertas {
  const semAlerta = { atrasado: false, parado: false, vencendo: false, semAcao: false };
  if (!STATUS_ABERTOS.has(p.status)) return semAlerta;
  const hoje = hojeISO();
  // Congelada: o compromisso é a retomada prevista; não conta como "sem movimentação".
  if (p.status === "stand_by") {
    return { ...semAlerta, atrasado: Boolean(p.retomada_prevista && p.retomada_prevista < hoje) };
  }
  const proxima = acomp?.proximaAcao?.proxima_acao_data ?? null;
  const prazo = prazos.get(p.tipo) ?? DIAS_SEM_MOVIMENTACAO_PADRAO;
  const validade = p.validade_proposta ? diasAte(p.validade_proposta) : null;
  return {
    atrasado: Boolean(proxima && proxima < hoje),
    parado: diasDesde(ultimaMovimentacao(p, acomp)) >= prazo,
    vencendo: validade !== null && validade >= 0 && validade <= DIAS_ALERTA_VALIDADE,
    semAcao: STATUS_EM_ACOMPANHAMENTO.has(p.status) && !proxima,
  };
}

/** Divide uma lista grande em partes para os filtros "in" do banco não estourarem o tamanho da consulta. */
export function emPartes<T>(lista: T[], tamanho = 150) {
  const partes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho));
  return partes;
}

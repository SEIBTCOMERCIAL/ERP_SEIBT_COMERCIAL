// Regras do funil (etapas) que não dependem de servidor: usadas pelo Kanban, pelos detalhes
// da proposta e pelas ações. Etapas antigas, sem tipo, valem como "intermediária".

import { STATUS_ENCERRADOS, type TipoEtapa } from "./crm";

export interface EtapaFunil {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo?: boolean;
  funil_id?: string;
  tipo?: TipoEtapa | null;
  exige_proxima_acao?: boolean | null;
}

export function tipoEtapaDe(etapa: Pick<EtapaFunil, "tipo">): TipoEtapa {
  return etapa.tipo ?? "intermediaria";
}

export function etapaPorTipo(etapas: EtapaFunil[], tipo: TipoEtapa): EtapaFunil | null {
  return etapas.find((e) => tipoEtapaDe(e) === tipo) ?? null;
}

/** Etapa inicial: a marcada como inicial; sem essa marcação (banco antigo), a primeira da ordem. */
export function etapaInicial(etapas: EtapaFunil[]): EtapaFunil | null {
  return etapaPorTipo(etapas, "inicial") ?? etapas[0] ?? null;
}

const normalizar = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Etapa adequada para o status da proposta (usada ao fechar, reabrir e ao organizar propostas antigas). */
export function etapaSugeridaPorStatus(status: string, etapas: EtapaFunil[]): EtapaFunil | null {
  if (status === "vendida") return etapaPorTipo(etapas, "ganho");
  if (status === "perdida" || status === "desistencia" || status === "cancelada") return etapaPorTipo(etapas, "perda");
  if (status === "stand_by") return etapaPorTipo(etapas, "congelamento") ?? etapaInicial(etapas);
  if (status === "complementar_nao_selecionada") return null;
  const porNome = (re: RegExp) => etapas.find((e) => tipoEtapaDe(e) === "intermediaria" && re.test(normalizar(e.nome)));
  if (status === "enviada") return porNome(/enviad/) ?? etapaInicial(etapas);
  if (status === "em_negociacao") return porNome(/negocia/) ?? porNome(/enviad/) ?? etapaInicial(etapas);
  if (status === "elaboracao" || status === "aguardando_precificacao") return porNome(/elabora/) ?? etapaInicial(etapas);
  return etapaInicial(etapas);
}

export interface PosicaoNoFunil {
  etapa: EtapaFunil | null;
  /** true quando a proposta não tinha etapa válida e foi posicionada automaticamente. */
  automatica: boolean;
  /** Propostas encerradas ficam na coluna final do tipo correspondente e não se movem no quadro. */
  bloqueada: boolean;
}

/** Coluna onde o card aparece. Encerradas seguem o status; as demais seguem a etapa gravada. */
export function posicaoNoFunil(p: { status: string; etapa_funil_id: string | null }, etapas: EtapaFunil[]): PosicaoNoFunil {
  if (STATUS_ENCERRADOS.has(p.status)) {
    return { etapa: etapaSugeridaPorStatus(p.status, etapas), automatica: false, bloqueada: true };
  }
  const gravada = p.etapa_funil_id ? etapas.find((e) => e.id === p.etapa_funil_id) : null;
  if (gravada) return { etapa: gravada, automatica: false, bloqueada: false };
  return { etapa: etapaSugeridaPorStatus(p.status, etapas), automatica: true, bloqueada: false };
}

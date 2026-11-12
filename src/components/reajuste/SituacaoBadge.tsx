import { CLASSE_SITUACAO, SITUACAO_ROTULO } from "./formatar";
import { rotuloComponente } from "./formatar";
import type { ComponenteId, SituacaoItem } from "@/lib/reajuste/regras";

const CURTO: Record<SituacaoItem, string> = {
  sem_reajuste: "Sem reajuste", parcial: "Parcial", atualizado: "Reajustado", sem_preco: "Sem preço", inativo: "Inativo",
};

export function SituacaoBadge({ situacao, pendentes = [] }: { situacao: SituacaoItem; pendentes?: ComponenteId[] }) {
  const completo = SITUACAO_ROTULO[situacao];
  const dica = situacao === "parcial" && pendentes.length ? `${completo}. Falta reajustar: ${pendentes.map(rotuloComponente).join(", ")}` : completo;
  return (
    <span title={dica} className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${CLASSE_SITUACAO[situacao]}`}>
      {CURTO[situacao]}
    </span>
  );
}

const PONTO: Record<SituacaoItem, string> = {
  sem_reajuste: "bg-amber-500", parcial: "bg-orange-500", atualizado: "bg-green-600", sem_preco: "bg-slate-400", inativo: "bg-slate-400",
};

/** Situação discreta para tabelas: texto curto com marcador. Os alertas fortes ficam para o que exige atenção. */
export function SituacaoTexto({ situacao, pendentes = [], rotulo }: { situacao: SituacaoItem; pendentes?: ComponenteId[]; rotulo?: string }) {
  const completo = SITUACAO_ROTULO[situacao];
  const dica = situacao === "parcial" && pendentes.length ? `${completo}. Falta reajustar: ${pendentes.map(rotuloComponente).join(", ")}` : completo;
  return (
    <span title={dica} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${PONTO[situacao]}`} />{rotulo ?? CURTO[situacao]}
    </span>
  );
}

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

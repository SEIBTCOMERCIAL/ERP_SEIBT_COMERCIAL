import { COMPONENTES, formatarData, SITUACAO_ROTULO, type ComponenteId, type SituacaoItem } from "@/lib/reajuste/regras";

export function fmtBRL(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtPct(v: number | null | undefined, comSinal = true): string {
  if (v === null || v === undefined) return "—";
  const t = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${comSinal && v > 0 ? "+" : ""}${t}%`;
}

export function fmtDiferenca(v: number): string {
  const t = Math.abs(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return v > 0 ? `+${t}` : v < 0 ? `−${t}` : t;
}

export { formatarData };

export const rotuloComponente = (c: string | null | undefined): string =>
  c && c in COMPONENTES ? COMPONENTES[c as ComponenteId].rotulo : c ? c : "Preço";

/** Cores de alerta só onde exige atenção: sem reajuste e parcial. */
export const CLASSE_SITUACAO: Record<SituacaoItem, string> = {
  sem_reajuste: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  parcial: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200",
  atualizado: "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
  sem_preco: "border-border bg-muted text-muted-foreground",
  inativo: "border-border bg-muted text-muted-foreground",
};

export { SITUACAO_ROTULO };

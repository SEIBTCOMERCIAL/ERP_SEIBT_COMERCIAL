import { cn } from "@/lib/utils";

type StatusProposta =
  | "rascunho" | "elaboracao" | "aguardando_precificacao"
  | "enviada" | "em_negociacao" | "vendida" | "perdida" | "desistencia" | "stand_by";

type Temperatura = "quente" | "morna" | "fria";
type TipoProposta = "maquina" | "sistema" | "exportacao" | "pecas" | "servico" | "mista";

const statusMap: Record<StatusProposta, { label: string; className: string }> = {
  rascunho:                { label: "Rascunho",         className: "bg-slate-100 text-slate-500 border-slate-200" },
  elaboracao:              { label: "Em elaboração",    className: "bg-slate-100 text-slate-600 border-slate-200" },
  aguardando_precificacao: { label: "Aguardando",       className: "bg-purple-50 text-purple-700 border-purple-200" },
  enviada:                 { label: "Enviada",          className: "bg-blue-50 text-blue-700 border-blue-200" },
  em_negociacao:           { label: "Em negociação",    className: "bg-amber-50 text-amber-700 border-amber-200" },
  vendida:                 { label: "Vendida",          className: "bg-green-50 text-green-700 border-green-200" },
  perdida:                 { label: "Perdida",          className: "bg-red-50 text-red-700 border-red-200" },
  desistencia:             { label: "Desistência",      className: "bg-red-50 text-red-400 border-red-100" },
  stand_by:                { label: "Stand-by",         className: "bg-orange-50 text-orange-700 border-orange-200" },
};

const tipoMap: Record<TipoProposta, { label: string; className: string }> = {
  maquina:    { label: "Máquina",    className: "bg-blue-50 text-blue-700" },
  sistema:    { label: "Sistema",    className: "bg-purple-50 text-purple-700" },
  exportacao: { label: "Exportação", className: "bg-cyan-50 text-cyan-700" },
  pecas:      { label: "Peças",      className: "bg-amber-50 text-amber-700" },
  servico:    { label: "Serviço",    className: "bg-green-50 text-green-700" },
  mista:      { label: "Mista",      className: "bg-slate-100 text-slate-600" },
};

export function PropostaStatusBadge({ status }: { status: string }) {
  const cfg = statusMap[status as StatusProposta] ?? statusMap.rascunho;
  return (
    <span className={cn(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
      cfg.className
    )}>
      {cfg.label}
    </span>
  );
}

export function PropostaTipoBadge({ tipo }: { tipo: string }) {
  const cfg = tipoMap[tipo as TipoProposta] ?? tipoMap.maquina;
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
      cfg.className
    )}>
      {cfg.label}
    </span>
  );
}

// Colored dot + label — padrão dos wireframes (sem emoji, sem ícone Lucide)
export function TemperaturaBadge({ temperatura }: { temperatura: string | null }) {
  if (!temperatura) return null;
  const map: Record<Temperatura, { label: string; dot: string; text: string; bg: string }> = {
    quente: { label: "Quente", dot: "bg-[#DC2626]", text: "text-[#DC2626]", bg: "bg-red-50 border border-red-200" },
    morna:  { label: "Morna",  dot: "bg-[#D97706]", text: "text-[#D97706]", bg: "bg-amber-50 border border-amber-200" },
    fria:   { label: "Fria",   dot: "bg-[#2074B9]", text: "text-[#2074B9]", bg: "bg-blue-50 border border-blue-200" },
  };
  const cfg = map[temperatura as Temperatura];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold", cfg.bg, cfg.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export function getStatusLabel(status: string): string {
  return statusMap[status as StatusProposta]?.label ?? status;
}

export function getStatusStyle(status: string): string {
  return statusMap[status as StatusProposta]?.className ?? "bg-slate-100 text-slate-500";
}

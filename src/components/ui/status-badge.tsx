import { cn } from "@/lib/utils";

type StatusClienteVariant = "prospect" | "ativo" | "inativo";
type SegmentoVariant = "transformador" | "reciclador" | "industria" | "outro";
type PorteVariant = "pequeno" | "medio" | "grande";

const statusClienteMap: Record<StatusClienteVariant, { label: string; className: string }> = {
  prospect: { label: "Prospect", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ativo:    { label: "Ativo",    className: "bg-green-50 text-green-700 border-green-200" },
  inativo:  { label: "Inativo",  className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const segmentoMap: Record<SegmentoVariant, { label: string; dot: string }> = {
  transformador: { label: "Transformador", dot: "bg-blue-500" },
  reciclador:    { label: "Reciclador",    dot: "bg-green-500" },
  industria:     { label: "Indústria",     dot: "bg-purple-500" },
  outro:         { label: "Outro",         dot: "bg-slate-400" },
};

const porteMap: Record<PorteVariant, { label: string }> = {
  pequeno: { label: "Pequeno" },
  medio:   { label: "Médio" },
  grande:  { label: "Grande" },
};

export function StatusClienteBadge({ status }: { status: string }) {
  const config = statusClienteMap[status as StatusClienteVariant] ?? statusClienteMap.prospect;
  return (
    <span className={cn(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
      config.className
    )}>
      {config.label}
    </span>
  );
}

export function SegmentoBadge({ segmento }: { segmento: string }) {
  const config = segmentoMap[segmento as SegmentoVariant] ?? segmentoMap.outro;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
      {config.label}
    </span>
  );
}

export function PorteBadge({ porte }: { porte: string }) {
  const config = porteMap[porte as PorteVariant] ?? porteMap.pequeno;
  return (
    <span className="text-[12px] text-muted-foreground">{config.label}</span>
  );
}

const classMap: Record<PorteVariant, { label: string; className: string }> = {
  grande:  { label: "A", className: "bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]" },
  medio:   { label: "B", className: "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]" },
  pequeno: { label: "C", className: "bg-[#F1F5F9] text-[#6B7280] border-[#E2E8F0]" },
};

export function ClassBadge({ porte }: { porte: string }) {
  const cfg = classMap[porte as PorteVariant] ?? classMap.pequeno;
  return (
    <span className={cn(
      "inline-flex items-center justify-center w-6 h-6 rounded-md border text-[11px] font-bold",
      cfg.className
    )}>
      {cfg.label}
    </span>
  );
}

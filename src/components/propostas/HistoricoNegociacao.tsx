import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/propostas/crm";

export interface EventoHistorico {
  id: string;
  /** criacao, status, etapa, valor, classificacao, mercado, responsavel, versao, anexo, checklist, observacao, followup */
  tipo: string;
  descricao: string;
  detalhes: Record<string, unknown> | null;
  usuario_nome: string | null;
  criado_em: string;
}

const COR: Record<string, string> = {
  criacao: "bg-slate-400", status: "bg-[#2074B9]", etapa: "bg-indigo-500", valor: "bg-emerald-500",
  classificacao: "bg-purple-500", mercado: "bg-slate-500", responsavel: "bg-cyan-500", versao: "bg-amber-500",
  anexo: "bg-teal-500", checklist: "bg-orange-500", observacao: "bg-slate-600", followup: "bg-[#2C4F79]",
};

const texto = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Texto legível de cada evento; `motivos` traduz o código do motivo para o nome configurado. */
function linhas(e: EventoHistorico, motivos: Record<string, string>): { titulo: string; extra?: string } {
  const d = e.detalhes ?? {};
  const moeda = d.moeda === "USD" ? "USD" : "BRL";
  const rotuloStatus = (v: unknown) => STATUS_LABELS[String(v)] ?? String(v ?? "—");
  switch (e.tipo) {
    case "criacao":
      return { titulo: "Proposta criada" };
    case "status": {
      const codigo = texto(d.motivo);
      const partes = [codigo ? `Motivo: ${motivos[codigo] ?? codigo}` : null, texto(d.observacao), d.retomada_prevista ? `Retomada prevista: ${formatDate(String(d.retomada_prevista))}` : null];
      return { titulo: `Status: ${rotuloStatus(d.de)} → ${rotuloStatus(d.para)}`, extra: partes.filter(Boolean).join(" · ") || undefined };
    }
    case "etapa":
      return { titulo: `Etapa: ${texto(d.de) ?? "sem etapa"} → ${texto(d.para) ?? "sem etapa"}` };
    case "valor":
      return { titulo: `Valor: ${d.de != null ? formatCurrency(Number(d.de), moeda) : "—"} → ${d.para != null ? formatCurrency(Number(d.para), moeda) : "—"}` };
    case "classificacao": {
      const rot = (v: unknown) => (v === "complementar" ? "Complementar" : "Principal");
      return { titulo: `Classificação: ${rot(d.de)} → ${rot(d.para)}`, extra: texto(d.principal) ? `Principal do negócio: ${d.principal}` : undefined };
    }
    case "mercado": {
      const rot = (v: unknown) => (v === "exportacao" ? "Exportação" : "Nacional");
      return { titulo: `Mercado: ${rot(d.de)} → ${rot(d.para)}${texto(d.pais) ? ` (${d.pais})` : ""}` };
    }
    case "responsavel":
      return { titulo: `Responsável: ${texto(d.de) ?? "—"} → ${texto(d.para) ?? "—"}` };
    case "versao":
      return { titulo: `Nova versão: ${texto(d.numero) ?? e.descricao}` };
    case "anexo":
      return { titulo: `${e.descricao}: ${texto(d.nome) ?? ""}` };
    case "checklist":
      return { titulo: e.descricao, extra: texto(d.novo) ?? undefined };
    case "followup":
      return { titulo: e.descricao, extra: texto(d.resumo) ?? undefined };
    default:
      return { titulo: e.descricao };
  }
}

/** Linha do tempo da negociação (mais recente primeiro). */
export function HistoricoNegociacao({ eventos, motivos }: { eventos: EventoHistorico[]; motivos: Record<string, string> }) {
  if (!eventos.length) return <p className="py-4 text-center text-[12px] text-muted-foreground">Nenhum evento registrado ainda</p>;
  return (
    <ol className="relative flex flex-col gap-0">
      <span className="absolute bottom-2 left-[5px] top-2 w-px bg-border" aria-hidden />
      {eventos.map((e) => {
        const { titulo, extra } = linhas(e, motivos);
        return (
          <li key={e.id} className="relative flex gap-3 py-2.5 pl-0">
            <span className={`z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-card ${COR[e.tipo] ?? "bg-slate-400"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{titulo}</p>
              {extra && <p className="mt-0.5 whitespace-pre-line text-[12px] text-muted-foreground">{extra}</p>}
              <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(e.criado_em)}{e.usuario_nome ? ` · ${e.usuario_nome}` : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

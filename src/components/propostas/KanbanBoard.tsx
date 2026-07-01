"use client";

import Link from "next/link";
import { formatCurrency, getInitials } from "@/lib/utils";
import { PropostaStatusBadge, TemperaturaBadge } from "./StatusBadge";

interface EtapaComPropostas {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  propostas: Array<{
    id: string;
    numero_completo: string;
    tipo: string;
    status: string;
    temperatura: string | null;
    valor_total: number | null;
    cliente_nome: string | null;
    responsavel_nome: string | null;
  }>;
}

interface KanbanBoardProps {
  colunas: EtapaComPropostas[];
  semEtapa: Array<{
    id: string;
    numero_completo: string;
    tipo: string;
    status: string;
    temperatura: string | null;
    valor_total: number | null;
    cliente_nome: string | null;
    responsavel_nome: string | null;
  }>;
}

function PropostaCard({ p }: { p: KanbanBoardProps["colunas"][0]["propostas"][0] }) {
  return (
    <Link href={`/propostas/${p.id}`}>
      <div className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all hover:border-slate-300 group">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] font-bold text-[#2074B9]">{p.numero_completo}</span>
          <TemperaturaBadge temperatura={p.temperatura} />
        </div>
        <p className="text-[12px] font-semibold text-foreground truncate mb-2">
          {p.cliente_nome ?? "Sem cliente"}
        </p>
        <div className="flex items-center justify-between">
          <PropostaStatusBadge status={p.status} />
          {p.valor_total ? (
            <span className="text-[11px] font-mono font-semibold text-foreground">
              {formatCurrency(p.valor_total)}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>
        {p.responsavel_nome && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="h-4 w-4 rounded-full bg-[#2074B9] flex items-center justify-center text-[8px] font-bold text-white">
              {getInitials(p.responsavel_nome).slice(0, 1)}
            </div>
            <span className="text-[11px] text-muted-foreground">{p.responsavel_nome}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function KanbanBoard({ colunas, semEtapa }: KanbanBoardProps) {
  return (
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-3.5 p-6 min-h-full items-start" style={{ minWidth: `${(colunas.length + 1) * 286}px` }}>
        {colunas.map((col) => {
          const total = col.propostas.reduce((s, p) => s + (p.valor_total ?? 0), 0);
          return (
            <div key={col.id} className="w-[272px] shrink-0 flex flex-col gap-0">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border border-b-0 rounded-t-xl">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.cor }} />
                <p className="text-[12px] font-semibold text-foreground flex-1 truncate">{col.nome}</p>
                <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {col.propostas.length}
                </span>
                {total > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatCurrency(total, "BRL").replace("R$ ", "R$ ")}
                  </span>
                )}
              </div>
              <div className="bg-muted/40 border border-border rounded-b-xl p-2 flex flex-col gap-2 min-h-[200px]">
                {col.propostas.map((p) => <PropostaCard key={p.id} p={p} />)}
                {col.propostas.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-6 opacity-60">
                    Nenhuma proposta
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Coluna: sem etapa */}
        {semEtapa.length > 0 && (
          <div className="w-[272px] shrink-0 flex flex-col gap-0">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border border-b-0 rounded-t-xl">
              <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
              <p className="text-[12px] font-semibold text-muted-foreground flex-1">Sem etapa</p>
              <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {semEtapa.length}
              </span>
            </div>
            <div className="bg-muted/40 border border-border rounded-b-xl p-2 flex flex-col gap-2 min-h-[200px]">
              {semEtapa.map((p) => <PropostaCard key={p.id} p={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

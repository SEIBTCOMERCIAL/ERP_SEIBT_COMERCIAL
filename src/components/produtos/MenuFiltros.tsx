"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, SlidersHorizontal } from "lucide-react";
import type { FiltrosProdutos } from "@/lib/produtos/regras";

const SITUACOES = [["ativos", "Ativos"], ["descontinuados", "Descontinuados"], ["todos", "Todos"]] as const;
const ORDENS = [["padrao", "Ordem do cadastro"], ["nome", "Nome / descrição"], ["codigo", "Código"], ["preco", "Preço"], ["atualizado", "Última alteração"]] as const;
const campo = "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-[#2074B9]";

export interface Pendencias { sem_preco: number; sem_foto: number; ficha_incompleta: number; sem_vinculo: number }

/** Filtros e ordenação reunidos num menu só: situação, ordem e pendências de cadastro. */
export function MenuFiltros({ filtros, maquinas, pendenciasDisponiveis, contagem, aoMudar }: {
  filtros: FiltrosProdutos; maquinas: boolean; pendenciasDisponiveis: boolean; contagem: Pendencias; aoMudar: (parcial: Partial<FiltrosProdutos>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const ativos = (filtros.situacao !== "ativos" ? 1 : 0) + (filtros.ordem !== "padrao" ? 1 : 0) + (filtros.pendencia ? 1 : 0);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);

  const pendencias: Array<[FiltrosProdutos["pendencia"], string, number]> = maquinas
    ? [["sem_preco", "Sem preço", contagem.sem_preco], ["sem_foto", "Sem foto", contagem.sem_foto], ["ficha_incompleta", "Ficha incompleta", contagem.ficha_incompleta]]
    : [["sem_preco", "Sem preço", contagem.sem_preco], ["sem_vinculo", "Sem equipamento", contagem.sem_vinculo]];

  return (
    <div ref={raiz} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={aberto} onClick={() => setAberto(!aberto)}
        className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-muted/50">
        <SlidersHorizontal className="h-4 w-4" aria-hidden />Filtros
        {ativos > 0 && <span className="rounded-full bg-[#2C4F79] px-1.5 text-xs font-semibold text-white" aria-label={`${ativos} filtros ativos`}>{ativos}</span>}
      </button>
      {aberto && (
        <div role="dialog" aria-label="Filtros e ordenação" className="absolute right-0 top-11 z-30 flex w-72 flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Situação
            <select value={filtros.situacao} onChange={(e) => aoMudar({ situacao: e.target.value as FiltrosProdutos["situacao"] })} className={campo}>
              {SITUACOES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Ordenar por
            <div className="flex gap-2">
              <select value={filtros.ordem} aria-label="Ordenar por" onChange={(e) => aoMudar({ ordem: e.target.value as FiltrosProdutos["ordem"] })} className={campo}>
                {ORDENS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
              {filtros.ordem !== "padrao" && (
                <button type="button" onClick={() => aoMudar({ dir: filtros.dir === "asc" ? "desc" : "asc" })} aria-label={`Ordem ${filtros.dir === "asc" ? "crescente" : "decrescente"}. Inverter`}
                  className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-xs text-foreground hover:bg-muted"><ArrowDownUp className="h-3.5 w-3.5" aria-hidden />{filtros.dir === "asc" ? "A→Z" : "Z→A"}</button>
              )}
            </div>
          </div>
          {pendenciasDisponiveis && (
            <fieldset className="flex flex-col gap-0.5">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">Pendências de cadastro</legend>
              {pendencias.map(([v, nome, n]) => (
                <label key={v} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm text-foreground hover:bg-muted">
                  <span className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#2C4F79]" checked={filtros.pendencia === v} onChange={() => aoMudar({ pendencia: filtros.pendencia === v ? "" : v })} />{nome}</span>
                  <span className="text-xs text-muted-foreground">{n}</span>
                </label>
              ))}
            </fieldset>
          )}
          {ativos > 0 && <button type="button" onClick={() => aoMudar({ situacao: "ativos", ordem: "padrao", dir: "asc", pendencia: "" })} className="self-start text-xs font-medium text-[#2074B9] hover:underline">Limpar filtros</button>}
        </div>
      )}
    </div>
  );
}

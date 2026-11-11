"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ResumoEscopo } from "@/lib/reajuste/tipos";

/** Linhas ou categorias. No celular vira um seletor; no computador, uma lista lateral com busca. */
export function ListaEscopos({ rotulo, escopos, selecionado, aoSelecionar }: {
  rotulo: string;
  escopos: ResumoEscopo[];
  /** null = busca em todas. */
  selecionado: string | null;
  aoSelecionar: (id: string | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? escopos.filter((e) => e.nome.toLowerCase().includes(t)) : escopos;
  }, [escopos, busca]);
  const pendentes = (e: ResumoEscopo) => e.sem_reajuste + e.parcial;

  return (
    <>
      <div className="md:hidden">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">{rotulo}
          <select value={selecionado ?? ""} onChange={(e) => aoSelecionar(e.target.value || null)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground">
            <option value="">Buscar em todas</option>
            {escopos.map((e) => <option key={e.id} value={e.id}>{e.nome} ({e.total}){pendentes(e) ? ` · ${pendentes(e)} pendentes` : ""}</option>)}
          </select>
        </label>
      </div>

      <nav aria-label={rotulo} className="hidden w-64 shrink-0 flex-col gap-2 md:flex">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${rotulo.toLowerCase()}`} aria-label={`Buscar ${rotulo.toLowerCase()}`}
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-[#2074B9]" />
        </div>
        <ul className="flex max-h-[calc(100vh-18rem)] flex-col gap-0.5 overflow-y-auto pr-1">
          <li>
            <button type="button" onClick={() => aoSelecionar(null)} aria-current={selecionado === null}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${selecionado === null ? "bg-[#2C4F79] text-white" : "text-foreground hover:bg-muted"}`}>
              Buscar em todas
            </button>
          </li>
          {visiveis.map((e) => {
            const ativo = selecionado === e.id;
            return (
              <li key={e.id}>
                <button type="button" onClick={() => aoSelecionar(e.id)} aria-current={ativo}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${ativo ? "bg-[#2C4F79] text-white" : "text-foreground hover:bg-muted"}`}>
                  <span className="min-w-0 truncate">{e.nome}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs">
                    {pendentes(e) > 0 && <span title="Sem reajuste ou parcialmente reajustados" className={`rounded-full px-1.5 py-0.5 font-semibold ${ativo ? "bg-white/25 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>{pendentes(e)}</span>}
                    <span className={ativo ? "text-white/80" : "text-muted-foreground"}>{e.total}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {visiveis.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</li>}
        </ul>
      </nav>
    </>
  );
}

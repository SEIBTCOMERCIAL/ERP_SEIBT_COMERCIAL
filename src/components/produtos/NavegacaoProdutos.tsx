"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Aba, Navegacao } from "@/lib/produtos/tipos";

interface Grupo { nome: string; itens: Array<{ id: string; nome: string; total: number; pendencias: number }>; total: number }

/** Famílias/linhas (máquinas) ou categorias (peças), na ordem configurada. No celular vira um seletor. */
export function NavegacaoProdutos({ aba, nav, escopo, aoSelecionar }: { aba: Aba; nav: Navegacao; escopo: string | null; aoSelecionar: (id: string | null) => void }) {
  const [busca, setBusca] = useState("");

  const grupos = useMemo<Grupo[]>(() => {
    const t = busca.trim().toLowerCase();
    if (aba === "pecas") {
      const itens = nav.categorias.filter((c) => !t || c.nome.toLowerCase().includes(t))
        .map((c) => ({ id: c.id, nome: c.nome, total: c.contagem.total, pendencias: c.contagem.sem_preco + c.contagem.sem_vinculo }));
      return [{ nome: "Categorias", itens, total: itens.reduce((s, i) => s + i.total, 0) }];
    }
    const mapa = new Map<string, Grupo & { ordem: number }>();
    for (const l of nav.linhas) {
      if (t && !l.nome.toLowerCase().includes(t) && !(l.familia ?? "").toLowerCase().includes(t)) continue;
      const nome = l.familia ?? "Sem família";
      const g = mapa.get(nome) ?? { nome, itens: [], total: 0, ordem: l.familia_ordem };
      g.itens.push({ id: l.id, nome: l.nome, total: l.contagem.total, pendencias: l.contagem.sem_preco + l.contagem.sem_foto + l.contagem.ficha_incompleta });
      g.total += l.contagem.total;
      mapa.set(nome, g);
    }
    // Ordem configurada das famílias e das linhas (a lista já chega ordenada do banco): nada é reordenado por quantidade.
    return Array.from(mapa.values()).sort((a, b) => a.ordem - b.ordem);
  }, [aba, nav, busca]);

  const todos = aba === "maquinas" ? nav.linhas.reduce((s, l) => s + l.contagem.total, 0) : nav.categorias.reduce((s, c) => s + c.contagem.total, 0);
  const rotulo = aba === "maquinas" ? "Famílias e linhas" : "Categorias";

  return (
    <>
      <div className="md:hidden">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">{rotulo}
          <select value={escopo ?? ""} onChange={(e) => aoSelecionar(e.target.value || null)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground">
            <option value="">{aba === "maquinas" ? `Todas as máquinas (${todos})` : `Todas as peças (${todos})`}</option>
            {grupos.map((g) => (
              <optgroup key={g.nome} label={g.nome}>{g.itens.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.total})</option>)}</optgroup>
            ))}
          </select>
        </label>
      </div>

      <nav aria-label={rotulo} className="hidden w-60 shrink-0 flex-col gap-2 md:flex">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label={`Filtrar ${rotulo.toLowerCase()}`} placeholder={aba === "maquinas" ? "Filtrar linhas…" : "Filtrar categorias…"}
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-[#2074B9]" />
        </div>
        <div className="flex max-h-[calc(100vh-15rem)] flex-col gap-3 overflow-y-auto pr-1">
          <button type="button" onClick={() => aoSelecionar(null)} aria-current={escopo === null}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${escopo === null ? "bg-[#2C4F79] text-white" : "text-foreground hover:bg-muted"}`}>
            <span>{aba === "maquinas" ? "Todas as máquinas" : "Todas as peças"}</span><span className={`text-xs ${escopo === null ? "text-white/80" : "text-muted-foreground"}`}>{todos}</span>
          </button>
          {grupos.map((g) => (
            <section key={g.nome} aria-label={g.nome}>
              {aba === "maquinas" && <h3 className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.nome} <span className="font-normal">· {g.total}</span></h3>}
              <ul className="flex flex-col gap-0.5">
                {g.itens.map((i) => {
                  const ativo = escopo === i.id;
                  return (
                    <li key={i.id}>
                      <button type="button" onClick={() => aoSelecionar(i.id)} aria-current={ativo}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${ativo ? "bg-[#2C4F79] text-white" : "text-foreground hover:bg-muted"}`}>
                        <span className="min-w-0 truncate">{i.nome}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs">
                          {i.pendencias > 0 && <span title="Há pendências de cadastro neste grupo" className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-amber-300" : "bg-amber-500"}`} aria-label="com pendências" />}
                          <span className={ativo ? "text-white/80" : "text-muted-foreground"}>{i.total}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {grupos.every((g) => g.itens.length === 0) && <p className="px-3 text-sm text-muted-foreground">Nada encontrado.</p>}
        </div>
      </nav>
    </>
  );
}

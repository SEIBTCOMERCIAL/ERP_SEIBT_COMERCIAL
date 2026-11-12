"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { ResumoEscopo } from "@/lib/reajuste/tipos";

/** Seletor pesquisável de linha (Máquinas) ou categoria (Peças), com a opção de consultar todas. */
export function SeletorEscopo({ rotulo, todos, escopos, selecionado, aoSelecionar }: {
  /** "Linha" ou "Categoria". */
  rotulo: string;
  /** "Todas as linhas" / "Todas as categorias". */
  todos: string;
  escopos: ResumoEscopo[];
  /** null = todas. */
  selecionado: string | null;
  aoSelecionar: (id: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idLista = useId();

  const opcoes = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const filtradas = t ? escopos.filter((e) => e.nome.toLowerCase().includes(t)) : escopos;
    return [...(t && !todos.toLowerCase().includes(t) ? [] : [{ id: null as string | null, nome: todos, total: null as number | null }]),
      ...filtradas.map((e) => ({ id: e.id as string | null, nome: e.nome, total: e.total as number | null }))];
  }, [escopos, busca, todos]);

  const atual = escopos.find((e) => e.id === selecionado)?.nome ?? todos;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  function escolher(id: string | null) { aoSelecionar(id); setAberto(false); setBusca(""); botao.current?.focus(); }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, opcoes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (opcoes[ativo]) escolher(opcoes[ativo].id); }
    else if (e.key === "Escape") { e.stopPropagation(); setAberto(false); botao.current?.focus(); }
  }

  return (
    <div ref={raiz} className="relative min-w-0">
      <button ref={botao} type="button" aria-haspopup="listbox" aria-expanded={aberto} aria-label={`${rotulo}: ${atual}. Alterar`}
        onClick={() => { setAberto(!aberto); setAtivo(Math.max(0, selecionado ? opcoes.findIndex((o) => o.id === selecionado) : 0)); }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm text-foreground hover:bg-muted/50 focus-visible:border-[#2074B9] focus-visible:outline-none">
        <span className="truncate"><span className="text-muted-foreground">{rotulo}: </span>{atual}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {aberto && (
        <div className="absolute left-0 top-11 z-30 w-full min-w-[16rem] rounded-lg border border-border bg-card p-2 shadow-lg" onKeyDown={teclado}>
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input autoFocus value={busca} onChange={(e) => { setBusca(e.target.value); setAtivo(0); }} aria-label={`Buscar ${rotulo.toLowerCase()}`}
              role="combobox" aria-expanded="true" aria-controls={idLista} placeholder={`Buscar ${rotulo.toLowerCase()}`}
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:border-[#2074B9]" />
          </div>
          <ul id={idLista} role="listbox" aria-label={rotulo} className="max-h-64 overflow-y-auto">
            {opcoes.map((o, i) => (
              <li key={o.id ?? "todas"} role="option" aria-selected={o.id === selecionado}>
                <button type="button" tabIndex={-1} onClick={() => escolher(o.id)} onMouseEnter={() => setAtivo(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm ${i === ativo ? "bg-muted" : ""} ${o.id === selecionado ? "font-semibold text-foreground" : "text-foreground"}`}>
                  <span className="flex min-w-0 items-center gap-2">{o.id === selecionado ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <span className="w-3.5 shrink-0" />}<span className="truncate">{o.nome}</span></span>
                  {o.total !== null && <span className="shrink-0 text-xs text-muted-foreground">{o.total}</span>}
                </button>
              </li>
            ))}
            {opcoes.length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

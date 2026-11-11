"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Filter, LayoutDashboard } from "lucide-react";

const CHAVE = "erp-propostas-painel";

/**
 * Indicadores e filtros da página de Propostas, com botões para recolher cada bloco
 * e dar mais espaço ao quadro. A escolha fica guardada neste navegador.
 */
export function PainelPropostas({ indicadores, filtros, filtrosAtivos }: {
  indicadores: React.ReactNode;
  filtros: React.ReactNode;
  /** Há filtro aplicado: o botão avisa, mesmo com o bloco recolhido. */
  filtrosAtivos: boolean;
}) {
  const [mostrarIndicadores, setMostrarIndicadores] = useState(true);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as { i?: boolean; f?: boolean } | null;
      if (salvo) {
        setMostrarIndicadores(salvo.i !== false);
        setMostrarFiltros(salvo.f !== false);
      }
    } catch { /* sem armazenamento: tudo visível */ }
  }, []);

  function guardar(i: boolean, f: boolean) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ i, f })); } catch { /* ignora */ }
  }

  const botao = "flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium text-muted-foreground hover:text-foreground";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-expanded={mostrarIndicadores} className={botao}
          onClick={() => { setMostrarIndicadores(!mostrarIndicadores); guardar(!mostrarIndicadores, mostrarFiltros); }}>
          <LayoutDashboard className="h-3.5 w-3.5" />Indicadores
          {mostrarIndicadores ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <button type="button" aria-expanded={mostrarFiltros} className={botao}
          onClick={() => { setMostrarFiltros(!mostrarFiltros); guardar(mostrarIndicadores, !mostrarFiltros); }}>
          <Filter className="h-3.5 w-3.5" />Filtros{filtrosAtivos && <span className="h-1.5 w-1.5 rounded-full bg-[#2074B9]" title="Há filtros aplicados" />}
          {mostrarFiltros ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
      {mostrarIndicadores && indicadores}
      {mostrarFiltros && filtros}
    </>
  );
}

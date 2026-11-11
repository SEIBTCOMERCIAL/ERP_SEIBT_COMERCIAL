"use client";

import { useEffect, useState } from "react";
import { BarChart3, Maximize2, Minimize2, SlidersHorizontal } from "lucide-react";
import { PainelLateral } from "./PainelLateral";

const botao = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted";

/**
 * Cabeçalho compacto dos quadros (Propostas e Leads). Duas linhas: título + ações; busca + botões.
 * Filtros avançados ficam num painel lateral; indicadores detalhados recolhidos. A altura acompanha
 * o conteúdo, sem redimensionar textos. "Expandir quadro" esconde tudo o que é secundário.
 */
export function CabecalhoKanban({
  chave, titulo, contagem, acoes, busca, filtrosQtd, painelFiltros, tituloFiltros = "Filtros",
  chips, resumo, indicadores, avisos,
}: {
  /** Identifica o quadro para lembrar "Expandir quadro" neste navegador. */
  chave: string;
  titulo: string;
  contagem: string;
  acoes?: React.ReactNode;
  busca: React.ReactNode;
  /** Quantidade de filtros avançados ativos (sem contar a busca). */
  filtrosQtd: number;
  /** Conteúdo do painel de filtros; pode receber a função que fecha o painel. */
  painelFiltros: React.ReactNode | ((fechar: () => void) => React.ReactNode);
  tituloFiltros?: string;
  /** Etiquetas dos filtros ativos (removíveis), abaixo da busca. */
  chips?: React.ReactNode;
  /** Resumo discreto, na linha da busca. */
  resumo?: React.ReactNode;
  /** Indicadores detalhados, ao clicar em "Indicadores". */
  indicadores?: React.ReactNode;
  avisos?: React.ReactNode;
}) {
  const [expandido, setExpandido] = useState(false);
  const [indicadoresAbertos, setIndicadoresAbertos] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const chaveArmazenada = `erp-quadro-expandido-${chave}`;

  useEffect(() => {
    try { setExpandido(localStorage.getItem(chaveArmazenada) === "1"); } catch { /* sem armazenamento: normal */ }
  }, [chaveArmazenada]);

  function alternarExpandido() {
    const novo = !expandido;
    setExpandido(novo);
    try { localStorage.setItem(chaveArmazenada, novo ? "1" : "0"); } catch { /* ignora */ }
  }

  const fecharFiltros = () => setFiltrosAbertos(false);

  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-border bg-background px-4 pb-3 pt-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{titulo}</h1>
          <span className="text-xs text-muted-foreground">{contagem}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {acoes}
          <button type="button" onClick={alternarExpandido} className={botao} title={expandido ? "Mostrar indicadores e resumo novamente" : "Dar mais espaço ao quadro"}>
            {expandido ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="max-sm:hidden">{expandido ? "Restaurar cabeçalho" : "Expandir quadro"}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1 sm:max-w-md">{busca}</div>
        <button type="button" onClick={() => setFiltrosAbertos(true)} className={botao} aria-haspopup="dialog">
          <SlidersHorizontal className="h-4 w-4" />Filtros
          {filtrosQtd > 0 && <span className="rounded-full bg-[#2C4F79] px-1.5 text-xs font-semibold text-white">{filtrosQtd}</span>}
        </button>
        {!expandido && indicadores && (
          <button type="button" onClick={() => setIndicadoresAbertos(!indicadoresAbertos)} className={botao} aria-expanded={indicadoresAbertos}>
            <BarChart3 className="h-4 w-4" />Indicadores
          </button>
        )}
        {!expandido && resumo && <div className="min-w-0 text-xs text-muted-foreground lg:ml-auto">{resumo}</div>}
      </div>

      {!expandido && chips && <div className="flex flex-wrap items-center gap-2">{chips}</div>}
      {!expandido && avisos}
      {!expandido && indicadoresAbertos && indicadores}

      <PainelLateral aberto={filtrosAbertos} aoFechar={fecharFiltros} titulo={tituloFiltros}>
        {typeof painelFiltros === "function" ? painelFiltros(fecharFiltros) : painelFiltros}
      </PainelLateral>
    </header>
  );
}

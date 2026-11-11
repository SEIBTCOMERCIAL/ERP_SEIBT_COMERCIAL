"use client";

import { useEffect, useRef, useState } from "react";
import { Move } from "lucide-react";

const CHAVE = "erp-propostas-altura-topo";
const ALTURA_MINIMA_QUADRO = 220;
const ALTURA_TOPBAR = 56;

/**
 * Divide a tela de Propostas em duas partes: topo (título, indicadores e filtros) e quadro.
 * O topo mostra tudo, sem barra de rolagem, e se ajusta ao conteúdo. A alça com a cruz entre as
 * duas partes arrasta para cima (dá mais espaço ao quadro) ou para baixo. Duplo clique volta ao automático.
 */
export function LayoutPropostas({ topo, children }: { topo: React.ReactNode; children: React.ReactNode }) {
  const [altura, setAltura] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inicio = useRef<{ y: number; altura: number } | null>(null);
  const topoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(CHAVE));
      if (salvo > 0) setAltura(salvo);
    } catch { /* sem armazenamento: tamanho automático */ }
  }, []);

  function limitar(valor: number) {
    const maximo = window.innerHeight - ALTURA_TOPBAR - ALTURA_MINIMA_QUADRO;
    const conteudo = topoRef.current?.scrollHeight ?? maximo;
    return Math.round(Math.max(0, Math.min(valor, maximo, conteudo)));
  }

  function guardar(valor: number | null) {
    try {
      if (valor === null) localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, String(valor));
    } catch { /* ignora */ }
  }

  function aoComecar(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = { y: e.clientY, altura: topoRef.current?.getBoundingClientRect().height ?? 0 };
    setArrastando(true);
  }

  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    if (!inicio.current) return;
    setAltura(limitar(inicio.current.altura + (e.clientY - inicio.current.y)));
  }

  function aoSoltar() {
    if (!inicio.current) return;
    inicio.current = null;
    setArrastando(false);
    setAltura((atual) => { guardar(atual); return atual; });
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLDivElement>) {
    const base = altura ?? topoRef.current?.getBoundingClientRect().height ?? 0;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const novo = limitar(base + (e.key === "ArrowDown" ? 40 : -40));
      setAltura(novo);
      guardar(novo);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden pb-2">
      <div
        ref={topoRef}
        className="shrink-0 overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6"
        // Sem barra de rolagem: a parte de cima ocupa a altura do próprio conteúdo (acompanha quando
        // blocos são recolhidos ou abertos) e a alça só define o limite máximo que ela pode ocupar.
        style={{ maxHeight: altura ?? `calc(100vh - ${ALTURA_TOPBAR}px - ${ALTURA_MINIMA_QUADRO + 20}px)` }}
      >
        <div className="flex flex-col gap-3 pb-1">{topo}</div>
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Arraste para ajustar o espaço entre filtros e quadro"
        tabIndex={0}
        title="Arraste para cima ou para baixo (duplo clique volta ao automático)"
        onPointerDown={aoComecar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onDoubleClick={() => { setAltura(null); guardar(null); }}
        onKeyDown={aoTeclar}
        className={`group relative flex h-5 shrink-0 cursor-row-resize touch-none select-none items-center justify-center ${arrastando ? "bg-[#2074B9]/10" : "hover:bg-muted/60"}`}
      >
        <span className="absolute inset-x-6 top-1/2 h-px bg-border" />
        <span className={`relative flex h-5 w-8 items-center justify-center rounded-full border bg-card shadow-sm ${arrastando ? "border-[#2074B9] text-[#2074B9]" : "border-border text-muted-foreground group-hover:text-foreground"}`}>
          <Move className="h-3 w-3" />
        </span>
      </div>

      {children}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Move } from "lucide-react";

const CHAVE = "erp-propostas-altura-topo";
const ALTURA_MINIMA_QUADRO = 260;
const ALTURA_TOPBAR = 56;
const ZOOM_MINIMO = 0.55;
const ALTURA_MINIMA_TOPO = 120;

/**
 * Divide a tela de Propostas em duas partes: topo (título, indicadores e filtros) e quadro.
 * O topo sempre mostra todas as informações: quando o espaço diminui, o conteúdo encolhe
 * (e se reorganiza) para caber; quando há espaço, volta ao tamanho normal. A alça com a cruz
 * entre as partes arrasta para cima ou para baixo; duplo clique volta ao automático.
 */
export function LayoutPropostas({ topo, children }: { topo: React.ReactNode; children: React.ReactNode }) {
  const [altura, setAltura] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [alturaNatural, setAlturaNatural] = useState(0);
  const inicio = useRef<{ y: number; altura: number } | null>(null);
  const topoRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(CHAVE));
      if (salvo > 0) setAltura(salvo);
    } catch { /* sem armazenamento: tamanho automático */ }
  }, []);

  /** Escolhe o maior zoom (até 100%) em que o conteúdo cabe no espaço disponível do topo. */
  const ajustar = useCallback(() => {
    const topoEl = topoRef.current;
    const el = conteudoRef.current;
    if (!topoEl || !el) return;
    const cs = getComputedStyle(topoEl);
    const folga = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const limiteTela = window.innerHeight - ALTURA_TOPBAR - ALTURA_MINIMA_QUADRO;
    const alvo = Math.max(ALTURA_MINIMA_TOPO, Math.min(altura ?? limiteTela, limiteTela)) - folga;

    el.style.zoom = "1";
    const natural = el.getBoundingClientRect().height;
    setAlturaNatural((anterior) => (Math.abs(anterior - natural) > 1 ? natural + folga : anterior));
    let zoom = 1;
    for (let i = 0; i < 8 && el.getBoundingClientRect().height > alvo && zoom > ZOOM_MINIMO; i++) {
      zoom = Math.max(ZOOM_MINIMO, zoom * Math.min(0.97, (alvo / el.getBoundingClientRect().height) * 1.02));
      el.style.zoom = String(zoom);
    }
  }, [altura]);

  useLayoutEffect(() => { ajustar(); }, [ajustar]);

  // Reajusta quando o conteúdo muda (blocos recolhidos/abertos, filtros) ou a janela é redimensionada.
  useEffect(() => {
    const el = conteudoRef.current;
    if (!el) return;
    const observador = new ResizeObserver(() => ajustar());
    observador.observe(el);
    window.addEventListener("resize", ajustar);
    return () => { observador.disconnect(); window.removeEventListener("resize", ajustar); };
  }, [ajustar]);

  function limitar(valor: number) {
    const maximo = window.innerHeight - ALTURA_TOPBAR - ALTURA_MINIMA_QUADRO;
    const natural = alturaNatural || maximo;
    return Math.round(Math.max(ALTURA_MINIMA_TOPO, Math.min(valor, maximo, natural)));
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
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const base = altura ?? topoRef.current?.getBoundingClientRect().height ?? 0;
    const novo = limitar(base + (e.key === "ArrowDown" ? 40 : -40));
    setAltura(novo);
    guardar(novo);
  }

  // Com altura escolhida (menor que o tamanho natural), o topo ocupa exatamente esse espaço.
  const fixa = altura !== null && (!alturaNatural || altura < alturaNatural);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden pb-2">
      <div
        ref={topoRef}
        className="shrink-0 overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6"
        style={fixa ? { height: altura ?? undefined } : undefined}
      >
        <div ref={conteudoRef} className="flex flex-col gap-3 pb-1">{topo}</div>
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

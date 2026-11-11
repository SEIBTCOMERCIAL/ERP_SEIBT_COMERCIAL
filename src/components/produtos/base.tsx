"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { SITUACAO_PRODUTO_ROTULO, type SituacaoProduto } from "@/lib/produtos/regras";

export const campoCls = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#2074B9] disabled:opacity-60";
export const areaCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[#2074B9] disabled:opacity-60";
export const botaoPrimario = "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white hover:bg-[#1E3A5F] disabled:opacity-50";
export const botaoSecundario = "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50";
export const botaoLeve = "inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";

/** Aviso de saída: enquanto há alterações não salvas, o navegador pergunta antes de fechar ou recarregar a página. */
export function useAvisoSaida(alteracoesPendentes: boolean) {
  useEffect(() => {
    if (!alteracoesPendentes) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alteracoesPendentes]);
}

export function Campo({ rotulo, dica, children, obrigatorio }: { rotulo: string; dica?: string; children: React.ReactNode; obrigatorio?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
      <span>{rotulo}{obrigatorio && <span className="text-red-600"> *</span>}</span>
      {children}
      {dica && <span className="text-xs font-normal text-muted-foreground">{dica}</span>}
    </label>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "info" | "sucesso" | "alerta"; children: React.ReactNode }) {
  const cores = {
    erro: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    info: "border-border bg-muted text-foreground",
    sucesso: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
    alerta: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  } as const;
  const Icone = tipo === "sucesso" ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${cores[tipo]}`}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><div className="min-w-0">{children}</div>
    </div>
  );
}

const CLASSE_SITUACAO: Record<SituacaoProduto, string> = {
  ativo: "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
  descontinuado: "border-border bg-muted text-muted-foreground",
  inativo: "border-border bg-muted text-muted-foreground",
  excluido: "border-red-200 bg-red-50 text-red-800",
};

export function SituacaoPill({ situacao }: { situacao: SituacaoProduto }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${CLASSE_SITUACAO[situacao]}`}>{SITUACAO_PRODUTO_ROTULO[situacao]}</span>;
}

/** Janela de diálogo acessível: Esc fecha, o foco vai para o primeiro campo e volta ao botão de origem ao fechar. */
export function Modal({ titulo, aoFechar, children, largura = "max-w-xl", bloqueado = false }: {
  titulo: string; aoFechar: () => void; children: React.ReactNode; largura?: string; bloqueado?: boolean;
}) {
  const id = useId();
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    caixa.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-fechar])")?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !bloqueado) aoFechar();
      if (e.key === "Tab" && caixa.current) {
        const itens = Array.from(caixa.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"));
        if (!itens.length) return;
        const primeiro = itens[0], ultimo = itens[itens.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); anterior?.focus?.(); };
  }, [aoFechar, bloqueado]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby={id} className={`flex max-h-[94vh] w-full ${largura} flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-xl`}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id={id} className="text-base font-semibold text-foreground">{titulo}</h2>
          <button type="button" data-fechar aria-label="Fechar" disabled={bloqueado} onClick={aoFechar} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

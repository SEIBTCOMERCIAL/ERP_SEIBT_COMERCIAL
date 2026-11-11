"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Painel que desliza da direita (filtros, configurações). Fecha com Esc, no X ou clicando fora. */
export function PainelLateral({ aberto, aoFechar, titulo, largura = 400, children }: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  largura?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Fechar painel" className="absolute inset-0 bg-black/40" onClick={aoFechar} />
      <aside className="relative flex h-full w-full flex-col border-l border-border bg-background shadow-xl" style={{ maxWidth: largura }}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
          <button type="button" aria-label="Fechar" onClick={aoFechar} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

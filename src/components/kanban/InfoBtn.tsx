"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

/** Botão "i" que abre uma explicação curta ao lado de um indicador. */
export function InfoBtn({ texto, titulo = "Mais informações" }: { texto: string; titulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);

  return (
    <span ref={raiz} className="relative inline-flex">
      <button type="button" aria-label={titulo} aria-expanded={aberto} onClick={() => setAberto(!aberto)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
        <Info className="h-4 w-4" />
      </button>
      {aberto && (
        <span role="tooltip" className="absolute left-0 top-7 z-40 block w-72 max-w-[80vw] rounded-lg border border-border bg-card p-3 text-xs font-normal leading-relaxed text-foreground shadow-lg">
          {texto}
        </span>
      )}
    </span>
  );
}

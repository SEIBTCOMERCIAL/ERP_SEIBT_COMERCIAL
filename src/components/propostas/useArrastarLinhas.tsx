"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

/**
 * Arrastar linhas para mudar a ordem: clique e segure na alça (⋮⋮), arraste para cima ou para baixo e solte.
 * Só a alça arrasta (campos de texto da linha continuam editáveis). Em telas de toque, que não arrastam,
 * ficam as setas ▲ ▼.
 */
export function useArrastarLinhas(aoMover: (deChave: string, paraChave: string) => void) {
  const [liberada, setLiberada] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const propsLinha = (chave: string) => ({
    draggable: liberada === chave,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", chave);
      setArrastando(chave);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!arrastando) return;
      e.preventDefault();
      if (sobre !== chave) setSobre(chave);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (arrastando && arrastando !== chave) aoMover(arrastando, chave);
      setArrastando(null); setSobre(null); setLiberada(null);
    },
    onDragEnd: () => { setArrastando(null); setSobre(null); setLiberada(null); },
  });

  const propsAlca = (chave: string) => ({
    onMouseDown: () => setLiberada(chave),
    onMouseUp: () => { if (!arrastando) setLiberada(null); },
  });

  /** Classes de destaque da linha (a que está sendo arrastada e a que vai receber). */
  const classeLinha = (chave: string) =>
    arrastando === chave ? "opacity-40" : sobre === chave && arrastando && arrastando !== chave ? "bg-blue-50 outline outline-2 -outline-offset-2 outline-[#2074B9]/50" : "";

  return { propsLinha, propsAlca, classeLinha };
}

/** Alça de arrastar + setas ▲ ▼ (para telas de toque e para quem prefere clicar). */
export function ControleOrdem({
  alcaProps, indice, total, onSubir, onDescer,
}: {
  alcaProps: { onMouseDown: () => void; onMouseUp: () => void };
  indice: number;
  total: number;
  onSubir: () => void;
  onDescer: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-muted-foreground">
      <button type="button" onClick={onSubir} disabled={indice === 0} className="disabled:opacity-20 hover:text-foreground" title="Subir" aria-label="Subir"><ChevronUp className="h-3.5 w-3.5" /></button>
      <span {...alcaProps} className="cursor-grab touch-none rounded p-0.5 hover:bg-muted active:cursor-grabbing" title="Clique, segure e arraste para mudar a ordem no Word" aria-label="Arrastar para reordenar">
        <GripVertical className="h-4 w-4" />
      </span>
      <button type="button" onClick={onDescer} disabled={indice === total - 1} className="disabled:opacity-20 hover:text-foreground" title="Descer" aria-label="Descer"><ChevronDown className="h-3.5 w-3.5" /></button>
    </div>
  );
}

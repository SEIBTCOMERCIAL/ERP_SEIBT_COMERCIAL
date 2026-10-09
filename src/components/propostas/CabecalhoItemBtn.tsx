"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { definirItemCabecalho } from "@/app/actions/propostas-detalhe";

/** Marca o item que dá nome à proposta (topo da proposta, cartão do funil e nome do Word). */
export function CabecalhoItemBtn({ propostaId, itemId, ativo, podeEditar }: { propostaId: string; itemId: string; ativo: boolean; podeEditar: boolean }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (!podeEditar) {
    return ativo ? <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-label="Item do cabeçalho" /> : null;
  }

  return (
    <span className="inline-flex flex-col items-center">
      <button
        type="button"
        disabled={pendente || ativo}
        onClick={() => {
          setErro(null);
          startTransition(async () => {
            const r = await definirItemCabecalho(propostaId, itemId);
            if (r.error) setErro(r.error);
            else router.refresh();
          });
        }}
        title={ativo ? "Este item dá nome à proposta" : "Usar este item como cabeçalho da proposta"}
        aria-label={ativo ? "Item do cabeçalho" : "Usar como cabeçalho"}
        className="rounded p-0.5 hover:bg-amber-50 disabled:cursor-default"
      >
        <Star className={`h-4 w-4 ${ativo ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-400"}`} />
      </button>
      {erro && <span className="mt-1 max-w-[140px] text-[10px] text-red-600">{erro}</span>}
    </span>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { excluirProposta } from "@/app/actions/propostas";

/** Exclusão de proposta: só aparece para o administrador (a regra também é conferida no servidor). */
export function ExcluirPropostaBtn({ propostaId, numero }: { propostaId: string; numero: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await excluirProposta(propostaId);
      if (r.error) { setErro(r.error); return; }
      router.push("/propostas");
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-card px-3 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50">
        <Trash2 className="h-3.5 w-3.5" />Excluir
      </button>
      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-xl">
            <h3 className="text-[15px] font-bold text-foreground">Excluir a proposta {numero}?</h3>
            <p className="mt-2 text-[13px] text-muted-foreground">
              A proposta some do funil, das listas e dos indicadores, e o número dela não será reaproveitado. Os dados ficam guardados no banco.
            </p>
            {erro && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">{erro}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setAberto(false); setErro(null); }} className="h-10 rounded-lg border border-border px-4 text-[13px] font-medium">Cancelar</button>
              <button type="button" onClick={confirmar} disabled={pendente} className="flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Excluir proposta
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { duplicarProposta } from "@/app/actions/propostas-duplicar";

/** Cria uma proposta nova (número novo) a partir desta, para o mesmo cliente, e abre a edição. */
export function DuplicarPropostaBtn({ propostaId, numero, podeComplementar }: { propostaId: string; numero: string; podeComplementar: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<"independente" | "complementar">("independente");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await duplicarProposta(propostaId, modo === "complementar");
      if (r.error || !r.id) { setErro(r.error ?? "Não foi possível duplicar."); return; }
      router.push(`/propostas/${r.id}/editar`);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium transition-colors hover:border-[#2074B9]">
        <Copy className="h-3.5 w-3.5" />Duplicar
      </button>
      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-xl">
            <h3 className="text-[15px] font-bold text-foreground">Duplicar a proposta {numero}</h3>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Cria uma proposta <strong>nova, com número novo</strong>, para o mesmo cliente, com os mesmos itens, condições e checklist. Em seguida abre a edição para você trocar o que for diferente (por exemplo, o moinho e o jogo de navalhas). Anexos e follow-ups não são copiados.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-[13px] ${modo === "independente" ? "border-[#2C4F79] bg-[#EFF6FF]" : "border-border"}`}>
                <input type="radio" name="modo" checked={modo === "independente"} onChange={() => setModo("independente")} className="mt-0.5" />
                <span><strong>Proposta independente</strong><span className="block text-[12px] text-muted-foreground">Negócio separado, com seu próprio funil e indicadores.</span></span>
              </label>
              {podeComplementar && (
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-[13px] ${modo === "complementar" ? "border-[#2C4F79] bg-[#EFF6FF]" : "border-border"}`}>
                  <input type="radio" name="modo" checked={modo === "complementar"} onChange={() => setModo("complementar")} className="mt-0.5" />
                  <span><strong>Alternativa (complementar) desta proposta</strong><span className="block text-[12px] text-muted-foreground">O cliente vai escolher uma das duas (ex.: A2 ou BSC). As duas contam no valor apresentado; no funil ativo vale só a maior; a não escolhida não conta como perda.</span></span>
                </label>
              )}
            </div>
            {erro && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">{erro}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setAberto(false); setErro(null); }} className="h-10 rounded-lg border border-border px-4 text-[13px] font-medium">Cancelar</button>
              <button type="button" onClick={confirmar} disabled={pendente} className="flex h-10 items-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-[13px] font-semibold text-white disabled:opacity-60">
                {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Duplicar e editar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

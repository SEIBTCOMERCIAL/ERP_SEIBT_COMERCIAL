"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { definirRepresentanteProposta } from "@/app/actions/propostas";

/** Quem é o representante que acompanha a proposta. Ele passa a ver a proposta no sistema. */
export function RepresentanteProposta({
  propostaId, atualId, representantes, podeEditar,
}: {
  propostaId: string;
  atualId: string | null;
  representantes: Array<{ id: string; nome: string }>;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const atual = representantes.find((r) => r.id === atualId);

  if (!podeEditar) {
    return <p className="text-[13px] font-semibold text-foreground">{atual?.nome ?? "Sem representante"}</p>;
  }

  function trocar(valor: string) {
    setErro(null);
    startTransition(async () => {
      const r = await definirRepresentanteProposta(propostaId, valor || null);
      if (r.error) setErro(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <select
          value={atualId ?? ""}
          disabled={pendente}
          onChange={(e) => trocar(e.target.value)}
          aria-label="Representante que acompanha"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-[#2074B9] disabled:opacity-60"
        >
          <option value="">Sem representante</option>
          {representantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        {pendente && <Loader2 className="absolute right-8 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-[11px] text-muted-foreground">O representante escolhido passa a ver esta proposta e pode registrar follow-ups e anexos.</p>
      {erro && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">{erro}</p>}
    </div>
  );
}

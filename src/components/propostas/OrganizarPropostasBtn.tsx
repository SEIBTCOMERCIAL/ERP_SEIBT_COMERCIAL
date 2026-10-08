"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { atribuirEtapasPendentes } from "@/app/actions/propostas";

/** Administrador: dá uma etapa definitiva às propostas antigas que estão sem etapa. */
export function OrganizarPropostasBtn({ quantidade }: { quantidade: number }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function organizar() {
    setMensagem(null);
    startTransition(async () => {
      const r = await atribuirEtapasPendentes();
      setMensagem(r.error ?? `${r.atribuidas ?? 0} propostas organizadas.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-900 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {quantidade} {quantidade === 1 ? "proposta antiga está" : "propostas antigas estão"} sem etapa e foram posicionadas automaticamente pelo status. Organize para gravar a etapa definitiva.
        {mensagem && <strong className="ml-1">{mensagem}</strong>}
      </span>
      <button type="button" onClick={organizar} disabled={pendente} className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-semibold text-white disabled:opacity-60">
        {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        Organizar propostas antigas
      </button>
    </div>
  );
}

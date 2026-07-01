"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Plus, Loader2 } from "lucide-react";
import { adicionarItem, type PropostaFormState } from "@/app/actions/propostas";
import { Input } from "@/components/ui/input";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#2C4F79] text-white text-[12px] font-medium hover:bg-[#1E3A5F] disabled:opacity-50 transition-colors"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      Adicionar
    </button>
  );
}

export function AdicionarItemForm({ propostaId }: { propostaId: string }) {
  const [state, action] = useFormState<PropostaFormState, FormData>(adicionarItem, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="proposta_id" value={propostaId} />
      {state.message && (
        <p className="text-[12px] text-red-600">{state.message}</p>
      )}
      <div className="grid grid-cols-[1fr_80px_100px_80px] gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Descrição *</label>
          <Input name="descricao" placeholder="Ex: Moinho de martelos MH-40" className="h-8 text-[12px]" required />
          {state.errors?.descricao && <p className="text-[10px] text-red-600">{state.errors.descricao[0]}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Qtd.</label>
          <Input name="quantidade" type="number" min="1" defaultValue="1" className="h-8 text-[12px]" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Preço unit.</label>
          <Input name="preco_unitario" type="number" step="0.01" min="0" placeholder="0,00" className="h-8 text-[12px]" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground">IPI %</label>
          <Input name="ipi_pct" type="number" step="0.01" min="0" defaultValue="0" className="h-8 text-[12px]" />
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitBtn />
      </div>
    </form>
  );
}

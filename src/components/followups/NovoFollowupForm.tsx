"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { criarFollowup, type FollowupFormState } from "@/app/actions/followups";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#2C4F79] text-white text-[12px] font-medium hover:bg-[#1E3A5F] disabled:opacity-50 transition-colors"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      Registrar
    </button>
  );
}

const today = new Date().toISOString().split("T")[0];

export function NovoFollowupForm({ propostaId }: { propostaId: string }) {
  const [state, action] = useFormState<FollowupFormState, FormData>(criarFollowup, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="proposta_id" value={propostaId} />

      {state.message && (
        <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.message}
        </p>
      )}

      {/* Linha 1: canal + data + motivo */}
      <div className="grid grid-cols-[140px_140px_1fr] gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Canal *</label>
          <select
            name="canal"
            required
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-[12px] text-foreground outline-none"
          >
            <option value="">Selecionar...</option>
            {[
              ["whatsapp", "WhatsApp"],
              ["telefone", "Telefone"],
              ["email", "E-mail"],
              ["visita", "Visita"],
              ["video", "Vídeo"],
              ["sms", "SMS"],
              ["outro", "Outro"],
            ].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Data do contato *</label>
          <Input name="data_contato" type="date" defaultValue={today} required className="h-8 text-[12px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Motivo</label>
          <Input name="motivo" placeholder="Ex: Seguimento após envio da proposta" className="h-8 text-[12px]" />
        </div>
      </div>

      {/* Linha 2: descrição */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-muted-foreground">Notas do contato</label>
        <textarea
          name="descricao"
          rows={2}
          placeholder="Resumo do que foi conversado..."
          className="rounded-lg border border-input bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground outline-none resize-none"
        />
      </div>

      {/* Linha 3: temperatura */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-muted-foreground shrink-0">Temperatura:</span>
        <div className="flex gap-2">
          {[
            { value: "quente", label: "Quente", dot: "bg-[#DC2626]", cls: "border-red-200 peer-checked:bg-red-50 peer-checked:border-red-400 peer-checked:text-red-700" },
            { value: "morna",  label: "Morna",  dot: "bg-[#D97706]", cls: "border-amber-200 peer-checked:bg-amber-50 peer-checked:border-amber-400 peer-checked:text-amber-700" },
            { value: "fria",   label: "Fria",   dot: "bg-[#2074B9]", cls: "border-blue-200 peer-checked:bg-blue-50 peer-checked:border-blue-400 peer-checked:text-blue-700" },
          ].map(({ value, label, dot, cls }) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="temperatura" value={value} className="sr-only peer" />
              <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all text-muted-foreground", cls)}>
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Linha 4: próxima ação */}
      <div className="bg-muted/30 rounded-lg border border-border p-3 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">Próxima ação (opcional)</p>
        <div className="grid grid-cols-[140px_160px_1fr] gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground">Data</label>
            <Input name="proxima_acao_data" type="date" className="h-7 text-[12px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground">Tipo</label>
            <select name="proxima_acao_tipo" className="h-7 rounded-lg border border-input bg-background px-2 text-[12px] text-foreground outline-none">
              <option value="">Selecionar...</option>
              {[
                "Ligar", "Enviar e-mail", "Enviar proposta revisada",
                "Visitar cliente", "Apresentar proposta",
                "Aguardar retorno", "Outro",
              ].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground">Notas</label>
            <Input name="proxima_acao_notas" placeholder="O que fazer..." className="h-7 text-[12px]" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitBtn />
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { atualizarOrganizacaoProposta, type OrganizacaoPropostaState } from "@/app/actions/propostas";

type PropostaPrincipalOption = { id: string; numero_completo: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="h-8 rounded-lg bg-[#2C4F79] px-3 text-[12px] font-semibold text-white disabled:opacity-50">{pending ? "Salvando..." : "Salvar organização"}</button>;
}

export function OrganizacaoPropostaForm({
  propostaId,
  mercadoAtual,
  paisDestinoAtual,
  papelAtual,
  propostaPrincipalAtualId,
  propostasPrincipais,
}: {
  propostaId: string;
  mercadoAtual: "nacional" | "exportacao";
  paisDestinoAtual: string | null;
  papelAtual: "principal" | "complementar";
  propostaPrincipalAtualId: string | null;
  propostasPrincipais: PropostaPrincipalOption[];
}) {
  const [state, action] = useFormState<OrganizacaoPropostaState, FormData>(atualizarOrganizacaoProposta, {});
  const [mercado, setMercado] = useState(mercadoAtual);
  const [papel, setPapel] = useState(papelAtual);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="proposta_id" value={propostaId} />
      {state.success && <p className="rounded-lg border border-green-200 bg-green-50 p-2 text-[11px] font-medium text-green-700">Organização atualizada.</p>}
      {state.message && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">{state.message}</p>}
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Mercado
        <select name="mercado" value={mercado} onChange={(event) => setMercado(event.target.value as "nacional" | "exportacao")} className="h-8 rounded-lg border border-border bg-background px-2 text-[12px] font-normal normal-case tracking-normal text-foreground">
          <option value="nacional">Nacional</option><option value="exportacao">Exportação</option>
        </select>
      </label>
      {mercado === "exportacao" && <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">País de destino<input name="pais_destino" defaultValue={paisDestinoAtual ?? ""} required className="h-8 rounded-lg border border-border bg-background px-2 text-[12px] font-normal normal-case tracking-normal text-foreground" /></label>}
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Classificação
        <select name="papel" value={papel} onChange={(event) => setPapel(event.target.value as "principal" | "complementar")} className="h-8 rounded-lg border border-border bg-background px-2 text-[12px] font-normal normal-case tracking-normal text-foreground">
          <option value="principal">Principal</option><option value="complementar">Complementar</option>
        </select>
      </label>
      {papel === "complementar" && <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Proposta principal
        <select name="proposta_principal_id" defaultValue={propostaPrincipalAtualId ?? ""} required className="h-8 rounded-lg border border-border bg-background px-2 text-[12px] font-normal normal-case tracking-normal text-foreground">
          <option value="">Selecione...</option>{propostasPrincipais.map((proposta) => <option key={proposta.id} value={proposta.id}>{proposta.numero_completo}</option>)}
        </select>
      </label>}
      <div className="flex justify-end"><SubmitButton /></div>
    </form>
  );
}

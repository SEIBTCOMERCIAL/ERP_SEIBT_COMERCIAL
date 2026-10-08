"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { adicionarObservacaoNegociacao, salvarObservacoesTecnicas } from "@/app/actions/propostas-detalhe";

/** Texto livre do Checklist Técnico: observações, informações adicionais e ressalvas. */
export function ObservacoesTecnicas({ propostaId, inicial }: { propostaId: string; inicial: string | null }) {
  const router = useRouter();
  const [texto, setTexto] = useState(inicial ?? "");
  const [salvo, setSalvo] = useState(inicial ?? "");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, startTransition] = useTransition();
  const alterado = texto.trim() !== salvo.trim();

  function salvar() {
    setMensagem(null);
    startTransition(async () => {
      const r = await salvarObservacoesTecnicas(propostaId, texto);
      if (r.error) setMensagem({ tipo: "erro", texto: r.error });
      else { setSalvo(texto.trim()); setMensagem({ tipo: "ok", texto: "Observações salvas." }); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="obs-tecnicas" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Observações, informações adicionais e ressalvas</label>
      <textarea
        id="obs-tecnicas"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setMensagem(null); }}
        rows={4}
        maxLength={5000}
        placeholder="Ex.: material com umidade variável; cliente pediu ajuste de granulometria depois do teste..."
        className="rounded-lg border border-border bg-background p-3 text-[13px] text-foreground outline-none focus:border-[#2074B9]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-[12px] ${mensagem?.tipo === "erro" ? "text-red-700" : "text-green-700"}`}>{mensagem?.texto}</span>
        <button type="button" onClick={salvar} disabled={!alterado || pendente} className="flex h-9 items-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-semibold text-white disabled:opacity-50">
          {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Salvar observações
        </button>
      </div>
    </div>
  );
}

/** Anotação livre no histórico da negociação. */
export function NovaObservacaoNegociacao({ propostaId }: { propostaId: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function adicionar() {
    setErro(null);
    startTransition(async () => {
      const r = await adicionarObservacaoNegociacao(propostaId, texto);
      if (r.error) setErro(r.error);
      else { setTexto(""); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={2000} placeholder="Registrar uma observação na negociação..." className="flex-1 rounded-lg border border-border bg-background p-2.5 text-[13px] text-foreground outline-none focus:border-[#2074B9]" />
      <button type="button" onClick={adicionar} disabled={!texto.trim() || pendente} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-semibold text-white disabled:opacity-50">
        {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Adicionar
      </button>
      {erro && <p className="text-[12px] text-red-700 sm:basis-full">{erro}</p>}
    </div>
  );
}

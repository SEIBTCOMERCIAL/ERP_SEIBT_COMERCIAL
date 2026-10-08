"use client";

import { useState, useTransition } from "react";
import { MOTIVOS_ENCERRAMENTO, STATUS_ENCERRADOS, STATUS_LABELS } from "@/lib/propostas/crm";
import { useRouter } from "next/navigation";
import {
  ChevronDown, UserCheck, Loader2,
} from "lucide-react";
import {
  atualizarStatusProposta,
  atualizarEtapaProposta,
  transferirResponsavel,
} from "@/app/actions/propostas";

const STATUS_TRANSITIONS: Record<string, Array<{ value: string; label: string }>> = {
  rascunho:                [{ value: "elaboracao", label: "Iniciar elaboração" }, { value: "enviada", label: "Marcar como enviada" }],
  elaboracao:              [{ value: "aguardando_precificacao", label: "Aguardando precificação" }, { value: "enviada", label: "Marcar como enviada" }],
  aguardando_precificacao: [{ value: "elaboracao", label: "Voltar para elaboração" }, { value: "enviada", label: "Marcar como enviada" }],
  enviada:                 [{ value: "em_negociacao", label: "Em negociação" }, { value: "vendida", label: "Marcar como vendida" }, { value: "perdida", label: "Marcar como perdida" }, { value: "desistencia", label: "Registrar desistência" }, { value: "cancelada", label: "Cancelar proposta" }],
  em_negociacao:           [{ value: "vendida", label: "Marcar como vendida" }, { value: "perdida", label: "Marcar como perdida" }, { value: "stand_by", label: "Congelar proposta" }, { value: "desistencia", label: "Registrar desistência" }, { value: "cancelada", label: "Cancelar proposta" }],
  stand_by:                [{ value: "em_negociacao", label: "Retomar negociação" }, { value: "perdida", label: "Marcar como perdida" }, { value: "cancelada", label: "Cancelar proposta" }],
  vendida:                 [],
  perdida:                 [{ value: "rascunho", label: "Reabrir como rascunho" }],
  desistencia:             [{ value: "rascunho", label: "Reabrir como rascunho" }],
  cancelada:               [{ value: "rascunho", label: "Reabrir como rascunho" }],
  complementar_nao_selecionada: [{ value: "rascunho", label: "Reabrir como rascunho" }],
};

interface EtapaOption { id: string; nome: string; cor: string }
interface VendedorOption { id: string; nome: string }

export function StatusDropdown({
  propostaId, statusAtual, temAlternativas = false,
}: { propostaId: string; statusAtual: string; temAlternativas?: boolean }) {
  const [open, setOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<string | null>(null);
  const [motivoCodigo, setMotivoCodigo] = useState("");
  const [motivoDetalhes, setMotivoDetalhes] = useState("");
  const [motivoCongelamento, setMotivoCongelamento] = useState("");
  const [retomadaPrevista, setRetomadaPrevista] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const opts = [
    ...(STATUS_TRANSITIONS[statusAtual] ?? []),
    // Alternativa do mesmo negócio que o cliente não escolheu: não conta como perda.
    ...(temAlternativas && !STATUS_ENCERRADOS.has(statusAtual)
      ? [{ value: "complementar_nao_selecionada", label: "Alternativa não selecionada pelo cliente" }]
      : []),
  ];
  if (!opts.length) return null;

  function mudar(novoStatus: string, detalhes?: { motivoCodigo?: string; motivoDetalhes?: string; motivoCongelamento?: string; retomadaPrevista?: string }) {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await atualizarStatusProposta(propostaId, novoStatus, detalhes);
      if (result?.error) setError(result.error);
      else {
        setModalStatus(null);
        router.refresh();
      }
    });
  }

  function selecionarStatus(novoStatus: string) {
    setOpen(false);
    if (["perdida", "desistencia", "cancelada", "stand_by"].includes(novoStatus)) {
      setModalStatus(novoStatus);
      setError(null);
      return;
    }
    mudar(novoStatus);
  }

  function confirmarModal() {
    if (!modalStatus) return;
    mudar(modalStatus, { motivoCodigo, motivoDetalhes, motivoCongelamento, retomadaPrevista });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-[12px] font-medium text-foreground hover:border-[#2074B9] transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Alterar status
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 min-w-[180px] bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {opts.map((o) => (
              <button
                key={o.value}
                onClick={() => selecionarStatus(o.value)}
                className="w-full text-left px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="absolute right-0 top-10 z-30 w-72 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 shadow">{error}</p>}
      {modalStatus && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-[15px] font-bold text-foreground">{modalStatus === "stand_by" ? "Congelar proposta" : `Encerrar como ${STATUS_LABELS[modalStatus]?.toLowerCase() ?? modalStatus}`}</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">{modalStatus === "stand_by" ? "Registre o motivo e quando a negociação deve ser retomada." : "Registre o motivo e uma breve explicação."}</p>
            {modalStatus === "stand_by" ? (
              <div className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Motivo *<textarea value={motivoCongelamento} onChange={(event) => setMotivoCongelamento(event.target.value)} rows={3} className="rounded-lg border border-border bg-background p-2 text-[13px] font-normal text-foreground" /></label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Previsão de retomada *<input type="date" value={retomadaPrevista} onChange={(event) => setRetomadaPrevista(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] font-normal text-foreground" /></label>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Motivo *<select value={motivoCodigo} onChange={(event) => setMotivoCodigo(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] font-normal text-foreground"><option value="">Selecione...</option>{MOTIVOS_ENCERRAMENTO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Explicação *<textarea value={motivoDetalhes} onChange={(event) => setMotivoDetalhes(event.target.value)} rows={3} className="rounded-lg border border-border bg-background p-2 text-[13px] font-normal text-foreground" /></label>
              </div>
            )}
            {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setModalStatus(null); setError(null); }} className="h-9 rounded-lg border border-border px-4 text-[12px] font-medium">Cancelar</button><button type="button" onClick={confirmarModal} disabled={isPending} className="h-9 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{isPending ? "Salvando..." : "Confirmar"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EtapaDropdown({
  propostaId, etapaAtualId, etapas,
}: { propostaId: string; etapaAtualId: string | null; etapas: EtapaOption[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const etapaAtual = etapas.find((e) => e.id === etapaAtualId);

  function mover(etapaId: string | null) {
    setOpen(false);
    startTransition(async () => {
      await atualizarEtapaProposta(propostaId, etapaId);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="w-full flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-background text-[12px] text-foreground hover:border-[#2074B9] transition-colors text-left disabled:opacity-50"
      >
        {etapaAtual ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: etapaAtual.cor }} />
            <span className="flex-1 truncate">{etapaAtual.nome}</span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">Sem etapa</span>
        )}
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-50 w-full min-w-[180px] bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            <button onClick={() => mover(null)} className="w-full text-left px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted transition-colors">
              Sem etapa
            </button>
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => mover(e.id)}
                className="w-full text-left px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.cor }} />
                {e.nome}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TransferirDropdown({
  propostaId, responsavelAtualId, vendedores,
}: { propostaId: string; responsavelAtualId: string; vendedores: VendedorOption[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function transferir(novoId: string) {
    setOpen(false);
    startTransition(async () => {
      await transferirResponsavel(propostaId, novoId);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[12px] text-[#2074B9] hover:underline disabled:opacity-50"
        disabled={isPending}
      >
        <UserCheck className="h-3 w-3" />
        Transferir
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 min-w-[180px] bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {vendedores
              .filter((v) => v.id !== responsavelAtualId)
              .map((v) => (
                <button
                  key={v.id}
                  onClick={() => transferir(v.id)}
                  className="w-full text-left px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors"
                >
                  {v.nome}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

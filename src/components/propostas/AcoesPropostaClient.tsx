"use client";

import { useState, useTransition } from "react";
import { STATUS_ENCERRADOS, STATUS_LABELS, categoriaMotivoDoStatus, type MotivoOpcao } from "@/lib/propostas/crm";
import { useMoverEtapa, type MotivosParaMover } from "./MoverEtapa";
import type { EtapaFunil } from "@/lib/propostas/funil";
import { useRouter } from "next/navigation";
import {
  ChevronDown, UserCheck, Loader2,
} from "lucide-react";
import {
  atualizarStatusProposta,
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

export interface MotivosPorCategoria {
  perda: MotivoOpcao[];
  congelamento: MotivoOpcao[];
  complementar: MotivoOpcao[];
}

interface VendedorOption { id: string; nome: string }

export function StatusDropdown({
  propostaId, statusAtual, temAlternativas = false, motivos,
}: { propostaId: string; statusAtual: string; temAlternativas?: boolean; motivos: MotivosPorCategoria }) {
  const [open, setOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<string | null>(null);
  const [motivoCodigo, setMotivoCodigo] = useState("");
  const [motivoDetalhes, setMotivoDetalhes] = useState("");
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

  const categoria = modalStatus ? categoriaMotivoDoStatus(modalStatus) : null;
  const listaMotivos = categoria ? motivos[categoria] : [];

  function fecharModal() {
    setModalStatus(null); setError(null); setMotivoCodigo(""); setMotivoDetalhes(""); setRetomadaPrevista("");
  }

  function mudar(novoStatus: string, detalhes?: { motivoCodigo?: string; motivoDetalhes?: string; retomadaPrevista?: string }) {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await atualizarStatusProposta(propostaId, novoStatus, detalhes);
      if (result?.error) setError(result.error);
      else {
        fecharModal();
        router.refresh();
      }
    });
  }

  function selecionarStatus(novoStatus: string) {
    setOpen(false);
    if (categoriaMotivoDoStatus(novoStatus)) {
      setModalStatus(novoStatus);
      setError(null);
      return;
    }
    mudar(novoStatus);
  }

  function confirmarModal() {
    if (!modalStatus) return;
    mudar(modalStatus, { motivoCodigo, motivoDetalhes, retomadaPrevista: retomadaPrevista || undefined });
  }

  const titulo = modalStatus === "stand_by" ? "Congelar proposta"
    : modalStatus === "complementar_nao_selecionada" ? "Alternativa não selecionada pelo cliente"
    : `Encerrar como ${STATUS_LABELS[modalStatus ?? ""]?.toLowerCase() ?? modalStatus}`;
  const ajuda = modalStatus === "stand_by" ? "Registre o motivo e quando a negociação deve ser retomada."
    : modalStatus === "complementar_nao_selecionada" ? "A proposta continua no histórico e não conta como perda."
    : "Registre o motivo e uma breve explicação.";
  const pronto = Boolean(motivoCodigo && motivoDetalhes.trim() && (modalStatus !== "stand_by" || retomadaPrevista));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[#2074B9] disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Alterar status
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 min-w-[220px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {opts.map((o) => (
              <button
                key={o.value}
                onClick={() => selecionarStatus(o.value)}
                className="w-full px-3 py-2.5 text-left text-[12px] text-foreground transition-colors hover:bg-muted"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
      {error && !modalStatus && <p className="absolute right-0 top-11 z-30 w-72 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 shadow">{error}</p>}
      {modalStatus && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-xl">
            <h3 className="text-[15px] font-bold text-foreground">{titulo}</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">{ajuda}</p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Motivo *
                <select value={motivoCodigo} onChange={(e) => setMotivoCodigo(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] font-normal text-foreground">
                  <option value="">Selecione...</option>
                  {listaMotivos.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Observação *
                <textarea value={motivoDetalhes} onChange={(e) => setMotivoDetalhes(e.target.value)} rows={3} className="rounded-lg border border-border bg-background p-2 text-[13px] font-normal text-foreground" />
              </label>
              {modalStatus === "stand_by" && (
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Data prevista de retomada *
                  <input type="date" value={retomadaPrevista} onChange={(e) => setRetomadaPrevista(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] font-normal text-foreground" />
                </label>
              )}
            </div>
            {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={fecharModal} className="h-10 rounded-lg border border-border px-4 text-[12px] font-medium">Cancelar</button>
              <button type="button" onClick={confirmarModal} disabled={isPending || !pronto} className="h-10 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{isPending ? "Salvando..." : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EtapaDropdown({
  propostaId, numero, etapaAtualId, etapas, temProximaAcao, motivos, encerrada,
}: {
  propostaId: string; numero: string; etapaAtualId: string | null; etapas: EtapaFunil[];
  temProximaAcao: boolean; motivos: MotivosParaMover; encerrada: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { mover, pendente, erro, dialog } = useMoverEtapa(motivos);
  const etapaAtual = etapas.find((e) => e.id === etapaAtualId);

  function escolher(etapa: EtapaFunil) {
    setOpen(false);
    mover({ id: propostaId, numero, temProximaAcao }, etapa);
  }

  if (!etapas.length) return <p className="text-[12px] text-muted-foreground">Funil ainda não configurado.</p>;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pendente || encerrada}
        title={encerrada ? "Proposta encerrada: reabra pelo menu de status para mover de etapa." : undefined}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-left text-[12px] text-foreground transition-colors hover:border-[#2074B9] disabled:opacity-60"
      >
        {etapaAtual ? (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: etapaAtual.cor }} />
            <span className="flex-1 truncate">{etapaAtual.nome}</span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">{encerrada ? "Etapa final" : "Escolher etapa"}</span>
        )}
        {pendente ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {erro && !dialog && <p className="mt-1 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">{erro}</p>}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 w-full min-w-[200px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => escolher(e)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] text-foreground transition-colors hover:bg-muted"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.cor }} />
                {e.nome}
              </button>
            ))}
          </div>
        </>
      )}
      {dialog}
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

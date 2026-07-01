"use client";

import { useState, useTransition } from "react";
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
  enviada:                 [{ value: "em_negociacao", label: "Em negociação" }, { value: "vendida", label: "Marcar como vendida" }, { value: "perdida", label: "Marcar como perdida" }],
  em_negociacao:           [{ value: "vendida", label: "Marcar como vendida" }, { value: "perdida", label: "Marcar como perdida" }, { value: "stand_by", label: "Colocar em stand-by" }],
  stand_by:                [{ value: "em_negociacao", label: "Retomar negociação" }, { value: "perdida", label: "Marcar como perdida" }],
  vendida:                 [],
  perdida:                 [{ value: "rascunho", label: "Reabrir como rascunho" }],
  desistencia:             [{ value: "rascunho", label: "Reabrir como rascunho" }],
};

interface EtapaOption { id: string; nome: string; cor: string }
interface VendedorOption { id: string; nome: string }

export function StatusDropdown({
  propostaId, statusAtual,
}: { propostaId: string; statusAtual: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const opts = STATUS_TRANSITIONS[statusAtual] ?? [];
  if (!opts.length) return null;

  function mudar(novoStatus: string) {
    setOpen(false);
    startTransition(async () => {
      await atualizarStatusProposta(propostaId, novoStatus);
      router.refresh();
    });
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
                onClick={() => mudar(o.value)}
                className="w-full text-left px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
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

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Snowflake } from "lucide-react";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { PropostaStatusBadge, PropostaTipoBadge, TemperaturaBadge } from "./StatusBadge";
import { useMoverEtapa, type MotivosParaMover } from "./MoverEtapa";
import type { EtapaFunil } from "@/lib/propostas/funil";

export interface KanbanCard {
  id: string;
  numero_completo: string;
  tipo: string;
  status: string;
  temperatura: string | null;
  cliente_nome: string | null;
  produto: string | null;
  mercado: "nacional" | "exportacao";
  pais_destino: string | null;
  moeda: string;
  valor_total: number | null;
  responsavel_nome: string | null;
  /** Última movimentação (ISO). */
  ultima_movimentacao: string;
  proxima_acao: string | null;
  proxima_acao_data: string | null;
  retomada_prevista: string | null;
  papel: "principal" | "complementar";
  /** Número da principal, quando esta é complementar. */
  complementar_de: string | null;
  /** false: outra alternativa do mesmo negócio já soma no total (o funil não duplica o negócio). */
  soma_no_funil: boolean;
  temProximaAcao: boolean;
  dias_parada: number;
  dias_validade: number | null;
  atrasado: boolean;
  parado: boolean;
  vencendo: boolean;
  semAcao: boolean;
  /** Proposta sem etapa gravada: posicionada automaticamente na coluna. */
  automatica: boolean;
  /** Encerrada: fica na coluna final e não se move no quadro. */
  bloqueada: boolean;
}

export interface KanbanColuna {
  id: string;
  nome: string;
  cor: string;
  /** Coluna de etapa real (aceita soltar cards). Colunas virtuais não aceitam. */
  etapa: EtapaFunil | null;
  cards: KanbanCard[];
}

function somar(cards: KanbanCard[], moeda: "BRL" | "USD") {
  return cards.reduce((s, c) => s + ((c.moeda === "USD") === (moeda === "USD") && c.soma_no_funil ? c.valor_total ?? 0 : 0), 0);
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${className}`}>{children}</span>;
}

function Card({
  card, etapaAtualId, etapas, onMover, arrastando, aoArrastar,
}: {
  card: KanbanCard;
  etapaAtualId: string | null;
  etapas: EtapaFunil[];
  onMover: (card: KanbanCard, etapa: EtapaFunil) => void;
  arrastando: boolean;
  aoArrastar: (id: string | null) => void;
}) {
  const router = useRouter();
  const congelada = card.status === "stand_by";
  const ganha = card.status === "vendida";
  const perdida = ["perdida", "desistencia", "cancelada"].includes(card.status);
  const naoSelecionada = card.status === "complementar_nao_selecionada";
  const borda =
    ganha ? "border-l-green-500" : perdida ? "border-l-red-300" : naoSelecionada ? "border-l-purple-400" :
    congelada ? "border-l-cyan-500" : card.atrasado ? "border-l-red-500" : card.parado ? "border-l-orange-400" :
    card.status === "em_negociacao" ? "border-l-amber-400" : "border-l-transparent";
  const fundo = congelada ? "bg-cyan-50/60" : perdida || naoSelecionada ? "bg-muted/50" : "bg-card";
  const moeda = card.moeda === "USD" ? "USD" : "BRL";

  return (
    <div
      draggable={!card.bloqueada}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", card.id); e.dataTransfer.effectAllowed = "move"; aoArrastar(card.id); }}
      onDragEnd={() => aoArrastar(null)}
      onClick={(e) => {
        // O cartão inteiro abre a proposta; links e o seletor "Mover…" mantêm a função própria.
        if ((e.target as HTMLElement).closest("a, select, option, button")) return;
        router.push(`/propostas/${card.id}`);
      }}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) router.push(`/propostas/${card.id}`);
      }}
      className={`rounded-xl border border-l-4 border-border ${borda} ${fundo} p-3 transition-shadow hover:shadow-md ${arrastando ? "opacity-40" : ""} cursor-pointer`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/propostas/${card.id}`} className="font-mono text-[12px] font-bold text-[#2074B9] hover:underline">{card.numero_completo}</Link>
        <TemperaturaBadge temperatura={card.temperatura} />
      </div>
      <p className="mt-1 truncate text-[13px] font-semibold text-foreground">{card.cliente_nome ?? "Sem cliente"}</p>
      {card.produto && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{card.produto}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PropostaTipoBadge tipo={card.tipo} />
        <Chip className={card.papel === "complementar" ? "border-purple-200 bg-purple-50 text-purple-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
          {card.papel === "complementar" ? "Complementar" : "Principal"}
        </Chip>
        {card.mercado === "exportacao" && <Chip className="border-slate-200 bg-slate-50 text-slate-600">Exportação{card.pais_destino ? ` · ${card.pais_destino}` : ""}</Chip>}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[13px] font-bold text-foreground">{card.valor_total ? formatCurrency(card.valor_total, moeda) : "—"}</span>
        <PropostaStatusBadge status={card.status} />
      </div>

      {card.complementar_de && (
        <p className="mt-1.5 text-[10px] font-semibold text-purple-700">
          Alternativa de {card.complementar_de}{card.soma_no_funil ? "" : " · não soma no total"}
        </p>
      )}
      {!card.complementar_de && !card.soma_no_funil && !card.bloqueada && (
        <p className="mt-1.5 text-[10px] font-semibold text-purple-700">Há alternativa maior · não soma no total</p>
      )}
      {naoSelecionada && <p className="mt-1.5 text-[10px] font-semibold text-purple-700">Não selecionada pelo cliente — não conta como perda</p>}

      {(card.atrasado || card.semAcao || card.parado || card.vencendo || congelada) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.atrasado && <Chip className="border-red-200 bg-red-50 text-red-700">Follow-up atrasado</Chip>}
          {card.semAcao && <Chip className="border-amber-200 bg-amber-50 text-amber-700">Sem próxima ação</Chip>}
          {card.parado && <Chip className="border-orange-200 bg-orange-50 text-orange-700">Parada há {card.dias_parada} dias</Chip>}
          {card.vencendo && <Chip className="border-yellow-300 bg-yellow-50 text-yellow-800">Validade {card.dias_validade === 0 ? "vence hoje" : `em ${card.dias_validade} dias`}</Chip>}
          {congelada && <Chip className="border-cyan-200 bg-cyan-100 text-cyan-800"><Snowflake className="mr-1 h-3 w-3" />Congelada{card.retomada_prevista ? ` · retoma ${formatDate(card.retomada_prevista)}` : ""}</Chip>}
        </div>
      )}

      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <p>Última movimentação: {formatDate(card.ultima_movimentacao)}</p>
        {!card.bloqueada && !congelada && <p className={card.atrasado ? "font-semibold text-red-600" : ""}>Próxima ação: {card.proxima_acao ?? "não definida"}</p>}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {card.responsavel_nome ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2074B9] text-[9px] font-bold text-white">{getInitials(card.responsavel_nome).slice(0, 1)}</div>
            <span className="truncate text-[11px] text-muted-foreground">{card.responsavel_nome}</span>
          </div>
        ) : <span />}
        {!card.bloqueada && (
          <select
            aria-label={`Mover ${card.numero_completo} para outra etapa`}
            value=""
            onChange={(e) => { const etapa = etapas.find((x) => x.id === e.target.value); if (etapa) onMover(card, etapa); }}
            className="h-7 max-w-[120px] rounded-md border border-border bg-background px-1.5 text-[11px] text-muted-foreground"
          >
            <option value="">Mover…</option>
            {etapas.filter((e) => e.id !== etapaAtualId).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  colunas, etapas, motivos, podeMover,
}: {
  colunas: KanbanColuna[];
  etapas: EtapaFunil[];
  motivos: MotivosParaMover;
  /** false quando as etapas ainda não estão configuradas no banco (arquivo 024). */
  podeMover: boolean;
}) {
  const { mover, pendente, erro, limparErro, dialog } = useMoverEtapa(motivos);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const todos = colunas.flatMap((c) => c.cards);

  function moverCard(card: KanbanCard, etapa: EtapaFunil) {
    mover({ id: card.id, numero: card.numero_completo, temProximaAcao: card.temProximaAcao }, etapa);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(pendente || erro) && (
        <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12px] sm:mx-6">
          {pendente ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Movendo proposta…</span> : <span className="text-red-700">{erro}</span>}
          {erro && <button type="button" onClick={limparErro} className="text-[11px] font-semibold text-muted-foreground">Fechar</button>}
        </div>
      )}
      <div className="flex-1 overflow-x-auto overscroll-x-contain pb-4">
        <div className="flex min-h-full items-start gap-3.5 px-4 sm:px-6" style={{ minWidth: "min-content" }}>
          {colunas.map((col) => {
            const brl = somar(col.cards, "BRL");
            const usd = somar(col.cards, "USD");
            const aceita = podeMover && Boolean(col.etapa);
            return (
              <section
                key={col.id}
                aria-label={col.nome}
                onDragOver={(e) => { if (aceita && arrastandoId) { e.preventDefault(); setSobre(col.id); } }}
                onDragLeave={() => setSobre((atual) => (atual === col.id ? null : atual))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const id = e.dataTransfer.getData("text/plain");
                  const card = todos.find((c) => c.id === id);
                  if (card && col.etapa && !card.bloqueada) moverCard(card, col.etapa);
                  setArrastandoId(null);
                }}
                className="flex w-[84vw] max-w-[320px] shrink-0 snap-start flex-col sm:w-[290px]"
              >
                <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-border bg-card px-3 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.cor }} />
                  <p className="flex-1 truncate text-[12px] font-semibold text-foreground">{col.nome}</p>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{col.cards.length}</span>
                </div>
                <div className="border-x border-border bg-card px-3 pb-2 text-[11px] font-mono text-muted-foreground">
                  {formatCurrency(brl)}{usd > 0 ? ` + ${formatCurrency(usd, "USD")}` : ""}
                </div>
                <div className={`flex min-h-[160px] flex-col gap-2 rounded-b-xl border border-border p-2 transition-colors ${sobre === col.id ? "bg-blue-50 ring-2 ring-[#2074B9]/40" : "bg-muted/40"}`}>
                  {col.cards.map((card) => (
                    <Card key={card.id} card={card} etapaAtualId={col.etapa?.id ?? null} etapas={podeMover ? etapas : []} onMover={moverCard} arrastando={arrastandoId === card.id} aoArrastar={setArrastandoId} />
                  ))}
                  {!col.cards.length && <p className="py-6 text-center text-[11px] text-muted-foreground opacity-70">Nenhuma proposta</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {dialog}
    </div>
  );
}

"use client";

import { PainelLateral } from "@/components/kanban/PainelLateral";
import { COMPONENTES, componentesDoTipo } from "@/lib/reajuste/regras";
import type { ItemLista } from "@/lib/reajuste/tipos";
import { fmtBRL, fmtPct, formatarData, rotuloComponente } from "./formatar";
import { HistoricoPreco } from "./HistoricoPreco";
import { SituacaoTexto } from "./SituacaoBadge";
import { tituloDoItem } from "./TabelaItens";

export interface Cambio { taxa: number; desde: string }

/** Câmbio parado há mais de 30 dias é sinalizado como possivelmente desatualizado. */
const DIAS_CAMBIO_DESATUALIZADO = 30;

function diasDesde(iso: string, hoje: string): number {
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

/** Painel lateral (no celular, tela cheia) com tudo do item: identificação, preços vigentes, último reajuste, histórico e ações. */
export function DetalheItem({ item, hoje, cambio, aoFechar, aoReajustar, aoIpi }: {
  item: ItemLista | null; hoje: string; cambio: Cambio | null; aoFechar: () => void; aoReajustar: (item: ItemLista) => void;
  /** Só para navalhas; edição manual do IPI. */
  aoIpi?: (item: ItemLista) => void;
}) {
  const componentes = item ? componentesDoTipo(item.tipo) : [];
  const desatualizado = cambio ? diasDesde(cambio.desde, hoje) > DIAS_CAMBIO_DESATUALIZADO : false;
  const t = item ? tituloDoItem(item) : null;

  return (
    <PainelLateral aberto={item !== null} aoFechar={aoFechar} titulo={t?.principal ?? "Detalhe"} largura={540}>
      {item && (
        <div className="flex flex-col gap-5 p-4">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{item.codigo}{item.modelo ? ` · ${item.modelo}` : ""}{item.escopo_nome ? ` · ${item.escopo_nome}` : ""}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3"><SituacaoTexto situacao={item.situacao} pendentes={item.pendentes} />
              {item.solicitar_engenharia && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Solicitar com a Engenharia</span>}</div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            {componentes.map((c) => (
              <div key={c}>
                <dt className="text-xs text-muted-foreground">{COMPONENTES[c].rotulo}</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{fmtBRL(item.precos[c])}</dd>
              </div>
            ))}
            {item.tipo === "peca" && <div><dt className="text-xs text-muted-foreground">IPI</dt><dd className="text-sm font-semibold tabular-nums text-foreground">{item.ipi_pct === null ? "—" : fmtPct(item.ipi_pct, false)}</dd></div>}
            <div className="sm:col-span-3">
              <dt className="text-xs text-muted-foreground">Último reajuste</dt>
              <dd className="text-sm text-foreground">{item.ultimo ? <>{formatarData(item.ultimo.data)} · {fmtPct(item.ultimo.percentual)}{item.ultimo.componente ? ` · ${rotuloComponente(item.ultimo.componente)}` : ""}</> : "Nenhum reajuste de preço registrado"}</dd>
            </div>
          </dl>

          {item.tipo === "peca" && item.precos.peca != null && (
            <p className="text-xs text-muted-foreground">
              {cambio
                ? <>≈ US$ {(item.precos.peca / cambio.taxa).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · câmbio R$ {cambio.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} cadastrado em {formatarData(cambio.desde)}{desatualizado ? <strong className="text-amber-700 dark:text-amber-300"> — pode estar desatualizado</strong> : null}</>
                : <strong className="text-amber-700 dark:text-amber-300">Câmbio do dólar não cadastrado: conversão indisponível.</strong>}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!item.ativo} onClick={() => aoReajustar(item)} title={item.ativo ? undefined : "Item inativo: ative antes de reajustar"}
              className="h-10 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-40">Reajustar este item</button>
            {aoIpi && item.navalha && <button type="button" onClick={() => aoIpi(item)} className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">Alterar IPI</button>}
          </div>

          <div className="border-t border-border pt-4"><HistoricoPreco key={item.id} itemId={item.id} tipo={item.tipo} precos={item.precos} /></div>
        </div>
      )}
    </PainelLateral>
  );
}

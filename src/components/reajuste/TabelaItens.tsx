"use client";

import { History, Pencil } from "lucide-react";
import type { ItemLista } from "@/lib/reajuste/tipos";
import { fmtBRL, fmtPct, formatarData, rotuloComponente } from "./formatar";
import { SituacaoBadge } from "./SituacaoBadge";

export type Visao = "tabela" | "cards";

interface Props {
  itens: ItemLista[];
  aba: "maquinas" | "pecas";
  visao: Visao;
  selecao: Set<string>;
  mostrarEscopo: boolean;
  aoAlternar: (id: string, ligado: boolean) => void;
  aoAlternarPagina: (ids: string[], ligado: boolean) => void;
  aoReajustar: (item: ItemLista) => void;
  aoDetalhar: (item: ItemLista) => void;
}

const selecionavel = (i: ItemLista) => i.ativo;

function Preco({ valor, vazioTitulo }: { valor: number | null | undefined; vazioTitulo: string }) {
  if (valor === null || valor === undefined) return <span className="text-muted-foreground" title={vazioTitulo}>—</span>;
  return <span className="tabular-nums">{fmtBRL(valor)}</span>;
}

function Ultimo({ item }: { item: ItemLista }) {
  if (!item.ultimo) return <span className="text-muted-foreground">Nunca</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span>{formatarData(item.ultimo.data)}</span>
      <span className="text-xs text-muted-foreground">{fmtPct(item.ultimo.percentual)}{item.ultimo.componente ? ` · ${rotuloComponente(item.ultimo.componente)}` : ""}</span>
    </span>
  );
}

function Acoes({ item, aoReajustar, aoDetalhar, compacto = false }: { item: ItemLista; aoReajustar: Props["aoReajustar"]; aoDetalhar: Props["aoDetalhar"]; compacto?: boolean }) {
  const botao = "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";
  return (
    <span className="flex items-center justify-end gap-1">
      <button type="button" className={botao} onClick={() => aoReajustar(item)} disabled={!item.ativo} title={item.ativo ? "Reajustar este item" : "Item inativo: ative antes de reajustar"} aria-label={`Reajustar ${item.codigo}`}><Pencil className="h-3.5 w-3.5" />{!compacto && "Reajustar"}</button>
      <button type="button" className={botao} onClick={() => aoDetalhar(item)} aria-label={`Histórico de ${item.codigo}`} title="Ver histórico"><History className="h-3.5 w-3.5" />{!compacto && "Histórico"}</button>
    </span>
  );
}

export function TabelaItens(p: Props) {
  const maquinas = p.aba === "maquinas";
  const selecionaveis = p.itens.filter(selecionavel);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((i) => p.selecao.has(i.id));
  const algum = selecionaveis.some((i) => p.selecao.has(i.id));

  const marcador = (i: ItemLista) => (
    <input type="checkbox" className="h-4 w-4" checked={p.selecao.has(i.id)} disabled={!selecionavel(i)} onChange={(e) => p.aoAlternar(i.id, e.target.checked)} aria-label={`Selecionar ${i.codigo}`} />
  );

  const titulo = (i: ItemLista) => (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="truncate font-medium text-foreground" title={i.descricao}>{i.modelo ? `${i.modelo} · ` : ""}{i.descricao || i.codigo}</span>
      <span className="font-mono text-xs text-muted-foreground">{i.codigo}{i.atributos ? ` · ${i.atributos}` : ""}{p.mostrarEscopo && i.escopo_nome ? ` · ${i.escopo_nome}` : ""}{!i.ativo ? " · inativo" : ""}</span>
    </span>
  );

  const cards = (
    <ul className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${p.visao === "tabela" ? "md:hidden" : ""}`}>
      {p.itens.map((i) => (
        <li key={i.id} className={`flex flex-col gap-3 rounded-xl border bg-card p-3 ${p.selecao.has(i.id) ? "border-[#2074B9]" : "border-border"}`}>
          <div className="flex items-start gap-3">{marcador(i)}<div className="min-w-0 flex-1">{titulo(i)}</div><SituacaoBadge situacao={i.situacao} pendentes={i.pendentes} /></div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {maquinas ? (
              <>
                <div><dt className="text-xs text-muted-foreground">Máquina</dt><dd><Preco valor={i.precos.moinho} vazioTitulo="Sem preço cadastrado" /></dd></div>
                <div><dt className="text-xs text-muted-foreground">220 V</dt><dd><Preco valor={i.precos.painel_220} vazioTitulo="Sem painel 220 V cadastrado" /></dd></div>
                <div><dt className="text-xs text-muted-foreground">380 V</dt><dd><Preco valor={i.precos.painel_380} vazioTitulo="Sem painel 380 V cadastrado" /></dd></div>
              </>
            ) : (
              <>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Preço</dt><dd><Preco valor={i.precos.peca} vazioTitulo="Sem preço cadastrado" /></dd></div>
                <div><dt className="text-xs text-muted-foreground">IPI</dt><dd className="tabular-nums">{i.ipi_pct ? fmtPct(i.ipi_pct, false) : "—"}</dd></div>
              </>
            )}
          </dl>
          <div className="flex items-end justify-between gap-2 text-sm"><div><span className="block text-xs text-muted-foreground">Último reajuste</span><Ultimo item={i} /></div><Acoes item={i} aoReajustar={p.aoReajustar} aoDetalhar={p.aoDetalhar} /></div>
        </li>
      ))}
    </ul>
  );

  if (p.visao === "cards") return cards;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <input type="checkbox" className="h-4 w-4" checked={todosMarcados} ref={(el) => { if (el) el.indeterminate = algum && !todosMarcados; }}
                  onChange={(e) => p.aoAlternarPagina(selecionaveis.map((i) => i.id), e.target.checked)} aria-label="Selecionar todos desta página" />
              </th>
              <th className="px-3 py-2 font-semibold">{maquinas ? "Modelo / descrição" : "Descrição"}</th>
              {maquinas ? (
                <>
                  <th className="px-3 py-2 text-right font-semibold">Máquina</th>
                  <th className="px-3 py-2 text-right font-semibold">Painel 220 V</th>
                  <th className="px-3 py-2 text-right font-semibold">Painel 380 V</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 text-right font-semibold">Preço</th>
                  <th className="px-3 py-2 text-right font-semibold">IPI</th>
                </>
              )}
              <th className="px-3 py-2 font-semibold">Último reajuste</th>
              <th className="px-3 py-2 font-semibold">Situação</th>
              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {p.itens.map((i) => (
              <tr key={i.id} className={`border-t border-border ${p.selecao.has(i.id) ? "bg-[#2074B9]/5" : ""} ${!i.ativo ? "opacity-60" : ""}`}>
                <td className="px-3 py-2">{marcador(i)}</td>
                <td className="max-w-[22rem] px-3 py-2">{titulo(i)}</td>
                {maquinas ? (
                  <>
                    <td className="px-3 py-2 text-right"><Preco valor={i.precos.moinho} vazioTitulo="Sem preço cadastrado" /></td>
                    <td className="px-3 py-2 text-right"><Preco valor={i.precos.painel_220} vazioTitulo="Sem painel 220 V cadastrado" /></td>
                    <td className="px-3 py-2 text-right"><Preco valor={i.precos.painel_380} vazioTitulo="Sem painel 380 V cadastrado" /></td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right"><Preco valor={i.precos.peca} vazioTitulo="Sem preço cadastrado" /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i.ipi_pct ? fmtPct(i.ipi_pct, false) : "—"}</td>
                  </>
                )}
                <td className="px-3 py-2"><Ultimo item={i} /></td>
                <td className="px-3 py-2"><SituacaoBadge situacao={i.situacao} pendentes={i.pendentes} /></td>
                <td className="px-3 py-2"><Acoes compacto item={i} aoReajustar={p.aoReajustar} aoDetalhar={p.aoDetalhar} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cards}
    </>
  );
}

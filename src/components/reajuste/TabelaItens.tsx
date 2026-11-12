"use client";

import { ChevronRight } from "lucide-react";
import type { ItemLista } from "@/lib/reajuste/tipos";
import { fmtBRL, fmtPct } from "./formatar";
import { SituacaoTexto } from "./SituacaoBadge";

interface Props {
  itens: ItemLista[];
  modo: "maquinas" | "pecas";
  selecao: Set<string>;
  /** Mostra a linha/categoria quando a consulta cruza várias. */
  mostrarEscopo: boolean;
  aoAlternar: (id: string, ligado: boolean) => void;
  aoAlternarPagina: (ids: string[], ligado: boolean) => void;
  aoDetalhar: (item: ItemLista) => void;
  /** Altura limitada com cabeçalho fixo (tabela principal). Em grupos curtos fica solta. */
  cabecalhoFixo?: boolean;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Modelo em destaque, sem repetir a descrição; o código só aparece se trouxer informação diferente. */
export function tituloDoItem(i: Pick<ItemLista, "descricao" | "modelo" | "codigo">): { principal: string; codigo: string | null } {
  const d = (i.descricao ?? "").trim();
  const m = (i.modelo ?? "").trim();
  const principal = d ? (m && !semAcento(d).includes(semAcento(m)) ? `${m} · ${d}` : d) : m || i.codigo;
  return { principal, codigo: semAcento(principal).includes(semAcento(i.codigo)) ? null : i.codigo };
}

function Preco({ valor, vazio }: { valor: number | null | undefined; vazio: string }) {
  if (valor === null || valor === undefined) return <span className="text-muted-foreground" title={vazio} aria-label={vazio}>—</span>;
  return <span className="tabular-nums">{fmtBRL(valor)}</span>; // zero aparece como R$ 0,00: é diferente de "sem preço"
}

export function TabelaItens(p: Props) {
  const maquinas = p.modo === "maquinas";
  const selecionaveis = p.itens.filter((i) => i.ativo);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((i) => p.selecao.has(i.id));
  const algum = selecionaveis.some((i) => p.selecao.has(i.id));
  const cabecalho = "bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground";

  return (
    <div className={`overflow-auto rounded-xl border border-border bg-card ${p.cabecalhoFixo ? "max-h-[68vh]" : ""}`}>
      <table className="w-full min-w-[720px] text-sm" aria-label={maquinas ? "Preços das máquinas" : "Preços das peças"}>
        <thead className="sticky top-0 z-10 text-left">
          <tr>
            <th scope="col" className={`${cabecalho} w-10 pl-4`}>
              <input type="checkbox" className="h-4 w-4 accent-[#2C4F79]" checked={todosMarcados} ref={(el) => { if (el) el.indeterminate = algum && !todosMarcados; }}
                onChange={(e) => p.aoAlternarPagina(selecionaveis.map((i) => i.id), e.target.checked)} aria-label="Selecionar todos os itens exibidos nesta página" />
            </th>
            <th scope="col" className={cabecalho}>{maquinas ? "Modelo" : "Descrição"}</th>
            {maquinas ? (
              <>
                <th scope="col" className={`${cabecalho} text-right`}>Máquina</th>
                <th scope="col" className={`${cabecalho} text-right`}>Painel 220 V</th>
                <th scope="col" className={`${cabecalho} text-right`}>Painel 380 V</th>
              </>
            ) : (
              <>
                <th scope="col" className={`${cabecalho} text-right`}>Preço</th>
                <th scope="col" className={`${cabecalho} text-right`}>IPI</th>
              </>
            )}
            <th scope="col" className={cabecalho}>Situação</th>
            <th scope="col" className={`${cabecalho} w-10`}><span className="sr-only">Detalhes</span></th>
          </tr>
        </thead>
        <tbody>
          {p.itens.map((i) => {
            const t = tituloDoItem(i);
            const marcado = p.selecao.has(i.id);
            const complemento = [t.codigo, i.atributos, p.mostrarEscopo ? i.escopo_nome : null, !i.ativo ? "inativo" : null].filter(Boolean).join(" · ");
            return (
              <tr key={i.id} className={`border-t border-border/70 ${marcado ? "bg-[#edf3fa] dark:bg-[#2a3c52]" : "hover:bg-muted/40"} ${!i.ativo ? "opacity-60" : ""}`}>
                <td className="py-3.5 pl-4 pr-1">
                  <input type="checkbox" className="h-4 w-4 accent-[#2C4F79]" checked={marcado} disabled={!i.ativo} onChange={(e) => p.aoAlternar(i.id, e.target.checked)} aria-label={`Selecionar ${t.principal}`} />
                </td>
                <td className="max-w-[26rem] px-3 py-3.5">
                  <button type="button" onClick={() => p.aoDetalhar(i)} className="block max-w-full text-left">
                    <span className="block truncate font-medium text-foreground hover:underline" title={t.principal}>{t.principal}</span>
                  </button>
                  {complemento && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{complemento}</span>}
                </td>
                {maquinas ? (
                  <>
                    <td className="px-3 py-3.5 text-right"><Preco valor={i.precos.moinho} vazio="Sem preço cadastrado" /></td>
                    <td className="px-3 py-3.5 text-right"><Preco valor={i.precos.painel_220} vazio="Sem painel 220 V cadastrado" /></td>
                    <td className="px-3 py-3.5 text-right"><Preco valor={i.precos.painel_380} vazio="Sem painel 380 V cadastrado" /></td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-3.5 text-right"><Preco valor={i.precos.peca} vazio="Sem preço cadastrado" /></td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">{i.ipi_pct === null ? "—" : fmtPct(i.ipi_pct, false)}</td>
                  </>
                )}
                <td className="px-3 py-3.5"><SituacaoTexto situacao={i.situacao} pendentes={i.pendentes} /></td>
                <td className="py-3.5 pr-3">
                  <button type="button" onClick={() => p.aoDetalhar(i)} aria-label={`Ver detalhes de ${t.principal}`} title="Detalhes e histórico"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#2C4F79] hover:bg-muted dark:text-[#85acd9]"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

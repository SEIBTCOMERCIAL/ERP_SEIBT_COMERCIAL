"use client";

import { useState } from "react";
import { PainelLateral } from "@/components/kanban/PainelLateral";
import { PROBLEMA_ROTULO, totalLinhaComIpi, type AlcanceKit, type GrupoComponente } from "@/lib/reajuste/kits";
import type { ItemLista, KitLista } from "@/lib/reajuste/tipos";
import { fmtBRL, fmtPct, formatarData } from "./formatar";
import { HistoricoPreco } from "./HistoricoPreco";
import { SituacaoTexto } from "./SituacaoBadge";

const ROTULO_GRUPO: Record<GrupoComponente, string> = { fixa: "Fixa", rotora: "Rotora", outro: "Tipo indefinido" };

export const rotuloDoKit = (k: Pick<KitLista, "modelo" | "variante">) => (k.variante ? `${k.modelo} · ${k.variante}` : k.modelo);

/** Painel lateral do kit: composição, totais com IPI explicados, último reajuste e histórico por componente. */
export function DetalheKit({ kit, aoFechar, aoReajustarKit, aoIpiKit, aoReajustarPeca, aoIpiPeca }: {
  kit: KitLista | null;
  aoFechar: () => void;
  aoReajustarKit: (kit: KitLista, alcance: AlcanceKit) => void;
  aoIpiKit: (kit: KitLista) => void;
  aoReajustarPeca: (item: ItemLista) => void;
  aoIpiPeca: (item: ItemLista, titulo: string) => void;
}) {
  const [alcance, setAlcance] = useState<AlcanceKit>("ambos");
  const [aberto, setAberto] = useState<string | null>(null);
  const c = kit?.calculo;
  const cel = "px-2 py-2";

  return (
    <PainelLateral aberto={kit !== null} aoFechar={() => { setAberto(null); aoFechar(); }} titulo={kit ? rotuloDoKit(kit) : "Kit"} largura={680}>
      {kit && c && (
        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <SituacaoTexto situacao={kit.situacao} rotulo={kit.situacao === "sem_preco" ? "Preço incompleto" : undefined} />
            {!kit.ativo && <span className="text-xs text-muted-foreground">Kit inativo</span>}
            {!c.completo && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{PROBLEMA_ROTULO[c.problemas[0] ?? "sem_componentes"]}: o total não é exibido</span>}
            {c.temOutro && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Há componente sem tipo definido (fixa ou rotora)</span>}
          </div>

          <section aria-label="Composição do kit">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Composição</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr><th className={`${cel} font-medium`}>Componente</th><th className={`${cel} text-right font-medium`}>Qtd.</th><th className={`${cel} text-right font-medium`}>Unitário</th><th className={`${cel} text-right font-medium`}>Subtotal</th><th className={`${cel} text-right font-medium`}>IPI</th><th className={`${cel} text-right font-medium`}>Total c/ IPI</th><th className={`${cel} font-medium`}><span className="sr-only">Ações</span></th></tr>
                </thead>
                <tbody>
                  {kit.componentes.map((comp) => {
                    const titulo = `${comp.codigo} · ${ROTULO_GRUPO[comp.grupo]}`;
                    return (
                      <tr key={comp.linhaId} className="border-t border-border/70 align-top">
                        <td className={cel}>
                          <span className="block text-sm text-foreground">{comp.titulo}</span>
                          <span className="text-muted-foreground">{titulo}{!comp.ativo ? " · inativa" : ""}{comp.compartilhadoCom.length > 0 ? ` · também em ${comp.compartilhadoCom.length} ${comp.compartilhadoCom.length === 1 ? "kit" : "kits"}` : ""}</span>
                          <span className="mt-0.5 block text-muted-foreground">Último reajuste: {comp.item.ultimo ? `${formatarData(comp.item.ultimo.data)} (${fmtPct(comp.item.ultimo.percentual)})` : "nunca"}</span>
                        </td>
                        <td className={`${cel} text-right tabular-nums`}>{comp.pecas}</td>
                        <td className={`${cel} text-right tabular-nums`}>{comp.precoUnit === null ? <span className="text-amber-700 dark:text-amber-300">sem preço</span> : fmtBRL(comp.precoUnit)}</td>
                        <td className={`${cel} text-right tabular-nums`}>{comp.subtotal === null ? "—" : fmtBRL(comp.subtotal)}</td>
                        <td className={`${cel} text-right tabular-nums text-muted-foreground`}>{fmtPct(comp.ipi, false)}</td>
                        <td className={`${cel} text-right tabular-nums`}>{(() => { const v = totalLinhaComIpi(comp.pecas, comp.precoUnit, comp.ipi); return v === null ? "—" : fmtBRL(v); })()}</td>
                        <td className={cel}>
                          <span className="flex flex-col items-end gap-1 whitespace-nowrap">
                            <button type="button" disabled={!comp.ativo} onClick={() => aoReajustarPeca(comp.item)} className="text-[#2074B9] hover:underline disabled:opacity-40" aria-label={`Reajustar a peça ${comp.codigoProduto}`}>Reajustar peça</button>
                            <button type="button" onClick={() => aoIpiPeca(comp.item, rotuloDoKit(kit))} className="text-[#2074B9] hover:underline" aria-label={`Alterar o IPI da peça ${comp.codigoProduto}`}>IPI</button>
                            <button type="button" aria-expanded={aberto === comp.produtoId} onClick={() => setAberto(aberto === comp.produtoId ? null : comp.produtoId)} className="text-[#2074B9] hover:underline" aria-label={`Histórico da peça ${comp.codigoProduto}`}>Histórico</button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {kit.componentes.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-muted-foreground">Este kit ainda não tem componentes cadastrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {aberto && (() => {
            const comp = kit.componentes.find((x) => x.produtoId === aberto);
            return comp ? <div className="rounded-lg border border-border p-3"><HistoricoPreco key={comp.produtoId} itemId={comp.produtoId} tipo="peca" precos={comp.item.precos} titulo={`Histórico · ${comp.codigoProduto}`} /></div> : null;
          })()}

          <section aria-label="Totais do conjunto">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Totais</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Fixas (sem IPI)</dt><dd className="tabular-nums">{!c.temFixa ? "—" : c.subtotalFixas === null ? "Preço incompleto" : fmtBRL(c.subtotalFixas)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Rotoras (sem IPI)</dt><dd className="tabular-nums">{!c.temRotora ? "—" : c.subtotalRotoras === null ? "Preço incompleto" : fmtBRL(c.subtotalRotoras)}</dd></div>
              {c.temOutro && <div><dt className="text-xs text-muted-foreground">Sem tipo definido (sem IPI)</dt><dd className="tabular-nums">{c.subtotalOutros === null ? "Preço incompleto" : fmtBRL(c.subtotalOutros)}</dd></div>}
              <div><dt className="text-xs text-muted-foreground">IPI {c.aliquota === "variavel" ? "(variável por peça)" : c.aliquota !== null ? `(${fmtPct(c.aliquota, false)})` : ""}</dt><dd className="tabular-nums">{c.ipiValor === null ? "—" : fmtBRL(c.ipiValor)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Total com IPI</dt><dd className="text-base font-semibold tabular-nums">{c.total === null ? "—" : fmtBRL(c.total)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Total = soma dos subtotais mais o IPI de cada peça, arredondado por linha. Falta de preço não é tratada como zero.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Último reajuste de preço-base: {kit.ultimo ? `${formatarData(kit.ultimo.data)} (${kit.ultimo.reajustados} de ${kit.pecasUnicas} ${kit.pecasUnicas === 1 ? "peça" : "peças"} com reajuste registrado)` : "nenhum registrado"}. Alterar só o IPI não conta como reajuste.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">Reajustar
              <select value={alcance} onChange={(e) => setAlcance(e.target.value as AlcanceKit)} aria-label="Componentes a reajustar" className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                <option value="ambos">Fixas e rotoras</option><option value="fixas">Somente fixas</option><option value="rotoras">Somente rotoras</option>
              </select>
            </label>
            <button type="button" disabled={!kit.ativo} onClick={() => aoReajustarKit(kit, alcance)} className="h-10 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-40">Reajustar kit</button>
            <button type="button" onClick={() => aoIpiKit(kit)} className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">Alterar IPI do kit</button>
          </div>
        </div>
      )}
    </PainelLateral>
  );
}

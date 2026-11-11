"use client";

import { useEffect, useState } from "react";
import { carregarHistoricoReajuste } from "@/app/actions/reajuste";
import { PainelLateral } from "@/components/kanban/PainelLateral";
import { COMPONENTES, componentesDoTipo, type ComponenteId } from "@/lib/reajuste/regras";
import type { ItemLista, RespostaHistorico } from "@/lib/reajuste/tipos";
import { fmtBRL, fmtPct, formatarData } from "./formatar";
import { SituacaoBadge } from "./SituacaoBadge";

export interface Cambio { taxa: number; desde: string }

/** Câmbio parado há mais de 30 dias é sinalizado como possivelmente desatualizado. */
const DIAS_CAMBIO_DESATUALIZADO = 30;

function diasDesde(iso: string, hoje: string): number {
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

function Grafico({ serie }: { serie: Array<{ data: string; preco: number }> }) {
  if (serie.length < 2) return <p className="text-xs text-muted-foreground">O gráfico aparece a partir de dois registros.</p>;
  const W = 320, H = 90, pad = 8;
  const precos = serie.map((s) => s.preco);
  const min = Math.min(...precos), max = Math.max(...precos);
  const x = (i: number) => pad + (i / (serie.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
  const d = serie.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.preco).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução do preço">
      <path d={d} fill="none" stroke="#2074B9" strokeWidth="1.75" strokeLinejoin="round" />
      {serie.map((s, i) => <circle key={i} cx={x(i)} cy={y(s.preco)} r="2.5" fill="white" stroke="#2074B9" strokeWidth="1.5"><title>{`${formatarData(s.data)} · ${fmtBRL(s.preco)}`}</title></circle>)}
    </svg>
  );
}

export function DetalheItem({ item, hoje, cambio, aoFechar, aoReajustar }: {
  item: ItemLista | null; hoje: string; cambio: Cambio | null; aoFechar: () => void; aoReajustar: (item: ItemLista) => void;
}) {
  const componentes = item ? componentesDoTipo(item.tipo) : [];
  const [componente, setComponente] = useState<ComponenteId>("moinho");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<RespostaHistorico | null>(null);
  const [carregando, setCarregando] = useState(false);

  const itemId = item?.id;
  useEffect(() => { if (item) { setComponente(item.tipo === "maquina" ? "moinho" : "peca"); setPagina(1); } }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Histórico carregado só quando o detalhe abre (e a cada troca de componente/página).
  useEffect(() => {
    if (!itemId) return;
    let cancelado = false;
    setCarregando(true);
    carregarHistoricoReajuste(itemId, componente, pagina).then((r) => { if (!cancelado) { setDados(r); setCarregando(false); } })
      .catch(() => { if (!cancelado) { setDados({ ok: false, erro: "Não foi possível carregar o histórico." }); setCarregando(false); } });
    return () => { cancelado = true; };
  }, [itemId, componente, pagina]);

  const precoAtual = item?.precos[componente] ?? null;
  const totalPaginas = dados?.ok ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;
  const desatualizado = cambio ? diasDesde(cambio.desde, hoje) > DIAS_CAMBIO_DESATUALIZADO : false;

  return (
    <PainelLateral aberto={item !== null} aoFechar={aoFechar} titulo={item?.codigo ?? "Detalhe"} largura={520}>
      {item && (
        <div className="flex flex-col gap-5 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{item.descricao}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.codigo}{item.modelo ? ` · ${item.modelo}` : ""}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2"><SituacaoBadge situacao={item.situacao} pendentes={item.pendentes} />
              {item.solicitar_engenharia && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Solicitar com a Engenharia</span>}</div>
          </div>

          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {componentes.map((c) => (
              <div key={c} className="rounded-lg border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">{COMPONENTES[c].rotulo}</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{fmtBRL(item.precos[c])}</dd>
              </div>
            ))}
          </dl>

          {item.tipo === "peca" && item.precos.peca != null && (
            <p className="text-xs text-muted-foreground">
              {cambio
                ? <>≈ US$ {(item.precos.peca / cambio.taxa).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · câmbio R$ {cambio.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} cadastrado em {formatarData(cambio.desde)}{desatualizado ? <strong className="text-amber-700 dark:text-amber-300"> — pode estar desatualizado</strong> : null}</>
                : <strong className="text-amber-700 dark:text-amber-300">Câmbio do dólar não cadastrado: conversão indisponível.</strong>}
            </p>
          )}

          <button type="button" onClick={() => aoReajustar(item)} className="h-10 self-start rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white">Reajustar este item</button>

          <section aria-label="Histórico de preços" className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Histórico de preços</h3>
            {item.tipo === "maquina" && (
              <div role="tablist" className="inline-flex self-start overflow-hidden rounded-lg border border-border">
                {componentes.map((c) => (
                  <button key={c} type="button" role="tab" aria-selected={componente === c} onClick={() => { setComponente(c); setPagina(1); }}
                    className={`h-9 px-3 text-sm font-medium ${componente === c ? "bg-[#2C4F79] text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>{COMPONENTES[c].curto}</button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{COMPONENTES[componente].rotulo} · preço atual {fmtBRL(precoAtual)}</p>

            {dados?.ok && <Grafico serie={dados.serie} />}
            {carregando && <p className="text-xs text-muted-foreground">Carregando…</p>}
            {dados && !dados.ok && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{dados.erro}</p>}
            {dados?.ok && dados.linhas.length === 0 && !carregando && <p className="text-sm text-muted-foreground">Nenhum reajuste registrado para este componente.</p>}
            {dados?.ok && dados.linhas.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[460px] text-sm">
                    <thead className="bg-muted text-left text-xs text-muted-foreground">
                      <tr><th className="px-3 py-2 font-semibold">Data</th><th className="px-3 py-2 text-right font-semibold">Anterior</th><th className="px-3 py-2 text-right font-semibold">Novo</th><th className="px-3 py-2 text-right font-semibold">%</th><th className="px-3 py-2 font-semibold">Motivo / responsável</th></tr>
                    </thead>
                    <tbody>
                      {dados.linhas.map((h) => (
                        <tr key={h.id} className="border-t border-border align-top">
                          <td className="whitespace-nowrap px-3 py-2">{formatarData(h.data_reajuste)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtBRL(h.preco_anterior_brl)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtBRL(h.preco_novo_brl)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtPct(h.percentual_reajuste)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground"><span className="block text-foreground">{h.motivo ?? "—"}</span>{h.responsavel ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dados.total} {dados.total === 1 ? "registro" : "registros"} · página {dados.pagina} de {totalPaginas}</span>
                  <span className="flex gap-2">
                    <button type="button" disabled={pagina <= 1 || carregando} onClick={() => setPagina(pagina - 1)} className="h-8 rounded-lg border border-border px-3 disabled:opacity-40">Anterior</button>
                    <button type="button" disabled={pagina >= totalPaginas || carregando} onClick={() => setPagina(pagina + 1)} className="h-8 rounded-lg border border-border px-3 disabled:opacity-40">Próxima</button>
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </PainelLateral>
  );
}

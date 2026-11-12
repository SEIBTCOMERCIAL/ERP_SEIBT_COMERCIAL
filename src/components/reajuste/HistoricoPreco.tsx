"use client";

import { useEffect, useState } from "react";
import { carregarHistoricoReajuste } from "@/app/actions/reajuste";
import { COMPONENTES, componentesDoTipo, type ComponenteId, type TipoProduto } from "@/lib/reajuste/regras";
import type { ItemLista, RespostaHistorico } from "@/lib/reajuste/tipos";
import { fmtBRL, fmtPct, formatarData } from "./formatar";

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

/** Histórico de preço-base de um produto (carregado só quando o painel abre). Alterações só de IPI não aparecem aqui. */
export function HistoricoPreco({ itemId, tipo, precos, titulo = "Histórico de preços" }: {
  itemId: string; tipo: TipoProduto; precos: ItemLista["precos"]; titulo?: string;
}) {
  const componentes = componentesDoTipo(tipo);
  const [componente, setComponente] = useState<ComponenteId>(tipo === "maquina" ? "moinho" : "peca");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<RespostaHistorico | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    carregarHistoricoReajuste(itemId, componente, pagina).then((r) => { if (!cancelado) { setDados(r); setCarregando(false); } })
      .catch(() => { if (!cancelado) { setDados({ ok: false, erro: "Não foi possível carregar o histórico." }); setCarregando(false); } });
    return () => { cancelado = true; };
  }, [itemId, componente, pagina]);

  const totalPaginas = dados?.ok ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {tipo === "maquina" && (
        <div role="tablist" className="inline-flex self-start overflow-hidden rounded-lg border border-border">
          {componentes.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={componente === c} onClick={() => { setComponente(c); setPagina(1); }}
              className={`h-9 px-3 text-sm font-medium ${componente === c ? "bg-[#2C4F79] text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>{COMPONENTES[c].curto}</button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{COMPONENTES[componente].rotulo} · preço atual {fmtBRL(precos[componente] ?? null)}</p>

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
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { confirmarReajuste, preverReajuste } from "@/app/actions/reajuste";
import {
  COMPONENTES, COMPONENTES_MAQUINA, MOTIVO_MINIMO, parseMoeda, parsePercentual, validarMotivo,
  type ComponenteId, type TipoProduto,
} from "@/lib/reajuste/regras";
import type { EscopoPedido, ItemLista, RespostaConfirmacao, RespostaPrevia } from "@/lib/reajuste/tipos";
import { fmtBRL, fmtDiferenca, fmtPct, formatarData, rotuloComponente } from "./formatar";

export interface AlvoReajuste {
  escopo: EscopoPedido;
  tipo: TipoProduto;
  /** Ex.: "Linha inteira: A2", "3 itens selecionados", "CÓD. 728". */
  titulo: string;
  /** Presente quando é um item só: mostra os preços atuais e permite digitar o novo valor. */
  item?: ItemLista;
  /** Alertas da seleção (ex.: peça compartilhada com kits fora da seleção). */
  avisos?: string[];
}

type Modo = "mesmo" | "componente" | "valor";
type Passo = "config" | "previa" | "concluido";

const SUGESTOES_MOTIVO = ["Reajuste anual", "Variação cambial", "Custo de matéria-prima"];
const campo = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#2074B9]";
const rotulo = "text-xs font-semibold text-muted-foreground";

export function JanelaReajuste({ alvo, aoFechar, aoConcluir }: { alvo: AlvoReajuste; aoFechar: () => void; aoConcluir: () => void }) {
  const componentesDoTipo: ComponenteId[] = alvo.tipo === "maquina" ? COMPONENTES_MAQUINA : ["peca"];
  const unico = alvo.item !== undefined;

  const [passo, setPasso] = useState<Passo>("config");
  const [modo, setModo] = useState<Modo>("mesmo");
  const [marcados, setMarcados] = useState<ComponenteId[]>(
    unico ? componentesDoTipo.filter((c) => alvo.item?.precos[c] !== null && alvo.item?.precos[c] !== undefined) : componentesDoTipo
  );
  const [percentualUnico, setPercentualUnico] = useState("");
  const [percentuais, setPercentuais] = useState<Partial<Record<ComponenteId, string>>>({});
  const [valores, setValores] = useState<Partial<Record<ComponenteId, string>>>({});
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Extract<RespostaPrevia, { ok: true }> | null>(null);
  const [resultado, setResultado] = useState<Extract<RespostaConfirmacao, { ok: true }> | null>(null);
  const [conflito, setConflito] = useState(false);
  const [ignoradosAbertos, setIgnoradosAbertos] = useState(false);
  const [pendente, iniciar] = useTransition();
  // Identifica esta operação: repetir a confirmação (duplo clique, nova tentativa) nunca aplica duas vezes.
  const chave = useRef<string>("");

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape" && !pendente) aoFechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar, pendente]);

  const textoPercentual = (c: ComponenteId) => (modo === "mesmo" ? percentualUnico : percentuais[c] ?? "");

  const errosConfig = useMemo(() => {
    if (marcados.length === 0) return "Marque ao menos um componente.";
    for (const c of marcados) {
      if (modo === "valor") {
        const r = parseMoeda(valores[c]);
        if (r.erro !== undefined) return `${COMPONENTES[c].rotulo}: ${r.erro}`;
      } else {
        const r = parsePercentual(modo === "mesmo" ? percentualUnico : percentuais[c]);
        if (r.erro !== undefined) return `${COMPONENTES[c].rotulo}: ${r.erro}`;
      }
    }
    return null;
  }, [marcados, modo, percentualUnico, percentuais, valores]);

  const erroMotivo = validarMotivo(motivo).erro ?? null;

  function gerarPrevia() {
    setErro(null);
    setConflito(false);
    iniciar(async () => {
      try {
        const r = await preverReajuste({
          escopo: alvo.escopo,
          modo: modo === "valor" ? "valor" : "percentual",
          componentes: marcados,
          percentuais: Object.fromEntries(marcados.map((c) => [c, textoPercentual(c)])),
          valores,
        });
        if (!r.ok) { setErro(r.erro); return; }
        chave.current = crypto.randomUUID();
        setPrevia(r);
        setPasso("previa");
      } catch {
        setErro("Não foi possível gerar a prévia. Seus dados foram mantidos; tente novamente.");
      }
    });
  }

  function confirmar() {
    if (!previa || pendente) return;
    const m = validarMotivo(motivo);
    if (m.erro !== undefined) { setErro(m.erro); return; }
    setErro(null);
    iniciar(async () => {
      try {
        const r = await confirmarReajuste({ chave: chave.current, motivo: m.valor, entradas: previa.entradas });
        if (!r.ok) {
          setConflito(r.tipo === "conflito");
          setErro(r.erro);
          return;
        }
        setResultado(r);
        setPasso("concluido");
      } catch {
        setErro("Não foi possível confirmar se o reajuste foi gravado. Atualize a lista para conferir; se precisar, tente confirmar de novo (a repetição não aplica o reajuste duas vezes).");
      }
    });
  }

  const marcar = (c: ComponenteId, ligado: boolean) => setMarcados((atual) => (ligado ? [...atual, c] : atual.filter((x) => x !== c)));
  const ignoradosPorMotivo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const i of previa?.ignorados ?? resultado?.ignorados ?? []) mapa.set(i.texto, (mapa.get(i.texto) ?? 0) + 1);
    return Array.from(mapa.entries());
  }, [previa, resultado]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Reajustar preços">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{passo === "concluido" ? "Reajuste aplicado" : passo === "previa" ? "Conferir antes de confirmar" : "Reajustar preços"}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{alvo.titulo}</p>
          </div>
          <button type="button" aria-label="Fechar" disabled={pendente} onClick={aoFechar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {erro && (
            <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{erro}</span>
            </div>
          )}

          {(alvo.avisos ?? []).map((a) => (
            <p key={a} className="mb-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{a}</span></p>
          ))}

          {passo === "config" && (
            <div className="flex flex-col gap-5">
              <div>
                <p className={rotulo}>Como calcular</p>
                <div className="mt-1 inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Forma de cálculo">
                  {([["mesmo", "Mesmo percentual"], ["componente", "Percentual por componente"], ...(unico ? [["valor", "Novo valor"]] : [])] as Array<[Modo, string]>).map(([m, nome]) => (
                    <button key={m} type="button" onClick={() => setModo(m)} aria-pressed={modo === m}
                      className={`h-9 px-3 text-sm font-medium ${modo === m ? "bg-[#2C4F79] text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>{nome}</button>
                  ))}
                </div>
              </div>

              {modo === "mesmo" && (
                <label className="flex max-w-xs flex-col gap-1">
                  <span className={rotulo}>Percentual (use vírgula nos decimais; negativo reduz)</span>
                  <input inputMode="decimal" value={percentualUnico} onChange={(e) => setPercentualUnico(e.target.value)} placeholder="Ex.: 5,5" className={campo} />
                </label>
              )}

              <div>
                <p className={rotulo}>{alvo.tipo === "maquina" ? "Componentes a reajustar" : "Preço"}</p>
                <ul className="mt-1 flex flex-col gap-2">
                  {componentesDoTipo.map((c) => {
                    const preco = alvo.item?.precos[c];
                    const semPreco = unico && (preco === null || preco === undefined);
                    const ligado = marcados.includes(c);
                    return (
                      <li key={c} className={`grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-lg border border-border px-3 py-2 sm:grid-cols-[auto_9rem_1fr_9rem] ${semPreco ? "opacity-60" : ""}`}>
                        <input type="checkbox" checked={ligado} disabled={semPreco} onChange={(e) => marcar(c, e.target.checked)} aria-label={`Reajustar ${COMPONENTES[c].rotulo}`} className="h-4 w-4" />
                        <span className="text-sm font-medium text-foreground">{COMPONENTES[c].rotulo}</span>
                        {unico ? <span className="col-start-2 text-sm tabular-nums text-muted-foreground sm:col-start-auto">{semPreco ? "sem preço cadastrado" : `atual ${fmtBRL(preco)}`}</span> : <span className="hidden sm:block" />}
                        {modo === "componente" && (
                          <input inputMode="decimal" disabled={!ligado} value={percentuais[c] ?? ""} onChange={(e) => setPercentuais((p) => ({ ...p, [c]: e.target.value }))}
                            placeholder="% ex.: 5,5" aria-label={`Percentual de ${COMPONENTES[c].rotulo}`} className={`${campo} col-start-2 sm:col-start-auto`} />
                        )}
                        {modo === "valor" && (
                          <input inputMode="decimal" disabled={!ligado} value={valores[c] ?? ""} onChange={(e) => setValores((p) => ({ ...p, [c]: e.target.value }))}
                            placeholder="Novo valor (R$)" aria-label={`Novo valor de ${COMPONENTES[c].rotulo}`} className={`${campo} col-start-2 sm:col-start-auto`} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <label className="flex flex-col gap-1">
                <span className={rotulo}>Motivo do reajuste *</span>
                <input list="motivos-reajuste" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Reajuste anual" maxLength={200} className={campo} />
                <datalist id="motivos-reajuste">{SUGESTOES_MOTIVO.map((s) => <option key={s} value={s} />)}</datalist>
              </label>

              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                O reajuste passa a valer <strong className="text-foreground">imediatamente</strong> após a confirmação e fica registrado com a data de hoje (horário de Brasília). Propostas já emitidas não mudam.
              </p>
            </div>
          )}

          {passo === "previa" && previa && (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Resumo rotulo="Seleção" valor={previa.escopoDescricao} pequeno />
                <Resumo rotulo="Produtos alterados" valor={String(previa.produtos)} />
                <Resumo rotulo="Componentes alterados" valor={String(previa.componentes)} />
                <Resumo rotulo="Componentes" valor={marcados.map((c) => COMPONENTES[c].curto).join(", ")} pequeno />
              </dl>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                Vale <strong>imediatamente ao confirmar</strong> — registrado em {formatarData(previa.hoje)}.
              </p>

              {previa.itens.length === 0 ? (
                <p className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">Nenhum preço seria alterado. Volte e ajuste os percentuais ou a seleção.</p>
              ) : (
                <div className="max-h-[38vh] overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                      <tr><th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Componente</th><th className="px-3 py-2 text-right font-semibold">Atual</th><th className="px-3 py-2 text-right font-semibold">%</th><th className="px-3 py-2 text-right font-semibold">Novo</th><th className="px-3 py-2 text-right font-semibold">Diferença</th></tr>
                    </thead>
                    <tbody>
                      {previa.itens.map((i) => (
                        <tr key={`${i.produto_id}:${i.componente}`} className="border-t border-border">
                          <td className="px-3 py-2"><span className="block max-w-[16rem] truncate text-foreground" title={i.descricao}>{i.descricao || i.codigo}</span><span className="font-mono text-xs text-muted-foreground">{i.codigo}</span></td>
                          <td className="px-3 py-2 text-muted-foreground">{rotuloComponente(i.componente)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(i.atual)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtPct(i.percentual)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtBRL(i.novo)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDiferenca(i.diferenca)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previa.ignorados.length > 0 && (
                <div className="rounded-lg border border-border px-3 py-2 text-sm">
                  <button type="button" onClick={() => setIgnoradosAbertos(!ignoradosAbertos)} className="font-medium text-foreground" aria-expanded={ignoradosAbertos}>
                    {previa.ignorados.length} {previa.ignorados.length === 1 ? "item ignorado" : "itens ignorados"} {ignoradosAbertos ? "▾" : "▸"}
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground">{ignoradosPorMotivo.map(([t, n]) => `${n} ${t}`).join(" · ")}</p>
                  {ignoradosAbertos && (
                    <ul className="mt-2 max-h-40 overflow-auto text-xs text-muted-foreground">
                      {previa.ignorados.map((i) => <li key={`${i.produto_id}:${i.componente}`}>{i.codigo ?? i.produto_id} · {rotuloComponente(i.componente)} — {i.texto}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <label className="flex flex-col gap-1">
                <span className={rotulo}>Motivo do reajuste *</span>
                <input list="motivos-reajuste" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className={campo} aria-invalid={Boolean(erroMotivo)} />
                {erroMotivo && <span className="text-xs text-amber-700 dark:text-amber-300">Informe o motivo (mínimo {MOTIVO_MINIMO} caracteres) para confirmar.</span>}
              </label>
            </div>
          )}

          {passo === "concluido" && resultado && (
            <div className="flex flex-col items-start gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground"><CheckCircle2 className="h-5 w-5 text-green-600" />
                {resultado.repetido ? "Este reajuste já havia sido gravado. Nada foi aplicado novamente." : "Reajuste gravado e em vigor."}
              </p>
              <p className="text-sm text-muted-foreground">{resultado.produtos} {resultado.produtos === 1 ? "produto" : "produtos"} e {resultado.componentes} {resultado.componentes === 1 ? "componente alterado" : "componentes alterados"} em {formatarData(resultado.data)}.</p>
              {resultado.ignorados.length > 0 && <p className="text-xs text-muted-foreground">Ignorados: {ignoradosPorMotivo.map(([t, n]) => `${n} ${t}`).join(" · ")}.</p>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          {passo === "config" && (
            <>
              {errosConfig && <span className="mr-auto text-xs text-muted-foreground">{errosConfig}</span>}
              <button type="button" onClick={aoFechar} disabled={pendente} className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="button" onClick={gerarPrevia} disabled={pendente || Boolean(errosConfig)} className="flex h-10 items-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-50">
                {pendente && <Loader2 className="h-4 w-4 animate-spin" />}Ver prévia
              </button>
            </>
          )}
          {passo === "previa" && (
            <>
              <button type="button" onClick={() => { setPasso("config"); setErro(null); setConflito(false); }} disabled={pendente} className="mr-auto h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">Voltar e editar</button>
              {conflito && <button type="button" onClick={gerarPrevia} disabled={pendente} className="h-10 rounded-lg border border-[#2074B9] px-4 text-sm font-semibold text-[#2074B9]">Gerar nova prévia</button>}
              <button type="button" onClick={confirmar} disabled={pendente || conflito || !previa || previa.itens.length === 0 || Boolean(erroMotivo)} className="flex h-10 items-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-50">
                {pendente && <Loader2 className="h-4 w-4 animate-spin" />}{pendente ? "Aplicando..." : `Confirmar reajuste (${previa?.componentes ?? 0})`}
              </button>
            </>
          )}
          {passo === "concluido" && (
            <button type="button" onClick={aoConcluir} className="h-10 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white">Fechar</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Resumo({ rotulo: nome, valor, pequeno = false }: { rotulo: string; valor: string; pequeno?: boolean }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{nome}</dt>
      <dd className={`mt-0.5 font-semibold text-foreground ${pequeno ? "text-sm leading-snug" : "text-lg"}`}>{valor}</dd>
    </div>
  );
}

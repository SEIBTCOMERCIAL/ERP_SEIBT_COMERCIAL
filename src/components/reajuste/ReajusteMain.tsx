"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { listarItensReajuste } from "@/app/actions/reajuste";
import { SITUACAO_ROTULO } from "@/lib/reajuste/regras";
import type { Aba, FiltroSituacao, ItemLista, RespostaLista, ResumoEscopo, ResumoReajuste } from "@/lib/reajuste/tipos";
import { BarraSelecao } from "./BarraSelecao";
import { DetalheItem, type Cambio } from "./DetalheItem";
import { JanelaIpi } from "./JanelaIpi";
import { JanelaReajuste, type AlvoReajuste } from "./JanelaReajuste";
import { KitsNavalha, type ResumoVisao } from "./KitsNavalha";
import { PeneirasPorModelo } from "./PeneirasPorModelo";
import { SeletorEscopo } from "./SeletorEscopo";
import { TabelaItens } from "./TabelaItens";

const campo = "h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-[#2074B9]";
const botao = "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40";

function somar(escopos: ResumoEscopo[]) {
  return escopos.reduce(
    (t, e) => ({ total: t.total + e.total, sem_reajuste: t.sem_reajuste + e.sem_reajuste, parcial: t.parcial + e.parcial, atualizado: t.atualizado + e.atualizado, sem_preco: t.sem_preco + e.sem_preco, inativos: t.inativos + e.inativos }),
    { total: 0, sem_reajuste: 0, parcial: 0, atualizado: 0, sem_preco: 0, inativos: 0 }
  );
}

export function ReajusteMain({ resumo, cambio }: { resumo: ResumoReajuste; cambio: Cambio | null }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("maquinas");
  const [escopoPorAba, setEscopoPorAba] = useState<Record<Aba, string | null>>({
    maquinas: resumo.maquinas.find((e) => e.total > 0)?.id ?? null,
    pecas: resumo.pecas.find((e) => e.total > 0)?.id ?? null,
  });
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [pagina, setPagina] = useState(1);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [dados, setDados] = useState<Extract<RespostaLista, { ok: true }> | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [janela, setJanela] = useState<AlvoReajuste | null>(null);
  const [janelaIpi, setJanelaIpi] = useState<{ produtoId: string; titulo: string; ipi: number | null } | null>(null);
  const [detalhe, setDetalhe] = useState<ItemLista | null>(null);
  const [visao, setVisao] = useState<ResumoVisao | null>(null);

  const escopos = aba === "maquinas" ? resumo.maquinas : resumo.pecas;
  const escopoId = escopoPorAba[aba];
  const escopoAtual = escopos.find((e) => e.id === escopoId) ?? null;
  const totais = useMemo(() => somar(escopoAtual ? [escopoAtual] : escopos), [escopoAtual, escopos]);
  // Navalhas (por kit) e peneiras (por modelo) têm tabelas próprias.
  const visaoEspecial = aba === "pecas" ? escopoAtual?.tipo_categoria ?? null : null;
  const aoResumo = useCallback((r: ResumoVisao) => setVisao(r), []);

  useEffect(() => {
    const t = setTimeout(() => { setBuscaAplicada(busca); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (visaoEspecial) return;
    let cancelado = false;
    setCarregando(true);
    listarItensReajuste({ aba, escopoId, busca: buscaAplicada, situacao, pagina })
      .then((r) => { if (cancelado) return; setCarregando(false); if (r.ok) { setDados(r); setErroLista(null); } else setErroLista(r.erro); })
      .catch(() => { if (!cancelado) { setCarregando(false); setErroLista("Não foi possível carregar os itens. Tente novamente."); } });
    return () => { cancelado = true; };
  }, [aba, escopoId, buscaAplicada, situacao, pagina, versao, visaoEspecial]);

  function trocarAba(nova: Aba) {
    if (nova === aba) return;
    setAba(nova); setPagina(1); setSelecao(new Set()); setSituacao("todas"); setDados(null); setVisao(null);
  }
  function trocarEscopo(id: string | null) {
    setEscopoPorAba((e) => ({ ...e, [aba]: id })); setPagina(1); setSelecao(new Set()); setDados(null); setVisao(null);
  }
  const alternar = (id: string, on: boolean) => setSelecao((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const alternarPagina = (ids: string[], on: boolean) => setSelecao((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

  const tipo = aba === "maquinas" ? "maquina" : "peca";
  const reajustarItem = (item: ItemLista) => setJanela({ escopo: { tipo: "itens", ids: [item.id] }, tipo: item.tipo, titulo: `${item.codigo} · ${item.descricao}`, item });
  const reajustarSelecionados = () => setJanela({ escopo: { tipo: "itens", ids: Array.from(selecao) }, tipo, titulo: `${selecao.size} ${selecao.size === 1 ? "item selecionado" : "itens selecionados"}` });
  const filtroAtivo = buscaAplicada.trim().length >= 2 || situacao !== "todas";
  const reajustarEscopo = () => escopoAtual && setJanela({
    escopo: { tipo: aba === "maquinas" ? "linha" : "categoria", id: escopoAtual.id }, tipo,
    titulo: `${aba === "maquinas" ? "Linha" : "Categoria"} inteira: ${escopoAtual.nome} (${escopoAtual.total} ${escopoAtual.total === 1 ? "item" : "itens"}${filtroAtivo ? ", inclusive os ocultos pelo filtro atual" : ""})`,
  });
  const concluir = () => { setJanela(null); setJanelaIpi(null); setDetalhe(null); setSelecao(new Set()); setVersao((v) => v + 1); router.refresh(); };

  // Situações para o resumo expansível: da visão especial (kits) ou do resumo da linha/categoria.
  const situacoes = visaoEspecial === "navalha" ? visao?.situacoes ?? [] : visaoEspecial === "peneira" ? [] : [
    { valor: "sem_reajuste" as const, rotulo: SITUACAO_ROTULO.sem_reajuste, n: totais.sem_reajuste },
    { valor: "parcial" as const, rotulo: SITUACAO_ROTULO.parcial, n: totais.parcial },
    { valor: "atualizado" as const, rotulo: SITUACAO_ROTULO.atualizado, n: totais.atualizado },
    { valor: "sem_preco" as const, rotulo: SITUACAO_ROTULO.sem_preco, n: totais.sem_preco },
    ...(totais.inativos > 0 ? [{ valor: "inativo" as const, rotulo: SITUACAO_ROTULO.inativo, n: totais.inativos }] : []),
  ];
  const contagem = visaoEspecial ? visao?.contagem ?? "" : dados ? `${dados.total} ${dados.total === 1 ? "item" : "itens"}` : "";
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;
  const filtrados = dados?.todosIds ?? [];
  const periodo = `desde ${resumo.inicio.split("-").reverse().join("/")}`;

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reajuste de preços</h1>
        <div role="tablist" aria-label="Tipo de item" className="inline-flex gap-0.5 rounded-lg border border-border bg-card p-1">
          {(["maquinas", "pecas"] as const).map((a) => (
            <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => trocarAba(a)}
              className={`h-9 rounded-md px-4 text-sm font-medium ${aba === a ? "bg-[#2C4F79] text-white" : "text-muted-foreground hover:text-foreground"}`}>{a === "maquinas" ? "Máquinas" : "Peças"}</button>
          ))}
        </div>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_13rem]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar por código, modelo ou descrição" placeholder="Buscar por código, modelo ou descrição" className={`${campo} w-full pl-9`} />
        </div>
        <SeletorEscopo rotulo={aba === "maquinas" ? "Linha" : "Categoria"} todos={aba === "maquinas" ? "Todas as linhas" : "Todas as categorias"} escopos={escopos} selecionado={escopoId} aoSelecionar={trocarEscopo} />
        <select value={situacao} onChange={(e) => { setSituacao(e.target.value as FiltroSituacao); setPagina(1); setSelecao(new Set()); }} aria-label="Situação do reajuste" className={campo}>
          <option value="todas">Todas as situações</option>
          {(["sem_reajuste", "parcial", "atualizado", "sem_preco", "inativo"] as const).map((s) => <option key={s} value={s}>{SITUACAO_ROTULO[s]}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <strong className="mr-auto text-base font-semibold text-foreground">{escopoAtual?.nome ?? (aba === "maquinas" ? "Todas as linhas" : "Todas as categorias")}</strong>
        <span className="flex items-center gap-1.5" aria-live="polite">{carregando && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}{contagem}</span>
        <span>Período: {periodo}</span>
        {situacoes.length > 0 && (
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[#2074B9] [&::-webkit-details-marker]:hidden">Resumo por situação<ChevronDown className="h-3 w-3" aria-hidden="true" /></summary>
            <ul className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-border bg-card p-1.5 text-sm shadow-lg">
              {situacoes.map((s) => (
                <li key={s.valor}>
                  <button type="button" onClick={(e) => { setSituacao(situacao === s.valor ? "todas" : s.valor); setPagina(1); (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }} aria-pressed={situacao === s.valor}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left hover:bg-muted ${situacao === s.valor ? "font-semibold text-foreground" : "text-foreground"}`}>
                    <span>{s.rotulo}</span><span className="text-muted-foreground">{s.n}</span>
                  </button>
                </li>
              ))}
              {visao?.nota && <li className="border-t border-border px-2.5 pt-1.5 text-xs text-muted-foreground">{visao.nota}</li>}
            </ul>
          </details>
        )}
        {escopoAtual && !visaoEspecial && (
          <button type="button" onClick={reajustarEscopo} className="text-[#2074B9] hover:underline" title="Aplica à lista completa, conferida na prévia antes de confirmar">
            Reajustar {aba === "maquinas" ? "linha" : "categoria"} inteira ({escopoAtual.total})
          </button>
        )}
      </div>

      {visaoEspecial === "navalha" && <KitsNavalha busca={buscaAplicada} situacao={situacao} hoje={resumo.hoje} cambio={cambio} aoResumo={aoResumo} />}
      {visaoEspecial === "peneira" && <PeneirasPorModelo busca={buscaAplicada} situacao={situacao} hoje={resumo.hoje} cambio={cambio} aoResumo={aoResumo} />}

      {!visaoEspecial && (
        <section className="flex min-w-0 flex-col gap-3" aria-label="Itens">
          {erroLista && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{erroLista}</p>}

          {dados && dados.itens.length > 0 && (
            <TabelaItens itens={dados.itens} modo={aba} selecao={selecao} mostrarEscopo={!escopoId} cabecalhoFixo
              aoAlternar={alternar} aoAlternarPagina={alternarPagina} aoDetalhar={setDetalhe} />
          )}
          {dados && dados.itens.length === 0 && !carregando && !erroLista && (
            <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhum item encontrado com esses filtros.</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{aba === "maquinas" ? "Valores sem IPI · os painéis 220 V e 380 V são alternativas, nunca somados entre si" : "Valores unitários sem IPI"}</span>
            {dados && dados.total > dados.tamanho && (
              <span className="flex items-center gap-2">
                <span>{(dados.pagina - 1) * dados.tamanho + 1}–{Math.min(dados.pagina * dados.tamanho, dados.total)} de {dados.total}</span>
                <button type="button" disabled={dados.pagina <= 1 || carregando} onClick={() => setPagina(dados.pagina - 1)} className={botao}>Anterior</button>
                <button type="button" disabled={dados.pagina >= totalPaginas || carregando} onClick={() => setPagina(dados.pagina + 1)} className={botao}>Próxima</button>
              </span>
            )}
          </div>

          {selecao.size > 0 && (
            <BarraSelecao texto={`${selecao.size} ${selecao.size === 1 ? "item selecionado" : "itens selecionados"}`}
              filtrados={filtrados.length > 1 ? { total: filtrados.length, selecionados: selecao.size, aoSelecionarTodos: () => alternarPagina(filtrados, true) } : undefined}
              aoLimpar={() => setSelecao(new Set())} aoReajustar={reajustarSelecionados} />
          )}
        </section>
      )}

      {!visaoEspecial && <DetalheItem item={detalhe} hoje={resumo.hoje} cambio={cambio} aoFechar={() => setDetalhe(null)}
        aoReajustar={(i) => reajustarItem(i)} aoIpi={(i) => setJanelaIpi({ produtoId: i.id, titulo: `${i.codigo} · ${i.descricao}`, ipi: i.ipi_pct })} />}
      {janela && <JanelaReajuste key={JSON.stringify(janela.escopo)} alvo={janela} aoFechar={() => setJanela(null)} aoConcluir={concluir} />}
      {janelaIpi && <JanelaIpi titulo={janelaIpi.titulo} opcoes={[{ id: "uma", rotulo: janelaIpi.titulo, produtoIds: [janelaIpi.produtoId] }]} ipiAtual={janelaIpi.ipi} aoFechar={() => setJanelaIpi(null)} aoConcluir={concluir} />}
    </div>
  );
}

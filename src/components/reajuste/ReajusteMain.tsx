"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Loader2, Rows3, Search } from "lucide-react";
import { listarItensReajuste } from "@/app/actions/reajuste";
import { SITUACAO_ROTULO } from "@/lib/reajuste/regras";
import type { Aba, FiltroSituacao, ItemLista, RespostaLista, ResumoEscopo, ResumoReajuste } from "@/lib/reajuste/tipos";
import { DetalheItem, type Cambio } from "./DetalheItem";
import { JanelaReajuste, type AlvoReajuste } from "./JanelaReajuste";
import { ListaEscopos } from "./ListaEscopos";
import { TabelaItens, type Visao } from "./TabelaItens";

const campo = "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#2074B9]";
const botao = "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted";

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
  const [visao, setVisao] = useState<Visao>("tabela");
  const [pagina, setPagina] = useState(1);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [dados, setDados] = useState<Extract<RespostaLista, { ok: true }> | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [janela, setJanela] = useState<AlvoReajuste | null>(null);
  const [detalhe, setDetalhe] = useState<ItemLista | null>(null);

  const escopos = aba === "maquinas" ? resumo.maquinas : resumo.pecas;
  const escopoId = escopoPorAba[aba];
  const escopoAtual = escopos.find((e) => e.id === escopoId) ?? null;
  const totais = useMemo(() => somar(escopos), [escopos]);

  useEffect(() => {
    const t = setTimeout(() => { setBuscaAplicada(busca); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarItensReajuste({ aba, escopoId, busca: buscaAplicada, situacao, pagina })
      .then((r) => {
        if (cancelado) return;
        setCarregando(false);
        if (r.ok) { setDados(r); setErroLista(null); } else setErroLista(r.erro);
      })
      .catch(() => { if (!cancelado) { setCarregando(false); setErroLista("Não foi possível carregar os itens. Tente novamente."); } });
    return () => { cancelado = true; };
  }, [aba, escopoId, buscaAplicada, situacao, pagina, versao]);

  function trocarAba(nova: Aba) {
    if (nova === aba) return;
    setAba(nova); setPagina(1); setSelecao(new Set()); setSituacao("todas"); setDados(null);
  }
  function trocarEscopo(id: string | null) {
    setEscopoPorAba((e) => ({ ...e, [aba]: id })); setPagina(1); setDados(null);
  }
  function alternar(id: string, ligado: boolean) {
    setSelecao((s) => { const n = new Set(s); if (ligado) n.add(id); else n.delete(id); return n; });
  }
  function alternarPagina(ids: string[], ligado: boolean) {
    setSelecao((s) => { const n = new Set(s); ids.forEach((id) => (ligado ? n.add(id) : n.delete(id))); return n; });
  }

  const tipo = aba === "maquinas" ? "maquina" : "peca";
  const reajustarItem = (item: ItemLista) => setJanela({ escopo: { tipo: "itens", ids: [item.id] }, tipo: item.tipo, titulo: `${item.codigo} · ${item.descricao}`, item });
  const reajustarSelecionados = () => setJanela({ escopo: { tipo: "itens", ids: Array.from(selecao) }, tipo, titulo: `${selecao.size} ${selecao.size === 1 ? "item selecionado" : "itens selecionados"}` });
  const reajustarEscopo = () => escopoAtual && setJanela({
    escopo: { tipo: aba === "maquinas" ? "linha" : "categoria", id: escopoAtual.id }, tipo,
    titulo: `${aba === "maquinas" ? "Linha" : "Categoria"} inteira: ${escopoAtual.nome} (${escopoAtual.total} itens)`,
  });
  const concluir = () => { setJanela(null); setSelecao(new Set()); setVersao((v) => v + 1); router.refresh(); };

  const chip = (valor: FiltroSituacao, nome: string, n: number, alerta = false) => (
    <button key={valor} type="button" onClick={() => { setSituacao(situacao === valor ? "todas" : valor); setPagina(1); }} aria-pressed={situacao === valor}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${situacao === valor ? "border-[#2C4F79] bg-[#2C4F79] text-white" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
      {nome}<span className={`font-semibold ${situacao !== valor && alerta && n > 0 ? "text-amber-700 dark:text-amber-300" : ""}`}>{n}</span>
    </button>
  );

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;
  const filtrados = dados?.todosIds ?? [];
  const todosFiltradosMarcados = filtrados.length > 0 && filtrados.every((id) => selecao.has(id));

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Reajuste de preços</h1>
            <p className="text-xs text-muted-foreground">Período considerado: desde {resumo.inicio.split("-").reverse().join("/")} · o reajuste vale na hora, ao confirmar</p>
          </div>
          <div role="tablist" aria-label="Tipo de item" className="inline-flex overflow-hidden rounded-lg border border-border">
            {(["maquinas", "pecas"] as const).map((a) => (
              <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => trocarAba(a)}
                className={`h-10 px-4 text-sm font-medium ${aba === a ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}>{a === "maquinas" ? "Máquinas" : "Peças"}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Resumo e filtro por situação">
          {chip("todas", "Todos", totais.total)}
          {chip("sem_reajuste", SITUACAO_ROTULO.sem_reajuste, totais.sem_reajuste, true)}
          {chip("parcial", SITUACAO_ROTULO.parcial, totais.parcial, true)}
          {chip("atualizado", SITUACAO_ROTULO.atualizado, totais.atualizado)}
          {chip("sem_preco", SITUACAO_ROTULO.sem_preco, totais.sem_preco)}
          {totais.inativos > 0 && chip("inativo", SITUACAO_ROTULO.inativo, totais.inativos)}
        </div>
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <ListaEscopos rotulo={aba === "maquinas" ? "Linhas" : "Categorias"} escopos={escopos} selecionado={escopoId} aoSelecionar={trocarEscopo} />

        <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label="Itens">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar itens" placeholder={escopoId ? "Buscar por código, modelo ou descrição" : "Digite ao menos 2 letras para buscar em todas"}
                className={`${campo} w-full pl-9`} />
            </div>
            <select value={situacao} onChange={(e) => { setSituacao(e.target.value as FiltroSituacao); setPagina(1); }} aria-label="Situação do reajuste" className={campo}>
              <option value="todas">Todas as situações</option>
              {(["sem_reajuste", "parcial", "atualizado", "sem_preco", "inativo"] as const).map((s) => <option key={s} value={s}>{SITUACAO_ROTULO[s]}</option>)}
            </select>
            <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Visualização">
              <button type="button" aria-pressed={visao === "tabela"} onClick={() => setVisao("tabela")} title="Tabela" className={`flex h-10 w-10 items-center justify-center ${visao === "tabela" ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}><Rows3 className="h-4 w-4" /></button>
              <button type="button" aria-pressed={visao === "cards"} onClick={() => setVisao("cards")} title="Cartões" className={`flex h-10 w-10 items-center justify-center ${visao === "cards" ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={reajustarSelecionados} disabled={selecao.size === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-40">
              Reajustar selecionados{selecao.size > 0 ? ` (${selecao.size})` : ""}
            </button>
            {escopoAtual && (
              <button type="button" onClick={reajustarEscopo} className={botao} title="Aplica à lista completa, conferida na prévia antes de confirmar">
                Reajustar {aba === "maquinas" ? "linha" : "categoria"} inteira ({escopoAtual.total})
              </button>
            )}
            {selecao.size > 0 && <button type="button" onClick={() => setSelecao(new Set())} className="text-sm font-medium text-[#2074B9] hover:underline">Limpar seleção</button>}
            {filtrados.length > (dados?.itens.length ?? 0) && !todosFiltradosMarcados && (
              <button type="button" onClick={() => alternarPagina(filtrados, true)} className="text-sm font-medium text-[#2074B9] hover:underline">Selecionar todos os {filtrados.length} filtrados</button>
            )}
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">{carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{dados ? `${dados.total} ${dados.total === 1 ? "item" : "itens"}` : ""}</span>
          </div>

          {erroLista && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{erroLista}</p>}

          {dados && dados.itens.length > 0 && (
            <TabelaItens itens={dados.itens} aba={aba} visao={visao} selecao={selecao} mostrarEscopo={!escopoId}
              aoAlternar={alternar} aoAlternarPagina={alternarPagina} aoReajustar={reajustarItem} aoDetalhar={setDetalhe} />
          )}
          {dados && dados.itens.length === 0 && !carregando && !erroLista && (
            <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {escopoId || buscaAplicada.trim().length >= 2 ? "Nenhum item encontrado com esses filtros." : "Digite ao menos 2 letras para buscar em todas, ou escolha uma opção na lista."}
            </p>
          )}

          {dados && dados.total > dados.tamanho && (
            <nav aria-label="Páginas" className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{(dados.pagina - 1) * dados.tamanho + 1}–{Math.min(dados.pagina * dados.tamanho, dados.total)} de {dados.total}</span>
              <span className="flex gap-2">
                <button type="button" disabled={dados.pagina <= 1 || carregando} onClick={() => setPagina(dados.pagina - 1)} className={`${botao} disabled:opacity-40`}>Anterior</button>
                <button type="button" disabled={dados.pagina >= totalPaginas || carregando} onClick={() => setPagina(dados.pagina + 1)} className={`${botao} disabled:opacity-40`}>Próxima</button>
              </span>
            </nav>
          )}
        </section>
      </div>

      <DetalheItem item={detalhe} hoje={resumo.hoje} cambio={cambio} aoFechar={() => setDetalhe(null)} aoReajustar={(i) => { setDetalhe(null); reajustarItem(i); }} />
      {janela && <JanelaReajuste key={JSON.stringify(janela.escopo)} alvo={janela} aoFechar={() => setJanela(null)} aoConcluir={concluir} />}
    </div>
  );
}

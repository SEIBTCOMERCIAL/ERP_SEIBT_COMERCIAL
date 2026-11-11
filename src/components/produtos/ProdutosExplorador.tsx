"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownUp, Camera, Download, LayoutGrid, ListChecks, Loader2, MoreVertical, Plus, Rows3, Search, Settings2, Trash2 } from "lucide-react";
import {
  alterarSituacao, criarCategoriaPeca, criarLinha, duplicarEquipamento, excluirCategoriaPeca, excluirLinha,
} from "@/app/actions/produtos-admin";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { JanelaReajuste, type AlvoReajuste } from "@/components/reajuste/JanelaReajuste";
import type { ItemLista } from "@/lib/reajuste/tipos";
import { montarQuery, type FiltrosProdutos } from "@/lib/produtos/regras";
import type { Navegacao, ProdutoLista, RespostaListaProdutos } from "@/lib/produtos/tipos";
import { Aviso, botaoPrimario, botaoSecundario, campoCls } from "./base";
import { FormEquipamento } from "./FormEquipamento";
import { FotoLinhaModal } from "./FotoLinhaModal";
import { ListaProdutos, type AcaoLista } from "./ListaProdutos";
import { ModeloFicha } from "./ModeloFicha";
import { NavegacaoProdutos } from "./NavegacaoProdutos";
import { PecaPainel, type AlvoPeca } from "./PecaPainel";

const SITUACOES = [["ativos", "Ativos"], ["descontinuados", "Descontinuados"], ["todos", "Todos"]] as const;
const ORDENS = [["padrao", "Ordem do cadastro"], ["nome", "Nome / descrição"], ["codigo", "Código"], ["preco", "Preço"], ["atualizado", "Última alteração"]] as const;

function paraItemLista(p: ProdutoLista): ItemLista {
  return {
    id: p.id, codigo: p.codigo, descricao: p.descricao, modelo: p.modelo, tipo: p.tipo, ativo: p.situacao !== "inativo", solicitar_engenharia: p.solicitar_engenharia,
    ipi_pct: p.ipi_pct, situacao: "sem_reajuste", reajustados: [], pendentes: [], ultimo: null, escopo_nome: p.linha_nome ?? p.categoria_peca_nome,
    precos: p.tipo === "maquina" ? { moinho: p.preco_brl, painel_220: p.preco_painel_220, painel_380: p.preco_painel_380 } : { peca: p.preco_brl },
  };
}

export function ProdutosExplorador({ filtros, nav, resposta, admin, camposFicha, avisoEscopo }: {
  filtros: FiltrosProdutos; nav: Navegacao; resposta: RespostaListaProdutos; admin: boolean;
  camposFicha: Array<{ id: string; nome: string }>; avisoEscopo: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [navegando, iniciarNavegacao] = useTransition();
  const [pendente, iniciar] = useTransition();
  const [busca, setBusca] = useState(filtros.q);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [novoEquip, setNovoEquip] = useState(false);
  const [fotoLinha, setFotoLinha] = useState(false);
  const [modelo, setModelo] = useState(false);
  const [alvoPeca, setAlvoPeca] = useState<AlvoPeca | null>(null);
  const [reajuste, setReajuste] = useState<AlvoReajuste | null>(null);
  const [novoGrupo, setNovoGrupo] = useState("");

  const maquinas = filtros.aba === "maquinas";
  const linha = maquinas && filtros.escopo ? nav.linhas.find((l) => l.id === filtros.escopo) ?? null : null;
  const categoria = !maquinas && filtros.escopo ? nav.categorias.find((c) => c.id === filtros.escopo) ?? null : null;
  const grupoAtual = linha ?? categoria;

  const ir = (parcial: Partial<FiltrosProdutos>, voltarPagina1 = true) => {
    const prox = { ...filtros, ...parcial, ...(voltarPagina1 && !("pagina" in parcial) ? { pagina: 1 } : {}) };
    iniciarNavegacao(() => router.push(`${pathname}${montarQuery(prox)}`, { scroll: false }));
  };

  // Busca com pequena espera para não consultar a cada letra.
  useEffect(() => {
    if (busca === filtros.q) return;
    const t = setTimeout(() => ir({ q: busca }), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);
  useEffect(() => { setBusca(filtros.q); }, [filtros.q]);

  const contagem = useMemo(() => {
    const fonte = grupoAtual ? [grupoAtual.contagem] : (maquinas ? nav.linhas : nav.categorias).map((x) => x.contagem);
    return fonte.reduce((t, c) => ({
      sem_foto: t.sem_foto + c.sem_foto, sem_preco: t.sem_preco + c.sem_preco, ficha_incompleta: t.ficha_incompleta + c.ficha_incompleta, sem_vinculo: t.sem_vinculo + c.sem_vinculo,
    }), { sem_foto: 0, sem_preco: 0, ficha_incompleta: 0, sem_vinculo: 0 });
  }, [grupoAtual, maquinas, nav]);

  const hrefDetalhe = (p: ProdutoLista) => `/produtos/linhas/${p.linha_id}/${p.id}?de=${encodeURIComponent(montarQuery(filtros))}`;

  function acao(a: AcaoLista, p: ProdutoLista) {
    setMensagem(null);
    if (a === "abrir_peca") { setAlvoPeca({ modo: "ver", id: p.id }); return; }
    if (a === "reajustar") {
      setReajuste({ escopo: { tipo: "itens", ids: [p.id] }, tipo: p.tipo, titulo: `${p.codigo}${p.descricao && p.tipo === "peca" ? ` · ${p.descricao}` : ""}`, item: paraItemLista(p) });
      return;
    }
    const nome = p.tipo === "maquina" ? p.codigo : p.descricao || p.codigo;
    if (a === "duplicar") {
      iniciar(async () => {
        const r = await duplicarEquipamento(p.linha_id ?? "", p.id).catch(() => null);
        if (!r) setMensagem({ tipo: "erro", texto: "Não foi possível duplicar. Tente novamente." });
        else if (!r.ok) setMensagem({ tipo: "erro", texto: r.erro });
        else router.push(`/produtos/linhas/${p.linha_id}/${r.id}`);
      });
      return;
    }
    const texto = a === "excluir"
      ? `Excluir "${nome}"? O cadastro sai das telas e das propostas novas; o histórico de preços é preservado.${p.tipo === "peca" ? " A peça também será desvinculada dos equipamentos." : ""}`
      : a === "descontinuar" ? `Descontinuar "${nome}"? Ele deixa de aparecer em propostas novas e no catálogo, mas continua cadastrado.` : `Reativar "${nome}"?`;
    if (!confirm(texto)) return;
    iniciar(async () => {
      const r = await alterarSituacao(p.id, a).catch(() => null);
      if (!r) setMensagem({ tipo: "erro", texto: "Não foi possível concluir. Tente novamente." });
      else if (!r.ok) setMensagem({ tipo: "erro", texto: r.erro });
      else { setMensagem({ tipo: "sucesso", texto: a === "excluir" ? "Excluído." : a === "descontinuar" ? "Descontinuado." : "Reativado." }); router.refresh(); }
    });
  }

  function criarGrupo(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      const r = await (maquinas ? criarLinha(novoGrupo) : criarCategoriaPeca(novoGrupo)).catch(() => null);
      if (!r) setMensagem({ tipo: "erro", texto: "Não foi possível salvar. Tente novamente." });
      else if (!r.ok) setMensagem({ tipo: "erro", texto: r.erro });
      else { setNovoGrupo(""); setMensagem({ tipo: "sucesso", texto: maquinas ? "Linha criada." : "Categoria criada." }); router.refresh(); }
    });
  }

  function excluirGrupo() {
    if (!grupoAtual || !confirm(`Excluir ${maquinas ? "a linha" : "a categoria"} "${grupoAtual.nome}"? Só é possível se estiver vazia.`)) return;
    iniciar(async () => {
      const r = await (maquinas ? excluirLinha(grupoAtual.id) : excluirCategoriaPeca(grupoAtual.id)).catch(() => null);
      if (!r) setMensagem({ tipo: "erro", texto: "Não foi possível excluir. Tente novamente." });
      else if (!r.ok) setMensagem({ tipo: "erro", texto: r.erro });
      else ir({ escopo: null });
    });
  }

  const chip = (valor: FiltrosProdutos["pendencia"], nome: string, n: number) => (
    <button key={valor} type="button" onClick={() => ir({ pendencia: filtros.pendencia === valor ? "" : valor })} aria-pressed={filtros.pendencia === valor}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${filtros.pendencia === valor ? "border-[#2C4F79] bg-[#2C4F79] text-white" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
      {nome}<span className={`font-semibold ${filtros.pendencia !== valor && n > 0 ? "text-amber-700 dark:text-amber-300" : ""}`}>{n}</span>
    </button>
  );

  const total = resposta.ok ? resposta.total : 0;
  const totalPaginas = resposta.ok ? Math.max(1, Math.ceil(resposta.total / resposta.tamanho)) : 1;
  const filtrando = Boolean(filtros.q || filtros.pendencia || filtros.situacao !== "ativos");

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Produtos</h1>
          <p className="text-xs text-muted-foreground">Máquinas e peças. Os preços vêm do Reajuste e alimentam o catálogo e as propostas.</p>
        </div>
        <div role="tablist" aria-label="Tipo de produto" className="inline-flex overflow-hidden rounded-lg border border-border">
          {(["maquinas", "pecas"] as const).map((a) => (
            <button key={a} type="button" role="tab" aria-selected={filtros.aba === a}
              onClick={() => iniciarNavegacao(() => router.push(`${pathname}${montarQuery({ aba: a, visao: filtros.visao })}`, { scroll: false }))}
              className={`h-10 px-4 text-sm font-medium ${filtros.aba === a ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}>{a === "maquinas" ? "Máquinas" : "Peças"}</button>
          ))}
        </div>
      </header>

      {mensagem && <Aviso tipo={mensagem.tipo === "erro" ? "erro" : "sucesso"}>{mensagem.texto}</Aviso>}
      {avisoEscopo && <Aviso tipo="info">{avisoEscopo}</Aviso>}

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex shrink-0 flex-col gap-3">
          <NavegacaoProdutos aba={filtros.aba} nav={nav} escopo={filtros.escopo} aoSelecionar={(id) => ir({ escopo: id, pendencia: "" })} />
          {admin && (
            <form onSubmit={criarGrupo} className="flex gap-2 md:w-60">
              <input value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} maxLength={80} aria-label={maquinas ? "Nome da nova linha" : "Nome da nova categoria"} placeholder={maquinas ? "Nova linha…" : "Nova categoria…"} className={`${campoCls} h-9`} />
              <button type="submit" disabled={pendente || !novoGrupo.trim()} className={`${botaoSecundario} h-9 px-3`} aria-label="Criar"><Plus className="h-4 w-4" /></button>
            </form>
          )}
        </div>

        <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label="Lista de produtos">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produtos" className={`${campoCls} pl-9`}
                placeholder={maquinas ? "Buscar por modelo, código, descrição ou linha" : "Buscar por código, descrição ou categoria"} />
            </div>
            <select value={filtros.situacao} onChange={(e) => ir({ situacao: e.target.value as FiltrosProdutos["situacao"] })} aria-label="Situação" className={`${campoCls} w-auto`}>
              {SITUACOES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
            <select value={filtros.ordem} onChange={(e) => ir({ ordem: e.target.value as FiltrosProdutos["ordem"] })} aria-label="Ordenar por" className={`${campoCls} w-auto`}>
              {ORDENS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
            {filtros.ordem !== "padrao" && (
              <button type="button" className={botaoSecundario} onClick={() => ir({ dir: filtros.dir === "asc" ? "desc" : "asc" })} aria-label={`Ordem ${filtros.dir === "asc" ? "crescente" : "decrescente"}`} title="Inverter a ordem"><ArrowDownUp className="h-4 w-4" />{filtros.dir === "asc" ? "A→Z" : "Z→A"}</button>
            )}
            <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Visualização">
              <button type="button" aria-pressed={filtros.visao === "tabela"} title="Tabela" onClick={() => ir({ visao: "tabela" }, false)} className={`flex h-10 w-10 items-center justify-center ${filtros.visao === "tabela" ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}><Rows3 className="h-4 w-4" /></button>
              <button type="button" aria-pressed={filtros.visao === "cards"} title="Cartões" onClick={() => ir({ visao: "cards" }, false)} className={`flex h-10 w-10 items-center justify-center ${filtros.visao === "cards" ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {resposta.ok && resposta.pendenciasDisponiveis && (maquinas
              ? <>{chip("sem_preco", "Sem preço", contagem.sem_preco)}{chip("sem_foto", "Sem foto", contagem.sem_foto)}{chip("ficha_incompleta", "Ficha incompleta", contagem.ficha_incompleta)}</>
              : <>{chip("sem_preco", "Sem preço", contagem.sem_preco)}{chip("sem_vinculo", "Sem equipamento", contagem.sem_vinculo)}</>)}
            {admin && grupoAtual && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {linha && (
                  <>
                    <button type="button" className={botaoPrimario} onClick={() => setNovoEquip(true)}><Plus className="h-4 w-4" />Novo equipamento</button>
                    <button type="button" className={botaoSecundario} onClick={() => setFotoLinha(true)}><Camera className="h-4 w-4" />Foto da linha</button>
                  </>
                )}
                {categoria && <button type="button" className={botaoPrimario} onClick={() => setAlvoPeca({ modo: "criar", categoriaId: categoria.id })}><Plus className="h-4 w-4" />Nova peça</button>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><button type="button" aria-label="Mais opções do grupo" className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><MoreVertical className="h-4 w-4" /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {linha && <DropdownMenuItem className="cursor-pointer" onSelect={() => setTimeout(() => setModelo(true), 0)}><Settings2 /> Modelo da ficha técnica</DropdownMenuItem>}
                    {linha && <DropdownMenuItem asChild className="cursor-pointer"><a href={`/api/produtos/linhas/${linha.id}/exportar`} target="_blank" rel="noreferrer"><Download /> Exportar .docx</a></DropdownMenuItem>}
                    <DropdownMenuItem className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => setTimeout(excluirGrupo, 0)}><Trash2 /> Excluir {maquinas ? "linha" : "categoria"}…</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {admin && !grupoAtual && !maquinas && <button type="button" className={`${botaoPrimario} ml-auto`} onClick={() => setAlvoPeca({ modo: "criar", categoriaId: null })}><Plus className="h-4 w-4" />Nova peça</button>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              {(navegando || pendente) && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Carregando" />}
              {resposta.ok ? `${total} ${total === 1 ? "item" : "itens"}` : ""}
              {grupoAtual ? ` em ${grupoAtual.nome}` : ""}
              {grupoAtual && filtros.q && <button type="button" className="font-medium text-[#2074B9] hover:underline" onClick={() => ir({ escopo: null })}>Buscar em todas</button>}
            </span>
            {filtrando && <Link className="font-medium text-[#2074B9] hover:underline" href={`${pathname}${montarQuery({ aba: filtros.aba, escopo: filtros.escopo, visao: filtros.visao })}`}>Limpar busca e filtros</Link>}
          </div>

          {!resposta.ok ? <Aviso>{resposta.erro}</Aviso> : (
            <>
              {!resposta.pendenciasDisponiveis && <Aviso tipo="info">Os indicadores de pendência e a busca por linha dependem da atualização do banco de produtos (arquivo 034), ainda não aplicada.</Aviso>}
              {resposta.itens.length > 0 ? (
                <ListaProdutos itens={resposta.itens} aba={filtros.aba} visao={filtros.visao} admin={admin} mostrarGrupo={!filtros.escopo}
                  hrefDetalhe={hrefDetalhe} aoAcao={acao} ocupado={pendente} />
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                  <ListChecks className="h-6 w-6" aria-hidden />
                  {filtrando ? "Nenhum produto encontrado com esses filtros." : grupoAtual ? `Nada cadastrado em ${grupoAtual.nome} ainda.` : "Nenhum produto cadastrado."}
                </div>
              )}
              {resposta.total > resposta.tamanho && (
                <nav aria-label="Páginas" className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{(resposta.pagina - 1) * resposta.tamanho + 1}–{Math.min(resposta.pagina * resposta.tamanho, resposta.total)} de {resposta.total}</span>
                  <span className="flex gap-2">
                    <button type="button" disabled={resposta.pagina <= 1 || navegando} onClick={() => ir({ pagina: resposta.pagina - 1 }, false)} className={botaoSecundario}>Anterior</button>
                    <button type="button" disabled={resposta.pagina >= totalPaginas || navegando} onClick={() => ir({ pagina: resposta.pagina + 1 }, false)} className={botaoSecundario}>Próxima</button>
                  </span>
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      {novoEquip && linha && (
        <FormEquipamento linha={{ id: linha.id, nome: linha.nome }} camposFicha={camposFicha.map((c) => c.nome)} aoFechar={() => setNovoEquip(false)}
          aoCriado={(id) => router.push(`/produtos/linhas/${linha.id}/${id}`)} />
      )}
      {fotoLinha && linha && <FotoLinhaModal linha={{ id: linha.id, nome: linha.nome }} aoFechar={() => setFotoLinha(false)} aoConcluir={() => { setFotoLinha(false); router.refresh(); }} />}
      {linha && <ModeloFicha linha={{ id: linha.id, nome: linha.nome }} campos={camposFicha} aberto={modelo} aoFechar={() => setModelo(false)} aoMudou={() => router.refresh()} />}
      <PecaPainel alvo={alvoPeca} categorias={nav.categorias.map((c) => ({ id: c.id, nome: c.nome }))} admin={admin} aoFechar={() => setAlvoPeca(null)} aoMudou={() => router.refresh()} />
      {reajuste && <JanelaReajuste key={JSON.stringify(reajuste.escopo)} alvo={reajuste} aoFechar={() => setReajuste(null)} aoConcluir={() => { setReajuste(null); router.refresh(); }} />}
    </div>
  );
}

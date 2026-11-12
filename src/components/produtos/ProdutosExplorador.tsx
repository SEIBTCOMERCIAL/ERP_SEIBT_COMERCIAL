"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Camera, Download, ListChecks, Loader2, MoreVertical, Plus, Search, Settings2, Trash2 } from "lucide-react";
import {
  alterarSituacao, criarCategoriaPeca, criarLinha, duplicarEquipamento, excluirCategoriaPeca, excluirLinha,
} from "@/app/actions/produtos-admin";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { JanelaReajuste, type AlvoReajuste } from "@/components/reajuste/JanelaReajuste";
import type { ItemLista } from "@/lib/reajuste/tipos";
import { montarQuery, type FiltrosProdutos } from "@/lib/produtos/regras";
import type { Navegacao, ProdutoLista, RespostaListaProdutos } from "@/lib/produtos/tipos";
import { Aviso, botaoPrimario, botaoSecundario, Campo, campoCls, Modal } from "./base";
import { SeletorEscopo } from "@/components/reajuste/SeletorEscopo";
import { MenuFiltros } from "./MenuFiltros";
import { FormEquipamento } from "./FormEquipamento";
import { FotoLinhaModal } from "./FotoLinhaModal";
import { ListaProdutos, type AcaoLista } from "./ListaProdutos";
import { ModeloFicha } from "./ModeloFicha";
import { PecaPainel, type AlvoPeca } from "./PecaPainel";

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
  const [novoGrupoAberto, setNovoGrupoAberto] = useState(false);

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
      else { setNovoGrupo(""); setNovoGrupoAberto(false); setMensagem({ tipo: "sucesso", texto: maquinas ? "Linha criada." : "Categoria criada." }); router.refresh(); }
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

  const total = resposta.ok ? resposta.total : 0;
  const totalPaginas = resposta.ok ? Math.max(1, Math.ceil(resposta.total / resposta.tamanho)) : 1;
  const filtrando = Boolean(filtros.q || filtros.pendencia || filtros.situacao !== "ativos");
  const escopos = (maquinas ? nav.linhas : nav.categorias).map((g) => ({
    id: g.id, nome: g.nome, total: g.contagem.total, sem_reajuste: 0, parcial: 0, atualizado: 0, sem_preco: 0, inativos: 0,
  }));
  const pendenciasTexto = [
    contagem.sem_preco > 0 ? `${contagem.sem_preco} sem preço` : null,
    maquinas && contagem.sem_foto > 0 ? `${contagem.sem_foto} sem foto` : null,
    maquinas && contagem.ficha_incompleta > 0 ? `${contagem.ficha_incompleta} com ficha incompleta` : null,
    !maquinas && contagem.sem_vinculo > 0 ? `${contagem.sem_vinculo} sem equipamento` : null,
  ].filter(Boolean).join(" · ");
  const item = "cursor-pointer";

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Produtos</h1>
        <div role="tablist" aria-label="Tipo de produto" className="inline-flex gap-0.5 rounded-lg border border-border bg-card p-1">
          {(["maquinas", "pecas"] as const).map((a) => (
            <button key={a} type="button" role="tab" aria-selected={filtros.aba === a}
              onClick={() => iniciarNavegacao(() => router.push(`${pathname}${montarQuery({ aba: a, visao: filtros.visao })}`, { scroll: false }))}
              className={`h-9 rounded-md px-4 text-sm font-medium ${filtros.aba === a ? "bg-[#2C4F79] text-white" : "text-muted-foreground hover:text-foreground"}`}>{a === "maquinas" ? "Máquinas" : "Peças"}</button>
          ))}
        </div>
      </header>

      {mensagem && <Aviso tipo={mensagem.tipo === "erro" ? "erro" : "sucesso"}>{mensagem.texto}</Aviso>}
      {avisoEscopo && <Aviso tipo="info">{avisoEscopo}</Aviso>}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produtos" className={`${campoCls} pl-9`}
            placeholder={maquinas ? "Buscar por modelo, código, descrição ou linha" : "Buscar por código, descrição ou categoria"} />
        </div>
        <div className="w-full sm:w-60">
          <SeletorEscopo rotulo={maquinas ? "Linha" : "Categoria"} todos={maquinas ? "Todas as linhas" : "Todas as categorias"} escopos={escopos} selecionado={filtros.escopo}
            aoSelecionar={(id) => ir({ escopo: id, pendencia: "" })} />
        </div>
        <MenuFiltros filtros={filtros} maquinas={maquinas} pendenciasDisponiveis={resposta.ok && resposta.pendenciasDisponiveis} contagem={contagem} aoMudar={(p) => ir(p)} />
        {admin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-muted/50">Ações<MoreVertical className="h-4 w-4" aria-hidden /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {linha && <DropdownMenuItem className={item} onSelect={() => setTimeout(() => setNovoEquip(true), 0)}><Plus /> Novo equipamento</DropdownMenuItem>}
              {!maquinas && <DropdownMenuItem className={item} onSelect={() => setTimeout(() => setAlvoPeca({ modo: "criar", categoriaId: categoria?.id ?? null }), 0)}><Plus /> Nova peça</DropdownMenuItem>}
              {linha && <DropdownMenuItem className={item} onSelect={() => setTimeout(() => setFotoLinha(true), 0)}><Camera /> Foto da linha</DropdownMenuItem>}
              {linha && <DropdownMenuItem className={item} onSelect={() => setTimeout(() => setModelo(true), 0)}><Settings2 /> Modelo da ficha técnica</DropdownMenuItem>}
              {linha && <DropdownMenuItem asChild className={item}><a href={`/api/produtos/linhas/${linha.id}/exportar`} target="_blank" rel="noreferrer"><Download /> Exportar .docx</a></DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem className={item} onSelect={() => setTimeout(() => setNovoGrupoAberto(true), 0)}><Plus /> {maquinas ? "Nova linha" : "Nova categoria"}…</DropdownMenuItem>
              {grupoAtual && <DropdownMenuItem className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => setTimeout(excluirGrupo, 0)}><Trash2 /> Excluir {maquinas ? "linha" : "categoria"}…</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <strong className="mr-auto text-base font-semibold text-foreground">{grupoAtual?.nome ?? (maquinas ? "Todas as linhas" : "Todas as categorias")}</strong>
        <span className="flex items-center gap-1.5" aria-live="polite">
          {(navegando || pendente) && <Loader2 className="h-3 w-3 animate-spin" aria-label="Carregando" />}
          {resposta.ok ? `${total} ${total === 1 ? "item" : "itens"}` : ""}
        </span>
        {pendenciasTexto && resposta.ok && resposta.pendenciasDisponiveis && <span>{pendenciasTexto}</span>}
        {filtrando && <Link className="font-medium text-[#2074B9] hover:underline" href={`${pathname}${montarQuery({ aba: filtros.aba, escopo: filtros.escopo, visao: filtros.visao })}`}>Limpar busca e filtros</Link>}
        {grupoAtual && filtros.q && <button type="button" className="font-medium text-[#2074B9] hover:underline" onClick={() => ir({ escopo: null })}>Buscar em todas</button>}
      </div>

      <section className="flex min-w-0 flex-col gap-3" aria-label="Lista de produtos">
        {!resposta.ok ? <Aviso>{resposta.erro}</Aviso> : (
          <>
            {!resposta.pendenciasDisponiveis && <Aviso tipo="info">Os indicadores de pendência e a busca por linha dependem da atualização do banco de produtos (arquivo 034), ainda não aplicada.</Aviso>}
            {resposta.itens.length > 0 ? (
              <ListaProdutos itens={resposta.itens} aba={filtros.aba} visao="tabela" admin={admin} mostrarGrupo={!filtros.escopo}
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

      {novoGrupoAberto && (
        <Modal titulo={maquinas ? "Nova linha" : "Nova categoria"} aoFechar={() => setNovoGrupoAberto(false)} largura="max-w-md" bloqueado={pendente}>
          <form onSubmit={criarGrupo} className="flex flex-col gap-4 p-5">
            <Campo rotulo={maquinas ? "Nome da linha" : "Nome da categoria"} obrigatorio>
              <input value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} maxLength={80} required className={campoCls} />
            </Campo>
            <div className="flex justify-end gap-2">
              <button type="button" className={botaoSecundario} onClick={() => setNovoGrupoAberto(false)} disabled={pendente}>Cancelar</button>
              <button type="submit" className={botaoPrimario} disabled={pendente || !novoGrupo.trim()}>{pendente ? "Salvando…" : "Criar"}</button>
            </div>
          </form>
        </Modal>
      )}

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

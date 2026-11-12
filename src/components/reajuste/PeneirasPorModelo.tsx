"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { listarPeneirasReajuste } from "@/app/actions/reajuste";
import { SITUACAO_ROTULO } from "@/lib/reajuste/regras";
import type { FiltroSituacao, ItemLista, RespostaPeneiras } from "@/lib/reajuste/tipos";
import { DetalheItem, type Cambio } from "./DetalheItem";
import { JanelaReajuste, type AlvoReajuste } from "./JanelaReajuste";
import { TabelaItens } from "./TabelaItens";

const campo = "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#2074B9]";
const botao = "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40";

/** Peneiras agrupadas pelo modelo de equipamento ao qual estão ligadas, com medidas em ordem numérica. */
export function PeneirasPorModelo({ hoje, cambio }: { hoje: string; cambio: Cambio | null }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Extract<RespostaPeneiras, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [janela, setJanela] = useState<AlvoReajuste | null>(null);
  const [detalhe, setDetalhe] = useState<ItemLista | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setBuscaAplicada(busca); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarPeneirasReajuste({ busca: buscaAplicada, situacao, pagina })
      .then((r) => { if (cancelado) return; setCarregando(false); if (r.ok) { setDados(r); setErro(null); } else setErro(r.erro); })
      .catch(() => { if (!cancelado) { setCarregando(false); setErro("Não foi possível carregar as peneiras. Tente novamente."); } });
    return () => { cancelado = true; };
  }, [buscaAplicada, situacao, pagina, versao]);

  const alternar = (id: string, on: boolean) => setSelecao((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const alternarVarios = (ids: string[], on: boolean) => setSelecao((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const reajustarItem = (i: ItemLista) => setJanela({ escopo: { tipo: "itens", ids: [i.id] }, tipo: "peca", titulo: `${i.codigo} · ${i.descricao}`, item: i });
  const reajustarSelecionadas = () => setJanela({ escopo: { tipo: "itens", ids: Array.from(selecao) }, tipo: "peca", titulo: `${selecao.size} ${selecao.size === 1 ? "peneira selecionada" : "peneiras selecionadas"}` });
  const concluir = () => { setJanela(null); setSelecao(new Set()); setVersao((v) => v + 1); router.refresh(); };
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label="Peneiras por modelo">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar peneiras" placeholder="Buscar por modelo, código, descrição ou furo" className={`${campo} w-full pl-9`} />
        </div>
        <select value={situacao} onChange={(e) => { setSituacao(e.target.value as FiltroSituacao); setPagina(1); }} aria-label="Situação do reajuste" className={campo}>
          <option value="todas">Todas as situações</option>
          {(["sem_reajuste", "parcial", "atualizado", "sem_preco", "inativo"] as const).map((s) => <option key={s} value={s}>{SITUACAO_ROTULO[s]}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={selecao.size === 0} onClick={reajustarSelecionadas} className="inline-flex h-10 items-center rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-40">
          Reajustar selecionadas{selecao.size > 0 ? ` (${selecao.size})` : ""}
        </button>
        {selecao.size > 0 && <button type="button" onClick={() => setSelecao(new Set())} className="text-sm font-medium text-[#2074B9] hover:underline">Limpar seleção</button>}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {dados ? `${dados.produtos} ${dados.produtos === 1 ? "peneira" : "peneiras"}${dados.sem_modelo > 0 ? ` · ${dados.sem_modelo} sem modelo` : ""}` : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Uma peneira ligada a mais de um modelo aparece em cada um deles; ao reajustar, cada peneira é reajustada uma única vez. Medidas em ordem numérica (furo, dimensões e espessura).</p>

      {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>}

      {dados?.grupos.map((g, idx) => (
        <div key={`${g.modelo ?? "sem"}-${idx}`} className="flex flex-col gap-2">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
            {g.modelo ?? "Modelo não definido"}<span className="text-xs font-normal text-muted-foreground">{g.itens.length} {g.itens.length === 1 ? "peneira" : "peneiras"}{g.modelo === null ? " · sem ligação com equipamento, disponíveis para revisão" : ""}</span>
          </h3>
          <TabelaItens itens={g.itens} aba="pecas" visao="tabela" selecao={selecao} mostrarEscopo={false}
            aoAlternar={alternar} aoAlternarPagina={alternarVarios} aoReajustar={reajustarItem} aoDetalhar={setDetalhe} />
        </div>
      ))}
      {dados && dados.grupos.length === 0 && !carregando && !erro && (
        <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma peneira encontrada com esses filtros.</p>
      )}

      {dados && dados.total > dados.tamanho && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{(dados.pagina - 1) * dados.tamanho + 1}–{Math.min(dados.pagina * dados.tamanho, dados.total)} de {dados.total}</span>
          <span className="flex gap-2">
            <button type="button" disabled={dados.pagina <= 1 || carregando} onClick={() => setPagina(dados.pagina - 1)} className={botao}>Anterior</button>
            <button type="button" disabled={dados.pagina >= totalPaginas || carregando} onClick={() => setPagina(dados.pagina + 1)} className={botao}>Próxima</button>
          </span>
        </nav>
      )}

      <DetalheItem item={detalhe} hoje={hoje} cambio={cambio} aoFechar={() => setDetalhe(null)} aoReajustar={(i) => { setDetalhe(null); reajustarItem(i); }} />
      {janela && <JanelaReajuste key={JSON.stringify(janela.escopo)} alvo={janela} aoFechar={() => setJanela(null)} aoConcluir={concluir} />}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { listarPeneirasReajuste } from "@/app/actions/reajuste";
import type { FiltroSituacao, ItemLista, RespostaPeneiras } from "@/lib/reajuste/tipos";
import { BarraSelecao } from "./BarraSelecao";
import { DetalheItem, type Cambio } from "./DetalheItem";
import { JanelaReajuste, type AlvoReajuste } from "./JanelaReajuste";
import type { ResumoVisao } from "./KitsNavalha";
import { TabelaItens } from "./TabelaItens";

const botao = "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40";

/** Peneiras agrupadas pelo modelo de equipamento ao qual estão ligadas, com medidas em ordem numérica. */
export function PeneirasPorModelo({ busca, situacao, hoje, cambio, aoResumo }: {
  busca: string; situacao: FiltroSituacao; hoje: string; cambio: Cambio | null; aoResumo: (r: ResumoVisao) => void;
}) {
  const router = useRouter();
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Extract<RespostaPeneiras, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [janela, setJanela] = useState<AlvoReajuste | null>(null);
  const [detalhe, setDetalhe] = useState<ItemLista | null>(null);

  useEffect(() => { setPagina(1); setSelecao(new Set()); }, [busca, situacao]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarPeneirasReajuste({ busca, situacao, pagina })
      .then((r) => { if (cancelado) return; setCarregando(false); if (r.ok) { setDados(r); setErro(null); } else setErro(r.erro); })
      .catch(() => { if (!cancelado) { setCarregando(false); setErro("Não foi possível carregar as peneiras. Tente novamente."); } });
    return () => { cancelado = true; };
  }, [busca, situacao, pagina, versao]);

  useEffect(() => {
    if (!dados) return;
    aoResumo({
      contagem: `${dados.produtos} ${dados.produtos === 1 ? "peneira" : "peneiras"}`, situacoes: [],
      nota: dados.sem_modelo > 0 ? `${dados.sem_modelo} ${dados.sem_modelo === 1 ? "peneira sem modelo" : "peneiras sem modelo"} (sem vínculo com equipamento)` : undefined,
    });
  }, [dados, aoResumo]);

  const alternar = (id: string, on: boolean) => setSelecao((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const alternarVarios = (ids: string[], on: boolean) => setSelecao((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const reajustarItem = (i: ItemLista) => setJanela({ escopo: { tipo: "itens", ids: [i.id] }, tipo: "peca", titulo: `${i.codigo} · ${i.descricao}`, item: i });
  const concluir = () => { setJanela(null); setDetalhe(null); setSelecao(new Set()); setVersao((v) => v + 1); router.refresh(); };
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Peneiras por modelo">
      {erro && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>}
      {!dados && carregando && <p className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando peneiras…</p>}

      {dados?.grupos.map((g, idx) => (
        <div key={`${g.modelo ?? "sem"}-${idx}`} className="flex flex-col gap-2">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
            {g.modelo ?? "Modelo não definido"}<span className="text-xs font-normal text-muted-foreground">{g.itens.length} {g.itens.length === 1 ? "peneira" : "peneiras"}{g.modelo === null ? " · sem ligação com equipamento, disponíveis para revisão" : ""}</span>
          </h3>
          <TabelaItens itens={g.itens} modo="pecas" selecao={selecao} mostrarEscopo={false} aoAlternar={alternar} aoAlternarPagina={alternarVarios} aoDetalhar={setDetalhe} />
        </div>
      ))}
      {dados && dados.grupos.length === 0 && !carregando && !erro && <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma peneira encontrada com esses filtros.</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Uma peneira ligada a mais de um modelo aparece em cada um; ao reajustar, é reajustada uma única vez</span>
        {dados && dados.total > dados.tamanho && (
          <span className="flex items-center gap-2">
            <span>{(dados.pagina - 1) * dados.tamanho + 1}–{Math.min(dados.pagina * dados.tamanho, dados.total)} de {dados.total}</span>
            <button type="button" disabled={dados.pagina <= 1 || carregando} onClick={() => setPagina(dados.pagina - 1)} className={botao}>Anterior</button>
            <button type="button" disabled={dados.pagina >= totalPaginas || carregando} onClick={() => setPagina(dados.pagina + 1)} className={botao}>Próxima</button>
          </span>
        )}
      </div>

      {selecao.size > 0 && (
        <BarraSelecao texto={`${selecao.size} ${selecao.size === 1 ? "peneira selecionada" : "peneiras selecionadas"}`} aoLimpar={() => setSelecao(new Set())}
          aoReajustar={() => setJanela({ escopo: { tipo: "itens", ids: Array.from(selecao) }, tipo: "peca", titulo: `${selecao.size} ${selecao.size === 1 ? "peneira selecionada" : "peneiras selecionadas"}` })} />
      )}

      <DetalheItem item={detalhe} hoje={hoje} cambio={cambio} aoFechar={() => setDetalhe(null)} aoReajustar={reajustarItem} />
      {janela && <JanelaReajuste key={JSON.stringify(janela.escopo)} alvo={janela} aoFechar={() => setJanela(null)} aoConcluir={concluir} />}
    </section>
  );
}

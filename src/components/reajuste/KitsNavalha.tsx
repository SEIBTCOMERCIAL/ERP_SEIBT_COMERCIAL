"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { listarKitsReajuste } from "@/app/actions/reajuste";
import { PROBLEMA_ROTULO, grupoEntra, planoDeSelecao, type AlcanceKit } from "@/lib/reajuste/kits";
import type { FiltroSituacao, ItemLista, KitLista, RespostaKits } from "@/lib/reajuste/tipos";
import { BarraSelecao } from "./BarraSelecao";
import { DetalheItem, type Cambio } from "./DetalheItem";
import { DetalheKit, rotuloDoKit } from "./DetalheKit";
import { JanelaIpi, type OpcaoAlcanceIpi } from "./JanelaIpi";
import { JanelaReajuste, type AlvoReajuste } from "./JanelaReajuste";
import { SituacaoTexto } from "./SituacaoBadge";
import { TabelaItens } from "./TabelaItens";
import { fmtBRL, fmtPct } from "./formatar";

export interface ResumoVisao { contagem: string; situacoes: Array<{ valor: FiltroSituacao; rotulo: string; n: number }>; nota?: string }

const botao = "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40";
const ROTULO_ALCANCE: Record<AlcanceKit, string> = { ambos: "fixas e rotoras", fixas: "somente fixas", rotoras: "somente rotoras" };
const cab = "bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground";

function Subtotal({ valor, tem }: { valor: number | null; tem: boolean }) {
  if (!tem) return <span className="text-muted-foreground" title="Este kit não tem componentes deste tipo" aria-label="Sem componentes deste tipo">—</span>;
  if (valor === null) return <span className="text-xs font-medium text-amber-700 dark:text-amber-300" title="Falta preço em algum componente">Preço incompleto</span>;
  return <span className="tabular-nums">{fmtBRL(valor)}</span>;
}

function Aliquota({ kit }: { kit: KitLista }) {
  const a = kit.calculo.aliquota;
  if (a === null) return <span className="text-muted-foreground">—</span>;
  if (a === "variavel") return <span className="text-xs font-medium text-amber-700 dark:text-amber-300" title={kit.componentes.map((c) => `${c.codigo}: ${fmtPct(c.ipi, false)}`).join(" · ")}>IPI variável</span>;
  return <span className="tabular-nums text-muted-foreground">{fmtPct(a, false)}</span>;
}

/** Navalhas por kit: tabela ampla; detalhes, histórico e ações individuais ficam no painel lateral. */
export function KitsNavalha({ busca, situacao, hoje, cambio, aoResumo }: {
  busca: string; situacao: FiltroSituacao; hoje: string; cambio: Cambio | null; aoResumo: (r: ResumoVisao) => void;
}) {
  const router = useRouter();
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Extract<RespostaKits, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [selecao, setSelecao] = useState<Map<string, KitLista>>(new Map());
  const [alcance, setAlcance] = useState<AlcanceKit>("ambos");
  const [janela, setJanela] = useState<AlvoReajuste | null>(null);
  const [janelaIpi, setJanelaIpi] = useState<{ titulo: string; opcoes: OpcaoAlcanceIpi[]; ipiAtual: number | null; avisos: string[] } | null>(null);
  const [kitAberto, setKitAberto] = useState<KitLista | null>(null);
  const [itemAberto, setItemAberto] = useState<ItemLista | null>(null);
  const [semKitAberto, setSemKitAberto] = useState(false);
  const [revisaoAberta, setRevisaoAberta] = useState(false);
  const [selSemKit, setSelSemKit] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const [selecionandoTodos, setSelecionandoTodos] = useState(false);

  useEffect(() => { setPagina(1); setSelecao(new Map()); }, [busca, situacao]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarKitsReajuste({ busca, situacao, pagina })
      .then((r) => { if (cancelado) return; setCarregando(false); if (r.ok) { setDados(r); setErro(null); } else setErro(r.erro); })
      .catch(() => { if (!cancelado) { setCarregando(false); setErro("Não foi possível carregar os kits. Tente novamente."); } });
    return () => { cancelado = true; };
  }, [busca, situacao, pagina, versao]);

  useEffect(() => {
    if (!dados) return;
    const r = dados.resumo;
    aoResumo({
      contagem: `${dados.total} ${dados.total === 1 ? "kit" : "kits"}`,
      situacoes: [
        { valor: "sem_reajuste", rotulo: "Sem reajuste", n: r.sem_reajuste }, { valor: "parcial", rotulo: "Parcialmente reajustados", n: r.parcial },
        { valor: "atualizado", rotulo: "Reajustados", n: r.atualizado }, { valor: "sem_preco", rotulo: "Preço incompleto", n: r.sem_preco },
        ...(r.inativos > 0 ? [{ valor: "inativo" as const, rotulo: "Inativos", n: r.inativos }] : []),
      ],
      nota: `${r.kits} ${r.kits === 1 ? "kit" : "kits"} · ${r.pecas} ${r.pecas === 1 ? "peça" : "peças"} nos kits · ${r.sem_kit} ${r.sem_kit === 1 ? "navalha" : "navalhas"} sem kit${r.incompletos ? ` · ${r.incompletos} com preço ou composição incompletos` : ""}`,
    });
  }, [dados, aoResumo]);

  const kits = useMemo(() => dados?.kits ?? [], [dados]);
  const selecionaveis = kits.filter((k) => k.ativo);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((k) => selecao.has(k.id));
  const algum = selecionaveis.some((k) => selecao.has(k.id));
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  const alternar = (k: KitLista, on: boolean) => setSelecao((s) => { const n = new Map(s); if (on) n.set(k.id, k); else n.delete(k.id); return n; });
  const alternarPagina = (on: boolean) => setSelecao((s) => { const n = new Map(s); selecionaveis.forEach((k) => (on ? n.set(k.id, k) : n.delete(k.id))); return n; });

  /** Estende a seleção a todos os kits do filtro atual (todas as páginas), sem tocar em nada fora do filtro. */
  async function selecionarTodosFiltrados() {
    if (!dados) return;
    setSelecionandoTodos(true);
    const novo = new Map(selecao);
    try {
      for (let p = 1; p <= totalPaginas; p++) {
        const r = p === pagina ? dados : await listarKitsReajuste({ busca, situacao, pagina: p });
        if (!r.ok) { setAviso(r.erro); return; }
        r.kits.filter((k) => k.ativo).forEach((k) => novo.set(k.id, k));
      }
      setSelecao(novo);
    } catch { setAviso("Não foi possível selecionar todos os resultados. Tente novamente."); } finally { setSelecionandoTodos(false); }
  }

  function textoImpacto(plano: ReturnType<typeof planoDeSelecao>): string[] {
    if (plano.kitsImpactados.length === 0) return [];
    const lista = plano.kitsImpactados.slice(0, 5).join(", ") + (plano.kitsImpactados.length > 5 ? ` e mais ${plano.kitsImpactados.length - 5}` : "");
    return [`${plano.pecasCompartilhadas} ${plano.pecasCompartilhadas === 1 ? "peça também faz" : "peças também fazem"} parte de ${plano.kitsImpactados.length} ${plano.kitsImpactados.length === 1 ? "kit" : "kits"} fora da seleção (${lista}). A alteração vale para todos eles; cada peça é reajustada uma única vez.`];
  }

  function reajustarKits(lista: KitLista[], alc: AlcanceKit) {
    setAviso(null);
    const plano = planoDeSelecao(lista, alc);
    if (plano.produtoIds.length === 0) { setAviso(`Nenhum componente ativo em ${ROTULO_ALCANCE[alc]} nesta seleção.`); return; }
    setJanela({
      escopo: { tipo: "itens", ids: plano.produtoIds }, tipo: "peca",
      titulo: `${lista.length === 1 ? rotuloDoKit(lista[0]) : `${lista.length} kits`} · ${ROTULO_ALCANCE[alc]} · ${plano.produtoIds.length} ${plano.produtoIds.length === 1 ? "peça" : "peças"}`,
      avisos: textoImpacto(plano),
    });
  }

  function ipiKits(lista: KitLista[]) {
    setAviso(null);
    const opcoes: OpcaoAlcanceIpi[] = [];
    for (const alc of ["ambos", "fixas", "rotoras"] as AlcanceKit[]) {
      const ids = Array.from(new Set(lista.flatMap((k) => k.componentes.filter((c) => grupoEntra(c.grupo, alc)).map((c) => c.produtoId))));
      if (ids.length > 0) opcoes.push({ id: alc, rotulo: alc === "ambos" ? "Todos os componentes" : alc === "fixas" ? "Somente as fixas" : "Somente as rotoras", produtoIds: ids });
    }
    if (opcoes.length === 0) { setAviso("Esta seleção não tem componentes."); return; }
    const todos = planoDeSelecao(lista.map((k) => ({ ...k, componentes: k.componentes.map((c) => ({ ...c, ativo: true })) })), "ambos");
    const aliquotas = new Set(lista.flatMap((k) => k.componentes.map((c) => c.ipi)));
    setJanelaIpi({ titulo: lista.length === 1 ? rotuloDoKit(lista[0]) : `${lista.length} kits`, opcoes, ipiAtual: aliquotas.size === 1 ? Array.from(aliquotas)[0] : null, avisos: textoImpacto(todos) });
  }

  const ipiPeca = (i: ItemLista, titulo: string) => { setAviso(null); setJanelaIpi({ titulo, opcoes: [{ id: "uma", rotulo: `${i.codigo} · ${i.descricao}`, produtoIds: [i.id] }], ipiAtual: i.ipi_pct, avisos: [] }); };
  const reajustarPeca = (i: ItemLista) => setJanela({ escopo: { tipo: "itens", ids: [i.id] }, tipo: "peca", titulo: `${i.codigo} · ${i.descricao}`, item: i });
  const ipiSemKit = () => { const ids = Array.from(selSemKit); setJanelaIpi({ titulo: `${ids.length} ${ids.length === 1 ? "navalha sem kit" : "navalhas sem kit"}`, opcoes: [{ id: "sel", rotulo: "Navalhas selecionadas", produtoIds: ids }], ipiAtual: null, avisos: [] }); };
  const concluir = () => { setJanela(null); setJanelaIpi(null); setKitAberto(null); setItemAberto(null); setSelecao(new Map()); setSelSemKit(new Set()); setVersao((v) => v + 1); router.refresh(); };

  const cabecalhoCheck = (
    <input type="checkbox" className="h-4 w-4 accent-[#2C4F79]" checked={todosMarcados} ref={(el) => { if (el) el.indeterminate = algum && !todosMarcados; }}
      onChange={(e) => alternarPagina(e.target.checked)} aria-label="Selecionar todos os kits exibidos nesta página" />
  );

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Kits de navalhas">
      {(erro || aviso) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{erro ?? aviso}</p>}

      {dados && kits.length > 0 && (
        <div className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm" aria-label="Kits de navalhas">
            <thead className="sticky top-0 z-10 text-left">
              <tr>
                <th scope="col" className={`${cab} w-10 pl-4`}>{cabecalhoCheck}</th>
                <th scope="col" className={cab}>Modelo / kit</th>
                <th scope="col" className={`${cab} text-right`}>Fixas</th>
                <th scope="col" className={`${cab} text-right`}>Rotoras</th>
                <th scope="col" className={`${cab} text-right`}>IPI</th>
                <th scope="col" className={`${cab} text-right`}>Total com IPI</th>
                <th scope="col" className={cab}>Situação</th>
                <th scope="col" className={`${cab} w-10`}><span className="sr-only">Detalhes</span></th>
              </tr>
            </thead>
            <tbody>
              {kits.map((k) => {
                const marcado = selecao.has(k.id);
                const complemento = [k.variante, k.calculo.temOutro ? "tipo de componente indefinido" : null, !k.ativo ? "inativo" : null].filter(Boolean).join(" · ");
                return (
                  <tr key={k.id} className={`border-t border-border/70 ${marcado ? "bg-[#edf3fa] dark:bg-[#2a3c52]" : "hover:bg-muted/40"} ${!k.ativo ? "opacity-60" : ""}`}>
                    <td className="py-3.5 pl-4 pr-1"><input type="checkbox" className="h-4 w-4 accent-[#2C4F79]" checked={marcado} disabled={!k.ativo} onChange={(e) => alternar(k, e.target.checked)} aria-label={`Selecionar kit ${rotuloDoKit(k)}`} /></td>
                    <td className="max-w-[22rem] px-3 py-3.5">
                      <button type="button" onClick={() => setKitAberto(k)} className="block max-w-full text-left"><span className="block truncate font-medium text-foreground hover:underline">{k.modelo}</span></button>
                      {complemento && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{complemento}</span>}
                    </td>
                    <td className="px-3 py-3.5 text-right"><Subtotal valor={k.calculo.subtotalFixas} tem={k.calculo.temFixa} /></td>
                    <td className="px-3 py-3.5 text-right"><Subtotal valor={k.calculo.subtotalRotoras} tem={k.calculo.temRotora} /></td>
                    <td className="px-3 py-3.5 text-right"><Aliquota kit={k} /></td>
                    <td className="px-3 py-3.5 text-right">
                      {k.calculo.total !== null
                        ? <span className="font-semibold tabular-nums text-foreground">{fmtBRL(k.calculo.total)}</span>
                        : <span className="text-xs font-medium text-amber-700 dark:text-amber-300" title="Falta preço ou quantidade: o total não é exibido para não passar um valor parcial como completo">{PROBLEMA_ROTULO[k.calculo.problemas[0] ?? "sem_componentes"]}</span>}
                    </td>
                    <td className="px-3 py-3.5"><SituacaoTexto situacao={k.situacao} rotulo={k.situacao === "sem_preco" ? "Preço incompleto" : undefined} /></td>
                    <td className="py-3.5 pr-3"><button type="button" onClick={() => setKitAberto(k)} aria-label={`Ver detalhes do kit ${rotuloDoKit(k)}`} title="Composição, histórico e ações" className="flex h-8 w-8 items-center justify-center rounded-md text-[#2C4F79] hover:bg-muted dark:text-[#85acd9]"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {dados && kits.length === 0 && !carregando && !erro && <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhum kit encontrado com esses filtros.</p>}
      {!dados && carregando && <p className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando kits…</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Fixas e rotoras: subtotais sem IPI · o total inclui o IPI de cada peça</span>
        {dados && dados.total > dados.tamanho && (
          <span className="flex items-center gap-2">
            <span>{(dados.pagina - 1) * dados.tamanho + 1}–{Math.min(dados.pagina * dados.tamanho, dados.total)} de {dados.total}</span>
            <button type="button" disabled={dados.pagina <= 1 || carregando} onClick={() => setPagina(dados.pagina - 1)} className={botao}>Anterior</button>
            <button type="button" disabled={dados.pagina >= totalPaginas || carregando} onClick={() => setPagina(dados.pagina + 1)} className={botao}>Próxima</button>
          </span>
        )}
      </div>

      {selecao.size > 0 && (
        <BarraSelecao texto={`${selecao.size} ${selecao.size === 1 ? "kit selecionado" : "kits selecionados"}${selecionandoTodos ? " · selecionando…" : ""}`}
          filtrados={dados && dados.total > 1 ? { total: dados.total, selecionados: selecao.size, aoSelecionarTodos: selecionarTodosFiltrados } : undefined}
          aoLimpar={() => setSelecao(new Map())} aoReajustar={() => reajustarKits(Array.from(selecao.values()), alcance)} aoIpi={() => ipiKits(Array.from(selecao.values()))}>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">Reajustar
            <select value={alcance} onChange={(e) => setAlcance(e.target.value as AlcanceKit)} aria-label="Componentes a reajustar" className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground">
              <option value="ambos">Fixas e rotoras</option><option value="fixas">Somente fixas</option><option value="rotoras">Somente rotoras</option>
            </select>
          </label>
        </BarraSelecao>
      )}

      {dados && (
        <div className="rounded-xl border border-border bg-card">
          <button type="button" onClick={() => setSemKitAberto(!semKitAberto)} aria-expanded={semKitAberto} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground">
            <span>Sem kit definido <span className="font-normal text-muted-foreground">({dados.semKit.length})</span></span>
            {semKitAberto ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
          {semKitAberto && (
            <div className="flex flex-col gap-3 border-t border-border p-3">
              <p className="text-xs text-muted-foreground">Navalhas que não fazem parte de nenhum kit. Seguem disponíveis para consulta e reajuste individual; nenhuma composição é presumida.</p>
              {dados.semKit.length > 0 ? (
                <TabelaItens itens={dados.semKit} modo="pecas" selecao={selSemKit} mostrarEscopo={false} cabecalhoFixo
                  aoAlternar={(id, on) => setSelSemKit((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; })}
                  aoAlternarPagina={(ids, on) => setSelSemKit((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; })}
                  aoDetalhar={setItemAberto} />
              ) : <p className="text-sm text-muted-foreground">Todas as navalhas já fazem parte de algum kit.</p>}
              {selSemKit.size > 0 && (
                <BarraSelecao texto={`${selSemKit.size} ${selSemKit.size === 1 ? "navalha selecionada" : "navalhas selecionadas"}`} aoLimpar={() => setSelSemKit(new Set())}
                  aoReajustar={() => setJanela({ escopo: { tipo: "itens", ids: Array.from(selSemKit) }, tipo: "peca", titulo: `${selSemKit.size} ${selSemKit.size === 1 ? "navalha sem kit" : "navalhas sem kit"}` })} aoIpi={ipiSemKit} />
              )}
            </div>
          )}
        </div>
      )}

      {dados && dados.revisao.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <button type="button" onClick={() => setRevisaoAberta(!revisaoAberta)} aria-expanded={revisaoAberta} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-amber-900 dark:text-amber-200">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Cadastros para revisão ({dados.revisao.length})</span>
            {revisaoAberta ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
          {revisaoAberta && <ul className="border-t border-amber-300 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:text-amber-200">{dados.revisao.map((r) => <li key={r.produtoId}><span className="font-mono">{r.codigo}</span> · {r.descricao} — {r.motivo}</li>)}</ul>}
        </div>
      )}

      <DetalheKit kit={kitAberto} aoFechar={() => setKitAberto(null)} aoReajustarKit={(k, a) => reajustarKits([k], a)} aoIpiKit={(k) => ipiKits([k])} aoReajustarPeca={reajustarPeca} aoIpiPeca={ipiPeca} />
      <DetalheItem item={itemAberto} hoje={hoje} cambio={cambio} aoFechar={() => setItemAberto(null)} aoReajustar={reajustarPeca} aoIpi={(i) => ipiPeca(i, i.codigo)} />
      {janela && <JanelaReajuste key={JSON.stringify(janela.escopo)} alvo={janela} aoFechar={() => setJanela(null)} aoConcluir={concluir} />}
      {janelaIpi && <JanelaIpi key={janelaIpi.opcoes.map((o) => o.id + o.produtoIds.length).join("|") + janelaIpi.titulo} titulo={janelaIpi.titulo} opcoes={janelaIpi.opcoes} ipiAtual={janelaIpi.ipiAtual} avisos={janelaIpi.avisos} aoFechar={() => setJanelaIpi(null)} aoConcluir={concluir} />}
    </section>
  );
}

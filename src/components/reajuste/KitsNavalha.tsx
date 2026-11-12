"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, History, Loader2, Percent, Pencil, Search } from "lucide-react";
import { listarKitsReajuste } from "@/app/actions/reajuste";
import { SITUACAO_ROTULO } from "@/lib/reajuste/regras";
import {
  PROBLEMA_ROTULO, grupoEntra, planoDeSelecao, type AlcanceKit, type GrupoComponente,
} from "@/lib/reajuste/kits";
import type { FiltroSituacao, ItemLista, KitLista, RespostaKits } from "@/lib/reajuste/tipos";
import { DetalheItem, type Cambio } from "./DetalheItem";
import { JanelaIpi, type OpcaoAlcanceIpi } from "./JanelaIpi";
import { JanelaReajuste, type AlvoReajuste } from "./JanelaReajuste";
import { SituacaoBadge } from "./SituacaoBadge";
import { TabelaItens } from "./TabelaItens";
import { fmtBRL, fmtPct, formatarData } from "./formatar";

const campo = "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#2074B9]";
const botao = "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40";
const botaoIcone = "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";
const ROTULO_GRUPO: Record<GrupoComponente, string> = { fixa: "Fixa", rotora: "Rotora", outro: "Tipo indefinido" };
const ROTULO_ALCANCE: Record<AlcanceKit, string> = { ambos: "fixas e rotoras", fixas: "somente fixas", rotoras: "somente rotoras" };

const rotuloKit = (k: Pick<KitLista, "modelo" | "variante">) => (k.variante ? `${k.modelo} · ${k.variante}` : k.modelo);

function Subtotal({ valor, tem, titulo }: { valor: number | null; tem: boolean; titulo: string }) {
  if (!tem) return <span className="text-muted-foreground" title="Este kit não tem componentes deste tipo">—</span>;
  if (valor === null) return <span className="text-xs font-medium text-amber-700 dark:text-amber-300" title={titulo}>Preço incompleto</span>;
  return <span className="tabular-nums">{fmtBRL(valor)}</span>;
}

function Aliquota({ kit }: { kit: KitLista }) {
  const a = kit.calculo.aliquota;
  if (a === null) return <span className="text-muted-foreground">—</span>;
  if (a === "variavel") {
    const porGrupo = kit.componentes.map((c) => `${c.codigo}: ${fmtPct(c.ipi, false)}`).join(" · ");
    return <span className="text-xs font-medium text-amber-700 dark:text-amber-300" title={porGrupo}>IPI variável</span>;
  }
  return <span className="tabular-nums text-muted-foreground">{fmtPct(a, false)}</span>;
}

function TotalKit({ kit }: { kit: KitLista }) {
  if (kit.calculo.total !== null) return <span className="font-semibold tabular-nums text-foreground">{fmtBRL(kit.calculo.total)}</span>;
  return <span className="text-xs font-medium text-amber-700 dark:text-amber-300" title="Falta preço ou quantidade: o total não é exibido para não passar um valor parcial como completo">{PROBLEMA_ROTULO[kit.calculo.problemas[0] ?? "sem_componentes"]}</span>;
}

function UltimoKit({ kit }: { kit: KitLista }) {
  if (!kit.ultimo) return <span className="text-muted-foreground">Nunca</span>;
  return (
    <span className="flex flex-col leading-tight" title="Data do reajuste de preço-base mais recente entre as peças do kit (alterar só o IPI não conta)">
      <span>{formatarData(kit.ultimo.data)}</span>
      <span className="text-xs text-muted-foreground">{kit.ultimo.reajustados} de {kit.pecasUnicas} {kit.pecasUnicas === 1 ? "peça" : "peças"}</span>
    </span>
  );
}

function Alertas({ kit }: { kit: KitLista }) {
  const itens: string[] = [];
  if (kit.calculo.temOutro) itens.push("Há componente sem tipo definido (fixa ou rotora): revise o cadastro");
  const compartilhadas = kit.componentes.filter((c) => c.compartilhadoCom.length > 0).length;
  if (compartilhadas > 0) itens.push(`${compartilhadas} ${compartilhadas === 1 ? "peça é compartilhada" : "peças são compartilhadas"} com outros kits`);
  if (itens.length === 0) return null;
  return <span className="mt-0.5 block text-xs text-muted-foreground">{itens.join(" · ")}</span>;
}

export function KitsNavalha({ hoje, cambio }: { hoje: string; cambio: Cambio | null }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Extract<RespostaKits, { ok: true }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [selecao, setSelecao] = useState<Map<string, KitLista>>(new Map());
  const [alcance, setAlcance] = useState<AlcanceKit>("ambos");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [janela, setJanela] = useState<AlvoReajuste | null>(null);
  const [janelaIpi, setJanelaIpi] = useState<{ titulo: string; opcoes: OpcaoAlcanceIpi[]; ipiAtual: number | null; avisos: string[] } | null>(null);
  const [detalhe, setDetalhe] = useState<ItemLista | null>(null);
  const [semKitAberto, setSemKitAberto] = useState(false);
  const [revisaoAberta, setRevisaoAberta] = useState(false);
  const [selSemKit, setSelSemKit] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setBuscaAplicada(busca); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarKitsReajuste({ busca: buscaAplicada, situacao, pagina })
      .then((r) => { if (cancelado) return; setCarregando(false); if (r.ok) { setDados(r); setErro(null); } else setErro(r.erro); })
      .catch(() => { if (!cancelado) { setCarregando(false); setErro("Não foi possível carregar os kits. Tente novamente."); } });
    return () => { cancelado = true; };
  }, [buscaAplicada, situacao, pagina, versao]);

  const kitsDaPagina = useMemo(() => dados?.kits ?? [], [dados]);
  const selecionaveis = kitsDaPagina.filter((k) => k.ativo);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((k) => selecao.has(k.id));
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  const alternar = (k: KitLista, ligado: boolean) => setSelecao((s) => { const n = new Map(s); if (ligado) n.set(k.id, k); else n.delete(k.id); return n; });
  const alternarPagina = (ligado: boolean) => setSelecao((s) => { const n = new Map(s); selecionaveis.forEach((k) => (ligado ? n.set(k.id, k) : n.delete(k.id))); return n; });
  const alternarAberto = (id: string) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function textoImpacto(plano: ReturnType<typeof planoDeSelecao>): string[] {
    if (plano.kitsImpactados.length === 0) return [];
    const lista = plano.kitsImpactados.slice(0, 5).join(", ") + (plano.kitsImpactados.length > 5 ? ` e mais ${plano.kitsImpactados.length - 5}` : "");
    return [`${plano.pecasCompartilhadas} ${plano.pecasCompartilhadas === 1 ? "peça também faz" : "peças também fazem"} parte de ${plano.kitsImpactados.length} ${plano.kitsImpactados.length === 1 ? "kit" : "kits"} fora da seleção (${lista}). A alteração vale para todos eles; cada peça é reajustada uma única vez.`];
  }

  function reajustarKits(kits: KitLista[], alc: AlcanceKit) {
    setAviso(null);
    const plano = planoDeSelecao(kits, alc);
    if (plano.produtoIds.length === 0) { setAviso(`Nenhum componente ativo em ${ROTULO_ALCANCE[alc]} nesta seleção.`); return; }
    const nomes = kits.length === 1 ? rotuloKit(kits[0]) : `${kits.length} kits`;
    setJanela({
      escopo: { tipo: "itens", ids: plano.produtoIds }, tipo: "peca",
      titulo: `${nomes} · ${ROTULO_ALCANCE[alc]} · ${plano.produtoIds.length} ${plano.produtoIds.length === 1 ? "peça" : "peças"}`,
      avisos: textoImpacto(plano),
    });
  }

  function ipiKits(kits: KitLista[]) {
    setAviso(null);
    const opcoes: OpcaoAlcanceIpi[] = [];
    for (const alc of ["ambos", "fixas", "rotoras"] as AlcanceKit[]) {
      const ids = Array.from(new Set(kits.flatMap((k) => k.componentes.filter((c) => grupoEntra(c.grupo, alc)).map((c) => c.produtoId))));
      if (ids.length > 0) opcoes.push({ id: alc, rotulo: alc === "ambos" ? "Todos os componentes" : alc === "fixas" ? "Somente as fixas" : "Somente as rotoras", produtoIds: ids });
    }
    if (opcoes.length === 0) { setAviso("Esta seleção não tem componentes."); return; }
    const todos = planoDeSelecao(kits.map((k) => ({ ...k, componentes: k.componentes.map((c) => ({ ...c, ativo: true })) })), "ambos");
    const aliquotas = new Set(kits.flatMap((k) => k.componentes.map((c) => c.ipi)));
    setJanelaIpi({
      titulo: kits.length === 1 ? rotuloKit(kits[0]) : `${kits.length} kits`, opcoes,
      ipiAtual: aliquotas.size === 1 ? Array.from(aliquotas)[0] : null, avisos: textoImpacto(todos),
    });
  }

  const ipiPeca = (i: ItemLista, titulo: string) => { setAviso(null); setJanelaIpi({ titulo, opcoes: [{ id: "uma", rotulo: `${i.codigo} · ${i.descricao}`, produtoIds: [i.id] }], ipiAtual: i.ipi_pct, avisos: [] }); };
  const reajustarPeca = (i: ItemLista) => setJanela({ escopo: { tipo: "itens", ids: [i.id] }, tipo: "peca", titulo: `${i.codigo} · ${i.descricao}`, item: i });
  const ipiSemKit = () => {
    const ids = Array.from(selSemKit);
    setJanelaIpi({ titulo: `${ids.length} ${ids.length === 1 ? "navalha sem kit" : "navalhas sem kit"}`, opcoes: [{ id: "sel", rotulo: "Navalhas selecionadas", produtoIds: ids }], ipiAtual: null, avisos: [] });
  };
  const concluir = () => { setJanela(null); setJanelaIpi(null); setSelecao(new Map()); setSelSemKit(new Set()); setVersao((v) => v + 1); router.refresh(); };

  const resumo = dados?.resumo;
  const chip = (valor: FiltroSituacao, nome: string, n: number, alerta = false) => (
    <button key={valor} type="button" onClick={() => { setSituacao(situacao === valor ? "todas" : valor); setPagina(1); }} aria-pressed={situacao === valor}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${situacao === valor ? "border-[#2C4F79] bg-[#2C4F79] text-white" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
      {nome}<span className={`font-semibold ${situacao !== valor && alerta && n > 0 ? "text-amber-700 dark:text-amber-300" : ""}`}>{n}</span>
    </button>
  );

  const detalhesKit = (k: KitLista) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 font-semibold">Componente</th><th className="px-2 py-1.5 font-semibold">Código</th>
            <th className="px-2 py-1.5 text-right font-semibold">Qtd.</th><th className="px-2 py-1.5 text-right font-semibold">Unitário</th>
            <th className="px-2 py-1.5 text-right font-semibold">Subtotal s/ IPI</th><th className="px-2 py-1.5 text-right font-semibold">IPI</th>
            <th className="px-2 py-1.5 font-semibold">Último reajuste</th><th className="px-2 py-1.5 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {k.componentes.map((c) => (
            <tr key={c.linhaId} className="border-t border-border/60 align-top">
              <td className="px-2 py-1.5">
                <span className="block text-foreground">{c.titulo}</span>
                <span className="text-muted-foreground">{ROTULO_GRUPO[c.grupo]}{!c.ativo ? " · inativa" : ""}{c.compartilhadoCom.length > 0 ? ` · também em ${c.compartilhadoCom.length} ${c.compartilhadoCom.length === 1 ? "kit" : "kits"}` : ""}</span>
              </td>
              <td className="px-2 py-1.5 font-mono text-muted-foreground">{c.codigo}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{c.pecas}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{c.precoUnit === null ? <span className="text-amber-700 dark:text-amber-300">sem preço</span> : fmtBRL(c.precoUnit)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{c.subtotal === null ? "—" : fmtBRL(c.subtotal)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtPct(c.ipi, false)}</td>
              <td className="px-2 py-1.5">
                {c.item.ultimo ? <span>{formatarData(c.item.ultimo.data)} <span className="text-muted-foreground">{fmtPct(c.item.ultimo.percentual)}</span></span> : <span className="text-muted-foreground">Nunca</span>}
              </td>
              <td className="px-2 py-1.5">
                <span className="flex justify-end gap-1">
                  <button type="button" className={botaoIcone} disabled={!c.ativo} onClick={() => reajustarPeca(c.item)} aria-label={`Reajustar ${c.codigoProduto}`} title="Reajustar só esta peça"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" className={botaoIcone} onClick={() => ipiPeca(c.item, rotuloKit(k))} aria-label={`Alterar IPI de ${c.codigoProduto}`} title="Alterar o IPI desta peça"><Percent className="h-3.5 w-3.5" /></button>
                  <button type="button" className={botaoIcone} onClick={() => setDetalhe(c.item)} aria-label={`Histórico de ${c.codigoProduto}`} title="Ver histórico"><History className="h-3.5 w-3.5" /></button>
                </span>
              </td>
            </tr>
          ))}
          {k.componentes.length === 0 && <tr><td colSpan={8} className="px-2 py-3 text-muted-foreground">Este kit ainda não tem componentes cadastrados.</td></tr>}
        </tbody>
      </table>
      {k.componentes.some((c) => c.compartilhadoCom.length > 0) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Peças compartilhadas: {Array.from(new Map(k.componentes.filter((c) => c.compartilhadoCom.length > 0).map((c) => [c.produtoId, `${c.codigoProduto} → ${c.compartilhadoCom.slice(0, 4).map((o) => o.rotulo).join(", ")}${c.compartilhadoCom.length > 4 ? "…" : ""}`])).values()).join(" · ")}
        </p>
      )}
    </div>
  );

  const acoesKit = (k: KitLista) => (
    <span className="flex items-center justify-end gap-1">
      <button type="button" className={botaoIcone} disabled={!k.ativo} onClick={() => reajustarKits([k], alcance)} aria-label={`Reajustar kit ${rotuloKit(k)}`} title={`Reajustar este kit (${ROTULO_ALCANCE[alcance]})`}><Pencil className="h-3.5 w-3.5" />Reajustar</button>
      <button type="button" className={botaoIcone} onClick={() => ipiKits([k])} aria-label={`Alterar IPI do kit ${rotuloKit(k)}`} title="Alterar o IPI (alcance explícito)"><Percent className="h-3.5 w-3.5" />IPI</button>
    </span>
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label="Kits de navalhas">
      <div className="flex flex-wrap items-center gap-2" aria-label="Resumo e filtro por situação">
        {chip("todas", "Todos os kits", resumo?.kits ?? 0)}
        {chip("sem_reajuste", SITUACAO_ROTULO.sem_reajuste, resumo?.sem_reajuste ?? 0, true)}
        {chip("parcial", SITUACAO_ROTULO.parcial, resumo?.parcial ?? 0, true)}
        {chip("atualizado", SITUACAO_ROTULO.atualizado, resumo?.atualizado ?? 0)}
        {chip("sem_preco", "Preço incompleto", resumo?.sem_preco ?? 0)}
        {(resumo?.inativos ?? 0) > 0 && chip("inativo", SITUACAO_ROTULO.inativo, resumo?.inativos ?? 0)}
        {resumo && <span className="ml-1 text-xs text-muted-foreground">{resumo.kits} {resumo.kits === 1 ? "kit" : "kits"} · {resumo.pecas} {resumo.pecas === 1 ? "peça" : "peças"} nos kits · {resumo.sem_kit} sem kit</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar kits" placeholder="Buscar por modelo, código, material ou descrição" className={`${campo} w-full pl-9`} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Reajustar
          <select value={alcance} onChange={(e) => setAlcance(e.target.value as AlcanceKit)} aria-label="Componentes a reajustar" className={campo}>
            <option value="ambos">Fixas e rotoras</option><option value="fixas">Somente fixas</option><option value="rotoras">Somente rotoras</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={selecao.size === 0} onClick={() => reajustarKits(Array.from(selecao.values()), alcance)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-40">
          Reajustar kits selecionados{selecao.size > 0 ? ` (${selecao.size})` : ""}
        </button>
        <button type="button" disabled={selecao.size === 0} onClick={() => ipiKits(Array.from(selecao.values()))} className={botao}><Percent className="h-4 w-4" />Alterar IPI</button>
        {selecao.size > 0 && <button type="button" onClick={() => setSelecao(new Map())} className="text-sm font-medium text-[#2074B9] hover:underline">Limpar seleção</button>}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">{carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{dados ? `${dados.total} ${dados.total === 1 ? "kit" : "kits"}` : ""}</span>
      </div>

      <p className="text-xs text-muted-foreground">“Valor fixa” e “Valor rotora” mostram o subtotal do grupo (quantidade × valor unitário), sem IPI. O total do conjunto soma os subtotais e o IPI de cada peça. Os valores unitários aparecem ao expandir a linha.</p>

      {(erro || aviso) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{erro ?? aviso}</p>}

      {dados && kitsDaPagina.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2"><input type="checkbox" className="h-4 w-4" checked={todosMarcados} onChange={(e) => alternarPagina(e.target.checked)} aria-label="Selecionar todos os kits desta página" /></th>
                  <th className="px-3 py-2 font-semibold">Descrição / modelo</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor fixa</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor rotora</th>
                  <th className="px-3 py-2 text-right font-semibold">IPI</th>
                  <th className="px-3 py-2 text-right font-semibold">Total do conjunto com IPI</th>
                  <th className="px-3 py-2 font-semibold">Último reajuste</th>
                  <th className="px-3 py-2 font-semibold">Situação</th>
                  <th className="px-3 py-2 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {kitsDaPagina.map((k) => {
                  const aberto = abertos.has(k.id);
                  return (
                    <Fragment key={k.id}>
                      <tr className={`border-t border-border ${selecao.has(k.id) ? "bg-[#2074B9]/5" : ""} ${!k.ativo ? "opacity-60" : ""}`}>
                        <td className="px-3 py-2"><input type="checkbox" className="h-4 w-4" checked={selecao.has(k.id)} disabled={!k.ativo} onChange={(e) => alternar(k, e.target.checked)} aria-label={`Selecionar kit ${rotuloKit(k)}`} /></td>
                        <td className="max-w-[20rem] px-3 py-2">
                          <button type="button" onClick={() => alternarAberto(k.id)} aria-expanded={aberto} className="flex items-start gap-1.5 text-left">
                            {aberto ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
                            <span className="min-w-0"><span className="block font-medium text-foreground">{k.modelo}</span>{k.variante && <span className="block text-xs text-muted-foreground">{k.variante}</span>}<Alertas kit={k} /></span>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right"><Subtotal valor={k.calculo.subtotalFixas} tem={k.calculo.temFixa} titulo="Falta preço em alguma navalha fixa" /></td>
                        <td className="px-3 py-2 text-right"><Subtotal valor={k.calculo.subtotalRotoras} tem={k.calculo.temRotora} titulo="Falta preço em alguma navalha rotora" /></td>
                        <td className="px-3 py-2 text-right"><Aliquota kit={k} /></td>
                        <td className="px-3 py-2 text-right"><TotalKit kit={k} /></td>
                        <td className="px-3 py-2"><UltimoKit kit={k} /></td>
                        <td className="px-3 py-2"><SituacaoBadge situacao={k.situacao} /></td>
                        <td className="px-3 py-2">{acoesKit(k)}</td>
                      </tr>
                      {aberto && <tr className="border-t border-border bg-muted/30"><td /><td colSpan={8} className="px-3 py-3">{detalhesKit(k)}</td></tr>}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {kitsDaPagina.map((k) => (
              <li key={k.id} className={`flex flex-col gap-3 rounded-xl border bg-card p-3 ${selecao.has(k.id) ? "border-[#2074B9]" : "border-border"} ${!k.ativo ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={selecao.has(k.id)} disabled={!k.ativo} onChange={(e) => alternar(k, e.target.checked)} aria-label={`Selecionar kit ${rotuloKit(k)}`} />
                  <div className="min-w-0 flex-1"><p className="font-medium text-foreground">{k.modelo}</p>{k.variante && <p className="text-xs text-muted-foreground">{k.variante}</p>}<Alertas kit={k} /></div>
                  <SituacaoBadge situacao={k.situacao} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Valor fixa (s/ IPI)</dt><dd><Subtotal valor={k.calculo.subtotalFixas} tem={k.calculo.temFixa} titulo="Falta preço" /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">Valor rotora (s/ IPI)</dt><dd><Subtotal valor={k.calculo.subtotalRotoras} tem={k.calculo.temRotora} titulo="Falta preço" /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">IPI</dt><dd><Aliquota kit={k} /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">Total com IPI</dt><dd><TotalKit kit={k} /></dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">Último reajuste</dt><dd><UltimoKit kit={k} /></dd></div>
                </dl>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => alternarAberto(k.id)} aria-expanded={abertos.has(k.id)} className="inline-flex items-center gap-1 text-sm font-medium text-[#2074B9]">{abertos.has(k.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Componentes</button>
                  {acoesKit(k)}
                </div>
                {abertos.has(k.id) && detalhesKit(k)}
              </li>
            ))}
          </ul>
        </>
      )}
      {dados && kitsDaPagina.length === 0 && !carregando && !erro && (
        <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhum kit encontrado com esses filtros.</p>
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

      {dados && (
        <div className="rounded-xl border border-border bg-card">
          <button type="button" onClick={() => setSemKitAberto(!semKitAberto)} aria-expanded={semKitAberto} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground">
            <span>Sem kit definido <span className="font-normal text-muted-foreground">({dados.semKit.length})</span></span>
            {semKitAberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {semKitAberto && (
            <div className="flex flex-col gap-3 border-t border-border p-3">
              <p className="text-xs text-muted-foreground">Navalhas que ainda não fazem parte de nenhum kit. Continuam disponíveis para consulta e reajuste individual; nenhuma composição é presumida.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={selSemKit.size === 0} onClick={() => setJanela({ escopo: { tipo: "itens", ids: Array.from(selSemKit) }, tipo: "peca", titulo: `${selSemKit.size} ${selSemKit.size === 1 ? "navalha sem kit" : "navalhas sem kit"}` })}
                  className="inline-flex h-10 items-center rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-40">Reajustar selecionadas{selSemKit.size > 0 ? ` (${selSemKit.size})` : ""}</button>
                <button type="button" disabled={selSemKit.size === 0} onClick={ipiSemKit} className={botao}><Percent className="h-4 w-4" />Alterar IPI</button>
              </div>
              {dados.semKit.length > 0 ? (
                <TabelaItens itens={dados.semKit} aba="pecas" visao="tabela" selecao={selSemKit} mostrarEscopo={false}
                  aoAlternar={(id, on) => setSelSemKit((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; })}
                  aoAlternarPagina={(ids, on) => setSelSemKit((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; })}
                  aoReajustar={reajustarPeca} aoDetalhar={setDetalhe} />
              ) : <p className="text-sm text-muted-foreground">Todas as navalhas já fazem parte de algum kit.</p>}
            </div>
          )}
        </div>
      )}

      {dados && dados.revisao.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <button type="button" onClick={() => setRevisaoAberta(!revisaoAberta)} aria-expanded={revisaoAberta} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-amber-900 dark:text-amber-200">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Cadastros para revisão ({dados.revisao.length})</span>
            {revisaoAberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {revisaoAberta && (
            <ul className="border-t border-amber-300 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:text-amber-200">
              {dados.revisao.map((r) => <li key={r.produtoId}><span className="font-mono">{r.codigo}</span> · {r.descricao} — {r.motivo}</li>)}
            </ul>
          )}
        </div>
      )}

      <DetalheItem item={detalhe} hoje={hoje} cambio={cambio} aoFechar={() => setDetalhe(null)} aoReajustar={(i) => { setDetalhe(null); reajustarPeca(i); }} />
      {janela && <JanelaReajuste key={JSON.stringify(janela.escopo)} alvo={janela} aoFechar={() => setJanela(null)} aoConcluir={concluir} />}
      {janelaIpi && <JanelaIpi key={janelaIpi.opcoes.map((o) => o.id + o.produtoIds.length).join("|") + janelaIpi.titulo} titulo={janelaIpi.titulo} opcoes={janelaIpi.opcoes} ipiAtual={janelaIpi.ipiAtual} avisos={janelaIpi.avisos} aoFechar={() => setJanelaIpi(null)} aoConcluir={concluir} />}
    </section>
  );
}

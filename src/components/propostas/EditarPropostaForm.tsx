"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, ChevronUp, ChevronDown, Trash2, Plus, FileText, AlertCircle, Star } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { tituloComSeparador } from "@/lib/produto-titulo";
import { montarDescritivoMaquina } from "@/lib/propostas/descritivo-maquina";
import { ROTULOS_MOAGEM } from "@/lib/propostas/checklist";
import { numeroComRevisao, precoComAjuste, proximaRevisao } from "@/lib/propostas/revisao";
import { salvarEdicaoProposta, type ItemEdicao } from "@/app/actions/propostas-editar";
import type { ChecklistInput } from "@/app/actions/propostas-pecas";
import { descricaoLinhaJogo, idsNavalhasEmJogos, totalJogo, type Jogo } from "@/lib/propostas/jogos-navalha";
import { rotulosPainel } from "@/lib/produtos/painel";

export interface ProdutoParaAdicionar {
  id: string;
  codigo: string;
  descricao: string;
  descricao_painel: string | null;
  categoria: string;
  preco_brl: number | null;
  ipi_pct: number | null;
  linha?: string | null;
  preco_painel_220?: number | null;
  preco_painel_380?: number | null;
}

interface Props {
  propostaId: string;
  numeroCompleto: string;
  revisaoAtual: string | null;
  clienteNome: string;
  itensIniciais: ItemEdicao[];
  condicaoInicial: string;
  prazoInicial: string;
  validadeInicial: string;
  observacoesIniciais: string;
  checklistInicial: ChecklistInput | null;
  produtos: ProdutoParaAdicionar[];
  jogosNavalha: Jogo[];
  jogosDisponivel: boolean;
}

type ItemTela = ItemEdicao & { chave: string; textoAberto: boolean };

const ABASTECIMENTO = ["Esteira transportadora", "Manual", "Silo", "Pneumático"];
const VOLTAGENS = ["380V 60Hz", "220V 60Hz", "440V 60Hz", "Outro"];

const numero = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const inputCls = "w-full h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[#2074B9]";
const areaCls = "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[12px] outline-none focus:border-[#2074B9] resize-y";
const rotuloCls = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1";

let contador = 0;
const novaChave = () => `i${++contador}`;

export function EditarPropostaForm(p: Props) {
  const [itens, setItens] = useState<ItemTela[]>(() =>
    p.itensIniciais.map((it) => ({ ...it, chave: novaChave(), textoAberto: false }))
  );
  const [condicao, setCondicao] = useState(p.condicaoInicial);
  const [prazo, setPrazo] = useState(p.prazoInicial);
  const [validade, setValidade] = useState(p.validadeInicial);
  const [observacoes, setObservacoes] = useState(p.observacoesIniciais);
  const [checklist, setChecklist] = useState<ChecklistInput | null>(p.checklistInicial);
  const [busca, setBusca] = useState("");
  const [buscaJogo, setBuscaJogo] = useState("");
  const [tipoBusca, setTipoBusca] = useState<"" | "equipamento" | "peca">("");
  // Equipamento com preço de painel: o vendedor escolhe o painel antes de entrar na proposta.
  const [escolhendoPainel, setEscolhendoPainel] = useState<ProdutoParaAdicionar | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const proximoNumero = numeroComRevisao(p.numeroCompleto, proximaRevisao(p.revisaoAtual));

  // Navalhas com jogo cadastrado entram só pelo jogo (formato do orçamento).
  const navalhasEmJogo = useMemo(() => (p.jogosDisponivel ? idsNavalhasEmJogos(p.jogosNavalha) : new Set<string>()), [p.jogosDisponivel, p.jogosNavalha]);

  // Resultados por relevância: código começa com o que foi digitado, depois código contém, depois descrição;
  // equipamentos antes das peças (senão as centenas de peneiras e navalhas do mesmo modelo escondem o moinho).
  const LIMITE_RESULTADOS = 15;
  const { resultados, totalResultados } = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return { resultados: [] as ProdutoParaAdicionar[], totalResultados: 0 };
    const pontos = (pr: ProdutoParaAdicionar) => {
      const cod = pr.codigo.toLowerCase();
      const base = cod.startsWith(q) ? 0 : cod.includes(q) ? 1 : 2;
      return base * 2 + (pr.categoria === "maquina" ? 0 : 1);
    };
    const achados = p.produtos
      .filter((pr) => !(pr.categoria === "navalha" && navalhasEmJogo.has(pr.id)))
      .filter((pr) => tipoBusca === "" || (tipoBusca === "equipamento") === (pr.categoria === "maquina"))
      .filter((pr) => pr.codigo.toLowerCase().includes(q) || pr.descricao.toLowerCase().includes(q))
      .sort((a, b) => pontos(a) - pontos(b));
    return { resultados: achados.slice(0, LIMITE_RESULTADOS), totalResultados: achados.length };
  }, [busca, p.produtos, navalhasEmJogo, tipoBusca]);

  const jogosEncontrados = useMemo(() => {
    const q = buscaJogo.trim().toLowerCase();
    if (q.length < 2) return [];
    return p.jogosNavalha
      .filter((j) => `${j.equipamentoCodigo} ${j.nome} ${j.material ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [buscaJogo, p.jogosNavalha]);

  const adicionarJogo = (jogo: Jogo) => {
    setItens((prev) => [
      ...prev,
      ...jogo.itens.map((i) => ({
        chave: novaChave(),
        textoAberto: false,
        produto_id: i.produtoId,
        descricao: descricaoLinhaJogo(i, jogo.material),
        observacao: null,
        quantidade: i.pecas,
        preco_tabela: i.preco ?? 0,
        desconto_pct: 0,
        acrescimo_pct: 0,
        ipi_pct: i.ipi,
      })),
    ]);
    setBuscaJogo("");
  };

  const alterar = (chave: string, campos: Partial<ItemTela>) =>
    setItens((prev) => prev.map((it) => (it.chave === chave ? { ...it, ...campos } : it)));

  const mover = (idx: number, delta: number) =>
    setItens((prev) => {
      const alvo = idx + delta;
      if (alvo < 0 || alvo >= prev.length) return prev;
      const copia = [...prev];
      [copia[idx], copia[alvo]] = [copia[alvo]!, copia[idx]!];
      return copia;
    });

  const temPainel = (pr: ProdutoParaAdicionar) => Number(pr.preco_painel_220 ?? 0) > 0 || Number(pr.preco_painel_380 ?? 0) > 0;

  /** Adiciona o item; `painel` (220/380) soma o preço do painel no valor do equipamento e entra no texto do Word. */
  const adicionar = (pr: ProdutoParaAdicionar, painel: "220" | "380" | null = null) => {
    const ehMaquina = pr.categoria === "maquina";
    const precoPainel = painel === "220" ? Number(pr.preco_painel_220 ?? 0) : painel === "380" ? Number(pr.preco_painel_380 ?? 0) : 0;
    const rot = rotulosPainel(pr.linha);
    const incluso = painel && precoPainel > 0
      ? { voltagem: painel, preco: precoPainel, tipo: rot.compartilhado ? (painel === "220" ? ("compartilhado" as const) : ("dedicado" as const)) : undefined }
      : null;
    setItens((prev) => [
      ...prev,
      {
        chave: novaChave(),
        textoAberto: false,
        produto_id: pr.id,
        descricao: ehMaquina
          ? tituloComSeparador(pr.codigo) + (incluso ? (incluso.tipo ? ` + painel ${incluso.tipo}` : ` + painel NR-12 ${incluso.voltagem}V`) : "")
          : pr.descricao,
        observacao: ehMaquina ? montarDescritivoMaquina(pr, incluso) : null,
        quantidade: 1,
        preco_tabela: (pr.preco_brl ?? 0) + (incluso?.preco ?? 0),
        desconto_pct: 0,
        acrescimo_pct: 0,
        ipi_pct: Number(pr.ipi_pct ?? 0),
      },
    ]);
    setBusca("");
    setEscolhendoPainel(null);
  };

  const clicouNoProduto = (pr: ProdutoParaAdicionar) => {
    if (pr.categoria === "maquina" && temPainel(pr)) setEscolhendoPainel(pr);
    else adicionar(pr);
  };

  const linhas = itens.map((it) => {
    const preco = precoComAjuste(it.preco_tabela, it.desconto_pct, it.acrescimo_pct);
    const semIpi = preco * it.quantidade;
    return { it, preco, semIpi, total: semIpi * (1 + it.ipi_pct / 100) };
  });
  const subtotal = linhas.reduce((s, l) => s + l.semIpi, 0);
  const total = linhas.reduce((s, l) => s + l.total, 0);

  const salvar = (novaRevisao: boolean) => {
    setErro(null);
    let checklistEnvio: ChecklistInput | null = null;
    if (checklist) {
      const textos = [checklist.segmento_aplicacao, checklist.produto_final, checklist.material, checklist.dimensoes, checklist.granulometria];
      const completo = textos.every((t) => t.trim()) && checklist.producao_horaria_kgh > 0;
      const vazio = textos.every((t) => !t.trim()) && !checklist.producao_horaria_kgh;
      if (!completo && !vazio) {
        setErro("Checklist técnico: preencha todos os campos (ou deixe todos em branco).");
        return;
      }
      checklistEnvio = completo ? checklist : null;
    }
    startTransition(async () => {
      const res = await salvarEdicaoProposta({
        propostaId: p.propostaId,
        itens: itens.map((it) => ({
          produto_id: it.produto_id,
          descricao: it.descricao,
          observacao: it.observacao,
          quantidade: it.quantidade,
          preco_tabela: it.preco_tabela,
          desconto_pct: it.desconto_pct,
          acrescimo_pct: it.acrescimo_pct,
          ipi_pct: it.ipi_pct,
          destaque: Boolean(it.destaque),
        })),
        condicao_pagamento: condicao,
        prazo_entrega: prazo,
        validade_proposta: validade || null,
        observacoes,
        checklist: checklistEnvio,
        novaRevisao,
      });
      if (res?.error) setErro(res.error);
    });
  };

  return (
    <div className="flex flex-col">
      <div className="bg-card border-b border-border px-7 py-3 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link href="/propostas" className="text-[#2074B9] hover:underline">Propostas</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/propostas/${p.propostaId}`} className="text-[#2074B9] hover:underline font-mono">{p.numeroCompleto}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-semibold text-foreground">Editar</span>
      </div>

      <div className="bg-card border-b border-border px-7 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[18px] font-bold text-foreground">Editar proposta <span className="font-mono">{p.numeroCompleto}</span></p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {p.clienteNome && <>{p.clienteNome} · </>}
            <strong>Salvar</strong> mantém o número {p.numeroCompleto}; <strong>Salvar como {proximoNumero}</strong> gera uma nova revisão.
          </p>
        </div>
        <Link href={`/propostas/${p.propostaId}`} className="h-9 px-4 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-muted flex items-center">
          Cancelar
        </Link>
        <button
          onClick={() => salvar(false)}
          disabled={salvando}
          title="Salva as alterações sem mudar o número da proposta"
          className="h-9 px-4 rounded-lg border border-[#2C4F79] bg-card text-[#2C4F79] hover:bg-[#EFF6FF] disabled:opacity-50 text-[13px] font-semibold"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={() => salvar(true)}
          disabled={salvando}
          title="Salva como nova revisão da proposta (próxima letra)"
          className="h-9 px-4 rounded-lg bg-[#2C4F79] hover:bg-[#1E3A5F] disabled:opacity-50 text-white text-[13px] font-semibold"
        >
          {salvando ? "Salvando..." : `Salvar como ${proximoNumero}`}
        </button>
      </div>

      <div className="p-7 flex flex-col gap-5 max-w-[1200px]">
        {erro && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
          </div>
        )}

        {/* Itens */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <p className="text-[13px] font-semibold text-foreground">Itens <span className="ml-1 text-[11px] text-muted-foreground">({itens.length})</span></p>
            <p className="text-[11px] text-muted-foreground">O desconto é aplicado sobre o preço de tabela do item.</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40">
                {["", "Descrição", "Qtd", "Preço tabela", "Desc. %", "Acrésc. %", "Preço final", "IPI", "Total c/ IPI", ""].map((h, i) => (
                  <th key={i} className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ it, preco, total: totalItem }, idx) => (
                <tr key={it.chave} className="border-b border-border last:border-0 align-top">
                  <td className="px-1.5 py-2 w-[34px]">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <button type="button" onClick={() => mover(idx, -1)} disabled={idx === 0} className="disabled:opacity-20 hover:text-foreground" title="Subir"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <span className="text-[10px]">{String(idx + 1).padStart(2, "0")}</span>
                      <button
                        type="button"
                        onClick={() => setItens((prev) => prev.map((x) => ({ ...x, destaque: x.chave === it.chave })))}
                        title={it.destaque ? "Este item dá nome à proposta" : "Usar este item como cabeçalho da proposta"}
                        className="my-0.5"
                      >
                        <Star className={`h-3.5 w-3.5 ${it.destaque ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-400"}`} />
                      </button>
                      <button type="button" onClick={() => mover(idx, 1)} disabled={idx === itens.length - 1} className="disabled:opacity-20 hover:text-foreground" title="Descer"><ChevronDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-2.5 py-2">
                    <input value={it.descricao} onChange={(e) => alterar(it.chave, { descricao: e.target.value })} className={inputCls} />
                    <button
                      type="button"
                      onClick={() => alterar(it.chave, { textoAberto: !it.textoAberto })}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#2074B9] hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      {it.textoAberto ? "Fechar texto do item" : it.observacao ? "Editar texto do item (vai no Word)" : "Adicionar texto ao item"}
                    </button>
                    {it.textoAberto && (
                      <textarea
                        value={it.observacao ?? ""}
                        onChange={(e) => alterar(it.chave, { observacao: e.target.value })}
                        rows={12}
                        className={`${areaCls} mt-1.5 font-mono text-[11px]`}
                      />
                    )}
                  </td>
                  <td className="px-2.5 py-2 w-[70px]">
                    <input type="number" min={1} value={it.quantidade} onChange={(e) => alterar(it.chave, { quantidade: Math.max(1, Math.round(numero(e.target.value))) })} className={`${inputCls} text-center`} />
                  </td>
                  <td className="px-2.5 py-2 w-[120px] font-mono text-[12px] text-muted-foreground pt-3.5">{formatCurrency(it.preco_tabela)}</td>
                  <td className="px-2.5 py-2 w-[80px]">
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={it.desconto_pct}
                      onChange={(e) => { const v = Math.min(100, Math.max(0, numero(e.target.value))); alterar(it.chave, v > 0 ? { desconto_pct: v, acrescimo_pct: 0 } : { desconto_pct: v }); }}
                      className={`${inputCls} text-center ${it.desconto_pct > 0 ? "border-[#16A34A] text-[#15803D] font-semibold" : ""}`}
                    />
                  </td>
                  <td className="px-2.5 py-2 w-[80px]">
                    <input
                      type="number" min={0} max={1000} step={0.5}
                      value={it.acrescimo_pct}
                      title="Margem sobre o preço de tabela. O cliente vê só o preço final; a % aparece no Word interno."
                      onChange={(e) => { const v = Math.min(1000, Math.max(0, numero(e.target.value))); alterar(it.chave, v > 0 ? { acrescimo_pct: v, desconto_pct: 0 } : { acrescimo_pct: v }); }}
                      className={`${inputCls} text-center ${it.acrescimo_pct > 0 ? "border-[#D97706] text-[#B45309] font-semibold" : ""}`}
                    />
                  </td>
                  <td className="px-2.5 py-2 w-[120px] font-mono text-[12px] font-semibold pt-3.5">{formatCurrency(preco)}</td>
                  <td className="px-2.5 py-2 w-[60px] text-[12px] text-muted-foreground pt-3.5">{it.ipi_pct}%</td>
                  <td className="px-2.5 py-2 w-[130px] font-mono text-[12px] font-bold pt-3.5">{formatCurrency(totalItem)}</td>
                  <td className="px-2 py-2 w-[36px] pt-3">
                    <button type="button" onClick={() => setItens((prev) => prev.filter((x) => x.chave !== it.chave))} className="text-muted-foreground hover:text-red-600" title="Remover item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/20">
                <td colSpan={8} className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Subtotal s/ IPI</td>
                <td colSpan={2} className="px-2.5 py-2 font-mono text-[12px] font-bold">{formatCurrency(subtotal)}</td>
              </tr>
              <tr className="bg-muted/30">
                <td colSpan={8} className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Total c/ IPI</td>
                <td colSpan={2} className="px-2.5 py-2 font-mono text-[13px] font-bold text-foreground">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>

          {p.jogosDisponivel && (
            <div className="px-5 py-4 border-t border-border bg-muted/20 relative">
              <label className={rotuloCls}>Adicionar jogo de navalhas</label>
              <input
                value={buscaJogo}
                onChange={(e) => setBuscaJogo(e.target.value)}
                placeholder="Buscar jogo pelo modelo do moinho (ex.: MGHS 800 A2)..."
                className={inputCls}
              />
              {jogosEncontrados.length > 0 && (
                <div className="mt-2 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                  {jogosEncontrados.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => adicionarJogo(j)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-muted border-b border-border last:border-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Plus className="h-3.5 w-3.5 text-[#2074B9] shrink-0" />
                        <span className="truncate"><strong>{j.equipamentoCodigo}</strong> · jogo {j.nome}{j.material ? ` (${j.material})` : ""} · {j.itens.length} linhas</span>
                      </span>
                      <span className="font-mono font-semibold shrink-0">{formatCurrency(totalJogo(j))}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">As linhas do jogo entram com o número de peças e o código, no formato do orçamento. Navalhas com jogo não aparecem na busca de itens abaixo.</p>
            </div>
          )}

          <div className="px-5 py-4 border-t border-border bg-muted/20 relative">
            <label className={rotuloCls}>Adicionar item</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto por código ou descrição (ex.: MGHS 800 BSC, esteira, peneira)..."
              className={inputCls}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([["", "Tudo"], ["equipamento", "Equipamentos"], ["peca", "Peças"]] as const).map(([v, r]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTipoBusca(v)}
                  className={`h-7 rounded-full border px-3 text-[11px] font-semibold ${tipoBusca === v ? "border-[#2C4F79] bg-[#2C4F79] text-white" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            {escolhendoPainel && (
              <div className="mt-2 rounded-lg border border-[#93C5FD] bg-[#EFF6FF] p-3">
                <p className="text-[12px] font-semibold text-foreground">Painel de {tituloComSeparador(escolhendoPainel.codigo)}</p>
                <p className="mb-2 text-[11px] text-muted-foreground">O preço do painel soma no valor do equipamento e o texto do painel entra no Word.</p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const rot = rotulosPainel(escolhendoPainel.linha);
                    const opcoes: Array<{ v: "220" | "380" | null; rotulo: string; preco: number | null }> = [
                      { v: null, rotulo: "Sem painel", preco: null },
                      ...(Number(escolhendoPainel.preco_painel_220 ?? 0) > 0 ? [{ v: "220" as const, rotulo: rot.p220, preco: Number(escolhendoPainel.preco_painel_220) }] : []),
                      ...(Number(escolhendoPainel.preco_painel_380 ?? 0) > 0 ? [{ v: "380" as const, rotulo: rot.p380, preco: Number(escolhendoPainel.preco_painel_380) }] : []),
                    ];
                    return opcoes.map((o) => (
                      <button key={o.rotulo} type="button" onClick={() => adicionar(escolhendoPainel, o.v)} className="h-8 rounded-lg border border-[#2C4F79] bg-card px-3 text-[12px] font-medium text-[#2C4F79] hover:bg-white">
                        {o.rotulo}{o.preco != null ? ` (+ ${formatCurrency(o.preco)})` : ""}
                      </button>
                    ));
                  })()}
                  <button type="button" onClick={() => setEscolhendoPainel(null)} className="h-8 rounded-lg px-3 text-[12px] text-muted-foreground hover:underline">Cancelar</button>
                </div>
              </div>
            )}
            {resultados.length > 0 && (
              <div className="mt-2 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                {resultados.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => clicouNoProduto(pr)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-muted border-b border-border last:border-0"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Plus className="h-3.5 w-3.5 text-[#2074B9] shrink-0" />
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">{pr.codigo}</span>
                      <span className="truncate">{pr.categoria === "maquina" ? tituloComSeparador(pr.codigo) : pr.descricao}</span>
                    </span>
                    <span className="font-mono font-semibold shrink-0">{formatCurrency(pr.preco_brl ?? 0)}</span>
                  </button>
                ))}
                {totalResultados > resultados.length && (
                  <p className="border-t border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
                    Mostrando {resultados.length} de {totalResultados}. Digite mais do modelo ou use os filtros acima para achar o item.
                  </p>
                )}
              </div>
            )}
            {busca.trim().length >= 2 && resultados.length === 0 && (
              <p className="mt-2 text-[12px] text-muted-foreground">Nenhum produto encontrado.</p>
            )}
          </div>
        </div>

        {/* Condições */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <p className="text-[13px] font-semibold text-foreground">Condições comerciais</p>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div>
              <label className={rotuloCls}>Condição de pagamento</label>
              <textarea value={condicao} onChange={(e) => setCondicao(e.target.value)} rows={4} className={areaCls} />
            </div>
            <div>
              <label className={rotuloCls}>Prazo de entrega</label>
              <textarea value={prazo} onChange={(e) => setPrazo(e.target.value)} rows={4} className={areaCls} />
            </div>
            <div>
              <label className={rotuloCls}>Válida até</label>
              <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-3">
              <label className={rotuloCls}>Observações</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={areaCls} />
            </div>
          </div>
        </div>

        {/* Checklist (máquina) */}
        {checklist && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-[13px] font-semibold text-foreground">Checklist técnico da aplicação</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-4">
              {([
                ["segmento_aplicacao", "Segmento de aplicação"],
                ["produto_final", "Produto final"],
                ["material", "Material"],
                ["dimensoes", "Dimensões do material"],
                ["granulometria", "Granulometria desejada"],
              ] as const).map(([campo, rotulo]) => (
                <div key={campo}>
                  <label className={rotuloCls}>{rotulo}</label>
                  <input value={checklist[campo]} onChange={(e) => setChecklist({ ...checklist, [campo]: e.target.value })} className={inputCls} />
                </div>
              ))}
              <div>
                <label className={rotuloCls}>Tipo de moagem</label>
                <select value={checklist.moagem_tipo} onChange={(e) => setChecklist({ ...checklist, moagem_tipo: e.target.value })} className={inputCls}>
                  {ROTULOS_MOAGEM.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={rotuloCls}>Forma de abastecimento</label>
                <select value={checklist.forma_abastecimento} onChange={(e) => setChecklist({ ...checklist, forma_abastecimento: e.target.value })} className={inputCls}>
                  {ABASTECIMENTO.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={rotuloCls}>Produção horária (kg/h)</label>
                <input type="number" value={checklist.producao_horaria_kgh || ""} onChange={(e) => setChecklist({ ...checklist, producao_horaria_kgh: numero(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className={rotuloCls}>Voltagem</label>
                <select value={checklist.voltagem} onChange={(e) => setChecklist({ ...checklist, voltagem: e.target.value })} className={inputCls}>
                  {VOLTAGENS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

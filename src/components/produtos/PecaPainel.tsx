"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Tag } from "lucide-react";
import { alterarSituacao, criarPeca, editarPeca } from "@/app/actions/produtos-admin";
import { carregarPecaDetalhe } from "@/app/actions/produtos-leitura";
import { PainelLateral } from "@/components/kanban/PainelLateral";
import { JanelaReajuste, type AlvoReajuste } from "@/components/reajuste/JanelaReajuste";
import { fmtBRL } from "@/components/reajuste/formatar";
import type { ItemLista } from "@/lib/reajuste/tipos";
import { parseMoedaOpcional } from "@/lib/reajuste/regras";
import type { PecaDetalhe } from "@/lib/produtos/tipos";
import { Aviso, areaCls, botaoPrimario, botaoSecundario, Campo, campoCls, SituacaoPill, useAvisoSaida } from "./base";
import { CampoMoeda, CampoTexto, formatarMoedaCampo } from "./campos";

export type AlvoPeca =
  | { modo: "ver"; id: string }
  | { modo: "criar"; categoriaId: string | null; equipamento?: { id: string; codigo: string } };

interface Form { codigo: string; descricao: string; ncm: string; preco: string; ipi: string; furo: string; obs: string; categoriaId: string; quantidade: string }

const vazio = (categoriaId: string | null): Form => ({ codigo: "", descricao: "", ncm: "", preco: "", ipi: "0", furo: "", obs: "", categoriaId: categoriaId ?? "", quantidade: "1" });
const deDados = (p: PecaDetalhe): Form => ({
  codigo: p.codigo, descricao: p.descricao, ncm: p.ncm ?? "", preco: formatarMoedaCampo(p.preco_brl), ipi: String(p.ipi_pct).replace(".", ","),
  furo: p.furo_diametro ?? "", obs: p.observacao ?? "", categoriaId: p.categoria_peca_id, quantidade: "1",
});

/** Ver/editar/criar peça. Os dados da peça são globais (valem para todos os equipamentos que a usam); o preço existente só muda pelo Reajuste. */
export function PecaPainel({ alvo, categorias, admin, aoFechar, aoMudou }: {
  alvo: AlvoPeca | null; categorias: Array<{ id: string; nome: string }>; admin: boolean; aoFechar: () => void; aoMudou: () => void;
}) {
  const criando = alvo?.modo === "criar";
  const [dados, setDados] = useState<PecaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState<Form>(vazio(null));
  const [original, setOriginal] = useState<Form>(vazio(null));
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [janela, setJanela] = useState<AlvoReajuste | null>(null);
  const [pendente, iniciar] = useTransition();

  const carregar = useCallback(async (pecaId: string) => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const r = await carregarPecaDetalhe(pecaId);
      if (r.ok) { setDados(r.dados); setF(deDados(r.dados)); setOriginal(deDados(r.dados)); } else setErroCarga(r.erro);
    } catch { setErroCarga("Não foi possível carregar. Tente novamente."); }
    setCarregando(false);
  }, []);

  useEffect(() => {
    setErro(null); setAviso(null); setEditando(false); setJanela(null);
    if (!alvo) { setDados(null); return; }
    if (alvo.modo === "criar") { setDados(null); const v = vazio(alvo.categoriaId); setF(v); setOriginal(v); setEditando(true); return; }
    setDados(null);
    void carregar(alvo.id);
  }, [alvo, carregar]);

  const alterado = useMemo(() => JSON.stringify(f) !== JSON.stringify(original), [f, original]);
  useAvisoSaida(editando && alterado);
  const set = (k: keyof Form) => (v: string) => setF((a) => ({ ...a, [k]: v }));
  const categoria = categorias.find((c) => c.id === f.categoriaId);
  const mostraFuro = /peneira/i.test(categoria?.nome ?? dados?.categoria_peca_nome ?? "") || Boolean(f.furo);
  const compartilhada = (dados?.equipamentos.length ?? 0) > 1;
  const precoExiste = !!dados && dados.preco_brl !== null;

  function fechar() {
    if (editando && alterado && !confirm("Há alterações não salvas. Descartar?")) return;
    aoFechar();
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setAviso(null);
    const completo = {
      codigo: f.codigo, descricao: f.descricao, ncm: f.ncm, ipi: f.ipi, furoDiametro: f.furo, observacao: f.obs,
      ...(!precoExiste ? { precoBrl: f.preco } : {}),
    };
    iniciar(async () => {
      try {
        if (alvo?.modo === "criar") {
          if (!f.categoriaId) { setErro("Escolha a categoria da peça."); return; }
          const r = await criarPeca(f.categoriaId, completo, alvo.equipamento?.id ?? null, f.quantidade);
          if (!r.ok) { setErro(r.erro); return; }
          aoMudou(); aoFechar();
          return;
        }
        if (!dados) return;
        // Só envia o que mudou (o resto da peça fica intacto).
        const mudou: Record<string, string> = {};
        if (f.codigo !== original.codigo) mudou.codigo = f.codigo;
        if (f.descricao !== original.descricao) mudou.descricao = f.descricao;
        if (f.ncm !== original.ncm) mudou.ncm = f.ncm;
        if (f.ipi !== original.ipi) mudou.ipi = f.ipi;
        if (f.furo !== original.furo) mudou.furoDiametro = f.furo;
        if (f.obs !== original.obs) mudou.observacao = f.obs;
        if (!precoExiste && f.preco !== original.preco) mudou.precoBrl = f.preco;
        const r = await editarPeca(dados.id, dados.versao, mudou);
        if (!r.ok) { setErro(r.erro); return; }
        setAviso(r.equipamentos > 1 ? `Salvo. A mudança vale para os ${r.equipamentos} equipamentos que usam esta peça.` : "Salvo.");
        setEditando(false);
        aoMudou();
        await carregar(dados.id);
      } catch { setErro("Não foi possível salvar. Seus dados foram mantidos; tente novamente."); }
    });
  }

  function situacao(acao: "descontinuar" | "reativar" | "excluir") {
    if (!dados) return;
    const n = dados.equipamentos.length;
    const texto = acao === "excluir"
      ? `Excluir a peça "${dados.codigo}"?${n ? ` Ela será removida de ${n} ${n === 1 ? "equipamento" : "equipamentos"}.` : ""} O histórico de preços é preservado.`
      : acao === "descontinuar" ? `Descontinuar "${dados.codigo}"? Ela sai de propostas novas, mas continua cadastrada.` : `Reativar "${dados.codigo}"?`;
    if (!confirm(texto)) return;
    setErro(null);
    iniciar(async () => {
      const r = await alterarSituacao(dados.id, acao).catch(() => null);
      if (!r) { setErro("Não foi possível concluir. Tente novamente."); return; }
      if (!r.ok) { setErro(r.erro); return; }
      aoMudou();
      if (acao === "excluir") aoFechar(); else await carregar(dados.id);
    });
  }

  function reajustar() {
    if (!dados) return;
    const item: ItemLista = {
      id: dados.id, codigo: dados.codigo, descricao: dados.descricao, modelo: null, tipo: "peca", ativo: dados.situacao !== "inativo",
      solicitar_engenharia: false, ipi_pct: dados.ipi_pct, precos: { peca: dados.preco_brl }, situacao: "sem_reajuste", reajustados: [], pendentes: [],
      ultimo: null, escopo_nome: dados.categoria_peca_nome,
    };
    setJanela({ escopo: { tipo: "itens", ids: [dados.id] }, tipo: "peca", titulo: `${dados.codigo} · ${dados.descricao}`, item });
  }

  const titulo = criando ? "Nova peça" : dados?.codigo ?? "Peça";
  const precoInvalido = !precoExiste && f.preco.trim() !== "" && parseMoedaOpcional(f.preco).erro !== undefined;

  return (
    <>
      <PainelLateral aberto={alvo !== null} aoFechar={fechar} titulo={titulo} largura={560}>
        <div className="flex flex-col gap-4 p-4">
          {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {erroCarga && <Aviso>{erroCarga}</Aviso>}
          {erro && <Aviso>{erro}</Aviso>}
          {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}

          {(dados || criando) && editando ? (
            <form onSubmit={salvar} className="flex flex-col gap-3">
              {compartilhada && <Aviso tipo="alerta">Esta peça é usada em <strong>{dados?.equipamentos.length} equipamentos</strong>. O que você mudar aqui vale para todos eles (código, descrição, IPI, NCM, observação).</Aviso>}
              {criando && alvo?.modo === "criar" && alvo.equipamento && <Aviso tipo="info">A peça nova será vinculada a <strong>{alvo.equipamento.codigo}</strong>.</Aviso>}
              {criando && (
                <Campo rotulo="Categoria" obrigatorio>
                  <select value={f.categoriaId} onChange={(e) => set("categoriaId")(e.target.value)} className={campoCls} required>
                    <option value="">Selecione…</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Campo>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Código" obrigatorio><CampoTexto valor={f.codigo} aoMudar={set("codigo")} required maxLength={120} /></Campo>
                <Campo rotulo="NCM"><CampoTexto valor={f.ncm} aoMudar={set("ncm")} maxLength={20} /></Campo>
              </div>
              <Campo rotulo="Descrição" obrigatorio><CampoTexto valor={f.descricao} aoMudar={set("descricao")} required maxLength={500} /></Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Preço (R$)" dica={precoExiste ? "Para alterar o preço, use Reajustar preço." : "Preço inicial: fica registrado no histórico."}>
                  {precoExiste
                    ? <input value={f.preco} disabled className={campoCls} aria-label="Preço atual (somente leitura)" />
                    : <CampoMoeda valor={f.preco} aoMudar={set("preco")} rotulo="Preço inicial" />}
                </Campo>
                <Campo rotulo="IPI (%)"><CampoTexto valor={f.ipi} aoMudar={set("ipi")} inputMode="decimal" /></Campo>
              </div>
              {mostraFuro && <Campo rotulo="Ø do furo"><CampoTexto valor={f.furo} aoMudar={set("furo")} maxLength={40} placeholder="ex.: 2 mm" /></Campo>}
              {criando && alvo?.modo === "criar" && alvo.equipamento && (
                <Campo rotulo="Quantidade neste equipamento" dica="Dado do vínculo: vale só para este equipamento.">
                  <CampoTexto valor={f.quantidade} aoMudar={set("quantidade")} inputMode="numeric" />
                </Campo>
              )}
              <Campo rotulo="Observação"><textarea value={f.obs} onChange={(e) => set("obs")(e.target.value)} rows={2} maxLength={1000} className={areaCls} /></Campo>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                {alterado && <span className="mr-auto text-xs text-amber-700 dark:text-amber-300">Alterações não salvas</span>}
                <button type="button" className={botaoSecundario} disabled={pendente} onClick={() => { if (criando) fechar(); else { setF(original); setEditando(false); setErro(null); } }}>Cancelar</button>
                <button type="submit" className={botaoPrimario} disabled={pendente || (!criando && !alterado) || precoInvalido}>{pendente ? "Salvando…" : criando ? "Criar peça" : "Salvar"}</button>
              </div>
            </form>
          ) : dados ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <SituacaoPill situacao={dados.situacao} />
                <span className="text-sm text-muted-foreground">{dados.categoria_peca_nome}</span>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{dados.descricao}</p>
                <p className="font-mono text-sm text-muted-foreground">{dados.codigo}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3"><dt className="text-xs text-muted-foreground">Preço</dt><dd className="text-lg font-semibold tabular-nums">{fmtBRL(dados.preco_brl)}</dd></div>
                <div className="rounded-lg border border-border p-3"><dt className="text-xs text-muted-foreground">IPI</dt><dd className="text-lg font-semibold tabular-nums">{dados.ipi_pct ? `${dados.ipi_pct.toLocaleString("pt-BR")}%` : "—"}</dd></div>
                {dados.ncm && <div><dt className="text-xs text-muted-foreground">NCM</dt><dd>{dados.ncm}</dd></div>}
                {dados.furo_diametro && <div><dt className="text-xs text-muted-foreground">Ø do furo</dt><dd>{dados.furo_diametro}</dd></div>}
              </dl>
              {dados.observacao && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{dados.observacao}</p>}
              {admin && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={botaoPrimario} onClick={() => { setEditando(true); setAviso(null); }}><Pencil className="h-4 w-4" />Editar dados</button>
                  {precoExiste && <button type="button" className={botaoSecundario} onClick={reajustar}><Tag className="h-4 w-4" />Reajustar preço</button>}
                  <button type="button" className={botaoSecundario} disabled={pendente} onClick={() => situacao(dados.situacao === "descontinuado" ? "reativar" : "descontinuar")}>{dados.situacao === "descontinuado" ? "Reativar" : "Descontinuar"}</button>
                  <button type="button" className="inline-flex h-10 items-center rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={pendente} onClick={() => situacao("excluir")}>Excluir…</button>
                </div>
              )}
              <section aria-label="Equipamentos que usam esta peça" className="border-t border-border pt-3">
                <h3 className="mb-2 text-sm font-semibold text-foreground">Equipamentos que usam esta peça · {dados.equipamentos.length}</h3>
                {dados.equipamentos.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não vinculada a nenhum equipamento.</p> : (
                  <ul className="flex flex-col gap-1">
                    {dados.equipamentos.map((e) => (
                      <li key={e.vinculo_id} className="flex items-center justify-between gap-2 text-sm">
                        {e.linha_id ? <Link className="min-w-0 truncate text-[#2074B9] hover:underline" href={`/produtos/linhas/${e.linha_id}/${e.equipamento_id}?secao=pecas`}>{e.codigo}</Link> : <span>{e.codigo}</span>}
                        <span className="shrink-0 text-xs text-muted-foreground">{e.linha_nome ? `${e.linha_nome} · ` : ""}qtd. {e.quantidade}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </PainelLateral>
      {janela && <JanelaReajuste key={dados?.id} alvo={janela} aoFechar={() => setJanela(null)} aoConcluir={() => { setJanela(null); aoMudou(); if (dados) void carregar(dados.id); }} />}
    </>
  );
}

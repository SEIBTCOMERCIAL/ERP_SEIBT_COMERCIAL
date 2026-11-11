"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, MoreVertical, Pencil, Plus, Search, Unlink, Users } from "lucide-react";
import { atualizarVinculo, desvincularPeca, vincularPeca } from "@/app/actions/produtos-admin";
import { buscarPecasParaVincular, listarPecasDaCategoria, listarVinculos, type PecaDaCategoria } from "@/app/actions/produtos-leitura";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fmtBRL } from "@/components/reajuste/formatar";
import { JogosNavalha } from "@/components/produtos/JogosNavalha";
import type { Jogo } from "@/lib/propostas/jogos-navalha";
import { parseQuantidade } from "@/lib/produtos/regras";
import type { PecaBusca, VinculoPeca } from "@/lib/produtos/tipos";
import { Aviso, botaoPrimario, botaoSecundario, campoCls, Modal } from "../base";
import { PecaPainel, type AlvoPeca } from "../PecaPainel";
import type { ContextoEquipamento } from "./EquipamentoPagina";

const ehNavalha = (nome: string) => /navalha/i.test(nome);

function BuscarPeca({ equipamentoId, categorias, categoriaInicial, aoFechar, aoVinculou }: {
  equipamentoId: string; categorias: Array<{ id: string; nome: string }>; categoriaInicial: string | null; aoFechar: () => void; aoVinculou: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [cat, setCat] = useState<string>(categoriaInicial ?? "");
  const [resultados, setResultados] = useState<PecaBusca[]>([]);
  const [qtd, setQtd] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    const t = setTimeout(() => {
      buscarPecasParaVincular(equipamentoId, termo, cat || null)
        .then((r) => { if (cancelado) return; setCarregando(false); if (r.ok) { setResultados(r.dados); setErro(null); } else setErro(r.erro); })
        .catch(() => { if (!cancelado) { setCarregando(false); setErro("Não foi possível buscar. Tente novamente."); } });
    }, termo ? 300 : 0);
    return () => { cancelado = true; clearTimeout(t); };
  }, [equipamentoId, termo, cat]);

  function vincular(p: PecaBusca) {
    const q = parseQuantidade(qtd[p.id] ?? "1");
    if (q.erro !== undefined) { setErro(q.erro); return; }
    setErro(null);
    iniciar(async () => {
      const r = await vincularPeca(equipamentoId, p.id, String(q.valor)).catch(() => null);
      if (!r) { setErro("Não foi possível vincular. Tente novamente."); return; }
      if (!r.ok) { setErro(r.erro); return; }
      setResultados((l) => l.filter((x) => x.id !== p.id));
      aoVinculou();
    });
  }

  return (
    <Modal titulo="Vincular peça existente" aoFechar={aoFechar} largura="max-w-2xl" bloqueado={pendente}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar por código ou descrição" aria-label="Buscar peça" className={`${campoCls} pl-9`} />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria" className={`${campoCls} w-auto`}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {carregando && <li className="px-3 py-3 text-sm text-muted-foreground">Buscando…</li>}
          {!carregando && resultados.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nenhuma peça disponível com esses filtros (as já vinculadas não aparecem).</li>}
          {resultados.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{p.descricao}</p>
                <p className="text-xs text-muted-foreground"><span className="font-mono">{p.codigo}</span> · {p.categoria_peca_nome ?? "—"} · {fmtBRL(p.preco_brl)}</p>
              </div>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">Qtd.
                <input value={qtd[p.id] ?? "1"} onChange={(e) => setQtd((a) => ({ ...a, [p.id]: e.target.value }))} inputMode="numeric" aria-label={`Quantidade de ${p.codigo}`} className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
              </label>
              <button type="button" className={botaoPrimario} disabled={pendente} onClick={() => vincular(p)}><Link2 className="h-4 w-4" />Vincular</button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Mostra até 30 resultados; refine a busca para achar uma peça específica.</p>
      </div>
    </Modal>
  );
}

function LinhaVinculo({ v, admin, equipamentoId, mostrarFuro, aoMudou, aoEditar }: {
  v: VinculoPeca; admin: boolean; equipamentoId: string; mostrarFuro: boolean; aoMudou: () => void; aoEditar: (id: string) => void;
}) {
  const [qtd, setQtd] = useState(String(v.quantidade));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  useEffect(() => { setQtd(String(v.quantidade)); }, [v.quantidade]);
  const total = v.peca.preco_brl === null ? null : v.peca.preco_brl * (1 + v.peca.ipi_pct / 100) * v.quantidade;
  const mudou = qtd.trim() !== String(v.quantidade);

  function salvarQtd() {
    setErro(null);
    iniciar(async () => {
      const r = await atualizarVinculo(equipamentoId, v.id, qtd).catch(() => null);
      if (!r) { setErro("Não foi possível salvar."); return; }
      if (!r.ok) { setErro(r.erro); return; }
      aoMudou();
    });
  }
  function desvincular() {
    if (!confirm(`Desvincular "${v.peca.codigo}" deste equipamento? A peça continua cadastrada${v.peca.equipamentos_usando > 1 ? ` e em uso em ${v.peca.equipamentos_usando - 1} outro(s) equipamento(s)` : ""}.`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await desvincularPeca(equipamentoId, v.id).catch(() => null);
      if (!r) { setErro("Não foi possível desvincular."); return; }
      if (!r.ok) { setErro(r.erro); return; }
      aoMudou();
    });
  }

  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{v.peca.codigo}</td>
      <td className="px-3 py-2">
        <button type="button" onClick={() => aoEditar(v.peca.id)} className="text-left font-medium text-foreground hover:text-[#2074B9]">{v.peca.descricao}</button>
        {v.peca.observacao && <p className="text-xs italic text-muted-foreground">{v.peca.observacao}</p>}
        {v.peca.equipamentos_usando > 1 && <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" aria-hidden />compartilhada com {v.peca.equipamentos_usando - 1} {v.peca.equipamentos_usando === 2 ? "outro equipamento" : "outros equipamentos"}</p>}
        {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
      </td>
      {mostrarFuro && <td className="px-3 py-2 text-right text-muted-foreground">{v.peca.furo_diametro ?? "—"}</td>}
      <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(v.peca.preco_brl)}</td>
      <td className="px-3 py-2 text-right">
        {admin ? (
          <span className="inline-flex items-center gap-1">
            <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="numeric" aria-label={`Quantidade de ${v.peca.codigo} neste equipamento`} className="h-8 w-14 rounded-lg border border-border bg-background px-2 text-right text-sm" />
            {mudou && <button type="button" className="h-8 rounded-lg bg-[#2C4F79] px-2 text-xs font-semibold text-white disabled:opacity-50" disabled={pendente} onClick={salvarQtd}>OK</button>}
          </span>
        ) : <span className="tabular-nums">{v.quantidade}</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{v.peca.ipi_pct ? `${v.peca.ipi_pct.toLocaleString("pt-BR")}%` : "—"}</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtBRL(total)}</td>
      <td className="px-2 py-2">
        {admin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" aria-label={`Mais ações — ${v.peca.codigo}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><MoreVertical className="h-4 w-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setTimeout(() => aoEditar(v.peca.id), 0)}><Pencil /> Dados da peça (globais)</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" disabled={pendente} onSelect={() => setTimeout(desvincular, 0)}><Unlink /> Desvincular</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

/** Peças compatíveis: filtros por categoria (carregadas sob demanda), quantidade do vínculo separada dos dados globais da peça. */
export function SecaoPecas({ ctx, categorias, contagem, jogos, jogosDisponivel }: {
  ctx: ContextoEquipamento; categorias: Array<{ id: string; nome: string; ordem: number }>; contagem: Record<string, number>; jogos: Jogo[]; jogosDisponivel: boolean;
}) {
  const router = useRouter();
  const { admin, equip } = ctx;
  const visiveis = admin ? categorias : categorias.filter((c) => (contagem[c.id] ?? 0) > 0 || (ehNavalha(c.nome) && jogos.length > 0));
  const [catId, setCatId] = useState<string | null>(() => (visiveis.find((c) => (contagem[c.id] ?? 0) > 0) ?? visiveis[0])?.id ?? null);
  const cat = categorias.find((c) => c.id === catId) ?? null;
  const [vinculos, setVinculos] = useState<VinculoPeca[] | null>(null);
  const [navalhas, setNavalhas] = useState<PecaDaCategoria[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [buscar, setBuscar] = useState(false);
  const [alvo, setAlvo] = useState<AlvoPeca | null>(null);

  const carregar = useCallback(async () => {
    if (!catId || !cat) return;
    setErro(null);
    try {
      if (ehNavalha(cat.nome)) {
        const r = await listarPecasDaCategoria(catId);
        if (r.ok) setNavalhas(r.dados); else setErro(r.erro);
        setVinculos([]);
        return;
      }
      const r = await listarVinculos(equip.id, catId);
      if (r.ok) setVinculos(r.dados); else setErro(r.erro);
    } catch { setErro("Não foi possível carregar as peças. Tente novamente."); }
  }, [catId, cat, equip.id]);

  useEffect(() => { setVinculos(null); void carregar(); }, [carregar]);

  const aoMudou = () => { void carregar(); router.refresh(); };
  const mostrarFuro = (vinculos ?? []).some((v) => v.peca.furo_diametro) || /peneira/i.test(cat?.nome ?? "");

  return (
    <div className="flex flex-col gap-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div role="tablist" aria-label="Categorias de peças" className="flex flex-wrap gap-2">
        {visiveis.map((c) => {
          const n = ehNavalha(c.nome) ? jogos.length : contagem[c.id] ?? 0;
          return (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === catId} onClick={() => setCatId(c.id)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${c.id === catId ? "border-[#2C4F79] bg-[#2C4F79] text-white" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
              {c.nome}{n > 0 && <span className={`text-xs font-semibold ${c.id === catId ? "text-white/80" : ""}`}>{n}</span>}
            </button>
          );
        })}
        {visiveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma peça vinculada a este equipamento.</p>}
      </div>

      {cat && ehNavalha(cat.nome) ? (
        <JogosNavalha equipamentoId={equip.id} jogos={jogos} disponivel={jogosDisponivel} isAdmin={admin} navalhas={navalhas} />
      ) : cat && (
        <>
          {admin && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={botaoSecundario} onClick={() => setBuscar(true)}><Link2 className="h-4 w-4" />Vincular existente</button>
              <button type="button" className={botaoPrimario} onClick={() => setAlvo({ modo: "criar", categoriaId: cat.id, equipamento: { id: equip.id, codigo: equip.codigo } })}><Plus className="h-4 w-4" />Nova peça</button>
            </div>
          )}
          {vinculos === null && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {vinculos !== null && vinculos.length === 0 && <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma peça de {cat.nome} vinculada a este equipamento.</div>}
          {vinculos !== null && vinculos.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr><th className="px-3 py-2 font-semibold">Código</th><th className="px-3 py-2 font-semibold">Descrição</th>{mostrarFuro && <th className="px-3 py-2 text-right font-semibold">Ø furo</th>}<th className="px-3 py-2 text-right font-semibold">Preço unit.</th><th className="px-3 py-2 text-right font-semibold">Qtd. neste equip.</th><th className="px-3 py-2 text-right font-semibold">IPI</th><th className="px-3 py-2 text-right font-semibold">Total c/ IPI</th><th className="w-10 px-2 py-2"><span className="sr-only">Ações</span></th></tr>
                </thead>
                <tbody>{vinculos.map((v) => <LinhaVinculo key={v.id} v={v} admin={admin} equipamentoId={equip.id} mostrarFuro={mostrarFuro} aoMudou={aoMudou} aoEditar={(id) => setAlvo({ modo: "ver", id })} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}

      {buscar && <BuscarPeca equipamentoId={equip.id} categorias={categorias} categoriaInicial={catId} aoFechar={() => setBuscar(false)} aoVinculou={aoMudou} />}
      <PecaPainel alvo={alvo} categorias={categorias} admin={admin} aoFechar={() => setAlvo(null)} aoMudou={aoMudou} />
    </div>
  );
}

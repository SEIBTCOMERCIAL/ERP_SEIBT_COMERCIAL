"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  atualizarJogoNavalha, criarJogoNavalha, duplicarJogoNavalha, excluirItemJogoNavalha, excluirJogoNavalha, salvarItemJogoNavalha,
} from "@/app/actions/jogos-navalha";
import { totalJogo, type Jogo, type JogoItem } from "@/lib/propostas/jogos-navalha";
import { formatCurrency } from "@/lib/utils";

export interface NavalhaCadastro {
  id: string;
  codigo: string;
  descricao: string;
  preco_brl: number | null;
  ipi_pct: number;
}

const campo = "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-[#2074B9]";
const rotulo = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Linha no formato do orçamento: título em negrito, "(COMPOSTO POR 03 PEÇAS)" normal e o código em vermelho. */
function LinhaOrcamento({ item }: { item: JogoItem }) {
  return (
    <span className="text-[13px] leading-snug">
      <strong className="text-foreground">{item.titulo}</strong>{" "}
      <span className="text-foreground">(COMPOSTO POR {doisDigitos(item.pecas)} {item.pecas === 1 ? "PEÇA" : "PEÇAS"})</span>
      {item.codigo && <strong className="text-[#DC2626]"> - CÓD. {item.codigo}</strong>}
    </span>
  );
}

function FormItem({
  jogoId, item, navalhas, onFechar,
}: { jogoId: string; item?: JogoItem; navalhas: NavalhaCadastro[]; onFechar: () => void }) {
  const router = useRouter();
  const [modo, setModo] = useState<"existente" | "nova">("existente");
  const [busca, setBusca] = useState("");
  const [produtoId, setProdutoId] = useState(item?.produtoId ?? "");
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [pecas, setPecas] = useState(String(item?.pecas ?? 1));
  const [codigo, setCodigo] = useState(item?.codigo ?? "");
  // navalha nova
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novoIpi, setNovoIpi] = useState("5.25");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const opcoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q ? navalhas.filter((n) => n.codigo.toLowerCase().includes(q) || n.descricao.toLowerCase().includes(q)) : navalhas;
    const atual = navalhas.find((n) => n.id === produtoId);
    const cortada = lista.slice(0, 60);
    return atual && !cortada.some((n) => n.id === atual.id) ? [atual, ...cortada] : cortada;
  }, [busca, navalhas, produtoId]);
  const escolhida = navalhas.find((n) => n.id === produtoId);

  function escolher(id: string) {
    setProdutoId(id);
    const n = navalhas.find((x) => x.id === id);
    if (n) {
      if (!titulo.trim()) setTitulo(n.descricao);
      if (!codigo.trim()) setCodigo(n.codigo);
    }
  }

  function salvar() {
    setErro(null);
    const preco = novoPreco.trim() ? Number(novoPreco.replace(/\./g, "").replace(",", ".")) : null;
    if (modo === "nova" && preco != null && Number.isNaN(preco)) { setErro("Preço inválido."); return; }
    startTransition(async () => {
      const r = await salvarItemJogoNavalha(jogoId, {
        id: item?.id,
        produtoId: modo === "existente" ? produtoId : "",
        titulo, pecas: Number(pecas), codigo,
        novaNavalha: modo === "nova" ? { codigo: novoCodigo, descricao: novaDescricao, preco, ipi: Number(novoIpi.replace(",", ".")) || 0 } : undefined,
      });
      if (r.error) setErro(r.error);
      else { router.refresh(); onFechar(); }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex overflow-hidden rounded-lg border border-border bg-card text-[12px] font-medium">
        {([["existente", "Navalha já cadastrada"], ["nova", "Cadastrar navalha nova"]] as const).map(([v, r]) => (
          <button key={v} type="button" onClick={() => setModo(v)} className={`flex-1 px-3 py-2 ${modo === v ? "bg-[#2C4F79] text-white" : "text-muted-foreground hover:bg-muted"}`}>{r}</button>
        ))}
      </div>

      {modo === "existente" ? (
        <div className="flex flex-col gap-1.5">
          <span className={rotulo}>Navalha do cadastro (o preço vem daqui) *</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código ou descrição..." className={campo} />
          <select value={produtoId} onChange={(e) => escolher(e.target.value)} className={campo}>
            <option value="">Selecione...</option>
            {opcoes.map((n) => <option key={n.id} value={n.id}>{n.codigo} — {n.descricao} ({n.preco_brl != null ? formatCurrency(n.preco_brl) : "sem preço"})</option>)}
          </select>
          {escolhida && <p className="text-[11px] text-muted-foreground">Preço de tabela {escolhida.preco_brl != null ? formatCurrency(escolhida.preco_brl) : "não cadastrado"} · IPI {escolhida.ipi_pct}%. Para mudar o preço, use o Reajuste.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={rotulo}>Código da navalha *<input value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} placeholder="Ex.: 79700" className={campo} /></label>
          <label className={rotulo}>Descrição no cadastro *<input value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} placeholder="Ex.: NAVALHA FIXA MGHS 800 A2 (aço rápido)" className={campo} /></label>
          <label className={rotulo}>Preço de tabela (R$)<input value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} placeholder="Ex.: 1.727,00" inputMode="decimal" className={campo} /></label>
          <label className={rotulo}>IPI (%)<input value={novoIpi} onChange={(e) => setNovoIpi(e.target.value)} inputMode="decimal" className={campo} /></label>
          <p className="text-[11px] text-muted-foreground sm:col-span-2">A navalha nova entra no cadastro de peças (categoria Navalhas), onde o preço também pode ser reajustado depois.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={`${rotulo} sm:col-span-2`}>Título da linha no orçamento *
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: NAVALHAS ROTORAS ESQ. MOINHO MGHS 800 A2" className={campo} />
        </label>
        <label className={rotulo}>Número de peças *
          <input type="number" min={1} value={pecas} onChange={(e) => setPecas(e.target.value)} className={campo} />
        </label>
        <label className={rotulo}>Código no orçamento
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={modo === "nova" ? novoCodigo || "Ex.: 79691" : "Ex.: 79691"} className={campo} />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">No orçamento sai: <strong>{titulo || "TÍTULO"}</strong> (COMPOSTO POR {doisDigitos(Number(pecas) || 1)} PEÇAS) - <strong className="text-[#DC2626]">CÓD. {codigo || (modo === "nova" ? novoCodigo : "") || "…"}</strong></p>
      {erro && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFechar} className="h-9 rounded-lg border border-border px-3 text-[12px] font-medium">Cancelar</button>
        <button type="button" onClick={salvar} disabled={pendente} className="flex h-9 items-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-semibold text-white disabled:opacity-60">
          {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{item ? "Salvar linha" : "Adicionar linha"}
        </button>
      </div>
    </div>
  );
}

function CartaoJogo({ jogo, navalhas, isAdmin, aberto }: { jogo: Jogo; navalhas: NavalhaCadastro[]; isAdmin: boolean; aberto: boolean }) {
  const router = useRouter();
  const [editandoJogo, setEditandoJogo] = useState(false);
  const [nome, setNome] = useState(jogo.nome);
  const [material, setMaterial] = useState(jogo.material ?? "");
  const [formItem, setFormItem] = useState<{ item?: JogoItem } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const total = totalJogo(jogo);

  function executar(fn: () => Promise<{ error?: string }>, aoTerminar?: () => void) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setErro(r.error);
      else { aoTerminar?.(); router.refresh(); }
    });
  }

  return (
    <details open={aberto} className="group overflow-hidden rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-foreground">{jogo.nome}</span>
            {jogo.material && <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{jogo.material}</span>}
            {!jogo.ativo && <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Desativado</span>}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{jogo.itens.length} {jogo.itens.length === 1 ? "linha" : "linhas"} no orçamento</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total do jogo com IPI</p>
          <p className="font-mono text-[15px] font-bold text-foreground">{formatCurrency(total)}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-border p-4">
        {jogo.itens.length === 0 ? (
          <p className="py-3 text-center text-[12px] text-muted-foreground">Este jogo ainda não tem linhas.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["Descrição no orçamento", "Qtd.", "Preço unit.", "IPI", "Total c/ IPI", ...(isAdmin ? [""] : [])].map((h) => (
                    <th key={h} className="border-b border-border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jogo.itens.map((i) => (
                  <tr key={i.id} className="border-b border-border align-top last:border-0">
                    <td className="px-3 py-2.5"><LinhaOrcamento item={i} /></td>
                    <td className="px-3 py-2.5 text-center font-mono text-[13px] font-semibold">{doisDigitos(i.pecas)}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px]">{i.preco != null ? formatCurrency(i.preco) : <span className="text-red-600">sem preço</span>}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{i.ipi}%</td>
                    <td className="px-3 py-2.5 font-mono text-[13px] font-bold">{formatCurrency(i.pecas * (i.preco ?? 0) * (1 + i.ipi / 100))}</td>
                    {isAdmin && (
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => setFormItem({ item: i })} aria-label="Editar linha" className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:border-[#2074B9]"><Pencil className="h-3 w-3" /></button>
                          <button type="button" disabled={pendente} onClick={() => { if (confirm("Remover esta linha do jogo?")) executar(() => excluirItemJogoNavalha(i.id)); }} aria-label="Remover linha" className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {erro && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">{erro}</p>}

        {isAdmin && (
          <div className="mt-3 flex flex-col gap-3">
            {formItem && <FormItem jogoId={jogo.id} item={formItem.item} navalhas={navalhas} onFechar={() => setFormItem(null)} />}
            {editandoJogo && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
                <label className={rotulo}>Nome do jogo<input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} /></label>
                <label className={rotulo}>Material (aparece no orçamento)<input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Ex.: aço rápido (opcional)" className={campo} /></label>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button type="button" onClick={() => setEditandoJogo(false)} className="h-9 rounded-lg border border-border px-3 text-[12px] font-medium">Cancelar</button>
                  <button type="button" disabled={pendente} onClick={() => executar(() => atualizarJogoNavalha(jogo.id, { nome, material, ativo: jogo.ativo }), () => setEditandoJogo(false))} className="h-9 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-semibold text-white disabled:opacity-60">Salvar jogo</button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!formItem && <button type="button" onClick={() => setFormItem({})} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2C4F79] px-3 text-[12px] font-semibold text-white"><Plus className="h-3.5 w-3.5" />Adicionar linha</button>}
              <button type="button" onClick={() => setEditandoJogo((v) => !v)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-medium"><Pencil className="h-3.5 w-3.5" />Nome e material</button>
              <button type="button" disabled={pendente} onClick={() => { const n = prompt("Nome do novo jogo (cópia deste, para trocar o material):", `${jogo.nome} (cópia)`); if (n) executar(() => duplicarJogoNavalha(jogo.id, n)); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-medium"><Copy className="h-3.5 w-3.5" />Duplicar como novo jogo</button>
              <button type="button" disabled={pendente} onClick={() => executar(() => atualizarJogoNavalha(jogo.id, { nome: jogo.nome, material: jogo.material ?? "", ativo: !jogo.ativo }))} className="h-9 rounded-lg border border-border px-3 text-[12px] font-medium">{jogo.ativo ? "Desativar" : "Ativar"}</button>
              <button type="button" disabled={pendente} onClick={() => { if (confirm(`Excluir o jogo "${jogo.nome}" e todas as linhas dele?`)) executar(() => excluirJogoNavalha(jogo.id)); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-[12px] font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Excluir jogo</button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

/** Aba "Navalhas" do equipamento: jogos (por material) e as linhas de cada um, como saem no orçamento. */
export function JogosNavalha({
  equipamentoId, jogos, navalhas, isAdmin, disponivel,
}: { equipamentoId: string; jogos: Jogo[]; navalhas: NavalhaCadastro[]; isAdmin: boolean; disponivel: boolean }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [material, setMaterial] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  if (!disponivel) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
        Os jogos de navalhas ficam disponíveis depois da atualização do banco de dados (arquivo 026). Até lá, use as peças vinculadas abaixo.
      </p>
    );
  }

  function criar() {
    setErro(null);
    startTransition(async () => {
      const r = await criarJogoNavalha(equipamentoId, nome, material);
      if (r.error) setErro(r.error);
      else { setNome(""); setMaterial(""); setCriando(false); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-bold text-foreground">Jogos de navalhas</h3>
          <p className="text-[12px] text-muted-foreground">Cada jogo é uma opção para cotar (por exemplo, materiais diferentes). Os preços vêm do cadastro de cada navalha.</p>
        </div>
        {isAdmin && !criando && <button type="button" onClick={() => setCriando(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2C4F79] px-3 text-[12px] font-semibold text-white"><Plus className="h-3.5 w-3.5" />Novo jogo</button>}
      </div>

      {criando && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
          <label className={rotulo}>Nome do jogo *<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Padrão, Aço rápido" className={campo} /></label>
          <label className={rotulo}>Material (aparece no orçamento)<input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Opcional" className={campo} /></label>
          {erro && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-[12px] text-red-700 sm:col-span-2">{erro}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => { setCriando(false); setErro(null); }} className="h-9 rounded-lg border border-border px-3 text-[12px] font-medium">Cancelar</button>
            <button type="button" onClick={criar} disabled={pendente} className="h-9 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-semibold text-white disabled:opacity-60">Criar jogo</button>
          </div>
        </div>
      )}

      {jogos.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-8 text-center text-[13px] text-muted-foreground">Nenhum jogo cadastrado para este equipamento.</p>
      ) : (
        jogos.map((j, i) => <CartaoJogo key={j.id} jogo={j} navalhas={navalhas} isAdmin={isAdmin} aberto={i === 0} />)
      )}
    </div>
  );
}

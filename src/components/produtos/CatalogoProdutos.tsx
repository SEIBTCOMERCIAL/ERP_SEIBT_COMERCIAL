"use client";

import { useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Search, Eye, Pencil, Plus, Download, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { reajustarPreco, type ReajusteFormState } from "@/app/actions/produtos";
import type { ProdutoComDetalhes, Categoriaproduto, HistoricoPreco } from "@/types/database";

type SidebarSel =
  | { kind: "todos" }
  | { kind: "categoria"; value: Categoriaproduto }
  | { kind: "linha"; value: string };

interface Props {
  produtos: ProdutoComDetalhes[];
}

const CATS: { label: string; value: Categoriaproduto; icon: React.ReactNode }[] = [
  { label: "Navalhas",   value: "navalha",   icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 8l2-4 4 8 2-4"/></svg> },
  { label: "Peneiras",   value: "peneira",   icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2"/></svg> },
  { label: "Rolamentos", value: "rolamento", icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="4"/><circle cx="8" cy="8" r="1.5"/></svg> },
  { label: "Parafusos",  value: "parafuso",  icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3l1 10M9 3l1 10M4 6h8M4 10h8"/></svg> },
  { label: "Rotores",    value: "rotor",     icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 2v2M8 12v2M3 5l1.5 1.5M11.5 9.5L13 11M2 8h2M12 8h2"/></svg> },
  { label: "Insertos",   value: "inserto",   icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="8" height="8" rx="1"/><path d="M7 7h2M7 9h2"/></svg> },
];

const LINHAS = ["MGHS", "TPS", "ES75", "AS900"];

function fmtBRL(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SubmitReajuste() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-9 rounded-lg bg-[#2C4F79] hover:bg-[#1E3A5F] disabled:opacity-50 text-white text-[12px] font-semibold transition-colors"
    >
      {pending ? "Aplicando..." : "Confirmar reajuste"}
    </button>
  );
}

function PriceChart({ historico }: { historico: HistoricoPreco[] }) {
  const items = [...historico]
    .filter((h) => h.preco_novo_brl != null)
    .sort((a, b) => a.data_reajuste.localeCompare(b.data_reajuste))
    .slice(-6);

  if (items.length < 2) return null;

  const prices = items.map((h) => h.preco_novo_brl as number);
  const min = Math.min(...prices) * 0.95;
  const max = Math.max(...prices) * 1.05;
  const W = 240, H = 64;

  const pts = items.map((h, i) => {
    const x = (i / (items.length - 1)) * (W - 20) + 10;
    const y = H - ((((h.preco_novo_brl as number) - min) / (max - min)) * (H - 16)) - 4;
    return { x, y };
  });

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="mt-3">
      <p className="text-[10px] text-[#6B7B8D] mb-1.5">Evolução de preço</p>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="overflow-visible">
        <path d={d} fill="none" stroke="#2074B9" strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#2074B9" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {items.map((h) => (
          <span key={h.id} className="text-[9px] text-[#B0BAC9]">
            {h.data_reajuste.slice(0, 7).replace("-", "/")}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CatalogoProdutos({ produtos }: Props) {
  const [sel, setSel] = useState<SidebarSel>({ kind: "todos" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProdutoComDetalhes | null>(null);
  const [showReajuste, setShowReajuste] = useState(false);

  const filtered = useMemo(() => {
    let list = produtos;
    if (sel.kind === "categoria") {
      list = list.filter((p) => p.categoria === sel.value);
    } else if (sel.kind === "linha") {
      list = list.filter((p) => p.linha === sel.value);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.codigo.toLowerCase().includes(q) ||
          p.descricao.toLowerCase().includes(q) ||
          p.modelos_compat.some((m) => m.toLowerCase().includes(q))
      );
    }
    return list;
  }, [produtos, sel, search]);

  const catCounts = useMemo(() => {
    const map: Partial<Record<Categoriaproduto, number>> = {};
    for (const p of produtos) {
      map[p.categoria] = (map[p.categoria] ?? 0) + 1;
    }
    return map;
  }, [produtos]);

  const linhaCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of produtos.filter((x) => x.categoria === "maquina")) {
      const l = p.linha ?? "Outros";
      map[l] = (map[l] ?? 0) + 1;
    }
    return map;
  }, [produtos]);

  const initialState: ReajusteFormState = {};

  function ReajusteForm({ produto }: { produto: ProdutoComDetalhes }) {
    const [state, action] = useFormState<ReajusteFormState, FormData>(reajustarPreco, initialState);
    const [novoPreco, setNovoPreco] = useState(produto.preco_brl ?? 0);
    const atual = produto.preco_brl ?? 0;
    const diff = novoPreco - atual;
    const pct = atual > 0 ? (diff / atual) * 100 : 0;

    return (
      <form action={action} className="mt-3 pt-3 border-t border-[#E2E8F0]">
        <p className="text-[11px] font-semibold text-[#1A1A1A] mb-3">Registrar reajuste</p>
        <input type="hidden" name="produto_id" value={produto.id} />

        {state.message && (
          <p className="text-[11px] text-red-600 mb-2">{state.message}</p>
        )}
        {state.success && (
          <p className="text-[11px] text-green-600 mb-2">Reajuste aplicado com sucesso.</p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <p className="text-[10px] font-semibold text-[#6B7B8D] uppercase mb-1">Novo preço (R$)</p>
            <input
              name="novo_preco"
              type="number"
              step="0.01"
              min="0"
              value={novoPreco}
              onChange={(e) => setNovoPreco(parseFloat(e.target.value) || 0)}
              className="w-full h-8 rounded-lg border border-[#E2E8F0] px-2 text-[12px] font-mono focus:border-[#2074B9] outline-none"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#6B7B8D] uppercase mb-1">Percentual (%)</p>
            <input
              name="percentual"
              type="number"
              step="0.01"
              value={atual > 0 ? pct.toFixed(2) : ""}
              readOnly
              className="w-full h-8 rounded-lg border border-[#E2E8F0] px-2 text-[12px] font-mono bg-[#F8FAFC] text-[#6B7B8D]"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#6B7B8D] uppercase mb-1">Data vigência</p>
            <input
              name="data_vigencia"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full h-8 rounded-lg border border-[#E2E8F0] px-2 text-[12px] focus:border-[#2074B9] outline-none"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#6B7B8D] uppercase mb-1">Motivo</p>
            <select
              name="motivo"
              className="w-full h-8 rounded-lg border border-[#E2E8F0] px-2 text-[12px] focus:border-[#2074B9] outline-none bg-white"
            >
              <option>Reajuste anual</option>
              <option>Variação cambial</option>
              <option>Custo matéria-prima</option>
              <option>Outro</option>
            </select>
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-3 text-[11px]">
          <div className="flex justify-between mb-1">
            <span className="text-[#6B7B8D]">Preço atual</span>
            <span className="font-mono font-semibold">{fmtBRL(atual)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-[#6B7B8D]">Reajuste</span>
            <span className={cn("font-mono font-semibold", diff >= 0 ? "text-[#D97706]" : "text-[#DC2626]")}>
              {diff >= 0 ? "+" : ""}{pct.toFixed(1)}% ({diff >= 0 ? "+" : ""}{fmtBRL(Math.abs(diff))})
            </span>
          </div>
          <div className="flex justify-between border-t border-[#E2E8F0] pt-1 mt-1">
            <span className="font-semibold text-[#1A1A1A]">Novo preço</span>
            <span className="font-mono font-bold text-[#2C4F79]">{fmtBRL(novoPreco)}</span>
          </div>
        </div>

        <SubmitReajuste />
      </form>
    );
  }

  const selSidebarKey = sel.kind === "todos" ? "todos" : sel.kind === "categoria" ? sel.value : `linha-${sel.value}`;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Category sidebar */}
      <aside className="w-[200px] shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7B8D]">Categorias</p>
        </div>

        <button
          onClick={() => setSel({ kind: "todos" })}
          className={cn(
            "flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
            selSidebarKey === "todos" ? "bg-[#EFF6FF] text-[#2074B9]" : "text-[#1A1A1A] hover:bg-[#F8FAFC]"
          )}
        >
          <span>Todos</span>
          <span className="text-[11px] text-[#6B7B8D]">{produtos.length}</span>
        </button>

        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#B0BAC9]">Máquinas</p>
        </div>
        {LINHAS.map((l) => (
          <button
            key={l}
            onClick={() => setSel({ kind: "linha", value: l })}
            className={cn(
              "flex items-center justify-between mx-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors",
              selSidebarKey === `linha-${l}` ? "bg-[#EFF6FF] text-[#2074B9]" : "text-[#1A1A1A] hover:bg-[#F8FAFC]"
            )}
          >
            <span>{l}</span>
            <span className="text-[11px] text-[#6B7B8D]">{linhaCounts[l] ?? 0}</span>
          </button>
        ))}

        <div className="mx-2 my-2 border-t border-[#E2E8F0]" />

        <div className="px-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#B0BAC9]">Peças</p>
        </div>
        {CATS.map((c) => (
          <button
            key={c.value}
            onClick={() => setSel({ kind: "categoria", value: c.value })}
            className={cn(
              "flex items-center justify-between mx-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors",
              selSidebarKey === c.value ? "bg-[#EFF6FF] text-[#2074B9]" : "text-[#1A1A1A] hover:bg-[#F8FAFC]"
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-[#6B7B8D]">{c.icon}</span>
              {c.label}
            </span>
            <span className="text-[11px] text-[#6B7B8D]">{catCounts[c.value] ?? 0}</span>
          </button>
        ))}

        <div className="mx-2 mt-auto mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-[10px] font-bold text-amber-700 mb-1">Reajuste pendente</p>
          <p className="text-[11px] text-amber-600 leading-relaxed">
            Verifique produtos sem reajuste em 2026.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E2E8F0] bg-white">
            <div>
              <h2 className="text-[14px] font-bold text-[#1A1A1A]">
                {sel.kind === "todos" ? "Todos os Produtos" : sel.kind === "categoria"
                  ? CATS.find((c) => c.value === sel.value)?.label
                  : `Máquinas ${sel.value}`}
              </h2>
              <p className="text-[11px] text-[#6B7B8D]">{filtered.length} produtos</p>
            </div>
            <div className="flex-1" />
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] text-[12px] text-[#6B7B8D] hover:bg-[#F8FAFC] transition-colors">
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#2C4F79] hover:bg-[#1E3A5F] text-white text-[12px] font-semibold transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Novo Produto
            </button>
          </div>

          <div className="px-5 py-2.5 border-b border-[#E2E8F0] bg-white flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B0BAC9]" />
              <input
                type="text"
                placeholder="Buscar por código, descrição ou modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E2E8F0] text-[12px] focus:border-[#2074B9] outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="w-9 pl-4"><input type="checkbox" className="w-3.5 h-3.5 accent-[#2C4F79]" /></th>
                  <th className="text-left px-3 py-2.5 font-semibold text-[#6B7B8D] text-[11px] uppercase tracking-wide">Código</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-[#6B7B8D] text-[11px] uppercase tracking-wide">Descrição</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-[#6B7B8D] text-[11px] uppercase tracking-wide">Compatível com</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-[#6B7B8D] text-[11px] uppercase tracking-wide">Preço Unit.</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[#6B7B8D] text-[11px] uppercase tracking-wide">IPI</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-[#6B7B8D] text-[11px] uppercase tracking-wide">Último reajuste</th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => { setSelected(p); setShowReajuste(false); }}
                    className={cn(
                      "border-b border-[#F1F5F9] cursor-pointer transition-colors group",
                      selected?.id === p.id ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]"
                    )}
                  >
                    <td className="pl-4">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-[#2C4F79]" onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono font-bold text-[#DC2626] text-[11px]">CÓD. {p.codigo}</span>
                    </td>
                    <td className="px-3 py-3 max-w-[220px]">
                      <p className="font-semibold text-[#1A1A1A] truncate">{p.descricao}</p>
                      {p.specs && (
                        <p className="text-[10px] text-[#6B7B8D] truncate">
                          {Object.values(p.specs as Record<string, unknown>).slice(0, 2).map((v) => `${v}`).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.modelos_compat.slice(0, 3).map((m) => (
                          <span key={m} className="px-1.5 py-0.5 rounded-md bg-[#F1F5F9] text-[#6B7B8D] text-[10px] font-medium">{m}</span>
                        ))}
                        {p.modelos_compat.length > 3 && (
                          <span className="text-[10px] text-[#B0BAC9]">+{p.modelos_compat.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="font-mono font-semibold text-[#1A1A1A]">{fmtBRL(p.preco_brl)}</p>
                      {p.ultimo_reajuste_pct != null && (
                        <p className={cn("text-[10px] font-semibold flex items-center justify-end gap-0.5",
                          p.ultimo_reajuste_pct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                        )}>
                          {p.ultimo_reajuste_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {p.ultimo_reajuste_pct >= 0 ? "+" : ""}{p.ultimo_reajuste_pct.toFixed(1)}%
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-[11px] text-[#6B7B8D]">{p.ipi_pct.toFixed(2)}%</span>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-[#6B7B8D]">
                      {p.ultimo_reajuste_data
                        ? new Date(p.ultimo_reajuste_data).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-7 h-7 rounded-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] text-[#6B7B8D]" onClick={(e) => { e.stopPropagation(); setSelected(p); }}>
                          <Eye className="h-3 w-3" />
                        </button>
                        <button className="w-7 h-7 rounded-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] text-[#6B7B8D]" onClick={(e) => { e.stopPropagation(); setSelected(p); setShowReajuste(true); }}>
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-[13px] text-[#B0BAC9]">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <aside className="w-[300px] shrink-0 border-l border-[#E2E8F0] bg-white flex flex-col overflow-y-auto">
            <div className="p-5 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2 mb-3">
                <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                  selected.ativo ? "bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]" : "bg-[#F1F5F9] text-[#6B7B8D] border-[#E2E8F0]"
                )}>
                  {selected.ativo ? "Ativo" : "Inativo"}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-[#BFDBFE] bg-[#EFF6FF] text-[#2074B9]">
                  {CATS.find((c) => c.value === selected.categoria)?.label ?? selected.categoria}
                </span>
              </div>
              <h3 className="text-[14px] font-bold text-[#1A1A1A] leading-snug">{selected.descricao}</h3>
              <p className="text-[11px] text-[#6B7B8D] mt-1 font-mono">CÓD. {selected.codigo}{selected.ncm ? ` · NCM ${selected.ncm}` : ""}</p>
            </div>

            {selected.specs && (
              <div className="p-5 border-b border-[#E2E8F0]">
                <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-3">Especificações</p>
                {Object.entries(selected.specs as Record<string, unknown>).map(([specKey, specVal]) => (
                  <div key={specKey} className="flex justify-between py-1.5 border-b border-[#F1F5F9] last:border-0">
                    <span className="text-[12px] text-[#6B7B8D] capitalize">{specKey.replace(/_/g, " ")}</span>
                    <span className="text-[12px] font-semibold text-[#1A1A1A]">{String(specVal)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                  <span className="text-[12px] text-[#6B7B8D]">IPI</span>
                  <span className="text-[12px] font-semibold text-[#1A1A1A]">{selected.ipi_pct.toFixed(2)}%</span>
                </div>
                {selected.modelos_compat.length > 0 && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-[12px] text-[#6B7B8D]">Compatível</span>
                    <span className="text-[12px] font-semibold text-[#1A1A1A]">{selected.modelos_compat.join(", ")}</span>
                  </div>
                )}
              </div>
            )}

            <div className="p-5 border-b border-[#E2E8F0]">
              <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-2">Preço Atual</p>
              <p className="text-[28px] font-bold text-[#2C4F79] font-mono leading-none">{fmtBRL(selected.preco_brl)}</p>
              {selected.preco_brl != null && (
                <p className="text-[11px] text-[#6B7B8D] mt-1">
                  + IPI {selected.ipi_pct.toFixed(2)}% = {fmtBRL(selected.preco_brl * (1 + selected.ipi_pct / 100))}
                </p>
              )}
              <button
                onClick={() => setShowReajuste(!showReajuste)}
                className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[12px] text-[#2074B9] font-semibold transition-colors"
              >
                <span>Registrar reajuste</span>
                <ChevronRight className={cn("h-4 w-4 transition-transform", showReajuste && "rotate-90")} />
              </button>
              {showReajuste && <ReajusteForm produto={selected} />}
            </div>

            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-3">Histórico de preços</p>
              {selected.historico_precos.length === 0 ? (
                <p className="text-[12px] text-[#B0BAC9]">Sem registros de reajuste.</p>
              ) : (
                <>
                  <PriceChart historico={selected.historico_precos} />
                  <div className="mt-3 flex flex-col gap-2">
                    {[...selected.historico_precos]
                      .sort((a, b) => b.data_reajuste.localeCompare(a.data_reajuste))
                      .map((h) => (
                        <div key={h.id} className="flex items-center gap-2">
                          <span className="text-[11px] text-[#6B7B8D] w-16 shrink-0">
                            {new Date(h.data_reajuste).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                          </span>
                          <span className="text-[12px] font-mono font-semibold text-[#1A1A1A] flex-1">{fmtBRL(h.preco_novo_brl)}</span>
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded",
                            (h.percentual_reajuste ?? 0) >= 0
                              ? "bg-[#DCFCE7] text-[#16A34A]"
                              : "bg-red-50 text-red-600"
                          )}>
                            {(h.percentual_reajuste ?? 0) >= 0 ? "+" : ""}{(h.percentual_reajuste ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

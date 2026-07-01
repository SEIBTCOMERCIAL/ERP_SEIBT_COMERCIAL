"use client";

import { useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Search, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { reajustarPreco, type ReajusteFormState } from "@/app/actions/produtos";
import type { ProdutoComDetalhes, Categoriaproduto, HistoricoPreco } from "@/types/database";

interface Props {
  produtos: ProdutoComDetalhes[];
  taxaDolar: number;
}

const CATS: { label: string; value: Categoriaproduto }[] = [
  { label: "Navalhas",   value: "navalha"   },
  { label: "Peneiras",   value: "peneira"   },
  { label: "Rolamentos", value: "rolamento" },
  { label: "Parafusos",  value: "parafuso"  },
  { label: "Rotores",    value: "rotor"     },
  { label: "Insertos",   value: "inserto"   },
];

function fmtBRL(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SvgPriceChart({ historico }: { historico: HistoricoPreco[] }) {
  const items = [...historico]
    .filter((h) => h.preco_novo_brl != null)
    .sort((a, b) => a.data_reajuste.localeCompare(b.data_reajuste));

  if (items.length < 2) {
    return (
      <div className="h-16 flex items-center justify-center text-[11px] text-[#B0BAC9]">
        Dados insuficientes para o gráfico
      </div>
    );
  }

  const prices = items.map((h) => h.preco_novo_brl as number);
  const min = Math.min(...prices) * 0.9;
  const max = Math.max(...prices) * 1.05;
  const W = 260, H = 80;

  const toX = (i: number) => (i / (items.length - 1)) * (W - 24) + 12;
  const toY = (v: number) => H - 8 - ((v - min) / (max - min)) * (H - 20);

  const pts = items.map((h, i) => ({ x: toX(i), y: toY(h.preco_novo_brl as number) }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const areaD = `${d} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;

  return (
    <div>
      <p className="text-[10px] text-[#6B7B8D] mb-2">Evolução {items[0].data_reajuste.slice(0, 4)}–{items[items.length - 1].data_reajuste.slice(0, 4)} (R$)</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2074B9" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#2074B9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#priceGrad)" />
        <path d={d} fill="none" stroke="#2074B9" strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke="#2074B9" strokeWidth="1.5" />
        ))}
        {items.map((h, i) => (
          <text key={i} x={pts[i].x} y={H} textAnchor="middle" fontSize="8" fill="#B0BAC9">
            {h.data_reajuste.slice(0, 7).replace("-", "/")}
          </text>
        ))}
      </svg>
    </div>
  );
}

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-9 rounded-lg bg-[#2C4F79] hover:bg-[#1E3A5F] disabled:opacity-50 text-white text-[12px] font-semibold transition-colors mt-3"
    >
      {pending ? "Aplicando..." : "Confirmar reajuste"}
    </button>
  );
}

function DetailPanel({ produto, taxaDolar }: { produto: ProdutoComDetalhes; taxaDolar: number }) {
  const [novoPreco, setNovoPreco] = useState<number>(produto.preco_brl ?? 0);
  const [state, action] = useFormState<ReajusteFormState, FormData>(reajustarPreco, {});
  const atual = produto.preco_brl ?? 0;
  const diff = novoPreco - atual;
  const pct = atual > 0 ? (diff / atual) * 100 : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-[#E2E8F0]">
        <p className="text-[11px] font-mono text-[#6B7B8D]">CÓD. {produto.codigo}{produto.ncm ? ` · NCM ${produto.ncm}` : ""}</p>
        <h3 className="text-[15px] font-bold text-[#1A1A1A] mt-1 leading-snug">{produto.descricao}</h3>
        <p className="text-[11px] text-[#6B7B8D] mt-1">
          {produto.modelos_compat.join(" / ")}
          {produto.ipi_pct > 0 ? ` · IPI ${produto.ipi_pct.toFixed(2)}%` : ""}
        </p>
      </div>

      <div className="p-5 border-b border-[#E2E8F0]">
        <p className="text-[10px] font-semibold text-[#6B7B8D] uppercase tracking-wide mb-2">Preço atual</p>
        <p className="text-[28px] font-bold text-[#2C4F79] font-mono leading-none">{fmtBRL(produto.preco_brl)}</p>
        {produto.preco_brl != null && produto.ipi_pct > 0 && (
          <p className="text-[11px] text-[#6B7B8D] mt-1">
            Com IPI {produto.ipi_pct.toFixed(2)}%: {fmtBRL(produto.preco_brl * (1 + produto.ipi_pct / 100))} por conjunto
          </p>
        )}
        {produto.preco_usd != null && (
          <p className="text-[11px] text-[#6B7B8D] mt-0.5">USD: ${produto.preco_usd.toFixed(2)} · Câmbio R$ {taxaDolar.toFixed(2)}</p>
        )}

        <form action={action} className="mt-4">
          <input type="hidden" name="produto_id" value={produto.id} />

          <p className="text-[11px] font-bold text-[#1A1A1A] mb-3">Registrar reajuste</p>

          {state.message && <p className="text-[11px] text-red-600 mb-2">{state.message}</p>}
          {state.success && <p className="text-[11px] text-green-600 mb-2">Reajuste aplicado com sucesso.</p>}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] font-semibold text-[#6B7B8D] uppercase block mb-1">Novo preço (R$)</label>
              <input
                name="novo_preco"
                type="number"
                step="0.01"
                min="0"
                value={novoPreco}
                onChange={(e) => setNovoPreco(parseFloat(e.target.value) || 0)}
                className="w-full h-8 rounded-lg border border-[#E2E8F0] px-2 text-[12px] font-mono focus:border-[#2074B9] outline-none"
              />
              {state.errors?.novo_preco && <p className="text-[10px] text-red-500 mt-0.5">{state.errors.novo_preco[0]}</p>}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7B8D] uppercase block mb-1">Variação (%)</label>
              <input
                name="percentual"
                type="number"
                value={pct.toFixed(2)}
                readOnly
                className="w-full h-8 rounded-lg border border-[#E2E8F0] px-2 text-[12px] font-mono bg-[#F8FAFC] text-[#6B7B8D]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7B8D] uppercase block mb-1">Data vigência</label>
              <input
                name="data_vigencia"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full h-8 rounded-lg border border-[#E2E8F0] px-2 text-[12px] focus:border-[#2074B9] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#6B7B8D] uppercase block mb-1">Motivo</label>
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

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-[11px]">
            <div className="flex justify-between py-0.5">
              <span className="text-[#6B7B8D]">Preço atual</span>
              <span className="font-mono font-semibold">{fmtBRL(atual)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[#6B7B8D]">Reajuste aplicado</span>
              <span className={cn("font-mono font-semibold", diff >= 0 ? "text-[#D97706]" : "text-[#DC2626]")}>
                {diff >= 0 ? "+" : ""}{pct.toFixed(1)}% ({diff >= 0 ? "+" : ""}{fmtBRL(Math.abs(diff))})
              </span>
            </div>
            <div className="flex justify-between pt-1.5 mt-0.5 border-t border-[#E2E8F0]">
              <span className="font-semibold text-[#1A1A1A]">Novo preço</span>
              <span className="font-mono font-bold text-[#2C4F79]">{fmtBRL(novoPreco)}</span>
            </div>
          </div>

          <SubmitBtn />
        </form>
      </div>

      <div className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-3">Histórico de preços</p>
        <SvgPriceChart historico={produto.historico_precos} />
        <div className="mt-3 flex flex-col gap-2">
          {[...produto.historico_precos]
            .sort((a, b) => b.data_reajuste.localeCompare(a.data_reajuste))
            .map((h) => (
              <div key={h.id} className="flex items-center gap-2">
                <span className="text-[11px] text-[#6B7B8D] w-16 shrink-0">
                  {new Date(h.data_reajuste).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                </span>
                <span className="text-[12px] font-mono font-semibold text-[#1A1A1A] flex-1">{fmtBRL(h.preco_novo_brl)}</span>
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                  (h.percentual_reajuste ?? 0) > 0
                    ? "bg-[#DCFCE7] text-[#16A34A]"
                    : (h.percentual_reajuste ?? 0) < 0
                    ? "bg-red-50 text-red-600"
                    : "bg-[#F1F5F9] text-[#6B7B8D]"
                )}>
                  {(h.percentual_reajuste ?? 0) > 0 ? "+" : ""}{(h.percentual_reajuste ?? 0).toFixed(1)}%
                </span>
              </div>
            ))}
          {produto.historico_precos.length === 0 && (
            <p className="text-[12px] text-[#B0BAC9]">Sem registros ainda.</p>
          )}
        </div>
        <div className="mt-4 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[11px] text-[#6B7B8D] leading-relaxed">
          Todos os reajustes ficam registrados no histórico e afetam imediatamente propostas novas. Propostas já enviadas mantêm os preços originais.
        </div>
      </div>
    </div>
  );
}

export function HistoricoPrecos({ produtos, taxaDolar }: Props) {
  const [selectedCat, setSelectedCat] = useState<Categoriaproduto | "todos">("navalha");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProdutoComDetalhes | null>(produtos.find((p) => p.categoria === "navalha") ?? null);

  const semReajuste2026 = useMemo(
    () => produtos.filter((p) => {
      const ultimo = p.historico_precos.find((h) => h.data_reajuste >= "2026-01-01");
      return !ultimo;
    }),
    [produtos]
  );

  const filtered = useMemo(() => {
    let list = selectedCat === "todos" ? produtos : produtos.filter((p) => p.categoria === selectedCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.codigo.toLowerCase().includes(q) || p.descricao.toLowerCase().includes(q));
    }
    return list;
  }, [produtos, selectedCat, search]);

  const catCounts = useMemo(() => {
    const map: Partial<Record<Categoriaproduto, number>> = {};
    for (const p of produtos) {
      map[p.categoria] = (map[p.categoria] ?? 0) + 1;
    }
    return map;
  }, [produtos]);

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Left panel */}
      <aside className="w-[200px] shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7B8D]">Peças</p>
        </div>
        {CATS.map((c) => (
          <button
            key={c.value}
            onClick={() => { setSelectedCat(c.value); setSelected(null); }}
            className={cn(
              "flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-[13px] transition-colors",
              selectedCat === c.value ? "bg-[#EFF6FF] text-[#2074B9] font-semibold" : "text-[#1A1A1A] hover:bg-[#F8FAFC]"
            )}
          >
            {c.label}
            <span className="text-[11px] text-[#6B7B8D]">{catCounts[c.value] ?? 0}</span>
          </button>
        ))}

        {semReajuste2026.length > 0 && (
          <div className="mx-2 mt-auto mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <p className="text-[10px] font-bold text-amber-700">Reajuste pendente</p>
            </div>
            <p className="text-[11px] text-amber-600 leading-relaxed">
              {semReajuste2026.length} produto{semReajuste2026.length > 1 ? "s" : ""} sem reajuste em 2026.
            </p>
          </div>
        )}
      </aside>

      {/* List panel */}
      <div className="w-[280px] shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col">
        <div className="p-3 border-b border-[#E2E8F0] flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-[#1A1A1A] flex-1">
            {CATS.find((c) => c.value === selectedCat)?.label ?? "Todos"} — {filtered.length}
          </h2>
        </div>

        <div className="p-2 border-b border-[#E2E8F0]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#B0BAC9]" />
            <input
              type="text"
              placeholder="Filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 pl-7 pr-2 rounded-lg border border-[#E2E8F0] text-[12px] focus:border-[#2074B9] outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((p) => {
            const semReaj = !p.historico_precos.find((h) => h.data_reajuste >= "2026-01-01");
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[#F1F5F9] transition-colors",
                  selected?.id === p.id ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-[#DC2626]">CÓD. {p.codigo}</span>
                    <p className="text-[12px] font-semibold text-[#1A1A1A] truncate mt-0.5">{p.descricao}</p>
                    <p className="text-[10px] text-[#6B7B8D] truncate">
                      {p.modelos_compat.join(" / ")}
                      {p.ipi_pct > 0 ? ` · IPI ${p.ipi_pct.toFixed(2)}%` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-mono font-semibold text-[#1A1A1A]">{fmtBRL(p.preco_brl)}</p>
                    {p.ultimo_reajuste_pct != null ? (
                      <p className={cn("text-[10px] font-semibold flex items-center justify-end gap-0.5",
                        p.ultimo_reajuste_pct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                      )}>
                        {p.ultimo_reajuste_pct >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {p.ultimo_reajuste_pct >= 0 ? "+" : ""}{p.ultimo_reajuste_pct.toFixed(1)}%
                      </p>
                    ) : semReaj ? (
                      <p className="text-[10px] text-amber-600 font-semibold">sem reajuste</p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-[12px] text-[#B0BAC9]">Nenhum produto encontrado.</p>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 bg-white overflow-hidden">
        {selected ? (
          <DetailPanel produto={selected} taxaDolar={taxaDolar} />
        ) : (
          <div className="flex items-center justify-center h-full text-[13px] text-[#B0BAC9]">
            Selecione um produto para ver o histórico e registrar reajuste.
          </div>
        )}
      </div>
    </div>
  );
}

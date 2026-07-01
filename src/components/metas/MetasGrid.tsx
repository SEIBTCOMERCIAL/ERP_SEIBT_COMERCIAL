"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Target, Edit, Check, X } from "lucide-react";
import { salvarMeta, type MetaFormState } from "@/app/actions/metas";
import { formatCurrency } from "@/lib/utils";

const NAV = "#2C4F79";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Meta {
  id: string;
  usuario_id: string;
  mes: number;
  ano: number;
  meta_total_brl: number;
  meta_maquinas_brl: number | null;
  meta_pecas_brl: number | null;
  realizado_brl: number;
  realizado_maquinas_brl: number | null;
  realizado_pecas_brl: number | null;
}

interface Vendedor {
  id: string;
  nome: string;
  perfil: string;
}

interface Props {
  metas: Meta[];
  vendedores: Vendedor[];
  mesAtual: number;
  anoAtual: number;
}

function SubmitMetaBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: "8px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.7 : 1 }}>
      {pending ? "Salvando..." : "Salvar Meta"}
    </button>
  );
}

function EditarMetaForm({ vendedorId, vendedorNome, meta, mes, ano, onClose }: {
  vendedorId: string;
  vendedorNome: string;
  meta: Meta | null;
  mes: number;
  ano: number;
  onClose: () => void;
}) {
  const [state, action] = useFormState<MetaFormState, FormData>(salvarMeta, {});

  if (state.success) {
    return (
      <div style={{ padding: "12px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <Check size={16} color="#16a34a" />
        <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>Meta salva com sucesso!</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}><X size={16} color="#6b7b8d" /></button>
      </div>
    );
  }

  return (
    <form action={action} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
      <input type="hidden" name="usuario_id" value={vendedorId} />
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="ano" value={ano} />

      <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 14 }}>
        Editar Meta — {vendedorNome} · {MESES[mes - 1]}/{ano}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { name: "meta_total_brl", label: "Meta Total", defaultValue: meta?.meta_total_brl },
          { name: "meta_maquinas_brl", label: "Meta Máquinas", defaultValue: meta?.meta_maquinas_brl },
          { name: "meta_pecas_brl", label: "Meta Peças", defaultValue: meta?.meta_pecas_brl },
        ].map((f) => (
          <div key={f.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>
              {f.label}
            </label>
            <div style={{ display: "flex", border: `1px solid ${state.errors?.[f.name] ? "#dc2626" : BORDER}`, borderRadius: 6, overflow: "hidden" }}>
              <span style={{ padding: "8px 8px", background: BG, color: "#6b7b8d", fontSize: 12, borderRight: `1px solid ${BORDER}` }}>R$</span>
              <input
                type="number" name={f.name} step="0.01" defaultValue={f.defaultValue ?? ""}
                style={{ flex: 1, padding: "8px 10px", border: "none", outline: "none", fontSize: 13 }}
              />
            </div>
            {state.errors?.[f.name] && <span style={{ fontSize: 11, color: "#dc2626" }}>{state.errors[f.name]}</span>}
          </div>
        ))}
      </div>

      {state.message && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{state.message}</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" onClick={onClose} style={{ padding: "8px 14px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Cancelar
        </button>
        <SubmitMetaBtn />
      </div>
    </form>
  );
}

export function MetasGrid({ metas, vendedores, mesAtual, anoAtual }: Props) {
  const [mesSel, setMesSel] = useState(mesAtual);
  const [editando, setEditando] = useState<string | null>(null);

  // totais anuais
  const metaAnualTotal = metas.reduce((a, m) => a + m.meta_total_brl, 0);
  const realizadoAnualTotal = metas.reduce((a, m) => a + m.realizado_brl, 0);
  const metaAnualPct = metaAnualTotal > 0 ? Math.round((realizadoAnualTotal / metaAnualTotal) * 100) : 0;

  const getMetaVendedor = (userId: string) =>
    metas.find((m) => m.usuario_id === userId && m.mes === mesSel);

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Metas {anoAtual}</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>Acompanhamento de metas por vendedor e período.</p>
        </div>
      </div>

      {/* Banner anual */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, background: NAV, borderRadius: 12, padding: "18px 24px", marginBottom: 24 }}>
        {[
          { label: "Meta Anual Total", value: formatCurrency(metaAnualTotal), sub: `Equipe completa · ${anoAtual}` },
          { label: "Realizado até Ago", value: formatCurrency(realizadoAnualTotal), sub: "Soma de todos os meses" },
          { label: "% da Meta Anual", value: `${metaAnualPct}%`, sub: `Ritmo: projeção ${formatCurrency(realizadoAnualTotal / Math.max(mesAtual, 1) * 12)}` },
          { label: "Faltam no Ano", value: formatCurrency(Math.max(metaAnualTotal - realizadoAnualTotal, 0)), sub: `${12 - mesAtual} meses restantes` },
        ].map((item) => (
          <div key={item.label}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{item.value}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs por mês */}
      <div style={{ display: "flex", gap: 4, background: "#fff", padding: "4px 6px", borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 20, overflowX: "auto" as const }}>
        {MESES.map((m, i) => (
          <button
            key={m}
            onClick={() => setMesSel(i + 1)}
            style={{
              padding: "6px 14px", border: "none", background: mesSel === i + 1 ? NAV : "transparent",
              color: mesSel === i + 1 ? "#fff" : "#6b7b8d",
              borderRadius: 6, fontSize: 12, fontWeight: mesSel === i + 1 ? 700 : 400,
              cursor: "pointer", whiteSpace: "nowrap" as const,
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Meta cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
        {vendedores.map((v) => {
          const meta = getMetaVendedor(v.id);
          const pct = meta && meta.meta_total_brl > 0
            ? Math.round((meta.realizado_brl / meta.meta_total_brl) * 100)
            : 0;
          const pctColor = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
          const pctBg = pct >= 80 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#fee2e2";

          return (
            <div key={v.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: NAV }}>
                  {v.nome.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{v.nome}</div>
                  <div style={{ fontSize: 11, color: "#6b7b8d" }}>{v.perfil === "vendedor_interno" ? "Vendedor Interno" : "Representante"}</div>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 12, background: meta ? pctBg : "#f1f5f9", color: meta ? pctColor : "#6b7b8d", fontSize: 13, fontWeight: 800 }}>
                  {meta ? `${pct}%` : "—"}
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: "14px 16px" }}>
                {meta ? (
                  <>
                    {/* Barra de progresso */}
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pctColor, borderRadius: 4, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12 }}>
                      <span style={{ color: "#6b7b8d" }}>Realizado: <strong style={{ color: "#1a1a1a" }}>{formatCurrency(meta.realizado_brl)}</strong></span>
                      <span style={{ color: "#6b7b8d" }}>Meta: <strong style={{ color: "#1a1a1a" }}>{formatCurrency(meta.meta_total_brl)}</strong></span>
                    </div>
                    {/* Categorias */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        { label: "Máquinas", meta: meta.meta_maquinas_brl, real: meta.realizado_maquinas_brl },
                        { label: "Peças", meta: meta.meta_pecas_brl, real: meta.realizado_pecas_brl },
                      ].map((cat) => cat.meta ? (
                        <div key={cat.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#6b7b8d" }}>{cat.label}</span>
                          <span style={{ fontWeight: 600, color: "#374151" }}>{formatCurrency(cat.real ?? 0)} <span style={{ fontWeight: 400, color: "#9ca3af" }}>/ {formatCurrency(cat.meta)}</span></span>
                        </div>
                      ) : null)}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>Sem meta cadastrada para este período.</div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 16px", borderTop: `1px solid ${BORDER}`, background: BG, display: "flex", justifyContent: "flex-end" }}>
                {editando === v.id ? null : (
                  <button
                    onClick={() => setEditando(v.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: NAV, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    <Edit size={13} /> Editar meta
                  </button>
                )}
              </div>

              {editando === v.id && (
                <div style={{ padding: "0 16px 16px" }}>
                  <EditarMetaForm
                    vendedorId={v.id}
                    vendedorNome={v.nome}
                    meta={meta ?? null}
                    mes={mesSel}
                    ano={anoAtual}
                    onClose={() => setEditando(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabela comparativa */}
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: NAV, marginBottom: 14 }}>Comparativo Anual</div>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: BG }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, borderBottom: `1px solid ${BORDER}` }}>Vendedor</th>
                {MESES.map((m) => (
                  <th key={m} style={{ padding: "8px 10px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, borderBottom: `1px solid ${BORDER}` }}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{v.nome}</td>
                  {MESES.map((_, idx) => {
                    const m = metas.find((mt) => mt.usuario_id === v.id && mt.mes === idx + 1);
                    const pct = m && m.meta_total_brl > 0 ? Math.round((m.realizado_brl / m.meta_total_brl) * 100) : null;
                    return (
                      <td key={idx} style={{ padding: "10px 10px", textAlign: "center" }}>
                        {pct !== null ? (
                          <span style={{
                            padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                            background: pct >= 80 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#fee2e2",
                            color: pct >= 80 ? "#15803d" : pct >= 50 ? "#92400e" : "#dc2626",
                          }}>
                            {pct}%
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#d1d5db" }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Target icon for empty state */}
      {vendedores.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7b8d" }}>
          <Target size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <div>Nenhum vendedor cadastrado.</div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Trash2, Edit2, X } from "lucide-react";
import {
  criarPeca, editarPeca, excluirPeca,
  type AdminState,
} from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const SUCCESS = "#16A34A";

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

interface Peca {
  id: string;
  codigo: string;
  descricao: string;
  preco_brl: number | null;
  ipi_pct: number;
  ncm: string | null;
  ativo: boolean;
  ultimo_reajuste_data: string | null;
  ultimo_reajuste_pct: number | null;
}

interface Categoria { id: string; nome: string }

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "9px 20px", background: NAV, color: "#fff", border: "none",
        borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Salvando..." : label}
    </button>
  );
}

function PecaModal({
  categoria,
  peca,
  onClose,
}: {
  categoria: Categoria;
  peca?: Peca;
  onClose: () => void;
}) {
  const router = useRouter();
  const action = peca ? editarPeca : criarPeca;
  const [state, formAction] = useFormState<AdminState, FormData>(action, {});

  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  }, [state.success, router, onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 480, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: NAV, margin: 0 }}>
            {peca ? "Editar peça" : "Nova peça"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}>
            <X size={18} />
          </button>
        </div>
        <form action={formAction} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="categoria_peca_id" value={categoria.id} />
          {peca && <input type="hidden" name="id" value={peca.id} />}
          {state.error && (
            <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12 }}>{state.error}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>
                Código <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input name="codigo" required defaultValue={peca?.codigo} placeholder="ex: NAV-001"
                style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>NCM</label>
              <input name="ncm" defaultValue={peca?.ncm ?? ""} placeholder="ex: 82025000"
                style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>
              Descrição <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input name="descricao" required defaultValue={peca?.descricao} placeholder="ex: Navalha de corte MGHS-600 (jogo)"
              style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Preço unitário (R$)</label>
              <input name="preco_brl" type="number" min="0" step="0.01"
                defaultValue={peca?.preco_brl?.toString() ?? ""}
                style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>IPI (%)</label>
              <input name="ipi_pct" type="number" min="0" step="0.01"
                defaultValue={peca?.ipi_pct?.toString() ?? "0"}
                style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 18px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              Cancelar
            </button>
            <SubmitBtn label={peca ? "Salvar" : "Criar"} />
          </div>
        </form>
      </div>
    </div>
  );
}

export function CategoriaPecasView({
  isAdmin,
  categoria,
  pecas,
}: {
  isAdmin: boolean;
  categoria: Categoria;
  pecas: Peca[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<"criar" | { peca: Peca } | null>(null);

  const handleExcluir = (id: string, codigo: string) => {
    if (!confirm(`Excluir a peça "${codigo}"?`)) return;
    startTransition(async () => {
      const res = await excluirPeca(id, categoria.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 28 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7b8d", marginBottom: 20 }}>
        <span style={{ cursor: "pointer", color: BLUE }} onClick={() => router.push("/produtos")}>Produtos</span>
        <ChevronRight size={14} />
        <span style={{ color: NAV, fontWeight: 600 }}>{categoria.nome}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>{categoria.nome}</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>
            {pecas.length} peça{pecas.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModal("criar")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={16} /> Nova peça
          </button>
        )}
      </div>

      {pecas.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: "#6b7b8d" }}>
          Nenhuma peça cadastrada nesta categoria.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {pecas.map(p => {
          const totalComIpi = p.preco_brl != null && p.ipi_pct > 0
            ? p.preco_brl * (1 + p.ipi_pct / 100)
            : p.preco_brl;
          return (
            <div key={p.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAV }}>{p.codigo}</div>
                <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 3, lineHeight: 1.4 }}>{p.descricao}</div>
              </div>
              <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#6b7b8d" }}>Preço unit.</span>
                  <span style={{ fontWeight: 600 }}>{fmt(p.preco_brl)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#6b7b8d" }}>IPI</span>
                  <span style={{ color: "#374151" }}>{p.ipi_pct > 0 ? `${p.ipi_pct}%` : "—"}</span>
                </div>
                {p.ipi_pct > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
                    <span style={{ color: "#6b7b8d", fontWeight: 600 }}>Total c/ IPI</span>
                    <span style={{ fontWeight: 700, color: SUCCESS }}>{fmt(totalComIpi)}</span>
                  </div>
                )}
                {p.ultimo_reajuste_data && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
                    <span style={{ color: "#b0bac9" }}>Último reajuste</span>
                    <span style={{ color: "#6b7b8d" }}>
                      {fmtDate(p.ultimo_reajuste_data)}
                      {p.ultimo_reajuste_pct != null && ` (${p.ultimo_reajuste_pct > 0 ? "+" : ""}${p.ultimo_reajuste_pct.toFixed(1)}%)`}
                    </span>
                  </div>
                )}
              </div>
              {isAdmin && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: "8px 12px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => setModal({ peca: p })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: BLUE, display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                  <button
                    onClick={() => handleExcluir(p.id, p.codigo)}
                    disabled={isPending}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, opacity: isPending ? 0.5 : 1 }}
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <PecaModal
          categoria={categoria}
          peca={modal === "criar" ? undefined : modal.peca}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

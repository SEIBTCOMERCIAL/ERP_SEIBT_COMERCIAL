"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Trash2, Edit2, X } from "lucide-react";
import {
  criarEquipamento, editarEquipamento, excluirEquipamento,
  type AdminState,
} from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const SUCCESS = "#16A34A";

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

interface Equipamento {
  id: string;
  codigo: string;
  descricao: string;
  preco_brl: number | null;
  preco_painel_220: number | null;
  preco_painel_380: number | null;
  ncm: string | null;
  specs: Record<string, unknown> | null;
  ativo: boolean;
}

interface Linha { id: string; nome: string }

function SubmitBtn({ label, primary = true }: { label: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "9px 20px",
        background: primary ? NAV : BG,
        color: primary ? "#fff" : "#374151",
        border: `1px solid ${primary ? NAV : BORDER}`,
        borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: "pointer", opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Salvando..." : label}
    </button>
  );
}

function EquipamentoModal({
  linha,
  equip,
  onClose,
}: {
  linha: Linha;
  equip?: Equipamento;
  onClose: () => void;
}) {
  const router = useRouter();
  const action = equip ? editarEquipamento : criarEquipamento;
  const [state, formAction] = useFormState<AdminState, FormData>(action, {});

  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  }, [state.success, router, onClose]);

  const specsStr = equip?.specs ? JSON.stringify(equip.specs, null, 2) : "{}";

  const field = (
    name: string,
    label: string,
    opts: { type?: string; defaultValue?: string; placeholder?: string; required?: boolean; textarea?: boolean } = {}
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>
        {label}{opts.required && <span style={{ color: "#DC2626" }}> *</span>}
      </label>
      {opts.textarea ? (
        <textarea
          name={name}
          rows={5}
          defaultValue={opts.defaultValue}
          placeholder={opts.placeholder}
          style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical" }}
        />
      ) : (
        <input
          name={name}
          type={opts.type ?? "text"}
          defaultValue={opts.defaultValue}
          placeholder={opts.placeholder}
          required={opts.required}
          style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }}
        />
      )}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 560, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: NAV, margin: 0 }}>
            {equip ? "Editar equipamento" : "Novo equipamento"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}>
            <X size={18} />
          </button>
        </div>
        <form action={formAction} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="linha_id" value={linha.id} />
          {equip && <input type="hidden" name="id" value={equip.id} />}
          {state.error && (
            <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12 }}>{state.error}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {field("codigo", "Código", { required: true, defaultValue: equip?.codigo, placeholder: "ex: MGHS-1500" })}
            {field("ncm", "NCM", { defaultValue: equip?.ncm ?? "", placeholder: "ex: 84779000" })}
          </div>
          {field("descricao", "Descrição", { required: true, defaultValue: equip?.descricao, placeholder: "ex: Moinho de Facas MGHS 1500" })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {field("preco_brl", "Preço moinho (R$)", { type: "number", defaultValue: equip?.preco_brl?.toString() ?? "", placeholder: "0.00" })}
            {field("preco_painel_220", "Painel 220V (R$)", { type: "number", defaultValue: equip?.preco_painel_220?.toString() ?? "", placeholder: "0.00" })}
            {field("preco_painel_380", "Painel 380V (R$)", { type: "number", defaultValue: equip?.preco_painel_380?.toString() ?? "", placeholder: "0.00" })}
          </div>
          {field("specs", "Especificações (JSON)", { textarea: true, defaultValue: specsStr, placeholder: '{"potencia_cv": 50}' })}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 18px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              Cancelar
            </button>
            <SubmitBtn label={equip ? "Salvar" : "Criar"} />
          </div>
        </form>
      </div>
    </div>
  );
}

export function LinhaEquipamentosView({
  isAdmin,
  linha,
  equipamentos,
}: {
  isAdmin: boolean;
  linha: Linha;
  equipamentos: Equipamento[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<"criar" | { equip: Equipamento } | null>(null);

  const handleExcluir = (id: string, codigo: string) => {
    if (!confirm(`Excluir o equipamento "${codigo}"?`)) return;
    startTransition(async () => {
      const res = await excluirEquipamento(id, linha.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 28 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7b8d", marginBottom: 20 }}>
        <span
          style={{ cursor: "pointer", color: BLUE }}
          onClick={() => router.push("/produtos")}
        >
          Produtos
        </span>
        <ChevronRight size={14} />
        <span style={{ color: NAV, fontWeight: 600 }}>{linha.nome}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Linha {linha.nome}</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>
            {equipamentos.length} equipamento{equipamentos.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModal("criar")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 18px", background: NAV, color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={16} /> Novo equipamento
          </button>
        )}
      </div>

      {equipamentos.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: "#6b7b8d" }}>
          Nenhum equipamento cadastrado nesta linha.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {equipamentos.map(eq => {
          const total220 = (eq.preco_brl ?? 0) + (eq.preco_painel_220 ?? 0);
          const total380 = (eq.preco_brl ?? 0) + (eq.preco_painel_380 ?? 0);
          return (
            <div
              key={eq.id}
              style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}
            >
              {/* Header clicável */}
              <div
                style={{ padding: "16px 18px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                onClick={() => router.push(`/produtos/linhas/${linha.id}/${eq.id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAV }}>{eq.codigo}</div>
                    <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 2 }}>{eq.descricao}</div>
                  </div>
                  <ChevronRight size={16} color="#b0bac9" />
                </div>
              </div>

              {/* Preços */}
              <div style={{ padding: "12px 18px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#6b7b8d" }}>Moinho</span>
                    <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{fmt(eq.preco_brl)}</span>
                  </div>
                  {eq.preco_painel_220 != null && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#6b7b8d" }}>+ Painel 220V</span>
                        <span style={{ color: "#374151" }}>{fmt(eq.preco_painel_220)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 4 }}>
                        <span style={{ color: "#6b7b8d", fontWeight: 600 }}>Total 220V</span>
                        <span style={{ fontWeight: 700, color: SUCCESS }}>{fmt(total220)}</span>
                      </div>
                    </>
                  )}
                  {eq.preco_painel_380 != null && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#6b7b8d" }}>+ Painel 380V</span>
                        <span style={{ color: "#374151" }}>{fmt(eq.preco_painel_380)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 4 }}>
                        <span style={{ color: "#6b7b8d", fontWeight: 600 }}>Total 380V</span>
                        <span style={{ fontWeight: 700, color: SUCCESS }}>{fmt(total380)}</span>
                      </div>
                    </>
                  )}
                  {eq.preco_brl == null && eq.preco_painel_220 == null && (
                    <div style={{ fontSize: 12, color: "#b0bac9" }}>Preços não cadastrados</div>
                  )}
                </div>
              </div>

              {/* Ações admin */}
              {isAdmin && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: "8px 12px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => setModal({ equip: eq })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: BLUE, display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                  <button
                    onClick={() => handleExcluir(eq.id, eq.codigo)}
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
        <EquipamentoModal
          linha={linha}
          equip={modal === "criar" ? undefined : modal.equip}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

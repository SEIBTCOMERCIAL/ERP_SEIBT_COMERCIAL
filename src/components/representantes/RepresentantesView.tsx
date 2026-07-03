"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { UserPlus, X, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  criarRepresentante,
  atualizarRepresentante,
  toggleAtivoRepresentante,
  type RepresentanteFormState,
} from "@/app/actions/representantes";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

interface Representante {
  id: string;
  nome: string;
  tipo: string;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  observacoes: string | null;
}

interface Props {
  representantes: Representante[];
  regioes: { representante_id: string; estado: string | null; pais: string | null }[];
  propostas: { representante_id: string; status: string; valor_total: number | null; cliente_id: string | null }[];
}

type ModalState = { type: "criar" } | { type: "editar"; rep: Representante };

function SubmitBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: "10px 20px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
      {pending ? pendingLabel : label}
    </button>
  );
}

const inp = (state: RepresentanteFormState, field: string) =>
  state.errors?.[field as keyof typeof state.errors]?.[0];

function CriarForm({ onClose }: { onClose: () => void }) {
  const [state, action] = useFormState<RepresentanteFormState, FormData>(criarRepresentante, {});

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {state.message && (
        <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12 }}>{state.message}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Nome *</label>
          <input name="nome" required style={{ height: 36, border: `1px solid ${inp(state, "nome") ? "#DC2626" : BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
          {inp(state, "nome") && <span style={{ fontSize: 11, color: "#DC2626" }}>{inp(state, "nome")}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Tipo *</label>
          <select name="tipo" required style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, background: "#fff", outline: "none" }}>
            <option value="externo">Externo</option>
            <option value="interno_duplo">Interno/Duplo</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Empresa</label>
        <input name="empresa" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Telefone</label>
          <input name="telefone" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>E-mail</label>
          <input name="email" type="email" style={{ height: 36, border: `1px solid ${inp(state, "email") ? "#DC2626" : BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
          {inp(state, "email") && <span style={{ fontSize: 11, color: "#DC2626" }}>{inp(state, "email")}</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Observações</label>
        <textarea name="observacoes" rows={2} style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, outline: "none", resize: "vertical" as const }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" onClick={onClose} style={{ padding: "10px 18px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancelar</button>
        <SubmitBtn label="Criar Representante" pendingLabel="Salvando..." />
      </div>
    </form>
  );
}

function EditarForm({ rep, onClose }: { rep: Representante; onClose: () => void }) {
  const [state, action] = useFormState<RepresentanteFormState, FormData>(atualizarRepresentante, {});

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="id" value={rep.id} />
      {state.message && (
        <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12 }}>{state.message}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Nome *</label>
          <input name="nome" required defaultValue={rep.nome} style={{ height: 36, border: `1px solid ${inp(state, "nome") ? "#DC2626" : BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Tipo *</label>
          <select name="tipo" required defaultValue={rep.tipo} style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, background: "#fff", outline: "none" }}>
            <option value="externo">Externo</option>
            <option value="interno_duplo">Interno/Duplo</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Empresa</label>
        <input name="empresa" defaultValue={rep.empresa ?? ""} style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Telefone</label>
          <input name="telefone" defaultValue={rep.telefone ?? ""} style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>E-mail</label>
          <input name="email" type="email" defaultValue={rep.email ?? ""} style={{ height: 36, border: `1px solid ${inp(state, "email") ? "#DC2626" : BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
          {inp(state, "email") && <span style={{ fontSize: 11, color: "#DC2626" }}>{inp(state, "email")}</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Observações</label>
        <textarea name="observacoes" rows={2} defaultValue={rep.observacoes ?? ""} style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, outline: "none", resize: "vertical" as const }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" onClick={onClose} style={{ padding: "10px 18px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancelar</button>
        <SubmitBtn label="Salvar" pendingLabel="Salvando..." />
      </div>
    </form>
  );
}

export function RepresentantesView({ representantes, regioes, propostas }: Props) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggle = (rep: Representante) => {
    startTransition(async () => {
      const result = await toggleAtivoRepresentante(rep.id, rep.ativo);
      if (result.error) showToast("Erro: " + result.error);
      else showToast(rep.ativo ? "Representante desativado" : "Representante ativado");
    });
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 24 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, background: "#1a1a1a", color: "#fff", padding: "12px 18px", borderRadius: 10, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Representantes</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>{representantes.length} representante(s) cadastrado(s).</p>
        </div>
        <button
          onClick={() => setModal({ type: "criar" })}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <UserPlus size={16} /> Novo Representante
        </button>
      </div>

      {representantes.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: "#6b7b8d" }}>
          Nenhum representante cadastrado.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {representantes.map((rep) => {
          const regsRep = regioes.filter(r => r.representante_id === rep.id);
          const estados = regsRep.map(r => r.estado).filter(Boolean).slice(0, 6) as string[];
          const propRep = propostas.filter(p => p.representante_id === rep.id);
          const realizado = propRep
            .filter(p => p.status === "vendida")
            .reduce((a, p) => a + (p.valor_total ?? 0), 0);

          return (
            <div key={rep.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: NAV }}>
                      {rep.nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{rep.nome}</div>
                      {rep.empresa && <div style={{ fontSize: 12, color: "#6b7b8d" }}>{rep.empresa}</div>}
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: rep.ativo ? "#dcfce7" : "#fee2e2", color: rep.ativo ? "#15803d" : "#dc2626" }}>
                    {rep.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                {[
                  { label: "Realiz. mês", value: formatCurrency(realizado) },
                  { label: "Propostas",   value: String(propRep.length) },
                  { label: "Clientes",    value: String(new Set(propRep.map(p => p.cliente_id).filter(Boolean)).size) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: "center", padding: "8px 4px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{value}</div>
                    <div style={{ fontSize: 11, color: "#6b7b8d" }}>{label}</div>
                  </div>
                ))}
              </div>

              {estados.length > 0 && (
                <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Estados cobertos</div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                    {estados.map(e => (
                      <span key={e} style={{ padding: "2px 8px", background: "#eff6ff", color: BLUE, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}` }}>
                {rep.email && <div style={{ fontSize: 12, color: "#374151", marginBottom: 3 }}><span style={{ color: "#6b7b8d" }}>E-mail: </span>{rep.email}</div>}
                {rep.telefone && <div style={{ fontSize: 12, color: "#374151" }}><span style={{ color: "#6b7b8d" }}>Tel: </span>{rep.telefone}</div>}
              </div>

              <div style={{ padding: "10px 18px", display: "flex", gap: 8 }}>
                <button
                  onClick={() => setModal({ type: "editar", rep })}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer", color: "#374151" }}
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => handleToggle(rep)}
                  disabled={isPending}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer", color: rep.ativo ? "#dc2626" : "#16a34a", opacity: isPending ? 0.6 : 1 }}
                >
                  {rep.ativo ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                  {rep.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${BORDER}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: NAV, margin: 0 }}>
                {modal.type === "criar" ? "Novo Representante" : "Editar Representante"}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 22 }}>
              {modal.type === "criar"
                ? <CriarForm onClose={() => setModal(null)} />
                : <EditarForm rep={modal.rep} onClose={() => setModal(null)} />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

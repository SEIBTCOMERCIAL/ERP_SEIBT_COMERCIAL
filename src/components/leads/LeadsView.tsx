"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { criarLead, atualizarStatusLead, type LeadFormState } from "@/app/actions/leads";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  novo:            { label: "Novo",            bg: "#DBEAFE", color: "#1D4ED8" },
  em_qualificacao: { label: "Em qualificação", bg: "#FEF3C7", color: "#D97706" },
  qualificado:     { label: "Qualificado",     bg: "#DCFCE7", color: "#16A34A" },
  convertido:      { label: "Convertido",      bg: "#D1FAE5", color: "#059669" },
  descartado:      { label: "Descartado",      bg: "#FEE2E2", color: "#DC2626" },
};

const CANAIS = [
  { value: "whatsapp",    label: "WhatsApp" },
  { value: "email",       label: "E-mail" },
  { value: "feira",       label: "Feira" },
  { value: "site",        label: "Site" },
  { value: "indicacao",   label: "Indicação" },
  { value: "telefone",    label: "Telefone" },
  { value: "recorrencia", label: "Recorrência" },
  { value: "outro",       label: "Outro" },
];

const INTERESSES = [
  { value: "maquina",    label: "Máquina" },
  { value: "pecas",      label: "Peças" },
  { value: "sistema",    label: "Sistema" },
  { value: "servico",    label: "Serviço" },
  { value: "exportacao", label: "Exportação" },
];

interface Lead {
  id: string;
  empresa_nome: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  canal_entrada: string;
  tipo_interesse: string;
  status: string;
  observacoes: string | null;
  criado_em: string;
}

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: "10px 20px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
      {pending ? "Salvando..." : "Criar Lead"}
    </button>
  );
}

function NovoLeadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, action] = useFormState<LeadFormState, FormData>(criarLead, {});

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, router, onClose]);

  const inp = (field: string) => state.errors?.[field as keyof typeof state.errors]?.[0];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: NAV, margin: 0 }}>Novo Lead</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}><X size={18} /></button>
        </div>
        <form action={action} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {state.message && (
            <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12 }}>{state.message}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Empresa</label>
              <input name="empresa_nome" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Contato</label>
              <input name="contato_nome" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Telefone</label>
              <input name="contato_telefone" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>E-mail</label>
              <input name="contato_email" type="email" style={{ height: 36, border: `1px solid ${inp("contato_email") ? "#DC2626" : BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
              {inp("contato_email") && <span style={{ fontSize: 11, color: "#DC2626" }}>{inp("contato_email")}</span>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Canal de entrada</label>
              <select name="canal_entrada" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, background: "#fff", outline: "none" }}>
                {CANAIS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Interesse</label>
              <select name="tipo_interesse" style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, background: "#fff", outline: "none" }}>
                {INTERESSES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Observações</label>
            <textarea name="observacoes" rows={3} style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, outline: "none", resize: "vertical" as const }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 18px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancelar</button>
            <SubmitBtn />
          </div>
        </form>
      </div>
    </div>
  );
}

export function LeadsView({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>("todos");
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (id: string, novoStatus: string) => {
    startTransition(async () => {
      await atualizarStatusLead(id, novoStatus);
      router.refresh();
    });
  };

  const filtered = filter === "todos" ? leads : leads.filter(l => l.status === filter);

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Leads</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>{leads.length} lead(s) cadastrado(s).</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <UserPlus size={16} /> Novo Lead
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" as const }}>
        {[
          { value: "todos", label: "Todos" },
          ...Object.entries(STATUS_LABELS).map(([value, { label }]) => ({ value, label })),
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${filter === opt.value ? NAV : BORDER}`,
              background: filter === opt.value ? NAV : "#fff",
              color: filter === opt.value ? "#fff" : "#374151",
            }}
          >
            {opt.label}
            {opt.value !== "todos" && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{leads.filter(l => l.status === opt.value).length}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: "#6b7b8d" }}>
          Nenhum lead encontrado.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {filtered.map(lead => {
          const st = STATUS_LABELS[lead.status] ?? { label: lead.status, bg: "#F1F5F9", color: "#6B7B8D" };
          const interesse = INTERESSES.find(i => i.value === lead.tipo_interesse)?.label ?? lead.tipo_interesse;
          const canal = CANAIS.find(c => c.value === lead.canal_entrada)?.label ?? lead.canal_entrada;

          return (
            <div key={lead.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>
                    {lead.empresa_nome ?? lead.contato_nome ?? "Lead sem nome"}
                  </div>
                  {lead.empresa_nome && lead.contato_nome && (
                    <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 2 }}>{lead.contato_nome}</div>
                  )}
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, whiteSpace: "nowrap" as const }}>
                  {st.label}
                </span>
              </div>

              <div style={{ padding: "12px 18px", display: "flex", gap: 8, flexWrap: "wrap" as const, borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ padding: "2px 8px", background: "#eff6ff", color: BLUE, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{interesse}</span>
                <span style={{ padding: "2px 8px", background: "#F1F5F9", color: "#6b7b8d", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{canal}</span>
              </div>

              <div style={{ padding: "10px 18px", borderBottom: `1px solid ${BORDER}` }}>
                {lead.contato_telefone && <div style={{ fontSize: 12, color: "#374151", marginBottom: 2 }}><span style={{ color: "#6b7b8d" }}>Tel: </span>{lead.contato_telefone}</div>}
                {lead.contato_email && <div style={{ fontSize: 12, color: "#374151" }}><span style={{ color: "#6b7b8d" }}>E-mail: </span>{lead.contato_email}</div>}
                {!lead.contato_telefone && !lead.contato_email && (
                  <div style={{ fontSize: 12, color: "#B0BAC9" }}>Sem contato registrado</div>
                )}
              </div>

              <div style={{ padding: "10px 18px" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const, display: "block", marginBottom: 5 }}>Atualizar status</label>
                <select
                  value={lead.status}
                  onChange={e => handleStatusChange(lead.id, e.target.value)}
                  disabled={isPending}
                  style={{ width: "100%", height: 32, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "0 8px", fontSize: 12, background: "#fff", cursor: "pointer", outline: "none", opacity: isPending ? 0.6 : 1 }}
                >
                  {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && <NovoLeadModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

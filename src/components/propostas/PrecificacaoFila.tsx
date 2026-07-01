"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Clock, Zap, CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
import { responderSolicitacao, type PrecificacaoFormState } from "@/app/actions/precificacao";
import { formatDate } from "@/lib/utils";

const NAV = "#2C4F79";
const BORDER = "#E2E8F0";

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Pendente", color: "#dc2626", bg: "#fee2e2" },
  em_analise: { label: "Em Análise", color: "#d97706", bg: "#fef3c7" },
  respondida: { label: "Respondida", color: "#16a34a", bg: "#f0fdf4" },
  cancelada: { label: "Cancelada", color: "#6b7b8d", bg: "#f1f5f9" },
};

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: "7px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.7 : 1 }}>
      {pending ? "Enviando..." : label}
    </button>
  );
}

function ResponderForm({ solicitacaoId, onClose }: { solicitacaoId: string; onClose: () => void }) {
  const [state, action] = useFormState<PrecificacaoFormState, FormData>(responderSolicitacao, {});

  if (state.success) {
    return (
      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <CheckCircle2 size={16} color="#16a34a" />
        <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>Resposta registrada com sucesso.</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}><X size={16} color="#6b7b8d" /></button>
      </div>
    );
  }

  return (
    <form action={action} style={{ background: "#f8fafc", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, marginTop: 12 }}>
      <input type="hidden" name="solicitacao_id" value={solicitacaoId} />
      <div style={{ fontWeight: 600, fontSize: 13, color: NAV, marginBottom: 12 }}>Responder Solicitação</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>
            Preço Respondido (R$) <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="number" name="preco_respondido" step="0.01"
            placeholder="ex: 8500.00"
            style={{ padding: "8px 10px", border: `1px solid ${state.errors?.preco_respondido ? "#dc2626" : BORDER}`, borderRadius: 6, fontSize: 13 }}
          />
          {state.errors?.preco_respondido && <span style={{ fontSize: 11, color: "#dc2626" }}>{state.errors.preco_respondido}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>
            Resposta / Justificativa <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <textarea
            name="resposta_engenharia" rows={2} placeholder="Descreva o preço e as condições técnicas..."
            style={{ padding: "8px 10px", border: `1px solid ${state.errors?.resposta_engenharia ? "#dc2626" : BORDER}`, borderRadius: 6, fontSize: 13, resize: "vertical" }}
          />
          {state.errors?.resposta_engenharia && <span style={{ fontSize: 11, color: "#dc2626" }}>{state.errors.resposta_engenharia}</span>}
        </div>
      </div>
      {state.message && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{state.message}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} style={{ padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Cancelar
        </button>
        <SubmitBtn label="Registrar Resposta" />
      </div>
    </form>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PrecificacaoFila({ solicitacoes }: { solicitacoes: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pendente" | "em_analise" | "respondida">("pendente");

  const filtered = solicitacoes.filter((s) =>
    activeTab === "respondida" ? s.status === "respondida" : s.status === "pendente" || s.status === "em_analise"
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: "#f8fafc" }}>
        {([
          { key: "pendente", label: "Pendentes" },
          { key: "em_analise", label: "Em Análise" },
          { key: "respondida", label: "Respondidas" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? NAV : "#6b7b8d",
              borderBottom: activeTab === tab.key ? `2px solid ${NAV}` : "2px solid transparent",
            }}
          >
            {tab.label} ({solicitacoes.filter((s) => s.status === tab.key).length})
          </button>
        ))}
      </div>

      {/* Lista */}
      <div>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#6b7b8d", fontSize: 14 }}>
            Nenhuma solicitação encontrada.
          </div>
        )}
        {filtered.map((s) => {
          const status = STATUS_LABEL[s.status] ?? STATUS_LABEL.pendente;
          const isExpanded = expanded === s.id;
          return (
            <div key={s.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div
                style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                onClick={() => setExpanded(isExpanded ? null : s.id)}
              >
                {s.urgente && (
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Zap size={16} color="#7c3aed" />
                  </div>
                )}
                {!s.urgente && (
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Clock size={16} color="#6b7b8d" />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{s.item_descricao}</div>
                  <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 2 }}>
                    Proposta {s.proposta?.numero_completo ?? "—"} · Solicitado por {s.solicitante?.nome ?? "—"} · {formatDate(s.criado_em)}
                  </div>
                </div>
                <span style={{
                  padding: "3px 10px", borderRadius: 12,
                  background: status.bg, color: status.color,
                  fontSize: 11, fontWeight: 700,
                }}>
                  {status.label}
                </span>
                {s.urgente && (
                  <span style={{ padding: "2px 8px", background: "#f5f3ff", color: "#7c3aed", fontSize: 10, fontWeight: 700, borderRadius: 10 }}>URGENTE</span>
                )}
                {isExpanded ? <ChevronUp size={16} color="#6b7b8d" /> : <ChevronDown size={16} color="#6b7b8d" />}
              </div>

              {isExpanded && (
                <div style={{ padding: "0 20px 16px 60px" }}>
                  {s.especificacoes && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const, marginBottom: 4 }}>Especificações</div>
                      <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>{s.especificacoes}</div>
                    </div>
                  )}
                  {s.prazo_desejado && (
                    <div style={{ fontSize: 12, color: "#6b7b8d", marginBottom: 8 }}>
                      Prazo desejado: <strong>{formatDate(s.prazo_desejado)}</strong>
                    </div>
                  )}
                  {s.status === "respondida" && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>Resposta da Engenharia</div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{s.resposta_engenharia}</div>
                      {s.preco_respondido && (
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#15803d", marginTop: 6 }}>
                          R$ {Number(s.preco_respondido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  )}
                  {(s.status === "pendente" || s.status === "em_analise") && (
                    responding === s.id ? (
                      <ResponderForm solicitacaoId={s.id} onClose={() => setResponding(null)} />
                    ) : (
                      <button
                        onClick={() => setResponding(s.id)}
                        style={{ padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        Responder Solicitação
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

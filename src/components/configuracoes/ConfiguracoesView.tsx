"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, CheckCircle2, DollarSign, GitBranch } from "lucide-react";
import {
  atualizarCambio,
  criarEtapaFunil,
  atualizarEtapaFunil,
  toggleEtapaFunil,
  excluirEtapaFunil,
  criarFunil,
  type CambioState,
  type EtapaState,
} from "@/app/actions/configuracoes";

const NAV = "#2C4F79";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";
const SUCCESS = "#16A34A";

interface Taxa {
  id: string;
  taxa: number;
  vigente_desde: string;
  criado_em: string;
}

interface Funil {
  id: string;
  nome: string;
}

interface Etapa {
  id: string;
  funil_id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

function SaveBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ padding: "9px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.7 : 1 }}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function CambioSection({ taxaAtual, historico }: { taxaAtual: number | null; historico: Taxa[] }) {
  const [state, action] = useFormState<CambioState, FormData>(atualizarCambio, {});
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${SUCCESS}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <DollarSign size={16} color={SUCCESS} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV }}>Câmbio USD</div>
          <div style={{ fontSize: 12, color: "#6b7b8d" }}>Taxa atual para cotações em dólar</div>
        </div>
      </div>
      <div style={{ padding: 20 }}>
        {taxaAtual && (
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 4 }}>Taxa vigente</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: NAV }}>R$ {taxaAtual.toFixed(4)}</div>
            </div>
          </div>
        )}
        {state.success && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <CheckCircle2 size={16} color={SUCCESS} />
            <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>Taxa atualizada com sucesso.</span>
          </div>
        )}
        {state.error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
            {state.error}
          </div>
        )}
        <form action={action} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151", letterSpacing: "0.04em" }}>
              Nova taxa (R$/USD) *
            </label>
            <input
              type="number"
              name="taxa"
              step="0.0001"
              min="0.01"
              placeholder="ex: 5.4500"
              required
              style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}
            />
          </div>
          <SaveBtn label="Atualizar" pendingLabel="Salvando..." />
        </form>
        {historico.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#2074B9", fontWeight: 600 }}
            >
              {showHistory ? "Ocultar histórico" : `Ver histórico (${historico.length} registros)`}
            </button>
            {showHistory && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
                <thead>
                  <tr style={{ background: BG }}>
                    {["Data", "Taxa (R$/USD)"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historico.map((t) => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "#6b7b8d" }}>
                        {new Date(t.vigente_desde).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: NAV }}>R$ {t.taxa.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EtapaRow({
  etapa,
  onEdit,
  onDelete,
  onToggle,
}: {
  etapa: Etapa;
  onEdit: (e: Etapa) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, ativo: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr style={{ borderBottom: `1px solid ${BORDER}`, opacity: etapa.ativo ? 1 : 0.55 }}>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: etapa.cor, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{etapa.nome}</span>
        </div>
      </td>
      <td style={{ padding: "10px 14px", fontSize: 13, color: "#6b7b8d" }}>{etapa.ordem}</td>
      <td style={{ padding: "10px 14px" }}>
        <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: etapa.ativo ? "#dcfce7" : "#f3f4f6", color: etapa.ativo ? "#15803d" : "#6b7b8d" }}>
          {etapa.ativo ? "Ativa" : "Inativa"}
        </span>
      </td>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onEdit(etapa)}
            style={{ padding: "4px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <Edit2 size={12} /> Editar
          </button>
          <button
            onClick={() => startTransition(async () => { onToggle(etapa.id, !etapa.ativo); })}
            disabled={isPending}
            style={{ padding: "4px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: etapa.ativo ? "#d97706" : SUCCESS }}
          >
            {etapa.ativo ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
            {etapa.ativo ? "Desativar" : "Ativar"}
          </button>
          <button
            onClick={() => { if (confirm(`Excluir etapa "${etapa.nome}"?`)) onDelete(etapa.id); }}
            style={{ padding: "4px 8px", border: `1px solid #fca5a5`, borderRadius: 6, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#dc2626" }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CriarEtapaForm({ funilId, onClose }: { funilId: string; onClose: (refresh?: boolean) => void }) {
  const [state, action] = useFormState<EtapaState, FormData>(criarEtapaFunil, {});

  useEffect(() => {
    if (state.success) onClose(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
      <input type="hidden" name="funil_id" value={funilId} />
      {state.error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>{state.error}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151" }}>Nome *</label>
        <input type="text" name="nome" required placeholder="ex: Proposta Enviada" style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151" }}>Cor</label>
          <input type="color" name="cor" defaultValue="#2074B9" style={{ padding: 2, border: `1px solid ${BORDER}`, borderRadius: 6, height: 36, cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151" }}>Ordem</label>
          <input type="number" name="ordem" defaultValue={99} min={1} style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        <button type="button" onClick={() => onClose()} style={{ padding: "8px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#fff" }}>Cancelar</button>
        <SaveBtn label="Criar etapa" pendingLabel="Criando..." />
      </div>
    </form>
  );
}

function EditarEtapaForm({ etapa, onClose }: { etapa: Etapa; onClose: (refresh?: boolean) => void }) {
  const [state, action] = useFormState<EtapaState, FormData>(atualizarEtapaFunil, {});

  useEffect(() => {
    if (state.success) onClose(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
      <input type="hidden" name="id" value={etapa.id} />
      {state.error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>{state.error}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151" }}>Nome *</label>
        <input type="text" name="nome" defaultValue={etapa.nome} required style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151" }}>Cor</label>
          <input type="color" name="cor" defaultValue={etapa.cor} style={{ padding: 2, border: `1px solid ${BORDER}`, borderRadius: 6, height: 36, cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151" }}>Ordem</label>
          <input type="number" name="ordem" defaultValue={etapa.ordem} min={1} style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        <button type="button" onClick={() => onClose()} style={{ padding: "8px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#fff" }}>Cancelar</button>
        <SaveBtn label="Salvar" pendingLabel="Salvando..." />
      </div>
    </form>
  );
}

function CriarFunilForm({ onClose }: { onClose: (refresh?: boolean) => void }) {
  const [state, action] = useFormState<EtapaState, FormData>(criarFunil, {});

  useEffect(() => {
    if (state.success) onClose(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
      {state.error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>{state.error}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151" }}>Nome do funil *</label>
        <input type="text" name="nome" required placeholder="ex: Funil de Vendas" style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        <button type="button" onClick={() => onClose()} style={{ padding: "8px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#fff" }}>Cancelar</button>
        <SaveBtn label="Criar funil" pendingLabel="Criando..." />
      </div>
    </form>
  );
}

export function ConfiguracoesView({
  taxaAtual,
  historicoCambio,
  funis,
  etapas,
}: {
  taxaAtual: number | null;
  historicoCambio: Taxa[];
  funis: Funil[];
  etapas: Etapa[];
}) {
  const [selectedFunil, setSelectedFunil] = useState<string>(funis[0]?.id ?? "");
  const [localEtapas, setLocalEtapas] = useState(etapas);
  const [modal, setModal] = useState<
    | { type: "criar_etapa" }
    | { type: "editar_etapa"; etapa: Etapa }
    | { type: "criar_funil" }
    | null
  >(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function closeModal(refresh?: boolean) {
    setModal(null);
    if (refresh) window.location.reload();
  }

  async function handleToggle(id: string, ativo: boolean) {
    const res = await toggleEtapaFunil(id, ativo);
    if (res?.error) {
      showToast(`Erro: ${res.error}`);
    } else {
      setLocalEtapas((prev) => prev.map((e) => (e.id === id ? { ...e, ativo } : e)));
    }
  }

  async function handleDelete(id: string) {
    const res = await excluirEtapaFunil(id);
    if (res?.error) {
      showToast(`Erro: ${res.error}`);
    } else {
      setLocalEtapas((prev) => prev.filter((e) => e.id !== id));
      showToast("Etapa removida.");
    }
  }

  const etapasFunil = localEtapas.filter((e) => e.funil_id === selectedFunil).sort((a, b) => a.ordem - b.ordem);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, background: NAV, color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: "#6b7b8d", marginTop: 4 }}>Câmbio, funil de vendas e etapas do pipeline.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <CambioSection taxaAtual={taxaAtual} historico={historicoCambio} />

        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${NAV}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <GitBranch size={16} color={NAV} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: NAV }}>Funil de Vendas</div>
                <div style={{ fontSize: 12, color: "#6b7b8d" }}>Etapas do pipeline de propostas</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {funis.length === 0 && (
                <button onClick={() => setModal({ type: "criar_funil" })}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={13} /> Criar Funil
                </button>
              )}
              {funis.length > 0 && (
                <button onClick={() => setModal({ type: "criar_etapa" })}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  <Plus size={13} /> Nova Etapa
                </button>
              )}
            </div>
          </div>

          {funis.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
              Nenhum funil criado. Crie o primeiro funil para gerenciar as etapas.
            </div>
          ) : (
            <>
              {funis.length > 1 && (
                <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
                  {funis.map((f) => (
                    <button key={f.id} onClick={() => setSelectedFunil(f.id)}
                      style={{ padding: "6px 14px", border: `2px solid ${selectedFunil === f.id ? NAV : BORDER}`, borderRadius: 8, background: selectedFunil === f.id ? NAV : "#fff", color: selectedFunil === f.id ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      {f.nome}
                    </button>
                  ))}
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                    {["Etapa", "Ordem", "Status", "Ações"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {etapasFunil.map((e) => (
                    <EtapaRow key={e.id} etapa={e} onEdit={(etapa) => setModal({ type: "editar_etapa", etapa })} onDelete={handleDelete} onToggle={handleToggle} />
                  ))}
                  {etapasFunil.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 30, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>Nenhuma etapa cadastrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: NAV, margin: 0 }}>
                {modal.type === "criar_etapa" && "Nova Etapa"}
                {modal.type === "editar_etapa" && "Editar Etapa"}
                {modal.type === "criar_funil" && "Novo Funil"}
              </h2>
              <button onClick={() => closeModal()} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="#6b7b8d" />
              </button>
            </div>
            {modal.type === "criar_etapa" && <CriarEtapaForm funilId={selectedFunil} onClose={closeModal} />}
            {modal.type === "editar_etapa" && <EditarEtapaForm etapa={modal.etapa} onClose={closeModal} />}
            {modal.type === "criar_funil" && <CriarFunilForm onClose={closeModal} />}
          </div>
        </div>
      )}
    </div>
  );
}

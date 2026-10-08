"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, DollarSign, BellRing } from "lucide-react";
import {
  atualizarCambio,
  salvarPrazosInatividade,
  type CambioState,
  type InatividadeState,
} from "@/app/actions/configuracoes";
import { FunilSection, MotivosSection, type EtapaConfig, type MotivoConfig } from "./FunilMotivosAdmin";

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

interface PrazoInatividade {
  tipo: string;
  dias_alerta: number;
  dias_escalonamento_admin: number;
  atualizado_em: string;
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

const TIPOS_INATIVIDADE = [
  { value: "maquina", label: "Máquinas" },
  { value: "pecas", label: "Peças" },
  { value: "sistema", label: "Sistemas" },
  { value: "servico", label: "Serviços" },
  { value: "mista", label: "Mistas" },
] as const;

function InatividadeSection({ prazos, podeEditar, pendente }: { prazos: PrazoInatividade[]; podeEditar: boolean; pendente: boolean }) {
  const [state, action] = useFormState<InatividadeState, FormData>(salvarPrazosInatividade, {});
  const prazoMap = new Map(prazos.map((prazo) => [prazo.tipo, prazo]));

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BellRing size={16} color="#D97706" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV }}>Propostas sem movimentação</div>
          <div style={{ fontSize: 12, color: "#6b7b8d" }}>Prazos por tipo; somente o administrador pode alterar</div>
        </div>
      </div>
      <form action={action} style={{ padding: 20 }}>
        {state.success && <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#15803d", fontWeight: 600, marginBottom: 14 }}>Prazos atualizados com sucesso.</div>}
        {state.error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{state.error}</div>}
        {pendente && <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e", marginBottom: 14 }}>Estes prazos passam a valer depois da atualização do banco de dados do CRM (arquivo 022). Até lá, as propostas usam 7 dias para todos os tipos.</div>}
        {!podeEditar && <div style={{ fontSize: 12, color: "#6b7b8d", marginBottom: 12 }}>Somente o administrador pode alterar estes prazos.</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead><tr style={{ background: BG }}>{["Tipo", "Alertar responsável após", "Alertar administrador após"].map((h) => <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, borderBottom: `1px solid ${BORDER}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {TIPOS_INATIVIDADE.map((tipo) => {
                const atual = prazoMap.get(tipo.value);
                return (
                  <tr key={tipo.value} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: NAV }}>{tipo.label}</td>
                    <td style={{ padding: "10px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><input name={`${tipo.value}_alerta`} type="number" min={1} max={365} required disabled={!podeEditar || pendente} defaultValue={atual?.dias_alerta ?? 7} style={{ width: 76, padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} /><span style={{ fontSize: 12, color: "#6b7b8d" }}>dias</span></div></td>
                    <td style={{ padding: "10px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><input name={`${tipo.value}_admin`} type="number" min={1} max={365} required disabled={!podeEditar || pendente} defaultValue={atual?.dias_escalonamento_admin ?? 15} style={{ width: 76, padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} /><span style={{ fontSize: 12, color: "#6b7b8d" }}>dias</span></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {podeEditar && !pendente && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><SaveBtn label="Salvar prazos" pendingLabel="Salvando..." /></div>}
      </form>
    </div>
  );
}

export function ConfiguracoesView({
  taxaAtual,
  historicoCambio,
  funis,
  etapas,
  prazosInatividade,
  podeEditarPrazos,
  prazosPendentes,
  motivos,
  ehAdmin,
  funilPendente,
  motivosPendentes,
}: {
  taxaAtual: number | null;
  historicoCambio: Taxa[];
  funis: Funil[];
  etapas: EtapaConfig[];
  prazosInatividade: PrazoInatividade[];
  podeEditarPrazos: boolean;
  prazosPendentes: boolean;
  motivos: MotivoConfig[];
  ehAdmin: boolean;
  funilPendente: boolean;
  motivosPendentes: boolean;
}) {
  return (
    <div style={{ padding: "24px 16px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: "#6b7b8d", marginTop: 4 }}>Câmbio, prazos de acompanhamento, funil de vendas e motivos padrão.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <CambioSection taxaAtual={taxaAtual} historico={historicoCambio} />
        <InatividadeSection prazos={prazosInatividade} podeEditar={podeEditarPrazos} pendente={prazosPendentes} />
        <FunilSection funis={funis} etapas={etapas} ehAdmin={ehAdmin} estruturaPendente={funilPendente} />
        <MotivosSection motivos={motivos} ehAdmin={ehAdmin} estruturaPendente={motivosPendentes} />
      </div>
    </div>
  );
}

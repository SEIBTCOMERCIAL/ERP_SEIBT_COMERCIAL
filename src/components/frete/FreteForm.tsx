"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  Package, Truck, MapPin, CheckCircle2, FileText, Download,
} from "lucide-react";
import { criarFicha, type FreteFormState } from "@/app/actions/frete";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: "10px 24px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.7 : 1 }}>
      {pending ? "Salvando..." : "Salvar Ficha de Frete"}
    </button>
  );
}

function SectionTitle({ icon: Icon, label, color }: { icon: LucideIcon; label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color={color} />
      </div>
      <span style={{ fontWeight: 700, fontSize: 14, color: NAV }}>{label}</span>
    </div>
  );
}

function Field({ label, name, type = "text", required, placeholder, defaultValue, error }: {
  label: string; name: string; type?: string; required?: boolean;
  placeholder?: string; defaultValue?: string; error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </label>
      <input
        type={type} name={name} defaultValue={defaultValue} placeholder={placeholder ?? label}
        style={{ padding: "8px 10px", border: `1px solid ${error ? "#dc2626" : BORDER}`, borderRadius: 6, fontSize: 13 }}
      />
      {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
    </div>
  );
}

export function FreteForm() {
  const [state, action] = useFormState<FreteFormState, FormData>(criarFicha, {});
  const [tipoFrete, setTipoFrete] = useState<"cif" | "fob">("cif");
  const [activePreview, setActivePreview] = useState<"cliente" | "transportadora">("cliente");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Form Panel */}
      <div style={{ overflow: "auto", padding: 24, background: BG }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: NAV, margin: 0 }}>Nova Ficha de Frete</h1>
          <p style={{ fontSize: 13, color: "#6b7b8d", marginTop: 4 }}>Preencha os dados para gerar os folders de frete.</p>
        </div>

        {state.success && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>Ficha criada! Agora gere os folders no painel de prévia.</span>
          </div>
        )}

        {state.message && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
            {state.message}
          </div>
        )}

        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Pedido Vinculado */}
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <SectionTitle icon={FileText} label="Pedido Vinculado" color="#16a34a" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Nº Pedido DEZ" name="pedido_numero" placeholder="ex: 12345" />
              <Field label="ID Proposta (opcional)" name="proposta_id" placeholder="UUID da proposta" />
            </div>
          </div>

          {/* Produto / Carga */}
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <SectionTitle icon={Package} label="Produto / Carga" color={BLUE} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Descrição do Produto" name="descricao_produto" required error={state.errors?.descricao_produto} placeholder="ex: Moinho de Facas MGHS 800" />
              </div>
              <Field label="Peso Bruto (kg)" name="peso_bruto_kg" type="number" placeholder="ex: 1800" />
              <Field label="Volume (m³)" name="volume_m3" type="number" placeholder="ex: 3.2" />
              <div />
              <Field label="Comprimento (m)" name="dimensoes_l" type="number" placeholder="ex: 2.5" />
              <Field label="Altura (m)" name="dimensoes_a" type="number" placeholder="ex: 1.8" />
              <Field label="Profundidade (m)" name="dimensoes_p" type="number" placeholder="ex: 1.2" />
            </div>
          </div>

          {/* Tipo de Frete e Endereços */}
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <SectionTitle icon={Truck} label="Tipo de Frete e Endereços" color={NAV} />

            {/* CIF/FOB toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input type="hidden" name="tipo_frete" value={tipoFrete} />
              {(["cif", "fob"] as const).map((tipo) => (
                <button
                  key={tipo} type="button"
                  onClick={() => setTipoFrete(tipo)}
                  style={{
                    padding: "8px 24px", border: `2px solid ${tipoFrete === tipo ? NAV : BORDER}`,
                    borderRadius: 8, background: tipoFrete === tipo ? NAV : "#fff",
                    color: tipoFrete === tipo ? "#fff" : "#374151",
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}
                >
                  {tipo.toUpperCase()}
                </button>
              ))}
              <span style={{ fontSize: 12, color: "#6b7b8d", alignSelf: "center" }}>
                {tipoFrete === "cif" ? "Frete por conta do remetente (Seibt)" : "Frete por conta do destinatário"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 8 }}>Origem</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Field label="Cidade" name="cidade_origem" placeholder="ex: Caxias do Sul" />
                  <Field label="Estado (UF)" name="estado_origem" placeholder="ex: RS" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>Endereço Completo</label>
                    <textarea name="endereco_origem" rows={2} placeholder="Rua, número, bairro..."
                      style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, resize: "vertical" }} />
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 8 }}>Destino</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Field label="Cidade" name="cidade_destino" placeholder="ex: São Paulo" />
                  <Field label="Estado (UF)" name="estado_destino" placeholder="ex: SP" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>Endereço Completo</label>
                    <textarea name="endereco_destino" rows={2} placeholder="Rua, número, bairro..."
                      style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, resize: "vertical" }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <Field label="Transportadora" name="transportadora" placeholder="ex: Jadlog, Correios, Transportes ABC" />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>Observações</label>
                <textarea name="observacoes" rows={3} placeholder="Cuidados especiais, instruções de manuseio..."
                  style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, resize: "vertical" }} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SubmitBtn />
          </div>
        </form>
      </div>

      {/* Preview Panel */}
      <div style={{ background: "#fff", borderLeft: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}` }}>
          {(["cliente", "transportadora"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActivePreview(tab)}
              style={{
                flex: 1, padding: "12px 0", border: "none", background: "none", cursor: "pointer",
                fontSize: 13, fontWeight: activePreview === tab ? 700 : 400,
                color: activePreview === tab ? NAV : "#6b7b8d",
                borderBottom: activePreview === tab ? `2px solid ${NAV}` : "2px solid transparent",
              }}
            >
              Folder {tab === "cliente" ? "Cliente" : "Transportadora"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: 24, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {!state.success && !state.freteId ? (
            <div style={{ textAlign: "center", color: "#9ca3af" }}>
              <Truck size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Prévia do Folder</div>
              <div style={{ fontSize: 13 }}>Preencha o formulário e salve para baixar os folders.</div>
            </div>
          ) : (
            <div style={{ width: "100%", textAlign: "center" }}>
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                  <MapPin size={18} color={NAV} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: NAV }}>Folders prontos para download</span>
                </div>
                <p style={{ fontSize: 13, color: "#6b7b8d", marginBottom: 16 }}>
                  Abra o .docx no Word e exporte como PDF para envio.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <a
                    href={`/api/docx/frete/${state.freteId}?tipo=cliente`}
                    download="folder_cliente.docx"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: NAV, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", justifyContent: "center" }}
                  >
                    <Download size={16} /> Folder Cliente (.docx)
                  </a>
                  <a
                    href={`/api/docx/frete/${state.freteId}?tipo=transportadora`}
                    download="folder_transportadora.docx"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "#2074B9", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", justifyContent: "center" }}
                  >
                    <FileText size={16} /> Folder Transportadora (.docx)
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

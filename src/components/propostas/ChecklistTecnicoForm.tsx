"use client";

import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle, AlertCircle } from "lucide-react";
import { salvarChecklist, type ChecklistFormState } from "@/app/actions/checklist";
import type { ChecklistTecnico } from "@/types/database";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        background: "#2C4F79",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        padding: "8px 20px",
        fontWeight: 600,
        fontSize: 13,
        cursor: pending ? "not-allowed" : "pointer",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Salvando..." : "Salvar Checklist"}
    </button>
  );
}

const FIELD = (
  label: string,
  name: string,
  type: "text" | "number" | "select",
  options?: string[],
  error?: string,
  defaultValue?: string | number
) => (
  <div key={name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {label} <span style={{ color: "#dc2626" }}>*</span>
    </label>
    {type === "select" ? (
      <select
        name={name}
        defaultValue={defaultValue as string}
        style={{
          padding: "8px 10px",
          border: `1px solid ${error ? "#dc2626" : "#e2e8f0"}`,
          borderRadius: 6,
          fontSize: 13,
          background: "#fff",
        }}
      >
        {options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={label}
        style={{
          padding: "8px 10px",
          border: `1px solid ${error ? "#dc2626" : "#e2e8f0"}`,
          borderRadius: 6,
          fontSize: 13,
        }}
      />
    )}
    {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
  </div>
);

interface Props {
  propostaId: string;
  checklist?: ChecklistTecnico | null;
}

export function ChecklistTecnicoForm({ propostaId, checklist }: Props) {
  const [state, action] = useFormState<ChecklistFormState, FormData>(salvarChecklist, {});

  if (state.success || checklist?.completo) {
    return (
      <div style={{
        background: "#f0fdf4",
        border: "1px solid #86efac",
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <CheckCircle size={18} color="#16a34a" />
        <div>
          <div style={{ fontWeight: 600, color: "#15803d", fontSize: 13 }}>Checklist técnico completo</div>
          {checklist?.preenchido_em && (
            <div style={{ fontSize: 11, color: "#6b7b8d" }}>
              Preenchido em {new Date(checklist.preenchido_em).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
        {checklist && (
          <button
            onClick={() => window.location.reload()}
            style={{ marginLeft: "auto", fontSize: 12, color: "#2074B9", background: "none", border: "none", cursor: "pointer" }}
          >
            Editar
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {!checklist?.completo && (
        <div style={{
          background: "#fef9c3",
          border: "1px solid #fde047",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}>
          <AlertCircle size={16} color="#d97706" />
          <span style={{ fontSize: 12, color: "#92400e" }}>
            Todos os campos são obrigatórios para gerar o PDF da proposta.
          </span>
        </div>
      )}

      {state.message && (
        <div style={{
          background: "#fee2e2",
          border: "1px solid #fca5a5",
          borderRadius: 6,
          padding: "8px 12px",
          fontSize: 12,
          color: "#dc2626",
          marginBottom: 12,
        }}>
          {state.message}
        </div>
      )}

      <form action={action}>
        <input type="hidden" name="proposta_id" value={propostaId} />

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}>
          {FIELD("Segmento de Aplicação", "segmento_aplicacao", "text", undefined, state.errors?.segmento_aplicacao, checklist?.segmento_aplicacao)}
          {FIELD("Produto Final", "produto_final", "text", undefined, state.errors?.produto_final, checklist?.produto_final)}
          {FIELD("Material", "material", "text", undefined, state.errors?.material, checklist?.material)}
          {FIELD("Dimensões do Material", "dimensoes", "text", undefined, state.errors?.dimensoes, checklist?.dimensoes)}
          {FIELD("Granulometria Desejada", "granulometria", "text", undefined, state.errors?.granulometria, checklist?.granulometria)}
          {FIELD("Tipo de Moagem", "moagem_tipo", "select",
            ["A seco", "Úmida", "Semi-úmida"],
            state.errors?.moagem_tipo,
            checklist?.moagem_tipo ?? "A seco"
          )}
          {FIELD("Forma de Abastecimento", "forma_abastecimento", "select",
            ["Esteira transportadora", "Manual", "Silo", "Pneumático"],
            state.errors?.forma_abastecimento,
            checklist?.forma_abastecimento ?? "Esteira transportadora"
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Produção Horária (kg/h) <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", border: `1px solid ${state.errors?.producao_horaria_kgh ? "#dc2626" : "#e2e8f0"}`, borderRadius: 6, overflow: "hidden" }}>
              <input
                type="number"
                name="producao_horaria_kgh"
                defaultValue={checklist?.producao_horaria_kgh}
                placeholder="ex: 500"
                style={{ flex: 1, padding: "8px 10px", border: "none", outline: "none", fontSize: 13 }}
              />
              <span style={{ padding: "8px 10px", background: "#f8fafc", color: "#6b7b8d", fontSize: 12, borderLeft: "1px solid #e2e8f0" }}>kg/h</span>
            </div>
            {state.errors?.producao_horaria_kgh && <span style={{ fontSize: 11, color: "#dc2626" }}>{state.errors.producao_horaria_kgh}</span>}
          </div>

          {FIELD("Voltagem", "voltagem", "select",
            ["380V 60Hz", "220V 60Hz", "440V 60Hz", "Outro"],
            state.errors?.voltagem,
            checklist?.voltagem ?? "380V 60Hz"
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <SubmitBtn />
        </div>
      </form>
    </div>
  );
}

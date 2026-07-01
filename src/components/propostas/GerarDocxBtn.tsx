"use client";

import { FileText } from "lucide-react";

interface Props {
  propostaId: string;
  numeroCompleto: string;
  checklistCompleto?: boolean;
}

export function GerarDocxBtn({
  propostaId,
  numeroCompleto,
  checklistCompleto = true,
}: Props) {
  const safeNum = numeroCompleto.replace(/\//g, "-");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!checklistCompleto && (
        <div
          style={{
            fontSize: 11,
            color: "#92400e",
            background: "#fef9c3",
            border: "1px solid #fde047",
            borderRadius: 6,
            padding: "8px 10px",
            lineHeight: 1.4,
          }}
        >
          Checklist técnico incompleto — o .docx será gerado sem os dados da aplicação.
        </div>
      )}
      <a
        href={`/api/docx/${propostaId}`}
        download={`proposta_${safeNum}.docx`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "#2C4F79",
          border: "none",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <FileText size={14} />
        Gerar Word (.docx)
      </a>
    </div>
  );
}

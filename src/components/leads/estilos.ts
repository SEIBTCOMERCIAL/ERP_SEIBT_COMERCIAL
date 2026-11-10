import type { CSSProperties } from "react";

export const NAV = "#2C4F79";
export const BLUE = "#2074B9";
export const BG = "#F8FAFC";
export const BORDER = "#E2E8F0";
export const MUTED = "#6B7B8D";
export const DANGER = "#DC2626";

export const campo: CSSProperties = {
  width: "100%", height: 36, border: `1px solid ${BORDER}`, borderRadius: 7,
  padding: "0 10px", fontSize: 13, background: "#fff", outline: "none", boxSizing: "border-box",
};

export const areaTexto: CSSProperties = { ...campo, height: "auto", padding: "8px 10px", resize: "vertical" };

export const rotulo: CSSProperties = {
  fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", marginBottom: 5, display: "block",
};

export const botaoPrimario: CSSProperties = {
  padding: "9px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8,
  fontSize: 13, fontWeight: 700, cursor: "pointer",
};

export const botaoSecundario: CSSProperties = {
  padding: "9px 16px", background: "#fff", color: "#374151", border: `1px solid ${BORDER}`,
  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
};

export const fundoModal: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
  display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 12, overflowY: "auto",
};

export const caixaModal: CSSProperties = {
  background: "#fff", borderRadius: 14, width: "100%", maxWidth: 720, marginTop: 24,
  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
};

export const erroBox: CSSProperties = {
  background: "#FEE2E2", color: DANGER, padding: "10px 14px", borderRadius: 8, fontSize: 12,
};

export function paraInputLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function paraISO(valor: FormDataEntryValue | null | undefined): string | null {
  const v = String(valor ?? "");
  return v ? new Date(v).toISOString() : null;
}

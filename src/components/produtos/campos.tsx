"use client";

import { parseMoedaOpcional } from "@/lib/reajuste/regras";
import { campoCls } from "./base";

export const formatarMoedaCampo = (v: number | null | undefined): string =>
  v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Campo de dinheiro: o que aparece é o que vale (vírgula nos centavos). Formata ao sair; o servidor valida de novo. */
export function CampoMoeda({ valor, aoMudar, rotulo, desabilitado, placeholder = "0,00", ariaLabel }: {
  valor: string; aoMudar: (v: string) => void; rotulo?: string; desabilitado?: boolean; placeholder?: string; ariaLabel?: string;
}) {
  const r = valor.trim() === "" ? null : parseMoedaOpcional(valor);
  const invalido = r?.erro !== undefined;
  return (
    <>
      <input inputMode="decimal" value={valor} disabled={desabilitado} placeholder={placeholder} aria-label={ariaLabel ?? rotulo} aria-invalid={invalido}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={() => { const p = parseMoedaOpcional(valor); if (p.erro === undefined && p.valor !== null) aoMudar(formatarMoedaCampo(p.valor)); }}
        className={`${campoCls} ${invalido ? "border-red-400" : ""}`} />
      {invalido && r?.erro !== undefined && <span className="text-xs font-normal text-red-600">{r.erro}</span>}
    </>
  );
}

/** Campo de texto simples controlado. */
export function CampoTexto({ valor, aoMudar, ...resto }: { valor: string; aoMudar: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <input value={valor} onChange={(e) => aoMudar(e.target.value)} className={campoCls} {...resto} />;
}

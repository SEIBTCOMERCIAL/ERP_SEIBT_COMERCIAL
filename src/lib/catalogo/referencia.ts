// Referência de data do catálogo: quando foi gerado e quando os preços vigentes foram atualizados pela última vez.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FUSO } from "@/lib/reajuste/regras";

export interface ReferenciaCatalogo {
  /** Momento da consulta dos dados (ISO). */
  geradoEm: string;
  /** Data do último reajuste confirmado (AAAA-MM-DD) ou null se nenhum foi registrado. */
  precosAtualizadosEm: string | null;
}

/** Último reajuste real (preço anterior preenchido): o preço inicial do cadastro não conta como atualização. */
export async function carregarReferenciaCatalogo(supabase: any): Promise<ReferenciaCatalogo> {
  const geradoEm = new Date().toISOString();
  try {
    const { data } = await supabase.from("historico_precos").select("data_reajuste")
      .not("preco_anterior_brl", "is", null).order("data_reajuste", { ascending: false }).limit(1).maybeSingle();
    return { geradoEm, precosAtualizadosEm: data?.data_reajuste ?? null };
  } catch {
    return { geradoEm, precosAtualizadosEm: null };
  }
}

const dataHora = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** "Gerado em 10/11/2026 14:05 · preços vigentes; última atualização de preços em 03/11/2026". */
export function textoReferencia(r: ReferenciaCatalogo | null | undefined): string {
  if (!r) return "";
  const atualizado = r.precosAtualizadosEm ? `última atualização de preços em ${r.precosAtualizadosEm.split("-").reverse().join("/")}` : "sem atualização de preços registrada";
  return `Gerado em ${dataHora(r.geradoEm)} · preços vigentes; ${atualizado}`;
}

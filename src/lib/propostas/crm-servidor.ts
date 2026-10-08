// Regras do CRM que consultam o banco. Só para código de servidor (ações e páginas).

import { AVISO_ESTRUTURA_CRM, STATUS_ENCERRADOS, faltaEstruturaCrm, type Mercado, type Papel } from "./crm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export interface OrganizacaoComercialInput {
  mercado?: Mercado;
  pais_destino?: string | null;
  papel?: Papel;
  proposta_principal_id?: string | null;
}

/** Confere se a proposta escolhida pode ser a principal de uma complementar. */
export async function validarPrincipal(supabase: SupabaseAny, principalId: string, clienteId: string | null): Promise<string | null> {
  const { data: principal, error } = await supabase
    .from("propostas")
    .select("id, cliente_id, papel, status")
    .eq("id", principalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error && faltaEstruturaCrm(error)) return AVISO_ESTRUTURA_CRM;
  if (!principal) return "A proposta principal não foi encontrada.";
  if (principal.papel === "complementar") return "Escolha uma proposta principal (não uma complementar).";
  if (principal.cliente_id !== clienteId) return "A proposta complementar deve pertencer ao mesmo cliente da proposta principal.";
  if (STATUS_ENCERRADOS.has(principal.status)) return "A proposta principal escolhida já está encerrada.";
  return null;
}

/**
 * Valida mercado/classificação e devolve os campos do CRM para gravar na proposta.
 * Retorna `{ erro }` quando algo está inconsistente.
 */
export async function prepararOrganizacao(
  supabase: SupabaseAny,
  org: OrganizacaoComercialInput,
  clienteId: string | null
): Promise<{ campos?: Record<string, unknown>; erro?: string }> {
  const mercado: Mercado = org.mercado === "exportacao" ? "exportacao" : "nacional";
  const papel: Papel = org.papel === "complementar" ? "complementar" : "principal";
  const pais = org.pais_destino?.trim() || null;
  if (mercado === "exportacao" && !pais) return { erro: "Informe o país de destino da exportação." };
  if (papel === "complementar") {
    if (!org.proposta_principal_id) return { erro: "Selecione a proposta principal deste negócio." };
    const erro = await validarPrincipal(supabase, org.proposta_principal_id, clienteId);
    if (erro) return { erro };
  }
  return {
    campos: {
      mercado,
      pais_destino: mercado === "exportacao" ? pais : null,
      papel,
      proposta_principal_id: papel === "complementar" ? org.proposta_principal_id : null,
    },
  };
}

/** Grava a proposta com os campos do CRM; se o banco ainda não tem o arquivo 022, grava sem
 * eles (somente quando a escolha é a padrão: nacional e principal). */
export async function inserirPropostaComOrganizacao(
  supabase: SupabaseAny,
  dadosBase: Record<string, unknown>,
  camposCrm: Record<string, unknown>
): Promise<{ data: { id: string } | null; error: { code?: string; message?: string } | null }> {
  const primeira = await supabase.from("propostas").insert({ ...dadosBase, ...camposCrm }).select("id").single();
  if (!primeira.error || !faltaEstruturaCrm(primeira.error)) return primeira;
  if (camposCrm.mercado !== "nacional" || camposCrm.papel !== "principal") {
    return { data: null, error: { message: AVISO_ESTRUTURA_CRM } };
  }
  return supabase.from("propostas").insert(dadosBase).select("id").single();
}

/** Propostas que podem ser a principal de uma complementar: abertas e marcadas como principal.
 * Antes do arquivo 022 (sem a coluna "papel"), todas as abertas contam como principais. */
export async function carregarPropostasPrincipais(supabase: SupabaseAny) {
  const consulta = (campos: string) => supabase
    .from("propostas")
    .select(campos)
    .is("deleted_at", null)
    .order("criado_em", { ascending: false })
    .limit(500);
  let { data, error } = await consulta("id, numero_completo, cliente_id, status, papel");
  if (error && faltaEstruturaCrm(error)) ({ data, error } = await consulta("id, numero_completo, cliente_id, status"));
  return ((data ?? []) as Array<{ id: string; numero_completo: string; cliente_id: string | null; status: string; papel?: string | null }>)
    .filter((p) => !STATUS_ENCERRADOS.has(p.status) && p.papel !== "complementar")
    .map(({ id, numero_completo, cliente_id }) => ({ id, numero_completo, cliente_id }));
}

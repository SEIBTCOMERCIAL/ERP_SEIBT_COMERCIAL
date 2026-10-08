// Regras do CRM que consultam o banco. Só para código de servidor (ações e páginas).

import { AVISO_ESTRUTURA_CRM, MOTIVOS_PADRAO, STATUS_ENCERRADOS, faltaEstruturaCrm, type CategoriaMotivo, type Mercado, type MotivoOpcao, type Papel } from "./crm";
import type { EtapaFunil } from "./funil";

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
): Promise<{ data: { id: string; numero_completo?: string } | null; error: { code?: string; message?: string } | null }> {
  const primeira = await supabase.from("propostas").insert({ ...dadosBase, ...camposCrm }).select("id, numero_completo").single();
  if (!primeira.error || !faltaEstruturaCrm(primeira.error)) return primeira;
  if (camposCrm.mercado !== "nacional" || camposCrm.papel !== "principal") {
    return { data: null, error: { message: AVISO_ESTRUTURA_CRM } };
  }
  return supabase.from("propostas").insert(dadosBase).select("id, numero_completo").single();
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

// ── Funil, motivos, usuário e histórico ─────────────────────────────────────────


/** Usuário logado com nome e perfil (null quando não há sessão). */
export async function usuarioAtual(supabase: SupabaseAny): Promise<{ id: string; nome: string; perfil: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("usuarios").select("nome, perfil").eq("id", user.id).maybeSingle();
  return { id: user.id, nome: data?.nome ?? "", perfil: data?.perfil ?? "" };
}

/** Etapas ativas do funil comercial (o funil geral, sem dono). Aceita banco sem os campos novos (arquivo 024). */
export async function carregarEtapas(supabase: SupabaseAny): Promise<{ etapas: EtapaFunil[]; estruturaFunil: boolean }> {
  const { data: funis } = await supabase.from("funis").select("id").is("usuario_id", null).order("criado_em").limit(1);
  const funilId: string | undefined = funis?.[0]?.id;
  const montar = (campos: string) => {
    let q = supabase.from("etapas_funil").select(campos).eq("ativo", true).order("ordem");
    if (funilId) q = q.eq("funil_id", funilId);
    return q;
  };
  let res = await montar("id, funil_id, nome, cor, ordem, ativo, tipo, exige_proxima_acao");
  let estruturaFunil = true;
  if (res.error && faltaEstruturaCrm(res.error)) {
    estruturaFunil = false;
    res = await montar("id, funil_id, nome, cor, ordem, ativo");
  }
  return { etapas: (res.data ?? []) as EtapaFunil[], estruturaFunil };
}

export interface MotivosCarregados {
  /** Motivos ativos por categoria (para escolher). */
  ativos: Record<CategoriaMotivo, MotivoOpcao[]>;
  /** Todos os nomes, inclusive de motivos desativados (para mostrar histórico). */
  nomes: Record<string, string>;
}

/** Lista de motivos configurada pelo administrador; sem a tabela (arquivo 024), vale a lista padrão. */
export async function carregarMotivos(supabase: SupabaseAny): Promise<MotivosCarregados> {
  const padrao: MotivosCarregados = {
    ativos: { perda: [...MOTIVOS_PADRAO.perda], congelamento: [...MOTIVOS_PADRAO.congelamento], complementar: [...MOTIVOS_PADRAO.complementar] },
    nomes: Object.fromEntries((["perda", "congelamento", "complementar"] as CategoriaMotivo[]).flatMap((c) => MOTIVOS_PADRAO[c]).map((m) => [m.codigo, m.nome])),
  };
  const { data, error } = await supabase.from("motivos_proposta").select("categoria, codigo, nome, ordem, ativo").order("ordem");
  if (error || !data?.length) return padrao;
  const rows = data as Array<{ categoria: CategoriaMotivo; codigo: string; nome: string; ativo: boolean }>;
  const ativos: MotivosCarregados["ativos"] = { perda: [], congelamento: [], complementar: [] };
  const nomes: Record<string, string> = { ...padrao.nomes };
  for (const r of rows) {
    nomes[r.codigo] = r.nome;
    if (r.ativo && ativos[r.categoria]) ativos[r.categoria].push({ codigo: r.codigo, nome: r.nome });
  }
  return { ativos, nomes };
}

/** Registro manual no histórico da negociação (os demais eventos são gravados pelo banco). */
export async function registrarHistorico(
  supabase: SupabaseAny,
  evento: { propostaId: string; tipo: string; descricao: string; detalhes?: Record<string, unknown> }
) {
  try {
    const usuario = await usuarioAtual(supabase);
    await supabase.from("proposta_historico").insert({
      proposta_id: evento.propostaId,
      tipo: evento.tipo,
      descricao: evento.descricao,
      detalhes: evento.detalhes ?? null,
      usuario_id: usuario?.id ?? null,
      usuario_nome: usuario?.nome ?? null,
    });
  } catch {
    // O histórico nunca deve impedir a ação principal.
  }
}

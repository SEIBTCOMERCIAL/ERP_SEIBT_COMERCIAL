"use server";

import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "./auditoria";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { carregarEtapas, carregarMotivos, inserirPropostaComOrganizacao, resolverRepresentante, usuarioAtual, validarPrincipal } from "@/lib/propostas/crm-servidor";
import { AVISO_ESTRUTURA_CRM, STATUS_COM_MOTIVO, STATUS_EM_ACOMPANHAMENTO, STATUS_ENCERRADOS, categoriaMotivoDoStatus, faltaEstruturaCrm, negocioDe } from "@/lib/propostas/crm";
import { etapaInicial, etapaSugeridaPorStatus, tipoEtapaDe } from "@/lib/propostas/funil";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

// ── Schemas ──────────────────────────────────────────────────────────────────

const propostaSchema = z.object({
  tipo:              z.enum(["maquina", "sistema", "exportacao", "pecas", "servico", "mista"]),
  mercado:           z.enum(["nacional", "exportacao"]).default("nacional"),
  pais_destino:      z.string().optional(),
  papel:             z.enum(["principal", "complementar"]).default("principal"),
  proposta_principal_id: z.string().uuid().optional().nullable(),
  moeda:             z.enum(["BRL", "USD"]).default("BRL"),
  cliente_id:        z.string().uuid().optional().nullable(),
  contato_nome:      z.string().optional(),
  contato_email:     z.string().email().optional().or(z.literal("")),
  contato_telefone:  z.string().optional(),
  canal_origem:      z.enum(["whatsapp","email","feira","site","indicacao","telefone","recorrencia","outro"]).optional().nullable(),
  temperatura:       z.enum(["quente","morna","fria"]).optional().nullable(),
  responsavel_id:    z.string().uuid().optional().nullable(),
  representante_id:  z.string().uuid().optional().nullable(),
  etapa_funil_id:    z.string().uuid().optional().nullable(),
  condicao_pagamento: z.string().optional(),
  prazo_entrega:     z.string().optional(),
  validade_proposta: z.string().optional(),
  observacoes:       z.string().optional(),
  descricao_livre:   z.string().optional(),
});

export type PropostaFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

export type OrganizacaoPropostaState = {
  message?: string;
  success?: boolean;
};

const itemSchema = z.object({
  proposta_id:   z.string().uuid(),
  descricao:     z.string().min(1, "Descrição obrigatória"),
  quantidade:    z.coerce.number().int().min(1).default(1),
  preco_unitario: z.coerce.number().min(0),
  ipi_pct:       z.coerce.number().min(0).default(0),
  opcional:      z.coerce.boolean().default(false),
  observacao:    z.string().optional(),
});

// ── Actions ───────────────────────────────────────────────────────────────────

export type GerarNumeroState = PropostaFormState & {
  sucesso?: { id: string; numero: string };
};

type ResultadoCriacao = { id: string; numero: string } | PropostaFormState;

/** Cria a proposta com mercado, classificação e etapa inicial. Usada pela criação normal e pelo "Gerar número". */
async function criarPropostaNucleo(formData: FormData): Promise<ResultadoCriacao> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  // Busca perfil do usuário logado (a tabela usuarios não tem representante_id: o vínculo
  // usuário → representante fica em representantes.usuario_id).
  const [{ data: usuario }, { data: representanteDoUsuario }] = await Promise.all([
    supabase.from("usuarios").select("perfil").eq("id", user.id).single(),
    supabase.from("representantes").select("id").eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle(),
  ]);

  const repEscolhido = await resolverRepresentante(String(formData.get("representante_id") ?? ""));
  if (repEscolhido.erro) return { message: repEscolhido.erro };

  const raw = {
    tipo:              formData.get("tipo"),
    mercado:           formData.get("mercado") || "nacional",
    pais_destino:      formData.get("pais_destino") || undefined,
    papel:             formData.get("papel") || "principal",
    proposta_principal_id: formData.get("proposta_principal_id") || null,
    moeda:             formData.get("moeda") || "BRL",
    cliente_id:        formData.get("cliente_id") || null,
    contato_nome:      formData.get("contato_nome") || undefined,
    contato_email:     formData.get("contato_email") || undefined,
    contato_telefone:  formData.get("contato_telefone") || undefined,
    canal_origem:      formData.get("canal_origem") || null,
    temperatura:       formData.get("temperatura") || null,
    responsavel_id:    formData.get("responsavel_id") || user.id,
    representante_id:  repEscolhido.id || representanteDoUsuario?.id || null,
    etapa_funil_id:    formData.get("etapa_funil_id") || null,
    condicao_pagamento: formData.get("condicao_pagamento") || undefined,
    prazo_entrega:     formData.get("prazo_entrega") || undefined,
    validade_proposta: formData.get("validade_proposta") || undefined,
    observacoes:       formData.get("observacoes") || undefined,
    descricao_livre:   formData.get("descricao_livre") || undefined,
  };

  const parsed = propostaSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;

  if (d.mercado === "exportacao" && !d.pais_destino?.trim()) {
    return { message: "Informe o país de destino da exportação." };
  }
  if (d.papel === "complementar" && !d.proposta_principal_id) {
    return { message: "Selecione a proposta principal deste negócio." };
  }
  if (d.papel === "principal" && d.proposta_principal_id) {
    return { message: "Uma proposta principal não pode ser vinculada a outra proposta principal." };
  }

  if (d.papel === "complementar" && d.proposta_principal_id) {
    const erro = await validarPrincipal(supabase, d.proposta_principal_id, d.cliente_id || null);
    if (erro) return { message: erro };
  }

  // O número (0001/2026, 0002/2026…) é gerado pelo próprio banco ao gravar a proposta.

  // Verifica se o usuário tem perfil configurado (pré-condição para RLS passar)
  if (!usuario) {
    return { message: "Seu perfil não está configurado no sistema. Execute o seed SQL no Supabase para registrar seu usuário." };
  }

  // Toda proposta nova nasce na etapa inicial do funil (quando o funil já está configurado).
  let etapaId = d.etapa_funil_id || null;
  if (!etapaId) {
    const { etapas } = await carregarEtapas(supabase);
    etapaId = etapaInicial(etapas)?.id ?? null;
  }

  const camposCrm = {
    mercado:           d.mercado,
    pais_destino:      d.mercado === "exportacao" ? d.pais_destino?.trim() || null : null,
    papel:             d.papel,
    proposta_principal_id: d.papel === "complementar" ? d.proposta_principal_id : null,
  };
  const dadosBase = {
      tipo:              d.tipo,
      moeda:             d.moeda,
      status:            "rascunho",
      cliente_id:        d.cliente_id || null,
      contato_nome:      d.contato_nome || null,
      contato_email:     d.contato_email || null,
      contato_telefone:  d.contato_telefone || null,
      canal_origem:      d.canal_origem || null,
      temperatura:       d.temperatura || null,
      responsavel_id:    d.responsavel_id || user.id,
      representante_id:  d.representante_id || null,
      etapa_funil_id:    etapaId,
      condicao_pagamento: d.condicao_pagamento || null,
      prazo_entrega:     d.prazo_entrega || null,
      validade_proposta: d.validade_proposta || null,
      observacoes:       d.observacoes || null,
      descricao_livre:   d.descricao_livre?.trim() || null,
  };

  const { data: proposta, error } = await inserirPropostaComOrganizacao(supabase, dadosBase, camposCrm);

  if (error || !proposta) {
    if (error?.message?.includes("row-level security") || error?.code === "42501") {
      return { message: `Sem permissão para criar proposta. Verifique se o seed SQL foi executado no Supabase (perfil: ${usuario?.perfil ?? "não encontrado"}, uid: ${user.id.slice(0,8)}...).` };
    }
    return { message: "Erro ao criar proposta: " + (error?.message ?? "sem resposta do banco") };
  }

  revalidatePath("/propostas");
  return { id: proposta.id, numero: proposta.numero_completo ?? "" };
}

export async function criarProposta(
  _prev: PropostaFormState,
  formData: FormData
): Promise<PropostaFormState> {
  const resultado = await criarPropostaNucleo(formData);
  if ("id" in resultado) redirect(`/propostas/${resultado.id}`);
  return resultado;
}

/** "Gerar número de proposta": cria o cartão no funil já com o número, sem montar a proposta dentro do ERP. */
export async function gerarNumeroProposta(
  _prev: GerarNumeroState,
  formData: FormData
): Promise<GerarNumeroState> {
  if (!String(formData.get("cliente_id") ?? "").trim()) return { message: "Selecione o cliente." };
  if (!String(formData.get("descricao_livre") ?? "").trim()) return { message: "Informe o produto ou uma descrição inicial." };
  const resultado = await criarPropostaNucleo(formData);
  if ("id" in resultado) return { sucesso: { id: resultado.id, numero: resultado.numero } };
  return resultado;
}

export interface DetalhesStatus {
  /** Código do motivo (lista de perda, congelamento ou complementar, conforme o status). */
  motivoCodigo?: string;
  /** Observação explicando o motivo. */
  motivoDetalhes?: string;
  retomadaPrevista?: string;
}

const SEM_PERMISSAO_ALTERAR = "Você não tem permissão para alterar esta proposta. Peça ao responsável ou ao administrador.";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function temProximaAcaoFutura(supabase: SupabaseAny, propostaId: string) {
  const { data } = await supabase
    .from("followups")
    .select("id")
    .eq("proposta_id", propostaId)
    .not("proxima_acao_data", "is", null)
    .gte("proxima_acao_data", hojeISO())
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function atualizarStatusProposta(
  propostaId: string,
  novoStatus: string,
  detalhes?: DetalhesStatus
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { error: "Não autorizado." };

  // Antes do arquivo 022 as colunas do CRM não existem: trata como proposta principal simples.
  const leitura = await supabase
    .from("propostas")
    .select("id, status, papel, proposta_principal_id, etapa_funil_id")
    .eq("id", propostaId)
    .maybeSingle();
  const estruturaCrm = !(leitura.error && faltaEstruturaCrm(leitura.error));
  const propostaAtual = estruturaCrm
    ? leitura.data
    : (await supabase.from("propostas").select("id, status, etapa_funil_id").eq("id", propostaId).maybeSingle()).data;
  if (!propostaAtual) return { error: "Proposta não encontrada." };

  const precisaEstrutura = novoStatus === "cancelada" || novoStatus === "complementar_nao_selecionada" ||
    novoStatus === "stand_by" || STATUS_COM_MOTIVO.has(novoStatus);
  if (precisaEstrutura && !estruturaCrm) return { error: AVISO_ESTRUTURA_CRM };

  const hoje = hojeISO();

  // Próxima ação obrigatória para propostas em acompanhamento.
  if (STATUS_EM_ACOMPANHAMENTO.has(novoStatus) && !(await temProximaAcaoFutura(supabase, propostaId))) {
    return { error: "Registre um follow-up com a próxima ação (data a partir de hoje) antes de colocar a proposta em acompanhamento." };
  }

  // Motivo padronizado + observação (perda, desistência, cancelamento, complementar e congelamento).
  const categoria = categoriaMotivoDoStatus(novoStatus);
  if (categoria) {
    const motivos = await carregarMotivos(supabase);
    const codigo = detalhes?.motivoCodigo ?? "";
    if (!codigo || !motivos.ativos[categoria].some((m) => m.codigo === codigo)) {
      return { error: "Escolha um dos motivos da lista." };
    }
    if (!detalhes?.motivoDetalhes?.trim()) {
      return { error: "Escreva uma observação explicando o motivo." };
    }
  }
  if (novoStatus === "stand_by") {
    if (!detalhes?.retomadaPrevista) return { error: "Informe a data prevista de retomada." };
    if (detalhes.retomadaPrevista < hoje) return { error: "A data prevista de retomada não pode ser uma data passada." };
  }

  // Alternativas do mesmo negócio (principal + complementares).
  if (estruturaCrm && (novoStatus === "complementar_nao_selecionada" || novoStatus === "vendida")) {
    const negocio = negocioDe(propostaAtual);
    const { data: alternativas } = await supabase
      .from("propostas")
      .select("id, numero_completo, status")
      .or(`id.eq.${negocio},proposta_principal_id.eq.${negocio}`)
      .is("deleted_at", null);
    const outras = ((alternativas ?? []) as Array<{ id: string; numero_completo: string; status: string }>)
      .filter((a) => a.id !== propostaId);
    if (novoStatus === "complementar_nao_selecionada" && outras.length === 0) {
      return { error: "Esta proposta não tem alternativas vinculadas no mesmo negócio." };
    }
    if (novoStatus === "vendida") {
      const vendida = outras.find((a) => a.status === "vendida");
      if (vendida) {
        return { error: `O cliente só pode escolher uma alternativa: a proposta ${vendida.numero_completo} deste negócio já está como vendida.` };
      }
    }
  }

  const updates: Record<string, unknown> = { status: novoStatus };
  if (novoStatus === "enviada") updates.enviada_em = new Date().toISOString();
  if (STATUS_ENCERRADOS.has(novoStatus)) updates.fechada_em = new Date().toISOString();
  if (STATUS_COM_MOTIVO.has(novoStatus)) {
    updates.motivo_encerramento_codigo = detalhes?.motivoCodigo;
    updates.motivo_encerramento_detalhes = detalhes?.motivoDetalhes?.trim();
  }
  if (novoStatus === "stand_by") {
    updates.motivo_congelamento = detalhes?.motivoCodigo;
    updates.motivo_congelamento_detalhes = detalhes?.motivoDetalhes?.trim();
    updates.retomada_prevista = detalhes?.retomadaPrevista;
  }
  // Reabrir ou retomar limpa o encerramento anterior.
  if (!STATUS_ENCERRADOS.has(novoStatus)) {
    updates.fechada_em = null;
    if (estruturaCrm) {
      updates.motivo_encerramento_codigo = null;
      updates.motivo_encerramento_detalhes = null;
      if (novoStatus !== "stand_by") {
        updates.motivo_congelamento = null;
        updates.motivo_congelamento_detalhes = null;
        updates.retomada_prevista = null;
      }
    }
  }

  // A etapa acompanha os status finais (ganho, perda, congelada) e a reabertura/retomada.
  const saiuDeFinal = STATUS_ENCERRADOS.has(propostaAtual.status) || propostaAtual.status === "stand_by";
  const entraEmFinal = STATUS_ENCERRADOS.has(novoStatus) || novoStatus === "stand_by";
  if (entraEmFinal || saiuDeFinal) {
    const { etapas } = await carregarEtapas(supabase);
    const sugerida = etapaSugeridaPorStatus(novoStatus, etapas);
    if (sugerida) updates.etapa_funil_id = sugerida.id;
  }

  let { data: alteradas, error } = await supabase.from("propostas").update(updates).eq("id", propostaId).select("id");
  // Banco sem o campo de observação do congelamento (arquivo 024): a observação vai junto do motivo.
  if (error && faltaEstruturaCrm(error) && "motivo_congelamento_detalhes" in updates) {
    const { motivo_congelamento_detalhes: obs, ...restante } = updates;
    if (novoStatus === "stand_by" && obs) restante.motivo_congelamento = `${detalhes?.motivoCodigo} — ${obs}`;
    ({ data: alteradas, error } = await supabase.from("propostas").update(restante).eq("id", propostaId).select("id"));
  }
  if (error) return { error: faltaEstruturaCrm(error) ? AVISO_ESTRUTURA_CRM : error.message };
  if (!alteradas?.length) return { error: SEM_PERMISSAO_ALTERAR };
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
  return { success: true };
}

export interface DetalhesMoverEtapa extends DetalhesStatus {
  /** Próxima ação, quando a etapa de destino exige e a proposta ainda não tem uma. */
  proximaAcao?: { data: string; tipo: string; notas?: string };
}

/** Move a proposta de etapa. Etapas de ganho, perda e congelamento também mudam o status. */
export async function moverPropostaEtapa(
  propostaId: string,
  etapaId: string,
  detalhes?: DetalhesMoverEtapa
): Promise<{ error?: string; success?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { error: "Não autorizado." };

  const { data: proposta } = await supabase
    .from("propostas").select("id, status, etapa_funil_id").eq("id", propostaId).is("deleted_at", null).maybeSingle();
  if (!proposta) return { error: "Proposta não encontrada." };
  if (STATUS_ENCERRADOS.has(proposta.status)) {
    return { error: "Esta proposta está encerrada. Para movê-la, reabra pelo menu de status." };
  }

  const { etapas } = await carregarEtapas(supabase);
  const destino = etapas.find((e) => e.id === etapaId);
  if (!destino) return { error: "Etapa não encontrada ou desativada." };
  if (destino.id === proposta.etapa_funil_id) return { success: true };

  const tipo = tipoEtapaDe(destino);
  const statusDoTipo = tipo === "ganho" ? "vendida" : tipo === "perda" ? "perdida" : tipo === "congelamento" ? "stand_by" : null;

  if (statusDoTipo) {
    const r = await atualizarStatusProposta(propostaId, statusDoTipo, detalhes);
    if (r.error) return r;
    // Se existir mais de uma etapa do mesmo tipo, vale a que o usuário escolheu.
    await supabase.from("propostas").update({ etapa_funil_id: destino.id }).eq("id", propostaId);
    revalidatePath("/propostas");
    return { success: true };
  }

  // Etapa inicial ou intermediária.
  const exige = Boolean(destino.exige_proxima_acao);
  if (exige && !(await temProximaAcaoFutura(supabase, propostaId))) {
    const acao = detalhes?.proximaAcao;
    if (!acao?.data || !acao.tipo?.trim()) {
      return { error: `A etapa "${destino.nome}" exige uma próxima ação. Informe a data e o tipo da próxima ação.` };
    }
    if (acao.data < hojeISO()) return { error: "A próxima ação não pode ficar em uma data que já passou." };
    const { error: errFollowup } = await supabase.from("followups").insert({
      proposta_id: propostaId,
      usuario_id: usuario.id,
      data_contato: hojeISO(),
      canal: "outro",
      motivo: `Movida para a etapa ${destino.nome}`,
      proxima_acao_data: acao.data,
      proxima_acao_tipo: acao.tipo.trim(),
      proxima_acao_notas: acao.notas?.trim() || null,
    });
    if (errFollowup) return { error: "Não foi possível registrar a próxima ação: " + errFollowup.message };
  }

  // Retomar uma proposta congelada ao movê-la para uma etapa aberta.
  if (proposta.status === "stand_by") {
    const r = await atualizarStatusProposta(propostaId, "em_negociacao");
    if (r.error) return r;
  }
  const { data: movidas, error } = await supabase.from("propostas").update({ etapa_funil_id: destino.id }).eq("id", propostaId).select("id");
  if (error) return { error: error.message };
  if (!movidas?.length) return { error: SEM_PERMISSAO_ALTERAR };
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
  return { success: true };
}

/** Administrador: dá uma etapa válida às propostas antigas que ficaram sem etapa (ou com etapa desativada). */
export async function atribuirEtapasPendentes(): Promise<{ error?: string; atribuidas?: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (usuario?.perfil !== "admin") return { error: "Somente o administrador pode organizar as propostas antigas." };

  const { etapas } = await carregarEtapas(supabase);
  if (!etapas.length) return { error: "Configure as etapas do funil antes de organizar as propostas." };
  const ids = new Set(etapas.map((e) => e.id));

  const { data, error } = await supabase
    .from("propostas")
    .select("id, status, etapa_funil_id")
    .is("deleted_at", null)
    .neq("status", "complementar_nao_selecionada");
  if (error) return { error: error.message };

  const porEtapa = new Map<string, string[]>();
  for (const p of (data ?? []) as Array<{ id: string; status: string; etapa_funil_id: string | null }>) {
    if (p.etapa_funil_id && ids.has(p.etapa_funil_id)) continue;
    const alvo = etapaSugeridaPorStatus(p.status, etapas);
    if (!alvo) continue;
    porEtapa.set(alvo.id, [...(porEtapa.get(alvo.id) ?? []), p.id]);
  }
  let atribuidas = 0;
  for (const [etapaId, propostaIds] of Array.from(porEtapa.entries())) {
    const { error: errUpdate } = await supabase.from("propostas").update({ etapa_funil_id: etapaId }).in("id", propostaIds);
    if (errUpdate) return { error: errUpdate.message, atribuidas };
    atribuidas += propostaIds.length;
  }
  revalidatePath("/propostas");
  return { atribuidas };
}

export async function atualizarEtapaProposta(
  propostaId: string,
  etapaId: string | null
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { error } = await supabase
    .from("propostas")
    .update({ etapa_funil_id: etapaId })
    .eq("id", propostaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
}

/** Define quem é o representante que acompanha a proposta; ele passa a enxergá-la no sistema. */
export async function definirRepresentanteProposta(
  propostaId: string,
  representanteId: string | null
): Promise<{ error?: string; success?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { error: "Não autorizado." };
  // Quem troca o representante: administrador ou o vendedor interno responsável (a regra do banco confere de novo).
  const { data: atual } = await supabase.from("propostas").select("responsavel_id").eq("id", propostaId).maybeSingle();
  if (!atual) return { error: "Proposta não encontrada." };
  if (usuario.perfil !== "admin" && !(usuario.perfil === "vendedor_interno" && atual.responsavel_id === usuario.id)) {
    return { error: SEM_PERMISSAO_ALTERAR };
  }

  const resolvido = await resolverRepresentante(representanteId);
  if (resolvido.erro) return { error: resolvido.erro };
  representanteId = resolvido.id;
  if (representanteId && !z.string().uuid().safeParse(representanteId).success) return { error: "Representante inválido." };
  if (representanteId) {
    const { data: rep } = await supabase.from("representantes").select("id").eq("id", representanteId).eq("ativo", true).maybeSingle();
    if (!rep) return { error: "Representante não encontrado ou inativo." };
  }
  const { data, error } = await supabase.from("propostas").update({ representante_id: representanteId }).eq("id", propostaId).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: SEM_PERMISSAO_ALTERAR };
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
  return { success: true };
}

export async function transferirResponsavel(
  propostaId: string,
  novoResponsavelId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { error } = await supabase
    .from("propostas")
    .update({ responsavel_id: novoResponsavelId })
    .eq("id", propostaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
}

export async function atualizarOrganizacaoProposta(
  _prev: OrganizacaoPropostaState,
  formData: FormData
): Promise<OrganizacaoPropostaState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const propostaId = String(formData.get("proposta_id") ?? "");
  const mercado = String(formData.get("mercado") ?? "nacional");
  const paisDestino = String(formData.get("pais_destino") ?? "").trim();
  const papel = String(formData.get("papel") ?? "principal");
  const propostaPrincipalId = String(formData.get("proposta_principal_id") ?? "") || null;

  if (!z.string().uuid().safeParse(propostaId).success) return { message: "Proposta inválida." };
  if (!['nacional', 'exportacao'].includes(mercado)) return { message: "Mercado inválido." };
  if (!['principal', 'complementar'].includes(papel)) return { message: "Classificação inválida." };
  if (mercado === "exportacao" && !paisDestino) return { message: "Informe o país de destino." };
  if (papel === "complementar" && !propostaPrincipalId) return { message: "Selecione a proposta principal." };

  const { data: propostaAtual } = await supabase
    .from("propostas")
    .select("cliente_id")
    .eq("id", propostaId)
    .is("deleted_at", null)
    .single();
  if (!propostaAtual) return { message: "Proposta não encontrada." };

  if (papel === "complementar" && propostaPrincipalId) {
    if (propostaPrincipalId === propostaId) return { message: "Uma proposta não pode ser complementar dela mesma." };
    const erro = await validarPrincipal(supabase, propostaPrincipalId, propostaAtual.cliente_id ?? null);
    if (erro) return { message: erro };
    // Uma principal que já tem complementares não pode virar complementar (evita encadear negócios).
    const { data: dependentes } = await supabase
      .from("propostas").select("id").eq("proposta_principal_id", propostaId).is("deleted_at", null).limit(1);
    if ((dependentes ?? []).length) return { message: "Esta proposta já é principal de outras alternativas; ela não pode virar complementar." };
  }

  const { error } = await supabase.from("propostas").update({
    mercado,
    pais_destino: mercado === "exportacao" ? paisDestino : null,
    papel,
    proposta_principal_id: papel === "complementar" ? propostaPrincipalId : null,
  }).eq("id", propostaId);
  if (error) return { message: faltaEstruturaCrm(error) ? AVISO_ESTRUTURA_CRM : error.message };

  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
  return { success: true };
}

export async function adicionarItem(
  _prev: PropostaFormState,
  formData: FormData
): Promise<PropostaFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const raw = {
    proposta_id:    formData.get("proposta_id"),
    descricao:      formData.get("descricao"),
    quantidade:     formData.get("quantidade"),
    preco_unitario: formData.get("preco_unitario"),
    ipi_pct:        formData.get("ipi_pct") || 0,
    opcional:       formData.get("opcional") === "true",
    observacao:     formData.get("observacao") || undefined,
  };

  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const d = parsed.data;
  const total = d.quantidade * d.preco_unitario * (1 + d.ipi_pct / 100);

  // Pega a próxima ordem
  const { count } = await supabase
    .from("itens_proposta")
    .select("*", { count: "exact", head: true })
    .eq("proposta_id", d.proposta_id);

  const { error } = await supabase.from("itens_proposta").insert({
    proposta_id:    d.proposta_id,
    descricao:      d.descricao,
    quantidade:     d.quantidade,
    preco_unitario: d.preco_unitario,
    ipi_pct:        d.ipi_pct,
    total,
    opcional:       d.opcional,
    observacao:     d.observacao || null,
    ordem:          (count ?? 0),
  });

  if (error) return { message: "Erro ao adicionar item: " + error.message };

  // Recalcula valor_total da proposta
  const { data: itens } = await supabase
    .from("itens_proposta")
    .select("total")
    .eq("proposta_id", d.proposta_id);

  const valor_total = (itens ?? []).reduce(
    (s: number, i: { total: number | null }) => s + (i.total ?? 0), 0
  );

  await supabase
    .from("propostas")
    .update({ valor_total })
    .eq("id", d.proposta_id);

  revalidatePath(`/propostas/${d.proposta_id}`);
  return {};
}

export async function removerItem(itemId: string, propostaId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  await supabase.from("itens_proposta").delete().eq("id", itemId);

  const { data: itens } = await supabase
    .from("itens_proposta")
    .select("total")
    .eq("proposta_id", propostaId);

  const valor_total = (itens ?? []).reduce(
    (s: number, i: { total: number | null }) => s + (i.total ?? 0), 0
  );

  await supabase.from("propostas").update({ valor_total }).eq("id", propostaId);
  revalidatePath(`/propostas/${propostaId}`);
}

/** Somente administrador. A proposta sai do sistema (funil, listas e indicadores), mas os dados ficam guardados no banco. */
export async function excluirProposta(propostaId: string): Promise<{ error?: string; success?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (usuario?.perfil !== "admin") return { error: "Somente o administrador pode excluir propostas." };

  const { data: proposta } = await supabase
    .from("propostas").select("id, numero_completo").eq("id", propostaId).is("deleted_at", null).maybeSingle();
  if (!proposta) return { error: "Proposta não encontrada." };

  // Uma proposta principal com alternativas complementares não pode sumir sozinha.
  const { data: dependentes, error: errDep } = await supabase
    .from("propostas").select("numero_completo").eq("proposta_principal_id", propostaId).is("deleted_at", null);
  if (!errDep && dependentes?.length) {
    const lista = (dependentes as Array<{ numero_completo: string }>).map((d) => d.numero_completo).join(", ");
    return { error: `Esta proposta é a principal de: ${lista}. Exclua ou desvincule as complementares antes.` };
  }

  const { data: excluidas, error } = await supabase
    .from("propostas").update({ deleted_at: new Date().toISOString() }).eq("id", propostaId).select("id");
  if (error) return { error: error.message };
  if (!excluidas?.length) return { error: SEM_PERMISSAO_ALTERAR };

  await registrarAuditoria({
    acao: "excluir_proposta", entidade: "propostas", entidade_id: propostaId, entidade_referencia: proposta.numero_completo,
  });
  revalidatePath("/propostas");
  revalidatePath("/clientes");
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { validarPrincipal } from "@/lib/propostas/crm-servidor";
import { AVISO_ESTRUTURA_CRM, STATUS_COM_MOTIVO, STATUS_EM_ACOMPANHAMENTO, STATUS_ENCERRADOS, faltaEstruturaCrm, negocioDe } from "@/lib/propostas/crm";

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

export async function criarProposta(
  _prev: PropostaFormState,
  formData: FormData
): Promise<PropostaFormState> {
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
    representante_id:  formData.get("representante_id") || representanteDoUsuario?.id || null,
    etapa_funil_id:    formData.get("etapa_funil_id") || null,
    condicao_pagamento: formData.get("condicao_pagamento") || undefined,
    prazo_entrega:     formData.get("prazo_entrega") || undefined,
    validade_proposta: formData.get("validade_proposta") || undefined,
    observacoes:       formData.get("observacoes") || undefined,
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
      etapa_funil_id:    d.etapa_funil_id || null,
      condicao_pagamento: d.condicao_pagamento || null,
      prazo_entrega:     d.prazo_entrega || null,
      validade_proposta: d.validade_proposta || null,
      observacoes:       d.observacoes || null,
  };

  let { data: proposta, error } = await supabase
    .from("propostas").insert({ ...dadosBase, ...camposCrm }).select("id").single();

  // Banco ainda sem a estrutura do CRM (arquivo 022): grava sem os campos novos, desde que
  // o usuário não tenha escolhido exportação nem proposta complementar.
  if (error && faltaEstruturaCrm(error)) {
    if (d.mercado !== "nacional" || d.papel !== "principal") return { message: AVISO_ESTRUTURA_CRM };
    ({ data: proposta, error } = await supabase.from("propostas").insert(dadosBase).select("id").single());
  }

  if (error) {
    if (error.message?.includes("row-level security") || error.code === "42501") {
      return { message: `Sem permissão para criar proposta. Verifique se o seed SQL foi executado no Supabase (perfil: ${usuario?.perfil ?? "não encontrado"}, uid: ${user.id.slice(0,8)}...).` };
    }
    return { message: "Erro ao criar proposta: " + error.message };
  }

  revalidatePath("/propostas");
  redirect(`/propostas/${proposta.id}`);
}

export async function atualizarStatusProposta(
  propostaId: string,
  novoStatus: string,
  detalhes?: {
    motivoCodigo?: string;
    motivoDetalhes?: string;
    motivoCongelamento?: string;
    retomadaPrevista?: string;
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // Antes do arquivo 022 as colunas do CRM não existem: trata como proposta principal simples.
  const leitura = await supabase
    .from("propostas")
    .select("id, status, papel, proposta_principal_id")
    .eq("id", propostaId)
    .maybeSingle();
  const estruturaCrm = !(leitura.error && faltaEstruturaCrm(leitura.error));
  const propostaAtual = estruturaCrm
    ? leitura.data
    : (await supabase.from("propostas").select("id, status").eq("id", propostaId).maybeSingle()).data;
  if (!propostaAtual) return { error: "Proposta não encontrada." };

  const precisaEstrutura = novoStatus === "cancelada" || novoStatus === "complementar_nao_selecionada" ||
    novoStatus === "stand_by" || STATUS_COM_MOTIVO.has(novoStatus);
  if (precisaEstrutura && !estruturaCrm) return { error: AVISO_ESTRUTURA_CRM };

  const hoje = new Date().toISOString().split("T")[0];

  // Próxima ação obrigatória para propostas em acompanhamento.
  if (STATUS_EM_ACOMPANHAMENTO.has(novoStatus)) {
    const { data: proxima } = await supabase
      .from("followups")
      .select("id")
      .eq("proposta_id", propostaId)
      .not("proxima_acao_data", "is", null)
      .gte("proxima_acao_data", hoje)
      .limit(1)
      .maybeSingle();
    if (!proxima) {
      return { error: "Registre um follow-up com a próxima ação (data a partir de hoje) antes de colocar a proposta em acompanhamento." };
    }
  }

  if (STATUS_COM_MOTIVO.has(novoStatus) && (!detalhes?.motivoCodigo || !detalhes.motivoDetalhes?.trim())) {
    return { error: "Informe o motivo e uma breve explicação para encerrar a proposta." };
  }
  if (novoStatus === "stand_by") {
    if (!detalhes?.motivoCongelamento?.trim() || !detalhes.retomadaPrevista) {
      return { error: "Informe o motivo do congelamento e a previsão de retomada." };
    }
    if (detalhes.retomadaPrevista < hoje) return { error: "A previsão de retomada não pode ser uma data passada." };
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
    updates.motivo_congelamento = detalhes?.motivoCongelamento?.trim();
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
        updates.retomada_prevista = null;
      }
    }
  }
  const { error } = await supabase.from("propostas").update(updates).eq("id", propostaId);
  if (error) return { error: faltaEstruturaCrm(error) ? AVISO_ESTRUTURA_CRM : error.message };
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
  return { success: true };
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

export async function excluirProposta(propostaId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { error } = await supabase
    .from("propostas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", propostaId);
  if (error) throw new Error(error.message);
  revalidatePath("/propostas");
  redirect("/propostas");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────────────────────

const propostaSchema = z.object({
  tipo:              z.enum(["maquina", "sistema", "exportacao", "pecas", "servico", "mista"]),
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

  // Busca perfil do usuário logado para usar como responsável padrão
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("perfil, representante_id")
    .eq("id", user.id)
    .single();

  const raw = {
    tipo:              formData.get("tipo"),
    moeda:             formData.get("moeda") || "BRL",
    cliente_id:        formData.get("cliente_id") || null,
    contato_nome:      formData.get("contato_nome") || undefined,
    contato_email:     formData.get("contato_email") || undefined,
    contato_telefone:  formData.get("contato_telefone") || undefined,
    canal_origem:      formData.get("canal_origem") || null,
    temperatura:       formData.get("temperatura") || null,
    responsavel_id:    formData.get("responsavel_id") || user.id,
    representante_id:  formData.get("representante_id") || usuario?.representante_id || null,
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
  const ano = new Date().getFullYear();

  // Gera número atômico via função do banco
  const { data: numData, error: numError } = await supabase
    .rpc("next_proposta_numero", { p_ano: ano });

  if (numError) return { message: "Erro ao gerar número da proposta." };

  const numero = numData as number;
  const numero_completo = `${String(numero).padStart(4, "0")}/${ano}`;

  // Verifica se o usuário tem perfil configurado (pré-condição para RLS passar)
  if (!usuario) {
    return { message: "Seu perfil não está configurado no sistema. Execute o seed SQL no Supabase para registrar seu usuário." };
  }

  const { data: proposta, error } = await supabase
    .from("propostas")
    .insert({
      numero,
      numero_completo,
      tipo:              d.tipo,
      moeda:             d.moeda,
      status:            "rascunho",
      cliente_id:        d.cliente_id || null,
      contato_nome:      d.contato_nome || null,
      contato_email:     d.contato_email || null,
      contato_telefone:  d.contato_telefone || null,
      canal_origem:      d.canal_origem || null,
      temperatura:       null,
      responsavel_id:    d.responsavel_id || user.id,
      representante_id:  d.representante_id || null,
      etapa_funil_id:    d.etapa_funil_id || null,
      condicao_pagamento: d.condicao_pagamento || null,
      prazo_entrega:     d.prazo_entrega || null,
      validade_proposta: d.validade_proposta || null,
      observacoes:       d.observacoes || null,
    })
    .select("id")
    .single();

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
  novoStatus: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const updates: Record<string, unknown> = { status: novoStatus };
  if (novoStatus === "enviada") updates.enviada_em = new Date().toISOString();
  if (["vendida", "perdida", "desistencia"].includes(novoStatus)) {
    updates.fechada_em = new Date().toISOString();
  }
  const { error } = await supabase.from("propostas").update(updates).eq("id", propostaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/propostas");
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moagemParaBanco } from "@/lib/propostas/checklist";

export interface ChecklistInput {
  segmento_aplicacao: string;
  produto_final: string;
  material: string;
  dimensoes: string;
  granulometria: string;
  moagem_tipo: string;
  forma_abastecimento: string;
  producao_horaria_kgh: number;
  voltagem: string;
}

export interface CartItemInput {
  produto_id: string;
  variante_id: string | null;
  codigo: string;
  descricao: string;
  preco_unitario: number;
  ipi_pct: number;
  quantidade: number;
  /** Texto complementar do item (ex.: descrição completa do moinho, para o orçamento). */
  observacao?: string | null;
}

export interface CriarPropostaPecasInput {
  cliente_id: string;
  maquina_id: string | null;
  tipo?: "pecas" | "maquina" | "sistema" | "exportacao" | "servico" | "mista";
  moeda: "BRL" | "USD";
  itens: CartItemInput[];
  condicao_pagamento?: string;
  prazo_entrega?: string;
  validade_proposta?: string;
  observacoes?: string;
  taxa_cambio?: number;
  /** Checklist técnico da aplicação (proposta de máquina) — vai para o Word. */
  checklist?: ChecklistInput;
}

export async function criarPropostaPecas(
  input: CriarPropostaPecasInput
): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (!usuario) return { error: "Seu usuário não está cadastrado no ERP. Fale com o administrador." };

  // O vínculo usuário → representante fica em representantes.usuario_id.
  const { data: representante } = await supabase
    .from("representantes")
    .select("id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (input.itens.length === 0) return { error: "Adicione ao menos um item à proposta." };

  const ano = new Date().getFullYear();
  const { data: numData, error: numErr } = await supabase.rpc("next_proposta_numero", { p_ano: ano });
  if (numErr) return { error: "Erro ao gerar número da proposta." };

  const numero = numData as number;
  const numero_completo = `${String(numero).padStart(4, "0")}/${ano}`;

  const { data: proposta, error: propErr } = await supabase
    .from("propostas")
    .insert({
      numero,
      numero_completo,
      tipo:               input.tipo ?? "pecas",
      moeda:              input.moeda,
      status:             "rascunho",
      cliente_id:         input.cliente_id,
      maquina_id:         input.maquina_id || null,
      responsavel_id:     user.id,
      representante_id:   representante?.id ?? null,
      condicao_pagamento: input.condicao_pagamento || null,
      prazo_entrega:      input.prazo_entrega || null,
      validade_proposta:  input.validade_proposta || null,
      observacoes:        input.observacoes || null,
      temperatura:        null,
    })
    .select("id")
    .single();

  if (propErr) {
    if (propErr.message?.includes("row-level security") || propErr.code === "42501") {
      return { error: "Sem permissão. Verifique se seu perfil está configurado no Supabase." };
    }
    return { error: "Erro ao criar proposta: " + propErr.message };
  }

  const propostaId = proposta.id as string;

  const itensPrepared = input.itens.map((item, idx) => ({
    proposta_id:    propostaId,
    produto_id:     item.produto_id,
    variante_id:    item.variante_id || null,
    descricao:      item.descricao,
    quantidade:     item.quantidade,
    preco_tabela:   item.preco_unitario,
    preco_unitario: item.preco_unitario,
    ipi_pct:        item.ipi_pct,
    total:          item.quantidade * item.preco_unitario * (1 + item.ipi_pct / 100),
    ordem:          idx,
    opcional:       false,
    observacao:     item.observacao?.trim() || null,
  }));

  const { error: itensErr } = await supabase.from("itens_proposta").insert(itensPrepared);
  if (itensErr) {
    await supabase.from("propostas").delete().eq("id", propostaId);
    return { error: "Erro ao inserir itens: " + itensErr.message };
  }

  const valor_total = itensPrepared.reduce((s, i) => s + (i.total ?? 0), 0);
  await supabase.from("propostas").update({ valor_total }).eq("id", propostaId);

  if (input.checklist) {
    // A proposta acabou de ser criada por este usuário; gravação direta evita que a
    // permissão por perfil (ex.: representante só lê checklist) perca os dados.
    // Se o checklist não gravar, a proposta é desfeita — nada fica salvo pela metade.
    const c = input.checklist;
    const { error: checklistErr } = await createAdminClient().from("checklist_tecnico").upsert(
      {
        proposta_id:          propostaId,
        segmento_aplicacao:   c.segmento_aplicacao.trim(),
        produto_final:        c.produto_final.trim(),
        material:             c.material.trim(),
        dimensoes:            c.dimensoes.trim(),
        granulometria:        c.granulometria.trim(),
        moagem_tipo:          moagemParaBanco(c.moagem_tipo),
        forma_abastecimento:  c.forma_abastecimento,
        producao_horaria_kgh: c.producao_horaria_kgh,
        voltagem:             c.voltagem,
        completo:             true,
        preenchido_em:        new Date().toISOString(),
        preenchido_por:       user.id,
      },
      { onConflict: "proposta_id" }
    );
    if (checklistErr) {
      await supabase.from("propostas").delete().eq("id", propostaId);
      return { error: "Erro ao salvar o checklist técnico: " + checklistErr.message };
    }
  }

  revalidatePath("/propostas");
  redirect(`/propostas/${propostaId}`);
}

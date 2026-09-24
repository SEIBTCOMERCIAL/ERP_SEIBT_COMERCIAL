"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moagemParaBanco } from "@/lib/propostas/checklist";
import { numeroComRevisao, precoComDesconto, proximaRevisao } from "@/lib/propostas/revisao";
import type { ChecklistInput } from "./propostas-pecas";

export interface ItemEdicao {
  produto_id: string | null;
  descricao: string;
  /** Texto do item (descritivo) que vai na coluna DETALHES do Word. */
  observacao: string | null;
  quantidade: number;
  /** Preço de tabela (sem desconto). */
  preco_tabela: number;
  desconto_pct: number;
  ipi_pct: number;
}

export interface EdicaoPropostaInput {
  propostaId: string;
  itens: ItemEdicao[];
  condicao_pagamento: string;
  prazo_entrega: string;
  validade_proposta: string | null;
  observacoes: string;
  checklist?: ChecklistInput | null;
}

/**
 * Salva a edição de uma proposta já gerada. Cada edição salva vira uma nova
 * revisão: 1177/2026 → 1177/2026 A → 1177/2026 B…
 */
export async function salvarEdicaoProposta(input: EdicaoPropostaInput): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, numero_completo, revisao, tipo")
    .eq("id", input.propostaId)
    .is("deleted_at", null)
    .single();
  if (!proposta) return { error: "Proposta não encontrada." };

  if (input.itens.length === 0) return { error: "A proposta precisa ter ao menos um item." };
  for (const it of input.itens) {
    if (!it.descricao.trim()) return { error: "Todo item precisa de uma descrição." };
    if (!(it.quantidade >= 1)) return { error: `Quantidade inválida em "${it.descricao}".` };
    if (!(it.desconto_pct >= 0 && it.desconto_pct <= 100)) return { error: `Desconto inválido em "${it.descricao}" (use de 0 a 100%).` };
  }

  const revisao = proximaRevisao(proposta.revisao);
  const numero_completo = numeroComRevisao(proposta.numero_completo, revisao);

  const { data: antigos } = await supabase
    .from("itens_proposta")
    .select("id")
    .eq("proposta_id", proposta.id);

  const novos = input.itens.map((it, idx) => {
    const preco = precoComDesconto(it.preco_tabela, it.desconto_pct);
    return {
      proposta_id:    proposta.id,
      produto_id:     it.produto_id,
      variante_id:    null,
      descricao:      it.descricao.trim(),
      observacao:     it.observacao?.trim() || null,
      quantidade:     Math.round(it.quantidade),
      preco_tabela:   it.preco_tabela,
      preco_unitario: preco,
      ipi_pct:        it.ipi_pct,
      total:          Math.round(it.quantidade) * preco * (1 + it.ipi_pct / 100),
      ordem:          idx,
      opcional:       false,
    };
  });

  // Grava os itens novos antes de apagar os antigos: se algo falhar, nada se perde.
  const { data: inseridos, error: insErr } = await supabase.from("itens_proposta").insert(novos).select("id");
  if (insErr) return { error: "Erro ao salvar os itens: " + insErr.message };

  const idsAntigos = ((antigos ?? []) as { id: string }[]).map((i) => i.id);
  if (idsAntigos.length) {
    const { error: delErr } = await supabase.from("itens_proposta").delete().in("id", idsAntigos);
    if (delErr) {
      const idsNovos = ((inseridos ?? []) as { id: string }[]).map((i) => i.id);
      if (idsNovos.length) await supabase.from("itens_proposta").delete().in("id", idsNovos);
      return { error: "Erro ao substituir os itens: " + delErr.message };
    }
  }

  const valor_total = novos.reduce((s, i) => s + i.total, 0);
  const { error: upErr } = await supabase
    .from("propostas")
    .update({
      revisao,
      numero_completo,
      valor_total,
      condicao_pagamento: input.condicao_pagamento.trim() || null,
      prazo_entrega:      input.prazo_entrega.trim() || null,
      validade_proposta:  input.validade_proposta || null,
      observacoes:        input.observacoes.trim() || null,
    })
    .eq("id", proposta.id);
  if (upErr) return { error: "Erro ao salvar a proposta: " + upErr.message };

  if (input.checklist && proposta.tipo === "maquina") {
    const c = input.checklist;
    const { error: ckErr } = await createAdminClient().from("checklist_tecnico").upsert(
      {
        proposta_id:          proposta.id,
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
    if (ckErr) return { error: "Proposta salva, mas o checklist não: " + ckErr.message };
  }

  revalidatePath("/propostas");
  revalidatePath(`/propostas/${proposta.id}`);
  redirect(`/propostas/${proposta.id}`);
}

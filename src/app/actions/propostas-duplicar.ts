"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarEtapas, inserirPropostaComOrganizacao, registrarHistorico, usuarioAtual, validarPrincipal } from "@/lib/propostas/crm-servidor";
import { STATUS_ENCERRADOS, faltaEstruturaCrm } from "@/lib/propostas/crm";
import { etapaInicial } from "@/lib/propostas/funil";

function hojeMaisDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Cria uma proposta nova (com número novo) a partir de outra, para o mesmo cliente: copia itens, checklist,
 * condições e representante. Anexos e follow-ups não são copiados. A nova proposta nasce como rascunho,
 * na etapa inicial, e pode ser uma proposta independente ou uma alternativa (complementar) da original.
 */
export async function duplicarProposta(
  propostaId: string,
  comoComplementar: boolean
): Promise<{ error?: string; id?: string; numero?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { error: "Não autorizado." };
  if (usuario.perfil !== "admin" && usuario.perfil !== "vendedor_interno") {
    return { error: "Seu perfil não cria propostas. Peça ao responsável ou ao administrador." };
  }

  const camposBase = "id, numero_completo, tipo, moeda, status, cliente_id, contato_nome, contato_email, contato_telefone, canal_origem, representante_id, condicao_pagamento, prazo_entrega, observacoes, descricao_livre";
  let original: Record<string, unknown> | null = null;
  let estruturaCrm = true;
  {
    const r = await supabase.from("propostas").select(`${camposBase}, mercado, pais_destino, papel, proposta_principal_id`).eq("id", propostaId).is("deleted_at", null).maybeSingle();
    if (r.error && faltaEstruturaCrm(r.error)) {
      estruturaCrm = false;
      original = (await supabase.from("propostas").select(camposBase).eq("id", propostaId).is("deleted_at", null).maybeSingle()).data;
    } else {
      original = r.data;
    }
  }
  if (!original) return { error: "Proposta não encontrada." };

  const camposItem = "produto_id, variante_id, descricao, observacao, quantidade, preco_tabela, preco_unitario, ipi_pct, ordem, opcional";
  let itensOriginais: Array<Record<string, unknown>> = [];
  {
    const r = await supabase.from("itens_proposta").select(`${camposItem}, destaque`).eq("proposta_id", propostaId).order("ordem");
    itensOriginais = r.error
      ? ((await supabase.from("itens_proposta").select(camposItem).eq("proposta_id", propostaId).order("ordem")).data ?? [])
      : (r.data ?? []);
  }
  if (!itensOriginais.length) return { error: "A proposta não tem itens para copiar." };

  // Alternativa (complementar): vincula à principal do negócio; a original precisa estar aberta.
  let principalId: string | null = null;
  if (comoComplementar) {
    if (!estruturaCrm) return { error: "Alternativas complementares dependem da atualização do banco de dados (arquivo 022)." };
    principalId = original.papel === "complementar" && original.proposta_principal_id ? String(original.proposta_principal_id) : String(original.id);
    if (STATUS_ENCERRADOS.has(String(original.status)) && principalId === original.id) {
      return { error: "A proposta original está encerrada. Duplique como proposta independente." };
    }
    const erro = await validarPrincipal(supabase, principalId, (original.cliente_id as string | null) ?? null);
    if (erro) return { error: erro };
  }

  const { etapas } = await carregarEtapas(supabase);
  const dadosBase = {
    tipo: original.tipo,
    moeda: original.moeda,
    status: "rascunho",
    cliente_id: original.cliente_id,
    contato_nome: original.contato_nome,
    contato_email: original.contato_email,
    contato_telefone: original.contato_telefone,
    canal_origem: original.canal_origem,
    temperatura: null,
    responsavel_id: usuario.id,
    representante_id: original.representante_id,
    etapa_funil_id: etapaInicial(etapas)?.id ?? null,
    condicao_pagamento: original.condicao_pagamento,
    prazo_entrega: original.prazo_entrega,
    validade_proposta: hojeMaisDias(15),
    observacoes: original.observacoes,
    descricao_livre: original.descricao_livre,
  };
  const camposCrm = {
    mercado: original.mercado ?? "nacional",
    pais_destino: original.pais_destino ?? null,
    papel: comoComplementar ? "complementar" : "principal",
    proposta_principal_id: comoComplementar ? principalId : null,
  };

  const { data: nova, error: errNova } = await inserirPropostaComOrganizacao(supabase, dadosBase, camposCrm);
  if (errNova || !nova) return { error: "Não foi possível criar a nova proposta: " + (errNova?.message ?? "sem resposta do banco") };

  const itensNovos = itensOriginais.map((it) => {
    const qtd = Number(it.quantidade);
    const preco = Number(it.preco_unitario);
    const ipi = Number(it.ipi_pct ?? 0);
    return {
      proposta_id: nova.id,
      produto_id: it.produto_id ?? null,
      variante_id: it.variante_id ?? null,
      descricao: it.descricao,
      observacao: it.observacao ?? null,
      quantidade: qtd,
      preco_tabela: it.preco_tabela ?? null,
      preco_unitario: preco,
      ipi_pct: ipi,
      total: qtd * preco * (1 + ipi / 100),
      ordem: it.ordem,
      opcional: Boolean(it.opcional),
      destaque: Boolean(it.destaque),
    };
  });
  let { error: errItens } = await supabase.from("itens_proposta").insert(itensNovos);
  if (errItens && faltaEstruturaCrm(errItens)) {
    ({ error: errItens } = await supabase.from("itens_proposta").insert(itensNovos.map((n) => { const resto: Record<string, unknown> = { ...n }; delete resto.destaque; return resto; })));
  }
  if (errItens) {
    await supabase.from("propostas").delete().eq("id", nova.id);
    return { error: "Não foi possível copiar os itens: " + errItens.message };
  }
  await supabase.from("propostas").update({ valor_total: itensNovos.reduce((s, i) => s + i.total, 0) }).eq("id", nova.id);

  // Checklist técnico (propostas de máquina): copiado para a nova proposta.
  const { data: checklist } = await supabase.from("checklist_tecnico").select("*").eq("proposta_id", propostaId).maybeSingle();
  if (checklist) {
    const copia: Record<string, unknown> = { ...checklist, proposta_id: nova.id };
    delete copia.id;
    const { error: errCk } = await createAdminClient().from("checklist_tecnico").upsert(copia, { onConflict: "proposta_id" });
    if (errCk) {
      await supabase.from("propostas").delete().eq("id", nova.id);
      return { error: "Não foi possível copiar o checklist: " + errCk.message };
    }
  }

  await registrarHistorico(supabase, {
    propostaId: nova.id,
    tipo: "observacao",
    descricao: `Duplicada da proposta ${original.numero_completo}${comoComplementar ? " (alternativa complementar)" : ""}`,
  });
  revalidatePath("/propostas");
  return { id: nova.id, numero: nova.numero_completo ?? "" };
}

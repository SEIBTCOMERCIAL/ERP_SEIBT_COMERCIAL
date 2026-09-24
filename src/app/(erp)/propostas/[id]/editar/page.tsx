import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarTodos } from "@/lib/supabase/buscar-todos";
import { EditarPropostaForm, type ProdutoParaAdicionar } from "@/components/propostas/EditarPropostaForm";
import type { ItemEdicao } from "@/app/actions/propostas-editar";
import type { ChecklistInput } from "@/app/actions/propostas-pecas";
import { moagemRotulo } from "@/lib/propostas/checklist";

export const dynamic = "force-dynamic";

export default async function EditarPropostaPage({ params }: { params: { id: string } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const [{ data: proposta }, { data: itens }, { data: checklist }, rawProdutos] = await Promise.all([
    supabase
      .from("propostas")
      .select("id, numero_completo, revisao, tipo, condicao_pagamento, prazo_entrega, validade_proposta, observacoes, cliente_id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("itens_proposta")
      .select("produto_id, descricao, observacao, quantidade, preco_tabela, preco_unitario, desconto_pct, ipi_pct")
      .eq("proposta_id", params.id)
      .order("ordem"),
    supabase
      .from("checklist_tecnico")
      .select("segmento_aplicacao, produto_final, material, dimensoes, granulometria, moagem_tipo, forma_abastecimento, producao_horaria_kgh, voltagem")
      .eq("proposta_id", params.id)
      .maybeSingle(),
    buscarTodos((de, ate) => supabase
      .from("produtos")
      .select("id, codigo, descricao, descricao_painel, categoria, preco_brl, ipi_pct")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("codigo")
      .order("id")
      .range(de, ate)),
  ]);

  if (!proposta) notFound();

  const { data: cliente } = proposta.cliente_id
    ? await supabase.from("clientes").select("razao_social").eq("id", proposta.cliente_id).single()
    : { data: null };

  type ItemBanco = {
    produto_id: string | null; descricao: string; observacao: string | null; quantidade: number;
    preco_tabela: number | null; preco_unitario: number; desconto_pct: number | null; ipi_pct: number | null;
  };
  const itensIniciais: ItemEdicao[] = ((itens ?? []) as ItemBanco[]).map((it) => {
    const tabela = Number(it.preco_tabela ?? 0) > 0 ? Number(it.preco_tabela) : Number(it.preco_unitario);
    const desconto = tabela > 0 ? Math.round((1 - Number(it.preco_unitario) / tabela) * 10000) / 100 : 0;
    return {
      produto_id: it.produto_id,
      descricao: it.descricao,
      observacao: it.observacao,
      quantidade: it.quantidade,
      preco_tabela: tabela,
      desconto_pct: Math.max(0, desconto),
      ipi_pct: Number(it.ipi_pct ?? 0),
    };
  });

  const checklistInicial: ChecklistInput | null = proposta.tipo === "maquina"
    ? {
        segmento_aplicacao: checklist?.segmento_aplicacao ?? "",
        produto_final: checklist?.produto_final ?? "",
        material: checklist?.material ?? "",
        dimensoes: checklist?.dimensoes ?? "",
        granulometria: checklist?.granulometria ?? "",
        moagem_tipo: checklist?.moagem_tipo ? moagemRotulo(checklist.moagem_tipo) : "A seco",
        forma_abastecimento: checklist?.forma_abastecimento ?? "Esteira transportadora",
        producao_horaria_kgh: checklist?.producao_horaria_kgh != null ? Number(checklist.producao_horaria_kgh) : 0,
        voltagem: checklist?.voltagem ?? "380V 60Hz",
      }
    : null;

  const produtos = (rawProdutos ?? []) as ProdutoParaAdicionar[];

  return (
    <EditarPropostaForm
      propostaId={proposta.id}
      numeroCompleto={proposta.numero_completo}
      revisaoAtual={proposta.revisao}
      clienteNome={cliente?.razao_social ?? ""}
      itensIniciais={itensIniciais}
      condicaoInicial={proposta.condicao_pagamento ?? ""}
      prazoInicial={proposta.prazo_entrega ?? ""}
      validadeInicial={proposta.validade_proposta ?? ""}
      observacoesIniciais={proposta.observacoes ?? ""}
      checklistInicial={checklistInicial}
      produtos={produtos}
    />
  );
}

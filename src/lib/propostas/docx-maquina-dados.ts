// Busca no banco tudo o que o modelo de Word da proposta de máquina precisa.
// Só roda no servidor (recebe o cliente do Supabase já criado).

import type { DadosDocxMaquina, ItemDocx } from "./docx-modelo";
import { moagemRotulo } from "./checklist";

const FUSO = "America/Sao_Paulo";

function dataBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO });
}

/** "2026-10-09" → dias desde a criação da proposta + data, ex.: "15 dias (até 09/10/2026)". */
function textoValidade(validade: string | null, criadoEm: string): string {
  if (!validade) return "15 dias";
  const [a, m, d] = validade.slice(0, 10).split("-").map(Number);
  const fim = Date.UTC(a!, m! - 1, d!);
  const [ca, cm, cd] = new Date(criadoEm).toLocaleDateString("en-CA", { timeZone: FUSO }).split("-").map(Number);
  const inicio = Date.UTC(ca!, cm! - 1, cd!);
  const dias = Math.round((fim - inicio) / 86_400_000);
  const ate = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  return dias > 0 ? `${dias} dias (até ${ate})` : `até ${ate}`;
}

function limparNomeArquivo(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function carregarDadosDocxMaquina(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  propostaId: string
): Promise<{ dados: DadosDocxMaquina; nomeArquivo: string } | null> {
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, numero, numero_completo, criado_em, condicao_pagamento, prazo_entrega, validade_proposta, cliente_id, responsavel_id, representante_id, contato_nome, contato_email, contato_telefone")
    .eq("id", propostaId)
    .is("deleted_at", null)
    .single();
  if (!proposta) return null;

  const [
    { data: cliente },
    { data: contatos },
    { data: itens },
    { data: checklist },
    { data: responsavel },
    { data: representante },
  ] = await Promise.all([
    proposta.cliente_id
      ? supabase.from("clientes").select("razao_social, nome_fantasia, cidade, estado").eq("id", proposta.cliente_id).single()
      : Promise.resolve({ data: null }),
    proposta.cliente_id
      ? supabase.from("contatos_cliente").select("nome, tratamento, telefone, email, principal").eq("cliente_id", proposta.cliente_id).eq("ativo", true).order("principal", { ascending: false }).limit(1)
      : Promise.resolve({ data: [] }),
    supabase
      .from("itens_proposta")
      .select("descricao, quantidade, preco_unitario, ipi_pct, total, observacao, produto:produtos(codigo, categoria)")
      .eq("proposta_id", propostaId)
      .order("ordem"),
    supabase
      .from("checklist_tecnico")
      .select("segmento_aplicacao, produto_final, material, dimensoes, granulometria, moagem_tipo, forma_abastecimento, producao_horaria_kgh, voltagem")
      .eq("proposta_id", propostaId)
      .maybeSingle(),
    proposta.responsavel_id
      ? supabase.from("usuarios").select("nome").eq("id", proposta.responsavel_id).single()
      : Promise.resolve({ data: null }),
    proposta.representante_id
      ? supabase.from("representantes").select("nome").eq("id", proposta.representante_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const contato = contatos?.[0] ?? null;
  const cidade = (cliente?.cidade ?? "").trim();
  const uf = (cliente?.estado ?? "").trim();

  type ItemBanco = {
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    ipi_pct: number | null;
    total: number | null;
    observacao: string | null;
    produto: { codigo: string; categoria: string } | null;
  };

  const itensDocx: ItemDocx[] = ((itens ?? []) as ItemBanco[]).map((it) => {
    const ipi = Number(it.ipi_pct ?? 0);
    const ehMaquina = it.produto?.categoria === "maquina" && !/^painel el[ée]trico/i.test(it.descricao);
    const codigo = it.produto?.codigo ?? "";
    const titulo = !ehMaquina && codigo && !it.descricao.includes(codigo)
      ? `${it.descricao} - CÓD. ${codigo}`
      : it.descricao;
    return {
      titulo,
      texto: it.observacao?.trim() || null,
      maquina: ehMaquina,
      quantidade: it.quantidade,
      precoUnitario: Number(it.preco_unitario),
      ipiPct: ipi,
      total: Number(it.total ?? it.quantidade * it.preco_unitario * (1 + ipi / 100)),
    };
  });

  const moagem = moagemRotulo(checklist?.moagem_tipo);
  const nomeCliente = (cliente?.razao_social ?? cliente?.nome_fantasia ?? "").trim();
  const responsavelNome = (responsavel?.nome ?? "Departamento Comercial").trim();

  const dados: DadosDocxMaquina = {
    numero: proposta.numero_completo,
    data: dataBR(new Date(proposta.criado_em)),
    cliente: nomeCliente,
    endereco: [cidade, uf].filter(Boolean).join(" - ").toUpperCase(),
    tratamento: contato?.tratamento === "sra" ? "SRA." : "SR.",
    contato: (proposta.contato_nome ?? contato?.nome ?? "").trim(),
    telefone: (proposta.contato_telefone ?? contato?.telefone ?? "").trim(),
    email: (proposta.contato_email ?? contato?.email ?? "").trim(),
    cc: (representante?.nome ?? "SEIBT").trim(),
    checklist: {
      segmento: checklist?.segmento_aplicacao ?? "",
      produto: checklist?.produto_final ?? "",
      material: checklist?.material ?? "",
      dimensoes: checklist?.dimensoes ?? "",
      granulometria: checklist?.granulometria ?? "",
      moagemSeco: !moagem ? "" : /^a\s*seco$/i.test(moagem) ? "SIM" : `NÃO – ${moagem}`,
      abastecimento: checklist?.forma_abastecimento ?? "",
      producao: checklist?.producao_horaria_kgh != null ? `${Number(checklist.producao_horaria_kgh).toLocaleString("pt-BR")} kg/h` : "",
      voltagem: checklist?.voltagem ?? "",
    },
    itens: itensDocx,
    condicaoPagamento: (proposta.condicao_pagamento ?? "").trim(),
    prazoEntrega: (proposta.prazo_entrega ?? "").trim(),
    validade: textoValidade(proposta.validade_proposta, proposta.criado_em),
    responsavel: responsavelNome,
  };

  // Mesmo padrão de nome dos arquivos da SEIBT:
  // "CLIENTE - CIDADE - UF - 01 MGHS 300 A2 10 CV - 1173.docx"
  const principal = ((itens ?? []) as ItemBanco[]).find((it) => it.produto?.categoria === "maquina");
  const equipamento = principal
    ? `${String(principal.quantidade).padStart(2, "0")} ${principal.produto?.codigo ?? principal.descricao}`
    : "";
  const nomeArquivo = limparNomeArquivo(
    [nomeCliente.toUpperCase(), cidade.toUpperCase(), uf.toUpperCase(), equipamento, String(proposta.numero).padStart(4, "0")]
      .filter(Boolean)
      .join(" - ")
  ) + ".docx";

  return { dados, nomeArquivo };
}

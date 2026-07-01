import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: { propostaId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const [
    { data: proposta },
    { data: itens },
    { data: checklist },
    { data: cliente },
  ] = await Promise.all([
    supabase
      .from("propostas")
      .select("*, responsavel:responsavel_id(nome, iniciais_pdf)")
      .eq("id", params.propostaId)
      .single(),
    supabase
      .from("itens_proposta")
      .select("*")
      .eq("proposta_id", params.propostaId)
      .order("ordem"),
    supabase
      .from("checklist_tecnico")
      .select("*")
      .eq("proposta_id", params.propostaId)
      .single(),
    supabase
      .from("clientes")
      .select("razao_social, nome_fantasia, cnpj, cidade, estado")
      .eq("id", (await supabase.from("propostas").select("cliente_id").eq("id", params.propostaId).single()).data?.cliente_id)
      .single(),
  ]);

  const valorTotal = itens?.reduce(
    (acc: number, item: { total: number | null; quantidade: number; preco_unitario: number }) =>
      acc + (item.total ?? item.quantidade * item.preco_unitario),
    0
  ) ?? 0;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #2C4F79; padding-bottom: 16px; }
  .brand { color: #2C4F79; font-size: 22px; font-weight: 700; letter-spacing: 2px; }
  .brand-sub { font-size: 10px; color: #6b7b8d; margin-top: 2px; }
  .prop-num { text-align: right; }
  .prop-num-val { font-size: 18px; font-weight: 700; color: #2C4F79; }
  .prop-num-label { font-size: 9px; color: #6b7b8d; text-transform: uppercase; letter-spacing: 1px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #2C4F79; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .field-label { font-size: 9px; color: #6b7b8d; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .field-value { font-size: 11px; color: #1a1a1a; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #2C4F79; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 8px; text-align: left; }
  td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .td-right { text-align: right; }
  .totals { margin-top: 12px; display: flex; justify-content: flex-end; }
  .totals-box { border: 2px solid #2C4F79; border-radius: 4px; padding: 12px 16px; min-width: 220px; }
  .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
  .total-final { font-size: 14px; font-weight: 700; color: #2C4F79; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #6b7b8d; font-size: 9px; }
  .checklist-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">SEIBT</div>
    <div class="brand-sub">Seibt Máquinas e Equipamentos</div>
    <div class="brand-sub">www.seibt.com.br · comercial@seibt.com.br</div>
  </div>
  <div class="prop-num">
    <div class="prop-num-label">Proposta Comercial</div>
    <div class="prop-num-val">${proposta?.numero_completo ?? ""}</div>
    <div class="brand-sub">Data: ${formatDate(proposta?.criado_em)}</div>
    <div class="brand-sub">Responsável: ${(proposta?.responsavel as { nome?: string } | null)?.nome ?? ""}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Cliente</div>
  <div class="grid-3">
    <div><div class="field-label">Razão Social</div><div class="field-value">${cliente?.razao_social ?? "—"}</div></div>
    <div><div class="field-label">CNPJ</div><div class="field-value">${cliente?.cnpj ?? "—"}</div></div>
    <div><div class="field-label">Cidade/UF</div><div class="field-value">${cliente?.cidade ?? "—"}/${cliente?.estado ?? "—"}</div></div>
  </div>
</div>

${checklist ? `
<div class="section">
  <div class="section-title">Checklist Técnico da Aplicação</div>
  <div class="checklist-grid">
    <div><div class="field-label">Segmento</div><div class="field-value">${checklist.segmento_aplicacao}</div></div>
    <div><div class="field-label">Produto Final</div><div class="field-value">${checklist.produto_final}</div></div>
    <div><div class="field-label">Material</div><div class="field-value">${checklist.material}</div></div>
    <div><div class="field-label">Dimensões</div><div class="field-value">${checklist.dimensoes}</div></div>
    <div><div class="field-label">Granulometria</div><div class="field-value">${checklist.granulometria}</div></div>
    <div><div class="field-label">Tipo de Moagem</div><div class="field-value">${checklist.moagem_tipo}</div></div>
    <div><div class="field-label">Abastecimento</div><div class="field-value">${checklist.forma_abastecimento}</div></div>
    <div><div class="field-label">Produção (kg/h)</div><div class="field-value">${checklist.producao_horaria_kgh}</div></div>
    <div><div class="field-label">Voltagem</div><div class="field-value">${checklist.voltagem}</div></div>
  </div>
</div>
` : ""}

<div class="section">
  <div class="section-title">Itens da Proposta</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Descrição</th>
        <th>Qtd</th>
        <th>Preço Unitário</th>
        <th>IPI %</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${(itens ?? []).map((item: { numero_item?: string; descricao: string; quantidade: number; preco_unitario: number; ipi_pct: number; total?: number | null }, i: number) => `
      <tr>
        <td>${item.numero_item ?? i + 1}</td>
        <td>${item.descricao}</td>
        <td class="td-right">${item.quantidade}</td>
        <td class="td-right">${formatCurrency(item.preco_unitario)}</td>
        <td class="td-right">${item.ipi_pct}%</td>
        <td class="td-right">${formatCurrency(item.total ?? item.quantidade * item.preco_unitario)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  <div class="totals">
    <div class="totals-box">
      <div class="total-row"><span>Subtotal:</span><span>${formatCurrency(valorTotal)}</span></div>
      ${proposta?.condicao_pagamento ? `<div class="total-row"><span>Pagamento:</span><span>${proposta.condicao_pagamento}</span></div>` : ""}
      ${proposta?.prazo_entrega ? `<div class="total-row"><span>Prazo:</span><span>${proposta.prazo_entrega}</span></div>` : ""}
      ${proposta?.validade_proposta ? `<div class="total-row"><span>Validade:</span><span>${proposta.validade_proposta}</span></div>` : ""}
      <div class="total-row total-final"><span>TOTAL</span><span>${formatCurrency(valorTotal)}</span></div>
    </div>
  </div>
</div>

${proposta?.observacoes ? `
<div class="section">
  <div class="section-title">Observações</div>
  <p style="font-size:11px;line-height:1.5">${proposta.observacoes}</p>
</div>
` : ""}

<div class="footer">
  <span>Seibt Máquinas e Equipamentos Ltda</span>
  <span>Gerado em ${formatDate(new Date().toISOString())}</span>
  <span>${proposta?.numero_completo ?? ""}</span>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

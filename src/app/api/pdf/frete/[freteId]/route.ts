import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export async function GET(
  req: Request,
  { params }: { params: { freteId: string } }
) {
  const tipo = new URL(req.url).searchParams.get("tipo") ?? "cliente";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: frete } = await supabase
    .from("fretes")
    .select("*")
    .eq("id", params.freteId)
    .single();

  if (!frete) {
    return new NextResponse("Frete não encontrado", { status: 404 });
  }

  const isCliente = tipo === "cliente";
  const titulo = isCliente ? "Folder do Cliente" : "Folder da Transportadora";

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
  .doc-type { text-align: right; font-size: 14px; font-weight: 700; color: #2C4F79; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #2C4F79; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .field-label { font-size: 9px; color: #6b7b8d; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .field-value { font-size: 12px; color: #1a1a1a; font-weight: 500; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .badge-cif { background: #dbeafe; color: #1d4ed8; }
  .badge-fob { background: #fef3c7; color: #92400e; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #6b7b8d; font-size: 9px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">SEIBT</div>
    <div class="brand-sub">Seibt Máquinas e Equipamentos</div>
    <div class="brand-sub">www.seibt.com.br</div>
  </div>
  <div>
    <div class="doc-type">${titulo}</div>
    <div class="brand-sub" style="text-align:right">Data: ${formatDate(new Date().toISOString())}</div>
    ${frete.pedido_numero ? `<div class="brand-sub" style="text-align:right">Pedido: ${frete.pedido_numero}</div>` : ""}
  </div>
</div>

<div class="section">
  <div class="section-title">Produto / Carga</div>
  <div class="grid-2">
    <div><div class="field-label">Descrição</div><div class="field-value">${frete.descricao_produto}</div></div>
    <div><div class="field-label">Tipo de Frete</div><div class="field-value"><span class="badge badge-${frete.tipo_frete}">${frete.tipo_frete.toUpperCase()}</span></div></div>
  </div>
  <div class="grid-3" style="margin-top:10px">
    ${frete.peso_bruto_kg ? `<div><div class="field-label">Peso Bruto</div><div class="field-value">${frete.peso_bruto_kg} kg</div></div>` : ""}
    ${frete.volume_m3 ? `<div><div class="field-label">Volume</div><div class="field-value">${frete.volume_m3} m³</div></div>` : ""}
    ${(frete.dimensoes_l && frete.dimensoes_a && frete.dimensoes_p) ? `<div><div class="field-label">Dimensões (L×A×P)</div><div class="field-value">${frete.dimensoes_l}×${frete.dimensoes_a}×${frete.dimensoes_p} m</div></div>` : ""}
  </div>
</div>

${isCliente ? `
<div class="section">
  <div class="section-title">Endereço de Entrega</div>
  <div class="grid-2">
    <div><div class="field-label">Cidade/UF Destino</div><div class="field-value">${frete.cidade_destino ?? "—"}/${frete.estado_destino ?? "—"}</div></div>
    <div><div class="field-label">Endereço Completo</div><div class="field-value">${frete.endereco_destino ?? "—"}</div></div>
  </div>
</div>
` : `
<div class="section">
  <div class="section-title">Remetente e Destinatário</div>
  <div class="grid-2">
    <div>
      <div class="field-label">Origem</div>
      <div class="field-value">${frete.cidade_origem ?? "—"}/${frete.estado_origem ?? "—"}</div>
      ${frete.endereco_origem ? `<div style="font-size:10px;color:#6b7b8d;margin-top:2px">${frete.endereco_origem}</div>` : ""}
    </div>
    <div>
      <div class="field-label">Destino</div>
      <div class="field-value">${frete.cidade_destino ?? "—"}/${frete.estado_destino ?? "—"}</div>
      ${frete.endereco_destino ? `<div style="font-size:10px;color:#6b7b8d;margin-top:2px">${frete.endereco_destino}</div>` : ""}
    </div>
  </div>
  ${frete.transportadora ? `<div style="margin-top:10px"><div class="field-label">Transportadora</div><div class="field-value">${frete.transportadora}</div></div>` : ""}
</div>
`}

${frete.observacoes ? `
<div class="section">
  <div class="section-title">Observações</div>
  <p style="font-size:11px;line-height:1.5">${frete.observacoes}</p>
</div>` : ""}

<div class="footer">
  <span>Seibt Máquinas e Equipamentos Ltda</span>
  <span>Gerado em ${formatDate(new Date().toISOString())}</span>
  <span>${titulo}</span>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

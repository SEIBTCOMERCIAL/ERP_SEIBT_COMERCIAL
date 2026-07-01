import { createClient } from "@/lib/supabase/server";
import { BarChart3, TrendingUp, FileText, Package, DollarSign } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

export default async function RelatoriosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1).toISOString();

  const { data: propostas } = await supabase
    .from("propostas")
    .select("id, status, tipo, valor_total, moeda, criado_em, fechada_em, responsavel:responsavel_id(nome), cliente:cliente_id(razao_social, estado)")
    .is("deleted_at", null)
    .gte("criado_em", inicioAno)
    .order("criado_em", { ascending: false });

  const all = propostas ?? [];

  const totalPipeline = all
    .filter((p: { status: string }) => !["vendida", "perdida", "desistencia"].includes(p.status))
    .reduce((a: number, p: { valor_total: number | null }) => a + (p.valor_total ?? 0), 0);
  const totalVendidoAno = all
    .filter((p: { status: string }) => p.status === "vendida")
    .reduce((a: number, p: { valor_total: number | null }) => a + (p.valor_total ?? 0), 0);
  const totalVendidoMes = all
    .filter((p: { status: string; fechada_em: string | null }) => p.status === "vendida" && p.fechada_em && p.fechada_em >= inicioMes)
    .reduce((a: number, p: { valor_total: number | null }) => a + (p.valor_total ?? 0), 0);
  const taxaConversao = all.length > 0
    ? Math.round((all.filter((p: { status: string }) => p.status === "vendida").length / all.length) * 100)
    : 0;

  // Propostas por status
  const byStatus: Record<string, { qtd: number; valor: number }> = {};
  all.forEach((p: { status: string; valor_total: number | null }) => {
    if (!byStatus[p.status]) byStatus[p.status] = { qtd: 0, valor: 0 };
    byStatus[p.status].qtd++;
    byStatus[p.status].valor += p.valor_total ?? 0;
  });

  // Propostas por tipo
  const byTipo: Record<string, { qtd: number; valor: number }> = {};
  all.forEach((p: { tipo: string; valor_total: number | null }) => {
    if (!byTipo[p.tipo]) byTipo[p.tipo] = { qtd: 0, valor: 0 };
    byTipo[p.tipo].qtd++;
    byTipo[p.tipo].valor += p.valor_total ?? 0;
  });

  // Vendedores ranking
  const byVendedor: Record<string, { nome: string; vendidas: number; valor: number }> = {};
  all
    .filter((p: { status: string }) => p.status === "vendida")
    .forEach((p: { responsavel: { nome: string } | null; valor_total: number | null }) => {
      const nome = p.responsavel?.nome ?? "Desconhecido";
      if (!byVendedor[nome]) byVendedor[nome] = { nome, vendidas: 0, valor: 0 };
      byVendedor[nome].vendidas++;
      byVendedor[nome].valor += p.valor_total ?? 0;
    });

  const rankVendedor = Object.values(byVendedor).sort((a, b) => b.valor - a.valor);

  // Por estado
  const byEstado: Record<string, number> = {};
  all
    .filter((p: { status: string }) => p.status === "vendida")
    .forEach((p: { cliente: { estado: string | null } | null }) => {
      const est = p.cliente?.estado ?? "N/D";
      byEstado[est] = (byEstado[est] ?? 0) + 1;
    });
  const rankEstado = Object.entries(byEstado).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const STATUS_LABEL: Record<string, string> = {
    rascunho: "Rascunho", elaboracao: "Em Elaboração", enviada: "Enviada",
    em_negociacao: "Em Negociação", vendida: "Vendida", perdida: "Perdida",
    desistencia: "Desistência", stand_by: "Stand-by", aguardando_precificacao: "Ag. Precificação",
  };

  const TIPO_LABEL: Record<string, string> = {
    maquina: "Máquina", pecas: "Peças", exportacao: "Exportação",
    sistema: "Sistema", servico: "Serviço", mista: "Mista",
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart3 size={24} color={NAV} /> Relatórios {hoje.getFullYear()}
        </h1>
        <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>Visão consolidada do desempenho comercial.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Pipeline Aberto", value: formatCurrency(totalPipeline), Icon: DollarSign, color: BLUE, bg: "#dbeafe" },
          { label: "Vendido (ano)", value: formatCurrency(totalVendidoAno), Icon: TrendingUp, color: "#16a34a", bg: "#dcfce7" },
          { label: "Vendido (mês)", value: formatCurrency(totalVendidoMes), Icon: FileText, color: "#d97706", bg: "#fef3c7" },
          { label: "Taxa de Conversão", value: `${taxaConversao}%`, Icon: Package, color: "#7c3aed", bg: "#f5f3ff" },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={22} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>{value}</div>
              <div style={{ fontSize: 12, color: "#6b7b8d" }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Por Status */}
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 14 }}>Propostas por Status</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Status", "Qtd", "Volume"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", fontSize: 10, color: "#6b7b8d", textTransform: "uppercase" as const, textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byStatus).sort((a, b) => b[1].valor - a[1].valor).map(([status, data]) => (
                <tr key={status} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "8px 10px", fontSize: 12 }}>{STATUS_LABEL[status] ?? status}</td>
                  <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600 }}>{data.qtd}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12 }}>{formatCurrency(data.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Por Tipo */}
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 14 }}>Propostas por Tipo</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Tipo", "Qtd", "Volume"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", fontSize: 10, color: "#6b7b8d", textTransform: "uppercase" as const, textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byTipo).sort((a, b) => b[1].valor - a[1].valor).map(([tipo, data]) => (
                <tr key={tipo} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "8px 10px", fontSize: 12 }}>{TIPO_LABEL[tipo] ?? tipo}</td>
                  <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600 }}>{data.qtd}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12 }}>{formatCurrency(data.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Ranking vendedores */}
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 14 }}>Ranking de Vendedores (vendas)</div>
          {rankVendedor.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 12 }}>Sem vendas no período.</div>
          ) : (
            <div>
              {rankVendedor.map((v, i) => (
                <div key={v.nome} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", fontSize: 12, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: i === 0 ? "#fef3c7" : i === 1 ? "#f1f5f9" : "#fff4ed",
                    color: i === 0 ? "#92400e" : "#374151",
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{v.nome}</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{formatCurrency(v.valor)}</div>
                    <div style={{ fontSize: 11, color: "#6b7b8d" }}>{v.vendidas} venda(s)</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, textAlign: "right" }}>
            <Link href="/metas" style={{ fontSize: 12, color: BLUE, textDecoration: "none", fontWeight: 600 }}>Ver metas completas →</Link>
          </div>
        </div>

        {/* Por Estado */}
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 14 }}>Distribuição por Estado</div>
          {rankEstado.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 12 }}>Sem dados no período.</div>
          ) : (
            rankEstado.map(([estado, qtd]) => {
              const maxQtd = rankEstado[0]?.[1] ?? 1;
              return (
                <div key={estado} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>{estado}</span>
                    <span style={{ color: "#6b7b8d" }}>{qtd} venda(s)</span>
                  </div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(qtd / maxQtd) * 100}%`, background: BLUE, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

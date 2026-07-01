"use client";

import {
  TrendingUp, DollarSign, ShoppingCart, Target, BarChart2, Calendar,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

interface KpiData {
  pipeline: number;
  vendidas: number;
  meta_pct: number;
  conversao_pct: number;
}

interface FunilRow {
  etapa: string;
  qtd: number;
  valor: number;
}

interface TeamRow {
  nome: string;
  propostas: number;
  valor: number;
  meta_pct: number;
}

interface Alerta {
  tipo: "danger" | "warning" | "info";
  texto: string;
  link?: string;
}

interface Props {
  kpis: KpiData;
  funil: FunilRow[];
  equipe: TeamRow[];
  alertas: Alerta[];
}

const DOT_COLORS = { danger: "#dc2626", warning: "#d97706", info: "#2074B9" };

export function DashboardAdmin({ kpis, funil, equipe, alertas }: Props) {
  const kpiCards = [
    { label: "Pipeline Total", value: formatCurrency(kpis.pipeline), Icon: DollarSign, color: BLUE, bg: "#dbeafe", trend: "+12%" },
    { label: "Vendidas (mês)", value: formatCurrency(kpis.vendidas), Icon: ShoppingCart, color: "#16a34a", bg: "#dcfce7", trend: "+8%" },
    { label: "Meta do Mês", value: `${kpis.meta_pct}%`, Icon: Target, color: kpis.meta_pct >= 80 ? "#16a34a" : kpis.meta_pct >= 50 ? "#d97706" : "#dc2626", bg: kpis.meta_pct >= 80 ? "#dcfce7" : kpis.meta_pct >= 50 ? "#fef3c7" : "#fee2e2", trend: null },
    { label: "Conversão", value: `${kpis.conversao_pct}%`, Icon: BarChart2, color: "#7c3aed", bg: "#f5f3ff", trend: null },
  ];

  const maxFunil = Math.max(...funil.map((r) => r.valor), 1);

  return (
    <div style={{ background: BG, minHeight: "calc(100vh - 56px)", padding: 24 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        {kpiCards.map(({ label, value, Icon, color, bg, trend }) => (
          <div key={label} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={color} />
              </div>
              {trend && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: "#16a34a" }}>
                  <TrendingUp size={12} />
                  {trend}
                </div>
              )}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a", marginTop: 10, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: 16 }}>
        {/* Funil */}
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: NAV, marginBottom: 16 }}>Funil de Propostas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {funil.map((row) => (
              <div key={row.etapa}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#374151" }}>{row.etapa}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{row.qtd}</span>
                    <span style={{ fontSize: 11, color: "#6b7b8d", marginLeft: 6 }}>{formatCurrency(row.valor)}</span>
                  </div>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(row.valor / maxFunil) * 100}%`, background: NAV, borderRadius: 3, transition: "width 0.4s" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance equipe */}
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: NAV, marginBottom: 16 }}>Performance da Equipe</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Vendedor", "Propostas", "Volume", "Meta"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipe.map((v) => (
                <tr key={v.nome} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "10px 8px", fontSize: 13, fontWeight: 600 }}>{v.nome}</td>
                  <td style={{ padding: "10px 8px", fontSize: 13, textAlign: "right" }}>{v.propostas}</td>
                  <td style={{ padding: "10px 8px", fontSize: 12, textAlign: "right" }}>{formatCurrency(v.valor)}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                      background: v.meta_pct >= 80 ? "#dcfce7" : v.meta_pct >= 50 ? "#fef3c7" : "#fee2e2",
                      color: v.meta_pct >= 80 ? "#15803d" : v.meta_pct >= 50 ? "#92400e" : "#dc2626",
                    }}>
                      {v.meta_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <Link href="/metas" style={{ fontSize: 12, color: BLUE, textDecoration: "none", fontWeight: 600 }}>
              Ver todas as metas →
            </Link>
          </div>
        </div>

        {/* Alertas */}
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: NAV, marginBottom: 16 }}>Alertas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alertas.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 12px", borderRadius: 8, background: BG,
                border: `1px solid ${BORDER}`,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: DOT_COLORS[a.tipo], marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{a.texto}</div>
                  {a.link && (
                    <Link href={a.link} style={{ fontSize: 11, color: BLUE, textDecoration: "none", fontWeight: 600, marginTop: 2, display: "inline-block" }}>
                      Ver →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardVendedor({
  propostas,
  meta,
  followups,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  propostas: any[];
  meta: { realizado: number; total: number } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  followups: any[];
}) {
  const metaPct = meta ? Math.round((meta.realizado / meta.total) * 100) : 0;

  const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
    rascunho: { bg: "#f1f5f9", color: "#6b7b8d" },
    elaboracao: { bg: "#dbeafe", color: "#1d4ed8" },
    enviada: { bg: "#fef3c7", color: "#92400e" },
    em_negociacao: { bg: "#f5f3ff", color: "#6d28d9" },
    vendida: { bg: "#dcfce7", color: "#15803d" },
    perdida: { bg: "#fee2e2", color: "#dc2626" },
    stand_by: { bg: "#f1f5f9", color: "#374151" },
  };

  return (
    <div style={{ background: BG, minHeight: "calc(100vh - 56px)", padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* Minhas propostas */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: NAV, marginBottom: 16 }}>Minhas Propostas</div>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: BG }}>
                  {["Nº", "Cliente", "Valor", "Status", "Atualizado"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propostas.slice(0, 10).map((p) => {
                  const sc = STATUS_COLOR[p.status] ?? { bg: "#f1f5f9", color: "#6b7b8d" };
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: "10px 14px" }}>
                        <Link href={`/propostas/${p.id}`} style={{ fontFamily: "monospace", fontSize: 12, color: BLUE, textDecoration: "none", fontWeight: 600 }}>{p.numero_completo}</Link>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>{p.cliente?.razao_social ?? "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>{p.valor_total ? formatCurrency(p.valor_total) : "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{p.status}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "#6b7b8d" }}>{new Date(p.atualizado_em).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar direita */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Minha meta */}
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 12 }}>Minha Meta — Junho</div>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: metaPct >= 80 ? "#16a34a" : metaPct >= 50 ? "#d97706" : "#dc2626" }}>{metaPct}%</div>
              <div style={{ fontSize: 12, color: "#6b7b8d" }}>da meta atingida</div>
            </div>
            <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ height: "100%", width: `${Math.min(metaPct, 100)}%`, background: metaPct >= 80 ? "#16a34a" : metaPct >= 50 ? "#d97706" : "#dc2626", borderRadius: 4 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#6b7b8d" }}>Realizado: {meta ? formatCurrency(meta.realizado) : "—"}</span>
              <span style={{ color: "#6b7b8d" }}>Meta: {meta ? formatCurrency(meta.total) : "—"}</span>
            </div>
          </div>

          {/* Agenda */}
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={16} color={NAV} /> Agenda
            </div>
            {followups.length === 0 && (
              <div style={{ fontSize: 13, color: "#6b7b8d", textAlign: "center", padding: "8px 0" }}>Nenhum follow-up agendado.</div>
            )}
            {followups.slice(0, 5).map((f) => (
              <div key={f.id} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: BLUE, marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{f.proposta?.numero_completo ?? "—"}</div>
                  <div style={{ fontSize: 11, color: "#6b7b8d" }}>{f.proxima_acao_tipo} · {f.proxima_acao_data ? new Date(f.proxima_acao_data).toLocaleDateString("pt-BR") : "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

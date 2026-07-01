import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, MapPin, Phone, Mail } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

export default async function RepresentanteDetailPage({ params }: { params: { id: string } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const [{ data: rep }, { data: regioes }, { data: propostas }] = await Promise.all([
    supabase.from("representantes").select("*").eq("id", params.id).single(),
    supabase.from("regioes_representante").select("*").eq("representante_id", params.id),
    supabase
      .from("propostas")
      .select("id, numero_completo, status, tipo, valor_total, criado_em, atualizado_em, cliente:cliente_id(razao_social)")
      .eq("representante_id", params.id)
      .is("deleted_at", null)
      .order("criado_em", { ascending: false })
      .limit(20),
  ]);

  if (!rep) notFound();

  const estados = (regioes ?? []).map((r: { estado: string | null }) => r.estado).filter(Boolean) as string[];

  const propAll = propostas ?? [];
  const vendidas = propAll.filter((p: { status: string }) => p.status === "vendida");
  const totalVendido = vendidas.reduce((a: number, p: { valor_total: number | null }) => a + (p.valor_total ?? 0), 0);

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
    <div style={{ background: BG, minHeight: "100vh", padding: 24 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7b8d", marginBottom: 20 }}>
        <Link href="/representantes" style={{ color: BLUE, textDecoration: "none" }}>Representantes</Link>
        <ChevronRight size={14} />
        <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{rep.nome}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Sidebar info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: NAV, marginBottom: 10 }}>
                {rep.nome.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>{rep.nome}</div>
              {rep.empresa && <div style={{ fontSize: 13, color: "#6b7b8d" }}>{rep.empresa}</div>}
              <span style={{ marginTop: 8, padding: "3px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: rep.ativo ? "#dcfce7" : "#fee2e2", color: rep.ativo ? "#15803d" : "#dc2626" }}>
                {rep.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rep.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                  <Mail size={14} color="#6b7b8d" />
                  <a href={`mailto:${rep.email}`} style={{ color: BLUE, textDecoration: "none" }}>{rep.email}</a>
                </div>
              )}
              {rep.telefone && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                  <Phone size={14} color="#6b7b8d" />
                  {rep.telefone}
                </div>
              )}
              {estados.length > 0 && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                  <MapPin size={14} color="#6b7b8d" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                    {estados.map((e) => (
                      <span key={e} style={{ padding: "2px 8px", background: "#eff6ff", color: BLUE, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 12 }}>Desempenho</div>
            {[
              { label: "Total vendido", value: formatCurrency(totalVendido) },
              { label: "Propostas abertas", value: String(propAll.filter((p: { status: string }) => !["vendida", "perdida", "desistencia"].includes(p.status)).length) },
              { label: "Propostas totais", value: String(propAll.length) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
                <span style={{ color: "#6b7b8d" }}>{label}</span>
                <span style={{ fontWeight: 700, color: "#1a1a1a" }}>{value}</span>
              </div>
            ))}
          </div>

          {rep.observacoes && (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: NAV, marginBottom: 8 }}>Observações</div>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{rep.observacoes}</p>
            </div>
          )}
        </div>

        {/* Propostas */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: NAV, marginBottom: 14 }}>Propostas vinculadas ({propAll.length})</div>
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: BG }}>
                  {["Nº", "Cliente", "Tipo", "Valor", "Status", "Data"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propAll.map((p: {
                  id: string;
                  numero_completo: string;
                  status: string;
                  tipo: string;
                  valor_total: number | null;
                  criado_em: string;
                  cliente: { razao_social: string } | null;
                }) => {
                  const sc = STATUS_COLOR[p.status] ?? { bg: "#f1f5f9", color: "#6b7b8d" };
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: "10px 14px" }}>
                        <Link href={`/propostas/${p.id}`} style={{ fontFamily: "monospace", fontSize: 12, color: BLUE, textDecoration: "none", fontWeight: 600 }}>{p.numero_completo}</Link>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>{p.cliente?.razao_social ?? "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7b8d" }}>{p.tipo}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>{p.valor_total ? formatCurrency(p.valor_total) : "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{p.status}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "#6b7b8d" }}>{formatDate(p.criado_em)}</td>
                    </tr>
                  );
                })}
                {propAll.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Nenhuma proposta vinculada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { Clock, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { PrecificacaoFila } from "@/components/propostas/PrecificacaoFila";

export const dynamic = "force-dynamic";

const NAV = "#2C4F79";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

export default async function PrecificacaoPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: solicitacoes } = await supabase
    .from("solicitacoes_precificacao")
    .select(`
      *,
      proposta:proposta_id(numero_completo, cliente_id, responsavel_id, responsavel:responsavel_id(nome)),
      solicitante:solicitante_id(nome)
    `)
    .order("criado_em", { ascending: false });

  const all = solicitacoes ?? [];
  const pendentes = all.filter((s: { status: string }) => s.status === "pendente");
  const em_analise = all.filter((s: { status: string }) => s.status === "em_analise");
  const respondidas = all.filter((s: { status: string }) => s.status === "respondida");

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Fila de Precificação</h1>
        <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>Solicitações de preço aguardando análise da engenharia.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Pendentes", value: pendentes.length, Icon: AlertCircle, color: "#dc2626", bg: "#fee2e2" },
          { label: "Em Análise", value: em_analise.length, Icon: Clock, color: "#d97706", bg: "#fef3c7" },
          { label: "Respondidas (hoje)", value: respondidas.filter((s: { respondido_em: string }) => s.respondido_em?.startsWith(new Date().toISOString().slice(0, 10))).length, Icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4" },
          { label: "Urgentes", value: all.filter((s: { urgente: boolean; status: string }) => s.urgente && s.status !== "respondida").length, Icon: Zap, color: "#7c3aed", bg: "#f5f3ff" },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a" }}>{value}</div>
              <div style={{ fontSize: 12, color: "#6b7b8d" }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <PrecificacaoFila solicitacoes={all} />
    </div>
  );
}

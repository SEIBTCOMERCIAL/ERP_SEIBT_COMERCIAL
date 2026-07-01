import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

export default async function RepresentantesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

  const [{ data: representantes }, { data: regioes }, { data: propostas }] = await Promise.all([
    supabase
      .from("representantes")
      .select("id, nome, tipo, empresa, telefone, email, ativo, observacoes")
      .order("nome"),
    supabase
      .from("regioes_representante")
      .select("representante_id, estado, pais"),
    supabase
      .from("propostas")
      .select("id, representante_id, status, valor_total, criado_em, cliente_id")
      .is("deleted_at", null)
      .gte("criado_em", inicioMes),
  ]);

  const reps = representantes ?? [];
  const regsAll = regioes ?? [];
  const propostasAll = propostas ?? [];

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Representantes</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>{reps.length} representante(s) cadastrado(s).</p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <UserPlus size={16} /> Novo Representante
        </button>
      </div>

      {reps.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: "#6b7b8d" }}>
          Nenhum representante cadastrado.
        </div>
      )}

      {/* Grid de cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {reps.map((rep: {
          id: string;
          nome: string;
          tipo: string;
          empresa: string | null;
          telefone: string | null;
          email: string | null;
          ativo: boolean;
          observacoes: string | null;
        }) => {
          const regsRep = regsAll.filter((r: { representante_id: string }) => r.representante_id === rep.id);
          const estados = regsRep
            .map((r: { estado: string | null }) => r.estado)
            .filter(Boolean)
            .slice(0, 6) as string[];
          const propRep = propostasAll.filter((p: { representante_id: string }) => p.representante_id === rep.id);
          const realizado = propRep
            .filter((p: { status: string }) => p.status === "vendida")
            .reduce((a: number, p: { valor_total: number | null }) => a + (p.valor_total ?? 0), 0);

          return (
            <div key={rep.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Header card */}
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: NAV }}>
                        {rep.nome.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{rep.nome}</div>
                        {rep.empresa && <div style={{ fontSize: 12, color: "#6b7b8d" }}>{rep.empresa}</div>}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                    background: rep.ativo ? "#dcfce7" : "#fee2e2",
                    color: rep.ativo ? "#15803d" : "#dc2626",
                  }}>
                    {rep.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                {[
                  { label: "Realiz. mês", value: formatCurrency(realizado) },
                  { label: "Propostas", value: String(propRep.length) },
                  { label: "Clientes", value: String(new Set(propRep.map((p: { cliente_id: string | null }) => p.cliente_id).filter(Boolean)).size) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: "center", padding: "8px 4px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{value}</div>
                    <div style={{ fontSize: 11, color: "#6b7b8d" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Estados */}
              {estados.length > 0 && (
                <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Estados cobertos</div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                    {estados.map((e) => (
                      <span key={e} style={{ padding: "2px 8px", background: "#eff6ff", color: BLUE, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {rep.email && (
                    <div style={{ fontSize: 12, color: "#374151" }}>
                      <span style={{ color: "#6b7b8d" }}>E-mail: </span>{rep.email}
                    </div>
                  )}
                  {rep.telefone && (
                    <div style={{ fontSize: 12, color: "#374151" }}>
                      <span style={{ color: "#6b7b8d" }}>Tel: </span>{rep.telefone}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 18px", display: "flex", gap: 8 }}>
                <Link
                  href={`/representantes/${rep.id}`}
                  style={{ flex: 1, textAlign: "center", padding: "8px", background: NAV, color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                >
                  Ver detalhes
                </Link>
                <button style={{ padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer", color: "#374151" }}>
                  Editar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

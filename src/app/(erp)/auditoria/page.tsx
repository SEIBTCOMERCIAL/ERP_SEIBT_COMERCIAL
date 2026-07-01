import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AuditLog {
  id: string;
  usuario_nome: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  entidade_referencia: string | null;
  dados: Record<string, unknown> | null;
  criado_em: string;
}

const NAV = "#2C4F79";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

const ACAO_LABELS: Record<string, string> = {
  criar_usuario: "Criar usuário",
  editar_usuario: "Editar usuário",
  ativar_usuario: "Ativar usuário",
  desativar_usuario: "Desativar usuário",
  redefinir_senha: "Redefinir senha",
  atualizar_cambio: "Atualizar câmbio",
  criar_proposta: "Criar proposta",
  editar_proposta: "Editar proposta",
  arquivar_proposta: "Arquivar proposta",
  criar_cliente: "Criar cliente",
  editar_cliente: "Editar cliente",
};

function acaoLabel(acao: string) {
  return ACAO_LABELS[acao] ?? acao.replace(/_/g, " ");
}

function acaoCor(acao: string) {
  if (acao.startsWith("criar") || acao.startsWith("ativar")) return { bg: "#dcfce7", color: "#15803d" };
  if (acao.startsWith("deletar") || acao.startsWith("desativar") || acao.startsWith("arquivar")) return { bg: "#fee2e2", color: "#dc2626" };
  if (acao.startsWith("editar") || acao.startsWith("atualizar") || acao.startsWith("redefinir")) return { bg: "#fef3c7", color: "#d97706" };
  return { bg: "#f3f4f6", color: "#6b7b8d" };
}

export default async function AuditoriaPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("perfil, pode_configurar")
    .eq("id", user?.id ?? "")
    .single();

  if (!perfil || (perfil.perfil !== "admin" && !perfil.pode_configurar)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7b8d", fontSize: 14 }}>
        Acesso restrito a administradores.
      </div>
    );
  }

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, usuario_nome, acao, entidade, entidade_id, entidade_referencia, dados, criado_em")
    .order("criado_em", { ascending: false })
    .limit(200);

  const rows: AuditLog[] = logs ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Auditoria</h1>
        <p style={{ fontSize: 13, color: "#6b7b8d", marginTop: 4 }}>
          {rows.length} registro{rows.length !== 1 ? "s" : ""} · Últimas 200 ações
        </p>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
              {["Data/Hora", "Usuário", "Ação", "Entidade", "Referência"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((log, i) => {
              const cor = acaoCor(log.acao);
              return (
                <tr key={log.id} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7b8d", whiteSpace: "nowrap" as const }}>
                    {new Date(log.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                    {" "}
                    <span style={{ color: "#9ca3af" }}>
                      {new Date(log.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>
                    {log.usuario_nome ?? <span style={{ color: "#9ca3af" }}>Sistema</span>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: cor.bg, color: cor.color }}>
                      {acaoLabel(log.acao)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7b8d" }}>
                    {log.entidade}
                    {log.entidade_id && <span style={{ color: "#9ca3af" }}> · {log.entidade_id.slice(0, 8)}</span>}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151", maxWidth: 280 }}>
                    {log.entidade_referencia ?? <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                  Nenhum log registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

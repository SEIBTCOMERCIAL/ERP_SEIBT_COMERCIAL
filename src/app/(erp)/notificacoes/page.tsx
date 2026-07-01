import { createClient } from "@/lib/supabase/server";
import { marcarTodasLidas } from "@/app/actions/notificacoes";

export const dynamic = "force-dynamic";

const NAV = "#2C4F79";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

const TIPO_LABELS: Record<string, string> = {
  proposta: "Proposta",
  lead: "Lead",
  sistema: "Sistema",
  meta: "Meta",
  frete: "Frete",
};

export default async function NotificacoesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  const { data: notificacoes } = await supabase
    .from("notificacoes")
    .select("id, tipo, titulo, corpo, lida, entidade, entidade_id, link, criado_em")
    .eq("usuario_id", user?.id ?? "")
    .order("criado_em", { ascending: false })
    .limit(100);

  const rows = notificacoes ?? [];
  const naoLidas = rows.filter((n: { lida: boolean }) => !n.lida).length;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Notificações</h1>
          <p style={{ fontSize: 13, color: "#6b7b8d", marginTop: 4 }}>
            {naoLidas > 0 ? `${naoLidas} não lida${naoLidas !== 1 ? "s" : ""}` : "Tudo lido"} · {rows.length} total
          </p>
        </div>
        {naoLidas > 0 && (
          <form action={marcarTodasLidas}>
            <button
              type="submit"
              style={{ padding: "8px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Marcar todas como lidas
            </button>
          </form>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((n: {
          id: string;
          tipo: string;
          titulo: string;
          corpo: string | null;
          lida: boolean;
          link: string | null;
          criado_em: string;
        }) => (
          <div
            key={n.id}
            style={{
              background: n.lida ? "#fff" : "#f0f7ff",
              border: `1px solid ${n.lida ? BORDER : "#bfdbfe"}`,
              borderRadius: 10,
              padding: "16px 20px",
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.lida ? "#d1d5db" : "#2074B9", marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: n.lida ? 500 : 700, color: "#1a1a1a" }}>{n.titulo}</span>
                {n.tipo && (
                  <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: BG, border: `1px solid ${BORDER}`, color: "#6b7b8d" }}>
                    {TIPO_LABELS[n.tipo] ?? n.tipo}
                  </span>
                )}
              </div>
              {n.corpo && <div style={{ fontSize: 13, color: "#6b7b8d", marginBottom: 6 }}>{n.corpo}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  {new Date(n.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {n.link && (
                  <a href={n.link} style={{ fontSize: 12, color: "#2074B9", fontWeight: 600, textDecoration: "none" }}>
                    Ver →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", fontSize: 14, color: "#9ca3af" }}>
            Nenhuma notificação recebida.
          </div>
        )}
      </div>
    </div>
  );
}

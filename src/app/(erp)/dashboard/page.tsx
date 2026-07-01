import { createClient } from "@/lib/supabase/server";
import { DashboardAdmin, DashboardVendedor } from "@/components/dashboard/DashboardAdmin";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: meUsuario } = await supabase
    .from("usuarios")
    .select("perfil, nome")
    .eq("id", user?.id)
    .single();

  const perfil = meUsuario?.perfil ?? "vendedor_interno";

  if (perfil === "admin") {
    const hoje = new Date();
    const [
      { data: propostas },
      { data: vendedores },
      { data: solicitacoesPendentes },
      { data: metas },
    ] = await Promise.all([
      supabase
        .from("propostas")
        .select("id, status, valor_total, responsavel_id, atualizado_em")
        .is("deleted_at", null),
      supabase
        .from("usuarios")
        .select("id, nome")
        .eq("perfil", "vendedor_interno")
        .eq("ativo", true),
      supabase
        .from("solicitacoes_precificacao")
        .select("id")
        .in("status", ["pendente", "em_analise"]),
      supabase
        .from("metas")
        .select("*")
        .eq("mes", hoje.getMonth() + 1)
        .eq("ano", hoje.getFullYear()),
    ]);

    const all = propostas ?? [];
    const pipeline = all
      .filter((p: { status: string }) => !["vendida", "perdida", "desistencia"].includes(p.status))
      .reduce((a: number, p: { valor_total: number | null }) => a + (p.valor_total ?? 0), 0);
    const vendidas = all
      .filter((p: { status: string }) => p.status === "vendida")
      .reduce((a: number, p: { valor_total: number | null }) => a + (p.valor_total ?? 0), 0);
    const totalPropostas = all.length;
    const vendidasCount = all.filter((p: { status: string }) => p.status === "vendida").length;
    const conversao = totalPropostas > 0 ? Math.round((vendidasCount / totalPropostas) * 100) : 0;
    const metaTotal = (metas ?? []).reduce((a: number, m: { meta_total_brl: number }) => a + m.meta_total_brl, 0);
    const realizadoTotal = (metas ?? []).reduce((a: number, m: { realizado_brl: number }) => a + m.realizado_brl, 0);
    const metaPct = metaTotal > 0 ? Math.round((realizadoTotal / metaTotal) * 100) : 0;

    const byStatus = (status: string) => all.filter((p: { status: string }) => p.status === status);
    const sumVal = (arr: { valor_total: number | null }[]) => arr.reduce((a, p) => a + (p.valor_total ?? 0), 0);

    const funil = [
      { etapa: "Em Elaboração", qtd: byStatus("elaboracao").length, valor: sumVal(byStatus("elaboracao")) },
      { etapa: "Enviadas", qtd: byStatus("enviada").length, valor: sumVal(byStatus("enviada")) },
      { etapa: "Em Negociação", qtd: byStatus("em_negociacao").length, valor: sumVal(byStatus("em_negociacao")) },
      { etapa: "Ag. Precificação", qtd: byStatus("aguardando_precificacao").length, valor: sumVal(byStatus("aguardando_precificacao")) },
      { etapa: "Stand-by", qtd: byStatus("stand_by").length, valor: sumVal(byStatus("stand_by")) },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const equipe = (vendedores ?? []).map((v: any) => {
      const minhas = all.filter((p: { responsavel_id: string }) => p.responsavel_id === v.id);
      const vol = sumVal(minhas);
      const meta = (metas ?? []).find((m: { usuario_id: string }) => m.usuario_id === v.id);
      const metaPctV = meta && meta.meta_total_brl > 0 ? Math.round((meta.realizado_brl / meta.meta_total_brl) * 100) : 0;
      return { nome: v.nome, propostas: minhas.length, valor: vol, meta_pct: metaPctV };
    });

    const semResposta = byStatus("enviada").filter(
      (p: { atualizado_em: string }) => new Date().getTime() - new Date(p.atualizado_em).getTime() > 7 * 86400000
    ).length;

    const alertas = [
      ...(semResposta > 0 ? [{ tipo: "danger" as const, texto: `${semResposta} proposta(s) enviada sem resposta há mais de 7 dias`, link: "/propostas" }] : []),
      ...((solicitacoesPendentes ?? []).length > 0 ? [{ tipo: "warning" as const, texto: `${(solicitacoesPendentes ?? []).length} solicitação(ões) de precificação pendente`, link: "/precificacao" }] : []),
      ...(metaPct < 50 ? [{ tipo: "warning" as const, texto: `Equipe em ${metaPct}% da meta — ritmo abaixo do esperado`, link: "/metas" }] : []),
      ...(metaPct >= 80 ? [{ tipo: "info" as const, texto: `Parabéns! A equipe já atingiu ${metaPct}% da meta do mês.`, link: "/metas" }] : []),
    ];

    return (
      <DashboardAdmin
        kpis={{ pipeline, vendidas, meta_pct: metaPct, conversao_pct: conversao }}
        funil={funil}
        equipe={equipe}
        alertas={alertas}
      />
    );
  }

  // Vendedor / Representante
  const hoje = new Date();
  const [{ data: minhasPropostas }, { data: metaData }, { data: followupsData }] = await Promise.all([
    supabase
      .from("propostas")
      .select("id, numero_completo, status, valor_total, atualizado_em, cliente:cliente_id(razao_social)")
      .eq("responsavel_id", user?.id)
      .is("deleted_at", null)
      .order("atualizado_em", { ascending: false })
      .limit(20),
    supabase
      .from("metas")
      .select("meta_total_brl, realizado_brl")
      .eq("usuario_id", user?.id)
      .eq("mes", hoje.getMonth() + 1)
      .eq("ano", hoje.getFullYear())
      .single(),
    supabase
      .from("followups")
      .select("id, proxima_acao_data, proxima_acao_tipo, proposta:proposta_id(numero_completo)")
      .eq("usuario_id", user?.id)
      .not("proxima_acao_data", "is", null)
      .order("proxima_acao_data")
      .limit(5),
  ]);

  return (
    <DashboardVendedor
      propostas={minhasPropostas ?? []}
      meta={metaData ? { realizado: metaData.realizado_brl, total: metaData.meta_total_brl } : null}
      followups={followupsData ?? []}
    />
  );
}

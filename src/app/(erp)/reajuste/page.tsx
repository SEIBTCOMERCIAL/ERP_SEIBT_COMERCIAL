import { createClient } from "@/lib/supabase/server";
import { ReajusteMain } from "@/components/reajuste/ReajusteMain";

export const dynamic = "force-dynamic";

export default async function ReajustePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();

  if (userRecord?.perfil !== "admin") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7b8d", fontSize: 14 }}>
        Acesso restrito a administradores.
      </div>
    );
  }

  const [
    { data: linhasRaw },
    { data: equipRaw },
    { data: catsRaw },
    { data: pecasRaw },
    { data: taxaData },
  ] = await Promise.all([
    supabase.from("linhas").select("id, nome, ordem").order("ordem"),
    supabase
      .from("produtos")
      .select("id, codigo, descricao, linha_id, preco_brl, preco_painel_220, preco_painel_380, solicitar_engenharia, historico_precos(id, componente, preco_anterior_brl, preco_novo_brl, percentual_reajuste, motivo, data_reajuste)")
      .eq("categoria", "maquina")
      .is("deleted_at", null)
      .not("linha_id", "is", null)
      .order("codigo"),
    supabase.from("categorias_peca").select("id, nome, ordem").order("ordem"),
    supabase
      .from("produtos")
      .select("id, codigo, descricao, categoria_peca_id, preco_brl, ipi_pct, historico_precos(id, componente, preco_anterior_brl, preco_novo_brl, percentual_reajuste, motivo, data_reajuste)")
      .not("categoria_peca_id", "is", null)
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("codigo"),
    supabase
      .from("taxas_cambio")
      .select("taxa")
      .eq("moeda", "USD")
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const taxaDolar: number = taxaData?.taxa ?? 5.70;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapHist(h: any) {
    return {
      id: h.id as string,
      componente: (h.componente ?? null) as string | null,
      preco_anterior_brl: (h.preco_anterior_brl ?? null) as number | null,
      preco_novo_brl: (h.preco_novo_brl ?? null) as number | null,
      percentual_reajuste: (h.percentual_reajuste ?? null) as number | null,
      motivo: (h.motivo ?? null) as string | null,
      data_reajuste: h.data_reajuste as string,
    };
  }

  const linhas = (linhasRaw ?? []).map((l: { id: string; nome: string; ordem: number }) => ({
    ...l,
    equipamentos: (equipRaw ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e: any) => e.linha_id === l.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => ({
        id: e.id as string,
        codigo: e.codigo as string,
        descricao: e.descricao as string,
        linha_id: e.linha_id as string,
        preco_brl: (e.preco_brl ?? null) as number | null,
        preco_painel_220: (e.preco_painel_220 ?? null) as number | null,
        preco_painel_380: (e.preco_painel_380 ?? null) as number | null,
        solicitar_engenharia: (e.solicitar_engenharia ?? false) as boolean,
        historico: (e.historico_precos ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map(mapHist)
          .sort((a: { data_reajuste: string }, b: { data_reajuste: string }) =>
            b.data_reajuste.localeCompare(a.data_reajuste)
          ),
      })),
  }));

  const categorias = (catsRaw ?? []).map((c: { id: string; nome: string; ordem: number }) => ({
    ...c,
    pecas: (pecasRaw ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p.categoria_peca_id === c.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
        id: p.id as string,
        codigo: p.codigo as string,
        descricao: p.descricao as string,
        categoria_peca_id: p.categoria_peca_id as string,
        preco_brl: (p.preco_brl ?? null) as number | null,
        ipi_pct: (p.ipi_pct ?? 0) as number,
        historico: (p.historico_precos ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map(mapHist)
          .sort((a: { data_reajuste: string }, b: { data_reajuste: string }) =>
            b.data_reajuste.localeCompare(a.data_reajuste)
          ),
      })),
  }));

  return <ReajusteMain linhas={linhas} categorias={categorias} taxaDolar={taxaDolar} />;
}

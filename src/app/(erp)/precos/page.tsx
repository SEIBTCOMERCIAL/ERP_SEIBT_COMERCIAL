import { createClient } from "@/lib/supabase/server";
import { HistoricoPrecos } from "@/components/produtos/HistoricoPrecos";
import type { ProdutoComDetalhes } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PrecosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const [{ data: rawProdutos }, { data: taxaData }] = await Promise.all([
    supabase
      .from("produtos")
      .select(`
        *,
        compatibilidades_produto(id, modelo_maquina),
        historico_precos(id, data_reajuste, percentual_reajuste, preco_novo_brl, preco_anterior_brl, produto_id, variante_id, motivo, reajustado_por)
      `)
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("descricao"),

    supabase
      .from("taxas_cambio")
      .select("taxa")
      .eq("moeda", "USD")
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const taxaDolar: number = taxaData?.taxa ?? 5.70;

  const produtos: ProdutoComDetalhes[] = (rawProdutos ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => {
      const histSorted = (p.historico_precos ?? []).sort(
        (a: { data_reajuste: string }, b: { data_reajuste: string }) =>
          b.data_reajuste.localeCompare(a.data_reajuste)
      );
      const ultimo = histSorted[0] ?? null;
      return {
        ...p,
        modelos_compat: Array.from(
          new Set(
            (p.compatibilidades_produto ?? [])
              .map((c: { modelo_maquina: string | null }) => c.modelo_maquina)
              .filter(Boolean)
          )
        ) as string[],
        historico_precos: histSorted,
        ultimo_reajuste_data: ultimo?.data_reajuste ?? null,
        ultimo_reajuste_pct: ultimo?.percentual_reajuste ?? null,
      };
    }
  );

  return <HistoricoPrecos produtos={produtos} taxaDolar={taxaDolar} />;
}

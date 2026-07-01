import { createClient } from "@/lib/supabase/server";
import { NovaPropMaquinaForm } from "@/components/propostas/NovaPropMaquinaForm";
import type { ProdutoComDetalhes } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function NovaPropMaquinaPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const [{ data: rawClientes }, { data: rawProdutos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, razao_social, nome_fantasia, cidade, estado")
      .is("deleted_at", null)
      .neq("status", "inativo")
      .order("razao_social"),

    supabase
      .from("produtos")
      .select("*, compatibilidades_produto(id, modelo_maquina), historico_precos(id, data_reajuste, percentual_reajuste, preco_novo_brl, preco_anterior_brl, produto_id, variante_id, motivo, reajustado_por)")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("descricao"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapProduto = (p: any): ProdutoComDetalhes => {
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
  };

  const allProdutos: ProdutoComDetalhes[] = (rawProdutos ?? []).map(mapProduto);
  const maquinas = allProdutos.filter((p) => p.categoria === "maquina");
  const pecas = allProdutos.filter((p) => p.categoria !== "maquina");

  const clientes = (rawClientes ?? []) as Array<{
    id: string;
    razao_social: string | null;
    nome_fantasia: string | null;
    cidade: string | null;
    estado: string | null;
  }>;

  return <NovaPropMaquinaForm clientes={clientes} maquinas={maquinas} pecas={pecas} />;
}

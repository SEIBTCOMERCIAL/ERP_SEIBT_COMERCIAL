import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategoriaPecasView } from "@/components/produtos/CategoriaPecasView";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function CategoriaPage({ params }: { params: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();
  const isAdmin = userRecord?.perfil === "admin";

  const { data: categoria } = await supabase
    .from("categorias_peca")
    .select("id, nome")
    .eq("id", params.id)
    .single();

  if (!categoria) notFound();

  const { data: pecas } = await supabase
    .from("produtos")
    .select(`
      id, codigo, descricao, preco_brl, ipi_pct, ncm, ativo,
      historico_precos(data_reajuste, percentual_reajuste)
    `)
    .eq("categoria_peca_id", params.id)
    .is("deleted_at", null)
    .order("codigo");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pecasProcessadas = (pecas ?? []).map((p: any) => {
    const hist = (p.historico_precos ?? []).sort(
      (a: { data_reajuste: string }, b: { data_reajuste: string }) =>
        b.data_reajuste.localeCompare(a.data_reajuste)
    );
    return {
      ...p,
      historico_precos: undefined,
      ultimo_reajuste_data: hist[0]?.data_reajuste ?? null,
      ultimo_reajuste_pct: hist[0]?.percentual_reajuste ?? null,
    };
  });

  return (
    <CategoriaPecasView
      isAdmin={isAdmin}
      categoria={categoria}
      pecas={pecasProcessadas}
    />
  );
}

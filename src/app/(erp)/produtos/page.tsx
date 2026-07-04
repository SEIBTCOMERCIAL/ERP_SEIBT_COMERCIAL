import { createClient } from "@/lib/supabase/server";
import { ProdutosMain } from "@/components/produtos/ProdutosMain";

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();
  const isAdmin = userRecord?.perfil === "admin";

  const [{ data: linhasRaw }, { data: categoriasRaw }] = await Promise.all([
    supabase.from("linhas").select("id, nome, ordem").order("ordem"),
    supabase.from("categorias_peca").select("id, nome, ordem").order("ordem"),
  ]);

  // Count equipamentos por linha e peças por categoria
  const { data: equipCounts } = await supabase
    .from("produtos")
    .select("linha_id")
    .eq("categoria", "maquina")
    .is("deleted_at", null)
    .not("linha_id", "is", null);

  const { data: pecaCounts } = await supabase
    .from("produtos")
    .select("categoria_peca_id")
    .not("categoria_peca_id", "is", null)
    .is("deleted_at", null);

  const equipByLinha = (equipCounts ?? []).reduce((acc: Record<string, number>, p: { linha_id: string }) => {
    acc[p.linha_id] = (acc[p.linha_id] ?? 0) + 1;
    return acc;
  }, {});

  const pecasByCategoria = (pecaCounts ?? []).reduce((acc: Record<string, number>, p: { categoria_peca_id: string }) => {
    acc[p.categoria_peca_id] = (acc[p.categoria_peca_id] ?? 0) + 1;
    return acc;
  }, {});

  const linhas = (linhasRaw ?? []).map((l: { id: string; nome: string; ordem: number }) => ({
    ...l, count: equipByLinha[l.id] ?? 0,
  }));

  const categorias = (categoriasRaw ?? []).map((c: { id: string; nome: string; ordem: number }) => ({
    ...c, count: pecasByCategoria[c.id] ?? 0,
  }));

  return <ProdutosMain isAdmin={isAdmin} linhas={linhas} categorias={categorias} />;
}

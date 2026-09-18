import { createClient } from "@/lib/supabase/server";
import { CatalogoIndex } from "@/components/catalogo/CatalogoIndex";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();
  const isAdmin = userRecord?.perfil === "admin";

  const { data: linhasRaw } = await supabase
    .from("linhas").select("id, nome, ordem, grupo, grupo_ordem, modo_catalogo")
    .order("grupo_ordem").order("ordem");

  const { data: equipCounts } = await supabase
    .from("produtos")
    .select("linha_id")
    .eq("categoria", "maquina")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .not("linha_id", "is", null);

  const contagem = (equipCounts ?? []).reduce((acc: Record<string, number>, p: { linha_id: string }) => {
    acc[p.linha_id] = (acc[p.linha_id] ?? 0) + 1;
    return acc;
  }, {});

  interface LinhaRaw {
    id: string; nome: string; ordem: number; grupo: string | null; grupo_ordem: number | null;
    modo_catalogo: "completo" | "lista";
  }

  const linhas = (linhasRaw as LinhaRaw[] ?? [])
    .map((l) => ({ ...l, modoCatalogo: l.modo_catalogo, count: contagem[l.id] ?? 0 }))
    .filter((l) => l.count > 0);

  return <CatalogoIndex isAdmin={isAdmin} linhas={linhas} />;
}

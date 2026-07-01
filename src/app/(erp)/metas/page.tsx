import { createClient } from "@/lib/supabase/server";
import { MetasGrid } from "@/components/metas/MetasGrid";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const [{ data: metas }, { data: vendedores }] = await Promise.all([
    supabase
      .from("metas")
      .select("*")
      .eq("ano", anoAtual)
      .order("mes"),
    supabase
      .from("usuarios")
      .select("id, nome, perfil")
      .in("perfil", ["vendedor_interno", "representante"])
      .eq("ativo", true)
      .order("nome"),
  ]);

  return (
    <MetasGrid
      metas={metas ?? []}
      vendedores={vendedores ?? []}
      mesAtual={mesAtual}
      anoAtual={anoAtual}
    />
  );
}

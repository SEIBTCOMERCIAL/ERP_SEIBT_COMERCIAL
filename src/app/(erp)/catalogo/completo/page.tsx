import { createClient } from "@/lib/supabase/server";
import { carregarCatalogoCompleto, carregarJogosNavalhas, carregarPecasCatalogo } from "@/lib/catalogo/dados";
import { CatalogoCompletoView } from "@/components/catalogo/CatalogoCompletoView";
import { carregarReferenciaCatalogo } from "@/lib/catalogo/referencia";

export const dynamic = "force-dynamic";

export default async function CatalogoCompletoPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();
  const isAdmin = userRecord?.perfil === "admin";

  const [linhas, jogosNavalhas, { peneiras }, referencia] = await Promise.all([
    carregarCatalogoCompleto(supabase),
    carregarJogosNavalhas(supabase),
    carregarPecasCatalogo(supabase),
    carregarReferenciaCatalogo(supabase),
  ]);

  return <CatalogoCompletoView isAdmin={isAdmin} linhas={linhas} jogosNavalhas={jogosNavalhas} peneiras={peneiras} referencia={referencia} />;
}

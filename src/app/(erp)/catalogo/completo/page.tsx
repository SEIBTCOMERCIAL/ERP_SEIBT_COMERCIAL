import { createClient } from "@/lib/supabase/server";
import { carregarCatalogoCompleto, carregarJogosNavalhas, carregarPecasCatalogo } from "@/lib/catalogo/dados";
import { CatalogoCompletoView } from "@/components/catalogo/CatalogoCompletoView";

export const dynamic = "force-dynamic";

export default async function CatalogoCompletoPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();
  const isAdmin = userRecord?.perfil === "admin";

  const [linhas, jogosNavalhas, { peneiras }] = await Promise.all([
    carregarCatalogoCompleto(supabase),
    carregarJogosNavalhas(supabase),
    carregarPecasCatalogo(supabase),
  ]);

  return <CatalogoCompletoView isAdmin={isAdmin} linhas={linhas} jogosNavalhas={jogosNavalhas} peneiras={peneiras} />;
}

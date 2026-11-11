import { createClient } from "@/lib/supabase/server";
import { carregarJogosNavalhas, carregarPecasCatalogo } from "@/lib/catalogo/dados";
import { CatalogoPecasView } from "@/components/catalogo/CatalogoPecasView";
import { carregarReferenciaCatalogo } from "@/lib/catalogo/referencia";

export const dynamic = "force-dynamic";

export default async function CatalogoPecasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const [jogosNavalhas, { peneiras }, referencia] = await Promise.all([
    carregarJogosNavalhas(supabase),
    carregarPecasCatalogo(supabase),
    carregarReferenciaCatalogo(supabase),
  ]);

  return <CatalogoPecasView jogosNavalhas={jogosNavalhas} peneiras={peneiras} referencia={referencia} />;
}

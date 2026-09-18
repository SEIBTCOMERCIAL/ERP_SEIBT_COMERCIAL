import { carregarPecasCatalogo } from "@/lib/catalogo/dados";
import { CatalogoPecasView } from "@/components/catalogo/CatalogoPecasView";

export const dynamic = "force-dynamic";

export default async function CatalogoPecasPage() {
  const { navalhas, peneiras } = await carregarPecasCatalogo();

  return <CatalogoPecasView navalhas={navalhas} peneiras={peneiras} />;
}

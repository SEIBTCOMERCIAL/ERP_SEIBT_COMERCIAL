import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarCatalogoLinha } from "@/lib/catalogo/dados";
import { CatalogoLinhaView } from "@/components/catalogo/CatalogoLinhaView";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function CatalogoLinhaPage({ params }: { params: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();
  const isAdmin = userRecord?.perfil === "admin";

  const dados = await carregarCatalogoLinha(params.linhaId, supabase);
  if (!dados) notFound();

  return <CatalogoLinhaView isAdmin={isAdmin} dados={dados} />;
}

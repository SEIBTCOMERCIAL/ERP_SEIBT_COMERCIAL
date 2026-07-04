import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LinhaEquipamentosView } from "@/components/produtos/LinhaEquipamentosView";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function LinhaPage({ params }: { params: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();
  const isAdmin = userRecord?.perfil === "admin";

  const { data: linha } = await supabase
    .from("linhas")
    .select("id, nome, ordem")
    .eq("id", params.id)
    .single();

  if (!linha) notFound();

  const { data: equipamentos } = await supabase
    .from("produtos")
    .select("id, codigo, descricao, preco_brl, preco_painel_220, preco_painel_380, ncm, specs, ativo, atualizado_em")
    .eq("categoria", "maquina")
    .eq("linha_id", params.id)
    .is("deleted_at", null)
    .order("codigo");

  return (
    <LinhaEquipamentosView
      isAdmin={isAdmin}
      linha={linha}
      equipamentos={equipamentos ?? []}
    />
  );
}

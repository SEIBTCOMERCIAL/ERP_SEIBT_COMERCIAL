import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EquipamentoDetalhe } from "@/components/produtos/EquipamentoDetalhe";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function EquipamentoPage({ params }: { params: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userRecord } = await supabase
    .from("usuarios").select("perfil").eq("id", user?.id).single();
  const isAdmin = userRecord?.perfil === "admin";

  const [{ data: linha }, { data: equip }, { data: arquivos }] = await Promise.all([
    supabase.from("linhas").select("id, nome").eq("id", params.id).single(),
    supabase.from("produtos")
      .select("id, codigo, descricao, preco_brl, preco_painel_220, preco_painel_380, ncm, specs, ativo")
      .eq("id", params.eqId)
      .is("deleted_at", null)
      .single(),
    supabase.from("produto_arquivos")
      .select("id, tipo, nome, url, storage_path, ordem")
      .eq("produto_id", params.eqId)
      .order("ordem"),
  ]);

  if (!linha || !equip) notFound();

  return (
    <EquipamentoDetalhe
      isAdmin={isAdmin}
      linha={linha}
      equip={equip}
      arquivos={arquivos ?? []}
    />
  );
}

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

  const [{ data: linha }, { data: equip }, { data: arquivos }, { data: rawCampos }] = await Promise.all([
    supabase.from("linhas").select("id, nome").eq("id", params.id).single(),
    supabase.from("produtos")
      .select("id, codigo, descricao, descricao_painel, potencia_motor, preco_brl, preco_painel_220, preco_painel_380, ncm, specs, ativo, status")
      .eq("id", params.eqId)
      .is("deleted_at", null)
      .single(),
    supabase.from("produto_arquivos")
      .select("id, tipo, nome, url, storage_path, ordem")
      .eq("produto_id", params.eqId)
      .order("ordem"),
    supabase
      .from("linha_spec_campos")
      .select("id, nome, ordem")
      .eq("linha_id", params.id)
      .order("ordem"),
  ]);

  if (!linha || !equip) notFound();

  const specCampos: { id: string; nome: string; ordem: number }[] = rawCampos ?? [];

  return (
    <EquipamentoDetalhe
      isAdmin={isAdmin}
      linha={linha}
      equip={{ ...equip, status: equip.status ?? "ativo" }}
      arquivos={arquivos ?? []}
      specCampos={specCampos}
    />
  );
}

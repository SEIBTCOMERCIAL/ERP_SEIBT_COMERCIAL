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

  const [{ data: linha }, { data: rawEquip }, { data: rawCampos }] = await Promise.all([
    supabase.from("linhas").select("id, nome, ordem").eq("id", params.id).single(),
    supabase
      .from("produtos")
      .select("id, codigo, descricao, descricao_painel, potencia_motor, preco_brl, preco_painel_220, preco_painel_380, ncm, specs, ativo, status, atualizado_em, produto_arquivos(id, tipo)")
      .eq("categoria", "maquina")
      .eq("linha_id", params.id)
      .is("deleted_at", null)
      .order("codigo"),
    supabase
      .from("linha_spec_campos")
      .select("id, nome, ordem")
      .eq("linha_id", params.id)
      .order("ordem"),
  ]);

  if (!linha) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const equipamentos = (rawEquip ?? []).map((eq: any) => ({
    id: eq.id,
    codigo: eq.codigo,
    descricao: eq.descricao,
    descricao_painel: eq.descricao_painel ?? null,
    potencia_motor: eq.potencia_motor ?? null,
    preco_brl: eq.preco_brl,
    preco_painel_220: eq.preco_painel_220,
    preco_painel_380: eq.preco_painel_380,
    ncm: eq.ncm,
    specs: eq.specs,
    ativo: eq.ativo,
    status: eq.status ?? "ativo",
    atualizado_em: eq.atualizado_em,
    imagens_count: (eq.produto_arquivos ?? []).filter((a: { tipo: string }) => a.tipo === "imagem").length,
  }));

  const specCampos: { id: string; nome: string; ordem: number }[] = rawCampos ?? [];

  return (
    <LinhaEquipamentosView
      isAdmin={isAdmin}
      linha={linha}
      equipamentos={equipamentos}
      specCampos={specCampos}
    />
  );
}

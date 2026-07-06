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

  const [
    { data: linha },
    { data: equip },
    { data: arquivos },
    { data: rawCampos },
    { data: rawCategorias },
    { data: rawVinculos },
    { data: rawPecasCatalogo },
  ] = await Promise.all([
    supabase.from("linhas").select("id, nome").eq("id", params.id).single(),
    supabase.from("produtos")
      .select("id, codigo, descricao, descricao_painel, potencia_motor, preco_brl, preco_painel_220, preco_painel_380, ncm, specs, ativo, status, solicitar_engenharia")
      .eq("id", params.eqId)
      .is("deleted_at", null)
      .single(),
    supabase.from("produto_arquivos")
      .select("id, tipo, nome, url, storage_path, ordem")
      .eq("produto_id", params.eqId)
      .order("ordem"),
    supabase.from("linha_spec_campos")
      .select("id, nome, ordem")
      .eq("linha_id", params.id)
      .order("ordem"),
    supabase.from("categorias_peca")
      .select("id, nome, ordem")
      .order("ordem"),
    supabase.from("compatibilidades_equip")
      .select("id, quantidade, peca:peca_id(id, codigo, descricao, preco_brl, ipi_pct, ativo, categoria_peca_id, furo_diametro)")
      .eq("equipamento_id", params.eqId),
    supabase.from("produtos")
      .select("id, codigo, descricao, preco_brl, ipi_pct, ativo, categoria_peca_id, furo_diametro")
      .not("categoria_peca_id", "is", null)
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("codigo"),
  ]);

  if (!linha || !equip) notFound();

  const specCampos: { id: string; nome: string; ordem: number }[] = rawCampos ?? [];
  const categorias: { id: string; nome: string; ordem: number }[] = rawCategorias ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vinculos = (rawVinculos ?? []).map((v: any) => ({
    id: v.id as string,
    quantidade: (v.quantidade ?? 1) as number,
    peca: {
      id: v.peca?.id as string,
      codigo: v.peca?.codigo as string,
      descricao: v.peca?.descricao as string,
      preco_brl: v.peca?.preco_brl as number | null,
      ipi_pct: (v.peca?.ipi_pct ?? 0) as number,
      ativo: (v.peca?.ativo ?? true) as boolean,
      categoria_peca_id: v.peca?.categoria_peca_id as string,
      furo_diametro: (v.peca?.furo_diametro ?? null) as string | null,
    },
  })).filter((v: { peca: { id: string } }) => !!v.peca?.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pecasCatalogo = (rawPecasCatalogo ?? []).map((p: any) => ({
    id: p.id as string,
    codigo: p.codigo as string,
    descricao: p.descricao as string,
    preco_brl: p.preco_brl as number | null,
    ipi_pct: (p.ipi_pct ?? 0) as number,
    categoria_peca_id: p.categoria_peca_id as string,
    furo_diametro: (p.furo_diametro ?? null) as string | null,
  }));

  return (
    <EquipamentoDetalhe
      isAdmin={isAdmin}
      linha={linha}
      equip={{ ...equip, status: equip.status ?? "ativo" }}
      arquivos={arquivos ?? []}
      specCampos={specCampos}
      categorias={categorias}
      vinculos={vinculos}
      pecasCatalogo={pecasCatalogo}
    />
  );
}

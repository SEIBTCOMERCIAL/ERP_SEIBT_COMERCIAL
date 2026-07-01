import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { NovaPropostaForm } from "@/components/propostas/NovaPropostaForm";

export const metadata: Metadata = { title: "Nova Proposta" };

export default async function NovaPropostaPage({
  searchParams,
}: {
  searchParams: { cliente_id?: string };
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: clientesR }, { data: vendedoresR }, { data: representantesR }, { data: etapasR }] =
    await Promise.all([
      supabase
        .from("clientes")
        .select("id, razao_social")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .order("razao_social"),
      supabase
        .from("usuarios")
        .select("id, nome")
        .in("perfil", ["admin", "vendedor_interno", "representante"])
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("representantes")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("etapas_funil")
        .select("id, nome, cor, ordem")
        .eq("ativo", true)
        .order("ordem"),
    ]);

  const clientes       = (clientesR ?? [])       as Array<{ id: string; razao_social: string }>;
  const vendedores     = (vendedoresR ?? [])      as Array<{ id: string; nome: string }>;
  const representantes = (representantesR ?? [])  as Array<{ id: string; nome: string }>;
  const etapas         = (etapasR ?? [])          as Array<{ id: string; nome: string; cor: string; ordem: number }>;

  return (
    <NovaPropostaForm
      clientes={clientes}
      vendedores={vendedores}
      representantes={representantes}
      etapas={etapas}
      clientePreSelecionado={searchParams.cliente_id ?? null}
      usuarioId={user?.id ?? ""}
    />
  );
}

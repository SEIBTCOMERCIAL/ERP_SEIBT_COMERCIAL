import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProdutosExplorador } from "@/components/produtos/ProdutosExplorador";
import { lerFiltros } from "@/lib/produtos/regras";
import { carregarNavegacao, listarProdutos } from "@/lib/produtos/servidor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Produtos" };

export default async function ProdutosPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: usuario } = user ? await supabase.from("usuarios").select("perfil").eq("id", user.id).single() : { data: null };
  const admin = usuario?.perfil === "admin";

  let filtros = lerFiltros(searchParams);
  let nav;
  try {
    nav = await carregarNavegacao(supabase);
  } catch {
    return <div className="p-10 text-center text-sm text-muted-foreground">Não foi possível carregar os produtos. Atualize a página; se continuar, avise o responsável pelo sistema.</div>;
  }

  // Seleção que não existe mais (grupo excluído, link antigo): volta para "todos" com um aviso.
  let avisoEscopo: string | null = null;
  const existe = filtros.escopo && (filtros.aba === "maquinas" ? nav.linhas.some((l) => l.id === filtros.escopo) : nav.categorias.some((c) => c.id === filtros.escopo));
  if (filtros.escopo && !existe) {
    avisoEscopo = "A linha ou categoria selecionada não existe mais. Mostrando todos.";
    filtros = { ...filtros, escopo: null };
  }

  const resposta = await listarProdutos(supabase, filtros);
  const camposFicha = filtros.aba === "maquinas" && filtros.escopo
    ? ((await supabase.from("linha_spec_campos").select("id, nome").eq("linha_id", filtros.escopo).order("ordem")).data ?? [])
    : [];

  return <ProdutosExplorador filtros={filtros} nav={nav} resposta={resposta} admin={admin} camposFicha={camposFicha} avisoEscopo={avisoEscopo} />;
}

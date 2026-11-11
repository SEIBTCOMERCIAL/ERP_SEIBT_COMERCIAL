"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidarProdutos } from "@/lib/revalidar";

export type CatalogoActionState = { error?: string; success?: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(): Promise<{ supabase: any } | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };
  const { data: u } = await supabase.from("usuarios").select("perfil").eq("id", user.id).single();
  if (u?.perfil !== "admin") return { error: "Acesso restrito a administradores" };
  return { supabase };
}

/** Define se uma linha aparece no Catálogo completo/impresso em formato
 * completo (foto + preço + especificações) ou lista compacta. */
export async function definirModoCatalogoLinha(
  linhaId: string,
  modo: "completo" | "lista"
): Promise<CatalogoActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("linhas")
    .update({ modo_catalogo: modo })
    .eq("id", linhaId);

  if (error) return { error: error.message };
  revalidatePath("/catalogo");
  revalidatePath(`/catalogo/${linhaId}`);
  revalidatePath("/catalogo/completo");
  return { success: true };
}

/** Define qual foto já cadastrada do equipamento aparece no catálogo (precisa ser uma imagem desse equipamento). */
export async function definirFotoCapaProduto(
  produtoId: string,
  linhaId: string,
  fotoUrl: string | null
): Promise<CatalogoActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  if (fotoUrl) {
    const { count } = await auth.supabase.from("produto_arquivos")
      .select("id", { count: "exact", head: true }).eq("produto_id", produtoId).eq("tipo", "imagem").eq("url", fotoUrl);
    if (!count) return { error: "Essa imagem não pertence a este equipamento." };
  }

  const { data, error } = await auth.supabase
    .from("produtos")
    .update({ foto_url: fotoUrl })
    .eq("id", produtoId)
    .eq("linha_id", linhaId)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Equipamento não encontrado nesta linha." };
  revalidarProdutos();
  return { success: true };
}

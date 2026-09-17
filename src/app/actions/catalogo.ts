"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

/** Define qual foto já cadastrada do equipamento aparece no catálogo. */
export async function definirFotoCapaProduto(
  produtoId: string,
  linhaId: string,
  fotoUrl: string | null
): Promise<CatalogoActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("produtos")
    .update({ foto_url: fotoUrl })
    .eq("id", produtoId);

  if (error) return { error: error.message };
  revalidatePath(`/catalogo/${linhaId}`);
  return { success: true };
}

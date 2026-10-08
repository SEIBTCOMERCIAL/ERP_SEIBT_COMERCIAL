// Links temporários dos anexos. Só para código de servidor (páginas): nunca expor como ação.
import { createAdminClient } from "@/lib/supabase/admin";

/** Links de 1 hora para ver e baixar arquivos que a página já confirmou que o usuário pode ver. */
export async function gerarLinksAnexos(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await createAdminClient().storage.from("proposta-anexos").createSignedUrls(paths, 3600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ notificacoes: [], naoLidas: 0 }, { status: 401 });

  const { data } = await supabase
    .from("notificacoes")
    .select("id, tipo, titulo, corpo, lida, entidade, entidade_id, link, criado_em")
    .eq("usuario_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(30);

  const naoLidas = (data ?? []).filter((n: { lida: boolean }) => !n.lida).length;

  return Response.json({ notificacoes: data ?? [], naoLidas });
}

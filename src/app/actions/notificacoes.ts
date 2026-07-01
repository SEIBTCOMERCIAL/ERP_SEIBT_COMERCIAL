"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function criarNotificacao({
  usuarioIds,
  tipo,
  titulo,
  corpo,
  entidade,
  entidadeId,
  link,
}: {
  usuarioIds: string[];
  tipo: string;
  titulo: string;
  corpo?: string;
  entidade?: string;
  entidadeId?: string;
  link?: string;
}) {
  if (usuarioIds.length === 0) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    await supabase.from("notificacoes").insert(
      usuarioIds.map((uid) => ({
        usuario_id: uid,
        tipo,
        titulo,
        corpo: corpo ?? null,
        entidade: entidade ?? null,
        entidade_id: entidadeId ?? null,
        link: link ?? null,
      }))
    );

    // Email opcional via Resend (ativa se RESEND_API_KEY estiver configurado)
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = createClient() as any;
      const { data: usuarios } = await sb
        .from("usuarios")
        .select("email")
        .in("id", usuarioIds)
        .eq("ativo", true);

      for (const u of usuarios ?? []) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ERP SEIBT <noreply@seibt.com.br>",
            to: [u.email],
            subject: titulo,
            html: `<p>${corpo ?? titulo}</p>${link ? `<p><a href="${link}">Ver no ERP</a></p>` : ""}`,
          }),
        }).catch(() => {});
      }
    }
  } catch {
    // Notificação não deve quebrar o fluxo
  }
}

export async function marcarTodasLidas() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("usuario_id", user.id)
    .eq("lida", false);

  revalidatePath("/notificacoes");
}

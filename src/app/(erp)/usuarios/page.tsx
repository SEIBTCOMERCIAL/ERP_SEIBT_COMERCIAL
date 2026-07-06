import { createClient } from "@/lib/supabase/server";
import { UsuariosView } from "@/components/usuarios/UsuariosView";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("perfil, pode_configurar")
    .eq("id", user?.id ?? "")
    .single();

  if (!perfil || (perfil.perfil !== "admin" && !perfil.pode_configurar)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7b8d", fontSize: 14 }}>
        Acesso restrito a administradores.
      </div>
    );
  }

  void admin; // admin client available for future server actions

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, pode_configurar, iniciais_pdf, ativo, paginas_visiveis")
    .order("nome");

  return <UsuariosView initialUsuarios={usuarios ?? []} />;
}

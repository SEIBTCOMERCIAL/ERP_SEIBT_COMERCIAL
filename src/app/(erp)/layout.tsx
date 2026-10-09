import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";

export default async function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Busca dados do usuário na tabela de negócio
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome, email, perfil, pode_configurar, avatar_url, paginas_visiveis")
    .eq("id", user.id)
    .single();

  // Fallback enquanto o schema ainda não foi criado
  const usuarioData = usuario ?? {
    nome: user.email?.split("@")[0] ?? "Usuário",
    email: user.email ?? "",
    perfil: "admin" as const,
    pode_configurar: true,
    avatar_url: null,
    paginas_visiveis: [],
  };

  return (
    <AppShell usuario={usuarioData}>{children}</AppShell>
  );
}

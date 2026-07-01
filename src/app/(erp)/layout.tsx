import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

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
    .select("nome, email, perfil, pode_configurar, avatar_url")
    .eq("id", user.id)
    .single();

  // Fallback enquanto o schema ainda não foi criado
  const usuarioData = usuario ?? {
    nome: user.email?.split("@")[0] ?? "Usuário",
    email: user.email ?? "",
    perfil: "admin" as const,
    pode_configurar: true,
    avatar_url: null,
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-background">
      <Sidebar usuario={usuarioData} />
      <div className="flex flex-1 flex-col ml-[224px]">
        <Topbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    </div>
  );
}

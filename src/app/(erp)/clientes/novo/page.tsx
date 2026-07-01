import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NovoClienteForm } from "@/components/clientes/NovoClienteForm";

export const metadata: Metadata = { title: "Novo Cliente" };

export default async function NovoClientePage() {
  const supabase = createClient();

  const [{ data: vendedores }, { data: representantes }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nome")
      .in("perfil", ["admin", "vendedor_interno"])
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome"),
    supabase
      .from("representantes")
      .select("id, nome, tipo")
      .eq("ativo", true)
      .order("nome"),
  ]);

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/clientes" className="text-[#2074B9] hover:underline">Clientes</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Novo cliente</span>
        </div>
      </div>

      {/* Formulário */}
      <NovoClienteForm
        vendedores={vendedores ?? []}
        representantes={representantes ?? []}
      />
    </div>
  );
}

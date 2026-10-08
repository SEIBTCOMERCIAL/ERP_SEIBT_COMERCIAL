import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { carregarPropostasPrincipais } from "@/lib/propostas/crm-servidor";
import { GerarNumeroForm } from "@/components/propostas/GerarNumeroForm";

export const metadata: Metadata = { title: "Gerar número de proposta" };

export default async function GerarNumeroPage({ searchParams }: { searchParams: { cliente_id?: string } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const [{ data: clientes }, propostasPrincipais] = await Promise.all([
    supabase.from("clientes").select("id, razao_social, cnpj, cidade, estado").is("deleted_at", null).order("razao_social").limit(5000),
    carregarPropostasPrincipais(supabase),
  ]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link href="/propostas" className="text-[#2074B9] hover:underline">Propostas</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">Gerar número</span>
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Gerar número de proposta</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Reserva o número e cria o cartão no funil. A proposta pode ser montada e enviada depois, fora do ERP.</p>
      </div>
      <GerarNumeroForm
        clientes={(clientes ?? []) as Array<{ id: string; razao_social: string; cnpj: string | null; cidade: string | null; estado: string | null }>}
        propostasPrincipais={propostasPrincipais}
        clientePreSelecionado={searchParams.cliente_id ?? null}
      />
    </div>
  );
}

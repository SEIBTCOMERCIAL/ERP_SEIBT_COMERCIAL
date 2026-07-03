import { createClient } from "@/lib/supabase/server";
import { LeadsView } from "@/components/leads/LeadsView";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: leads } = await supabase
    .from("leads")
    .select("id, empresa_nome, contato_nome, contato_telefone, contato_email, canal_entrada, tipo_interesse, status, observacoes, criado_em")
    .is("deleted_at", null)
    .order("criado_em", { ascending: false });

  return <LeadsView leads={leads ?? []} />;
}

import { createClient } from "@/lib/supabase/server";
import { LeadsAcompanhamento } from "@/components/leads/LeadsAcompanhamento";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .is("deleted_at", null)
    .order("criado_em", { ascending: false });

  const {data: representantes} = await supabase.from('representantes').select('id,nome').order('nome');
  const {data: clientes} = await supabase.from('clientes').select('id,razao_social').is('deleted_at',null).order('razao_social');
  if(error) return <p className="p-6">Não foi possível carregar os leads. Tente novamente.</p>;
  return <LeadsAcompanhamento leads={leads ?? []} representantes={representantes ?? []} clientes={clientes ?? []} />;
}

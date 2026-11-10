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

  const {data: representantes, error: repError} = await supabase.from('representantes').select('id,nome').order('nome');
  const {data: etapas, error: etapaError} = await supabase.from('etapas_lead').select('*').order('ordem').order('nome');
  const {data:{user}} = await supabase.auth.getUser();
  const {data: usuario} = user ? await supabase.from('usuarios').select('perfil').eq('id',user.id).single() : {data:null};
  const {data: clientes} = await supabase.from('clientes').select('id,razao_social').is('deleted_at',null).order('razao_social');
  if(error || repError || etapaError) return <p className="p-6">Não foi possível carregar os leads e etapas. Confira a atualização do banco e tente novamente.</p>;
  return <LeadsAcompanhamento leads={leads ?? []} representantes={representantes ?? []} clientes={clientes ?? []} etapas={etapas ?? []} admin={usuario?.perfil==='admin'} />;
}

import { createClient } from "@/lib/supabase/server";
import { RepresentantesView } from "@/components/representantes/RepresentantesView";

export const dynamic = "force-dynamic";

export default async function RepresentantesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

  const [{ data: representantes }, { data: regioes }, { data: propostas }] = await Promise.all([
    supabase
      .from("representantes")
      .select("id, nome, tipo, empresa, telefone, email, ativo, observacoes")
      .order("nome"),
    supabase
      .from("regioes_representante")
      .select("representante_id, estado, pais"),
    supabase
      .from("propostas")
      .select("id, representante_id, status, valor_total, criado_em, cliente_id")
      .is("deleted_at", null)
      .gte("criado_em", inicioMes),
  ]);

  return (
    <RepresentantesView
      representantes={representantes ?? []}
      regioes={regioes ?? []}
      propostas={propostas ?? []}
    />
  );
}

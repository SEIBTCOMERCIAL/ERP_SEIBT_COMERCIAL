import { createClient } from "@/lib/supabase/server";
import { ReajusteMain } from "@/components/reajuste/ReajusteMain";
import { carregarResumo, exigirAdmin } from "@/lib/reajuste/servidor";
import type { ResumoReajuste } from "@/lib/reajuste/tipos";

export const dynamic = "force-dynamic";

export default async function ReajustePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  if (!(await exigirAdmin(supabase))) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  let resumo: ResumoReajuste | null = null;
  try {
    resumo = await carregarResumo(supabase);
  } catch {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Não foi possível carregar os dados de reajuste. Atualize a página; se continuar, avise o responsável pelo sistema.
      </div>
    );
  }

  // Câmbio: só é mostrado quando existe cotação cadastrada (com a data). Sem valor "padrão" escondido.
  const { data: taxa } = await supabase
    .from("taxas_cambio")
    .select("taxa, vigente_desde")
    .eq("moeda", "USD")
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cambio = taxa ? { taxa: Number(taxa.taxa), desde: String(taxa.vigente_desde) } : null;

  return <ReajusteMain resumo={resumo} cambio={cambio} />;
}

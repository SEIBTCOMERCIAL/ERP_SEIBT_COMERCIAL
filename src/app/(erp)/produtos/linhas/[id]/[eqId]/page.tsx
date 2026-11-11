import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EquipamentoPagina } from "@/components/produtos/equipamento/EquipamentoPagina";
import { carregarJogosDoEquipamento } from "@/lib/propostas/jogos-servidor";
import { hojeSaoPaulo } from "@/lib/reajuste/regras";
import { carregarArquivos, carregarEquipamento, contarVinculosPorCategoria } from "@/lib/produtos/servidor";
import { ehUuid } from "@/lib/produtos/regras";

export const dynamic = "force-dynamic";

/** Só aceita voltar para a lista de Produtos (query string simples), nunca para endereços arbitrários. */
function voltarSeguro(v: string | string[] | undefined): string {
  const t = Array.isArray(v) ? v[0] : v;
  return t && /^\?[A-Za-z0-9=&%_.-]{0,400}$/.test(t) ? t : "";
}

export default async function EquipamentoPage({ params, searchParams }: {
  params: { id: string; eqId: string }; searchParams: Record<string, string | string[] | undefined>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!ehUuid(params.id) || !ehUuid(params.eqId)) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: usuario } = user ? await supabase.from("usuarios").select("perfil").eq("id", user.id).single() : { data: null };
  const admin = usuario?.perfil === "admin";
  const de = voltarSeguro(searchParams.de);

  const base = await carregarEquipamento(supabase, params.id, params.eqId).catch(() => null);
  if (!base || base.tipo === "inexistente") notFound();
  // O equipamento existe, mas em outra linha: leva para o endereço correto em vez de mostrar dados sob a linha errada.
  if (base.tipo === "outra_linha") redirect(`/produtos/linhas/${base.linhaCorreta}/${params.eqId}${de ? `?de=${encodeURIComponent(de)}` : ""}`);

  const [campos, categorias, linhaInfo, arquivos, contagem, jogosInfo, taxa] = await Promise.all([
    supabase.from("linha_spec_campos").select("id, nome, ordem").eq("linha_id", base.linha.id).order("ordem"),
    supabase.from("categorias_peca").select("id, nome, ordem").order("ordem"),
    supabase.from("linhas").select("grupo").eq("id", base.linha.id).maybeSingle(),
    carregarArquivos(supabase, params.eqId, base.equipamento.foto_url).catch(() => null),
    contarVinculosPorCategoria(supabase, params.eqId).catch(() => null),
    carregarJogosDoEquipamento(supabase, params.eqId),
    supabase.from("taxas_cambio").select("taxa, vigente_desde").eq("moeda", "USD").order("vigente_desde", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const secao = typeof searchParams.secao === "string" ? searchParams.secao : "geral";
  return (
    <EquipamentoPagina
      admin={admin}
      linha={{ id: base.linha.id, nome: base.linha.nome, familia: linhaInfo.data?.grupo ?? null }}
      equip={base.equipamento}
      campos={(campos.data ?? []) as Array<{ id: string; nome: string; ordem: number }>}
      categorias={(categorias.data ?? []) as Array<{ id: string; nome: string; ordem: number }>}
      arquivos={arquivos ?? []}
      arquivosErro={arquivos === null}
      contagemVinculos={contagem ?? {}}
      jogos={jogosInfo.jogos}
      jogosDisponivel={jogosInfo.disponivel}
      hoje={hojeSaoPaulo()}
      cambio={taxa.data ? { taxa: Number(taxa.data.taxa), desde: String(taxa.data.vigente_desde) } : null}
      voltar={de}
      secaoInicial={secao}
    />
  );
}

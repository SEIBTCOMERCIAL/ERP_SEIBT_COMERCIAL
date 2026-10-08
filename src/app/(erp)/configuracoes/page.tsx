import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfiguracoesView } from "@/components/configuracoes/ConfiguracoesView";
import { faltaEstruturaCrm } from "@/lib/propostas/crm";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("perfil, pode_configurar")
    .eq("id", user?.id ?? "")
    .single();

  if (!perfil || (perfil.perfil !== "admin" && !perfil.pode_configurar)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7b8d", fontSize: 14 }}>
        Acesso restrito a administradores.
      </div>
    );
  }

  const [{ data: taxas }, { data: funis }, { data: etapasNovas, error: erroEtapas }, { data: prazosInatividade, error: erroPrazos }, { data: motivosRaw, error: erroMotivos }] = await Promise.all([
    supabase
      .from("taxas_cambio")
      .select("id, taxa, vigente_desde, criado_em")
      .eq("moeda", "USD")
      .order("vigente_desde", { ascending: false })
      .limit(20),
    admin.from("funis").select("id, nome").is("usuario_id", null).order("nome"),
    admin.from("etapas_funil").select("id, funil_id, nome, cor, ordem, ativo, tipo, exige_proxima_acao").order("ordem"),
    admin
      .from("configuracoes_inatividade_proposta")
      .select("tipo, dias_alerta, dias_escalonamento_admin, atualizado_em")
      .order("tipo"),
    admin.from("motivos_proposta").select("id, categoria, codigo, nome, ordem, ativo").order("ordem"),
  ]);

  // Banco sem o arquivo 024: lê as etapas só com os campos antigos.
  const etapas = erroEtapas
    ? (await admin.from("etapas_funil").select("id, funil_id, nome, cor, ordem, ativo").order("ordem")).data
    : etapasNovas;

  const taxaAtual = taxas?.[0]?.taxa ?? null;
  const historicoCambio = taxas ?? [];

  return (
    <ConfiguracoesView
      taxaAtual={taxaAtual}
      historicoCambio={historicoCambio}
      funis={funis ?? []}
      etapas={etapas ?? []}
      motivos={motivosRaw ?? []}
      ehAdmin={perfil.perfil === "admin"}
      funilPendente={Boolean(erroEtapas)}
      motivosPendentes={Boolean(erroMotivos)}
      prazosInatividade={prazosInatividade ?? []}
      podeEditarPrazos={perfil.perfil === "admin"}
      prazosPendentes={faltaEstruturaCrm(erroPrazos)}
    />
  );
}

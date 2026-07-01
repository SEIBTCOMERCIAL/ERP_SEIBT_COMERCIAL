import type { Metadata } from "next";
import Link from "next/link";
import { Search, AlertCircle, Check, CheckCircle, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PropostaTipoBadge } from "@/components/propostas/StatusBadge";
import { RegistrarPedidoDEZForm } from "@/components/pedidos/RegistrarPedidoDEZForm";

export const metadata: Metadata = { title: "Confirmar Pedido DEZ" };

export default async function ReconciliarDEZPage({
  searchParams,
}: {
  searchParams: { numero?: string; erro?: string };
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // Busca proposta pelo numero_completo (URL param)
  let proposta: {
    id: string; numero_completo: string; tipo: string; status: string;
    valor_total: number | null; moeda: string; numero_pedido_dez: string | null;
    contato_nome: string | null; cliente_id: string | null;
  } | null = null;

  let clienteNome: string | null = null;

  if (searchParams.numero) {
    const { data: p } = await supabase
      .from("propostas")
      .select("id, numero_completo, tipo, status, valor_total, moeda, numero_pedido_dez, contato_nome, cliente_id, responsavel_id")
      .eq("numero_completo", searchParams.numero.toUpperCase())
      .is("deleted_at", null)
      .single();

    proposta = p ?? null;

    if (proposta?.cliente_id) {
      const { data: c } = await supabase
        .from("clientes")
        .select("razao_social")
        .eq("id", proposta.cliente_id)
        .single();
      clienteNome = c?.razao_social ?? null;
    }
  }

  // Pedidos recentes (últimos 7 dias)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pedidosRaw } = await supabase
    .from("pedidos")
    .select("id, numero_dez, valor, data_pedido, registrado_em, proposta_id, cliente_id")
    .gte("registrado_em", sevenDaysAgo)
    .eq("estornado", false)
    .order("registrado_em", { ascending: false })
    .limit(10);

  const pedidos = (pedidosRaw ?? []) as Array<{
    id: string; numero_dez: string; valor: number | null;
    data_pedido: string | null; registrado_em: string;
    proposta_id: string | null; cliente_id: string | null;
  }>;

  // Enriquece pedidos com proposta + cliente
  const propIds = pedidos.map((p) => p.proposta_id).filter(Boolean) as string[];
  const clienteIds = pedidos.map((p) => p.cliente_id).filter(Boolean) as string[];

  const [{ data: propostasRaw }, { data: clientesRaw }] = await Promise.all([
    propIds.length
      ? supabase.from("propostas").select("id, numero_completo, tipo, valor_total").in("id", propIds)
      : Promise.resolve({ data: [] }),
    clienteIds.length
      ? supabase.from("clientes").select("id, razao_social").in("id", clienteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const propostas = new Map(
    ((propostasRaw ?? []) as Array<{ id: string; numero_completo: string; tipo: string; valor_total: number | null }>)
      .map((p) => [p.id, p])
  );
  const clientes = new Map(
    ((clientesRaw ?? []) as Array<{ id: string; razao_social: string }>)
      .map((c) => [c.id, c.razao_social])
  );

  const propostaJaVendida = proposta?.numero_pedido_dez != null;

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1A1A] tracking-tight">Confirmar Pedido DEZ</h1>
          <p className="text-[13px] text-[#6B7B8D] mt-0.5">
            Vincula o número do pedido DEZ a uma proposta e marca como Vendida — somente Admin
          </p>
        </div>
        <Link href="/propostas" className="flex items-center gap-1.5 text-[12px] text-[#2074B9] hover:underline">
          <ChevronRight className="h-3 w-3 rotate-180" />
          Voltar às propostas
        </Link>
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-5 items-start">
        {/* Coluna principal — form */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          {/* Header do card */}
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <Check className="h-4 w-4 text-[#2074B9]" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[#1A1A1A]">Confirmar Pedido no ERP</p>
              <p className="text-[12px] text-[#6B7B8D]">Informe o número do pedido DEZ e o valor real fechado</p>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-5">
            {/* Busca por proposta */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-3">Buscar proposta</p>
              <form method="GET" className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B0BAC9]" />
                  <input
                    name="numero"
                    defaultValue={searchParams.numero}
                    placeholder="Ex: 1124/2026"
                    className="w-full h-10 rounded-lg border-[1.5px] border-[#E2E8F0] bg-white pl-9 pr-3 text-[13px] text-[#1A1A1A] placeholder:text-[#B0BAC9] outline-none focus:border-[#2074B9] transition-colors font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="h-10 px-4 bg-[#2C4F79] hover:bg-[#1E3A5F] text-white text-[13px] font-semibold rounded-lg transition-colors"
                >
                  Buscar
                </button>
              </form>
            </div>

            {/* Proposta encontrada */}
            {searchParams.numero && !proposta && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-[13px] text-red-700">
                  Proposta <strong className="font-mono">{searchParams.numero.toUpperCase()}</strong> não encontrada.
                  Verifique o número e tente novamente.
                </p>
              </div>
            )}

            {proposta && (
              <>
                {/* Info da proposta */}
                <div className="rounded-xl border-[1.5px] border-[#16A34A]/40 bg-[#F0FDF4] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-4 w-4 text-[#16A34A] shrink-0" />
                    <p className="text-[12px] font-semibold text-[#16A34A]">Proposta encontrada</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                    {[
                      { label: "Proposta", value: <span className="font-mono font-bold">{proposta.numero_completo}</span> },
                      { label: "Tipo",     value: <PropostaTipoBadge tipo={proposta.tipo} /> },
                      { label: "Cliente",  value: clienteNome ?? proposta.contato_nome ?? "—" },
                      { label: "Valor",    value: proposta.valor_total != null ? formatCurrency(proposta.valor_total) : "—" },
                      { label: "Status",   value: <span className="capitalize">{proposta.status.replace("_", " ")}</span> },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7B8D]">{label}</p>
                        <p className="text-[13px] font-medium text-[#1A1A1A] mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Já tem pedido DEZ */}
                {propostaJaVendida ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-semibold text-amber-800">
                        Proposta já vinculada ao pedido DEZ <strong className="font-mono">{proposta.numero_pedido_dez}</strong>
                      </p>
                      <Link href={`/propostas/${proposta.id}`} className="text-[12px] text-[#2074B9] hover:underline mt-0.5 block">
                        Ver proposta
                      </Link>
                    </div>
                  </div>
                ) : (
                  <RegistrarPedidoDEZForm
                    propostaId={proposta.id}
                    valorProposta={proposta.valor_total}
                  />
                )}
              </>
            )}

            {!searchParams.numero && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <Search className="h-5 w-5 text-[#B0BAC9]" />
                </div>
                <p className="text-[13px] text-[#6B7B8D] text-center max-w-[260px]">
                  Digite o número da proposta acima para iniciar a confirmação do pedido DEZ.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita — confirmações recentes */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#1A1A1A]">Confirmações Recentes</p>
            <p className="text-[11px] text-[#6B7B8D]">Últimos 7 dias</p>
          </div>

          {pedidos.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[12px] text-[#6B7B8D]">Nenhuma confirmação nos últimos 7 dias</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {pedidos.map((pedido) => {
                const prop = pedido.proposta_id ? propostas.get(pedido.proposta_id) : null;
                const clienteName = pedido.cliente_id ? clientes.get(pedido.cliente_id) : null;
                const valorDiff = prop?.valor_total != null && pedido.valor != null
                  ? pedido.valor - prop.valor_total
                  : null;

                return (
                  <div key={pedido.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {prop && (
                            <Link
                              href={`/propostas/${pedido.proposta_id}`}
                              className="text-[12px] font-bold text-[#16A34A] font-mono hover:underline shrink-0"
                            >
                              {prop.numero_completo}
                            </Link>
                          )}
                          <span className="text-[11px] font-mono text-[#6B7B8D]">→ {pedido.numero_dez}</span>
                        </div>
                        {clienteName && (
                          <p className="text-[11px] text-[#6B7B8D] mt-0.5 truncate">{clienteName}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {pedido.valor != null && (
                          <p className="text-[12px] font-semibold font-mono text-[#1A1A1A]">
                            {formatCurrency(pedido.valor)}
                          </p>
                        )}
                        {valorDiff !== null && (
                          <p className={`text-[10px] font-mono ${valorDiff === 0 ? "text-[#16A34A]" : Math.abs(valorDiff) < 1000 ? "text-[#D97706]" : "text-[#DC2626]"}`}>
                            {valorDiff === 0 ? "= valor" : `${valorDiff > 0 ? "+" : ""}${formatCurrency(valorDiff)}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-[#B0BAC9] mt-1">
                      {pedido.data_pedido ? formatDate(pedido.data_pedido) : formatDate(pedido.registrado_em)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

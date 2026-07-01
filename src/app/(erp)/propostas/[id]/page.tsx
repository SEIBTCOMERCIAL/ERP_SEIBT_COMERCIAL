import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Edit, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import {
  PropostaStatusBadge, PropostaTipoBadge, TemperaturaBadge,
} from "@/components/propostas/StatusBadge";
import {
  StatusDropdown, EtapaDropdown, TransferirDropdown,
} from "@/components/propostas/AcoesPropostaClient";
import { AdicionarItemForm } from "@/components/propostas/AdicionarItemForm";
import { RemoverItemForm } from "@/components/propostas/RemoverItemForm";
import { NovoFollowupForm } from "@/components/followups/NovoFollowupForm";
import type { Proposta, ItemProposta, Followup, EtapaFunil, Usuario, Representante, ChecklistTecnico } from "@/types/database";
import { ChecklistTecnicoForm } from "@/components/propostas/ChecklistTecnicoForm";
import { GerarDocxBtn } from "@/components/propostas/GerarDocxBtn";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data } = await supabase.from("propostas").select("numero_completo").eq("id", params.id).single();
  return { title: data?.numero_completo ?? "Proposta" };
}

export default async function DetalhePropostaPage({
  params,
}: {
  params: { id: string };
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const [
    { data: propostaRaw },
    { data: itensRaw },
    { data: followupsRaw },
    { data: etapasRaw },
    { data: vendedoresRaw },
    { data: checklistRaw },
  ] = await Promise.all([
    supabase
      .from("propostas")
      .select("id, numero_completo, numero, revisao, tipo, status, temperatura, moeda, valor_total, desconto_medio_pct, condicao_pagamento, prazo_entrega, validade_proposta, observacoes, descricao_livre, canal_origem, criado_em, enviada_em, fechada_em, atualizado_em, cliente_id, responsavel_id, representante_id, etapa_funil_id, estornado, numero_pedido_dez, valor_pedido_real, data_pedido_dez")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("itens_proposta")
      .select("id, descricao, quantidade, preco_tabela, preco_unitario, ipi_pct, desconto_pct, total, opcional, numero_item, observacao")
      .eq("proposta_id", params.id)
      .order("ordem"),
    supabase
      .from("followups")
      .select("id, data_contato, canal, motivo, descricao, temperatura, proxima_acao_data, proxima_acao_tipo, proxima_acao_notas")
      .eq("proposta_id", params.id)
      .order("data_contato", { ascending: false }),
    supabase.from("etapas_funil").select("id, nome, cor, ordem").eq("ativo", true).order("ordem"),
    supabase.from("usuarios").select("id, nome, perfil").in("perfil", ["admin", "vendedor_interno", "representante"]).eq("ativo", true),
    supabase.from("checklist_tecnico").select("*").eq("proposta_id", params.id).single(),
  ]);

  if (!propostaRaw) notFound();

  const proposta = propostaRaw as unknown as Proposta;
  const itens = (itensRaw ?? []) as unknown as ItemProposta[];
  const followups = (followupsRaw ?? []) as unknown as Followup[];
  const etapas = (etapasRaw ?? []) as unknown as EtapaFunil[];
  const vendedores = (vendedoresRaw ?? []) as unknown as Pick<Usuario, "id" | "nome">[];
  const checklist = checklistRaw as ChecklistTecnico | null;

  // Busca cliente e responsável
  const [{ data: clienteRaw }, { data: responsavelRaw }, { data: representanteRaw }] = await Promise.all([
    proposta.cliente_id
      ? supabase.from("clientes").select("id, razao_social, cnpj, cidade, estado").eq("id", proposta.cliente_id).single()
      : Promise.resolve({ data: null }),
    proposta.responsavel_id
      ? supabase.from("usuarios").select("id, nome, perfil").eq("id", proposta.responsavel_id).single()
      : Promise.resolve({ data: null }),
    proposta.representante_id
      ? supabase.from("representantes").select("id, nome, tipo").eq("id", proposta.representante_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const cliente = clienteRaw as { id: string; razao_social: string; cnpj: string | null; cidade: string | null; estado: string | null } | null;
  const responsavel = responsavelRaw as Pick<Usuario, "id" | "nome" | "perfil"> | null;
  const representante = representanteRaw as Pick<Representante, "id" | "nome"> | null;
  // etapa usada no EtapaDropdown via prop etapaAtualId


  const canalLabel: Record<string, string> = {
    whatsapp: "WhatsApp", email: "E-mail", feira: "Feira", site: "Site",
    indicacao: "Indicação", telefone: "Telefone", recorrencia: "Recorrência", outro: "Outro",
  };

  const totalSemIpi = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const totalComIpi = itens.reduce((s, i) => s + (i.total ?? 0), 0);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-7 py-3 flex items-center gap-2 text-[12px] text-muted-foreground shrink-0">
        <Link href="/propostas" className="text-[#2074B9] hover:underline">Propostas</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono font-bold text-foreground">{proposta.numero_completo}</span>
      </div>

      <div className="bg-card border-b border-border px-7 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[20px] font-bold text-foreground tracking-tight">{proposta.numero_completo}</span>
            <PropostaStatusBadge status={proposta.status} />
            <PropostaTipoBadge tipo={proposta.tipo} />
            <TemperaturaBadge temperatura={proposta.temperatura} />
            {proposta.moeda === "USD" && (
              <span className="text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-md px-2 py-0.5">USD</span>
            )}
          </div>
          {cliente && (
            <p className="text-[13px] text-muted-foreground mt-1">
              <Link href={`/clientes/${cliente.id}`} className="text-[#2074B9] hover:underline">{cliente.razao_social}</Link>
              {(cliente.cidade || cliente.estado) && ` · ${[cliente.cidade, cliente.estado].filter(Boolean).join(", ")}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusDropdown propostaId={proposta.id} statusAtual={proposta.status} />
          <Link href={`/propostas/${proposta.id}/editar`}>
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-[12px] font-medium hover:border-[#2074B9] transition-colors">
              <Edit className="h-3.5 w-3.5" />
              Editar
            </button>
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex" style={{ minHeight: "calc(100vh - 56px - 48px - 68px)" }}>
        {/* Painel esquerdo */}
        <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-5 border-r border-border">

          {/* Informações gerais */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-[13px] font-semibold text-foreground">Informações da proposta</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4">
              {([
                ["Número", proposta.numero_completo],
                ["Tipo", proposta.tipo],
                ["Moeda", proposta.moeda],
                ["Canal de origem", proposta.canal_origem ? canalLabel[proposta.canal_origem] : "—"],
                ["Condição de pagamento", proposta.condicao_pagamento ?? "—"],
                ["Prazo de entrega", proposta.prazo_entrega ?? "—"],
                ["Validade", proposta.validade_proposta ?? "—"],
                ["Criada em", formatDate(proposta.criado_em)],
                ["Enviada em", proposta.enviada_em ? formatDate(proposta.enviada_em) : "—"],
                ["Fechada em", proposta.fechada_em ? formatDate(proposta.fechada_em) : "—"],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-[13px] font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>
            {proposta.observacoes && (
              <div className="px-5 pb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Observações</p>
                <p className="text-[13px] text-foreground whitespace-pre-line">{proposta.observacoes}</p>
              </div>
            )}
          </div>

          {/* Contato da proposta */}
          {(proposta.contato_nome || proposta.contato_email || proposta.contato_telefone) && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <p className="text-[13px] font-semibold text-foreground">Contato da proposta</p>
              </div>
              <div className="px-5 py-4 grid grid-cols-3 gap-4">
                {proposta.contato_nome && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Nome</p>
                    <p className="text-[13px] font-medium text-foreground">{proposta.contato_nome}</p>
                  </div>
                )}
                {proposta.contato_email && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">E-mail</p>
                    <a href={`mailto:${proposta.contato_email}`} className="text-[13px] text-[#2074B9] hover:underline">{proposta.contato_email}</a>
                  </div>
                )}
                {proposta.contato_telefone && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Telefone</p>
                    <a href={`tel:${proposta.contato_telefone}`} className="text-[13px] text-[#2074B9] hover:underline">{proposta.contato_telefone}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Itens */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <p className="text-[13px] font-semibold text-foreground">
                Itens
                <span className="ml-2 text-[10px] font-bold bg-muted border border-border px-1.5 py-0.5 rounded-full text-muted-foreground">
                  {itens.length}
                </span>
              </p>
              {proposta.valor_total != null && (
                <span className="font-mono text-[13px] font-bold text-foreground">
                  {formatCurrency(proposta.valor_total, proposta.moeda === "USD" ? "USD" : "BRL")}
                </span>
              )}
            </div>

            {itens.length > 0 && (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    {["#", "Descrição", "Qtd.", "Preço unit.", "IPI%", "Desc.%", "Total"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">{h}</th>
                    ))}
                    <th className="px-3 py-2 border-b border-border" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, idx) => (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{item.numero_item ?? idx + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-foreground max-w-[200px]">
                        <p className="truncate">{item.descricao}</p>
                        {item.opcional && <span className="text-[10px] text-amber-600 font-semibold">Opcional</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-foreground text-center">{item.quantidade}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-foreground">
                        {formatCurrency(item.preco_unitario, proposta.moeda === "USD" ? "USD" : "BRL")}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{item.ipi_pct ?? 0}%</td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{item.desconto_pct ? `${item.desconto_pct}%` : "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-foreground">
                        {item.total ? formatCurrency(item.total, proposta.moeda === "USD" ? "USD" : "BRL") : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <RemoverItemForm itemId={item.id} propostaId={proposta.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {itens.length > 1 && (
                  <tfoot>
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Subtotal s/ IPI</td>
                      <td className="px-3 py-2 font-mono text-[12px] font-bold">{formatCurrency(totalSemIpi, proposta.moeda === "USD" ? "USD" : "BRL")}</td>
                      <td />
                    </tr>
                    <tr className="bg-muted/30">
                      <td colSpan={6} className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Total c/ IPI</td>
                      <td className="px-3 py-2 font-mono text-[13px] font-bold text-foreground">{formatCurrency(totalComIpi, proposta.moeda === "USD" ? "USD" : "BRL")}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {/* Adicionar item */}
            <div className="px-5 py-4 border-t border-border bg-muted/20">
              <p className="text-[12px] font-semibold text-foreground mb-3">Adicionar item</p>
              <AdicionarItemForm propostaId={proposta.id} />
            </div>
          </div>

          {/* Checklist Técnico — somente para propostas de máquina */}
          {proposta.tipo === "maquina" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <p className="text-[13px] font-semibold text-foreground">Checklist Técnico da Aplicação</p>
                {checklist?.completo && (
                  <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5">Completo</span>
                )}
              </div>
              <div className="px-5 py-4">
                <ChecklistTecnicoForm propostaId={proposta.id} checklist={checklist} />
              </div>
            </div>
          )}

          {/* Follow-ups */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-[13px] font-semibold text-foreground">
                Follow-ups
                {followups.length > 0 && (
                  <span className="ml-2 text-[10px] font-bold bg-muted border border-border px-1.5 py-0.5 rounded-full text-muted-foreground">
                    {followups.length}
                  </span>
                )}
              </p>
            </div>

            {/* Timeline */}
            {followups.length > 0 && (
              <div className="relative">
                {/* Linha vertical da timeline */}
                <div className="absolute left-[36px] top-0 bottom-0 w-px bg-border" />
                {followups.map((f) => {
                  const canalLabels: Record<string, string> = {
                    whatsapp: "WhatsApp", telefone: "Telefone", email: "E-mail",
                    visita: "Visita", video: "Vídeo", sms: "SMS", outro: "Outro",
                  };
                  return (
                    <div key={f.id} className="flex gap-3 px-5 py-4 border-b border-border last:border-0 relative">
                      {/* Dot da timeline */}
                      <div className="h-5 w-5 rounded-full bg-[#2074B9]/15 border-2 border-[#2074B9] shrink-0 mt-0.5 z-10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[12px] font-bold text-foreground">{canalLabels[f.canal] ?? f.canal}</span>
                          {f.temperatura && <TemperaturaBadge temperatura={f.temperatura} />}
                          <span className="text-[11px] text-muted-foreground ml-auto">{formatDate(f.data_contato)}</span>
                        </div>
                        {f.motivo && <p className="text-[12px] font-medium text-foreground/80">{f.motivo}</p>}
                        {f.descricao && <p className="text-[12px] text-muted-foreground mt-0.5 whitespace-pre-line">{f.descricao}</p>}
                        {f.proxima_acao_data && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 w-fit">
                            <span className="font-semibold text-amber-700">→ Próxima ação:</span>
                            <span className="text-amber-700">{f.proxima_acao_tipo}</span>
                            <span className="text-amber-600">em {formatDate(f.proxima_acao_data)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {followups.length === 0 && (
              <p className="px-5 py-6 text-[12px] text-muted-foreground text-center">
                Nenhum follow-up registrado ainda
              </p>
            )}

            {/* Form de novo follow-up */}
            <div className="px-5 py-4 border-t border-border bg-muted/20">
              <p className="text-[12px] font-semibold text-foreground mb-3">Registrar follow-up</p>
              <NovoFollowupForm propostaId={proposta.id} />
            </div>
          </div>
        </div>

        {/* Sidebar direita */}
        <div className="w-[300px] shrink-0 bg-card overflow-y-auto p-5 flex flex-col gap-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Itens", value: itens.length },
              { label: "Follow-ups", value: followups.length },
            ].map((k) => (
              <div key={k.label} className="bg-muted/40 border border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                <p className="text-[17px] font-bold text-foreground">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border" />

          {/* Etapa do funil */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Etapa do funil</p>
            <EtapaDropdown
              propostaId={proposta.id}
              etapaAtualId={proposta.etapa_funil_id}
              etapas={etapas.map((e) => ({ id: e.id, nome: e.nome, cor: e.cor }))}
            />
          </div>

          <div className="border-t border-border" />

          {/* Responsável */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Responsável</p>
              <TransferirDropdown
                propostaId={proposta.id}
                responsavelAtualId={proposta.responsavel_id}
                vendedores={vendedores.map((v) => ({ id: v.id, nome: v.nome }))}
              />
            </div>
            {responsavel ? (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[#2074B9] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                  {getInitials(responsavel.nome)}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{responsavel.nome}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{responsavel.perfil?.replace("_", " ")}</p>
                </div>
              </div>
            ) : <p className="text-[12px] text-muted-foreground">—</p>}
          </div>

          {representante && (
            <>
              <div className="border-t border-border" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Representante</p>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#2C4F79] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                    {getInitials(representante.nome)}
                  </div>
                  <p className="text-[13px] font-semibold text-foreground">{representante.nome}</p>
                </div>
              </div>
            </>
          )}

          {cliente && (
            <>
              <div className="border-t border-border" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Cliente</p>
                <Link href={`/clientes/${cliente.id}`} className="text-[13px] font-semibold text-[#2074B9] hover:underline">
                  {cliente.razao_social}
                </Link>
                {(cliente.cidade || cliente.estado) && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {[cliente.cidade, cliente.estado].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="border-t border-border" />

          {/* Valor total */}
          {proposta.valor_total != null && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Valor total</p>
              <p className="font-mono text-[20px] font-bold text-foreground">
                {formatCurrency(proposta.valor_total, proposta.moeda === "USD" ? "USD" : "BRL")}
              </p>
              {proposta.moeda === "USD" && (
                <p className="text-[11px] text-muted-foreground mt-0.5">Cotação USD</p>
              )}
            </div>
          )}

          <div className="border-t border-border" />

          {/* Exportar Proposta */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Exportar Proposta</p>
            <GerarDocxBtn
              propostaId={proposta.id}
              numeroCompleto={proposta.numero_completo}
              checklistCompleto={proposta.tipo !== "maquina" || !!(checklist?.completo)}
            />
          </div>

          <div className="border-t border-border" />

          {/* Pedido DEZ */}
          {(proposta as { numero_pedido_dez?: string | null }).numero_pedido_dez ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#16A34A] mb-2">Pedido DEZ</p>
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[#16A34A] shrink-0" />
                  <span className="text-[14px] font-bold font-mono text-[#16A34A]">
                    {(proposta as { numero_pedido_dez?: string | null }).numero_pedido_dez}
                  </span>
                </div>
                {(proposta as { valor_pedido_real?: number | null }).valor_pedido_real != null && (
                  <div>
                    <p className="text-[10px] text-[#6B7B8D] uppercase font-semibold tracking-wide">Valor fechado</p>
                    <p className="text-[13px] font-mono font-bold text-[#1A1A1A] mt-0.5">
                      {formatCurrency((proposta as { valor_pedido_real?: number | null }).valor_pedido_real!)}
                    </p>
                  </div>
                )}
                {(proposta as { data_pedido_dez?: string | null }).data_pedido_dez && (
                  <p className="text-[11px] text-[#6B7B8D]">
                    {formatDate((proposta as { data_pedido_dez?: string | null }).data_pedido_dez!)}
                  </p>
                )}
              </div>
            </div>
          ) : (proposta.status === "vendida" || proposta.status === "em_negociacao" || proposta.status === "enviada") ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Pedido DEZ</p>
              <Link
                href={`/pedidos/reconciliar?numero=${encodeURIComponent(proposta.numero_completo)}`}
                className="flex items-center gap-2 h-9 px-3.5 rounded-lg border-[1.5px] border-[#E2E8F0] bg-white text-[12px] font-semibold text-[#2C4F79] hover:border-[#2074B9] hover:bg-[#EFF6FF] transition-colors"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Registrar Pedido DEZ
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight, Building2, MapPin, Phone, Mail,
  FileText, Edit, Plus, Cpu,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCNPJ, formatDate, getInitials } from "@/lib/utils";
import { StatusClienteBadge, SegmentoBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import type { Cliente, ContatoCliente, MaquinaCliente, Proposta, Usuario, Representante } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clientes")
    .select("razao_social")
    .eq("id", params.id)
    .single();
  return { title: (data as Pick<Cliente, "razao_social"> | null)?.razao_social ?? "Cliente" };
}

export default async function DetalheClientePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [
    { data: clienteRaw },
    { data: contatos },
    { data: maquinas },
    { data: propostas },
  ] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, razao_social, nome_fantasia, cnpj, segmento, porte, status, pais, estado, cidade, endereco, responsavel_id, representante_id, criado_em, atualizado_em")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("contatos_cliente")
      .select("id, nome, cargo, tratamento, telefone, email, whatsapp, principal")
      .eq("cliente_id", params.id)
      .order("principal", { ascending: false }),
    supabase
      .from("maquinas_cliente")
      .select("id, modelo, numero_serie, ano_fabricacao, registrado_em")
      .eq("cliente_id", params.id)
      .limit(5),
    supabase
      .from("propostas")
      .select("id, numero_completo, status, temperatura, valor_total, criado_em")
      .eq("cliente_id", params.id)
      .is("deleted_at", null)
      .order("criado_em", { ascending: false })
      .limit(10),
  ]);

  if (!clienteRaw) notFound();

  const cliente = clienteRaw as unknown as Cliente;
  const contatosList = (contatos ?? []) as unknown as ContatoCliente[];
  const maquinasList = (maquinas ?? []) as unknown as Pick<MaquinaCliente, "id" | "modelo" | "numero_serie" | "ano_fabricacao" | "registrado_em">[];
  const propostasList = (propostas ?? []) as unknown as Pick<Proposta, "id" | "numero_completo" | "status" | "temperatura" | "valor_total" | "criado_em">[];

  // Busca responsável e representante separadamente
  const [{ data: responsavelRaw }, { data: representanteRaw }] = await Promise.all([
    cliente.responsavel_id
      ? supabase.from("usuarios").select("id, nome").eq("id", cliente.responsavel_id).single()
      : Promise.resolve({ data: null }),
    cliente.representante_id
      ? supabase.from("representantes").select("id, nome").eq("id", cliente.representante_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const responsavel = responsavelRaw as Pick<Usuario, "id" | "nome"> | null;
  const representante = representanteRaw as Pick<Representante, "id" | "nome"> | null;

  const initials = getInitials(cliente.razao_social);
  const localidade = [cliente.cidade, cliente.estado, cliente.pais].filter(Boolean).join(", ");

  const statusPropostaStyle: Record<string, string> = {
    rascunho:                "bg-slate-100 text-slate-500",
    elaboracao:              "bg-slate-100 text-slate-600",
    aguardando_precificacao: "bg-purple-50 text-purple-700",
    enviada:                 "bg-blue-50 text-blue-700",
    em_negociacao:           "bg-amber-50 text-amber-700",
    vendida:                 "bg-green-50 text-green-700",
    perdida:                 "bg-red-50 text-red-700",
    desistencia:             "bg-red-50 text-red-400",
    stand_by:                "bg-orange-50 text-orange-700",
  };

  const statusPropostaLabel: Record<string, string> = {
    rascunho:                "Rascunho",
    elaboracao:              "Em elaboração",
    aguardando_precificacao: "Aguardando",
    enviada:                 "Enviada",
    em_negociacao:           "Em negociação",
    vendida:                 "Vendida",
    perdida:                 "Perdida",
    desistencia:             "Desistência",
    stand_by:                "Stand-by",
  };

  return (
    <div className="flex flex-col">
      {/* Breadcrumb */}
      <div className="bg-card border-b border-border px-7 py-3 flex items-center gap-2 text-[12px] text-muted-foreground shrink-0">
        <Link href="/clientes" className="text-[#2074B9] hover:underline">Clientes</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium truncate">{cliente.razao_social}</span>
      </div>

      {/* Header */}
      <div className="bg-card border-b border-border px-7 py-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-[#2C4F79] flex items-center justify-center text-[16px] font-extrabold text-white shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground tracking-tight truncate">
              {cliente.razao_social}
            </h1>
            <StatusClienteBadge status={cliente.status} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-[12px] text-muted-foreground flex-wrap">
            <SegmentoBadge segmento={cliente.segmento} />
            <span>·</span>
            <span className="capitalize">{cliente.porte}</span>
            {cliente.cnpj && (
              <>
                <span>·</span>
                <span className="font-mono">{formatCNPJ(cliente.cnpj)}</span>
              </>
            )}
            {localidade && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {localidade}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Link href={`/propostas/nova?cliente=${cliente.id}`}>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nova proposta
            </Button>
          </Link>
          <Button size="sm" className="h-8 text-[12px] bg-[#2C4F79] hover:bg-[#1E3A5F] gap-1.5">
            <Edit className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0" style={{ height: "calc(100vh - 56px - 48px - 72px)" }}>
        {/* Coluna principal */}
        <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
          {/* Informações cadastrais */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-[#2074B9] flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <p className="text-[13px] font-semibold text-foreground">Informações</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4">
              {([
                ["Razão Social", cliente.razao_social],
                ["Nome Fantasia", cliente.nome_fantasia ?? "—"],
                ["CNPJ", cliente.cnpj ? formatCNPJ(cliente.cnpj) : "—"],
                ["Segmento", cliente.segmento],
                ["Porte", cliente.porte],
                ["País", cliente.pais ?? "Brasil"],
                ["Estado", cliente.estado ?? "—"],
                ["Cidade", cliente.cidade ?? "—"],
                ["Endereço", cliente.endereco ?? "—"],
                ["Cadastrado em", formatDate(cliente.criado_em)],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-[13px] font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contatos */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <p className="text-[13px] font-semibold text-foreground">
                Contatos
                <span className="ml-2 text-[10px] font-bold bg-muted border border-border px-1.5 py-0.5 rounded-full text-muted-foreground">
                  {contatosList.length}
                </span>
              </p>
              <button className="text-[12px] text-[#2074B9] font-medium">+ Adicionar</button>
            </div>
            {!contatosList.length ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhum contato cadastrado
              </div>
            ) : (
              <div>
                {contatosList.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0">
                    <div className="h-8 w-8 rounded-full bg-[#2074B9] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                      {getInitials(c.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                        {c.nome}
                        {c.principal && (
                          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                            Principal
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{c.cargo ?? "—"}</p>
                    </div>
                    <div className="flex gap-1.5 ml-auto">
                      {c.telefone && (
                        <a href={`tel:${c.telefone}`} className="h-7 w-7 border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:border-[#2074B9] hover:text-[#2074B9] transition-colors">
                          <Phone className="h-3 w-3" />
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="h-7 w-7 border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:border-[#2074B9] hover:text-[#2074B9] transition-colors">
                          <Mail className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Máquinas */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <p className="text-[13px] font-semibold text-foreground">
                Máquinas instaladas
                <span className="ml-2 text-[10px] font-bold bg-muted border border-border px-1.5 py-0.5 rounded-full text-muted-foreground">
                  {maquinasList.length}
                </span>
              </p>
              <button className="text-[12px] text-[#2074B9] font-medium">+ Registrar</button>
            </div>
            {!maquinasList.length ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma máquina registrada
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-2.5">
                {maquinasList.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl p-3 cursor-pointer hover:border-[#2074B9] transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Cpu className="h-4 w-4 text-[#2074B9]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-foreground">{m.modelo ?? "Sem modelo"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[m.ano_fabricacao, m.numero_serie ? `S/N: ${m.numero_serie}` : null].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Propostas */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <p className="text-[13px] font-semibold text-foreground">
                Propostas
                <span className="ml-2 text-[10px] font-bold bg-muted border border-border px-1.5 py-0.5 rounded-full text-muted-foreground">
                  {propostasList.length}
                </span>
              </p>
              <Link href={`/propostas/nova?cliente=${cliente.id}`} className="text-[12px] text-[#2074B9] font-medium">
                + Nova proposta
              </Link>
            </div>
            {!propostasList.length ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma proposta para este cliente
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    {["Número", "Status", "Valor", "Data"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {propostasList.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-3">
                        <Link href={`/propostas/${p.id}`} className="font-mono text-[13px] text-[#2074B9] hover:underline">
                          {p.numero_completo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusPropostaStyle[p.status] ?? "bg-slate-100 text-slate-500"}`}>
                          {statusPropostaLabel[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px]">
                        {p.valor_total
                          ? `R$ ${Number(p.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {formatDate(p.criado_em)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar direita */}
        <div className="w-[280px] shrink-0 border-l border-border bg-card overflow-y-auto p-5 flex flex-col gap-5">
          {/* KPIs */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Resumo</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Propostas", value: propostasList.length },
                { label: "Máquinas", value: maquinasList.length },
                { label: "Contatos", value: contatosList.length },
              ].map((k) => (
                <div key={k.label} className="bg-muted/40 border border-border rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    {k.label}
                  </p>
                  <p className="text-[17px] font-bold text-foreground">{k.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Responsável */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Responsável</p>
            {responsavel ? (
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[#2074B9] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                  {getInitials(responsavel.nome)}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{responsavel.nome}</p>
                  <p className="text-[11px] text-muted-foreground">Vendedor interno</p>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">Sem responsável definido</p>
            )}
          </div>

          {representante && (
            <>
              <div className="border-t border-border" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Representante</p>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#2C4F79] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                    {getInitials(representante.nome)}
                  </div>
                  <p className="text-[13px] font-semibold text-foreground">{representante.nome}</p>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-border" />

          {/* Ações rápidas */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Ações rápidas</p>
            <div className="flex flex-col gap-1.5">
              <Link
                href={`/propostas/nova?cliente=${cliente.id}`}
                className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:border-[#2074B9] hover:text-[#2074B9] transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Nova proposta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin, Phone, Mail, FileText, Edit, Plus, Cpu, Download, Paperclip, Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCNPJ, formatCurrency, formatDate, formatDateTime, getInitials } from "@/lib/utils";
import { StatusClienteBadge, SegmentoBadge } from "@/components/ui/status-badge";
import { PropostaStatusBadge, PropostaTipoBadge } from "@/components/propostas/StatusBadge";
import { HistoricoNegociacao, type EventoHistorico } from "@/components/propostas/HistoricoNegociacao";
import { Button } from "@/components/ui/button";
import { STATUS_ABERTOS, calcularIndicadores, mercadoDe } from "@/lib/propostas/crm";
import { carregarMotivos } from "@/lib/propostas/crm-servidor";
import { gerarLinksAnexos } from "@/lib/propostas/anexos-servidor";
import { hojeISO } from "@/lib/propostas/alertas";
import type { Cliente, ContatoCliente, MaquinaCliente } from "@/types/database";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase.from("clientes").select("razao_social").eq("id", params.id).single();
  return { title: (data as Pick<Cliente, "razao_social"> | null)?.razao_social ?? "Cliente" };
}

type PropostaCliente = {
  id: string; numero_completo: string; tipo: string; status: string; temperatura: string | null; valor_total: number | null;
  moeda: string; criado_em: string; atualizado_em: string; descricao_livre: string | null;
  mercado?: "nacional" | "exportacao" | null; papel?: "principal" | "complementar" | null; proposta_principal_id?: string | null;
};

const ABAS = [
  { id: "visao", label: "Visão geral" },
  { id: "propostas", label: "Propostas" },
  { id: "followups", label: "Follow-ups" },
  { id: "anexos", label: "Anexos" },
  { id: "pedidos", label: "Pedidos" },
  { id: "timeline", label: "Timeline" },
] as const;

const CANAIS_FOLLOWUP: Record<string, string> = { whatsapp: "WhatsApp", telefone: "Telefone", email: "E-mail", visita: "Visita", video: "Vídeo", sms: "SMS", outro: "Outro" };
const CATEGORIAS_ANEXO: Record<string, string> = {
  pedido_pdf: "PDF do pedido", proposta_externa: "Proposta externa", demonstrativo: "Demonstrativo", foto: "Foto",
  desenho: "Desenho", documento_tecnico: "Documento técnico", planilha: "Planilha", outro: "Outro",
};

function Bloco({ titulo, contador, acao, children }: { titulo: string; contador?: number; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-[13px] font-semibold text-foreground">
          {titulo}
          {contador !== undefined && <span className="ml-2 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{contador}</span>}
        </h2>
        {acao}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="py-4 text-center text-[13px] text-muted-foreground">{texto}</p>;
}

export default async function DetalheClientePage({ params, searchParams }: { params: { id: string }; searchParams: { aba?: string } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const aba = ABAS.some((a) => a.id === searchParams.aba) ? searchParams.aba! : "visao";

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, razao_social, nome_fantasia, cnpj, segmento, porte, status, pais, estado, cidade, endereco, responsavel_id, representante_id, criado_em, atualizado_em")
    .eq("id", params.id).is("deleted_at", null).maybeSingle() as { data: Cliente | null };
  if (!cliente) notFound();

  const consultaPropostas = (campos: string) =>
    supabase.from("propostas").select(campos).eq("cliente_id", params.id).is("deleted_at", null).order("criado_em", { ascending: false });
  const [{ data: contatos }, { data: maquinas }, propostasCrm, responsavelR, representanteR, pedidosR, motivos] = await Promise.all([
    supabase.from("contatos_cliente").select("id, nome, cargo, tratamento, telefone, email, whatsapp, principal").eq("cliente_id", params.id).order("principal", { ascending: false }),
    supabase.from("maquinas_cliente").select("id, modelo, numero_serie, ano_fabricacao, registrado_em").eq("cliente_id", params.id).limit(20),
    consultaPropostas("id, numero_completo, tipo, status, temperatura, valor_total, moeda, criado_em, atualizado_em, descricao_livre, mercado, papel, proposta_principal_id"),
    cliente.responsavel_id ? supabase.from("usuarios").select("id, nome").eq("id", cliente.responsavel_id).maybeSingle() : Promise.resolve({ data: null }),
    cliente.representante_id ? supabase.from("representantes").select("id, nome").eq("id", cliente.representante_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("pedidos").select("id, numero_dez, proposta_id, valor, data_pedido, estornado, classificacao, observacoes").eq("cliente_id", params.id).order("data_pedido", { ascending: false }),
    carregarMotivos(supabase),
  ]);
  const propostasFinal = propostasCrm.error
    ? await consultaPropostas("id, numero_completo, tipo, status, temperatura, valor_total, moeda, criado_em, atualizado_em, descricao_livre")
    : propostasCrm;

  const contatosList = (contatos ?? []) as ContatoCliente[];
  const maquinasList = (maquinas ?? []) as MaquinaCliente[];
  const propostas = (propostasFinal.data ?? []) as PropostaCliente[];
  const pedidos = (pedidosR.data ?? []) as Array<{ id: string; numero_dez: string; proposta_id: string | null; valor: number | null; data_pedido: string | null; estornado: boolean; classificacao: string | null; observacoes: string | null }>;
  const responsavel = responsavelR.data as { id: string; nome: string } | null;
  const representante = representanteR.data as { id: string; nome: string } | null;
  const numeros = new Map(propostas.map((p) => [p.id, p.numero_completo]));
  const propostaIds = propostas.map((p) => p.id);

  const [followupsR, historicoR, anexosR] = await Promise.all([
    propostaIds.length
      ? supabase.from("followups").select("id, proposta_id, usuario_id, data_contato, canal, motivo, descricao, proxima_acao_data, proxima_acao_tipo, proxima_acao_notas, criado_em").in("proposta_id", propostaIds).order("data_contato", { ascending: false }).order("criado_em", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    propostaIds.length
      ? supabase.from("proposta_historico").select("id, proposta_id, tipo, descricao, detalhes, usuario_nome, criado_em").in("proposta_id", propostaIds).order("criado_em", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    propostaIds.length
      ? supabase.from("proposta_anexos").select("id, proposta_id, categoria, nome, tamanho_bytes, storage_path, enviado_por, criado_em").in("proposta_id", propostaIds).order("criado_em", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const followups = (followupsR.data ?? []) as Array<{ id: string; proposta_id: string; usuario_id: string | null; data_contato: string; canal: string; motivo: string | null; descricao: string | null; proxima_acao_data: string | null; proxima_acao_tipo: string | null; proxima_acao_notas: string | null; criado_em: string }>;
  const historico = (historicoR.error ? [] : historicoR.data ?? []) as Array<EventoHistorico & { proposta_id: string }>;
  const anexosRaw = (anexosR.error ? [] : anexosR.data ?? []) as Array<{ id: string; proposta_id: string; categoria: string; nome: string; tamanho_bytes: number | null; storage_path: string; enviado_por: string | null; criado_em: string }>;
  const links = await gerarLinksAnexos(anexosRaw.map((a) => a.storage_path));

  const idsUsuarios = Array.from(new Set([...followups.map((f) => f.usuario_id), ...anexosRaw.map((a) => a.enviado_por)].filter((v): v is string => Boolean(v))));
  const { data: nomesRaw } = idsUsuarios.length ? await supabase.from("usuarios").select("id, nome").in("id", idsUsuarios) : { data: [] };
  const nomes = new Map(((nomesRaw ?? []) as Array<{ id: string; nome: string }>).map((u) => [u.id, u.nome]));

  const reais = calcularIndicadores(propostas.filter((p) => p.moeda !== "USD"));
  const dolar = calcularIndicadores(propostas.filter((p) => p.moeda === "USD"));
  const abertas = propostas.filter((p) => STATUS_ABERTOS.has(p.status)).length;
  const ganhas = propostas.filter((p) => p.status === "vendida").length;
  const perdidas = propostas.filter((p) => ["perdida", "desistencia", "cancelada"].includes(p.status)).length;
  const complementares = propostas.filter((p) => p.papel === "complementar").length;
  const hoje = hojeISO();

  // Timeline comercial: histórico das propostas + follow-ups + pedidos + cadastro.
  const timeline: Array<EventoHistorico & { proposta?: string }> = [
    ...historico.map((e) => ({ ...e, proposta: numeros.get(e.proposta_id) })),
    ...followups.map((f) => ({
      id: `f-${f.id}`, tipo: "followup",
      descricao: `Follow-up (${CANAIS_FOLLOWUP[f.canal] ?? f.canal})${f.motivo ? `: ${f.motivo}` : ""}`,
      detalhes: { resumo: [f.descricao, f.proxima_acao_data ? `Próxima ação: ${f.proxima_acao_tipo ?? "ação"} em ${formatDate(f.proxima_acao_data)}` : null].filter(Boolean).join("\n") },
      usuario_nome: f.usuario_id ? nomes.get(f.usuario_id) ?? null : null, criado_em: f.criado_em, proposta: numeros.get(f.proposta_id),
    })),
    ...pedidos.map((p) => ({
      id: `p-${p.id}`, tipo: "observacao", descricao: `Pedido ${p.numero_dez}${p.estornado ? " (estornado)" : ""}${p.valor != null ? ` — ${formatCurrency(p.valor)}` : ""}`,
      detalhes: null, usuario_nome: null, criado_em: p.data_pedido ? `${p.data_pedido}T12:00:00` : new Date().toISOString(), proposta: p.proposta_id ? numeros.get(p.proposta_id) : undefined,
    })),
  ].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const timelineComProposta: EventoHistorico[] = timeline.map((e) => ({ ...e, descricao: e.proposta ? `[${e.proposta}] ${e.descricao}` : e.descricao }));

  const localidade = [cliente.cidade, cliente.estado, cliente.pais].filter(Boolean).join(", ");
  const abaUrl = (id: string) => (id === "visao" ? `/clientes/${cliente.id}` : `/clientes/${cliente.id}?aba=${id}`);

  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3 text-[12px] text-muted-foreground sm:px-7">
        <Link href="/clientes" className="text-[#2074B9] hover:underline">Clientes</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate font-medium text-foreground">{cliente.razao_social}</span>
      </div>

      <header className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:px-7 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#2C4F79] text-[16px] font-extrabold text-white">{getInitials(cliente.razao_social)}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{cliente.razao_social}</h1>
              <StatusClienteBadge status={cliente.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <SegmentoBadge segmento={cliente.segmento} />
              <span className="capitalize">{cliente.porte}</span>
              {cliente.cnpj && <span className="font-mono">{formatCNPJ(cliente.cnpj)}</span>}
              {localidade && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{localidade}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/propostas/gerar-numero?cliente_id=${cliente.id}`}>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[12px]"><Hash className="h-3.5 w-3.5" />Gerar número</Button>
          </Link>
          <Link href={`/propostas/nova?cliente_id=${cliente.id}`}>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[12px]"><Plus className="h-3.5 w-3.5" />Nova proposta</Button>
          </Link>
          <Button size="sm" className="h-9 gap-1.5 bg-[#2C4F79] text-[12px] hover:bg-[#1E3A5F]"><Edit className="h-3.5 w-3.5" />Editar</Button>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-4 sm:p-7">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Propostas", valor: String(propostas.length), sub: complementares ? `${complementares} complementar${complementares > 1 ? "es" : ""}` : "no total" },
            { label: "Em aberto", valor: String(abertas), sub: "propostas" },
            { label: "Ganhas", valor: String(ganhas), sub: "vendidas", cor: "text-green-700" },
            { label: "Perdidas", valor: String(perdidas), sub: "perdida, desistência, cancelada", cor: "text-red-700" },
            { label: "Valor apresentado", valor: formatCurrency(reais.valorApresentado), sub: dolar.valorApresentado > 0 ? `+ ${formatCurrency(dolar.valorApresentado, "USD")}` : "todas as alternativas" },
            { label: "Funil ativo", valor: formatCurrency(reais.funilAtivo), sub: dolar.funilAtivo > 0 ? `+ ${formatCurrency(dolar.funilAtivo, "USD")}` : "sem duplicar alternativas" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground">{k.label}</p>
              <p className={`mt-1.5 text-[17px] font-bold ${k.cor ?? "text-foreground"}`}>{k.valor}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{k.sub}</p>
            </div>
          ))}
        </div>

        <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0" aria-label="Seções do cliente">
          {ABAS.map((a) => (
            <Link key={a.id} href={abaUrl(a.id)} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium ${aba === a.id ? "border-[#2C4F79] text-[#2C4F79]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{a.label}</Link>
          ))}
        </nav>

        {aba === "visao" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col gap-5">
              <Bloco titulo="Dados cadastrais">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {([
                    ["Razão social", cliente.razao_social], ["Nome fantasia", cliente.nome_fantasia ?? "—"],
                    ["CNPJ / CPF", cliente.cnpj ? formatCNPJ(cliente.cnpj) : "—"], ["Segmento", cliente.segmento],
                    ["Porte", cliente.porte], ["País", cliente.pais ?? "Brasil"], ["Estado", cliente.estado ?? "—"],
                    ["Cidade", cliente.cidade ?? "—"], ["Endereço", cliente.endereco ?? "—"], ["Cadastrado em", formatDate(cliente.criado_em)],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="flex min-w-0 flex-col gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="break-words text-[13px] font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </Bloco>
              <Bloco titulo="Contatos" contador={contatosList.length}>
                {!contatosList.length ? <Vazio texto="Nenhum contato cadastrado" /> : (
                  <ul className="flex flex-col divide-y divide-border">
                    {contatosList.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2074B9] text-[11px] font-bold text-white">{getInitials(c.nome)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">{c.nome}{c.principal && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Principal</span>}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{[c.cargo, c.email, c.telefone].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                        <div className="ml-auto flex gap-1.5">
                          {c.telefone && <a href={`tel:${c.telefone}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-[#2074B9] hover:text-[#2074B9]" aria-label="Ligar"><Phone className="h-3.5 w-3.5" /></a>}
                          {c.email && <a href={`mailto:${c.email}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-[#2074B9] hover:text-[#2074B9]" aria-label="E-mail"><Mail className="h-3.5 w-3.5" /></a>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloco>
              <Bloco titulo="Máquinas instaladas" contador={maquinasList.length}>
                {!maquinasList.length ? <Vazio texto="Nenhuma máquina registrada" /> : (
                  <div className="flex flex-col gap-2.5">
                    {maquinasList.map((m) => (
                      <div key={m.id} className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50"><Cpu className="h-4 w-4 text-[#2074B9]" /></div>
                        <div><p className="text-[13px] font-bold text-foreground">{m.modelo ?? "Sem modelo"}</p><p className="text-[11px] text-muted-foreground">{[m.ano_fabricacao, m.numero_serie ? `S/N: ${m.numero_serie}` : null].filter(Boolean).join(" · ") || "—"}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </Bloco>
            </div>
            <aside className="flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Responsável</p>
                {responsavel ? (
                  <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2074B9] text-[11px] font-bold text-white">{getInitials(responsavel.nome)}</div><p className="text-[13px] font-semibold text-foreground">{responsavel.nome}</p></div>
                ) : <p className="text-[12px] text-muted-foreground">Sem responsável definido</p>}
                {representante && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Representante</p>
                    <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2C4F79] text-[11px] font-bold text-white">{getInitials(representante.nome)}</div><p className="text-[13px] font-semibold text-foreground">{representante.nome}</p></div>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ações rápidas</p>
                <Link href={`/propostas/nova?cliente_id=${cliente.id}`} className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[12px] text-foreground hover:border-[#2074B9] hover:text-[#2074B9]"><FileText className="h-3.5 w-3.5" />Nova proposta</Link>
              </div>
            </aside>
          </div>
        )}

        {aba === "propostas" && (
          <Bloco titulo="Propostas do cliente" contador={propostas.length} acao={<Link href={`/propostas/nova?cliente_id=${cliente.id}`} className="text-[12px] font-medium text-[#2074B9]">+ Nova proposta</Link>}>
            {!propostas.length ? <Vazio texto="Nenhuma proposta para este cliente" /> : (
              <>
                <div className="-mx-4 hidden overflow-x-auto md:block sm:-mx-5">
                  <table className="w-full min-w-[820px]">
                    <thead><tr className="bg-muted/40">{["Número", "Produto", "Tipo", "Classificação", "Status", "Valor", "Data"].map((h) => <th key={h} className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>)}</tr></thead>
                    <tbody>
                      {propostas.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-3"><Link href={`/propostas/${p.id}`} className="font-mono text-[13px] font-bold text-[#2074B9] hover:underline">{p.numero_completo}</Link></td>
                          <td className="max-w-[220px] px-3 py-3 text-[12px] text-muted-foreground"><span className="line-clamp-2">{p.descricao_livre ?? "—"}</span></td>
                          <td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><PropostaTipoBadge tipo={p.tipo} /><span className="text-[10px] text-muted-foreground">{mercadoDe(p) === "exportacao" ? "Exportação" : "Nacional"}</span></div></td>
                          <td className="px-3 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${p.papel === "complementar" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>{p.papel === "complementar" ? "Complementar" : "Principal"}</span></td>
                          <td className="px-3 py-3"><PropostaStatusBadge status={p.status} /></td>
                          <td className="px-3 py-3 font-mono text-[12px]">{p.valor_total ? formatCurrency(p.valor_total, p.moeda === "USD" ? "USD" : "BRL") : "—"}</td>
                          <td className="px-3 py-3 text-[12px] text-muted-foreground">{formatDate(p.criado_em)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-2 md:hidden">
                  {propostas.map((p) => (
                    <Link key={p.id} href={`/propostas/${p.id}`} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2"><span className="font-mono text-[12px] font-bold text-[#2074B9]">{p.numero_completo}</span><PropostaStatusBadge status={p.status} /></div>
                      {p.descricao_livre && <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{p.descricao_livre}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]"><PropostaTipoBadge tipo={p.tipo} /><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${p.papel === "complementar" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>{p.papel === "complementar" ? "Complementar" : "Principal"}</span><span className="ml-auto font-mono font-semibold">{p.valor_total ? formatCurrency(p.valor_total, p.moeda === "USD" ? "USD" : "BRL") : "—"}</span></div>
                    </Link>
                  ))}
                </div>
                {complementares > 0 && <p className="mt-3 text-[11px] text-purple-700">As propostas complementares fazem parte do valor apresentado; o funil ativo conta só a maior alternativa de cada negócio.</p>}
              </>
            )}
          </Bloco>
        )}

        {aba === "followups" && (
          <Bloco titulo="Follow-ups" contador={followups.length}>
            {!followups.length ? <Vazio texto="Nenhum follow-up registrado" /> : (
              <ul className="flex flex-col divide-y divide-border">
                {followups.map((f) => {
                  const atrasada = Boolean(f.proxima_acao_data && f.proxima_acao_data < hoje);
                  return (
                    <li key={f.id} className="py-3 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/propostas/${f.proposta_id}#followups`} className="font-mono text-[12px] font-bold text-[#2074B9] hover:underline">{numeros.get(f.proposta_id) ?? "Proposta"}</Link>
                        <span className="text-[12px] font-semibold text-foreground">{CANAIS_FOLLOWUP[f.canal] ?? f.canal}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(f.data_contato)}{f.usuario_id && nomes.get(f.usuario_id) ? ` · ${nomes.get(f.usuario_id)}` : ""}</span>
                      </div>
                      {f.motivo && <p className="mt-0.5 text-[12px] font-medium text-foreground/80">{f.motivo}</p>}
                      {f.descricao && <p className="mt-0.5 whitespace-pre-line text-[12px] text-muted-foreground">{f.descricao}</p>}
                      {f.proxima_acao_data && <p className={`mt-1 text-[11px] ${atrasada ? "font-semibold text-red-600" : "text-muted-foreground"}`}>Próxima ação: {f.proxima_acao_tipo ?? "Ação"} em {formatDate(f.proxima_acao_data)}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Bloco>
        )}

        {aba === "anexos" && (
          <Bloco titulo="Anexos das propostas" contador={anexosRaw.length}>
            {anexosR.error ? <Vazio texto="Os anexos ficam disponíveis depois da atualização do banco de dados (arquivo 024)." /> : !anexosRaw.length ? <Vazio texto="Nenhum arquivo anexado nas propostas deste cliente" /> : (
              <ul className="flex flex-col divide-y divide-border">
                {anexosRaw.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Paperclip className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{a.nome}</p>
                      <p className="text-[11px] text-muted-foreground">{numeros.get(a.proposta_id)} · {CATEGORIAS_ANEXO[a.categoria] ?? a.categoria} · {formatDateTime(a.criado_em)}{a.enviado_por && nomes.get(a.enviado_por) ? ` · ${nomes.get(a.enviado_por)}` : ""}</p>
                    </div>
                    {links[a.storage_path] && <a href={`${links[a.storage_path]}&download=${encodeURIComponent(a.nome)}`} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-medium hover:border-[#2074B9]"><Download className="h-3.5 w-3.5" />Baixar</a>}
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        )}

        {aba === "pedidos" && (
          <Bloco titulo="Pedidos relacionados" contador={pedidos.length}>
            {!pedidos.length ? <Vazio texto="Nenhum pedido registrado para este cliente" /> : (
              <ul className="flex flex-col divide-y divide-border">
                {pedidos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                    <span className="font-mono text-[13px] font-bold text-foreground">{p.numero_dez}</span>
                    {p.proposta_id && <Link href={`/propostas/${p.proposta_id}`} className="text-[12px] text-[#2074B9] hover:underline">Proposta {numeros.get(p.proposta_id) ?? ""}</Link>}
                    {p.estornado && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Estornado</span>}
                    <span className="ml-auto flex items-center gap-3 text-[12px] text-muted-foreground"><span className="font-mono font-semibold text-foreground">{p.valor != null ? formatCurrency(p.valor) : "—"}</span>{p.data_pedido ? formatDate(p.data_pedido) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        )}

        {aba === "timeline" && (
          <Bloco titulo="Timeline comercial" contador={timelineComProposta.length}>
            {historicoR.error && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">O histórico completo das propostas aparece depois da atualização do banco de dados (arquivo 024). Por ora: follow-ups e pedidos.</p>}
            <HistoricoNegociacao eventos={timelineComProposta} motivos={motivos.nomes} />
          </Bloco>
        )}
      </div>
    </div>
  );
}

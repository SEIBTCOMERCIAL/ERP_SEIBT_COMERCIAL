import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, ChevronLeft, ChevronRight, FileText, LayoutGrid, MapPin, Plus, Rows3, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCNPJ, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { StatusClienteBadge, SegmentoBadge, ClassBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { STATUS_ABERTOS, calcularIndicadores } from "@/lib/propostas/crm";
import {
  calcularAlertas, emPartes, montarAcompanhamentos, ultimaMovimentacao,
  type Alertas, type FollowupResumo,
} from "@/lib/propostas/alertas";

export const metadata: Metadata = { title: "Clientes" };

interface SearchParams {
  q?: string;
  status?: string;
  segmento?: string;
  porte?: string;
  pais?: string;
  estado?: string;
  cidade?: string;
  ordem?: string;
  modo?: string;
  pagina?: string;
}

const POR_PAGINA = 24;
const ORDENS: Record<string, { rotulo: string; coluna: string; asc: boolean }> = {
  nome: { rotulo: "Nome (A–Z)", coluna: "razao_social", asc: true },
  nome_desc: { rotulo: "Nome (Z–A)", coluna: "razao_social", asc: false },
  recentes: { rotulo: "Atualizados recentemente", coluna: "atualizado_em", asc: false },
  novos: { rotulo: "Cadastrados recentemente", coluna: "criado_em", asc: false },
  cidade: { rotulo: "Cidade", coluna: "cidade", asc: true },
  pais: { rotulo: "País", coluna: "pais", asc: true },
};

type ClienteLinha = {
  id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null; segmento: string; porte: string;
  status: string; estado: string | null; cidade: string | null; pais: string | null; responsavel_id: string | null; atualizado_em: string;
};

type PropostaMini = {
  id: string; cliente_id: string; tipo: string; status: string; valor_total: number | null; moeda: string;
  atualizado_em: string; validade_proposta: string | null; papel?: "principal" | "complementar" | null; proposta_principal_id?: string | null; retomada_prevista?: string | null;
};

type Metricas = {
  total: number; abertas: number; ganhas: number; perdidas: number; complementares: number;
  valorApresentado: number; valorApresentadoUsd: number; funil: number; funilUsd: number;
  ultimaMov: string | null; alertas: { atrasado: number; semAcao: number; parado: number; vencendo: number };
};

const avatarCores = ["bg-[#2C4F79]", "bg-[#2074B9]", "bg-[#7C3AED]", "bg-[#16A34A]", "bg-[#D97706]", "bg-[#DC2626]"];
const selectCls = "h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-[#2074B9]";

/** Remove caracteres que quebrariam o filtro de busca do banco. */
const limparBusca = (v: string) => v.replace(/[,()%*\\]/g, " ").trim();

export default async function ClientesPage({ searchParams }: { searchParams: SearchParams }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const ordem = ORDENS[searchParams.ordem ?? ""] ?? ORDENS.nome;
  const modo = searchParams.modo === "cards" ? "cards" : "tabela";
  const pagina = Math.max(1, parseInt(searchParams.pagina ?? "1", 10) || 1);

  // Indicadores gerais (todos os clientes cadastrados).
  const contar = (filtro?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = supabase.from("clientes").select("*", { count: "exact", head: true }).is("deleted_at", null);
    if (filtro) q = filtro(q);
    return q;
  };
  const [{ count: total }, { count: ativos }, { count: prospects }, { count: inativos }, { count: exterior }] = await Promise.all([
    contar(),
    contar((q) => q.eq("status", "ativo")),
    contar((q) => q.eq("status", "prospect")),
    contar((q) => q.eq("status", "inativo")),
    contar((q) => q.neq("pais", "Brasil")),
  ]);

  // Lista com filtros combináveis, ordenação e paginação no banco.
  let consulta = supabase
    .from("clientes")
    .select("id, razao_social, nome_fantasia, cnpj, segmento, porte, status, estado, cidade, pais, responsavel_id, atualizado_em", { count: "exact" })
    .is("deleted_at", null);

  const termo = limparBusca(searchParams.q ?? "");
  if (termo) {
    const digitos = termo.replace(/\D/g, "");
    const condicoes = [`razao_social.ilike.%${termo}%`, `nome_fantasia.ilike.%${termo}%`, `cnpj.ilike.%${termo}%`, `cidade.ilike.%${termo}%`, `estado.ilike.%${termo}%`, `pais.ilike.%${termo}%`];
    if (digitos.length >= 3 && digitos !== termo) condicoes.push(`cnpj.ilike.%${digitos}%`);
    consulta = consulta.or(condicoes.join(","));
  }
  if (searchParams.status) consulta = consulta.eq("status", searchParams.status);
  if (searchParams.segmento) consulta = consulta.eq("segmento", searchParams.segmento);
  if (searchParams.porte) consulta = consulta.eq("porte", searchParams.porte);
  if (searchParams.pais) consulta = consulta.eq("pais", searchParams.pais);
  if (searchParams.estado) consulta = consulta.ilike("estado", limparBusca(searchParams.estado));
  if (searchParams.cidade) consulta = consulta.ilike("cidade", `%${limparBusca(searchParams.cidade)}%`);
  consulta = consulta.order(ordem.coluna, { ascending: ordem.asc, nullsFirst: false }).order("razao_social").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  const [{ data: clientesRaw, count: totalFiltrado }, { data: paisesRaw }, { data: estadosRaw }] = await Promise.all([
    consulta,
    supabase.from("clientes").select("pais").is("deleted_at", null).not("pais", "is", null).limit(5000),
    supabase.from("clientes").select("estado").is("deleted_at", null).not("estado", "is", null).limit(5000),
  ]);
  const clientes = (clientesRaw ?? []) as ClienteLinha[];
  const paises = Array.from(new Set(((paisesRaw ?? []) as Array<{ pais: string }>).map((p) => p.pais).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const estados = Array.from(new Set(((estadosRaw ?? []) as Array<{ estado: string }>).map((e) => e.estado).filter(Boolean))).sort();
  const totalPaginas = Math.max(1, Math.ceil((totalFiltrado ?? 0) / POR_PAGINA));

  // Propostas, follow-ups e prazos só dos clientes desta página.
  const ids = clientes.map((c) => c.id);
  const responsavelIds = Array.from(new Set(clientes.map((c) => c.responsavel_id).filter((id): id is string => !!id)));
  const camposProposta = "id, cliente_id, tipo, status, valor_total, moeda, atualizado_em, validade_proposta";
  const consultaPropostas = (campos: string) =>
    supabase.from("propostas").select(campos).in("cliente_id", ids).is("deleted_at", null).limit(2000);
  const [propostasBase, responsaveisResult, prazosResult] = await Promise.all([
    ids.length ? consultaPropostas(`${camposProposta}, papel, proposta_principal_id, retomada_prevista`) : Promise.resolve({ data: [], error: null }),
    responsavelIds.length ? supabase.from("usuarios").select("id, nome").in("id", responsavelIds) : Promise.resolve({ data: [] }),
    supabase.from("configuracoes_inatividade_proposta").select("tipo, dias_alerta"),
  ]);
  const propostasResult = propostasBase.error ? await consultaPropostas(camposProposta) : propostasBase;
  const propostas = (propostasResult.data ?? []) as PropostaMini[];
  const followupsPartes = await Promise.all(
    emPartes(propostas.map((p) => p.id)).map((lote) =>
      supabase.from("followups").select("proposta_id, data_contato, proxima_acao_data, proxima_acao_tipo, proxima_acao_notas, criado_em").in("proposta_id", lote))
  );
  const followups = (followupsPartes.flatMap((r: { data: FollowupResumo[] | null }) => r.data ?? []) as FollowupResumo[])
    .sort((a, b) => b.data_contato.localeCompare(a.data_contato) || b.criado_em.localeCompare(a.criado_em));
  const acompanhamentos = montarAcompanhamentos(followups);
  const prazos = new Map<string, number>(((prazosResult.error ? [] : prazosResult.data ?? []) as Array<{ tipo: string; dias_alerta: number }>).map((p) => [p.tipo, p.dias_alerta]));
  const responsaveis = new Map<string, string>(((responsaveisResult.data ?? []) as Array<{ id: string; nome: string }>).map((u) => [u.id, u.nome]));

  const metricas = new Map<string, Metricas>();
  for (const id of ids) {
    const doCliente = propostas.filter((p) => p.cliente_id === id);
    const reais = calcularIndicadores(doCliente.filter((p) => p.moeda !== "USD"));
    const dolar = calcularIndicadores(doCliente.filter((p) => p.moeda === "USD"));
    const alertas = doCliente.map((p): Alertas => calcularAlertas(p, acompanhamentos.get(p.id), prazos));
    const movimentos = doCliente.map((p) => ultimaMovimentacao(p, acompanhamentos.get(p.id)));
    metricas.set(id, {
      total: doCliente.length,
      abertas: doCliente.filter((p) => STATUS_ABERTOS.has(p.status)).length,
      ganhas: doCliente.filter((p) => p.status === "vendida").length,
      perdidas: doCliente.filter((p) => ["perdida", "desistencia", "cancelada"].includes(p.status)).length,
      complementares: doCliente.filter((p) => p.papel === "complementar").length,
      valorApresentado: reais.valorApresentado, valorApresentadoUsd: dolar.valorApresentado,
      funil: reais.funilAtivo, funilUsd: dolar.funilAtivo,
      ultimaMov: movimentos.length ? movimentos.sort((a, b) => b.localeCompare(a))[0] : null,
      alertas: {
        atrasado: alertas.filter((a) => a.atrasado).length, semAcao: alertas.filter((a) => a.semAcao).length,
        parado: alertas.filter((a) => a.parado).length, vencendo: alertas.filter((a) => a.vencendo).length,
      },
    });
  }

  const href = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const atuais: Record<string, string | undefined> = { ...searchParams, ...extra };
    for (const [k, v] of Object.entries(atuais)) if (v) params.set(k, v);
    return params.toString() ? `/clientes?${params}` : "/clientes";
  };
  const temFiltro = Boolean(searchParams.q || searchParams.status || searchParams.segmento || searchParams.porte || searchParams.pais || searchParams.estado || searchParams.cidade);
  const filtroFisico = { ...searchParams, pagina: undefined };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{total ?? 0} cadastrados{(exterior ?? 0) > 0 ? ` · ${exterior} no exterior` : ""}</p>
        </div>
        <Link href="/clientes/novo" className="max-sm:w-full">
          <Button className="h-9 w-full gap-1.5 bg-[#2C4F79] text-sm text-white hover:bg-[#1E3A5F]"><Plus className="h-4 w-4" />Novo cliente</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: total ?? 0, sub: "cadastrados" },
          { label: "Ativos", value: ativos ?? 0, sub: "com proposta recente", color: "text-[#16A34A]" },
          { label: "Prospects", value: prospects ?? 0, sub: "em prospecção", color: "text-[#D97706]" },
          { label: "Inativos", value: inativos ?? 0, sub: "+24 meses sem pedido", color: "text-[#6B7B8D]" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            <p className={`text-2xl font-bold tracking-tight ${kpi.color ?? "text-foreground"}`}>{kpi.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <form method="get" className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
        {searchParams.modo && <input type="hidden" name="modo" value={searchParams.modo} />}
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={searchParams.q} placeholder="Razão social, fantasia, CNPJ/CPF, cidade, estado ou país..." className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[12px] outline-none focus:border-[#2074B9]" />
        </div>
        <select name="pais" aria-label="País" defaultValue={searchParams.pais ?? ""} className={selectCls}>
          <option value="">Todos os países</option>
          {paises.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select name="estado" aria-label="Estado" defaultValue={searchParams.estado ?? ""} className={selectCls}>
          <option value="">Todos os estados</option>
          {estados.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input name="cidade" defaultValue={searchParams.cidade} placeholder="Cidade" className="h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[#2074B9]" />
        <select name="status" aria-label="Status" defaultValue={searchParams.status ?? ""} className={selectCls}>
          <option value="">Todos os status</option>
          <option value="prospect">Prospect</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
        <select name="segmento" aria-label="Segmento" defaultValue={searchParams.segmento ?? ""} className={selectCls}>
          <option value="">Todos os segmentos</option>
          <option value="transformador">Transformador</option>
          <option value="reciclador">Reciclador</option>
          <option value="industria">Indústria</option>
          <option value="outro">Outro</option>
        </select>
        <select name="porte" aria-label="Porte" defaultValue={searchParams.porte ?? ""} className={selectCls}>
          <option value="">Todos os portes</option>
          <option value="grande">Grande (A)</option>
          <option value="medio">Médio (B)</option>
          <option value="pequeno">Pequeno (C)</option>
        </select>
        <select name="ordem" aria-label="Ordenar por" defaultValue={searchParams.ordem ?? "nome"} className={selectCls}>
          {Object.entries(ORDENS).map(([k, o]) => <option key={k} value={k}>Ordenar: {o.rotulo}</option>)}
        </select>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <button type="submit" className="h-9 flex-1 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-medium text-white hover:bg-[#1E3A5F]">Filtrar</button>
          {(temFiltro || searchParams.ordem) && <Link href={modo === "cards" ? "/clientes?modo=cards" : "/clientes"} className="flex h-9 items-center rounded-lg border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground">Limpar</Link>}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted-foreground">
          {totalFiltrado ?? 0} {(totalFiltrado ?? 0) === 1 ? "cliente encontrado" : "clientes encontrados"}{totalPaginas > 1 ? ` · página ${pagina} de ${totalPaginas}` : ""}
        </p>
        <div className="flex overflow-hidden rounded-lg border border-border">
          <Link href={href({ ...filtroFisico, modo: undefined })} className={`flex h-8 items-center gap-1.5 border-r border-border px-3 text-[12px] font-medium ${modo === "tabela" ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}><Rows3 className="h-3.5 w-3.5" />Tabela</Link>
          <Link href={href({ ...filtroFisico, modo: "cards" })} className={`flex h-8 items-center gap-1.5 px-3 text-[12px] font-medium ${modo === "cards" ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}><LayoutGrid className="h-3.5 w-3.5" />Cards</Link>
        </div>
      </div>

      {!clientes.length ? (
        <div className="rounded-xl border border-border bg-card px-4 py-16 text-center text-sm text-muted-foreground">
          <Building2 className="mx-auto mb-3 h-8 w-8 opacity-20" />
          Nenhum cliente encontrado
        </div>
      ) : (
        <>
          {modo === "tabela" && (
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    {["Cliente", "Local", "Responsável", "Propostas", "Em aberto", "Ganhas / perdidas", "Valor apresentado", "Última movimentação", "Alertas", ""].map((h) => (
                      <th key={h} className="whitespace-nowrap border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, i) => {
                    const m = metricas.get(c.id)!;
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-3">
                          <Link href={`/clientes/${c.id}`} className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${avatarCores[i % avatarCores.length]} text-[11px] font-bold text-white`}>{getInitials(c.razao_social)}</div>
                            <div className="min-w-0">
                              <p className="max-w-[240px] truncate text-[13px] font-semibold text-foreground">{c.razao_social}</p>
                              <p className="font-mono text-[11px] text-muted-foreground">{c.cnpj ? formatCNPJ(c.cnpj) : "—"}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-muted-foreground">{[c.cidade, c.estado].filter(Boolean).join(" · ") || "—"}{c.pais && c.pais !== "Brasil" ? <span className="block text-[11px]">{c.pais}</span> : null}</td>
                        <td className="px-3 py-3 text-[12px] text-foreground">{c.responsavel_id ? responsaveis.get(c.responsavel_id) ?? "—" : "—"}</td>
                        <td className="px-3 py-3 text-[12px]">{m.total}{m.complementares > 0 && <span className="block text-[10px] text-purple-700">{m.complementares} complementar{m.complementares > 1 ? "es" : ""}</span>}</td>
                        <td className="px-3 py-3 text-[12px] font-semibold">{m.abertas}</td>
                        <td className="px-3 py-3 text-[12px]"><span className="text-green-700">{m.ganhas}</span> / <span className="text-red-700">{m.perdidas}</span></td>
                        <td className="px-3 py-3 font-mono text-[12px]">{formatCurrency(m.valorApresentado)}{m.valorApresentadoUsd > 0 ? <span className="block text-[11px]">+ {formatCurrency(m.valorApresentadoUsd, "USD")}</span> : null}</td>
                        <td className="px-3 py-3 text-[12px] text-muted-foreground">{m.ultimaMov ? formatDate(m.ultimaMov) : "—"}</td>
                        <td className="px-3 py-3"><AlertasCliente alertas={m.alertas} /></td>
                        <td className="px-3 py-3">
                          <Link href={`/propostas/gerar-numero?cliente_id=${c.id}`} title="Gerar número de proposta" className="flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted/40"><FileText className="h-3.5 w-3.5 text-muted-foreground" /></Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 ${modo === "tabela" ? "md:hidden" : ""}`}>
            {clientes.map((c, i) => {
              const m = metricas.get(c.id)!;
              return (
                <Link key={c.id} href={`/clientes/${c.id}`} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${avatarCores[i % avatarCores.length]} text-[12px] font-bold text-white`}>{getInitials(c.razao_social)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-foreground">{c.razao_social}</p>
                      {c.nome_fantasia && c.nome_fantasia !== c.razao_social && <p className="truncate text-[11px] text-muted-foreground">{c.nome_fantasia}</p>}
                      <p className="font-mono text-[11px] text-muted-foreground">{c.cnpj ? formatCNPJ(c.cnpj) : "Sem CNPJ/CPF"}</p>
                    </div>
                    <StatusClienteBadge status={c.status} />
                  </div>
                  <p className="flex items-center gap-1 text-[12px] text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{[c.cidade, c.estado, c.pais && c.pais !== "Brasil" ? c.pais : null].filter(Boolean).join(" · ") || "Local não informado"}</p>
                  <div className="flex flex-wrap items-center gap-1.5"><SegmentoBadge segmento={c.segmento} /><ClassBadge porte={c.porte} /></div>
                  <div className="grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
                    {[["Propostas", m.total], ["Abertas", m.abertas], ["Ganhas", m.ganhas], ["Perdidas", m.perdidas]].map(([rot, val]) => (
                      <div key={rot as string}><p className="text-[15px] font-bold text-foreground">{val}</p><p className="text-[10px] text-muted-foreground">{rot}</p></div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground">{formatCurrency(m.valorApresentado)}{m.valorApresentadoUsd > 0 ? ` + ${formatCurrency(m.valorApresentadoUsd, "USD")}` : ""}</span>
                    <span>{m.ultimaMov ? `Mov.: ${formatDate(m.ultimaMov)}` : "Sem movimentação"}</span>
                  </div>
                  {m.complementares > 0 && <p className="text-[10px] font-semibold text-purple-700">{m.complementares} proposta{m.complementares > 1 ? "s complementares" : " complementar"} inclusa{m.complementares > 1 ? "s" : ""} no valor</p>}
                  <AlertasCliente alertas={m.alertas} />
                </Link>
              );
            })}
          </div>

          {totalPaginas > 1 && (
            <nav className="flex items-center justify-between gap-2" aria-label="Paginação">
              {pagina > 1 ? <Link href={href({ pagina: String(pagina - 1) })} className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-[12px] font-medium"><ChevronLeft className="h-4 w-4" />Anterior</Link> : <span />}
              <span className="text-[12px] text-muted-foreground">Página {pagina} de {totalPaginas}</span>
              {pagina < totalPaginas ? <Link href={href({ pagina: String(pagina + 1) })} className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-[12px] font-medium">Próxima<ChevronRight className="h-4 w-4" /></Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function AlertasCliente({ alertas }: { alertas: Metricas["alertas"] }) {
  const itens = [
    { qtd: alertas.atrasado, texto: "follow-up atrasado", cls: "border-red-200 bg-red-50 text-red-700", Icone: CalendarClock },
    { qtd: alertas.semAcao, texto: "sem próxima ação", cls: "border-amber-200 bg-amber-50 text-amber-700", Icone: AlertTriangle },
    { qtd: alertas.parado, texto: "sem movimentação", cls: "border-orange-200 bg-orange-50 text-orange-700", Icone: AlertTriangle },
    { qtd: alertas.vencendo, texto: "validade próxima", cls: "border-yellow-300 bg-yellow-50 text-yellow-800", Icone: CalendarClock },
  ].filter((i) => i.qtd > 0);
  if (!itens.length) return <span className="text-[11px] text-muted-foreground">Sem alertas</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {itens.map((i) => <span key={i.texto} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${i.cls}`}><i.Icone className="h-3 w-3" />{i.qtd} {i.texto}</span>)}
    </div>
  );
}

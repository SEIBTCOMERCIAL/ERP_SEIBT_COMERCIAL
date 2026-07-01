import type { Metadata } from "next";
import Link from "next/link";
import { Plus, List, Kanban, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { PropostaStatusBadge, PropostaTipoBadge, TemperaturaBadge } from "@/components/propostas/StatusBadge";
import { KanbanBoard } from "@/components/propostas/KanbanBoard";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Propostas" };

interface SearchParams {
  view?: string;
  q?: string;
  status?: string;
  tipo?: string;
  responsavel?: string;
}

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const isKanban = searchParams.view === "kanban";

  // Counts por status para o stats strip
  const statusList = [
    "rascunho", "elaboracao", "aguardando_precificacao",
    "enviada", "em_negociacao", "vendida", "perdida",
  ] as const;

  const [{ count: total }, ...statusCounts] = await Promise.all([
    supabase.from("propostas").select("*", { count: "exact", head: true }).is("deleted_at", null),
    ...statusList.map((s) =>
      supabase.from("propostas").select("*", { count: "exact", head: true })
        .is("deleted_at", null).eq("status", s)
    ),
  ]);

  const statStrip = statusList.map((s, i) => ({ status: s, count: statusCounts[i].count ?? 0 }));

  // Stats visuais (labels curtos)
  const statLabels: Record<string, string> = {
    rascunho: "Rascunho", elaboracao: "Elaboração",
    aguardando_precificacao: "Aguardando", enviada: "Enviada",
    em_negociacao: "Negociação", vendida: "Vendida", perdida: "Perdida",
  };
  const statColors: Record<string, string> = {
    rascunho: "#6B7B8D", elaboracao: "#6B7B8D",
    aguardando_precificacao: "#7C3AED", enviada: "#2074B9",
    em_negociacao: "#D97706", vendida: "#16A34A", perdida: "#DC2626",
  };

  // ── KANBAN VIEW ──────────────────────────────────────────────────────────
  if (isKanban) {
    const { data: etapas } = await supabase
      .from("etapas_funil")
      .select("id, nome, cor, ordem")
      .eq("ativo", true)
      .order("ordem");

    let kanbanQuery = supabase
      .from("propostas")
      .select("id, numero_completo, tipo, status, temperatura, valor_total, etapa_funil_id, cliente_id, responsavel_id")
      .is("deleted_at", null)
      .not("status", "in", '("vendida","perdida","desistencia")');

    if (searchParams.status) kanbanQuery = kanbanQuery.eq("status", searchParams.status);
    if (searchParams.responsavel) kanbanQuery = kanbanQuery.eq("responsavel_id", searchParams.responsavel);

    const { data: propostasRaw } = await kanbanQuery;
    const propostas = (propostasRaw ?? []) as Array<{
      id: string; numero_completo: string; tipo: string; status: string;
      temperatura: string | null; valor_total: number | null;
      etapa_funil_id: string | null; cliente_id: string | null; responsavel_id: string | null;
    }>;

    // Busca clientes e responsáveis
    const clienteIds = Array.from(new Set(propostas.map((p) => p.cliente_id).filter((id): id is string => !!id)));
    const responsavelIds = Array.from(new Set(propostas.map((p) => p.responsavel_id).filter((id): id is string => !!id)));

    const [{ data: clientesR }, { data: responsaveisR }] = await Promise.all([
      clienteIds.length ? supabase.from("clientes").select("id, razao_social").in("id", clienteIds) : { data: [] },
      responsavelIds.length ? supabase.from("usuarios").select("id, nome").in("id", responsavelIds) : { data: [] },
    ]);

    const clientesMap = new Map<string, string>((clientesR ?? []).map((c: { id: string; razao_social: string }) => [c.id, c.razao_social]));
    const responsaveisMap = new Map<string, string>((responsaveisR ?? []).map((u: { id: string; nome: string }) => [u.id, u.nome]));

    const enriched = propostas.map((p) => ({
      ...p,
      cliente_nome: p.cliente_id ? (clientesMap.get(p.cliente_id) ?? null) : null,
      responsavel_nome: p.responsavel_id ? (responsaveisMap.get(p.responsavel_id) ?? null) : null,
    }));

    const etapasList = (etapas ?? []) as Array<{ id: string; nome: string; cor: string; ordem: number }>;
    const colunas = etapasList.map((e) => ({
      ...e,
      propostas: enriched.filter((p) => p.etapa_funil_id === e.id),
    }));
    const semEtapa = enriched.filter((p) => !p.etapa_funil_id);

    return (
      <div className="flex flex-col min-h-0 flex-1">
        <PropostasHeader total={total ?? 0} isKanban searchParams={searchParams} />
        <KanbanBoard colunas={colunas} semEtapa={semEtapa} />
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  let query = supabase
    .from("propostas")
    .select("id, numero_completo, tipo, status, temperatura, valor_total, moeda, criado_em, cliente_id, responsavel_id, canal_origem")
    .is("deleted_at", null)
    .order("criado_em", { ascending: false })
    .limit(80);

  if (searchParams.q) {
    query = query.or(`numero_completo.ilike.%${searchParams.q}%`);
  }
  if (searchParams.status) query = query.eq("status", searchParams.status);
  if (searchParams.tipo)   query = query.eq("tipo", searchParams.tipo);
  if (searchParams.responsavel) query = query.eq("responsavel_id", searchParams.responsavel);

  const { data: propostasRaw } = await query;
  const propostas = (propostasRaw ?? []) as Array<{
    id: string; numero_completo: string; tipo: string; status: string;
    temperatura: string | null; valor_total: number | null; moeda: string;
    criado_em: string; cliente_id: string | null; responsavel_id: string | null;
    canal_origem: string | null;
  }>;

  const clienteIds = Array.from(new Set(propostas.map((p) => p.cliente_id).filter((id): id is string => !!id)));
  const responsavelIds = Array.from(new Set(propostas.map((p) => p.responsavel_id).filter((id): id is string => !!id)));

  const [{ data: clientesR }, { data: responsaveisR }] = await Promise.all([
    clienteIds.length ? supabase.from("clientes").select("id, razao_social").in("id", clienteIds) : { data: [] },
    responsavelIds.length ? supabase.from("usuarios").select("id, nome").in("id", responsavelIds) : { data: [] },
  ]);

  const clientesMap = new Map<string, string>((clientesR ?? []).map((c: { id: string; razao_social: string }) => [c.id, c.razao_social]));
  const responsaveisMap = new Map<string, string>((responsaveisR ?? []).map((u: { id: string; nome: string }) => [u.id, u.nome]));

  const { data: vendedoresR } = await supabase.from("usuarios").select("id, nome").in("perfil", ["admin", "vendedor_interno", "representante"]).eq("ativo", true);
  const vendedores = (vendedoresR ?? []) as Array<{ id: string; nome: string }>;

  return (
    <div className="p-6 flex flex-col gap-5">
      <PropostasHeader total={total ?? 0} isKanban={false} searchParams={searchParams} />

      {/* Stats strip */}
      <div className="flex bg-card border border-border rounded-xl overflow-hidden">
        {statStrip.map(({ status, count }) => (
          <Link
            key={status}
            href={`/propostas?status=${status}`}
            className={`flex-1 px-4 py-3 text-center border-r border-border last:border-r-0 hover:bg-muted/40 transition-colors ${
              searchParams.status === status ? "bg-blue-50/60" : ""
            }`}
          >
            <p className="text-[18px] font-bold text-foreground" style={{ color: count > 0 ? statColors[status] : undefined }}>
              {count}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: statColors[status] }} />
              {statLabels[status]}
            </p>
          </Link>
        ))}
      </div>

      {/* Filtros */}
      <form method="get" className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 flex-wrap">
        <input type="hidden" name="view" value={searchParams.view ?? "list"} />
        <span className="text-[12px] font-semibold text-muted-foreground">Filtrar:</span>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input name="q" defaultValue={searchParams.q} placeholder="Nº proposta..." className="h-8 rounded-lg border border-border bg-background pl-7 pr-3 text-[12px] outline-none w-40" />
        </div>
        <select name="status" defaultValue={searchParams.status ?? ""} className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none">
          <option value="">Todos os status</option>
          {statusList.map((s) => <option key={s} value={s}>{statLabels[s]}</option>)}
        </select>
        <select name="tipo" defaultValue={searchParams.tipo ?? ""} className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none">
          <option value="">Todos os tipos</option>
          {["maquina","sistema","exportacao","pecas","servico","mista"].map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select name="responsavel" defaultValue={searchParams.responsavel ?? ""} className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none">
          <option value="">Todos responsáveis</option>
          {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
        </select>
        <button type="submit" className="h-8 px-3 rounded-lg bg-[#2C4F79] text-white text-[12px] font-medium hover:bg-[#1E3A5F] transition-colors">Filtrar</button>
        {(searchParams.q || searchParams.status || searchParams.tipo || searchParams.responsavel) && (
          <Link href="/propostas" className="h-8 px-3 rounded-lg border border-border bg-card text-[12px] text-muted-foreground hover:text-foreground flex items-center">Limpar</Link>
        )}
      </form>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {["Proposta", "Tipo", "Cliente", "Responsável", "Valor", "Status", "Temp.", "Data"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!propostas.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  Nenhuma proposta encontrada
                </td>
              </tr>
            ) : (
              propostas.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/propostas/${p.id}`} className="font-mono text-[13px] font-bold text-[#2074B9] hover:underline">
                      {p.numero_completo}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><PropostaTipoBadge tipo={p.tipo} /></td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-foreground">
                      {p.cliente_id ? (clientesMap.get(p.cliente_id) ?? "—") : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.responsavel_id ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-[#2074B9] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                          {getInitials(responsaveisMap.get(p.responsavel_id) ?? "?").slice(0, 1)}
                        </div>
                        <span className="text-[12px] text-foreground">{responsaveisMap.get(p.responsavel_id) ?? "—"}</span>
                      </div>
                    ) : <span className="text-[12px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-foreground">
                    {p.valor_total ? formatCurrency(p.valor_total, p.moeda === "USD" ? "USD" : "BRL") : "—"}
                  </td>
                  <td className="px-4 py-3"><PropostaStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3"><TemperaturaBadge temperatura={p.temperatura} /></td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground">{formatDate(p.criado_em)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {propostas.length > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <p className="text-[12px] text-muted-foreground">Mostrando {propostas.length} de {total} propostas</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PropostasHeader({
  total, isKanban, searchParams,
}: {
  total: number;
  isKanban: boolean;
  searchParams: SearchParams;
}) {
  const params = new URLSearchParams({
    ...(searchParams.q ? { q: searchParams.q } : {}),
    ...(searchParams.status ? { status: searchParams.status } : {}),
    ...(searchParams.tipo ? { tipo: searchParams.tipo } : {}),
    ...(searchParams.responsavel ? { responsavel: searchParams.responsavel } : {}),
  });
  const listUrl = `/propostas?${params.toString()}`;
  const kanbanUrl = `/propostas?view=kanban&${params.toString()}`;

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Propostas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{total} no total</p>
      </div>
      <div className="flex items-center gap-2">
        {/* Toggle lista / kanban */}
        <div className="flex border border-border rounded-lg overflow-hidden">
          <Link
            href={listUrl}
            className={`w-8 h-8 flex items-center justify-center transition-colors ${!isKanban ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <List className="h-4 w-4" />
          </Link>
          <Link
            href={kanbanUrl}
            className={`w-8 h-8 flex items-center justify-center transition-colors border-l border-border ${isKanban ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <Kanban className="h-4 w-4" />
          </Link>
        </div>
        <Link href="/propostas/nova">
          <Button className="bg-[#2C4F79] hover:bg-[#1E3A5F] text-white h-9 text-sm gap-1.5">
            <Plus className="h-4 w-4" />
            Nova Proposta
          </Button>
        </Link>
      </div>
    </div>
  );
}

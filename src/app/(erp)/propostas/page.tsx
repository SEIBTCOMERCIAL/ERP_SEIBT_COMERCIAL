import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, ChevronDown, CircleDollarSign, Kanban, List, Plus, Search, TrendingUp, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCNPJ, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { PropostaStatusBadge, PropostaTipoBadge, TemperaturaBadge } from "@/components/propostas/StatusBadge";
import { KanbanBoard } from "@/components/propostas/KanbanBoard";
import { Button } from "@/components/ui/button";
import {
  DIAS_ALERTA_VALIDADE, DIAS_SEM_MOVIMENTACAO_PADRAO, STATUS_ABERTOS, STATUS_EM_ACOMPANHAMENTO, STATUS_ENCERRADOS,
  STATUS_LABELS, STATUS_LISTA, TIPOS_PROPOSTA, TIPO_LABELS, calcularIndicadores, mercadoDe, negocioDe,
} from "@/lib/propostas/crm";

export const metadata: Metadata = { title: "Propostas" };

interface SearchParams {
  view?: string;
  q?: string;
  status?: string;
  situacao?: string;
  tipo?: string;
  mercado?: string;
  responsavel?: string;
  representante?: string;
  temperatura?: string;
  alerta?: string;
}

/** Parâmetros de filtro: os mesmos nas três visões (Clientes, Propostas e Funil). */
const FILTROS = ["q", "status", "situacao", "tipo", "mercado", "responsavel", "representante", "temperatura", "alerta"] as const;

type PropostaResumo = {
  id: string; numero_completo: string; tipo: string; status: string;
  temperatura: string | null; valor_total: number | null; moeda: string;
  criado_em: string; atualizado_em: string; validade_proposta: string | null;
  cliente_id: string | null; responsavel_id: string | null;
  representante_id: string | null; etapa_funil_id: string | null; canal_origem: string | null;
  mercado?: "nacional" | "exportacao" | null; pais_destino?: string | null;
  papel?: "principal" | "complementar" | null; proposta_principal_id?: string | null;
  retomada_prevista?: string | null;
};

type ClienteResumo = {
  id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null;
  cidade: string | null; estado: string | null; responsavel_id: string | null; representante_id: string | null;
};

type FollowupResumo = {
  proposta_id: string; data_contato: string; proxima_acao_data: string | null;
  proxima_acao_tipo: string | null; proxima_acao_notas: string | null; criado_em: string;
};

type Acompanhamento = { ultimoContato: FollowupResumo | null; proximaAcao: FollowupResumo | null };

type Alertas = { atrasado: boolean; parado: boolean; vencendo: boolean; semAcao: boolean };

const CAMPOS_BASE = "id, numero_completo, tipo, status, temperatura, valor_total, moeda, criado_em, atualizado_em, validade_proposta, cliente_id, responsavel_id, representante_id, etapa_funil_id, canal_origem";
const CAMPOS_CRM = "mercado, pais_destino, papel, proposta_principal_id, retomada_prevista";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function diasDesde(data: string) { return Math.floor((Date.now() - new Date(data).getTime()) / 86_400_000); }
function diasAte(data: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${data}T00:00:00`).getTime() - hoje.getTime()) / 86_400_000);
}
function soDigitos(v: string | null | undefined) { return (v ?? "").replace(/\D/g, ""); }
/** Em listas grandes, o filtro "in" vai em partes para não estourar o tamanho da consulta. */
function emPartes<T>(lista: T[], tamanho = 150) {
  const partes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho));
  return partes;
}

function buildAcompanhamentos(followups: FollowupResumo[]) {
  const map = new Map<string, Acompanhamento>();
  for (const followup of followups) {
    const current = map.get(followup.proposta_id) ?? { ultimoContato: null, proximaAcao: null };
    if (!current.ultimoContato) current.ultimoContato = followup;
    if (!current.proximaAcao && followup.proxima_acao_data) current.proximaAcao = followup;
    map.set(followup.proposta_id, current);
  }
  return map;
}

/** Última movimentação: o mais recente entre o último contato registrado e a última alteração da proposta. */
function ultimaMovimentacao(p: PropostaResumo, acomp?: Acompanhamento) {
  const contato = acomp?.ultimoContato?.data_contato;
  if (!contato) return p.atualizado_em;
  return new Date(contato).getTime() > new Date(p.atualizado_em).getTime() ? contato : p.atualizado_em;
}

function calcularAlertas(p: PropostaResumo, acomp: Acompanhamento | undefined, prazos: Map<string, number>): Alertas {
  const semAlerta = { atrasado: false, parado: false, vencendo: false, semAcao: false };
  if (!STATUS_ABERTOS.has(p.status)) return semAlerta;
  const hoje = hojeISO();
  // Congelada: o compromisso é a retomada prevista; não conta como "sem movimentação".
  if (p.status === "stand_by") {
    return { ...semAlerta, atrasado: Boolean(p.retomada_prevista && p.retomada_prevista < hoje) };
  }
  const proxima = acomp?.proximaAcao?.proxima_acao_data ?? null;
  const prazo = prazos.get(p.tipo) ?? DIAS_SEM_MOVIMENTACAO_PADRAO;
  const validade = p.validade_proposta ? diasAte(p.validade_proposta) : null;
  return {
    atrasado: Boolean(proxima && proxima < hoje),
    parado: diasDesde(ultimaMovimentacao(p, acomp)) >= prazo,
    vencendo: validade !== null && validade >= 0 && validade <= DIAS_ALERTA_VALIDADE,
    semAcao: STATUS_EM_ACOMPANHAMENTO.has(p.status) && !proxima,
  };
}

function matchesSituacao(proposta: PropostaResumo, situacao?: string) {
  if (!situacao) return true;
  if (situacao === "abertas") return STATUS_ABERTOS.has(proposta.status);
  if (situacao === "encerradas") return STATUS_ENCERRADOS.has(proposta.status);
  if (situacao === "negociacao") return proposta.status === "em_negociacao";
  if (situacao === "complementares") return proposta.papel === "complementar";
  if (situacao === "congeladas") return proposta.status === "stand_by";
  if (situacao === "perdidas") return proposta.status === "perdida" || proposta.status === "desistencia";
  if (situacao === "vendidas") return proposta.status === "vendida";
  return true;
}

function matchesAlerta(a: Alertas, alerta?: string) {
  if (!alerta) return true;
  if (alerta === "atrasado") return a.atrasado;
  if (alerta === "parado") return a.parado;
  if (alerta === "vencendo") return a.vencendo;
  if (alerta === "sem_acao") return a.semAcao;
  if (alerta === "qualquer") return a.atrasado || a.parado || a.vencendo || a.semAcao;
  return true;
}

function filterPropostas(
  propostas: PropostaResumo[], clientes: Map<string, ClienteResumo>, alertas: Map<string, Alertas>, sp: SearchParams
) {
  const term = sp.q?.trim().toLocaleLowerCase("pt-BR");
  const termDigitos = soDigitos(sp.q);
  return propostas.filter((proposta) => {
    const cliente = proposta.cliente_id ? clientes.get(proposta.cliente_id) : null;
    if (term) {
      const texto = [proposta.numero_completo, cliente?.razao_social, cliente?.nome_fantasia, cliente?.cnpj, cliente?.cidade]
        .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      const porCnpj = termDigitos.length >= 3 && soDigitos(cliente?.cnpj).includes(termDigitos);
      if (!texto.includes(term) && !porCnpj) return false;
    }
    if (sp.status && proposta.status !== sp.status) return false;
    if (!matchesSituacao(proposta, sp.situacao)) return false;
    if (sp.tipo && proposta.tipo !== sp.tipo) return false;
    if (sp.mercado && mercadoDe(proposta) !== sp.mercado) return false;
    if (sp.responsavel && proposta.responsavel_id !== sp.responsavel) return false;
    if (sp.representante && proposta.representante_id !== sp.representante) return false;
    if (sp.temperatura && proposta.temperatura !== sp.temperatura) return false;
    if (!matchesAlerta(alertas.get(proposta.id)!, sp.alerta)) return false;
    return true;
  });
}

/** Indicadores em reais; propostas em dólar são somadas à parte (não há câmbio gravado na proposta). */
function indicadoresPorMoeda(propostas: PropostaResumo[]) {
  const reais = calcularIndicadores(propostas.filter((p) => p.moeda !== "USD"));
  const dolar = calcularIndicadores(propostas.filter((p) => p.moeda === "USD"));
  const todas = calcularIndicadores(propostas);
  return { reais, dolar, conversao: todas.taxaConversao, ganhos: todas.negociosGanhos, perdidos: todas.negociosPerdidos, negociosAbertos: todas.negociosAbertos };
}

export default async function PropostasPage({ searchParams }: { searchParams: SearchParams }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const view = searchParams.view === "list" || searchParams.view === "kanban" ? searchParams.view : "clientes";

  const consultaPropostas = (campos: string) => supabase.from("propostas")
    .select(campos, { count: "exact" })
    .is("deleted_at", null).order("criado_em", { ascending: false }).limit(1000);

  const [propostasResult, vendedoresResult, etapasResult, prazosResult, representantesResult] = await Promise.all([
    consultaPropostas(`${CAMPOS_BASE}, ${CAMPOS_CRM}`),
    supabase.from("usuarios").select("id, nome").in("perfil", ["admin", "vendedor_interno", "representante"]).eq("ativo", true).order("nome"),
    supabase.from("etapas_funil").select("id, nome, cor, ordem").eq("ativo", true).order("ordem"),
    supabase.from("configuracoes_inatividade_proposta").select("tipo, dias_alerta"),
    supabase.from("representantes").select("id, nome, ativo").order("nome"),
  ]);

  // Mantém a tela funcional antes de o arquivo 022 ser aplicado no banco real.
  const propostasFinal = propostasResult.error ? await consultaPropostas(CAMPOS_BASE) : propostasResult;
  const { data: propostasRaw, count: total } = propostasFinal;

  const propostas = (propostasRaw ?? []) as PropostaResumo[];
  const vendedores = (vendedoresResult.data ?? []) as Array<{ id: string; nome: string }>;
  const etapas = (etapasResult.data ?? []) as Array<{ id: string; nome: string; cor: string; ordem: number }>;
  const representantesTodos = (representantesResult.data ?? []) as Array<{ id: string; nome: string; ativo: boolean }>;
  const clienteIds = Array.from(new Set(propostas.map((p) => p.cliente_id).filter((id): id is string => Boolean(id))));
  const propostaIds = propostas.map((p) => p.id);

  const [clientesPartes, followupsPartes] = await Promise.all([
    Promise.all(emPartes(clienteIds).map((ids) =>
      supabase.from("clientes").select("id, razao_social, nome_fantasia, cnpj, cidade, estado, responsavel_id, representante_id").in("id", ids))),
    Promise.all(emPartes(propostaIds).map((ids) =>
      supabase.from("followups").select("proposta_id, data_contato, proxima_acao_data, proxima_acao_tipo, proxima_acao_notas, criado_em").in("proposta_id", ids))),
  ]);

  const clientes = clientesPartes.flatMap((r: { data: ClienteResumo[] | null }) => r.data ?? []);
  const followups = (followupsPartes.flatMap((r: { data: FollowupResumo[] | null }) => r.data ?? []) as FollowupResumo[])
    .sort((a, b) => b.data_contato.localeCompare(a.data_contato) || b.criado_em.localeCompare(a.criado_em));
  const clientesMap = new Map(clientes.map((c) => [c.id, c]));
  const vendedoresMap = new Map(vendedores.map((v) => [v.id, v.nome]));
  const representantesMap = new Map(representantesTodos.map((r) => [r.id, r.nome]));
  const usados = new Set(propostas.map((p) => p.representante_id).filter(Boolean));
  const representantesFiltro = representantesTodos.filter((r) => r.ativo || usados.has(r.id));
  const acompanhamentos = buildAcompanhamentos(followups);
  const prazosPorTipo = new Map<string, number>(
    ((prazosResult.error ? [] : prazosResult.data ?? []) as Array<{ tipo: string; dias_alerta: number }>).map((p) => [p.tipo, p.dias_alerta])
  );
  const alertas = new Map(propostas.map((p) => [p.id, calcularAlertas(p, acompanhamentos.get(p.id), prazosPorTipo)]));
  const propostasFiltradas = filterPropostas(propostas, clientesMap, alertas, searchParams);

  const ind = indicadoresPorMoeda(propostasFiltradas);
  const abertas = propostasFiltradas.filter((p) => STATUS_ABERTOS.has(p.status));
  const clientesAtivos = new Set(abertas.map((p) => p.cliente_id).filter(Boolean)).size;
  const contar = (chave: keyof Alertas) => abertas.filter((p) => alertas.get(p.id)?.[chave]).length;
  const followupsAtrasados = contar("atrasado");
  const semMovimentacao = contar("parado");
  const vencendo = contar("vencendo");
  const semAcao = contar("semAcao");
  const prazosDistintos = Array.from(new Set(TIPOS_PROPOSTA.map((t) => prazosPorTipo.get(t.value) ?? DIAS_SEM_MOVIMENTACAO_PADRAO)));
  const hintParado = prazosDistintos.length === 1 ? `há ${prazosDistintos[0]}+ dias` : "conforme prazo de cada tipo";
  const extraUsd = (v: number) => (v > 0 ? ` + ${formatCurrency(v, "USD")}` : "");

  const kpis = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <KpiCard label="Valor apresentado" value={formatCurrency(ind.reais.valorApresentado)} hint={`todas as propostas e alternativas${extraUsd(ind.dolar.valorApresentado)}`} icon={CircleDollarSign} />
      <KpiCard label="Funil ativo" value={formatCurrency(ind.reais.funilAtivo)} hint={`com todas as alternativas: ${formatCurrency(ind.reais.funilComAlternativas)}${extraUsd(ind.dolar.funilAtivo)}`} icon={CircleDollarSign} />
      <KpiCard label="Clientes ativos" value={String(clientesAtivos)} hint={`${ind.negociosAbertos} negócios em aberto`} icon={Building2} />
      <KpiCard label="Conversão" value={`${ind.conversao}%`} hint={`${ind.ganhos} ganhos · ${ind.perdidos} perdidos (por negócio)`} icon={TrendingUp} />
      <KpiCard label="Follow-ups atrasados" value={String(followupsAtrasados)} hint={semAcao ? `+ ${semAcao} sem próxima ação` : "precisam de ação"} icon={CalendarClock} alert={followupsAtrasados + semAcao > 0} />
      <KpiCard label="Sem movimentação" value={String(semMovimentacao)} hint={hintParado} icon={AlertTriangle} alert={semMovimentacao > 0} />
      <KpiCard label="Validade próxima" value={String(vencendo)} hint={`vence em até ${DIAS_ALERTA_VALIDADE} dias`} icon={CalendarClock} alert={vencendo > 0} />
    </div>
  );
  const filtros = <PropostasFilters searchParams={searchParams} view={view} vendedores={vendedores} representantes={representantesFiltro} />;
  const header = <PropostasHeader total={total ?? propostas.length} filtradas={propostasFiltradas.length} view={view} searchParams={searchParams} />;

  if (view === "kanban") {
    // O funil não duplica o negócio: só a maior alternativa aberta de cada negócio soma no total da coluna.
    const somaNoFunil = new Map<string, { id: string; valor: number }>();
    for (const p of abertas) {
      const negocio = negocioDe(p);
      const atual = somaNoFunil.get(negocio);
      if (!atual || (p.valor_total ?? 0) > atual.valor) somaNoFunil.set(negocio, { id: p.id, valor: p.valor_total ?? 0 });
    }
    const idsQueSomam = new Set(Array.from(somaNoFunil.values()).map((v) => v.id));
    const numeros = new Map(propostas.map((p) => [p.id, p.numero_completo]));
    const enriched = abertas.map((p) => ({
      ...p,
      cliente_nome: p.cliente_id ? clientesMap.get(p.cliente_id)?.razao_social ?? null : null,
      responsavel_nome: p.responsavel_id ? vendedoresMap.get(p.responsavel_id) ?? null : null,
      complementar_de: p.papel === "complementar" && p.proposta_principal_id ? numeros.get(p.proposta_principal_id) ?? "outra proposta" : null,
      soma_no_funil: idsQueSomam.has(p.id),
      alerta: alertas.get(p.id)?.atrasado ? "Follow-up atrasado" : alertas.get(p.id)?.semAcao ? "Sem próxima ação" : alertas.get(p.id)?.parado ? "Sem movimentação" : null,
    }));
    const colunas = etapas.map((etapa) => ({ ...etapa, propostas: enriched.filter((p) => p.etapa_funil_id === etapa.id) }));
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 pb-0 sm:p-6 sm:pb-0">{header}{kpis}{filtros}</div>
        <KanbanBoard colunas={colunas} semEtapa={enriched.filter((p) => !p.etapa_funil_id)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      {header}
      {kpis}
      {filtros}
      {view === "clientes" ? (
        <ClientesAgrupados propostas={propostasFiltradas} clientesMap={clientesMap} vendedoresMap={vendedoresMap} representantesMap={representantesMap} acompanhamentos={acompanhamentos} alertas={alertas} />
      ) : (
        <ListaPropostas propostas={propostasFiltradas} clientesMap={clientesMap} vendedoresMap={vendedoresMap} acompanhamentos={acompanhamentos} alertas={alertas} total={total ?? propostas.length} />
      )}
    </div>
  );
}

function KpiCard({ label, value, hint, icon: Icon, alert = false }: { label: string; value: string; hint: string; icon: typeof Building2; alert?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-3.5"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-muted-foreground">{label}</p><Icon className={`h-3.5 w-3.5 shrink-0 ${alert ? "text-red-500" : "text-[#2074B9]"}`} /></div><p className={`mt-2 text-[17px] font-bold sm:text-[18px] ${alert ? "text-red-600" : "text-foreground"}`}>{value}</p><p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p></div>;
}

function urlComFiltros(searchParams: SearchParams, view: string) {
  const params = new URLSearchParams();
  if (view !== "clientes") params.set("view", view);
  for (const chave of FILTROS) { const v = searchParams[chave]; if (v) params.set(chave, v); }
  return params.toString() ? `/propostas?${params}` : "/propostas";
}

function PropostasHeader({ total, filtradas, view, searchParams }: { total: number; filtradas: number; view: string; searchParams: SearchParams }) {
  const views = [{ id: "clientes", label: "Clientes", icon: UsersRound }, { id: "list", label: "Propostas", icon: List }, { id: "kanban", label: "Funil", icon: Kanban }];
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
      <div><h1 className="text-xl font-bold tracking-tight text-foreground">Propostas</h1><p className="mt-0.5 text-sm text-muted-foreground">CRM comercial · {filtradas === total ? `${total} propostas cadastradas` : `${filtradas} de ${total} propostas`}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 overflow-hidden rounded-lg border border-border sm:flex-none">{views.map(({ id, label, icon: Icon }) => <Link key={id} href={urlComFiltros(searchParams, id)} className={`flex h-9 flex-1 items-center justify-center gap-1.5 border-r border-border px-3 text-[12px] font-medium last:border-r-0 sm:flex-none ${view === id ? "bg-[#2C4F79] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}><Icon className="h-3.5 w-3.5" />{label}</Link>)}</div>
        <Link href="/propostas/nova" className="max-sm:w-full"><Button className="h-9 w-full gap-1.5 bg-[#2C4F79] text-sm text-white hover:bg-[#1E3A5F]"><Plus className="h-4 w-4" />Nova proposta</Button></Link>
      </div>
    </div>
  );
}

const selectCls = "h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none";

function PropostasFilters({ searchParams, view, vendedores, representantes }: { searchParams: SearchParams; view: string; vendedores: Array<{ id: string; nome: string }>; representantes: Array<{ id: string; nome: string }> }) {
  const hasFilters = FILTROS.some((chave) => Boolean(searchParams[chave]));
  return (
    <form method="get" className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-3 lg:grid-cols-5">
      {view !== "clientes" && <input type="hidden" name="view" value={view} />}
      <div className="relative col-span-2 sm:col-span-3 lg:col-span-2"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input name="q" defaultValue={searchParams.q} placeholder="Cliente, CNPJ ou nº da proposta..." className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[12px] outline-none focus:border-[#2074B9]" /></div>
      <select name="situacao" aria-label="Situação" defaultValue={searchParams.situacao ?? ""} className={selectCls}><option value="">Todas as situações</option><option value="abertas">Em aberto</option><option value="negociacao">Em negociação</option><option value="congeladas">Congeladas</option><option value="complementares">Complementares</option><option value="vendidas">Vendidas</option><option value="perdidas">Perdidas / desistência</option><option value="encerradas">Todas encerradas</option></select>
      <select name="status" aria-label="Status" defaultValue={searchParams.status ?? ""} className={selectCls}><option value="">Todos os status</option>{STATUS_LISTA.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
      <select name="tipo" aria-label="Tipo" defaultValue={searchParams.tipo ?? ""} className={selectCls}><option value="">Todos os tipos</option>{TIPOS_PROPOSTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}<option value="exportacao">{TIPO_LABELS.exportacao}</option></select>
      <select name="mercado" aria-label="Mercado" defaultValue={searchParams.mercado ?? ""} className={selectCls}><option value="">Todos os mercados</option><option value="nacional">Nacional</option><option value="exportacao">Exportação</option></select>
      <select name="responsavel" aria-label="Responsável" defaultValue={searchParams.responsavel ?? ""} className={selectCls}><option value="">Todos responsáveis</option>{vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select>
      <select name="representante" aria-label="Representante" defaultValue={searchParams.representante ?? ""} className={selectCls}><option value="">Todos representantes</option>{representantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
      <select name="temperatura" aria-label="Temperatura" defaultValue={searchParams.temperatura ?? ""} className={selectCls}><option value="">Todas temperaturas</option><option value="quente">Quente</option><option value="morna">Morna</option><option value="fria">Fria</option></select>
      <select name="alerta" aria-label="Alertas" defaultValue={searchParams.alerta ?? ""} className={selectCls}><option value="">Sem filtro de alerta</option><option value="qualquer">Com qualquer alerta</option><option value="atrasado">Follow-up atrasado</option><option value="sem_acao">Sem próxima ação</option><option value="parado">Sem movimentação</option><option value="vencendo">Validade próxima</option></select>
      <div className="col-span-2 flex gap-2 sm:col-span-1">
        <button type="submit" className="h-9 flex-1 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-medium text-white hover:bg-[#1E3A5F]">Filtrar</button>
        {hasFilters && <Link href={view === "clientes" ? "/propostas" : `/propostas?view=${view}`} className="flex h-9 items-center rounded-lg border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground">Limpar</Link>}
      </div>
    </form>
  );
}

function AlertaBadges({ lista }: { lista: Alertas[] }) {
  const n = (k: keyof Alertas) => lista.filter((a) => a[k]).length;
  const itens = [
    { qtd: n("atrasado"), texto: "follow-up atrasado", cls: "bg-red-50 text-red-700 border-red-200" },
    { qtd: n("semAcao"), texto: "sem próxima ação", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    { qtd: n("parado"), texto: "sem movimentação", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    { qtd: n("vencendo"), texto: "validade próxima", cls: "bg-yellow-50 text-yellow-800 border-yellow-200" },
  ].filter((i) => i.qtd > 0);
  if (!itens.length) return null;
  return <div className="flex flex-wrap gap-1.5">{itens.map((i) => <span key={i.texto} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${i.cls}`}>{lista.length > 1 ? `${i.qtd} ` : ""}{i.texto}</span>)}</div>;
}

function PapelBadge({ p }: { p: PropostaResumo }) {
  return <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${p.papel === "complementar" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>{p.papel === "complementar" ? "Complementar" : "Principal"}</span>;
}

function textoProximaAcao(p: PropostaResumo, acao: FollowupResumo | null | undefined) {
  if (p.status === "stand_by") return p.retomada_prevista ? `Retomar em ${formatDate(p.retomada_prevista)}` : "Congelada";
  if (acao?.proxima_acao_data) return `${formatDate(acao.proxima_acao_data)} · ${acao.proxima_acao_tipo ?? "Ação"}`;
  return STATUS_ABERTOS.has(p.status) ? "Não definida" : "—";
}

function ClientesAgrupados({ propostas, clientesMap, vendedoresMap, representantesMap, acompanhamentos, alertas }: { propostas: PropostaResumo[]; clientesMap: Map<string, ClienteResumo>; vendedoresMap: Map<string, string>; representantesMap: Map<string, string>; acompanhamentos: Map<string, Acompanhamento>; alertas: Map<string, Alertas> }) {
  const grupos = new Map<string, PropostaResumo[]>();
  for (const proposta of propostas) { const key = proposta.cliente_id ?? "sem-cliente"; grupos.set(key, [...(grupos.get(key) ?? []), proposta]); }
  const nome = (id: string) => (id === "sem-cliente" ? "ZZZ" : clientesMap.get(id)?.razao_social ?? "ZZZ");
  const ordenados = Array.from(grupos.entries()).sort(([a], [b]) => nome(a).localeCompare(nome(b), "pt-BR"));
  if (!ordenados.length) return <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-1 px-1"><p className="text-[12px] font-semibold text-foreground">{ordenados.length} clientes encontrados</p><p className="text-[11px] text-muted-foreground">Toque no cliente para ver todas as propostas</p></div>
      {ordenados.map(([clienteId, propostasCliente], index) => {
        const cliente = clienteId === "sem-cliente" ? null : clientesMap.get(clienteId) ?? null;
        const abertas = propostasCliente.filter((p) => STATUS_ABERTOS.has(p.status));
        const encerradas = propostasCliente.filter((p) => STATUS_ENCERRADOS.has(p.status));
        const ind = indicadoresPorMoeda(propostasCliente);
        const tipos = Array.from(new Set(propostasCliente.map((p) => p.tipo)));
        const temperaturas = abertas.map((p) => p.temperatura).filter(Boolean);
        const temperatura = temperaturas.includes("quente") ? "quente" : temperaturas.includes("morna") ? "morna" : temperaturas.includes("fria") ? "fria" : null;
        const ultimos = propostasCliente.map((p) => acompanhamentos.get(p.id)?.ultimoContato).filter((f): f is FollowupResumo => Boolean(f)).sort((a, b) => b.data_contato.localeCompare(a.data_contato));
        const proximas = abertas.filter((p) => p.status !== "stand_by").map((p) => acompanhamentos.get(p.id)?.proximaAcao).filter((f): f is FollowupResumo => Boolean(f?.proxima_acao_data)).sort((a, b) => (a.proxima_acao_data ?? "").localeCompare(b.proxima_acao_data ?? ""));
        const proxima = proximas[0] ?? null;
        const precisaAcao = abertas.some((p) => STATUS_EM_ACOMPANHAMENTO.has(p.status));
        const referencia = abertas[0] ?? propostasCliente[0];
        const responsavelId = referencia?.responsavel_id ?? cliente?.responsavel_id ?? null;
        const representanteId = referencia?.representante_id ?? cliente?.representante_id ?? null;
        const localidade = [cliente?.cidade, cliente?.estado].filter(Boolean).join("/");
        const alertasCliente = abertas.map((p) => alertas.get(p.id)!).filter(Boolean);
        const atrasada = Boolean(proxima?.proxima_acao_data && proxima.proxima_acao_data < hojeISO());
        const usd = (v: number) => (v > 0 ? ` + ${formatCurrency(v, "USD")}` : "");
        return (
          <details key={clienteId} open={index === 0} className="group overflow-hidden rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 hover:bg-muted/30 sm:px-5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[12px] font-bold text-[#2074B9]">{getInitials(cliente?.razao_social ?? "Sem cliente")}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="min-w-0 truncate text-[14px] font-bold text-foreground">{cliente?.razao_social ?? "Sem cliente vinculado"}</p><TemperaturaBadge temperatura={temperatura} /></div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{[cliente?.cnpj ? formatCNPJ(cliente.cnpj) : null, localidade || null].filter(Boolean).join(" · ") || "Cadastro incompleto"}</p>
                  <div className="mt-1.5"><AlertaBadges lista={alertasCliente} /></div>
                </div>
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6 lg:pl-[52px]">
                <Info rotulo="Propostas" valor={`${abertas.length} abertas · ${encerradas.length} encerradas`} detalhe={tipos.map((tipo) => TIPO_LABELS[tipo] ?? tipo).join(", ")} />
                <Info rotulo="Funil ativo" valor={formatCurrency(ind.reais.funilAtivo) + usd(ind.dolar.funilAtivo)} detalhe={ind.reais.funilComAlternativas !== ind.reais.funilAtivo ? `com alternativas: ${formatCurrency(ind.reais.funilComAlternativas)}` : "sem alternativas duplicadas"} />
                <Info rotulo="Valor apresentado" valor={formatCurrency(ind.reais.valorApresentado) + usd(ind.dolar.valorApresentado)} detalhe="todas as propostas" />
                <Info rotulo="Responsável" valor={responsavelId ? vendedoresMap.get(responsavelId) ?? "—" : "—"} detalhe={representanteId ? `Rep.: ${representantesMap.get(representanteId) ?? "—"}` : "Sem representante"} />
                <Info rotulo="Último contato" valor={ultimos[0] ? formatDate(ultimos[0].data_contato) : "Nenhum"} detalhe={ultimos[0] ? `há ${Math.max(0, diasDesde(ultimos[0].data_contato))} dias` : "nenhum follow-up"} />
                {proxima
                  ? <Info rotulo="Próxima ação" valor={formatDate(proxima.proxima_acao_data)} detalhe={proxima.proxima_acao_tipo ?? "Ação não informada"} destaque={atrasada ? "vermelho" : undefined} />
                  : <Info rotulo="Próxima ação" valor={precisaAcao ? "Não definida" : "—"} detalhe={precisaAcao ? "regularizar acompanhamento" : abertas.length ? "sem proposta em acompanhamento" : "nenhuma proposta aberta"} destaque={precisaAcao ? "amarelo" : undefined} />}
              </div>
            </summary>
            <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-[12px] font-semibold text-foreground">Todas as propostas deste cliente ({propostasCliente.length})</p>{cliente && <Link href={`/clientes/${cliente.id}`} className="flex h-8 items-center rounded-lg border border-border bg-card px-3 text-[12px] font-medium text-[#2074B9] hover:border-[#2074B9]">Ver cliente completo</Link>}</div>
              <TabelaPropostas propostas={propostasCliente} clientesMap={clientesMap} vendedoresMap={vendedoresMap} acompanhamentos={acompanhamentos} alertas={alertas} mostrarCliente={false} />
            </div>
          </details>
        );
      })}
    </div>
  );
}

function Info({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: "vermelho" | "amarelo" }) {
  const cor = destaque === "vermelho" ? "text-red-600" : destaque === "amarelo" ? "text-amber-600" : "text-foreground";
  return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p><p className={`mt-1 truncate text-[13px] font-bold ${cor}`}>{valor}</p>{detalhe && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detalhe}</p>}</div>;
}

/** Tabela no computador; no celular vira uma lista de cartões. */
function TabelaPropostas({ propostas, clientesMap, vendedoresMap, acompanhamentos, alertas, mostrarCliente }: { propostas: PropostaResumo[]; clientesMap: Map<string, ClienteResumo>; vendedoresMap: Map<string, string>; acompanhamentos: Map<string, Acompanhamento>; alertas: Map<string, Alertas>; mostrarCliente: boolean }) {
  const colunas = ["Proposta", "Tipo", "Classificação", ...(mostrarCliente ? ["Cliente"] : []), "Valor", "Status", "Último contato", "Próxima ação", "Responsável"];
  const hoje = hojeISO();
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full min-w-[920px] border-collapse">
          <thead><tr className="bg-muted/40">{colunas.map((h) => <th key={h} className="border-b border-border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody>{propostas.map((p) => {
            const acomp = acompanhamentos.get(p.id); const acao = acomp?.proximaAcao;
            const vencida = p.status === "stand_by" ? Boolean(p.retomada_prevista && p.retomada_prevista < hoje) : alertas.get(p.id)?.atrasado;
            return (
              <tr key={p.id} className="border-b border-border align-top last:border-0 hover:bg-muted/20">
                <td className="px-3 py-3"><Link href={`/propostas/${p.id}`} className="font-mono text-[12px] font-bold text-[#2074B9] hover:underline">{p.numero_completo}</Link><div className="mt-1"><AlertaBadges lista={[alertas.get(p.id)!]} /></div></td>
                <td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><PropostaTipoBadge tipo={p.tipo} /><span className="text-[10px] text-muted-foreground">{mercadoDe(p) === "exportacao" ? `Exportação${p.pais_destino ? ` · ${p.pais_destino}` : ""}` : "Nacional"}</span></div></td>
                <td className="px-3 py-3"><PapelBadge p={p} /></td>
                {mostrarCliente && <td className="px-3 py-3 text-[12px] text-foreground">{p.cliente_id ? clientesMap.get(p.cliente_id)?.razao_social ?? "—" : "Sem cliente"}</td>}
                <td className="px-3 py-3 font-mono text-[12px]">{formatCurrency(p.valor_total, p.moeda === "USD" ? "USD" : "BRL")}</td>
                <td className="px-3 py-3"><PropostaStatusBadge status={p.status} /></td>
                <td className="px-3 py-3 text-[12px] text-muted-foreground">{acomp?.ultimoContato ? formatDate(acomp.ultimoContato.data_contato) : "—"}</td>
                <td className={`px-3 py-3 text-[12px] ${vencida ? "font-semibold text-red-600" : "text-muted-foreground"}`}>{textoProximaAcao(p, acao)}</td>
                <td className="px-3 py-3 text-[12px] text-foreground">{p.responsavel_id ? vendedoresMap.get(p.responsavel_id) ?? "—" : "—"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {propostas.map((p) => {
          const acomp = acompanhamentos.get(p.id);
          return (
            <Link key={p.id} href={`/propostas/${p.id}`} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[12px] font-bold text-[#2074B9]">{p.numero_completo}</span><PropostaStatusBadge status={p.status} /></div>
              {mostrarCliente && <p className="mt-1 truncate text-[12px] font-semibold text-foreground">{p.cliente_id ? clientesMap.get(p.cliente_id)?.razao_social ?? "—" : "Sem cliente"}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5"><PropostaTipoBadge tipo={p.tipo} /><PapelBadge p={p} /><span className="text-[10px] text-muted-foreground">{mercadoDe(p) === "exportacao" ? "Exportação" : "Nacional"}</span></div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]"><span className="font-mono font-semibold text-foreground">{formatCurrency(p.valor_total, p.moeda === "USD" ? "USD" : "BRL")}</span><span className="truncate text-muted-foreground">{textoProximaAcao(p, acomp?.proximaAcao)}</span></div>
              <div className="mt-1.5"><AlertaBadges lista={[alertas.get(p.id)!]} /></div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function ListaPropostas({ propostas, clientesMap, vendedoresMap, acompanhamentos, alertas, total }: { propostas: PropostaResumo[]; clientesMap: Map<string, ClienteResumo>; vendedoresMap: Map<string, string>; acompanhamentos: Map<string, Acompanhamento>; alertas: Map<string, Alertas>; total: number }) {
  if (!propostas.length) return <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">Nenhuma proposta encontrada</div>;
  return (
    <div className="flex flex-col gap-2">
      <TabelaPropostas propostas={propostas} clientesMap={clientesMap} vendedoresMap={vendedoresMap} acompanhamentos={acompanhamentos} alertas={alertas} mostrarCliente />
      <p className="px-1 text-[12px] text-muted-foreground">Mostrando {propostas.length} de {total} propostas</p>
    </div>
  );
}

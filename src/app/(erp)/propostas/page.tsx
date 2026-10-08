import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, CircleDollarSign, Hash, Plus, Search, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { KanbanBoard, type KanbanCard, type KanbanColuna } from "@/components/propostas/KanbanBoard";
import { OrganizarPropostasBtn } from "@/components/propostas/OrganizarPropostasBtn";
import { Button } from "@/components/ui/button";
import {
  DIAS_ALERTA_VALIDADE, DIAS_SEM_MOVIMENTACAO_PADRAO, STATUS_ABERTOS, STATUS_ENCERRADOS,
  STATUS_LABELS, STATUS_LISTA, TIPOS_PROPOSTA, TIPO_LABELS, calcularIndicadores, mercadoDe, negocioDe,
} from "@/lib/propostas/crm";
import { carregarEtapas, carregarMotivos, usuarioAtual } from "@/lib/propostas/crm-servidor";
import { posicaoNoFunil, tipoEtapaDe } from "@/lib/propostas/funil";
import {
  calcularAlertas, diasAte, diasDesde, emPartes, hojeISO, montarAcompanhamentos, ultimaMovimentacao,
  type Alertas, type FollowupResumo,
} from "@/lib/propostas/alertas";

export const metadata: Metadata = { title: "Propostas" };

interface SearchParams {
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

/** Filtros da página. */
const FILTROS = ["q", "status", "situacao", "tipo", "mercado", "responsavel", "representante", "temperatura", "alerta"] as const;

/** Encerradas aparecem no quadro por este período, quando nenhuma situação é escolhida. */
const DIAS_ENCERRADAS_NO_QUADRO = 30;

type PropostaResumo = {
  id: string; numero_completo: string; tipo: string; status: string;
  temperatura: string | null; valor_total: number | null; moeda: string;
  criado_em: string; atualizado_em: string; validade_proposta: string | null;
  cliente_id: string | null; responsavel_id: string | null;
  representante_id: string | null; etapa_funil_id: string | null; canal_origem: string | null;
  descricao_livre: string | null; fechada_em: string | null;
  mercado?: "nacional" | "exportacao" | null; pais_destino?: string | null;
  papel?: "principal" | "complementar" | null; proposta_principal_id?: string | null;
  retomada_prevista?: string | null;
};

type ClienteResumo = {
  id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null;
  cidade: string | null; estado: string | null;
};

const CAMPOS_BASE = "id, numero_completo, tipo, status, temperatura, valor_total, moeda, criado_em, atualizado_em, validade_proposta, cliente_id, responsavel_id, representante_id, etapa_funil_id, canal_origem, descricao_livre, fechada_em";
const CAMPOS_CRM = "mercado, pais_destino, papel, proposta_principal_id, retomada_prevista";

const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function matchesSituacao(p: PropostaResumo, situacao?: string) {
  if (!situacao || situacao === "todas") return true;
  if (situacao === "abertas") return STATUS_ABERTOS.has(p.status);
  if (situacao === "encerradas") return STATUS_ENCERRADOS.has(p.status);
  if (situacao === "negociacao") return p.status === "em_negociacao";
  if (situacao === "complementares") return p.papel === "complementar";
  if (situacao === "congeladas") return p.status === "stand_by";
  if (situacao === "perdidas") return p.status === "perdida" || p.status === "desistencia";
  if (situacao === "vendidas") return p.status === "vendida";
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

function filtrar(
  propostas: PropostaResumo[], clientes: Map<string, ClienteResumo>, alertas: Map<string, Alertas>,
  sp: SearchParams, janelaRecente: boolean, usuarioDoRepresentante: Map<string, string | null>
) {
  const termo = sp.q?.trim().toLocaleLowerCase("pt-BR");
  const termoDigitos = soDigitos(sp.q);
  const limite = Date.now() - DIAS_ENCERRADAS_NO_QUADRO * 86_400_000;
  return propostas.filter((p) => {
    const cliente = p.cliente_id ? clientes.get(p.cliente_id) : null;
    if (termo) {
      const texto = [p.numero_completo, cliente?.razao_social, cliente?.nome_fantasia, cliente?.cnpj, cliente?.cidade, p.descricao_livre]
        .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      const porCnpj = termoDigitos.length >= 3 && soDigitos(cliente?.cnpj).includes(termoDigitos);
      if (!texto.includes(termo) && !porCnpj) return false;
    }
    if (sp.status && p.status !== sp.status) return false;
    if (!matchesSituacao(p, sp.situacao)) return false;
    if (janelaRecente && !sp.situacao && !sp.status && STATUS_ENCERRADOS.has(p.status)) {
      const fechada = p.fechada_em ? new Date(p.fechada_em).getTime() : new Date(p.atualizado_em).getTime();
      if (fechada < limite) return false;
    }
    if (sp.tipo && p.tipo !== sp.tipo) return false;
    if (sp.mercado && mercadoDe(p) !== sp.mercado) return false;
    // "Usuário": propostas que ele conduz como responsável ou que acompanha como representante.
    if (sp.responsavel) {
      const comoRepresentante = p.representante_id ? usuarioDoRepresentante.get(p.representante_id) === sp.responsavel : false;
      if (p.responsavel_id !== sp.responsavel && !comoRepresentante) return false;
    }
    if (sp.representante && p.representante_id !== sp.representante) return false;
    if (sp.temperatura && p.temperatura !== sp.temperatura) return false;
    if (!matchesAlerta(alertas.get(p.id)!, sp.alerta)) return false;
    return true;
  });
}

/** Indicadores: reais e dólares separados (a proposta não guarda a cotação usada). */
function indicadoresPorMoeda(propostas: PropostaResumo[]) {
  const reais = calcularIndicadores(propostas.filter((p) => p.moeda !== "USD"));
  const dolar = calcularIndicadores(propostas.filter((p) => p.moeda === "USD"));
  const todas = calcularIndicadores(propostas);
  return { reais, dolar, conversao: todas.taxaConversao, ganhos: todas.negociosGanhos, perdidos: todas.negociosPerdidos, negociosAbertos: todas.negociosAbertos };
}

export default async function PropostasPage({ searchParams }: { searchParams: SearchParams }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const consultaPropostas = (campos: string) => supabase.from("propostas")
    .select(campos, { count: "exact" })
    .is("deleted_at", null).order("criado_em", { ascending: false }).limit(1000);

  const [propostasResult, vendedoresResult, prazosResult, representantesResult, funil, motivos, usuario] = await Promise.all([
    consultaPropostas(`${CAMPOS_BASE}, ${CAMPOS_CRM}`),
    supabase.from("usuarios").select("id, nome").in("perfil", ["admin", "vendedor_interno", "representante"]).eq("ativo", true).order("nome"),
    supabase.from("configuracoes_inatividade_proposta").select("tipo, dias_alerta"),
    supabase.from("representantes").select("id, nome, ativo, usuario_id").order("nome"),
    carregarEtapas(supabase),
    carregarMotivos(supabase),
    usuarioAtual(supabase),
  ]);

  // Mantém a tela funcional antes de os arquivos 022 e 024 serem aplicados no banco real.
  let propostasFinal = propostasResult;
  if (propostasResult.error) {
    propostasFinal = await consultaPropostas(`${CAMPOS_BASE}, ${CAMPOS_CRM}`.replace(`, ${CAMPOS_CRM}`, ""));
  }
  const { data: propostasRaw, count: total } = propostasFinal;
  const { etapas, estruturaFunil } = funil;

  const propostas = (propostasRaw ?? []) as PropostaResumo[];
  const vendedores = (vendedoresResult.data ?? []) as Array<{ id: string; nome: string }>;
  const representantesTodos = (representantesResult.data ?? []) as Array<{ id: string; nome: string; ativo: boolean; usuario_id: string | null }>;
  const usuarioDoRepresentante = new Map(representantesTodos.map((r) => [r.id, r.usuario_id]));
  const nomeRepresentante = new Map(representantesTodos.map((r) => [r.id, r.nome]));
  const clienteIds = Array.from(new Set(propostas.map((p) => p.cliente_id).filter((id): id is string => Boolean(id))));
  const propostaIds = propostas.map((p) => p.id);

  const [clientesPartes, followupsPartes, itensPartes] = await Promise.all([
    Promise.all(emPartes(clienteIds).map((ids) =>
      supabase.from("clientes").select("id, razao_social, nome_fantasia, cnpj, cidade, estado").in("id", ids))),
    Promise.all(emPartes(propostaIds).map((ids) =>
      supabase.from("followups").select("proposta_id, data_contato, proxima_acao_data, proxima_acao_tipo, proxima_acao_notas, criado_em").in("proposta_id", ids))),
    Promise.all(emPartes(propostaIds).map((ids) =>
      supabase.from("itens_proposta").select("proposta_id, descricao, ordem").in("proposta_id", ids).order("ordem"))),
  ]);

  const clientes = clientesPartes.flatMap((r: { data: ClienteResumo[] | null }) => r.data ?? []) as ClienteResumo[];
  const followups = (followupsPartes.flatMap((r: { data: FollowupResumo[] | null }) => r.data ?? []) as FollowupResumo[])
    .sort((a, b) => b.data_contato.localeCompare(a.data_contato) || b.criado_em.localeCompare(a.criado_em));
  const itens = itensPartes.flatMap((r: { data: Array<{ proposta_id: string; descricao: string }> | null }) => r.data ?? []) as Array<{ proposta_id: string; descricao: string }>;

  // Produto cotado: primeiro item da proposta (+ quantidade de outros itens); sem itens, a descrição inicial.
  const itensPorProposta = new Map<string, string[]>();
  for (const i of itens) itensPorProposta.set(i.proposta_id, [...(itensPorProposta.get(i.proposta_id) ?? []), i.descricao]);
  const produtoDe = (p: PropostaResumo) => {
    const lista = itensPorProposta.get(p.id) ?? [];
    if (lista.length) return lista.length > 1 ? `${lista[0]} (+${lista.length - 1} ${lista.length - 1 === 1 ? "item" : "itens"})` : lista[0];
    return p.descricao_livre;
  };

  const clientesMap = new Map(clientes.map((c) => [c.id, c]));
  const vendedoresMap = new Map(vendedores.map((v) => [v.id, v.nome]));
  const usados = new Set(propostas.map((p) => p.representante_id).filter(Boolean));
  const representantesFiltro = representantesTodos.filter((r) => r.ativo || usados.has(r.id));
  const numerosPorId = new Map(propostas.map((p) => [p.id, p.numero_completo]));
  const acompanhamentos = montarAcompanhamentos(followups);
  const prazosPorTipo = new Map<string, number>(
    ((prazosResult.error ? [] : prazosResult.data ?? []) as Array<{ tipo: string; dias_alerta: number }>).map((p) => [p.tipo, p.dias_alerta])
  );
  const alertas = new Map(propostas.map((p) => [p.id, calcularAlertas(p, acompanhamentos.get(p.id), prazosPorTipo)]));

  // Indicadores não dependem da janela de 30 dias do quadro.
  const paraIndicadores = filtrar(propostas, clientesMap, alertas, searchParams, false, usuarioDoRepresentante);
  const noQuadro = filtrar(propostas, clientesMap, alertas, searchParams, true, usuarioDoRepresentante);

  const ind = indicadoresPorMoeda(paraIndicadores);
  const abertas = paraIndicadores.filter((p) => STATUS_ABERTOS.has(p.status));
  const clientesAtivos = new Set(abertas.map((p) => p.cliente_id).filter(Boolean)).size;
  const contar = (chave: keyof Alertas) => abertas.filter((p) => alertas.get(p.id)?.[chave]).length;
  const followupsAtrasados = contar("atrasado");
  const semMovimentacao = contar("parado");
  const vencendo = contar("vencendo");
  const semAcao = contar("semAcao");
  const prazosDistintos = Array.from(new Set(TIPOS_PROPOSTA.map((t) => prazosPorTipo.get(t.value) ?? DIAS_SEM_MOVIMENTACAO_PADRAO)));
  const hintParado = prazosDistintos.length === 1 ? `há ${prazosDistintos[0]}+ dias` : "conforme o prazo de cada tipo";
  const extraUsd = (v: number) => (v > 0 ? ` + ${formatCurrency(v, "USD")}` : "");

  // Resumo por situação (todas as propostas que passam nos filtros).
  const contagem = {
    principais: paraIndicadores.filter((p) => p.papel !== "complementar").length,
    complementares: paraIndicadores.filter((p) => p.papel === "complementar").length,
    ganhas: paraIndicadores.filter((p) => p.status === "vendida").length,
    perdidas: paraIndicadores.filter((p) => ["perdida", "desistencia", "cancelada"].includes(p.status)).length,
    congeladas: paraIndicadores.filter((p) => p.status === "stand_by").length,
  };
  const complementaresAbertas = abertas.filter((p) => p.papel === "complementar").length;

  // Funil: só a maior alternativa aberta de cada negócio soma no total das colunas.
  const somaNoFunil = new Map<string, { id: string; valor: number }>();
  for (const p of noQuadro.filter((x) => STATUS_ABERTOS.has(x.status))) {
    const negocio = negocioDe(p);
    const atual = somaNoFunil.get(negocio);
    if (!atual || (p.valor_total ?? 0) > atual.valor) somaNoFunil.set(negocio, { id: p.id, valor: p.valor_total ?? 0 });
  }
  const idsQueSomam = new Set(Array.from(somaNoFunil.values()).map((v) => v.id));

  const colunas: KanbanColuna[] = etapas.map((etapa) => ({ id: etapa.id, nome: etapa.nome, cor: etapa.cor, etapa, cards: [] }));
  const colunaPorEtapa = new Map(colunas.map((c) => [c.id, c]));
  const colunaSemEtapa: KanbanColuna = { id: "sem-estrutura", nome: "Propostas", cor: "#6B7B8D", etapa: null, cards: [] };
  const colunaNaoSelecionadas: KanbanColuna = { id: "complementares-nao-selecionadas", nome: "Alternativas não selecionadas", cor: "#7C3AED", etapa: null, cards: [] };
  const hoje = hojeISO();

  for (const p of noQuadro) {
    const acomp = acompanhamentos.get(p.id);
    const alerta = alertas.get(p.id)!;
    const proxima = acomp?.proximaAcao;
    const posicao = posicaoNoFunil(p, etapas);
    const card: KanbanCard = {
      id: p.id,
      numero_completo: p.numero_completo,
      tipo: p.tipo,
      status: p.status,
      temperatura: p.temperatura,
      cliente_nome: p.cliente_id ? clientesMap.get(p.cliente_id)?.razao_social ?? null : null,
      produto: produtoDe(p),
      mercado: mercadoDe(p),
      pais_destino: p.pais_destino ?? null,
      moeda: p.moeda,
      valor_total: p.valor_total,
      responsavel_nome: p.responsavel_id ? vendedoresMap.get(p.responsavel_id) ?? null : null,
      representante_nome: p.representante_id ? nomeRepresentante.get(p.representante_id) ?? null : null,
      ultima_movimentacao: ultimaMovimentacao(p, acomp),
      proxima_acao: proxima?.proxima_acao_data ? `${formatDate(proxima.proxima_acao_data)} · ${proxima.proxima_acao_tipo ?? "Ação"}` : null,
      proxima_acao_data: proxima?.proxima_acao_data ?? null,
      retomada_prevista: p.retomada_prevista ?? null,
      papel: p.papel === "complementar" ? "complementar" : "principal",
      complementar_de: p.papel === "complementar" && p.proposta_principal_id ? numerosPorId.get(p.proposta_principal_id) ?? "outra proposta" : null,
      soma_no_funil: !STATUS_ABERTOS.has(p.status) || idsQueSomam.has(p.id),
      temProximaAcao: Boolean(proxima?.proxima_acao_data && proxima.proxima_acao_data >= hoje),
      dias_parada: diasDesde(ultimaMovimentacao(p, acomp)),
      dias_validade: p.validade_proposta ? diasAte(p.validade_proposta) : null,
      atrasado: alerta.atrasado,
      parado: alerta.parado,
      vencendo: alerta.vencendo,
      semAcao: alerta.semAcao,
      automatica: posicao.automatica,
      bloqueada: posicao.bloqueada,
    };
    const coluna = p.status === "complementar_nao_selecionada"
      ? colunaNaoSelecionadas
      : posicao.etapa ? colunaPorEtapa.get(posicao.etapa.id) : null;
    (coluna ?? colunaSemEtapa).cards.push(card);
  }

  // Encerradas mais recentes primeiro nas colunas finais; as demais seguem a ordem de criação.
  for (const c of colunas) {
    const tipo = c.etapa ? tipoEtapaDe(c.etapa) : "intermediaria";
    if (tipo === "ganho" || tipo === "perda") c.cards.sort((a, b) => b.ultima_movimentacao.localeCompare(a.ultima_movimentacao));
  }
  const colunasFinais = [...colunas, ...(colunaNaoSelecionadas.cards.length ? [colunaNaoSelecionadas] : []), ...(!etapas.length || colunaSemEtapa.cards.length ? [colunaSemEtapa] : [])];
  const automaticas = noQuadro.filter((p) => posicaoNoFunil(p, etapas).automatica).length;
  const ehAdmin = usuario?.perfil === "admin";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-2">
      <div className="flex flex-col gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Propostas</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Funil comercial · {noQuadro.length === (total ?? propostas.length) ? `${noQuadro.length} propostas` : `${noQuadro.length} de ${total ?? propostas.length} propostas`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/propostas/gerar-numero" className="max-sm:flex-1">
              <Button variant="outline" className="h-9 w-full gap-1.5 text-sm"><Hash className="h-4 w-4" />Gerar número</Button>
            </Link>
            <Link href="/propostas/nova" className="max-sm:flex-1">
              <Button className="h-9 w-full gap-1.5 bg-[#2C4F79] text-sm text-white hover:bg-[#1E3A5F]"><Plus className="h-4 w-4" />Nova proposta</Button>
            </Link>
          </div>
        </div>

        {!estruturaFunil && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
            O funil configurável (etapas, arrastar e soltar, motivos e anexos) depende da atualização do banco de dados (arquivo 024), que ainda não foi aplicada. Enquanto isso, o quadro só mostra as propostas.
          </p>
        )}
        {estruturaFunil && !etapas.length && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
            Nenhuma etapa de funil cadastrada. O administrador cria as etapas em <Link href="/configuracoes" className="font-semibold underline">Configurações</Link>.
          </p>
        )}
        {ehAdmin && estruturaFunil && automaticas > 0 && (
          <OrganizarPropostasBtn quantidade={automaticas} />
        )}
        {estruturaFunil && !ehAdmin && automaticas > 0 && (
          <p className="rounded-xl border border-border bg-card p-3 text-[12px] text-muted-foreground">
            {automaticas} {automaticas === 1 ? "proposta antiga está" : "propostas antigas estão"} posicionada(s) automaticamente. O administrador pode organizá-las de forma definitiva.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Kpi label="Valor apresentado" value={formatCurrency(ind.reais.valorApresentado)} hint={`todas as propostas e alternativas${extraUsd(ind.dolar.valorApresentado)}`} icon={CircleDollarSign} />
          <Kpi label="Funil ativo" value={formatCurrency(ind.reais.funilAtivo)} hint={`com todas as alternativas: ${formatCurrency(ind.reais.funilComAlternativas)}${extraUsd(ind.dolar.funilAtivo)}`} icon={CircleDollarSign} />
          <Kpi label="Clientes ativos" value={String(clientesAtivos)} hint={`${ind.negociosAbertos} negócios em aberto`} icon={Building2} />
          <Kpi label="Conversão" value={`${ind.conversao}%`} hint={`${ind.ganhos} ganhos · ${ind.perdidos} perdidos (por negócio)`} icon={TrendingUp} />
          <Kpi label="Follow-ups atrasados" value={String(followupsAtrasados)} hint={semAcao ? `+ ${semAcao} sem próxima ação` : "precisam de ação"} icon={CalendarClock} alert={followupsAtrasados + semAcao > 0} />
          <Kpi label="Sem movimentação" value={String(semMovimentacao)} hint={hintParado} icon={AlertTriangle} alert={semMovimentacao > 0} />
          <Kpi label="Validade próxima" value={String(vencendo)} hint={`vence em até ${DIAS_ALERTA_VALIDADE} dias`} icon={CalendarClock} alert={vencendo > 0} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>Principais: <strong className="text-foreground">{contagem.principais}</strong></span>
          <span>Complementares: <strong className="text-foreground">{contagem.complementares}</strong></span>
          <span>Ganhas: <strong className="text-foreground">{contagem.ganhas}</strong></span>
          <span>Perdidas: <strong className="text-foreground">{contagem.perdidas}</strong></span>
          <span>Congeladas: <strong className="text-foreground">{contagem.congeladas}</strong></span>
          {complementaresAbertas > 0 && (
            <span className="basis-full text-purple-700">
              Inclui {complementaresAbertas} {complementaresAbertas === 1 ? "proposta complementar" : "propostas complementares"} em aberto: o &quot;Valor apresentado&quot; soma todas as alternativas; o &quot;Funil ativo&quot; e os totais das colunas contam só a maior alternativa de cada negócio.
            </span>
          )}
        </div>

        <Filtros searchParams={searchParams} vendedores={vendedores} representantes={representantesFiltro} />
      </div>

      <KanbanBoard
        colunas={colunasFinais}
        etapas={etapas}
        motivos={{ perda: motivos.ativos.perda, congelamento: motivos.ativos.congelamento }}
        podeMover={estruturaFunil && etapas.length > 0}
      />
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, alert = false }: { label: string; value: string; hint: string; icon: typeof Building2; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${alert ? "text-red-500" : "text-[#2074B9]"}`} />
      </div>
      <p className={`mt-2 text-[17px] font-bold sm:text-[18px] ${alert ? "text-red-600" : "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

const selectCls = "h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none";

function Filtros({ searchParams, vendedores, representantes }: { searchParams: SearchParams; vendedores: Array<{ id: string; nome: string }>; representantes: Array<{ id: string; nome: string }> }) {
  const temFiltro = FILTROS.some((chave) => Boolean(searchParams[chave]));
  return (
    <form method="get" className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-3 lg:grid-cols-5">
      <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input name="q" defaultValue={searchParams.q} placeholder="Cliente, CNPJ, nº ou produto..." className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[12px] outline-none focus:border-[#2074B9]" />
      </div>
      <select name="situacao" aria-label="Situação" defaultValue={searchParams.situacao ?? ""} className={selectCls}>
        <option value="">Em aberto + encerradas recentes</option>
        <option value="abertas">Somente em aberto</option>
        <option value="negociacao">Em negociação</option>
        <option value="congeladas">Congeladas</option>
        <option value="complementares">Complementares</option>
        <option value="vendidas">Vendidas</option>
        <option value="perdidas">Perdidas / desistência</option>
        <option value="encerradas">Todas encerradas</option>
        <option value="todas">Todas (sem limite de data)</option>
      </select>
      <select name="status" aria-label="Status" defaultValue={searchParams.status ?? ""} className={selectCls}>
        <option value="">Todos os status</option>
        {STATUS_LISTA.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
      </select>
      <select name="tipo" aria-label="Tipo" defaultValue={searchParams.tipo ?? ""} className={selectCls}>
        <option value="">Todos os tipos</option>
        {TIPOS_PROPOSTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        <option value="exportacao">{TIPO_LABELS.exportacao}</option>
      </select>
      <select name="mercado" aria-label="Mercado" defaultValue={searchParams.mercado ?? ""} className={selectCls}>
        <option value="">Todos os mercados</option>
        <option value="nacional">Nacional</option>
        <option value="exportacao">Exportação</option>
      </select>
      <select name="responsavel" aria-label="Responsável" defaultValue={searchParams.responsavel ?? ""} className={selectCls}>
        <option value="">Todos os usuários (responsável ou representante)</option>
        {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
      </select>
      <select name="representante" aria-label="Representante" defaultValue={searchParams.representante ?? ""} className={selectCls}>
        <option value="">Todos representantes</option>
        {representantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
      </select>
      <select name="temperatura" aria-label="Temperatura" defaultValue={searchParams.temperatura ?? ""} className={selectCls}>
        <option value="">Todas temperaturas</option>
        <option value="quente">Quente</option>
        <option value="morna">Morna</option>
        <option value="fria">Fria</option>
      </select>
      <select name="alerta" aria-label="Alertas" defaultValue={searchParams.alerta ?? ""} className={selectCls}>
        <option value="">Sem filtro de alerta</option>
        <option value="qualquer">Com qualquer alerta</option>
        <option value="atrasado">Follow-up atrasado</option>
        <option value="sem_acao">Sem próxima ação</option>
        <option value="parado">Sem movimentação</option>
        <option value="vencendo">Validade próxima</option>
      </select>
      <div className="col-span-2 flex gap-2 sm:col-span-1">
        <button type="submit" className="h-9 flex-1 rounded-lg bg-[#2C4F79] px-4 text-[12px] font-medium text-white hover:bg-[#1E3A5F]">Filtrar</button>
        {temFiltro && <Link href="/propostas" className="flex h-9 items-center rounded-lg border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground">Limpar</Link>}
      </div>
    </form>
  );
}

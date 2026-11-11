import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, CircleDollarSign, Hash, Plus, Search, TrendingUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { KanbanBoard, type KanbanCard, type KanbanColuna } from "@/components/propostas/KanbanBoard";
import { CabecalhoKanban } from "@/components/kanban/CabecalhoKanban";
import { InfoBtn } from "@/components/kanban/InfoBtn";
import { OrganizarPropostasBtn } from "@/components/propostas/OrganizarPropostasBtn";
import { Button } from "@/components/ui/button";
import {
  DIAS_ALERTA_VALIDADE, DIAS_SEM_MOVIMENTACAO_PADRAO, STATUS_ABERTOS, STATUS_ENCERRADOS,
  STATUS_LABELS, STATUS_LISTA, TIPOS_PROPOSTA, TIPO_LABELS, calcularIndicadores, mercadoDe, negocioDe,
} from "@/lib/propostas/crm";
import { carregarEtapas, carregarMotivos, usuarioAtual } from "@/lib/propostas/crm-servidor";
import { posicaoNoFunil, tipoEtapaDe } from "@/lib/propostas/funil";
import { resumoProduto, type ItemParaCabecalho } from "@/lib/propostas/item-principal";
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
    Promise.all(emPartes(propostaIds).map(async (ids) => {
      const campos = "proposta_id, descricao, ordem, produto:produtos(codigo, categoria)";
      const r = await supabase.from("itens_proposta").select(`${campos}, destaque`).in("proposta_id", ids).order("ordem");
      return r.error ? supabase.from("itens_proposta").select(campos).in("proposta_id", ids).order("ordem") : r;
    })),
  ]);

  const clientes = clientesPartes.flatMap((r: { data: ClienteResumo[] | null }) => r.data ?? []) as ClienteResumo[];
  const followups = (followupsPartes.flatMap((r: { data: FollowupResumo[] | null }) => r.data ?? []) as FollowupResumo[])
    .sort((a, b) => b.data_contato.localeCompare(a.data_contato) || b.criado_em.localeCompare(a.criado_em));
  const itens = itensPartes.flatMap((r: { data: Array<ItemParaCabecalho & { proposta_id: string }> | null }) => r.data ?? []) as Array<ItemParaCabecalho & { proposta_id: string }>;

  // Produto cotado: o item do cabeçalho (marcado, ou o moinho) + quantidade de outros itens; sem itens, a descrição inicial.
  const itensPorProposta = new Map<string, ItemParaCabecalho[]>();
  for (const i of itens) itensPorProposta.set(i.proposta_id, [...(itensPorProposta.get(i.proposta_id) ?? []), i]);
  const produtoDe = (p: PropostaResumo) => resumoProduto(itensPorProposta.get(p.id) ?? [], p.descricao_livre);

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

  const filtrosAtivos = FILTROS.filter((chave) => Boolean(searchParams[chave]));
  const filtrosAvancadosQtd = filtrosAtivos.filter((chave) => chave !== "q").length;
  const nomePorId = (lista: Array<{ id: string; nome: string }>, id?: string) => lista.find((x) => x.id === id)?.nome ?? "—";
  const rotuloFiltro = (chave: (typeof FILTROS)[number]): string => {
    const v = searchParams[chave] ?? "";
    switch (chave) {
      case "q": return `Busca: ${v}`;
      case "status": return `Status: ${STATUS_LABELS[v] ?? v}`;
      case "situacao": return `Situação: ${SITUACAO_LABELS[v] ?? v}`;
      case "tipo": return `Tipo: ${TIPO_LABELS[v] ?? v}`;
      case "mercado": return `Mercado: ${v === "exportacao" ? "Exportação" : "Nacional"}`;
      case "responsavel": return `Usuário: ${nomePorId(vendedores, v)}`;
      case "representante": return `Representante: ${nomePorId(representantesFiltro, v)}`;
      case "temperatura": return `Temperatura: ${v.charAt(0).toUpperCase()}${v.slice(1)}`;
      case "alerta": return `Alerta: ${ALERTA_LABELS[v] ?? v}`;
    }
  };
  const hrefSem = (chave: string) => {
    const params = new URLSearchParams();
    for (const c of FILTROS) if (c !== chave && searchParams[c]) params.set(c, String(searchParams[c]));
    const texto = params.toString();
    return texto ? `/propostas?${texto}` : "/propostas";
  };
  const chips = filtrosAtivos.length > 0 ? (
    <>
      {filtrosAtivos.map((chave) => (
        <Link key={chave} href={hrefSem(chave)} title="Remover este filtro"
          className="inline-flex h-7 max-w-[260px] items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs text-foreground hover:bg-muted">
          <span className="truncate">{rotuloFiltro(chave)}</span><X className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Link>
      ))}
      <Link href="/propostas" className="text-xs font-medium text-[#2074B9] hover:underline">Limpar tudo</Link>
    </>
  ) : null;

  const infoApresentado = `O valor apresentado soma todas as propostas e alternativas, inclusive as complementares do mesmo negócio.${complementaresAbertas > 0 ? ` Há ${complementaresAbertas} ${complementaresAbertas === 1 ? "proposta complementar" : "propostas complementares"} em aberto.` : ""}`;
  const infoFunil = `O funil ativo e os totais das colunas contam só a maior alternativa de cada negócio, para não duplicar valores.${complementaresAbertas > 0 ? ` Com todas as alternativas somadas: ${formatCurrency(ind.reais.funilComAlternativas)}.` : ""}`;

  const aviso = "rounded-lg border px-3 py-2 text-xs";
  const avisos = (
    <>
      {!estruturaFunil && (
        <p className={`${aviso} border-amber-200 bg-amber-50 text-amber-800`}>
          O funil configurável (etapas, arrastar e soltar, motivos e anexos) depende da atualização do banco de dados (arquivo 024), que ainda não foi aplicada. Enquanto isso, o quadro só mostra as propostas.
        </p>
      )}
      {estruturaFunil && !etapas.length && (
        <p className={`${aviso} border-amber-200 bg-amber-50 text-amber-800`}>
          Nenhuma etapa de funil cadastrada. O administrador cria as etapas em <Link href="/configuracoes" className="font-semibold underline">Configurações</Link>.
        </p>
      )}
      {ehAdmin && estruturaFunil && automaticas > 0 && <OrganizarPropostasBtn quantidade={automaticas} />}
      {estruturaFunil && !ehAdmin && automaticas > 0 && (
        <p className={`${aviso} border-border bg-card text-muted-foreground`}>
          {automaticas} {automaticas === 1 ? "proposta antiga está" : "propostas antigas estão"} posicionada(s) automaticamente. O administrador pode organizá-las de forma definitiva.
        </p>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-col lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
      <CabecalhoKanban
        chave="propostas"
        titulo="Propostas"
        contagem={noQuadro.length === (total ?? propostas.length) ? `${noQuadro.length} propostas` : `${noQuadro.length} de ${total ?? propostas.length} propostas`}
        acoes={
          <>
            <Link href="/propostas/gerar-numero">
              <Button variant="outline" className="h-9 gap-1.5 text-sm"><Hash className="h-4 w-4" />Gerar número</Button>
            </Link>
            <Link href="/propostas/nova">
              <Button className="h-9 gap-1.5 bg-[#2C4F79] text-sm text-white hover:bg-[#1E3A5F]"><Plus className="h-4 w-4" />Nova proposta</Button>
            </Link>
          </>
        }
        busca={
          <form method="get" role="search" className="relative">
            {filtrosAtivos.filter((c) => c !== "q").map((c) => <input key={c} type="hidden" name={c} value={String(searchParams[c])} />)}
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={searchParams.q} aria-label="Buscar propostas" placeholder="Cliente, CNPJ, nº ou produto..."
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-[#2074B9]" />
          </form>
        }
        filtrosQtd={filtrosAvancadosQtd}
        painelFiltros={<FiltrosPainel searchParams={searchParams} vendedores={vendedores} representantes={representantesFiltro} />}
        chips={chips}
        avisos={avisos}
        resumo={
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>Funil ativo <strong className="text-foreground">{formatCurrency(ind.reais.funilAtivo)}</strong></span>
            <span>Follow-ups atrasados <strong className={followupsAtrasados > 0 ? "text-red-600" : "text-foreground"}>{followupsAtrasados}</strong></span>
            <span>Paradas <strong className={semMovimentacao > 0 ? "text-red-600" : "text-foreground"}>{semMovimentacao}</strong></span>
          </p>
        }
        indicadores={
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              <Kpi label="Valor apresentado" value={formatCurrency(ind.reais.valorApresentado)} hint={`todas as propostas e alternativas${extraUsd(ind.dolar.valorApresentado)}`} icon={CircleDollarSign} info={infoApresentado} />
              <Kpi label="Funil ativo" value={formatCurrency(ind.reais.funilAtivo)} hint={`com todas as alternativas: ${formatCurrency(ind.reais.funilComAlternativas)}${extraUsd(ind.dolar.funilAtivo)}`} icon={CircleDollarSign} info={infoFunil} />
              <Kpi label="Clientes ativos" value={String(clientesAtivos)} hint={`${ind.negociosAbertos} negócios em aberto`} icon={Building2} />
              <Kpi label="Conversão" value={`${ind.conversao}%`} hint={`${ind.ganhos} ganhos · ${ind.perdidos} perdidos (por negócio)`} icon={TrendingUp} />
              <Kpi label="Follow-ups atrasados" value={String(followupsAtrasados)} hint={semAcao ? `+ ${semAcao} sem próxima ação` : "precisam de ação"} icon={CalendarClock} alert={followupsAtrasados + semAcao > 0} />
              <Kpi label="Sem movimentação" value={String(semMovimentacao)} hint={hintParado} icon={AlertTriangle} alert={semMovimentacao > 0} />
              <Kpi label="Validade próxima" value={String(vencendo)} hint={`vence em até ${DIAS_ALERTA_VALIDADE} dias`} icon={CalendarClock} alert={vencendo > 0} />
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Principais: <strong className="text-foreground">{contagem.principais}</strong></span>
              <span>Complementares: <strong className="text-foreground">{contagem.complementares}</strong></span>
              <span>Ganhas: <strong className="text-foreground">{contagem.ganhas}</strong></span>
              <span>Perdidas: <strong className="text-foreground">{contagem.perdidas}</strong></span>
              <span>Congeladas: <strong className="text-foreground">{contagem.congeladas}</strong></span>
            </p>
          </div>
        }
      />

      <div className="flex h-[75vh] min-h-[420px] flex-col pt-3 lg:h-auto lg:min-h-0 lg:flex-1">
        <KanbanBoard
          colunas={colunasFinais}
          etapas={etapas}
          motivos={{ perda: motivos.ativos.perda, congelamento: motivos.ativos.congelamento }}
          podeMover={estruturaFunil && etapas.length > 0}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, alert = false, info }: { label: string; value: string; hint: string; icon: typeof Building2; alert?: boolean; info?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-1">
        <p className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">{label}{info && <InfoBtn texto={info} titulo={`Como é calculado: ${label}`} />}</p>
        <Icon className={`h-4 w-4 shrink-0 ${alert ? "text-red-500" : "text-[#2074B9]"}`} />
      </div>
      <p className={`mt-1 text-lg font-bold ${alert ? "text-red-600" : "text-foreground"}`}>{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

const SITUACAO_LABELS: Record<string, string> = {
  abertas: "Somente em aberto", negociacao: "Em negociação", congeladas: "Congeladas", complementares: "Complementares",
  vendidas: "Vendidas", perdidas: "Perdidas / desistência", encerradas: "Todas encerradas", todas: "Todas (sem limite de data)",
};
const ALERTA_LABELS: Record<string, string> = {
  qualquer: "Qualquer alerta", atrasado: "Follow-up atrasado", sem_acao: "Sem próxima ação", parado: "Sem movimentação", vencendo: "Validade próxima",
};

const campoCls = "h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#2074B9]";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">{rotulo}{children}</label>;
}

function FiltrosPainel({ searchParams, vendedores, representantes }: { searchParams: SearchParams; vendedores: Array<{ id: string; nome: string }>; representantes: Array<{ id: string; nome: string }> }) {
  return (
    <form method="get" className="flex min-h-full flex-col">
      {searchParams.q && <input type="hidden" name="q" value={searchParams.q} />}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Campo rotulo="Situação">
          <select name="situacao" defaultValue={searchParams.situacao ?? ""} className={campoCls}>
            <option value="">Em aberto + encerradas recentes</option>
            {Object.entries(SITUACAO_LABELS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Status">
          <select name="status" defaultValue={searchParams.status ?? ""} className={campoCls}>
            <option value="">Todos os status</option>
            {STATUS_LISTA.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo">
            <select name="tipo" defaultValue={searchParams.tipo ?? ""} className={campoCls}>
              <option value="">Todos</option>
              {TIPOS_PROPOSTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              <option value="exportacao">{TIPO_LABELS.exportacao}</option>
            </select>
          </Campo>
          <Campo rotulo="Mercado">
            <select name="mercado" defaultValue={searchParams.mercado ?? ""} className={campoCls}>
              <option value="">Todos</option>
              <option value="nacional">Nacional</option>
              <option value="exportacao">Exportação</option>
            </select>
          </Campo>
        </div>
        <Campo rotulo="Usuário (responsável ou representante)">
          <select name="responsavel" defaultValue={searchParams.responsavel ?? ""} className={campoCls}>
            <option value="">Todos</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Representante">
          <select name="representante" defaultValue={searchParams.representante ?? ""} className={campoCls}>
            <option value="">Todos</option>
            {representantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Temperatura">
            <select name="temperatura" defaultValue={searchParams.temperatura ?? ""} className={campoCls}>
              <option value="">Todas</option>
              <option value="quente">Quente</option>
              <option value="morna">Morna</option>
              <option value="fria">Fria</option>
            </select>
          </Campo>
          <Campo rotulo="Alertas">
            <select name="alerta" defaultValue={searchParams.alerta ?? ""} className={campoCls}>
              <option value="">Sem filtro</option>
              {Object.entries(ALERTA_LABELS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </Campo>
        </div>
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background p-4">
        <button type="submit" className="h-10 flex-1 rounded-lg bg-[#2C4F79] px-4 text-sm font-medium text-white hover:bg-[#1E3A5F]">Aplicar</button>
        <Link href="/propostas" className="flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">Limpar</Link>
      </div>
    </form>
  );
}

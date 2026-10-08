import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarClock, ChevronRight, ClipboardCheck, Edit, ExternalLink, Snowflake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCNPJ, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { PropostaStatusBadge, PropostaTipoBadge, TemperaturaBadge } from "@/components/propostas/StatusBadge";
import { EtapaDropdown, StatusDropdown, TransferirDropdown } from "@/components/propostas/AcoesPropostaClient";
import { NovoFollowupForm } from "@/components/followups/NovoFollowupForm";
import { montarNomeArquivo } from "@/lib/propostas/docx-dados";
import type { Proposta, ItemProposta, ChecklistTecnico } from "@/types/database";
import { ChecklistTecnicoForm } from "@/components/propostas/ChecklistTecnicoForm";
import { GerarDocxBtn } from "@/components/propostas/GerarDocxBtn";
import { OrganizacaoPropostaForm } from "@/components/propostas/OrganizacaoPropostaForm";
import { AnexosProposta, type AnexoView } from "@/components/propostas/AnexosProposta";
import { ObservacoesTecnicas, NovaObservacaoNegociacao } from "@/components/propostas/ObservacoesNegociacao";
import { HistoricoNegociacao, type EventoHistorico } from "@/components/propostas/HistoricoNegociacao";
import { STATUS_ENCERRADOS, STATUS_EM_ACOMPANHAMENTO, TIPO_LABELS, faltaEstruturaCrm, mercadoDe } from "@/lib/propostas/crm";
import { carregarEtapas, carregarMotivos, usuarioAtual } from "@/lib/propostas/crm-servidor";
import { gerarLinksAnexos } from "@/lib/propostas/anexos-servidor";
import { hojeISO, diasAte } from "@/lib/propostas/alertas";
import { DIAS_ALERTA_VALIDADE } from "@/lib/propostas/crm";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data } = await supabase.from("propostas").select("numero_completo").eq("id", params.id).single();
  return { title: data?.numero_completo ?? "Proposta" };
}

const CAMPOS_BASE = "id, numero_completo, numero, revisao, tipo, status, temperatura, moeda, valor_total, desconto_medio_pct, condicao_pagamento, prazo_entrega, validade_proposta, observacoes, descricao_livre, canal_origem, criado_em, enviada_em, fechada_em, atualizado_em, cliente_id, responsavel_id, representante_id, etapa_funil_id, estornado, numero_pedido_dez, valor_pedido_real, data_pedido_dez, contato_nome, contato_email, contato_telefone";
const CAMPOS_CRM = "mercado, pais_destino, papel, proposta_principal_id, motivo_encerramento_codigo, motivo_encerramento_detalhes, motivo_congelamento, retomada_prevista";
const CAMPOS_CRM_024 = "motivo_congelamento_detalhes";

const CANAIS: Record<string, string> = {
  whatsapp: "WhatsApp", email: "E-mail", feira: "Feira", site: "Site",
  indicacao: "Indicação", telefone: "Telefone", recorrencia: "Recorrência", outro: "Outro",
};
const CANAIS_FOLLOWUP: Record<string, string> = {
  whatsapp: "WhatsApp", telefone: "Telefone", email: "E-mail", visita: "Visita", video: "Vídeo", sms: "SMS", outro: "Outro",
};

type Followup = {
  id: string; usuario_id: string | null; data_contato: string; canal: string; motivo: string | null; descricao: string | null;
  temperatura: string | null; proxima_acao_data: string | null; proxima_acao_tipo: string | null; proxima_acao_notas: string | null; criado_em: string;
};

function Bloco({ id, titulo, contador, acao, children }: { id?: string; titulo: string; contador?: number; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="overflow-hidden rounded-xl border border-border bg-card scroll-mt-4">
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

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="break-words text-[13px] font-medium text-foreground">{valor}</p>
    </div>
  );
}

export default async function DetalhePropostaPage({ params }: { params: { id: string } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // Lê com todos os campos; se o banco ainda não tem os arquivos 022/024, tenta com menos campos.
  let propostaRaw: Record<string, unknown> | null = null;
  let estruturaCrm = true;
  const tentativas = [`${CAMPOS_BASE}, ${CAMPOS_CRM}, ${CAMPOS_CRM_024}`, `${CAMPOS_BASE}, ${CAMPOS_CRM}`, CAMPOS_BASE];
  for (let i = 0; i < tentativas.length; i++) {
    const { data, error } = await supabase.from("propostas").select(tentativas[i]).eq("id", params.id).is("deleted_at", null).maybeSingle();
    if (error && faltaEstruturaCrm(error)) { estruturaCrm = i === 0; continue; }
    propostaRaw = data;
    estruturaCrm = i < 2;
    break;
  }
  if (!propostaRaw) notFound();

  const proposta = {
    ...(propostaRaw as unknown as Proposta),
    mercado: mercadoDe(propostaRaw as { mercado?: string | null; tipo: string }),
    papel: (propostaRaw as { papel?: string | null }).papel === "complementar" ? "complementar" : "principal",
  } as Proposta & { motivo_congelamento_detalhes?: string | null };

  const [
    { data: itensRaw },
    { data: followupsRaw },
    funil,
    { data: vendedoresRaw },
    { data: checklistRaw },
    historicoResult,
    anexosResult,
    motivos,
    usuario,
  ] = await Promise.all([
    supabase
      .from("itens_proposta")
      .select("id, descricao, quantidade, preco_tabela, preco_unitario, ipi_pct, desconto_pct, total, opcional, numero_item, observacao, produto:produtos(codigo, categoria)")
      .eq("proposta_id", params.id).order("ordem"),
    supabase
      .from("followups")
      .select("id, usuario_id, data_contato, canal, motivo, descricao, temperatura, proxima_acao_data, proxima_acao_tipo, proxima_acao_notas, criado_em")
      .eq("proposta_id", params.id)
      .order("data_contato", { ascending: false }).order("criado_em", { ascending: false }),
    carregarEtapas(supabase),
    supabase.from("usuarios").select("id, nome, perfil").in("perfil", ["admin", "vendedor_interno", "representante"]).eq("ativo", true),
    supabase.from("checklist_tecnico").select("*").eq("proposta_id", params.id).maybeSingle(),
    supabase.from("proposta_historico").select("id, tipo, descricao, detalhes, usuario_nome, criado_em").eq("proposta_id", params.id).order("criado_em", { ascending: false }).limit(300),
    supabase.from("proposta_anexos").select("id, categoria, nome, mime_type, tamanho_bytes, storage_path, enviado_por, criado_em").eq("proposta_id", params.id).order("criado_em", { ascending: false }),
    carregarMotivos(supabase),
    usuarioAtual(supabase),
  ]);

  const itens = (itensRaw ?? []) as unknown as ItemProposta[];
  const followups = (followupsRaw ?? []) as Followup[];
  const { etapas } = funil;
  const vendedores = (vendedoresRaw ?? []) as Array<{ id: string; nome: string }>;
  const checklist = checklistRaw as (ChecklistTecnico & { observacoes_tecnicas?: string | null }) | null;
  const historicoDisponivel = !historicoResult.error;
  const anexosDisponivel = !anexosResult.error;
  const anexosRaw = (anexosResult.data ?? []) as Array<{ id: string; categoria: string; nome: string; mime_type: string | null; tamanho_bytes: number | null; storage_path: string; enviado_por: string | null; criado_em: string }>;

  // Nomes de quem registrou follow-ups e enviou anexos.
  const idsUsuarios = Array.from(new Set([
    ...followups.map((f) => f.usuario_id), ...anexosRaw.map((a) => a.enviado_por),
  ].filter((v): v is string => Boolean(v))));
  const [{ data: nomesRaw }, links, cliente, responsavel, representante, principal, alternativasRaw, principaisRaw] = await Promise.all([
    idsUsuarios.length ? supabase.from("usuarios").select("id, nome").in("id", idsUsuarios) : Promise.resolve({ data: [] }),
    gerarLinksAnexos(anexosRaw.map((a) => a.storage_path)),
    proposta.cliente_id
      ? supabase.from("clientes").select("id, razao_social, cnpj, cidade, estado, pais").eq("id", proposta.cliente_id).maybeSingle().then((r: { data: unknown }) => r.data)
      : Promise.resolve(null),
    proposta.responsavel_id
      ? supabase.from("usuarios").select("id, nome, perfil").eq("id", proposta.responsavel_id).maybeSingle().then((r: { data: unknown }) => r.data)
      : Promise.resolve(null),
    proposta.representante_id
      ? supabase.from("representantes").select("id, nome").eq("id", proposta.representante_id).maybeSingle().then((r: { data: unknown }) => r.data)
      : Promise.resolve(null),
    proposta.proposta_principal_id
      ? supabase.from("propostas").select("id, numero_completo").eq("id", proposta.proposta_principal_id).maybeSingle().then((r: { data: unknown }) => r.data)
      : Promise.resolve(null),
    estruturaCrm
      ? supabase.from("propostas").select("id, numero_completo, status, papel")
          .or(`id.eq.${proposta.papel === "complementar" && proposta.proposta_principal_id ? proposta.proposta_principal_id : proposta.id},proposta_principal_id.eq.${proposta.papel === "complementar" && proposta.proposta_principal_id ? proposta.proposta_principal_id : proposta.id}`)
          .is("deleted_at", null).then((r: { data: unknown }) => r.data)
      : Promise.resolve([]),
    proposta.cliente_id && estruturaCrm
      ? supabase.from("propostas").select("id, numero_completo, status").eq("cliente_id", proposta.cliente_id).eq("papel", "principal").neq("id", proposta.id).is("deleted_at", null).order("criado_em", { ascending: false }).then((r: { data: unknown }) => r.data)
      : Promise.resolve([]),
  ]);

  const nomes = new Map(((nomesRaw ?? []) as Array<{ id: string; nome: string }>).map((u) => [u.id, u.nome]));
  const clienteInfo = cliente as { id: string; razao_social: string; cnpj: string | null; cidade: string | null; estado: string | null; pais: string | null } | null;
  const responsavelInfo = responsavel as { id: string; nome: string; perfil: string } | null;
  const representanteInfo = representante as { id: string; nome: string } | null;
  const propostaPrincipal = principal as { id: string; numero_completo: string } | null;
  const alternativas = ((alternativasRaw ?? []) as Array<{ id: string; numero_completo: string; status: string; papel: string }>).filter((a) => a.id !== proposta.id);
  const propostasPrincipais = ((principaisRaw ?? []) as Array<{ id: string; numero_completo: string; status: string }>)
    .filter((p) => !STATUS_ENCERRADOS.has(p.status) || p.id === proposta.proposta_principal_id);

  const encerrada = STATUS_ENCERRADOS.has(proposta.status);
  const moeda = proposta.moeda === "USD" ? "USD" : "BRL";
  const hoje = hojeISO();
  const proximaAcao = followups.find((f) => f.proxima_acao_data);
  const temProximaAcaoFutura = Boolean(proximaAcao?.proxima_acao_data && proximaAcao.proxima_acao_data >= hoje);
  const acaoAtrasada = Boolean(!encerrada && proposta.status !== "stand_by" && proximaAcao?.proxima_acao_data && proximaAcao.proxima_acao_data < hoje);
  const semAcao = STATUS_EM_ACOMPANHAMENTO.has(proposta.status) && !proximaAcao?.proxima_acao_data;
  const diasValidade = proposta.validade_proposta ? diasAte(proposta.validade_proposta) : null;
  const vencendo = !encerrada && diasValidade !== null && diasValidade >= 0 && diasValidade <= DIAS_ALERTA_VALIDADE;
  const vencida = !encerrada && diasValidade !== null && diasValidade < 0;
  const etapaAtual = etapas.find((e) => e.id === proposta.etapa_funil_id) ?? null;

  const nomeMotivo = (codigo: string | null | undefined) => (codigo ? motivos.nomes[codigo] ?? codigo : null);
  const p2 = proposta as unknown as { motivo_encerramento_codigo?: string | null; motivo_encerramento_detalhes?: string | null; motivo_congelamento?: string | null; motivo_congelamento_detalhes?: string | null; retomada_prevista?: string | null; pais_destino?: string | null; descricao_livre?: string | null; contato_nome?: string | null; contato_email?: string | null; contato_telefone?: string | null };
  const motivoEncerramento = p2.motivo_encerramento_codigo
    ? `${nomeMotivo(p2.motivo_encerramento_codigo)}${p2.motivo_encerramento_detalhes ? ` — ${p2.motivo_encerramento_detalhes}` : ""}`
    : null;
  const motivoCongelamento = p2.motivo_congelamento
    ? `${nomeMotivo(p2.motivo_congelamento)}${p2.motivo_congelamento_detalhes ? ` — ${p2.motivo_congelamento_detalhes}` : ""}`
    : null;

  const produtoPrincipal = itens.length
    ? (itens.length > 1 ? `${itens[0].descricao} (+${itens.length - 1} ${itens.length === 2 ? "item" : "itens"})` : itens[0].descricao)
    : p2.descricao_livre ?? "—";

  const totalSemIpi = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const totalComIpi = itens.reduce((s, i) => s + (i.total ?? 0), 0);

  // Nome sugerido ao salvar o Word (mesmo padrão usado pelo servidor).
  const nomeArquivo = proposta.tipo === "maquina" || proposta.tipo === "pecas"
    ? montarNomeArquivo({
        cliente: clienteInfo?.razao_social ?? "", cidade: clienteInfo?.cidade ?? "", uf: clienteInfo?.estado ?? "",
        tipo: proposta.tipo,
        itens: (itensRaw ?? []) as { descricao: string; quantidade: number; produto: { codigo: string; categoria: string } | null }[],
        numero: proposta.numero, revisao: proposta.revisao,
      })
    : `proposta_${proposta.numero_completo.replace(/\//g, "-")}.docx`;

  // Histórico da negociação: eventos registrados + follow-ups.
  const eventos: EventoHistorico[] = [
    ...((historicoResult.data ?? []) as EventoHistorico[]),
    ...followups.map((f): EventoHistorico => ({
      id: `f-${f.id}`, tipo: "followup",
      descricao: `Follow-up (${CANAIS_FOLLOWUP[f.canal] ?? f.canal})${f.motivo ? `: ${f.motivo}` : ""}`,
      detalhes: { resumo: [f.descricao, f.proxima_acao_data ? `Próxima ação: ${f.proxima_acao_tipo ?? "ação"} em ${formatDate(f.proxima_acao_data)}` : null].filter(Boolean).join("\n") },
      usuario_nome: f.usuario_id ? nomes.get(f.usuario_id) ?? null : null,
      criado_em: f.criado_em,
    })),
  ].sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  const anexos: AnexoView[] = anexosRaw.map((a) => ({
    id: a.id, categoria: a.categoria, nome: a.nome, mime_type: a.mime_type, tamanho_bytes: a.tamanho_bytes,
    criado_em: a.criado_em, enviado_por_nome: a.enviado_por ? nomes.get(a.enviado_por) ?? null : null,
    url: links[a.storage_path] ?? null,
    podeExcluir: usuario?.perfil === "admin" || (Boolean(usuario?.id) && a.enviado_por === usuario?.id),
  }));

  // Qual follow-up é a próxima ação em aberto; os anteriores já foram cumpridos ou substituídos.
  const idProximaAcaoAberta = proximaAcao?.id;
  const situacaoFollowup = (f: Followup) => {
    if (!f.proxima_acao_data) return null;
    if (f.id !== idProximaAcaoAberta) return { texto: "Cumprida", cls: "bg-green-50 text-green-700 border-green-200" };
    if (encerrada) return { texto: "Encerrada", cls: "bg-slate-100 text-slate-600 border-slate-200" };
    return f.proxima_acao_data < hoje
      ? { texto: "Atrasada", cls: "bg-red-50 text-red-700 border-red-200" }
      : { texto: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  };

  const mercadoTexto = proposta.mercado === "exportacao" ? `Exportação${p2.pais_destino ? ` · ${p2.pais_destino}` : ""}` : "Nacional";

  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3 text-[12px] text-muted-foreground sm:px-7">
        <Link href="/propostas" className="text-[#2074B9] hover:underline">Propostas</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono font-bold text-foreground">{proposta.numero_completo}</span>
      </div>

      {/* 1. Cabeçalho */}
      <header className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:px-7 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-[22px] font-bold tracking-tight text-foreground">{proposta.numero_completo}</h1>
            <PropostaStatusBadge status={proposta.status} />
            <PropostaTipoBadge tipo={proposta.tipo} />
            {etapaAtual && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapaAtual.cor }} />{etapaAtual.nome}
              </span>
            )}
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${proposta.papel === "complementar" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
              {proposta.papel === "complementar" ? "Complementar" : "Principal"}
            </span>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{mercadoTexto}</span>
            <TemperaturaBadge temperatura={proposta.temperatura} />
          </div>
          <p className="mt-1.5 line-clamp-2 text-[14px] font-medium text-foreground">{produtoPrincipal}</p>
          {clienteInfo && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              <Link href={`/clientes/${clienteInfo.id}`} className="text-[#2074B9] hover:underline">{clienteInfo.razao_social}</Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusDropdown
            propostaId={proposta.id}
            statusAtual={proposta.status}
            temAlternativas={alternativas.length > 0}
            motivos={motivos.ativos}
          />
          <Link href={`/propostas/${proposta.id}/editar`} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium transition-colors hover:border-[#2074B9]">
            <Edit className="h-3.5 w-3.5" />Editar
          </Link>
        </div>
      </header>

      {/* Alertas */}
      {(acaoAtrasada || semAcao || vencendo || vencida || proposta.status === "stand_by" || motivoEncerramento || (proposta.status === "vendida" && alternativas.some((a) => !STATUS_ENCERRADOS.has(a.status)))) && (
        <div className="flex flex-col gap-2 px-4 pt-4 sm:px-7">
          {acaoAtrasada && <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800"><CalendarClock className="h-4 w-4 shrink-0" />Follow-up atrasado: a próxima ação era para {formatDate(proximaAcao!.proxima_acao_data)}.</p>}
          {semAcao && <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />Esta proposta está em acompanhamento e não tem próxima ação definida. Registre um follow-up com a próxima ação.</p>}
          {vencendo && <p className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-[12px] text-yellow-900"><CalendarClock className="h-4 w-4 shrink-0" />A validade da proposta {diasValidade === 0 ? "vence hoje" : `vence em ${diasValidade} dias`} ({formatDate(proposta.validade_proposta)}).</p>}
          {vencida && <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800"><CalendarClock className="h-4 w-4 shrink-0" />A validade da proposta venceu em {formatDate(proposta.validade_proposta)}.</p>}
          {proposta.status === "stand_by" && (
            <p className="flex items-start gap-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-[12px] text-cyan-900"><Snowflake className="mt-0.5 h-4 w-4 shrink-0" /><span>Proposta congelada{p2.retomada_prevista ? ` — retomada prevista para ${formatDate(p2.retomada_prevista)}` : ""}.{motivoCongelamento ? ` Motivo: ${motivoCongelamento}.` : ""}</span></p>
          )}
          {motivoEncerramento && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-[12px] text-foreground">
              <strong>{proposta.status === "complementar_nao_selecionada" ? "Motivo da classificação:" : "Motivo do encerramento:"}</strong> {motivoEncerramento}
              {proposta.status === "complementar_nao_selecionada" && <span className="block text-muted-foreground">Esta proposta não conta como perda e fica no histórico do negócio.</span>}
            </p>
          )}
          {proposta.status === "vendida" && alternativas.some((a) => !STATUS_ENCERRADOS.has(a.status)) && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
              O cliente escolheu esta alternativa. Marque as outras ainda abertas como &quot;Alternativa não selecionada pelo cliente&quot; — assim elas não contam como perda.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 p-4 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* 2. Resumo comercial */}
          <Bloco titulo="Resumo comercial">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Campo rotulo="Produto / equipamento" valor={produtoPrincipal} /></div>
              {p2.descricao_livre && itens.length > 0 && <div className="sm:col-span-2"><Campo rotulo="Descrição" valor={<span className="whitespace-pre-line">{p2.descricao_livre}</span>} /></div>}
              {p2.descricao_livre && itens.length === 0 && <div className="sm:col-span-2"><Campo rotulo="Descrição inicial" valor={<span className="whitespace-pre-line">{p2.descricao_livre}</span>} /></div>}
              <Campo rotulo="Valor total" valor={proposta.valor_total != null ? <span className="font-mono text-[16px] font-bold">{formatCurrency(proposta.valor_total, moeda)}</span> : "—"} />
              <Campo rotulo="Moeda" valor={moeda === "USD" ? "Dólar (USD)" : "Real (BRL)"} />
              <Campo rotulo="Validade" valor={proposta.validade_proposta ? formatDate(proposta.validade_proposta) : "—"} />
              <Campo rotulo="Condição de pagamento" valor={proposta.condicao_pagamento ?? "—"} />
              <Campo rotulo="Prazo de entrega" valor={proposta.prazo_entrega ?? "—"} />
              <Campo rotulo="Responsável" valor={responsavelInfo?.nome ?? "—"} />
              <Campo rotulo="Origem" valor={proposta.canal_origem ? CANAIS[proposta.canal_origem] ?? proposta.canal_origem : "—"} />
              <Campo rotulo="Tipo / mercado" valor={`${TIPO_LABELS[proposta.tipo] ?? proposta.tipo} · ${mercadoTexto}`} />
              <Campo rotulo="Criada em" valor={formatDate(proposta.criado_em)} />
              <Campo rotulo="Enviada em" valor={proposta.enviada_em ? formatDate(proposta.enviada_em) : "—"} />
              {proposta.fechada_em && <Campo rotulo="Encerrada em" valor={formatDate(proposta.fechada_em)} />}
            </div>
            {proposta.observacoes && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Observações</p>
                <p className="whitespace-pre-line text-[13px] text-foreground">{proposta.observacoes}</p>
              </div>
            )}
            {(p2.contato_nome || p2.contato_email || p2.contato_telefone) && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
                {p2.contato_nome && <Campo rotulo="Contato" valor={p2.contato_nome} />}
                {p2.contato_email && <Campo rotulo="E-mail" valor={<a href={`mailto:${p2.contato_email}`} className="text-[#2074B9] hover:underline">{p2.contato_email}</a>} />}
                {p2.contato_telefone && <Campo rotulo="Telefone" valor={<a href={`tel:${p2.contato_telefone}`} className="text-[#2074B9] hover:underline">{p2.contato_telefone}</a>} />}
              </div>
            )}
          </Bloco>

          {/* 3. Itens cotados */}
          <Bloco
            titulo="Itens cotados"
            contador={itens.length}
            acao={proposta.valor_total != null ? <span className="font-mono text-[13px] font-bold text-foreground">{formatCurrency(proposta.valor_total, moeda)}</span> : undefined}
          >
            {itens.length === 0 ? (
              <p className="py-2 text-center text-[12px] text-muted-foreground">Nenhum item cadastrado. {p2.descricao_livre ? "A proposta foi criada só com número e descrição inicial." : ""}</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-muted/40">
                      {["#", "Descrição", "Qtd.", "Preço unit.", "Desc.%", "IPI%", "Total"].map((h) => (
                        <th key={h} className="border-b border-border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, idx) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{item.numero_item ?? idx + 1}</td>
                        <td className="max-w-[260px] px-3 py-2.5 text-[12px] text-foreground">
                          <p className="line-clamp-2">{item.descricao}</p>
                          {item.opcional && <span className="text-[10px] font-semibold text-amber-600">Opcional</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center text-[12px]">{item.quantidade}</td>
                        <td className="px-3 py-2.5 font-mono text-[12px]">{formatCurrency(item.preco_unitario, moeda)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{item.desconto_pct ? `${item.desconto_pct}%` : "—"}</td>
                        <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{item.ipi_pct ?? 0}%</td>
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold">{item.total ? formatCurrency(item.total, moeda) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20"><td colSpan={6} className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Subtotal sem IPI</td><td className="px-3 py-2 font-mono text-[12px] font-bold">{formatCurrency(totalSemIpi, moeda)}</td></tr>
                    <tr className="bg-muted/20"><td colSpan={6} className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Impostos (IPI)</td><td className="px-3 py-2 font-mono text-[12px] font-bold">{formatCurrency(Math.max(0, totalComIpi - totalSemIpi), moeda)}</td></tr>
                    <tr className="bg-muted/30"><td colSpan={6} className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Total com IPI</td><td className="px-3 py-2 font-mono text-[13px] font-bold">{formatCurrency(totalComIpi, moeda)}</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">
              Para incluir, remover ou mudar itens, quantidades e descontos, use <Link href={`/propostas/${proposta.id}/editar`} className="font-semibold text-[#2074B9] hover:underline">Editar</Link> — ao salvar, a proposta ganha a próxima letra de revisão.
            </p>
          </Bloco>

          {/* 4. Checklist técnico (máquinas) */}
          {proposta.tipo === "maquina" && (
            <Bloco
              titulo="Checklist Técnico da Aplicação"
              acao={checklist?.completo ? <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">Completo</span> : undefined}
            >
              <ChecklistTecnicoForm propostaId={proposta.id} checklist={checklist} />
              <div className="mt-5 border-t border-border pt-5">
                <ObservacoesTecnicas propostaId={proposta.id} inicial={checklist?.observacoes_tecnicas ?? null} />
              </div>
            </Bloco>
          )}

          {/* 5. Follow-ups */}
          <Bloco id="followups" titulo="Follow-ups" contador={followups.length}>
            {proximaAcao?.proxima_acao_data && !encerrada && (
              <div className={`mb-4 rounded-lg border p-3 text-[12px] ${acaoAtrasada ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                <strong>Próxima ação:</strong> {proximaAcao.proxima_acao_tipo ?? "Ação"} em {formatDate(proximaAcao.proxima_acao_data)}
                {proximaAcao.usuario_id && nomes.get(proximaAcao.usuario_id) ? ` · responsável: ${nomes.get(proximaAcao.usuario_id)}` : ""}
                {proximaAcao.proxima_acao_notas ? ` — ${proximaAcao.proxima_acao_notas}` : ""}
              </div>
            )}
            {followups.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-muted-foreground">Nenhum follow-up registrado ainda</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {followups.map((f) => {
                  const situacao = situacaoFollowup(f);
                  return (
                    <li key={f.id} className="py-3 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold text-foreground">{CANAIS_FOLLOWUP[f.canal] ?? f.canal}</span>
                        <TemperaturaBadge temperatura={f.temperatura} />
                        <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(f.data_contato)}{f.usuario_id && nomes.get(f.usuario_id) ? ` · ${nomes.get(f.usuario_id)}` : ""}</span>
                      </div>
                      {f.motivo && <p className="mt-0.5 text-[12px] font-medium text-foreground/80">{f.motivo}</p>}
                      {f.descricao && <p className="mt-0.5 whitespace-pre-line text-[12px] text-muted-foreground">{f.descricao}</p>}
                      {f.proxima_acao_data && situacao && (
                        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Próxima ação: <strong className="text-foreground">{f.proxima_acao_tipo ?? "Ação"}</strong> em {formatDate(f.proxima_acao_data)}{f.proxima_acao_notas ? ` — ${f.proxima_acao_notas}` : ""}</span>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${situacao.cls}`}>{situacao.texto}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-3 text-[12px] font-semibold text-foreground">Registrar follow-up</p>
              <NovoFollowupForm propostaId={proposta.id} exigeProximaAcao={STATUS_EM_ACOMPANHAMENTO.has(proposta.status)} />
            </div>
          </Bloco>

          {/* 6. Anexos e documentos */}
          <Bloco id="anexos" titulo="Anexos e documentos" contador={anexosDisponivel ? anexos.length : undefined}>
            <AnexosProposta propostaId={proposta.id} anexos={anexos} disponivel={anexosDisponivel} />
          </Bloco>

          {/* 7. Histórico da negociação */}
          <Bloco id="historico" titulo="Histórico da negociação" contador={eventos.length}>
            {!historicoDisponivel && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                O histórico completo (status, etapas, valores, anexos) passa a ser registrado depois da atualização do banco de dados do CRM (arquivo 024). Por enquanto aparecem só os follow-ups.
              </p>
            )}
            {historicoDisponivel && <div className="mb-4"><NovaObservacaoNegociacao propostaId={proposta.id} /></div>}
            <HistoricoNegociacao eventos={eventos} motivos={motivos.nomes} />
          </Bloco>
        </div>

        {/* Coluna lateral */}
        <aside className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Etapa do funil</p>
              <EtapaDropdown
                propostaId={proposta.id}
                numero={proposta.numero_completo}
                etapaAtualId={etapaAtual?.id ?? null}
                etapas={etapas}
                temProximaAcao={temProximaAcaoFutura}
                motivos={{ perda: motivos.ativos.perda, congelamento: motivos.ativos.congelamento }}
                encerrada={encerrada}
              />
            </div>
            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Responsável</p>
                <TransferirDropdown propostaId={proposta.id} responsavelAtualId={proposta.responsavel_id} vendedores={vendedores.map((v) => ({ id: v.id, nome: v.nome }))} />
              </div>
              {responsavelInfo ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2074B9] text-[11px] font-bold text-white">{getInitials(responsavelInfo.nome)}</div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{responsavelInfo.nome}</p>
                    {representanteInfo && <p className="truncate text-[11px] text-muted-foreground">Representante: {representanteInfo.nome}</p>}
                  </div>
                </div>
              ) : <p className="text-[12px] text-muted-foreground">—</p>}
            </div>
          </div>

          {(propostaPrincipal || alternativas.length > 0) && (
            <div className="rounded-xl border border-border bg-card p-4">
              {propostaPrincipal && (
                <div className="mb-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Proposta principal</p>
                  <Link href={`/propostas/${propostaPrincipal.id}`} className="font-mono text-[13px] font-semibold text-[#2074B9] hover:underline">{propostaPrincipal.numero_completo}</Link>
                </div>
              )}
              {alternativas.length > 0 && (
                <>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Alternativas do mesmo negócio</p>
                  <div className="flex flex-col gap-1.5">
                    {alternativas.map((a) => (
                      <Link key={a.id} href={`/propostas/${a.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 hover:border-[#2074B9]">
                        <span className="font-mono text-[12px] font-semibold text-[#2074B9]">{a.numero_completo}</span>
                        <PropostaStatusBadge status={a.status as Proposta["status"]} />
                      </Link>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Contam no valor apresentado; no funil ativo vale só a maior alternativa aberta.</p>
                </>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Organização comercial</p>
            {estruturaCrm ? (
              <OrganizacaoPropostaForm
                propostaId={proposta.id}
                mercadoAtual={proposta.mercado}
                paisDestinoAtual={p2.pais_destino ?? null}
                papelAtual={proposta.papel}
                propostaPrincipalAtualId={proposta.proposta_principal_id}
                propostasPrincipais={propostasPrincipais}
              />
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                Mercado, país de destino e alternativas ficam disponíveis depois da atualização do banco de dados do CRM (arquivo 022).
              </p>
            )}
          </div>

          {/* 8. Cliente: resumo compacto */}
          {clienteInfo && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Cliente</p>
              <p className="text-[13px] font-semibold text-foreground">{clienteInfo.razao_social}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {[clienteInfo.cnpj ? formatCNPJ(clienteInfo.cnpj) : null, [clienteInfo.cidade, clienteInfo.estado].filter(Boolean).join("/") || null, clienteInfo.pais && clienteInfo.pais !== "Brasil" ? clienteInfo.pais : null].filter(Boolean).join(" · ")}
              </p>
              <Link href={`/clientes/${clienteInfo.id}`} className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border text-[12px] font-medium text-[#2074B9] hover:border-[#2074B9]">
                Ver cliente completo<ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Exportar proposta</p>
            <GerarDocxBtn propostaId={proposta.id} nomeArquivo={nomeArquivo} checklistCompleto={proposta.tipo !== "maquina" || !!checklist?.completo} />
          </div>

          {(proposta as { numero_pedido_dez?: string | null }).numero_pedido_dez ? (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#16A34A]">Pedido DEZ</p>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 shrink-0 text-[#16A34A]" />
                <span className="font-mono text-[14px] font-bold text-[#16A34A]">{(proposta as { numero_pedido_dez?: string | null }).numero_pedido_dez}</span>
              </div>
              {(proposta as { valor_pedido_real?: number | null }).valor_pedido_real != null && (
                <p className="mt-2 font-mono text-[13px] font-bold text-[#1A1A1A]">{formatCurrency((proposta as { valor_pedido_real?: number | null }).valor_pedido_real!)}</p>
              )}
              {(proposta as { data_pedido_dez?: string | null }).data_pedido_dez && (
                <p className="text-[11px] text-[#6B7B8D]">{formatDate((proposta as { data_pedido_dez?: string | null }).data_pedido_dez!)}</p>
              )}
            </div>
          ) : (proposta.status === "vendida" || proposta.status === "em_negociacao" || proposta.status === "enviada") ? (
            <Link
              href={`/pedidos/reconciliar?numero=${encodeURIComponent(proposta.numero_completo)}`}
              className="flex h-10 items-center gap-2 rounded-lg border-[1.5px] border-[#E2E8F0] bg-white px-3.5 text-[12px] font-semibold text-[#2C4F79] transition-colors hover:border-[#2074B9] hover:bg-[#EFF6FF]"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />Registrar Pedido DEZ
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

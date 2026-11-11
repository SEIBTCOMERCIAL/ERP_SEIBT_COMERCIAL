"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Settings2, UserPlus, X } from "lucide-react";
import { moverLead } from "@/app/actions/leads-acompanhamento";
import { STATUS_LEAD, tipoDaEtapa, type EtapaLead } from "@/lib/leads/etapas";
import { CabecalhoKanban } from "@/components/kanban/CabecalhoKanban";
import { PainelLateral } from "@/components/kanban/PainelLateral";
import { INTERESSES_LEAD, leadAtrasado, type ClienteOpcao, type Lead, type Representante } from "./tipos";
import { BLUE, BORDER, campo, DANGER, MUTED, NAV } from "./estilos";
import { LeadDetalhe } from "./LeadDetalhe";
import { camposFaltando, ModalConverter, ModalMover } from "./LeadMovimento";
import { EtapasLeadAdmin } from "./EtapasLeadAdmin";

const NOVO = "novo";
const ABERTOS = (l: Lead) => !["convertido", "descartado"].includes(l.status);

/** Linha com faixa colorida à esquerda, no estilo dos quadros de tarefas. */
function Linha({ cor, texto, legenda }: { cor: string; texto: string; legenda: string }) {
  return (
    <div style={{ borderLeft: `3px solid ${cor}`, background: "#F8FAFC", borderRadius: 4, padding: "3px 8px", fontSize: 12, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {texto} <span style={{ color: MUTED }}>({legenda})</span>
    </div>
  );
}

// "Mover para" nos cards só aparece em telas de toque, onde arrastar não funciona.
const CSS = `.lead-mover{display:none}@media (hover:none){.lead-mover{display:block}}`;

interface Filtros { status: string; rep: string; atrasados: boolean }
const SEM_FILTROS: Filtros = { status: "", rep: "", atrasados: false };

function FiltrosLeadsPainel({ atuais, representantes, aplicar, fechar }: {
  atuais: Filtros; representantes: Representante[]; aplicar: (f: Filtros) => void; fechar: () => void;
}) {
  const [rascunho, setRascunho] = useState<Filtros>(atuais);
  const rotulo = { fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 4 } as const;
  const campoGrande = { ...campo, height: 40, fontSize: 14 };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ flex: 1, padding: 16, display: "grid", gap: 16, alignContent: "start" }}>
        <label><span style={rotulo}>Status</span>
          <select value={rascunho.status} onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })} style={campoGrande}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LEAD).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select></label>
        <label><span style={rotulo}>Representante</span>
          <select value={rascunho.rep} onChange={(e) => setRascunho({ ...rascunho, rep: e.target.value })} style={campoGrande}>
            <option value="">Todos os representantes</option>
            {representantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={rascunho.atrasados} onChange={(e) => setRascunho({ ...rascunho, atrasados: e.target.checked })} /> Somente ações atrasadas
        </label>
      </div>
      <div style={{ position: "sticky", bottom: 0, display: "flex", gap: 8, padding: 16, borderTop: `1px solid ${BORDER}`, background: "var(--background, #fff)" }}>
        <button type="button" onClick={() => { aplicar(rascunho); fechar(); }}
          style={{ flex: 1, height: 40, background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Aplicar</button>
        <button type="button" onClick={() => { aplicar(SEM_FILTROS); fechar(); }}
          style={{ height: 40, padding: "0 16px", background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Limpar</button>
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor, alerta = false }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs font-semibold text-muted-foreground">{rotulo}</p>
      <p className={`mt-1 text-lg font-bold ${alerta && valor > 0 ? "text-red-600" : "text-foreground"}`}>{valor}</p>
    </div>
  );
}

export function LeadsAcompanhamento({ leads, representantes, clientes, etapas, admin }: {
  leads: Lead[]; representantes: Representante[]; clientes: ClienteOpcao[]; etapas: EtapaLead[]; admin: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [movimento, setMovimento] = useState<{ leadId: string; etapa: EtapaLead } | null>(null);
  const [convertendoId, setConvertendoId] = useState<string | null>(null);
  const [etapasAbertas, setEtapasAbertas] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);

  const porId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const lista = leads.filter((l) =>
    (!filtros.status || l.status === filtros.status) &&
    (!filtros.rep || l.representante_id === filtros.rep) &&
    (!filtros.atrasados || leadAtrasado(l)) &&
    `${l.empresa_nome ?? ""} ${l.contato_nome ?? ""} ${l.contato_telefone ?? ""}`.toLowerCase().includes(busca.toLowerCase()));

  const colunas: EtapaLead[] = [
    ...etapas,
    ...(lista.some((l) => !l.etapa_id) ? [{ id: "", nome: "Sem etapa", ordem: -1, cor: "#64748b" }] : []),
  ];

  // Indicadores (sobre todos os leads, independentemente dos filtros).
  const abertos = leads.filter(ABERTOS);
  const atrasados = abertos.filter(leadAtrasado).length;
  const semAcao = abertos.filter((l) => !l.proxima_acao || !l.proxima_acao_em).length;
  const convertidos = leads.filter((l) => l.status === "convertido").length;
  const descartados = leads.filter((l) => l.status === "descartado").length;

  const chips: { chave: string; rotulo: string; remover: () => void }[] = [];
  if (filtros.status) chips.push({ chave: "status", rotulo: `Status: ${STATUS_LEAD[filtros.status] ?? filtros.status}`, remover: () => setFiltros({ ...filtros, status: "" }) });
  if (filtros.rep) chips.push({ chave: "rep", rotulo: `Representante: ${representantes.find((r) => r.id === filtros.rep)?.nome ?? "—"}`, remover: () => setFiltros({ ...filtros, rep: "" }) });
  if (filtros.atrasados) chips.push({ chave: "atrasados", rotulo: "Somente ações atrasadas", remover: () => setFiltros({ ...filtros, atrasados: false }) });

  // Se o lead some da lista (ex.: convertido), o painel fecha sozinho.
  useEffect(() => {
    if (selecionadoId && selecionadoId !== NOVO && !porId.has(selecionadoId)) setSelecionadoId(null);
  }, [porId, selecionadoId]);

  function iniciarMovimento(lead: Lead, etapa: EtapaLead) {
    if (pendente || !etapa.id || lead.etapa_id === etapa.id || lead.status === "convertido") return;
    setErro("");
    if (tipoDaEtapa(etapa) === "convertido") {
      if (lead.status !== "qualificado") { setErro("Para converter, primeiro mova o lead para Qualificado."); return; }
      setConvertendoId(lead.id);
      return;
    }
    const f = camposFaltando(lead, etapa);
    if (f.motivo || f.encaminhamento || f.acao) { setMovimento({ leadId: lead.id, etapa }); return; }
    iniciar(async () => {
      try {
        const r = await moverLead(lead.id, etapa.id);
        if (r.error) setErro(r.error); else router.refresh();
      } catch { setErro("Não foi possível mover. A etapa anterior foi preservada."); }
    });
  }

  const selecionado = selecionadoId && selecionadoId !== NOVO ? porId.get(selecionadoId) ?? null : null;
  const leadMovimento = movimento ? porId.get(movimento.leadId) : undefined;
  const leadConversao = convertendoId ? porId.get(convertendoId) : undefined;

  const botaoCls = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted";

  return (
    <div className="flex min-h-0 flex-col lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
      <style>{CSS}</style>
      <CabecalhoKanban
        chave="leads"
        titulo="Leads"
        contagem={lista.length === leads.length ? `${leads.length} leads` : `${lista.length} de ${leads.length} leads`}
        acoes={
          <>
            {admin && <button type="button" onClick={() => setEtapasAbertas(true)} className={botaoCls}><Settings2 className="h-4 w-4" />Etapas</button>}
            <button type="button" onClick={() => { setErro(""); setSelecionadoId(NOVO); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2C4F79] px-3 text-sm font-medium text-white hover:bg-[#1E3A5F]"><UserPlus className="h-4 w-4" />Novo lead</button>
          </>
        }
        busca={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar leads" placeholder="Empresa, contato ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-[#2074B9]" />
          </div>
        }
        filtrosQtd={chips.length}
        painelFiltros={(fechar) => <FiltrosLeadsPainel atuais={filtros} representantes={representantes} aplicar={setFiltros} fechar={fechar} />}
        chips={chips.length > 0 ? (
          <>
            {chips.map((c) => (
              <button key={c.chave} type="button" onClick={c.remover} title="Remover este filtro"
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs text-foreground hover:bg-muted">
                {c.rotulo}<X className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
            <button type="button" onClick={() => setFiltros(SEM_FILTROS)} className="text-xs font-medium text-[#2074B9] hover:underline">Limpar tudo</button>
          </>
        ) : null}
        resumo={
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>Em aberto <strong className="text-foreground">{abertos.length}</strong></span>
            <span>Ações atrasadas <strong className={atrasados > 0 ? "text-red-600" : "text-foreground"}>{atrasados}</strong></span>
            <span>Sem próxima ação <strong className="text-foreground">{semAcao}</strong></span>
          </p>
        }
        indicadores={
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Indicador rotulo="Total de leads" valor={leads.length} />
            <Indicador rotulo="Em aberto" valor={abertos.length} />
            <Indicador rotulo="Ações atrasadas" valor={atrasados} alerta />
            <Indicador rotulo="Sem próxima ação" valor={semAcao} alerta />
            <Indicador rotulo="Convertidos" valor={convertidos} />
            <Indicador rotulo="Descartados" valor={descartados} />
          </div>
        }
        avisos={erro && selecionadoId === null && !movimento ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p> : null}
      />

      <div className="flex h-[75vh] min-h-[420px] flex-col pt-3 lg:h-auto lg:min-h-0 lg:flex-1">
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 14, overflowX: "auto", overflowY: "hidden", padding: "0 24px 8px", alignItems: "stretch" }}>
          {colunas.map((etapa) => {
            const cards = lista.filter((l) => (l.etapa_id ?? "") === etapa.id);
            const aceita = !pendente && Boolean(etapa.id);
            return (
              <section key={etapa.id || "sem-etapa"} aria-label={etapa.nome}
                onDragOver={(e) => { if (aceita && e.dataTransfer.types.includes("text/plain")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setSobre(etapa.id); } }}
                onDragLeave={() => setSobre((atual) => (atual === etapa.id ? null : atual))}
                onDrop={(e) => {
                  e.preventDefault(); setSobre(null); setArrastando(null);
                  const lead = porId.get(e.dataTransfer.getData("text/plain"));
                  if (lead) iniciarMovimento(lead, etapa);
                }}
                style={{ width: 272, minWidth: 272, maxWidth: 272, flexShrink: 0, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                <h2 style={{ margin: 0, padding: "8px 12px", fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "#fff", background: etapa.cor, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etapa.nome}</span>
                  <span style={{ fontWeight: 600, opacity: 0.9 }}>{cards.length}</span>
                </h2>
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehaviorY: "contain", marginTop: 8, padding: 6, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, alignContent: "start", borderRadius: 10, border: `1px dashed ${sobre === etapa.id ? BLUE : "transparent"}`, background: sobre === etapa.id ? "rgba(32,116,185,0.06)" : "transparent" }}>
                  {cards.map((l) => {
                    const atrasado = leadAtrasado(l);
                    const movel = l.status !== "convertido";
                    const repNome = representantes.find((r) => r.id === l.representante_id)?.nome;
                    return (
                      <div key={l.id} role="button" tabIndex={0}
                        draggable={movel && !pendente}
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; setArrastando(l.id); }}
                        onDragEnd={() => { setArrastando(null); setSobre(null); }}
                        onClick={() => { setErro(""); setSelecionadoId(l.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) { setErro(""); setSelecionadoId(l.id); } }}
                        style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, fontSize: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, gap: 6, boxShadow: "0 1px 2px rgba(15,23,42,0.06)", cursor: movel ? "grab" : "pointer", opacity: arrastando === l.id ? 0.4 : 1 }}>
                        <strong style={{ fontSize: 14, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.empresa_nome || l.contato_nome || "Lead sem nome"}</strong>
                        {l.empresa_nome && l.contato_nome && <span style={{ color: MUTED, marginTop: -4 }}>{l.contato_nome}</span>}
                        <Linha cor={BLUE} texto={INTERESSES_LEAD[l.tipo_interesse] ?? l.tipo_interesse} legenda="Interesse" />
                        <Linha cor={etapa.cor} texto={STATUS_LEAD[l.status] ?? l.status} legenda="Status" />
                        {atrasado && <Linha cor={DANGER} texto="Ação atrasada" legenda="Prazo" />}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, color: MUTED, fontSize: 12 }}>
                          <span title={repNome ?? "Sem representante"} style={{ width: 22, height: 22, borderRadius: "50%", background: repNome ? NAV : "#CBD5E1", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(repNome ?? "?").slice(0, 1).toUpperCase()}</span>
                          <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: atrasado ? DANGER : MUTED }}>
                            {l.proxima_acao || "Sem próxima ação"}{l.proxima_acao_em ? ` · ${new Date(l.proxima_acao_em).toLocaleDateString("pt-BR")}` : ""}
                          </span>
                          <span style={{ marginLeft: "auto", flexShrink: 0, whiteSpace: "nowrap" }}>{l.historico?.length ?? 0} reg.</span>
                        </div>
                        {movel && (
                          <select className="lead-mover" aria-label="Mover para" value="" disabled={pendente}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { const alvo = etapas.find((x) => x.id === e.target.value); if (alvo) iniciarMovimento(l, alvo); }}
                            style={{ ...campo, height: 36, fontSize: 14 }}>
                            <option value="">Mover para…</option>
                            {etapas.filter((x) => x.id !== l.etapa_id).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
                  {!cards.length && <p style={{ margin: 0, padding: "16px 8px", fontSize: 12, color: MUTED, textAlign: "center" }}>Nenhum lead</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <PainelLateral aberto={etapasAbertas} aoFechar={() => setEtapasAbertas(false)} titulo="Etapas do funil de leads" largura={640}>
        <div className="p-4"><EtapasLeadAdmin etapas={etapas} /></div>
      </PainelLateral>

      {selecionadoId !== null && (
        <LeadDetalhe key={selecionadoId} lead={selecionado} etapas={etapas} representantes={representantes} clientes={clientes}
          aoFechar={() => setSelecionadoId(null)} />
      )}
      {movimento && leadMovimento && (
        <ModalMover lead={leadMovimento} etapa={movimento.etapa} representantes={representantes} aoFechar={() => setMovimento(null)} />
      )}
      {leadConversao && <ModalConverter lead={leadConversao} clientes={clientes} aoFechar={() => setConvertendoId(null)} />}
    </div>
  );
}

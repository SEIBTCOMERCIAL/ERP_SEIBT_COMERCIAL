"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Settings2 } from "lucide-react";
import { moverLead } from "@/app/actions/leads-acompanhamento";
import { STATUS_LEAD, tipoDaEtapa, type EtapaLead } from "@/lib/leads/etapas";
import { INTERESSES_LEAD, leadAtrasado, type ClienteOpcao, type Lead, type Representante } from "./tipos";
import { BG, BLUE, BORDER, botaoPrimario, botaoSecundario, campo, DANGER, MUTED, NAV } from "./estilos";
import { LeadDetalhe } from "./LeadDetalhe";
import { camposFaltando, ModalConverter, ModalMover } from "./LeadMovimento";
import { EtapasLeadAdmin } from "./EtapasLeadAdmin";

const NOVO = "novo";

/** Linha com faixa colorida à esquerda, no estilo dos quadros de tarefas. */
function Linha({ cor, texto, legenda }: { cor: string; texto: string; legenda: string }) {
  return (
    <div style={{ borderLeft: `3px solid ${cor}`, background: "#F8FAFC", borderRadius: 4, padding: "3px 8px", fontSize: 11, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {texto} <span style={{ color: MUTED }}>({legenda})</span>
    </div>
  );
}

// "Mover para" nos cards só aparece em telas de toque, onde arrastar não funciona.
const CSS = `.lead-mover{display:none}@media (hover:none){.lead-mover{display:block}}`;

export function LeadsAcompanhamento({ leads, representantes, clientes, etapas, admin }: {
  leads: Lead[]; representantes: Representante[]; clientes: ClienteOpcao[]; etapas: EtapaLead[]; admin: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [movimento, setMovimento] = useState<{ leadId: string; etapa: EtapaLead } | null>(null);
  const [convertendoId, setConvertendoId] = useState<string | null>(null);
  const [configurar, setConfigurar] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [rep, setRep] = useState("");
  const [soAtrasados, setSoAtrasados] = useState(false);

  const porId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const lista = leads.filter((l) =>
    (!status || l.status === status) &&
    (!rep || l.representante_id === rep) &&
    (!soAtrasados || leadAtrasado(l)) &&
    `${l.empresa_nome ?? ""} ${l.contato_nome ?? ""} ${l.contato_telefone ?? ""}`.toLowerCase().includes(busca.toLowerCase()));

  const colunas: EtapaLead[] = [
    ...etapas,
    ...(lista.some((l) => !l.etapa_id) ? [{ id: "", nome: "Sem etapa", ordem: -1, cor: "#64748b" }] : []),
  ];

  // Se o lead some da lista (ex.: convertido e filtrado), o painel fecha sozinho.
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

  return (
    <main style={{ background: BG, minHeight: "100vh", padding: 24, display: "grid", gap: 16, alignContent: "start" }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Leads · {lista.length}</h1>
          <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0" }}>Registre encaminhamentos e retornos dos representantes. O envio pelo WhatsApp é feito por você.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {admin && <button type="button" onClick={() => setConfigurar(!configurar)} style={{ ...botaoSecundario, display: "flex", gap: 6, alignItems: "center" }}><Settings2 size={15} /> Etapas</button>}
          <button type="button" onClick={() => { setErro(""); setSelecionadoId(NOVO); }} style={{ ...botaoPrimario, display: "flex", gap: 6, alignItems: "center" }}><UserPlus size={15} /> Novo lead</button>
        </div>
      </div>

      {configurar && admin && <EtapasLeadAdmin etapas={etapas} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "center" }}>
        <input aria-label="Buscar leads" placeholder="Empresa, contato ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} style={campo} />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} style={campo}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LEAD).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <select aria-label="Representante" value={rep} onChange={(e) => setRep(e.target.value)} style={campo}>
          <option value="">Todos os representantes</option>
          {representantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={soAtrasados} onChange={(e) => setSoAtrasados(e.target.checked)} /> Ações atrasadas
        </label>
      </div>

      {erro && selecionadoId === null && !movimento && <div role="alert" style={{ background: "#FEE2E2", color: DANGER, padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>{erro}</div>}
      <p role="status" style={{ margin: 0, fontSize: 12, color: MUTED }}>{pendente ? "Salvando…" : "Arraste os cards entre as etapas ou use “Mover para” no celular. Clique no card para acompanhar."}</p>

      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16, alignItems: "stretch" }}>
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
              style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column" }}>
              <h2 style={{ margin: 0, padding: "8px 12px", fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "#fff", background: etapa.cor, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etapa.nome}</span>
                <span style={{ fontWeight: 600, opacity: 0.9 }}>{cards.length}</span>
              </h2>
              <div style={{ flex: 1, marginTop: 8, padding: 6, display: "grid", gap: 8, minHeight: "55vh", alignContent: "start", borderRadius: 10, border: `1px dashed ${sobre === etapa.id ? BLUE : "transparent"}`, background: sobre === etapa.id ? "rgba(32,116,185,0.06)" : "transparent" }}>
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
                      style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, fontSize: 12, display: "grid", gap: 6, boxShadow: "0 1px 2px rgba(15,23,42,0.06)", cursor: movel ? "grab" : "pointer", opacity: arrastando === l.id ? 0.4 : 1 }}>
                      <strong style={{ fontSize: 13, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.empresa_nome || l.contato_nome || "Lead sem nome"}</strong>
                      {l.empresa_nome && l.contato_nome && <span style={{ color: MUTED, marginTop: -4 }}>{l.contato_nome}</span>}
                      <Linha cor={BLUE} texto={INTERESSES_LEAD[l.tipo_interesse] ?? l.tipo_interesse} legenda="Interesse" />
                      <Linha cor={etapa.cor} texto={STATUS_LEAD[l.status] ?? l.status} legenda="Status" />
                      {atrasado && <Linha cor={DANGER} texto="Ação atrasada" legenda="Prazo" />}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, color: MUTED, fontSize: 11 }}>
                        <span title={repNome ?? "Sem representante"} style={{ width: 22, height: 22, borderRadius: "50%", background: repNome ? NAV : "#CBD5E1", color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(repNome ?? "?").slice(0, 1).toUpperCase()}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: atrasado ? DANGER : MUTED }}>
                          {l.proxima_acao || "Sem próxima ação"}{l.proxima_acao_em ? ` · ${new Date(l.proxima_acao_em).toLocaleDateString("pt-BR")}` : ""}
                        </span>
                        <span style={{ marginLeft: "auto" }}>{l.historico?.length ?? 0} reg.</span>
                      </div>
                      {movel && (
                        <select className="lead-mover" aria-label="Mover para" value="" disabled={pendente}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { const alvo = etapas.find((x) => x.id === e.target.value); if (alvo) iniciarMovimento(l, alvo); }}
                          style={{ ...campo, height: 32, fontSize: 12 }}>
                          <option value="">Mover para…</option>
                          {etapas.filter((x) => x.id !== l.etapa_id).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
                {!cards.length && <p style={{ margin: 0, padding: 8, fontSize: 12, color: MUTED, textAlign: "center" }}>Nenhum lead</p>}
              </div>
            </section>
          );
        })}
      </div>

      {selecionadoId !== null && (
        <LeadDetalhe key={selecionadoId} lead={selecionado} etapas={etapas} representantes={representantes} clientes={clientes}
          aoFechar={() => setSelecionadoId(null)} />
      )}
      {movimento && leadMovimento && (
        <ModalMover lead={leadMovimento} etapa={movimento.etapa} representantes={representantes} aoFechar={() => setMovimento(null)} />
      )}
      {leadConversao && <ModalConverter lead={leadConversao} clientes={clientes} aoFechar={() => setConvertendoId(null)} />}
    </main>
  );
}

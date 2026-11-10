"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { salvarAcompanhamento, acompanharLead } from "@/app/actions/leads-acompanhamento";
import { STATUS_LEAD, tipoDaEtapa, type EtapaLead } from "@/lib/leads/etapas";
import { CANAIS_LEAD, INTERESSES_LEAD, type ClienteOpcao, type Lead, type Representante } from "./tipos";
import { areaTexto, botaoPrimario, botaoSecundario, BORDER, campo, caixaModal, erroBox, fundoModal, MUTED, NAV, paraISO, paraInputLocal, rotulo } from "./estilos";
import { ModalConverter } from "./LeadMovimento";

function Campo({ nome, label, tipo = "text", valor, obrigatorio }: { nome: string; label: string; tipo?: string; valor?: string | null; obrigatorio?: boolean }) {
  return (
    <label><span style={rotulo}>{label}</span>
      <input name={nome} type={tipo} required={obrigatorio} defaultValue={valor ?? ""} style={campo} /></label>
  );
}

function Selecao({ nome, label, opcoes, valor }: { nome: string; label: string; opcoes: [string, string][]; valor: string }) {
  return (
    <label><span style={rotulo}>{label}</span>
      <select name={nome} defaultValue={valor} style={campo}>
        {opcoes.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select></label>
  );
}

export function LeadDetalhe({ lead, etapas, representantes, clientes, aoFechar }: {
  lead: Lead | null; etapas: EtapaLead[]; representantes: Representante[]; clientes: ClienteOpcao[]; aoFechar: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [convertendo, setConvertendo] = useState(false);
  const [infoAberta, setInfoAberta] = useState(true);
  const [pendente, iniciar] = useTransition();
  const convertido = lead?.status === "convertido";
  const etapasEditaveis = etapas.filter((e) => tipoDaEtapa(e) !== "convertido");
  const historico = [...(lead?.historico ?? [])].reverse();

  function registrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lead) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const d: Record<string, string> = { observacoes: String(f.get("registro") ?? "") };
    if (f.get("acao")) d.proxima_acao = String(f.get("acao"));
    const prazo = paraISO(f.get("prazo"));
    if (prazo) d.proxima_acao_em = prazo;
    setErro("");
    iniciar(async () => {
      try {
        const r = await acompanharLead(lead.id, d);
        if (r.error) setErro(r.error);
        else { form.reset(); router.refresh(); }
      } catch { setErro("Não foi possível registrar o acompanhamento."); }
    });
  }

  function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const texto = (n: string) => String(f.get(n) ?? "");
    const dados = {
      etapa_id: texto("etapa_id"),
      empresa_nome: texto("empresa_nome"), contato_nome: texto("contato_nome"),
      contato_telefone: texto("contato_telefone"), contato_email: texto("contato_email"),
      cidade: texto("cidade"), estado: texto("estado"),
      canal_entrada: texto("canal_entrada"), tipo_interesse: texto("tipo_interesse"), mercado: texto("mercado"),
      representante_id: texto("representante_id") || null,
      observacoes: texto("observacoes"), motivo_descarte: texto("motivo_descarte"),
      encaminhado_em: paraISO(f.get("encaminhado_em")),
      proxima_acao: texto("proxima_acao"), proxima_acao_em: paraISO(f.get("proxima_acao_em")),
    };
    setErro("");
    iniciar(async () => {
      try {
        const r = await salvarAcompanhamento(lead?.id ?? null, dados);
        if (r.error) setErro(r.error);
        else { aoFechar(); router.refresh(); }
      } catch { setErro("Falha de conexão. Tente novamente."); }
    });
  }

  const interesses: [string, string][] = Object.entries(INTERESSES_LEAD);
  if (lead?.tipo_interesse === "exportacao") interesses.push(["exportacao", "Exportação (antigo — reclassifique)"]);

  const formularioDados = (
    <form onSubmit={salvar}>
      <fieldset disabled={pendente || convertido} style={{ border: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Selecao nome="etapa_id" label="Etapa do funil" opcoes={etapasEditaveis.map((e) => [e.id, e.nome])} valor={lead?.etapa_id ?? etapasEditaveis[0]?.id ?? ""} />
        <Campo nome="empresa_nome" label="Empresa" valor={lead?.empresa_nome} obrigatorio />
        <Campo nome="contato_nome" label="Contato" valor={lead?.contato_nome} obrigatorio />
        <Campo nome="contato_telefone" label="Telefone" valor={lead?.contato_telefone} />
        <Campo nome="contato_email" label="E-mail" tipo="email" valor={lead?.contato_email} />
        <Campo nome="cidade" label="Cidade" valor={lead?.cidade} />
        <Campo nome="estado" label="Estado" valor={lead?.estado} />
        <Selecao nome="canal_entrada" label="Origem" opcoes={Object.entries(CANAIS_LEAD)} valor={lead?.canal_entrada ?? "site"} />
        <Selecao nome="tipo_interesse" label="Interesse" opcoes={interesses} valor={lead?.tipo_interesse ?? "maquina"} />
        <Selecao nome="mercado" label="Mercado" opcoes={[["nacional", "Nacional"], ["exportacao", "Exportação"]]} valor={lead?.mercado ?? "nacional"} />
        <Selecao nome="representante_id" label="Representante" opcoes={[["", "Selecione"], ...representantes.map((r): [string, string] => [r.id, r.nome])]} valor={lead?.representante_id ?? ""} />
        <Campo nome="encaminhado_em" label="Encaminhado em" tipo="datetime-local" valor={paraInputLocal(lead?.encaminhado_em)} />
        <Campo nome="proxima_acao" label="Próxima ação" valor={lead?.proxima_acao} />
        <Campo nome="proxima_acao_em" label="Prazo da próxima ação" tipo="datetime-local" valor={paraInputLocal(lead?.proxima_acao_em)} />
        <Campo nome="motivo_descarte" label="Motivo do descarte" valor={lead?.motivo_descarte} />
        <label style={{ gridColumn: "1 / -1" }}><span style={rotulo}>Observações / retorno recebido</span>
          <textarea name="observacoes" rows={4} defaultValue={lead?.observacoes ?? ""} style={areaTexto} /></label>
        <div style={{ gridColumn: "1 / -1" }}>
          <button type="submit" style={{ ...botaoPrimario, opacity: pendente ? 0.6 : 1 }}>{pendente ? "Salvando..." : lead ? "Salvar alterações" : "Cadastrar lead"}</button>
        </div>
      </fieldset>
    </form>
  );

  return (
    <div style={fundoModal}>
      <section role="dialog" aria-modal="true" aria-label="Acompanhamento do lead" style={{ ...caixaModal, maxWidth: lead ? 1080 : 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, color: NAV }}>{lead ? (lead.empresa_nome || "Lead") : "Novo lead"}</h2>
            {lead && <span style={{ fontSize: 12, color: MUTED }}>{STATUS_LEAD[lead.status] ?? lead.status}{lead.contato_nome ? ` · ${lead.contato_nome}` : ""}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {lead && (
              <button type="button" onClick={() => setInfoAberta(!infoAberta)} aria-expanded={infoAberta}
                style={{ ...botaoSecundario, display: "flex", gap: 6, alignItems: "center", padding: "6px 12px" }}>
                {infoAberta ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />} {infoAberta ? "Ocultar informações" : "Informações do lead"}
              </button>
            )}
            <button type="button" aria-label="Fechar" disabled={pendente} onClick={aoFechar} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>
          {erro && <div role="alert" style={erroBox}>{erro}</div>}

          {!lead && formularioDados}

          {lead && (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "2 1 420px", minWidth: 0, display: "grid", gap: 16 }}>
                {!convertido && (
                  <form onSubmit={registrar} style={{ display: "grid", gap: 12, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>Novo acompanhamento</h3>
                    <textarea name="registro" required maxLength={10000} rows={3} style={areaTexto} placeholder="Registre o retorno do representante ou a conversa com o cliente…" />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                      <Campo nome="acao" label="Nova próxima ação (opcional)" />
                      <Campo nome="prazo" label="Novo prazo (opcional)" tipo="datetime-local" />
                    </div>
                    <div><button type="submit" disabled={pendente} style={{ ...botaoPrimario, opacity: pendente ? 0.6 : 1 }}>Registrar acompanhamento</button></div>
                  </form>
                )}

                <div>
                  <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Histórico · {historico.length}</h3>
                  <div style={{ maxHeight: "52vh", overflowY: "auto", display: "grid", gap: 8, borderLeft: `2px solid ${BORDER}`, paddingLeft: 12 }}>
                    {historico.map((h, i) => (
                      <article key={i} style={{ background: "#F8FAFC", borderRadius: 8, padding: 10, fontSize: 13 }}>
                        <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                          {new Date(h.data).toLocaleString("pt-BR")} · {STATUS_LEAD[h.status] ?? h.status}
                          {h.etapa_id ? ` · ${etapas.find((e) => e.id === h.etapa_id)?.nome ?? "Etapa removida"}` : ""}
                        </p>
                        <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{h.observacoes || "Atualização do lead"}</p>
                        {h.motivo_descarte && h.status === "descartado" && <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>Motivo do descarte: {h.motivo_descarte}</p>}
                        {h.proxima_acao && <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>Próxima ação: {h.proxima_acao}{h.proxima_acao_em ? ` · ${new Date(h.proxima_acao_em).toLocaleString("pt-BR")}` : ""}</p>}
                      </article>
                    ))}
                    {!historico.length && <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Nenhum acompanhamento registrado.</p>}
                  </div>
                </div>

                {lead.status === "qualificado" && (
                  <div><button type="button" onClick={() => setConvertendo(true)} style={{ ...botaoPrimario, background: "#16A34A" }}>Converter em cliente</button></div>
                )}
                {lead.cliente_id && <Link href={`/clientes/${lead.cliente_id}`} style={{ color: "#2074B9", fontSize: 13 }}>Abrir cliente e continuar para propostas</Link>}
              </div>

              {infoAberta && (
                <aside style={{ flex: "1 1 320px", minWidth: 0, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, background: "#FCFDFE" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Informações do lead</h3>
                  {formularioDados}
                </aside>
              )}
            </div>
          )}
        </div>
      </section>
      {convertendo && lead && <ModalConverter lead={lead} clientes={clientes} aoFechar={() => { setConvertendo(false); aoFechar(); }} />}
    </div>
  );
}

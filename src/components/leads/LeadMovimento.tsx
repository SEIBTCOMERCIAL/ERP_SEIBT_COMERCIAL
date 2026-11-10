"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moverLead, converterLead } from "@/app/actions/leads-acompanhamento";
import { tipoDaEtapa, type EtapaLead } from "@/lib/leads/etapas";
import type { ClienteOpcao, Lead, Representante } from "./tipos";
import { areaTexto, botaoPrimario, botaoSecundario, campo, caixaModal, erroBox, fundoModal, NAV, paraISO, paraInputLocal, rotulo } from "./estilos";

/** Dados que precisam ser pedidos antes de mover o lead para a etapa. */
export function camposFaltando(lead: Lead, etapa: EtapaLead) {
  const tipo = tipoDaEtapa(etapa);
  return {
    motivo: tipo === "descartado",
    encaminhamento: tipo === "encaminhado",
    acao: tipo !== "descartado" && (!lead.proxima_acao || !lead.proxima_acao_em),
  };
}

export function ModalMover({ lead, etapa, representantes, aoFechar }: {
  lead: Lead; etapa: EtapaLead; representantes: Representante[]; aoFechar: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const faltando = camposFaltando(lead, etapa);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const dados: Record<string, string> = {};
    if (faltando.motivo) dados.motivo_descarte = String(f.get("motivo") ?? "");
    if (faltando.encaminhamento) {
      dados.representante_id = String(f.get("representante") ?? "");
      const data = paraISO(f.get("encaminhado_em"));
      if (data) dados.encaminhado_em = data;
    }
    if (faltando.acao) {
      dados.proxima_acao = String(f.get("acao") ?? "");
      const prazo = paraISO(f.get("prazo"));
      if (prazo) dados.proxima_acao_em = prazo;
    }
    if (dados.representante_id === "") delete dados.representante_id;
    setErro("");
    iniciar(async () => {
      try {
        const r = await moverLead(lead.id, etapa.id, dados);
        if (r.error) setErro(r.error);
        else { aoFechar(); router.refresh(); }
      } catch { setErro("Não foi possível mover. O lead continua na etapa anterior."); }
    });
  }

  return (
    <div style={fundoModal}>
      <form onSubmit={enviar} style={{ ...caixaModal, maxWidth: 460 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: NAV }}>Mover para “{etapa.nome}”</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7B8D" }}>{lead.empresa_nome || lead.contato_nome}</p>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          {erro && <div role="alert" style={erroBox}>{erro}</div>}
          {faltando.motivo && (
            <label><span style={rotulo}>Motivo do descarte *</span>
              <textarea name="motivo" required rows={3} style={areaTexto} defaultValue={lead.motivo_descarte ?? ""} /></label>
          )}
          {faltando.encaminhamento && (<>
            <label><span style={rotulo}>Representante *</span>
              <select name="representante" required defaultValue={lead.representante_id ?? ""} style={campo}>
                <option value="">Selecione</option>
                {representantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select></label>
            <label><span style={rotulo}>Encaminhado em *</span>
              <input name="encaminhado_em" type="datetime-local" required style={campo} defaultValue={paraInputLocal(lead.encaminhado_em) || paraInputLocal(new Date().toISOString())} /></label>
          </>)}
          {faltando.acao && (<>
            <label><span style={rotulo}>Próxima ação *</span>
              <input name="acao" required style={campo} placeholder="Ex.: ligar para confirmar interesse" /></label>
            <label><span style={rotulo}>Prazo da próxima ação *</span>
              <input name="prazo" type="datetime-local" required style={campo} /></label>
          </>)}
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" disabled={pendente} onClick={aoFechar} style={botaoSecundario}>Cancelar</button>
          <button type="submit" disabled={pendente} style={{ ...botaoPrimario, opacity: pendente ? 0.6 : 1 }}>{pendente ? "Movendo..." : "Mover lead"}</button>
        </div>
      </form>
    </div>
  );
}

export function ModalConverter({ lead, clientes, aoFechar }: {
  lead: Lead; clientes: ClienteOpcao[]; aoFechar: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cliente = String(new FormData(e.currentTarget).get("cliente") || "");
    setErro("");
    iniciar(async () => {
      try {
        const r = await converterLead(lead.id, cliente || null);
        if (r.error) setErro(r.error);
        else { aoFechar(); router.push(`/clientes/${r.clienteId}`); }
      } catch { setErro("Falha ao converter. Tente novamente."); }
    });
  }

  return (
    <div style={fundoModal}>
      <form onSubmit={enviar} style={{ ...caixaModal, maxWidth: 480 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: NAV }}>Converter em cliente</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7B8D" }}>{lead.empresa_nome || lead.contato_nome}</p>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          {erro && <div role="alert" style={erroBox}>{erro}</div>}
          <p style={{ margin: 0, fontSize: 13 }}>Confira se o cliente já existe antes de criar um novo cadastro.</p>
          <label><span style={rotulo}>Cliente</span>
            <select name="cliente" style={campo} defaultValue="">
              <option value="">Criar novo cliente (prospect; revisar o cadastro depois)</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
            </select></label>
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" disabled={pendente} onClick={aoFechar} style={botaoSecundario}>Cancelar</button>
          <button type="submit" disabled={pendente} style={{ ...botaoPrimario, opacity: pendente ? 0.6 : 1 }}>{pendente ? "Convertendo..." : "Converter"}</button>
        </div>
      </form>
    </div>
  );
}

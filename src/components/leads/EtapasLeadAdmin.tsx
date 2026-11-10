"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { atualizarEtapaLead, excluirEtapaLead, reordenarEtapaLead, salvarEtapaLead } from "@/app/actions/leads-etapas";
import { TIPOS_ETAPA_LEAD, tipoDaEtapa, type EtapaLead } from "@/lib/leads/etapas";
import { BORDER, botaoPrimario, botaoSecundario, campo, erroBox } from "./estilos";

export function EtapasLeadAdmin({ etapas }: { etapas: EtapaLead[] }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  // O tipo só existe depois da migração 032.
  const temTipo = etapas.some((e) => e.tipo !== undefined);

  function executar(acao: () => Promise<{ error?: string }>) {
    setErro("");
    iniciar(async () => {
      try {
        const r = await acao();
        if (r.error) setErro(r.error);
        else router.refresh();
      } catch { setErro("Não foi possível salvar. Tente novamente."); }
    });
  }

  function dadosDoForm(form: HTMLFormElement) {
    const f = new FormData(form);
    const d: Record<string, string> = { nome: String(f.get("nome") ?? ""), cor: String(f.get("cor") ?? "") };
    if (temTipo && f.get("tipo")) d.tipo = String(f.get("tipo"));
    return d;
  }

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: "#fff", padding: 16, display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 15 }}>Etapas do funil de leads</h2>
      {erro && <div role="alert" style={erroBox}>{erro}</div>}
      {etapas.map((e, i) => (
        <form key={`${e.id}-${e.nome}-${e.cor}-${e.tipo}`} onSubmit={(ev) => { ev.preventDefault(); executar(() => atualizarEtapaLead(e.id, dadosDoForm(ev.currentTarget))); }}
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input name="cor" type="color" defaultValue={e.cor} aria-label="Cor" style={{ width: 40, height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: 2 }} />
          <input name="nome" defaultValue={e.nome} required maxLength={80} aria-label="Nome da etapa" style={{ ...campo, width: 200 }} />
          {temTipo && (
            <select name="tipo" defaultValue={tipoDaEtapa(e)} aria-label="Tipo" style={{ ...campo, width: 260 }}>
              {TIPOS_ETAPA_LEAD.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
          <button type="submit" disabled={pendente} style={botaoSecundario}>Salvar</button>
          <button type="button" aria-label="Subir" disabled={pendente || i === 0} onClick={() => executar(() => reordenarEtapaLead(e.id, "subir"))} style={botaoSecundario}><ArrowUp size={14} /></button>
          <button type="button" aria-label="Descer" disabled={pendente || i === etapas.length - 1} onClick={() => executar(() => reordenarEtapaLead(e.id, "descer"))} style={botaoSecundario}><ArrowDown size={14} /></button>
          <button type="button" aria-label="Excluir etapa" disabled={pendente} onClick={() => { if (window.confirm(`Excluir a etapa “${e.nome}”?`)) executar(() => excluirEtapaLead(e.id)); }} style={{ ...botaoSecundario, color: "#DC2626" }}><Trash2 size={14} /></button>
        </form>
      ))}
      <form onSubmit={(ev) => { ev.preventDefault(); const form = ev.currentTarget; executar(async () => { const r = await salvarEtapaLead(dadosDoForm(form)); if (!r.error) form.reset(); return r; }); }}
        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
        <input name="cor" type="color" defaultValue="#2C4F79" aria-label="Cor da nova etapa" style={{ width: 40, height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: 2 }} />
        <input name="nome" required maxLength={80} placeholder="Nova etapa" style={{ ...campo, width: 200 }} />
        {temTipo && (
          <select name="tipo" defaultValue="intermediaria" aria-label="Tipo da nova etapa" style={{ ...campo, width: 260 }}>
            {TIPOS_ETAPA_LEAD.filter((t) => t.value !== "convertido").map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}
        <button type="submit" disabled={pendente} style={botaoPrimario}>Criar etapa</button>
      </form>
    </div>
  );
}

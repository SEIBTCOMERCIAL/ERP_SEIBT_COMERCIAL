"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { moverPropostaEtapa, type DetalhesMoverEtapa } from "@/app/actions/propostas";
import type { MotivoOpcao } from "@/lib/propostas/crm";
import { tipoEtapaDe, type EtapaFunil } from "@/lib/propostas/funil";

export interface MotivosParaMover {
  perda: MotivoOpcao[];
  congelamento: MotivoOpcao[];
}

export interface PropostaParaMover {
  id: string;
  numero: string;
  temProximaAcao: boolean;
}

const TIPOS_PROXIMA_ACAO = ["Ligar", "Enviar e-mail", "Enviar proposta revisada", "Visitar cliente", "Apresentar proposta", "Aguardar retorno", "Outro"];

const campo = "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-[#2074B9]";
const rotulo = "flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Mover a proposta de etapa. Quando a etapa de destino pede informação (ganho, perda, congelamento
 * ou próxima ação obrigatória), abre uma janela para coletar; caso contrário, move direto.
 */
export function useMoverEtapa(motivos: MotivosParaMover) {
  const router = useRouter();
  const [alvo, setAlvo] = useState<{ proposta: PropostaParaMover; etapa: EtapaFunil } | null>(null);
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [motivoCodigo, setMotivoCodigo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [retomada, setRetomada] = useState("");
  const [acaoData, setAcaoData] = useState("");
  const [acaoTipo, setAcaoTipo] = useState("");
  const [acaoNotas, setAcaoNotas] = useState("");

  function enviar(proposta: PropostaParaMover, etapa: EtapaFunil, detalhes?: DetalhesMoverEtapa) {
    setErro(null);
    startTransition(async () => {
      const r = await moverPropostaEtapa(proposta.id, etapa.id, detalhes);
      if (r.error) { setErro(r.error); return; }
      fechar();
      router.refresh();
    });
  }

  function fechar() {
    setAlvo(null); setErro(null); setMotivoCodigo(""); setObservacao(""); setRetomada("");
    setAcaoData(""); setAcaoTipo(""); setAcaoNotas("");
  }

  function mover(proposta: PropostaParaMover, etapa: EtapaFunil) {
    const tipo = tipoEtapaDe(etapa);
    const precisaJanela = tipo === "ganho" || tipo === "perda" || tipo === "congelamento" ||
      (Boolean(etapa.exige_proxima_acao) && !proposta.temProximaAcao);
    if (!precisaJanela) { enviar(proposta, etapa); return; }
    setErro(null);
    setAlvo({ proposta, etapa });
  }

  function confirmar() {
    if (!alvo) return;
    const tipo = tipoEtapaDe(alvo.etapa);
    if (tipo === "perda" || tipo === "congelamento") {
      enviar(alvo.proposta, alvo.etapa, { motivoCodigo, motivoDetalhes: observacao, retomadaPrevista: retomada || undefined });
    } else if (tipo === "ganho") {
      enviar(alvo.proposta, alvo.etapa);
    } else {
      enviar(alvo.proposta, alvo.etapa, { proximaAcao: { data: acaoData, tipo: acaoTipo, notas: acaoNotas } });
    }
  }

  const tipo = alvo ? tipoEtapaDe(alvo.etapa) : null;
  const listaMotivos = tipo === "congelamento" ? motivos.congelamento : motivos.perda;
  const titulo = tipo === "ganho" ? "Marcar como ganha" : tipo === "perda" ? "Marcar como perdida" : tipo === "congelamento" ? "Congelar proposta" : "Próxima ação obrigatória";
  const pronto =
    tipo === "ganho" ? true :
    tipo === "perda" ? Boolean(motivoCodigo && observacao.trim()) :
    tipo === "congelamento" ? Boolean(motivoCodigo && observacao.trim() && retomada) :
    Boolean(acaoData && acaoTipo);

  const dialog = alvo ? (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-xl">
        <h3 className="text-[15px] font-bold text-foreground">{titulo}</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Proposta {alvo.proposta.numero} → etapa <strong>{alvo.etapa.nome}</strong>
        </p>

        {tipo === "ganho" && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-[12px] text-green-800">
            A proposta passa a constar como <strong>vendida</strong>. As outras alternativas abertas do mesmo negócio devem ser marcadas como &quot;alternativa não selecionada&quot;.
          </p>
        )}

        {(tipo === "perda" || tipo === "congelamento") && (
          <div className="mt-4 flex flex-col gap-3">
            <label className={rotulo}>Motivo *
              <select value={motivoCodigo} onChange={(e) => setMotivoCodigo(e.target.value)} className={campo}>
                <option value="">Selecione...</option>
                {listaMotivos.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
              </select>
            </label>
            <label className={rotulo}>Observação *
              <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className="rounded-lg border border-border bg-background p-2 text-[13px] font-normal text-foreground outline-none focus:border-[#2074B9]" />
            </label>
            {tipo === "congelamento" && (
              <label className={rotulo}>Data prevista de retomada *
                <input type="date" min={hojeISO()} value={retomada} onChange={(e) => setRetomada(e.target.value)} className={campo} />
              </label>
            )}
          </div>
        )}

        {(tipo === "inicial" || tipo === "intermediaria") && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-lg bg-amber-50 p-3 text-[12px] text-amber-800">Esta etapa exige uma próxima ação definida.</p>
            <label className={rotulo}>Data *
              <input type="date" min={hojeISO()} value={acaoData} onChange={(e) => setAcaoData(e.target.value)} className={campo} />
            </label>
            <label className={rotulo}>Tipo *
              <select value={acaoTipo} onChange={(e) => setAcaoTipo(e.target.value)} className={campo}>
                <option value="">Selecione...</option>
                {TIPOS_PROXIMA_ACAO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className={rotulo}>Notas
              <input value={acaoNotas} onChange={(e) => setAcaoNotas(e.target.value)} placeholder="O que fazer..." className={campo} />
            </label>
          </div>
        )}

        {erro && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={fechar} className="h-10 rounded-lg border border-border px-4 text-[13px] font-medium">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={pendente || !pronto} className="flex h-10 items-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-[13px] font-semibold text-white disabled:opacity-50">
            {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Confirmar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { mover, pendente, erro, limparErro: () => setErro(null), dialog };
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { definirIpiReajuste } from "@/app/actions/reajuste";
import { parseIpiNavalha } from "@/lib/reajuste/kits";
import type { RespostaIpi } from "@/lib/reajuste/tipos";

export interface OpcaoAlcanceIpi { id: string; rotulo: string; produtoIds: string[] }

const campo = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#2074B9]";

/** Edição manual do IPI de navalhas (administrador). Não é reajuste: preço-base e data do último reajuste não mudam. */
export function JanelaIpi({ titulo, opcoes, ipiAtual, avisos = [], aoFechar, aoConcluir }: {
  titulo: string;
  /** Alcance explícito: cada opção diz exatamente quais navalhas serão alteradas. */
  opcoes: OpcaoAlcanceIpi[];
  ipiAtual?: number | null;
  avisos?: string[];
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const [escolhida, setEscolhida] = useState(opcoes[0]?.id ?? "");
  const [ipi, setIpi] = useState(ipiAtual !== null && ipiAtual !== undefined ? String(ipiAtual).replace(".", ",") : "");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Extract<RespostaIpi, { ok: true }> | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape" && !pendente) aoFechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar, pendente]);

  const opcao = opcoes.find((o) => o.id === escolhida) ?? opcoes[0];
  const valor = parseIpiNavalha(ipi);
  const erroIpi = ipi.trim() === "" ? null : valor.erro ?? null;
  const motivoOk = motivo.trim().length >= 3;
  const podeGravar = Boolean(opcao) && opcao.produtoIds.length > 0 && valor.erro === undefined && motivoOk;

  function gravar() {
    if (!opcao || !podeGravar || pendente) return;
    setErro(null);
    iniciar(async () => {
      try {
        const r = await definirIpiReajuste({ produtoIds: opcao.produtoIds, ipi, motivo });
        if (!r.ok) { setErro(r.erro); return; }
        setResultado(r);
      } catch {
        setErro("Não foi possível confirmar se o IPI foi gravado. Atualize a lista para conferir.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Alterar IPI">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{resultado ? "IPI gravado" : "Alterar IPI"}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{titulo}</p>
          </div>
          <button type="button" aria-label="Fechar" disabled={pendente} onClick={resultado ? aoConcluir : aoFechar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {erro && (
            <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{erro}</span>
            </div>
          )}

          {resultado ? (
            <div className="flex flex-col items-start gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground"><CheckCircle2 className="h-5 w-5 text-green-600" />
                {resultado.alterados === 0 ? "Nenhum valor mudou, mas a edição manual foi registrada." : `${resultado.alterados} ${resultado.alterados === 1 ? "navalha alterada" : "navalhas alteradas"}.`}
              </p>
              {resultado.semMudanca > 0 && resultado.alterados > 0 && <p className="text-xs text-muted-foreground">{resultado.semMudanca} já estavam com esse IPI.</p>}
              <p className="text-xs text-muted-foreground">Preços-base e a data do último reajuste não mudaram. Propostas já emitidas continuam como estavam.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {opcoes.length > 1 && (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="text-xs font-semibold text-muted-foreground">Quais navalhas alterar</legend>
                  {opcoes.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                      <input type="radio" name="alcance-ipi" checked={escolhida === o.id} onChange={() => setEscolhida(o.id)} />
                      {o.rotulo} <span className="text-xs text-muted-foreground">({o.produtoIds.length} {o.produtoIds.length === 1 ? "peça" : "peças"})</span>
                    </label>
                  ))}
                </fieldset>
              )}
              {opcoes.length === 1 && opcao && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{opcao.rotulo} ({opcao.produtoIds.length} {opcao.produtoIds.length === 1 ? "peça" : "peças"})</p>}

              <label className="flex max-w-xs flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Novo IPI (%)</span>
                <input inputMode="decimal" value={ipi} onChange={(e) => setIpi(e.target.value)} placeholder="Ex.: 5,20" className={campo} aria-invalid={Boolean(erroIpi)} />
                {erroIpi && <span className="text-xs text-amber-700 dark:text-amber-300">{erroIpi}</span>}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Motivo *</span>
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ex.: Alíquota diferente para este material" className={campo} />
              </label>

              {avisos.map((a) => (
                <p key={a} className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{a}</p>
              ))}
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Só o IPI muda: preços-base, quantidades e a data do último reajuste ficam como estão. A alteração fica registrada com o valor anterior e o responsável, e o IPI passa a ser protegido (não volta ao padrão de 5,20% sozinho). Propostas já emitidas não mudam.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          {resultado ? (
            <button type="button" onClick={aoConcluir} className="h-10 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white">Fechar</button>
          ) : (
            <>
              <button type="button" onClick={aoFechar} disabled={pendente} className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="button" onClick={gravar} disabled={pendente || !podeGravar} className="flex h-10 items-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white disabled:opacity-50">
                {pendente && <Loader2 className="h-4 w-4 animate-spin" />}Gravar IPI
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

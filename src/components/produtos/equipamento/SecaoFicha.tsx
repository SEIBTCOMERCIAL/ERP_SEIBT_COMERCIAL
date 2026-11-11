"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { atualizarFichaTecnica } from "@/app/actions/produtos-admin";
import { Aviso, botaoPrimario, botaoSecundario, campoCls } from "../base";
import type { ContextoEquipamento } from "./EquipamentoPagina";

/** Ficha técnica: leitura e edição separadas. Salvar só altera os campos mudados; o restante da ficha é preservado. */
export function SecaoFicha({ ctx, campos }: { ctx: ContextoEquipamento; campos: string[] }) {
  const router = useRouter();
  const { equip, linha, admin } = ctx;
  const atuais = useMemo(() => Object.fromEntries(campos.map((c) => [c, String(equip.specs[c] ?? "")])), [campos, equip.specs]);
  const foraDoModelo = Object.entries(equip.specs).filter(([k, v]) => !campos.includes(k) && String(v ?? "").trim() !== "");
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>(atuais);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const alterado = campos.some((c) => (valores[c] ?? "") !== atuais[c]);

  useEffect(() => { if (!editando) setValores(atuais); }, [atuais, editando]);
  useEffect(() => { ctx.aoSujar("ficha", editando && alterado); }, [ctx, editando, alterado]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setOk(null);
    iniciar(async () => {
      try {
        const r = await atualizarFichaTecnica(linha.id, equip.id, ctx.versao, valores);
        if (!r.ok) { setErro(r.erro); return; }
        ctx.aoNovaVersao(r.versao);
        setOk(`Ficha salva (${r.alterados} ${r.alterados === 1 ? "campo alterado" : "campos alterados"}).`);
        setEditando(false);
        router.refresh();
      } catch { setErro("Não foi possível salvar. Seus dados foram mantidos; tente novamente."); }
    });
  }

  if (campos.length === 0) {
    return <Aviso tipo="info">Esta linha ainda não tem modelo de ficha técnica. {admin ? "Configure em Produtos → a linha → ⋮ → Modelo da ficha técnica." : "Peça ao administrador para configurar."}</Aviso>;
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      {ok && <Aviso tipo="sucesso">{ok}</Aviso>}
      {erro && <Aviso>{erro}</Aviso>}
      <form onSubmit={salvar} className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Especificações técnicas <span className="ml-1 text-xs font-normal text-muted-foreground">aparecem no catálogo</span></h2>
          {admin && !editando && <button type="button" className={botaoSecundario} onClick={() => { setEditando(true); setOk(null); }}><Pencil className="h-4 w-4" />Editar ficha</button>}
        </div>
        <dl className="grid sm:grid-cols-2">
          {campos.map((c, i) => (
            <div key={c} className={`border-b border-border px-4 py-3 ${i % 2 === 0 ? "sm:border-r" : ""}`}>
              <dt className="mb-1 text-xs text-muted-foreground">{c}</dt>
              <dd>
                {editando
                  ? <input aria-label={c} value={valores[c] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [c]: e.target.value }))} maxLength={200} className={campoCls} />
                  : atuais[c].trim() ? <span className="text-sm font-semibold text-foreground">{atuais[c]}</span> : <span className="text-sm text-amber-700 dark:text-amber-300">Sem valor</span>}
              </dd>
            </div>
          ))}
        </dl>
        {editando && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
            {alterado && <span className="mr-auto text-xs text-amber-700 dark:text-amber-300">Alterações não salvas</span>}
            <button type="button" className={botaoSecundario} disabled={pendente} onClick={() => { setValores(atuais); setEditando(false); setErro(null); }}>Cancelar</button>
            <button type="submit" className={botaoPrimario} disabled={pendente || !alterado}>{pendente ? "Salvando…" : "Salvar ficha"}</button>
          </div>
        )}
      </form>
      {foraDoModelo.length > 0 && (
        <section aria-label="Campos fora do modelo" className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Campos fora do modelo atual <span className="text-xs font-normal text-muted-foreground">— preservados, não aparecem no catálogo</span></h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {foraDoModelo.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v)}</dd></div>)}
          </dl>
        </section>
      )}
    </div>
  );
}

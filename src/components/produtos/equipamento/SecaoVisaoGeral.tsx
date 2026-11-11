"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Pencil } from "lucide-react";
import { editarEquipamento } from "@/app/actions/produtos-admin";
import { rotulosPainel } from "@/lib/produtos/painel";
import { Aviso, areaCls, botaoPrimario, botaoSecundario, Campo } from "../base";
import { CampoTexto } from "../campos";
import type { ContextoEquipamento } from "./EquipamentoPagina";

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-[#2074B9] hover:underline"
      onClick={() => navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); }).catch(() => undefined)}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{ok ? "Copiado" : "Copiar"}
    </button>
  );
}

/** Visão geral: dados do cadastro em modo leitura, com edição separada e aviso de alterações não salvas. */
export function SecaoVisaoGeral({ ctx, faltando, totalPecas, totalArquivos, aoAbrir }: {
  ctx: ContextoEquipamento; faltando: number; totalPecas: number; totalArquivos: number; aoAbrir: (s: "ficha" | "pecas" | "arquivos") => void;
}) {
  const router = useRouter();
  const { equip, linha, admin } = ctx;
  const rot = rotulosPainel(linha.nome);
  const original = useMemo(() => ({
    codigo: equip.codigo, descricao: equip.descricao, descPainel: equip.descricao_painel ?? "", potencia: equip.potencia_motor ?? "", ncm: equip.ncm ?? "",
  }), [equip]);
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState(original);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendente, iniciar] = useTransition();
  const alterado = JSON.stringify(f) !== JSON.stringify(original);
  const set = (k: keyof typeof f) => (v: string) => setF((a) => ({ ...a, [k]: v }));

  // Se os dados mudarem no servidor e não há edição em andamento, o formulário acompanha.
  useEffect(() => { if (!editando) setF(original); }, [original, editando]);
  useEffect(() => { ctx.aoSujar("geral", editando && alterado); }, [ctx, editando, alterado]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setOk(false);
    const mudou: Record<string, string> = {};
    if (f.codigo !== original.codigo) mudou.codigo = f.codigo;
    if (f.descricao !== original.descricao) mudou.descricao = f.descricao;
    if (f.descPainel !== original.descPainel) mudou.descricaoPainel = f.descPainel;
    if (f.potencia !== original.potencia) mudou.potenciaMotor = f.potencia;
    if (f.ncm !== original.ncm) mudou.ncm = f.ncm;
    iniciar(async () => {
      try {
        const r = await editarEquipamento(linha.id, equip.id, ctx.versao, mudou);
        if (!r.ok) { setErro(r.erro); return; }
        ctx.aoNovaVersao(r.versao);
        setOk(true); setEditando(false);
        router.refresh();
      } catch { setErro("Não foi possível salvar. Seus dados foram mantidos; tente novamente."); }
    });
  }

  const bloco = (titulo: string, texto: string | null, copiar = false) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>{copiar && texto && <Copiar texto={texto} />}</div>
      {texto ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{texto}</p> : <p className="text-sm text-muted-foreground">Não cadastrado.</p>}
    </div>
  );

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      {ok && <Aviso tipo="sucesso">Dados salvos.</Aviso>}
      {erro && <Aviso>{erro}</Aviso>}

      {(faltando > 0 || totalArquivos === 0) && (
        <Aviso tipo="alerta">
          Pendências do cadastro:
          {faltando > 0 && <> <button type="button" className="font-medium underline" onClick={() => aoAbrir("ficha")}>{faltando} {faltando === 1 ? "campo" : "campos"} da ficha técnica sem valor</button>.</>}
          {totalArquivos === 0 && <> <button type="button" className="font-medium underline" onClick={() => aoAbrir("arquivos")}>Nenhuma foto cadastrada</button>.</>}
        </Aviso>
      )}

      {!editando ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {bloco("Descrição (texto do orçamento)", equip.descricao, true)}
            {bloco(`Descrição do painel (${rot.usoDescricao})`, equip.descricao_painel, true)}
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3"><dt className="text-xs text-muted-foreground">Potência do motor</dt><dd className="text-sm font-medium">{equip.potencia_motor ?? "—"}</dd></div>
            <div className="rounded-xl border border-border bg-card p-3"><dt className="text-xs text-muted-foreground">NCM</dt><dd className="text-sm font-medium">{equip.ncm ?? "—"}</dd></div>
            <button type="button" onClick={() => aoAbrir("pecas")} className="rounded-xl border border-border bg-card p-3 text-left hover:bg-muted"><span className="block text-xs text-muted-foreground">Peças compatíveis</span><span className="text-sm font-medium">{totalPecas}</span></button>
            <button type="button" onClick={() => aoAbrir("arquivos")} className="rounded-xl border border-border bg-card p-3 text-left hover:bg-muted"><span className="block text-xs text-muted-foreground">Arquivos</span><span className="text-sm font-medium">{totalArquivos}</span></button>
          </dl>
          {admin && <div><button type="button" className={botaoPrimario} onClick={() => { setEditando(true); setOk(false); }}><Pencil className="h-4 w-4" />Editar dados</button></div>}
        </>
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Código / nome (título do card)" obrigatorio><CampoTexto valor={f.codigo} aoMudar={set("codigo")} required maxLength={120} /></Campo>
            <Campo rotulo="NCM"><CampoTexto valor={f.ncm} aoMudar={set("ncm")} maxLength={20} /></Campo>
          </div>
          <Campo rotulo="Potência do motor"><CampoTexto valor={f.potencia} aoMudar={set("potencia")} maxLength={60} /></Campo>
          <Campo rotulo="Descrição (texto usado no orçamento)" obrigatorio><textarea value={f.descricao} onChange={(e) => set("descricao")(e.target.value)} rows={8} required className={areaCls} /></Campo>
          <Campo rotulo={`Descrição do painel (${rot.usoDescricao})`}><textarea value={f.descPainel} onChange={(e) => set("descPainel")(e.target.value)} rows={4} className={areaCls} /></Campo>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
            {alterado && <span className="mr-auto text-xs text-amber-700 dark:text-amber-300">Alterações não salvas</span>}
            <button type="button" className={botaoSecundario} disabled={pendente} onClick={() => { setF(original); setEditando(false); setErro(null); }}>Cancelar</button>
            <button type="submit" className={botaoPrimario} disabled={pendente || !alterado}>{pendente ? "Salvando…" : "Salvar"}</button>
          </div>
        </form>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Tag } from "lucide-react";
import { editarEquipamento } from "@/app/actions/produtos-admin";
import { DetalheItem, type Cambio } from "@/components/reajuste/DetalheItem";
import { JanelaReajuste, type AlvoReajuste } from "@/components/reajuste/JanelaReajuste";
import { fmtBRL } from "@/components/reajuste/formatar";
import type { ItemLista } from "@/lib/reajuste/tipos";
import { rotulosPainel } from "@/lib/produtos/painel";
import { totaisComPainel } from "@/lib/produtos/regras";
import { parseMoedaOpcional } from "@/lib/reajuste/regras";
import { Aviso, botaoPrimario, botaoSecundario, Campo } from "../base";
import { CampoMoeda } from "../campos";
import type { ContextoEquipamento } from "./EquipamentoPagina";

/** Preços vigentes (vêm do Reajuste). Painéis são opções: máquina + 220 V e máquina + 380 V aparecem separados. */
export function SecaoPrecos({ ctx, hoje, cambio }: { ctx: ContextoEquipamento; hoje: string; cambio: Cambio | null }) {
  const router = useRouter();
  const { equip, linha, admin } = ctx;
  const rot = rotulosPainel(linha.nome);
  const [janela, setJanela] = useState<AlvoReajuste | null>(null);
  const [historico, setHistorico] = useState<ItemLista | null>(null);
  const [inicial, setInicial] = useState({ preco: "", p220: "", p380: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const item: ItemLista = useMemo(() => ({
    id: equip.id, codigo: equip.codigo, descricao: equip.descricao, modelo: null, tipo: "maquina", ativo: equip.situacao !== "inativo",
    solicitar_engenharia: equip.solicitar_engenharia, ipi_pct: 0, situacao: "sem_reajuste", reajustados: [], pendentes: [], ultimo: null, escopo_nome: linha.nome,
    precos: { moinho: equip.preco_brl, painel_220: equip.preco_painel_220, painel_380: equip.preco_painel_380 },
  }), [equip, linha.nome]);

  const t = totaisComPainel(equip.preco_brl, equip.preco_painel_220, equip.preco_painel_380);
  const temPreco = equip.preco_brl !== null || equip.preco_painel_220 !== null || equip.preco_painel_380 !== null;
  const vazios = [
    { k: "preco" as const, nome: "Máquina", falta: equip.preco_brl === null },
    { k: "p220" as const, nome: rot.p220, falta: equip.preco_painel_220 === null },
    { k: "p380" as const, nome: rot.p380, falta: equip.preco_painel_380 === null },
  ].filter((v) => v.falta);
  const preenchidos = Object.entries(inicial).filter(([, v]) => v.trim() !== "");
  const invalido = preenchidos.some(([, v]) => parseMoedaOpcional(v).erro !== undefined);

  function salvarInicial(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setOk(null);
    iniciar(async () => {
      try {
        const r = await editarEquipamento(linha.id, equip.id, ctx.versao, {
          ...(inicial.preco.trim() ? { precoBrl: inicial.preco } : {}), ...(inicial.p220.trim() ? { preco220: inicial.p220 } : {}), ...(inicial.p380.trim() ? { preco380: inicial.p380 } : {}),
        });
        if (!r.ok) { setErro(r.erro); return; }
        ctx.aoNovaVersao(r.versao);
        setInicial({ preco: "", p220: "", p380: "" });
        setOk("Preço inicial registrado no histórico.");
        router.refresh();
      } catch { setErro("Não foi possível salvar. Seus dados foram mantidos; tente novamente."); }
    });
  }

  function alternarConsulta() {
    const novo = !equip.solicitar_engenharia;
    if (!confirm(novo ? "Marcar como preço sob consulta (solicitar com a Engenharia)? Os valores ficam guardados." : "Remover a marca de preço sob consulta?")) return;
    setErro(null); setOk(null);
    iniciar(async () => {
      const r = await editarEquipamento(linha.id, equip.id, ctx.versao, { solicitarEngenharia: novo }).catch(() => null);
      if (!r) { setErro("Não foi possível salvar. Tente novamente."); return; }
      if (!r.ok) { setErro(r.erro); return; }
      ctx.aoNovaVersao(r.versao); router.refresh();
    });
  }

  const linhaPreco = (nome: string, valor: number | null) => (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{nome}</span>
      <span className="text-sm font-semibold tabular-nums">{valor === null ? <span className="font-normal text-muted-foreground">não cadastrado</span> : fmtBRL(valor)}</span>
    </div>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {ok && <Aviso tipo="sucesso">{ok}</Aviso>}
      {erro && <Aviso>{erro}</Aviso>}
      {equip.solicitar_engenharia && <Aviso tipo="alerta"><strong>Preço sob consulta:</strong> este equipamento aparece como “Solicitar com a Engenharia”. Os valores abaixo ficam guardados.</Aviso>}

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Valores vigentes</h2>
        <p className="mb-1 text-xs text-muted-foreground">Alterações de preço são feitas pelo Reajuste e ficam no histórico; o catálogo e as propostas novas usam estes valores.</p>
        {linhaPreco("Máquina", equip.preco_brl)}
        {linhaPreco(rot.p220, equip.preco_painel_220)}
        {linhaPreco(rot.p380, equip.preco_painel_380)}
      </div>

      {(t.com220 !== null || t.com380 !== null) && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Total por opção de painel</h2>
          <p className="mb-1 text-xs text-muted-foreground">Cada painel é uma opção: os dois não são somados entre si.</p>
          {t.com220 !== null && linhaPreco(`${rot.compartilhado ? "Exaustor" : "Máquina"} + ${rot.p220}`, t.com220)}
          {t.com380 !== null && linhaPreco(`${rot.compartilhado ? "Exaustor" : "Máquina"} + ${rot.p380}`, t.com380)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {temPreco && <button type="button" className={botaoSecundario} onClick={() => setHistorico(item)}><History className="h-4 w-4" />Histórico de preços</button>}
        {admin && temPreco && <button type="button" className={botaoPrimario} onClick={() => setJanela({ escopo: { tipo: "itens", ids: [equip.id] }, tipo: "maquina", titulo: `${equip.codigo}`, item })}><Tag className="h-4 w-4" />Reajustar preços</button>}
        {admin && <button type="button" className={botaoSecundario} disabled={pendente} onClick={alternarConsulta}>{equip.solicitar_engenharia ? "Remover “sob consulta”" : "Marcar como sob consulta"}</button>}
      </div>

      {admin && vazios.length > 0 && (
        <form onSubmit={salvarInicial} className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Cadastrar preço inicial</h2>
          <p className="mb-3 text-xs text-muted-foreground">Só para o que ainda não tem preço. Fica registrado no histórico como preço inicial; depois, só muda pelo Reajuste.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {vazios.map((v) => (
              <Campo key={v.k} rotulo={v.nome}><CampoMoeda valor={inicial[v.k]} aoMudar={(x) => setInicial((a) => ({ ...a, [v.k]: x }))} rotulo={`Preço inicial ${v.nome}`} /></Campo>
            ))}
          </div>
          <div className="mt-3 flex justify-end"><button type="submit" className={botaoPrimario} disabled={pendente || preenchidos.length === 0 || invalido}>{pendente ? "Salvando…" : "Registrar preço inicial"}</button></div>
        </form>
      )}

      <DetalheItem item={historico} hoje={hoje} cambio={cambio} aoFechar={() => setHistorico(null)} aoReajustar={(i) => { setHistorico(null); setJanela({ escopo: { tipo: "itens", ids: [i.id] }, tipo: "maquina", titulo: i.codigo, item: i }); }} />
      {janela && <JanelaReajuste alvo={janela} aoFechar={() => setJanela(null)} aoConcluir={() => { setJanela(null); router.refresh(); }} />}
    </div>
  );
}

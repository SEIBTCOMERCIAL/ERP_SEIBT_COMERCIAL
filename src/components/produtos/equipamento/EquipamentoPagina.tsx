"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy, Eye, EyeOff, ImageOff, MoreVertical, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { alterarSituacao, duplicarEquipamento } from "@/app/actions/produtos-admin";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Jogo } from "@/lib/propostas/jogos-navalha";
import { tituloComSeparador } from "@/lib/produto-titulo";
import { camposFaltando } from "@/lib/produtos/regras";
import type { ArquivoProduto, EquipamentoDetalheDados } from "@/lib/produtos/tipos";
import { Aviso, botaoSecundario, SituacaoPill, useAvisoSaida } from "../base";
import { SecaoArquivos } from "./SecaoArquivos";
import { SecaoFicha } from "./SecaoFicha";
import { SecaoPecas } from "./SecaoPecas";
import { SecaoPrecos } from "./SecaoPrecos";
import { SecaoVisaoGeral } from "./SecaoVisaoGeral";

export interface ContextoEquipamento {
  admin: boolean;
  linha: { id: string; nome: string; familia: string | null };
  equip: EquipamentoDetalheDados;
  versao: string | null;
  aoNovaVersao: (v: string | null) => void;
  aoSujar: (secao: string, sujo: boolean) => void;
}

type SecaoId = "geral" | "ficha" | "precos" | "pecas" | "arquivos";

export function EquipamentoPagina({ admin, linha, equip, campos, categorias, arquivos, arquivosErro, contagemVinculos, jogos, jogosDisponivel, hoje, cambio, voltar, secaoInicial }: {
  admin: boolean;
  linha: { id: string; nome: string; familia: string | null };
  equip: EquipamentoDetalheDados;
  campos: Array<{ id: string; nome: string; ordem: number }>;
  categorias: Array<{ id: string; nome: string; ordem: number }>;
  arquivos: ArquivoProduto[];
  arquivosErro: boolean;
  contagemVinculos: Record<string, number>;
  jogos: Jogo[];
  jogosDisponivel: boolean;
  hoje: string;
  cambio: { taxa: number; desde: string } | null;
  voltar: string;
  secaoInicial: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [verComoUsuario, setVerComoUsuario] = useState(false);
  const efetivoAdmin = admin && !verComoUsuario;
  const [versao, setVersao] = useState<string | null>(equip.versao);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [sujas, setSujas] = useState<Record<string, boolean>>({});
  const inicial = (["geral", "ficha", "precos", "pecas", "arquivos"] as const).includes(secaoInicial as SecaoId) ? (secaoInicial as SecaoId) : "geral";
  const [secao, setSecao] = useState<SecaoId>(inicial);
  const [visitadas, setVisitadas] = useState<Set<SecaoId>>(new Set([inicial]));

  // A versão do cadastro (para detectar edição simultânea) acompanha o que veio do servidor.
  useEffect(() => { setVersao(equip.versao); }, [equip.versao]);
  useAvisoSaida(Object.values(sujas).some(Boolean));

  const ctx: ContextoEquipamento = useMemo(() => ({
    admin: efetivoAdmin, linha, equip, versao, aoNovaVersao: setVersao,
    aoSujar: (s, v) => setSujas((a) => (a[s] === v ? a : { ...a, [s]: v })),
  }), [efetivoAdmin, linha, equip, versao]);

  const faltando = camposFaltando(campos.map((c) => c.nome), equip.specs);
  const totalPecas = Object.values(contagemVinculos).reduce((s, n) => s + n, 0);
  const principal = arquivos.find((a) => a.principal)?.url ?? equip.foto_url;

  function trocarSecao(s: SecaoId) {
    setSecao(s);
    setVisitadas((v) => new Set(v).add(s));
    const p = new URLSearchParams(window.location.search);
    p.set("secao", s);
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }

  function acao(a: "duplicar" | "descontinuar" | "reativar" | "excluir") {
    setMensagem(null);
    const nome = equip.codigo;
    const texto = a === "excluir" ? `Excluir "${nome}"? Ele sai das telas e das propostas novas; o histórico de preços é preservado.`
      : a === "descontinuar" ? `Descontinuar "${nome}"? Ele deixa de aparecer em propostas novas e no catálogo, mas continua cadastrado.`
      : a === "reativar" ? `Reativar "${nome}"?` : null;
    if (texto && !confirm(texto)) return;
    iniciar(async () => {
      if (a === "duplicar") {
        const r = await duplicarEquipamento(linha.id, equip.id).catch(() => null);
        if (!r) setMensagem({ tipo: "erro", texto: "Não foi possível duplicar. Tente novamente." });
        else if (!r.ok) setMensagem({ tipo: "erro", texto: r.erro });
        else router.push(`/produtos/linhas/${linha.id}/${r.id}`);
        return;
      }
      const r = await alterarSituacao(equip.id, a).catch(() => null);
      if (!r) setMensagem({ tipo: "erro", texto: "Não foi possível concluir. Tente novamente." });
      else if (!r.ok) setMensagem({ tipo: "erro", texto: r.erro });
      else if (a === "excluir") router.push(`/produtos${voltar}`);
      else router.refresh();
    });
  }

  const abas: Array<{ id: SecaoId; nome: string; badge?: string; alerta?: boolean }> = [
    { id: "geral", nome: "Visão geral" },
    { id: "ficha", nome: "Ficha técnica", badge: faltando.length ? `${faltando.length} pendente${faltando.length === 1 ? "" : "s"}` : undefined, alerta: faltando.length > 0 },
    { id: "precos", nome: "Preços" },
    { id: "pecas", nome: "Peças compatíveis", badge: totalPecas ? String(totalPecas) : undefined },
    { id: "arquivos", nome: "Arquivos", badge: arquivos.length ? String(arquivos.length) : undefined },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
      <nav aria-label="Navegação" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href={`/produtos${voltar}`} className="text-[#2074B9] hover:underline">Produtos</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
        {linha.familia && <><span>{linha.familia}</span><ChevronRight className="h-3.5 w-3.5" aria-hidden /></>}
        <Link href={`/produtos?escopo=${linha.id}`} className="text-[#2074B9] hover:underline">{linha.nome}</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium text-foreground">{equip.codigo}</span>
      </nav>

      {verComoUsuario && <Aviso tipo="alerta">Modo de visualização: você está vendo como um vendedor. Edições desativadas.</Aviso>}
      {mensagem && <Aviso tipo={mensagem.tipo === "erro" ? "erro" : "sucesso"}>{mensagem.texto}</Aviso>}

      <header className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-card p-4">
        <button type="button" onClick={() => trocarSecao("arquivos")} title={efetivoAdmin ? "Gerenciar fotos" : "Ver imagens"} aria-label="Ver imagens do equipamento"
          className="flex h-28 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
          {principal
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={principal} alt={`Foto de ${equip.codigo}`} className="h-full w-full object-contain p-1" />
            : <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground"><ImageOff className="h-5 w-5" aria-hidden />Sem foto</span>}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-xl font-bold leading-snug text-foreground">{tituloComSeparador(equip.codigo)}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{[linha.familia, linha.nome].filter(Boolean).join(" · ")}{equip.potencia_motor ? ` · ${equip.potencia_motor}` : ""}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SituacaoPill situacao={equip.situacao} />
            {equip.solicitar_engenharia && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">Preço sob consulta</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {admin && (
            <button type="button" className={botaoSecundario} onClick={() => setVerComoUsuario((v) => !v)} aria-pressed={verComoUsuario}>
              {verComoUsuario ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{verComoUsuario ? "Sair do modo usuário" : "Ver como usuário"}
            </button>
          )}
          {efetivoAdmin && (
            <>
              <button type="button" className={botaoSecundario} disabled={pendente} onClick={() => acao("duplicar")}><Copy className="h-4 w-4" />Duplicar</button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" aria-label="Mais ações" className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><MoreVertical className="h-4 w-4" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {equip.situacao === "descontinuado"
                    ? <DropdownMenuItem className="cursor-pointer" onSelect={() => setTimeout(() => acao("reativar"), 0)}><PlayCircle className="text-green-600" /> Reativar</DropdownMenuItem>
                    : <DropdownMenuItem className="cursor-pointer" onSelect={() => setTimeout(() => acao("descontinuar"), 0)}><PauseCircle className="text-amber-600" /> Descontinuar</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => setTimeout(() => acao("excluir"), 0)}><Trash2 /> Excluir…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>

      <div role="tablist" aria-label="Seções do equipamento" className="flex gap-1 overflow-x-auto border-b border-border">
        {abas.map((a) => (
          <button key={a.id} type="button" role="tab" id={`aba-${a.id}`} aria-selected={secao === a.id} aria-controls={`secao-${a.id}`} onClick={() => trocarSecao(a.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium ${secao === a.id ? "border-[#2C4F79] text-[#2C4F79] dark:text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {a.nome}
            {a.badge && <span className={`rounded-full px-1.5 text-xs font-semibold ${a.alerta ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}>{a.badge}</span>}
            {sujas[a.id] && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Alterações não salvas" aria-label="alterações não salvas" />}
          </button>
        ))}
      </div>

      <div id="secao-geral" role="tabpanel" aria-labelledby="aba-geral" hidden={secao !== "geral"}>
        <SecaoVisaoGeral ctx={ctx} faltando={faltando.length} totalPecas={totalPecas} totalArquivos={arquivos.length} aoAbrir={trocarSecao} />
      </div>
      <div id="secao-ficha" role="tabpanel" aria-labelledby="aba-ficha" hidden={secao !== "ficha"}>
        {visitadas.has("ficha") && <SecaoFicha ctx={ctx} campos={campos.map((c) => c.nome)} />}
      </div>
      <div id="secao-precos" role="tabpanel" aria-labelledby="aba-precos" hidden={secao !== "precos"}>
        {visitadas.has("precos") && <SecaoPrecos ctx={ctx} hoje={hoje} cambio={cambio} />}
      </div>
      <div id="secao-pecas" role="tabpanel" aria-labelledby="aba-pecas" hidden={secao !== "pecas"}>
        {visitadas.has("pecas") && <SecaoPecas ctx={ctx} categorias={categorias} contagem={contagemVinculos} jogos={jogos} jogosDisponivel={jogosDisponivel} />}
      </div>
      <div id="secao-arquivos" role="tabpanel" aria-labelledby="aba-arquivos" hidden={secao !== "arquivos"}>
        {visitadas.has("arquivos") && <SecaoArquivos ctx={ctx} arquivos={arquivos} erroCarga={arquivosErro} />}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { AlertTriangle, Copy, ImageOff, MoreVertical, Pencil, PauseCircle, PlayCircle, Tag, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { tituloComSeparador } from "@/lib/produto-titulo";
import { formatarData } from "@/lib/reajuste/regras";
import type { ProdutoLista } from "@/lib/produtos/tipos";
import { fmtBRL } from "@/components/reajuste/formatar";
import { SituacaoPill } from "./base";

export type AcaoLista = "abrir_peca" | "reajustar" | "duplicar" | "descontinuar" | "reativar" | "excluir";
export type Visao = "tabela" | "cards";

interface Props {
  itens: ProdutoLista[];
  aba: "maquinas" | "pecas";
  visao: Visao;
  admin: boolean;
  /** Mostra linha/categoria nos resultados (quando a lista cruza vários grupos). */
  mostrarGrupo: boolean;
  hrefDetalhe: (p: ProdutoLista) => string;
  aoAcao: (acao: AcaoLista, p: ProdutoLista) => void;
  ocupado: boolean;
}

function Miniatura({ p, grande = false }: { p: ProdutoLista; grande?: boolean }) {
  const tamanho = grande ? "h-40 w-full" : "h-10 w-12";
  return p.foto_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.foto_url} alt="" loading="lazy" className={`${tamanho} shrink-0 rounded-md border border-border bg-white object-contain`} />
  ) : (
    <span className={`${tamanho} flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground`} title="Sem foto"><ImageOff className="h-4 w-4" aria-hidden /></span>
  );
}

function Pendencias({ p }: { p: ProdutoLista }) {
  if (p.pendencias.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span title={`Falta: ${p.pendencias.join(", ")}`} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangle className="h-3 w-3" aria-hidden />{p.pendencias.length === 1 ? p.pendencias[0] : `${p.pendencias.length} pendências`}
    </span>
  );
}

function Menu({ p, admin, aoAcao, ocupado }: { p: ProdutoLista; admin: boolean; aoAcao: Props["aoAcao"]; ocupado: boolean }) {
  if (!admin) return null;
  const item = "cursor-pointer";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Mais ações — ${p.codigo}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2074B9]/40">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {p.tipo === "peca" && <DropdownMenuItem className={item} onSelect={() => setTimeout(() => aoAcao("abrir_peca", p), 0)}><Pencil /> Ver e editar</DropdownMenuItem>}
        {p.preco_brl !== null && <DropdownMenuItem className={item} onSelect={() => setTimeout(() => aoAcao("reajustar", p), 0)}><Tag /> Reajustar preço</DropdownMenuItem>}
        {p.tipo === "maquina" && <DropdownMenuItem className={item} disabled={ocupado} onSelect={() => setTimeout(() => aoAcao("duplicar", p), 0)}><Copy /> Duplicar</DropdownMenuItem>}
        {p.situacao === "descontinuado"
          ? <DropdownMenuItem className={item} disabled={ocupado} onSelect={() => setTimeout(() => aoAcao("reativar", p), 0)}><PlayCircle className="text-green-600" /> Reativar</DropdownMenuItem>
          : <DropdownMenuItem className={item} disabled={ocupado} onSelect={() => setTimeout(() => aoAcao("descontinuar", p), 0)}><PauseCircle className="text-amber-600" /> Descontinuar</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={`${item} text-red-600 focus:bg-red-50 focus:text-red-700`} disabled={ocupado} onSelect={() => setTimeout(() => aoAcao("excluir", p), 0)}><Trash2 /> Excluir…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Titulo({ p, href, aoAcao }: { p: ProdutoLista; href: string; aoAcao: Props["aoAcao"] }) {
  const maquina = p.tipo === "maquina";
  const principal = maquina ? tituloComSeparador(p.codigo) : p.descricao || p.codigo;
  const secundario = maquina ? [p.potencia_motor, p.linha_nome].filter(Boolean).join(" · ") : p.codigo;
  const conteudo = (
    <>
      <span className="block truncate font-semibold text-foreground group-hover:text-[#2074B9]" title={principal}>{principal}</span>
      <span className={`block truncate text-xs text-muted-foreground ${maquina ? "" : "font-mono"}`}>{secundario || "—"}</span>
    </>
  );
  return maquina
    ? <Link href={href} className="group block min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[#2074B9]/40">{conteudo}</Link>
    : <button type="button" onClick={() => aoAcao("abrir_peca", p)} className="group block min-w-0 max-w-full rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-[#2074B9]/40">{conteudo}</button>;
}

const preco = (v: number | null, titulo: string) => (v === null ? <span className="text-muted-foreground" title={titulo}>—</span> : <span className="tabular-nums">{fmtBRL(v)}</span>);

export function ListaProdutos(p: Props) {
  const maquinas = p.aba === "maquinas";

  const cards = (
    <ul className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${p.visao === "tabela" ? "md:hidden" : ""}`}>
      {p.itens.map((i) => (
        <li key={i.id} className={`flex flex-col gap-3 rounded-xl border border-border bg-card p-3 ${i.situacao === "descontinuado" ? "opacity-70" : ""}`}>
          {maquinas && <Link href={p.hrefDetalhe(i)} tabIndex={-1} aria-hidden><Miniatura p={i} grande /></Link>}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><Titulo p={i} href={p.hrefDetalhe(i)} aoAcao={p.aoAcao} /></div>
            <Menu p={i} admin={p.admin} aoAcao={p.aoAcao} ocupado={p.ocupado} />
          </div>
          <div className="flex flex-wrap items-center gap-2"><SituacaoPill situacao={i.situacao} /><Pendencias p={i} />
            {p.mostrarGrupo && <span className="text-xs text-muted-foreground">{maquinas ? i.linha_nome : i.categoria_peca_nome}</span>}</div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {maquinas ? (
              <>
                <div><dt className="text-xs text-muted-foreground">Máquina</dt><dd>{i.solicitar_engenharia ? <span className="text-xs text-amber-700 dark:text-amber-300">Sob consulta</span> : preco(i.preco_brl, "Preço não cadastrado")}</dd></div>
                <div><dt className="text-xs text-muted-foreground">220 V</dt><dd>{preco(i.preco_painel_220, "Sem painel 220 V")}</dd></div>
                <div><dt className="text-xs text-muted-foreground">380 V</dt><dd>{preco(i.preco_painel_380, "Sem painel 380 V")}</dd></div>
              </>
            ) : (
              <>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Preço</dt><dd>{preco(i.preco_brl, "Preço não cadastrado")}</dd></div>
                <div><dt className="text-xs text-muted-foreground">IPI</dt><dd className="tabular-nums">{i.ipi_pct ? `${i.ipi_pct.toLocaleString("pt-BR")}%` : "—"}</dd></div>
              </>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
  if (p.visao === "cards") return cards;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              {maquinas && <th className="w-16 px-3 py-2 font-semibold"><span className="sr-only">Foto</span></th>}
              <th className="px-3 py-2 font-semibold">{maquinas ? "Modelo" : "Peça"}</th>
              {p.mostrarGrupo && <th className="px-3 py-2 font-semibold">{maquinas ? "Linha" : "Categoria"}</th>}
              {maquinas ? (
                <><th className="px-3 py-2 text-right font-semibold">Máquina</th><th className="px-3 py-2 text-right font-semibold">Painel 220 V</th><th className="px-3 py-2 text-right font-semibold">Painel 380 V</th></>
              ) : (
                <><th className="px-3 py-2 text-right font-semibold">Preço</th><th className="px-3 py-2 text-right font-semibold">IPI</th></>
              )}
              <th className="px-3 py-2 font-semibold">Situação</th>
              <th className="px-3 py-2 font-semibold">Pendências</th>
              <th className="px-3 py-2 font-semibold">Atualizado</th>
              <th className="w-10 px-3 py-2"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {p.itens.map((i) => (
              <tr key={i.id} className={`border-t border-border ${i.situacao === "descontinuado" ? "opacity-70" : ""}`}>
                {maquinas && <td className="px-3 py-2"><Miniatura p={i} /></td>}
                <td className="max-w-[22rem] px-3 py-2"><Titulo p={i} href={p.hrefDetalhe(i)} aoAcao={p.aoAcao} /></td>
                {p.mostrarGrupo && <td className="px-3 py-2 text-muted-foreground">{maquinas ? i.linha_nome ?? "—" : i.categoria_peca_nome ?? "—"}</td>}
                {maquinas ? (
                  <>
                    <td className="px-3 py-2 text-right">{i.solicitar_engenharia ? <span className="text-xs text-amber-700 dark:text-amber-300">Sob consulta</span> : preco(i.preco_brl, "Preço não cadastrado")}</td>
                    <td className="px-3 py-2 text-right">{preco(i.preco_painel_220, "Sem painel 220 V")}</td>
                    <td className="px-3 py-2 text-right">{preco(i.preco_painel_380, "Sem painel 380 V")}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right">{preco(i.preco_brl, "Preço não cadastrado")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i.ipi_pct ? `${i.ipi_pct.toLocaleString("pt-BR")}%` : "—"}</td>
                  </>
                )}
                <td className="px-3 py-2"><SituacaoPill situacao={i.situacao} /></td>
                <td className="px-3 py-2"><Pendencias p={i} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{i.atualizado_em ? formatarData(i.atualizado_em) : "—"}</td>
                <td className="px-3 py-2"><Menu p={i} admin={p.admin} aoAcao={p.aoAcao} ocupado={p.ocupado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cards}
    </>
  );
}

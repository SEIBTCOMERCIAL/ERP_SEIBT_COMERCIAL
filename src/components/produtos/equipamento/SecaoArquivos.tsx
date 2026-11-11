"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { definirFotoCapaProduto } from "@/app/actions/catalogo";
import { enviarArquivoProduto, removerArquivoProduto } from "@/app/actions/produtos-admin";
import { prepararImagem } from "@/lib/imagem-cliente";
import { LIMITE_UPLOAD_TEXTO } from "@/lib/produtos/regras";
import type { ArquivoProduto } from "@/lib/produtos/tipos";
import { Aviso, botaoLeve, botaoSecundario } from "../base";
import type { ContextoEquipamento } from "./EquipamentoPagina";

/** Imagens (públicas, usadas no catálogo) e documentos (privados, com link temporário). */
export function SecaoArquivos({ ctx, arquivos, erroCarga }: { ctx: ContextoEquipamento; arquivos: ArquivoProduto[]; erroCarga: boolean }) {
  const router = useRouter();
  const { admin, equip, linha } = ctx;
  const imagens = arquivos.filter((a) => a.tipo === "imagem");
  const documentos = arquivos.filter((a) => a.tipo === "desenho");
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const inputImg = useRef<HTMLInputElement>(null);
  const inputDoc = useRef<HTMLInputElement>(null);

  function enviar(arquivo: File | undefined, finalidade: "imagem" | "documento") {
    if (!arquivo) return;
    setErro(null); setOk(null); setAvisos([]);
    iniciar(async () => {
      try {
        const pronto = finalidade === "imagem" ? await prepararImagem(arquivo) : arquivo;
        const fd = new FormData();
        fd.set("produto_id", equip.id); fd.set("finalidade", finalidade); fd.set("arquivo", pronto);
        const r = await enviarArquivoProduto(fd);
        if (!r.ok) { setErro(r.erro); return; }
        // A primeira imagem de um equipamento sem foto vira a foto principal (a mesma do catálogo).
        if (finalidade === "imagem" && r.url && !equip.foto_url && imagens.length === 0) {
          const c = await definirFotoCapaProduto(equip.id, linha.id, r.url).catch(() => null);
          if (c?.error) setAvisos([`Imagem enviada, mas não foi definida como principal: ${c.error}`]);
        }
        setOk(finalidade === "imagem" ? "Imagem enviada." : "Documento enviado.");
        router.refresh();
      } catch { setErro("Não foi possível enviar. Tente novamente."); }
      finally { if (inputImg.current) inputImg.current.value = ""; if (inputDoc.current) inputDoc.current.value = ""; }
    });
  }

  function tornarPrincipal(a: ArquivoProduto) {
    if (!a.url) return;
    setErro(null); setOk(null); setAvisos([]);
    iniciar(async () => {
      const r = await definirFotoCapaProduto(equip.id, linha.id, a.url).catch(() => null);
      if (!r) { setErro("Não foi possível alterar a foto principal."); return; }
      if (r.error) { setErro(r.error); return; }
      setOk("Foto principal atualizada (também no catálogo)."); router.refresh();
    });
  }

  function remover(a: ArquivoProduto) {
    const extra = a.principal ? " Ela é a foto principal: o catálogo passará a usar outra imagem (ou ficará sem foto)." : a.compartilhado ? " Este arquivo é compartilhado: só o vínculo com este equipamento é removido." : "";
    if (!confirm(`Remover "${a.nome}"?${extra}`)) return;
    setErro(null); setOk(null); setAvisos([]);
    iniciar(async () => {
      const r = await removerArquivoProduto(equip.id, a.id).catch(() => null);
      if (!r) { setErro("Não foi possível remover. Tente novamente."); return; }
      if (!r.ok) { setErro(r.erro); return; }
      setAvisos(r.avisos); setOk("Arquivo removido."); router.refresh();
    });
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {erroCarga && <Aviso>Não foi possível carregar a lista de arquivos. Atualize a página.</Aviso>}
      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tipo="sucesso">{ok}</Aviso>}
      {avisos.map((a) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}

      <section aria-label="Imagens">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Imagens <span className="font-normal text-muted-foreground">· {imagens.length}</span></h2>
          {admin && (
            <>
              <input ref={inputImg} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="enviar-imagem" onChange={(e) => enviar(e.target.files?.[0], "imagem")} disabled={pendente} />
              <label htmlFor="enviar-imagem" className={`${botaoSecundario} cursor-pointer ${pendente ? "opacity-50" : ""}`}><ImagePlus className="h-4 w-4" />{pendente ? "Enviando…" : "Enviar imagem"}</label>
            </>
          )}
        </div>
        {admin && <p className="mb-3 text-xs text-muted-foreground">JPG, PNG ou WebP · até {LIMITE_UPLOAD_TEXTO} (fotos maiores são reduzidas automaticamente antes do envio).</p>}
        {imagens.length === 0 ? <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma imagem cadastrada.</p> : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {imagens.map((a) => (
              <li key={a.id} className={`flex flex-col overflow-hidden rounded-xl border bg-card ${a.principal ? "border-[#2074B9]" : "border-border"}`}>
                <a href={a.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block bg-white" aria-label={`Abrir ${a.nome}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url ?? ""} alt={a.nome} loading="lazy" className="h-36 w-full object-contain p-1" />
                </a>
                <div className="flex flex-col gap-1 border-t border-border p-2">
                  <p className="truncate text-xs text-muted-foreground" title={a.nome}>{a.nome}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {a.principal && <span className="inline-flex items-center gap-1 rounded-full bg-[#2074B9]/10 px-2 py-0.5 text-xs font-medium text-[#2074B9]"><Star className="h-3 w-3" />Principal</span>}
                    {a.compartilhado && <span className="text-xs text-muted-foreground">compartilhada</span>}
                    {admin && !a.principal && <button type="button" className={botaoLeve} disabled={pendente} onClick={() => tornarPrincipal(a)}>Usar como principal</button>}
                    {admin && <button type="button" className={`${botaoLeve} ml-auto text-red-600`} disabled={pendente} onClick={() => remover(a)} aria-label={`Remover ${a.nome}`}><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Desenhos e documentos">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Desenhos e documentos <span className="font-normal text-muted-foreground">· {documentos.length}</span></h2>
          {admin && (
            <>
              <input ref={inputDoc} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" id="enviar-documento" onChange={(e) => enviar(e.target.files?.[0], "documento")} disabled={pendente} />
              <label htmlFor="enviar-documento" className={`${botaoSecundario} cursor-pointer ${pendente ? "opacity-50" : ""}`}><Upload className="h-4 w-4" />{pendente ? "Enviando…" : "Enviar documento"}</label>
            </>
          )}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">PDF, JPG ou PNG · até {LIMITE_UPLOAD_TEXTO}. Ficam em armazenamento privado: só usuários logados abrem, por link temporário.</p>
        {documentos.length === 0 ? <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhum desenho ou documento cadastrado.</p> : (
          <ul className="flex flex-col gap-2">
            {documentos.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm"><FileText className="h-5 w-5 shrink-0 text-[#2074B9]" aria-hidden /><span className="truncate font-medium" title={a.nome}>{a.nome}</span>{a.privado && <span className="shrink-0 text-xs text-muted-foreground">privado</span>}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[#2074B9] hover:bg-muted"><ExternalLink className="h-4 w-4" />Abrir</a> : <span className="text-xs text-muted-foreground" title="Sem permissão ou link indisponível">indisponível</span>}
                  {admin && <button type="button" className={`${botaoLeve} text-red-600`} disabled={pendente} onClick={() => remover(a)} aria-label={`Remover ${a.nome}`}><Trash2 className="h-4 w-4" /></button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

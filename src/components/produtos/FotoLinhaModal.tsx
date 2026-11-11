"use client";

import { useEffect, useState, useTransition } from "react";
import { definirFotoDaLinha, previaFotoDaLinha } from "@/app/actions/produtos-admin";
import { prepararImagem } from "@/lib/imagem-cliente";
import { LIMITE_UPLOAD_TEXTO } from "@/lib/produtos/regras";
import { Aviso, botaoPrimario, botaoSecundario, Modal } from "./base";

/** Foto única para os equipamentos da linha: mostra quantos serão afetados e pede a escolha entre preservar ou substituir fotos individuais. */
export function FotoLinhaModal({ linha, aoFechar, aoConcluir }: { linha: { id: string; nome: string }; aoFechar: () => void; aoConcluir: () => void }) {
  const [info, setInfo] = useState<{ total: number; comFotoPropria: number } | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modo, setModo] = useState<"preservar" | "substituir">("preservar");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    previaFotoDaLinha(linha.id).then((r) => (r.ok ? setInfo({ total: r.total, comFotoPropria: r.comFotoPropria }) : setErro(r.erro))).catch(() => setErro("Não foi possível consultar a linha."));
  }, [linha.id]);

  const afetados = info ? (modo === "substituir" ? info.total : info.total - info.comFotoPropria) : 0;

  function enviar() {
    if (!arquivo) return;
    setErro(null);
    iniciar(async () => {
      try {
        const pronto = await prepararImagem(arquivo);
        const fd = new FormData();
        fd.set("linha_id", linha.id); fd.set("modo", modo); fd.set("arquivo", pronto);
        const r = await definirFotoDaLinha(fd);
        if (!r.ok) { setErro(r.erro); return; }
        setResultado(`Foto aplicada em ${r.afetados} ${r.afetados === 1 ? "equipamento" : "equipamentos"}${r.preservados ? `; ${r.preservados} mantiveram a foto individual` : ""}. O catálogo já usa a nova foto.`);
      } catch { setErro("Não foi possível enviar a foto. Tente novamente."); }
    });
  }

  return (
    <Modal titulo={`Foto da linha — ${linha.nome}`} aoFechar={resultado ? aoConcluir : aoFechar} bloqueado={pendente}>
      <div className="flex flex-col gap-4 p-5">
        {erro && <Aviso>{erro}</Aviso>}
        {resultado ? <Aviso tipo="sucesso">{resultado}</Aviso> : (
          <>
            {info && <p className="text-sm text-muted-foreground">Esta linha tem <strong className="text-foreground">{info.total}</strong> equipamentos; <strong className="text-foreground">{info.comFotoPropria}</strong> já têm foto.</p>}
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Foto (JPG, PNG ou WebP · até {LIMITE_UPLOAD_TEXTO}; fotos maiores são reduzidas automaticamente)
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="text-sm font-normal text-foreground" />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">O que fazer com as fotos individuais?</legend>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="modo" checked={modo === "preservar"} onChange={() => setModo("preservar")} className="mt-1" />
                <span><strong>Preservar</strong> as fotos individuais — a nova foto vai só para os equipamentos sem foto.</span></label>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="modo" checked={modo === "substituir"} onChange={() => setModo("substituir")} className="mt-1" />
                <span><strong>Substituir todas</strong> — a nova foto passa a ser a principal em todos os equipamentos da linha.</span></label>
            </fieldset>
            {info && <Aviso tipo={modo === "substituir" && info.comFotoPropria > 0 ? "alerta" : "info"}>
              {afetados === 0 ? "Nenhum equipamento seria alterado: todos já têm foto. Escolha “Substituir todas” se quiser trocar." : <>A nova foto será aplicada em <strong>{afetados}</strong> {afetados === 1 ? "equipamento" : "equipamentos"} (também no catálogo). As fotos antigas continuam na lista de imagens de cada equipamento.</>}
            </Aviso>}
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          {resultado ? <button type="button" className={botaoPrimario} onClick={aoConcluir}>Fechar</button> : (
            <>
              <button type="button" className={botaoSecundario} disabled={pendente} onClick={aoFechar}>Cancelar</button>
              <button type="button" className={botaoPrimario} disabled={pendente || !arquivo || afetados === 0} onClick={enviar}>{pendente ? "Enviando…" : "Aplicar foto"}</button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

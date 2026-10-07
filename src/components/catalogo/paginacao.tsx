"use client";

import { useEffect, useRef, useState } from "react";
import type { MaquinaCatalogo, SpecCampo } from "@/lib/catalogo/tipos";
import { maquinasPorPagina, paginarMaquinas } from "@/lib/catalogo/tipos";
import { CatalogoPaginaA4, MaquinaBloco } from "./CatalogoPaginaA4";

export interface GrupoLinha {
  linhaId: string;
  linhaNome: string;
  specCampos: SpecCampo[];
  maquinas: MaquinaCatalogo[];
}

export interface PaginaCatalogo extends Omit<GrupoLinha, "maquinas"> {
  maquinas: MaquinaCatalogo[];
}

/** Espaço entre um item e outro na folha (mesmo valor do CSS de .catalogo-blocos). */
const ESPACO_ENTRE_ITENS = 10;
/** Folga para não encostar no rodapé. */
const FOLGA = 6;

function paginarPorAltura(maquinas: MaquinaCatalogo[], alturas: Map<string, number>, disponivel: number) {
  const paginas: MaquinaCatalogo[][] = [];
  let atual: MaquinaCatalogo[] = [];
  let usado = 0;
  for (const m of maquinas) {
    const h = alturas.get(m.id) ?? 0;
    const acrescimo = atual.length ? ESPACO_ENTRE_ITENS + h : h;
    if (atual.length && usado + acrescimo > disponivel) {
      paginas.push(atual);
      atual = [m];
      usado = h;
    } else {
      atual.push(m);
      usado += acrescimo;
    }
  }
  if (atual.length) paginas.push(atual);
  return paginas;
}

/**
 * Divide as máquinas em folhas A4 pela altura REAL de cada ficha (medida no
 * navegador), em vez de um número fixo por folha: fichas curtas aproveitam o
 * espaço e fichas longas nunca passam do fim da folha. Cada linha começa em
 * folha nova. Enquanto a medição não termina, usa a regra antiga (4 ou 3 por folha).
 *
 * `medidor` precisa ser renderizado dentro do mesmo contêiner que define as
 * fontes do catálogo, para medir com as mesmas letras da impressão.
 */
export function usePaginasCatalogo(grupos: GrupoLinha[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState<{ alturas: Map<string, number>; disponivel: number } | null>(null);
  const chave = grupos
    .map((g) => `${g.linhaId}:${g.specCampos.length}:${g.maquinas.map((m) => `${m.id}${m.fotoUrl ?? ""}`).join(",")}`)
    .join("|");

  useEffect(() => {
    let cancelado = false;
    const medir = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      const raiz = ref.current;
      if (!raiz || cancelado) return;
      const area = raiz.querySelector<HTMLElement>("[data-medida-area] .catalogo-blocos");
      if (!area) return;
      const alturas = new Map<string, number>();
      raiz.querySelectorAll<HTMLElement>("[data-medida-id]").forEach((el) => {
        alturas.set(el.dataset.medidaId!, el.getBoundingClientRect().height);
      });
      setMedidas({ alturas, disponivel: area.getBoundingClientRect().height - FOLGA });
    };
    medir();
    return () => {
      cancelado = true;
    };
  }, [chave]);

  const paginas: PaginaCatalogo[] = grupos.flatMap((g) => {
    const divididas = medidas
      ? paginarPorAltura(g.maquinas, medidas.alturas, medidas.disponivel)
      : paginarMaquinas(g.maquinas, maquinasPorPagina(g.specCampos.length));
    return divididas.map((maquinas) => ({ linhaId: g.linhaId, linhaNome: g.linhaNome, specCampos: g.specCampos, maquinas }));
  });

  const medidor = (
    <div ref={ref} aria-hidden className="catalogo-medidor">
      <div data-medida-area>
        <CatalogoPaginaA4 linhaId="" linhaNome="" maquinas={[]} specCampos={[]} numeroPagina={0} />
      </div>
      <div className="catalogo-medidor-blocos">
        {grupos.flatMap((g) =>
          g.maquinas.map((m) => (
            <div key={m.id} data-medida-id={m.id}>
              <MaquinaBloco maquina={m} specCampos={g.specCampos} linhaId={g.linhaId} />
            </div>
          ))
        )}
      </div>
    </div>
  );

  return { paginas, medidor, medido: medidas !== null };
}

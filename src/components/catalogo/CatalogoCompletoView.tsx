"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";
import type { CatalogoLinha, MaquinaCatalogo, SpecCampo } from "@/lib/catalogo/tipos";
import { maquinasPorPagina, paginarMaquinas } from "@/lib/catalogo/tipos";
import { CatalogoPaginaA4 } from "./CatalogoPaginaA4";
import { FotoEditorModal } from "./FotoEditorModal";
import { CATALOGO_CSS, formatBRL, formatTotalComPainel } from "./catalogo-shared";
import { archivo, ibmPlexSans } from "./catalogo-fonts";

const NAV = "#2C4F79";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

interface CatalogoCompletoViewProps {
  isAdmin: boolean;
  linhas: CatalogoLinha[];
}

interface PaginaComLinha {
  linhaId: string;
  linhaNome: string;
  specCampos: SpecCampo[];
  maquinasDaPagina: MaquinaCatalogo[];
}

export function CatalogoCompletoView({ isAdmin, linhas }: CatalogoCompletoViewProps) {
  const [editando, setEditando] = useState<{ maquina: MaquinaCatalogo; linhaId: string } | null>(null);

  const completos = linhas
    .filter((l) => l.linha.modoCatalogo === "completo")
    .sort((a, b) => a.linha.ordem - b.linha.ordem);

  const listas = linhas
    .filter((l) => l.linha.modoCatalogo === "lista")
    .sort((a, b) => a.linha.nome.localeCompare(b.linha.nome));

  const todasPaginas: PaginaComLinha[] = completos.flatMap(({ linha, specCampos, maquinas }) =>
    paginarMaquinas(maquinas, maquinasPorPagina(specCampos.length)).map((maquinasDaPagina) => ({
      linhaId: linha.id,
      linhaNome: linha.nome,
      specCampos,
      maquinasDaPagina,
    }))
  );

  const totalItens = todasPaginas.length + listas.length;

  return (
    <div className={`${archivo.variable} ${ibmPlexSans.variable} catalogo-fundo`} style={{ minHeight: "100vh", background: BG }}>
      <style>{CATALOGO_CSS}</style>

      <div className="catalogo-no-print" style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/catalogo" style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7b8d", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={16} /> Catálogo
        </Link>
        <span style={{ color: BORDER }}>/</span>
        <span style={{ fontWeight: 700, color: NAV, fontSize: 14 }}>Catálogo completo</span>
        <span style={{ fontSize: 12, color: "#6b7b8d" }}>
          {completos.length} em formato completo · {listas.length} em lista · {todasPaginas.length} páginas
        </span>
        {totalItens > 0 && (
          <button
            onClick={() => window.print()}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Printer size={14} /> Imprimir catálogo completo
          </button>
        )}
      </div>

      {totalItens === 0 ? (
        <div className="catalogo-no-print" style={{ padding: 60, textAlign: "center", color: "#6b7b8d" }}>
          Nenhuma máquina ativa cadastrada ainda.
        </div>
      ) : (
        <>
          {todasPaginas.length > 0 && (
            <div className="catalogo-paginas" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: "32px 16px" }}>
              {todasPaginas.map((p, i) => (
                <div key={`${p.linhaId}-${i}`} className="catalogo-page-wrap" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
                  <CatalogoPaginaA4
                    linhaId={p.linhaId}
                    linhaNome={p.linhaNome}
                    maquinas={p.maquinasDaPagina}
                    specCampos={p.specCampos}
                    numeroPagina={i + 1}
                    onEditarFoto={isAdmin ? (m, lid) => setEditando({ maquina: m, linhaId: lid }) : undefined}
                  />
                </div>
              ))}
            </div>
          )}

          {listas.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "0 16px 32px" }}>
              <div className="catalogo-folha-pecas">
                {todasPaginas.length === 0 && (
                  <div className="catalogo-header">
                    <div className="catalogo-brand">
                      <span className="nome">SEIBT</span>
                      <span className="tagline">Soluções para a Indústria do Plástico</span>
                    </div>
                    <span className="catalogo-badge-linha">Catálogo completo</span>
                  </div>
                )}
                {listas.map(({ linha, maquinas }) => (
                  <TabelaMaquinasLinha key={linha.id} nome={linha.nome} maquinas={maquinas} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {editando && (
        <FotoEditorModal
          maquina={editando.maquina}
          linhaId={editando.linhaId}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function TabelaMaquinasLinha({ nome, maquinas }: { nome: string; maquinas: MaquinaCatalogo[] }) {
  if (maquinas.length === 0) return null;
  return (
    <table className="tabela-pecas">
      <caption>{nome} ({maquinas.length})</caption>
      <thead>
        <tr>
          <th>Modelo</th>
          <th>Motor</th>
          <th className="num">Valor da máquina</th>
          <th className="num">NR-12 220V</th>
          <th className="num">NR-12 380V</th>
        </tr>
      </thead>
      <tbody>
        {maquinas.map((m) => (
          <tr key={m.id}>
            <td>{m.codigo}</td>
            <td>{m.potenciaMotor ? `${m.potenciaMotor} CV` : "—"}</td>
            <td className="num valor">{formatBRL(m.precoMaquina)}</td>
            <td className="num valor">{formatTotalComPainel(m.precoMaquina, m.precoPainel220)}</td>
            <td className="num valor">{formatTotalComPainel(m.precoMaquina, m.precoPainel380)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

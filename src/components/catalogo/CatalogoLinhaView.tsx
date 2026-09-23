"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";
import type { CatalogoLinha, MaquinaCatalogo } from "@/lib/catalogo/tipos";
import { maquinasPorPagina, paginarMaquinas } from "@/lib/catalogo/tipos";
import { CatalogoPaginaA4 } from "./CatalogoPaginaA4";
import { FotoEditorModal } from "./FotoEditorModal";
import { CATALOGO_CSS } from "./catalogo-shared";
import { archivo, ibmPlexSans } from "./catalogo-fonts";

const NAV = "#2C4F79";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

interface CatalogoLinhaViewProps {
  isAdmin: boolean;
  dados: CatalogoLinha;
}

export function CatalogoLinhaView({ isAdmin, dados }: CatalogoLinhaViewProps) {
  const { linha, specCampos, maquinas } = dados;
  const paginas = paginarMaquinas(maquinas, maquinasPorPagina(specCampos.length));
  const [editando, setEditando] = useState<MaquinaCatalogo | null>(null);

  return (
    <div className={`${archivo.variable} ${ibmPlexSans.variable} catalogo-fundo`} style={{ minHeight: "100vh", background: BG }}>
      <style>{CATALOGO_CSS}</style>

      <div className="catalogo-no-print" style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/catalogo" style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7b8d", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={16} /> Catálogo
        </Link>
        <span style={{ color: BORDER }}>/</span>
        <span style={{ fontWeight: 700, color: NAV, fontSize: 14 }}>{linha.nome}</span>
        {isAdmin ? (
          <span style={{ marginLeft: 12, fontSize: 12, color: "#6b7b8d" }}>Clique numa foto pra trocar</span>
        ) : (
          <span style={{ marginLeft: 12, fontSize: 12, color: "#6b7b8d" }}>Modo visualização — só o Administrador edita as fotos do catálogo</span>
        )}
        {maquinas.length > 0 && (
          <button
            onClick={() => window.print()}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Printer size={14} /> Imprimir catálogo
          </button>
        )}
      </div>

      {maquinas.length === 0 ? (
        <div className="catalogo-no-print" style={{ padding: 60, textAlign: "center", color: "#6b7b8d" }}>
          Nenhuma máquina ativa cadastrada nesta linha ainda.
        </div>
      ) : (
        <div className="catalogo-paginas" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: "32px 16px" }}>
          {paginas.map((maquinasDaPagina, i) => (
            <div key={i} className="catalogo-page-wrap" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
              <CatalogoPaginaA4
                linhaId={linha.id}
                linhaNome={linha.nome}
                maquinas={maquinasDaPagina}
                specCampos={specCampos}
                numeroPagina={i + 1}
                onEditarFoto={isAdmin ? (m) => setEditando(m) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {editando && (
        <FotoEditorModal
          maquina={editando}
          linhaId={linha.id}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

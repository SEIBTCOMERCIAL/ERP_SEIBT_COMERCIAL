"use client";

import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";
import type { PecaCatalogo } from "@/lib/catalogo/tipos";
import { CATALOGO_CSS, formatBRL, formatPercent } from "./catalogo-shared";
import { archivo, ibmPlexSans } from "./catalogo-fonts";

const NAV = "#2C4F79";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

interface CatalogoPecasViewProps {
  navalhas: PecaCatalogo[];
  peneiras: PecaCatalogo[];
}

export function CatalogoPecasView({ navalhas, peneiras }: CatalogoPecasViewProps) {
  const total = navalhas.length + peneiras.length;

  return (
    <div className={`${archivo.variable} ${ibmPlexSans.variable} catalogo-fundo`} style={{ minHeight: "100vh", background: BG }}>
      <style>{CATALOGO_CSS}</style>

      <div className="catalogo-no-print" style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/catalogo" style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7b8d", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={16} /> Catálogo
        </Link>
        <span style={{ color: BORDER }}>/</span>
        <span style={{ fontWeight: 700, color: NAV, fontSize: 14 }}>Navalhas e Peneiras</span>
        <span style={{ fontSize: 12, color: "#6b7b8d" }}>{total} itens</span>
        {total > 0 && (
          <button
            onClick={() => window.print()}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Printer size={14} /> Imprimir lista
          </button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "32px 16px" }}>
        <div className="catalogo-folha-pecas">
          <div className="catalogo-header">
            <div className="catalogo-brand">
              <span className="nome">SEIBT</span>
              <span className="tagline">Soluções para a Indústria do Plástico</span>
            </div>
            <span className="catalogo-badge-linha">Navalhas e Peneiras</span>
          </div>

          <TabelaPecas titulo="Navalhas" itens={navalhas} />
          <TabelaPecas titulo="Peneiras" itens={peneiras} />

          {total === 0 && (
            <p style={{ color: "#6b7b8d", padding: "24px 0" }}>Nenhuma navalha ou peneira ativa cadastrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TabelaPecas({ titulo, itens }: { titulo: string; itens: PecaCatalogo[] }) {
  if (itens.length === 0) return null;
  return (
    <table className="tabela-pecas">
      <caption>{titulo} ({itens.length})</caption>
      <thead>
        <tr>
          <th>Código</th>
          <th>Descrição</th>
          <th className="num">Valor unitário</th>
          <th className="num">IPI</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((p) => (
          <tr key={p.id}>
            <td>{p.codigo}</td>
            <td>{p.descricao}</td>
            <td className="num valor">{formatBRL(p.precoUnitario)}</td>
            <td className="num">{formatPercent(p.ipiPct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

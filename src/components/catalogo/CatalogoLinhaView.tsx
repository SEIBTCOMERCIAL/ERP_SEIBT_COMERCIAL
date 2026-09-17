"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ImageOff } from "lucide-react";
import type { CatalogoLinha, MaquinaCatalogo } from "@/lib/catalogo/dados";
import { paginarMaquinas } from "@/lib/catalogo/dados";
import { definirFotoCapaProduto } from "@/app/actions/catalogo";
import { CatalogoPaginaA4 } from "./CatalogoPaginaA4";
import { CATALOGO_CSS } from "./catalogo-shared";

const NAV = "#2C4F79";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

interface CatalogoLinhaViewProps {
  isAdmin: boolean;
  dados: CatalogoLinha;
}

export function CatalogoLinhaView({ isAdmin, dados }: CatalogoLinhaViewProps) {
  const { linha, specCampos, maquinas } = dados;
  const paginas = paginarMaquinas(maquinas, 4);

  return (
    <div style={{ minHeight: "100vh", background: BG }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
      />
      <style>{CATALOGO_CSS}</style>

      <div style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/catalogo" style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7b8d", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={16} /> Catálogo
        </Link>
        <span style={{ color: BORDER }}>/</span>
        <span style={{ fontWeight: 700, color: NAV, fontSize: 14 }}>Linha {linha.nome}</span>
        {!isAdmin && (
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7b8d" }}>Modo visualização — só o Administrador edita as fotos do catálogo</span>
        )}
      </div>

      {maquinas.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#6b7b8d" }}>
          Nenhuma máquina ativa cadastrada nesta linha ainda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: "32px 16px" }}>
          {paginas.map((maquinasDaPagina, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
                <CatalogoPaginaA4
                  linhaNome={linha.nome}
                  maquinas={maquinasDaPagina}
                  specCampos={specCampos}
                  numeroPagina={i + 1}
                />
              </div>
              {isAdmin && (
                <div style={{ width: 794, display: "flex", flexWrap: "wrap", gap: 10, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
                  {maquinasDaPagina.map((m) => (
                    <FotoPicker key={m.id} maquina={m} linhaId={linha.id} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FotoPicker({ maquina, linhaId }: { maquina: MaquinaCatalogo; linhaId: string }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  const handleChange = (url: string) => {
    setMsg("");
    startTransition(async () => {
      const res = await definirFotoCapaProduto(maquina.id, linhaId, url || null);
      setMsg(res.error ? res.error : "Salvo");
      if (!res.error) setTimeout(() => setMsg(""), 2000);
    });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 10px" }}>
      <div style={{ width: 32, height: 32, borderRadius: 4, background: BG, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {maquina.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={maquina.fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <ImageOff size={14} color="#B0BAC9" />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: NAV }}>{maquina.codigo}</span>
        {maquina.imagensDisponiveis.length === 0 ? (
          <span style={{ fontSize: 10.5, color: "#B0BAC9" }}>Sem fotos cadastradas no equipamento</span>
        ) : (
          <select
            defaultValue={maquina.fotoUrl ?? ""}
            disabled={isPending}
            onChange={(e) => handleChange(e.target.value)}
            style={{ fontSize: 11, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 4px", maxWidth: 180 }}
          >
            <option value="">Sem foto</option>
            {maquina.imagensDisponiveis.map((img) => (
              <option key={img.id} value={img.url}>{img.nome}</option>
            ))}
          </select>
        )}
        {msg && <span style={{ fontSize: 10, color: msg === "Salvo" ? "#16A34A" : "#DC2626" }}>{msg}</span>}
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ImageOff, Printer, Upload } from "lucide-react";
import type { CatalogoLinha, MaquinaCatalogo } from "@/lib/catalogo/tipos";
import { paginarMaquinas } from "@/lib/catalogo/tipos";
import { definirFotoCapaProduto } from "@/app/actions/catalogo";
import { uploadArquivoProduto } from "@/app/actions/produtos-admin";
import { CatalogoPaginaA4 } from "./CatalogoPaginaA4";
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
  const paginas = paginarMaquinas(maquinas, 4);

  return (
    <div className={`${archivo.variable} ${ibmPlexSans.variable} catalogo-fundo`} style={{ minHeight: "100vh", background: BG }}>
      <style>{CATALOGO_CSS}</style>

      <div className="catalogo-no-print" style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/catalogo" style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7b8d", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={16} /> Catálogo
        </Link>
        <span style={{ color: BORDER }}>/</span>
        <span style={{ fontWeight: 700, color: NAV, fontSize: 14 }}>Linha {linha.nome}</span>
        {!isAdmin && (
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: "32px 16px" }}>
          {paginas.map((maquinasDaPagina, i) => (
            <div key={i} className="catalogo-page-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
              <CatalogoPaginaA4
                linhaNome={linha.nome}
                maquinas={maquinasDaPagina}
                specCampos={specCampos}
                numeroPagina={i + 1}
              />
              {isAdmin && (
                <div className="catalogo-no-print" style={{ width: 794, display: "flex", flexWrap: "wrap", gap: 10, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (url: string) => {
    setMsg("");
    startTransition(async () => {
      const res = await definirFotoCapaProduto(maquina.id, linhaId, url || null);
      setMsg(res.error ? res.error : "Salvo");
      if (!res.error) setTimeout(() => setMsg(""), 2000);
    });
  };

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    setMsg("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("produto_id", maquina.id);
      formData.set("linha_id", linhaId);
      formData.set("tipo", "imagem");
      formData.set("arquivo", file);
      const res = await uploadArquivoProduto({}, formData);
      if (res.error) {
        setMsg(res.error);
      } else {
        setMsg("Foto adicionada");
        router.refresh();
        setTimeout(() => setMsg(""), 2500);
      }
      if (fileRef.current) fileRef.current.value = "";
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {maquina.imagensDisponiveis.length > 0 && (
            <select
              defaultValue={maquina.fotoUrl ?? ""}
              disabled={isPending}
              onChange={(e) => handleChange(e.target.value)}
              style={{ fontSize: 11, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 4px", maxWidth: 160 }}
            >
              <option value="">Sem foto</option>
              {maquina.imagensDisponiveis.map((img) => (
                <option key={img.id} value={img.url}>{img.nome}</option>
              ))}
            </select>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, color: NAV, cursor: isPending ? "default" : "pointer", opacity: isPending ? 0.5 : 1 }}>
            <Upload size={11} /> {maquina.imagensDisponiveis.length === 0 ? "Adicionar foto" : "Nova"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              disabled={isPending}
              onChange={(e) => handleUpload(e.target.files?.[0])}
              style={{ display: "none" }}
            />
          </label>
        </div>
        {msg && <span style={{ fontSize: 10, color: msg.includes("adicionada") || msg === "Salvo" ? "#16A34A" : "#DC2626" }}>{msg}</span>}
      </div>
    </div>
  );
}

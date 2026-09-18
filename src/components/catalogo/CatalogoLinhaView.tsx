"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ImageOff, Printer, Upload, X } from "lucide-react";
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
  const [editando, setEditando] = useState<MaquinaCatalogo | null>(null);

  return (
    <div className={`${archivo.variable} ${ibmPlexSans.variable} catalogo-fundo`} style={{ minHeight: "100vh", background: BG }}>
      <style>{CATALOGO_CSS}</style>

      <div className="catalogo-no-print" style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/catalogo" style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7b8d", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={16} /> Catálogo
        </Link>
        <span style={{ color: BORDER }}>/</span>
        <span style={{ fontWeight: 700, color: NAV, fontSize: 14 }}>Linha {linha.nome}</span>
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

function FotoEditorModal({
  maquina,
  linhaId,
  onClose,
}: {
  maquina: MaquinaCatalogo;
  linhaId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (url: string) => {
    setMsg("");
    startTransition(async () => {
      const res = await definirFotoCapaProduto(maquina.id, linhaId, url || null);
      if (res.error) setMsg(res.error);
      else {
        router.refresh();
        onClose();
      }
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
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <div
      className="catalogo-no-print"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(28,36,48,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 20, width: 340, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: NAV }}>{maquina.codigo}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7b8d" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ width: "100%", height: 140, borderRadius: 8, background: BG, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {maquina.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={maquina.fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <ImageOff size={28} color="#B0BAC9" />
          )}
        </div>

        {maquina.imagensDisponiveis.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" }}>Fotos já cadastradas</span>
            <select
              defaultValue={maquina.fotoUrl ?? ""}
              disabled={isPending}
              onChange={(e) => handleChange(e.target.value)}
              style={{ fontSize: 13, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px" }}
            >
              <option value="">Sem foto</option>
              {maquina.imagensDisponiveis.map((img) => (
                <option key={img.id} value={img.url}>{img.nome}</option>
              ))}
            </select>
          </div>
        )}

        <label
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 14px", background: isPending ? "#94A3B8" : NAV, color: "#fff",
            borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: isPending ? "default" : "pointer",
          }}
        >
          <Upload size={14} /> Subir foto nova
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            disabled={isPending}
            onChange={(e) => handleUpload(e.target.files?.[0])}
            style={{ display: "none" }}
          />
        </label>

        {msg && <span style={{ fontSize: 12, color: "#DC2626" }}>{msg}</span>}
      </div>
    </div>
  );
}

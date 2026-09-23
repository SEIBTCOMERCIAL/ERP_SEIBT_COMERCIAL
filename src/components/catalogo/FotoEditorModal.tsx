"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Upload, X } from "lucide-react";
import type { MaquinaCatalogo } from "@/lib/catalogo/tipos";
import { definirFotoCapaProduto } from "@/app/actions/catalogo";
import { uploadArquivoProduto } from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

/**
 * Modal pra trocar/subir a foto de uma máquina (produtos.foto_url) — a mesma
 * foto usada no card de Produtos e no Catálogo. Aberto ao clicar na foto,
 * tanto em Produtos quanto na prévia do Catálogo.
 */
export function FotoEditorModal({
  maquina,
  linhaId,
  onClose,
}: {
  maquina: Pick<MaquinaCatalogo, "id" | "codigo" | "nome" | "fotoUrl" | "imagensDisponiveis">;
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
      if (res.error || !res.url) {
        setMsg(res.error ?? "Não foi possível enviar a foto");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const capa = await definirFotoCapaProduto(maquina.id, linhaId, res.url);
      if (capa.error) {
        setMsg(capa.error);
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
          <span style={{ fontSize: 14, fontWeight: 700, color: NAV }}>{maquina.nome}</span>
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

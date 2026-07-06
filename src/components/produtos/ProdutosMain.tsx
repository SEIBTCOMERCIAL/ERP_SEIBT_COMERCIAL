"use client";

import { useTransition, useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, Trash2, Cog, Search } from "lucide-react";
import {
  criarLinha, excluirLinha,
} from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

interface LinhaItem { id: string; nome: string; ordem: number; count: number }

function SubmitInline({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ padding: "6px 14px", background: NAV, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1, whiteSpace: "nowrap" as const }}>
      {pending ? "..." : label}
    </button>
  );
}

export function ProdutosMain({ isAdmin, linhas }: { isAdmin: boolean; linhas: LinhaItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [linhaState, linhaAction] = useFormState(criarLinha, {});
  const [searchLinhas, setSearchLinhas] = useState("");
  const linhaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linhaState.success) { router.refresh(); if (linhaInputRef.current) linhaInputRef.current.value = ""; }
  }, [linhaState.success, router]);

  const handleExcluirLinha = (id: string, nome: string) => {
    if (!confirm(`Excluir a linha "${nome}"?`)) return;
    startTransition(async () => {
      const res = await excluirLinha(id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const linhasFiltradas = linhas
    .filter(l => l.nome.toLowerCase().includes(searchLinhas.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 28 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Produtos</h1>
        <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>Catálogo de máquinas Seibt. As peças compatíveis ficam dentro de cada equipamento.</p>
      </div>

      {/* ── Linhas de Máquinas ── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Cog size={18} color={NAV} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: NAV, margin: 0 }}>
              Linhas de máquinas <span style={{ fontWeight: 400, color: "#b0bac9", fontSize: 13 }}>({linhas.length})</span>
            </h2>
          </div>
          {linhas.length > 4 && (
            <div style={{ position: "relative", width: 240 }}>
              <Search size={14} color="#b0bac9" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input value={searchLinhas} onChange={e => setSearchLinhas(e.target.value)} placeholder="Buscar linha..."
                style={{ width: "100%", height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px 0 32px", fontSize: 12, outline: "none", boxSizing: "border-box" as const }} />
            </div>
          )}
        </div>

        {linhasFiltradas.length === 0 && (
          <div style={{ color: "#6b7b8d", fontSize: 13, marginBottom: 12 }}>
            {searchLinhas ? "Nenhuma linha encontrada." : "Nenhuma linha cadastrada."}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
          {linhasFiltradas.map(l => (
            <div key={l.id}
              style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s" }}
              onClick={() => router.push(`/produtos/linhas/${l.id}`)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = BLUE)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: NAV }}>{l.nome}</div>
                    <div style={{ fontSize: 11, color: "#6b7b8d", marginTop: 3 }}>{l.count} equipamento{l.count !== 1 ? "s" : ""}</div>
                  </div>
                  <ChevronRight size={14} color="#b0bac9" />
                </div>
              </div>
              {isAdmin && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: "6px 10px", display: "flex", justifyContent: "flex-end" }}
                  onClick={e => { e.stopPropagation(); handleExcluirLinha(l.id, l.nome); }}>
                  <button disabled={isPending}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 4px", borderRadius: 4, opacity: isPending ? 0.5 : 1 }}>
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <>
            <form action={linhaAction} style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 360 }}>
              <input ref={linhaInputRef} name="nome" placeholder="Nome da nova linha (ex: BSC)"
                style={{ flex: 1, height: 34, border: `1px solid ${linhaState.error ? "#DC2626" : BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
              <SubmitInline label="+ Linha" />
            </form>
            {linhaState.error && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{linhaState.error}</div>}
          </>
        )}
      </section>

      {!isAdmin && (
        <div style={{ marginTop: 32, padding: "10px 16px", background: "#EFF6FF", border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, color: BLUE }}>
          Somente administradores podem criar ou excluir linhas.
        </div>
      )}
    </div>
  );
}

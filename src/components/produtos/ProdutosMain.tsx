"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Trash2, Cog, Package } from "lucide-react";
import {
  criarLinha, excluirLinha,
  criarCategoriaPeca, excluirCategoriaPeca,
} from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

interface LinhaItem { id: string; nome: string; ordem: number; count: number }
interface CategoriaItem { id: string; nome: string; ordem: number; count: number }

function SubmitInline({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "6px 14px", background: NAV, color: "#fff",
        border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600,
        cursor: "pointer", opacity: pending ? 0.6 : 1, whiteSpace: "nowrap",
      }}
    >
      {pending ? "..." : label}
    </button>
  );
}

export function ProdutosMain({
  isAdmin, linhas, categorias,
}: {
  isAdmin: boolean;
  linhas: LinhaItem[];
  categorias: CategoriaItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [linhaState, linhaAction] = useFormState(criarLinha, {});
  const [catState, catAction] = useFormState(criarCategoriaPeca, {});
  const linhaInputRef = useRef<HTMLInputElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linhaState.success) {
      router.refresh();
      if (linhaInputRef.current) linhaInputRef.current.value = "";
    }
  }, [linhaState.success, router]);

  useEffect(() => {
    if (catState.success) {
      router.refresh();
      if (catInputRef.current) catInputRef.current.value = "";
    }
  }, [catState.success, router]);

  const handleExcluirLinha = (id: string, nome: string) => {
    if (!confirm(`Excluir a linha "${nome}"?`)) return;
    startTransition(async () => {
      const res = await excluirLinha(id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const handleExcluirCategoria = (id: string, nome: string) => {
    if (!confirm(`Excluir a categoria "${nome}"?`)) return;
    startTransition(async () => {
      const res = await excluirCategoriaPeca(id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 28 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Produtos</h1>
        <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>
          Catálogo de máquinas e peças Seibt.
        </p>
      </div>

      {/* ── Linhas de Máquinas ── */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Cog size={18} color={NAV} />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: NAV, margin: 0 }}>Linhas de máquinas</h2>
        </div>

        {linhas.length === 0 && (
          <div style={{ color: "#6b7b8d", fontSize: 13, marginBottom: 12 }}>Nenhuma linha cadastrada.</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          {linhas.map(l => (
            <div
              key={l.id}
              style={{
                background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
                overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s",
              }}
              onClick={() => router.push(`/produtos/linhas/${l.id}`)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = BLUE)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
            >
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: NAV }}>{l.nome}</div>
                    <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 3 }}>
                      {l.count} equipamento{l.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <ChevronRight size={16} color="#b0bac9" />
                </div>
              </div>
              {isAdmin && (
                <div
                  style={{ borderTop: `1px solid ${BORDER}`, padding: "8px 12px", display: "flex", justifyContent: "flex-end" }}
                  onClick={e => { e.stopPropagation(); handleExcluirLinha(l.id, l.nome); }}
                >
                  <button
                    disabled={isPending}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#DC2626", display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                      opacity: isPending ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <form action={linhaAction} style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 360 }}>
            <input
              ref={linhaInputRef}
              name="nome"
              placeholder="Nome da nova linha (ex: BSC)"
              style={{
                flex: 1, height: 36, border: `1px solid ${linhaState.error ? "#DC2626" : BORDER}`,
                borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none",
              }}
            />
            <SubmitInline label="+ Linha" />
          </form>
        )}
        {linhaState.error && (
          <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{linhaState.error}</div>
        )}
      </section>

      {/* ── Categorias de Peças ── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Package size={18} color={NAV} />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: NAV, margin: 0 }}>Categorias de peças</h2>
        </div>

        {categorias.length === 0 && (
          <div style={{ color: "#6b7b8d", fontSize: 13, marginBottom: 12 }}>Nenhuma categoria cadastrada.</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          {categorias.map(c => (
            <div
              key={c.id}
              style={{
                background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
                overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s",
              }}
              onClick={() => router.push(`/produtos/categorias/${c.id}`)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = BLUE)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
            >
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: NAV }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 3 }}>
                      {c.count} peça{c.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <ChevronRight size={16} color="#b0bac9" />
                </div>
              </div>
              {isAdmin && (
                <div
                  style={{ borderTop: `1px solid ${BORDER}`, padding: "8px 12px", display: "flex", justifyContent: "flex-end" }}
                  onClick={e => { e.stopPropagation(); handleExcluirCategoria(c.id, c.nome); }}
                >
                  <button
                    disabled={isPending}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#DC2626", display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                      opacity: isPending ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <form action={catAction} style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 360 }}>
            <input
              ref={catInputRef}
              name="nome"
              placeholder="Nome da nova categoria (ex: Mancais)"
              style={{
                flex: 1, height: 36, border: `1px solid ${catState.error ? "#DC2626" : BORDER}`,
                borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none",
              }}
            />
            <SubmitInline label="+ Categoria" />
          </form>
        )}
        {catState.error && (
          <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{catState.error}</div>
        )}
      </section>

      {!isAdmin && (
        <div style={{ marginTop: 32, padding: "10px 16px", background: "#EFF6FF", border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, color: BLUE }}>
          Somente administradores podem criar, editar ou excluir produtos.
        </div>
      )}
    </div>
  );
}

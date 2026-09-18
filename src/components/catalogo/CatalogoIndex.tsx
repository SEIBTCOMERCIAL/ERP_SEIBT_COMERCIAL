"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, ChevronRight, Scissors } from "lucide-react";
import { definirModoCatalogoLinha } from "@/app/actions/catalogo";

const NAV = "#2C4F79";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const SEM_FAMILIA = "Sem família";

interface LinhaItem {
  id: string;
  nome: string;
  ordem: number;
  grupo?: string | null;
  grupo_ordem?: number | null;
  modoCatalogo: "completo" | "lista";
  count: number;
}

interface Familia { nome: string; ordem: number; linhas: LinhaItem[] }

function agruparPorFamilia(linhas: LinhaItem[]): Familia[] {
  const mapa = new Map<string, Familia>();
  for (const l of linhas) {
    const nome = l.grupo ?? SEM_FAMILIA;
    if (!mapa.has(nome)) mapa.set(nome, { nome, ordem: l.grupo ? l.grupo_ordem ?? 99 : 999, linhas: [] });
    mapa.get(nome)!.linhas.push(l);
  }
  return Array.from(mapa.values())
    .map((g) => ({ ...g, linhas: [...g.linhas].sort((a, b) => a.ordem - b.ordem) }))
    .sort((a, b) => a.ordem - b.ordem);
}

export function CatalogoIndex({ isAdmin, linhas }: { isAdmin: boolean; linhas: LinhaItem[] }) {
  const familias = agruparPorFamilia(linhas);

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 28 }}>
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Catálogo</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>
            Escolha uma linha para ver a prévia de impressão e gerar o PDF do catálogo.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/catalogo/pecas"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", background: "#fff", border: `1px solid ${BORDER}`, color: NAV, borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            <Scissors size={15} /> Navalhas e Peneiras
          </Link>
          <Link
            href="/catalogo/completo"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", background: NAV, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            <BookOpen size={15} /> Ver catálogo completo
          </Link>
        </div>
      </div>

      {familias.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7b8d", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
          Nenhuma linha com máquinas ativas cadastradas ainda.
        </div>
      ) : (
        familias.map((familia) => (
          <section key={familia.nome} style={{ marginBottom: 24 }}>
            {familia.nome !== SEM_FAMILIA && (
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                {familia.nome}
              </h2>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {familia.linhas.map((linha) => (
                <LinhaCard key={linha.id} linha={linha} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function LinhaCard({ linha, isAdmin }: { linha: LinhaItem; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleModoChange = (modo: "completo" | "lista") => {
    startTransition(async () => {
      await definirModoCatalogoLinha(linha.id, modo);
      router.refresh();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
      <Link href={`/catalogo/${linha.id}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#E8ECF1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BookOpen size={18} color={NAV} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1C2430" }}>{linha.nome}</div>
          <div style={{ fontSize: 12, color: "#6b7b8d" }}>{linha.count} {linha.count === 1 ? "máquina" : "máquinas"}</div>
        </div>
        <ChevronRight size={16} color="#B0BAC9" />
      </Link>
      {isAdmin && (
        <select
          value={linha.modoCatalogo}
          disabled={isPending}
          onChange={(e) => handleModoChange(e.target.value as "completo" | "lista")}
          style={{ fontSize: 11, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "4px 6px", color: "#6b7b8d" }}
        >
          <option value="completo">Catálogo completo: página com foto/specs</option>
          <option value="lista">Catálogo completo: lista compacta</option>
        </select>
      )}
    </div>
  );
}

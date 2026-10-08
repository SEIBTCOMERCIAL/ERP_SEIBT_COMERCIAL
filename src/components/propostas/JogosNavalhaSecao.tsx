"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItemInput } from "@/app/actions/propostas-pecas";
import { chaveItem, itensDoJogo, totalJogo, type Jogo } from "@/lib/propostas/jogos-navalha";

const NAV = "#2C4F79";
const BORDER = "#E2E8F0";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const doisDigitos = (n: number) => String(n).padStart(2, "0");

type ItemComChave = CartItemInput & { chave?: string };

/**
 * Escolha de jogos de navalhas na hora de cotar: o vendedor escolhe o jogo (por material) do equipamento e as
 * linhas entram no orçamento do jeito do modelo da SEIBT. As linhas já adicionadas ficam aqui, com quantidade e remoção.
 */
export function JogosNavalhaSecao({
  jogos, disponivel, cart, setCart, equipamentoIds = [], buscaInicial = "", moeda = "BRL", taxaDolar = 1,
}: {
  jogos: Jogo[];
  disponivel: boolean;
  cart: ItemComChave[];
  setCart: (atualiza: (anterior: ItemComChave[]) => ItemComChave[]) => void;
  /** Equipamentos já escolhidos na proposta: os jogos deles aparecem primeiro. */
  equipamentoIds?: string[];
  buscaInicial?: string;
  moeda?: "BRL" | "USD";
  taxaDolar?: number;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [limite, setLimite] = useState(12);

  const chavesNoCarrinho = useMemo(() => new Set(cart.map((i) => i.chave).filter(Boolean) as string[]), [cart]);
  const linhasDeJogo = cart.filter((i) => i.chave?.startsWith("jogo:"));

  const sugeridos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q) {
      return jogos.filter((j) => `${j.equipamentoCodigo} ${j.nome} ${j.material ?? ""} ${j.itens.map((i) => i.titulo).join(" ")}`.toLowerCase().includes(q));
    }
    if (equipamentoIds.length) return jogos.filter((j) => equipamentoIds.includes(j.equipamentoId));
    return [];
  }, [busca, jogos, equipamentoIds]);

  const adicionar = (jogo: Jogo) => {
    const novos = itensDoJogo(jogo, { moeda, taxaDolar });
    setCart((prev) => {
      const resultado = [...prev];
      for (const n of novos) {
        const i = resultado.findIndex((x) => x.chave === n.chave);
        if (i >= 0) resultado[i] = { ...resultado[i], quantidade: resultado[i].quantidade + n.quantidade };
        else resultado.push(n);
      }
      return resultado;
    });
  };

  const alterarQtd = (chave: string, delta: number) =>
    setCart((prev) => prev.map((i) => (i.chave === chave ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i)));
  const remover = (chave: string) => setCart((prev) => prev.filter((i) => i.chave !== chave));

  if (!disponivel) {
    return (
      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 16 }}>
        Os jogos de navalhas ficam disponíveis depois da atualização do banco de dados (arquivo 026). Até lá, adicione as navalhas pela lista de peças.
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: NAV }}>Jogos de navalhas</div>
      <div style={{ fontSize: 12, color: "#6b7b8d", margin: "2px 0 10px" }}>
        Escolha o jogo do equipamento (cada material é um jogo). As linhas entram no orçamento com número de peças e código.
      </div>
      <input
        value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(12); }}
        placeholder="Buscar jogo pelo modelo do moinho (ex.: MGHS 800 A2)..."
        style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, marginBottom: 10 }}
      />

      {sugeridos.length === 0 ? (
        <p style={{ fontSize: 12, color: "#6b7b8d", margin: "4px 0" }}>
          {busca.trim() ? "Nenhum jogo encontrado." : "Digite o modelo do moinho para ver os jogos de navalhas disponíveis."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sugeridos.slice(0, limite).map((j) => {
            const jaTem = j.itens.every((i) => chavesNoCarrinho.has(`jogo:${i.id}`));
            return (
              <div key={j.id} style={{ border: `1px solid ${jaTem ? "#86efac" : BORDER}`, background: jaTem ? "#f0fdf4" : "#fff", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a" }}>{j.equipamentoCodigo}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#374151" }}>Jogo {j.nome}</span>
                    {j.material && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: "#1d4ed8", background: "#dbeafe", borderRadius: 4, padding: "1px 6px" }}>{j.material}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: NAV }}>{brl(totalJogo(j))}</span>
                    <button type="button" onClick={() => adicionar(j)} style={{ padding: "6px 12px", background: jaTem ? "#fff" : NAV, color: jaTem ? NAV : "#fff", border: `1px solid ${NAV}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {jaTem ? "+ Mais um jogo" : "+ Adicionar jogo"}
                    </button>
                  </div>
                </div>
                <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 11.5, color: "#6b7b8d" }}>
                  {j.itens.map((i) => <li key={i.id}>{i.titulo} — {doisDigitos(i.pecas)} {i.pecas === 1 ? "peça" : "peças"}{i.codigo ? ` · CÓD. ${i.codigo}` : ""}</li>)}
                </ul>
              </div>
            );
          })}
          {sugeridos.length > limite && (
            <button type="button" onClick={() => setLimite((n) => n + 12)} style={{ alignSelf: "center", padding: "6px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff", fontSize: 12, fontWeight: 600, color: NAV, cursor: "pointer" }}>
              Mostrar mais ({sugeridos.length - limite} restantes)
            </button>
          )}
        </div>
      )}

      {linhasDeJogo.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Linhas de jogos no orçamento</div>
          {linhasDeJogo.map((i) => (
            <div key={chaveItem(i)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid #f1f5f9` }}>
              <span style={{ flex: 1, fontSize: 12, color: "#1a1a1a", minWidth: 0 }}>{i.descricao}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={() => alterarQtd(i.chave!, -1)} aria-label="Menos" style={{ width: 24, height: 24, border: `1px solid ${BORDER}`, borderRadius: 4, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={12} /></button>
                <span style={{ fontSize: 13, fontWeight: 700, minWidth: 22, textAlign: "center" }}>{doisDigitos(i.quantidade)}</span>
                <button type="button" onClick={() => alterarQtd(i.chave!, 1)} aria-label="Mais" style={{ width: 24, height: 24, border: "none", borderRadius: 4, background: NAV, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={12} /></button>
                <button type="button" onClick={() => remover(i.chave!)} aria-label="Remover" style={{ marginLeft: 4, border: "none", background: "none", color: "#b0bac9", cursor: "pointer" }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

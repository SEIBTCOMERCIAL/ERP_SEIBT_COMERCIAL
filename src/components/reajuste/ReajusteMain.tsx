"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, AlertTriangle, ChevronRight, TrendingUp, TrendingDown, Layers } from "lucide-react";
import { reajustarEquipamento, reajustarLote, type ComponenteReajuste } from "@/app/actions/reajuste";
import { reajustarPreco } from "@/app/actions/produtos";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const SUCCESS = "#16A34A";
const WARN = "#D97706";
const DANGER = "#DC2626";

const MOTIVOS = ["Reajuste anual", "Variação cambial", "Custo matéria-prima", "Outro"];

function fmtBRL(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function anoAtual() {
  return new Date().getFullYear();
}

function semReajusteAno(historico: HistItem[]) {
  const threshold = `${anoAtual()}-01-01`;
  return !historico.some((h) => h.data_reajuste >= threshold);
}

function calcNovo(preco: number, pct: string): number {
  const p = parseFloat(pct) || 0;
  return Math.round(preco * (1 + p / 100) * 100) / 100;
}

interface HistItem {
  id: string;
  componente: string | null;
  preco_anterior_brl: number | null;
  preco_novo_brl: number | null;
  percentual_reajuste: number | null;
  motivo: string | null;
  data_reajuste: string;
}

interface Equip {
  id: string;
  codigo: string;
  descricao: string;
  linha_id: string;
  preco_brl: number | null;
  preco_painel_220: number | null;
  preco_painel_380: number | null;
  solicitar_engenharia: boolean;
  historico: HistItem[];
}

interface Linha {
  id: string;
  nome: string;
  ordem: number;
  equipamentos: Equip[];
}

interface Peca {
  id: string;
  codigo: string;
  descricao: string;
  categoria_peca_id: string;
  preco_brl: number | null;
  ipi_pct: number;
  historico: HistItem[];
}

interface Categoria {
  id: string;
  nome: string;
  ordem: number;
  pecas: Peca[];
}

interface Props {
  linhas: Linha[];
  categorias: Categoria[];
  taxaDolar: number;
}

// ─── SVG Chart ───────────────────────────────────────────────────────────────
function SvgChart({ historico, componente }: { historico: HistItem[]; componente?: string | null }) {
  const items = [...historico]
    .filter((h) => h.preco_novo_brl != null && (componente == null || h.componente === componente || h.componente == null))
    .sort((a, b) => a.data_reajuste.localeCompare(b.data_reajuste));

  if (items.length < 2) {
    return <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#B0BAC9" }}>Dados insuficientes</div>;
  }

  const prices = items.map((h) => h.preco_novo_brl as number);
  const min = Math.min(...prices) * 0.9;
  const max = Math.max(...prices) * 1.05;
  const W = 240, H = 64;
  const toX = (i: number) => (i / (items.length - 1)) * (W - 20) + 10;
  const toY = (v: number) => H - 6 - ((v - min) / (max - min || 1)) * (H - 16);
  const pts = items.map((h, i) => ({ x: toX(i), y: toY(h.preco_novo_brl as number) }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`grad_${componente ?? "all"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity="0.15" />
            <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad_${componente ?? "all"})`} />
        <path d={d} fill="none" stroke={BLUE} strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="white" stroke={BLUE} strokeWidth="1.5" />
        ))}
        {items.map((h, i) => (
          <text key={i} x={pts[i].x} y={H + 2} textAnchor="middle" fontSize="8" fill="#B0BAC9">
            {h.data_reajuste.slice(2, 7).replace("-", "/")}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Batch Modal ──────────────────────────────────────────────────────────────
interface BatchItem {
  id: string;
  codigo: string;
  descricao: string;
  preco_brl: number | null;
  preco_painel_220?: number | null;
  preco_painel_380?: number | null;
}

function BatchModal({
  tipo, id, nome, itens, onClose, onSuccess,
}: {
  tipo: "linha" | "categoria";
  id: string;
  nome: string;
  itens: BatchItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pct, setPct] = useState("0");
  const [motivo, setMotivo] = useState("Reajuste anual");
  const [dataVig, setDataVig] = useState(todayStr);
  const [compMoinho, setCompMoinho] = useState(true);
  const [comp220, setComp220] = useState(true);
  const [comp380, setComp380] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pctNum = parseFloat(pct) || 0;
  const fator = 1 + pctNum / 100;

  const comps: Array<"moinho" | "painel_220" | "painel_380"> = tipo === "linha"
    ? [
        ...(compMoinho ? ["moinho" as const] : []),
        ...(comp220 ? ["painel_220" as const] : []),
        ...(comp380 ? ["painel_380" as const] : []),
      ]
    : [];

  function handleConfirm() {
    startTransition(async () => {
      const res = await reajustarLote(tipo, id, pctNum, motivo, dataVig, comps);
      if (res.error) setError(res.error);
      else { onClose(); onSuccess(); }
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: 560, maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAV }}>
              Reajustar {tipo === "linha" ? "linha" : "categoria"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 2 }}>{nome} · {itens.length} item{itens.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7b8d" }}>✕</button>
        </div>

        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: tipo === "linha" ? 12 : 0 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>% Reajuste</label>
              <input
                type="number"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                step="0.1"
                style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>Data vigência</label>
              <input
                type="date"
                value={dataVig}
                onChange={(e) => setDataVig(e.target.value)}
                style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>Motivo</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, background: "#fff" }}
              >
                {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {tipo === "linha" && (
            <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={compMoinho} onChange={(e) => setCompMoinho(e.target.checked)} />
                Moinho
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={comp220} onChange={(e) => setComp220(e.target.checked)} />
                Painel 220V
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={comp380} onChange={(e) => setComp380(e.target.checked)} />
                Painel 380V
              </label>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 24px", maxHeight: 260, overflow: "auto", borderBottom: `1px solid ${BORDER}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "#6b7b8d", fontWeight: 700, fontSize: 10, textTransform: "uppercase" as const }}>Código</th>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "#6b7b8d", fontWeight: 700, fontSize: 10, textTransform: "uppercase" as const }}>Descrição</th>
                {tipo === "categoria" && <>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: "#6b7b8d", fontWeight: 700, fontSize: 10, textTransform: "uppercase" as const }}>Atual</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: "#6b7b8d", fontWeight: 700, fontSize: 10, textTransform: "uppercase" as const }}>Novo</th>
                </>}
                {tipo === "linha" && <>
                  {compMoinho && <th style={{ textAlign: "right", padding: "4px 6px", color: "#6b7b8d", fontWeight: 700, fontSize: 10 }}>Moinho</th>}
                  {comp220 && <th style={{ textAlign: "right", padding: "4px 6px", color: "#6b7b8d", fontWeight: 700, fontSize: 10 }}>220V</th>}
                  {comp380 && <th style={{ textAlign: "right", padding: "4px 6px", color: "#6b7b8d", fontWeight: 700, fontSize: 10 }}>380V</th>}
                </>}
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "5px 6px", fontFamily: "monospace", fontSize: 11, color: DANGER }}>{item.codigo}</td>
                  <td style={{ padding: "5px 6px", color: "#1a1a1a", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.descricao}</td>
                  {tipo === "categoria" && <>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "monospace" }}>{fmtBRL(item.preco_brl)}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "monospace", color: NAV, fontWeight: 700 }}>
                      {item.preco_brl != null ? fmtBRL(Math.round(item.preco_brl * fator * 100) / 100) : "—"}
                    </td>
                  </>}
                  {tipo === "linha" && <>
                    {compMoinho && <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>
                      {item.preco_brl != null ? `${fmtBRL(item.preco_brl)} → ${fmtBRL(Math.round(item.preco_brl * fator * 100) / 100)}` : "—"}
                    </td>}
                    {comp220 && <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>
                      {item.preco_painel_220 != null ? `${fmtBRL(item.preco_painel_220)} → ${fmtBRL(Math.round(item.preco_painel_220 * fator * 100) / 100)}` : "—"}
                    </td>}
                    {comp380 && <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>
                      {item.preco_painel_380 != null ? `${fmtBRL(item.preco_painel_380)} → ${fmtBRL(Math.round(item.preco_painel_380 * fator * 100) / 100)}` : "—"}
                    </td>}
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "16px 24px" }}>
          {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: DANGER, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={onClose}
              style={{ padding: "8px 18px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#fff" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending || pctNum === 0}
              style={{ padding: "8px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isPending || pctNum === 0 ? "not-allowed" : "pointer", opacity: isPending || pctNum === 0 ? 0.6 : 1 }}
            >
              {isPending ? "Aplicando..." : `Confirmar reajuste de ${pctNum.toFixed(1)}%`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Machine Detail Panel ─────────────────────────────────────────────────────
const COMP_CONFIG = [
  { campo: "moinho" as const, coluna: "preco_brl" as const, label: "Moinho", key: "preco_brl" as const },
  { campo: "painel_220" as const, coluna: "preco_painel_220" as const, label: "Painel 220V", key: "preco_painel_220" as const },
  { campo: "painel_380" as const, coluna: "preco_painel_380" as const, label: "Painel 380V", key: "preco_painel_380" as const },
];

function MaquinaDetailPanel({ equip, onSuccess }: { equip: Equip; onSuccess: () => void }) {
  const [modo, setModo] = useState<"unificado" | "individual">("unificado");
  const [pctUnif, setPctUnif] = useState("0");
  const [pctMap, setPctMap] = useState({ moinho: "0", painel_220: "0", painel_380: "0" });
  const [enabled, setEnabled] = useState({ moinho: true, painel_220: true, painel_380: true });
  const [motivo, setMotivo] = useState("Reajuste anual");
  const [dataVig, setDataVig] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const precoAtual = (comp: typeof COMP_CONFIG[0]) => equip[comp.key];
  const pctFor = (campo: keyof typeof pctMap) => modo === "unificado" ? pctUnif : pctMap[campo];

  function buildComponentes(): ComponenteReajuste[] {
    return COMP_CONFIG.filter((c) => enabled[c.campo] && precoAtual(c) != null).map((c) => {
      const atual = precoAtual(c) as number;
      return { campo: c.campo, coluna: c.coluna, preco_anterior: atual, novo_preco: calcNovo(atual, pctFor(c.campo)) };
    });
  }

  function handleSubmit() {
    const comps = buildComponentes();
    if (comps.length === 0) { setError("Selecione ao menos um componente com preço definido."); return; }
    setError(null); setSuccessMsg(null);
    startTransition(async () => {
      const res = await reajustarEquipamento(equip.id, comps, motivo, dataVig);
      if (res.error) setError(res.error);
      else { setSuccessMsg("Reajuste aplicado com sucesso!"); onSuccess(); }
    });
  }

  const compLabel: Record<string, string> = { moinho: "Moinho", painel_220: "Painel 220V", painel_380: "Painel 380V" };

  if (equip.solicitar_engenharia) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7b8d", marginBottom: 4 }}>CÓD. {equip.codigo}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>{equip.descricao}</div>
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: WARN, fontWeight: 600 }}>
          SOLICITAR COM ENGENHARIA — sem preço padrão definido.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7b8d", marginBottom: 3 }}>CÓD. {equip.codigo}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{equip.descricao}</div>
      </div>

      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: "#6b7b8d", letterSpacing: "0.06em" }}>Registrar reajuste</span>
          <div style={{ display: "flex", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden" }}>
            {(["unificado", "individual"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", background: modo === m ? NAV : "transparent", color: modo === m ? "#fff" : "#6b7b8d" }}
              >
                {m === "unificado" ? "Unificado" : "Individual"}
              </button>
            ))}
          </div>
        </div>

        {modo === "unificado" && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>% Reajuste (todos os componentes)</label>
            <input
              type="number"
              value={pctUnif}
              onChange={(e) => setPctUnif(e.target.value)}
              step="0.1"
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 14, fontFamily: "monospace" }}
            />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {COMP_CONFIG.map((c) => {
            const atual = precoAtual(c);
            if (atual == null) return null;
            const pct = pctFor(c.campo);
            const novo = calcNovo(atual, pct);
            return (
              <div key={c.campo} style={{ display: "grid", gridTemplateColumns: "28px 90px 1fr 1fr", gap: 6, alignItems: "center", padding: "6px 8px", background: enabled[c.campo] ? BG : "#f9fafb", borderRadius: 6, border: `1px solid ${BORDER}` }}>
                <input
                  type="checkbox"
                  checked={enabled[c.campo]}
                  onChange={(e) => setEnabled((prev) => ({ ...prev, [c.campo]: e.target.checked }))}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: enabled[c.campo] ? "#1a1a1a" : "#9ca3af" }}>{c.label}</span>
                {modo === "individual" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "#6b7b8d" }}>{fmtBRL(atual)}</span>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>→</span>
                    <input
                      type="number"
                      value={pctMap[c.campo]}
                      onChange={(e) => setPctMap((prev) => ({ ...prev, [c.campo]: e.target.value }))}
                      step="0.1"
                      disabled={!enabled[c.campo]}
                      style={{ width: 60, padding: "3px 5px", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, fontFamily: "monospace" }}
                      placeholder="%"
                    />
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>%</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "#6b7b8d" }}>{fmtBRL(atual)}</span>
                )}
                <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: enabled[c.campo] ? NAV : "#9ca3af", textAlign: "right" }}>
                  {enabled[c.campo] ? fmtBRL(novo) : "—"}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>Data vigência</label>
            <input
              type="date"
              value={dataVig}
              onChange={(e) => setDataVig(e.target.value)}
              style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>Motivo</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, background: "#fff" }}
            >
              {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: DANGER, marginBottom: 8 }}>{error}</div>}
        {successMsg && <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: SUCCESS, marginBottom: 8 }}>{successMsg}</div>}

        <button
          onClick={handleSubmit}
          disabled={isPending}
          style={{ width: "100%", padding: "9px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? "Aplicando..." : "Confirmar reajuste"}
        </button>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: "#6b7b8d", letterSpacing: "0.06em", marginBottom: 10 }}>Histórico de preços</div>
        {equip.historico.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0BAC9" }}>Sem registros.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {equip.historico.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 10, color: "#6b7b8d", width: 50, flexShrink: 0 }}>
                  {new Date(h.data_reajuste + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                </span>
                {h.componente && (
                  <span style={{ fontSize: 10, background: `${BLUE}15`, color: BLUE, borderRadius: 4, padding: "1px 6px", fontWeight: 600, flexShrink: 0 }}>
                    {compLabel[h.componente] ?? h.componente}
                  </span>
                )}
                <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "#1a1a1a", flex: 1 }}>{fmtBRL(h.preco_novo_brl)}</span>
                {h.percentual_reajuste != null && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: h.percentual_reajuste >= 0 ? "#dcfce7" : "#fee2e2", color: h.percentual_reajuste >= 0 ? SUCCESS : DANGER }}>
                    {h.percentual_reajuste >= 0 ? "+" : ""}{h.percentual_reajuste.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {equip.historico.length >= 2 && (
          <div style={{ marginTop: 12 }}>
            <SvgChart historico={equip.historico} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Peça Detail Panel ────────────────────────────────────────────────────────
function PecaDetailPanel({ peca, taxaDolar, onSuccess }: { peca: Peca; taxaDolar: number; onSuccess: () => void }) {
  const [novoPrecoStr, setNovoPrecoStr] = useState(peca.preco_brl?.toFixed(2) ?? "0");
  const [motivo, setMotivo] = useState("Reajuste anual");
  const [dataVig, setDataVig] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const atual = peca.preco_brl ?? 0;
  const novoPreco = parseFloat(novoPrecoStr) || 0;
  const diff = novoPreco - atual;
  const pct = atual > 0 ? (diff / atual) * 100 : 0;

  function handleSubmit() {
    setError(null); setSuccessMsg(null);
    const fd = new FormData();
    fd.set("produto_id", peca.id);
    fd.set("novo_preco", novoPreco.toString());
    fd.set("percentual", pct.toFixed(2));
    fd.set("motivo", motivo as "Reajuste anual");
    fd.set("data_vigencia", dataVig);

    startTransition(async () => {
      const res = await reajustarPreco({}, fd);
      if (res.message) setError(res.message);
      else if (res.errors) setError(Object.values(res.errors).flat()[0] ?? null);
      else { setSuccessMsg("Reajuste aplicado com sucesso!"); onSuccess(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7b8d", marginBottom: 3 }}>CÓD. {peca.codigo}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{peca.descricao}</div>
        {peca.ipi_pct > 0 && <div style={{ fontSize: 11, color: "#6b7b8d", marginTop: 2 }}>IPI {peca.ipi_pct.toFixed(2)}%</div>}
      </div>

      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#6b7b8d", letterSpacing: "0.06em", marginBottom: 6 }}>Preço atual</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: NAV, fontFamily: "monospace", marginBottom: 2 }}>{fmtBRL(peca.preco_brl)}</div>
        {peca.preco_brl != null && <div style={{ fontSize: 11, color: "#6b7b8d" }}>USD {(peca.preco_brl / taxaDolar).toFixed(2)} · câmbio R$ {taxaDolar.toFixed(2)}</div>}

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Registrar reajuste</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>Novo preço (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={novoPrecoStr}
                onChange={(e) => setNovoPrecoStr(e.target.value)}
                style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>Variação (%)</label>
              <input
                readOnly
                value={pct.toFixed(2)}
                style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: "monospace", background: BG, color: "#6b7b8d" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>Data vigência</label>
              <input
                type="date"
                value={dataVig}
                onChange={(e) => setDataVig(e.target.value)}
                style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#374151", marginBottom: 4 }}>Motivo</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                style={{ width: "100%", padding: "7px 9px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, background: "#fff" }}
              >
                {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: "#6b7b8d" }}>Preço atual</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmtBRL(atual)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: "#6b7b8d" }}>Variação</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: diff >= 0 ? WARN : DANGER }}>
                {diff >= 0 ? "+" : ""}{pct.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 2px", borderTop: `1px solid ${BORDER}`, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>Novo preço</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: NAV }}>{fmtBRL(novoPreco)}</span>
            </div>
          </div>

          {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: DANGER, marginBottom: 8 }}>{error}</div>}
          {successMsg && <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: SUCCESS, marginBottom: 8 }}>{successMsg}</div>}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            style={{ width: "100%", padding: "9px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? "Aplicando..." : "Confirmar reajuste"}
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: "#6b7b8d", letterSpacing: "0.06em", marginBottom: 8 }}>Histórico de preços</div>
        {peca.historico.length >= 2 && <div style={{ marginBottom: 10 }}><SvgChart historico={peca.historico} /></div>}
        {peca.historico.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0BAC9" }}>Sem registros.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {peca.historico.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 10, color: "#6b7b8d", width: 50, flexShrink: 0 }}>
                  {new Date(h.data_reajuste + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                </span>
                <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, flex: 1 }}>{fmtBRL(h.preco_novo_brl)}</span>
                {h.percentual_reajuste != null && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: h.percentual_reajuste >= 0 ? "#dcfce7" : "#fee2e2", color: h.percentual_reajuste >= 0 ? SUCCESS : DANGER }}>
                    {h.percentual_reajuste >= 0 ? "+" : ""}{h.percentual_reajuste.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ReajusteMain({ linhas, categorias, taxaDolar }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"maquinas" | "pecas">("maquinas");
  const [selectedLinhaId, setSelectedLinhaId] = useState<string | null>(linhas[0]?.id ?? null);
  const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(categorias[0]?.id ?? null);
  const [selectedPecaId, setSelectedPecaId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [batchModal, setBatchModal] = useState<{ tipo: "linha" | "categoria"; id: string; nome: string } | null>(null);

  function onSuccess() {
    router.refresh();
  }

  const selectedLinha = linhas.find((l) => l.id === selectedLinhaId) ?? null;
  const selectedEquip = selectedLinha?.equipamentos.find((e) => e.id === selectedEquipId) ?? null;
  const selectedCat = categorias.find((c) => c.id === selectedCatId) ?? null;
  const selectedPeca = selectedCat?.pecas.find((p) => p.id === selectedPecaId) ?? null;

  const filteredEquips = useMemo(() => {
    if (!selectedLinha) return [];
    if (!search.trim()) return selectedLinha.equipamentos;
    const q = search.toLowerCase();
    return selectedLinha.equipamentos.filter((e) =>
      e.codigo.toLowerCase().includes(q) || e.descricao.toLowerCase().includes(q)
    );
  }, [selectedLinha, search]);

  const filteredPecas = useMemo(() => {
    if (!selectedCat) return [];
    if (!search.trim()) return selectedCat.pecas;
    const q = search.toLowerCase();
    return selectedCat.pecas.filter((p) =>
      p.codigo.toLowerCase().includes(q) || p.descricao.toLowerCase().includes(q)
    );
  }, [selectedCat, search]);

  const pendingEquipTotal = useMemo(() =>
    linhas.reduce((acc, l) => acc + l.equipamentos.filter((e) => semReajusteAno(e.historico)).length, 0),
    [linhas]
  );
  const pendingPecaTotal = useMemo(() =>
    categorias.reduce((acc, c) => acc + c.pecas.filter((p) => semReajusteAno(p.historico)).length, 0),
    [categorias]
  );

  function pendingInLinha(l: Linha) {
    return l.equipamentos.filter((e) => semReajusteAno(e.historico)).length;
  }
  function pendingInCat(c: Categoria) {
    return c.pecas.filter((p) => semReajusteAno(p.historico)).length;
  }

  const isMaquinas = activeTab === "maquinas";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      {/* Page header */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: NAV, margin: 0 }}>Reajuste de Preços</h1>
          <p style={{ fontSize: 12, color: "#6b7b8d", marginTop: 2 }}>
            {pendingEquipTotal + pendingPecaTotal > 0
              ? `${pendingEquipTotal + pendingPecaTotal} item${pendingEquipTotal + pendingPecaTotal !== 1 ? "s" : ""} sem reajuste em ${anoAtual()}`
              : `Todos os itens reajustados em ${anoAtual()}`}
          </p>
        </div>
        <div style={{ display: "flex", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => { setActiveTab("maquinas"); setSearch(""); }}
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", background: isMaquinas ? NAV : "transparent", color: isMaquinas ? "#fff" : "#6b7b8d", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Layers size={13} /> Máquinas
            {pendingEquipTotal > 0 && <span style={{ background: isMaquinas ? "rgba(255,255,255,0.3)" : "#fee2e2", color: isMaquinas ? "#fff" : DANGER, borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{pendingEquipTotal}</span>}
          </button>
          <button
            onClick={() => { setActiveTab("pecas"); setSearch(""); }}
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", background: !isMaquinas ? NAV : "transparent", color: !isMaquinas ? "#fff" : "#6b7b8d", display: "flex", alignItems: "center", gap: 6 }}
          >
            Peças
            {pendingPecaTotal > 0 && <span style={{ background: !isMaquinas ? "rgba(255,255,255,0.3)" : "#fee2e2", color: !isMaquinas ? "#fff" : DANGER, borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{pendingPecaTotal}</span>}
          </button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left panel: linhas or categorias */}
        <aside style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${BORDER}`, background: "#fff", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "#6b7b8d", letterSpacing: "0.08em" }}>
            {isMaquinas ? "Linhas" : "Categorias"}
          </div>
          {(isMaquinas ? linhas : categorias).map((item) => {
            const isLinha = isMaquinas;
            const selId = isLinha ? selectedLinhaId : selectedCatId;
            const pending = isLinha ? pendingInLinha(item as Linha) : pendingInCat(item as Categoria);
            const total = isLinha ? (item as Linha).equipamentos.length : (item as Categoria).pecas.length;
            const isActive = item.id === selId;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isLinha) { setSelectedLinhaId(item.id); setSelectedEquipId(null); }
                  else { setSelectedCatId(item.id); setSelectedPecaId(null); }
                  setSearch("");
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 8px", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: isActive ? `${NAV}12` : "transparent", color: isActive ? NAV : "#1a1a1a", textAlign: "left", gap: 6 }}
              >
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nome}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {pending > 0 && <span style={{ background: "#FEF3C7", color: WARN, borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 700 }}>{pending}</span>}
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{total}</span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Middle panel: items list */}
        <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${BORDER}`, background: "#fff", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#B0BAC9" }} />
              <input
                type="text"
                placeholder="Filtrar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "5px 8px 5px 26px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, outline: "none" }}
              />
            </div>
            <button
              onClick={() => {
                if (isMaquinas && selectedLinha) setBatchModal({ tipo: "linha", id: selectedLinha.id, nome: selectedLinha.nome });
                else if (!isMaquinas && selectedCat) setBatchModal({ tipo: "categoria", id: selectedCat.id, nome: selectedCat.nome });
              }}
              disabled={isMaquinas ? !selectedLinha : !selectedCat}
              title="Reajustar todos"
              style={{ padding: "5px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: NAV, flexShrink: 0, opacity: (isMaquinas ? !selectedLinha : !selectedCat) ? 0.4 : 1 }}
            >
              Lote
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {(isMaquinas ? filteredEquips : filteredPecas).map((item) => {
              const isEquip = isMaquinas;
              const selId = isEquip ? selectedEquipId : selectedPecaId;
              const isActive = item.id === selId;
              const pending = semReajusteAno((item as Equip | Peca).historico);
              const preco = (item as Peca).preco_brl;
              const hist = (item as Equip | Peca).historico;
              const lastPct = hist[0]?.percentual_reajuste ?? null;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isEquip) setSelectedEquipId(item.id);
                    else setSelectedPecaId(item.id);
                  }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderBottom: `1px solid #F1F5F9`, border: "none", borderBottomWidth: 1, borderBottomStyle: "solid" as const, borderBottomColor: "#F1F5F9", cursor: "pointer", background: isActive ? "#EFF6FF" : "#fff" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: DANGER }}>CÓD. {item.codigo}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.descricao}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {preco != null && <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "#1a1a1a" }}>{fmtBRL(preco)}</div>}
                      {lastPct != null ? (
                        <div style={{ fontSize: 10, fontWeight: 600, color: lastPct >= 0 ? SUCCESS : DANGER, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                          {lastPct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {lastPct >= 0 ? "+" : ""}{lastPct.toFixed(1)}%
                        </div>
                      ) : pending ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: WARN, fontWeight: 700 }}>
                          <AlertTriangle size={9} /> sem reajuste
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
            {(isMaquinas ? filteredEquips : filteredPecas).length === 0 && (
              <div style={{ padding: "32px 12px", textAlign: "center", fontSize: 12, color: "#B0BAC9" }}>
                {isMaquinas ? (selectedLinha ? "Nenhum equipamento." : "Selecione uma linha.") : (selectedCat ? "Nenhuma peça." : "Selecione uma categoria.")}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: detail */}
        <div style={{ flex: 1, background: "#fff", overflow: "hidden" }}>
          {isMaquinas ? (
            selectedEquip ? (
              <MaquinaDetailPanel key={selectedEquip.id} equip={selectedEquip} onSuccess={onSuccess} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 13, color: "#B0BAC9" }}>
                <div style={{ textAlign: "center" }}>
                  <ChevronRight size={32} color="#E2E8F0" style={{ marginBottom: 8 }} />
                  Selecione um equipamento
                </div>
              </div>
            )
          ) : (
            selectedPeca ? (
              <PecaDetailPanel key={selectedPeca.id} peca={selectedPeca} taxaDolar={taxaDolar} onSuccess={onSuccess} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 13, color: "#B0BAC9" }}>
                <div style={{ textAlign: "center" }}>
                  <ChevronRight size={32} color="#E2E8F0" style={{ marginBottom: 8 }} />
                  Selecione uma peça
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Batch modal */}
      {batchModal && (
        <BatchModal
          tipo={batchModal.tipo}
          id={batchModal.id}
          nome={batchModal.nome}
          itens={batchModal.tipo === "linha"
            ? (linhas.find((l) => l.id === batchModal.id)?.equipamentos ?? [])
            : (categorias.find((c) => c.id === batchModal.id)?.pecas ?? [])}
          onClose={() => setBatchModal(null)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}

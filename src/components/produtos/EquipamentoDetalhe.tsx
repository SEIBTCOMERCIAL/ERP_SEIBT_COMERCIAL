"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, Upload, Trash2, Edit2, X, Save, Copy, Check, Eye, EyeOff, Link, Plus, Search } from "lucide-react";
import {
  atualizarPaineis, atualizarSpecs,
  uploadArquivoProduto, excluirArquivoProduto,
  vincularPecaEquipamento, desvincularPecaEquipamento,
  criarPecaEVincular, editarPecaVinculada,
  type AdminState,
} from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const parseCurr = (s: string): number | null => {
  if (!s || !s.trim()) return null;
  const clean = s.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
};

const toFmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpecCampo { id: string; nome: string; ordem: number }
interface CategoriaPeca { id: string; nome: string; ordem: number }
interface PecaCatalogo {
  id: string; codigo: string; descricao: string;
  preco_brl: number | null; ipi_pct: number; categoria_peca_id: string;
  furo_diametro: string | null;
}
interface VinculoPeca {
  id: string;
  quantidade: number;
  peca: { id: string; codigo: string; descricao: string; preco_brl: number | null; ipi_pct: number; ativo: boolean; categoria_peca_id: string; furo_diametro: string | null };
}
interface Arquivo {
  id: string; tipo: "imagem" | "desenho"; nome: string;
  url: string; storage_path: string | null; ordem: number;
}
interface Equip {
  id: string; codigo: string; descricao: string;
  descricao_painel?: string | null; potencia_motor?: string | null;
  preco_brl: number | null; preco_painel_220: number | null; preco_painel_380: number | null;
  ncm: string | null; specs: Record<string, unknown> | null;
  ativo: boolean; status?: "ativo" | "descontinuado";
  solicitar_engenharia?: boolean;
}
interface Linha { id: string; nome: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SubmitUpload() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
      <Upload size={14} />{pending ? "Enviando..." : "Enviar"}
    </button>
  );
}

function SubmitBtn({ label, pending: p }: { label: string; pending?: boolean }) {
  const { pending: formPending } = useFormStatus();
  const isPending = p ?? formPending;
  return (
    <button type="submit" disabled={isPending}
      style={{ padding: "9px 20px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
      {isPending ? "Salvando..." : label}
    </button>
  );
}

function UploadForm({ tipo, equip, linha, onDone }: { tipo: "imagem" | "desenho"; equip: Equip; linha: Linha; onDone: () => void }) {
  const router = useRouter();
  const [state, action] = useFormState<AdminState, FormData>(uploadArquivoProduto, {});
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.success) { router.refresh(); onDone(); if (fileRef.current) fileRef.current.value = ""; }
  }, [state.success, router, onDone]);
  return (
    <form action={action} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "12px 14px", background: BG, border: `1px dashed ${BORDER}`, borderRadius: 8 }}>
      <input type="hidden" name="produto_id" value={equip.id} />
      <input type="hidden" name="linha_id" value={linha.id} />
      <input type="hidden" name="tipo" value={tipo} />
      <input ref={fileRef} name="arquivo" type="file"
        accept={tipo === "imagem" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png"}
        required style={{ fontSize: 12, flex: 1 }} />
      <SubmitUpload />
      {state.error && <span style={{ fontSize: 11, color: "#DC2626" }}>{state.error}</span>}
    </form>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "none", color: copied ? "#16A34A" : BLUE, fontSize: 11, cursor: "pointer", padding: 0, fontWeight: 500 }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}


function PriceRow({ label, value, bold }: { label: string; value: number | null; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: bold ? "#374151" : "#6b7b8d", fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 500, color: bold ? NAV : "#374151" }}>{fmt(value)}</span>
    </div>
  );
}

function CurrencyInputField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: number | null }) {
  const [val, setVal] = useState(() => toFmt(defaultValue));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>{label}</label>
      <input name={name} value={val} onChange={e => setVal(e.target.value)}
        onBlur={() => { const n = parseCurr(val); if (n != null) setVal(toFmt(n)); else if (!val.trim()) setVal(""); }}
        placeholder="0,00"
        style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
    </div>
  );
}

// ─── Peça modals ─────────────────────────────────────────────────────────────

function BuscarPecaModal({ disponiveis, isPending, onVincular, onClose }: {
  disponiveis: PecaCatalogo[];
  isPending: boolean;
  onVincular: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtradas = disponiveis.filter(p =>
    p.codigo.toLowerCase().includes(q.toLowerCase()) ||
    p.descricao.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 16px" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 580, maxHeight: "70vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAV }}>Vincular peça existente</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ position: "relative" }}>
            <Search size={14} color="#b0bac9" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por código ou descrição..."
              autoFocus
              style={{ width: "100%", height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px 0 32px", fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtradas.length === 0 && (
            <div style={{ padding: "24px 20px", color: "#6b7b8d", fontSize: 13, textAlign: "center" }}>
              {disponiveis.length === 0 ? "Todas as peças desta categoria já estão vinculadas." : "Nenhum resultado."}
            </div>
          )}
          {filtradas.map(p => {
            const totalIpi = p.preco_brl != null ? p.preco_brl * (1 + p.ipi_pct / 100) : null;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NAV }}>{p.codigo}</div>
                  <div style={{ fontSize: 12, color: "#374151", marginTop: 1 }}>{p.descricao}</div>
                  <div style={{ fontSize: 11, color: "#6b7b8d", marginTop: 2 }}>
                    {fmt(p.preco_brl)} · IPI {p.ipi_pct}% · Total {fmt(totalIpi)}
                  </div>
                </div>
                <button onClick={() => onVincular(p.id)} disabled={isPending}
                  style={{ padding: "6px 14px", background: NAV, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.5 : 1, whiteSpace: "nowrap" as const }}>
                  <Link size={12} style={{ display: "inline", marginRight: 4 }} />Vincular
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CriarPecaModal({ categoria, equipamentoId, linhaId, onClose }: {
  categoria: CategoriaPeca; equipamentoId: string; linhaId: string; onClose: () => void;
}) {
  const router = useRouter();
  const [state, action] = useFormState<AdminState, FormData>(criarPecaEVincular, {});
  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  }, [state.success, router, onClose]);
  const showFuro = categoria.nome.toLowerCase().includes("peneira");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 16px" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAV }}>Nova peça — {categoria.nome}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}><X size={18} /></button>
        </div>
        <form action={action} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="hidden" name="categoria_peca_id" value={categoria.id} />
          <input type="hidden" name="equipamento_id" value={equipamentoId} />
          <input type="hidden" name="linha_id" value={linhaId} />
          {state.error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "8px 12px", borderRadius: 7, fontSize: 12 }}>{state.error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Código <span style={{ color: "#DC2626" }}>*</span></label>
              <input name="codigo" required placeholder="ex: NAV-220" style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>NCM</label>
              <input name="ncm" placeholder="ex: 84798200" style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Descrição <span style={{ color: "#DC2626" }}>*</span></label>
            <input name="descricao" required placeholder="Nome / descrição da peça" style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <CurrencyInputField name="preco_brl" label="Preço (R$)" />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>IPI (%)</label>
              <input name="ipi_pct" type="number" min="0" step="0.01" defaultValue="0" style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: showFuro ? "1fr 1fr" : "1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Quantidade neste equipamento</label>
              <input name="quantidade" type="number" min="1" defaultValue="1" style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
            {showFuro && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Ø do furo</label>
                <input name="furo_diametro" placeholder="ex: 2mm" style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancelar</button>
            <SubmitBtn label="Criar e vincular" />
          </div>
        </form>
      </div>
    </div>
  );
}

function EditarPecaModal({ vinculo, equipamentoId, linhaId, showFuro, onClose }: {
  vinculo: VinculoPeca; equipamentoId: string; linhaId: string; showFuro: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [state, action] = useFormState<AdminState, FormData>(editarPecaVinculada, {});
  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  }, [state.success, router, onClose]);
  const p = vinculo.peca;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 16px" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAV }}>Editar peça — {p.codigo}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}><X size={18} /></button>
        </div>
        <form action={action} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="vinculo_id" value={vinculo.id} />
          <input type="hidden" name="equipamento_id" value={equipamentoId} />
          <input type="hidden" name="linha_id" value={linhaId} />
          <input type="hidden" name="categoria_peca_id" value={p.categoria_peca_id} />
          {state.error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "8px 12px", borderRadius: 7, fontSize: 12 }}>{state.error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Código</label>
            <input name="codigo" defaultValue={p.codigo} style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Descrição <span style={{ color: "#DC2626" }}>*</span></label>
            <input name="descricao" required defaultValue={p.descricao} style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <CurrencyInputField name="preco_brl" label="Preço (R$)" defaultValue={p.preco_brl} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>IPI (%)</label>
              <input name="ipi_pct" type="number" min="0" step="0.01" defaultValue={p.ipi_pct} style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: showFuro ? "1fr 1fr" : "1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Quantidade neste equipamento</label>
              <input name="quantidade" type="number" min="1" defaultValue={vinculo.quantidade ?? 1} style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
            </div>
            {showFuro && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Ø do furo</label>
                <input name="furo_diametro" defaultValue={p.furo_diametro ?? ""} placeholder="ex: 2mm" style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
              </div>
            )}
          </div>
          <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 7, padding: "8px 12px", fontSize: 11, color: "#92400E" }}>
            Editar aqui atualiza o catálogo central — reflete em todos os equipamentos que usam esta peça.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancelar</button>
            <SubmitBtn label="Salvar" />
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PecaTab ─────────────────────────────────────────────────────────────────

type PecaModal = null | "buscar" | "criar" | { editando: VinculoPeca };

function PecaTab({ categoria, vinculos, pecasCatalogo, equipamentoId, linhaId, effectiveAdmin }: {
  categoria: CategoriaPeca;
  vinculos: VinculoPeca[];
  pecasCatalogo: PecaCatalogo[];
  equipamentoId: string;
  linhaId: string;
  effectiveAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<PecaModal>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const showFuro = categoria.nome.toLowerCase().includes("peneira");

  const jaVinculadasIds = new Set(vinculos.map(v => v.peca.id));
  const disponiveis = pecasCatalogo.filter(p =>
    p.categoria_peca_id === categoria.id && !jaVinculadasIds.has(p.id)
  );

  const handleVincular = (pecaId: string) => {
    startTransition(async () => {
      const res = await vincularPecaEquipamento(pecaId, equipamentoId, linhaId);
      if (res.error) alert(res.error);
      else { setModal(null); router.refresh(); }
    });
  };

  const handleDesvincular = (v: VinculoPeca) => {
    if (!confirm(`Desvincular "${v.peca.codigo}" deste equipamento? A peça continua no catálogo.`)) return;
    startTransition(async () => {
      const res = await desvincularPecaEquipamento(v.id, equipamentoId, linhaId);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const gridCols = showFuro
    ? "120px 1fr 80px 110px 60px 120px 64px 44px"
    : "120px 1fr 110px 60px 120px 64px 44px";

  const headers = showFuro
    ? ["Código", "Descrição", "Ø Furo", "Preço", "IPI", "Total c/ IPI", "QTD", ""]
    : ["Código", "Descrição", "Preço", "IPI", "Total c/ IPI", "QTD", ""];

  return (
    <div style={{ maxWidth: 860 }}>
      {vinculos.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "28px 20px", textAlign: "center", color: "#6b7b8d", fontSize: 13, marginBottom: 16 }}>
          Nenhuma peça de {categoria.nome} vinculada a este equipamento.
        </div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 0, padding: "8px 16px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
            {headers.map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: "#6B7B8D", textTransform: "uppercase" as const, textAlign: i >= (showFuro ? 2 : 2) && i < headers.length - 1 ? "right" : "left" as const }}>{h}</div>
            ))}
          </div>
          {vinculos.map((v, i) => {
            const totalIpi = v.peca.preco_brl != null ? v.peca.preco_brl * (1 + v.peca.ipi_pct / 100) : null;
            const isHovered = hoveredId === v.id;
            return (
              <div key={v.id}
                onMouseEnter={() => setHoveredId(v.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ display: "grid", gridTemplateColumns: gridCols, gap: 0, padding: "10px 16px", borderBottom: i < vinculos.length - 1 ? `1px solid ${BORDER}` : "none", background: isHovered ? "#F8FAFC" : "#fff", alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: NAV }}>{v.peca.codigo}</div>
                <div style={{ fontSize: 12, color: "#374151" }}>{v.peca.descricao}</div>
                {showFuro && (
                  <div style={{ fontSize: 12, color: "#6b7b8d", textAlign: "right" as const }}>{v.peca.furo_diametro ?? "—"}</div>
                )}
                <div style={{ fontSize: 12, color: "#374151", textAlign: "right" as const }}>{fmt(v.peca.preco_brl)}</div>
                <div style={{ fontSize: 12, color: "#6b7b8d", textAlign: "right" as const }}>{v.peca.ipi_pct}%</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAV, textAlign: "right" as const }}>{fmt(totalIpi)}</div>
                <div style={{ fontSize: 12, color: "#374151", textAlign: "center" as const }}>{v.quantidade ?? 1}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                  {effectiveAdmin && (
                    <>
                      <button onClick={() => setModal({ editando: v })}
                        style={{ background: "none", border: "none", cursor: "pointer", color: BLUE, opacity: isHovered ? 1 : 0, transition: "opacity 0.1s", padding: 3 }}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDesvincular(v)} disabled={isPending}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", opacity: isHovered ? 1 : 0, transition: "opacity 0.1s", padding: 3 }}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {effectiveAdmin && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setModal("buscar")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Link size={13} /> Vincular existente
          </button>
          <button onClick={() => setModal("criar")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={13} /> Nova peça
          </button>
        </div>
      )}

      {modal === "buscar" && (
        <BuscarPecaModal
          disponiveis={disponiveis}
          isPending={isPending}
          onVincular={handleVincular}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "criar" && (
        <CriarPecaModal
          categoria={categoria}
          equipamentoId={equipamentoId}
          linhaId={linhaId}
          onClose={() => setModal(null)}
        />
      )}
      {modal !== null && typeof modal === "object" && "editando" in modal && (
        <EditarPecaModal
          vinculo={modal.editando}
          equipamentoId={equipamentoId}
          linhaId={linhaId}
          showFuro={showFuro}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EquipamentoDetalhe({ isAdmin, linha, equip, arquivos, specCampos, categorias, vinculos, pecasCatalogo }: {
  isAdmin: boolean;
  linha: Linha;
  equip: Equip;
  arquivos: Arquivo[];
  specCampos: SpecCampo[];
  categorias: CategoriaPeca[];
  vinculos: VinculoPeca[];
  pecasCatalogo: PecaCatalogo[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("specs");
  const [isPending, startTransition] = useTransition();
  const [showUploadImagem, setShowUploadImagem] = useState(false);
  const [showUploadDesenho, setShowUploadDesenho] = useState(false);
  const [previewAsUser, setPreviewAsUser] = useState(false);

  const effectiveAdmin = isAdmin && !previewAsUser;

  const [specValues, setSpecValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const campo of specCampos) init[campo.nome] = (equip.specs?.[campo.nome] as string) ?? "";
    return init;
  });
  const [specsMsg, setSpecsMsg] = useState("");

  const [editingPrices, setEditingPrices] = useState(false);
  const [draft, setDraft] = useState({
    brl: toFmt(equip.preco_brl),
    p220: toFmt(equip.preco_painel_220),
    p380: toFmt(equip.preco_painel_380),
    solicitar: equip.solicitar_engenharia ?? false,
  });
  const [precoMsg, setPrecoMsg] = useState("");

  const handleSaveSpecs = () => {
    setSpecsMsg("");
    const obj: Record<string, string> = {};
    for (const campo of specCampos) { if (specValues[campo.nome]?.trim()) obj[campo.nome] = specValues[campo.nome].trim(); }
    startTransition(async () => {
      const res = await atualizarSpecs(equip.id, linha.id, JSON.stringify(obj));
      if (res.error) setSpecsMsg(res.error);
      else { setSpecsMsg("Salvo"); router.refresh(); }
    });
  };

  const handleSavePrecos = () => {
    setPrecoMsg("");
    startTransition(async () => {
      const res = await atualizarPaineis(equip.id, linha.id, parseCurr(draft.brl), parseCurr(draft.p220), parseCurr(draft.p380), draft.solicitar);
      if (res.error) setPrecoMsg(res.error);
      else { setPrecoMsg("Salvo"); setEditingPrices(false); router.refresh(); }
    });
  };

  const cancelEdit = () => {
    setDraft({ brl: toFmt(equip.preco_brl), p220: toFmt(equip.preco_painel_220), p380: toFmt(equip.preco_painel_380), solicitar: equip.solicitar_engenharia ?? false });
    setEditingPrices(false); setPrecoMsg("");
  };

  const handleExcluirArquivo = (arq: Arquivo) => {
    if (!confirm(`Excluir "${arq.nome}"?`)) return;
    startTransition(async () => {
      const res = await excluirArquivoProduto(arq.id, arq.storage_path, equip.id, linha.id);
      if (res.error) alert(res.error); else router.refresh();
    });
  };

  const imagens = arquivos.filter(a => a.tipo === "imagem");
  const desenhos = arquivos.filter(a => a.tipo === "desenho");
  const brlVal = parseCurr(draft.brl) ?? 0;
  const p220Val = parseCurr(draft.p220) ?? 0;
  const p380Val = parseCurr(draft.p380) ?? 0;

  // Compute category tabs
  const vinculosPorCategoria = categorias.map(cat => ({
    ...cat,
    vinculos: vinculos.filter(v => v.peca.categoria_peca_id === cat.id),
  }));
  const abasCategorias = effectiveAdmin
    ? vinculosPorCategoria
    : vinculosPorCategoria.filter(c => c.vinculos.length > 0);

  const currInp = (val: string, set: (v: string) => void) => (
    <input type="text" value={val} onChange={e => set(e.target.value)}
      onBlur={() => { const n = parseCurr(val); if (n != null) set(toFmt(n)); else if (!val.trim()) set(""); }}
      placeholder="0,00"
      style={{ width: "100%", height: 34, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
  );

  const staticTabs = [
    { key: "specs", label: "Especificações" },
    { key: "precos", label: "Preço e painéis" },
    { key: "imagens", label: `Imagens${imagens.length ? ` (${imagens.length})` : ""}` },
    { key: "desenhos", label: `Desenhos${desenhos.length ? ` (${desenhos.length})` : ""}` },
  ];
  const catTabs = abasCategorias.map(cat => ({
    key: cat.id,
    label: `${cat.nome}${cat.vinculos.length ? ` (${cat.vinculos.length})` : ""}`,
  }));
  const allTabs = [...staticTabs, ...catTabs];

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 28 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7b8d", marginBottom: 20 }}>
        <span style={{ cursor: "pointer", color: BLUE }} onClick={() => router.push("/produtos")}>Produtos</span>
        <ChevronRight size={14} />
        <span style={{ cursor: "pointer", color: BLUE }} onClick={() => router.push(`/produtos/linhas/${linha.id}`)}>{linha.nome}</span>
        <ChevronRight size={14} />
        <span style={{ color: NAV, fontWeight: 600 }}>{equip.codigo}</span>
      </div>

      {previewAsUser && (
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#92400E", display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={14} /> Modo visualização — você está vendo como um vendedor. Edições desativadas.
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>{equip.codigo}</h1>
            {equip.status === "descontinuado" && (
              <span style={{ padding: "2px 10px", background: "#F1F5F9", color: "#6b7b8d", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>DESCONTINUADO</span>
            )}
          </div>
          {equip.potencia_motor && <div style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>{equip.potencia_motor}</div>}
        </div>
        {isAdmin && (
          <button onClick={() => setPreviewAsUser(v => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: previewAsUser ? "#FEF3C7" : "#fff", color: previewAsUser ? "#92400E" : "#374151", border: `1px solid ${previewAsUser ? "#FCD34D" : BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {previewAsUser ? <EyeOff size={14} /> : <Eye size={14} />}
            {previewAsUser ? "Sair do modo usuário" : "Ver como usuário"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: `2px solid ${BORDER}`, marginBottom: 24, overflowX: "auto" }}>
        {allTabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "10px 18px", background: "none", border: "none", borderBottom: tab === t.key ? `2px solid ${NAV}` : "2px solid transparent", marginBottom: -2, fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? NAV : "#6b7b8d", cursor: "pointer", whiteSpace: "nowrap" as const }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Especificações ── */}
      {tab === "specs" && (
        <div style={{ maxWidth: 640 }}>
          {equip.descricao && (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Descrição do moinho</span>
                <CopyButton text={equip.descricao} />
              </div>
              <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.55 }}>{equip.descricao}</div>
            </div>
          )}
          {equip.descricao_painel && (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Descrição do painel</span>
                <CopyButton text={equip.descricao_painel} />
              </div>
              <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.55 }}>{equip.descricao_painel}</div>
            </div>
          )}
          {effectiveAdmin ? (
            specCampos.length > 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Especificações técnicas</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  {specCampos.map((campo, i) => (
                    <div key={campo.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, borderRight: i % 2 === 0 ? `1px solid ${BORDER}` : "none", background: Math.floor(i / 2) % 2 === 0 ? "#fff" : BG }}>
                      <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 4 }}>{campo.nome}</div>
                      <input value={specValues[campo.nome] ?? ""} onChange={e => setSpecValues(v => ({ ...v, [campo.nome]: e.target.value }))}
                        style={{ width: "100%", height: 30, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "0 8px", fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box" as const }} />
                    </div>
                  ))}
                </div>
                <div style={{ padding: "12px 18px", borderTop: `1px solid ${BORDER}`, background: BG, display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={handleSaveSpecs} disabled={isPending}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
                    <Save size={13} /> Salvar especificações
                  </button>
                  {specsMsg && <span style={{ fontSize: 12, color: specsMsg === "Salvo" ? "#16A34A" : "#DC2626" }}>{specsMsg}</span>}
                </div>
              </div>
            ) : (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px", color: "#6b7b8d", fontSize: 13 }}>
                Nenhum template configurado. Configure os campos na página da linha.
              </div>
            )
          ) : (
            specCampos.length > 0 && Object.keys(equip.specs ?? {}).length > 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Especificações técnicas</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  {specCampos.map((campo, i) => {
                    const val = equip.specs?.[campo.nome];
                    return (
                      <div key={campo.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, borderRight: i % 2 === 0 ? `1px solid ${BORDER}` : "none", background: Math.floor(i / 2) % 2 === 0 ? "#fff" : BG }}>
                        <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 3 }}>{campo.nome}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{val != null ? String(val) : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : !equip.descricao && !equip.descricao_painel ? (
              <div style={{ color: "#6b7b8d", fontSize: 13 }}>Nenhuma especificação cadastrada.</div>
            ) : null
          )}
        </div>
      )}

      {/* ── Preço e painéis ── */}
      {tab === "precos" && (
        <div style={{ maxWidth: 540 }}>
          {effectiveAdmin && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, gap: 8 }}>
              {!editingPrices ? (
                <button onClick={() => setEditingPrices(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <Edit2 size={13} /> Editar preços
                </button>
              ) : (
                <>
                  <button onClick={cancelEdit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <X size={13} /> Cancelar
                  </button>
                  <button onClick={handleSavePrecos} disabled={isPending} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
                    <Save size={13} /> Salvar
                  </button>
                  {precoMsg && <span style={{ fontSize: 12, color: precoMsg === "Salvo" ? "#16A34A" : "#DC2626", alignSelf: "center" }}>{precoMsg}</span>}
                </>
              )}
            </div>
          )}

          {editingPrices && (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Toggle solicitar com engenharia */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" as const }}>
                <div onClick={() => setDraft(d => ({ ...d, solicitar: !d.solicitar }))}
                  style={{ width: 38, height: 20, borderRadius: 10, background: draft.solicitar ? "#D97706" : "#D1D5DB", position: "relative", transition: "background 0.2s", cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: draft.solicitar ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: draft.solicitar ? "#92400E" : "#374151" }}>
                  Solicitar com engenharia
                </span>
              </label>
              {draft.solicitar && (
                <div style={{ padding: "8px 12px", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 7, fontSize: 11, color: "#92400E" }}>
                  Preço será exibido como &quot;SOLICITAR COM ENGENHARIA&quot;. Os valores abaixo ficam salvos mas não serão exibidos.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, opacity: draft.solicitar ? 0.4 : 1, pointerEvents: draft.solicitar ? "none" : "auto" }}>
                <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Moinho</div>{currInp(draft.brl, v => setDraft(d => ({ ...d, brl: v })))}</div>
                <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Painel 220V</div>{currInp(draft.p220, v => setDraft(d => ({ ...d, p220: v })))}</div>
                <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Painel 380V</div>{currInp(draft.p380, v => setDraft(d => ({ ...d, p380: v })))}</div>
              </div>
            </div>
          )}

          {/* View: solicitar com engenharia */}
          {(editingPrices ? draft.solicitar : equip.solicitar_engenharia) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 10, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#D97706", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Solicitar com engenharia</span>
            </div>
          )}

          {!(editingPrices ? draft.solicitar : equip.solicitar_engenharia) && (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: NAV, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Resumo de preços</span>
              </div>
              <div style={{ padding: "4px 18px" }}>
                <PriceRow label="Moinho" value={editingPrices ? (parseCurr(draft.brl) ?? null) : equip.preco_brl} />
                <PriceRow label="Painel 220V" value={editingPrices ? (parseCurr(draft.p220) ?? null) : equip.preco_painel_220} />
                <PriceRow label="Painel 380V" value={editingPrices ? (parseCurr(draft.p380) ?? null) : equip.preco_painel_380} />
              </div>
              <div style={{ borderTop: `2px solid ${BORDER}`, padding: "4px 18px" }}>
                <PriceRow label="Total Moinho + Painel 220V" bold value={editingPrices ? (brlVal + p220Val || null) : (((equip.preco_brl ?? 0) + (equip.preco_painel_220 ?? 0)) || null)} />
                <PriceRow label="Total Moinho + Painel 380V" bold value={editingPrices ? (brlVal + p380Val || null) : (((equip.preco_brl ?? 0) + (equip.preco_painel_380 ?? 0)) || null)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Imagens ── */}
      {tab === "imagens" && (
        <div>
          {imagens.length === 0 && !effectiveAdmin && <div style={{ textAlign: "center", color: "#6b7b8d", fontSize: 13, padding: 40 }}>Nenhuma imagem cadastrada.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            {imagens.map(arq => (
              <div key={arq.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={arq.url} alt={arq.nome} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#6b7b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{arq.nome}</span>
                  {effectiveAdmin && <button onClick={() => handleExcluirArquivo(arq)} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
          {effectiveAdmin && (
            <>
              <button onClick={() => setShowUploadImagem(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Upload size={14} /> Enviar imagem
              </button>
              {showUploadImagem && <UploadForm tipo="imagem" equip={equip} linha={linha} onDone={() => setShowUploadImagem(false)} />}
            </>
          )}
        </div>
      )}

      {/* ── Desenhos técnicos ── */}
      {tab === "desenhos" && (
        <div>
          {desenhos.length === 0 && !effectiveAdmin && <div style={{ textAlign: "center", color: "#6b7b8d", fontSize: 13, padding: 40 }}>Nenhum desenho técnico cadastrado.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {desenhos.map(arq => (
              <div key={arq.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={18} color={BLUE} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{arq.nome}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a href={arq.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Abrir</a>
                  {effectiveAdmin && <button onClick={() => handleExcluirArquivo(arq)} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
          {effectiveAdmin && (
            <>
              <button onClick={() => setShowUploadDesenho(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Upload size={14} /> Enviar desenho / PDF
              </button>
              {showUploadDesenho && <UploadForm tipo="desenho" equip={equip} linha={linha} onDone={() => setShowUploadDesenho(false)} />}
            </>
          )}
        </div>
      )}

      {/* ── Category tabs (peças) ── */}
      {abasCategorias.map(cat => (
        tab === cat.id && (
          <PecaTab
            key={cat.id}
            categoria={cat}
            vinculos={cat.vinculos}
            pecasCatalogo={pecasCatalogo}
            equipamentoId={equip.id}
            linhaId={linha.id}
            effectiveAdmin={effectiveAdmin}
          />
        )
      ))}
    </div>
  );
}

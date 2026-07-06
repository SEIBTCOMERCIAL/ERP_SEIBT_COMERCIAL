"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, Upload, Trash2, Edit2, X, Save, Copy, Check, Eye, EyeOff } from "lucide-react";
import {
  atualizarPaineis, atualizarSpecs,
  uploadArquivoProduto, excluirArquivoProduto,
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

type Tab = "specs" | "precos" | "imagens" | "desenhos";

interface SpecCampo { id: string; nome: string; ordem: number }

interface Arquivo {
  id: string;
  tipo: "imagem" | "desenho";
  nome: string;
  url: string;
  storage_path: string | null;
  ordem: number;
}

interface Equip {
  id: string;
  codigo: string;
  descricao: string;
  descricao_painel?: string | null;
  potencia_motor?: string | null;
  preco_brl: number | null;
  preco_painel_220: number | null;
  preco_painel_380: number | null;
  ncm: string | null;
  specs: Record<string, unknown> | null;
  ativo: boolean;
  status?: "ativo" | "descontinuado";
}

interface Linha { id: string; nome: string }

function SubmitUpload() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
      <Upload size={14} />{pending ? "Enviando..." : "Enviar"}
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
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy}
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

export function EquipamentoDetalhe({ isAdmin, linha, equip, arquivos, specCampos }: {
  isAdmin: boolean;
  linha: Linha;
  equip: Equip;
  arquivos: Arquivo[];
  specCampos: SpecCampo[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("specs");
  const [isPending, startTransition] = useTransition();
  const [showUploadImagem, setShowUploadImagem] = useState(false);
  const [showUploadDesenho, setShowUploadDesenho] = useState(false);
  const [previewAsUser, setPreviewAsUser] = useState(false);

  const effectiveAdmin = isAdmin && !previewAsUser;

  const [specValues, setSpecValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const campo of specCampos) {
      init[campo.nome] = (equip.specs?.[campo.nome] as string) ?? "";
    }
    return init;
  });
  const [specsMsg, setSpecsMsg] = useState("");

  const [editingPrices, setEditingPrices] = useState(false);
  const [draft, setDraft] = useState({
    brl: toFmt(equip.preco_brl),
    p220: toFmt(equip.preco_painel_220),
    p380: toFmt(equip.preco_painel_380),
  });
  const [precoMsg, setPrecoMsg] = useState("");

  const handleSaveSpecs = () => {
    setSpecsMsg("");
    const obj: Record<string, string> = {};
    for (const campo of specCampos) {
      if (specValues[campo.nome]?.trim()) obj[campo.nome] = specValues[campo.nome].trim();
    }
    startTransition(async () => {
      const res = await atualizarSpecs(equip.id, linha.id, JSON.stringify(obj));
      if (res.error) setSpecsMsg(res.error);
      else { setSpecsMsg("Salvo"); router.refresh(); }
    });
  };

  const handleSavePrecos = () => {
    setPrecoMsg("");
    startTransition(async () => {
      const res = await atualizarPaineis(
        equip.id, linha.id,
        parseCurr(draft.brl),
        parseCurr(draft.p220),
        parseCurr(draft.p380),
      );
      if (res.error) setPrecoMsg(res.error);
      else { setPrecoMsg("Salvo"); setEditingPrices(false); router.refresh(); }
    });
  };

  const cancelEdit = () => {
    setDraft({ brl: toFmt(equip.preco_brl), p220: toFmt(equip.preco_painel_220), p380: toFmt(equip.preco_painel_380) });
    setEditingPrices(false);
    setPrecoMsg("");
  };

  const handleExcluirArquivo = (arq: Arquivo) => {
    if (!confirm(`Excluir "${arq.nome}"?`)) return;
    startTransition(async () => {
      const res = await excluirArquivoProduto(arq.id, arq.storage_path, equip.id, linha.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const imagens = arquivos.filter(a => a.tipo === "imagem");
  const desenhos = arquivos.filter(a => a.tipo === "desenho");

  const brlVal = parseCurr(draft.brl) ?? 0;
  const p220Val = parseCurr(draft.p220) ?? 0;
  const p380Val = parseCurr(draft.p380) ?? 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "specs", label: "Especificações" },
    { key: "precos", label: "Preço e painéis" },
    { key: "imagens", label: `Imagens${imagens.length ? ` (${imagens.length})` : ""}` },
    { key: "desenhos", label: `Desenhos técnicos${desenhos.length ? ` (${desenhos.length})` : ""}` },
  ];

  const currInp = (val: string, set: (v: string) => void) => (
    <input type="text" value={val}
      onChange={e => set(e.target.value)}
      onBlur={() => {
        const n = parseCurr(val);
        if (n != null) set(toFmt(n));
        else if (!val.trim()) set("");
      }}
      placeholder="0,00"
      style={{ width: "100%", height: 34, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
    />
  );

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

      {/* Preview banner */}
      {previewAsUser && (
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#92400E", display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={14} />
          Modo visualização — você está vendo como um vendedor. Edições desativadas.
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
          {equip.potencia_motor && (
            <div style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>{equip.potencia_motor}</div>
          )}
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
      <div style={{ display: "flex", gap: 2, borderBottom: `2px solid ${BORDER}`, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "10px 18px", background: "none", border: "none", borderBottom: tab === t.key ? `2px solid ${NAV}` : "2px solid transparent", marginBottom: -2, fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? NAV : "#6b7b8d", cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Especificações ── */}
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
                    <div key={campo.id}
                      style={{ padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, borderRight: i % 2 === 0 ? `1px solid ${BORDER}` : "none", background: Math.floor(i / 2) % 2 === 0 ? "#fff" : BG }}>
                      <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 4 }}>{campo.nome}</div>
                      <input
                        value={specValues[campo.nome] ?? ""}
                        onChange={e => setSpecValues(v => ({ ...v, [campo.nome]: e.target.value }))}
                        style={{ width: "100%", height: 30, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "0 8px", fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box" as const }}
                      />
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
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px 18px", color: "#6b7b8d", fontSize: 13 }}>
                Nenhum template de especificações configurado para esta linha. Configure os campos na página da linha.
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
                      <div key={campo.id}
                        style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, borderRight: i % 2 === 0 ? `1px solid ${BORDER}` : "none", background: Math.floor(i / 2) % 2 === 0 ? "#fff" : BG }}>
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

      {/* ── Tab: Preço e painéis ── */}
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
                  <button onClick={cancelEdit}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <X size={13} /> Cancelar
                  </button>
                  <button onClick={handleSavePrecos} disabled={isPending}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
                    <Save size={13} /> Salvar
                  </button>
                  {precoMsg && <span style={{ fontSize: 12, color: precoMsg === "Salvo" ? "#16A34A" : "#DC2626", alignSelf: "center" }}>{precoMsg}</span>}
                </>
              )}
            </div>
          )}

          {/* Edit inputs */}
          {editingPrices && (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px", marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Moinho</div>
                {currInp(draft.brl, v => setDraft(d => ({ ...d, brl: v })))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Painel 220V</div>
                {currInp(draft.p220, v => setDraft(d => ({ ...d, p220: v })))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Painel 380V</div>
                {currInp(draft.p380, v => setDraft(d => ({ ...d, p380: v })))}
              </div>
            </div>
          )}

          {/* 5-value price summary */}
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: NAV, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Resumo de preços</span>
            </div>
            <div style={{ padding: "4px 18px" }}>
              <PriceRow
                label="Moinho"
                value={editingPrices ? (parseCurr(draft.brl) ?? null) : equip.preco_brl}
              />
              <PriceRow
                label="Painel 220V"
                value={editingPrices ? (parseCurr(draft.p220) ?? null) : equip.preco_painel_220}
              />
              <PriceRow
                label="Painel 380V"
                value={editingPrices ? (parseCurr(draft.p380) ?? null) : equip.preco_painel_380}
              />
            </div>
            <div style={{ borderTop: `2px solid ${BORDER}`, padding: "4px 18px" }}>
              <PriceRow
                label="Total Moinho + Painel 220V"
                bold
                value={editingPrices
                  ? brlVal + p220Val || null
                  : ((equip.preco_brl ?? 0) + (equip.preco_painel_220 ?? 0)) || null}
              />
              <PriceRow
                label="Total Moinho + Painel 380V"
                bold
                value={editingPrices
                  ? brlVal + p380Val || null
                  : ((equip.preco_brl ?? 0) + (equip.preco_painel_380 ?? 0)) || null}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Imagens ── */}
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
              <button onClick={() => setShowUploadImagem(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Upload size={14} /> Enviar imagem
              </button>
              {showUploadImagem && <UploadForm tipo="imagem" equip={equip} linha={linha} onDone={() => setShowUploadImagem(false)} />}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Desenhos técnicos ── */}
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
              <button onClick={() => setShowUploadDesenho(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Upload size={14} /> Enviar desenho / PDF
              </button>
              {showUploadDesenho && <UploadForm tipo="desenho" equip={equip} linha={linha} onDone={() => setShowUploadDesenho(false)} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

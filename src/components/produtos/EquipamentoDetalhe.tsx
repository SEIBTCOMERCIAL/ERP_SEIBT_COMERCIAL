"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, Upload, Trash2, Plus, Edit2, X, Save } from "lucide-react";
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

type Tab = "specs" | "precos" | "imagens" | "desenhos";

interface SpecRow { id: number; key: string; value: string }

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

function specsToRows(specs: Record<string, unknown> | null): SpecRow[] {
  if (!specs) return [];
  return Object.entries(specs).map(([k, v], i) => ({ id: i, key: k, value: String(v) }));
}

export function EquipamentoDetalhe({ isAdmin, linha, equip, arquivos }: {
  isAdmin: boolean;
  linha: Linha;
  equip: Equip;
  arquivos: Arquivo[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("specs");
  const [isPending, startTransition] = useTransition();
  const [showUploadImagem, setShowUploadImagem] = useState(false);
  const [showUploadDesenho, setShowUploadDesenho] = useState(false);

  // ── Specs state (row-based) ──
  const [specRows, setSpecRows] = useState<SpecRow[]>(() => specsToRows(equip.specs));
  const [nextId, setNextId] = useState(() => specsToRows(equip.specs).length);
  const [hoveredSpec, setHoveredSpec] = useState<number | null>(null);
  const [specsMsg, setSpecsMsg] = useState("");

  // ── Price state ──
  const [editingPrices, setEditingPrices] = useState(false);
  const [draft, setDraft] = useState({
    brl: equip.preco_brl?.toString() ?? "",
    p220: equip.preco_painel_220?.toString() ?? "",
    p380: equip.preco_painel_380?.toString() ?? "",
  });
  const [precoMsg, setPrecoMsg] = useState("");

  const addSpecRow = () => {
    setSpecRows(rows => [...rows, { id: nextId, key: "", value: "" }]);
    setNextId(n => n + 1);
  };

  const updateSpecRow = (id: number, field: "key" | "value", val: string) => {
    setSpecRows(rows => rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const removeSpecRow = (id: number) => {
    setSpecRows(rows => rows.filter(r => r.id !== id));
  };

  const handleSaveSpecs = () => {
    setSpecsMsg("");
    const obj: Record<string, string> = {};
    for (const row of specRows) {
      if (row.key.trim()) obj[row.key.trim()] = row.value;
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
        parseFloat(draft.brl) || null,
        parseFloat(draft.p220) || null,
        parseFloat(draft.p380) || null,
      );
      if (res.error) setPrecoMsg(res.error);
      else { setPrecoMsg("Salvo"); setEditingPrices(false); router.refresh(); }
    });
  };

  const handleExcluirArquivo = (arq: Arquivo) => {
    if (!confirm(`Excluir "${arq.nome}"?`)) return;
    startTransition(async () => {
      const res = await excluirArquivoProduto(arq.id, arq.storage_path, equip.id, linha.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const cancelEdit = () => {
    setDraft({ brl: equip.preco_brl?.toString() ?? "", p220: equip.preco_painel_220?.toString() ?? "", p380: equip.preco_painel_380?.toString() ?? "" });
    setEditingPrices(false);
    setPrecoMsg("");
  };

  const imagens = arquivos.filter(a => a.tipo === "imagem");
  const desenhos = arquivos.filter(a => a.tipo === "desenho");
  const specs = equip.specs ?? {};

  // Live totals in edit mode
  const brlVal = parseFloat(draft.brl) || 0;
  const p220Val = parseFloat(draft.p220) || 0;
  const p380Val = parseFloat(draft.p380) || 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "specs", label: "Especificações" },
    { key: "precos", label: "Preço e painéis" },
    { key: "imagens", label: `Imagens${imagens.length ? ` (${imagens.length})` : ""}` },
    { key: "desenhos", label: `Desenhos técnicos${desenhos.length ? ` (${desenhos.length})` : ""}` },
  ];

  const numInp = (val: string, set: (v: string) => void) => (
    <input type="number" min="0" step="0.01" value={val} onChange={e => set(e.target.value)}
      style={{ width: "100%", height: 34, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
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

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>{equip.codigo}</h1>
          {equip.status === "descontinuado" && (
            <span style={{ padding: "2px 10px", background: "#F1F5F9", color: "#6b7b8d", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>DESCONTINUADO</span>
          )}
        </div>
        <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>{equip.descricao}</p>
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
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          {/* Read-only view sempre visível acima */}
          {Object.keys(specs).length === 0 && !isAdmin ? (
            <div style={{ padding: 32, textAlign: "center", color: "#6b7b8d", fontSize: 13 }}>Nenhuma especificação cadastrada.</div>
          ) : null}

          {/* Admin: editor de linhas */}
          {isAdmin ? (
            <div>
              {specRows.length === 0 && (
                <div style={{ padding: "18px 24px", fontSize: 13, color: "#6b7b8d" }}>Nenhuma especificação. Clique em &quot;Adicionar especificação&quot; para começar.</div>
              )}
              {specRows.map((row, i) => (
                <div
                  key={row.id}
                  onMouseEnter={() => setHoveredSpec(row.id)}
                  onMouseLeave={() => setHoveredSpec(null)}
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", alignItems: "center", gap: 8, padding: "8px 16px", background: i % 2 === 0 ? "#fff" : BG, borderBottom: `1px solid ${BORDER}` }}
                >
                  <input
                    value={row.key}
                    onChange={e => updateSpecRow(row.id, "key", e.target.value)}
                    placeholder="Label (ex: MOTOR (cv))"
                    style={{ height: 32, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "0 8px", fontSize: 12, outline: "none" }}
                  />
                  <input
                    value={row.value}
                    onChange={e => updateSpecRow(row.id, "value", e.target.value)}
                    placeholder="Valor"
                    style={{ height: 32, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "0 8px", fontSize: 12, outline: "none", fontWeight: 700 }}
                  />
                  <button
                    onClick={() => removeSpecRow(row.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: hoveredSpec === row.id ? "#DC2626" : "transparent", display: "flex", alignItems: "center", transition: "color 0.1s" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: BG, borderTop: `1px solid ${BORDER}` }}>
                <button
                  onClick={addSpecRow}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  <Plus size={13} /> Adicionar especificação
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {specsMsg && <span style={{ fontSize: 12, color: specsMsg === "Salvo" ? "#16A34A" : "#DC2626" }}>{specsMsg}</span>}
                  <button
                    onClick={handleSaveSpecs}
                    disabled={isPending}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                  >
                    <Save size={13} /> Salvar especificações
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Vendedor: tabela read-only */
            Object.keys(specs).length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {Object.entries(specs).map(([key, value], i) => (
                    <tr key={key} style={{ background: i % 2 === 0 ? "#fff" : BG }}>
                      <td style={{ padding: "14px 24px", fontSize: 12, fontWeight: 500, color: "#6B7B8D", width: "50%", borderBottom: `1px solid ${BORDER}` }}>{key}</td>
                      <td style={{ padding: "14px 24px", fontSize: 13, fontWeight: 700, color: "#1a1a1a", borderBottom: `1px solid ${BORDER}` }}>{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}

      {/* ── Tab: Preço e painéis ── */}
      {tab === "precos" && (
        <div>
          {/* Header linha ação */}
          {isAdmin && (
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

          {/* Dois cards lado a lado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 680 }}>
            {/* Card 220V */}
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: NAV, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Opção 220V</span>
              </div>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 5 }}>Moinho</div>
                  {editingPrices
                    ? numInp(draft.brl, v => setDraft(d => ({ ...d, brl: v })))
                    : <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{fmt(equip.preco_brl)}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 5 }}>Painel 220V</div>
                  {editingPrices
                    ? numInp(draft.p220, v => setDraft(d => ({ ...d, p220: v })))
                    : <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{fmt(equip.preco_painel_220)}</div>}
                </div>
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 5 }}>Total</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: NAV }}>
                    {editingPrices
                      ? fmt(brlVal + p220Val)
                      : fmt((equip.preco_brl ?? 0) + (equip.preco_painel_220 ?? 0))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 380V */}
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: NAV, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Opção 380V</span>
              </div>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 5 }}>Moinho</div>
                  {/* Moinho é o mesmo valor — display-only no card 380V */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: editingPrices ? "#b0bac9" : "#1a1a1a" }}>
                    {editingPrices ? fmt(brlVal) : fmt(equip.preco_brl)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 5 }}>Painel 380V</div>
                  {editingPrices
                    ? numInp(draft.p380, v => setDraft(d => ({ ...d, p380: v })))
                    : <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{fmt(equip.preco_painel_380)}</div>}
                </div>
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 5 }}>Total</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: NAV }}>
                    {editingPrices
                      ? fmt(brlVal + p380Val)
                      : fmt((equip.preco_brl ?? 0) + (equip.preco_painel_380 ?? 0))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Imagens ── */}
      {tab === "imagens" && (
        <div>
          {imagens.length === 0 && !isAdmin && (
            <div style={{ textAlign: "center", color: "#6b7b8d", fontSize: 13, padding: 40 }}>Nenhuma imagem cadastrada.</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            {imagens.map(arq => (
              <div key={arq.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                <img src={arq.url} alt={arq.nome} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#6b7b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{arq.nome}</span>
                  {isAdmin && (
                    <button onClick={() => handleExcluirArquivo(arq)} disabled={isPending}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {isAdmin && (
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
          {desenhos.length === 0 && !isAdmin && (
            <div style={{ textAlign: "center", color: "#6b7b8d", fontSize: 13, padding: 40 }}>Nenhum desenho técnico cadastrado.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {desenhos.map(arq => (
              <div key={arq.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={18} color={BLUE} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{arq.nome}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a href={arq.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Abrir</a>
                  {isAdmin && (
                    <button onClick={() => handleExcluirArquivo(arq)} disabled={isPending}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {isAdmin && (
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

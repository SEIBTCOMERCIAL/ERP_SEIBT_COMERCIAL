"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, Upload, Trash2, Save } from "lucide-react";
import {
  atualizarPaineis, atualizarSpecs,
  uploadArquivoProduto, excluirArquivoProduto,
  type AdminState,
} from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const SUCCESS = "#16A34A";

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

type Tab = "specs" | "precos" | "imagens" | "desenhos";

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
}

interface Linha { id: string; nome: string }

function SubmitUpload() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{ padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
    >
      <Upload size={14} />{pending ? "Enviando..." : "Enviar"}
    </button>
  );
}

function UploadForm({
  tipo,
  equip,
  linha,
  onDone,
}: {
  tipo: "imagem" | "desenho";
  equip: Equip;
  linha: Linha;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, action] = useFormState<AdminState, FormData>(uploadArquivoProduto, {});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onDone();
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [state.success, router, onDone]);

  return (
    <form action={action} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "12px 14px", background: "#F8FAFC", border: `1px dashed ${BORDER}`, borderRadius: 8 }}>
      <input type="hidden" name="produto_id" value={equip.id} />
      <input type="hidden" name="linha_id" value={linha.id} />
      <input type="hidden" name="tipo" value={tipo} />
      <input
        ref={fileRef}
        name="arquivo"
        type="file"
        accept={tipo === "imagem" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png"}
        required
        style={{ fontSize: 12, flex: 1 }}
      />
      <SubmitUpload />
      {state.error && <span style={{ fontSize: 11, color: "#DC2626" }}>{state.error}</span>}
    </form>
  );
}

export function EquipamentoDetalhe({
  isAdmin,
  linha,
  equip,
  arquivos,
}: {
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

  // Preços e painéis state
  const [precoBrl, setPrecoBrl] = useState(equip.preco_brl?.toString() ?? "");
  const [preco220, setPreco220] = useState(equip.preco_painel_220?.toString() ?? "");
  const [preco380, setPreco380] = useState(equip.preco_painel_380?.toString() ?? "");
  const [precoMsg, setPrecoMsg] = useState("");

  // Specs state
  const [specsJson, setSpecsJson] = useState(
    equip.specs ? JSON.stringify(equip.specs, null, 2) : "{}"
  );
  const [specsMsg, setSpecsMsg] = useState("");

  const handleSavePrecos = () => {
    setPrecoMsg("");
    startTransition(async () => {
      const res = await atualizarPaineis(
        equip.id, linha.id,
        parseFloat(precoBrl) || null,
        parseFloat(preco220) || null,
        parseFloat(preco380) || null,
      );
      if (res.error) setPrecoMsg(res.error);
      else { setPrecoMsg("Preços atualizados"); router.refresh(); }
    });
  };

  const handleSaveSpecs = () => {
    setSpecsMsg("");
    startTransition(async () => {
      const res = await atualizarSpecs(equip.id, linha.id, specsJson);
      if (res.error) setSpecsMsg(res.error);
      else { setSpecsMsg("Especificações atualizadas"); router.refresh(); }
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

  const imagens = arquivos.filter(a => a.tipo === "imagem");
  const desenhos = arquivos.filter(a => a.tipo === "desenho");

  const tabs: { key: Tab; label: string }[] = [
    { key: "specs", label: "Especificações" },
    { key: "precos", label: "Preço e painéis" },
    { key: "imagens", label: `Imagens${imagens.length ? ` (${imagens.length})` : ""}` },
    { key: "desenhos", label: `Desenhos técnicos${desenhos.length ? ` (${desenhos.length})` : ""}` },
  ];

  const specs = equip.specs ?? {};

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 28 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7b8d", marginBottom: 20 }}>
        <span style={{ cursor: "pointer", color: BLUE }} onClick={() => router.push("/produtos")}>Produtos</span>
        <ChevronRight size={14} />
        <span style={{ cursor: "pointer", color: BLUE }} onClick={() => router.push(`/produtos/linhas/${linha.id}`)}>
          {linha.nome}
        </span>
        <ChevronRight size={14} />
        <span style={{ color: NAV, fontWeight: 600 }}>{equip.codigo}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>{equip.codigo}</h1>
        <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>{equip.descricao}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: `2px solid ${BORDER}`, marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 18px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? `2px solid ${NAV}` : "2px solid transparent",
              marginBottom: -2,
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? NAV : "#6b7b8d",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Especificações ── */}
      {tab === "specs" && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          {Object.keys(specs).length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#6b7b8d", fontSize: 13 }}>
              Nenhuma especificação cadastrada.{isAdmin && " Use a edição abaixo para adicionar."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {Object.entries(specs).map(([key, value], i) => (
                  <tr key={key} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                    <td style={{ padding: "14px 24px", fontSize: 12, fontWeight: 500, color: "#6B7B8D", width: "50%", borderBottom: `1px solid ${BORDER}`, letterSpacing: "0.03em" }}>
                      {key}
                    </td>
                    <td style={{ padding: "14px 24px", fontSize: 13, fontWeight: 700, color: "#1a1a1a", borderBottom: `1px solid ${BORDER}` }}>
                      {String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {isAdmin && (
            <div style={{ padding: "16px 18px", borderTop: `1px solid ${BORDER}`, background: "#F8FAFC" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const, display: "block", marginBottom: 6 }}>
                Editar especificações (JSON)
              </label>
              <textarea
                value={specsJson}
                onChange={e => setSpecsJson(e.target.value)}
                rows={8}
                style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <button
                  onClick={handleSaveSpecs}
                  disabled={isPending}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                >
                  <Save size={14} /> Salvar
                </button>
                {specsMsg && <span style={{ fontSize: 12, color: specsMsg.includes("aliz") ? SUCCESS : "#DC2626" }}>{specsMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Preço e painéis ── */}
      {tab === "precos" && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, maxWidth: 480 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Resumo */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", background: BG, borderRadius: 8, border: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#6b7b8d" }}>Moinho</span>
                <span style={{ fontWeight: 600 }}>{fmt(equip.preco_brl)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#6b7b8d" }}>Painel 220V</span>
                <span style={{ fontWeight: 600 }}>{fmt(equip.preco_painel_220)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                <span style={{ color: "#6b7b8d", fontWeight: 700 }}>Total 220V</span>
                <span style={{ fontWeight: 700, color: SUCCESS }}>{fmt((equip.preco_brl ?? 0) + (equip.preco_painel_220 ?? 0))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#6b7b8d" }}>Painel 380V</span>
                <span style={{ fontWeight: 600 }}>{fmt(equip.preco_painel_380)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                <span style={{ color: "#6b7b8d", fontWeight: 700 }}>Total 380V</span>
                <span style={{ fontWeight: 700, color: SUCCESS }}>{fmt((equip.preco_brl ?? 0) + (equip.preco_painel_380 ?? 0))}</span>
              </div>
            </div>

            {/* Edição admin */}
            {isAdmin && (
              <>
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const, marginBottom: 12 }}>
                    Editar preços
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Preço moinho (R$)", val: precoBrl, set: setPrecoBrl },
                      { label: "Painel 220V (R$)", val: preco220, set: setPreco220 },
                      { label: "Painel 380V (R$)", val: preco380, set: setPreco380 },
                    ].map(({ label, val, set }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <label style={{ fontSize: 12, color: "#374151", width: 140, flexShrink: 0 }}>{label}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={val}
                          onChange={e => set(e.target.value)}
                          style={{ flex: 1, height: 34, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "0 10px", fontSize: 13, outline: "none" }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                    <button
                      onClick={handleSavePrecos}
                      disabled={isPending}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                    >
                      <Save size={14} /> Salvar
                    </button>
                    {precoMsg && <span style={{ fontSize: 12, color: precoMsg.includes("aliz") ? SUCCESS : "#DC2626" }}>{precoMsg}</span>}
                  </div>
                </div>
              </>
            )}
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
                    <button
                      onClick={() => handleExcluirArquivo(arq)}
                      disabled={isPending}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowUploadImagem(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                <Upload size={14} /> Enviar imagem
              </button>
              {showUploadImagem && (
                <UploadForm tipo="imagem" equip={equip} linha={linha} onDone={() => setShowUploadImagem(false)} />
              )}
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
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{arq.nome}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a href={arq.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Abrir</a>
                  {isAdmin && (
                    <button
                      onClick={() => handleExcluirArquivo(arq)}
                      disabled={isPending}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowUploadDesenho(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#EFF6FF", color: BLUE, border: `1px solid #BFDBFE`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                <Upload size={14} /> Enviar desenho / PDF
              </button>
              {showUploadDesenho && (
                <UploadForm tipo="desenho" equip={equip} linha={linha} onDone={() => setShowUploadDesenho(false)} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

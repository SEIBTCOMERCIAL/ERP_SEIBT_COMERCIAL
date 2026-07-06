"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Trash2, Edit2, X, Copy, Search, AlertTriangle, ArrowUpDown, Download, Settings2, Eye, EyeOff } from "lucide-react";
import {
  criarEquipamento, editarEquipamento, excluirEquipamento,
  duplicarEquipamento, atualizarStatusEquipamento,
  criarLinhaSpecCampo, excluirLinhaSpecCampo,
  type AdminState,
} from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

type SortKey = "codigo" | "preco" | "data";

interface SpecCampo { id: string; nome: string; ordem: number }

interface Equipamento {
  id: string;
  codigo: string;
  descricao: string;
  descricao_painel: string | null;
  potencia_motor: string | null;
  preco_brl: number | null;
  preco_painel_220: number | null;
  preco_painel_380: number | null;
  ncm: string | null;
  specs: Record<string, unknown> | null;
  ativo: boolean;
  status: "ativo" | "descontinuado";
  atualizado_em: string | null;
  imagens_count: number;
}

interface Linha { id: string; nome: string }

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ padding: "9px 20px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
      {pending ? "Salvando..." : label}
    </button>
  );
}

function SubmitInline({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ padding: "6px 14px", background: NAV, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1, whiteSpace: "nowrap" as const }}>
      {pending ? "..." : label}
    </button>
  );
}

function CurrencyInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: number | null }) {
  const [val, setVal] = useState(() =>
    defaultValue != null ? defaultValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
  );
  const handleBlur = () => {
    if (!val.trim()) return;
    const clean = val.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".").trim();
    const n = parseFloat(clean);
    if (!isNaN(n)) setVal(n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>{label}</label>
      <input name={name} value={val} onChange={e => setVal(e.target.value)} onBlur={handleBlur}
        placeholder="0,00"
        style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
    </div>
  );
}

function EquipamentoModal({ linha, equip, specCampos, onClose }: {
  linha: Linha;
  equip?: Equipamento;
  specCampos: SpecCampo[];
  onClose: () => void;
}) {
  const router = useRouter();
  const action = equip ? editarEquipamento : criarEquipamento;
  const [state, formAction] = useFormState<AdminState, FormData>(action, {});

  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  }, [state.success, router, onClose]);

  const inp = (name: string, label: string, opts: { def?: string; required?: boolean; placeholder?: string } = {}) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>
        {label}{opts.required && <span style={{ color: "#DC2626" }}> *</span>}
      </label>
      <input name={name} type="text" defaultValue={opts.def ?? ""} placeholder={opts.placeholder ?? ""}
        required={opts.required}
        style={{ height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 540, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: NAV, margin: 0 }}>{equip ? "Editar equipamento" : "Novo equipamento"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}><X size={18} /></button>
        </div>

        <form action={formAction} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="linha_id" value={linha.id} />
          {equip && <input type="hidden" name="id" value={equip.id} />}
          {state.error && (
            <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12 }}>{state.error}</div>
          )}

          {/* Código + NCM */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {inp("codigo", "Código", { required: true, def: equip?.codigo, placeholder: "ex: MGHS-500" })}
            {inp("ncm", "NCM", { def: equip?.ncm ?? "", placeholder: "ex: 84779000" })}
          </div>

          {/* Descrição */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>
              Descrição <span style={{ color: "#DC2626" }}>*</span>
              <span style={{ fontWeight: 400, color: "#b0bac9", textTransform: "none" as const }}> — texto usado no orçamento</span>
            </label>
            <textarea name="descricao" required rows={3} defaultValue={equip?.descricao ?? ""}
              placeholder="Cole aqui a descrição completa do moinho que vai para a proposta..."
              style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, outline: "none", resize: "vertical" }} />
          </div>

          {/* Potência do motor */}
          {inp("potencia_motor", "Potência do motor", { def: equip?.potencia_motor ?? "", placeholder: "ex: 15 cv" })}

          {/* Preços */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <CurrencyInput name="preco_brl" label="Preço moinho (R$)" defaultValue={equip?.preco_brl} />
            <CurrencyInput name="preco_painel_220" label="Painel 220V (R$)" defaultValue={equip?.preco_painel_220} />
          </div>
          <div style={{ maxWidth: 246 }}>
            <CurrencyInput name="preco_painel_380" label="Painel 380V (R$)" defaultValue={equip?.preco_painel_380} />
          </div>

          {/* Descrição do painel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>
              Descrição do painel
              <span style={{ fontWeight: 400, color: "#b0bac9", textTransform: "none" as const }}> — usada para 220V e 380V</span>
            </label>
            <textarea name="descricao_painel" rows={2}
              defaultValue={equip?.descricao_painel ?? ""}
              placeholder="Descrição do painel elétrico que vai para o orçamento..."
              style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, outline: "none", resize: "vertical" }} />
          </div>

          {/* Especificações técnicas */}
          {specCampos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>
                Especificações técnicas
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
                {specCampos.map(campo => (
                  <div key={campo.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 11, color: "#6B7B8D" }}>{campo.nome}</label>
                    <input
                      name={`spec__${campo.nome}`}
                      type="text"
                      defaultValue={(equip?.specs?.[campo.nome] as string) ?? ""}
                      style={{ height: 32, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "0 8px", fontSize: 12, outline: "none" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
            <button type="button" onClick={onClose}
              style={{ padding: "9px 18px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              Cancelar
            </button>
            <SubmitBtn label={equip ? "Salvar" : "Criar"} />
          </div>
        </form>
      </div>
    </div>
  );
}

function IncompletoBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", background: "#FEF3C7", color: "#D97706", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>
      <AlertTriangle size={10} /> Incompleto
    </span>
  );
}

export function LinhaEquipamentosView({ isAdmin, linha, equipamentos, specCampos }: {
  isAdmin: boolean;
  linha: Linha;
  equipamentos: Equipamento[];
  specCampos: SpecCampo[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<"criar" | { equip: Equipamento } | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("codigo");
  const [sortAsc, setSortAsc] = useState(true);
  const [showDesc, setShowDesc] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [previewAsUser, setPreviewAsUser] = useState(false);

  const effectiveAdmin = isAdmin && !previewAsUser;

  const [campoState, campoAction] = useFormState(criarLinhaSpecCampo, {});
  const campoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (campoState.success) { router.refresh(); if (campoInputRef.current) campoInputRef.current.value = ""; }
  }, [campoState.success, router]);

  const handleExcluir = (id: string, codigo: string) => {
    if (!confirm(`Excluir "${codigo}"?`)) return;
    startTransition(async () => {
      const res = await excluirEquipamento(id, linha.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const handleDuplicar = (id: string) => {
    startTransition(async () => {
      const res = await duplicarEquipamento(id, linha.id);
      if (res.error) alert(res.error);
      else if (res.novoId) router.push(`/produtos/linhas/${linha.id}/${res.novoId}`);
    });
  };

  const handleToggleStatus = (eq: Equipamento) => {
    const novoStatus = eq.status === "ativo" ? "descontinuado" : "ativo";
    if (!confirm(novoStatus === "descontinuado"
      ? `Descontinuar "${eq.codigo}"? Não aparecerá em novas propostas.`
      : `Reativar "${eq.codigo}"?`)) return;
    startTransition(async () => {
      const res = await atualizarStatusEquipamento(eq.id, linha.id, novoStatus);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const handleExcluirCampo = (id: string) => {
    if (!confirm("Excluir este campo do template? Os dados já salvos nos equipamentos não serão apagados.")) return;
    startTransition(async () => {
      const res = await excluirLinhaSpecCampo(id, linha.id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  };

  const equipFiltrados = equipamentos
    .filter(eq => showDesc || eq.status === "ativo")
    .filter(eq =>
      eq.codigo.toLowerCase().includes(search.toLowerCase()) ||
      eq.descricao.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sort === "codigo") cmp = a.codigo.localeCompare(b.codigo);
      else if (sort === "preco") cmp = (a.preco_brl ?? 0) - (b.preco_brl ?? 0);
      else cmp = (a.atualizado_em ?? "").localeCompare(b.atualizado_em ?? "");
      return sortAsc ? cmp : -cmp;
    });

  const descCount = equipamentos.filter(e => e.status === "descontinuado").length;

  const sortBtn = (key: SortKey, label: string) => (
    <button onClick={() => { if (sort === key) setSortAsc(v => !v); else { setSort(key); setSortAsc(true); } }}
      style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, background: sort === key ? NAV : "#fff", color: sort === key ? "#fff" : "#374151", border: `1px solid ${sort === key ? NAV : BORDER}`, borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
      {label} {sort === key && <ArrowUpDown size={10} />}
    </button>
  );

  return (
    <div style={{ background: BG, minHeight: "100vh", padding: 28 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7b8d", marginBottom: 20 }}>
        <span style={{ cursor: "pointer", color: BLUE }} onClick={() => router.push("/produtos")}>Produtos</span>
        <ChevronRight size={14} />
        <span style={{ color: NAV, fontWeight: 600 }}>{linha.nome}</span>
      </div>

      {/* Preview banner */}
      {previewAsUser && (
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#92400E", display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={14} />
          Modo visualização — você está vendo como um vendedor. Edições desativadas.
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>{linha.nome}</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>
            {equipamentos.filter(e => e.status === "ativo").length} ativos
            {descCount > 0 && ` · ${descCount} descontinuado${descCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isAdmin && (
            <button onClick={() => setPreviewAsUser(v => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: previewAsUser ? "#FEF3C7" : "#fff", color: previewAsUser ? "#92400E" : "#374151", border: `1px solid ${previewAsUser ? "#FCD34D" : BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {previewAsUser ? <EyeOff size={15} /> : <Eye size={15} />}
              {previewAsUser ? "Sair do modo usuário" : "Ver como usuário"}
            </button>
          )}
          <a href={`/api/produtos/linhas/${linha.id}/exportar`} target="_blank"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#fff", color: NAV, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            <Download size={15} /> Exportar .docx
          </a>
          {effectiveAdmin && (
            <button onClick={() => setModal("criar")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={15} /> Novo equipamento
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} color="#b0bac9" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código ou nome..."
            style={{ height: 34, width: 240, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px 0 32px", fontSize: 12, outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {sortBtn("codigo", "Código")}
          {sortBtn("preco", "Preço")}
          {sortBtn("data", "Data")}
        </div>
        {descCount > 0 && (
          <button onClick={() => setShowDesc(v => !v)}
            style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, background: showDesc ? "#FEF3C7" : "#fff", color: showDesc ? "#D97706" : "#374151", border: `1px solid ${showDesc ? "#FCD34D" : BORDER}`, borderRadius: 5, cursor: "pointer" }}>
            {showDesc ? "Ocultar descontinuados" : `Ver descontinuados (${descCount})`}
          </button>
        )}
      </div>

      {equipFiltrados.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: "#6b7b8d" }}>
          {search ? "Nenhum equipamento encontrado." : "Nenhum equipamento cadastrado nesta linha."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
        {equipFiltrados.map(eq => {
          const moinho = eq.preco_brl;
          const p220 = eq.preco_painel_220;
          const p380 = eq.preco_painel_380;
          const total220 = (moinho ?? 0) + (p220 ?? 0);
          const total380 = (moinho ?? 0) + (p380 ?? 0);
          const descontinuado = eq.status === "descontinuado";
          const incompleto = !eq.preco_painel_380 || !eq.specs || Object.keys(eq.specs).length === 0 || eq.imagens_count === 0;

          return (
            <div key={eq.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", opacity: descontinuado ? 0.65 : 1 }}>
              {/* Card header */}
              <div style={{ padding: "14px 18px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                onClick={() => router.push(`/produtos/linhas/${linha.id}/${eq.id}`)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: NAV }}>{eq.codigo}</span>
                      {descontinuado && <span style={{ padding: "1px 6px", background: "#F1F5F9", color: "#6b7b8d", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>DESCONTINUADO</span>}
                      {!descontinuado && incompleto && effectiveAdmin && <IncompletoBadge />}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7b8d", lineHeight: 1.3 }}>
                      {eq.potencia_motor || <span style={{ color: "#b0bac9" }}>Potência não cadastrada</span>}
                    </div>
                  </div>
                  <ChevronRight size={15} color="#b0bac9" style={{ flexShrink: 0, marginLeft: 8 }} />
                </div>
              </div>

              {/* Price breakdown */}
              <div style={{ padding: "10px 18px", borderBottom: `1px solid ${BORDER}` }}>
                {moinho == null && p220 == null && p380 == null ? (
                  <div style={{ fontSize: 12, color: "#b0bac9" }}>Preços não cadastrados</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {moinho != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#b0bac9" }}>Moinho</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{fmt(moinho)}</span>
                      </div>
                    )}
                    {p220 != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#b0bac9" }}>Painel 220V</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{fmt(p220)}</span>
                      </div>
                    )}
                    {p380 != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#b0bac9" }}>Painel 380V</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{fmt(p380)}</span>
                      </div>
                    )}
                    {(p220 != null || p380 != null) && (
                      <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 4, paddingTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                        {p220 != null && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7b8d" }}>TOTAL 220V</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: NAV }}>{fmt(total220)}</span>
                          </div>
                        )}
                        {p380 != null && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7b8d" }}>TOTAL 380V</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: NAV }}>{fmt(total380)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {effectiveAdmin && (
                <div style={{ padding: "8px 12px", display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => setModal({ equip: eq })} style={{ background: "none", border: "none", cursor: "pointer", color: BLUE, display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600 }}>
                    <Edit2 size={12} /> Editar
                  </button>
                  <button onClick={() => handleDuplicar(eq.id)} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7b8d", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, opacity: isPending ? 0.5 : 1 }}>
                    <Copy size={12} /> Duplicar
                  </button>
                  <button onClick={() => handleToggleStatus(eq)} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: descontinuado ? "#16A34A" : "#D97706", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, opacity: isPending ? 0.5 : 1 }}>
                    {descontinuado ? "Reativar" : "Descontinuar"}
                  </button>
                  <button onClick={() => handleExcluir(eq.id, eq.codigo)} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, opacity: isPending ? 0.5 : 1 }}>
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Template de especificações (admin only — never in preview mode) */}
      {isAdmin && (
        <div style={{ marginTop: 48 }}>
          <button
            onClick={() => setShowTemplate(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", marginBottom: 16 }}>
            <Settings2 size={14} /> Template de especificações
            <span style={{ fontSize: 11, color: "#b0bac9", fontWeight: 400 }}>({specCampos.length} campos)</span>
          </button>

          {showTemplate && (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", maxWidth: 480 }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: NAV }}>Campos de especificação — {linha.nome}</div>
                <div style={{ fontSize: 11, color: "#6b7b8d", marginTop: 2 }}>Estes campos aparecem no formulário de cadastro de equipamento.</div>
              </div>

              {specCampos.length === 0 ? (
                <div style={{ padding: "18px 18px", fontSize: 13, color: "#6b7b8d" }}>Nenhum campo configurado.</div>
              ) : (
                specCampos.map((campo, i) => (
                  <div key={campo.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: i < specCampos.length - 1 ? `1px solid ${BORDER}` : "none", background: i % 2 === 0 ? "#fff" : BG }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{campo.nome}</span>
                    <button onClick={() => handleExcluirCampo(campo.id)} disabled={isPending}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", opacity: isPending ? 0.5 : 1 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}

              <div style={{ padding: "12px 18px", borderTop: `1px solid ${BORDER}`, background: BG }}>
                <form action={campoAction} style={{ display: "flex", gap: 8 }}>
                  <input type="hidden" name="linha_id" value={linha.id} />
                  <input
                    ref={campoInputRef}
                    name="nome"
                    placeholder="Nome do novo campo (ex: Motor (cv))"
                    style={{ flex: 1, height: 34, border: `1px solid ${campoState.error ? "#DC2626" : BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }}
                  />
                  <SubmitInline label="+ Campo" />
                </form>
                {campoState.error && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{campoState.error}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <EquipamentoModal
          linha={linha}
          equip={modal === "criar" ? undefined : modal.equip}
          specCampos={specCampos}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Trash2, Edit2, X, Copy, Search, AlertTriangle, ArrowUpDown, Download } from "lucide-react";
import {
  criarEquipamento, editarEquipamento, excluirEquipamento,
  duplicarEquipamento, atualizarStatusEquipamento,
  type AdminState,
} from "@/app/actions/produtos-admin";

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

type SortKey = "codigo" | "preco" | "data";

interface Equipamento {
  id: string;
  codigo: string;
  descricao: string;
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
    <button type="submit" disabled={pending} style={{ padding: "9px 20px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
      {pending ? "Salvando..." : label}
    </button>
  );
}

function EquipamentoModal({ linha, equip, onClose }: { linha: Linha; equip?: Equipamento; onClose: () => void }) {
  const router = useRouter();
  const action = equip ? editarEquipamento : criarEquipamento;
  const [state, formAction] = useFormState<AdminState, FormData>(action, {});

  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  }, [state.success, router, onClose]);

  const specsStr = equip?.specs ? JSON.stringify(equip.specs, null, 2) : "{}";

  const inp = (name: string, label: string, opts: { type?: string; def?: string; placeholder?: string; required?: boolean } = {}) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>
        {label}{opts.required && <span style={{ color: "#DC2626" }}> *</span>}
      </label>
      <input name={name} type={opts.type ?? "text"} defaultValue={opts.def ?? ""} placeholder={opts.placeholder ?? ""}
        required={opts.required}
        style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none" }} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 560, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: NAV, margin: 0 }}>{equip ? "Editar equipamento" : "Novo equipamento"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7B8D" }}><X size={18} /></button>
        </div>
        <form action={formAction} style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="linha_id" value={linha.id} />
          {equip && <input type="hidden" name="id" value={equip.id} />}
          {state.error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12 }}>{state.error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {inp("codigo", "Código", { required: true, def: equip?.codigo, placeholder: "ex: MGHS-1500" })}
            {inp("ncm", "NCM", { def: equip?.ncm ?? "", placeholder: "ex: 84779000" })}
          </div>
          {inp("descricao", "Descrição", { required: true, def: equip?.descricao, placeholder: "ex: Moinho de Facas MGHS 1500" })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {inp("preco_brl", "Preço moinho (R$)", { type: "number", def: equip?.preco_brl?.toString() ?? "", placeholder: "0.00" })}
            {inp("preco_painel_220", "Painel 220V (R$)", { type: "number", def: equip?.preco_painel_220?.toString() ?? "", placeholder: "0.00" })}
            {inp("preco_painel_380", "Painel 380V (R$)", { type: "number", def: equip?.preco_painel_380?.toString() ?? "", placeholder: "0.00" })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7B8D", textTransform: "uppercase" as const }}>Especificações (JSON)</label>
            <textarea name="specs" rows={4} defaultValue={specsStr} placeholder='{"MOTOR (cv)": "50"}' style={{ border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 18px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancelar</button>
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

export function LinhaEquipamentosView({ isAdmin, linha, equipamentos }: {
  isAdmin: boolean;
  linha: Linha;
  equipamentos: Equipamento[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<"criar" | { equip: Equipamento } | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("codigo");
  const [sortAsc, setSortAsc] = useState(true);
  const [showDesc, setShowDesc] = useState(false);

  const handleExcluir = (id: string, codigo: string) => {
    if (!confirm(`Excluir o equipamento "${codigo}"?`)) return;
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
    const msg = novoStatus === "descontinuado"
      ? `Descontinuar "${eq.codigo}"? Ele não aparecerá mais em novas propostas.`
      : `Reativar "${eq.codigo}"?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await atualizarStatusEquipamento(eq.id, linha.id, novoStatus);
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
      else if (sort === "data") cmp = (a.atualizado_em ?? "").localeCompare(b.atualizado_em ?? "");
      return sortAsc ? cmp : -cmp;
    });

  const descontinuadosCount = equipamentos.filter(e => e.status === "descontinuado").length;

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(v => !v);
    else { setSort(key); setSortAsc(true); }
  };

  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => toggleSort(key)}
      style={{
        padding: "5px 10px", fontSize: 11, fontWeight: 600,
        background: sort === key ? NAV : "#fff",
        color: sort === key ? "#fff" : "#374151",
        border: `1px solid ${sort === key ? NAV : BORDER}`,
        borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
      }}
    >
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

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>{linha.nome}</h1>
          <p style={{ fontSize: 14, color: "#6b7b8d", marginTop: 4 }}>
            {equipamentos.filter(e => e.status === "ativo").length} equipamento{equipamentos.length !== 1 ? "s" : ""} ativos
            {descontinuadosCount > 0 && ` · ${descontinuadosCount} descontinuado${descontinuadosCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href={`/api/produtos/linhas/${linha.id}/exportar`}
            target="_blank"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#fff", color: NAV, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            <Download size={15} /> Exportar .docx
          </a>
          {isAdmin && (
            <button
              onClick={() => setModal("criar")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              <Plus size={15} /> Novo equipamento
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} color="#b0bac9" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código ou nome..."
            style={{ height: 34, width: 240, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px 0 32px", fontSize: 12, outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {sortBtn("codigo", "Código")}
          {sortBtn("preco", "Preço")}
          {sortBtn("data", "Data")}
        </div>
        {descontinuadosCount > 0 && (
          <button
            onClick={() => setShowDesc(v => !v)}
            style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, background: showDesc ? "#FEF3C7" : "#fff", color: showDesc ? "#D97706" : "#374151", border: `1px solid ${showDesc ? "#FCD34D" : BORDER}`, borderRadius: 5, cursor: "pointer" }}
          >
            {showDesc ? "Ocultar descontinuados" : `Ver descontinuados (${descontinuadosCount})`}
          </button>
        )}
      </div>

      {equipFiltrados.length === 0 && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: "#6b7b8d" }}>
          {search ? "Nenhum equipamento encontrado." : "Nenhum equipamento cadastrado nesta linha."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {equipFiltrados.map(eq => {
          const total220 = (eq.preco_brl ?? 0) + (eq.preco_painel_220 ?? 0);
          const total380 = (eq.preco_brl ?? 0) + (eq.preco_painel_380 ?? 0);
          const descontinuado = eq.status === "descontinuado";
          const incompleto = !eq.preco_painel_380 || !eq.specs || Object.keys(eq.specs).length === 0 || eq.imagens_count === 0;

          return (
            <div
              key={eq.id}
              style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", opacity: descontinuado ? 0.65 : 1 }}
            >
              {/* Header */}
              <div style={{ padding: "14px 18px", cursor: "pointer", borderBottom: `1px solid ${BORDER}` }}
                onClick={() => router.push(`/produtos/linhas/${linha.id}/${eq.id}`)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: NAV }}>{eq.codigo}</span>
                      {descontinuado && (
                        <span style={{ padding: "1px 6px", background: "#F1F5F9", color: "#6b7b8d", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>DESCONTINUADO</span>
                      )}
                      {!descontinuado && incompleto && isAdmin && <IncompletoBadge />}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7b8d", lineHeight: 1.3 }}>{eq.descricao}</div>
                  </div>
                  <ChevronRight size={15} color="#b0bac9" style={{ flexShrink: 0, marginLeft: 8 }} />
                </div>
              </div>

              {/* Preços resumidos */}
              <div style={{ padding: "10px 18px", display: "flex", gap: 12, borderBottom: `1px solid ${BORDER}` }}>
                {eq.preco_painel_220 != null ? (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#b0bac9", fontWeight: 600, marginBottom: 2 }}>TOTAL 220V</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAV }}>{fmt(total220)}</div>
                  </div>
                ) : null}
                {eq.preco_painel_380 != null ? (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#b0bac9", fontWeight: 600, marginBottom: 2 }}>TOTAL 380V</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAV }}>{fmt(total380)}</div>
                  </div>
                ) : null}
                {eq.preco_painel_220 == null && eq.preco_painel_380 == null && (
                  <div style={{ fontSize: 12, color: "#b0bac9" }}>Preços não cadastrados</div>
                )}
              </div>

              {/* Ações admin */}
              {isAdmin && (
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

      {modal && (
        <EquipamentoModal
          linha={linha}
          equip={modal === "criar" ? undefined : modal.equip}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

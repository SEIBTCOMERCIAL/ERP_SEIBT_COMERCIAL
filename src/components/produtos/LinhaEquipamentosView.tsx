"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Plus, Trash2, Edit2, X, Copy, Search, AlertTriangle, ArrowUpDown, Download, Settings2, Eye, EyeOff,
  MoreVertical, PauseCircle, PlayCircle, CalendarDays, Cog, ImageOff, Camera,
} from "lucide-react";
import { FotoEditorModal } from "@/components/catalogo/FotoEditorModal";
import {
  criarEquipamento, editarEquipamento, excluirEquipamento,
  duplicarEquipamento, atualizarStatusEquipamento,
  criarLinhaSpecCampo, excluirLinhaSpecCampo,
  type AdminState,
} from "@/app/actions/produtos-admin";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
  foto: string | null;
  imagens: { id: string; url: string; nome: string }[];
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

// Mesmas condições que já definiam "Incompleto" — agora listadas, pra dizer o que falta.
function listarPendencias(eq: Equipamento): string[] {
  const pendencias: string[] = [];
  if (!eq.preco_painel_380) pendencias.push("preço do painel 380V");
  if (!eq.specs || Object.keys(eq.specs).length === 0) pendencias.push("especificações técnicas");
  if (eq.imagens_count === 0) pendencias.push("imagem");
  return pendencias;
}

// Só na exibição do título: "MGHS 1300 A2 200 CV" → "MGHS 1300 A2 / 200 CV". O código salvo não muda.
function tituloComSeparador(codigo: string): string {
  return codigo.replace(/(?<!\/)\s+(\d+(?:[.,]\d+)?\s*CV\b)/i, " / $1");
}

function juntarLista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function StatusPill({ descontinuado }: { descontinuado: boolean }) {
  return descontinuado ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden /> Descontinuado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden /> Ativo
    </span>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-500">{children}</p>;
}

function EquipamentoCard({
  eq, href, effectiveAdmin, isPending, onEditar, onEditarFoto, onDuplicar, onToggleStatus, onExcluir,
}: {
  eq: Equipamento;
  href: string;
  effectiveAdmin: boolean;
  isPending: boolean;
  onEditar: () => void;
  onEditarFoto: () => void;
  onDuplicar: () => void;
  onToggleStatus: () => void;
  onExcluir: () => void;
}) {
  const moinho = eq.preco_brl;
  const p220 = eq.preco_painel_220;
  const p380 = eq.preco_painel_380;
  const total220 = (moinho ?? 0) + (p220 ?? 0);
  const total380 = (moinho ?? 0) + (p380 ?? 0);
  const descontinuado = eq.status === "descontinuado";
  const pendencias = listarPendencias(eq);
  const incompleto = pendencias.length > 0;
  const semPrecos = moinho == null && p220 == null && p380 == null;
  const temPainel = p220 != null || p380 != null;

  return (
    <article className={cn(
      "flex min-w-0 flex-col rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md",
      descontinuado && "opacity-[0.65]"
    )}>
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {effectiveAdmin ? (
          <button
            type="button"
            onClick={onEditarFoto}
            title="Trocar foto (é a mesma foto usada no Catálogo)"
            aria-label={`Trocar foto — ${eq.codigo}`}
            className="group/foto relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seibt-blue/40"
          >
            {eq.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={eq.foto} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <Camera className="h-5 w-5 text-slate-300" aria-hidden />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 opacity-0 transition-opacity group-hover/foto:opacity-100 group-focus-visible/foto:opacity-100" aria-hidden>
              <Camera className="h-4 w-4 text-white" />
            </span>
          </button>
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-50">
            {eq.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={eq.foto} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <ImageOff className="h-5 w-5 text-slate-300" aria-hidden />
            )}
          </div>
        )}

        <Link
          href={href}
          className="group min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-seibt-blue/40"
        >
          <div className="min-w-0">
            <h3 className="break-words text-[15px] font-bold leading-snug text-seibt-navy transition-colors group-hover:text-seibt-blue">
              {tituloComSeparador(eq.codigo)}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {eq.potencia_motor
                ? <span className="text-[12.5px] text-slate-600">{eq.potencia_motor}</span>
                : <span className="text-[12.5px] text-slate-400">Potência não cadastrada</span>}
              <StatusPill descontinuado={descontinuado} />
            </div>
          </div>
        </Link>

        {effectiveAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Mais ações — ${eq.codigo}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-seibt-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seibt-blue/40 data-[state=open]:bg-slate-100"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {/* setTimeout: deixa o menu fechar antes da janela de confirmação abrir */}
              {descontinuado ? (
                <DropdownMenuItem disabled={isPending} onSelect={() => setTimeout(onToggleStatus, 0)} className="cursor-pointer">
                  <PlayCircle className="text-green-600" /> Reativar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled={isPending} onSelect={() => setTimeout(onToggleStatus, 0)} className="cursor-pointer">
                  <PauseCircle className="text-amber-600" /> Descontinuar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isPending}
                onSelect={() => setTimeout(onExcluir, 0)}
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
              >
                <Trash2 /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {/* Alerta de cadastro incompleto — mesma regra de antes (só admin, só ativo) */}
        {!descontinuado && incompleto && effectiveAdmin && (
          <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <div className="min-w-0 text-[12px] leading-snug">
              <p className="font-semibold text-amber-800">Cadastro incompleto</p>
              <p className="text-amber-700">Falta: {juntarLista(pendencias)}.</p>
            </div>
          </div>
        )}

        {semPrecos ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-400">Preços não cadastrados</p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 rounded-lg bg-slate-50 p-2.5">
              {moinho != null && (
                <div>
                  <SecaoTitulo>Composição do equipamento</SecaoTitulo>
                  <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-slate-700">
                      <Cog className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /> Moinho
                    </span>
                    <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-800">{fmt(moinho)}</span>
                  </div>
                </div>
              )}

              {temPainel && (
                <div>
                  <SecaoTitulo>Opções de painel</SecaoTitulo>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-md bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    {p220 != null && (
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-[13px] text-slate-700">
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300" aria-hidden /> Painel 220V
                        </span>
                        <span className="whitespace-nowrap text-[13px] font-medium tabular-nums text-slate-700">{fmt(p220)}</span>
                      </div>
                    )}
                    {p380 != null && (
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-[13px] text-slate-700">
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300" aria-hidden /> Painel 380V
                        </span>
                        <span className="whitespace-nowrap text-[13px] font-medium tabular-nums text-slate-700">{fmt(p380)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {temPainel && (
              <div>
                <SecaoTitulo>Totais</SecaoTitulo>
                <div className="flex flex-col gap-1.5">
                  {p220 != null && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-seibt-blue/20 bg-seibt-blue-light px-3 py-2">
                      <span className="shrink-0 rounded-full bg-seibt-blue px-2 py-0.5 text-[11px] font-bold text-white">220V</span>
                      <span className="min-w-0 flex-1 text-[12px] leading-tight text-slate-600">Total com painel 220V</span>
                      <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-seibt-navy">{fmt(total220)}</span>
                    </div>
                  )}
                  {p380 != null && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="shrink-0 rounded-full bg-slate-600 px-2 py-0.5 text-[11px] font-bold text-white">380V</span>
                      <span className="min-w-0 flex-1 text-[12px] leading-tight text-slate-600">Total com painel 380V</span>
                      <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-seibt-navy">{fmt(total380)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {effectiveAdmin && (
        <div className="mt-auto border-t border-border px-4 py-3">
          {eq.atualizado_em && (
            <p className="mb-2.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Última alteração: {new Date(eq.atualizado_em).toLocaleDateString("pt-BR")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-seibt-blue/50 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-seibt-blue transition-colors hover:bg-seibt-blue-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seibt-blue/40"
            >
              <Edit2 className="h-3.5 w-3.5" aria-hidden /> Editar
            </button>
            <button
              type="button"
              onClick={onDuplicar}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seibt-blue/40 disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden /> Duplicar
            </button>
          </div>
        </div>
      )}
    </article>
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
  const [fotoEditando, setFotoEditando] = useState<Equipamento | null>(null);
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(290px, 100%), 1fr))", gap: 16 }}>
        {equipFiltrados.map(eq => (
          <EquipamentoCard
            key={eq.id}
            eq={eq}
            href={`/produtos/linhas/${linha.id}/${eq.id}`}
            effectiveAdmin={effectiveAdmin}
            isPending={isPending}
            onEditar={() => setModal({ equip: eq })}
            onEditarFoto={() => setFotoEditando(eq)}
            onDuplicar={() => handleDuplicar(eq.id)}
            onToggleStatus={() => handleToggleStatus(eq)}
            onExcluir={() => handleExcluir(eq.id, eq.codigo)}
          />
        ))}
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

      {fotoEditando && (
        <FotoEditorModal
          maquina={{
            id: fotoEditando.id,
            codigo: fotoEditando.codigo,
            fotoUrl: fotoEditando.foto,
            imagensDisponiveis: fotoEditando.imagens,
          }}
          linhaId={linha.id}
          onClose={() => setFotoEditando(null)}
        />
      )}
    </div>
  );
}

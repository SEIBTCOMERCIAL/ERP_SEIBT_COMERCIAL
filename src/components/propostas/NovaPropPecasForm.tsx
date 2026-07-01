"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import { Search, X, Plus, Minus, Upload, Check, ChevronRight, Building2, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { criarPropostaPecas, type CartItemInput } from "@/app/actions/propostas-pecas";
import type { MaquinaCliente, ProdutoComDetalhes, Categoriaproduto } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

type Step = 1 | 2 | 3 | 4;

interface ClienteSimples {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cidade: string | null;
  estado: string | null;
}

interface Props {
  clientes: ClienteSimples[];
  produtos: ProdutoComDetalhes[];
  taxaDolar: number;
}

const PART_CATS: { label: string; value: Categoriaproduto | "todos" }[] = [
  { label: "Todos",      value: "todos"     },
  { label: "Navalhas",   value: "navalha"   },
  { label: "Peneiras",   value: "peneira"   },
  { label: "Rolamentos", value: "rolamento" },
  { label: "Parafusos",  value: "parafuso"  },
  { label: "Rotores",    value: "rotor"     },
  { label: "Outros",     value: "outro"     },
];

const STEP_LABELS = ["Cliente", "Máquina", "Peças", "Revisão"];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StepperBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-3">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
              done ? "bg-[#16A34A] text-white" : active ? "bg-[#2C4F79] text-white" : "border-2 border-[#E2E8F0] text-[#B0BAC9]"
            )}>
              {done ? <Check className="h-3 w-3" /> : n}
            </div>
            <span className={cn("text-[12px] font-semibold", active ? "text-[#1A1A1A]" : done ? "text-[#16A34A]" : "text-[#B0BAC9]")}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn("w-8 h-0.5 ml-1", done ? "bg-[#16A34A]" : "bg-[#E2E8F0]")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NovaPropPecasForm({ clientes, produtos, taxaDolar }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [moeda, setMoeda] = useState<"BRL" | "USD">("BRL");
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSel, setClienteSel] = useState<ClienteSimples | null>(null);
  const [maquinas, setMaquinas] = useState<MaquinaCliente[]>([]);
  const [maquinaSel, setMaquinaSel] = useState<MaquinaCliente | null>(null);
  const [showNovaMaquina, setShowNovaMaquina] = useState(false);
  const [novoModelo, setNovoModelo] = useState("");
  const [novoNumSerie, setNovoNumSerie] = useState("");
  const [novoAno, setNovoAno] = useState("");
  const [plaquetaFile, setPlaquetaFile] = useState<File | null>(null);
  const [catTab, setCatTab] = useState<Categoriaproduto | "todos">("todos");
  const [partSearch, setPartSearch] = useState("");
  const [cart, setCart] = useState<CartItemInput[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [condicao, setCondicao] = useState("30/60/90 dias");
  const [prazo, setPrazo] = useState("A combinar");
  const [validade, setValidade] = useState("30 dias");
  const [observacoes, setObservacoes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch.trim()) return clientes.slice(0, 8);
    const q = clienteSearch.toLowerCase();
    return clientes.filter((c) =>
      (c.razao_social?.toLowerCase().includes(q) || c.nome_fantasia?.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [clientes, clienteSearch]);

  async function selectCliente(c: ClienteSimples) {
    setClienteSel(c);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("maquinas_cliente").select("*").eq("cliente_id", c.id).order("registrado_em", { ascending: false });
    setMaquinas(data ?? []);
    setStep(2);
  }

  function produtosFiltrados() {
    let list = maquinaSel
      ? produtos.filter((p) => p.modelos_compat.some((m) => maquinaSel.modelo && m.includes(maquinaSel.modelo.split(" ")[0])))
      : produtos;
    if (catTab !== "todos") list = list.filter((p) => p.categoria === catTab);
    if (partSearch.trim()) {
      const q = partSearch.toLowerCase();
      list = list.filter((p) => p.codigo.toLowerCase().includes(q) || p.descricao.toLowerCase().includes(q));
    }
    return list;
  }

  function getQty(prodId: string) { return qtys[prodId] ?? 1; }

  function addToCart(produto: ProdutoComDetalhes) {
    const qty = getQty(produto.id);
    const preco = moeda === "BRL" ? (produto.preco_brl ?? 0) : (produto.preco_usd ?? (produto.preco_brl ?? 0) / taxaDolar);
    setCart((prev) => {
      const existing = prev.find((i) => i.produto_id === produto.id);
      if (existing) {
        return prev.map((i) => i.produto_id === produto.id ? { ...i, quantidade: qty } : i);
      }
      return [...prev, {
        produto_id:    produto.id,
        variante_id:   null,
        codigo:        produto.codigo,
        descricao:     produto.descricao,
        preco_unitario: preco,
        ipi_pct:       produto.ipi_pct,
        quantidade:    qty,
      }];
    });
  }

  function removeFromCart(prodId: string) {
    setCart((prev) => prev.filter((i) => i.produto_id !== prodId));
  }

  function updateCartQty(prodId: string, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.produto_id !== prodId) return i;
      const newQty = Math.max(1, i.quantidade + delta);
      return { ...i, quantidade: newQty };
    }));
  }

  const subtotal = cart.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
  const ipiTotal = cart.reduce((s, i) => s + i.preco_unitario * i.quantidade * (i.ipi_pct / 100), 0);
  const total = subtotal + ipiTotal;

  async function registrarNovaMaquina() {
    if (!clienteSel || !novoModelo) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await (supabase as any).auth.getUser();
    if (!user) return;

    let plaquetaUrl: string | null = null;
    if (plaquetaFile) {
      const path = `${clienteSel.id}/${Date.now()}.${plaquetaFile.name.split(".").pop()}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buf = await plaquetaFile.arrayBuffer();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upErr } = await (supabase as any).storage.from("plaquetas").upload(path, buf, { contentType: plaquetaFile.type });
      if (!upErr) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: urlData } = (supabase as any).storage.from("plaquetas").getPublicUrl(path);
        plaquetaUrl = urlData?.publicUrl ?? null;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: maq } = await (supabase as any)
      .from("maquinas_cliente")
      .insert({
        cliente_id:      clienteSel.id,
        modelo:          novoModelo,
        numero_serie:    novoNumSerie || null,
        ano_fabricacao:  novoAno ? parseInt(novoAno) : null,
        plaqueta_foto_url: plaquetaUrl,
        registrado_por:  user.id,
      })
      .select()
      .single();

    if (maq) {
      setMaquinas((prev) => [maq, ...prev]);
      setMaquinaSel(maq);
      setShowNovaMaquina(false);
      setNovoModelo(""); setNovoNumSerie(""); setNovoAno(""); setPlaquetaFile(null);
    }
  }

  function handleConfirm() {
    if (!clienteSel) return;
    setError(null);
    startTransition(async () => {
      const result = await criarPropostaPecas({
        cliente_id:        clienteSel.id,
        maquina_id:        maquinaSel?.id ?? null,
        moeda,
        itens:             cart,
        condicao_pagamento: condicao,
        prazo_entrega:     prazo,
        validade_proposta: validade,
        observacoes:       observacoes || undefined,
        taxa_cambio:       taxaDolar,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* Stepper bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-white">
        <div>
          <h1 className="text-[16px] font-bold text-[#1A1A1A]">Nova Proposta — Peças</h1>
          <p className="text-[11px] text-[#6B7B8D] mt-0.5">Rascunho{clienteSel ? ` · ${clienteSel.razao_social ?? clienteSel.nome_fantasia}` : ""}</p>
        </div>
        <StepperBar step={step} />
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="h-9 px-4 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#6B7B8D] hover:bg-[#F8FAFC] transition-colors"
            >
              Voltar
            </button>
          )}
          {step < 4 && step !== 3 && (
            <button
              onClick={() => {
                if (step === 1 && !clienteSel) return;
                if (step === 2 && !maquinaSel) return;
                setStep((s) => (s + 1) as Step);
              }}
              disabled={(step === 1 && !clienteSel) || (step === 2 && !maquinaSel)}
              className="h-9 px-4 rounded-lg bg-[#2C4F79] hover:bg-[#1E3A5F] disabled:opacity-40 text-white text-[13px] font-semibold transition-colors flex items-center gap-1.5"
            >
              Próxima etapa <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => { if (cart.length > 0) setStep(4); }}
              disabled={cart.length === 0}
              className="h-9 px-4 rounded-lg bg-[#2C4F79] hover:bg-[#1E3A5F] disabled:opacity-40 text-white text-[13px] font-semibold transition-colors flex items-center gap-1.5"
            >
              Revisar ({cart.length} {cart.length === 1 ? "item" : "itens"}) <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* STEP 1 — Select client */}
          {step === 1 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-[#2074B9]" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-[#1A1A1A]">Selecionar Cliente</h2>
                  <p className="text-[11px] text-[#6B7B8D]">Busque o cliente para a proposta de peças</p>
                </div>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B0BAC9]" />
                <input
                  type="text"
                  placeholder="Buscar por razão social ou nome fantasia..."
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                  autoFocus
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E2E8F0] text-[13px] focus:border-[#2074B9] outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                {clientesFiltrados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCliente(c)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#E2E8F0] hover:border-[#2074B9] hover:bg-[#EFF6FF] transition-colors text-left"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-[#1A1A1A]">{c.razao_social ?? c.nome_fantasia}</p>
                      {c.nome_fantasia && c.razao_social && (
                        <p className="text-[11px] text-[#6B7B8D]">{c.nome_fantasia}</p>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6B7B8D]">
                      {[c.cidade, c.estado].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                ))}
                {clientesFiltrados.length === 0 && (
                  <p className="text-center text-[13px] text-[#B0BAC9] py-8">Nenhum cliente encontrado.</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 — Select machine */}
          {step >= 2 && clienteSel && (
            <div className={cn("bg-white border rounded-2xl p-5", step === 2 ? "border-[#E2E8F0]" : "border-[#DCFCE7]")}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
                  step > 2 ? "bg-[#DCFCE7]" : "bg-[#EFF6FF]"
                )}>
                  {step > 2
                    ? <Check className="h-4 w-4 text-[#16A34A]" />
                    : <Cpu className="h-4 w-4 text-[#2074B9]" />}
                </div>
                <div className="flex-1">
                  <h2 className="text-[14px] font-bold text-[#1A1A1A]">
                    {step > 2 && maquinaSel ? "Máquina selecionada" : "Selecione a Máquina"}
                  </h2>
                  <p className="text-[11px] text-[#6B7B8D]">
                    {step > 2 && maquinaSel
                      ? "Etapa 2 concluída"
                      : "Peças disponíveis serão filtradas pelo modelo"}
                  </p>
                </div>
                {step > 2 && (
                  <button
                    onClick={() => setStep(2)}
                    className="h-7 px-3 rounded-lg border border-[#E2E8F0] text-[11px] text-[#6B7B8D] hover:bg-[#F8FAFC] transition-colors"
                  >
                    Alterar
                  </button>
                )}
              </div>

              {step === 2 && (
                <>
                  {/* Client info summary */}
                  <div className="grid grid-cols-4 gap-4 mb-5 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <div>
                      <p className="text-[10px] text-[#6B7B8D] mb-0.5">Cliente</p>
                      <p className="text-[13px] font-semibold">{clienteSel.razao_social ?? clienteSel.nome_fantasia}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#6B7B8D] mb-0.5">Cidade / UF</p>
                      <p className="text-[13px]">{[clienteSel.cidade, clienteSel.estado].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#6B7B8D] mb-0.5">Moeda</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {(["BRL", "USD"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setMoeda(m)}
                            className={cn("h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors border",
                              moeda === m ? "bg-[#2C4F79] text-white border-[#2C4F79]" : "bg-white text-[#6B7B8D] border-[#E2E8F0] hover:border-[#2C4F79]"
                            )}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#6B7B8D] mb-0.5">Câmbio USD</p>
                      <p className="text-[13px] font-mono">R$ {taxaDolar.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Machine grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {maquinas.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMaquinaSel(m)}
                        className={cn(
                          "text-left p-4 rounded-xl border-2 transition-colors",
                          maquinaSel?.id === m.id
                            ? "border-[#2074B9] bg-[#EFF6FF]"
                            : "border-[#E2E8F0] hover:border-[#BFDBFE] hover:bg-[#F8FAFC]"
                        )}
                      >
                        <p className="text-[14px] font-bold text-[#2C4F79]">{m.modelo ?? "Modelo desconhecido"}</p>
                        <p className="text-[11px] text-[#6B7B8D] mt-1">
                          {m.numero_serie ? `Série: ${m.numero_serie}` : "Sem nº de série"}
                          {m.ano_fabricacao ? ` · ${m.ano_fabricacao}` : ""}
                        </p>
                      </button>
                    ))}

                    {/* Add new machine card */}
                    <button
                      onClick={() => setShowNovaMaquina(!showNovaMaquina)}
                      className="text-left p-4 rounded-xl border-2 border-dashed border-[#E2E8F0] hover:border-[#2074B9] hover:bg-[#F8FAFC] transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <Plus className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#1A1A1A]">Cadastrar nova máquina</p>
                        <p className="text-[10px] text-[#6B7B8D]">Informe o modelo ou faça upload da plaqueta</p>
                      </div>
                    </button>
                  </div>

                  {/* New machine form */}
                  {showNovaMaquina && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      {/* Plaqueta upload */}
                      <div
                        className="border-2 border-dashed border-amber-300 rounded-xl p-6 text-center cursor-pointer hover:bg-amber-100 transition-colors mb-4"
                        onClick={() => fileRef.current?.click()}
                      >
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => setPlaquetaFile(e.target.files?.[0] ?? null)}
                        />
                        {plaquetaFile ? (
                          <p className="text-[13px] font-semibold text-amber-700">{plaquetaFile.name}</p>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                            <p className="text-[13px] font-semibold text-amber-700">Clique ou arraste a foto da plaqueta</p>
                            <p className="text-[11px] text-amber-600 mt-1">JPG, PNG ou PDF · máx. 10MB</p>
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-semibold text-amber-700 uppercase block mb-1">Modelo *</label>
                          <select
                            value={novoModelo}
                            onChange={(e) => setNovoModelo(e.target.value)}
                            className="w-full h-8 rounded-lg border border-amber-300 px-2 text-[12px] bg-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="">Selecione...</option>
                            {["MGHS 1200A2","MGHS 800A","MGHS 600A","TPS 800","TPS 600","ES75","AS 900"].map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-amber-700 uppercase block mb-1">Nº Série</label>
                          <input
                            type="text"
                            placeholder="ex: 800-2024-031"
                            value={novoNumSerie}
                            onChange={(e) => setNovoNumSerie(e.target.value)}
                            className="w-full h-8 rounded-lg border border-amber-300 px-2 text-[12px] focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-amber-700 uppercase block mb-1">Ano</label>
                          <input
                            type="text"
                            placeholder="2024"
                            value={novoAno}
                            onChange={(e) => setNovoAno(e.target.value)}
                            className="w-full h-8 rounded-lg border border-amber-300 px-2 text-[12px] focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setShowNovaMaquina(false)}
                          className="h-8 px-4 rounded-lg border border-amber-300 text-[12px] text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={registrarNovaMaquina}
                          disabled={!novoModelo}
                          className="h-8 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors"
                        >
                          Cadastrar máquina
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {step > 2 && maquinaSel && (
                <div className="px-4 py-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl">
                  <p className="text-[14px] font-bold text-[#2C4F79]">{maquinaSel.modelo}</p>
                  <p className="text-[11px] text-[#6B7B8D] mt-0.5">
                    {maquinaSel.numero_serie ? `Série: ${maquinaSel.numero_serie}` : "Sem nº de série"}
                    {maquinaSel.ano_fabricacao ? ` · ${maquinaSel.ano_fabricacao}` : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Parts catalog */}
          {step === 3 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0]">
                <h2 className="text-[14px] font-bold text-[#1A1A1A]">
                  Catálogo — {maquinaSel?.modelo ?? "Todos os modelos"}
                </h2>
                <p className="text-[11px] text-[#6B7B8D]">Peças filtradas para este modelo</p>
              </div>

              {/* Category tabs */}
              <div className="flex items-center gap-0 border-b border-[#E2E8F0] px-4">
                {PART_CATS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCatTab(c.value)}
                    className={cn(
                      "px-3 py-2.5 text-[12px] font-semibold border-b-2 transition-colors",
                      catTab === c.value
                        ? "border-[#2074B9] text-[#2074B9]"
                        : "border-transparent text-[#6B7B8D] hover:text-[#1A1A1A]"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B0BAC9]" />
                  <input
                    type="text"
                    placeholder="Buscar por código ou descrição..."
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                    className="w-full h-8 pl-9 pr-3 rounded-lg border border-[#E2E8F0] text-[12px] focus:border-[#2074B9] outline-none"
                  />
                </div>
              </div>

              {/* Products table */}
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left px-4 py-2 font-semibold text-[#6B7B8D] text-[11px] uppercase">Código</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#6B7B8D] text-[11px] uppercase">Descrição</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#6B7B8D] text-[11px] uppercase">Compatível</th>
                    <th className="text-right px-3 py-2 font-semibold text-[#6B7B8D] text-[11px] uppercase">Preço Unit.</th>
                    <th className="text-center px-3 py-2 font-semibold text-[#6B7B8D] text-[11px] uppercase">IPI</th>
                    <th className="text-center px-3 py-2 font-semibold text-[#6B7B8D] text-[11px] uppercase w-40">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados().map((p) => {
                    const inCart = cart.some((i) => i.produto_id === p.id);
                    const preco = moeda === "BRL" ? (p.preco_brl ?? 0) : (p.preco_usd ?? (p.preco_brl ?? 0) / taxaDolar);
                    const qty = getQty(p.id);
                    return (
                      <tr key={p.id} className={cn("border-b border-[#F1F5F9]", inCart ? "bg-[#F0FDF4]" : "hover:bg-[#F8FAFC]")}>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-[#DC2626] text-[11px]">CÓD. {p.codigo}</span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-[#1A1A1A]">{p.descricao}</p>
                          {p.specs && (
                            <p className="text-[10px] text-[#6B7B8D]">
                              {Object.entries(p.specs as Record<string, unknown>).slice(0, 2).map(([, v]) => String(v)).join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {p.modelos_compat.slice(0, 2).map((m) => (
                            <span key={m} className="inline-block px-1.5 py-0.5 rounded-md bg-[#F1F5F9] text-[10px] text-[#6B7B8D] mr-1">{m}</span>
                          ))}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-[#1A1A1A]">
                          {moeda === "BRL" ? fmtBRL(preco) : `$${preco.toFixed(2)}`}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-[#6B7B8D]">
                          {p.ipi_pct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex items-center border border-[#E2E8F0] rounded-lg overflow-hidden">
                              <button
                                onClick={() => setQtys((q) => ({ ...q, [p.id]: Math.max(1, (q[p.id] ?? 1) - 1) }))}
                                className="w-7 h-7 flex items-center justify-center hover:bg-[#F1F5F9] text-[#6B7B8D] transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={qty}
                                onChange={(e) => setQtys((q) => ({ ...q, [p.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                className="w-10 h-7 text-center text-[12px] font-mono border-x border-[#E2E8F0] outline-none"
                              />
                              <button
                                onClick={() => setQtys((q) => ({ ...q, [p.id]: (q[p.id] ?? 1) + 1 }))}
                                className="w-7 h-7 flex items-center justify-center hover:bg-[#F1F5F9] text-[#6B7B8D] transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => inCart ? removeFromCart(p.id) : addToCart(p)}
                              className={cn(
                                "h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors",
                                inCart
                                  ? "bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]"
                                  : "bg-[#EFF6FF] text-[#2074B9] border border-[#BFDBFE] hover:bg-[#DBEAFE]"
                              )}
                            >
                              {inCart ? (
                                <span className="flex items-center gap-1"><Check className="h-3 w-3" />Add.</span>
                              ) : (
                                "+ Add."
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {produtosFiltrados().length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#B0BAC9]">
                        Nenhum produto encontrado para este modelo/categoria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* STEP 4 — Review */}
          {step === 4 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6">
              <h2 className="text-[15px] font-bold text-[#1A1A1A] mb-5">Revisão da Proposta</h2>

              <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-[12px]">
                <div>
                  <p className="text-[10px] text-[#6B7B8D] uppercase font-semibold mb-1">Cliente</p>
                  <p className="font-semibold">{clienteSel?.razao_social ?? clienteSel?.nome_fantasia}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B7B8D] uppercase font-semibold mb-1">Máquina</p>
                  <p className="font-semibold">{maquinaSel?.modelo ?? "Não especificada"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B7B8D] uppercase font-semibold mb-1">Moeda</p>
                  <p className="font-semibold">{moeda}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B7B8D] uppercase font-semibold mb-1">Itens</p>
                  <p className="font-semibold">{cart.length}</p>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase text-[#6B7B8D] mb-3">Itens selecionados</p>
                {cart.map((item) => (
                  <div key={item.produto_id} className="flex items-center justify-between py-2.5 border-b border-[#F1F5F9] last:border-0">
                    <div>
                      <p className="text-[12px] font-semibold text-[#1A1A1A]">{item.descricao}</p>
                      <p className="text-[10px] text-[#6B7B8D]">CÓD. {item.codigo} · {item.quantidade}x · IPI {item.ipi_pct.toFixed(2)}%</p>
                    </div>
                    <span className="font-mono font-semibold text-[13px]">{fmtBRL(item.preco_unitario * item.quantidade)}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Condição de pagamento", val: condicao, setter: setCondicao },
                  { label: "Prazo de entrega", val: prazo, setter: setPrazo },
                  { label: "Validade da proposta", val: validade, setter: setValidade },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-[10px] font-semibold text-[#6B7B8D] uppercase block mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={f.val}
                      onChange={(e) => f.setter(e.target.value)}
                      className="w-full h-8 rounded-lg border border-[#E2E8F0] px-3 text-[12px] focus:border-[#2074B9] outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <label className="text-[10px] font-semibold text-[#6B7B8D] uppercase block mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Notas internas..."
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[12px] focus:border-[#2074B9] outline-none resize-none"
                />
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>
              )}

              <button
                onClick={handleConfirm}
                disabled={isPending || cart.length === 0}
                className="w-full h-10 rounded-xl bg-[#2C4F79] hover:bg-[#1E3A5F] disabled:opacity-40 text-white text-[13px] font-bold transition-colors"
              >
                {isPending ? "Criando proposta..." : "Confirmar e Criar Proposta"}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar 320px */}
        <aside className="w-[320px] shrink-0 border-l border-[#E2E8F0] bg-white flex flex-col">
          {/* Preview */}
          <div className="p-4 border-b border-[#E2E8F0]">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7B8D] mb-3">Prévia</p>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7B8D]">Rascunho · Peças{clienteSel ? ` · ${(clienteSel.razao_social ?? clienteSel.nome_fantasia ?? "").split(" ").slice(0, 2).join(" ")}` : ""}</p>
              {cart.length > 0 ? (
                <>
                  <p className="text-[22px] font-bold font-mono text-[#1A1A1A] mt-2">{fmtBRL(subtotal)}</p>
                  <p className="text-[11px] text-[#6B7B8D] mt-1">+ IPI {fmtBRL(ipiTotal)}</p>
                </>
              ) : (
                <p className="text-[14px] font-mono text-[#B0BAC9] mt-2">R$ 0,00</p>
              )}
            </div>
          </div>

          {/* Machine selected */}
          {maquinaSel && (
            <div className="px-4 pb-3 border-b border-[#E2E8F0]">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7B8D] mb-2">Máquina Selecionada</p>
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3">
                <p className="text-[14px] font-bold text-[#2C4F79]">{maquinaSel.modelo}</p>
                <p className="text-[11px] text-[#6B7B8D] mt-1">
                  {maquinaSel.numero_serie ? `Série: ${maquinaSel.numero_serie}` : "Sem série"}
                  {maquinaSel.ano_fabricacao ? ` · ${maquinaSel.ano_fabricacao}` : ""}
                </p>
              </div>
            </div>
          )}

          {/* Cart */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
              <p className="text-[12px] font-bold text-[#1A1A1A]">Itens selecionados</p>
              <span className="text-[11px] font-semibold text-[#2074B9]">{cart.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="px-4 py-6 text-[11px] text-[#B0BAC9] italic">Adicione peças do catálogo</p>
              ) : (
                cart.map((item) => (
                  <div key={item.produto_id} className="px-4 py-3 border-b border-[#F1F5F9]">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#1A1A1A] truncate">{item.descricao}</p>
                        <p className="text-[10px] text-[#6B7B8D]">CÓD. {item.codigo}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.produto_id)} className="ml-2 shrink-0 text-[#B0BAC9] hover:text-[#DC2626] transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-[#E2E8F0] rounded-lg overflow-hidden">
                        <button onClick={() => updateCartQty(item.produto_id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-[#F1F5F9] text-[#6B7B8D]">
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-8 text-center text-[11px] font-mono font-semibold border-x border-[#E2E8F0]">{item.quantidade}</span>
                        <button onClick={() => updateCartQty(item.produto_id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-[#F1F5F9] text-[#6B7B8D]">
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <span className="text-[12px] font-mono font-semibold text-[#1A1A1A]">
                        {fmtBRL(item.preco_unitario * item.quantidade)} + IPI
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-[#E2E8F0] px-4 py-3">
              <div className="flex justify-between text-[12px] mb-1">
                <span className="text-[#6B7B8D]">Subtotal</span>
                <span className="font-mono font-semibold">{fmtBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[12px] mb-2">
                <span className="text-[#6B7B8D]">IPI</span>
                <span className="font-mono font-semibold">{fmtBRL(ipiTotal)}</span>
              </div>
              <div className="flex justify-between text-[14px] font-bold border-t border-[#E2E8F0] pt-2">
                <span>TOTAL</span>
                <span className="font-mono text-[#2C4F79]">{fmtBRL(total)}</span>
              </div>
            </div>

            <div className="px-4 pb-4">
              <button
                onClick={() => step < 3 ? undefined : cart.length > 0 ? setStep(4) : undefined}
                disabled={!maquinaSel || cart.length === 0}
                className="w-full h-9 rounded-xl bg-[#2C4F79] hover:bg-[#1E3A5F] disabled:opacity-40 text-white text-[12px] font-bold transition-colors"
              >
                {!maquinaSel ? "Selecione a máquina primeiro" : "Gerar proposta"}
              </button>
              {!maquinaSel && (
                <p className="text-[10px] text-center text-[#B0BAC9] mt-1.5">Selecione a máquina para liberar</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

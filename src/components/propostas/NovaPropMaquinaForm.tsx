"use client";

import { useState, useTransition } from "react";
import {
  Check, ChevronRight, ChevronLeft, AlertCircle, Plus, Minus,
  FileText, Zap, Package, ClipboardList, Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProdutoComDetalhes } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { compararPorTamanho, tituloComSeparador } from "@/lib/produto-titulo";
import { montarDescritivoMaquina } from "@/lib/propostas/descritivo-maquina";
import { ROTULOS_MOAGEM } from "@/lib/propostas/checklist";
import { precoComDesconto } from "@/lib/propostas/revisao";
import { OrganizacaoComercialCampos, ORGANIZACAO_PADRAO, validarOrganizacao, type OrganizacaoComercialValor } from "./OrganizacaoComercialCampos";
import { criarPropostaPecas, type CartItemInput } from "@/app/actions/propostas-pecas";

interface ClienteSimples {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cidade: string | null;
  estado: string | null;
}

interface Props {
  /** Propostas abertas e principais (para vincular uma complementar). */
  propostasPrincipais: Array<{ id: string; numero_completo: string; cliente_id: string | null }>;
  representantes: Array<{ id: string; nome: string }>;
  clientes: ClienteSimples[];
  maquinas: ProdutoComDetalhes[];
  pecas: ProdutoComDetalhes[];
}

const NAV = "#2C4F79";
const BLUE = "#2074B9";
const BG = "#F8FAFC";
const BORDER = "#E2E8F0";

const STEPS = [
  { num: 1, label: "Cliente", Icon: FileText },
  { num: 2, label: "Checklist", Icon: ClipboardList },
  { num: 3, label: "Máquina", Icon: Settings },
  { num: 4, label: "Itens", Icon: Package },
  { num: 5, label: "Finalizar", Icon: Zap },
];

const CHECKLIST_FIELDS = [
  { name: "segmento_aplicacao", label: "Segmento de Aplicação" },
  { name: "produto_final", label: "Produto Final" },
  { name: "material", label: "Material" },
  { name: "dimensoes", label: "Dimensões" },
  { name: "granulometria", label: "Granulometria" },
];

const CHECKLIST_SELECTS = [
  { name: "moagem_tipo", label: "Tipo de Moagem", options: ROTULOS_MOAGEM },
  { name: "forma_abastecimento", label: "Abastecimento", options: ["Esteira transportadora", "Manual", "Silo", "Pneumático"] },
  { name: "voltagem", label: "Voltagem", options: ["380V 60Hz", "220V 60Hz", "440V 60Hz", "Outro"] },
];

// Textos padrão do modelo "PROPOSTA MÁQUINA 2026".
const CONDICAO_PADRAO = "35% no pedido;\n15% a 30 dias do pedido;\n15% a 60 dias do pedido;\nSaldo em 28/56 ddl.";
const PRAZO_PADRAO = "120/130 dias da confirmação do pedido, aprovação do projeto e quitação da parcela de sinal*";

type OpcaoPainel = "sem" | "220" | "380";

/** Equipamento escolhido na proposta: quantidade e painel de cada um. */
interface MaquinaEscolhida {
  id: string;
  /** null = ainda não escolheu o painel (obrigatório quando o item tem preço de painel). */
  painel: OpcaoPainel | null;
  quantidade: number;
}

const OPCOES_PAINEL: { valor: OpcaoPainel; label: string }[] = [
  { valor: "sem", label: "Sem painel" },
  { valor: "220", label: "Com painel 220V" },
  { valor: "380", label: "Com painel 380V" },
];

/** Preço do painel na voltagem pedida; null quando não há preço cadastrado. */
function precoPainel(m: ProdutoComDetalhes, voltagem: "220" | "380"): number | null {
  const p = voltagem === "220" ? m.preco_painel_220 : m.preco_painel_380;
  return p != null && p > 0 ? p : null;
}

function temPainel(m: ProdutoComDetalhes): boolean {
  return precoPainel(m, "220") != null || precoPainel(m, "380") != null;
}

export function NovaPropMaquinaForm({ clientes, maquinas, pecas, propostasPrincipais, representantes }: Props) {
  const [organizacao, setOrganizacao] = useState<OrganizacaoComercialValor>(ORGANIZACAO_PADRAO);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 — cliente
  const [clienteId, setClienteId] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");

  // Step 2 — checklist
  const [checklist, setChecklist] = useState<Record<string, string>>({
    segmento_aplicacao: "", produto_final: "", material: "",
    dimensoes: "", granulometria: "", moagem_tipo: "A seco",
    forma_abastecimento: "Esteira transportadora", producao_horaria_kgh: "", voltagem: "380V 60Hz",
  });

  // Step 3 — equipamentos selecionados (vários), cada um com sua quantidade e seu painel
  const [escolhidas, setEscolhidas] = useState<MaquinaEscolhida[]>([]);
  const [maquinaSearch, setMaquinaSearch] = useState("");
  const [linhaFiltro, setLinhaFiltro] = useState("");
  const [maquinasVisiveis, setMaquinasVisiveis] = useState(60);

  // Step 4 — itens adicionais (peças)
  const [cart, setCart] = useState<CartItemInput[]>([]);
  // Desconto % por item (chave = produto), editado no resumo final
  const [descontos, setDescontos] = useState<Record<string, number>>({});
  const [pecaSearch, setPecaSearch] = useState("");
  const [pecaTipo, setPecaTipo] = useState("");
  const [pecasVisiveis, setPecasVisiveis] = useState(40);

  // Step 5 — condições (padrões do modelo "PROPOSTA MÁQUINA 2026"; o vendedor pode alterar)
  const [condicao, setCondicao] = useState(CONDICAO_PADRAO);
  const [prazo, setPrazo] = useState(PRAZO_PADRAO);
  // Coluna no banco é do tipo data — guarda a data-limite (padrão do modelo: 15 dias).
  const [validade, setValidade] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [obs, setObs] = useState("");

  const clientesFiltrados = clientes.filter((c) => {
    const q = clienteSearch.toLowerCase();
    return (
      c.razao_social?.toLowerCase().includes(q) ||
      c.nome_fantasia?.toLowerCase().includes(q) ||
      c.cidade?.toLowerCase().includes(q)
    );
  });

  const linhasMaquinas = Array.from(new Set(maquinas.map((m) => m.linha).filter((l): l is string => Boolean(l)))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const maquinasFiltradas = maquinas
    .filter((m) => {
      const q = maquinaSearch.toLowerCase();
      if (linhaFiltro && m.linha !== linhaFiltro) return false;
      return m.codigo.toLowerCase().includes(q) || m.descricao.toLowerCase().includes(q) || m.linha?.toLowerCase().includes(q);
    })
    .sort((a, b) => compararPorTamanho(a.codigo, b.codigo));

  const TIPOS_PECA: Array<{ valor: string; rotulo: string }> = [
    { valor: "", rotulo: "Todos" },
    { valor: "navalha", rotulo: "Navalhas" },
    { valor: "peneira", rotulo: "Peneiras" },
    { valor: "outros", rotulo: "Outras peças" },
  ];
  const pecasFiltradas = pecas.filter((p) => {
    const q = pecaSearch.toLowerCase();
    if (pecaTipo === "navalha" && p.categoria !== "navalha") return false;
    if (pecaTipo === "peneira" && p.categoria !== "peneira") return false;
    if (pecaTipo === "outros" && (p.categoria === "navalha" || p.categoria === "peneira")) return false;
    return p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
  });

  // Marcar/desmarcar equipamento. Item sem preço de painel cadastrado só pode ir "sem painel".
  const alternarMaquina = (m: ProdutoComDetalhes) => {
    setEscolhidas((prev) => prev.some((e) => e.id === m.id)
      ? prev.filter((e) => e.id !== m.id)
      : [...prev, { id: m.id, painel: temPainel(m) ? null : "sem", quantidade: 1 }]);
    setError(null);
  };
  const removerMaquina = (id: string) => setEscolhidas((prev) => prev.filter((e) => e.id !== id));
  const definirPainelMaquina = (id: string, painel: OpcaoPainel) =>
    setEscolhidas((prev) => prev.map((e) => (e.id === id ? { ...e, painel } : e)));
  const alterarQtdMaquina = (id: string, delta: number) =>
    setEscolhidas((prev) => prev.map((e) => (e.id === id ? { ...e, quantidade: Math.max(1, e.quantidade + delta) } : e)));

  // Algum equipamento com preço de painel ainda sem a escolha do painel?
  const maquinaSemPainelEscolhido = escolhidas.find((e) => {
    const m = maquinas.find((x) => x.id === e.id);
    return m && temPainel(m) && e.painel === null;
  });

  const addToCart = (prod: ProdutoComDetalhes) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.produto_id === prod.id);
      if (existing) return prev.map((i) => i.produto_id === prod.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, {
        produto_id: prod.id, variante_id: null,
        codigo: prod.codigo, descricao: prod.descricao,
        preco_unitario: prod.preco_brl ?? 0, ipi_pct: prod.ipi_pct, quantidade: 1,
      }];
    });
  };

  const updateQty = (prodId: string, delta: number) => {
    setCart((prev) => prev
      .map((i) => i.produto_id === prodId ? { ...i, quantidade: Math.max(0, i.quantidade + delta) } : i)
      .filter((i) => i.quantidade > 0)
    );
  };

  const checklistCompleto = CHECKLIST_FIELDS.every((f) => checklist[f.name]?.trim()) &&
    checklist.producao_horaria_kgh?.trim() &&
    checklist.moagem_tipo && checklist.forma_abastecimento && checklist.voltagem;

  // Cada equipamento vira um item da proposta. O painel escolhido fica DENTRO do item (como no modelo
  // do Word): o preço do painel soma no valor do equipamento e o descritivo ganha o bloco do painel.
  const itensMaquina: CartItemInput[] = escolhidas.flatMap((e): CartItemInput[] => {
    const m = maquinas.find((x) => x.id === e.id);
    if (!m) return [];
    const volt = e.painel === "220" || e.painel === "380" ? e.painel : null;
    const precoPnl = volt ? precoPainel(m, volt) : null;
    const incluso = volt && precoPnl != null ? { voltagem: volt, preco: precoPnl } : null;
    return [{
      produto_id: m.id, variante_id: null,
      codigo: m.codigo,
      descricao: tituloComSeparador(m.codigo) + (incluso ? ` + painel NR-12 ${incluso.voltagem}V` : ""),
      observacao: montarDescritivoMaquina(m, incluso),
      preco_unitario: (m.preco_brl ?? 0) + (incluso?.preco ?? 0),
      ipi_pct: m.ipi_pct, quantidade: e.quantidade,
    }];
  });

  // Proposta completa: equipamentos + peças, com o desconto % de cada item
  const allCartItems: CartItemInput[] = [
    ...itensMaquina,
    ...cart,
  ].map((i) => ({ ...i, desconto_pct: descontos[i.produto_id] ?? 0 }));

  const precoFinal = (i: CartItemInput) => precoComDesconto(i.preco_unitario, i.desconto_pct);
  const subtotal = allCartItems.reduce((a, i) => a + precoFinal(i) * i.quantidade, 0);
  const ipiTotal = allCartItems.reduce((a, i) => a + precoFinal(i) * i.quantidade * (i.ipi_pct / 100), 0);

  const handleFinalizar = () => {
    if (!clienteId || escolhidas.length === 0 || allCartItems.length === 0) {
      setError("Selecione o cliente e ao menos um equipamento.");
      return;
    }
    if (maquinaSemPainelEscolhido) {
      setError("Escolha o painel (220V, 380V ou sem painel) de cada equipamento que tem painel.");
      return;
    }
    const erroOrganizacao = validarOrganizacao(organizacao);
    if (erroOrganizacao) { setError(erroOrganizacao); return; }
    setError(null);
    startTransition(async () => {
      const res = await criarPropostaPecas({
        cliente_id: clienteId,
        maquina_id: null,
        tipo: "maquina",
        moeda: "BRL",
        itens: allCartItems,
        condicao_pagamento: condicao,
        prazo_entrega: prazo,
        validade_proposta: validade,
        observacoes: obs,
        taxa_cambio: 5.70,
        organizacao: { ...organizacao, proposta_principal_id: organizacao.proposta_principal_id || null },
        checklist: {
          segmento_aplicacao: checklist.segmento_aplicacao,
          produto_final: checklist.produto_final,
          material: checklist.material,
          dimensoes: checklist.dimensoes,
          granulometria: checklist.granulometria,
          moagem_tipo: checklist.moagem_tipo,
          forma_abastecimento: checklist.forma_abastecimento,
          producao_horaria_kgh: Number(checklist.producao_horaria_kgh),
          voltagem: checklist.voltagem,
        },
      });
      if (res.error) { setError(res.error); return; }
      router.push("/propostas");
    });
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", background: BG }}>
        {/* Stepper */}
        <div style={{
          background: "#fff",
          borderBottom: `1px solid ${BORDER}`,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {STEPS.map((s, idx) => (
              <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
                {idx > 0 && (
                  <div style={{ width: 32, height: 2, background: step > idx ? "#16a34a" : BORDER, margin: "0 4px" }} />
                )}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  cursor: step > s.num ? "pointer" : "default",
                }} onClick={() => step > s.num && setStep(s.num)}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: step === s.num ? NAV : step > s.num ? "#16a34a" : BORDER,
                    color: step >= s.num ? "#fff" : "#6b7b8d",
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {step > s.num ? <Check size={14} /> : s.num}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: step === s.num ? 600 : 400, color: step === s.num ? NAV : "#6b7b8d" }}>
                    {s.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 1 && (
              <button onClick={() => setStep((s) => s - 1)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}>
                <ChevronLeft size={16} /> Voltar
              </button>
            )}
            {step < 5 && (
              <button
                onClick={() => {
                  if (step === 1 && !clienteId) { setError("Selecione um cliente."); return; }
                  if (step === 2 && !checklistCompleto) { setError("Preencha todos os campos do checklist."); return; }
                  if (step === 3 && escolhidas.length === 0) { setError("Selecione ao menos um equipamento."); return; }
                  if (step === 3 && maquinaSemPainelEscolhido) { setError("Escolha o painel (220V, 380V ou sem painel) de cada equipamento que tem painel."); return; }
                  setError(null); setStep((s) => s + 1);
                }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: NAV, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Avançar <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* STEP 1 — CLIENTE */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>Selecionar Cliente</div>
              <div style={{ fontSize: 13, color: "#6b7b8d", marginBottom: 16 }}>Escolha o cliente para esta proposta de máquina.</div>
              <input
                value={clienteSearch} onChange={(e) => setClienteSearch(e.target.value)}
                placeholder="Buscar por nome, fantasia ou cidade..."
                style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, marginBottom: 12 }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {clientesFiltrados.slice(0, 20).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setClienteId(c.id)}
                    style={{
                      border: `2px solid ${clienteId === c.id ? NAV : BORDER}`,
                      borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                      background: clienteId === c.id ? "#f0f4fa" : "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{c.razao_social ?? c.nome_fantasia}</div>
                    {c.nome_fantasia && c.razao_social && (
                      <div style={{ fontSize: 12, color: "#6b7b8d" }}>{c.nome_fantasia}</div>
                    )}
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{c.cidade}/{c.estado}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — CHECKLIST */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>Checklist Técnico da Aplicação</div>
              <div style={{ fontSize: 13, color: "#6b7b8d", marginBottom: 16 }}>Todos os campos são obrigatórios para gerar o PDF.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, padding: 20 }}>
                {CHECKLIST_FIELDS.map((f) => (
                  <div key={f.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      {f.label} <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      value={checklist[f.name] ?? ""}
                      onChange={(e) => setChecklist((p) => ({ ...p, [f.name]: e.target.value }))}
                      placeholder={f.label}
                      style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                ))}
                {CHECKLIST_SELECTS.map((f) => (
                  <div key={f.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      {f.label} <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      value={checklist[f.name] ?? ""}
                      onChange={(e) => setChecklist((p) => ({ ...p, [f.name]: e.target.value }))}
                      style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, background: "#fff" }}
                    >
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                    Produção Horária <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden" }}>
                    <input
                      type="number"
                      value={checklist.producao_horaria_kgh ?? ""}
                      onChange={(e) => setChecklist((p) => ({ ...p, producao_horaria_kgh: e.target.value }))}
                      placeholder="ex: 500"
                      style={{ flex: 1, padding: "8px 10px", border: "none", outline: "none", fontSize: 13 }}
                    />
                    <span style={{ padding: "8px 10px", background: BG, color: "#6b7b8d", fontSize: 12, borderLeft: `1px solid ${BORDER}` }}>kg/h</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — EQUIPAMENTOS (vários) */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>Selecionar Equipamentos</div>
              <div style={{ fontSize: 13, color: "#6b7b8d", marginBottom: 16 }}>
                Escolha um ou mais equipamentos: moinhos, esteiras, exaustores, silos, cabines etc. Clique de novo para tirar da proposta. Navalhas, peneiras e peças entram no próximo passo.
              </div>

              {escolhidas.length > 0 && (
                <div style={{ background: "#eff6ff", border: `1px solid #93c5fd`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", marginBottom: 8 }}>
                    {escolhidas.length} {escolhidas.length === 1 ? "equipamento selecionado" : "equipamentos selecionados"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {escolhidas.map((e) => {
                      const m = maquinas.find((x) => x.id === e.id);
                      if (!m) return null;
                      const pendente = temPainel(m) && e.painel === null;
                      return (
                        <span key={e.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${pendente ? "#f59e0b" : BORDER}`, borderRadius: 999, padding: "4px 6px 4px 10px", fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>
                          {e.quantidade > 1 ? `${e.quantidade}× ` : ""}{tituloComSeparador(m.codigo)}
                          {pendente && <span style={{ color: "#b45309", fontWeight: 600 }}>· escolha o painel</span>}
                          <button type="button" onClick={() => removerMaquina(e.id)} aria-label="Remover" style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 12, lineHeight: 1, color: "#6b7b8d" }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <input
                  value={maquinaSearch} onChange={(e) => { setMaquinaSearch(e.target.value); setMaquinasVisiveis(60); }}
                  placeholder="Buscar por modelo (ex.: MGHS 300 A2, esteira, exaustor) ou linha..."
                  style={{ flex: "1 1 260px", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14 }}
                />
                <select
                  value={linhaFiltro} onChange={(e) => { setLinhaFiltro(e.target.value); setMaquinasVisiveis(60); }}
                  style={{ flex: "0 1 240px", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, background: "#fff" }}
                >
                  <option value="">Todas as linhas</option>
                  {linhasMaquinas.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                {maquinasFiltradas.slice(0, maquinasVisiveis).map((m) => {
                  const specs = m.specs as Record<string, string | number> | null;
                  const escolhida = escolhidas.find((e) => e.id === m.id);
                  const selecionada = Boolean(escolhida);
                  return (
                    <div
                      key={m.id}
                      onClick={() => alternarMaquina(m)}
                      style={{
                        border: `2px solid ${selecionada ? BLUE : BORDER}`,
                        borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                        background: selecionada ? "#eff6ff" : "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <span style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>{m.linha ?? "—"}</span>
                        {selecionada && <Check size={16} color="#2074B9" />}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 4 }}>{tituloComSeparador(m.codigo)}</div>
                      {specs && (
                        <div style={{ fontSize: 11, color: "#6b7b8d", marginBottom: 8 }}>
                          {specs.potencia_cv && <span style={{ marginRight: 8 }}>{String(specs.potencia_cv)} CV</span>}
                          {specs.capacidade_kgh && <span style={{ marginRight: 8 }}>{String(specs.capacidade_kgh)} kg/h</span>}
                          {specs.tensao && <span>{String(specs.tensao)}</span>}
                        </div>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 16, color: NAV }}>
                        {formatCurrency(m.preco_brl ?? 0)}
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7b8d", marginLeft: 6 }}>{temPainel(m) ? "sem painel" : ""}</span>
                      </div>

                      {/* Quantidade e painel — aparecem no card do equipamento selecionado */}
                      {escolhida && (
                        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #93c5fd", cursor: "default" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Quantidade</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button type="button" onClick={() => alterarQtdMaquina(m.id, -1)} style={{ width: 26, height: 26, border: `1px solid ${BORDER}`, borderRadius: 4, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={12} /></button>
                              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 22, textAlign: "center" }}>{escolhida.quantidade}</span>
                              <button type="button" onClick={() => alterarQtdMaquina(m.id, 1)} style={{ width: 26, height: 26, border: "none", borderRadius: 4, background: NAV, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={12} /></button>
                            </div>
                          </div>
                          {temPainel(m) ? (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                                Painel elétrico NR-12 <span style={{ color: "#dc2626" }}>*</span>
                              </div>
                              <div style={{ fontSize: 11, color: "#6b7b8d", margin: "2px 0 8px" }}>
                                Voltagem informada no checklist: {checklist.voltagem || "—"}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {OPCOES_PAINEL.map((op) => {
                                  const preco = op.valor === "sem" ? null : precoPainel(m, op.valor);
                                  const indisponivel = op.valor !== "sem" && preco == null;
                                  const ativo = escolhida.painel === op.valor;
                                  return (
                                    <button
                                      key={op.valor}
                                      type="button"
                                      disabled={indisponivel}
                                      onClick={() => { definirPainelMaquina(m.id, op.valor); setError(null); }}
                                      style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                        padding: "7px 10px", borderRadius: 6, fontSize: 12.5, textAlign: "left",
                                        border: `1.5px solid ${ativo ? BLUE : BORDER}`,
                                        background: indisponivel ? BG : "#fff",
                                        color: indisponivel ? "#9ca3af" : "#1a1a1a",
                                        fontWeight: ativo ? 700 : 500,
                                        cursor: indisponivel ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                        <span style={{
                                          width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                                          border: `2px solid ${ativo ? BLUE : "#cbd5e1"}`,
                                          background: ativo ? BLUE : "#fff",
                                          boxShadow: ativo ? "inset 0 0 0 2px #fff" : "none",
                                        }} />
                                        {op.label}
                                      </span>
                                      {op.valor !== "sem" && (
                                        <span style={{ whiteSpace: "nowrap", fontWeight: 700, color: indisponivel ? "#9ca3af" : NAV }}>
                                          {preco != null ? `+ ${formatCurrency(preco)}` : "sem preço"}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: 12, color: "#6b7b8d", marginTop: 4 }}>
                              Este item não tem preço de painel cadastrado — segue sem painel.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {maquinasFiltradas.length === 0 && (
                <p style={{ textAlign: "center", color: "#6b7b8d", fontSize: 13, padding: 24 }}>Nenhum equipamento encontrado.</p>
              )}
              {maquinasFiltradas.length > maquinasVisiveis && (
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <button type="button" onClick={() => setMaquinasVisiveis((n) => n + 60)} style={{ padding: "9px 18px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: NAV, cursor: "pointer" }}>
                    Mostrar mais ({maquinasFiltradas.length - maquinasVisiveis} restantes)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — ITENS ADICIONAIS */}
          {step === 4 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>Itens Adicionais</div>
              <div style={{ fontSize: 13, color: "#6b7b8d", marginBottom: 16 }}>Adicione quantas navalhas, peneiras e peças quiser, cada uma com a sua quantidade. Equipamentos (esteira, exaustor, silo...) escolha no passo anterior.</div>
              <input
                value={pecaSearch} onChange={(e) => { setPecaSearch(e.target.value); setPecasVisiveis(40); }}
                placeholder="Buscar peças por código ou descrição..."
                style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, marginBottom: 10 }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {TIPOS_PECA.map((t) => (
                  <button key={t.valor} type="button" onClick={() => { setPecaTipo(t.valor); setPecasVisiveis(40); }}
                    style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${pecaTipo === t.valor ? NAV : BORDER}`, background: pecaTipo === t.valor ? NAV : "#fff", color: pecaTipo === t.valor ? "#fff" : "#374151" }}>
                    {t.rotulo}
                  </button>
                ))}
                {cart.length > 0 && <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12, fontWeight: 600, color: NAV }}>{cart.length} {cart.length === 1 ? "item adicionado" : "itens adicionados"}</span>}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", border: `1px solid ${BORDER}` }}>
                <thead>
                  <tr style={{ background: NAV }}>
                    {["Código", "Descrição", "Preço", "IPI %", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "left", textTransform: "uppercase" as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pecasFiltradas.slice(0, pecasVisiveis).map((p) => {
                    const inCart = cart.find((i) => i.produto_id === p.id);
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 12, color: "#dc2626" }}>{p.codigo}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{p.descricao}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{formatCurrency(p.preco_brl ?? 0)}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7b8d" }}>{p.ipi_pct}%</td>
                        <td style={{ padding: "8px 12px" }}>
                          {inCart ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button onClick={() => updateQty(p.id, -1)} style={{ width: 24, height: 24, border: `1px solid ${BORDER}`, borderRadius: 4, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Minus size={12} />
                              </button>
                              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{inCart.quantidade}</span>
                              <button onClick={() => updateQty(p.id, 1)} style={{ width: 24, height: 24, border: "none", borderRadius: 4, background: NAV, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Plus size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(p)}
                              style={{ padding: "4px 12px", background: "#f0f4fa", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, color: NAV, cursor: "pointer", fontWeight: 600 }}
                            >
                              + Adicionar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pecasFiltradas.length === 0 && <p style={{ textAlign: "center", color: "#6b7b8d", fontSize: 13, padding: 20 }}>Nenhuma peça encontrada.</p>}
              {pecasFiltradas.length > pecasVisiveis && (
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <button type="button" onClick={() => setPecasVisiveis((n) => n + 40)} style={{ padding: "9px 18px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: NAV, cursor: "pointer" }}>
                    Mostrar mais ({pecasFiltradas.length - pecasVisiveis} restantes)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 5 — FINALIZAR */}
          {step === 5 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>Condições Comerciais</div>
              <div style={{ fontSize: 13, color: "#6b7b8d", marginBottom: 16 }}>Revise os itens e informe as condições da proposta.</div>
              <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: NAV, marginBottom: 10 }}>Organização comercial</div>
                <OrganizacaoComercialCampos valor={organizacao} onChange={setOrganizacao} clienteId={clienteId || null} propostasPrincipais={propostasPrincipais} representantes={representantes} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
                {[
                  { label: "Condição de Pagamento", value: condicao, set: setCondicao, placeholder: "ex: 30/60/90 dias", linhas: 4 },
                  { label: "Prazo de Entrega", value: prazo, set: setPrazo, placeholder: "ex: 90 dias úteis", linhas: 4 },
                ].map((f) => (
                  <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>{f.label}</label>
                    <textarea value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} rows={f.linhas}
                      style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
                  </div>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>Válida até</label>
                  <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)}
                    style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const }}>Observações</label>
                  <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Observações adicionais..."
                    style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, resize: "vertical" }} />
                </div>
              </div>

              {/* Resumo */}
              <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 12 }}>Resumo da Proposta</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: BG }}>
                      {["Descrição", "Qtd", "Preço tabela", "Desc. %", "Preço final", "Total"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, textAlign: "left", borderBottom: `1px solid ${BORDER}`, color: "#374151", textTransform: "uppercase" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allCartItems.map((item, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                          <div style={{ fontWeight: 600 }}>{item.descricao}</div>
                          {item.observacao && (
                            <div style={{ fontSize: 11.5, color: "#6b7b8d", marginTop: 3, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{item.observacao}</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right" }}>{item.quantidade}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", color: "#6b7b8d" }}>{formatCurrency(item.preco_unitario)}</td>
                        <td style={{ padding: "6px 8px", width: 84 }}>
                          <input
                            type="number" min={0} max={100} step={0.5}
                            value={item.desconto_pct ?? 0}
                            onChange={(e) => {
                              const v = Math.min(100, Math.max(0, Number(e.target.value.replace(",", ".")) || 0));
                              setDescontos((prev) => ({ ...prev, [item.produto_id]: v }));
                            }}
                            style={{ width: 68, padding: "6px 8px", border: `1px solid ${(item.desconto_pct ?? 0) > 0 ? "#16a34a" : BORDER}`, borderRadius: 6, fontSize: 13, textAlign: "center" }}
                          />
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", fontWeight: 600 }}>{formatCurrency(precoFinal(item))}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{formatCurrency(precoFinal(item) * item.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: "#6b7b8d" }}>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                      <span style={{ color: "#6b7b8d" }}>IPI estimado</span>
                      <span>{formatCurrency(ipiTotal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: NAV, borderTop: `2px solid ${NAV}`, paddingTop: 8 }}>
                      <span>TOTAL</span>
                      <span>{formatCurrency(subtotal + ipiTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  onClick={handleFinalizar}
                  disabled={isPending}
                  style={{
                    padding: "12px 28px", background: NAV, color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.7 : 1,
                  }}
                >
                  {isPending ? "Criando proposta..." : "Criar Proposta de Máquina"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div style={{
        width: 300, background: "#fff", borderLeft: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: NAV }}>
          Prévia da Proposta
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {/* Cliente */}
          {clienteId && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 4 }}>Cliente</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>
                {clientes.find((c) => c.id === clienteId)?.razao_social ?? "—"}
              </div>
            </div>
          )}

          {/* Checklist status */}
          <div style={{
            background: checklistCompleto ? "#f0fdf4" : "#fef9c3",
            border: `1px solid ${checklistCompleto ? "#86efac" : "#fde047"}`,
            borderRadius: 6, padding: "8px 12px", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Check size={14} color={checklistCompleto ? "#16a34a" : "#d97706"} />
            <span style={{ fontSize: 12, color: checklistCompleto ? "#15803d" : "#92400e" }}>
              {checklistCompleto ? "Checklist completo" : "Checklist pendente"}
            </span>
          </div>

          {/* Equipamentos */}
          {escolhidas.length > 0 && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8", textTransform: "uppercase" as const, marginBottom: 6 }}>
                Equipamentos ({escolhidas.length})
              </div>
              {escolhidas.map((e) => {
                const m = maquinas.find((x) => x.id === e.id);
                const item = itensMaquina.find((i) => i.produto_id === e.id);
                if (!m || !item) return null;
                const volt = e.painel === "220" || e.painel === "380" ? e.painel : null;
                const desconto = descontos[e.id] ?? 0;
                return (
                  <div key={e.id} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #bfdbfe" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f" }}>{e.quantidade > 1 ? `${e.quantidade}× ` : ""}{tituloComSeparador(m.codigo)}</div>
                    <div style={{ fontSize: 12, marginTop: 2, color: e.painel === null && temPainel(m) ? "#b45309" : "#6b7b8d", fontWeight: e.painel === null && temPainel(m) ? 600 : 400 }}>
                      {e.painel === null && temPainel(m) ? "Painel: escolher (com ou sem)" : volt ? `+ Painel NR-12 ${volt}V (incluso)` : "Sem painel"}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4, fontSize: 12 }}>
                      <span style={{ color: "#1e3a5f", fontWeight: 700 }}>Valor na proposta{desconto > 0 ? ` (−${desconto}%)` : ""}</span>
                      <span style={{ fontWeight: 800, color: NAV }}>{formatCurrency(precoComDesconto(item.preco_unitario, desconto) * item.quantidade)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Itens adicionais */}
          {cart.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7b8d", textTransform: "uppercase" as const, marginBottom: 6 }}>Peças / Acessórios ({cart.length})</div>
              {cart.map((item) => (
                <div key={item.produto_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#374151" }}>{item.descricao.slice(0, 28)}{item.descricao.length > 28 ? "…" : ""} ×{item.quantidade}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(precoComDesconto(item.preco_unitario, descontos[item.produto_id]) * item.quantidade)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          {allCartItems.length > 0 && (
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: NAV }}>
                <span>Total</span>
                <span>{formatCurrency(subtotal + ipiTotal)}</span>
              </div>
              <div style={{ fontSize: 11, color: "#6b7b8d", marginTop: 2 }}>Inclui IPI estimado</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

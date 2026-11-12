// Regras puras de kits de navalhas e de peneiras por modelo (sem banco, sem tela).
// É a ÚNICA fonte do cálculo do conjunto: a tela de Reajuste, o catálogo e as novas propostas usam estas funções.
// Dinheiro em centavos inteiros; o IPI é arredondado por linha do kit (como cada linha vira um item de proposta).
import { paraCentavos } from "./regras";

export type GrupoComponente = "fixa" | "rotora" | "outro";

/** Fixa ou rotora, a partir do texto cadastrado. O que não for claro fica "outro" e vai para revisão. */
export function classificarComponente(...textos: Array<string | null | undefined>): GrupoComponente {
  const t = textos.filter(Boolean).join(" ");
  if (/\bFIXAS?\b/i.test(t)) return /\bROT(OR|AT)/i.test(t) ? "outro" : "fixa"; // citou os dois: ambíguo
  if (/\bROT(ORAS?|ATIVAS?)\b/i.test(t)) return "rotora";
  return "outro";
}

// ─── Cálculo do conjunto ─────────────────────────────────────────────────────────────────────

export interface ComponenteEntrada {
  pecas: number;
  /** Preço unitário sem IPI, em reais; null = não cadastrado (nunca vira zero). */
  preco: number | null;
  ipi: number;
  grupo: GrupoComponente;
}

export type ProblemaKit = "sem_componentes" | "preco_incompleto" | "quantidade_invalida";

export interface CalculoKit {
  /** Subtotais sem IPI (qtd × unitário). null = não há componentes do grupo, ou falta preço nele. */
  subtotalFixas: number | null;
  subtotalRotoras: number | null;
  subtotalOutros: number | null;
  ipiValor: number | null;
  /** Total com IPI. null quando o kit está incompleto: nunca se mostra total parcial como completo. */
  total: number | null;
  /** Alíquota comum, "variavel" quando os componentes divergem, null se não há componentes. */
  aliquota: number | "variavel" | null;
  aliquotas: number[];
  problemas: ProblemaKit[];
  completo: boolean;
  temFixa: boolean;
  temRotora: boolean;
  temOutro: boolean;
}

const emReais = (centavos: number) => centavos / 100;

/** Total de uma linha com IPI, em centavos (mesmo arredondamento do total do conjunto). */
export function totalLinhaCentavos(pecas: number, preco: number, ipi: number): number {
  const linha = pecas * paraCentavos(preco);
  return Math.round((linha * (10000 + Math.round(ipi * 100))) / 10000);
}

/** Total de uma linha do kit com IPI, em reais; null sem preço ou com quantidade inválida. */
export function totalLinhaComIpi(pecas: number, preco: number | null, ipi: number): number | null {
  if (preco === null || !Number.isInteger(pecas) || pecas < 1) return null;
  return emReais(totalLinhaCentavos(pecas, preco, ipi));
}
const pecasValidas = (n: number) => Number.isInteger(n) && n >= 1;

export function calcularKit(componentes: ComponenteEntrada[]): CalculoKit {
  const problemas = new Set<ProblemaKit>();
  if (componentes.length === 0) problemas.add("sem_componentes");

  const sub: Record<GrupoComponente, number> = { fixa: 0, rotora: 0, outro: 0 };
  const faltaPreco: Record<GrupoComponente, boolean> = { fixa: false, rotora: false, outro: false };
  const tem: Record<GrupoComponente, boolean> = { fixa: false, rotora: false, outro: false };
  let totalCentavos = 0;
  let subtotalCentavos = 0;
  const aliquotas = new Set<number>();

  for (const c of componentes) {
    tem[c.grupo] = true;
    aliquotas.add(Math.round(c.ipi * 100) / 100);
    if (!pecasValidas(c.pecas)) { problemas.add("quantidade_invalida"); faltaPreco[c.grupo] = true; continue; }
    if (c.preco === null || c.preco === undefined || !Number.isFinite(c.preco) || c.preco < 0) {
      problemas.add("preco_incompleto"); faltaPreco[c.grupo] = true; continue;
    }
    const linha = c.pecas * paraCentavos(c.preco);
    sub[c.grupo] += linha;
    subtotalCentavos += linha;
    totalCentavos += totalLinhaCentavos(c.pecas, c.preco, c.ipi);
  }

  const completo = problemas.size === 0;
  const grupo = (g: GrupoComponente) => (!tem[g] || faltaPreco[g] ? null : emReais(sub[g]));
  const lista = Array.from(aliquotas).sort((a, b) => a - b);
  return {
    subtotalFixas: grupo("fixa"), subtotalRotoras: grupo("rotora"), subtotalOutros: grupo("outro"),
    ipiValor: completo ? emReais(totalCentavos - subtotalCentavos) : null,
    total: completo ? emReais(totalCentavos) : null,
    aliquota: lista.length === 0 ? null : lista.length === 1 ? lista[0] : "variavel",
    aliquotas: lista, problemas: Array.from(problemas), completo,
    temFixa: tem.fixa, temRotora: tem.rotora, temOutro: tem.outro,
  };
}

export const PROBLEMA_ROTULO: Record<ProblemaKit, string> = {
  sem_componentes: "Kit incompleto",
  preco_incompleto: "Preço incompleto",
  quantidade_invalida: "Kit incompleto",
};

// ─── Ordenação natural ───────────────────────────────────────────────────────────────────────

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Compara textos tratando números como números: "PS 50" < "PS 100" < "PS 160". */
export function compararNatural(a: string, b: string): number {
  const ta = semAcento(a).toUpperCase().match(/\d+(?:[.,]\d+)?|\D+/g) ?? [];
  const tb = semAcento(b).toUpperCase().match(/\d+(?:[.,]\d+)?|\D+/g) ?? [];
  for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
    const x = ta[i], y = tb[i];
    const nx = /^\d/.test(x), ny = /^\d/.test(y);
    if (nx && ny) {
      const d = Number(x.replace(",", ".")) - Number(y.replace(",", "."));
      if (d !== 0) return d;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return ta.length - tb.length;
}

export interface ChaveModelo { familia: string; numero: number; resto: string }

/** "MGHS 800 A2" → família "MGHS", número 800, resto "A2". Sem número, vai depois dos numerados da família. */
export function chaveModelo(modelo: string): ChaveModelo {
  const t = semAcento(modelo).toUpperCase().trim();
  const m = t.match(/^([^\d]*?)\s*(\d+(?:[.,]\d+)?)?\s*(.*)$/);
  return { familia: (m?.[1] ?? t).trim(), numero: m?.[2] ? Number(m[2].replace(",", ".")) : Number.POSITIVE_INFINITY, resto: (m?.[3] ?? "").trim() };
}

export function compararModelos(a: string, b: string): number {
  const x = chaveModelo(a), y = chaveModelo(b);
  const f = compararNatural(x.familia, y.familia);
  if (f !== 0) return f;
  if (x.numero !== y.numero) return x.numero < y.numero ? -1 : 1;
  return compararNatural(x.resto, y.resto);
}

/** Família/modelo → número natural → variante/material → desempate estável. */
export function compararKits(a: { modelo: string; variante: string | null; id: string }, b: { modelo: string; variante: string | null; id: string }): number {
  return compararModelos(a.modelo, b.modelo) || compararNatural(a.variante ?? "", b.variante ?? "") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// ─── Situação e último reajuste do kit ───────────────────────────────────────────────────────

export type SituacaoKit = "sem_reajuste" | "parcial" | "atualizado" | "sem_preco" | "inativo";

/** Um kit só é "atualizado" quando TODAS as peças foram reajustadas; parte delas é "parcial". */
export function situacaoDoKit(kitAtivo: boolean, situacoes: Array<"sem_reajuste" | "parcial" | "atualizado" | "sem_preco" | "inativo">): SituacaoKit {
  if (!kitAtivo) return "inativo";
  const validas = situacoes.filter((s) => s !== "inativo");
  if (validas.length === 0) return situacoes.length === 0 ? "sem_preco" : "inativo";
  if (validas.some((s) => s === "sem_preco")) return "sem_preco";
  if (validas.every((s) => s === "atualizado")) return "atualizado";
  if (validas.every((s) => s === "sem_reajuste")) return "sem_reajuste";
  return "parcial";
}

export interface UltimoDoKit { data: string; codigo: string; reajustados: number; total: number }

/** Reajuste de preço-base mais recente entre as peças; informa quantas peças têm reajuste registrado. */
export function ultimoReajusteDoKit(pecas: Array<{ codigo: string; ultimo: { data: string } | null }>): UltimoDoKit | null {
  let melhor: { data: string; codigo: string } | null = null;
  let n = 0;
  for (const p of pecas) {
    if (!p.ultimo) continue;
    n++;
    if (!melhor || p.ultimo.data > melhor.data) melhor = { data: p.ultimo.data, codigo: p.codigo };
  }
  return melhor ? { ...melhor, reajustados: n, total: pecas.length } : null;
}

// ─── Seleção para reajuste ───────────────────────────────────────────────────────────────────

export type AlcanceKit = "ambos" | "fixas" | "rotoras";

export function grupoEntra(grupo: GrupoComponente, alcance: AlcanceKit): boolean {
  return alcance === "ambos" ? true : alcance === "fixas" ? grupo === "fixa" : grupo === "rotora";
}

export interface KitParaSelecao { id: string; modelo: string; variante: string | null; componentes: Array<{ produtoId: string; codigo: string; grupo: GrupoComponente; ativo: boolean; compartilhadoCom: Array<{ kitId: string; rotulo: string }> }> }

/** Produtos a reajustar (cada produto uma única vez) e kits FORA da seleção que usam essas peças. */
export function planoDeSelecao(kits: KitParaSelecao[], alcance: AlcanceKit) {
  const ids = new Set<string>();
  const selecionados = new Set(kits.map((k) => k.id));
  const impactados = new Map<string, string>();
  const pecasCompartilhadas = new Set<string>();
  for (const k of kits) {
    for (const c of k.componentes) {
      if (!grupoEntra(c.grupo, alcance) || !c.ativo) continue;
      ids.add(c.produtoId);
      for (const o of c.compartilhadoCom) {
        if (selecionados.has(o.kitId)) continue;
        impactados.set(o.kitId, o.rotulo);
        pecasCompartilhadas.add(c.produtoId);
      }
    }
  }
  return { produtoIds: Array.from(ids), kitsImpactados: Array.from(impactados.values()), pecasCompartilhadas: pecasCompartilhadas.size };
}

// ─── Peneiras ────────────────────────────────────────────────────────────────────────────────

export interface AtributosPeneira { furo: number | null; largura: number | null; comprimento: number | null; espessura: number | null; texto: string }

const numeroDe = (t: string | null | undefined): number | null => {
  const m = (t ?? "").match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : null;
};

/** Lê, dos campos já cadastrados, o furo (Ø), as dimensões (A x B) e a espessura. O que não aparece fica vazio. */
export function atributosPeneira(descricao: string | null, furoDiametro: string | null): AtributosPeneira {
  const d = descricao ?? "";
  const dim = d.match(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
  const esp = d.match(/ESP(?:ESSURA|\.)?\s*:?\s*(\d+(?:[.,]\d+)?)/i);
  const furo = numeroDe(furoDiametro) ?? numeroDe(d.match(/[ØO⌀]\s*(\d+(?:[.,]\d+)?)/)?.[0]);
  const largura = dim ? Number(dim[1].replace(",", ".")) : null;
  const comprimento = dim ? Number(dim[2].replace(",", ".")) : null;
  const espessura = esp ? Number(esp[1].replace(",", ".")) : null;
  const partes = [
    furo !== null ? `Ø ${furo} mm` : null,
    largura !== null && comprimento !== null ? `${largura} x ${comprimento}` : null,
    espessura !== null ? `esp. ${espessura}` : null,
  ].filter(Boolean) as string[];
  return { furo, largura, comprimento, espessura, texto: partes.join(" · ") };
}

const cmp = (a: number | null, b: number | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b); // vazio vai para o fim

/** Furo → dimensões → espessura (todos numéricos) → código natural. */
export function compararPeneiras(
  a: { attrs: AtributosPeneira; codigo: string; id: string }, b: { attrs: AtributosPeneira; codigo: string; id: string }
): number {
  return cmp(a.attrs.furo, b.attrs.furo) || cmp(a.attrs.largura, b.attrs.largura) || cmp(a.attrs.comprimento, b.attrs.comprimento)
    || cmp(a.attrs.espessura, b.attrs.espessura) || compararNatural(a.codigo, b.codigo) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// ─── IPI ─────────────────────────────────────────────────────────────────────────────────────

/** Percentual de IPI: 0 a 100, até 2 casas, aceita vírgula. "0" é válido; vazio não. */
export function parseIpiNavalha(texto: unknown): { valor: number; erro?: undefined } | { erro: string; valor?: undefined } {
  const t = String(texto ?? "").trim().replace("%", "").trim();
  if (t === "") return { erro: "Informe o IPI." };
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  if (!Number.isFinite(n)) return { erro: "IPI inválido." };
  if (n < 0 || n > 100) return { erro: "O IPI deve ficar entre 0% e 100%." };
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return { erro: "Use no máximo 2 casas decimais." };
  return { valor: Math.round(n * 100) / 100 };
}


/** Padrão de IPI das navalhas, por determinação do usuário (não é conclusão fiscal). */
export const IPI_PADRAO_NAVALHAS = 5.2;

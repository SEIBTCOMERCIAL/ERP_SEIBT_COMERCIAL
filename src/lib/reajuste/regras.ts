// Regras de reajuste de preços num só lugar: usadas pela prévia, pela gravação, pelos indicadores e pela listagem.
// Sem dependências de servidor nem de navegador (roda em testes simples do Node).
//
// Dinheiro: os cálculos usam centavos inteiros (BigInt no percentual), então a prévia mostrada na tela
// e o valor gravado no banco são sempre idênticos.

export type ComponenteId = "moinho" | "painel_220" | "painel_380" | "peca";
export type TipoProduto = "maquina" | "peca";
export type ColunaPreco = "preco_brl" | "preco_painel_220" | "preco_painel_380";

/** Colunas permitidas por componente. O navegador nunca escolhe o nome da coluna. */
export const COMPONENTES: Record<ComponenteId, { coluna: ColunaPreco; rotulo: string; curto: string }> = {
  moinho: { coluna: "preco_brl", rotulo: "Máquina", curto: "Máquina" },
  painel_220: { coluna: "preco_painel_220", rotulo: "Painel 220 V", curto: "220 V" },
  painel_380: { coluna: "preco_painel_380", rotulo: "Painel 380 V", curto: "380 V" },
  peca: { coluna: "preco_brl", rotulo: "Preço da peça", curto: "Preço" },
};

export const COMPONENTES_MAQUINA: ComponenteId[] = ["moinho", "painel_220", "painel_380"];

export function ehComponente(valor: unknown): valor is ComponenteId {
  return typeof valor === "string" && Object.prototype.hasOwnProperty.call(COMPONENTES, valor);
}

export function componentesDoTipo(tipo: TipoProduto): ComponenteId[] {
  return tipo === "maquina" ? COMPONENTES_MAQUINA : ["peca"];
}

export function componenteValidoPara(tipo: TipoProduto, componente: ComponenteId): boolean {
  return componentesDoTipo(tipo).includes(componente);
}

// ─── Números digitados ──────────────────────────────────────────────────────────

type Resultado = { valor: number; erro?: undefined } | { valor?: undefined; erro: string };

/** Aceita "10", "10,5", "-3,25", "+4", "7%" e "1.234,56". */
function normalizarNumero(entrada: string): string {
  let t = entrada.trim().replace(/\s+/g, "").replace(/%$/, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // 1.234 → milhar
  return t;
}

export function parsePercentual(entrada: string | number | null | undefined): Resultado {
  if (entrada === null || entrada === undefined || entrada === "") return { erro: "Informe o percentual." };
  if (typeof entrada === "number") {
    if (!Number.isFinite(entrada)) return { erro: "Percentual inválido." };
    return validarPercentual(entrada);
  }
  const t = normalizarNumero(entrada);
  if (!/^[+-]?\d+(\.\d{1,4})?$/.test(t)) return { erro: "Percentual inválido. Use números, com vírgula nos decimais (até 4 casas)." };
  return validarPercentual(Number(t));
}

function validarPercentual(n: number): Resultado {
  if (!Number.isFinite(n)) return { erro: "Percentual inválido." };
  if (n <= -100) return { erro: "O percentual deixaria o preço zerado ou negativo." };
  if (Math.round(n * 10000) / 10000 !== n) return { erro: "Use no máximo 4 casas decimais no percentual." };
  return { valor: n };
}

export function parseMoeda(entrada: string | number | null | undefined): Resultado {
  if (entrada === null || entrada === undefined || entrada === "") return { erro: "Informe o valor." };
  if (typeof entrada === "number") {
    if (!Number.isFinite(entrada)) return { erro: "Valor inválido." };
    return validarMoeda(entrada);
  }
  const t = normalizarNumero(entrada.replace(/^R\$\s*/i, ""));
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { erro: "Valor inválido. Use números, com vírgula nos centavos (até 2 casas)." };
  return validarMoeda(Number(t));
}

/** Preço de cadastro: vazio = não informado (null); zero é um valor informado; aceita vírgula e milhar. */
export function parseMoedaOpcional(entrada: string | number | null | undefined): { valor: number | null; erro?: undefined } | { valor?: undefined; erro: string } {
  if (entrada === null || entrada === undefined) return { valor: null };
  if (typeof entrada === "string" && entrada.trim() === "") return { valor: null };
  const n = typeof entrada === "number" ? entrada : (() => {
    const t = normalizarNumero(entrada.replace(/^R\$\s*/i, ""));
    return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : Number.NaN;
  })();
  if (!Number.isFinite(n)) return { erro: "Valor inválido. Use números, com vírgula nos centavos (até 2 casas)." };
  if (n < 0) return { erro: "O preço não pode ser negativo." };
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return { erro: "Use no máximo 2 casas decimais (centavos)." };
  return { valor: Math.round(n * 100) / 100 };
}

function validarMoeda(n: number): Resultado {
  if (!Number.isFinite(n)) return { erro: "Valor inválido." };
  if (n <= 0) return { erro: "O novo preço deve ser maior que zero." };
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return { erro: "Use no máximo 2 casas decimais (centavos)." };
  return { valor: Math.round(n * 100) / 100 };
}

// ─── Cálculos monetários (centavos) ─────────────────────────────────────────────

export function paraCentavos(reais: number): number {
  return Math.round(reais * 100);
}

/** Divisão inteira exata (piso matemático) para números inteiros seguros. */
function divisaoInteira(n: number, d: number): number {
  let q = Math.floor(n / d);
  while (q * d > n) q--;
  while ((q + 1) * d <= n) q++;
  return q;
}

/** Novo preço = preço × (1 + percentual/100), arredondado ao centavo (meio centavo sobe). Só usa inteiros. */
export function aplicarPercentual(precoAtual: number, percentual: number): number {
  const centavos = paraCentavos(precoAtual);
  const ppm = Math.round(percentual * 10_000); // 1% = 10.000
  // delta = centavos × ppm / 1.000.000, em duas partes para não perder precisão em valores grandes.
  const milhares = divisaoInteira(centavos, 1000);
  const resto = centavos - milhares * 1000;
  const parcial = divisaoInteira(resto * ppm + 500_000, 1000);
  const delta = divisaoInteira(milhares * ppm + parcial, 1000);
  return (centavos + delta) / 100;
}

/** Variação em %, com 2 casas, arredondando como o banco (meio sobe em módulo). Null se o preço anterior é zero. */
export function variacaoPercentual(anterior: number, novo: number): number | null {
  const a = paraCentavos(anterior);
  if (a <= 0) return null;
  const n = paraCentavos(novo);
  const num = (n - a) * 10_000;
  const absNum = Math.abs(num);
  const r = divisaoInteira(absNum * 2 + a, 2 * a);
  return (num < 0 ? -r : r) / 100;
}

// ─── Datas (fuso de Brasília) ───────────────────────────────────────────────────

export const FUSO = "America/Sao_Paulo";

export function hojeSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export function inicioDoAno(hoje: string): string {
  return `${hoje.slice(0, 4)}-01-01`;
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

// ─── Situação do reajuste ───────────────────────────────────────────────────────

export type Situacao = "sem_preco" | "sem_reajuste" | "parcial" | "atualizado";
export type SituacaoItem = Situacao | "inativo";

export const SITUACAO_ROTULO: Record<SituacaoItem, string> = {
  sem_preco: "Sem preço cadastrado",
  sem_reajuste: "Sem reajuste no período",
  parcial: "Parcialmente reajustado",
  atualizado: "Reajustado",
  inativo: "Inativo",
};

export interface PrecosDoItem {
  tipo: TipoProduto;
  preco_brl: number | null;
  preco_painel_220: number | null;
  preco_painel_380: number | null;
}

/** Componentes que existem para o item: os que têm preço cadastrado (zero conta como informado). */
export function componentesAplicaveis(item: PrecosDoItem): ComponenteId[] {
  return componentesDoTipo(item.tipo).filter((c) => item[COMPONENTES[c].coluna] !== null && item[COMPONENTES[c].coluna] !== undefined);
}

export interface RegistroHistoricoMin {
  componente: string | null;
  data_reajuste: string;
  /** Vazio (null) = preço inicial do cadastro, que não conta como reajuste. */
  preco_anterior_brl?: number | null;
}

/** Registros sem componente: em máquinas valem para a máquina; em peças, para o preço da peça. */
function componenteDoRegistro(tipo: TipoProduto, componente: string | null): ComponenteId | null {
  if (!componente) return tipo === "maquina" ? "moinho" : "peca";
  return ehComponente(componente) ? componente : null;
}

export interface PeriodoReajuste { inicio: string; fim: string }

export function periodoDoAno(hoje: string): PeriodoReajuste {
  return { inicio: inicioDoAno(hoje), fim: hoje };
}

/** Só conta reajuste já em vigor dentro do período (data futura não vale como atualizado). */
export function situacaoDoItem(item: PrecosDoItem, historico: RegistroHistoricoMin[], periodo: PeriodoReajuste) {
  const aplicaveis = componentesAplicaveis(item);
  if (aplicaveis.length === 0) {
    return { situacao: "sem_preco" as Situacao, reajustados: [] as ComponenteId[], pendentes: [] as ComponenteId[], aplicaveis };
  }
  const feitos = new Set<ComponenteId>();
  for (const h of historico) {
    if (h.preco_anterior_brl === null) continue; // preço inicial do cadastro não é reajuste
    const d = h.data_reajuste.slice(0, 10);
    if (d < periodo.inicio || d > periodo.fim) continue;
    const c = componenteDoRegistro(item.tipo, h.componente);
    if (c) feitos.add(c);
  }
  const reajustados = aplicaveis.filter((c) => feitos.has(c));
  const pendentes = aplicaveis.filter((c) => !feitos.has(c));
  const situacao: Situacao = reajustados.length === 0 ? "sem_reajuste" : pendentes.length === 0 ? "atualizado" : "parcial";
  return { situacao, reajustados, pendentes, aplicaveis };
}

// ─── Planejamento do reajuste (usado na prévia e na confirmação) ────────────────

export interface ProdutoParaReajuste extends PrecosDoItem {
  id: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
  excluido: boolean;
}

/** Um componente de um produto a reajustar: ou por percentual ou por novo valor. */
export interface EntradaReajuste {
  produto_id: string;
  componente: ComponenteId;
  /** Preço que o usuário viu na prévia; serve para detectar alteração concorrente. */
  esperado?: number | null;
  percentual?: number | null;
  novo?: number | null;
}

export type MotivoIgnorado = "nao_encontrado" | "excluido" | "inativo" | "sem_preco" | "sem_alteracao";

export const MOTIVO_IGNORADO_TEXTO: Record<MotivoIgnorado, string> = {
  nao_encontrado: "produto não encontrado",
  excluido: "produto excluído",
  inativo: "produto inativo",
  sem_preco: "sem preço cadastrado",
  sem_alteracao: "o novo preço é igual ao atual",
};

export interface ItemPlanejado {
  produto_id: string;
  codigo: string;
  descricao: string;
  componente: ComponenteId;
  atual: number;
  novo: number;
  diferenca: number;
  percentual: number | null;
}

export interface ItemIgnorado {
  produto_id: string;
  codigo: string | null;
  descricao: string | null;
  componente: ComponenteId;
  motivo: MotivoIgnorado;
}

export interface ConflitoPreco {
  produto_id: string;
  codigo: string;
  componente: ComponenteId;
  esperado: number;
  atual: number;
}

export interface PlanoReajuste {
  itens: ItemPlanejado[];
  ignorados: ItemIgnorado[];
  conflitos: ConflitoPreco[];
  erros: string[];
}

export function planejarReajuste(produtos: Map<string, ProdutoParaReajuste>, entradas: EntradaReajuste[]): PlanoReajuste {
  const plano: PlanoReajuste = { itens: [], ignorados: [], conflitos: [], erros: [] };
  const vistos = new Set<string>();

  for (const e of entradas) {
    const chave = `${e.produto_id}:${e.componente}`;
    if (vistos.has(chave)) { plano.erros.push("Há itens repetidos na solicitação."); continue; }
    vistos.add(chave);

    if (!ehComponente(e.componente)) { plano.erros.push("Componente de preço inválido."); continue; }
    const temPct = e.percentual !== null && e.percentual !== undefined;
    const temNovo = e.novo !== null && e.novo !== undefined;
    if (temPct === temNovo) { plano.erros.push("Informe o percentual ou o novo valor (apenas um)."); continue; }

    const p = produtos.get(e.produto_id);
    const base = { produto_id: e.produto_id, codigo: p?.codigo ?? null, descricao: p?.descricao ?? null, componente: e.componente };
    if (!p) { plano.ignorados.push({ ...base, motivo: "nao_encontrado" }); continue; }
    if (p.excluido) { plano.ignorados.push({ ...base, motivo: "excluido" }); continue; }
    if (!componenteValidoPara(p.tipo, e.componente)) { plano.erros.push(`O componente "${COMPONENTES[e.componente].rotulo}" não existe para ${p.codigo}.`); continue; }
    if (!p.ativo) { plano.ignorados.push({ ...base, motivo: "inativo" }); continue; }

    const atual = p[COMPONENTES[e.componente].coluna];
    if (atual === null || atual === undefined) { plano.ignorados.push({ ...base, motivo: "sem_preco" }); continue; }

    if (e.esperado !== null && e.esperado !== undefined && paraCentavos(e.esperado) !== paraCentavos(atual)) {
      plano.conflitos.push({ produto_id: p.id, codigo: p.codigo, componente: e.componente, esperado: e.esperado, atual });
      continue;
    }

    let novo: number;
    if (temPct) {
      const pct = parsePercentual(e.percentual as number);
      if (pct.erro !== undefined) { plano.erros.push(pct.erro); continue; }
      novo = aplicarPercentual(atual, pct.valor);
    } else {
      const v = parseMoeda(e.novo as number);
      if (v.erro !== undefined) { plano.erros.push(v.erro); continue; }
      novo = v.valor;
    }
    if (paraCentavos(novo) === paraCentavos(atual)) { plano.ignorados.push({ ...base, motivo: "sem_alteracao" }); continue; }
    if (novo <= 0) { plano.erros.push(`O novo preço de ${p.codigo} ficaria zerado ou negativo.`); continue; }

    plano.itens.push({
      produto_id: p.id, codigo: p.codigo, descricao: p.descricao, componente: e.componente,
      atual, novo, diferenca: Math.round((novo - atual) * 100) / 100, percentual: variacaoPercentual(atual, novo),
    });
  }
  return plano;
}

export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 200;

export function validarMotivo(motivo: unknown): { valor: string; erro?: undefined } | { valor?: undefined; erro: string } {
  if (typeof motivo !== "string") return { erro: "Informe o motivo do reajuste." };
  const t = motivo.trim().replace(/\s+/g, " ");
  if (t.length < MOTIVO_MINIMO) return { erro: `Informe o motivo do reajuste (mínimo ${MOTIVO_MINIMO} caracteres).` };
  if (t.length > MOTIVO_MAXIMO) return { erro: `O motivo pode ter no máximo ${MOTIVO_MAXIMO} caracteres.` };
  return { valor: t };
}

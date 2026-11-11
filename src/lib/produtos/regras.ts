// Regras de Produtos num só lugar: validação de entradas, ficha técnica, arquivos, pendências e filtros da tela.
// Sem dependências de servidor nem de navegador (roda em testes simples do Node).
import { paraCentavos, parseMoedaOpcional } from "../reajuste/regras";

export { parseMoedaOpcional };

// ─── Situação (padronizada) ─────────────────────────────────────────────────────

export type SituacaoProduto = "ativo" | "descontinuado" | "inativo" | "excluido";

export const SITUACAO_PRODUTO_ROTULO: Record<SituacaoProduto, string> = {
  ativo: "Ativo", descontinuado: "Descontinuado", inativo: "Inativo", excluido: "Excluído",
};

/** excluído (deleted_at) > descontinuado (status) > inativo (ativo=false, marca antiga) > ativo. */
export function situacaoDoProduto(p: { status?: string | null; ativo?: boolean | null; deleted_at?: string | null }): SituacaoProduto {
  if (p.deleted_at) return "excluido";
  if (p.status === "descontinuado") return "descontinuado";
  if (p.ativo === false) return "inativo";
  return "ativo";
}

// ─── Números e textos digitados ─────────────────────────────────────────────────

type Res<T> = { valor: T; erro?: undefined } | { valor?: undefined; erro: string };

export const QUANTIDADE_MAXIMA = 10_000;

/** Quantidade: inteiro de 1 a 10.000 (sem decimais, sem texto). */
export function parseQuantidade(entrada: unknown): Res<number> {
  const t = typeof entrada === "number" ? String(entrada) : typeof entrada === "string" ? entrada.trim() : "";
  if (!/^\d+$/.test(t)) return { erro: "A quantidade deve ser um número inteiro, sem decimais." };
  const n = Number(t);
  if (n < 1 || n > QUANTIDADE_MAXIMA) return { erro: `A quantidade deve estar entre 1 e ${QUANTIDADE_MAXIMA.toLocaleString("pt-BR")}.` };
  return { valor: n };
}

/** IPI em %: vazio = 0; vírgula nos decimais; de 0 a 100 com até 2 casas. */
export function parseIpi(entrada: unknown): Res<number> {
  if (entrada === null || entrada === undefined || (typeof entrada === "string" && entrada.trim() === "")) return { valor: 0 };
  const t = String(entrada).trim().replace(/%$/, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { erro: "IPI inválido. Use números, com vírgula nos decimais (até 2 casas)." };
  const n = Number(t);
  if (n > 100) return { erro: "O IPI deve estar entre 0 e 100%." };
  return { valor: n };
}

export function limparTexto(entrada: unknown, opcoes: { obrigatorio?: boolean; max?: number; rotulo: string }): Res<string | null> {
  const max = opcoes.max ?? 500;
  const t = typeof entrada === "string" ? entrada.replace(/\s+/g, " ").trim() : "";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(t)) return { erro: `${opcoes.rotulo} contém caracteres inválidos.` };
  if (!t) return opcoes.obrigatorio ? { erro: `${opcoes.rotulo} é obrigatório.` } : { valor: null };
  if (t.length > max) return { erro: `${opcoes.rotulo} pode ter no máximo ${max} caracteres.` };
  return { valor: t };
}

/** Texto longo (descrições do orçamento): preserva quebras de linha. */
export function limparTextoLongo(entrada: unknown, opcoes: { obrigatorio?: boolean; max?: number; rotulo: string }): Res<string | null> {
  const max = opcoes.max ?? 8000;
  const t = typeof entrada === "string" ? entrada.replace(/\r\n/g, "\n").trim() : "";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(t)) return { erro: `${opcoes.rotulo} contém caracteres inválidos.` };
  if (!t) return opcoes.obrigatorio ? { erro: `${opcoes.rotulo} é obrigatório.` } : { valor: null };
  if (t.length > max) return { erro: `${opcoes.rotulo} pode ter no máximo ${max} caracteres.` };
  return { valor: t };
}

export const ehUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ─── Ficha técnica ──────────────────────────────────────────────────────────────

export const SPEC_VALOR_MAXIMO = 200;

export interface AlteracaoSpecs {
  definir: Record<string, string>;
  remover: string[];
}

/**
 * Compara o que o formulário enviou com o que já está salvo. Só considera os campos que vieram no envio:
 * campo ausente = não mexe; campo enviado vazio = remoção explícita; valor igual = sem alteração.
 * Só aceita campos do modelo da linha (nome exato) e valores de texto curtos.
 */
export function diffSpecs(
  camposDaLinha: string[], atuais: Record<string, unknown> | null | undefined, enviados: Record<string, unknown>
): { erro: string } | (AlteracaoSpecs & { erro?: undefined }) {
  const definir: Record<string, string> = {};
  const remover: string[] = [];
  const permitidos = new Set(camposDaLinha);
  for (const [nome, bruto] of Object.entries(enviados)) {
    if (!permitidos.has(nome)) return { erro: `O campo "${nome}" não existe no modelo desta linha.` };
    if (typeof bruto !== "string") return { erro: `O valor de "${nome}" deve ser um texto.` };
    const valor = bruto.replace(/\s+/g, " ").trim();
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(valor)) return { erro: `O valor de "${nome}" contém caracteres inválidos.` };
    if (valor.length > SPEC_VALOR_MAXIMO) return { erro: `O valor de "${nome}" pode ter no máximo ${SPEC_VALOR_MAXIMO} caracteres.` };
    const anterior = atuais && Object.prototype.hasOwnProperty.call(atuais, nome) ? String(atuais[nome] ?? "").trim() : "";
    if (valor === anterior) continue;
    if (valor === "") remover.push(nome);
    else definir[nome] = valor;
  }
  return { definir, remover };
}

/** Pendência de ficha: campos do modelo da linha sem valor (campo que não existe na linha não conta). */
export function fichaIncompleta(total: number | null | undefined, preenchidos: number | null | undefined): boolean {
  return (total ?? 0) > 0 && (preenchidos ?? 0) < (total ?? 0);
}

export function camposFaltando(camposDaLinha: string[], specs: Record<string, unknown> | null | undefined): string[] {
  return camposDaLinha.filter((c) => !specs || String(specs[c] ?? "").trim() === "");
}

// ─── Totais de equipamento (painéis são opções, nunca somados entre si) ─────────

export function totaisComPainel(maquina: number | null | undefined, p220: number | null | undefined, p380: number | null | undefined) {
  const soma = (painel: number | null | undefined) =>
    maquina === null || maquina === undefined || painel === null || painel === undefined ? null : (paraCentavos(maquina) + paraCentavos(painel)) / 100;
  return { com220: soma(p220), com380: soma(p380) };
}

// ─── Arquivos ───────────────────────────────────────────────────────────────────

/** Limite efetivo: a hospedagem recusa requisições maiores que ~4,5 MB; 4 MB deixa folga para o restante do envio. */
export const LIMITE_UPLOAD_BYTES = 4 * 1024 * 1024;
export const LIMITE_UPLOAD_TEXTO = "4 MB";

export type FinalidadeArquivo = "imagem" | "documento";

const TIPOS: Record<string, { ext: string[]; mime: string; assinatura: (b: Uint8Array) => boolean }> = {
  jpeg: { ext: ["jpg", "jpeg"], mime: "image/jpeg", assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  png: { ext: ["png"], mime: "image/png", assinatura: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  webp: { ext: ["webp"], mime: "image/webp", assinatura: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  pdf: { ext: ["pdf"], mime: "application/pdf", assinatura: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d },
};

const PERMITIDOS: Record<FinalidadeArquivo, string[]> = { imagem: ["jpeg", "png", "webp"], documento: ["pdf", "jpeg", "png"] };

export function nomeSeguro(nome: string): string {
  const base = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/-+\./g, ".").replace(/^[-.]+|[-.]+$/g, "");
  return (base || "arquivo").slice(0, 80);
}

/** Confere tamanho, extensão, tipo informado e o conteúdo real (assinatura do arquivo). */
export function validarArquivo(
  arquivo: { nome: string; tipoMime: string; tamanho: number; inicio: Uint8Array }, finalidade: FinalidadeArquivo
): { erro: string } | { erro?: undefined; ext: string; mime: string; chave: string } {
  if (!arquivo.tamanho || arquivo.tamanho <= 0) return { erro: "Escolha um arquivo." };
  if (arquivo.tamanho > LIMITE_UPLOAD_BYTES) return { erro: `O arquivo passa do limite de ${LIMITE_UPLOAD_TEXTO}. Reduza o tamanho e tente de novo.` };
  const ext = (arquivo.nome.split(".").pop() ?? "").toLowerCase();
  const chave = PERMITIDOS[finalidade].find((k) => TIPOS[k].ext.includes(ext));
  const permitidos = PERMITIDOS[finalidade].map((k) => TIPOS[k].ext[0].toUpperCase()).join(", ");
  if (!chave) return { erro: `Formato não permitido. Use: ${permitidos}.` };
  const tipo = TIPOS[chave];
  if (arquivo.tipoMime && arquivo.tipoMime !== tipo.mime && !(chave === "jpeg" && arquivo.tipoMime === "image/jpg")) {
    return { erro: "O tipo do arquivo não corresponde à extensão." };
  }
  if (!tipo.assinatura(arquivo.inicio)) return { erro: "O conteúdo do arquivo não corresponde ao formato informado." };
  return { ext: tipo.ext[0], mime: tipo.mime, chave };
}

// ─── Pendências (para a listagem) ───────────────────────────────────────────────

export interface ResumoPendencias {
  sem_foto?: boolean; sem_preco?: boolean; ficha_total?: number | null; ficha_preenchidos?: number | null; sem_vinculo?: boolean;
  categoria?: string | null;
}

export function listarPendencias(r: ResumoPendencias): string[] {
  const p: string[] = [];
  if (r.categoria === "maquina") {
    if (r.sem_preco) p.push("preço");
    if (r.sem_foto) p.push("foto");
    if (fichaIncompleta(r.ficha_total, r.ficha_preenchidos)) p.push(`ficha técnica (${r.ficha_preenchidos ?? 0}/${r.ficha_total})`);
  } else {
    if (r.sem_preco) p.push("preço");
    if (r.sem_vinculo) p.push("sem equipamento vinculado");
  }
  return p;
}

// ─── Filtros da página (guardados na URL: voltar do detalhe restaura a tela) ────

export type Aba = "maquinas" | "pecas";
export type FiltroSituacao = "ativos" | "descontinuados" | "todos";
export type FiltroPendencia = "" | "sem_foto" | "sem_preco" | "ficha_incompleta" | "sem_vinculo";
export type Ordem = "padrao" | "nome" | "codigo" | "preco" | "atualizado";
export type Visao = "tabela" | "cards";

export interface FiltrosProdutos {
  aba: Aba;
  escopo: string | null; // linha (máquinas) ou categoria (peças)
  q: string;
  situacao: FiltroSituacao;
  pendencia: FiltroPendencia;
  ordem: Ordem;
  dir: "asc" | "desc";
  pagina: number;
  visao: Visao;
}

export const TAMANHO_PAGINA_PRODUTOS = 24;

const um = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const entre = <T extends string>(v: string, validos: readonly T[], padrao: T): T => ((validos as readonly string[]).includes(v) ? (v as T) : padrao);

export function lerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosProdutos {
  const aba = entre(um(sp.aba), ["maquinas", "pecas"] as const, "maquinas");
  const escopoBruto = um(sp.escopo);
  const pagina = Number.parseInt(um(sp.pagina), 10);
  return {
    aba,
    escopo: ehUuid(escopoBruto) ? escopoBruto : null,
    q: sanitizarBusca(um(sp.q)),
    situacao: entre(um(sp.situacao), ["ativos", "descontinuados", "todos"] as const, "ativos"),
    pendencia: entre(um(sp.pendencia), ["", "sem_foto", "sem_preco", "ficha_incompleta", "sem_vinculo"] as const, ""),
    ordem: entre(um(sp.ordem), ["padrao", "nome", "codigo", "preco", "atualizado"] as const, "padrao"),
    dir: um(sp.dir) === "desc" ? "desc" : "asc",
    pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 10_000) : 1,
    visao: entre(um(sp.visao), ["tabela", "cards"] as const, "tabela"),
  };
}

/** Remove caracteres que quebram filtros do PostgREST e limita o tamanho. */
export function sanitizarBusca(t: string): string {
  return t.replace(/[,()%*\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function montarQuery(f: Partial<FiltrosProdutos>): string {
  const p = new URLSearchParams();
  if (f.aba && f.aba !== "maquinas") p.set("aba", f.aba);
  if (f.escopo) p.set("escopo", f.escopo);
  if (f.q) p.set("q", f.q);
  if (f.situacao && f.situacao !== "ativos") p.set("situacao", f.situacao);
  if (f.pendencia) p.set("pendencia", f.pendencia);
  if (f.ordem && f.ordem !== "padrao") p.set("ordem", f.ordem);
  if (f.dir === "desc") p.set("dir", "desc");
  if (f.pagina && f.pagina > 1) p.set("pagina", String(f.pagina));
  if (f.visao && f.visao !== "tabela") p.set("visao", f.visao);
  const t = p.toString();
  return t ? `?${t}` : "";
}

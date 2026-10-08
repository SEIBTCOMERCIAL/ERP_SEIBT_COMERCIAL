// Geração da proposta em Word a partir dos MODELOS oficiais da SEIBT, cópias dos
// .doc de REFERENCIAS/TEMPLATES_WORD com os campos marcados entre chaves:
//   templates/proposta-maquina.docx  ← PROPOSTA MÁQUINA 2026
//   templates/proposta-navalhas.docx ← PROPOSTA NAVALHAS 2026
//   templates/proposta-pecas.docx    ← PROPOSTA PENEIRAS 2026 (= PROPOSTA PEÇAS 2026)
// Só roda no servidor.

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { iniciaisAssinatura } from "./descritivo-maquina";

export type ModeloProposta = "maquina" | "navalhas" | "pecas";

export const ARQUIVO_MODELO: Record<ModeloProposta, string> = {
  maquina: "proposta-maquina.docx",
  navalhas: "proposta-navalhas.docx",
  pecas: "proposta-pecas.docx",
};

export interface ItemDocx {
  /** Título do item (usado quando não há texto de descrição). */
  titulo: string;
  /** Texto completo da coluna DETALHES (descrição do moinho + painel). */
  texto: string | null;
  /** Equipamento: o texto sai completo (descrição + tabela de especificações). */
  completo: boolean;
  /** Item principal da proposta (o moinho): único que recebe a nota e a observação de NR-12 do modelo. */
  maquina: boolean;
  quantidade: number;
  /** Preço de tabela (antes do desconto/acréscimo) — usado só na versão interna. */
  precoTabela?: number | null;
  precoUnitario: number;
  ipiPct: number;
  total: number;
}

export interface DadosDocxProposta {
  numero: string;
  data: string;
  cliente: string;
  /** "CIDADE - UF" (modelos de máquina e peças). */
  endereco: string;
  /** Separados (modelo de navalhas). */
  cidade: string;
  estado: string;
  tratamento: string;
  contato: string;
  telefone: string;
  email: string;
  cc: string;
  checklist: {
    segmento: string;
    produto: string;
    material: string;
    dimensoes: string;
    granulometria: string;
    moagemSeco: string;
    abastecimento: string;
    producao: string;
    voltagem: string;
  };
  itens: ItemDocx[];
  condicaoPagamento: string;
  prazoEntrega: string;
  validade: string;
  responsavel: string;
}

// ── Formatação ────────────────────────────────────────────────────────────────

const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const doisDigitos = (n: number) => String(n).padStart(2, "0");

const percentual = (v: number) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

// ── Coluna DETALHES (conteúdo em Word montado a partir do texto) ─────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function rPr(negrito: boolean, tamanho = 20): string {
  return `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${negrito ? "<w:b/>" : ""}<w:sz w:val="${tamanho}"/><w:szCs w:val="${tamanho}"/></w:rPr>`;
}

function paragrafo(texto: string, negrito = false, extraPPr = "", tamanho = 20): string {
  const run = texto ? `<w:r>${rPr(negrito, tamanho)}<w:t xml:space="preserve">${esc(texto)}</w:t></w:r>` : "";
  return `<w:p><w:pPr><w:pStyle w:val="SemEspaamento"/>${extraPPr}${rPr(negrito, tamanho)}</w:pPr>${run}</w:p>`;
}

/** Tabelinha "Especificações Técnicas" no mesmo formato das propostas da SEIBT. */
function tabelaSpecs(titulo: string | null, linhas: [string, string][]): string {
  const borda = (lado: string) => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`;
  const bordas = ["top", "left", "bottom", "right", "insideH", "insideV"].map(borda).join("");
  const pSpec = (texto: string, alinhamento: string, negrito = false) =>
    paragrafo(texto, negrito, `<w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="${alinhamento}"/>`, 18);
  const celula = (largura: number, conteudo: string, extra = "") =>
    `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${extra}<w:vAlign w:val="center"/></w:tcPr>${conteudo}</w:tc>`;
  const linha = (conteudo: string) => `<w:tr><w:trPr><w:trHeight w:val="283"/></w:trPr>${conteudo}</w:tr>`;

  const cab = titulo
    ? linha(celula(4139, pSpec(titulo, "center", true), `<w:gridSpan w:val="2"/><w:shd w:val="clear" w:color="auto" w:fill="DBE5F1"/>`))
    : "";
  const corpo = linhas
    .map(([rotulo, valor]) => linha(celula(2551, pSpec(rotulo, "left")) + celula(1588, pSpec(valor, "right"))))
    .join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${bordas}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid><w:gridCol w:w="2551"/><w:gridCol w:w="1588"/></w:tblGrid>${cab}${corpo}</w:tbl>`;
}

const TITULO_SPECS = /^especifica[çc][õo]es\s+t[ée]cnicas:?$/i;
const temMinuscula = (s: string) => s !== s.toUpperCase();
const temLetra = (s: string) => s.toLowerCase() !== s.toUpperCase();

/**
 * Converte o texto do item em parágrafos do Word:
 * 1ª linha em negrito (título), linhas todas em maiúsculas em negrito,
 * linhas "rótulo<TAB>valor" viram a tabela de especificações técnicas,
 * linhas em branco repetidas viram uma só.
 */
function detalhesXml(texto: string): string {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  const blocos: string[] = [];
  let tituloFeito = false;
  let ultimaVazia = true;
  let i = 0;

  const vazia = () => {
    if (!ultimaVazia) blocos.push(paragrafo(""));
    ultimaVazia = true;
  };

  while (i < linhas.length) {
    const bruta = linhas[i]!;
    const l = bruta.trim();

    if (!l) { vazia(); i++; continue; }

    // Tabela de especificações (com ou sem o título "Especificações Técnicas")
    const ehTituloSpecs = TITULO_SPECS.test(l);
    let j = ehTituloSpecs ? i + 1 : i;
    if (ehTituloSpecs) while (j < linhas.length && !linhas[j]!.trim()) j++;
    if (j < linhas.length && linhas[j]!.includes("\t")) {
      const specs: [string, string][] = [];
      while (j < linhas.length && linhas[j]!.includes("\t")) {
        const [rotulo, ...resto] = linhas[j]!.split("\t");
        specs.push([rotulo!.trim(), resto.join(" ").trim()]);
        j++;
      }
      blocos.push(tabelaSpecs(ehTituloSpecs ? l : null, specs));
      ultimaVazia = false;
      tituloFeito = true;
      i = j;
      continue;
    }

    const negrito =
      !tituloFeito ||
      (temLetra(l) && !temMinuscula(l)) ||
      /^-\s*Valor Painel/i.test(l) ||
      ehTituloSpecs;
    blocos.push(paragrafo(l, negrito));
    tituloFeito = true;
    ultimaVazia = false;
    i++;
  }

  while (blocos.length && blocos[blocos.length - 1] === paragrafo("")) blocos.pop();
  // Uma célula de tabela no Word não pode terminar em tabela.
  if (!blocos.length || blocos[blocos.length - 1]!.startsWith("<w:tbl>")) blocos.push(paragrafo(""));
  return blocos.join("");
}

function rPrCor(negrito: boolean, cor?: string, tamanho = 20): string {
  return `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${negrito ? "<w:b/>" : ""}${cor ? `<w:color w:val="${cor}"/>` : ""}<w:sz w:val="${tamanho}"/><w:szCs w:val="${tamanho}"/></w:rPr>`;
}

function paragrafoTrechos(trechos: Array<{ texto: string; negrito: boolean; cor?: string }>): string {
  const runs = trechos
    .filter((t) => t.texto)
    .map((t) => `<w:r>${rPrCor(t.negrito, t.cor)}<w:t xml:space="preserve">${esc(t.texto)}</w:t></w:r>`)
    .join("");
  return `<w:p><w:pPr><w:pStyle w:val="SemEspaamento"/>${rPr(false)}</w:pPr>${runs}</w:p>`;
}

/** Linha de jogo de navalhas: "TÍTULO (COMPOSTO POR 03 PEÇAS) - CÓD. 79691", com o título em negrito,
 * o trecho entre parênteses normal e o código em vermelho, como nos modelos da SEIBT. */
const LINHA_COM_CODIGO = /^(.*?)(\s*\([^()]*\))?\s+-\s+(C[ÓO]D\.?\s+.+)$/i;

/** Peça/acessório: descrição + código em uma linha, e o complemento (se houver) abaixo. */
function itemSimplesXml(titulo: string, texto: string | null): string {
  const linhas = (texto ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const m = titulo.match(LINHA_COM_CODIGO);
  const principal = m
    ? paragrafoTrechos([
        { texto: m[1]!.trimEnd(), negrito: true },
        { texto: m[2] ?? "", negrito: false },
        { texto: " - ", negrito: true },
        { texto: m[3]!, negrito: true, cor: "FF0000" },
      ])
    : paragrafo(titulo);
  // Linhas de jogo de navalhas ganham uma linha em branco embaixo, como nos modelos da SEIBT.
  const respiro = m && m[2] ? [paragrafo("")] : [];
  return [principal, ...linhas.map((l) => paragrafo(l)), ...respiro].join("");
}

// ── Preenchimento do modelo ───────────────────────────────────────────────────

/** Marca o preço que vai destacado (amarelo) na versão interna; removida depois de aplicar o destaque. */
const MARCA_INTERNA = "\u00A7\u00A7";

const percentualAjuste = (v: number) =>
  `${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Preço da coluna PREÇO UNIT.: na versão interna, quando houve acréscimo ou desconto, mostra
 * "tabela / + 15% / final" (como no modelo INTERNO da SEIBT); na versão do cliente, só o preço final. */
function textoPreco(it: ItemDocx, interna: boolean): string {
  const tabela = Number(it.precoTabela ?? 0);
  if (!interna || !(tabela > 0) || Math.abs(tabela - it.precoUnitario) < 0.005) return dinheiro(it.precoUnitario);
  const pct = Math.round((it.precoUnitario / tabela - 1) * 10000) / 100;
  return `${MARCA_INTERNA}${dinheiro(tabela)}\n${pct > 0 ? "+" : "-"} ${percentualAjuste(pct)}\n${dinheiro(it.precoUnitario)}`;
}

/** Destaca em amarelo os preços marcados da versão interna (todas as linhas do parágrafo do preço). */
function destacarPrecosInternos(xml: string): string {
  const destacado = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g, (paragrafo) =>
    paragrafo.includes(MARCA_INTERNA)
      ? paragrafo.replace(/<\/w:rPr>/g, '<w:highlight w:val="yellow"/></w:rPr>')
      : paragrafo
  );
  return destacado.split(MARCA_INTERNA).join("");
}

export function gerarDocxProposta(modelo: Buffer, dados: DadosDocxProposta, opcoes: { interna?: boolean } = {}): Buffer {
  const doc = new Docxtemplater(new PizZip(modelo), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  const soma = dados.itens.reduce((s, it) => s + it.total, 0);

  doc.render({
    numero: dados.numero,
    data: dados.data,
    cliente: dados.cliente,
    endereco: dados.endereco,
    cidade: dados.cidade,
    estado: dados.estado,
    tratamento: dados.tratamento,
    contato: dados.contato,
    telefone: dados.telefone,
    email: dados.email,
    cc: dados.cc,
    segmento: dados.checklist.segmento,
    produto: dados.checklist.produto,
    material: dados.checklist.material,
    dimensoes: dados.checklist.dimensoes,
    granulometria: dados.checklist.granulometria,
    moagem_seco: dados.checklist.moagemSeco,
    abastecimento: dados.checklist.abastecimento,
    producao: dados.checklist.producao,
    voltagem: dados.checklist.voltagem,
    itens: dados.itens.map((it, idx) => ({
      item: doisDigitos(idx + 1),
      detalhes: it.completo
        ? (it.texto ? detalhesXml(it.texto) : paragrafo(it.titulo, true))
        : itemSimplesXml(it.titulo, it.texto),
      maquina: it.maquina,
      qtd: doisDigitos(it.quantidade),
      preco: textoPreco(it, Boolean(opcoes.interna)),
      ipi: percentual(it.ipiPct),
      total: dinheiro(it.total),
    })),
    subtotal: dinheiro(soma),
    total_geral: dinheiro(soma),
    condicao_pagamento: dados.condicaoPagamento,
    prazo_entrega: dados.prazoEntrega,
    validade: dados.validade,
    responsavel: dados.responsavel,
    iniciais: iniciaisAssinatura(dados.responsavel),
  });

  const zip = doc.getZip();
  if (opcoes.interna) {
    const xml = zip.file("word/document.xml")?.asText();
    if (xml) zip.file("word/document.xml", destacarPrecosInternos(xml));
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

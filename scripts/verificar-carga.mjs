/**
 * Confere o que foi gravado no ERP contra o catálogo exportado.
 * Somente leitura — não altera nada.
 */

import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const CAT = JSON.parse(fs.readFileSync(path.join(RAIZ, "export-catalogo/catalogo-completo.json"), "utf8"));
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const get = async (q) => (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${q}`, { headers: h })).json();

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const up = (s) => norm(s).toUpperCase();
const brl = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

/** O PostgREST devolve no máximo 1000 linhas por resposta — busca paginada. */
async function getTudo(tabela, select) {
  const todos = [];
  const passo = 1000;
  for (let inicio = 0; ; inicio += passo) {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${tabela}?select=${select}&order=codigo`, {
      headers: { ...h, Range: `${inicio}-${inicio + passo - 1}` },
    });
    const lote = await r.json();
    todos.push(...lote);
    if (lote.length < passo) return todos;
  }
}

const produtos = await getTudo("produtos", "id,codigo,categoria,modelo,descricao,preco_brl,preco_painel_220,preco_painel_380,ipi_pct,furo_diametro,linha,solicitar_engenharia,specs");
const porCodigo = new Map(produtos.map((p) => [p.codigo, p]));
console.log(`(produtos lidos do banco: ${produtos.length})`);

console.log("=".repeat(78));
console.log("CONFERENCIA DA CARGA — catálogo exportado × banco do ERP");
console.log("=".repeat(78));

let erros = 0;

// 1. Equipamentos: preços dos três componentes
console.log("\n1) EQUIPAMENTOS — preços máquina / painel 220 / painel 380");
let faltando = 0, divergentes = 0;
for (const e of CAT.equipamentos) {
  const cod = up(`${norm(e.modelo)} ${norm(e.descricao)}`);
  const p = porCodigo.get(cod);
  if (!p) { faltando++; continue; }
  const cmp = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) > 0.01;
  if (cmp(p.preco_brl, e.valor_maquina) || cmp(p.preco_painel_220, e.valor_painel_220) || cmp(p.preco_painel_380, e.valor_painel_380)) {
    if (divergentes < 5) console.log(`   DIVERGE ${cod}: banco ${brl(p.preco_brl)} × catálogo ${brl(e.valor_maquina)}`);
    divergentes++;
  }
}
console.log(`   ${CAT.equipamentos.length} no catálogo | ${faltando} não encontrados | ${divergentes} com preço divergente`);
erros += faltando + divergentes;

// 2. Peneiras: preço, IPI e diâmetro do furo
console.log("\n2) PENEIRAS — preço, IPI e diâmetro");
let penOk = 0, penFalta = 0, penDiv = 0;
for (const pen of CAT.peneiras) {
  const partes = norm(pen.furos_codigos).split("|").map((s) => s.trim()).filter((s) => s && !["—", "-", "/"].includes(s));
  for (const parte of partes) {
    const m = /^[ØøO]?\s*([\d.,]+)\s*[:\s]\s*(.+)$/.exec(parte);
    if (!m) continue;
    const cod = norm(m[2]);
    const p = porCodigo.get(cod);
    if (!p) { penFalta++; continue; }
    const ipiCat = parseFloat(String(pen.ipi).replace("%", "").replace(",", ".")) || 0;
    if (Math.abs(Number(p.preco_brl || 0) - pen.valor) > 0.01 || Math.abs(Number(p.ipi_pct || 0) - ipiCat) > 0.01) {
      if (penDiv < 5) console.log(`   DIVERGE cod ${cod} (${pen.modelo}): banco ${brl(p.preco_brl)}/ipi ${p.ipi_pct} × catálogo ${brl(pen.valor)}/ipi ${ipiCat}`);
      penDiv++;
    } else penOk++;
  }
}
console.log(`   ${penOk} conferem | ${penFalta} não encontradas | ${penDiv} divergentes`);
erros += penFalta + penDiv;

// 3. Navalhas
console.log("\n3) NAVALHAS — preço unitário");
let navOk = 0, navFalta = 0, navDiv = 0;
for (const n of CAT.navalhas) {
  if (n.id === "nav_9") continue;
  for (const [cod, valor] of [[n.cod_fixa, n.valor_fixa], [n.cod_rot, n.valor_rot]]) {
    const c = norm(cod);
    if (!c || ["/", "-", "—"].includes(c)) continue;
    const p = porCodigo.get(c);
    if (!p) { navFalta++; continue; }
    if (Math.abs(Number(p.preco_brl || 0) - valor) > 0.01) {
      if (navDiv < 5) console.log(`   DIVERGE cod ${c}: banco ${brl(p.preco_brl)} × catálogo ${brl(valor)}`);
      navDiv++;
    } else navOk++;
  }
}
console.log(`   ${navOk} conferem | ${navFalta} não encontradas | ${navDiv} divergentes`);
erros += navFalta + navDiv;

// 4. Reciclagem
console.log("\n4) RECICLAGEM");
let recOk = 0, recFalta = 0, recDiv = 0;
for (const r of CAT.reciclagem) {
  const cod = `REC-${String(r.id).replace(/\D/g, "").padStart(4, "0")}`;
  const p = porCodigo.get(cod);
  if (!p) { recFalta++; continue; }
  if (Math.abs(Number(p.preco_brl || 0) - r.valor) > 0.01) recDiv++; else recOk++;
}
console.log(`   ${recOk} conferem | ${recFalta} não encontrados | ${recDiv} divergentes`);
erros += recFalta + recDiv;

// 5. Máquinas sem preço viraram "solicitar engenharia"
const semPreco = produtos.filter((p) => p.categoria === "maquina" && !(Number(p.preco_brl) > 0));
const marcadas = semPreco.filter((p) => p.solicitar_engenharia).length;
console.log(`\n5) Máquinas sem preço: ${semPreco.length} | marcadas como "solicitar engenharia": ${marcadas}`);

// 6. Fichas técnicas
const comSpecs = produtos.filter((p) => p.categoria === "maquina" && p.specs).length;
console.log(`6) Máquinas com ficha técnica preenchida: ${comSpecs}`);

// 7. Produtos que já existiam antes da carga
const codigosCarga = new Set();
CAT.equipamentos.forEach((e) => codigosCarga.add(up(`${norm(e.modelo)} ${norm(e.descricao)}`)));
CAT.reciclagem.forEach((r) => codigosCarga.add(`REC-${String(r.id).replace(/\D/g, "").padStart(4, "0")}`));
CAT.navalhas.forEach((n) => { [n.cod_fixa, n.cod_rot].forEach((c) => c && codigosCarga.add(norm(c))); });
CAT.peneiras.forEach((p) => norm(p.furos_codigos).split("|").forEach((s) => {
  const m = /^[ØøO]?\s*([\d.,]+)\s*[:\s]\s*(.+)$/.exec(s.trim());
  if (m) codigosCarga.add(norm(m[2]));
}));
CAT.linhas_pepp.forEach((_, i) => codigosCarga.add(`PEPP-${String(i + 1).padStart(2, "0")}`));

const preExistentes = produtos.filter((p) => !codigosCarga.has(p.codigo));
console.log(`\n7) Produtos que já estavam no ERP antes desta carga: ${preExistentes.length}`);
preExistentes.slice(0, 12).forEach((p) => console.log(`   ${p.categoria.padEnd(11)} ${p.codigo.padEnd(16)} ${norm(p.descricao).slice(0, 44)}`));
if (preExistentes.length > 12) console.log(`   ... e mais ${preExistentes.length - 12}`);

console.log("\n" + "=".repeat(78));
console.log(erros === 0 ? "SEM DIVERGENCIAS entre o catálogo exportado e o banco." : `${erros} DIVERGENCIAS encontradas.`);
console.log("=".repeat(78));

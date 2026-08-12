/**
 * Confere o resultado da exportação contra o dado-base do index.html.
 *
 * Serve para provar que os overrides do Supabase foram realmente aplicados —
 * isto é, que exportar apenas o index.html traria preços desatualizados.
 *
 * Uso: node scripts/conferir-catalogo.mjs
 */

import fs from "fs";
import path from "path";

const CATALOGO = process.argv[2] || "C:/Users/felipe.molinos/Desktop/CATALOGO_SEIBT_INTERATIVO";
const EXPORT = process.argv[3] || path.join(process.cwd(), "export-catalogo");

const html = fs.readFileSync(path.join(CATALOGO, "index.html"), "utf8");
const exportado = JSON.parse(fs.readFileSync(path.join(EXPORT, "catalogo-completo.json"), "utf8"));

function extrairLiteral(nome) {
  const m = new RegExp(`(?:let|const|var) ${nome} = (\\[|\\{)`).exec(html);
  if (!m) return null;
  const inicio = m.index + m[0].length - 1;
  let nivel = 0, dentroStr = false, aspas = "", escape = false;
  for (let i = inicio; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (dentroStr) { if (c === aspas) dentroStr = false; continue; }
    if (c === '"' || c === "'" || c === "`") { dentroStr = true; aspas = c; continue; }
    if (c === "[" || c === "{") nivel++;
    if (c === "]" || c === "}") { nivel--; if (nivel === 0) return eval("(" + html.slice(inicio, i + 1) + ")"); }
  }
  return null;
}

const base = {
  MACHINES: extrairLiteral("MACHINES") ?? [],
  PENEIRAS: extrairLiteral("PENEIRAS") ?? [],
  NAVALHAS: extrairLiteral("NAVALHAS") ?? [],
};

const brl = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const linha = (c = "=") => c.repeat(88);

let divergencias = 0;

// ─── Peneiras ─────────────────────────────────────────────────────────────────
console.log(linha());
console.log("PENEIRAS — valor no index.html  ×  valor exportado (após override)");
console.log(linha("-"));
let penMud = 0;
for (const p of exportado.peneiras) {
  if (!p.id.startsWith("pen_")) continue;
  const b = base.PENEIRAS[parseInt(p.id.slice(4), 10)];
  if (!b) continue;
  if (Number(b.valor) !== p.valor || String(b.ipi) !== String(p.ipi)) {
    penMud++;
    if (penMud <= 10) {
      console.log(
        "  " + String(b.modelo).padEnd(15) +
        "base " + brl(b.valor).padStart(13) + "  ipi " + String(b.ipi).padEnd(7) +
        " ->  exportado " + brl(p.valor).padStart(13) + "  ipi " + String(p.ipi).padEnd(7) +
        "  total " + brl(p.total)
      );
    }
  }
}
if (penMud > 10) console.log(`  ... e mais ${penMud - 10}`);
console.log(`  >> ${penMud} de ${exportado.peneiras.length} peneiras têm preço/IPI diferente do hardcoded.`);
divergencias += penMud;

// ─── Equipamentos ─────────────────────────────────────────────────────────────
console.log("");
console.log(linha());
console.log("EQUIPAMENTOS — valor no index.html  ×  valor exportado (após override)");
console.log(linha("-"));
let eqMud = 0;
for (const e of exportado.equipamentos) {
  if (!e.id.startsWith("orig_")) continue;
  const b = base.MACHINES[parseInt(e.id.slice(5), 10)];
  if (!b) continue;
  const mudou = Number(b.valor_maq || 0) !== e.valor_maquina
    || Number(b.valor_p220 || 0) !== e.valor_painel_220
    || Number(b.valor_p380 || 0) !== e.valor_painel_380;
  if (mudou) {
    eqMud++;
    if (eqMud <= 10) {
      console.log(
        "  " + (b.modelo + " " + (b.descricao || "")).slice(0, 42).padEnd(43) +
        "base " + brl(b.valor_maq || 0).padStart(14) +
        " ->  exportado " + brl(e.valor_maquina).padStart(14)
      );
    }
  }
}
if (eqMud > 10) console.log(`  ... e mais ${eqMud - 10}`);
const novos = exportado.equipamentos.filter((e) => e.origem === "novo").length;
console.log(`  >> ${eqMud} equipamentos com preço diferente do hardcoded.`);
console.log(`  >> ${novos} equipamentos só existem no Supabase (não estão no index.html).`);
divergencias += eqMud + novos;

// ─── Duplicidades a resolver antes da carga ───────────────────────────────────
console.log("");
console.log(linha());
console.log("DUPLICIDADES NA ORIGEM (precisam de decisão antes de carregar no ERP)");
console.log(linha("-"));
const contar = (lista, chave) => {
  const m = new Map();
  for (const i of lista) {
    const k = chave(i);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  }
  return [...m].filter(([, v]) => v.length > 1);
};
for (const [rotulo, dups, fmt] of [
  ["Reciclagem", contar(exportado.reciclagem, (r) => r.equipamento), (i) => `${i.id} pot.${i.potencia || "-"} ${brl(i.valor)}`],
  ["Navalhas", contar(exportado.navalhas, (n) => n.modelo), (i) => `${i.id} fixa ${i.cod_fixa} rot ${i.cod_rot} ${brl(i.total)}`],
]) {
  console.log(`\n  ${rotulo}: ${dups.length} nome(s) repetido(s)`);
  for (const [nome, itens] of dups.slice(0, 6)) {
    console.log(`    "${nome.slice(0, 62)}"`);
    for (const i of itens) console.log(`        ${fmt(i)}`);
  }
  if (dups.length > 6) console.log(`    ... e mais ${dups.length - 6}`);
}

console.log("");
console.log(linha());
console.log(`CONCLUSÃO: ${divergencias} registros seriam gravados ERRADOS se a exportação`);
console.log("usasse apenas o index.html sem aplicar os overrides do Supabase.");
console.log(linha());

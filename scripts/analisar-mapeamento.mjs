import fs from "fs";
import path from "path";

const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), "export-catalogo/catalogo-completo.json"), "utf8"));
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();

console.log("=".repeat(80));
console.log("LINHAS distintas nos equipamentos");
console.log("=".repeat(80));
const linhas = {};
for (const e of d.equipamentos) linhas[e.linha || "(vazio)"] = (linhas[e.linha || "(vazio)"] || 0) + 1;
console.log(Object.entries(linhas).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  "));

console.log("");
console.log("=".repeat(80));
console.log("EQUIPAMENTOS — codigo candidato = modelo + descricao");
console.log("=".repeat(80));
const eqKeys = new Map();
for (const e of d.equipamentos) {
  const k = norm(e.modelo + " " + e.descricao);
  eqKeys.set(k, (eqKeys.get(k) || 0) + 1);
}
const eqDup = [...eqKeys].filter(([, n]) => n > 1);
console.log(`chaves unicas: ${eqKeys.size} de ${d.equipamentos.length}   |   colisoes: ${eqDup.length}`);
eqDup.slice(0, 8).forEach(([k, n]) => console.log(`   "${k}" x${n}`));
const maiorEq = Math.max(...[...eqKeys.keys()].map((k) => k.length));
console.log(`maior codigo: ${maiorEq} chars`);
console.log(`modelos distintos: ${new Set(d.equipamentos.map((e) => norm(e.modelo))).size}`);

console.log("");
console.log("=".repeat(80));
console.log("NAVALHAS — cada linha vira 2 produtos (fixa + rotora), codigo = cod real");
console.log("=".repeat(80));
const navCods = new Map();
for (const n of d.navalhas) {
  if (n.modelo === "MGHS 1000" && n.id === "nav_9") continue; // descartada por decisao do usuario
  for (const [cod, tipo] of [[n.cod_fixa, "fixa"], [n.cod_rot, "rotora"]]) {
    if (!cod) continue;
    if (!navCods.has(cod)) navCods.set(cod, []);
    navCods.get(cod).push(`${n.modelo}/${tipo}`);
  }
}
const navDup = [...navCods].filter(([, v]) => v.length > 1);
console.log(`codigos distintos: ${navCods.size}   |   codigos usados por +1 modelo: ${navDup.length}`);
navDup.slice(0, 6).forEach(([c, v]) => console.log(`   cod ${c}: ${v.join(", ")}`));
const navSem = d.navalhas.filter((n) => !n.cod_fixa && !n.cod_rot);
console.log(`navalhas sem nenhum codigo: ${navSem.length}`);

console.log("");
console.log("=".repeat(80));
console.log("PENEIRAS — expandir furos_codigos em 1 produto por furo");
console.log("=".repeat(80));
const penCods = new Map();
let semFuro = 0, totalFuros = 0;
const amostraFuro = [];
for (const p of d.peneiras) {
  if (!p.furos_codigos.trim()) { semFuro++; continue; }
  // formato: "Ø4: 1437 | Ø6: 1439 | Ø8: 1441"
  const partes = p.furos_codigos.split("|").map((s) => s.trim()).filter(Boolean);
  for (const parte of partes) {
    const m = /^[ØøO]?\s*([\d.,]+)\s*:\s*(.+)$/.exec(parte);
    if (!m) { amostraFuro.push(`NAO PARSEADO -> "${parte}"`); continue; }
    const furo = m[1].replace(",", "."), cod = m[2].trim();
    totalFuros++;
    if (!penCods.has(cod)) penCods.set(cod, []);
    penCods.get(cod).push(`${p.modelo} Ø${furo}`);
  }
}
console.log(`peneiras sem furos: ${semFuro}   |   furos parseados: ${totalFuros}   |   codigos distintos: ${penCods.size}`);
const penDup = [...penCods].filter(([, v]) => v.length > 1);
console.log(`codigos de furo repetidos entre modelos: ${penDup.length}`);
penDup.slice(0, 6).forEach(([c, v]) => console.log(`   cod ${c}: ${v.join(", ")}`));
amostraFuro.slice(0, 6).forEach((s) => console.log("   " + s));

console.log("");
console.log("=".repeat(80));
console.log("RECICLAGEM — codigo = equipamento + potencia");
console.log("=".repeat(80));
const recKeys = new Map();
for (const r of d.reciclagem) {
  const k = norm(r.equipamento) + (r.potencia ? " " + r.potencia + "CV" : "");
  recKeys.set(k, (recKeys.get(k) || 0) + 1);
}
console.log(`chaves unicas: ${recKeys.size} de ${d.reciclagem.length}   |   colisoes: ${[...recKeys].filter(([, n]) => n > 1).length}`);
console.log(`maior codigo: ${Math.max(...[...recKeys.keys()].map((k) => k.length))} chars`);

console.log("");
console.log("=".repeat(80));
console.log("COLISOES ENTRE AS CATEGORIAS (codigo e UNIQUE na tabela toda)");
console.log("=".repeat(80));
const todos = new Map();
const reg = (cod, origem) => {
  const c = String(cod).trim();
  if (!c) return;
  if (!todos.has(c)) todos.set(c, []);
  todos.get(c).push(origem);
};
[...eqKeys.keys()].forEach((k) => reg(k, "maquina"));
[...navCods.keys()].forEach((k) => reg(k, "navalha"));
[...penCods.keys()].forEach((k) => reg(k, "peneira"));
[...recKeys.keys()].forEach((k) => reg(k, "reciclagem"));
const cruz = [...todos].filter(([, v]) => v.length > 1);
console.log(`codigos usados por mais de uma categoria: ${cruz.length}`);
cruz.slice(0, 10).forEach(([c, v]) => console.log(`   "${c}" -> ${v.join(" + ")}`));
console.log("");
console.log(`TOTAL DE PRODUTOS A CRIAR: ${eqKeys.size + navCods.size + penCods.size + recKeys.size + d.linhas_pepp.length}`);

/**
 * Quebra a linha "Outros" (74 máquinas) em famílias, pelo prefixo do modelo.
 *
 *   node scripts/quebrar-outros.mjs              # simula
 *   node scripts/quebrar-outros.mjs --executar   # aplica
 *
 * O agrupamento segue a nomenclatura de modelo definida pela Seibt. A ordem da
 * lista importa: prefixos que são sufixo de outro precisam vir antes, senão
 * "TPS 1000" cairia em TP e "MGHS 1500 E" cairia em MGHS genérico.
 */

import fs from "fs";
import path from "path";

const EXECUTAR = process.argv.includes("--executar");
const RAIZ = process.cwd();

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY;
const cab = (extra = {}) => ({ apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json", ...extra });

async function api(caminho, opcoes = {}) {
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, { ...opcoes, headers: cab(opcoes.headers) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${caminho.slice(0, 70)} :: ${t.slice(0, 250)}`);
  return t ? JSON.parse(t) : null;
}

/**
 * Ordem de teste — vence o primeiro que casar.
 * TPS antes de TP e de PS; MGHS específicos antes de qualquer MGHS genérico.
 */
const FAMILIAS = [
  { linha: "Triturador TPS", ordem: 80, re: /^TPS\b/i },
  { linha: "Triturador TS", ordem: 81, re: /^TS\b/i },
  { linha: "Moinho para Tubos", ordem: 82, re: /^(MDTS|MHTS|TP)\b/i },
  { linha: "Aglutinador", ordem: 83, re: /^AS\b/i },
  { linha: "Extrusora", ordem: 84, re: /^ES\b/i },
  { linha: "Guilhotina", ordem: 85, re: /^GUILHOTINA\b/i },
  { linha: "TFV", ordem: 86, re: /^MGHS\s+[\w.,-]+\s*TFV\b/i },
  { linha: "MGHS E", ordem: 87, re: /^MGHS\s+[\w.,-]+\s*E\b/i },
  { linha: "RCX", ordem: 88, re: /^MGHS\s+[\w.,-]+\s*RCX\b/i },
  { linha: "Separador de Pó", ordem: 89, re: /^SPS\b/i },
  { linha: "Separador de Fibras", ordem: 90, re: /^SFS\b/i },
  { linha: "PS", ordem: 91, re: /^PS\b/i },
];

async function main() {
  console.log(EXECUTAR ? "MODO GRAVACAO\n" : "MODO SIMULACAO — nada sera alterado. Use --executar para aplicar.\n");

  const linhas = await api("linhas?select=id,nome");
  const outros = linhas.find((l) => l.nome === "Outros");
  if (!outros) { console.log('Linha "Outros" não encontrada — nada a fazer.'); return; }

  const itens = await api(`produtos?select=id,codigo,modelo&linha_id=eq.${outros.id}&deleted_at=is.null&order=codigo`);
  console.log(`Itens na linha "Outros": ${itens.length}\n`);

  const grupos = new Map();
  const semFamilia = [];
  for (const p of itens) {
    const nome = String(p.modelo || p.codigo).trim();
    const fam = FAMILIAS.find((f) => f.re.test(nome));
    if (!fam) { semFamilia.push({ ...p, nome }); continue; }
    if (!grupos.has(fam.linha)) grupos.set(fam.linha, []);
    grupos.get(fam.linha).push(p);
  }

  console.log("FAMILIAS");
  console.log("-".repeat(58));
  let soma = 0;
  for (const f of FAMILIAS) {
    const lista = grupos.get(f.linha) ?? [];
    if (!lista.length) continue;
    soma += lista.length;
    console.log(`  ${f.linha.padEnd(24)} ${String(lista.length).padStart(3)}   ex.: ${String(lista[0].modelo || lista[0].codigo).slice(0, 20)}`);
  }
  console.log(`  ${"agrupados".padEnd(24)} ${String(soma).padStart(3)}`);

  if (semFamilia.length) {
    console.log(`\nSEM FAMILIA — ficam em "Outros" (${semFamilia.length}):`);
    semFamilia.forEach((p) => console.log(`    ${p.nome}`));
  }

  if (!EXECUTAR) { console.log("\nNada foi alterado. Rode com --executar para aplicar."); return; }

  console.log("\nAplicando...");
  const usadas = FAMILIAS.filter((f) => (grupos.get(f.linha) ?? []).length > 0);
  await api("linhas?on_conflict=nome", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(usadas.map((f) => ({ nome: f.linha, ordem: f.ordem }))),
  });
  const atuais = await api("linhas?select=id,nome");
  const idPorNome = new Map(atuais.map((l) => [l.nome, l.id]));

  for (const f of usadas) {
    const lista = grupos.get(f.linha) ?? [];
    const destino = idPorNome.get(f.linha);
    for (let i = 0; i < lista.length; i += 100) {
      const ids = lista.slice(i, i + 100).map((p) => p.id);
      await api(`produtos?id=in.(${ids.join(",")})`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ linha_id: destino, linha: f.linha }),
      });
    }
    console.log(`   ${String(lista.length).padStart(3)} -> ${f.linha}`);
  }

  const resto = await api(`produtos?select=id&linha_id=eq.${outros.id}&deleted_at=is.null`);
  if (!resto.length) {
    await api(`linhas?id=eq.${outros.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    console.log('   linha "Outros" removida (ficou vazia)');
  } else {
    console.log(`   linha "Outros" mantida com ${resto.length} produto(s)`);
  }

  const finais = await api("linhas?select=id,nome,ordem&order=ordem");
  console.log("\nLINHAS APOS A QUEBRA");
  console.log("-".repeat(48));
  let total = 0;
  for (const l of finais) {
    const r = await fetch(`${BASE}/rest/v1/produtos?select=id&linha_id=eq.${l.id}&categoria=eq.maquina&deleted_at=is.null`, {
      headers: cab({ Prefer: "count=exact", Range: "0-0" }),
    });
    const n = Number((r.headers.get("content-range") || "").split("/")[1] || 0);
    total += n;
    console.log(`  ${l.nome.padEnd(30)} ${String(n).padStart(4)}`);
  }
  console.log(`  ${"TOTAL".padEnd(30)} ${String(total).padStart(4)}`);
}

main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });

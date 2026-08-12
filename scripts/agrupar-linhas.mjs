/**
 * Move ETS/ESTS para "Esteira Transportadora" e atribui a família de cada linha.
 *
 *   node scripts/agrupar-linhas.mjs              # simula
 *   node scripts/agrupar-linhas.mjs --executar   # aplica
 *
 * Exige a migration 016 (colunas linhas.grupo e linhas.grupo_ordem).
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

/** Famílias na ordem em que aparecem na tela. */
const GRUPOS = [
  {
    nome: "Moagem", ordem: 1,
    linhas: ["Linha A2", "Linha BSC", "Linha BSC BR", "Linha LR", "Linha LRX", "Linha A", "Linha N",
      "TFV", "MGHS E", "RCX", "PS", "Moinho para Tubos", "Triturador TPS", "Triturador TS"],
  },
  {
    nome: "Reciclagem", ordem: 2,
    linhas: ["Lavadoras", "Pré-Secadores", "Centrífugas Secadoras", "Tanques", "Reatores",
      "Rasgadores de Rótulos", "Separadores", "Separador de Pó", "Separador de Fibras",
      "Silos de Reciclagem", "Bombas", "Válvulas", "Detectores de Metal", "Polias",
      "Reciclagem — Outros"],
  },
  {
    nome: "Transporte", ordem: 3,
    linhas: ["Roscas Transportadoras", "Esteiras Inclinadas", "Esteiras Planas", "Esteiras Modulares",
      "Esteira Transportadora", "Dutos e Curvas", "Dutos e Curvas de Reciclagem"],
  },
  { nome: "Extrusão", ordem: 4, linhas: ["Extrusora", "Aglutinador"] },
  {
    nome: "Auxiliares", ordem: 5,
    linhas: ["Silos", "Exaustores", "Cabines", "Cabines de Reciclagem", "Soft Starters",
      "Reservatórios de Moído", "Carenagens", "Pés e Estruturas", "Venturi", "Guilhotina"],
  },
  { nome: "Linhas Completas", ordem: 6, linhas: ["Linhas PEPP"] },
];

const ESTEIRA = "Esteira Transportadora";

async function main() {
  console.log(EXECUTAR ? "MODO GRAVACAO\n" : "MODO SIMULACAO — nada sera alterado. Use --executar para aplicar.\n");

  const linhas = await api("linhas?select=id,nome,ordem,grupo");
  const idPorNome = new Map(linhas.map((l) => [l.nome, l.id]));

  // ─── 1. ETS / ESTS ──────────────────────────────────────────────────────────
  const outros = linhas.find((l) => l.nome === "Outros");
  const mover = outros
    ? (await api(`produtos?select=id,codigo,modelo&linha_id=eq.${outros.id}&deleted_at=is.null&order=codigo`))
        .filter((p) => /^(ETS|ESTS)\b/i.test(String(p.modelo || p.codigo).trim()))
    : [];
  console.log(`1) Para "${ESTEIRA}": ${mover.length} produto(s)`);
  mover.forEach((p) => console.log(`     ${p.modelo || p.codigo}`));

  // ─── 2. Famílias ────────────────────────────────────────────────────────────
  const nomesConhecidos = new Set(GRUPOS.flatMap((g) => g.linhas).concat([ESTEIRA]));
  const orfas = linhas.filter((l) => !nomesConhecidos.has(l.nome) && l.nome !== "Outros");

  console.log("\n2) Famílias:");
  for (const g of GRUPOS) {
    const existentes = g.linhas.filter((n) => idPorNome.has(n) || n === ESTEIRA);
    console.log(`     ${g.nome.padEnd(18)} ${String(existentes.length).padStart(2)} linhas`);
  }
  if (orfas.length) {
    console.log(`\n   LINHAS SEM FAMÍLIA (${orfas.length}):`);
    orfas.forEach((l) => console.log(`     ${l.nome}`));
  }

  const inexistentes = GRUPOS.flatMap((g) => g.linhas).filter((n) => !idPorNome.has(n) && n !== ESTEIRA);
  if (inexistentes.length) {
    console.log(`\n   Nomes listados que não existem no banco (${inexistentes.length}):`);
    inexistentes.forEach((n) => console.log(`     ${n}`));
  }

  if (!EXECUTAR) { console.log("\nNada foi alterado. Rode com --executar para aplicar."); return; }

  console.log("\nAplicando...");

  if (mover.length) {
    await api("linhas?on_conflict=nome", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ nome: ESTEIRA, ordem: 92 }]),
    });
    const atual = await api(`linhas?select=id,nome&nome=eq.${encodeURIComponent(ESTEIRA)}`);
    const destino = atual[0].id;
    await api(`produtos?id=in.(${mover.map((p) => p.id).join(",")})`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ linha_id: destino, linha: ESTEIRA }),
    });
    console.log(`   ${mover.length} -> ${ESTEIRA}`);

    if (outros) {
      const resto = await api(`produtos?select=id&linha_id=eq.${outros.id}&deleted_at=is.null`);
      if (!resto.length) {
        await api(`linhas?id=eq.${outros.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        console.log('   linha "Outros" removida (ficou vazia)');
      }
    }
  }

  const depois = await api("linhas?select=id,nome");
  const idAtual = new Map(depois.map((l) => [l.nome, l.id]));

  for (const g of GRUPOS) {
    const alvos = g.linhas.concat(g.nome === "Transporte" ? [ESTEIRA] : []).filter((n) => idAtual.has(n));
    const ids = [...new Set(alvos.map((n) => idAtual.get(n)))];
    if (!ids.length) continue;
    await api(`linhas?id=in.(${ids.join(",")})`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ grupo: g.nome, grupo_ordem: g.ordem }),
    });
    console.log(`   ${String(ids.length).padStart(2)} linhas -> ${g.nome}`);
  }

  // ─── Conferência ────────────────────────────────────────────────────────────
  const finais = await api("linhas?select=id,nome,grupo,grupo_ordem,ordem&order=grupo_ordem,ordem");
  console.log("\nCATALOGO POR FAMILIA");
  console.log("=".repeat(56));
  let grupoAtual = null, totalGeral = 0;
  for (const l of finais) {
    const g = l.grupo ?? "Sem família";
    if (g !== grupoAtual) { console.log(`\n  ${g.toUpperCase()}`); grupoAtual = g; }
    const r = await fetch(`${BASE}/rest/v1/produtos?select=id&linha_id=eq.${l.id}&categoria=eq.maquina&deleted_at=is.null`, {
      headers: cab({ Prefer: "count=exact", Range: "0-0" }),
    });
    const n = Number((r.headers.get("content-range") || "").split("/")[1] || 0);
    totalGeral += n;
    console.log(`    ${l.nome.padEnd(32)} ${String(n).padStart(4)}`);
  }
  console.log(`\n  TOTAL ${totalGeral} máquinas em ${finais.length} linhas`);
}

main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });

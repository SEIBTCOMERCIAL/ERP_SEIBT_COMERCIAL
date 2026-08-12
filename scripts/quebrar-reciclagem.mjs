/**
 * Quebra a linha "Reciclagem" (482 itens) em famílias de produto.
 *
 *   node scripts/quebrar-reciclagem.mjs              # simula
 *   node scripts/quebrar-reciclagem.mjs --executar   # aplica
 *
 * As famílias saem do nome do equipamento. Abreviações do catálogo são
 * normalizadas (TQ = TANQUE, SEP = SEPARADOR, RASG. = RASGADOR) e famílias com
 * poucos itens caem em "Reciclagem — Outros" para não gerar linha de 1 produto.
 *
 * Os nomes levam o sufixo "de Reciclagem" onde já existe linha homônima vinda
 * dos periféricos (Silos, Cabines, Dutos e Curvas), para não misturar os dois.
 */

import fs from "fs";
import path from "path";

const EXECUTAR = process.argv.includes("--executar");
const MINIMO = 4; // abaixo disso, o item vai para "Reciclagem — Outros"
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

async function todos(tabela, select, filtro = "") {
  const saida = [];
  for (let i = 0; ; i += 1000) {
    const r = await fetch(`${BASE}/rest/v1/${tabela}?select=${select}${filtro}&order=codigo`, { headers: cab({ Range: `${i}-${i + 999}` }) });
    const lote = await r.json();
    saida.push(...lote);
    if (lote.length < 1000) return saida;
  }
}

/**
 * Famílias na ordem de teste — vence o primeiro padrão que casar, então os
 * termos mais específicos vêm antes dos genéricos.
 */
const FAMILIAS = [
  { linha: "Roscas Transportadoras", re: /^ROSCA\b/i },
  { linha: "Esteiras Inclinadas", re: /^ESTEIRA\s+INCLINADA\b/i },
  { linha: "Esteiras Planas", re: /^ESTEIRA\s+PLAN[AO]\b/i },
  { linha: "Esteiras Modulares", re: /^ESTEIRA\b/i },
  { linha: "Lavadoras", re: /^LAVADORA\b/i },
  { linha: "Pré-Secadores", re: /^PR[ÉE]-?SEC\b/i },
  { linha: "Tanques", re: /^(TANQUE|TQ)\b/i },
  { linha: "Reatores", re: /^REATOR\b/i },
  { linha: "Silos de Reciclagem", re: /^SILO\b/i },
  { linha: "Separadores", re: /^SEP(ARADOR)?\b/i },
  { linha: "Polias", re: /^POLIA\b/i },
  { linha: "Detectores de Metal", re: /^DETECTOR\b/i },
  { linha: "Dutos e Curvas de Reciclagem", re: /^(DUTOS?|CURVA)\b/i },
  { linha: "Pés e Estruturas", re: /^(P[ÉE]S|PLATAFORMA)\b/i },
  { linha: "Bombas", re: /^BOMBA\b/i },
  { linha: "Centrífugas Secadoras", re: /^CENTR[ÍI]FUGA\b/i },
  { linha: "Rasgadores de Rótulos", re: /^RASG/i },
  { linha: "Venturi", re: /^VENTURI\b/i },
  { linha: "Carenagens", re: /^CARENAGEM\b/i },
  { linha: "Válvulas", re: /^V[ÁA]LVULA\b/i },
  { linha: "Cabines de Reciclagem", re: /^CABINE\b/i },
  { linha: "Perfuradores", re: /^PERFURADOR\b/i },
  { linha: "Reservatórios de Reciclagem", re: /^RESERVAT[ÓO]RIO\b/i },
  { linha: "Abridores de Fardos", re: /^ABRIDOR\b/i },
  { linha: "Extratores", re: /^EXTRATOR\b/i },
  { linha: "Gavetas Magnéticas", re: /^GAVETA\b/i },
  { linha: "Ciclones", re: /^CICLONE\b/i },
  { linha: "Peneiras de Reciclagem", re: /^PENEIRA\b/i },
];

const SOBRA = "Reciclagem — Outros";

async function main() {
  console.log(EXECUTAR ? "MODO GRAVACAO\n" : "MODO SIMULACAO — nada sera alterado. Use --executar para aplicar.\n");

  const linhas = await api("linhas?select=id,nome,ordem");
  const linhaRecic = linhas.find((l) => l.nome === "Reciclagem");
  if (!linhaRecic) { console.log('Linha "Reciclagem" não encontrada — nada a fazer.'); return; }

  const itens = await todos("produtos", "id,codigo,descricao", `&linha_id=eq.${linhaRecic.id}&deleted_at=is.null`);
  console.log(`Itens na linha "Reciclagem": ${itens.length}\n`);

  // A descrição carrega o nome real do equipamento (o código é REC-NNNN).
  const grupos = new Map();
  const naoCasaram = [];
  for (const p of itens) {
    const nome = String(p.descricao || "").trim();
    const fam = FAMILIAS.find((f) => f.re.test(nome));
    const chave = fam ? fam.linha : null;
    if (!chave) { naoCasaram.push(p); continue; }
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(p);
  }

  // Famílias pequenas viram sobra, junto com o que não casou.
  const sobra = [...naoCasaram];
  for (const [nome, lista] of [...grupos]) {
    if (lista.length < MINIMO) { sobra.push(...lista); grupos.delete(nome); }
  }
  if (sobra.length) grupos.set(SOBRA, sobra);

  const ordenados = [...grupos].sort((a, b) => b[1].length - a[1].length);
  console.log("FAMILIAS");
  console.log("-".repeat(62));
  for (const [nome, lista] of ordenados) {
    console.log(`  ${nome.padEnd(32)} ${String(lista.length).padStart(4)}   ${String(lista[0].descricao).slice(0, 22)}`);
  }
  console.log(`  ${"TOTAL".padEnd(32)} ${String([...grupos.values()].reduce((s, l) => s + l.length, 0)).padStart(4)}`);

  if (sobra.length) {
    console.log(`\nDentro de "${SOBRA}" (${sobra.length}):`);
    sobra.slice(0, 12).forEach((p) => console.log(`    ${String(p.descricao).slice(0, 62)}`));
    if (sobra.length > 12) console.log(`    ... e mais ${sobra.length - 12}`);
  }

  if (!EXECUTAR) { console.log("\nNada foi alterado. Rode com --executar para aplicar."); return; }

  console.log("\nAplicando...");
  const baseOrdem = 40;
  await api("linhas?on_conflict=nome", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(ordenados.map(([nome], i) => ({ nome, ordem: baseOrdem + i }))),
  });
  const atuais = await api("linhas?select=id,nome");
  const idPorNome = new Map(atuais.map((l) => [l.nome, l.id]));

  for (const [nome, lista] of ordenados) {
    const destino = idPorNome.get(nome);
    for (let i = 0; i < lista.length; i += 100) {
      const ids = lista.slice(i, i + 100).map((p) => p.id);
      await api(`produtos?id=in.(${ids.join(",")})`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ linha_id: destino, linha: nome }),
      });
    }
    console.log(`   ${String(lista.length).padStart(4)} -> ${nome}`);
  }

  const resto = await todos("produtos", "id", `&linha_id=eq.${linhaRecic.id}&deleted_at=is.null`);
  if (!resto.length) {
    await api(`linhas?id=eq.${linhaRecic.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    console.log('   linha "Reciclagem" removida (ficou vazia)');
  } else {
    console.log(`   linha "Reciclagem" mantida — ainda tem ${resto.length} produto(s)`);
  }

  const finais = await api("linhas?select=id,nome,ordem&order=ordem");
  console.log("\nLINHAS APOS A QUEBRA");
  console.log("-".repeat(52));
  let soma = 0;
  for (const l of finais) {
    const r = await fetch(`${BASE}/rest/v1/produtos?select=id&linha_id=eq.${l.id}&categoria=eq.maquina&deleted_at=is.null`, {
      headers: cab({ Prefer: "count=exact", Range: "0-0" }),
    });
    const n = Number((r.headers.get("content-range") || "").split("/")[1] || 0);
    soma += n;
    console.log(`  ${l.nome.padEnd(32)} ${String(n).padStart(5)}`);
  }
  console.log(`  ${"TOTAL".padEnd(32)} ${String(soma).padStart(5)}`);
}

main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });

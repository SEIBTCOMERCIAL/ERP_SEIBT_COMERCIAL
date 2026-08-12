/**
 * Reorganiza as linhas do catálogo depois da carga inicial.
 *
 *   node scripts/reorganizar-linhas.mjs              # simula
 *   node scripts/reorganizar-linhas.mjs --executar   # aplica
 *
 * O que faz:
 *  1. Remove a "LINHA A2" do seed antigo (soft delete — grava deleted_at),
 *     cujas 30 máquinas são duplicatas das que vieram do catálogo.
 *  2. Quebra "Periféricos" em linhas por família de produto (Silos, Exaustores,
 *     Cabines, Soft Starters, Dutos e Curvas).
 *  3. Move os produtos "Sem linha" para "Reservatórios de Moído".
 *  4. Passa Reciclagem e Linhas PEPP para categoria 'maquina' — a tela de
 *     Produtos só lista essa categoria, por isso apareciam zeradas.
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

async function todos(tabela, select, filtro = "") {
  const saida = [];
  for (let i = 0; ; i += 1000) {
    const r = await fetch(`${BASE}/rest/v1/${tabela}?select=${select}${filtro}&order=codigo`, {
      headers: cab({ Range: `${i}-${i + 999}` }),
    });
    const lote = await r.json();
    saida.push(...lote);
    if (lote.length < 1000) return saida;
  }
}

/**
 * Famílias de periféricos, na ordem em que são testadas — o primeiro padrão
 * que casar com o código do produto define a linha.
 */
const FAMILIAS = [
  { linha: "Silos", ordem: 20, re: /^SILO\b/i },
  { linha: "Exaustores", ordem: 21, re: /^EXAUSTOR\b/i },
  { linha: "Cabines", ordem: 22, re: /^CABINE\b/i },
  { linha: "Soft Starters", ordem: 23, re: /^SOFT ?STARTER\b/i },
  { linha: "Dutos e Curvas", ordem: 24, re: /^(DUTO|CURVA)\b/i },
  { linha: "Reservatórios de Moído", ordem: 25, re: /^RESERVAT[ÓO]RIO\b/i },
];

const familiaDe = (codigo) => FAMILIAS.find((f) => f.re.test(String(codigo).trim()))?.linha ?? null;

async function main() {
  console.log(EXECUTAR ? "MODO GRAVACAO\n" : "MODO SIMULACAO — nada sera alterado. Use --executar para aplicar.\n");

  const linhas = await api("linhas?select=id,nome,ordem");
  const idPorNome = new Map(linhas.map((l) => [l.nome, l.id]));
  const nomePorId = new Map(linhas.map((l) => [l.id, l.nome]));

  // ─── 1. Seed antigo ─────────────────────────────────────────────────────────
  const idAntiga = idPorNome.get("LINHA A2");
  const antigos = idAntiga ? await todos("produtos", "id,codigo,preco_brl", `&linha_id=eq.${idAntiga}&deleted_at=is.null`) : [];
  console.log(`1) "LINHA A2" (seed antigo): ${antigos.length} produtos para arquivar`);
  antigos.slice(0, 4).forEach((p) => console.log(`     ${p.codigo}`));
  if (antigos.length > 4) console.log(`     ... e mais ${antigos.length - 4}`);

  // ─── 2 e 3. Periféricos e sem-linha ─────────────────────────────────────────
  const idPerif = idPorNome.get("Periféricos");
  const idSemLinha = idPorNome.get("Sem linha");
  const alvos = [];
  for (const id of [idPerif, idSemLinha]) {
    if (!id) continue;
    alvos.push(...await todos("produtos", "id,codigo,linha_id", `&linha_id=eq.${id}&deleted_at=is.null`));
  }

  const porFamilia = new Map();
  const semFamilia = [];
  for (const p of alvos) {
    const fam = familiaDe(p.codigo);
    if (!fam) { semFamilia.push(p); continue; }
    if (!porFamilia.has(fam)) porFamilia.set(fam, []);
    porFamilia.get(fam).push(p);
  }

  console.log(`\n2) "Periféricos" + "Sem linha" (${alvos.length} produtos) reagrupados:`);
  for (const f of FAMILIAS) {
    const itens = porFamilia.get(f.linha) ?? [];
    if (itens.length) console.log(`     ${f.linha.padEnd(24)} ${String(itens.length).padStart(3)}   ex.: ${itens[0].codigo.slice(0, 34)}`);
  }
  if (semFamilia.length) {
    console.log(`     SEM FAMILIA RECONHECIDA  ${String(semFamilia.length).padStart(3)}`);
    semFamilia.slice(0, 8).forEach((p) => console.log(`        ${p.codigo}`));
  }

  // ─── 4. Categorias que sumiam da tela ───────────────────────────────────────
  const recic = await todos("produtos", "id,codigo", "&categoria=eq.periferico&deleted_at=is.null");
  const pepp = await todos("produtos", "id,codigo", "&categoria=eq.linha&deleted_at=is.null");
  console.log(`\n3) categoria -> 'maquina' para aparecer em Produtos:`);
  console.log(`     Reciclagem   ${String(recic.length).padStart(4)} produtos (hoje categoria 'periferico')`);
  console.log(`     Linhas PEPP  ${String(pepp.length).padStart(4)} produtos (hoje categoria 'linha')`);

  if (!EXECUTAR) {
    console.log("\nNada foi alterado. Rode com --executar para aplicar.");
    return;
  }

  // ─── Aplicação ──────────────────────────────────────────────────────────────
  console.log("\nAplicando...");
  const agora = new Date().toISOString();

  if (antigos.length) {
    for (let i = 0; i < antigos.length; i += 100) {
      const ids = antigos.slice(i, i + 100).map((p) => p.id);
      await api(`produtos?id=in.(${ids.join(",")})`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ deleted_at: agora, ativo: false }),
      });
    }
    console.log(`   ${antigos.length} produtos do seed antigo arquivados`);
  }

  // Cria as linhas novas
  const necessarias = FAMILIAS.filter((f) => (porFamilia.get(f.linha) ?? []).length > 0);
  if (necessarias.length) {
    await api("linhas?on_conflict=nome", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(necessarias.map((f) => ({ nome: f.linha, ordem: f.ordem }))),
    });
  }
  const linhasAtuais = await api("linhas?select=id,nome");
  const idAtual = new Map(linhasAtuais.map((l) => [l.nome, l.id]));

  for (const f of necessarias) {
    const itens = porFamilia.get(f.linha) ?? [];
    const destino = idAtual.get(f.linha);
    for (let i = 0; i < itens.length; i += 100) {
      const ids = itens.slice(i, i + 100).map((p) => p.id);
      await api(`produtos?id=in.(${ids.join(",")})`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ linha_id: destino, linha: f.linha }),
      });
    }
    console.log(`   ${String(itens.length).padStart(3)} -> ${f.linha}`);
  }

  const virarMaquina = async (lista, rotulo) => {
    for (let i = 0; i < lista.length; i += 100) {
      const ids = lista.slice(i, i + 100).map((p) => p.id);
      await api(`produtos?id=in.(${ids.join(",")})`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ categoria: "maquina" }),
      });
    }
    if (lista.length) console.log(`   ${String(lista.length).padStart(3)} -> categoria 'maquina' (${rotulo})`);
  };
  await virarMaquina(recic, "Reciclagem");
  await virarMaquina(pepp, "Linhas PEPP");

  // Remove as linhas que ficaram vazias
  for (const nome of ["LINHA A2", "Periféricos", "Sem linha"]) {
    const id = idAtual.get(nome);
    if (!id) continue;
    const resto = await todos("produtos", "id", `&linha_id=eq.${id}&deleted_at=is.null`);
    if (resto.length) { console.log(`   "${nome}" mantida — ainda tem ${resto.length} produto(s)`); continue; }
    await api(`produtos?linha_id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ linha_id: null }) });
    await api(`linhas?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    console.log(`   linha "${nome}" removida`);
  }

  // ─── Conferência ────────────────────────────────────────────────────────────
  const finais = await api("linhas?select=id,nome,ordem&order=ordem");
  console.log("\nLINHAS APOS A REORGANIZACAO");
  console.log("-".repeat(52));
  for (const l of finais) {
    const r = await fetch(`${BASE}/rest/v1/produtos?select=id&linha_id=eq.${l.id}&categoria=eq.maquina&deleted_at=is.null`, {
      headers: cab({ Prefer: "count=exact", Range: "0-0" }),
    });
    const n = (r.headers.get("content-range") || "").split("/")[1];
    console.log(`  ${l.nome.padEnd(26)} ${String(n).padStart(5)}`);
  }
  void nomePorId;
}

main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });

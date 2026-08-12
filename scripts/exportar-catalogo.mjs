/**
 * Exportador do CATALOGO_SEIBT_INTERATIVO.
 *
 * O catálogo guarda o dado-base hardcoded dentro do index.html e as edições
 * feitas pelos usuários num único JSON no Supabase (catalog_data / id='main').
 * Este script reproduz fielmente a lógica de merge do próprio app — as funções
 * buildMachinesList / renderNavalhas / renderPeneiras / renderReciclagem — para
 * que o resultado exportado seja exatamente o que o usuário vê na tela.
 *
 * Uso:
 *   node scripts/exportar-catalogo.mjs [caminho-do-catalogo] [pasta-de-saida]
 *
 * Não escreve nada no banco. Gera JSON + CSV + relatório de validação.
 */

import fs from "fs";
import path from "path";

const CATALOGO_DIR = process.argv[2] || "C:/Users/felipe.molinos/Desktop/CATALOGO_SEIBT_INTERATIVO";
const OUT_DIR = process.argv[3] || path.join(process.cwd(), "export-catalogo");
const INDEX = path.join(CATALOGO_DIR, "index.html");

// ─── Extração das constantes do index.html ────────────────────────────────────

/** Extrai o literal de uma constante JS do HTML equilibrando chaves/colchetes. */
function extrairLiteral(html, nome) {
  const re = new RegExp(`(?:let|const|var) ${nome} = (\\[|\\{)`);
  const m = re.exec(html);
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
    if (c === "]" || c === "}") { nivel--; if (nivel === 0) return html.slice(inicio, i + 1); }
  }
  return null;
}

function lerConstante(html, nome, fallback) {
  const raw = extrairLiteral(html, nome);
  if (!raw) { avisos.push(`Constante ${nome} não encontrada no index.html`); return fallback; }
  try {
    return eval("(" + raw + ")");
  } catch (e) {
    avisos.push(`Falha ao interpretar ${nome}: ${e.message}`);
    return fallback;
  }
}

// ─── Overrides vindos do Supabase ─────────────────────────────────────────────

async function buscarOverrides(html) {
  const url = /https:\/\/[a-z0-9]+\.supabase\.co/.exec(html)?.[0];
  const key = /sb_publishable_[A-Za-z0-9_-]+/.exec(html)?.[0]
    || /eyJ[A-Za-z0-9_.-]{60,}/.exec(html)?.[0];

  if (!url || !key) {
    avisos.push("Credenciais do Supabase não localizadas no index.html — exportando SOMENTE o dado hardcoded.");
    return null;
  }

  const r = await fetch(`${url}/rest/v1/catalog_data?select=data&id=eq.main`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) {
    avisos.push(`Supabase respondeu ${r.status} ao ler catalog_data — exportando SOMENTE o dado hardcoded.`);
    return null;
  }
  const linhas = await r.json();
  if (!linhas.length || !linhas[0].data) {
    avisos.push("catalog_data/main veio vazio — exportando SOMENTE o dado hardcoded.");
    return null;
  }
  return linhas[0].data;
}

// ─── Merge: equipamentos (espelha buildMachinesList) ──────────────────────────

function montarEquipamentos(base, ov, specs) {
  const edits = ov?.edits || {};
  const deletes = ov?.deletes || [];
  const news = ov?.news || [];

  const daBase = base
    .map((m, idx) => {
      const id = "orig_" + idx;
      if (deletes.indexOf(id) !== -1) return null;
      return Object.assign({}, m, edits[id] || {}, { _id: id, _origem: edits[id] ? "editado" : "original" });
    })
    .filter(Boolean);

  const novos = news.map((m, i) => Object.assign({}, m, { _id: m._id || `new_${i}`, _origem: "novo" }));

  return daBase.concat(novos).map((m) => ({
    id: m._id,
    origem: m._origem,
    modelo: m.modelo || "",
    descricao: m.descricao || "",
    linha: m.linha || "",
    valor_maquina: num(m.valor_maq),
    valor_painel_220: num(m.valor_p220),
    valor_painel_380: num(m.valor_p380),
    imagem: m.imagem || "",
    specs: m._specs || acharSpecs(specs, m.modelo || "") || null,
  }));
}

/** Espelha findSpecs do app: casa pelo modelo sem o prefixo "MGHS ". */
function acharSpecs(specs, modelo) {
  const limpo = String(modelo).replace("MGHS ", "").trim();
  if (!limpo) return null;
  for (const k in specs) if (k.includes(limpo)) return specs[k];
  return null;
}

// ─── Merge: navalhas (espelha renderNavalhas) ─────────────────────────────────

function montarNavalhas(base, ov) {
  const porChave = ov?.navalhas || {};
  const excluidas = ov?._deletedNavalhas || [];
  const novas = ov?._newNavalhas || [];

  const daBase = base
    .map((n, idx) => {
      const chave = "nav_" + idx;
      const o = porChave[chave] || {};
      const pick = (campo, padrao) => (o[campo] !== undefined ? o[campo] : (n[campo] ?? padrao));
      const valorFixa = num(pick("valor_fixa", 0));
      const qtdeFixa = num(pick("qtde_fixa", 0));
      const valorRot = num(pick("valor_rot", 0));
      const qtdeRot = num(pick("qtde_rot", 0));
      return {
        id: chave,
        origem: porChave[chave] ? "editado" : "original",
        modelo: pick("modelo", ""),
        cod_fixa: String(pick("cod_fixa", "")),
        qtde_fixa: qtdeFixa,
        valor_fixa: valorFixa,
        cod_rot: String(pick("cod_rot", "")),
        qtde_rot: qtdeRot,
        valor_rot: valorRot,
        total: arred(valorFixa * qtdeFixa + valorRot * qtdeRot),
      };
    })
    .filter((n) => excluidas.indexOf(n.id) === -1);

  const daNovas = novas.map((it, i) => {
    const vf = num(it.valor_fixa), qf = num(it.qtde_fixa);
    const vr = num(it.valor_rot), qr = num(it.qtde_rot);
    return {
      id: it._id || `nav_new_${i}`,
      origem: "novo",
      modelo: it.modelo || "",
      cod_fixa: String(it.cod_fixa || ""),
      qtde_fixa: qf,
      valor_fixa: vf,
      cod_rot: String(it.cod_rot || ""),
      qtde_rot: qr,
      valor_rot: vr,
      total: arred(vf * qf + vr * qr),
    };
  });

  return daBase.concat(daNovas).sort((a, b) => ordemNatural(a.modelo, b.modelo));
}

// ─── Merge: peneiras (espelha renderPeneiras) ─────────────────────────────────

function montarPeneiras(base, ov) {
  const porChave = ov?.peneiras || {};
  const excluidas = ov?._deletedPeneiras || [];
  const novas = ov?._newPeneiras || [];

  const daBase = base
    .map((p, idx) => {
      const chave = "pen_" + idx;
      const o = porChave[chave] || {};
      const pick = (campo, padrao) => (o[campo] !== undefined ? o[campo] : (p[campo] ?? padrao));
      const valor = num(pick("valor", 0));
      const ipi = pick("ipi", "0%");
      const ipiNum = parseFloat(String(ipi).replace("%", "").replace(",", ".")) || 0;
      // O app só recalcula pelo IPI quando o IPI foi sobrescrito; caso contrário
      // preserva a razão total/valor que veio da planilha original.
      const fator = o.ipi !== undefined
        ? 1 + ipiNum / 100
        : (num(p.valor) > 0 && num(p.total) > 0 ? num(p.total) / num(p.valor) : 1);
      return {
        id: chave,
        origem: porChave[chave] ? "editado" : "original",
        modelo: pick("modelo", ""),
        valor: valor,
        ipi: String(ipi),
        furos_codigos: pick("furos_codigos", ""),
        total: arred(valor * fator),
      };
    })
    .filter((p) => excluidas.indexOf(p.id) === -1);

  const daNovas = novas.map((it, i) => {
    const ipiNum = parseFloat(String(it.ipi || "0").replace("%", "").replace(",", ".")) || 0;
    return {
      id: it._id || `pen_new_${i}`,
      origem: "novo",
      modelo: it.modelo || "",
      valor: num(it.valor),
      ipi: String(it.ipi || "0%"),
      furos_codigos: it.furos_codigos || "",
      total: arred(num(it.valor) * (1 + ipiNum / 100)),
    };
  });

  return daBase.concat(daNovas).sort((a, b) => ordemNatural(a.modelo, b.modelo));
}

// ─── Merge: reciclagem (espelha renderReciclagem) ─────────────────────────────

function montarReciclagem(base, ov, specsRec) {
  const porChave = ov?.reciclagem || {};
  const excluidos = ov?._deletedReciclagem || [];
  const novos = ov?._newReciclagem || [];

  const daBase = base
    .map((r, idx) => {
      const chave = "rec_" + idx;
      const o = porChave[chave] || {};
      const pick = (campo, padrao) => (o[campo] !== undefined ? o[campo] : (r[campo] ?? padrao));
      const equipamento = pick("equipamento", "");
      return {
        id: chave,
        origem: porChave[chave] ? "editado" : "original",
        equipamento,
        potencia: String(pick("potencia", "")),
        valor: num(pick("valor", 0)),
        specs: specsRec?.[chave] ?? specsRec?.[equipamento] ?? null,
      };
    })
    .filter((r) => excluidos.indexOf(r.id) === -1);

  const daNovos = novos.map((it, i) => ({
    id: it._id || `rec_new_${i}`,
    origem: "novo",
    equipamento: it.equipamento || "",
    potencia: String(it.potencia || ""),
    valor: num(it.valor),
    specs: specsRec?.[it._id] ?? null,
  }));

  return daBase.concat(daNovos).sort((a, b) => ordemNatural(a.equipamento, b.equipamento));
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

const avisos = [];

function num(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function arred(v) {
  return Math.round(v * 100) / 100;
}

/** Ordenação natural, igual à _naturalSortStr do app (números comparados por valor). */
function ordemNatural(a, b) {
  const pad = (s) => String(s || "").replace(/\d+/g, (m) => m.padStart(12, "0"));
  return pad(a).localeCompare(pad(b));
}

function csv(linhas, colunas) {
  const escapar = (v) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [colunas.join(";")]
    .concat(linhas.map((l) => colunas.map((c) => escapar(l[c])).join(";")))
    .join("\n");
}

// ─── Validação ────────────────────────────────────────────────────────────────

function validar(dados) {
  const problemas = [];
  const add = (nivel, msg) => problemas.push({ nivel, msg });

  const dup = (lista, chave, rotulo) => {
    const vistos = new Map();
    for (const item of lista) {
      const k = chave(item);
      vistos.set(k, (vistos.get(k) || 0) + 1);
    }
    const repetidos = [...vistos].filter(([, n]) => n > 1);
    if (repetidos.length) {
      add("aviso", `${rotulo}: ${repetidos.length} chave(s) repetida(s) — ex.: ${repetidos.slice(0, 3).map(([k, n]) => `"${k}" (${n}x)`).join(", ")}`);
    }
  };

  // Equipamentos
  const eq = dados.equipamentos;
  const semModelo = eq.filter((e) => !e.modelo.trim());
  if (semModelo.length) add("erro", `Equipamentos sem modelo: ${semModelo.length}`);
  const semPreco = eq.filter((e) => e.valor_maquina <= 0);
  if (semPreco.length) add("aviso", `Equipamentos com valor de máquina zerado: ${semPreco.length} (viram "solicitar com engenharia" no ERP)`);
  const semLinha = eq.filter((e) => !e.linha.trim());
  if (semLinha.length) add("aviso", `Equipamentos sem linha definida: ${semLinha.length}`);
  const semSpecs = eq.filter((e) => !e.specs);
  if (semSpecs.length) add("info", `Equipamentos sem ficha técnica: ${semSpecs.length} de ${eq.length}`);
  dup(eq, (e) => `${e.modelo}|${e.descricao}`, "Equipamentos (modelo+descrição)");

  // Navalhas
  const nav = dados.navalhas;
  const navSemCod = nav.filter((n) => !n.cod_fixa && !n.cod_rot);
  if (navSemCod.length) add("aviso", `Navalhas sem nenhum código de peça: ${navSemCod.length}`);
  const navTotalZero = nav.filter((n) => n.total <= 0);
  if (navTotalZero.length) add("aviso", `Navalhas com total zerado: ${navTotalZero.length}`);
  dup(nav, (n) => n.modelo, "Navalhas (modelo)");

  // Peneiras
  const pen = dados.peneiras;
  const penSemFuros = pen.filter((p) => !p.furos_codigos.trim());
  if (penSemFuros.length) add("aviso", `Peneiras sem códigos de furo: ${penSemFuros.length}`);
  const penIncoerente = pen.filter((p) => p.valor > 0 && p.total < p.valor);
  if (penIncoerente.length) add("erro", `Peneiras com total menor que o valor base: ${penIncoerente.length}`);
  dup(pen, (p) => p.modelo, "Peneiras (modelo)");

  // Reciclagem
  const rec = dados.reciclagem;
  const recSemNome = rec.filter((r) => !r.equipamento.trim());
  if (recSemNome.length) add("erro", `Itens de reciclagem sem descrição: ${recSemNome.length}`);
  const recZerado = rec.filter((r) => r.valor <= 0);
  if (recZerado.length) add("aviso", `Itens de reciclagem com valor zerado: ${recZerado.length}`);
  dup(rec, (r) => r.equipamento, "Reciclagem (equipamento)");

  // Encoding — o index.html tem trechos com acentuação corrompida
  const mojibake = [];
  for (const [nome, lista, campo] of [
    ["equipamentos", eq, "descricao"],
    ["reciclagem", rec, "equipamento"],
  ]) {
    const ruins = lista.filter((i) => /\uFFFD|Ã[\u0080-\u00BF]|â[\u0082\u0080]/.test(String(i[campo] || "")));
    if (ruins.length) mojibake.push(`${nome}: ${ruins.length}`);
  }
  if (mojibake.length) add("erro", `Textos com acentuação corrompida (${mojibake.join(", ")}) — precisam de correção antes de carregar no ERP`);

  return problemas;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(INDEX)) {
    console.error(`index.html não encontrado em ${INDEX}`);
    process.exit(1);
  }

  const html = fs.readFileSync(INDEX, "utf8");

  const base = {
    machines: lerConstante(html, "MACHINES", []),
    navalhas: lerConstante(html, "NAVALHAS", []),
    peneiras: lerConstante(html, "PENEIRAS", []),
    reciclagem: lerConstante(html, "RECICLAGEM", []),
    linhasPepp: lerConstante(html, "LINHAS_PEPP", []),
    specs: lerConstante(html, "SPECS", {}),
    representantes: lerConstante(html, "REPRESENTANTES_SEED", []),
  };

  const remoto = await buscarOverrides(html);
  const temOverrides = remoto !== null;

  const dados = {
    equipamentos: montarEquipamentos(base.machines, remoto?.equip, base.specs),
    navalhas: montarNavalhas(base.navalhas, remoto?.extraOverrides),
    peneiras: montarPeneiras(base.peneiras, remoto?.extraOverrides),
    reciclagem: montarReciclagem(base.reciclagem, remoto?.extraOverrides, remoto?.reciclagemSpecs),
    linhas_pepp: base.linhasPepp,
    representantes: base.representantes,
  };

  const problemas = validar(dados);

  const meta = {
    exportado_em: new Date().toISOString(),
    origem: CATALOGO_DIR,
    overrides_do_supabase_aplicados: temOverrides,
    contagem_base: {
      equipamentos: base.machines.length,
      navalhas: base.navalhas.length,
      peneiras: base.peneiras.length,
      reciclagem: base.reciclagem.length,
    },
    contagem_final: {
      equipamentos: dados.equipamentos.length,
      navalhas: dados.navalhas.length,
      peneiras: dados.peneiras.length,
      reciclagem: dados.reciclagem.length,
      linhas_pepp: dados.linhas_pepp.length,
      representantes: dados.representantes.length,
    },
    editados: {
      equipamentos: dados.equipamentos.filter((e) => e.origem === "editado").length,
      navalhas: dados.navalhas.filter((e) => e.origem === "editado").length,
      peneiras: dados.peneiras.filter((e) => e.origem === "editado").length,
      reciclagem: dados.reciclagem.filter((e) => e.origem === "editado").length,
    },
    novos: {
      equipamentos: dados.equipamentos.filter((e) => e.origem === "novo").length,
      navalhas: dados.navalhas.filter((e) => e.origem === "novo").length,
      peneiras: dados.peneiras.filter((e) => e.origem === "novo").length,
      reciclagem: dados.reciclagem.filter((e) => e.origem === "novo").length,
    },
    avisos_de_extracao: avisos,
    validacao: problemas,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const escrever = (nome, conteudo) => fs.writeFileSync(path.join(OUT_DIR, nome), conteudo, "utf8");

  escrever("catalogo-completo.json", JSON.stringify({ meta, ...dados }, null, 2));
  escrever("_relatorio.json", JSON.stringify(meta, null, 2));

  escrever("equipamentos.csv", csv(dados.equipamentos.map((e) => ({ ...e, specs: e.specs ? "sim" : "" })),
    ["id", "origem", "modelo", "descricao", "linha", "valor_maquina", "valor_painel_220", "valor_painel_380", "specs", "imagem"]));
  escrever("navalhas.csv", csv(dados.navalhas,
    ["id", "origem", "modelo", "cod_fixa", "qtde_fixa", "valor_fixa", "cod_rot", "qtde_rot", "valor_rot", "total"]));
  escrever("peneiras.csv", csv(dados.peneiras,
    ["id", "origem", "modelo", "valor", "ipi", "total", "furos_codigos"]));
  escrever("reciclagem.csv", csv(dados.reciclagem.map((r) => ({ ...r, specs: r.specs ? "sim" : "" })),
    ["id", "origem", "equipamento", "potencia", "valor", "specs"]));
  escrever("linhas-pepp.csv", csv(dados.linhas_pepp, ["categoria", "capacidade", "valor"]));

  // Relatório em texto
  const l = [];
  l.push("EXPORTACAO DO CATALOGO SEIBT");
  l.push("=".repeat(60));
  l.push(`Data: ${new Date().toLocaleString("pt-BR")}`);
  l.push(`Overrides do Supabase aplicados: ${temOverrides ? "SIM" : "NAO"}`);
  l.push("");
  l.push("REGISTROS EXPORTADOS");
  l.push("-".repeat(60));
  for (const [k, v] of Object.entries(meta.contagem_final)) {
    const ed = meta.editados[k], nv = meta.novos[k];
    const extra = ed || nv ? `   (${ed || 0} editados, ${nv || 0} novos)` : "";
    l.push(`${k.padEnd(18)} ${String(v).padStart(6)}${extra}`);
  }
  l.push("");
  l.push("VALIDACAO");
  l.push("-".repeat(60));
  if (!problemas.length) l.push("Nenhum problema encontrado.");
  for (const p of problemas) l.push(`[${p.nivel.toUpperCase()}] ${p.msg}`);
  if (avisos.length) {
    l.push("");
    l.push("AVISOS DE EXTRACAO");
    l.push("-".repeat(60));
    for (const a of avisos) l.push(`- ${a}`);
  }
  const relatorio = l.join("\n");
  escrever("_relatorio.txt", relatorio);

  console.log(relatorio);
  console.log("");
  console.log(`Arquivos gravados em: ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

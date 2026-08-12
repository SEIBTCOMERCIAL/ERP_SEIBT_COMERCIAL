/**
 * Carrega o catálogo exportado para dentro do ERP (Supabase).
 *
 * Roda em modo simulação por padrão — só grava no banco com --executar.
 * É idempotente: reexecutar atualiza os produtos existentes pelo `codigo`
 * em vez de duplicar.
 *
 *   node scripts/carregar-catalogo-erp.mjs              # simula
 *   node scripts/carregar-catalogo-erp.mjs --executar   # grava
 *
 * Regras de mapeamento:
 *  - Equipamentos  -> categoria 'maquina',    codigo = "MODELO DESCRICAO"
 *  - Navalhas      -> categoria 'navalha',    codigo = código real da peça (fixa e rotora viram produtos separados)
 *  - Peneiras      -> categoria 'peneira',    codigo = código real do furo (1 produto por diâmetro)
 *  - Reciclagem    -> categoria 'periferico', codigo = REC-NNNN
 *  - Linhas PEPP   -> categoria 'linha',      codigo = PEPP-NN
 *
 * Peças que compartilham o mesmo código entre modelos viram UM produto,
 * ligado a várias máquinas via compatibilidades_equip.
 */

import fs from "fs";
import path from "path";

const EXECUTAR = process.argv.includes("--executar");
const RAIZ = process.cwd();
const CATALOGO = JSON.parse(fs.readFileSync(path.join(RAIZ, "export-catalogo/catalogo-completo.json"), "utf8"));

// Decisão do usuário: das duas linhas "MGHS 1000" nas navalhas, fica a de 6 rotoras (nav_10).
const NAVALHAS_DESCARTADAS = ["nav_9"];

// ─── Conexão ──────────────────────────────────────────────────────────────────

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) { console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.local"); process.exit(1); }

const cabecalhos = (extra = {}) => ({
  apikey: CHAVE, Authorization: `Bearer ${CHAVE}`,
  "Content-Type": "application/json", ...extra,
});

async function api(caminho, opcoes = {}) {
  const r = await fetch(`${URL}/rest/v1/${caminho}`, { ...opcoes, headers: cabecalhos(opcoes.headers) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${caminho.slice(0, 60)} :: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

/**
 * Insere em lotes com upsert pelo campo de conflito.
 *
 * O PostgREST rejeita um lote cujos objetos não tenham exatamente as mesmas
 * chaves ("All object keys must match"), então o conjunto de colunas é
 * uniformizado — o que faltar entra como null.
 */
async function upsert(tabela, linhas, conflito, lote = 200) {
  const resultado = [];
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const uniformes = linhas.map((l) => Object.fromEntries(colunas.map((c) => [c, l[c] ?? null])));
  for (let i = 0; i < uniformes.length; i += lote) {
    const fatia = uniformes.slice(i, i + lote);
    const r = await api(`${tabela}?on_conflict=${conflito}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(fatia),
    });
    resultado.push(...(r || []));
    process.stdout.write(`\r   ${tabela}: ${Math.min(i + lote, linhas.length)}/${linhas.length}   `);
  }
  if (linhas.length) process.stdout.write("\n");
  return resultado;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const up = (s) => norm(s).toUpperCase();
/** Códigos de peça vazios no catálogo aparecem como "/", "-" ou travessão. */
const codigoVazio = (c) => { const s = norm(c); return !s || s === "/" || s === "-" || s === "—" || s === "–"; };

const NOMES_LINHA = {
  A2: "Linha A2", BSC: "Linha BSC", "BSC BR": "Linha BSC BR", LR: "Linha LR",
  LRX: "Linha LRX", A: "Linha A", N: "Linha N",
  OUTROS: "Outros", PERIFERICOS: "Periféricos", RECICLAGEM: "Reciclagem", PEPP: "Linhas PEPP",
};
const nomeLinha = (chave) => NOMES_LINHA[up(chave)] || norm(chave) || "Sem linha";

const registro = { produtos: [], compat: [], avisos: [] };
const vistos = new Map(); // codigo -> índice em registro.produtos

/**
 * Colunas NOT NULL de `produtos` precisam de valor explícito: o lote uniformiza
 * as chaves preenchendo o que falta com null, o que anularia o DEFAULT da coluna.
 */
const PADRAO_PRODUTO = {
  ativo: true,
  status: "ativo",
  ipi_pct: 0,
  produto_especial: false,
  tem_variantes: false,
  solicitar_engenharia: false,
};

function addProduto(p) {
  const codigo = norm(p.codigo);
  if (!codigo) { registro.avisos.push(`Produto sem código descartado: ${p.descricao}`); return null; }
  if (vistos.has(codigo)) return vistos.get(codigo); // já existe: peça compartilhada
  const idx = registro.produtos.length;
  const limpo = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
  registro.produtos.push({ ...PADRAO_PRODUTO, ...limpo, codigo });
  vistos.set(codigo, idx);
  return idx;
}

// ─── Montagem dos produtos ────────────────────────────────────────────────────

/** Modelos de máquina -> lista de códigos de produto, para ligar as peças depois. */
const maquinasPorModelo = new Map();

function montarEquipamentos() {
  for (const e of CATALOGO.equipamentos) {
    const modelo = norm(e.modelo);
    const descricao = norm(e.descricao);
    const codigo = up(`${modelo} ${descricao}`);
    const semPreco = !(e.valor_maquina > 0);

    addProduto({
      codigo,
      categoria: "maquina",
      modelo: modelo || null,
      descricao: descricao || modelo,
      linha: nomeLinha(e.linha),
      preco_brl: e.valor_maquina || null,
      preco_painel_220: e.valor_painel_220 || null,
      preco_painel_380: e.valor_painel_380 || null,
      solicitar_engenharia: semPreco,
      specs: e.specs || null,
      foto_url: e.imagem && !e.imagem.includes("placeholder") ? e.imagem : null,
      _linhaChave: nomeLinha(e.linha),
    });

    if (modelo) {
      if (!maquinasPorModelo.has(up(modelo))) maquinasPorModelo.set(up(modelo), []);
      maquinasPorModelo.get(up(modelo)).push(codigo);
    }
  }
}

/**
 * Modelos citados por peças, separados por categoria. Usado para decidir se uma
 * peça genérica ("MGHS 300") pode cobrir uma variante ("MGHS 300 A2") — só pode
 * quando aquela variante NÃO tem peça própria da mesma categoria.
 */
const modelosComPecaPropria = { navalha: new Set(), peneira: new Set() };

function indexarModelosDePecas() {
  for (const n of CATALOGO.navalhas) {
    if (NAVALHAS_DESCARTADAS.includes(n.id)) continue;
    if (n.modelo) modelosComPecaPropria.navalha.add(up(n.modelo));
  }
  for (const p of CATALOGO.peneiras) if (p.modelo) modelosComPecaPropria.peneira.add(up(p.modelo));
}

/**
 * Liga uma peça às máquinas compatíveis.
 *
 * Casamento exato do modelo sempre vale. Quando o modelo da peça é genérico
 * (ex.: navalha "MGHS 300" e as máquinas são "MGHS 300 A2", "MGHS 300 BSC"…),
 * a peça só cobre as variantes que não possuem navalha/peneira própria — senão
 * duas peças diferentes apareceriam como compatíveis com a mesma máquina.
 */
function ligarCompat(codigoPeca, modeloPeca, categoria) {
  const chave = up(modeloPeca);
  if (!chave) return;

  const exatos = maquinasPorModelo.get(chave);
  if (exatos) {
    for (const codMaquina of exatos) registro.compat.push({ peca: codigoPeca, maquina: codMaquina });
    return;
  }

  const proprias = modelosComPecaPropria[categoria] ?? new Set();
  let ligou = 0;
  for (const [modeloMaquina, codigos] of maquinasPorModelo) {
    if (!modeloMaquina.startsWith(chave + " ")) continue;
    if (proprias.has(modeloMaquina)) {
      registro.avisos.push(`"${modeloPeca}" não estendida a "${modeloMaquina}" (tem ${categoria} própria)`);
      continue;
    }
    for (const codMaquina of codigos) registro.compat.push({ peca: codigoPeca, maquina: codMaquina });
    ligou++;
  }

  if (!ligou) registro.avisos.push(`Sem máquina no catálogo para "${modeloPeca}" (${categoria} ${codigoPeca}) — peça de reposição mantida sem vínculo`);
}

function montarNavalhas() {
  for (const n of CATALOGO.navalhas) {
    if (NAVALHAS_DESCARTADAS.includes(n.id)) continue;
    const modelo = norm(n.modelo);

    for (const [cod, tipo, qtde, valor] of [
      [n.cod_fixa, "FIXA", n.qtde_fixa, n.valor_fixa],
      [n.cod_rot, "ROTORA", n.qtde_rot, n.valor_rot],
    ]) {
      if (!(valor > 0) && codigoVazio(cod)) continue;
      const codigo = codigoVazio(cod) ? `NAV-${n.id.toUpperCase()}-${tipo[0]}` : norm(cod);

      addProduto({
        codigo,
        categoria: "navalha",
        modelo: modelo || null,
        descricao: `NAVALHA ${tipo} ${modelo}`.trim(),
        preco_brl: valor || null,
        _catPeca: "Navalhas",
        _qtde: qtde || null,
      });
      ligarCompat(codigo, modelo, "navalha");
    }
  }
}

function montarPeneiras() {
  for (const p of CATALOGO.peneiras) {
    const modelo = norm(p.modelo);
    const ipi = parseFloat(String(p.ipi).replace("%", "").replace(",", ".")) || 0;
    // "Ø4: 1437 | Ø6: 1439" — aceita ':' ou espaço como separador
    const partes = norm(p.furos_codigos).split("|").map((s) => s.trim()).filter((s) => s && !codigoVazio(s));
    const furos = [];
    for (const parte of partes) {
      const m = /^[ØøO]?\s*([\d.,]+)\s*[:\s]\s*(.+)$/.exec(parte);
      if (m) furos.push({ furo: m[1].replace(",", "."), cod: norm(m[2]) });
      else registro.avisos.push(`Furo não interpretado em ${modelo}: "${parte}"`);
    }

    if (!furos.length) {
      // Peneira sem tabela de furos: entra como um produto único.
      const codigo = `PEN-${p.id.toUpperCase()}`;
      addProduto({
        codigo, categoria: "peneira", modelo: modelo || null,
        descricao: `PENEIRA ${modelo}`.trim(),
        preco_brl: p.valor || null, ipi_pct: ipi,
        _catPeca: "Peneiras",
      });
      ligarCompat(codigo, modelo, "peneira");
      continue;
    }

    for (const f of furos) {
      const codigo = norm(f.cod);
      addProduto({
        codigo, categoria: "peneira", modelo: modelo || null,
        descricao: `PENEIRA ${modelo} Ø${f.furo}`.trim(),
        preco_brl: p.valor || null, ipi_pct: ipi,
        furo_diametro: parseFloat(f.furo) || null,
        _catPeca: "Peneiras",
      });
      ligarCompat(codigo, modelo, "peneira");
    }
  }
}

function montarReciclagem() {
  for (const r of CATALOGO.reciclagem) {
    const seq = String(r.id).replace(/\D/g, "").padStart(4, "0");
    const nome = norm(r.equipamento);
    addProduto({
      codigo: `REC-${seq}`,
      categoria: "periferico",
      descricao: r.potencia ? `${nome} — ${r.potencia} CV` : nome,
      linha: "Reciclagem",
      preco_brl: r.valor || null,
      potencia_motor: r.potencia ? String(r.potencia) : null,
      solicitar_engenharia: !(r.valor > 0),
      specs: r.specs || null,
      _linhaChave: "Reciclagem",
    });
  }
}

function montarLinhasPepp() {
  CATALOGO.linhas_pepp.forEach((l, i) => {
    addProduto({
      codigo: `PEPP-${String(i + 1).padStart(2, "0")}`,
      categoria: "linha",
      descricao: [norm(l.categoria), norm(l.capacidade)].filter(Boolean).join(" — "),
      linha: "Linhas PEPP",
      preco_brl: l.valor || null,
      solicitar_engenharia: !(l.valor > 0),
      _linhaChave: "Linhas PEPP",
    });
  });
}

// ─── Execução ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(EXECUTAR ? "MODO GRAVACAO\n" : "MODO SIMULACAO — nada sera gravado. Use --executar para gravar.\n");

  montarEquipamentos();
  indexarModelosDePecas();
  montarNavalhas();
  montarPeneiras();
  montarReciclagem();
  montarLinhasPepp();

  const porCategoria = {};
  for (const p of registro.produtos) porCategoria[p.categoria] = (porCategoria[p.categoria] || 0) + 1;

  console.log("PRODUTOS A CARREGAR");
  console.log("-".repeat(58));
  for (const [c, n] of Object.entries(porCategoria)) console.log(`  ${c.padEnd(14)} ${String(n).padStart(5)}`);
  console.log(`  ${"TOTAL".padEnd(14)} ${String(registro.produtos.length).padStart(5)}`);
  console.log(`\n  compatibilidades peça→máquina: ${registro.compat.length}`);

  const compartilhadas = registro.compat.reduce((m, c) => m.set(c.peca, (m.get(c.peca) || 0) + 1), new Map());
  console.log(`  peças servindo mais de uma máquina: ${[...compartilhadas.values()].filter((n) => n > 1).length}`);

  if (registro.avisos.length) {
    console.log(`\nAVISOS (${registro.avisos.length})`);
    console.log("-".repeat(58));
    const amostra = [...new Set(registro.avisos)].slice(0, 12);
    amostra.forEach((a) => console.log(`  ${a}`));
    if (registro.avisos.length > amostra.length) console.log(`  ... e mais ${registro.avisos.length - amostra.length}`);
  }

  if (!EXECUTAR) {
    fs.writeFileSync(path.join(RAIZ, "export-catalogo/_previa-carga.json"),
      JSON.stringify({ porCategoria, produtos: registro.produtos, compat: registro.compat, avisos: registro.avisos }, null, 2));
    console.log("\nPrévia gravada em export-catalogo/_previa-carga.json");
    return;
  }

  // 1. Linhas
  console.log("\nGravando...");
  const nomesLinha = [...new Set(registro.produtos.map((p) => p._linhaChave).filter(Boolean))];
  const linhasGravadas = await upsert("linhas", nomesLinha.map((nome, i) => ({ nome, ordem: i })), "nome");
  const todasLinhas = await api("linhas?select=id,nome");
  const idLinha = new Map(todasLinhas.map((l) => [l.nome, l.id]));

  // 2. Categorias de peça
  const catsNecessarias = [...new Set(registro.produtos.map((p) => p._catPeca).filter(Boolean))];
  const catsExistentes = await api("categorias_peca?select=id,nome");
  const nomesExistentes = new Set(catsExistentes.map((c) => c.nome));
  const novasCats = catsNecessarias.filter((c) => !nomesExistentes.has(c));
  if (novasCats.length) await upsert("categorias_peca", novasCats.map((nome, i) => ({ nome, ordem: 90 + i })), "nome");
  const todasCats = await api("categorias_peca?select=id,nome");
  const idCat = new Map(todasCats.map((c) => [c.nome, c.id]));

  // 3. Produtos
  const paraGravar = registro.produtos.map((p) => {
    const { _linhaChave, _catPeca, _qtde, ...limpo } = p;
    return {
      ...limpo,
      linha_id: _linhaChave ? idLinha.get(_linhaChave) ?? null : null,
      categoria_peca_id: _catPeca ? idCat.get(_catPeca) ?? null : null,
    };
  });
  const gravados = await upsert("produtos", paraGravar, "codigo");

  // 4. Compatibilidades
  const todosProdutos = await api("produtos?select=id,codigo&limit=5000");
  const idProduto = new Map(todosProdutos.map((p) => [p.codigo, p.id]));
  const compatLinhas = [];
  const jaVisto = new Set();
  for (const c of registro.compat) {
    const peca_id = idProduto.get(c.peca), equipamento_id = idProduto.get(c.maquina);
    if (!peca_id || !equipamento_id) continue;
    const k = peca_id + equipamento_id;
    if (jaVisto.has(k)) continue;
    jaVisto.add(k);
    compatLinhas.push({ peca_id, equipamento_id });
  }
  if (compatLinhas.length) await upsert("compatibilidades_equip", compatLinhas, "peca_id,equipamento_id");

  // 5. Conferência final
  const contar = async (t, filtro = "") => {
    const r = await fetch(`${URL}/rest/v1/${t}?select=id${filtro}`, {
      headers: cabecalhos({ Prefer: "count=exact", Range: "0-0" }),
    });
    return (r.headers.get("content-range") || "").split("/")[1] ?? "?";
  };

  console.log("\nCONFERENCIA NO BANCO");
  console.log("-".repeat(58));
  for (const cat of Object.keys(porCategoria)) {
    console.log(`  produtos ${cat.padEnd(12)} ${String(await contar("produtos", `&categoria=eq.${cat}`)).padStart(6)}`);
  }
  console.log(`  produtos TOTAL       ${String(await contar("produtos")).padStart(6)}`);
  console.log(`  linhas               ${String(await contar("linhas")).padStart(6)}`);
  console.log(`  categorias_peca      ${String(await contar("categorias_peca")).padStart(6)}`);
  console.log(`  compatibilidades     ${String(await contar("compatibilidades_equip")).padStart(6)}`);
  console.log(`\nGravados/atualizados nesta execucao: ${gravados.length} produtos.`);
}

main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });

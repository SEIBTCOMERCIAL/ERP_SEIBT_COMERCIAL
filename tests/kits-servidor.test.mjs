// Servidor de kits, peneiras e IPI com cliente de banco simulado (sem rede), e conferência com catálogo e propostas.
import test from "node:test";
import assert from "node:assert/strict";
import { listarKits, listarPeneiras, definirIpiNavalhas } from "../src/lib/reajuste/kits-servidor.ts";
import { carregarJogosNavalhas } from "../src/lib/catalogo/dados.ts";
import { tipoDaCategoria } from "../src/lib/reajuste/servidor.ts";
import { totalJogo } from "../src/lib/propostas/jogos-navalha.ts";

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

function banco(tabelas, rpcResp) {
  const chamadas = [];
  const from = (nome) => {
    const passos = [];
    const proxy = new Proxy({}, { get(_, m) {
      if (m === "then") return (res) => {
        let d = tabelas[nome] ?? [];
        if (typeof d === "function") d = d(passos);
        for (const [p, a, b] of passos) {
          if (p === "eq" && typeof b !== "boolean") d = d.filter((r) => r[a] === b);
          if (p === "in") d = d.filter((r) => b.includes(r[a]));
        }
        res({ data: d, error: null, count: d.length });
      };
      return (...args) => { passos.push([m, ...args]); return proxy; };
    } });
    return proxy;
  };
  return { chamadas, from, rpc: async (n, a) => { chamadas.push([n, a]); return rpcResp ? rpcResp(n, a) : { data: null, error: null }; } };
}

const eq = (id, codigo, extra = {}) => ({ id, codigo, deleted_at: null, ...extra });
const prod = (id, codigo, descricao, categoria, preco, ipi, extra = {}) => ({ id, codigo, descricao, categoria, preco_brl: preco, ipi_pct: ipi, ativo: true, status: "ativo", deleted_at: null, categoria_peca_id: "C1", modelo: null, ...extra });
const item = (id, titulo, pecas, produto_id, ordem, codigo = null) => ({ id, titulo, pecas, codigo, ordem, produto_id });
const linhaPS = { nome: "Linha PS", ordem: 1 };

function cenario() {
  const produtos = [
    prod(U(1), "F160", "NAVALHA FIXA PS 160", "navalha", 100.1, 5.2),
    prod(U(2), "R160", "NAVALHA ROTORA PS 160", "navalha", 250.55, 5.2),
    prod(U(3), "F50", "NAVALHA FIXA PS 50", "navalha", 50, 5.2),
    prod(U(4), "R50", "NAVALHA ROTORA PS 50", "navalha", null, 5.2),
    prod(U(5), "SOLTA", "NAVALHA FIXA SOLTA", "navalha", 10, 5.2),
    prod(U(6), "F100", "NAVALHA FIXA PS 100", "navalha", 70, 3.25),
    prod(U(7), "R100", "NAVALHA ROTORA PS 100", "navalha", 90, 5.2),
  ];
  const jogo = (id, equip, codigo, material, ordem, itens) => ({ id, equipamento_id: equip, nome: "Padrão", material, ativo: true, ordem, equipamento: eq(equip, codigo, { status: "ativo", linha: linhaPS }), itens });
  const jogos = [
    jogo(U(101), U(11), "PS 160", null, 1, [item(U(201), "NAVALHA FIXA PS 160", 3, U(1), 1), item(U(202), "NAVALHAS ROTORAS ESQ. MOINHO PS 160", 2, U(2), 2, "A"), item(U(203), "NAVALHAS ROTORAS DIR. MOINHO PS 160", 2, U(2), 3, "B")]),
    jogo(U(102), U(12), "PS 50", null, 1, [item(U(204), "NAVALHA FIXA PS 50", 1, U(3), 1), item(U(205), "NAVALHAS ROTORAS MOINHO PS 50", 2, U(4), 2)]),
    jogo(U(103), U(11), "PS 160", "Aço inox", 2, [item(U(206), "NAVALHA FIXA PS 160", 3, U(1), 1)]),
    jogo(U(104), U(13), "PS 100", null, 1, [item(U(207), "NAVALHA FIXA PS 100", 1, U(6), 1), item(U(208), "NAVALHAS ROTORAS MOINHO PS 100", 1, U(7), 2)]),
  ];
  const tabelas = {
    jogos_navalha: jogos,
    produtos: (passos) => produtos.filter((p) => !passos.some(([m, a]) => m === "eq" && a === "categoria") || passos.some(([m, a, b]) => m === "eq" && a === "categoria" && p.categoria === b)),
    historico_precos: [], categorias_peca: [{ id: "C1", nome: "Navalhas" }],
  };
  return { tabelas, jogos, produtos };
}

test("kits: uma linha por kit, ordem natural, kits do mesmo modelo preservados, total central e kit incompleto", async () => {
  const { tabelas } = cenario();
  const r = await listarKits(banco(tabelas), { busca: "", situacao: "todas", pagina: 1 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.kits.map((k) => `${k.modelo}${k.variante ? " · " + k.variante : ""}`), ["PS 50", "PS 100", "PS 160", "PS 160 · Aço inox"]);
  const k160 = r.kits[2];
  assert.equal(k160.calculo.subtotalFixas, 300.3);
  assert.equal(k160.calculo.subtotalRotoras, 1002.2);
  assert.equal(k160.calculo.total, 1370.24); // 315,92 + 527,16 + 527,16 (IPI arredondado por linha)
  assert.equal(k160.pecasUnicas, 2);
  assert.equal(k160.componentes.length, 3);
  const k50 = r.kits[0];
  assert.equal(k50.calculo.total, null);
  assert.equal(k50.calculo.subtotalRotoras, null);
  assert.equal(r.kits[1].calculo.aliquota, "variavel");
  assert.equal(r.resumo.kits, 4);
  assert.equal(r.resumo.incompletos, 1);
  assert.equal(r.resumo.pecas, 6);
  assert.equal(k160.componentes[0].compartilhadoCom.length, 1);
  assert.match(k160.componentes[0].compartilhadoCom[0].rotulo, /Aço inox/);
});

test("sem kit definido não some; busca e filtro de situação valem para tudo", async () => {
  const { tabelas } = cenario();
  const r = await listarKits(banco(tabelas), { busca: "", situacao: "todas", pagina: 1 });
  assert.deepEqual(r.semKit.map((i) => i.codigo), ["SOLTA"]);
  assert.equal(r.resumo.sem_kit, 1);
  const busca = await listarKits(banco(tabelas), { busca: "inox", situacao: "todas", pagina: 1 });
  assert.equal(busca.total, 1);
  const porCodigo = await listarKits(banco(tabelas), { busca: "r100", situacao: "todas", pagina: 1 });
  assert.deepEqual(porCodigo.kits.map((k) => k.modelo), ["PS 100"]);
  const semPreco = await listarKits(banco(tabelas), { busca: "", situacao: "sem_preco", pagina: 1 });
  assert.deepEqual(semPreco.kits.map((k) => k.modelo), ["PS 50"]);
  assert.equal(semPreco.semKit.length, 0);
});

test("catálogo, propostas e listagem mostram o mesmo total do conjunto", async () => {
  const { tabelas, jogos } = cenario();
  const todos = tabelas.produtos([]);
  const lista = await listarKits(banco(tabelas), { busca: "", situacao: "todas", pagina: 1 });
  const porModelo = Object.fromEntries(lista.kits.filter((k) => !k.variante).map((k) => [k.modelo, k.calculo.total]));

  const catalogo = await carregarJogosNavalhas(banco({
    jogos_navalha: jogos.map((j) => ({ ...j, itens: j.itens.map((i) => ({ ...i, produto: todos.find((p) => p.id === i.produto_id) })) })),
  }));
  assert.equal(catalogo.find((c) => c.modelo === "PS 160").valorTotalComIpi, porModelo["PS 160"]);
  assert.equal(catalogo.find((c) => c.modelo === "PS 100").valorTotalComIpi, porModelo["PS 100"]);
  assert.equal(catalogo.find((c) => c.modelo === "PS 50").valorTotalComIpi, null);
  assert.deepEqual(catalogo.map((c) => c.modelo), ["PS 50", "PS 100", "PS 160", "PS 160 – Aço inox"]);

  const jogoProposta = { itens: jogos[0].itens.map((i) => { const p = todos.find((x) => x.id === i.produto_id); return { titulo: i.titulo, pecas: i.pecas, preco: p.preco_brl, ipi: p.ipi_pct }; }) };
  assert.equal(totalJogo(jogoProposta), porModelo["PS 160"]);
});

test("peneiras: agrupadas por modelo, medidas em ordem numérica, sem modelo à parte e busca por característica", async () => {
  const pen = (id, codigo, descricao, furo) => prod(id, codigo, descricao, "peneira", 10, 0, { furo_diametro: furo, categoria_peca_id: "C2" });
  const tabelas = {
    produtos: [pen(U(31), "P10", "PENEIRA 800X300", "10"), pen(U(32), "P2", "PENEIRA 800X300", "2"), pen(U(33), "P3", "PENEIRA 800X300", "3"), pen(U(34), "ORF", "PENEIRA ORFA", "1")],
    compatibilidades_equip: [
      { peca_id: U(31), equipamento: eq(U(11), "MGHS 1000") }, { peca_id: U(32), equipamento: eq(U(11), "MGHS 1000") },
      { peca_id: U(33), equipamento: eq(U(12), "MGHS 200") }, { peca_id: U(32), equipamento: eq(U(12), "MGHS 200") },
    ],
    historico_precos: [],
  };
  const r = await listarPeneiras(banco(tabelas), { busca: "", situacao: "todas", pagina: 1 });
  assert.deepEqual(r.grupos.map((g) => g.modelo), ["MGHS 200", "MGHS 1000", null]);
  assert.deepEqual(r.grupos[0].itens.map((i) => i.codigo), ["P2", "P3"]);
  assert.deepEqual(r.grupos[1].itens.map((i) => i.codigo), ["P2", "P10"]);
  assert.equal(r.produtos, 4);
  assert.equal(r.sem_modelo, 1);
  const f = await listarPeneiras(banco(tabelas), { busca: "orfa", situacao: "todas", pagina: 1 });
  assert.deepEqual(f.grupos.map((g) => g.modelo), [null]);
  const porModelo = await listarPeneiras(banco(tabelas), { busca: "mghs 200", situacao: "todas", pagina: 1 });
  assert.equal(porModelo.grupos.length, 2);
});

test("IPI manual no servidor: só navalhas, validação e tradução dos erros do banco", async () => {
  const navalha = { id: U(1), codigo: "F160", categoria: "navalha", deleted_at: null };
  const peneira = { id: U(2), codigo: "PEN", categoria: "peneira", deleted_at: null };
  const db = (rpc) => banco({ produtos: [navalha, peneira] }, rpc);
  const ok = await definirIpiNavalhas(db(() => ({ data: { produtos: 1, alterados: 1, sem_mudanca: 0 }, error: null })), { produtoIds: [U(1)], ipi: "6,5", motivo: "Material especial" });
  assert.deepEqual([ok.ok, ok.alterados], [true, 1]);
  const barato = db(() => ({ data: {}, error: null }));
  const naoNavalha = await definirIpiNavalhas(barato, { produtoIds: [U(1), U(2)], ipi: "5,2", motivo: "motivo" });
  assert.equal(naoNavalha.ok, false);
  assert.match(naoNavalha.erro, /não é uma navalha/);
  assert.equal(barato.chamadas.length, 0);
  assert.equal((await definirIpiNavalhas(db(), { produtoIds: [U(1)], ipi: "150", motivo: "motivo" })).tipo, "validacao");
  assert.equal((await definirIpiNavalhas(db(), { produtoIds: [U(1)], ipi: "5", motivo: "a" })).tipo, "validacao");
  assert.equal((await definirIpiNavalhas(db(), { produtoIds: ["x"], ipi: "5", motivo: "motivo" })).tipo, "validacao");
  assert.equal((await definirIpiNavalhas(db(() => ({ data: null, error: { message: "SEM_PERMISSAO" } })), { produtoIds: [U(1)], ipi: "5", motivo: "motivo" })).tipo, "permissao");
  assert.equal((await definirIpiNavalhas(db(() => ({ data: null, error: { message: "Could not find the function public.produto_definir_ipi" } })), { produtoIds: [U(1)], ipi: "5", motivo: "motivo" })).tipo, "nao_aplicado");
});

test("as categorias Navalhas e Peneiras ativam a visão própria no Reajuste (e as demais não)", () => {
  assert.equal(tipoDaCategoria("Navalhas"), "navalha");
  assert.equal(tipoDaCategoria("Peneiras"), "peneira");
  assert.equal(tipoDaCategoria("Parafusos"), null);
  assert.equal(tipoDaCategoria("Dutos e Curvas"), null);
  assert.equal(tipoDaCategoria(null), null);
});

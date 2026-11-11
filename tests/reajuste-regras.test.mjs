// Testes das regras de reajuste (sem banco). Rodar: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicarPercentual, variacaoPercentual, parsePercentual, parseMoeda, planejarReajuste, situacaoDoItem,
  hojeSaoPaulo, periodoDoAno, validarMotivo, componentesAplicaveis,
} from "../src/lib/reajuste/regras.ts";

const maquina = (id, extra = {}) => ({
  id, codigo: `M-${id}`, descricao: `Máquina ${id}`, tipo: "maquina", ativo: true, excluido: false,
  preco_brl: 100000, preco_painel_220: 5000, preco_painel_380: 6000, ...extra,
});
const peca = (id, extra = {}) => ({
  id, codigo: `P-${id}`, descricao: `Peça ${id}`, tipo: "peca", ativo: true, excluido: false,
  preco_brl: 199.99, preco_painel_220: null, preco_painel_380: null, ...extra,
});
const mapa = (...ps) => new Map(ps.map((p) => [p.id, p]));

test("percentual com vírgula, sinal e %", () => {
  assert.equal(parsePercentual("10,5").valor, 10.5);
  assert.equal(parsePercentual("  7% ").valor, 7);
  assert.equal(parsePercentual("-3,25").valor, -3.25);
  assert.equal(parsePercentual("+4").valor, 4);
  assert.equal(parsePercentual("0,0001").valor, 0.0001);
});

test("percentual inválido é rejeitado", () => {
  for (const x of ["", "abc", "1,2,3", "NaN", "Infinity", "-100", "-150", "1,23456", "1e3"]) {
    assert.ok(parsePercentual(x).erro, `deveria rejeitar "${x}"`);
  }
  assert.ok(parsePercentual(Number.NaN).erro);
  assert.ok(parsePercentual(Number.POSITIVE_INFINITY).erro);
  assert.ok(parsePercentual(null).erro);
});

test("valor em reais com vírgula e milhar", () => {
  assert.equal(parseMoeda("1.234,56").valor, 1234.56);
  assert.equal(parseMoeda("R$ 99,9").valor, 99.9);
  assert.equal(parseMoeda("1.234").valor, 1234);
  assert.equal(parseMoeda("12.5").valor, 12.5);
  for (const x of ["0", "-5", "abc", "1,234", "", "1,5,5"]) assert.ok(parseMoeda(x).erro, `deveria rejeitar "${x}"`);
});

test("arredondamento no centavo, meio centavo sobe", () => {
  assert.equal(aplicarPercentual(100, 10), 110);
  assert.equal(aplicarPercentual(199.99, 3.5), 206.99); // 206.98965
  assert.equal(aplicarPercentual(0.05, 10), 0.06); // 0,055 → 0,06
  assert.equal(aplicarPercentual(1.15, 10), 1.27); // 1,265 → 1,27 (sem erro de ponto flutuante)
  assert.equal(aplicarPercentual(10, 0.0001), 10);
  assert.equal(aplicarPercentual(123456.78, -12.3456), 108215.3);
});

test("variação percentual com 2 casas", () => {
  assert.equal(variacaoPercentual(100, 110), 10);
  assert.equal(variacaoPercentual(100, 90), -10);
  assert.equal(variacaoPercentual(3, 4), 33.33);
  assert.equal(variacaoPercentual(0, 10), null);
});

test("prévia e gravação usam o mesmo cálculo", () => {
  const produtos = mapa(maquina("a"));
  const entradas = [{ produto_id: "a", componente: "moinho", percentual: 4.75 }];
  const previa = planejarReajuste(produtos, entradas);
  const gravacao = planejarReajuste(produtos, entradas.map((e) => ({ ...e, esperado: 100000 })));
  assert.deepEqual(previa.itens, gravacao.itens);
  assert.equal(previa.itens[0].novo, 104750);
  assert.equal(previa.itens[0].diferenca, 4750);
});

test("reajuste de um e de vários componentes", () => {
  const produtos = mapa(maquina("a"));
  const um = planejarReajuste(produtos, [{ produto_id: "a", componente: "painel_220", percentual: 10 }]);
  assert.equal(um.itens.length, 1);
  assert.equal(um.itens[0].novo, 5500);
  const varios = planejarReajuste(produtos, [
    { produto_id: "a", componente: "moinho", percentual: 5 },
    { produto_id: "a", componente: "painel_220", percentual: 2 },
    { produto_id: "a", componente: "painel_380", percentual: 3 },
  ]);
  assert.deepEqual(varios.itens.map((i) => i.novo), [105000, 5100, 6180]);
});

test("peça e novo valor digitado", () => {
  const plano = planejarReajuste(mapa(peca("x")), [{ produto_id: "x", componente: "peca", novo: 250.5 }]);
  assert.equal(plano.itens[0].novo, 250.5);
  assert.equal(plano.itens[0].percentual, 25.26);
});

test("componente de máquina em peça é erro; painel inexistente é ignorado", () => {
  const erro = planejarReajuste(mapa(peca("x")), [{ produto_id: "x", componente: "painel_220", percentual: 5 }]);
  assert.equal(erro.itens.length, 0);
  assert.equal(erro.erros.length, 1);
  const semPainel = planejarReajuste(mapa(maquina("a", { preco_painel_380: null })), [{ produto_id: "a", componente: "painel_380", percentual: 5 }]);
  assert.equal(semPainel.ignorados[0].motivo, "sem_preco");
  assert.equal(semPainel.itens.length, 0);
});

test("operação sem mudança de preço não gera item", () => {
  const plano = planejarReajuste(mapa(maquina("a")), [{ produto_id: "a", componente: "moinho", percentual: 0 }]);
  assert.equal(plano.itens.length, 0);
  assert.equal(plano.ignorados[0].motivo, "sem_alteracao");
});

test("preço zero é diferente de não informado", () => {
  const zero = planejarReajuste(mapa(peca("z", { preco_brl: 0 })), [{ produto_id: "z", componente: "peca", percentual: 10 }]);
  assert.equal(zero.ignorados[0].motivo, "sem_alteracao"); // 0 existe, mas 0 × 1,1 continua 0
  const nulo = planejarReajuste(mapa(peca("n", { preco_brl: null })), [{ produto_id: "n", componente: "peca", percentual: 10 }]);
  assert.equal(nulo.ignorados[0].motivo, "sem_preco");
  assert.deepEqual(componentesAplicaveis(peca("z", { preco_brl: 0 })), ["peca"]);
  assert.deepEqual(componentesAplicaveis(peca("n", { preco_brl: null })), []);
});

test("excluído, inativo e inexistente são ignorados com motivo", () => {
  const plano = planejarReajuste(
    mapa(peca("e", { excluido: true }), peca("i", { ativo: false })),
    [
      { produto_id: "e", componente: "peca", percentual: 5 },
      { produto_id: "i", componente: "peca", percentual: 5 },
      { produto_id: "fantasma", componente: "peca", percentual: 5 },
    ]
  );
  assert.deepEqual(plano.ignorados.map((i) => i.motivo), ["excluido", "inativo", "nao_encontrado"]);
  assert.equal(plano.itens.length, 0);
});

test("alteração concorrente é detectada", () => {
  const produtos = mapa(maquina("a", { preco_brl: 101000 }));
  const plano = planejarReajuste(produtos, [{ produto_id: "a", componente: "moinho", esperado: 100000, percentual: 5 }]);
  assert.equal(plano.conflitos.length, 1);
  assert.equal(plano.conflitos[0].atual, 101000);
  assert.equal(plano.itens.length, 0);
});

test("entradas inválidas: percentual e valor juntos, nenhum, repetidos, NaN", () => {
  const p = mapa(maquina("a"));
  assert.equal(planejarReajuste(p, [{ produto_id: "a", componente: "moinho", percentual: 5, novo: 10 }]).erros.length, 1);
  assert.equal(planejarReajuste(p, [{ produto_id: "a", componente: "moinho" }]).erros.length, 1);
  assert.equal(planejarReajuste(p, [
    { produto_id: "a", componente: "moinho", percentual: 5 },
    { produto_id: "a", componente: "moinho", percentual: 6 },
  ]).erros.length, 1);
  assert.equal(planejarReajuste(p, [{ produto_id: "a", componente: "moinho", percentual: Number.NaN }]).erros.length, 1);
  assert.equal(planejarReajuste(p, [{ produto_id: "a", componente: "coluna_qualquer", percentual: 5 }]).erros.length, 1);
  assert.equal(planejarReajuste(p, [{ produto_id: "a", componente: "moinho", novo: -5 }]).erros.length, 1);
});

test("motivo obrigatório e sem texto genérico automático", () => {
  assert.ok(validarMotivo("").erro);
  assert.ok(validarMotivo("ab").erro);
  assert.ok(validarMotivo(undefined).erro);
  assert.equal(validarMotivo("  Reajuste   anual ").valor, "Reajuste anual");
  assert.ok(validarMotivo("x".repeat(201)).erro);
});

test("datas no fuso de Brasília", () => {
  // 02:30 UTC de 10/11 ainda é 09/11 em Brasília (UTC-3)
  assert.equal(hojeSaoPaulo(new Date("2026-11-10T02:30:00Z")), "2026-11-09");
  assert.equal(hojeSaoPaulo(new Date("2026-11-10T12:00:00Z")), "2026-11-10");
  assert.deepEqual(periodoDoAno("2026-11-09"), { inicio: "2026-01-01", fim: "2026-11-09" });
});

test("situação: sem reajuste, parcial, atualizado, sem preço", () => {
  const periodo = { inicio: "2026-01-01", fim: "2026-11-09" };
  const item = maquina("a");
  assert.equal(situacaoDoItem(item, [], periodo).situacao, "sem_reajuste");
  const so220 = [{ componente: "painel_220", data_reajuste: "2026-03-01" }];
  const parcial = situacaoDoItem(item, so220, periodo);
  assert.equal(parcial.situacao, "parcial");
  assert.deepEqual(parcial.pendentes, ["moinho", "painel_380"]);
  const todos = ["moinho", "painel_220", "painel_380"].map((c) => ({ componente: c, data_reajuste: "2026-05-05" }));
  assert.equal(situacaoDoItem(item, todos, periodo).situacao, "atualizado");
  assert.equal(situacaoDoItem(peca("n", { preco_brl: null }), todos, periodo).situacao, "sem_preco");
});

test("painel inexistente não é pendência", () => {
  const periodo = { inicio: "2026-01-01", fim: "2026-11-09" };
  const semPaineis = maquina("a", { preco_painel_220: null, preco_painel_380: null });
  const s = situacaoDoItem(semPaineis, [{ componente: "moinho", data_reajuste: "2026-02-02" }], periodo);
  assert.equal(s.situacao, "atualizado");
});

test("data futura ou de outro ano não conta; registro antigo sem componente vale para a máquina", () => {
  const periodo = { inicio: "2026-01-01", fim: "2026-11-09" };
  const item = maquina("a", { preco_painel_220: null, preco_painel_380: null });
  assert.equal(situacaoDoItem(item, [{ componente: "moinho", data_reajuste: "2026-12-31" }], periodo).situacao, "sem_reajuste");
  assert.equal(situacaoDoItem(item, [{ componente: "moinho", data_reajuste: "2025-12-31" }], periodo).situacao, "sem_reajuste");
  assert.equal(situacaoDoItem(item, [{ componente: null, data_reajuste: "2026-06-01" }], periodo).situacao, "atualizado");
  assert.equal(situacaoDoItem(peca("p"), [{ componente: null, data_reajuste: "2026-06-01" }], periodo).situacao, "atualizado");
});

test("cálculo em inteiros confere com a referência em BigInt (milhares de casos)", () => {
  let semente = 12345;
  const aleatorio = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
  for (let i = 0; i < 20000; i++) {
    const centavos = Math.floor(aleatorio() * 2_000_000_000); // até R$ 20 milhões
    const ppm = Math.round((aleatorio() * 250 - 90) * 10000) ; // de -90% a +160%
    const percentual = ppm / 10000;
    const ref = (BigInt(centavos) * BigInt(1_000_000 + ppm) + 500_000n) / 1_000_000n;
    assert.equal(Math.round(aplicarPercentual(centavos / 100, percentual) * 100), Number(ref), `${centavos} × ${percentual}%`);
  }
  for (let i = 0; i < 20000; i++) {
    const a = 1 + Math.floor(aleatorio() * 1_000_000_000);
    const n = Math.floor(aleatorio() * 2_000_000_000);
    const num = BigInt(n - a) * 10000n;
    const abs = num < 0n ? -num : num;
    const r = (abs * 2n + BigInt(a)) / (2n * BigInt(a));
    assert.equal(variacaoPercentual(a / 100, n / 100), Number(num < 0n ? -r : r) / 100, `${a} → ${n}`);
  }
});

test("preço inicial do cadastro (preço anterior vazio) não conta como reajuste", () => {
  const periodo = { inicio: "2026-01-01", fim: "2026-11-09" };
  const item = maquina("a", { preco_painel_220: null, preco_painel_380: null });
  const inicial = [{ componente: "moinho", data_reajuste: "2026-05-01", preco_anterior_brl: null }];
  assert.equal(situacaoDoItem(item, inicial, periodo).situacao, "sem_reajuste");
  const real = [...inicial, { componente: "moinho", data_reajuste: "2026-06-01", preco_anterior_brl: 100 }];
  assert.equal(situacaoDoItem(item, real, periodo).situacao, "atualizado");
});

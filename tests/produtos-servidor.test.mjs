// Testa a camada de servidor de Produtos com um cliente de banco simulado (sem rede, sem banco).
import test from "node:test";
import assert from "node:assert/strict";
import { listarProdutos, traduzirErro, carregarNavegacao } from "../src/lib/produtos/servidor.ts";
import { lerFiltros } from "../src/lib/produtos/regras.ts";

/** Cliente simulado: registra cada chamada de consulta e devolve o resultado combinado por tabela. */
function banco(respostas) {
  const chamadas = [];
  const construtor = (tabela) => {
    const registro = { tabela, passos: [] };
    chamadas.push(registro);
    const proxy = new Proxy({}, {
      get(_, nome) {
        if (nome === "then") {
          const r = respostas[tabela] ?? { data: [], count: 0, error: null };
          return (resolver) => resolver(typeof r === "function" ? r(registro) : r);
        }
        return (...args) => { registro.passos.push([nome, ...args]); return proxy; };
      },
    });
    return proxy;
  };
  return { chamadas, from: construtor, rpc: (nome) => { chamadas.push({ tabela: `rpc:${nome}`, passos: [] }); const r = respostas[`rpc:${nome}`] ?? { data: [], error: null }; return Promise.resolve(r); } };
}
const passos = (c, nome) => c.passos.filter((p) => p[0] === nome);

test("busca, filtros e paginação acontecem na consulta ao banco (não no navegador)", async () => {
  const db = banco({ produtos_resumo: { data: [], count: 130, error: null } });
  const f = lerFiltros({ aba: "maquinas", escopo: "20000000-0000-0000-0000-00000000000a", q: "mghs, 800 (a2)", pendencia: "sem_foto", pagina: "3", situacao: "todos", ordem: "preco", dir: "desc" });
  const r = await listarProdutos(db, f);
  assert.equal(r.ok, true);
  assert.equal(r.total, 130);
  assert.equal(r.pagina, 3);
  const c = db.chamadas[0];
  assert.equal(c.tabela, "produtos_resumo");
  assert.ok(passos(c, "eq").some((p) => p[1] === "linha_id" && p[2] === f.escopo));
  assert.ok(passos(c, "eq").some((p) => p[1] === "sem_foto" && p[2] === true));
  // cada palavra vira um filtro próprio e os caracteres perigosos não chegam ao banco
  const ors = passos(c, "or").map((p) => p[1]);
  assert.equal(ors.length, 3);
  assert.ok(ors.every((o) => !/[,()]{2}/.test(o.replace(/\.ilike\.%[^%]*%/g, "").replace(/,/g, "")) ));
  assert.ok(ors[0].includes("%mghs%") && ors[1].includes("%800%") && ors[2].includes("%a2%"));
  assert.ok(passos(c, "range").some((p) => p[1] === 48 && p[2] === 71)); // página 3 de 24 itens
  assert.ok(passos(c, "order").some((p) => p[1] === "preco_brl" && p[2].ascending === false));
  assert.equal(passos(c, "eq").some((p) => p[1] === "status"), false); // "todos": sem filtro de situação
});

test("lista padrão: só ativos; sem escopo usa a ordem configurada das famílias e linhas", async () => {
  const db = banco({ produtos_resumo: { data: [], count: 0, error: null } });
  await listarProdutos(db, lerFiltros({}));
  const c = db.chamadas[0];
  assert.ok(passos(c, "eq").some((p) => p[1] === "status" && p[2] === "ativo"));
  const ordem = passos(c, "order").map((p) => p[1]);
  assert.deepEqual(ordem.slice(0, 3), ["familia_ordem", "linha_ordem", "codigo"]); // nunca por quantidade
});

test("sem a migração 034: cai para a tabela de produtos e avisa que as pendências estão indisponíveis", async () => {
  let n = 0;
  const db = banco({
    produtos_resumo: { data: null, count: null, error: { code: "PGRST205", message: "Could not find the table 'public.produtos_resumo' in the schema cache" } },
    produtos: () => { n++; return { data: [{ id: "x", codigo: "A", descricao: "d", categoria: "maquina", status: "ativo", ativo: true, deleted_at: null, preco_brl: "10.5" }], count: 1, error: null }; },
  });
  const r = await listarProdutos(db, lerFiltros({ q: "a", pendencia: "sem_foto" }));
  assert.equal(r.ok, true);
  assert.equal(r.pendenciasDisponiveis, false);
  assert.equal(r.itens[0].preco_brl, 10.5);
  assert.equal(n, 1);
  assert.equal(passos(db.chamadas[1], "eq").some((p) => p[1] === "sem_foto"), false); // filtro de pendência indisponível, sem quebrar
});

test("erro de permissão e de conexão são diferenciados; lista vazia não é erro", async () => {
  const perm = await listarProdutos(banco({ produtos_resumo: { data: null, count: null, error: { code: "42501", message: "denied" } } }), lerFiltros({}));
  assert.deepEqual([perm.ok, perm.tipo], [false, "permissao"]);
  const rede = await listarProdutos(banco({ produtos_resumo: { data: null, count: null, error: { code: "08006", message: "connection failure" } } }), lerFiltros({}));
  assert.deepEqual([rede.ok, rede.tipo], [false, "banco"]);
  const vazia = await listarProdutos(banco({ produtos_resumo: { data: [], count: 0, error: null } }), lerFiltros({}));
  assert.deepEqual([vazia.ok, vazia.itens.length, vazia.total], [true, 0, 0]);
});

test("situação e pendências saem do banco: descontinuado, sem foto, ficha incompleta", async () => {
  const linha = { id: "1", codigo: "MGHS 800", descricao: "d", categoria: "maquina", status: "descontinuado", ativo: true, deleted_at: null,
    preco_brl: 100, sem_foto: true, sem_preco: false, ficha_total: 12, ficha_preenchidos: 9, sem_vinculo: false, linha_nome: "Linha A", familia: "Moagem" };
  const r = await listarProdutos(banco({ produtos_resumo: { data: [linha], count: 1, error: null } }), lerFiltros({ situacao: "todos" }));
  assert.equal(r.itens[0].situacao, "descontinuado");
  assert.deepEqual(r.itens[0].pendencias, ["foto", "ficha técnica (9/12)"]);
});

test("navegação: contagens vêm do banco (função) e respeitam a ordem de famílias e linhas", async () => {
  const db = banco({
    linhas: { data: [{ id: "L1", nome: "BSC", ordem: 1, grupo: "Moagem", grupo_ordem: 1 }, { id: "L2", nome: "A2", ordem: 2, grupo: "Moagem", grupo_ordem: 1 }, { id: "L3", nome: "ES", ordem: 1, grupo: "Extrusão", grupo_ordem: 2 }], error: null },
    categorias_peca: { data: [{ id: "C1", nome: "Navalhas", ordem: 1 }], error: null },
    "rpc:produtos_contagens": { data: [{ tipo: "linha", escopo_id: "L2", total: "30", descontinuados: "2", sem_foto: "1", sem_preco: "0", ficha_incompleta: "4", sem_vinculo: "0" }, { tipo: "categoria", escopo_id: "C1", total: "132", descontinuados: "0", sem_foto: "0", sem_preco: "3", ficha_incompleta: "0", sem_vinculo: "5" }], error: null },
  });
  const nav = await carregarNavegacao(db);
  assert.deepEqual(nav.linhas.map((l) => l.nome), ["BSC", "A2", "ES"]); // ordem do banco preservada (A2 tem mais itens e continua depois)
  assert.equal(nav.linhas[1].contagem.total, 30);
  assert.equal(nav.linhas[0].contagem.total, 0);
  assert.equal(nav.categorias[0].contagem.sem_vinculo, 5);
  // nenhuma consulta de produtos foi feita só para contar
  assert.ok(!db.chamadas.some((c) => c.tabela === "produtos"));
});

test("erros do banco viram mensagens claras e distinguem permissão, conflito e migração pendente", () => {
  assert.equal(traduzirErro({ message: "CONFLITO_EDICAO" }).tipo, "conflito");
  assert.equal(traduzirErro({ message: "USE_REAJUSTE" }).tipo, "preco");
  assert.equal(traduzirErro({ message: "SEM_PERMISSAO" }).tipo, "permissao");
  assert.equal(traduzirErro({ code: "42501", message: "new row violates row-level security policy" }).tipo, "permissao");
  assert.equal(traduzirErro({ code: "23505", message: "duplicate key value" }).erro, "Já existe um cadastro com este código.");
  assert.equal(traduzirErro({ code: "PGRST202", message: "Could not find the function public.produto_criar_peca" }).tipo, "nao_aplicado");
  assert.equal(traduzirErro({ message: "connection reset" }).tipo, "banco");
  assert.match(traduzirErro({ message: "LINHA_INCOMPATIVEL" }).erro, /não pertence à linha/);
});

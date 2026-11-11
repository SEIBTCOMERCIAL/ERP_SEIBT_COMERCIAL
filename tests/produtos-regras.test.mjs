// Testes das regras de Produtos (sem banco). Rodar: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMoedaOpcional, parseQuantidade, parseIpi, limparTexto, diffSpecs, fichaIncompleta, camposFaltando, totaisComPainel,
  validarArquivo, nomeSeguro, listarPendencias, situacaoDoProduto, lerFiltros, montarQuery, sanitizarBusca, LIMITE_UPLOAD_BYTES,
} from "../src/lib/produtos/regras.ts";

test("preço de cadastro: vazio ≠ zero; vírgula e milhar; centavos", () => {
  assert.equal(parseMoedaOpcional("").valor, null);
  assert.equal(parseMoedaOpcional("   ").valor, null);
  assert.equal(parseMoedaOpcional(null).valor, null);
  assert.equal(parseMoedaOpcional("0").valor, 0);
  assert.equal(parseMoedaOpcional("0,00").valor, 0);
  assert.equal(parseMoedaOpcional("1.234,56").valor, 1234.56);
  assert.equal(parseMoedaOpcional("R$ 99,9").valor, 99.9);
  assert.equal(parseMoedaOpcional("12.5").valor, 12.5); // o ponto decimal não vira milhar (12,50, não 125)
  assert.equal(parseMoedaOpcional("1.5").valor, 1.5);
  assert.equal(parseMoedaOpcional("1.234").valor, 1234);
  for (const x of ["abc", "-5", "1,234", "1,5,5", "NaN"]) assert.ok(parseMoedaOpcional(x).erro, `deveria rejeitar "${x}"`);
  assert.ok(parseMoedaOpcional(Number.NaN).erro);
  assert.ok(parseMoedaOpcional(Number.POSITIVE_INFINITY).erro);
  assert.ok(parseMoedaOpcional(-1).erro);
});

test("quantidade: inteiro de 1 a 10.000", () => {
  assert.equal(parseQuantidade("3").valor, 3);
  assert.equal(parseQuantidade(" 10000 ").valor, 10000);
  for (const x of ["", "0", "-1", "1,5", "1.5", "abc", "10001", null, undefined, "2e3"]) assert.ok(parseQuantidade(x).erro, `deveria rejeitar ${x}`);
});

test("IPI: vazio = 0; vírgula; limite 0–100", () => {
  assert.equal(parseIpi("").valor, 0);
  assert.equal(parseIpi("5,2").valor, 5.2);
  assert.equal(parseIpi("3.25%").valor, 3.25);
  assert.equal(parseIpi("100").valor, 100);
  for (const x of ["101", "-1", "abc", "1,234"]) assert.ok(parseIpi(x).erro, `deveria rejeitar "${x}"`);
});

test("textos: obrigatório, tamanho e caracteres de controle", () => {
  assert.equal(limparTexto("  MGHS   800 ", { rotulo: "Código", obrigatorio: true }).valor, "MGHS 800");
  assert.ok(limparTexto("   ", { rotulo: "Código", obrigatorio: true }).erro);
  assert.equal(limparTexto("", { rotulo: "NCM" }).valor, null);
  assert.ok(limparTexto("x".repeat(600), { rotulo: "Texto" }).erro);
  assert.ok(limparTexto("a\u0000b", { rotulo: "Texto" }).erro);
});

test("ficha técnica: ausente ≠ vazio; só campos da linha; valores de texto", () => {
  const campos = ["Motor (cv)", "Rotor (mm)", "Peso (kg)"];
  const atuais = { "Motor (cv)": "75", "Campo antigo": "mantido", "Peso (kg)": "900" };
  // só veio o motor alterado: o resto não é tocado (nem o campo antigo fora do formulário)
  assert.deepEqual(diffSpecs(campos, atuais, { "Motor (cv)": "100" }), { definir: { "Motor (cv)": "100" }, remover: [] });
  // campo enviado vazio = remoção explícita; campo não enviado = intacto
  assert.deepEqual(diffSpecs(campos, atuais, { "Peso (kg)": "" }), { definir: {}, remover: ["Peso (kg)"] });
  // valor igual não gera alteração; vazio em campo já vazio também não
  assert.deepEqual(diffSpecs(campos, atuais, { "Motor (cv)": " 75 ", "Rotor (mm)": "" }), { definir: {}, remover: [] });
  assert.ok(diffSpecs(campos, atuais, { "Campo inventado": "x" }).erro);
  assert.ok(diffSpecs(campos, atuais, { "Motor (cv)": 75 }).erro);
  assert.ok(diffSpecs(campos, atuais, { "Motor (cv)": "x".repeat(201) }).erro);
  assert.deepEqual(diffSpecs(campos, null, { "Motor (cv)": "1" }), { definir: { "Motor (cv)": "1" }, remover: [] });
});

test("pendência de ficha usa só os campos aplicáveis à linha", () => {
  assert.equal(fichaIncompleta(0, 0), false); // linha sem modelo de ficha: nunca é pendência
  assert.equal(fichaIncompleta(3, 3), false);
  assert.equal(fichaIncompleta(3, 1), true);
  assert.equal(fichaIncompleta(null, null), false);
  assert.deepEqual(camposFaltando(["A", "B", "C"], { A: "1", C: " " }), ["B", "C"]);
  assert.deepEqual(listarPendencias({ categoria: "maquina", sem_preco: false, sem_foto: true, ficha_total: 0, ficha_preenchidos: 0 }), ["foto"]);
  assert.deepEqual(listarPendencias({ categoria: "maquina", sem_preco: true, sem_foto: true, ficha_total: 12, ficha_preenchidos: 9 }), ["preço", "foto", "ficha técnica (9/12)"]);
  assert.deepEqual(listarPendencias({ categoria: "navalha", sem_preco: false, sem_vinculo: true, sem_foto: true }), ["sem equipamento vinculado"]);
});

test("totais com painel: cada opção separada, sem somar 220 V com 380 V", () => {
  assert.deepEqual(totaisComPainel(1000, 100.5, 200.25), { com220: 1100.5, com380: 1200.25 });
  assert.deepEqual(totaisComPainel(1000, null, 200), { com220: null, com380: 1200 });
  assert.deepEqual(totaisComPainel(null, 100, 200), { com220: null, com380: null });
  assert.deepEqual(totaisComPainel(0.1, 0.2, null), { com220: 0.3, com380: null });
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0]);
const arq = (nome, tipoMime, inicio, tamanho = 1000) => ({ nome, tipoMime, tamanho, inicio });

test("arquivos: formato, tipo informado, assinatura real e tamanho", () => {
  assert.equal(validarArquivo(arq("foto.JPG", "image/jpeg", jpeg), "imagem").mime, "image/jpeg");
  assert.equal(validarArquivo(arq("foto.png", "image/png", png), "imagem").ext, "png");
  assert.equal(validarArquivo(arq("f.webp", "image/webp", webp), "imagem").ext, "webp");
  assert.equal(validarArquivo(arq("desenho.pdf", "application/pdf", pdf), "documento").mime, "application/pdf");
  assert.equal(validarArquivo(arq("scan.jpeg", "image/jpeg", jpeg), "documento").ext, "jpg");
  // PDF não é imagem; executável disfarçado; extensão trocada; tipo informado diferente
  assert.ok(validarArquivo(arq("doc.pdf", "application/pdf", pdf), "imagem").erro);
  assert.ok(validarArquivo(arq("virus.exe", "application/octet-stream", jpeg), "documento").erro);
  assert.ok(validarArquivo(arq("foto.jpg", "image/jpeg", png), "imagem").erro); // extensão jpg, conteúdo png
  assert.ok(validarArquivo(arq("foto.jpg", "image/png", jpeg), "imagem").erro);
  assert.ok(validarArquivo(arq("falso.pdf", "application/pdf", jpeg), "documento").erro);
  assert.ok(validarArquivo(arq("grande.jpg", "image/jpeg", jpeg, LIMITE_UPLOAD_BYTES + 1), "imagem").erro);
  assert.ok(validarArquivo(arq("vazio.jpg", "image/jpeg", jpeg, 0), "imagem").erro);
  assert.equal(nomeSeguro("Desenho técnico (rev 2).pdf"), "Desenho-tecnico-rev-2.pdf");
  assert.equal(nomeSeguro("../../etc/passwd"), "etc-passwd");
});

test("situação padronizada: excluído > descontinuado > inativo > ativo", () => {
  assert.equal(situacaoDoProduto({ status: "ativo", ativo: true, deleted_at: null }), "ativo");
  assert.equal(situacaoDoProduto({ status: "descontinuado", ativo: true }), "descontinuado");
  assert.equal(situacaoDoProduto({ status: "ativo", ativo: false }), "inativo");
  assert.equal(situacaoDoProduto({ status: "descontinuado", ativo: false, deleted_at: "2026-01-01" }), "excluido");
});

test("filtros da URL: valores inválidos voltam ao padrão e a busca é limpa", () => {
  const f = lerFiltros({ aba: "pecas", escopo: "20000000-0000-0000-0000-00000000000a", q: "navalha, (800)%", situacao: "xyz", pendencia: "sem_foto", ordem: "preco", dir: "desc", pagina: "3", visao: "cards" });
  assert.deepEqual(f, { aba: "pecas", escopo: "20000000-0000-0000-0000-00000000000a", q: "navalha 800", situacao: "ativos", pendencia: "sem_foto", ordem: "preco", dir: "desc", pagina: 3, visao: "cards" });
  const padrao = lerFiltros({ aba: "x", escopo: "nao-uuid", pagina: "-4", ordem: "drop table" });
  assert.equal(padrao.aba, "maquinas");
  assert.equal(padrao.escopo, null);
  assert.equal(padrao.pagina, 1);
  assert.equal(padrao.ordem, "padrao");
  assert.equal(sanitizarBusca("a".repeat(200)).length, 80);
  // ida e volta
  assert.deepEqual(lerFiltros(Object.fromEntries(new URLSearchParams(montarQuery(f)))), f);
  assert.equal(montarQuery(padrao), "");
});

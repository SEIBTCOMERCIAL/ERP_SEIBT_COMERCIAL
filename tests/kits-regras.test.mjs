// Regras puras de kits de navalhas e peneiras (sem banco).
import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularKit, classificarComponente, compararKits, compararModelos, situacaoDoKit, ultimoReajusteDoKit, planoDeSelecao,
  atributosPeneira, compararPeneiras, parseIpiNavalha,
} from "../src/lib/reajuste/kits.ts";
import { totalJogo, textoTotalJogo } from "../src/lib/propostas/jogos-navalha.ts";

test("conjunto com quantidades diferentes de 1 e vários componentes", () => {
  const c = calcularKit([
    { pecas: 3, preco: 100.1, ipi: 5.2, grupo: "fixa" },
    { pecas: 2, preco: 250.55, ipi: 5.2, grupo: "rotora" },
    { pecas: 4, preco: 80, ipi: 5.2, grupo: "rotora" },
  ]);
  assert.equal(c.subtotalFixas, 300.3);
  assert.equal(c.subtotalRotoras, 821.1);
  assert.equal(c.aliquota, 5.2);
  // linha a linha: 300,30*1,052=315,92 (315,9156) + 501,10*1,052=527,16 (527,1572) + 320*1,052=336,64
  assert.equal(c.total, 1179.72);
  assert.equal(c.ipiValor, Math.round((c.total - 1121.4) * 100) / 100);
  assert.equal(c.completo, true);
});

test("alíquotas diferentes: IPI variável e cada peça com o seu", () => {
  const c = calcularKit([{ pecas: 1, preco: 100, ipi: 5.2, grupo: "fixa" }, { pecas: 1, preco: 100, ipi: 3.25, grupo: "rotora" }]);
  assert.equal(c.aliquota, "variavel");
  assert.deepEqual(c.aliquotas, [3.25, 5.2]);
  assert.equal(c.total, 208.45);
});

test("kit incompleto: sem preço, sem componentes ou quantidade inválida não gera total e preço ausente não vira zero", () => {
  const semPreco = calcularKit([{ pecas: 2, preco: 100, ipi: 5.2, grupo: "fixa" }, { pecas: 2, preco: null, ipi: 5.2, grupo: "rotora" }]);
  assert.equal(semPreco.total, null);
  assert.equal(semPreco.subtotalFixas, 200);
  assert.equal(semPreco.subtotalRotoras, null);
  assert.deepEqual(semPreco.problemas, ["preco_incompleto"]);
  assert.equal(calcularKit([]).total, null);
  assert.deepEqual(calcularKit([]).problemas, ["sem_componentes"]);
  assert.equal(calcularKit([{ pecas: 0, preco: 10, ipi: 0, grupo: "fixa" }]).total, null);
  // não presume uma fixa e uma rotora: só fixas é um kit completo
  const soFixa = calcularKit([{ pecas: 1, preco: 10, ipi: 0, grupo: "fixa" }]);
  assert.equal(soFixa.completo, true);
  assert.equal(soFixa.subtotalRotoras, null);
  assert.equal(soFixa.temRotora, false);
});

test("o total das propostas usa o mesmo cálculo; kit incompleto mostra o motivo", () => {
  const jogo = { itens: [
    { titulo: "NAVALHA FIXA PS 160", pecas: 3, preco: 100.1, ipi: 5.2 },
    { titulo: "NAVALHAS ROTORAS ESQ. MOINHO PS 160", pecas: 2, preco: 250.55, ipi: 5.2 },
  ] };
  const igual = calcularKit([{ pecas: 3, preco: 100.1, ipi: 5.2, grupo: "fixa" }, { pecas: 2, preco: 250.55, ipi: 5.2, grupo: "rotora" }]);
  assert.equal(totalJogo(jogo), igual.total);
  const brl = (v) => `R$ ${v.toFixed(2)}`;
  assert.equal(textoTotalJogo({ itens: [{ ...jogo.itens[0], preco: null }] }, brl), "Preço incompleto");
  assert.equal(textoTotalJogo({ itens: [] }, brl), "Kit incompleto");
});

test("fixa e rotora pelo texto cadastrado; ambíguo vai para revisão", () => {
  assert.equal(classificarComponente("NAVALHA FIXA PS 160"), "fixa");
  assert.equal(classificarComponente("NAVALHAS ROTORAS ESQ. MOINHO PS 160", "NAVALHA ROTORA PS 160"), "rotora");
  assert.equal(classificarComponente("NAVALHA ROTATIVA X"), "rotora");
  assert.equal(classificarComponente("NAVALHA FIXA ROTORA"), "outro");
  assert.equal(classificarComponente("NAVALHA DE DUTO"), "outro");
});

test("ordenação natural dos modelos: PS 50 antes de PS 100, 160 e 220; variante desempata", () => {
  const nomes = ["PS 220", "PS 100", "MGHS 800 A2", "PS 50", "PS 160", "MGHS 1000 A2", "MGHS 200"];
  assert.deepEqual([...nomes].sort(compararModelos), ["MGHS 200", "MGHS 800 A2", "MGHS 1000 A2", "PS 50", "PS 100", "PS 160", "PS 220"]);
  const kits = [
    { id: "3", modelo: "PS 160", variante: "Aço B" }, { id: "1", modelo: "PS 50", variante: null },
    { id: "2", modelo: "PS 160", variante: "Aço A" }, { id: "0", modelo: "PS 100", variante: null },
  ];
  assert.deepEqual(kits.sort(compararKits).map((k) => k.id), ["1", "0", "2", "3"]); // kits distintos do mesmo modelo continuam separados
});

test("situação do kit: só é atualizado quando todas as peças foram; parte delas é parcial", () => {
  assert.equal(situacaoDoKit(true, ["atualizado", "atualizado"]), "atualizado");
  assert.equal(situacaoDoKit(true, ["atualizado", "sem_reajuste"]), "parcial");
  assert.equal(situacaoDoKit(true, ["sem_reajuste", "sem_reajuste"]), "sem_reajuste");
  assert.equal(situacaoDoKit(true, ["atualizado", "sem_preco"]), "sem_preco");
  assert.equal(situacaoDoKit(false, ["atualizado"]), "inativo");
  const u = ultimoReajusteDoKit([{ codigo: "A", ultimo: { data: "2026-03-01" } }, { codigo: "B", ultimo: null }, { codigo: "C", ultimo: { data: "2026-05-10" } }]);
  assert.deepEqual(u, { data: "2026-05-10", codigo: "C", reajustados: 2, total: 3 });
  assert.equal(ultimoReajusteDoKit([{ codigo: "A", ultimo: null }]), null);
});

test("seleção para reajuste: só fixas, só rotoras, peça compartilhada uma vez e aviso dos kits fora da seleção", () => {
  const comp = (produtoId, grupo, outros = []) => ({ produtoId, codigo: produtoId, grupo, ativo: true, compartilhadoCom: outros });
  const k1 = { id: "k1", modelo: "PS 160", variante: null, componentes: [comp("F", "fixa", [{ kitId: "k2", rotulo: "PS 160 · B" }, { kitId: "k3", rotulo: "PS 220" }]), comp("R1", "rotora"), comp("R1", "rotora")] };
  const k2 = { id: "k2", modelo: "PS 160", variante: "B", componentes: [comp("F", "fixa", [{ kitId: "k1", rotulo: "PS 160" }, { kitId: "k3", rotulo: "PS 220" }]), comp("R2", "rotora")] };
  const ambos = planoDeSelecao([k1, k2], "ambos");
  assert.deepEqual(ambos.produtoIds.sort(), ["F", "R1", "R2"]); // F aparece em dois kits, entra uma vez
  assert.deepEqual(ambos.kitsImpactados, ["PS 220"]); // k1 e k2 estão na seleção; só k3 é afetado de fora
  assert.deepEqual(planoDeSelecao([k1], "fixas").produtoIds, ["F"]);
  assert.deepEqual(planoDeSelecao([k1], "rotoras").produtoIds, ["R1"]);
  assert.equal(planoDeSelecao([k1], "fixas").kitsImpactados.length, 2);
});

test("peneiras: atributos lidos do cadastro e ordenação numérica (nunca textual)", () => {
  assert.deepEqual(atributosPeneira("PENEIRA 800 X 300 ESP 2", "3,5").texto, "Ø 3.5 mm · 800 x 300 · esp. 2");
  assert.equal(atributosPeneira("PENEIRA SEM MEDIDAS", null).furo, null);
  const mk = (id, codigo, descricao, furo) => ({ id, codigo, attrs: atributosPeneira(descricao, furo) });
  const lista = [mk("a", "P10", "PENEIRA 800X300", "10"), mk("b", "P2", "PENEIRA 800X300", "2"), mk("c", "P3b", "PENEIRA 1000X300", "3"),
    mk("d", "P3a", "PENEIRA 800X300", "3"), mk("e", "PX", "PENEIRA SEM FURO", null)];
  assert.deepEqual(lista.sort(compararPeneiras).map((p) => p.id), ["b", "d", "c", "a", "e"]); // furo 2, 3 (800 antes de 1000), 10, sem medida por último
});

test("IPI manual: vírgula, zero válido, limites e casas decimais", () => {
  assert.equal(parseIpiNavalha("5,20").valor, 5.2);
  assert.equal(parseIpiNavalha("0").valor, 0);
  assert.equal(parseIpiNavalha("5,20%").valor, 5.2);
  assert.ok(parseIpiNavalha("").erro);
  assert.ok(parseIpiNavalha("101").erro);
  assert.ok(parseIpiNavalha("-1").erro);
  assert.ok(parseIpiNavalha("5,255").erro);
  assert.ok(parseIpiNavalha("abc").erro);
});

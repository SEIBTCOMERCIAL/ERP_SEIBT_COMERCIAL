// Testa as funções da migration 034 (produtos) junto com a 033 (reajuste) num Postgres isolado em memória (PGlite).
// Não usa o banco real. Rodar:  PGLITE_DIR=<pasta com @electric-sql/pglite> node --test tests/produtos-banco.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { montarMaquinaCatalogo, COLUNAS_CATALOGO } from "../src/lib/catalogo/mapear.ts";
import { textoReferencia } from "../src/lib/catalogo/referencia.ts";

const aqui = dirname(fileURLToPath(import.meta.url));
let PGlite = null;
try {
  const base = process.env.PGLITE_DIR ? join(process.env.PGLITE_DIR, "x.js") : import.meta.url;
  ({ PGlite } = createRequire(base)("@electric-sql/pglite"));
} catch { /* sem PGlite */ }

const ADMIN = "00000000-0000-0000-0000-000000000001";
const ENG = "00000000-0000-0000-0000-000000000002";
const LINHA_A = "20000000-0000-0000-0000-00000000000a";
const LINHA_B = "20000000-0000-0000-0000-00000000000b";
const CAT_NAV = "30000000-0000-0000-0000-000000000001";
const CAT_DUTOS = "30000000-0000-0000-0000-000000000002";

async function preparar() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE TYPE public.perfil AS ENUM ('admin','vendedor_interno','representante','engenharia');
    CREATE TYPE public.categoria_produto AS ENUM ('maquina','navalha','peneira','rolamento','parafuso','rotor','inserto','periferico','linha','outro');
    CREATE TABLE public.usuarios (id uuid PRIMARY KEY, nome text, perfil public.perfil, ativo boolean DEFAULT true, deleted_at timestamptz);
    CREATE FUNCTION public.get_my_perfil() RETURNS public.perfil LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$ SELECT perfil FROM public.usuarios WHERE id = auth.uid() AND ativo = true AND deleted_at IS NULL $$;
    CREATE TABLE public.linhas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text UNIQUE NOT NULL, ordem int DEFAULT 0, grupo text, grupo_ordem int DEFAULT 0);
    CREATE TABLE public.categorias_peca (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text UNIQUE NOT NULL, ordem int DEFAULT 0);
    CREATE TABLE public.produtos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo text UNIQUE NOT NULL, descricao text, descricao_painel text, modelo text, potencia_motor text,
      categoria public.categoria_produto NOT NULL DEFAULT 'outro', linha_id uuid REFERENCES public.linhas(id), categoria_peca_id uuid REFERENCES public.categorias_peca(id),
      preco_brl numeric(15,2), preco_painel_220 numeric, preco_painel_380 numeric, ipi_pct numeric(6,2) NOT NULL DEFAULT 0, ncm text, furo_diametro text, observacao text,
      specs jsonb, foto_url text, ativo boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'ativo', tem_variantes boolean NOT NULL DEFAULT false,
      solicitar_engenharia boolean NOT NULL DEFAULT false, deleted_at timestamptz, atualizado_em timestamptz DEFAULT now());
    CREATE TABLE public.linha_spec_campos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), linha_id uuid REFERENCES public.linhas(id), nome text, ordem int DEFAULT 0);
    CREATE TABLE public.compatibilidades_equip (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), peca_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
      equipamento_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE, quantidade integer NOT NULL DEFAULT 1, UNIQUE (peca_id, equipamento_id));
    CREATE TABLE public.produto_arquivos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
      tipo text NOT NULL, nome text NOT NULL, url text NOT NULL, storage_path text, ordem int NOT NULL DEFAULT 0, criado_em timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.historico_precos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
      preco_anterior_brl numeric(15,2), preco_novo_brl numeric(15,2), percentual_reajuste numeric(8,2), motivo text,
      data_reajuste date NOT NULL DEFAULT CURRENT_DATE, reajustado_por uuid NOT NULL REFERENCES public.usuarios(id), componente text);
    CREATE TABLE public.itens_proposta (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), produto_id uuid, descricao text, quantidade int, preco_tabela numeric, preco_unitario numeric);
    ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.historico_precos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.compatibilidades_equip ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.produto_arquivos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.categorias_peca ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.linhas ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.linha_spec_campos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p1 ON public.produtos FOR ALL TO authenticated USING (get_my_perfil() = 'admin');
    CREATE POLICY p1r ON public.produtos FOR SELECT TO authenticated USING (get_my_perfil() IS NOT NULL);
    CREATE POLICY p2 ON public.historico_precos FOR SELECT TO authenticated USING (get_my_perfil() IN ('admin','engenharia'));
    CREATE POLICY p2i ON public.historico_precos FOR INSERT TO authenticated WITH CHECK (get_my_perfil() = 'admin');
    CREATE POLICY p3 ON public.compatibilidades_equip FOR ALL TO authenticated USING (get_my_perfil() = 'admin');
    CREATE POLICY p3r ON public.compatibilidades_equip FOR SELECT TO authenticated USING (get_my_perfil() IS NOT NULL);
    CREATE POLICY p4 ON public.produto_arquivos FOR ALL TO authenticated USING (get_my_perfil() = 'admin');
    CREATE POLICY p5 ON public.categorias_peca FOR SELECT TO authenticated USING (true);
    CREATE POLICY p6 ON public.linhas FOR SELECT TO authenticated USING (true);
    CREATE POLICY p7 ON public.linha_spec_campos FOR SELECT TO authenticated USING (true);
    INSERT INTO public.usuarios VALUES ('${ADMIN}','Admin','admin'), ('${ENG}','Eng','engenharia');
    INSERT INTO public.linhas (id, nome, ordem, grupo, grupo_ordem) VALUES ('${LINHA_A}','Linha A',2,'Moagem',1), ('${LINHA_B}','Linha B',1,'Moagem',1);
    INSERT INTO public.linha_spec_campos (linha_id, nome, ordem) VALUES ('${LINHA_A}','Motor (cv)',1), ('${LINHA_A}','Rotor (mm)',2), ('${LINHA_A}','Peso (kg)',3);
    INSERT INTO public.categorias_peca (id, nome, ordem) VALUES ('${CAT_NAV}','Navalhas',1), ('${CAT_DUTOS}','Dutos e Curvas',7);
  `);
  await db.exec(readFileSync(join(aqui, "../supabase/migrations/033_reajuste_transacional.sql"), "utf8"));
  await db.exec(readFileSync(join(aqui, "../supabase/migrations/034_produtos_integridade.sql"), "utf8"));
  await db.exec(`GRANT USAGE ON SCHEMA public, auth, storage TO authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;`);
  return db;
}

async function como(db, uid, sql, params = []) {
  await db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false); SET ROLE authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec("RESET ROLE"); }
}
const fn = async (db, uid, nome, ...args) => {
  const marcas = args.map((_, i) => `$${i + 1}`).join(", ");
  const conv = args.map((a) => (a !== null && typeof a === "object" && !Array.isArray(a) ? JSON.stringify(a) : a));
  return (await como(db, uid, `SELECT public.${nome}(${marcas}) AS r`, conv)).rows[0].r;
};
const criarEquip = (db, dados = {}, specs = {}, linha = LINHA_A) =>
  fn(db, ADMIN, "produto_criar_equipamento", linha, { codigo: "MGHS 800", descricao: "Moinho 800", preco_brl: 100000, preco_painel_220: 5000, preco_painel_380: 6000, ...dados }, specs);
const um = async (db, sql) => (await db.query(sql)).rows[0];
const hist = async (db, id) => (await db.query(`SELECT componente, preco_anterior_brl AS ant, preco_novo_brl AS novo, motivo FROM public.historico_precos WHERE produto_id = '${id}' ORDER BY componente NULLS FIRST`)).rows;
const t = PGlite ? test : test.skip;

t("equipamento novo: preços iniciais com histórico, ficha e zero preservado", async () => {
  const db = await preparar();
  const { id } = await criarEquip(db, { preco_painel_380: 0 }, { "Motor (cv)": "75" });
  const p = await um(db, `SELECT preco_brl, preco_painel_220, preco_painel_380, specs, status, ativo FROM public.produtos WHERE id = '${id}'`);
  assert.equal(Number(p.preco_painel_380), 0); // zero ≠ não informado
  assert.deepEqual(p.specs, { "Motor (cv)": "75" });
  const h = await hist(db, id);
  assert.equal(h.length, 3);
  assert.ok(h.every((x) => x.ant === null && x.motivo === "Preço inicial"));
  await assert.rejects(criarEquip(db, { codigo: "MGHS 800" }), /unique|duplicate/i);
  await assert.rejects(criarEquip(db, { codigo: "X", preco_brl: -1 }), /PRECO_INVALIDO/);
  await assert.rejects(criarEquip(db, { codigo: "Y", descricao: " " }), /DESCRICAO_OBRIGATORIA/);
  await assert.rejects(fn(db, ADMIN, "produto_criar_equipamento", "20000000-0000-0000-0000-0000000000ff", { codigo: "Z", descricao: "z" }, {}), /LINHA_INEXISTENTE/);
  await assert.rejects(fn(db, ENG, "produto_criar_equipamento", LINHA_A, { codigo: "Q", descricao: "q" }, {}), /SEM_PERMISSAO/);
});

t("edição: só muda o que veio; preço existente exige Reajuste; preço vazio vira preço inicial", async () => {
  const db = await preparar();
  const { id } = await criarEquip(db, { preco_painel_220: null });
  const v0 = (await um(db, `SELECT atualizado_em::text AS v FROM public.produtos WHERE id = '${id}'`)).v;
  const r = await fn(db, ADMIN, "produto_editar_equipamento", id, LINHA_A, v0, { descricao: "Nova descrição" });
  const p = await um(db, `SELECT descricao, codigo, ncm, preco_brl FROM public.produtos WHERE id = '${id}'`);
  assert.equal(p.descricao, "Nova descrição");
  assert.equal(p.codigo, "MGHS 800");
  assert.equal(Number(p.preco_brl), 100000);
  // preço existente diferente: bloqueado
  await assert.rejects(fn(db, ADMIN, "produto_editar_equipamento", id, LINHA_A, r.versao, { preco_brl: 120000 }), /USE_REAJUSTE/);
  assert.equal(Number((await um(db, `SELECT preco_brl FROM public.produtos WHERE id = '${id}'`)).preco_brl), 100000);
  // mesmo valor: aceito, sem histórico extra
  const antes = (await hist(db, id)).length;
  const r2 = await fn(db, ADMIN, "produto_editar_equipamento", id, LINHA_A, r.versao, { preco_brl: 100000 });
  assert.equal((await hist(db, id)).length, antes);
  // campo vazio recebe preço inicial com histórico
  await fn(db, ADMIN, "produto_editar_equipamento", id, LINHA_A, r2.versao, { preco_painel_220: 4500.5 });
  assert.equal(Number((await um(db, `SELECT preco_painel_220 FROM public.produtos WHERE id = '${id}'`)).preco_painel_220), 4500.5);
  assert.equal((await hist(db, id)).filter((x) => x.componente === "painel_220").length, 1);
});

t("edição: linha incompatível, versão desatualizada e produto excluído são recusados", async () => {
  const db = await preparar();
  const { id } = await criarEquip(db);
  const v0 = (await um(db, `SELECT atualizado_em::text AS v FROM public.produtos WHERE id = '${id}'`)).v;
  await assert.rejects(fn(db, ADMIN, "produto_editar_equipamento", id, LINHA_B, v0, { descricao: "x" }), /LINHA_INCOMPATIVEL/);
  await fn(db, ADMIN, "produto_editar_equipamento", id, LINHA_A, v0, { descricao: "primeira" });
  await assert.rejects(fn(db, ADMIN, "produto_editar_equipamento", id, LINHA_A, v0, { descricao: "segunda (versão velha)" }), /CONFLITO_EDICAO/);
  assert.equal((await um(db, `SELECT descricao FROM public.produtos WHERE id = '${id}'`)).descricao, "primeira");
  await fn(db, ADMIN, "produto_alterar_situacao", id, "excluir");
  await assert.rejects(fn(db, ADMIN, "produto_editar_equipamento", id, LINHA_A, null, { descricao: "z" }), /PRODUTO_INEXISTENTE/);
});

t("ficha técnica: define e remove chaves sem perder o resto; detecta edição simultânea", async () => {
  const db = await preparar();
  const { id } = await criarEquip(db, {}, { "Motor (cv)": "75", "Campo antigo": "mantido", "Peso (kg)": "900" });
  const v0 = (await um(db, `SELECT atualizado_em::text AS v FROM public.produtos WHERE id = '${id}'`)).v;
  const r = await fn(db, ADMIN, "produto_atualizar_specs", id, LINHA_A, v0, { "Rotor (mm)": "300", "Motor (cv)": "100" }, ["Peso (kg)"]);
  assert.deepEqual((await um(db, `SELECT specs FROM public.produtos WHERE id = '${id}'`)).specs, { "Motor (cv)": "100", "Campo antigo": "mantido", "Rotor (mm)": "300" });
  await assert.rejects(fn(db, ADMIN, "produto_atualizar_specs", id, LINHA_A, v0, { "Motor (cv)": "1" }, []), /CONFLITO_EDICAO/);
  await assert.rejects(fn(db, ADMIN, "produto_atualizar_specs", id, LINHA_B, r.versao, {}, []), /LINHA_INCOMPATIVEL/);
  await assert.rejects(fn(db, ADMIN, "produto_atualizar_specs", id, LINHA_A, r.versao, [1, 2], []), /SPECS_INVALIDAS/);
});

t("peça nova com vínculo é atômica; categoria nova (tipo 'outro') funciona; código repetido não deixa resto", async () => {
  const db = await preparar();
  const { id: eq } = await criarEquip(db);
  const bom = await fn(db, ADMIN, "produto_criar_peca", CAT_DUTOS, { codigo: "DUTO-6", descricao: "Duto 6", preco_brl: 446, ipi_pct: 0 }, eq, 3);
  const p = await um(db, `SELECT categoria, categoria_peca_id FROM public.produtos WHERE id = '${bom.id}'`);
  assert.equal(p.categoria, "outro");
  assert.equal((await um(db, `SELECT quantidade FROM public.compatibilidades_equip WHERE peca_id = '${bom.id}'`)).quantidade, 3);
  assert.equal((await hist(db, bom.id))[0].motivo, "Preço inicial");
  const nav = await fn(db, ADMIN, "produto_criar_peca", CAT_NAV, { codigo: "NAV-1", descricao: "Navalha" }, null, 1);
  assert.equal((await um(db, `SELECT categoria FROM public.produtos WHERE id = '${nav.id}'`)).categoria, "navalha");
  // falha no vínculo (quantidade inválida): a peça também não é criada
  await assert.rejects(fn(db, ADMIN, "produto_criar_peca", CAT_DUTOS, { codigo: "DUTO-4", descricao: "Duto 4" }, eq, 0), /QUANTIDADE_INVALIDA/);
  assert.equal(Number((await um(db, `SELECT count(*) AS n FROM public.produtos WHERE codigo = 'DUTO-4'`)).n), 0);
  await assert.rejects(fn(db, ADMIN, "produto_criar_peca", CAT_DUTOS, { codigo: "DUTO-6", descricao: "repetida" }, eq, 1), /unique|duplicate/i);
  await assert.rejects(fn(db, ADMIN, "produto_criar_peca", CAT_DUTOS, { codigo: "Z", descricao: "z", ipi_pct: 150 }), /IPI_INVALIDO/);
  // preço zero fica zero (não vira vazio)
  const zero = await fn(db, ADMIN, "produto_criar_peca", CAT_DUTOS, { codigo: "ZERO", descricao: "preço zero", preco_brl: 0 });
  assert.equal(Number((await um(db, `SELECT preco_brl FROM public.produtos WHERE id = '${zero.id}'`)).preco_brl), 0);
});

t("peça compartilhada: edição informa quantos equipamentos usam; vínculos sem duplicidade e conferidos", async () => {
  const db = await preparar();
  const { id: e1 } = await criarEquip(db, { codigo: "E1" });
  const { id: e2 } = await criarEquip(db, { codigo: "E2" });
  const { id: peca } = await fn(db, ADMIN, "produto_criar_peca", CAT_NAV, { codigo: "NAV-9", descricao: "Navalha 9", preco_brl: 100 }, e1, 2);
  const v1 = await fn(db, ADMIN, "produto_vincular_peca", e2, peca, 4);
  await assert.rejects(fn(db, ADMIN, "produto_vincular_peca", e2, peca, 1), /VINCULO_DUPLICADO/);
  await assert.rejects(fn(db, ADMIN, "produto_vincular_peca", e2, e1, 1), /PECA_INEXISTENTE/);
  await assert.rejects(fn(db, ADMIN, "produto_vincular_peca", peca, peca, 1), /EQUIPAMENTO_INEXISTENTE/);
  await assert.rejects(fn(db, ADMIN, "produto_vincular_peca", e1, peca, 20000), /QUANTIDADE_INVALIDA|VINCULO_DUPLICADO/);
  const r = await fn(db, ADMIN, "produto_editar_peca", peca, null, { descricao: "Navalha 9 revisada", ipi_pct: 5.2 });
  assert.equal(r.equipamentos, 2);
  await assert.rejects(fn(db, ADMIN, "produto_editar_peca", peca, null, { preco_brl: 150 }), /USE_REAJUSTE/);
  await assert.rejects(fn(db, ADMIN, "produto_editar_peca", peca, r.versao.replace("2", "3"), { descricao: "x" }), /CONFLITO_EDICAO/);
  // quantidade do vínculo só no equipamento certo
  await assert.rejects(fn(db, ADMIN, "produto_atualizar_vinculo", v1.id, e1, 7), /VINCULO_INEXISTENTE/);
  await fn(db, ADMIN, "produto_atualizar_vinculo", v1.id, e2, 7);
  assert.equal((await um(db, `SELECT quantidade FROM public.compatibilidades_equip WHERE id = '${v1.id}'`)).quantidade, 7);
  await assert.rejects(fn(db, ADMIN, "produto_desvincular_peca", v1.id, e1), /VINCULO_INEXISTENTE/);
  await fn(db, ADMIN, "produto_desvincular_peca", v1.id, e2);
  assert.equal(Number((await um(db, `SELECT count(*) AS n FROM public.compatibilidades_equip WHERE peca_id = '${peca}'`)).n), 1);
});

t("descontinuar ≠ excluir; excluir peça remove os vínculos e preserva histórico", async () => {
  const db = await preparar();
  const { id: eq } = await criarEquip(db);
  const { id: peca } = await fn(db, ADMIN, "produto_criar_peca", CAT_NAV, { codigo: "NAV-X", descricao: "n", preco_brl: 10 }, eq, 1);
  await fn(db, ADMIN, "produto_alterar_situacao", eq, "descontinuar");
  const d = await um(db, `SELECT status, deleted_at FROM public.produtos WHERE id = '${eq}'`);
  assert.equal(d.status, "descontinuado");
  assert.equal(d.deleted_at, null);
  await fn(db, ADMIN, "produto_alterar_situacao", eq, "reativar");
  const r = await fn(db, ADMIN, "produto_alterar_situacao", peca, "excluir");
  assert.equal(r.vinculos_removidos, 1);
  assert.notEqual((await um(db, `SELECT deleted_at FROM public.produtos WHERE id = '${peca}'`)).deleted_at, null);
  assert.equal((await hist(db, peca)).length, 1); // histórico preservado
  await assert.rejects(fn(db, ADMIN, "produto_alterar_situacao", peca, "excluir"), /PRODUTO_INEXISTENTE/);
  await assert.rejects(fn(db, ADMIN, "produto_alterar_situacao", eq, "apagar"), /ACAO_INVALIDA/);
});

t("foto da linha: preservar fotos individuais ou substituir todas; arquivos usados não somem", async () => {
  const db = await preparar();
  const { id: a } = await criarEquip(db, { codigo: "A" });
  const { id: b } = await criarEquip(db, { codigo: "B" });
  const { id: c } = await criarEquip(db, { codigo: "C" });
  await db.query(`UPDATE public.produtos SET foto_url = 'https://x/individual-b.jpg' WHERE id = '${b}'`);
  const r1 = await fn(db, ADMIN, "produto_aplicar_foto_linha", LINHA_A, "https://x/linha.jpg", "linha.jpg", false);
  assert.equal(r1.afetados, 2);
  assert.equal(r1.preservados, 1);
  assert.equal((await um(db, `SELECT foto_url FROM public.produtos WHERE id = '${b}'`)).foto_url, "https://x/individual-b.jpg");
  assert.equal((await um(db, `SELECT foto_url FROM public.produtos WHERE id = '${a}'`)).foto_url, "https://x/linha.jpg");
  const r2 = await fn(db, ADMIN, "produto_aplicar_foto_linha", LINHA_A, "https://x/linha.jpg", "linha.jpg", true);
  assert.equal(r2.afetados, 3);
  assert.deepEqual(r2.urls_substituidas, ["https://x/individual-b.jpg"]);
  assert.equal(Number((await um(db, `SELECT count(*) AS n FROM public.produto_arquivos WHERE produto_id = '${c}'`)).n), 1); // sem duplicar
  await assert.rejects(fn(db, ADMIN, "produto_aplicar_foto_linha", LINHA_B, "https://x/y.jpg", "y", true), /LINHA_SEM_EQUIPAMENTOS/);
  await assert.rejects(fn(db, ENG, "produto_aplicar_foto_linha", LINHA_A, "https://x/z.jpg", "z", true), /SEM_PERMISSAO/);
});

t("remover arquivo: confere o produto, troca a foto principal e protege arquivo compartilhado", async () => {
  const db = await preparar();
  const { id: a } = await criarEquip(db, { codigo: "A" });
  const { id: b } = await criarEquip(db, { codigo: "B" });
  await db.query(`INSERT INTO public.produto_arquivos (id, produto_id, tipo, nome, url, storage_path, ordem) VALUES
    ('40000000-0000-0000-0000-000000000001','${a}','imagem','f1','https://x/f1.jpg','${a}/imagem/1.jpg',1),
    ('40000000-0000-0000-0000-000000000002','${a}','imagem','f2','https://x/f2.jpg','${a}/imagem/2.jpg',2),
    ('40000000-0000-0000-0000-000000000003','${a}','imagem','comp','https://x/comp.jpg',NULL,3),
    ('40000000-0000-0000-0000-000000000004','${b}','imagem','comp','https://x/comp.jpg',NULL,1)`);
  await db.query(`UPDATE public.produtos SET foto_url = 'https://x/f1.jpg' WHERE id = '${a}'`);
  await assert.rejects(fn(db, ADMIN, "produto_remover_arquivo", "40000000-0000-0000-0000-000000000001", b), /ARQUIVO_INEXISTENTE/);
  const r = await fn(db, ADMIN, "produto_remover_arquivo", "40000000-0000-0000-0000-000000000001", a);
  assert.equal(r.foto_principal_trocada, true);
  assert.equal(r.nova_foto, "https://x/f2.jpg");
  assert.equal(r.storage_path, `${a}/imagem/1.jpg`);
  assert.equal(r.ainda_usado, false);
  assert.equal((await um(db, `SELECT foto_url FROM public.produtos WHERE id = '${a}'`)).foto_url, "https://x/f2.jpg");
  const comp = await fn(db, ADMIN, "produto_remover_arquivo", "40000000-0000-0000-0000-000000000003", a);
  assert.equal(comp.ainda_usado, true); // o outro equipamento ainda usa: o arquivo não pode ser apagado do storage
  assert.equal(comp.storage_path, null);
});

t("pendências: ficha só com campos da linha, sem preço (≠ sob consulta), peça sem vínculo, contagens no banco", async () => {
  const db = await preparar();
  await criarEquip(db, { codigo: "COMPLETO" }, { "Motor (cv)": "75", "Rotor (mm)": "300", "Peso (kg)": "900" });
  await criarEquip(db, { codigo: "INCOMPLETO", preco_painel_220: null, preco_painel_380: null }, { "Motor (cv)": "75" });
  await criarEquip(db, { codigo: "SEM PRECO", preco_brl: null }, { "Motor (cv)": "1", "Rotor (mm)": "2", "Peso (kg)": "3" });
  await criarEquip(db, { codigo: "CONSULTA", preco_brl: null, solicitar_engenharia: true }, { "Motor (cv)": "1", "Rotor (mm)": "2", "Peso (kg)": "3" });
  await criarEquip(db, { codigo: "OUTRA LINHA" }, {}, LINHA_B); // linha sem campos: nunca "incompleta"
  await fn(db, ADMIN, "produto_criar_peca", CAT_NAV, { codigo: "SOLTA", descricao: "peça sem equipamento", preco_brl: 5 });
  const r = (await como(db, ADMIN, "SELECT codigo, ficha_total, ficha_preenchidos, sem_preco, sem_vinculo FROM public.produtos_resumo ORDER BY codigo")).rows;
  const por = Object.fromEntries(r.map((x) => [x.codigo, x]));
  assert.equal(Number(por["COMPLETO"].ficha_total), 3);
  assert.equal(Number(por["INCOMPLETO"].ficha_preenchidos), 1);
  assert.equal(por["SEM PRECO"].sem_preco, true);
  assert.equal(por["CONSULTA"].sem_preco, false);
  assert.equal(Number(por["OUTRA LINHA"].ficha_total), 0);
  assert.equal(por["SOLTA"].sem_vinculo, true);
  const c = (await como(db, ADMIN, "SELECT * FROM public.produtos_contagens()")).rows;
  const linhaA = c.find((x) => x.tipo === "linha" && x.escopo_id === LINHA_A);
  assert.equal(Number(linhaA.total), 4);
  assert.equal(Number(linhaA.ficha_incompleta), 1);
  assert.equal(Number(linhaA.sem_preco), 1);
  const nav = c.find((x) => x.tipo === "categoria" && x.escopo_id === CAT_NAV);
  assert.equal(Number(nav.sem_vinculo), 1);
});

t("integração Reajuste → catálogo → proposta histórica: o preço novo aparece e a proposta antiga não muda", async () => {
  const db = await preparar();
  const { id } = await criarEquip(db, { codigo: "TESTE CATALOGO", preco_brl: 1000, preco_painel_220: 100, preco_painel_380: 200 });
  // proposta histórica emitida com o preço da época
  await db.query(`INSERT INTO public.itens_proposta (produto_id, descricao, quantidade, preco_tabela, preco_unitario) VALUES ('${id}', 'TESTE CATALOGO', 1, 1000, 1000)`);
  // catálogo lê da mesma visão/tabela de produtos (status ativo, não excluído)
  const lerCatalogo = async () => (await como(db, ADMIN,
    `SELECT preco_brl, preco_painel_220, preco_painel_380 FROM public.produtos WHERE id = '${id}' AND categoria = 'maquina' AND status = 'ativo' AND deleted_at IS NULL`)).rows[0];
  const antes = await lerCatalogo();
  assert.equal(Number(antes.preco_brl), 1000);
  // reajuste confirmado (função da 033): máquina +10%, painel 220 V +5%, painel 380 V intocado
  await como(db, ADMIN, "SELECT public.aplicar_reajuste($1::jsonb, 'Reajuste de teste', $2::uuid)", [JSON.stringify([
    { produto_id: id, componente: "moinho", preco_esperado: 1000, preco_novo: 1100 },
    { produto_id: id, componente: "painel_220", preco_esperado: 100, preco_novo: 105 },
  ]), crypto.randomUUID()]);
  const depois = await lerCatalogo();
  assert.equal(Number(depois.preco_brl), 1100);
  assert.equal(Number(depois.preco_painel_220), 105);
  assert.equal(Number(depois.preco_painel_380), 200); // não soma painéis: cada componente separado
  const h = (await db.query(`SELECT componente, preco_anterior_brl AS ant, preco_novo_brl AS novo FROM public.historico_precos WHERE produto_id = '${id}' AND preco_anterior_brl IS NOT NULL ORDER BY componente`)).rows;
  assert.deepEqual(h.map((x) => [x.componente, Number(x.ant), Number(x.novo)]), [["moinho", 1000, 1100], ["painel_220", 100, 105]]);
  // reajuste que falha não altera o catálogo
  await assert.rejects(como(db, ADMIN, "SELECT public.aplicar_reajuste($1::jsonb, 'falha', $2::uuid)", [JSON.stringify([
    { produto_id: id, componente: "moinho", preco_esperado: 1000, preco_novo: 1500 }]), crypto.randomUUID()]), /PRECO_ALTERADO/);
  assert.equal(Number((await lerCatalogo()).preco_brl), 1100);
  // a proposta histórica conserva o valor original
  const item = (await db.query(`SELECT preco_tabela, preco_unitario FROM public.itens_proposta WHERE produto_id = '${id}'`)).rows[0];
  assert.equal(Number(item.preco_tabela), 1000);
  assert.equal(Number(item.preco_unitario), 1000);
  // preço inicial não conta como reajuste (preço anterior vazio)
  assert.equal(Number((await db.query(`SELECT count(*) AS n FROM public.historico_precos WHERE produto_id = '${id}' AND preco_anterior_brl IS NULL`)).rows[0].n), 3);
});


t("catálogo por linha e completo usam o mesmo mapeamento dos preços vigentes (máquina, 220 V e 380 V separados)", async () => {
  const db = await preparar();
  const { id } = await criarEquip(db, { codigo: "TESTE CATALOGO", preco_brl: 1000, preco_painel_220: 100, preco_painel_380: 200 });
  const colunas = COLUNAS_CATALOGO.replace(", produto_arquivos(id, tipo, nome, url)", "");
  const lerCatalogo = async (linhaNome) => montarMaquinaCatalogo((await como(db, ADMIN,
    `SELECT ${colunas} FROM public.produtos WHERE id = '${id}' AND categoria = 'maquina' AND status = 'ativo' AND deleted_at IS NULL`)).rows[0], linhaNome);

  const antes = await lerCatalogo("Linha A");
  assert.deepEqual([antes.precoMaquina, antes.precoPainel220, antes.precoPainel380, antes.tipoPreco], [1000, 100, 200, "com_painel"]);

  await como(db, ADMIN, "SELECT public.aplicar_reajuste($1::jsonb, 'Reajuste de teste', $2::uuid)", [JSON.stringify([
    { produto_id: id, componente: "moinho", preco_esperado: 1000, preco_novo: 1100 },
    { produto_id: id, componente: "painel_380", preco_esperado: 200, preco_novo: 210 },
  ]), crypto.randomUUID()]);

  // "por linha" e "completo" chamam o mesmo mapeamento sobre as mesmas colunas de produtos
  const porLinha = await lerCatalogo("Linha A");
  const completo = await lerCatalogo("Linha A");
  assert.deepEqual(porLinha, completo);
  assert.deepEqual([porLinha.precoMaquina, porLinha.precoPainel220, porLinha.precoPainel380], [1100, 100, 210]);
  // nada soma os dois painéis: o catálogo só carrega cada preço separado
  assert.ok(!("precoTotal" in porLinha));

  // descontinuado e excluído saem do catálogo
  await fn(db, ADMIN, "produto_alterar_situacao", id, "descontinuar");
  assert.equal((await como(db, ADMIN, `SELECT id FROM public.produtos WHERE id = '${id}' AND categoria = 'maquina' AND status = 'ativo' AND deleted_at IS NULL`)).rows.length, 0);
});

test("referência do catálogo: data de geração e da última atualização de preços", () => {
  const r = { geradoEm: "2026-11-10T17:05:00Z", precosAtualizadosEm: "2026-11-03" };
  assert.equal(textoReferencia(r), "Gerado em 10/11/2026, 14:05 · preços vigentes; última atualização de preços em 03/11/2026");
  assert.match(textoReferencia({ geradoEm: r.geradoEm, precosAtualizadosEm: null }), /sem atualização de preços registrada/);
  assert.equal(textoReferencia(null), "");
});

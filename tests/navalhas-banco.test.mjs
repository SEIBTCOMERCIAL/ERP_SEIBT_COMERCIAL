// Testa a migration 035 (IPI das navalhas, histórico e edição manual) e o reajuste por componentes dos kits,
// num Postgres isolado em memória (PGlite). Não usa o banco real. Rodar:
//   PGLITE_DIR=<pasta com @electric-sql/pglite> node --test tests/navalhas-banco.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
  await db.exec(`
    CREATE TABLE public.jogos_navalha (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipamento_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
      nome text NOT NULL DEFAULT 'Padrão', material text, ordem integer NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true);
    CREATE TABLE public.jogos_navalha_itens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), jogo_id uuid NOT NULL REFERENCES public.jogos_navalha(id) ON DELETE CASCADE,
      produto_id uuid NOT NULL REFERENCES public.produtos(id), titulo text NOT NULL, pecas integer NOT NULL DEFAULT 1, codigo text, ordem integer NOT NULL DEFAULT 0);
  `);
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
const _criarEquip_ = (db, dados = {}, specs = {}, linha = LINHA_A) =>
  fn(db, ADMIN, "produto_criar_equipamento", linha, { codigo: "MGHS 800", descricao: "Moinho 800", preco_brl: 100000, preco_painel_220: 5000, preco_painel_380: 6000, ...dados }, specs);

const MIG_035 = readFileSync(join(aqui, "../supabase/migrations/035_navalhas_ipi_kits.sql"), "utf8");
const t = PGlite ? test : test.skip;
const lin = async (db, sql) => (await db.query(sql)).rows;

async function semear(db) {
  await db.exec(`ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ipi_manual boolean NOT NULL DEFAULT false`); // a 035 repete o comando sem erro
  const novo = async (codigo, descricao, categoria, preco, ipi, { cat = null, manual = false } = {}) =>
    (await db.query(
      `INSERT INTO public.produtos (codigo, descricao, categoria, categoria_peca_id, preco_brl, ipi_pct, ipi_manual) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [codigo, descricao, categoria, cat, preco, ipi, manual])).rows[0].id;
  const ids = {
    eq160: await novo("PS 160", "Moinho PS 160", "maquina", 1000, 0),
    fixa160: await novo("F160", "NAVALHA FIXA PS 160", "navalha", 100, 0, { cat: CAT_NAV }),
    rot160: await novo("R160", "NAVALHA ROTORA PS 160", "navalha", 200, 3.25, { cat: CAT_NAV }),
    fixa50: await novo("F50", "NAVALHA FIXA PS 50", "navalha", 50, 0, { cat: CAT_NAV }),
    rot50: await novo("R50", "NAVALHA ROTORA PS 50", "navalha", 80, 0, { cat: CAT_NAV }),
    manual: await novo("FMAN", "NAVALHA FIXA ESPECIAL", "navalha", 60, 7, { cat: CAT_NAV, manual: true }),
    ambigua: await novo("NDUTO", "NAVALHA DE DUTO", "navalha", 10, 2, { cat: CAT_DUTOS }),
    rotor: await novo("ROTOR1", "ROTOR 1", "rotor", 500, 1, { cat: CAT_NAV }),
    peneira: await novo("PEN1", "PENEIRA 3 MM", "peneira", 30, 0),
  };
  return ids;
}
const ipiDe = async (db, id) => Number((await lin(db, `SELECT ipi_pct FROM public.produtos WHERE id = '${id}'`))[0].ipi_pct);
const histIpi = (db, where = "TRUE") => lin(db, `SELECT produto_id, ipi_anterior::float AS ant, ipi_novo::float AS novo, origem, alterado_por, responsavel, motivo FROM public.produto_ipi_historico WHERE ${where} ORDER BY alterado_em, id`);

t("IPI das navalhas vai para 5,20% só nas navalhas, com histórico, sem tocar preços e repetível", async () => {
  const db = await preparar();
  const id = await semear(db);
  await db.exec(MIG_035);

  for (const k of ["fixa160", "rot160", "fixa50", "rot50"]) assert.equal(await ipiDe(db, id[k]), 5.2, k);
  assert.equal(await ipiDe(db, id.manual), 7);       // edição manual anterior preservada
  assert.equal(await ipiDe(db, id.ambigua), 2);      // cadastro ambíguo: só revisão
  assert.equal(await ipiDe(db, id.rotor), 1);        // outra categoria
  assert.equal(await ipiDe(db, id.peneira), 0);      // peneira intacta
  assert.equal(Number((await lin(db, `SELECT preco_brl FROM public.produtos WHERE id = '${id.fixa160}'`))[0].preco_brl), 100); // preço-base intacto

  const h = await histIpi(db);
  assert.equal(h.length, 4);
  assert.ok(h.every((x) => x.origem === "padrao_navalhas" && x.novo === 5.2 && x.alterado_por === null && /Migração 035/.test(x.responsavel)));
  assert.deepEqual(h.map((x) => x.ant).sort((a, b) => a - b), [0, 0, 0, 3.25]); // valores anteriores registrados
  assert.equal((await lin(db, `SELECT count(*)::int AS n FROM public.historico_precos`))[0].n, 0); // não é reajuste de preço
  assert.equal((await lin(db, `SELECT count(*)::int AS n FROM public.produtos WHERE ipi_manual`))[0].n, 1);

  const revisao = (await lin(db, `SELECT codigo, motivo FROM public.navalhas_ipi_revisao ORDER BY codigo`)).map((r) => r.codigo);
  assert.deepEqual(revisao, ["NDUTO", "ROTOR1"]);

  await db.exec(MIG_035); // repetir não grava nada novo
  assert.equal((await histIpi(db)).length, 4);
});

t("edição manual do IPI: só administrador, só navalhas, tudo ou nada, com histórico e protegida do padrão", async () => {
  const db = await preparar();
  const id = await semear(db);
  await db.exec(MIG_035);

  const r = await fn(db, ADMIN, "produto_definir_ipi", [id.fixa160, id.rot160], 6.5, "Alíquota do material");
  assert.deepEqual([r.produtos, r.alterados, r.sem_mudanca], [2, 2, 0]);
  assert.equal(await ipiDe(db, id.fixa160), 6.5);
  assert.equal(await ipiDe(db, id.fixa50), 5.2); // fora do alcance
  const h = await histIpi(db, `origem = 'manual'`);
  assert.equal(h.length, 2);
  assert.ok(h.every((x) => x.ant === 5.2 && x.novo === 6.5 && x.alterado_por === ADMIN && x.motivo === "Alíquota do material"));

  await db.exec(MIG_035); // o padrão não sobrescreve edição manual
  assert.equal(await ipiDe(db, id.fixa160), 6.5);
  assert.equal(await ipiDe(db, id.rot160), 6.5);

  const mesmo = await fn(db, ADMIN, "produto_definir_ipi", [id.fixa160, id.rot160], 6.5, "Confirmando");
  assert.deepEqual([mesmo.alterados, mesmo.sem_mudanca], [0, 2]);
  assert.equal((await histIpi(db, `origem = 'manual'`)).length, 2); // sem registro desnecessário

  await assert.rejects(fn(db, ENG, "produto_definir_ipi", [id.fixa50], 4, "motivo"), /SEM_PERMISSAO/);
  await assert.rejects(fn(db, ADMIN, "produto_definir_ipi", [id.fixa50, id.peneira], 4, "motivo"), /NAO_NAVALHA/);
  assert.equal(await ipiDe(db, id.fixa50), 5.2); // a operação inteira foi cancelada
  await assert.rejects(fn(db, ADMIN, "produto_definir_ipi", [id.fixa50], 101, "motivo"), /IPI_INVALIDO/);
  await assert.rejects(fn(db, ADMIN, "produto_definir_ipi", [id.fixa50], 5.255, "motivo"), /IPI_INVALIDO/);
  await assert.rejects(fn(db, ADMIN, "produto_definir_ipi", [id.fixa50], 4, " a "), /MOTIVO_INVALIDO/);
  await assert.rejects(fn(db, ADMIN, "produto_definir_ipi", [], 4, "motivo"), /NENHUMA_ALTERACAO/);
  const zero = await fn(db, ADMIN, "produto_definir_ipi", [id.fixa50], 0, "Isenta"); // 0% é valor válido
  assert.equal(zero.alterados, 1);
  assert.equal(await ipiDe(db, id.fixa50), 0);
});

t("qualquer edição direta de IPI deixa registro e fica protegida; alterar IPI não é reajuste; reajuste só das fixas", async () => {
  const db = await preparar();
  const id = await semear(db);
  await db.exec(MIG_035);

  await como(db, ADMIN, `UPDATE public.produtos SET ipi_pct = 4 WHERE id = '${id.rot50}'`);
  const h = await histIpi(db, `produto_id = '${id.rot50}' AND origem = 'manual'`);
  assert.equal(h.length, 1);
  assert.equal(h[0].alterado_por, ADMIN);
  await db.exec(MIG_035);
  assert.equal(await ipiDe(db, id.rot50), 4);

  // Só IPI mudou até aqui: nenhum registro de reajuste de preço.
  assert.equal((await lin(db, `SELECT count(*)::int AS n FROM public.historico_precos`))[0].n, 0);

  // Reajuste só das fixas do kit: as rotoras não mudam e o IPI continua como estava.
  const rj = await fn(db, ADMIN, "aplicar_reajuste",
    JSON.stringify([{ produto_id: id.fixa160, componente: "peca", preco_esperado: 100, preco_novo: 110 }]), "Reajuste anual", "40000000-0000-0000-0000-000000000001");
  assert.equal(rj.produtos, 1);
  assert.equal(Number((await lin(db, `SELECT preco_brl FROM public.produtos WHERE id = '${id.fixa160}'`))[0].preco_brl), 110);
  assert.equal(Number((await lin(db, `SELECT preco_brl FROM public.produtos WHERE id = '${id.rot160}'`))[0].preco_brl), 200);
  assert.equal(await ipiDe(db, id.fixa160), 5.2);
  assert.equal((await lin(db, `SELECT count(*)::int AS n FROM public.historico_precos WHERE produto_id = '${id.rot160}'`))[0].n, 0);
});

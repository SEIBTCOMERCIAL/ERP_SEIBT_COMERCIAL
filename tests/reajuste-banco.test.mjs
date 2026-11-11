// Testa a função aplicar_reajuste (migration 033) num Postgres isolado em memória (PGlite).
// Não usa o banco real. Para rodar:
//   1) instale o PGlite fora do projeto:  npm install @electric-sql/pglite  (numa pasta qualquer)
//   2) PGLITE_DIR=<essa pasta> node --test tests/reajuste-banco.test.mjs
// Sem o PGlite, os testes são ignorados.
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
const VEND = "00000000-0000-0000-0000-000000000003";
const P = (n) => `10000000-0000-0000-0000-00000000000${n}`;

async function preparar() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    CREATE TYPE public.perfil AS ENUM ('admin','vendedor_interno','representante','engenharia');
    CREATE TYPE public.categoria_produto AS ENUM ('maquina','navalha','peneira','rolamento','parafuso','rotor','inserto','periferico','linha','outro');
    CREATE TABLE public.usuarios (id uuid PRIMARY KEY, nome text, perfil public.perfil, ativo boolean DEFAULT true, deleted_at timestamptz);
    CREATE FUNCTION public.get_my_perfil() RETURNS public.perfil LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$ SELECT perfil FROM public.usuarios WHERE id = auth.uid() AND ativo = true AND deleted_at IS NULL $$;
    CREATE TABLE public.produtos (
      id uuid PRIMARY KEY, codigo text UNIQUE NOT NULL, descricao text, categoria public.categoria_produto NOT NULL DEFAULT 'outro',
      preco_brl numeric(15,2), preco_painel_220 numeric(15,2), preco_painel_380 numeric(15,2),
      ativo boolean NOT NULL DEFAULT true, deleted_at timestamptz, atualizado_em timestamptz DEFAULT now());
    CREATE TABLE public.historico_precos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
      preco_anterior_brl numeric(15,2), preco_novo_brl numeric(15,2), percentual_reajuste numeric(8,2), motivo text,
      data_reajuste date NOT NULL DEFAULT CURRENT_DATE, reajustado_por uuid NOT NULL REFERENCES public.usuarios(id), componente text);
    ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.historico_precos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY produtos_admin_full ON public.produtos FOR ALL TO authenticated USING (get_my_perfil() = 'admin');
    CREATE POLICY produtos_eng_read ON public.produtos FOR SELECT TO authenticated USING (get_my_perfil() = 'engenharia');
    CREATE POLICY historico_admin_read ON public.historico_precos FOR SELECT TO authenticated USING (get_my_perfil() = 'admin');
    CREATE POLICY historico_engenharia_full ON public.historico_precos FOR ALL TO authenticated USING (get_my_perfil() = 'engenharia');
    CREATE POLICY historico_precos_admin_escreve ON public.historico_precos FOR INSERT WITH CHECK (get_my_perfil() = 'admin');
    CREATE POLICY historico_precos_admin_atualiza ON public.historico_precos FOR UPDATE USING (get_my_perfil() = 'admin');
    CREATE POLICY historico_precos_admin_exclui ON public.historico_precos FOR DELETE USING (get_my_perfil() = 'admin');
    INSERT INTO public.usuarios VALUES ('${ADMIN}','Admin','admin'), ('${ENG}','Eng','engenharia'), ('${VEND}','Vend','vendedor_interno');
    INSERT INTO public.produtos (id, codigo, descricao, categoria, preco_brl, preco_painel_220, preco_painel_380, ativo, deleted_at) VALUES
      ('${P(1)}','MQ1','Máquina 1','maquina',100000.00,5000.00,6000.00,true,null),
      ('${P(2)}','MQ2','Máquina 2','maquina',200000.00,null,7000.00,true,null),
      ('${P(3)}','PC1','Peça 1','navalha',199.99,null,null,true,null),
      ('${P(4)}','PC2','Peça inativa','navalha',50.00,null,null,false,null),
      ('${P(5)}','PC3','Peça excluída','navalha',60.00,null,null,true,now()),
      ('${P(6)}','PC4','Peça sem preço','navalha',null,null,null,true,null);
  `);
  await db.exec(readFileSync(join(aqui, "../supabase/migrations/033_reajuste_transacional.sql"), "utf8"));
  await db.exec(`GRANT USAGE ON SCHEMA public, auth TO authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;`);
  return db;
}

async function como(db, uid, sql, params = []) {
  await db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false); SET ROLE authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec("RESET ROLE"); }
}

const chave = () => crypto.randomUUID();
const aplicar = (db, uid, itens, motivo = "Reajuste anual", c = chave()) =>
  como(db, uid, "SELECT public.aplicar_reajuste($1::jsonb, $2, $3::uuid) AS r", [JSON.stringify(itens), motivo, c]);
const preco = async (db, n, col = "preco_brl") => Number((await db.query(`SELECT ${col} AS v FROM public.produtos WHERE id = '${P(n)}'`)).rows[0].v);
const contarHist = async (db) => Number((await db.query("SELECT count(*) AS n FROM public.historico_precos")).rows[0].n);
const item = (n, componente, esperado, novo) => ({ produto_id: P(n), componente, preco_esperado: esperado, preco_novo: novo });

const t = PGlite ? test : test.skip;

t("grava preço e histórico juntos, com data de Brasília e percentual", async () => {
  const db = await preparar();
  const r = (await aplicar(db, ADMIN, [item(1, "moinho", 100000, 105000), item(1, "painel_220", 5000, 5100), item(3, "peca", 199.99, 206.99)])).rows[0].r;
  assert.equal(r.componentes, 3);
  assert.equal(r.produtos, 2);
  assert.equal(r.repetido, false);
  assert.equal(await preco(db, 1), 105000);
  assert.equal(await preco(db, 1, "preco_painel_220"), 5100);
  assert.equal(await preco(db, 3), 206.99);
  assert.equal(await contarHist(db), 3);
  const h = (await db.query("SELECT componente, percentual_reajuste, data_reajuste::text AS d, motivo FROM public.historico_precos ORDER BY preco_novo_brl DESC")).rows;
  assert.deepEqual(h.map((x) => x.componente), ["moinho", "painel_220", null]);
  assert.equal(Number(h[0].percentual_reajuste), 5);
  assert.equal(Number(h[2].percentual_reajuste), 3.5);
  const hoje = (await db.query("SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text AS d")).rows[0].d;
  assert.equal(h[0].d, hoje);
  assert.equal(h[0].motivo, "Reajuste anual");
});

t("repetir a mesma requisição não aplica o percentual duas vezes", async () => {
  const db = await preparar();
  const c = chave();
  const itens = [item(1, "moinho", 100000, 110000)];
  const a = (await aplicar(db, ADMIN, itens, "Reajuste anual", c)).rows[0].r;
  const b = (await aplicar(db, ADMIN, itens, "Reajuste anual", c)).rows[0].r;
  assert.equal(a.repetido, false);
  assert.equal(b.repetido, true);
  assert.equal(b.lote_id, a.lote_id);
  assert.equal(await preco(db, 1), 110000);
  assert.equal(await contarHist(db), 1);
});

t("preço alterado depois da prévia interrompe tudo (nenhum item do lote é gravado)", async () => {
  const db = await preparar();
  await db.query(`UPDATE public.produtos SET preco_brl = 101000 WHERE id = '${P(2)}'`); // alguém mexeu em MQ2
  await assert.rejects(
    aplicar(db, ADMIN, [item(1, "moinho", 100000, 110000), item(2, "moinho", 200000, 220000), item(3, "peca", 199.99, 210)]),
    /PRECO_ALTERADO:MQ2/
  );
  assert.equal(await preco(db, 1), 100000);
  assert.equal(await preco(db, 3), 199.99);
  assert.equal(await contarHist(db), 0);
});

t("falha no meio do lote desfaz tudo (componente inválido no fim)", async () => {
  const db = await preparar();
  await assert.rejects(
    aplicar(db, ADMIN, [item(1, "moinho", 100000, 110000), item(3, "painel_220", 199.99, 210)]),
    /COMPONENTE_INVALIDO/
  );
  assert.equal(await preco(db, 1), 100000);
  assert.equal(await contarHist(db), 0);
});

t("operação sem alteração é recusada e não cria histórico", async () => {
  const db = await preparar();
  await assert.rejects(aplicar(db, ADMIN, [item(1, "moinho", 100000, 100000)]), /NENHUMA_ALTERACAO/);
  await assert.rejects(aplicar(db, ADMIN, []), /NENHUMA_ALTERACAO/);
  assert.equal(await contarHist(db), 0);
});

t("inativo, excluído, inexistente e sem preço são ignorados com motivo; o resto grava", async () => {
  const db = await preparar();
  const r = (await aplicar(db, ADMIN, [
    item(3, "peca", 199.99, 210), item(4, "peca", 50, 55), item(5, "peca", 60, 66), item(6, "peca", null, 10),
    { produto_id: "10000000-0000-0000-0000-0000000000ff", componente: "peca", preco_esperado: 1, preco_novo: 2 },
    item(2, "painel_220", null, 100),
  ])).rows[0].r;
  assert.equal(r.componentes, 1);
  assert.deepEqual(r.ignorados.map((i) => i.motivo).sort(), ["excluido", "inativo", "nao_encontrado", "sem_preco", "sem_preco"]);
  assert.equal(await preco(db, 4), 50);
  assert.equal(await preco(db, 5), 60);
  assert.equal(await contarHist(db), 1);
});

t("quem não é administrador não reajusta nem grava histórico", async () => {
  const db = await preparar();
  await assert.rejects(aplicar(db, ENG, [item(1, "moinho", 100000, 110000)]), /SEM_PERMISSAO/);
  await assert.rejects(aplicar(db, VEND, [item(1, "moinho", 100000, 110000)]), /SEM_PERMISSAO/);
  await assert.rejects(aplicar(db, null, [item(1, "moinho", 100000, 110000)]), /SEM_PERMISSAO/);
  assert.equal(await preco(db, 1), 100000);
  // engenharia não consegue inserir histórico direto (permissão apertada pela migration)
  await assert.rejects(como(db, ENG, `INSERT INTO public.historico_precos (produto_id, preco_novo_brl, reajustado_por) VALUES ('${P(1)}', 1, '${ENG}')`));
  // histórico não pode ser editado nem apagado pela aplicação
  await aplicar(db, ADMIN, [item(1, "moinho", 100000, 110000)]);
  await como(db, ADMIN, "UPDATE public.historico_precos SET motivo = 'x'");
  await como(db, ADMIN, "DELETE FROM public.historico_precos");
  assert.equal(await contarHist(db), 1);
  assert.equal((await db.query("SELECT motivo FROM public.historico_precos")).rows[0].motivo, "Reajuste anual");
});

t("motivo, preço e chave inválidos são recusados", async () => {
  const db = await preparar();
  await assert.rejects(aplicar(db, ADMIN, [item(1, "moinho", 100000, 110000)], "  "), /MOTIVO_INVALIDO/);
  await assert.rejects(aplicar(db, ADMIN, [item(1, "moinho", 100000, 110000)], "ab"), /MOTIVO_INVALIDO/);
  await assert.rejects(aplicar(db, ADMIN, [item(1, "moinho", 100000, -5)]), /PRECO_INVALIDO/);
  await assert.rejects(aplicar(db, ADMIN, [item(1, "moinho", 100000, 100000.123)]), /PRECO_INVALIDO/);
  await assert.rejects(aplicar(db, ADMIN, [item(1, "coluna_qualquer", 100000, 110000)]), /COMPONENTE_INVALIDO/);
  await assert.rejects(como(db, ADMIN, "SELECT public.aplicar_reajuste($1::jsonb, 'Reajuste', NULL)", [JSON.stringify([item(1, "moinho", 100000, 110000)])]), /CHAVE_INVALIDA/);
  assert.equal(await contarHist(db), 0);
});

t("reaplicar com a chave nova usa o preço atual (não acumula por engano)", async () => {
  const db = await preparar();
  await aplicar(db, ADMIN, [item(1, "moinho", 100000, 110000)]);
  // prévia antiga (preço esperado 100000) com chave nova: recusada
  await assert.rejects(aplicar(db, ADMIN, [item(1, "moinho", 100000, 110000)]), /PRECO_ALTERADO:MQ1/);
  assert.equal(await preco(db, 1), 110000);
  assert.equal(await contarHist(db), 1);
});

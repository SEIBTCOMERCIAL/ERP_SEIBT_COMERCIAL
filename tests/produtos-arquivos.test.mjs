// Testa o envio, a remoção e a foto da linha com armazenamento e banco simulados (sem rede).
import test from "node:test";
import assert from "node:assert/strict";
import { executarEnvio, executarRemocao, executarFotoDaLinha, BUCKET_PUBLICO, BUCKET_PRIVADO } from "../src/lib/produtos/arquivos.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0, 0, 0, 0, 0]);
const ID = "10000000-0000-0000-0000-000000000001";

function simulador(cfg = {}) {
  const log = { uploads: [], removidos: [], insercoes: [], rpcs: [] };
  const storage = { from: (bucket) => ({
    upload: async (caminho) => { log.uploads.push([bucket, caminho]); return { error: cfg.falhaUpload ? { message: "boom" } : null }; },
    remove: async (caminhos) => { log.removidos.push([bucket, ...caminhos]); return { error: cfg.falhaRemocao ? { message: "boom" } : null }; },
    getPublicUrl: (caminho) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${caminho}` } }),
  }) };
  const tabela = (nome) => {
    const estado = { nome, filtros: [] };
    const q = new Proxy({}, { get(_, m) {
      if (m === "then") return (res) => res(cfg.contagens?.(estado) ?? { count: 0, error: null });
      if (m === "maybeSingle") return async () => (nome === "produtos" ? { data: cfg.produto === undefined ? { id: ID, deleted_at: null } : cfg.produto, error: null } : { data: null, error: null });
      if (m === "single") return async () => (cfg.falhaCadastro ? { data: null, error: { message: "boom", code: "23505" } } : { data: { id: "arq-1" }, error: null });
      if (m === "insert") return (linha) => { log.insercoes.push([nome, linha]); return q; };
      return (...args) => { estado.filtros.push([m, ...args]); return q; };
    } });
    return q;
  };
  return { log, storage, from: tabela, rpc: async (nome, args) => { log.rpcs.push([nome, args]); return cfg.rpc?.(nome, args) ?? { data: null, error: null }; } };
}
const arq = (nome, bytes, tipoMime, tamanho = 1000) => ({ nome, tipoMime, tamanho, bytes });

test("imagem vai para o bucket público e documento para o privado", async () => {
  const a = simulador();
  const img = await executarEnvio(a, ID, "imagem", arq("foto.png", PNG, "image/png"));
  assert.equal(img.ok, true);
  assert.match(img.url, /\/object\/public\/produto-arquivos\//);
  assert.equal(a.log.uploads[0][0], BUCKET_PUBLICO);
  assert.equal(a.log.insercoes[0][1].tipo, "imagem");

  const b = simulador();
  const doc = await executarEnvio(b, ID, "documento", arq("Desenho (rev 2).pdf", PDF, "application/pdf"));
  assert.equal(doc.ok, true);
  assert.equal(doc.url, null); // documento nunca expõe endereço público
  assert.equal(b.log.uploads[0][0], BUCKET_PRIVADO);
  assert.match(b.log.insercoes[0][1].url, /^privado:\/\//);
  assert.equal(b.log.insercoes[0][1].tipo, "desenho");
  assert.match(b.log.uploads[0][1], /Desenho-rev-2\.pdf$/);
});

test("arquivo inválido ou produto inexistente: nada é enviado", async () => {
  const casos = [
    [simulador(), arq("foto.png", PDF, "image/png"), "imagem"], // conteúdo não é PNG
    [simulador(), arq("foto.exe", PNG, "image/png"), "imagem"], // extensão
    [simulador(), arq("grande.png", PNG, "image/png", 5 * 1024 * 1024), "imagem"], // acima do limite
    [simulador(), arq("doc.pdf", PDF, "application/pdf"), "imagem"], // PDF não é imagem
    [simulador({ produto: null }), arq("foto.png", PNG, "image/png"), "imagem"], // produto não existe
    [simulador({ produto: { id: ID, deleted_at: "2026-01-01" } }), arq("foto.png", PNG, "image/png"), "imagem"], // excluído
  ];
  for (const [s, a, f] of casos) {
    const r = await executarEnvio(s, ID, f, a);
    assert.equal(r.ok, false, a.nome);
    assert.equal(s.log.uploads.length, 0);
    assert.equal(s.log.insercoes.length, 0);
  }
});

test("falha no cadastro remove o arquivo enviado; falha no envio não cadastra nada", async () => {
  const s = simulador({ falhaCadastro: true });
  const r = await executarEnvio(s, ID, "imagem", arq("foto.png", PNG, "image/png"));
  assert.equal(r.ok, false);
  assert.equal(s.log.removidos.length, 1);
  assert.equal(s.log.removidos[0][1], s.log.uploads[0][1]); // limpou exatamente o que subiu

  const duplo = simulador({ falhaCadastro: true, falhaRemocao: true });
  const r2 = await executarEnvio(duplo, ID, "imagem", arq("foto.png", PNG, "image/png"));
  assert.match(r2.erro, /não pôde ser limpo/);

  const semUpload = simulador({ falhaUpload: true });
  const r3 = await executarEnvio(semUpload, ID, "imagem", arq("foto.png", PNG, "image/png"));
  assert.equal(r3.ok, false);
  assert.equal(semUpload.log.insercoes.length, 0);
});

test("remoção: arquivo compartilhado não sai do armazenamento; falha de limpeza e foto principal geram aviso", async () => {
  const livre = simulador({ rpc: () => ({ data: { storage_path: `${ID}/imagem/1.jpg`, bucket: BUCKET_PUBLICO, ainda_usado: false, foto_principal_trocada: true }, error: null }) });
  const r1 = await executarRemocao(livre, ID, "arq");
  assert.equal(r1.ok, true);
  assert.deepEqual(livre.log.removidos, [[BUCKET_PUBLICO, `${ID}/imagem/1.jpg`]]);
  assert.match(r1.avisos[0], /foto principal/);

  const compartilhado = simulador({ rpc: () => ({ data: { storage_path: `${ID}/imagem/1.jpg`, bucket: BUCKET_PUBLICO, ainda_usado: true, foto_principal_trocada: false }, error: null }) });
  await executarRemocao(compartilhado, ID, "arq");
  assert.equal(compartilhado.log.removidos.length, 0);

  const semCaminho = simulador({ rpc: () => ({ data: { storage_path: null, bucket: BUCKET_PUBLICO, ainda_usado: false, foto_principal_trocada: false }, error: null }) });
  await executarRemocao(semCaminho, ID, "arq");
  assert.equal(semCaminho.log.removidos.length, 0); // foto da linha: não existe arquivo próprio para apagar

  const falhaLimpeza = simulador({ falhaRemocao: true, rpc: () => ({ data: { storage_path: "a/b.pdf", bucket: BUCKET_PRIVADO, ainda_usado: false, foto_principal_trocada: false }, error: null }) });
  const r4 = await executarRemocao(falhaLimpeza, ID, "arq");
  assert.equal(r4.ok, true);
  assert.match(r4.avisos[0], /continua no armazenamento/);

  const outroProduto = simulador({ rpc: () => ({ data: null, error: { message: "ARQUIVO_INEXISTENTE" } }) });
  const r5 = await executarRemocao(outroProduto, ID, "arq");
  assert.equal(r5.ok, false);
  assert.match(r5.erro, /não encontrado neste produto/);
});

test("foto da linha: só limpa fotos de linha que ninguém mais usa; falha no banco não deixa foto solta", async () => {
  const base = "https://x.supabase.co/storage/v1/object/public/produto-arquivos/";
  const antigas = [`${base}linhas/L/1.png`, `${base}${ID}/imagem/individual.png`, `${base}linhas/L/2.png`];
  const s = simulador({
    rpc: () => ({ data: { afetados: 3, preservados: 0, urls_substituidas: antigas }, error: null }),
    contagens: (estado) => ({ count: estado.filtros.some((f) => f[2] === antigas[2]) ? 1 : 0, error: null }), // a 2.png ainda é usada
  });
  const r = await executarFotoDaLinha(s, "L", "substituir", arq("nova.png", PNG, "image/png"));
  assert.deepEqual([r.ok, r.afetados], [true, 3]);
  assert.equal(s.log.rpcs[0][1].p_substituir, true);
  // removeu só linhas/L/1.png (não usada); a individual e a 2.png (ainda usada) ficam
  assert.deepEqual(s.log.removidos, [[BUCKET_PUBLICO, "linhas/L/1.png"]]);

  const falha = simulador({ rpc: () => ({ data: null, error: { message: "LINHA_SEM_EQUIPAMENTOS" } }) });
  const r2 = await executarFotoDaLinha(falha, "L", "preservar", arq("nova.png", PNG, "image/png"));
  assert.equal(r2.ok, false);
  assert.equal(falha.log.removidos.length, 1); // a foto enviada foi limpa
  assert.equal(falha.log.removidos[0][1], falha.log.uploads[0][1]);

  const ninguem = simulador({ rpc: () => ({ data: { afetados: 0, preservados: 4, urls_substituidas: [] }, error: null }) });
  const r3 = await executarFotoDaLinha(ninguem, "L", "preservar", arq("nova.png", PNG, "image/png"));
  assert.deepEqual([r3.ok, r3.afetados, r3.preservados], [true, 0, 4]);
  assert.equal(ninguem.log.removidos.length, 1); // ninguém usou a foto nova: não fica no armazenamento

  const invalida = simulador();
  const r4 = await executarFotoDaLinha(invalida, "L", "preservar", arq("nova.png", PDF, "image/png"));
  assert.equal(r4.ok, false);
  assert.equal(invalida.log.uploads.length, 0);
});

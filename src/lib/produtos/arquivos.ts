// Orquestração de arquivos de produto (envio, remoção e foto da linha) sobre um cliente de banco/armazenamento.
// Separado das ações do servidor para poder ser testado com um cliente simulado (sem rede).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { falha } from "./servidor";
import { nomeSeguro, validarArquivo, type FinalidadeArquivo } from "./regras";
import type { Resultado } from "./tipos";

export const BUCKET_PUBLICO = "produto-arquivos";
export const BUCKET_PRIVADO = "produto-documentos";
const PREFIXO_PUBLICO = `/storage/v1/object/public/${BUCKET_PUBLICO}/`;

const invalido = (erro: string): Extract<Resultado, { ok: false }> => ({ ok: false, erro, tipo: "validacao" });

export interface ArquivoEntrada { nome: string; tipoMime: string; tamanho: number; bytes: Uint8Array }

/** Imagens ficam no bucket público (aparecem no catálogo); desenhos e documentos, no privado (link temporário). */
export async function executarEnvio(supabase: any, produtoId: string, finalidade: FinalidadeArquivo, arquivo: ArquivoEntrada): Promise<Resultado<{ id: string; url: string | null }>> {
  const { data: produto, error: e1 } = await supabase.from("produtos").select("id, deleted_at").eq("id", produtoId).maybeSingle();
  if (e1) return falha(e1);
  if (!produto || produto.deleted_at) return invalido("Produto não encontrado (pode ter sido excluído).");

  const v = validarArquivo({ nome: arquivo.nome, tipoMime: arquivo.tipoMime, tamanho: arquivo.tamanho, inicio: arquivo.bytes.slice(0, 16) }, finalidade);
  if (v.erro !== undefined) return invalido(v.erro);

  const bucket = finalidade === "imagem" ? BUCKET_PUBLICO : BUCKET_PRIVADO;
  const base = nomeSeguro(arquivo.nome.replace(/\.[^.]+$/, ""));
  const caminho = `${produtoId}/${finalidade}/${Date.now()}-${base}.${v.ext}`;
  const { error: errUp } = await supabase.storage.from(bucket).upload(caminho, arquivo.bytes, { contentType: v.mime, upsert: false });
  if (errUp) return { ok: false, tipo: "banco", erro: "Não foi possível enviar o arquivo. Tente novamente." };

  const url = finalidade === "imagem" ? supabase.storage.from(bucket).getPublicUrl(caminho).data.publicUrl : `privado://${bucket}/${caminho}`;
  const { data: linha, error: errDb } = await supabase.from("produto_arquivos")
    .insert({ produto_id: produtoId, tipo: finalidade === "imagem" ? "imagem" : "desenho", nome: arquivo.nome.slice(0, 200), url, storage_path: caminho, bucket })
    .select("id").single();
  if (errDb) {
    // Cadastro falhou: remove o arquivo recém-enviado para não deixar lixo no armazenamento.
    const { error: errLimpeza } = await supabase.storage.from(bucket).remove([caminho]);
    const r = falha(errDb);
    return errLimpeza ? { ...r, erro: `${r.erro} (O arquivo enviado não pôde ser limpo automaticamente; avise o responsável.)` } : r;
  }
  return { ok: true, id: linha.id, url: finalidade === "imagem" ? url : null };
}

/** Remove o arquivo (conferindo o vínculo com o produto); só apaga do armazenamento se nenhum outro cadastro usa o mesmo arquivo. */
export async function executarRemocao(supabase: any, produtoId: string, arquivoId: string): Promise<Resultado<{ avisos: string[] }>> {
  const { data, error } = await supabase.rpc("produto_remover_arquivo", { p_arquivo: arquivoId, p_produto: produtoId });
  if (error) return falha(error);
  const r = data as { storage_path: string | null; bucket: string; ainda_usado: boolean; foto_principal_trocada: boolean };
  const avisos: string[] = [];
  if (r.storage_path && !r.ainda_usado) {
    const { error: errRemocao } = await supabase.storage.from(r.bucket).remove([r.storage_path]);
    if (errRemocao) avisos.push("O registro foi removido, mas o arquivo continua no armazenamento. Avise o responsável para limpar.");
  }
  if (r.foto_principal_trocada) avisos.push("Era a foto principal: o catálogo passou a usar outra imagem do equipamento (ou ficou sem foto).");
  return { ok: true, avisos };
}

/** Foto única para os equipamentos da linha: preservar fotos individuais ou substituir todas. Tudo ou nada no banco. */
export async function executarFotoDaLinha(supabase: any, linhaId: string, modo: "preservar" | "substituir", arquivo: ArquivoEntrada): Promise<Resultado<{ afetados: number; preservados: number }>> {
  const v = validarArquivo({ nome: arquivo.nome, tipoMime: arquivo.tipoMime, tamanho: arquivo.tamanho, inicio: arquivo.bytes.slice(0, 16) }, "imagem");
  if (v.erro !== undefined) return invalido(v.erro);

  const caminho = `linhas/${linhaId}/${Date.now()}.${v.ext}`;
  const { error: errUp } = await supabase.storage.from(BUCKET_PUBLICO).upload(caminho, arquivo.bytes, { contentType: v.mime, upsert: false });
  if (errUp) return { ok: false, tipo: "banco", erro: "Não foi possível enviar a foto. Tente novamente." };
  const url = supabase.storage.from(BUCKET_PUBLICO).getPublicUrl(caminho).data.publicUrl;

  const { data, error } = await supabase.rpc("produto_aplicar_foto_linha", { p_linha: linhaId, p_url: url, p_nome: arquivo.nome.slice(0, 200), p_substituir: modo === "substituir" });
  if (error) {
    await supabase.storage.from(BUCKET_PUBLICO).remove([caminho]); // nada foi aplicado: não deixa a foto solta
    return falha(error);
  }
  const r = data as { afetados: number; preservados: number; urls_substituidas: string[] };
  if (r.afetados === 0) await supabase.storage.from(BUCKET_PUBLICO).remove([caminho]); // ninguém usou a foto nova

  // Fotos de linha anteriores só saem do armazenamento se nenhum produto ainda as usa.
  for (const antiga of r.urls_substituidas ?? []) {
    const i = antiga.indexOf(PREFIXO_PUBLICO);
    if (i < 0) continue;
    const caminhoAntigo = decodeURIComponent(antiga.slice(i + PREFIXO_PUBLICO.length));
    if (!caminhoAntigo.startsWith("linhas/")) continue; // arquivos próprios de cada equipamento não são tocados
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      supabase.from("produtos").select("id", { count: "exact", head: true }).eq("foto_url", antiga),
      supabase.from("produto_arquivos").select("id", { count: "exact", head: true }).eq("url", antiga),
    ]);
    if (!c1 && !c2) await supabase.storage.from(BUCKET_PUBLICO).remove([caminhoAntigo]);
  }
  return { ok: true, afetados: r.afetados, preservados: r.preservados };
}

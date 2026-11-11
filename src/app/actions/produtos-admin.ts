"use server";

// Ações administrativas de Produtos. Regras: administrador no servidor; entradas validadas aqui; gravações com
// vários passos acontecem em funções do banco (tudo ou nada, migration 034); preços existentes só mudam pelo
// Reajuste; telas que leem produtos/preços são atualizadas depois de cada sucesso.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { revalidarProdutos } from "@/lib/revalidar";
import {
  diffSpecs, ehUuid, limparTexto, limparTextoLongo, parseIpi, parseMoedaOpcional, parseQuantidade, type FinalidadeArquivo,
} from "@/lib/produtos/regras";
import { executarEnvio, executarFotoDaLinha, executarRemocao } from "@/lib/produtos/arquivos";
import { exigirAdmin, falha } from "@/lib/produtos/servidor";
import type { Resultado } from "@/lib/produtos/tipos";

export type AdminState = { error?: string; success?: boolean };

const NAO_ADMIN: Extract<Resultado, { ok: false }> = { ok: false, erro: "Acesso restrito a administradores.", tipo: "permissao" };
const invalido = (erro: string): Extract<Resultado, { ok: false }> => ({ ok: false, erro, tipo: "validacao" });

async function sessao() {
  const supabase = createClient() as any;
  const admin = await exigirAdmin(supabase);
  return admin ? { supabase, userId: admin.id } : null;
}

// ─── Linhas e categorias ────────────────────────────────────────────────────────

export async function criarLinha(nome: string): Promise<Resultado> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  const n = limparTexto(nome, { rotulo: "Nome da linha", obrigatorio: true, max: 80 });
  if (n.erro !== undefined) return invalido(n.erro);
  const { error } = await s.supabase.from("linhas").insert({ nome: n.valor, criado_por: s.userId });
  if (error) return error.code === "23505" ? invalido(`A linha "${n.valor}" já existe.`) : falha(error);
  revalidarProdutos();
  return { ok: true };
}

export async function excluirLinha(id: string): Promise<Resultado> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(id)) return invalido("Linha inválida.");
  const { count, error: e1 } = await s.supabase.from("produtos").select("id", { count: "exact", head: true }).eq("linha_id", id).is("deleted_at", null);
  if (e1) return falha(e1);
  if ((count ?? 0) > 0) return invalido("Remova ou mova os equipamentos desta linha antes de excluí-la.");
  const { error, count: apagadas } = await s.supabase.from("linhas").delete({ count: "exact" }).eq("id", id);
  if (error) return falha(error);
  if (!apagadas) return invalido("Linha não encontrada.");
  revalidarProdutos();
  return { ok: true };
}

export async function criarCategoriaPeca(nome: string): Promise<Resultado> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  const n = limparTexto(nome, { rotulo: "Nome da categoria", obrigatorio: true, max: 80 });
  if (n.erro !== undefined) return invalido(n.erro);
  // O tipo interno fica "outro" (padrão do banco); categorias padrão já têm o tipo correto.
  const { error } = await s.supabase.from("categorias_peca").insert({ nome: n.valor, criado_por: s.userId });
  if (error) return error.code === "23505" ? invalido(`A categoria "${n.valor}" já existe.`) : falha(error);
  revalidarProdutos();
  return { ok: true };
}

export async function excluirCategoriaPeca(id: string): Promise<Resultado> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(id)) return invalido("Categoria inválida.");
  const { count, error: e1 } = await s.supabase.from("produtos").select("id", { count: "exact", head: true }).eq("categoria_peca_id", id).is("deleted_at", null);
  if (e1) return falha(e1);
  if ((count ?? 0) > 0) return invalido("Remova ou mova as peças desta categoria antes de excluí-la.");
  const { error, count: apagadas } = await s.supabase.from("categorias_peca").delete({ count: "exact" }).eq("id", id);
  if (error) return falha(error);
  if (!apagadas) return invalido("Categoria não encontrada.");
  revalidarProdutos();
  return { ok: true };
}

// ─── Modelo de ficha técnica da linha ───────────────────────────────────────────

export async function criarLinhaSpecCampo(linhaId: string, nome: string): Promise<Resultado> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(linhaId)) return invalido("Linha inválida.");
  const n = limparTexto(nome, { rotulo: "Nome do campo", obrigatorio: true, max: 80 });
  if (n.erro !== undefined) return invalido(n.erro);
  const { data: ultimo } = await s.supabase.from("linha_spec_campos").select("ordem").eq("linha_id", linhaId).order("ordem", { ascending: false }).limit(1);
  const ordem = ((ultimo?.[0]?.ordem ?? 0) as number) + 1;
  const { error } = await s.supabase.from("linha_spec_campos").insert({ linha_id: linhaId, nome: n.valor, ordem });
  if (error) return error.code === "23505" ? invalido(`O campo "${n.valor}" já existe nesta linha.`) : falha(error);
  revalidarProdutos();
  return { ok: true };
}

export async function excluirLinhaSpecCampo(linhaId: string, id: string): Promise<Resultado> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(id) || !ehUuid(linhaId)) return invalido("Campo inválido.");
  // Só remove o campo do modelo da linha; os valores já salvos nos equipamentos continuam preservados.
  const { error, count } = await s.supabase.from("linha_spec_campos").delete({ count: "exact" }).eq("id", id).eq("linha_id", linhaId);
  if (error) return falha(error);
  if (!count) return invalido("Campo não encontrado nesta linha.");
  revalidarProdutos();
  return { ok: true };
}

// ─── Equipamentos ───────────────────────────────────────────────────────────────

export interface DadosEquipamento {
  codigo?: string; descricao?: string; descricaoPainel?: string; potenciaMotor?: string; ncm?: string;
  precoBrl?: string; preco220?: string; preco380?: string; solicitarEngenharia?: boolean;
}

/** Converte o formulário em dados validados para o banco; só inclui os campos enviados. */
function montarDadosEquipamento(d: DadosEquipamento, criando: boolean): { erro: string } | { erro?: undefined; dados: Record<string, unknown> } {
  const dados: Record<string, unknown> = {};
  const texto = (chave: keyof DadosEquipamento, saida: string, rotulo: string, obrigatorio: boolean, max = 500, longo = false) => {
    if (d[chave] === undefined) { if (criando && obrigatorio) return `${rotulo} é obrigatório.`; return null; }
    const r = (longo ? limparTextoLongo : limparTexto)(d[chave], { rotulo, obrigatorio, max });
    if (r.erro !== undefined) return r.erro;
    dados[saida] = r.valor ?? "";
    return null;
  };
  const erros = [
    texto("codigo", "codigo", "O código", true, 120),
    texto("descricao", "descricao", "A descrição", true, 8000, true),
    texto("descricaoPainel", "descricao_painel", "A descrição do painel", false, 8000, true),
    texto("potenciaMotor", "potencia_motor", "A potência do motor", false, 60),
    texto("ncm", "ncm", "O NCM", false, 20),
  ].filter(Boolean) as string[];
  if (erros.length) return { erro: erros[0] };
  for (const [chave, saida, rotulo] of [["precoBrl", "preco_brl", "Preço da máquina"], ["preco220", "preco_painel_220", "Preço do painel 220 V"], ["preco380", "preco_painel_380", "Preço do painel 380 V"]] as const) {
    if (d[chave] === undefined) continue;
    const p = parseMoedaOpcional(d[chave]);
    if (p.erro !== undefined) return { erro: `${rotulo}: ${p.erro}` };
    // Na edição, campo de preço vazio não envia nada (limpar preço não é permitido aqui).
    if (criando || p.valor !== null) dados[saida] = p.valor;
  }
  if (d.solicitarEngenharia !== undefined) dados.solicitar_engenharia = Boolean(d.solicitarEngenharia);
  return { dados };
}

async function camposDaLinha(supabase: any, linhaId: string): Promise<string[]> {
  const { data } = await supabase.from("linha_spec_campos").select("nome").eq("linha_id", linhaId);
  return (data ?? []).map((c: { nome: string }) => c.nome);
}

export async function criarEquipamento(linhaId: string, dadosEntrada: DadosEquipamento, specs: Record<string, string>): Promise<Resultado<{ id: string }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(linhaId)) return invalido("Linha inválida.");
  const m = montarDadosEquipamento(dadosEntrada, true);
  if (m.erro !== undefined) return invalido(m.erro);
  const diff = diffSpecs(await camposDaLinha(s.supabase, linhaId), null, specs ?? {});
  if (diff.erro !== undefined) return invalido(diff.erro);
  const { data, error } = await s.supabase.rpc("produto_criar_equipamento", { p_linha: linhaId, p_dados: m.dados, p_specs: diff.definir });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true, id: (data as { id: string }).id };
}

export async function editarEquipamento(linhaId: string, id: string, versao: string | null, dadosEntrada: DadosEquipamento): Promise<Resultado<{ versao: string }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(linhaId) || !ehUuid(id)) return invalido("Cadastro inválido.");
  const m = montarDadosEquipamento(dadosEntrada, false);
  if (m.erro !== undefined) return invalido(m.erro);
  if (Object.keys(m.dados).length === 0) return invalido("Nenhuma alteração para salvar.");
  const { data, error } = await s.supabase.rpc("produto_editar_equipamento", { p_id: id, p_linha: linhaId, p_versao: versao, p_dados: m.dados });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true, versao: (data as { versao: string }).versao };
}

export async function atualizarFichaTecnica(linhaId: string, id: string, versao: string | null, valores: Record<string, string>): Promise<Resultado<{ versao: string; alterados: number }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(linhaId) || !ehUuid(id)) return invalido("Cadastro inválido.");
  const { data: p, error: e1 } = await s.supabase.from("produtos").select("specs, linha_id, categoria, deleted_at").eq("id", id).maybeSingle();
  if (e1) return falha(e1);
  if (!p || p.deleted_at) return invalido("Cadastro não encontrado (pode ter sido excluído).");
  if (p.categoria !== "maquina" || p.linha_id !== linhaId) return invalido("Este equipamento não pertence à linha informada.");
  const diff = diffSpecs(await camposDaLinha(s.supabase, linhaId), p.specs && typeof p.specs === "object" ? p.specs : {}, valores ?? {});
  if (diff.erro !== undefined) return invalido(diff.erro);
  const alterados = Object.keys(diff.definir).length + diff.remover.length;
  if (alterados === 0) return invalido("Nenhuma alteração para salvar.");
  const { data, error } = await s.supabase.rpc("produto_atualizar_specs", { p_id: id, p_linha: linhaId, p_versao: versao, p_definir: diff.definir, p_remover: diff.remover });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true, versao: (data as { versao: string }).versao, alterados };
}

export async function duplicarEquipamento(linhaId: string, id: string): Promise<Resultado<{ id: string }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(linhaId) || !ehUuid(id)) return invalido("Cadastro inválido.");
  const { data, error } = await s.supabase.rpc("produto_duplicar_equipamento", { p_id: id, p_linha: linhaId });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true, id: (data as { id: string }).id };
}

/** Descontinuar, reativar ou excluir (exclusão lógica: o histórico de preços é preservado). */
export async function alterarSituacao(id: string, acao: "descontinuar" | "reativar" | "excluir"): Promise<Resultado<{ vinculosRemovidos: number }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(id)) return invalido("Cadastro inválido.");
  const { data, error } = await s.supabase.rpc("produto_alterar_situacao", { p_id: id, p_acao: acao });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true, vinculosRemovidos: (data as { vinculos_removidos: number }).vinculos_removidos ?? 0 };
}

// ─── Peças e vínculos ───────────────────────────────────────────────────────────

export interface DadosPeca {
  codigo?: string; descricao?: string; ncm?: string; precoBrl?: string; ipi?: string; furoDiametro?: string; observacao?: string;
}

function montarDadosPeca(d: DadosPeca, criando: boolean): { erro: string } | { erro?: undefined; dados: Record<string, unknown> } {
  const dados: Record<string, unknown> = {};
  const campos: Array<[keyof DadosPeca, string, string, boolean, number]> = [
    ["codigo", "codigo", "O código", true, 120], ["descricao", "descricao", "A descrição", true, 500], ["ncm", "ncm", "O NCM", false, 20],
    ["furoDiametro", "furo_diametro", "O diâmetro do furo", false, 40], ["observacao", "observacao", "A observação", false, 1000],
  ];
  for (const [chave, saida, rotulo, obrigatorio, max] of campos) {
    if (d[chave] === undefined) { if (criando && obrigatorio) return { erro: `${rotulo} é obrigatório.` }; continue; }
    const r = limparTexto(d[chave], { rotulo, obrigatorio, max });
    if (r.erro !== undefined) return { erro: r.erro };
    dados[saida] = r.valor ?? "";
  }
  if (d.ipi !== undefined) {
    const ipi = parseIpi(d.ipi);
    if (ipi.erro !== undefined) return { erro: ipi.erro };
    dados.ipi_pct = ipi.valor;
  }
  if (d.precoBrl !== undefined) {
    const p = parseMoedaOpcional(d.precoBrl);
    if (p.erro !== undefined) return { erro: `Preço: ${p.erro}` };
    if (criando || p.valor !== null) dados.preco_brl = p.valor;
  }
  return { dados };
}

export async function criarPeca(categoriaId: string, dadosEntrada: DadosPeca, equipamentoId: string | null = null, quantidade = "1"): Promise<Resultado<{ id: string }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(categoriaId) || (equipamentoId !== null && !ehUuid(equipamentoId))) return invalido("Seleção inválida.");
  const m = montarDadosPeca(dadosEntrada, true);
  if (m.erro !== undefined) return invalido(m.erro);
  let qtd = 1;
  if (equipamentoId) {
    const q = parseQuantidade(quantidade);
    if (q.erro !== undefined) return invalido(q.erro);
    qtd = q.valor;
  }
  const { data, error } = await s.supabase.rpc("produto_criar_peca", { p_categoria: categoriaId, p_dados: m.dados, p_equipamento: equipamentoId, p_quantidade: qtd });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true, id: (data as { id: string }).id };
}

/** Edita os dados GLOBAIS da peça: valem para todos os equipamentos que a usam. Devolve quantos são. */
export async function editarPeca(id: string, versao: string | null, dadosEntrada: DadosPeca): Promise<Resultado<{ versao: string; equipamentos: number }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(id)) return invalido("Cadastro inválido.");
  const m = montarDadosPeca(dadosEntrada, false);
  if (m.erro !== undefined) return invalido(m.erro);
  if (Object.keys(m.dados).length === 0) return invalido("Nenhuma alteração para salvar.");
  const { data, error } = await s.supabase.rpc("produto_editar_peca", { p_id: id, p_versao: versao, p_dados: m.dados });
  if (error) return falha(error);
  revalidarProdutos();
  const r = data as { versao: string; equipamentos: number };
  return { ok: true, versao: r.versao, equipamentos: r.equipamentos };
}

export async function vincularPeca(equipamentoId: string, pecaId: string, quantidade: string): Promise<Resultado<{ id: string }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(equipamentoId) || !ehUuid(pecaId)) return invalido("Seleção inválida.");
  const q = parseQuantidade(quantidade);
  if (q.erro !== undefined) return invalido(q.erro);
  const { data, error } = await s.supabase.rpc("produto_vincular_peca", { p_equipamento: equipamentoId, p_peca: pecaId, p_quantidade: q.valor });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true, id: (data as { id: string }).id };
}

export async function atualizarVinculo(equipamentoId: string, vinculoId: string, quantidade: string): Promise<Resultado> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(equipamentoId) || !ehUuid(vinculoId)) return invalido("Seleção inválida.");
  const q = parseQuantidade(quantidade);
  if (q.erro !== undefined) return invalido(q.erro);
  const { error } = await s.supabase.rpc("produto_atualizar_vinculo", { p_vinculo: vinculoId, p_equipamento: equipamentoId, p_quantidade: q.valor });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true };
}

export async function desvincularPeca(equipamentoId: string, vinculoId: string): Promise<Resultado> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(equipamentoId) || !ehUuid(vinculoId)) return invalido("Seleção inválida.");
  const { error } = await s.supabase.rpc("produto_desvincular_peca", { p_vinculo: vinculoId, p_equipamento: equipamentoId });
  if (error) return falha(error);
  revalidarProdutos();
  return { ok: true };
}

// ─── Arquivos ───────────────────────────────────────────────────────────────────

async function lerArquivo(arquivo: File) {
  return { nome: arquivo.name, tipoMime: arquivo.type, tamanho: arquivo.size, bytes: new Uint8Array(await arquivo.arrayBuffer()) };
}

/** Imagens ficam no bucket público (aparecem no catálogo); desenhos e documentos, no privado (link temporário). */
export async function enviarArquivoProduto(formData: FormData): Promise<Resultado<{ id: string; url: string | null }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  const produtoId = formData.get("produto_id");
  const finalidade: FinalidadeArquivo = formData.get("finalidade") === "documento" ? "documento" : "imagem";
  const arquivo = formData.get("arquivo");
  if (!ehUuid(produtoId)) return invalido("Produto inválido.");
  if (!(arquivo instanceof File)) return invalido("Escolha um arquivo.");
  const r = await executarEnvio(s.supabase, produtoId, finalidade, await lerArquivo(arquivo));
  if (r.ok) revalidarProdutos();
  return r;
}

/** Compatível com o modal de foto do catálogo (formulário antigo): só imagens. */
export async function uploadArquivoProduto(_prev: AdminState, formData: FormData): Promise<AdminState & { url?: string }> {
  formData.set("finalidade", "imagem");
  const r = await enviarArquivoProduto(formData);
  return r.ok ? { success: true, url: r.url ?? undefined } : { error: r.erro };
}

/** Remove o arquivo do produto (confere o vínculo); só apaga do armazenamento se nenhum outro cadastro usa o mesmo arquivo. */
export async function removerArquivoProduto(produtoId: string, arquivoId: string): Promise<Resultado<{ avisos: string[] }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(produtoId) || !ehUuid(arquivoId)) return invalido("Arquivo inválido.");
  const r = await executarRemocao(s.supabase, produtoId, arquivoId);
  if (r.ok) revalidarProdutos();
  return r;
}

export async function previaFotoDaLinha(linhaId: string): Promise<Resultado<{ total: number; comFotoPropria: number }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  if (!ehUuid(linhaId)) return invalido("Linha inválida.");
  const { data, error } = await s.supabase.from("produtos").select("id, foto_url").eq("linha_id", linhaId).eq("categoria", "maquina").is("deleted_at", null).limit(5000);
  if (error) return falha(error);
  const lista = data ?? [];
  return { ok: true, total: lista.length, comFotoPropria: lista.filter((p: { foto_url: string | null }) => !!p.foto_url).length };
}

/** Foto única para os equipamentos da linha, com escolha explícita: preservar fotos individuais ou substituir todas. */
export async function definirFotoDaLinha(formData: FormData): Promise<Resultado<{ afetados: number; preservados: number }>> {
  const s = await sessao();
  if (!s) return NAO_ADMIN;
  const linhaId = formData.get("linha_id");
  const modo = formData.get("modo") === "substituir" ? "substituir" : "preservar";
  const arquivo = formData.get("arquivo");
  if (!ehUuid(linhaId)) return invalido("Linha inválida.");
  if (!(arquivo instanceof File)) return invalido("Escolha uma foto.");
  const r = await executarFotoDaLinha(s.supabase, linhaId, modo, await lerArquivo(arquivo));
  if (r.ok) revalidarProdutos();
  return r;
}

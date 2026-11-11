// Consultas e tradução de erros de Produtos (somente servidor). Usa sempre o cliente com a sessão do usuário:
// as regras de acesso do banco continuam valendo.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buscarTodos } from "@/lib/supabase/buscar-todos";
import { listarPendencias, sanitizarBusca, situacaoDoProduto, TAMANHO_PAGINA_PRODUTOS, type FiltrosProdutos } from "./regras";
import type {
  ArquivoProduto, CategoriaNav, Contagem, EquipamentoDetalheDados, LinhaNav, Navegacao, PecaBusca, PecaDetalhe,
  ProdutoLista, RespostaListaProdutos, Resultado, TipoErro, VinculoPeca,
} from "./tipos";

export { exigirAdmin } from "@/lib/reajuste/servidor";

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const VAZIA: Contagem = { total: 0, descontinuados: 0, sem_foto: 0, sem_preco: 0, ficha_incompleta: 0, sem_vinculo: 0 };

// ─── Erros ──────────────────────────────────────────────────────────────────────

const MENSAGENS: Array<[RegExp, string, TipoErro]> = [
  [/SEM_PERMISSAO/, "Acesso restrito a administradores.", "permissao"],
  [/CONFLITO_EDICAO/, "Este cadastro foi alterado por outra pessoa depois que você o abriu. Atualize a página para ver as mudanças e refaça sua edição.", "conflito"],
  [/USE_REAJUSTE/, "O preço já cadastrado só muda pelo Reajuste de preços. Nenhum dado foi alterado.", "preco"],
  [/LINHA_INCOMPATIVEL/, "Este equipamento não pertence à linha informada. Abra-o pela lista da linha correta.", "validacao"],
  [/LINHA_INEXISTENTE/, "Linha não encontrada.", "validacao"],
  [/LINHA_SEM_EQUIPAMENTOS/, "Esta linha não tem equipamentos.", "validacao"],
  [/PRODUTO_INEXISTENTE/, "Cadastro não encontrado (pode ter sido excluído).", "validacao"],
  [/EQUIPAMENTO_INEXISTENTE/, "Equipamento não encontrado.", "validacao"],
  [/PECA_INEXISTENTE/, "Peça não encontrada.", "validacao"],
  [/CATEGORIA_INEXISTENTE/, "Categoria de peça não encontrada.", "validacao"],
  [/VINCULO_DUPLICADO/, "Esta peça já está vinculada a este equipamento.", "validacao"],
  [/VINCULO_INEXISTENTE/, "Vínculo não encontrado neste equipamento.", "validacao"],
  [/ARQUIVO_INEXISTENTE/, "Arquivo não encontrado neste produto.", "validacao"],
  [/CODIGO_OBRIGATORIO/, "Informe o código.", "validacao"],
  [/DESCRICAO_OBRIGATORIA/, "Informe a descrição.", "validacao"],
  [/PRECO_INVALIDO/, "Preço inválido. Use valores sem negativos e com no máximo 2 casas decimais.", "validacao"],
  [/IPI_INVALIDO/, "IPI inválido (de 0 a 100%).", "validacao"],
  [/QUANTIDADE_INVALIDA/, "Quantidade inválida (inteiro de 1 a 10.000).", "validacao"],
  [/SPECS_INVALIDAS/, "Ficha técnica inválida.", "validacao"],
  [/ACAO_INVALIDA|ARQUIVO_INVALIDO/, "Operação inválida.", "validacao"],
];

export function traduzirErro(error: { code?: string; message?: string } | null | undefined, padrao = "Não foi possível concluir. Nada foi alterado. Tente novamente."): { erro: string; tipo: TipoErro } {
  const m = error?.message ?? "";
  for (const [re, texto, tipo] of MENSAGENS) if (re.test(m)) return { erro: texto, tipo };
  if (error?.code === "23505" || /duplicate key|unique/i.test(m)) return { erro: "Já existe um cadastro com este código.", tipo: "validacao" };
  if (error?.code === "23503") return { erro: "Este registro está em uso e não pode ser alterado desta forma.", tipo: "validacao" };
  if (error?.code === "42501" || /row-level security/i.test(m)) return { erro: "Sem permissão para esta operação.", tipo: "permissao" };
  if (/PGRST202|PGRST205|42883|42P01|schema cache|could not find the function|does not exist/i.test(`${error?.code ?? ""} ${m}`)) {
    return { erro: "A atualização do banco de dados de produtos (arquivo 034) ainda não foi aplicada. Peça ao responsável para aplicá-la.", tipo: "nao_aplicado" };
  }
  return { erro: padrao, tipo: "banco" };
}

export const falha = (error: { code?: string; message?: string } | null | undefined): Extract<Resultado, { ok: false }> => ({ ok: false, ...traduzirErro(error) });

// ─── Navegação (famílias, linhas, categorias e contagens) ──────────────────────

export async function carregarNavegacao(supabase: any): Promise<Navegacao> {
  const [linhas, categorias, contagens] = await Promise.all([
    supabase.from("linhas").select("id, nome, ordem, grupo, grupo_ordem").order("grupo_ordem").order("ordem").order("nome"),
    supabase.from("categorias_peca").select("id, nome, ordem").order("ordem").order("nome"),
    supabase.rpc("produtos_contagens"),
  ]);
  if (linhas.error) throw linhas.error;
  if (categorias.error) throw categorias.error;

  const mapa = new Map<string, Contagem>();
  if (!contagens.error) {
    for (const c of contagens.data ?? []) {
      mapa.set(`${c.tipo}:${c.escopo_id}`, {
        total: Number(c.total), descontinuados: Number(c.descontinuados), sem_foto: Number(c.sem_foto),
        sem_preco: Number(c.sem_preco), ficha_incompleta: Number(c.ficha_incompleta), sem_vinculo: Number(c.sem_vinculo),
      });
    }
  } else {
    // Sem a migração 034: contagem simples (só totais), em páginas para não truncar em 1.000 linhas.
    const leves = await buscarTodos((de, ate) => supabase.from("produtos").select("id, categoria, linha_id, categoria_peca_id, status")
      .is("deleted_at", null).order("id").range(de, ate));
    for (const p of leves as any[]) {
      const chave = p.categoria === "maquina" && p.linha_id ? `linha:${p.linha_id}` : p.categoria_peca_id ? `categoria:${p.categoria_peca_id}` : null;
      if (!chave) continue;
      const c = mapa.get(chave) ?? { ...VAZIA };
      c.total++;
      if (p.status === "descontinuado") c.descontinuados++;
      mapa.set(chave, c);
    }
  }
  return {
    linhas: (linhas.data ?? []).map((l: any): LinhaNav => ({
      id: l.id, nome: l.nome, ordem: l.ordem ?? 0, familia: l.grupo ?? null, familia_ordem: l.grupo ? l.grupo_ordem ?? 99 : 999,
      contagem: mapa.get(`linha:${l.id}`) ?? { ...VAZIA },
    })),
    categorias: (categorias.data ?? []).map((c: any): CategoriaNav => ({
      id: c.id, nome: c.nome, ordem: c.ordem ?? 0, contagem: mapa.get(`categoria:${c.id}`) ?? { ...VAZIA },
    })),
  };
}

// ─── Listagem paginada (busca, filtros e ordenação no banco) ───────────────────

const COLUNAS_VISAO = "id, codigo, descricao, modelo, categoria, linha_id, linha_nome, familia, categoria_peca_id, categoria_peca_nome, status, ativo, deleted_at, preco_brl, preco_painel_220, preco_painel_380, ipi_pct, foto_url, solicitar_engenharia, potencia_motor, atualizado_em, sem_foto, sem_preco, ficha_total, ficha_preenchidos, sem_vinculo";
const COLUNAS_TABELA = "id, codigo, descricao, modelo, categoria, linha_id, categoria_peca_id, status, ativo, deleted_at, preco_brl, preco_painel_220, preco_painel_380, ipi_pct, foto_url, solicitar_engenharia, potencia_motor, atualizado_em";

function paraLista(r: any): ProdutoLista {
  const tipo = r.categoria === "maquina" ? "maquina" : "peca";
  const foto = r.foto_url ?? null;
  return {
    id: r.id, codigo: r.codigo, descricao: r.descricao ?? "", modelo: r.modelo ?? null, tipo,
    linha_id: r.linha_id ?? null, linha_nome: r.linha_nome ?? null, familia: r.familia ?? null,
    categoria_peca_id: r.categoria_peca_id ?? null, categoria_peca_nome: r.categoria_peca_nome ?? null,
    situacao: situacaoDoProduto({ status: r.status, ativo: r.ativo, deleted_at: r.deleted_at }),
    preco_brl: num(r.preco_brl), preco_painel_220: num(r.preco_painel_220), preco_painel_380: num(r.preco_painel_380),
    ipi_pct: num(r.ipi_pct), foto_url: foto, solicitar_engenharia: Boolean(r.solicitar_engenharia),
    potencia_motor: r.potencia_motor ?? null, atualizado_em: r.atualizado_em ?? null,
    pendencias: r.sem_foto === undefined ? [] : listarPendencias({
      categoria: r.categoria, sem_foto: r.sem_foto, sem_preco: r.sem_preco, ficha_total: num(r.ficha_total),
      ficha_preenchidos: num(r.ficha_preenchidos), sem_vinculo: r.sem_vinculo,
    }),
  };
}

export async function listarProdutos(supabase: any, f: FiltrosProdutos): Promise<RespostaListaProdutos> {
  const consulta = (fonte: "produtos_resumo" | "produtos") => {
    const visao = fonte === "produtos_resumo";
    let q = supabase.from(fonte).select(visao ? COLUNAS_VISAO : COLUNAS_TABELA, { count: "exact" }).is("deleted_at", null);
    q = f.aba === "maquinas" ? q.eq("categoria", "maquina").not("linha_id", "is", null) : q.not("categoria_peca_id", "is", null);
    if (f.escopo) q = f.aba === "maquinas" ? q.eq("linha_id", f.escopo) : q.eq("categoria_peca_id", f.escopo);
    if (f.situacao === "ativos") q = q.eq("status", "ativo").neq("ativo", false);
    else if (f.situacao === "descontinuados") q = q.eq("status", "descontinuado");
    if (visao) {
      if (f.pendencia) q = q.eq(f.pendencia, true);
      // Cada palavra precisa aparecer em algum campo (código, nome, modelo, linha ou categoria).
      for (const palavra of f.q.split(" ").filter(Boolean)) {
        q = q.or(`codigo.ilike.%${palavra}%,descricao.ilike.%${palavra}%,modelo.ilike.%${palavra}%,linha_nome.ilike.%${palavra}%,categoria_peca_nome.ilike.%${palavra}%`);
      }
    } else {
      for (const palavra of f.q.split(" ").filter(Boolean)) q = q.or(`codigo.ilike.%${palavra}%,descricao.ilike.%${palavra}%,modelo.ilike.%${palavra}%`);
    }
    const asc = f.dir === "asc";
    if (f.ordem === "nome") q = q.order("descricao", { ascending: asc });
    else if (f.ordem === "preco") q = q.order("preco_brl", { ascending: asc, nullsFirst: false });
    else if (f.ordem === "atualizado") q = q.order("atualizado_em", { ascending: asc, nullsFirst: false });
    else if (f.ordem === "codigo") q = q.order("codigo", { ascending: asc });
    else if (visao && !f.escopo) {
      // Padrão: ordem configurada das famílias e linhas (ou das categorias), depois o código.
      q = f.aba === "maquinas"
        ? q.order("familia_ordem", { ascending: true, nullsFirst: false }).order("linha_ordem" as never, { ascending: true }).order("codigo", { ascending: true })
        : q.order("categoria_peca_ordem" as never, { ascending: true }).order("codigo", { ascending: true });
    } else q = q.order("codigo", { ascending: asc });
    const de = (f.pagina - 1) * TAMANHO_PAGINA_PRODUTOS;
    return q.order("id", { ascending: true }).range(de, de + TAMANHO_PAGINA_PRODUTOS - 1);
  };

  let usouVisao = true;
  let r = await consulta("produtos_resumo");
  if (r.error && /PGRST205|42P01|does not exist|schema cache|linha_ordem|categoria_peca_ordem/i.test(`${r.error.code ?? ""} ${r.error.message ?? ""}`)) {
    usouVisao = false;
    r = await consulta("produtos");
  }
  if (r.error) {
    if (r.error.code === "42501") return { ok: false, erro: "Sem permissão para ver os produtos.", tipo: "permissao" };
    return { ok: false, erro: "Não foi possível carregar os produtos. Atualize a página; se continuar, avise o responsável.", tipo: "banco" };
  }
  return { ok: true, itens: (r.data ?? []).map(paraLista), total: r.count ?? 0, pagina: f.pagina, tamanho: TAMANHO_PAGINA_PRODUTOS, pendenciasDisponiveis: usouVisao };
}

// ─── Equipamento ────────────────────────────────────────────────────────────────

const PRAZO_URL_ASSINADA_SEGUNDOS = 60 * 30;

export async function carregarArquivos(supabase: any, produtoId: string, fotoPrincipal: string | null): Promise<ArquivoProduto[]> {
  const { data, error } = await supabase.from("produto_arquivos")
    .select("id, tipo, nome, url, storage_path, bucket, ordem").eq("produto_id", produtoId).order("ordem").order("criado_em");
  if (error) throw error;
  const saida: ArquivoProduto[] = [];
  for (const a of data ?? []) {
    const privado = (a.bucket ?? "produto-arquivos") !== "produto-arquivos";
    let url: string | null = a.url;
    if (privado) {
      const r = a.storage_path ? await supabase.storage.from(a.bucket).createSignedUrl(a.storage_path, PRAZO_URL_ASSINADA_SEGUNDOS) : null;
      url = r?.data?.signedUrl ?? null; // sem permissão ou falha: o link não é exibido (nunca cai no endereço público)
    }
    saida.push({
      id: a.id, tipo: a.tipo, nome: a.nome, url, privado, compartilhado: !a.storage_path, ordem: a.ordem ?? 0,
      principal: a.tipo === "imagem" && !!fotoPrincipal && a.url === fotoPrincipal,
    });
  }
  return saida;
}

export type CarregarEquipamento =
  | { tipo: "ok"; equipamento: EquipamentoDetalheDados; linha: { id: string; nome: string } }
  | { tipo: "outra_linha"; linhaCorreta: string }
  | { tipo: "inexistente" };

export async function carregarEquipamento(supabase: any, linhaId: string, eqId: string): Promise<CarregarEquipamento> {
  const { data: p, error } = await supabase.from("produtos")
    .select("id, codigo, descricao, descricao_painel, potencia_motor, ncm, preco_brl, preco_painel_220, preco_painel_380, solicitar_engenharia, specs, foto_url, status, ativo, deleted_at, atualizado_em, categoria, linha_id")
    .eq("id", eqId).maybeSingle();
  if (error) throw error;
  if (!p || p.deleted_at || p.categoria !== "maquina" || !p.linha_id) return { tipo: "inexistente" };
  if (p.linha_id !== linhaId) return { tipo: "outra_linha", linhaCorreta: p.linha_id };
  const { data: linha } = await supabase.from("linhas").select("id, nome").eq("id", linhaId).maybeSingle();
  if (!linha) return { tipo: "inexistente" };
  return {
    tipo: "ok", linha,
    equipamento: {
      id: p.id, codigo: p.codigo, descricao: p.descricao ?? "", descricao_painel: p.descricao_painel ?? null, potencia_motor: p.potencia_motor ?? null,
      ncm: p.ncm ?? null, preco_brl: num(p.preco_brl), preco_painel_220: num(p.preco_painel_220), preco_painel_380: num(p.preco_painel_380),
      solicitar_engenharia: Boolean(p.solicitar_engenharia), specs: p.specs && typeof p.specs === "object" ? p.specs : {},
      foto_url: p.foto_url ?? null, situacao: situacaoDoProduto(p), versao: p.atualizado_em ?? null, atualizado_em: p.atualizado_em ?? null,
    },
  };
}

/** Contagem de peças vinculadas por categoria (sem carregar as peças). */
export async function contarVinculosPorCategoria(supabase: any, eqId: string): Promise<Record<string, number>> {
  const dados = await buscarTodos((de, ate) => supabase.from("compatibilidades_equip")
    .select("id, peca:peca_id(categoria_peca_id, deleted_at)").eq("equipamento_id", eqId).order("id").range(de, ate));
  const mapa: Record<string, number> = {};
  for (const v of dados as any[]) {
    if (!v.peca?.categoria_peca_id || v.peca.deleted_at) continue;
    mapa[v.peca.categoria_peca_id] = (mapa[v.peca.categoria_peca_id] ?? 0) + 1;
  }
  return mapa;
}

export async function listarVinculosDaCategoria(supabase: any, eqId: string, categoriaId: string): Promise<VinculoPeca[]> {
  const dados = await buscarTodos((de, ate) => supabase.from("compatibilidades_equip")
    .select("id, quantidade, peca:peca_id(id, codigo, descricao, preco_brl, ipi_pct, categoria_peca_id, furo_diametro, observacao, atualizado_em, status, ativo, deleted_at)")
    .eq("equipamento_id", eqId).order("id").range(de, ate));
  const doGrupo = (dados as any[]).filter((v) => v.peca && !v.peca.deleted_at && v.peca.categoria_peca_id === categoriaId);
  const ids = doGrupo.map((v) => v.peca.id as string);
  const usando = new Map<string, number>();
  if (ids.length) {
    const { data } = await supabase.from("compatibilidades_equip").select("peca_id").in("peca_id", ids).limit(10000);
    for (const r of data ?? []) usando.set(r.peca_id, (usando.get(r.peca_id) ?? 0) + 1);
  }
  return doGrupo
    .map((v): VinculoPeca => ({
      id: v.id, quantidade: v.quantidade ?? 1,
      peca: {
        id: v.peca.id, codigo: v.peca.codigo, descricao: v.peca.descricao ?? "", preco_brl: num(v.peca.preco_brl), ipi_pct: num(v.peca.ipi_pct) ?? 0,
        categoria_peca_id: v.peca.categoria_peca_id, furo_diametro: v.peca.furo_diametro ?? null, observacao: v.peca.observacao ?? null,
        versao: v.peca.atualizado_em ?? null, situacao: situacaoDoProduto(v.peca), equipamentos_usando: usando.get(v.peca.id) ?? 1,
      },
    }))
    .sort((a, b) => a.peca.codigo.localeCompare(b.peca.codigo, "pt-BR", { numeric: true }));
}

/** Busca no servidor (nada de carregar o catálogo de peças inteiro): peças ainda não vinculadas ao equipamento. */
export async function buscarPecasDisponiveis(supabase: any, eqId: string, termo: string, categoriaId: string | null): Promise<PecaBusca[]> {
  const jaVinculadas = await buscarTodos((de, ate) => supabase.from("compatibilidades_equip").select("id, peca_id").eq("equipamento_id", eqId).order("id").range(de, ate));
  const excluir = new Set((jaVinculadas as any[]).map((v) => v.peca_id as string));
  let q = supabase.from("produtos").select("id, codigo, descricao, preco_brl, ipi_pct, categoria_peca_id, categoria_peca:categorias_peca(nome)")
    .is("deleted_at", null).eq("status", "ativo").not("categoria_peca_id", "is", null);
  if (categoriaId) q = q.eq("categoria_peca_id", categoriaId);
  for (const palavra of sanitizarBusca(termo).split(" ").filter(Boolean)) q = q.or(`codigo.ilike.%${palavra}%,descricao.ilike.%${palavra}%`);
  const { data, error } = await q.order("codigo").limit(60);
  if (error) throw error;
  return (data ?? []).filter((p: any) => !excluir.has(p.id)).slice(0, 30).map((p: any): PecaBusca => ({
    id: p.id, codigo: p.codigo, descricao: p.descricao ?? "", preco_brl: num(p.preco_brl), ipi_pct: num(p.ipi_pct) ?? 0,
    categoria_peca_id: p.categoria_peca_id, categoria_peca_nome: p.categoria_peca?.nome ?? null,
  }));
}

export async function carregarPeca(supabase: any, id: string): Promise<PecaDetalhe | null> {
  const { data: p, error } = await supabase.from("produtos")
    .select("id, codigo, descricao, preco_brl, ipi_pct, ncm, furo_diametro, observacao, categoria_peca_id, status, ativo, deleted_at, atualizado_em, categoria_peca:categorias_peca(nome)")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  if (!p || p.deleted_at || !p.categoria_peca_id) return null;
  const { data: vs } = await supabase.from("compatibilidades_equip")
    .select("id, quantidade, equipamento:equipamento_id(id, codigo, linha_id, deleted_at, linha:linhas(nome))").eq("peca_id", id).limit(500);
  return {
    id: p.id, codigo: p.codigo, descricao: p.descricao ?? "", preco_brl: num(p.preco_brl), ipi_pct: num(p.ipi_pct) ?? 0, ncm: p.ncm ?? null,
    furo_diametro: p.furo_diametro ?? null, observacao: p.observacao ?? null, categoria_peca_id: p.categoria_peca_id,
    categoria_peca_nome: p.categoria_peca?.nome ?? null, situacao: situacaoDoProduto(p), versao: p.atualizado_em ?? null,
    equipamentos: (vs ?? []).filter((v: any) => v.equipamento && !v.equipamento.deleted_at).map((v: any) => ({
      vinculo_id: v.id, equipamento_id: v.equipamento.id, codigo: v.equipamento.codigo, linha_id: v.equipamento.linha_id ?? null,
      linha_nome: v.equipamento.linha?.nome ?? null, quantidade: v.quantidade ?? 1,
    })).sort((a: any, b: any) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })),
  };
}

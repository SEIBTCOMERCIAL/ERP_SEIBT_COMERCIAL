// Consultas e gravação do reajuste (somente servidor). Usa sempre o cliente com a sessão do usuário:
// as regras de acesso do banco continuam valendo (nada de credencial administrativa aqui).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buscarTodos } from "@/lib/supabase/buscar-todos";
import { emPartes } from "@/lib/propostas/alertas";
import {
  COMPONENTES, MOTIVO_IGNORADO_TEXTO, componentesDoTipo, ehComponente, hojeSaoPaulo, parseMoeda, parsePercentual,
  periodoDoAno, planejarReajuste, situacaoDoItem, validarMotivo,
  type ComponenteId, type EntradaReajuste, type ItemIgnorado, type PrecosDoItem, type ProdutoParaReajuste,
  type RegistroHistoricoMin, type SituacaoItem, type TipoProduto,
} from "./regras";
import type {
  EntradaConfirmacao, IgnoradoTexto, ItemLista, LinhaHistorico, PedidoConfirmacao, PedidoLista, PedidoPrevia,
  RespostaConfirmacao, RespostaHistorico, RespostaLista, RespostaPrevia, ResumoEscopo, ResumoReajuste, UltimoReajuste,
} from "./tipos";

export const TAMANHO_PAGINA = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const tipoDe = (categoria: string): TipoProduto => (categoria === "maquina" ? "maquina" : "peca");
const numeroOuNulo = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Administrador ativo (a mesma regra que o banco usa em get_my_perfil). */
export async function exigirAdmin(supabase: any): Promise<{ id: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("usuarios").select("perfil, ativo, deleted_at").eq("id", user.id).single();
  if (!data || data.perfil !== "admin" || data.ativo === false || data.deleted_at) return null;
  return { id: user.id as string };
}

// ─── Resumo (indicadores) ───────────────────────────────────────────────────────

function agruparHistorico(linhas: Array<{ produto_id: string; componente: string | null; data_reajuste: string; preco_anterior_brl?: number | string | null }>) {
  const mapa = new Map<string, RegistroHistoricoMin[]>();
  for (const h of linhas) {
    const lista = mapa.get(h.produto_id) ?? [];
    lista.push({ componente: h.componente, data_reajuste: h.data_reajuste, preco_anterior_brl: h.preco_anterior_brl === undefined ? undefined : numeroOuNulo(h.preco_anterior_brl) });
    mapa.set(h.produto_id, lista);
  }
  return mapa;
}

function novoResumo(id: string, nome: string): ResumoEscopo {
  return { id, nome, total: 0, sem_reajuste: 0, parcial: 0, atualizado: 0, sem_preco: 0, inativos: 0 };
}

/** Indicadores por linha/categoria, calculados no servidor em páginas (sem limite de 1.000 linhas). */
export async function carregarResumo(supabase: any): Promise<ResumoReajuste> {
  const hoje = hojeSaoPaulo();
  const periodo = periodoDoAno(hoje);

  const [linhas, categorias, maquinas, pecas, historico] = await Promise.all([
    supabase.from("linhas").select("id, nome, ordem").order("ordem"),
    supabase.from("categorias_peca").select("id, nome, ordem").order("ordem"),
    buscarTodos((de, ate) => supabase.from("produtos")
      .select("id, linha_id, preco_brl, preco_painel_220, preco_painel_380, ativo")
      .eq("categoria", "maquina").is("deleted_at", null).not("linha_id", "is", null).order("id").range(de, ate)),
    buscarTodos((de, ate) => supabase.from("produtos")
      .select("id, categoria_peca_id, preco_brl, ativo")
      .not("categoria_peca_id", "is", null).is("deleted_at", null).order("id").range(de, ate)),
    buscarTodos((de, ate) => supabase.from("historico_precos")
      .select("id, produto_id, componente, data_reajuste, preco_anterior_brl")
      .not("produto_id", "is", null).gte("data_reajuste", periodo.inicio).lte("data_reajuste", periodo.fim).order("id").range(de, ate)),
  ]);
  if (linhas.error) throw linhas.error;
  if (categorias.error) throw categorias.error;

  const hist = agruparHistorico(historico as any[]);
  const resumoMaq = new Map<string, ResumoEscopo>((linhas.data ?? []).map((l: any) => [l.id, novoResumo(l.id, l.nome)]));
  const resumoPec = new Map<string, ResumoEscopo>((categorias.data ?? []).map((c: any) => [c.id, novoResumo(c.id, c.nome)]));

  const contar = (r: ResumoEscopo | undefined, item: PrecosDoItem & { ativo: boolean }, id: string) => {
    if (!r) return;
    r.total++;
    if (!item.ativo) { r.inativos++; return; }
    r[situacaoDoItem(item, hist.get(id) ?? [], periodo).situacao]++;
  };
  for (const m of maquinas as any[]) {
    contar(resumoMaq.get(m.linha_id), {
      tipo: "maquina", ativo: m.ativo !== false, preco_brl: numeroOuNulo(m.preco_brl),
      preco_painel_220: numeroOuNulo(m.preco_painel_220), preco_painel_380: numeroOuNulo(m.preco_painel_380),
    }, m.id);
  }
  for (const p of pecas as any[]) {
    contar(resumoPec.get(p.categoria_peca_id), {
      tipo: "peca", ativo: p.ativo !== false, preco_brl: numeroOuNulo(p.preco_brl), preco_painel_220: null, preco_painel_380: null,
    }, p.id);
  }
  return { maquinas: Array.from(resumoMaq.values()), pecas: Array.from(resumoPec.values()), hoje, inicio: periodo.inicio };
}

// ─── Listagem paginada ──────────────────────────────────────────────────────────

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CAMPOS_ITEM = "id, codigo, descricao, modelo, categoria, linha_id, categoria_peca_id, preco_brl, preco_painel_220, preco_painel_380, ipi_pct, ativo, solicitar_engenharia";

async function historicoDoPeriodo(supabase: any, ids: string[], inicio: string, fim: string) {
  const linhas: any[] = [];
  for (const parte of emPartes(ids, 100)) {
    const dados = await buscarTodos((de, ate) => supabase.from("historico_precos")
      .select("id, produto_id, componente, data_reajuste, preco_anterior_brl")
      .in("produto_id", parte).gte("data_reajuste", inicio).lte("data_reajuste", fim).order("id").range(de, ate));
    linhas.push(...dados);
  }
  return agruparHistorico(linhas);
}

async function ultimosReajustes(supabase: any, ids: string[]) {
  const mapa = new Map<string, UltimoReajuste>();
  for (const parte of emPartes(ids, 100)) {
    // Percorre todas as páginas (o banco limita cada consulta a 1.000 linhas) do mais recente ao mais antigo.
    const dados = await buscarTodos((de, ate) => supabase.from("historico_precos")
      .select("id, produto_id, componente, percentual_reajuste, data_reajuste, preco_anterior_brl")
      .in("produto_id", parte).order("data_reajuste", { ascending: false }).order("id", { ascending: false }).range(de, ate));
    for (const h of dados as any[]) {
      if (h.preco_anterior_brl === null) continue; // preço inicial não é reajuste
      if (!mapa.has(h.produto_id)) mapa.set(h.produto_id, { data: h.data_reajuste, percentual: numeroOuNulo(h.percentual_reajuste), componente: h.componente ?? null });
    }
  }
  return mapa;
}

export async function listarItens(supabase: any, pedido: PedidoLista): Promise<RespostaLista> {
  const hoje = hojeSaoPaulo();
  const periodo = periodoDoAno(hoje);
  const busca = normalizar(pedido.busca.trim());

  let brutos: any[];
  let nomesEscopo = new Map<string, string>();
  if (pedido.escopoId) {
    if (!ehUuid(pedido.escopoId)) return { ok: false, erro: "Seleção inválida." };
    brutos = await buscarTodos((de, ate) => {
      let q = supabase.from("produtos").select(CAMPOS_ITEM).is("deleted_at", null);
      q = pedido.aba === "maquinas" ? q.eq("categoria", "maquina").eq("linha_id", pedido.escopoId) : q.eq("categoria_peca_id", pedido.escopoId);
      return q.order("codigo").order("id").range(de, ate);
    });
  } else if (busca.length >= 2) {
    // Busca que atravessa linhas/categorias: limitada às 300 primeiras correspondências do banco.
    const termo = pedido.busca.trim().replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ");
    let q = supabase.from("produtos").select(CAMPOS_ITEM).is("deleted_at", null);
    q = pedido.aba === "maquinas" ? q.eq("categoria", "maquina").not("linha_id", "is", null) : q.not("categoria_peca_id", "is", null);
    const { data, error } = await q.or(`codigo.ilike.%${termo}%,descricao.ilike.%${termo}%,modelo.ilike.%${termo}%`).order("codigo").limit(300);
    if (error) return { ok: false, erro: "Não foi possível buscar. Tente novamente." };
    brutos = data ?? [];
    const tabela = pedido.aba === "maquinas" ? "linhas" : "categorias_peca";
    const { data: nomes } = await supabase.from(tabela).select("id, nome");
    nomesEscopo = new Map((nomes ?? []).map((n: any) => [n.id, n.nome]));
  } else {
    return { ok: true, itens: [], total: 0, pagina: 1, tamanho: TAMANHO_PAGINA, todosIds: [] };
  }

  const hist = await historicoDoPeriodo(supabase, brutos.map((b) => b.id), periodo.inicio, periodo.fim);

  const avaliados = brutos.map((b) => {
    const tipo = tipoDe(b.categoria);
    const precos: PrecosDoItem = {
      tipo, preco_brl: numeroOuNulo(b.preco_brl),
      preco_painel_220: tipo === "maquina" ? numeroOuNulo(b.preco_painel_220) : null,
      preco_painel_380: tipo === "maquina" ? numeroOuNulo(b.preco_painel_380) : null,
    };
    const s = situacaoDoItem(precos, hist.get(b.id) ?? [], periodo);
    const situacao: SituacaoItem = b.ativo === false ? "inativo" : s.situacao;
    return { b, tipo, precos, situacao, s };
  }).filter((x) => {
    if (pedido.situacao !== "todas" && x.situacao !== pedido.situacao) return false;
    if (!busca) return true;
    return normalizar(`${x.b.codigo ?? ""} ${x.b.descricao ?? ""} ${x.b.modelo ?? ""}`).includes(busca);
  });

  const total = avaliados.length;
  const pagina = Math.max(1, Math.min(Math.floor(pedido.pagina) || 1, Math.max(1, Math.ceil(total / TAMANHO_PAGINA))));
  const recorte = avaliados.slice((pagina - 1) * TAMANHO_PAGINA, pagina * TAMANHO_PAGINA);
  const ultimos = await ultimosReajustes(supabase, recorte.map((x) => x.b.id));

  const itens: ItemLista[] = recorte.map(({ b, tipo, precos, situacao, s }) => ({
    id: b.id, codigo: b.codigo, descricao: b.descricao ?? "", modelo: b.modelo ?? null, tipo, ativo: b.ativo !== false,
    solicitar_engenharia: Boolean(b.solicitar_engenharia), ipi_pct: numeroOuNulo(b.ipi_pct),
    precos: tipo === "maquina"
      ? { moinho: precos.preco_brl, painel_220: precos.preco_painel_220, painel_380: precos.preco_painel_380 }
      : { peca: precos.preco_brl },
    situacao, reajustados: s.reajustados, pendentes: s.pendentes, ultimo: ultimos.get(b.id) ?? null,
    escopo_nome: nomesEscopo.get(pedido.aba === "maquinas" ? b.linha_id : b.categoria_peca_id) ?? null,
  }));
  return { ok: true, itens, total, pagina, tamanho: TAMANHO_PAGINA, todosIds: avaliados.filter((x) => x.situacao !== "inativo").map((x) => x.b.id) };
}

// ─── Prévia e gravação ──────────────────────────────────────────────────────────

export async function carregarProdutosParaPlano(supabase: any, ids: string[]): Promise<Map<string, ProdutoParaReajuste>> {
  const mapa = new Map<string, ProdutoParaReajuste>();
  for (const parte of emPartes(Array.from(new Set(ids)), 100)) {
    const { data, error } = await supabase.from("produtos")
      .select("id, codigo, descricao, categoria, preco_brl, preco_painel_220, preco_painel_380, ativo, deleted_at").in("id", parte);
    if (error) throw error;
    for (const p of data ?? []) {
      const tipo = tipoDe(p.categoria);
      mapa.set(p.id, {
        id: p.id, codigo: p.codigo, descricao: p.descricao ?? "", tipo, ativo: p.ativo !== false, excluido: Boolean(p.deleted_at),
        preco_brl: numeroOuNulo(p.preco_brl),
        preco_painel_220: tipo === "maquina" ? numeroOuNulo(p.preco_painel_220) : null,
        preco_painel_380: tipo === "maquina" ? numeroOuNulo(p.preco_painel_380) : null,
      });
    }
  }
  return mapa;
}

const comTexto = (i: ItemIgnorado): IgnoradoTexto => ({ ...i, texto: MOTIVO_IGNORADO_TEXTO[i.motivo] });

async function idsDoEscopo(supabase: any, pedido: PedidoPrevia): Promise<{ ids: string[]; descricao: string } | { erro: string }> {
  const e = pedido.escopo;
  if (e.tipo === "itens") {
    if (!Array.isArray(e.ids) || e.ids.length === 0) return { erro: "Selecione ao menos um item." };
    if (e.ids.length > 5000 || !e.ids.every(ehUuid)) return { erro: "Seleção inválida." };
    return { ids: Array.from(new Set(e.ids)), descricao: e.ids.length === 1 ? "1 item selecionado" : `${e.ids.length} itens selecionados` };
  }
  if (!ehUuid(e.id)) return { erro: "Seleção inválida." };
  const maquinas = e.tipo === "linha";
  const { data: escopo } = await supabase.from(maquinas ? "linhas" : "categorias_peca").select("nome").eq("id", e.id).single();
  const ids = (await buscarTodos((de, ate) => {
    let q = supabase.from("produtos").select("id").is("deleted_at", null);
    q = maquinas ? q.eq("categoria", "maquina").eq("linha_id", e.id) : q.eq("categoria_peca_id", e.id);
    return q.order("id").range(de, ate);
  })).map((r: any) => r.id as string);
  if (ids.length === 0) return { erro: "Nenhum item encontrado nesta seleção." };
  return { ids, descricao: `${maquinas ? "Linha" : "Categoria"} inteira: ${escopo?.nome ?? ""} (${ids.length} itens)` };
}

export async function gerarPrevia(supabase: any, pedido: PedidoPrevia): Promise<RespostaPrevia> {
  if (!Array.isArray(pedido.componentes) || pedido.componentes.length === 0 || !pedido.componentes.every(ehComponente)) {
    return { ok: false, erro: "Selecione ao menos um componente." };
  }
  if (pedido.modo === "valor" && !(pedido.escopo.tipo === "itens" && pedido.escopo.ids.length === 1)) {
    return { ok: false, erro: "O novo valor só pode ser informado para um item por vez." };
  }

  const escopo = await idsDoEscopo(supabase, pedido);
  if ("erro" in escopo) return { ok: false, erro: escopo.erro };

  const percentuais: Partial<Record<ComponenteId, number>> = {};
  const valores: Partial<Record<ComponenteId, number>> = {};
  for (const c of pedido.componentes) {
    const rotulo = COMPONENTES[c].rotulo;
    if (pedido.modo === "percentual") {
      const r = parsePercentual(pedido.percentuais?.[c]);
      if (r.erro !== undefined) return { ok: false, erro: `${rotulo}: ${r.erro}` };
      percentuais[c] = r.valor;
    } else {
      const r = parseMoeda(pedido.valores?.[c]);
      if (r.erro !== undefined) return { ok: false, erro: `${rotulo}: ${r.erro}` };
      valores[c] = r.valor;
    }
  }

  const produtos = await carregarProdutosParaPlano(supabase, escopo.ids);
  const entradas: EntradaReajuste[] = [];
  for (const id of escopo.ids) {
    const p = produtos.get(id);
    const validos = p ? componentesDoTipo(p.tipo) : [];
    for (const c of pedido.componentes) {
      if (p && !validos.includes(c)) continue; // componente que não existe para este tipo de produto
      entradas.push(pedido.modo === "percentual"
        ? { produto_id: id, componente: c, percentual: percentuais[c] }
        : { produto_id: id, componente: c, novo: valores[c] });
    }
  }
  const plano = planejarReajuste(produtos, entradas);
  if (plano.erros.length > 0) return { ok: false, erro: plano.erros[0] };

  return {
    ok: true,
    itens: plano.itens,
    ignorados: plano.ignorados.map(comTexto),
    entradas: plano.itens.map((i) => ({ produto_id: i.produto_id, componente: i.componente, esperado: i.atual, novo: i.novo })),
    produtos: new Set(plano.itens.map((i) => i.produto_id)).size,
    componentes: plano.itens.length,
    hoje: hojeSaoPaulo(),
    escopoDescricao: escopo.descricao,
  };
}

function traduzirErroBanco(mensagem: string): RespostaConfirmacao {
  const m = mensagem ?? "";
  if (m.includes("PRECO_ALTERADO")) {
    const codigo = m.split("PRECO_ALTERADO:")[1]?.trim().split(/\s/)[0];
    return { ok: false, tipo: "conflito", erro: `O preço de ${codigo || "um item"} mudou depois da prévia. Nada foi gravado. Gere uma nova prévia e confira novamente.` };
  }
  if (m.includes("NENHUMA_ALTERACAO")) return { ok: false, tipo: "sem_alteracao", erro: "Nenhum preço seria alterado. Nada foi gravado." };
  if (m.includes("SEM_PERMISSAO")) return { ok: false, tipo: "permissao", erro: "Acesso restrito a administradores." };
  if (m.includes("MOTIVO_INVALIDO")) return { ok: false, tipo: "validacao", erro: "Informe o motivo do reajuste (de 3 a 200 caracteres)." };
  if (m.includes("COMPONENTE_INVALIDO") || m.includes("PRECO_INVALIDO") || m.includes("CHAVE_INVALIDA")) {
    return { ok: false, tipo: "validacao", erro: "Os dados do reajuste são inválidos. Nada foi gravado. Gere uma nova prévia." };
  }
  if (/aplicar_reajuste|PGRST202|schema cache|does not exist/i.test(m)) {
    return { ok: false, tipo: "nao_aplicado", erro: "A atualização do banco de dados para reajustes (arquivo 033) ainda não foi aplicada. Peça ao responsável para aplicá-la." };
  }
  return { ok: false, tipo: "banco", erro: "Não foi possível gravar o reajuste. Nada foi alterado. Tente novamente." };
}

export async function gravarReajuste(supabase: any, pedido: PedidoConfirmacao): Promise<RespostaConfirmacao> {
  if (!ehUuid(pedido.chave)) return { ok: false, tipo: "validacao", erro: "Solicitação inválida. Gere uma nova prévia." };
  const motivo = validarMotivo(pedido.motivo);
  if (motivo.erro !== undefined) return { ok: false, tipo: "validacao", erro: motivo.erro };
  const entradas = pedido.entradas;
  if (!Array.isArray(entradas) || entradas.length === 0) return { ok: false, tipo: "sem_alteracao", erro: "Nenhum preço seria alterado." };
  if (entradas.length > 5000) return { ok: false, tipo: "validacao", erro: "Operação grande demais. Reduza a seleção." };
  if (!entradas.every((e) => ehUuid(e.produto_id) && ehComponente(e.componente) && Number.isFinite(e.esperado) && Number.isFinite(e.novo))) {
    return { ok: false, tipo: "validacao", erro: "Os dados do reajuste são inválidos. Gere uma nova prévia." };
  }

  const produtos = await carregarProdutosParaPlano(supabase, entradas.map((e) => e.produto_id));
  const plano = planejarReajuste(produtos, entradas.map((e: EntradaConfirmacao) => ({ produto_id: e.produto_id, componente: e.componente, esperado: e.esperado, novo: e.novo })));
  if (plano.conflitos.length > 0) {
    const c = plano.conflitos[0];
    return { ok: false, tipo: "conflito", erro: `O preço de ${c.codigo} mudou depois da prévia (${plano.conflitos.length} ${plano.conflitos.length === 1 ? "item" : "itens"}). Nada foi gravado. Gere uma nova prévia e confira novamente.` };
  }
  if (plano.erros.length > 0) return { ok: false, tipo: "validacao", erro: plano.erros[0] };
  if (plano.itens.length === 0) return { ok: false, tipo: "sem_alteracao", erro: "Nenhum preço seria alterado. Nada foi gravado." };

  const { data, error } = await supabase.rpc("aplicar_reajuste", {
    p_itens: plano.itens.map((i) => ({ produto_id: i.produto_id, componente: i.componente, preco_esperado: i.atual, preco_novo: i.novo })),
    p_motivo: motivo.valor,
    p_chave: pedido.chave,
  });
  if (error) return traduzirErroBanco(error.message ?? "");

  const resumo = data as { produtos: number; componentes: number; ignorados?: any[]; repetido?: boolean; data?: string };
  const ignoradosBanco: IgnoradoTexto[] = (resumo.ignorados ?? []).map((i: any) => ({
    produto_id: i.produto_id, codigo: i.codigo ?? null, descricao: null, componente: i.componente, motivo: i.motivo,
    texto: MOTIVO_IGNORADO_TEXTO[i.motivo as keyof typeof MOTIVO_IGNORADO_TEXTO] ?? String(i.motivo),
  }));
  return {
    ok: true, produtos: resumo.produtos, componentes: resumo.componentes, repetido: Boolean(resumo.repetido),
    ignorados: [...plano.ignorados.map(comTexto), ...ignoradosBanco], data: resumo.data ?? hojeSaoPaulo(),
  };
}

// ─── Histórico por item ─────────────────────────────────────────────────────────

const TAMANHO_HISTORICO = 15;

export async function carregarHistorico(
  supabase: any, produtoId: string, componente: ComponenteId, pagina: number
): Promise<RespostaHistorico> {
  if (!ehUuid(produtoId)) return { ok: false, erro: "Item inválido." };
  const { data: prod } = await supabase.from("produtos").select("categoria").eq("id", produtoId).single();
  if (!prod) return { ok: false, erro: "Item não encontrado." };
  const tipo = tipoDe(prod.categoria);
  if (!componentesDoTipo(tipo).includes(componente)) return { ok: false, erro: "Componente inválido." };

  // Registros antigos sem componente valem para a máquina (moinho) ou para o preço da peça.
  const semComponente = componente === "moinho" || componente === "peca";
  const filtro = (q: any) => (semComponente
    ? q.or(`componente.eq.${componente === "peca" ? "peca" : "moinho"},componente.is.null`)
    : q.eq("componente", componente));

  const de = (Math.max(1, Math.floor(pagina) || 1) - 1) * TAMANHO_HISTORICO;
  const campos = "id, data_reajuste, componente, preco_anterior_brl, preco_novo_brl, percentual_reajuste, motivo, reajustado_por";
  const [lista, serie] = await Promise.all([
    filtro(supabase.from("historico_precos").select(campos, { count: "exact" }).eq("produto_id", produtoId))
      .order("data_reajuste", { ascending: false }).order("id", { ascending: false }).range(de, de + TAMANHO_HISTORICO - 1),
    filtro(supabase.from("historico_precos").select("data_reajuste, preco_novo_brl").eq("produto_id", produtoId))
      .not("preco_novo_brl", "is", null).order("data_reajuste", { ascending: false }).order("id", { ascending: false }).limit(24),
  ]);
  if (lista.error) return { ok: false, erro: "Não foi possível carregar o histórico." };

  const ids = Array.from(new Set((lista.data ?? []).map((h: any) => h.reajustado_por).filter(Boolean))) as string[];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: us } = await supabase.from("usuarios").select("id, nome").in("id", ids);
    for (const u of us ?? []) nomes.set(u.id, u.nome);
  }
  const linhas: LinhaHistorico[] = (lista.data ?? []).map((h: any) => ({
    id: h.id, data_reajuste: h.data_reajuste, componente: h.componente ?? null,
    preco_anterior_brl: numeroOuNulo(h.preco_anterior_brl), preco_novo_brl: numeroOuNulo(h.preco_novo_brl),
    percentual_reajuste: numeroOuNulo(h.percentual_reajuste), motivo: h.motivo ?? null, responsavel: nomes.get(h.reajustado_por) ?? null,
  }));
  return {
    ok: true, linhas, total: lista.count ?? linhas.length, pagina: Math.floor(de / TAMANHO_HISTORICO) + 1, tamanho: TAMANHO_HISTORICO,
    serie: (serie.data ?? []).map((s: any) => ({ data: s.data_reajuste as string, preco: Number(s.preco_novo_brl) })).reverse(),
  };
}


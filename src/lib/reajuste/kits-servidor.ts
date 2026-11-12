// Navalhas por kit, peneiras por modelo e edição de IPI (somente servidor). Reutiliza os jogos de navalhas já
// cadastrados (jogos_navalha / jogos_navalha_itens): não existe uma base paralela de kits.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buscarTodos } from "@/lib/supabase/buscar-todos";
import { emPartes } from "@/lib/propostas/alertas";
import { hojeSaoPaulo, periodoDoAno, situacaoDoItem, type PrecosDoItem, type SituacaoItem } from "./regras";
import {
  atributosPeneira, calcularKit, parseIpiNavalha, classificarComponente, compararKits, compararModelos, compararPeneiras, situacaoDoKit,
  ultimoReajusteDoKit,
} from "./kits";
import {
  CAMPOS_ITEM, ehUuid, historicoDoPeriodo, normalizar, numeroOuNulo, tipoDaCategoria, ultimosReajustes,
} from "./servidor";
import type {
  ComponenteKit, GrupoPeneiras, ItemLista, KitLista, PedidoIpi, PedidoKits, RespostaIpi, RespostaKits, RespostaPeneiras,
  ResumoKits, RevisaoNavalha,
} from "./tipos";

export const TAMANHO_PAGINA_KITS = 25;
export const TAMANHO_PAGINA_PENEIRAS = 60;

type Periodo = ReturnType<typeof periodoDoAno>;

function itemDe(b: any, hist: Map<string, any[]>, ultimos: Map<string, any>, periodo: Periodo, escopoNome: string | null): ItemLista {
  const precos: PrecosDoItem = { tipo: "peca", preco_brl: numeroOuNulo(b.preco_brl), preco_painel_220: null, preco_painel_380: null };
  const s = situacaoDoItem(precos, hist.get(b.id) ?? [], periodo);
  const situacao: SituacaoItem = b.ativo === false ? "inativo" : s.situacao;
  return {
    id: b.id, codigo: b.codigo, descricao: b.descricao ?? "", modelo: b.modelo ?? null, tipo: "peca", ativo: b.ativo !== false,
    solicitar_engenharia: Boolean(b.solicitar_engenharia), ipi_pct: numeroOuNulo(b.ipi_pct), precos: { peca: precos.preco_brl },
    situacao, reajustados: s.reajustados, pendentes: s.pendentes, ultimo: ultimos.get(b.id) ?? null, escopo_nome: escopoNome,
  };
}

async function produtosPorId(supabase: any, ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (const parte of emPartes(Array.from(new Set(ids)), 100)) {
    const { data, error } = await supabase.from("produtos").select(CAMPOS_ITEM).in("id", parte).is("deleted_at", null);
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

// ─── Kits de navalhas ───────────────────────────────────────────────────────────────────────

export async function listarKits(supabase: any, pedido: PedidoKits): Promise<RespostaKits> {
  const hoje = hojeSaoPaulo();
  const periodo = periodoDoAno(hoje);
  const busca = normalizar(pedido.busca.trim());

  const jogos = await buscarTodos((de, ate) => supabase.from("jogos_navalha")
    .select(`id, equipamento_id, nome, material, ativo, ordem,
      equipamento:produtos!jogos_navalha_equipamento_id_fkey(id, codigo, deleted_at),
      itens:jogos_navalha_itens(id, titulo, pecas, codigo, ordem, produto_id)`)
    .order("id").range(de, ate));
  const navalhas = await buscarTodos((de, ate) => supabase.from("produtos").select(CAMPOS_ITEM)
    .eq("categoria", "navalha").is("deleted_at", null).order("id").range(de, ate));

  const vivos = (jogos as any[]).filter((j) => j.equipamento && !j.equipamento.deleted_at);
  const idsEmKits = new Set<string>(vivos.flatMap((j) => (j.itens ?? []).map((i: any) => i.produto_id as string)));
  const conhecidos = new Set((navalhas as any[]).map((n) => n.id));
  const extras = await produtosPorId(supabase, Array.from(idsEmKits).filter((id) => !conhecidos.has(id)));
  const todos = [...(navalhas as any[]), ...extras];
  const ids = todos.map((p) => p.id);

  const [hist, ultimos] = await Promise.all([historicoDoPeriodo(supabase, ids, periodo.inicio, periodo.fim), ultimosReajustes(supabase, ids)]);
  const { data: cats } = await supabase.from("categorias_peca").select("id, nome");
  const nomeCategoria = new Map<string, string>((cats ?? []).map((c: any) => [c.id, c.nome]));
  const itens = new Map<string, ItemLista>(todos.map((p) => [p.id, itemDe(p, hist, ultimos, periodo, nomeCategoria.get(p.categoria_peca_id) ?? null)]));
  const brutos = new Map<string, any>(todos.map((p) => [p.id, p]));

  // Rótulos dos kits (para avisar quando uma peça é compartilhada).
  const montarModelo = (j: any) => String(j.equipamento?.codigo ?? "").trim();
  const montarVariante = (j: any) => {
    const partes = [j.nome && j.nome.trim().toLowerCase() !== "padrão" ? j.nome.trim() : null, j.material?.trim() || null].filter(Boolean) as string[];
    return partes.length ? partes.join(" · ") : null;
  };
  const rotulo = (j: any) => { const v = montarVariante(j); return v ? `${montarModelo(j)} · ${v}` : montarModelo(j); };
  const usadoEm = new Map<string, Array<{ kitId: string; rotulo: string }>>();
  for (const j of vivos) {
    for (const pid of Array.from(new Set<string>((j.itens ?? []).map((i: any) => i.produto_id as string)))) {
      const l = usadoEm.get(pid) ?? [];
      l.push({ kitId: j.id, rotulo: rotulo(j) });
      usadoEm.set(pid, l);
    }
  }

  const kits: KitLista[] = [];
  const revisaoMapa = new Map<string, RevisaoNavalha>();
  for (const j of vivos) {
    const linhas = [...((j.itens ?? []) as any[])].sort((a, b) => a.ordem - b.ordem);
    const componentes: ComponenteKit[] = [];
    for (const l of linhas) {
      const item = itens.get(l.produto_id);
      const bruto = brutos.get(l.produto_id);
      if (!item || !bruto) continue; // produto excluído: não entra no kit
      const grupo = classificarComponente(l.titulo, bruto.descricao);
      const precoUnit = item.precos.peca ?? null;
      const ipi = Number(item.ipi_pct ?? 0);
      if (grupo === "outro") {
        revisaoMapa.set(bruto.id, { produtoId: bruto.id, codigo: bruto.codigo, descricao: bruto.descricao ?? "", motivo: "Não foi possível identificar se é navalha fixa ou rotora" });
      }
      componentes.push({
        linhaId: l.id, produtoId: l.produto_id, titulo: l.titulo, codigo: (l.codigo ?? "").trim() || bruto.codigo, codigoProduto: bruto.codigo,
        grupo, pecas: Number(l.pecas), precoUnit, ipi, ativo: item.ativo,
        subtotal: precoUnit === null ? null : Math.round(precoUnit * 100) * Number(l.pecas) / 100,
        item, compartilhadoCom: (usadoEm.get(l.produto_id) ?? []).filter((o) => o.kitId !== j.id),
      });
    }
    const unicos = Array.from(new Map(componentes.map((c) => [c.produtoId, c])).values());
    const calculo = calcularKit(componentes.map((c) => ({ pecas: c.pecas, preco: c.precoUnit, ipi: c.ipi, grupo: c.grupo })));
    kits.push({
      id: j.id, equipamentoId: j.equipamento_id, modelo: montarModelo(j), variante: montarVariante(j), ativo: j.ativo !== false,
      componentes, calculo, pecasUnicas: unicos.length,
      situacao: situacaoDoKit(j.ativo !== false, unicos.map((c) => c.item.situacao)),
      ultimo: ultimoReajusteDoKit(unicos.map((c) => ({ codigo: c.codigoProduto, ultimo: c.item.ultimo }))),
    });
  }

  const texto = (k: KitLista) => normalizar([k.modelo, k.variante ?? "", ...k.componentes.flatMap((c) => [c.titulo, c.codigo, c.codigoProduto, c.item.descricao])].join(" "));
  const porBusca = busca ? kits.filter((k) => texto(k).includes(busca)) : kits;
  const naoNoKit = todos.filter((p) => p.categoria === "navalha" && !idsEmKits.has(p.id)).map((p) => itens.get(p.id)!) as ItemLista[];
  const semKitTodos = (busca ? naoNoKit.filter((i) => normalizar(`${i.codigo} ${i.descricao} ${i.modelo ?? ""}`).includes(busca)) : naoNoKit);

  const resumo: ResumoKits = {
    kits: porBusca.length, pecas: new Set(porBusca.flatMap((k) => k.componentes.map((c) => c.produtoId))).size,
    sem_reajuste: 0, parcial: 0, atualizado: 0, sem_preco: 0, inativos: 0, incompletos: porBusca.filter((k) => !k.calculo.completo).length, sem_kit: semKitTodos.length,
  };
  for (const k of porBusca) { if (k.situacao === "inativo") resumo.inativos++; else resumo[k.situacao]++; }

  const filtrados = (pedido.situacao === "todas" ? porBusca : porBusca.filter((k) => k.situacao === pedido.situacao)).sort(compararKits);
  const total = filtrados.length;
  const pagina = Math.max(1, Math.min(Math.floor(pedido.pagina) || 1, Math.max(1, Math.ceil(total / TAMANHO_PAGINA_KITS))));
  const semKit = (pedido.situacao === "todas" ? semKitTodos : semKitTodos.filter((i) => i.situacao === pedido.situacao))
    .sort((a, b) => compararModelos(a.descricao || a.codigo, b.descricao || b.codigo));

  // Cadastro ambíguo: navalha ligada a categoria de peças que não é a de navalhas (ou o inverso) → só revisão.
  for (const p of todos) {
    const cat = tipoDaCategoria(nomeCategoria.get(p.categoria_peca_id));
    if (p.categoria === "navalha" && p.categoria_peca_id && cat !== "navalha") {
      revisaoMapa.set(p.id, { produtoId: p.id, codigo: p.codigo, descricao: p.descricao ?? "", motivo: `Tipo navalha, mas ligada à categoria "${nomeCategoria.get(p.categoria_peca_id) ?? "?"}"` });
    }
  }

  return {
    ok: true, kits: filtrados.slice((pagina - 1) * TAMANHO_PAGINA_KITS, pagina * TAMANHO_PAGINA_KITS), total, pagina, tamanho: TAMANHO_PAGINA_KITS,
    resumo, semKit, revisao: Array.from(revisaoMapa.values()), hoje,
  };
}

// ─── Peneiras por modelo de equipamento ─────────────────────────────────────────────────────

export async function listarPeneiras(supabase: any, pedido: { busca: string; situacao: string; pagina: number }): Promise<RespostaPeneiras> {
  const hoje = hojeSaoPaulo();
  const periodo = periodoDoAno(hoje);
  const busca = normalizar(pedido.busca.trim());

  const brutos = await buscarTodos((de, ate) => supabase.from("produtos").select(`${CAMPOS_ITEM}, furo_diametro`)
    .eq("categoria", "peneira").is("deleted_at", null).order("id").range(de, ate));
  const ids = (brutos as any[]).map((p) => p.id);
  const vinculos: any[] = [];
  for (const parte of emPartes(ids, 100)) {
    const dados = await buscarTodos((de, ate) => supabase.from("compatibilidades_equip")
      .select("peca_id, equipamento:produtos!compatibilidades_equip_equipamento_id_fkey(id, codigo, deleted_at)")
      .in("peca_id", parte).order("id").range(de, ate));
    vinculos.push(...dados);
  }
  const modelosDe = new Map<string, string[]>();
  for (const v of vinculos) {
    if (!v.equipamento || v.equipamento.deleted_at) continue;
    const l = modelosDe.get(v.peca_id) ?? [];
    const cod = String(v.equipamento.codigo ?? "").trim();
    if (cod && !l.includes(cod)) l.push(cod);
    modelosDe.set(v.peca_id, l);
  }
  const [hist, ultimos] = await Promise.all([historicoDoPeriodo(supabase, ids, periodo.inicio, periodo.fim), ultimosReajustes(supabase, ids)]);

  type Entrada = { modelo: string | null; item: ItemLista; attrs: ReturnType<typeof atributosPeneira> };
  const entradas: Entrada[] = [];
  let semModelo = 0;
  for (const b of brutos as any[]) {
    const attrs = atributosPeneira(b.descricao, b.furo_diametro);
    const item = { ...itemDe(b, hist, ultimos, periodo, null), atributos: attrs.texto || null };
    if (pedido.situacao !== "todas" && item.situacao !== pedido.situacao) continue;
    const modelos = modelosDe.get(b.id) ?? [];
    const alvo = modelos.length ? modelos : [null];
    const texto = normalizar(`${b.codigo} ${b.descricao ?? ""} ${b.furo_diametro ?? ""} ${attrs.texto} ${modelos.join(" ")}`);
    if (busca && !texto.includes(busca)) continue;
    if (modelos.length === 0) semModelo++;
    for (const m of alvo) entradas.push({ modelo: m, item, attrs });
  }
  entradas.sort((a, b) => {
    if (a.modelo === null || b.modelo === null) { if (a.modelo === b.modelo) return compararPeneiras({ attrs: a.attrs, codigo: a.item.codigo, id: a.item.id }, { attrs: b.attrs, codigo: b.item.codigo, id: b.item.id }); return a.modelo === null ? 1 : -1; }
    return compararModelos(a.modelo, b.modelo) || compararPeneiras({ attrs: a.attrs, codigo: a.item.codigo, id: a.item.id }, { attrs: b.attrs, codigo: b.item.codigo, id: b.item.id });
  });

  const total = entradas.length;
  const pagina = Math.max(1, Math.min(Math.floor(pedido.pagina) || 1, Math.max(1, Math.ceil(total / TAMANHO_PAGINA_PENEIRAS))));
  const recorte = entradas.slice((pagina - 1) * TAMANHO_PAGINA_PENEIRAS, pagina * TAMANHO_PAGINA_PENEIRAS);
  const grupos: GrupoPeneiras[] = [];
  for (const e of recorte) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.modelo === e.modelo) ultimo.itens.push(e.item); else grupos.push({ modelo: e.modelo, itens: [e.item] });
  }
  return { ok: true, grupos, total, produtos: new Set(entradas.map((e) => e.item.id)).size, pagina, tamanho: TAMANHO_PAGINA_PENEIRAS, sem_modelo: semModelo };
}

// ─── Edição manual do IPI (somente navalhas) ────────────────────────────────────────────────

export async function definirIpiNavalhas(supabase: any, pedido: PedidoIpi): Promise<RespostaIpi> {
  const ipi = parseIpiNavalha(pedido.ipi);
  if (ipi.erro !== undefined) return { ok: false, tipo: "validacao", erro: ipi.erro };
  const motivo = String(pedido.motivo ?? "").replace(/\s+/g, " ").trim();
  if (motivo.length < 3 || motivo.length > 200) return { ok: false, tipo: "validacao", erro: "Informe o motivo (de 3 a 200 caracteres)." };
  const ids = Array.from(new Set(pedido.produtoIds ?? []));
  if (ids.length === 0 || ids.length > 2000 || !ids.every(ehUuid)) return { ok: false, tipo: "validacao", erro: "Seleção inválida." };

  // Confere no servidor que todos são navalhas (a função do banco confere de novo e cancela tudo se houver outro tipo).
  for (const parte of emPartes(ids, 100)) {
    const { data, error } = await supabase.from("produtos").select("id, codigo, categoria, deleted_at").in("id", parte);
    if (error) return { ok: false, tipo: "banco", erro: "Não foi possível conferir os produtos. Nada foi alterado." };
    const achados = new Map<string, any>((data ?? []).map((p: any) => [p.id, p]));
    for (const id of parte) {
      const p = achados.get(id);
      if (!p || p.deleted_at) return { ok: false, tipo: "validacao", erro: "Um dos produtos não existe mais. Atualize a lista." };
      if (p.categoria !== "navalha") return { ok: false, tipo: "validacao", erro: `${p.codigo} não é uma navalha. O IPI por aqui vale somente para navalhas.` };
    }
  }

  const { data, error } = await supabase.rpc("produto_definir_ipi", { p_produtos: ids, p_ipi: ipi.valor, p_motivo: motivo });
  if (error) {
    const m = String(error.message ?? "");
    if (m.includes("SEM_PERMISSAO")) return { ok: false, tipo: "permissao", erro: "Acesso restrito a administradores." };
    if (m.includes("NAO_NAVALHA")) return { ok: false, tipo: "validacao", erro: "Há um produto que não é navalha. Nada foi alterado." };
    if (/produto_definir_ipi|PGRST202|schema cache|does not exist/i.test(m)) {
      return { ok: false, tipo: "nao_aplicado", erro: "A atualização do banco para o IPI das navalhas (arquivo 035) ainda não foi aplicada. Peça ao responsável para aplicá-la." };
    }
    return { ok: false, tipo: "banco", erro: "Não foi possível gravar o IPI. Nada foi alterado. Tente novamente." };
  }
  const r = data as { produtos: number; alterados: number; sem_mudanca: number };
  return { ok: true, produtos: r.produtos, alterados: r.alterados, semMudanca: r.sem_mudanca };
}

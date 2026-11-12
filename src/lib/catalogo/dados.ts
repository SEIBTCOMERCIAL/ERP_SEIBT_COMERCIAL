import { createClient } from "@/lib/supabase/server";
import { buscarTodos } from "@/lib/supabase/buscar-todos";
import { tamanhoModelo } from "@/lib/produto-titulo";
import { CAMPOS_FORA_DO_CATALOGO, COLUNAS_CATALOGO, montarMaquinaCatalogo } from "./mapear";
import { calcularKit, classificarComponente, compararNatural, compararModelos } from "@/lib/reajuste/kits";
import type { CatalogoLinha, JogoNavalhas, MaquinaCatalogo, PecaCatalogo, SpecCampo } from "./tipos";

export type { SpecCampo, ImagemProduto, MaquinaCatalogo, CatalogoLinha, PecaCatalogo, JogoNavalhas, ModoCatalogo } from "./tipos";
export { paginarMaquinas } from "./tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;


/**
 * Busca única (tela e PDF chamam a mesma função) com os dados de uma linha
 * pronta pra virar página de catálogo: máquinas ativas, preços, specs e fotos
 * já cadastradas. Aceita um client opcional para reaproveitar em contextos
 * que já têm um (ex.: a rota de geração de PDF).
 *
 * Só pode ser chamado a partir de código de servidor (Server Component,
 * Server Action ou rota de API) — nunca de um componente de cliente, porque
 * usa `createClient()` (cookies de login), que só existe no servidor.
 */
export async function carregarCatalogoLinha(
  linhaId: string,
  supabaseClient?: SupabaseAny
): Promise<CatalogoLinha | null> {
  const supabase: SupabaseAny = supabaseClient ?? createClient();

  const [{ data: rawLinha }, rawMaquinas, { data: rawCampos }] = await Promise.all([
    supabase.from("linhas").select("id, nome, ordem, modo_catalogo").eq("id", linhaId).single(),
    buscarTodos((de, ate) => supabase
      .from("produtos")
      .select(COLUNAS_CATALOGO)
      .eq("categoria", "maquina")
      .eq("linha_id", linhaId)
      .eq("status", "ativo")
      .is("deleted_at", null)
      .order("id")
      .range(de, ate)),
    supabase
      .from("linha_spec_campos")
      .select("id, nome, ordem")
      .eq("linha_id", linhaId)
      .order("ordem"),
  ]);

  if (!rawLinha) return null;

  const linha = {
    id: rawLinha.id,
    nome: rawLinha.nome,
    ordem: rawLinha.ordem ?? 0,
    modoCatalogo: (rawLinha.modo_catalogo ?? "completo") as "completo" | "lista",
  };

  // Preços vigentes direto do cadastro (produtos): o catálogo não tem tabela de preços própria.
  const maquinas: MaquinaCatalogo[] = (rawMaquinas ?? [])
    .map((p: SupabaseAny) => montarMaquinaCatalogo(p, linha.nome))
    .sort((a: MaquinaCatalogo, b: MaquinaCatalogo) => {
      const diff = tamanhoModelo(a.nome) - tamanhoModelo(b.nome);
      return diff !== 0 ? diff : a.nome.localeCompare(b.nome);
    });

  const specCampos: SpecCampo[] = ((rawCampos ?? []) as SpecCampo[]).filter(
    (c) => !CAMPOS_FORA_DO_CATALOGO.test(c.nome)
  );

  return { linha, specCampos, maquinas };
}

/**
 * Todas as linhas que têm pelo menos uma máquina ativa, cada uma já com
 * seus dados completos (mesma função de busca de cima) — usado na visão
 * "Catálogo completo", com todas as linhas juntas.
 */
export async function carregarCatalogoCompleto(
  supabaseClient?: SupabaseAny
): Promise<CatalogoLinha[]> {
  const supabase: SupabaseAny = supabaseClient ?? createClient();

  const linhasComMaquina = await buscarTodos((de, ate) => supabase
    .from("produtos")
    .select("id, linha_id")
    .eq("categoria", "maquina")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .not("linha_id", "is", null)
    .order("id")
    .range(de, ate));

  const linhaIdsRaw: string[] = (linhasComMaquina ?? []).map((p: SupabaseAny) => p.linha_id as string);
  const linhaIds = Array.from(new Set(linhaIdsRaw));

  const resultados = await Promise.all(linhaIds.map((id) => carregarCatalogoLinha(id, supabase)));

  return resultados
    .filter((r): r is CatalogoLinha => r !== null && r.maquinas.length > 0)
    .sort((a, b) => a.linha.nome.localeCompare(b.linha.nome));
}

/**
 * Peneiras ativas, pra página de lista de preços de peças (código,
 * descrição, valor unitário, IPI) — sem foto, sem tabela técnica, é uma
 * lista de preços mesmo.
 */
export async function carregarPecasCatalogo(
  supabaseClient?: SupabaseAny
): Promise<{ peneiras: PecaCatalogo[] }> {
  const supabase: SupabaseAny = supabaseClient ?? createClient();

  const rawPeneiras = await buscarTodos((de, ate) => supabase
    .from("produtos")
    .select("id, codigo, descricao, preco_brl, ipi_pct")
    .eq("categoria", "peneira")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("descricao")
    .order("id")
    .range(de, ate));

  const peneiras: PecaCatalogo[] = (rawPeneiras ?? []).map((p: SupabaseAny) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.descricao,
    precoUnitario: p.preco_brl,
    ipiPct: p.ipi_pct,
  }));

  return { peneiras };
}

/** Tira "NAVALHA FIXA " / "NAVALHA ROTORA " / "NAVALHA ROTATIVA " da frente,
 * pra sobrar só o nome do modelo (ex.: "MGHS 1000 A2"). */
function extrairModeloNavalha(descricao: string): string {
  return descricao.replace(/^NAVALHA\s+(FIXA|ROTORA|ROTATIVA)\s+/i, "").trim();
}

/**
 * Jogos de navalhas (fixa + rotora) por modelo de máquina — pra página de
 * impressão do catálogo. A quantidade de cada tipo vem do próprio vínculo
 * em compatibilidades_equip (campo "quantidade" — a mesma "Quantidade neste
 * equipamento" editável na aba "Navalhas" do cadastro do equipamento), não
 * das especificações técnicas. Máquinas "irmãs" (mesmo jogo de navalhas,
 * motor diferente) viram uma linha só.
 */
async function carregarJogosNavalhasPorVinculo(
  supabaseClient?: SupabaseAny
): Promise<JogoNavalhas[]> {
  const supabase: SupabaseAny = supabaseClient ?? createClient();

  const rawMaquinas = await buscarTodos((de, ate) => supabase
    .from("produtos")
    .select(
      `id, codigo,
       linha:linhas(nome, ordem),
       compatibilidades_equip!compatibilidades_equip_equipamento_id_fkey(
         quantidade,
         peca:produtos!compatibilidades_equip_peca_id_fkey(id, codigo, descricao, preco_brl, ipi_pct, categoria, status, deleted_at)
       )`
    )
    .eq("categoria", "maquina")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("id")
    .range(de, ate));

  const porChave = new Map<string, JogoNavalhas>();

  for (const maquina of rawMaquinas ?? []) {
    const vinculos = (maquina.compatibilidades_equip ?? []) as SupabaseAny[];
    // Navalha descontinuada ou excluída não sai no catálogo.
    const navalhas = vinculos.filter((v) => v.peca && v.peca.categoria === "navalha" && v.peca.status === "ativo" && !v.peca.deleted_at);

    const vFixa = navalhas.find((v) => /^NAVALHA\s+FIXA\s+/i.test(v.peca.descricao));
    const vRotora = navalhas.find((v) => /^NAVALHA\s+ROT(ORA|ATIVA)\s+/i.test(v.peca.descricao));
    if (!vFixa && !vRotora) continue;

    const fixa = vFixa?.peca ?? null;
    const rotora = vRotora?.peca ?? null;
    const qtdFixa = vFixa ? vFixa.quantidade ?? 1 : null;
    const qtdRotora = vRotora ? vRotora.quantidade ?? 1 : null;

    const chave = `${fixa?.id ?? "-"}|${rotora?.id ?? "-"}|${qtdFixa ?? "-"}|${qtdRotora ?? "-"}`;
    const existente = porChave.get(chave);
    if (existente) {
      // Mesmo jogo em equipamentos de famílias diferentes (ex.: LR e LRX):
      // fica na família que vem primeiro no catálogo.
      const ordem = maquina.linha?.ordem ?? Number.MAX_SAFE_INTEGER;
      if (ordem < existente.familiaOrdem) {
        existente.familia = maquina.linha?.nome ?? existente.familia;
        existente.familiaOrdem = ordem;
      }
      continue;
    }

    // Mesmo cálculo do Reajuste e das propostas (centavos, IPI por linha); sem preço, não há total.
    const calculo = calcularKit([
      ...(fixa && qtdFixa ? [{ pecas: qtdFixa, preco: fixa.preco_brl ?? null, ipi: fixa.ipi_pct ?? 0, grupo: "fixa" as const }] : []),
      ...(rotora && qtdRotora ? [{ pecas: qtdRotora, preco: rotora.preco_brl ?? null, ipi: rotora.ipi_pct ?? 0, grupo: "rotora" as const }] : []),
    ]);

    porChave.set(chave, {
      chave,
      familia: maquina.linha?.nome ?? "Outros",
      familiaOrdem: maquina.linha?.ordem ?? Number.MAX_SAFE_INTEGER,
      modelo: extrairModeloNavalha(fixa?.descricao ?? rotora?.descricao ?? maquina.codigo),
      codigoFixa: fixa?.codigo ?? null,
      qtdFixa,
      precoFixa: fixa?.preco_brl ?? null,
      ipiFixa: fixa?.ipi_pct ?? null,
      codigoRotora: rotora?.codigo ?? null,
      qtdRotora,
      precoRotora: rotora?.preco_brl ?? null,
      ipiRotora: rotora?.ipi_pct ?? null,
      valorTotalComIpi: calculo.total,
    });
  }

  // Agrupado por família (mesma ordem das linhas no catálogo) e, dentro dela,
  // do menor para o maior: MGHS 200 LR, MGHS 250 LR, … depois a próxima família.
  return Array.from(porChave.values()).sort((a, b) => {
    if (a.familiaOrdem !== b.familiaOrdem) return a.familiaOrdem - b.familiaOrdem;
    if (a.familia !== b.familia) return a.familia.localeCompare(b.familia);
    const diff = tamanhoModelo(a.modelo) - tamanhoModelo(b.modelo);
    return diff !== 0 ? diff : a.modelo.localeCompare(b.modelo);
  });
}

/**
 * Jogos de navalhas do catálogo. A fonte principal são os jogos cadastrados (os mesmos da tela de Reajuste e das
 * propostas), com preço, IPI e quantidade vigentes; sem jogos cadastrados, usa os vínculos de cada equipamento.
 * O total usa o cálculo central (calcularKit), igual ao da listagem de Reajuste e ao das propostas novas.
 */
export async function carregarJogosNavalhas(supabaseClient?: SupabaseAny): Promise<JogoNavalhas[]> {
  const supabase: SupabaseAny = supabaseClient ?? createClient();
  let jogos: SupabaseAny[] = [];
  try {
    jogos = await buscarTodos((de, ate) => supabase.from("jogos_navalha")
      .select(`id, nome, material, ativo,
        equipamento:produtos!jogos_navalha_equipamento_id_fkey(id, codigo, status, deleted_at, linha:linhas(nome, ordem)),
        itens:jogos_navalha_itens(titulo, pecas, codigo, ordem, produto:produtos!jogos_navalha_itens_produto_id_fkey(id, codigo, descricao, preco_brl, ipi_pct, status, ativo, deleted_at))`)
      .eq("ativo", true).order("id").range(de, ate));
  } catch {
    jogos = []; // tabela ainda não existe (arquivo 026 não aplicado)
  }
  const vivos = jogos.filter((j) => j.equipamento && j.equipamento.status === "ativo" && !j.equipamento.deleted_at && (j.itens ?? []).length > 0);
  if (vivos.length === 0) return carregarJogosNavalhasPorVinculo(supabase);

  const porChave = new Map<string, JogoNavalhas>();
  for (const j of vivos) {
    const itens = (j.itens as SupabaseAny[])
      .filter((i) => i.produto && i.produto.status === "ativo" && i.produto.ativo !== false && !i.produto.deleted_at)
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({ ...i, grupo: classificarComponente(i.titulo, i.produto.descricao) }));
    if (itens.length === 0) continue;
    const grupo = (g: "fixa" | "rotora") => {
      const doGrupo = itens.filter((i) => i.grupo === g);
      const produtos = Array.from(new Map(doGrupo.map((i) => [i.produto.id, i.produto])).values());
      return {
        produtos, qtd: doGrupo.length ? doGrupo.reduce((s: number, i) => s + Number(i.pecas), 0) : null,
        codigo: produtos.length ? produtos.map((p) => p.codigo).join(" / ") : null,
        preco: produtos.length === 1 ? (produtos[0].preco_brl ?? null) : null,
        ipi: produtos.length === 1 ? (produtos[0].ipi_pct ?? null) : null,
      };
    };
    const fixa = grupo("fixa"), rotora = grupo("rotora");
    const calculo = calcularKit(itens.map((i) => ({ pecas: Number(i.pecas), preco: i.produto.preco_brl ?? null, ipi: Number(i.produto.ipi_pct ?? 0), grupo: i.grupo })));
    const variante = [j.nome && String(j.nome).trim().toLowerCase() !== "padrão" ? String(j.nome).trim() : null, j.material?.trim() || null].filter(Boolean).join(" · ");
    const base = extrairModeloNavalha(fixa.produtos[0]?.descricao ?? rotora.produtos[0]?.descricao ?? j.equipamento.codigo);
    const modelo = variante ? `${base} – ${variante}` : base;
    const chave = `${itens.map((i) => `${i.produto.id}x${i.pecas}`).join("|")}|${variante}`;
    const existente = porChave.get(chave);
    const ordem = j.equipamento.linha?.ordem ?? Number.MAX_SAFE_INTEGER;
    if (existente) {
      if (ordem < existente.familiaOrdem) { existente.familia = j.equipamento.linha?.nome ?? existente.familia; existente.familiaOrdem = ordem; }
      continue; // mesmo jogo em equipamentos irmãos: uma linha só
    }
    porChave.set(chave, {
      chave, familia: j.equipamento.linha?.nome ?? "Outros", familiaOrdem: ordem, modelo,
      codigoFixa: fixa.codigo, qtdFixa: fixa.qtd, precoFixa: fixa.preco, ipiFixa: fixa.ipi,
      codigoRotora: rotora.codigo, qtdRotora: rotora.qtd, precoRotora: rotora.preco, ipiRotora: rotora.ipi,
      valorTotalComIpi: calculo.total,
    });
  }
  // Família (ordem das linhas) → número do modelo em ordem natural → variante.
  return Array.from(porChave.values()).sort((a, b) =>
    a.familiaOrdem - b.familiaOrdem || compararNatural(a.familia, b.familia) || compararModelos(a.modelo, b.modelo) || compararNatural(a.modelo, b.modelo));
}

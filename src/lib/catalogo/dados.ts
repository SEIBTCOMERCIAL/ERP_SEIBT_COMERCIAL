import { createClient } from "@/lib/supabase/server";
import type { CatalogoLinha, JogoNavalhas, MaquinaCatalogo, PecaCatalogo, SpecCampo } from "./tipos";

export type { SpecCampo, ImagemProduto, MaquinaCatalogo, CatalogoLinha, PecaCatalogo, JogoNavalhas, ModoCatalogo } from "./tipos";
export { paginarMaquinas } from "./tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

/**
 * Pega o número do modelo pra ordenar do menor pro maior equipamento
 * (ex.: "MGHS 1200 BSC" depois de "MGHS 200 BSC" — em ordem alfabética de
 * texto "1200" viria antes de "200", o que fica errado). Sem número no
 * código (ex.: "TESTE"), joga pro final da lista.
 */
function tamanhoModelo(codigo: string): number {
  const match = codigo.match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

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

  const [{ data: rawLinha }, { data: rawMaquinas }, { data: rawCampos }] = await Promise.all([
    supabase.from("linhas").select("id, nome, ordem, modo_catalogo").eq("id", linhaId).single(),
    supabase
      .from("produtos")
      .select(
        "id, codigo, potencia_motor, preco_brl, preco_painel_220, preco_painel_380, specs, foto_url, produto_arquivos(id, tipo, nome, url)"
      )
      .eq("categoria", "maquina")
      .eq("linha_id", linhaId)
      .eq("status", "ativo")
      .is("deleted_at", null),
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

  const maquinas: MaquinaCatalogo[] = (rawMaquinas ?? [])
    .map((p: SupabaseAny) => ({
      id: p.id,
      codigo: p.codigo,
      potenciaMotor: p.potencia_motor ?? null,
      precoMaquina: p.preco_brl,
      precoPainel220: p.preco_painel_220,
      precoPainel380: p.preco_painel_380,
      specs: (p.specs ?? {}) as Record<string, string>,
      fotoUrl: p.foto_url ?? null,
      imagensDisponiveis: (p.produto_arquivos ?? [])
        .filter((a: SupabaseAny) => a.tipo === "imagem")
        .map((a: SupabaseAny) => ({ id: a.id, url: a.url, nome: a.nome })),
    }))
    .sort((a: MaquinaCatalogo, b: MaquinaCatalogo) => {
      const diff = tamanhoModelo(a.codigo) - tamanhoModelo(b.codigo);
      return diff !== 0 ? diff : a.codigo.localeCompare(b.codigo);
    });

  const specCampos: SpecCampo[] = rawCampos ?? [];

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

  const { data: linhasComMaquina } = await supabase
    .from("produtos")
    .select("linha_id")
    .eq("categoria", "maquina")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .not("linha_id", "is", null);

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

  const { data: rawPeneiras } = await supabase
    .from("produtos")
    .select("id, codigo, descricao, preco_brl, ipi_pct")
    .eq("categoria", "peneira")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("descricao");

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
export async function carregarJogosNavalhas(
  supabaseClient?: SupabaseAny
): Promise<JogoNavalhas[]> {
  const supabase: SupabaseAny = supabaseClient ?? createClient();

  const { data: rawMaquinas } = await supabase
    .from("produtos")
    .select(
      `id, codigo,
       compatibilidades_equip!compatibilidades_equip_equipamento_id_fkey(
         quantidade,
         peca:produtos!compatibilidades_equip_peca_id_fkey(id, codigo, descricao, preco_brl, ipi_pct, categoria)
       )`
    )
    .eq("categoria", "maquina")
    .eq("status", "ativo")
    .is("deleted_at", null);

  const porChave = new Map<string, JogoNavalhas>();

  for (const maquina of rawMaquinas ?? []) {
    const vinculos = (maquina.compatibilidades_equip ?? []) as SupabaseAny[];
    const navalhas = vinculos.filter((v) => v.peca && v.peca.categoria === "navalha");

    const vFixa = navalhas.find((v) => /^NAVALHA\s+FIXA\s+/i.test(v.peca.descricao));
    const vRotora = navalhas.find((v) => /^NAVALHA\s+ROT(ORA|ATIVA)\s+/i.test(v.peca.descricao));
    if (!vFixa && !vRotora) continue;

    const fixa = vFixa?.peca ?? null;
    const rotora = vRotora?.peca ?? null;
    const qtdFixa = vFixa ? vFixa.quantidade ?? 1 : null;
    const qtdRotora = vRotora ? vRotora.quantidade ?? 1 : null;

    const chave = `${fixa?.id ?? "-"}|${rotora?.id ?? "-"}|${qtdFixa ?? "-"}|${qtdRotora ?? "-"}`;
    if (porChave.has(chave)) continue;

    const subtotalFixa = fixa && qtdFixa ? qtdFixa * fixa.preco_brl : 0;
    const subtotalRotora = rotora && qtdRotora ? qtdRotora * rotora.preco_brl : 0;
    const ipiValorFixa = fixa && qtdFixa ? subtotalFixa * ((fixa.ipi_pct ?? 0) / 100) : 0;
    const ipiValorRotora = rotora && qtdRotora ? subtotalRotora * ((rotora.ipi_pct ?? 0) / 100) : 0;
    const temValor = (fixa && qtdFixa) || (rotora && qtdRotora);

    porChave.set(chave, {
      chave,
      modelo: extrairModeloNavalha(fixa?.descricao ?? rotora?.descricao ?? maquina.codigo),
      codigoFixa: fixa?.codigo ?? null,
      qtdFixa,
      precoFixa: fixa?.preco_brl ?? null,
      ipiFixa: fixa?.ipi_pct ?? null,
      codigoRotora: rotora?.codigo ?? null,
      qtdRotora,
      precoRotora: rotora?.preco_brl ?? null,
      ipiRotora: rotora?.ipi_pct ?? null,
      valorTotalComIpi: temValor ? subtotalFixa + subtotalRotora + ipiValorFixa + ipiValorRotora : null,
    });
  }

  return Array.from(porChave.values()).sort((a, b) => {
    const diff = tamanhoModelo(a.modelo) - tamanhoModelo(b.modelo);
    return diff !== 0 ? diff : a.modelo.localeCompare(b.modelo);
  });
}

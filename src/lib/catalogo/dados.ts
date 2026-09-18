import { createClient } from "@/lib/supabase/server";
import type { CatalogoLinha, MaquinaCatalogo, PecaCatalogo, SpecCampo } from "./tipos";

export type { SpecCampo, ImagemProduto, MaquinaCatalogo, CatalogoLinha, PecaCatalogo } from "./tipos";
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

  const [{ data: linha }, { data: rawMaquinas }, { data: rawCampos }] = await Promise.all([
    supabase.from("linhas").select("id, nome").eq("id", linhaId).single(),
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

  if (!linha) return null;

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
 * Navalhas e peneiras ativas, pra página de lista de preços de peças
 * (código, descrição, valor unitário, IPI) — layout diferente do das
 * máquinas: sem foto, sem tabela técnica, é uma lista de preços mesmo.
 */
export async function carregarPecasCatalogo(
  supabaseClient?: SupabaseAny
): Promise<{ navalhas: PecaCatalogo[]; peneiras: PecaCatalogo[] }> {
  const supabase: SupabaseAny = supabaseClient ?? createClient();

  const mapear = (rows: SupabaseAny[]): PecaCatalogo[] =>
    (rows ?? []).map((p: SupabaseAny) => ({
      id: p.id,
      codigo: p.codigo,
      descricao: p.descricao,
      precoUnitario: p.preco_brl,
      ipiPct: p.ipi_pct,
    }));

  const [{ data: rawNavalhas }, { data: rawPeneiras }] = await Promise.all([
    supabase
      .from("produtos")
      .select("id, codigo, descricao, preco_brl, ipi_pct")
      .eq("categoria", "navalha")
      .eq("status", "ativo")
      .is("deleted_at", null)
      .order("descricao"),
    supabase
      .from("produtos")
      .select("id, codigo, descricao, preco_brl, ipi_pct")
      .eq("categoria", "peneira")
      .eq("status", "ativo")
      .is("deleted_at", null)
      .order("descricao"),
  ]);

  return { navalhas: mapear(rawNavalhas ?? []), peneiras: mapear(rawPeneiras ?? []) };
}

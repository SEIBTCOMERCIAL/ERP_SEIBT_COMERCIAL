import { createClient } from "@/lib/supabase/server";

export interface SpecCampo {
  id: string;
  nome: string;
  ordem: number;
}

export interface ImagemProduto {
  id: string;
  url: string;
  nome: string;
}

export interface MaquinaCatalogo {
  id: string;
  codigo: string;
  potenciaMotor: string | null;
  precoMaquina: number | null;
  precoPainel220: number | null;
  precoPainel380: number | null;
  specs: Record<string, string>;
  fotoUrl: string | null;
  imagensDisponiveis: ImagemProduto[];
}

export interface CatalogoLinha {
  linha: { id: string; nome: string };
  specCampos: SpecCampo[];
  maquinas: MaquinaCatalogo[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

/**
 * Busca única (tela e PDF chamam a mesma função) com os dados de uma linha
 * pronta pra virar página de catálogo: máquinas ativas, preços, specs e fotos
 * já cadastradas. Aceita um client opcional para reaproveitar em contextos
 * que já têm um (ex.: a rota de geração de PDF).
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
      .is("deleted_at", null)
      .order("codigo"),
    supabase
      .from("linha_spec_campos")
      .select("id, nome, ordem")
      .eq("linha_id", linhaId)
      .order("ordem"),
  ]);

  if (!linha) return null;

  const maquinas: MaquinaCatalogo[] = (rawMaquinas ?? []).map((p: SupabaseAny) => ({
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
  }));

  const specCampos: SpecCampo[] = rawCampos ?? [];

  return { linha, specCampos, maquinas };
}

/** Regra do visual aprovado: 4 máquinas por folha A4. */
export function paginarMaquinas<T>(maquinas: T[], porPagina = 4): T[][] {
  const paginas: T[][] = [];
  for (let i = 0; i < maquinas.length; i += porPagina) {
    paginas.push(maquinas.slice(i, i + porPagina));
  }
  return paginas;
}

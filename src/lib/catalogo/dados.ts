import { createClient } from "@/lib/supabase/server";
import type { CatalogoLinha, MaquinaCatalogo, SpecCampo } from "./tipos";

export type { SpecCampo, ImagemProduto, MaquinaCatalogo, CatalogoLinha } from "./tipos";
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

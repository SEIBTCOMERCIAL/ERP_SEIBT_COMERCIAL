// Montagem dos itens do catálogo a partir das linhas do banco (sem dependências de servidor: roda em testes).
// O catálogo NÃO guarda preços próprios: precoMaquina, precoPainel220 e precoPainel380 são os preços vigentes de
// produtos (os mesmos que o Reajuste atualiza). Painéis são opções separadas, nunca somadas entre si.
import type { MaquinaCatalogo, TipoPreco } from "./tipos";

/** Linhas em que o item tem um preço por voltagem (220V / 380V), sem painel à parte. */
export const LINHAS_PRECO_POR_VOLTAGEM = /soft\s*starter/i;

/** Linhas em que os dois preços de painel são "compartilhado" e "dedicado" (Base de Preço 2026). */
export const LINHAS_PAINEL_COMPARTILHADO = /exaustor/i;

/** Campos técnicos que continuam no cadastro, mas não saem no catálogo impresso:
 * "PENEIRA PADRÃO (Ømm)" (6 a 22) dos moinhos e "PENEIRA" do RCX — pedido do Lucas, 07/10/2026. */
export const CAMPOS_FORA_DO_CATALOGO = /^PENEIRA(\s+PADR|\s*$)/i;

/** Colunas lidas de produtos para o catálogo (as mesmas dos preços vigentes). */
export const COLUNAS_CATALOGO = "id, codigo, potencia_motor, preco_brl, preco_painel_220, preco_painel_380, specs, foto_url, produto_arquivos(id, tipo, nome, url)";

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function montarMaquinaCatalogo(p: any, linhaNome: string): MaquinaCatalogo {
  const precoPorVoltagem = LINHAS_PRECO_POR_VOLTAGEM.test(linhaNome);
  const painelCompartilhado = LINHAS_PAINEL_COMPARTILHADO.test(linhaNome);
  const p220 = num(p.preco_painel_220);
  const p380 = num(p.preco_painel_380);
  const tipoPreco: TipoPreco = precoPorVoltagem
    ? "por_voltagem"
    : !((p220 ?? 0) > 0 || (p380 ?? 0) > 0)
      ? "sem_painel"
      : painelCompartilhado ? "painel_compartilhado" : "com_painel";
  return {
    id: p.id,
    codigo: p.codigo,
    nome: p.codigo,
    potenciaMotor: p.potencia_motor ?? null,
    precoMaquina: num(p.preco_brl),
    precoPainel220: p220,
    precoPainel380: p380,
    tipoPreco,
    specs: (p.specs ?? {}) as Record<string, string>,
    fotoUrl: p.foto_url ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imagensDisponiveis: (p.produto_arquivos ?? []).filter((a: any) => a.tipo === "imagem").map((a: any) => ({ id: a.id, url: a.url, nome: a.nome })),
  };
}

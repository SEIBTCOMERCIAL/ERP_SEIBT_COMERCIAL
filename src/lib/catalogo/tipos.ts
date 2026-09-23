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
  /** Nome exibido (título) — é o próprio código do equipamento. */
  nome: string;
  potenciaMotor: string | null;
  precoMaquina: number | null;
  precoPainel220: number | null;
  precoPainel380: number | null;
  specs: Record<string, string>;
  fotoUrl: string | null;
  imagensDisponiveis: ImagemProduto[];
}

export type ModoCatalogo = "completo" | "lista";

export interface CatalogoLinha {
  linha: { id: string; nome: string; ordem: number; modoCatalogo: ModoCatalogo };
  specCampos: SpecCampo[];
  maquinas: MaquinaCatalogo[];
}

export interface PecaCatalogo {
  id: string;
  codigo: string;
  descricao: string;
  precoUnitario: number | null;
  ipiPct: number | null;
}

/** Um "jogo de navalhas" (fixa + rotora) de um modelo de máquina, com
 * quantidade de cada uma e o valor total já com IPI. */
export interface JogoNavalhas {
  chave: string;
  modelo: string;
  codigoFixa: string | null;
  qtdFixa: number | null;
  precoFixa: number | null;
  ipiFixa: number | null;
  codigoRotora: string | null;
  qtdRotora: number | null;
  precoRotora: number | null;
  ipiRotora: number | null;
  valorTotalComIpi: number | null;
}

/**
 * Regra do visual aprovado: 4 máquinas por folha A4. Fica separado de
 * dados.ts (que busca no banco) porque este arquivo também é usado por
 * componentes que rodam no navegador — nada aqui pode depender de nada
 * que só existe no servidor.
 */
/** 4 máquinas por folha (visual aprovado). Linhas com tabela técnica maior que
 * 5 linhas (mais de 15 campos, ex.: LR/LRX/RCX) não cabem 4 na folha A4 — usam 3. */
export function maquinasPorPagina(qtdCamposTecnicos: number): number {
  return Math.ceil(qtdCamposTecnicos / 3) > 5 ? 3 : 4;
}

export function paginarMaquinas<T>(maquinas: T[], porPagina = 4): T[][] {
  const paginas: T[][] = [];
  for (let i = 0; i < maquinas.length; i += porPagina) {
    paginas.push(maquinas.slice(i, i + porPagina));
  }
  return paginas;
}

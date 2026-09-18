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

export interface PecaCatalogo {
  id: string;
  codigo: string;
  descricao: string;
  precoUnitario: number | null;
  ipiPct: number | null;
}

/**
 * Regra do visual aprovado: 4 máquinas por folha A4. Fica separado de
 * dados.ts (que busca no banco) porque este arquivo também é usado por
 * componentes que rodam no navegador — nada aqui pode depender de nada
 * que só existe no servidor.
 */
export function paginarMaquinas<T>(maquinas: T[], porPagina = 4): T[][] {
  const paginas: T[][] = [];
  for (let i = 0; i < maquinas.length; i += porPagina) {
    paginas.push(maquinas.slice(i, i + porPagina));
  }
  return paginas;
}

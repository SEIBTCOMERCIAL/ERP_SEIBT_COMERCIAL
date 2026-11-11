// Tipos compartilhados entre as telas de Produtos (navegador) e o servidor.
import type { Aba, SituacaoProduto } from "./regras";

export type { Aba, SituacaoProduto };

export interface Contagem {
  total: number;
  descontinuados: number;
  sem_foto: number;
  sem_preco: number;
  ficha_incompleta: number;
  sem_vinculo: number;
}

export interface LinhaNav {
  id: string;
  nome: string;
  ordem: number;
  familia: string | null;
  familia_ordem: number;
  contagem: Contagem;
}

export interface CategoriaNav {
  id: string;
  nome: string;
  ordem: number;
  contagem: Contagem;
}

export interface Navegacao {
  linhas: LinhaNav[];
  categorias: CategoriaNav[];
}

export interface ProdutoLista {
  id: string;
  codigo: string;
  descricao: string;
  modelo: string | null;
  tipo: "maquina" | "peca";
  linha_id: string | null;
  linha_nome: string | null;
  familia: string | null;
  categoria_peca_id: string | null;
  categoria_peca_nome: string | null;
  situacao: SituacaoProduto;
  preco_brl: number | null;
  preco_painel_220: number | null;
  preco_painel_380: number | null;
  ipi_pct: number | null;
  foto_url: string | null;
  solicitar_engenharia: boolean;
  potencia_motor: string | null;
  atualizado_em: string | null;
  pendencias: string[];
}

export type RespostaListaProdutos =
  | { ok: true; itens: ProdutoLista[]; total: number; pagina: number; tamanho: number; pendenciasDisponiveis: boolean }
  | { ok: false; erro: string; tipo: "permissao" | "banco" };

export type TipoErro = "conflito" | "permissao" | "validacao" | "nao_aplicado" | "banco" | "preco";

export type Resultado<T = unknown> = ({ ok: true } & T) | { ok: false; erro: string; tipo: TipoErro };

export interface VinculoPeca {
  id: string;
  quantidade: number;
  peca: {
    id: string; codigo: string; descricao: string; preco_brl: number | null; ipi_pct: number;
    categoria_peca_id: string; furo_diametro: string | null; observacao: string | null; versao: string | null;
    situacao: SituacaoProduto; equipamentos_usando: number;
  };
}

export interface PecaBusca {
  id: string; codigo: string; descricao: string; preco_brl: number | null; ipi_pct: number;
  categoria_peca_id: string | null; categoria_peca_nome: string | null;
}

export interface PecaDetalhe {
  id: string; codigo: string; descricao: string; preco_brl: number | null; ipi_pct: number; ncm: string | null;
  furo_diametro: string | null; observacao: string | null; categoria_peca_id: string; categoria_peca_nome: string | null;
  situacao: SituacaoProduto; versao: string | null;
  equipamentos: Array<{ vinculo_id: string; equipamento_id: string; codigo: string; linha_id: string | null; linha_nome: string | null; quantidade: number }>;
}

export interface ArquivoProduto {
  id: string;
  tipo: "imagem" | "desenho";
  nome: string;
  /** Imagens: endereço público. Documentos: endereço temporário assinado (expira). */
  url: string | null;
  privado: boolean;
  /** true = arquivo compartilhado (ex.: foto da linha): não existe arquivo próprio para apagar. */
  compartilhado: boolean;
  principal: boolean;
  ordem: number;
}

export interface EquipamentoDetalheDados {
  id: string;
  codigo: string;
  descricao: string;
  descricao_painel: string | null;
  potencia_motor: string | null;
  ncm: string | null;
  preco_brl: number | null;
  preco_painel_220: number | null;
  preco_painel_380: number | null;
  solicitar_engenharia: boolean;
  specs: Record<string, unknown>;
  foto_url: string | null;
  situacao: SituacaoProduto;
  versao: string | null;
  atualizado_em: string | null;
}

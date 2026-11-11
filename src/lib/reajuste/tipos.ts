// Tipos compartilhados entre a tela de Reajuste (navegador) e as ações do servidor.
import type {
  ComponenteId, ItemPlanejado, MotivoIgnorado, SituacaoItem, TipoProduto,
} from "./regras";

export type Aba = "maquinas" | "pecas";

export interface ResumoEscopo {
  id: string;
  nome: string;
  total: number;
  sem_reajuste: number;
  parcial: number;
  atualizado: number;
  sem_preco: number;
  inativos: number;
}

export interface ResumoReajuste {
  maquinas: ResumoEscopo[];
  pecas: ResumoEscopo[];
  /** Hoje em Brasília e início do período considerado (1º de janeiro do ano corrente). */
  hoje: string;
  inicio: string;
}

export interface UltimoReajuste {
  data: string;
  percentual: number | null;
  componente: string | null;
}

export interface ItemLista {
  id: string;
  codigo: string;
  descricao: string;
  modelo: string | null;
  tipo: TipoProduto;
  ativo: boolean;
  solicitar_engenharia: boolean;
  ipi_pct: number | null;
  /** Preço por componente (null = não cadastrado). Peças usam só "peca". */
  precos: Partial<Record<ComponenteId, number | null>>;
  situacao: SituacaoItem;
  reajustados: ComponenteId[];
  pendentes: ComponenteId[];
  ultimo: UltimoReajuste | null;
  /** Nome da linha/categoria (útil em buscas que cruzam várias). */
  escopo_nome: string | null;
}

export type FiltroSituacao = "todas" | SituacaoItem;

export interface PedidoLista {
  aba: Aba;
  escopoId: string | null;
  busca: string;
  situacao: FiltroSituacao;
  pagina: number;
}

export type RespostaLista =
  | { ok: true; itens: ItemLista[]; total: number; pagina: number; tamanho: number; todosIds: string[] }
  | { ok: false; erro: string };

export type EscopoPedido =
  | { tipo: "itens"; ids: string[] }
  | { tipo: "linha" | "categoria"; id: string };

export interface PedidoPrevia {
  escopo: EscopoPedido;
  modo: "percentual" | "valor";
  componentes: ComponenteId[];
  /** Textos digitados (aceitam vírgula). */
  percentuais: Partial<Record<ComponenteId, string>>;
  valores: Partial<Record<ComponenteId, string>>;
}

export interface EntradaConfirmacao {
  produto_id: string;
  componente: ComponenteId;
  esperado: number;
  novo: number;
}

export interface IgnoradoTexto {
  produto_id: string;
  codigo: string | null;
  descricao: string | null;
  componente: ComponenteId;
  motivo: MotivoIgnorado;
  texto: string;
}

export type RespostaPrevia =
  | {
      ok: true;
      itens: ItemPlanejado[];
      ignorados: IgnoradoTexto[];
      entradas: EntradaConfirmacao[];
      produtos: number;
      componentes: number;
      hoje: string;
      escopoDescricao: string;
    }
  | { ok: false; erro: string };

export interface PedidoConfirmacao {
  chave: string;
  motivo: string;
  entradas: EntradaConfirmacao[];
}

export type RespostaConfirmacao =
  | { ok: true; produtos: number; componentes: number; ignorados: IgnoradoTexto[]; repetido: boolean; data: string }
  | { ok: false; erro: string; tipo: "conflito" | "validacao" | "banco" | "nao_aplicado" | "permissao" | "sem_alteracao" };

export interface LinhaHistorico {
  id: string;
  data_reajuste: string;
  componente: string | null;
  preco_anterior_brl: number | null;
  preco_novo_brl: number | null;
  percentual_reajuste: number | null;
  motivo: string | null;
  responsavel: string | null;
}

export type RespostaHistorico =
  | {
      ok: true;
      linhas: LinhaHistorico[];
      total: number;
      pagina: number;
      tamanho: number;
      /** Pontos para o gráfico do componente (mais antigo → mais recente). */
      serie: Array<{ data: string; preco: number }>;
    }
  | { ok: false; erro: string };

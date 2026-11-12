// Tipos compartilhados entre a tela de Reajuste (navegador) e as ações do servidor.
import type { CalculoKit, GrupoComponente, SituacaoKit, UltimoDoKit } from "./kits";
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
  /** Só em categorias de peças: navalhas e peneiras têm visão própria. */
  tipo_categoria?: "navalha" | "peneira" | null;
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
  /** Peneiras: furo, dimensões e espessura lidos do cadastro. */
  atributos?: string | null;
  /** Produto da categoria navalha: permite edição manual do IPI. */
  navalha?: boolean;
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

// ─── Navalhas por kit e peneiras por modelo ─────────────────────────────────────────────────

export interface ComponenteKit {
  linhaId: string;
  produtoId: string;
  titulo: string;
  /** Código mostrado no orçamento (pode ser parte do código do cadastro). */
  codigo: string;
  codigoProduto: string;
  grupo: GrupoComponente;
  pecas: number;
  precoUnit: number | null;
  ipi: number;
  /** Quantidade × unitário, sem IPI; null quando falta preço. */
  subtotal: number | null;
  ativo: boolean;
  item: ItemLista;
  /** Outros kits que usam a mesma peça (reajustar a peça muda todos eles). */
  compartilhadoCom: Array<{ kitId: string; rotulo: string }>;
}

export interface KitLista {
  id: string;
  equipamentoId: string;
  modelo: string;
  variante: string | null;
  ativo: boolean;
  componentes: ComponenteKit[];
  calculo: CalculoKit;
  situacao: SituacaoKit;
  ultimo: UltimoDoKit | null;
  pecasUnicas: number;
}

export interface ResumoKits {
  kits: number;
  pecas: number;
  sem_reajuste: number;
  parcial: number;
  atualizado: number;
  sem_preco: number;
  inativos: number;
  incompletos: number;
  sem_kit: number;
}

export interface RevisaoNavalha { produtoId: string; codigo: string; descricao: string; motivo: string }

export interface PedidoKits { busca: string; situacao: FiltroSituacao; pagina: number }

export type RespostaKits =
  | { ok: true; kits: KitLista[]; total: number; pagina: number; tamanho: number; resumo: ResumoKits; semKit: ItemLista[]; revisao: RevisaoNavalha[]; hoje: string }
  | { ok: false; erro: string };

export interface GrupoPeneiras { modelo: string | null; itens: ItemLista[] }

export type RespostaPeneiras =
  | { ok: true; grupos: GrupoPeneiras[]; total: number; produtos: number; pagina: number; tamanho: number; sem_modelo: number }
  | { ok: false; erro: string };

export interface PedidoIpi { produtoIds: string[]; ipi: string; motivo: string }

export type RespostaIpi =
  | { ok: true; produtos: number; alterados: number; semMudanca: number }
  | { ok: false; erro: string; tipo: "validacao" | "permissao" | "nao_aplicado" | "banco" };

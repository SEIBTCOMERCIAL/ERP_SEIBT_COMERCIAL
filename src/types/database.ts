// Tipos gerados do schema do banco de dados ERP SEIBT
// Atualizar quando migrations forem aplicadas

export type Perfil = "admin" | "vendedor_interno" | "representante" | "engenharia";

export type SegmentoCliente = "transformador" | "reciclador" | "industria" | "outro";
export type PorteCliente = "pequeno" | "medio" | "grande";
export type StatusCliente = "prospect" | "ativo" | "inativo";

export type StatusProposta =
  | "rascunho"
  | "elaboracao"
  | "aguardando_precificacao"
  | "enviada"
  | "em_negociacao"
  | "vendida"
  | "perdida"
  | "desistencia"
  | "stand_by";

export type TemperaturaProposta = "quente" | "morna" | "fria";
export type TipoProposta = "maquina" | "sistema" | "exportacao" | "pecas" | "servico" | "mista";
export type MoedaProposta = "BRL" | "USD";

export type CanalOrigem =
  | "whatsapp"
  | "email"
  | "feira"
  | "site"
  | "indicacao"
  | "telefone"
  | "recorrencia"
  | "outro";

export type TipoRepresentante = "externo" | "interno_duplo";
export type TratamentoContato = "sr" | "sra" | "dr" | "dra";

export type CanalFollowup =
  | "whatsapp"
  | "telefone"
  | "email"
  | "visita"
  | "video"
  | "sms"
  | "outro";

export type StatusSolicitacaoPrecificacao =
  | "pendente"
  | "em_analise"
  | "respondida"
  | "cancelada";

export type Categoriaproduto =
  | "maquina"
  | "navalha"
  | "peneira"
  | "rolamento"
  | "parafuso"
  | "rotor"
  | "inserto"
  | "periferico"
  | "linha"
  | "outro";

export type MercadoMeta = "interno" | "exportacao";

export interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  categoria: Categoriaproduto;
  modelo: string | null;
  linha: string | null;
  preco_brl: number | null;
  preco_usd: number | null;
  ipi_pct: number;
  ncm: string | null;
  produto_especial: boolean;
  tem_variantes: boolean;
  ativo: boolean;
  specs: Record<string, unknown> | null;
  foto_url: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export interface VarianteProduto {
  id: string;
  produto_id: string;
  codigo_variante: string;
  descricao_variante: string;
  preco_brl: number | null;
  preco_usd: number | null;
  ipi_pct: number | null;
  ativo: boolean;
}

export interface HistoricoPreco {
  id: string;
  produto_id: string | null;
  variante_id: string | null;
  preco_anterior_brl: number | null;
  preco_novo_brl: number | null;
  preco_anterior_usd: number | null;
  preco_novo_usd: number | null;
  percentual_reajuste: number | null;
  motivo: string | null;
  data_reajuste: string;
  reajustado_por: string;
}

export interface CompatibilidadeProduto {
  id: string;
  produto_id: string;
  modelo_maquina: string | null;
  furos_codigos: string | null;
  observacao: string | null;
}

export interface TaxaCambio {
  id: string;
  moeda: string;
  taxa: number;
  vigente_desde: string;
  atualizado_por: string | null;
  atualizado_em: string;
}

export interface ProdutoComDetalhes extends Produto {
  compatibilidades_produto: CompatibilidadeProduto[];
  historico_precos: HistoricoPreco[];
  modelos_compat: string[];
  ultimo_reajuste_data: string | null;
  ultimo_reajuste_pct: number | null;
}

export type TipoFrete = "cif" | "fob";

// Tipos das tabelas
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  iniciais_pdf: string | null;
  pode_configurar: boolean;
  ativo: boolean;
  avatar_url: string | null;
  criado_em: string;
  ultimo_acesso: string | null;
  deleted_at: string | null;
}

export interface Representante {
  id: string;
  nome: string;
  tipo: TipoRepresentante;
  usuario_id: string | null;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  observacoes: string | null;
}

export interface RegiaoRepresentante {
  id: string;
  representante_id: string;
  estado: string | null;
  pais: string | null;
  observacao: string | null;
}

export interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: SegmentoCliente;
  porte: PorteCliente;
  status: StatusCliente;
  estado: string | null;
  cidade: string | null;
  pais: string;
  endereco: string | null;
  representante_id: string | null;
  responsavel_id: string | null;
  importado_dez: boolean;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export interface ContatoCliente {
  id: string;
  cliente_id: string;
  nome: string;
  cargo: string | null;
  tratamento: TratamentoContato | null;
  telefone: string | null;
  email: string | null;
  whatsapp: string | null;
  principal: boolean;
  ativo: boolean;
}

export interface MaquinaCliente {
  id: string;
  cliente_id: string;
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: number | null;
  plaqueta_foto_url: string | null;
  observacoes: string | null;
  registrado_em: string;
  registrado_por: string;
}

export interface Funil {
  id: string;
  nome: string;
  usuario_id: string | null;
  perfil_alvo: "vendedor_interno" | "representante" | null;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}

export interface EtapaFunil {
  id: string;
  funil_id: string;
  nome: string;
  ordem: number;
  cor: string;
  ativo: boolean;
}

export interface ItemProposta {
  id: string;
  proposta_id: string;
  produto_id: string | null;
  variante_id: string | null;
  descricao: string;
  quantidade: number;
  preco_tabela: number | null;
  preco_unitario: number;
  desconto_pct: number | null;
  desconto_justificativa: string | null;
  ipi_pct: number;
  total: number | null;
  observacao: string | null;
  ordem: number;
  opcional: boolean;
  e_subitem: boolean;
  item_pai_id: string | null;
  numero_item: string | null;
  requer_engenharia: boolean;
}

export interface ChecklistTecnico {
  id: string;
  proposta_id: string;
  segmento_aplicacao: string;
  produto_final: string;
  material: string;
  dimensoes: string;
  granulometria: string;
  moagem_tipo: string;
  forma_abastecimento: string;
  producao_horaria_kgh: number;
  voltagem: string;
  completo: boolean;
  preenchido_em: string | null;
  preenchido_por: string | null;
}

export interface Frete {
  id: string;
  proposta_id: string | null;
  pedido_numero: string | null;
  descricao_produto: string;
  peso_bruto_kg: number | null;
  volume_m3: number | null;
  dimensoes_l: number | null;
  dimensoes_a: number | null;
  dimensoes_p: number | null;
  tipo_frete: TipoFrete;
  cidade_origem: string | null;
  estado_origem: string | null;
  endereco_origem: string | null;
  cidade_destino: string | null;
  estado_destino: string | null;
  endereco_destino: string | null;
  transportadora: string | null;
  observacoes: string | null;
  pdf_folder_cliente_url: string | null;
  pdf_folder_transportadora_url: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Meta {
  id: string;
  usuario_id: string | null;
  representante_id: string | null;
  mes: number;
  ano: number;
  meta_total_brl: number;
  meta_maquinas_brl: number | null;
  meta_pecas_brl: number | null;
  realizado_brl: number;
  realizado_maquinas_brl: number | null;
  realizado_pecas_brl: number | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Followup {
  id: string;
  proposta_id: string;
  usuario_id: string;
  data_contato: string;
  canal: CanalFollowup;
  motivo: string | null;
  descricao: string | null;
  temperatura: TemperaturaProposta | null;
  etapa_proposta: string | null;
  proxima_acao_data: string | null;
  proxima_acao_tipo: string | null;
  proxima_acao_notas: string | null;
  criado_em: string;
}

export interface Proposta {
  id: string;
  numero: number;
  revisao: string | null;
  proposta_original_id: string | null;
  numero_completo: string;
  tipo: TipoProposta;
  cliente_id: string | null;
  lead_id: string | null;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  responsavel_id: string;
  representante_id: string | null;
  canal_origem: CanalOrigem | null;
  moeda: MoedaProposta;
  status: StatusProposta;
  temperatura: TemperaturaProposta | null;
  etapa_funil_id: string | null;
  valor_total: number | null;
  desconto_medio_pct: number | null;
  condicao_pagamento: string | null;
  prazo_entrega: string | null;
  validade_proposta: string | null;
  observacoes: string | null;
  descricao_livre: string | null;
  motivo_perda: string | null;
  numero_pedido_dez: string | null;
  valor_pedido_real: number | null;
  data_pedido_dez: string | null;
  estornado: boolean;
  pdf_url: string | null;
  pdf_template: "template_1" | "template_2" | "template_3" | null;
  criado_em: string;
  enviada_em: string | null;
  fechada_em: string | null;
  atualizado_em: string;
  deleted_at: string | null;
}

// Placeholder para o tipo Database completo (será gerado via supabase gen types)
export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: Usuario;
        Insert: Omit<Usuario, "id" | "criado_em">;
        Update: Partial<Omit<Usuario, "id">>;
      };
      clientes: {
        Row: Cliente;
        Insert: Omit<Cliente, "id" | "criado_em" | "atualizado_em">;
        Update: Partial<Omit<Cliente, "id">>;
      };
      contatos_cliente: {
        Row: ContatoCliente;
        Insert: Omit<ContatoCliente, "id">;
        Update: Partial<Omit<ContatoCliente, "id">>;
      };
      maquinas_cliente: {
        Row: MaquinaCliente;
        Insert: Omit<MaquinaCliente, "id" | "registrado_em">;
        Update: Partial<Omit<MaquinaCliente, "id">>;
      };
      representantes: {
        Row: Representante;
        Insert: Omit<Representante, "id">;
        Update: Partial<Omit<Representante, "id">>;
      };
      propostas: {
        Row: Proposta;
        Insert: Omit<Proposta, "id" | "criado_em" | "atualizado_em">;
        Update: Partial<Omit<Proposta, "id">>;
      };
      funis: {
        Row: Funil;
        Insert: Omit<Funil, "id" | "criado_em" | "atualizado_em">;
        Update: Partial<Omit<Funil, "id">>;
      };
      etapas_funil: {
        Row: EtapaFunil;
        Insert: Omit<EtapaFunil, "id">;
        Update: Partial<Omit<EtapaFunil, "id">>;
      };
      itens_proposta: {
        Row: ItemProposta;
        Insert: Omit<ItemProposta, "id">;
        Update: Partial<Omit<ItemProposta, "id">>;
      };
      followups: {
        Row: Followup;
        Insert: Omit<Followup, "id" | "criado_em">;
        Update: Partial<Omit<Followup, "id">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

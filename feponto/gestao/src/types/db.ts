// Tipos que espelham as tabelas do banco (Supabase / Postgres)

export interface Categoria {
  id: string
  nome: string
  ordem: number
  parent_id: string | null
  created_at: string
}

export interface Produto {
  id: string
  codigo: string | null
  nome: string
  descricao: string | null
  categoria_id: string | null
  fornecedor: string | null
  tamanho: string | null
  cor_ouro: string | null
  publico: string | null
  tipo_metal: string | null
  teor: string | null
  peso_gramas: number | null
  pedras: string | null
  // Medidas de aliança (mm). Só aparecem no formulário quando a peça é aliança.
  largura_mm: number | null
  espessura_mm: number | null
  // Par de alianças: um produto = as duas peças. Ver sql/bloco-3-par-alianca.sql
  eh_par: boolean
  par_tamanho: string | null
  par_largura_mm: number | null
  par_espessura_mm: number | null
  par_indice: number | null
  par_peso_gramas: number | null
  indice: number | null
  // MK de custo: indice = peso_gramas × mk_custo. Ver sql/bloco-8-mk-custo.sql
  mk_custo: number | null
  markup: number | null
  // Cotação de custo (R$/g) — o rótulo na tela é "Cotação de custo"
  cotacao_compra: number | null
  cotacao_venda: number | null
  custo: number | null
  preco_venda: number
  preco_automatico: boolean
  quantidade: number
  visivel_no_site: boolean
  destaque_site: boolean
  mostrar_preco: boolean
  foto_urls: string[]
  ativo: boolean
  created_at: string
  updated_at: string
  // join opcional
  categorias?: Pick<Categoria, 'id' | 'nome'> | null
}

export interface Configuracao {
  chave: string
  valor: number
  updated_at: string
}

export interface Cliente {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  cpf: string | null
  data_nascimento: string | null
  endereco: Endereco | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface Endereco {
  cep?: string
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
}

export type StatusVenda = 'concluida' | 'cancelada' | 'orcamento'

export interface Venda {
  id: string
  numero: number
  cliente_id: string | null
  data_venda: string
  subtotal: number
  desconto: number
  total: number
  status: StatusVenda
  observacoes: string | null
  // Venda que sai pelos Correios — alimenta a tela Envios.
  // Ver sql/bloco-4-envio-venda.sql
  precisa_envio: boolean
  envio_status: EnvioStatus | null
  codigo_rastreio: string | null
  rastreio_url: string | null
  enviado_em: string | null
  entregue_em: string | null
  endereco_envio: Endereco | null
  created_at: string
  updated_at: string
  clientes?: Pick<Cliente, 'id' | 'nome'> | null
}

export type EnvioStatus = 'a_enviar' | 'enviado' | 'entregue'

export interface VendaItem {
  id: string
  venda_id: string
  produto_id: string | null
  descricao: string | null
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export interface Pagamento {
  id: string
  venda_id: string
  forma: string
  valor: number
  parcelas: number
  observacoes: string | null
  created_at: string
}

export type TipoConta = 'receber' | 'pagar'

export interface Conta {
  id: string
  tipo: TipoConta
  descricao: string
  categoria: string | null
  cliente_id: string | null
  fornecedor: string | null
  valor: number
  vencimento: string | null
  pago: boolean
  data_pagamento: string | null
  venda_id: string | null
  recorrente: boolean
  frequencia: string | null
  grupo_id: string | null
  created_at: string
  updated_at: string
  clientes?: Pick<Cliente, 'id' | 'nome'> | null
}

export type TipoMovimento = 'entrada' | 'saida'

export interface MovimentacaoCaixa {
  id: string
  tipo: TipoMovimento
  descricao: string
  categoria: string | null
  valor: number
  data: string
  forma_pagamento: string | null
  venda_id: string | null
  conta_id: string | null
  created_at: string
}

export type StatusProducao =
  | 'encomendado'
  | 'em_producao'
  | 'pronto'
  | 'entregue'
  | 'cancelado'

export interface Producao {
  id: string
  descricao: string
  cliente_id: string | null
  responsavel: string | null
  status: StatusProducao
  previsao_entrega: string | null
  valor: number | null
  observacoes: string | null
  foto_urls: string[]
  created_at: string
  updated_at: string
  clientes?: Pick<Cliente, 'id' | 'nome'> | null
}

export type StatusOS = 'recebido' | 'em_servico' | 'pronto' | 'entregue'

export interface OrdemServico {
  id: string
  numero: number
  cliente_id: string | null
  descricao: string
  tipo: string | null
  status: StatusOS
  valor: number | null
  previsao: string | null
  responsavel: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
  clientes?: Pick<Cliente, 'id' | 'nome'> | null
}

export type StatusConsignacao = 'em_loja' | 'vendida' | 'devolvida'

export interface Consignacao {
  id: string
  fornecedor: string
  descricao: string
  codigo: string | null
  peso_gramas: number | null
  valor_fornecedor: number | null
  preco_venda: number | null
  quantidade: number
  status: StatusConsignacao
  data_entrada: string
  data_saida: string | null
  venda_id: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

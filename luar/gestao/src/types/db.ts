// Tipos que espelham as tabelas do Supabase da Luar.
// Dinheiro SEMPRE em centavos (inteiro).

export interface Produto {
  id: string
  slug: string
  nome: string
  descricao: string | null
  categoria: string | null
  material: string | null
  preco_centavos: number
  custo_centavos: number | null
  /** Markup: multiplicador sobre o custo que gera o preço (migração 0019).
   *  Nulo quando a peça não tem custo cadastrado. A conta fica em lib/preco.ts. */
  markup: number | null
  estoque: number
  imagem_url: string | null
  ativo: boolean
  // colunas de ERP (migração 0007)
  codigo: string | null
  fornecedor: string | null
  tamanho: string | null
  foto_urls: string[]
  visivel_no_site: boolean
  destaque_site: boolean
  mostrar_preco: boolean
  publico: string | null
  created_at: string
  updated_at: string
}

export interface Endereco {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
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

/** Venda nasce `em_andamento` e a Luana conclui pelo botão (0021).
 *  É rótulo: estoque e caixa já se movem no registro. `orcamento` é
 *  herança do 0007 e não tem tela. */
export type StatusVenda = 'em_andamento' | 'concluida' | 'cancelada' | 'orcamento'
export type EnvioStatus = 'a_enviar' | 'enviado' | 'entregue'

export interface Venda {
  id: string
  numero: number
  cliente_id: string | null
  data_venda: string
  subtotal_centavos: number
  desconto_centavos: number
  total_centavos: number
  status: StatusVenda
  observacoes: string | null
  // envio (vendas de fora do site que vão pelos Correios)
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

export interface VendaItem {
  id: string
  venda_id: string
  produto_id: string | null
  descricao: string | null
  quantidade: number
  preco_unitario_centavos: number
  subtotal_centavos: number
  // Kit vendido (migração 0017). `produto_id` e `kit_id` nunca vêm juntos.
  kit_id?: string | null
  /** Retrato da composição na hora da venda — é por ele que o estoque é
   *  estornado ao editar/cancelar, não pela composição atual do kit. */
  kit_composicao?: { produto_id: string; quantidade: number }[] | null
}

export interface Pagamento {
  id: string
  venda_id: string
  forma: string
  valor_centavos: number
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
  valor_centavos: number
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
  valor_centavos: number
  data: string
  forma_pagamento: string | null
  venda_id: string | null
  conta_id: string | null
  created_at: string
}

export type StatusProducao = 'encomendado' | 'em_producao' | 'pronto' | 'entregue' | 'cancelado'

export interface Producao {
  id: string
  descricao: string
  cliente_id: string | null
  responsavel: string | null
  status: StatusProducao
  previsao_entrega: string | null
  valor_centavos: number | null
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
  valor_centavos: number | null
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
  valor_fornecedor_centavos: number | null
  preco_venda_centavos: number | null
  quantidade: number
  status: StatusConsignacao
  data_entrada: string
  data_saida: string | null
  venda_id: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

// Os tipos `Pedido`, `PedidoItem` e `Ticket` saíram em 31/07/2026: eram da
// loja online (checkout) e do formulário "Ajuda com meu pedido" do site, os
// dois desligados. As tabelas seguem no banco, vazias — se algum dia
// voltarem, o desenho está em docs/ARQUITETURA-CHECKOUT.md.

export interface Perfil {
  id: string
  nome: string | null
  papel: string
  ativo: boolean
  created_at: string
}

// ── Kits (migração 0016) ──────────────────────────────────────────────
// Conjunto de peças vendido como um item só. NÃO tem estoque próprio:
// quem tem estoque são as peças de dentro (`kit_itens`). Ver o cabeçalho
// de supabase/migrations/0016_kits.sql para o porquê de não ser produto.
export interface Kit {
  id: string
  slug: string
  nome: string
  subtitulo: string | null
  /** Texto da tarja no card de destaque da home. Ex.: "Mais amado". */
  selo: string | null
  preco_centavos: number
  /** false = o preço acompanha a soma das peças; true = valor digitado. */
  preco_manual: boolean
  foto_urls: string[]
  ativo: boolean
  visivel_no_site: boolean
  destaque_site: boolean
  /** 1, 2 ou 3 — as três posições da home. */
  destaque_ordem: number | null
  esconder_sem_estoque: boolean
  created_at: string
  updated_at: string
}

export interface KitItem {
  id: string
  kit_id: string
  produto_id: string
  quantidade: number
}

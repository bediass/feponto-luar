import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2, Ban, Eye, Pencil, X, Truck, Check, Undo2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Botao, Campo, Area, Selecao, Interruptor, Card, Modal, Badge, CabecalhoPagina, Vazio, Carregando,
} from '@/components/ui'
import { ModalGarantia, BotaoGarantia } from '@/components/ModalGarantia'
import { formatBRL, formatData, formatDataHora, parseCentavos, centavosParaInput } from '@/lib/format'
import type { Cliente, Produto, Venda, VendaItem, Pagamento, Endereco } from '@/types/db'

type EndForm = { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }
const endVazio: EndForm = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }
function enderecoParaForm(e: Endereco | null): EndForm {
  if (!e) return { ...endVazio }
  return {
    cep: e.cep ?? '', logradouro: e.logradouro ?? '', numero: e.numero ?? '',
    complemento: e.complemento ?? '', bairro: e.bairro ?? '', cidade: e.cidade ?? '', uf: e.uf ?? '',
  }
}

interface ItemForm {
  produto_id: string
  /** Preenchido quando o item vendido é um KIT. Nunca vem junto com
   *  produto_id: kit não é peça de estoque, ele se decompõe nas peças
   *  dentro de `registrar_venda` (ver 0017_venda_com_kit.sql). */
  kit_id: string
  descricao: string
  quantidade: string
  preco_unitario: string
}

/** Kit como a tela de vendas precisa: nome, preço e quantos dá pra montar. */
interface KitVendavel {
  id: string
  nome: string
  preco_centavos: number
  montaveis: number
}

interface VendaLista extends Venda {
  pagamentos?: Pick<Pagamento, 'forma' | 'parcelas'>[]
  venda_itens?: { id: string }[]
}

const FORMAS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  crediario: 'Crediário (caderninho)',
  transferencia: 'Transferência',
}

const itemVazio: ItemForm = { produto_id: '', kit_id: '', descricao: '', quantidade: '1', preco_unitario: '' }

// O <select> mistura kits e peças, então o valor carrega o tipo junto.
const PREFIXO_KIT = 'kit:'
const hoje = () => new Date().toISOString().slice(0, 10)

export default function Vendas() {
  const [vendas, setVendas] = useState<VendaLista[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [kits, setKits] = useState<KitVendavel[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [editando, setEditando] = useState<VendaLista | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([{ ...itemVazio }])
  const [desconto, setDesconto] = useState('')
  const [forma, setForma] = useState('dinheiro')
  const [parcelas, setParcelas] = useState('1')
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(hoje())
  const [observacoes, setObservacoes] = useState('')
  const [precisaEnvio, setPrecisaEnvio] = useState(false)
  const [endEnvio, setEndEnvio] = useState<EndForm>(endVazio)

  const [detalhe, setDetalhe] = useState<{ venda: VendaLista; itens: VendaItem[] } | null>(null)
  const [garantia, setGarantia] = useState<{ venda: VendaLista; itens: VendaItem[] } | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [v, p, c, k] = await Promise.all([
      supabase.from('vendas').select('*, clientes(id, nome), pagamentos(forma, parcelas), venda_itens(id)').order('data_venda', { ascending: false }),
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('kits').select('id, nome, preco_centavos, kit_itens(quantidade, produto:produtos(estoque))')
        .eq('ativo', true).order('nome'),
    ])
    setVendas((v.data as VendaLista[]) ?? [])
    setProdutos((p.data as Produto[]) ?? [])
    setClientes((c.data as Cliente[]) ?? [])
    // Quantos kits dá pra montar = menor (estoque da peça ÷ quantidade no kit).
    // Mesma conta da view `kits_site` e da tela de Kits.
    setKits((((k.data ?? []) as unknown) as {
      id: string; nome: string; preco_centavos: number
      kit_itens: { quantidade: number; produto: { estoque: number } | null }[]
    }[]).map((kit) => {
      const itens = (kit.kit_itens ?? []).filter((i) => i.produto)
      return {
        id: kit.id, nome: kit.nome, preco_centavos: kit.preco_centavos,
        montaveis: itens.length === 0 ? 0
          : Math.min(...itens.map((i) => Math.floor(i.produto!.estoque / i.quantidade))),
      }
    }))
    setCarregando(false)
  }

  function abrirNova() {
    setEditando(null)
    setClienteId('')
    setItens([{ ...itemVazio }])
    setDesconto('')
    setForma('dinheiro')
    setParcelas('1')
    setDataPrimeiraParcela(hoje())
    setObservacoes('')
    setPrecisaEnvio(false)
    setEndEnvio(endVazio)
    setErro(null)
    setModalAberto(true)
  }

  function usarEnderecoCliente() {
    const c = clientes.find((x) => x.id === clienteId)
    if (c?.endereco) setEndEnvio(enderecoParaForm(c.endereco))
  }

  function alternarEnvio() {
    const novo = !precisaEnvio
    setPrecisaEnvio(novo)
    const vazio = !endEnvio.cep && !endEnvio.logradouro && !endEnvio.cidade
    if (novo && vazio) usarEnderecoCliente()
  }

  async function abrirEdicao(v: VendaLista) {
    const [itensResp, pagResp, contasResp] = await Promise.all([
      supabase.from('venda_itens').select('*').eq('venda_id', v.id),
      supabase.from('pagamentos').select('*').eq('venda_id', v.id).limit(1),
      supabase.from('contas').select('vencimento').eq('venda_id', v.id).order('vencimento').limit(1),
    ])
    const its = (itensResp.data as VendaItem[]) ?? []
    const pag = (pagResp.data as Pagamento[])?.[0]
    setEditando(v)
    setClienteId(v.cliente_id ?? '')
    setItens(
      its.length
        ? its.map((it) => ({
            produto_id: it.produto_id ?? '',
            kit_id: it.kit_id ?? '',
            descricao: it.descricao ?? '',
            quantidade: String(it.quantidade),
            preco_unitario: centavosParaInput(it.preco_unitario_centavos),
          }))
        : [{ ...itemVazio }],
    )
    setDesconto(v.desconto_centavos ? centavosParaInput(v.desconto_centavos) : '')
    setForma(pag?.forma ?? 'dinheiro')
    setParcelas(String(pag?.parcelas ?? 1))
    setDataPrimeiraParcela((contasResp.data as { vencimento: string }[])?.[0]?.vencimento ?? hoje())
    setObservacoes(v.observacoes ?? '')
    setPrecisaEnvio(v.precisa_envio ?? false)
    setEndEnvio(enderecoParaForm(v.endereco_envio))
    setErro(null)
    setModalAberto(true)
  }

  function alterarItem(i: number, campo: keyof ItemForm, valor: string) {
    setItens((atual) => {
      const novo = [...atual]
      if (campo === 'produto_id') {
        // O select devolve "kit:<uuid>" pra kit e o uuid puro pra peça.
        // Os dois campos nunca ficam preenchidos ao mesmo tempo.
        if (valor.startsWith(PREFIXO_KIT)) {
          const kit = kits.find((k) => k.id === valor.slice(PREFIXO_KIT.length))
          novo[i] = {
            ...novo[i], produto_id: '', kit_id: kit?.id ?? '',
            descricao: kit?.nome ?? novo[i].descricao,
            preco_unitario: kit ? centavosParaInput(kit.preco_centavos) : novo[i].preco_unitario,
          }
        } else {
          const prod = produtos.find((p) => p.id === valor)
          novo[i] = {
            ...novo[i], produto_id: valor, kit_id: '',
            descricao: prod ? prod.nome : novo[i].descricao,
            preco_unitario: prod ? centavosParaInput(prod.preco_centavos) : novo[i].preco_unitario,
          }
        }
        return novo
      }
      novo[i] = { ...novo[i], [campo]: valor }
      return novo
    })
  }

  const total = useMemo(() => {
    const soma = itens.reduce(
      (s, it) => s + (parseInt(it.quantidade || '0', 10) || 0) * parseCentavos(it.preco_unitario),
      0,
    )
    return Math.max(0, soma - parseCentavos(desconto))
  }, [itens, desconto])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const itensValidos = itens.filter((it) => it.descricao.trim() && parseCentavos(it.preco_unitario) > 0)
    if (itensValidos.length === 0) {
      setErro('Adicione ao menos um item com descrição e preço.')
      return
    }
    const enderecoEnvio: Endereco | null = precisaEnvio
      ? {
          cep: endEnvio.cep.trim() || undefined,
          logradouro: endEnvio.logradouro.trim() || undefined,
          numero: endEnvio.numero.trim() || undefined,
          complemento: endEnvio.complemento.trim() || undefined,
          bairro: endEnvio.bairro.trim() || undefined,
          cidade: endEnvio.cidade.trim() || undefined,
          uf: endEnvio.uf.trim().toUpperCase() || undefined,
        }
      : null
    setSalvando(true)
    const { error } = await supabase.rpc('registrar_venda', {
      p_venda_id: editando?.id ?? null,
      p_cliente_id: clienteId || null,
      p_desconto_centavos: parseCentavos(desconto),
      p_forma: forma,
      p_parcelas: parseInt(parcelas || '1', 10),
      p_data_primeira_parcela: forma === 'crediario' ? dataPrimeiraParcela || hoje() : null,
      p_observacoes: observacoes.trim() || null,
      p_itens: itensValidos.map((it) => ({
        produto_id: it.produto_id || null,
        kit_id: it.kit_id || null,
        descricao: it.descricao.trim(),
        quantidade: parseInt(it.quantidade || '1', 10),
        preco_unitario_centavos: parseCentavos(it.preco_unitario),
      })),
      p_precisa_envio: precisaEnvio,
      p_endereco_envio: enderecoEnvio,
    })
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setModalAberto(false)
    carregar()
  }

  /** Concluir / reabrir é só a coluna `status` (0021). Estoque e caixa já
   *  se moveram no registro, então aqui nada é estornado nem lançado. */
  async function mudarStatus(v: VendaLista, status: 'concluida' | 'em_andamento') {
    setVendas((atual) => atual.map((x) => (x.id === v.id ? { ...x, status } : x)))
    const { error } = await supabase.from('vendas').update({ status }).eq('id', v.id)
    if (error) {
      alert('Erro ao mudar o status: ' + error.message)
      carregar()
    }
  }

  async function cancelar(v: VendaLista) {
    if (!confirm(`Cancelar a venda #${v.numero}? O estoque será estornado.`)) return
    const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: v.id })
    if (error) {
      alert('Erro ao cancelar: ' + error.message)
      return
    }
    carregar()
  }

  async function verDetalhe(v: VendaLista) {
    const { data } = await supabase.from('venda_itens').select('*').eq('venda_id', v.id)
    setDetalhe({ venda: v, itens: (data as VendaItem[]) ?? [] })
  }

  /** Cartão de garantia da venda — os itens viram a linha "Peça(s)". */
  async function abrirGarantia(v: VendaLista) {
    const { data } = await supabase.from('venda_itens').select('*').eq('venda_id', v.id)
    setGarantia({ venda: v, itens: (data as VendaItem[]) ?? [] })
  }

  const mostrarParcelas = forma === 'credito' || forma === 'crediario'
  const emAndamento = useMemo(() => vendas.filter((v) => v.status === 'em_andamento').length, [vendas])

  return (
    <div>
      <CabecalhoPagina
        titulo="Vendas"
        subtitulo={
          emAndamento > 0
            ? `${vendas.length} venda(s) registrada(s) · ${emAndamento} em andamento`
            : `${vendas.length} venda(s) registrada(s)`
        }
        acao={<Botao onClick={abrirNova}><Plus size={16} /> Nova venda</Botao>}
      />

      {carregando ? (
        <Carregando />
      ) : vendas.length === 0 ? (
        <Vazio
          titulo="Nenhuma venda registrada"
          descricao="Registre a primeira venda de balcão da loja."
          acao={<Botao onClick={abrirNova}><Plus size={16} /> Nova venda</Botao>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs uppercase tracking-wide text-marca-500">
                  <th className="px-4 py-3 font-medium">Venda</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className="border-b border-marca-100 last:border-0 hover:bg-marca-50/60">
                    <td className="px-4 py-3 font-medium text-marca-700">#{v.numero}</td>
                    <td className="px-4 py-3 text-marca-500">{formatDataHora(v.data_venda)}</td>
                    <td className="px-4 py-3 text-marca-700">{v.clientes?.nome ?? <span className="text-marca-300">Sem cliente</span>}</td>
                    <td className="px-4 py-3 text-marca-500">
                      {v.pagamentos?.[0] ? FORMAS[v.pagamentos[0].forma] ?? v.pagamentos[0].forma : '-'}
                      {v.precisa_envio && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-fendi-700" title="Será enviado pelos Correios">
                          <Truck size={12} /> envio
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-marca-800">{formatBRL(v.total_centavos)}</td>
                    <td className="px-4 py-3 text-center">
                      {v.status === 'concluida' ? (
                        <Badge cor="verde">Concluída</Badge>
                      ) : v.status === 'cancelada' ? (
                        <Badge cor="vermelho">Cancelada</Badge>
                      ) : v.status === 'em_andamento' ? (
                        <Badge cor="azul">Em andamento</Badge>
                      ) : (
                        <Badge cor="ambar">Orçamento</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {v.status === 'em_andamento' && (
                          <button
                            onClick={() => mudarStatus(v, 'concluida')}
                            className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            title="Marcar esta venda como concluída"
                          >
                            <Check size={14} /> Concluir
                          </button>
                        )}
                        {v.status === 'concluida' && (
                          <button
                            onClick={() => mudarStatus(v, 'em_andamento')}
                            className="rounded-lg p-1.5 text-marca-400 hover:bg-marca-100 hover:text-marca-700"
                            title="Voltar para em andamento"
                          >
                            <Undo2 size={16} />
                          </button>
                        )}
                        <button onClick={() => verDetalhe(v)} className="rounded-lg p-1.5 text-marca-400 hover:bg-marca-100 hover:text-marca-700" title="Ver itens">
                          <Eye size={16} />
                        </button>
                        {v.status !== 'cancelada' && <BotaoGarantia onClick={() => abrirGarantia(v)} />}
                        {v.status !== 'cancelada' && (
                          <button onClick={() => abrirEdicao(v)} className="rounded-lg p-1.5 text-marca-400 hover:bg-marca-100 hover:text-marca-700" title="Editar venda">
                            <Pencil size={16} />
                          </button>
                        )}
                        {v.status !== 'cancelada' && (
                          <button onClick={() => cancelar(v)} className="rounded-lg p-1.5 text-marca-400 hover:bg-red-50 hover:text-red-600" title="Cancelar venda">
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal aberto={modalAberto} titulo={editando ? `Editar venda #${editando.numero}` : 'Nova venda'} onFechar={() => setModalAberto(false)} largura="max-w-3xl">
        <form onSubmit={salvar} className="space-y-4">
          <Selecao label="Cliente (opcional)" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Sem cliente / venda avulsa</option>
            {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
          </Selecao>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-marca-600">Itens da venda</span>
              <button type="button" onClick={() => setItens([...itens, { ...itemVazio }])} className="flex items-center gap-1 text-sm font-medium text-marca-700 hover:text-marca-900">
                <Plus size={15} /> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((it, i) => {
                const sub = (parseInt(it.quantidade || '0', 10) || 0) * parseCentavos(it.preco_unitario)
                return (
                  <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-marca-200 bg-marca-50 p-2">
                    <div className="min-w-[180px] flex-1">
                      <select
                        value={it.kit_id ? PREFIXO_KIT + it.kit_id : it.produto_id}
                        onChange={(e) => alterarItem(i, 'produto_id', e.target.value)}
                        aria-label="Peça, kit ou item livre"
                        className="w-full rounded-lg border border-marca-300 bg-white px-2 py-1.5 text-sm text-marca-900 outline-none focus:border-fendi-500"
                      >
                        <option value="">Peça do estoque, kit ou item livre</option>
                        {kits.length > 0 && (
                          <optgroup label="Kits">
                            {kits.map((k) => (
                              <option key={k.id} value={PREFIXO_KIT + k.id}>
                                {k.nome} ({k.montaveis} pra montar)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Peças">
                          {produtos.map((p) => (
                            <option key={p.id} value={p.id}>{p.codigo ? p.codigo + ' - ' : ''}{p.nome} ({p.estoque} em estoque)</option>
                          ))}
                        </optgroup>
                      </select>
                      {it.kit_id && (
                        <p className="mt-1 text-xs text-marca-500">
                          Ao salvar, as peças deste kit dão baixa sozinhas no estoque.
                        </p>
                      )}
                      <input
                        value={it.descricao}
                        onChange={(e) => alterarItem(i, 'descricao', e.target.value)}
                        placeholder="Descrição do item"
                        className="mt-1 w-full rounded-lg border border-marca-300 bg-white px-2 py-1.5 text-sm text-marca-900 outline-none focus:border-fendi-500"
                      />
                    </div>
                    <div className="w-16">
                      <span className="mb-0.5 block text-xs text-marca-400">Qtd</span>
                      <input type="number" min={1} value={it.quantidade} onChange={(e) => alterarItem(i, 'quantidade', e.target.value)} className="w-full rounded-lg border border-marca-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-fendi-500" />
                    </div>
                    <div className="w-28">
                      <span className="mb-0.5 block text-xs text-marca-400">Preço un.</span>
                      <input value={it.preco_unitario} onChange={(e) => alterarItem(i, 'preco_unitario', e.target.value)} placeholder="0,00" inputMode="decimal" className="w-full rounded-lg border border-marca-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-fendi-500" />
                    </div>
                    <div className="w-24 text-right">
                      <span className="mb-0.5 block text-xs text-marca-400">Subtotal</span>
                      <span className="block py-1.5 text-sm font-medium text-marca-700">{formatBRL(sub)}</span>
                    </div>
                    <button type="button" onClick={() => setItens(itens.filter((_, idx) => idx !== i))} disabled={itens.length === 1} className="rounded-lg p-1.5 text-marca-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)}>
              {Object.entries(FORMAS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Selecao>
            {mostrarParcelas ? (
              <Campo label="Parcelas" type="number" min={1} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            ) : (
              <Campo label="Desconto (R$)" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" inputMode="decimal" />
            )}
          </div>
          {forma === 'crediario' && (
            <Campo label="Data do primeiro pagamento" type="date" value={dataPrimeiraParcela} onChange={(e) => setDataPrimeiraParcela(e.target.value)} />
          )}
          {mostrarParcelas && (
            <Campo label="Desconto (R$)" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" inputMode="decimal" />
          )}

          <div className="rounded-lg border border-marca-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-marca-700">Será enviado pelos Correios?</p>
                <p className="text-xs text-marca-400">Ligue para este pedido entrar na aba Pedidos com rastreio.</p>
              </div>
              <Interruptor ligado={precisaEnvio} onToggle={alternarEnvio} titulo="Será enviado pelos Correios?" />
            </div>
            {precisaEnvio && (
              <div className="mt-3 space-y-3 border-t border-marca-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-marca-400">Endereço de envio</span>
                  {clienteId && (
                    <button type="button" onClick={usarEnderecoCliente} className="text-xs font-medium text-marca-600 hover:text-marca-900">
                      Usar o endereço do cliente
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo label="CEP" value={endEnvio.cep} onChange={(e) => setEndEnvio({ ...endEnvio, cep: e.target.value })} placeholder="00000-000" inputMode="numeric" />
                  <div className="sm:col-span-2">
                    <Campo label="Endereço" value={endEnvio.logradouro} onChange={(e) => setEndEnvio({ ...endEnvio, logradouro: e.target.value })} placeholder="Rua, avenida..." />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo label="Número" value={endEnvio.numero} onChange={(e) => setEndEnvio({ ...endEnvio, numero: e.target.value })} />
                  <Campo label="Complemento" value={endEnvio.complemento} onChange={(e) => setEndEnvio({ ...endEnvio, complemento: e.target.value })} placeholder="Apto, bloco..." />
                  <Campo label="Bairro" value={endEnvio.bairro} onChange={(e) => setEndEnvio({ ...endEnvio, bairro: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Campo label="Cidade" value={endEnvio.cidade} onChange={(e) => setEndEnvio({ ...endEnvio, cidade: e.target.value })} />
                  </div>
                  <Campo label="UF" value={endEnvio.uf} onChange={(e) => setEndEnvio({ ...endEnvio, uf: e.target.value })} maxLength={2} placeholder="MG" />
                </div>
              </div>
            )}
          </div>

          <Area label="Observações" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />

          <div className="flex items-center justify-between rounded-lg bg-marca-50 px-4 py-3">
            <span className="text-sm font-medium text-marca-600">Total da venda</span>
            <span className="text-2xl font-bold text-marca-900">{formatBRL(total)}</span>
          </div>

          {forma === 'crediario' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Crediário: {parseInt(parcelas || '1', 10)} parcela(s) a receber no Financeiro, a 1ª em {formatData(dataPrimeiraParcela)} e as demais de 30 em 30 dias.
            </p>
          )}

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Registrar venda'}</Botao>
          </div>
        </form>
      </Modal>

      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-marca-200 px-5 py-3">
              <h3 className="text-lg font-semibold text-marca-800">Venda #{detalhe.venda.numero}</h3>
              <button onClick={() => setDetalhe(null)} className="rounded-lg p-1 text-marca-400 hover:bg-marca-100">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="mb-3 text-sm text-marca-500">
                <p>{formatDataHora(detalhe.venda.data_venda)}</p>
                {detalhe.venda.clientes?.nome && <p>Cliente: {detalhe.venda.clientes.nome}</p>}
              </div>
              <ul className="divide-y divide-marca-100">
                {detalhe.itens.map((it) => (
                  <li key={it.id} className="flex justify-between py-2 text-sm">
                    <span className="text-marca-700">{it.quantidade}x {it.descricao}</span>
                    <span className="font-medium text-marca-700">{formatBRL(it.subtotal_centavos)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-marca-200 pt-3">
                <span className="font-medium text-marca-600">Total</span>
                <span className="text-lg font-bold text-marca-800">{formatBRL(detalhe.venda.total_centavos)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalGarantia
        aberto={!!garantia}
        onFechar={() => setGarantia(null)}
        referencia={garantia ? `#${garantia.venda.numero}` : ''}
        cliente={garantia?.venda.clientes?.nome ?? null}
        pecas={
          garantia
            ? garantia.itens.map((i) => `${i.quantidade}x ${i.descricao ?? 'Item'}`).join(' · ')
            : ''
        }
        dataISO={garantia?.venda.data_venda ?? null}
      />
    </div>
  )
}
